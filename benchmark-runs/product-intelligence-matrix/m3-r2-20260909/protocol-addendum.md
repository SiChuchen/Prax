# M3 Round-2 Protocol Addendum — versioned for batch m3-r2-20260909

Status: FROZEN 2026-09-09 (daytime preparation; no r2 arm session may start
before 23:00 local). Round 2 reuses the round-1 protocol wholesale:
`../m3-20260906/protocol-addendum.md` D1–D10 and its changelog (D5 v2 token
metric, D8 v2 measurement-root staging) apply unchanged, EXCEPT for the deltas
below. The round-1 addendum's own versioned-change rule applies here too.

## R1 — Purpose and population (operator-approved 2026-09-09)

Second independent pass for n=2: the same 10 cells × 2 arms, one planned run
per cell/arm (20 runs), under the IDENTICAL frozen runtime
(`E:/codex-prj/pi-m3-frozen-runtime-20260906`, manifest sha256 23e770b3…,
re-verified before every night), identical frozen arm prompts (byte-identical
launch files, hash-verified by `tools/setup-r2.mjs`), identical briefs
(hash-verified), identical budgets (90 min wall / 1.2M in+out tokens), and the
identical client stack (claude 2.1.251, `--model sonnet` = glm-5.3-flash[1M],
`--strict-mcp-config` isolation, non-interactive `-p`).

## R2 — Fresh sibling workspaces

Round-1 workspaces contain agent output and are never reused. All r2 slots run
in `E:/codex-prj/ab-worktrees/pi-matrix-r2/<cell>-<arm>` (fresh `git init`,
unborn HEAD, exact-bytes `brief.md`, Arm B repaired `.mcp.json` bound to the
same frozen runtime with a workspace-unique `PRAX_STATE_ROOT`). No startup
READMEs exist in r2 workspaces (round-1 D2 practice is now the default: prompts
are issued only from operator launch files).

## R3 — Execution window (operator rule)

Arm sessions run only between 23:00 and 08:00 local. The nightly driver
(`tools/r2-loop.mjs`, fired by the 23:05 automation) starts no new arm session
after 06:30 local (the 90-minute budget then ends by 08:00), starts no new
review session after 07:40, and exits at window end to resume the next night.
The driver is idempotent: completed slots, reviews, and analyses are skipped.

## R4 — Run order

`run-order.yaml` (this directory) is a fresh mulberry32+fisher-yates
randomization with a new seed, written before any r2 run existed. Each cell
appears exactly once per arm. Sequential execution, one session at a time.

## R5 — Pooled analysis rule (pre-registered before any r2 outcome)

After r2 blind review and score lock, the combined analysis pools rounds:
per cell/arm, the arm score is the mean over its VALID runs (r1 + r2), and
measurement validity is judged per run exactly as in round 1. No best-of
selection ever occurs; all runs from both rounds appear in the ledger.
Round-2 outputs (comparison/findings/agreement) are produced for r2 alone
first, then a pooled n=2 comparison is written as a separate file so each
round remains inspectable on its own. Evidence level: two heterogeneous runs
per cell/arm — still a pilot, still no significance claims.

## R6 — Inherited defaults

Recording, failure handling (failures are data; infrastructure retries only
with logged faults), honest missingness (`not_observable`), leakage handling
(record, never edit), and the "no coaching, no backfill, no promotion"
disciplines are inherited unchanged from the round-1 addendum.
