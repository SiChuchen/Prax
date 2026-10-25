import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import { PraxService, type PraxOutput } from "prax-mcp";
import { architectureUnderstanding, requirementConfirmation, sdirDelta } from "./fixtures.js";

// m5.3 (m5p1 s2/s6 evidence): both non-closing sessions ended on a
// submit_evidence call whose response is {status:"PASS", missing_evidence:[]}
// — "evidence accepted" read as "validation passed", and the agent quit in
// VALIDATION without ever calling mode=evaluate. The handoff must say what it
// is, what phase the session is in, and what is still outstanding.

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startModifySurfaceSession(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-handoff-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot, { recursive: true });
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
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
  await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
  return { service, store };
}

function evidenceForPlan(plan: PraxOutput, subset: string[]) {
  const checks = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter(
    (check) => check.evidence_required,
  );
  return {
    submitted_by: "operator",
    collected_at: new Date().toISOString(),
    items: checks
      .filter((check) => subset.includes(check.id))
      .map((check) => ({
        check_id: check.id,
        outcome: "pass" as const,
        source: "operator review",
        notes: `${check.id} pass`,
        artifact_refs: [],
      })),
  };
}

describe("completion handoff clarity (m5.3, m5p1 s2/s6 evidence)", () => {
  it("submit_evidence acceptance is explicit: not a verdict, session phase visible, outstanding items listed", async () => {
    const { service } = await startModifySurfaceSession("ds_handoff_partial");
    const plan = await service.designValidate({ design_session_id: "ds_handoff_partial", mode: "plan" });
    const required = (plan.checks as Array<{ id: string; evidence_required: boolean }>)
      .filter((check) => check.evidence_required);
    const first = required[0]!.id;

    const accepted = await service.designValidate({
      design_session_id: "ds_handoff_partial",
      mode: "submit_evidence",
      evidence: evidenceForPlan(plan, [first]),
    });
    expect(accepted.status).toBe("PASS");
    const shaped = accepted as { phase?: string; message?: string; outstanding?: string[] };
    expect(shaped.phase).toBe("VALIDATION");
    expect(shaped.message).toContain("not an evaluation verdict");
    expect(shaped.message).toContain("evaluate");
    expect(shaped.outstanding).toBeDefined();
    expect(shaped.outstanding).toContain(required[1]!.id);
    expect(shaped.outstanding).not.toContain(first);
  });

  it("full-coverage submit still directs to evaluate — outstanding is empty but the verdict remains unevaluated", async () => {
    const { service } = await startModifySurfaceSession("ds_handoff_full");
    const plan = await service.designValidate({ design_session_id: "ds_handoff_full", mode: "plan" });
    const required = (plan.checks as Array<{ id: string; evidence_required: boolean }>)
      .filter((check) => check.evidence_required);
    const accepted = await service.designValidate({
      design_session_id: "ds_handoff_full",
      mode: "submit_evidence",
      evidence: evidenceForPlan(plan, required.map((check) => check.id)),
    });
    expect(accepted.status).toBe("PASS");
    const shaped = accepted as { phase?: string; message?: string; outstanding?: string[] };
    expect(shaped.outstanding).toEqual([]);
    expect(shaped.message).toContain("evaluate");
    expect(shaped.phase).toBe("VALIDATION");
  });

  it("plan view carries the session phase and says it is not a verdict", async () => {
    const { service } = await startModifySurfaceSession("ds_handoff_plan");
    const plan = await service.designValidate({ design_session_id: "ds_handoff_plan", mode: "plan" });
    expect(plan.status).toBe("EXPAND");
    const shaped = plan as { phase?: string; message?: string };
    expect(shaped.phase).toBe("VALIDATION");
    expect(shaped.message).toContain("not an evaluation verdict");
  });
});
