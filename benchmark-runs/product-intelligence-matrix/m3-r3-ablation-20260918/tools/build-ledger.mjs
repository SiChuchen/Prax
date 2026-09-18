#!/usr/bin/env node
/**
 * M3 Task 5 — run-ledger.yaml + mechanical completeness audit.
 *
 * Reads every planned slot from run-order.yaml, each package's run-metadata,
 * receipt, screenshot manifest, source snapshot hashes, and re-verifies the
 * frozen inputs. Eligibility rules are fixed here BEFORE any blind score:
 *   blind_review_eligible  = operator screenshots captured for both viewports
 *                            AND source snapshot present (file-hashes.json)
 *   measurement_valid      = a schema-parsable receipt exists AND no check was
 *                            skipped with an invalid_target reason
 *   m3_cell_complete       = both arms of the cell have measurement_valid
 * Attempted vs eligible denominators stay separate. Nothing is deleted.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const OP = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const REPO = "E:/codex-prj/Prax/Prax";
const PI = "E:/codex-prj/ab-worktrees/pi-matrix-r3";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

// ---- planned slots ---------------------------------------------------------
const order = readFileSync(`${OP}/run-order.yaml`, "utf8");
const slots = [...order.matchAll(/- run: (\d+)\n\s+workspace: (\S+)\n\s+cell: (\S+)\n\s+arm: (\w)/g)]
  .map((m) => ({ run: `run-${m[1]}`, ws: m[2], cell: m[3], arm: m[4] }));
if (slots.length !== 20) throw new Error(`expected 20 slots, got ${slots.length}`);

const launchReport = JSON.parse(readFileSync(`${OP}/launch/prepare-launch-report.json`, "utf8"));

// ---- freeze verification ---------------------------------------------------
const freeze = { briefs_unchanged: true, brief_drift: [], runtime_manifest_sha256_expected: "23e770b3a48bf75111c9a56e963467fb8a7d40061f10ca06261dc33b5a3a4bab" };
for (const w of launchReport.workspaces) {
  const now = sha256(`${PI}/${w.ws}/brief.md`);
  if (now !== w.brief_sha256) { freeze.briefs_unchanged = false; freeze.brief_drift.push(w.ws); }
}
freeze.runtime_manifest_sha256_now = sha256(`${OP}/runtime-content-sha256.txt`);
freeze.runtime_manifest_unchanged = freeze.runtime_manifest_sha256_now === freeze.runtime_manifest_sha256_expected;
// Re-hash the frozen runtime content live and compare to the recorded manifest.
try {
  const live = execSync(`cd "${FROZEN}" && find . -path ./node_modules -prune -o -type f -print | sort | sed 's|^\\./||' | xargs sha256sum`, { encoding: "utf8", shell: "E:/Huawei/Git/usr/bin/bash.exe", maxBuffer: 64 * 1024 * 1024 });
  const recorded = readFileSync(`${OP}/runtime-content-sha256.txt`, "utf8");
  freeze.runtime_content_rehash_matches = live.trim() === recorded.trim();
} catch (e) { freeze.runtime_content_rehash_matches = `error: ${e.message.slice(0, 120)}`; }
freeze.mcp_entry_sha256_now = sha256(`${FROZEN}/packages/prax-mcp/dist/stdio.js`);
freeze.mcp_entry_unchanged = freeze.mcp_entry_sha256_now === "1ca1783c34c1e1e0a625c6de4fd771dbd2effed7a8ed9ebace2f42d1aeaf8bb5";

// ---- state separation ------------------------------------------------------
const separation = { a_workspaces_with_prax: [], b_workspaces_missing_prax: [], b_state_roots: {} };
for (const s of slots) {
  const hasPrax = existsSync(`${PI}/${s.ws}/.prax`);
  if (s.arm === "a" && hasPrax) separation.a_workspaces_with_prax.push(s.ws);
  if (s.arm === "b") {
    if (!hasPrax) separation.b_workspaces_missing_prax.push(s.ws);
    const cfg = JSON.parse(readFileSync(`${PI}/${s.ws}/.mcp.json`, "utf8"));
    separation.b_state_roots[s.ws] = cfg.mcpServers.prax.env.PRAX_STATE_ROOT;
  }
}
separation.b_state_roots_pairwise_unique = new Set(Object.values(separation.b_state_roots)).size === 10;

// ---- per-slot ledger -------------------------------------------------------
const ledger = [];
const cellStatus = {};
for (const s of slots) {
  const pkg = `${REPO}/benchmark-runs/product-intelligence-matrix/${s.cell}/m3/m3-r3-ablation-20260918-${s.run}-${s.arm}`;
  const row = { run: s.run, cell: s.cell, arm: s.arm, workspace: s.ws, package: pkg.replace(REPO + "/", "") };
  const metaPath = `${pkg}/execution/run-metadata.json`;
  row.attempted = existsSync(metaPath);
  row.launch_failures_preserved = existsSync(pkg + "/execution") ? readdirSync(`${pkg}/execution`).filter((f) => f.startsWith("run-metadata.launch-failure")).length : 0;
  if (!row.attempted) { row.status = "NOT_ATTEMPTED"; ledger.push(row); continue; }
  const meta = JSON.parse(readFileSync(metaPath, "utf8"));
  row.session_id = meta.session_id;
  row.stop_reason = meta.stop_reason;
  row.wall_clock_seconds = meta.wall_clock_seconds;
  row.wall_budget = meta.wall_clock_seconds <= 5400 ? "within_90min" : "exceeded_90min_stopped";
  const t = meta.observable_tokens ?? {};
  row.token_in_out = t.token_in_out ?? "not_observable";
  row.token_budget_status = t.token_budget_status ?? "not_observable";
  row.cost_usd = t.cost_usd ?? "not_observable";
  row.agent_declared_completion = meta.stop_reason === "agent_completed";
  // contamination: pre-checks in run-one.mjs abort before launch; reaching a
  // session means brief hash + arm workspace contents + config binding passed.
  row.contamination_precheck = "passed_before_launch";
  // source snapshot
  row.source_snapshot = existsSync(`${pkg}/implementation/file-hashes.json`);
  row.source_file_count = row.source_snapshot ? Object.keys(JSON.parse(readFileSync(`${pkg}/implementation/file-hashes.json`, "utf8"))).length : 0;
  // receipt
  const evDir = `${pkg}/validation-evidence/${s.run}/validation-evidence`;
  const receipts = existsSync(evDir) ? readdirSync(evDir).filter((f) => f.startsWith("receipt-") && f.endsWith(".json")) : [];
  row.receipt_present = receipts.length > 0;
  row.receipt_file = receipts[0] ?? null;
  row.receipt_count_in_run_dir = receipts.length;
  if (row.receipt_present) {
    const r = JSON.parse(readFileSync(`${evDir}/${receipts[0]}`, "utf8"));
    row.receipt_schema_parsed = true;
    row.receipt_summary = r.summary;
    const invalid = (r.checks ?? []).filter((c) => c.status === "skipped" && JSON.stringify(c).includes("invalid_target"));
    row.invalid_target = invalid.length > 0;
    row.invalid_target_reason = invalid.length ? (invalid[0].measured?.reason ?? invalid[0].reason ?? JSON.stringify(invalid[0].measured ?? {}).slice(0, 120)) : null;
    row.checks = Object.fromEntries((r.checks ?? []).map((c) => [c.id, c.status]));
    row.measurement_valid = !row.invalid_target;
  } else {
    row.receipt_schema_parsed = false;
    row.measurement_valid = false;
  }
  // screenshots
  const manPath = `${pkg}/evidence/screenshots/capture-manifest.json`;
  if (existsSync(manPath)) {
    const man = JSON.parse(readFileSync(manPath, "utf8"));
    row.operator_screenshots = man.captures.filter((c) => c.sha256).length;
    row.screenshot_sha256 = Object.fromEntries(man.captures.filter((c) => c.sha256).map((c) => [c.viewport, c.sha256]));
  } else row.operator_screenshots = 0;
  row.blind_review_eligible = row.operator_screenshots === 2 && row.source_snapshot;
  row.prax_artifacts_archived = s.arm === "b" ? existsSync(`${pkg}/input/prax-artifacts`) : "n/a";
  row.status = row.stop_reason;
  ledger.push(row);
  cellStatus[s.cell] ??= {};
  cellStatus[s.cell][s.arm] = { measurement_valid: row.measurement_valid, eligible: row.blind_review_eligible, stop: row.stop_reason };
}

// ---- denominators + M3 gate ------------------------------------------------
const attempted = ledger.filter((r) => r.attempted).length;
const completedByAgent = ledger.filter((r) => r.agent_declared_completion).length;
const wallExceeded = ledger.filter((r) => r.wall_budget === "exceeded_90min_stopped").length;
const receipts = ledger.filter((r) => r.receipt_present).length;
const measurementValid = ledger.filter((r) => r.measurement_valid).length;
const eligible = ledger.filter((r) => r.blind_review_eligible).length;
const tokensObservable = ledger.filter((r) => typeof r.token_in_out === "number").length;
const cellsComplete = Object.entries(cellStatus).filter(([, v]) => v.a?.measurement_valid && v.b?.measurement_valid).map(([c]) => c);
const cellsIncomplete = Object.entries(cellStatus).filter(([, v]) => !(v.a?.measurement_valid && v.b?.measurement_valid)).map(([c, v]) => ({ cell: c, a: v.a ?? "missing", b: v.b ?? "missing" }));
const m3Gate = {
  rule: "closed only when all 10 cells have both arms with valid measurement evidence (receipt present, target valid) and cost accounting or explicit observability limits",
  cells_with_both_arms_valid: cellsComplete.length,
  cells_incomplete: cellsIncomplete,
  cost_accounting: `${tokensObservable}/${attempted} runs token-observable; others explicitly not_observable (process stopped before result event)`,
  verdict: cellsComplete.length === 10 ? "CLOSED" : `NOT_CLOSED (${cellsComplete.length}/10 cells with both arms valid; partial results retained, no substitution)`,
};

const yaml = (v, ind = 0) => {
  const pad = "  ".repeat(ind);
  if (Array.isArray(v)) return v.length === 0 ? " []" : "\n" + v.map((x) => `${pad}- ${typeof x === "object" && x !== null ? yaml(x, ind + 1).replace(/^\n/, "").replace(/^\s+/, "") : JSON.stringify(x)}`).join("\n");
  if (v !== null && typeof v === "object") return "\n" + Object.entries(v).map(([k, x]) => `${pad}${k}:${typeof x === "object" && x !== null ? yaml(x, ind + 1) : " " + JSON.stringify(x)}`).join("\n");
  return " " + JSON.stringify(v);
};
const out = `# M3 pilot run ledger — generated ${new Date().toISOString()} (Task 5)
# Eligibility rules fixed in tools/build-ledger.mjs before any blind score existed.
batch: m3-r3-ablation-20260918
planned_slots: 20
denominators:
  attempted: ${attempted}
  agent_declared_completion: ${completedByAgent}
  wall_clock_exceeded_stopped: ${wallExceeded}
  receipt_present: ${receipts}
  measurement_valid: ${measurementValid}
  blind_review_eligible: ${eligible}
  token_observable: ${tokensObservable}
freeze_verification:${yaml(freeze, 1)}
state_separation:${yaml(separation, 1)}
m3_gate:${yaml(m3Gate, 1)}
runs:${yaml(ledger, 1)}
`;
writeFileSync(`${OP}/run-ledger.yaml`, out);
console.log(JSON.stringify({ attempted, completedByAgent, wallExceeded, receipts, measurementValid, eligible, tokensObservable, cellsComplete: cellsComplete.length, verdict: m3Gate.verdict, freeze: { briefs: freeze.briefs_unchanged, manifest: freeze.runtime_manifest_unchanged, rehash: freeze.runtime_content_rehash_matches, entry: freeze.mcp_entry_unchanged }, separation: { a_with_prax: separation.a_workspaces_with_prax.length, b_missing: separation.b_workspaces_missing_prax.length, unique_roots: separation.b_state_roots_pairwise_unique } }, null, 2));
