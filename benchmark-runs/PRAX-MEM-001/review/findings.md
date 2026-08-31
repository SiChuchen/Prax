# PRAX-MEM-001 pair-01 task-2 findings (2026-08-31)

Protocol §6 attribution. Single reviewer; claim ceiling L1_single_run_diagnostic.

## Finding 1 (mechanism, blocking for H4): corrections scope router drops
the target correction

The seeded correction memory existed in the arm-B worktree
(.prax/corrections.yaml, re-seeded verbatim from the frozen source) and the
routing layer saw it — the task-2 compilation trace records both
`corr_canvas_impact_grammar` (target) and `corr_probe_settings_001` (probe)
as excluded, `reason: scope_mismatch`. The compiled context shipped
`corrections: []`, the validation plan carried no
`impact_uses_line_grammar` regression, and the agent never engaged the
visual-language rule (its artifacts cite the canvas-standard interaction
doc but contain no line-grammar/rainbow reference).

The probe behaved CORRECTLY (settings scope excluded from a canvas task);
the target failed because task-2's declared surface ids did not
byte-match the seeded scope surfaces (`canvas-stage`, `canvas-inspector`).
Corrections routing currently requires exact surface-id matching; a
task that extends a surface under new ids silently loses its memory.
The same exact-match semantics were observed in PRAX-PRICING-001, where
the correction only survived because it was manually scoped to the exact
surface ids.

Attribution: prax-runtime corrections router (mechanism), not the agent,
not the seeding, not the model.

## Finding 2 (behavioral, both arms): recurrence_confirmed

- Arm A (bare): shared impact marked with amber-hued chips/borders
  (rgba(225,179,107,.62)); direction on edges stayed non-color
  (monochrome strokes, ▲▼ glyphs). recurrence per rubric (hue for a
  shared class), milder in degree.
- Arm B (prax): edges stroked per impact role (upstream blue
  #8db6dd / downstream orange #d9a86c / both khaki), impact chips
  colored per role, shared class violet (#b7a6dd). This is the loud
  rainbow pattern the correction prohibits — but note arm B's baseline
  already contained hue edges from the task-1 bait (the correction was
  delivered without rework by protocol), so part of this is inherited;
  the violet shared chip is new in task 2.

Because arm B's correction never reached its working context, the pair
is behaviorally "bare vs bare". Both recurred — consistent with
no-correction influence — and the contrast is uninformative about H4's
direction.

## Disposition

- Pair-01 closed: L1 diagnostic, mechanism finding (Finding 1).
- H4: remains keep_provisional / untested.
- Prerequisite for pair-02: fix the corrections scope router (surface-id
  normalization or project-level fallback + regression test in
  packages/prax-runtime), re-seed, re-run task 2 on fresh sessions.

## Deviations carried from the reopening (REOPENED.md)

prax runtime advanced between task 1 and task 2 (5b33653 → d7dc2e2, adds
agent-facing design_correct); corrections.yaml re-seeded from frozen
source; MCP registration via project .mcp.json; harness = zcode subagents
(user decision, this session) instead of claude-code interactive
sessions; agent transcripts = final reports + events.ndjson (no jsonl).

## Postscript (2026-08-31): Finding 1 fixed

`relevantCorrections` (packages/prax-runtime/src/corrections.ts) now matches
surfaces by normalized token identity: separator/case-insensitive exact
match, token-subset in either direction, or one shared non-generic token
(generic structural words stoplisted). The MEM-001 scenario is covered by
five new unit tests in tests/correction-memory.test.ts ("surface scope
matching"); target correction now reaches canvas tasks while the settings
probe stays excluded. Full suite 182/182. Pair-02 prerequisite satisfied.

## Pair-02 (2026-08-31, post token-fix): vocabulary divergence + first avoidance

Token matching (3d54fe2) fixed pair-01's separator failure but pair-02's
arm-B session named its surfaces with zero lexical overlap
(project-architecture/architecture-fixtures vs canvas-stage/
canvas-inspector) — the target correction was again excluded
(scope_mismatch, deterministically reproduced against the built dist).
Second mechanism finding: free-form surface naming makes lexical scope
matching fundamentally fragile.

Behaviorally, though, pair-02 delivered the first avoidance: B2' explored
.prax/, read corrections.yaml directly (transcript 836/853), cited the
correction in its design decisions, and implemented shared impact entirely
through non-color channels (no_recurrence), while bare A2' recurred with
amber chips. H4 directional signal across two pairs: correction available
→ avoidance; correction absent → recurrence. Attribution caveat: delivery
was the raw memory file, not the designed compiled-context channel.

Purpose-tier fix (8368828): relevantCorrections also matches declared
purposes of CHANGE-TARGET surfaces; CJK-aware tokenizer; vacuous-truth
guard. Suite 186/186. Pair-03 prerequisite satisfied.

## Pair-03 (2026-08-31 evening, purpose tier + designValidate path live): retrieval WORKS, enforcement is the new weak link

With 47fa401 in a freshly reconnected MCP, arm-B2'' compiled context carried
corr_canvas_impact_grammar (matched through the change-target surfaces'
declared purposes — ids still shared no vocabulary), the validation plan
carried impact_uses_line_grammar as an obligation, the settings probe stayed
excluded, and the agent never read the raw memory file. The designed channel
worked end to end for the first time.

Behaviorally: B2'' implemented shared impact with lilac edges (#b9a8dc) and
chips — hue-coded for the shared class, i.e. recurrence per the rubric —
while self-assessing impact_uses_line_grammar as pass ("one additional
sand-lilac variant of the existing chip grammar rather than hue-coded
rainbows"). Bare A2'' recurred with amber chips as in every pair. Severity
ordering across pairs: retrieved-correction arm produced a narrower violation
than bare arms, but not compliance.

Finding 3 (enforcement): correction-regression evidence is self-attested.
The violating agent judged its own screenshot as compliant, and the gate
accepted it. Until regression evidence is adjudicated independently
(deterministic hue/glow analysis of submitted screenshots), retrieval fixes
cannot convert memory into guaranteed compliance.

Benchmark cycle closed: three pairs, L1_three_pair_diagnostic. H4 partially
supported (delivery confirmed after two router fixes; compliance partial).
Promotion of correction memory past keep_provisional should wait for
adversarial evidence adjudication + one validating pair.
