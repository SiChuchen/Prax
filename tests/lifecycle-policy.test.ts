import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PraxService } from "prax-mcp";
import {
  advanceSession,
  checkOperationAllowed,
  DEFAULT_LEGACY_POLICY,
  DesignSessionSchema,
  FileSessionStore,
  GATE_PHASE,
  NEXT_TOOL_BY_GATE,
  PraxRuntimeError,
  lifecyclePolicyFor,
  normalizeCompletedGates,
  validateExistingUnderstanding,
  type DesignSession,
} from "prax-runtime";
import { architectureProductFrame, intentLite, requirementConfirmation, reworkUnderstanding } from "./fixtures.js";

const FULL_TAIL = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];
const REWORK_TAIL = ["context", "route", "decide", "sdir", "prepare", "validate"];

describe("lifecycle policy", () => {
  it("expands each supported mode and change kind into its gate sequence", () => {
    expect(lifecyclePolicyFor("greenfield").gates).toEqual(["confirm", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("rework").gates).toEqual(["confirm", "understanding", "framing", ...REWORK_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "add_surface").gates).toEqual(["confirm", "understanding", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "modify_surface").gates).toEqual([
      "confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate",
    ]);
    expect(lifecyclePolicyFor("existing_product", "visual_polish").gates).toEqual(["confirm", "intent_lite", "validate"]);
    expect(lifecyclePolicyFor("existing_product", "defect_fix").gates).toEqual(["confirm", "intent_lite", "validate"]);
  });

  it("rejects invalid combinations and preserves a rework change_kind hint", () => {
    expect(() => lifecyclePolicyFor("greenfield", "defect_fix")).toThrowError(PraxRuntimeError);
    expect(() => lifecyclePolicyFor("existing_product")).toThrowError(PraxRuntimeError);
    const rework = lifecyclePolicyFor("rework", "modify_surface");
    expect(rework.gates).toEqual(["confirm", "understanding", "framing", ...REWORK_TAIL]);
    expect(rework.change_kind).toBe("modify_surface");
  });

  it("keeps the legacy default policy equivalent to the old flow", () => {
    expect(DEFAULT_LEGACY_POLICY.gates).toEqual(["framing", ...FULL_TAIL]);
  });

  it("maps every gate to a phase and a next tool", () => {
    expect(GATE_PHASE.confirm).toBe("REQUIREMENT_CONFIRMATION");
    expect(GATE_PHASE.understanding).toBe("UNDERSTANDING");
    expect(GATE_PHASE.intent_lite).toBe("INTENT_LITE");
    expect(GATE_PHASE.sdir_delta).toBe("SDIR");
    for (const gate of DEFAULT_LEGACY_POLICY.gates) {
      expect(GATE_PHASE[gate]).toBeDefined();
      expect(NEXT_TOOL_BY_GATE[gate]).toBeDefined();
    }
  });

  it("normalizes legacy gate names recorded by the old state machine", () => {
    expect(
      normalizeCompletedGates([
        "frame", "context", "route", "decide", "sdir", "reconcile", "prepare_implementation", "validation",
      ]),
    ).toEqual(["framing", "context", "route", "decide", "sdir", "reconcile", "prepare", "validate"]);
    expect(normalizeCompletedGates(["framing", "validate"])).toEqual(["framing", "validate"]);
  });
});

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("session policy persistence", () => {
  it("stores the policy snapshot, authorities, and starts at the first gate phase", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-policy-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_policy" });
    const session = await store.createSession({
      projectRoot,
      requirement: "Rework the console",
      mode: "rework",
      lifecyclePolicy: lifecyclePolicyFor("rework"),
      designAuthorities: ["docs/DESIGN.md"],
    });
    expect(session.lifecycle_policy?.gates[0]).toBe("confirm");
    expect(session.phase).toBe("REQUIREMENT_CONFIRMATION");
    expect(session.design_authorities).toEqual(["docs/DESIGN.md"]);
  });

  it("parses legacy sessions without policy or authorities", () => {
    const legacy = DesignSessionSchema.parse({
      id: "ds_old", project_root: "/tmp/p", mode: "greenfield", phase: "PRODUCT_FRAMING",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
      requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "product_framing" },
      disclosures: [], routing_history: [], artifacts: {}, unresolved: [], warnings: [],
    });
    expect(legacy.lifecycle_policy).toBeUndefined();
    expect(legacy.design_authorities).toEqual([]);
  });
});

function sessionWith(gates: string[], completed: string[], phase: string, mode = "existing_product"): DesignSession {
  return {
    id: "ds_sm", project_root: "/tmp/p", mode, phase,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
    requirement_ref: "requirement.md", completed_gates: completed, current_gate: { name: "next" },
    disclosures: [], routing_history: [], artifacts: {}, unresolved: [], warnings: [],
    design_authorities: [],
    lifecycle_policy: { version: "1" as const, mode: "existing_product" as const, change_kind: "modify_surface" as const, gates },
  } as never;
}

describe("policy-driven state machine", () => {
  const modify = ["confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate"];

  it("allows the operation owning the current gate and blocks others with the next tool", () => {
    const session = sessionWith(modify, ["confirm"], "UNDERSTANDING");
    expect(checkOperationAllowed(session, "design_frame")).toBeUndefined();
    const blocked = checkOperationAllowed(session, "design_decide");
    expect(blocked?.status).toBe("BLOCK");
    expect(blocked?.next).toEqual({ tool: "design_frame" });
  });

  it("advances past a gate onto the next gate's phase", () => {
    const advanced = advanceSession(sessionWith(modify, ["confirm"], "UNDERSTANDING"), "understanding", "2026-08-26T00:00:00.000Z");
    expect(advanced.phase).toBe("ROUTING");
    expect(advanced.completed_gates).toContain("understanding");
  });

  it("resumes legacy sessions from mid-flow phases via gate alias normalization", () => {
    for (const [phase, completed, expectedTool] of [
      ["CONTEXT", ["frame"], "design_context"],
      ["ROUTING", ["frame", "context"], "design_route"],
      ["SDIR", ["frame", "context", "route", "decide"], "design_sdir"],
      ["IMPLEMENTATION_READY", ["frame", "context", "route", "decide", "sdir", "reconcile"], "design_prepare_implementation"],
      ["VALIDATION", ["frame", "context", "route", "decide", "sdir", "reconcile", "prepare_implementation"], "design_validate"],
      ["COMPLETE", ["frame", "context", "route", "decide", "sdir", "reconcile", "prepare_implementation", "validation"], "design_validate"],
    ] as const) {
      const legacy = sessionWith([], [...completed], phase, "greenfield");
      (legacy as { lifecycle_policy?: unknown }).lifecycle_policy = undefined;
      const allowed = ["design_route", "design_context", "design_sdir", "design_prepare_implementation", "design_validate"];
      const op = allowed.find((candidate) => checkOperationAllowed(legacy, candidate as never) === undefined);
      expect(op).toBeDefined();
      const blocked = checkOperationAllowed(legacy, "design_decide");
      expect(blocked?.next).toEqual({ tool: expectedTool });
    }
  });
});

describe("requirement confirmation gate", () => {
  async function setup() {
    const root = await mkdtemp(join(tmpdir(), "prax-confirm-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_confirm" });
    const service = await PraxService.create({ sessions: store });
    return { service, projectRoot, store };
  }

  it("creates a session awaiting confirmation and accepts the resume submission", async () => {
    const { service, projectRoot, store } = await setup();
    const created = await service.designStart({ requirement: "Build a canvas", project_root: projectRoot, mode: "greenfield" });
    expect(created.status).toBe("PASS");
    expect(created.phase).toBe("REQUIREMENT_CONFIRMATION");
    expect(created.next).toEqual({ tool: "design_start" });

    const confirmed = await service.designStart({ design_session_id: "ds_confirm", requirement_confirmation: requirementConfirmation() });
    expect(confirmed.status).toBe("PASS");
    expect(confirmed.phase).toBe("PRODUCT_FRAMING");
    expect((await store.getSession("ds_confirm")).artifacts.requirementConfirmation).toBeDefined();
  });

  it("accepts a complete confirmation inline at creation", async () => {
    const { service, projectRoot } = await setup();
    const started = await service.designStart({
      requirement: "Build a canvas",
      project_root: projectRoot,
      mode: "greenfield",
      requirement_confirmation: requirementConfirmation(),
    });
    expect(started.status).toBe("PASS");
    expect(started.phase).toBe("PRODUCT_FRAMING");
  });

  it("rejects an empty out_of_scope with EXPAND", async () => {
    const { service, projectRoot } = await setup();
    await service.designStart({ requirement: "Build a canvas", project_root: projectRoot, mode: "greenfield" });
    const bad = { ...requirementConfirmation(), boundaries: { in_scope: ["x"], out_of_scope: [] } };
    const result = await service.designStart({ design_session_id: "ds_confirm", requirement_confirmation: bad });
    expect(result.status).toBe("EXPAND");
    expect(JSON.stringify(result)).toMatch(/out_of_scope/);
  });

  it("blocks invalid mode combinations at creation", async () => {
    const { service, projectRoot } = await setup();
    const result = await service.designStart({ requirement: "x", project_root: projectRoot, mode: "greenfield", change_kind: "defect_fix" });
    expect(result.status).toBe("BLOCK");
    expect(result.code).toBe("UNKNOWN_LIFECYCLE_POLICY");
  });
});

describe("existing understanding validation", () => {
  const existingInput = {
    version: "0.1" as const,
    current_objects: [{ id: "architecture_node", user_name: "架构节点", purpose: "系统组成部分", evidence_refs: ["app/architecture"] }],
    current_surfaces: [{ id: "canvas", purpose: "架构画布" }, { id: "settings", purpose: "配置" }],
    established_patterns: ["PAT-CANVAS-WORKSPACE"],
    user_habits: ["左侧导航切换"],
    constraints_and_debt: [],
    change_targets: ["settings"],
    design_authorities: ["docs/DESIGN.md"],
  };

  const reworkInput = {
    version: "0.1" as const,
    current_objects: [{ id: "architecture_node", user_name: "架构节点", purpose: "系统组成部分", evidence_refs: ["app/architecture"] }],
    current_surfaces: [{ id: "canvas", purpose: "架构画布" }],
    actual_usage: ["从画布进、逐节点排查"],
    pain_points: ["全局关系一屏太多，聚焦后丢失方位"],
    must_preserve: ["flow 数据", "canvas"],
    must_replace: ["architecture_node"],
    free_to_reconsider: [],
    migration_notes: ["旧入口保留一个月"],
    design_authorities: ["docs/DESIGN.md"],
  };

  it("accepts complete understandings for both modes", () => {
    expect(validateExistingUnderstanding(existingInput, "existing_product", "modify_surface").status).toBe("PASS");
    expect(validateExistingUnderstanding(reworkInput, "rework").status).toBe("PASS");
  });

  it("rejects change targets that do not map to declared surfaces", () => {
    const bad = { ...existingInput, change_targets: ["billing"] };
    const result = validateExistingUnderstanding(bad, "existing_product", "modify_surface");
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("CHANGE_TARGET_NOT_DECLARED");
  });

  it("requires pain points and exclusive, covering buckets for rework", () => {
    const noPain = validateExistingUnderstanding({ ...reworkInput, pain_points: [] }, "rework");
    expect(noPain.codes).toContain("REWORK_PAIN_POINTS_MISSING");

    const conflicting = validateExistingUnderstanding({ ...reworkInput, free_to_reconsider: ["canvas"] }, "rework");
    expect(conflicting.codes).toContain("REWORK_BUCKET_CONFLICT");

    const uncovered = validateExistingUnderstanding({ ...reworkInput, must_preserve: [] }, "rework");
    expect(uncovered.codes).toContain("REWORK_COVERAGE_INCOMPLETE");
  });
});

describe("design frame payload dispatch", () => {
  async function confirmedService(mode: "rework" | "existing_product", changeKind?: "modify_surface" | "visual_polish") {
    const root = await mkdtemp(join(tmpdir(), "prax-frame-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_frame" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "x",
      project_root: projectRoot,
      mode,
      ...(changeKind === undefined ? {} : { change_kind: changeKind }),
      requirement_confirmation: requirementConfirmation(),
    });
    return { service, store };
  }

  it("routes an understanding payload through the understanding gate for rework", async () => {
    const { service } = await confirmedService("rework");
    const result = await service.designFrame({ design_session_id: "ds_frame", existing_understanding: reworkUnderstanding() });
    expect(result.status).toBe("PASS");
    expect(result.phase).toBe("PRODUCT_FRAMING");
  });

  it("routes an intent-lite payload and persists a lightweight brief", async () => {
    const { service, store } = await confirmedService("existing_product", "visual_polish");
    const result = await service.designFrame({ design_session_id: "ds_frame", intent_lite: intentLite("visual_polish") });
    expect(result.status).toBe("PASS");
    expect(result.phase).toBe("VALIDATION");
    const session = await store.getSession("ds_frame");
    const brief = await store.readArtifact<{ mode_plan?: unknown }>(session, "implementationBrief");
    expect(JSON.stringify(brief)).toMatch(/change_list/);
  });

  it("rejects a product frame while the session expects understanding", async () => {
    const { service } = await confirmedService("rework");
    const result = await service.designFrame({ design_session_id: "ds_frame", product_frame: architectureProductFrame() });
    expect(result.status).toBe("EXPAND");
    expect(JSON.stringify(result)).toMatch(/existing_understanding/);
  });
});
