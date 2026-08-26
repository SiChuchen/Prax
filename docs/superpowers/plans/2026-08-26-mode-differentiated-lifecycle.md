# 模式分化生命周期（Mode-Differentiated Lifecycle）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `design_start` 的 mode/change_kind 真正分化生命周期深度：三模式 × 变更类型 × 外部设计权威，新增需求确认与存量理解门禁，SDIR 增量形态，执行计划与验证按模式装配。

**Architecture:** 状态机从硬编码 `ALLOWED_PHASES` 升级为策略表驱动（`lifecycle-policy.ts`）；会话持久化策略快照，旧会话默认完整链（零行为变化）；新门禁复用现有十个工具（design_start 携带确认、design_frame 按 gate 分发载荷、design_sdir 携带 delta）。

**Tech Stack:** TypeScript monorepo、zod、vitest、yaml。规格见 `docs/superpowers/specs/2026-08-26-mode-differentiated-lifecycle-design.md`。

**对规格的两处修正（已获用户授权范围）：**
1. add_surface 门禁序列补 `reconcile`（新面可能引入能力缺口）。
2. 轻路径（visual_polish/defect_fix）无 SDIR，验证计划用路径专属检查集**替换**通用五项（semantic_conformance 等检查假设 SDIR 存在）。

**约定：** 所有命令在 `E:\codex-prj\Prax\Prax` 下执行；`npx vitest run tests/<file>` 为红/绿验证，`npm test`（含 build）为任务收尾验证；每个任务收尾必须 `npm test` 全绿再提交。

---

### Task 1: 生命周期策略表

**Files:**
- Modify: `packages/prax-runtime/src/contracts.ts`（DesignMode 加 rework、ChangeKind、GateName、LifecyclePolicy）
- Create: `packages/prax-runtime/src/lifecycle-policy.ts`
- Modify: `packages/prax-runtime/src/index.ts`（导出新模块）
- Test: `tests/lifecycle-policy.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// tests/lifecycle-policy.test.ts
import { describe, expect, it } from "vitest";
import { lifecyclePolicyFor, DEFAULT_LEGACY_POLICY, GATE_PHASE, NEXT_TOOL_BY_GATE, PraxRuntimeError } from "prax-runtime";

const FULL_TAIL = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];

describe("lifecycle policy", () => {
  it("expands each supported mode and change kind into its gate sequence", () => {
    expect(lifecyclePolicyFor("greenfield").gates).toEqual(["confirm", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("rework").gates).toEqual(["confirm", "understanding", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "add_surface").gates).toEqual(["confirm", "understanding", "framing", ...FULL_TAIL]);
    expect(lifecyclePolicyFor("existing_product", "modify_surface").gates).toEqual([
      "confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate",
    ]);
    expect(lifecyclePolicyFor("existing_product", "visual_polish").gates).toEqual(["confirm", "intent_lite", "validate"]);
    expect(lifecyclePolicyFor("existing_product", "defect_fix").gates).toEqual(["confirm", "intent_lite", "validate"]);
  });

  it("rejects invalid mode and change_kind combinations", () => {
    expect(() => lifecyclePolicyFor("greenfield", "defect_fix")).toThrowError(PraxRuntimeError);
    expect(() => lifecyclePolicyFor("existing_product")).toThrowError(PraxRuntimeError);
  });

  it("keeps the legacy default policy identical to the old hard-coded flow", () => {
    expect(DEFAULT_LEGACY_POLICY.gates).toEqual(["framing", ...FULL_TAIL]);
  });

  it("maps every gate to a phase and a next tool", () => {
    expect(GATE_PHASE.confirm).toBe("REQUIREMENT_CONFIRMATION");
    expect(GATE_PHASE.understanding).toBe("UNDERSTANDING");
    expect(GATE_PHASE.intent_lite).toBe("INTENT_LITE");
    expect(NEXT_TOOL_BY_GATE.confirm).toBe("design_start");
    expect(NEXT_TOOL_BY_GATE.understanding).toBe("design_frame");
    for (const gate of DEFAULT_LEGACY_POLICY.gates) {
      expect(GATE_PHASE[gate]).toBeDefined();
      expect(NEXT_TOOL_BY_GATE[gate]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npx vitest run tests/lifecycle-policy.test.ts`，预期模块不存在报错。

- [ ] **Step 3: 实现**

`contracts.ts` 中 `DesignModeSchema` 改为 `z.enum(["greenfield", "existing_product", "rework"])`，并追加：

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

`DesignPhaseSchema` 枚举追加 `"REQUIREMENT_CONFIRMATION"`, `"UNDERSTANDING"`, `"INTENT_LITE"`（追加在 `"NEW"` 之后即可，顺序无关）。

```ts
// packages/prax-runtime/src/lifecycle-policy.ts
import { PraxRuntimeError, type ChangeKind, type DesignMode, type DesignPhase, type GateName, type LifecyclePolicy } from "./contracts.js";

const FULL_TAIL: GateName[] = ["context", "route", "decide", "sdir", "reconcile", "prepare", "validate"];

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
  sdir_delta_placeholder: undefined as never, // 删除本行：见下方真实条目
  reconcile: "CAPABILITY_RECONCILIATION",
  prepare: "IMPLEMENTATION_READY",
  validate: "VALIDATION",
} as Record<GateName, DesignPhase>;
GATE_PHASE.sdir_delta = "SDIR";

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
  return { version: "1", mode, gates: ["confirm", "understanding", "framing", ...FULL_TAIL] };
}
```

**注意：上面 `GATE_PHASE` 里的 `sdir_delta_placeholder` 行是笔误示例——实现时直接写完整的 12 键映射，不要保留占位行。** `index.ts` 追加 `export * from "./lifecycle-policy.js";`。

- [ ] **Step 4: 运行确认通过** — `npx vitest run tests/lifecycle-policy.test.ts` PASS。
- [ ] **Step 5: 提交** — `git add -A && git commit -m "feat(runtime): add lifecycle policy table for mode-differentiated flows"`

---

### Task 2: 会话持久化策略 + 新产物登记

**Files:**
- Modify: `packages/prax-runtime/src/contracts.ts`（DesignSessionSchema + 4 个新 Schema + ARTIFACT_FILES）
- Modify: `packages/prax-runtime/src/artifact-store.ts`（ARTIFACT_SCHEMAS、createSession 接受策略）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加到 lifecycle-policy.test.ts）**

```ts
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileSessionStore, DesignSessionSchema } from "prax-runtime";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("session policy persistence", () => {
  it("stores the policy snapshot and starts at the policy's first gate phase", async () => {
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
    });
    expect(session.lifecycle_policy?.gates[0]).toBe("confirm");
    expect(session.phase).toBe("REQUIREMENT_CONFIRMATION");
  });

  it("parses legacy sessions without a policy field", () => {
    const legacy = DesignSessionSchema.parse({
      id: "ds_old", project_root: "/tmp/p", mode: "greenfield", phase: "PRODUCT_FRAMING",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
      requirement_ref: "requirement.md", completed_gates: [], current_gate: { name: "product_framing" },
      disclosures: [], routing_history: [], artifacts: {}, unresolved: [], warnings: [],
    });
    expect(legacy.lifecycle_policy).toBeUndefined();
  });
});
```

文件顶部补充 `afterEach` 的 vitest 导入（`import { afterEach, describe, expect, it } from "vitest";`）。

- [ ] **Step 2: 运行确认失败**（lifecycle_policy 属性不存在 / createSession 不接受该参数）。

- [ ] **Step 3: 实现**

`contracts.ts` 新增四个产物 Schema（`NonEmptyStringSchema` 简写 `NE`）：

```ts
export const RequirementConfirmationSchema = z.object({
  version: z.literal("0.1"),
  user_quote: z.array(NonEmptyStringSchema).min(1),
  restatement: NonEmptyStringSchema,
  boundaries: z.object({
    in_scope: z.array(NonEmptyStringSchema).min(1),
    out_of_scope: z.array(NonEmptyStringSchema).min(1),
  }),
  open_questions: z.array(MaterialUnknownSchema).default([]),
  confirmed_with_user: z.literal(true),
  confirmed_at: z.string().datetime(),
});
export type RequirementConfirmation = z.infer<typeof RequirementConfirmationSchema>;

export const ExistingUnderstandingSchema = z.object({
  version: z.literal("0.1"),
  current_objects: z.array(z.object({
    id: NonEmptyStringSchema,
    user_name: NonEmptyStringSchema,
    purpose: NonEmptyStringSchema,
    evidence_refs: z.array(NonEmptyStringSchema).default([]),
  })).default([]),
  current_surfaces: z.array(z.object({
    id: NonEmptyStringSchema,
    purpose: NonEmptyStringSchema,
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

export const IntentLiteSchema = z.object({
  version: z.literal("0.1"),
  kind: z.enum(["visual_polish", "defect_fix"]),
  surfaces: z.array(NonEmptyStringSchema).min(1),
  current_hierarchy_summary: NonEmptyStringSchema,
  change: NonEmptyStringSchema,
  basis: NonEmptyStringSchema,
  evidence_refs: z.array(NonEmptyStringSchema).default([]),
  regression_points: z.array(NonEmptyStringSchema).min(1),
});
export type IntentLite = z.infer<typeof IntentLiteSchema>;
```

`DesignSessionSchema` 追加字段 `lifecycle_policy: LifecyclePolicySchema.optional(),`。`ARTIFACT_FILES` 追加四项：

```ts
requirementConfirmation: "requirement-confirmation.yaml",
existingUnderstanding: "existing-understanding.yaml",
intentLite: "intent-lite.yaml",
sdirDelta: "sdir-delta.yaml",
```

`artifact-store.ts`：`ARTIFACT_SCHEMAS` 追加 `requirementConfirmation: RequirementConfirmationSchema, existingUnderstanding: ExistingUnderstandingSchema, intentLite: IntentLiteSchema`（sdirDelta 在 Task 7 定义于 prax-sdir，届时无运行时 schema，读取时不重验，由 service 用 prax-sdir 校验）。`createSession` 入参加 `lifecyclePolicy?: LifecyclePolicy`，session 初始化：

```ts
const session: DesignSession = {
  // ...现有字段不变...
  ...(input.lifecyclePolicy === undefined ? {} : { lifecycle_policy: input.lifecyclePolicy }),
  phase: input.lifecyclePolicy === undefined ? "PRODUCT_FRAMING" : GATE_PHASE[input.lifecyclePolicy.gates[0]!],
};
```

（`GATE_PHASE` 从 `./lifecycle-policy.js` 导入；`current_gate.name` 同步用 `input.lifecyclePolicy?.gates[0] ?? "product_framing"`。）

- [ ] **Step 4: 运行确认通过** — `npx vitest run tests/lifecycle-policy.test.ts`，然后 `npm test`（38 旧测试必须仍全绿）。
- [ ] **Step 5: 提交** — `git commit -m "feat(runtime): persist lifecycle policy and register new artifacts"`

---

### Task 3: 状态机策略化

**Files:**
- Modify: `packages/prax-runtime/src/state-machine.ts`（重写为策略驱动）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加）**

```ts
import { checkOperationAllowed, advanceSession } from "prax-runtime";

function sessionWith(gates: string[], completed: string[]) {
  return {
    id: "ds_sm", project_root: "/tmp/p", mode: "existing_product", phase: "UNDERSTANDING",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), revision: 1,
    requirement_ref: "requirement.md", completed_gates: completed, current_gate: { name: "understanding" },
    disclosures: [], routing_history: [], artifacts: {}, unresolved: [], warnings: [],
    lifecycle_policy: { version: "1" as const, mode: "existing_product" as const, change_kind: "modify_surface" as const, gates },
  } as const;
}

describe("policy-driven state machine", () => {
  const modify = ["confirm", "understanding", "route", "decide", "sdir_delta", "prepare", "validate"];

  it("allows the operation that owns the current gate and blocks others with the next tool", () => {
    const session = sessionWith(modify, ["confirm"]);
    expect(checkOperationAllowed(session as never, "design_frame")).toBeUndefined();
    const blocked = checkOperationAllowed(session as never, "design_decide");
    expect(blocked?.status).toBe("BLOCK");
    expect(blocked?.next).toEqual({ tool: "design_frame" });
  });

  it("advances past a gate and lands on the next gate's phase", () => {
    const session = sessionWith(modify, ["confirm"]);
    const advanced = advanceSession(session as never, "understanding", "2026-08-26T00:00:00.000Z");
    expect(advanced.phase).toBe("ROUTING");
    expect(advanced.completed_gates).toContain("understanding");
  });

  it("falls back to the legacy full chain when the session has no policy", () => {
    const legacy = { ...sessionWith(["framing"], []), lifecycle_policy: undefined };
    expect(checkOperationAllowed(legacy as never, "design_frame")).toBeUndefined();
    expect(checkOperationAllowed(legacy as never, "design_decide")?.status).toBe("BLOCK");
  });
});
```

- [ ] **Step 2: 运行确认失败**（advanceSession 仍按 operation 签名）。

- [ ] **Step 3: 重写 state-machine.ts**

保留 `DESIGN_OPERATIONS`、`DesignOperation` 导出（service/测试引用）。删除 `ALLOWED_PHASES`、`PHASE_AFTER_PASS`、`NEXT_TOOL_BY_PHASE`，替换为：

```ts
import type { DesignOperation, DesignSession, GateResult, GateName } from "./contracts.js";
import { DEFAULT_LEGACY_POLICY, GATE_PHASE, NEXT_TOOL_BY_GATE } from "./lifecycle-policy.js";
import type { LifecyclePolicy } from "./contracts.js";

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
  const done = new Set(session.completed_gates);
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
  const completed = session.completed_gates.includes(gate) ? session.completed_gates : [...session.completed_gates, gate];
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

**关键适配——`service.ts` 中所有 `advanceSession(session, "design_xxx", ...)` 调用改为对应 gate 名**：design_frame→`"framing"`、design_context→`"context"`、design_route→`"route"`、design_decide→`"decide"`、design_sdir→`"sdir"`、design_reconcile→`"reconcile"`、design_prepare_implementation→`"prepare"`。`designValidate` 的 COMPLETE 逻辑保留：evaluate PASS 时 `completed_gates` 追加 `"validate"`、phase 置 `"COMPLETE"`（等价于 advanceSession 后再覆盖 phase）。

**另一处适配**：`service.ts` 的 `designSdir` 中 P3 的后续阶段只读 validate 路径（`input.mode === "validate" && session.phase !== "SDIR"` 分支）必须放在 `operationBlock` **之前**执行，否则策略门禁会拦掉跨阶段只读回验。实现：把该 if 块移到 `operationBlock` 调用前。

- [ ] **Step 4: 运行确认** — `npx vitest run tests/lifecycle-policy.test.ts` PASS；`npm test` 全绿（e2e 走 legacy 默认策略，行为不变）。
- [ ] **Step 5: 提交** — `git commit -m "feat(runtime): drive the state machine from session lifecycle policies"`

---

### Task 4: 需求确认门禁 + design_start 流程

**Files:**
- Modify: `packages/prax-runtime/src/gate-validation.ts`（validateRequirementConfirmation）
- Modify: `packages/prax-mcp/src/schemas.ts`（DesignStartInputSchema）
- Modify: `packages/prax-mcp/src/service.ts`（designStart 创建/续确认）
- Modify: `tests/fixtures.ts`（requirementConfirmation()）
- Modify: `tests/mcp-protocol.test.ts`、`tests/service-e2e.test.ts`、`tests/runtime-and-routing.test.ts`（designStart 调用点补确认载荷）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: fixtures 增加构造器**

```ts
// tests/fixtures.ts 追加
import type { RequirementConfirmation } from "prax-runtime";

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

- [ ] **Step 2: 写失败测试（追加到 lifecycle-policy.test.ts，需 PraxService）**

```ts
import { PraxService } from "prax-mcp";
import { requirementConfirmation } from "./fixtures.js";

describe("requirement confirmation gate", () => {
  async function setup(mode: "greenfield" | "rework" = "greenfield") {
    const root = await mkdtemp(join(tmpdir(), "prax-confirm-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new (await import("prax-runtime")).FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_confirm" });
    const service = await PraxService.create({ sessions: store });
    return { service, projectRoot, store };
  }

  it("creates a session awaiting confirmation and accepts the resume submission", async () => {
    const { service, projectRoot, store } = await setup();
    const created = await service.designStart({ requirement: "Build a canvas", project_root: projectRoot, mode: "greenfield" });
    expect(created.status).toBe("PASS");
    expect(created.phase).toBe("REQUIREMENT_CONFIRMATION");
    expect(created.next).toEqual({ tool: "design_start" });

    const confirmed = await service.designStart({
      design_session_id: "ds_confirm",
      requirement_confirmation: requirementConfirmation(),
    });
    expect(confirmed.status).toBe("PASS");
    expect(confirmed.phase).toBe("PRODUCT_FRAMING");
    expect((await store.getSession("ds_confirm")).artifacts.requirementConfirmation).toBeDefined();
  });

  it("accepts a complete confirmation inline at session creation", async () => {
    const { service, projectRoot } = await setup();
    const started = await service.designStart({
      requirement: "Build a canvas", project_root: projectRoot, mode: "greenfield",
      requirement_confirmation: requirementConfirmation(),
    });
    expect(started.status).toBe("PASS");
    expect(started.phase).toBe("PRODUCT_FRAMING");
  });

  it("rejects an incomplete confirmation with actionable issues", async () => {
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

`schemas.ts`：

```ts
export const DesignStartInputSchema = z
  .object({
    requirement: z.string().trim().min(1),
    project_root: z.string().trim().min(1),
    mode: DesignModeSchema,
    change_kind: ChangeKindSchema.optional(),
    design_authorities: z.array(z.string().trim().min(1)).default([]),
    project_id: z.string().trim().min(1).optional(),
    design_session_id: SessionId.optional(),
    requirement_confirmation: RequirementConfirmationSchema.optional(),
  })
  .superRefine((input, ctx) => {
    if (input.design_session_id === undefined && (input.requirement_confirmation !== undefined || input.change_kind === undefined)) {
      if (input.mode === "existing_product" && input.change_kind === undefined) {
        ctx.addIssue({ code: "custom", path: ["change_kind"], message: "existing_product sessions require change_kind." });
      }
    }
    if (input.design_session_id !== undefined && input.requirement_confirmation === undefined) {
      ctx.addIssue({ code: "custom", path: ["requirement_confirmation"], message: "resuming design_start requires requirement_confirmation." });
    }
  });
```

（`RequirementConfirmationSchema`、`ChangeKindSchema` 从 `prax-runtime` 导入。）

`service.ts` 的 `designStart` 重写：

```ts
public async designStart(input: DesignStartInput): Promise<PraxOutput> {
  if (input.design_session_id !== undefined) {
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
    if (error instanceof PraxRuntimeError) {
      return { status: "BLOCK", code: error.code, message: error.message };
    }
    throw error;
  }
  const session = await this.sessions.createSession({
    projectRoot: input.project_root,
    requirement: input.requirement,
    mode: input.mode,
    ...(input.project_id === undefined ? {} : { projectId: input.project_id }),
    lifecyclePolicy: policy,
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

（`currentGate`、`NEXT_TOOL_BY_GATE`、`lifecyclePolicyFor` 从对应包导入；`PraxRuntimeError` 从 `prax-runtime` 导入。）

**更新既有调用点**（一次性补 `requirement_confirmation: requirementConfirmation()`）：`tests/mcp-protocol.test.ts` 的 design_start 调用、`tests/service-e2e.test.ts`、`tests/runtime-and-routing.test.ts` 中 escape 测试与 revalidate 测试的 designStart。注意 escape 测试原本断言 `designFrame` 直接可用——确认后 phase 为 PRODUCT_FRAMING，流程不变。

- [ ] **Step 5: 运行确认** — `npx vitest run tests/lifecycle-policy.test.ts` PASS；`npm test` 全绿。
- [ ] **Step 6: 提交** — `git commit -m "feat(mcp): gate every session behind a structured requirement confirmation"`

---

### Task 5: 存量理解校验

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
    constraints_and_debt: ["无虚拟化"],
    change_targets: ["settings"],
    design_authorities: ["docs/DESIGN.md"],
  };

  it("accepts a complete existing-product understanding", () => {
    expect(validateExistingUnderstanding(existingInput, "existing_product", "modify_surface").status).toBe("PASS");
  });

  it("rejects change targets that do not map to declared surfaces", () => {
    const bad = { ...existingInput, change_targets: ["billing"] };
    const result = validateExistingUnderstanding(bad, "existing_product", "modify_surface");
    expect(result.status).toBe("EXPAND");
    expect(result.codes).toContain("CHANGE_TARGET_NOT_DECLARED");
  });

  it("requires pain points and exclusive buckets for rework", () => {
    const reworkInput = {
      version: "0.1" as const,
      actual_usage: ["从画布进、逐节点排查"],
      pain_points: [],
      must_preserve: ["flow 数据"],
      must_replace: ["导航结构"],
      free_to_reconsider: ["配色"],
      design_authorities: [],
    };
    const noPain = validateExistingUnderstanding(reworkInput, "rework");
    expect(noPain.status).toBe("EXPAND");
    expect(noPain.codes).toContain("REWORK_PAIN_POINTS_MISSING");

    const conflicting = { ...reworkInput, pain_points: ["导航迷路"], free_to_reconsider: ["导航结构"] };
    const conflict = validateExistingUnderstanding(conflicting, "rework");
    expect(conflict.codes).toContain("REWORK_BUCKET_CONFLICT");
  });
});
```

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现（gate-validation.ts 追加）**

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
    const buckets: Array<[string, string[]]> = [
      ["must_preserve", data.must_preserve],
      ["must_replace", data.must_replace],
      ["free_to_reconsider", data.free_to_reconsider],
    ];
    const seen = new Map<string, string>();
    for (const [bucket, items] of buckets) {
      for (const item of items) {
        const prior = seen.get(item);
        if (prior !== undefined) {
          codes.push("REWORK_BUCKET_CONFLICT");
          issues.push(`'${item}' appears in both ${prior} and ${bucket}; the three buckets must be exclusive.`);
        }
        seen.set(item, bucket);
      }
    }
    if (data.actual_usage.length === 0) {
      codes.push("UNDERSTANDING_INCOMPLETE");
      issues.push("rework understanding requires actual_usage evidence.");
    }
  }

  if (data.design_authorities.length === 0) {
    warnings.push("No external design authorities declared; decisions will be checked only against the built-in pack.");
  }

  return { status: issues.length === 0 ? (warnings.length === 0 ? "PASS" : "WARN") : "EXPAND", issues, warnings, codes, value: data };
}
```

- [ ] **Step 4: 运行确认** — 新测试 PASS；`npm test` 全绿。
- [ ] **Step 5: 提交** — `git commit -m "feat(runtime): validate mode-specific existing-system understanding"`

---

### Task 6: design_frame 三载荷分发

**Files:**
- Modify: `packages/prax-mcp/src/schemas.ts`（DesignFrameInputSchema）
- Modify: `packages/prax-mcp/src/service.ts`（designFrame 按 gate 分发）
- Modify: `packages/prax-runtime/src/gate-validation.ts`（validateIntentLite + rework 的 frame 规则）
- Modify: `tests/fixtures.ts`（existingUnderstanding/reworkUnderstanding/intentLite 构造器）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: fixtures 追加**

```ts
import type { ExistingUnderstanding, IntentLite } from "prax-runtime";

export function architectureUnderstanding(changeTargets: string[] = ["settings"]): ExistingUnderstanding {
  return {
    version: "0.1",
    current_objects: [
      { id: "architecture_node", user_name: "架构节点", purpose: "系统组成部分", evidence_refs: ["app/architecture"] },
      { id: "preference", user_name: "配置项", purpose: "改变产品行为", evidence_refs: ["app/settings"] },
    ],
    current_surfaces: [{ id: "canvas", purpose: "架构画布" }, { id: "settings", purpose: "配置" }],
    established_patterns: ["PAT-CANVAS-WORKSPACE"],
    user_habits: ["左侧导航切换"],
    constraints_and_debt: [],
    change_targets: changeTargets,
    design_authorities: ["docs/DESIGN.md"],
  };
}

export function reworkUnderstanding(): ExistingUnderstanding {
  return {
    version: "0.1",
    actual_usage: ["从画布进、逐节点排查关系"],
    pain_points: ["全局关系一屏太多，聚焦后丢失方位"],
    must_preserve: ["flow 数据", "节点选中习惯"],
    must_replace: ["导航结构"],
    free_to_reconsider: ["配色"],
    migration_notes: ["旧入口保留一个月"],
    design_authorities: [],
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

- [ ] **Step 2: 写失败测试（追加）**

```ts
describe("design frame payload dispatch", () => {
  async function confirmedService(mode: "rework" | "existing_product", changeKind?: "modify_surface" | "visual_polish") {
    const root = await mkdtemp(join(tmpdir(), "prax-frame-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new (await import("prax-runtime")).FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_frame" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "x", project_root: projectRoot, mode,
      ...(changeKind === undefined ? {} : { change_kind: changeKind }),
      requirement_confirmation: requirementConfirmation(),
    });
    return { service };
  }

  it("routes an understanding payload through the understanding gate for rework", async () => {
    const { service } = await confirmedService("rework");
    const result = await service.designFrame({ design_session_id: "ds_frame", existing_understanding: reworkUnderstanding() });
    expect(result.status).toBe("PASS");
    expect(result.phase).toBe("PRODUCT_FRAMING");
  });

  it("routes an intent-lite payload through the intent_lite gate", async () => {
    const { service } = await confirmedService("existing_product", "visual_polish");
    const result = await service.designFrame({ design_session_id: "ds_frame", intent_lite: intentLite("visual_polish") });
    expect(result.status).toBe("PASS");
    expect(result.phase).toBe("VALIDATION");
  });

  it("rejects a product frame while the session expects understanding", async () => {
    const { service } = await confirmedService("rework");
    const result = await service.designFrame({ design_session_id: "ds_frame", product_frame: architectureProductFrame() });
    expect(result.status).toBe("EXPAND");
    expect(JSON.stringify(result)).toMatch(/existing_understanding/);
  });
});
```

（`architectureProductFrame`、`reworkUnderstanding`、`intentLite` 从 `./fixtures.js` 导入。）

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

`gate-validation.ts` 追加 `validateIntentLite`：

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
  if (parsed.data.evidence_refs.length === 0) {
    codes.push("INTENT_EVIDENCE_MISSING");
    issues.push("intent_lite requires evidence_refs pointing at the review finding, user quote, or authority section.");
  }
  return { status: issues.length === 0 ? "PASS" : "EXPAND", issues, warnings: [], codes, value: parsed.data };
}
```

`validateProductFrame` 的 existing_product 块要求改为仅 `mode === "existing_product"` 时生效（`rework` 不要求——现有代码已是此判断，确认无需改动即可）。`service.ts` 的 `designFrame` 重写为按 `currentGate(session)` 分发：

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
    const validation = validateIntentLite(input.intent_lite, session.lifecycle_policy?.change_kind === "visual_polish" ? "visual_polish" : "defect_fix");
    if (validation.status !== "PASS") {
      return { status: validation.status, issues: validation.issues, codes: validation.codes ?? [], warnings: [], next: nextTool("design_frame") };
    }
    const updated = advanceSession(session, "intent_lite", now);
    await this.sessions.commit(updated, [{ key: "intentLite", value: validation.value }]);
    return { status: "PASS", phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
  }

  // framing gate（含 legacy 会话）
  if (input.product_frame === undefined) {
    return { status: "EXPAND", issues: ["The framing gate expects a product_frame payload."], next: nextTool("design_frame") };
  }
  const validation = validateProductFrame(input.product_frame, session.mode);
  if (validation.status !== "PASS" && validation.status !== "WARN") {
    return { status: validation.status, missing_or_uncertain: validation.issues, warnings: validation.warnings, next: nextTool("design_frame") };
  }
  const updated = advanceSession(session, "framing", now);
  await this.sessions.commit(updated, [{ key: "productFrame", value: validation.value }]);
  return { status: validation.status, missing_or_uncertain: [], warnings: validation.warnings, phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
}
```

**注意**：legacy 会话（无 policy）`currentGate` 为 `"framing"` → 走最后一分支，返回结构与今天一致；但今天的返回有 `next: design_context`，`NEXT_TOOL_BY_GATE[currentGate(updated)]` 在 advance 后 gate 变 context → `design_context` ✓ 一致。e2e 的 `designFrame` 后 `designContext` 断言 `status === "PASS"`，保持。

- [ ] **Step 5: 运行确认** — 新测试 PASS；`npm test` 全绿。
- [ ] **Step 6: 提交** — `git commit -m "feat(mcp): dispatch design_frame payloads by lifecycle gate"`

---

### Task 7: SDIR 增量（prax-sdir）

**Files:**
- Modify: `packages/prax-sdir/src/contracts.ts`（SdirDeltaSchema）
- Create: `packages/prax-sdir/src/delta.ts`
- Modify: `packages/prax-sdir/src/index.ts`
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加）**

```ts
import { validateSdirDelta } from "prax-sdir";

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
  };

  it("accepts a well-formed delta", () => {
    const result = validateSdirDelta(delta);
    expect(result.status).toBe("PASS");
  });

  it("rejects changes targeting undeclared regions", () => {
    const bad = structuredClone(delta);
    bad.changes[0].region = "ghost";
    const result = validateSdirDelta(bad);
    expect(result.status).toBe("RETRY");
    expect(result.semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RELATION_REGION_NOT_FOUND");
  });

  it("rejects render-level leakage in change fields", () => {
    const bad = structuredClone(delta);
    bad.changes[0].fields = { width: "320px" };
    const result = validateSdirDelta(bad);
    expect(result.status).toBe("RETRY");
    expect(result.semantic_issues.map((issue: { code: string }) => issue.code)).toContain("SDIR_RENDER_LEVEL_LEAK");
  });
});
```

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现**

`contracts.ts` 追加：

```ts
export const SdirDeltaChangeSchema = z.object({
  region: NonEmpty,
  action: z.enum(["add", "modify", "remove", "preserve_explicit"]),
  fields: z.record(z.string(), z.unknown()).default({}),
  rationale: NonEmpty,
  ...(role 字段：z.object({ role: NonEmpty.optional() }) 合并进上面对象——即 role: NonEmpty.optional()),
});
```

实际写成：

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

`delta.ts`（render-leak 检查复用 engine 的正则——将 `FORBIDDEN_KEY`/`FORBIDDEN_VALUE` 从 engine.ts 导出，或复制到 delta.ts 并从 engine 导入；选择：在 engine.ts 中 `export const FORBIDDEN_KEY = ...` 改为导出）：

```ts
import { zodIssues } from "prax-runtime";
import { SdirDeltaSchema, type SdirDelta, type SdirDeltaValidation, type SdirIssue } from "./contracts.js";
import { FORBIDDEN_KEY, FORBIDDEN_VALUE } from "./engine.js";

export function validateSdirDelta(input: unknown): SdirDeltaValidation {
  const parsed = SdirDeltaSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "RETRY", schema_errors: zodIssues(parsed.error), semantic_errors: [], semantic_issues: [] };
  }
  const delta = parsed.data;
  const issues: SdirIssue[] = [];
  const declared = new Set(delta.base_regions.map((region) => region.id));
  const added = new Set(delta.changes.filter((change) => change.action === "add").map((change) => change.region));
  delta.changes.forEach((change, index) => {
    if (change.action !== "add" && !declared.has(change.region)) {
      issues.push({
        code: "SDIR_RELATION_REGION_NOT_FOUND",
        message: `changes[${index}].region '${change.region}' is not a declared base region; only add actions may introduce new regions.`,
      });
    }
    if (change.action === "add" && declared.has(change.region)) {
      issues.push({
        code: "SDIR_REGION_ID_DUPLICATE",
        message: `changes[${index}] adds '${change.region}' which already exists in base_regions.`,
      });
    }
    if (change.action === "add" && change.role === undefined) {
      issues.push({ code: "SDIR_REGION_ROLE_MISSING", message: `changes[${index}] adds '${change.region}' without a role.` });
    }
    for (const [key, value] of Object.entries(change.fields)) {
      if (FORBIDDEN_KEY.test(key)) {
        issues.push({ code: "SDIR_RENDER_LEVEL_LEAK", message: `changes[${index}].fields.${key}: render-level key is forbidden in SDIR deltas.` });
      }
      if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) {
        issues.push({ code: "SDIR_RENDER_LEVEL_LEAK", message: `changes[${index}].fields.${key}: render-level value '${value}' is forbidden.` });
      }
    }
  });
  if (issues.length > 0) {
    return { status: "RETRY", schema_errors: [], semantic_errors: issues.map((issue) => issue.message), semantic_issues: issues };
  }
  return { status: "PASS", schema_errors: [], semantic_errors: [], semantic_issues: [], value: delta };
}
```

`engine.ts` 将 `FORBIDDEN_KEY`、`FORBIDDEN_VALUE` 声明改为 `export const`。`index.ts` 追加 `export * from "./delta.js";`。

- [ ] **Step 4: 运行确认** — 新测试 PASS；`npm test` 全绿。
- [ ] **Step 5: 提交** — `git commit -m "feat(sdir): add semantic delta validation for modify_surface"`

---

### Task 8: design_sdir 增量路径 + modify 路径的 route 输入派生

**Files:**
- Modify: `packages/prax-mcp/src/schemas.ts`（DesignSdirInputSchema + sdir_delta）
- Modify: `packages/prax-mcp/src/service.ts`（designSdir gate 分发；designRoute 无 frame/context 时的理解派生）
- Modify: `tests/fixtures.ts`（sdirDelta()）
- Test: `tests/lifecycle-policy.test.ts`（追加 modify_surface 全路径）

- [ ] **Step 1: fixtures 追加**

```ts
import type { SdirDelta } from "prax-sdir";

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
      { region: "search", action: "add", role: "supporting_toolbar", rationale: "长列表需要检索" },
    ],
    preserved: ["settings_navigation"],
    regression_points: ["键盘路径", "保存态可见性"],
  };
}
```

- [ ] **Step 2: 写失败测试（追加）**

```ts
describe("modify_surface path", () => {
  it("runs confirm → understanding → route → decide → sdir_delta end to end", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-modify-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new (await import("prax-runtime")).FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_modify" });
    const service = await PraxService.create({ sessions: store });
    await service.designStart({
      requirement: "把设置页改成分区检索式", project_root: projectRoot, mode: "existing_product", change_kind: "modify_surface",
      requirement_confirmation: requirementConfirmation(),
    });

    const understood = await service.designFrame({ design_session_id: "ds_modify", existing_understanding: architectureUnderstanding(["settings"]) });
    expect(understood.phase).toBe("ROUTING");

    const routed = await service.designRoute({ design_session_id: "ds_modify", question: "如何在设置页承载检索与分区" });
    expect(routed.status).toMatch(/PASS|EXPAND/);
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
});
```

- [ ] **Step 3: 运行确认失败。**

- [ ] **Step 4: 实现**

`schemas.ts` 的 `DesignSdirInputSchema` 增加 `sdir_delta: SdirDeltaSchema.optional()`（从 prax-sdir 导入）。`service.ts`：

designSdir 在读取 decisions 之前按 gate 分发（gate === "sdir_delta" 时）：

```ts
if (currentGate(session) === "sdir_delta") {
  if (input.sdir_delta === undefined) {
    return { status: "RETRY", issues: ["The sdir_delta gate expects a sdir_delta payload."], next: nextTool("design_sdir") };
  }
  const validation = validateSdirDelta(input.sdir_delta);
  if (validation.status !== "PASS") {
    return { status: validation.status, schema_errors: validation.schema_errors, semantic_errors: validation.semantic_errors, semantic_issues: validation.semantic_issues, warnings: [], next: nextTool("design_sdir") };
  }
  const updated = advanceSession(session, "sdir_delta", this.sessions.nowIso());
  await this.sessions.commit(updated, [{ key: "sdirDelta", value: validation.value }]);
  return { status: "PASS", sdir_delta: validation.value, phase: updated.phase, next: nextTool(NEXT_TOOL_BY_GATE[currentGate(updated)]) };
}
```

`validateSdirDelta` 从 `prax-sdir` 导入。同时把 P3 的跨阶段只读 validate 分支移到 `operationBlock` 之前（若 Task 3 尚未处理）。

designRoute：frame/context artifact 缺失时（modify 路径），从 understanding + confirmation 派生路由输入并在 routing log 记录 `derived_from_understanding: true`：

```ts
const frameArtifact = await this.sessions.readArtifact<ProductFrame>(session, "productFrame");
const contextArtifact = await this.sessions.readArtifact<DesignContext>(session, "designContext");
const understanding = await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding");
const confirmation = await this.sessions.readArtifact<RequirementConfirmation>(session, "requirementConfirmation");
const frame = frameArtifact ?? derivedFrame(understanding, confirmation);
const context = contextArtifact ?? derivedContext(understanding, confirmation);
```

其中（service 私有函数）：

```ts
private derivedFrame(understanding: ExistingUnderstanding | undefined, confirmation: RequirementConfirmation | undefined): ProductFrame {
  return ProductFrameSchema.parse({
    user: { primary_role: "existing product user", expertise: "mixed", familiarity: "high" },
    goal: { primary: confirmation?.restatement ?? "modify the existing surface" },
    tasks: { primary: understanding?.change_targets.join(", ") ?? "modify surface", secondary: [] },
    product_objects: understanding?.current_objects.map((object) => ({ id: object.id, user_name: object.user_name, purpose: object.purpose })) ?? [],
    relationships: [],
    mental_model_hypothesis: { summary: "derived from existing understanding", confidence: "medium", evidence: ["existing_product"] },
    primary_success_definition: "the change preserves the existing product model",
    open_questions: [],
  });
}

private derivedContext(understanding: ExistingUnderstanding | undefined, confirmation: RequirementConfirmation | undefined): DesignContext {
  return DesignContextSchema.parse({
    user: { expertise: "mixed", familiarity: "high" },
    task: { primary: understanding?.change_targets.join(", ") ?? "modify", modes: ["modify"], frequency: "medium" },
    domain: { type: understanding?.current_surfaces.map((surface) => surface.id).join(", ") ?? "existing product", entities: understanding?.current_objects.map((object) => object.id) ?? ["surface"] },
    information: { volume: "medium", relationship_complexity: "low", change_rate: "low", comparison_need: "medium" },
    platform: { family: "web", form_factor: "desktop", input: ["pointer", "keyboard"], viewport: "large" },
    risk: { destructive_actions: "none", error_cost: "medium" },
    priorities: confirmation ? ["preserve existing habits"] : ["consistency"],
    density_intent: "regular",
    confidence: { overall: "medium" },
    unknowns: [],
  });
}
```

两个 artifact 任一缺失且 understanding 也缺失时，沿用现有 `requireArtifact` 抛错行为（由 invoke 转 BLOCK）。

- [ ] **Step 5: 运行确认** — 新测试 PASS；`npm test` 全绿。
- [ ] **Step 6: 提交** — `git commit -m "feat(mcp): support the modify_surface path with sdir deltas and derived routing"`

---

### Task 9: 执行计划按模式分化

**Files:**
- Modify: `packages/prax-mcp/src/service.ts`（designPrepareImplementation）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加）**

```ts
describe("mode-differentiated implementation brief", () => {
  it("attaches a migration plan for rework sessions", async () => {
    const root = await mkdtemp(join(tmpdir(), "prax-brief-"));
    cleanup.push(root);
    const projectRoot = join(root, "project");
    await mkdir(projectRoot);
    const store = new (await import("prax-runtime")).FileSessionStore({ stateRoot: join(root, "state"), idGenerator: () => "ds_brief" });
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
    await service.designReconcile({ design_session_id: "ds_brief", capability_map: architectureCapabilities() });
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

按 policy 分支组装 `mode_plan` 追加进 implementationBrief：

```ts
const understanding = await this.sessions.readArtifact<ExistingUnderstanding>(session, "existingUnderstanding");
const intentArtifact = await this.sessions.readArtifact<IntentLite>(session, "intentLite");
const deltaArtifact = await this.sessions.readArtifact<SdirDelta>(session, "sdirDelta");
const policy = sessionPolicy(session);
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
} else if (intentArtifact !== undefined) {
  modePlan = { change_list: [intentArtifact.change], regression_checks: intentArtifact.regression_points };
}
const implementationBrief = { /* 现有字段 */, ...(modePlan === undefined ? {} : { mode_plan: modePlan }) };
```

`SdirDelta` 类型从 `prax-sdir` 导入（type-only）。轻路径没有 sdir/capability artifacts——`designPrepareImplementation` 的 `requireArtifact("sdir")` 等调用改为：policy 含 `prepare` 前必有 sdir 或 sdir_delta gate，按 gate 读取对应 artifact；轻路径不经过 prepare gate，无需处理。

- [ ] **Step 4: 运行确认** — 新测试 PASS；`npm test` 全绿。
- [ ] **Step 5: 提交** — `git commit -m "feat(mcp): assemble mode-specific execution plans"`

---

### Task 10: 验证按模式装配

**Files:**
- Modify: `packages/prax-validator/src/validator.ts`（plan 增加策略上下文）
- Modify: `packages/prax-validator/src/contracts.ts`（检查定义追加）
- Modify: `packages/prax-mcp/src/service.ts`（plan/evaluate 调用传入上下文与替代产物）
- Test: `tests/lifecycle-policy.test.ts`（追加）

- [ ] **Step 1: 写失败测试（追加）**

```ts
import { PraxValidator } from "prax-validator";

describe("policy-aware validation plans", () => {
  const validator = new PraxValidator();

  it("adds existing-product checks", () => {
    const plan = validator.plan(architectureProductFrame(), architectureContext(), architectureDecisions("x"), {
      mode: "existing_product", change_kind: "add_surface",
    });
    const ids = plan.checks.map((check: { id: string }) => check.id);
    expect(ids).toContain("untouched_surface_regression");
    expect(ids).toContain("pattern_consistency");
    expect(ids).toContain("authority_consistency");
  });

  it("adds rework checks", () => {
    const plan = validator.plan(architectureProductFrame(), architectureContext(), architectureDecisions("x"), { mode: "rework" });
    const ids = plan.checks.map((check: { id: string }) => check.id);
    expect(ids).toContain("fresh_derivation_check");
    expect(ids).toContain("migration_readiness");
  });

  it("uses light-path checks instead of the universal set for visual polish", () => {
    const plan = validator.plan(architectureProductFrame(), architectureContext(), architectureDecisions("x"), {
      mode: "existing_product", change_kind: "visual_polish",
    });
    const ids = plan.checks.map((check: { id: string }) => check.id);
    expect(ids).toContain("hierarchy_preserved");
    expect(ids).toContain("readability");
    expect(ids).not.toContain("semantic_conformance");
  });
});
```

（`architectureDecisions` 从 fixtures 导入。）

- [ ] **Step 2: 运行确认失败。**

- [ ] **Step 3: 实现**

`validator.ts` 的 `plan` 签名扩为 `plan(frame, context, decisions, policyContext?: { mode: DesignMode; change_kind?: ChangeKind })`：

```ts
const EXISTING_CHECKS: ValidationCheck[] = [
  { id: "untouched_surface_regression", label: "Untouched surface regression", kind: "empirical", requirement: "Surfaces outside the declared change targets behave exactly as before.", evidence_required: true },
  { id: "pattern_consistency", label: "Pattern consistency", kind: "assistive", requirement: "The change follows the established patterns recorded in the existing-product understanding.", evidence_required: true },
  { id: "authority_consistency", label: "Design authority consistency", kind: "assistive", requirement: "The result stays consistent with the declared design authorities.", evidence_required: true },
];
const REWORK_CHECKS: ValidationCheck[] = [
  { id: "fresh_derivation_check", label: "Fresh derivation", kind: "assistive", requirement: "Product objects derive from user tasks, not from copying the legacy structure.", evidence_required: true },
  { id: "migration_readiness", label: "Migration readiness", kind: "empirical", requirement: "The migration plan covers every must_preserve item.", evidence_required: true },
];
const LIGHT_CHECKS: Record<"visual_polish" | "defect_fix", ValidationCheck[]> = {
  visual_polish: [
    { id: "hierarchy_preserved", label: "Hierarchy preserved", kind: "assistive", requirement: "The visual change does not alter the surface's information hierarchy.", evidence_required: true },
    { id: "readability", label: "Readability", kind: "empirical", requirement: "Contrast and type-scale evidence shows text remains readable.", evidence_required: true },
  ],
  defect_fix: [
    { id: "regression_check", label: "Regression check", kind: "empirical", requirement: "The fix resolves the reported defect without behavior change elsewhere.", evidence_required: true },
  ],
};
```

`plan` 组装逻辑：`policyContext` 为 undefined → 现有行为；`mode === "existing_product"` 且 `change_kind` 为 `visual_polish|defect_fix` → `[...LIGHT_CHECKS[change_kind]]`；否则 `[...UNIVERSAL_CHECKS, ...patternChecks, ...(existing → EXISTING_CHECKS), ...(rework → REWORK_CHECKS), ...risk]`。`evaluate` 不变（findings 驱动）。

`service.ts` 的 `designValidate`：plan 与 evaluate 调用传入 `{ mode: session.mode, ...(policy.change_kind === undefined ? {} : { change_kind: policy.change_kind }) }`；evaluate 对轻路径没有 sdir artifact——`requireArtifact("sdir")` 改为按 gate 读取：sdir 或 sdir_delta 或 intentLite，均缺失且 policy 需要时才抛错（轻路径 evaluate 用 intentLite 产物做 assistive 评估，findings 仍来自证据提交）。

- [ ] **Step 4: 运行确认** — 新测试 PASS；`npm test` 全绿。
- [ ] **Step 5: 提交** — `git commit -m "feat(validator): assemble validation checks by lifecycle policy"`

---

### Task 11: 六路径 e2e + 全量验收 + 文档

**Files:**
- Test: `tests/lifecycle-e2e.test.ts`（新建）
- Modify: `README.md`（生命周期小节）、`docs/architecture.md`（策略表一段）

- [ ] **Step 1: 写六路径 e2e（每路径一条 it，复用 fixtures；greenfield 复用现有 e2e 不重写）**

```ts
// tests/lifecycle-e2e.test.ts 核心断言（每条路径逐步调用并断言 phase 推进）
// 1. existing_product/add_surface：确认→理解→frame→context→route→inspect→decide→sdir→reconcile→prepare→validate(plan)
//    断言 prepare 的 brief 含 integration_plan
// 2. existing_product/modify_surface：断言 prepare 的 brief 含 change_sequence
// 3. existing_product/visual_polish：确认→意图轻录→validate(plan) 断言检查集为轻量集
// 4. existing_product/defect_fix：同上，断言仅 regression_check
// 5. rework：断言 prepare 的 brief 含 migration_plan 且 per_surface 全为 preserve/rework
// 6. greenfield：现有 service-e2e 已覆盖（确认后推进），本文件只补一条"确认内联一步到位"的短路径
// 中文 fixture：所有 user_quote 为中文原文
```

实现时每条路径用与 Task 8/9 测试相同的调用序列模板，逐门禁断言 `phase`。

- [ ] **Step 2: 运行确认全过** — `npx vitest run tests/lifecycle-e2e.test.ts` PASS。

- [ ] **Step 3: 全量验收**

```bash
npm test          # 全部测试（旧 38 + 新增，预计 60+）
npm run prax -- doctor   # 四项 PASS
```

- [ ] **Step 4: 文档更新**

`README.md` 的 "MCP workflow" 小节改为按模式说明三形态 + `change_kind`；`docs/architecture.md` 增加一段 "Lifecycle policies"（策略表 + 旧会话兼容）。

- [ ] **Step 5: 提交** — `git commit -m "test: add lifecycle e2e coverage and document mode-differentiated flows"`

---

## 自审记录（writing-plans Self-Review）

1. **规格覆盖**：三模式（T1/T4）、确认门禁（T4）、两套理解问题集（T5）、策略表与状态机（T1/T3）、sdir_delta（T7/T8）、intent-lite（T6）、执行计划分化（T9）、验证扩展（T10）、兼容（T2/T3 legacy 分支 + 默认策略）、六路径测试（T11）、外部权威（T5 schema + T10 authority_consistency）✓。规格 §5 的 add_surface 补 reconcile 已在 T1 策略表落地（偏离已声明）。
2. **占位符**：无 TBD；Task 1 Step 3 中 GATE_PHASE 的占位行已明确标注为笔误示例并要求完整实现。
3. **类型一致性**：`GateName`/`LifecyclePolicy`/`advanceSession(session, gate, now)` 前后一致；`validateSdirDelta` 返回 `SdirDeltaValidation`；`plan(..., policyContext?)` 四参可选。
