const Settings = {
  currentTab: 'bookmarks',
  editStates: {},

  async init() {
    this.bindEvents();
    await this.renderBookmarks();
    await this.renderCategories();
    await this.renderWallpaperSettings();
    await this.renderWeatherSettings();
  },

  open() {
    document.getElementById('settingsOverlay').classList.add('open');
    this.renderBookmarks();
    this.renderCategories();
    this.renderWallpaperSettings();
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

    this.bindWeatherEvents();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
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
    // 清理其他 tab 可能残留的内联表单，防止 ID 冲突
    this.clearInlineForms();
  },

  clearInlineForms() {
    const ids = ['bookmarkForm', 'categoryForm', 'itemForm', 'editItemForm'];
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
      <div class="setting-item" data-id="${bm.id}">
        <div class="setting-item-info">
          <span class="setting-item-title">${escapeHtml(bm.title)}</span>
          <span class="setting-item-url">${escapeHtml(bm.url)}</span>
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
            <span class="setting-item-title">${escapeHtml(cat.title)}</span>
          </div>
          <div class="setting-item-actions">
            <button class="btn-primary btn-sm" data-action="add-item" data-id="${cat.id}">+ 添加链接</button>
            <button class="btn-edit" data-action="edit-category" data-id="${cat.id}">编辑</button>
            <button class="btn-danger" data-action="delete-category" data-id="${cat.id}">删除</button>
          </div>
        </div>
        <div class="category-sub-items">
          ${cat.items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(item => `
            <div class="sub-item" data-id="${item.id}" data-cat-id="${cat.id}">
              <div class="setting-item-info">
                <span class="setting-item-title">${escapeHtml(item.title)}</span>
                <span class="setting-item-url">${escapeHtml(item.url)}</span>
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
      <input type="text" id="editBmTitle" value="${escapeAttr(title)}" required>
      <input type="url" id="editBmUrl" value="${escapeAttr(url)}" required>
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
      <input type="text" id="editCatTitle" value="${escapeAttr(currentTitle)}" required>
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

  showEditItemForm(categoryId, itemId) {
    const subItem = document.querySelector(`.sub-item[data-id="${itemId}"][data-cat-id="${categoryId}"]`);
    if (!subItem) return;

    const title = subItem.querySelector('.setting-item-title').textContent;
    const url = subItem.querySelector('.setting-item-url').textContent;
    const actions = subItem.querySelector('.setting-item-actions');

    const form = document.createElement('div');
    // 清理旧表单
    const oldForm = document.getElementById('editItemForm');
    if (oldForm) oldForm.remove();
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

  async renderWallpaperSettings() {
    const tab = document.getElementById('tabWallpaper');
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
      <p class="setting-section-desc">显示/隐藏底部的壁纸和设置按钮</p>
      <label class="toggle-row">
        <span>显示底部工具栏</span>
        <input type="checkbox" id="showBottomBarToggle" ${settings.showBottomBar ? 'checked' : ''}>
      </label>
    `;
    tab.appendChild(bottomBarSection);
    bottomBarSection.querySelector('#showBottomBarToggle').addEventListener('change', async (e) => {
      const val = e.target.checked;
      await Storage.updateSettings({ showBottomBar: val });
      const bar = document.querySelector('.bottom-bar');
      if (bar) bar.classList.toggle('hidden', !val);
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
      const firstQuery = firstCity ? firstCity.cities[0].query : '';
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


  // 安全确认：在 Chrome 扩展中 confirm 可能被 CSP 阻止，fallback 静默通过
  _confirm(msg) {
    try {
      return confirm(msg);
    } catch (e) {
      return true;
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
