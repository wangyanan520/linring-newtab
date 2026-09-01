/**
 * PKG-01 统一排序数据结构 — 断言测试
 * 运行：node 凌睿科技导航页/scripts/__tests__/sorting.test.js
 *
 * storage.js 依赖浏览器全局（chrome/document），无法直接 require，
 * 因此从源码中提取 reorder / ensureSortOrder 两个纯函数在 Node 中执行断言。
 */
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

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  }
}

function assertTrue(cond, label) {
  if (cond) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

/* ---- 验收 1：reorder 中间/首/尾边界 ---- */
const abcd = ['a', 'b', 'c', 'd'];
assertEqual(reorder(abcd, 0, 2), ['b', 'c', 'a', 'd'], 'reorder(0->2) => [b,c,a,d]');
assertEqual(reorder(abcd, 0, 3), ['b', 'c', 'd', 'a'], '移动到末尾 (0->3)');
assertEqual(reorder(abcd, 3, 0), ['d', 'a', 'b', 'c'], '移动到开头 (3->0)');
assertEqual(reorder(abcd, 1, 1), abcd, '原位移动不变');
assertEqual(reorder([], 0, 1), [], '空数组安全');
assertEqual(reorder(abcd, -1, 2), abcd, '越界 fromIndex 返回复制数组');
assertEqual(reorder(abcd, 0, 99), abcd, '越界 toIndex 返回复制数组');

/* ---- 验收 4：reorder 为纯函数，不修改入参 ---- */
const original = [{ id: 1 }, { id: 2 }, { id: 3 }];
const snapshot = JSON.stringify(original);
reorder(original, 0, 2);
assertTrue(JSON.stringify(original) === snapshot, 'reorder 不修改原数组');

/* ---- 验收 3：存量数据无 sortOrder 自动补值且不丢数据 ---- */
const legacy = [{ title: 'a' }, { title: 'b' }, { title: 'c' }];
const legacyOrder = legacy.map(x => x.title).join(',');
const changed = ensureSortOrder(legacy);
assertTrue(changed === true, '存在缺失 sortOrder 时返回 true');
assertEqual(
  legacy.map(x => x.sortOrder),
  [1, 2, 3],
  '缺失 sortOrder 按当前顺序补值 1..n'
);
assertTrue(
  legacy.map(x => x.title).join(',') === legacyOrder,
  '补值不改变数组顺序、不丢数据'
);

const alreadyOrdered = [{ sortOrder: 2 }, { sortOrder: 1 }];
assertTrue(ensureSortOrder(alreadyOrdered) === false, '无缺失时返回 false 且不改动');

/* ---- 验收 2 模拟：排序 → reorder → 重编号 刷新后顺序保持 ---- */
function simulatePersist(items, fromIndex, toIndex) {
  const sorted = [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const next = reorder(sorted, fromIndex, toIndex);
  next.forEach((b, i) => { b.sortOrder = i + 1; });
  return next;
}

const bookmarks = [
  { id: 'A', sortOrder: 1 },
  { id: 'B', sortOrder: 2 },
  { id: 'C', sortOrder: 3 },
  { id: 'D', sortOrder: 4 }
];
const persisted = simulatePersist(bookmarks, 0, 2);
assertEqual(
  persisted.map(b => b.id),
  ['B', 'C', 'A', 'D'],
  '模拟书签拖拽 (0->2) 后顺序正确'
);
assertEqual(
  persisted.map(b => b.sortOrder),
  [1, 2, 3, 4],
  '重编号后 sortOrder 连续 1..n'
);

/* ---- PKG-04 备份校验：validateBackup ---- */
// validateBackup 依赖 SUPPORTED_SCHEMA_VERSION 常量，此处与 storage.js 对齐声明
const SUPPORTED_SCHEMA_VERSION = 1;
const validateBackup = eval(`(${extractFunction('validateBackup', storageSrc)})`);

const validBackup = {
  schemaVersion: 1,
  bookmarks: [{ id: 'b1', title: 'A', url: 'https://a.com' }],
  categories: [{ id: 'c1', title: 'C', items: [{ id: 'l1', title: 'L', url: 'https://l.com' }] }],
  todos: [{ id: 't1', text: 'todo' }],
  settings: { theme: 'dark' }
};
assertTrue(validateBackup(validBackup).length === 0, '合法备份通过校验');
assertTrue(validateBackup({}).length > 0, '空对象 {} 被拒绝');
assertTrue(validateBackup({ bookmarks: [] }).length === 0, '缺 schemaVersion 视为 v1 且含数据字段可通过');
assertTrue(validateBackup({ schemaVersion: '1', bookmarks: [] }).length > 0, 'schemaVersion 非整数被拒绝');
assertTrue(validateBackup({ schemaVersion: 1.5, bookmarks: [] }).length > 0, 'schemaVersion 小数被拒绝');
assertTrue(validateBackup({ schemaVersion: 2, bookmarks: [] }).length > 0, '高版本备份被拒绝');
assertTrue(validateBackup({ bookmarks: 'x' }).length > 0, 'bookmarks 非数组被拒绝');
assertTrue(validateBackup({
  bookmarks: [
    { id: 'b1', title: 'A', url: 'https://a.com' },
    { id: 'b1', title: 'B', url: 'https://b.com' }
  ]
}).length > 0, '书签 id 重复被拒绝');
assertTrue(validateBackup(null).length > 0, 'null 被拒绝');
assertTrue(validateBackup({
  bookmarks: [{ id: 'b1', title: 'A', url: 'javascript:alert(1)' }]
}).length > 0, 'javascript: 协议 url 被拒绝');
assertTrue(validateBackup({
  bookmarks: [{ id: 'b1', title: 'A', url: 'chrome-extension://abc/index.html' }]
}).length === 0, 'chrome-extension: 协议 url 通过');
assertTrue(validateBackup({
  categories: [{ id: 'c1', title: 'C', items: [{ id: 'l1', title: 'L', url: 'data:text/html,x' }] }]
}).length > 0, '分类链接 data: 协议 url 被拒绝');

/* ---- PKG-04 追加：id 字符白名单（防 CSS 选择器注入导致编辑崩溃） ---- */
assertTrue(validateBackup({
  bookmarks: [{ id: 'bm"]x', title: 'A', url: 'https://a.com' }]
}).length > 0, '含引号 id 被拒绝');
assertTrue(validateBackup({
  categories: [{ id: 'c]1', title: 'C' }]
}).length > 0, '含方括号分类 id 被拒绝');
assertTrue(validateBackup({
  todos: [{ id: 't1/x', text: 'todo' }]
}).length > 0, '含斜杠待办 id 被拒绝');
assertTrue(validateBackup({
  bookmarks: [{ id: 'bm-1_ok', title: 'A', url: 'https://a.com' }]
}).length === 0, '字母/数字/下划线/连字符 id 通过');

/* ---- PKG-04 导入归一化：缺 items 的分类补空数组，保证渲染路径安全 ---- */
const normalizeCategories = eval(`(${extractFunction('normalizeCategories', storageSrc)})`);
assertEqual(
  normalizeCategories([{ id: 'c1', title: '仅标题分类' }]),
  [{ id: 'c1', title: '仅标题分类', items: [] }],
  '缺 items 的分类补空数组'
);
assertEqual(
  normalizeCategories([{ id: 'c2', title: '有链接', items: [{ id: 'l1', title: 'L', url: 'https://l.com' }] }]),
  [{ id: 'c2', title: '有链接', items: [{ id: 'l1', title: 'L', url: 'https://l.com' }] }],
  '已有 items 的分类保持不变'
);
assertEqual(normalizeCategories(null), [], '非数组输入返回空数组');
assertEqual(normalizeCategories('x'), [], '非数组字符串返回空数组');

/* ---- 汇总 ---- */
console.log(`\n结果：${passed} 通过，${failed} 失败`);
if (failed > 0) {
  process.exit(1);
}
