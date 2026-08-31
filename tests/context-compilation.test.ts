import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore, compileContext, type CompiledContext, type CompilationTrace, type Correction, type DesignSession } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  architectureUnderstanding,
  requirementConfirmation,
  sdirDelta,
  directCodeConditions,
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
  await mkdir(join(projectRoot, ".prax"), { recursive: true });
  if (corrections.length > 0) {
    await writeFile(join(projectRoot, ".prax", "corrections.yaml"), stringify({ version: "0.1", corrections }), "utf8");
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

  it("matches corrections through change-target surface purposes only (MEM-001 pair-02)", () => {
    // Surface ids may diverge completely from a seeded correction's scope
    // vocabulary (project-architecture vs canvas-stage) while the declared
    // PURPOSE of the change-target surface still names it. Purposes of
    // surfaces outside the change targets must not become matching domain.
    const understanding = {
      ...architectureUnderstanding(["project-architecture", "architecture-fixtures"]),
      current_surfaces: [
        {
          id: "project-architecture",
          purpose:
            "Production registry Architecture Canvas page: command bar, canvas stage with Regions/Objects/Relationships, reading key, docked Inspector, status bar",
          evidence_refs: ["app/projects/project-architecture"],
        },
        {
          id: "architecture-fixtures",
          purpose: "Fixture workbench for QA at 15/20 and 40/70 scales",
          evidence_refs: ["app/architecture-fixtures"],
        },
        {
          id: "settings-page",
          purpose: "Settings page: sections for profile, tokens and telemetry",
          evidence_refs: ["app/settings"],
        },
      ],
    };
    const canvasCorrection: Correction = {
      id: "corr_canvas_impact_grammar",
      scope: { project: "architecture-canvas", surfaces: ["canvas-stage", "canvas-inspector"] },
      finding: { type: "visual_language_emphasis", observed: "hue-coded impact marking" },
      intended: { statement: "impact emphasis reuses the line grammar" },
      evidence_refs: ["human_review_mem001_task1"],
      regression: { check_id: "impact_uses_line_grammar" },
      supersedes: [],
      promotion: { candidate: false },
      created_at: "2026-08-27T12:00:00.000Z",
    };
    const probe: Correction = {
      ...canvasCorrection,
      id: "corr_probe_settings_001",
      scope: { project: "architecture-canvas", surfaces: ["settings-page"] },
      regression: { check_id: "settings_collapsed_by_default" },
    };
    const session: DesignSession = {
      id: "ds_purpose", project_root: "/tmp/p", mode: "existing_product", phase: "IMPLEMENTATION_READY",
      created_at: "2026-08-31T00:00:00.000Z", updated_at: "2026-08-31T00:00:00.000Z", revision: 3,
      requirement_ref: "requirement.md",
      completed_gates: ["confirm", "framing", "context", "route", "decide", "sdir", "reconcile", "realize"],
      current_gate: { name: "prepare" }, disclosures: [], routing_history: [], artifacts: {},
      unresolved: [], warnings: [], design_authorities: [],
    };
    const { compiled, trace } = compileContext({
      session,
      understanding,
      planRevision: 1,
      planCheckIds: ["delta_conformance"],
      corrections: [canvasCorrection, probe],
    });
    expect(compiled.task.surfaces).toEqual(["project-architecture", "architecture-fixtures"]);
    expect(compiled.corrections.map((c) => c.id)).toEqual(["corr_canvas_impact_grammar"]);
    expect(compiled.validation.regression_check_ids).toEqual(["impact_uses_line_grammar"]);
    expect(trace.excluded).toContainEqual({ ref: "correction:corr_probe_settings_001", reason: "scope_mismatch" });
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
    await service.designRealize({ design_session_id: "ds_cc_3", mode: "propose", realization_mode: "direct_code", conditions: directCodeConditions() });
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

  it("compiles the approved representation mapping for implementing agents", () => {
    const session: DesignSession = {
      id: "ds_repr", project_root: "/tmp/p", mode: "greenfield", phase: "IMPLEMENTATION_READY",
      created_at: "2026-08-28T00:00:00.000Z", updated_at: "2026-08-28T00:00:00.000Z", revision: 3,
      requirement_ref: "requirement.md", completed_gates: ["confirm", "framing", "context", "route", "decide", "sdir", "reconcile", "realize"],
      current_gate: { name: "prepare" }, disclosures: [], routing_history: [], artifacts: {},
      unresolved: [], warnings: [], design_authorities: [],
    };
    const { compiled, trace } = compileContext({
      session,
      planRevision: 1,
      planCheckIds: ["design_representation_coverage"],
      corrections: [],
      representation: {
        provider: "figma",
        file_key: "fk",
        approved_anchor: { round: 2, sdir_digest: "digest-1", screenshot_digests: [{ ref: "rep-evidence/round-2/hero.png", sha256: "abc" }] },
        region_frames: [
          { region: "hero", node_id: "n1", name: "Hero" },
          { region: "cta", node_id: "n2", name: "CTA" },
        ],
      },
    });
    expect(compiled.representation).toMatchObject({
      provider: "figma",
      file_key: "fk",
      approved_anchor: { round: 2, sdir_digest: "digest-1" },
    });
    expect(compiled.representation?.region_frames).toHaveLength(2);
    expect(JSON.stringify(trace.selected)).toContain("representation");
  });
});
