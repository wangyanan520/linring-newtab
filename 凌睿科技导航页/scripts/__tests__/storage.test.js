/**
 * PKG-01/PKG-04 存储层方法测试（node:test）
 * 运行：npm test
 *
 * 覆盖 Storage 的 CRUD / reorder / 导入导出 / 回滚，以及 chrome.storage 与
 * localStorage 回退两个存储分支（hasChromeStorage 在 require 时求值，
 * 通过删除 require 缓存 + 注入全局 mock 实现双分支分别加载）。
 */
const { test } = require('node:test');
const assert = require('node:assert');

/* ---- mock：chrome.storage.local ---- */
function makeChromeMock(initial = {}) {
  const store = { ...initial };
  let failGet = false;
  return {
    _store: store,
    _failGet(v) { failGet = v; },
    storage: {
      local: {
        get(keys, cb) {
          if (failGet) throw new Error('storage read failed (mock)');
          if (keys === null || keys === undefined) { cb({ ...store }); return; }
          const keyList = Array.isArray(keys) ? keys : [keys];
          const result = {};
          for (const k of keyList) if (k in store) result[k] = store[k];
          cb(result);
        },
        set(data, cb) {
          Object.assign(store, data);
          if (cb) cb();
        }
      }
    }
  };
}

/* ---- mock：localStorage（回退分支；可动态开启 setItem 失败） ---- */
function makeLocalStorageMock() {
  const store = new Map();
  let failKey = null;
  return {
    _store: store,
    _failOn(key) { failKey = key; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) {
      if (failKey && k === failKey) throw new Error('QuotaExceededError (mock)');
      store.set(k, String(v));
    },
    removeItem(k) { store.delete(k); }
  };
}

/* ---- 模块加载：清缓存 + 注入全局后重新 require ---- */
const modPath = require.resolve('../storage.js');
function freshRequire() {
  delete require.cache[modPath];
  return require(modPath);
}
function withChrome(initial) {
  const chromeMock = makeChromeMock(initial);
  global.chrome = chromeMock;
  delete global.localStorage;
  return { Storage: freshRequire().Storage, chromeMock };
}
function withLS() {
  delete global.chrome;
  const ls = makeLocalStorageMock();
  global.localStorage = ls;
  return { Storage: freshRequire().Storage, lsMock: ls };
}
function cleanupGlobals() {
  delete global.chrome;
  delete global.localStorage;
  delete global.document;
}

/* ==================== chrome.storage 分支 ==================== */

test('Storage.init：全新环境写入预设（chrome 分支）', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    const bms = await Storage.getBookmarks();
    assert.equal(bms.length, 8, '预设书签 8 个');
    const cats = await Storage.getCategories();
    assert.equal(cats.length, 4, '预设分类 4 个');
    assert.deepEqual(await Storage.getTodos(), [], '待办为空');
    const s = await Storage.getSettings();
    assert.equal(s.version, '1.0.0');
    assert.equal(s.theme, 'dark');
  } finally { cleanupGlobals(); }
});

test('Storage.init：已有 settings 时保留数据并合并默认值', async () => {
  try {
    const { Storage, chromeMock } = withChrome({
      settings: { version: '1.0.0', theme: 'light', weatherCity: 'shenzhen' },
      bookmarks: [{ id: 'b1', title: '仅一个', url: 'https://a.com', sortOrder: 1 }]
    });
    await Storage.init();
    const s = await Storage.getSettings();
    assert.equal(s.theme, 'light', '保留已有主题');
    assert.equal(s.weatherCity, 'shenzhen', '保留已有城市');
    assert.equal(s.showBottomBar, true, '缺失字段补默认值');
    const bms = await Storage.getBookmarks();
    assert.equal(bms.length, 1, '已有书签不被预设覆盖');
  } finally { cleanupGlobals(); }
});

test('Storage 书签 CRUD + reorder 持久化（chrome 分支）', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    const added = await Storage.addBookmark({ title: '测试站', url: 'https://t.com' });
    assert.ok(/^[0-9a-z]+$/.test(added.id), 'id 为 generateId 格式');
    assert.equal(added.sortOrder, 9, '新书签 sortOrder 递增');
    assert.equal((await Storage.getBookmarks()).length, 9);

    await Storage.updateBookmark(added.id, { title: '改名' });
    let bms = await Storage.getBookmarks();
    assert.equal(bms.find(b => b.id === added.id).title, '改名');

    const firstId = bms[0].id;
    const reordered = await Storage.reorderBookmarks(0, 3);
    assert.equal(reordered[3].id, firstId, 'reorder 后目标位正确');
    assert.deepEqual(reordered.map(b => b.sortOrder), [1, 2, 3, 4, 5, 6, 7, 8, 9], 'sortOrder 重编号连续');

    await Storage.deleteBookmark(added.id);
    assert.equal((await Storage.getBookmarks()).length, 8, '删除后回 8 个');
  } finally { cleanupGlobals(); }
});

test('Storage 分类/分类链接 CRUD + reorder（chrome 分支）', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    const cat = await Storage.addCategory({ title: '新分类' });
    assert.equal(cat.sortOrder, 5);
    assert.deepEqual(cat.items, []);

    await Storage.addCategoryItem(cat.id, { title: '链接1', url: 'https://l1.com' });
    let cats = await Storage.getCategories();
    const found = cats.find(c => c.id === cat.id);
    assert.equal(found.items.length, 1);
    const itemId = found.items[0].id;

    await Storage.updateCategoryItem(cat.id, itemId, { title: '链接1改' });
    cats = await Storage.getCategories();
    assert.equal(cats.find(c => c.id === cat.id).items[0].title, '链接1改');

    const reordered = await Storage.reorderCategories(0, 2);
    assert.equal(reordered[2].id, 'cat_01', '分类 reorder 后目标位正确');

    await Storage.deleteCategoryItem(cat.id, itemId);
    cats = await Storage.getCategories();
    assert.equal(cats.find(c => c.id === cat.id).items.length, 0);

    await Storage.deleteCategory(cat.id);
    assert.equal((await Storage.getCategories()).length, 4);
  } finally { cleanupGlobals(); }
});

test('Storage 待办 CRUD（chrome 分支）', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    const todo = await Storage.addTodo('写报告');
    assert.equal(todo.done, false);
    assert.ok(todo.createdAt > 0);
    await Storage.toggleTodo(todo.id);
    assert.equal((await Storage.getTodos())[0].done, true, 'toggle 完成');
    await Storage.toggleTodo(todo.id);
    assert.equal((await Storage.getTodos())[0].done, false, '再 toggle 取消');
    await Storage.deleteTodo(todo.id);
    assert.deepEqual(await Storage.getTodos(), []);
  } finally { cleanupGlobals(); }
});

test('Storage 组件可见性与设置合并（chrome 分支）', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    let vis = await Storage.getComponentVisibility();
    assert.deepEqual(vis, {}, '默认全开（空配置）');
    await Storage.setComponentVisible('weather', false);
    vis = await Storage.getComponentVisibility();
    assert.equal(vis.weather, false);
    await Storage.setComponentVisible('weather', true);
    assert.equal((await Storage.getComponentVisibility()).weather, true);
    // updateSettings 合并而非覆盖
    await Storage.updateSettings({ theme: 'light' });
    const s = await Storage.getSettings();
    assert.equal(s.theme, 'light');
    assert.equal(s.showBottomBar, true, '其他字段保留');
  } finally { cleanupGlobals(); }
});

test('Storage exportData：四类数据 + schemaVersion（chrome 分支）', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    const data = await Storage.exportData();
    assert.equal(data.schemaVersion, 1);
    assert.ok(typeof data.exportedAt === 'string');
    assert.equal(data.bookmarks.length, 8);
    assert.equal(data.categories.length, 4);
    assert.ok(data.settings.theme === 'dark');
    assert.deepEqual(data.todos, []);
  } finally { cleanupGlobals(); }
});

test('Storage importData：字段级合并 + 备份轮转（chrome 分支）', async () => {
  try {
    const { Storage, chromeMock } = withChrome();
    await Storage.init();
    const backup = JSON.stringify({
      schemaVersion: 1,
      bookmarks: [{ id: 'x1', title: '导入X', url: 'https://x.com' }],
      settings: { theme: 'light' }
      // 缺 categories/todos：保留现有
    });
    const next = await Storage.importData(backup);
    assert.equal(next.bookmarks.length, 1, '备份书签替换');
    assert.equal((await Storage.getCategories()).length, 4, '缺失字段保留现有');
    assert.equal((await Storage.getSettings()).theme, 'light', '设置字段级合并');
    const b1 = chromeMock._store['lastImportBackup-1'];
    assert.equal(b1.bookmarks.length, 8, '导入前备份已轮转写入');
  } finally { cleanupGlobals(); }
});

test('Storage importData：非法 JSON / 校验失败不修改数据（chrome 分支）', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    await assert.rejects(Storage.importData('not-json'), /不是有效的 JSON/);
    await assert.rejects(Storage.importData(JSON.stringify({ bookmarks: 'x' })), /校验失败/);
    await assert.rejects(Storage.importData(JSON.stringify({ bookmarks: [{ id: 'a"b', title: 'x', url: 'https://x.com' }] })), /id 含不支持的字符/);
    assert.equal((await Storage.getBookmarks()).length, 8, '校验失败数据未变');
  } finally { cleanupGlobals(); }
});

test('Storage.restoreLastImportBackup：恢复导入前数据', async () => {
  try {
    const { Storage } = withChrome();
    await Storage.init();
    await Storage.importData(JSON.stringify({ schemaVersion: 1, bookmarks: [{ id: 'x1', title: 'X', url: 'https://x.com' }] }));
    assert.equal((await Storage.getBookmarks()).length, 1);
    const next = await Storage.restoreLastImportBackup();
    assert.equal(next.bookmarks.length, 8, '恢复到导入前 8 书签');
  } finally { cleanupGlobals(); }
});

test('Storage.restoreLastImportBackup：无备份时明确报错', async () => {
  try {
    const { Storage } = withChrome();
    // 全新环境（未导入过）→ 无 lastImportBackup-1
    await assert.rejects(Storage.restoreLastImportBackup(), /没有可用的导入前备份/);
  } finally { cleanupGlobals(); }
});

/* ==================== localStorage 回退分支 ==================== */

test('Storage CRUD：localStorage 回退分支', async () => {
  try {
    const { Storage, lsMock } = withLS();
    await Storage.init();
    assert.ok(lsMock._store.has('bookmarks'), 'localStorage 写入 bookmarks');
    assert.equal((await Storage.getBookmarks()).length, 8);
    await Storage.addBookmark({ title: '回退站', url: 'https://f.com' });
    assert.equal((await Storage.getBookmarks()).length, 9);
    await Storage.reorderBookmarks(0, 2);
    const persisted = JSON.parse(lsMock._store.get('bookmarks'));
    assert.equal(persisted[2].id, 'bm_01', 'reorder 持久化到 localStorage');
    await Storage.addTodo('回退待办');
    assert.equal((await Storage.getTodos()).length, 1);
    const exp = await Storage.exportData();
    assert.equal(exp.bookmarks.length, 9);
    const next = await Storage.importData(JSON.stringify({ schemaVersion: 1, bookmarks: [{ id: 'i1', title: 'I', url: 'https://i.com' }] }));
    assert.equal(next.bookmarks.length, 1);
    assert.ok(lsMock._store.has('lastImportBackup-1'), '回退分支备份轮转');
  } finally { cleanupGlobals(); }
});

test('Storage importData：写入失败自动回滚（localStorage 分支）', async () => {
  try {
    const { Storage, lsMock } = withLS();
    await Storage.init();
    // init 成功后动态开启 bookmarks 写入失败，模拟存储配额异常
    lsMock._failOn('bookmarks');
    await assert.rejects(
      Storage.importData(JSON.stringify({ schemaVersion: 1, bookmarks: [{ id: 'i1', title: 'I', url: 'https://i.com' }] })),
      /写入失败，已恢复原有数据/
    );
    assert.equal((await Storage.getBookmarks()).length, 8, '回滚后原数据保留');
  } finally { cleanupGlobals(); }
});

test('Storage 读取失败防御：catch 路径不崩溃（chrome 分支）', async () => {
  try {
    const { Storage, chromeMock } = withChrome();
    await Storage.init();
    chromeMock._failGet(true);
    assert.deepEqual(await Storage.getBookmarks(), [], '书签读取失败返回空数组');
    assert.deepEqual(await Storage.getCategories(), [], '分类读取失败返回空数组');
    assert.deepEqual(await Storage.getTodos(), [], '待办读取失败返回空数组');
    const s = await Storage.getSettings();
    assert.equal(s.theme, 'dark', '设置读取失败回退默认值');
  } finally { cleanupGlobals(); }
});

test('validateBackup：URL 解析异常与元素级非法', () => {
  try {
    withChrome();
    const { validateBackup } = freshRequire();
    assert.ok(validateBackup({
      bookmarks: [{ id: 'b1', title: 'A', url: 'http://[' }]
    }).length > 0, 'URL 格式非法（new URL 抛）被拒绝');
    assert.ok(validateBackup({ bookmarks: ['x'] }).length > 0, 'bookmarks 元素非对象被拒绝');
    assert.ok(validateBackup({ categories: [null] }).length > 0, 'null 分类被拒绝');
    assert.ok(validateBackup({ todos: ['x'] }).length > 0, 'todos 元素非对象被拒绝');
    assert.ok(validateBackup({ settings: [] }).length > 0, 'settings 为数组被拒绝');
  } finally { cleanupGlobals(); }
});

/* ==================== 工具函数 ==================== */

test('工具函数：generateId 格式 / escapeAttr / escapeHtml 冒烟', async () => {
  try {
    const { Storage } = withChrome();
    const { generateId, escapeAttr, escapeHtml } = freshRequire();
    // generateId：小写字母数字
    assert.ok(/^[0-9a-z]+$/.test(generateId()), 'generateId 格式');
    assert.notEqual(generateId(), generateId(), '两次生成不同');
    // escapeAttr：& " ' 转义
    assert.equal(escapeAttr('a&b"c\'d'), 'a&amp;b&quot;c&#39;d', 'escapeAttr 转义 & " \'');
    // escapeHtml：mock document 冒烟（Node 无 DOM，转义正确性由浏览器 E2E 覆盖）
    global.document = {
      createElement: () => { const el = {}; el.textContent = ''; el.innerHTML = ''; return el; }
    };
    assert.equal(escapeHtml('x'), '', 'mock 下不抛错（冒烟）');
    delete global.document;
  } finally { cleanupGlobals(); }
});
