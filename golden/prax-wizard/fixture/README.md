# PRAX-WIZARD-001 fixture — greenfield + direct_code (PASS)

Session `ds_20260831145445_f482e397` (2026-08-31, second attempt — see
routing note below). Validation **COMPLETE 8/8, zero warnings**. Implementation:
`apps/prax-wizard/` (Vite + React, dashboard token family).

## Golden observations (all held)

- **direct_code proposed before prepare**: realization-decision.yaml records
  the four conditions (mature_design_system the only holding one) accepted
  ahead of design_prepare_implementation; the validation plan carries no
  representation checks and gains the settings checks (settings_grouping,
  safe_change).
- **State model**: per-step valid/invalid with inline first-error summary
  (role=alert) + aria-live announcements; loading=submitting (aria-busy +
  "Queueing…"), empty=fresh draft, ready=all steps valid, error=validation;
  resume-prompt on reload; deterministic success banner (role=status). The
  SDIR enum's "selected" is expressed as the stepper's aria-current step
  (no selection objects exist on this surface).
- **Component contract**: SETTINGS-NAVIGATION (step header) /
  SETTINGS-SECTION (goal groups) / CHANGE-FEEDBACK (queue status). The
  queue brief's "STATE-FEEDBACK" wording was approximate — the honest
  contract for a configuration surface is CHANGE-FEEDBACK, and it carries
  the submitting/success states cleanly.
- **Deterministic functional evidence**: `rep-evidence/wizard-checks.mjs`
  (real keyboard path: Tab / arrow keys / Home / End / Enter / Space), 43/43
  assertions green (`rep-evidence/run.log`), 8 runtime screenshots under
  `rep-evidence/runtime/` — includes the 4100-char over-limit counter error
  and the reload resume prompt.
- **Capability gap**: n4-queue-execution (no backend) advances under an
  explicit compromise — simulated queueing, disclosed in the UI and banner.

## Routing note (recorded for the KB backlog — **hardened 2026-09-01**)

First attempt (`ds_20260831145232_5c68410c`, kept in .prax): the wizard's
domain was described with the novel word "benchmark_operations" → canonical
domain_id=unknown → PAT-SETTINGS-SECTIONS was **excluded** by domain scope
and design_inspect refused it (KNOWLEDGE_NOT_ROUTED), leaving PAT-WORKSPACE
(medium) as the top candidate — a poor fit for a linear wizard. Restarts
with the KB-canonical classification (domain settings/preferences, explicit
`classification` block) route to PAT-SETTINGS-SECTIONS at **high**
confidence. Same vocabulary-divergence family as MEM-001's correction
routing, one layer up: unrecognized domain vocabulary silently degrades
pattern routing and the disclosure gate makes the excluded candidate
unreachable.

Both traps are now closed in the runtime (2026-09-01, TDD, suite 213/213):
(a) anuncanonicalized domain (domain_id=unknown) degrades to a flagged soft
match — the pattern stays a candidate with
`domain_vocabulary_mismatch:canonical_domain_unknown` in its routing audit
and no domain bonus, while KNOWN domain mismatches remain hard boundaries
and task-type scope stays hard; (b) design_context is revisable while the
chain is pre-sdir (gates route/decide): re-submission rewinds completed
gates back to route (`context_revised: true`), and after sdir it stays
blocked with an explicit "start a new session" hint instead of a bare
GATE_NOT_SATISFIED.

## SDIR shape note

`generate_from_decisions` produces a mechanical screen skeleton (roles
`experimental:<object>`, empty behavior_intent, all five enum states) —
consistent with the dashboard fixture. The real state model lives in the
decisions (major_choices), the implementation, and the scripted evidence;
SDIR stays the semantic spine, not the state spec.
