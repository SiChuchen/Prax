import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadBuiltInKnowledgeStore } from "prax-knowledge";
import { DesignRouter, DisclosureGate } from "prax-router";
import {
  FileSessionStore,
  validateCapabilityMap,
  validateProductFrame,
} from "prax-runtime";
import { SdirEngine } from "prax-sdir";
import {
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
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

  it("blocks unrouted and unjustified deep inspection", () => {
    const gate = new DisclosureGate();
    const session = {
      id: "ds_1", project_root: "/tmp/project", mode: "greenfield", phase: "DECISION",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
      requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "decision" },
      disclosures: [], routing_history: [{ question: "pattern", selected_ids: ["PAT-CANVAS-WORKSPACE"], excluded_ids: [], confidence: "high", routed_at: new Date().toISOString() }],
      artifacts: {}, unresolved: [], warnings: [],
    } as const;
    expect(gate.authorize(session, ["PAT-SETTINGS-SECTIONS"], "L1", "compare").status).toBe("BLOCK");
    expect(gate.authorize(session, ["PAT-CANVAS-WORKSPACE"], "L3", "I am curious").status).toBe("BLOCK");
    expect(gate.authorize(session, ["PAT-CANVAS-WORKSPACE"], "L3", "verify evidence source for review").status).toBe("PASS");
  });
});

describe("SDIR referential integrity", () => {
  const frame = architectureProductFrame();
  const context = architectureContext();

  it("generates a data→detail relationship for PAT-DATA-EXPLORER, not a ghost architecture region", () => {
    const sdir = new SdirEngine().generate(frame, context, dataExplorerDecisions("ds_sdir_ref"));
    expect(sdir.screen.regions.map((region) => region.id).sort()).toEqual(["data", "detail"]);
    expect(sdir.screen.relationships).toEqual([
      { source: "data", target: "detail", type: "selection_drives_contextual_detail" },
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

