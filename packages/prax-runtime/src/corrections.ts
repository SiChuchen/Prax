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
  // Free-text descriptions of those surfaces (declared purposes). Pair-02
  // finding: a session may name a surface with zero lexical overlap to the
  // seeded scope ("project-architecture" vs "canvas-stage") while the
  // surface's purpose text still names it ("canvas stage ... Inspector").
  surfaceDescriptions?: readonly string[];
}

// Structural words that carry no surface identity on their own: two surface
// ids sharing only one of these are not related ("settings-page" vs
// "home-page" must not match).
const GENERIC_SURFACE_TOKENS = new Set([
  "page",
  "view",
  "panel",
  "screen",
  "surface",
  "area",
  "section",
  "app",
  "web",
  "ui",
  "main",
  "new",
]);

function surfaceTokens(surface: string): string[] {
  // CJK ranges are kept as tokens — purposes and scope ids may be written
  // in Chinese ("配置" must tokenize to ["配置"], not to nothing).
  return surface
    .toLowerCase()
    .split(/[^a-z0-9\u3400-\u9fff]+/)
    .filter((token) => token.length > 0);
}

// MEM-001 pair-01 finding: exact-string surface matching dropped a seeded
// correction whose scope said "canvas-inspector" when the task declared
// "canvas_inspector", and "canvas-stage" never matched
// "architecture_canvas". Surfaces are related when their normalized token
// sequences are identical, when one side's tokens are a subset of the
// other's, or when they share one non-generic token.
function surfacesRelated(correctionSurface: string, querySurface: string): boolean {
  const correctionTokens = surfaceTokens(correctionSurface);
  const queryTokens = surfaceTokens(querySurface);
  // Vacuous-truth guard: a string with no tokens (pure punctuation, or an
  // empty result from tokenization) must not match anything through the
  // subset/containment checks below.
  if (correctionTokens.length === 0 || queryTokens.length === 0) return false;
  if (
    correctionTokens.length === queryTokens.length &&
    correctionTokens.every((token, index) => token === queryTokens[index])
  ) {
    return true;
  }
  const querySet = new Set(queryTokens);
  const correctionSet = new Set(correctionTokens);
  if (correctionTokens.every((token) => querySet.has(token))) return true;
  if (queryTokens.every((token) => correctionSet.has(token))) return true;
  for (const token of correctionSet) {
    if (querySet.has(token) && !GENERIC_SURFACE_TOKENS.has(token)) return true;
  }
  return false;
}

export function relevantCorrections(
  corrections: readonly Correction[],
  query: CorrectionScopeQuery,
): Correction[] {
  const descriptions = query.surfaceDescriptions ?? [];
  return activeCorrections(corrections).filter((correction) => {
    if (correction.scope.surfaces.length === 0) return true;
    return correction.scope.surfaces.some((correctionSurface) =>
      query.surfaces.some((querySurface) => surfacesRelated(correctionSurface, querySurface)) ||
      descriptions.some((description) => surfacesRelated(correctionSurface, description)),
    );
  });
}
