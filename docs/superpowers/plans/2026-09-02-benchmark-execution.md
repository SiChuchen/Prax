# Benchmark Execution Program — 150-Cell Matrix + A/B (2026-09-02)

Status: planned. Entry gate: **Gate 4 closed**（F4 试点冻结后；在此之前 Prax
代码冻结纪律持续）。本计划是 ADR-005 之后第一个独立程序，产出回流
saturation ledger、检查目录与知识库。

上游就位件：`benchmarks/product-intelligence-matrix/`（matrix.yaml 15 示例格 +
run-cell.mjs + ab-protocol.md + inter-rater-pilot.md）、
`data/saturation-ledger.yaml`、prax-measure 测量层（六 error + 一 advisory）。

## M1 — 全矩阵物化与分层排序

- **10 个 shape 原型钉死**：把 §43 的形状侧归纳为 10 个六维
  information_shape 束（每个是一份 `trigger_conditions` 兼容的 facet 组合 +
  一句判别描述），写入 `benchmarks/product-intelligence-matrix/shapes.yaml`；
  词表从 SDIR_VOCAB 取，不新造词。
- **生成器**：`gen-matrix.mjs` 由 15 job（§43 动词集）× 10 shape 产出 150 格
  `matrix-full.yaml`（每格含 job/shape/object 建议/acceptance seed，格式与
  现有 matrix.yaml 同构）。
- **分层优先级**（§46 饱和方法）：先覆盖全部 10 shape × 3 高频 job 的对角
  带，再按 corpus 未覆盖范式扩展；优先级写入每格 `priority: 1|2|3`。
- 门禁 M1：150 格 schema 校验过；对角带 30 格就绪。

## M2 — 试点批 10 格：简报与实现

- 从 priority-1 层抽 10 格（每 shape 原型 ≥1、动词不重复超过 2 次）。
- **简报模板**：`brief-template.md`（user_job 原文 + shape 束 + object +
  acceptance seed + 预算上限）；每格产出 `benchmark-runs/…/<cell>/brief.md`。
- 实现：先 Arm B（Prax 0.2 全链）跑 2 格热身校准流程，再正式双臂。
- 预算：每 run wall ≤ 90min、token ≤ 1.2M（AB-001 中位数的 1.5 倍上限）；
  超限即停如实记录，不硬撑。
- 门禁 M2：10 格 brief 冻结；2 格热身链走通且收据合法。

## M3 — A/B 双臂正式执行

- 纪律照 `ab-protocol.md`：同简报、每臂每格 ≥1 run（试点批共 20+ run，
  预算内做多）、干净 worktree（`ab-worktrees/pi-matrix/<cell>-<arm>`）、
  **臂运行期间 Prax 代码冻结**（同本程序入口纪律）。
- 每实现跑 `run-cell.mjs <cell> --app <impl>`；收据缺失的 run 不计。
- 子代理只做打包/机械校验（glm-5.3-flash，并发 ≤2）；实验臂必须独立
  CLI 会话（利益冲突纪律，AB-001 先例）。
- 门禁 M3：≥10 格双臂齐收据；token/wall 台账完整。

## M4 — Inter-rater 编码 + 饱和台账更新

- 按 `inter-rater-pilot.md` 对试点批产物双编码（§45 八字段）；分歧归因
  三分类（词表缺项/定义含混/真边界）。
- 填 saturation ledger 第 121-150 带（五计数器）；一致率 <70% 的字段触发
  词表复审提案（随 M5 出）。
- 门禁 M4：编码一致率表 + 台账带闭合。

## M5 — 分析、盲评与回流

- 客观项由收据供数（error 率/accessibility/surface complexity/rework 缺陷）；
  感知项双盲评（rubric + Gate checklist，盲包排除过程 artifact）。
- 回流三路：①检查目录提案（同类失败 ≥2 格复发 → 新 check 走
  warning→零过杀→error 晋升通道）②知识收录（18 问规程，新 entry 带
  trigger_conditions/authority_initial/review_by）③keep/revise/remove/defer
  台账 → 决定是否扩产到全 150 格（replan 触发）。
- 门禁 M5（程序出口）：分析报告 + 盲评一致率 + 三路回流落地或明确 defer。

## 风险与纪律

- **冻结边界**：臂运行期间禁改 Prax 六包与 prax-measure；文档可写。
- **失败即数据**：停滞/超限如实记录，不许为跑完而放水（环路契约 §5.7）。
- 150 格全量执行不承诺于本程序——M5 出口才决定扩产（honest boundary）。
