/**
 * 壁纸明度采样测试（node:test）
 * 运行：npm test
 *
 * ADV-05：随机壁纸源此前不做明度采样，auto 主题对该源永远落 dark。
 * 修复改为 <img crossOrigin> + canvas 优先、fetch 兜底；这里覆盖可单测的
 * 亮度计算与阈值部分，跨域加载链路由 E2E [39] 覆盖。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { averageLuminance, brightnessToThemeHint } = require('../../src/scripts/wallpaper.js');

test('壁纸：平均相对亮度计算（黑/白/中灰/空数组）', () => {
  const pixels = (r, g, b, count = 1) => {
    const data = new Uint8ClampedArray(count * 4);
    for (let i = 0; i < count; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    return data;
  };

  assert.strictEqual(averageLuminance(pixels(0, 0, 0)), 0, '纯黑亮度为 0');
  assert.ok(Math.abs(averageLuminance(pixels(255, 255, 255)) - 1) < 1e-9, '纯白亮度为 1');
  assert.ok(Math.abs(averageLuminance(pixels(128, 128, 128)) - 0.502) < 0.01, '中灰约 0.502');
  assert.strictEqual(averageLuminance(new Uint8ClampedArray(0)), null, '空数组返回 null');
});

test('壁纸：亮度阈值边界与非法输入', () => {
  assert.strictEqual(brightnessToThemeHint(0.54), 'dark', '阈值下为深色');
  assert.strictEqual(brightnessToThemeHint(0.55), 'light', '阈值上为浅色');
  assert.strictEqual(brightnessToThemeHint(NaN), null, 'NaN 回退静态 hint');
  assert.strictEqual(brightnessToThemeHint(null), null);
  assert.strictEqual(brightnessToThemeHint(undefined), null);
});
