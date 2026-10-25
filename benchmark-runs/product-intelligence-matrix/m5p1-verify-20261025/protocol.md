# M5.1 Live Verification Protocol — m5p1-verify-20261025

Status: FROZEN 2026-10-25 before any run. Operator authorization on record
(2026-10-25: "按顺序做，都做" — this is item ①, followed by the s5/s6
discoverability slice ②). Standing discipline from m5 applies unchanged
(frozen criteria, deviations to operator-events, closed batches never re-run,
$120 batch ceiling, stop-and-ask only on ceiling breach / destructive /
directional change).

## 1. Question

The m5.1 amendment (commit 59e870d, ADR-006 amendment: zero-open-finding
non-PASS rounds leave the B3 convergence history; stalls persist through
them; ≥1-finding stalls unchanged) is unit-tested (400/400) but has never run
in a live B-arm session. m5's E1 arm (ADR-006 without m5.1) closed 1/4; its
non-completions split into a **zero-stall phenotype** (s4: history
[0,0,0,0] — receipt plumbing tripping the detector, exactly what m5.1
removes) and a **findings-stall phenotype** (s5/s6: flat SDIR-contract
findings — the detector by design, addressed by slice ②, NOT this batch).

This batch asks: **with m5.1 in the runtime, do real B-arm sessions close
(phase COMPLETE) more often than the in-batch ADR-006-without-m5.1 control,
and does the zero-stall phenotype disappear live?**

Registered prediction (context, not a criterion): s4-type sessions close;
findings-type persists until ②; improvement concentrates on cell j10.

## 2. Arms and slots (6 runs)

All slots share: byte-identical per-cell briefs and B-arm prompts (same
frozen bytes as m5, hashes in §4), 90-min wall / 1.2M token single-round
budget, `--model sonnet` flash routing, `MCP_TIMEOUT=180000` both arms, same
operator measurement stack (m5p1 snapshot's prax-measure — byte-identical
across all three snapshots), same screenshot procedure.

| Slot | Cell | Arm | Runtime | n |
|---|---|---|---|---|
| s1 | cell-j13-s10 | E0' | m5 frozen `fbf222e1…` (ADR-006, NO m5.1) | 1 |
| s2 | cell-j13-s10 | E1' | m5p1 frozen `183410df…` (ADR-006 + m5.1) | 1 |
| s3 | cell-j10-s09 | E0' | m5 frozen `fbf222e1…` | 1 |
| s4 | cell-j10-s09 | E1' | m5p1 frozen `183410df…` | 1 |
| s5 | cell-j13-s10 | E1' | m5p1 frozen `183410df…` | 1 |
| s6 | cell-j10-s09 | E1' | m5p1 frozen `183410df…` | 1 |

E0' reuses the EXISTING m5 snapshot dir (byte-identical, manifest re-verified
at freeze) — it IS m5's E1 configuration. E1'−E0' isolates m5.1 exactly:
manifest cross-diff = 7 files (service.ts + its dist artifacts + the ADR doc
+ the convergence test), nothing else; prax-measure/*, prax-knowledge/*,
stdio.js entry all unchanged vs m5 snapshot.

## 3. Pre-registered readout (mechanically decidable)

Per run (frozen tooling):
- **G1**: latest `.prax` session `phase == COMPLETE` (missing `.prax` ⇒
  `no_prax`, counted not-COMPLETE, flagged).
- **G1b stall phenotype** (m5.1-specific): from the packaged session's
  `validation_loop.history` + transcript — `zero_entries` = # entries with
  open_findings == 0; `stall_events` = transcript count of
  `VALIDATION_CONVERGENCE_STALLED`. Classifier for stalled sessions:
  any history entry == 0 ⇒ `zero_stall` (m5.1's target); all entries > 0 ⇒
  `findings_stall` (slice ② scope).
- **G2**: operator final receipt — contrast `c`, type `t`, focus (regression
  monitor), target (observational). **skipped ≠ pass.**
- **G3**: loop engagement (measurement_loop.attempts, FIX_REQUIRED /
  UNAVAILABLE transcript counts, self-run receipts), validate call count,
  wall/tokens/cost, model string, playwright version.

Decision matrix (first match wins; C1 = C(E1') of 4, C0 = C(E0') of 2,
Z1 = # E1' sessions with zero_entries ≥ 1):

| # | Observation | Reading (max action level) |
|---|---|---|
| 0 | Z1 ≥ 1 | live escape of the m5.1 code path (build/config bug) → readout claims VOID; hard investigation; re-run of THIS batch permitted only as a new pre-registered batch |
| 1 | C1 ≥ 3 ∧ C0 ≤ 1 | m5.1 live-VERIFIED: closing recovered on ADR-006+m5.1 at this n; Gate F endpoint positive in-batch (external claims still need multi-cell n) → slice ② proceeds on a fixed base |
| 2 | C1 = 2 ∧ C0 ≤ 1 | PARTIAL: zero-phenotype eliminated but residual non-completions persist (classify each by G1b) → ② (discoverability) confirmed as the next bottleneck slice; no Gate F claim |
| 3 | C1 ≤ 1 ∧ C0 ≤ 1 | NEGATIVE-at-n: control replicates m5's shape but m5.1 didn't move live closing → transcript investigation; reframe candidate: m5 non-completions were findings-type dominated |
| 4 | C0 = 2 | CONTROL-DRIFT: both controls close — batch/cell ease; undifferentiated at this n; escalate n before claims |
| 5 | any run's final measurement invalid after exactly one retry | that run analyzed at measurement-invalid; data; not re-run |
| 6 | residual | manual paired transcript reading; hypothesis only |

Historical anchors (context only): m5 E1 (fbf222e1) = 1/4 [s2 C; s4
zero_stall; s5 findings_stall; s6 findings_stall]; m5 E0 (r3) = 0/2; R1+R2
6/20; per-cell m5: j13-E1 1/2, j10-E1 0/2.

## 4. Freeze record

- m5p1 snapshot manifest sha256: `183410dfa676b40b8ba2577f1aea0b4954542568f7f88445fc3138fdc3a016d1` (998 files, built+tested in place)
- m5 snapshot manifest sha256 (E0', re-verified): `fbf222e1495eba32e96c849d65bfec8ed2cd225005d2a13df41b37862f8045b1`
- Cross-snapshot diff: 7 files (docs/adr-006…, service.ts, dist/service.js + .map/.d.ts.map/.tsbuildinfo, tests/validation-convergence.test.ts); 0 elsewhere
- Snapshot tests: 392/400 in-place (same 8 fixture-ENOENT exclusions as m5's D-0); convergence 5/5; measure-loop 5/5; stdio handshake OK
- Briefs: j13-s10 `f1a0496c…` (full: f1a0496c95ba5aba3a25050e36315d525f93817b40a93a0339d2acc827f43c7b); j10-s09 `e72fc9e17e5a879a8381c4f3fb9ab145a22ea9ddbde85709ca5ef950e9f8021c`
- Prompts: j13-s10-b `f9e89254497c27324ecc091f80e3a335802e746882043c3f4e3d3a9cd5bc66bc`; j10-s09-b `7ce966a665c968c0d4e14c419d13c825ec5d96ac0f98cfed6722c0319951b47a`
- Tool hashes: freeze-record.json at first loop invocation; drift = hard error
- Workspaces: `E:/codex-prj/ab-worktrees/pi-matrix-m5p1/<slot>-<arm>` (arm ∈ {e0,e1})

## 5. Execution rules and discipline

Identical to m5 protocol §5 (idempotent launch retry vs agent-turn-failure
data; invalid-measurement single retry; $120 ceiling checked before each slot
with the same D-1-class $15 unobservable-cost allowance carried by the
operator; deviations to operator-events; no blind review in this batch; this
batch may justify slice-② prioritization and ADR-006-amendment retention; it
may NOT justify removing ADR-006/m5.1, retiring H-23, or multi-cell external
claims).
