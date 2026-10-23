# Measurement receipt — product_model_alignment

- check: `product_model_alignment` (assistive, semantic_integrity)
- measured at: 2026-09-19T05:02+08:00, same CDP run (see keyboard-receipt for method).
- Product Frame objects → on-screen realizations (all measured in the live DOM):
  - `metric` → 24 tiles in 4 group sections (`steps.initial.tiles = 24`).
  - `anomaly` → crit/warn badges on tiles (危急/告警), severity counters (`cCrit=2, cWarn=4`),
    timestamped event feed (`feedRows = 8`).
  - `metric_group` → 接入网关 / 订单域 / 支付域 / 库存域 section headers with per-group counts.
  - `change_history` → inspector for the selected metric: 90-point chart with highlighted anomaly
    segment (`.ch-hot` path length 335 chars, `steps.trace.hotD`), anomaly start time + duration
    ("异常自 05:02:10 起，已持续 0:28"), 12 most recent timestamped samples with per-point Δ.
- Relationships: `anomaly raised_by metric` = feed row click jumps to the metric; `metric belongs_to
  metric_group` = section grouping; `change_history records metric` = inspector binding.
- artifacts: evidence/01-initial-load.png, evidence/04-inspector-trace.png, report.json
