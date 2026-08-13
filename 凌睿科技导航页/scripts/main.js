const SEARCH_ENGINES = [
  { name: 'Google', url: 'https://www.google.com/search?q={query}' },
  { name: '百度', url: 'https://www.baidu.com/s?wd={query}' },
  { name: 'Bing', url: 'https://www.bing.com/search?q={query}' }
];

/* ---- V3 组件注册表：主页区块统一按注册表 + 可见性配置渲染 ----
   locked=true 表示常驻组件（搜索框），不可关闭。 */
const COMPONENTS = [
  { id: 'search', title: '搜索框', selector: '.search-box', locked: true, defaultVisible: true },
  {
    id: 'calendar', title: '农历日历', selector: '.datetime', defaultVisible: true,
    init: async () => {
      if (typeof Calendar !== 'undefined' && !Calendar.loaded) await Calendar.init();
      App.startClock();
    }
  },
  { id: 'weather', title: '天气', selector: '.weather-widget', defaultVisible: true, init: () => Weather.init() },
  { id: 'bookmarks', title: '快捷书签', selector: '.quick-links', defaultVisible: true, init: () => App.renderBookmarks() },
  { id: 'categories', title: '分类导航', selector: '.categories', defaultVisible: true, init: () => App.renderCategories() },
  { id: 'todos', title: '待办', selector: '.todo-card', defaultVisible: true, init: () => Todos.init() },
  { id: 'wallpaper', title: '壁纸按钮', selector: '#wallpaperBtn', defaultVisible: true }
];

const App = {
  currentEngine: 0,

  async init() {
    await Storage.init();
    this.hideChromeUI();
    const settings = await Storage.getSettings();
    if (settings.searchEngine) {
      const idx = SEARCH_ENGINES.findIndex(e => e.name === settings.searchEngine);
      if (idx !== -1) this.currentEngine = idx;
    }
    this.updateEngineBtn();
    this.applySettings(settings);
    this.bindEvents();

    // 组件初始化统一由 applyComponentVisibility 按可见性触发（首次可见时执行一次）
    await Promise.all([Wallpaper.init(), Settings.init()]);
  },

  applySettings(settings) {
    const bar = document.querySelector('.bottom-bar');
    if (bar) {
      bar.classList.toggle('hidden', !settings.showBottomBar);
    }
    // V3 主题：默认深色，浅色时切换
    document.documentElement.dataset.theme = settings.theme === 'light' ? 'light' : 'dark';
    // V3 组件可见性：按注册表隐藏/显示主页区块
    this.applyComponentVisibility(settings);
  },

  isComponentVisible(component, settings) {
    if (component.locked) return true;
    return (settings.componentVisibility || {})[component.id] !== false;
  },

  applyComponentVisibility(settings) {
    COMPONENTS.forEach(c => {
      const el = document.querySelector(c.selector);
      if (!el) return;
      const visible = this.isComponentVisible(c, settings);
      el.classList.toggle('component-hidden', !visible);
      // 从隐藏切换为可见时补初始化（含初始启动）；_initialized 防止重复初始化
      if (visible && c.init && !c._initialized) {
        c._initialized = true;
        c.init();
      }
    });
  },

  hideChromeUI() {
    // 持续清理动态注入的自定义按钮（inline style 已处理初始隐藏）
    let cleaned = false;
    const observer = new MutationObserver(() => {
      const targets = document.querySelectorAll(
        'customize-chrome-button, cr-customize-button, ntp-customize-button, [id*="customize" i], [class*="customize" i]'
      );
      targets.forEach(el => {
        if (el && el.parentNode) {
          el.style.display = 'none';
          el.remove();
          cleaned = true;
        }
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 轮询兜底（Chrome 可能延迟注入），一旦清理成功即停止
    let attempts = 0;
    const poll = setInterval(() => {
      if (cleaned) { clearInterval(poll); return; }
      const targets = document.querySelectorAll(
        'customize-chrome-button, cr-customize-button, ntp-customize-button'
      );
      targets.forEach(el => {
        if (el && el.parentNode) {
          el.style.display = 'none';
          el.remove();
          cleaned = true;
        }
      });
      attempts++;
      if (attempts > 20) clearInterval(poll);
    }, 200);
  },

  bindEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const engineBtn = document.getElementById('engineBtn');

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

    engineBtn.addEventListener('click', () => this.cycleEngine());

    document.getElementById('wallpaperBtn').addEventListener('click', () => {
      Wallpaper.next();
    });

    const todoAddBtn = document.getElementById('todoAddBtn');
    if (todoAddBtn) {
      todoAddBtn.addEventListener('click', () => Todos.toggleForm());
    }
  },

  cycleEngine() {
    this.currentEngine = (this.currentEngine + 1) % SEARCH_ENGINES.length;
    this.updateEngineBtn();
    Storage.updateSettings({ searchEngine: SEARCH_ENGINES[this.currentEngine].name });
  },

  updateEngineBtn() {
    const btn = document.getElementById('engineBtn');
    btn.textContent = SEARCH_ENGINES[this.currentEngine].name;
  },

  doSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    const encoded = encodeURIComponent(query);
    const searchUrl = SEARCH_ENGINES[this.currentEngine].url.replace('{query}', encoded);
    window.location.href = searchUrl;
  },

  startClock() {
    if (this._clockStarted) return;
    this._clockStarted = true;
    const el = document.getElementById('datetime');
    let hoverCardMounted = false;

    function update() {
      const now = new Date();
      const options = {
        year: 'numeric', month: 'long', day: 'numeric',
        weekday: 'long'
      };
      const dateStr = now.toLocaleDateString('zh-CN', options);
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

      if (!hoverCardMounted && typeof Calendar !== 'undefined' && Calendar.loaded) {
        el.innerHTML = `<span class="datetime-text">${dateStr}  ${timeStr}</span>${Calendar.render()}`;
        hoverCardMounted = true;
        const card = el.querySelector('.datetime-hover-card');
        if (card) Calendar.bindCardEvents(card);
      } else {
        const textEl = el.querySelector('.datetime-text');
        const target = textEl || el;
        target.textContent = `${dateStr}  ${timeStr}`;
      }
    }
    update();
    setInterval(update, 1000);

    // 点击切换日历卡片
    el.addEventListener('click', (e) => {
      if (e.target.closest('.datetime-hover-card')) return;
      el.classList.toggle('show-card');
    });
    document.addEventListener('click', (e) => {
      if (!el.contains(e.target)) el.classList.remove('show-card');
    });
  },

  async renderBookmarks() {
    const container = document.getElementById('bookmarkContainer');
    const bookmarks = await Storage.getBookmarks();
    bookmarks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    container.innerHTML = bookmarks.map(bm => {
      const domain = this.extractDomain(bm.url);
      const firstChar = escapeHtml(bm.title.charAt(0));
      return `
      <a href="${escapeAttr(bm.url)}" class="bookmark-item" title="${escapeAttr(bm.title)}" target="_blank" draggable="true" data-id="${escapeAttr(bm.id)}">
        <div class="bookmark-icon">
          <img src="https://favicon.im/${domain}"
               alt="${escapeAttr(bm.title)}"
               data-domain="${domain}"
               data-char="${firstChar}">
        </div>
        <span class="bookmark-title">${escapeHtml(bm.title)}</span>
      </a>`}).join('');

    container.querySelectorAll('.bookmark-icon img').forEach(img => {
      img.addEventListener('error', function handleError() {
        if (!this.dataset.triedFallback) {
          this.dataset.triedFallback = '1';
          this.src = `https://${this.dataset.domain}/favicon.ico`;
        } else {
          this.style.display = 'none';
          this.parentElement.classList.add('fallback');
          this.parentElement.dataset.char = this.dataset.char;
        }
      });
    });

    this.attachDrag(container, (from, to) => Storage.reorderBookmarks(from, to), () => this.renderBookmarks());
  },

  async renderCategories() {
    const container = document.getElementById('categoryContainer');
    const categories = await Storage.getCategories();
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    container.innerHTML = categories.map(cat => `
      <div class="category-card" data-id="${cat.id}" draggable="true">
        <div class="category-header" data-action="toggle" data-id="${cat.id}">
          <span class="category-title">${escapeHtml(cat.title)}</span>
          <span class="category-toggle ${cat.collapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <div class="category-items ${cat.collapsed ? 'collapsed' : ''}">
          ${cat.items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(item => `
            <a href="${escapeAttr(item.url)}" class="category-link" target="_blank">${escapeHtml(item.title)}</a>
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

    this.attachDrag(container, (from, to) => Storage.reorderCategories(from, to), () => this.renderCategories());
  },

  /* 通用拖拽排序：HTML5 DnD，调用 reorderFn 持久化后重渲染 */
  attachDrag(container, reorderFn, rerenderFn) {
    const items = () => Array.from(container.querySelectorAll('[draggable="true"]'));
    let dragIndex = -1;

    container.addEventListener('dragstart', (e) => {
      const el = e.target.closest('[draggable="true"]');
      if (!el) return;
      dragIndex = items().indexOf(el);
      if (dragIndex === -1) {
        e.preventDefault();
        return;
      }
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', el.dataset.id || '');
      } catch {}
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const els = items();
      const target = e.target.closest('[draggable="true"]');
      if (dragIndex === -1 || !target) return;
      const toIndex = els.indexOf(target);
      if (toIndex === -1 || toIndex === dragIndex) return;
      await reorderFn(dragIndex, toIndex);
      await rerenderFn();
    });

    container.addEventListener('dragend', () => {
      dragIndex = -1;
      container.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    });
  },

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  },

  /* escapeHtml/escapeAttr 定义在 storage.js */
};

document.addEventListener('DOMContentLoaded', () => App.init());
