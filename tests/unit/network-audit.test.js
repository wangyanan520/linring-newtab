/**
 * PBI-14 网络请求审计规则测试（node:test）
 * 运行：npm test
 *
 * 覆盖 isAllowed 白名单规则，以及 manifest host_permissions / CSP connect-src
 * 与注册表的一致性（US-16 AC3：任何新增网络请求必须显式注册）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { NETWORK_ALLOWLIST, isAllowed, matchHost } = require('../../src/scripts/network-audit.js');

const PAGE_URL = 'chrome-extension://fkapmejgokgfcbkehkcklneoidjgccdm/index.html';

test('PBI-14 白名单：注册表内域名放行', () => {
  const ok = [
    'https://wttr.in/?format=j1&lang=zh',
    'https://cn.bing.com/HPImageArchive.aspx?format=js',
    'https://bing.biturl.top/?resolution=1920&format=image',
    'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/2026.json',
    'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/2026.json',
    'https://favicon.im/www.baidu.com',
    'https://a.favicon.im/www.baidu.com',        // CDN 子域（实测重定向目标）
    'https://cdn.favicon.im/any.png'
  ];
  for (const url of ok) {
    assert.strictEqual(isAllowed(url, PAGE_URL), true, `应放行: ${url}`);
  }
});

test('PBI-14 白名单：清单外请求拒绝', () => {
  const no = [
    'https://evil-tracker.example.com/pixel',
    'https://www.google-analytics.com/collect',
    'https://telemetry.mozilla.org/x',
    'https://example.com/api?foo=1',
    'http://wttr.in.evil.com/x'                  // 子域欺骗（非精确匹配）
  ];
  for (const url of no) {
    assert.strictEqual(isAllowed(url, PAGE_URL), false, `应拒绝: ${url}`);
  }
  // 注意：'not-a-url' 这类相对路径在引入 pageUrl 基准后会被解析为同源资源并放行（P2-2 修复的预期行为），
  // 因此这里改用真正无法解析的 URL 验证兜底分支
  assert.strictEqual(isAllowed('http://', PAGE_URL), false, '非法 URL 拒绝');
  assert.strictEqual(isAllowed('https://', PAGE_URL), false, '非法 URL 拒绝（https）');
});

test('PBI-14 favicon 兜底例外：任意域 /favicon.ico 放行，其余路径拒绝', () => {
  assert.strictEqual(isAllowed('https://example.com/favicon.ico', PAGE_URL), true, '任意域 favicon.ico 放行');
  assert.strictEqual(isAllowed('https://example.com/Favicon.ICO', PAGE_URL), true, '大小写不敏感');
  assert.strictEqual(isAllowed('https://example.com/assets/favicon.ico', PAGE_URL), true, '子路径也放行');
  assert.strictEqual(isAllowed('https://example.com/tracker', PAGE_URL), false, '非 favicon 路径拒绝');
});

test('PBI-14 同源豁免：页面自身资源放行', () => {
  assert.strictEqual(isAllowed('chrome-extension://fkapmejgokgfcbkehkcklneoidjgccdm/data/cities.json', PAGE_URL), true, '扩展同源');
  assert.strictEqual(isAllowed('http://127.0.0.1:8899/index.html', 'http://127.0.0.1:8899/index.html'), true, '预览同源');
  assert.strictEqual(isAllowed('http://127.0.0.1:8899/index.html', PAGE_URL), false, '跨源拒绝');
});

test('PBI-14 相对 URL 以 pageUrl 为基准解析（P2-2 回归：不得误报同源资源）', () => {
  // weather.js 用 fetch('data/cities.json') 请求同源文件；修复前 new URL 单参数会抛错，
  // 落入 catch 被判为"白名单外"，导致每次打开新标签页都输出一条审计误报
  assert.strictEqual(isAllowed('data/cities.json', 'http://127.0.0.1:8899/index.html'), true, '相对路径解析为同源');
  assert.strictEqual(isAllowed('data/cities.json', 'chrome-extension://fkapmejgokgfcbkehkcklneoidjgccdm/index.html'), true, '扩展页相对路径同源');
  assert.strictEqual(isAllowed('./data/cities.json', 'http://127.0.0.1:8899/index.html'), true, './ 前缀同样放行');
  assert.strictEqual(isAllowed('data/cities.json', undefined), false, '无基准时保守拒绝');
});

test('PBI-14 matchHost：精确与子域通配', () => {
  assert.strictEqual(matchHost('wttr.in', 'wttr.in'), true);
  assert.strictEqual(matchHost('wttr.in', 'a.wttr.in'), false, '精确规则不含子域');
  assert.strictEqual(matchHost('*.favicon.im', 'a.favicon.im'), true);
  assert.strictEqual(matchHost('*.favicon.im', 'favicon.im'), true, '通配含裸域');
  assert.strictEqual(matchHost('*.favicon.im', 'evilexample.favicon.im.evil.com'), false);
});

test('PBI-14 manifest 一致性：host_permissions 与 CSP connect-src ⊆ 注册表（US-16 AC3）', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'manifest.json'), 'utf8'));
  const hosts = NETWORK_ALLOWLIST.map(e => e.host.replace(/^\*\./, ''));
  const checkHost = (h) => hosts.some(r => matchHost(r.startsWith('*.') ? r : r, h));
  // host_permissions 中的域名必须已在注册表注册
  for (const hp of manifest.host_permissions || []) {
    const host = new URL(hp).hostname;
    assert.ok(hosts.includes(host), `host_permissions 未注册: ${host}`);
  }
  // CSP connect-src 域名必须已在注册表注册
  const csp = manifest.content_security_policy.extension_pages;
  const m = csp.match(/connect-src ([^;]+)/);
  assert.ok(m, 'CSP 含 connect-src');
  for (const src of m[1].split(/\s+/).filter(s => s.startsWith('https://'))) {
    const host = new URL(src).hostname;
    assert.ok(hosts.includes(host), `CSP connect-src 未注册: ${host}`);
  }
});
