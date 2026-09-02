import { describe, expect, it } from "vitest";
import { PraxValidator } from "prax-validator";
import type { ValidationPlan } from "prax-validator";
import { SdirEngine, type Sdir } from "prax-sdir";
import { architectureContext, architectureDecisions, architectureProductFrame, sdirDelta } from "./fixtures.js";

const STRUCTURE_CHECK_IDS = [
  "representation_decided",
  "state_ownership_declared",
  "acceptance_contract_present",
  "complexity_budget_declared",
];

function frame02() {
  const frame = architectureProductFrame();
  return {
    ...frame,
    version: "0.2" as const,
    jtbd: { verb: "understand" as const, target: "模块间依赖", success: "三分钟内定位共享影响" },
    primary_object: { type: "canvas_object" as const },
    task_model: { frequency: "medium" as const, reversibility: "reversible" as const, consequence: "low" as const, expertise: "mixed" as const },
  };
}

function sdir02(): Sdir {
  return {
    version: "0.2",
    screen: {
      id: "canvas_workspace_screen",
      intent: { primary_task: "多选聚合显示影响", secondary_tasks: [] },
      archetype: { pattern_ref: "PAT-CANVAS-WORKSPACE" },
      density_intent: "regular",
      regions: [
        { id: "architecture", role: "dominant_workspace", importance: "dominant", visibility: { condition: "always" }, behavior_intent: ["spatial_overview"] },
        { id: "inspector", role: "contextual_inspector", importance: "contextual", visibility: { condition: "selection_driven" }, behavior_intent: ["selection_driven"] },
      ],
      relationships: [],
      interaction_intents: ["direct_selection"],
      required_states: ["loading", "empty", "ready", "selected", "error"],
      decision_points: [{ id: "dp1", question: "如何呈现共享影响", adapter_may_choose: ["叠加标注"] }],
      unresolved: [],
      rejected_alternatives: [],
      user_job: { verb: "understand", target: "模块间依赖", success: "三分钟内定位共享影响" },
      primary_object: { type: "canvas_object" },
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
      representation: { primary: { type: "canvas", reason: "关系密度高" }, supporting: [] },
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
  } as Sdir;
}

function sdir01(): Sdir {
  const engine = new SdirEngine();
  return engine.generate(architectureProductFrame(), architectureContext(), architectureDecisions("ds_v1"));
}

describe("SDIR 0.2 structure checks (Task V1, spec §6.5)", () => {
  it("assembles the four checks only for 0.2 sessions", () => {
    const validator = new PraxValidator();
    const plan02 = validator.plan({ policyContext: { mode: "greenfield" }, frame: frame02() as never }) as ValidationPlan;
    for (const id of STRUCTURE_CHECK_IDS) {
      expect(plan02.checks.map((check) => check.id)).toContain(id);
    }
    const plan01 = validator.plan({ policyContext: { mode: "greenfield" }, frame: architectureProductFrame() as never }) as ValidationPlan;
    for (const id of STRUCTURE_CHECK_IDS) {
      expect(plan01.checks.map((check) => check.id)).not.toContain(id);
    }
  });

  it("all four pass on a complete 0.2 SDIR", async () => {
    const validator = new PraxValidator();
    const plan = validator.plan({ policyContext: { mode: "greenfield" }, frame: frame02() as never }) as ValidationPlan;
    const evaluation = await validator.evaluate({ plan, sdir: sdir02() });
    const structureFindings = evaluation.findings.filter((finding) => STRUCTURE_CHECK_IDS.includes(finding.check_id));
    expect(structureFindings.filter((finding) => finding.outcome === "pass")).toHaveLength(4);
  });

  it("a 0.2 session with a 0.1 SDIR fails the three hard structure checks", async () => {
    const validator = new PraxValidator();
    const plan = validator.plan({ policyContext: { mode: "greenfield" }, frame: frame02() as never }) as ValidationPlan;
    const evaluation = await validator.evaluate({ plan, sdir: sdir01() });
    const byId = new Map(evaluation.findings.map((finding) => [finding.check_id, finding.outcome]));
    expect(byId.get("representation_decided")).toBe("fail");
    expect(byId.get("state_ownership_declared")).toBe("fail");
    expect(byId.get("acceptance_contract_present")).toBe("fail");
    expect(evaluation.status).toBe("BLOCK");
  });

  it("a missing complexity_budget records a warning, not a failure", async () => {
    const validator = new PraxValidator();
    const plan = validator.plan({ policyContext: { mode: "greenfield" }, frame: frame02() as never }) as ValidationPlan;
    const withoutBudget = sdir02();
    if (withoutBudget.version !== "0.2") throw new Error("unreachable");
    delete (withoutBudget.screen as { complexity_budget?: unknown }).complexity_budget;
    const evaluation = await validator.evaluate({ plan, sdir: withoutBudget });
    const budget = evaluation.findings.find((finding) => finding.check_id === "complexity_budget_declared");
    expect(budget?.outcome).toBe("pass");
    expect(evaluation.warnings.some((warning) => warning.includes("complexity_budget_declared"))).toBe(true);
  });
});
