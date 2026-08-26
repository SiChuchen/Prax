import type {
  CapabilityMap,
  DesignContext,
  DesignDecisions,
  ExistingUnderstanding,
  IntentLite,
  ProductFrame,
  RequirementConfirmation,
} from "prax-runtime";
import type { SdirDelta } from "prax-sdir";

export function requirementConfirmation(): RequirementConfirmation {
  return {
    version: "0.1",
    user_quote: ["把系统架构画成可交互的画布，选中节点能看到细节"],
    restatement: "工程师用户需要在保留全局上下文的前提下检视与追踪架构关系；成功标准是选中即聚焦、清除即还原。",
    boundaries: { in_scope: ["architecture canvas workspace"], out_of_scope: ["settings pages", "data explorer"] },
    open_questions: [],
    confirmed_with_user: true,
    confirmed_at: "2026-08-26T00:00:00.000Z",
  };
}

export function architectureUnderstanding(changeTargets: string[] = ["settings"]): ExistingUnderstanding {
  return {
    version: "0.1",
    current_objects: [
      { id: "architecture_node", user_name: "架构节点", purpose: "系统组成部分", evidence_refs: ["app/architecture"] },
      { id: "preference", user_name: "配置项", purpose: "改变产品行为", evidence_refs: ["app/settings"] },
    ],
    current_surfaces: [
      { id: "canvas", purpose: "架构画布", evidence_refs: ["app/architecture"] },
      { id: "settings", purpose: "配置", evidence_refs: ["app/settings"] },
    ],
    established_patterns: ["PAT-CANVAS-WORKSPACE"],
    user_habits: ["左侧导航切换"],
    constraints_and_debt: [],
    change_targets: changeTargets,
    actual_usage: [],
    pain_points: [],
    must_preserve: [],
    must_replace: [],
    free_to_reconsider: [],
    migration_notes: [],
    design_authorities: ["docs/DESIGN.md"],
  };
}

export function reworkUnderstanding(): ExistingUnderstanding {
  return {
    version: "0.1",
    current_objects: [{ id: "architecture_node", user_name: "架构节点", purpose: "系统组成部分", evidence_refs: ["app/architecture"] }],
    current_surfaces: [{ id: "canvas", purpose: "架构画布", evidence_refs: ["app/architecture"] }],
    established_patterns: [],
    user_habits: [],
    constraints_and_debt: [],
    change_targets: [],
    actual_usage: ["从画布进、逐节点排查关系"],
    pain_points: ["全局关系一屏太多，聚焦后丢失方位"],
    must_preserve: ["flow 数据", "canvas"],
    must_replace: ["architecture_node"],
    free_to_reconsider: [],
    migration_notes: ["旧入口保留一个月"],
    design_authorities: ["docs/DESIGN.md"],
  };
}

export function intentLite(kind: "visual_polish" | "defect_fix"): IntentLite {
  return {
    version: "0.1",
    kind,
    surfaces: ["login"],
    current_hierarchy_summary: "表单优先居中，错误内联",
    change: "字阶 token 降一级；间距 S2→S1",
    basis: "审查发现登录标题层级与全站不一致",
    evidence_refs: ["docs/DESIGN.md#typography"],
    regression_points: ["对比度", "焦点可见性", "键盘路径"],
  };
}

export function architectureProductFrame(): ProductFrame {
  return {
    user: { primary_role: "technical operator or engineer", expertise: "expert", familiarity: "high" },
    goal: { primary: "understand system architecture while preserving context" },
    tasks: { primary: "inspect architecture", secondary: ["trace relationship", "inspect entity", "follow flow"] },
    product_objects: [
      { id: "architecture_node", user_name: "architecture node", purpose: "represent a meaningful system part" },
      { id: "relationship", user_name: "relationship", purpose: "show how system parts interact" },
      { id: "flow", user_name: "flow", purpose: "trace movement through the system" },
      { id: "group", user_name: "group", purpose: "show a meaningful architecture boundary" },
    ],
    relationships: [
      { source: "architecture_node", target: "relationship", type: "connected_by" },
      { source: "flow", target: "architecture_node", type: "passes_through" },
    ],
    mental_model_hypothesis: {
      summary: "A spatial system map with contextual inspection",
      confidence: "high",
      evidence: ["user_requirement", "domain_convention"],
    },
    primary_success_definition: "User can locate, understand, and follow a relationship without losing global context",
    open_questions: [],
  };
}

export function architectureContext(): DesignContext {
  return {
    id: "architecture_canvas",
    user: { expertise: "expert", familiarity: "high" },
    task: { primary: "inspect_architecture", modes: ["inspect", "trace", "explore"], frequency: "high" },
    domain: { type: "software_architecture", entities: ["architecture_node", "relationship", "flow", "group"] },
    information: { volume: "high", relationship_complexity: "high", change_rate: "medium", comparison_need: "medium" },
    platform: { family: "web", form_factor: "desktop", input: ["pointer", "keyboard"], viewport: "large" },
    risk: { destructive_actions: "none", error_cost: "medium" },
    priorities: ["preserve global context", "trace relationships", "structured density"],
    density_intent: "compact",
    confidence: { overall: "high" },
    unknowns: [],
  };
}

export function settingsContext(): DesignContext {
  return {
    user: { expertise: "intermediate", familiarity: "medium" },
    task: { primary: "configure_preferences", modes: ["configure"], frequency: "low" },
    domain: { type: "settings", entities: ["preference", "account option"] },
    information: { volume: "medium", relationship_complexity: "low", change_rate: "low", comparison_need: "low" },
    platform: { family: "web", form_factor: "desktop", input: ["pointer", "keyboard"], viewport: "large" },
    risk: { destructive_actions: "low", error_cost: "medium" },
    priorities: ["find settings", "safe change"],
    density_intent: "regular",
    confidence: { overall: "high" },
    unknowns: [],
  };
}

export function architectureDecisions(sessionId: string): DesignDecisions {
  return {
    session_id: sessionId,
    primary_structure: {
      pattern: "PAT-CANVAS-WORKSPACE",
      rationale: ["relationships are first-class product objects", "selection must preserve global architecture context"],
      confidence: "high",
    },
    information_hierarchy: {
      primary: ["architecture"],
      secondary: ["navigation", "contextual_inspector", "toolbar"],
    },
    density: {
      intent: "compact",
      strategy: ["perceptual grouping", "stable alignment", "quiet supporting chrome"],
      avoid: ["card per entity", "decorative surfaces"],
    },
    major_choices: [
      {
        id: "inspector_behavior",
        choice: "selection_driven",
        rationale: "preserve workspace context while exposing detail",
        confidence: "high",
        references: ["architecture_node", "relationship"],
      },
    ],
    rejected: [
      { option: "PAT-DATA-EXPLORER", reason: "row comparison does not preserve spatial topology" },
      { option: "PAT-LIST-DETAIL", reason: "collection order is secondary to relationships" },
    ],
    unresolved: [],
  };
}

export function chineseArchitectureFrame(): ProductFrame {
  return {
    user: { primary_role: "工程师", expertise: "expert", familiarity: "high" },
    goal: { primary: "在保留全局上下文的同时理解系统架构" },
    tasks: { primary: "检视架构关系", secondary: ["追踪流程", "查看节点详情"] },
    product_objects: [
      { id: "architecture_node", user_name: "架构节点", purpose: "表示系统的一个组成部分" },
      { id: "relationship", user_name: "关系", purpose: "展示组成部分之间如何交互" },
      { id: "flow", user_name: "流程", purpose: "追踪数据在系统中的流转" },
    ],
    relationships: [
      { source: "architecture_node", target: "relationship", type: "connected_by" },
      { source: "flow", target: "architecture_node", type: "passes_through" },
    ],
    mental_model_hypothesis: {
      summary: "带上下文检视面板的空间系统地图",
      confidence: "high",
      evidence: ["user_requirement", "domain_convention"],
    },
    primary_success_definition: "用户能在不丢失全局上下文的情况下定位并追踪一条关系",
    open_questions: [],
  };
}

export function chineseArchitectureContext(): DesignContext {
  return {
    id: "architecture_canvas_cn",
    user: { expertise: "expert", familiarity: "high" },
    task: { primary: "检视架构", modes: ["检视", "追踪"], frequency: "high" },
    domain: { type: "软件架构", entities: ["架构节点", "关系", "流程"] },
    information: { volume: "high", relationship_complexity: "high", change_rate: "medium", comparison_need: "medium" },
    platform: { family: "web", form_factor: "desktop", input: ["pointer", "keyboard"], viewport: "large" },
    risk: { destructive_actions: "none", error_cost: "medium" },
    priorities: ["保留全局上下文", "追踪关系", "结构化密度"],
    density_intent: "compact",
    confidence: { overall: "high" },
    unknowns: [],
  };
}

export function dataExplorerDecisions(sessionId: string): DesignDecisions {
  return {
    session_id: sessionId,
    primary_structure: {
      pattern: "PAT-DATA-EXPLORER",
      rationale: ["comparing records is the primary task", "filtering narrows the collection before inspection"],
      confidence: "high",
    },
    information_hierarchy: { primary: ["data"], secondary: ["detail"] },
    density: { intent: "compact", strategy: ["aligned columns", "scannable rows"], avoid: ["card per record"] },
    major_choices: [],
    rejected: [],
    unresolved: [],
  };
}

export function settingsDecisions(sessionId: string): DesignDecisions {
  return {
    session_id: sessionId,
    primary_structure: {
      pattern: "PAT-SETTINGS-SECTIONS",
      rationale: ["preferences group by user goal", "each change needs explicit confirmation"],
      confidence: "high",
    },
    information_hierarchy: { primary: ["settings"], secondary: ["settings_navigation"] },
    density: { intent: "regular", strategy: ["goal-grouped sections", "quiet labels"], avoid: ["backend config order"] },
    major_choices: [],
    rejected: [],
    unresolved: [],
  };
}

export function architectureCapabilities(): CapabilityMap {
  return {
    needs: [
      {
        id: "load_architecture",
        product_action: "understand the system overview",
        required_experience: ["explicit loading", "meaningful empty and error states"],
        capabilities: ["GET /architecture"],
        status: "supported",
      },
      {
        id: "trace_relationship",
        product_action: "follow a relationship while preserving context",
        required_experience: ["adjacent relationship data", "selection remains stable"],
        capabilities: ["GET /architecture", "GET /relationships/:id"],
        status: "composable",
        resolution: { type: "frontend_composition", notes: "Join normalized relationship data in the client adapter." },
      },
    ],
  };
}


export function sdirDelta(): SdirDelta {
  return {
    version: "0.1",
    surface: "settings",
    base_regions: [
      { id: "settings_navigation", role: "primary_navigation", importance: "supporting" },
      { id: "settings", role: "configuration_sections", importance: "primary" },
    ],
    changes: [
      { region: "settings", action: "modify", fields: { importance: "dominant" }, rationale: "配置成为主要任务" },
      { region: "search", action: "add", role: "supporting_toolbar", fields: {}, rationale: "长列表需要检索" },
    ],
    preserved: ["settings_navigation"],
    regression_points: ["键盘路径", "保存态可见性"],
    capability_needs: [],
  };
}
