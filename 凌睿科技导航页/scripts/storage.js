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
  theme: 'dark',
  weatherCity: '',
  weatherCache: null,
  showBottomBar: false,
  componentVisibility: {},
  version: '1.0.0'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---- 通用排序工具：纯函数，不修改入参 ---- */
function reorder(items, fromIndex, toIndex) {
  const arr = Array.isArray(items) ? [...items] : [];
  if (fromIndex < 0 || fromIndex >= arr.length) return arr;
  if (toIndex < 0 || toIndex >= arr.length) return arr;
  if (fromIndex === toIndex) return arr;
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  return arr;
}

/* 存量数据归一化：存在缺失 sortOrder 时，按当前数组顺序重新编号 1..n，
   返回是否有补值；不改变数组顺序、不丢数据。纯函数（仅修改传入项对象的属性）。 */
function ensureSortOrder(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  const hasMissing = items.some(item =>
    item && typeof item === 'object' &&
    (item.sortOrder === undefined || item.sortOrder === null)
  );
  if (!hasMissing) return false;
  items.forEach((item, i) => {
    if (item && typeof item === 'object') item.sortOrder = i + 1;
  });
  return true;
}

/* 当前支持的备份格式版本（导出时写入 schemaVersion） */
const SUPPORTED_SCHEMA_VERSION = 1;

/* ---- 备份数据校验：纯函数，返回错误列表 ---- */
function validateBackup(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('文件内容不是有效的备份对象');
    return errors;
  }
  if (data.bookmarks !== undefined && !Array.isArray(data.bookmarks)) {
    errors.push('bookmarks 字段必须是数组');
  }
  if (data.categories !== undefined && !Array.isArray(data.categories)) {
    errors.push('categories 字段必须是数组');
  }
  if (data.todos !== undefined && !Array.isArray(data.todos)) {
    errors.push('todos 字段必须是数组');
  }
  if (data.settings !== undefined && (typeof data.settings !== 'object' || data.settings === null || Array.isArray(data.settings))) {
    errors.push('settings 字段必须是对象');
  }

  // 版本闸门：schemaVersion 缺失视为 v1（兼容旧备份）；存在时必须为整数且不高于当前支持版本
  if (data.schemaVersion !== undefined) {
    if (typeof data.schemaVersion !== 'number' || !Number.isInteger(data.schemaVersion)) {
      errors.push('schemaVersion 必须是整数');
    } else if (data.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
      errors.push(`不支持的备份版本：${data.schemaVersion}（当前支持 ${SUPPORTED_SCHEMA_VERSION}）`);
    }
  }
  // 空备份：不含任何数据字段的文件不视为有效备份，避免导入"假成功"
  if (!('bookmarks' in data) && !('categories' in data) && !('todos' in data) && !('settings' in data)) {
    errors.push('备份文件中不包含任何数据字段');
  }

  // 字段级校验：必填字段、类型、重复 id（每类最多报 8 条，避免错误列表过长）
  const limit = (list) => { if (list.length >= 8) return true; return false; };
  // url 协议白名单：仅允许 http/https/chrome-extension，拒绝 javascript: 等可执行协议
  const urlProtoAllowed = (url) => {
    try {
      return ['http:', 'https:', 'chrome-extension:'].includes(new URL(url).protocol);
    } catch {
      return false;
    }
  };
  if (Array.isArray(data.bookmarks)) {
    const ids = new Set();
    for (let i = 0; i < data.bookmarks.length; i++) {
      if (limit(errors)) break;
      const bm = data.bookmarks[i];
      if (!bm || typeof bm !== 'object' || Array.isArray(bm)) {
        errors.push(`bookmarks[${i}] 不是有效对象`);
        continue;
      }
      if (typeof bm.id !== 'string' || !bm.id) errors.push(`bookmarks[${i}] 缺少 id`);
      if (typeof bm.title !== 'string' || !bm.title.trim()) errors.push(`bookmarks[${i}] 缺少 title`);
      if (typeof bm.url !== 'string' || !bm.url.trim()) errors.push(`bookmarks[${i}] 缺少 url`);
      else if (!urlProtoAllowed(bm.url.trim())) errors.push(`bookmarks[${i}] url 协议不支持（仅 http/https/chrome-extension）`);
      if (typeof bm.id === 'string' && bm.id) {
        if (ids.has(bm.id)) errors.push(`书签 id 重复：${bm.id}`);
        ids.add(bm.id);
      }
    }
  }
  if (Array.isArray(data.categories)) {
    const ids = new Set();
    const itemIds = new Set();
    for (let i = 0; i < data.categories.length; i++) {
      if (limit(errors)) break;
      const cat = data.categories[i];
      if (!cat || typeof cat !== 'object' || Array.isArray(cat)) {
        errors.push(`categories[${i}] 不是有效对象`);
        continue;
      }
      if (typeof cat.id !== 'string' || !cat.id) errors.push(`categories[${i}] 缺少 id`);
      if (typeof cat.title !== 'string' || !cat.title.trim()) errors.push(`categories[${i}] 缺少 title`);
      if (cat.items !== undefined && !Array.isArray(cat.items)) errors.push(`categories[${i}] 的 items 必须是数组`);
      if (typeof cat.id === 'string' && cat.id) {
        if (ids.has(cat.id)) errors.push(`分类 id 重复：${cat.id}`);
        ids.add(cat.id);
      }
      if (Array.isArray(cat.items)) {
        for (let j = 0; j < cat.items.length; j++) {
          if (limit(errors)) break;
          const item = cat.items[j];
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            errors.push(`categories[${i}].items[${j}] 不是有效对象`);
            continue;
          }
          if (typeof item.id !== 'string' || !item.id) errors.push(`categories[${i}].items[${j}] 缺少 id`);
          if (typeof item.title !== 'string' || !item.title.trim()) errors.push(`categories[${i}].items[${j}] 缺少 title`);
          if (typeof item.url !== 'string' || !item.url.trim()) errors.push(`categories[${i}].items[${j}] 缺少 url`);
          else if (!urlProtoAllowed(item.url.trim())) errors.push(`categories[${i}].items[${j}] url 协议不支持（仅 http/https/chrome-extension）`);
          if (typeof item.id === 'string' && item.id) {
            if (itemIds.has(item.id)) errors.push(`分类链接 id 重复：${item.id}`);
            itemIds.add(item.id);
          }
        }
      }
    }
  }
  if (Array.isArray(data.todos)) {
    const ids = new Set();
    for (let i = 0; i < data.todos.length; i++) {
      if (limit(errors)) break;
      const todo = data.todos[i];
      if (!todo || typeof todo !== 'object' || Array.isArray(todo)) {
        errors.push(`todos[${i}] 不是有效对象`);
        continue;
      }
      if (typeof todo.id !== 'string' || !todo.id) errors.push(`todos[${i}] 缺少 id`);
      if (typeof todo.text !== 'string' || !todo.text.trim()) errors.push(`todos[${i}] 缺少 text`);
      if (typeof todo.id === 'string' && todo.id) {
        if (ids.has(todo.id)) errors.push(`待办 id 重复：${todo.id}`);
        ids.add(todo.id);
      }
    }
  }
  return errors;
}

/* 导入归一化：分类缺 items 字段时补空数组（validateBackup 允许 items 缺失），
   保证后续渲染路径 [...cat.items] 安全；返回新数组，不修改入参。 */
function normalizeCategories(categories) {
  if (!Array.isArray(categories)) return [];
  return categories.map(cat =>
    cat && typeof cat === 'object' && !Array.isArray(cat)
      ? { ...cat, items: Array.isArray(cat.items) ? cat.items : [] }
      : cat
  );
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
    let bookmarks;
    try {
      const result = await storageGet(['bookmarks']);
      bookmarks = result.bookmarks || [];
      // V3 存量数据兼容：缺失 sortOrder 时按当前顺序补值并持久化
      if (ensureSortOrder(bookmarks)) {
        await storageSet({ bookmarks });
      }
    } catch (e) {
      // 补值写回失败时数据已读取，仍返回本次会话可用，仅告警不置空，
      // 避免主页误显空数据、后续操作基于空数组覆盖写入导致数据丢失
      console.error('读取书签失败:', e);
    }
    return Array.isArray(bookmarks) ? bookmarks : [];
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

  /* 按 sortOrder 升序读取 → reorder → 批量写回新 sortOrder */
  async reorderBookmarks(fromIndex, toIndex) {
    const { bookmarks = [] } = await storageGet(['bookmarks']);
    const sorted = [...bookmarks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const next = reorder(sorted, fromIndex, toIndex);
    next.forEach((b, i) => { b.sortOrder = i + 1; });
    await storageSet({ bookmarks: next });
    return next;
  },

  async getCategories() {
    let categories;
    try {
      const result = await storageGet(['categories']);
      categories = result.categories || [];
      // V3 存量数据兼容：分类与分类内链接缺失 sortOrder 时按当前顺序补值并持久化
      let changed = ensureSortOrder(categories);
      for (const cat of categories) {
        // 空值防御：存量脏数据中可能出现 null/非对象元素，跳过而不是整体落入 catch
        if (cat && typeof cat === 'object' && Array.isArray(cat.items) && ensureSortOrder(cat.items)) {
          changed = true;
        }
      }
      if (changed) {
        await storageSet({ categories });
      }
    } catch (e) {
      // 补值写回失败时数据已读取，仍返回本次会话可用，仅告警不置空，
      // 避免主页误显空数据、后续操作基于空数组覆盖写入导致数据丢失
      console.error('读取分类失败:', e);
    }
    return Array.isArray(categories) ? categories : [];
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

  /* 分类拖拽排序：与书签一致 */
  async reorderCategories(fromIndex, toIndex) {
    const { categories = [] } = await storageGet(['categories']);
    const sorted = [...categories].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const next = reorder(sorted, fromIndex, toIndex);
    next.forEach((c, i) => { c.sortOrder = i + 1; });
    await storageSet({ categories: next });
    return next;
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
  },

  /* ---- V3 组件可见性：默认全开，持久化于 settings.componentVisibility ---- */
  async getComponentVisibility() {
    const settings = await this.getSettings();
    return settings.componentVisibility || {};
  },

  async setComponentVisible(id, visible) {
    const current = await this.getComponentVisibility();
    const next = { ...current, [id]: !!visible };
    await this.updateSettings({ componentVisibility: next });
    return next;
  },

  /* ---- V3 数据备份：导出/导入 ---- */
  async exportData() {
    const result = await storageGet(['bookmarks', 'categories', 'settings', 'todos']);
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      bookmarks: result.bookmarks || [],
      categories: result.categories || [],
      settings: result.settings || DEFAULT_SETTINGS,
      todos: result.todos || []
    };
  },

  async importData(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch {
      throw new Error('文件不是有效的 JSON');
    }
    const errors = validateBackup(data);
    if (errors.length > 0) {
      throw new Error('校验失败：' + errors.join('；'));
    }

    // 迁移兼容：缺字段时保留现有数据，不覆盖
    const current = await storageGet(['bookmarks', 'categories', 'settings', 'todos']);
    const next = {
      bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks : (current.bookmarks || []),
      categories: Array.isArray(data.categories) ? normalizeCategories(data.categories) : (current.categories || []),
      todos: Array.isArray(data.todos) ? data.todos : (current.todos || []),
      settings: data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : (current.settings || DEFAULT_SETTINGS)
    };

    // 导入前自动备份当前数据：轮转保留最近 3 份（-1 最新），便于回滚与留痕；
    // 仅写存在的值，避免 localStorage 回退路径把 undefined 序列化为 "undefined" 脏数据
    const prevBackups = await storageGet(['lastImportBackup-1', 'lastImportBackup-2']);
    const backups = {
      'lastImportBackup-1': { ...current, backedUpAt: Date.now() }
    };
    if (prevBackups['lastImportBackup-1']) backups['lastImportBackup-2'] = prevBackups['lastImportBackup-1'];
    if (prevBackups['lastImportBackup-2']) backups['lastImportBackup-3'] = prevBackups['lastImportBackup-2'];
    await storageSet(backups);
    try {
      await storageSet(next);
    } catch (err) {
      // 写入失败：回滚到导入前数据
      await storageSet(current).catch(() => {});
      throw new Error('写入失败，已恢复原有数据：' + err.message);
    }
    return next;
  }
};
