const SEARCH_ENGINES = [
  { name: 'Google', url: 'https://www.google.com/search?q={query}' },
  { name: '百度', url: 'https://www.baidu.com/s?wd={query}' },
  { name: 'Bing', url: 'https://www.bing.com/search?q={query}' }
];

/* ---- 搜索框输入判定（UX-03）----
   区分"用户想打开一个网站"与"用户想搜索"：placeholder 承诺"搜索或输入网址"，
   但此前所有输入都被拼成搜索链接，输入 github.com 会跳到 google.com/search?q=github.com。
   判定原则是**保守优先**——拿不准就当搜索词，避免把用户的搜索意图误判成网址跳走。 */
const URL_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
/* 可执行/可注入的协议：即使带 :// 也不导航。扩展页与主页同源，直跳 javascript:/data:
   等于把搜索框当成脚本入口；file: 仍放行（用户主动输入本地路径属正常需求，且浏览器自身会拦截
   扩展页到 file: 的导航）。书签录入侧用白名单，这里用黑名单但口径一致：危险协议一律拒。 */
const BLOCKED_SCHEME_RE = /^(?:javascript|data|vbscript):/i;
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?([/?#]|$)/i;
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(:\d+)?([/?#]|$)/;
/* 域名：标签(含连字符，不以连字符开头结尾) + 顶级域(纯字母 2-24 位) + 可选端口/路径 */
const DOMAIN_RE = /^([\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+([\p{L}]{2,24})(:\d+)?([/?#].*)?$/u;
/* 常见顶级域白名单：不在表内的（如 1.2.3 的 "3"、文件后缀 .txt）一律走搜索。
   宁可漏判（用户多按一次回车），不可误判（用户的搜索词被当成网址跳走）。 */
const COMMON_TLDS = new Set([
  'com', 'cn', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'ai', 'dev', 'app',
  'co', 'me', 'tv', 'cc', 'xyz', 'top', 'site', 'online', 'shop', 'store', 'info',
  'biz', 'name', 'pro', 'mobi', 'asia', 'tech', 'cloud', 'blog', 'wiki', 'news',
  'live', 'fun', 'space', 'world', 'life', 'today', 'design', 'studio', 'agency',
  'digital', 'media', 'group', 'team', 'works', 'tools', 'run', 'sh', 'gg', 'ly',
  'be', 'it', 'de', 'fr', 'uk', 'us', 'jp', 'kr', 'ru', 'in', 'au', 'ca', 'br',
  'nl', 'se', 'no', 'fi', 'dk', 'ch', 'at', 'es', 'pt', 'pl', 'tr', 'hk', 'tw',
  'sg', 'my', 'th', 'vn', 'id', 'ph', 'mx', 'ar', 'za', 'eg', 'nz', 'ie', 'gr',
  'cz', 'hu', 'ro', 'ua', 'il', 'sa', 'ae', 'link', 'click', 'page', 'host',
  'lu', 'im', 'so', 'md', 'ws', 'to', 'vc', 'fm', 'am', 'la', 'gd', 'st'
]);

function isValidIpv4(match) {
  for (let i = 1; i <= 4; i++) {
    const n = Number(match[i]);
    if (n > 255) return false;
  }
  return true;
}

/* 纯函数：返回 { type: 'url' | 'search', target }
   - url：target 是可直接导航的完整地址（自动补协议）
   - search：target 是原始查询词（去掉首尾空白） */
function resolveInput(raw) {
  const input = String(raw == null ? '' : raw).trim();
  if (!input) return { type: 'search', target: '' };
  // 已带协议：危险协议按搜索处理（不导航），其余原样使用（含 chrome-extension://、file:// 等）
  if (URL_SCHEME_RE.test(input)) {
    return BLOCKED_SCHEME_RE.test(input)
      ? { type: 'search', target: input }
      : { type: 'url', target: input };
  }
  // 本机地址与内网 IP：默认 http（https 在本地开发环境通常不可用）
  if (LOCAL_HOST_RE.test(input)) return { type: 'url', target: 'http://' + input };
  const ip = input.match(IPV4_RE);
  if (ip && isValidIpv4(ip)) return { type: 'url', target: 'http://' + input };
  // 域名形态：顶级域需在白名单内，或为中文等非 ASCII 顶级域
  const domain = input.match(DOMAIN_RE);
  if (domain) {
    const tld = domain[2].toLowerCase();
    const isIdn = /[^\x00-\x7F]/.test(tld);
    if (isIdn || COMMON_TLDS.has(tld)) return { type: 'url', target: 'https://' + input };
  }
  return { type: 'search', target: input };
}

/* ---- V3 组件注册表：主页区块统一按注册表 + 可见性配置渲染 ----
   locked=true 表示常驻组件（搜索框），不可关闭。
   区块定位依赖 index.html 中的 data-component="<id>" 标记（P3-1：此前另用 class/id 选择器，
   与 index.html 里的标记脱节，那 7 处标记成了没人读的死代码；改用标记后 class 改名不再影响组件开关）。 */
const COMPONENTS = [
  { id: 'search', title: '搜索框', locked: true },
  {
    id: 'calendar', title: '农历日历',
    init: async () => {
      // 时钟不依赖节假日网络数据：先启动时钟（startClock 每秒自检 Calendar.loaded，
      // 数据到位后自动挂载农历浮层），否则慢网络下时间区域会长时间空白
      App.startClock();
      if (typeof Calendar !== 'undefined' && !Calendar.loaded) await Calendar.init();
    }
  },
  { id: 'weather', title: '天气', init: () => Weather.init(), onShow: () => Weather.startRefresh(), onHide: () => Weather.stopRefresh() },
  { id: 'bookmarks', title: '快捷书签', init: () => App.renderBookmarks() },
  { id: 'categories', title: '分类导航', init: () => App.renderCategories() },
  { id: 'todos', title: '待办', init: () => Todos.init() },
  { id: 'wallpaper', title: '壁纸按钮' }
];

const App = {
  // 默认百度：与 storage.js 的 DEFAULT_SETTINGS.searchEngine 保持一致。
  // 已有用户保存过的引擎不会被覆盖（init 会按 settings 重新定位）。
  currentEngine: Math.max(0, SEARCH_ENGINES.findIndex(e => e.name === '百度')),

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
    this.bindCrossTabSync(); // P3-2

    // 组件初始化统一由 applyComponentVisibility 按可见性触发（首次可见时执行一次）
    // 任一初始化失败不阻塞页面其余功能，仅记录错误
    await Promise.all([Wallpaper.init(), Settings.init()]).catch(err => {
      console.error('组件初始化失败:', err);
    });
  },

  /* P3-2：多标签页同步——新标签页常被同时打开多个，在一个标签页里的改动应即时反映到
     其他标签页，否则用户会看到彼此不一致的主页。
     只订阅、不回写，因此不会形成写入循环；设置面板的内联表单不参与同步，
     避免打断用户正在进行的编辑（面板下次打开时自然读到最新数据）。 */
  bindCrossTabSync() {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) return;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.bookmarks) this.renderBookmarks();
      if (changes.categories) this.renderCategories();
      if (changes.todos && typeof Todos !== 'undefined') Todos.render();
      if (changes.settings && changes.settings.newValue) this.applySettings(changes.settings.newValue);
    });
  },

  applySettings(settings) {
    // 底部工具栏开关仅隐藏壁纸按钮；设置按钮是唯一入口，必须始终可见，否则无法再次进入设置
    const wallpaperBtn = document.getElementById('wallpaperBtn');
    if (wallpaperBtn) {
      // 与 settings.js 的判定口径保持一致：undefined 视为默认显示（P3-8）
      wallpaperBtn.classList.toggle('hidden', settings.showBottomBar === false);
    }
    // V3 主题：默认深色，浅色时切换；PBI-10「跟随壁纸」按当前壁纸明度解析
    let theme = settings.theme === 'light' ? 'light' : 'dark';
    if (settings.theme === 'auto') {
      const wp = typeof Wallpaper !== 'undefined' ? Wallpaper.getWallpapers()[Wallpaper.currentIndex] : null;
      theme = wp && wp.themeHint === 'light' ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = theme;
    // V3 组件可见性：按注册表隐藏/显示主页区块
    this.applyComponentVisibility(settings);
  },

  isComponentVisible(component, settings) {
    if (component.locked) return true;
    return (settings.componentVisibility || {})[component.id] !== false;
  },

  applyComponentVisibility(settings) {
    COMPONENTS.forEach(c => {
      const el = document.querySelector(`[data-component="${c.id}"]`);
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
      // UX-04：输入法合成期间的回车是"确认候选词"，不是"提交搜索"
      if (isCommitEnter(e)) this.doSearch();
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

    document.getElementById('wallpaperBtn').addEventListener('click', async () => {
      await Wallpaper.next();
      // UX-11：此前切换壁纸只有背景变化，没有文字反馈，
      // 用户不知道切到了哪张、也不知道还有没有下一张
      if (typeof Toast === 'undefined') return;
      const list = Wallpaper.getWallpapers();
      const current = list[Wallpaper.currentIndex];
      if (current) {
        Toast.show(`壁纸：${current.name} · ${Wallpaper.currentIndex + 1}/${list.length}`, { duration: 2000 });
      }
    });

    // PBI-18 搜索快捷键（US-22）：/ 聚焦搜索框；Esc 清空并失焦；输入聚焦时不冲突
    // UX-15 扩展：数字键 1-9 打开第 N 个书签；? 弹出快捷键速查
    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target.isContentEditable === true);
      const overlay = document.getElementById('settingsOverlay');
      const settingsOpen = !!(overlay && overlay.classList.contains('open'));
      // UI 审查 P2：设置面板打开时 "/" 仍会把焦点抢到背后的搜索框（1-9、? 已有守卫）
      if (e.key === '/' && !isTyping && !settingsOpen) {
        e.preventDefault();
        searchInput.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.value = '';
        searchClear.classList.remove('visible');
        searchInput.blur();
      } else if (/^[1-9]$/.test(e.key) && !isTyping && !settingsOpen
        && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // 打开第 N 个快捷书签。带修饰键时不拦截，保留浏览器自身的快捷键
        this.openBookmarkByIndex(Number(e.key) - 1);
      } else if (e.key === '?' && !isTyping && !settingsOpen) {
        e.preventDefault();
        if (typeof Toast !== 'undefined') {
          Toast.show('快捷键：/ 搜索 · 1-9 打开书签 · Esc 取消', { duration: 4000 });
        }
      }
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
    // UX-03：先判定是网址还是搜索词——placeholder 承诺了"搜索或输入网址"
    const resolved = resolveInput(query);
    if (resolved.type === 'url') {
      window.location.href = resolved.target;
      return;
    }
    const encoded = encodeURIComponent(resolved.target);
    const searchUrl = SEARCH_ENGINES[this.currentEngine].url.replace('{query}', encoded);
    window.location.href = searchUrl;
  },

  /* UX-15：数字键快捷打开第 N 个书签（按主页当前显示顺序，即 sortOrder） */
  openBookmarkByIndex(index) {
    const items = document.querySelectorAll('#bookmarkContainer .bookmark-item');
    const target = items[index];
    if (!target || !target.href) return false;
    window.location.href = target.href;
    return true;
  },

  startClock() {
    if (this._clockStarted) return;
    this._clockStarted = true;
    const el = document.getElementById('datetime');
    let hoverCardMounted = false;
    let mountedDateKey = '';

    function update() {
      const now = new Date();
      const options = {
        year: 'numeric', month: 'long', day: 'numeric',
        weekday: 'long'
      };
      const dateStr = now.toLocaleDateString('zh-CN', options);
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      // P3-3：卡片里的"今天"高亮与节假日倒计时都基于渲染时刻的日期，
      // 标签页常驻跨过午夜后会停留在昨天，因此日期变化时需重建卡片而非只更新文本
      const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const needMount = (!hoverCardMounted || dateKey !== mountedDateKey)
        && typeof Calendar !== 'undefined' && Calendar.loaded;

      if (needMount) {
        // UI 审查 P2：日期文本是浮层的触发器，补 role/tabindex/aria-expanded
        // 使其可被键盘与读屏器识别（日历卡片内的翻页按钮保持独立可聚焦）
        el.innerHTML = `<span class="datetime-text" role="button" tabindex="0" aria-expanded="false">${dateStr}  ${timeStr}</span>${Calendar.render()}`;
        hoverCardMounted = true;
        mountedDateKey = dateKey;
        const card = el.querySelector('.datetime-hover-card');
        if (card) Calendar.bindCardEvents(card);
        const trigger = el.querySelector('.datetime-text');
        if (trigger) trigger.setAttribute('aria-expanded', String(el.classList.contains('show-card')));
      } else {
        const textEl = el.querySelector('.datetime-text');
        const target = textEl || el;
        target.textContent = `${dateStr}  ${timeStr}`;
      }
    }
    update();
    setInterval(update, 1000);

    // UI 审查 P2：触屏没有 hover、键盘也无法触发，浮层此前只有鼠标可达。
    // 点击/Enter/Space 切换，并与 aria-expanded 保持同步（文本节点每次重建，需实时查询）
    const setCardOpen = (open) => {
      el.classList.toggle('show-card', open);
      const trigger = el.querySelector('.datetime-text');
      if (trigger) trigger.setAttribute('aria-expanded', String(open));
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('.datetime-hover-card')) return;
      setCardOpen(!el.classList.contains('show-card'));
    });
    el.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('datetime-text')) return;
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        setCardOpen(!el.classList.contains('show-card'));
      }
    });
    document.addEventListener('click', (e) => {
      if (!el.contains(e.target)) setCardOpen(false);
    });
  },

  async renderBookmarks() {
    const container = document.getElementById('bookmarkContainer');
    const bookmarks = await Storage.getBookmarks();
    bookmarks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // UX-09：空状态此前只有一行 11px 低对比度小字，没有任何可点的入口，
    // 新用户（或清空预设数据后）在此处会卡住。改为"说明 + 主行动按钮"。
    if (bookmarks.length === 0) {
      // 空状态要把网格切成单列（见 styles/main.css 的 .links-grid.is-empty）：
      // repeat(auto-fit, 68px) 在没有任何 bookmark-cell 时会把空轨道全部折成 0px，
      // 空状态块被压进 52px、文案竖排。用类而不是 CSS :has()——后者要 Chrome 105+，
      // 而本项目其余 CSS 的最低门槛只到 aspect-ratio（Chrome 88）。
      container.classList.add('is-empty');
      container.innerHTML = `
        <div class="empty-state-block">
          <div class="empty-hint">还没有书签</div>
          <div class="empty-actions">
            <button type="button" class="btn-primary" data-empty-action="add-bookmark">添加第一个书签</button>
            <button type="button" class="btn-ghost" data-empty-action="import-bookmarks">从浏览器导入</button>
          </div>
        </div>`;
      const addBtn = container.querySelector('[data-empty-action="add-bookmark"]');
      if (addBtn) {
        addBtn.addEventListener('click', async () => {
          Settings.open();
          Settings.switchTab('bookmarks');
          // 必须等 open() 里那次异步列表渲染完成再插入表单，
          // 否则 renderBookmarks 的 innerHTML 赋值会把刚 prepend 的表单抹掉
          await Settings.renderBookmarks();
          Settings.showAddBookmarkForm();
        });
      }
      const importBtn = container.querySelector('[data-empty-action="import-bookmarks"]');
      if (importBtn) {
        importBtn.addEventListener('click', () => {
          Settings.open();
          Settings.switchTab('data');
        });
      }
      return;
    }

    // UX-12：每个书签包一层 cell —— <a> 负责导航，删除按钮作为兄弟节点绝对定位在右上角。
    // 不把 <button> 放进 <a> 里：那是无效 HTML，浏览器会把按钮移出链接。
    // draggable 也从 <a> 移到 cell：拖拽逻辑按 [draggable="true"] 收集元素，
    // 搬 cell 才能让删除按钮跟着一起走，否则重排后按钮会留在原地。
    const showQuickAdd = (await Storage.getSettings()).showQuickAdd !== false;
    container.classList.remove('is-empty');
    container.innerHTML = bookmarks.map(bm => {
      const domain = this.extractDomain(bm.url);
      // 属性值上下文用 escapeAttr（escapeHtml 不转义引号，标题首字符为 " 时会提前闭合属性）
      const firstChar = escapeAttr(bm.title.charAt(0));
      return `
      <div class="bookmark-cell" draggable="true" data-id="${escapeAttr(bm.id)}">
        <a href="${escapeAttr(bm.url)}" class="bookmark-item" title="${escapeAttr(bm.title)}" target="_blank">
          <div class="bookmark-icon">
            <img src="https://favicon.im/${domain}"
                 alt="${escapeAttr(bm.title)}"
                 data-domain="${domain}"
                 data-char="${firstChar}">
          </div>
          <span class="bookmark-title">${escapeHtml(bm.title)}</span>
        </a>
        <button type="button" class="bookmark-remove" data-remove-id="${escapeAttr(bm.id)}"
                aria-label="删除书签 ${escapeAttr(bm.title)}" title="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" width="10" height="10" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>`}).join('') + (showQuickAdd ? `
      <button type="button" class="bookmark-item bookmark-tile-add" data-quick-add="1" aria-label="添加书签">
        <span class="bookmark-icon bookmark-add-icon" aria-hidden="true">+</span>
        <span class="bookmark-title">添加</span>
      </button>` : '');

    // UX-12：主页直接添加，不必"设置 → 书签 → 添加 → 填表"四步
    const quickAdd = container.querySelector('[data-quick-add="1"]');
    if (quickAdd) {
      quickAdd.addEventListener('click', async () => {
        Settings.open();
        Settings.switchTab('bookmarks');
        // 等 open() 里那次异步列表渲染完成再插表单，否则会被 innerHTML 赋值抹掉
        await Settings.renderBookmarks();
        Settings.showAddBookmarkForm();
      });
    }

    // UX-12：主页直接删除，并给 5 秒撤销窗口（与待办删除同一套交互约定）
    container.querySelectorAll('.bookmark-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        // cell 上有 draggable，不阻止的话点击可能被拖拽逻辑吞掉
        e.preventDefault();
        e.stopPropagation();
        const id = btn.dataset.removeId;
        const all = await Storage.getBookmarks();
        const removed = all.find(b => b.id === id);
        await Storage.deleteBookmark(id);
        await this.renderBookmarks();
        if (removed && typeof Toast !== 'undefined') {
          const label = removed.title.length > 12 ? removed.title.slice(0, 12) + '…' : removed.title;
          Toast.show(`已删除「${label}」`, {
            actionLabel: '撤销',
            duration: 5000,
            onAction: async () => {
              await Storage.restoreBookmark(removed);
              await this.renderBookmarks();
            }
          });
        }
      });
    });

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

    // UX-09：同书签区，空状态给出可直接点击的入口
    if (categories.length === 0) {
      container.innerHTML = `
        <div class="empty-state-block">
          <div class="empty-hint">还没有分类</div>
          <div class="empty-actions">
            <button type="button" class="btn-primary" data-empty-action="add-category">添加第一个分类</button>
          </div>
        </div>`;
      const addBtn = container.querySelector('[data-empty-action="add-category"]');
      if (addBtn) {
        addBtn.addEventListener('click', async () => {
          Settings.open();
          Settings.switchTab('categories');
          await Settings.renderCategories(); // 同书签区：等渲染完成再插表单
          Settings.showAddCategoryForm();
        });
      }
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="category-card" data-id="${escapeAttr(cat.id)}" draggable="true">
        <!-- UI 审查 P2：分类头是 div 上的点击交互，键盘与读屏器都不可达；
             补 role/tabindex/aria-expanded，Enter/Space 切换（见下方事件绑定） -->
        <div class="category-header" data-action="toggle" data-id="${escapeAttr(cat.id)}"
             role="button" tabindex="0" aria-expanded="${cat.collapsed ? 'false' : 'true'}">
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
      const toggle = async () => {
        const id = header.dataset.id;
        const categories = await Storage.getCategories();
        const cat = categories.find(c => c.id === id);
        if (cat) {
          cat.collapsed = !cat.collapsed;
          await Storage.updateCategory(id, { collapsed: cat.collapsed });
          await this.renderCategories();
          // 重渲染会替换节点；不恢复的话键盘用户按 Enter 后焦点掉回 body
          const restored = [...container.querySelectorAll('[data-action="toggle"]')]
            .find(h => h.dataset.id === id);
          if (restored) restored.focus();
        }
      };
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          toggle();
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

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => App.init());
}

/* ---- Node 测试环境导出（UX-03）：浏览器以 <script> 全局加载，module 未定义时不执行；
       顶层除上面被守卫的 addEventListener 外无浏览器副作用，Node require 安全 ---- */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveInput, SEARCH_ENGINES, COMMON_TLDS };
}
