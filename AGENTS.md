# 凌睿科技导航页 — Agent 协作规则

> 本文件是 Codex 等 AI 编程代理在本仓库工作的统一入口。
> 多 agent 协作的详细规范见 `.agents/` 目录。

## 项目概述

浏览器导航页扩展（凌睿科技导航页），基于 Chrome Extension MV3 技术栈，数据保存在本地
（chrome.storage.local，含 localStorage 回退），无后端服务、无埋点、无云同步。

**当前状态（2026-09-15）**：V3 的 Phase 1/2 与 Phase 3 工程化项（PBI-14 网络审计、
PBI-15 测试工程+CI、PBI-16 可复现打包、PBI-17 兼容性评估）均已实现并提交。经一轮独立
评估（含三轮对抗式自审）后，**P0 / P1 缺陷已全部清零**，P2 已修复 7 项（网络审计相对
URL 误报、存储层并发写竞态、无障碍支持、打包卫生、输入法提交等）。当前版本 1.1.0
（天气双源容灾、导入书签、主页快捷编辑、快捷键扩展，详见 `CHANGELOG.md`），
**未上架应用商店**（`06-MVP.md` 3.2 战略排除项，属既定决策而非未完成）。

**V4 使用体验优化已实施（2026-09-15）**：`docs/product/10-使用体验优化方案.md` 的 15 项
（UX-01~15）全部落地，包括修掉 4 项 P0——内容增长后搜索框被挤出视口且滚不回来、浅色主题
8-9/10 元素对比度不达标、输入网址不直跳、输入法回车误触发搜索。体验体检由"通过 11 /
不通过 19"变为"通过 46 / 不通过 0"。实施中另修复了一个 E2E 基础设施缺陷：内嵌静态服务器
对所有文件返回 `text/html`，导致 preview/shim 模式的 CSS 从未被加载、**所有样式类断言
都测不到东西**（详见方案 §9.3）。未完成项与原因见方案 §9.4。

完整评估结论、三轮自审记录与修复证据见 `docs/项目评估报告.md`。

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm test` | 单元测试（node:test，67 项） |
| `npm run test:coverage` | 覆盖率（storage.js 行覆盖约 96%，仅统计被单测加载的模块） |
| `npm run test:e2e` | E2E 全量四模式：preview + file:// + shim + 扩展（合计 389 项断言） |
| `npm run test:e2e:preview` | 仅 http 预览模式（headless，128 项断言） |
| `npm run test:e2e:shim` | 仅 chrome.storage 模拟模式（headless，131 项断言） |
| `node scripts/ux-audit.js` | **体验体检**：布局 / 溢出 / 对比度 / 交互 / 空状态，不达标时退出码 1 |
| `npm run pack` | 单测 + 可复现打包到 `dist/`（排除测试文件、固定时间戳） |
| `node scripts/gen-city-coords.js --dry-run\|--write` | 重建城市经纬度（天气备用源用），构建期工具 |

> 扩展模式 E2E 需要 Chrome for Testing 与 GUI 会话；CI 只跑 preview 与 shim 两种 headless 模式。
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
> **改动主题或配色时**跑 `node scripts/ux-audit.js --contrast`：对比度用真实截图采样
> （背景取像素众数色、前景取 computed color），不能只断言 `data-theme` 属性值。

## 目录结构

- `凌睿科技导航页/`：扩展源码（`index.html`、`scripts/`、`styles/`、`manifest.json`、`data/`）
  - `scripts/__tests__/`：单元与 E2E 测试，**不进入分发包**（`pack.js` 会过滤）
- `docs/product/`：V3 产品文档链（用户画像、故事、用例、旅程、PRD、MVP、待办、线路、
  甘特图）+ 审查报告 + 任务分配
- `docs/项目评估报告.md`：独立评估报告（发现项、三轮对抗式自审、修复进展与验证证据）
- `scripts/pack.js`：可复现打包脚本；产物 `dist/凌睿科技导航.zip` + `.sha256`（已 gitignore）
- `scripts/gen-city-coords.js`：城市经纬度生成脚本（构建期，调用 Open-Meteo Geocoding）；
  产物写入 `凌睿科技导航页/data/cities.json`，**不进入分发包**
- `.agents/`：多 agent 协作规范（角色 / 规则 / 流程 / 技能）
- `.github/workflows/ci.yml`：CI（单元测试 + 覆盖率 + preview/shim 两种 E2E）

## 全局规则

1. 大模型的思考（思维链）与回复内容一律使用中文，除非用户明确要求使用其他语言。
2. 保持最小修改：只改动任务范围内的文件，不重构无关代码、不清理无关产物。
3. 任何"完成 / 已修复 / 已通过"的声明必须有可复现的验证证据。
   **证据本身的有效性要求见 `.agents/rules.md` 的「验证有效性」一节**——断言须有区分度
   （回退被测代码应红灯）、验证条件须匹配生产、测试替身时序须匹配。本项目已多次出现
   "测试全绿但测不到东西"的情况，新增断言前务必先读该节。
4. 工作区中已有的未提交改动（可能来自其他任务包）一律保留，禁止回退。
5. **对外分发前必须递增 `凌睿科技导航页/manifest.json` 的 `version`，并在 `CHANGELOG.md` 补一节**。
   Chrome Web Store 与 Edge 加载项商店都要求版本号严格递增，重复或回退会被拒。
   版本语义（主/次/修订）与判定标准见 `CHANGELOG.md` 开头。当前版本：**1.1.0**。

## 多 Agent 协作

- 角色定义：`.agents/roles.md`
- 协作规则：`.agents/rules.md`（含「验证有效性」）
- 标准流程：`.agents/workflow.md`
- 核心原则：root 是唯一调度者；执行 agent 独立负责一个任务包；禁止 agent 间互相
  spawn；文件交集非空的任务包禁止并行。
- 任务来源：V3 MVP 的 PKG-01~05 已全部完成，`docs/product/task-allocation.md` 作为
  历史记录保留（其验收标准仍可作为回归清单使用）；新任务按实际需求，依
  `.agents/workflow.md` 的流程分派。
