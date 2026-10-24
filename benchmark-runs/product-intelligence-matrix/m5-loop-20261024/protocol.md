# M5 Loop Validation Protocol — m5-loop-20261024

Status: FROZEN 2026-10-24 before any run. Operator authorization on record
(2026-10-24): autonomous execution of the full chain — freeze, infra, runs,
readout, ledger, commit — with self-imposed discipline (§5); stop-and-ask only
on cost-ceiling breach, destructive need, or directional change.

## 1. Question (from ADR-006's open verification debt)

ADR-006 (commit 2ccb60e) shipped the m4-promoted measure→fix loop inside
`design_validate`: when a prepared `measurement_target` exists and the
submitted evidence cites no receipt, Prax runs the 7 browser checks itself,
feeds back per-check `{check_id, status, measured}` failures
(`MEASUREMENT_FIX_REQUIRED`, max 3 rounds), and weaves an all-green receipt
into the evidence so the session can close in one flow. m4 established the
loop's active ingredient (P3>P3p) in an operator-resumed probe; it has **never
run in a real B-arm agent session**. This batch asks: **does the ADR-006
runtime close Gate F (validate closing) and improve measured a11y in real
B-arm sessions, against an in-batch pre-ADR-006 control?**

- **G1 (primary endpoint)**: runtime session phase `COMPLETE` (R1+R2 B-arm
  baseline: 6/20 = 30%; attribution.md §1/§3 — 14/20 stopped at `VALIDATION`,
  several with all items passing).
- **G2 (secondary endpoint)**: a11y objective checks from the operator-run
  final measurement (contrast, type; target observational; focus regression
  monitor). `skipped ≠ pass` everywhere.

### H-23 decision (pre-registered, evidence-based)

**H-23 is NOT rewritten in this batch; rewrite-and-reprobe stays deferred.**
Basis: (a) the m4 ledger entry (m5-entry.md §7) made the rewrite
evidence-backed **conditional on a multi-cell or higher-n re-probe design**
given cell variance — m5's 6-run budget is fully consumed by the primary loop
endpoint and cannot host a valid knowledge re-probe; (b) attribution
cleanliness: E1−E0 must remain exactly "ADR-006" (verified at freeze, §4), and
rewriting H-23 inside the E1 snapshot would add an untested second variable.
H-23 remains draft **as-authored**, byte-identical across both snapshots
(manifest-verified). Retirement remains forbidden (action cap).

## 2. Arms and slots (6 runs)

All slots share: byte-identical per-cell briefs and B-arm prompts frozen since
R1 (hashes in §5), 90-min wall / 1.2M token in+out single-round budget,
`--model sonnet` flash routing, `MCP_TIMEOUT=180000` in the CLI environment
(ADR-006's documented deployment requirement; inert for E0; applied to BOTH
arms identically), same operator measurement stack (m5 snapshot's
prax-measure, byte-identical to r3's), same screenshot procedure
(1280x860 + 1440x900).

| Slot | Cell | Arm | Runtime | n |
|---|---|---|---|---|
| s1 | cell-j13-s10 | E0 | r3 frozen `681653b4…` (pre-ADR-006) | 1 |
| s2 | cell-j13-s10 | E1 | m5 frozen `fbf222e1…` (ADR-006) | 1 |
| s3 | cell-j10-s09 | E0 | r3 frozen `681653b4…` | 1 |
| s4 | cell-j10-s09 | E1 | m5 frozen `fbf222e1…` | 1 |
| s5 | cell-j13-s10 | E1 | m5 frozen `fbf222e1…` | 1 |
| s6 | cell-j10-s09 | E1 | m5 frozen `fbf222e1…` | 1 |

Cell rationale (pre-registered): **j13-s10** — maximum anchor continuity
(r3 B VALIDATION; m4 P1 ×2 both COMPLETE; R1 V / R2 C); **j10-s09** — max
Gate-F friction phenotype in the baseline (R1 V, R2 V with **all 22 items
passing yet stopped**; r3 B COMPLETE). Slot order interleaves arms so a
truncated batch still contains both arms on both cells.

Only deltas between runtimes (verified at freeze by manifest diff): prax-mcp
service.ts/service.js/server.ts/package.json/tsconfig (ADR-006, git
`bed8700..2ccb60e` = 4 files +136/−6 on packages/) plus the ADR doc and its
test file. **prax-measure/* and prax-knowledge/* are byte-identical across
snapshots (0 manifest diffs); `dist/stdio.js` identical; H-23 unchanged.**

## 3. Pre-registered readout (mechanically decidable)

Per run, from frozen tooling (tools/m5-run.mjs, m5-loop.mjs):

- **G1** `C`: latest `.prax` design session `phase == COMPLETE`
  (b-session-audit logic: latest session dir by mtime; missing `.prax` ⇒
  `no_prax`, counted not-COMPLETE and flagged).
- **G2** `c` = a11y.contrast pass; `t` = type.min_projected_size pass;
  `focus` = a11y.focus_order pass (regression monitor); `target` = a11y
  .target_size pass (observational). Authority = operator-run final receipt
  (staged copy, D8v2 Case R). **skipped ≠ pass.**
- **G3 loop engagement (descriptive, no verdict)**:
  `measurement_loop.attempts` in the final validation report; transcript
  counts of `MEASUREMENT_FIX_REQUIRED` and `MEASUREMENT_UNAVAILABLE`;
  self-run-receipt presence (agent-run CLI, backward-compat path);
  wall clock, tokens, cost, model string, playwright version.

Decision matrix (first match wins; C(X) = COMPLETE count, c(X) = contrast
pass count):

| # | Observation | Reading (max action level) |
|---|---|---|
| 1a | C(E1)≥3 ∧ C(E0)≤1 ∧ c(E1)>c(E0) | loop improves closing AND measured a11y in-batch → ADR-006 stands as default; external claims still need multi-cell n |
| 1b | C(E1)≥3 ∧ C(E0)≤1 ∧ c(E1)≤c(E0) | closing-only effect → keep loop; investigate why feedback didn't convert to a11y passes (transcripts) |
| 2 | C(E1)≥3 ∧ C(E0)=2 | control closes too — batch/cell-ease suspicion; loop undifferentiated at this n; escalate n, no ship claim |
| 3 | C(E1)≤1 | loop fails to close in-batch. Sub-readout: if ≥2 non-completing E1 runs show `MEASUREMENT_UNAVAILABLE` → "loop blocked by measurement infra on live workspaces" (product bug path); else agents ignored/never hit the loop → implementation/UX iteration. Max action: iterate implementation. NOT removal (that needs multi-cell evidence, same bar as H-23) |
| 4 | C(E1)=2 | INCONCLUSIVE at n=4 — engagement observables (G3) decide the next batch's design; no ship/kill decision |
| 5 | any run's final measurement invalid after exactly one retry | that run analyzed at measurement-invalid; recorded as data; not re-run |
| 6 | residual pattern | manual paired transcript reading; hypothesis only |

Regression monitor: focus(E1) < focus(E0) ⇒ flag in report (loop must not
break passing behavior). Cost report: E1 vs E0 wall/token/cost deltas are
reported, never scored.

Historical anchors (context only, no verdict derives from them):
R1+R2 pooled B-arm 6/20 COMPLETE; j13-s10 {R1 V, R2 C, r3 V, m4×2 C} = 3/5;
j10-s09 {R1 V, R2 V, r3 C} = 1/3; r3 B-arm 3/10.

## 4. Freeze record

- m5 snapshot manifest sha256: `fbf222e1495eba32e96c849d65bfec8ed2cd225005d2a13df41b37862f8045b1` (998 files, built+tested in place)
- r3 snapshot manifest sha256: `681653b4643c2850601a75dc09d90a92d2a5f11f1ee16eafe3811d95bf548fdb` (re-verified at freeze)
- MCP entry `packages/prax-mcp/dist/stdio.js` sha256 (BOTH runtimes): `1ca1783c34c1e1e0a625c6de4fd771dbd2effed7a8ed9ebace2f42d1aeaf8bb5`
- Snapshot build verification: `tsc -b` OK; vitest in-snapshot 390/398 — 8 failures are ENOENT fixture reads from `benchmark-runs/PRAX-MEM-001/` + brief-regeneration fixtures deliberately excluded from the copy (same exclusion class as the r3 freeze); `tests/validate-measure-loop.test.ts` 5/5; stdio initialize handshake OK on both runtimes. Recorded as freeze deviation D-0.
- Cross-snapshot equivalence: prax-measure/* and prax-knowledge/* 0 content diffs; knowledge.yaml identical (H-23 as-authored).
- Briefs: j13-s10 `f1a0496c95ba5aba3a25050e36315d525f93817b40a93a0339d2acc827f43c7b`; j10-s09 `e72fc9e17e5a879a8381c4f3fb9ab145a22ea9ddbde85709ca5ef950e9f8021c` (both == R1 prepare-launch-report).
- Prompts (r3 launch == R1 launch, byte-identical): j13-s10-b `f9e89254497c27324ecc091f80e3a335802e746882043c3f4e3d3a9cd5bc66bc`; j10-s09-b `7ce966a665c968c0d4e14c419d13c825ec5d96ac0f98cfed6722c0319951b47a`.
- Tool hashes: recorded in freeze-record.json at first loop invocation; drift after that = hard error.
- Workspaces: `E:/codex-prj/ab-worktrees/pi-matrix-m5/<slot>-<arm>` (arm ∈ {e0,e1}).

## 5. Execution rules and discipline

- Launch failure with no agent turn → idempotent retry (r3 run-01 rule);
  agent-turn failures are data (D7 lineage).
- Final measurement `invalid_target` → exactly one retry, then archived with cause (row 5).
- Cost ceiling **$120** across the batch (operator cap); checked before each
  slot; breach → stop, report partial, operator-events entry.
- This batch may justify: keeping/adjusting ADR-006 defaults, product bug
  fixes, H-23 rewrite in a FUTURE multi-cell batch. It may NOT justify:
  retiring H-23, removing ADR-006 on rows 2/3/4 alone, adopting probe mode as
  standard, or generalizing to other knowledge entries.
- Criteria frozen here are immutable after the freeze commit; every deviation
  goes to operator-events.ndjson; closed batches are never re-run; no blind
  review in this batch (mechanical readout only) — any qualitative add-on
  requires blinding before it runs.
