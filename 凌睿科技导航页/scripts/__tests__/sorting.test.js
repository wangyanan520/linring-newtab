/**
 * PKG-01/PKG-04 核心纯函数断言测试（node:test）
 * 运行：node --test 凌睿科技导航页/scripts/__tests__/（或 npm test）
 *
 * storage.js 依赖浏览器全局（chrome/document），无法直接 require，
 * 因此从源码中提取纯函数在 Node 中执行断言。
 * （全局脚本无模块导出为已知架构约束，见 P2-7；模块化改造后改为直接 import）
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const storageSrc = fs.readFileSync(
  path.join(__dirname, '..', 'storage.js'),
  'utf8'
);

function extractFunction(name, source) {
  const re = new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const match = source.match(re);
  if (!match) throw new Error(`未找到函数 ${name}`);
  let depth = 0;
  let i = source.indexOf('{', match.index);
  for (; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(match.index, i + 1);
}

const reorder = eval(`(${extractFunction('reorder', storageSrc)})`);
const ensureSortOrder = eval(`(${extractFunction('ensureSortOrder', storageSrc)})`);
// validateBackup 依赖 SUPPORTED_SCHEMA_VERSION 常量，此处与 storage.js 对齐声明
const SUPPORTED_SCHEMA_VERSION = 1;
const validateBackup = eval(`(${extractFunction('validateBackup', storageSrc)})`);
const normalizeCategories = eval(`(${extractFunction('normalizeCategories', storageSrc)})`);

test('PKG-01 reorder：中间/首/尾边界', () => {
  const abcd = ['a', 'b', 'c', 'd'];
  assert.deepStrictEqual(reorder(abcd, 0, 2), ['b', 'c', 'a', 'd'], 'reorder(0->2) => [b,c,a,d]');
  assert.deepStrictEqual(reorder(abcd, 0, 3), ['b', 'c', 'd', 'a'], '移动到末尾 (0->3)');
  assert.deepStrictEqual(reorder(abcd, 3, 0), ['d', 'a', 'b', 'c'], '移动到开头 (3->0)');
  assert.deepStrictEqual(reorder(abcd, 1, 1), abcd, '原位移动不变');
  assert.deepStrictEqual(reorder([], 0, 1), [], '空数组安全');
  assert.deepStrictEqual(reorder(abcd, -1, 2), abcd, '越界 fromIndex 返回复制数组');
  assert.deepStrictEqual(reorder(abcd, 0, 99), abcd, '越界 toIndex 返回复制数组');
});

test('PKG-01 reorder：纯函数不修改入参', () => {
  const original = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const snapshot = JSON.stringify(original);
  reorder(original, 0, 2);
  assert.strictEqual(JSON.stringify(original), snapshot, 'reorder 不修改原数组');
});

test('PKG-01 ensureSortOrder：存量数据补值且不丢数据', () => {
  const legacy = [{ title: 'a' }, { title: 'b' }, { title: 'c' }];
  const legacyOrder = legacy.map(x => x.title).join(',');
  const changed = ensureSortOrder(legacy);
  assert.strictEqual(changed, true, '存在缺失 sortOrder 时返回 true');
  assert.deepStrictEqual(legacy.map(x => x.sortOrder), [1, 2, 3], '缺失 sortOrder 按当前顺序补值 1..n');
  assert.strictEqual(legacy.map(x => x.title).join(','), legacyOrder, '补值不改变数组顺序、不丢数据');
  const alreadyOrdered = [{ sortOrder: 2 }, { sortOrder: 1 }];
  assert.strictEqual(ensureSortOrder(alreadyOrdered), false, '无缺失时返回 false 且不改动');
});

test('PKG-01 排序持久化模拟：排序 → reorder → 重编号', () => {
  const simulatePersist = (items, fromIndex, toIndex) => {
    const sorted = [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const next = reorder(sorted, fromIndex, toIndex);
    next.forEach((b, i) => { b.sortOrder = i + 1; });
    return next;
  };
  const bookmarks = [
    { id: 'A', sortOrder: 1 }, { id: 'B', sortOrder: 2 },
    { id: 'C', sortOrder: 3 }, { id: 'D', sortOrder: 4 }
  ];
  const persisted = simulatePersist(bookmarks, 0, 2);
  assert.deepStrictEqual(persisted.map(b => b.id), ['B', 'C', 'A', 'D'], '模拟书签拖拽 (0->2) 后顺序正确');
  assert.deepStrictEqual(persisted.map(b => b.sortOrder), [1, 2, 3, 4], '重编号后 sortOrder 连续 1..n');
});

test('PKG-04 validateBackup：合法/非法结构', () => {
  const validBackup = {
    schemaVersion: 1,
    bookmarks: [{ id: 'b1', title: 'A', url: 'https://a.com' }],
    categories: [{ id: 'c1', title: 'C', items: [{ id: 'l1', title: 'L', url: 'https://l.com' }] }],
    todos: [{ id: 't1', text: 'todo' }],
    settings: { theme: 'dark' }
  };
  assert.deepStrictEqual(validateBackup(validBackup), [], '合法备份通过校验');
  assert.ok(validateBackup({}).length > 0, '空对象 {} 被拒绝');
  assert.deepStrictEqual(validateBackup({ bookmarks: [] }), [], '缺 schemaVersion 视为 v1 且含数据字段可通过');
  assert.ok(validateBackup({ schemaVersion: '1', bookmarks: [] }).length > 0, 'schemaVersion 非整数被拒绝');
  assert.ok(validateBackup({ schemaVersion: 1.5, bookmarks: [] }).length > 0, 'schemaVersion 小数被拒绝');
  assert.ok(validateBackup({ schemaVersion: 2, bookmarks: [] }).length > 0, '高版本备份被拒绝');
  assert.ok(validateBackup({ bookmarks: 'x' }).length > 0, 'bookmarks 非数组被拒绝');
  assert.ok(validateBackup(null).length > 0, 'null 被拒绝');
});

test('PKG-04 validateBackup：id 重复与协议白名单', () => {
  assert.ok(validateBackup({
    bookmarks: [
      { id: 'b1', title: 'A', url: 'https://a.com' },
      { id: 'b1', title: 'B', url: 'https://b.com' }
    ]
  }).length > 0, '书签 id 重复被拒绝');
  assert.ok(validateBackup({
    bookmarks: [{ id: 'b1', title: 'A', url: 'javascript:alert(1)' }]
  }).length > 0, 'javascript: 协议 url 被拒绝');
  assert.deepStrictEqual(validateBackup({
    bookmarks: [{ id: 'b1', title: 'A', url: 'chrome-extension://abc/index.html' }]
  }), [], 'chrome-extension: 协议 url 通过（US-08 AC5 白名单）');
  assert.ok(validateBackup({
    categories: [{ id: 'c1', title: 'C', items: [{ id: 'l1', title: 'L', url: 'data:text/html,x' }] }]
  }).length > 0, '分类链接 data: 协议 url 被拒绝');
});

test('PKG-04 validateBackup：id 字符白名单（防 CSS 选择器注入）', () => {
  assert.ok(validateBackup({
    bookmarks: [{ id: 'bm"]x', title: 'A', url: 'https://a.com' }]
  }).length > 0, '含引号 id 被拒绝');
  assert.ok(validateBackup({
    categories: [{ id: 'c]1', title: 'C' }]
  }).length > 0, '含方括号分类 id 被拒绝');
  assert.ok(validateBackup({
    todos: [{ id: 't1/x', text: 'todo' }]
  }).length > 0, '含斜杠待办 id 被拒绝');
  assert.deepStrictEqual(validateBackup({
    bookmarks: [{ id: 'bm-1_ok', title: 'A', url: 'https://a.com' }]
  }), [], '字母/数字/下划线/连字符 id 通过');
});

test('PKG-04 normalizeCategories：缺 items 补空数组', () => {
  assert.deepStrictEqual(
    normalizeCategories([{ id: 'c1', title: '仅标题分类' }]),
    [{ id: 'c1', title: '仅标题分类', items: [] }],
    '缺 items 的分类补空数组'
  );
  assert.deepStrictEqual(
    normalizeCategories([{ id: 'c2', title: '有链接', items: [{ id: 'l1', title: 'L', url: 'https://l.com' }] }]),
    [{ id: 'c2', title: '有链接', items: [{ id: 'l1', title: 'L', url: 'https://l.com' }] }],
    '已有 items 的分类保持不变'
  );
  assert.deepStrictEqual(normalizeCategories(null), [], '非数组输入返回空数组');
  assert.deepStrictEqual(normalizeCategories('x'), [], '非数组字符串返回空数组');
});
