# Measurement Receipt — filter_state (deterministic+empirical)
- Run log: validation-evidence/cdp-run.log; machine-readable: validation-evidence/checks.json; visuals: 04-weight-customized.png, 06-zero-weights-empty.png.
- Active query state explicitly represented: per-criterion numeric outputs; 「已自定义」chip appears when any weight deviates (weight_adjust.chipVisible=true); 重置默认 button + R restores defaults (reset_works all true).
- Result state: zero weights -> fit row shows 「— 待设权重」 x3, verdict switches to 暂无有效评分 and lock button disabled (zero_weights {emptyHints:3, verdictEmpty:true, lockDisabled:true}).
