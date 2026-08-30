# prax-dashboard

Prax local operations dashboard (single dense page). Realized direct_code
under golden case PRAX-DASHBOARD-001 (session `ds_20260830045528_df52c3d8`):

- realization decision: direct_code (no representation artifact; validation
  plan carries no representation checks by design)
- pattern: PAT-DATA-EXPLORER (first live routing to the data-exploration
  domain; contextual inspector as the detail side panel)
- four honest states: loading skeleton (first paint), empty filter state
  (this fixture snapshot has no running sessions), error banner + retry via
  `?forceError=1`, row selection driving the detail panel
- keyboard: filter select → sort buttons → rows (Enter/Space toggles
  selection) → retry, visible focus throughout; `?slow=1` extends the
  skeleton for deterministic observation

## Run

```bash
npm install -w prax-dashboard
npm run build -w prax-dashboard
npm run preview -w prax-dashboard
```
