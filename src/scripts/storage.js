const PRESET_CATEGORIES = [
  {
    id: 'cat_01', title: '工具导航', sortOrder: 1, collapsed: false,
    items: [
      { id: 'ci_01', title: '在线工具', url: 'https://tool.lu', sortOrder: 1 },
      { id: 'ci_02', title: '腾讯云', url: 'https://cloud.tencent.com', sortOrder: 2 },
      { id: 'ci_03', title: '阿里云', url: 'https://www.aliyun.com', sortOrder: 3 },
      { id: 'ci_04', title: '百度云盘', url: 'https://pan.baidu.com', sortOrder: 4 },
      { id: 'ci_05', title: 'ProcessOn', url: 'https://www.processon.com', sortOrder: 5 }
    ]
  },
  {
    id: 'cat_02', title: '新闻资讯', sortOrder: 2, collapsed: false,
    items: [
      { id: 'ci_06', title: '今日头条', url: 'https://www.toutiao.com', sortOrder: 1 },
      { id: 'ci_07', title: '澎湃新闻', url: 'https://www.thepaper.cn', sortOrder: 2 },
      { id: 'ci_08', title: '36氪', url: 'https://36kr.com', sortOrder: 3 },
      { id: 'ci_09', title: '虎嗅', url: 'https://www.huxiu.com', sortOrder: 4 },
      { id: 'ci_10', title: '少数派', url: 'https://sspai.com', sortOrder: 5 }
    ]
  },
  {
    id: 'cat_03', title: '社交社区', sortOrder: 3, collapsed: false,
    items: [
      { id: 'ci_11', title: 'V2EX', url: 'https://www.v2ex.com', sortOrder: 1 },
      { id: 'ci_12', title: '掘金', url: 'https://juejin.cn', sortOrder: 2 },
      { id: 'ci_13', title: '思否', url: 'https://segmentfault.com', sortOrder: 3 },
      { id: 'ci_14', title: '简书', url: 'https://www.jianshu.com', sortOrder: 4 },
      { id: 'ci_15', title: '微信开放社区', url: 'https://developers.weixin.qq.com', sortOrder: 5 }
    ]
  },
  {
    id: 'cat_04', title: '影音娱乐', sortOrder: 4, collapsed: false,
    items: [
      { id: 'ci_16', title: '网易云音乐', url: 'https://music.163.com', sortOrder: 1 },
      { id: 'ci_17', title: '腾讯视频', url: 'https://v.qq.com', sortOrder: 2 },
      { id: 'ci_18', title: '爱奇艺', url: 'https://www.iqiyi.com', sortOrder: 3 },
      { id: 'ci_19', title: '优酷', url: 'https://www.youku.com', sortOrder: 4 },
      { id: 'ci_20', title: 'AcFun', url: 'https://www.acfun.cn', sortOrder: 5 }
    ]
  }
];

const DEFAULT_SETTINGS = {
  wallpaperName: '深邃星空',
  searchEngine: 'Google',
  theme: 'light',
  weatherCity: '',
  weatherCache: null,
  version: '1.0.0'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const Storage = {
  async init() {
    const result = await chrome.storage.local.get(['settings']);
    if (!result.settings || !result.settings.version) {
      await chrome.storage.local.set({
        categories: PRESET_CATEGORIES,
        settings: DEFAULT_SETTINGS
      });
    }
  },

  async getAll() {
    return await chrome.storage.local.get(['categories', 'settings']);
  },

  async getCategories() {
    try {
      const result = await chrome.storage.local.get(['categories']);
      return result.categories || [];
    } catch (e) {
      console.error('读取分类失败:', e);
      return [];
    }
  },

  async addCategory(category) {
    const { categories = [] } = await chrome.storage.local.get(['categories']);
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder || 0), 0);
    const newCategory = {
      id: generateId(),
      title: category.title,
      sortOrder: maxOrder + 1,
      collapsed: false,
      items: []
    };
    categories.push(newCategory);
    await chrome.storage.local.set({ categories });
    return newCategory;
  },

  async updateCategory(id, data) {
    const { categories = [] } = await chrome.storage.local.get(['categories']);
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...data };
      await chrome.storage.local.set({ categories });
    }
  },

  async deleteCategory(id) {
    try {
      const { categories = [] } = await chrome.storage.local.get(['categories']);
      const filtered = categories.filter(c => c.id !== id);
      await chrome.storage.local.set({ categories: filtered });
    } catch (e) {
      console.error('删除分类失败:', e);
    }
  },

  async addCategoryItem(categoryId, item) {
    const { categories = [] } = await chrome.storage.local.get(['categories']);
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      const maxOrder = category.items.reduce((max, i) => Math.max(max, i.sortOrder || 0), 0);
      category.items.push({
        id: generateId(),
        title: item.title,
        url: item.url,
        sortOrder: maxOrder + 1
      });
      await chrome.storage.local.set({ categories });
    }
  },

  async updateCategoryItem(categoryId, itemId, data) {
    const { categories = [] } = await chrome.storage.local.get(['categories']);
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      const index = category.items.findIndex(i => i.id === itemId);
      if (index !== -1) {
        category.items[index] = { ...category.items[index], ...data };
        await chrome.storage.local.set({ categories });
      }
    }
  },

  async deleteCategoryItem(categoryId, itemId) {
    try {
      const { categories = [] } = await chrome.storage.local.get(['categories']);
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        category.items = category.items.filter(i => i.id !== itemId);
        await chrome.storage.local.set({ categories });
      }
    } catch (e) {
      console.error('删除分类链接失败:', e);
    }
  },

  async getSettings() {
    try {
      const result = await chrome.storage.local.get(['settings']);
      const saved = result.settings || {};
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch (e) {
      console.error('读取设置失败:', e);
      return { ...DEFAULT_SETTINGS };
    }
  },

  async updateSettings(settings) {
    const current = await this.getSettings();
    const merged = { ...current, ...settings };
    await chrome.storage.local.set({ settings: merged });
    return merged;
  }
};
