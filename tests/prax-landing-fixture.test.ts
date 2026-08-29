import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { afterEach, expect, it } from "vitest";
import { FileSessionStore, contentDigest } from "prax-runtime";
import { PraxService } from "prax-mcp";

/**
 * Replays the frozen PRAX-LANDING-001 golden fixture
 * (golden/prax-landing/fixture/, figma_first live run of 2026-08-29,
 * session ds_20260829074608_9cd15a9c) through the current runtime and
 * asserts the run still reaches COMPLETE with the exact recorded
 * SDIR digest, screenshot digests, and realization anchor. Any gate
 * or validation change that would break the live golden run fails here.
 */

const FIXTURE_ROOT = join(process.cwd(), "golden", "prax-landing", "fixture");
const SESSION_ID = "ds_prax_landing_fixture";

const REQUIREMENT_TEXT =
  'Design and implement the Prax product website home page. Sections: hero with product value proposition and primary CTA, "how it works" value summary (three-stage), capability features list, closing CTA. Audience: engineering leads evaluating AI-assisted frontend design tooling. Tone: precise, product-first, no marketing fluff. Static page; no complex runtime state. (Golden case PRAX-LANDING-001, figma_first realization per Methodology §18.2.)';

const ROUTE_QUESTION =
  "Prax 产品官网首页（单页营销/产品站：hero + 三段式 how-it-works + capabilities + 收尾 CTA，工程负责人评估场景）应采用什么页面结构模式？";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function loadFixture<T>(name: string): Promise<T> {
  return parse(await readFile(join(FIXTURE_ROOT, name), "utf8")) as T;
}

async function startFixtureSession() {
  const root = await mkdtemp(join(tmpdir(), "prax-landing-fixture-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot, { recursive: true });
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => SESSION_ID });
  const service = await PraxService.create({ sessions: store });
  const started = await service.designStart({
    requirement: REQUIREMENT_TEXT,
    project_root: projectRoot,
    mode: "greenfield",
    requirement_confirmation: await loadFixture("requirement-confirmation.yaml"),
  });
  expect(["PASS", "WARN"]).toContain(started.status);
  const sessionDir = join(projectRoot, ".prax", "design", "sessions", SESSION_ID);
  await cp(join(FIXTURE_ROOT, "rep-evidence"), join(sessionDir, "rep-evidence"), { recursive: true });
  return { service, sessionDir };
}

it("replays the PRAX-LANDING-001 fixture through every gate to COMPLETE with golden digests intact", async () => {
  const { service } = await startFixtureSession();

  const frame = await loadFixture("product-frame.yaml");
  const context = await loadFixture("design-context.yaml");
  const decisions = await loadFixture("design-decisions.yaml");
  const gaps = await loadFixture("capability-gaps.yaml");
  const realizationDecision = await loadFixture("realization-decision.yaml");
  const representationArtifact = await loadFixture("representation-artifact.yaml");
  const representationReview = await loadFixture("representation-review.yaml");
  const compiledFixture = await loadFixture("compiled-context.yaml");
  const validationReport = await loadFixture("validation-report.yaml");

  expect((await service.designFrame({ design_session_id: SESSION_ID, product_frame: frame })).status).toBe("PASS");
  expect((await service.designContext({ design_session_id: SESSION_ID, design_context: context })).status).toBe("PASS");

  const routed = await service.designRoute({ design_session_id: SESSION_ID, question: ROUTE_QUESTION });
  expect(routed.status).toBe("PASS");
  const routedPatternIds = (routed.patterns as Array<{ id: string }>).map((pattern) => pattern.id);
  expect(routedPatternIds).toContain("PAT-APPLICATION-SHELL");
  expect(routedPatternIds).toContain("PAT-LIST-DETAIL");

  expect(
    (
      await service.designInspect({
        design_session_id: SESSION_ID,
        ids: ["PAT-LIST-DETAIL", "PAT-APPLICATION-SHELL"],
        depth: "L1",
        purpose: {
          kind: "compare_alternatives",
          target_ids: ["PAT-LIST-DETAIL", "PAT-APPLICATION-SHELL"],
          question: "确认两个路由候选是否适用于静态营销落地页（无对象选择、无变化工作区）",
        },
      })
    ).status,
  ).toBe("PASS");

  const decided = await service.designDecide({
    design_session_id: SESSION_ID,
    design_decisions: { ...decisions, session_id: SESSION_ID },
  });
  expect(decided.status).toBe("PASS");

  const sdir = await service.designSdir({ design_session_id: SESSION_ID, mode: "generate_from_decisions" });
  expect(sdir.status).toBe("PASS");
  const fixtureSdir = await loadFixture("screen.sdir.yaml");
  expect(sdir.sdir).toEqual(fixtureSdir);
  expect(contentDigest(sdir.sdir)).toBe(representationArtifact.semantic_refs.sdir_digest);

  expect(
    (await service.designReconcile({ design_session_id: SESSION_ID, capability_map: { needs: gaps.needs } })).status,
  ).toBe("PASS");

  const proposed = await service.designRealize({
    design_session_id: SESSION_ID,
    mode: "propose",
    realization_mode: "figma_first",
    provider: "figma",
    conditions: realizationDecision.conditions,
  });
  expect(proposed.status).toBe("PASS");

  const draft = await service.designRealize({
    design_session_id: SESSION_ID,
    mode: "submit_draft",
    provider: "figma",
    provider_refs: representationArtifact.realization.refs,
  });
  expect(draft.status).toBe("REVIEW");

  const reviewed = await service.designRealize({
    design_session_id: SESSION_ID,
    mode: "submit_review",
    status: "approved",
    provider_refs_verified: {
      file_key: representationArtifact.realization.refs!.file_key,
      frame_node_ids: representationArtifact.realization.refs!.frames.map((frameRef) => frameRef.node_id),
    },
    evidence: representationReview.evidence,
  });
  expect(reviewed.status).toBe("PASS");
  const reviewRecord = reviewed.representation_review as {
    round: number;
    status: string;
    evidence: Array<{ type: string; ref?: string; sha256?: string }>;
  };
  expect(reviewRecord.round).toBe(1);
  for (const item of reviewRecord.evidence.filter((entry) => entry.type === "screenshot")) {
    const recorded = representationReview.evidence.find(
      (entry) => entry.type === "screenshot" && entry.ref === item.ref,
    ) as { sha256: string };
    expect(item.sha256).toBe(recorded.sha256);
  }

  const prepared = await service.designPrepareImplementation({
    design_session_id: SESSION_ID,
    platform: "web_desktop",
    framework: "react",
  });
  expect(prepared.status).toBe("PASS");
  const brief = prepared.implementation_brief as {
    realization: {
      mode: string;
      provider: string;
      review: { round: number; screenshot_digests: Array<{ ref: string; sha256: string }> };
      sdir_digest: string;
    };
  };
  expect(brief.realization.mode).toBe("figma_first");
  expect(brief.realization.provider).toBe("figma");
  expect(brief.realization.review.round).toBe(1);
  expect(brief.realization.sdir_digest).toBe(representationArtifact.semantic_refs.sdir_digest);
  const compiled = prepared.compiled_context as {
    representation: {
      approved_anchor: { screenshot_digests: Array<{ ref: string; sha256: string }> };
      region_frames: Array<{ region: string; node_id: string; name: string }>;
    };
  };
  expect(compiled.representation.region_frames).toEqual(
    (compiledFixture.representation as { region_frames: Array<{ region: string; node_id: string; name: string }> })
      .region_frames,
  );
  const anchorByRef = new Map(
    compiled.representation.approved_anchor.screenshot_digests.map((digest) => [digest.ref, digest.sha256]),
  );
  for (const digest of brief.realization.review.screenshot_digests) {
    expect(anchorByRef.get(digest.ref)).toBe(digest.sha256);
  }

  const planned = await service.designValidate({ design_session_id: SESSION_ID, mode: "plan" });
  expect(planned.status).toBe("EXPAND");
  const checkIds = (planned.checks as Array<{ id: string }>).map((check) => check.id);
  expect(checkIds).toContain("design_representation_coverage");
  expect(checkIds).toContain("representation_runtime_drift");

  const submitted = await service.designValidate({
    design_session_id: SESSION_ID,
    mode: "submit_evidence",
    evidence: validationReport.evidence,
  });
  expect(submitted.status).toBe("PASS");

  const evaluated = await service.designValidate({ design_session_id: SESSION_ID, mode: "evaluate" });
  expect(evaluated.status).toBe("PASS");
  expect(evaluated.warnings).toEqual([]);
  expect(evaluated.phase).toBe("COMPLETE");
  const findings = evaluated.findings as Array<{ check_id: string; outcome: string }>;
  expect(findings.length).toBe(checkIds.length);
  expect(findings.every((finding) => finding.outcome === "pass")).toBe(true);
});
