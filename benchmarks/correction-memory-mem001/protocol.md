# PRAX-MEM-001 Protocol (spec §14 H4, Phase 7B)

## 1. Question and hypothesis

H4: a human correction recorded as project-local Prax correction memory
changes later fresh-session agent behavior, where a correction that existed
only in a closed conversation does not.

Unit of comparison: WITHIN arm, ACROSS sessions (A1→A2 vs B1→B2), not
cross-arm code equality. Both arms end task 1 with different but
functionally similar implementations; that is expected and irrelevant.

## 2. Sequence

```text
Task 1 (impact emphasis)
  A1: bare session ────────┐
  B1: prax session ────────┤ both run to completion on their own worktrees
                           ▼
        operator delivers the SAME chat correction (correction.md §1)
        agent may acknowledge; NO rework; conversations closed
                           │
        operator seeds B worktree .prax/corrections.yaml (correction.md §2)
        A gets nothing (verify: no .prax anywhere)
                           ▼
Task 2 (multi-select impact) — FRESH sessions, same worktrees at task-1 end
  A2: bare session
  B2: prax session (new design session; prepare loads corrections.yaml)
                           ▼
        package evidence; blind task-2 outputs; score R9; unblind; analyze
```

## 3. Fairness rules (spec §14 H4, binding)

1. The chat correction is byte-identical for both arms (correction.md §1).
2. Task 2 uses new agent conversations; no continuation of task-1 chats.
3. Arm A receives normal project files only. The correction must NOT be
   written into any project file, README, doc or commit message for either
   arm. Arm B's `.prax/corrections.yaml` is the only persistence of the
   correction.
4. The correction is not absorbed in stable Prax knowledge (verified
   2026-08-27, correction.md pre-checks).
5. Retrieval attribution must separate `correction_memory` (cites the
   correction / compiled context / regression check) from
   `stable_knowledge` (cites a knowledge entry), `ordinary_project_doc`
   (cites PROJECT_NORTH_STAR / Canvas_Engine_v1_Review), or `unknown`.
6. No hidden human advantage: if arm A asks a question in task 2 whose
   answer would reveal the correction, do not answer it; log the question
   and mark the run biased. Equivalent information rules from PRAX-AB-001
   protocol §8 apply to anything actually answered.
7. Task-2 requirement text must not mention the correction, the visual
   grammar, hue, glow, line weight or dash patterns.

## 4. Operator-mediated ingestion (declared limitation)

No agent-facing flow for writing corrections exists yet; the operator seeds
corrections.yaml after task 1. This models the intended lifecycle (human
review → project memory) but is recorded as a known limitation
(known-limitations.md #1).

## 5. Measurements (R9 operationalization; rubric.yaml is authoritative)

- **recurrence** (both arms, task 2): blinded review of task-2 screenshots +
  diff against the correction semantics. Labels: `recurrence_confirmed` /
  `no_recurrence` / `unclear`. Sub-checks: hue-coded impact marking; glow or
  halos; emphasis via weight/dash/emphasis states; direction readable
  without color.
- **retrieval** (arm B, task 2): from the task-2 compiled context artifact
  (`corrections[]`), compilation trace (`selected corrections`), validation
  report (`correction_regressions`), and transcript mentions. Labels per
  fairness rule 5.
- **leakage** (arm B, task 2): probe correction must appear only in
  trace `excluded` (scope_mismatch), never in compiled context or any
  disclosed material.
- **regression_enforced** (arm B, task 2): validation must require evidence
  for `impact_uses_line_grammar`; a pass without evidence is a mechanism
  failure (cf. PRAX-AB-001 finding-01).
- **knowledge_pollution**: `packages/prax-knowledge/data/knowledge.yaml`
  unchanged after runs (git status in the Prax repo).
- **process_cost**: wall-clock, tool calls, prax calls (B), model usage or
  `not_observable`, human exchanges — both tasks, both arms.

## 6. Attribution

Failure attribution follows spec §24.6. Special cases:

- Correction not routed because task-2 understanding declared different
  surface ids → `Context Routing Failure`, not mechanism failure; record
  actual ids.
- Arm B complies while citing a knowledge entry or project doc, not the
  correction → still `no_recurrence`, retrieval = the cited channel.
- Arm A complies via doc reading → still `no_recurrence`; note that the
  bait was avoidable; recurrence contrast weakens (record honestly).
- No-CoT rule: never infer reasoning from private deliberation; use the
  transcript's explicit decisions and artifacts only.

## 7. Stop conditions

- 90 min wall-clock per task session → stop, record `budget_exceeded`.
- Agent reworks after the task-1 correction despite instructions → stop the
  rework, record the deviation in events.ndjson.
- Safety issue → intervene, log.

## 8. Evidence levels

One pair = L1_single_run_diagnostic. Two same-direction pairs = at most
L2_replicated_implementation. No statistical wording, ever.
