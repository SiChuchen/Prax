#!/usr/bin/env node
/**
 * Knowledge 0.1 → 0.2 migration (spec §7.1/§7.2, plan Task K1).
 *
 *   node migrate-02.mjs <input-knowledge.yaml> <output-dir>
 *
 * Writes <output-dir>/knowledge.yaml (version 0.2) and the human-handoff
 * draft <output-dir>/stability-assignments.draft.yaml. Mapping sources:
 * - trigger_conditions: the structured `scope` field only (free-text
 *   `triggers` stays advisory)
 * - type → asset_class: principle/heuristic/pattern literal;
 *   platform_convention → profile (NOT a literal translation);
 *   myth → myth; product_evidence → validation_asset
 * - lifecycle.status → stability: reviewed → B; stable → A PROVISIONAL
 *   (every entry lands in the draft unconfirmed — human confirmation is the
 *   sanctioned promotion path); draft/deprecated → C
 * - task_type vocabulary is aligned through the pinned synonym table below;
 *   unmappable values are dropped with a warning
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";

const TASK_TYPE_SYNONYMS = {
  browse: "explore",
  inspect: "review",
  trace: "locate",
  filter: "locate",
  configure: "manage",
  administer: "manage",
};
const DENSITY_SYNONYMS = {
  compact: "high",
  regular: "medium",
  spacious: "low",
};
const PHASE_SYNONYMS = {
  product_framing: "framing",
  routing: "routing",
  context: "context",
  decision: "decision",
  sdir: "sdir",
  validation: "validation",
};
const ASSET_CLASS_BY_TYPE = {
  principle: "principle",
  heuristic: "heuristic",
  pattern: "pattern",
  platform_convention: "profile",
  myth: "myth",
  product_evidence: "validation_asset",
};
const STABILITY_BY_STATUS = {
  reviewed: "B",
  stable: "A",
  draft: "C",
  deprecated: "C",
};
// authority_initial (D2/D5 source-authority tier) has no mechanical source in
// the 0.1 data; the migration derives a provisional tier from the provenance
// category until human review assigns the final grade
const AUTHORITY_BY_CATEGORY = {
  established_design_research: "A",
  interaction_design: "B",
  usability_research: "B",
  platform_documentation: "B",
  sample_coding: "C",
  project_evidence: "D",
};

const [inputPath, outputDir] = process.argv.slice(2);
if (inputPath === undefined || outputDir === undefined) {
  console.error("usage: migrate-02.mjs <input-knowledge.yaml> <output-dir>");
  process.exit(2);
}

const document = parse(await readFile(inputPath, "utf8"));
if (document?.version !== "0.1") {
  console.error(`expected a 0.1 knowledge document, found version '${document?.version}'`);
  process.exit(2);
}

const warnings = [];
const assignments = [];
const entries = document.entries.map((entry) => {
  const JTBD_VERBS = ["scan", "locate", "navigate", "compare", "monitor", "create", "edit", "manage", "decide", "transact", "communicate", "explore", "learn", "explain", "understand", "control", "troubleshoot", "complete", "review"];
  const taskType = (entry.scope?.task_type ?? []).flatMap((verb) => {
    const mapped = TASK_TYPE_SYNONYMS[verb] ?? (JTBD_VERBS.includes(verb) ? verb : undefined);
    if (mapped === undefined) {
      warnings.push(`${entry.id}: task_type '${verb}' has no 19-verb mapping — dropped from trigger_conditions (triggers stay advisory)`);
      return [];
    }
    return [mapped];
  });
  const phase = (entry.scope?.phase ?? []).flatMap((phaseName) => {
    const mapped = PHASE_SYNONYMS[phaseName];
    if (mapped === undefined) {
      warnings.push(`${entry.id}: phase '${phaseName}' unmappable — dropped from trigger_conditions`);
      return [];
    }
    return [mapped];
  });
  const platform = entry.scope?.platform ?? [];
  const density = (entry.scope?.density ?? []).flatMap((value) => {
    const mapped = DENSITY_SYNONYMS[value];
    if (mapped === undefined) {
      warnings.push(`${entry.id}: density '${value}' unmappable — dropped from trigger_conditions`);
      return [];
    }
    return [mapped];
  });

  const stability = STABILITY_BY_STATUS[entry.lifecycle?.status] ?? "C";
  assignments.push({ id: entry.id, stability, confirmed: false });

  return {
    ...entry,
    asset_class: ASSET_CLASS_BY_TYPE[entry.type] ?? "heuristic",
    stability,
    trigger_conditions: {
      ...(taskType.length > 0 ? { task_type: [...new Set(taskType)] } : {}),
      ...(platform.length > 0 ? { platform } : {}),
      ...(density.length > 0 ? { density } : {}),
      ...(phase.length > 0 ? { phase } : {}),
    },
    evidence: {
      authority_initial: AUTHORITY_BY_CATEGORY[entry.provenance?.authority_category] ?? "C",
      review_by: entry.lifecycle?.review_by ?? "2026-12-31",
      ...(entry.provenance?.source_refs?.[0] !== undefined
        ? { source_version: String(entry.provenance.source_refs[0]) }
        : {}),
    },
  };
});

await mkdir(outputDir, { recursive: true });
await writeFile(
  join(outputDir, "knowledge.yaml"),
  stringify({ version: "0.2", entries }, { lineWidth: 0 }),
  "utf8",
);
await writeFile(
  join(outputDir, "stability-assignments.draft.yaml"),
  stringify(
    {
      version: "0.2",
      note: "PROVISIONAL — human confirmation required before these stability grades count as final (plan Task K1 handoff; spec §7.2).",
      assignments,
    },
    { lineWidth: 0 },
  ),
  "utf8",
);

console.log(`migrated ${entries.length} entries → ${join(outputDir, "knowledge.yaml")}`);
console.log(`draft assignments → ${join(outputDir, "stability-assignments.draft.yaml")}`);
for (const warning of warnings) {
  console.warn(`warn: ${warning}`);
}
