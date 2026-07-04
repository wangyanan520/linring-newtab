const WALLPAPERS = [
  {
    name: '深邃星空',
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
  {
    name: '海洋蓝',
    css: `
      radial-gradient(ellipse 70% 55% at 15% 25%, rgba(20, 120, 200, 0.40) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 85% 30%, rgba(10, 160, 220, 0.30) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 75%, rgba(0, 80, 160, 0.25) 0%, transparent 50%),
      linear-gradient(135deg, #08101a 0%, #0a1a2a 30%, #081520 60%, #060a0d 100%)
    `,
    colors: {
      accent: 'rgba(30, 150, 220, 0.8)',
      accentLight: 'rgba(100, 190, 240, 0.4)',
      accentGlow: 'rgba(30, 150, 220, 0.15)',
      accentBorder: 'rgba(30, 150, 220, 0.12)'
    }
  },
  {
    name: '樱花粉',
    css: `
      radial-gradient(ellipse 70% 55% at 20% 25%, rgba(200, 80, 140, 0.35) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 30%, rgba(220, 100, 160, 0.25) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 80%, rgba(160, 60, 120, 0.20) 0%, transparent 50%),
      linear-gradient(135deg, #1a0a14 0%, #2a1020 30%, #1a0a16 60%, #0d080a 100%)
    `,
    colors: {
      accent: 'rgba(210, 90, 150, 0.8)',
      accentLight: 'rgba(230, 140, 180, 0.4)',
      accentGlow: 'rgba(210, 90, 150, 0.15)',
      accentBorder: 'rgba(210, 90, 150, 0.12)'
    }
  },
  {
    name: '晨雾灰',
    css: `
      radial-gradient(ellipse 70% 55% at 20% 30%, rgba(140, 140, 180, 0.25) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 25%, rgba(100, 120, 160, 0.20) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 50% 75%, rgba(80, 80, 120, 0.15) 0%, transparent 50%),
      linear-gradient(135deg, #121216 0%, #1a1a24 30%, #12121a 60%, #0a0a0d 100%)
    `,
    colors: {
      accent: 'rgba(140, 140, 180, 0.7)',
      accentLight: 'rgba(170, 170, 200, 0.4)',
      accentGlow: 'rgba(140, 140, 180, 0.12)',
      accentBorder: 'rgba(140, 140, 180, 0.10)'
    }
  }
];

const Wallpaper = {
  currentIndex: 0,

  async init() {
    const settings = await Storage.getSettings();
    if (settings.wallpaperName) {
      const index = WALLPAPERS.findIndex(w => w.name === settings.wallpaperName);
      if (index !== -1) this.currentIndex = index;
    }
    this.apply(this.currentIndex);
  },

  getWallpapers() {
    return WALLPAPERS;
  },

  applyColors(index) {
    const colors = WALLPAPERS[index].colors;
    const root = document.documentElement;
    root.style.setProperty('--accent-color', colors.accent);
    root.style.setProperty('--accent-light', colors.accentLight);
    root.style.setProperty('--accent-glow', colors.accentGlow);
    root.style.setProperty('--accent-border', colors.accentBorder);
  },

  apply(index) {
    const bgLayer = document.getElementById('bgLayer');
    if (bgLayer) {
      bgLayer.style.background = WALLPAPERS[index].css;
    }
    this.currentIndex = index;
    this.applyColors(index);
  },

  async set(index) {
    this.apply(index);
    await Storage.updateSettings({ wallpaperName: WALLPAPERS[index].name });
  },

  async next() {
    const nextIndex = (this.currentIndex + 1) % WALLPAPERS.length;
    await this.set(nextIndex);
  }
};
