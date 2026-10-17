/**
 * 内置节假日兜底数据测试（node:test）
 * 运行：npm test
 *
 * ADV-14：手工维护的 2026 兜底表有 7 个日期与国务院公告不一致。
 * 修复改为从 lunar-javascript 1.7.7 的 HolidayUtil 生成；这里锁定
 * 2026 年春节/国庆/元旦的关键放假日与调休上班日，防止回退或库降级。
 * 另覆盖「过期缓存优先于内置表」：年度数据由运行时 holiday-cn 自动更新，
 * lunar 不需要每年升级。
 */
const { test } = require('node:test');
const assert = require('node:assert');

const lunar = require('../../src/scripts/lunar.min.js');
global.HolidayUtil = lunar.HolidayUtil;
global.window = {};

const { buildHolidayFallback, mergeHolidayFallback } = require('../../src/scripts/calendar.js');

test('ADV-14 内置兜底由 HolidayUtil 生成：2026 春节/国庆/元旦与公告一致', () => {
  const fb = buildHolidayFallback(2026);

  // 春节：2/15-2/23 放假，2/14 与 2/28 调休上班（旧手工表把 2/15 标成上班、2/24 标成放假）
  assert.strictEqual(fb['2026-02-15'].off, true, '2/15 应为春节放假日');
  assert.strictEqual(fb['2026-02-14'].off, false, '2/14 应为春节调休上班日');
  assert.strictEqual(fb['2026-02-24'], undefined, '2/24 不是放假日（旧表误标）');
  assert.strictEqual(fb['2026-02-28'].off, false, '2/28 应为春节调休上班日');

  // 国庆：10/1-10/7 放假，10/10 调休上班；10/8 不是放假日（旧表误标）
  assert.strictEqual(fb['2026-10-01'].off, true, '10/1 应为国庆放假日');
  assert.strictEqual(fb['2026-10-08'], undefined, '10/8 不是放假日（旧表误标）');
  assert.strictEqual(fb['2026-10-10'].off, false, '10/10 应为国庆调休上班日');

  // 元旦：1/4 调休上班（旧表缺失）
  assert.strictEqual(fb['2026-01-04'].off, false, '1/4 应为元旦调休上班日');
  // 劳动节：5/9 调休上班
  assert.strictEqual(fb['2026-05-09'].off, false, '5/9 应为劳动节调休上班日');
  // 中秋：9/25-9/27 放假
  assert.strictEqual(fb['2026-09-25'].off, true, '9/25 应为中秋放假日');
});

test('ADV-14 调休名称去掉后缀，且未公告年份不产生假数据', () => {
  const fb = buildHolidayFallback(2026);
  assert.strictEqual(fb['2026-02-14'].name, '春节', '调休名称不应重复「调休」');
  assert.strictEqual(fb['2026-10-10'].name, '国庆节');

  // 2027 年放假安排尚未公告：HolidayUtil 1.7.7 没有 2027 数据，
  // 不得凭推测生成（旧实现是硬编码表，这正是过期的根因）
  const next = buildHolidayFallback(2027);
  assert.strictEqual(next['2027-01-01'], undefined, '2027 年不得出现推测数据');
  assert.strictEqual(next['2027-10-01'], undefined, '2027 年不得出现推测数据');
});

test('ADV-14 过期缓存优先于内置表：lunar 不升级也能用最近一次成功的数据', () => {
  const merged = mergeHolidayFallback(
    { '2027-01-01': { name: '元旦', off: true } },
    { '2026-01-01': { name: '元旦', off: true } }
  );
  assert.strictEqual(merged['2027-01-01'].off, true, '缓存里的新一年数据应保留');
  assert.strictEqual(merged['2026-01-01'].off, true, '内置历史数据不应丢失');

  const override = mergeHolidayFallback(
    { '2026-02-15': { name: '春节', off: true } },
    { '2026-02-15': { name: '旧表', off: false } }
  );
  assert.strictEqual(override['2026-02-15'].off, true, '同名日期以缓存为准');
  assert.strictEqual(override['2026-02-15'].name, '春节');
  assert.deepStrictEqual(mergeHolidayFallback(null, null), {}, '空输入安全');
});

