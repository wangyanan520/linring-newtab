# 凌睿科技导航页 V3 对抗式审查报告（含两轮再审查 + E2E 运行时验证）

> 审查时间：2026-09-01 · 审查对象：全部源码 + docs/product 文档链 + docs/spec + 分发包
> 方法：意图↔实现逐条比对（intended-vs-implemented）+ 五轴代码审查 + 两轮对抗式再审查（攻击审查报告自身）+ E2E 运行时验证
> 状态：本报告为独立审查产物；未改动任何源码。E2E 脚本位于 `/tmp/nav-e2e/`（未入库）

---

## 一、E2E 验证设置与局限

**环境**：Playwright 1.57 + chromium-headless-shell（chromium-1234）；扩展目录经 `python3 -m http.server` 提供（http://127.0.0.1:8899）+ file:// 直开模式。
**覆盖**：43 项断言通过（渲染/主题/组件开关/CRUD/排序持久化/导入导出/备份轮转/恢复/协议白名单/日历浮层/网络审计/隐私文案/天气/壁纸），含恶意输入注入测试。

**验证局限（必须声明）**：
1. **扩展模式未能运行**：本机 Chrome 151（dev 版）在无 GUI 会话下反复段错误（`Trying to load the allocator multiple times`、crashpad `mach_vm_read` 错误），`--load-extension` 亦未生效；Playwright 自带浏览器与 1.57 版本不匹配。故存储层走 **localStorage 回退分支**（与 chrome.storage 为同一 `storageGet/storageSet` 接口抽象，逻辑等价），**扩展专属行为未验证**：扩展 CSP 实际拦截、`chrome_url_overrides.newtab` 覆盖、`hideChromeUI`。
2. 拖拽手势未自动化（HTML5 DnD 需 OS 级拖拽），通过同一 `reorder` 代码路径的键盘按钮验证排序持久化。
3. 天气/壁纸/节假日为真实外网请求（当日 26°C 深圳晴、jsdelivr 节假日拉取成功、favicon 全链路加载），非 mock。

---

## 二、E2E 运行时证据（按审查项）

### 2.1 运行时证实成立的审查结论

| 审查项 | E2E 证据 |
|---|---|
| **A1 导入 URL 白名单契约漂移** | `chrome-extension://abc/index.html` 书签导入**成功**；随后主页渲染触发 favicon 链：`https://favicon.im/abc` → 404 → fallback `https://abc/favicon.ico` → DNS 解析失败（console 2 条错误：404 + ERR_NAME_NOT_RESOLVED）。错误文案亦暴露白名单为「仅 http/https/**chrome-extension**」，与 US-08 AC5「仅 http/https」字面矛盾 |
| **A2 网络请求审计承诺落空** | 页面生命周期请求：`favicon.im` 38 次 + **`a.favicon.im` 37 次**（CDN 子域，不在文档 6 源清单）——文档白名单粒度与实现实际请求域不一致；CSP `img-src https://*.favicon.im` 通配恰好覆盖，若为精确匹配则全部 favicon 加载失败 |
| **A3 无兜底文案** | 全部组件关闭后，主页仅剩搜索框 + 标题/设置按钮，**无任何兜底提示文案**（正文只含「凌睿科技导航|探索·发现·高效」） |
| **A8 恶意 id 致编辑崩溃** | 导入 `{ id: 'bm"]x' }` 后点击编辑 → `pageerror: SyntaxError: Failed to execute 'querySelectorAll' on 'Document': '#bookmarkList .setting-item[data-id="bm"]x"]' is not a valid selector.` **稳定复现**；删除按钮不受影响（行为不对称） |
| **A10 导入后设置面板 UI 不同步（部分）** | 导入 `{theme:'light', showBottomBar:false, wallpaperName:'极光绿'}` 后：主页 data-theme=light ✓、壁纸按钮隐藏 ✓、**themeSelect 同步为 light ✓**（refreshAllAfterDataChange 的同步逻辑生效）；但 **showBottomBarToggle 仍 checked=true、wallpaperSourceSelect 仍=深邃星空**（未同步，用户看到的面板状态与真实存储不一致）——A10 结论修正为「仅主题下拉同步，其余两个控件未同步」 |
| **书签域名外发 favicon.im（隐私披露）** | 38+37 次请求路径均含书签域名（`https://favicon.im/www.baidu.com` 等），书签域名列表**完整发送给第三方**；设置面板文案「数据全程保存在本地，不经过任何服务器」（settings.js:469）与数据流不符 |
| **US-20 预览模式行为不一致** | file:// 直开：cities.json fetch 失败（console: `URL scheme "file" is not supported`），城市下拉降级为仅「自动定位」1 项（http 模式 33 省多城市）——两种模式天气配置行为不一致，US-20 AC3「行为一致」未满足 |
| **导入/恢复闭环** | 字段级合并 ✓、清空警告 ✓（「注意：分类已被清空，如误操作可回滚」）、3 份轮转备份写入 ✓、恢复按钮还原 8 书签/4 分类 ✓、`javascript:` 拒绝 ✓ |

### 2.2 E2E 新发现（静态审查两轮均未捕获）

**N1（P2）· 键盘排序后主页不刷新 —— `this` 解绑 TypeError**
- 根因：settings.js:217 `const appRerender = type === 'bookmark' ? App.renderBookmarks : App.renderCategories;` 解构方法引用后，settings.js:227 裸调用 `appRerender()` → `this` 丢失（非严格模式回落 window）→ `this.extractDomain` / `this.attachDrag` 为 undefined → `TypeError: this.extractDomain is not a function`（pageerror 稳定复现）。
- 影响：**设置面板**的上移/下移按钮执行后，数据已持久化（reorder 先写 storage）、设置面板已刷新，但**主页书签/分类顺序不实时更新**——US-01 AC5 键盘替代操作在主页不生效，需刷新页面才显示新顺序。
- 修复：settings.js:227 改为 `App.renderBookmarks()` / `App.renderCategories()`（或 `appRerender.call(App)`）。

### 2.3 E2E 通过项（正面基线，43 项）

预设渲染（8 书签/4 分类）、主题即时切换+刷新持久化、组件开关+持久化、搜索框常驻、全关后搜索框保留、书签增删改、URL 补全（example.com→https://）、排序刷新保持、导出（schemaVersion/exportedAt/四类数据/本地日期文件名）、导入统计/合并/清空警告/备份轮转/恢复、日历浮层（2026-09 35 格 = 7 的倍数，农历八月 + 白露节气 + 干支头正确）、天气真实数据（26°C 晴 + 24h 预报 + 今日温幅）、节假日 jsdelivr 拉取无失败请求、`javascript:` 协议拒绝、file:// 模式渲染/localStorage/导出可用。

---

## 三、两轮对抗式再审查结论（对第一版审查报告的修正）

### 第一轮：攻击原审查报告（事实核查 + 定级复核 + 遗漏补报）

**事实错误 2 处**：
- F-1：原 A16「MutationObserver 永久运行」不成立——main.js:120-127 轮询 20 次（4 秒）后主动 `observer.disconnect()`，观察者最长存活约 4 秒。
- F-2：原 A15「22 秒」数字错误——最坏路径 8s×3 次尝试 + 退避 1s+2s = **27 秒**。

**定级过高 6 项（下调）**：
- A1 原 P1 → **P2**：`chrome-extension:` 仅产生页面导航，无脚本执行/无数据越权；测试断言表明为有意设计。P1（安全漏洞）站不住，属文档契约漂移。
- A3/A4/A5/A6 原 P2 → **P3**：均出自 UC 文档「扩展流程」（备选路径），文档语义是设计说明而非验收承诺；且 US-04 AC3 括号「（如仅保留搜索框）」已把实现方式写进验收标准（AC 满足，UC 未满足，属文档内部标准不一致）。
- A7 原 P2 → **P3**：无实测断言「无法验收」过强——0.35 遮罩 + 白字对比度可能达标；正确表述为「验收方法未定义，需实测」。
- A9 原 P2 → **P3**：XSS 前提链脆弱（扩展模式 CSP 挡内联脚本；预览模式需 DNS 劫持/API 污染）；代码不一致缺陷（desc 转义、temp 未转义）仍成立。

**措辞过强 2 处**：B10「零容错」（正则实际容忍多行/普通默认参数，仅对含括号默认值脆弱）；A2「结构性矛盾」（PBI-14 白名单补一条 favicon 例外即可，属未预判决策点）。

**遗漏补报 4 项**：隐私透明度（settings.js:469 文案误导 + 书签域名外发，P2，E2E 已证实）；US-03 AC2 跨标签页不同步（无 storage.onChanged 订阅，P3）；UC-02 搜索为当前页导航（`window.location.href`）与「在新标签页打开」措辞偏差（P3）；预览模式 cities.json CORS 降级（P3，E2E 已证实）。

### 第二轮：攻击修正后的结论 + 结构性盲区

1. **修正后 P2 清单复核（7 项维持）**：A1'（契约漂移）、A2'（manifest 4 域 vs 文档 6 源 + PBI-14 决策点）、A8'（id 注入崩溃）、A10'（导入 UI 部分不同步）、隐私透明度、工程张力（KR-4 可测试性 vs 全局脚本架构）、N1（E2E 新增）。
2. **方法论盲区**：原报告全部结论基于静态阅读。E2E 证明静态审查的局限——本报告编写过程中 curl 初测 favicon.im/biturl.top 返回 403/404 险些误判「外部依赖不可用、PRD 7.4 假设证伪」，带浏览器 UA 跟随重定向后均 200（正常运行）；运行时行为（CSP 执行、CDN 子域、this 解绑）必须以浏览器实测定论。
3. **框架盲区**：「文档 vs 代码」二元框架漏掉了产品信任层（隐私叙事 vs 数据流），而这是最有价值的问题之一。

---

## 四、最终定级清单（E2E 验证后）

### P1（阻塞）：无

### P2（重要，7 项）

| # | 项 | 证据 | 修复建议 |
|---|---|---|---|
| P2-1 | 导入 URL 白名单契约漂移（US-08 AC5「仅 http/https」vs 实现 + 错误文案含 chrome-extension） | storage.js:138；E2E 证实导入成功 + fallback 404/DNS 链 | 文档/代码二选一对齐；若保留 chrome-extension 则改 AC 文案 |
| P2-2 | 网络请求审计承诺落空（manifest 4 域 vs 文档 6 源；运行时 a.favicon.im CDN 子域不在清单；CSP img-src `https:` 通配；PBI-14 与 favicon fallback 冲突） | manifest.json:12-19；E2E 请求统计 | Phase 3 实现 PBI-14 前先决策白名单口径（含 CDN 子域与 favicon 例外） |
| P2-3 | 恶意 id 致设置面板编辑功能崩溃 | settings.js:261/329/399；E2E SyntaxError 复现 | validateBackup 增加 id 字符白名单，或改用 CSS.escape |
| P2-4 | 导入后设置面板 UI 部分不同步（showBottomBarToggle/wallpaperSourceSelect） | settings.js:570-583；E2E 证实 | refreshAllAfterDataChange 同步全部三个控件 |
| P2-5 | **N1：键盘排序后主页不刷新（this 解绑 TypeError）** | settings.js:217,227；E2E pageerror 复现 | 改 `App.renderBookmarks()` 显式调用 |
| P2-6 | 隐私透明度：settings.js:469 文案误导 + 书签域名完整外发 favicon.im + US-15 隐私区块缺位 | E2E 38+37 次请求含域名 | 修文案 + 文档明示数据流 + US-15 排期 |
| P2-7 | 工程张力：KR-4「可测试性 ≥80%」vs 全局脚本无模块架构（测试只能正则提取+eval）+ P4 画像信任来源排期 Phase 3 | sorting.test.js:16-33；08-线路.md | Phase 3 前评估模块化改造或调整 KR 口径 |

### P3（细节，~15 项）

A3 无兜底文案（E2E 证实）、A4 壁纸回退到预设非「上一张」+ 无提示、A5 剪贴板兜底缺失、A6 无只读降级、A7 取色联动未实测（遮罩方案待视觉验收）、A9 weather temp 未转义（与 desc 不一致）、A12 多标签页 reorder 竞态、A14 todos 缺 createdAt 校验、A15 天气失败 27 秒「获取中」误导、A16 CSS 选择器 hack 误伤面（原「永久运行」指控已撤销）、A17 死字段（defaultVisible/CACHE_VERSION/`https://www.google.com` 权限条目）、A18 测试脆弱（eval 提取 + 覆盖缺口）、US-03 AC2 跨标签页不同步、UC-02 搜索导航语义含糊、预览模式 cities.json 降级（E2E 证实）、文档问题 C1-C4（review-report 事实核对 5/5 的疏漏、甘特图进度标注缺失、性能测量口径未定、画像匿名统计开关与无埋点定位张力）。

---

## 五、结论

**E2E 运行验证了 43 项正面行为，并稳定复现 4 项审查结论（A1/A3/A8/A10）、1 项文档承诺落空（US-20 预览模式）、1 项静态审查漏掉的真实 bug（N1 键盘排序主页不刷新）。** 两轮对抗式再审查修正了原报告 2 处事实错误、6 项定级膨胀、2 处措辞过强，补报 4 项遗漏；最终无 P1 阻塞项，7 项 P2 建议在 MVP 验收放行前优先处理（P2-5 一行可修、P2-3 一行可修、P2-6 一处文案）。

**建议下一步**：修复 P2-5/P2-3/P2-6（各一行级改动）后，在真实 Chrome 扩展环境（GUI 会话）补跑扩展模式冒烟（CSP 实际拦截、newtab 覆盖、chrome.storage 真路径），并将 E2E 脚本收敛入库（`凌睿科技导航页/scripts/__tests__/e2e/`）作为 PBI-15 的起点。

---

## 六、修复与验证记录（2026-09-01，三项 P2 已修复）

> 按报告建议执行三项最高性价比修复；每项修复均有单测 + E2E 回归证据。

### P2-5 已修复：键盘排序后主页不刷新（this 解绑 TypeError）

- **改动**：`凌睿科技导航页/scripts/settings.js` `moveItem()` 中 `appRerender` 由解构方法引用改为箭头函数包装（`() => App.renderBookmarks()`），保持 `this` 绑定。
- **验证**：E2E 新增断言「[5] N1 主页顺序随键盘排序同步」PASS（修复前该路径稳定抛 `TypeError: this.extractDomain is not a function`，主页不刷新）；页面 pageerror 总数由 2 → 0。

### P2-3 已修复：恶意 id 致编辑崩溃（导入校验白名单）

- **改动**：`凌睿科技导航页/scripts/storage.js` `validateBackup()` 新增 `idSafe` 白名单（`^[A-Za-z0-9_-]+$`），覆盖 bookmarks / categories / 分类链接 / todos 四类 id；与 `generateId` 及全部预设 id 格式兼容，不误伤现有数据。
- **验证**：
  - 单测新增 4 条断言（`sorting.test.js`），34/34 通过；
  - E2E「[9] 恶意 id 被校验拒绝」（`bookmarks[0] id 含不支持的字符…现有数据未受影响`）PASS、「[9] 无新增 pageerror（不再崩溃）」PASS、「合法 id 备份正常导入」PASS（白名单不误伤）。

### P2-6 已修复：隐私文案误导

- **改动**：`凌睿科技导航页/scripts/settings.js` 数据 tab 文案由「数据全程保存在本地，不经过任何服务器」改为「**备份文件仅保存在本地，不经过任何服务器；页面功能会请求外部数据源（天气 / 壁纸 / 节假日 / 书签图标），无广告、无埋点**」——准确区分"备份文件本地化"与"运行时外部数据源"，与 US-15 AC2 声明口径一致。
- **验证**：E2E「[6] 隐私文案明示外部数据源」PASS。

### P2-6 已修复：隐私文案误导

- **改动**：`凌睿科技导航页/scripts/settings.js` 数据 tab 文案由「数据全程保存在本地，不经过任何服务器」改为「**备份文件仅保存在本地，不经过任何服务器；页面功能会请求外部数据源（天气 / 壁纸 / 节假日 / 书签图标），无广告、无埋点**」——准确区分"备份文件本地化"与"运行时外部数据源"，与 US-15 AC2 声明口径一致。
- **验证**：E2E「[6] 隐私文案明示外部数据源」PASS。

### P2-4 已修复：导入后设置面板 UI 不同步（A10 剩余部分）

- **改动**：`凌睿科技导航页/scripts/settings.js` `refreshAllAfterDataChange()` 在原有 themeSelect 同步之外，补充：
  - `showBottomBarToggle.checked = s.showBottomBar !== false`（undefined 视为默认 true，兼容旧备份）；
  - `wallpaperSourceSelect.value` 同步（仅当导入值在壁纸源选项内时更新，损坏数据不破坏 UI）；
  - `refreshWallpaperBtn` 可见性随壁纸类型（api/preset）同步。
- **验证**：E2E 断言全部转绿——底部栏开关同步、壁纸源下拉同步、刷新按钮随预设壁纸隐藏。

### 回归与遗留

- E2E 全量 **48 PASS / 3 FAIL**（修复前 43 PASS / 5 FAIL）；file:// 预览模式 5/5 PASS；`sorting.test.js` 34/34 PASS。
- 剩余 3 项 FAIL 均为**未纳入本轮范围**的已知项：A10 剩余部分（showBottomBarToggle / wallpaperSourceSelect 导入后不同步，settings.js:570-583 需同步全部控件）、A2（`a.favicon.im` CDN 子域不在文档白名单，Phase 3 实现 PBI-14 时决策）。

### 扩展模式补跑（2026-09-01，Chrome for Testing）
- **关键突破**：Chrome 136+ 已移除普通 Chrome 的 `--load-extension`，需 **Chrome for Testing**（playwright 缓存 chromium-1234）配合 `--enable-unsafe-extension-debugging` 方可命令行加载扩展。本机 Chrome 151（dev）无 GUI 会话下渲染不稳定，CfT + Playwright 管理启动则正常。
- **扩展模式 E2E 结果：53 PASS / 3 FAIL**（FAIL 仅 A10 两个遗留控件 + `a.favicon.im` 白名单，均为已知项）。独有验证全部通过：
  - newtab 被覆盖为 `chrome-extension://fkapmejgokgfcbkehkcklneoidjgccdm/index.html`；
  - `chrome.storage` 真路径：初始化/预设写入/导入写入/备份轮转/恢复全部生效；
  - **CSP 实际拦截**：`connect-src` 白名单外请求被拒（console 输出完整违规指令）、内联脚本被 `script-src 'self'` 阻止（`window.__inlineRan` 未执行）——XSS 面被 CSP 兜底的运行时证据；
  - US-20 AC2 数据隔离：扩展页 localStorage 与 chrome.storage 互不串扰；
  - 三项修复在扩展模式同样生效（N1 主页同步、恶意 id 拒绝、隐私文案），pageerror = 0。

### E2E 脚本收敛入库（PBI-15 起点）

- 新增 `凌睿科技导航页/scripts/__tests__/e2e/nav-e2e.js`：自包含三模式（扩展 / http 预览 / file:// 预览），内嵌静态服务，自动探测 Chrome for Testing 与 headless shell 路径（`CFT_PATH`/`EXT_PATH`/`PORT` 环境变量可覆盖），存储断言统一探测 chrome.storage / localStorage。
- 运行：`node scripts/__tests__/e2e/nav-e2e.js [--extension | --preview]`；前置 `npm i -D playwright` + `npx playwright install chromium`。
- 入库版实测 **64 PASS / 0 FAIL**（P2-4 修复后 A10 全部断言转绿，预览 + file + 扩展三模式全通过）。
- 注意：扩展模式需 GUI 会话（headful）；无 GUI 环境可用 `--preview` 跑预览模式回归。

### PBI-15 第一步落地（2026-09-01，最小测试工程）

- 新增根 `package.json`：`npm test`（node:test，8 项分组 / 38 断言）、`npm run test:coverage`、`npm run test:e2e`（三模式全量）、`npm run test:e2e:preview`（无 GUI 回归入口）。
- `sorting.test.js` 由自定义 runner 迁移为 node:test 风格（`test()` + `assert`），断言等价迁移。
- devDependency 仅 playwright（E2E 用）；浏览器二进制走 ms-playwright 缓存自动探测，不强制下载。
- **验证**：`npm test` 8/8、`test:e2e:preview` 31/31、`test:e2e` 全量 64/64（含扩展模式 newtab 覆盖）。
- **覆盖率口径局限（P2-7 运行时证据）**：`test:coverage` 报告 100% 仅统计测试文件自身——被测纯函数经 `fs.readFileSync + eval` 执行，**不在 Node 模块加载器统计内**。PBI-15「核心纯函数覆盖率 ≥ 80%」验收前必须解决架构问题（storage.js 模块化导出或 vm 加载），否则覆盖率数字失真。

### PBI-15 完整落地（2026-09-01，测试工程 + CI）

- 最小测试工程：`npm test`（node:test，24 项分组测试）、`npm run test:coverage`（行 95.95% / 分支 74.36% / 函数 96.67%）、`npm run test:e2e`（三模式 64 项）、`npm run test:e2e:preview`（无 GUI 回归入口 31 项）。
- storage.js UMD 导出（P2-7）：浏览器 `<script>` 加载不变，Node 直接 require，覆盖率真实化。
- CI 接入（PBI-15 AC3「CI 中自动执行」）：`.github/workflows/ci.yml`，unit（test + coverage）与 e2e-preview（headless 冒烟）双 job；扩展模式（headful + CfT）保留本地运行。
- **PBI-15 验收对照**：`npm test` 一键运行 ✓；核心纯函数覆盖率 ≥80%（行 95.95%）✓；测试不依赖浏览器环境（mock chrome.storage/localStorage）✓；CI 可重复执行 ✓。

### PBI-14 完成 + P2-2 决策落地（2026-09-01，网络请求审计）

- 新增 `network-audit.js`：统一请求注册表（6 项域名 + 用途 + 触发条件）、`isAllowed`（同源豁免 + `*.favicon.im` 子域通配 + favicon 兜底路径规则）、开发期 fetch 包装审计日志（白名单外请求 console.warn）。
- **P2-2 决策**：favicon.im 及 CDN 子域（实测运行时重定向 a.favicon.im）、任意域 `/favicon.ico` 兜底以路径规则豁免——功能保留同时审计规则明确；隐私 tab 已声明书签域名外发。
- US-16 AC 全部达成：统一注册 ✓；E2E 断言全部请求与白名单比对（实测 134 请求零违规，违规即失败并输出 URL）✓；manifest host_permissions 与 CSP connect-src ⊆ 注册表单测断言 ✓。
- 过程中修复 matchHost 子域通配边界（`*.favicon.im` 须含裸域，`slice(2)` 去 `*.` 前缀）。
- 验证：npm test 31/31（新增 6 项审计规则测试）；E2E 全量 98/98。

### PBI-16 完成（2026-09-01，可复现打包）

- `scripts/pack.js`：零依赖（zip 格式手写：local header + central directory + deflateRaw + crc32），`npm run pack` = 单测 + 打包。
- 产物 `dist/lingrui-nav-v1.0.0-<date>.zip` + `.sha256`；排除 .DS_Store/__MACOSX/._*。
- 自校验：打包即解压与源码逐文件字节比对；外部验证：系统 unzip 解压后与源码 diff 为空。
- 可复现性实测：连续两次打包 SHA-256 一致（d6b9f323…）。
- PBI-16/US-18 三项 AC 全部达成（一条命令 / 无垃圾 / diff 为空 + 哈希可校验）。

### Phase 2 完成（2026-09-01，PBI-08/10/11/12/13/18 全部落地）

对照 08-产品线路.md Phase 2 范围（PBI-08、PBI-10~13、PBI-18）：

| PBI | 状态 | 要点 |
|---|---|---|
| PBI-13 隐私可见化 | ✅ | 设置面板「隐私」tab：权限清单/数据本地声明/6 项外部数据源及用途/无埋点承诺，纯静态零请求 |
| PBI-18 天气降级 + 快捷键 | ✅ | 首次超时 5s 快速失败→「天气暂不可用+重试」→重试自动恢复；缓存标注更新时间；`/` 聚焦、Esc 清空（输入聚焦不冲突） |
| PBI-12 数据双源容错标注 | ✅ | holidaySource 四态，fallback/partial 时浮层标注「节假日数据可能不完整」 |
| PBI-11 节假日倒计时 | ✅ | 浮层倒计时行：今天放假/今日调休/「XX还有 N 天」（escapeHtml 转义） |
| PBI-10 主题与壁纸联动 | ✅ | theme='auto' 档；壁纸 themeHint（3 预设 dark、API 壁纸保持当前）；换壁纸自动同步、手动优先、刷新持久化 |
| PBI-08 迁移兼容 | ✅ | 旧备份（无 schemaVersion/sortOrder/items）导入补齐 + 幂等单测 |

- **Phase 2 退出标准达成**：全部 P1 待办完成；日历浮层离线/双源故障可降级（fallback + 标注）；设置面板具备「隐私与数据」区块。
- 验证：npm test 25/25；E2E 全量 **96/96**（含扩展模式）；新增 Phase 2 断言 15 项（隐私 tab/快捷键/降级重试故障演练/倒计时/联动五态）。
- 遗留决策项不变：P2-2（a.favicon.im 白名单口径，PBI-14 实现时决策）。

### P2 修复状态汇总（2026-09-01）

| 项 | 状态 |
|---|---|
| P2-5 键盘排序主页不刷新（this 解绑） | ✅ 已修复（单测 + E2E 回归） |
| P2-3 恶意 id 致编辑崩溃 | ✅ 已修复（validateBackup id 白名单，单测 34/34） |
| P2-6 隐私文案误导 | ✅ 已修复（文案准确化） |
| P2-4 导入后设置面板 UI 不同步 | ✅ 已修复（三控件 + 刷新按钮同步） |
| P2-1 US-08 AC5 文案对齐（http/https vs chrome-extension） | ✅ 已修复（2026-09-01：文档对齐实现——02-用户故事.md US-08 AC5 改为「仅 http/https/chrome-extension 协议，防 XSS；chrome-extension 用于书签指向扩展自身页面」，与 storage.js:138 白名单及错误文案一致；决策依据：实现为有意设计且测试断言固化） |
| P2-2 网络请求审计承诺（a.favicon.im 等） | ⏳ Phase 3 实现 PBI-14 时决策 |
| P2-7 可测试性目标 vs 全局脚本架构 | ✅ 已完成（2026-09-01：第一步 storage.js UMD 导出 + 测试改直接 require；第二步新增 storage.test.js 24 分组测试覆盖 chrome.storage/localStorage 双分支（init/CRUD/reorder/导入导出/备份轮转/写入失败回滚/读取失败防御），行覆盖率 51.62% → **95.95%**、分支 74.36%、函数 96.67%，PBI-15「≥80%」达成；npm test 24/24，E2E 31/31 无回归） |
