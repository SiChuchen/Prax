import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { afterEach, expect, it } from "vitest";
import { FileSessionStore, type Correction } from "prax-runtime";
import { PraxService, type PraxOutput } from "prax-mcp";
import { architectureUnderstanding, requirementConfirmation, sdirDelta, writeMeasurementReceiptInto } from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

// MEM-001: the seeded visual-language correction. Screenshot adjudication is
// wired for visual_language_* findings — hue/glow analysis is only valid
// evidence evaluation for visual grammar corrections.
function visualLanguageCorrection(): Correction {
  return {
    id: "corr_canvas_impact_grammar",
    scope: { project: "architecture-canvas", surfaces: ["canvas-stage", "canvas-inspector"] },
    finding: {
      type: "visual_language_emphasis",
      observed: "impact emphasis used hue-coded marking and/or glow instead of the line grammar",
    },
    intended: { statement: "impact emphasis reuses the established line grammar; no per-type hue coding; no glow" },
    evidence_refs: ["human_review_mem001_task1"],
    regression: {
      check_id: "impact_uses_line_grammar",
      requirement: "browser screenshot shows no per-type hue coding and no glow/halo",
    },
    supersedes: [],
    promotion: { candidate: false },
    created_at: "2026-08-27T12:00:00Z",
  };
}

async function adjudicationProject(corrections: Correction[]) {
  const root = await mkdtemp(join(tmpdir(), "prax-adjud-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  const stateRoot = join(root, "state");
  await mkdir(join(projectRoot, ".prax"), { recursive: true });
  await writeFile(
    join(projectRoot, ".prax", "corrections.yaml"),
    stringify({ version: "0.1", corrections }),
    "utf8",
  );
  await mkdir(join(projectRoot, "evidence"), { recursive: true });
  return { stateRoot, projectRoot };
}

async function startCanvasSession(stateRoot: string, projectRoot: string, sessionId: string) {
  const store = new FileSessionStore({ stateRoot, idGenerator: () => sessionId });
  const service = await PraxService.create({ sessions: store });
  await service.designStart({
    requirement: "多选聚合显示影响并标识共享影响",
    project_root: projectRoot,
    mode: "existing_product",
    change_kind: "modify_surface",
    requirement_confirmation: requirementConfirmation(),
  });
  await service.designFrame({
    design_session_id: sessionId,
    // "canvas" is the declared surface id; the seeded correction's scope
    // (canvas-stage/canvas-inspector) matches it via token-subset routing.
    existing_understanding: architectureUnderstanding(["canvas"]),
  });
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
  return service;
}

const CANARY_ROOT = join("benchmark-runs", "PRAX-MEM-001", "pairs");

async function copyCanary(projectRoot: string, relativePath: string, asName: string) {
  await copyFile(join(process.cwd(), CANARY_ROOT, relativePath), join(projectRoot, "evidence", asName));
}

function evidenceItem(checkId: string, artifactRefs: string[] = []) {
  return {
    check_id: checkId,
    outcome: "pass" as const,
    source: "operator review",
    notes: `${checkId} passed`,
    artifact_refs: artifactRefs,
  };
}

function planEvidence(plan: PraxOutput, extraRefs: Record<string, string[]> = {}) {
  const checks = (plan.checks as Array<{ id: string; evidence_required: boolean }>).filter((check) => check.evidence_required);
  return {
    submitted_by: "operator",
    collected_at: new Date().toISOString(),
    items: checks.map((check) => evidenceItem(check.id, extraRefs[check.id] ?? [])),
  };
}

it("a visual-language correction regression with hue-coded screenshots is blocked by the adjudicator", async () => {
  const { stateRoot, projectRoot } = await adjudicationProject([visualLanguageCorrection()]);
  const service = await startCanvasSession(stateRoot, projectRoot, "ds_adj_1");

  const plan = await service.designValidate({ design_session_id: "ds_adj_1", mode: "plan" });
  expect((plan.correction_regressions as Array<{ check_id: string }>)[0]?.check_id).toBe("impact_uses_line_grammar");

  // pair-03 arm B evidence shape: the regression item itself cites only code
  // files; the screenshots ride along under other checks (package-wide screen).
  await copyCanary(projectRoot, "pair-03/task2-arm-b-prax/evidence/screenshots/01-small-browse-baseline.png", "01-baseline.png");
  await copyCanary(projectRoot, "pair-03/task2-arm-b-prax/evidence/screenshots/02-small-ctrl-click-aggregate.png", "02-aggregate.png");
  await copyCanary(projectRoot, "pair-03/task2-arm-b-prax/evidence/screenshots/05-small-shift-marquee-aggregate.png", "05-marquee.png");

  await service.designValidate({
    design_session_id: "ds_adj_1",
    mode: "submit_evidence",
    evidence: {
      submitted_by: "operator",
      collected_at: new Date().toISOString(),
      items: [
        ...planEvidence(plan, {
          untouched_surface_regression: ["evidence/01-baseline.png", "evidence/02-aggregate.png"],
          requirement_alignment: ["evidence/05-marquee.png"],
        }).items,
        {
          check_id: "impact_uses_line_grammar",
          outcome: "pass" as const,
          source: "code review of chip/edge rendering paths",
          notes: "shared impact reuses the established chip grammar; edges keep weight/dash emphasis",
          artifact_refs: ["app/globals.css", "app/architecture/architecture-node.tsx"],
        },
      ],
    },
  });

  const evaluated = await service.designValidate({ design_session_id: "ds_adj_1" });
  expect(evaluated.status).toBe("BLOCK");
  expect(evaluated.missing_evidence as string[]).toContain("impact_uses_line_grammar");
  const finding = (evaluated.findings as Array<{ check_id: string; source: string; message: string; outcome: string }>).find(
    (candidate) => candidate.check_id === "impact_uses_line_grammar",
  );
  expect(finding?.source).toContain("adjudicator");
  expect(finding?.message).toContain("purple_255_315");
  expect(finding?.outcome).toBe("fail");
  expect(evaluated.phase).not.toBe("COMPLETE");
  const inspection = await service.inspectSession("ds_adj_1");
  expect((inspection.session as { phase: string }).phase).not.toBe("COMPLETE");
});

it("a visual-language correction regression with compliant screenshots completes", async () => {
  const { stateRoot, projectRoot } = await adjudicationProject([visualLanguageCorrection()]);
  const service = await startCanvasSession(stateRoot, projectRoot, "ds_adj_2");

  const plan = await service.designValidate({ design_session_id: "ds_adj_2", mode: "plan" });

  // pair-02 arm B (non-color implementation) screenshots.
  await copyCanary(projectRoot, "pair-02/task2-arm-b-prax/evidence/screenshots/01-small-browse.png", "01-browse.png");
  await copyCanary(projectRoot, "pair-02/task2-arm-b-prax/evidence/screenshots/03-small-multi-shared-impact.png", "03-shared.png");
  await copyCanary(projectRoot, "pair-02/task2-arm-b-prax/evidence/screenshots/05-medium-marquee-shared-impact.png", "05-marquee.png");

  const receiptRef = await writeMeasurementReceiptInto(join(projectRoot, ".prax", "design", "sessions", "ds_adj_2"));
  await service.designValidate({
    design_session_id: "ds_adj_2",
    mode: "submit_evidence",
    evidence: {
      submitted_by: "operator",
      collected_at: new Date().toISOString(),
      items: [
        ...planEvidence(plan, { untouched_surface_regression: ["evidence/01-browse.png"] }).items.map((item) =>
          item.check_id === "untouched_surface_regression" ? { ...item, measurement_receipt: receiptRef } : item,
        ),
        {
          check_id: "impact_uses_line_grammar",
          outcome: "pass" as const,
          source: "browser screenshots",
          notes: "emphasis via weight/dash and emphasis states",
          artifact_refs: ["evidence/03-shared.png", "evidence/05-marquee.png"],
        },
      ],
    },
  });

  const evaluated = await service.designValidate({ design_session_id: "ds_adj_2" });
  expect(evaluated.status).toBe("PASS");
  expect(evaluated.missing_evidence as string[]).not.toContain("impact_uses_line_grammar");
  expect(evaluated.phase).toBe("COMPLETE");
});

it("a visual-language regression pass claim without any screenshot reopens the obligation", async () => {
  const { stateRoot, projectRoot } = await adjudicationProject([visualLanguageCorrection()]);
  const service = await startCanvasSession(stateRoot, projectRoot, "ds_adj_3");

  const plan = await service.designValidate({ design_session_id: "ds_adj_3", mode: "plan" });

  await service.designValidate({
    design_session_id: "ds_adj_3",
    mode: "submit_evidence",
    evidence: {
      submitted_by: "operator",
      collected_at: new Date().toISOString(),
      items: [
        ...planEvidence(plan).items,
        {
          check_id: "impact_uses_line_grammar",
          outcome: "pass" as const,
          source: "code review",
          notes: "no hue coding in the diff",
          artifact_refs: ["app/globals.css"],
        },
      ],
    },
  });

  const evaluated = await service.designValidate({ design_session_id: "ds_adj_3" });
  expect(evaluated.status).toBe("EXPAND");
  expect(evaluated.missing_evidence as string[]).toContain("impact_uses_line_grammar");
  const finding = (evaluated.findings as Array<{ check_id: string; message: string }>).find(
    (candidate) => candidate.check_id === "impact_uses_line_grammar",
  );
  expect(finding?.message).toMatch(/screenshot/i);
  expect(evaluated.phase).not.toBe("COMPLETE");
});

it("an unreadable screenshot reference reopens the obligation instead of failing silently", async () => {
  const { stateRoot, projectRoot } = await adjudicationProject([visualLanguageCorrection()]);
  const service = await startCanvasSession(stateRoot, projectRoot, "ds_adj_4");

  const plan = await service.designValidate({ design_session_id: "ds_adj_4", mode: "plan" });

  await service.designValidate({
    design_session_id: "ds_adj_4",
    mode: "submit_evidence",
    evidence: {
      submitted_by: "operator",
      collected_at: new Date().toISOString(),
      items: [
        ...planEvidence(plan).items,
        {
          check_id: "impact_uses_line_grammar",
          outcome: "pass" as const,
          source: "browser screenshots",
          notes: "verified visually",
          artifact_refs: ["evidence/missing.png"],
        },
      ],
    },
  });

  const evaluated = await service.designValidate({ design_session_id: "ds_adj_4" });
  expect(evaluated.status).toBe("EXPAND");
  expect(evaluated.missing_evidence as string[]).toContain("impact_uses_line_grammar");
  const finding = (evaluated.findings as Array<{ check_id: string; message: string }>).find(
    (candidate) => candidate.check_id === "impact_uses_line_grammar",
  );
  expect(finding?.message).toContain("evidence/missing.png");
});

it("a single screenshot without a baseline reference reopens with a needs-reference explanation", async () => {
  const { stateRoot, projectRoot } = await adjudicationProject([visualLanguageCorrection()]);
  const service = await startCanvasSession(stateRoot, projectRoot, "ds_adj_5");

  const plan = await service.designValidate({ design_session_id: "ds_adj_5", mode: "plan" });

  await copyCanary(projectRoot, "pair-03/task2-arm-b-prax/evidence/screenshots/05-small-shift-marquee-aggregate.png", "05-marquee.png");

  await service.designValidate({
    design_session_id: "ds_adj_5",
    mode: "submit_evidence",
    evidence: {
      submitted_by: "operator",
      collected_at: new Date().toISOString(),
      items: [
        ...planEvidence(plan).items,
        {
          check_id: "impact_uses_line_grammar",
          outcome: "pass" as const,
          source: "browser screenshots",
          notes: "verified visually",
          artifact_refs: ["evidence/05-marquee.png"],
        },
      ],
    },
  });

  const evaluated = await service.designValidate({ design_session_id: "ds_adj_5" });
  expect(evaluated.status).toBe("EXPAND");
  expect(evaluated.missing_evidence as string[]).toContain("impact_uses_line_grammar");
  const finding = (evaluated.findings as Array<{ check_id: string; message: string }>).find(
    (candidate) => candidate.check_id === "impact_uses_line_grammar",
  );
  expect(finding?.message).toMatch(/baseline|reference/i);
});
