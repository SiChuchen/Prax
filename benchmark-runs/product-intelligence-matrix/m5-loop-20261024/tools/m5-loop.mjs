#!/usr/bin/env node
/**
 * M5 loop-batch driver (idempotent).
 *   node m5-loop.mjs           — verify freeze, run missing slots, readout
 *   node m5-loop.mjs --verify  — freeze verification only (no runs)
 *
 * Phase 1 freeze verification: both runtime manifests (full content rehash on
 * the m5 side), MCP entry hashes, prompt hashes, tool hashes
 * (freeze-record.json written on first successful verification, enforced
 * afterwards). Phase 2: serial slots (m5-run.mjs), skipping slots whose
 * run-metadata exists; $120 batch cost ceiling checked before each slot.
 * Phase 3: mechanical readout (protocol §3 matrix) -> m5-report.md.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const M5 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m5-loop-20261024";
const RT_E0 = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const RT_E1 = "E:/codex-prj/pi-m5-frozen-runtime-20261024";
const R3_MANIFEST_REPO = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918/runtime-content-sha256.txt";
const T = `${M5}/tools`;
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const log = (...a) => console.error(new Date().toISOString(), JSON.stringify(a));
const opEv = (obj) => appendFileSync(`${M5}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
const SLOTS = [["s1", "e0"], ["s2", "e1"], ["s3", "e0"], ["s4", "e1"], ["s5", "e1"], ["s6", "e1"]];
const COST_CEILING_USD = 120;
const M5_MANIFEST_SHA = "fbf222e1495eba32e96c849d65bfec8ed2cd225005d2a13df41b37862f8045b1";
const R3_MANIFEST_SHA = "681653b4643c2850601a75dc09d90a92d2a5f11f1ee16eafe3811d95bf548fdb";
const STDIO_SHA = "1ca1783c34c1e1e0a625c6de4fd771dbd2effed7a8ed9ebace2f42d1aeaf8bb5";
const PROMPT_SHAS = {
  "cell-j13-s10": "f9e89254497c27324ecc091f80e3a335802e746882043c3f4e3d3a9cd5bc66bc",
  "cell-j10-s09": "7ce966a665c968c0d4e14c419d13c825ec5d96ac0f98cfed6722c0319951b47a",
};

// ---- phase 1: freeze verification ------------------------------------------
if (sha256(`${RT_E1}/runtime-content-sha256.txt`) !== M5_MANIFEST_SHA) throw new Error("m5 runtime manifest hash drifted");
if (sha256(R3_MANIFEST_REPO) !== R3_MANIFEST_SHA) throw new Error("r3 runtime manifest hash drifted");
// full content rehash of the m5 manifest (r3-side rehash was done at its ledger build; manifest-file hash re-verified above)
{
  const dir = RT_E1;
  const bad = [];
  for (const line of readFileSync(`${dir}/runtime-content-sha256.txt`, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const want = line.slice(0, 64); const rel = line.slice(66);
    try { if (sha256(join(dir, rel)) !== want) bad.push(rel); } catch { bad.push(rel + " (missing)"); }
  }
  if (bad.length) throw new Error(`m5 runtime content rehash mismatches: ${bad.slice(0, 5).join(", ")}`);
  log("m5 runtime rehash OK");
}
if (sha256(`${RT_E0}/packages/prax-mcp/dist/stdio.js`) !== STDIO_SHA) throw new Error("r3 MCP entry hash drifted");
if (sha256(`${RT_E1}/packages/prax-mcp/dist/stdio.js`) !== STDIO_SHA) throw new Error("m5 MCP entry hash drifted");
for (const [cell, want] of Object.entries(PROMPT_SHAS)) {
  if (sha256(`${M5}/launch/${cell}-b-prompt.md`) !== want) throw new Error(`${cell}: prompt drifted from frozen sha`);
}
const toolHashes = Object.fromEntries(["setup-m5.mjs", "m5-run.mjs", "m5-loop.mjs"].map((f) => [f, sha256(`${T}/${f}`)]));
const freezePath = `${M5}/freeze-record.json`;
if (!existsSync(freezePath)) {
  writeFileSync(freezePath, JSON.stringify({ created: new Date().toISOString(), tools: toolHashes, m5_manifest: M5_MANIFEST_SHA, r3_manifest: R3_MANIFEST_SHA, stdio_sha256: STDIO_SHA, prompts: PROMPT_SHAS }, null, 2));
  log("freeze-record created");
} else {
  const fr = JSON.parse(readFileSync(freezePath, "utf8"));
  for (const [f, h] of Object.entries(fr.tools)) if (toolHashes[f] !== h) throw new Error(`tool ${f} drifted from freeze record`);
}
log("freeze verified");

if (process.argv.includes("--verify")) { console.log("FREEZE VERIFIED — no runs (--verify)"); process.exit(0); }

// ---- phase 2: slots -----------------------------------------------------------
let spent = 0;
for (const s of SLOTS) {
  const [slot, arm] = s;
  const pkg = `${M5}/runs/${slot}-${arm}`;
  if (existsSync(`${pkg}/execution/run-metadata.json`)) {
    const m = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
    spent += m.observable_tokens?.cost_usd ?? 0;
    log("skip done", slot, m.g1_phase);
    continue;
  }
  if (spent > COST_CEILING_USD) { log("cost ceiling breached, stopping before", slot); opEv({ kind: "cost_ceiling", spent_usd: Math.round(spent * 1000) / 1000, stopped_before: slot }); break; }
  log("RUN", slot, arm);
  const r = spawnSync(process.execPath, [`${T}/m5-run.mjs`, slot, arm], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  if (r.status !== 0 && !existsSync(`${pkg}/execution/run-metadata.json`)) opEv({ kind: "slot_fault", slot, exit: r.status });
  if (existsSync(`${pkg}/execution/run-metadata.json`)) {
    const m = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
    spent += m.observable_tokens?.cost_usd ?? 0;
  }
}
if (SLOTS.some(([slot, arm]) => !existsSync(`${M5}/runs/${slot}-${arm}/execution/run-metadata.json`))) {
  log("batch incomplete; rerun to resume");
  process.exit(0);
}

// ---- phase 3: readout (protocol §3 matrix) ---------------------------------------
const metas = Object.fromEntries(SLOTS.map(([slot, arm]) => [`${slot}-${arm}`, JSON.parse(readFileSync(`${M5}/runs/${slot}-${arm}/execution/run-metadata.json`, "utf8"))]));
const e1Ids = ["s2-e1", "s4-e1", "s5-e1", "s6-e1"];
const e0Ids = ["s1-e0", "s3-e0"];
const C = (ids) => ids.filter((id) => metas[id].g1_phase === "COMPLETE").length;
const ck = (id, key) => metas[id].g2_checks?.[key] === "pass" ? 1 : 0;
const cA = (ids) => ids.reduce((a, id) => a + ck(id, "a11y.contrast"), 0);
const tA = (ids) => ids.reduce((a, id) => a + ck(id, "type.min_projected_size"), 0);
const fA = (ids) => ids.reduce((a, id) => a + ck(id, "a11y.focus_order"), 0);
const tgA = (ids) => ids.reduce((a, id) => a + ck(id, "a11y.target_size"), 0);
const anyInvalid = Object.values(metas).some((m) => !m.g2_checks || Object.keys(m.g2_checks).length === 0);
const CE1 = C(e1Ids), CE0 = C(e0Ids), cE1 = cA(e1Ids), cE0 = cA(e0Ids);

let row = null, reading = "";
if (anyInvalid) { row = 5; reading = "at least one run's final measurement invalid after retry — analyzed at measurement-invalid; recorded as data"; }
else if (CE1 >= 3 && CE0 <= 1 && cE1 > cE0) { row = "1a"; reading = "loop improves closing AND measured a11y in-batch → ADR-006 stands as default; external claims still need multi-cell n"; }
else if (CE1 >= 3 && CE0 <= 1) { row = "1b"; reading = "closing-only effect → keep loop; investigate why feedback didn't convert to a11y passes (transcripts)"; }
else if (CE1 >= 3 && CE0 === 2) { row = 2; reading = "control closes too — batch/cell-ease suspicion; loop undifferentiated at this n; escalate n, no ship claim"; }
else if (CE1 <= 1) {
  const unavailNonCompletes = e1Ids.filter((id) => metas[id].g1_phase !== "COMPLETE" && (metas[id].g3_engagement?.unavailable_events ?? 0) >= 1).length;
  row = 3; reading = unavailNonCompletes >= 2
    ? "loop fails to close in-batch; ≥2 non-completing E1 runs hit MEASUREMENT_UNAVAILABLE → 'loop blocked by measurement infra on live workspaces' (product bug path); max action: iterate implementation"
    : "loop fails to close in-batch; agents ignored/never hit the loop → implementation/UX iteration; max action: iterate implementation. NOT removal (needs multi-cell evidence)";
}
else { row = 4; reading = "INCONCLUSIVE at n=4 — engagement observables decide the next batch's design; no ship/kill decision"; }
const focusRegression = fA(e1Ids) < fA(e0Ids);

const fmt = (ids) => ids.map((id) => `${id}(${metas[id].cell}) phase=${metas[id].g1_phase} c=${ck(id, "a11y.contrast")} t=${ck(id, "type.min_projected_size")} f=${ck(id, "a11y.focus_order")} tg=${ck(id, "a11y.target_size")} loop=${metas[id].g3_engagement?.measurement_loop_attempts ?? "-"} fixEv=${metas[id].g3_engagement?.fix_required_events ?? 0} unavailEv=${metas[id].g3_engagement?.unavailable_events ?? 0} selfRx=${metas[id].g3_engagement?.self_run_receipts ?? 0} $${metas[id].observable_tokens?.cost_usd ?? 0} ${Math.round((metas[id].wall_clock_seconds ?? 0) / 60)}min`);
const totalCost = Math.round(Object.values(metas).reduce((a, m) => a + (m.observable_tokens?.cost_usd ?? 0), 0) * 100) / 100;

const report = `# M5 Loop Validation Report — ${new Date().toISOString()}

Batch m5-loop-20261024. E1 = m5 frozen runtime ${M5_MANIFEST_SHA.slice(0, 8)}… (ADR-006);
E0 = r3 frozen runtime ${R3_MANIFEST_SHA.slice(0, 8)}… (pre-ADR-006); sole runtime delta =
prax-mcp ADR-006 files (manifest-verified); prax-measure/prax-knowledge byte-identical.

## Arm results

- E0 (n=2): C=${CE0}/2, contrast=${cE0}, type=${tA(e0Ids)}, focus=${fA(e0Ids)}, target=${tgA(e0Ids)}
- E1 (n=4): C=${CE1}/4, contrast=${cE1}, type=${tA(e1Ids)}, focus=${fA(e1Ids)}, target=${tgA(e1Ids)}

## Per-slot (G1 phase · G2 checks · G3 engagement · cost)

${[...e0Ids, ...e1Ids].map((id) => `- ${fmt([id])[0]}`).join("\n")}

Batch cost: $${totalCost} / $${COST_CEILING_USD} ceiling.

## Readout (protocol §3 matrix${anyInvalid ? ", row 5 first-match" : ""}; row ${row})

**${reading}**

${focusRegression ? "**Regression monitor FLAG**: focus(E1) < focus(E0) — loop associated with focus regression; investigate.\n" : ""}Historical anchors (context only): R1+R2 pooled B-arm 6/20 COMPLETE; j13 {R1 V, R2 C, r3 V, m4×2 C}=3/5; j10 {R1 V, R2 V, r3 C}=1/3; r3 B-arm 3/10.

Action caps from protocol §5 apply (no H-23 retirement, no ADR-006 removal on rows 2/3/4 alone, no probe-mode adoption).
`;
writeFileSync(`${M5}/m5-report.md`, report);
opEv({ kind: "batch_complete", row, CE1, CE0, cE1, cE0, focusRegression, total_usd: totalCost });
console.log("M5 BATCH COMPLETE — row", row);
console.log(report);
