import type { ChangeKind, DesignMode, ExistingUnderstanding, IntentLite } from "./contracts.js";

export interface ImpactFinding {
  code: string;
  message: string;
  recommendedKind?: ChangeKind | DesignMode;
}

const STRUCTURAL_TOKENS = [
  "reorganize", "restructure", "rearrange", "redesign", "refactor", "rework",
  "navigation", "navigator", "sidebar", "inspector", "panel", "layout",
  "region", "information architecture", "split", "merge",
  "new page", "new surface", "new section", "add section",
  "重组", "重构", "重排", "重设计", "导航", "侧边栏", "检视面板", "信息架构",
  "布局", "区域", "拆分", "合并", "新增页面", "新增区域", "新增面板",
];

export function structuralTokensIn(text: string): string[] {
  const lower = text.toLowerCase();
  return STRUCTURAL_TOKENS.filter((token) => lower.includes(token));
}

export function classifyIntentImpact(
  intent: IntentLite,
  changeKind: ChangeKind,
  understanding?: ExistingUnderstanding | undefined,
): ImpactFinding[] {
  const findings: ImpactFinding[] = [];
  const isLight = changeKind === "visual_polish" || changeKind === "defect_fix";

  if (isLight) {
    const flagged = Object.entries(intent.impact)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
    if (flagged.length > 0) {
      const recommended: ChangeKind | DesignMode = intent.impact.changes_product_objects ? "rework" : "modify_surface";
      findings.push({
        code: "LIFECYCLE_KIND_MISMATCH",
        message: `Declared change_kind '${changeKind}' but impact declares ${flagged.join(", ")}; light paths cannot carry structural change. Restart the session as '${recommended}' referencing this one.`,
        recommendedKind: recommended,
      });
    }
    const structuralTokens = structuralTokensIn(intent.change);
    if (structuralTokens.length > 0) {
      findings.push({
        code: "LIFECYCLE_KIND_MISMATCH",
        message: `The change description contains structural vocabulary (${structuralTokens.join(", ")}) inconsistent with '${changeKind}'. If the structure really changes, restart as 'modify_surface'; otherwise rephrase to the concrete visual/defect scope.`,
        recommendedKind: "modify_surface",
      });
    }
  }

  if (understanding !== undefined && isLight) {
    const surfaces = new Set(understanding.current_surfaces.map((surface) => surface.id));
    const unknown = intent.surfaces.filter((surface) => !surfaces.has(surface));
    if (unknown.length > 0) {
      findings.push({
        code: "SURFACE_NOT_DECLARED",
        message: `intent_lite.surfaces reference surfaces absent from the existing understanding (${unknown.join(", ")}); new surfaces are add_surface work, not '${changeKind}'.`,
        recommendedKind: "add_surface",
      });
    }
  }

  return findings;
}
