import { z } from "zod";

const NonEmpty = z.string().trim().min(1);

export const SdirStateSchema = z.enum(["loading", "empty", "ready", "selected", "error"]);

export const SdirRegionSchema = z.object({
  id: NonEmpty,
  role: NonEmpty,
  importance: z.enum(["dominant", "primary", "supporting", "contextual"]),
  visibility: z.object({
    condition: z.enum(["always", "selection_driven", "permission_driven", "task_driven"]),
  }),
  behavior_intent: z.array(NonEmpty).default([]),
});

export const SdirSchema = z.object({
  version: z.literal("0.1"),
  screen: z.object({
    id: NonEmpty,
    intent: z.object({
      primary_task: NonEmpty,
      secondary_tasks: z.array(NonEmpty).default([]),
    }),
    archetype: z.object({ pattern_ref: NonEmpty }),
    density_intent: z.enum(["compact", "regular", "spacious"]),
    regions: z.array(SdirRegionSchema).min(1),
    relationships: z
      .array(
        z.object({
          id: NonEmpty.optional(),
          source: NonEmpty,
          target: NonEmpty,
          type: NonEmpty,
        }),
      )
      .default([]),
    interaction_intents: z.array(NonEmpty).min(1),
    required_states: z.array(SdirStateSchema).min(4),
    decision_points: z
      .array(
        z.object({
          id: NonEmpty,
          question: NonEmpty,
          adapter_may_choose: z.array(NonEmpty).min(1),
        }),
      )
      .min(1),
    unresolved: z
      .array(
        z.object({
          id: NonEmpty,
          question: NonEmpty,
          impact: z.enum(["low", "medium", "high"]),
          affects: z.array(NonEmpty).default([]),
        }),
      )
      .default([]),
    rejected_alternatives: z
      .array(z.object({ option: NonEmpty, reason: NonEmpty }))
      .default([]),
  }),
});

export type Sdir = z.infer<typeof SdirSchema>;

export interface SdirIssue {
  code: string;
  message: string;
}

export interface SdirValidation {
  status: "PASS" | "RETRY" | "REVIEW";
  schema_errors: string[];
  semantic_errors: string[];
  semantic_issues: SdirIssue[];
  warnings: string[];
  value?: Sdir;
}


export const SdirDeltaChangeSchema = z.object({
  region: NonEmpty,
  action: z.enum(["add", "modify", "remove", "preserve_explicit"]),
  role: NonEmpty.optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  rationale: NonEmpty,
});
export type SdirDeltaChange = z.infer<typeof SdirDeltaChangeSchema>;

export const SdirDeltaImpactSchema = z.object({
  changes_product_objects: z.boolean().default(false),
  changes_region_structure: z.boolean().default(false),
  changes_interaction_model: z.boolean().default(false),
  changes_state_model: z.boolean().default(false),
  adds_capability: z.boolean().default(false),
});

export const SdirDeltaSchema = z.object({
  version: z.literal("0.1"),
  surface: NonEmpty,
  impact: SdirDeltaImpactSchema,
  base_regions: z
    .array(
      z.object({
        id: NonEmpty,
        role: NonEmpty,
        importance: z.enum(["dominant", "primary", "supporting", "contextual"]),
      }),
    )
    .min(1),
  changes: z.array(SdirDeltaChangeSchema).min(1),
  preserved: z.array(NonEmpty).default([]),
  regression_points: z.array(NonEmpty).min(1),
  capability_needs: z.array(NonEmpty).default([]),
});
export type SdirDelta = z.infer<typeof SdirDeltaSchema>;
export interface SdirDeltaValidation {
  status: "PASS" | "RETRY";
  schema_errors: string[];
  semantic_errors: string[];
  semantic_issues: SdirIssue[];
  value?: SdirDelta;
}
