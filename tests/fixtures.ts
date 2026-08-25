import type {
  CapabilityMap,
  DesignContext,
  DesignDecisions,
  ProductFrame,
} from "prax-runtime";

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

