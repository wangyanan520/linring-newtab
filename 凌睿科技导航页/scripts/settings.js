const Settings = {
  currentTab: 'bookmarks',

  async init() {
    this.bindEvents();
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
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter(el => !el.disabled && el.offsetParent !== null);
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

    document.getElementById('addBookmarkBtn').addEventListener('click', () => this.showAddBookmarkForm());
    document.getElementById('addCategoryBtn').addEventListener('click', () => this.showAddCategoryForm());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      // P2-8：面板打开时限制 Tab 焦点不逃逸到背后的主页
      if (e.key === 'Tab' && document.getElementById('settingsOverlay').classList.contains('open')) {
        this.trapFocus(e);
      }
    });

    this.bindWeatherEvents();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const active = btn.dataset.tab === tab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false'); // P2-8：同步选中态
    });
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === `tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    });

    if (tab === 'weather') {
      this.renderWeatherSettings();
    }
    if (tab === 'wallpaper') {
      this.renderWallpaperSettings();
    }
    if (tab === 'data') {
      this.renderDataSettings();
    }
    if (tab === 'components') {
      this.renderComponentsSettings();
    }
    if (tab === 'privacy') {
      this.renderPrivacySettings();
    }
    // 切回列表 tab 时重建渲染：内联编辑表单是用 replaceWith 把操作按钮整块顶掉的，
    // 只靠 clearInlineForms 删除表单不会把按钮恢复回来（P1-2）
    if (tab === 'bookmarks') {
      this.renderBookmarks();
    }
    if (tab === 'categories') {
      this.renderCategories();
    }
    // 清理其他 tab 可能残留的内联表单，防止 ID 冲突
    this.clearInlineForms();
  },

  /* PBI-13 隐私可见化（US-15）：权限清单 / 数据声明 / 外部数据源 / 无埋点声明。
     纯静态展示，不请求任何网络，不读取用户数据。 */
  renderPrivacySettings() {
    const tab = document.getElementById('tabPrivacy');
    if (!tab) return;
    if (tab.dataset.rendered) return;
    tab.dataset.rendered = '1';
    tab.innerHTML = `
      <div class="setting-section">
        <div class="setting-section-title">权限清单</div>
        <p class="setting-section-desc">本扩展申请的浏览器权限极少，且全部用于本地功能：</p>
        <ul class="privacy-list">
          <li><b>storage</b> — 在浏览器本地保存书签 / 分类 / 待办 / 设置，数据不出本机。</li>
          <li><b>host_permissions（4 个域名）</b> — 仅用于主动访问下列外部数据源，不包含任何埋点或追踪服务。</li>
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
          <li><b>wttr.in</b> — 天气查询（天气组件；关闭组件即停止请求）</li>
          <li><b>cn.bing.com</b> — Bing 每日壁纸（壁纸源）</li>
          <li><b>bing.biturl.top</b> — 随机壁纸（壁纸源）</li>
          <li><b>cdn.jsdelivr.net / raw.githubusercontent.com</b> — 节假日数据（离线时使用内置表）</li>
          <li><b>favicon.im</b> — 书签网站图标（请求地址包含书签域名；加载失败自动回退首字符图标）</li>
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
    const tab = document.getElementById('tabComponents');
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
        <div class="todo-save-feedback" id="componentFeedback" style="margin-top: 10px;"></div>
      </div>
    `;

    tab.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', async () => {
        const id = input.dataset.componentId;
        await Storage.setComponentVisible(id, input.checked);
        const s = await Storage.getSettings();
        App.applyComponentVisibility(s);
        const fb = document.getElementById('componentFeedback');
        if (fb) {
          fb.textContent = '主页已更新';
          fb.className = 'todo-save-feedback feedback-success';
        }
      });
    });
  },

  clearInlineForms() {
    const ids = ['bookmarkForm', 'categoryForm', 'itemForm', 'editItemForm', 'editBookmarkForm', 'editCategoryForm'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
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
      const title = document.getElementById('bmTitle').value.trim();
      const url = normalizeUrl(document.getElementById('bmUrl').value.trim());
      if (!title || !url) return;
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
      const newTitle = form.querySelector('#editBmTitle').value.trim();
      const newUrl = normalizeUrl(form.querySelector('#editBmUrl').value.trim());
      if (!newTitle || !newUrl) return;
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
      const newTitle = form.querySelector('#editCatTitle').value.trim();
      if (!newTitle) return;
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
      const title = document.getElementById('itemTitle').value.trim();
      const url = normalizeUrl(document.getElementById('itemUrl').value.trim());
      if (!title || !url) return;
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
      const newTitle = document.getElementById('editItemTitle').value.trim();
      const newUrl = normalizeUrl(document.getElementById('editItemUrl').value.trim());
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
      <option value="${p.name}" ${p.name === savedProvince ? 'selected' : ''}>${p.name}</option>
    `).join('');

    this.updateCityDropdown(savedProvince, savedCityQuery);
  },

  async renderDataSettings() {
    const tab = document.getElementById('tabData');
    if (!tab) return;
    tab.innerHTML = `
      <div class="setting-section">
        <div class="setting-section-title">数据备份</div>
        <p class="setting-section-desc">导出全部配置（书签 / 分类 / 待办 / 设置）为本地 JSON 文件；导入可完整恢复。备份文件仅保存在本地，不经过任何服务器；页面功能会请求外部数据源（天气 / 壁纸 / 节假日 / 书签图标），无广告、无埋点。</p>
        <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center;">
          <button class="btn-primary btn-sm" id="exportDataBtn">导出备份</button>
          <label class="btn-edit btn-sm" style="cursor: pointer; display: inline-flex; align-items: center;">导入恢复
            <input type="file" id="importDataInput" accept="application/json,.json" style="display: none;">
          </label>
          <button class="btn-edit btn-sm" id="restoreBackupBtn" title="恢复到最近一次导入前的数据">恢复最近备份</button>
        </div>
        <div class="todo-save-feedback" id="dataFeedback" style="margin-top: 10px;"></div>
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
        // 全量刷新：书签/分类/待办 + 主题/底部栏/组件可见性 + 天气/壁纸
        await this.refreshAllAfterDataChange();
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
        await this.refreshAllAfterDataChange();
      } catch (err) {
        this.showDataFeedback('恢复失败：' + err.message, 'error');
      }
    });
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
    // 导入恢复的主题需同步到主题下拉，避免 UI 与实际主题不一致
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = s.theme || 'dark';
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
    if (typeof Weather !== 'undefined') Weather.setCity(s.weatherCity || '');
    if (typeof Wallpaper !== 'undefined') Wallpaper.init();
  },

  async renderWallpaperSettings() {
    const tab = document.getElementById('tabWallpaper');
    if (!tab) return;

    // 只渲染一次，后续切换标签时不再重复追加
    if (tab.dataset.rendered) return;
    tab.dataset.rendered = '1';

    const settings = await Storage.getSettings();
    const wallpapers = Wallpaper.getWallpapers();
    const currentName = settings.wallpaperName || wallpapers[0].name;

    // 外观：主题选择
    const themeSection = document.createElement('div');
    themeSection.className = 'setting-section';
    themeSection.innerHTML = `
      <div class="setting-section-title">主题外观</div>
      <p class="setting-section-desc">选择界面主题。深色适合夜间，浅色适合明亮环境。</p>
      <select class="city-select" id="themeSelect">
        <option value="dark" ${settings.theme === 'light' || settings.theme === 'auto' ? '' : 'selected'}>深色</option>
        <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>浅色</option>
        <option value="auto" ${settings.theme === 'auto' ? 'selected' : ''}>跟随壁纸</option>
      </select>
    `;
    tab.appendChild(themeSection);
    themeSection.querySelector('#themeSelect').addEventListener('change', async (e) => {
      const val = e.target.value;
      await Storage.updateSettings({ theme: val });
      // PBI-10：auto 模式立即按当前壁纸明度解析
      if (val === 'auto') {
        const wp = Wallpaper.getWallpapers()[Wallpaper.currentIndex];
        document.documentElement.dataset.theme = wp && wp.themeHint === 'light' ? 'light' : 'dark';
      } else {
        document.documentElement.dataset.theme = val;
      }
    });

    // 底部工具栏开关
    const bottomBarSection = document.createElement('div');
    bottomBarSection.className = 'setting-section';
    bottomBarSection.innerHTML = `
      <div class="setting-section-title">底部工具栏</div>
      <p class="setting-section-desc">显示/隐藏底部的壁纸按钮；设置按钮始终保留，便于再次进入设置。</p>
      <label class="toggle-row">
        <span>显示壁纸按钮</span>
        <input type="checkbox" id="showBottomBarToggle" ${settings.showBottomBar ? 'checked' : ''}>
      </label>
    `;
    tab.appendChild(bottomBarSection);
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
    tab.appendChild(section);

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
      <option value="${c.query}" ${c.query === selectedQuery ? 'selected' : ''}>${c.name}</option>
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
function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim().replace(/^\/+/, '');
  if (!/:\/\//.test(url)) return 'https://' + url;
  return url;
}
