# 凌睿科技导航页 — Agent 协作规则

> 本文件是 Codex 等 AI 编程代理在本仓库工作的统一入口。
> 多 agent 协作的详细规范见 `.agents/` 目录。

## 项目概述

浏览器导航页扩展（凌睿科技导航页），基于 Chrome Extension MV3 技术栈，数据保存在本地
（chrome.storage.local，含 localStorage 回退），无后端服务、无埋点、无云同步。

**当前状态（2026-09-13）**：V3 的 Phase 1/2 与 Phase 3 工程化项（PBI-14 网络审计、
PBI-15 测试工程+CI、PBI-16 可复现打包、PBI-17 兼容性评估）均已实现并提交。经一轮独立
评估（含三轮对抗式自审）后，**P0 / P1 缺陷已全部清零**，P2 已修复 7 项（网络审计相对
URL 误报、存储层并发写竞态、无障碍支持、打包卫生、输入法提交等）。版本 1.0.0，
**未上架应用商店**（`06-MVP.md` 3.2 战略排除项，属既定决策而非未完成）。

完整评估结论、三轮自审记录与修复证据见 `docs/项目评估报告.md`。

## 常用命令

| 命令 | 用途 |
|------|------|
| `npm test` | 单元测试（node:test，34 项） |
| `npm run test:coverage` | 覆盖率（storage.js 行覆盖约 96%，仅统计被单测加载的模块） |
| `npm run test:e2e` | E2E 全量四模式：preview + file:// + shim + 扩展 |
| `npm run test:e2e:preview` | 仅 http 预览模式（headless，无 GUI 即可跑） |
| `npm run test:e2e:shim` | 仅 chrome.storage 模拟模式（headless，覆盖生产存储后端） |
| `npm run pack` | 单测 + 可复现打包到 `dist/`（排除测试文件、固定时间戳） |

> 扩展模式 E2E 需要 Chrome for Testing 与 GUI 会话；CI 只跑 preview 与 shim 两种 headless 模式。
> **改动 `--shim` 的存储替身时先读 `nav-e2e.js` 中 `CHROME_STORAGE_SHIM` 的注释**：
> 其异步特性必须保持宏任务实现，否则时序类缺陷会重新变得不可测。

## 目录结构

- `凌睿科技导航页/`：扩展源码（`index.html`、`scripts/`、`styles/`、`manifest.json`、`data/`）
  - `scripts/__tests__/`：单元与 E2E 测试，**不进入分发包**（`pack.js` 会过滤）
- `docs/product/`：V3 产品文档链（用户画像、故事、用例、旅程、PRD、MVP、待办、线路、
  甘特图）+ 审查报告 + 任务分配
- `docs/项目评估报告.md`：独立评估报告（发现项、三轮对抗式自审、修复进展与验证证据）
- `docs/spec/`：早期设计文档
- `scripts/pack.js`：可复现打包脚本；产物输出到 `dist/`（已 gitignore）
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

## 多 Agent 协作

- 角色定义：`.agents/roles.md`
- 协作规则：`.agents/rules.md`（含「验证有效性」）
- 标准流程：`.agents/workflow.md`
- 核心原则：root 是唯一调度者；执行 agent 独立负责一个任务包；禁止 agent 间互相
  spawn；文件交集非空的任务包禁止并行。
- 任务来源：V3 MVP 的 PKG-01~05 已全部完成，`docs/product/task-allocation.md` 作为
  历史记录保留（其验收标准仍可作为回归清单使用）；新任务按实际需求，依
  `.agents/workflow.md` 的流程分派。
