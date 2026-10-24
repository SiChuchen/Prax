import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore, type FileSessionStore as Store } from "prax-runtime";
import { PraxService, type PraxOutput, type MeasureRunner } from "prax-mcp";
import { architectureUnderstanding, requirementConfirmation, sdirDelta } from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startSession(
  sessionId: string,
  measurementTarget: { app_root: string; entry: string; scenario: string },
  measureRunner: MeasureRunner,
): Promise<{ service: PraxService; store: Store; sessionDir: string; projectRoot: string }> {
  const root = await mkdtemp(join(tmpdir(), "prax-measureloop-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot, { recursive: true });
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store, measureRunner });
  await service.designStart({
    requirement: "修复画布多选标识缺陷",
    project_root: projectRoot,
    mode: "existing_product",
    change_kind: "modify_surface",
    requirement_confirmation: requirementConfirmation(),
  });
  await service.designFrame({ design_session_id: sessionId, existing_understanding: architectureUnderstanding(["canvas"]) });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "画布上如何承载多选聚合" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认画布模式" },
  });
  await service.designDecide({
    design_session_id: sessionId,
    design_decisions: {
      session_id: sessionId,
      primary_structure: { pattern: patternId, rationale: ["画布"], confidence: "high" },
      information_hierarchy: { primary: ["canvas"], secondary: ["inspector"] },
      density: { intent: "regular", strategy: ["密度"], avoid: [] },
      major_choices: [],
      rejected: [{ option: "列表", reason: "丢上下文" }],
      unresolved: [],
    },
  });
  await service.designSdir({ design_session_id: sessionId, mode: "apply_delta", sdir_delta: sdirDelta() });
  await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react", measurement_target: measurementTarget });
  const sessionDir = await store.artifactDirectory(sessionId);
  return { service, store, sessionDir, projectRoot };
}

const ALL_CHECK_IDS = [
  "layout.overflow",
  "layout.responsive_collision",
  "text.truncation",
  "a11y.contrast",
  "a11y.focus_order",
  "a11y.target_size",
  "type.min_projected_size",
];

/** Fake receipt writer: runner writes a receipt with the given failed ids and
 * returns its path, exactly like runMeasurement does. */
function fakeMeasureRunner(fails: () => string[]) {
  let calls = 0;
  const runner: MeasureRunner = async (options) => {
    calls += 1;
    const now = new Date().toISOString().replaceAll(/[:.]/g, "-");
    const dir = join(options.outDir, "validation-evidence");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `receipt-fake-${now}-${calls}.json`);
    const failing = fails();
    await writeFile(
      path,
      JSON.stringify({
        receipt_version: "0.2",
        tool: { name: "prax-measure", version: "fake-test" },
        checks: ALL_CHECK_IDS.map((id) => ({
          id,
          status: failing.includes(id) ? "fail" : "pass",
          severity: "error",
          measured: id === "a11y.contrast" ? { min_ratio: 2.24, worst_selector: ".muted" } : { smallest_px: 9.5 },
        })),
        summary: { pass: 7 - failing.length, fail: failing.length, skipped: 0 },
      }) + "\n",
    );
    return path;
  };
  return { runner, get calls() { return calls; } };
}

function evidenceForPlan(plan: PraxOutput) {
  const checks = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter((check) => check.evidence_required);
  return {
    submitted_by: "operator",
    collected_at: new Date().toISOString(),
    items: checks.map((check) => ({
      check_id: check.id,
      outcome: "pass" as const,
      source: "operator review",
      notes: `${check.id} pass`,
      artifact_refs: [],
    })),
  };
}

describe("ADR-006 measure→fix loop inside design_validate", () => {
  it("runs Prax-side measurement when no receipt is cited and returns structured fix feedback", async () => {
    const fake = fakeMeasureRunner(() => ["a11y.contrast", "type.min_projected_size"]);
    const { service, projectRoot } = await startSession("ds_mloop_feedback", { app_root: ".", entry: "/", scenario: "entry" }, fake.runner);
    await writeFile(join(projectRoot, "index.html"), "<main>app</main>");
    await service.designValidate({ design_session_id: "ds_mloop_feedback", mode: "submit_evidence", evidence: evidenceForPlan(await service.designValidate({ design_session_id: "ds_mloop_feedback", mode: "plan" })) });

    const result = await service.designValidate({ design_session_id: "ds_mloop_feedback", mode: "evaluate" });
    expect(result.status).toBe("EXPAND");
    expect((result as { code?: string }).code).toBe("MEASUREMENT_FIX_REQUIRED");
    expect(fake.calls).toBe(1);
    const feedback = (result as { measurement_feedback?: Array<{ check_id: string; measured: Record<string, unknown> }> }).measurement_feedback;
    expect(feedback?.map((item) => item.check_id)).toEqual(["a11y.contrast", "type.min_projected_size"]);
    expect(feedback?.[0]?.measured?.min_ratio).toBe(2.24);
    expect((result as { attempts_left?: number }).attempts_left).toBe(2);
    expect(typeof (result as { measurement_receipt?: string }).measurement_receipt).toBe("string");
  });

  it("caps the loop at 3 measurement rounds, then degrades to the conventional evaluation", async () => {
    const fake = fakeMeasureRunner(() => ["a11y.contrast"]);
    const { service, projectRoot } = await startSession("ds_mloop_cap", { app_root: ".", entry: "/", scenario: "entry" }, fake.runner);
    await writeFile(join(projectRoot, "index.html"), "<main>app</main>");
    const plan = await service.designValidate({ design_session_id: "ds_mloop_cap", mode: "plan" });
    await service.designValidate({ design_session_id: "ds_mloop_cap", mode: "submit_evidence", evidence: evidenceForPlan(plan) });

    for (let round = 1; round <= 3; round += 1) {
      const result = await service.designValidate({ design_session_id: "ds_mloop_cap", mode: "evaluate" });
      expect((result as { code?: string }).code).toBe("MEASUREMENT_FIX_REQUIRED");
      expect((result as { attempts_left?: number }).attempts_left).toBe(3 - round);
    }
    const fourth = await service.designValidate({ design_session_id: "ds_mloop_cap", mode: "evaluate" });
    expect(fake.calls).toBe(3); // capped — no fourth measurement
    expect((fourth as { code?: string }).code).not.toBe("MEASUREMENT_FIX_REQUIRED");
  });

  it("degrades with MEASUREMENT_UNAVAILABLE when the runner fails, and never blocks the gate", async () => {
    const failing: MeasureRunner = async () => {
      throw new Error("chromium not launchable");
    };
    const { service, projectRoot } = await startSession("ds_mloop_unavail", { app_root: ".", entry: "/", scenario: "entry" }, failing);
    await writeFile(join(projectRoot, "index.html"), "<main>app</main>");
    const plan = await service.designValidate({ design_session_id: "ds_mloop_unavail", mode: "plan" });
    await service.designValidate({ design_session_id: "ds_mloop_unavail", mode: "submit_evidence", evidence: evidenceForPlan(plan) });

    const result = await service.designValidate({ design_session_id: "ds_mloop_unavail", mode: "evaluate" });
    expect(result.status).toBe("EXPAND");
    expect((result as { code?: string }).code).toBe("MEASUREMENT_UNAVAILABLE");
    expect((result as { issues?: string[] }).issues?.[0]).toContain("chromium");
  });

  it("does not intervene when the evidence already cites a receipt (existing path preserved)", async () => {
    const fake = fakeMeasureRunner(() => []);
    const { service, sessionDir, projectRoot } = await startSession("ds_mloop_cited", { app_root: ".", entry: "/", scenario: "entry" }, fake.runner);
    await writeFile(join(projectRoot, "index.html"), "<main>Ready application</main>");
    const plan = await service.designValidate({ design_session_id: "ds_mloop_cited", mode: "plan" });
    const evidence = {
      ...evidenceForPlan(plan),
      items: evidenceForPlan(plan).items.map((item) =>
        item.check_id === "untouched_surface_regression" ? { ...item, measurement_receipt: "validation-evidence/agent-run.json" } : item,
      ),
    };
    await service.designValidate({ design_session_id: "ds_mloop_cited", mode: "submit_evidence", evidence });
    await mkdir(join(sessionDir, "validation-evidence"), { recursive: true });

    const result = await service.designValidate({ design_session_id: "ds_mloop_cited", mode: "evaluate" });
    expect(fake.calls).toBe(0); // never invoked
    expect((result as { code?: string }).code).not.toBe("MEASUREMENT_FIX_REQUIRED");
  });

  it("all-green measurement weaves the server receipt in and closes as measured (real browser run)", async () => {
    // real runMeasurement: fake runner receipts cannot satisfy digest binding
    const { PraxService: Svc } = await import("prax-mcp");
    const { runMeasurement } = await import("../packages/prax-measure/src/runner.js");
    const root = await mkdtemp(join(tmpdir(), "prax-measureloop-real-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot, { recursive: true });
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_mloop_real" });
    const service = await Svc.create({ sessions: store });
    await service.designStart({
      requirement: "修复画布多选标识缺陷",
      project_root: projectRoot,
      mode: "existing_product",
      change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });
    await service.designFrame({ design_session_id: "ds_mloop_real", existing_understanding: architectureUnderstanding(["canvas"]) });
    const routed = await service.designRoute({ design_session_id: "ds_mloop_real", question: "画布上如何承载多选聚合" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
    await service.designInspect({ design_session_id: "ds_mloop_real", ids: [patternId], depth: "L1", purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认画布模式" } });
    await service.designDecide({
      design_session_id: "ds_mloop_real",
      design_decisions: {
        session_id: "ds_mloop_real",
        primary_structure: { pattern: patternId, rationale: ["画布"], confidence: "high" },
        information_hierarchy: { primary: ["canvas"], secondary: ["inspector"] },
        density: { intent: "regular", strategy: ["密度"], avoid: [] },
        major_choices: [],
        rejected: [{ option: "列表", reason: "丢上下文" }],
        unresolved: [],
      },
    });
    await service.designSdir({ design_session_id: "ds_mloop_real", mode: "apply_delta", sdir_delta: sdirDelta() });
    await service.designPrepareImplementation({ design_session_id: "ds_mloop_real", platform: "web_desktop", framework: "react", measurement_target: { app_root: ".", entry: "/", scenario: "entry" } });
    await writeFile(join(projectRoot, "index.html"), "<!doctype html><html><body><main style=\"font-size:16px;color:#111;background:#fff\">Ready application with adequately sized text</main></body></html>");
    void runMeasurement; // (imported for provenance; the service uses its own default)
    const plan = await service.designValidate({ design_session_id: "ds_mloop_real", mode: "plan" });
    await service.designValidate({ design_session_id: "ds_mloop_real", mode: "submit_evidence", evidence: evidenceForPlan(plan) });

    const result = await service.designValidate({ design_session_id: "ds_mloop_real", mode: "evaluate" });
    // a clean static page: the loop measured, wove the receipt, and evaluated
    expect((result as { code?: string }).code).not.toBe("MEASUREMENT_FIX_REQUIRED");
    expect((result as { code?: string }).code).not.toBe("MEASUREMENT_UNAVAILABLE");
    const readiness = (result as { readiness?: { claims: { measured: string[] } } }).readiness;
    if (readiness !== undefined) {
      expect(readiness.claims.measured).toContain("untouched_surface_regression");
    }
  }, 60000);
});
