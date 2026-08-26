import type { ChangeKind, DesignMode, ExistingUnderstanding, IntentLite } from "./contracts.js";

export interface ImpactFinding {
  code: string;
  message: string;
  recommendedKind?: ChangeKind | DesignMode;
}

const STRUCTURAL_ACTIONS = [
  "reorganize", "restructure", "rearrange", "refactor", "redesign", "split",
  "merge", "move", "replace", "remove", "add", "create", "introduce", "convert", "turn",
  "重组", "重构", "重排", "拆分", "合并", "移到", "移入", "替换", "新增", "创建", "引入", "转成", "改成",
];

const STRUCTURAL_OBJECTS = [
  "navigation", "navigator", "sidebar", "inspector", "panel", "layout",
  "region", "hierarchy", "information architecture", "section", "page",
  "surface", "header", "tabs", "tree",
  "导航", "侧边栏", "检视面板", "面板", "布局", "区域", "层级", "信息架构",
  "分区", "页面", "顶栏", "标签页", "树",
];

function hasToken(text: string, token: string): boolean {
  return new RegExp(`(^|[^a-z])${token}([^a-z]|$)`, "i").test(text) || text.includes(token);
}

export function structuralCombinationIn(text: string): { actions: string[]; objects: string[] } | undefined {
  const lower = text.toLowerCase();
  const actions = STRUCTURAL_ACTIONS.filter((token) => hasToken(lower, token));
  const objects = STRUCTURAL_OBJECTS.filter((token) => hasToken(lower, token));
  if (actions.length > 0 && objects.length > 0) {
    return { actions, objects };
  }
  return undefined;
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
    const combination = structuralCombinationIn(`${intent.change} ${intent.basis}`);
    if (combination !== undefined) {
      findings.push({
        code: "LIFECYCLE_KIND_MISMATCH",
        message: `The change description pairs structural actions (${combination.actions.join(", ")}) with structural objects (${combination.objects.join(", ")}), which is inconsistent with '${changeKind}'. If the structure really changes, restart as 'modify_surface'; otherwise rephrase to the concrete visual/defect scope.`,
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
