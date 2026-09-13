/**
 * 凌睿科技导航页 E2E 冒烟测试（PBI-15 起点）
 *
 * 运行方式：
 *   # 扩展模式（需要 Chrome for Testing + GUI 会话；验证 CSP/chrome.storage/newtab 覆盖）
 *   node scripts/__tests__/e2e/nav-e2e.js --extension
 *   # 预览模式（headless，无需 GUI；http + file:// 双模式）
 *   node scripts/__tests__/e2e/nav-e2e.js --preview
 *   # chrome.storage 路径回归（headless，无需 GUI；注入模拟 chrome.storage 走生产后端代码路径）
 *   node scripts/__tests__/e2e/nav-e2e.js --shim
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
const { isAllowed } = require('../../network-audit.js');
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

/* ---- chrome.storage 模拟（--shim 模式，供无 GUI 的 CI 覆盖生产存储后端）----
 *
 * 为什么需要它：CI 只跑 --preview（localStorage），而扩展实际用 chrome.storage.local。
 * 两者的异步特性不同，同一段代码可能表现相反 —— 例如编辑表单重复 ID 缺陷
 * 在 localStorage 下会因 L2 抛 TypeError 中断而不损坏数据，在 chrome.storage 下
 * 则静默把数据写错。只覆盖单一后端会让这类缺陷长期逃逸。
 *
 * 【关键】异步特性必须用 setTimeout（宏任务）模拟真实 IPC 往返。
 * 若改成 Promise.resolve()（微任务），第一个监听器让出时微任务队列已就绪，
 * 它的续体会在第二个监听器之前跑完（销毁 DOM），缺陷不再复现 ——
 * 测试会重新变成"永远通过的绿灯"。改动此行前请先跑 --shim 的回退验证。
 *
 * 后端存 localStorage（__cs__ 前缀），保证 reload 后数据不丢。
 */
const CHROME_STORAGE_SHIM = () => {
  const PREFIX = '__cs__';
  const read = k => {
    const raw = localStorage.getItem(PREFIX + k);
    if (raw === null) return undefined;
    try { return JSON.parse(raw); } catch { return undefined; }
  };
  const write = (k, v) => localStorage.setItem(PREFIX + k, JSON.stringify(v));
  const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  window.chrome = {
    storage: {
      local: {
        get(keys, cb) {
          setTimeout(() => { // 宏任务：模拟跨进程 IPC（勿改为 Promise.resolve）
            const out = {};
            if (keys === null || keys === undefined) {
              for (let i = 0; i < localStorage.length; i++) {
                const full = localStorage.key(i);
                if (full && full.startsWith(PREFIX)) {
                  const k = full.slice(PREFIX.length);
                  out[k] = read(k);
                }
              }
            } else {
              for (const k of (Array.isArray(keys) ? keys : [keys])) {
                const v = read(k);
                if (v !== undefined) out[k] = v;
              }
            }
            cb(out);
          }, 1);
        },
        set(data, cb) {
          setTimeout(() => { // 同上：宏任务
            for (const [k, v] of Object.entries(data)) write(k, clone(v));
            if (cb) cb();
          }, 1);
        }
      }
    }
  };
};

/* ---- 第三方接口的固定响应（让 E2E 自包含，不受网络波动影响）----
 *
 * 背景：此前 [13] 重试恢复、[11] 节假日倒计时等断言依赖真实的 wttr.in / jsdelivr 请求，
 * 曾观察到一次无法定位的偶发失败，最可能就是外部服务抖动。
 * 真实响应的结构与可用性改由手动冒烟覆盖，不放进自动化测试。
 */
const MOCK_WEATHER = {
  current_condition: [{ weatherCode: '116', temp_C: '25', weatherDesc: [{ value: '多云' }] }],
  // 必须像真实 wttr.in 一样给出多天预报：buildHourly24 会跳过当天已过去的小时，
  // 若只给 1 天，临近午夜时可用点不足 2 个会直接返回 null，悬停卡片就不渲染了
  // （曾因此在 23 点跑测试时出现 [13]/[20] 两项失败）
  weather: [0, 1, 2].map(() => ({
    maxtempC: '30',
    mintempC: '20',
    // wttr.in 的 time 形如 "0"/"100"/"2300"，parseWttrTime 会除以 100 得到小时
    hourly: Array.from({ length: 24 }, (_, i) => ({
      time: String(i * 100),
      tempC: String(20 + (i % 8)),
      weatherCode: '116',
      chanceofrain: String((i * 7) % 100)
    }))
  }))
};

/* 构造一个必然落在"未来 3 天"的节假日，使倒计时行有确定内容可断言；
   calendar.js 会分别请求今年与次年，同一天数据对两年响应都适用，故共用一份 */
const _mockHolidayDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
const MOCK_HOLIDAY = { days: [{ date: _mockHolidayDate, name: '测试节', isOffDay: true }] };

/* 第三方 mock 的行为开关：'ok' 返回固定成功响应，'fail'/'hang' 模拟失败与挂起。
   用可变状态而非 page.route/unroute —— unroute 会把固定响应一并移除。 */
let weatherMode = 'ok';
let holidayMode = 'ok';

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

  // 第三方接口一律以固定响应替换，断言不再依赖真实网络（详见文件头 MOCK_* 说明）。
  // 用行为开关而非 route/unroute：unroute 会连这里的固定响应一起移除。
  weatherMode = 'ok';
  holidayMode = 'ok';
  await page.route(/wttr\.in/, r => weatherMode === 'fail'
    ? r.fulfill({ status: 500, body: 'err', contentType: 'text/plain' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_WEATHER) }));
  await page.route(/holiday-cn/, r => {
    if (holidayMode === 'hang') return; // 不响应：模拟请求卡在响应体阶段
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HOLIDAY) });
  });

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
  if (label === 'shim') {
    // 确认页面确实走在 chrome.storage 分支上，否则本模式的回归价值不成立
    check('[SHIM] 页面走 chrome.storage 分支', await page.evaluate(() => !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && typeof chrome.storage.local.get === 'function')));
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

  // [3.5] PBI-10 主题与壁纸联动
  const themeOpts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#themeSelect option')).map(o => o.value));
  check('[3.5] 主题下拉含跟随壁纸档', themeOpts.includes('auto'), themeOpts.join(','));
  // auto 模式：当前壁纸深邃星空（dark）→ data-theme dark
  await page.locator('#themeSelect').selectOption('auto');
  await sleep(400);
  check('[3.5] auto 按当前壁纸解析为 dark', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
  // 手动 light 后换壁纸（极光绿 dark）→ 主题不随壁纸变化（AC2 手动优先）
  await page.locator('#themeSelect').selectOption('light');
  await sleep(300);
  await page.evaluate(() => Wallpaper.next());
  await sleep(800);
  check('[3.5] 手动主题不随壁纸变化', await page.evaluate(() => document.documentElement.dataset.theme) === 'light');
  // 切回 auto → 重新按当前壁纸（极光绿 dark）解析
  await page.locator('#themeSelect').selectOption('auto');
  await sleep(400);
  check('[3.5] 切回 auto 跟随壁纸', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
  // 持久化：刷新后 auto 保持
  await page.reload();
  await sleep(2500);
  check('[3.5] auto 持久化', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
  // 恢复 dark 状态供后续测试
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

  // [5.5] 连续编辑两条书签（P0-1 回归：编辑表单重复 ID 导致保存错位）
  // 用户路径：点开 A 的编辑 → 改主意点开 B 的编辑 → 在 B 的表单里输入并点它自己的保存按钮
  // 注意断言必须落在"最后一个表单自己的按钮"上：修复前该按钮没有监听器（无反应），
  // 而"点第一个按钮"在修复前后会得到相同的数据结果，无法区分
  await page.click('[data-tab="bookmarks"]');
  await sleep(500);
  const editBefore = (await storageGet(page, 'bookmarks')).map(b => b.title);
  await page.locator('[data-action="edit-bookmark"]').nth(0).click();
  await sleep(300);
  // 第 1 条的编辑按钮已被内联表单替换，剩余按钮中的第 1 个即原第 2 条
  await page.locator('[data-action="edit-bookmark"]').nth(0).click();
  await sleep(300);
  const dupTitleInputs = await page.locator('#editBmTitle').count();
  check('[5.5] 连续编辑两条不产生重复表单 ID', dupTitleInputs === 1, `实际 #editBmTitle=${dupTitleInputs}`);
  await page.locator('#editBmTitle').last().fill('BBB_EDIT');
  await page.locator('#saveEditBookmark').last().click();
  await sleep(1500);
  const editAfter = (await storageGet(page, 'bookmarks')).map(b => b.title);
  check('[5.5] 第 2 条被正确保存（点自己表单的保存）', editAfter[1] === 'BBB_EDIT', `实际=${editAfter[1]}`);
  check('[5.5] 第 1 条未被误改', editAfter[0] === editBefore[0], `期望=${editBefore[0]} 实际=${editAfter[0]}`);
  // 注：不复原标题——后续 [6] 只校验导出结构，[7] 用固定备份覆盖数据，均不依赖书签标题

  // [5.6] 编辑链接后切 tab（P1-2 回归：操作按钮不应永久消失）
  await page.click('[data-tab="categories"]');
  await sleep(500);
  const actBefore = await page.locator('#categoryList .sub-item').nth(0).locator('.setting-item-actions').count();
  await page.locator('[data-action="edit-item"]').nth(0).click();
  await sleep(300);
  await page.click('[data-tab="wallpaper"]');
  await sleep(300);
  await page.click('[data-tab="categories"]');
  await sleep(500);
  const actAfter = await page.locator('#categoryList .sub-item').nth(0).locator('.setting-item-actions').count();
  check('[5.6] 编辑链接后切 tab，该行操作按钮仍在', actBefore === 1 && actAfter === 1, `编辑前=${actBefore} 切回后=${actAfter}`);

  // [5.7] 连续编辑两个分类（P0-1 分类路径回归：与书签同源，此前仅按代码同源推断，未单独验证）
  const catBefore = (await storageGet(page, 'categories')).map(c => c.title);
  await page.locator('[data-action="edit-category"]').nth(0).click();
  await sleep(300);
  await page.locator('[data-action="edit-category"]').nth(0).click();
  await sleep(300);
  const dupCatInputs = await page.locator('#editCatTitle').count();
  check('[5.7] 连续编辑两个分类不产生重复表单 ID', dupCatInputs === 1, `实际 #editCatTitle=${dupCatInputs}`);
  await page.locator('#editCatTitle').last().fill('BBB_CAT');
  await page.locator('#saveEditCategory').last().click();
  await sleep(1500);
  const catAfter = (await storageGet(page, 'categories')).map(c => c.title);
  check('[5.7] 第 2 个分类被正确保存（点自己表单的保存）', catAfter[1] === 'BBB_CAT', `实际=${catAfter[1]}`);
  check('[5.7] 第 1 个分类未被误改', catAfter[0] === catBefore[0], `期望=${catBefore[0]} 实际=${catAfter[0]}`);

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
  const countdownText = await page.evaluate(() => {
    const el = document.querySelector('.dhc-countdown');
    return el ? el.textContent : '';
  });
  check('[11] PBI-11 节假日倒计时行', /还有 \d+ 天|今天|调休/.test(countdownText), countdownText || '(无)');
  await page.keyboard.press('Escape');
  await sleep(300);

  // [16] PBI-18 搜索快捷键（US-22）
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  await page.keyboard.press('/');
  check('[16] / 聚焦搜索框', await page.evaluate(() => document.activeElement && document.activeElement.id === 'searchInput'));
  await page.keyboard.type('abc/');
  check('[16] 输入聚焦时 / 不冲突', await page.evaluate(() =>
    document.activeElement && document.activeElement.id === 'searchInput' && document.getElementById('searchInput').value.includes('/')));
  await page.keyboard.press('Escape');
  check('[16] Esc 清空并失焦', await page.evaluate(() =>
    (!document.activeElement || document.activeElement.id !== 'searchInput') && document.getElementById('searchInput').value === ''));

  // [15] PBI-13 隐私可见化
  await page.click('#settingsBtn');
  await sleep(400);
  await page.click('[data-tab="privacy"]');
  await sleep(500);
  const privacyText = await page.evaluate(() => document.getElementById('tabPrivacy').innerText);
  check('[15] 隐私 tab：权限清单', /权限清单/.test(privacyText) && /storage/.test(privacyText));
  check('[15] 隐私 tab：外部数据源', /外部数据源/.test(privacyText) && /favicon\.im/.test(privacyText) && /wttr\.in/.test(privacyText) && /bing\.biturl\.top/.test(privacyText));
  check('[15] 隐私 tab：无埋点声明', /无统计埋点/.test(privacyText) && /无广告/.test(privacyText));
  await page.keyboard.press('Escape');
  await sleep(300);

  // [13] PBI-18 天气：缓存时间标注 + 失败降级 + 重试恢复
  const whcHeader = await page.evaluate(() => {
    const el = document.querySelector('.whc-header');
    return el ? el.textContent : '';
  });
  check('[13] 缓存时间标注', /更新于/.test(whcHeader), whcHeader.slice(0, 60));
  weatherMode = 'fail'; // 由 runCore 开头的固定响应 handler 读取
  await page.evaluate(() => { if (typeof Weather !== 'undefined') { Weather._failed = false; Weather.cache = null; Weather.refresh(); } });
  await sleep(6500);
  const degradeText = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  check('[13] 天气失败显示降级文案', /天气暂不可用/.test(degradeText), degradeText.slice(0, 60));
  check('[13] 降级含重试按钮', await page.locator('.weather-retry').count() === 1);
  weatherMode = 'ok';
  await page.locator('.weather-retry').click();
  await sleep(3500); // 固定响应无网络往返，重试一次即成功
  const afterRetry = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  check('[13] 重试后恢复天气', /°C/.test(afterRetry), afterRetry.slice(0, 60));

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

  // [12] PBI-14 网络请求审计：全部请求与白名单比对（US-16 AC2：白名单外请求使测试失败并给出 URL）
  const pageUrl = page.url();
  const violations = [];
  for (const u of requests) {
    if (!isAllowed(u, pageUrl)) violations.push(u);
  }
  check('[12] 无白名单外请求（PBI-14）', violations.length === 0, violations.slice(0, 5).join(' || '));
  info('[12] 生命周期请求总数', String(requests.length));

  // [14] 错误归零（A8/N1 修复后的基线）
  await sleep(2500);
  check('[14] 无 pageerror', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  info('[14] console error 详情', consoleErrors.slice(0, 3).join(' || ') || '无');

  // [17] 时钟不依赖节假日网络（P1-1 回归）
  // 挂起节假日请求模拟"响应头返回后响应体卡住"：修复前 App.startClock() 串在
  // Calendar.init() 之后，会被该请求阻塞导致时间区域长时间空白
  // 必须先清掉 24 小时节假日缓存，否则命中缓存不会发起请求，本断言将失去区分度
  holidayMode = 'hang'; // 模拟响应体卡住（handler 直接返回，不 fulfill）
  await page.evaluate(() => localStorage.removeItem('holidayCacheV1'));
  await page.reload();
  await sleep(3500);
  const clockText = await page.evaluate(() => (document.getElementById('datetime').textContent || '').trim());
  check('[17] 节假日请求挂起时时钟仍显示', clockText.length > 0, `#datetime="${clockText.slice(0, 24)}"`);
  holidayMode = 'ok';
  await page.reload();
  await sleep(2500);

  // [18] weather 响应体挂起时超时应生效（P1-1 weather 路径回归）
  // 注入自定义 fetch：请求立即 resolve（模拟响应头已到达），但 json() 永不 settle，
  // 仅在 abort 信号触发时 reject —— 精确复现"响应头返回、响应体卡住"。
  // 修复前 clearTimeout 紧跟 fetch 之后执行，5 秒定时器被提前清掉，body 卡住后永不恢复，
  // 天气会永久停在"获取天气中…"且降级分支不可达。
  await page.evaluate(() => {
    const orig = window.fetch;
    window.__restoreFetch = () => { window.fetch = orig; };
    window.fetch = function (url, opts) {
      if (String(url).includes('wttr.in')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => new Promise((_, reject) => {
            const sig = opts && opts.signal;
            if (!sig) return; // 无 abort 信号则永不 settle
            if (sig.aborted) return reject(new DOMException('Aborted', 'AbortError'));
            sig.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          })
        });
      }
      return orig.apply(this, arguments);
    };
  });
  await page.evaluate(() => {
    if (typeof Weather !== 'undefined') { Weather._failed = false; Weather.cache = null; Weather.refresh(); }
  });
  await sleep(7000);
  const slowText = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  check('[18] weather 响应体挂起时超时降级', /天气暂不可用/.test(slowText), slowText.slice(0, 40) || '(空)');
  await page.evaluate(() => { if (window.__restoreFetch) window.__restoreFetch(); });
  await page.reload();
  await sleep(2500);

  // [19] 无障碍（P2-8）：可访问名称 / dialog 语义 / tab 语义 / 焦点管理
  const a11y = await page.evaluate(() => {
    const el = id => document.getElementById(id);
    const name = node => node ? (node.getAttribute('aria-label') || node.getAttribute('title') || '').trim() : '';
    const overlay = el('settingsOverlay');
    return {
      iconNames: [name(el('searchClear')), name(el('settingsClose')), name(el('settingsBtn')), name(el('searchInput'))],
      overlayRole: overlay ? overlay.getAttribute('role') : null,
      overlayModal: overlay ? overlay.getAttribute('aria-modal') : null,
      tablist: !!document.querySelector('.settings-tabs[role="tablist"]'),
      tabs: document.querySelectorAll('.tab-btn[role="tab"]').length,
      panels: document.querySelectorAll('.tab-content[role="tabpanel"]').length
    };
  });
  check('[19] 图标按钮与搜索框具备可访问名称', a11y.iconNames.every(n => n.length > 0),
    `searchClear/settingsClose/settingsBtn/searchInput = ${JSON.stringify(a11y.iconNames)}`);
  check('[19] 设置面板具备 dialog 语义', a11y.overlayRole === 'dialog' && a11y.overlayModal === 'true',
    `role=${a11y.overlayRole} aria-modal=${a11y.overlayModal}`);
  check('[19] tab 与面板语义关联', a11y.tablist && a11y.tabs === 7 && a11y.panels === 7,
    `tablist=${a11y.tablist} tabs=${a11y.tabs} panels=${a11y.panels}`);

  await page.click('#settingsBtn');
  await sleep(400);
  await page.click('[data-tab="data"]');
  await sleep(300);
  const selSync = await page.evaluate(() => {
    const sel = [...document.querySelectorAll('.tab-btn[aria-selected="true"]')];
    return { count: sel.length, tab: sel[0] ? sel[0].dataset.tab : null };
  });
  check('[19] aria-selected 随 tab 切换同步', selSync.count === 1 && selSync.tab === 'data',
    `选中=${selSync.tab}（应为 data，共 ${selSync.count} 个）`);

  // 焦点陷阱：必须从面板内「最后一个」可聚焦元素按 Tab 才能验出是否生效。
  // 若从 #settingsBtn 起按 Tab，焦点会顺着 DOM 顺序自然走进面板，无论有无陷阱都"通过"。
  const lastFocusable = await page.evaluate(() => {
    const panel = document.querySelector('.settings-panel');
    if (!panel) return null;
    const list = Array.from(panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled && el.offsetParent !== null);
    if (!list.length) return null;
    const last = list[list.length - 1];
    last.focus();
    return last.id || last.className || last.tagName;
  });
  await page.keyboard.press('Tab');
  const afterTab = await page.evaluate(() => {
    const panel = document.querySelector('.settings-panel');
    const a = document.activeElement;
    return {
      inPanel: !!(panel && a && panel.contains(a)),
      at: a ? (a.id || a.className || a.tagName) : '(无)'
    };
  });
  check('[19] Tab 到面板末尾后循环回面板内（焦点陷阱）', !!lastFocusable && afterTab.inPanel,
    `末尾元素=${lastFocusable} → Tab 后=${afterTab.at}`);

  await page.click('#settingsClose');
  await sleep(300);
  const focusBack = await page.evaluate(() => (document.activeElement ? document.activeElement.id : ''));
  check('[19] 关闭后焦点归还触发元素', focusBack === 'settingsBtn', `activeElement=#${focusBack || '(无)'}`);

  // [20] 常驻运行时的资源生命周期（P2-11）
  // 这类问题只在长时间常驻后显现，分钟级 E2E 不会自然暴露，必须显式模拟反复 render。
  // 用 CDP 读取元素上的真实监听器数量——比 DOM 断言更直接。
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  const countListeners = async (sel) => {
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    if (!nodeId) return null;
    const { object } = await cdp.send('DOM.resolveNode', { nodeId });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: object.objectId });
    return listeners.length;
  };
  // 先渲染一次，确保 el 上的监听器完成首次绑定再计数——否则 0 → 2 是"首次绑定"而非泄漏
  await page.evaluate(() => { if (typeof Weather !== 'undefined' && Weather.cache) Weather.render(); });
  await sleep(200);
  const listenersBefore = await countListeners('#weatherWidget');
  const hoverCards = await page.evaluate(() => {
    // 注意：缓存必须带 hourly，否则不会渲染悬停卡片，bindHoverEvents 会在 !card 处提前返回，
    // 那样根本测不到泄漏（首次探测正是因此误判为"无泄漏"）
    Weather.cache = {
      temp: '25', icon: '☀️', desc: '晴',
      hourly: Array.from({ length: 12 }, (_, i) => ({ hour: i * 2, icon: '☀️', temp: 25 + i, rain: 10 + i })),
      todayHigh: 30, todayLow: 20, timestamp: Date.now(), version: 7
    };
    for (let i = 0; i < 10; i++) Weather.render();
    return document.querySelectorAll('.weather-hover-card').length;
  });
  await sleep(300);
  const listenersAfter = await countListeners('#weatherWidget');
  check('[20] 反复 render 后天气组件监听器不累积（P2-11）',
    hoverCards === 1 && listenersBefore !== null && listenersBefore === listenersAfter,
    `悬停卡片=${hoverCards} 个，监听器 ${listenersBefore} → ${listenersAfter}（10 次 render）`);
  await cdp.detach();

  // [21] 交互反馈与输入校验（P2-1 / P2-13 / P2-3 / 空状态）
  // P2-13：必填项为空时点保存应给出校验反馈，而不是静默无反应。
  // 注意不能只断言 validity.valid —— required 是 HTML 属性，静默 return 时它同样是 invalid，
  // 那样测的是"约束存在"而非"有没有给出提示"。改为统计 reportValidity 的实际调用次数。
  await page.click('#settingsBtn');
  await sleep(400);
  await page.click('[data-tab="bookmarks"]');
  await sleep(300);
  await page.click('#addBookmarkBtn');
  await sleep(300);
  await page.fill('#bmUrl', '');
  const reportCalls = await page.evaluate(async () => {
    const proto = HTMLInputElement.prototype;
    const orig = proto.reportValidity;
    let called = 0;
    proto.reportValidity = function () { called++; return orig.apply(this, arguments); };
    document.getElementById('saveBookmark').click();
    await new Promise(r => setTimeout(r, 400));
    proto.reportValidity = orig;
    return called;
  });
  const stillEmpty = await page.evaluate(() => ({
    saved: [...document.querySelectorAll('#bookmarkList .setting-item-title')].some(e => !e.textContent.trim()),
    formOpen: !!document.getElementById('bookmarkForm')
  }));
  check('[21] 必填项为空时触发原生校验提示（P2-13）',
    reportCalls >= 1 && !stillEmpty.saved,
    `reportValidity 调用 ${reportCalls} 次，表单仍打开=${stillEmpty.formOpen}`);

  // P2-1：手动输入路径的协议白名单应与导入路径一致
  await page.fill('#bmTitle', 'XSSTEST');
  await page.fill('#bmUrl', 'javascript:alert(1)//https://x');
  await page.click('#saveBookmark');
  await sleep(400);
  const protoCheck = await page.evaluate(() => {
    const u = document.getElementById('bmUrl');
    const titles = [...document.querySelectorAll('#bookmarkList .setting-item-title')].map(e => e.textContent);
    return { invalid: !!(u && !u.validity.valid), saved: titles.includes('XSSTEST') };
  });
  check('[21] javascript: 被手动输入路径拒绝（P2-1）', protoCheck.invalid && !protoCheck.saved,
    `url invalid=${protoCheck.invalid} 已入库=${protoCheck.saved}`);
  const cancelBtn = page.locator('#cancelBookmark');
  if (await cancelBtn.count()) { await cancelBtn.click(); await sleep(200); }

  // P2-3：隐私清单需披露 favicon 兜底会直连书签自身域名
  await page.click('[data-tab="privacy"]');
  await sleep(400);
  const privacyP23 = await page.evaluate(() => {
    const el = document.getElementById('tabPrivacy');
    return el ? el.innerText : '';
  });
  check('[21] 隐私清单披露书签域名直连（P2-3）', /书签自身域名/.test(privacyP23),
    privacyP23.replace(/\s+/g, ' ').slice(0, 70));

  // 空状态：数据清空后主页应给出提示，而不是一片空白（原 P3）
  const emptyHint = await page.evaluate(async () => {
    await Storage.importData(JSON.stringify({ schemaVersion: 1, bookmarks: [], categories: [], todos: [] }));
    await App.renderBookmarks();
    await App.renderCategories();
    await new Promise(r => setTimeout(r, 400));
    const b = document.querySelector('#bookmarkContainer .empty-hint');
    const c = document.querySelector('#categoryContainer .empty-hint');
    return { bookmarks: b ? b.textContent.trim() : '', categories: c ? c.textContent.trim() : '' };
  });
  check('[21] 数据清空后主页显示空状态提示',
    emptyHint.bookmarks.length > 0 && emptyHint.categories.length > 0,
    `书签区="${emptyHint.bookmarks}" 分类区="${emptyHint.categories}"`);

  // 第三方组件台账（MIT 要求许可证随分发）
  const tpPath = path.join(EXT_PATH, 'THIRD-PARTY.md');
  const tpOk = fs.existsSync(tpPath)
    && /MIT License/.test(fs.readFileSync(tpPath, 'utf8'))
    && /lunar-javascript/.test(fs.readFileSync(tpPath, 'utf8'));
  check('[21] 第三方组件台账含来源与许可证', tpOk, '凌睿科技导航页/THIRD-PARTY.md');

  // [22] 组件隐藏后初始化不得再发起请求（P2-10 残余）
  // init() 在两次 await 之后才收尾，若该窗口内组件被隐藏，后续的定位与天气请求不应再发出
  const wtReqBefore = requests.filter(u => /wttr\.in/.test(u)).length;
  await page.evaluate(async () => {
    Weather.stopRefresh();        // 模拟 onHide → _active = false
    Weather._inited = false;      // 重置守卫，让初始化流程可再次走一遍
    Weather.selectedCityQuery = 'shenzhen';
    await Weather._initAsync();
  });
  await sleep(1200);
  const wtReqAfter = requests.filter(u => /wttr\.in/.test(u)).length;
  check('[22] 组件隐藏后初始化不再发起天气请求（P2-10 残余）', wtReqAfter === wtReqBefore,
    `wttr.in 请求数 ${wtReqBefore} → ${wtReqAfter}`);

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
    : process.argv.includes('--preview') ? 'preview'
    : process.argv.includes('--shim') ? 'shim' : 'all';

  if (mode === 'all' || mode === 'preview') {
    const server = await startStaticServer();
    const browser = await chromium.launch(headlessLaunchOpts());
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await runCore(page, 'preview');
    await browser.close();
    await new Promise(r => server.close(r));
    await runFileMode();
  }

  // chrome.storage 路径回归（headless，无需 GUI）：注入模拟的 chrome.storage，
  // 使页面走扩展实际使用的存储后端代码路径
  if (mode === 'all' || mode === 'shim') {
    const server = await startStaticServer();
    const browser = await chromium.launch(headlessLaunchOpts());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(CHROME_STORAGE_SHIM);
    const page = await ctx.newPage();
    info('[SHIM] chrome.storage 模拟', '宏任务延迟 1ms（模拟 IPC，等价于扩展后端时序）');
    await runCore(page, 'shim');
    await browser.close();
    await new Promise(r => server.close(r));
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
