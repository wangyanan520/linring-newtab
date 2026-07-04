# 凌睿科技导航页 — SPEC（技术规格文档）

## 1. 技术架构

### 1.1 技术选型

| 层面 | 选型 | 说明 |
|------|------|------|
| 扩展框架 | Chrome Manifest V3 | 最新 Chrome 扩展标准 |
| 前端 | 原生 HTML + CSS + Vanilla JS | 无需构建工具，轻量快速 |
| 数据存储 | chrome.storage.local | 浏览器本地持久化存储 |
| 天气 API | OpenWeatherMap 免费 API | 免费额度 60 次/分钟，个人使用足够 |
| 图标 | Material Icons + 网站 Favicon | 统一图标风格 |
| 字体 | 系统原生字体栈 | 无需额外加载 |

### 1.2 浏览器 API 使用

```json
{
  "chrome_url_overrides": {
    "newtab": "index.html"     // 覆盖新标签页
  },
  "permissions": [
    "storage",                 // 本地数据存储
    "geolocation"              // 定位城市（天气功能）
  ],
  "host_permissions": [
    "https://api.openweathermap.org/*"   // 天气 API
  ]
}
```

## 2. 项目结构

```
凌睿科技导航页/
├── manifest.json              # Chrome 扩展清单 (V3)
├── index.html                 # 导航页主页面
├── styles/
│   ├── main.css               # 全局样式、布局、响应式
│   └── settings.css           # 设置面板样式
├── scripts/
│   ├── main.js                # 入口：初始化、渲染、事件绑定
│   ├── storage.js             # 数据管理：预设数据、CRUD、持久化
│   ├── settings.js            # 设置面板：书签/分类/搜索引擎管理
│   ├── weather.js             # 天气获取和显示
│   └── wallpaper.js           # 壁纸管理和切换
├── images/
│   ├── icon-16.png            # 扩展图标 16x16
│   ├── icon-48.png            # 扩展图标 48x48
│   └── icon-128.png           # 扩展图标 128x128
└── wallpapers/
    ├── default-01.jpg         # 默认壁纸 1
    ├── default-02.jpg         # 默认壁纸 2
    └── ...                    # 更多壁纸
```

## 3. 数据模型设计

### 3.1 存储结构

```javascript
// chrome.storage.local 存储结构
{
  // 快捷书签列表
  "bookmarks": [
    {
      "id": "bm_001",
      "title": "百度",
      "url": "https://www.baidu.com",
      "icon": "",           // 空则使用 favicon
      "sortOrder": 1        // 排序序号
    }
  ],

  // 分类导航列表
  "categories": [
    {
      "id": "cat_001",
      "title": "工具导航",
      "sortOrder": 1,
      "collapsed": false,   // 是否折叠
      "items": [
        {
          "id": "item_001",
          "title": "在线工具",
          "url": "https://tool.lu",
          "icon": "",
          "sortOrder": 1
        }
      ]
    }
  ],

  // 用户设置
  "settings": {
    "searchEngine": "google",         // google | baidu | bing
    "wallpaper": "default-01.jpg",    // 壁纸文件名
    "wallpaperType": "image",         // image | solid | gradient
    "wallpaperValue": "",             // 纯色值或渐变色值
    "theme": "light",                 // light | dark | auto
    "weatherEnabled": true,
    "weatherCity": "",                // 手动设置城市，空则自动
    "weatherData": {},                // 缓存的天气数据
    "version": "1.0.0"               // 数据版本，用于迁移
  }
}
```

### 3.2 搜索引擎配置

```javascript
const SEARCH_ENGINES = {
  google: {
    name: "Google",
    url: "https://www.google.com/search?q={query}",
    icon: "🔍"
  },
  baidu: {
    name: "百度",
    url: "https://www.baidu.com/s?wd={query}",
    icon: "🔍"
  },
  bing: {
    name: "Bing",
    url: "https://www.bing.com/search?q={query}",
    icon: "🔍"
  }
};
```

## 4. API 接口设计

### 4.1 内部模块接口

#### storage.js
```javascript
// 初始化存储（首次安装写入预设数据）
async function initStorage(): Promise<void>

// 获取所有数据
async function getAllData(): Promise<Object>

// ----- 书签操作 -----
async function getBookmarks(): Promise<Array>
async function addBookmark(bookmark: Object): Promise<void>
async function updateBookmark(id: string, data: Object): Promise<void>
async function deleteBookmark(id: string): Promise<void>
async function reorderBookmarks(ids: Array<string>): Promise<void>

// ----- 分类操作 -----
async function getCategories(): Promise<Array>
async function addCategory(category: Object): Promise<void>
async function updateCategory(id: string, data: Object): Promise<void>
async function deleteCategory(id: string): Promise<void>

// ----- 分类内链接操作 -----
async function addCategoryItem(categoryId: string, item: Object): Promise<void>
async function updateCategoryItem(categoryId: string, itemId: string, data: Object): Promise<void>
async function deleteCategoryItem(categoryId: string, itemId: string): Promise<void>

// ----- 设置操作 -----
async function getSettings(): Promise<Object>
async function updateSettings(settings: Object): Promise<void>
```

#### weather.js
```javascript
// 获取天气数据
async function getWeather(): Promise<{ city, temperature, description, icon }>

// 设置城市
function setCity(city: string): void

// 自动定位（基于 IP）
async function autoLocate(): Promise<string>
```

#### wallpaper.js
```javascript
// 获取壁纸列表
function getWallpapers(): Array<string>

// 设置壁纸
async function setWallpaper(name: string): Promise<void>

// 获取当前壁纸
async function getCurrentWallpaper(): Promise<string>

// 切换下一张
async function nextWallpaper(): Promise<string>
```

#### settings.js
```javascript
// 打开设置面板
function openSettings(): void

// 关闭设置面板
function closeSettings(): void

// 绑定设置面板事件
function bindEvents(): void
```

## 5. 页面布局规格

### 5.1 布局层级

```
z-index 层级:
  1: 壁纸/背景
  10: 页面内容
  100: 搜索框建议下拉
  1000: 设置面板遮罩
  1001: 设置面板内容
```

### 5.2 容器布局

```
body (100vh x 100vw)
  ├── .container (flex column, center)
  │   ├── .top-bar          # 天气 + 时间 (右上)
  │   ├── .main-content     # 居中主体
  │   │   ├── .title        # "凌睿科技导航"
  │   │   ├── .search-box   # 搜索框
  │   │   ├── .quick-links  # 快捷书签
  │   │   └── .categories   # 分类导航
  │   └── .bottom-bar       # 底部工具栏
  └── .settings-modal       # 设置面板（显示/隐藏）
```

### 5.3 响应式断点

| 断点 | 说明 |
|------|------|
| < 768px | 移动端：单列布局、小字体 |
| 768-1200px | 平板：两列分类 |
| > 1200px | 桌面端：三列分类 |

## 6. 预设数据初始化流程

```javascript
// 首次安装时写入预设数据
async function initStorage() {
  const data = await chrome.storage.local.get(null);

  if (!data.settings || !data.settings.version) {
    // 写入预设书签
    // 写入预设分类
    // 写入默认设置
    await chrome.storage.local.set({
      bookmarks: PRESET_BOOKMARKS,
      categories: PRESET_CATEGORIES,
      settings: DEFAULT_SETTINGS
    });
  }
}
```

## 7. 安全与性能

### 7.1 安全
- 所有用户数据仅存储在本地 chrome.storage
- 不发送任何用户数据到外部服务器
- 搜索跳转使用直接 URL 拼接，不经过中间页
- 使用 Content Security Policy 限制外部资源加载

### 7.2 性能
- 所有 JS 使用 defer 加载，不阻塞 DOM 渲染
- 壁纸图片使用 CSS 预加载
- 天气数据缓存 30 分钟，避免频繁请求
- 设置面板使用懒加载

## 8. Chrome 扩展配置

### manifest.json 核心配置

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
  "host_permissions": ["https://api.openweathermap.org/*"],
  "icons": {
    "16": "images/icon-16.png",
    "48": "images/icon-48.png",
    "128": "images/icon-128.png"
  }
}
```

## 9. 依赖清单

| 依赖 | 类型 | 用途 |
|------|------|------|
| OpenWeatherMap API Key | 外部服务 | 天气数据获取 |
| Unsplash / Pexels | 壁纸来源 | 免费高质量壁纸图片 |
| Google Material Icons | 图标库 | UI 图标（可选，可用 emoji 替代） |
