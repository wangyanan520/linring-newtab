const SEARCH_ENGINES = [
  { name: 'Google', url: 'https://www.google.com/search?q={query}' },
  { name: '百度', url: 'https://www.baidu.com/s?wd={query}' },
  { name: 'Bing', url: 'https://www.bing.com/search?q={query}' }
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
    this.startClock();

    // 并行加载所有独立模块，互不阻塞显著提升首屏速度
    await Promise.all([
      Wallpaper.init(),
      Weather.init(),
      typeof Calendar !== 'undefined' ? Calendar.init() : Promise.resolve(),
      Todos.init(),
      this.renderBookmarks(),
      this.renderCategories(),
      Settings.init()
    ]);
  },

  applySettings(settings) {
    const bar = document.querySelector('.bottom-bar');
    if (bar) {
      bar.classList.toggle('hidden', !settings.showBottomBar);
    }
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
      <a href="${escapeAttr(bm.url)}" class="bookmark-item" title="${escapeAttr(bm.title)}" target="_blank">
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
  },

  async renderCategories() {
    const container = document.getElementById('categoryContainer');
    const categories = await Storage.getCategories();
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    container.innerHTML = categories.map(cat => `
      <div class="category-card" data-id="${cat.id}">
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
