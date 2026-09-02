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

/**
 * Default-shell detection vocabulary (spec §6.3). The four negative-knowledge
 * terms are composition/disclosure/detail mechanisms, not representation
 * primitives — only `cards` can appear in representation.primary.type, so
 * detection must also scan decision free text (with fixed CJK synonyms).
 */
export const SHELL_TERMS = {
  terms: ["dashboard", "cards", "tabs", "modal"],
  synonyms: ["仪表盘", "卡片", "标签页", "模态"],
} as const;

/**
 * Decide-time myth surfacing map (spec §7.3): which quarantined myth a
 * triggered shell term should surface in the REVIEW message. Tabs and modal
 * share the disclosure myth (§12 mutual tabs force working-memory comparison;
 * §10/§52-Q9 detail surfaces derive from context retention).
 */
export const SHELL_MYTH_MAP = {
  dashboard: "myth-dashboard-default-home",
  cards: "myth-card-grid-default",
  tabs: "myth-more-disclosure-better",
  modal: "myth-more-disclosure-better",
} as const;
