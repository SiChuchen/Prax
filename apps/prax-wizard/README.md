# prax-wizard

PRAX-WIZARD-001 golden case implementation (greenfield, direct_code
realization): three-step benchmark-run setup wizard — Target / Arms / Review
with per-step validation, inline first-error summaries (aria-live), arm
model distinctness, 1–6 replicate stepper, blind-review consequence note,
localStorage draft + reload resume prompt, deterministic simulated queue
(submitting state + success banner, no backend).

Pattern contract: PAT-SETTINGS-SECTIONS (SETTINGS-NAVIGATION /
SETTINGS-SECTION / CHANGE-FEEDBACK). Tokens pinned like `apps/prax-dashboard`.

- `npm run dev` — local dev server
- `npm run build` — production build
- `node evidence/wizard-checks.mjs` — 43 deterministic Playwright assertions
  (real keyboard path) + 8 state screenshots into `evidence/shots/`

Design session artifacts + evidence are frozen in
`golden/prax-wizard/fixture/`.
