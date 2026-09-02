import { describe, expect, it } from "vitest";
import { SDIR_VOCAB, SdirSchema, type SdirV02 } from "prax-sdir";

function validV02(): SdirV02 {
  return {
    version: "0.2",
    screen: {
      id: "canvas_screen",
      intent: { primary_task: "多选聚合显示影响", secondary_tasks: [] },
      archetype: { pattern_ref: "PAT-CANVAS-WORKSPACE" },
      density_intent: "regular",
      regions: [
        { id: "architecture", role: "dominant_workspace", importance: "dominant", visibility: { condition: "always" }, behavior_intent: ["spatial_overview"] },
        { id: "inspector", role: "contextual_inspector", importance: "contextual", visibility: { condition: "selection_driven" }, behavior_intent: ["selection_driven"] },
      ],
      relationships: [],
      interaction_intents: ["direct_selection"],
      required_states: ["loading", "empty", "ready", "error"],
      decision_points: [{ id: "dp1", question: "如何呈现共享影响", adapter_may_choose: ["叠加标注"] }],
      unresolved: [],
      rejected_alternatives: [],
      user_job: { verb: "understand", target: "模块间依赖", success: "三分钟内定位共享影响的模块" },
      primary_object: { type: "canvas_object", label: "架构画布节点" },
      information_shape: {
        cardinality: "many",
        relationality: "high",
        hierarchy: "medium",
        temporality: "low",
        density: "medium",
        dimensionality: "low",
        spatiality: "physical",
        volatility: "low",
        uncertainty: "low",
        comparison_need: "required",
      },
      representation: {
        primary: { type: "canvas", reason: "关系密度高且空间位置承载语义" },
        supporting: [{ type: "tree", reason: "层级总览需要折叠视图" }],
      },
      priority: { primary: ["architecture"], contextual: ["inspector"] },
      interaction: { preview: "hover", inspect: "select", navigate: "drill", locate: "search" },
      state_ownership: [
        { state: "selection", owner: "architecture" },
        { state: "preview", owner: "session" },
      ],
      complexity_budget: {
        permanent_panels: 2,
        permanent_primary_actions: 3,
        modes: 0,
        state_owners: 2,
        navigation_levels: 1,
        persistent_filters: 0,
        new_semantic_concepts: 1,
        keyboard_contracts: 2,
        mobile_conflicts: 0,
        permanent_surfaces: 2,
      },
      acceptance: ["选择三个节点后共享影响在 1s 内高亮"],
    },
  } as SdirV02;
}

function v01Document() {
  return {
    version: "0.1",
    screen: {
      id: "legacy",
      intent: { primary_task: "任务", secondary_tasks: [] },
      archetype: { pattern_ref: "PAT-DATA-EXPLORER" },
      density_intent: "regular",
      regions: [
        { id: "data", role: "collection", importance: "dominant", visibility: { condition: "always" }, behavior_intent: [] },
      ],
      relationships: [],
      interaction_intents: ["filter_then_inspect"],
      required_states: ["loading", "empty", "ready", "error"],
      decision_points: [{ id: "dp1", question: "问题", adapter_may_choose: ["选项"] }],
    },
  };
}

describe("SDIR 0.2 discriminated union (Task S1, spec §6.1)", () => {
  it("parses a 0.2 document exercising every new block", () => {
    const parsed = SdirSchema.parse(validV02());
    expect(parsed.version).toBe("0.2");
    if (parsed.version !== "0.2") throw new Error("unreachable");
    expect(parsed.screen.user_job.verb).toBe("understand");
    expect(parsed.screen.representation.primary.type).toBe("canvas");
    expect(parsed.screen.information_shape.comparison_need).toBe("required");
  });

  it("still parses 0.1 documents unchanged", () => {
    const parsed = SdirSchema.parse(v01Document());
    expect(parsed.version).toBe("0.1");
  });

  it("rejects version 0.3", () => {
    const bad = { ...validV02(), version: "0.3" } as unknown;
    expect(SdirSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects priority referencing a nonexistent region id", () => {
    const bad = validV02();
    bad.screen.priority = { primary: ["nonexistent"], contextual: [] };
    expect(SdirSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a state_ownership owner outside regions ∪ {session, url}", () => {
    const bad = validV02();
    bad.screen.state_ownership = [{ state: "selection", owner: "global_store" }];
    expect(SdirSchema.safeParse(bad).success).toBe(false);
    const urlOwner = validV02();
    urlOwner.screen.state_ownership = [{ state: "query", owner: "url" }];
    expect(SdirSchema.safeParse(urlOwner).success).toBe(true);
  });

  it("rejects empty acceptance", () => {
    const bad = validV02();
    bad.screen.acceptance = [];
    expect(SdirSchema.safeParse(bad).success).toBe(false);
  });

  it("vocabulary tables are pinned and accept the two first amendments", () => {
    expect(SDIR_VOCAB.version).toBe("2026-09");
    expect(SDIR_VOCAB.jtbd_verbs).toHaveLength(19);
    expect(SDIR_VOCAB.object_types).toHaveLength(16);
    expect(SDIR_VOCAB.representation_primitives).toHaveLength(22);
    expect(SDIR_VOCAB.jtbd_verbs).toContain("understand");
    expect(SDIR_VOCAB.representation_primitives).toContain("architecture");
    // out-of-table values are rejected in each enum position
    const verb = validV02();
    (verb.screen.user_job as { verb: string }).verb = "vibe";
    expect(SdirSchema.safeParse(verb).success).toBe(false);
    const object = validV02();
    (object.screen.primary_object as { type: string }).type = "spreadsheet";
    expect(SdirSchema.safeParse(object).success).toBe(false);
    const repr = validV02();
    (repr.screen.representation.primary as { type: string }).type = "metaverse";
    expect(SdirSchema.safeParse(repr).success).toBe(false);
  });

  it("fills interaction defaults and keeps complexity_budget optional", () => {
    const minimal = validV02();
    delete (minimal.screen as { interaction?: unknown }).interaction;
    delete (minimal.screen as { complexity_budget?: unknown }).complexity_budget;
    delete (minimal.screen as { archetype?: unknown }).archetype;
    const parsed = SdirSchema.parse(minimal);
    if (parsed.version !== "0.2") throw new Error("unreachable");
    expect(parsed.screen.interaction).toEqual({ preview: "none", inspect: "select", navigate: "none", locate: "none" });
    expect(parsed.screen.complexity_budget).toBeUndefined();
    expect(parsed.screen.archetype).toBeUndefined();
  });
});
