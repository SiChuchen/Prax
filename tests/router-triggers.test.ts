import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KnowledgeStore } from "prax-knowledge";
import { DesignRouter } from "prax-router";
import type { DesignContext, ProductFrame } from "prax-runtime";
import { architectureContext, architectureProductFrame } from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function frame02(verb: string, objectType: string): ProductFrame {
  const frame = architectureProductFrame() as Record<string, unknown>;
  return {
    ...frame,
    version: "0.2",
    jtbd: { verb, target: "模块间依赖", success: "三分钟内定位共享影响" },
    primary_object: { type: objectType },
    task_model: { frequency: "medium", reversibility: "reversible", consequence: "low", expertise: "mixed" },
  } as unknown as ProductFrame;
}

async function storeWith(entriesYaml: string): Promise<KnowledgeStore> {
  const dir = await mkdtemp(join(tmpdir(), "prax-router-trig-"));
  cleanup.push(dir);
  await writeFile(join(dir, "knowledge.yaml"), `version: "0.2"\nentries:\n${entriesYaml}`, "utf8");
  return KnowledgeStore.fromDirectory(dir);
}

const BASE_HEURISTIC = (id: string, triggerConditionsYaml: string) => `  - id: ${id}
    type: heuristic
    asset_class: heuristic
    stability: A
    name: Probe ${id}
    summary: Probe entry ${id}.
    category: probe
    scope: {}
    triggers: [${id.toLowerCase()}]
    trigger_conditions: ${triggerConditionsYaml}
    lifecycle: { status: stable }
    evidence: { authority_initial: B, review_by: "2026-10-01" }
    provenance: { source_refs: [probe], authority_category: interaction_design, certainty: high, recommendation_strength: moderate }
    validation: { mode: assistive, checks: [] }
    statement: Probe statement ${id}.
    applies_when: [probing]
    rationale: Trigger-condition weighting probe.
`;

const MYTH_ENTRY = `  - id: myth-probe-default
    type: myth
    asset_class: myth
    stability: C
    name: Probe default myth
    summary: A quarantined default.
    category: negative_knowledge
    scope: {}
    triggers: [probe, default]
    trigger_conditions: { phase: [decision] }
    lifecycle: { status: stable }
    evidence: { authority_initial: B, review_by: "2026-10-01" }
    provenance: { source_refs: [probe], authority_category: sample_coding, certainty: high, recommendation_strength: strong }
    validation: { mode: assistive, checks: [] }
    statement: The probe default is universal.
    applies_when: [never]
    rationale: Probe.
    refutation: The probe corpus refutes universality.
    correct_ref: PAT-DATA-EXPLORER
`;

function contextWith(densityIntent: string): DesignContext {
  const context = architectureContext() as Record<string, unknown>;
  return { ...context, density_intent: densityIntent } as unknown as DesignContext;
}

describe("router trigger_conditions (Task K2, spec §7.1/§7.2)", () => {
  it("weights by matched facets: more specific entries outrank generic ones", async () => {
    const store = await storeWith(
      BASE_HEURISTIC("H-GENERIC", "{}") +
        BASE_HEURISTIC("H-TASK", "{ task_type: [explore] }") +
        BASE_HEURISTIC("H-TASK-DENSITY", "{ task_type: [explore], density: [high] }"),
    );
    const router = new DesignRouter(store);
    const result = router.route(
      frame02("explore", "canvas_object"),
      contextWith("compact"),
      "probe which heuristic applies",
    );
    const heuristics = (result.heuristics ?? []) as Array<{ id: string; routing: { scope_match: string[] } }>;
    expect(heuristics.length).toBeGreaterThanOrEqual(2);
    expect(heuristics[0]?.id).toBe("H-TASK-DENSITY");
    expect(heuristics[0]?.routing.scope_match).toContain("trigger_condition:density");
    expect(heuristics[0]?.routing.scope_match).toContain("trigger_condition:task_type");
    expect(heuristics.find((entry) => entry.id === "H-TASK")?.routing.scope_match).toContain("trigger_condition:task_type");
  });

  it("intra-facet OR matches any listed verb; cross-facet partial matches get partial credit", async () => {
    const store = await storeWith(
      BASE_HEURISTIC("H-OR", "{ task_type: [scan, review, explore] }") +
        BASE_HEURISTIC("H-PARTIAL", "{ task_type: [explore], platform: [web_mobile] }"),
    );
    const router = new DesignRouter(store);
    const result = router.route(
      frame02("explore", "canvas_object"),
      contextWith("regular"),
      "probe OR semantics",
    );
    const heuristics = (result.heuristics ?? []) as Array<{ id: string; routing: { scope_match: string[] } }>;
    expect(heuristics.find((entry) => entry.id === "H-OR")).toBeDefined();
    const partial = heuristics.find((entry) => entry.id === "H-PARTIAL");
    // the platform facet mismatches (web_desktop context) — only the task facet counts
    expect(partial?.routing.scope_match).toContain("trigger_condition:task_type");
    expect(partial?.routing.scope_match).not.toContain("trigger_condition:platform");
  });

  it("object_type and phase facets participate when the 0.2 frame carries them", async () => {
    const store = await storeWith(
      BASE_HEURISTIC("H-OBJECT", "{ object_type: [canvas_object], phase: [decision] }"),
    );
    const router = new DesignRouter(store);
    const result = router.route(
      frame02("explore", "canvas_object"),
      contextWith("regular"),
      "probe object and phase facets",
    );
    const heuristics = (result.heuristics ?? []) as Array<{ routing: { scope_match: string[] } }>;
    expect(heuristics[0]?.routing.scope_match).toContain("trigger_condition:object_type");
    expect(heuristics[0]?.routing.scope_match).toContain("trigger_condition:phase");
  });

  it("myth asset_class entries are never routed by default", async () => {
    const store = await storeWith(MYTH_ENTRY + BASE_HEURISTIC("H-NORMAL", "{}"));
    const router = new DesignRouter(store);
    const result = router.route(frame02("explore", "canvas_object"), contextWith("regular"), "probe default");
    const allIds = [
      ...((result.principles ?? []) as Array<{ id: string }>),
      ...((result.heuristics ?? []) as Array<{ id: string }>),
      ...((result.patterns ?? []) as Array<{ id: string }>),
      ...((result.platform_profile ?? []) as Array<{ id: string }>),
    ].map((entry) => entry.id);
    expect(allIds).not.toContain("myth-probe-default");
    expect((result.excluded ?? []).map((entry: { id: string }) => entry.id)).not.toContain("myth-probe-default");
  });
});
