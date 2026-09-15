# M3 Arm Startup — cell-j02-s02 · Arm A (Bare coding agent)

- 简报：`brief.md`（M2 冻结，不得修改；歧义只能提问，操作算子两臂对等回答）
- 预算：wall-clock ≤ 90 min，token ≤ 1.2M；超限即停，如实记录 budget_exceeded
- 操作流程：见 `benchmarks/product-intelligence-matrix/m3-runbook.md`（ deltas）
  与 `benchmarks/architecture-canvas-ab/runbook.md` §2（完整程序）/ §5（评审 Gate A–H）
- 打包：`benchmark-runs/product-intelligence-matrix/cell-j02-s02/m3/<run-id>-a/`；
  收据由操作算子跑 run-cell.mjs 产生（无合法收据的 run 不计）
- 开始前检查：本目录为空 git 仓库（git init 后未提交）；Arm A 不得出现 .prax
  或任何 prax 字样；Arm B 仅应有预置 .mcp.json

## Arm prompt（操作算子照贴，不得增删）

```text
Read REQUIREMENT below and build the product it describes, from scratch, in
this directory (an empty workspace). You may choose the tech stack. The
deliverable must open statically (index.html at the root, or a dist/ build
output), be usable immediately at page load (initial data inlined with the
first screen, no loading state as the measurable state), run locally
without external services, and must not be deployed anywhere. You may run
builds, tests, dev servers, and take real browser screenshots. Real
browser evidence is mandatory for visual claims.

REQUIREMENT:
<contents of brief.md in this directory>
```
