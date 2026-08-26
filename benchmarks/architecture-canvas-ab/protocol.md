# PRAX-AB-001 — Architecture Canvas Real Agent A/B Protocol

Operational protocol for the first real implementation A/B. Static definition;
run evidence lands under `benchmark-runs/PRAX-AB-001/` (spec §18, §24.3).

## 1. Objective

Determine whether Prax produces observable, attributable, cost-justified
differences in agent behavior when a real coding agent corrects the ECP
Architecture Canvas readability — versus the same agent working bare.
This is **not** a claim of statistical significance (spec §13.3, §16.3).

## 2. Controlled variables (record in `prax-lock.yaml` per run)

| Variable | Lock |
|---|---|
| requirement snapshot | `benchmarks/architecture-canvas-ab/requirement.md` (content digest) |
| repository base | ecp `2c77838`, clean worktree |
| agent + model | same CLI, same model version; record exact id (or `not_observable`) |
| harness | same session-transcript capture procedure for both arms (§5) |
| stack | repo `package-lock.json` (`npm ci`) |
| tools/permissions | same allowlist for both arms |
| browser | same local Chrome against `npm run dev` |
| review rubric | `rubric.yaml`, identical |
| budget policy | wall-clock cap 120 min/run; stop conditions §9 |
| stop conditions | §9, identical |

Unobservable metrics are recorded as `not_observable`, never omitted.

## 3. Replication

- Arm A ≥ 3 independent runs; Arm B ≥ 3 independent runs.
- Each run: fresh git worktree from base commit + fresh agent session
  (no continuation of a previous conversation).
- Random seeds are not controllable for the model; record this limitation.

## 4. Arms

### Arm A — Bare Agent

Receives: requirement.md content, the repository worktree, normal dev tools.
May ask the operator questions, read code, implement, and test freely.
Must NOT receive: Prax MCP, `.prax/` state, Prax knowledge routing, compiled
context, validation plans, or anything produced by any Prax-arm run.

### Arm B — Prax Agent

Receives: the same requirement and repository, plus the local Prax MCP server
(installed build, version recorded in `prax-lock.yaml`). Works through the
actual Prax runtime flow: requirement confirmation, existing-system
understanding, framing, scoped knowledge, decisions, SDIR delta, persisted
validation plan, compiled implementation context, post-implementation
validation.

### Both arms

Worktree location: `E:\codex-prj\ecp\ab-worktrees\<run-id>-<arm>/`.
No remote writes, no deployment, no ECP Change publication.

## 5. Harness — evidence capture (above both arms)

The harness is **operator-run session capture**, identical for both arms:

1. **Session transcript**: each arm runs in the same agent CLI; the session
   transcript (timestamped messages, tool calls, file edits, commands) is
   exported to `execution/session-transcript.json` (or `not_observable` + best
   available export, recorded in summary.yaml).
2. **Operator event log**: the operator appends every human–agent exchange
   (question asked, answer given, why) to `execution/events.ndjson`.
3. **Git evidence**: at run end, `git diff`, changed-file list, and any commits
   land in `implementation/`.
4. **Browser evidence**: screenshots the agent produces for its own
   verification are copied to `evidence/screenshots/`.
5. **Timing**: wall-clock start/end recorded by the operator.

If the chosen agent CLI cannot export transcripts, that fact is recorded as
`not_observable` and the run's process conclusions are downgraded accordingly
— the A/B must not then claim "full process replayability".

## 6. Isolation & `.prax/` contamination control

- Fresh worktree per run; before an Arm A run starts, verify no `.prax/`
  directory, no Prax env/config, no Prax-generated files exist in the worktree.
- Prax-arm artifacts never enter Bare-arm review material.
- The blinded review bundle (§7) contains no arm-identifying metadata.

## 7. Review blinding

1. Arm labels anonymized (e.g. `impl-1`…`impl-6`, randomized order).
2. Screenshots/diffs randomized.
3. First-pass R1–R7 scoring happens without any Prax trace visibility.
4. Process/attribution review (P-metrics, failure taxonomy) happens only
   after outcome scoring is locked.
5. Single-reviewer limitation is recorded (spec §13.8).

## 8. No hidden human advantage

The operator must not reveal the reference solution (`4f273c9`) or any
information beyond requirement.md to either arm. Every clarification given to
either arm is logged in `execution/events.ndjson`: what was asked, why, what
was answered, and whether the other arm asked something equivalent. If an
answer materially adds information not in requirement.md, the same information
must be offered to the other arm at its next equivalent question, or the run is
annotated as biased and excluded from cross-arm comparison.

## 9. First pass, cost metrics, stop conditions

**First pass** (spec §15.2.1): the code checkpoint at which the agent first
declares the implementation ready for full evaluation and triggers the
protocol's complete validation/browser-evidence collection — not the first file
save or unit test run. The operator marks this event in `events.ndjson` for
BOTH arms using the same definition.

**Mandatory cost metrics** per run (summary.yaml): wall-clock; model/token
usage or `not_observable`; tool calls; Prax calls (Arm B); human
clarifications; artifacts generated; implementation revisions; validation
repair rounds after first pass.

**Stop conditions**: wall-clock cap exceeded (record as `budget_exceeded`);
agent declares done; operator intervenes for safety. Workflow-harm signals
(spec §17.2) are recorded, not suppressed.

## 10. Attribution

Each material finding is attributed via the spec §24.6 taxonomy
(Knowledge Gap / Routing Failure / Compilation Failure / Agent Reasoning
Failure / Implementation Failure / Validation Gap / Requirement Gap /
Process Overhead / Capability–Asset Mismatch / Authority Conflict /
INCONCLUSIVE). Agent Reasoning Failure requires observable explicit decisions
contradicting context the agent provably received (no private-CoT guessing).

## 11. Pre-registered limitations

See `known-limitations.md`. Failures plausibly caused by a pre-registered
baseline limitation are attributed to that limitation first (spec §13.10).
