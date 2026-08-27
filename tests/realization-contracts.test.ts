import { describe, expect, it } from "vitest";
import {
  ARTIFACT_FILES,
  DesignSessionSchema,
  LifecyclePolicySchema,
  RealizationDecisionSchema,
  RepresentationArtifactSchema,
  RepresentationReviewSchema,
} from "prax-runtime";

describe("realization contracts", () => {
  it("accepts lifecycle policy v1 and v2 sessions", () => {
    const v1 = { version: "1", mode: "greenfield", gates: ["confirm", "framing", "context"] };
    const v2 = { version: "2", mode: "greenfield", gates: ["confirm", "framing", "context", "route", "decide", "sdir", "realize", "prepare", "validate"] };
    expect(LifecyclePolicySchema.parse(v1).version).toBe("1");
    expect(LifecyclePolicySchema.parse(v2).version).toBe("2");
    expect(LifecyclePolicySchema.safeParse({ version: "3", mode: "greenfield", gates: ["confirm"] }).success).toBe(false);
    const session = {
      id: "ds_x", project_root: "/tmp/p", mode: "greenfield", phase: "REALIZATION",
      created_at: "2026-08-28T00:00:00.000Z", updated_at: "2026-08-28T00:00:00.000Z",
      revision: 1, requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "realize" },
      artifacts: {}, lifecycle_policy: v2,
    };
    expect(DesignSessionSchema.safeParse(session).success).toBe(true);
  });

  it("registers the three realization artifact files", () => {
    expect(ARTIFACT_FILES.realizationDecision).toBe("realization-decision.yaml");
    expect(ARTIFACT_FILES.representationArtifact).toBe("representation-artifact.yaml");
    expect(ARTIFACT_FILES.representationReview).toBe("representation-review.yaml");
  });

  it("round-trips a realization decision", () => {
    const decision = RealizationDecisionSchema.parse({
      version: "0.1",
      realization_mode: "figma_first",
      provider: "figma",
      provider_contract_version: "remote-mcp-2026-08",
      conditions: [{ id: "greenfield", holds: true, basis: "session mode is greenfield" }],
      proposed_at: "2026-08-28T00:00:00.000Z",
      supersedes: { prior_mode: "direct_code", reason: "stakeholder wants visual approval" },
    });
    expect(decision.conditions).toHaveLength(1);
    expect(RealizationDecisionSchema.safeParse({ version: "0.1", realization_mode: "figma_first", conditions: [], proposed_at: "2026-08-28T00:00:00.000Z" }).success).toBe(false);
  });

  it("round-trips a representation artifact and review with history", () => {
    const artifact = RepresentationArtifactSchema.parse({
      version: "0.1",
      id: "rep-ds_x",
      representation: { role: "primary" },
      semantic_refs: { sdir_ref: "screen.sdir.yaml", sdir_digest: "abc", regions: ["hero"] },
      realization: { provider: "figma", provider_contract_version: "remote-mcp-2026-08", refs: null },
      status: "pending_generation",
      validation: ["design_representation_coverage"],
    });
    expect(artifact.realization.refs).toBeNull();
    const review = RepresentationReviewSchema.parse({
      version: "0.1",
      round: 1,
      status: "rejected",
      provider_refs_verified: { file_key: "fk", frame_node_ids: ["n1"] },
      feedback: { text: "hero too weak", region_annotations: [{ sdir_region: "hero", note: "contrast" }] },
      evidence: [{ type: "human_decision", actor_type: "human", actor_ref: "user:x", source_type: "conversation", source_ref: "msg-1", quote: "redo", confirmed_at: "2026-08-28T00:00:00.000Z" }],
      decided_at: "2026-08-28T00:00:00.000Z",
      sdir_digest_at_review: "abc",
      history: [],
    });
    expect(review.round).toBe(1);
  });
});
