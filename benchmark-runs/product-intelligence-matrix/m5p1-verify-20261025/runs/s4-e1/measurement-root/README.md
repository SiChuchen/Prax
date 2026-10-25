# Ledger v2 Cutover — Runbook Walker (cell-j10-s09)

A single-page web app for **completing one high-consequence workflow with zero
errors**: a production cutover runbook. Strict-order execution makes missteps
structurally impossible; every **irreversible** step is behind a typed
confirmation gate that previews its **rollback plan** first, and executed
irreversible steps keep an inline recovery path until a dependent step runs.

## Run

Static — no build, no backend, no external services:

- Open `index.html` directly in a browser (double-click works), **or**
- serve the folder: `python -m http.server 8000` → http://localhost:8000

## What ships in the first paint

All runbook data is inlined in `data.js`; `app.js` renders synchronously at
parse time. There is no loading state — the full ladder (4 phases, 10 steps)
is usable the instant the page opens.

## The flow

1. **Preflight** — reversible checklist steps (some with tick-to-confirm
   checkpoints).
2. **Cutover** — deploy (reversible), then two points of no return:
   *Cut over write traffic* (`LEDGER V2`) and *Revoke v1 credentials*
   (`REVOKE V1`).
3. **Verification** — health checks, then *Decommission v1 fleet*
   (`RETIRE V1`).
4. **Closeout** — close the window, publish the record.

## Safety model (acceptance seed: irreversible steps have recovery/confirmation paths)

- Steps unlock strictly in order; locked steps cannot execute.
- Irreversible steps carry a persistent **Irreversible** badge.
- Executing one opens a **confirm gate**: explicit consequence statement, the
  paired **rollback plan previewed before** you can confirm, two acknowledgement
  checkboxes, and a **typed phrase** that must match.
- After execution, the step keeps an inline **Roll back** button (two-click
  confirm) — usable until a dependent step has executed, at which point the
  window closes and the UI says so honestly.
- Every action appends to the **activity log** (append-only during a run);
  completion shows a zero-misstep summary with gate/rollback/audit counts.

State is session-local by design (no persistence service in scope); reset
re-arms a fresh rehearsal.

## Files

| File | Purpose |
|---|---|
| `index.html` | Screen shell + regions (header, ladder, gate, log, completion) |
| `styles.css` | Design tokens + layout (spacious, WCAG-AA contrast, focus-visible) |
| `data.js` | Inlined runbook (phases, steps, checkpoints, consequences, rollback plans) |
| `app.js` | State machine: gating, confirm gate, rollback, audit log, render |
