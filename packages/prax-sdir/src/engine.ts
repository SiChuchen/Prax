import type { DesignContext, DesignDecisions, ProductFrame } from "prax-runtime";
import { zodIssues } from "prax-runtime";
import { SdirSchema, type Sdir, type SdirValidation } from "./contracts.js";

const FORBIDDEN_KEY = /(^|_)(width|height|padding|margin|display|grid|flex|color|font|radius|shadow|css|class|classname|component|framework|tailwind|pixel|px)($|_)/i;
const FORBIDDEN_VALUE = /(\d+(?:\.\d+)?px\b|display\s*:\s*(?:flex|grid)|grid-template|rounded-(?:sm|md|lg|xl)|(?:Radix|Vue|React|Compose)[A-Z]\w*)/i;
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

function renderLeakIssues(value: unknown, path = "sdir"): string[] {
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

export class SdirEngine {
  public generate(frame: ProductFrame, context: DesignContext, decisions: DesignDecisions): Sdir {
    const regions = regionsForPattern(decisions.primary_structure.pattern);
    const hasInspector = regions.some((region) => region.id === "inspector" || region.id === "detail");
    return SdirSchema.parse({
      version: "0.1",
      screen: {
        id: `${decisions.primary_structure.pattern.toLowerCase().replaceAll("pat-", "").replaceAll("-", "_")}_screen`,
        intent: {
          primary_task: frame.tasks.primary,
          secondary_tasks: frame.tasks.secondary,
        },
        archetype: { pattern_ref: decisions.primary_structure.pattern },
        density_intent: context.density_intent,
        regions,
        relationships: hasInspector
          ? [{ source: "architecture", target: regions.some((region) => region.id === "inspector") ? "inspector" : "detail", type: "selection_drives_contextual_detail" }]
          : [],
        interaction_intents:
          decisions.primary_structure.pattern === "PAT-CANVAS-WORKSPACE"
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
      },
    });
  }

  public validate(input: unknown, decisions?: DesignDecisions): SdirValidation {
    const schemaResult = SdirSchema.safeParse(input);
    const schemaErrors = schemaResult.success ? [] : zodIssues(schemaResult.error);
    const semanticErrors = renderLeakIssues(input);
    const warnings: string[] = [];

    if (schemaResult.success) {
      semanticErrors.push(...experimentalVocabularyIssues(schemaResult.data));
      const stateSet = new Set(schemaResult.data.screen.required_states);
      for (const required of ["loading", "empty", "ready", "error"] as const) {
        if (!stateSet.has(required)) semanticErrors.push(`required_states must include ${required}.`);
      }
      if (
        decisions !== undefined &&
        schemaResult.data.screen.archetype.pattern_ref !== decisions.primary_structure.pattern
      ) {
        semanticErrors.push("SDIR pattern_ref must match the approved primary structure decision.");
      }
      if (
        schemaResult.data.screen.archetype.pattern_ref === "PAT-CANVAS-WORKSPACE" &&
        !stateSet.has("selected")
      ) {
        semanticErrors.push("Canvas Workspace requires a selected state.");
      }
    }

    if (!schemaResult.success || semanticErrors.length > 0) {
      return { status: "RETRY", schema_errors: schemaErrors, semantic_errors: semanticErrors, warnings };
    }
    return { status: "PASS", schema_errors: [], semantic_errors: [], warnings, value: schemaResult.data };
  }
}
