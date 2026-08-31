# PAIR-02 — task 2 re-run after the corrections scope-router fix

Date: 2026-08-31. Warranted by pair-01's mechanism finding (Finding 1 in
`review/findings.md`): the target correction never reached arm B's working
context because `relevantCorrections` matched surfaces by exact string.
Fix: commit `3d54fe2` (normalized token matching + stoplist; 5 unit tests;
suite 182/182). Pair-02 tests H4 with the memory channel actually live.

## Differences from pair-01

- prax runtime: includes the scope-router fix (`3d54fe2`). Everything else
  follows the pair-01 deviations recorded in REOPENED.md (harness = zcode
  subagents per user decision; corrections.yaml seeded verbatim from
  correction.md §2; arm-B prax MCP via project .mcp.json).
- Sessions: A2'/B2' — fresh subagents, same prompts as pair-01 (runbook
  §2.1 preamble + task2-requirement Requirements/Constraints; B arm adds
  the §2.2 prax paragraph; new design session).
- Worktrees reset to the task-1 end state before launch: pair-01 task-2
  changes discarded (`git checkout -- .`), task-1 state re-applied from
  the frozen baseline patches; pair-01 artifacts removed (arm A:
  tests/canvas-impact.test.mjs, tsconfig.tsbuildinfo; arm B:
  evidence/, .canvas-harness/, .prax/design/sessions/ds_20260831032103_*,
  tsconfig.tsbuildinfo). Task-1-era untracked files kept (timestamp
  verified 2026-08-27/28: run-evidence pngs, cf-shim.mjs,
  vite.fixture.config.ts, .playwright-mcp/, arm-B run-evidence/).
- Arm-B state at launch: .prax/corrections.yaml (target + probe) +
  .prax/design/sessions/ds_20260827134101_* (task-1 session only).

## Expected outcome if the fix works

Arm B2' compiled context carries corr_canvas_impact_grammar (corrections[]
non-empty; validation plan includes impact_uses_line_grammar as a
correction_regression) while corr_probe_settings_001 stays excluded
(scope_mismatch). Recurrence contrast then becomes meaningful: B2' with
correction + regression obligation vs A2' bare.

## Review

Same procedure as pair-01: blind impl packages, recurrence scoring per
rubric, unblind, append pair-02 section to r9-summary.yaml (or
r9-summary-pair-02.yaml), attribute against pair-01.
