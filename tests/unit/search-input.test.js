/**
 * UX-03 / UX-04 单测：搜索框输入判定与回车提交判定
 * 运行：npm test
 *
 * 为什么单独测这两个纯函数：
 * - resolveInput 是"输入网址就打开网站"这条承诺的全部逻辑，判定表是它的可执行规格；
 *   它同时是最容易过拟合的地方（把搜索词误判成网址比不跳转更糟），所以边界值必须钉死。
 * - isCommitEnter 是本仓库第二次修同一个缺陷（P2-9 只修了待办输入框，搜索框漏改），
 *   用单测把"合成期间不回提交"变成跨输入框的统一契约。
 */
const { test } = require('node:test');
const assert = require('node:assert');

const { resolveInput } = require('../../src/scripts/main.js');
const { isCommitEnter } = require('../../src/scripts/storage.js');

/* ---------- UX-03 resolveInput ---------- */

test('resolveInput：带协议的输入原样作为网址', () => {
  for (const input of ['https://github.com', 'http://example.com/a?b=1', 'chrome-extension://abc/x.html']) {
    const r = resolveInput(input);
    assert.strictEqual(r.type, 'url', input);
    assert.strictEqual(r.target, input);
  }
});

test('resolveInput：可执行协议不导航，按搜索词处理（ADV-10）', () => {
  const cases = [
    'javascript://alert(1)',
    'JavaScript://alert(1)',
    'data://text/html,<script>alert(1)</script>',
    'vbscript://msgbox(1)'
  ];
  for (const input of cases) {
    const r = resolveInput(input);
    assert.strictEqual(r.type, 'search', `${input} 不得直跳`);
    assert.strictEqual(r.target, input, '保留原始输入供搜索');
  }
  // 普通协议仍直跳：file:// 是用户主动输入本地路径，chrome:// 是合法浏览器地址
  for (const input of ['file:///Users/me/a.txt', 'chrome://settings', 'about://blank']) {
    assert.strictEqual(resolveInput(input).type, 'url', `${input} 应直跳`);
  }
});

test('resolveInput：常见域名补 https 并直跳', () => {
  const cases = [
    ['github.com', 'https://github.com'],
    ['www.baidu.com', 'https://www.baidu.com'],
    ['baidu.com/s?wd=x', 'https://baidu.com/s?wd=x'],
    ['news.ycombinator.com', 'https://news.ycombinator.com'],
    ['example.dev', 'https://example.dev'],
    ['my-site.co.uk', 'https://my-site.co.uk'],
    ['tool.lu', 'https://tool.lu']
  ];
  for (const [input, expected] of cases) {
    const r = resolveInput(input);
    assert.strictEqual(r.type, 'url', `${input} 应判为网址`);
    assert.strictEqual(r.target, expected);
  }
});

test('resolveInput：本机地址与 IP 补 http（本地开发通常没有 https）', () => {
  const cases = [
    ['localhost', 'http://localhost'],
    ['localhost:3000', 'http://localhost:3000'],
    ['localhost:8080/admin', 'http://localhost:8080/admin'],
    ['127.0.0.1:5173', 'http://127.0.0.1:5173'],
    ['192.168.1.1', 'http://192.168.1.1'],
    ['10.0.0.5:8000', 'http://10.0.0.5:8000']
  ];
  for (const [input, expected] of cases) {
    const r = resolveInput(input);
    assert.strictEqual(r.type, 'url', `${input} 应判为网址`);
    assert.strictEqual(r.target, expected);
  }
});

test('resolveInput：中文域名按 IDN 处理', () => {
  const r = resolveInput('中文.中国');
  assert.strictEqual(r.type, 'url');
  assert.strictEqual(r.target, 'https://中文.中国');
});

test('resolveInput：数字形态一律不当作网址（保守优先）', () => {
  // 这些是版本号 / 小数 / 章节号，不是网址；误判会让搜索行为变得不可预测
  for (const input of ['3.14', '1.2.3', '2.0', '192.168.1', '999.999.999.999']) {
    const r = resolveInput(input);
    assert.strictEqual(r.type, 'search', `${input} 应判为搜索`);
    assert.strictEqual(r.target, input);
  }
});

test('resolveInput：未知顶级域走搜索，不误跳', () => {
  for (const input of ['报告.txt', '安装包.zip', 'something.notarealtld']) {
    assert.strictEqual(resolveInput(input).type, 'search', `${input} 应判为搜索`);
  }
});

test('resolveInput：普通查询词走搜索且保留原文', () => {
  const cases = ['如何学习 css', '天气预报', 'vue3 响应式原理', 'a b c', 'chrome extension 开发'];
  for (const input of cases) {
    const r = resolveInput(input);
    assert.strictEqual(r.type, 'search', `${input} 应判为搜索`);
    assert.strictEqual(r.target, input);
  }
});

test('resolveInput：空白与非字符串输入不产生导航', () => {
  for (const input of ['', '   ', '\t\n', null, undefined]) {
    const r = resolveInput(input);
    assert.strictEqual(r.type, 'search');
    assert.strictEqual(r.target, '');
  }
});

test('resolveInput：首尾空白被裁剪但不影响判定', () => {
  const r = resolveInput('  github.com  ');
  assert.strictEqual(r.type, 'url');
  assert.strictEqual(r.target, 'https://github.com');
});

/* ---------- UX-04 isCommitEnter ---------- */

test('isCommitEnter：输入法合成期间的回车不算提交', () => {
  assert.strictEqual(isCommitEnter({ key: 'Enter', isComposing: true }), false);
});

test('isCommitEnter：正常回车算提交', () => {
  assert.strictEqual(isCommitEnter({ key: 'Enter', isComposing: false }), true);
  // 部分浏览器不派发 isComposing 字段，缺省应视为正常回车
  assert.strictEqual(isCommitEnter({ key: 'Enter' }), true);
});

test('isCommitEnter：其它按键不算提交', () => {
  for (const key of ['a', 'Escape', 'NumpadEnter_fake', 'Space']) {
    assert.strictEqual(isCommitEnter({ key, isComposing: false }), false, key);
  }
});
