/**
 * 凌睿科技导航页 E2E 冒烟测试（PBI-15 起点）
 *
 * 运行方式：
 *   # 扩展模式（需要 Chrome for Testing + GUI 会话；验证 CSP/chrome.storage/newtab 覆盖）
 *   node tests/e2e/nav-e2e.js --extension
 *   # 预览模式（headless，无需 GUI；http + file:// 双模式）
 *   node tests/e2e/nav-e2e.js --preview
 *   # chrome.storage 路径回归（headless，无需 GUI；注入模拟 chrome.storage 走生产后端代码路径）
 *   node tests/e2e/nav-e2e.js --shim
 *   # 全部
 *   node tests/e2e/nav-e2e.js
 *
 * 前置条件：本机已安装 playwright（npm i -D playwright）并下载浏览器：
 *   npx playwright install chromium
 *   （扩展模式需 Chrome for Testing，路径用 CFT_PATH 环境变量指定）
 *
 * 环境变量：
 *   CFT_PATH    Chrome for Testing 可执行文件路径（默认自动探测 ms-playwright 缓存）
 *   EXT_PATH    扩展源码目录（默认本仓库 src/）
 *   PORT        预览模式 http 端口（默认 8899）
 */
'use strict';
const { chromium } = require('playwright');
const { isAllowed } = require('../../src/scripts/network-audit.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

// 扩展源码目录：本脚本位于 tests/e2e/，向上两级到仓库根再进 src/
const EXT_PATH = process.env.EXT_PATH || path.resolve(__dirname, '..', '..', 'src');
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

/* 方向 B：分组默认展开态由 DOM 决定；需要操作折叠组内控件前先展开。
   折叠组的 summary 是原生可聚焦元素，点击即展开，不做持久化。 */
const openSettingsGroup = async (page, group) => {
  const isOpen = await page.evaluate(g => {
    const el = document.querySelector(`.settings-group[data-group="${g}"]`);
    return el ? el.open : false;
  }, group);
  if (!isOpen) {
    await page.click(`.settings-group[data-group="${group}"] > summary`);
    await sleep(300);
  }
};

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

  /* onChanged 支持：真实 chrome.storage 的变更会广播到该扩展的所有页面，
     跨标签页同步（P3-2）依赖这一行为。同一页面内直接回调，跨页面用 BroadcastChannel。 */
  const listeners = [];
  const emit = changes => listeners.forEach(fn => { try { fn(changes, 'local'); } catch { /* 忽略监听器异常 */ } });
  let channel = null;
  try {
    channel = new BroadcastChannel('__cs_changes__');
    channel.onmessage = e => emit(e.data);
  } catch { /* 环境不支持时退化为仅同页通知 */ }

  window.chrome = {
    storage: {
      onChanged: {
        addListener(fn) { if (typeof fn === 'function' && !listeners.includes(fn)) listeners.push(fn); },
        removeListener(fn) { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }
      },
      local: {        get(keys, cb) {
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
            const changes = {};
            for (const [k, v] of Object.entries(data)) {
              changes[k] = { oldValue: read(k), newValue: clone(v) };
              write(k, clone(v));
            }
            if (cb) cb();
            // 写入完成后广播（与真实 API 的时序一致）
            emit(changes);
            if (channel) { try { channel.postMessage(changes); } catch { /* 忽略 */ } }
          }, 1);
        }
      }
    },
    /* UX-10 替身：chrome.permissions / chrome.bookmarks。
       同样用宏任务（setTimeout）复刻真实 IPC 时序，勿改成同步回调——
       同步回调会让"权限申请必须在用户手势同步栈内发起"这类约束在测试里失去意义。 */
    runtime: { lastError: null },
    permissions: {
      request(_perms, cb) {
        setTimeout(() => { cb(window.__permissionsGranted !== false); }, 1);
      },
      contains(_perms, cb) {
        setTimeout(() => { cb(window.__permissionsGranted !== false); }, 1);
      }
    },
    bookmarks: {
      getTree(cb) {
        setTimeout(() => {
          if (window.__bookmarksUnavailable) {
            window.chrome.runtime.lastError = { message: 'mock: 读取失败' };
            cb([]);
            window.chrome.runtime.lastError = null;
            return;
          }
          cb(window.__bookmarksTree || []);
        }, 1);
      }
    }
  };
};

/* 第三方接口的固定响应（让 E2E 自包含，不受网络波动影响）----
 *
 * 背景：此前 [13] 重试恢复、[11] 节假日倒计时等断言依赖真实的 wttr.in / jsdelivr 请求，
 * 曾观察到一次无法定位的偶发失败，最可能就是外部服务抖动。
 * 真实响应的结构与可用性改由手动冒烟覆盖，不放进自动化测试。
 */
const MOCK_CITY_HOUR = (new Date().getHours() + 6) % 24;
const _mockHour12 = h => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`;

const MOCK_WEATHER = {
  current_condition: [{
    weatherCode: '116',
    temp_C: '25',
    weatherDesc: [{ value: '多云' }],
    // 城市当地时间故意取「浏览器时间 +6 小时」，用于验证小时轴按城市时间对齐（P3-4）：
    // 若代码回退到浏览器本地时间，[23] 的第二个刻度就会对不上
    localObsDateTime: `2026-01-01 ${_mockHour12(MOCK_CITY_HOUR)}`
  }],
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

/* 霾天的主源响应：复刻真实 wttr.in（2026-09-17 实测北京）。
   weatherCode=149「Smoky haze」不在 WWO 标准表里，项目码表原本也漏了它，
   而请求上的 `lang=zh` 对 weatherDesc 与 lang_zh 都不生效（两者都返回英文）。
   结果就是中文界面在霾天显示英文（天津/广州/西安同为 149，兰州则是 137 沙尘暴）。
   这份 mock 专供 [44]，不参与其他断言。 */
const MOCK_WEATHER_HAZE = {
  ...MOCK_WEATHER,
  current_condition: [{
    ...MOCK_WEATHER.current_condition[0],
    weatherCode: '149',
    weatherDesc: [{ value: 'Smoky haze' }],
    lang_zh: [{ value: 'Smoky haze' }]
  }]
};

/* 备用源 Open-Meteo 的固定响应（结构与真实返回一致，timezone=auto 下 time 为当地时间）。
   2026-09-15 wttr.in 证书过期后，天气可用性就靠这条回退链路兜住，必须有断言覆盖。 */
const MOCK_OPEN_METEO = {
  current: { time: '2026-01-01T12:00', temperature_2m: 26.4, weather_code: 2 },
  hourly: {
    time: Array.from({ length: 48 }, (_, i) => {
      const day = i < 24 ? '2026-01-01' : '2026-01-02';
      return `${day}T${String(i % 24).padStart(2, '0')}:00`;
    }),
    temperature_2m: Array.from({ length: 48 }, (_, i) => 20 + (i % 8)),
    precipitation_probability: Array.from({ length: 48 }, (_, i) => (i * 7) % 100),
    weather_code: Array.from({ length: 48 }, () => 61)
  },
  daily: { temperature_2m_max: [30], temperature_2m_min: [20] }
};

/* IP 定位兜底的固定响应：扩展页拿不到浏览器定位（实测 code=3 Timeout），走这里 */
const MOCK_IP_LOCATE = { ip: '203.0.113.7', success: true, city: 'Shenzhen', country_code: 'CN', latitude: 22.54, longitude: 114.06 };

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
let openMeteoMode = 'ok'; // 天气备用源（主源失败时的回退目标）
let ipLocateMode = 'ok'; // IP 定位兜底
let holidayMode = 'ok';
let bingDelayMs = 0; // >0 时模拟 Bing 接口慢响应，用于验证壁纸代次（P3-6）
let bingApiMode = 'ok'; // 'fail' 时让每日图接口返回 500，验证「取不到时保留上一张」

/* ---- 内嵌静态文件服务（预览模式用，避免外部依赖） ---- */
/* Content-Type 必须按扩展名给对：此前一律回 text/html，Chrome 在标准模式下会拒绝
   应用 MIME 不是 text/css 的样式表，于是 preview/shim 两种模式的页面**完全没有样式**。
   后果是隐蔽的——所有只测 DOM 与行为的断言照常全绿，而任何样式相关的回归都测不到
   （[28][32][33][34] 这类布局断言在修好这里之前永远不可能通过）。
   与扩展模式、file:// 模式（两者由 Chrome 按扩展名推断 MIME）保持一致的验证条件。 */
const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const file = path.join(EXT_PATH, urlPath === '/' ? 'index.html' : urlPath);
        if (!file.startsWith(EXT_PATH) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          res.writeHead(404); res.end('404'); return;
        }
        const type = STATIC_MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        res.end(fs.readFileSync(file));
      } catch { res.writeHead(500); res.end(); }
    });
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

/* ---- 像素级对比度采样（[29] 用）----
   与 tools/ux-audit.js 同一口径：背景取元素矩形内的像素众数色，前景取 computed color
   （含祖先 opacity 累积）。后者是外部可复跑的工具（全壁纸×主题矩阵），
   这里是 CI 内嵌版，只覆盖默认壁纸下的深浅两档，避免 E2E 耗时翻倍。
   注意不能改成"断言 data-theme 属性值"——那个断言在文字完全不可读时同样是绿的。 */
async function contrastRatios(page, targets) {
  const shot = await page.screenshot();
  return page.evaluate(async ([b64, targets]) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null;
      const p = m[1].split(',').map(parseFloat);
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a) });
    const lum = c => { const q = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * q(c.r) + 0.7152 * q(c.g) + 0.0722 * q(c.b); };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const effOpacity = el => { let o = 1, n = el;
      while (n && n !== document.documentElement) { const v = parseFloat(getComputedStyle(n).opacity); if (!Number.isNaN(v)) o *= v; n = n.parentElement; }
      return o; };
    const out = [];
    for (const [sel, name] of targets) {
      const el = document.querySelector(sel);
      if (!el) { out.push({ name, status: 'missing' }); continue; }
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > img.height) { out.push({ name, status: 'offscreen' }); continue; }
      const x = Math.max(0, Math.floor(r.left)), y = Math.max(0, Math.floor(r.top));
      const d = cx.getImageData(x, y, Math.min(cv.width - x, Math.ceil(r.width)), Math.min(cv.height - y, Math.ceil(r.height))).data;
      const hist = new Map();
      for (let i = 0; i < d.length; i += 4) {
        // 分桶粒度 8 级（原为 4 级）：浅色主题的底色是平滑渐变，相邻像素只差 2 会落进
        // 不同桶，一个大底色被拆成几个小桶之后，"文字笔画"那个桶反而成了众数——
        // 实测标题因此被判成 1.13:1（底色 219,238,229 被拆成 218/220 两桶）。
        // 8 级分桶让视觉上同色的像素合并，众数重新代表底色。
        const k = `${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`;
        const e = hist.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; hist.set(k, e);
      }
      const top = [...hist.values()].sort((a, b) => b.n - a.n)[0];
      const bg = { r: top.r / top.n, g: top.g / top.n, b: top.b / top.n };
      const cs = getComputedStyle(el);
      const fg0 = parse(cs.color) || { r: 255, g: 255, b: 255, a: 1 };
      const fg = over({ ...fg0, a: fg0.a * effOpacity(el) }, bg);
      const shown = +ratio(fg, bg).toFixed(2);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      out.push({ name, status: 'ok', ratio: shown, need: large ? 3 : 4.5, pass: shown >= (large ? 3 : 4.5),
        bg: [bg.r, bg.g, bg.b].map(Math.round), fg: [fg.r, fg.g, fg.b].map(Math.round),
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        img: [cv.width, cv.height], top2: [...hist.values()].sort((a, b) => b.n - a.n)[1] && Math.round([...hist.values()].sort((a, b) => b.n - a.n)[1].n) });
    }
    return out;
  }, [shot.toString('base64'), targets]);
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
  openMeteoMode = 'ok';
  ipLocateMode = 'ok';
  holidayMode = 'ok';
  await page.route(/wttr\.in/, r => {
    if (weatherMode === 'fail') return r.fulfill({ status: 500, body: 'err', contentType: 'text/plain' });
    // haze：真实霾天的响应形态（code 149 + 英文描述），见 [44]
    const body = weatherMode === 'haze' ? MOCK_WEATHER_HAZE : MOCK_WEATHER;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  // 备用源与 IP 定位同样以固定响应替换：否则主源失败时用例会打真实外网，
  // 结果取决于当天 Open-Meteo/ipwho.is 的可用性，断言将失去稳定性
  await page.route(/api\.open-meteo\.com/, r => openMeteoMode === 'fail'
    ? r.fulfill({ status: 500, body: 'err', contentType: 'text/plain' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_OPEN_METEO) }));
  await page.route(/ipwho\.is/, r => ipLocateMode === 'fail'
    ? r.fulfill({ status: 500, body: 'err', contentType: 'text/plain' })
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_IP_LOCATE) }));
  await page.route(/holiday-cn/, r => {
    if (holidayMode === 'hang') return; // 不响应：模拟请求卡在响应体阶段
    if (holidayMode === 'fail') return r.fulfill({ status: 500, body: 'err', contentType: 'text/plain' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_HOLIDAY) });
  });
  bingDelayMs = 0;
  // UX-13：图片请求与实际 API 请求分开 mock —— 前者返回可控亮度的图片（供明度采样），
  // 后者返回 JSON。默认给一张深色图，保证既有断言（如 [25] 壁纸代次）行为不变。
  let bingImageBase64 = '';
  let randomImageBase64 = '';
  await page.route(/cn\.bing\.com/, async r => {
    if (/th\?id=/.test(r.request().url())) {
      return r.fulfill({
        status: 200, contentType: 'image/png',
        body: bingImageBase64 ? Buffer.from(bingImageBase64, 'base64') : Buffer.from([137, 80, 78, 71])
      });
    }
    if (bingDelayMs) await new Promise(res => setTimeout(res, bingDelayMs));
    if (bingApiMode === 'fail') return r.fulfill({ status: 500, body: 'err', contentType: 'text/plain' });
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ images: [{ urlbase: '/th?id=OHR.MockWallpaper' }] })
    });
  });
  // ADV-05：随机壁纸源不在 host_permissions，扩展页 fetch 必失败；
  // 真实服务返回 ACAO: *，所以这里必须带 CORS 头，才能验证 <img crossOrigin> 通道。
  await page.route(/bing\.biturl\.top/, r => r.fulfill({
    status: 200, contentType: 'image/png',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: randomImageBase64 ? Buffer.from(randomImageBase64, 'base64') : Buffer.from([137, 80, 78, 71])
  }));

  if (label === 'extension') {
    await page.waitForTimeout(4500); // newtab 已覆盖为扩展页
  } else {
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
  }

  // [1] 渲染
  // 选择器排除 UX-12 的快捷添加磁贴（它复用 .bookmark-item 的布局样式）
  check('[1] 预设书签 8 个', await page.locator('.bookmark-item:not([data-quick-add])').count() === 8);
  check('[1] 预设分类 4 个', await page.locator('.category-card').count() === 4);
  check('[1] 待办/天气/时钟可见', await page.locator('.todo-card').isVisible() && await page.locator('.weather-widget').isVisible() && await page.locator('#datetime').isVisible());
  const defaultEngine = (await page.locator('#engineBtn').textContent()).trim();
  check('[1] 默认搜索引擎为百度', defaultEngine === '百度', defaultEngine);

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

  /* ---- [3] 主题：只剩深色（2.0.0）----
     浅色主题几版都做不到"背景清晰 + 元素清晰"同时成立，产品决定下线。
     锁三件事：① 外观页不再有主题下拉（不给已删除的功能留入口）；
     ② data-theme 恒为 dark；③ 存量设置里的 light/auto 不会让界面变浅。 */
  await page.click('#settingsBtn');
  await sleep(600);
  await page.click('[data-tab="appearance"]');
  await sleep(600);
  const appearanceText = await page.locator('#wallpaperSection').innerText();
  check('[3] 外观页不再提供主题切换（浅色已下线）',
    await page.locator('#themeSelect').count() === 0 && !appearanceText.includes('主题外观'),
    `themeSelect=${await page.locator('#themeSelect').count()}，含"主题外观"=${appearanceText.includes('主题外观')}`);
  check('[3] data-theme 恒为 dark',
    await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');

  // 模拟旧版本残留：直接往存储写浅色，刷新后界面仍必须是深色
  await page.evaluate(() => Storage.updateSettings({ theme: 'light' }));
  await page.reload();
  await sleep(2500);
  check('[3] 存量浅色设置在刷新后仍为深色',
    await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
  await page.click('#settingsBtn');
  await sleep(500);

  // [4] 组件开关
  await page.click('[data-tab="appearance"]');
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
  await page.click('[data-tab="content"]');
  await sleep(600);
  const orderBefore = await page.evaluate(() => Array.from(document.querySelectorAll('#bookmarkList .setting-item-title')).map(e => e.textContent));
  await page.locator('[data-action="move-bookmark"][data-dir="up"]').nth(1).click();
  await sleep(600);
  const orderAfter = await page.evaluate(() => Array.from(document.querySelectorAll('#bookmarkList .setting-item-title')).map(e => e.textContent));
  check('[5] 上移改变顺序', JSON.stringify(orderBefore) !== JSON.stringify(orderAfter));
  // 排除 UX-12 的快捷添加磁贴（它复用 .bookmark-item 结构，标题固定是"添加"）
  const homeOrder = await page.evaluate(() => Array.from(
    document.querySelectorAll('.bookmark-item:not([data-quick-add]) .bookmark-title')).map(e => e.textContent));
  check('[5] N1 主页顺序随键盘排序同步', JSON.stringify(homeOrder) === JSON.stringify(orderAfter));
  await page.reload();
  await sleep(2500);
  await page.click('#settingsBtn');
  await sleep(500);
  await page.click('[data-tab="content"]');
  await sleep(500);
  const orderPersist = await page.evaluate(() => Array.from(document.querySelectorAll('#bookmarkList .setting-item-title')).map(e => e.textContent));
  check('[5] 排序刷新持久化', JSON.stringify(orderPersist) === JSON.stringify(orderAfter));

  // [5.5] 连续编辑两条书签（P0-1 回归：编辑表单重复 ID 导致保存错位）
  // 用户路径：点开 A 的编辑 → 改主意点开 B 的编辑 → 在 B 的表单里输入并点它自己的保存按钮
  // 注意断言必须落在"最后一个表单自己的按钮"上：修复前该按钮没有监听器（无反应），
  // 而"点第一个按钮"在修复前后会得到相同的数据结果，无法区分
  await page.click('[data-tab="content"]');
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
  await page.click('[data-tab="content"]');
  await sleep(500);
  await openSettingsGroup(page, 'categories');
  const actBefore = await page.locator('#categoryList .sub-item').nth(0).locator('.setting-item-actions').count();
  await page.locator('[data-action="edit-item"]').nth(0).click();
  await sleep(300);
  await page.click('[data-tab="appearance"]');
  await sleep(300);
  await page.click('[data-tab="content"]');
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
  await openSettingsGroup(page, 'privacy');
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
  // A10 验证（恢复前）：主题已无下拉，导入的浅色不能生效
  check('[8] A10 导入的浅色主题不生效（仍为深色）',
    await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
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
  await page.click('[data-tab="data"]');
  await sleep(500);
  await openSettingsGroup(page, 'privacy');
  const privacyText = await page.evaluate(() => document.getElementById('privacySection').innerText);
  check('[15] 隐私 tab：权限清单', /权限清单/.test(privacyText) && /storage/.test(privacyText));
  check('[15] 隐私 tab：外部数据源', /外部数据源/.test(privacyText) && /favicon\.im/.test(privacyText) && /wttr\.in/.test(privacyText) && /bing\.biturl\.top/.test(privacyText));
  check('[15] 隐私 tab：无埋点声明', /无统计埋点/.test(privacyText) && /无广告/.test(privacyText));
  await page.keyboard.press('Escape');
  await sleep(300);

  // [27] 定位兜底：未选城市时必须能拿到坐标，这是备用源可用的前提。
  // 扩展页里 navigator.geolocation 拿不到位置（实测 code=3 Timeout，加 geolocation
  // 权限也一样），没有 IP 定位兜底，全新安装的电脑在 wttr.in 故障时就彻底没有天气。
  // 注意：weather.js 用 `const Weather` 声明，不会挂到 window 上，只能按裸标识符访问
  const locState = await page.evaluate(() => {
    if (typeof Weather === 'undefined' || !Weather.coords) return { hasCoords: false, lat: null, source: null };
    return { hasCoords: true, lat: Weather.coords.lat, source: Weather.coords.source || null };
  });
  check('[27] 未选城市时能取到定位坐标（IP 定位兜底）',
    locState.hasCoords && Number.isFinite(Number(locState.lat)), JSON.stringify(locState));
  check('[27] 定位来源可用（浏览器定位或 IP 定位）',
    locState.source === 'ip' || locState.source === 'geo', `source=${locState.source}`);
  check('[27] 浏览器定位不可用时确实请求了 IP 定位服务',
    requests.some(u => /ipwho\.is/.test(u)) || locState.source === 'geo');

  // [13] PBI-18 天气：缓存时间标注 + 失败降级 + 重试恢复
  const whcHeader = await page.evaluate(() => {
    const el = document.querySelector('.whc-header');
    return el ? el.textContent : '';
  });
  check('[13] 缓存时间标注', /更新于/.test(whcHeader), whcHeader.slice(0, 60));
  weatherMode = 'fail'; // 由 runCore 开头的固定响应 handler 读取
  openMeteoMode = 'fail'; // 备用源也失败，才会走到降级文案（容灾链路见 [26]）
  await page.evaluate(() => {
    if (typeof Weather !== 'undefined') {
      Weather._failed = false;
      Weather.cache = null;
      // 固定坐标，避免断言依赖浏览器定位/IP 定位的时序
      Weather.coords = { lat: '22.54', lng: '114.06' };
      Weather.refresh();
    }
  });
  await sleep(6500);
  const degradeText = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  check('[13] 天气失败显示降级文案', /天气暂不可用/.test(degradeText), degradeText.slice(0, 60));
  check('[13] 降级含重试按钮', await page.locator('.weather-retry').count() === 1);
  weatherMode = 'ok';
  openMeteoMode = 'ok';
  await page.locator('.weather-retry').click();
  await sleep(3500); // 固定响应无网络往返，重试一次即成功
  const afterRetry = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  check('[13] 重试后恢复天气', /°C/.test(afterRetry), afterRetry.slice(0, 60));

  // [26] 天气容灾：主源失败时自动回退备用源（2026-09-15 wttr.in 证书过期的直接回归）
  // 修复前这里只会显示"天气暂不可用"：全新安装的电脑没有缓存，证书过期即彻底没有天气
  weatherMode = 'fail';
  openMeteoMode = 'ok';
  await page.evaluate(() => {
    if (typeof Weather !== 'undefined') {
      Weather._failed = false;
      Weather.cache = null;
      Weather.selectedCityQuery = 'Shenzhen'; // 走 cities.json 的城市坐标，而非定位
      Weather.refresh();
    }
  });
  await sleep(3000);
  const failoverText = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  check('[26] 主源失败时备用源接管天气', /°C/.test(failoverText), failoverText.slice(0, 60));
  check('[26] 缓存标注数据来源为备用源',
    await page.evaluate(() => typeof Weather !== 'undefined' && !!Weather.cache && Weather.cache.source === 'open-meteo'));
  const failoverHourly = await page.evaluate(() => {
    const el = document.querySelector('.weather-hover-card');
    return el ? el.querySelectorAll('.whc-col').length : 0;
  });
  check('[26] 备用源同样提供 24 小时预报', failoverHourly === 24, `列数=${failoverHourly}`);

  // [44] 中文界面不得渲染英文天气描述（主源未覆盖代码的兜底路径）
  // 修复前：码表漏了 137/149，而 lang=zh 对 weatherDesc 不生效，英文原文直接上屏。
  // 修复分两层（码表补 137/149 + 描述映射兜底），单测分别钉住两层，这里验证端到端结果。
  weatherMode = 'haze';
  await page.evaluate(() => {
    if (typeof Weather !== 'undefined') {
      Weather._failed = false;
      Weather.cache = null;
      Weather.selectedCityQuery = 'Beijing'; // 走 cities.json 的城市坐标，不依赖定位时序
      Weather.refresh();
    }
  });
  await sleep(3000);
  const hazeText = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  const hazeFlat = hazeText.replace(/\n/g, ' ');
  check('[44] 未覆盖代码（149 烟霾）显示为中文描述', /烟霾/.test(hazeText), hazeFlat.slice(0, 70));
  // 关键断言：文案不得含英文字母。回退兜底逻辑后这里会拿到 "Smoky haze"。
  // 温度单位 °C 要排除掉 —— 它是固定单位不是文案，否则断言会永远为红（首版即栽在这里）
  check('[44] 天气文案不含英文字母（°C 除外）',
    !/[A-Za-z]/.test(hazeText.replace(/°C/g, '')), hazeFlat.slice(0, 70));

  weatherMode = 'ok';
  openMeteoMode = 'ok';
  await page.reload();
  await sleep(2500);

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

  // [17.1] 过期缓存优先于内置表（ADV-14）：年度数据跟随运行时数据源，
  // 不依赖每年升级 lunar。缓存故意设成 25 小时前，且写入一个 lunar 还没有的
  // 2027 日期；双源快速失败后仍应使用这份缓存，而不是回退到只有 2026 的内置表。
  holidayMode = 'fail';
  await page.evaluate(() => {
    localStorage.setItem('holidayCacheV1', JSON.stringify({
      timestamp: Date.now() - 25 * 60 * 60 * 1000,
      data: { '2027-01-01': { name: '元旦', off: true } }
    }));
  });
  await page.reload();
  await sleep(2500);
  const staleCache = await page.evaluate(() => ({
    has: !!(window.Calendar && Calendar.holidays && Calendar.holidays['2027-01-01']),
    source: window.Calendar && Calendar.holidaySource
  }));
  check('[17.1] 过期缓存 + 双源失败时仍使用缓存数据（ADV-14）',
    staleCache.has && staleCache.source === 'cache',
    `has=${staleCache.has} source=${staleCache.source}`);
  holidayMode = 'ok';
  await page.reload();
  await sleep(2500);

  // [18] weather 响应体挂起时超时应生效（P1-1 weather 路径回归）
  // 注入自定义 fetch：请求立即 resolve（模拟响应头已到达），但 json() 永不 settle，
  // 仅在 abort 信号触发时 reject —— 精确复现"响应头返回、响应体卡住"。
  // 修复前 clearTimeout 紧跟 fetch 之后执行，5 秒定时器被提前清掉，body 卡住后永不恢复，
  // 天气会永久停在"获取天气中…"且降级分支不可达。
  // 备用源在这里也必须失败：否则回退链路会把天气救回来，降级分支同样不可达，
  // 断言就测不到 wttr 这条路径的超时了（容灾本身由 [26] 覆盖）。
  openMeteoMode = 'fail';
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
    if (typeof Weather !== 'undefined') {
      Weather._failed = false;
      Weather.cache = null;
      Weather.coords = { lat: '22.54', lng: '114.06' }; // 固定坐标，避免降级分支取决于定位时序
      Weather.refresh();
    }
  });
  await sleep(7000);
  const slowText = await page.evaluate(() => {
    const el = document.getElementById('weatherWidget');
    return el ? el.innerText : '';
  });
  check('[18] weather 响应体挂起时超时降级', /天气暂不可用/.test(slowText), slowText.slice(0, 40) || '(空)');
  await page.evaluate(() => { if (window.__restoreFetch) window.__restoreFetch(); });
  openMeteoMode = 'ok';
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
      tablist: !!document.querySelector('.settings-nav[role="tablist"]'),
      navOrientation: document.querySelector('.settings-nav').getAttribute('aria-orientation'),
      tabStops: [...document.querySelectorAll('.tab-btn')].filter(b => b.tabIndex === 0).length,
      tabs: document.querySelectorAll('.tab-btn[role="tab"]').length,
      panels: document.querySelectorAll('.tab-content[role="tabpanel"]').length
    };
  });
  check('[19] 图标按钮与搜索框具备可访问名称', a11y.iconNames.every(n => n.length > 0),
    `searchClear/settingsClose/settingsBtn/searchInput = ${JSON.stringify(a11y.iconNames)}`);
  check('[19] 设置面板具备 dialog 语义', a11y.overlayRole === 'dialog' && a11y.overlayModal === 'true',
    `role=${a11y.overlayRole} aria-modal=${a11y.overlayModal}`);
  check('[19] tab 与面板语义关联', a11y.tablist && a11y.tabs === 4 && a11y.panels === 4,
    `tablist=${a11y.tablist} tabs=${a11y.tabs} panels=${a11y.panels}`);
  check('[19] 竖排 tablist 声明方向且只有当前项在 Tab 序', a11y.navOrientation === 'vertical' && a11y.tabStops === 1,
    `aria-orientation=${a11y.navOrientation} tabStops=${a11y.tabStops}`);

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

  // 方向 B：权限声明默认折叠 —— 断言"内容不渲染"，而不只是 open 属性为 false。
  // 注意 <details> 关闭态在 Chromium 里用 content-visibility 收起：子元素的
  // getClientRects() 仍返回缓存的布局盒、offsetParent 也不是 null，不能用它们判"不可见"
  // （实测关闭态 rects=1 / offsetParent 非 null，会误报失败）。有效信号是 innerText 为空
  // （渲染树里没有这段文字），且折叠组的实际高度只等于标题高度（内容不占版面）。
  const groupState = await page.evaluate(() => {
    const g = document.querySelector('.settings-group[data-group="privacy"]');
    const s = document.getElementById('privacySection');
    const summary = g ? g.querySelector('summary') : null;
    const gr = g ? g.getBoundingClientRect() : null;
    const sr = summary ? summary.getBoundingClientRect() : null;
    return {
      open: g ? g.open : null,
      text: s ? s.innerText.length : 0,
      summaryRects: summary ? summary.getClientRects().length : 0,
      summaryH: sr ? Math.round(sr.height) : 0,
      groupH: gr ? Math.round(gr.height) : 0,
      bodyScrollH: document.querySelector('.settings-body').scrollHeight
    };
  });
  check('[19] 权限声明默认折叠：内容不渲染、标题仍可达',
    groupState.open === false && groupState.text === 0 && groupState.summaryRects > 0
      && groupState.summaryH > 0 && groupState.groupH <= groupState.summaryH + 1,
    `open=${groupState.open} innerText=${groupState.text} summaryRects=${groupState.summaryRects} `
      + `summaryH=${groupState.summaryH} groupH=${groupState.groupH}`);

  // 焦点陷阱：必须从面板内「最后一个」可聚焦元素按 Tab 才能验出是否生效。
  // 若从 #settingsBtn 起按 Tab，焦点会顺着 DOM 顺序自然走进面板，无论有无陷阱都"通过"。
  const lastFocusable = await page.evaluate(() => {
    const panel = document.querySelector('.settings-panel');
    if (!panel) return null;
    const list = Array.from(panel.querySelectorAll(
      'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
    ))
      .filter(el => !el.disabled && el.offsetParent !== null)
      .filter(el => {
        const closed = el.closest('details:not([open])');
        return !closed || closed.querySelector(':scope > summary') === el;
      });
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
  // 末尾元素必须是折叠组的 summary：若 trapFocus 的选择器漏掉 summary，这条会红
  check('[19] 焦点陷阱的末尾元素包含折叠组标题', lastFocusable === 'settings-group-summary',
    `末尾=${lastFocusable}`);

  // 方向 B：方向键在竖排 tablist 上切换（自动激活），roving tabindex 跟随
  // 先把「天气」切为当前项，再从它按 ArrowDown —— 方向键的起点是 currentTab，
  // 若只在 data 下 focus 天气按钮，实际会从 data 继续循环到 content。
  await page.click('[data-tab="weather"]');
  await sleep(300);
  await page.focus('#tabBtnWeather');
  await page.keyboard.press('ArrowDown');
  await sleep(250);
  const arrowState = await page.evaluate(() => {
    const active = document.querySelector('.tab-btn[aria-selected="true"]');
    return {
      tab: active ? active.dataset.tab : null,
      focused: document.activeElement ? document.activeElement.id : null,
      stops: [...document.querySelectorAll('.tab-btn')].filter(b => b.tabIndex === 0).length
    };
  });
  check('[19] 方向键切换 tab 且焦点/roving 跟随',
    arrowState.tab === 'data' && arrowState.focused === 'tabBtnData' && arrowState.stops === 1,
    `tab=${arrowState.tab} focus=#${arrowState.focused} tabStops=${arrowState.stops}`);

  // 方向 B：点击分组标题后，同一份内容从"不渲染"变为可见
  await page.click('.settings-group[data-group="privacy"] > summary');
  await sleep(300);
  const privacyExpanded = await page.evaluate(() => {
    const g = document.querySelector('.settings-group[data-group="privacy"]');
    const s = document.getElementById('privacySection');
    return {
      open: g ? g.open : null,
      text: s ? s.innerText.length : 0,
      groupH: g ? Math.round(g.getBoundingClientRect().height) : 0,
      bodyScrollH: document.querySelector('.settings-body').scrollHeight
    };
  });
  check('[19] 点击分组标题后折叠内容可见',
    privacyExpanded.open === true && privacyExpanded.text > 0
      && privacyExpanded.groupH > groupState.groupH
      && privacyExpanded.bodyScrollH > groupState.bodyScrollH,
    `open=${privacyExpanded.open} innerText=${privacyExpanded.text} groupH=${groupState.groupH}→${privacyExpanded.groupH} `
      + `scrollH=${groupState.bodyScrollH}→${privacyExpanded.bodyScrollH}`);

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
  await page.click('[data-tab="content"]');
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
  await page.click('[data-tab="data"]');
  await sleep(400);
  await openSettingsGroup(page, 'privacy');
  const privacyP23 = await page.evaluate(() => {
    const el = document.getElementById('privacySection');
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
  check('[21] 第三方组件台账含来源与许可证', tpOk, 'src/THIRD-PARTY.md');

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

  // [23] 小时轴按城市当地时间对齐（P3-4）
  // mock 的城市时间是浏览器时间 +6 小时：若代码仍用浏览器本地时间对齐，第二个刻度会对不上
  await page.evaluate(async () => {
    Weather.cache = null;
    await Weather.refresh(); // 重新经过 buildHourly24，使用 mock 的 localObsDateTime
  });
  await sleep(800);
  const hourTicks = await page.evaluate(() => {
    Weather.render();
    return [...document.querySelectorAll('.whc-hour')].map(e => e.textContent.trim()).filter(Boolean);
  });
  const expectTick = String((MOCK_CITY_HOUR + 3) % 24).padStart(2, '0');
  check('[23] 小时轴按城市当地时间对齐（P3-4）',
    hourTicks[0] === '现在' && hourTicks[1] === expectTick,
    `刻度=${JSON.stringify(hourTicks)}，期望第 2 个=${expectTick}`);

  // [24] 跨标签页同步（P3-2）
  // 在第二个标签页写入数据，本页应通过 storage.onChanged 自动刷新。
  // 预览模式走 localStorage 回退，没有 chrome.storage.onChanged —— 该能力仅在扩展环境具备，跳过。
  const hasOnChanged = await page.evaluate(() =>
    !!(typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged));
  if (hasOnChanged) {
    const page2 = await page.context().newPage();
    await page2.goto(page.url(), { waitUntil: 'domcontentloaded' });
    await page2.waitForSelector('.bookmark-item, .empty-hint');
    await page2.evaluate(() => Storage.addBookmark({ title: '跨页同步测试', url: 'https://cross-tab.example.com' }));
    await sleep(1500);
    const synced = await page.evaluate(() =>
      [...document.querySelectorAll('.bookmark-item .bookmark-title')].some(e => e.textContent === '跨页同步测试'));
    check('[24] 跨标签页同步：另一页新增的书签本页可见（P3-2）', synced, synced ? '已同步' : '未同步');
    await page2.close();
  } else {
    info('[24] 跨标签页同步断言', '预览模式无 chrome.storage.onChanged，跳过（该能力仅扩展环境具备）');
  }

  // [25] 壁纸慢响应不覆盖后发操作（P3-6）
  // 先发起 Bing 每日壁纸（mock 为 1.5 秒慢响应），随后立刻切到随机壁纸；
  // 迟到的 Bing 响应不得把后发的选择覆盖掉
  bingDelayMs = 1500;
  await page.evaluate(() => { Wallpaper.apply(Wallpaper.getWallpapers().findIndex(w => w.name === 'Bing 每日壁纸')); }); // Bing（不 await，让它在后台慢）
  await sleep(250);
  await page.evaluate(() => { Wallpaper.apply(Wallpaper.getWallpapers().findIndex(w => w.name === '随机壁纸')); }); // 随机壁纸（同步生效）
  await sleep(2600);
  const bgAfter = await page.evaluate(() => document.getElementById('bgLayer').style.backgroundImage || '');
  check('[25] 慢响应不覆盖后发的壁纸选择（P3-6）', /biturl\.top/.test(bgAfter), bgAfter.slice(0, 80));
  bingDelayMs = 0;

  /* ---- [28][34] 内容增长后的主页面布局（UX-01 / UX-07）----
     核心回归：书签与分类积累到 24-26 个后，flex 居中 + overflow 会把搜索框顶出视口，
     而且滚到最顶也回不来。用远超临界点的数据量（40/12/12）验证它不会再发生。 */
  const stress = await page.evaluate(async () => {
    const bookmarks = Array.from({ length: 40 }, (_, i) => (
      { id: 'sx' + i, title: '压力站点' + i, url: 'https://e' + i + '.com', sortOrder: i }));
    const categories = Array.from({ length: 12 }, (_, i) => ({
      id: 'sy' + i, title: '压力分类' + (i + 1), collapsed: false, sortOrder: i,
      items: Array.from({ length: 6 }, (_, j) => (
        { id: 'sz' + i + '-' + j, title: '站点' + (j + 1), url: 'https://s' + i + j + '.com', sortOrder: j }))
    }));
    const todos = Array.from({ length: 12 }, (_, i) => (
      { id: 'st' + i, text: '压力测试待办 ' + (i + 1), done: false, createdAt: i }));
    await Storage.importData(JSON.stringify({ schemaVersion: 1, bookmarks, categories, todos }));
    await App.renderBookmarks();
    await App.renderCategories();
    await Todos.render();
    await new Promise(r => setTimeout(r, 600));
    const mc = document.querySelector('.main-content');
    mc.scrollTop = 0;
    const search = document.querySelector('.search-box').getBoundingClientRect();
    const title = document.querySelector('.site-title').getBoundingClientRect();
    const cat = document.querySelector('#categoryContainer').getBoundingClientRect();
    const todoCard = document.querySelector('.todo-card').getBoundingClientRect();
    const todoList = document.querySelector('.todo-list');
    return {
      searchTop: Math.round(search.top), titleTop: Math.round(title.top),
      catH: Math.round(cat.height), todoH: Math.round(todoCard.height),
      todoScrollH: todoList ? todoList.scrollHeight : 0,
      todoClientH: todoList ? todoList.clientHeight : 0,
      scrollRange: mc.scrollHeight - mc.clientHeight
    };
  });
  // 先确认测试条件真的触发了溢出场景：若内容根本没超出视口，
  // 下面"搜索框可见"的断言会因为没东西可溢出而永远是绿的（无区分度）
  check('[28] 压力数据确实使内容超出视口', stress.scrollRange > 0,
    `可滚 ${stress.scrollRange}px`);
  check('[28] 40 书签/12 分类下搜索框与标题仍可见（UX-01）',
    stress.searchTop >= 0 && stress.titleTop >= 0,
    `搜索框 top=${stress.searchTop}，标题 top=${stress.titleTop}`);
  check('[34] 待办卡片与分类容器等高（UX-07）', Math.abs(stress.catH - stress.todoH) <= 2,
    `分类 ${stress.catH}px / 待办 ${stress.todoH}px`);
  check('[34] 12 条待办在卡片内滚动而非撑高页面（UX-07）',
    stress.todoScrollH > stress.todoClientH,
    `scrollHeight=${stress.todoScrollH} clientHeight=${stress.todoClientH}`);

  /* ---- [32] 设置面板 tab 不折行（UX-05）---- */
  // 前面的用例可能把设置面板留在打开状态，遮罩会挡住主页上的点击，先归位
  const overlayOpen = await page.evaluate(() =>
    !!document.getElementById('settingsOverlay') &&
    document.getElementById('settingsOverlay').classList.contains('open'));
  if (overlayOpen) { await page.click('#settingsClose'); await sleep(600); }
  await page.click('#settingsBtn');
  await sleep(600);
  const tabMetrics = await page.evaluate(() => [...document.querySelectorAll('.tab-btn')].map(b => {
    // 用 Range 量文字实际占几行：height/line-height 会把上下 padding 算进行数，
    // 单行 tab（13px padding + 约 19px 行高）会被误判成两行
    const range = document.createRange();
    range.selectNodeContents(b);
    return { text: b.textContent.trim(), lines: range.getClientRects().length,
      overflow: b.scrollWidth > b.clientWidth + 1 };
  }));
  const wrappedTabs = tabMetrics.filter(t => t.lines > 1);
  check('[32] 设置面板 tab 不折行（UX-05）', wrappedTabs.length === 0,
    wrappedTabs.length ? `折行: ${wrappedTabs.map(t => t.text).join('/')}` : `${tabMetrics.length} 个 tab 均为单行`);
  const overflowTabs = tabMetrics.filter(t => t.overflow);
  check('[32] 设置面板 tab 文字不溢出按钮', overflowTabs.length === 0,
    overflowTabs.length ? `溢出: ${overflowTabs.map(t => t.text).join('/')}` : '均在按钮内');
  await page.click('#settingsClose');
  await sleep(500);

  /* ---- [33] 书签末行与首行左对齐（UX-06）---- */
  const align = await page.evaluate(() => {
    const bm = [...document.querySelectorAll('.bookmark-item')].map(e => e.getBoundingClientRect());
    const rows = new Map();
    bm.forEach(r => { const k = Math.round(r.top); rows.set(k, (rows.get(k) || 0) + 1); });
    const tops = [...rows.keys()].sort((a, b) => a - b);
    const first = bm.filter(r => Math.round(r.top) === tops[0]);
    const last = bm.filter(r => Math.round(r.top) === tops[tops.length - 1]);
    return { rowCount: tops.length, lastRowCount: last.length,
      firstLeft: Math.round(Math.min(...first.map(r => r.left))),
      lastLeft: Math.round(Math.min(...last.map(r => r.left))) };
  });
  check('[33] 测试条件：书签确实分多行', align.rowCount > 1 && align.lastRowCount < 7,
    `共 ${align.rowCount} 行，末行 ${align.lastRowCount} 个`);
  check('[33] 书签末行与首行左对齐（UX-06）', Math.abs(align.firstLeft - align.lastLeft) <= 2,
    `首行 left=${align.firstLeft} 末行 left=${align.lastLeft}，差 ${Math.abs(align.firstLeft - align.lastLeft)}px`);

  /* ---- [29] 主题可读性（UX-02 / UX-14）----
     先回到小数据集，保证所有被测元素都在视口内（溢出的元素会被采样器跳过，
     那样断言会悄悄失去覆盖）。 */
  await page.evaluate(async () => {
    await Storage.importData(JSON.stringify({
      schemaVersion: 1,
      bookmarks: Array.from({ length: 8 }, (_, i) => ({ id: 'c' + i, title: '站点' + i, url: 'https://c' + i + '.com', sortOrder: i })),
      categories: [{ id: 'k0', title: '分类一', collapsed: false, sortOrder: 0,
        items: [{ id: 'k0-0', title: '子站', url: 'https://k.com', sortOrder: 0 }] }],
      todos: [{ id: 'ct0', text: '对比度采样用待办', done: false, createdAt: 1 }]
    }));
  });
  const CONTRAST_TARGETS = [
    ['.site-title', '主标题'], ['.site-subtitle', '副标题'], ['.bookmark-title', '书签名称'],
    ['.category-title', '分类标题'], ['.category-link', '分类链接'], ['.todo-title', '待办标题'],
    ['.datetime-text', '日期时间'], ['.tool-btn', '底部按钮'], ['.engine-btn', '引擎按钮']
  ];
  // 2.0.0 起只有深色主题，这套采样只跑一遍（此前是 dark/light 各一遍）
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const measured = await contrastRatios(page, CONTRAST_TARGETS);
  const sampled = measured.filter(x => x.status === 'ok');
  const bad = sampled.filter(x => !x.pass);
  check('[29] 深色主题关键文字对比度达标（UX-02/UX-14）', bad.length === 0,
    bad.length ? bad.map(x => `${x.name} ${x.ratio}:1 bg=${x.bg} fg=${x.fg} rect=${x.rect} img=${x.img} n2=${x.top2}`).join('、') : `${sampled.length} 项全部 ≥ 阈值`);
  // 防"采样不到任何元素所以永远通过"的假绿
  check('[29] 深色主题采样覆盖到全部目标元素', sampled.length === CONTRAST_TARGETS.length,
    `采样 ${sampled.length}/${CONTRAST_TARGETS.length} 项`);


  /* ---- [43] 浅色预设「晨雾白」已下线（2.0.0）----
     它是浅色底渐变，配深色界面会整片过曝，随浅色主题一起移除。
     锁两件事：① 壁纸列表里没有它；② 存量设置还指向它时回落到默认壁纸
     （否则设置面板的下拉会选不中任何一项，显示与存储不一致）。 */
  const wpList = await page.evaluate(() => Wallpaper.getWallpapers().map(w => w.name));
  check('[43] 壁纸列表不再包含浅色预设「晨雾白」',
    !wpList.some(n => n === '晨雾白'), wpList.join('、'));

  const fogFallback = await page.evaluate(async () => {
    const merged = await Storage.updateSettings({ wallpaperName: '晨雾白' });
    return merged.wallpaperName;
  });
  check('[43] 存量设置指向晨雾白时回落到默认壁纸',
    fogFallback === '深邃星空', `wallpaperName=${fogFallback}`);

  /* ---- [35] 待办删除可撤销（UX-08）---- */
  const undoFlow = await page.evaluate(async () => {
    const domOrder = () => [...document.querySelectorAll('.todo-item .todo-text')].map(e => e.textContent);
    await Storage.importData(JSON.stringify({ schemaVersion: 1, todos: [
      { id: 'u1', text: '明天签约', done: false, createdAt: 1 },
      { id: 'u2', text: '第二条待办', done: false, createdAt: 2 }
    ] }));
    await Todos.render();
    await new Promise(r => setTimeout(r, 300));
    const before = domOrder();
    const btn = document.querySelector('.todo-item .todo-delete-btn');
    if (!btn) return { error: '找不到删除按钮' };
    btn.click();
    await new Promise(r => setTimeout(r, 700));
    const afterDelete = domOrder();
    const toastEl = document.querySelector('#toastRoot .toast');
    const undoBtn = document.querySelector('#toastRoot .toast-action');
    const toastText = toastEl ? toastEl.innerText : '';
    if (undoBtn) { undoBtn.click(); await new Promise(r => setTimeout(r, 700)); }
    return { before, afterDelete, toastText, hasUndo: !!undoBtn, afterUndo: domOrder() };
  });
  check('[35] 删除待办后给出可撤销提示（UX-08）',
    undoFlow.hasUndo && /已删除/.test(undoFlow.toastText || ''),
    `提示="${undoFlow.toastText || '(无)'}"，撤销按钮=${undoFlow.hasUndo ? '有' : '无'}`);
  check('[35] 撤销后待办回到原位（UX-08）',
    // 前置条件不能省：找不到删除按钮时 evaluate 返回 { error }，两边都是 undefined，
    // JSON.stringify 比较会意外成立，让这条断言在功能缺失时假绿
    !undoFlow.error && Array.isArray(undoFlow.before) && undoFlow.before.length > 0
      && JSON.stringify(undoFlow.afterUndo) === JSON.stringify(undoFlow.before),
    `删除前=${JSON.stringify(undoFlow.before)} 删除后=${JSON.stringify(undoFlow.afterDelete)} 撤销后=${JSON.stringify(undoFlow.afterUndo)}`);

  /* ---- [36] 空状态行动入口（UX-09）---- */
  const emptyActions = await page.evaluate(async () => {
    await Storage.importData(JSON.stringify({ schemaVersion: 1, bookmarks: [], categories: [], todos: [] }));
    await App.renderBookmarks();
    await App.renderCategories();
    await new Promise(r => setTimeout(r, 400));
    return {
      bookmarkBtns: [...document.querySelectorAll('#bookmarkContainer .empty-actions button')].map(b => b.textContent.trim()),
      categoryBtns: [...document.querySelectorAll('#categoryContainer .empty-actions button')].map(b => b.textContent.trim())
    };
  });
  check('[36] 书签空状态提供行动入口（UX-09）', emptyActions.bookmarkBtns.length >= 2,
    emptyActions.bookmarkBtns.join(' / ') || '(无按钮)');
  check('[36] 分类空状态提供行动入口（UX-09）', emptyActions.categoryBtns.length >= 1,
    emptyActions.categoryBtns.join(' / ') || '(无按钮)');
  // 按钮不存在时不能直接 page.click（会抛超时并中断整个用例，
  // 那样回归失败会表现为"脚本崩溃"而不是"断言变红"）
  const hasAddBookmarkBtn = await page.evaluate(() =>
    !!document.querySelector('#bookmarkContainer [data-empty-action="add-bookmark"]'));
  if (hasAddBookmarkBtn) {
    await page.click('#bookmarkContainer [data-empty-action="add-bookmark"]');
    await sleep(800);
    const emptyOpen = await page.evaluate(() => ({
      open: document.getElementById('settingsOverlay').classList.contains('open'),
      tab: (document.querySelector('.tab-btn.active') || {}).dataset ? document.querySelector('.tab-btn.active').dataset.tab : '',
      form: !!document.querySelector('#bookmarkList .inline-form')
    }));
    check('[36] 点击空状态按钮直达"添加书签"表单（UX-09）',
      emptyOpen.open && emptyOpen.tab === 'content' && emptyOpen.form,
      `面板=${emptyOpen.open} tab=${emptyOpen.tab} 表单=${emptyOpen.form}`);
    await page.click('#settingsClose');
    await sleep(500);
  } else {
    check('[36] 点击空状态按钮直达"添加书签"表单（UX-09）', false, '空状态区没有可点击的行动按钮');
  }

  /* ---- [45] 空状态布局不塌陷（UX-06 的 auto-fit × UX-09 的空状态叠加回归）----
     书签区用 repeat(auto-fit, 68px)，而 auto-fit 会折叠空轨道：没有任何 bookmark-cell 时
     grid-template-columns 退化成 `68px 0px 0px 0px 0px 0px 0px`，空状态块被限制在 52px 内 ——
     文案逐字换行、两个按钮变成 55×144 与 55×120。
     这里量尺寸而不是"元素是否存在"：塌陷时按钮照样存在、也照样能点，存在性断言测不出来
     （[36] 就是这么漏掉它的）。分类区不折叠（repeat(2,1fr)），但空状态默认只占左列，
     所以一并钉住它的跨列宽度。 */
  const emptyLayout = await page.evaluate(() => {
    const box = e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
    const grid = document.getElementById('bookmarkContainer');
    const catGrid = document.getElementById('categoryContainer');
    const hint = grid.querySelector('.empty-hint');
    const btns = [...grid.querySelectorAll('.empty-actions button')];
    const catBlock = catGrid.querySelector('.empty-state-block');
    return {
      cols: getComputedStyle(grid).gridTemplateColumns,
      gridW: Math.round(grid.getBoundingClientRect().width),
      hintW: hint ? Math.round(hint.getBoundingClientRect().width) : 0,
      btns: btns.map(b => ({ t: b.textContent.trim(), ...box(b) })),
      catGridW: Math.round(catGrid.getBoundingClientRect().width),
      catBlockW: catBlock ? Math.round(catBlock.getBoundingClientRect().width) : 0
    };
  });
  // 阈值取"占容器 90% 以上"而不是绝对值：塌陷时是 52/640 ≈ 8%，
  // 修复后是 624/640 ≈ 98%，与视口宽度无关，也不会因为布局微调而误报
  check('[45] 空状态提示占满容器宽度，不被 auto-fit 折叠压成竖排',
    emptyLayout.gridW > 0 && emptyLayout.hintW >= emptyLayout.gridW * 0.9,
    `提示 ${emptyLayout.hintW}px / 容器 ${emptyLayout.gridW}px（列模板 ${emptyLayout.cols}）`);
  check('[45] 空状态按钮不被压成窄条',
    emptyLayout.btns.length >= 2 && emptyLayout.btns.every(b => b.w >= 100 && b.h <= 60),
    emptyLayout.btns.length ? emptyLayout.btns.map(b => `${b.t}=${b.w}×${b.h}`).join(' / ') : '(无按钮)');
  // 分类区是两列：跨列后应占满容器，未跨列时只有约 49%
  check('[45] 分类空状态跨满两列，不偏在左列',
    emptyLayout.catGridW > 0 && emptyLayout.catBlockW >= emptyLayout.catGridW * 0.9,
    `分类空状态块 ${emptyLayout.catBlockW}px / 容器 ${emptyLayout.catGridW}px`);

  /* ---- [38] 壁纸切换有文字反馈（UX-11）---- */
  const wpFeedback = await page.evaluate(async () => {
    const before = Wallpaper.currentIndex;
    document.getElementById('wallpaperBtn').click();
    await new Promise(r => setTimeout(r, 900));
    const el = document.querySelector('#toastRoot .toast');
    return { before, after: Wallpaper.currentIndex, text: el ? el.innerText : '', visible: !!el };
  });
  check('[38] 切换壁纸给出文字反馈（UX-11）',
    wpFeedback.visible && wpFeedback.after !== wpFeedback.before && wpFeedback.text.length > 0,
    `索引 ${wpFeedback.before}→${wpFeedback.after}，提示="${wpFeedback.text}"`);
  await sleep(2400);
  const wpToastGone = await page.evaluate(() => !document.querySelector('#toastRoot .toast'));
  // 加 visible 前提：否则"提示压根没出现过"也会满足"现在没有提示"，成为无区分度断言
  check('[38] 壁纸提示到点自动消失（UX-11）', wpFeedback.visible && wpToastGone,
    wpFeedback.visible ? (wpToastGone ? '已消失' : '仍在显示') : '提示从未出现，无法验证自动消失');


  /* ---- [37] 从浏览器导入书签（UX-10）----
     shim 模式用 chrome.permissions / chrome.bookmarks 替身跑完整流程；
     预览模式没有这两个 API，验证它给出明确提示而不是静默失败；
     扩展模式会用真实 API 弹系统授权框，E2E 无法处理，跳过并记录。

     判据是 permissions.request（"能不能申请"），不是 chrome.bookmarks（"能不能读"）——
     后者在未授权时压根不存在，用它判断会让扩展模式误入"降级提示"分支，
     进而在 headless 下去弹真实系统授权框、永远等不到回调。 */
  const canRequestPerm = await page.evaluate(() =>
    !!(typeof chrome !== 'undefined' && chrome.permissions && chrome.permissions.request));

  if (canRequestPerm && label === 'shim') {
    const granted = await page.evaluate(async () => {
      window.__permissionsGranted = true;
      window.__bookmarksTree = [{
        id: '0', title: '', children: [
          { id: '1', title: '书签栏', children: [
            { id: '10', title: 'GitHub', url: 'https://github.com/' },
            { id: '11', title: '开发', children: [{ id: '12', title: 'MDN', url: 'https://developer.mozilla.org/' }] }
          ] },
          { id: '2', title: '其他书签', children: [
            { id: '20', title: '重复的 GitHub', url: 'https://github.com/' },
            { id: '21', title: '浏览器设置页', url: 'chrome://settings' }
          ] }
        ]
      }];
      // 先放一个"导入前就存在"的分类：这样后面才能验证备份里存的是**导入前**的状态，
      // 而不是恰好被 importData 顺手写下的那份（否则备份断言没有区分度）
      await Storage.importData(JSON.stringify({ schemaVersion: 1, bookmarks: [], categories: [
        { id: 'pre', title: '导入前就有的分类', collapsed: false, sortOrder: 0, items: [] }
      ], todos: [] }));
      Settings.open();
      Settings.switchTab('data');
      await new Promise(r => setTimeout(r, 300));
      document.getElementById('importBrowserBookmarksBtn').click();
      await new Promise(r => setTimeout(r, 1800));
      const cats = await Storage.getCategories();
      return {
        catCount: cats.length,
        titles: cats.map(c => c.title),
        items: cats.reduce((n, c) => n + (c.items || []).length, 0),
        githubCount: cats.reduce((n, c) => n + (c.items || []).filter(i => i.url === 'https://github.com/').length, 0),
        chromeUrls: cats.reduce((n, c) => n + (c.items || []).filter(i => /^chrome:/.test(i.url)).length, 0),
        feedback: (document.getElementById('dataFeedback') || {}).textContent || ''
      };
    });
    check('[37] 授权后按文件夹导入为分类（UX-10）',
      granted.catCount === 2 && granted.titles.includes('导入前就有的分类') && granted.titles.includes('书签栏') && granted.items === 2,
      `分类=${JSON.stringify(granted.titles)} 链接=${granted.items} 个`);
    check('[37] 重复地址去重、非 http 地址被过滤（UX-10）',
      granted.githubCount === 1 && granted.chromeUrls === 0,
      `github 出现 ${granted.githubCount} 次，chrome:// 出现 ${granted.chromeUrls} 次`);
    check('[37] 导入结果有文字反馈（UX-10）', /已从浏览器导入 2 个书签/.test(granted.feedback),
      `反馈="${granted.feedback}"`);
    const backupWritten = await storageGet(page, 'lastImportBackup-1');
    check('[37] 导入前自动备份的是导入前状态（可用"恢复最近备份"回滚）（UX-10）',
      !!(backupWritten && (backupWritten.categories || []).some(c => c.title === '导入前就有的分类')
        && !(backupWritten.categories || []).some(c => c.title === '书签栏')),
      backupWritten ? `备份分类=${JSON.stringify((backupWritten.categories || []).map(c => c.title))}` : '未写入备份');

    const denied = await page.evaluate(async () => {
      window.__permissionsGranted = false;
      const before = (await Storage.getCategories()).length;
      document.getElementById('importBrowserBookmarksBtn').click();
      await new Promise(r => setTimeout(r, 1200));
      return { before, after: (await Storage.getCategories()).length,
        feedback: (document.getElementById('dataFeedback') || {}).textContent || '' };
    });
    check('[37] 拒绝授权时给出引导且数据不变（UX-10）',
      denied.before === denied.after && /未授权/.test(denied.feedback),
      `分类 ${denied.before}→${denied.after}，反馈="${denied.feedback}"`);
    await page.click('#settingsClose');
    await sleep(500);
  } else if (!canRequestPerm) {
    const degraded = await page.evaluate(async () => {
      Settings.open();
      Settings.switchTab('data');
      await new Promise(r => setTimeout(r, 300));
      const btn = document.getElementById('importBrowserBookmarksBtn');
      if (!btn) return { missing: true };
      btn.click();
      await new Promise(r => setTimeout(r, 600));
      return { missing: false, feedback: (document.getElementById('dataFeedback') || {}).textContent || '' };
    });
    check('[37] 预览模式明确提示不支持而非静默失败（UX-10）',
      !degraded.missing && /不支持|读不到/.test(degraded.feedback),
      degraded.missing ? '按钮不存在' : `反馈="${degraded.feedback}"`);
    await page.click('#settingsClose');
    await sleep(500);
  } else {
    info('[37] 扩展模式跳过', '真实 chrome.permissions 会弹系统授权框，E2E 无法处理，需人工验证一次');
  }


  /* ---- [39] 在线壁纸明度采样（UX-13）----
     2.0.0 起主题不再跟随壁纸（auto 已移除），但采样结果仍要写进
     data-wallpaper-tone：深色主题的压暗层强度按壁纸明暗分档——亮壁纸必须压得更重，
     否则白色标题会糊在照片里。这里验的是采样链路本身，不再断言主题切换。 */
  const makePng = (color) => page.evaluate(c => {
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 4;
    const cx = cv.getContext('2d');
    cx.fillStyle = c;
    cx.fillRect(0, 0, 4, 4);
    return cv.toDataURL('image/png').split(',')[1];
  }, color);

  const readThemeAndTone = () => page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    tone: document.documentElement.dataset.wallpaperTone
  }));

  const runWithWallpaper = async (name, color, base64Setter) => {
    base64Setter(await makePng(color));
    return page.evaluate(async (n) => {
      await Storage.updateSettings({ wallpaperName: n, wallpaperApiCache: null, wallpaperDaily: null });
      await Wallpaper.apply(Wallpaper.getWallpapers().findIndex(w => w.name === n));
      await new Promise(r => setTimeout(r, 1200));
      return {
        theme: document.documentElement.dataset.theme,
        tone: document.documentElement.dataset.wallpaperTone
      };
    }, name);
  };

  const brightBing = await runWithWallpaper('Bing 每日壁纸', '#f2f4f8', v => { bingImageBase64 = v; });
  check('[39] 亮色在线壁纸被采样为 light（压暗层据此加重）',
    brightBing.tone === 'light' && brightBing.theme === 'dark',
    `tone=${brightBing.tone} theme=${brightBing.theme}`);

  const darkBing = await runWithWallpaper('Bing 每日壁纸', '#0b0b1c', v => { bingImageBase64 = v; });
  check('[39] 深色在线壁纸标记为 dark',
    darkBing.tone === 'dark' && darkBing.theme === 'dark',
    `tone=${darkBing.tone} theme=${darkBing.theme}`);

  // 采样失败时必须回退到静态 hint，不能把 tone 留在不确定状态
  bingImageBase64 = '';
  const brokenTone = await page.evaluate(async () => {
    await Storage.updateSettings({ wallpaperName: 'Bing 每日壁纸', wallpaperApiCache: null, wallpaperDaily: null });
    await Wallpaper.apply(Wallpaper.getWallpapers().findIndex(w => w.name === 'Bing 每日壁纸'));
    await new Promise(r => setTimeout(r, 1200));
    return {
      theme: document.documentElement.dataset.theme,
      tone: document.documentElement.dataset.wallpaperTone
    };
  });
  check('[39] 图片不可采样时回退到静态 hint 而不报错',
    brokenTone.tone === 'dark' && brokenTone.theme === 'dark',
    `tone=${brokenTone.tone} theme=${brokenTone.theme}`);

  // ADV-05：随机壁纸源与 Bing 走同一条采样链路
  const brightRandom = await runWithWallpaper('随机壁纸', '#f2f4f8', v => { randomImageBase64 = v; });
  check('[39] 随机壁纸亮图同样被采样为 light（ADV-05）',
    brightRandom.tone === 'light', `tone=${brightRandom.tone}`);

  /* ---- [40] 主页快捷添加书签（UX-12）---- */
  await page.evaluate(async () => {
    await Storage.importData(JSON.stringify({ schemaVersion: 1,
      bookmarks: [
        { id: 'q1', title: '第一个', url: 'https://keytest.example/', sortOrder: 0 },
        { id: 'q2', title: '第二个', url: 'https://second.example/', sortOrder: 1 }
      ], categories: [], todos: [] }));
    await App.renderBookmarks();
    await new Promise(r => setTimeout(r, 400));
  });
  const tileInfo = await page.evaluate(() => {
    const el = document.querySelector('#bookmarkContainer [data-quick-add="1"]');
    if (!el) return { exists: false };
    return {
      exists: true,
      draggable: el.getAttribute('draggable'),
      inDragSet: [...document.querySelectorAll('#bookmarkContainer [draggable="true"]')].includes(el)
    };
  });
  check('[40] 书签区末尾有快捷添加磁贴（UX-12）', tileInfo.exists,
    tileInfo.exists ? '存在' : '不存在');
  check('[40] 磁贴不进入拖拽集合，不会打乱书签顺序（UX-12）',
    tileInfo.exists && !tileInfo.inDragSet,
    `draggable=${tileInfo.draggable} 在拖拽集合内=${tileInfo.inDragSet}`);
  if (tileInfo.exists) {
    await page.click('#bookmarkContainer [data-quick-add="1"]');
    await sleep(800);
    const quickForm = await page.evaluate(() => ({
      open: document.getElementById('settingsOverlay').classList.contains('open'),
      tab: (document.querySelector('.tab-btn.active') || {}).dataset ? document.querySelector('.tab-btn.active').dataset.tab : '',
      form: !!document.querySelector('#bookmarkList .inline-form')
    }));
    check('[40] 点击磁贴直达"添加书签"表单（UX-12）',
      quickForm.open && quickForm.tab === 'content' && quickForm.form,
      `面板=${quickForm.open} tab=${quickForm.tab} 表单=${quickForm.form}`);
    await page.click('#settingsClose');
    await sleep(500);
  } else {
    check('[40] 点击磁贴直达"添加书签"表单（UX-12）', false, '磁贴不存在');
  }

  /* ---- [42] 主页悬浮删除与撤销（UX-12）----
     注意拖拽单元从 <a> 迁到了外层 cell：删除按钮必须是 <a> 的兄弟节点
     （button 嵌在 a 里是无效 HTML，浏览器会把按钮移出去），而 draggable 只有跟着搬到
     cell 上，拖拽时按钮才会一起走。下面几条断言就是钉住这个结构的。 */
  const removeInfo = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('#bookmarkContainer .bookmark-cell')];
    const btn = document.querySelector('#bookmarkContainer .bookmark-remove');
    const cs = btn ? getComputedStyle(btn) : null;
    const anchor = document.querySelector('#bookmarkContainer .bookmark-item');
    return {
      cellCount: cells.length,
      dragCount: document.querySelectorAll('#bookmarkContainer [draggable="true"]').length,
      cellsHaveId: cells.every(c => !!c.dataset.id),
      anchorDraggable: anchor ? anchor.getAttribute('draggable') : 'no-anchor',
      removeExists: !!btn,
      defaultOpacity: cs ? cs.opacity : null,
      defaultPointerEvents: cs ? cs.pointerEvents : null,
      ariaLabel: btn ? (btn.getAttribute('aria-label') || '') : ''
    };
  });
  check('[42] 拖拽单元是 cell 而非 <a>（UX-12）',
    removeInfo.cellCount > 0 && removeInfo.dragCount === removeInfo.cellCount
      && removeInfo.cellsHaveId && !removeInfo.anchorDraggable,
    `cell=${removeInfo.cellCount} draggable=${removeInfo.dragCount} cell带id=${removeInfo.cellsHaveId} <a>上draggable=${removeInfo.anchorDraggable}`);
  check('[42] 删除按钮默认隐藏且不抢点击（UX-12）',
    removeInfo.removeExists && removeInfo.defaultOpacity === '0' && removeInfo.defaultPointerEvents === 'none',
    `opacity=${removeInfo.defaultOpacity} pointer-events=${removeInfo.defaultPointerEvents}`);
  check('[42] 删除按钮有可读的无障碍名称（UX-12）', /^删除书签 /.test(removeInfo.ariaLabel),
    `aria-label="${removeInfo.ariaLabel}"`);

  /* 用真实鼠标操作删一次，不用 DOM click()。
     删除按钮平时是 pointer-events:none（避免挡住书签点击），
     只有 cell 被 hover/聚焦时才可点 —— DOM click() 会绕过这个判定，
     测不出"按钮到底能不能点"，属于验证条件与生产不符。 */
  const titlesOf = () => page.evaluate(() =>
    [...document.querySelectorAll('#bookmarkContainer .bookmark-cell .bookmark-title')].map(e => e.textContent));
  const hasRemoveBtn = await page.evaluate(() => !!document.querySelector('#bookmarkContainer .bookmark-remove'));
  if (hasRemoveBtn) {
    const beforeRemove = await titlesOf();
    await page.hover('#bookmarkContainer .bookmark-cell:first-child');
    await sleep(350);
    await page.click('#bookmarkContainer .bookmark-cell:first-child .bookmark-remove');
    await sleep(900);
    const afterDelete = await titlesOf();
    const removeToast = await page.evaluate(() => {
      const el = document.querySelector('#toastRoot .toast');
      return { text: el ? el.innerText : '', hasUndo: !!document.querySelector('#toastRoot .toast-action') };
    });
    check('[42] 主页删除书签后给出可撤销提示（UX-12）',
      removeToast.hasUndo && /已删除/.test(removeToast.text),
      `提示="${removeToast.text || '(无)'}"，撤销按钮=${removeToast.hasUndo ? '有' : '无'}`);
    check('[42] 真实鼠标点击确实删掉了那一条（UX-12）',
      beforeRemove.length === afterDelete.length + 1 && !afterDelete.includes(beforeRemove[0]),
      `删除前 ${beforeRemove.length} 条 → 删除后 ${afterDelete.length} 条`);

    await page.click('#toastRoot .toast-action');
    await sleep(900);
    const afterUndo = await titlesOf();
    check('[42] 撤销后书签回到原位（UX-12）',
      Array.isArray(beforeRemove) && beforeRemove.length > 0
        && JSON.stringify(afterUndo) === JSON.stringify(beforeRemove),
      `删除前=${JSON.stringify(beforeRemove)} 删除后=${JSON.stringify(afterDelete)} 撤销后=${JSON.stringify(afterUndo)}`);
  } else {
    check('[42] 主页删除书签后给出可撤销提示（UX-12）', false, '书签上找不到删除按钮');
    check('[42] 真实鼠标点击确实删掉了那一条（UX-12）', false, '书签上找不到删除按钮');
    check('[42] 撤销后书签回到原位（UX-12）', false, '书签上找不到删除按钮');
  }

  // 关闭"快捷添加"后磁贴应消失（方案要求该入口可在设置中隐藏）
  const quickAddToggle = await page.evaluate(async () => {
    await Storage.updateSettings({ showQuickAdd: false });
    await App.renderBookmarks();
    await new Promise(r => setTimeout(r, 500));
    const hidden = !document.querySelector('[data-quick-add="1"]');
    await Storage.updateSettings({ showQuickAdd: true });
    await App.renderBookmarks();
    await new Promise(r => setTimeout(r, 500));
    return { hidden, restored: !!document.querySelector('[data-quick-add="1"]') };
  });
  check('[42] showQuickAdd=false 时磁贴不渲染、恢复后回来（UX-12）',
    quickAddToggle.hidden && quickAddToggle.restored,
    `关闭后隐藏=${quickAddToggle.hidden}，恢复后出现=${quickAddToggle.restored}`);

  // 必须从设置页的开关点进去验一遍：直接写存储只能证明渲染逻辑，证明不了开关接对了线
  await page.click('#settingsBtn');
  await sleep(600);
  await page.click('#tabBtnAppearance');
  await sleep(500);
  const hasToggle = await page.evaluate(() => !!document.getElementById('showQuickAddToggle'));
  if (hasToggle) {
    await page.click('#showQuickAddToggle'); // 取消勾选
    await sleep(800);
    const hiddenByUi = await page.evaluate(() => !document.querySelector('[data-quick-add="1"]'));
    await page.click('#showQuickAddToggle'); // 重新勾选
    await sleep(800);
    const restoredByUi = await page.evaluate(() => !!document.querySelector('[data-quick-add="1"]'));
    check('[42] 设置页开关能真正隐藏并恢复磁贴（UX-12）', hiddenByUi && restoredByUi,
      `关闭后隐藏=${hiddenByUi}，再开启后出现=${restoredByUi}`);
  } else {
    check('[42] 设置页开关能真正隐藏并恢复磁贴（UX-12）', false, '设置页缺少 showQuickAddToggle');
  }
  await page.click('#settingsClose');
  await sleep(500);

  /* ---- [30][31] 搜索输入：网址直跳与输入法回车（UX-03 / UX-04）----
     放在最后：命中网址时页面会真的导航离开，后续断言不再依赖本页状态。
     导航目标用固定响应接住并记录，避免打真实外网（与 MOCK_* 的既定做法一致）。 */
  const homeUrl = page.url();
  const navTargets = [];
  const catchNav = r => { navTargets.push(r.request().url()); return r.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>mock</body></html>' }); };
  await page.route(/^https?:\/\/(www\.)?(google|baidu|bing)\.com\//, catchNav);
  await page.route(/^https?:\/\/(www\.)?github\.com/, catchNav);

  // [31] 输入法合成中的回车是"确认候选词"，不得触发搜索
  await page.fill('#searchInput', '天气预报');
  const beforeIme = navTargets.length;
  await page.evaluate(() => document.getElementById('searchInput')
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
  await sleep(900);
  check('[31] 输入法合成中按 Enter 不触发搜索（UX-04）', navTargets.length === beforeIme,
    navTargets.length > beforeIme ? `误触发导航到 ${navTargets[navTargets.length - 1]}` : '未触发');
  // 上一条若失败，说明页面已经误导航离开，必须先回到主页：
  // 否则下面的 page.press 找不到搜索框，失败会表现为脚本超时崩溃而不是断言变红
  if (navTargets.length > beforeIme) {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
  }
  // 对照组：没有它，"不触发"在搜索功能整体失效时同样是绿的（无区分度断言）
  await page.press('#searchInput', 'Enter');
  await sleep(900);
  check('[31] 对照：正常 Enter 仍能触发搜索', navTargets.length > beforeIme,
    navTargets.length > beforeIme ? `已导航到 ${navTargets[navTargets.length - 1]}` : '正常回车也未能触发，说明上一条断言是假绿');

  // [30] 网址直跳：输入 github.com 应打开该网站，而不是把它当搜索词
  await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const beforeUrl = navTargets.length;
  await page.fill('#searchInput', 'github.com');
  await page.press('#searchInput', 'Enter');
  await sleep(1200);
  const jumpTarget = navTargets.length > beforeUrl ? navTargets[navTargets.length - 1] : '';
  check('[30] 输入 github.com 直接打开该网站（UX-03）', /^https:\/\/(www\.)?github\.com\/?$/.test(jumpTarget),
    jumpTarget || '(未发生导航)');

  // [30] 对照：普通查询词仍走搜索（防止"什么都直跳"的过度修复）
  await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const beforeQuery = navTargets.length;
  await page.fill('#searchInput', '如何学习 css');
  await page.press('#searchInput', 'Enter');
  await sleep(1200);
  const queryTarget = navTargets.length > beforeQuery ? navTargets[navTargets.length - 1] : '';
  check('[30] 对照：普通查询词仍走搜索而非直跳', /\/search\?|\/s\?wd=/.test(queryTarget),
    queryTarget || '(未发生导航)');

  /* ---- [41] 快捷键（UX-15）---- */
  await page.route(/keytest\.example/, catchNav);
  await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.evaluate(async () => {
    await Storage.importData(JSON.stringify({ schemaVersion: 1,
      bookmarks: [
        { id: 'k1', title: '第一个', url: 'https://keytest.example/', sortOrder: 0 },
        { id: 'k2', title: '第二个', url: 'https://second.example/', sortOrder: 1 }
      ], categories: [], todos: [] }));
    await App.renderBookmarks();
    await new Promise(r => setTimeout(r, 400));
  });
  const navBeforeTyping = navTargets.length;
  await page.click('#searchInput');
  await page.keyboard.type('123');
  const typed = await page.evaluate(() => document.getElementById('searchInput').value);
  check('[41] 搜索框聚焦时数字键正常输入、不触发跳转（UX-15）',
    typed === '123' && navTargets.length === navBeforeTyping,
    `输入框值="${typed}"，新增导航 ${navTargets.length - navBeforeTyping} 次`);

  // 失焦后数字键才打开第 N 个书签。
  // 新标签页默认 autofocus 在搜索框上，所以"打开即按数字键"确实是输入而非跳转——
  // 这是有意的取舍：宁可少一个快捷键，也不劫持用户正在输入的字符。
  await page.evaluate(() => {
    const el = document.getElementById('searchInput');
    el.value = '';
    el.blur();
  });
  const beforeKey = navTargets.length;
  await page.keyboard.press('1');
  await sleep(1200);
  const keyTarget = navTargets.length > beforeKey ? navTargets[navTargets.length - 1] : '';
  check('[41] 失焦后数字键 1 打开第 1 个书签（UX-15）', /keytest\.example/.test(keyTarget),
    keyTarget || '(未发生导航)');

  // ? 弹出快捷键速查（同样要求非输入态）。
  // 上一步的数字键已经导航离开主页，这里必须先回主页再失焦搜索框。
  await page.goto(homeUrl, { waitUntil: 'domcontentloaded' });
  await sleep(2200);
  await page.evaluate(() => {
    const el = document.getElementById('searchInput');
    if (el) el.blur();
  });
  await page.keyboard.press('?');
  await sleep(600);
  const helpText = await page.evaluate(() => {
    const el = document.querySelector('#toastRoot .toast');
    return el ? el.innerText : '';
  });
  check('[41] ? 弹出快捷键速查（UX-15）', /快捷键/.test(helpText) && /1-9/.test(helpText),
    `提示="${helpText}"`);

  /* ---- [46] 每日一图缓存策略 ----
     要证明的不是"能取到图"，而是"取不到时显示什么"只取决于历史上有没有成功过：
       ① 从未成功 + 离线            → 内置默认图，且不写缓存
       ② 有上次成功的图 + 离线      → 继续显示那张，不回退默认图
       ③ 有上次成功的图 + 接口失败  → 仍然显示那张，缓存不被清空
       ④ 联网成功                  → 换成当天图，缓存只留当天那一条（旧字段被清）
       ⑤ 旧版本字段                → 迁移成新结构，不丢当天的图
     把 resolveDailyWallpaper 改成恒返回默认图、或把 catch 分支改回"清空背景 + 预设渐变"，
     ②③ 会立刻红灯。 */
  const dailyIndex = await page.evaluate(() =>
    Wallpaper.getWallpapers().findIndex(w => w.name === 'Bing 每日壁纸'));
  const todayInPage = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const ydayInPage = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const setOnline = (v) => page.evaluate((v) => {
    // navigator.onLine 是原型上的 accessor，实例上覆盖即可（configurable 保证可还原）
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => v });
  }, v);
  const applyDailyBing = (cache) => page.evaluate(async ({ cache, idx }) => {
    await Storage.updateSettings(Object.assign({ wallpaperName: 'Bing 每日壁纸' }, cache));
    await Wallpaper.apply(idx);
    await new Promise(r => setTimeout(r, 400));
    const s = await Storage.getSettings();
    return {
      bg: document.getElementById('bgLayer').style.backgroundImage || '',
      // 浅色主题按这个类型决定纱罩强度：默认图（石墨）要退成纸面
      type: document.documentElement.dataset.wallpaperType,
      daily: s.wallpaperDaily,
      legacy: s.wallpaperApiCache
    };
  }, { cache, idx: dailyIndex });

  // ① 首次安装 + 断网：只能给内置默认图，并且不许凭空写一条缓存
  await setOnline(false);
  const firstOffline = await applyDailyBing({ wallpaperDaily: null, wallpaperApiCache: null });
  check('[46] 从未成功获取 + 断网 → 显示内置默认图',
    /wallpaper-default\.svg/.test(firstOffline.bg), firstOffline.bg.slice(0, 90) || '(空背景)');
  check('[46] 断网时不发起请求也不写缓存',
    firstOffline.daily === null, JSON.stringify(firstOffline.daily));
  check('[46] 内置默认图标记为 default（浅色主题据此加重纱罩，避免透成中灰）',
    firstOffline.type === 'default', `type=${firstOffline.type}`);

  // ② 有昨天成功取到的图 + 断网：继续显示那张，绝不回退默认图
  const cachedYesterday = { v: 1, date: ydayInPage, url: 'https://cn.bing.com/th?id=OHR.CachedYesterday' };
  await page.evaluate(async (c) => { await Storage.updateSettings({ wallpaperDaily: c }); }, cachedYesterday);
  const offlineWithLast = await applyDailyBing({});
  check('[46] 断网但历史上成功过 → 继续显示最后一张每日图',
    /OHR\.CachedYesterday/.test(offlineWithLast.bg), offlineWithLast.bg.slice(0, 90));
  check('[46] 断网期间缓存保持不变',
    offlineWithLast.daily && offlineWithLast.daily.date === ydayInPage,
    JSON.stringify(offlineWithLast.daily));

  // ③ 联网但接口失败：同样保留上一张，而不是清空背景或退回默认图
  await setOnline(true);
  bingApiMode = 'fail';
  const fetchFailed = await applyDailyBing({});
  check('[46] 当天获取失败 → 保留最后一张每日图（不回退默认图）',
    /OHR\.CachedYesterday/.test(fetchFailed.bg), fetchFailed.bg.slice(0, 90));
  check('[46] 获取失败不破坏已有缓存',
    fetchFailed.daily && fetchFailed.daily.date === ydayInPage,
    JSON.stringify(fetchFailed.daily));

  // ④ 联网且成功：换成当天图，并整体替换成只含当天的记录
  bingApiMode = 'ok';
  const fetchedToday = await applyDailyBing({ wallpaperDaily: null, wallpaperApiCache: null });
  check('[46] 联网成功 → 显示当天新图',
    /OHR\.MockWallpaper/.test(fetchedToday.bg), fetchedToday.bg.slice(0, 90));
  check('[46] 成功后写入当天记录',
    fetchedToday.daily && fetchedToday.daily.date === todayInPage
      && /OHR\.MockWallpaper/.test(fetchedToday.daily.url),
    JSON.stringify(fetchedToday.daily));
  check('[46] 缓存只保留当天一张（不累积历史）',
    fetchedToday.daily && Object.keys(fetchedToday.daily).sort().join(',') === 'date,url,v',
    `字段=${fetchedToday.daily ? Object.keys(fetchedToday.daily).join(',') : '(空)'}`);

  // ⑤ 升级迁移：旧字段里的当天图要接过来，并清掉旧键
  const legacyMigrated = await applyDailyBing({
    wallpaperDaily: null,
    wallpaperApiCache: { type: 'bing', date: todayInPage, url: 'https://cn.bing.com/th?id=OHR.LegacyMigrated' }
  });
  check('[46] 旧版本 wallpaperApiCache 迁移后继续生效',
    /OHR\.LegacyMigrated/.test(legacyMigrated.bg), legacyMigrated.bg.slice(0, 90));
  check('[46] 迁移后旧字段被清空（不残留两份「最后一张图」）',
    legacyMigrated.legacy === null && legacyMigrated.daily && legacyMigrated.daily.date === todayInPage,
    `legacy=${JSON.stringify(legacyMigrated.legacy)}`);

  // 还原环境，避免影响后续用例（在线状态与壁纸源都不该被这条用例改掉）
  await setOnline(true);
  bingApiMode = 'ok';
  await page.evaluate(async () => {
    await Storage.updateSettings({ wallpaperName: '深邃星空', theme: 'dark' });
    await Wallpaper.apply(0);
  });

  /* ---- [47] 只有深色：背景与材质都不再分主题（2.0.0）----
     浅色主题下线后，样式表里不应该再有任何 [data-theme="light"] 规则
     （残留规则不会生效，但会误导后续维护者以为还有第二条渲染路径）。
     同时锁住背景侧的结论：照片档不套滤镜、预设档只有深色渐变、
     往存储里写浅色也改不动 data-theme。 */
  const darkOnly = await page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));

    // ① 样式表里是否还有浅色规则（递归扫 @media）
    let sheets = 0, lightRules = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = [...sheet.cssRules]; } catch { continue; } // 跨域表跳过
      sheets++;
      const scan = list => list.forEach(r => {
        if (r.cssText && r.cssText.includes('data-theme="light"')) lightRules.push(r.cssText.slice(0, 80));
        if (r.cssRules) scan([...r.cssRules]);
      });
      scan(rules);
    }

    const layer = document.getElementById('bgLayer');
    // ② 预设档：只有深色渐变，且不套滤镜
    await Storage.updateSettings({ wallpaperName: '深邃星空' });
    await Wallpaper.apply(Wallpaper.getWallpapers().findIndex(w => w.name === '深邃星空'));
    await wait(400);
    const preset = {
      bg: getComputedStyle(layer).backgroundImage,
      filter: getComputedStyle(layer).filter
    };

    // ③ 照片档：原样（无滤镜）；同时写入 theme:'light' 验证会被归一
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await Storage.updateSettings({
      wallpaperName: 'Bing 每日壁纸', theme: 'light',
      wallpaperApiCache: null,
      wallpaperDaily: { v: 1, date: today, url: 'https://cn.bing.com/th?id=OHR.DarkOnlyTest' }
    });
    await Wallpaper.apply(Wallpaper.getWallpapers().findIndex(w => w.name === 'Bing 每日壁纸'));
    await wait(400);
    const photo = {
      filter: getComputedStyle(layer).filter,
      url: layer.style.backgroundImage,
      theme: document.documentElement.dataset.theme,
      veil: getComputedStyle(layer, '::after').backgroundColor
    };

    // ④ 材质：深色表面仍是石墨近实心、无模糊
    const card = getComputedStyle(document.querySelector('.todo-card') || document.querySelector('.category-card'));
    return { sheets, lightRules, preset, photo, card: { bg: card.backgroundColor, blur: card.backdropFilter } };
  });

  check('[47] 样式表里已无浅色规则残留（浅色主题彻底下线）',
    darkOnly.sheets > 0 && darkOnly.lightRules.length === 0,
    darkOnly.lightRules.length ? darkOnly.lightRules.slice(0, 3).join(' | ') : `已扫描 ${darkOnly.sheets} 张样式表`);
  check('[47] 预设壁纸只有深色渐变（无浅色版）',
    /rgb\(11, 13, 18\)/.test(darkOnly.preset.bg), darkOnly.preset.bg.slice(0, 90));
  check('[47] 预设档不套滤镜（渐变原样）',
    !darkOnly.preset.filter || darkOnly.preset.filter === 'none', darkOnly.preset.filter);
  check('[47] 照片档不套滤镜（照片原样清晰）',
    !darkOnly.photo.filter || darkOnly.photo.filter === 'none', darkOnly.photo.filter);
  check('[47] 照片壁纸正常挂到背景层',
    /^url\(/.test(darkOnly.photo.url) && /OHR\.DarkOnlyTest/.test(darkOnly.photo.url),
    darkOnly.photo.url.slice(-60));
  check('[47] 往存储写浅色也改不动 data-theme（归一为 dark）',
    darkOnly.photo.theme === 'dark', `data-theme=${darkOnly.photo.theme}`);
  check('[47] 深色材质未被带偏（石墨近实心、无模糊）',
    /rgba\(24, 27, 33, 0\.94\)/.test(darkOnly.card.bg) && (!darkOnly.card.blur || darkOnly.card.blur === 'none'),
    JSON.stringify(darkOnly.card));

  // 还原：后面的用例与退出都按深色 + 默认预设断言
  await page.evaluate(async () => {
    await Storage.updateSettings({ wallpaperName: '深邃星空', theme: 'dark', wallpaperDaily: null, wallpaperApiCache: null });
    await Wallpaper.apply(0);
  });

  return { consoleErrors, pageErrors, requests };
}

/* ---- file:// 预览模式（US-20 行为验证） ---- */
async function runFileMode() {
  const browser = await chromium.launch(headlessLaunchOpts());
  const page = await browser.newPage();
  const fileUrl = 'file://' + path.join(EXT_PATH, 'index.html');
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  check('[F1] file:// 渲染', await page.locator('.bookmark-item:not([data-quick-add])').count() === 8);
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
    // 用显式 context：[24] 跨标签页同步断言需要再开一个 page，
    // 而 browser.newPage() 产生的隐式 context 不允许再新建页面
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
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
