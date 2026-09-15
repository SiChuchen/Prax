# Measurement receipt — state_ownership_declared

- Measured at: 2026-09-08T18:00Z (local 2026-09-09 01:58 +08:00)
- Measured by: Claude (implementation arm, cell-j05-s05-b)

## Result

Session SDIR 0.2 (design_sdir validate PASS) declares owners for both required states and the rest:

| state | owner (SDIR) | implementation |
|---|---|---|
| selection | session | single `state` object in app.js (`state.sel`) drives inspector + focus |
| preview | map | `#tooltip` driven by map mousemove handler (hover preview) |
| mode | session | `state.trail` / `state.focus` drive dim-to-focus |
| viewport | map | fixed deterministic layout; map owns no mutable viewport |
| query | topbar | `#search` input value + dropdown |
| inspector | inspector | derived render from selection (`renderInspector`) |

Declaration and implementation are consistent; both selection and preview have declared owners.

## Artifacts

- app.js (state declaration section)
