# ADR-001: Prax naming and package boundaries

- Status: accepted
- Date: 2026-08-25

The implementation name is **Prax**, replacing the working title Systemsmith
Design MCP. The server is presented as **Prax MCP** and the product position is:

> **Prax — Product-first design intelligence for coding agents.**

The monorepo boundaries are `prax-mcp`, `prax-runtime`, `prax-knowledge`,
`prax-router`, `prax-sdir`, `prax-validator`, and the deferred `prax-web`.
The command surface is `prax inspect`, `prax validate`, and `prax doctor`.

The rename changes product vocabulary only. The v0 behavioral contracts,
tool names, gate outcomes, and Architecture Canvas Golden Case remain governed
by the implementation specification.

