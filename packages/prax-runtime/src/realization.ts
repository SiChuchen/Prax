import { verifyEvidenceFile } from "./evidence-files.js";
export { verifyEvidenceFile } from "./evidence-files.js";
export type { EvidenceVerification } from "./evidence-files.js";
import {
  RealizationDecisionSchema,
  type DesignSession,
  type GateStatus,
  type LifecyclePolicyV2,
  type RealizationCondition,
  type RealizationDecision,
  type RealizationMode,
  type RepresentationArtifact,
  type RepresentationReviewEvidence,
  type RepresentationReviewRecord,
} from "./contracts.js";

export const REALIZATION_PREDICATE_VERSION = "1";

// Pluggable realization providers for the figma_first mode. The mode name is
// historical: it means "representation-first with stakeholder visual approval",
// not a Figma-only path. Every provider must offer the same capability triple —
// write_canvas (build frames named exactly after SDIR region ids), screenshot
// (per-region evidence under rep-evidence/round-N/), metadata (read back what
// was created so provider_refs can be reported) — because validateDraft and
// validateReview stay provider-agnostic (file_key + frames[{node_id,name,sdir_region}]).
export const REALIZATION_PROVIDERS = {
  figma: {
    id: "figma",
    contract_version: "remote-mcp-2026-08",
    capabilities: ["write_canvas", "screenshot", "metadata"],
  },
  penpot: {
    id: "penpot",
    contract_version: "official-mcp-2026-08",
    capabilities: ["write_canvas", "screenshot", "metadata"],
  },
  pen: {
    id: "pen",
    contract_version: "local-mcp-2026-08",
    capabilities: ["write_canvas", "screenshot", "metadata"],
  },
} as const;
export type RealizationProviderId = keyof typeof REALIZATION_PROVIDERS;

export const REALIZATION_CONDITION_IDS: Record<RealizationMode, readonly string[]> = {
  direct_code: ["defect_fix_fit", "visual_polish_fit", "small_modification", "mature_design_system"],
  figma_first: [
    "greenfield",
    "high_visual_uncertainty",
    "marketing_editorial",
    "stakeholder_visual_approval",
    "spatial_exploration_value",
    "runtime_dependency_low",
  ],
};

const FIGMA_FIRST_FIT_CONDITIONS = [
  "greenfield",
  "high_visual_uncertainty",
  "marketing_editorial",
  "stakeholder_visual_approval",
  "spatial_exploration_value",
] as const;

export interface RealizationValidation<T = undefined> {
  status: GateStatus;
  issues: string[];
  warnings: string[];
  codes?: string[];
  value?: T;
}

export interface ProposeInput {
  realization_mode: RealizationMode;
  provider?: string | undefined;
  conditions: RealizationCondition[];
  reason?: string | undefined;
  override?: boolean | undefined;
  override_reason?: string | undefined;
}

export function validatePropose(
  input: ProposeInput,
  session: Pick<DesignSession, "mode">,
  options: { now: string; priorDecision?: RealizationDecision | undefined },
): RealizationValidation<RealizationDecision> {
  const warnings: string[] = [];
  const codes: string[] = [];

  if (input.realization_mode === "figma_first") {
    const provider = input.provider as RealizationProviderId | undefined;
    if (provider === undefined || REALIZATION_PROVIDERS[provider] === undefined) {
      return {
        status: "BLOCK",
        issues: [`figma_first requires a registered provider (${Object.keys(REALIZATION_PROVIDERS).join(", ")}).`],
        warnings,
        codes: ["REALIZATION_MODE_INVALID"],
      };
    }
  }

  const expected = [...REALIZATION_CONDITION_IDS[input.realization_mode]].sort();
  const actual = input.conditions.map((condition) => condition.id).sort();
  const hasDuplicates = input.conditions.length !== new Set(input.conditions.map((c) => c.id)).size;
  if (hasDuplicates || actual.join() !== expected.join()) {
    return {
      status: "BLOCK",
      issues: [`conditions must exactly match the fixed condition set for ${input.realization_mode}: ${expected.join(", ")}.`],
      warnings,
      codes: ["REALIZATION_CONDITIONS_INCOMPLETE"],
    };
  }

  const issues: string[] = [];
  const emptyBasis = input.conditions.filter((condition) => condition.basis.trim().length === 0);
  if (emptyBasis.length > 0) {
    issues.push(`every condition needs a non-empty basis (missing: ${emptyBasis.map((c) => c.id).join(", ")}).`);
    codes.push("REALIZATION_BASIS_MISSING");
  }

  const holds = new Map(input.conditions.map((condition) => [condition.id, condition.holds]));
  if (input.realization_mode === "figma_first") {
    const fits = FIGMA_FIRST_FIT_CONDITIONS.filter((id) => holds.get(id) === true);
    const lowRuntime = holds.get("runtime_dependency_low") === true;
    if (!lowRuntime || fits.length === 0) {
      if (input.override === true && (input.override_reason ?? "").trim() !== "") {
        warnings.push("figma_first accepted via explicit override although the eligibility predicate is not satisfied; recorded on the decision.");
      } else {
        return {
          status: "REVIEW",
          issues: [
            "figma_first requires runtime_dependency_low plus at least one fit condition (greenfield, high_visual_uncertainty, marketing_editorial, stakeholder_visual_approval, spatial_exploration_value); recommend direct_code or re-propose with override plus override_reason.",
          ],
          warnings,
          codes: ["REALIZATION_MODE_MISMATCH"],
        };
      }
    }
    if (holds.get("greenfield") === true && session.mode !== "greenfield") {
      return {
        status: "REVIEW",
        issues: [`condition 'greenfield' holds=true but the session mode is '${session.mode}'; fix the declaration or use direct_code.`],
        warnings,
        codes: ["REALIZATION_CONDITION_MISMATCH"],
      };
    }
  }

  if (issues.length > 0) {
    return { status: "EXPAND", issues, warnings, codes };
  }

  const modeFlip =
    options.priorDecision !== undefined && options.priorDecision.realization_mode !== input.realization_mode;
  if (modeFlip && (input.reason ?? "").trim() === "") {
    return {
      status: "EXPAND",
      issues: ["changing the realization mode requires a reason explaining the switch."],
      warnings,
      codes: ["REALIZATION_BASIS_MISSING"],
    };
  }

  const provider = input.realization_mode === "figma_first" ? REALIZATION_PROVIDERS[input.provider as RealizationProviderId] : undefined;
  const value = RealizationDecisionSchema.parse({
    version: "0.1",
    realization_mode: input.realization_mode,
    ...(provider === undefined ? {} : { provider: provider.id, provider_contract_version: provider.contract_version }),
    conditions: input.conditions,
    proposed_at: options.now,
    ...(modeFlip
      ? { supersedes: { prior_mode: options.priorDecision!.realization_mode, reason: input.reason! } }
      : {}),
    overridden: input.override === true,
    ...(input.override_reason === undefined ? {} : { override_reason: input.override_reason }),
  });
  return { status: warnings.length > 0 ? "WARN" : "PASS", issues: [], warnings, codes: [], value };
}

export function validateDraft(
  refs: { file_key: string; frames: Array<{ node_id: string; name: string; sdir_region: string }> },
  artifact: RepresentationArtifact,
): RealizationValidation {
  const issues: string[] = [];
  const codes: string[] = [];
  const regions = new Set(artifact.semantic_refs.regions);
  const nodeIds = new Set<string>();
  for (const frame of refs.frames) {
    if (nodeIds.has(frame.node_id)) {
      issues.push(`duplicate frame node_id '${frame.node_id}'.`);
      codes.push("REALIZATION_DRAFT_INVALID");
    }
    nodeIds.add(frame.node_id);
    if (!regions.has(frame.sdir_region)) {
      issues.push(`frame '${frame.name}' maps to unknown sdir_region '${frame.sdir_region}'.`);
      codes.push("REALIZATION_DRAFT_INVALID");
    }
  }
  const missing = artifact.semantic_refs.regions.filter(
    (region) => !refs.frames.some((frame) => frame.sdir_region === region),
  );
  if (missing.length > 0) {
    issues.push(`sdir regions without any frame: ${missing.join(", ")}.`);
    codes.push("REALIZATION_COVERAGE_INCOMPLETE");
  }
  return issues.length === 0
    ? { status: "PASS", issues: [], warnings: [], codes: [] }
    : { status: "EXPAND", issues, warnings: [], codes };
}


export interface ReviewSubmissionInput {
  status: "approved" | "rejected";
  provider_refs_verified: { file_key: string; frame_node_ids: string[] };
  feedback?: { text: string; region_annotations?: Array<{ sdir_region: string; note: string }> } | undefined;
  evidence: Array<
    | { type: "screenshot"; ref: string }
    | { type: "human_decision"; actor_ref: string; source_type: string; source_ref: string; quote: string }
  >;
}

export async function validateReview(
  submission: ReviewSubmissionInput,
  artifact: RepresentationArtifact,
  options: { sessionDirectory: string; now: string; expectedRound?: number },
): Promise<RealizationValidation<RepresentationReviewRecord>> {
  const refs = artifact.realization.refs;
  if (refs === null) {
    return { status: "BLOCK", issues: ["the artifact carries no draft refs; submit_draft first."], warnings: [], codes: ["REALIZATION_WINDOW_INVALID"] };
  }
  const verifiedIds = [...submission.provider_refs_verified.frame_node_ids].sort();
  const artifactIds = refs.frames.map((frame) => frame.node_id).sort();
  if (submission.provider_refs_verified.file_key !== refs.file_key || verifiedIds.join() !== artifactIds.join()) {
    return {
      status: "RETRY",
      issues: ["provider_refs_verified must match the artifact refs exactly (same file_key and node id set)."],
      warnings: [],
      codes: ["REALIZATION_REVIEW_REFS_MISMATCH"],
    };
  }
  const issues: string[] = [];
  const codes: string[] = [];
  if (submission.status === "rejected" && (submission.feedback?.text ?? "").trim() === "") {
    issues.push("rejected reviews require feedback.text.");
    codes.push("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
  }
  const roundPrefix = `rep-evidence/round-${options.expectedRound ?? 1}/`;
  const evidence: RepresentationReviewEvidence[] = [];
  let screenshots = 0;
  let human = 0;
  for (const item of submission.evidence) {
    if (item.type === "screenshot") {
      if (!item.ref.startsWith(roundPrefix)) {
        issues.push(`screenshot evidence must come from the current review round directory (${roundPrefix}): ${item.ref}`);
        codes.push("REALIZATION_EVIDENCE_INVALID");
        continue;
      }
      const verified = await verifyEvidenceFile(options.sessionDirectory, item.ref);
      if (!verified.ok) {
        issues.push(verified.error);
        codes.push("REALIZATION_EVIDENCE_INVALID");
        continue;
      }
      evidence.push({ type: "screenshot", ref: item.ref, sha256: verified.sha256, collected_at: options.now });
      screenshots += 1;
    } else {
      if (
        item.actor_ref.trim() === "" ||
        item.source_type.trim() === "" ||
        item.source_ref.trim() === "" ||
        item.quote.trim() === ""
      ) {
        issues.push("human_decision evidence requires actor_ref, source_type, source_ref, and quote.");
        codes.push("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
        continue;
      }
      evidence.push({
        type: "human_decision",
        actor_type: "human",
        actor_ref: item.actor_ref,
        source_type: item.source_type,
        source_ref: item.source_ref,
        quote: item.quote,
        confirmed_at: options.now,
      });
      human += 1;
    }
  }
  if (submission.status === "approved" && (screenshots === 0 || human === 0)) {
    issues.push("approved reviews require at least one screenshot evidence and one human_decision evidence.");
    codes.push("REALIZATION_REVIEW_EVIDENCE_INCOMPLETE");
  }
  if (issues.length > 0) {
    return { status: "EXPAND", issues, warnings: [], codes };
  }
  const value: RepresentationReviewRecord = {
    round: 0,
    status: submission.status,
    provider_refs_verified: submission.provider_refs_verified,
    ...(submission.feedback === undefined
      ? {}
      : { feedback: { text: submission.feedback.text, region_annotations: submission.feedback.region_annotations ?? [] } }),
    evidence,
    decided_at: options.now,
    sdir_digest_at_review: artifact.semantic_refs.sdir_digest,
  };
  return { status: "PASS", issues: [], warnings: [], codes: [], value };
}

export function spliceRealizeGate(policy: LifecyclePolicyV2): LifecyclePolicyV2 {
  if (policy.gates.includes("realize")) return policy;
  const gates = [...policy.gates];
  const index = gates.indexOf("prepare");
  gates.splice(index === -1 ? gates.length : index, 0, "realize");
  return { ...policy, gates };
}

export function removeRealizeGate(policy: LifecyclePolicyV2): LifecyclePolicyV2 {
  return { ...policy, gates: policy.gates.filter((gate) => gate !== "realize") };
}
