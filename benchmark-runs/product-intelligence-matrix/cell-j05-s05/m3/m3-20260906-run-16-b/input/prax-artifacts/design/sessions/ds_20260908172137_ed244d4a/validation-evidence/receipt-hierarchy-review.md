# Measurement receipt — hierarchy_review

- Measured at: 2026-09-08T18:00Z (local 2026-09-09 01:58 +08:00)
- Measured by: Claude (implementation arm, cell-j05-s05-b)
- Method: layout measurement on headless-Edge captures at 1600×1000.

## Result

Salience ordering follows SDIR importance, not implementation convenience:

- map (dominant): ~1256×900px region, highest information payload (24 nodes, 40 edges, tier bands)
- inspector (primary): fixed 344px right column — subordinate, never covers the map
- trailbar (primary): 38px strip; during follow it carries the accent trail chips
- topbar (supporting): 62px strip, quietest chrome (muted colors)

Focus salience (evidence/02-follow-trail.png): trail edges/nodes rendered in accent #38e1ff at stroke-width 3 — the highest-contrast layer; non-trail content dimmed to opacity .13 but still readable in place, preserving global context. Closure highlight (evidence/03/04) uses amber dashed rings — secondary salience under the accent trail.

## Artifacts

- evidence/01-initial.png
- evidence/02-follow-trail.png
- evidence/03-impact.png
- evidence/04-deps-closure.png
