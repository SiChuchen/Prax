import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import {
  KnowledgeEntrySchema,
  KnowledgeLifecycleStatusSchema,
  KnowledgeScopeSchema,
  KnowledgeTypeSchema,
  PatternContractSchema,
  type DisclosureDepth,
  type InspectedKnowledge,
  type KnowledgeEntry,
  type KnowledgeIndex,
  type KnowledgeType,
} from "./contracts.js";

const NonEmpty = z.string().trim().min(1);

/**
 * Compact authoring form for the built-in pack. The runtime always expands this
 * into the complete, independently valid KnowledgeEntry contract before use.
 */
const KnowledgeSeedSchema = z.object({
  id: NonEmpty,
  type: KnowledgeTypeSchema,
  name: NonEmpty,
  summary: NonEmpty,
  category: NonEmpty,
  scope: KnowledgeScopeSchema,
  triggers: z.array(NonEmpty).min(1),
  lifecycle: z.object({
    status: KnowledgeLifecycleStatusSchema,
    version: NonEmpty.default("0.1.0"),
    owner: NonEmpty.default("prax-knowledge"),
    review_by: NonEmpty.default("2027-02-25"),
  }),
  provenance: z.object({
    source_refs: z.array(NonEmpty).min(1),
    authority_category: NonEmpty,
    certainty: z.enum(["high", "medium", "low"]),
    recommendation_strength: z.enum(["strong", "moderate", "weak"]),
  }),
  validation: z.object({
    mode: z.enum(["deterministic", "assistive", "empirical"]),
    checks: z.array(NonEmpty).default([]),
  }),
  statement: NonEmpty,
  applies_when: z.array(NonEmpty).min(1),
  does_not_apply_when: z.array(NonEmpty).default([]),
  priority_class: NonEmpty.default("contextual"),
  known_exceptions: z.array(NonEmpty).default([]),
  rationale: NonEmpty,
  forces: z.array(NonEmpty).default([]),
  tradeoffs: z.array(NonEmpty).default([]),
  examples: z.array(NonEmpty).default([]),
  counterexamples: z.array(NonEmpty).default([]),
  related: z.array(NonEmpty).default([]),
  conflicts: z.array(NonEmpty).default([]),
  research_notes: z.array(NonEmpty).default([]),
  validation_history: z.array(NonEmpty).default([]),
  pattern_contract: PatternContractSchema.optional(),
});

const KnowledgeSeedDocumentSchema = z.object({
  version: z.literal("0.1"),
  entries: z.array(KnowledgeSeedSchema),
});

function expandSeed(seed: z.infer<typeof KnowledgeSeedSchema>): KnowledgeEntry {
  return KnowledgeEntrySchema.parse({
    id: seed.id,
    type: seed.type,
    name: seed.name,
    summary: seed.summary,
    category: seed.category,
    scope: seed.scope,
    triggers: seed.triggers,
    lifecycle: seed.lifecycle,
    provenance: seed.provenance,
    validation: seed.validation,
    disclosure: {
      L0: { one_line_use: seed.summary },
      L1: {
        statement: seed.statement,
        applies_when: seed.applies_when,
        does_not_apply_when: seed.does_not_apply_when,
        priority_class: seed.priority_class,
        known_exceptions: seed.known_exceptions,
      },
      L2: {
        rationale: seed.rationale,
        forces: seed.forces,
        tradeoffs: seed.tradeoffs,
        examples: seed.examples,
        counterexamples: seed.counterexamples,
        related: seed.related,
        conflicts: seed.conflicts,
      },
      L3: {
        evidence: seed.provenance.source_refs.map((sourceRef) => ({
          source_ref: sourceRef,
          role: "supports this scoped recommendation",
        })),
        confidence: seed.provenance.certainty,
        version: seed.lifecycle.version,
        research_notes: seed.research_notes,
        validation_history: seed.validation_history,
      },
    },
    ...(seed.pattern_contract === undefined
      ? {}
      : { pattern_contract: seed.pattern_contract }),
  });
}

export class KnowledgeStoreError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "KnowledgeStoreError";
  }
}

export class KnowledgeStore {
  private readonly byId: ReadonlyMap<string, KnowledgeEntry>;

  public constructor(entries: readonly KnowledgeEntry[]) {
    const map = new Map<string, KnowledgeEntry>();
    for (const entry of entries) {
      if (map.has(entry.id)) {
        throw new KnowledgeStoreError(
          "DUPLICATE_KNOWLEDGE_ID",
          `Duplicate knowledge id: ${entry.id}`,
        );
      }
      map.set(entry.id, entry);
    }
    this.byId = map;
  }

  public static async fromYamlFile(filePath: string): Promise<KnowledgeStore> {
    const raw = parse(await readFile(filePath, "utf8"));
    const completeDocument = z
      .object({ version: z.literal("0.1"), entries: z.array(KnowledgeEntrySchema) })
      .safeParse(raw);
    if (completeDocument.success) {
      return new KnowledgeStore(completeDocument.data.entries);
    }

    const seedDocument = KnowledgeSeedDocumentSchema.parse(raw);
    return new KnowledgeStore(seedDocument.entries.map(expandSeed));
  }

  public size(): number {
    return this.byId.size;
  }

  public get(id: string): KnowledgeEntry | undefined {
    return this.byId.get(id);
  }

  public require(id: string): KnowledgeEntry {
    const entry = this.get(id);
    if (entry === undefined) {
      throw new KnowledgeStoreError(
        "KNOWLEDGE_NOT_FOUND",
        `Unknown knowledge id: ${id}`,
      );
    }
    return entry;
  }

  public entries(): KnowledgeEntry[] {
    return [...this.byId.values()];
  }

  public entriesOfType(type: KnowledgeType): KnowledgeEntry[] {
    return this.entries().filter((entry) => entry.type === type);
  }

  public index(entry: KnowledgeEntry): KnowledgeIndex {
    return {
      id: entry.id,
      type: entry.type,
      name: entry.name,
      one_line_use: entry.disclosure.L0.one_line_use,
      triggers: [...entry.triggers],
      scope: entry.scope,
      lifecycle: entry.lifecycle,
    };
  }

  public inspect(id: string, depth: DisclosureDepth): InspectedKnowledge {
    const entry = this.require(id);
    const content: Record<string, unknown> =
      depth === "L0"
        ? {
            id: entry.id,
            type: entry.type,
            name: entry.name,
            ...entry.disclosure.L0,
            triggers: entry.triggers,
            scope: entry.scope,
            lifecycle: entry.lifecycle,
          }
        : depth === "L1"
          ? { ...entry.disclosure.L1 }
          : depth === "L2"
            ? {
                ...entry.disclosure.L2,
                ...(entry.pattern_contract === undefined
                  ? {}
                  : { pattern_contract: entry.pattern_contract }),
              }
            : {
                ...entry.disclosure.L3,
                provenance: entry.provenance,
                validation: entry.validation,
              };

    return {
      id: entry.id,
      type: entry.type,
      name: entry.name,
      depth,
      content,
    };
  }
}

export async function loadBuiltInKnowledgeStore(): Promise<KnowledgeStore> {
  const filePath = fileURLToPath(new URL("../data/knowledge.yaml", import.meta.url));
  return KnowledgeStore.fromYamlFile(filePath);
}
