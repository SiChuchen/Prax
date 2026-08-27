# Golden Case: Prax Landing Page (figma_first realization)

## Requirement

Design and implement the Prax product website home page. Sections: hero with
product value proposition and primary CTA, "how it works" value summary
(three-stage), capability features list, closing CTA. Audience: engineering
leads evaluating AI-assisted frontend design tooling. Tone: precise,
product-first, no marketing fluff. Static page; no complex runtime state.

## Why this case fits figma_first (Methodology §18.2)

Greenfield; high visual uncertainty (brand language unsettled);
marketing/editorial surface; stakeholder visual approval required; spatial
exploration valuable; runtime dependency low.

## Golden observations (expected per gate)

- design_decide / design_sdir complete with region set covering hero, value,
  features, CTA.
- design_realize propose → figma_first with a satisfied eligibility predicate
  (all six conditions declared; runtime_dependency_low + ≥1 fit condition true).
- submit_draft maps every SDIR region to ≥1 Figma frame (coverage check passes).
- Human review round recorded with screenshot evidence under
  rep-evidence/round-N/ and human_decision provenance; any rejection carries
  region-annotated feedback and triggers a revision round.
- design_prepare_implementation emits a realization block (provider,
  provider_contract_version, representation_artifact_ref, review round +
  screenshot digests, provider_refs, sdir_digest) and the compiled context
  carries the region→frame mapping with the approved anchor.
- validation plan contains design_representation_coverage (deterministic) and
  representation_runtime_drift (empirical, exactly two verified artifact_refs:
  approved review screenshot, then runtime snapshot under rep-evidence/).
- Implementation lands in apps/prax-landing/ and validation reaches COMPLETE.

## Pass/fail

Pass = every observation above holds with zero manual gate bypasses and no
agent self-attestation warnings on the drift check. Fail = any gate bypass,
empty drift evidence, or unapproved-representation prepare.
