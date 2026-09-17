# Review agreement (computed BLIND, before unblinding) — 2026-09-17T15:31:20.393Z

Two independent fresh reviewers (R1, R2; identical rubric, model glm-5.3-flash[1M]
via claude 2.1.251, zero MCP, cwd locked to the anonymous package) scored all
packages. Scores were hashed and locked (review/scores-lock.sha256) before this
comparison. Parsed JSON: R1 20/20, R2 20/20.

| dimension | n | exact % | within ±1 % | mean |diff| |
|---|---|---|---|---|
| representation_fit | 20 | 100 | 100 | 0 |
| primary_task_salience | 20 | 85 | 100 | 0.15 |
| time_to_understand | 20 | 90 | 100 | 0.1 |
| navigation_cost | 20 | 100 | 100 | 0 |
| context_loss | 20 | 100 | 100 | 0 |
| ui_surface_complexity | 20 | 70 | 100 | 0.3 |
| accessibility | 20 | 95 | 100 | 0.05 |
| frontend_rework | 20 | 40 | 100 | 0.6 |
| acceptance_seed_coverage | 20 | 100 | 100 | 0 |

This is outcome-review agreement between two model reviewers on a 1–5 rubric,
not the separate M4 taxonomy coding study and not human agreement. Unavoidable
unblinding: impl-04 (1 hit), impl-05 (2 hits), impl-13 (1 hit), impl-20 (1 hit) —
Prax vocabulary in code comments; recorded, product not edited; reviewers were
instructed not to speculate about provenance; sensitivity analysis excludes them.
