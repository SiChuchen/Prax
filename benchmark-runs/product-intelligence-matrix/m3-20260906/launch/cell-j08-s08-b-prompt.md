Read REQUIREMENT below and build the product it describes, from scratch, in
this directory (an empty workspace). You may choose the tech stack. The
deliverable must open statically (index.html at the root, or a dist/ build
output), be usable immediately at page load (initial data inlined with the
first screen, no loading state as the measurable state), run locally
without external services, and must not be deployed anywhere. You may run
builds, tests, dev servers, and take real browser screenshots. Real
browser evidence is mandatory for visual claims.

REQUIREMENT:
# Product Brief — cell-j08-s08 (edit × single-document)

Benchmark: product-intelligence-matrix（150 格全矩阵，plan 2026-09-02）
Cell: cell-j08-s08 · priority-1 §43 原配对 · 源格：cell-08（matrix.yaml 原文）

## 用户任务（user_job）

- 动词：edit
- 对象：文档
- 成功标准：编辑不破坏结构

## 信息形状（shape 束：single-document）

| facet | 取值 |
|---|---|
| 基数 | one (one) |
| 关系性 | 低 (low) |
| 层级性 | 中 (medium) |
| 时间性 | 中 (medium) |
| 密度 | 低 (low) |
| 维度性 | 中 (medium) |
| 空间性 | none (none) |
| 易变性 | 中 (medium) |
| 不确定性 | 低 (low) |
| 比较需求 | none (none) |

判别：单一文档的编辑任务，结构化编辑与预览一致、密度低。

## 主对象建议

- object_type：document
- 建议备选：document

## 验收种子（acceptance seed）

结构化编辑与预览一致

## 交付约束

- 从零实现一个单页 Web 应用（新目录、新代码，不得复用既有业务系统）
- 技术栈自选；交付物必须能直接静态打开（根路径 index.html，或构建产物 dist/）
- 应用在页面加载完成时即处于可用状态（初始数据随首屏就绪，不得以加载态作为可测状态）
- 不得部署到外部服务；本地可运行、可构建
- 规模上限：单页应用，主屏 1 个；不要求后端、账号体系或持久化服务

## 预算上限（超出即停，如实记录）

- wall-clock ≤ 90 min
- token ≤ 1.2M（AB-001 中位数的 1.5 倍）

## 冻结纪律

本简报由基准程序 M2 冻结（见 git 历史与 phase report 2026-09-03）；执行臂
不得要求修改验收标准，只能就歧义提问（操作算子记录并对两臂对等回答）。

This workspace has the Prax MCP server configured (project .mcp.json, with
PRAX_STATE_ROOT pinned to this directory's .prax). Work through Prax for
this task: start a design session (design_start with mode greenfield),
provide requirement confirmation, and follow the returned gates
(frame / context / route / inspect / decide / sdir / reconcile / realize /
prepare / validate) using the brief as the requirement text. Use the
compiled context and validation plan Prax returns as your implementation
guidance. Then implement the product in this directory exactly as you
would otherwise. The enforced gate sequence is discoverable from the tool
responses themselves.
