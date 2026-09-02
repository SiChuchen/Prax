# M3 Runbook — dual-arm execution, pilot batch 10 cells (operator manual)

Who runs this: the human operator, in **fresh agent CLI sessions** (one
session per arm per cell; never continue a used conversation). This is the
product-intelligence adaptation of `benchmark-runs/PRAX-AB-001` →
`benchmarks/architecture-canvas-ab/runbook.md` §2/§5 — read that runbook
first; only the deltas are below.

## Deltas vs PRAX-AB-001

| AB-001 | This program (pi-matrix M3) |
|---|---|
| target repo: existing ECP app | from-scratch product per cell (empty git repo worktree) |
| worktree cut from base commit | worktree = `ab-worktrees/pi-matrix/<cell>-<arm>` pre-created by M3-prep (git init + brief + README; Arm B has .mcp.json) |
| requirement.md | `benchmark-runs/product-intelligence-matrix/<cell>/brief.md` (M2-frozen, copy already in worktree) |
| mode existing_product + change_kind | design_start **mode greenfield** (no change_kind) |
| worktree base commit pin | worktree HEAD before run (empty repo, commit 0) — record in summary |

Unchanged: fresh-session discipline, contamination checks (Arm A: no .prax
anywhere; Arm B: only the pre-created .mcp.json), event logging
(`execution/events.ndjson`), first_pass marking, wall-clock budget
(90 min, stop and record `budget_exceeded`), parity rule for material
questions, packaging (git diff → implementation/, screenshots → evidence/,
transcript → execution/, summary.yaml), review handoff (Gate A–H §5).

## Run matrix (order to randomize before starting)

Pilot cells (M2-frozen selection, `benchmarks/product-intelligence-matrix/pilot-batch.yaml`):

| cell | job | shape | arm-a worktree | arm-b worktree |
|---|---|---|---|---|
| cell-j01-s01 | manage | entity-hierarchy | `ab-worktrees/pi-matrix/cell-j01-s01-a` | `ab-worktrees/pi-matrix/cell-j01-s01-b` |
| cell-j02-s02 | locate | open-collection | `…/cell-j02-s02-a` | `…/cell-j02-s02-b` |
| cell-j09-s03 | decide | comparison-panel | `…/cell-j09-s03-a` | `…/cell-j09-s03-b` |
| cell-j04-s04 | monitor | volatile-evidence-stream | `…/cell-j04-s04-a` | `…/cell-j04-s04-b` |
| cell-j05-s05 | understand | relational-web | `…/cell-j05-s05-a` | `…/cell-j05-s05-b` |
| cell-j06-s06 | understand | temporal-sequence | `…/cell-j06-s06-a` | `…/cell-j06-s06-b` |
| cell-j07-s07 | create | spatial-workspace | `…/cell-j07-s07-a` | `…/cell-j07-s07-b` |
| cell-j08-s08 | edit | single-document | `…/cell-j08-s08-a` | `…/cell-j08-s08-b` |
| cell-j10-s09 | complete | consequential-flow | `…/cell-j10-s09-a` | `…/cell-j10-s09-b` |
| cell-j13-s10 | explore | dimensional-space | `…/cell-j13-s10-a` | `…/cell-j13-s10-b` |

20 runs minimum (≥1 per cell per arm); do more within budget if useful.
Randomize the run order across cells×arms before starting and write the
mapping down (AB-001 runbook §1).

## Per-run procedure

1. `cd ab-worktrees/pi-matrix/<cell>-<arm>` — verify: `brief.md` present;
   Arm A: `ls -a` shows no `.prax`, no prax strings; Arm B: `.mcp.json`
   present (prax server, `PRAX_STATE_ROOT` = `<worktree>/.prax`).
2. Start a **new** agent conversation with cwd = worktree; paste exactly
   the arm prompt from the worktree `README.md` (same text both arms; Arm B
   gets one extra Prax paragraph).
3. Operator duties during the run: log events, mark first_pass, record
   wall-clock (AB-001 §2.6).
4. End of run packaging → `benchmark-runs/product-intelligence-matrix/
   <cell>/m3/<run-id>-<arm>/` with `implementation/` (git diff,
   changed-files), `evidence/` (screenshots), `execution/` (transcript or
   transcript-status.md), Arm B `input/prax-artifacts/` (.prax session
   copy), `summary.yaml` (AB-001 format + `cell:` field).
5. **Receipt (mandatory, skipped ≠ passed)**: after the agent finishes,
   build the app if needed and run from the worktree:
   `node <prax-repo>/benchmarks/product-intelligence-matrix/run-cell.mjs
   <cell> --app . --viewports 1280x860,1440x900` — receipts land under
   `benchmark-runs/product-intelligence-matrix/<cell>/validation-evidence/`;
   a run without a schema-valid receipt does not count.

## Arm B MCP registration

The worktree ships a project `.mcp.json` (stdio → globally installed
`prax-mcp`, `PRAX_STATE_ROOT` pinned to the worktree's `.prax`). Verify
with `prax doctor` in the session before the first Arm B run. If the agent
CLI needs explicit registration: `claude mcp add prax -- prax-mcp` plus the
env pin (see the worktree's `.mcp.json`).

## Stop conditions / discipline

- wall-clock 90 min or token 1.2M exceeded → stop, record `budget_exceeded`
- agent declares done → package + receipt
- **Prax code freeze during arm runs** (program entry discipline): no
  changes to the six packages or prax-measure until all runs finish
- Warm-up precedent lessons for Arm B sessions (2026-09-03): requirement
  confirmation needs conversation_message/user_document evidence (not
  task_brief alone); decide needs top-level `rejected`; keyboard evidence
  should cite artifact_refs + measurement_receipt. Do not hand-feed these
  to the agent — they are discoverable from gate responses; listed here
  for the operator's own sanity-checking only.
