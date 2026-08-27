import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
  directCodeConditions,
  figmaFirstConditions,
  requirementConfirmation,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function startGreenfield(sessionId: string) {
  const root = await mkdtemp(join(tmpdir(), "prax-realize-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  const started = await service.designStart({
    requirement: "Build the Prax product landing page.",
    project_root: projectRoot,
    mode: "greenfield",
    requirement_confirmation: requirementConfirmation(),
  });
  expect(started.status).toBe("PASS");
  return { service, store };
}

async function driveToReconcile(service: PraxService, sessionId: string) {
  await service.designFrame({ design_session_id: sessionId, product_frame: architectureProductFrame() });
  await service.designContext({ design_session_id: sessionId, design_context: architectureContext() });
  const routed = await service.designRoute({ design_session_id: sessionId, question: "Choose the landing page structure" });
  const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
  await service.designInspect({
    design_session_id: sessionId,
    ids: [patternId],
    depth: "L1",
    purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "Confirm pattern" },
  });
  await service.designDecide({ design_session_id: sessionId, design_decisions: architectureDecisions(sessionId) });
  const sdir = await service.designSdir({ design_session_id: sessionId, mode: "generate_from_decisions" });
  expect(sdir.status).toBe("PASS");
  await service.designReconcile({ design_session_id: sessionId, capability_map: architectureCapabilities() });
  const regions = (sdir.sdir as { screen: { regions: Array<{ id: string }> } }).screen.regions.map((region) => region.id);
  return regions;
}

async function writeEvidence(store: FileSessionStore, sessionId: string, round: number, name: string) {
  const dir = await store.artifactDirectory(sessionId);
  await mkdir(join(dir, "rep-evidence", `round-${round}`), { recursive: true });
  const file = join(dir, "rep-evidence", `round-${round}`, name);
  await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
  return `rep-evidence/round-${round}/${name}`;
}

async function writeRuntimeSnapshot(store: FileSessionStore, sessionId: string, name: string) {
  const dir = await store.artifactDirectory(sessionId);
  await mkdir(join(dir, "rep-evidence"), { recursive: true });
  const file = join(dir, "rep-evidence", `runtime-${name}`);
  await writeFile(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return `rep-evidence/runtime-${name}`;
}

function draftRefs(regions: string[]) {
  return {
    file_key: "figma-landing",
    frames: regions.map((region, index) => ({ node_id: `node-${index + 1}`, name: `Frame ${index + 1}`, sdir_region: region })),
  };
}

const HUMAN_DECISION = {
  type: "human_decision" as const,
  actor_ref: "user:SiChuchen",
  source_type: "conversation",
  source_ref: "claude-code-session",
  quote: "approved after hero revision",
};

describe("design_realize end to end", () => {
  it("runs figma_first propose → draft → review → prepare → validate with drift checks", async () => {
    const sessionId = "ds_realize_full";
    const { service, store } = await startGreenfield(sessionId);
    const regions = await driveToReconcile(service, sessionId);

    const prepareWithoutDecision = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepareWithoutDecision).toMatchObject({ status: "BLOCK", code: "REALIZATION_REQUIRED" });

    const proposed = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions(),
    });
    expect(proposed.status).toBe("PASS");
    expect(proposed.phase).toBe("REALIZATION");

    const prepareBeforeReview = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepareBeforeReview).toMatchObject({ status: "BLOCK" });

    const partial = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_draft",
      provider_refs: { file_key: "figma-landing", frames: [draftRefs(regions).frames[0]!] },
    });
    expect(partial).toMatchObject({ status: "EXPAND" });

    const draft = await service.designRealize({ design_session_id: sessionId, mode: "submit_draft", provider_refs: draftRefs(regions) });
    expect(draft.status).toBe("REVIEW");

    const refsMismatch = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: ["node-1"] },
      evidence: [{ ...HUMAN_DECISION }],
    });
    expect(refsMismatch).toMatchObject({ status: "RETRY" });

    const heroRef = await writeEvidence(store, sessionId, 1, "hero.png");
    const approved = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: draftRefs(regions).frames.map((frame) => frame.node_id) },
      feedback: { text: "approved" },
      evidence: [{ type: "screenshot", ref: heroRef }, HUMAN_DECISION],
    });
    expect(approved.status).toBe("PASS");

    const locked = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(locked).toMatchObject({ status: "BLOCK", code: "REALIZATION_LOCKED" });

    const prepared = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    const brief = prepared.implementation_brief as { realization: Record<string, unknown> };
    expect(brief.realization).toMatchObject({ mode: "figma_first", provider: "figma" });
    const compiled = prepared.compiled_context as { representation?: { region_frames: unknown[] } };
    expect(compiled.representation?.region_frames).toHaveLength(regions.length);

    const planned = await service.designValidate({ design_session_id: sessionId, mode: "plan" });
    const checks = planned.checks as Array<{ id: string; evidence_required: boolean }>;
    expect(checks.map((check) => check.id)).toContain("design_representation_coverage");
    const runtimeRef = await writeRuntimeSnapshot(store, sessionId, "landing.png");
    const evidence = {
      submitted_by: "realize-e2e",
      collected_at: new Date().toISOString(),
      items: [
        ...checks
          .filter((check) => check.evidence_required && check.id !== "representation_runtime_drift")
          .map((check) => ({ check_id: check.id, outcome: "pass" as const, source: "e2e review", notes: `${check.id} ok` })),
        {
          check_id: "representation_runtime_drift",
          outcome: "pass" as const,
          source: "visual diff",
          notes: "runtime page matches approved frames",
          artifact_refs: [heroRef, runtimeRef],
        },
      ],
    };
    const submitted = await service.designValidate({ design_session_id: sessionId, mode: "submit_evidence", evidence });
    expect(submitted.status).toBe("PASS");
    const evaluated = await service.designValidate({ design_session_id: sessionId, mode: "evaluate" });
    expect(evaluated.status).toBe("PASS");
    expect(evaluated.phase).toBe("COMPLETE");
  });

  it("rejects drift evidence that is not two verified refs and blocks self-attestation", async () => {
    const sessionId = "ds_realize_driftev";
    const { service, store } = await startGreenfield(sessionId);
    const regions = await driveToReconcile(service, sessionId);
    await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions(),
    });
    await service.designRealize({ design_session_id: sessionId, mode: "submit_draft", provider_refs: draftRefs(regions) });
    const heroRef = await writeEvidence(store, sessionId, 1, "hero.png");
    await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: draftRefs(regions).frames.map((frame) => frame.node_id) },
      feedback: { text: "approved" },
      evidence: [{ type: "screenshot", ref: heroRef }, HUMAN_DECISION],
    });
    await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    const planned = await service.designValidate({ design_session_id: sessionId, mode: "plan" });
    const checks = planned.checks as Array<{ id: string; evidence_required: boolean }>;
    const badEvidence = {
      submitted_by: "realize-e2e",
      collected_at: new Date().toISOString(),
      items: [
        ...checks
          .filter((check) => check.evidence_required && check.id !== "representation_runtime_drift")
          .map((check) => ({ check_id: check.id, outcome: "pass" as const, source: "e2e review", notes: `${check.id} ok` })),
        {
          check_id: "representation_runtime_drift",
          outcome: "pass" as const,
          source: "visual diff",
          notes: "only one ref",
          artifact_refs: [heroRef],
        },
      ],
    };
    const rejected = await service.designValidate({ design_session_id: sessionId, mode: "submit_evidence", evidence: badEvidence });
    expect(rejected).toMatchObject({ status: "EXPAND", code: "REALIZATION_DRIFT_EVIDENCE_INVALID" });
  });

  it("loops a rejected review and records full history", async () => {
    const sessionId = "ds_realize_reject";
    const { service, store } = await startGreenfield(sessionId);
    const regions = await driveToReconcile(service, sessionId);
    await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions(),
    });
    await service.designRealize({ design_session_id: sessionId, mode: "submit_draft", provider_refs: draftRefs(regions) });
    const heroRef = await writeEvidence(store, sessionId, 1, "hero.png");
    const rejected = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "rejected",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: draftRefs(regions).frames.map((frame) => frame.node_id) },
      feedback: { text: "hero too weak", region_annotations: [{ sdir_region: regions[0]!, note: "contrast" }] },
      evidence: [{ type: "screenshot", ref: heroRef }, HUMAN_DECISION],
    });
    expect(rejected.status).toBe("REVIEW");
    const session = await store.getSession(sessionId);
    const artifact = await store.readArtifact<{ status: string }>(session, "representationArtifact");
    expect(artifact?.status).toBe("revision_requested");

    await service.designRealize({ design_session_id: sessionId, mode: "submit_draft", provider_refs: draftRefs(regions) });
    const heroRef2 = await writeEvidence(store, sessionId, 2, "hero.png");
    const approved = await service.designRealize({
      design_session_id: sessionId,
      mode: "submit_review",
      status: "approved",
      provider_refs_verified: { file_key: "figma-landing", frame_node_ids: draftRefs(regions).frames.map((frame) => frame.node_id) },
      feedback: { text: "approved" },
      evidence: [{ type: "screenshot", ref: heroRef2 }, HUMAN_DECISION],
    });
    expect(approved.status).toBe("PASS");
    const review = await store.readArtifact<{ round: number; history: unknown[] }>(session, "representationReview");
    expect(review?.round).toBe(2);
    expect(review?.history).toHaveLength(1);
  });

  it("explicit direct_code proposals reach prepare and plans carry no representation checks", async () => {
    const sessionId = "ds_realize_direct";
    const { service } = await startGreenfield(sessionId);
    await driveToReconcile(service, sessionId);
    const proposed = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(proposed).toMatchObject({ status: "PASS" });
    expect(proposed.next).toEqual({ tool: "design_prepare_implementation" });
    const prepared = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    expect((prepared.implementation_brief as { realization: { mode: string } }).realization.mode).toBe("direct_code");
    const planned = await service.designValidate({ design_session_id: sessionId, mode: "plan" });
    expect((planned.checks as Array<{ id: string }>).some((check) => check.id === "design_representation_coverage")).toBe(false);
  });

  it("flips figma_first → direct_code before approval, abandoning the artifact and unblocking prepare", async () => {
    const sessionId = "ds_realize_flip";
    const { service } = await startGreenfield(sessionId);
    await driveToReconcile(service, sessionId);
    await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions(),
    });
    const noReason = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(noReason).toMatchObject({ status: "EXPAND" });
    const flipped = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
      reason: "figma write seat unavailable",
    });
    expect(flipped.status).toBe("PASS");
    const prepared = await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
  });

  it("reviews an unfit figma_first proposal without persisting anything", async () => {
    const sessionId = "ds_realize_review";
    const { service, store } = await startGreenfield(sessionId);
    await driveToReconcile(service, sessionId);
    const unfit = await service.designRealize({
      design_session_id: sessionId,
      mode: "propose",
      realization_mode: "figma_first",
      provider: "figma",
      conditions: figmaFirstConditions({ runtime_dependency_low: false }),
    });
    expect(unfit).toMatchObject({ status: "REVIEW", code: "REALIZATION_MODE_MISMATCH" });
    const session = await store.getSession(sessionId);
    expect(session.artifacts.realizationDecision).toBeUndefined();
    expect(await store.readArtifact(session, "representationArtifact")).toBeUndefined();
  });

  it("leaves v1 legacy sessions untouched: prepare without realization and design_realize unreachable", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-realize-v1-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_realize_v1" });
    const service = await PraxService.create({ sessions: store });
    await store.createSession({
      projectRoot,
      requirement: "Legacy v1 session",
      mode: "greenfield",
      lifecyclePolicy: {
        version: "1",
        mode: "greenfield",
        gates: ["framing", "context", "route", "decide", "sdir", "reconcile", "prepare", "validate"],
      },
    });
    await service.designFrame({ design_session_id: "ds_realize_v1", product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: "ds_realize_v1", design_context: architectureContext() });
    const routed = await service.designRoute({ design_session_id: "ds_realize_v1", question: "structure" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-CANVAS-WORKSPACE";
    await service.designInspect({
      design_session_id: "ds_realize_v1",
      ids: [patternId],
      depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "confirm" },
    });
    await service.designDecide({ design_session_id: "ds_realize_v1", design_decisions: architectureDecisions("ds_realize_v1") });
    await service.designSdir({ design_session_id: "ds_realize_v1", mode: "generate_from_decisions" });
    await service.designReconcile({ design_session_id: "ds_realize_v1", capability_map: architectureCapabilities() });
    const realized = await service.designRealize({
      design_session_id: "ds_realize_v1",
      mode: "propose",
      realization_mode: "direct_code",
      conditions: directCodeConditions(),
    });
    expect(realized).toMatchObject({ status: "BLOCK", code: "REALIZATION_WINDOW_INVALID" });
    const prepared = await service.designPrepareImplementation({ design_session_id: "ds_realize_v1", platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    expect((prepared.implementation_brief as { realization?: unknown }).realization).toBeUndefined();
  });
});
