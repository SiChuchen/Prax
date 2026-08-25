import { z } from "zod";

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
  "PRODUCT_FRAMING",
  "CONTEXT",
  "ROUTING",
  "DECISION",
  "SDIR",
  "CAPABILITY_RECONCILIATION",
  "IMPLEMENTATION_READY",
  "VALIDATION",
  "COMPLETE",
  "REVIEW_REQUIRED",
  "BLOCKED",
  "ABANDONED",
]);
export type DesignPhase = z.infer<typeof DesignPhaseSchema>;

export const DesignModeSchema = z.enum(["greenfield", "existing_product"]);
export type DesignMode = z.infer<typeof DesignModeSchema>;

export const DisclosureDepthSchema = z.enum(["L0", "L1", "L2", "L3"]);
export type DisclosureDepth = z.infer<typeof DisclosureDepthSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

const NonEmptyStringSchema = z.string().trim().min(1);

export const ProductFrameSchema = z.object({
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
      }),
    )
    .min(1),
  relationships: z
    .array(
      z.object({
        source: NonEmptyStringSchema,
        target: NonEmptyStringSchema,
        type: NonEmptyStringSchema,
      }),
    )
    .default([]),
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
} as const;

export type ArtifactKey = keyof typeof ARTIFACT_FILES;

export function zodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "root" : issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
}
