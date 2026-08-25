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
      .array(z.object({ source: NonEmpty, target: NonEmpty, type: NonEmpty }))
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

