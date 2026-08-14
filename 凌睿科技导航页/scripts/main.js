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
  { id: 'weather', title: '天气', selector: '.weather-widget', defaultVisible: true, init: () => Weather.init(), onShow: () => Weather.startRefresh(), onHide: () => Weather.stopRefresh() },
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
    // 任一初始化失败不阻塞页面其余功能，仅记录错误
    await Promise.all([Wallpaper.init(), Settings.init()]).catch(err => {
      console.error('组件初始化失败:', err);
    });
  },

  applySettings(settings) {
    // 底部工具栏开关仅隐藏壁纸按钮；设置按钮是唯一入口，必须始终可见，否则无法再次进入设置
    const wallpaperBtn = document.getElementById('wallpaperBtn');
    if (wallpaperBtn) {
      wallpaperBtn.classList.toggle('hidden', !settings.showBottomBar);
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
      if (visible) {
        // 首次可见时初始化；再次可见时触发 onShow（如重启组件定时器）
        if (c.init && !c._initialized) {
          c._initialized = true;
          c.init();
        } else if (c.onShow && !c._visible) {
          c.onShow();
        }
        c._visible = true;
      } else {
        // 隐藏时触发 onHide（如停止组件后台请求）
        if (c.onHide && c._visible) c.onHide();
        c._visible = false;
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

    // 轮询兜底（Chrome 可能延迟注入），一旦清理成功即停止并断开监听
    let attempts = 0;
    const poll = setInterval(() => {
      if (cleaned) {
        clearInterval(poll);
        observer.disconnect();
        return;
      }
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
      if (attempts > 20) {
        clearInterval(poll);
        observer.disconnect();
      }
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
      // 属性值上下文用 escapeAttr（escapeHtml 不转义引号，标题首字符为 " 时会提前闭合属性）
      const firstChar = escapeAttr(bm.title.charAt(0));
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

    this.attachDrag(container, (from, to) => Storage.reorderBookmarks(from, to));
  },

  async renderCategories() {
    const container = document.getElementById('categoryContainer');
    const categories = await Storage.getCategories();
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    container.innerHTML = categories.map(cat => `
      <div class="category-card" data-id="${escapeAttr(cat.id)}" draggable="true">
        <div class="category-header" data-action="toggle" data-id="${escapeAttr(cat.id)}">
          <span class="category-title">${escapeHtml(cat.title)}</span>
          <span class="category-toggle ${cat.collapsed ? 'collapsed' : ''}">▼</span>
        </div>
        <div class="category-items ${cat.collapsed ? 'collapsed' : ''}">
          ${[...(cat.items || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(item => `
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

    this.attachDrag(container, (from, to) => Storage.reorderCategories(from, to));
  },

  /* 通用拖拽排序：HTML5 DnD，调用 reorderFn 持久化后移动 DOM（不整块重渲染） */
  attachDrag(container, reorderFn) {
    // 容器为静态元素：事件只绑定一次，避免每次重渲染重复累积监听器
    if (container.dataset.dragBound === '1') return;
    container.dataset.dragBound = '1';

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

    // 拖到卡片间隙落空时，按落点坐标推导插入索引（reorder 的 to 语义：插入该索引位）
    const findDropIndex = (els, x, y) => {
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < els.length; i++) {
        const r = els[i].getBoundingClientRect();
        const dx = x - (r.left + r.width / 2);
        const dy = y - (r.top + r.height / 2);
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = i; }
      }
      if (best === -1) return -1;
      const r = els[best].getBoundingClientRect();
      // 落点在最近元素中心之前 → 插其前；否则插其后（末尾收敛到 length-1，兼容 reorder 越界语义）
      const before = x < r.left + r.width / 2;
      return before ? best : Math.min(best + 1, els.length - 1);
    };

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const els = items();
      if (dragIndex === -1) return;
      const target = e.target.closest('[draggable="true"]');
      const toIndex = target ? els.indexOf(target) : findDropIndex(els, e.clientX, e.clientY);
      if (toIndex === -1 || toIndex === dragIndex) return;
      try {
        await reorderFn(dragIndex, toIndex);
      } catch (err) {
        // 持久化失败：不移动 DOM，保持现状（下次渲染仍按存储顺序）
        console.error('保存排序失败:', err);
        return;
      }
      // DOM 移动替代全量重渲染：不重建 <img> 节点，避免 50+ 书签时 favicon 全部重载闪烁
      const dragEl = els[dragIndex];
      const targetEl = els[toIndex];
      if (toIndex < dragIndex) {
        container.insertBefore(dragEl, targetEl);
      } else {
        container.insertBefore(dragEl, targetEl.nextSibling);
      }
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
