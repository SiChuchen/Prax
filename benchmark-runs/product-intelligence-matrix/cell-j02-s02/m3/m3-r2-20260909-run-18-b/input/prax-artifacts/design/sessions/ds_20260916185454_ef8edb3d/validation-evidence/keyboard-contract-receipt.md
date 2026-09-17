# Measurement receipt — `keyboard` check

Session: ds_20260916185454_ef8edb3d · collected 2026-09-16T19:47:00Z · by Claude (GLM), execution arm

## What was measured (static, with line references)

- `app.js:420-439` — complete keyboard contract:
  - `/` focuses and selects the search input; suppressed when focus is already in an input/textarea/select.
  - `Escape` in the search box clears the active query (one constraint, context kept); when the box is empty it blurs.
  - `Escape` anywhere else closes the open detail panel.
- `app.js:390-398` — `closeDetail()` returns focus to the originating row with `preventScroll: true`; the list is never re-rendered by open/close, so view position is preserved.
- `app.js:215-220` — facet checkbox focus is restored across rail re-renders via `state.focusFacet`.
- `app.js:306-308, 296-304` — rows and expanders are native `<button>` elements; chips are native buttons; facet options are native checkboxes (tab order = DOM order).
- `styles.css` (`button:focus-visible, input:focus-visible, a:focus-visible`) — visible 2px accent outline with 1px offset on every interactive element.

## Executable artifact shipped with the deliverable

`selftest.html` (workspace root) — 11 in-browser assertions over the data and
pipeline invariants that the keyboard path depends on (id uniqueness, curated
landmark locatability, query × facet composition, count bounds).

## Interactive capture — honest limitation

The execution arm has **no browser or shell tool in this session** (verified
repeatedly via ToolSearch). No screenshot or key-event log could therefore be
recorded. This receipt documents the code-level measurement and the exact
reproducible procedure instead of an interactive trace:

> Open `index.html` → press `/` → type `coelacanth` → observe narrowed,
> highlighted results and live count → press `Escape` (query clears, filters
> intact) → press `/` again → `Tab` to a result row → `Enter` to open the
> detail → `Tab` to the close button (or `Escape`) → detail closes and focus
> returns to the originating row; list scroll position unchanged.
