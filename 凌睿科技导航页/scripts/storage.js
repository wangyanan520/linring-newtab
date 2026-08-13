const PRESET_BOOKMARKS = [
  { id: 'bm_01', title: '百度', url: 'https://www.baidu.com', sortOrder: 1 },
  { id: 'bm_02', title: '知乎', url: 'https://www.zhihu.com', sortOrder: 2 },
  { id: 'bm_03', title: 'GitHub', url: 'https://github.com', sortOrder: 3 },
  { id: 'bm_04', title: 'B站', url: 'https://www.bilibili.com', sortOrder: 4 },
  { id: 'bm_05', title: '豆瓣', url: 'https://www.douban.com', sortOrder: 5 },
  { id: 'bm_06', title: '微博', url: 'https://weibo.com', sortOrder: 6 },
  { id: 'bm_07', title: '淘宝', url: 'https://www.taobao.com', sortOrder: 7 },
  { id: 'bm_08', title: '抖音', url: 'https://www.douyin.com', sortOrder: 8 }
];

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
  wallpaperApiCache: null,
  searchEngine: 'Google',
  theme: 'light',
  weatherCity: '',
  weatherCache: null,
  showBottomBar: false,
  version: '1.0.0'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---- 共享工具函数 ---- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---- 存储后端适配：Chrome 扩展 → localStorage 回退 ---- */
const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

async function storageGet(keys) {
  if (hasChromeStorage) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
  }
  const keyList = Array.isArray(keys) ? keys : [keys];
  const result = {};
  for (const k of keyList) {
    try {
      const raw = localStorage.getItem(k);
      result[k] = raw ? JSON.parse(raw) : undefined;
    } catch { result[k] = undefined; }
  }
  return result;
}

async function storageSet(data) {
  if (hasChromeStorage) {
    return new Promise(resolve => chrome.storage.local.set(data, resolve));
  }
  for (const [k, v] of Object.entries(data)) {
    localStorage.setItem(k, JSON.stringify(v));
  }
}
/* -------------------------------------------------------- */

const Storage = {
  async init() {
    const result = await storageGet(['settings']);
    if (!result.settings || !result.settings.version) {
      await storageSet({
        bookmarks: PRESET_BOOKMARKS,
        categories: PRESET_CATEGORIES,
        settings: DEFAULT_SETTINGS,
        todos: []
      });
    } else {
      const merged = { ...DEFAULT_SETTINGS, ...result.settings };
      await storageSet({ settings: merged });
    }
  },

  async getAll() {
    return await storageGet(['bookmarks', 'categories', 'settings']);
  },

  async getBookmarks() {
    try {
      const result = await storageGet(['bookmarks']);
      return result.bookmarks || [];
    } catch (e) {
      console.error('读取书签失败:', e);
      return [];
    }
  },

  async addBookmark(bookmark) {
    const { bookmarks = [] } = await storageGet(['bookmarks']);
    const maxOrder = bookmarks.reduce((max, b) => Math.max(max, b.sortOrder || 0), 0);
    const newBookmark = {
      id: generateId(),
      title: bookmark.title,
      url: bookmark.url,
      sortOrder: maxOrder + 1
    };
    bookmarks.push(newBookmark);
    await storageSet({ bookmarks });
    return newBookmark;
  },

  async updateBookmark(id, data) {
    const { bookmarks = [] } = await storageGet(['bookmarks']);
    const index = bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...data };
      await storageSet({ bookmarks });
    }
  },

  async deleteBookmark(id) {
    try {
      const { bookmarks = [] } = await storageGet(['bookmarks']);
      const filtered = bookmarks.filter(b => b.id !== id);
      await storageSet({ bookmarks: filtered });
    } catch (e) {
      console.error('删除书签失败:', e);
    }
  },

  async getCategories() {
    try {
      const result = await storageGet(['categories']);
      return result.categories || [];
    } catch (e) {
      console.error('读取分类失败:', e);
      return [];
    }
  },

  async addCategory(category) {
    const { categories = [] } = await storageGet(['categories']);
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder || 0), 0);
    const newCategory = {
      id: generateId(),
      title: category.title,
      sortOrder: maxOrder + 1,
      collapsed: false,
      items: []
    };
    categories.push(newCategory);
    await storageSet({ categories });
    return newCategory;
  },

  async updateCategory(id, data) {
    const { categories = [] } = await storageGet(['categories']);
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index] = { ...categories[index], ...data };
      await storageSet({ categories });
    }
  },

  async deleteCategory(id) {
    try {
      const { categories = [] } = await storageGet(['categories']);
      const filtered = categories.filter(c => c.id !== id);
      await storageSet({ categories: filtered });
    } catch (e) {
      console.error('删除分类失败:', e);
    }
  },

  async addCategoryItem(categoryId, item) {
    const { categories = [] } = await storageGet(['categories']);
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      const maxOrder = category.items.reduce((max, i) => Math.max(max, i.sortOrder || 0), 0);
      category.items.push({
        id: generateId(),
        title: item.title,
        url: item.url,
        sortOrder: maxOrder + 1
      });
      await storageSet({ categories });
    }
  },

  async updateCategoryItem(categoryId, itemId, data) {
    const { categories = [] } = await storageGet(['categories']);
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      const index = category.items.findIndex(i => i.id === itemId);
      if (index !== -1) {
        category.items[index] = { ...category.items[index], ...data };
        await storageSet({ categories });
      }
    }
  },

  async deleteCategoryItem(categoryId, itemId) {
    try {
      const { categories = [] } = await storageGet(['categories']);
      const category = categories.find(c => c.id === categoryId);
      if (category) {
        category.items = category.items.filter(i => i.id !== itemId);
        await storageSet({ categories });
      }
    } catch (e) {
      console.error('删除分类链接失败:', e);
    }
  },

  async getTodos() {
    try {
      const result = await storageGet(['todos']);
      return result.todos || [];
    } catch (e) {
      console.error('读取待办失败:', e);
      return [];
    }
  },

  async addTodo(text) {
    const { todos = [] } = await storageGet(['todos']);
    const newTodo = {
      id: generateId(),
      text: text,
      done: false,
      createdAt: Date.now()
    };
    todos.push(newTodo);
    await storageSet({ todos });
    return newTodo;
  },

  async toggleTodo(id) {
    const { todos = [] } = await storageGet(['todos']);
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.done = !todo.done;
      await storageSet({ todos });
    }
  },

  async deleteTodo(id) {
    try {
      const { todos = [] } = await storageGet(['todos']);
      const filtered = todos.filter(t => t.id !== id);
      await storageSet({ todos: filtered });
    } catch (e) {
      console.error('删除待办失败:', e);
    }
  },

  async getSettings() {
    try {
      const result = await storageGet(['settings']);
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
    await storageSet({ settings: merged });
    return merged;
  }
};
