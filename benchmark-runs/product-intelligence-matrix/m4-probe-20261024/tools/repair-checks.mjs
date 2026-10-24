import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
const M4 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m4-probe-20261024";
const fr = JSON.parse(readFileSync(`${M4}/freeze-record.json`, "utf8"));
const newH = createHash("sha256").update(readFileSync(`${M4}/tools/probe-run.mjs`)).digest("hex");
appendFileSync(`${M4}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), kind: "freeze_tool_revision", tool: "probe-run.mjs", old: fr.tools["probe-run.mjs"], new: newH, reason: "parseChecks v3: derive pass entries for unlisted ids whenever summary accounts for all 7 checks (partial-pass runs stored pass ids as undefined → readout undercounted; s6 final had contrast/type/target fixed but counted as 0). Readout semantics unchanged." }) + "\n");
fr.tools["probe-run.mjs"] = newH;
writeFileSync(`${M4}/freeze-record.json`, JSON.stringify(fr, null, 2));

const ALL = ["a11y.contrast", "a11y.focus_order", "a11y.target_size", "layout.overflow", "layout.responsive_collision", "text.truncation", "type.min_projected_size"];
function parse(stdout) {
  const c = {};
  for (const m of stdout.matchAll(/^\s*(pass|fail|skipped(?:\s*\([^)]*\))?)\s+([a-z0-9_.]+)\s*$/gm)) c[m[2]] = m[1];
  const sm = stdout.match(/summary:\s*pass=(\d+)\s+fail=(\d+)\s+skipped=(\d+)/);
  if (sm) {
    const listed = Object.keys(c).length;
    if (+sm[1] + +sm[2] + +sm[3] === 7 && listed === +sm[2] + +sm[3]) {
      for (const id of ALL) if (!(id in c)) c[id] = "pass";
    }
  }
  return c;
}
for (const s of ["s1-p0", "s2-p1", "s3-p1", "s4-p2", "s5-p2", "s6-p3", "s7-p3p"]) {
  const p = `${M4}/runs/${s}/execution/run-metadata.json`;
  const m = JSON.parse(readFileSync(p, "utf8"));
  const before = JSON.stringify(m.measurement.checks);
  const fixed = parse(m.measurement.stdout_tail || "");
  if (JSON.stringify(fixed) !== before) {
    m.measurement.checks = fixed;
    m.measurement.checks_repair = "2026-10-24 parseChecks v3 derivation (see freeze_tool_revision); raw stdout_tail unchanged";
    writeFileSync(p, JSON.stringify(m, null, 2));
    appendFileSync(`${M4}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), kind: "metadata_repair", slot: s, before, after: fixed }) + "\n");
    console.log("repaired", s, JSON.stringify(fixed));
  }
}
