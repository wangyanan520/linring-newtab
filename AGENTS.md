# 凌睿科技导航页 — Agent 协作规则

> 本文件是 Codex 等 AI 编程代理在本仓库工作的统一入口。
> 多 agent 协作的详细规范见 `.agents/` 目录。

## 项目概述

浏览器导航页扩展（凌睿科技导航页），基于 Chrome Extension 技术栈，数据保存在本地
（chrome.storage），无后端服务。V3 MVP（PKG-01~05）代码已于 2026-08-14 复核确认实现
并提交（git 6b78f2a），当前处于 root 按 task-allocation.md 验收标准验收阶段。

## 目录结构

- `凌睿科技导航页/`：扩展源码（`index.html`、`scripts/`、`styles/`、`manifest.json`）
- `docs/product/`：V3 产品文档链（用户画像、故事、用例、旅程、PRD、MVP、待办、线路、
  甘特图）+ 审查报告 + 任务分配
- `.agents/`：多 agent 协作规范（角色 / 规则 / 流程）

## 全局规则

1. 大模型的思考（思维链）与回复内容一律使用中文，除非用户明确要求使用其他语言。
2. 保持最小修改：只改动任务范围内的文件，不重构无关代码、不清理无关产物。
3. 任何"完成 / 已修复 / 已通过"的声明必须有可复现的验证证据。
4. 工作区中已有的未提交改动（可能来自其他任务包）一律保留，禁止回退。

## 多 Agent 协作

- 任务来源：`docs/product/task-allocation.md`（PKG-01~05 任务包，含依赖关系与验收标准）
- 角色定义：`.agents/roles.md`
- 协作规则：`.agents/rules.md`
- 标准流程：`.agents/workflow.md`
- 核心原则：root 是唯一调度者；执行 agent 独立负责一个任务包；禁止 agent 间互相
  spawn；文件交集非空的任务包禁止并行。

