import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  REALIZATION_PROVIDERS,
  removeRealizeGate,
  spliceRealizeGate,
  validateDraft,
  validatePropose,
  validateReview,
  verifyEvidenceFile,
  type LifecyclePolicyV2,
  type RealizationCondition,
  type RepresentationArtifact,
} from "prax-runtime";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function figmaFirstConditions(holds: Partial<Record<string, boolean>> = {}): RealizationCondition[] {
  const all: Array<[string, string]> = [
    ["greenfield", "session mode is greenfield"],
    ["high_visual_uncertainty", "brand hero has no settled visual language"],
    ["marketing_editorial", "product landing page"],
    ["stakeholder_visual_approval", "product owner approves visuals in Figma"],
    ["spatial_exploration_value", "layout exploration precedes code"],
    ["runtime_dependency_low", "static marketing page"],
  ];
  return all.map(([id, basis]) => ({ id, holds: holds[id] ?? true, basis }));
}

function directCodeConditions(): RealizationCondition[] {
  return [
    { id: "defect_fix_fit", holds: false, basis: "not a defect fix" },
    { id: "visual_polish_fit", holds: false, basis: "not a polish pass" },
    { id: "small_modification", holds: false, basis: "full greenfield surface" },
    { id: "mature_design_system", holds: false, basis: "no design system yet" },
  ];
}

const NOW = "2026-08-28T00:00:00.000Z";

describe("validatePropose", () => {
  it("passes a fit figma_first proposal and stamps provider contract version", () => {
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions: figmaFirstConditions() },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("PASS");
    expect(result.value?.provider_contract_version).toBe(REALIZATION_PROVIDERS.figma.contract_version);
  });

  it("blocks figma_first without a registered provider", () => {
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "sketch", conditions: figmaFirstConditions() },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("REALIZATION_MODE_INVALID");
  });

  it("blocks a condition set that is not the exact fixed set", () => {
    const conditions = figmaFirstConditions().slice(0, 3);
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("BLOCK");
    expect(result.codes).toContain("REALIZATION_CONDITIONS_INCOMPLETE");
    const duplicated = [...figmaFirstConditions(), figmaFirstConditions()[0]!];
    expect(
      validatePropose({ realization_mode: "figma_first", provider: "figma", conditions: duplicated }, { mode: "greenfield" }, { now: NOW }).status,
    ).toBe("BLOCK");
  });

  it("expands when a basis is blank", () => {
    const conditions = figmaFirstConditions();
    conditions[1] = { ...conditions[1]!, basis: "   " };
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("REALIZATION_BASIS_MISSING");
  });

  it("reviews figma_first that fails the eligibility predicate, recommending direct_code", () => {
    const result = validatePropose(
      {
        realization_mode: "figma_first",
        provider: "figma",
        conditions: figmaFirstConditions({
          runtime_dependency_low: false,
          high_visual_uncertainty: false,
          marketing_editorial: false,
          stakeholder_visual_approval: false,
          spatial_exploration_value: false,
        }),
      },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("REALIZATION_MODE_MISMATCH");
  });

  it("accepts an unsatisfied predicate only via explicit override, recorded on the decision", () => {
    const conditions = figmaFirstConditions({ runtime_dependency_low: false });
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions, override: true, override_reason: "stakeholder insists on Figma review" },
      { mode: "greenfield" },
      { now: NOW },
    );
    expect(result.status).toBe("WARN");
    expect(result.value?.overridden).toBe(true);
  });

  it("reviews a greenfield declaration that contradicts the session mode", () => {
    const result = validatePropose(
      { realization_mode: "figma_first", provider: "figma", conditions: figmaFirstConditions() },
      { mode: "rework" },
      { now: NOW },
    );
    expect(result.status).toBe("REVIEW");
    expect(result.codes).toContain("REALIZATION_CONDITION_MISMATCH");
  });

  it("requires a reason when re-proposing flips the mode", () => {
    const prior = { version: "0.1" as const, realization_mode: "figma_first" as const, conditions: figmaFirstConditions(), proposed_at: NOW };
    const result = validatePropose(
      { realization_mode: "direct_code", conditions: directCodeConditions() },
      { mode: "greenfield" },
      { now: NOW, priorDecision: prior },
    );
    expect(result.status).toBe("EXPAND");
    const withReason = validatePropose(
      { realization_mode: "direct_code", conditions: directCodeConditions(), reason: "figma seat unavailable" },
      { mode: "greenfield" },
      { now: NOW, priorDecision: prior },
    );
    expect(withReason.status).toBe("PASS");
    expect(withReason.value?.supersedes).toMatchObject({ prior_mode: "figma_first", reason: "figma seat unavailable" });
  });
});

function artifactFor(status: RepresentationArtifact["status"], refs: RepresentationArtifact["realization"]["refs"]): RepresentationArtifact {
  return {
    version: "0.1",
    id: "rep-ds_x",
    representation: { role: "primary" },
    semantic_refs: { sdir_ref: "screen.sdir.yaml", sdir_digest: "digest-1", regions: ["hero", "features", "cta"] },
    realization: { provider: "figma", provider_contract_version: "remote-mcp-2026-08", refs },
    status,
    validation: ["design_representation_coverage", "representation_runtime_drift"],
  };
}

describe("validateDraft", () => {
  it("expands when an sdir region has no frame and flags unknown regions and duplicate node ids", () => {
    const artifact = artifactFor("pending_generation", null);
    const partial = validateDraft({ file_key: "fk", frames: [{ node_id: "n1", name: "Hero", sdir_region: "hero" }] }, artifact);
    expect(partial.status).toBe("EXPAND");
    expect(partial.issues.join(" ")).toMatch(/features, cta/);
    const bad = validateDraft(
      {
        file_key: "fk",
        frames: [
          { node_id: "n1", name: "A", sdir_region: "hero" },
          { node_id: "n1", name: "B", sdir_region: "nonexistent" },
        ],
      },
      artifact,
    );
    expect(bad.status).toBe("EXPAND");
    expect(bad.codes).toContain("REALIZATION_DRAFT_INVALID");
  });

  it("passes full coverage", () => {
    const artifact = artifactFor("pending_generation", null);
    const result = validateDraft(
      {
        file_key: "fk",
        frames: [
          { node_id: "n1", name: "Hero", sdir_region: "hero" },
          { node_id: "n2", name: "Features", sdir_region: "features" },
          { node_id: "n3", name: "CTA", sdir_region: "cta" },
        ],
      },
      artifact,
    );
    expect(result.status).toBe("PASS");
  });
});

describe("verifyEvidenceFile", () => {
  it("verifies a real file and returns its sha256", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-rev-"));
    cleanup.push(root);
    await mkdir(join(root, "rep-evidence", "round-1"), { recursive: true });
    await writeFile(join(root, "rep-evidence", "round-1", "frame-hero.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await verifyEvidenceFile(root, "rep-evidence/round-1/frame-hero.png");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sha256).toHaveLength(64);
  });

  it("rejects traversal, wrong prefix, missing files, and symlink escapes", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-rev-"));
    cleanup.push(root);
    await mkdir(join(root, "rep-evidence", "round-1"), { recursive: true });
    await writeFile(join(root, "rep-evidence", "round-1", "a.png"), "x");
    await mkdir(join(root, "outside"), { recursive: true });
    await writeFile(join(root, "outside", "secret.png"), "x");
    expect((await verifyEvidenceFile(root, "../outside/secret.png")).ok).toBe(false);
    expect((await verifyEvidenceFile(root, "evidence/round-1/a.png")).ok).toBe(false);
    expect((await verifyEvidenceFile(root, "rep-evidence/round-1/missing.png")).ok).toBe(false);
    try {
      await symlink(join(root, "outside", "secret.png"), join(root, "rep-evidence", "round-1", "link.png"));
      expect((await verifyEvidenceFile(root, "rep-evidence/round-1/link.png")).ok).toBe(false);
    } catch {
      // Windows without symlink privilege: containment is still covered by the checks above.
    }
  });
});

describe("validateReview", () => {
  const approvedRefs = {
    file_key: "fk",
    frames: [
      { node_id: "n1", name: "Hero", sdir_region: "hero" },
      { node_id: "n2", name: "Features", sdir_region: "features" },
      { node_id: "n3", name: "CTA", sdir_region: "cta" },
    ],
  };

  async function withEvidenceRoot(run: (root: string) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), "prax-rev-"));
    cleanup.push(root);
    await mkdir(join(root, "rep-evidence", "round-1"), { recursive: true });
    await writeFile(join(root, "rep-evidence", "round-1", "hero.png"), Buffer.from([0x89, 0x50]));
    await run(root);
  }

  it("retries when provider_refs_verified does not match the artifact refs", async () => {
    await withEvidenceRoot(async (root) => {
      const artifact = artifactFor("under_review", approvedRefs);
      const result = await validateReview(
        {
          status: "approved",
          provider_refs_verified: { file_key: "other", frame_node_ids: ["n1"] },
          evidence: [{ type: "human_decision", actor_ref: "user:x", source_type: "conversation", source_ref: "m1", quote: "ok" }],
        },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(result.status).toBe("RETRY");
      expect(result.codes).toContain("REALIZATION_REVIEW_REFS_MISMATCH");
    });
  });

  it("expands when rejected without feedback or approved without both evidence kinds", async () => {
    await withEvidenceRoot(async (root) => {
      const artifact = artifactFor("under_review", approvedRefs);
      const rejectedNoFeedback = await validateReview(
        { status: "rejected", provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2", "n3"] }, evidence: [{ type: "human_decision", actor_ref: "u", source_type: "conversation", source_ref: "m", quote: "no" }] },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(rejectedNoFeedback.status).toBe("EXPAND");
      const approvedNoScreenshot = await validateReview(
        {
          status: "approved",
          provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2", "n3"] },
          feedback: { text: "ok" },
          evidence: [{ type: "human_decision", actor_ref: "u", source_type: "conversation", source_ref: "m", quote: "approved" }],
        },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(approvedNoScreenshot.status).toBe("EXPAND");
      expect(approvedNoScreenshot.codes).toContain("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
    });
  });

  it("rejects screenshots from a stale round directory", async () => {
    await withEvidenceRoot(async (root) => {
      await mkdir(join(root, "rep-evidence", "round-2"), { recursive: true });
      await writeFile(join(root, "rep-evidence", "round-2", "stale.png"), Buffer.from([0x89, 0x50]));
      const artifact = artifactFor("under_review", approvedRefs);
      const result = await validateReview(
        {
          status: "approved",
          provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2", "n3"] },
          evidence: [
            { type: "screenshot", ref: "rep-evidence/round-2/stale.png" },
            { type: "human_decision", actor_ref: "u", source_type: "conversation", source_ref: "m", quote: "approved" },
          ],
        },
        artifact,
        { sessionDirectory: root, now: NOW, expectedRound: 1 },
      );
      expect(result.status).toBe("EXPAND");
      expect(result.codes).toContain("REALIZATION_EVIDENCE_INVALID");
    });
  });

  it("computes screenshot sha256 server-side and builds an approved record", async () => {
    await withEvidenceRoot(async (root) => {
      const artifact = artifactFor("under_review", approvedRefs);
      const result = await validateReview(
        {
          status: "approved",
          provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2", "n3"] },
          feedback: { text: "approved after hero fix" },
          evidence: [
            { type: "screenshot", ref: "rep-evidence/round-1/hero.png" },
            { type: "human_decision", actor_ref: "user:x", source_type: "conversation", source_ref: "m1", quote: "approved" },
          ],
        },
        artifact,
        { sessionDirectory: root, now: NOW },
      );
      expect(result.status).toBe("PASS");
      const record = result.value!;
      expect(record.status).toBe("approved");
      expect(record.evidence[0]).toMatchObject({ type: "screenshot", sha256: expect.any(String) });
      expect(record.sdir_digest_at_review).toBe("digest-1");
    });
  });
});

describe("gate splice helpers", () => {
  const policy: LifecyclePolicyV2 = {
    version: "2",
    mode: "greenfield",
    gates: ["confirm", "framing", "context", "route", "decide", "sdir", "reconcile", "prepare", "validate"],
  };

  it("splices realize before prepare and removes it again", () => {
    const spliced = spliceRealizeGate(policy);
    expect(spliced.gates.indexOf("realize")).toBe(spliced.gates.indexOf("prepare") - 1);
    expect(spliceRealizeGate(spliced).gates).toEqual(spliced.gates);
    expect(removeRealizeGate(spliced).gates).toEqual(policy.gates);
  });
});
