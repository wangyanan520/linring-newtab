/**
 * CSS 卫生单测：无障碍动态偏好 / 过渡属性范围 / 颜色 token 纪律
 * 运行：npm test
 *
 * 为什么把这四条钉成单测：
 * - 它们全部是"静态可判定"的约束，不需要浏览器就能验，用 JS 正则比截图便宜得多。
 * - reduced-motion 与 transition: all 是 CSS 里最容易被后续改动悄悄回退的两类问题：
 *   前者缺失时功能上毫无异常（只有开了"减少动态效果"的用户受影响），
 *   后者则会在每次新增属性时静默扩大过渡范围，两者都没有任何运行时信号。
 * - 颜色字面量一旦混进选择器，主题变量就出现两个真相来源，浅色主题的对比度修复
 *   会被下一次改动绕过。ux-audit 只能验"当前渲染出的对比度"，验不了"下次别写死"。
 *
 * 约束的出处是一轮 spot 检查（hallmark sloplint 对既有代码扫描后人工复核），
 * 已剔除不适用于本项目（全屏新标签页、无 sticky）的规则。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const STYLES = ['src/styles/main.css', 'src/styles/settings.css'];

/** 行号从 1 开始，方便直接把失败定位到 CSS 行 */
const linesOf = (rel) => read(rel).split('\n').map((text, i) => ({ text, line: i + 1 }));

test('main.css 提供 prefers-reduced-motion 兜底', () => {
  // 只需 main.css：index.html 同时加载两个样式表，兜底块用通配选择器就能覆盖 settings.css
  assert.match(
    read('src/styles/main.css'),
    /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
    'main.css 缺少 @media (prefers-reduced-motion: reduce) 兜底块'
  );
});

test('reduced-motion 兜底真的把动画和过渡压掉，而不是只声明了一个空块', () => {
  const css = read('src/styles/main.css');
  const at = css.search(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/);
  assert.ok(at >= 0, '前提：兜底块存在');
  const block = css.slice(at, css.indexOf('{', at) + 1200);
  assert.match(block, /animation(?:-duration)?\s*:\s*(?:none|[^;]*\b0(?:\.\d+)?m?s\b)/,
    '兜底块里没有压掉 animation 的声明');
  assert.match(block, /transition(?:-duration)?\s*:\s*(?:none|[^;]*\b0(?:\.\d+)?m?s\b)/,
    '兜底块里没有压掉 transition 的声明');
});

test('不使用 transition: all —— 必须显式列出过渡属性', () => {
  for (const rel of STYLES) {
    for (const { text, line } of linesOf(rel)) {
      assert.doesNotMatch(
        text,
        /(?:^|[\s;{])transition\s*:\s*all\b/,
        `${rel}:${line} 使用了 transition: all，改为列出具体属性`
      );
    }
  }
});

test('transition shorthand 的每个条目都自带时长', () => {
  // transition: a, b, c 0.3s 不是"给 a b c 统一 0.3s"，而是 3 个独立条目：
  // 只有 c 拿到 0.3s，a 和 b 缺 duration 时按 0s 处理——过渡静默消失，CSS 不报错，
  // 静态检查也只会看到"没有 transition: all"而放行。这正是一次真实翻车的形状。
  for (const rel of STYLES) {
    for (const { text, line } of linesOf(rel)) {
      const m = text.match(/(?:^|[\s;{])transition\s*:\s*([^;]+);/);
      if (!m) continue;
      const entries = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      for (const entry of entries) {
        assert.match(
          entry,
          /\d+(?:\.\d+)?m?s\b/,
          `${rel}:${line} 的 transition 条目「${entry}」没有时长，会被当作 0s 静默忽略`
        );
      }
    }
  }
});

test('颜色一律走 token —— 选择器里不出现裸 #fff / #ffffff', () => {
  for (const rel of STYLES) {
    for (const { text, line } of linesOf(rel)) {
      // token 定义行（--foo: #fff;）是允许的，那是唯一的真相来源
      if (/^\s*--[\w-]+\s*:/.test(text)) continue;
      assert.doesNotMatch(
        text,
        /#(?:fff|ffffff)\b/i,
        `${rel}:${line} 直接写了白色字面量，改用 token（彩色/深色底上的文字用 --text-on-accent）`
      );
    }
  }
});
