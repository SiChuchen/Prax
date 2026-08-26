# 模式分化生命周期（Mode-Differentiated Lifecycle）实施计划 v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `design_start` 的 mode/change_kind 真正分化生命周期深度：三模式 × 变更类型 × 外部设计权威，新增需求确认与存量理解门禁，SDIR 增量形态，执行计划与验证按模式装配。

**Architecture:** 状态机从硬编码升级为策略表驱动（`lifecycle-policy.ts` + `errors.ts`）；会话持久化策略快照与设计权威；旧会话经 gate 别名规范化后零行为变化；新门禁复用现有十个工具（design_start 判别 union、design_frame 按 gate 分发载荷、design_sdir 携带 delta）。

**Tech Stack:** TypeScript monorepo、zod、vitest、yaml。规格：`docs/superpowers/specs/2026-08-26-mode-differentiated-lifecycle-design.md`。

**v2 修订（响应 Codex 审查 20 项发现）：** ① PraxRuntimeError 抽到 `errors.ts` 避免循环导入；② DesignOperation 保留在 state-machine 本地；③ design_start 改判别 union；④ 旧会话 gate 名别名规范化（frame→framing 等）+ 恢复测试；⑤ modify 派生 frame/context 以真实 artifact 持久化（带 provenance 记录）；⑥ 验证器按路径 union 化（pattern_ref 可选、轻路径无 sdir 依赖）；⑦ delta 引用规则完整实现（base∪adds、重复 add、preserved、递归 render-leak）；⑧ prepare 仅在策略含 reconcile 时读 capability；⑨ 轻路径 brief 改在意图门禁提交时生成；⑩ P3 只读 SDIR 回验精确守卫；⑪ 按需 reconcile 通过 `capability_needs` + 动态插入 gate 建模；⑫ out_of_scope 空值由 validator 判 EXPAND（schema 放开 min）；⑬ rework 覆盖校验（三桶覆盖 inventory）；⑭ design_authorities 持久化到 session 并供验证使用；⑮ rework 门禁按规格去掉 reconcile（记录为对 v1 的再修正）；⑯ restatement 一致性与 frame↔理解对应以 assistive 检查落地；⑰ 派生路由输入的未知字段显式用 "unknown"；⑱ fixtures 用 z.input 类型并补全字段；⑲ 每个任务给出 import 变更清单；⑳ "零行为变化"仅指已持久化旧会话——新 design_start 调用行为有意变化。

**约定：** 命令在 `E:\codex-prj\Prax\Prax` 执行；每任务收尾 `npm test` 必须全绿（当前基线 38 测试）再提交；TDD 先红后绿。

---

### Task 1: errors.ts 抽取 + 生命周期策略表

**Files:**
- Create: `packages/prax-runtime/src/errors.ts`（PraxRuntimeError 从 artifact-store 移出）
- Modify: `packages/prax-runtime/src/artifact-store.ts`（改为从 errors.ts 导入并 re-export 保持兼容）
- Modify: `packages/prax-runtime/src/contracts.ts`（DesignMode+rework、ChangeKind、GateName、LifecyclePolicy、DesignPhase+3 值）
- Create: `packages/prax-runtime/src/lifecycle-policy.ts`
- Modify: `packages/prax-runtime/src/index.ts`（追加 `export * from "./errors.js"; export * from "./lifecycle-policy.js";`）
- Test: `tests/lifecycle-policy.test.ts`

- [ ] **Step 1: 抽取 errors.ts（纯移动，无行为变化）**

把 artifact-store.ts 中的 `PraxRuntimeError` 类剪切到新文件 `errors.ts`；artifact-store.ts 顶部 `import { PraxRuntimeError } from "./errors.js";` 并删除本地定义（其他包经 prax-runtime 入口的既有导入不受影响——index.ts 已 `export * from "./artifact-store.js"`，改为从 errors 导出后路径不变）。运行 `npm test` 确认 38 全绿。提交 `refactor(runtime): extract PraxRuntimeError to errors.ts`。

- [ ] **Step 2: 写失败测试**

```ts
// tests/lifecycle-policy.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_LEGACY_POLICY, GATE_PHASE, NEXT_TOOL_BY_GATE, PraxRuntimeError, lifecyclePolicyFor, normalizeCompletedGates } from "prax-runtime";

const FULL_TAIL = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];
const REWORK_TAIL = ["context", "route", "decide", "sdir", "prepare", "validate"]; // 无 reconcile（规格 §5）

describe("lifecycle policy", () => {
  it("expands each supported mode and change kind into its gate sequence", () => {
    expect(lifecyclePolicyFor("greenfield").gates).toEqual(["confirm", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("rework").gates).toEqual(["confirm", "understanding", "framing", ...REWORK_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "add_surface").gates).toEqual(["confirm", "understanding", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "modify_surface").gates).toEqual(["confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate"]);
    expect(lifecyclePolicyFor("existing_product", "visual_polish").gates).toEqual(["confirm", "intent_lite", "validate"]);
    expect(lifecyclePolicyFor("existing_product", "defect_fix").gates).toEqual(["confirm", "intent_lite", "validate"]);
  });

  it("rejects invalid combinations and preserves a rework change_kind hint", () => {
    expect(() => lifecyclePolicyFor("greenfield", "defect_fix")).toThrowError(PraxRuntimeError);
    expect(() => lifecyclePolicyFor("existing_product")).toThrowError(PraxRuntimeError);
    const rework = lifecyclePolicyFor("rework", "modify_surface");
    expect(rework.gates).toEqual(["confirm", "understanding", "framing", ...REWORK_TAIL]);
    expect(rework.change_kind).toBe("modify_surface");
  });

  it("keeps the legacy default policy equivalent to the old flow", () => {
    expect(DEFAULT_LEGACY_POLICY.gates).toEqual(["framing", ...FULL_TAIL]);
  });

  it("maps every gate to a phase and a next tool", () => {
    expect(GATE_PHASE.confirm).toBe("REQUIREMENT_CONFIRMATION");
    expect(GATE_PHASE.understanding).toBe("UNDERSTANDING");
    expect(GATE_PHASE.intent_lite).toBe("INTENT_LITE");
    expect(GATE_PHASE.sdir_delta).toBe("SDIR");
    for (const gate of DEFAULT_LEGACY_POLICY.gates) {
      expect(GATE_PHASE[gate]).toBeDefined();
      expect(NEXT_TOOL_BY_GATE[gate]).toBeDefined();
    }
  });

  it("normalizes legacy gate names recorded by the old state machine", () => {
    expect(normalizeCompletedGates(["frame", "context", "route", "decide", "sdir", "reconcile", "prepare_implementation", "validation"]))
      .toEqual(["framing", "context", "route", "decide", "sdir", "reconcile", "prepare", "validate"]);
    expect(normalizeCompletedGates(["framing", "validate"])).toEqual(["framing", "validate"]);
  });
});
```

- [ ] **Step 3: 运行确认失败**（模块不存在）。

- [ ] **Step 4: 实现**

`contracts.ts`：`DesignModeSchema` 改 `z.enum(["greenfield", "existing_product", "rework"])`；`DesignPhaseSchema` 追加 `"REQUIREMENT_CONFIRMATION", "UNDERSTANDING", "INTENT_LITE"`；追加：

```ts
export const ChangeKindSchema = z.enum(["add_surface", "modify_surface", "visual_polish", "defect_fix"]);
export type ChangeKind = z.infer<typeof ChangeKindSchema>;

export const GateNameSchema = z.enum([
  "confirm", "understanding", "framing", "intent_lite", "context",
  "route", "decide", "sdir", "sdir_delta", "reconcile", "prepare", "validate",
]);
export type GateName = z.infer<typeof GateNameSchema>;

export const LifecyclePolicySchema = z.object({
  version: z.literal("1"),
  mode: DesignModeSchema,
  change_kind: ChangeKindSchema.optional(),
  gates: z.array(GateNameSchema).min(1),
});
export type LifecyclePolicy = z.infer<typeof LifecyclePolicySchema>;
```

```ts
// packages/prax-runtime/src/lifecycle-policy.ts
import type { ChangeKind, DesignMode, DesignPhase, GateName, LifecyclePolicy } from "./contracts.js";
import { PraxRuntimeError } from "./errors.js";

const FULL_TAIL: GateName[] = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];
const REWORK_TAIL: GateName[] = ["context", "route", "decide", "sdir", "prepare", "validate"];

export const DEFAULT_LEGACY_POLICY: LifecyclePolicy = {
  version: "1",
  mode: "greenfield",
  gates: ["framing", ...FULL_TAIL],
};

export const GATE_PHASE: Record<GateName, DesignPhase> = {
  confirm: "REQUIREMENT_CONFIRMATION",
  understanding: "UNDERSTANDING",
  framing: "PRODUCT_FRAMING",
  intent_lite: "INTENT_LITE",
  context: "CONTEXT",
  route: "ROUTING",
  decide: "DECISION",
  sdir: "SDIR",
  sdir_delta: "SDIR",
  reconcile: "CAPABILITY_RECONCILIATION",
  prepare: "IMPLEMENTATION_READY",
  validate: "VALIDATION",
};

export const NEXT_TOOL_BY_GATE: Record<GateName, string> = {
  confirm: "design_start",
  understanding: "design_frame",
  framing: "design_frame",
  intent_lite: "design_frame",
  context: "design_context",
  route: "design_route",
  decide: "design_inspect",
  sdir: "design_sdir",
  sdir_delta: "design_sdir",
  reconcile: "design_reconcile",
  prepare: "design_prepare_implementation",
  validate: "design_validate",
};

const LEGACY_GATE_ALIASES: Record<string, GateName> = {
  frame: "framing",
  prepare_implementation: "prepare",
  validation: "validate",
};

export function normalizeCompletedGates(completed: readonly string[]): GateName[] {
  return completed.map((gate) => LEGACY_GATE_ALIASES[gate] ?? (gate as GateName));
}

export function lifecyclePolicyFor(mode: DesignMode, changeKind?: ChangeKind): LifecyclePolicy {
  if (mode === "greenfield") {
    if (changeKind !== undefined) {
      throw new PraxRuntimeError("UNKNOWN_LIFECYCLE_POLICY", `change_kind ${changeKind} is not valid for greenfield sessions.`);
    }
    return { version: "1", mode, gates: ["confirm", "framing", ...FULL_TAIL] };
  }
  if (mode === "existing_product") {
    if (changeKind === undefined) {
      throw new PraxRuntimeError("UNKNOWN_LIFECYCLE_POLICY", "existing_product sessions require change_kind (add_surface | modify_surface | visual_polish | defect_fix).");
    }
    const gatesByKind: Record<ChangeKind, GateName[]> = {
      add_surface: ["confirm", "understanding", "framing", ...FULL_TAIL],
      modify_surface: ["confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate"],
      visual_polish: ["confirm", "intent_lite", "validate"],
      defect_fix: ["confirm", "intent_lite", "validate"],
    };
    return { version: "1", mode, change_kind: changeKind, gates: gatesByKind[changeKind] };
  }
  return {
    version: "1",
    mode,
    ...(changeKind === undefined ? {} : { change_kind: changeKind }),
    gates: ["confirm", "understanding", "framing", ...REWORK_TAIL],
  };
}
```

- [ ] **Step 5: 运行确认通过 + 提交** — `npx vitest run tests/lifecycle-policy.test.ts` PASS → `npm test` 全绿 → `git add -A && git commit -m "feat(runtime): add lifecycle policy table for mode-differentiated flows"`。

---

### Task 2: 会话持久化策略与设计权威 + 产物登记

**Files:**
- Modify: `packages/prax-runtime/src/contracts.ts`（4 个新 Schema + DesignSession + ARTIFACT_FILES）
- Modify: `packages/prax-runtime/src/artifact-store.ts`（ARTIFACT_SCHEMAS、createSession 策参数）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加；文件头部 import 追加）**

```ts
// 追加 imports：
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DesignSessionSchema, FileSessionStore } from "prax-runtime";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("session policy persistence", () => {
  it("stores the policy snapshot, authorities, and starts at the first gate phase", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-policy-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_policy" });
    const session = await store.createSession({
      projectRoot,
      requirement: "Rework the console",
      mode: "rework",
      lifecyclePolicy: lifecyclePolicyFor("rework"),
      designAuthorities: ["docs/DESIGN.md"],
    });
    expect(session.lifecycle_policy?.gates[0]).toBe("confirm");
    expect(session.phase).toBe("REQUIREMENT_CONFIRMATION");
    expect(session.design_authorities).toEqual(["docs/DESIGN.md"]);
  });

  it("parses legacy sessions without policy or authorities", () => {
    const legacy = DesignSessionSchema.parse({
      id: "ds_old", project_root: "/tmp/p", mode: "greenfield", phase: "PRODUCT_FRAMING",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
      requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "product_framing" },
      disclosures: [], routing_history: [], artifacts: {}, unresolved: [], warnings: [],
    });
    expect(legacy.lifecycle_policy).toBeUndefined();
    expect(legacy.design_authorities).toEqual([]);
  });
});
```

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现**

`contracts.ts` 追加（注意：`ExistingUnderstandingSchema` 的可默认字段在 z.infer 输出类型中必填，因此同时导出 `z.input` 别名供 fixtures 使用）：

```ts
export const RequirementConfirmationSchema = z.object({
  version: z.literal("0.1"),
  user_quote: z.array(NonEmptyStringSchema).min(1),
  restatement: NonEmptyStringSchema,
  boundaries: z.object({
    in_scope: z.array(NonEmptyStringSchema).min(1),
    out_of_scope: z.array(NonEmptyStringSchema),   // 空值由 validator 判 EXPAND（修订⑫）
  }),
  open_questions: z.array(MaterialUnknownSchema).default([]),
  confirmed_with_user: z.literal(true),
  confirmed_at: z.string().datetime(),
});
export type RequirementConfirmation = z.infer<typeof RequirementConfirmationSchema>;

export const ExistingUnderstandingSchema = z.object({
  version: z.literal("0.1"),
  current_objects: z.array(z.object({
    id: NonEmptyStringSchema, user_name: NonEmptyStringSchema, purpose: NonEmptyStringSchema,
    evidence_refs: z.array(NonEmptyStringSchema).default([]),
  })).default([]),
  current_surfaces: z.array(z.object({
    id: NonEmptyStringSchema, purpose: NonEmptyStringSchema,
    evidence_refs: z.array(NonEmptyStringSchema).default([]),
  })).default([]),
  established_patterns: z.array(NonEmptyStringSchema).default([]),
  user_habits: z.array(NonEmptyStringSchema).default([]),
  constraints_and_debt: z.array(NonEmptyStringSchema).default([]),
  change_targets: z.array(NonEmptyStringSchema).default([]),
  actual_usage: z.array(NonEmptyStringSchema).default([]),
  pain_points: z.array(NonEmptyStringSchema).default([]),
  must_preserve: z.array(NonEmptyStringSchema).default([]),
  must_replace: z.array(NonEmptyStringSchema).default([]),
  free_to_reconsider: z.array(NonEmptyStringSchema).default([]),
  migration_notes: z.array(NonEmptyStringSchema).default([]),
  design_authorities: z.array(NonEmptyStringSchema).default([]),
});
export type ExistingUnderstanding = z.infer<typeof ExistingUnderstandingSchema>;
export type ExistingUnderstandingInput = z.input<typeof ExistingUnderstandingSchema>;

export const IntentLiteSchema = z.object({
  version: z.literal("0.1"),
  kind: z.enum(["visual_polish", "defect_fix"]),
  surfaces: z.array(NonEmptyStringSchema).min(1),
  current_hierarchy_summary: NonEmptyStringSchema,
  change: NonEmptyStringSchema,
  basis: NonEmptyStringSchema,
  evidence_refs: z.array(NonEmptyStringSchema).min(1),
  regression_points: z.array(NonEmptyStringSchema).min(1),
});
export type IntentLite = z.infer<typeof IntentLiteSchema>;
```

`DesignSessionSchema` 追加：`lifecycle_policy: LifecyclePolicySchema.optional(), design_authorities: z.array(NonEmptyStringSchema).default([]),`。`ARTIFACT_FILES` 追加四项：`requirementConfirmation: "requirement-confirmation.yaml", existingUnderstanding: "existing-understanding.yaml", intentLite: "intent-lite.yaml", sdirDelta: "sdir-delta.yaml"`。

`artifact-store.ts`：`ARTIFACT_SCHEMAS` 追加 `requirementConfirmation / existingUnderstanding / intentLite` 三个运行时 schema（sdirDelta 由 prax-sdir 校验）；`createSession` 入参追加 `lifecyclePolicy?: LifecyclePolicy; designAuthorities?: string[]`，session 初始化追加：

```ts
...(input.lifecyclePolicy === undefined ? {} : { lifecycle_policy: input.lifecyclePolicy }),
design_authorities: input.designAuthorities ?? [],
phase: input.lifecyclePolicy === undefined ? "PRODUCT_FRAMING" : GATE_PHASE[input.lifecyclePolicy.gates[0]!],
current_gate: { name: input.lifecyclePolicy === undefined ? "product_framing" : input.lifecyclePolicy.gates[0]! },
```

（`GATE_PHASE` 从 `./lifecycle-policy.js` 导入；`DesignSessionSchema.parse` 时 `design_authorities` 类型为必填数组 ✓。）

- [ ] **Step 4: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(runtime): persist lifecycle policy, authorities, and new artifacts"`。

---

### Task 3: 状态机策略化（含旧会话兼容与 P3 只读守卫）

**Files:**
- Modify: `packages/prax-runtime/src/state-machine.ts`（重写；DesignOperation 留在本地）
- Modify: `packages/prax-mcp/src/service.ts`（advanceSession 调用改 gate 名；designSdir 只读分支前移并加守卫）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加）**

```ts
import { advanceSession, checkOperationAllowed } from "prax-runtime";

function sessionWith(gates: string[], completed: string[], phase: string, mode = "existing_product") {
  return {
    id: "ds_sm", project_root: "/tmp/p", mode, phase,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
    requirement_ref: "requirement.md", completed_gates: completed, current_gate: { name: "next" },
    disclosures: [], routing_history: [], artifacts: {}, unresolved: [], warnings: [],
    design_authorities: [],
    lifecycle_policy: { version: "1" as const, mode: "existing_product" as const, change_kind: "modify_surface" as const, gates },
  } as never;
}

describe("policy-driven state machine", () => {
  const modify = ["confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate"];

  it("allows the operation owning the current gate and blocks others with the next tool", () => {
    const session = sessionWith(modify, ["confirm"], "UNDERSTANDING");
    expect(checkOperationAllowed(session, "design_frame")).toBeUndefined();
    const blocked = checkOperationAllowed(session, "design_decide");
    expect(blocked?.status).toBe("BLOCK");
    expect(blocked?.next).toEqual({ tool: "design_frame" });
  });

  it("advances past a gate onto the next gate's phase", () => {
    const advanced = advanceSession(sessionWith(modify, ["confirm"], "UNDERSTANDING"), "understanding", "2026-08-26T00:00:00.000Z");
    expect(advanced.phase).toBe("ROUTING");
    expect(advanced.completed_gates).toContain("understanding");
  });

  it("resumes legacy sessions from mid-flow phases via gate alias normalization", () => {
    for (const [phase, completed, expectedTool] of [
      ["CONTEXT", ["frame"], "design_context"],
      ["ROUTING", ["frame"], "design_route"],
      ["SDIR", ["frame", "context", "route", "decide"], "design_sdir"],
      ["IMPLEMENTATION_READY", ["frame", "context", "route", "decide", "sdir", "reconcile"], "design_prepare_implementation"],
      ["VALIDATION", ["frame", "context", "route", "decide", "sdir", "reconcile", "prepare_implementation"], "design_validate"],
      ["COMPLETE", ["frame", "context", "route", "decide", "sdir", "reconcile", "prepare_implementation", "validation"], "design_validate"],
    ] as const) {
      const legacy = sessionWith([], [...completed], phase, "greenfield");
      (legacy as { lifecycle_policy?: unknown }).lifecycle_policy = undefined;
      const allowed = ["design_route", "design_context", "design_sdir", "design_prepare_implementation", "design_validate"];
      const op = allowed.find((candidate) => checkOperationAllowed(legacy, candidate as never) === undefined);
      expect(op).toBeDefined();
      const blocked = checkOperationAllowed(legacy, "design_decide");
      expect(blocked?.next).toEqual({ tool: expectedTool });
    }
  });
});
```

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 重写 state-machine.ts**

```ts
import type { DesignSession, GateName, GateResult, LifecyclePolicy } from "./contracts.js";
import { DEFAULT_LEGACY_POLICY, GATE_PHASE, NEXT_TOOL_BY_GATE, normalizeCompletedGates } from "./lifecycle-policy.js";

export const DESIGN_OPERATIONS = [
  "design_frame", "design_context", "design_route", "design_inspect", "design_decide",
  "design_sdir", "design_reconcile", "design_prepare_implementation", "design_validate",
] as const;
export type DesignOperation = (typeof DESIGN_OPERATIONS)[number];

const OPERATION_GATES: Record<DesignOperation, GateName[]> = {
  design_frame: ["understanding", "framing", "intent_lite"],
  design_context: ["context"],
  design_route: ["route"],
  design_inspect: ["decide"],
  design_decide: ["decide"],
  design_sdir: ["sdir", "sdir_delta"],
  design_reconcile: ["reconcile"],
  design_prepare_implementation: ["prepare"],
  design_validate: ["validate"],
};

export function sessionPolicy(session: DesignSession): LifecyclePolicy {
  return session.lifecycle_policy ?? DEFAULT_LEGACY_POLICY;
}

export function currentGate(session: DesignSession): GateName {
  const done = new Set(normalizeCompletedGates(session.completed_gates));
  return sessionPolicy(session).gates.find((gate) => !done.has(gate)) ?? "validate";
}

export function checkOperationAllowed(session: DesignSession, operation: DesignOperation): GateResult | undefined {
  const gate = currentGate(session);
  if (OPERATION_GATES[operation].includes(gate)) return undefined;
  return {
    status: "BLOCK",
    code: "GATE_NOT_SATISFIED",
    message: `${operation} is not legal while session ${session.id} is at the '${gate}' gate (${sessionPolicy(session).mode}).`,
    next: { tool: NEXT_TOOL_BY_GATE[gate] },
  };
}

export function advanceSession(session: DesignSession, gate: GateName, now: string): DesignSession {
  const normalized = normalizeCompletedGates(session.completed_gates);
  const completed = normalized.includes(gate) ? normalized : [...normalized, gate];
  const next = sessionPolicy(session).gates.find((candidate) => !completed.includes(candidate));
  return {
    ...session,
    phase: next === undefined ? session.phase : GATE_PHASE[next],
    updated_at: now,
    revision: session.revision + 1,
    completed_gates: completed,
    current_gate: { name: next ?? "complete" },
  };
}
```

**service.ts 适配（本任务内完成）：**
1. 所有 `advanceSession(session, "design_xxx", ...)` 调用改为 gate 名：frame→`"framing"`、context→`"context"`、route→`"route"`、decide→`"decide"`、sdir→`"sdir"`、reconcile→`"reconcile"`、prepare→`"prepare"`。
2. `designValidate` 的 evaluate PASS 分支：`advanceSession(session, "validate", now)` 后再覆盖 `phase: "COMPLETE"` 与 `current_gate: { name: "complete" }`。
3. **P3 只读 SDIR 回验前移并加守卫**（修订⑩）：`designSdir` 开头、`operationBlock` 之前插入：

```ts
if (
  input.mode === "validate" && input.sdir !== undefined &&
  session.lifecycle_policy !== undefined &&
  !sessionPolicy(session).gates.includes("intent_lite") === false ? false : false
) { /* 占位——用下行真实条件替换 */ }
// 真实守卫：
if (
  input.mode === "validate" && input.sdir !== undefined &&
  session.completed_gates.includes("sdir") || session.completed_gates.includes("sdir_delta")
) {
  const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
  const validation = this.sdirEngine.validate(input.sdir, decisions);
  return {
    status: validation.status, schema_errors: validation.schema_errors,
    semantic_errors: validation.semantic_errors, semantic_issues: validation.semantic_issues,
    warnings: validation.warnings, phase: session.phase,
  };
}
```

**实现时删除上面的占位 if 块**，仅保留"真实守卫"。条件含义：会话已完成 sdir/sdir_delta 门禁（新策略会话）才允许跨阶段只读校验；legacy 会话沿用后续 phase 检查（`ALLOWED_PHASES` 语义并入 `checkOperationAllowed` 后 legacy 由默认策略覆盖）。注意运算优先级——实现写成 `const sdirDone = session.completed_gates.includes("sdir") || session.completed_gates.includes("sdir_delta");` 再组合条件，避免 `||` 优先级陷阱。该分支只读 decisions，不 commit、不 touch。轻路径（无 decisions artifact）因 `mode==="validate"` 但 `sdirDone` 为 false 不会进入，落到 `operationBlock` 正确拦截。

- [ ] **Step 4: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿（e2e 走默认策略行为不变）→ `git commit -m "feat(runtime): drive the state machine from session lifecycle policies"`。

---

### Task 4: design_start 判别 union + 需求确认门禁

**Files:**
- Modify: `packages/prax-runtime/src/gate-validation.ts`（validateRequirementConfirmation）
- Modify: `packages/prax-mcp/src/schemas.ts`（DesignStartInputSchema 判别 union）
- Modify: `packages/prax-mcp/src/service.ts`（designStart 创建/续确认）
- Modify: `tests/fixtures.ts` + 三个旧测试的 designStart 调用点
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: fixtures 追加（含 import）**

```ts
// tests/fixtures.ts 顶部 import 追加 type { RequirementConfirmation } from "prax-runtime";
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
```

- [ ] **Step 2: 写失败测试（追加；import 追加 `import { PraxService } from "prax-mcp";` 与 `import { requirementConfirmation } from "./fixtures.js";`）**

```ts
describe("requirement confirmation gate", () => {
  async function setup() {
    const root = await mkdtemp(join(tmpdir(), "prax-confirm-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_confirm" });
    const service = await PraxService.create({ sessions: store });
    return { service, projectRoot, store };
  }

  it("creates a session awaiting confirmation and accepts the resume submission", async () => {
    const { service, projectRoot, store } = await setup();
    const created = await service.designStart({ requirement: "Build a canvas", project_root: projectRoot, mode: "greenfield" });
    expect(created.status).toBe("PASS");
    expect(created.phase).toBe("REQUIREMENT_CONFIRMATION");
    expect(created.next).toEqual({ tool: "design_start" });

    const confirmed = await service.designStart({ design_session_id: "ds_confirm", requirement_confirmation: requirementConfirmation() });
    expect(confirmed.status).toBe("PASS");
    expect(confirmed.phase).toBe("PRODUCT_FRAMING");
    expect((await store.getSession("ds_confirm")).artifacts.requirementConfirmation).toBeDefined();
  });

  it("accepts a complete confirmation inline at creation", async () => {
    const { service, projectRoot } = await setup();
    const started = await service.designStart({
      requirement: "Build a canvas", project_root: projectRoot, mode: "greenfield",
      requirement_confirmation: requirementConfirmation(),
    });
    expect(started.status).toBe("PASS");
    expect(started.phase).toBe("PRODUCT_FRAMING");
  });

  it("rejects an empty out_of_scope with EXPAND", async () => {
    const { service, projectRoot } = await setup();
    await service.designStart({ requirement: "Build a canvas", project_root: projectRoot, mode: "greenfield" });
    const bad = { ...requirementConfirmation(), boundaries: { in_scope: ["x"], out_of_scope: [] } };
    const result = await service.designStart({ design_session_id: "ds_confirm", requirement_confirmation: bad });
    expect(result.status).toBe("EXPAND");
    expect(JSON.stringify(result)).toMatch(/out_of_scope/);
  });

  it("blocks invalid mode combinations at creation", async () => {
    const { service, projectRoot } = await setup();
    const result = await service.designStart({ requirement: "x", project_root: projectRoot, mode: "greenfield", change_kind: "defect_fix" });
    expect(result.status).toBe("BLOCK");
    expect(result.code).toBe("UNKNOWN_LIFECYCLE_POLICY");
  });
});
```

- [ ] **Step 3: 运行确认失败。**

- [ ] **Step 4: 实现**

`gate-validation.ts` 追加：

```ts
export function validateRequirementConfirmation(input: unknown): ArtifactValidation<RequirementConfirmation> {
  const parsed = RequirementConfirmationSchema.safeParse(input);
  if (!parsed.success) return { status: "RETRY", issues: zodIssues(parsed.error), warnings: [] };
  const issues: string[] = [];
  const warnings: string[] = [];
  if (parsed.data.boundaries.out_of_scope.length === 0) {
    issues.push("boundaries.out_of_scope must declare at least one excluded concern; scope drift is the most common restatement failure.");
  }
  const highImpact = parsed.data.open_questions.filter((q) => typeof q !== "string" && q.impact === "high");
  if (highImpact.length > 0) {
    issues.push(`High-impact open questions must be resolved or explicitly accepted before design starts: ${highImpact.map((q) => (typeof q === "string" ? q : q.id)).join(", ")}.`);
  }
  if (parsed.data.open_questions.length > 0) {
    warnings.push(`${parsed.data.open_questions.length} requirement question(s) remain recorded.`);
  }
  return { status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND", issues, warnings, value: parsed.data };
}
```

`schemas.ts`（判别 union，修订③）：

```ts
const CreateSessionInput = z.strictObject({
  requirement: z.string().trim().min(1),
  project_root: z.string().trim().min(1),
  mode: DesignModeSchema,
  change_kind: ChangeKindSchema.optional(),
  design_authorities: z.array(z.string().trim().min(1)).default([]),
  project_id: z.string().trim().min(1).optional(),
  requirement_confirmation: RequirementConfirmationSchema.optional(),
});
const ResumeConfirmationInput = z.strictObject({
  design_session_id: SessionId,
  requirement_confirmation: RequirementConfirmationSchema,
});
export const DesignStartInputSchema = z.union([ResumeConfirmationInput, CreateSessionInput]);
export type DesignStartInput = z.infer<typeof DesignStartInputSchema>;
```

（`RequirementConfirmationSchema`、`DesignModeSchema`、`ChangeKindSchema` 从 `prax-runtime` 导入。两支均用 `z.strictObject`：resume 支拒绝 create 字段、create 支拒绝 `design_session_id`——混合输入会在两支都失败并给出明确 schema 错误，杜绝"被静默解释为 resume"的歧义。MCP SDK 2.0 对 union 生成 `anyOf` + 根级 `type: object`，兼容。）

`service.ts` 的 `designStart`：

```ts
public async designStart(input: DesignStartInput): Promise<PraxOutput> {
  if ("design_session_id" in input) {
    const session = await this.sessions.getSession(input.design_session_id);
    if (currentGate(session) !== "confirm") {
      return { status: "BLOCK", code: "GATE_NOT_SATISFIED", message: `Session ${session.id} is not awaiting requirement confirmation.`, next: { tool: NEXT_TOOL_BY_GATE[currentGate(session)] } };
    }
    const validation = validateRequirementConfirmation(input.requirement_confirmation);
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return { status: validation.status, issues: validation.issues, warnings: validation.warnings, next: nextTool("design_start") };
    }
    const updated = advanceSession(session, "confirm", this.sessions.nowIso());
    await this.sessions.commit(updated, [{ key: "requirementConfirmation", value: validation.value }]);
    return { status: validation.status, design_session_id: session.id, phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
  }

  let policy;
  try {
    policy = lifecyclePolicyFor(input.mode, input.change_kind);
  } catch (error) {
    if (error instanceof PraxRuntimeError) return { status: "BLOCK", code: error.code, message: error.message };
    throw error;
  }
  const session = await this.sessions.createSession({
    projectRoot: input.project_root,
    requirement: input.requirement,
    mode: input.mode,
    ...(input.project_id === undefined ? {} : { projectId: input.project_id }),
    lifecyclePolicy: policy,
    designAuthorities: input.design_authorities,
  });
  if (input.requirement_confirmation === undefined) {
    return { status: "PASS", design_session_id: session.id, phase: session.phase, next: nextTool("design_start"), required: ["user_quote", "restatement", "boundaries", "confirmed_with_user"] };
  }
  const validation = validateRequirementConfirmation(input.requirement_confirmation);
  if (validation.status !== "PASS" && validation.status !== "WARN") {
    return { status: validation.status, design_session_id: session.id, issues: validation.issues, warnings: validation.warnings, next: nextTool("design_start") };
  }
  const updated = advanceSession(session, "confirm", this.sessions.nowIso());
  await this.sessions.commit(updated, [{ key: "requirementConfirmation", value: validation.value }]);
  return { status: validation.status, design_session_id: session.id, phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
}
```

（service.ts 顶部追加导入：`currentGate, sessionPolicy` from prax-runtime；`NEXT_TOOL_BY_GATE, lifecyclePolicyFor` from prax-runtime；`validateRequirementConfirmation` from prax-runtime；`PraxRuntimeError` from prax-runtime。）

**更新三个旧测试的 designStart 调用点（内联确认一步到位，import `requirementConfirmation`）：**
- `tests/mcp-protocol.test.ts`：design_start arguments 加 `requirement_confirmation: requirementConfirmation()`（断言 `phase: "PRODUCT_FRAMING"` 继续成立）。
- `tests/service-e2e.test.ts`、`tests/runtime-and-routing.test.ts`（escape、revalidate 两处）：同样加内联确认。

- [ ] **Step 5: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(mcp): gate every session behind a structured requirement confirmation"`。

---

### Task 5: 存量理解校验（含 rework 覆盖）

**Files:**
- Modify: `packages/prax-runtime/src/gate-validation.ts`
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加）**

```ts
import { validateExistingUnderstanding } from "prax-runtime";

describe("existing understanding validation", () => {
  const existingInput = {
    version: "0.1" as const,
    current_objects: [{ id: "architecture_node", user_name: "架构节点", purpose: "系统组成部分", evidence_refs: ["app/architecture"] }],
    current_surfaces: [{ id: "canvas", purpose: "架构画布" }, { id: "settings", purpose: "配置" }],
    established_patterns: ["PAT-CANVAS-WORKSPACE"],
    user_habits: ["左侧导航切换"],
    constraints_and_debt: [],
    change_targets: ["settings"],
    design_authorities: ["docs/DESIGN.md"],
  };

  const reworkInput = {
    version: "0.1" as const,
    current_objects: [{ id: "architecture_node", user_name: "架构节点", purpose: "系统组成部分", evidence_refs: ["app/architecture"] }],
    current_surfaces: [{ id: "canvas", purpose: "架构画布" }],
    actual_usage: ["从画布进、逐节点排查"],
    pain_points: ["全局关系一屏太多，聚焦后丢失方位"],
    must_preserve: ["flow 数据", "canvas"],
    must_replace: ["architecture_node"],
    free_to_reconsider: [],
    migration_notes: ["旧入口保留一个月"],
    design_authorities: ["docs/DESIGN.md"],
  };

  it("accepts complete understandings for both modes", () => {
    expect(validateExistingUnderstanding(existingInput, "existing_product", "modify_surface").status).toBe("PASS");
    expect(validateExistingUnderstanding(reworkInput, "rework").status).toBe("PASS");
  });

  it("rejects change targets that do not map to declared surfaces", () => {
    const bad = { ...existingInput, change_targets: ["billing"] };
    const result = validateExistingUnderstanding(bad, "existing_product", "modify_surface");
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("CHANGE_TARGET_NOT_DECLARED");
  });

  it("requires pain points and exclusive, covering buckets for rework", () => {
    const noPain = validateExistingUnderstanding({ ...reworkInput, pain_points: [] }, "rework");
    expect(noPain.codes).toContain("REWORK_PAIN_POINTS_MISSING");

    const conflicting = validateExistingUnderstanding({ ...reworkInput, free_to_reconsider: ["canvas"] }, "rework");
    expect(conflicting.codes).toContain("REWORK_BUCKET_CONFLICT");

    const uncovered = validateExistingUnderstanding({ ...reworkInput, must_preserve: [] }, "rework");
    expect(uncovered.codes).toContain("REWORK_COVERAGE_INCOMPLETE");
  });
});
```

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现（gate-validation.ts 追加；rework 覆盖=inventory 每项恰落一桶，修订⑬⑭）**

```ts
export function validateExistingUnderstanding(
  input: unknown,
  mode: DesignMode,
  changeKind?: ChangeKind,
): ArtifactValidation<ExistingUnderstanding> {
  const parsed = ExistingUnderstandingSchema.safeParse(input);
  if (!parsed.success) return { status: "RETRY", issues: zodIssues(parsed.error), warnings: [] };
  const data = parsed.data;
  const issues: string[] = [];
  const codes: string[] = [];
  const warnings: string[] = [];

  if (data.design_authorities.length === 0) {
    warnings.push("No external design authorities declared; decisions will be checked only against the built-in pack.");
  }

  if (mode === "existing_product") {
    const surfaces = new Set(data.current_surfaces.map((surface) => surface.id));
    for (const target of data.change_targets) {
      if (!surfaces.has(target)) {
        codes.push("CHANGE_TARGET_NOT_DECLARED");
        issues.push(`change_target '${target}' does not map to any declared current_surfaces entry.`);
      }
    }
    if (data.current_objects.length === 0 || data.current_surfaces.length === 0) {
      codes.push("UNDERSTANDING_INCOMPLETE");
      issues.push("existing_product understanding requires current_objects and current_surfaces.");
    }
    if (changeKind === "add_surface" && data.change_targets.length > 0) {
      warnings.push("add_surface declares change targets although the change adds a new surface; they are recorded as integration neighbors.");
    }
  }

  if (mode === "rework") {
    if (data.pain_points.length === 0) {
      codes.push("REWORK_PAIN_POINTS_MISSING");
      issues.push("rework requires pain_points; no pain means no basis for redesign.");
    }
    if (data.actual_usage.length === 0) {
      codes.push("UNDERSTANDING_INCOMPLETE");
      issues.push("rework understanding requires actual_usage evidence.");
    }
    const buckets: Array<[string, string[]]> = [
      ["must_preserve", data.must_preserve],
      ["must_replace", data.must_replace],
      ["free_to_reconsider", data.free_to_reconsider],
    ];
    const placement = new Map<string, string>();
    for (const [bucket, items] of buckets) {
      for (const item of items) {
        const prior = placement.get(item);
        if (prior !== undefined) {
          codes.push("REWORK_BUCKET_CONFLICT");
          issues.push(`'${item}' appears in both ${prior} and ${bucket}; the three buckets must be exclusive.`);
        }
        placement.set(item, bucket);
      }
    }
    const inventory = [...data.current_objects.map((object) => object.id), ...data.current_surfaces.map((surface) => surface.id)];
    const uncovered = inventory.filter((item) => !placement.has(item));
    if (uncovered.length > 0) {
      codes.push("REWORK_COVERAGE_INCOMPLETE");
      issues.push(`Every declared object and surface must fall into exactly one bucket; uncovered: ${uncovered.join(", ")}.`);
    }
  }

  return { status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND", issues, warnings, codes, value: data };
}
```

- [ ] **Step 4: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(runtime): validate mode-specific existing-system understanding"`。

---

### Task 6: design_frame 三载荷分发 + 轻量 brief + frame 对应检查

**Files:**
- Modify: `packages/prax-mcp/src/schemas.ts`（DesignFrameInputSchema）
- Modify: `packages/prax-mcp/src/service.ts`（designFrame 按 gate 分发；意图门禁时一并提交轻量 brief）
- Modify: `packages/prax-runtime/src/gate-validation.ts`（validateIntentLite + validateFrameUnderstandingAlignment）
- Modify: `tests/fixtures.ts`（architectureUnderstanding / reworkUnderstanding / intentLite，类型用 ExistingUnderstandingInput 或补全字段）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: fixtures 追加（修订⑱：补全所有 default 字段或用 input 类型）**

```ts
// tests/fixtures.ts import 追加：
// import type { ExistingUnderstanding, IntentLite } from "prax-runtime";
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
```

- [ ] **Step 2: 写失败测试（追加；import `architectureProductFrame, reworkUnderstanding, intentLite` from fixtures）**

```ts
describe("design frame payload dispatch", () => {
  async function confirmedService(mode: "rework" | "existing_product", changeKind?: "modify_surface" | "visual_polish") {
    const root = await mkdtemp(join(tmpdir(), "prax-frame-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_frame" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "x", project_root: projectRoot, mode,
      ...(changeKind === undefined ? {} : { change_kind: changeKind }),
      requirement_confirmation: requirementConfirmation(),
    });
    return { service, store };
  }

  it("routes an understanding payload through the understanding gate for rework", async () => {
    const { service } = await confirmedService("rework");
    const result = await service.designFrame({ design_session_id: "ds_frame", existing_understanding: reworkUnderstanding() });
    expect(result.status).toBe("PASS");
    expect(result.phase).toBe("PRODUCT_FRAMING");
  });

  it("routes an intent-lite payload and persists a lightweight brief", async () => {
    const { service, store } = await confirmedService("existing_product", "visual_polish");
    const result = await service.designFrame({ design_session_id: "ds_frame", intent_lite: intentLite("visual_polish") });
    expect(result.status).toBe("PASS");
    expect(result.phase).toBe("VALIDATION");
    const brief = await store.readArtifact(await sessionLike(store), "implementationBrief");
    expect(JSON.stringify(brief)).toMatch(/change_list/);
  });

  it("rejects a product frame while the session expects understanding", async () => {
    const { service } = await confirmedService("rework");
    const result = await service.designFrame({ design_session_id: "ds_frame", product_frame: architectureProductFrame() });
    expect(result.status).toBe("EXPAND");
    expect(JSON.stringify(result)).toMatch(/existing_understanding/);
  });
});

// 辅助：从 store 读会话对象供 readArtifact 使用
async function sessionLike(store: InstanceType<typeof FileSessionStore>) {
  return store.getSession("ds_frame");
}
```

- [ ] **Step 3: 运行确认失败。**

- [ ] **Step 4: 实现**

`schemas.ts`：

```ts
export const DesignFrameInputSchema = z
  .object({
    design_session_id: SessionId,
    product_frame: ProductFrameSchema.optional(),
    existing_understanding: ExistingUnderstandingSchema.optional(),
    intent_lite: IntentLiteSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const payloads = [input.product_frame, input.existing_understanding, input.intent_lite].filter((value) => value !== undefined);
    if (payloads.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["product_frame"], message: "Exactly one of product_frame, existing_understanding, or intent_lite is required." });
    }
  });
```

`gate-validation.ts` 追加（intent 证据已由 schema `min(1)` 保证；增加 kind 一致性与 frame↔理解对应 assistive 检查，修订⑯）：

```ts
export function validateIntentLite(input: unknown, expectedKind: ChangeKind): ArtifactValidation<IntentLite> {
  const parsed = IntentLiteSchema.safeParse(input);
  if (!parsed.success) return { status: "RETRY", issues: zodIssues(parsed.error), warnings: [] };
  const issues: string[] = [];
  const codes: string[] = [];
  if (parsed.data.kind !== expectedKind) {
    codes.push("INTENT_KIND_MISMATCH");
    issues.push(`intent_lite.kind '${parsed.data.kind}' does not match the session's change_kind '${expectedKind}'.`);
  }
  return { status: issues.length === 0 ? "PASS" : "EXPAND", issues, warnings: [], codes, value: parsed.data };
}

export function frameUnderstandingAlignment(frame: ProductFrame, understanding: ExistingUnderstanding, mode: DesignMode): string[] {
  const known = new Set(understanding.current_objects.map((object) => object.id));
  const warnings: string[] = [];
  const introduced = frame.product_objects.filter((object) => !known.has(object.id)).map((object) => object.id);
  if (introduced.length > 0) {
    warnings.push(`Frame introduces product objects absent from the existing understanding (${introduced.join(", ")}); confirm they are genuinely new to users, not unexamined backend nouns.`);
  }
  if (mode === "rework") {
    const replaced = new Set([...understanding.must_replace, ...understanding.free_to_reconsider]);
    const copied = frame.product_objects.filter((object) => object.id === understanding.current_objects.find((o) => o.id === object.id)?.id && !replaced.has(object.id)).map((object) => object.id);
    if (copied.length > 0) {
      warnings.push(`Rework frame reuses legacy objects without declaring them free_to_reconsider or must_replace (${copied.join(", ")}); fresh derivation must start from tasks.`);
    }
  }
  return warnings;
}
```

`service.ts` 的 `designFrame` 按 `currentGate(session)` 分发（完整实现替换现有方法体）：

```ts
public async designFrame(input: DesignFrameInput): Promise<PraxOutput> {
  const session = await this.sessions.getSession(input.design_session_id);
  const blocked = operationBlock(session, "design_frame");
  if (blocked !== undefined) return blocked;
  const gate = currentGate(session);
  const now = this.sessions.nowIso();

  if (gate === "understanding") {
    if (input.existing_understanding === undefined) {
      return { status: "EXPAND", issues: ["The understanding gate expects an existing_understanding payload."], next: nextTool("design_frame") };
    }
    const validation = validateExistingUnderstanding(input.existing_understanding, session.mode, session.lifecycle_policy?.change_kind);
    if (validation.status !== "PASS" && validation.status !== "WARN") {
      return { status: validation.status, issues: validation.issues, codes: validation.codes ?? [], warnings: validation.warnings, next: nextTool("design_frame") };
    }
    const updated = advanceSession(session, "understanding", now);
    await this.sessions.commit(updated, [{ key: "existingUnderstanding", value: validation.value }]);
    return { status: validation.status, warnings: validation.warnings, phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
  }

  if (gate === "intent_lite") {
    if (input.intent_lite === undefined) {
      return { status: "EXPAND", issues: ["The intent gate expects an intent_lite payload."], next: nextTool("design_frame") };
    }
    const expectedKind = session.lifecycle_policy?.change_kind === "defect_fix" ? "defect_fix" : "visual_polish";
    const validation = validateIntentLite(input.intent_lite, expectedKind);
    if (validation.status !== "PASS") {
      return { status: validation.status, issues: validation.issues, codes: validation.codes ?? [], warnings: [], next: nextTool("design_frame") };
    }
    const updated = advanceSession(session, "intent_lite", now);
    // 轻路径不经过 prepare 门禁，在此直接持久化轻量执行计划（修订⑨）
    const brief = {
      version: "0.1",
      mode_plan: { change_list: [validation.value.change], regression_checks: validation.value.regression_points, surfaces: validation.value.surfaces },
    };
    await this.sessions.commit(updated, [
      { key: "intentLite", value: validation.value },
      { key: "implementationBrief", value: brief },
    ]);
    return { status: "PASS", phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
  }

  if (input.product_frame === undefined) {
    return { status: "EXPAND", issues: ["The framing gate expects a product_frame payload."], next: nextTool("design_frame") };
  }
  const validation = validateProductFrame(input.product_frame, session.mode);
  if (validation.status !== "PASS" && validation.status !== "WARN") {
    return { status: validation.status, missing_or_uncertain: validation.issues, warnings: validation.warnings, next: nextTool("design_frame") };
  }
  const updated = advanceSession(session, "framing", now);
  const artifacts: Array<{ key: "productFrame"; value: unknown }> = [{ key: "productFrame", value: validation.value }];
  await this.sessions.commit(updated, artifacts);
  const understanding = await this.sessions.readArtifact(session, "existingUnderstanding");
  const extraWarnings =
    understanding !== undefined && (session.mode === "existing_product" || session.mode === "rework")
      ? frameUnderstandingAlignment(validation.value!, understanding, session.mode)
      : [];
  return {
    status: extraWarnings.length > 0 ? "WARN" : validation.status,
    missing_or_uncertain: [],
    warnings: [...validation.warnings, ...extraWarnings],
    phase: updated.phase,
    next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]),
  };
}
```

**注意**：frame 分支 advance 后才读 understanding 做附加告警——告警只随返回，不二次 commit（保持单次写入）。legacy 会话 gate 为 "framing" → 最后分支，返回结构与今天一致（`next` 为 design_context）。

- [ ] **Step 5: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(mcp): dispatch design_frame payloads by lifecycle gate"`。

---

### Task 7: SdirDelta 完整校验 + capability_needs

**Files:**
- Modify: `packages/prax-sdir/src/contracts.ts`（SdirDeltaSchema + capability_needs）
- Create: `packages/prax-sdir/src/delta.ts`
- Modify: `packages/prax-sdir/src/engine.ts`（导出 FORBIDDEN_KEY/FORBIDDEN_VALUE 与 renderLeakIssues）
- Modify: `packages/prax-sdir/src/index.ts`
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加；import `validateSdirDelta` from "prax-sdir"）**

```ts
describe("sdir delta", () => {
  const delta = {
    version: "0.1",
    surface: "settings",
    base_regions: [
      { id: "settings_navigation", role: "primary_navigation", importance: "supporting" },
      { id: "settings", role: "configuration_sections", importance: "primary" },
    ],
    changes: [
      { region: "settings", action: "modify", fields: { importance: "dominant" }, rationale: "配置成为主要任务" },
      { region: "search", action: "add", role: "supporting_toolbar", rationale: "长列表需要检索" },
    ],
    preserved: ["settings_navigation"],
    regression_points: ["键盘路径", "保存态可见性"],
    capability_needs: [],
  };

  it("accepts a well-formed delta", () => {
    expect(validateSdirDelta(delta).status).toBe("PASS");
  });

  it("rejects changes targeting regions outside base ∪ adds", () => {
    const bad = structuredClone(delta);
    bad.changes[0].region = "ghost";
    const result = validateSdirDelta(bad);
    expect(result.status).toBe("RETRY");
    expect(result.semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RELATION_REGION_NOT_FOUND");
  });

  it("rejects duplicate adds and unactioned region reuse", () => {
    const dup = structuredClone(delta);
    dup.changes.push({ region: "search", action: "add", role: "supporting_toolbar", rationale: "重复添加" });
    expect(validateSdirDelta(dup).semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_REGION_ID_DUPLICATE");
  });

  it("rejects render-level leakage at any depth", () => {
    const bad = structuredClone(delta);
    bad.changes[0].fields = { layout: { width: "320px" } };
    const result = validateSdirDelta(bad);
    expect(result.semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RENDER_LEVEL_LEAK");
  });

  it("validates preserved references", () => {
    const bad = structuredClone(delta);
    bad.preserved = ["ghost_surface"];
    expect(validateSdirDelta(bad).semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RELATION_REGION_NOT_FOUND");
  });
});
```

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现**

`engine.ts`：`FORBIDDEN_KEY`、`FORBIDDEN_VALUE` 声明前加 `export`；`renderLeakIssues` 也加 `export`（供 delta 递归复用）。

`contracts.ts` 追加：

```ts
export const SdirDeltaChangeSchema = z.object({
  region: NonEmpty,
  action: z.enum(["add", "modify", "remove", "preserve_explicit"]),
  role: NonEmpty.optional(),
  fields: z.record(z.string(), z.unknown()).default({}),
  rationale: NonEmpty,
});
export const SdirDeltaSchema = z.object({
  version: z.literal("0.1"),
  surface: NonEmpty,
  base_regions: z.array(z.object({
    id: NonEmpty,
    role: NonEmpty,
    importance: z.enum(["dominant", "primary", "supporting", "contextual"]),
  })).min(1),
  changes: z.array(SdirDeltaChangeSchema).min(1),
  preserved: z.array(NonEmpty).default([]),
  regression_points: z.array(NonEmpty).min(1),
  capability_needs: z.array(NonEmpty).default([]),
});
export type SdirDelta = z.infer<typeof SdirDeltaSchema>;
export interface SdirDeltaValidation {
  status: "PASS" | "RETRY";
  schema_errors: string[];
  semantic_errors: string[];
  semantic_issues: SdirIssue[];
  value?: SdirDelta;
}
```

```ts
// packages/prax-sdir/src/delta.ts
import { zodIssues } from "prax-runtime";
import { SdirDeltaSchema, type SdirDelta, type SdirDeltaValidation, type SdirIssue } from "./contracts.js";
import { renderLeakIssues } from "./engine.js";

export function validateSdirDelta(input: unknown): SdirDeltaValidation {
  const parsed = SdirDeltaSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "RETRY", schema_errors: zodIssues(parsed.error), semantic_errors: [], semantic_issues: [] };
  }
  const delta = parsed.data;
  const issues: SdirIssue[] = [];
  const declared = new Set(delta.base_regions.map((region) => region.id));
  const added = new Set<string>();
  delta.changes.forEach((change, index) => {
    if (change.action === "add") {
      if (declared.has(change.region) || added.has(change.region)) {
        issues.push({ code: "SDIR_REGION_ID_DUPLICATE", message: `changes[${index}] adds '${change.region}' which already exists or was already added.` });
      } else {
        added.add(change.region);
      }
      if (change.role === undefined) {
        issues.push({ code: "SDIR_REGION_ROLE_MISSING", message: `changes[${index}] adds '${change.region}' without a role.` });
      }
    } else if (!declared.has(change.region)) {
      issues.push({
        code: "SDIR_RELATION_REGION_NOT_FOUND",
        message: `changes[${index}].region '${change.region}' is not a declared base region; only add actions may introduce new regions.`,
      });
    }
    const leakPaths = renderLeakIssues(change.fields, `changes[${index}].fields`);
    for (const message of leakPaths) {
      issues.push({ code: "SDIR_RENDER_LEVEL_LEAK", message });
    }
  });
  for (const surface of delta.preserved) {
    if (!declared.has(surface) && !added.has(surface)) {
      issues.push({ code: "SDIR_RELATION_REGION_NOT_FOUND", message: `preserved entry '${surface}' does not reference a declared or added region.` });
    }
  }
  if (issues.length > 0) {
    return { status: "RETRY", schema_errors: [], semantic_errors: issues.map((issue) => issue.message), semantic_issues: issues };
  }
  return { status: "PASS", schema_errors: [], semantic_errors: [], semantic_issues: [], value: delta };
}
```

`index.ts` 追加 `export * from "./delta.js";`。

- [ ] **Step 4: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(sdir): add semantic delta validation for modify_surface"`。

---

### Task 8: modify 路径（派生输入持久化 + 动态 reconcile）

**Files:**
- Modify: `packages/prax-mcp/src/schemas.ts`（DesignSdirInputSchema + sdir_delta）
- Modify: `packages/prax-mcp/src/service.ts`（designSdir delta 分支；designRoute 派生并**持久化**；delta 提交时按 capability_needs 动态插入 reconcile）
- Modify: `tests/fixtures.ts`（sdirDelta，补全 default 字段）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: fixtures 追加（`import type { SdirDelta } from "prax-sdir";`）**

```ts
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
```

- [ ] **Step 2: 写失败测试（追加；import sdirDelta, architectureUnderstanding, architectureDecisions, architectureCapabilities from fixtures）**

```ts
describe("modify_surface path", () => {
  it("runs confirm → understanding → route → decide → sdir_delta with persisted derived inputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-modify-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_modify" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "把设置页改成分区检索式", project_root: projectRoot, mode: "existing_product", change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });

    const understood = await service.designFrame({ design_session_id: "ds_modify", existing_understanding: architectureUnderstanding(["settings"]) });
    expect(understood.phase).toBe("ROUTING");

    const routed = await service.designRoute({ design_session_id: "ds_modify", question: "如何在设置页承载检索与分区" });
    expect(routed.status).toMatch(/PASS|EXPAND/);
    // 派生 frame/context 必须已持久化（decide 依赖它们）
    const session = await store.getSession("ds_modify");
    expect(session.artifacts.productFrame).toBeDefined();
    expect(session.artifacts.designContext).toBeDefined();
    expect(session.warnings.join(" ")).toMatch(/derived/i);

    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-SETTINGS-SECTIONS";
    await service.designInspect({
      design_session_id: "ds_modify", ids: [patternId], depth: "L1",
      purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认分区模式适合设置页改造" },
    });
    const decided = await service.designDecide({
      design_session_id: "ds_modify",
      design_decisions: {
        session_id: "ds_modify",
        primary_structure: { pattern: patternId, rationale: ["分区承载不同目标"], confidence: "high" },
        information_hierarchy: { primary: ["settings"], secondary: ["search"] },
        density: { intent: "regular", strategy: ["分区标题"], avoid: ["后端配置顺序"] },
        major_choices: [],
        rejected: [{ option: "单页长表单", reason: "检索成本高" }],
        unresolved: [],
      },
    });
    expect(decided.status).toMatch(/PASS|WARN/);

    const delta = await service.designSdir({ design_session_id: "ds_modify", mode: "generate_from_decisions", sdir_delta: sdirDelta() });
    expect(delta.status).toBe("PASS");
    expect(delta.phase).toBe("IMPLEMENTATION_READY");
  });

  it("inserts the reconcile gate when a delta declares capability needs", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-modify-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_capneed" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "设置页需要后端检索接口", project_root: projectRoot, mode: "existing_product", change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });
    await service.designFrame({ design_session_id: "ds_capneed", existing_understanding: architectureUnderstanding(["settings"]) });
    const routed = await service.designRoute({ design_session_id: "ds_capneed", question: "检索如何承载" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0]?.id ?? "PAT-SETTINGS-SECTIONS";
    await service.designInspect({ design_session_id: "ds_capneed", ids: [patternId], depth: "L1", purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" } });
    await service.designDecide({
      design_session_id: "ds_capneed",
      design_decisions: {
        session_id: "ds_capneed",
        primary_structure: { pattern: patternId, rationale: ["分区"], confidence: "high" },
        information_hierarchy: { primary: ["settings"], secondary: ["search"] },
        density: { intent: "regular", strategy: ["分区标题"], avoid: [] },
        major_choices: [], rejected: [{ option: "长表单", reason: "检索成本高" }], unresolved: [],
      },
    });
    const needy = { ...sdirDelta(), capability_needs: ["backend search endpoint"] };
    const delta = await service.designSdir({ design_session_id: "ds_capneed", mode: "generate_from_decisions", sdir_delta: needy });
    expect(delta.status).toBe("PASS");
    expect(delta.phase).toBe("CAPABILITY_RECONCILIATION");
    expect(delta.next).toEqual({ tool: "design_reconcile" });
  });
});
```

- [ ] **Step 3: 运行确认失败。**

- [ ] **Step 4: 实现**

`schemas.ts`：`DesignSdirInputSchema` 增加 `sdir_delta: SdirDeltaSchema.optional()`（import from prax-sdir）。

`service.ts` **designSdir**（在 P3 只读守卫之后、`operationBlock` 之后、读取 decisions 之前按 gate 分发）：

```ts
if (currentGate(session) === "sdir_delta") {
  if (input.sdir_delta === undefined) {
    return { status: "RETRY", issues: ["The sdir_delta gate expects a sdir_delta payload."], next: nextTool("design_sdir") };
  }
  const validation = validateSdirDelta(input.sdir_delta);
  if (validation.status !== "PASS") {
    return { status: validation.status, schema_errors: validation.schema_errors, semantic_errors: validation.semantic_errors, semantic_issues: validation.semantic_issues, warnings: [], next: nextTool("design_sdir") };
  }
  // 按需 reconcile（修订⑪）：先改策略再 advance，保证 phase/current_gate 与新序列一致
  let policy = sessionPolicy(session);
  if (validation.value!.capability_needs.length > 0 && !policy.gates.includes("reconcile")) {
    const gates = [...policy.gates];
    gates.splice(gates.indexOf("prepare"), 0, "reconcile");
    policy = { ...policy, gates };
  }
  const updated = advanceSession({ ...session, lifecycle_policy: policy }, "sdir_delta", this.sessions.nowIso());
  await this.sessions.commit(updated, [{ key: "sdirDelta", value: validation.value }]);
  return { status: "PASS", sdir_delta: validation.value, phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
}
```

`service.ts` **designRoute**：frame/context artifact 缺失且存在 understanding 时，派生并**持久化**（修订⑤；派生字段未知项显式 unknown，修订⑰）：

```ts
const frameArtifact = await this.sessions.readArtifact<ProductFrame>(session, "productFrame");
const contextArtifact = await this.sessions.readArtifact<DesignContext>(session, "designContext");
const understanding = await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding");
const confirmation = await this.sessions.readArtifact<RequirementConfirmation>(session, "requirementConfirmation");
const frame = frameArtifact ?? this.derivedFrame(understanding, confirmation);
const context = contextArtifact ?? this.derivedContext(understanding, confirmation, session.design_authorities);
const derived = frameArtifact === undefined || contextArtifact === undefined;
```

route 结果 commit 时：若 `derived`，把派生 frame/context 一并写入（`productFrame`/`designContext` key），并在 `session.warnings` 追加 `Routing inputs derived from existing understanding (provenance: existing-understanding.yaml + requirement-confirmation.yaml)`，routingLog event 增加 `derived_from_understanding: true`。私有派生函数（service 内，注意用 `this.`）：

```ts
private derivedFrame(understanding: ExistingUnderstanding | undefined, confirmation: RequirementConfirmation | undefined): ProductFrame {
  if (understanding === undefined || confirmation === undefined) {
    throw new PraxRuntimeError("ROUTING_INPUTS_MISSING", "Routing requires product_frame/design_context artifacts or an existing-understanding plus requirement-confirmation pair to derive them.");
  }
  return ProductFrameSchema.parse({
    user: { primary_role: "existing product user", expertise: "mixed", familiarity: "unknown" },
    goal: { primary: confirmation.restatement },
    tasks: { primary: understanding.change_targets.join(", ") || "modify surface", secondary: [] },
    product_objects: understanding.current_objects.map((object) => ({ id: object.id, user_name: object.user_name, purpose: object.purpose })),
    relationships: [],
    mental_model_hypothesis: { summary: "derived from existing understanding", confidence: "medium", evidence: ["existing_product"] },
    primary_success_definition: "the change preserves the existing product model",
    open_questions: [],
  });
}

private derivedContext(understanding: ExistingUnderstanding, confirmation: RequirementConfirmation, authorities: string[]): DesignContext {
  return DesignContextSchema.parse({
    user: { expertise: "mixed", familiarity: "unknown" },
    task: { primary: understanding.change_targets.join(", ") || "modify", modes: ["modify"], frequency: "unknown" },
    domain: {
      type: understanding.current_surfaces.map((surface) => surface.id).join(", ") || "existing product",
      entities: understanding.current_objects.map((object) => object.id),
    },
    information: { volume: "unknown", relationship_complexity: "unknown", change_rate: "low", comparison_need: "unknown" },
    platform: { family: "web", form_factor: "desktop", input: ["pointer", "keyboard"], viewport: "large" },
    risk: { destructive_actions: "none", error_cost: "medium" },
    priorities: ["preserve existing habits", ...authorities.slice(0, 2)],
    density_intent: "regular",
    confidence: { overall: "medium" },
    unknowns: [],
  });
}
```

（派生 frame 的 `ProductFrameSchema.parse` 会因 `mental_model_hypothesis.evidence` 枚举含 "existing_product" ✓；派生产物 schema 合法即可持久化。）

- [ ] **Step 5: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(mcp): support the modify_surface path with persisted derived routing and on-demand reconcile"`。

---

### Task 9: 执行计划按模式分化（prepare 门禁内）

**Files:**
- Modify: `packages/prax-mcp/src/service.ts`（designPrepareImplementation）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加；import reworkUnderstanding）**

```ts
describe("mode-differentiated implementation brief", () => {
  it("attaches a migration plan for rework sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-brief-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_brief" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({ requirement: "重做控制台", project_root: projectRoot, mode: "rework", requirement_confirmation: requirementConfirmation() });
    await service.designFrame({ design_session_id: "ds_brief", existing_understanding: reworkUnderstanding() });
    await service.designFrame({ design_session_id: "ds_brief", product_frame: architectureProductFrame() });
    await service.designContext({ design_session_id: "ds_brief", design_context: architectureContext() });
    const routed = await service.designRoute({ design_session_id: "ds_brief", question: "选择主工作区模式" });
    const patternId = (routed.patterns as Array<{ id: string }>)[0].id;
    await service.designInspect({ design_session_id: "ds_brief", ids: [patternId], depth: "L1", purpose: { kind: "compare_alternatives", target_ids: [patternId], question: "确认模式" } });
    await service.designDecide({ design_session_id: "ds_brief", design_decisions: architectureDecisions("ds_brief") });
    await service.designSdir({ design_session_id: "ds_brief", mode: "generate_from_decisions" });
    const prepared = await service.designPrepareImplementation({ design_session_id: "ds_brief", platform: "web_desktop", framework: "react" });
    expect(prepared.status).toBe("PASS");
    const brief = prepared.implementation_brief as { mode_plan: { migration_plan: { per_surface: Array<{ treatment: string }> } } };
    expect(brief.mode_plan.migration_plan.per_surface.length).toBeGreaterThan(0);
    expect(brief.mode_plan.migration_plan.per_surface.every((entry) => ["preserve", "rework"].includes(entry.treatment))).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现（designPrepareImplementation）**

按策略读取所需产物：capabilityGates 仅当策略含 `reconcile` 时读取（修订⑧）；sdir/sdir_delta 二选一；轻路径不进入 prepare（其 brief 已在 Task 6 意图门禁生成）：

```ts
const policy = sessionPolicy(session);
const frame = await this.requireArtifact<ProductFrame>(session, "productFrame");
const context = await this.requireArtifact<DesignContext>(session, "designContext");
const decisions = await this.requireArtifact<DesignDecisions>(session, "designDecisions");
const sdirArtifact = await this.sessions.readArtifact<Sdir>(session, "sdir");
const deltaArtifact = await this.sessions.readArtifact<SdirDelta>(session, "sdirDelta");
const understanding = await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding");
const capabilityMap = policy.gates.includes("reconcile")
  ? await this.requireArtifact<CapabilityMap>(session, "capabilityGaps")
  : { needs: [] as CapabilityMap["needs"] };
const states = sdirArtifact?.screen.required_states ?? ["loading", "empty", "ready", "error"];

let modePlan: Record<string, unknown> | undefined;
if (policy.mode === "rework" && understanding !== undefined) {
  modePlan = {
    migration_plan: {
      user_transition: understanding.migration_notes,
      data: understanding.must_preserve,
      per_surface: [
        ...understanding.must_preserve.map((item) => ({ surface: item, treatment: "preserve" })),
        ...understanding.must_replace.map((item) => ({ surface: item, treatment: "rework" })),
        ...understanding.free_to_reconsider.map((item) => ({ surface: item, treatment: "rework" })),
      ],
    },
  };
} else if (policy.change_kind === "add_surface" && understanding !== undefined) {
  modePlan = { integration_plan: { alignment_points: understanding.established_patterns, neighbors: understanding.change_targets, implementation_order: understanding.current_surfaces.map((surface) => surface.id) } };
} else if (policy.change_kind === "modify_surface" && deltaArtifact !== undefined) {
  modePlan = { change_sequence: deltaArtifact.changes.map((change) => ({ region: change.region, action: change.action, rationale: change.rationale })), regression_points: deltaArtifact.regression_points };
}
// validationPlan 依赖 Task 10 的四参签名——本任务先用现有三参调用，Task 10 再升级
const implementationBrief = {
  version: "0.1",
  platform_profile: "WEB-DESKTOP",
  framework: input.framework,
  sdir_ref: sdirArtifact !== undefined ? "screen.sdir.yaml" : "sdir-delta.yaml",
  decision_ref: "design-decisions.yaml",
  approved_patterns: [decisions.primary_structure.pattern],
  approved_component_contracts: this.componentContracts(decisions.primary_structure.pattern),
  states_required: states,
  capability_gaps: capabilityMap.needs.filter((need) => need.status === "gap" || need.status === "blocked"),
  validation_requirements: (await this.validationPlanFor(session)).checks.map((check) => check.id),
  ...(modePlan === undefined ? {} : { mode_plan: modePlan }),
};
```

（`SdirDelta` 从 `prax-sdir` 以 `import type` 引入；`validationPlanFor` 为本任务新增的私有 helper——Task 9 阶段先实现为对现有三参 `this.validator.plan(frame, context, decisions)` 的薄封装（从 artifact 读取三个输入），Task 10 将其升级为上面的策略化对象输入版本，`designValidate` 同步切换，保证两处计划始终同源（修订 M3）。）

- [ ] **Step 4: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(mcp): assemble mode-specific execution plans"`。

---

### Task 10: 验证器按路径 union 化

**Files:**
- Modify: `packages/prax-validator/src/contracts.ts`（ValidationPlanSchema.pattern_ref 可选）
- Modify: `packages/prax-validator/src/validator.ts`（plan 四参 + 轻路径检查集；evaluate 的 sdir/decisions 可选化）
- Modify: `packages/prax-mcp/src/service.ts`（designValidate 按策略传参；恢复 Task 9 的 validation_requirements）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加；import `PraxValidator` from "prax-validator"）**

```ts
describe("policy-aware validation plans", () => {
  const validator = new PraxValidator();
  const base = { frame: architectureProductFrame(), context: architectureContext(), decisions: architectureDecisions("x") };

  it("adds existing-product and rework checks", () => {
    const ids = (policyContext: Record<string, unknown>) =>
      validator.plan({ ...base, policyContext: policyContext as never }).checks.map((check: { id: string }) => check.id);
    expect(ids({ mode: "existing_product", change_kind: "add_surface" })).toContain("untouched_surface_regression");
    expect(ids({ mode: "rework" })).toContain("fresh_derivation_check");
    expect(ids({ mode: "rework" })).toContain("migration_readiness");
    expect(ids({ mode: "greenfield" })).toContain("requirement_alignment");
  });

  it("uses delta-aware checks for modify_surface instead of full-SDIR checks", () => {
    const plan = validator.plan({ ...base, policyContext: { mode: "existing_product", change_kind: "modify_surface" } as never });
    const ids = plan.checks.map((check: { id: string }) => check.id);
    expect(ids).toContain("delta_conformance");
    expect(ids).toContain("untouched_surface_regression");
    expect(ids).not.toContain("semantic_conformance");
    expect(ids).not.toContain("state_completeness");
  });

  it("uses light-path checks without requiring frame or decisions", () => {
    const plan = validator.plan({
      policyContext: { mode: "existing_product", change_kind: "visual_polish" } as never,
      intentLite: intentLite("visual_polish"),
    });
    const ids = plan.checks.map((check: { id: string }) => check.id);
    expect(ids).toContain("hierarchy_preserved");
    expect(ids).toContain("readability");
    expect(ids).not.toContain("semantic_conformance");
    expect(plan.pattern_ref).toBeUndefined();
  });
});
```

（测试文件 import 追加 `intentLite` from fixtures。）

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现**

`validator/contracts.ts`：`ValidationPlanSchema` 的 `pattern_ref` 改 `z.string().min(1).optional()`。

`validator.ts` —— `plan` 改为**对象输入**（修订 B3），`evaluate` 增加 `sdirDelta` 分支（修订 B4）：

```ts
export interface ValidationPlanInput {
  policyContext?: { mode: DesignMode; change_kind?: ChangeKind; authorities?: string[] };
  frame?: ProductFrame;
  context?: DesignContext;
  decisions?: DesignDecisions;
  intentLite?: IntentLite;
}
```

```ts
const REQUIREMENT_CHECK: ValidationCheck = {
  id: "requirement_alignment", label: "Requirement alignment", kind: "assistive",
  requirement: "The delivered result matches the confirmed restatement, scope, and success definition.", evidence_required: true,
};
const EXISTING_CHECKS: ValidationCheck[] = [
  { id: "untouched_surface_regression", label: "Untouched surface regression", kind: "empirical", requirement: "Surfaces outside the declared change targets behave exactly as before.", evidence_required: true },
  { id: "pattern_consistency", label: "Pattern consistency", kind: "assistive", requirement: "The change follows the established patterns recorded in the existing-product understanding.", evidence_required: true },
  { id: "authority_consistency", label: "Design authority consistency", kind: "assistive", requirement: `The result stays consistent with the declared design authorities.`, evidence_required: true },
];
const REWORK_CHECKS: ValidationCheck[] = [
  { id: "fresh_derivation_check", label: "Fresh derivation", kind: "assistive", requirement: "Product objects derive from user tasks, not from copying the legacy structure.", evidence_required: true },
  { id: "migration_readiness", label: "Migration readiness", kind: "empirical", requirement: "The migration plan covers every must_preserve item.", evidence_required: true },
];
const DELTA_CHECKS: ValidationCheck[] = [
  { id: "delta_conformance", label: "Delta conformance", kind: "deterministic", requirement: "The sdir_delta passes referential and render-leak validation.", evidence_required: false },
  ...EXISTING_CHECKS,
  REQUIREMENT_CHECK,
];
const LIGHT_CHECKS: Record<"visual_polish" | "defect_fix", ValidationCheck[]> = {
  visual_polish: [
    { id: "hierarchy_preserved", label: "Hierarchy preserved", kind: "assistive", requirement: "The visual change does not alter the surface's information hierarchy.", evidence_required: true },
    { id: "readability", label: "Readability", kind: "empirical", requirement: "Contrast and type-scale evidence shows text remains readable.", evidence_required: true },
    REQUIREMENT_CHECK,
  ],
  defect_fix: [
    { id: "regression_check", label: "Regression check", kind: "empirical", requirement: "The fix resolves the reported defect without behavior change elsewhere.", evidence_required: true },
    REQUIREMENT_CHECK,
  ],
};
```

`plan(input: ValidationPlanInput)` 装配规则：

- 无 `policyContext` → 通用 + pattern + risk + REQUIREMENT_CHECK（`pattern_ref` 取 `decisions.primary_structure.pattern`）
- `change_kind` ∈ light → 仅 `LIGHT_CHECKS[kind]`，无 `pattern_ref`，不需要 frame/context/decisions
- `change_kind === "modify_surface"` → `DELTA_CHECKS`，`pattern_ref` 取 decisions 的 pattern，不需要完整 SDIR 检查
- `mode === "rework"` → 通用 + pattern + risk + REWORK_CHECKS + REQUIREMENT_CHECK
- 其余 existing → 通用 + pattern + risk + EXISTING_CHECKS + REQUIREMENT_CHECK
- `authority_consistency` 的 requirement 文案动态拼入 `policyContext.authorities` 列表（如 `...authorities: docs/DESIGN.md, design/tokens.yaml.`），无 authorities 时保留通用文案——保证权威真实进入计划（修订 M2）

`evaluate` 输入改 `{ plan, sdir?, sdirDelta?, decisions?, evidence? }`：

- `semantic_conformance` / `state_completeness` 仅当 `plan.checks` 含它们时要求 `sdir` 并运行现有 SDIR 校验
- `delta_conformance` 用 `validateSdirDelta(sdirDelta)`（`import { validateSdirDelta } from "prax-sdir"`——注意 prax-validator 新增对 prax-sdir 的依赖：validator 包 package.json 的 dependencies 增加 `"prax-sdir": "*"` 并确认 workspace 解析，或改为把 delta 校验函数注入以避免新包依赖。**采用依赖注入**：`PraxValidator` 构造器接受可选 `deltaValidator: (input: unknown) => { status: string }`，service 侧传入 `validateSdirDelta`；validator 单测直接传 lambda，避免包间新依赖）
- 其余检查 findings 全部来自证据提交

`service.ts` —— **统一计划入口（修订 M3）**：新增私有 helper，`designValidate` 与 `designPrepareImplementation` 共用：

```ts
private async validationPlanFor(session: DesignSession): Promise<ValidationPlan> {
  const policy = sessionPolicy(session);
  const understanding = await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding");
  const authorities = [...new Set([...session.design_authorities, ...(understanding?.design_authorities ?? [])])];
  const policyContext = {
    mode: session.mode,
    ...(policy.change_kind === undefined ? {} : { change_kind: policy.change_kind }),
    authorities,
  };
  return this.validator.plan({
    policyContext,
    frame: await this.sessions.readArtifact(session, "productFrame") ?? undefined,
    context: await this.sessions.readArtifact(session, "designContext") ?? undefined,
    decisions: await this.sessions.readArtifact(session, "designDecisions") ?? undefined,
    intentLite: await this.sessions.readArtifact(session, "intentLite") ?? undefined,
  });
}
```

`designValidate` 的 plan 改为 `await this.validationPlanFor(session)`；evaluate 组装时按存在性传 `sdir`/`sdirDelta`/`decisions`，并传入构造时注入的 delta 校验（`PraxValidator` 实例化处：`new PraxValidator({ deltaValidator: validateSdirDelta })`——`validateSdirDelta` 从 `prax-sdir` 导入，service 已依赖 prax-sdir ✓）。`designPrepareImplementation` 的 `validation_requirements` 改为 `(await this.validationPlanFor(session)).checks.map((check) => check.id)`（替换 Task 9 的临时占位）。

- [ ] **Step 4: 运行确认 + 提交** — 新测试 PASS、`npm test` 全绿 → `git commit -m "feat(validator): assemble validation checks by lifecycle policy"`。

---

### Task 11: 六路径 e2e + 全量验收 + 文档

**Files:**
- Create: `tests/lifecycle-e2e.test.ts`
- Modify: `README.md`、`docs/architecture.md`

- [ ] **Step 1: 写六路径 e2e**

模板与 Task 8/9 相同（每个 it 一个 tmp 会话，逐步断言 phase）：

1. `existing_product/add_surface`：确认→理解→frame（新面 frame，含 existing_product 块）→context→route→inspect→decide→sdir→reconcile→prepare（断言 brief 含 integration_plan）→validate(plan)
2. `existing_product/modify_surface`：至 prepare（断言 change_sequence）
3. `existing_product/visual_polish`：确认→意图轻录（断言 phase VALIDATION、brief 含 change_list）→validate(plan)（断言检查集为轻量集）
4. `existing_product/defect_fix`：同上，断言仅 regression_check + requirement_alignment
5. `rework`：确认→理解→frame→context→route→inspect→decide→sdir→prepare（断言 migration_plan）→validate(plan)
6. `greenfield` 内联确认一步到位短路径（完整链路由现有 service-e2e 覆盖）

所有 user_quote 使用中文原文。

- [ ] **Step 2: 运行确认全过** — `npx vitest run tests/lifecycle-e2e.test.ts` PASS。

- [ ] **Step 3: 全量验收** — `npm test`（预计 60+ 测试全绿）、`npm run prax -- doctor` 四项 PASS。

- [ ] **Step 4: 文档** — README "MCP workflow" 改为三模式 + change_kind + 确认门禁说明；architecture.md 增补 "Lifecycle policies" 一节（策略表、旧会话别名规范化、按需 reconcile）。

- [ ] **Step 5: 提交** — `git commit -m "test: add lifecycle e2e coverage and document mode-differentiated flows"`。

---

## v2 自审记录

1. **规格覆盖**：三模式（T1）、确认门禁（T4）、理解问题集含覆盖校验（T5）、策略表与旧会话兼容（T1/T3）、sdir_delta 含 capability_needs（T7/T8）、intent-lite 与轻量 brief（T6）、执行计划分化（T6/T9）、验证扩展含 requirement_alignment（T10）、authorities 持久化与使用（T2/T10）、按需 reconcile（T8）。授权偏差仅余一项：add_surface 补 reconcile（v2 头部声明）。
2. **审查项对应**：Blocker 1-7 → errors.ts/T1、T3 本地 DesignOperation、T4 union、T1+T3 别名、T8 持久化、T10 union、T7 完整规则；Major 8-18 → T9、T6、T3、T7、T8、T4、T5、T6/T10、T1(rework 无 reconcile)、T6 fixture、T8 unknown 字段；Minor 19-20 → 各任务 import 清单与 fixture 补全。
3. **类型一致性**：`advanceSession(session, GateName, now)`、`validateSdirDelta → SdirDeltaValidation`、`plan(..., policyContext?)`、`ExistingUnderstanding` 输出类型必填字段在 fixtures 中全部补齐。
