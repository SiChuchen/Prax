# Reviewer-1 score lock + post-hoc disclosure

reviewer-1 scored all six bundles from `git-diff.patch` on 2026-08-27.
After scoring, the packager discovered bundle defects in the original
patches: new untracked files missing from two uncommitted-run patches, one
source file with literal NUL separators rendered "Binary files differ", and
committed screenshot noise. Bundles were regenerated as `review-patch.diff`
(see per-bundle PACKAGING-NOTE.md).

Decision: reviewer-1 scores are locked as produced - they were blind and
evidence-disciplined. The completeness defect may have made affected
implementations look slightly thinner on R5/R6/R7 than their code warrants.
A second independent reviewer scoring from the corrected `review-patch.diff`
closes both the single-reviewer limitation and the evidence-completeness
gap; comparison will weigh that when they diverge.
