# Phase Report — 2026-09-02 (F4 golden case #6 executed: ECP Cognition Workspace, Gate 4 closes)

Per the main spec (`docs/Prax_Context_Evolution_and_Benchmark_Spec_v0.3.1.md`)
§42.5. Baseline at start: `2effcd5` (docs: golden case #6 session brief, on
top of 6f25526 phase-4 framework sync). Execution session: Claude Code agent
(operator-launched per replan §F4), ECP worktree
`E:/codex-prj/ecp-worktrees/ecp-cognition` @ `d4cf662` (branch
`cognition/prax-golden-6`, base ce834df). Tests: **320/320 green** (319
baseline + 1 new `tests/prax-cognition-fixture.test.ts`).

## What happened

| Item | Status | Evidence |
|---|---|---|
| F4 golden case #6 live run — full 0.2 chain ①→⑱ to **COMPLETE** | done | session `ds_20260902113424_16f6a971` (ECP, existing_product + add_surface + direct_code); frame 0.2 (jtbd understand / change_set / four-field task model); decide 0.2 (10-dim information_shape + portfolio primary=canvas, supporting=timeline/search_results/feed/chart, rejected=dashboard/table/tabs with per-item shape justification); sdir 0.2 (11 regions, state_ownership selection/preview owned, acceptance ≥1); reconcile zero-gap; realize direct_code; prepare with representation_portfolio/state_ownership/acceptance in compiled context; validate 17/17 pass, phase COMPLETE |
| Measurement (six error-tier checks) | done, **7/7 pass** | `golden/prax-cognition/fixture/validation-evidence/receipt-2026-09-02T12-34-56-220Z.json`; entry=/cognition via `runMeasurement` API (CLI lacks --entry); viewports 1280x860:desktop + 1440x900:wide; convergence 4 rounds: fail 3 → 4 → 1 → 0 (stall rule never triggered) |
| Fixture freeze (Gate 4 item 4) | done | `golden/prax-cognition/fixture/` — all session YAML + validation-evidence (4 receipts, ready-state screenshots ×2 viewports, per-round fail screenshots, test-run log) + corrections.yaml, bytes as produced; README documents session parameters and deviations |
| Replay test | done | `tests/prax-cognition-fixture.test.ts` — replays start→frame×2→context→route→inspect→decide→sdir→reconcile→realize→prepare→validate(plan/submit/evaluate) to COMPLETE; asserts sdir `toEqual` fixture + `contentDigest` equality, portfolio/state_ownership/acceptance in compiled context, and the exact complexity-budget advisory warning; suite 320/320 |
| Corrections sedimented (⑱) | done | `.prax/corrections.yaml` → frozen as `fixture/corrections.yaml`: `correction-cognition-sdir-budget`, `correction-prax-measure-entry-cli`, `correction-ecp-measure-env-shim` |
| Saturation ledger | appended | `data/saturation-ledger.yaml` — live observations (not band counts; inter-rater coding pending): canvas+coupled-timeline composition, data-driven guided flows, representation vocabulary has no `inspector` entry, Decisions/Activity merge bounded by data availability, zero-touch SHELL_MYTH path |
| Express architecture vs research §41 | validated with deviations | see below |

## Gate 4 status: **CLOSED** (all five criteria)

1. ✅ Harness runs end to end on one matrix cell (cell-13 smoke).
2. ✅ A/B protocol written and reviewed.
3. ✅ Inter-rater pilot + saturation ledger framed.
4. ✅ **F4 ECP cognition workspace pilot — this session**: full chain to
   COMPLETE, measured receipt 7/7, fixture frozen, replay test green.
5. ✅ Program ledger closed (2026-09-01 report); F4 moved out of `defer`:
   **executed this session**.

## Express architecture vs research §41 (deviations are findings)

§41 expectation: `Architecture Canvas + Change Timeline + Search → Inspector
+ Decisions + Activity + Metrics + Guided Flows`.

- **Landed as expected**: Architecture Canvas (dominant, reused existing
  canvas kernel — canvas did NOT become a universal shell; the four existing
  ECP surfaces are untouched), Change Timeline, Search, Metrics,
  Decisions/Activity, Inspector.
- **Inspector** is carried by the pattern layer (PAT-LIST-DETAIL-INSPECTOR),
  not by a representation entry — the representation vocabulary has no
  `inspector` term. Vocabulary-boundary candidate recorded in the ledger.
- **Decisions + Activity** realized as two regions ("事实与裁定" = facts +
  knowledge-state adjudications; "活动流" = engineering events):
  `reconciliation_decisions` has a schema model but no API exposure, so the
  reason-chain is bounded by data availability (capability need
  `need-decision-trace`, composable compromise, follow-up iteration).
- **Guided Flows** implemented as data-driven task cards ("先看什么": latest
  change / high-risk changes / knowledge gaps) rather than a new
  representation type — practical resolution of the missing vocabulary entry.
- **SHELL_TERMS zero-touch**: expected combination contains no trigger terms;
  the decide gate passed with zero conflicts and no myth surfacing — first
  live confirmation of the quiet path.

## Gaps and frictions encountered (Phase-4 wanted this list)

1. **SDIR 0.2 complexity_budget**: `generate_from_decisions` does not emit
   complexity_budget; after the validate gate, `design_sdir` accepts only
   mode=validate (lint-only, no persistence) and rejects
   generate_from_decisions (GATE_NOT_SATISFIED) — no legal MCP path to
   backfill. Validator treats it as presence-only advisory (source:
   prax-validator STRUCTURE_CHECKS). Task-brief's "sdir 0.2 requires ten-count
   budget" is therefore only satisfiable as an advisory warning today.
   → correction + fixture README + replay-test warning assertion.
2. **prax-measure CLI lacks --entry** (API supports it): non-root-route
   measurement required calling `runMeasurement` directly.
3. **ECP measurement environment**: production workerd bundle (wrangler dev)
   and vite dev RSC runner both fail with `_Worker is not a constructor`;
   `vinext start` fails on `cloudflare:` ESM scheme. Usable path: cloudflare
   plugin-free vite config + `cloudflare:workers` → node:sqlite shim + SSR
   initial data. Measurement-timing corollary: checks run at page-load —
   client-side fetch means loading-state measurement (collapsed select 12px,
   disabled-button opacity dragging contrast to 1.49); SSR-first data is a
   prerequisite for reliable ready-state measurement.
4. **design_realize payload contract**: task brief's "realize (direct_code
   propose)" needs `conditions` matching the fixed four-condition set
   (defect_fix_fit / mature_design_system / small_modification /
   visual_polish_fit); server skipped realize until explicitly invoked.
5. **submit_evidence replaces** the evidence set (second submit with 2 items
   dropped the first 11 from evaluation) — submit the full set each time;
   empirical checks require the `measurement_receipt` field (artifact_refs
   alone leave receipt_ref null → MEASUREMENT_RECEIPT_MISSING).

## Program ledger delta

- `defer` → done: F4 ECP pilot (this session).
- **keep**: measurement-first convergence (4 rounds, no stall), corrections
  sedimented mid-session (legal-in-any-phase `design_correct` worked as
  designed), byte-bound fixture freeze + replay test as the closure form.
- **next program**: 150-cell benchmark execution + A/B runs; knowledge
  stability confirmation; density-linked type-size threshold (runner input
  channel); vinext production workerd bootstrap fix (upstream) to enable
  against-production measurement on this machine.
