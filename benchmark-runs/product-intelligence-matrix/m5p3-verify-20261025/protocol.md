# M5.3 Handoff-Clarity Live Verification Protocol — m5p3-verify-20261025

Status: FROZEN 2026-10-25 before any run. Operator authorization on record
(2026-10-25 "继续下一步" — the registered next slice: completion-handoff
clarity + piggybacked m5.2 hints live observation). Standing m5 discipline
applies unchanged (frozen criteria, deviations to operator-events, closed
batches never re-run, $120 batch ceiling, stop-and-ask only on ceiling
breach / destructive / directional change).

## 1. Question

m5.1 (live-verified, m5p1) removed the stall wall; m5p1's residual was both
non-closing sessions ENDING on a `submit_evidence` response whose
`status:"PASS"` (meaning "evidence accepted") was read as the validation
verdict — the agents quit in VALIDATION without calling `mode=evaluate`
(s2's own evidence notes say measurement rounds were exhausted → submit →
stop). m5.3 (commit c5da382) makes the handoff honest: acceptance responses
carry `phase`, an explicit "not an evaluation verdict — evaluate to close"
message, and an `outstanding` items list; the plan view carries the same
framing. m5.2 (fix_hint/fix_paths/sdir fallback warning, commit 39e5995)
shipped earlier and is live-unverified (its findings-stall phenotype did not
recur in m5p1's E1').

This batch asks: **with the full stack (ADR-006 + m5.1 + m5.2 + m5.3) in the
runtime, do real B-arm sessions close more often than the in-batch m5.1-only
control — and do the m5.3/m5.2 handoff surfaces actually appear and get used
in live sessions?**

Registered prediction (context, not a criterion): the submit_evidence-PASS
terminal event disappears in E1''; closing rises accordingly; hints fire
only if a findings-stall occurs (0 in m5p1's E1').

## 2. Arms and slots (6 runs)

All slots share the m5p1 conditions (byte-identical briefs/prompts, 90-min
wall / 1.2M token single-round budget, `--model sonnet` flash routing,
`MCP_TIMEOUT=180000`, operator measurement via the m5p3 snapshot's
prax-measure — byte-identical across snapshots, same screenshot procedure).

| Slot | Cell | Arm | Runtime | n |
|---|---|---|---|---|
| s1 | cell-j13-s10 | E0'' | m5p1 frozen `183410df…` (ADR-006+m5.1) | 1 |
| s2 | cell-j13-s10 | E1'' | m5p3 frozen `76bfda91…` (…+m5.2+m5.3) | 1 |
| s3 | cell-j10-s09 | E0'' | m5p1 frozen `183410df…` | 1 |
| s4 | cell-j10-s09 | E1'' | m5p3 frozen `76bfda91…` | 1 |
| s5 | cell-j13-s10 | E1'' | m5p3 frozen `76bfda91…` | 1 |
| s6 | cell-j10-s09 | E1'' | m5p3 frozen `76bfda91…` | 1 |

E1''−E0'' = m5.2 + m5.3 exactly (manifest-verified: service.ts+contracts.ts
+ 2 test files + derived dist artifacts; nothing else). E0'' reuses the
existing m5p1 snapshot dir byte-identically.

## 3. Pre-registered readout (mechanically decidable)

Per run (frozen tooling):
- **G1**: latest `.prax` session `phase == COMPLETE`.
- **G3+ handoff observables (m5.3)**: last `design_validate` input mode;
  `submit_terminal` = last validate result is PASS AND last input mode is
  submit_evidence (the m5p1 residual terminal shape); count of
  "not an evaluation verdict" occurrences in the transcript.
- **G3+ hint observables (m5.2)**: counts of `fix_hint` / `fix_paths`
  occurrences; `design_sdir` calls following a hint occurrence (any
  sdir-mode call after the first hint line index).
- **G2**: operator final receipt checks (contrast c, type t, focus, target).
  **skipped ≠ pass.** Loop engagement (fixReq/unavailable/selfRx/validate
  calls) recorded as before.

Decision matrix (first match wins; C1 = C(E1'') of 4, C0 = C(E0'') of 2,
S1 = # E1'' sessions with `submit_terminal`):

| # | Observation | Reading (max action level) |
|---|---|---|
| 1 | C1 ≥ 3 ∧ C0 ≤ 1 | stack VERIFIED live: Gate F positive in-batch at this n for ADR-006+m5.1+m5.2+m5.3 (external claims still multi-cell); handoff/hints observations classify the mechanism |
| 2 | C1 = 2 ∧ C0 ≤ 1 | PARTIAL: classify the two residuals by terminal shape; if S1 = 0 the m5p1 residual is gone and a NEW terminal shape owns the gap → next-slice candidate from that shape |
| 3 | C1 ≤ 1 ∧ C0 ≤ 1 | NEGATIVE-at-n despite the handoff fix → transcript investigation; consider agent-side variance dominance |
| 4 | C0 = 2 | CONTROL-DRIFT: both controls close — batch/cell ease; undifferentiated at this n; escalate n before claims |
| 5 | any run's final measurement invalid after exactly one retry | analyzed at measurement-invalid; data; not re-run |
| 6 | residual | manual paired transcript reading; hypothesis only |

Historical anchors (context only): m5p1 E1' = 2/4 [s2 submit_terminal, s6
submit_terminal, s4/s5 closed]; m5p1 E0' = 0/2 (both zero_stall); m5 E1 =
1/4; R1+R2 6/20.

## 4. Freeze record

- m5p3 snapshot manifest sha256: `76bfda91e74b4e19db9bf1ee7b3ecd9ee9f71567b77af4d574b2d067785c094f` (1000 files, built+tested in place)
- m5p1 snapshot manifest sha256 (E0'', re-verified): `183410dfa676b40b8ba2577f1aea0b4954542568f7f88445fc3138fdc3a016d1`
- Cross-snapshot diff: m5.2+m5.3 files only (service.ts, validator contracts.ts, 2 tests, derived dist); stdio entry unchanged; prax-measure/prax-knowledge unchanged
- Snapshot tests: 398/406 in-place (same 8 fixture-ENOENT exclusions as m5 D-0); stdio handshake OK
- Briefs: j13-s10 `f1a0496c…`(full value in m5 protocol §4); j10-s09 `e72fc9e1…`
- Prompts: j13-s10-b `f9e89254…`; j10-s09-b `7ce966a6…` (full values in m5 protocol §4)
- Tool hashes: freeze-record.json at first loop invocation; drift = hard error
- Workspaces: `E:/codex-prj/ab-worktrees/pi-matrix-m5p3/<slot>-<arm>`

## 5. Execution rules and discipline

Identical to m5p1 protocol §5 (idempotent launch retry; invalid-measurement
single retry; $120 ceiling before each slot with the D-1-class unobservable
allowance carried by the operator when a wall kill occurs; deviations to
operator-events; no blind review; this batch may justify stack retention
and the next-slice choice; it may NOT justify multi-cell external claims or
removal decisions).
