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
  /* UX-02 路线 C：浅色预设壁纸。
     此前三张预设底色全是深色，切到浅色主题时只能靠 .bg-layer::after 的白纱把背景"洗亮"
     （路线 A）——可读性达标了，但壁纸本身的层次也一并被洗掉。
     这张浅色预设让 light 主题有一条不必依赖白纱的路径：底色本身就亮，
     白纱叠加后仍是浅色，内容区的对比度和壁纸观感可以同时保住。 */
  {
    name: '晨雾白',
    type: 'preset',
    themeHint: 'light',
    css: `
      radial-gradient(ellipse 70% 55% at 15% 20%, rgba(168, 190, 235, 0.55) 0%, transparent 62%),
      radial-gradient(ellipse 60% 50% at 85% 18%, rgba(235, 214, 226, 0.50) 0%, transparent 58%),
      radial-gradient(ellipse 80% 60% at 50% 85%, rgba(206, 224, 240, 0.45) 0%, transparent 55%),
      linear-gradient(135deg, #eef2f9 0%, #e6ecf6 35%, #f2eef5 65%, #e9eef6 100%)
    `,
    colors: {
      accent: 'rgba(108, 92, 200, 0.75)',
      accentLight: 'rgba(140, 124, 220, 0.35)',
      accentGlow: 'rgba(108, 92, 200, 0.12)',
      accentBorder: 'rgba(108, 92, 200, 0.14)'
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
    return 'https://cn.bing.com' + img.urlbase + '_1920x1080.jpg';
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
    // PBI-10：主题处于"跟随壁纸"模式时按当前壁纸明度同步（异步读取设置，不阻塞渲染）
    this.syncThemeFromWallpaper();

    /* 预设渐变用 15% 淡覆盖，API 壁纸用 35% 深覆盖保证内容可读 */
    if (wallpaper.type === 'preset') {
      document.documentElement.style.setProperty('--bg-overlay-opacity', '0.15');
      this.clearBgImage(bgLayer);
      bgLayer.style.background = wallpaper.css;
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
      this.syncThemeFromWallpaper(randomUrl);
      return;
    }

    // Bing 每日壁纸：同一天内用缓存
    const settings = await Storage.getSettings();
    if (gen !== this._applyGen) return; // 读取设置期间已被取代
    const cache = settings.wallpaperApiCache || {};
    let url = null;
    if (cache.type === 'bing' && cache.date === todayStr()) {
      url = cache.url;
    }

    if (!url) {
      try {
        const fetched = await fetchApiWallpaperUrl(wallpaper.apiType);
        if (gen !== this._applyGen) return; // 用户已切到别的壁纸，丢弃迟到结果（也不写缓存）
        url = fetched;
        if (wallpaper.apiType === 'bing') {
          await Storage.updateSettings({
            wallpaperApiCache: { url, type: 'bing', date: todayStr() }
          });
        }
      } catch (e) {
        if (gen !== this._applyGen) return;
        console.error('壁纸 API 请求失败:', e);
        // fallback: 用第一个预设渐变
        this.clearBgImage(bgLayer);
        bgLayer.style.background = WALLPAPERS[0].css;
        this.applyColors(WALLPAPERS[0].colors);
        return;
      }
    }

    if (gen !== this._applyGen) return; // 写缓存期间又被取代
    this.setBgImage(bgLayer, url);
    // UX-13：图片地址确定后再联动一次主题（预设壁纸在进入 API 分支前已联动过）。
    // 不 await：采样是附加修正，不应拖慢壁纸显示。
    this.syncThemeFromWallpaper(url);
  },

  /* PBI-10：主题与壁纸联动——仅当设置 theme='auto'（跟随壁纸）时生效；
     手动选择深/浅后不随壁纸变化（PBI-10 AC2）。
     UX-13：在线壁纸（Bing 每日 / 随机）的 themeHint 是 null，此前一律落回 dark；
     若当日壁纸偏亮，白字会看不清。这里在拿到图片地址后补一次明度采样，
     采样失败（网络/跨域）仍回退到静态 hint，不改变原有行为。 */
  async syncThemeFromWallpaper(imageUrl) {
    try {
      const settings = await Storage.getSettings();
      let hint = WALLPAPERS[this.currentIndex].themeHint;
      // UX-13：在线壁纸 themeHint 为 null，采样一次图片明度补上。
      // 不论主题是不是 auto 都要采——保底层强度也要用到这个结果。
      if (!hint && imageUrl) {
        hint = brightnessToThemeHint(await sampleImageBrightness(imageUrl));
        if (hint) this.setWallpaperTone(hint);
      }
      // PBI-10：只有 auto 模式才让主题跟着壁纸走；手动选定深/浅后不随壁纸变化（AC2）
      if (settings.theme !== 'auto') return;
      document.documentElement.dataset.theme = hint === 'light' ? 'light' : 'dark';
    } catch (e) {
      console.error('主题联动失败:', e);
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
        this.syncThemeFromWallpaper(url);
      }
      return;
    }

    try {
      const url = await fetchApiWallpaperUrl(wallpaper.apiType);
      if (wallpaper.apiType === 'bing') {
        await Storage.updateSettings({
          wallpaperApiCache: { url, type: 'bing', date: todayStr() }
        });
      }
      const bgLayer = document.getElementById('bgLayer');
      if (bgLayer) this.setBgImage(bgLayer, url);
    } catch (e) {
      console.error('刷新壁纸失败:', e);
    }
  }
};

/* ---- Node 测试环境导出（UX-13）：浏览器以 <script> 全局加载，module 未定义时不执行 ---- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { brightnessToThemeHint, averageLuminance, WALLPAPERS };
}
