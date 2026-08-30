# PRAX-DASHBOARD-001 fixture (direct_code live run, PASS)

Frozen outputs of the live acceptance run executed 2026-08-30:

- session: `ds_20260830045528_df52c3d8` (greenfield, web_desktop/react)
- result: **PASS** — validation reached `COMPLETE`, 8/8 checks pass, zero
  warnings (no gate bypasses, no self-attestation)
- realization: **direct_code** proposed and accepted before prepare; the
  implementation brief's realization block is `{mode: direct_code}` and the
  validation plan carries **no representation checks** — both golden
  observations verified live
- pattern: PAT-DATA-EXPLORER (first live high-confidence routing to the
  data-exploration domain; component contracts DATA-SURFACE /
  FILTER-CONTROLS / CONTEXTUAL-DETAIL)
- capability gap: n4-export (explicit compromise, first live gap)
- implementation: `apps/prax-dashboard/` (Vite + React, dark compact
  instrument panel)

## Layout

- `*.yaml` — session artifacts in gate order (frame → context → routing →
  decisions → sdir → capability-gaps → realization-decision → brief →
  compiled-context + validation plan/report)
- `rep-evidence/runtime/` — Playwright captures of the four honest states
  (loading skeleton via `?slow=1`, empty filter, error banner via
  `?forceError=1`, row selection + detail panel) and the ready page;
  keyboard walkthrough and sort/filter assertions are recorded in
  `validation-report.yaml` findings

Unlike PRAX-LANDING-001 there is no representation artifact or approved
screenshot anchor by design — direct_code sessions carry no representation
checks.
