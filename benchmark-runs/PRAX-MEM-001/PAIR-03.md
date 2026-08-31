# PAIR-03 — task 2 re-run with the purpose-tier routing live

Date: 2026-08-31 (evening). Warranted by pair-02's second mechanism finding:
the token-tier fix could not bridge ZERO lexical overlap between session
surface ids (project-architecture / architecture-fixtures) and the seeded
scope (canvas-stage / canvas-inspector). Enabling fixes, both built into
dist and verified present:

- `3d54fe2` — token-tier matching (pair-01 finding)
- `8368828` — purpose-tier matching: declared purposes of change-target
  surfaces join the matching domain; CJK-aware tokenizer; vacuous-truth
  guard on empty token sets
- `47fa401` — PraxService.designValidate's own relevantCorrections call
  (validate-plan correction_regressions path) joins the purpose tier —
  found during pair-03 prep: the context-compiler fix alone did not cover
  the MCP server's plan path

## Launch gate

prax MCP reconnected AFTER `47fa401`'s build so the fresh stdio process
loads the purpose-tier router. (Pair-02 lesson: subagents share the
session's MCP process; a stale process silently runs the old router.)

## Expected outcome

Arm B2'' compiled context carries corr_canvas_impact_grammar (matched via
change-target surface purposes), the validation plan carries
impact_uses_line_grammar as a correction_regression obligation, and the
settings probe stays excluded (scope_mismatch). Behavioral: B2'' avoids
hue/glow via the DESIGNED channel (not raw-file luck). A2'' bare is
expected to recur (amber-family chips), completing a two-pair contrast
with a working treatment channel.

## Same protocol as pair-01/02

Prompts verbatim from runbook §2.1/§2.2 + §3; zcode subagent harness (user
decision); worktrees reset to task-1 end state from frozen baseline
patches; pair-02 artifacts removed (both arms' evidence/, arm A
tests/canvas-engine.test.mjs + tsconfig.tsbuildinfo, arm B .sites-runtime/
+ ds_20260831064508_* session dir + tsconfig.tsbuildinfo); task-1-era
untracked files kept; corrections.yaml verified seeded; operator logs
events, watches §3.3 leakage, packages per §3.4, blind-scores, unblinds.
