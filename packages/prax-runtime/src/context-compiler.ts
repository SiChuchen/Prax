import { z } from "zod";
import { relevantCorrections, type Correction } from "./corrections.js";
import type { ContextManifest } from "./context-manifest.js";
import type {
  DesignDecisions,
  DesignSession,
  ExistingUnderstanding,
  IntentLite,
  ProductFrame,
} from "./contracts.js";

interface SdirLike {
  screen: {
    relationships: Array<{
      id?: string | undefined;
      source: string;
      target: string;
      type: string;
    }>;
  };
}

const NonEmpty = z.string().trim().min(1);

export const CompiledContextSchema = z.object({
  version: z.literal("0.1"),
  session_id: NonEmpty,
  task: z.object({
    surfaces: z.array(NonEmpty).default([]),
    primary: NonEmpty,
  }),
  product_relationships: z
    .array(
      z.object({
        id: NonEmpty,
        source: NonEmpty,
        target: NonEmpty,
        type: NonEmpty,
        direction: z.enum(["forward", "bidirectional", "none"]).optional(),
        meaning: NonEmpty.optional(),
        importance: z.enum(["primary", "supporting"]).optional(),
      }),
    )
    .default([]),
  region_relationships: z
    .array(z.object({ id: NonEmpty.optional(), source: NonEmpty, target: NonEmpty, type: NonEmpty }))
    .default([]),
  decisions: z
    .object({
      primary_structure: NonEmpty.optional(),
      density_intent: z.enum(["compact", "regular", "spacious"]).optional(),
      major_choice_ids: z.array(NonEmpty).default([]),
    })
    .default({ major_choice_ids: [] }),
  must_preserve: z.array(NonEmpty).default([]),
  regression_points: z.array(NonEmpty).default([]),
  unresolved: z.array(NonEmpty).default([]),
  corrections: z
    .array(z.object({ id: NonEmpty, check_id: NonEmpty, intended: NonEmpty }))
    .default([]),
  validation: z.object({
    plan_revision: z.number().int().positive(),
    check_ids: z.array(NonEmpty),
    regression_check_ids: z.array(NonEmpty).default([]),
  }),
});
export type CompiledContext = z.infer<typeof CompiledContextSchema>;

export const CompilationTraceSchema = z.object({
  version: z.literal("0.1"),
  session_id: NonEmpty,
  task_ref: NonEmpty,
  selected: z.array(z.object({ ref: NonEmpty, reason: z.array(NonEmpty).default([]) })).default([]),
  excluded: z.array(z.object({ ref: NonEmpty, reason: NonEmpty })).default([]),
});
export type CompilationTrace = z.infer<typeof CompilationTraceSchema>;

export interface CompileContextInput {
  session: DesignSession;
  frame?: ProductFrame | undefined;
  understanding?: ExistingUnderstanding | undefined;
  decisions?: DesignDecisions | undefined;
  sdir?: SdirLike | undefined;
  intentLite?: IntentLite | undefined;
  manifest?: ContextManifest | undefined;
  planRevision: number;
  planCheckIds: readonly string[];
  corrections: readonly Correction[];
}

export function compileContext(input: CompileContextInput): {
  compiled: CompiledContext;
  trace: CompilationTrace;
} {
  const { session, frame, understanding, decisions, sdir, intentLite, manifest } = input;

  const surfaces = [
    ...new Set([
      ...(understanding?.change_targets ?? []),
      ...(intentLite?.surfaces ?? []),
    ]),
  ];
  const changeTargets = understanding?.change_targets.join(", ") ?? "";
  const taskPrimary =
    intentLite?.change ||
    (changeTargets.length > 0 ? changeTargets : undefined) ||
    frame?.tasks.primary ||
    session.requirement_ref;

  const productRelationships = [
    ...(frame?.relationships ?? []).map((relationship) => ({
      ...(relationship.id === undefined ? {} : { id: relationship.id }),
      source: relationship.source,
      target: relationship.target,
      type: relationship.type,
      ...(relationship.direction === undefined ? {} : { direction: relationship.direction }),
      ...(relationship.meaning === undefined ? {} : { meaning: relationship.meaning }),
      ...(relationship.importance === undefined ? {} : { importance: relationship.importance }),
    })),
    ...(understanding?.current_relationships ?? []).map((relationship) => ({
      ...(relationship.id === undefined ? {} : { id: relationship.id }),
      source: relationship.source,
      target: relationship.target,
      type: relationship.type,
      ...(relationship.direction === undefined ? {} : { direction: relationship.direction }),
      ...(relationship.meaning === undefined ? {} : { meaning: relationship.meaning }),
      importance: "supporting" as const,
    })),
  ].filter((relationship, index, all) => {
    const first = all.findIndex((candidate) => candidate.id === relationship.id);
    return first === index;
  });

  const regionRelationships = (sdir?.screen.relationships ?? []).map((relationship) => ({
    ...(relationship.id === undefined ? {} : { id: relationship.id }),
    source: relationship.source,
    target: relationship.target,
    type: relationship.type,
  }));

  const relevant = relevantCorrections(input.corrections, { surfaces });
  const excludedCorrections = input.corrections.filter(
    (correction) => !relevant.some((active) => active.id === correction.id),
  );

  const unresolved = [
    ...new Set([
      ...(frame?.open_questions ?? []),
      ...(decisions?.unresolved.map((unknown) => (typeof unknown === "string" ? unknown : unknown.id)) ?? []),
      ...(manifest?.unresolved ?? []),
    ]),
  ];

  const regressionPoints = [
    ...new Set([
      ...(intentLite?.regression_points ?? []),
      ...(understanding?.must_preserve ?? []),
    ]),
  ];

  const compiled = CompiledContextSchema.parse({
    version: "0.1",
    session_id: session.id,
    task: { surfaces, primary: taskPrimary },
    product_relationships: productRelationships,
    region_relationships: regionRelationships,
    decisions: {
      ...(decisions === undefined
        ? {}
        : {
            primary_structure: decisions.primary_structure.pattern,
            density_intent: decisions.density.intent,
            major_choice_ids: decisions.major_choices.map((choice) => choice.id),
          }),
    },
    must_preserve: understanding?.must_preserve ?? [],
    regression_points: regressionPoints,
    unresolved,
    corrections: relevant.map((correction) => ({
      id: correction.id,
      check_id: correction.regression.check_id,
      intended: correction.intended.statement,
    })),
    validation: {
      plan_revision: input.planRevision,
      check_ids: [...input.planCheckIds],
      regression_check_ids: relevant.map((correction) => correction.regression.check_id),
    },
  });

  const trace = CompilationTraceSchema.parse({
    version: "0.1",
    session_id: session.id,
    task_ref: taskPrimary,
    selected: [
      {
        ref: "product_relationships",
        reason: productRelationships.map((relationship) => `${relationship.id ?? relationship.source}:${relationship.source}->${relationship.target}`),
      },
      { ref: "region_relationships", reason: regionRelationships.map((relationship) => relationship.id ?? relationship.source) },
      { ref: "decisions.primary_structure", reason: decisions === undefined ? [] : [decisions.primary_structure.pattern] },
      { ref: "unresolved", reason: unresolved },
      { ref: "corrections", reason: relevant.map((correction) => correction.id) },
      { ref: `validation-plan@${input.planRevision}`, reason: [...input.planCheckIds] },
    ],
    excluded: [
      ...excludedCorrections.map((correction) => ({
        ref: `correction:${correction.id}`,
        reason: correction.scope.surfaces.length === 0 ? "not_active" : "scope_mismatch",
      })).filter((entry) => entry.reason !== "not_active" || excludedCorrections.some((c) => c.supersedes.length > 0)),
      ...(sdir === undefined && understanding !== undefined
        ? [{ ref: "region_relationships", reason: "sdir_delta carries region changes, not region relationships" }]
        : []),
      { ref: "routing-log", reason: "process_metadata" },
      { ref: "session-internals", reason: "process_metadata" },
    ],
  });

  return { compiled, trace };
}
