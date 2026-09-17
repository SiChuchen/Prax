#!/usr/bin/env node
/**
 * M3 single-run launcher/monitor (plan 2026-09-06 Task 4; addendum D5).
 *
 *   node run-one.mjs <run-NN> <workspace-name>
 *   e.g. node run-one.mjs 01 cell-j07-s07-b
 *
 * Pre-checks the frozen workspace, launches ONE fresh non-interactive claude
 * session at the workspace cwd with exactly the frozen arm prompt (stdin),
 * streams stream-json to the run package transcript, enforces the 90-minute
 * wall-clock and 1.2M observable-token budgets (addendum D5 accounting), and
 * records stop metadata. Packaging is a separate script (package-one.mjs).
 * Exit 0 = session ran to a stop condition (check run-metadata for which).
 */
import { spawn, execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const [runArg, ws] = process.argv.slice(2);
if (!runArg || !ws) {
  console.error("usage: run-one.mjs <run-NN> <workspace-name>");
  process.exit(2);
}
const run = `run-${runArg}`;
const arm = ws.endsWith("-b") ? "b" : "a";
const cell = ws.slice(0, -2);
const PI = "E:/codex-prj/ab-worktrees/pi-matrix-r2";
const OP = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r2-20260909";
const REPO = "E:/codex-prj/Prax/Prax";
const workspace = `${PI}/${ws}`;
const pkg = `${REPO}/benchmark-runs/product-intelligence-matrix/${cell}/m3/m3-r2-20260909-${run}-${arm}`;
const WALL_LIMIT_S = 90 * 60;
const TOKEN_LIMIT = 1_200_000;

const log = (...a) => console.error(new Date().toISOString(), JSON.stringify(a));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const opEv = (obj) =>
  appendFileSync(`${OP}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");

// ---- pre-run checks (m3-runbook step 1 + frozen hashes) --------------------
const report = JSON.parse(readFileSync(`${OP}/launch/prepare-launch-report.json`, "utf8"));
const wsReport = report.workspaces.find((w) => w.ws === ws);
if (!wsReport) throw new Error(`${ws}: not in prepare-launch-report`);
if (!existsSync(`${workspace}/brief.md`)) throw new Error(`${ws}: brief.md missing`);
const briefNow = sha256(readFileSync(`${workspace}/brief.md`));
if (briefNow !== wsReport.brief_sha256) throw new Error(`${ws}: brief hash drifted: ${briefNow}`);
if (arm === "a") {
  if (existsSync(`${workspace}/.prax`)) throw new Error(`${ws}: .prax present in Arm A`);
  const entries = readdirSync(workspace).sort();
  const expected = [".git", "brief.md"].sort();
  if (JSON.stringify(entries) !== JSON.stringify(expected)) {
    throw new Error(`${ws}: Arm A workspace contents unexpected: ${entries.join(", ")}`);
  }
} else {
  const mcp = JSON.parse(readFileSync(`${workspace}/.mcp.json`, "utf8"));
  if (!mcp.mcpServers?.prax?.args?.[0].endsWith("pi-m3-frozen-runtime-20260906/packages/prax-mcp/dist/stdio.js")) {
    throw new Error(`${ws}: .mcp.json not bound to frozen runtime`);
  }
  if (existsSync(`${workspace}/.prax`)) throw new Error(`${ws}: stale .prax before run`);
}

// ---- package skeleton ------------------------------------------------------
mkdirSync(`${pkg}/execution`, { recursive: true });
const events = createWriteStream(`${pkg}/execution/events.ndjson`, { flags: "a" });
const ev = (obj) => events.write(JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");

ev({ kind: "session_start", run, cell, arm, workspace });
opEv({ kind: "run_start", run, cell, arm });

// ---- launch ----------------------------------------------------------------
const prompt = readFileSync(`${OP}/launch/${ws}-prompt.md`);
const mcpArg = arm === "a" ? `${OP}/launch/mcp-config-empty.json` : `${workspace.replace(/\//g, "\\")}\\.mcp.json`;
const args = [
  "/d", "/s", "/c", "claude",
  "--print",
  "--strict-mcp-config", "--mcp-config", mcpArg,
  "--model", "sonnet",
  "--dangerously-skip-permissions",
  "--output-format", "stream-json", "--verbose",
];
const startedMs = Date.now();
const child = spawn(process.env.ComSpec || "cmd.exe", args, {
  cwd: workspace,
  stdio: ["pipe", "pipe", "pipe"],
});
child.stdin.write(prompt);
child.stdin.end();
let childStdout = createWriteStream(`${pkg}/execution/session-transcript.jsonl`, { flags: "a" });
child.stdout.pipe(childStdout);

let sessionId = null;
let stopReason = null;
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "system" && msg.subtype === "init") {
        sessionId = msg.session_id ?? null;
        log("init", sessionId, "mcp:", (msg.mcp_servers ?? []).map((m) => `${m.name}:${m.status}`).join(","));
      }
      // Per-message usage does not exist in this CLI/backend stream; token
      // totals come from result.modelUsage at exit (addendum D5 v2).
    } catch { /* non-JSON line — kept in raw transcript */ }
  }
});
child.stderr.on("data", (c) => log("cli_stderr:", c.toString().trim().slice(0, 300)));

const forceKill = () => {
  try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" }); } catch { /* already gone */ }
};

const timer = setInterval(() => {
  const elapsedS = (Date.now() - startedMs) / 1000;
  // Live guard: wall clock only (D5 v2: token cap is retrospective from
  // result.modelUsage because per-message usage is absent from the stream).
  if (elapsedS >= WALL_LIMIT_S) {
    stopReason = "budget_exceeded_wall_clock";
    log("STOP wall clock", Math.round(elapsedS), "s");
    forceKill();
  } else if (Math.round(elapsedS) % 300 === 0) {
    log("progress", Math.round(elapsedS) + "s");
  }
}, 1000);

child.on("exit", (code) => {
  clearInterval(timer);
  childStdout.end();
  const endedMs = Date.now();
  const wall = Math.round((endedMs - startedMs) / 1000);
  // Parse the transcript for the result event.
  let result = null;
  try {
    const raw = readFileSync(`${pkg}/execution/session-transcript.jsonl`, "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === "result") result = msg;
      } catch { /* ignore */ }
    }
  } catch { /* transcript unreadable — recorded as missing */ }
  if (!stopReason) {
    if (result?.is_error) stopReason = "cli_result_error";
    else if (result) stopReason = "agent_completed";
    else stopReason = code === 0 ? "agent_completed_no_result_event" : `cli_exit_${code}`;
  }
  // D5 v2 token totals from result.modelUsage (authoritative, retrospective).
  let tokensIn = 0, tokensOut = 0, cacheRead = 0, cacheCreation = 0, costUsd = 0;
  for (const v of Object.values(result?.modelUsage ?? {})) {
    tokensIn += v.inputTokens ?? 0;
    tokensOut += v.outputTokens ?? 0;
    cacheRead += v.cacheReadInputTokens ?? 0;
    cacheCreation += v.cacheCreationInputTokens ?? 0;
    costUsd += v.costUSD ?? 0;
  }
  const tokenInOut = tokensIn + tokensOut;
  const tokensObservable = result !== null && result?.modelUsage !== undefined;
  const meta = {
    run, cell, arm, workspace,
    started_at: new Date(startedMs).toISOString(),
    ended_at: new Date(endedMs).toISOString(),
    wall_clock_seconds: wall,
    stop_reason: stopReason,
    cli_exit_code: code,
    session_id: sessionId,
    observable_tokens: tokensObservable ? {
      accounting: "addendum D5 v2: modelUsage input+output; cache listed separately; cap evaluated retrospectively (1.2M)",
      input_tokens: tokensIn,
      output_tokens: tokensOut,
      token_in_out: tokenInOut,
      token_budget_status: tokenInOut > TOKEN_LIMIT ? "token_budget_exceeded_retrospective" : "within_budget",
      cache_read_input_tokens: cacheRead,
      cache_creation_input_tokens: cacheCreation,
      cost_usd: Math.round(costUsd * 1000) / 1000,
      result_usage: result?.usage ?? null,
    } : {
      accounting: "addendum D5 v2",
      status: "not_observable",
      reason: `no result event: process stopped (${stopReason}) before the CLI emitted modelUsage`,
      input_tokens: null, output_tokens: null, token_in_out: null,
      token_budget_status: "not_observable", cache_read_input_tokens: null, cost_usd: null,
    },
    num_turns: result?.num_turns ?? null,
    result_subtype: result?.subtype ?? null,
  };
  writeFileSync(`${pkg}/execution/run-metadata.json`, JSON.stringify(meta, null, 2));
  ev({ kind: "session_end", stop_reason: stopReason, wall_clock_seconds: wall, cli_exit_code: code, session_id: sessionId });
  if (stopReason === "agent_completed") ev({ kind: "first_pass", note: "single planned pass; agent declared completion in -p mode" });
  opEv({ kind: "run_end", run, stop_reason: stopReason, wall_clock_seconds: wall, token_in_out: tokenInOut, cost_usd: Math.round(costUsd * 1000) / 1000 });
  log("DONE", stopReason, wall + "s", tokenInOut, "in+out tokens, session", sessionId);
  events.end();
});
