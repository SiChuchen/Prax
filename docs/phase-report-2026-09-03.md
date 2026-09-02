# Phase Report — 2026-09-03 (benchmark execution program: M1 + M2 + M3-prep)

Program: `docs/superpowers/plans/2026-09-02-benchmark-execution.md`（ADR-005
后第一个独立程序）。Baseline at start: `4d9373f`（origin/main），npm test
321/321（49 文件）——开场已验证相符。本轮范围：M1、M2、M3 启动包准备；
M3 双臂执行留给操作算子（利益冲突纪律）。全程 TDD，逐任务提交，每提交前
npm test 全绿。

## Task ledger

| Task | Commit | Tests added | Evidence |
|---|---|---|---|
| M1.1 shapes.yaml（10 shape 原型） | `3db5801` | benchmark-matrix (5) | 原型=首 exemplar 解析后 shape 字节一致（round-trip 测试钉死）；五处吸收（cell-09/15/11/14/12）各记 ≤3 非判别维偏差 |
| M1.2 gen-matrix.mjs + matrix-full.yaml + cells.mjs | `6897693` | benchmark-matrix (12) | 150 格逐格 schema 校验；§43 自然配对 job/object/seed 原文保持；run-cell 可解析全矩阵格 |
| M1.3 门禁 M1 | （同上，测试即证据） | — | band 30/30 全 priority-1；P1=42 格、14 动词；P2=91（corpus 未覆盖）；P3=17 |
| M2.1 pilot-batch.yaml + gen-briefs.mjs + 12 简报冻结 | `f27f132` | benchmark-matrix (15) | 10 试点简报 + 2 热身简报字节级冻结（重生成一致由测试钉死）；brief-template.md 独立文件（补充提交） |
| M2.2 2 格 Arm B 热身 | `2813dad` | — | cell-j09-s01：链 COMPLETE 11/11，收据 7/7×2（worktree+benchmark），墙钟 625s；cell-j13-s02：链 COMPLETE 11/11，收据 7/7×2，墙钟 209s |
| M3-prep per-arm 启动包 ×20 + M3 runbook | `5836bf5` | — | `ab-worktrees/pi-matrix/<cell>-{a,b}`：冻结简报 + 臂 prompt README + B 臂 .mcp.json（PRAX_STATE_ROOT 钉 worktree）；`m3-runbook.md` 为 AB-001 §2/§5 的 delta 手册 |
| 本记录 + 缺口 #1 方案 | （本提交） | — | 见下 |

测试计数：321 → **336/336**（50 文件；+15 = M1.1 五项 + M1.2 七项 +
M2.1 三项，全部在 `tests/benchmark-matrix.test.ts`；M2.2/M3-prep 为基准
产物与文档，不加测试）。

## Gate M1 evidence — PASSED

1. 150 格全部通过逐格 schema 校验（id/job_shape/user_job 走 SDIR 0.2 词表、
   information_shape 走 InformationShapeSchema、object_type ∈ OBJECT_TYPES、
   priority ∈ {1,2,3}）——永久测试 `tests/benchmark-matrix.test.ts`。
2. 对角带 30 格（10 shape × {decide, locate, explore}）全部存在且 priority=1。
3. §43 十五格全部被 10 原型吸收（无遗漏、无双重归属）。

## Gate M2 evidence — PASSED

1. 10 格试点简报冻结：`benchmark-runs/product-intelligence-matrix/
   <cell>/brief.md` 已入库；重生成字节一致（测试钉死）。选取=每 shape 恰
   1 格的 §43 自然配对；shape-03 取 decide 源格使三个高频动词齐备；
   understand ×2 为唯一动词重复（≤2 约束满足）。
2. 2 格热身链走通且收据合法：
   - `ds_20260902170755_09231fa8`（cell-j09-s01，greenfield）：0.2 全链
     start→…→validate evaluate = COMPLETE，11/11 findings pass；收据
     `receipt-…17-16-09-269Z`（7/7，双 viewport）+ run-cell 基准收据
     `receipt-…17-18-03-850Z`（7/7，schema 校验内建）。
   - `ds_20260902171904_9096fb54`（cell-j13-s02，greenfield）：同上 COMPLETE
     11/11；收据 7/7×2（`…17-22-02-160Z` / `…17-22-32-683Z`）。
   - 热身产物明确标注"process calibration only, NOT experimental data"；
     两格均在试点批之外（试点 10 格对 M3 保持全新）。
3. 预算：625s / 209s 墙钟（上限 90min）；token 无逐 run 计量器，如实记录
   为 honest limitation（单会话执行者，远低于会话预算）。

## 附带任务 A — 缺口 #1（complexity_budget 无合法回填路径）裁定方案

事实（F4 立案 + 本轮两次热身复现）：`generate_from_decisions` 不产
complexity_budget；validate 门开启后 `design_sdir` 只收 mode=validate
（lint-only 不落盘），generate_from_decisions 被 GATE_NOT_SATISFIED 拒绝；
validator 仅作 presence-only advisory（evaluate 时 warning，findings 仍
pass）。F4 fixture 的 replay 测试断言了该 warning 的原文（冻结）。

**方案 1 — 生成侧派生（budget 变派生默认值）**
- 改动：generator 以确定性规则从已决 SDIR 推导十计数（regions→
  permanent_surfaces/panels、state_ownership→state_owners、
  information_hierarchy 深度→navigation_levels、locate 交互→persistent_filters…），
  推导表写入 spec。
- 生命周期语义：budget 从"作者承诺的上限"变为"机器对已声明设计的计量"。
  P-044 的"新永久面被计数"保留；"预算即承诺"语义丢失。生成路径可把
  advisory 升为可执行；手写/apply_delta 路径仍需 presence 规则。
- 测试成本：中。推导表 10 计数 × 边界用例 + sdir-02 往返 + 编译上下文不变。
  **冻结 fixture 冲突**：cognition replay 断言 warning 原文 → 需重生成
  fixture（v2，破坏"bytes as produced"纪律，须用户签字）或版本化行为。
- 风险：派生数值"错而自信"——计数但不约束。

**方案 2 — 受限的 validate 后 amend 通道（仅 budget 块的 delta）**
- 改动：mode=apply_delta（枚举已有）在 validate 开启后可受理，但 delta
  触及面 ⊆ {complexity_budget}；以 sdir 修订落盘，不重开 decide/sdir 门。
- 生命周期语义：引入首个合法"门后变异"类——必须可证明除 budget 外零副
  作用；与 ADR-005 不重开已冻结 artifact 的立场相逆，开"amend 后门"先例
  （下一个请求可能是 amend acceptance）。 receipts 陈旧性交互需厘清
  （§5.7 R3：sdir 落盘时间戳会令既有收据变陈旧→需重测？）。
- 测试成本：高。新门语义（窗口、delta 范围限缩、GATE 码）+ 陈旧性交互 +
  对抗用例（动 regions 的 delta 必须被拒）+ MCP schema。fixture 可不動
  （fixture 不 amend，warning 保留）——兼容性最好。
- 语义上唯一让 F4 任务简报"requires ten-count budget"以"作者数据"身份
  完全可满足的方案。

**方案 3 — 作者点上移到 decide（portfolio 伴随 budget）**
- 改动：decide 0.2 payload 增可选 complexity_budget 块；generate 原样
  抄入 SDIR；validator presence 规则因此在 sdir 前即可闭环。
- 生命周期语义：budget 成为决策时点的承诺（时序上更对——它是表达决策），
  decide 门可加超阈 justification 规则；SDIR 保持忠实派生。无门后变异类。
- 测试成本：中。decide schema + 门规则（mcp-payload-02/decide-representation
  套件）+ generate 透传 + 编译上下文 + MCP client schema + 0.1 legacy 不
  受扰。**fixture 冲突**：decide 与 sdir 字节都会变 → 需 fixture v2 签字。
- 风险：decide 载荷增重；作者在声明 regions 前计数（鸡生蛋——缓解：
  validator 只查 presence 不查准确性，与现状一致）。

**建议**：方案 3（若接受 fixture v2 重生成）；若不动冻结 fixture 为硬约束，
则方案 2（fixture 兼容但门语义成本最高）；方案 1 仅当"派生计量"被接受为
budget 语义时选。零成本现状（advisory + 文档说明简报不得承诺 budget 强制）
也是合法选项——两格热身证明它不阻塞链路 COMPLETE。**等你裁定后再动代码。**

## 附带任务 B — 偏差与决定台账（keep/revise/remove/defer）

### 计划消歧（记录，不发明新规则）

1. **P1 层定义**：计划文本"对角带 30 格"与 M2 抽样约束（动词 ≤2、每
   shape ≥1 ⇒ 需 ≥5 动词）在字面上不相容。消歧：P1 = 对角带 ∪ §43 自然
   配对（42 格，14 动词），P2 = corpus 未覆盖范式，P3 = corpus 已覆盖。
   依据：§46"补覆盖薄弱范式"；M2 约束是硬文本。已用测试钉死（P1 动词
   数 ≥5 断言），P1/P2/P3 计数 42/91/17 写入 matrix-full 头注。
2. **3 高频 job**：无既有定义。取 corpus-2026-09 task_type 计数前三
   （decide 11 / locate 7 / explore 6），记入 shapes.yaml 头注。
3. **自然配对格的 information_shape 规范化为吸收原型**（cell-09/15/11/14/12
   的原始 shape 偏差保留在 matrix.yaml §43 原文中；matrix-full 是规范层）。

### 执行偏差

4. **热身选格在试点批之外**（计划未钉）：保持试点 10 格对 M3 全新，
   热身仅作流程校准（其产物永不入实验数据）。
5. **worktree 语义适配**：矩阵格是从零产品，AB-001 的"自既有仓切
   worktree"不可迁移；改为预建空 git 仓 + 冻结简报 + README（A/B 臂同构，
   B 臂加 .mcp.json）。M3 runbook 记为 delta。
6. **链驱动机制**：以 40 行零依赖 stdio JSON-RPC 驱动器
   （`ab-worktrees/pi-matrix/_tools/mcp-call.mjs`，未入库——避免向冻结仓
   添加未测试代码；位置与用途记入各 summary.yaml；AB-001 run-02 同型先例）。
   PRAX_STATE_ROOT 钉在各 worktree 的 .prax。
7. **brief-template.md 独立成文**：计划点名该文件；实现中模板逻辑在
   gen-briefs.mjs（renderBrief），另补独立模板契约文档（提交于 M2.1 后）。
8. **热身应用栈选 React+Vite**：因 prepare 契约 framework 为字面量
   "react"（见摩擦 f4）；与简报"技术栈自选"存在张力，如实记录。

### 热身新观察的摩擦（喂 M5 回流：检查目录/知识提案候选）

- f1 requirement-confirmation 门：仅 task_brief 证据不够，必须
  conversation_message / user_document（EXPAND，信息清晰）。
- f2 decide 门：representation.rejected 不满足 ALTERNATIVE_NOT_REJECTED，
  必须顶层 rejected（结构备选）——可发现性缺口（与 F4 缺口 #5 同类）。
- f3 路由后重调 design_route → BLOCK（设计如此），但 BLOCK 响应不解释
  "门已过"；臂代理重试时需读 next 字段。
- f4 **prepare framework 契约 = z.literal("react")，与臂中立简报的
  "技术栈自选"冲突**：非 React 臂要么谎报要么卡门。建议 M5 检查目录/
  契约提案（扩枚举或放开为自由串 + 警告）。
- f5 keyboard 证据无 artifact_refs 会挂自证 warning（measurement_receipt
  在场也挂）；热身 2 补 artifact_refs 后消失——M3 B 臂打包指南已提示。
- f6 run-cell 的 vite preview 以调用方 cwd 解析 viteBin：从 worktree
  调用则正确；已写入 m3-runbook 的收据步骤。
- f7 已知 advisory（缺口 #1）在两格热身均复现，行为与 F4 fixture 一致。

### Keep / Revise / Remove / Defer

- **keep**：TDD 逐任务提交；简报冻结=生成器+重生成一致测试；热身在试点
  批外；收据双落（worktree 会话证据 + run-cell 基准证据）；failure-as-data
  （两 warning 均如实入 summary）。
- **revise**：无（消歧 1-3 为解释性记录，未改计划文本）。
- **remove**：无。
- **defer**：M3 双臂执行（操作算子逐臂启动，启动包已就位）；M4 inter-rater
  与 saturation 第 121-150 带；M5 分析/盲评/回流（含 f2/f4 的检查目录提案、
  缺口 #1 裁定后的实现）；150 格扩产决定（M5 出口）。

## 验证

- 本提交前最后一次 `npm test`：**336/336 全绿（50 文件）**。
- 基线→现在提交链：`4d9373f` → `3db5801`（M1.1）→ `6897693`（M1.2）→
  `f27f132`（M2.1）→ `c029e6d`（brief-template docs）→ `2813dad`（M2.2）→
  `5836bf5`（M3-prep）→ 本提交。push 未执行（待指示）。
