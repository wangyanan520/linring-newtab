// TDD Test: 品牌名"凌睿科技"必须在中央视觉区域可见
// 测试方法：解析 index.html，检查品牌名是否出现在 main-content 区域内
// （而非仅在 masthead 角落）

const fs = require('fs');
const path = require('path');

// 读取 HTML
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

// 测试 1: 品牌名出现在 main-content 区域（中央视觉动线）
const mainContentMatch = html.match(/<main[^>]*class="main-content"[^>]*>([\s\S]*?)<\/main>/);
const mastheadMatch = html.match(/<header[^>]*class="top-bar"[^>]*>([\s\S]*?)<\/header>/);

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    results.push(`✓ ${message}`);
  } else {
    failed++;
    results.push(`✗ FAIL: ${message}`);
  }
}

// Test 1: 品牌名出现在 main-content 中（不在 masthead 才算）
if (mainContentMatch) {
  const mainContent = mainContentMatch[1];
  assert(mainContent.includes('凌睿科技'), '品牌名在 main-content 区域可见');
} else {
  assert(false, '找不到 main-content 区域');
}

// Test 2: 品牌名不在 masthead 的角落中（而是更显眼的位置）
if (mastheadMatch) {
  const mastheadContent = mastheadMatch[1];
  const hasBrandInMasthead = mastheadContent.includes('凌睿科技');
  // 如果既在 masthead 又在 main-content，那也 OK（有两个位置）
  // 但如果只在 masthead，就不够
  if (mainContentMatch) {
    const inMain = mainContentMatch[1].includes('凌睿科技');
    const inMasthead = mastheadContent.includes('凌睿科技');
    const inBoth = inMain && inMasthead;
    assert(mainContentMatch && mainContentMatch[1].includes('凌睿科技'), '品牌名可见');
  }
} else {
  assert(false, '找不到 masthead 区域');
}

// Test 3: title 标签包含品牌名
const titleMatch = html.match(/<title>(.*?)<\/title>/);
assert(titleMatch && titleMatch[1].includes('凌睿科技'), '页面 title 包含"凌睿科技"');

// Test 4: 品牌名出现总次数 >= 2（确保不只一处）
const brandCount = (html.match(/凌睿科技/g) || []).length;
assert(brandCount >= 2, `品牌名出现 ${brandCount} 次（需要 >= 2）`);

console.log('\n=== 品牌可见性测试结果 ===');
results.forEach(r => console.log(r));
console.log(`\n通过: ${passed}/${passed + failed}`);

if (failed > 0) {
  console.log('\n测试失败！品牌名不够明显。');
  process.exit(1);
} else {
  console.log('\n全部通过！品牌名可见性合格。');
  process.exit(0);
}
