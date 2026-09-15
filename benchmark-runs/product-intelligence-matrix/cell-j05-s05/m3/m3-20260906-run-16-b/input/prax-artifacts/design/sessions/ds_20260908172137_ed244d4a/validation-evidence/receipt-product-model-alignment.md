# Measurement receipt — product_model_alignment

- Measured at: 2026-09-08T18:00Z (local 2026-09-09 01:58 +08:00)
- Measured by: Claude (implementation arm, cell-j05-s05-b)
- Method: --dump-dom over index.html#follow=web-app>api-gateway>order-service (evidence/05-dom-follow.html), regex counts + aria-label inspection; screenshot review.

## Result

Product Frame objects are preserved verbatim in the UI language and structure:

- service_node → 24 `g.node[role=button]` with aria-label "<id> <中文名>，<团队>，直接依赖 N 项，被依赖 M 项"
- dependency_edge → 40 `.edge-hit[role=button]` with aria-label "依赖关系：<from> 依赖 <to>…" — relationships are first-class selectable content
- follow_trail → ordered chips with per-hop direction label (→依赖 / ←被依赖), screenshot 02: web-app →依赖 api-gateway →依赖 order-service →依赖 payment-service
- system_map → persistent; dim-to-focus never removes nodes/edges (screenshot 02, context bar "路径 4 节点清晰 / 全图 24 服务 40 依赖关系 · 保持原位可见")

DOM counts: tabindex=0 ×64, role="button" ×64, aria-label ×73, .edge-hit ×40, chip.current ×1.

## Artifacts

- evidence/05-dom-follow.html
- evidence/02-follow-trail.png
