# 技能规范

技能（Skill）是把可复用的工作方法、检查清单和领域知识固化成文档的机制。多 agent
协作中，技能决定"每个角色用什么方法做事"，与角色（谁）、规则（边界）、流程
（步骤）并列。

## 一、技能来源

| 来源 | 位置 | 说明 |
|------|------|------|
| 环境技能 | 宿主机器 skills 目录（Codex / agents 体系） | 通用工作法，按需读取 |
| 项目技能 | `.agents/skills/`（**预留，当前为空**） | 计划放本项目专用技能（浏览器扩展验收清单、V3 任务包执行模板），见 §四待办 |

## 二、角色 → 技能映射

### ROOT（编排者）

| 技能 | 使用时机 |
|------|----------|
| planning-and-task-breakdown | 把用户目标拆成任务包与批次 |
| verification-before-completion | 验收每个任务包、放行下一批之前 |
| code-review-and-quality | 放行前对关键产物做代码审查（或创建 REVIEW agent） |
| documentation-and-adrs | 记录架构决策与执行状态变更 |

### EXEC（执行 agent）

| 技能 | 使用时机 |
|------|----------|
| test-driven-development | 实现功能或修复 bug 之前，先写失败测试。**注意**：本技能的 "MANDATORY" 针对**行为类改动**（功能、缺陷修复）；纯文档、配置或效果类的样式调整不适用，但效果类改动仍需真实渲染验证（见 `rules.md`「验证有效性」第 4 类） |
| incremental-implementation | 任务跨多文件时，小步实现、逐步验证 |
| systematic-debugging | 遇到测试失败或意外行为时，先找根因再修复 |
| verification-before-completion | 声称完成之前，运行验证并确认输出 |
| source-driven-development | 使用框架 / API 时，以官方文档为准 |

### REVIEW（审查 agent）

| 技能 | 使用时机 |
|------|----------|
| code-review-and-quality | 多维度审查任务包产物 |
| intended-vs-implemented | 核对代码是否匹配文档/验收标准 |
| doubt-driven-development | 对高风险改动做对抗性复查 |

## 三、技能使用规则

1. 任务命中技能描述时，必须先完整读取对应 `SKILL.md`，再按其中步骤执行。
2. 用户显式提到技能名（如 `$skill-name`）时，该技能强制启用。
3. 技能只在当前任务轮次内使用；跨轮次不自动沿用，除非再次触发。
4. EXEC 只使用自己任务相关的技能；不得因父上下文中的用户指令触发与任务无关的
   技能（防止上下文污染）。
5. 项目级技能放在 `.agents/skills/<skill-name>/SKILL.md`；创建新技能走 skill-creator
   流程，由 ROOT 或用户主导。
6. 技能与任务冲突时，以用户明确指令和项目文档（AGENTS.md / task-allocation.md）
   为准。

## 四、本项目建议补充的项目级技能（待办）

- `extension-acceptance`：Chrome 扩展冒烟验收清单（加载、权限、存储、主题切换、
  拖拽排序、导入导出）。
- `pkg-exec-template`：任务包执行模板（读 task-allocation → 白名单 → 实现 → 验证 →
  报告），减少 EXEC 跑偏。

