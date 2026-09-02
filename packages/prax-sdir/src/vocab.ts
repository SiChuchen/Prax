/**
 * SDIR vocabulary tables (spec §6.1). Versioned constants following the
 * REALIZATION_PROVIDERS precedent: vocabulary evolution = version bump +
 * spec revision, and every admission must pass the non-visual modality test
 * (boundary-guard governance, hard rail 8).
 *
 * First amendments recorded at v2026-09 (research document's own §36/§43
 * examples used them before the tables caught up):
 * - jtbd verb `understand` (→ 19 verbs)
 * - representation primitive `architecture` (→ 22 primitives)
 */
export const SDIR_VOCAB = {
  version: "2026-09",
  jtbd_verbs: [
    "scan",
    "locate",
    "navigate",
    "compare",
    "monitor",
    "create",
    "edit",
    "manage",
    "decide",
    "transact",
    "communicate",
    "explore",
    "learn",
    "explain",
    "understand",
    "control",
    "troubleshoot",
    "complete",
    "review",
  ],
  object_types: [
    "document",
    "item",
    "entity",
    "record",
    "event",
    "metric",
    "location",
    "relationship",
    "timeline",
    "media",
    "workflow",
    "conversation",
    "code",
    "canvas_object",
    "dataset",
    "change_set",
  ],
  representation_primitives: [
    "list",
    "table",
    "grid",
    "cards",
    "document",
    "feed",
    "thread",
    "chart",
    "map",
    "timeline",
    "calendar",
    "graph",
    "tree",
    "canvas",
    "diagram",
    "architecture",
    "media",
    "form",
    "wizard",
    "search_results",
    "code_editor",
    "chat",
  ],
} as const;

export const JTBD_VERBS = SDIR_VOCAB.jtbd_verbs;
export const OBJECT_TYPES = SDIR_VOCAB.object_types;
export const REPRESENTATION_PRIMITIVES = SDIR_VOCAB.representation_primitives;
