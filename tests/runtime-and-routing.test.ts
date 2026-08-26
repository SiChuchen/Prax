import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadBuiltInKnowledgeStore } from "prax-knowledge";
import { DesignRouter, DisclosureGate } from "prax-router";
import {
  FileSessionStore,
  validateCapabilityMap,
  validateDesignContext,
  validateDesignDecisions,
  validateProductFrame,
} from "prax-runtime";
import { PraxService } from "prax-mcp";
import { requirementConfirmation } from "./fixtures.js";
import { patternSurfaceContract, SdirEngine } from "prax-sdir";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  chineseArchitectureContext,
  chineseArchitectureFrame,
  dataExplorerDecisions,
  settingsContext,
  settingsDecisions,
} from "./fixtures.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("product-first runtime", () => {
  it("quarantines backend-shaped product models", () => {
    const frame = architectureProductFrame();
    frame.product_objects = [
      { id: "provider_model", user_name: "provider_model", purpose: "backend record" },
      { id: "route_config", user_name: "route_config", purpose: "backend record" },
      { id: "proxy_config", user_name: "proxy_config", purpose: "backend record" },
      { id: "credential", user_name: "credential", purpose: "backend record" },
    ];
    expect(validateProductFrame(frame, "greenfield").status).toBe("REVIEW");
  });

  it("advances backend-shaped objects only under a structured justified override", () => {
    const override = {
      override_type: "backend_object_is_product_object",
      rationale: "Operators already call these objects by their backend names in runbooks.",
      user_evidence: ["user_requirement"],
      risks: ["UI language may drift toward backend vocabulary"],
      accepted_by: "human",
    };
    const justified = architectureProductFrame();
    justified.relationships = [];
    justified.product_objects = [
      { id: "provider_model", user_name: "provider_model", purpose: "backend record", justified_override: override },
      { id: "route_config", user_name: "route_config", purpose: "backend record", justified_override: override },
    ];
    const result = validateProductFrame(justified, "greenfield");
    expect(result.status).toBe("WARN");
    expect(result.warnings.join(" ")).toMatch(/provider_model/);

    const partiallyJustified = architectureProductFrame();
    partiallyJustified.product_objects = [
      { id: "provider_model", user_name: "provider_model", purpose: "backend record", justified_override: override },
      { id: "route_config", user_name: "route_config", purpose: "backend record" },
      { id: "proxy_config", user_name: "proxy_config", purpose: "backend record" },
    ];
    expect(validateProductFrame(partiallyJustified, "greenfield").status).toBe("REVIEW");
  });

  it("accepts a low-confidence mental model with an explicit open question instead of evidence", () => {
    const frame = architectureProductFrame();
    frame.mental_model_hypothesis.confidence = "low";
    frame.mental_model_hypothesis.evidence = [];
    frame.open_questions = ["Does the user think in flows or in nodes?"];
    const result = validateProductFrame(frame, "greenfield");
    expect(result.status).not.toBe("EXPAND");
  });

  it("persists and resumes explicit sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-runtime-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const options = { stateRoot: join(root, "state"), idGenerator: () => "ds_resume_test" };
    const first = new FileSessionStore(options);
    const created = await first.createSession({ projectRoot, requirement: "Design an architecture canvas", mode: "greenfield" });
    const second = new FileSessionStore({ stateRoot: join(root, "state") });
    expect((await second.getSession(created.id)).id).toBe("ds_resume_test");
    expect(await second.artifactDirectory(created.id)).toContain(join(".prax", "design", "sessions", "ds_resume_test"));
  });

  it("requires an explicit resolution for capability gaps", () => {
    const result = validateCapabilityMap({
      needs: [{ id: "trace", product_action: "trace", required_experience: ["preserve context"], capabilities: [], status: "gap" }],
    });
    expect(result.status).toBe("RETRY");
  });

  it("revalidates restored artifacts against their schemas", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-runtime-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_restore" });
    const session = await store.createSession({ projectRoot, requirement: "Design an architecture canvas", mode: "greenfield" });
    const advanced = await store.commit(
      { ...session, updated_at: new Date().toISOString(), revision: session.revision + 1 },
      [{ key: "productFrame", value: architectureProductFrame() }],
    );
    const directory = await store.artifactDirectory("ds_restore");
    await writeFile(join(directory, "product-frame.yaml"), "user: broken\n", "utf8");
    await expect(store.readArtifact(advanced, "productFrame")).rejects.toMatchObject({ code: "ARTIFACT_SCHEMA_INVALID" });
  });

  it("rejects cross-process session writes while the state lock is held", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-runtime-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const stateRoot = join(root, "state");
    const store = new FileSessionStore({ stateRoot, idGenerator: () => "ds_lock" });
    const session = await store.createSession({ projectRoot, requirement: "Design an architecture canvas", mode: "greenfield" });
    await writeFile(join(stateRoot, "write.lock"), `999999 ${Date.now()}`, "utf8");
    await expect(
      store.commit({ ...session, updated_at: new Date().toISOString(), revision: session.revision + 1 }),
    ).rejects.toMatchObject({ code: "SESSION_LOCK_HELD" });
  });

  it("steals a stale state lock and completes the write", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-runtime-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const stateRoot = join(root, "state");
    const store = new FileSessionStore({ stateRoot, idGenerator: () => "ds_stale_lock" });
    const session = await store.createSession({ projectRoot, requirement: "Design an architecture canvas", mode: "greenfield" });
    await writeFile(join(stateRoot, "write.lock"), `999999 ${Date.now() - 120_000}`, "utf8");
    const committed = await store.commit(
      { ...session, updated_at: new Date().toISOString(), revision: session.revision + 1 },
    );
    expect(committed.revision).toBe(session.revision + 1);
  });
});

describe("context routing and disclosure", () => {
  it("loads the built-in knowledge pack on any platform", async () => {
    const store = await loadBuiltInKnowledgeStore();
    expect(store.size()).toBe(23);
  });

  it("routes Canvas and Settings patterns without cross-contamination", async () => {
    const store = await loadBuiltInKnowledgeStore();
    const router = new DesignRouter(store);
    const canvas = router.route(architectureProductFrame(), architectureContext(), "Choose a primary structure for relationship tracing");
    expect(canvas.status).toBe("PASS");
    expect(canvas.patterns[0]?.id).toBe("PAT-CANVAS-WORKSPACE");
    expect(canvas.patterns.map((item) => item.id)).not.toContain("PAT-SETTINGS-SECTIONS");
    expect(canvas.patterns.length).toBeLessThanOrEqual(3);
    expect(canvas.principles.length).toBeLessThanOrEqual(5);
    expect(canvas.heuristics.length).toBeLessThanOrEqual(5);

    const settingsFrame = architectureProductFrame();
    settingsFrame.goal.primary = "configure product preferences safely";
    settingsFrame.tasks.primary = "configure settings";
    settingsFrame.tasks.secondary = [];
    settingsFrame.product_objects = [{ id: "preference", user_name: "preference", purpose: "change product behavior" }];
    const settings = router.route(settingsFrame, settingsContext(), "Choose a pattern for settings and preferences");
    expect(settings.patterns[0]?.id).toBe("PAT-SETTINGS-SECTIONS");
    expect(settings.patterns.map((item) => item.id)).not.toContain("PAT-CANVAS-WORKSPACE");
  });

  it("blocks unrouted knowledge regardless of purpose", () => {
    const gate = new DisclosureGate();
    const session = {
      id: "ds_1", project_root: "/tmp/project", mode: "greenfield", phase: "DECISION",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
      requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "decision" },
      disclosures: [], routing_history: [{ question: "pattern", selected_ids: ["PAT-CANVAS-WORKSPACE"], excluded_ids: [], confidence: "high", routed_at: new Date().toISOString() }],
      artifacts: {}, unresolved: [], warnings: [],
    } as const;
    expect(
      gate.authorize(session, ["PAT-SETTINGS-SECTIONS"], "L1", { kind: "compare_alternatives", target_ids: ["PAT-SETTINGS-SECTIONS"], question: "Is settings a plausible alternative?" }).status,
    ).toBe("BLOCK");
  });

  it("authorizes deep inspection only with a structured, depth-appropriate purpose", () => {
    const gate = new DisclosureGate();
    const session = {
      id: "ds_1", project_root: "/tmp/project", mode: "greenfield", phase: "DECISION",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
      requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "decision" },
      disclosures: [], routing_history: [{ question: "pattern", selected_ids: ["PAT-CANVAS-WORKSPACE"], excluded_ids: [], confidence: "high", routed_at: new Date().toISOString() }],
      artifacts: {}, unresolved: [], warnings: [],
    } as const;
    expect(
      gate.authorize(session, ["PAT-CANVAS-WORKSPACE"], "L2", { kind: "compare_alternatives", target_ids: ["PAT-CANVAS-WORKSPACE"], question: "Compare canvas workspace against the data explorer before deciding." }).status,
    ).toBe("PASS");
    const l3WithShallowPurpose = gate.authorize(session, ["PAT-CANVAS-WORKSPACE"], "L3", { kind: "compare_alternatives", target_ids: ["PAT-CANVAS-WORKSPACE"], question: "Which pattern do I prefer?" });
    expect(l3WithShallowPurpose.status).toBe("BLOCK");
    expect(l3WithShallowPurpose.code).toBe("L3_PURPOSE_INSUFFICIENT");
    expect(
      gate.authorize(session, ["PAT-CANVAS-WORKSPACE"], "L3", { kind: "investigate_risk", target_ids: ["PAT-CANVAS-WORKSPACE"], question: "Verify the evidence sources behind this pattern before trusting it." }).status,
    ).toBe("PASS");
    const unroutedTarget = gate.authorize(session, ["PAT-CANVAS-WORKSPACE"], "L3", { kind: "validate_decision", target_ids: ["PAT-SETTINGS-SECTIONS"], question: "Validate the decision against evidence." });
    expect(unroutedTarget.status).toBe("BLOCK");
    expect(unroutedTarget.code).toBe("PURPOSE_TARGET_NOT_ROUTED");
  });
});

describe("design decision semantics", () => {
  const frame = architectureProductFrame();
  const designContext = architectureContext();
  const canvasSurfaces = { dominant: ["architecture", "dominant_workspace"], contextual: ["inspector", "contextual_inspector"] };
  const decisionContext = {
    sessionId: "ds_dec_sem",
    routedPatternIds: new Set(["PAT-CANVAS-WORKSPACE"]),
    inspectedAtLeastL1: new Set(["PAT-CANVAS-WORKSPACE"]),
    plausibleAlternativeCount: 3,
    frame,
    context: designContext,
    patternSurfaces: canvasSurfaces,
  };

  it("rejects an inspector-first hierarchy even when the pattern is correct", () => {
    const decisions = architectureDecisions("ds_dec_sem");
    decisions.information_hierarchy = { primary: ["inspector"], secondary: ["architecture", "toolbar"] };
    const result = validateDesignDecisions(decisions, decisionContext);
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("HIERARCHY_CONTEXTUAL_SURFACES_DOMINANT");
    expect(result.codes).toContain("HIERARCHY_DOMINANT_NOT_PRIMARY");
    expect(result.issues.join(" ")).toMatch(/inspector/);
    expect(result.issues.join(" ")).toMatch(/architecture/);
  });

  it("rejects a correct pattern whose hierarchy buries the primary task surface", () => {
    const decisions = architectureDecisions("ds_dec_sem");
    decisions.information_hierarchy = { primary: ["toolbar"], secondary: ["architecture", "inspector"] };
    const result = validateDesignDecisions(decisions, decisionContext);
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("HIERARCHY_DOMINANT_NOT_PRIMARY");
  });

  it("accepts a justified hierarchy override with resolvable evidence", () => {
    const decisions = architectureDecisions("ds_dec_sem");
    decisions.information_hierarchy = {
      primary: ["inspector"],
      secondary: ["architecture", "toolbar"],
      override: {
        basis: "Users primarily audit individual nodes; the canvas is reference context.",
        evidence_refs: ["user_requirement"],
        risks: ["weaker spatial orientation", "relationship tracing needs extra steps"],
        accepted_by: "human",
      },
    };
    const result = validateDesignDecisions(decisions, decisionContext);
    expect(result.status).toBe("WARN");
    expect(result.issues).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/override/);
  });

  it("rejects an override whose evidence does not resolve", () => {
    const decisions = architectureDecisions("ds_dec_sem");
    decisions.information_hierarchy = {
      primary: ["inspector"],
      secondary: ["architecture", "toolbar"],
      override: {
        basis: "Feels better this way.",
        evidence_refs: ["gut_feeling"],
        risks: ["hierarchy inversion"],
        accepted_by: "agent",
      },
    };
    const result = validateDesignDecisions(decisions, decisionContext);
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("DECISION_OVERRIDE_EVIDENCE_UNKNOWN");
    expect(result.codes).toContain("HIERARCHY_CONTEXTUAL_SURFACES_DOMINANT");
  });

  it("rejects major choices that reference nothing real", () => {
    const missing = architectureDecisions("ds_dec_sem");
    missing.major_choices[0].references = [];
    const result = validateDesignDecisions(missing, decisionContext);
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("MAJOR_CHOICE_REFERENCE_MISSING");

    const unknown = architectureDecisions("ds_dec_sem");
    unknown.major_choices[0].references = ["provider_settings_backend"];
    const unknownResult = validateDesignDecisions(unknown, decisionContext);
    expect(unknownResult.codes).toContain("MAJOR_CHOICE_REFERENCE_UNKNOWN");
  });
});

describe("routing escape hatch", () => {
  it("advances past an unclassifiable domain when the agent records the scope gap", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-escape-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_escape" });
    const service = await PraxService.create({ sessions: store });

    const frame = chineseArchitectureFrame();
    frame.tasks = { primary: "占卜卦象", secondary: [] };
    frame.product_objects = [{ id: "hexagram", user_name: "卦象", purpose: "占卜结果" }];
    frame.relationships = [];
    const context = chineseArchitectureContext();
    context.task = { primary: "占卜", modes: ["起卦"], frequency: "low" };
    context.domain = { type: "玄学", entities: ["卦象"] };

    expect((await service.designStart({ requirement: "呈现卦象", project_root: projectRoot, mode: "greenfield", requirement_confirmation: requirementConfirmation() })).status).toBe("PASS");
    expect((await service.designFrame({ design_session_id: "ds_escape", product_frame: frame })).status).toBe("PASS");
    expect((await service.designContext({ design_session_id: "ds_escape", design_context: context })).status).toMatch(/PASS|WARN/);

    const blocked = await service.designRoute({ design_session_id: "ds_escape", question: "如何呈现卦象" });
    expect(blocked.status).toBe("EXPAND");

    const escaped = await service.designRoute({
      design_session_id: "ds_escape",
      question: "如何呈现卦象",
      accept_scope_gap: {
        question: "The knowledge pack has no coverage for divination domains; proceed with generic structure guidance?",
        rationale: "The task is genuinely outside the current pack; deferring the design is worse than proceeding on generic guidance.",
      },
    });
    expect(escaped.status).toBe("WARN");
    expect(escaped.phase).toBe("DECISION");
    expect(escaped.next).toEqual({ tool: "design_inspect" });

    const session = await store.getSession("ds_escape");
    expect(session.unresolved).toContain("The knowledge pack has no coverage for divination domains; proceed with generic structure guidance?");

    const generic = (escaped.patterns as Array<{ id: string }>)[0]?.id;
    expect(generic).toBeDefined();
    expect((await service.designInspect({
      design_session_id: "ds_escape",
      ids: [generic],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [generic], question: "Confirm the generic structure fits before deciding." },
    })).status).toBe("PASS");
    expect((await service.designDecide({
      design_session_id: "ds_escape",
      design_decisions: {
        session_id: "ds_escape",
        primary_structure: { pattern: generic, rationale: ["generic structure is the best available floor for an uncovered domain"], confidence: "medium" },
        information_hierarchy: { primary: ["workspace"], secondary: [] },
        density: { intent: "compact", strategy: ["quiet defaults"], avoid: ["card per entity"] },
        major_choices: [],
        rejected: [{ option: "hand-written layout", reason: "no recorded decision trail" }],
        unresolved: [],
      },
    })).status).toMatch(/PASS|WARN/);
  });
});

describe("canonical context classification", () => {
  it("classifies a Chinese architecture requirement into stable canonical ids and routes by them", async () => {
    const frame = chineseArchitectureFrame();
    const validated = validateDesignContext(chineseArchitectureContext(), frame);
    expect(validated.status).toBe("PASS");
    const classification = validated.value!.classification!;
    expect(classification.version).toBe("1");
    expect(classification.task_type).toBe("inspect_relationships");
    expect(classification.domain_id).toBe("software_architecture");
    expect(classification.interaction_mode).toBe("canvas_with_contextual_inspector");
    expect(classification.product_type).toBe("internal_engineering_tool");
    expect(classification.primary_object_type).toBe("architecture_node");
    expect(classification.confidence).toBe("high");
    expect(classification.evidence.length).toBeGreaterThan(0);

    const store = await loadBuiltInKnowledgeStore();
    const routed = new DesignRouter(store).route(frame, validated.value!, "选择承载主任务的界面结构");
    expect(routed.status).toBe("PASS");
    expect(routed.patterns[0]?.id).toBe("PAT-CANVAS-WORKSPACE");
    expect(routed.patterns.map((pattern) => pattern.id)).not.toContain("PAT-SETTINGS-SECTIONS");
  });

  it("classifies English contexts into the same canonical ids", () => {
    const validated = validateDesignContext(architectureContext(), architectureProductFrame());
    const classification = validated.value!.classification!;
    expect(classification.task_type).toBe("inspect_relationships");
    expect(classification.domain_id).toBe("software_architecture");
    expect(classification.interaction_mode).toBe("canvas_with_contextual_inspector");
    expect(classification.primary_object_type).toBe("architecture_node");

    const settingsFrame = architectureProductFrame();
    settingsFrame.tasks = { primary: "configure settings", secondary: [] };
    settingsFrame.product_objects = [{ id: "preference", user_name: "preference", purpose: "change product behavior" }];
    const settingsValidated = validateDesignContext(settingsContext(), settingsFrame);
    const settingsClassification = settingsValidated.value!.classification!;
    expect(settingsClassification.task_type).toBe("configure_preferences");
    expect(settingsClassification.domain_id).toBe("preferences");
    expect(settingsClassification.interaction_mode).toBe("sections_with_navigation");
  });

  it("classifies observability and usage-analytics domains and routes the collection patterns", async () => {
    const frame = architectureProductFrame();
    frame.tasks = { primary: "browse usage records", secondary: [] };
    frame.product_objects = [
      { id: "usage_record", user_name: "usage record", purpose: "one metered usage event" },
      { id: "source", user_name: "data source", purpose: "where usage originates" },
    ];
    const context = architectureContext();
    context.task = { primary: "browse usage records", modes: ["browse"], frequency: "high" };
    context.domain = { type: "observability analytics", entities: ["usage_record", "metric", "telemetry"] };
    context.priorities = ["scan records", "compare usage"];
    const validated = validateDesignContext(context, frame);
    const classification = validated.value!.classification!;
    expect(classification.task_type).toBe("browse_collection");
    expect(classification.domain_id).toBe("observability_analytics");

    const store = await loadBuiltInKnowledgeStore();
    const routed = new DesignRouter(store).route(frame, validated.value!, "Browse and compare usage records");
    const patternIds = routed.patterns.map((pattern) => pattern.id);
    expect(routed.status).toBe("PASS");
    expect(patternIds).toContain("PAT-LIST-DETAIL");
    expect(patternIds).toContain("PAT-DATA-EXPLORER");
  });

  it("classifies lifecycle administration and routes PAT-RESOURCE-MANAGEMENT", async () => {
    const frame = architectureProductFrame();
    frame.tasks = { primary: "manage providers", secondary: [] };
    frame.product_objects = [{ id: "provider", user_name: "provider", purpose: "an external service provider" }];
    const context = architectureContext();
    context.task = { primary: "manage provider lifecycle", modes: ["manage"], frequency: "medium" };
    context.domain = { type: "administration", entities: ["provider"] };
    context.priorities = ["safe lifecycle actions"];
    const validated = validateDesignContext(context, frame);
    const classification = validated.value!.classification!;
    expect(classification.task_type).toBe("manage_lifecycle");
    expect(classification.interaction_mode).toBe("inventory_with_lifecycle_actions");
    expect(classification.open_questions.length).toBeGreaterThan(0);

    const store = await loadBuiltInKnowledgeStore();
    const routed = new DesignRouter(store).route(frame, validated.value!, "Manage the provider lifecycle safely");
    expect(routed.status).toBe("PASS");
    expect(routed.patterns.map((pattern) => pattern.id)).toContain("PAT-RESOURCE-MANAGEMENT");
  });

  it("reports an explicit unknown instead of fabricating a classification", async () => {
    const frame = chineseArchitectureFrame();
    frame.tasks = { primary: "占卜卦象", secondary: [] };
    frame.product_objects = [{ id: "hexagram", user_name: "卦象", purpose: "占卜结果" }];
    frame.relationships = [];
    const context = chineseArchitectureContext();
    context.task = { primary: "占卜", modes: ["起卦"], frequency: "low" };
    context.domain = { type: "玄学", entities: ["卦象"] };
    const validated = validateDesignContext(context, frame);
    const classification = validated.value!.classification!;
    expect(classification.task_type).toBe("unknown");
    expect(classification.domain_id).toBe("unknown");
    expect(classification.confidence).toBe("low");
    expect(classification.open_questions.length).toBeGreaterThan(0);

    const store = await loadBuiltInKnowledgeStore();
    const routed = new DesignRouter(store).route(frame, validated.value!, "如何呈现卦象");
    expect(routed.status).toBe("EXPAND");
    expect(routed.confidence).toBe("low");
  });
});

describe("decision to SDIR mapping", () => {
  const frame = architectureProductFrame();
  const context = architectureContext();

  it("promotes and orders regions according to information_hierarchy", () => {
    const decisions = architectureDecisions("ds_map");
    decisions.information_hierarchy = { primary: ["architecture", "toolbar"], secondary: ["navigation", "inspector"] };
    const sdir = new SdirEngine().generate(frame, context, decisions);
    expect(sdir.screen.regions.map((region) => region.id)).toEqual(["architecture", "toolbar", "navigation", "inspector"]);
    expect(sdir.screen.regions.find((region) => region.id === "architecture")?.importance).toBe("dominant");
    expect(sdir.screen.regions.find((region) => region.id === "toolbar")?.importance).toBe("primary");
    expect(sdir.screen.regions.find((region) => region.id === "inspector")?.importance).toBe("contextual");
  });

  it("turns an always-visible inspector choice into persistent visibility and relationship", () => {
    const decisions = architectureDecisions("ds_map");
    decisions.major_choices = [
      { id: "inspector_behavior", choice: "always_visible", rationale: "audit workflow needs persistent detail", confidence: "high", references: ["inspector"] },
    ];
    const sdir = new SdirEngine().generate(frame, context, decisions);
    expect(sdir.screen.regions.find((region) => region.id === "inspector")?.visibility.condition).toBe("always");
    expect(sdir.screen.relationships).toEqual([
      { id: "region_rel_architecture_inspector", source: "architecture", target: "inspector", type: "persistent_side_by_side" },
    ]);
  });

  it("carries unresolved questions into the SDIR unresolved area", () => {
    const decisions = architectureDecisions("ds_map");
    decisions.unresolved = [
      { id: "keyboard_zoom", impact: "high", affects: ["architecture"] },
      "how should relation counts be summarized?",
    ];
    const sdir = new SdirEngine().generate(frame, context, decisions);
    expect(sdir.screen.unresolved).toEqual([
      { id: "keyboard_zoom", question: "keyboard_zoom", impact: "high", affects: ["architecture"] },
      { id: "open_1", question: "how should relation counts be summarized?", impact: "medium", affects: [] },
    ]);
    expect(new SdirEngine().validate(sdir, decisions).status).toBe("PASS");
  });

  it("records rejected alternatives as traceability without adding regions", () => {
    const decisions = dataExplorerDecisions("ds_map");
    decisions.rejected = [{ option: "PAT-CANVAS-WORKSPACE", reason: "rows are compared more than traced" }];
    const sdir = new SdirEngine().generate(frame, context, decisions);
    expect(sdir.screen.rejected_alternatives).toEqual([
      { option: "PAT-CANVAS-WORKSPACE", reason: "rows are compared more than traced" },
    ]);
    expect(sdir.screen.regions.map((region) => region.id).sort()).toEqual(["data", "detail"]);
    expect(sdir.screen.archetype.pattern_ref).toBe("PAT-DATA-EXPLORER");
  });

  it("keeps the pattern skeleton as the floor when decisions are minimal", () => {
    const sdir = new SdirEngine().generate(frame, context, settingsDecisions("ds_map"));
    expect(sdir.screen.regions.map((region) => region.id)).toEqual(["settings", "settings_navigation"]);
    expect(sdir.screen.unresolved).toEqual([]);
    expect(sdir.screen.rejected_alternatives).toEqual([]);
  });

  it("materializes hierarchy surfaces beyond the skeleton as experimental regions", () => {
    const decisions = architectureDecisions("ds_map");
    decisions.information_hierarchy = {
      primary: ["architecture"],
      secondary: ["navigation", "inspector", "toolbar", "activity_stream"],
    };
    const sdir = new SdirEngine().generate(frame, context, decisions);
    const region = sdir.screen.regions.find((item) => item.id === "activity_stream");
    expect(region?.role).toBe("experimental:activity_stream");
    expect(region?.importance).toBe("supporting");
    expect(new SdirEngine().validate(sdir, decisions).status).toBe("PASS");
  });

  it("re-validates a candidate SDIR after the session has advanced, without state changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-resdir-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_revalidate" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({ requirement: "Build an Architecture Canvas.", project_root: projectRoot, mode: "greenfield", requirement_confirmation: requirementConfirmation() });
    await service.designFrame({ design_session_id: "ds_revalidate", product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: "ds_revalidate", design_context: architectureContext() });
    await service.designRoute({ design_session_id: "ds_revalidate", question: "Choose the primary workspace pattern" });
    await service.designInspect({
      design_session_id: "ds_revalidate",
      ids: ["PAT-CANVAS-WORKSPACE"],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: ["PAT-CANVAS-WORKSPACE"], question: "Confirm the canvas pattern fits" },
    });
    await service.designDecide({ design_session_id: "ds_revalidate", design_decisions: architectureDecisions("ds_revalidate") });
    await service.designSdir({ design_session_id: "ds_revalidate", mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: "ds_revalidate", capability_map: architectureCapabilities() });

    const inspection = await service.inspectSession("ds_revalidate");
    expect((inspection.session as { phase: string }).phase).toBe("IMPLEMENTATION_READY");
    const persisted = await store.readArtifact<{ screen: { regions: unknown[] } }>(inspection.session as never, "sdir");

    const enriched = structuredClone(persisted);
    enriched.screen.regions.push({
      id: "history_panel",
      role: "experimental:history_panel",
      importance: "supporting",
      visibility: { condition: "task_driven" },
      behavior_intent: [],
    });
    const validated = await service.designSdir({ design_session_id: "ds_revalidate", mode: "validate", sdir: enriched });
    expect(validated.status).toBe("PASS");
    expect(validated.phase).toBe("IMPLEMENTATION_READY");

    const corrupted = structuredClone(persisted);
    corrupted.screen.relationships = [{ source: "ghost", target: "phantom", type: "selection_drives_contextual_detail" }];
    const rejected = await service.designSdir({ design_session_id: "ds_revalidate", mode: "validate", sdir: corrupted });
    expect(rejected.status).toBe("RETRY");
    expect((rejected.semantic_issues as Array<{ code: string }>).map((issue) => issue.code)).toContain("SDIR_RELATION_REGION_NOT_FOUND");

    const unchanged = await store.readArtifact<{ screen: { regions: unknown[] } }>(inspection.session as never, "sdir");
    expect(unchanged.screen.regions.length).toBe(persisted.screen.regions.length);
    expect((await store.getSession("ds_revalidate")).phase).toBe("IMPLEMENTATION_READY");
  });
});

describe("SDIR referential integrity", () => {
  const frame = architectureProductFrame();
  const context = architectureContext();

  it("generates a data→detail relationship for PAT-DATA-EXPLORER, not a ghost architecture region", () => {
    const sdir = new SdirEngine().generate(frame, context, dataExplorerDecisions("ds_sdir_ref"));
    expect(sdir.screen.regions.map((region) => region.id).sort()).toEqual(["data", "detail"]);
    expect(sdir.screen.relationships).toEqual([
      { id: "region_rel_data_detail", source: "data", target: "detail", type: "selection_drives_contextual_detail" },
    ]);
  });

  it("keeps every generated relationship endpoint inside the declared regions for all built-in patterns", () => {
    const engine = new SdirEngine();
    const allDecisions = [
      architectureDecisions("ds_sdir_ref"),
      dataExplorerDecisions("ds_sdir_ref"),
      settingsDecisions("ds_sdir_ref"),
    ];
    for (const decisions of allDecisions) {
      const sdir = engine.generate(frame, context, decisions);
      const ids = new Set(sdir.screen.regions.map((region) => region.id));
      for (const relationship of sdir.screen.relationships) {
        expect(ids.has(relationship.source)).toBe(true);
        expect(ids.has(relationship.target)).toBe(true);
      }
      expect(engine.validate(sdir, decisions).status).toBe("PASS");
    }
  });

  it("keeps the surface contract consistent with the generated region skeletons", () => {
    const engine = new SdirEngine();
    for (const decisions of [
      architectureDecisions("ds_sdir_ref"),
      dataExplorerDecisions("ds_sdir_ref"),
      settingsDecisions("ds_sdir_ref"),
    ]) {
      const contract = patternSurfaceContract(decisions.primary_structure.pattern);
      expect(contract).toBeDefined();
      const sdir = engine.generate(frame, context, decisions);
      const ids = new Set(sdir.screen.regions.map((region) => region.id));
      expect(contract!.dominant.some((surface) => ids.has(surface))).toBe(true);
      const inspector = sdir.screen.regions.find((region) => region.role === "contextual_inspector");
      if (inspector !== undefined) {
        expect(contract!.contextual).toContain(inspector.id);
      }
    }
  });

  it("rejects relationships with undeclared endpoints, reporting source and target separately", () => {
    const decisions = architectureDecisions("ds_sdir_ref");
    const sdir = new SdirEngine().generate(frame, context, decisions);
    const corrupted = structuredClone(sdir);
    corrupted.screen.relationships = [
      { source: "ghost_surface", target: "phantom_panel", type: "selection_drives_contextual_detail" },
    ];
    const result = new SdirEngine().validate(corrupted, decisions);
    expect(result.status).toBe("RETRY");
    expect(result.semantic_issues.map((issue) => issue.code)).toEqual([
      "SDIR_RELATION_REGION_NOT_FOUND",
      "SDIR_RELATION_REGION_NOT_FOUND",
    ]);
    expect(result.semantic_errors.join(" ")).toContain("source 'ghost_surface'");
    expect(result.semantic_errors.join(" ")).toContain("target 'phantom_panel'");
  });

  it("rejects duplicate region ids and self-loop relationships", () => {
    const decisions = architectureDecisions("ds_sdir_ref");
    const sdir = new SdirEngine().generate(frame, context, decisions);
    const corrupted = structuredClone(sdir);
    corrupted.screen.regions = [...corrupted.screen.regions, { ...corrupted.screen.regions[0] }];
    corrupted.screen.relationships = [
      { source: "architecture", target: "architecture", type: "selection_drives_contextual_detail" },
    ];
    const result = new SdirEngine().validate(corrupted, decisions);
    expect(result.status).toBe("RETRY");
    expect(result.semantic_issues.map((issue) => issue.code)).toContain("SDIR_REGION_ID_DUPLICATE");
    expect(result.semantic_issues.map((issue) => issue.code)).toContain("SDIR_RELATION_SELF_LOOP");
  });
});

describe("SDIR boundary", () => {
  it("rejects render-level implementation leakage", () => {
    const result = new SdirEngine().validate({
      version: "0.1",
      screen: {
        id: "bad", intent: { primary_task: "inspect", secondary_tasks: [] },
        archetype: { pattern_ref: "PAT-CANVAS-WORKSPACE" }, density_intent: "compact",
        regions: [{ id: "canvas", role: "dominant_workspace", importance: "dominant", visibility: { condition: "always" }, behavior_intent: ["pan_zoom"], width: "320px" }],
        relationships: [], interaction_intents: ["direct_selection"], required_states: ["loading", "empty", "ready", "selected", "error"],
        decision_points: [{ id: "layout", question: "adapter choice", adapter_may_choose: ["native landmark"] }],
      },
    });
    expect(result.status).toBe("RETRY");
    expect(result.semantic_errors.join(" ")).toMatch(/render-level/);
  });
});

