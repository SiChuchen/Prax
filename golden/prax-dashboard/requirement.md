# Golden Case: Prax Metrics Dashboard (greenfield, direct_code realization)

## Requirement

Build the Prax local operations dashboard as a single dense page for one
operator at a desktop viewport (1280–1680px). Sections: a header strip with
runtime identity (version, uptime, session count); four KPI cards (sessions
today, median gate latency, evidence files, open gaps); a sessions table
(sortable by started-at and status, filterable by status
all/running/complete/failed, row selection opening a detail side panel); a
static SVG bar chart of gate outcomes for the last 14 days (no chart
library); and an event log pane (newest first, virtualized to the last 200
entries). Data comes from a bundled JSON fixture — no backend, but every
async-shaped state must exist and be reachable: loading skeleton on first
paint, empty table state when the filter matches nothing, error banner with
retry when the fixture load is forced to fail (a query-param switch is
acceptable), selected state in the table/panel pair. Visual tokens are
pinned: background #101014, panel #17171C, ink #E8E8EC, muted #9A9AA5,
accent #5B8AF5, 8px radius, Inter + Roboto Mono — deliberately compact
density (no marketing whitespace). Keyboard: tab order covers filter, sort
headers, rows, retry; focus visible; row activation via Enter.

Audience: the operator running Prax benchmarks. Tone: instrument-panel —
numbers, statuses, timestamps; zero marketing copy.

## Why this case fits direct_code (realization §18 analog)

Greenfield; visual language fully pinned (no uncertainty to explore);
instrument-panel surface with established dense-dashboard conventions;
single-operator audience (no stakeholder visual approval loop required);
interaction logic is the hard part, not spatial exploration; runtime
dependency low (bundled fixture) but state behavior is the product.

## Golden observations (expected per gate)

- design_realize propose → **direct_code** accepted before prepare; the
  brief carries approved_component_contracts and NO representation/figma
  fields; compiled context carries no region→frame mapping.
- The validation plan contains **no design_representation_coverage and no
  representation_runtime_drift** checks (representation checks are
  figma_first-only); deterministic checks plus evidence-required empirical
  checks (states, keyboard) present.
- Every declared state (loading/empty/error/selected) is demonstrated live
  with Playwright as evidence artifacts, including the forced-failure path.
- Keyboard walkthrough evidence: filter → sort → row select → detail panel,
  all via keyboard with visible focus.
- Validation reaches COMPLETE with zero warnings and no self-attestation.
- Mid-chain probe (optional): a `design_correct` correction recorded after
  decisions must appear in this run's validation plan as a regression
  obligation.

## Pass/fail

Pass = every observation holds with zero gate bypasses; the dashboard is
functionally asserted (sort, filter, select, retry) in a real browser.
Fail = any fabricated state, silent failure path, or plan/realize mismatch.
