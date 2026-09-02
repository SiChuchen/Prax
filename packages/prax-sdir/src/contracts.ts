import { z } from "zod";
import { JTBD_VERBS, OBJECT_TYPES, REPRESENTATION_PRIMITIVES } from "./vocab.js";

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

// ── shared screen blocks (0.1 core) ──
const ScreenIntentSchema = z.object({
  primary_task: NonEmpty,
  secondary_tasks: z.array(NonEmpty).default([]),
});

const ScreenRelationshipSchema = z
  .array(
    z.object({
      id: NonEmpty.optional(),
      source: NonEmpty,
      target: NonEmpty,
      type: NonEmpty,
    }),
  )
  .default([]);

const ScreenDecisionPointsSchema = z
  .array(
    z.object({
      id: NonEmpty,
      question: NonEmpty,
      adapter_may_choose: z.array(NonEmpty).min(1),
    }),
  )
  .min(1);

const ScreenUnresolvedSchema = z
  .array(
    z.object({
      id: NonEmpty,
      question: NonEmpty,
      impact: z.enum(["low", "medium", "high"]),
      affects: z.array(NonEmpty).default([]),
    }),
  )
  .default([]);

const ScreenRejectedSchema = z
  .array(z.object({ option: NonEmpty, reason: NonEmpty }))
  .default([]);

export const SdirV01Schema = z.object({
  version: z.literal("0.1"),
  screen: z.object({
    id: NonEmpty,
    intent: ScreenIntentSchema,
    archetype: z.object({ pattern_ref: NonEmpty }),
    density_intent: z.enum(["compact", "regular", "spacious"]),
    regions: z.array(SdirRegionSchema).min(1),
    relationships: ScreenRelationshipSchema,
    interaction_intents: z.array(NonEmpty).min(1),
    required_states: z.array(SdirStateSchema).min(4),
    decision_points: ScreenDecisionPointsSchema,
    unresolved: ScreenUnresolvedSchema,
    rejected_alternatives: ScreenRejectedSchema,
  }),
});
export type SdirV01 = z.infer<typeof SdirV01Schema>;

// ── SDIR 0.2 (spec §6.1): the product-intelligence blocks are additive ──
const Ternary = z.enum(["low", "medium", "high"]);

export const UserJobSchema = z.object({
  verb: z.enum(JTBD_VERBS),
  target: NonEmpty,
  success: NonEmpty,
});

export const PrimaryObjectSchema = z.object({
  type: z.enum(OBJECT_TYPES),
  label: NonEmpty.optional(),
});

export const InformationShapeSchema = z.object({
  cardinality: z.enum(["one", "few", "many", "unbounded"]),
  relationality: Ternary,
  hierarchy: Ternary,
  temporality: Ternary,
  density: Ternary,
  dimensionality: Ternary.default("medium"),
  spatiality: z.enum(["none", "conceptual", "physical"]).default("none"),
  volatility: Ternary.default("medium"),
  uncertainty: Ternary.default("low"),
  comparison_need: z.enum(["none", "optional", "required"]).default("none"),
});

export const RepresentationSchema = z.object({
  primary: z.object({ type: z.enum(REPRESENTATION_PRIMITIVES), reason: NonEmpty }),
  supporting: z.array(z.object({ type: z.enum(REPRESENTATION_PRIMITIVES), reason: NonEmpty })).max(4).default([]),
});

export const PrioritySchema = z.object({
  primary: z.array(NonEmpty).min(1),
  contextual: z.array(NonEmpty).default([]),
});

export const InteractionSchema = z.object({
  preview: z.enum(["none", "hover", "focus"]).default("none"),
  inspect: z.enum(["none", "select", "open"]).default("select"),
  navigate: z.enum(["none", "drill", "open"]).default("none"),
  locate: z.enum(["none", "search", "filter"]).default("none"),
});

export const StateOwnershipSchema = z
  .array(
    z.object({
      state: z.enum(["selection", "preview", "inspector", "viewport", "query", "mode"]),
      owner: NonEmpty,
    }),
  )
  .min(1);

export const ComplexityBudgetSchema = z.object({
  permanent_panels: z.number().int().nonnegative(),
  permanent_primary_actions: z.number().int().nonnegative(),
  modes: z.number().int().nonnegative(),
  state_owners: z.number().int().nonnegative(),
  navigation_levels: z.number().int().nonnegative(),
  persistent_filters: z.number().int().nonnegative(),
  new_semantic_concepts: z.number().int().nonnegative(),
  keyboard_contracts: z.number().int().nonnegative(),
  mobile_conflicts: z.number().int().nonnegative(),
  permanent_surfaces: z.number().int().nonnegative(),
});

const SdirV02ScreenSchema = z.object({
  id: NonEmpty,
  intent: ScreenIntentSchema,
  // retained in 0.2; only pattern_ref becomes optional
  archetype: z.object({ pattern_ref: NonEmpty }).optional(),
  density_intent: z.enum(["compact", "regular", "spacious"]),
  regions: z.array(SdirRegionSchema).min(1),
  relationships: ScreenRelationshipSchema,
  interaction_intents: z.array(NonEmpty).min(1),
  required_states: z.array(SdirStateSchema).min(4),
  decision_points: ScreenDecisionPointsSchema,
  unresolved: ScreenUnresolvedSchema,
  rejected_alternatives: ScreenRejectedSchema,
  user_job: UserJobSchema,
  primary_object: PrimaryObjectSchema,
  information_shape: InformationShapeSchema,
  representation: RepresentationSchema,
  priority: PrioritySchema,
  interaction: InteractionSchema.default({ preview: "none", inspect: "select", navigate: "none", locate: "none" }),
  state_ownership: StateOwnershipSchema,
  complexity_budget: ComplexityBudgetSchema.optional(),
  acceptance: z.array(NonEmpty).min(1),
}).superRefine((screen, ctx) => {
  const regionIds = new Set(screen.regions.map((region) => region.id));
  for (const [index, entry] of screen.priority.primary.entries()) {
    if (!regionIds.has(entry)) {
      ctx.addIssue({ code: "custom", path: ["priority", "primary", index], message: `priority references nonexistent region id '${entry}'` });
    }
  }
  for (const [index, entry] of screen.priority.contextual.entries()) {
    if (!regionIds.has(entry)) {
      ctx.addIssue({ code: "custom", path: ["priority", "contextual", index], message: `priority references nonexistent region id '${entry}'` });
    }
  }
  const owners = new Set([...regionIds, "session", "url"]);
  for (const [index, entry] of screen.state_ownership.entries()) {
    if (!owners.has(entry.owner)) {
      ctx.addIssue({ code: "custom", path: ["state_ownership", index, "owner"], message: `state owner '${entry.owner}' must be a region id, 'session', or 'url'` });
    }
  }
});

export const SdirV02Schema = z.object({
  version: z.literal("0.2"),
  screen: SdirV02ScreenSchema,
});
export type SdirV02 = z.infer<typeof SdirV02Schema>;

export const SdirSchema = z.discriminatedUnion("version", [SdirV01Schema, SdirV02Schema]);
export type Sdir = z.infer<typeof SdirSchema>;

/**
 * Flattened client-facing SDIR schema (AB-001 anyOf lesson, spec I1 recipe):
 * the union of 0.1 + 0.2 fields with everything optional plus an optional
 * version literal — never a z.union / discriminatedUnion inside an MCP
 * inputSchema. The server reads `version` (absent ⇒ 0.1) and re-parses with
 * the matching strict branch.
 */
export const SdirClientSchema = z.object({
  version: z.enum(["0.1", "0.2"]).optional(),
  screen: z.object({
    id: NonEmpty,
    intent: ScreenIntentSchema,
    archetype: z.object({ pattern_ref: NonEmpty }).optional(),
    density_intent: z.enum(["compact", "regular", "spacious"]),
    regions: z.array(SdirRegionSchema).min(1),
    relationships: ScreenRelationshipSchema,
    interaction_intents: z.array(NonEmpty).min(1),
    required_states: z.array(SdirStateSchema).min(4),
    decision_points: ScreenDecisionPointsSchema,
    unresolved: ScreenUnresolvedSchema,
    rejected_alternatives: ScreenRejectedSchema,
    user_job: UserJobSchema.optional(),
    primary_object: PrimaryObjectSchema.optional(),
    information_shape: InformationShapeSchema.optional(),
    representation: RepresentationSchema.optional(),
    priority: PrioritySchema.optional(),
    interaction: InteractionSchema.optional(),
    state_ownership: StateOwnershipSchema.optional(),
    complexity_budget: ComplexityBudgetSchema.optional(),
    acceptance: z.array(NonEmpty).optional(),
  }),
});
export type SdirClient = z.infer<typeof SdirClientSchema>;

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
