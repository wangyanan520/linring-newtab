/* ---- 预设渐变壁纸（3 套） ---- */
const WALLPAPERS = [
  {
    name: '深邃星空',
    type: 'preset',
    themeHint: 'dark',
    css: `
      radial-gradient(ellipse 68% 52% at 16% 18%, rgba(74, 99, 212, 0.20) 0%, transparent 62%),
      radial-gradient(ellipse 56% 46% at 84% 14%, rgba(126, 148, 232, 0.10) 0%, transparent 58%),
      radial-gradient(ellipse 78% 58% at 50% 82%, rgba(52, 66, 104, 0.16) 0%, transparent 54%),
      linear-gradient(135deg, #0b0d12 0%, #111520 34%, #0c0f17 66%, #08090d 100%)
    `,
    colors: {
      accent: 'rgba(126, 148, 232, 0.8)',
      accentLight: 'rgba(147, 169, 255, 0.4)',
      accentGlow: 'rgba(126, 148, 232, 0.14)',
      accentBorder: 'rgba(126, 148, 232, 0.12)'
    }
  },
  {
    name: '极光绿',
    type: 'preset',
    themeHint: 'dark',
    css: `
      radial-gradient(ellipse 68% 52% at 20% 28%, rgba(0, 168, 118, 0.15) 0%, transparent 62%),
      radial-gradient(ellipse 56% 46% at 80% 18%, rgba(30, 190, 152, 0.09) 0%, transparent 58%),
      radial-gradient(ellipse 78% 58% at 50% 82%, rgba(20, 92, 74, 0.12) 0%, transparent 54%),
      linear-gradient(135deg, #0a100e 0%, #0d1713 34%, #0a1210 66%, #070b09 100%)
    `,
    colors: {
      accent: 'rgba(0, 200, 140, 0.8)',
      accentLight: 'rgba(80, 220, 180, 0.4)',
      accentGlow: 'rgba(0, 200, 140, 0.15)',
      accentBorder: 'rgba(0, 200, 140, 0.12)'
    }
  },
  {
    name: '落日暖阳',
    type: 'preset',
    themeHint: 'dark',
    css: `
      radial-gradient(ellipse 68% 52% at 25% 28%, rgba(214, 96, 38, 0.17) 0%, transparent 62%),
      radial-gradient(ellipse 56% 46% at 76% 18%, rgba(196, 118, 24, 0.10) 0%, transparent 58%),
      radial-gradient(ellipse 78% 58% at 50% 82%, rgba(150, 52, 26, 0.10) 0%, transparent 54%),
      linear-gradient(135deg, #120c09 0%, #18100b 34%, #110c09 66%, #0a0705 100%)
    `,
    colors: {
      accent: 'rgba(220, 130, 50, 0.8)',
      accentLight: 'rgba(240, 180, 100, 0.4)',
      accentGlow: 'rgba(220, 130, 50, 0.15)',
      accentBorder: 'rgba(220, 130, 50, 0.12)'
    }
  },
  /* ---- API 在线壁纸 ---- */
  {
    name: 'Bing 每日壁纸',
    type: 'api',
    themeHint: null,
    apiType: 'bing',
    colors: {
      accent: 'rgba(255, 255, 255, 0.45)',
      accentLight: 'rgba(255, 255, 255, 0.20)',
      accentGlow: 'rgba(255, 255, 255, 0.06)',
      accentBorder: 'rgba(255, 255, 255, 0.05)'
    }
  },
  {
    name: '随机壁纸',
    type: 'api',
    themeHint: null,
    apiType: 'random',
    colors: {
      accent: 'rgba(255, 255, 255, 0.45)',
      accentLight: 'rgba(255, 255, 255, 0.20)',
      accentGlow: 'rgba(255, 255, 255, 0.06)',
      accentBorder: 'rgba(255, 255, 255, 0.05)'
    }
  }
];

/* ---- API 壁纸工具函数 ---- */
/* ---- Bing 每日壁纸：用 urlbase 拼接 1920x1080 高清图 ---- */
const BING_API = 'https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN';

async function fetchBingUrl() {
  // P3-7：接口无超时，cn.bing.com 卡住时 apply() 会一直悬停，背景先被置空而永远回不来
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(BING_API, { signal: controller.signal });
    if (!resp.ok) throw new Error('Bing API error');
    const data = await resp.json();
    const img = data.images && data.images[0];
    // urlbase 缺失时会拼出 https://cn.bing.comundefined_1920x1080.jpg 这类无效地址，
    // 而 CSS 背景加载失败是静默的（catch 不到），用户只会看到无图背景（P3-7）
    if (!img || typeof img.urlbase !== 'string' || !img.urlbase.startsWith('/')) {
      throw new Error('Bing API 返回的 urlbase 不可用');
    }
    /* 用 urlbase 拼接 1920x1080 高清图，比 url 字段的图片更清晰 */
    return {
      url: 'https://cn.bing.com' + img.urlbase + '_1920x1080.jpg',
      // copyright 形如「美国·古拉悬崖民居 © Chiara Salvadori/Getty Images」，
      // 缺失或非字符串时按无版权处理（不因为署名缺失就丢弃整张图）
      credit: typeof img.copyright === 'string' ? img.copyright.trim() : ''
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ---- 随机壁纸：bing.biturl.top 返回随机 Bing 壁纸 ---- */
function getRandomWallpaperUrl() {
  /* 加时间戳防浏览器缓存 */
  return 'https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN&_=' + Date.now();
}

async function fetchApiWallpaperUrl(apiType) {
  switch (apiType) {
    case 'bing': return fetchBingUrl();
    case 'random': return getRandomWallpaperUrl();
    default: throw new Error('Unknown apiType: ' + apiType);
  }
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ==========================================================================
   每日一图：内置默认图 + 本地缓存
   --------------------------------------------------------------------------
   要解决的问题：Bing 每日图是「一天一张，且随时可能取不到」的远程资源。
   取不到时该显示什么，取决于历史上有没有成功过，而不是取决于这一次的返回。

   缓存只存一条记录（date + url），语义是「最后一张成功获取的每日图」：

     cache.date === 今天  → 当天新图（today）：联网取到之后优先显示这张
     cache.date <  今天  → 最后成功的图（last）：断网 / 当天获取失败时继续显示它
     没有合法记录          → 内置默认图（default）：只有「从未成功获取过」才走到这里

   三个必须守住的不变量（对应单元测试里的同名断言）：
     1. 任何失败都不得清空 last —— 否则断网白屏或退回默认图，等于丢掉用户已有的图。
     2. 成功一次之后，物理上只剩「默认图（内置资源）+ 当天图（URL）」，不累积历史。
     3. 记录来自 storage，可能被旧版本/导入/手工改坏，读入必须过白名单校验。
   ========================================================================== */

/* 内置默认图：打包在扩展里，离线可用，不含第三方版权素材 */
const DEFAULT_DAILY_IMAGE = 'images/wallpaper-default.svg';
const DAILY_CACHE_VERSION = 1;
/* 远程图地址上限：正常 Bing 地址 < 300 字符，这里只用于挡住异常超长串 */
const DAILY_URL_MAX_LENGTH = 2048;

function isValidDateStr(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // 用 UTC 归一化反查，挡掉 2026-02-31 这类「格式对但不存在」的日期
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/* 图片地址白名单。值最终会拼进 CSS 的 url()，只做长度和协议检查不够：
   带引号/右括号的串能截断这条声明并注入后续 CSS，所以一并禁掉。
   只放行 http(s)，data:/javascript:/blob: 一律拒绝（内置默认图走常量，不经此处）。 */
function isSafeImageUrl(url) {
  if (typeof url !== 'string') return false;
  if (url.length === 0 || url.length > DAILY_URL_MAX_LENGTH) return false;
  if (/[\s"'()\\<>`]/.test(url)) return false;
  return /^https?:\/\/[^\s]+$/i.test(url);
}

/* 读入即校验：返回 null 表示这份缓存不可用（调用方按「没有缓存」处理） */
function normalizeDailyCache(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.v !== DAILY_CACHE_VERSION) return null;
  if (!isValidDateStr(raw.date)) return null;
  if (!isSafeImageUrl(raw.url)) return null;
  // 只保留已知字段，丢掉历史遗留/被塞进来的额外键。
  // credit 是 2.1.0 追加的可选字段：老记录没有它，按"无署名"处理而不是判整条缓存无效
  const credit = typeof raw.credit === 'string' ? raw.credit.trim() : '';
  const out = { v: DAILY_CACHE_VERSION, date: raw.date, url: raw.url };
  // 没有署名就不写这个键：缓存形状与 1.x 完全一致，旧记录读进来不会被"补齐"成空字段
  if (credit && credit.length <= 160 && !/[\u0000-\u001f]/.test(credit)) out.credit = credit;
  return out;
}

/* 三态解析：纯函数，不读 storage、不碰网络 —— 单测直接覆盖这张决策表 */
function resolveDailyWallpaper(cache, today) {
  const record = normalizeDailyCache(cache);
  if (!record) {
    return { url: DEFAULT_DAILY_IMAGE, source: 'default', date: null, credit: '' };
  }
  const isToday = record.date === today;
  return {
    url: record.url,
    source: isToday ? 'today' : 'last',
    date: record.date,
    credit: record.credit || ''
  };
}

/* 获取成功后的新缓存：整体替换，旧记录不保留（不变量 2）。
   若传入的 url/date 不合法，返回原记录而不是 null —— 宁可留着上一张，
   也不要把「这次数据奇怪」变成「把用户的图删了」。 */
function buildDailyCache(url, today, previous = null, credit = '') {
  const prev = normalizeDailyCache(previous);
  if (!isSafeImageUrl(url) || !isValidDateStr(today)) return prev;
  return normalizeDailyCache({ v: DAILY_CACHE_VERSION, date: today, url, credit }) || prev;
}

/* 联网时的清理：把用不了的东西剔掉，但绝不因为「不是今天」就删 last。
   返回 removed 便于测试与日志；online=false 时不做任何删除（断网时那张图是唯一资产）。 */
function pruneDailyCache(cache, today, { online = true } = {}) {
  const removed = [];
  if (!cache) return { cache: null, removed };
  const record = normalizeDailyCache(cache);
  if (!record) {
    removed.push('invalid');
    return { cache: null, removed };
  }
  // 记录比「今天」还新：时钟回拨或数据写坏，在线时丢弃并允许重新获取；
  // 离线时保留 —— 它仍是张能显示的图，好过默认图。
  if (online && isValidDateStr(today) && record.date > today) {
    removed.push('future-date');
    return { cache: null, removed };
  }
  return { cache: record, removed };
}

/* 旧版本把结果写进 settings.wallpaperApiCache（{type,date,url}）。
   升级后首次启动把它迁过来，用户不会因为换了个字段就丢一次当天的图。 */
function migrateLegacyDailyCache(legacy) {
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return null;
  if (legacy.type !== 'bing') return null;
  return normalizeDailyCache({ v: DAILY_CACHE_VERSION, date: legacy.date, url: legacy.url });
}

/* UX-13：把采样到的相对亮度折算成主题提示。
   阈值 0.55 取得偏保守——宁可判成 dark（白字压深底）也不要误判成 light，
   因为深底白字在偏亮壁纸上只是对比度下降，而亮底白字是直接看不见。 */
function brightnessToThemeHint(luminance, threshold = 0.55) {
  if (typeof luminance !== 'number' || !Number.isFinite(luminance)) return null;
  return luminance >= threshold ? 'light' : 'dark';
}

/* 平均相对亮度：把 8×8 降采样后的像素按 sRGB 系数加权。
   与 brightnessToThemeHint 的阈值配套；纯函数便于单测覆盖。 */
function averageLuminance(data) {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.2126 * (data[i] / 255) + 0.7152 * (data[i + 1] / 255) + 0.0722 * (data[i + 2] / 255);
    n++;
  }
  return n ? sum / n : null;
}

/* 采样通道一：<img crossOrigin> + canvas。
   图片加载不受扩展 host_permissions 限制，只要服务端返回 CORS 头
   （Access-Control-Allow-Origin），canvas 就不会被污染。
   实测（2026-10-17）：随机壁纸源 307 → www.bing.com/th 与 cn.bing.com/th
   均返回 ACAO: *，因此随机源无需新增 host 权限也能采样（ADV-05）。
   失败（无 CORS 头 / 加载失败）返回 null，由 fetch 通道兜底。 */
function sampleByImage(url) {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // 必须在 src 之前设置
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = 8;
        cv.height = 8;
        const cx = cv.getContext('2d');
        cx.drawImage(img, 0, 0, 8, 8);
        resolve(averageLuminance(cx.getImageData(0, 0, 8, 8).data));
      } catch {
        resolve(null); // canvas 被污染（服务端未发 CORS 头）
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/* 采样通道二：fetch → blob → ImageBitmap。
   适用于扩展持有 host_permissions 的域（如 cn.bing.com）——即使服务端不发
   CORS 头也能取到响应；但 fetch 对无 host 权限的域必然失败（ADV-05 的根因）。 */
async function sampleByFetch(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = 8;
    cv.height = 8;
    const cx = cv.getContext('2d');
    cx.drawImage(bitmap, 0, 0, 8, 8);
    if (typeof bitmap.close === 'function') bitmap.close();
    return averageLuminance(cx.getImageData(0, 0, 8, 8).data);
  } catch {
    return null;
  }
}

/* 对在线壁纸做明度采样：降采样到 8×8 后取平均相对亮度（0-1）。
   为什么用 <img crossOrigin> 优先：Canvas 的跨域规则只认 CORS 头，不认扩展权限；
   而 fetch 在扩展页严格受 host_permissions 约束。随机壁纸源不在 manifest 的
   6 个域名里，旧实现 fetch 必失败，于是 auto 主题对该源永远落 dark。
   两条通道互补：img 覆盖"公开且有 CORS 头"的图片，fetch 覆盖"有 host 权限
   但服务端不发 CORS 头"的图片。任何一步失败都返回 null，由调用方回退静态 hint。 */
async function sampleImageBrightness(url) {
  const viaImage = await sampleByImage(url);
  if (viaImage != null) return viaImage;
  return sampleByFetch(url);
}

/* ---- 壁纸管理器 ---- */
const Wallpaper = {
  currentIndex: 0,

  async init() {
    const settings = await Storage.getSettings();
    if (settings.wallpaperName) {
      const idx = WALLPAPERS.findIndex(w => w.name === settings.wallpaperName);
      if (idx !== -1) this.currentIndex = idx;
    }
    // 网络状态监听只装一次；断网/恢复由 onNetworkChange 决定要不要补取
    this.bindNetworkEvents();
    // 联网时先清一次过期数据（不 await：启动路径上不该被存储读写拖住）
    if (this.isOnline()) this.cleanupDailyCache({ online: true }).catch(() => {});
    await this.apply(this.currentIndex);
  },

  getWallpapers() {
    return WALLPAPERS;
  },

  /* UX-02：把"壁纸本身的明暗"作为独立属性写到 <html> 上，
     让保底层强度由 CSS 按「主题 × 壁纸明度」两个属性共同决定
     （见 main.css 的 .bg-layer::after 规则组）。
     为什么不在 JS 里算好覆盖色：主题还与"跟随壁纸/手动选择"有关，
     在 JS 里同时维护两边会引出一堆时序问题；声明式交给 CSS 更稳。 */
  setWallpaperTone(tone) {
    document.documentElement.dataset.wallpaperTone = tone === 'light' ? 'light' : 'dark';
  },

  /* 壁纸种类写到 <html> 上，供样式表按来源区分处理
     （如内置默认图与照片在降级路径上不同）。 */
  setWallpaperType(type) {
    // preset：预设渐变 · api：远程照片 · default：内置默认图（石墨材质，属于深色主题）
    const known = type === 'api' || type === 'default' ? type : 'preset';
    document.documentElement.dataset.wallpaperType = known;
  },

  /* 预设壁纸只有一套深色渐变（2.0.0 起不再区分主题）。 */
  presetCss(wallpaper) {
    return wallpaper && wallpaper.css ? wallpaper.css : null;
  },

  applyColors(colors) {
    const root = document.documentElement;
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--accent-light', colors.accentLight);
    root.style.setProperty('--accent-glow', colors.accentGlow);
    root.style.setProperty('--accent-border', colors.accentBorder);
  },

  clearBgImage(bgLayer) {
    bgLayer.style.backgroundImage = '';
    bgLayer.style.backgroundSize = '';
    bgLayer.style.backgroundPosition = '';
  },

  /* 壁纸署名（2.1.0）：Bing 图的版权行只在"当前显示的是远程照片"时出现，
     预设渐变与内置默认图都不是第三方素材，不该挂署名。 */
  setWallCredit(text) {
    const el = document.getElementById('wallCredit');
    if (!el) return;
    if (!text) {
      el.textContent = '';
      el.classList.remove('visible');
      return;
    }
    el.textContent = `Bing 每日一图 · ${text}`;
    el.classList.add('visible');
  },

  setBgImage(bgLayer, url) {
    bgLayer.style.background = 'none';
    bgLayer.style.backgroundImage = `url(${url})`;
    bgLayer.style.backgroundSize = 'cover';
    bgLayer.style.backgroundPosition = 'center';
  },

  async apply(index) {
    const wallpaper = WALLPAPERS[index];
    const bgLayer = document.getElementById('bgLayer');
    if (!bgLayer) return;

    // P3-6：记录本次应用的代次。API 壁纸要经历网络往返，若期间用户又切换了壁纸，
    // 迟到的响应不应把后发的选择覆盖掉（否则屏幕显示与存储的 wallpaperName 会不一致）
    const gen = (this._applyGen = (this._applyGen || 0) + 1);

    this.currentIndex = index;
    this.applyColors(wallpaper.colors);
    // UX-02：先把壁纸明暗告诉 CSS（预设直接读 themeHint，在线壁纸等采样结果再修正）
    this.setWallpaperTone(wallpaper.themeHint);
    this.setWallpaperType(wallpaper.type);
    // PBI-10：主题处于"跟随壁纸"模式时按当前壁纸明度同步（异步读取设置，不阻塞渲染）
    this.syncToneFromImage();

    /* 预设渐变用 15% 淡覆盖，API 壁纸用 35% 深覆盖保证内容可读 */
    if (wallpaper.type === 'preset') {
      document.documentElement.style.setProperty('--bg-overlay-opacity', '0.15');
      this.clearBgImage(bgLayer);
      bgLayer.style.background = this.presetCss(wallpaper);
      this.setWallCredit('');
      return;
    }

    document.documentElement.style.setProperty('--bg-overlay-opacity', '0.35');

    // API 壁纸
    bgLayer.style.background = 'none';

    if (wallpaper.apiType === 'random') {
      // ADV-05：随机源此前直接 return，auto 主题永远落 dark；
      // 现在与 Bing 一样，拿到图片地址后做一次明度采样
      const randomUrl = getRandomWallpaperUrl();
      this.setBgImage(bgLayer, randomUrl);
      this.setWallCredit('');
      this.syncToneFromImage(randomUrl);
      return;
    }

    /* Bing 每日壁纸：先把本地已有那张画出来，再在联网时后台换成当天的。
       顺序不能反——先取后画的话，接口慢或断网时首屏就是空的。 */
    const today = todayStr();
    const cached = await this.loadDailyCache();
    if (gen !== this._applyGen) return; // 读取设置期间已被取代

    const resolved = resolveDailyWallpaper(cached, today);
    // 内置默认图是石墨材质：浅色主题下要让纱罩更厚，否则会透成一片中灰
    this.setWallpaperType(resolved.source === 'default' ? 'default' : 'api');
    this.setBgImage(bgLayer, resolved.url);
    this.setWallCredit(resolved.source === 'default' ? '' : resolved.credit);
    // UX-13：图先上屏，明度采样随后（不 await，采样只做附加修正）
    this.syncToneFromImage(resolved.url);

    // 当天图已经在本地：不打扰接口，顺手清一次过期数据就收工
    if (resolved.source === 'today') {
      if (this.isOnline()) this.cleanupDailyCache({ online: true }).catch(() => {});
      return;
    }

    // 离线：停在 last / default。不发请求、不改缓存 —— 屏幕上这张仍是有效图
    if (!this.isOnline()) return;

    try {
      const fetched = await this.fetchDailyOnce();
      if (gen !== this._applyGen) return; // 用户已切到别的壁纸，丢弃迟到结果（也不写缓存）
      const next = buildDailyCache(fetched && fetched.url, today, cached, fetched && fetched.credit);
      // 接口给了非法地址：不动缓存也不动画面，继续显示本地那张
      if (!next) return;
      await this.persistDailyCache(next);
      if (gen !== this._applyGen) return; // 写缓存期间又被取代
      this.setBgImage(bgLayer, next.url);
      this.setWallCredit(next.credit);
      this.syncToneFromImage(next.url);
    } catch (e) {
      if (gen !== this._applyGen) return;
      /* 关键行为变更：这里不清空背景、也不回退到预设渐变。
         屏幕上仍是 resolved（当天图 / 最后成功的图 / 默认图），
         只有在「从未成功获取过」时它才是默认图。 */
      console.warn('每日图获取失败，继续显示本地已有图片:', e && e.message ? e.message : e);
    }
  },

  /* ---- 每日图缓存读写 ---- */

  /* 读缓存，必要时从旧字段 wallpaperApiCache 迁移一次。
     读失败不抛：返回 null 即「按没有缓存处理」，走默认图，不阻塞壁纸渲染。 */
  async loadDailyCache() {
    try {
      const settings = await Storage.getSettings();
      const existing = normalizeDailyCache(settings.wallpaperDaily);
      if (existing) return existing;
      const migrated = migrateLegacyDailyCache(settings.wallpaperApiCache);
      if (migrated) {
        await this.persistDailyCache(migrated);
        return migrated;
      }
      return null;
    } catch (e) {
      console.error('读取每日图缓存失败:', e);
      return null;
    }
  },

  /* 写入 = 整体替换。顺带把旧字段置空，升级后不会残留两份「最后一张图」。
     写失败只记日志：配额满/后端异常不该连带把画面弄坏。 */
  async persistDailyCache(record) {
    try {
      await Storage.updateSettings({ wallpaperDaily: record, wallpaperApiCache: null });
      this._dailyCache = record;
      return true;
    } catch (e) {
      console.error('写入每日图缓存失败:', e);
      return false;
    }
  },

  /* 联网清理：剔掉不可用/未来日期的记录与旧字段，但保留「最后成功的图」。
     online=false 时 prune 不删任何东西（断网时那张图是唯一资产）。 */
  async cleanupDailyCache({ online = true } = {}) {
    let settings;
    try {
      settings = await Storage.getSettings();
    } catch (e) {
      console.error('清理每日图缓存失败:', e);
      return { cache: null, removed: [] };
    }
    const { cache, removed } = pruneDailyCache(settings.wallpaperDaily, todayStr(), { online });
    const patch = {};
    if (!cache && settings.wallpaperDaily) patch.wallpaperDaily = null;
    if (settings.wallpaperApiCache) patch.wallpaperApiCache = null;
    if (Object.keys(patch).length) {
      try {
        await Storage.updateSettings(patch);
      } catch (e) {
        console.error('写入清理结果失败:', e);
      }
    }
    if (removed.length) console.info('已清理每日图缓存:', removed.join(','));
    return { cache, removed };
  },

  isOnline() {
    // 无 navigator 的环境（Node 单测）按在线处理，逻辑分支由纯函数覆盖
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  },

  /* 单飞：apply 与 online 事件可能同时触发，重复请求会让接口被打两次、
     两次响应还会互相覆盖缓存。同一个 in-flight 请求直接复用。 */
  fetchDailyOnce() {
    if (this._dailyFetch) return this._dailyFetch;
    const p = fetchApiWallpaperUrl('bing').finally(() => {
      if (this._dailyFetch === p) this._dailyFetch = null;
    });
    this._dailyFetch = p;
    return p;
  },

  /* 网络切换：断网什么都不做（保留当前图）；恢复在线时才补取当天图。 */
  bindNetworkEvents() {
    if (this._netBound || typeof window === 'undefined' || !window.addEventListener) return;
    this._netBound = true;
    window.addEventListener('online', () => { this.onNetworkChange(true); });
    window.addEventListener('offline', () => { this.onNetworkChange(false); });
  },

  onNetworkChange(online) {
    if (!online) return; // 断网：不动画面、不清缓存
    const wp = WALLPAPERS[this.currentIndex];
    if (!wp || wp.type !== 'api' || wp.apiType !== 'bing') return;
    // 当天图已在本地就只清理，不必再打接口
    const cached = normalizeDailyCache(this._dailyCache);
    if (cached && cached.date === todayStr()) {
      this.cleanupDailyCache({ online: true }).catch(() => {});
      return;
    }
    this.apply(this.currentIndex).catch(() => {});
  },

  /* 在线壁纸（Bing 每日 / 随机）的 themeHint 是 null，无法静态判断明暗。
     拿到图片地址后补一次明度采样，把结果写回 data-wallpaper-tone——
     深色主题的压暗层强度按"壁纸明暗"分档（见 main.css 的 .bg-layer::after），
     采样失败（网络/跨域）就保持静态 hint，不改原有行为。
     2.0.0 起不再改 data-theme：主题只有深色一种。 */
  async syncToneFromImage(imageUrl) {
    try {
      const hint = WALLPAPERS[this.currentIndex].themeHint;
      if (hint || !imageUrl) return;
      const sampled = brightnessToThemeHint(await sampleImageBrightness(imageUrl));
      if (sampled) this.setWallpaperTone(sampled);
    } catch (e) {
      console.error('壁纸明度采样失败:', e);
    }
  },

  async set(index) {
    await this.apply(index);
    await Storage.updateSettings({ wallpaperName: WALLPAPERS[index].name });
  },

  async next() {
    const nextIndex = (this.currentIndex + 1) % WALLPAPERS.length;
    await this.set(nextIndex);
  },

  /* 手动刷新 API 壁纸 */
  async refreshCurrent() {
    const wallpaper = WALLPAPERS[this.currentIndex];
    if (wallpaper.type !== 'api') return;

    if (wallpaper.apiType === 'random') {
      // 随机壁纸：重新设置即可（新时间戳 = 新图片），同样补一次明度采样
      const bgLayer = document.getElementById('bgLayer');
      if (bgLayer) {
        const url = getRandomWallpaperUrl();
        this.setBgImage(bgLayer, url);
        this.syncToneFromImage(url);
      }
      return;
    }

    try {
      // 手动刷新走同一套缓存写入：成功后替换为当天图，失败保留当前图（不清空）
      const fetched = await fetchApiWallpaperUrl(wallpaper.apiType);
      const next = buildDailyCache(fetched && fetched.url, todayStr(), null, fetched && fetched.credit);
      if (!next) throw new Error('接口返回的图片地址不可用');
      await this.persistDailyCache(next);
      const bgLayer = document.getElementById('bgLayer');
      if (bgLayer) {
        this.setBgImage(bgLayer, next.url);
        this.setWallCredit(next.credit);
        this.syncToneFromImage(next.url);
      }
    } catch (e) {
      // 刷新失败时屏幕上那张图仍然有效，不清空也不回退（调用方无 catch，这里不外抛）
      console.warn('刷新壁纸失败，保留当前图片:', e && e.message ? e.message : e);
    }
  }
};

/* ---- Node 测试环境导出（UX-13）：浏览器以 <script> 全局加载，module 未定义时不执行 ---- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    brightnessToThemeHint, averageLuminance, WALLPAPERS,
    // 每日图缓存策略（纯函数，便于单测覆盖三态与清理规则）
    DEFAULT_DAILY_IMAGE, DAILY_CACHE_VERSION,
    isValidDateStr, isSafeImageUrl, normalizeDailyCache, resolveDailyWallpaper,
    buildDailyCache, pruneDailyCache, migrateLegacyDailyCache
  };
}
