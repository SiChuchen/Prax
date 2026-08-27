# Packaging note (read before scoring)

This bundle contains a regenerated `review-patch.diff` for reviewer
convenience. The original `git-diff.patch` (kept untouched) had two
packaging artifacts, now corrected in the review patch:

1. New files created by the implementation did not appear (untracked files
   are absent from a plain working-tree diff); the review patch includes
   them via intent-to-add.
2. A source file containing literal NUL separator bytes inside string
   literals was shown as "Binary files differ"; `--text` mode now shows its
   diff with those bytes escaped. The NUL bytes are the implementation's
   actual code (a deliberate composite-key separator), not corruption.
3. Screenshot PNGs that some implementations committed to their branch are
   excluded from the review patch; the same screenshots are in
   `screenshots/`.

`changed-files.txt` is refreshed to match (excluding screenshot files).
Score from `review-patch.diff`; use `git-diff.patch` only for auditing.
