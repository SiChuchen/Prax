# ADR-004: Pluggable Realization Providers

Status: Accepted (2026-08-30)
Amends: none (completes ADR-003 decision 4's "other representation providers later")

## Context

The live run of PRAX-PRICING-001 (2026-08-30) was blocked mid-draft by the
Figma Starter plan's MCP tool-call limit — an account-level quota wall the
project cannot engineer around. ADR-003 deliberately kept core schemas
provider-agnostic (`provider_refs` = `{file_key, frames[{node_id, name,
sdir_region}]}`) and put Figma in a versioned static table, so alternative
representation providers were an additive change.

Two candidates were surveyed (2026-08-30):

- **Penpot** — official MCP server (local mode via `npx @penpot/mcp@stable`
  + plugin bridge, remote mode via `<domain>/mcp/stream?userToken=<MCP key>`;
  self-hostable and open-source, so no vendor quota). Tools `execute_code`
  (create/rename/move/delete/restyle on the focused page), `export_shape`
  (PNG evidence), `high_level_overview`, `penpot_api_info`, `import_image`.
- **pen.dev** (formerly Pencil.dev) — MCP-first canvas with an open `.pen`
  design format that lives in the repo; local MCP server ships with the app.
  Tools `execute` (insert/copy/update/replace/move/delete + `SetVariables` +
  `TakeScreenshot`), `get_app_state`.

Both expose the same capability triple Prax already requires of a
representation provider: `write_canvas`, `screenshot`, `metadata`.

## Decision

1. Extend `REALIZATION_PROVIDERS` with `penpot`
   (`official-mcp-2026-08`) and `pen` (`local-mcp-2026-08`), each declaring
   the full capability triple. The registry remains a declaration of
   supported adapters, not runtime availability — Prax never connects to any
   provider; agents do, via MCP.
2. No schema, gate, or predicate changes. `validatePropose`, `validateDraft`,
   and `validateReview` stay provider-agnostic; the eligibility predicate and
   the fixed six-condition set are properties of the mode, not the vendor.
3. The mode name `figma_first` stays unchanged — it is the historical name
   for the representation-first path (draft → human review rounds → approved
   anchor → implementation). Vendor choice is the `provider` field.
4. Switching provider is a re-propose of the same mode (no mode-flip reason
   required); the existing draft/review lifecycle rules apply unchanged once
   refs exist.
5. Per-provider connection, tool mapping, refs semantics, and evidence
   capture are documented for agents in `docs/realization-providers.md`.

## Consequences

- PRAX-PRICING-001 can resume on `penpot` or `pen` without any gate bypass:
  the Figma quota wall becomes a provider choice, not a methodology exception.
- Evidence integrity is unaffected: screenshots still land under
  `rep-evidence/round-N/` and are sha256-verified by `validateReview`
  regardless of which tool produced them.
- New providers remain a one-table-entry change if they can offer the
  capability triple; providers that cannot produce screenshots cannot feed
  the stakeholder-approval evidence loop and must not be registered.
