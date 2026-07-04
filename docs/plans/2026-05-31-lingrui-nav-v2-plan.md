# 凌睿导航页 V2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将凌睿科技导航页升级为 V2，采用科技感玻璃风设计，新增天气和待办事项组件，实现壁纸自适应取色

**Architecture:** 在现有架构上渐进增强，新增 `weather.js` 和 `todos.js` 两个独立模块，通过 Storage API 扩展数据层，通过 CSS 自定义属性实现动态取色

**Tech Stack:** Vanilla JS + CSS3 Custom Properties + Chrome Extension API + wttr.in Weather API

---

## 文件结构

### 修改的文件
- `src/index.html` — 新增天气 DOM、待办事项 DOM
- `src/styles/main.css` — 新增 CSS 变量、天气/待办样式、玻璃质感升级
- `src/scripts/storage.js` — 新增 todos CRUD 方法
- `src/scripts/wallpaper.js` — 新增 colors 预设和 applyColors 方法
- `src/scripts/main.js` — 集成天气、待办、颜色应用

### 新增的文件
- `src/scripts/weather.js` — 天气组件：获取数据 + 渲染
- `src/scripts/todos.js` — 待办组件：CRUD + 渲染

---

### Task 1: CSS 变量与全局样式升级

**Files:**
- Modify: `src/styles/main.css:1-50`

- [ ] **Step 1: 新增 CSS 自定义属性**

在 `:root` 中新增颜色相关变量：

```css
:root {
  /* ... existing vars ... */
  
  /* V2 新增：壁纸自适应颜色变量 */
  --accent-color: rgba(150, 100, 255, 0.8);
  --accent-light: rgba(180, 160, 255, 0.4);
  --accent-glow: rgba(150, 100, 255, 0.15);
  --accent-border: rgba(150, 100, 255, 0.12);
}
```

在现有 `:root` 块的最后（`--font` 之后）添加这 4 个颜色变量。

- [ ] **Step 2: 新增天气组件样式**

在 `/* ===== 快捷书签 ===== */` 之前插入天气样式：

```css
/* ===== 顶部栏 ===== */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  flex-shrink: 0;
}

.datetime {
  font-size: 13px;
  color: var(--text-tertiary);
  letter-spacing: 0.6px;
  font-weight: 400;
  padding: 5px 16px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.03);
}

.weather-widget {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 5px 16px;
  border-radius: var(--radius-full);
  border: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.03);
  transition: all 0.3s var(--ease-out);
}

.weather-widget:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.weather-icon {
  font-size: 16px;
  line-height: 1;
}

.weather-temp {
  font-weight: 450;
  color: var(--text-primary);
}

.weather-sep {
  color: rgba(255, 255, 255, 0.15);
}

.weather-desc {
  color: var(--text-tertiary);
}

.weather-loading {
  font-size: 12px;
  color: var(--text-tertiary);
}
```

- [ ] **Step 3: 新增待办事项组件样式**

在 `/* ===== 分类导航 ===== */` 之后插入待办样式：

```css
/* ===== 主内容区域（V2 双栏布局） ===== */
.main-grid {
  width: 100%;
  max-width: 820px;
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 16px;
  margin-top: 4px;
}

@media (max-width: 768px) {
  .main-grid {
    grid-template-columns: 1fr;
  }
}

/* ===== 待办事项 ===== */
.todo-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  transition: all 0.3s var(--ease-out);
  height: fit-content;
}

.todo-card:hover {
  border-color: var(--accent-border);
}

.todo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.todo-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.todo-add-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.25);
  cursor: pointer;
  font-size: 11px;
  font-family: var(--font);
  transition: color 0.2s ease;
  padding: 2px 6px;
  border-radius: 4px;
}

.todo-add-btn:hover {
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.04);
}

.todo-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  transition: background 0.2s ease;
  cursor: default;
}

.todo-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.todo-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.todo-checkbox:checked {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.todo-checkbox:checked::after {
  content: '';
  position: absolute;
  width: 4px;
  height: 7px;
  border: solid #fff;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
  top: 1px;
}

.todo-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  flex: 1;
  transition: all 0.2s ease;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-text.done {
  text-decoration: line-through;
  color: rgba(255, 255, 255, 0.2);
}

.todo-delete-btn {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  transition: color 0.2s ease;
  opacity: 0;
}

.todo-item:hover .todo-delete-btn {
  opacity: 1;
}

.todo-delete-btn:hover {
  color: rgba(255, 100, 80, 0.7);
}

.todo-input-form {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.todo-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 6px 10px;
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font);
  outline: none;
  transition: all 0.2s ease;
}

.todo-input:focus {
  border-color: var(--accent-border);
  background: rgba(255, 255, 255, 0.06);
}

.todo-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.todo-submit-btn {
  background: var(--accent-color);
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font);
  transition: all 0.2s ease;
}

.todo-submit-btn:hover {
  opacity: 0.85;
}

.todo-empty {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.15);
  text-align: center;
  padding: 16px 0;
}
```

- [ ] **Step 4: 升级搜索框玻璃质感**

修改 `.search-inner` 样式，增强玻璃质感：

```css
.search-inner {
  /* ... existing ... */
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-xl);
  padding: 4px 4px 4px 20px;
  transition: all 0.35s var(--ease-out);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.03);
}

.search-inner:focus-within {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.15),
    0 0 0 1px var(--accent-glow);
}
```

- [ ] **Step 5: 升级快捷书签图标质感**

修改 `.bookmark-icon`，增加微阴影：

```css
.bookmark-icon {
  /* ... existing ... */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
```

在 `.bookmark-item:hover .bookmark-icon` 中增加边框发光：

```css
.bookmark-item:hover .bookmark-icon {
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--accent-border);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}
```

- [ ] **Step 6: 分类导航悬停发光效果**

修改 `.category-card:hover`：

```css
.category-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--accent-border);
}
```

- [ ] **Step 7: 底部栏布局微调**

修改 `.bottom-bar`，增加 `gap: 8px`：

```css
.bottom-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 14px 0 8px;
  flex-shrink: 0;
}
```

---

### Task 2: Storage 扩展 — 新增待办事项 CRUD

**Files:**
- Modify: `src/scripts/storage.js`

- [ ] **Step 1: 初始化默认 todos 数据**

在 `Storage.init()` 中的 `chrome.storage.local.set` 调用中增加 `todos: []`：

```javascript
await chrome.storage.local.set({
  bookmarks: PRESET_BOOKMARKS,
  categories: PRESET_CATEGORIES,
  settings: DEFAULT_SETTINGS,
  todos: []
});
```

- [ ] **Step 2: 添加 getTodos 方法**

在 `getSettings()` 方法之前添加 todos 相关方法：

```javascript
async getTodos() {
  const result = await chrome.storage.local.get(['todos']);
  return result.todos || [];
},

async addTodo(text) {
  const { todos = [] } = await chrome.storage.local.get(['todos']);
  const newTodo = {
    id: generateId(),
    text: text,
    done: false,
    createdAt: Date.now()
  };
  todos.push(newTodo);
  await chrome.storage.local.set({ todos });
  return newTodo;
},

async toggleTodo(id) {
  const { todos = [] } = await chrome.storage.local.get(['todos']);
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    await chrome.storage.local.set({ todos });
  }
},

async deleteTodo(id) {
  const { todos = [] } = await chrome.storage.local.get(['todos']);
  const filtered = todos.filter(t => t.id !== id);
  await chrome.storage.local.set({ todos: filtered });
},
```

---

### Task 3: 壁纸系统扩展 — 颜色预设与应用

**Files:**
- Modify: `src/scripts/wallpaper.js`

- [ ] **Step 1: 为每个壁纸添加 colors 预设**

在每个壁纸对象中增加 `colors` 字段：

```javascript
const WALLPAPERS = [
  {
    name: '深邃星空',
    css: `...`,
    colors: {
      accent: 'rgba(150, 100, 255, 0.8)',
      accentLight: 'rgba(180, 160, 255, 0.4)',
      accentGlow: 'rgba(150, 100, 255, 0.15)',
      accentBorder: 'rgba(150, 100, 255, 0.12)'
    }
  },
  {
    name: '极光绿',
    css: `...`,
    colors: {
      accent: 'rgba(0, 200, 140, 0.8)',
      accentLight: 'rgba(80, 220, 180, 0.4)',
      accentGlow: 'rgba(0, 200, 140, 0.15)',
      accentBorder: 'rgba(0, 200, 140, 0.12)'
    }
  },
  {
    name: '落日暖阳',
    css: `...`,
    colors: {
      accent: 'rgba(220, 130, 50, 0.8)',
      accentLight: 'rgba(240, 180, 100, 0.4)',
      accentGlow: 'rgba(220, 130, 50, 0.15)',
      accentBorder: 'rgba(220, 130, 50, 0.12)'
    }
  },
  {
    name: '海洋蓝',
    css: `...`,
    colors: {
      accent: 'rgba(30, 150, 220, 0.8)',
      accentLight: 'rgba(100, 190, 240, 0.4)',
      accentGlow: 'rgba(30, 150, 220, 0.15)',
      accentBorder: 'rgba(30, 150, 220, 0.12)'
    }
  },
  {
    name: '樱花粉',
    css: `...`,
    colors: {
      accent: 'rgba(210, 90, 150, 0.8)',
      accentLight: 'rgba(230, 140, 180, 0.4)',
      accentGlow: 'rgba(210, 90, 150, 0.15)',
      accentBorder: 'rgba(210, 90, 150, 0.12)'
    }
  },
  {
    name: '晨雾灰',
    css: `...`,
    colors: {
      accent: 'rgba(140, 140, 180, 0.7)',
      accentLight: 'rgba(170, 170, 200, 0.4)',
      accentGlow: 'rgba(140, 140, 180, 0.12)',
      accentBorder: 'rgba(140, 140, 180, 0.10)'
    }
  }
];
```

- [ ] **Step 2: 添加 applyColors 方法**

在 `Wallpaper` 对象中新增：

```javascript
applyColors(index) {
  const colors = WALLPAPERS[index].colors;
  const root = document.documentElement;
  root.style.setProperty('--accent-color', colors.accent);
  root.style.setProperty('--accent-light', colors.accentLight);
  root.style.setProperty('--accent-glow', colors.accentGlow);
  root.style.setProperty('--accent-border', colors.accentBorder);
},
```

- [ ] **Step 3: 在 apply 方法中调用 applyColors**

修改 `Wallpaper.apply()` 方法，在设置背景后调用颜色应用：

```javascript
apply(index) {
  const bgLayer = document.getElementById('bgLayer');
  if (bgLayer) {
    bgLayer.style.background = WALLPAPERS[index].css;
  }
  this.currentIndex = index;
  this.applyColors(index);
},
```

---

### Task 4: 天气组件

**Files:**
- Create: `src/scripts/weather.js`

- [ ] **Step 1: 创建天气模块**

```javascript
const WEATHER_CODE_MAP = {
  113: { icon: '☀️', text: '晴' },
  116: { icon: '⛅', text: '多云' },
  119: { icon: '☁️', text: '阴天' },
  122: { icon: '☁️', text: '阴' },
  143: { icon: '🌫️', text: '雾' },
  176: { icon: '🌦️', text: '小雨' },
  179: { icon: '🌧️', text: '雨' },
  182: { icon: '🌧️', text: '雨' },
  185: { icon: '🌧️', text: '雨' },
  200: { icon: '⛈️', text: '雷暴' },
  227: { icon: '🌨️', text: '雪' },
  230: { icon: '🌨️', text: '暴雪' },
  248: { icon: '🌫️', text: '雾' },
  260: { icon: '🌫️', text: '雾' },
  263: { icon: '🌦️', text: '小雨' },
  266: { icon: '🌦️', text: '雨' },
  281: { icon: '🌧️', text: '雨' },
  284: { icon: '🌧️', text: '雨' },
  293: { icon: '🌦️', text: '小雨' },
  296: { icon: '🌦️', text: '小雨' },
  299: { icon: '🌧️', text: '中雨' },
  302: { icon: '🌧️', text: '中雨' },
  305: { icon: '🌧️', text: '大雨' },
  308: { icon: '🌧️', text: '大雨' },
  311: { icon: '🌧️', text: '雨' },
  314: { icon: '🌧️', text: '雨' },
  317: { icon: '🌧️', text: '雨' },
  320: { icon: '🌨️', text: '雨夹雪' },
  323: { icon: '🌨️', text: '雪' },
  326: { icon: '🌨️', text: '小雪' },
  329: { icon: '🌨️', text: '中雪' },
  332: { icon: '🌨️', text: '大雪' },
  335: { icon: '🌨️', text: '大雪' },
  338: { icon: '🌨️', text: '暴雪' },
  350: { icon: '🧊', text: '冰雹' },
  353: { icon: '🌦️', text: '小雨' },
  356: { icon: '🌧️', text: '中雨' },
  359: { icon: '🌧️', text: '大雨' },
  362: { icon: '🌧️', text: '雨' },
  365: { icon: '🌧️', text: '雨' },
  368: { icon: '🌨️', text: '小雪' },
  371: { icon: '🌨️', text: '大雪' },
  374: { icon: '🧊', text: '冰雹' },
  377: { icon: '🧊', text: '冰雹' },
  386: { icon: '⛈️', text: '雷暴' },
  389: { icon: '⛈️', text: '雷暴' },
  392: { icon: '⛈️', text: '雷阵雪' },
  395: { icon: '⛈️', text: '雷暴' }
};

const CACHE_DURATION = 30 * 60 * 1000;

const Weather = {
  cache: null,

  async init() {
    await this.load();
    this.render();
    setInterval(() => this.refresh(), CACHE_DURATION);
  },

  async fetchWeather() {
    try {
      const response = await fetch('https://wttr.in/?format=j1&lang=zh', {
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();
      const current = data.current_condition[0];
      const area = data.nearest_area[0].areaName[0].value;
      const code = current.weatherCode;
      const mapped = WEATHER_CODE_MAP[code] || { icon: '🌤️', text: current.weatherDesc[0].value };
      return {
        temp: current.temp_C,
        icon: mapped.icon,
        desc: mapped.text,
        city: area,
        timestamp: Date.now()
      };
    } catch {
      return null;
    }
  },

  async load() {
    const settings = await Storage.getSettings();
    if (settings.weatherCache && (Date.now() - settings.weatherCache.timestamp < CACHE_DURATION)) {
      this.cache = settings.weatherCache;
      return;
    }
    await this.refresh();
  },

  async refresh() {
    const data = await this.fetchWeather();
    if (data) {
      this.cache = data;
      await Storage.updateSettings({ weatherCache: data });
    }
    this.render();
  },

  render() {
    const el = document.getElementById('weatherWidget');
    if (!el) return;
    if (!this.cache) {
      el.innerHTML = '<span class="weather-loading">获取天气中...</span>';
      return;
    }
    el.innerHTML = `
      <span class="weather-icon">${this.cache.icon}</span>
      <span class="weather-temp">${this.cache.temp}°C</span>
      <span class="weather-sep">|</span>
      <span class="weather-desc">${this.cache.city} · ${this.cache.desc}</span>
    `;
  }
};
```

- [ ] **Step 2: 验证代码**

检查逻辑：缓存30分钟，API超时8秒，失败时优雅降级显示"获取天气中..."

---

### Task 5: 待办事项组件

**Files:**
- Create: `src/scripts/todos.js`

- [ ] **Step 1: 创建待办模块**

```javascript
const Todos = {
  showForm: false,

  async init() {
    await this.render();
  },

  async render() {
    const container = document.getElementById('todoContainer');
    if (!container) return;
    const todos = await Storage.getTodos();
    todos.sort((a, b) => a.createdAt - b.createdAt);

    const formHtml = this.showForm ? `
      <div class="todo-input-form">
        <input type="text" class="todo-input" id="todoInput" placeholder="添加待办..." maxlength="50">
        <button class="todo-submit-btn" id="todoSubmit">添加</button>
      </div>
    ` : '';

    const todoHtml = todos.length === 0
      ? '<div class="todo-empty">还没有待办事项</div>'
      : todos.map(t => `
        <div class="todo-item" data-id="${t.id}">
          <input type="checkbox" class="todo-checkbox" ${t.done ? 'checked' : ''}>
          <span class="todo-text ${t.done ? 'done' : ''}">${this.escapeHtml(t.text)}</span>
          <button class="todo-delete-btn">×</button>
        </div>
      `).join('');

    container.innerHTML = formHtml + `<div class="todo-list">${todoHtml}</div>`;

    if (this.showForm) {
      const input = document.getElementById('todoInput');
      const submit = document.getElementById('todoSubmit');
      if (input) {
        input.focus();
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') await this.add();
        });
      }
      if (submit) {
        submit.addEventListener('click', async () => await this.add());
      }
    }

    container.querySelectorAll('.todo-checkbox').forEach(cb => {
      cb.addEventListener('change', async (e) => {
        const id = e.target.closest('.todo-item').dataset.id;
        await Storage.toggleTodo(id);
        await this.render();
      });
    });

    container.querySelectorAll('.todo-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.closest('.todo-item').dataset.id;
        await Storage.deleteTodo(id);
        await this.render();
      });
    });
  },

  async add() {
    const input = document.getElementById('todoInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    await Storage.addTodo(text);
    this.showForm = false;
    await this.render();
  },

  toggleForm() {
    this.showForm = !this.showForm;
    this.render();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};
```

---

### Task 6: 更新 HTML 结构

**Files:**
- Modify: `src/index.html`

- [ ] **Step 1: 修改顶部栏，增加天气组件**

将现有 `<header class="top-bar">` 中的内容替换为：

```html
<header class="top-bar">
  <div class="datetime" id="datetime"></div>
  <div class="weather-widget" id="weatherWidget">
    <span class="weather-loading">获取天气中...</span>
  </div>
</header>
```

- [ ] **Step 2: 替换分类区域为双栏布局（分类 + 待办）**

将现有 `<section class="categories" id="categoryContainer"></section>` 替换为：

```html
<div class="main-grid">
  <section class="categories" id="categoryContainer"></section>
  <aside class="todo-card" id="todoContainer">
    <div class="todo-header">
      <span class="todo-title">✅ 待办事项</span>
      <button class="todo-add-btn" id="todoAddBtn">+ 添加</button>
    </div>
  </aside>
</div>
```

- [ ] **Step 3: 在脚本引用中添加 weather.js 和 todos.js**

在 `</body>` 之前添加：

```html
<script src="scripts/weather.js"></script>
<script src="scripts/todos.js"></script>
```

确保在 `main.js` 之前加载 `weather.js` 和 `todos.js`（因为 main.js 依赖它们初始化）。

最终 script 加载顺序：
```html
<script src="scripts/storage.js"></script>
<script src="scripts/wallpaper.js"></script>
<script src="scripts/weather.js"></script>
<script src="scripts/todos.js"></script>
<script src="scripts/settings.js"></script>
<script src="scripts/main.js"></script>
```

---

### Task 7: 更新 main.js — 集成新功能

**Files:**
- Modify: `src/scripts/main.js`

- [ ] **Step 1: 在 App.init 中初始化新功能**

在 `await Wallpaper.init();` 之后添加：

```javascript
await Weather.init();
await Todos.init();
```

- [ ] **Step 2: 绑定待办添加按钮事件**

在 `bindEvents` 方法中，在壁纸按钮事件之后添加：

```javascript
const todoAddBtn = document.getElementById('todoAddBtn');
if (todoAddBtn) {
  todoAddBtn.addEventListener('click', () => Todos.toggleForm());
}
```

- [ ] **Step 3: 移除顶栏右侧的旧日期位置样式（已通过 HTML 结构调整解决）**

HTML 已将 `.top-bar` 改为 `justify-content: space-between`，无需额外 JS 变更。

---

### Task 8: 验证与审查

- [ ] **Step 1: 审查所有文件变更**

检查要点：
- `index.html` 中 `.top-bar` 改为 `space-between`，天气组件在右侧
- `main.css` 中新增样式不破坏现有布局
- `storage.js` 中 todos 方法签名正确
- `wallpaper.js` 中颜色配置与壁纸一一对应
- `weather.js` 缓存、超时、降级逻辑完整
- `todos.js` 事件绑定正确，无内存泄漏

- [ ] **Step 2: 提交代码**

```bash
git add -A
git commit -m "feat: 导航页 V2 升级 - 玻璃质感UI、天气、待办、壁纸自适应取色"
```
