# Golden Case #6 — ECP Cognition Workspace（PRAX-COGNITION-001）

冻结于 2026-09-02，源会话 `ds_20260902113424_16f6a971`（ECP worktree
`E:/codex-prj/ecp-worktrees/ecp-cognition`，分支 `cognition/prax-golden-6`，
基点 ce834df）。这是 **0.2 载荷链的首次 live 运行**：existing_product +
add_surface + direct_code，全链 ①→⑱ 走通，phase COMPLETE。

## 会话参数

- requirement：让人在 Agent 高速推进项目的情况下，持续理解并掌控项目真实状态、变化与原因。
- frame 0.2：jtbd understand / primary_object change_set / task_model（high·reversible·low·expert）
- information_shape 十维：many / high / medium / high / high / medium / conceptual / high / medium / optional
- representation portfolio：primary=canvas；supporting=timeline, search_results, feed, chart；rejected=dashboard, table, tabs（justification_vs_shape 逐项推导）
- 主结构：PAT-CANVAS-WORKSPACE（+ PAT-LIST-DETAIL-INSPECTOR、PAT-WORKSPACE 底座）
- sdir 0.2：11 regions（architecture dominant_workspace）、state_ownership selection→architecture / preview→session、acceptance 1 条
- realization：direct_code（固定四条件集如实申报 1/4 holds，PASS）

## 测量（prax-measure，entry=/cognition，1280x860:desktop + 1440x900:wide）

- 最终收据 `validation-evidence/receipt-2026-09-02T12-34-56-220Z.json`：7/7 pass
  （六条 error 档全绿 + type size pass），4 轮测量收敛（fail 3→4→1→0）。
- 会话工件字节原样冻结；`validation-report.yaml` 为最终 evidence（11 项）。
- 测量环境为 shim vite 管线（ECP 生产 workerd RSC 引导在本机不可用，见
  corrections.yaml #3）；重放测试按 landing 先例在 submit 前写入新鲜收据
  （`tests/prax-cognition-fixture.test.ts` 内 helper）以规避 R3 staleness。

## 已知偏差（诚实记录，也是 Gate 4 的输入）

1. **complexity_budget 缺块（advisory warning）**：generate_from_decisions 不产
   complexity_budget，validate gate 后无合法 MCP 补写路径（validate 只 lint），
   validator 仅 advisory。→ corrections.yaml `correction-cognition-sdir-budget`
2. **design_realize 被任务书要求但链上可跳过**：server 在 reconcile 后直接给
   IMPLEMENTATION_READY；补调 realize propose 需要 conditions 字段（固定四条件
   词表，与任务书描述不一致）。
3. **测量须打非根路由**：CLI 无 --entry（API 支持 entry）。
   → corrections.yaml `correction-prax-measure-entry-cli`
4. **表达组合 vs 研究预期（§41）**：Architecture Canvas + Change Timeline +
   Search + Inspector + Decisions/Activity + Metrics 全部落地；Guided Flows 以
   数据驱动的三张任务卡实现（"先看什么"）；Inspector 由 pattern 层承载而非
   representation 词表词条（词表无 inspector 词条）；Decisions 与 Activity 合并
   为"事实与裁定"+"活动流"两区（reconciliation_decisions 明细 API 未暴露，
   capability need `need-decision-trace` 记为 composable 折衷）。Canvas 未成为
   universal shell：既有四面零改动。

## 冻结范围

- 全部会话 YAML（含 requirement.md、routing-log.yaml、compiled-context.yaml）
- validation-evidence/：4 轮收据 + ready 态截图 ×2 viewport + 各 fail 轮截图 + 测试运行日志
- corrections.yaml（项目级，3 条，字节原样拷入）
