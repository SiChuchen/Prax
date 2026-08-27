import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  architectureUnderstanding,
  intentLite,
  requirementConfirmation,
  reworkUnderstanding,
  sdirDelta,
  directCodeConditions,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startSession(sessionId: string, mode: "greenfield" | "existing_product" | "rework", changeKind?: string, requirement = "一个中文需求") {
  const root = await mkdtemp(join(tmpdir(), "prax-lifecycle-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  const started = await service.designStart({
    requirement,
    project_root: projectRoot,
    mode,
    ...(changeKind === undefined ? {} : { change_kind: changeKind as never }),
    requirement_confirmation: requirementConfirmation(),
  });
  expect(started.status).toBe("PASS");
  return { service, store };
}

async function driveStandardFlow(service: PraxService, sessionId: string, confirmedPatternFallback: string) {
  await service.designFrame({ design_session_id: sessionId, product_frame: architectureProductFrame() });
  await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "选择承载主任务的界面结构" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? confirmedPatternFallback;
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "对比候选模式" },
  });
  const decided = await service.designDecide({
    design_session_id: sessionId,
    design_decisions: {
      session_id: sessionId,
      primary_structure: { pattern: patternId, rationale: ["匹配主任务"], confidence: "high" },
      information_hierarchy: { primary: ["architecture"], secondary: ["navigation", "inspector"] },
      density: { intent: "compact", strategy: ["perceptual grouping"], avoid: ["card per entity"] },
      major_choices: [],
      rejected: [{ option: "PAT-SETTINGS-SECTIONS", reason: "非配置任务" }],
      unresolved: [],
    },
  });
  expect(decided.status).toMatch(/PASS|WARN/);
  return { patternId };
}

describe("mode-differentiated lifecycle end to end", () => {
  it("existing_product + add_surface reaches an integration plan", async () => {
    const { service } = await startSession("ds_add", "existing_product", "add_surface", "给控制台加一个画布视图");
    await service.designFrame({ design_session_id: "ds_add", existing_understanding: architectureUnderstanding([]) });
    const frameResult = await service.designFrame({ design_session_id: "ds_add", product_frame: architectureProductFrame() });
    expect(frameResult.phase).toBe("CONTEXT");
    await service.designContext({ design_session_id: "ds_add", design_context: architectureContext() });
    const routed = await service.designRoute({ design_session_id: "ds_add", question: "新面用什么结构" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
    await service.designInspect({
      design_session_id: "ds_add",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
    });
    await service.designDecide({
      design_session_id: "ds_add",
      design_decisions: {
        session_id: "ds_add",
        primary_structure: { pattern: patternId, rationale: ["匹配"], confidence: "high" },
        information_hierarchy: { primary: ["architecture"], secondary: [] },
        density: { intent: "compact", strategy: ["grouping"], avoid: [] },
        major_choices: [],
        rejected: [{ option: "PAT-LIST-DETAIL", reason: "非列表任务" }],
        unresolved: [],
      },
    });
    await service.designSdir({ design_session_id: "ds_add", mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: "ds_add", capability_map: architectureCapabilities() });
    await service.designRealize({ design_session_id: "ds_add", mode: "propose", realization_mode: "direct_code", conditions: directCodeConditions() });
    const prepared = await service.designPrepareImplementation({ design_session_id: "ds_add", platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    const brief = prepared.implementation_brief as { mode_plan: { integration_plan: unknown } };
    expect(brief.mode_plan.integration_plan).toBeDefined();
    const planned = await service.designValidate({ design_session_id: "ds_add", mode: "plan" });
    expect(planned.status).toBe("EXPAND");
  });

  it("existing_product + modify_surface reaches a change sequence and delta validation", async () => {
    const { service } = await startSession("ds_mod", "existing_product", "modify_surface", "把设置页改成分区检索式");
    await service.designFrame({ design_session_id: "ds_mod", existing_understanding: architectureUnderstanding(["settings"]) });
    const routed = await service.designRoute({ design_session_id: "ds_mod", question: "如何在设置页承载检索" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-SETTINGS-SECTIONS";
    await service.designInspect({
      design_session_id: "ds_mod",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认分区模式" },
    });
    await service.designDecide({
      design_session_id: "ds_mod",
      design_decisions: {
        session_id: "ds_mod",
        primary_structure: { pattern: patternId, rationale: ["分区"], confidence: "high" },
        information_hierarchy: { primary: ["settings"], secondary: ["search"] },
        density: { intent: "regular", strategy: ["分区标题"], avoid: [] },
        major_choices: [],
        rejected: [{ option: "长表单", reason: "检索成本高" }],
        unresolved: [],
      },
    });
    await service.designSdir({ design_session_id: "ds_mod", mode: "apply_delta", sdir_delta: sdirDelta() });
    const prepared = await service.designPrepareImplementation({ design_session_id: "ds_mod", platform: "web_desktop", framework: "react" });
    const brief = prepared.implementation_brief as { mode_plan: { change_sequence: unknown[] } };
    expect(brief.mode_plan.change_sequence.length).toBeGreaterThan(0);
    const planned = await service.designValidate({ design_session_id: "ds_mod", mode: "plan" });
    const checks = planned.checks as Array<{ id: string }>;
    expect(checks.map((check) => check.id)).toContain("delta_conformance");
  });

  it("existing_product + visual_polish runs the light path with a light check set", async () => {
    const { service } = await startSession("ds_polish", "existing_product", "visual_polish", "把设置页字阶调小");
    await service.designFrame({ design_session_id: "ds_polish", existing_understanding: architectureUnderstanding(["settings"]) });
    const intent = await service.designFrame({ design_session_id: "ds_polish", intent_lite: intentLite("visual_polish") });
    expect(intent.status).toBe("PASS");
    expect(intent.phase).toBe("VALIDATION");
    const planned = await service.designValidate({ design_session_id: "ds_polish", mode: "plan" });
    const checks = planned.checks as Array<{ id: string }>;
    const ids = checks.map((check) => check.id);
    expect(ids).toContain("hierarchy_preserved");
    expect(ids).toContain("readability");
    expect(ids).not.toContain("semantic_conformance");
  });

  it("existing_product + defect_fix runs the lightest path with regression checks only", async () => {
    const { service } = await startSession("ds_fix", "existing_product", "defect_fix", "修复设置按钮焦点丢失");
    await service.designFrame({ design_session_id: "ds_fix", existing_understanding: architectureUnderstanding(["settings"]) });
    const intent = await service.designFrame({ design_session_id: "ds_fix", intent_lite: intentLite("defect_fix") });
    expect(intent.phase).toBe("VALIDATION");
    const planned = await service.designValidate({ design_session_id: "ds_fix", mode: "plan" });
    const ids = (planned.checks as Array<{ id: string }>).map((check) => check.id);
    expect(ids).toContain("regression_check");
    expect(ids).toContain("requirement_alignment");
    expect(ids).not.toContain("semantic_conformance");
  });

  it("rework reaches a migration plan and rework checks", async () => {
    const { service } = await startSession("ds_rework", "rework", undefined, "重做观测控制台");
    await service.designFrame({ design_session_id: "ds_rework", existing_understanding: reworkUnderstanding() });
    await driveStandardFlow(service, "ds_rework", "PAT-CANVAS-WORKSPACE");
    await service.designSdir({ design_session_id: "ds_rework", mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: "ds_rework", capability_map: architectureCapabilities() });
    await service.designRealize({ design_session_id: "ds_rework", mode: "propose", realization_mode: "direct_code", conditions: directCodeConditions() });
    const prepared = await service.designPrepareImplementation({ design_session_id: "ds_rework", platform: "web_desktop", framework: "react" });
    const brief = prepared.implementation_brief as { mode_plan: { migration_plan: { per_surface: Array<{ treatment: string }> } } };
    expect(brief.mode_plan.migration_plan.per_surface.every((entry) => ["preserve", "rework"].includes(entry.treatment))).toBe(true);
    const planned = await service.designValidate({ design_session_id: "ds_rework", mode: "plan" });
    const ids = (planned.checks as Array<{ id: string }>).map((check) => check.id);
    expect(ids).toContain("fresh_derivation_check");
    expect(ids).toContain("migration_readiness");
  });

  it("greenfield inlines the confirmation in a single design_start call", async () => {
    const { service } = await startSession("ds_green", "greenfield", undefined, "从零做一个架构画布");
    await driveStandardFlow(service, "ds_green", "PAT-CANVAS-WORKSPACE");
    const sdir = await service.designSdir({ design_session_id: "ds_green", mode: "generate_from_decisions" });
    expect(sdir.status).toBe("PASS");
    expect(sdir.phase).toBe("CAPABILITY_RECONCILIATION");
  });
});
