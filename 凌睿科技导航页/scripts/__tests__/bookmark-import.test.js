/**
 * UX-10 单测：chrome 书签树 → 主页"分类 + 链接"结构的转换
 * 运行：npm test
 *
 * 为什么单独测这个纯函数：它是"从浏览器导入书签"这条路径上唯一有分支逻辑的部分，
 * 而它面对的是用户攒了几年、结构完全不可控的数据——深层嵌套、重复地址、
 * 空文件夹、chrome:// 内部页、超长标题都得有确定行为。
 * 把它做成纯函数就是为了能在无扩展环境（CI）里把这些边界逐个钉死。
 */
const { test } = require('node:test');
const assert = require('node:assert');

const { bookmarksTreeToCategories } = require('../storage.js');

/* chrome.bookmarks.getTree() 的真实形状：单个根节点，下挂书签栏(id=1)/其他书签(id=2)/移动设备(id=3) */
const tree = () => ([{
  id: '0', title: '', children: [
    { id: '1', title: '书签栏', children: [
      { id: '10', title: 'GitHub', url: 'https://github.com/' },
      { id: '11', title: '开发', children: [
        { id: '12', title: 'MDN', url: 'https://developer.mozilla.org/' },
        { id: '13', title: '深层', children: [
          { id: '14', title: 'NPM', url: 'https://www.npmjs.com/' }
        ] }
      ] }
    ] },
    { id: '2', title: '其他书签', children: [
      { id: '20', title: '知乎', url: 'https://www.zhihu.com/' }
    ] }
  ]
}]);

test('按根文件夹分组，文件夹层级拉平成一列链接', () => {
  const cats = bookmarksTreeToCategories(tree());
  assert.deepStrictEqual(cats.map(c => c.title), ['书签栏', '其他书签']);
  assert.deepStrictEqual(cats[0].items.map(i => i.title), ['GitHub', 'MDN', 'NPM']);
  assert.deepStrictEqual(cats[1].items.map(i => i.title), ['知乎']);
});

test('scope=bar 只取书签栏（Chrome 中固定 id 为 1）', () => {
  const cats = bookmarksTreeToCategories(tree(), { scope: 'bar' });
  assert.deepStrictEqual(cats.map(c => c.title), ['书签栏']);
});

test('重复地址只保留第一次出现', () => {
  const cats = bookmarksTreeToCategories([{
    id: '0', title: '', children: [
      { id: '1', title: '书签栏', children: [
        { id: '10', title: 'GitHub', url: 'https://github.com/' },
        { id: '11', title: '再次收藏的 GitHub', url: 'https://github.com/' }
      ] },
      { id: '2', title: '其他书签', children: [
        { id: '20', title: '又是 GitHub', url: 'https://github.com/' }
      ] }
    ]
  }]);
  const all = cats.flatMap(c => c.items);
  assert.strictEqual(all.length, 1);
  assert.strictEqual(all[0].title, 'GitHub', '应保留第一次出现的标题');
});

test('只导入 http/https，浏览器内部页与脚本协议被丢弃', () => {
  const cats = bookmarksTreeToCategories([{
    id: '0', title: '', children: [
      { id: '1', title: '书签栏', children: [
        { id: '10', title: '设置', url: 'chrome://settings' },
        { id: '11', title: '扩展', url: 'chrome-extension://abc/x.html' },
        { id: '12', title: '脚本', url: 'javascript:alert(1)' },
        { id: '13', title: '本地文件', url: 'file:///Users/x/a.html' },
        { id: '14', title: '正常', url: 'http://example.com/' }
      ] }
    ]
  }]);
  assert.deepStrictEqual(cats[0].items.map(i => i.url), ['http://example.com/']);
});

test('空文件夹不产生空分类', () => {
  const cats = bookmarksTreeToCategories([{
    id: '0', title: '', children: [
      { id: '1', title: '空文件夹', children: [] },
      { id: '2', title: '有内容', children: [{ id: '20', title: 'A', url: 'https://a.com/' }] }
    ]
  }]);
  assert.deepStrictEqual(cats.map(c => c.title), ['有内容']);
});

test('书签与文件夹标题为空时给出可用兜底，不留空白项', () => {
  const cats = bookmarksTreeToCategories([{
    id: '0', title: '', children: [
      { id: '1', title: '   ', children: [
        { id: '10', title: '', url: 'https://notitle.com/' },
        { id: '11', title: '   ', url: 'https://blank.com/' }
      ] }
    ]
  }]);
  assert.strictEqual(cats[0].title, '浏览器书签', '空文件夹名应有兜底');
  assert.strictEqual(cats[0].items[0].title, 'https://notitle.com/', '无标题书签应回退为 URL');
});

test('超长标题被截断，不会撑破卡片', () => {
  const long = '很'.repeat(200);
  const cats = bookmarksTreeToCategories([{
    id: '0', title: '', children: [
      { id: '1', title: long, children: [{ id: '10', title: long, url: 'https://a.com/' }] }
    ]
  }], { maxTitleLength: 20 });
  assert.strictEqual(cats[0].title.length, 20);
  assert.strictEqual(cats[0].items[0].title.length, 20);
});

test('单个分类的链接数受上限约束', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 'b' + i, title: 'B' + i, url: 'https://b' + i + '.com/' }));
  const cats = bookmarksTreeToCategories([{ id: '0', title: '', children: [{ id: '1', title: '很多', children: many }] }],
    { maxItemsPerCategory: 10 });
  assert.strictEqual(cats[0].items.length, 10);
});

test('异常输入返回空数组而不是抛错', () => {
  for (const input of [null, undefined, 'not-an-array', 42, {}, []]) {
    assert.deepStrictEqual(bookmarksTreeToCategories(input), [], String(input));
  }
});

test('结构缺失的节点被跳过，不影响同批其他节点', () => {
  const cats = bookmarksTreeToCategories([{
    id: '0', title: '', children: [
      null,
      { id: '1', title: '正常', children: [{ id: '10', title: 'A', url: 'https://a.com/' }] },
      { id: '2' }
    ]
  }]);
  assert.deepStrictEqual(cats.map(c => c.title), ['正常']);
});
