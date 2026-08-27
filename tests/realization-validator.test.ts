import { describe, expect, it } from "vitest";
import { PraxValidator } from "prax-validator";
import type { RepresentationArtifact } from "prax-runtime";
import { architectureDecisions } from "./fixtures.js";

function artifact(overrides: Partial<RepresentationArtifact> = {}): RepresentationArtifact {
  return {
    version: "0.1",
    id: "rep-ds_x",
    representation: { role: "primary" },
    semantic_refs: { sdir_ref: "screen.sdir.yaml", sdir_digest: "digest-1", regions: ["hero", "cta"] },
    realization: {
      provider: "figma",
      provider_contract_version: "remote-mcp-2026-08",
      refs: {
        file_key: "fk",
        frames: [
          { node_id: "n1", name: "Hero", sdir_region: "hero" },
          { node_id: "n2", name: "CTA", sdir_region: "cta" },
        ],
      },
    },
    status: "approved",
    validation: ["design_representation_coverage", "representation_runtime_drift"],
    ...overrides,
  };
}

describe("representation checks in the plan", () => {
  const validator = new PraxValidator();

  it("appends both representation checks for figma_first full-SDIR sessions", () => {
    const plan = validator.plan({
      policyContext: { mode: "greenfield" },
      decisions: architectureDecisions("ds_x"),
      realizationMode: "figma_first",
    });
    const ids = plan.checks.map((check) => check.id);
    expect(ids).toContain("design_representation_coverage");
    expect(ids).toContain("representation_runtime_drift");
    const coverage = plan.checks.find((check) => check.id === "design_representation_coverage")!;
    expect(coverage).toMatchObject({ kind: "deterministic", evidence_required: false, profile: "representation_integrity" });
  });

  it("omits representation checks for direct_code and light paths", () => {
    const direct = new PraxValidator().plan({ policyContext: { mode: "greenfield" }, realizationMode: "direct_code" });
    expect(direct.checks.some((check) => check.id === "design_representation_coverage")).toBe(false);
    const light = new PraxValidator().plan({ policyContext: { mode: "existing_product", change_kind: "visual_polish" } });
    expect(light.checks.some((check) => check.id === "representation_runtime_drift")).toBe(false);
  });
});

describe("deterministic representation coverage evaluator (fail-closed)", () => {
  const validator = new PraxValidator();
  const approvedReview = {
    version: "0.1" as const,
    round: 1,
    status: "approved" as const,
    provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1", "n2"] },
    feedback: { text: "ok", region_annotations: [] },
    evidence: [{ type: "human_decision" as const, actor_type: "human" as const, actor_ref: "u", source_type: "conversation", source_ref: "m", quote: "ok", confirmed_at: "2026-08-28T00:00:00.000Z" }],
    decided_at: "2026-08-28T00:00:00.000Z",
    sdir_digest_at_review: "digest-1",
    history: [],
  };

  function evaluateWith(art: RepresentationArtifact | undefined, sdirDigest: string | undefined, review: unknown = approvedReview) {
    const plan = validator.plan({ policyContext: { mode: "greenfield" }, realizationMode: "figma_first" });
    return validator.evaluate({ plan, representationArtifact: art, representationReview: review as never, sdirDigest });
  }

  it("fails closed when the artifact is missing, unapproved, unreviewed, drifted, or uncovered", () => {
    expect(evaluateWith(undefined, "digest-1").status).toBe("BLOCK");
    expect(evaluateWith(artifact({ status: "revision_requested" }), "digest-1").status).toBe("BLOCK");
    expect(evaluateWith(artifact(), "digest-1", undefined).status).toBe("BLOCK");
    expect(evaluateWith(artifact(), undefined).status).toBe("BLOCK");
    expect(evaluateWith(artifact(), "different-digest").status).toBe("BLOCK");
    expect(
      evaluateWith(
        artifact({
          realization: {
            provider: "figma",
            provider_contract_version: "remote-mcp-2026-08",
            refs: { file_key: "fk", frames: [{ node_id: "n1", name: "Hero", sdir_region: "hero" }] },
          },
        }),
        "digest-1",
      ).status,
    ).toBe("BLOCK");
  });

  it("produces a finding for every deterministic check in the plan (no silent passes)", () => {
    const plan = validator.plan({ policyContext: { mode: "greenfield" }, realizationMode: "figma_first", decisions: architectureDecisions("ds_x") });
    const evaluation = validator.evaluate({ plan, representationArtifact: artifact(), representationReview: approvedReview, sdirDigest: "digest-1" });
    const deterministicIds = plan.checks.filter((check) => check.kind === "deterministic").map((check) => check.id);
    const findingIds = evaluation.findings.filter((finding) => finding.kind === "deterministic").map((finding) => finding.check_id);
    expect(deterministicIds.every((id) => findingIds.includes(id))).toBe(true);
  });

  it("passes when approved and fully covered, and the drift check demands two artifact_refs", () => {
    const evaluation = evaluateWith(artifact(), "digest-1");
    const coverage = evaluation.findings.find((finding) => finding.check_id === "design_representation_coverage");
    expect(coverage).toMatchObject({ kind: "deterministic", outcome: "pass" });

    const drift = evaluation.missing_evidence;
    expect(drift).toContain("representation_runtime_drift");
    const withDriftOneRef = validator.evaluate({
      plan: validator.plan({ policyContext: { mode: "greenfield" }, realizationMode: "figma_first" }),
      representationArtifact: artifact(),
      representationReview: approvedReview,
      sdirDigest: "digest-1",
      evidence: {
        submitted_by: "agent",
        collected_at: "2026-08-28T00:00:00.000Z",
        items: [{ check_id: "representation_runtime_drift", outcome: "pass", source: "visual diff", notes: "match", artifact_refs: ["only-one.png"] }],
      },
    });
    expect(withDriftOneRef.missing_evidence).toContain("representation_runtime_drift");
    expect(withDriftOneRef.findings.find((finding) => finding.check_id === "representation_runtime_drift")?.outcome).toBe("inconclusive");
  });
});
