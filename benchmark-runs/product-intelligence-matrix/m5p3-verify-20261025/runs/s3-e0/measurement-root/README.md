# Gatepass — Release Runbook Runner (cell-j10-s09)

A single-page web app for **completing one high-consequence workflow with zero mistakes**:
a production release runbook (5 phases, 11 steps) where progression is hard-blocked until every
gate passes, every **irreversible** step requires a typed-phrase confirmation, and every
irreversible step carries a **recovery path** (plus an in-app rollback during its undo window).

## Run

No build, no dependencies, no network. Either:

- open `index.html` directly in a browser, or
- serve statically, e.g. `python -m http.server 8377` → http://localhost:8377/

The full runbook is inlined in the page — the first screen is usable at paint (no loading state).

## Demo walkthrough values

| Step | Gate | Value to enter |
|---|---|---|
| 1 Verify release readiness | Release commit (short SHA) | `9f3ce21` |
| 4 Take pre-deploy backup | Snapshot ID | `bk-1025-0930` |
| 6 Run DB migration (irreversible) | Rows in audit_ledger | `1,048,320` · confirm phrase `MIGRATE DB-PROD-1` |
| 7 Promote build 2.4.0 (irreversible) | Canary error rate | `0.02%` · confirm phrase `PROMOTE 2.4.0` · 15:00 undo window |
| 8 Verify production health | Error rate / p95 latency | `0.03%` / `287` (enter a wrong value first to see the contingency) |
| 9 Retire build 2.3.9 (irreversible) | — | confirm phrase `RETIRED 2.3.9` |

Checklist gates: tick every item. Value gates: type the observed value and press **Verify**.
A failed verification opens the step's **contingency** and is recorded as a warning in the audit trail.

## Design contract (Prax session ds_20261025133733_6fd6a634)

- Pattern: PAT-APPLICATION-SHELL — rail (phase/step tree) · gated work region · audit/recovery column
- Representation: wizard (gated linear progression) + tree / form / feed as supporting
- Acceptance: irreversible ⇒ typed confirmation before, recovery path before & after;
  progression blocked until gates pass; mismatches route to contingency; audit records every event

## Keyboard

Tab / Shift+Tab through rail, checkboxes, value inputs, Verify, and action buttons; focus rings visible.
Modal: Esc or **Cancel (safe)** closes; **Confirm & execute** enables only on exact phrase match.
