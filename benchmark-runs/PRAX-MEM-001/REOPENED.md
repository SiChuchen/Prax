# PRAX-MEM-001 Reopening — Task 2 (A2/B2)

Date: 2026-08-31. Decision: user (in ZCode session `sess_e10b22c7`, after
PRAX-PRICING-001 completed). Scope: **Task 2 only** — Task 1 artifacts and
the 2026-08-28 closure reasons (CLOSURE.md) stand unchanged as historical
record. Rationale: the H4 question (does correction memory survive session
close and change fresh-session behavior) is still open at
keep_provisional; PRAX-PRICING-001 validated the realization path, so
benchmarking budget is available again.

## Preconditions re-verified 2026-08-31

- Prax repo build green, tests 177/177 (`npm test`), prax CLI linked.
- ecp worktrees `E:\codex-prj\ab-worktrees\mem1-pair-01-{a,b}` present at
  base `4f273c9` with task-1 end state as uncommitted working-tree changes
  (baseline diffs snapshotted to
  `pairs/pair-01/task2-*/input/task1-end-state-baseline.patch` so the
  task-2 diff can be isolated).
- Contamination check: arm A has no `.prax/` (re-verified).
- `task2-requirement.md`, `correction.md` unchanged from definition
  (frozen inputs copied into each task2 arm `input/`).

## Deviations vs task-1 conditions (recorded for R9 attribution)

1. **prax runtime advanced**: task 1 ran on prax `0.3.1-A9`
   (commit `5b33653`); task 2's arm-B prax MCP serves the current runtime
   (`d7dc2e2`, 2026-08-31) which adds agent-facing gates and
   `design_correct`. Arm B's memory channel is therefore stronger in task 2
   than in task 1. Direction of H4 unaffected; absolute cross-arm
   comparisons to task 1 are not claimed.
2. **corrections.yaml re-seeded**: the file seeded after task-1 close was
   no longer present in the B worktree (only `.prax/design/` survived).
   Re-seeded 2026-08-31 **verbatim from `correction.md §2`** (the frozen
   authoritative source named by the runbook §2.5): target
   `corr_canvas_impact_grammar` + probe `corr_probe_settings_001`,
   `created_at` values kept frozen as written.
3. **prax MCP registration mechanism**: task 1 used a claude-code local
   registration (lost in the 2026-08-29 config migration); task 2 uses a
   project `.mcp.json` in the arm-B worktree registering the same server
   binary, same scope (arm A gets none — verified absent).
4. **execution mode**: sessions run via `claude -p` headless with
   permissions bypassed, model `glm-5.3` (same as task 1), transcripts
   captured from `~/.claude/projects/` jsonl. 90-min budget per session
   (protocol §7).

## Run book

- A2: fresh session, cwd `mem1-pair-01-a`, prompt = runbook §2.1 preamble +
  task2-requirement.md (Requirements + Constraints only). No mention of
  the correction or task-1 review.
- B2: fresh session, cwd `mem1-pair-01-b`, same + runbook §2.2 Prax
  paragraph; new design session, task-1 session id must not be resumed.
- Operator (agent in sess_e10b22c7): events.ndjson logging, §3.3 leakage
  watch, packaging per §3.4, then R9 review per §5 (blind scoring →
  unblind → r9-summary.yaml).
