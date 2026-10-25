#!/usr/bin/env node
/**
 * m5p1-verify single-slot executor (protocol.md §2/§5).
 *   node m5p1-run.mjs <slot> <arm>      e.g. node m5p1-run.mjs s2 e1
 * Single round; MCP_TIMEOUT=180000 both arms; idempotent (package-only
 * resume when a transcript with an agent turn exists; safe relaunch when it
 * does not). Packaging adds the G1b stall-phenotype extraction
 * (validation_loop history incl. zero-entry count, stall transcript events,
 * validate call count) on top of m5's G1/G2/G3 fields.
 */
import { spawn, execSync, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const [slot, arm] = process.argv.slice(2);
if (!slot || !arm) { console.error("usage: m5p1-run.mjs <slot> <arm>"); process.exit(2); }
const M = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m5p1-verify-20261025";
const OP3 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const WSR = "E:/codex-prj/ab-worktrees/pi-matrix-m5p1";
const RT = "E:/codex-prj/pi-m5p1-frozen-runtime-20261025"; // operator measurement stack (prax-measure bytes identical across snapshots)
const ws = `${WSR}/${slot}-${arm}`;
const pkg = `${M}/runs/${slot}-${arm}`;
const WALL_TOTAL_S = 90 * 60;
const TOKEN_LIMIT = 1_200_000;
const log = (...a) => console.error(new Date().toISOString(), JSON.stringify(a));
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const opEv = (obj) => appendFileSync(`${M}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");

const report = JSON.parse(readFileSync(`${M}/launch/prepare-launch-report.json`, "utf8"));
const wsRep = report.workspaces.find((w) => w.slot === slot && w.arm === arm);
if (!wsRep) throw new Error(`${slot}-${arm}: not in prepare-launch-report`);
const promptPath = `${M}/launch/${wsRep.cell}-b-prompt.md`;
if (sha256(promptPath) !== wsRep.prompt_sha256) throw new Error(`${slot}: prompt hash drifted`);
if (sha256(`${ws}/brief.md`) !== wsRep.brief_sha256) throw new Error(`${slot}: brief hash drifted`);
if (existsSync(`${ws}/.prax`) && !existsSync(`${pkg}/execution/run-metadata.json`)) {
  throw new Error(`${slot}: stale .prax before run`);
}
mkdirSync(`${pkg}/execution`, { recursive: true });
const events = `${pkg}/execution/events.ndjson`;
const transcriptName = "session-transcript-r1.jsonl";
const tPath = `${pkg}/execution/${transcriptName}`;

function playwrightVersion() {
  for (const p of [`${RT}/node_modules/playwright/package.json`, `${RT}/packages/prax-measure/node_modules/playwright/package.json`]) {
    if (existsSync(p)) { try { return JSON.parse(readFileSync(p, "utf8")).version; } catch { /* next */ } }
  }
  return "not_found";
}
const PW_VERSION = playwrightVersion();

function transcriptHasAgentTurn(t) {
  try { return readFileSync(t, "utf8").split("\n").some((l) => l.includes('"type":"assistant"')); } catch { return false; }
}
function parseTranscript(t) {
  let result = null, sessionId = null, modelString = null;
  for (const line of readFileSync(t, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "system" && msg.subtype === "init") sessionId = msg.session_id ?? sessionId;
      if (msg.type === "assistant" && msg.message?.model) modelString = msg.message.model;
      if (msg.type === "result") result = msg;
    } catch { /* raw line */ }
  }
  return { result, sessionId, modelString };
}
function launchRound(deadlineMs) {
  return new Promise((resolve) => {
    const args = ["/d", "/s", "/c", "claude", "--print",
      "--strict-mcp-config", "--mcp-config", `${ws}\\.mcp.json`,
      "--model", "sonnet", "--dangerously-skip-permissions",
      "--output-format", "stream-json", "--verbose"];
    const startedMs = Date.now();
    const child = spawn(process.env.ComSpec || "cmd.exe", args, {
      cwd: ws, stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, MSYS_NO_PATHCONV: "1", MCP_TIMEOUT: "180000" },
    });
    child.stdin.write(readFileSync(promptPath)); child.stdin.end();
    const out = createWriteStream(tPath, { flags: "w" });
    child.stdout.pipe(out);
    let stopReason = null;
    child.stderr.on("data", (c) => log("cli_stderr:", c.toString().trim().slice(0, 300)));
    const forceKill = () => { try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" }); } catch { /* gone */ } };
    const timer = setInterval(() => { if (Date.now() >= deadlineMs) { stopReason = "budget_exceeded_wall_clock"; forceKill(); } }, 1000);
    child.on("exit", (code) => {
      clearInterval(timer); out.end();
      const wall = Math.round((Date.now() - startedMs) / 1000);
      const { result, sessionId, modelString } = parseTranscript(tPath);
      if (!stopReason) {
        if (result?.is_error) stopReason = "cli_result_error";
        else if (result) stopReason = "agent_completed";
        else stopReason = code === 0 ? "agent_completed_no_result_event" : `cli_exit_${code}`;
      }
      resolve({ code, wall, result, sessionId, modelString, stopReason });
    });
  });
}

appendFileSync(events, JSON.stringify({ ts: new Date().toISOString(), kind: "m5p1_start", slot, arm, cell: wsRep.cell, runtime: wsRep.runtime_manifest }) + "\n");
opEv({ kind: "m5p1_run_start", slot, arm, cell: wsRep.cell, runtime: wsRep.runtime_manifest });

const deadline = Date.now() + WALL_TOTAL_S * 1000;
let round1;
if (existsSync(tPath) && transcriptHasAgentTurn(tPath)) {
  log("transcript exists with agent turn — package-only resume");
  opEv({ kind: "package_only_resume", slot, arm });
  const p = parseTranscript(tPath);
  round1 = { code: 0, wall: 0, result: p.result, sessionId: p.sessionId, modelString: p.modelString, stopReason: p.result ? (p.result.is_error ? "cli_result_error" : "agent_completed_resume_packaged") : "no_result_event_resume_packaged" };
} else {
  if (existsSync(tPath)) { opEv({ kind: "launch_retry_no_agent_turn", slot, arm }); log("failed launch detected (no agent turn) — relaunching"); }
  round1 = await launchRound(deadline);
}
log("round1 done", round1.stopReason, round1.wall + "s", round1.sessionId);

mkdirSync(`${pkg}/input`, { recursive: true });
cpSync(`${ws}/brief.md`, `${pkg}/input/brief.md`);
if (existsSync(`${ws}/.prax`)) cpSync(`${ws}/.prax`, `${pkg}/input/prax-artifacts`, { recursive: true });
if (existsSync(`${ws}/.mcp.json`)) cpSync(`${ws}/.mcp.json`, `${pkg}/input/mcp.json`);

function praxState(artRoot) {
  const sessRoot = join(artRoot, "design", "sessions");
  if (!existsSync(sessRoot)) return { phase: null, gates: 0, loopAttempts: null, selfReceipts: 0, sessionId: null, loopHistory: [], zeroEntries: 0 };
  const ids = readdirSync(sessRoot).filter((d) => !d.startsWith("."));
  const primary = ids.map((id) => ({ id, m: statSync(join(sessRoot, id)).mtimeMs })).sort((a, b) => b.m - a.m)[0]?.id ?? null;
  if (!primary) return { phase: null, gates: 0, loopAttempts: null, selfReceipts: 0, sessionId: null, loopHistory: [], zeroEntries: 0 };
  const dir = join(sessRoot, primary);
  const sess = readFileSync(join(dir, "session.yaml"), "utf8");
  const phase = (sess.match(/^phase: (.*)$/m) ?? [])[1] ?? null;
  const gates = (sess.match(/^completed_gates:\n((?:  - .*\n)+)/m) ?? [])[1]?.split("\n").filter((l) => l.startsWith("  - ")).length ?? 0;
  let loopAttempts = null;
  const vrPath = join(dir, "validation-report.yaml");
  if (existsSync(vrPath)) {
    const m = readFileSync(vrPath, "utf8").match(/measurement_loop:\n(?:.|\n)*?attempts: (\d+)/);
    if (m) loopAttempts = +m[1];
  }
  let selfReceipts = 0;
  const ve = join(dir, "validation-evidence");
  if (existsSync(ve)) selfReceipts = readdirSync(ve).filter((f) => f.startsWith("receipt-")).length;
  const loopHistory = [...sess.matchAll(/- evaluated_at: [^\n]+\n\s+open_findings: (\d+)/g)].map((m) => +m[1]);
  return { phase, gates, loopAttempts, selfReceipts, sessionId: primary, loopHistory, zeroEntries: loopHistory.filter((n) => n === 0).length };
}
const g1 = praxState(`${pkg}/input/prax-artifacts`);

let fixRequired = 0, unavailable = 0, stallEvents = 0, validateCalls = 0;
try {
  const raw = readFileSync(tPath, "utf8");
  for (const line of raw.split("\n")) {
    if (line.includes("MEASUREMENT_FIX_REQUIRED")) fixRequired++;
    if (line.includes("MEASUREMENT_UNAVAILABLE")) unavailable++;
    if (line.includes("VALIDATION_CONVERGENCE_STALLED")) stallEvents++;
    if (line.includes('"name":"mcp__prax__design_validate"')) validateCalls++;
  }
} catch { /* unreadable */ }

function stageAndMeasure(stageDir, outDir) {
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  cpSync(ws, stageDir, {
    recursive: true,
    filter: (src) => {
      const rel = relative(ws, src).replace(/\\/g, "/");
      if (rel === ".") return true;
      if (rel === ".git" || rel.startsWith(".git/") || rel === ".prax" || rel.startsWith(".prax/") ||
          rel === "node_modules" || rel.startsWith("node_modules/") || rel === ".mcp.json" ||
          rel === "dist" || rel.startsWith("dist/")) return false;
      return true;
    },
  });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync(process.execPath, [
    `${RT}/packages/prax-measure/bin/prax-measure.mjs`,
    "--app", stageDir, "--out", outDir, "--entry", "/", "--scenario", "entry",
    "--viewports", "1280x860,1440x900",
  ], { encoding: "utf8", timeout: 5 * 60_000, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  return { exit: r.status, stdout: r.stdout || "", stderr: (r.stderr || "").slice(-400), outDir };
}
const CHECK_IDS = ["a11y.contrast", "a11y.focus_order", "a11y.target_size", "layout.overflow", "layout.responsive_collision", "text.truncation", "type.min_projected_size"];
function parseChecks(stdout) {
  const checks = {};
  for (const m of stdout.matchAll(/^\s*(pass|fail|skipped(?:\s*\([^)]*\))?)\s+([a-z0-9_.]+)\s*$/gm)) checks[m[2]] = m[1];
  const sm = stdout.match(/summary:\s*pass=(\d+)\s+fail=(\d+)\s+skipped=(\d+)/);
  if (sm) {
    const listed = Object.keys(checks).length;
    if (+sm[1] + +sm[2] + +sm[3] === 7 && listed === +sm[2] + +sm[3]) {
      for (const id of CHECK_IDS) if (!(id in checks)) checks[id] = "pass";
    }
  }
  return checks;
}
function measured(stageDir, outDir) {
  let r = stageAndMeasure(stageDir, outDir);
  if (r.exit !== 0 && r.exit !== 1) { log("measurement invalid (exit", r.exit, "), retrying once"); r = stageAndMeasure(stageDir, outDir); }
  return r;
}
const finalMeasure = measured(`${pkg}/measurement-root`, `${pkg}/validation-evidence`);
const finalChecks = parseChecks(finalMeasure.stdout);

const srcDir = `${pkg}/implementation/source`;
rmSync(`${pkg}/implementation`, { recursive: true, force: true });
mkdirSync(srcDir, { recursive: true });
cpSync(ws, srcDir, {
  recursive: true,
  filter: (src) => {
    const rel = relative(ws, src).replace(/\\/g, "/");
    if (rel === ".") return true;
    if (rel === ".git" || rel.startsWith(".git/") || rel === ".prax" || rel.startsWith(".prax/") ||
        rel === "node_modules" || rel.startsWith("node_modules/") || rel === ".mcp.json") return false;
    return true;
  },
});
const hashes = {}; const files = [];
const walk = (dir) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) walk(p); else { files.push(p); hashes[relative(srcDir, p).replace(/\\/g, "/")] = sha256(p); } } };
walk(srcDir);
writeFileSync(`${pkg}/implementation/file-hashes.json`, JSON.stringify(hashes, null, 2));
writeFileSync(`${pkg}/implementation/changed-files.txt`, files.map((f) => relative(srcDir, f).replace(/\\/g, "/")).sort().join("\n") + "\n");

const screens = spawnSync(process.execPath, [`${OP3}/tools/capture-screens.mjs`, `${pkg}/measurement-root`, `${pkg}/evidence/screenshots`, `m5p1-${slot}-${arm}`], { encoding: "utf8", timeout: 2 * 60_000, cwd: RT, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });

let tIn = 0, tOut = 0, cacheRead = 0, cacheCreation = 0, costUsd = 0;
for (const v of Object.values(round1.result?.modelUsage ?? {})) {
  tIn += v.inputTokens ?? 0; tOut += v.outputTokens ?? 0;
  cacheRead += v.cacheReadInputTokens ?? 0; cacheCreation += v.cacheCreationInputTokens ?? 0;
  costUsd += v.costUSD ?? 0;
}
const tokenInOut = tIn + tOut;
const meta = {
  batch: "m5p1-verify-20261025", slot, arm, cell: wsRep.cell, runtime_manifest: wsRep.runtime_manifest,
  started_at: new Date(Date.now() - round1.wall * 1000).toISOString(), ended_at: new Date().toISOString(),
  wall_clock_seconds: round1.wall, wall_limit: WALL_TOTAL_S,
  stop_reason: round1.stopReason, cli_exit_code: round1.code, session_id: round1.sessionId,
  model_string: round1.modelString, playwright_version: PW_VERSION,
  observable_tokens: { input_tokens: tIn, output_tokens: tOut, token_in_out: tokenInOut, token_budget_status: tokenInOut > TOKEN_LIMIT ? "token_budget_exceeded_retrospective" : "within_budget", cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheCreation, cost_usd: Math.round(costUsd * 1000) / 1000 },
  g1_phase: g1.phase, g1_gates_completed: g1.gates, prax_used: g1.phase !== null,
  g1b_stall: { loop_history: g1.loopHistory, zero_entries: g1.zeroEntries, stall_events: stallEvents, phenotype: stallEvents > 0 ? (g1.zeroEntries > 0 ? "zero_stall" : "findings_stall") : (g1.phase === "COMPLETE" ? "closed" : "no_stall") },
  g2_checks: finalChecks,
  g3_engagement: { measurement_loop_attempts: g1.loopAttempts, fix_required_events: fixRequired, unavailable_events: unavailable, self_run_receipts: g1.selfReceipts, validate_calls: validateCalls },
  measurement: { final_exit_code: finalMeasure.exit, checks: finalChecks, stdout_tail: finalMeasure.stdout.slice(-500) },
};
writeFileSync(`${pkg}/execution/run-metadata.json`, JSON.stringify(meta, null, 2));
appendFileSync(events, JSON.stringify({ ts: new Date().toISOString(), kind: "m5p1_end", slot, arm, stop_reason: meta.stop_reason, phase: g1.phase, wall_clock_seconds: round1.wall, token_in_out: tokenInOut, cost_usd: meta.observable_tokens.cost_usd, checks: finalChecks, stall: meta.g1b_stall, engagement: meta.g3_engagement }) + "\n");
opEv({ kind: "m5p1_run_end", slot, arm, stop_reason: meta.stop_reason, phase: g1.phase, wall_clock_seconds: round1.wall, token_in_out: tokenInOut, cost_usd: meta.observable_tokens.cost_usd, checks: finalChecks, stall: meta.g1b_stall, engagement: meta.g3_engagement });
log("DONE", slot, arm, meta.stop_reason, "phase=" + g1.phase, "stall=" + JSON.stringify(meta.g1b_stall), round1.wall + "s", tokenInOut, "tokens", JSON.stringify(finalChecks));
