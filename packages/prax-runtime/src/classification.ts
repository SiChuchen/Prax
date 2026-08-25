import {
  CanonicalClassificationSchema,
  type CanonicalClassification,
  type DesignContext,
  type ProductFrame,
} from "./contracts.js";

interface Rule {
  id: string;
  tokens: string[];
}

const TASK_TYPE_RULES: Rule[] = [
  { id: "configure_preferences", tokens: ["configure", "configuration", "settings", "preferences", "配置", "设置", "偏好"] },
  { id: "compare_filter_records", tokens: ["compare", "filter", "rows", "columns", "logs", "比较", "筛选", "过滤", "表格", "日志"] },
  { id: "inspect_relationships", tokens: ["inspect", "architecture", "relationship", "canvas", "graph", "topology", "检视", "查看", "架构", "关系", "拓扑", "画布"] },
  { id: "trace_flow", tokens: ["trace", "follow", "追踪", "跟踪", "流程"] },
];

const DOMAIN_RULES: Rule[] = [
  { id: "preferences", tokens: ["settings", "preference", "设置", "偏好", "配置"] },
  { id: "data_exploration", tokens: ["data", "log", "record", "数据", "日志", "记录"] },
  { id: "software_architecture", tokens: ["architecture", "topology", "架构", "拓扑", "系统"] },
];

const INTERACTION_MODE_RULES: Rule[] = [
  { id: "canvas_with_contextual_inspector", tokens: ["canvas", "spatial", "graph", "topology", "architecture", "relationship", "画布", "拓扑", "架构", "关系"] },
  { id: "collection_with_contextual_detail", tokens: ["compare", "filter", "rows", "list", "table", "比较", "筛选", "列表", "表格"] },
  { id: "sections_with_navigation", tokens: ["settings", "sections", "设置", "配置", "偏好"] },
];

function matchRule(
  rules: Rule[],
  text: string,
  field: string,
  source: string,
  evidence: string[],
  openQuestions: string[],
): string {
  for (const rule of rules) {
    const token = rule.tokens.find((candidate) => text.includes(candidate.toLowerCase()));
    if (token !== undefined) {
      evidence.push(`${field}=${rule.id} ← token '${token}' in ${source}`);
      return rule.id;
    }
  }
  openQuestions.push(`${field} could not be classified from the provided context; refine the context fields or record a custom classification`);
  return "unknown";
}

function classifyProductType(domainId: string, frame: ProductFrame, context: DesignContext, evidence: string[]): string {
  if (domainId === "software_architecture" || domainId === "data_exploration") {
    if (frame.user.expertise === "expert" || context.user.expertise === "expert") {
      evidence.push("product_type=internal_engineering_tool ← expert user in an engineering domain");
      return "internal_engineering_tool";
    }
  }
  if (domainId === "preferences") {
    evidence.push("product_type=configuration_surface ← preferences domain");
    return "configuration_surface";
  }
  return "unknown";
}

function classifyObjects(frame: ProductFrame, domainText: string): { primary: string; secondary: string[] } {
  const referenceCounts = new Map<string, number>();
  for (const relationship of frame.relationships) {
    for (const endpoint of [relationship.source, relationship.target]) {
      referenceCounts.set(endpoint, (referenceCounts.get(endpoint) ?? 0) + 1);
    }
  }
  const objects = [...frame.product_objects];
  objects.sort((left, right) => {
    const byReferences = (referenceCounts.get(right.id) ?? 0) - (referenceCounts.get(left.id) ?? 0);
    if (byReferences !== 0) return byReferences;
    const leftInDomain = domainText.includes(left.id.toLowerCase()) ? 0 : 1;
    const rightInDomain = domainText.includes(right.id.toLowerCase()) ? 0 : 1;
    return leftInDomain - rightInDomain;
  });
  return { primary: objects[0]!.id, secondary: objects.slice(1).map((object) => object.id) };
}

export function classifyDesignContext(frame: ProductFrame, context: DesignContext): CanonicalClassification {
  const taskText = [
    context.task.primary,
    ...context.task.modes,
    frame.tasks.primary,
    ...frame.tasks.secondary,
  ].join(" ").toLowerCase();
  const domainText = [context.domain.type, ...context.domain.entities].join(" ").toLowerCase();
  const modeText = [taskText, ...context.priorities].join(" ").toLowerCase();

  const evidence: string[] = [];
  const openQuestions: string[] = [];

  const taskType = matchRule(TASK_TYPE_RULES, taskText, "task_type", "context.task and frame.tasks", evidence, openQuestions);
  const domainId = matchRule(DOMAIN_RULES, domainText, "domain_id", "context.domain", evidence, openQuestions);
  const interactionMode = matchRule(
    INTERACTION_MODE_RULES,
    modeText,
    "interaction_mode",
    "context.task, frame.tasks, and context.priorities",
    evidence,
    openQuestions,
  );
  const productType = classifyProductType(domainId, frame, context, evidence);
  const objects = classifyObjects(frame, domainText);
  if (productType === "unknown") {
    openQuestions.push("product_type could not be derived; record the intended audience and product kind");
  }
  evidence.push(`primary_object_type=${objects.primary} ← most referenced product object in the Product Frame`);

  const unknownCount = [taskType, domainId, interactionMode].filter((id) => id === "unknown").length;
  const confidence = unknownCount === 0 ? "high" : unknownCount === 1 ? "medium" : "low";

  return CanonicalClassificationSchema.parse({
    version: "1",
    task_type: taskType,
    domain_id: domainId,
    interaction_mode: interactionMode,
    product_type: productType,
    primary_object_type: objects.primary,
    secondary_object_types: objects.secondary,
    confidence,
    evidence,
    open_questions: openQuestions,
  });
}
