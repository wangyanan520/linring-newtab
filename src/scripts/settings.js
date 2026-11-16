const Settings = {
  currentTab: 'content',

  async init() {
    this.bindEvents();
    this.syncTabStop();
    await this.renderBookmarks();
    await this.renderCategories();
    await this.renderWallpaperSettings();
    await this.renderWeatherSettings();
  },

  open() {
    // P2-8：记录触发元素，关闭后归还焦点，避免键盘用户丢失位置
    this._lastFocused = document.activeElement;
    document.getElementById('settingsOverlay').classList.add('open');
    this.renderBookmarks();
    this.renderCategories();
    this.renderWallpaperSettings();
    // 面板停留在上次的 tab 时，对应内容同样需要是最新的（组件/隐私为惰性渲染）
    if (this.currentTab === 'appearance') this.renderComponentsSettings();
    if (this.currentTab === 'data') this.renderPrivacySettings();
    // 模态对话框需把焦点移入面板（面板为 tabindex="-1"），随后 Tab 由 trapFocus 限制在面板内
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.focus();
  },

  close() {
    document.getElementById('settingsOverlay').classList.remove('open');
    if (this._lastFocused && document.contains(this._lastFocused) && typeof this._lastFocused.focus === 'function') {
      this._lastFocused.focus();
    }
  },

  /* P2-8：把 Tab 焦点限制在设置面板内（模态对话框约定） */
  trapFocus(e) {
    const panel = document.querySelector('.settings-panel');
    if (!panel) return;
    // 只收可见且可聚焦的元素（未激活 tab 的内容 display:none，offsetParent 为 null）
    const focusables = Array.from(panel.querySelectorAll(
      'button, [href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])'
    ))
      .filter(el => !el.disabled && el.offsetParent !== null)
      // 折叠组内的控件在 Chromium 里仍保留布局与 offsetParent（details 关闭态用
      // content-visibility 收起），但不可见、原生 Tab 会跳过。不把它们算进首/末元素，
      // 否则焦点陷阱的循环锚点会落在看不见的控件上。summary 本身始终可见，保留。
      .filter(el => {
        const closed = el.closest('details:not([open])');
        return !closed || closed.querySelector(':scope > summary') === el;
      });
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
      return;
    }
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
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

    // 方向 B：竖排 tablist 的方向键切换（roving tabindex，只有当前项在 Tab 序里）
    const nav = document.querySelector('.settings-nav');
    if (nav) {
      nav.addEventListener('keydown', (e) => {
        const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (!keys.includes(e.key)) return;
        e.preventDefault();
        const tabs = Array.from(nav.querySelectorAll('.tab-btn'));
        if (!tabs.length) return;
        const current = tabs.findIndex(t => t.dataset.tab === this.currentTab);
        let next = current >= 0 ? current : 0;
        if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (next - 1 + tabs.length) % tabs.length;
        else next = (next + 1) % tabs.length;
        tabs[next].focus();
        this.switchTab(tabs[next].dataset.tab);
      });
    }

    document.getElementById('addBookmarkBtn').addEventListener('click', () => this.showAddBookmarkForm());
    document.getElementById('addCategoryBtn').addEventListener('click', () => this.showAddCategoryForm());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('settingsOverlay').classList.contains('open')) {
        // 输入框/文本域里按 Esc 是"取消本次输入"的惯用手势，不应连带关掉整个面板（ADV-16）
        const t = e.target;
        const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
        if (!inField) this.close();
      }
      // P2-8：面板打开时限制 Tab 焦点不逃逸到背后的主页
      if (e.key === 'Tab' && document.getElementById('settingsOverlay').classList.contains('open')) {
        this.trapFocus(e);
      }
    });

    this.bindWeatherEvents();
  },

  /* 方向 B：roving tabindex —— 只让当前选中的导航项进入 Tab 序，
     其余项用方向键切换（ARIA tabs 约定） */
  syncTabStop() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.tabIndex = btn.dataset.tab === this.currentTab ? 0 : -1;
    });
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false'); // P2-8：同步选中态
      btn.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === `tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    });

    // 4 个 tab 各自承载一组设置：外观 = 壁纸 + 主页组件，内容 = 书签 + 分类，
    // 数据与隐私 = 备份/导入 + 权限与数据源声明
    if (tab === 'weather') {
      this.renderWeatherSettings();
    }
    if (tab === 'appearance') {
      this.renderWallpaperSettings();
      this.renderComponentsSettings();
    }
    if (tab === 'data') {
      this.renderDataSettings();
      this.renderPrivacySettings();
    }
    // 切回列表 tab 时重建渲染：内联编辑表单是用 replaceWith 把操作按钮整块顶掉的，
    // 只靠 clearInlineForms 删除表单不会把按钮恢复回来（P1-2）
    if (tab === 'content') {
      this.renderBookmarks();
      this.renderCategories();
    }
    // 清理其他 tab 可能残留的内联表单，防止 ID 冲突
    this.clearInlineForms();
  },

  /* PBI-13 隐私可见化（US-15）：权限清单 / 数据声明 / 外部数据源 / 无埋点声明。
     纯静态展示，不请求任何网络，不读取用户数据。 */
  renderPrivacySettings() {
    const tab = document.getElementById('privacySection');
    if (!tab) return;
    if (tab.dataset.rendered) return;
    tab.dataset.rendered = '1';
    // 域名数量取自 manifest，避免权限调整后文案与实际授权漂移（ADV-07：曾写死 4，实际 6）
    let hostCount = 6; // 仅非扩展模式（预览/文件）使用；扩展模式一律以 manifest 为准
    try {
      hostCount = (chrome.runtime.getManifest().host_permissions || []).length;
    } catch (e) {
      // 预览/文件模式没有 chrome.runtime，退化为不显示具体数量
    }
    tab.innerHTML = `
      <div class="setting-section">
        <div class="setting-section-title">权限清单</div>
        <p class="setting-section-desc">本扩展申请的浏览器权限极少，且全部用于本地功能：</p>
        <ul class="privacy-list">
          <li><b>storage</b> — 在浏览器本地保存书签 / 分类 / 待办 / 设置，数据不出本机。</li>
          <li><b>host_permissions（${hostCount} 个域名）</b> — 仅用于主动访问下列外部数据源，不包含任何埋点或追踪服务。</li>
          <li><b>bookmarks（可选，默认不申请）</b> — 仅在你点击"从浏览器导入书签"时弹出授权；只读取、不修改、不上传，拒绝不影响任何其他功能。安装时不会请求该权限。</li>
        </ul>
      </div>
      <div class="setting-section">
        <div class="setting-section-title">数据存储</div>
        <p class="setting-section-desc">书签、分类、待办与设置全部保存在浏览器本地（chrome.storage）。导出备份为本地 JSON 文件，由你自行保管；导入恢复仅发生在你主动操作时。无账号、无云同步。</p>
      </div>
      <div class="setting-section">
        <div class="setting-section-title">外部数据源</div>
        <p class="setting-section-desc">页面功能运行时仅访问以下服务（均可按需关闭对应组件或更换壁纸源）：</p>
        <ul class="privacy-list">
          <li><b>wttr.in</b> — 天气查询主源（天气组件；关闭组件即停止请求）</li>
          <li><b>api.open-meteo.com</b> — 天气查询备用源（仅当主源请求失败时回退，同样随组件关闭而停止）</li>
          <li><b>ipwho.is</b> — IP 定位兜底（仅在未选择城市且浏览器定位不可用时，取一个城市级经纬度用于查天气；不发送任何本地数据）</li>
          <li><b>cn.bing.com</b> — Bing 每日壁纸（壁纸源）</li>
          <li><b>bing.biturl.top</b> — 随机壁纸（壁纸源）</li>
          <li><b>cdn.jsdelivr.net / raw.githubusercontent.com</b> — 节假日数据（离线时使用内置表）</li>
          <li><b>favicon.im</b> — 书签网站图标（请求地址包含书签域名）。该服务不可用时回退为<b>直接请求书签自身域名</b>的 /favicon.ico（若添加了内网站点，会向内网域名发起请求）；仍失败则显示首字符图标</li>
        </ul>
      </div>
      <div class="setting-section">
        <div class="setting-section-title">隐私承诺</div>
        <p class="setting-section-desc">本扩展无广告、无统计埋点、无任何"默认收集"行为；代码开源可审计。</p>
      </div>
    `;
  },

  /* V3 组件管理：按 COMPONENTS 注册表渲染开关，搜索框常驻不可关闭 */
  async renderComponentsSettings() {
    const tab = document.getElementById('componentsSection');
    if (!tab) return;
    const settings = await Storage.getSettings();
    const visibility = settings.componentVisibility || {};

    tab.innerHTML = `
      <div class="setting-section">
        <div class="setting-section-title">组件管理</div>
        <p class="setting-section-desc">选择主页显示哪些区块。搜索框为常驻组件，不可关闭。保存后主页即时生效。</p>
        ${COMPONENTS.map(c => `
          <label class="toggle-row">
            <span>${c.title}${c.locked ? '（常驻）' : ''}</span>
            <input type="checkbox" data-component-id="${c.id}"
              ${c.locked ? 'checked disabled' : ''}
              ${!c.locked && visibility[c.id] !== false ? 'checked' : ''}>
          </label>
        `).join('')}
        <label class="toggle-row">
          <span>快捷添加磁贴</span>
          <input type="checkbox" id="showQuickAddToggle"
            ${settings.showQuickAdd !== false ? 'checked' : ''}>
        </label>
        <p class="setting-section-desc">书签区末尾的「+」磁贴，用于在主页直接添加书签；关闭后仍可从设置面板添加。</p>
        <div class="todo-save-feedback" id="componentFeedback" style="margin-top: 10px;"></div>
      </div>
    `;

    tab.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', async () => {
        // UX-12：快捷添加磁贴不是 COMPONENTS 里的独立区块（它属于书签区的一部分），
        // 因此单独处理，写 settings.showQuickAdd 而不是 componentVisibility
        if (input.id === 'showQuickAddToggle') {
          await Storage.updateSettings({ showQuickAdd: input.checked });
          await App.renderBookmarks();
        } else {
          const id = input.dataset.componentId;
          await Storage.setComponentVisible(id, input.checked);
          const s = await Storage.getSettings();
          App.applyComponentVisibility(s);
        }
        const fb = document.getElementById('componentFeedback');
        if (fb) {
          fb.textContent = '主页已更新';
          fb.className = 'todo-save-feedback feedback-success';
        }
      });
    });

    // 方向 B：组件管理是常用区块，默认展开
    const section = tab.querySelector('.setting-section');
    if (section) tab.appendChild(this.wrapSectionAsGroup(section, true, 'components'));
  },

  clearInlineForms() {
    const ids = ['bookmarkForm', 'categoryForm', 'itemForm', 'editItemForm', 'editBookmarkForm', 'editCategoryForm'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  },

  /* 方向 B：把已有的 .setting-section 包成可折叠分组。
     原标题移入 summary，说明/控件/列表留在展开体里，避免标题重复出现。 */
  wrapSectionAsGroup(section, open, group) {
    const titleEl = section.querySelector('.setting-section-title');
    const title = titleEl ? titleEl.textContent.trim() : '';
    if (titleEl) titleEl.remove();

    const details = document.createElement('details');
    details.className = 'settings-group';
    if (group) details.dataset.group = group;
    details.open = open;

    const summary = document.createElement('summary');
    summary.className = 'settings-group-summary';
    const titleSpan = document.createElement('span');
    titleSpan.className = 'settings-group-title';
    titleSpan.textContent = title;
    summary.appendChild(titleSpan);
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'settings-group-body';
    body.appendChild(section);
    details.appendChild(body);
    return details;
  },

  async renderBookmarks() {
    const container = document.getElementById('bookmarkList');
    const bookmarks = await Storage.getBookmarks();
    bookmarks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    // 方向 B：折叠后靠分组标题旁的计数保留"里面有多少条"的信息
    const meta = document.getElementById('bookmarkGroupMeta');
    if (meta) meta.textContent = `${bookmarks.length} 项`;

    if (bookmarks.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无书签，点击上方按钮添加</div>';
      return;
    }

    container.innerHTML = bookmarks.map(bm => `
      <div class="setting-item" data-id="${escapeAttr(bm.id)}">
        <div class="setting-item-info">
          <span class="setting-item-title">${escapeHtml(bm.title)}</span>
          <span class="setting-item-url">${escapeHtml(bm.url)}</span>
        </div>
        <div class="setting-item-actions">
          <button class="btn-edit btn-sm" data-action="move-bookmark" data-id="${escapeAttr(bm.id)}" data-dir="up" title="上移">↑</button>
          <button class="btn-edit btn-sm" data-action="move-bookmark" data-id="${escapeAttr(bm.id)}" data-dir="down" title="下移">↓</button>
          <button class="btn-edit" data-action="edit-bookmark" data-id="${escapeAttr(bm.id)}">编辑</button>
          <button class="btn-danger" data-action="delete-bookmark" data-id="${escapeAttr(bm.id)}">删除</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-action="edit-bookmark"]').forEach(btn => {
      btn.addEventListener('click', () => this.showEditBookmarkForm(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="delete-bookmark"]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteBookmark(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="move-bookmark"]').forEach(btn => {
      btn.addEventListener('click', async () => this.moveItem('bookmark', btn.dataset.id, btn.dataset.dir));
    });
  },

  async renderCategories() {
    const container = document.getElementById('categoryList');
    const categories = await Storage.getCategories();
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    // 方向 B：折叠态下的引导信息（"添加分类"随分组展开才出现）
    const meta = document.getElementById('categoryGroupMeta');
    if (meta) meta.textContent = `${categories.length} 个分类`;

    if (categories.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无分类，点击上方按钮添加</div>';
      return;
    }

    container.innerHTML = categories.map(cat => `
      <div class="category-with-items" data-id="${escapeAttr(cat.id)}">
        <div class="setting-item">
          <div class="setting-item-info">
            <span class="setting-item-title">${escapeHtml(cat.title)}</span>
          </div>
          <div class="setting-item-actions">
            <button class="btn-edit btn-sm" data-action="move-category" data-id="${escapeAttr(cat.id)}" data-dir="up" title="上移">↑</button>
            <button class="btn-edit btn-sm" data-action="move-category" data-id="${escapeAttr(cat.id)}" data-dir="down" title="下移">↓</button>
            <button class="btn-primary btn-sm" data-action="add-item" data-id="${escapeAttr(cat.id)}">+ 添加链接</button>
            <button class="btn-edit" data-action="edit-category" data-id="${escapeAttr(cat.id)}">编辑</button>
            <button class="btn-danger" data-action="delete-category" data-id="${escapeAttr(cat.id)}">删除</button>
          </div>
        </div>
        <div class="category-sub-items">
          ${(cat.items || []).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(item => `
            <div class="sub-item" data-id="${escapeAttr(item.id)}" data-cat-id="${escapeAttr(cat.id)}">
              <div class="setting-item-info">
                <span class="setting-item-title">${escapeHtml(item.title)}</span>
                <span class="setting-item-url">${escapeHtml(item.url)}</span>
              </div>
              <div class="setting-item-actions">
                <button class="btn-edit" data-action="edit-item" data-cat-id="${escapeAttr(cat.id)}" data-item-id="${escapeAttr(item.id)}">编辑</button>
                <button class="btn-danger" data-action="delete-item" data-cat-id="${escapeAttr(cat.id)}" data-item-id="${escapeAttr(item.id)}">删除</button>
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
    container.querySelectorAll('[data-action="move-category"]').forEach(btn => {
      btn.addEventListener('click', async () => this.moveItem('category', btn.dataset.id, btn.dataset.dir));
    });
    container.querySelectorAll('[data-action="edit-item"]').forEach(btn => {
      btn.addEventListener('click', () => this.showEditItemForm(btn.dataset.catId, btn.dataset.itemId));
    });
    container.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
      btn.addEventListener('click', () => this.deleteCategoryItem(btn.dataset.catId, btn.dataset.itemId));
    });
  },

  /* 键盘替代排序：上移/下移 */
  async moveItem(type, id, dir) {
    const getList = type === 'bookmark' ? Storage.getBookmarks : Storage.getCategories;
    const reorderFn = type === 'bookmark' ? Storage.reorderBookmarks : Storage.reorderCategories;
    const rerender = type === 'bookmark' ? () => this.renderBookmarks() : () => this.renderCategories();
    // 箭头函数包装保持 this 绑定（直接解构 App.renderBookmarks 会丢失 this 导致 TypeError）
    const appRerender = type === 'bookmark' ? () => App.renderBookmarks() : () => App.renderCategories();

    const list = await getList();
    list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const idx = list.findIndex(item => item.id === id);
    const to = dir === 'up' ? idx - 1 : idx + 1;
    if (idx === -1 || to < 0 || to >= list.length) return;

    await reorderFn(idx, to);
    await rerender();
    appRerender();
  },

  showAddBookmarkForm() {
    const container = document.getElementById('bookmarkList');
    // 清理旧表单防止 ID 冲突
    const oldForm = document.getElementById('bookmarkForm');
    if (oldForm) oldForm.remove();
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
      const titleEl = document.getElementById('bmTitle');
      const urlEl = document.getElementById('bmUrl');
      const title = titleEl.value.trim();
      const url = normalizeUrl(urlEl.value.trim());
      // 校验失败时用原生校验 UI 提示，而不是静默 return（P2-13；协议白名单见 P2-1）
      titleEl.setCustomValidity(title ? '' : '请填写名称');
      urlEl.setCustomValidity(url ? '' : '请输入合法网址（支持 http / https / chrome-extension）');
      if (!titleEl.reportValidity() || !urlEl.reportValidity()) return;
      await Storage.addBookmark({ title, url });
      form.remove();
      await this.renderBookmarks();
      App.renderBookmarks();
    });

    document.getElementById('cancelBookmark').addEventListener('click', () => form.remove());
    document.getElementById('bmTitle').focus();
  },

  async showEditBookmarkForm(id) {
    // 已有其他编辑表单时先重建列表：内联表单是用 replaceWith 整块顶掉操作按钮的，
    // 只 remove 表单会让上一行永久失去"编辑/删除"按钮（与 P1-2 同源）
    if (document.getElementById('editBookmarkForm')) {
      await this.renderBookmarks();
    }
    const items = document.querySelectorAll(`#bookmarkList .setting-item[data-id="${id}"]`);
    const item = items[0];
    if (!item) return;

    const title = item.querySelector('.setting-item-title').textContent;
    const url = item.querySelector('.setting-item-url').textContent;
    const actions = item.querySelector('.setting-item-actions');

    const form = document.createElement('div');
    form.id = 'editBookmarkForm';
    form.className = 'inline-form';
    form.innerHTML = `
      <input type="text" id="editBmTitle" value="${escapeAttr(title)}" required>
      <input type="url" id="editBmUrl" value="${escapeAttr(url)}" required>
      <button class="btn-primary" id="saveEditBookmark">保存</button>
      <button class="btn-edit" id="cancelEditBookmark">取消</button>
    `;
    actions.replaceWith(form);

    // 查询限定在 form 内：即使页面上意外出现同 ID 元素也不会串扰
    form.querySelector('#saveEditBookmark').addEventListener('click', async () => {
      const titleEl = form.querySelector('#editBmTitle');
      const urlEl = form.querySelector('#editBmUrl');
      const newTitle = titleEl.value.trim();
      const newUrl = normalizeUrl(urlEl.value.trim());
      titleEl.setCustomValidity(newTitle ? '' : '请填写名称');
      urlEl.setCustomValidity(newUrl ? '' : '请输入合法网址（支持 http / https / chrome-extension）');
      if (!titleEl.reportValidity() || !urlEl.reportValidity()) return;
      await Storage.updateBookmark(id, { title: newTitle, url: newUrl });
      await this.renderBookmarks();
      App.renderBookmarks();
    });

    form.querySelector('#cancelEditBookmark').addEventListener('click', () => {
      this.renderBookmarks();
    });
  },

  async deleteBookmark(id) {
    if (!this._confirm('确定删除此书签？')) return;
    await Storage.deleteBookmark(id);
    await this.renderBookmarks();
    App.renderBookmarks();
  },

  showAddCategoryForm() {
    const container = document.getElementById('categoryList');
    // 清理旧表单防止 ID 冲突
    const oldForm = document.getElementById('categoryForm');
    if (oldForm) oldForm.remove();
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
      const titleEl = document.getElementById('catTitle');
      const title = titleEl.value.trim();
      titleEl.setCustomValidity(title ? '' : '请填写分类名称');
      if (!titleEl.reportValidity()) return;
      await Storage.addCategory({ title });
      form.remove();
      await this.renderCategories();
      App.renderCategories();
    });

    document.getElementById('cancelCategory').addEventListener('click', () => form.remove());
    document.getElementById('catTitle').focus();
  },

  async showEditCategoryForm(id) {
    // 同 showEditBookmarkForm：先重建列表，避免上一行操作按钮被永久顶掉
    if (document.getElementById('editCategoryForm')) {
      await this.renderCategories();
    }
    const containers = document.querySelectorAll(`#categoryList .category-with-items[data-id="${id}"]`);
    const container = containers[0];
    if (!container) return;

    const titleEl = container.querySelector('.setting-item .setting-item-title');
    const currentTitle = titleEl.textContent;
    const actions = container.querySelector('.setting-item .setting-item-actions');

    const form = document.createElement('div');
    form.id = 'editCategoryForm';
    form.className = 'inline-form';
    form.innerHTML = `
      <input type="text" id="editCatTitle" value="${escapeAttr(currentTitle)}" required>
      <button class="btn-primary" id="saveEditCategory">保存</button>
      <button class="btn-edit" id="cancelEditCategory">取消</button>
    `;
    actions.replaceWith(form);

    // 查询限定在 form 内：即使页面上意外出现同 ID 元素也不会串扰
    form.querySelector('#saveEditCategory').addEventListener('click', async () => {
      const titleEl = form.querySelector('#editCatTitle');
      const newTitle = titleEl.value.trim();
      titleEl.setCustomValidity(newTitle ? '' : '请填写分类名称');
      if (!titleEl.reportValidity()) return;
      await Storage.updateCategory(id, { title: newTitle });
      await this.renderCategories();
      App.renderCategories();
    });

    form.querySelector('#cancelEditCategory').addEventListener('click', () => {
      this.renderCategories();
    });
  },

  async deleteCategory(id) {
    if (!this._confirm('确定删除此分类及其所有链接？')) return;
    await Storage.deleteCategory(id);
    await this.renderCategories();
    App.renderCategories();
  },

  showAddItemForm(categoryId) {
    const container = document.querySelector(`.category-with-items[data-id="${categoryId}"] .category-sub-items`);
    if (!container) return;

    // 清理旧表单防止 ID 冲突
    const oldForm = document.getElementById('itemForm');
    if (oldForm) oldForm.remove();
    const form = document.createElement('div');
    form.id = 'itemForm';
    form.className = 'inline-form-sub';
    form.innerHTML = `
      <input type="text" id="itemTitle" placeholder="名称" class="input-sm-name" required>
      <input type="url" id="itemUrl" placeholder="网址" class="input-sm-url" required>
      <button class="btn-primary btn-sm" id="saveItem">保存</button>
      <button class="btn-edit btn-sm" id="cancelItem">取消</button>
    `;
    container.appendChild(form);

    document.getElementById('saveItem').addEventListener('click', async () => {
      const titleEl = document.getElementById('itemTitle');
      const urlEl = document.getElementById('itemUrl');
      const title = titleEl.value.trim();
      const url = normalizeUrl(urlEl.value.trim());
      titleEl.setCustomValidity(title ? '' : '请填写名称');
      urlEl.setCustomValidity(url ? '' : '请输入合法网址（支持 http / https / chrome-extension）');
      if (!titleEl.reportValidity() || !urlEl.reportValidity()) return;
      await Storage.addCategoryItem(categoryId, { title, url });
      form.remove();
      await this.renderCategories();
      App.renderCategories();
    });

    document.getElementById('cancelItem').addEventListener('click', () => form.remove());
    document.getElementById('itemTitle').focus();
  },

  async showEditItemForm(categoryId, itemId) {
    // 同 showEditBookmarkForm：先重建列表，避免上一行操作按钮被永久顶掉
    if (document.getElementById('editItemForm')) {
      await this.renderCategories();
    }
    const subItem = document.querySelector(`.sub-item[data-id="${itemId}"][data-cat-id="${categoryId}"]`);
    if (!subItem) return;

    const title = subItem.querySelector('.setting-item-title').textContent;
    const url = subItem.querySelector('.setting-item-url').textContent;
    const actions = subItem.querySelector('.setting-item-actions');

    const form = document.createElement('div');
    form.id = 'editItemForm';
    form.className = 'inline-form-sub';
    form.innerHTML = `
      <input type="text" id="editItemTitle" value="${escapeAttr(title)}" class="input-sm-name" required>
      <input type="url" id="editItemUrl" value="${escapeAttr(url)}" class="input-sm-url" required>
      <button class="btn-primary btn-sm" id="saveEditItem">保存</button>
      <button class="btn-edit btn-sm" id="cancelEditItem">取消</button>
    `;
    actions.replaceWith(form);

    document.getElementById('saveEditItem').addEventListener('click', async () => {
      const titleEl = document.getElementById('editItemTitle');
      const urlEl = document.getElementById('editItemUrl');
      const newTitle = titleEl.value.trim();
      const newUrl = normalizeUrl(urlEl.value.trim());
      titleEl.setCustomValidity(newTitle ? '' : '请填写名称');
      urlEl.setCustomValidity(newUrl ? '' : '请输入合法网址（支持 http / https / chrome-extension）');
      if (!titleEl.reportValidity() || !urlEl.reportValidity()) return;
      await Storage.updateCategoryItem(categoryId, itemId, { title: newTitle, url: newUrl });
      await this.renderCategories();
      App.renderCategories();
    });

    document.getElementById('cancelEditItem').addEventListener('click', () => {
      this.renderCategories();
    });
  },

  async deleteCategoryItem(categoryId, itemId) {
    if (!this._confirm('确定删除此链接？')) return;
    await Storage.deleteCategoryItem(categoryId, itemId);
    await this.renderCategories();
    App.renderCategories();
  },

  async renderWeatherSettings() {
    const provSelect = document.getElementById('weatherProvinceSelect');
    const citySelect = document.getElementById('weatherCitySelect');
    if (!provSelect || !citySelect) return;

    // 城市数据惰性加载：天气组件被隐藏时 Weather.init 不会执行，需在此兜底
    if (WEATHER_PROVINCES.length === 0) await loadCityData();

    const settings = await Storage.getSettings();
    const currentQuery = settings.weatherCity || '';

    const found = findCityByQuery(currentQuery);
    const savedProvince = found ? found.province : '自动定位';
    const savedCityQuery = found ? found.city.query : '';

    provSelect.innerHTML = WEATHER_PROVINCES.map(p => `
      <option value="${escapeAttr(p.name)}" ${p.name === savedProvince ? 'selected' : ''}>${escapeHtml(p.name)}</option>
    `).join('');

    this.updateCityDropdown(savedProvince, savedCityQuery);
  },

  /* UX-10：从浏览器书签导入。
     权限走 optional_permissions，默认不申请——只有用户点这个按钮时才弹授权，
     拒绝也不影响任何其他功能。读取是只读的，不写回浏览器书签。
     合并策略：同名分类追加链接，其余作为新分类追加，绝不覆盖用户已有数据。 */
  async importFromBrowserBookmarks() {
    if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.bookmarks) {
      this.showDataFeedback('当前环境读不到浏览器书签（仅扩展安装后可用，预览模式不支持）', 'error');
      return;
    }
    try {
      const tree = await new Promise((resolve, reject) => {
        chrome.bookmarks.getTree(result => {
          const err = chrome.runtime && chrome.runtime.lastError;
          if (err) reject(new Error(err.message || '读取浏览器书签失败'));
          else resolve(result);
        });
      });
      const categories = bookmarksTreeToCategories(tree, { scope: 'all' });
      const itemCount = categories.reduce((n, c) => n + c.items.length, 0);
      if (!itemCount) {
        this.showDataFeedback('没有读到可导入的书签（只导入 http/https 地址）', 'error');
        return;
      }
      // 与 JSON 导入共用同一套导入前备份，导入后可用"恢复最近备份"回滚
      await Storage.backupBeforeImport();
      const existing = await Storage.getCategories();
      const byTitle = new Map(existing.map(c => [String(c.title || '').trim(), c]));
      for (const cat of categories) {
        const title = cat.title.trim();
        let target = byTitle.get(title);
        if (!target) {
          target = await Storage.addCategory({ title });
          byTitle.set(title, target);
        }
        for (const item of cat.items) {
          await Storage.addCategoryItem(target.id, { title: item.title, url: item.url });
        }
      }
      await this.renderCategories();
      App.renderCategories();
      this.showDataFeedback(`已从浏览器导入 ${itemCount} 个书签，分入 ${categories.length} 个分类`, 'success');
    } catch (err) {
      this.showDataFeedback('导入失败：' + (err && err.message ? err.message : err), 'error');
    }
  },

  async renderDataSettings() {
    const tab = document.getElementById('dataSection');
    if (!tab) return;
    tab.innerHTML = `
      <div class="setting-section">
        <div class="setting-section-title">数据备份</div>
        <p class="setting-section-desc">导出全部配置（书签 / 分类 / 待办 / 设置）为本地 JSON 文件；导入可完整恢复。备份文件仅保存在本地，不经过任何服务器；页面功能会请求外部数据源（天气 / 壁纸 / 节假日 / 书签图标），无广告、无埋点。</p>
        <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button class="btn-primary btn-sm" id="exportDataBtn">导出备份</button>
          <label class="btn-edit btn-sm" style="cursor: pointer; display: inline-flex; align-items: center;">导入恢复
            <input type="file" id="importDataInput" accept="application/json,.json" style="display: none;">
          </label>
          <button class="btn-edit btn-sm" id="restoreBackupBtn" title="恢复到最近一次导入前的数据">恢复最近备份</button>
        </div>
        <div class="todo-save-feedback" id="dataFeedback" style="margin-top: 10px;"></div>
      </div>
      <div class="setting-section">
        <div class="setting-section-title">从浏览器导入</div>
        <p class="setting-section-desc">把浏览器已有的书签一键搬进来，按原文件夹分好类，不必逐条录入。需要你点击按钮时临时授权读取书签；本扩展只读取、不修改、不上传，拒绝授权不影响其他功能。</p>
        <div style="margin-top: 10px;">
          <button class="btn-primary btn-sm" id="importBrowserBookmarksBtn">从浏览器导入书签</button>
        </div>
      </div>
    `;

    document.getElementById('exportDataBtn').addEventListener('click', async () => {
      try {
        const data = await Storage.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        // 用本地日期命名（toISOString 为 UTC，北京时间凌晨 0-8 点会差一天）
        const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        a.download = `lingrui-nav-backup-${localDate}.json`;
        a.click();
        // 延迟释放 object URL，避免个别浏览器在下载尚未开始时中断
        setTimeout(() => URL.revokeObjectURL(url), 0);
        this.showDataFeedback('备份已导出', 'success');
      } catch (err) {
        this.showDataFeedback('导出失败：' + err.message, 'error');
      }
    });

    document.getElementById('importDataInput').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        // 导入前记录各类型数量，用于检测备份中空数组导致的"清空"
        const [beforeBookmarks, beforeCategories, beforeTodos] = await Promise.all([
          Storage.getBookmarks(),
          Storage.getCategories(),
          Storage.getTodos()
        ]);
        const before = {
          bookmarks: beforeBookmarks.length,
          categories: beforeCategories.length,
          todos: beforeTodos.length
        };
        const text = await file.text();
        const next = await Storage.importData(text);
        const after = {
          bookmarks: (next.bookmarks || []).length,
          categories: (next.categories || []).length,
          todos: (next.todos || []).length
        };
        const cleared = [];
        if (before.bookmarks > 0 && after.bookmarks === 0) cleared.push('书签');
        if (before.categories > 0 && after.categories === 0) cleared.push('分类');
        if (before.todos > 0 && after.todos === 0) cleared.push('待办');
        const clearedTip = cleared.length > 0
          ? `；注意：${cleared.join('、')}已被清空，如误操作可回滚至导入前备份`
          : '';
        this.showDataFeedback(
          `导入成功：书签 ${after.bookmarks} 个、分类 ${after.categories} 个、待办 ${after.todos} 条${clearedTip}`,
          cleared.length > 0 ? 'error' : 'success'
        );
        // 全量刷新：书签/分类/待办 + 主题/底部栏/组件可见性 + 天气/壁纸。
        // 必须放在主 try 之外：此刻数据已写入成功，刷新界面若抛错不应被误报成
        // "导入失败（现有数据未受影响）"——那会让用户以为数据没变而重复导入（P2-14）
        try {
          await this.refreshAllAfterDataChange();
        } catch (refreshErr) {
          console.error('导入后刷新界面失败:', refreshErr);
        }
      } catch (err) {
        this.showDataFeedback('导入失败：' + err.message + '（现有数据未受影响）', 'error');
      }
    });

    document.getElementById('restoreBackupBtn').addEventListener('click', async () => {
      if (!this._confirm('确定恢复到最近一次导入前的数据？当前数据将被覆盖。')) return;
      try {
        const next = await Storage.restoreLastImportBackup();
        const after = {
          bookmarks: (next.bookmarks || []).length,
          categories: (next.categories || []).length,
          todos: (next.todos || []).length
        };
        this.showDataFeedback(
          `已恢复导入前备份：书签 ${after.bookmarks} 个、分类 ${after.categories} 个、待办 ${after.todos} 条`,
          'success'
        );
        // 同上：恢复已成功，刷新界面失败不应被误报为"恢复失败"（P2-14）
        try {
          await this.refreshAllAfterDataChange();
        } catch (refreshErr) {
          console.error('恢复后刷新界面失败:', refreshErr);
        }
      } catch (err) {
        this.showDataFeedback('恢复失败：' + err.message, 'error');
      }
    });

    // UX-10：权限申请必须在**用户手势的同步调用栈**中发起，
    // 所以这里前置不做任何 await（也不先查 contains —— 已授权时 request 会直接回调 true，
    // 不会重复弹窗）。after 任意 await 再调用会抛
    // "This function must be called during a user gesture"。
    document.getElementById('importBrowserBookmarksBtn').addEventListener('click', () => {
      if (typeof chrome === 'undefined' || !chrome.permissions || !chrome.permissions.request) {
        this.showDataFeedback('当前环境不支持申请书签权限（仅扩展安装后可用）', 'error');
        return;
      }
      chrome.permissions.request({ permissions: ['bookmarks'] }, granted => {
        const err = chrome.runtime && chrome.runtime.lastError;
        if (err || !granted) {
          this.showDataFeedback('未授权读取浏览器书签，导入已取消（可再次点击重试）', 'error');
          return;
        }
        this.importFromBrowserBookmarks();
      });
    });

    // 方向 B：数据备份是主动作（默认展开），浏览器导入低频（默认折叠）
    const sections = Array.from(tab.querySelectorAll(':scope > .setting-section'));
    if (sections.length === 2) {
      tab.appendChild(this.wrapSectionAsGroup(sections[0], true, 'backup'));
      tab.appendChild(this.wrapSectionAsGroup(sections[1], false, 'browser-import'));
    }
  },

  showDataFeedback(msg, type) {
    const fb = document.getElementById('dataFeedback');
    if (!fb) return;
    fb.textContent = msg;
    fb.className = 'todo-save-feedback ' + (type === 'error' ? 'feedback-error' : 'feedback-success');
  },

  /* 数据导入/恢复后全量刷新主页与设置面板，保持主题/天气/壁纸/底部栏同步 */
  async refreshAllAfterDataChange() {
    await this.renderBookmarks();
    await this.renderCategories();
    App.renderBookmarks();
    App.renderCategories();
    Todos.render();
    const s = await Storage.getSettings();
    App.applySettings(s);
    // 同步底部工具栏开关（导入的备份可能改变 showBottomBar；undefined 视为默认 true）
    const bottomBarToggle = document.getElementById('showBottomBarToggle');
    if (bottomBarToggle) bottomBarToggle.checked = s.showBottomBar !== false;
    // 同步壁纸源下拉与刷新按钮可见性（仅当导入值在选项内时更新，避免损坏数据破坏 UI）
    const wallpaperSelect = document.getElementById('wallpaperSourceSelect');
    const wallpaperName = s.wallpaperName || '';
    if (wallpaperSelect && [...wallpaperSelect.options].some(o => o.value === wallpaperName)) {
      wallpaperSelect.value = wallpaperName;
    }
    const refreshBtn = document.getElementById('refreshWallpaperBtn');
    if (refreshBtn) {
      const wp = typeof Wallpaper !== 'undefined' ? Wallpaper.getWallpapers().find(w => w.name === wallpaperName) : null;
      refreshBtn.style.display = wp && wp.type === 'api' ? '' : 'none';
    }
    // 天气组件被隐藏时用户已表达"不联网"，导入备份不应重新发起天气请求（ADV-12）
    const weatherComp = (typeof COMPONENTS !== 'undefined')
      ? COMPONENTS.find(c => c.id === 'weather')
      : null;
    if (typeof Weather !== 'undefined' && (!weatherComp || App.isComponentVisible(weatherComp, s))) {
      Weather.setCity(s.weatherCity || '');
    }
    if (typeof Wallpaper !== 'undefined') Wallpaper.init();
  },

  async renderWallpaperSettings() {
    const tab = document.getElementById('wallpaperSection');
    if (!tab) return;

    // 只渲染一次，后续切换标签时不再重复追加
    if (tab.dataset.rendered) return;
    tab.dataset.rendered = '1';

    const settings = await Storage.getSettings();
    const wallpapers = Wallpaper.getWallpapers();
    const currentName = settings.wallpaperName || wallpapers[0].name;

    // 底部工具栏开关
    const bottomBarSection = document.createElement('div');
    bottomBarSection.className = 'setting-section';
    bottomBarSection.innerHTML = `
      <div class="setting-section-title">底部工具栏</div>
      <p class="setting-section-desc">显示/隐藏底部的壁纸按钮；设置按钮始终保留，便于再次进入设置。</p>
      <label class="toggle-row">
        <span>显示壁纸按钮</span>
        <input type="checkbox" id="showBottomBarToggle" ${settings.showBottomBar !== false ? 'checked' : ''}>
      </label>
    `;
    tab.appendChild(this.wrapSectionAsGroup(bottomBarSection, false, 'toolbar'));
    bottomBarSection.querySelector('#showBottomBarToggle').addEventListener('change', async (e) => {
      const val = e.target.checked;
      await Storage.updateSettings({ showBottomBar: val });
      const wallpaperBtn = document.getElementById('wallpaperBtn');
      if (wallpaperBtn) wallpaperBtn.classList.toggle('hidden', !val);
    });

    // 壁纸源选择
    const section = document.createElement('div');
    section.className = 'setting-section';
    section.innerHTML = `
      <div class="setting-section-title">壁纸源</div>
      <p class="setting-section-desc">选择壁纸来源。预设为渐变背景，在线壁纸每日自动更新（Bing 每日壁纸）或每次刷新随机获取（随机壁纸）。</p>
      <select class="city-select" id="wallpaperSourceSelect">
        ${wallpapers.map(w => `
          <option value="${escapeAttr(w.name)}" ${w.name === currentName ? 'selected' : ''}>
            ${w.name}${w.type === 'api' ? ' 🌐' : ''}
          </option>
        `).join('')}
      </select>
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <button class="btn-primary btn-sm" id="refreshWallpaperBtn" style="${currentName && wallpapers.find(w => w.name === currentName)?.type === 'api' ? '' : 'display:none'}">刷新壁纸</button>
      </div>
    `;
    tab.appendChild(this.wrapSectionAsGroup(section, false, 'wallpaper-source'));

    section.querySelector('#wallpaperSourceSelect').addEventListener('change', async (e) => {
      const name = e.target.value;
      const idx = wallpapers.findIndex(w => w.name === name);
      if (idx !== -1) {
        await Wallpaper.set(idx);
        const refreshBtn = section.querySelector('#refreshWallpaperBtn');
        const wp = wallpapers[idx];
        refreshBtn.style.display = wp.type === 'api' ? '' : 'none';
      }
    });

    section.querySelector('#refreshWallpaperBtn').addEventListener('click', async () => {
      await Wallpaper.refreshCurrent();
    });
  },

  updateCityDropdown(provinceName, selectedQuery) {
    const citySelect = document.getElementById('weatherCitySelect');
    if (!citySelect) return;
    const prov = WEATHER_PROVINCES.find(p => p.name === provinceName);
    if (!prov) return;

    citySelect.innerHTML = prov.cities.map(c => `
      <option value="${escapeAttr(c.query)}" ${c.query === selectedQuery ? 'selected' : ''}>${escapeHtml(c.name)}</option>
    `).join('');
  },

  bindWeatherEvents() {
    const provSelect = document.getElementById('weatherProvinceSelect');
    const citySelect = document.getElementById('weatherCitySelect');
    if (!provSelect || !citySelect) return;

    provSelect.addEventListener('change', () => {
      const prov = provSelect.value;
      const firstCity = WEATHER_PROVINCES.find(p => p.name === prov);
      // cities 可能为空数组（cities.json 加载失败走 fallback 时空省份无城市），防御取空串避免抛 TypeError
      const firstQuery = (firstCity && Array.isArray(firstCity.cities) && firstCity.cities.length > 0)
        ? firstCity.cities[0].query
        : '';
      this.updateCityDropdown(prov, firstQuery);
      if (firstQuery !== undefined) {
        Weather.setCity(firstQuery);
      }
    });

    citySelect.addEventListener('change', async () => {
      const query = citySelect.value;
      await Weather.setCity(query);
    });
  },


  // 安全确认：confirm 异常时按"不确认"处理（宁可不删，避免误删且无恢复手段）
  _confirm(msg) {
    try {
      return confirm(msg);
    } catch (e) {
      console.warn('安全确认不可用，已取消操作：', e);
      return false;
    }
  },
  /* escapeHtml/escapeAttr 定义在 storage.js */
};

/* ---- 自动补全网址协议 ---- */
/* URL 规范化：无协议时补 https://，并按与 storage.js validateBackup 相同的白名单校验协议。
   返回空串表示输入不可用，调用方据此给出提示（P2-1：此前用「是否含 ://」的子串判断，
   javascript:alert(1)//https://x 这类输入可以绕过）。 */
function normalizeUrl(url) {
  if (!url) return '';
  let candidate = url.trim().replace(/^\/+/, '');
  if (!candidate) return '';
  // 无协议前缀时按 https 补全（用户常直接粘贴 example.com）
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) candidate = 'https://' + candidate;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:', 'chrome-extension:'].includes(parsed.protocol)) return '';
    return candidate;
  } catch {
    // 解析失败（含空格、非法主机等）同样视为不可用
    return '';
  }
}
