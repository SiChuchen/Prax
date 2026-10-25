#!/usr/bin/env node
/**
 * m5p3-verify driver (idempotent).
 *   node m5p3-loop.mjs           — verify freeze, run missing slots, readout
 *   node m5p3-loop.mjs --verify  — freeze verification only
 * Phase 1: both manifest hashes (m5p3 full rehash), stdio entries, prompts,
 * tool hashes -> freeze-record.json. Phase 2: serial slots, $120 ceiling.
 * Phase 3: protocol §3 matrix (rows 1-6) -> m5p3-report.md.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const M = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m5p3-verify-20261025";
const RT_E0 = "E:/codex-prj/pi-m5p1-frozen-runtime-20261025";
const RT_E1 = "E:/codex-prj/pi-m5p3-frozen-runtime-20261025";
const T = `${M}/tools`;
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const log = (...a) => console.error(new Date().toISOString(), JSON.stringify(a));
const opEv = (obj) => appendFileSync(`${M}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
const SLOTS = [["s1", "e0"], ["s2", "e1"], ["s3", "e0"], ["s4", "e1"], ["s5", "e1"], ["s6", "e1"]];
const COST_CEILING_USD = 120;
const P3_MANIFEST = "76bfda91e74b4e19db9bf1ee7b3ecd9ee9f71567b77af4d574b2d067785c094f";
const P1_MANIFEST = "183410dfa676b40b8ba2577f1aea0b4954542568f7f88445fc3138fdc3a016d1";
const STDIO_SHA = "1ca1783c34c1e1e0a625c6de4fd771dbd2effed7a8ed9ebace2f42d1aeaf8bb5";
const PROMPT_SHAS = {
  "cell-j13-s10": "f9e89254497c27324ecc091f80e3a335802e746882043c3f4e3d3a9cd5bc66bc",
  "cell-j10-s09": "7ce966a665c968c0d4e14c419d13c825ec5d96ac0f98cfed6722c0319951b47a",
};

if (sha256(`${RT_E1}/runtime-content-sha256.txt`) !== P3_MANIFEST) throw new Error("m5p3 runtime manifest hash drifted");
if (sha256(`${RT_E0}/runtime-content-sha256.txt`) !== P1_MANIFEST) throw new Error("m5p1 (E0'') runtime manifest hash drifted");
{
  const dir = RT_E1;
  const bad = [];
  for (const line of readFileSync(`${dir}/runtime-content-sha256.txt`, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const want = line.slice(0, 64); const rel = line.slice(66);
    try { if (sha256(join(dir, rel)) !== want) bad.push(rel); } catch { bad.push(rel + " (missing)"); }
  }
  if (bad.length) throw new Error(`m5p3 runtime rehash mismatches: ${bad.slice(0, 5).join(", ")}`);
  log("m5p3 runtime rehash OK");
}
if (sha256(`${RT_E1}/packages/prax-mcp/dist/stdio.js`) !== STDIO_SHA) throw new Error("m5p3 MCP entry hash drifted");
if (sha256(`${RT_E0}/packages/prax-mcp/dist/stdio.js`) !== STDIO_SHA) throw new Error("m5p1 (E0'') MCP entry hash drifted");
for (const [cell, want] of Object.entries(PROMPT_SHAS)) {
  if (sha256(`${M}/launch/${cell}-b-prompt.md`) !== want) throw new Error(`${cell}: prompt drifted from frozen sha`);
}
const toolHashes = Object.fromEntries(["setup-m5p3.mjs", "m5p3-run.mjs", "m5p3-loop.mjs"].map((f) => [f, sha256(`${T}/${f}`)]));
const freezePath = `${M}/freeze-record.json`;
if (!existsSync(freezePath)) {
  writeFileSync(freezePath, JSON.stringify({ created: new Date().toISOString(), tools: toolHashes, m5p3_manifest: P3_MANIFEST, m5p1_manifest_e0: P1_MANIFEST, stdio_sha256: STDIO_SHA, prompts: PROMPT_SHAS }, null, 2));
  log("freeze-record created");
} else {
  const fr = JSON.parse(readFileSync(freezePath, "utf8"));
  for (const [f, h] of Object.entries(fr.tools)) if (toolHashes[f] !== h) throw new Error(`tool ${f} drifted from freeze record`);
}
log("freeze verified");

if (process.argv.includes("--verify")) { console.log("FREEZE VERIFIED — no runs (--verify)"); process.exit(0); }

let spent = 0;
for (const s of SLOTS) {
  const [slot, arm] = s;
  const pkg = `${M}/runs/${slot}-${arm}`;
  if (existsSync(`${pkg}/execution/run-metadata.json`)) {
    const m = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
    spent += m.observable_tokens?.cost_usd ?? 0;
    log("skip done", slot, m.g1_phase);
    continue;
  }
  if (spent > COST_CEILING_USD) { log("cost ceiling breached, stopping before", slot); opEv({ kind: "cost_ceiling", spent_usd: Math.round(spent * 1000) / 1000, stopped_before: slot }); break; }
  log("RUN", slot, arm);
  const r = spawnSync(process.execPath, [`${T}/m5p3-run.mjs`, slot, arm], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  if (r.status !== 0 && !existsSync(`${pkg}/execution/run-metadata.json`)) opEv({ kind: "slot_fault", slot, exit: r.status });
  if (existsSync(`${pkg}/execution/run-metadata.json`)) {
    const m = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
    spent += m.observable_tokens?.cost_usd ?? 0;
  }
}
if (SLOTS.some(([slot, arm]) => !existsSync(`${M}/runs/${slot}-${arm}/execution/run-metadata.json`))) {
  log("batch incomplete; rerun to resume");
  process.exit(0);
}

const metas = Object.fromEntries(SLOTS.map(([slot, arm]) => [`${slot}-${arm}`, JSON.parse(readFileSync(`${M}/runs/${slot}-${arm}/execution/run-metadata.json`, "utf8"))]));
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
const S1 = e1Ids.filter((id) => metas[id].g3_handoff?.submit_terminal === true).length;
const hintSessions = e1Ids.filter((id) => (metas[id].g3_handoff?.fix_hint_fields ?? 0) + (metas[id].g3_handoff?.fix_paths_fields ?? 0) > 0);

let row = null, reading = "";
if (anyInvalid) { row = 5; reading = "at least one run's final measurement invalid after retry — analyzed at measurement-invalid; recorded as data"; }
else if (CE1 >= 3 && CE0 <= 1) { row = 1; reading = `stack VERIFIED live: Gate F positive in-batch at this n for ADR-006+m5.1+m5.2+m5.3 (external claims still multi-cell); handoff observations: submit_terminal=${S1}/4, not-verdict msgs seen in ${e1Ids.filter((id) => (metas[id].g3_handoff?.not_verdict_msgs ?? 0) > 0).length}/4${hintSessions.length > 0 ? `; hints fired in ${hintSessions.length} session(s)` : "; hints never fired (no findings-stall path reached)"}`; }
else if (CE1 === 2 && CE0 <= 1) { row = 2; reading = `PARTIAL: residuals ${e1Ids.map((id) => `${id}(phase=${metas[id].g1_phase},last=${metas[id].g3_handoff?.last_validate_mode}/${metas[id].g3_handoff?.last_validate_status},submitTerm=${metas[id].g3_handoff?.submit_terminal})`).join(" ")}; if S1=0 the m5p1 residual is gone — classify the new terminal shape as the next-slice candidate`; }
else if (CE1 <= 1 && CE0 <= 1) { row = 3; reading = "NEGATIVE-at-n despite the handoff fix — transcript investigation; consider agent-side variance dominance"; }
else if (CE0 === 2) { row = 4; reading = "CONTROL-DRIFT: both controls close — batch/cell ease; undifferentiated at this n; escalate n before claims"; }
else { row = 6; reading = "residual pattern — manual paired transcript reading; hypothesis only"; }
const focusRegression = fA(e1Ids) < fA(e0Ids);
const totalCost = Math.round(Object.values(metas).reduce((a, m) => a + (m.observable_tokens?.cost_usd ?? 0), 0) * 100) / 100;

const fmt = (id) => `- ${id}(${metas[id].cell}) phase=${metas[id].g1_phase} stall=${metas[id].g1b_stall?.phenotype} lastValidate=${metas[id].g3_handoff?.last_validate_mode}/${metas[id].g3_handoff?.last_validate_status} submitTerm=${metas[id].g3_handoff?.submit_terminal} notVerdict=${metas[id].g3_handoff?.not_verdict_msgs ?? 0} hintFields=${(metas[id].g3_handoff?.fix_hint_fields ?? 0) + (metas[id].g3_handoff?.fix_paths_fields ?? 0)} c=${ck(id, "a11y.contrast")} t=${ck(id, "type.min_projected_size")} f=${ck(id, "a11y.focus_order")} tg=${ck(id, "a11y.target_size")} fixEv=${metas[id].g3_engagement?.fix_required_events ?? 0} selfRx=${metas[id].g3_engagement?.self_run_receipts ?? 0} vCalls=${metas[id].g3_engagement?.validate_calls ?? 0} $${metas[id].observable_tokens?.cost_usd ?? 0} ${Math.round((metas[id].wall_clock_seconds ?? 0) / 60)}min`;

const report = `# M5.3 Handoff-Clarity Live Verification Report — ${new Date().toISOString()}

Batch m5p3-verify-20261025. E1'' = m5p3 frozen runtime ${P3_MANIFEST.slice(0, 8)}… (ADR-006+m5.1+m5.2+m5.3);
E0'' = m5p1 frozen runtime ${P1_MANIFEST.slice(0, 8)}… (ADR-006+m5.1); sole delta = m5.2+m5.3
files (manifest-verified); prax-measure/prax-knowledge/stdio entry identical.

## Arm results

- E0'' (n=2): C=${CE0}/2, contrast=${cE0}, type=${tA(e0Ids)}, focus=${fA(e0Ids)}, target=${tgA(e0Ids)}
- E1'' (n=4): C=${CE1}/4, contrast=${cE1}, type=${tA(e1Ids)}, focus=${fA(e1Ids)}, target=${tgA(e1Ids)}, submit_terminal=${S1}/4

## Per-slot (G1 phase · stall · m5.3/m5.2 handoff · G2 · G3 · cost)

${[...e0Ids, ...e1Ids].map((id) => fmt(id)).join("\n")}

Batch cost: $${totalCost} / $${COST_CEILING_USD} ceiling.

## Readout (protocol §3 matrix; row ${row})

**${reading}**

${focusRegression ? "**Regression monitor FLAG**: focus(E1'') < focus(E0'').\n" : ""}Historical anchors (context only): m5p1 E1' = 2/4 [s2/s6 submit_terminal, s4/s5 closed]; m5p1 E0' = 0/2 (zero_stall); m5 E1 = 1/4; R1+R2 6/20.

Action caps from protocol §5 apply.
`;
writeFileSync(`${M}/m5p3-report.md`, report);
opEv({ kind: "batch_complete", row, CE1, CE0, S1, cE1, cE0, focusRegression, total_usd: totalCost });
console.log("M5P3 BATCH COMPLETE — row", row);
console.log(report);
