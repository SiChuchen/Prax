# Measurement receipt — hierarchy_review

- check: `hierarchy_review` (assistive, visual_hierarchy)
- measured at: 2026-09-19T05:02+08:00, same CDP run as keyboard-receipt (viewport 1600×1000,
  `Emulation.setDeviceMetricsOverride`), screenshots full-page PNG.
- measured facts:
  - Region prominence matches SDIR: `metric-wall` is the dominant region (~3/4 viewport width);
    `inspector` is primary, selection-driven and visible at load; `status-bar` / `anomaly-feed`
    are supporting strips. No modal overlays cover the wall.
  - Anomaly salience at first glance: initial severity counts `cCrit=2, cWarn=4, cAll=18`
    (`report.json` → `steps.initial`); crit/warn tiles carry colored left border + badge +
    group-level counts (visible in `01-initial-load.png`).
  - Filter narrows without reflow: after clicking the 危急 filter, visible (non-dimmed) tile count
    equals crit count — `steps.filterCrit.visibleTiles=2 == critCount=2` (`06-filter-crit.png`);
    dimming preserves tile positions.
  - No horizontal overflow: `steps.initial.hOverflow=false`.
- artifacts: evidence/01-initial-load.png, evidence/06-filter-crit.png
