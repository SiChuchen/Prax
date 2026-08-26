import { mkdir, mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore } from "prax-runtime";
import type { PersistedValidationPlan } from "prax-validator";
import { PraxService } from "prax-mcp";
import {
  architectureCapabilities,
  architectureContext,
  architectureDecisions,
  architectureProductFrame,
  architectureUnderstanding,
  intentLite,
  requirementConfirmation,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startSession(sessionId: string, mode: "greenfield" | "existing_product", changeKind?: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-vplan-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  const started = await service.designStart({
    requirement: "一个中文需求",
    project_root: projectRoot,
    mode,
    ...(changeKind === undefined ? {} : { change_kind: changeKind as never }),
    requirement_confirmation: requirementConfirmation(),
  });
  expect(started.status).toBe("PASS");
  return { service, store };
}

async function driveGreenfieldToPrepare(service: PraxService, sessionId: string) {
  await service.designFrame({ design_session_id: sessionId, product_frame: architectureProductFrame() });
  await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "选择主结构" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" },
  });
  await service.designDecide({
    design_session_id: sessionId,
    design_decisions: architectureDecisions(sessionId),
  });
  await service.designSdir({ design_session_id: sessionId, mode: "generate_from_decisions" });
  await service.designReconcile({ design_session_id: sessionId, capability_map: architectureCapabilities() });
}

describe("persisted pre-implementation validation plan", () => {
  it("materializes a revision-locked plan before implementation-ready and the brief cites it", async () => {
    const { service, store } = await startSession("ds_vp_gf", "greenfield");
    await driveGreenfieldToPrepare(service, "ds_vp_gf");
    const prepared = await service.designPrepareImplementation({
      design_session_id: "ds_vp_gf",
      platform: "web_desktop",
      framework: "react",
    });
    expect(prepared.status).toBe("PASS");

    const brief = prepared.implementation_brief as { validation_plan_ref: { revision: number }; validation_requirements: string[] };
    expect(brief.validation_plan_ref.revision).toBe(1);
    expect(brief.validation_requirements.length).toBeGreaterThan(0);

    const session = await store.getSession("ds_vp_gf");
    const planArtifact = await store.readArtifact<PersistedValidationPlan>(session, "validationPlan");
    expect(planArtifact?.revision).toBe(1);
    expect(planArtifact?.session_id).toBe("ds_vp_gf");
    expect(planArtifact?.derived_from.artifact_digests.design_decisions).toBeDefined();
  });

  it("validate reuses the same plan revision when upstream artifacts are unchanged", async () => {
    const { service, store } = await startSession("ds_vp_same", "greenfield");
    await driveGreenfieldToPrepare(service, "ds_vp_same");
    await service.designPrepareImplementation({ design_session_id: "ds_vp_same", platform: "web_desktop", framework: "react" });
    const planned = await service.designValidate({ design_session_id: "ds_vp_same", mode: "plan" });
    expect(planned.status).toBe("EXPAND");
    const session = await store.getSession("ds_vp_same");
    const planArtifact = await store.readArtifact<PersistedValidationPlan>(session, "validationPlan");
    expect(planArtifact?.revision).toBe(1);
    expect(planArtifact?.history).toEqual([]);
  });

  it("re-derives a new auditable revision when upstream artifacts change after the plan", async () => {
    const { service, store } = await startSession("ds_vp_re", "greenfield");
    await driveGreenfieldToPrepare(service, "ds_vp_re");
    await service.designPrepareImplementation({ design_session_id: "ds_vp_re", platform: "web_desktop", framework: "react" });

    // simulate a controlled re-entry effect: the decisions artifact changes on disk
    const dir = await store.artifactDirectory("ds_vp_re");
    const decisionsPath = join(dir, "design-decisions.yaml");
    const raw = await readFile(decisionsPath, "utf8");
    await writeFile(decisionsPath, raw.replace("compact", "regular"), "utf8");

    const planned = await service.designValidate({ design_session_id: "ds_vp_re", mode: "plan" });
    expect(planned.status).toBe("EXPAND");
    const session = await store.getSession("ds_vp_re");
    const planArtifact = await store.readArtifact<PersistedValidationPlan>(session, "validationPlan");
    expect(planArtifact?.revision).toBe(2);
    expect(planArtifact?.history).toHaveLength(1);
    expect(planArtifact?.history[0].revision).toBe(1);
  });

  it("keeps kind to three values with profile/facet as separate fields", async () => {
    const { service, store } = await startSession("ds_vp_kind", "greenfield");
    await driveGreenfieldToPrepare(service, "ds_vp_kind");
    await service.designPrepareImplementation({ design_session_id: "ds_vp_kind", platform: "web_desktop", framework: "react" });
    const session = await store.getSession("ds_vp_kind");
    const planArtifact = await store.readArtifact<PersistedValidationPlan>(session, "validationPlan");
    const kinds = new Set(planArtifact!.plan.checks.map((check) => check.kind));
    expect([...kinds].every((kind) => ["deterministic", "assistive", "empirical"].includes(kind))).toBe(true);
    const relationship = planArtifact!.plan.checks.find((check) => check.id === "relationship_trace");
    expect(relationship).toMatchObject({ profile: "relationship_integrity", facet: "behavioral", kind: "empirical" });
  });

  it("light paths persist the plan at intent time with the plan reference in the brief", async () => {
    const { service, store } = await startSession("ds_vp_lite", "existing_product", "visual_polish");
    await service.designFrame({
      design_session_id: "ds_vp_lite",
      existing_understanding: architectureUnderstanding(["settings"]),
    });
    const result = await service.designFrame({ design_session_id: "ds_vp_lite", intent_lite: intentLite("visual_polish") });
    expect(result.status).toBe("PASS");
    const session = await store.getSession("ds_vp_lite");
    const planArtifact = await store.readArtifact<PersistedValidationPlan>(session, "validationPlan");
    expect(planArtifact?.revision).toBe(1);
    expect(planArtifact?.plan.checks.map((check) => check.id)).toContain("readability");
  });
});
