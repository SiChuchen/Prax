# Measurement Receipt — product_model_alignment (assistive)
- Artifacts: validation-evidence/01-initial-ready.png, validation-evidence/02-select-b-sync.png, validation-evidence/checks.json
- User-facing structure and language preserve the Product Frame objects: 候选铺位 (matrix columns A/B/C), 商圈地图 (left resident SVG panel), 决策权重 (slider rail), 决策结论 (resident verdict bar).
- Relationship rel_site_in_map realized as two-way selection sync; checks.json#selection_sync = {pinBSelected:true, thBSelected:true, walkLineVisible:true, walkLabel:"步行 9′"}.
- rel_weights_score / rel_sites_verdict realized: weight input recomputes fit + rank (checks.json#weight_adjust) and verdict updates leader/locked copy.
