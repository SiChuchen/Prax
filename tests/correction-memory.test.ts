import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { FileSessionStore, activeCorrections, relevantCorrections, type Correction } from "prax-runtime";
import { PraxService } from "prax-mcp";
import {
  architectureUnderstanding,
  requirementConfirmation,
  sdirDelta,
} from "./fixtures.js";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function settingsCorrection(): Correction {
  return {
    id: "corr_settings_001",
    scope: { project: "architecture_canvas", surfaces: ["settings"] },
    finding: { type: "hierarchy_semantics", observed: "search competed with section navigation" },
    intended: { statement: "search stays supporting and never outranks sections" },
    evidence_refs: ["human_review_001"],
    regression: { check_id: "settings_search_supporting", requirement: "search remains a supporting control" },
    supersedes: [],
    promotion: { candidate: false },
    created_at: "2026-08-26T00:00:00.000Z",
  };
}

async function correctionStoreWith(corrections: Correction[]) {
  const root = await mkdtemp(join(tmpdir(), "prax-corr-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot);
  const stateRoot = join(root, "state");
  await mkdir(join(projectRoot, ".prax"), { recursive: true });
  await writeFile(
    join(projectRoot, ".prax", "corrections.yaml"),
    stringify({ version: "0.1", corrections }),
    "utf8",
  );
  return { stateRoot, projectRoot };
}

async function startModifySession(stateRoot: string, projectRoot: string, sessionId: string) {
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
  await service.designPrepareImplementation({ design_session_id: sessionId, platform: "web_desktop", framework: "react" });
  return service;
}

describe("correction memory units", () => {
  it("excludes superseded corrections and defaults promotion off", () => {
    const base = settingsCorrection();
    const superseding: Correction = {
      ...settingsCorrection(),
      id: "corr_settings_002",
      supersedes: ["corr_settings_001"],
    };
    const active = activeCorrections([base, superseding]);
    expect(active.map((c) => c.id)).toEqual(["corr_settings_002"]);
    expect(active[0].promotion.candidate).toBe(false);
  });

  // MEM-001 pair-01 finding: the target correction scoped to
  // canvas-stage/canvas-inspector was dropped (scope_mismatch) when the
  // session declared architecture_canvas/canvas_inspector/fixture_workbench,
  // while the settings probe must stay excluded.
  describe("surface scope matching", () => {
    const target: Correction = {
      id: "corr_canvas_impact_grammar",
      scope: { project: "architecture-canvas", surfaces: ["canvas-stage", "canvas-inspector"] },
      finding: { type: "visual_language_emphasis", observed: "hue-coded impact marking" },
      intended: { statement: "impact emphasis reuses the line grammar" },
      evidence_refs: ["human_review_mem001_task1"],
      regression: { check_id: "impact_uses_line_grammar", requirement: "no hue coding, no glow" },
      supersedes: [],
      promotion: { candidate: false },
      created_at: "2026-08-27T12:00:00Z",
    };
    const probe: Correction = {
      ...target,
      id: "corr_probe_settings_001",
      scope: { project: "architecture-canvas", surfaces: ["settings-page"] },
      regression: { check_id: "settings_collapsed_by_default" },
    };

    it("matches across separator and case differences", () => {
      const relevant = relevantCorrections([target], {
        surfaces: ["Architecture_Canvas", "Canvas_Inspector", "Fixture_Workbench"],
      });
      expect(relevant.map((c) => c.id)).toEqual(["corr_canvas_impact_grammar"]);
    });

    it("matches via a shared significant token", () => {
      const relevant = relevantCorrections([target], {
        surfaces: ["architecture_canvas", "fixture_workbench"],
      });
      expect(relevant.map((c) => c.id)).toEqual(["corr_canvas_impact_grammar"]);
    });

    it("keeps the probe excluded on canvas tasks while the target matches", () => {
      const relevant = relevantCorrections([target, probe], {
        surfaces: ["architecture_canvas", "canvas_inspector", "fixture_workbench"],
      });
      expect(relevant.map((c) => c.id)).toEqual(["corr_canvas_impact_grammar"]);
    });

    it("generic token overlap alone does not match", () => {
      const relevant = relevantCorrections([probe], { surfaces: ["home_page"] });
      expect(relevant).toEqual([]);
    });

    it("exact match still works", () => {
      const relevant = relevantCorrections([target], { surfaces: ["canvas-stage"] });
      expect(relevant.map((c) => c.id)).toEqual(["corr_canvas_impact_grammar"]);
    });
  });

  it("scopes corrections by surface and keeps unrelated ones out", () => {
    const settings = settingsCorrection();
    const canvas: Correction = {
      ...settingsCorrection(),
      id: "corr_canvas_001",
      scope: { project: "architecture_canvas", surfaces: ["canvas"] },
    };
    const forSettings = relevantCorrections([settings, canvas], { surfaces: ["settings"] });
    expect(forSettings.map((c) => c.id)).toEqual(["corr_settings_001"]);
  });
});

describe("correction memory across sessions", () => {
  it("a fresh session's validation carries the relevant regression obligation", async () => {
    const { stateRoot, projectRoot } = await correctionStoreWith([settingsCorrection()]);
    const service = await startModifySession(stateRoot, projectRoot, "ds_corr_1");

    const planned = await service.designValidate({ design_session_id: "ds_corr_1", mode: "plan" });
    expect(planned.status).toBe("EXPAND");
    expect(planned.missing_evidence as string[]).toContain("settings_search_supporting");
    expect(planned.correction_regressions).toEqual([
      { correction_id: "corr_settings_001", check_id: "settings_search_supporting", surfaces: ["settings"] },
    ]);
  });

  it("a correction scoped to another surface never leaks into validation", async () => {
    const otherSurface: Correction = {
      ...settingsCorrection(),
      id: "corr_billing_001",
      scope: { project: "architecture_canvas", surfaces: ["billing"] },
    };
    const { stateRoot, projectRoot } = await correctionStoreWith([otherSurface]);
    const service = await startModifySession(stateRoot, projectRoot, "ds_corr_2");

    const planned = await service.designValidate({ design_session_id: "ds_corr_2", mode: "plan" });
    expect(planned.missing_evidence as string[]).not.toContain("settings_search_supporting");
    expect(planned.correction_regressions).toBeUndefined();
  });

  it("corrections never fabricate evidence; they only create obligations", async () => {
    const { stateRoot, projectRoot } = await correctionStoreWith([settingsCorrection()]);
    const service = await startModifySession(stateRoot, projectRoot, "ds_corr_3");

    const planned = await service.designValidate({ design_session_id: "ds_corr_3", mode: "plan" });
    expect(planned.findings).toEqual([]);
    expect(planned.missing_evidence).toContain("settings_search_supporting");
  });

  it("a passing evidence item for the regression check clears the obligation", async () => {
    const { stateRoot, projectRoot } = await correctionStoreWith([settingsCorrection()]);
    const service = await startModifySession(stateRoot, projectRoot, "ds_corr_4");

    await service.designValidate({
      design_session_id: "ds_corr_4",
      mode: "submit_evidence",
      evidence: {
        submitted_by: "operator",
        collected_at: "2026-08-26T00:00:00.000Z",
        items: [
          {
            check_id: "settings_search_supporting",
            outcome: "pass",
            source: "human_review_001",
            notes: "search verified as supporting control",
          },
        ],
      },
    });

    const evaluation = await service.designValidate({ design_session_id: "ds_corr_4" });
    expect(evaluation.missing_evidence as string[]).not.toContain("settings_search_supporting");
  });
});
