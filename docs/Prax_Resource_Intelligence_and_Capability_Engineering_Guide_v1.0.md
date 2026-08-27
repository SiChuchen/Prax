# Prax Resource Intelligence & Capability Engineering Guide v1.0

> Status: Development Guidance
> Date: 2026-08-27
> Purpose: 将外部 UI/UX/Frontend 资源、Agent Skills、设计系统、组件生态与验证资源，转化为 Prax 可治理、可路由、可评估、可演进的开发能力体系。

---

## 1. 为什么需要这份文档

Prax 不应该演化成“最大的 UI Skill”或“最大的前端资源收藏夹”。

真正需要解决的是：

> 在当前产品语义、用户任务、信息结构、平台、风险与实现环境下，Prax 如何判断需要什么知识、参考什么外部证据、选择什么 Representation、调用什么 Capability，并验证这些能力是否真的帮助 Agent 产生了更好的结果。

因此，这份文档负责把三类输入转化为开发约束：

1. **资源地图类输入**：真实案例、设计原则、设计系统、组件、动效、质量标准分别扮演什么角色；
2. **Capability Catalog 类输入**：外部有哪些 Agent Skills / Plugins / Tools / Design Sources；
3. **Capability Assessment 类输入**：哪些机制应被 Prax 吸收，哪些应 Wrap / Route / Reference / Ignore。

它不替代：

- Prax Product-first UI/UX & Frontend Methodology Guide；
- Prax Context Evolution & Benchmark Spec；
- 具体阶段 Implementation Plan。

三者关系：

```text
Methodology Guide
  定义长期原则
        ↓
Resource Intelligence & Capability Engineering Guide
  定义外部资源和能力如何进入 Prax
        ↓
Current Spec / Phase Plan
  定义当前版本具体实现什么
```

---

# 2. 核心原则

## P1. Resource ≠ Evidence ≠ Authority

真实产品案例、设计系统、组件库、Skill、WCAG、用户研究不能被视为同一种“设计依据”。

必须区分：

```text
Normative Standard
Empirical / Scientific Evidence
Design Intelligence
Design Precedent
Project Design Authority
Implementation Capability
Validation Resource
```

例如：

- WCAG 2.2：Accessibility normative authority；
- Mobbin / UXSnaps：Design precedent，不证明方案对当前产品有效；
- Project Tokens：项目 scope 内高权威 Design Authority；
- Hallmark：Craft Advisory Capability；
- React Aria：Implementation Provider；
- Storybook：Implementation Evidence Surface。

---

## P2. Capability Routing, not Skill Stacking

Prax Core 不常驻加载大量 UI Skills。

正确流程：

```text
Task Context
   ↓
Capability Need
   ↓
Candidate Providers
   ↓
Scope / Authority / Risk / Evidence Resolution
   ↓
Minimum Useful Capability Set
   ↓
Coding Agent
```

禁止：

```text
Anthropic Frontend Design
+ UIUX Pro Max
+ Interface Design
+ Hallmark
+ Impeccable
+ Vercel Rules
→ 全部塞入 Prompt
```

---

## P3. Product and Representation decisions precede asset selection

必须保持：

```text
User Task
→ Information Structure
→ Representation Planning
→ Capability Need
→ Asset / Skill / Provider
```

禁止反向：

```text
已有 Graph Component
→ 所有关系都画 Graph
```

或：

```text
发现一个漂亮 Skill
→ 让产品迁就 Skill
```

---

## P4. Internalize mechanisms before content

外部项目真正值得吸收的通常是机制，而不是整套规则文本。

示例：

- Skill Creator → Progressive Disclosure / Eval / Versioning；
- Vercel Agent Skills → rule-per-file / impact metadata / test generation；
- Impeccable → Shape / Critique / Audit / Polish 分离；
- Interface Design → Render Memory / consistency；
- Hallmark → Macrostructure / Design DNA；
- Taste / Bencium → Design Risk / Expression Profile；
- Scroll-World → Specialized Capability Execution Contract。

---

## P5. Stable knowledge and fast-changing ecosystem are different layers

稳定研究：

```text
WCAG
HCI research
Design principles
Prax D1–D9
```

变化快速：

```text
Skill release
component library
Figma MCP behavior
framework guidance
provider API
```

前者进入 Design Intelligence；后者进入 Resource / Capability Registry，并必须带版本和 freshness。

---

# 3. Resource Intelligence

## 3.1 Resource Role Taxonomy

Prax 应至少支持以下资源角色：

```text
research_standard
empirical_research
scientific_model
principle
heuristic
pattern
product_precedent
flow_precedent
visual_reference
design_system
design_token
component_reference
implementation_provider
skill
mcp_tool
representation_capability
validation_standard
validation_tool
```

Resource Role 不是 Capability Class，两者不能混用。

---

## 3.2 真实案例的正确定位

成熟产品案例只能作为：

```text
precedent
comparative reference
alternative evidence
```

不能直接上升为：

```text
universal best practice
```

推荐检索链：

```text
Current User Task
→ Current Information Structure
→ Representation Candidate
→ Precedent Query
→ Compare Conditions / Differences
→ Refine or challenge decision
```

不是：

```text
找一个好看的页面
→ 照着做
```

---

## 3.3 Resource Query Planner

未来可增加轻量的 Resource Query Planner：

```yaml
resource_query:
  problem:
    task: trace_dependencies
    archetype: professional_workspace
    representation_candidates:
      - architecture_canvas
      - dependency_graph

  needs:
    - product_precedent
    - pattern
    - platform_convention
    - implementation_provider

  questions:
    - how mature tools preserve global context
    - how relationship tracing is exposed
    - how inspector behaves after selection
```

Router 不应按网站名编码：

```text
if SaaS -> Mobbin
```

而应按资源角色和当前问题查找 Provider。

---

# 4. Capability Taxonomy

必须把以下对象分开：

| Class | 定义 |
|---|---|
| Knowledge | Agent 需要知道的事实/原则/经验 |
| Rule | 可以被应用或检测的判断规则 |
| Method | 一种思考或分析方法 |
| Workflow | 多阶段协作流程 |
| Skill | Agent 可触发的能力包 |
| Tool / MCP | 外部可执行接口 |
| Primitive | 底层稳定行为能力 |
| Component | 已实现可复用 UI 资产 |
| Recipe | 多能力/资产组合方案 |
| Representation Capability | 面向某类信息表达问题的高阶能力 |
| Design Source Bridge | Figma 等外部设计事实接入层 |
| Validation Capability | Browser / accessibility / visual / performance evidence |

这一步是 Capability Registry 的基础。

---

# 5. PraxCapabilityPackage

建议长期目标形态：

```text
capability/
├── capability.yaml
├── instructions.md
├── rules/
├── scripts/
├── references/
├── assets/
├── adapters/
├── evals/
├── evidence/
└── history/
```

第一阶段不要求全部实现，但 `capability.yaml` 应尽早稳定。

---

## 5.1 capability.yaml 最小字段

```yaml
capability:
  id: impeccable
  provider: external
  class: execution_review
  version: pinned-release-or-commit

  trigger:
    phases:
      - design_realization
      - implementation_review
    task_signals:
      - polish
      - audit
      - critique

  scope:
    platforms: [web]
    stacks: [agnostic]
    archetypes:
      - product_ui
      - marketing

  authority:
    level: implementation_advisory
    may_decide:
      - visual_realization_detail
      - local_component_composition
    may_suggest:
      - hierarchy_refinement
    may_not_override:
      - product_objects
      - semantic_relationships
      - primary_task
      - required_states
      - accepted_design_decisions
      - accessibility_hard_constraints

  inputs:
    - implementation_brief
    - validation_contract
    - current_code
    - render_memory

  outputs:
    - code_change
    - findings
    - execution_evidence

  risks:
    design:
      - opinionated_visual_bias
    context:
      - prompt_growth

  provenance:
    repo: ...
    license: ...
    reviewed_at: ...

  lifecycle:
    maturity: adapter_candidate
    benchmark_required: true
```

---

# 6. Capability Authority

推荐优先级：

```text
Confirmed Product Truth
>
Explicit Human Decision
>
Project Correction / Invariant
>
Prax Design Contract / SDIR
>
Project / Organization Design Authority
>
Platform Convention
>
Domain Capability
>
Implementation Capability
>
Craft / Styling Capability
>
Generic Suggestion
```

外部 Skill 默认不得决定：

- Product Object；
- Information Architecture；
- Primary Task；
- Semantic Relationship；
- Required State；
- Safety / accessibility hard constraints。

---

# 7. Capability Risk Model

能力必须带风险，而不是只有 strengths。

```yaml
risks:
  design:
    - visual_bias
    - template_bias
    - anti_slop_bias

  context:
    - context_overload
    - conflicting_instruction

  execution:
    - shell_access
    - file_write
    - package_install

  network:
    - external_service
    - remote_rule_fetch

  supply_chain:
    - unpinned_dependency
    - upstream_instability

  legal:
    - restrictive_license
    - external_terms

  maintenance:
    - abandoned_upstream
```

执行级别至少区分：

```text
L0 knowledge-only
L1 instruction-only
L2 code-generation helper
L3 local executable
L4 MCP/tool provider
L5 network / external side effects
```

---

# 8. Design Risk / Expression Profile

从 Taste / Bencium 类能力吸收参数化思想，但由 Prax 根据 Product Context 推导。

```yaml
design_profile:
  novelty_budget: low
  structural_variance: 3
  motion_budget: 2
  information_density: 8
  brand_expressiveness: 3
  platform_conservatism: 9
  regulatory_sensitivity: high
```

它是 Capability Router 的输入，不是 Style Prompt。

例：

```text
high-density admin
→ novelty low
→ motion low
→ familiarity high
→ route product-ui / conservative capabilities
```

```text
brand launch
→ novelty high
→ expressiveness high
→ route creative capabilities
```

---

# 9. Representation Capability

高阶表达能力不应只是组件。

例如：

```yaml
capability:
  id: architecture.canvas
  class: representation_capability

  semantic_fit:
    good_for:
      - topology
      - dependency
      - directional_flow
    poor_for:
      - precise_multivariate_comparison

  data_requirements:
    - identifiable_nodes
    - typed_relationships

  interactions:
    - pan
    - zoom
    - select
    - trace
    - filter

  accessibility:
    alternative_representation_required: true

  validation:
    - relationship_trace
    - context_preservation
    - hierarchy
    - task_completion
```

Provider 可以是：

```text
Internal Canvas Asset
React Flow Adapter
D3 Adapter
External Skill
```

Capability ≠ Provider。

---

# 10. Project Design Authority & Design System Resources

Design Tokens、Figma Variables、Storybook、内部组件库应该被视作项目级 Authority / Evidence，而不是普通实现资源。

推荐链：

```text
Design Contract
→ Project Authority Resolution
→ Existing Semantic Token / Component
→ Implementation
```

不允许：

```text
Prax 推荐蓝色
→ Agent 新造 #246BFD
```

如果项目已经有：

```text
color-action-primary
```

应优先复用。

---

# 11. Storybook / Browser / Figma 在 Prax 中的角色

## Figma

```text
Design Source / Representation Surface
```

不是 Product Truth。

## Storybook

```text
Component / State / Interaction Evidence Surface
```

特别适合验证：

- default；
- hover；
- focus；
- disabled；
- loading；
- empty；
- error；
- long content；
- responsive boundaries。

## Browser Runtime

```text
最终实现事实 / Ground Truth
```

用于：

- DOM；
- accessibility tree；
- screenshot；
- interaction trace；
- runtime state；
- performance；
- network；
- actual content。

---

# 12. Capability Maturity Lifecycle

Capability 不能发现即可信。

```text
discovered
→ reviewed
→ adapter_candidate
→ benchmarking
→ approved
→ preferred
→ deprecated
→ archived
```

成熟度与 scope 分开。

例如一个 `preferred` Capability 仍可能只适用于：

```text
React + Next + Product UI
```

而不是所有前端项目。

---

# 13. External Capability Strategy

对外部项目统一采用四种动作：

```text
ABSORB METHOD
WRAP / ADAPT
REFERENCE
IGNORE / DEFER
```

## Absorb Method

学习稳定机制，不复制整个内容。

代表：

- Skill Creator；
- Vercel rule engineering；
- Interface Design memory；
- Impeccable modes；
- Hallmark design DNA；
- Taste risk parameters。

## Wrap / Adapt

Prax 保持 Authority，外部 Skill 作为 Provider。

代表：

- Impeccable；
- Vercel React Best Practices；
- Interface Design；
- Figma Implement Design；
- UI/UX Pro Max；
- Hallmark / Taste。

## Reference

仅保留启发或 Benchmark baseline。

代表：

- Frontend Design Pro Demo；
- community UX Heuristics；
- Theme Factory；
- Canvas Design。

---

# 14. 第一批 Capability 实验

不要一次集成所有 Skill。

## Baseline

第一轮 Architecture Canvas：

```text
Bare Agent
vs
Prax Agent
```

不引入外部 Skill。

验证 Prax 本身：

- Product Context；
- Representation Decision；
- Relationship；
- SDIR；
- Context Compilation；
- Validation；
- Evidence。

## Capability POC 1 — Impeccable

```text
Prax
vs
Prax + Impeccable
```

验证：

- Authority wrapper 是否有效；
- Design execution / review 是否改善；
- visual/state/hierarchy drift 是否降低。

## Capability POC 2 — Vercel React Best Practices

作为较正交 Engineering Gate：

- performance；
- rendering；
- component quality；
- accessibility implementation。

## Capability POC 3 — Interface Design

验证：

- project render memory；
- fresh session consistency；
- design drift。

## Conditional POC — Figma

只有存在真实 Figma Golden Case 时加入。

---

# 15. Capability Evaluation

每次 Capability 调用应至少记录：

```yaml
invocation:
  capability_id: impeccable
  capability_version: ...

  reason:
    - existing_ui_polish
    - runtime_visual_drift

  inputs:
    design_contract_revision: ...
    context_manifest_revision: ...

  outputs:
    changed_files: ...
    findings: ...

  post_validation:
    conformance_delta: ...
    runtime_failures: ...
    human_corrections: ...

  cost:
    tokens: ...
    wall_clock: ...
```

Capability 评价不能只看：

```text
“页面更漂亮”
```

还要看：

- Product conformance；
- Representation fitness；
- UX state completeness；
- runtime correctness；
- accessibility；
- engineering quality；
- correction frequency；
- workflow overhead。

---

# 16. Resource / Capability Registry 与长期方法论的边界

长期 Methodology 不写死：

```text
Mobbin
Hallmark
Impeccable
React Aria
```

这些 Provider 会变化。

长期 Methodology 只写：

```text
需要真实 precedent 时检索 precedent provider
需要 accessible primitive 时路由 behavior provider
需要 creative craft 时路由 craft capability
```

具体 Provider 进入版本化 Registry。

---

# 17. 建议的仓库结构（长期目标，不要求立即全部实现）

```text
knowledge/
  upstream/
  principles/
  heuristics/
  patterns/

resources/
  registry.yaml
  precedents/
  providers/

capabilities/
  registry.yaml
  external/
  internal/

benchmarks/
  capability/
  representation/

artifacts/
  evidence/
  corrections/
```

不要为了这份蓝图立即创建所有 package。

---

# 18. 当前阶段不要做什么

1. 不要创建“超级 UI Skill”。
2. 不要常驻加载 5–10 个外部设计 Skill。
3. 不要把第三方风格数据库并入 Prax Core Authority。
4. 不要先开发 Community Capability Marketplace。
5. 不要先建立 100 种 Representation Capability。
6. 不要把现有组件反向变成 Product Design 原因。
7. 不要 silent-latest 拉取远程规则参与 Benchmark。
8. 不要把自动 detector 通过解释成 UX 已正确。

---

# 19. 推荐开发顺序

## Phase A — Registry Contract

只定义最小：

- class；
- scope；
- authority；
- version；
- risk；
- provenance；
- maturity；
- trigger；
- inputs / outputs。

不要做复杂 Marketplace。

## Phase B — External Adapter POC

只接 2–3 个差异明显 Provider：

- Impeccable；
- Vercel React Best Practices；
- Interface Design。

## Phase C — Capability Evidence

让所有调用进入统一 Execution Evidence。

## Phase D — Routing Evaluation

验证：

```text
是否选对能力？
是否加载过多？
是否发生 Authority Conflict？
是否产生实际质量收益？
```

## Phase E — Internal Capability Promotion

从真实项目重复出现、已验证的能力开始提炼：

```text
selection model
contextual inspector
semantic edge
state feedback
high-density data explorer recipe
```

而不是先造完整 Prax UI kit。

---

# 20. 最终目标

Prax 不需要赢下“最会生成 UI 的 Skill”竞争。

长期目标应该是：

```text
Product Context
      ↓
Context Compiler
      ↓
Representation Planning
      ↓
Resource Intelligence
      ↓
Capability Router
      ↓
Best Available Provider(s)
      ↓
Coding Agent
      ↓
Runtime Evidence
      ↓
Capability Evaluation
      ↓
Correction / Asset / Registry Evolution
```

因此 Prax 的核心价值是：

> **知道当前产品问题真正需要什么设计知识、什么外部证据、什么信息表达、什么实现能力；以正确的 Authority 和 Scope 组合它们，并通过真实运行证据判断它们是否有效。**

这比“拥有最多规则、最多 Skill、最多组件”更长期、更稳定。
