# M3 Chunk 1 smoke report — frozen runtime, 2026-09-07

All smoke artifacts live OUTSIDE the ten pilot workspaces under
`E:/codex-prj/pi-m3-smoke-20260906/` (scratch apps, scratch state, scratch
client). No correction memory was seeded; scratch state is discarded data.

## S1 — Frozen-copy health

- `npm ci` in `E:/codex-prj/pi-m3-frozen-runtime-20260906`: exit 0
  (133 packages; log: `smoke/npm-ci.log`).
- `node packages/prax-mcp/dist/cli.js doctor` (frozen copy,
  PRAX_STATE_ROOT=scratch): PASS — node, knowledge 54 entries, state_store,
  mcp_protocol 2026-07-28.

## S2 — MCP stdio through the frozen entry (real client round-trip)

Driver: `_tools/mcp-call.mjs` (newline-delimited JSON-RPC over stdio),
`PRAX_STATE_ROOT=E:/codex-prj/pi-m3-smoke-20260906/state`.

- `initialize` + `tools/list`: exactly the 12 contract tools
  (design_start … design_validate, design_correct).
- `design_start` (greenfield, scratch project): PASS, session
  `ds_20260907103441_04039f76`; artifacts under scratch
  `scratch-pass/.prax/design/sessions/…`, index under scratch state root.

## S3 — Real intended-client smoke (claude CLI 2.1.251, fresh `-p` sessions)

- **Arm A config** (`--strict-mcp-config --mcp-config launch/mcp-config-empty.json`,
  cwd=scratch): init reports `mcp_servers: []`, zero mcp__ tools. Model resolved
  `glm-5.3-flash[1M]`. Usage observable (9557 in / 282 out). Transcript:
  `a-smoke.jsonl`.
- **Arm B config** (`--strict-mcp-config --mcp-config <scratch-client>/.mcp.json`,
  cwd=scratch-client): init reports exactly `prax:connected` with the 12
  `mcp__prax__*` tools; the session called `design_start` and created
  `ds_20260907103533_f286aaf1` under the scratch client's `.prax`. Usage
  observable (20302 in / 264 out / 12288 cache-read). Transcript: `b-smoke.jsonl`.
- Conclusion: `--strict-mcp-config` isolation and frozen-runtime binding work
  with the actual arm client; token telemetry is observable for budget stops.

## S4 — Measurement CLI direct invocation (three registered cases)

Command form (see addendum D3; MSYS_NO_PATHCONV=1, E:/ paths):

```
node E:/codex-prj/pi-m3-frozen-runtime-20260906/packages/prax-measure/bin/prax-measure.mjs \
  --app <root> --out <unique-dir> --entry / --scenario entry --viewports 1280x860,1440x900
```

| case | app | result | exit | receipt |
|---|---|---|---|---|
| pass | scratch-pass | pass=7 fail=0 skipped=0 warnings=0 | 0 | out-pass/validation-evidence/receipt-2026-09-07T10-33-47-993Z-90ec4c1d….json |
| fail | scratch-fail (deliberate #ccc-on-#fff text) | pass=6 fail=1 (`a11y.contrast`) | 1 | out-fail/validation-evidence/receipt-2026-09-07T10-33-49-987Z-1938f898….json |
| invalid | scratch-invalid (no index.html) | diagnostic skipped receipts (`invalid_target: HTTP 404`) | 2 | out-invalid/validation-evidence/receipt-2026-09-07T10-33-51-582Z-ff7ccacf….json |

Each invocation used a NEW `--out`; no invocation could select a previous
receipt. A failing or invalid target still yields data (receipts retained).

## S5 — Operator screenshot capture rehearsal (addendum D9)

`tools/capture-screens.mjs` against the stopped scratch-pass snapshot:
both 1280x860 and 1440x900 captured via `file:///…/index.html` with the frozen
Playwright Chromium, document readiness only, no interactions; images visually
verified non-blank; `capture-manifest.json` records URL, viewports, timestamps,
browser version, snapshot id, and image sha256
(`out-pass/evidence/screenshots/`).

## Discovery fixed during smoke (registered in addendum before run 01)

- Git Bash MSYS path conversion mangles `--entry /`; operator commands pin
  `MSYS_NO_PATHCONV=1` + `E:/`-style paths (addendum D3 note).
- Token accounting rule pinned: final `result.usage` input + output +
  cache-read + cache-creation; per-message usage retained (addendum D5).
