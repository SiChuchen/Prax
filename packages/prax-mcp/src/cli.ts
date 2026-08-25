#!/usr/bin/env node
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { FileSessionStore, defaultPraxStateRoot } from "prax-runtime";
import { loadBuiltInKnowledgeStore } from "prax-knowledge";
import { PraxService } from "./service.js";

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage(): never {
  process.stderr.write("Usage: prax <inspect SESSION_ID | validate SESSION_ID | doctor>\n");
  process.exit(2);
}

async function doctor(): Promise<Record<string, unknown>> {
  const checks: Array<{ name: string; status: "PASS" | "BLOCK"; detail: string }> = [];
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  checks.push({
    name: "node_runtime",
    status: nodeMajor >= 20 ? "PASS" : "BLOCK",
    detail: `Node ${process.versions.node}; Prax requires Node >=20`,
  });

  try {
    const knowledge = await loadBuiltInKnowledgeStore();
    checks.push({ name: "knowledge_pack", status: knowledge.size() >= 20 ? "PASS" : "BLOCK", detail: `${knowledge.size()} validated entries` });
  } catch (error) {
    checks.push({ name: "knowledge_pack", status: "BLOCK", detail: error instanceof Error ? error.message : String(error) });
  }

  try {
    const stateRoot = defaultPraxStateRoot();
    await mkdir(stateRoot, { recursive: true });
    await access(stateRoot, constants.R_OK | constants.W_OK);
    checks.push({ name: "state_store", status: "PASS", detail: stateRoot });
  } catch (error) {
    checks.push({ name: "state_store", status: "BLOCK", detail: error instanceof Error ? error.message : String(error) });
  }

  checks.push({ name: "mcp_protocol", status: "PASS", detail: "@modelcontextprotocol/server v2 / MCP 2026-07-28" });
  return { status: checks.some((check) => check.status === "BLOCK") ? "BLOCK" : "PASS", server: "Prax MCP", version: "0.1.0", checks };
}

const [command, sessionId, ...rest] = process.argv.slice(2);
if (command === undefined || rest.length > 0) usage();

if (command === "doctor") {
  const result = await doctor();
  print(result);
  if (result.status === "BLOCK") process.exitCode = 1;
} else if (command === "inspect") {
  if (sessionId === undefined) usage();
  const service = await PraxService.create({ sessions: new FileSessionStore() });
  print(await service.inspectSession(sessionId));
} else if (command === "validate") {
  if (sessionId === undefined) usage();
  const service = await PraxService.create({ sessions: new FileSessionStore() });
  const result = await service.designValidate({ design_session_id: sessionId, mode: "evaluate" });
  print(result);
  if (result.status === "BLOCK" || result.status === "RETRY") process.exitCode = 1;
} else {
  usage();
}
