import { createHash } from "node:crypto";
import { z } from "zod";
import type { DesignContext, DesignSession, ExistingUnderstanding, IntentLite, ProductFrame } from "./contracts.js";

const NonEmpty = z.string().trim().min(1);

export const ContextCapabilityStatusSchema = z.enum(["required", "optional", "none"]);
export type ContextCapabilityStatus = z.infer<typeof ContextCapabilityStatusSchema>;

export const ContextManifestSchema = z.object({
  version: z.literal("0.1"),
  derived_from: z.object({
    session_revision: z.number().int().nonnegative(),
    mode: NonEmpty,
    change_kind: NonEmpty.optional(),
    artifact_digests: z.record(z.string(), NonEmpty),
  }),
  product_archetypes: z.array(NonEmpty).default([]),
  fidelity_profiles: z.array(NonEmpty).default([]),
  context_capabilities: z.object({
    relationships: ContextCapabilityStatusSchema,
    existing_behavior: ContextCapabilityStatusSchema,
    data_evidence: ContextCapabilityStatusSchema,
    computational_model: ContextCapabilityStatusSchema,
  }),
  validation_profiles: z.array(NonEmpty).default([]),
  unresolved: z.array(NonEmpty).default([]),
});
export type ContextManifest = z.infer<typeof ContextManifestSchema>;

export interface ManifestInputs {
  session: DesignSession;
  frame?: ProductFrame | undefined;
  understanding?: ExistingUnderstanding | undefined;
  context?: DesignContext | undefined;
  intentLite?: IntentLite | undefined;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

export function contentDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function manifestStale(manifest: ContextManifest, inputs: ManifestInputs): boolean {
  const current = deriveContextManifest(inputs);
  return manifest.derived_from.artifact_digests["__aggregate__"] !== current.derived_from.artifact_digests["__aggregate__"];
}

export function deriveContextManifest(inputs: ManifestInputs): ContextManifest {
  const { session, frame, understanding, context, intentLite } = inputs;

  const artifactDigests: Record<string, string> = {};
  if (frame !== undefined) artifactDigests.product_frame = contentDigest(frame);
  if (understanding !== undefined) artifactDigests.existing_understanding = contentDigest(understanding);
  if (context !== undefined) artifactDigests.design_context = contentDigest(context);
  if (intentLite !== undefined) artifactDigests.intent_lite = contentDigest(intentLite);
  artifactDigests.__aggregate__ = createHash("sha256")
    .update(JSON.stringify(Object.fromEntries(Object.entries(artifactDigests).sort(([a], [b]) => a.localeCompare(b)))))
    .digest("hex");

  const declaredRelationships =
    (frame?.relationships.length ?? 0) + (understanding?.current_relationships.length ?? 0);
  const relationshipComplexity = context?.information.relationship_complexity;

  let relationships: ContextCapabilityStatus;
  if (declaredRelationships > 0 || relationshipComplexity === "high") {
    relationships = "required";
  } else if (relationshipComplexity === "medium") {
    relationships = "optional";
  } else {
    relationships = "none";
  }

  const existingBehavior: ContextCapabilityStatus =
    session.mode === "existing_product" || session.mode === "rework" ? "required" : "none";

  const modes = context?.task.modes ?? (intentLite !== undefined ? ["modify"] : []);
  const destructive = context?.risk.destructive_actions;

  const fidelityProfiles = new Set<string>();
  if (relationships === "required" && (modes.includes("inspect") || modes.includes("trace") || modes.includes("modify"))) {
    fidelityProfiles.add("workspace_coherence");
  }
  if (destructive === "medium" || destructive === "high") {
    fidelityProfiles.add("behavioral_fidelity");
  }
  if (session.lifecycle_policy?.change_kind === "visual_polish") {
    fidelityProfiles.add("reference_visual_fidelity");
  }

  const validationProfiles = new Set<string>(["state_coverage"]);
  if (relationships !== "none") validationProfiles.add("relationship_integrity");
  if (frame !== undefined || context !== undefined) validationProfiles.add("semantic_integrity");
  if (session.lifecycle_policy?.change_kind === "visual_polish") validationProfiles.add("visual_snapshot");
  if (existingBehavior === "required") validationProfiles.add("runtime_degradation");

  const unresolved: string[] = [];
  if (relationshipComplexity === "unknown" && declaredRelationships === 0) {
    unresolved.push("relationship complexity is unknown; the relationships capability stays none until evidence exists");
  }
  for (const unknown of context?.unknowns ?? []) {
    unresolved.push(typeof unknown === "string" ? unknown : unknown.id);
  }

  const changeKind = session.lifecycle_policy?.change_kind;

  return ContextManifestSchema.parse({
    version: "0.1",
    derived_from: {
      session_revision: session.revision,
      mode: session.mode,
      ...(changeKind === undefined ? {} : { change_kind: changeKind }),
      artifact_digests: artifactDigests,
    },
    product_archetypes: context?.classification !== undefined ? [context.classification.product_type] : [],
    fidelity_profiles: [...fidelityProfiles],
    context_capabilities: {
      relationships,
      existing_behavior: existingBehavior,
      data_evidence: "none",
      computational_model: "none",
    },
    validation_profiles: [...validationProfiles],
    unresolved,
  });
}
