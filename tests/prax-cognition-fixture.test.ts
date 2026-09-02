import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { afterEach, expect, it } from "vitest";
import { FileSessionStore, contentDigest } from "prax-runtime";
import { PraxService } from "prax-mcp";

/**
 * Replays the frozen PRAX-COGNITION-001 golden fixture
 * (golden/prax-cognition/fixture/, direct_code live run of 2026-09-02,
 * session ds_20260902113424_16f6a971) through the current runtime and
 * asserts the run still reaches COMPLETE with the recorded SDIR intact.
 * First 0.2-payload live chain (existing_product + add_surface +
 * direct_code); any gate or validation change that would break the live
 * golden run fails here.
 */

const FIXTURE_ROOT = join(process.cwd(), "golden", "prax-cognition", "fixture");
const SESSION_ID = "ds_prax_cognition_fixture";

const REQUIREMENT_TEXT =
  "让人在 Agent 高速推进项目的情况下，持续理解并掌控项目真实状态、变化与原因。（Golden case PRAX-COGNITION-001，existing_product add_surface，direct_code 实现，0.2 载荷链。）";

const ROUTE_QUESTION =
  "为工程认知工作台（Cognition Workspace）选择主结构与表达组合：任务是高频 understand/monitor——需要同时呈现项目架构结构（实体关系，回答“现在是什么样”）、变化时间线（回答“发生了什么”）、以及选中对象下钻到原因与证据（决策/事件）；对象基数 many、关系复杂度高、变化率高、专家用户。候选 pattern 与 representation 组合应如何选择？";

// 真实收据的七检查目录与 error 档标注（与 live receipt-2026-09-02T12-34-56-220Z
// 同构；run_at 取 replay 时刻以通过 R3 staleness 检查）。
const ARTIFACT_CHECK_IDS = [
  "layout.overflow",
  "layout.responsive_collision",
  "text.truncation",
  "a11y.contrast",
  "a11y.focus_order",
  "a11y.target_size",
  "type.min_projected_size",
];
const ERROR_TIER = new Set(ARTIFACT_CHECK_IDS.slice(0, 6));

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function loadFixture<T>(name: string): Promise<T> {
  return parse(await readFile(join(FIXTURE_ROOT, name), "utf8")) as T;
}

async function writeCognitionReceiptInto(sessionDirectory: string): Promise<string> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(sessionDirectory, "validation-evidence"), { recursive: true });
  const receipt = {
    receipt_version: "0.1",
    tool: { name: "prax-measure", version: "0.1.0" },
    target: { app_root: "E:/codex-prj/ecp-worktrees/ecp-cognition", base_url: "http://[::1]:4311/cognition", build_ref: null },
    run_at: new Date(Date.now() + 60_000).toISOString(),
    viewport_matrix: [
      { width: 1280, height: 860, label: "desktop" },
      { width: 1440, height: 900, label: "wide" },
    ],
    checks: ARTIFACT_CHECK_IDS.map((id) => ({
      id,
      status: "pass",
      severity: ERROR_TIER.has(id) ? "error" : "warning",
      measured: {},
      threshold: {},
      evidence_refs: [],
      supported_fixes: [],
    })),
    summary: { pass: 7, fail: 0, skipped: 0, warnings: 0 },
  };
  await writeFile(
    join(sessionDirectory, "validation-evidence", "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  return "validation-evidence/receipt.json";
}

it("replays the PRAX-COGNITION-001 fixture through every gate to COMPLETE with golden digests intact", async () => {
  const root = await mkdtemp(join(tmpdir(), "prax-cognition-fixture-"));
  cleanup.push(root);
  const projectRoot = join(root, "project");
  await mkdir(projectRoot, { recursive: true });
  const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => SESSION_ID });
  const service = await PraxService.create({ sessions: store });

  const started = await service.designStart({
    requirement: REQUIREMENT_TEXT,
    project_root: projectRoot,
    mode: "existing_product",
    change_kind: "add_surface",
  });
  expect(["PASS", "WARN"]).toContain(started.status);

  const confirmed = await service.designStart({
    design_session_id: SESSION_ID,
    requirement_confirmation: await loadFixture("requirement-confirmation.yaml"),
  });
  expect(confirmed.status).toBe("PASS");
  const sessionDir = join(projectRoot, ".prax", "design", "sessions", SESSION_ID);

  const understanding = await loadFixture("existing-understanding.yaml");
  // live run also warned here: no external design authorities declared.
  expect(["PASS", "WARN"]).toContain((await service.designFrame({ design_session_id: SESSION_ID, existing_understanding: understanding })).status);

  const frame = await loadFixture("product-frame.yaml");
  expect((await service.designFrame({ design_session_id: SESSION_ID, product_frame: frame })).status).toBe("PASS");

  const context = await loadFixture("design-context.yaml");
  // live run also warned here: "usable with medium confidence".
  expect(["PASS", "WARN"]).toContain((await service.designContext({ design_session_id: SESSION_ID, design_context: context })).status);

  const routed = await service.designRoute({ design_session_id: SESSION_ID, question: ROUTE_QUESTION });
  expect(routed.status).toBe("PASS");
  const routedPatternIds = (routed.patterns as Array<{ id: string }>).map((pattern) => pattern.id);
  expect(routedPatternIds).toContain("PAT-CANVAS-WORKSPACE");
  expect(routedPatternIds).toContain("PAT-LIST-DETAIL-INSPECTOR");
  expect(routedPatternIds).toContain("PAT-WORKSPACE");

  expect(
    (
      await service.designInspect({
        design_session_id: SESSION_ID,
        ids: ["PAT-CANVAS-WORKSPACE", "PAT-LIST-DETAIL-INSPECTOR", "PAT-WORKSPACE"],
        depth: "L1",
        purpose: {
          kind: "compare_alternatives",
          target_ids: ["PAT-CANVAS-WORKSPACE", "PAT-LIST-DETAIL-INSPECTOR", "PAT-WORKSPACE"],
          question: "认知工作台的主结构：空间画布呈现架构关系 + 时间线与检视的组合，还是以面板为中心的 workspace？",
        },
      })
    ).status,
  ).toBe("PASS");

  const decisions = await loadFixture("design-decisions.yaml");
  const decided = await service.designDecide({
    design_session_id: SESSION_ID,
    design_decisions: { ...decisions, session_id: SESSION_ID },
  });
  expect(decided.status).toBe("PASS");

  const sdir = await service.designSdir({ design_session_id: SESSION_ID, mode: "generate_from_decisions" });
  expect(sdir.status).toBe("PASS");
  const fixtureSdir = await loadFixture("screen.sdir.yaml");
  expect(sdir.sdir).toEqual(fixtureSdir);
  expect(contentDigest(sdir.sdir)).toBe(contentDigest(fixtureSdir));

  const gaps = await loadFixture("capability-gaps.yaml");
  expect((await service.designReconcile({ design_session_id: SESSION_ID, capability_map: { needs: gaps.needs } })).status).toBe("PASS");

  const realizationDecision = await loadFixture("realization-decision.yaml");
  const proposed = await service.designRealize({
    design_session_id: SESSION_ID,
    mode: "propose",
    realization_mode: "direct_code",
    conditions: realizationDecision.conditions,
  });
  expect(proposed.status).toBe("PASS");

  const prepared = await service.designPrepareImplementation({
    design_session_id: SESSION_ID,
    platform: "web_desktop",
    framework: "react",
  });
  expect(prepared.status).toBe("PASS");
  const compiled = prepared.compiled_context as {
    representation_portfolio: { primary: { type: string }; supporting: Array<{ type: string }>; rejected: Array<{ option: string }> };
    state_ownership: Array<{ state: string; owner: string }>;
    acceptance: string[];
  };
  expect(compiled.representation_portfolio.primary.type).toBe("canvas");
  expect(compiled.representation_portfolio.supporting.map((entry) => entry.type)).toEqual(["timeline", "search_results", "feed", "chart"]);
  expect(compiled.representation_portfolio.rejected.map((entry) => entry.option)).toEqual(["dashboard", "table", "tabs"]);
  expect(compiled.state_ownership).toEqual([{ state: "selection", owner: "architecture" }, { state: "preview", owner: "session" }]);
  expect(compiled.acceptance.length).toBeGreaterThanOrEqual(1);

  const planned = await service.designValidate({ design_session_id: SESSION_ID, mode: "plan" });
  expect(planned.status).toBe("EXPAND");
  const checkIds = (planned.checks as Array<{ id: string }>).map((check) => check.id);
  expect(checkIds).toContain("complexity_budget_declared");
  expect(checkIds).toContain("state_ownership_declared");
  expect(checkIds).toContain("untouched_surface_regression");

  // spec §5.7 R3: a frozen receipt predates the freshly written gated
  // artifacts on replay, so a fresh receipt is attached as a new evidence
  // file without touching the golden digests (landing precedent).
  const receiptRef = await writeCognitionReceiptInto(sessionDir);
  const validationReport = await loadFixture("validation-report.yaml");
  const evidenceWithReceipt = {
    ...validationReport.evidence,
    items: (validationReport.evidence as { items: Array<Record<string, unknown>> }).items.map((item) =>
      item.check_id === "keyboard" || item.check_id === "untouched_surface_regression"
        ? { ...item, measurement_receipt: receiptRef }
        : item,
    ),
  };
  const submitted = await service.designValidate({
    design_session_id: SESSION_ID,
    mode: "submit_evidence",
    evidence: evidenceWithReceipt,
  });
  expect(submitted.status).toBe("PASS");

  const evaluated = await service.designValidate({ design_session_id: SESSION_ID, mode: "evaluate" });
  expect(evaluated.status).toBe("PASS");
  expect(evaluated.phase).toBe("COMPLETE");
  const findings = evaluated.findings as Array<{ check_id: string; outcome: string }>;
  expect(findings.length).toBe(checkIds.length);
  expect(findings.every((finding) => finding.outcome === "pass")).toBe(true);
  // Known advisory gap (see fixture README + corrections.yaml): the 0.2 SDIR
  // generator does not emit complexity_budget and no legal MCP path exists to
  // backfill it after the validate gate. The warning is part of the record.
  expect(evaluated.warnings).toEqual([
    "complexity_budget_declared: the 0.2 SDIR declares no complexity_budget block — new permanent surfaces, modes, and state owners stay uncounted (P-044).",
  ]);
});
