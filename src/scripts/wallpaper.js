const WALLPAPERS = [
  {
    name: '默',
    css: `
      radial-gradient(ellipse 130% 70% at 50% 0%, rgba(200, 145, 75, 0.42) 0%, transparent 65%),
      radial-gradient(ellipse 85% 75% at 88% 92%, rgba(90, 140, 170, 0.30) 0%, transparent 60%),
      radial-gradient(ellipse 70% 55% at 8% 100%, rgba(180, 120, 80, 0.22) 0%, transparent 55%),
      #1f1913
    `,
    accent: '#e0b25c',
    accentHover: '#ecc072',
    accentSubtle: 'rgba(224, 178, 92, 0.22)',
    accentGlow: 'rgba(224, 178, 92, 0.32)',
    accentCool: '#9cc3d0',
    accentCoolHover: '#b0d3de',
    accentCoolSubtle: 'rgba(156, 195, 208, 0.20)',
    accentCoolGlow: 'rgba(156, 195, 208, 0.24)'
  },
  {
    name: '雾',
    css: `
      radial-gradient(ellipse 130% 65% at 40% 0%, rgba(175, 195, 215, 0.32) 0%, transparent 60%),
      radial-gradient(ellipse 75% 65% at 92% 78%, rgba(140, 165, 200, 0.26) 0%, transparent 55%),
      radial-gradient(ellipse 60% 50% at 3% 95%, rgba(120, 140, 175, 0.20) 0%, transparent 55%),
      #1e2126
    `,
    accent: '#c8d5dc',
    accentHover: '#dbe4ea',
    accentSubtle: 'rgba(200, 213, 220, 0.22)',
    accentGlow: 'rgba(200, 213, 220, 0.26)',
    accentCool: '#a5bac6',
    accentCoolHover: '#b9cbd5',
    accentCoolSubtle: 'rgba(165, 186, 198, 0.20)',
    accentCoolGlow: 'rgba(165, 186, 198, 0.22)'
  },
  {
    name: '茶',
    css: `
      radial-gradient(ellipse 140% 75% at 50% 5%, rgba(220, 145, 60, 0.46) 0%, transparent 65%),
      radial-gradient(ellipse 60% 50% at 20% 90%, rgba(185, 115, 70, 0.28) 0%, transparent 55%),
      radial-gradient(ellipse 50% 45% at 82% 68%, rgba(135, 165, 175, 0.22) 0%, transparent 55%),
      #221812
    `,
    accent: '#dfa15a',
    accentHover: '#ecb372',
    accentSubtle: 'rgba(223, 161, 90, 0.22)',
    accentGlow: 'rgba(223, 161, 90, 0.32)',
    accentCool: '#8fb8ab',
    accentCoolHover: '#a3c8bd',
    accentCoolSubtle: 'rgba(143, 184, 171, 0.20)',
    accentCoolGlow: 'rgba(143, 184, 171, 0.22)'
  },
  {
    name: '墨',
    css: `
      radial-gradient(ellipse 130% 70% at 50% 0%, rgba(75, 115, 170, 0.42) 0%, transparent 65%),
      radial-gradient(ellipse 75% 55% at 12% 88%, rgba(60, 95, 150, 0.28) 0%, transparent 55%),
      radial-gradient(ellipse 55% 45% at 88% 62%, rgba(85, 110, 165, 0.22) 0%, transparent 55%),
      #141926
    `,
    accent: '#9ab8e0',
    accentHover: '#b0c8e8',
    accentSubtle: 'rgba(154, 184, 224, 0.22)',
    accentGlow: 'rgba(154, 184, 224, 0.28)',
    accentCool: '#a5bbd5',
    accentCoolHover: '#b9ccdf',
    accentCoolSubtle: 'rgba(165, 187, 213, 0.20)',
    accentCoolGlow: 'rgba(165, 187, 213, 0.22)'
  },
  {
    name: '檀',
    css: `
      radial-gradient(ellipse 130% 70% at 55% 0%, rgba(220, 125, 95, 0.42) 0%, transparent 60%),
      radial-gradient(ellipse 65% 55% at 18% 92%, rgba(180, 105, 80, 0.26) 0%, transparent 55%),
      radial-gradient(ellipse 50% 45% at 88% 55%, rgba(205, 160, 115, 0.22) 0%, transparent 55%),
      #241713
    `,
    accent: '#e59872',
    accentHover: '#f0ab86',
    accentSubtle: 'rgba(229, 152, 114, 0.22)',
    accentGlow: 'rgba(229, 152, 114, 0.30)',
    accentCool: '#a5b3a5',
    accentCoolHover: '#b8c4b9',
    accentCoolSubtle: 'rgba(165, 179, 165, 0.20)',
    accentCoolGlow: 'rgba(165, 179, 165, 0.22)'
  },
  {
    name: '砚',
    css: `
      radial-gradient(ellipse 140% 65% at 50% 0%, rgba(125, 145, 175, 0.32) 0%, transparent 65%),
      radial-gradient(ellipse 60% 50% at 78% 82%, rgba(135, 155, 185, 0.26) 0%, transparent 55%),
      radial-gradient(ellipse 55% 45% at 8% 62%, rgba(100, 118, 148, 0.20) 0%, transparent 55%),
      #1a1e26
    `,
    accent: '#c0c8d5',
    accentHover: '#d0d8e2',
    accentSubtle: 'rgba(192, 200, 213, 0.22)',
    accentGlow: 'rgba(192, 200, 213, 0.26)',
    accentCool: '#9aacc0',
    accentCoolHover: '#adbccd',
    accentCoolSubtle: 'rgba(154, 172, 192, 0.20)',
    accentCoolGlow: 'rgba(154, 172, 192, 0.22)'
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

  applyAccent(wp) {
    const root = document.documentElement;
    root.style.setProperty('--accent', wp.accent);
    root.style.setProperty('--accent-hover', wp.accentHover);
    root.style.setProperty('--accent-subtle', wp.accentSubtle);
    root.style.setProperty('--accent-glow', wp.accentGlow);
    root.style.setProperty('--accent-cool', wp.accentCool);
    root.style.setProperty('--accent-cool-hover', wp.accentCoolHover);
    root.style.setProperty('--accent-cool-subtle', wp.accentCoolSubtle);
    root.style.setProperty('--accent-cool-glow', wp.accentCoolGlow);
  },

  apply(index) {
    const bgLayer = document.getElementById('bgLayer');
    if (bgLayer) {
      bgLayer.style.background = WALLPAPERS[index].css;
    }
    this.currentIndex = index;
    this.applyAccent(WALLPAPERS[index]);
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
