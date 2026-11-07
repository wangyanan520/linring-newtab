# 凌睿科技导航页 — Agent 协作规则

> 本文件是 Codex 等 AI 编程代理在本仓库工作的统一入口。
> 多 agent 协作的详细规范见 `.agents/` 目录。

## 项目概述

浏览器导航页扩展（凌睿科技导航页），基于 Chrome Extension MV3 技术栈，数据保存在本地
（chrome.storage.local，含 localStorage 回退），无后端服务、无埋点、无云同步。

**当前状态（2026-10-25）**：V3 的 Phase 1/2 与 Phase 3 工程化项（PBI-14 网络审计、
PBI-15 测试工程+CI、PBI-16 可复现打包、PBI-17 兼容性评估）均已实现并提交。经独立
评估（含三轮对抗式自审）后，**P0 / P1 缺陷已全部清零**；第四轮对抗式审查
（`docs/reviews/review-report-adversarial-r4.md`）发现的 **6 项 P2 已全部修复**
（ADV-01 校验绕过、ADV-02 天气悬停转义、ADV-03 缓存版本校验、ADV-04 城市竞态、
ADV-05 随机壁纸采样、ADV-06 存储错误模型）。**ADV-14 已修复**：内置兜底改由
lunar 1.7.7 的 `HolidayUtil` 生成；年度数据由运行时 `holiday-cn` + 过期缓存自动更新，
**lunar 升级是可选项，不需要每年手动升级**。**第五轮对抗式 UI/体验审查**（2026-10-25）
另发现并修复 2 项 P1、8 项 P2，修复记录见 `CHANGELOG.md` 的 1.2.2 / 1.2.3 两节
（该轮未单独出报告）；同日还有 `docs/reviews/review-report-doc-consistency.md`
记录的文档一致性审查（只做诊断，未改代码）。

版本与能力按版本归档，**不要混为一谈**（以 `CHANGELOG.md` 为准）：

- **1.1.0**：天气双源容灾、导入书签、主页快捷编辑、快捷键扩展
- **1.2.0**：默认搜索引擎改为百度
- **1.2.1**：第四轮审查遗留 P3（ADV-07~13、15~18 共 11 项）
- **1.2.2**：第五轮审查 2 项 P1
- **1.2.3**：第五轮审查 8 项 P2
- **1.2.4**：浅色主题重做（纸感中性白 + 墨蓝文字）
- **1.2.5**：设置面板 7 tab → 4 tab 重构
- **1.2.6**：浅色主题不再使用壁纸（纯色纸面）
- **1.2.7**：补 `prefers-reduced-motion` 兜底、24 处 `transition` 显式化、白色语义 token
- **1.2.8**：窄屏内容可达、触控与小命中区补齐（桌面 24×24 / 触屏 40×40）、不可见焦点、
  深色两处对比度、768 断点宽度、设置面板高度、小字号

**未上架应用商店**（`06-MVP.md` 3.2 战略排除项，属既定决策而非未完成）。

**V4 使用体验优化已实施（2026-09-15）**：`docs/product/10-使用体验优化方案.md` 的 15 项
（UX-01~15）主体落地（3 项增强/验证项未做，见方案 §9.4），包括修掉 4 项 P0——内容增长后搜索框被挤出视口且滚不回来、浅色主题
8-9/10 元素对比度不达标、输入网址不直跳、输入法回车误触发搜索。体验体检由"通过 11 /
不通过 19"变为"通过 49 / 不通过 0"（**体检清单本身也从 30 项扩到 49 项，前后分母不同**，
不是同口径对比）。实施中另修复了一个 E2E 基础设施缺陷：内嵌静态服务器
对所有文件返回 `text/html`，导致 preview/shim 模式的 CSS 从未被加载、**所有样式类断言
都测不到东西**（详见方案 §9.3）。未完成项与原因见方案 §9.4。

完整评估结论、三轮自审记录与修复证据见 `docs/reviews/项目评估报告.md`；第四轮
对抗式审查（6 项 P2 / 12 项 P3）与修复状态见
`docs/reviews/review-report-adversarial-r4.md`。

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm test` | 单元测试（node:test，91 项） |
| `npm run test:coverage` | 覆盖率（storage.js 行覆盖约 94%、分支约 82%，仅统计被单测加载的模块） |
| `npm run test:e2e` | E2E 全量四模式：preview + file:// + shim + 扩展（合计 398 项断言） |
| `npm run test:e2e:preview` | http 预览 + file://（同一脚本内两段，headless，131 项断言） |
| `npm run test:e2e:shim` | 仅 chrome.storage 模拟模式（headless，134 项断言） |
| `node tools/ux-audit.js` | **体验体检**：布局 / 溢出 / 对比度 / 交互 / 空状态，不达标时退出码 1 |
| `npm run pack` | 单测 + 可复现打包到 `dist/`（排除测试文件、固定时间戳） |
| `npm run pack:zip` | 只打包、不跑单测（排查打包链路时用） |
| `node tools/gen-city-coords.js --dry-run\|--write` | 重建城市经纬度（天气备用源用），构建期工具 |

> 扩展模式 E2E 需要 Chrome For Testing 与 GUI 会话；CI 只跑 preview 与 shim 两个脚本。
> **注意 `--preview` 内部还会再跑一遍 file:// 模式**（`runFileMode()`），所以"四模式"指
> 四种执行环境，不是四个独立命令。
> **改动 `--shim` 的存储替身时先读 `nav-e2e.js` 中 `CHROME_STORAGE_SHIM` 的注释**：
> 其异步特性必须保持宏任务实现，否则时序类缺陷会重新变得不可测。
> **改动天气逻辑时先读 `weather.js` 顶部与 `gen-city-coords.js` 的注释**：天气是双源
> （wttr.in 主源 → Open-Meteo 备源），备用源只认经纬度，坐标来自 `data/cities.json`
> 与 IP 定位兜底；两者缺一，回退链路就会静默失效（E2E `[26]`/`[27]` 覆盖该链路）。
> **天气文案必须是中文**：wttr.in 的 `lang=zh` 对 `weatherDesc` 不生效，码表没覆盖到的
> 代码会回退成英文原文（149 烟霾 / 137 沙尘暴就是这样漏到界面上的）；改码表或兜底后
> 跑 E2E `[44]`，并注意 mock 若把 `weatherDesc` 直接写成中文，这条路径就测不到。
> **改动 E2E 静态服务器时先读 `startStaticServer` 上方注释**：`Content-Type` 必须按扩展名
> 给对，否则 preview/shim 两种模式会静默失去全部样式，样式类断言变成永远通过的绿灯。
> **改动主题或配色时**跑 `node tools/ux-audit.js --contrast`：对比度用真实截图采样
> （背景取像素众数色、前景取 computed color），不能只断言 `data-theme` 属性值。
> 白色不要写裸 `#fff`，**也不要换成 `--text-primary`**——后者在浅色主题下是深色，
> 红底删除键、accent 主按钮上的字会变成深色压深底。用 `--text-on-accent`（彩色/深色
> 底上的文字与图形）或 `--surface-solid`（实心白面），`tests/unit/css-hygiene.test.js`
> 会拦。
> **改动过渡或动画时**：不要用 `transition: all`，也**不要写
> `transition: a, b, c 0.35s`**——那是 3 个独立条目，只有 c 拿到时长，a、b 按 0s
> 处理，过渡静默消失且 CSS 不报错。用 `transition-property` + `transition-duration` +
> `transition-timing-function` 长写。改完跑 css-hygiene，并在真实浏览器里用
> `reducedMotion: 'reduce'` 读一次 computed `transitionDuration`，确认兜底生效。
> **改动天气缓存或切城市逻辑时**：恢复缓存前必须过 `isValidWeatherCache`（版本 +
> 字段形状），城市切换/刷新必须走 `_reqGen` 代次——否则旧结构会渲染出 NaN，
> 慢响应会覆盖后选城市（ADV-03/ADV-04）。
> **改动壁纸明度采样时**：优先 `<img crossOrigin>` + canvas（Canvas 只认服务端 CORS 头，
> **不认扩展 host_permissions**），`fetch` 只适合已有 host 权限的域；随机壁纸源不在
> manifest 白名单里，若改回 fetch，`auto` 主题会再次对该源静默失效（ADV-05）。
> **改动节假日逻辑时**：年度数据由运行时 `holiday-cn` 自动更新，缓存即使过期也保留作
> 双源失败时的兜底；lunar 的 `HolidayUtil` 只负责首次离线安装的历史数据，
> **升级 lunar 是可选项，不要写成年度运维要求**。改完跑 `tests/unit/calendar.test.js`
> 与 E2E `[17.1]`。

## 目录结构

- `src/`：扩展本体，**Chrome 直接加载此目录**（`chrome://extensions` 开发者模式选它）——
  `manifest.json`、`index.html`、`scripts/`（运行时 JS）、`styles/`、`data/`、`images/`、
  `THIRD-PARTY.md`
- `tests/unit/`：单元测试（`node:test`，`*.test.js`）；`tests/e2e/nav-e2e.js`：E2E 四模式
  脚本。测试全在 `src/` 之外，天然不进入分发包
- `tools/`：构建期与检查脚本
  - `pack.js`：可复现打包；产物 `dist/凌睿科技导航.zip` + `.sha256`（已 gitignore）
  - `ux-audit.js`：体验体检（布局 / 溢出 / 对比度 / 交互 / 空状态）
  - `gen-city-coords.js`：城市经纬度生成（调用 Open-Meteo Geocoding），产物写入
    `src/data/cities.json`，**不进入分发包**
- `docs/product/`：V3 产品文档链（用户画像、故事、用例、旅程、PRD、MVP、待办、线路、
  甘特图、使用体验优化方案）+ `assets/` 截图
- `docs/reviews/`：独立评估报告与审查报告（含三轮对抗式自审、第四轮审查、修复证据）
- `docs/wiki/`：代码导览（模块职责、数据模型、关键机制、开发任务指引）
- `docs/process/`：协作过程记录（任务分配等历史文档）+ 目录重组方案
- `.agents/`：多 agent 协作规范（角色 / 规则 / 流程 / 技能）
- `.github/workflows/ci.yml`：CI（单元测试 + 覆盖率 + preview/shim 两种 E2E）

> 目录重组于 2026-09-22 完成（`凌睿科技导航页/` → `src/`、`scripts/` → `tools/`、
> `__tests__/` → `tests/`）。分发包字节未变（SHA-256 保持 `c5e91dd…`），详见
> `docs/process/2026-09-22-目录重组方案.md`。

## 全局规则

1. 大模型的思考（思维链）与回复内容一律使用中文，除非用户明确要求使用其他语言。
2. 保持最小修改：只改动任务范围内的文件，不重构无关代码、不清理无关产物。
3. 任何"完成 / 已修复 / 已通过"的声明必须有可复现的验证证据。
   **证据本身的有效性要求见 `.agents/rules.md` 的「验证有效性」一节**（共四类）——断言须有
   区分度（回退被测代码应红灯）、验证条件须匹配生产、测试替身时序须匹配、**静态检查通过
   ≠ 语义正确**（效果类改动必须在真实渲染环境里读效果值）。本项目已多次出现"测试全绿但
   测不到东西"的情况，任何完成声明前都务必先读该节。
4. 工作区中已有的未提交改动（可能来自其他任务包）一律保留，禁止回退。
5. **对外分发前必须递增 `src/manifest.json` 的 `version`，并在 `CHANGELOG.md` 补一节**。
   Chrome Web Store 与 Edge 加载项商店都要求版本号严格递增，重复或回退会被拒。
   版本语义（主/次/修订）与判定标准见 `CHANGELOG.md` 开头。当前版本：**1.2.8**。

## 多 Agent 协作

- 角色定义：`.agents/roles.md`（ROOT / EXEC / REVIEW 三类，REVIEW 按需创建、结论回 root）
- 协作规则：`.agents/rules.md`（含「验证有效性」四类）
- 标准流程：`.agents/workflow.md`
- 技能规范：`.agents/skills.md`（外部技能映射；`.agents/skills/` 是预留目录，当前为空）
- 核心原则：root 是唯一调度者；执行 agent 独立负责一个任务包；禁止 agent 间互相
  spawn；文件交集非空的任务包禁止并行。
- 任务来源：V3 MVP 的 PKG-01~05 已全部完成，`docs/process/task-allocation.md` 作为
  历史记录保留（其验收标准仍可作为回归清单使用）；新任务按实际需求，依
  `.agents/workflow.md` 的流程分派。
