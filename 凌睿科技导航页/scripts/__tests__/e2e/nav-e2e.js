/**
 * 凌睿科技导航页 E2E 冒烟测试（PBI-15 起点）
 *
 * 运行方式：
 *   # 扩展模式（需要 Chrome for Testing + GUI 会话；验证 CSP/chrome.storage/newtab 覆盖）
 *   node scripts/__tests__/e2e/nav-e2e.js --extension
 *   # 预览模式（headless，无需 GUI；http + file:// 双模式）
 *   node scripts/__tests__/e2e/nav-e2e.js --preview
 *   # 全部
 *   node scripts/__tests__/e2e/nav-e2e.js
 *
 * 前置条件：本机已安装 playwright（npm i -D playwright）并下载浏览器：
 *   npx playwright install chromium
 *   （扩展模式需 Chrome for Testing，路径用 CFT_PATH 环境变量指定）
 *
 * 环境变量：
 *   CFT_PATH    Chrome for Testing 可执行文件路径（默认自动探测 ms-playwright 缓存）
 *   EXT_PATH    扩展源码目录（默认本仓库 凌睿科技导航页/）
 *   PORT        预览模式 http 端口（默认 8899）
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');

// 扩展源码目录：脚本位于 凌睿科技导航页/scripts/__tests__/e2e/，向上三级即扩展目录
const EXT_PATH = process.env.EXT_PATH || path.resolve(__dirname, '..', '..', '..');
const PORT = parseInt(process.env.PORT || '8899', 10);

function findCft() {
  if (process.env.CFT_PATH && fs.existsSync(process.env.CFT_PATH)) return process.env.CFT_PATH;
  const cache = path.join(require('os').homedir(), 'Library', 'Caches', 'ms-playwright');
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort();
    for (let i = dirs.length - 1; i >= 0; i--) {
      const cand = path.join(cache, dirs[i], 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
      if (fs.existsSync(cand)) return cand;
    }
  }
  return null;
}

/* headless shell 自动探测：本机 ms-playwright 缓存的浏览器版本可能与
   playwright 包期望的 revision 不一致，探测实际存在的可用版本 */
function findHeadlessShell() {
  if (process.env.SHELL_PATH && fs.existsSync(process.env.SHELL_PATH)) return process.env.SHELL_PATH;
  const cache = path.join(require('os').homedir(), 'Library', 'Caches', 'ms-playwright');
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter(d => /^chromium_headless_shell-\d+$/.test(d)).sort();
    for (let i = dirs.length - 1; i >= 0; i--) {
      const dir = dirs[i];
      const sub = fs.readdirSync(path.join(cache, dir)).find(n => n.startsWith('chrome-headless-shell-'));
      if (sub) {
        const cand = path.join(cache, dir, sub, 'chrome-headless-shell');
        if (fs.existsSync(cand)) return cand;
      }
    }
  }
  return null;
}

function headlessLaunchOpts() {
  const shell = findHeadlessShell();
  return shell ? { headless: true, executablePath: shell } : { headless: true };
}

const R = { pass: [], fail: [], info: [] };
const check = (n, c, d = '') => (c ? R.pass : R.fail).push(n + (d ? ` | ${d}` : ''));
const info = (n, d) => R.info.push(`${n} | ${d}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 存储访问统一探测：扩展模式 chrome.storage / 预览模式 localStorage */
const storageGet = (page, key) => page.evaluate(k => new Promise(res => {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(k, s => res(s[k]));
  } else {
    const raw = localStorage.getItem(k);
    res(raw ? JSON.parse(raw) : undefined);
  }
}), key);

/* ---- 内嵌静态文件服务（预览模式用，避免外部依赖） ---- */
function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(EXT_PATH, urlPath === '/' ? 'index.html' : urlPath);
        if (!file.startsWith(EXT_PATH) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          res.writeHead(404); res.end('404'); return;
        }
        res.writeHead(200, { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(file));
      } catch { res.writeHead(500); res.end(); }
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/* ---- 核心断言流程（扩展模式 / http 预览模式共用） ---- */
async function runCore(page, label) {
  const consoleErrors = [];
  const pageErrors = [];
  const requests = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('request', r => requests.push(r.url()));

  if (label === 'extension') {
    await page.waitForTimeout(4500); // newtab 已覆盖为扩展页
  } else {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
  }

  // [1] 渲染
  check('[1] 预设书签 8 个', await page.locator('.bookmark-item').count() === 8);
  check('[1] 预设分类 4 个', await page.locator('.category-card').count() === 4);
  check('[1] 待办/天气/时钟可见', await page.locator('.todo-card').isVisible() && await page.locator('.weather-widget').isVisible() && await page.locator('#datetime').isVisible());

  // [2] 存储初始化 + 数据隔离
  if (label === 'extension') {
    check('[2] 扩展上下文', await page.evaluate(() => !!(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id)));
    check('[2] 扩展页 localStorage 与 chrome.storage 隔离', await page.evaluate(() => !localStorage.getItem('bookmarks')));
  }
  const st = await storageGet(page, 'settings');
  check('[2] settings 初始化', !!(st && st.version === '1.0.0' && st.theme === 'dark'));
  check('[2] 预设书签写入', await storageGet(page, 'bookmarks').then(b => (b || []).length) === 8);

  // [3] 主题
  await page.click('#settingsBtn');
  await sleep(600);
  await page.click('[data-tab="wallpaper"]');
  await sleep(600);
  await page.locator('#themeSelect').selectOption('light');
  await sleep(400);
  check('[3] 浅色即时生效', await page.evaluate(() => document.documentElement.dataset.theme) === 'light');
  await page.reload();
  await sleep(2500);
  check('[3] 主题刷新持久化', await page.evaluate(() => document.documentElement.dataset.theme) === 'light');
  await page.click('#settingsBtn');
  await sleep(500);
  await page.click('[data-tab="wallpaper"]');
  await sleep(500);
  await page.locator('#themeSelect').selectOption('dark');
  await sleep(300);

  // [4] 组件开关
  await page.click('[data-tab="components"]');
  await sleep(600);
  check('[4] 搜索框常驻', await page.locator('input[data-component-id="search"]').isDisabled());
  await page.locator('input[data-component-id="weather"]').uncheck();
  await sleep(500);
  check('[4] 关闭天气即隐藏', await page.evaluate(() => document.querySelector('.weather-widget').classList.contains('component-hidden')));
  for (const id of ['calendar', 'bookmarks', 'categories', 'todos', 'wallpaper']) {
    const cb = page.locator(`input[data-component-id="${id}"]`);
    if (await cb.count() === 1 && await cb.isChecked()) { await cb.uncheck(); await sleep(120); }
  }
  await sleep(400);
  check('[4] 全部组件可关闭 + 搜索框保留', await page.locator('.search-box').isVisible());
  for (const id of ['calendar', 'weather', 'bookmarks', 'categories', 'todos', 'wallpaper']) {
    const cb = page.locator(`input[data-component-id="${id}"]`);
    if (await cb.count() === 1 && !(await cb.isChecked())) { await cb.check(); await sleep(120); }
  }
  await sleep(400);

  // [5] 键盘排序（N1 回归：主页同步刷新）
  await page.click('[data-tab="bookmarks"]');
  await sleep(600);
  const orderBefore = await page.evaluate(() => Array.from(document.querySelectorAll('#bookmarkList .setting-item-title')).map(e => e.textContent));
  await page.locator('[data-action="move-bookmark"][data-dir="up"]').nth(1).click();
  await sleep(600);
  const orderAfter = await page.evaluate(() => Array.from(document.querySelectorAll('#bookmarkList .setting-item-title')).map(e => e.textContent));
  check('[5] 上移改变顺序', JSON.stringify(orderBefore) !== JSON.stringify(orderAfter));
  const homeOrder = await page.evaluate(() => Array.from(document.querySelectorAll('.bookmark-item .bookmark-title')).map(e => e.textContent));
  check('[5] N1 主页顺序随键盘排序同步', JSON.stringify(homeOrder) === JSON.stringify(orderAfter));
  await page.reload();
  await sleep(2500);
  await page.click('#settingsBtn');
  await sleep(500);
  await page.click('[data-tab="bookmarks"]');
  await sleep(500);
  const orderPersist = await page.evaluate(() => Array.from(document.querySelectorAll('#bookmarkList .setting-item-title')).map(e => e.textContent));
  check('[5] 排序刷新持久化', JSON.stringify(orderPersist) === JSON.stringify(orderAfter));

  // [6] 导出 + 隐私文案
  await page.click('[data-tab="data"]');
  await sleep(600);
  const dataText = await page.evaluate(() => document.getElementById('tabData').innerText);
  check('[6] 隐私文案准确（本地备份 + 外部数据源声明）', /不经过任何服务器/.test(dataText) && /外部数据源/.test(dataText) && /无埋点/.test(dataText));
  const dlP = page.waitForEvent('download', { timeout: 8000 });
  await page.click('#exportDataBtn');
  const dl = await dlP;
  const dlPath = path.join(require('os').tmpdir(), 'nav-e2e-export.json');
  await dl.saveAs(dlPath);
  const exp = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
  check('[6] 导出完整性', exp.schemaVersion === 1 && typeof exp.exportedAt === 'string' && ['bookmarks', 'categories', 'settings', 'todos'].every(k => k in exp));

  // [7] 导入 + 备份轮转 + 恢复
  const backup = { schemaVersion: 1, bookmarks: [{ id: 'imp_1', title: '导入书签', url: 'https://imported.example.com' }], categories: [], todos: [], settings: { theme: 'light', weatherCity: 'shenzhen', showBottomBar: false, wallpaperName: '极光绿' } };
  const bPath = path.join(require('os').tmpdir(), 'nav-e2e-backup.json');
  fs.writeFileSync(bPath, JSON.stringify(backup));
  await page.setInputFiles('#importDataInput', bPath);
  await sleep(1200);
  const fb1 = await page.locator('#dataFeedback').innerText().catch(() => '');
  check('[7] 导入成功含统计/清空警告', /导入成功/.test(fb1) && /已被清空/.test(fb1));
  check('[7] 导入前备份轮转写入', await storageGet(page, 'lastImportBackup-1').then(b => !!(b && b.bookmarks && b.bookmarks.length === 8)));
  // A10 验证（恢复前）：themeSelect 同步，其余控件不同步
  check('[8] A10 主题下拉同步', await page.locator('#themeSelect').inputValue() === 'light');
  check('[8] A10 底部栏开关同步（导入 showBottomBar:false）', await page.locator('#showBottomBarToggle').isChecked() === false);
  check('[8] A10 壁纸源下拉同步（导入 极光绿）', await page.locator('#wallpaperSourceSelect').inputValue() === '极光绿');
  check('[8] A10 刷新按钮随壁纸类型隐藏（预设无刷新）', await page.evaluate(() => {
    const btn = document.getElementById('refreshWallpaperBtn');
    return btn && btn.style.display === 'none';
  }));
  page.once('dialog', d => d.accept());
  await page.click('#restoreBackupBtn');
  await sleep(1000);
  const fbR = await page.locator('#dataFeedback').innerText().catch(() => '');
  check('[7] 恢复最近备份', /已恢复/.test(fbR));
  check('[7] 恢复后书签数回 8+', await storageGet(page, 'bookmarks').then(b => (b || []).length) >= 8);

  // [9] 恶意 id 拒绝（A8 回归）
  fs.writeFileSync(bPath, JSON.stringify({ schemaVersion: 1, bookmarks: [{ id: 'bm"]x', title: '恶意', url: 'https://evil.example.com' }], categories: [], todos: [] }));
  await page.setInputFiles('#importDataInput', bPath);
  await sleep(1000);
  const fbE = await page.locator('#dataFeedback').innerText().catch(() => '');
  check('[9] 恶意 id 被校验拒绝', /导入失败/.test(fbE) && /id 含不支持的字符/.test(fbE));

  // [10] 协议白名单
  fs.writeFileSync(bPath, JSON.stringify({ schemaVersion: 1, bookmarks: [{ id: 'js_1', title: 'x', url: 'javascript:alert(1)' }], categories: [], todos: [] }));
  await page.setInputFiles('#importDataInput', bPath);
  await sleep(1000);
  check('[10] javascript: 拒绝', /导入失败|协议/.test(await page.locator('#dataFeedback').innerText().catch(() => '')));

  // [11] 日历浮层
  await page.keyboard.press('Escape');
  await sleep(300);
  await page.click('#datetime');
  await sleep(1800);
  check('[11] 日历浮层弹出', await page.locator('.datetime-hover-card').isVisible().catch(() => false));
  const cells = await page.locator('.dhc-cell').count();
  check('[11] 日历格子为 7 的倍数', cells % 7 === 0 && cells >= 28, `实际 ${cells}`);

  // [13.5] 扩展模式 CSP 拦截验证
  if (label === 'extension') {
    const evil = await page.evaluate(async () => {
      try { await fetch('https://evil-tracker.example.com/pixel', { signal: AbortSignal.timeout(3000) }); return 'ok'; }
      catch (e) { return 'blocked'; }
    }).catch(() => 'eval-err');
    check('[13.5] CSP 拦截白名单外请求', evil === 'blocked');
    const inline = await page.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = 'window.__inlineRan = true';
      document.head.appendChild(s);
      return window.__inlineRan === true;
    }).catch(() => 'eval-err');
    check('[13.5] CSP 阻止内联脚本', inline !== true);
  }

  // [14] 错误归零（A8/N1 修复后的基线）
  await sleep(2500);
  check('[14] 无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  info('[14] console error 详情', consoleErrors.slice(0, 3).join(' || ') || '无');
  return { consoleErrors, pageErrors, requests };
}

/* ---- file:// 预览模式（US-20 行为验证） ---- */
async function runFileMode() {
  const browser = await chromium.launch(headlessLaunchOpts());
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.join(EXT_PATH, 'index.html');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  check('[F1] file:// 渲染', await page.locator('.bookmark-item').count() === 8);
  const cityOpts = await page.evaluate(() => document.getElementById('weatherCitySelect').options.length);
  check('[F1] file:// 城市降级（US-20 已知行为）', cityOpts <= 1, `实际 ${cityOpts}`);
  check('[F1] file:// 导出可用', await (async () => {
    await page.click('#settingsBtn');
    await sleep(400);
    await page.click('[data-tab="data"]');
    await sleep(400);
    const dlP = page.waitForEvent('download', { timeout: 8000 });
    await page.click('#exportDataBtn');
    const dl = await dlP;
    const p = path.join(require('os').tmpdir(), 'nav-e2e-file.json');
    await dl.saveAs(p);
    return JSON.parse(fs.readFileSync(p, 'utf8')).schemaVersion === 1;
  })());
  await browser.close();
}

async function main() {
  const mode = process.argv.includes('--extension') ? 'extension'
    : process.argv.includes('--preview') ? 'preview' : 'all';

  if (mode === 'all' || mode === 'preview') {
    const server = await startStaticServer();
    const browser = await chromium.launch(headlessLaunchOpts());
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await runCore(page, 'preview');
    await browser.close();
    await new Promise(r => server.close(r));
    await runFileMode();
  }

  if (mode === 'all' || mode === 'extension') {
    const cft = findCft();
    if (!cft) {
      info('[EXT] 未找到 Chrome for Testing，跳过扩展模式（需 GUI 会话）', '设置 CFT_PATH 或 npx playwright install chromium');
    } else {
      info('[EXT] Chrome for Testing', cft);
      const ctx = await chromium.launchPersistentContext(path.join(require('os').tmpdir(), 'nav-e2e-ext-' + Date.now()), {
        executablePath: cft,
        headless: false,
        args: [
          '--enable-unsafe-extension-debugging',
          '--disable-extensions-except=' + EXT_PATH,
          '--load-extension=' + EXT_PATH,
          '--no-first-run', '--no-default-browser-check'
        ],
        viewport: { width: 1440, height: 900 }
      });
      const page = ctx.pages()[0] || await ctx.newPage();
      await page.goto('chrome://newtab', { waitUntil: 'domcontentloaded' });
      info('[EXT] newtab 覆盖 URL', page.url());
      check('[EXT] newtab 被扩展覆盖', page.url().startsWith('chrome-extension://'));
      await runCore(page, 'extension');
      await ctx.close();
    }
  }

  console.log(JSON.stringify(R, null, 2));
  console.log(`PASS=${R.pass.length} FAIL=${R.fail.length}`);
  process.exit(R.fail.length > 0 ? 1 : 0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
