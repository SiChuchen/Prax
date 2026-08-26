import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { requirementConfirmation } from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

it("starts over stdio, registers exactly ten staged tools, and validates inputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "prax-mcp-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve("packages/prax-mcp/dist/stdio.js")],
    env: { ...process.env, PRAX_STATE_ROOT: join(root, "state") },
    stderr: "pipe",
  });
  const client = new Client({ name: "prax-protocol-test", version: "0.1.0" });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      "design_context", "design_decide", "design_frame", "design_inspect", "design_prepare_implementation",
      "design_reconcile", "design_route", "design_sdir", "design_start", "design_validate",
    ]);

    const started = await client.callTool({
      name: "design_start",
      arguments: {
        requirement: "Inspect an architecture",
        project_root: projectRoot,
        mode: "greenfield",
        requirement_confirmation: requirementConfirmation(),
      },
    });
    expect(started.isError).not.toBe(true);
    expect(started.structuredContent).toMatchObject({ status: "PASS", phase: "PRODUCT_FRAMING" });
    expect(JSON.stringify(started.structuredContent)).not.toMatch(/principles|patterns|knowledge/);

    const malformed = await client.callTool({ name: "design_frame", arguments: { product_frame: {} } });
    expect(malformed.isError).toBe(true);
    expect(JSON.stringify(malformed.content)).toContain("design_session_id");
  } finally {
    await client.close();
  }
});
