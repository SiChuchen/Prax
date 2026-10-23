#!/usr/bin/env node
/**
 * M4 probe driver (idempotent).
 *   node probe-loop.mjs          — verify freeze, run missing slots, readout
 *
 * Phase 1 freeze verification: runtime manifest hash + frozen MCP entry hash +
 * r3 empty-MCP config present + appendix/tool hashes (freeze-record.json is
 * written on first successful verification and enforced afterwards).
 * Phase 2: serial slots (probe-run.mjs), skipping slots whose run-metadata
 * exists. Phase 3: trace-checks + mechanical readout matrix (protocol §3)
 * → probe-report.md. Cost ceiling $80 enforced across batch (protocol §4).
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const M4 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m4-probe-20261024";
const OP3 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const T = `${M4}/tools`;
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const log = (...a) => console.error(new Date().toISOString(), JSON.stringify(a));
const opEv = (obj) => appendFileSync(`${M4}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
const SLOTS = [["s1", "p0"], ["s2", "p1"], ["s3", "p1"], ["s4", "p2"], ["s5", "p2"], ["s6", "p3"], ["s7", "p3p"]];
const COST_CEILING_USD = 80;

// ---- phase 1: freeze verification ------------------------------------------
if (sha256(`${M4}/../m3-r3-ablation-20260918/runtime-content-sha256.txt`) !== "681653b4643c2850601a75dc09d90a92d2a5f11f1ee16eafe3811d95bf548fdb") throw new Error("r3 runtime manifest hash drifted");
if (sha256(`${FROZEN}/packages/prax-mcp/dist/stdio.js`) !== "1ca1783c34c1e1e0a625c6de4fd771dbd2effed7a8ed9ebace2f42d1aeaf8bb5") throw new Error("frozen MCP entry hash drifted");
if (!existsSync(`${OP3}/launch/mcp-config-empty.json`)) throw new Error("r3 mcp-config-empty.json missing");
const toolHashes = Object.fromEntries(["serialize-h23.mjs", "setup-probe.mjs", "probe-run.mjs", "trace-checks.mjs", "probe-loop.mjs"].map((f) => [f, sha256(`${T}/${f}`)]));
const appendixSha = sha256(`${M4}/launch/appendix-a.md`);
const freezePath = `${M4}/freeze-record.json`;
if (!existsSync(freezePath)) {
  writeFileSync(freezePath, JSON.stringify({ created: new Date().toISOString(), appendix_a_sha256: appendixSha, tools: toolHashes, runtime_manifest: "681653b4…", brief_sha256: "f1a0496c…" }, null, 2));
  log("freeze-record created");
} else {
  const fr = JSON.parse(readFileSync(freezePath, "utf8"));
  if (fr.appendix_a_sha256 !== appendixSha) throw new Error("appendix-a.md drifted from freeze record");
  for (const [f, h] of Object.entries(fr.tools)) if (toolHashes[f] !== h) throw new Error(`tool ${f} drifted from freeze record`);
}
log("freeze verified; appendix", appendixSha.slice(0, 12));

// ---- phase 2: slots -----------------------------------------------------------
let spent = 0;
for (const s of SLOTS) {
  const [slot, arm] = s;
  const pkg = `${M4}/runs/${slot}-${arm}`;
  if (existsSync(`${pkg}/execution/run-metadata.json`)) {
    const m = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
    spent += m.observable_tokens?.cost_usd ?? 0;
    log("skip done", slot, m.stop_reason);
    continue;
  }
  if (spent > COST_CEILING_USD) { log("cost ceiling breached, stopping before", slot); opEv({ kind: "probe_cost_ceiling", spent_usd: spent, stopped_before: slot }); break; }
  log("RUN", slot, arm);
  const r = spawnSync(process.execPath, [`${T}/probe-run.mjs`, slot, arm], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  if (r.status !== 0 && !existsSync(`${pkg}/execution/run-metadata.json`)) opEv({ kind: "probe_fault", slot, exit: r.status });
  if (existsSync(`${pkg}/execution/run-metadata.json`)) {
    const m = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
    spent += m.observable_tokens?.cost_usd ?? 0;
  }
}
if (SLOTS.some(([slot, arm]) => !existsSync(`${M4}/runs/${slot}-${arm}/execution/run-metadata.json`))) {
  log("batch incomplete; rerun to resume");
  process.exit(0);
}

// ---- phase 3: readout -----------------------------------------------------------
spawnSync(process.execPath, [`${T}/trace-checks.mjs`], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
const traces = Object.fromEntries(SLOTS.map(([slot, arm]) => [`${slot}-${arm}`, existsSync(`${M4}/runs/${slot}-${arm}/trace-checks.json`) ? JSON.parse(readFileSync(`${M4}/runs/${slot}-${arm}/trace-checks.json`, "utf8")) : null]));
const metas = Object.fromEntries(SLOTS.map(([slot, arm]) => [`${slot}-${arm}`, JSON.parse(readFileSync(`${M4}/runs/${slot}-${arm}/execution/run-metadata.json`, "utf8"))]));
const cp = (id) => metas[id].measurement?.checks?.["a11y.contrast"] === "pass" ? 1 : 0;
const tp = (id) => metas[id].measurement?.checks?.["type.min_projected_size"] === "pass" ? 1 : 0;
const armC = (ids) => ids.reduce((a, id) => a + cp(id), 0);
const armT = (ids) => ids.reduce((a, id) => a + tp(id), 0);
const gt = (x, y) => x.c >= y.c + 1 && x.t >= y.t;
const P = { p0: { c: armC(["s1-p0"]), t: armT(["s1-p0"]) }, p1: { c: armC(["s2-p1", "s3-p1"]), t: armT(["s2-p1", "s3-p1"]) }, p2: { c: armC(["s4-p2", "s5-p2"]), t: armT(["s4-p2", "s5-p2"]) }, p3: { c: armC(["s6-p3"]), t: armT(["s6-p3"]) }, p3p: { c: armC(["s7-p3p"]), t: armT(["s7-p3p"]) } };
const p2Wins = ["s4-p2", "s5-p2"].filter((id) => cp(id) === 1);
const winningTrace = p2Wins.length > 0 && traces[p2Wins[0]]?.T_fs_no_sub12_fontsize?.pass === true;
const anyInvalid = Object.values(metas).some((m) => !m.measurement?.checks || Object.keys(m.measurement.checks).length === 0);

let row = null, reading = "";
if (anyInvalid) { row = 6; reading = "at least one slot's final measurement invalid after retry — arm analyzed at measurement-invalid; recorded as data"; }
else if (gt(P.p2, P.p1) && winningTrace) { row = 1; reading = "content IS sufficient when delivered → fix the surfacing mechanism (auto-expand admitted entries at decide/validation); breakpoint = selection→surfacing confirmed"; }
else if (gt(P.p2, P.p1)) { row = 2; reading = "weak content-effect without trace — treat as noise; escalate n before any mechanism change"; }
else if (gt(P.p3, P.p2)) { row = 3; reading = `content insufficient, closed loop works → prioritize measure→fix loop${gt(P.p3p, P.p2) || (P.p3p.c >= P.p3.c && P.p3p.t >= P.p3.t) ? "; WARNING P3p≈P3 — gain may be extra-pass effort, not feedback" : "; P3>P3p — feedback signal, not just effort"}`; }
else if (P.p3.c + P.p3.t < P.p2.c + P.p2.t) { row = 5; reading = "feedback round harms → breakpoint-4 evidence (applied-then-overwritten); investigate round-2 diffs"; }
else if (!gt(P.p2, P.p1) && !gt(P.p3, P.p2)) { row = 4; reading = "entry inert as authored → rewrite H-23 (palette-level dos/don'ts) and re-probe on a second cell; retirement NOT permitted from this batch"; }
if (row === null) { row = 7; reading = "residual pattern — read paired transcripts manually; matrix rows exhausted"; }
if (P.p1.c >= 1) reading += " | NOTE row-7 signal: P1 contrast pass in-batch while r3 had 0/9 on this cell — replication gap, hypothesis only";

const report = `# M4 Contrastive Probe Report — ${new Date().toISOString()}

Batch m4-probe-20261024, cell-j13-s10, brief f1a0496c…, runtime 681653b4…,
appendix sha ${appendixSha.slice(0, 12)}…, playwright ${metas["s1-p0"].playwright_version}, model ${metas["s1-p0"].model_string}.

## Arm results (contrast c / type t, n)

- P0 (s1): c=${P.p0.c} t=${P.p0.t} (n=1)
- P1 (s2,s3): c=${P.p1.c} t=${P.p1.t} (n=2)
- P2 (s4,s5): c=${P.p2.c} t=${P.p2.t} (n=2)
- P3 (s6): c=${P.p3.c} t=${P.p3.t} (n=1, 2 rounds, F1)
- P3p (s7): c=${P.p3p.c} t=${P.p3p.t} (n=1, 2 rounds, F2 placebo)

## Trace checks

${SLOTS.map(([s, a]) => { const t = traces[`${s}-${a}`]; return t?.status === "ok" ? `- ${s}-${a}: T-c=${t.T_c_contrast_receipt} T-fs=${t.T_fs_no_sub12_fontsize.pass}${t.T_fs_no_sub12_fontsize.violations.length ? ` (${JSON.stringify(t.T_fs_no_sub12_fontsize.violations)})` : ""} T-fo=${t.T_fo_focus_rule.pass}` : `- ${s}-${a}: ${t?.status ?? "missing"}`; }).join("\n")}

## Readout (protocol §3 matrix, first match; row ${row})

**${reading}**

Per-slot details in runs/<slot>/; cost total recorded in operator-events.ndjson.
Action caps from protocol §3 apply (no retirement, no probe-mode adoption from this batch).
`;
writeFileSync(`${M4}/probe-report.md`, report);
opEv({ kind: "probe_complete", row, arms: P });
console.log("PROBE COMPLETE — row", row);
console.log(report);
