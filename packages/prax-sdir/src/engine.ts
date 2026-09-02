import type { DesignContext, DesignDecisions, ProductFrame } from "prax-runtime";
import { zodIssues } from "prax-runtime";
import { SdirSchema, type Sdir, type SdirIssue, type SdirValidation } from "./contracts.js";
import { patternSurfaceContract } from "./surfaces.js";

export const FORBIDDEN_KEY = /(^|_)(width|height|padding|margin|display|grid|flex|color|font|radius|shadow|css|class|classname|component|framework|tailwind|pixel|px)($|_)/i;
export const FORBIDDEN_VALUE = /(\d+(?:\.\d+)?px\b|display\s*:\s*(?:flex|grid)|grid-template|rounded-(?:sm|md|lg|xl)|(?:Radix|Vue|React|Compose)[A-Z]\w*)/i;
const KNOWN_ROLES = new Set([
  "dominant_workspace",
  "contextual_inspector",
  "primary_navigation",
  "supporting_toolbar",
  "collection",
  "detail",
  "configuration_sections",
]);
const KNOWN_INTENTS = new Set([
  "hierarchical_flow",
  "spatial_overview",
  "comparison_group",
  "selection_driven",
  "direct_selection",
  "pan_zoom",
  "progressive_inspection",
  "filter_then_inspect",
  "preserve_context",
  "keyboard_equivalent",
]);

export function renderLeakIssues(value: unknown, path = "sdir"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => renderLeakIssues(item, `${path}.${index}`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [
      ...(FORBIDDEN_KEY.test(key) ? [`${path}.${key}: render-level key is forbidden in SDIR`] : []),
      ...renderLeakIssues(child, `${path}.${key}`),
    ]);
  }
  return typeof value === "string" && FORBIDDEN_VALUE.test(value)
    ? [`${path}: render-level value '${value}' is forbidden in SDIR`]
    : [];
}

function experimentalVocabularyIssues(sdir: Sdir): string[] {
  const values = [
    ...sdir.screen.regions.map((region) => region.role),
    ...sdir.screen.regions.flatMap((region) => region.behavior_intent),
    ...sdir.screen.interaction_intents,
  ];
  return values
    .filter(
      (value) =>
        !KNOWN_ROLES.has(value) &&
        !KNOWN_INTENTS.has(value) &&
        !value.startsWith("experimental:"),
    )
    .map((value) => `Unknown semantic vocabulary '${value}' must be marked experimental:.`);
}

function regionsForPattern(pattern: string): Sdir["screen"]["regions"] {
  if (pattern === "PAT-CANVAS-WORKSPACE") {
    return [
      { id: "navigation", role: "primary_navigation", importance: "supporting", visibility: { condition: "always" }, behavior_intent: ["preserve_context"] },
      { id: "architecture", role: "dominant_workspace", importance: "dominant", visibility: { condition: "always" }, behavior_intent: ["spatial_overview", "direct_selection", "pan_zoom"] },
      { id: "toolbar", role: "supporting_toolbar", importance: "supporting", visibility: { condition: "task_driven" }, behavior_intent: ["keyboard_equivalent"] },
      { id: "inspector", role: "contextual_inspector", importance: "contextual", visibility: { condition: "selection_driven" }, behavior_intent: ["selection_driven", "progressive_inspection"] },
    ];
  }
  if (pattern === "PAT-DATA-EXPLORER") {
    return [
      { id: "data", role: "collection", importance: "dominant", visibility: { condition: "always" }, behavior_intent: ["comparison_group", "filter_then_inspect"] },
      { id: "detail", role: "contextual_inspector", importance: "contextual", visibility: { condition: "selection_driven" }, behavior_intent: ["selection_driven"] },
    ];
  }
  if (pattern === "PAT-SETTINGS-SECTIONS") {
    return [
      { id: "settings_navigation", role: "primary_navigation", importance: "supporting", visibility: { condition: "always" }, behavior_intent: ["preserve_context"] },
      { id: "settings", role: "configuration_sections", importance: "primary", visibility: { condition: "always" }, behavior_intent: ["hierarchical_flow"] },
    ];
  }
  return [
    { id: "workspace", role: "dominant_workspace", importance: "dominant", visibility: { condition: "always" }, behavior_intent: ["preserve_context"] },
  ];
}

type SdirRegion = Sdir["screen"]["regions"][number];

function matchesSurface(region: SdirRegion, surface: string): boolean {
  return region.id === surface || region.role === surface;
}

function applyHierarchy(
  skeleton: SdirRegion[],
  decisions: DesignDecisions,
  contract: ReturnType<typeof patternSurfaceContract>,
): SdirRegion[] {
  const primary = decisions.information_hierarchy.primary;
  const secondary = decisions.information_hierarchy.secondary;
  const ordered: SdirRegion[] = [];
  const used = new Set<string>();

  const withImportance = (region: SdirRegion, isPrimary: boolean): SdirRegion => {
    if (region.role === "contextual_inspector") return region;
    if (isPrimary) {
      const isDominant = contract?.dominant.includes(region.id) === true || contract?.dominant.includes(region.role) === true;
      return { ...region, importance: isDominant ? "dominant" : "primary" };
    }
    return { ...region, importance: "supporting" };
  };

  for (const surface of [...primary, ...secondary]) {
    const region = skeleton.find((candidate) => !used.has(candidate.id) && matchesSurface(candidate, surface));
    if (region !== undefined) {
      used.add(region.id);
      ordered.push(withImportance(region, primary.includes(surface)));
    } else {
      ordered.push({
        id: surface,
        role: `experimental:${surface}`,
        importance: primary.includes(surface) ? "primary" : "supporting",
        visibility: { condition: "always" },
        behavior_intent: [],
      });
    }
  }
  for (const region of skeleton) {
    if (!used.has(region.id)) ordered.push(region);
  }
  return ordered;
}

function inspectorChoice(decisions: DesignDecisions, inspector: SdirRegion | undefined) {
  if (inspector === undefined) return undefined;
  return decisions.major_choices.find((choice) =>
    choice.references.some((reference) => reference === inspector.id || reference === inspector.role),
  );
}

export class SdirEngine {
  public generate(frame: ProductFrame, context: DesignContext, decisions: DesignDecisions): Sdir {
    const pattern = decisions.primary_structure.pattern;
    const contract = patternSurfaceContract(pattern);
    let regions = applyHierarchy(regionsForPattern(pattern), decisions, contract);
    const inspector = regions.find((region) => region.role === "contextual_inspector");
    const choice = inspectorChoice(decisions, inspector);
    const persistentInspector = choice?.choice === "always_visible";
    if (inspector !== undefined && persistentInspector) {
      regions = regions.map((region) =>
        region.id === inspector.id ? { ...region, visibility: { condition: "always" } } : region,
      );
    }
    const primarySurface = regions.find(
      (region) => region.role === "dominant_workspace" || region.role === "collection",
    );
    const relationships =
      inspector !== undefined && primarySurface !== undefined && primarySurface.id !== inspector.id
        ? [
            {
              id: `region_rel_${primarySurface.id}_${inspector.id}`,
              source: primarySurface.id,
              target: inspector.id,
              type: persistentInspector ? "persistent_side_by_side" : "selection_drives_contextual_detail",
            },
          ]
        : [];
    let openCounter = 0;
    const unresolved = decisions.unresolved.map((unknown) =>
      typeof unknown === "string"
        ? { id: `open_${(openCounter += 1)}`, question: unknown, impact: "medium" as const, affects: [] }
        : { id: unknown.id, question: unknown.id, impact: unknown.impact, affects: unknown.affects },
    );
    return SdirSchema.parse({
      version: "0.1",
      screen: {
        id: `${pattern.toLowerCase().replaceAll("pat-", "").replaceAll("-", "_")}_screen`,
        intent: {
          primary_task: frame.tasks.primary,
          secondary_tasks: frame.tasks.secondary,
        },
        archetype: { pattern_ref: pattern },
        density_intent: context.density_intent,
        regions,
        relationships,
        interaction_intents:
          pattern === "PAT-CANVAS-WORKSPACE"
            ? ["spatial_overview", "direct_selection", "pan_zoom", "progressive_inspection", "keyboard_equivalent"]
            : ["preserve_context", "keyboard_equivalent"],
        required_states: ["loading", "empty", "ready", "selected", "error"],
        decision_points: [
          {
            id: "region_realization",
            question: "How should the platform adapter realize the semantic regions while preserving hierarchy?",
            adapter_may_choose: ["native landmarks", "accessible composite widgets", "responsive region arrangement"],
          },
        ],
        unresolved,
        rejected_alternatives: decisions.rejected.map((rejected) => ({
          option: rejected.option,
          reason: rejected.reason,
        })),
      },
    });
  }

  public validate(input: unknown, decisions?: DesignDecisions): SdirValidation {
    const schemaResult = SdirSchema.safeParse(input);
    const schemaErrors = schemaResult.success ? [] : zodIssues(schemaResult.error);
    const issues: SdirIssue[] = renderLeakIssues(input).map((message) => ({
      code: "SDIR_RENDER_LEVEL_LEAK",
      message,
    }));
    const warnings: string[] = [];

    if (schemaResult.success) {
      const sdir = schemaResult.data;
      issues.push(
        ...experimentalVocabularyIssues(sdir).map((message) => ({
          code: "SDIR_UNKNOWN_VOCABULARY",
          message,
        })),
      );
      const stateSet = new Set(sdir.screen.required_states);
      for (const required of ["loading", "empty", "ready", "error"] as const) {
        if (!stateSet.has(required)) {
          issues.push({ code: "SDIR_STATE_MISSING", message: `required_states must include ${required}.` });
        }
      }
      const patternRef = sdir.screen.archetype?.pattern_ref;
      if (decisions !== undefined && patternRef !== undefined && patternRef !== decisions.primary_structure.pattern) {
        issues.push({
          code: "SDIR_PATTERN_MISMATCH",
          message: "SDIR pattern_ref must match the approved primary structure decision.",
        });
      }
      if (patternRef === "PAT-CANVAS-WORKSPACE" && !stateSet.has("selected")) {
        issues.push({ code: "SDIR_STATE_MISSING", message: "Canvas Workspace requires a selected state." });
      }
      issues.push(...referentialIssues(sdir));
    }

    const semanticErrors = issues.map((issue) => issue.message);
    if (!schemaResult.success || issues.length > 0) {
      return { status: "RETRY", schema_errors: schemaErrors, semantic_errors: semanticErrors, semantic_issues: issues, warnings };
    }
    return { status: "PASS", schema_errors: [], semantic_errors: [], semantic_issues: [], warnings, value: schemaResult.data };
  }
}

function referentialIssues(sdir: Sdir): SdirIssue[] {
  const issues: SdirIssue[] = [];
  const declared = new Set<string>();
  const duplicates = new Set<string>();
  for (const region of sdir.screen.regions) {
    if (declared.has(region.id)) duplicates.add(region.id);
    declared.add(region.id);
  }
  for (const id of duplicates) {
    issues.push({
      code: "SDIR_REGION_ID_DUPLICATE",
      message: `Region id '${id}' is declared more than once; region ids must be unique.`,
    });
  }
  sdir.screen.relationships.forEach((relationship, index) => {
    if (!declared.has(relationship.source)) {
      issues.push({
        code: "SDIR_RELATION_REGION_NOT_FOUND",
        message: `relationships[${index}].source '${relationship.source}' does not reference a declared region id.`,
      });
    }
    if (!declared.has(relationship.target)) {
      issues.push({
        code: "SDIR_RELATION_REGION_NOT_FOUND",
        message: `relationships[${index}].target '${relationship.target}' does not reference a declared region id.`,
      });
    }
    if (relationship.source === relationship.target) {
      issues.push({
        code: "SDIR_RELATION_SELF_LOOP",
        message: `relationships[${index}] links region '${relationship.source}' to itself; relationships must connect distinct regions.`,
      });
    }
  });
  const relationshipIdCounts = new Map<string, number>();
  for (const relationship of sdir.screen.relationships) {
    if (relationship.id !== undefined) {
      relationshipIdCounts.set(relationship.id, (relationshipIdCounts.get(relationship.id) ?? 0) + 1);
    }
  }
  for (const [id, count] of relationshipIdCounts) {
    if (count > 1) {
      issues.push({
        code: "SDIR_RELATION_ID_DUPLICATE",
        message: `Relationship id '${id}' is declared ${count} times; relationship ids must be unique.`,
      });
    }
  }
  return issues;
}
