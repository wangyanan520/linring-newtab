/**
 * 每日一图缓存策略测试（node:test）
 * 运行：npm test
 *
 * 这组用例锁的是三条不变量，而不是某段实现：
 *   1. 只有「从未成功获取过」才回退到内置默认图（任何失败都不许清掉 last）
 *   2. 成功一次之后，缓存里只剩当天那张（不累积历史）
 *   3. 来自 storage 的记录一律不可信，必须过白名单
 *
 * 覆盖的是 wallpaper.js 里的纯函数；apply 的「先画本地再取远程」链路由
 * E2E 的 [45] 断言（离线保留本地图 / 首次离线回退默认图）。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const {
  DEFAULT_DAILY_IMAGE, DAILY_CACHE_VERSION,
  isValidDateStr, isSafeImageUrl, normalizeDailyCache, resolveDailyWallpaper,
  buildDailyCache, pruneDailyCache, migrateLegacyDailyCache
} = require('../../src/scripts/wallpaper.js');

const TODAY = '2026-11-16';
const YESTERDAY = '2026-11-15';
const BAIDU_IMG = 'https://cn.bing.com/th?id=OHR.MockWallpaper_1920x1080.jpg';
const OLD_IMG = 'https://cn.bing.com/th?id=OHR.Yesterday_1920x1080.jpg';

const record = (date, url = BAIDU_IMG) => ({ v: DAILY_CACHE_VERSION, date, url });

/* ---------- 日期与地址校验 ---------- */

test('每日图：日期格式校验（含格式对但不存在、闰年、非字符串）', () => {
  assert.strictEqual(isValidDateStr('2026-11-16'), true);
  assert.strictEqual(isValidDateStr('2028-02-29'), true, '闰年 2 月 29 日合法');
  assert.strictEqual(isValidDateStr('2026-02-31'), false, '格式对但日期不存在');
  assert.strictEqual(isValidDateStr('2026-02-29'), false, '平年无 2 月 29 日');
  assert.strictEqual(isValidDateStr('2026-13-01'), false);
  assert.strictEqual(isValidDateStr('2026-1-1'), false, '必须补零');
  assert.strictEqual(isValidDateStr(''), false);
  assert.strictEqual(isValidDateStr(null), false);
  assert.strictEqual(isValidDateStr(20261116), false);
});

test('每日图：图片地址白名单（协议、长度、CSS url() 注入）', () => {
  assert.strictEqual(isSafeImageUrl(BAIDU_IMG), true);
  assert.strictEqual(isSafeImageUrl('http://cn.bing.com/a.jpg'), true);
  assert.strictEqual(isSafeImageUrl('javascript:alert(1)'), false);
  assert.strictEqual(isSafeImageUrl('data:image/png;base64,AAAA'), false);
  assert.strictEqual(isSafeImageUrl('file:///etc/passwd'), false);
  // 会截断 CSS 声明的字符：拼进 url() 后能注入后续规则
  assert.strictEqual(isSafeImageUrl('https://a.com/x.jpg") , url("https://evil'), false);
  assert.strictEqual(isSafeImageUrl('https://a.com/x.jpg)'), false);
  assert.strictEqual(isSafeImageUrl("https://a.com/x.jpg'"), false);
  assert.strictEqual(isSafeImageUrl('https://a.com/a b.jpg'), false);
  assert.strictEqual(isSafeImageUrl('https://a.com/' + 'a'.repeat(2100)), false, '超长地址拒绝');
  assert.strictEqual(isSafeImageUrl(undefined), false);
  assert.strictEqual(isSafeImageUrl(123), false);
});

/* ---------- 三态解析：这是整个策略的决策表 ---------- */

test('每日图：从未成功获取过 → 内置默认图', () => {
  for (const empty of [null, undefined, {}, [], 'x', 42]) {
    const r = resolveDailyWallpaper(empty, TODAY);
    assert.strictEqual(r.source, 'default', `空缓存 ${JSON.stringify(empty)} 应回退默认图`);
    assert.strictEqual(r.url, DEFAULT_DAILY_IMAGE);
    assert.strictEqual(r.date, null);
  }
});

test('每日图：当天已获取 → 优先显示当天图', () => {
  const r = resolveDailyWallpaper(record(TODAY), TODAY);
  assert.strictEqual(r.source, 'today');
  assert.strictEqual(r.url, BAIDU_IMG);
  assert.strictEqual(r.date, TODAY);
});

test('每日图：跨天（断网 / 当天获取失败）→ 继续显示最后成功的图，不回退默认图', () => {
  const r = resolveDailyWallpaper(record(YESTERDAY, OLD_IMG), TODAY);
  assert.strictEqual(r.source, 'last');
  assert.strictEqual(r.url, OLD_IMG, '这里回退默认图就等于丢掉用户已有的图');
  assert.strictEqual(r.date, YESTERDAY);
});

test('每日图：坏缓存按「没有缓存」处理 → 默认图', () => {
  const bad = [
    { v: 999, date: TODAY, url: BAIDU_IMG },            // 未知版本
    { date: TODAY, url: BAIDU_IMG },                    // 缺版本
    record('2026-11-31'),                               // 非法日期
    record(TODAY, 'javascript:alert(1)'),               // 非法协议
    record(TODAY, 'https://a.com/x.jpg)'),              // 注入串
    { v: DAILY_CACHE_VERSION, date: TODAY },            // 缺 url
    { v: DAILY_CACHE_VERSION, url: BAIDU_IMG }          // 缺 date
  ];
  for (const cache of bad) {
    assert.strictEqual(normalizeDailyCache(cache), null, JSON.stringify(cache));
    assert.strictEqual(resolveDailyWallpaper(cache, TODAY).source, 'default');
  }
});

test('每日图：归一化只保留已知字段（丢掉被塞进来的额外键）', () => {
  const dirty = { v: DAILY_CACHE_VERSION, date: TODAY, url: BAIDU_IMG, injected: '<script>', __proto__x: 1 };
  assert.deepStrictEqual(normalizeDailyCache(dirty), { v: DAILY_CACHE_VERSION, date: TODAY, url: BAIDU_IMG });
});

/* ---------- 成功写入：只留当天，不累积 ---------- */

test('每日图：获取成功 → 整体替换为当天记录（旧记录不保留）', () => {
  const prev = record(YESTERDAY, OLD_IMG);
  const next = buildDailyCache(BAIDU_IMG, TODAY, prev);
  assert.deepStrictEqual(next, record(TODAY));
  assert.deepStrictEqual(Object.keys(next).sort(), ['date', 'url', 'v'], '不应出现历史数组等额外结构');
});

test('每日图：接口返回非法地址 → 保留上一条，不把已有图删掉', () => {
  const prev = record(YESTERDAY, OLD_IMG);
  assert.deepStrictEqual(buildDailyCache('javascript:alert(1)', TODAY, prev), prev);
  assert.deepStrictEqual(buildDailyCache('', TODAY, prev), prev);
  assert.deepStrictEqual(buildDailyCache(BAIDU_IMG, '2026-13-01', prev), prev, '日期非法同样不覆盖');
  // 本来就没有记录时，非法结果不应凭空造出一条缓存
  assert.strictEqual(buildDailyCache('javascript:alert(1)', TODAY, null), null);
});

/* ---------- 清理 ---------- */

test('每日图：联网清理保留当天图与跨天的最后图，只剔非法/未来记录', () => {
  assert.deepStrictEqual(pruneDailyCache(record(TODAY), TODAY, { online: true }).cache, record(TODAY));
  assert.deepStrictEqual(
    pruneDailyCache(record(YESTERDAY, OLD_IMG), TODAY, { online: true }).cache,
    record(YESTERDAY, OLD_IMG), '跨天记录是断网兜底，联网时也不能删'
  );
  const invalid = pruneDailyCache({ v: 1, date: 'x', url: 'y' }, TODAY, { online: true });
  assert.strictEqual(invalid.cache, null);
  assert.deepStrictEqual(invalid.removed, ['invalid']);

  const future = pruneDailyCache(record('2026-12-01'), TODAY, { online: true });
  assert.strictEqual(future.cache, null, '未来日期视为数据损坏，联网时丢弃');
  assert.deepStrictEqual(future.removed, ['future-date']);
});

test('每日图：离线时不做任何删除（那张图是断网时唯一资产）', () => {
  const future = pruneDailyCache(record('2026-12-01'), TODAY, { online: false });
  assert.deepStrictEqual(future.cache, record('2026-12-01'));
  assert.deepStrictEqual(future.removed, []);
  const bad = pruneDailyCache({ v: 1, date: 'x', url: 'y' }, TODAY, { online: false });
  assert.strictEqual(bad.cache, null, '读不懂的记录本来就无法显示');
});

/* ---------- 升级迁移 ---------- */

test('每日图：旧字段 wallpaperApiCache 迁移（仅 bing、仅合法记录）', () => {
  assert.deepStrictEqual(
    migrateLegacyDailyCache({ type: 'bing', date: TODAY, url: BAIDU_IMG }),
    record(TODAY)
  );
  assert.strictEqual(migrateLegacyDailyCache({ type: 'random', date: TODAY, url: BAIDU_IMG }), null);
  assert.strictEqual(migrateLegacyDailyCache({ type: 'bing', date: TODAY }), null);
  assert.strictEqual(migrateLegacyDailyCache({ type: 'bing', date: TODAY, url: 'javascript:1' }), null);
  assert.strictEqual(migrateLegacyDailyCache(null), null);
});

/* ---- 2.1.0：Bing 每日图的版权署名 ---- */

test('2.1.0 署名随缓存读写：可选的 credit 字段，非法内容不写入', () => {
  const withCredit = buildDailyCache(BAIDU_IMG, TODAY, null, '美国·古拉悬崖 © Chiara Salvadori/Getty Images');
  assert.strictEqual(withCredit.credit, '美国·古拉悬崖 © Chiara Salvadori/Getty Images');
  assert.strictEqual(resolveDailyWallpaper(withCredit, TODAY).credit, withCredit.credit,
    '解析结果要把署名带到渲染层');

  const noCredit = buildDailyCache(BAIDU_IMG, TODAY, null);
  assert.ok(!('credit' in noCredit), '没有署名时不写这个键，缓存形状与 1.x 一致');
  assert.strictEqual(resolveDailyWallpaper(noCredit, TODAY).credit, '');

  const poisoned = normalizeDailyCache({ v: 1, date: TODAY, url: BAIDU_IMG, credit: 'x\u0000y' });
  assert.ok(!('credit' in poisoned), '控制字符必须被丢弃，否则会污染渲染文本');

  const longCredit = normalizeDailyCache({ v: 1, date: TODAY, url: BAIDU_IMG, credit: 'a'.repeat(400) });
  assert.ok(!('credit' in longCredit), '超长署名丢弃（挡住被塞进来的大段文本）');

  assert.strictEqual(resolveDailyWallpaper(null, TODAY).credit, '', '默认图没有第三方署名');
});
