#!/usr/bin/env node
/**
 * 使用体验体检脚本（UX audit）
 *
 * 为什么需要它：本项目的 E2E（nav-e2e.js）验证的是"功能是否按预期工作"，
 * 而"体验是否可用"——内容增长后布局会不会崩、浅色主题下文字能不能看清、
 * 输入法回车会不会误触发——功能断言全绿时依然可能是坏的。
 * 本脚本用真浏览器把这些体验维度量化，供 10-使用体验优化方案.md 的结论复现与回归。
 *
 * 用法：
 *   node scripts/ux-audit.js              # 跑全部检查
 *   node scripts/ux-audit.js --layout     # 只看多视口布局
 *   node scripts/ux-audit.js --overflow   # 只看内容量梯度下的溢出临界点
 *   node scripts/ux-audit.js --contrast   # 只看主题对比度（像素级）
 *   node scripts/ux-audit.js --interact   # 只看交互行为（网址直跳 / 输入法回车 / 待办撤销）
 *   node scripts/ux-audit.js --extension  # 扩展模式加载与 autofocus（需要 Chrome for Testing）
 *   node scripts/ux-audit.js --json       # 附加输出 JSON 结果
 *
 * 退出码：发现不达标项时为 1，全部通过为 0（可用于后续接入 CI）。
 *
 * 注意：本脚本是构建期工具，位于仓库根 scripts/ 下，不在扩展目录内，
 * 因此不会进入 npm run pack 的分发包（与 gen-city-coords.js 同级同策略）。
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('缺少依赖：请先运行 npm install（需要 playwright）');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const EXT_PATH = path.join(ROOT, '凌睿科技导航页');
const PORT = parseInt(process.env.PORT || '8901', 10);

/* ---------- 浏览器探测：本机缓存版本可能与 playwright 期望的 revision 不一致 ---------- */

function findHeadlessShell() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH
    || path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cache)) return null;
  const dirs = fs.readdirSync(cache).filter(d => /^chromium_headless_shell-\d+$/.test(d)).sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    const sub = fs.readdirSync(path.join(cache, dirs[i])).find(n => n.startsWith('chrome-headless-shell-'));
    if (!sub) continue;
    const cand = path.join(cache, dirs[i], sub, 'chrome-headless-shell');
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

function findChromeForTesting() {
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH
    || path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cache)) return null;
  const dirs = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    const cand = path.join(cache, dirs[i], 'chrome-mac-arm64',
      'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
    if (fs.existsSync(cand)) return cand;
  }
  return null;
}

/* ---------- 预览服务：用 http 提供页面，让 relative fetch（如 data/cities.json）可用 ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml'
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(EXT_PATH, rel);
      if (!file.startsWith(EXT_PATH) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const BASE = `http://127.0.0.1:${PORT}/index.html`;

/* ---------- 结果收集 ---------- */

const R = { pass: [], fail: [], info: [] };
const check = (name, ok, detail = '') => (ok ? R.pass : R.fail).push(detail ? `${name} | ${detail}` : name);
const info = (name, detail = '') => R.info.push(detail ? `${name} | ${detail}` : name);
const raw = {};

/* ---------- 页面准备 ---------- */

async function newPage(browser, { width = 1440, height = 900, blockExternal = true } = {}) {
  // 用显式 context：browser.newPage() 的隐式 context 不会随 page.close() 回收，
  // 多轮检查累积后会抛 "Failed to find context with id ..." 的协议错误
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.__ctx = ctx;
  if (blockExternal) {
    // 阻断外部数据源：让降级路径立即生效，避免网络抖动影响布局与对比度测量
    await page.route('**/*', r => r.request().url().startsWith(`http://127.0.0.1:${PORT}`) ? r.continue() : r.abort());
  }
  return page;
}

async function closePage(page) {
  if (page.__ctx) await page.__ctx.close().catch(() => {});
  else await page.close().catch(() => {});
}

async function seed(page, { bookmarks, categories, todos, settings }) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.evaluate(data => {
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) continue;
      localStorage.setItem(k, JSON.stringify(v));
    }
  }, { bookmarks, categories, todos, settings });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
}

function makeBookmarks(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `b${i}`, title: `站点${i}`, url: `https://example${i}.com`, sortOrder: i
  }));
}

function makeCategories(n, itemsPer = 6) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`, title: `分类${i + 1}`, collapsed: false, sortOrder: i,
    items: Array.from({ length: itemsPer }, (_, j) => ({
      id: `i${i}-${j}`, title: `站点${j + 1}`, url: `https://s${i}${j}.example.com`, sortOrder: j
    }))
  }));
}

function makeTodos(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i}`, text: `待办事项 ${i + 1}`, done: false, createdAt: i
  }));
}

/* ---------- 检查 1：多视口布局 ---------- */

async function checkLayout(browser) {
  const viewports = [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1024, 768], [900, 700]];
  raw.layout = [];
  for (const [w, h] of viewports) {
    const page = await newPage(browser, { width: w, height: h });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const m = await page.evaluate(() => {
      const rect = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
      const bm = [...document.querySelectorAll('.bookmark-item')].map(e => e.getBoundingClientRect());
      const rows = new Map();
      bm.forEach(r => { const k = Math.round(r.top); rows.set(k, (rows.get(k) || 0) + 1); });
      const tops = [...rows.keys()].sort((a, b) => a - b);
      const lastRow = bm.filter(r => Math.round(r.top) === tops[tops.length - 1]);
      const firstRow = bm.filter(r => Math.round(r.top) === tops[0]);
      const tabs = [...document.querySelectorAll('.tab-btn')];
      return {
        search: rect('.search-box'), title: rect('.site-title'),
        cat: rect('#categoryContainer'), todo: rect('.todo-card'),
        bookmarkRows: tops.length, lastRowCount: lastRow.length,
        firstRowLeft: Math.round(Math.min(...firstRow.map(r => r.left))),
        lastRowLeft: Math.round(Math.min(...lastRow.map(r => r.left))),
        tabInfo: tabs.map(t => ({ text: t.textContent.trim(), h: Math.round(t.getBoundingClientRect().height) }))
      };
    });
    // 设置面板里的 tab 折行检查
    await page.click('#settingsBtn');
    await page.waitForTimeout(400);
    const tab = await page.evaluate(() => [...document.querySelectorAll('.tab-btn')].map(b => {
      const r = b.getBoundingClientRect();
      // 用 Range 量文字实际占几行。不能用 height / line-height：那样会把上下 padding
      // 算进行数，单行 tab（13px padding + 约 19px 行高 = 45px）会被误判成两行。
      const range = document.createRange();
      range.selectNodeContents(b);
      const lines = range.getClientRects().length;
      return {
        text: b.textContent.trim(), h: Math.round(r.height), lines,
        overflow: b.scrollWidth > b.clientWidth + 1
      };
    }));
    raw.layout.push({ viewport: `${w}x${h}`, ...m, tab });
    await closePage(page);
    check(`[布局] ${w}x${h} 搜索框在视口内`, m.search.top >= 0 && m.search.bottom <= h,
      `top=${Math.round(m.search.top)} bottom=${Math.round(m.search.bottom)}`);
    const wrapped = tab.filter(t => t.lines > 1);
    check(`[布局] ${w}x${h} 设置面板 tab 不折行`, wrapped.length === 0,
      wrapped.length ? `折行: ${wrapped.map(t => t.text).join('/')}` : `${tab.length} 个 tab 均为单行`);
    const overflowed = tab.filter(t => t.overflow);
    check(`[布局] ${w}x${h} 设置面板 tab 文字不溢出`, overflowed.length === 0,
      overflowed.length ? `溢出: ${overflowed.map(t => t.text).join('/')}` : `${tab.length} 个 tab 文字均在按钮内`);
    // UX-07：待办卡片应与同排的分类容器等高（此前 height:fit-content 导致矮一截、右列留空洞）
    if (m.cat && m.todo) {
      const gap = Math.round(m.cat.height - m.todo.height);
      check(`[布局] ${w}x${h} 待办卡片与分类容器等高`, Math.abs(gap) <= 2,
        `分类 ${Math.round(m.cat.height)}px / 待办 ${Math.round(m.todo.height)}px，差 ${gap}px`);
    }
    // 末行对齐：仅在书签分多行时判定
    if (m.bookmarkRows > 1) {
      const diff = Math.abs(m.firstRowLeft - m.lastRowLeft);
      info(`[布局] ${w}x${h} 书签末行对齐差`, `${diff}px（首行 left=${m.firstRowLeft} 末行 left=${m.lastRowLeft}，末行 ${m.lastRowCount} 个）`);
    }
  }
}

/* ---------- 检查 2：内容量梯度下的溢出临界点 ---------- */

async function checkOverflow(browser) {
  const cases = [[8, 4, 0], [14, 6, 3], [21, 8, 5], [28, 10, 8], [35, 12, 12], [40, 12, 12]];
  raw.overflow = [];
  for (const [nb, nc, nt] of cases) {
    const page = await newPage(browser);
    await seed(page, { bookmarks: makeBookmarks(nb), categories: makeCategories(nc), todos: makeTodos(nt) });
    const m = await page.evaluate(() => {
      const mc = document.querySelector('.main-content');
      const box = document.querySelector('.search-box').getBoundingClientRect();
      mc.scrollTop = 0;
      const atTop = document.querySelector('.search-box').getBoundingClientRect().top;
      const tl = document.querySelector('.todo-list');
      return {
        searchTop: Math.round(box.top), atTopAfterScroll: Math.round(atTop),
        contentH: mc.scrollHeight, viewportH: mc.clientHeight,
        range: mc.scrollHeight - mc.clientHeight,
        todoScrollH: tl ? tl.scrollHeight : 0, todoClientH: tl ? tl.clientHeight : 0
      };
    });
    raw.overflow.push({ bookmarks: nb, categories: nc, todos: nt, ...m });
    const visibleAtTop = m.atTopAfterScroll >= 0;
    check(`[溢出] ${nb}书签/${nc}分类/${nt}待办 搜索框可见`, visibleAtTop,
      `初始 top=${m.searchTop}，滚到顶后 top=${m.atTopAfterScroll}，可滚 ${m.range}px`);
    // UX-07：待办超过阈值后应由卡片内部滚动消化，而不是把主网格继续撑高
    if (nt > 10) {
      check(`[溢出] ${nt} 条待办在卡片内滚动而非撑高页面`, m.todoScrollH > m.todoClientH,
        `scrollHeight=${m.todoScrollH} clientHeight=${m.todoClientH}`);
    }
    await closePage(page);
  }
}

/* ---------- 检查 3：主题对比度（真实截图像素采样） ---------- */

const CONTRAST_TARGETS = [
  ['.site-title', '主标题'], ['.site-subtitle', '副标题'], ['.datetime-text', '日期时间'],
  ['.bookmark-title', '书签名称'], ['.category-title', '分类标题'], ['.category-link', '分类链接'],
  ['.todo-title', '待办标题'], ['.tool-btn', '底部按钮'], ['.engine-btn', '引擎按钮'],
  ['.weather-widget', '天气组件']
];

/* 对比度测量：前景用 computed color（含祖先 opacity 累积），背景用截图矩形内的像素众数色。
   为什么不用"矩形内对比度最大的色簇"当前景：稀疏小字（如 letter-spacing 5px 的副标题）
   的抗锯齿像素会被打散成大量低占比色簇，过滤后剩下的最大簇其实是背景的渐变变体，
   会得出"深色主题下副标题只有 1.09:1"这种与事实相反的结论。
   背景侧则相反：矩形内绝大多数像素就是背景，众数色非常可靠。 */
async function measureContrast(page, shotB64) {
  return page.evaluate(async ([b64, targets]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null;
      const p = m[1].split(',').map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
    const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    // 祖先链上的 opacity 会一起削弱文字，需累计（如 .empty-hint 的 opacity:.6、.search-icon 的 .35）
    const effOpacity = el => { let o = 1, n = el;
      while (n && n !== document.documentElement) { const v = parseFloat(getComputedStyle(n).opacity); if (!Number.isNaN(v)) o *= v; n = n.parentElement; }
      return o; };
    const out = [];
    for (const [sel, name] of targets) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ name, status: 'missing' }); continue; }
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > img.height) {
        out.push({ name, status: 'offscreen', top: Math.round(r.top) }); continue;
      }
      const x = Math.max(0, Math.floor(r.left)), y = Math.max(0, Math.floor(r.top));
      const w = Math.min(cv.width - x, Math.ceil(r.width)), h = Math.min(cv.height - y, Math.ceil(r.height));
      const d = cx.getImageData(x, y, w, h).data;
      const hist = new Map();
      for (let i = 0; i < d.length; i += 4) {
        const k = `${d[i] >> 2},${d[i + 1] >> 2},${d[i + 2] >> 2}`;
        const e = hist.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2];
        hist.set(k, e);
      }
      const top = [...hist.values()].sort((a, b) => b.n - a.n)[0];
      const bg = { r: top.r / top.n, g: top.g / top.n, b: top.b / top.n, a: 1 };
      const cs = getComputedStyle(el);
      const fg0 = parse(cs.color) || { r: 255, g: 255, b: 255, a: 1 };
      const fg = over({ ...fg0, a: fg0.a * effOpacity(el) }, bg);
      const rt = ratio(fg, bg);
      // 先按展示精度取整再判定，避免出现"显示 4.5:1 却被判不达标"的自相矛盾报告
      const shown = +rt.toFixed(2);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      out.push({
        name, status: 'ok', ratio: shown, need: large ? 3 : 4.5, pass: shown >= (large ? 3 : 4.5),
        fontSize: size, declaredColor: cs.color,
        fg: [fg.r, fg.g, fg.b].map(Math.round), bg: [bg.r, bg.g, bg.b].map(Math.round)
      });
    }
    return out;
  }, [shotB64, CONTRAST_TARGETS]);
}

async function checkContrast(browser) {
  // 含 UX-02 路线 C 的浅色预设：浅色壁纸 + 深色主题是新增组合，必须一起验
  const wallpapers = ['深邃星空', '极光绿', '落日暖阳', '晨雾白'];
  const themes = ['dark', 'light'];
  raw.contrast = [];
  for (const wp of wallpapers) {
    for (const theme of themes) {
      const page = await newPage(browser);
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
      await page.evaluate(([w, t]) => {
        const s = JSON.parse(localStorage.getItem('settings') || '{}');
        s.wallpaperName = w; s.theme = t;
        localStorage.setItem('settings', JSON.stringify(s));
        if (!localStorage.getItem('todos')) {
          localStorage.setItem('todos', JSON.stringify([{ id: 'x', text: '示例待办', done: false, createdAt: 1 }]));
        }
      }, [wp, theme]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const shot = await page.screenshot();
      const res = await measureContrast(page, shot.toString('base64'));
      const bad = res.filter(x => x.status === 'ok' && !x.pass);
      raw.contrast.push({ wallpaper: wp, theme, result: res });
      check(`[对比度] ${wp} × ${theme}`, bad.length === 0,
        bad.length ? `不达标 ${bad.length}/${res.filter(x => x.status === 'ok').length}：` +
          bad.map(x => `${x.name} ${x.ratio}:1`).join('、')
          : `${res.filter(x => x.status === 'ok').length} 项全部 ≥ 阈值`);
      await closePage(page);
    }
  }
}

/* ---------- 检查 4：交互行为 ---------- */

async function checkInteract(browser) {
  // 4.1 输入网址是否直跳
  {
    const page = await newPage(browser);
    const navs = [];
    await page.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith(`http://127.0.0.1:${PORT}`)) return r.continue();
      if (r.request().isNavigationRequest()) navs.push(u);
      return r.abort();
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.fill('#searchInput', 'github.com');
    await page.press('#searchInput', 'Enter');
    await page.waitForTimeout(600);
    const target = navs[navs.length - 1] || '';
    raw.urlJump = target;
    check('[交互] 输入 github.com 直接打开该网站', /^https?:\/\/(www\.)?github\.com/.test(target),
      target ? `实际导航到 ${target}` : '未发生导航');
    await closePage(page);
  }
  // 4.2 输入法合成中的 Enter 是否误触发
  {
    const page = await newPage(browser);
    const navs = [];
    await page.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith(`http://127.0.0.1:${PORT}`)) return r.continue();
      if (r.request().isNavigationRequest()) navs.push(u);
      return r.abort();
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.fill('#searchInput', '天气预报');
    await page.evaluate(() => document.getElementById('searchInput')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    await page.waitForTimeout(500);
    raw.imeComposing = navs.length;
    check('[交互] 输入法合成中按 Enter 不触发搜索', navs.length === 0,
      navs.length ? `误触发导航到 ${navs[0]}` : '未触发');
    await closePage(page);
  }
  // 4.3 待办删除是否可撤销
  {
    const page = await newPage(browser);
    await seed(page, { todos: [{ id: 'a', text: '重要事项：明天签约', done: false, createdAt: 1 }] });
    await page.hover('.todo-item').catch(() => {});
    await page.click('.todo-delete-btn');
    await page.waitForTimeout(600);
    const afterDelete = await page.evaluate(() => JSON.parse(localStorage.getItem('todos') || '[]').length);
    const hasUndo = await page.evaluate(() => {
      const t = document.body.innerText;
      return /撤销|undo/i.test(t);
    });
    raw.todoUndo = { afterDelete, hasUndo };
    check('[交互] 待办删除后可撤销', afterDelete === 0 && hasUndo,
      `删除后剩余 ${afterDelete} 条，撤销入口${hasUndo ? '存在' : '不存在'}`);
    await closePage(page);
  }
  // 4.4 壁纸切换是否有反馈
  {
    const page = await newPage(browser);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')).wallpaperName);
    await page.click('#wallpaperBtn');
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('settings')).wallpaperName);
    const hasToast = await page.evaluate(() => !!document.querySelector('.toast, .feedback, [role="status"]'));
    raw.wallpaperFeedback = { before, after, hasToast };
    check('[交互] 壁纸切换有可见反馈', hasToast, `${before} → ${after}，提示元素${hasToast ? '存在' : '不存在'}`);
    await closePage(page);
  }
}

/* ---------- 检查 5：扩展模式 ---------- */

async function checkExtension() {
  const cft = findChromeForTesting();
  if (!cft) { info('[扩展] 跳过', '未找到 Chrome for Testing，设置 CFT_PATH 或 npx playwright install chromium'); return; }
  const profile = path.join(os.tmpdir(), `ux-audit-ext-${Date.now()}`);
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: cft, headless: true, viewport: { width: 1440, height: 900 },
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`,
      '--no-first-run', '--no-default-browser-check']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3500);
  const m = await page.evaluate(() => ({
    url: location.href,
    isExtension: typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id),
    hasBookmarksApi: typeof chrome !== 'undefined' && !!chrome.bookmarks,
    activeElement: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null
  }));
  raw.extension = m;
  check('[扩展] 新标签页由扩展接管', m.isExtension && m.url.startsWith('chrome-extension://'), m.url);
  check('[扩展] 打开后焦点落在搜索框', m.activeElement === 'searchInput', `activeElement=${m.activeElement}`);
  info('[扩展] chrome.bookmarks 可用性', m.hasBookmarksApi ? '可用' : '不可用（当前 manifest 未申请 bookmarks 权限）');
  await ctx.close();
}

/* ---------- 检查 5：空状态布局（内容量为 0 的边界） ----------

   与 checkOverflow 正好是内容量梯度的两端。此前只覆盖了"内容变多"，
   于是书签区空状态塌陷一直没被发现：.links-grid 用 repeat(auto-fit, 68px)，
   而 auto-fit 会折叠空轨道 —— 0 个书签时实测列模板退化成
   `68px 0px 0px 0px 0px 0px 0px`，空状态块被压进 52px，文案逐字换行、
   两个行动按钮变成 55×144 与 55×120（UX-06 的 auto-fit 与 UX-09 的空状态叠加）。
   判据用"占容器 90% 以上"而非绝对值：与视口宽度无关，布局微调也不会误报。 */
async function checkEmptyState(browser) {
  const page = await newPage(browser);
  await seed(page, { bookmarks: [], categories: [], todos: [] });
  const m = await page.evaluate(() => {
    const rect = e => { const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
    const grid = document.getElementById('bookmarkContainer');
    const catGrid = document.getElementById('categoryContainer');
    const hint = grid.querySelector('.empty-hint');
    const btns = [...grid.querySelectorAll('.empty-actions button')];
    const catBlock = catGrid.querySelector('.empty-state-block');
    return {
      cols: getComputedStyle(grid).gridTemplateColumns,
      gridW: Math.round(grid.getBoundingClientRect().width),
      hintW: hint ? Math.round(hint.getBoundingClientRect().width) : 0,
      btns: btns.map(b => ({ t: b.textContent.trim(), ...rect(b) })),
      catGridW: Math.round(catGrid.getBoundingClientRect().width),
      catBlockW: catBlock ? Math.round(catBlock.getBoundingClientRect().width) : 0
    };
  });
  raw.empty = m;
  check('[空状态] 书签空状态提示占满容器（不被 auto-fit 折叠压成竖排）',
    m.gridW > 0 && m.hintW >= m.gridW * 0.9,
    `提示 ${m.hintW}px / 容器 ${m.gridW}px（列模板 ${m.cols}）`);
  check('[空状态] 书签空状态按钮尺寸正常（不是逐字换行的窄条）',
    m.btns.length >= 2 && m.btns.every(b => b.w >= 100 && b.h <= 60),
    m.btns.length ? m.btns.map(b => `${b.t}=${b.w}×${b.h}`).join(' / ') : '(无按钮)');
  check('[空状态] 分类空状态跨满两列（不偏在左列）',
    m.catGridW > 0 && m.catBlockW >= m.catGridW * 0.9,
    `分类空状态块 ${m.catBlockW}px / 容器 ${m.catGridW}px`);
  await closePage(page);
}

/* ---------- 主流程 ---------- */

const REPORTS = {
  layout: '一、多视口布局与设置面板 tab',
  overflow: '二、内容量梯度下的溢出临界点',
  contrast: '三、主题 × 壁纸对比度（像素级）',
  interact: '四、交互行为',
  empty: '五、空状态布局（0 书签 / 0 分类）'
};

(async () => {
  const argv = process.argv.slice(2);
  const only = ['layout', 'overflow', 'contrast', 'interact', 'empty', 'extension'].filter(k => argv.includes('--' + k));
  const run = k => only.length === 0 || only.includes(k);
  const asJson = argv.includes('--json');

  let server = null;
  const browser = await chromium.launch({
    headless: true, executablePath: findHeadlessShell() || undefined,
    args: ['--allow-file-access-from-files']
  });

  try {
    if (run('layout') || run('overflow') || run('contrast') || run('interact') || run('empty')) {
      server = await startServer();
    }
    if (run('layout')) { console.log('\n== ' + REPORTS.layout + ' =='); await checkLayout(browser); }
    if (run('overflow')) { console.log('\n== ' + REPORTS.overflow + ' =='); await checkOverflow(browser); }
    if (run('contrast')) { console.log('\n== ' + REPORTS.contrast + ' =='); await checkContrast(browser); }
    if (run('interact')) { console.log('\n== ' + REPORTS.interact + ' =='); await checkInteract(browser); }
    if (run('empty')) { console.log('\n== ' + REPORTS.empty + ' =='); await checkEmptyState(browser); }
    if (run('extension')) { console.log('\n== 六、扩展模式 =='); await checkExtension(); }
  } finally {
    await browser.close();
    if (server) server.close();
  }

  console.log('\n========== 体检结果 ==========');
  R.info.forEach(s => console.log('  · ' + s));
  R.pass.forEach(s => console.log('  ✅ ' + s));
  R.fail.forEach(s => console.log('  ❌ ' + s));
  console.log(`\n通过 ${R.pass.length} 项，不通过 ${R.fail.length} 项，参考信息 ${R.info.length} 条`);
  console.log('说明：不通过项即 10-使用体验优化方案.md 中待修复的体验缺陷。');

  if (asJson) console.log('\n--- JSON ---\n' + JSON.stringify(raw, null, 2));

  process.exit(R.fail.length ? 1 : 0);
})().catch(err => {
  console.error('体检脚本异常：', err);
  process.exit(2);
});
