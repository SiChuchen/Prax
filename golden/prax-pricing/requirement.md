# Golden Case: Prax Pricing Page (existing_product + add_surface, figma_first realization)

## Requirement

Add a pricing page to the Prax site (apps/prax-landing), reachable from the
header shell. Sections: a short framing headline (what is free now, what is
paid later — Prax is currently a local OSS runtime, so the page must say
honestly that the runtime is free and self-hosted today, with a "support the
project" tier and a placeholder managed-cloud tier marked "planned"); a
three-column tier comparison (Local OSS / Support / Managed Cloud planned)
with a feature matrix of at least eight rows grouped in three groups
(runtime, knowledge, support); an FAQ accordion of five answers (self-host
requirements, data locality, license, roadmap, contact); and the standard
shell footer. The page inherits the approved landing tokens (#FAFAF7, ink
#111110, mono accents, black primary buttons) but the tier-card composition,
comparison-matrix styling, and FAQ interaction are new visual territory —
brand language is still unsettled at the component level. Audience unchanged
(engineering leads); tone precise, no dark patterns, no fake countdowns.

## Why this case fits figma_first (Methodology §18.2, second case)

Add-surface on an existing product (first live add_surface lifecycle):
integration with the approved shell and tokens is a real constraint, while
the new component-level visual language is genuinely unsettled; marketing/
editorial surface; stakeholder visual approval required (round-based like
PRAX-LANDING-001); spatial exploration of tier-card and matrix composition
has real value; runtime dependency low (static + a details-style accordion).

## Golden observations (expected per gate)

- add_surface lifecycle: existing understanding declares the landing site
  surfaces; the new pricing surface enters change_targets; integration_plan
  (alignment_points / neighbors / implementation_order) appears in the
  prepare brief.
- Router behaves on a second marketing-adjacent surface (KB still has no
  marketing domain — record whether the accepted-gap pattern repeats).
- design_realize propose → figma_first with all six §18.2 conditions and an
  honest stakeholder-approval loop: submit_draft → human review round(s)
  with screenshot evidence under rep-evidence/round-N/ → submit_review.
- New region set (framing, tiers, matrix, FAQ) maps ≥1 Figma frame per
  region; coverage check passes; prepare realization block + compiled
  approved anchor complete.
- FAQ interaction keyboard-operable; matrix readable at 1280px without
  horizontal scroll.
- Validation reaches COMPLETE; representation_runtime_drift carries exactly
  two verified artifact_refs (approved screenshot, runtime snapshot).

## Pass/fail

Pass = every observation holds; human review recorded with real stakeholder
statement; integration with the existing shell shows no token drift.
Fail = invented pricing claims, dark patterns, token drift from the approved
landing, or any gate bypass.
