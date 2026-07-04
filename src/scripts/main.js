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
    this.bindEvents();
    this.startClock();
    await Wallpaper.init();
    await Weather.init();
    await Todos.init();
    await this.renderBookmarks();
    await this.renderCategories();
    await Settings.init();
  },

  hideChromeUI() {
    const removeIt = () => {
      const targets = document.querySelectorAll(
        'customize-chrome-button, [id="customize-chrome-button"], .CustomizeChromeButton'
      );
      targets.forEach(el => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
    };

    removeIt();
    const observer = new MutationObserver(() => {
      const targets = document.querySelectorAll(
        'customize-chrome-button, [id="customize-chrome-button"], .CustomizeChromeButton'
      );
      if (targets.length > 0) {
        targets.forEach(el => {
          if (el && el.parentNode) el.parentNode.removeChild(el);
        });
      }
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true
    });

    let attempts = 0;
    const poll = setInterval(() => {
      removeIt();
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

    container.innerHTML = bookmarks.map(bm => {
      const domain = this.extractDomain(bm.url);
      const firstChar = this.escapeHtml(bm.title.charAt(0));
      return `
      <a href="${this.escapeAttr(bm.url)}" class="bookmark-item" title="${this.escapeAttr(bm.title)}" target="_blank">
        <div class="bookmark-icon">
          <img src="https://favicon.im/${domain}"
               alt="${this.escapeAttr(bm.title)}"
               data-domain="${domain}"
               data-char="${firstChar}">
        </div>
        <span class="bookmark-title">${this.escapeHtml(bm.title)}</span>
      </a>
    `}).join('');

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
