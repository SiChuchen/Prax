#!/usr/bin/env node
/**
 * M4 probe trace checks (protocol.md §3, frozen code).
 *   node trace-checks.mjs            — runs for all completed slots
 *   node trace-checks.mjs s4         — one slot
 * T-c  : contrast receipt pass (metadata.measurement.checks authority)
 * T-fs : no declared font-size < 12px anywhere in implementation/source
 * T-fo : a :focus/:focus-visible rule declaring outline/box-shadow exists
 *        (pre-registered LOW specificity — r3 run-02-b already passed it)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const M4 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m4-probe-20261024";
const SLOTS = ["s1-p0", "s2-p1", "s3-p1", "s4-p2", "s5-p2", "s6-p3", "s7-p3p"];

function traceOne(id) {
  const pkg = `${M4}/runs/${id}`;
  if (!existsSync(`${pkg}/execution/run-metadata.json`)) return { id, status: "not_run" };
  const meta = JSON.parse(readFileSync(`${pkg}/execution/run-metadata.json`, "utf8"));
  const T_c = meta.measurement?.checks?.["a11y.contrast"] === "pass";
  const violations = [];
  let T_fo = false;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(css|html?|js|mjs|vue|tsx|jsx)$/i.test(e.name)) continue;
      const t = readFileSync(p, "utf8");
      for (const m of t.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)) {
        if (parseFloat(m[1]) < 12) violations.push({ file: p.replace(/\\/g, "/").split("/implementation/source/")[1], px: m[1] });
      }
      if (/:focus(?:-visible)?\s*[^{]*\{[^}]*(outline|box-shadow)/is.test(t)) T_fo = true;
    }
  };
  walk(`${pkg}/implementation/source`);
  return {
    id, status: "ok",
    T_c_contrast_receipt: T_c,
    T_fs_no_sub12_fontsize: { pass: violations.length === 0, violations },
    T_fo_focus_rule: { pass: T_fo, specificity: "low_preregistered" },
    checks: meta.measurement?.checks ?? {},
  };
}

const ids = process.argv[2] ? [process.argv[2]] : SLOTS;
const out = ids.map(traceOne);
for (const r of out) writeFileSync(`${M4}/runs/${r.id}/trace-checks.json`, JSON.stringify(r, null, 2));
console.log(JSON.stringify(out.map((r) => ({ id: r.id, T_c: r.T_c_contrast_receipt, T_fs: r.T_fs_no_sub12_fontsize?.pass, T_fo: r.T_fo_focus_rule?.pass })), null, 1));
