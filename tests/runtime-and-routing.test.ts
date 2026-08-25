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
import { architectureContext, architectureProductFrame, settingsContext } from "./fixtures.js";

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

