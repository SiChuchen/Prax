import { z } from "zod";
import { JTBD_VERBS, OBJECT_TYPES } from "prax-sdir";

export const PRAX_VERSION = "0.1.0";

export const GateStatusSchema = z.enum([
  "PASS",
  "EXPAND",
  "RETRY",
  "WARN",
  "REVIEW",
  "BLOCK",
]);
export type GateStatus = z.infer<typeof GateStatusSchema>;

export const DesignPhaseSchema = z.enum([
  "NEW",
  "REQUIREMENT_CONFIRMATION",
  "UNDERSTANDING",
  "INTENT_LITE",
  "PRODUCT_FRAMING",
  "CONTEXT",
  "ROUTING",
  "DECISION",
  "SDIR",
  "CAPABILITY_RECONCILIATION",
  "REALIZATION",
  "IMPLEMENTATION_READY",
  "VALIDATION",
  "COMPLETE",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "ABANDONED",
]);
export type DesignPhase = z.infer<typeof DesignPhaseSchema>;

export const DesignModeSchema = z.enum(["greenfield", "existing_product", "rework"]);
export type DesignMode = z.infer<typeof DesignModeSchema>;

export const ChangeKindSchema = z.enum(["add_surface", "modify_surface", "visual_polish", "defect_fix"]);
export type ChangeKind = z.infer<typeof ChangeKindSchema>;

export const GateNameSchema = z.enum([
  "confirm",
  "understanding",
  "framing",
  "intent_lite",
  "context",
  "route",
  "decide",
  "sdir",
  "sdir_delta",
  "reconcile",
  "realize",
  "prepare",
  "validate",
]);
export type GateName = z.infer<typeof GateNameSchema>;

const LifecyclePolicyV1Schema = z.object({
  version: z.literal("1"),
  mode: DesignModeSchema,
  change_kind: ChangeKindSchema.optional(),
  gates: z.array(GateNameSchema).min(1),
});

export const LifecyclePolicyV2Schema = z.object({
  version: z.literal("2"),
  mode: DesignModeSchema,
  change_kind: ChangeKindSchema.optional(),
  gates: z.array(GateNameSchema).min(1),
});
export type LifecyclePolicyV2 = z.infer<typeof LifecyclePolicyV2Schema>;

export const LifecyclePolicySchema = z.discriminatedUnion("version", [LifecyclePolicyV1Schema, LifecyclePolicyV2Schema]);
export type LifecyclePolicy = z.infer<typeof LifecyclePolicySchema>;

export const DisclosureDepthSchema = z.enum(["L0", "L1", "L2", "L3"]);
export type DisclosureDepth = z.infer<typeof DisclosureDepthSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const NonEmptyStringSchema = z.string().trim().min(1);

export const ProductObjectOverrideSchema = z.object({
  override_type: z.literal("backend_object_is_product_object"),
  rationale: NonEmptyStringSchema,
  user_evidence: z.array(NonEmptyStringSchema).min(1),
  risks: z.array(NonEmptyStringSchema).min(1),
  accepted_by: z.enum(["agent", "human"]),
});
export type ProductObjectOverride = z.infer<typeof ProductObjectOverrideSchema>;

export const RelationshipDirectionSchema = z.enum(["forward", "bidirectional", "none"]);
export type RelationshipDirection = z.infer<typeof RelationshipDirectionSchema>;

export const RelationshipImportanceSchema = z.enum(["primary", "supporting"]);
export type RelationshipImportance = z.infer<typeof RelationshipImportanceSchema>;

export const ProductRelationshipSchema = z.object({
  id: NonEmptyStringSchema.optional(),
  source: NonEmptyStringSchema,
  target: NonEmptyStringSchema,
  type: NonEmptyStringSchema,
  direction: RelationshipDirectionSchema.optional(),
  meaning: NonEmptyStringSchema.optional(),
  condition: NonEmptyStringSchema.optional(),
  importance: RelationshipImportanceSchema.optional(),
});
export type ProductRelationship = z.infer<typeof ProductRelationshipSchema>;

const FrameJtbdSchema = z.object({
  verb: z.enum(JTBD_VERBS),
  target: NonEmptyStringSchema,
  success: NonEmptyStringSchema,
});

const FramePrimaryObjectSchema = z.object({
  type: z.enum(OBJECT_TYPES),
  label: NonEmptyStringSchema.optional(),
});

const FrameTaskModelSchema = z.object({
  frequency: z.enum(["low", "medium", "high"]),
  reversibility: z.enum(["reversible", "costly", "irreversible"]),
  consequence: z.enum(["low", "medium", "high"]),
  expertise: z.enum(["novice", "mixed", "expert"]),
});

export const ProductFrameSchema = z.object({
  version: z.literal("0.2").optional(),
  jtbd: FrameJtbdSchema.optional(),
  primary_object: FramePrimaryObjectSchema.optional(),
  task_model: FrameTaskModelSchema.optional(),
  user: z.object({
    primary_role: NonEmptyStringSchema,
    expertise: z.enum(["novice", "intermediate", "expert", "mixed"]),
    familiarity: z.enum(["low", "medium", "high", "unknown"]),
  }),
  goal: z.object({
    primary: NonEmptyStringSchema,
  }),
  tasks: z.object({
    primary: NonEmptyStringSchema,
    secondary: z.array(NonEmptyStringSchema).default([]),
  }),
  product_objects: z
    .array(
      z.object({
        id: NonEmptyStringSchema,
        user_name: NonEmptyStringSchema,
        purpose: NonEmptyStringSchema,
        justified_override: ProductObjectOverrideSchema.optional(),
      }),
    )
    .min(1),
  relationships: z.array(ProductRelationshipSchema).default([]),
  mental_model_hypothesis: z.object({
    summary: NonEmptyStringSchema,
    confidence: ConfidenceSchema,
    evidence: z
      .array(
        z.enum(["user_requirement", "existing_product", "domain_convention"]),
      )
      .default([]),
  }),
  primary_success_definition: NonEmptyStringSchema,
  open_questions: z.array(NonEmptyStringSchema).default([]),
  existing_product: z
    .object({
      stable_user_concepts: z.array(NonEmptyStringSchema).default([]),
      stable_patterns: z.array(NonEmptyStringSchema).default([]),
      current_user_pain_points: z.array(NonEmptyStringSchema).default([]),
      current_constraints: z.array(NonEmptyStringSchema).default([]),
      legacy_debt: z.array(NonEmptyStringSchema).default([]),
    })
    .optional(),
}).superRefine((frame, ctx) => {
  if (frame.version !== "0.2" && (frame.jtbd !== undefined || frame.primary_object !== undefined || frame.task_model !== undefined)) {
    ctx.addIssue({
      code: "custom",
      message: "0.2 product-model blocks (jtbd / primary_object / task_model) require an explicit version: '0.2'",
    });
  }
});
export type ProductFrame = z.infer<typeof ProductFrameSchema>;

export const MaterialUnknownSchema = z.union([
  NonEmptyStringSchema,
  z.object({
    id: NonEmptyStringSchema,
    impact: z.enum(["low", "medium", "high"]),
    affects: z.array(NonEmptyStringSchema).default([]),
  }),
]);
export type MaterialUnknown = z.infer<typeof MaterialUnknownSchema>;

export const ConfirmationEvidenceSchema = z.object({
  type: z.enum(["conversation_message", "task_brief", "user_document"]),
  ref: NonEmptyStringSchema,
});
export type ConfirmationEvidence = z.infer<typeof ConfirmationEvidenceSchema>;

const ConfirmedEvidenceList = z.array(ConfirmationEvidenceSchema).min(1);

export const RequirementConfirmationSchema = z.object({
  version: z.literal("0.1"),
  user_quote: z.array(NonEmptyStringSchema).min(1),
  restatement: NonEmptyStringSchema,
  boundaries: z.object({
    in_scope: z.array(NonEmptyStringSchema).min(1),
    out_of_scope: z.array(NonEmptyStringSchema),
    scope_complete: z.boolean().default(false),
  }),
  open_questions: z.array(MaterialUnknownSchema).default([]),
  confirmation: z.discriminatedUnion("status", [
    z.object({
      status: z.literal("explicit_user_confirmation"),
      evidence: ConfirmedEvidenceList,
      confirmed_at: z.string().datetime(),
    }),
    z.object({
      status: z.literal("requirement_is_sufficient"),
      evidence: ConfirmedEvidenceList,
      confirmed_at: z.string().datetime(),
    }),
    z.object({
      status: z.literal("pending_user_confirmation"),
      requested_at: z.string().datetime(),
    }),
  ]),
});
export type RequirementConfirmation = z.infer<typeof RequirementConfirmationSchema>;

export const CurrentRelationshipSchema = z.object({
  id: NonEmptyStringSchema.optional(),
  source: NonEmptyStringSchema,
  target: NonEmptyStringSchema,
  type: NonEmptyStringSchema,
  direction: RelationshipDirectionSchema.optional(),
  meaning: NonEmptyStringSchema.optional(),
  condition: NonEmptyStringSchema.optional(),
  importance: RelationshipImportanceSchema.optional(),
  evidence_refs: z.array(NonEmptyStringSchema).default([]),
});
export type CurrentRelationship = z.infer<typeof CurrentRelationshipSchema>;

export const ExistingUnderstandingSchema = z.object({
  version: z.literal("0.1"),
  current_objects: z
    .array(
      z.object({
        id: NonEmptyStringSchema,
        user_name: NonEmptyStringSchema,
        purpose: NonEmptyStringSchema,
        evidence_refs: z.array(NonEmptyStringSchema).default([]),
      }),
    )
    .default([]),
  current_relationships: z.array(CurrentRelationshipSchema).default([]),
  current_surfaces: z
    .array(
      z.object({
        id: NonEmptyStringSchema,
        purpose: NonEmptyStringSchema,
        evidence_refs: z.array(NonEmptyStringSchema).default([]),
      }),
    )
    .default([]),
  established_patterns: z.array(NonEmptyStringSchema).default([]),
  user_habits: z.array(NonEmptyStringSchema).default([]),
  constraints_and_debt: z.array(NonEmptyStringSchema).default([]),
  change_targets: z.array(NonEmptyStringSchema).default([]),
  actual_usage: z.array(NonEmptyStringSchema).default([]),
  pain_points: z.array(NonEmptyStringSchema).default([]),
  must_preserve: z.array(NonEmptyStringSchema).default([]),
  must_replace: z.array(NonEmptyStringSchema).default([]),
  free_to_reconsider: z.array(NonEmptyStringSchema).default([]),
  migration_notes: z.array(NonEmptyStringSchema).default([]),
  design_authorities: z.array(NonEmptyStringSchema).default([]),
  surface_context: z
    .object({
      density: z.enum(["compact", "regular", "spacious"]),
      user_expertise: z.enum(["novice", "intermediate", "expert", "mixed"]),
      destructive_actions: z.enum(["none", "low", "medium", "high"]),
      task_frequency: z.enum(["low", "medium", "high"]),
    })
    .optional(),
});
export type ExistingUnderstanding = z.infer<typeof ExistingUnderstandingSchema>;
export type ExistingUnderstandingInput = z.input<typeof ExistingUnderstandingSchema>;

export const IntentImpactSchema = z.object({
  changes_product_objects: z.boolean().default(false),
  changes_region_structure: z.boolean().default(false),
  changes_interaction_model: z.boolean().default(false),
  changes_state_model: z.boolean().default(false),
  adds_capability: z.boolean().default(false),
});

export const IntentLiteSchema = z.object({
  version: z.literal("0.1"),
  kind: z.enum(["visual_polish", "defect_fix"]),
  surfaces: z.array(NonEmptyStringSchema).min(1),
  current_hierarchy_summary: NonEmptyStringSchema,
  change: NonEmptyStringSchema,
  basis: NonEmptyStringSchema,
  evidence_refs: z.array(NonEmptyStringSchema).min(1),
  regression_points: z.array(NonEmptyStringSchema).min(1),
  impact: IntentImpactSchema,
});
export type IntentLite = z.infer<typeof IntentLiteSchema>;

export const CanonicalClassificationSchema = z.object({
  version: z.literal("1"),
  task_type: NonEmptyStringSchema,
  domain_id: NonEmptyStringSchema,
  interaction_mode: NonEmptyStringSchema,
  product_type: NonEmptyStringSchema,
  primary_object_type: NonEmptyStringSchema,
  secondary_object_types: z.array(NonEmptyStringSchema).default([]),
  confidence: ConfidenceSchema,
  evidence: z.array(NonEmptyStringSchema).default([]),
  open_questions: z.array(NonEmptyStringSchema).default([]),
});
export type CanonicalClassification = z.infer<typeof CanonicalClassificationSchema>;

export const DesignContextSchema = z.object({
  id: NonEmptyStringSchema.optional(),
  user: z.object({
    expertise: z.enum(["novice", "intermediate", "expert", "mixed"]),
    familiarity: z.enum(["low", "medium", "high", "unknown"]),
  }),
  task: z.object({
    primary: NonEmptyStringSchema,
    modes: z.array(NonEmptyStringSchema).min(1),
    frequency: z.enum(["low", "medium", "high", "unknown"]),
  }),
  domain: z.object({
    type: NonEmptyStringSchema,
    entities: z.array(NonEmptyStringSchema).min(1),
  }),
  information: z.object({
    volume: z.enum(["low", "medium", "high", "unknown"]),
    relationship_complexity: z.enum(["low", "medium", "high", "unknown"]),
    change_rate: z.enum(["low", "medium", "high", "unknown"]),
    comparison_need: z.enum(["low", "medium", "high", "unknown"]),
  }),
  platform: z.object({
    family: z.enum(["web"]),
    form_factor: z.enum(["desktop"]),
    input: z.array(z.enum(["pointer", "keyboard"])).min(1),
    viewport: z.enum(["large"]),
  }),
  risk: z.object({
    destructive_actions: z.enum(["none", "low", "medium", "high"]),
    error_cost: z.enum(["low", "medium", "high"]),
  }),
  priorities: z.array(NonEmptyStringSchema).min(1),
  density_intent: z.enum(["compact", "regular", "spacious"]),
  confidence: z.object({
    overall: ConfidenceSchema,
  }),
  unknowns: z.array(MaterialUnknownSchema).default([]),
  classification: CanonicalClassificationSchema.optional(),
});
export type DesignContext = z.infer<typeof DesignContextSchema>;

const DecisionConfidenceSchema = ConfidenceSchema.default("medium");

export const HierarchyOverrideSchema = z.object({
  basis: NonEmptyStringSchema,
  evidence_refs: z.array(NonEmptyStringSchema).min(1),
  risks: z.array(NonEmptyStringSchema).min(1),
  accepted_by: z.enum(["agent", "human"]),
});
export type HierarchyOverride = z.infer<typeof HierarchyOverrideSchema>;

export const DesignDecisionsSchema = z.object({
  session_id: NonEmptyStringSchema,
  primary_structure: z.object({
    pattern: NonEmptyStringSchema,
    rationale: z.array(NonEmptyStringSchema).min(1),
    confidence: DecisionConfidenceSchema,
  }),
  information_hierarchy: z.object({
    primary: z.array(NonEmptyStringSchema).min(1),
    secondary: z.array(NonEmptyStringSchema).default([]),
    override: HierarchyOverrideSchema.optional(),
  }),
  density: z.object({
    intent: z.enum(["compact", "regular", "spacious"]),
    strategy: z.array(NonEmptyStringSchema).min(1),
    avoid: z.array(NonEmptyStringSchema).default([]),
  }),
  major_choices: z
    .array(
      z.object({
        id: NonEmptyStringSchema,
        choice: NonEmptyStringSchema,
        rationale: NonEmptyStringSchema,
        confidence: DecisionConfidenceSchema,
        references: z.array(NonEmptyStringSchema).default([]),
      }),
    )
    .default([]),
  rejected: z
    .array(
      z.object({
        option: NonEmptyStringSchema,
        reason: NonEmptyStringSchema,
      }),
    )
    .default([]),
  unresolved: z.array(MaterialUnknownSchema).default([]),
});
export type DesignDecisions = z.infer<typeof DesignDecisionsSchema>;

export const CapabilityStatusSchema = z.enum([
  "supported",
  "composable",
  "gap",
  "blocked",
]);

export const CapabilityResolutionTypeSchema = z.enum([
  "frontend_composition",
  "bff",
  "backend_change",
  "explicit_compromise",
]);

export const CapabilityMapSchema = z.object({
  needs: z
    .array(
      z.object({
        id: NonEmptyStringSchema,
        product_action: NonEmptyStringSchema,
        required_experience: z.array(NonEmptyStringSchema).min(1),
        capabilities: z.array(NonEmptyStringSchema).default([]),
        status: CapabilityStatusSchema,
        resolution: z
          .object({
            type: CapabilityResolutionTypeSchema,
            notes: NonEmptyStringSchema,
          })
          .optional(),
      }),
    )
    .min(1),
});
export type CapabilityMap = z.infer<typeof CapabilityMapSchema>;

export const RealizationModeSchema = z.enum(["direct_code", "figma_first"]);
export type RealizationMode = z.infer<typeof RealizationModeSchema>;

export const ProviderFrameRefSchema = z.object({
  node_id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  sdir_region: NonEmptyStringSchema,
});
export type ProviderFrameRef = z.infer<typeof ProviderFrameRefSchema>;

export const ProviderRefsSchema = z.object({
  file_key: NonEmptyStringSchema,
  frames: z.array(ProviderFrameRefSchema).min(1),
});
export type ProviderRefs = z.infer<typeof ProviderRefsSchema>;

export const RealizationConditionSchema = z.object({
  id: NonEmptyStringSchema,
  holds: z.boolean(),
  basis: NonEmptyStringSchema,
});
export type RealizationCondition = z.infer<typeof RealizationConditionSchema>;

export const RealizationDecisionSchema = z.object({
  version: z.literal("0.1"),
  realization_mode: RealizationModeSchema,
  provider: NonEmptyStringSchema.optional(),
  provider_contract_version: NonEmptyStringSchema.optional(),
  conditions: z.array(RealizationConditionSchema).min(1),
  proposed_at: z.string().datetime(),
  supersedes: z
    .object({ prior_mode: RealizationModeSchema, reason: NonEmptyStringSchema })
    .optional(),
  overridden: z.boolean().default(false),
  override_reason: NonEmptyStringSchema.optional(),
});
export type RealizationDecision = z.infer<typeof RealizationDecisionSchema>;

export const RepresentationStatusSchema = z.enum([
  "pending_generation",
  "under_review",
  "revision_requested",
  "approved",
  "abandoned",
]);

export const RepresentationArtifactSchema = z.object({
  version: z.literal("0.1"),
  id: NonEmptyStringSchema,
  representation: z.object({ role: z.literal("primary") }),
  semantic_refs: z.object({
    sdir_ref: z.literal("screen.sdir.yaml"),
    sdir_digest: NonEmptyStringSchema,
    regions: z.array(NonEmptyStringSchema).min(1),
  }),
  realization: z.object({
    provider: NonEmptyStringSchema,
    provider_contract_version: NonEmptyStringSchema,
    refs: ProviderRefsSchema.nullable(),
  }),
  status: RepresentationStatusSchema,
  validation: z.array(NonEmptyStringSchema),
});
export type RepresentationArtifact = z.infer<typeof RepresentationArtifactSchema>;

export const ScreenshotEvidenceSchema = z.object({
  type: z.literal("screenshot"),
  ref: NonEmptyStringSchema,
  sha256: NonEmptyStringSchema,
  collected_at: z.string().datetime(),
});

export const HumanDecisionEvidenceSchema = z.object({
  type: z.literal("human_decision"),
  actor_type: z.literal("human"),
  actor_ref: NonEmptyStringSchema,
  source_type: NonEmptyStringSchema,
  source_ref: NonEmptyStringSchema,
  quote: NonEmptyStringSchema,
  confirmed_at: z.string().datetime(),
});

export const RepresentationReviewEvidenceSchema = z.discriminatedUnion("type", [
  ScreenshotEvidenceSchema,
  HumanDecisionEvidenceSchema,
]);
export type RepresentationReviewEvidence = z.infer<typeof RepresentationReviewEvidenceSchema>;

export const RepresentationReviewRecordSchema = z.object({
  round: z.number().int().positive(),
  status: z.enum(["approved", "rejected"]),
  provider_refs_verified: z.object({
    file_key: NonEmptyStringSchema,
    frame_node_ids: z.array(NonEmptyStringSchema).min(1),
  }),
  feedback: z
    .object({
      text: NonEmptyStringSchema,
      region_annotations: z
        .array(z.object({ sdir_region: NonEmptyStringSchema, note: NonEmptyStringSchema }))
        .default([]),
    })
    .optional(),
  evidence: z.array(RepresentationReviewEvidenceSchema).min(1),
  decided_at: z.string().datetime(),
  sdir_digest_at_review: NonEmptyStringSchema,
});
export type RepresentationReviewRecord = z.infer<typeof RepresentationReviewRecordSchema>;

export const RepresentationReviewSchema = RepresentationReviewRecordSchema.extend({
  version: z.literal("0.1"),
  history: z.array(RepresentationReviewRecordSchema).default([]),
});
export type RepresentationReview = z.infer<typeof RepresentationReviewSchema>;

export const DisclosureRecordSchema = z.object({
  knowledge_id: NonEmptyStringSchema,
  depth: DisclosureDepthSchema,
  trigger: NonEmptyStringSchema,
  disclosed_at: z.string().datetime(),
});
export type DisclosureRecord = z.infer<typeof DisclosureRecordSchema>;

export const RoutedKnowledgeRecordSchema = z.object({
  question: NonEmptyStringSchema,
  selected_ids: z.array(NonEmptyStringSchema),
  excluded_ids: z.array(NonEmptyStringSchema).default([]),
  confidence: ConfidenceSchema,
  routed_at: z.string().datetime(),
});
export type RoutedKnowledgeRecord = z.infer<typeof RoutedKnowledgeRecordSchema>;

export const ValidationLoopHistoryEntrySchema = z.object({
  evaluated_at: z.string().datetime(),
  open_findings: z.number().int().nonnegative(),
});
export type ValidationLoopHistoryEntry = z.infer<typeof ValidationLoopHistoryEntrySchema>;

export const ValidationLoopSchema = z.object({
  history: z.array(ValidationLoopHistoryEntrySchema).default([]),
});
export type ValidationLoop = z.infer<typeof ValidationLoopSchema>;

export const DesignSessionSchema = z.object({
  id: NonEmptyStringSchema,
  project_id: NonEmptyStringSchema.optional(),
  project_root: NonEmptyStringSchema,
  mode: DesignModeSchema,
  phase: DesignPhaseSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  revision: z.number().int().nonnegative(),
  requirement_ref: NonEmptyStringSchema,
  completed_gates: z.array(NonEmptyStringSchema).default([]),
  current_gate: z.object({ name: NonEmptyStringSchema }),
  disclosures: z.array(DisclosureRecordSchema).default([]),
  routing_history: z.array(RoutedKnowledgeRecordSchema).default([]),
  artifacts: z.record(z.string(), NonEmptyStringSchema).default({}),
  unresolved: z.array(NonEmptyStringSchema).default([]),
  warnings: z.array(NonEmptyStringSchema).default([]),
  lifecycle_policy: LifecyclePolicySchema.optional(),
  design_authorities: z.array(NonEmptyStringSchema).default([]),
  validation_loop: ValidationLoopSchema.default({ history: [] }),
});
export type DesignSession = z.infer<typeof DesignSessionSchema>;

export interface GateResult<T extends Record<string, unknown> = Record<string, never>> {
  status: GateStatus;
  code?: string;
  message?: string;
  warnings?: string[];
  next?: Record<string, unknown>;
  data?: T;
}

export interface ArtifactValidation<T> {
  status: GateStatus;
  issues: string[];
  warnings: string[];
  codes?: string[];
  value?: T;
}

export const ARTIFACT_FILES = {
  requirement: "requirement.md",
  session: "session.yaml",
  productFrame: "product-frame.yaml",
  designContext: "design-context.yaml",
  routingLog: "routing-log.yaml",
  designDecisions: "design-decisions.yaml",
  sdir: "screen.sdir.yaml",
  capabilityGaps: "capability-gaps.yaml",
  implementationBrief: "implementation-brief.yaml",
  validationReport: "validation-report.yaml",
  requirementConfirmation: "requirement-confirmation.yaml",
  existingUnderstanding: "existing-understanding.yaml",
  intentLite: "intent-lite.yaml",
  sdirDelta: "sdir-delta.yaml",
  contextManifest: "context-manifest.yaml",
  validationPlan: "validation-plan.yaml",
  compiledContext: "compiled-context.yaml",
  compilationTrace: "context-compilation-trace.yaml",
  realizationDecision: "realization-decision.yaml",
  representationArtifact: "representation-artifact.yaml",
  representationReview: "representation-review.yaml",
} as const;

export type ArtifactKey = keyof typeof ARTIFACT_FILES;

export function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "root" : issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
}
