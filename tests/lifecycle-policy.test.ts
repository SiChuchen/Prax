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
  validateIntentLite,
  validateRequirementConfirmation,
  type DesignSession,
} from "prax-runtime";
import { architectureCapabilities, architectureContext, architectureDecisions, architectureProductFrame, architectureUnderstanding, intentLite, requirementConfirmation, reworkUnderstanding, sdirDelta } from "./fixtures.js";
import { validateSdirDelta } from "prax-sdir";
import { PraxValidator } from "prax-validator";

const FULL_TAIL = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];
const REWORK_TAIL = FULL_TAIL;

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
    surface_context: { density: "regular", user_expertise: "mixed", destructive_actions: "none", task_frequency: "medium" },
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

describe("sdir delta", () => {
  const delta = {
    version: "0.1",
    surface: "settings",
    base_regions: [
      { id: "settings_navigation", role: "primary_navigation", importance: "supporting" },
      { id: "settings", role: "configuration_sections", importance: "primary" },
    ],
    changes: [
      { region: "settings", action: "modify", fields: { importance: "dominant" }, rationale: "配置成为主要任务" },
      { region: "search", action: "add", role: "supporting_toolbar", rationale: "长列表需要检索" },
    ],
    preserved: ["settings_navigation"],
    regression_points: ["键盘路径", "保存态可见性"],
    capability_needs: [],
  };

  it("accepts a well-formed delta", () => {
    expect(validateSdirDelta(delta).status).toBe("PASS");
  });

  it("rejects changes targeting regions outside base ∪ adds", () => {
    const bad = structuredClone(delta);
    bad.changes[0].region = "ghost";
    const result = validateSdirDelta(bad);
    expect(result.status).toBe("RETRY");
    expect(result.semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RELATION_REGION_NOT_FOUND");
  });

  it("rejects duplicate adds", () => {
    const dup = structuredClone(delta);
    dup.changes.push({ region: "search", action: "add", role: "supporting_toolbar", rationale: "重复添加" });
    expect(validateSdirDelta(dup).semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_REGION_ID_DUPLICATE");
  });

  it("rejects render-level leakage at any depth", () => {
    const bad = structuredClone(delta);
    bad.changes[0].fields = { layout: { width: "320px" } };
    const result = validateSdirDelta(bad);
    expect(result.semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RENDER_LEVEL_LEAK");
  });

  it("validates preserved references", () => {
    const bad = structuredClone(delta);
    bad.preserved = ["ghost_surface"];
    expect(validateSdirDelta(bad).semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RELATION_REGION_NOT_FOUND");
  });
});

describe("modify_surface path", () => {
  async function modifySession(sessionId: string, requirement: string) {
    const root = await mkdtemp(join(tmpdir(), "prax-modify-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement,
      project_root: projectRoot,
      mode: "existing_product",
      change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });
    return { service, store };
  }

  it("runs confirm → understanding → route → decide → sdir_delta with persisted derived inputs", async () => {
    const { service, store } = await modifySession("ds_modify", "把设置页改成分区检索式");
    const understood = await service.designFrame({
      design_session_id: "ds_modify",
      existing_understanding: architectureUnderstanding(["settings"]),
    });
    expect(understood.phase).toBe("ROUTING");

    const routed = await service.designRoute({ design_session_id: "ds_modify", question: "如何在设置页承载检索与分区" });
    expect(routed.status).toMatch(/PASS|EXPAND/);
    const session = await store.getSession("ds_modify");
    expect(session.artifacts.productFrame).toBeDefined();
    expect(session.artifacts.designContext).toBeDefined();
    expect(session.warnings.join(" ")).toMatch(/derived/i);

    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-SETTINGS-SECTIONS";
    await service.designInspect({
      design_session_id: "ds_modify",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认分区模式适合设置页改造" },
    });
    const decided = await service.designDecide({
      design_session_id: "ds_modify",
      design_decisions: {
        session_id: "ds_modify",
        primary_structure: { pattern: patternId, rationale: ["分区承载不同目标"], confidence: "high" },
        information_hierarchy: { primary: ["settings"], secondary: ["search"] },
        density: { intent: "regular", strategy: ["分区标题"], avoid: ["后端配置顺序"] },
        major_choices: [],
        rejected: [{ option: "单页长表单", reason: "检索成本高" }],
        unresolved: [],
      },
    });
    expect(decided.status).toMatch(/PASS|WARN/);

    const delta = await service.designSdir({ design_session_id: "ds_modify", mode: "apply_delta", sdir_delta: sdirDelta() });
    expect(delta.status).toBe("PASS");
    expect(delta.phase).toBe("IMPLEMENTATION_READY");
  });

  it("inserts the reconcile gate when a delta declares capability needs", async () => {
    const { service } = await modifySession("ds_capneed", "设置页需要后端检索接口");
    await service.designFrame({ design_session_id: "ds_capneed", existing_understanding: architectureUnderstanding(["settings"]) });
    const routed = await service.designRoute({ design_session_id: "ds_capneed", question: "检索如何承载" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-SETTINGS-SECTIONS";
    await service.designInspect({
      design_session_id: "ds_capneed",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
    });
    await service.designDecide({
      design_session_id: "ds_capneed",
      design_decisions: {
        session_id: "ds_capneed",
        primary_structure: { pattern: patternId, rationale: ["分区"], confidence: "high" },
        information_hierarchy: { primary: ["settings"], secondary: ["search"] },
        density: { intent: "regular", strategy: ["分区标题"], avoid: [] },
        major_choices: [],
        rejected: [{ option: "长表单", reason: "检索成本高" }],
        unresolved: [],
      },
    });
    const needy = { ...sdirDelta(), capability_needs: ["backend search endpoint"] };
    const delta = await service.designSdir({ design_session_id: "ds_capneed", mode: "apply_delta", sdir_delta: needy });
    expect(delta.status).toBe("PASS");
    expect(delta.phase).toBe("CAPABILITY_RECONCILIATION");
    expect(delta.next).toEqual({ tool: "design_reconcile" });
  });
});

describe("mode-differentiated implementation brief", () => {
  it("attaches a migration plan for rework sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-brief-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_brief" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({ requirement: "重做控制台", project_root: projectRoot, mode: "rework", requirement_confirmation: requirementConfirmation() });
    await service.designFrame({ design_session_id: "ds_brief", existing_understanding: reworkUnderstanding() });
    await service.designFrame({ design_session_id: "ds_brief", product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: "ds_brief", design_context: architectureContext() });
    const routed = await service.designRoute({ design_session_id: "ds_brief", question: "选择主工作区模式" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0].id;
    await service.designInspect({
      design_session_id: "ds_brief",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
    });
    await service.designDecide({ design_session_id: "ds_brief", design_decisions: architectureDecisions("ds_brief") });
    await service.designSdir({ design_session_id: "ds_brief", mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: "ds_brief", capability_map: architectureCapabilities() });
    const prepared = await service.designPrepareImplementation({ design_session_id: "ds_brief", platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    const brief = prepared.implementation_brief as { mode_plan: { migration_plan: { per_surface: Array<{ treatment: string }> } } };
    expect(brief.mode_plan.migration_plan.per_surface.length).toBeGreaterThan(0);
    expect(brief.mode_plan.migration_plan.per_surface.every((entry) => ["preserve", "rework"].includes(entry.treatment))).toBe(true);
  });
});

describe("policy-aware validation plans", () => {
  const validator = new PraxValidator();
  const base = { frame: architectureProductFrame(), context: architectureContext(), decisions: architectureDecisions("x") };

  it("adds existing-product and rework checks", () => {
    const ids = (policyContext: Record<string, unknown>) =>
      validator.plan({ ...base, policyContext: policyContext as never }).checks.map((check: { id: string }) => check.id);
    expect(ids({ mode: "existing_product", change_kind: "add_surface" })).toContain("untouched_surface_regression");
    expect(ids({ mode: "rework" })).toContain("fresh_derivation_check");
    expect(ids({ mode: "rework" })).toContain("migration_readiness");
    expect(ids({ mode: "greenfield" })).toContain("requirement_alignment");
  });

  it("uses delta-aware checks for modify_surface instead of full-SDIR checks", () => {
    const plan = validator.plan({ ...base, policyContext: { mode: "existing_product", change_kind: "modify_surface" } as never });
    const ids = plan.checks.map((check: { id: string }) => check.id);
    expect(ids).toContain("delta_conformance");
    expect(ids).toContain("untouched_surface_regression");
    expect(ids).not.toContain("semantic_conformance");
    expect(ids).not.toContain("state_completeness");
  });

  it("uses light-path checks without requiring frame or decisions", () => {
    const plan = validator.plan({
      policyContext: { mode: "existing_product", change_kind: "visual_polish" } as never,
      intentLite: intentLite("visual_polish"),
    });
    const ids = plan.checks.map((check: { id: string }) => check.id);
    expect(ids).toContain("hierarchy_preserved");
    expect(ids).toContain("readability");
    expect(ids).not.toContain("semantic_conformance");
    expect(plan.pattern_ref).toBeUndefined();
  });
});

describe("requirement scope completeness", () => {
  async function polishService() {
    const root = await mkdtemp(join(tmpdir(), "prax-scope-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_scope" });
    const service = await PraxService.create({ sessions: store });
    return { service, projectRoot };
  }

  it("accepts an empty out_of_scope only with an explicit scope_complete declaration", async () => {
    const { service, projectRoot } = await polishService();
    await service.designStart({ requirement: "修复登录按钮焦点丢失", project_root: projectRoot, mode: "existing_product", change_kind: "defect_fix" });

    const boilerplate = { ...requirementConfirmation(), boundaries: { in_scope: ["login focus"], out_of_scope: [] } };
    const rejected = await service.designStart({ design_session_id: "ds_scope", requirement_confirmation: boilerplate });
    expect(rejected.status).toBe("EXPAND");

    const declared = {
      ...requirementConfirmation(),
      boundaries: { in_scope: ["login focus"], out_of_scope: [], scope_complete: true },
    };
    const accepted = await service.designStart({ design_session_id: "ds_scope", requirement_confirmation: declared });
    expect(accepted.status).toBe("PASS");
  });
});

describe("apply_delta mode semantics", () => {
  it("rejects a delta payload under the generate mode at the sdir_delta gate", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-deltamode-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_dmode" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "改设置页", project_root: projectRoot, mode: "existing_product", change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });
    await service.designFrame({ design_session_id: "ds_dmode", existing_understanding: architectureUnderstanding(["settings"]) });
    await service.designRoute({ design_session_id: "ds_dmode", question: "如何改" });
    const session = await store.getSession("ds_dmode");
    const routedIds = session.routing_history.flatMap((record) => record.selected_ids);
    const patternId = routedIds.find((id) => id.startsWith("PAT-")) ?? "PAT-SETTINGS-SECTIONS";
    await service.designInspect({
      design_session_id: "ds_dmode", ids: [patternId], depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认" },
    });
    await service.designDecide({
      design_session_id: "ds_dmode",
      design_decisions: {
        session_id: "ds_dmode",
        primary_structure: { pattern: patternId, rationale: ["分区"], confidence: "high" },
        information_hierarchy: { primary: ["settings"], secondary: ["search"] },
        density: { intent: "regular", strategy: ["分区标题"], avoid: [] },
        major_choices: [], rejected: [{ option: "长表单", reason: "x" }], unresolved: [],
      },
    });
    const rejected = await service.designSdir({ design_session_id: "ds_dmode", mode: "generate_from_decisions", sdir_delta: sdirDelta() });
    expect(rejected.status).toBe("RETRY");
    expect(JSON.stringify(rejected)).toMatch(/apply_delta/);
  });
});

describe("confirmation evidence model", () => {
  it("blocks a pending confirmation and warns on brief-sufficient confirmations", () => {
    const pending = { ...requirementConfirmation(), confirmation: { status: "pending_user_confirmation" as const, evidence: [{ type: "task_brief" as const, ref: "brief" }], confirmed_at: "2026-08-26T00:00:00.000Z" } };
    const blocked = validateRequirementConfirmation(pending);
    expect(blocked.status).toBe("BLOCK");
    expect(blocked.codes).toContain("CONFIRMATION_PENDING");

    const sufficient = { ...requirementConfirmation(), confirmation: { status: "requirement_is_sufficient" as const, evidence: [{ type: "task_brief" as const, ref: "docs/task.md" }], confirmed_at: "2026-08-26T00:00:00.000Z" } };
    const warned = validateRequirementConfirmation(sufficient);
    expect(warned.status).toBe("WARN");
    expect(warned.warnings.join(" ")).toMatch(/self-sufficient/);
  });
});

describe("surface context for derived routing", () => {
  it("requires surface_context on modify_surface understandings", () => {
    const missing = architectureUnderstanding(["settings"]);
    delete (missing as { surface_context?: unknown }).surface_context;
    const result = validateExistingUnderstanding(missing, "existing_product", "modify_surface");
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("SURFACE_CONTEXT_REQUIRED");
    expect(validateExistingUnderstanding(missing, "existing_product", "add_surface").status).toMatch(/PASS|WARN/);
  });

  it("derives routing context from surface_context instead of defaults", async () => {
    const dense = architectureUnderstanding(["settings"]);
    dense.surface_context = { density: "compact", user_expertise: "expert", destructive_actions: "high", task_frequency: "high" };
    const root = await mkdtemp(join(tmpdir(), "prax-sctx-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_sctx" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "改设置页", project_root: projectRoot, mode: "existing_product", change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });
    await service.designFrame({ design_session_id: "ds_sctx", existing_understanding: dense });
    await service.designRoute({ design_session_id: "ds_sctx", question: "如何改" });
    const persisted = await store.readArtifact(await store.getSession("ds_sctx"), "designContext");
    expect(persisted).toMatchObject({
      density_intent: "compact",
      user: { expertise: "expert" },
      risk: { destructive_actions: "high" },
      task: { frequency: "high" },
    });
  });
});

describe("change impact classification", () => {
  it("rejects structural work declared as visual_polish via impact flags", () => {
    const restructuring = intentLite("visual_polish");
    restructuring.change = "把设置页从单列表单重组为左侧导航加多分区";
    restructuring.impact.changes_region_structure = true;
    const result = validateIntentLite(restructuring, "visual_polish");
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("LIFECYCLE_KIND_MISMATCH");
    expect(result.issues.join(" ")).toMatch(/modify_surface/);
  });

  it("rejects structural vocabulary in a change declared as a defect fix", () => {
    const sneaky = intentLite("defect_fix");
    sneaky.change = "修复焦点丢失：重组页面布局，新增左侧导航区域";
    const result = validateIntentLite(sneaky, "defect_fix");
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("LIFECYCLE_KIND_MISMATCH");
  });

  it("flags product-object impact as rework", () => {
    const remodel = intentLite("visual_polish");
    remodel.impact.changes_product_objects = true;
    const result = validateIntentLite(remodel, "visual_polish");
    expect(result.status).toBe("REVIEW");
    expect(result.issues.join(" ")).toMatch(/rework/);
  });

  it("rejects light intents naming surfaces absent from the understanding", () => {
    const unknownSurface = intentLite("visual_polish");
    unknownSurface.surfaces = ["billing"];
    const result = validateIntentLite(unknownSurface, "visual_polish", architectureUnderstanding(["settings"]));
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("SURFACE_NOT_DECLARED");
  });

  it("accepts a genuinely light intent", () => {
    const polish = intentLite("visual_polish");
    polish.change = "字阶 token 降一级，间距收紧";
    const result = validateIntentLite(polish, "visual_polish");
    expect(result.status).toBe("PASS");
  });

  it("rejects a modify delta targeting a surface outside the understanding", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-imp-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_imp" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "改设置页", project_root: projectRoot, mode: "existing_product", change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });
    await service.designFrame({ design_session_id: "ds_imp", existing_understanding: architectureUnderstanding(["settings"]) });
    await service.designRoute({ design_session_id: "ds_imp", question: "如何改" });
    const session = await store.getSession("ds_imp");
    const patternId = session.routing_history.flatMap((record) => record.selected_ids).find((id) => id.startsWith("PAT-")) ?? "PAT-SETTINGS-SECTIONS";
    await service.designInspect({
      design_session_id: "ds_imp", ids: [patternId], depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认" },
    });
    await service.designDecide({
      design_session_id: "ds_imp",
      design_decisions: {
        session_id: "ds_imp",
        primary_structure: { pattern: patternId, rationale: ["分区"], confidence: "high" },
        information_hierarchy: { primary: ["settings"], secondary: ["search"] },
        density: { intent: "regular", strategy: ["分区标题"], avoid: [] },
        major_choices: [], rejected: [{ option: "长表单", reason: "x" }], unresolved: [],
      },
    });
    const newSurface = { ...sdirDelta(), surface: "brand_new_workspace" };
    const rejected = await service.designSdir({ design_session_id: "ds_imp", mode: "apply_delta", sdir_delta: newSurface });
    expect(rejected.status).toBe("REVIEW");
    expect(rejected.code).toBe("LIFECYCLE_KIND_MISMATCH");
  });
});
