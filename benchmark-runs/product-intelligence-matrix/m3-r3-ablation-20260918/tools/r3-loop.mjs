#!/usr/bin/env node
/**
 * M3 round-2 nightly driver (idempotent). Invoked by the 23:05 automation.
 * Window rules (operator, 2026-09-09): execute only 23:00–08:00 local;
 * NO new arm session after 06:30 (90-min budget ends by 08:00); no new
 * review session after 07:40. Everything resumes next night until done.
 *
 * Phases, each skipped when already complete:
 *   1. fast freeze verification (manifest hash + MCP entry hash)
 *   2. per-slot: run-one (synchronous) + package-one, in run-order
 *   3. build-blind -> review-loop R1 -> review-loop R2 -> lock -> analyze
 *   4. DONE marker for the automation session
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OP2 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918";
const OP1 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-20260906";
const REPO = "E:/codex-prj/Prax/Prax";
const FROZEN = "E:/codex-prj/pi-m3-frozen-runtime-r3-20260918";
const T = `${OP2}/tools`;
const log = (...a) => console.error(new Date().toISOString(), JSON.stringify(a));
const opEv = (obj) => appendFileSync(`${OP2}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
const minsNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const inLaunchWindow = () => { const m = minsNow(); return m >= 23 * 60 || m < 6 * 60 + 30; };
const inReviewWindow = () => { const m = minsNow(); return m >= 23 * 60 || m < 7 * 60 + 40; };

opEv({ kind: "r2_night_start", local: new Date().toString().slice(0, 24) });

// ---- phase 1: freeze verification ------------------------------------------
const man = readFileSync(`${OP1}/runtime-content-sha256.txt`, "utf8");
if (createHash("sha256").update(man).digest("hex") !== "23e770b3a48bf75111c9a56e963467fb8a7d40061f10ca06261dc33b5a3a4bab") {
  throw new Error("runtime manifest hash drifted — refusing to run");
}
const entry = createHash("sha256").update(readFileSync(`${FROZEN}/packages/prax-mcp/dist/stdio.js`)).digest("hex");
if (entry !== "1ca1783c34c1e1e0a625c6de4fd771dbd2effed7a8ed9ebace2f42d1aeaf8bb5") {
  throw new Error("frozen MCP entry hash drifted — refusing to run");
}
log("freeze verified");

// ---- phase 2: runs -----------------------------------------------------------
const order = readFileSync(`${OP2}/run-order.yaml`, "utf8");
const slots = [...order.matchAll(/- run: (\d+)\n\s+workspace: (\S+)\n\s+cell: (\S+)\n\s+arm: (\w)/g)]
  .map((m) => ({ run: `run-${m[1]}`, nn: m[1], ws: m[2], cell: m[3], arm: m[4] }));
let done = 0;
for (const s of slots) {
  const pkg = `${REPO}/benchmark-runs/product-intelligence-matrix/${s.cell}/m3/m3-r3-ablation-20260918-${s.run}-${s.arm}`;
  const metaPath = `${pkg}/execution/run-metadata.json`;
  const sumPath = `${pkg}/summary.yaml`;
  if (!existsSync(metaPath)) {
    if (!inLaunchWindow()) { log("launch window closed; resuming next night at slot", s.run); opEv({ kind: "r2_window_exit", next_slot: s.run }); process.exit(0); }
    log("START", s.run, s.ws);
    const r = spawnSync(process.execPath, [`${T}/run-one.mjs`, s.nn, s.ws], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
    if (!existsSync(metaPath)) {
      opEv({ kind: "infrastructure_fault", run: s.run, note: `run-one exited ${r.status} with no run-metadata (pre-launch failure); slot left open for retry decision` });
      log("NO METADATA for", s.run, "exit", r.status, "- skipping packaging");
      continue;
    }
  }
  if (!existsSync(sumPath)) {
    const p = spawnSync(process.execPath, [`${T}/package-one.mjs`, s.nn, s.ws], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
    if (p.status !== 0) opEv({ kind: "packaging_fault", run: s.run, exit: p.status });
  }
  if (existsSync(sumPath)) done++;
}
log("runs complete:", done, "/20");

// ---- phase 3: blind review ---------------------------------------------------
if (done === 20 && !existsSync(`${OP2}/review/private/mapping.json`)) {
  if (!inReviewWindow()) { log("review window closed; resuming next night"); opEv({ kind: "r2_window_exit", phase: "blind" }); process.exit(0); }
  spawnSync(process.execPath, [`${T}/build-blind.mjs`], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
}
const countScores = (R) => { const d = `${OP2}/review/scores/${R}`; return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".json")).length : 0; };
for (const R of ["R1", "R2"]) {
  const have = countScores(R);
  if (have >= 20) continue;
  if (!existsSync(`${OP2}/review/private/mapping.json`)) { log("blind packages not ready; exiting"); process.exit(0); }
  if (!inReviewWindow()) { log("review window closed before", R, "(", have, "/20 ); resuming next night"); opEv({ kind: "r2_window_exit", phase: "review", reviewer: R }); process.exit(0); }
  log("REVIEW", R, "from", have + 1);
  spawnSync(process.execPath, [`${T}/review-loop.mjs`, R, "07:40"], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
}

// ---- phase 4: lock + analyze --------------------------------------------------
if (countScores("R1") >= 20 && countScores("R2") >= 20 && !existsSync(`${OP2}/findings.yaml`)) {
  spawnSync(process.execPath, [`${T}/analyze.mjs`, "lock"], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  spawnSync(process.execPath, [`${T}/analyze.mjs`, "analyze"], { stdio: "inherit", env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
}
if (existsSync(`${OP2}/findings.yaml`)) {
  writeFileSync(`${OP2}/R3-COMPLETE`, new Date().toISOString() + "\n");
  opEv({ kind: "r2_complete", note: "runs+packaging+blind review+lock+analysis all complete; automation may be deleted" });
  log("R3 COMPLETE");
} else {
  log("night finished; will resume next night at 23:05");
}
