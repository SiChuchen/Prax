# Measurement receipt — semantic_conformance

- Measured at: 2026-09-08T18:00Z (local 2026-09-09 01:58 +08:00)
- Measured by: Claude (implementation arm, cell-j05-s05-b)
- Method: design_sdir(mode=validate) returned PASS with schema_errors=0, semantic_errors=0 for SDIR 0.2; rendered page regions compared to SDIR regions on headless-Edge captures.

## Result

Session SDIR validated at 0.2 (screen-main, archetype PAT-WORKSPACE). Regions and importance in the delivered page match the SDIR:

| SDIR region | importance | delivered |
|---|---|---|
| map | dominant | SVG whole-web graph, left panel ~75% width (evidence/01-initial.png) |
| inspector | primary, selection_driven | right 344px panel, empty-state until selection |
| trailbar | primary, always | context counts + ordered hop chips + clear |
| topbar | supporting, always | brand, search, edge-type filter, reset |

dim-to-focus contract (map never removes nodes/edges) verified in evidence/02-follow-trail.png.

## Artifacts

- evidence/01-initial.png
- evidence/02-follow-trail.png
