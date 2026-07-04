# 凌睿科技导航页 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现凌睿科技导航页 Chrome 扩展 MVP 版本（v1.0.0），覆盖 M1-M4 里程碑

**Architecture:** 纯静态 Chrome 扩展，使用 Manifest V3，原生 HTML/CSS/JS。数据通过 chrome.storage.local 持久化。页面采用居中布局，支持响应式适配。

**Tech Stack:** Chrome Extension (Manifest V3), HTML5, CSS3, Vanilla JS, chrome.storage API

**预期工时:** ~16.5 小时（M1-M4）

---

## 文件结构

```
凌睿科技导航页/
├── src/                           # 源代码目录
│   ├── manifest.json              # Chrome 扩展清单 (V3)
│   ├── index.html                 # 导航页主页面
│   ├── styles/
│   │   ├── main.css               # 全局样式、布局、响应式
│   │   └── settings.css           # 设置面板样式
│   ├── scripts/
│   │   ├── main.js                # 入口：初始化、渲染、事件绑定
│   │   ├── storage.js             # 数据管理：预设数据、CRUD、持久化
│   │   ├── settings.js            # 设置面板：书签/分类管理
│   │   └── wallpaper.js           # 壁纸管理和切换
│   ├── images/
│   │   └── icons/
│   │       ├── icon-16.png        # 扩展图标 16x16
│   │       ├── icon-48.png        # 扩展图标 48x48
│   │       └── icon-128.png       # 扩展图标 128x128
│   └── wallpapers/
│       ├── wp-01.jpg ~ wp-06.jpg  # 6 张内置壁纸
└── docs/                          # 文档目录
```

---

### Task 1: 项目脚手架 — manifest.json + 扩展图标

**Files:**
- Create: `src/manifest.json`
- Create: `src/images/icon-16.png`, `icon-48.png`, `icon-128.png`

- [ ] **Step 1: 创建 manifest.json**

```json
{
  "manifest_version": 3,
  "name": "凌睿科技导航页",
  "version": "1.0.0",
  "description": "美观实用的新标签页导航",
  "chrome_url_overrides": {
    "newtab": "index.html"
  },
  "permissions": ["storage"],
  "icons": {
    "16": "images/icons/icon-16.png",
    "48": "images/icons/icon-48.png",
    "128": "images/icons/icon-128.png"
  }
}
```

- [ ] **Step 2: 生成扩展图标**

使用一个简单的 SVG 转 PNG 方式，或者创建三个尺寸的纯色图标文件。这里使用一个简单的命令生成占位图标。

Run: 由于暂时无法生成真实图标文件，先创建一个占位说明文件

```bash
# 在 Chrome 加载扩展时，图标缺失不会影响功能
# 后续可以用实际图标替换
touch /Users/wyn/Dev/浏览器导航页/src/images/icons/.gitkeep
```

- [ ] **Step 3: 验证 manifest.json**

```bash
cat /Users/wyn/Dev/浏览器导航页/src/manifest.json | python3 -m json.tool
```

Expected: JSON 格式正确，无语法错误

---

### Task 2: 导航页 HTML 骨架

**Files:**
- Create: `src/index.html`

- [ ] **Step 1: 创建 index.html 完整 DOM 结构**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>凌睿科技导航页</title>
  <link rel="stylesheet" href="styles/main.css">
  <link rel="stylesheet" href="styles/settings.css">
</head>
<body>
  <div class="container" id="app">
    <!-- 背景层 -->
    <div class="bg-layer" id="bgLayer"></div>

    <!-- 顶部状态栏 -->
    <header class="top-bar">
      <div class="datetime" id="datetime"></div>
    </header>

    <!-- 主体内容 -->
    <main class="main-content">
      <h1 class="site-title">凌睿科技导航</h1>

      <div class="search-box">
        <div class="search-inner">
          <span class="search-icon">🔍</span>
          <input type="text" id="searchInput" placeholder="搜索..." autofocus>
          <button class="search-clear" id="searchClear">✕</button>
        </div>
      </div>

      <section class="quick-links">
        <div class="links-grid" id="bookmarkContainer"></div>
      </section>

      <section class="categories" id="categoryContainer"></section>
    </main>

    <!-- 底部工具栏 -->
    <footer class="bottom-bar">
      <button class="tool-btn" id="wallpaperBtn" title="切换壁纸">🖼️ 切换壁纸</button>
      <button class="tool-btn" id="settingsBtn" title="设置">⚙️ 设置</button>
    </footer>
  </div>

  <!-- 设置面板 -->
  <div class="settings-overlay" id="settingsOverlay">
    <div class="settings-panel">
      <div class="settings-header">
        <h2>设置</h2>
        <button class="settings-close" id="settingsClose">✕</button>
      </div>
      <div class="settings-tabs">
        <button class="tab-btn active" data-tab="bookmarks">快捷书签</button>
        <button class="tab-btn" data-tab="categories">分类导航</button>
      </div>
      <div class="settings-body">
        <!-- 书签管理 -->
        <div class="tab-content active" id="tabBookmarks">
          <div class="tab-toolbar">
            <button class="btn-primary" id="addBookmarkBtn">+ 添加书签</button>
          </div>
          <div class="item-list" id="bookmarkList"></div>
        </div>
        <!-- 分类管理 -->
        <div class="tab-content" id="tabCategories">
          <div class="tab-toolbar">
            <button class="btn-primary" id="addCategoryBtn">+ 添加分类</button>
          </div>
          <div class="item-list" id="categoryList"></div>
        </div>
      </div>
    </div>
  </div>

  <script src="scripts/storage.js"></script>
  <script src="scripts/wallpaper.js"></script>
  <script src="scripts/settings.js"></script>
  <script src="scripts/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 验证 HTML**

Run: `python3 -c "from html.parser import HTMLParser; parser = HTMLParser(); parser.feed(open('/Users/wyn/Dev/浏览器导航页/src/index.html').read()); print('HTML OK')"`

Expected: `HTML OK`

---

### Task 3: 全局样式 — main.css

**Files:**
- Create: `src/styles/main.css`

- [ ] **Step 1: 创建 main.css**

```css
:root {
  --bg-overlay: rgba(0, 0, 0, 0.3);
  --text-primary: #ffffff;
  --text-secondary: rgba(255, 255, 255, 0.8);
  --card-bg: rgba(255, 255, 255, 0.15);
  --card-bg-hover: rgba(255, 255, 255, 0.25);
  --card-border: rgba(255, 255, 255, 0.1);
  --shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  --radius: 12px;
  --radius-sm: 8px;
  --transition: all 0.3s ease;
  --font-stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  width: 100%;
  height: 100%;
  font-family: var(--font-stack);
  color: var(--text-primary);
  overflow: hidden;
}

.bg-layer {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: #1a1a2e center/cover no-repeat;
  transition: background-image 0.8s ease;
}

.bg-layer::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
}

.container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 20px 40px;
}

/* 顶部状态栏 */
.top-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 8px 0;
  flex-shrink: 0;
}

.datetime {
  font-size: 14px;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

/* 主体内容 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 20px 0;
  overflow-y: auto;
}

.site-title {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: 4px;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

/* 搜索框 */
.search-box {
  width: 100%;
  max-width: 540px;
}

.search-inner {
  display: flex;
  align-items: center;
  background: var(--card-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--card-border);
  border-radius: 28px;
  padding: 4px 4px 4px 20px;
  transition: var(--transition);
}

.search-inner:focus-within {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}

.search-icon {
  font-size: 18px;
  margin-right: 8px;
  flex-shrink: 0;
}

#searchInput {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: 16px;
  color: var(--text-primary);
  padding: 12px 0;
  font-family: var(--font-stack);
}

#searchInput::placeholder {
  color: var(--text-secondary);
}

.search-clear {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  padding: 8px 16px;
  opacity: 0;
  transition: var(--transition);
}

.search-clear.visible {
  opacity: 1;
}

.search-clear:hover {
  color: var(--text-primary);
}

/* 快捷书签 */
.quick-links {
  width: 100%;
  max-width: 720px;
}

.links-grid {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 16px;
}

.bookmark-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: var(--text-primary);
  width: 72px;
  transition: var(--transition);
}

.bookmark-item:hover {
  transform: translateY(-2px);
}

.bookmark-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--card-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  transition: var(--transition);
  border: 1px solid var(--card-border);
}

.bookmark-item:hover .bookmark-icon {
  background: var(--card-bg-hover);
  border-color: rgba(255, 255, 255, 0.2);
}

.bookmark-item img {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.bookmark-title {
  font-size: 12px;
  text-align: center;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 分类导航 */
.categories {
  width: 100%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-card {
  background: var(--card-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--card-border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: var(--transition);
}

.category-card:hover {
  background: rgba(255, 255, 255, 0.18);
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  cursor: pointer;
  user-select: none;
}

.category-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}

.category-toggle {
  font-size: 12px;
  transition: transform 0.3s ease;
  color: var(--text-secondary);
}

.category-toggle.collapsed {
  transform: rotate(-90deg);
}

.category-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 20px 14px;
  transition: var(--transition);
}

.category-items.collapsed {
  display: none;
}

.category-link {
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.08);
  transition: var(--transition);
}

.category-link:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.18);
}

/* 底部工具栏 */
.bottom-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 12px 0;
  flex-shrink: 0;
}

.tool-btn {
  background: var(--card-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid var(--card-border);
  color: var(--text-secondary);
  padding: 8px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-stack);
  transition: var(--transition);
}

.tool-btn:hover {
  background: var(--card-bg-hover);
  color: var(--text-primary);
}

/* 响应式 */
@media (max-width: 768px) {
  .container {
    padding: 12px 16px;
  }

  .site-title {
    font-size: 26px;
    letter-spacing: 2px;
  }

  .search-box {
    max-width: 100%;
  }

  .links-grid {
    gap: 12px;
  }

  .bookmark-item {
    width: 60px;
  }

  .bookmark-icon {
    width: 42px;
    height: 42px;
    font-size: 16px;
  }

  .bookmark-title {
    font-size: 11px;
  }

  .categories {
    max-width: 100%;
  }
}

@media (min-width: 769px) and (max-width: 1200px) {
  .categories {
    max-width: 700px;
  }
}

/* 滚动条 */
.main-content::-webkit-scrollbar {
  width: 4px;
}

.main-content::-webkit-scrollbar-track {
  background: transparent;
}

.main-content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
}
```

---

### Task 4: 数据存储层 — storage.js

**Files:**
- Create: `src/scripts/storage.js`

- [ ] **Step 1: 创建 storage.js**

```javascript
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
  wallpaper: 'wp-01.jpg',
  wallpaperType: 'image',
  theme: 'light',
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
        bookmarks: PRESET_BOOKMARKS,
        categories: PRESET_CATEGORIES,
        settings: DEFAULT_SETTINGS
      });
    }
  },

  async getAll() {
    return await chrome.storage.local.get(['bookmarks', 'categories', 'settings']);
  },

  async getBookmarks() {
    const result = await chrome.storage.local.get(['bookmarks']);
    return result.bookmarks || [];
  },

  async addBookmark(bookmark) {
    const { bookmarks = [] } = await chrome.storage.local.get(['bookmarks']);
    const maxOrder = bookmarks.reduce((max, b) => Math.max(max, b.sortOrder || 0), 0);
    const newBookmark = {
      id: generateId(),
      title: bookmark.title,
      url: bookmark.url,
      sortOrder: maxOrder + 1
    };
    bookmarks.push(newBookmark);
    await chrome.storage.local.set({ bookmarks });
    return newBookmark;
  },

  async updateBookmark(id, data) {
    const { bookmarks = [] } = await chrome.storage.local.get(['bookmarks']);
    const index = bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      bookmarks[index] = { ...bookmarks[index], ...data };
      await chrome.storage.local.set({ bookmarks });
    }
  },

  async deleteBookmark(id) {
    const { bookmarks = [] } = await chrome.storage.local.get(['bookmarks']);
    const filtered = bookmarks.filter(b => b.id !== id);
    await chrome.storage.local.set({ bookmarks: filtered });
  },

  async getCategories() {
    const result = await chrome.storage.local.get(['categories']);
    return result.categories || [];
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
    const { categories = [] } = await chrome.storage.local.get(['categories']);
    const filtered = categories.filter(c => c.id !== id);
    await chrome.storage.local.set({ categories: filtered });
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
    const { categories = [] } = await chrome.storage.local.get(['categories']);
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      category.items = category.items.filter(i => i.id !== itemId);
      await chrome.storage.local.set({ categories });
    }
  },

  async getSettings() {
    const result = await chrome.storage.local.get(['settings']);
    return result.settings || DEFAULT_SETTINGS;
  },

  async updateSettings(settings) {
    const current = await this.getSettings();
    const merged = { ...current, ...settings };
    await chrome.storage.local.set({ settings: merged });
    return merged;
  }
};
```

---

### Task 5: 壁纸管理 — wallpaper.js

**Files:**
- Create: `src/scripts/wallpaper.js`

- [ ] **Step 1: 创建 wallpaper.js**

```javascript
const WALLPAPERS = [
  'wp-01.jpg', 'wp-02.jpg', 'wp-03.jpg',
  'wp-04.jpg', 'wp-05.jpg', 'wp-06.jpg'
];

const Wallpaper = {
  current: null,

  async init() {
    const settings = await Storage.getSettings();
    this.current = settings.wallpaper || 'wp-01.jpg';
    this.apply(this.current);
  },

  getWallpapers() {
    return WALLPAPERS;
  },

  async apply(name) {
    const bgLayer = document.getElementById('bgLayer');
    if (bgLayer) {
      bgLayer.style.backgroundImage = `url(wallpapers/${name})`;
    }
    this.current = name;
  },

  async set(name) {
    await this.apply(name);
    await Storage.updateSettings({ wallpaper: name });
  },

  async next() {
    const currentIndex = WALLPAPERS.indexOf(this.current);
    const nextIndex = (currentIndex + 1) % WALLPAPERS.length;
    await this.set(WALLPAPERS[nextIndex]);
  },

  async random() {
    const randomIndex = Math.floor(Math.random() * WALLPAPERS.length);
    await this.set(WALLPAPERS[randomIndex]);
  }
};
```

---

### Task 6: 设置面板 — settings.js + settings.css

**Files:**
- Create: `src/scripts/settings.js`
- Create: `src/styles/settings.css`

- [ ] **Step 1: 创建 settings.css**

```css
/* 设置面板遮罩 */
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.5);
  display: none;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.settings-overlay.open {
  display: flex;
}

/* 设置面板 */
.settings-panel {
  background: #1e1e2e;
  color: #e0e0e0;
  border-radius: 16px;
  width: 90%;
  max-width: 560px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  animation: slideUp 0.25s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.settings-header h2 {
  font-size: 18px;
  font-weight: 600;
}

.settings-close {
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}

.settings-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* Tab 栏 */
.settings-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0 24px;
}

.tab-btn {
  background: none;
  border: none;
  color: #888;
  padding: 12px 20px;
  cursor: pointer;
  font-size: 14px;
  font-family: var(--font-stack);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  margin-bottom: -1px;
}

.tab-btn:hover {
  color: #ccc;
}

.tab-btn.active {
  color: #fff;
  border-bottom-color: #6c63ff;
}

/* Tab 内容 */
.settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

.tab-toolbar {
  margin-bottom: 16px;
}

.btn-primary {
  background: #6c63ff;
  color: #fff;
  border: none;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-stack);
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #5a52e0;
}

.btn-danger {
  background: #e74c3c;
  color: #fff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-stack);
  transition: background 0.2s;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-edit {
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-stack);
  transition: all 0.2s;
}

.btn-edit:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

/* 列表项 */
.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  transition: background 0.2s;
}

.setting-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.setting-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #eee;
}

.setting-item-url {
  font-size: 12px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.setting-item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* 分类子项缩进 */
.category-with-items {
  margin-bottom: 4px;
}

.category-sub-items {
  margin-left: 20px;
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sub-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
}

.sub-item .setting-item-info {
  flex-direction: row;
  gap: 8px;
  align-items: center;
}

.sub-item .setting-item-title {
  font-size: 13px;
}

.sub-item .setting-item-url {
  font-size: 11px;
}

/* 内联编辑表单 */
.inline-form {
  display: flex;
  gap: 8px;
  padding: 8px 0;
  flex-wrap: wrap;
}

.inline-form input {
  flex: 1;
  min-width: 120px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 8px 12px;
  color: #eee;
  font-size: 13px;
  font-family: var(--font-stack);
  outline: none;
}

.inline-form input:focus {
  border-color: #6c63ff;
}

.inline-form input::placeholder {
  color: #666;
}

/* 空状态 */
.empty-state {
  text-align: center;
  color: #666;
  padding: 32px 0;
  font-size: 14px;
}
```

- [ ] **Step 2: 创建 settings.js**

```javascript
const Settings = {
  currentTab: 'bookmarks',
  editStates: {},

  async init() {
    this.bindEvents();
    await this.renderBookmarks();
    await this.renderCategories();
  },

  open() {
    document.getElementById('settingsOverlay').classList.add('open');
    this.renderBookmarks();
    this.renderCategories();
  },

  close() {
    document.getElementById('settingsOverlay').classList.remove('open');
  },

  bindEvents() {
    document.getElementById('settingsBtn').addEventListener('click', () => this.open());
    document.getElementById('settingsClose').addEventListener('click', () => this.close());
    document.getElementById('settingsOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    document.getElementById('addBookmarkBtn').addEventListener('click', () => this.showAddBookmarkForm());
    document.getElementById('addCategoryBtn').addEventListener('click', () => this.showAddCategoryForm());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === `tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    });
  },

  async renderBookmarks() {
    const container = document.getElementById('bookmarkList');
    const bookmarks = await Storage.getBookmarks();
    bookmarks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    if (bookmarks.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无书签，点击上方按钮添加</div>';
      return;
    }

    container.innerHTML = bookmarks.map(bm => `
      <div class="setting-item" data-id="${bm.id}">
        <div class="setting-item-info">
          <span class="setting-item-title">${this.escapeHtml(bm.title)}</span>
          <span class="setting-item-url">${this.escapeHtml(bm.url)}</span>
        </div>
        <div class="setting-item-actions">
          <button class="btn-edit" data-action="edit-bookmark" data-id="${bm.id}">编辑</button>
          <button class="btn-danger" data-action="delete-bookmark" data-id="${bm.id}">删除</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-action="edit-bookmark"]').forEach(btn => {
      btn.addEventListener('click', () => this.showEditBookmarkForm(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete-bookmark"]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteBookmark(btn.dataset.id));
    });
  },

  async renderCategories() {
    const container = document.getElementById('categoryList');
    const categories = await Storage.getCategories();
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    if (categories.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无分类，点击上方按钮添加</div>';
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="category-with-items" data-id="${cat.id}">
        <div class="setting-item">
          <div class="setting-item-info">
            <span class="setting-item-title">${this.escapeHtml(cat.title)}</span>
          </div>
          <div class="setting-item-actions">
            <button class="btn-primary" style="padding:4px 12px;font-size:12px;" data-action="add-item" data-id="${cat.id}">+ 添加链接</button>
            <button class="btn-edit" data-action="edit-category" data-id="${cat.id}">编辑</button>
            <button class="btn-danger" data-action="delete-category" data-id="${cat.id}">删除</button>
          </div>
        </div>
        <div class="category-sub-items">
          ${cat.items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(item => `
            <div class="sub-item" data-id="${item.id}" data-cat-id="${cat.id}">
              <div class="setting-item-info">
                <span class="setting-item-title">${this.escapeHtml(item.title)}</span>
                <span class="setting-item-url">${this.escapeHtml(item.url)}</span>
              </div>
              <div class="setting-item-actions">
                <button class="btn-edit" data-action="edit-item" data-cat-id="${cat.id}" data-item-id="${item.id}">编辑</button>
                <button class="btn-danger" data-action="delete-item" data-cat-id="${cat.id}" data-item-id="${item.id}">删除</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-action="add-item"]').forEach(btn => {
      btn.addEventListener('click', () => this.showAddItemForm(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="edit-category"]').forEach(btn => {
      btn.addEventListener('click', () => this.showEditCategoryForm(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete-category"]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCategory(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="edit-item"]').forEach(btn => {
      btn.addEventListener('click', () => this.showEditItemForm(btn.dataset.catId, btn.dataset.itemId));
    });
    container.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCategoryItem(btn.dataset.catId, btn.dataset.itemId));
    });
  },

  showAddBookmarkForm() {
    const container = document.getElementById('bookmarkList');
    const form = document.createElement('div');
    form.className = 'inline-form';
    form.id = 'bookmarkForm';
    form.innerHTML = `
      <input type="text" id="bmTitle" placeholder="名称" required>
      <input type="url" id="bmUrl" placeholder="网址 (https://...)" required>
      <button class="btn-primary" id="saveBookmark">保存</button>
      <button class="btn-edit" id="cancelBookmark">取消</button>
    `;
    container.prepend(form);

    document.getElementById('saveBookmark').addEventListener('click', async () => {
      const title = document.getElementById('bmTitle').value.trim();
      const url = document.getElementById('bmUrl').value.trim();
      if (!title || !url) return;
      await Storage.addBookmark({ title, url });
      form.remove();
      await this.renderBookmarks();
      App.renderBookmarks();
    });

    document.getElementById('cancelBookmark').addEventListener('click', () => form.remove());

    document.getElementById('bmTitle').focus();
  },

  showEditBookmarkForm(id) {
    this.editStates[id] = true;
    const items = document.querySelectorAll(`#bookmarkList .setting-item[data-id="${id}"]`);
    const item = items[0];
    if (!item) return;

    const title = item.querySelector('.setting-item-title').textContent;
    const url = item.querySelector('.setting-item-url').textContent;
    const actions = item.querySelector('.setting-item-actions');

    const form = document.createElement('div');
    form.className = 'inline-form';
    form.innerHTML = `
      <input type="text" id="editBmTitle" value="${this.escapeHtml(title)}" required>
      <input type="url" id="editBmUrl" value="${this.escapeHtml(url)}" required>
      <button class="btn-primary" id="saveEditBookmark">保存</button>
      <button class="btn-edit" id="cancelEditBookmark">取消</button>
    `;
    actions.replaceWith(form);

    document.getElementById('saveEditBookmark').addEventListener('click', async () => {
      const newTitle = document.getElementById('editBmTitle').value.trim();
      const newUrl = document.getElementById('editBmUrl').value.trim();
      if (!newTitle || !newUrl) return;
      await Storage.updateBookmark(id, { title: newTitle, url: newUrl });
      delete this.editStates[id];
      await this.renderBookmarks();
      App.renderBookmarks();
    });

    document.getElementById('cancelEditBookmark').addEventListener('click', () => {
      delete this.editStates[id];
      this.renderBookmarks();
    });
  },

  async deleteBookmark(id) {
    if (!confirm('确定删除此书签？')) return;
    await Storage.deleteBookmark(id);
    await this.renderBookmarks();
    App.renderBookmarks();
  },

  showAddCategoryForm() {
    const container = document.getElementById('categoryList');
    const form = document.createElement('div');
    form.className = 'inline-form';
    form.id = 'categoryForm';
    form.innerHTML = `
      <input type="text" id="catTitle" placeholder="分类名称" required>
      <button class="btn-primary" id="saveCategory">保存</button>
      <button class="btn-edit" id="cancelCategory">取消</button>
    `;
    container.prepend(form);

    document.getElementById('saveCategory').addEventListener('click', async () => {
      const title = document.getElementById('catTitle').value.trim();
      if (!title) return;
      await Storage.addCategory({ title });
      form.remove();
      await this.renderCategories();
      App.renderCategories();
    });

    document.getElementById('cancelCategory').addEventListener('click', () => form.remove());
    document.getElementById('catTitle').focus();
  },

  showEditCategoryForm(id) {
    const containers = document.querySelectorAll(`#categoryList .category-with-items[data-id="${id}"]`);
    const container = containers[0];
    if (!container) return;

    const titleEl = container.querySelector('.setting-item .setting-item-title');
    const currentTitle = titleEl.textContent;
    const actions = container.querySelector('.setting-item .setting-item-actions');

    const form = document.createElement('div');
    form.className = 'inline-form';
    form.innerHTML = `
      <input type="text" id="editCatTitle" value="${this.escapeHtml(currentTitle)}" required>
      <button class="btn-primary" id="saveEditCategory">保存</button>
      <button class="btn-edit" id="cancelEditCategory">取消</button>
    `;
    actions.replaceWith(form);

    document.getElementById('saveEditCategory').addEventListener('click', async () => {
      const newTitle = document.getElementById('editCatTitle').value.trim();
      if (!newTitle) return;
      await Storage.updateCategory(id, { title: newTitle });
      await this.renderCategories();
      App.renderCategories();
    });

    document.getElementById('cancelEditCategory').addEventListener('click', () => {
      this.renderCategories();
    });
  },

  async deleteCategory(id) {
    if (!confirm('确定删除此分类及其所有链接？')) return;
    await Storage.deleteCategory(id);
    await this.renderCategories();
    App.renderCategories();
  },

  showAddItemForm(categoryId) {
    const container = document.querySelector(`.category-with-items[data-id="${categoryId}"] .category-sub-items`);
    if (!container) return;

    const form = document.createElement('div');
    form.className = 'inline-form';
    form.style.cssText = 'padding:4px 0;';
    form.innerHTML = `
      <input type="text" id="itemTitle" placeholder="名称" style="min-width:100px;" required>
      <input type="url" id="itemUrl" placeholder="网址" style="min-width:140px;" required>
      <button class="btn-primary" style="padding:4px 12px;font-size:12px;" id="saveItem">保存</button>
      <button class="btn-edit" style="padding:4px 12px;font-size:12px;" id="cancelItem">取消</button>
    `;
    container.appendChild(form);

    document.getElementById('saveItem').addEventListener('click', async () => {
      const title = document.getElementById('itemTitle').value.trim();
      const url = document.getElementById('itemUrl').value.trim();
      if (!title || !url) return;
      await Storage.addCategoryItem(categoryId, { title, url });
      form.remove();
      await this.renderCategories();
      App.renderCategories();
    });

    document.getElementById('cancelItem').addEventListener('click', () => form.remove());
    document.getElementById('itemTitle').focus();
  },

  showEditItemForm(categoryId, itemId) {
    const subItem = document.querySelector(`.sub-item[data-id="${itemId}"][data-cat-id="${categoryId}"]`);
    if (!subItem) return;

    const title = subItem.querySelector('.setting-item-title').textContent;
    const url = subItem.querySelector('.setting-item-url').textContent;
    const actions = subItem.querySelector('.setting-item-actions');

    const form = document.createElement('div');
    form.className = 'inline-form';
    form.style.cssText = 'padding:4px 0;';
    form.innerHTML = `
      <input type="text" id="editItemTitle" value="${this.escapeHtml(title)}" style="min-width:100px;" required>
      <input type="url" id="editItemUrl" value="${this.escapeHtml(url)}" style="min-width:140px;" required>
      <button class="btn-primary" style="padding:4px 12px;font-size:12px;" id="saveEditItem">保存</button>
      <button class="btn-edit" style="padding:4px 12px;font-size:12px;" id="cancelEditItem">取消</button>
    `;
    actions.replaceWith(form);

    document.getElementById('saveEditItem').addEventListener('click', async () => {
      const newTitle = document.getElementById('editItemTitle').value.trim();
      const newUrl = document.getElementById('editItemUrl').value.trim();
      if (!newTitle || !newUrl) return;
      await Storage.updateCategoryItem(categoryId, itemId, { title: newTitle, url: newUrl });
      await this.renderCategories();
      App.renderCategories();
    });

    document.getElementById('cancelEditItem').addEventListener('click', () => {
      this.renderCategories();
    });
  },

  async deleteCategoryItem(categoryId, itemId) {
    if (!confirm('确定删除此链接？')) return;
    await Storage.deleteCategoryItem(categoryId, itemId);
    await this.renderCategories();
    App.renderCategories();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
```

---

### Task 7: 主逻辑入口 — main.js

**Files:**
- Create: `src/scripts/main.js`

- [ ] **Step 1: 创建 main.js**

```javascript
const App = {
  async init() {
    await Storage.init();
    this.bindEvents();
    this.startClock();
    await Wallpaper.init();
    await this.renderBookmarks();
    await this.renderCategories();
    await Settings.init();
  },

  bindEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.doSearch();
    });

    searchInput.addEventListener('input', () => {
      searchClear.classList.toggle('visible', searchInput.value.length > 0);
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.classList.remove('visible');
      searchInput.focus();
    });

    document.getElementById('wallpaperBtn').addEventListener('click', () => {
      Wallpaper.next();
    });
  },

  doSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    const encoded = encodeURIComponent(query);
    window.location.href = `https://www.google.com/search?q=${encoded}`;
  },

  startClock() {
    function update() {
      const now = new Date();
      const options = {
        year: 'numeric', month: 'long', day: 'numeric',
        weekday: 'long'
      };
      const dateStr = now.toLocaleDateString('zh-CN', options);
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      document.getElementById('datetime').textContent = `${dateStr}  ${timeStr}`;
    }
    update();
    setInterval(update, 1000);
  },

  async renderBookmarks() {
    const container = document.getElementById('bookmarkContainer');
    const bookmarks = await Storage.getBookmarks();
    bookmarks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    container.innerHTML = bookmarks.map(bm => `
      <a href="${this.escapeAttr(bm.url)}" class="bookmark-item" title="${this.escapeAttr(bm.title)}" target="_blank">
        <div class="bookmark-icon">
          <img src="https://www.google.com/s2/favicons?domain=${this.extractDomain(bm.url)}&sz=32"
               alt=""
               onerror="this.parentElement.textContent='${this.escapeHtml(bm.title.charAt(0))}'">
        </div>
        <span class="bookmark-title">${this.escapeHtml(bm.title)}</span>
      </a>
    `).join('');
  },

  async renderCategories() {
    const container = document.getElementById('categoryContainer');
    const categories = await Storage.getCategories();
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    container.innerHTML = categories.map(cat => `
      <div class="category-card" data-id="${cat.id}">
        <div class="category-header" data-action="toggle" data-id="${cat.id}">
          <span class="category-title">${this.escapeHtml(cat.title)}</span>
          <span class="category-toggle ${cat.collapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <div class="category-items ${cat.collapsed ? 'collapsed' : ''}">
          ${cat.items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(item => `
            <a href="${this.escapeAttr(item.url)}" class="category-link" target="_blank">${this.escapeHtml(item.title)}</a>
          `).join('')}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-action="toggle"]').forEach(header => {
      header.addEventListener('click', async () => {
        const id = header.dataset.id;
        const categories = await Storage.getCategories();
        const cat = categories.find(c => c.id === id);
        if (cat) {
          cat.collapsed = !cat.collapsed;
          await Storage.updateCategory(id, { collapsed: cat.collapsed });
          await this.renderCategories();
        }
      });
    });
  },

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
```

---

### Task 8: 壁纸图片资源准备

**Files:**
- Create: `src/wallpapers/wp-01.jpg` ~ `wp-06.jpg`

- [ ] **Step 1: 创建壁纸占位说明**

由于无法在此环境中生成真实壁纸图片，创建一个说明文档，提示用户自行下载壁纸。

```bash
echo "请在此目录放置壁纸图片：wp-01.jpg ~ wp-06.jpg
推荐分辨率：1920x1080 以上
图片来源：https://unsplash.com 或 https://wallhaven.cc" > /Users/wyn/Dev/浏览器导航页/src/wallpapers/README.md
```

- [ ] **Step 2: 使用 CSS 渐变作为默认壁纸兜底**

壁纸加载失败时，`bg-layer` 的 CSS 背景色 `#1a1a2e` 作为兜底，确保页面始终有背景色。

---

### Task 9: MVP 功能验收

- [ ] **Step 1: 在 Chrome 中加载扩展**

1. 打开 `chrome://extensions`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `src/` 目录

- [ ] **Step 2: 功能验收**

| 验收项 | 操作 | 预期结果 |
|-------|------|---------|
| 新标签页覆盖 | 打开新标签页 | 显示凌睿科技导航页 |
| 搜索功能 | 输入关键词回车 | 跳转 Google 搜索结果 |
| 搜索清除 | 输入文字后点击清除 | 输入框清空 |
| 快捷书签显示 | 查看页面 | 8 个预设书签图标+名称 |
| 书签点击 | 点击书签 | 新标签页打开目标网站 |
| 分类折叠 | 点击分类标题 | 展开/折叠链接列表 |
| 分类链接点击 | 点击分类链接 | 新标签页打开目标网站 |
| 时间显示 | 查看顶部 | 显示当前日期和时间 |
| 壁纸切换 | 点击底部切换按钮 | 背景壁纸切换 |
| 设置打开 | 点击⚙️按钮 | 弹出设置面板 |
| 设置关闭 | 点击✕/ESC/遮罩 | 设置面板关闭 |
| 添加书签 | 设置面板添加 | 书签列表更新 |
| 编辑书签 | 设置面板编辑 | 书签信息更新 |
| 删除书签 | 设置面板删除 | 书签被移除 |
| 添加分类 | 设置面板添加 | 分类列表更新 |
| 添加分类链接 | 设置面板添加链接 | 链接出现在分类中 |
| 刷新持久化 | 刷新页面 | 所有自定义数据保留 |

- [ ] **Step 3: 控制台检查**

打开开发者工具 Console，确认无报错。

---

## 自我审阅

**1. Spec 覆盖检查:**
- ✏️ 新标签页覆盖 → Task 1 (manifest.json)
- ✏️ 搜索框 → Task 7 (main.js doSearch)
- ✏️ 快捷书签 → Task 7 (renderBookmarks) + Task 6 (settings 管理)
- ✏️ 分类导航 → Task 7 (renderCategories) + Task 6 (settings 管理)
- ✏️ 时间显示 → Task 7 (startClock)
- ✏️ 壁纸切换 → Task 5 (wallpaper.js) + Task 8 (资源)
- ✏️ 设置面板 → Task 6 (settings.js + settings.css)
- ✏️ 本地存储 → Task 4 (storage.js)
- ✏️ 预设数据 → Task 4 (PRESET_*)
- ✏️ 响应式适配 → Task 3 (main.css media queries)

**2. 占位符检查:** 所有步骤包含完整代码，无 TBD/TODO

**3. 类型一致性:** 函数签名在 storage.js 定义与 settings.js/main.js 调用一致
