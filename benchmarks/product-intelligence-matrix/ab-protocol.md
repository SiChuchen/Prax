# A/B Protocol v1 — Product-Intelligence Matrix (research §44; Phase 4 F2)

## Arms

同一 Product Brief（来自 `matrix.yaml` 单元格 + 操作算子补充的场景化简报）：

- **Arm A**：Bare Coding Agent（裸编码代理）
- **Arm B**：Same Agent + Prax（同一代理挂载 Prax MCP）

每臂 ≥3 runs；两臂从干净 worktree 起跑；除臂变量外的一切（模型、温度、
依赖版本、时间预算）保持一致。执行方式沿用 PRAX-AB-001 的 worktree +
独立 CLI 会话模式（子代理不跑实验臂——利益冲突与 prompt 泄漏纪律见
memory/benchmark 先例）。

## 评价（13 项，§44 原文照录）

```text
Representation Fit
Primary-task salience
Time to understand
Task completion time
Error rate
Context loss
Navigation cost
Information retrieval accuracy
UI surface complexity
Accessibility
Frontend rework
Token cost
Human preference
```

客观项（Error rate / Accessibility / UI surface complexity / Frontend
rework 的缺陷部分）由 prax-measure 收据供数：每 run 执行
`run-cell.mjs <cell> --app <implementation>`，收据进入盲评包；收据缺失的
run 不计入（skipped 不是 passed）。

## 盲评程序（复用 PRAX-AB-001）

- 双盲 reviewer 独立会话，rubric 逐项打分 + Gate A–H checklist
  （`benchmark-runs/PRAX-AB-001/runbook.md` §5）。
- **rubric-bias 教训（AB-001 lessons/prax-gaps.yaml 已立案）**：盲评包
  排除流程 artifact（会话日志、门禁记录等过程证据）——纳入会系统性
  低估 Prax 臂的流程收益；过程证据只在解盲后的复盘层使用。
- 解盲后：comparison / findings / gates / Knowledge Absorption Review
  全部入库（AB-001 先例）。

## 判定与去留

- 结果决定词表/检查目录的 keep/revise/remove/defer（AB-001 §6 程序）。
- 不预设方向性结论：AB-001 的产出质量两臂无方向性差异是有效结果，
  流程可靠性差异（8 gate 走完率）与成本差异分别陈述。
