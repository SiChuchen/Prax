# M3 Blind Review Rubric — FROZEN before any review session (2026-09-09, Chunk 3 Task 6)

Reviewers receive, per anonymous package `impl-XX`: the common task brief,
two operator screenshots of the initial page (1280x860, 1440x900), a sanitized
measurement summary (seven browser checks: pass/fail/skipped + whether the
target was invalid), and the product source files. Reviewers do NOT receive
arm labels, prompts, process logs, Prax artifacts, operator reports, or paths.

## Scoring (1–5 each; 5 = best). Every score MUST cite evidence
(screenshot viewport, `file:line`, or check id). If evidence is missing, write
`missing_evidence` and score `null`.

| id | dimension (ab-protocol §44) | what is observable here |
|---|---|---|
| representation_fit | Representation Fit | primary representation vs the brief's shape/object/job |
| primary_task_salience | Primary-task salience | is the brief's primary task dominant on the initial screen |
| time_to_understand | Time to understand (**model-judged proxy, not human**) | how quickly the initial screen conveys what/where; label proxy |
| navigation_cost | Navigation cost (structural) | steps/modes to reach the primary object (from UI + source) |
| context_loss | Context loss (structural) | whether primary actions preserve context (from source/UI structure) |
| ui_surface_complexity | UI surface complexity | permanent surfaces/controls relative to need |
| accessibility | Accessibility | receipt a11y checks + visible affordances (focus, contrast, target size) |
| frontend_rework | Frontend rework (defect part) | visible layout defects + receipt error failures implying rework |
| acceptance_seed_coverage | (pilot addition) brief acceptance seeds covered | evidence in source/UI that the brief's seeds are addressed |

## Must be marked `not_observable` in blind review (do not guess)

- Task completion time, Information retrieval accuracy, Human preference
  (no user study exists in this pilot).
- Error rate is supplied objectively from the receipt summary (reviewer may
  reference it but does not rescore it).
- Token cost is operator data, withheld from blind review.

## Output contract (strict JSON, nothing else)

```json
{
  "package_id": "impl-XX",
  "scores": { "<dimension_id>": { "score": 1-5|null, "evidence": "..." } },
  "not_observable": ["task_completion_time", "information_retrieval_accuracy", "human_preference"],
  "defects_observed": ["..."],
  "missing_evidence": ["..."],
  "overall_note": "one paragraph, evidence-backed, no arm speculation"
}
```

## Rules

- Score only what you can see; cite it. No speculation about how it was built.
- Model preference is not human preference; say so where relevant.
- Two independent reviewers (R1, R2) score every package in fresh sessions
  with no access to each other's scores or the private mapping. Scores are
  hashed and frozen before disagreement review, adjudication, or unblinding.
