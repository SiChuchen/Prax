# PRAX-MEM-001 Known Limitations (pre-registered)

1. **Operator-mediated correction ingestion.** No agent-facing flow writes
   corrections.yaml yet; the operator seeds it after task 1. The lifecycle
   step "agent records the human correction" is untested here. If task-2
   value is observed, part of the credit belongs to a flow not yet built.

2. **Bait is avoidable.** The line-grammar rule is discoverable in ecp
   docs. A diligent task-1 agent may comply without correction. Pre-registered
   handling: `task1_bait` is scored per arm; `bait_avoided` weakens that
   arm's recurrence measurement but does not void the pair. The rubric
   records this honestly instead of discarding the run.

3. **In-code precedent is an information channel for both arms.** Task 2
   starts from each arm's own task-1 code. Bare recurrence may propagate
   via code reading (legitimate: it's a normal project file), not via lost
   memory. The measured contrast is: explicit correction + regression check
   vs code/doc precedent alone, when they point in different directions.

4. **Surface-id matching risk.** Correction routing matches
   `scope.surfaces` against the surfaces the task-2 understanding declares.
   If the agent invents different ids (`stage`, `main-canvas`), routing
   misses and the finding is a Context Routing Failure, not a correction-
   memory failure. Reviewer must read the actual declared ids before
   concluding anything.

5. **Single pair = L1.** pair-01 alone supports only single-run diagnostic
   claims. Two same-direction pairs raise the ceiling to L2.

6. **Single reviewer.** Unless a second reviewer joins, recurrence scoring
   has a single-reviewer limitation (same as PRAX-AB-001).

7. **Knowledge proximity.** A generic quiet-decoration heuristic exists in
   prax-knowledge. It does not state the line-grammar rule, but retrieval
   attribution must check citations before labeling the channel
   `correction_memory`.

8. **Language and model parity.** Correction and requirements are English;
   agent/model identical to PRAX-AB-001 (claude-code + glm-5.3). Different
   models would need re-verification of the bait strength (limitation #2).

9. **Shared agent-CLI memory across worktrees (hit in pair-01).** Both arm
   worktrees share one git root (ecp), so the agent CLI's auto-memory pools
   into one project memory dir. Observed 2026-08-27: the B1 agent wrote the
   correction into memory before rework was interrupted; B-arm harness
   knowledge would also be recallable by arm A. Mitigation applied: archive
   in-experiment memory files after each task-1 session closes, restore the
   pre-experiment baseline index, and re-verify the dir before every task-2
   session start. Residual risk: a memory write that happens between the
   final check and session start. PRAX-AB-001 may have had the same channel;
   its review judged final artifacts, and it is not being reopened.
