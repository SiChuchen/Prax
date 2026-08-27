# PRAX-MEM-001 Closure — cut before task 2

Date: 2026-08-28. Decision: user. Reason: experiment cycle too long relative
to development pace; pivot to the Figma realization path (Methodology Guide
Part V / §18 figma_first) instead of more benchmarking.

## State at cut

| Item | Status |
|---|---|
| Task 1 arm A (mem1-pair-01-a) | ran ~2h, browser verification in progress at cut (not packaged as final; transcript captured mid-run) |
| Task 1 arm B (mem1-pair-01-b) | complete (declared done, 5 screenshots in run-evidence/, 9 files changed); canonical correction delivered in-chat; rework attempt interrupted before any edit landed (verified: both post-correction Edits show "Interrupted by user") |
| Task 2 (A2/B2) | never run |
| Bait outcome | both arms took the bait (hue/badge impact marking): B confirmed via its correction reply ("去掉徽章与色彩类"), A observed via ▲▼ badge work in transcript |
| Corrections seeding | `.prax/corrections.yaml` seeded in B worktree (target + probe); never consumed by any session |

## H4 disposition

Correction memory remains **keep_provisional / untested**. No R9 evidence
was collected (retrieval/leakage/regression_enforcement all unmeasured).
The PRAX-AB-001 gates.md provisional decision stands unchanged.

## Deviations recorded

1. B1 wrote the correction into the shared agent-CLI memory dir
   (E--codex-prj-ecp\memory\feedback-canvas-visual-language.md, git-root-
   keyed pooling across worktrees — see known-limitations #9). Archived to
   deviation-memory-archive/ at closure; MEMORY.md index restored.
2. B1 attempted post-correction rework; interrupted by operator before any
   edit executed (transcript lines 852-856).
3. Correction ingestion was operator-mediated (no agent-facing flow exists).

## Artifacts

- Static definition: benchmarks/correction-memory-mem001/ (8 files + limitation #9)
- Run package: this directory (diffs, changed-files, screenshot listings,
  both session transcripts)
- Worktrees left in place: E:\codex-prj\ab-worktrees\mem1-pair-01-{a,b}
  (branches mem1/pair-01-a / mem1/pair-01-b from 4f273c9)

## What would be needed to reopen

Task 2 sessions (A2/B2) on the existing worktrees + R9 review. The bait is
confirmed present on both arms, so the recurrence contrast would still be
valid if reopened.
