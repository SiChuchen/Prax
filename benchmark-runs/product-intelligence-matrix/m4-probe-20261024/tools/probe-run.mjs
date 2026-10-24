#!/usr/bin/env node
/**
 * M4 probe single-slot executor (protocol.md §2/§4).
 *
 *   node probe-run.mjs <slot> <arm>     e.g. node probe-run.mjs s6 p3
 *
 * Round 1: fresh non-interactive claude session at the workspace cwd with the
 * arm's frozen prompt (P2 = b-prompt + Appendix A). Rounds=2 arms (P3/P3p):
 * after round 1 completes, stage a workspace COPY (D8v2 Case R), run
 * prax-measure on the copy, build the frozen F1 (P3, check results only) or
 * F2 (P3p, placebo) message, resume the same session (`claude --resume`), and
 * sum wall/tokens across rounds against the combined 90-min / 1.2M budget.
 * Then packages: source snapshot, final staged measurement, screenshots,
 * run-metadata (model string + playwright fingerprint included), summary.
 * Exit 0 = slot reached a stop condition (see metadata).
 */
import { spawn, execSync, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const [slot, arm] = process.argv.slice(2);
if (!slot || !arm) { console.error("usage: probe-run.mjs <slot> <arm>"); process.exit(2); }
const M4 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m4-probe-20261024";
const OP3 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const PI4 = "E:/codex-prj/ab-worktrees/pi-matrix-m4";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const ws = `${PI4}/${slot}-${arm}`;
const pkg = `${M4}/runs/${slot}-${arm}`;
const ROUNDS = arm === "p3" || arm === "p3p" ? 2 : 1;
const WALL_TOTAL_S = 90 * 60;
const TOKEN_LIMIT = 1_200_000;
const log = (...a) => console.error(new Date().toISOString(), JSON.stringify(a));
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const opEv = (obj) => appendFileSync(`${M4}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");

// ---- pre-run checks ---------------------------------------------------------
const report = JSON.parse(readFileSync(`${M4}/launch/prepare-launch-report.json`, "utf8"));
const wsRep = report.workspaces.find((w) => w.slot === slot && w.arm === arm);
if (!wsRep) throw new Error(`${slot}-${arm}: not in prepare-launch-report`);
if (sha256(`${ws}/brief.md`) !== wsRep.brief_sha256) throw new Error(`${slot}: brief hash drifted`);
if (sha256(`${M4}/launch/${wsRep.prompt_file}`) !== wsRep.prompt_sha256) throw new Error(`${slot}: prompt hash drifted`);
if (existsSync(`${ws}/.prax`) && !existsSync(`${pkg}/execution`)) {
  // fresh run must start clean; a resumed packaging pass (execution exists) keeps state
  throw new Error(`${slot}: stale .prax before run`);
}
mkdirSync(`${pkg}/execution`, { recursive: true });
const events = `${pkg}/execution/events.ndjson`;
appendFileSync(events, JSON.stringify({ ts: new Date().toISOString(), kind: "probe_start", slot, arm, rounds: ROUNDS }) + "\n");
opEv({ kind: "probe_run_start", slot, arm, rounds: ROUNDS });

// ---- fingerprints (comparability checklist) ----------------------------------
function playwrightVersion() {
  for (const p of [`${FROZEN}/node_modules/playwright/package.json`, `${FROZEN}/packages/prax-measure/node_modules/playwright/package.json`]) {
    if (existsSync(p)) { try { return JSON.parse(readFileSync(p, "utf8")).version; } catch { /* next */ } }
  }
  return "not_found";
}
const PW_VERSION = playwrightVersion();

// ---- claude launch helper -----------------------------------------------------
const mcpArg = arm === "p0" ? `${OP3}/launch/mcp-config-empty.json` : `${ws.replace(/\//g, "\\")}\\.mcp.json`;
function launchRound(promptBuf, transcriptName, resumeSid, deadlineMs) {
  return new Promise((resolve) => {
    const args = ["/d", "/s", "/c", "claude", "--print",
      "--strict-mcp-config", "--mcp-config", mcpArg,
      "--model", "sonnet", "--dangerously-skip-permissions",
      "--output-format", "stream-json", "--verbose"];
    if (resumeSid) args.push("--resume", resumeSid);
    const startedMs = Date.now();
    const child = spawn(process.env.ComSpec || "cmd.exe", args, { cwd: ws, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.write(promptBuf); child.stdin.end();
    const tPath = `${pkg}/execution/${transcriptName}`;
    const out = createWriteStream(tPath, { flags: "w" });
    child.stdout.pipe(out);
    let sessionId = resumeSid ?? null, modelString = null, buffer = "", stopReason = null;
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let nl;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl); buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "system" && msg.subtype === "init") sessionId = msg.session_id ?? sessionId;
          if (msg.type === "assistant" && msg.message?.model) modelString = msg.message.model;
        } catch { /* raw line */ }
      }
    });
    child.stderr.on("data", (c) => log("cli_stderr:", c.toString().trim().slice(0, 300)));
    const forceKill = () => { try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" }); } catch { /* gone */ } };
    const timer = setInterval(() => {
      if (Date.now() >= deadlineMs) { stopReason = "budget_exceeded_wall_clock"; forceKill(); }
    }, 1000);
    child.on("exit", (code) => {
      clearInterval(timer); out.end();
      const wall = Math.round((Date.now() - startedMs) / 1000);
      let result = null;
      try {
        const raw = readFileSync(tPath, "utf8");
        for (const line of raw.split("\n")) {
          if (!line.trim()) continue;
          try { const msg = JSON.parse(line); if (msg.type === "result") result = msg; } catch { /* */ }
        }
      } catch { /* unreadable */ }
      if (!stopReason) {
        if (result?.is_error) stopReason = "cli_result_error";
        else if (result) stopReason = "agent_completed";
        else stopReason = code === 0 ? "agent_completed_no_result_event" : `cli_exit_${code}`;
      }
      resolve({ code, wall, result, sessionId, modelString, stopReason, transcript: transcriptName });
    });
  });
}

// ---- measurement helper --------------------------------------------------------
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
    `${FROZEN}/packages/prax-measure/bin/prax-measure.mjs`,
    "--app", stageDir, "--out", outDir, "--entry", "/", "--scenario", "entry",
    "--viewports", "1280x860,1440x900",
  ], { encoding: "utf8", timeout: 5 * 60_000, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  return { exit: r.status, stdout: r.stdout || "", stderr: (r.stderr || "").slice(-400), outDir };
}
const CHECK_IDS = ["a11y.contrast", "a11y.focus_order", "a11y.target_size", "layout.overflow", "layout.responsive_collision", "text.truncation", "type.min_projected_size"];
function parseChecks(stdout) {
  const checks = {};
  for (const m of stdout.matchAll(/^\s*(pass|fail|skipped(?:\s*\([^)]*\))?)\s+([a-z0-9_.]+)\s*$/gm)) {
    checks[m[2]] = m[1];
  }
  // prax-measure prints per-check lines only for fail/skipped. When the summary
  // accounts for all 7 checks and the listed lines account for fail+skipped,
  // every unlisted id passed — derive explicit pass entries from the full set.
  const sm = stdout.match(/summary:\s*pass=(\d+)\s+fail=(\d+)\s+skipped=(\d+)/);
  if (sm) {
    const listed = Object.keys(checks).length;
    if (+sm[1] + +sm[2] + +sm[3] === 7 && listed === +sm[2] + +sm[3]) {
      for (const id of CHECK_IDS) if (!(id in checks)) checks[id] = "pass";
    }
  }
  return checks;
}
function receiptDetail(outDir) {
  let ratios = [], sizes = [];
  try {
    for (const f of readdirSync(`${outDir}/validation-evidence`).filter((f) => f.startsWith("receipt-"))) {
      const t = readFileSync(`${outDir}/validation-evidence/${f}`, "utf8");
      for (const m of t.matchAll(/"ratio"\s*:\s*([0-9.]+)/g)) ratios.push(parseFloat(m[1]));
      for (const m of t.matchAll(/(?:smallest|fontSize|"size")[^0-9]{0,12}([0-9.]+)/g)) sizes.push(parseFloat(m[1]));
    }
  } catch { /* none */ }
  return { minRatio: ratios.length ? Math.min(...ratios) : null, smallestPx: sizes.length ? Math.min(...sizes) : null };
}
// Protocol §4: an invalid measurement (exit not 0 and not 1) is retried exactly once.
function measured(stageDir, outDir) {
  let r = stageAndMeasure(stageDir, outDir);
  if (r.exit !== 0 && r.exit !== 1) {
    log("measurement invalid (exit", r.exit, "), retrying once");
    r = stageAndMeasure(stageDir, outDir);
  }
  return r;
}

// ---- execute rounds --------------------------------------------------------------
const promptPath = `${M4}/launch/${wsRep.prompt_file}`;
const promptBuf = readFileSync(promptPath);
const deadline = Date.now() + WALL_TOTAL_S * 1000;
const round1 = await launchRound(promptBuf, "session-transcript-r1.jsonl", null, deadline);
log("round1 done", round1.stopReason, round1.wall + "s", round1.sessionId);

let round2 = null, midflight = null, feedbackMessage = null;
if (ROUNDS === 2 && round1.stopReason === "agent_completed" && round1.sessionId) {
  midflight = measured(`${pkg}/midflight-root`, `${pkg}/midflight-evidence`);
  const checks = parseChecks(midflight.stdout);
  const det = receiptDetail(`${pkg}/midflight-evidence`);
  const line = (id) => checks[id] ?? "not_run";
  if (arm === "p3") {
    feedbackMessage =
`Automated browser checks ran against your implementation. Results:
a11y.contrast: ${line("a11y.contrast")}${det.minRatio != null && line("a11y.contrast").startsWith("fail") ? ` (measured min ratio ${det.minRatio})` : ""}
a11y.focus_order: ${line("a11y.focus_order")}
a11y.target_size: ${line("a11y.target_size")}
type.min_projected_size: ${line("type.min_projected_size")}${det.smallestPx != null && line("type.min_projected_size").startsWith("fail") ? ` (smallest ${det.smallestPx}px)` : ""}
Fix the failing checks. Do not refactor working behavior.`;
  } else {
    feedbackMessage = "Run one final review pass of your implementation against the brief and fix anything you find. Do not refactor working behavior.";
  }
  writeFileSync(`${pkg}/execution/round2-feedback.txt`, feedbackMessage);
  appendFileSync(events, JSON.stringify({ ts: new Date().toISOString(), kind: "midflight_measure", exit: midflight.exit, checks }) + "\n");
  round2 = await launchRound(Buffer.from(feedbackMessage), "session-transcript-r2.jsonl", round1.sessionId, deadline);
  log("round2 done", round2.stopReason, round2.wall + "s");
}

// ---- final packaging --------------------------------------------------------------
const rounds = [round1, ...(round2 ? [round2] : [])];
const wallTotal = rounds.reduce((a, r) => a + r.wall, 0);
let tIn = 0, tOut = 0, cacheRead = 0, cacheCreation = 0, costUsd = 0;
for (const r of rounds) for (const v of Object.values(r.result?.modelUsage ?? {})) {
  tIn += v.inputTokens ?? 0; tOut += v.outputTokens ?? 0;
  cacheRead += v.cacheReadInputTokens ?? 0; cacheCreation += v.cacheCreationInputTokens ?? 0;
  costUsd += v.costUSD ?? 0;
}
const tokenInOut = tIn + tOut;

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

const finalMeasure = measured(`${pkg}/measurement-root`, `${pkg}/validation-evidence`);
const finalChecks = parseChecks(finalMeasure.stdout);
const screens = spawnSync(process.execPath, [`${OP3}/tools/capture-screens.mjs`, `${pkg}/measurement-root`, `${pkg}/evidence/screenshots`, `m4-${slot}-${arm}`], { encoding: "utf8", timeout: 2 * 60_000, cwd: FROZEN, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });

mkdirSync(`${pkg}/input`, { recursive: true });
cpSync(`${ws}/brief.md`, `${pkg}/input/brief.md`);
if (arm !== "p0" && existsSync(`${ws}/.prax`)) cpSync(`${ws}/.prax`, `${pkg}/input/prax-artifacts`, { recursive: true });
if (arm !== "p0" && existsSync(`${ws}/.mcp.json`)) cpSync(`${ws}/.mcp.json`, `${pkg}/input/mcp.json`);

const meta = {
  batch: "m4-probe-20261024", slot, arm, rounds: ROUNDS,
  started_at: new Date(Date.now() - wallTotal * 1000).toISOString(), ended_at: new Date().toISOString(),
  wall_clock_seconds: wallTotal, wall_limit: WALL_TOTAL_S,
  stop_reason_rounds: rounds.map((r) => r.stopReason),
  stop_reason: rounds[rounds.length - 1].stopReason,
  cli_exit_codes: rounds.map((r) => r.code),
  session_ids: rounds.map((r) => r.sessionId),
  model_string: rounds.map((r) => r.modelString).filter(Boolean)[0] ?? null,
  playwright_version: PW_VERSION,
  observable_tokens: { input_tokens: tIn, output_tokens: tOut, token_in_out: tokenInOut, token_budget_status: tokenInOut > TOKEN_LIMIT ? "token_budget_exceeded_retrospective" : "within_budget", cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheCreation, cost_usd: Math.round(costUsd * 1000) / 1000, accounting: "m4 combined across rounds; D5 v2 per-round modelUsage summed" },
  feedback_round: round2 ? { message_file: "execution/round2-feedback.txt", kind: arm === "p3" ? "F1_measurements_only" : "F2_placebo" } : null,
  measurement: { final_exit_code: finalMeasure.exit, checks: finalChecks, midflight_exit_code: midflight?.exit ?? null, midflight_checks: midflight ? parseChecks(midflight.stdout) : null, stdout_tail: finalMeasure.stdout.slice(-500) },
};
writeFileSync(`${pkg}/execution/run-metadata.json`, JSON.stringify(meta, null, 2));
appendFileSync(events, JSON.stringify({ ts: new Date().toISOString(), kind: "probe_end", slot, arm, stop_reason: meta.stop_reason, wall_clock_seconds: wallTotal, token_in_out: tokenInOut, cost_usd: meta.observable_tokens.cost_usd, final_checks: finalChecks }) + "\n");
opEv({ kind: "probe_run_end", slot, arm, stop_reason: meta.stop_reason, wall_clock_seconds: wallTotal, token_in_out: tokenInOut, cost_usd: meta.observable_tokens.cost_usd, checks: finalChecks });
log("DONE", slot, arm, meta.stop_reason, wallTotal + "s", tokenInOut, "tokens", JSON.stringify(finalChecks));
