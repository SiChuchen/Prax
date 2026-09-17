#!/usr/bin/env node
/**
 * M5 transition input — mechanical audit of ALL Arm-B sessions across R1+R2.
 * Extracts per run: session count, phase, completed gates, disclosures
 * (which knowledge entries the router actually used), session duration,
 * validation-report item outcomes, self-measurement presence,
 * measurement_target declaration, corrections file presence.
 * Output: <m5>/b-session-audit.yaml + console summary.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const REPO = "E:/codex-prj/Prax/Prax";
const ROUNDS = [
  { round: 1, op: `${REPO}/benchmark-runs/product-intelligence-matrix/m3-20260906`, batch: "m3-20260906" },
  { round: 2, op: `${REPO}/benchmark-runs/product-intelligence-matrix/m3-r2-20260909`, batch: "m3-r2-20260909" },
];
const M5 = `${REPO}/benchmark-runs/product-intelligence-matrix/m5-transition`;
mkdirSync(M5, { recursive: true });

const out = [];
const knowledgeUse = {};
for (const { round, op, batch } of ROUNDS) {
  const order = readFileSync(`${op}/run-order.yaml`, "utf8");
  const slots = [...order.matchAll(/- run: (\d+)\n\s+workspace: (\S+)\n\s+cell: (\S+)\n\s+arm: (\w)/g)]
    .map((m) => ({ run: `run-${m[1]}`, ws: m[2], cell: m[3], arm: m[4] })).filter((s) => s.arm === "b");
  for (const s of slots) {
    const pkg = `${REPO}/benchmark-runs/product-intelligence-matrix/${s.cell}/m3/${batch}-${s.run}-b`;
    const art = `${pkg}/input/prax-artifacts`;
    const sessRoot = `${art}/design/sessions`;
    const row = { round, run: s.run, cell: s.cell };
    if (!existsSync(sessRoot)) { row.error = "no sessions dir"; out.push(row); continue; }
    const sessIds = readdirSync(sessRoot).filter((d) => !d.startsWith("."));
    row.session_count = sessIds.length;
    // use the latest session (by mtime) as the primary
    const primary = sessIds.map((id) => ({ id, m: statSync(join(sessRoot, id)).mtimeMs })).sort((a, b) => b.m - a.m)[0].id;
    const dir = join(sessRoot, primary);
    row.session_id = primary;
    const sess = readFileSync(join(dir, "session.yaml"), "utf8");
    row.phase = (sess.match(/^phase: (.*)$/m) ?? [])[1] ?? null;
    row.completed_gates = (sess.match(/^completed_gates:\n((?:  - .*\n)+)/m) ?? [])[1]?.split("\n").filter((l) => l.startsWith("  - ")).map((l) => l.slice(4)) ?? [];
    const created = (sess.match(/^created_at: (.*)$/m) ?? [])[1];
    const updated = (sess.match(/^updated_at: (.*)$/m) ?? [])[1];
    row.session_minutes = created && updated ? Math.round((new Date(updated) - new Date(created)) / 60000) : null;
    const disclosures = [...sess.matchAll(/- knowledge_id: (\S+)/g)].map((m) => m[1]);
    row.knowledge_disclosed = [...new Set(disclosures)];
    for (const k of row.knowledge_disclosed) knowledgeUse[k] = (knowledgeUse[k] ?? 0) + 1;
    // validation-report items
    const vrPath = join(dir, "validation-report.yaml");
    if (existsSync(vrPath)) {
      const vr = readFileSync(vrPath, "utf8");
      const outcomes = [...vr.matchAll(/outcome: (\w+)/g)].map((m) => m[1]);
      row.validation_items = { total: outcomes.length, pass: outcomes.filter((o) => o === "pass").length, fail: outcomes.filter((o) => o === "fail").length, inconclusive: outcomes.filter((o) => o === "inconclusive").length };
    } else row.validation_items = null;
    row.self_measurement = existsSync(join(dir, "validation-evidence"));
    const ib = join(dir, "implementation-brief.yaml");
    row.measurement_target_declared = existsSync(ib) && /measurement_target/.test(readFileSync(ib, "utf8"));
    row.corrections_file = existsSync(`${art}/corrections.yaml`);
    out.push(row);
  }
}
writeFileSync(`${M5}/b-session-audit.yaml`, `# Mechanical audit of all Arm-B sessions (R1+R2), generated ${new Date().toISOString()}\n` +
  out.map((r) => `- ${JSON.stringify(r)}`).join("\n") + `\n# knowledge_use_counts: ${JSON.stringify(knowledgeUse)}\n`);
console.log(JSON.stringify({
  b_runs: out.length,
  phase_COMPLETE: out.filter((r) => r.phase === "COMPLETE").length,
  full_chain_9_gates: out.filter((r) => (r.completed_gates?.length ?? 0) >= 9).length,
  self_measurement: out.filter((r) => r.self_measurement).length,
  measurement_target_declared: out.filter((r) => r.measurement_target_declared).length,
  validation_items_pass_total: out.reduce((s, r) => s + (r.validation_items?.pass ?? 0), 0),
  validation_items_nonpass_total: out.reduce((s, r) => s + ((r.validation_items?.total ?? 0) - (r.validation_items?.pass ?? 0)), 0),
  corrections_files: out.filter((r) => r.corrections_file).length,
  knowledge_use_counts: knowledgeUse,
  mean_session_minutes: Math.round(out.reduce((s, r) => s + (r.session_minutes ?? 0), 0) / out.filter((r) => r.session_minutes).length),
}, null, 2));
