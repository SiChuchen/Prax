import { describe, expect, it } from "vitest";
import { DesignDecideInputSchema, DesignFrameInputSchema, DesignSdirInputSchema } from "prax-mcp";
import { checkSdirRepresentationDrift } from "prax-runtime";
import { SdirEngine } from "prax-sdir";
import { architectureContext, architectureDecisions, architectureProductFrame } from "./fixtures.js";

function flattenedFramePayload() {
  const frame = architectureProductFrame() as Record<string, unknown>;
  return {
    design_session_id: "ds_i1",
    product_frame: {
      ...frame,
      version: "0.2",
      jtbd: { verb: "understand", target: "模块间依赖", success: "三分钟内定位共享影响" },
      primary_object: { type: "canvas_object", label: "架构节点" },
      task_model: { frequency: "medium", reversibility: "reversible", consequence: "low", expertise: "mixed" },
    },
  };
}

function flattenedDecidePayload() {
  const decisions = architectureDecisions("ds_i1") as Record<string, unknown>;
  return {
    design_session_id: "ds_i1",
    design_decisions: {
      ...decisions,
      version: "0.2",
      information_shape: {
        cardinality: "many",
        relationality: "high",
        hierarchy: "medium",
        temporality: "low",
        density: "medium",
      },
      representation: {
        primary: { type: "canvas", reason: "关系密度高，空间位置承载语义" },
        supporting: [],
        rejected: [{ option: "table", reason: "并排比较困难" }],
      },
    },
  };
}

function sdir02Payload(primaryType: string) {
  return {
    version: "0.2",
    screen: {
      id: "canvas_workspace_screen",
      intent: { primary_task: "多选聚合显示影响", secondary_tasks: [] },
      density_intent: "regular",
      regions: [
        { id: "architecture", role: "dominant_workspace", importance: "dominant", visibility: { condition: "always" }, behavior_intent: ["spatial_overview"] },
      ],
      interaction_intents: ["direct_selection"],
      required_states: ["loading", "empty", "ready", "error"],
      decision_points: [{ id: "dp1", question: "如何呈现", adapter_may_choose: ["叠加"] }],
      user_job: { verb: "understand", target: "模块间依赖", success: "三分钟内定位共享影响" },
      primary_object: { type: "canvas_object" },
      information_shape: {
        cardinality: "many",
        relationality: "high",
        hierarchy: "medium",
        temporality: "low",
        density: "medium",
      },
      representation: { primary: { type: primaryType, reason: "理由" }, supporting: [] },
      priority: { primary: ["architecture"], contextual: [] },
      state_ownership: [{ state: "selection", owner: "architecture" }],
      acceptance: ["选择三个节点后共享影响在 1s 内高亮"],
    },
  };
}

describe("MCP 0.2 payload integration (Task I1, spec §6.3 flattening recipe)", () => {
  it("client schemas accept flattened 0.2 payloads without any nested union", () => {
    expect(DesignFrameInputSchema.safeParse(flattenedFramePayload()).success).toBe(true);
    expect(DesignDecideInputSchema.safeParse(flattenedDecidePayload()).success).toBe(true);
    const sdirInput = { design_session_id: "ds_i1", mode: "validate" as const, sdir: sdir02Payload("canvas") };
    expect(DesignSdirInputSchema.safeParse(sdirInput).success).toBe(true);
  });

  it("a 0.1 sdir payload round-trips unchanged", () => {
    const engine = new SdirEngine();
    const legacy = engine.generate(architectureProductFrame(), architectureContext(), architectureDecisions("ds_i1")) as unknown;
    const parsed = DesignSdirInputSchema.safeParse({ design_session_id: "ds_i1", mode: "validate", sdir: legacy });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sdir).toEqual(legacy);
    }
  });

  it("SDIR_REPRESENTATION_DRIFT reviews when decide and SDIR primaries disagree", () => {
    const decisions = (flattenedDecidePayload().design_decisions) as unknown as Parameters<typeof checkSdirRepresentationDrift>[1];
    const drifted = checkSdirRepresentationDrift(sdir02Payload("graph"), decisions);
    expect(drifted).toBeDefined();
    expect(drifted?.code).toBe("SDIR_REPRESENTATION_DRIFT");

    const agreeing = checkSdirRepresentationDrift(sdir02Payload("canvas"), decisions);
    expect(agreeing).toBeUndefined();
  });

  it("the drift cross-check is a no-op for 0.1 artifacts", () => {
    const engine = new SdirEngine();
    const legacySdir = engine.generate(architectureProductFrame(), architectureContext(), architectureDecisions("ds_i1")) as unknown;
    const legacyDecisions = architectureDecisions("ds_i1") as unknown as Parameters<typeof checkSdirRepresentationDrift>[1];
    expect(checkSdirRepresentationDrift(legacySdir, legacyDecisions)).toBeUndefined();
  });
});
