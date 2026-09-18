#!/usr/bin/env node
/**
 * M3 single-run packaging + operator measurement (plan Task 4; addendum
 * D3/D8v2/D9). Run AFTER run-one.mjs ends. Never edits the agent's
 * application code; an operator build (when the agent left no static
 * deliverable) is recorded verbatim. Measurement/screenshots run against a
 * staged <pkg>/measurement-root/ per addendum D8 v2 (Case R root static tree,
 * Case D built dist, Case B operator build) so the frozen CLI's
 * dist→vite-preview heuristic is never triggered and binding stays
 * static_tree-strong.
 *
 *   node package-one.mjs <run-NN> <workspace-name>
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const [runArg, ws] = process.argv.slice(2);
if (!runArg || !ws) { console.error("usage: package-one.mjs <run-NN> <workspace-name>"); process.exit(2); }
const run = `run-${runArg}`;
const arm = ws.endsWith("-b") ? "b" : "a";
const cell = ws.slice(0, -2);
const PI = "E:/codex-prj/ab-worktrees/pi-matrix-r3";
const OP = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const REPO = "E:/codex-prj/Prax/Prax";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const workspace = `${PI}/${ws}`;
const pkg = `${REPO}/benchmark-runs/product-intelligence-matrix/${cell}/m3/m3-r3-ablation-20260918-${run}-${arm}`;
const meta = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const opEv = (obj) =>
  appendFileSync(`${OP}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");

const notes = { build_commands: [], staging_rule: null, measured_root: null, staged_index_sha256: null };

// ---- D8 v2: resolve the static measured artifact ---------------------------
function runCmd(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: true, timeout: 10 * 60_000, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  notes.build_commands.push({ cmd: `${cmd} ${args.join(" ")}`, cwd, exit_code: r.status, stderr_tail: (r.stderr || "").slice(-500) });
  return r.status === 0;
}

const rootStatic = existsSync(`${workspace}/index.html`);
const distStatic = existsSync(`${workspace}/dist/index.html`);
if (!rootStatic && !distStatic && existsSync(`${workspace}/package.json`)) {
  const scripts = JSON.parse(readFileSync(`${workspace}/package.json`, "utf8")).scripts ?? {};
  if (scripts.build) {
    if (!existsSync(`${workspace}/node_modules`)) runCmd("npm", ["install", "--no-audit", "--no-fund"], workspace);
    runCmd("npm", ["run", "build"], workspace);
  }
}
const distAfter = existsSync(`${workspace}/dist/index.html`);
let stagingCase = null;
if (rootStatic) stagingCase = "R_root_static_tree";
else if (distStatic || distAfter) stagingCase = "D_built_dist";
else stagingCase = "none";

// ---- implementation snapshot (complete app files incl. untracked) ---------
rmSync(`${pkg}/implementation`, { recursive: true, force: true });
mkdirSync(`${pkg}/implementation`, { recursive: true });
const srcDir = `${pkg}/implementation/source`;
cpSync(workspace, srcDir, {
  recursive: true,
  filter: (src) => {
    const rel = relative(workspace, src).replace(/\\/g, "/");
    if (rel === "." ) return true;
    if (rel === ".git" || rel.startsWith(".git/") || rel === ".prax" || rel.startsWith(".prax/") ||
        rel === "node_modules" || rel.startsWith("node_modules/") || rel === ".mcp.json") return false;
    return true;
  },
});
const hashes = {};
const files = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { files.push(p); hashes[relative(srcDir, p).replace(/\\/g, "/")] = sha256(p); }
  }
};
walk(srcDir);
writeFileSync(`${pkg}/implementation/file-hashes.json`, JSON.stringify(hashes, null, 2));
writeFileSync(`${pkg}/implementation/changed-files.txt`, files.map((f) => relative(srcDir, f).replace(/\\/g, "/")).sort().join("\n") + "\n");
writeFileSync(`${pkg}/implementation/git-diff.patch`, `# git diff unavailable: initial HEAD was unborn (empty repo, no commits) for ${ws}\n# standalone source snapshot: implementation/source/ (${files.length} files)\n`);
writeFileSync(`${pkg}/implementation/git-state.txt`, `initial_head: unborn\ninitial_untracked: brief.md${arm === "b" ? ", .mcp.json" : ""}, README.md (moved to operator backups before run)\nfinal_head: unborn\n`);

// ---- stage measurement-root per D8 v2 --------------------------------------
const staged = `${pkg}/measurement-root`;
rmSync(staged, { recursive: true, force: true });
mkdirSync(staged, { recursive: true });
if (stagingCase === "R_root_static_tree") {
  cpSync(workspace, staged, {
    recursive: true,
    filter: (src) => {
      const rel = relative(workspace, src).replace(/\\/g, "/");
      if (rel === ".") return true;
      if (rel === ".git" || rel.startsWith(".git/") || rel === ".prax" || rel.startsWith(".prax/") ||
          rel === "node_modules" || rel.startsWith("node_modules/") || rel === ".mcp.json" ||
          rel === "dist" || rel.startsWith("dist/")) return false;
      return true;
    },
  });
  notes.staging_rule = "D8v2 Case R: workspace minus .git/.prax/.mcp.json/node_modules/dist (root static tree is the measured artifact)";
} else if (stagingCase === "D_built_dist") {
  cpSync(`${workspace}/dist`, staged, { recursive: true });
  notes.staging_rule = "D8v2 Case D: dist/ contents staged (built artifact is the measured artifact)";
} else {
  notes.staging_rule = "D8v2: no static artifact found — measurement + screenshots recorded MISSING (data)";
}
if (existsSync(`${staged}/index.html`)) notes.staged_index_sha256 = sha256(`${staged}/index.html`);
notes.measured_root = stagingCase === "none" ? null : staged;

// ---- input -----------------------------------------------------------------
mkdirSync(`${pkg}/input`, { recursive: true });
cpSync(`${workspace}/brief.md`, `${pkg}/input/brief.md`);
if (arm === "b") {
  if (existsSync(`${workspace}/.mcp.json`)) cpSync(`${workspace}/.mcp.json`, `${pkg}/input/mcp.json`);
  if (existsSync(`${workspace}/.prax`)) cpSync(`${workspace}/.prax`, `${pkg}/input/prax-artifacts`, { recursive: true });
}
if (sha256(`${pkg}/input/brief.md`) !== sha256(`${workspace}/brief.md`)) throw new Error("brief copy mismatch");

// ---- operator measurement (unique --out) against the staged root ------------
let measurement = { status: "missing_root" };
if (notes.measured_root) {
  const outDir = `${pkg}/validation-evidence/${run}`;
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const r = spawnSync(process.execPath, [
    `${FROZEN}/packages/prax-measure/bin/prax-measure.mjs`,
    "--app", staged, "--out", outDir, "--entry", "/", "--scenario", "entry",
    "--viewports", "1280x860,1440x900",
  ], { encoding: "utf8", timeout: 5 * 60_000, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  let receipts = [];
  try { receipts = readdirSync(`${outDir}/validation-evidence`).filter((f) => f.startsWith("receipt-") && f.endsWith(".json")); } catch { /* none */ }
  measurement = {
    status: r.status === 0 ? "completed" : r.status === 1 ? "error_failures" : "invalid_or_incomplete",
    exit_code: r.status,
    command: `prax-measure --app <pkg>/measurement-root --out <pkg>/validation-evidence/${run} --entry / --scenario entry --viewports 1280x860,1440x900`,
    receipt_files: receipts,
    stdout_tail: (r.stdout || "").slice(-400),
    stderr_tail: (r.stderr || "").slice(-400),
  };
}

// ---- D9 operator screenshots on the SAME staged snapshot -------------------
let screenshots = { status: "missing_root" };
if (notes.measured_root) {
  const r = spawnSync(process.execPath, [
    `${OP}/tools/capture-screens.mjs`, staged, `${pkg}/evidence/screenshots`, `m3-r2-20260909-${run}-${arm}`,
  ], { encoding: "utf8", timeout: 2 * 60_000, cwd: FROZEN, env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  screenshots = { status: r.status === 0 ? "captured" : "failed", stdout_tail: (r.stdout || "").slice(-400), stderr_tail: (r.stderr || "").slice(-300) };
}

// ---- summary.yaml ----------------------------------------------------------
const report = JSON.parse(readFileSync(`${OP}/launch/prepare-launch-report.json`, "utf8"));
const wsReport = report.workspaces.find((w) => w.ws === ws);
const agentEvidence = existsSync(`${srcDir}/evidence`) ? "implementation/source/evidence/ (agent-produced, provenance preserved in source snapshot)" : "none_produced";
const summary = `# M3 pilot run summary (AB-001 replicates schema + cell field)
run.id: m3-r2-20260909-${run}-${arm}
run.cell: ${cell}
run.arm: ${arm}
run.batch: m3-r3-ablation-20260918
result.implementation_completed: ${stagingCase !== "none" && meta.stop_reason === "agent_completed"}
result.artifact_present_at_stop: ${stagingCase !== "none"}
result.agent_declared_completion: ${meta.stop_reason === "agent_completed"}
result.final_validation: "${measurement.status}${measurement.receipt_files?.length ? ` (${measurement.receipt_files.length} receipt)` : ""}"
result.initial_head: unborn
process.wall_clock_seconds: ${meta.wall_clock_seconds}
process.stop_reason: ${meta.stop_reason}
process.cli_exit_code: ${meta.cli_exit_code}
process.session_id: ${meta.session_id ?? "not_observable"}
process.model_usage:
  input_tokens: ${meta.observable_tokens.input_tokens ?? "not_observable"}
  output_tokens: ${meta.observable_tokens.output_tokens ?? "not_observable"}
  token_in_out: ${meta.observable_tokens.token_in_out ?? "not_observable"}
  token_budget_status: ${meta.observable_tokens.token_budget_status ?? "not_observable"}
  cache_read_input_tokens: ${meta.observable_tokens.cache_read_input_tokens ?? "not_observable"}
  cost_usd: ${meta.observable_tokens.cost_usd ?? "not_observable"}
process.tool_calls: not_observable_from_stream_json_summary
process.prax_calls: ${arm === "b" ? "see input/prax-artifacts session trace" : "n/a (arm a)"}
process.human_clarifications: 0
process.first_pass: ${meta.stop_reason === "agent_completed" ? "true (single planned pass)" : "false"}
process.post_first_pass_repair_rounds: 0
input.brief_sha256: ${wsReport.brief_sha256}
input.prompt_sha256: ${wsReport.prompt_sha256}
runtime.frozen_path: ${FROZEN}
runtime.lock: benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918/runtime-lock.yaml
measurement.staging_rule: "${notes.staging_rule}"
measurement.staged_index_sha256: ${notes.staged_index_sha256 ?? "n/a"}
measurement.root_binding: static_tree (staged measurement-root, addendum D8 v2)
measurement.exit_code: ${measurement.exit_code ?? null}
measurement.receipts: ${JSON.stringify(measurement.receipt_files ?? [])}
measurement.stdout_tail: "${(measurement.stdout_tail ?? "").replace(/"/g, "'")}"
measurement.stderr_tail: "${(measurement.stderr_tail ?? "").replace(/"/g, "'")}"
screenshots.operator: ${screenshots.status}
evidence.agent_produced: ${agentEvidence}
build.commands: ${JSON.stringify(notes.build_commands)}
protocol_deviations: "see m3-r3-ablation-20260918/protocol-addendum.md (D1-D10 + changelog)"
bias_notes: none_observed
`;
writeFileSync(`${pkg}/summary.yaml`, summary);

opEv({ kind: "packaged", run, cell, arm, staging_case: stagingCase, measurement: measurement.status, measurement_exit: measurement.exit_code, screenshots: screenshots.status, source_files: files.length });
console.log(JSON.stringify({ run, arm, cell, source_files: files.length, staging_case: stagingCase, measurement: measurement.status, measurement_exit: measurement.exit_code, screenshots: screenshots.status }, null, 2));
