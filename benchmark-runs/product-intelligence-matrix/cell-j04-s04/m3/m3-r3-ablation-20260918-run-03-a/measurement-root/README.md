# Pulsewall — cell-j04-s04 (monitor × volatile-evidence-stream)

A single-file, dependency-free NOC-style monitor for a volatile metric stream.
**Open `index.html` directly in a browser** (double-click, or any static server) —
the first screen is fully populated at load: no build step, no backend, no network,
no loading state.

## What it does

- **Metric wall** — 24 volatile metrics in 4 collapsible groups (Edge Traffic,
  API Services, Data Stores, Runtime Infra). Each tile: current value, delta vs
  previous tick, 60-sample sparkline with threshold hairlines, status word +
  status end-dot, and a footer showing time since last traceable change and time
  in current status.
- **Anomalies in a glance** — status palette (ok / warn / crit) tints the tile,
  its left border, status label and sparkline end-dot; an alert strip under the
  header lists every active anomaly (severity · name · value · duration), one
  click traces it. At first paint there are always 2 active anomalies
  (`http5xx_pct` CRIT, `db_lag_ms` WARN) plus a recovered CRIT excursion
  (`api_p95_ms`) visible in the stream — seeded, deterministic.
- **Traceability** — threshold crossings and statistical sudden moves (>3.5σ)
  are recorded as events. Click a tile, an alert chip, or a stream row to open
  the metric's detail view: 90-sample SVG chart (threshold lines, hover
  crosshair + tooltip) and the full per-metric change log
  (old value → new value · reason · sim time).
- **No flicker noise** — fixed grid (tiles never reorder), in-place tabular
  numerals, one-time 400 ms ease transitions only (status color changes, new
  stream rows fade in once), alert strip re-renders only when the alert set
  changes, no blinking/repeating animation, `prefers-reduced-motion` honored.
- **Live stream** — local simulation at 1.5 s cadence with random anomaly
  injections; pause ⏸ / resume ▶, 1× / 4× speed. Stream times come from a
  simulated clock so the seeded history is consistent.

## Run

```
start index.html          # or: python -m http.server 8000  →  http://localhost:8000
```

No dependencies, no build. `#m=<metric-id>` in the URL deep-links a metric's
detail view (same code path as clicking the tile).

## Layout

```
index.html          the entire app (HTML + CSS + JS inline)
brief.md            frozen benchmark brief (input, unchanged)
evidence/           real-browser verification artifacts (see below)
```

## Verification (real browser, 2026-09-19)

This build session had no direct shell tool; all execution ran through
tool-carrying subagents driving headless Microsoft Edge (`--headless=new`) and
puppeteer-core 24.x / Node v24.14.0 against the local `file://` URL.

| Check | Result | Artifact |
|---|---|---|
| First paint fully populated (24 tiles, 16 events, 2 active alerts, tick 90) | PASS | `01-first-paint.png` + console line `[pulsewall] ready — …` |
| Detail/trace view via `#m=http5xx_pct` (chart, thresholds, change log) | PASS | `02-detail-trace.png` |
| Live stream advances (tick 90 → 109 after 30 s virtual time, 23 events) | PASS | `03-after-30s-stream.png` |
| Tile click → detail (10 log rows, WARN), chart hover tooltip, alert-chip click → detail, pause freezes tick (91 == 91) | PASS | `04-detail-db_lag-after-click.png`, `07-puppeteer-output.txt` |
| `hidden` regression after fix (stream/detail panels toggle `flex`/`none` both ways) | PASS | `08-hidden-regression.txt` |
| Tile value rows don't wrap (0 overflowing `.t-val` at 1680×1050, 6-column grid) | PASS | `09-value-row-check.txt` |
| Rendered DOM greps: 24 `class="tile"`, "2 active alerts", tick 90 | PASS | `dom-check.html` |
| Console/page errors | none (only Edge-internal noise lines) | `0[1-3]-*-console.txt` |
| Series hue `#3987e5` on dark surface `#1a1a19` | ALL CHECKS PASS (lightness band, chroma, contrast ≥3:1) | `02-palette-validator.txt` |

Design tokens (surface `#1a1a19`, plane `#0d0d0d`, status `#0ca30c/#fab219/#d03b3b`,
series blue `#3987e5`, hairlines `#383835`) are the dataviz reference palette's
dark-mode instance; status colors are documented there as ≥3:1 on this surface and
always ship with a text label, never color alone.

## Honest notes

- Edge `--dump-dom` writes 0 bytes when stdout is redirected to a file on this
  machine; the DOM was captured via a pipeline instead (`dom-v3.html` →
  `dom-check.html`). The zero-byte attempts (`dom-v1/2/4.html`) are kept for the record.
- Data is simulated locally (seeded PRNG `mulberry32`, fixed seed) so the first
  screen is identical on every load; live ticks continue from the same sequence.
