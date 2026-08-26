# PRAX-AB-001 Execution Runbook (operator manual)

Who runs this: the human operator, in **fresh agent sessions** (one session per
arm per replicate; never continue a used conversation). Worktrees live at
`E:\codex-prj\ab-worktrees\` (parent level, one branch per run). After all
runs finish, hand the run packages to a review session (checklist at the end).

## 0. Preconditions (verified 2026-08-26)

- [x] Prax repo at `E:\codex-prj\Prax\Prax` — build green, tests green, `prax` CLI linked
- [x] ecp repo at `E:\codex-prj\ecp` (moved 2026-08-26 during run-01; branch
      `handoff/ecp-offline-continuation-20260825`, now carries 7 backend-hardening
      commits — A/B worktrees stay isolated because they are cut from `2c77838`)
- [ ] `prax-lock.yaml` filled in (`runtime_commit`, agent cli/model, node -v, chrome)
- [ ] `experiment-manifest.yaml` filled (requirement digest, definition commit)

## 1. One-time prep

```bash
cd E:\codex-prj\Prax\Prax
git rev-parse HEAD                      # -> write into prax-lock.yaml runtime_commit
sha256sum benchmarks/architecture-canvas-ab/requirement.md   # -> experiment-manifest
mkdir E:\codex-prj\ab-worktrees   # worktrees live at the PARENT level, not inside the repo
```

Decide run order in advance and randomize it (e.g. roll a die or shuffle
`run-01…run-06` labels between arms); write the mapping down before starting.

## 2. Per-run procedure (repeat 6×)

### 2.1 Create the isolated worktree (each run on its own branch)

```bash
cd E:\codex-prj\ecp
git worktree add -b ab/run-NN-<arm> E:\codex-prj\ab-worktrees\run-NN-<arm> 2c77838
cd E:\codex-prj\ab-worktrees\run-NN-<arm>
npm ci
```

### 2.2 Contamination check (Arm A mandatory, Arm B sanity)

```bash
# must find nothing:
ls -la .prax 2>/dev/null; ls -la | grep -i prax
```

For Arm B only: ensure the Prax MCP server is configured for the agent
session and `.prax/` will be created inside this worktree (project root =
worktree root). Prax is installed globally (`npm link` from
`packages/prax-mcp`); register it with the agent CLI, e.g. for Claude Code:

```bash
claude mcp add prax -- prax-mcp
```

`prax doctor` must report PASS before the first Arm B run. Session artifacts
land in `<worktree>/.prax/design/sessions/<id>/`; project-local correction
memory (if pre-seeded) belongs at `<worktree>/.prax/corrections.yaml`.

### 2.3 Start the fresh agent session

Open a **new conversation** in the chosen agent CLI, working directory =
the worktree. Give exactly the arm prompt below (same file content for both
arms; Arm B gets one extra paragraph about Prax).

### 2.4 Arm A prompt (Bare)

```text
Read REQUIREMENT below and the repository you are in (an Engineering Control
Plane web app; the Architecture Canvas lives under app/architecture/, with
docs/Canvas_Engine_v1_Review.md and docs/architecture-canvas-standard-v0.1.md).
Implement the requirement. You may read anything in the repo, ask me
questions, run tests (npm test / npm run lint / npm run build / npm run dev),
and take real browser screenshots for verification. Real browser evidence is
mandatory for visual claims. Do not deploy anything.

REQUIREMENT:
<contents of benchmarks/architecture-canvas-ab/requirement.md>
```

### 2.5 Arm B prompt (Prax)

Same as Arm A, plus:

```text
This project has the Prax MCP server configured. Work through Prax for this
task: start a design session (design_start with mode existing_product,
change_kind modify_surface), provide requirement confirmation, existing
understanding of the canvas surfaces, follow the returned gates
(route/decide/sdir delta/prepare/validate). Use the compiled context and
validation plan Prax returns as your implementation guidance. Then implement
in this repository exactly as you would otherwise.
```

Note: the exact gate sequence the runtime enforces is discoverable from the
tool responses themselves (`next` field) — do not hand-feed the agent extra
answers beyond requirement content.

### 2.6 During the run — operator duties

- Log every human–agent exchange to `execution/events.ndjson` (format in
  replicates/README.md). If one arm asks something material the other arm
  hasn't, record it; per protocol §8 you must offer equivalent info to the
  other arm at its next equivalent question or mark the run biased.
- Mark `first_pass` when the agent first declares ready-for-full-evaluation.
- Record wall-clock start/end.

### 2.7 End of run — packaging

```bash
cd <worktree>
git diff > E:\codex-prj\Prax\Prax\benchmark-runs\PRAX-AB-001\replicates\run-NN\<arm>\implementation\git-diff.patch
git diff --name-only > ...\implementation\changed-files.txt
# copy screenshots the agent produced -> ...\evidence\screenshots\
# Arm B: copy .prax\ -> ...\input\prax-artifacts\ and export the compiled
# context + trace from the session artifacts
# export the CLI session transcript -> ...\execution\session-transcript.json
# (if export impossible, write transcript-status.md: not_observable + why)
# fill summary.yaml per replicates/README.md
git worktree remove ..\ab-worktrees\run-NN-<arm>
```

## 3. Stop conditions

- wall-clock 120 min exceeded → stop, record `budget_exceeded`
- agent declares done → package
- safety issue → intervene, log the intervention

## 4. After all 6 runs — review handoff

Blind first (operator): create `review/blinded-outcomes/impl-1…impl-6` with
randomized arm assignment, screenshots + diffs only, no Prax traces. Score
R1–R7 per rubric. Lock scores. Then unblind and fill comparison.yaml,
findings.yaml (attribution per taxonomy), lessons/. Then hand everything to
the review session.

## 5. Review session checklist (Gate A–H, spec §43)

- [ ] Gate A — did Prax materially change agent behavior? (protocol vs
      implementation context; compiler effectiveness; delete low-value artifacts)
- [ ] Gate B — which primitive caused value? (relationship / manifest /
      validation-before-code / correction memory / knowledge routing)
- [ ] Gate C — what context was still missing? (classify: project-local fact /
      primitive candidate / knowledge gap / tooling gap / backend gap / agent bug)
- [ ] Gate D — second independent case needed before stabilizing schema? (default yes)
- [ ] Gate E — did knowledge change at the correct scope? (no project
      correction promoted to general rule; recent-case bias check)
- [ ] Gate F — did drift reveal a supervision need? (was final validation
      enough, or are implementation-time checkpoints justified — Phase 8 input)
- [ ] Gate G — did any capability help or distort? (n/a this round; registry
      not built — record as not-tested)
- [ ] Gate H — repeated implementation worth an asset candidate? (classify:
      coincidence / project recipe / user-org asset / domain candidate / system)
- [ ] Evidence level claimed correctly (L2_replicated_implementation at best;
      no "significant" wording)
- [ ] Cost metrics reported for both arms (wall-clock, tool calls,
      clarifications, repair rounds; tokens or not_observable)
- [ ] Failure attributions respect the no-CoT rule (Agent Reasoning Failure
      only with explicit contradicting decisions; otherwise INCONCLUSIVE)
- [ ] Knowledge Absorption Review produced (lessons/); new_general_rules empty
- [ ] Provisional keep/revise/remove/defer per primitive; final cross-case
      decisions deferred to the second benchmark (B6/B7)
