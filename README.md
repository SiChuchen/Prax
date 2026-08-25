# Prax

> **Prax — Product-first design intelligence for coding agents.**

Prax is a local, stateful design-intelligence runtime exposed through a small,
stateless MCP protocol surface. It makes a coding agent establish the user,
task, product objects, context, and design decisions before implementation.

This repository contains the first executable vertical slice: Architecture
Canvas. It implements all ten staged tools from the v0 specification, explicit
YAML session artifacts, scoped knowledge routing, L0–L3 progressive disclosure,
SDIR linting, capability reconciliation, implementation handoff, and
evidence-aware validation.

## Why Prax exists

Coding agents often receive backend structures and immediately reproduce them
as navigation, forms, or tables. Prax inserts enforceable product-design gates:

```text
Product Frame → Context → Routing → Decision → SDIR
              → Capability Reconciliation → Implementation → Validation
```

The backend remains a constraint and capability source. It does not silently
become the product model.

## Packages

| Package | Responsibility |
|---|---|
| `prax-mcp` | Prax MCP server, ten tool contracts, orchestration, and CLI |
| `prax-runtime` | Explicit sessions, state machine, artifact persistence, gate validation |
| `prax-knowledge` | Scoped, lifecycle-managed design knowledge with L0–L3 disclosure |
| `prax-router` | Context routing, candidate caps, audit records, disclosure authorization |
| `prax-sdir` | Semantic Design Intent Record generation and render-leak linting |
| `prax-validator` | Context-specific plans, evidence ingestion, and typed findings |
| `prax-web` | Reserved for a later review/administration UI; intentionally deferred in v0 |

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Run locally

```bash
npm install
npm run build
npm test
npm run dev:mcp
```

The production stdio entry is:

```bash
node packages/prax-mcp/dist/stdio.js
```

Example MCP client configuration after a build:

```json
{
  "mcpServers": {
    "Prax MCP": {
      "command": "node",
      "args": ["/absolute/path/to/Prax/packages/prax-mcp/dist/stdio.js"]
    }
  }
}
```

Session metadata is indexed under `PRAX_STATE_ROOT` (default `~/.prax`). Design
artifacts live with the target project at:

```text
<project>/.prax/design/sessions/<design_session_id>/
```

## CLI

```bash
prax doctor
prax inspect <design_session_id>
prax validate <design_session_id>
```

During repository development, use `npm run prax -- <command>` after building.

## MCP workflow

1. `design_start`
2. `design_frame`
3. `design_context`
4. `design_route`
5. `design_inspect`
6. `design_decide`
7. `design_sdir`
8. `design_reconcile`
9. `design_prepare_implementation`
10. `design_validate`

Tool order is enforced by the runtime. Calls after `design_start` require an
explicit `design_session_id`, so a second agent can resume without replaying a
chat transcript.

## v0 boundaries

Prax v0 deliberately has no database, vector store, knowledge enumeration
tool, network service, UI generator, or component library. It supports the Web
Desktop/React implementation handoff only. The knowledge store is small and
auditable, and the router uses deterministic filters and ranking.

See [Architecture](docs/architecture.md), [Constitution](docs/constitution.md),
and the [Architecture Canvas Golden Case](golden/architecture-canvas/README.md).

