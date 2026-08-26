import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore, type CompiledContext, type CompilationTrace, type Correction } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  architectureUnderstanding,
  requirementConfirmation,
  sdirDelta,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function settingsCorrection(): Correction {
  return {
    id: "corr_settings_001",
    scope: { project: "architecture_canvas", surfaces: ["settings"] },
    finding: { type: "hierarchy_semantics", observed: "search competed with navigation" },
    intended: { statement: "search stays supporting" },
    evidence_refs: ["human_review_001"],
    regression: { check_id: "settings_search_supporting" },
    supersedes: [],
    promotion: { candidate: false },
    created_at: "2026-08-26T00:00:00.000Z",
  };
}

async function preparedModifySession(corrections: Correction[], sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-cc-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const stateRoot = join(root, "state");
  await mkdir(stateRoot, { recursive: true });
  if (corrections.length > 0) {
    await writeFile(join(stateRoot, "corrections.yaml"), stringify({ version: "0.1", corrections }), "utf8");
  }
  const store = new FileSessionStore({ stateRoot, idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  await service.designStart({
    requirement: "把设置页改成分区检索式",
    project_root: projectRoot,
    mode: "existing_product",
    change_kind: "modify_surface",
    requirement_confirmation: requirementConfirmation(),
  });
  await service.designFrame({
    design_session_id: sessionId,
    existing_understanding: architectureUnderstanding(["settings"]),
  });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "如何在设置页承载检索" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-SETTINGS-SECTIONS";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认分区模式" },
  });
  await service.designDecide({
    design_session_id: sessionId,
    design_decisions: {
      session_id: sessionId,
      primary_structure: { pattern: patternId, rationale: ["分区"], confidence: "high" },
      information_hierarchy: { primary: ["settings"], secondary: ["search"] },
      density: { intent: "regular", strategy: ["分区标题"], avoid: [] },
      major_choices: [],
      rejected: [{ option: "长表单", reason: "检索成本高" }],
      unresolved: [],
    },
  });
  await service.designSdir({ design_session_id: sessionId, mode: "apply_delta", sdir_delta: sdirDelta() });
  const prepared = await service.designPrepareImplementation({
    design_session_id: sessionId,
    platform: "web_desktop",
    framework: "react",
  });
  expect(prepared.status).toBe("PASS");
  return { service, store, prepared };
}

describe("task-scoped context compilation", () => {
  it("compiles relationships, corrections, unresolved and locked plan into the packet with a trace", async () => {
    const { prepared } = await preparedModifySession([settingsCorrection()], "ds_cc_1");
    const compiled = prepared.compiled_context as CompiledContext;
    const trace = prepared.context_compilation_trace as CompilationTrace;

    expect(compiled.task.surfaces).toEqual(["settings"]);
    expect(
      compiled.product_relationships.map((relationship) => relationship.id),
    ).toContain("rel_current_node_preference");
    expect(compiled.corrections).toEqual([
      { id: "corr_settings_001", check_id: "settings_search_supporting", intended: "search stays supporting" },
    ]);
    expect(compiled.validation.plan_revision).toBe(1);
    expect(compiled.validation.check_ids).toContain("delta_conformance");
    expect(compiled.validation.regression_check_ids).toEqual(["settings_search_supporting"]);
    expect(compiled.must_preserve).toBeDefined();

    expect(trace.selected.map((entry) => entry.ref)).toContain("validation-plan@1");
    expect(trace.excluded.map((entry) => entry.ref)).toContain("routing-log");
  });

  it("excludes unrelated corrections with a scope reason instead of dumping them", async () => {
    const billing: Correction = {
      ...settingsCorrection(),
      id: "corr_billing_001",
      scope: { project: "architecture_canvas", surfaces: ["billing"] },
    };
    const { prepared } = await preparedModifySession([billing], "ds_cc_2");
    const compiled = prepared.compiled_context as CompiledContext;
    const trace = prepared.context_compilation_trace as CompilationTrace;
    expect(compiled.corrections).toEqual([]);
    expect(trace.excluded).toContainEqual({ ref: "correction:corr_billing_001", reason: "scope_mismatch" });
  });

  it("preserves unresolved material unknowns from decisions and manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-cc-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_cc_3" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "一个中文需求",
      project_root: projectRoot,
      mode: "greenfield",
      requirement_confirmation: requirementConfirmation(),
    });
    await service.designFrame({ design_session_id: "ds_cc_3", product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: "ds_cc_3", design_context: architectureContext() });
    await service.designRoute({ design_session_id: "ds_cc_3", question: "选择主结构" });
    const patternId = "PAT-CANVAS-WORKSPACE";
    await service.designInspect({
      design_session_id: "ds_cc_3",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认" },
    });
    const decisions = architectureDecisions("ds_cc_3");
    decisions.unresolved = ["trace ordering semantics during partial failure"];
    await service.designDecide({ design_session_id: "ds_cc_3", design_decisions: decisions });
    await service.designSdir({ design_session_id: "ds_cc_3", mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: "ds_cc_3", capability_map: architectureCapabilities() });
    const prepared = await service.designPrepareImplementation({
      design_session_id: "ds_cc_3",
      platform: "web_desktop",
      framework: "react",
    });
    const compiled = prepared.compiled_context as CompiledContext;
    expect(compiled.unresolved).toContain("trace ordering semantics during partial failure");
    expect(compiled.product_relationships.map((r) => r.id)).toContain("rel_node_relationship");
    expect(compiled.region_relationships.map((r) => r.id)).toContain("region_rel_architecture_inspector");
    expect(compiled.decisions.primary_structure).toBe("PAT-CANVAS-WORKSPACE");
  });

  it("persists the compiled context and trace as session artifacts", async () => {
    const { store } = await preparedModifySession([], "ds_cc_4");
    const session = await store.getSession("ds_cc_4");
    const compiled = await store.readArtifact<CompiledContext>(session, "compiledContext");
    const trace = await store.readArtifact<CompilationTrace>(session, "compilationTrace");
    expect(compiled?.session_id).toBe("ds_cc_4");
    expect(trace?.session_id).toBe("ds_cc_4");
  });

  it("compilation is deterministic for the same authoritative state", async () => {
    const first = await preparedModifySession([settingsCorrection()], "ds_cc_5a");
    const second = await preparedModifySession([settingsCorrection()], "ds_cc_5b");
    const strip = (compiled: CompiledContext) => JSON.stringify({ ...compiled, session_id: "" });
    expect(strip(first.prepared.compiled_context as CompiledContext)).toBe(
      strip(second.prepared.compiled_context as CompiledContext),
    );
  });
});
