# PULSEWALL — volatile metric monitor (cell-j04-s04)

Benchmark cell `cell-j04-s04` · user job **monitor × volatile-evidence-stream** —
success = anomalies found within a glance, metric changes traceable, no flicker noise.

## Run

Open `index.html` directly in a browser (file:// works — zero network, zero deps),
or serve statically:

```
python -m http.server 8000   # → http://localhost:8000
```

## What you get at first paint

- **29 metrics** in 4 groups, each with live value, 1-min delta and 90 s sparkline.
  4 minutes of history are backfilled synchronously before first render — no loading
  state ever exists. At load there is already 1 critical + 4 warn active incidents and
  a history of recovered ones in the feed.
- **Fleet strip** under the header: one colored segment per metric → whole-fleet
  health in a single sweep.
- **Evidence stream** (right): anomaly lifecycle — breach / escalate / recover /
  volatility spike / flatline — each with rule, peak + timestamp, live duration.
- **Change trace** (right, bottom): selected metric's 3-min chart with threshold
  bands and event markers (▲ breach, ● recovered, ◆ spike) + timestamped event log
  with `prev → cur` values. Open by default on the active critical metric.

## Anti-flicker design (acceptance: 无闪烁噪声)

- Stable tile slots (never re-sorted), grid position of a metric never changes.
- State transitions debounced 2 ticks; states only change on sustained evidence.
- Targeted DOM text updates + eased sparkline bounds; CSS color transitions only.
- Burst spikes coalesce in the feed (≤1 row / 8 s / metric).

## Traceability (acceptance: 指标变化可追溯)

Every metric keeps a 40-entry event log (timestamp, badge, `prev → cur`, rule that
fired) plus annotated markers on the trace chart; every tile / strip segment /
feed row clicks through to it. `Locate tile` scrolls back to the source tile.

## Controls

Click tile / segment / anomaly → trace · `Locate tile` → pulse source ·
`/` filter · Esc clears · All / Warn+ / Crit severity filter · Pause freezes the
stream for inspection. Deep-link: `index.html#m=<metricId>&f=<all|warn|crit>`
(e.g. `#m=edge-gw1-loss&f=warn`).

## Simulated stream

Deterministic seeded generator (no randomness across reloads): sinusoidal drift +
smooth value noise + scripted incidents (ramp breach, spike burst, flatline) run
through a real detector (threshold classify + flatline range + z-score spike), so
the monitor logic is the product, not the data.
