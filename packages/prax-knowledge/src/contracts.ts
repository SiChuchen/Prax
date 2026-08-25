import { z } from "zod";

export const KnowledgeTypeSchema = z.enum([
  "principle",
  "heuristic",
  "pattern",
  "platform_convention",
  "myth",
  "product_evidence",
]);
export type KnowledgeType = z.infer<typeof KnowledgeTypeSchema>;

export const KnowledgeLifecycleStatusSchema = z.enum([
  "draft",
  "reviewed",
  "stable",
  "deprecated",
]);
export type KnowledgeLifecycleStatus = z.infer<
  typeof KnowledgeLifecycleStatusSchema
>;

export const KnowledgeScopeSchema = z.object({
  user_type: z.array(z.string()).default([]),
  task_type: z.array(z.string()).default([]),
  domain: z.array(z.string()).default([]),
  platform: z.array(z.string()).default([]),
  density: z.array(z.string()).default([]),
  phase: z.array(z.string()).default([]),
});
export type KnowledgeScope = z.infer<typeof KnowledgeScopeSchema>;

export const PatternContractSchema = z.object({
  problem: z.string().min(1),
  context: z.string().min(1),
  forces: z.array(z.string().min(1)).min(1),
  solution: z.string().min(1),
  tradeoffs: z.array(z.string().min(1)).min(1),
  consequences: z.array(z.string().min(1)).min(1),
  applies_when: z.array(z.string().min(1)).min(1),
  does_not_apply_when: z.array(z.string().min(1)).min(1),
  related_patterns: z.object({
    composed_of: z.array(z.string()).default([]),
    complements: z.array(z.string()).default([]),
    alternatives: z
      .array(
        z.object({
          pattern: z.string().min(1),
          when: z.string().min(1),
        }),
      )
      .default([]),
  }),
  anti_patterns: z.array(z.string().min(1)).default([]),
});
export type PatternContract = z.infer<typeof PatternContractSchema>;

const DisclosureL0Schema = z.object({
  one_line_use: z.string().min(1),
});

const DisclosureL1Schema = z.object({
  statement: z.string().min(1),
  applies_when: z.array(z.string().min(1)).min(1),
  does_not_apply_when: z.array(z.string().min(1)).default([]),
  priority_class: z.string().min(1),
  known_exceptions: z.array(z.string().min(1)).default([]),
});

const DisclosureL2Schema = z.object({
  rationale: z.string().min(1),
  forces: z.array(z.string().min(1)).default([]),
  tradeoffs: z.array(z.string().min(1)).default([]),
  examples: z.array(z.string().min(1)).default([]),
  counterexamples: z.array(z.string().min(1)).default([]),
  related: z.array(z.string()).default([]),
  conflicts: z.array(z.string()).default([]),
});

const DisclosureL3Schema = z.object({
  evidence: z
    .array(
      z.object({
        source_ref: z.string().min(1),
        role: z.string().min(1),
        caveat: z.string().min(1).optional(),
      }),
    )
    .min(1),
  confidence: z.enum(["high", "medium", "low"]),
  version: z.string().min(1),
  research_notes: z.array(z.string()).default([]),
  validation_history: z.array(z.string()).default([]),
});

export const KnowledgeEntrySchema = z
  .object({
    id: z.string().min(1),
    type: KnowledgeTypeSchema,
    name: z.string().min(1),
    summary: z.string().min(1),
    category: z.string().min(1),
    scope: KnowledgeScopeSchema,
    triggers: z.array(z.string().min(1)).min(1),
    lifecycle: z.object({
      status: KnowledgeLifecycleStatusSchema,
      version: z.string().min(1),
      owner: z.string().min(1),
      review_by: z.string().min(1),
    }),
    provenance: z.object({
      source_refs: z.array(z.string().min(1)).min(1),
      authority_category: z.string().min(1),
      certainty: z.enum(["high", "medium", "low"]),
      recommendation_strength: z.enum(["strong", "moderate", "weak"]),
    }),
    validation: z.object({
      mode: z.enum(["deterministic", "assistive", "empirical"]),
      checks: z.array(z.string().min(1)).default([]),
    }),
    disclosure: z.object({
      L0: DisclosureL0Schema,
      L1: DisclosureL1Schema,
      L2: DisclosureL2Schema,
      L3: DisclosureL3Schema,
    }),
    pattern_contract: PatternContractSchema.optional(),
  })
  .superRefine((entry, context) => {
    if (entry.type === "pattern" && entry.pattern_contract === undefined) {
      context.addIssue({
        code: "custom",
        path: ["pattern_contract"],
        message: "Pattern entries require problem/context/forces/solution/tradeoffs.",
      });
    }
    if (entry.type !== "pattern" && entry.pattern_contract !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["pattern_contract"],
        message: "Only Pattern entries may define pattern_contract.",
      });
    }
  });

export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;

export const KnowledgeDocumentSchema = z.object({
  version: z.literal("0.1"),
  entries: z.array(KnowledgeEntrySchema),
});

export interface KnowledgeIndex {
  id: string;
  type: KnowledgeType;
  name: string;
  one_line_use: string;
  triggers: string[];
  scope: KnowledgeScope;
  lifecycle: KnowledgeEntry["lifecycle"];
}

export type DisclosureDepth = "L0" | "L1" | "L2" | "L3";

export interface InspectedKnowledge {
  id: string;
  type: KnowledgeType;
  name: string;
  depth: DisclosureDepth;
  content: Record<string, unknown>;
}
