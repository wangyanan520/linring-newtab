/* ---- 预设渐变壁纸（3 套） ---- */
const WALLPAPERS = [
  {
    name: '深邃星空',
    type: 'preset',
    themeHint: 'dark',
    css: `
      radial-gradient(ellipse 70% 55% at 15% 20%, rgba(100, 60, 200, 0.40) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 85% 15%, rgba(40, 100, 220, 0.35) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 80%, rgba(120, 40, 180, 0.25) 0%, transparent 50%),
      radial-gradient(ellipse 50% 40% at 50% 50%, rgba(180, 80, 255, 0.10) 0%, transparent 40%),
      linear-gradient(135deg, #0d0d2b 0%, #1a1050 30%, #0d1a3a 60%, #0a0a1a 100%)
    `,
    colors: {
      accent: 'rgba(150, 100, 255, 0.8)',
      accentLight: 'rgba(180, 160, 255, 0.4)',
      accentGlow: 'rgba(150, 100, 255, 0.15)',
      accentBorder: 'rgba(150, 100, 255, 0.12)'
    }
  },
  {
    name: '极光绿',
    type: 'preset',
    themeHint: 'dark',
    css: `
      radial-gradient(ellipse 70% 55% at 20% 30%, rgba(0, 180, 120, 0.35) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 20%, rgba(20, 200, 160, 0.25) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 80%, rgba(0, 100, 80, 0.20) 0%, transparent 50%),
      linear-gradient(135deg, #0a1a12 0%, #0d2a1a 30%, #0a1a10 60%, #060d08 100%)
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
      radial-gradient(ellipse 70% 55% at 25% 30%, rgba(220, 100, 40, 0.40) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 75% 20%, rgba(200, 120, 20, 0.30) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 80%, rgba(180, 60, 30, 0.20) 0%, transparent 50%),
      linear-gradient(135deg, #1a0d08 0%, #2a1508 30%, #1a0d0a 60%, #0d0806 100%)
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
      // 随机壁纸：直接使用 URL，无需 fetch
      this.setBgImage(bgLayer, getRandomWallpaperUrl());
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
  },

  /* PBI-10：主题与壁纸联动——仅当设置 theme='auto'（跟随壁纸）时生效；
     手动选择深/浅后不随壁纸变化（PBI-10 AC2）。API 壁纸明度不可预知，保持当前主题。 */
  async syncThemeFromWallpaper() {
    try {
      const settings = await Storage.getSettings();
      if (settings.theme !== 'auto') return;
      const hint = WALLPAPERS[this.currentIndex].themeHint;
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
      // 随机壁纸：重新设置即可（新时间戳 = 新图片）
      const bgLayer = document.getElementById('bgLayer');
      if (bgLayer) this.setBgImage(bgLayer, getRandomWallpaperUrl());
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
