/**
 * 预设壁纸的构成测试（node:test）
 * 运行：npm test
 *
 * 2.0.0 起界面只有深色一套主题，「跟随壁纸」与浅色版渐变一并移除。
 * 这个文件此前锁的是「每张深色预设都要有 lightCss」，现在反过来锁：
 *   ① 预设只有一套深色渐变，不得残留 lightCss（否则又会长出第二条渲染路径）；
 *   ② 每张预设都必须是深底——浅底预设配深色界面会整片过曝；
 *   ③ 浅色预设「晨雾白」已下线，不能被重新加回列表。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { WALLPAPERS } = require('../../src/scripts/wallpaper.js');

const presets = WALLPAPERS.filter(w => w.type === 'preset');

/* 从渐变串里取所有 hex 颜色，算平均相对亮度（近似判断"这套渐变是浅底还是深底"）。 */
function averageHexLuminance(css) {
  const hexes = String(css).match(/#[0-9a-f]{6}/gi) || [];
  assert.ok(hexes.length > 0, '渐变里应有 hex 颜色');
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const sum = hexes.reduce((acc, h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return acc + 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }, 0);
  return sum / hexes.length;
}

test('预设壁纸：每张都有渐变，且都是深色底', () => {
  assert.ok(presets.length >= 3, '至少保留三套预设');
  for (const wp of presets) {
    assert.strictEqual(typeof wp.css, 'string', `${wp.name} 缺少 css`);
    assert.ok(wp.css.includes('gradient'), `${wp.name} 的 css 应是渐变`);
    const lum = averageHexLuminance(wp.css);
    // 0.06 是"深色界面能压住"的上限：再亮就会在深色主题下形成一块亮斑，
    // 白色标题与书签名称直接失去对比度。
    assert.ok(lum < 0.06, `${wp.name} 平均亮度 ${lum.toFixed(3)}，深色主题下应 < 0.06`);
  }
});

test('预设壁纸：不再有浅色版字段（2.0.0 只保留深色一套）', () => {
  for (const wp of presets) {
    assert.ok(!('lightCss' in wp), `${wp.name} 残留 lightCss，主题已只有深色`);
    assert.strictEqual(wp.themeHint, 'dark', `${wp.name} 应标记为深色底`);
  }
});

test('预设壁纸：浅色预设「晨雾白」已下线', () => {
  assert.ok(!WALLPAPERS.some(w => w.name === '晨雾白'), '晨雾白是浅色底，深色界面下不该出现');
});

test('在线壁纸：没有预设渐变（走网络取图）', () => {
  const apis = WALLPAPERS.filter(w => w.type === 'api');
  assert.ok(apis.length > 0, '应保留在线壁纸');
  for (const wp of apis) {
    assert.ok(!wp.css, `${wp.name} 不应带渐变`);
    assert.strictEqual(wp.themeHint, null, `${wp.name} 明暗未知，交给采样`);
  }
});
