# PRAX-MEM-001 Execution Runbook (operator manual)

Who runs this: the human operator, in **fresh agent sessions** (never
continue a used conversation). Worktrees live under
`E:\codex-prj\ab-worktrees\`. Run package goes to
`benchmark-runs/PRAX-MEM-001/pairs/pair-01/`.

Use the same agent CLI + model as PRAX-AB-001 (record in prax-lock.yaml).

## 0. Preconditions

- [ ] Prax repo `E:\codex-prj\Prax\Prax` — build green, tests green, `prax`
      CLI linked, `prax doctor` PASS
- [ ] ecp repo at `E:\codex-prj\ecp` on branch
      `handoff/ecp-offline-continuation-20260825` with commit `4f273c9`
      reachable
- [ ] `benchmark-runs/PRAX-MEM-001/prax-lock.yaml` filled (runtime commit,
      agent cli/model, node, chrome)
- [ ] `experiment-manifest.yaml` filled (requirement digests for both tasks,
      correction.md digest, definition commit)

## 1. One-time prep

```bash
cd E:\codex-prj\ecp
git worktree add -b mem1/pair-01-a E:\codex-prj\ab-worktrees\mem1-pair-01-a 4f273c9
git worktree add -b mem1/pair-01-b E:\codex-prj\ab-worktrees\mem1-pair-01-b 4f273c9
cd E:\codex-prj\ab-worktrees\mem1-pair-01-a && npm ci
cd E:\codex-prj\ab-worktrees\mem1-pair-01-b && npm ci
```

Create the run package skeleton:

```text
benchmark-runs/PRAX-MEM-001/pairs/pair-01/
├── task1-arm-a-bare/{input,execution,implementation,evidence}/
├── task1-arm-b-prax/{input,execution,implementation,evidence}/
├── task2-arm-a-bare/{input,execution,implementation,evidence}/
├── task2-arm-b-prax/{input,execution,implementation,evidence}/
├── correction-delivery.md      # timestamps of both deliveries
└── r9-summary.yaml             # filled at review
```

Freeze the frozen inputs now: copy `task1-requirement.md`,
`task2-requirement.md`, `correction.md` into each arm's `input/` as given.

## 2. Task 1 (A1 then B1 — order between arms is free)

### 2.1 Start session A1 (Bare)

New conversation, working directory = `mem1-pair-01-a`. Prompt:

```text
Read REQUIREMENT below and the repository you are in (an Engineering Control
Plane web app; the Architecture Canvas lives under app/architecture/, with
docs/Canvas_Engine_v1_Review.md, docs/architecture-canvas-standard-v0.1.md
and docs/handoff/PROJECT_NORTH_STAR.md). Implement the requirement. You may
read anything in the repo, ask me questions, run tests (npm test / npm run
lint / npm run build / npm run dev), and take real browser screenshots for
verification. Real browser evidence is mandatory for visual claims. Do not
deploy anything.

REQUIREMENT:
<contents of task1-requirement.md, Requirements + Constraints sections only>
```

### 2.2 Start session B1 (Prax)

Same, plus:

```text
This project has the Prax MCP server configured. Work through Prax for this
task: start a design session (design_start with mode existing_product,
change_kind modify_surface), provide requirement confirmation, existing
understanding of the canvas surfaces, follow the returned gates
(route/decide/sdir delta/prepare/validate). Use the compiled context and
validation plan Prax returns as your implementation guidance. Then implement
in this repository exactly as you would otherwise.
```

### 2.3 During task 1 — operator duties

- events.ndjson per task dir (format: PRAX-AB-001 replicates/README.md);
  add kinds: `correction_delivered`, `correction_reply`, `session_closed`.
- Contamination check on A worktree before B1 starts: no `.prax` anywhere.
- wall-clock start/end.

### 2.4 Deliver the correction (both arms, identical)

After the agent declares done, paste the chat correction from
`correction.md §1` verbatim. Record the agent's reply. Then say:

```text
Understood — we'll pick this up in the next session. Closing here.
```

Close the conversation. If the agent starts reworking anyway, stop it
(protocol §7) and log the deviation.

### 2.5 Seed arm B correction memory

```bash
mkdir <mem1-pair-01-b>/.prax
# write correction.md §2 yaml verbatim to <mem1-pair-01-b>/.prax/corrections.yaml
# re-check arm A: ls -la <mem1-pair-01-a> | grep -i prax   (must be empty)
```

### 2.6 Package task 1 (per arm)

Same as PRAX-AB-001 runbook §2.7: git-diff.patch, changed-files.txt,
screenshots, session transcript export, summary.yaml. Arm B: copy `.prax/`
into `input/prax-artifacts/` — BUT copy it BEFORE seeding corrections.yaml
as well (keep both: `prax-artifacts-task1-end/` pre-seed,
`prax-artifacts/` post-seed).

## 3. Task 2 (A2 then B2 — fresh sessions, same worktrees)

### 3.1 Session A2 (Bare)

New conversation in `mem1-pair-01-a`. Prompt: same preamble as A1 with
REQUIREMENT = `task2-requirement.md` (Requirements + Constraints). Do NOT
mention the correction or task 1's review.

### 3.2 Session B2 (Prax)

New conversation in `mem1-pair-01-b`. Same prompt as A2 plus the Prax
paragraph from §2.2. The agent must start a NEW design session — do not
resume the task-1 session ID.

### 3.3 During task 2 — operator duties

- Same event logging; watch for A2 asking questions whose answer would
  reveal the correction (protocol §3.6): do not answer, log, mark biased.
- Note whether B2's Prax outputs (compiled context / validate) visibly
  carry the correction — record what the tools returned in the transcript,
  never hand-feed it.

### 3.4 Package task 2 (per arm)

As §2.6, plus arm B: export the task-2 session's compiled context,
compilation trace and validation report into `input/` (these are the
retrieval evidence).

## 4. Stop conditions

Per protocol §7: 90 min/session budget; stop any post-correction rework;
log interventions.

## 5. After pair-01 — review handoff

1. Blind: copy task-2 packages to `review/blinded-outcomes/impl-1..impl-2`
   with randomized arm assignment (screenshots + diff only, no Prax
   traces). Score `recurrence` + `task1_bait` per rubric. Lock scores.
2. Unblind: fill `r9-summary.yaml` (retrieval, leakage,
   regression_enforced, knowledge_pollution, process_cost).
3. Verify `packages/prax-knowledge` clean in the Prax repo.
4. Write findings with attribution (protocol §6) and decide: pair-02
   (evidence ceiling L2) or close H4 at L1.
