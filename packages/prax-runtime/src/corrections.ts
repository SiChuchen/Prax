import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { z } from "zod";

const NonEmpty = z.string().trim().min(1);

export const CorrectionSchema = z.object({
  id: NonEmpty,
  scope: z.object({
    project: NonEmpty.optional(),
    surfaces: z.array(NonEmpty).default([]),
  }),
  finding: z.object({
    type: NonEmpty,
    observed: NonEmpty,
  }),
  intended: z.object({
    statement: NonEmpty,
  }),
  evidence_refs: z.array(NonEmpty).default([]),
  regression: z.object({
    check_id: NonEmpty,
    requirement: NonEmpty.optional(),
  }),
  supersedes: z.array(NonEmpty).default([]),
  promotion: z.object({
    candidate: z.boolean().default(false),
  }).default({ candidate: false }),
  created_at: z.string().datetime(),
});
export type Correction = z.infer<typeof CorrectionSchema>;

export const CorrectionsFileSchema = z.object({
  version: z.literal("0.1"),
  corrections: z.array(CorrectionSchema).default([]),
});
export type CorrectionsFile = z.infer<typeof CorrectionsFileSchema>;

export const CORRECTIONS_FILE = "corrections.yaml";

export async function loadCorrections(stateRoot: string): Promise<Correction[]> {
  try {
    const raw = await readFile(join(stateRoot, CORRECTIONS_FILE), "utf8");
    const parsed = CorrectionsFileSchema.safeParse(raw.trim().length === 0 ? {} : parse(raw));
    return parsed.success ? parsed.data.corrections : [];
  } catch {
    return [];
  }
}

export function activeCorrections(corrections: readonly Correction[]): Correction[] {
  const superseded = new Set(corrections.flatMap((correction) => correction.supersedes));
  return corrections.filter((correction) => !superseded.has(correction.id));
}

export interface CorrectionScopeQuery {
  surfaces: readonly string[];
}

export function relevantCorrections(
  corrections: readonly Correction[],
  query: CorrectionScopeQuery,
): Correction[] {
  const surfaces = new Set(query.surfaces);
  return activeCorrections(corrections).filter((correction) => {
    if (correction.scope.surfaces.length === 0) return true;
    return correction.scope.surfaces.some((surface) => surfaces.has(surface));
  });
}
