# Prax Product-first UI/UX & Frontend Methodology Guide v1.0

> **文档性质**：Prax 长期指导性方法论 / 产品与架构原则文档  
> **状态**：Guiding Baseline — 用于指导 Prax 后续设计、实现、Benchmark 与资产演进  
> **日期**：2026-08-27  
> **配套执行规范**：`Prax_Context_Evolution_and_Benchmark_Spec_v0.3.1.md` 及后续版本  
> **适用范围**：Prax Core、Design Intelligence、Representation Planning、Implementation Intelligence、Capability/Asset Registry、Implementation Supervision、Validation、Benchmark、Correction/Asset Evolution

---

## 0. 文档目的

Prax 的目标不是成为另一个“更会写 CSS 的 Coding Agent”，也不是成为一套要求 Agent 机械执行几十个 UI 步骤的流程框架。

Prax 要解决的是一个更根本的问题：

> **当 AI Agent 可以极快地理解需求、写代码、重构页面并调用越来越多设计与前端能力时，如何保证它始终从真实用户任务和产品语义出发，为问题选择合适的信息表达方式，并让设计意图穿过实现、运行态和后续迭代而不丢失。**

因此，Prax 的长期职责不是“生成页面”，而是维护一条可验证的链路：

```text
User / Product Reality
        ↓
Product Understanding
        ↓
Task + Information Structure
        ↓
Representation Decision
        ↓
Design Decision / SDIR
        ↓
Design Realization Strategy
        ↓
Implementation Capability Routing
        ↓
Coding Agent
        ↓
Real Runtime
        ↓
Evidence / Drift / Outcome Validation
        ↓
Correction / Asset / Knowledge Evolution
```

这份文档回答四个问题：

1. Prax **应该怎样理解 UI/UX 与前端开发问题**；
2. Prax **应该怎样指导 Agent 从需求走到真实运行结果**；
3. Prax **哪些能力应该自己拥有，哪些应该调用外部能力**；
4. Prax **怎样通过真实项目持续学习，但又不被局部经验污染**。

本文是方法论和架构裁决基线，不等于一次性实现计划。Coding Agent 的具体建设工作必须继续按阶段拆分执行。

---

# Part I — Prax 的核心定位

## 1. Prax 是什么

推荐长期定位：

> **Prax is a Product-first Design Context Runtime for Coding Agents.**

进一步展开：

> **Prax 帮助 Coding Agent 理解用户真正需要认知和完成什么，选择适合的信息表达方式，获得当前任务真正相关的设计与实现能力，并确保这种产品与设计意图在代码、运行态和后续迭代中保持一致。**

Prax 不是：

- UI Generator；
- Design Token Generator；
- React Component Library；
- Figma 替代品；
- 通用 PM 系统；
- Universal UI Schema；
- 前端 Code Review / ESLint 替代品；
- “把所有 UX 知识塞给 Agent”的 Prompt 仓库。

Prax 的核心价值应该集中在：

```text
Context
Decision
Representation
Routing
Traceability
Drift
Evidence
Learning
```

而具体工具，例如 Figma、Storybook、Playwright、Hallmark、ui-styling、UI/UX Pro Max、React Flow、Mapbox、D3、Three.js，都应作为可替换的实现与表达能力。

---

## 2. 两种“AI Native”必须分开

Prax 面对两个不同的问题：

### 2.1 AI-native Product Development

这是 Prax Core 首先解决的问题：

```text
Human Requirement
      ↓
Coding / Design Agent
      ↓
Prax
      ↓
Better Product Understanding
      ↓
Better UI/UX & Frontend
```

重点是：Agent 如何理解、设计、实现、验证产品界面。

### 2.2 AI-native Product UX

这是产品本身包含 AI / Agent 时的新型 UX：

```text
streaming
partial completion
tool use
approval
interrupt / resume
uncertainty
provenance
autonomy
recoverability
generative UI
```

这些能力非常重要，但应该作为 **Domain / Archetype Intelligence**，而不是所有 Web UI 的默认模型。

因此：

> **Agentic UX 是 Prax 应掌握的一类领域知识，不是 Prax Core 的默认 UI 结构。**

---

# Part II — 长期不变的基本原则

## 3. Product-first，而不是 Backend-first

Prax 必须阻止 Coding Agent 默认沿这条路径工作：

```text
API / DB / Backend Capability
          ↓
Page / Form / Button
          ↓
“功能都有了”
          ↓
用户心智却是错的
```

正确路径是：

```text
User
↓
Goal / Task
↓
Product Object
↓
Relationship / State / Constraint
↓
Information Structure
↓
Representation
↓
Interaction
↓
Implementation
```

Backend capability 可以约束实现，但不能反向决定产品结构。

---


## 3.1 Prax 对 UI 质量的基本判断模型

可以把 Prax 追求的质量理解为几个相互独立、不能互相补偿的维度：

```text
Task Fit
×
Representation Fit
×
Semantic Fidelity
×
Runtime Fidelity
×
Outcome Evidence
```

其中任一项严重失败，都不能用“视觉更漂亮”抵消。

例如：

- Representation 选错，视觉再精致也无效；
- Relationship 语义错误，组件实现再规范也无效；
- Runtime 状态不完整，Figma 再准确也无效；
- 实现完全符合 SDIR，但真实用户仍无法完成任务，也不能判为成功。


## 4. Product-first 不能退化成“Agent 虚构用户”

如果没有可靠用户证据，Agent 对用户目标、痛点、Mental Model 的理解必须被标记为假设，而不是事实。

推荐规则：

```text
Reliable User Evidence Exists
→ use as authority

No evidence + low design risk
→ hypothesis + confidence

No evidence + high design impact
→ clarification / research / explicit assumption
```

因此：

> **Prax 应区分事实、证据支持的推断和未验证假设。**

---

## 5. 先决定“应该怎样表达”，再决定“页面长什么样”

Coding Agent 很容易默认把需求翻译成：

```text
Cards
Tables
Sidebar
Form
Modal
Dashboard
```

Prax 必须增加一个更前置的问题：

> **用户需要通过界面认知什么、判断什么、比较什么、追踪什么、操作什么？**

地图、时间线、关系图、架构图、Dashboard、Canvas、文档视图、表格，本质上是不同的信息表达方法，不是装饰性组件。

因此：

> **Representation Decision 必须成为正式设计决策。**

---

## 6. Context 必须被编译，而不是被倾倒

随着 Prax 拥有更多：

- Design Intelligence；
- Domain Knowledge；
- Project Truth；
- Correction；
- Skill；
- Component；
- Representation Asset；
- Community Asset；

最危险的做法是把它们全部塞给 Agent。

正确模式：

```text
Large Knowledge / Asset Space
            ↓
Current Task Signals
            ↓
Context Compiler
            ↓
Minimal High-signal Context
            ↓
Agent
```

原则：

> **Context is compiled, not dumped.**

同理：

> **Capability is routed, not stacked.**

---

## 7. Unknown 必须保持 Unknown

Prax 不能因为自己拥有知识库、Pattern 或 Asset，就强迫每个问题落入已有类别。

系统必须允许：

```text
INSUFFICIENT_CONTEXT
NO_VALIDATED_PATTERN
NO_SUITABLE_ASSET
```

此时应：

```text
General Principles
+
Product Context
+
Exploration
→ Project-local Candidate
```

而不是硬套最近的 Pattern。

---

## 8. Implementation 不是 Prax 的交接边界

“实现细节不属于 SDIR”不等于“实现阶段不属于 Prax”。

Prax 不应决定：

- Flex 还是 Grid；
- useState 还是 Zustand；
- SVG 还是 Canvas；
- 文件怎么拆；
- className 怎样组织；

除非这些选择改变用户语义或违反项目约束。

Prax 应继续负责：

```text
Product Objects
Relationships
Hierarchy
Interaction Model
Required States
Capability Constraints
Responsive Semantics
Validation Obligations
```

所以：

> **Prax controls design fidelity, not implementation syntax.**

---

## 9. Real Runtime 高于 Agent 自我判断

AI Agent 不能仅凭“代码看起来正确”判断 UI 已完成。

真实前端事实必须来自环境：

```text
DOM
Accessibility Tree
Screenshot
Browser Interaction
Actual Runtime State
Network State
Console
Real Data
Performance
```

因此 Prax 应采用：

> **Grounded Design Loop**

```text
Context
↓
Decision
↓
Implementation
↓
Real Environment
↓
Evidence
↓
Correction
```

Browser / Runtime 不是最后附加测试，而是重要的 Ground Truth Surface。

---

## 10. 用户体验正确 ≠ 实现符合设计

Validation 至少要区分：

### Conformance Validation

> 实现是否忠实于 Product / Design Contract？

### Outcome Validation

> 这种设计是否真的帮助用户完成任务？

一个页面可以 100% 符合 SDIR，但 SDIR 本身可能是错误设计。

因此真实用户任务、人工评审、可用性测试和长期使用证据不能被 LLM Judge 取代。

---

# Part III — Prax 的标准问题解决方法

## 11. 六个核心循环

Prax 不应被实现成一条不可逆瀑布线，而应形成六个可受控回退的循环。

```text
① UNDERSTAND
      ↓
② REPRESENT & EXPLORE
      ↓
③ DECIDE
      ↓
④ REALIZE & IMPLEMENT
      ↓
⑤ OBSERVE & CORRECT
      ↓
⑥ VALIDATE & LEARN
      └──────────────↺
```

不同任务只需要不同深度，不要求所有任务完整走完所有 Artifact。

---

## 12. UNDERSTAND — 先理解产品世界

目标：回答“我们正在解决什么真实问题？”

需要理解：

- 用户是谁；
- 用户任务是什么；
- 什么是 Primary Task；
- 产品对象有哪些；
- 对象之间有什么关系；
- 状态怎样变化；
- 当前已有产品是什么样；
- 哪些行为必须保持；
- 哪些痛点正在解决；
- 哪些能力目前实际上不存在；
- 哪些事实有证据，哪些只是推断。

Existing Product 场景必须优先理解真实系统，而不是根据需求文字重新想象产品。

### 12.1 Context Admission Rule

只有会影响以下至少一项的信息才应该进入 Prax Product Context：

- 用户看到什么；
- 用户怎样操作；
- 用户怎样理解对象、状态与关系；
- Agent 怎样做设计决策；
- 结果怎样验证。

Prax 不保存所有项目知识。

---

## 13. REPRESENT & EXPLORE — 先决定信息如何被理解

这是 Prax 后续应正式强化的阶段。

### 13.1 Representation Planning 的输入

不推荐建立简单规则：

```text
空间 → Map
时间 → Timeline
关系 → Graph
```

而应基于多维信号：

```text
Cognitive Task
×
Information Structure
×
Scale
×
Interaction Need
×
Platform
×
Existing Product Context
```

### 13.2 Cognitive Task 示例

- Locate；
- Compare；
- Trace；
- Understand；
- Monitor；
- Navigate；
- Inspect；
- Edit；
- Compose；
- Diagnose；
- Explain；
- Decide。

### 13.3 Information Structure 示例

- Spatial；
- Temporal；
- Hierarchical；
- Relational；
- Sequential；
- Quantitative；
- Categorical；
- Causal；
- Narrative。

### 13.4 Representation 是候选组合，不是单选题

真实产品通常是：

```text
Primary Representation
+
Supporting Representations
```

例如：

```text
Architecture Canvas
+
Searchable Object Index
+
Contextual Inspector
+
Flow Overlay
```

或者：

```text
Log Stream
+
Timeline Histogram
+
Filter Facets
+
Context Detail
```

### 13.5 Material Uncertainty 时先发散再收敛

如果设计不确定性高，Prax 不应过早套用 Pattern。

原则：

> **Divergence before convergence when uncertainty is material.**

Agent 可以探索多个候选 Representation 或结构方案，然后比较：

- 用户任务适配度；
- 信息理解成本；
- Context Preservation；
- 学习成本；
- 可访问性；
- 运行时依赖；
- 实现复杂度。

---

## 14. DECIDE — 形成可追踪的设计承诺

Design Decision 应记录：

- 选择了什么；
- 为什么；
- 放弃了什么；
- 哪些约束不能被实现层覆盖；
- 哪些问题仍未知。

SDIR 应保持语义层定位：

```text
Intent
Hierarchy
Regions
Relationships
States
Behavior Intent
Constraints
Decision Points
```

SDIR 不应该变成：

- React AST；
- Figma JSON；
- CSS Schema；
- Universal UI Compiler IR。

---


## 14.1 Content Design 是界面语义的一部分

UI/UX 不只由 Layout、Component 与 Interaction 构成。导航名称、动作标签、状态说明、错误信息、空状态文案和领域术语都会直接影响用户是否理解产品。

Prax 应把以下内容作为横切设计 facet：

```text
terminology consistency
information scent
action labeling
state messaging
error recovery copy
domain vocabulary
```

尤其在 Existing Product 中：

> **Agent 不得为了“写得更自然”而随意替换用户已经形成心智模型的产品术语。**

语言变更如果会改变对象含义、动作预期或导航认知，应视为 Design-impacting Decision，而不是普通 copy edit。

---

## 14.2 Responsive / Platform Adaptation 是语义适配，不只是 CSS

响应式设计不应被降级成：

```text
desktop layout
→ add breakpoints
→ mobile done
```

更合理的问题是：

> **同一个 Product Meaning、Task 与 Relationship，在不同空间、输入方式和设备能力下怎样保持？**

例如：

```text
Desktop
Canvas + Inspector 并存

Tablet
Canvas dominant + contextual overlay

Mobile
selection → detail route / drawer
```

三个 Representation 可以不同，但 Product Relationship 与 Task Intent 不应被破坏。

因此正确顺序是：

```text
Product Semantics
↓
Platform / Input Constraints
↓
Representation Adaptation
↓
Responsive Implementation
```

Prax 应监督 Responsive Semantic Drift，而不是规定每个 breakpoint 的 CSS。


# Part IV — Relationship 与 Representation 分层

## 15. 三层 Relationship 模型

Prax 必须区分：

### Layer A — Product Relationship

产品世界里的真实语义：

```text
Service A
    depends_on
Service B
```

### Layer B — SDIR Region Relationship

界面区域之间的关系：

```text
Canvas
   selection_drives
Inspector
```

### Layer C — Implementation Representation

真实呈现和交互：

- SVG Edge；
- React Flow Edge；
- Highlight；
- Inspector Update；
- Filter Effect。

原则：

> **Semantic Relationship ≠ Visual Edge.**

不是所有 Product Relationship 都必须映射为 Region Relationship；跨层 Mapping 应按需要建立 typed reference。

---

## 16. Representation Artifact

Representation Artifact 不应成为另一套 SDIR。

它描述：

> 某个已经决定的信息表达方式，在某个实现或设计表面上的可追踪实例。

建议包含：

```yaml
representation_artifact:
  id: rep-architecture-main

  representation:
    capability: architecture.canvas
    role: primary

  semantic_refs:
    product_objects: [service, module]
    relationships: [depends_on, data_flows_to]

  task_support:
    - understand_topology
    - trace_flow
    - inspect_dependency

  interaction_contract:
    - pan
    - zoom
    - selection
    - relationship_trace

  realization:
    provider: runtime
    asset: prax-architecture-canvas
    version: ...

  validation:
    - relationship_trace
    - context_preservation
    - hierarchy
```

Representation Artifact 引用 Product Context、Decision、SDIR，而不替代它们。

---

# Part V — Design Realization Strategy

## 17. Design 与 Production Code 之间不是固定一条路

Prax 不应规定：

```text
Design
→ Figma
→ Code
```

也不应默认：

```text
Design
→ Direct Code
```

正确模式是根据任务选择 Design Realization Strategy。

---

## 18. 四种 Realization Mode

### 18.1 `direct_code`

适合：

- defect fix；
- visual polish；
- 小型 existing product 修改；
- 已有成熟设计系统和组件。

### 18.2 `figma_first`

适合：

- Greenfield；
- 高视觉不确定性；
- Marketing / Brand / Editorial；
- Stakeholder 需要视觉审批；
- 空间布局探索价值高但运行时依赖较低。

注：`figma_first` 是"表现优先"路径的历史名，不绑定 Figma 一家。自 2026-08-30
（ADR-004）起 provider 可插拔：`figma | penpot | pen`，注册表见
`REALIZATION_PROVIDERS`，逐供应商驱动手册见 `docs/realization-providers.md`。
模式的固定六条件、资格谓词与 draft→人审→批准锚点生命周期不变。

### 18.3 `executable_prototype_first`

适合：

- Canvas；
- Graph；
- Timeline Editor；
- WebGL；
- Scientific Visualization；
- Realtime Workspace；
- Interaction 与 Runtime 强耦合。

### 18.4 `hybrid_roundtrip`

适合：

- 成熟大型产品；
- Figma 与 Code 都存在长期资产；
- Design System / Code Connect 成熟；
- 需要 Code ↔ Canvas ↔ Runtime 持续迭代。

---

## 19. Figma 是 Representation Surface，不是新的 Source of Truth

Figma 的价值是：

- 低成本空间化设计验证；
- Human Review；
- Auto Layout / Component / Variable 等结构化设计信息；
- Code Connect 与真实组件映射；
- Code-to-Canvas / Canvas-to-Code Roundtrip。

但：

```text
Figma ≠ Product Truth
Figma ≠ SDIR
Figma ≠ Runtime Truth
```

Prax 应管理：

```text
Design Contract
      ↓
Representation Artifact
   /       |       \
Figma   Prototype   Runtime
```

并可检测：

```text
Design ↔ Figma Drift
Design ↔ Runtime Drift
Figma ↔ Runtime Drift
```

---


## 19.1 不寻找单一 Source of Truth，而维护 Authority + Traceability

Product Context、SDIR、Figma、Prototype、Code、Runtime 都描述产品的一部分，但它们不是同一种真理。

推荐理解：

```text
Product / User Evidence
= product authority

Design Decision / SDIR
= design semantic authority

Figma / Prototype
= representation evidence

Production Runtime
= implementation reality
```

Prax 的任务不是宣布“Figma 才是真理”或“Code 才是真理”，而是维护：

```text
Authority
+
Revision
+
Traceability
+
Drift Detection
```

因此任何重要 Representation 都应该能追溯：

- 来源于哪一版 Product Context；
- 来源于哪一版 Design Decision / SDIR；
- 使用了哪些 Capability / Asset；
- 当前 Runtime 是否仍与其一致。


# Part VI — Implementation Intelligence & Capability Routing

## 20. Design Intelligence 与 Implementation Intelligence 必须分开

### Design Intelligence

回答：

> 设计上一般应该知道什么？

例如：

- HCI Principle；
- Heuristic；
- Pattern；
- Platform Convention；
- Domain Design Knowledge。

### Implementation Intelligence

回答：

> 怎样可靠地把已经决定的体验实现出来？

例如：

- Skill；
- Recipe；
- Primitive；
- Component；
- Adapter；
- Test Strategy；
- Representation Asset。

两者不能混成一个大知识库。

---

## 21. Representation Capability 高于具体组件

不要只存：

```text
<MapComponent />
```

而应该有：

```text
geo.map
architecture.canvas
timeline.explorer
log.explorer
dependency.graph
comparison.matrix
```

Capability 描述：

- 什么时候适用；
- 什么时候不适用；
- 需要什么数据；
- 支持什么交互；
- 规模边界；
- accessibility 约束；
- validation profile。

Capability 与实现资产分离：

```text
Capability: geo.map
        │
        ├── Internal Asset
        ├── Mapbox Adapter
        ├── Leaflet Adapter
        └── External Skill / Provider
```

---

## 22. Prax 不应把“基础组件库”当成核心竞争力

Button / Input / Dialog 生态已经成熟。

更值得积累的是高阶 Representation Asset：

- Interactive Map；
- Architecture Canvas；
- Dependency Explorer；
- Interactive Timeline；
- Log Explorer；
- Diff Viewer；
- Data Comparison Workspace；
- Semantic Graph；
- State Machine Explorer；
- Metrics Investigation Dashboard；
- Flow Visualizer；
- Document + Evidence Viewer。

这些资产不仅包含视觉实现，还包含：

```text
Information Architecture
+
Interaction Model
+
Semantic Contract
+
State Model
+
Performance Strategy
+
Accessibility Strategy
+
Validation Profile
```

---

## 23. Internal 与 External Capability 应统一治理

Prax 应支持：

```text
Internal Skills
External Skills
Internal Components
External Libraries
MCP Tools
Representation Providers
```

但 Router 不应该以“是不是官方”作为首要判断，而应看：

```text
Current Task Needs
Applicability
Authority
Risk
Evidence
Stack Compatibility
Known Failures
```

---

## 24. Capability Registry 最少需要什么

建议统一元数据：

```yaml
capability:
  id: ...
  provider: internal | external | user | org
  version: ...

  capabilities: [...]
  stacks: [...]
  surfaces: [...]

  authority:
    level: implementation | advisory | craft

  may_decide: [...]
  may_not_override: [...]

  strengths: [...]
  risks: [...]
  known_failures: [...]

  provenance: ...
  license: ...
  security_level: ...
  maturity: ...
  evidence: ...
```

尤其必须有：

- `may_not_override`；
- risks / bias；
- version；
- provenance；
- license；
- security level。

---

## 25. Skill serves Prax; Prax does not surrender design authority to Skill

外部 Skill 可以非常强，但它们是 capability，不是第二套 Product Brain。

例如：

```text
Prax Design Contract:
compact professional workspace
canvas dominant
contextual inspector
```

如果某个 Craft Skill 倾向：

```text
more whitespace
large cards
glassmorphism
```

Prax Contract 必须优先。

Authority 推荐：

```text
Confirmed Product Truth
>
Explicit Human Decision
>
Project Correction / Invariant
>
Project / Org Design Authority
>
Prax Design Contract / SDIR
>
Domain Intelligence
>
Implementation Capability
>
Craft / Styling Advice
>
Generic Suggestion
```

---

# Part VII — Implementation Supervision

## 26. Prax 监督的是语义漂移，而不是每一行代码

Prax 不应该变成：

```text
Edit file
→ Prax Review
Edit CSS
→ Prax Review
Commit
→ Prax Review
```

应该使用 Semantic Checkpoint。

例如：

```text
Workspace Shell Complete
→ hierarchy check

Selection + Inspector Complete
→ behavioral check

Relationship Rendering Complete
→ relationship check

State Handling Complete
→ state check
```

---

## 27. Design Drift 类型

Prax 应至少识别：

- Structural Drift；
- Relationship Drift；
- Behavioral Drift；
- State Drift；
- Capability Drift；
- Hierarchy / Density Drift；
- Responsive Semantic Drift；
- Evidence / Epistemic Drift；
- Accessibility / Input Drift。

例如：

```text
Design:
Inspector = selection-driven contextual

Implementation:
Inspector = persistent always-visible

→ Behavioral + Hierarchy Drift
```

---

## 28. Controlled Re-entry

实现过程中出现设计影响决策是正常的。

正确方式不是整次会话推倒重来，而是：

```text
Finding
→ affected artifact
→ invalidate downstream artifacts
→ re-enter minimal necessary gate
→ regenerate affected context
→ continue
```

Prax 应记录 decision history，而不是只留下最终版本。

---

# Part VIII — Validation & Evidence

## 29. Validation 必须是多层的

只做：

```text
lint
unit test
build
```

不足以验证 UI/UX。

建议层次：

### Layer 1 — Deterministic

- Schema；
- required state；
- declared relationship；
- missing artifact；
- version/revision integrity。

### Layer 2 — Semantic / Assistive

- hierarchy；
- terminology；
- pattern consistency；
- product alignment；
- accessibility review。

### Layer 3 — Runtime / Empirical

- Browser interaction；
- screenshot；
- task execution；
- state transition；
- relationship tracing；
- responsive behavior。

### Layer 4 — Outcome

- 用户是否更容易理解；
- 是否更快完成任务；
- 是否更少犯错；
- 是否减少认知负荷。

---

## 30. Representation Fitness

Prax 以后不仅应问：

> “这个 Canvas 画得对不对？”

还应问：

> “Canvas 是否真的比其他表达更帮助用户理解问题？”

不同 Representation 应具有不同 Outcome Profile。

例如：

### Architecture Canvas

- trace dependency；
- understand topology；
- find impact；
- maintain global context。

### Map

- locate target；
- compare proximity；
- understand route；
- identify spatial cluster。

### Timeline

- understand sequence；
- identify change point；
- compare duration；
- trace temporal causality。

### Table / Matrix

- precise lookup；
- comparison accuracy；
- scan efficiency。

Representation Capability 应自带 validation profile。

---

## 31. Evidence 必须记录可观察行为，不依赖 Private Chain-of-Thought

需要记录：

```text
Agent actually saw what
Agent invoked what context / skill / tool
Agent made what explicit decision
Agent modified what
Agent received what validation failure
Agent changed what decision
Human corrected what
Final runtime evidence
```

不应要求或依赖：

```text
private hidden chain-of-thought
```

因此 Prax 的 Benchmark 和 Audit 应围绕：

> **Observable Execution Evidence + Explicit Decision Trace**

---

# Part IX — Benchmark Philosophy

## 32. Prax Benchmark 不只是“看起来更漂亮”

Benchmark 至少分三层：

### Process

- Agent 是否先理解用户 / 产品再编码；
- 使用多少 Context；
- 调用哪些 Skill；
- revision 次数；
- wall-clock / token / call cost。

### Conformance

- Product Model Alignment；
- Relationship Correctness；
- Hierarchy；
- State Completeness；
- Accessibility；
- Design Drift。

### Outcome

- Task Completion；
- Understanding Accuracy；
- Decision Speed；
- Error Rate；
- Human Correction Frequency。

---

## 33. 第一次 Benchmark 不证明“统计显著”

单次 A/B 只能提供 diagnostic evidence。

建议 Evidence Level：

```text
Level 0 — Fixture / Protocol Evidence
Level 1 — Single-run Diagnostic Evidence
Level 2 — Replicated Implementation Evidence
Level 3 — Cross-case Evidence
Level 4 — Empirical User Evidence
```

第一次 Architecture Canvas 应重点验证：

```text
Context Compilation
Representation Decision
Relationship Fidelity
Validation Before Implementation
Runtime Evidence
Drift Detection
```

而不是一次加入 Figma、多个 Skill、Community Asset 等全部变量。

---

# Part X — Knowledge & Asset Evolution

## 34. Prax 有两套不同的积累

### Knowledge Evolution

```text
Principle
Heuristic
Pattern
Domain Intelligence
Project Evidence
```

### Implementation Asset Evolution

```text
Skill
Recipe
Primitive
Component
Representation Asset
Adapter
Test Strategy
```

二者都需要 scope、evidence、version、lifecycle。

---

## 35. Scope Layers

推荐：

```text
G0 — Foundational Design Knowledge
G1 — Cross-domain Design Intelligence
G2 — Domain / Archetype Intelligence
G3 — Project Truth & Experience
```

资产作用域则可以是：

```text
PROJECT
USER
ORGANIZATION
COMMUNITY / SYSTEM
```

**Scope 与 Maturity 必须分开。**

一个 stable project asset 仍然不代表适合所有产品。

---

## 36. Local evidence specializes before it generalizes

一次项目中的成功经验默认只属于项目。

推荐晋升：

```text
Observed Finding
↓
Project Correction / Candidate
↓
Repeated Related Cases
↓
Domain Candidate
↓
Independent Domain Evidence
↓
Cross-domain Candidate
↓
Research / Standard Reconciliation
↓
Foundation Candidate
```

默认顺序：

```text
add evidence/example
→ refine scope
→ refine counterexample
→ refine routing trigger
→ add domain specialization
→ only then create new general rule
```

---

## 37. 用户应该成为资产生产者

Prax 产品化以后，用户不只是使用官方知识。

长期应允许积累：

- Pattern；
- Correction；
- Design Decision；
- Skill；
- Recipe；
- Component；
- Primitive；
- Representation Asset；
- Validation Strategy。

用户资产首先私有：

```text
Project
→ User
→ Organization
```

只有用户主动选择后：

```text
Share
→ Contribution Candidate
→ Automated Checks
→ Human / Maintainer Review
→ Scope Classification
→ Benchmark / Evidence Review
→ Community / System
```

贡献不等于直接修改 Prax Core。

---

## 38. User Sovereignty

Prax 可以自动发现候选资产，但不能悄悄升级成正式规范。

正确过程：

```text
Observed
↓
Prax proposes candidate
↓
User / Org accepts
↓
Asset becomes authoritative
```

用户资产应可导出为开放格式：

- Markdown；
- YAML；
- JSON；
- Git Repository。

原则：

> **User-created intelligence remains portable.**

---


## 38.1 资产质量不能用“复用次数”代替

一个 Asset 被使用很多次，不代表它是正确的最佳实践。

成熟度应综合：

```text
reuse count
+
validation pass rate
+
human correction frequency
+
applicable contexts
+
known failures
+
regression history
+
benchmark evidence
```

原则：

> **Popularity is not authority. Reuse is evidence, not proof.**

---

## 38.2 Asset / Knowledge 必须能够退役

积累机制如果没有遗忘和替换机制，Registry 最终一定腐化。

建议生命周期：

```text
observed
→ candidate
→ reviewed
→ stable
→ superseded
→ deprecated
→ archived
```

被废弃的资产仍应保留：

- 为什么废弃；
- 被什么替代；
- 哪些项目仍锁定旧版本；
- 哪些已知问题促成了退役。

因此：

> **一个成熟的 Prax 不只知道应该记住什么，也知道什么时候不再相信旧资产。**


# Part XI — AI-native / Agentic UX Domain

## 39. Agentic UX 应作为一个正式 Domain Pack

Agent 产品具有传统 GUI 中不够突出的状态和风险：

```text
uncertainty
non-determinism
latency
streaming
partial completion
tool invocation
agent progress
interrupt / resume
retry
approval
undo
external side effects
provenance
trust calibration
```

Prax 应逐步建立：

```text
domains/agentic-experience/
├── principles
├── heuristics
├── patterns
├── states
├── interaction-models
└── anti-patterns
```

但它属于 G2，不污染一般 UI 的 Foundation。

---

## 40. Agent UI 不应默认“展示推理链”

用户真正需要的是：

- observable plan；
- action；
- tool invocation；
- progress；
- evidence；
- source；
- uncertainty；
- result；
- decision rationale；
- approval point。

不应把 private chain-of-thought 作为 UX 或审计机制。

---

## 41. Generative UI 是 Representation Strategy，不是未来唯一 UI

Fixed UI、Adaptive UI、Generative UI 都可能正确。

Generative UI 的风险包括：

- learnability 下降；
- predictability 下降；
- muscle memory 破坏；
- accessibility surface 变大；
- validation complexity 上升；
- consistency 下降。

因此 Prax 应回答：

> 当前任务是否真正从 runtime adaptation 中获益？

而不是默认“AI Native = 动态生成所有页面”。

---

# Part XII — Anti-patterns

## 42. Prax 必须持续防止以下退化

### 42.1 Backend-driven UI

根据 API 字段直接长出页面。

### 42.2 Component-driven UI

因为已有 DataTable，所以所有数据都用 Table。

### 42.3 Asset-driven UI

因为 Prax 有某个高级 Canvas Asset，所以强迫任务使用它。

### 42.4 Skill-driven UI

某个 Skill 很擅长某种视觉风格，就让它重新定义产品结构。

### 42.5 Figma-driven UI

把 Figma Frame 当成产品真理和代码翻译目标。

### 42.6 Pattern-driven UI

看到最接近的 Pattern 就停止探索。

### 42.7 Chat-for-everything

所有复杂任务都只用聊天文本呈现。

### 42.8 Autonomous-by-default

不考虑风险、可逆性和用户控制，默认让 Agent 全自动执行。

### 42.9 Hidden State / Fake Progress

用户看不到 Agent 的实际状态，或者 UI 展示与真实执行脱节。

### 42.10 Prompt / Skill Dump

把所有规则、资产、Skill 全塞入 Context。

### 42.11 Over-supervision

Prax 每一步都阻塞 Coding Agent，使开发成本高于收益。

### 42.12 Knowledge Accumulation = Knowledge Quality

资产越来越多，但没有退役、冲突、Scope 与 Evidence 机制。

---

# Part XIII — Governance

## 43. 四个治理面

Prax 长期可以被理解成四个治理面：

### Product Governance

什么产品事实和设计承诺必须被保持？

### Knowledge Governance

什么知识值得相信、适用于哪里？

### Capability Governance

当前任务应该调用哪些 Skill / Component / Tool？

### Evidence Governance

我们凭什么认为设计和实现是正确的？

Runtime 把四者连接：

```text
Understand
↓
Context
↓
Represent
↓
Decide
↓
Route Capabilities
↓
Implement
↓
Observe
↓
Validate
↓
Learn
↓
Govern Assets
```

---

## 44. Version / Provenance / Reproducibility

每次重要 run 应知道：

```text
Prax version
Knowledge snapshot
Asset registry release
Skill version
Component / Representation Asset version
Model / Agent version
Design Contract revision
Validation Plan revision
```

否则无法回答：

> 为什么这一次 Agent 的行为与上一次不同？

长期应支持 lock / snapshot 机制。

---

## 45. External Skill Security

第三方 Skill 不应统一视为纯文本。

至少区分：

```text
Level 0 — knowledge-only
Level 1 — instruction-only
Level 2 — code-generation helper
Level 3 — local executable
Level 4 — MCP/tool provider
Level 5 — network / side-effect capability
```

越高风险，越需要：

- provenance；
- permission；
- sandbox；
- review；
- user approval。

第一阶段只需定义边界与 Schema，不需要马上建设完整安全平台。

---

# Part XIV — 自适应执行深度

## 46. High Floor, Soft Ceiling

不是所有任务都应走完整流程。

原则：

> **复杂度决定生命周期深度。**

### defect_fix

```text
confirm
→ minimal understanding
→ implementation
→ reported-behavior validation
→ regression
```

### visual_polish

```text
confirm
→ existing surface understanding
→ intent-lite
→ implementation
→ screenshot / contrast / regression
```

### modify_surface

```text
confirm
→ understanding
→ representation / design delta
→ implementation
→ drift check
→ runtime evidence
```

### add_surface / greenfield / rework

```text
confirm
→ product framing
→ context
→ representation planning
→ exploration
→ design decision
→ SDIR
→ realization strategy
→ capability routing
→ semantic implementation checkpoints
→ runtime validation
```

Prax 的价值来自高质量决策，不来自步骤数量。

---

# Part XV — 建议的后续路线

## 47. Phase 0 — Core Truth

先证明：

> Prax 能不能让 Agent 更正确地理解产品与任务。

优先建设：

- D1–D9 canonical upstream snapshot；
- Product Relationship；
- Existing Relationship Understanding；
- Context Manifest；
- Context Compilation；
- Validation Plan；
- Correction Memory；
- Evidence Harness。

---

## 48. Phase 1 — Closed-loop Benchmark

Architecture Canvas：

```text
Bare Agent
vs
Prax Agent
```

验证：

- Product Alignment；
- Representation Decision；
- Relationship；
- Hierarchy；
- State；
- Context Preservation；
- Process / Cost / Evidence。

不要第一次把 Figma、Hallmark、UI Pro Max 和 Community Asset 全部加入实验。

---

## 49. Phase 2 — Implementation Loop

增加：

- Implementation Supervision；
- Semantic Checkpoint；
- Browser Evidence；
- Design Drift；
- Controlled Re-entry。

这一阶段完成后，Prax 才真正闭合：

```text
Design → Implementation → Runtime
```

---

## 50. Phase 3 — Representation & Realization

实现最小 Representation Planning：

```text
Cognitive Task
Information Structure
Scale
Interaction Need
→ Representation Candidates
```

并验证：

```text
direct_code
figma_first
executable_prototype_first
hybrid_roundtrip
```

但先不建立巨大 Representation Taxonomy。

---

## 51. Phase 4 — Capability Intelligence

加入：

- Capability Registry；
- Internal / External Skill Routing；
- Representation Capability；
- Component Contract；
- Skill authority / risk / scope；
- 2–3 个代表性外部 Skill 实验。

建议实验：

```text
Bare
Prax
Prax + routed Skill
```

证明 Prax 的价值不是“比所有 UI Skill 更会写前端”，而是：

> **Prax 让这些能力在正确的产品语义和设计约束下工作。**

---

## 52. Phase 5 — Independent Domain Validation

第二个 Case：Data / Log Explorer。

验证：

- high-density UI；
- evidence status；
- filtering；
- comparison；
- context preservation；
- table / timeline / log representation choice。

第三个 Case 可选择 Agentic Workspace：

- streaming；
- approval；
- partial completion；
- interrupt / resume；
- tool transparency。

---

## 53. Phase 6 — Personal Intelligence

再建设：

```text
Project Asset
→ User Asset
→ Org Asset
```

包括：

- Correction Promotion；
- Reusable Component；
- Skill Candidate；
- Representation Asset Candidate。

---

## 54. Phase 7 — Ecosystem

最后才建设：

- Community Registry；
- Contribution Review；
- Public asset governance；
- broader ecosystem。

Community 是增长飞轮，不是 Prax 成立的前提。

---

# Part XVI — 当前不应该过早建设的东西

## 55. 暂时不要做

- Universal Product Ontology；
- Universal UI JSON Schema；
- 100 种 Representation 分类表；
- 大型 Community Marketplace；
- 全栈 Implementation Orchestrator；
- 自研完整基础组件库；
- 所有任务强制 Figma Gate；
- 所有任务强制 Browser 多 checkpoint；
- 自动把项目经验升级成系统原则；
- Agent 私有思维链记录系统。

先让真实 Benchmark 和项目暴露需要的 Primitive。

---

# Part XVII — 长期目标架构

## 56. Recommended Long-term Architecture

```text
                    RESEARCH FOUNDATION
                           │
                 DESIGN INTELLIGENCE
                           │
                           ▼
REQUIREMENT ─────── PRODUCT UNDERSTANDING
                           │
                           ▼
                    PRODUCT CONTEXT
                           │
                           ▼
                    CONTEXT COMPILER
                           │
                           ▼
                 REPRESENTATION PLANNER
                           │
                           ▼
                     DESIGN CONTRACT
                           │
                           ▼
                REALIZATION STRATEGY
             ┌─────────┬─────────┬─────────┐
             ▼         ▼         ▼         ▼
           Figma    Prototype   Direct    Hybrid
             │         │        Code
             └─────────┴────┬────┴─────────┘
                            ▼
                   CAPABILITY ROUTER
              ┌─────────┬─────────┬─────────┐
              ▼         ▼         ▼         ▼
           Skills   Components   Tools   Rep Assets
              └─────────┴────┬────┴─────────┘
                             ▼
                        CODING AGENT
                             │
                             ▼
                      IMPLEMENTATION
                             │
                             ▼
                        REAL RUNTIME
                             │
                      Evidence Capture
                             │
                             ▼
                         DRIFT ENGINE
                             │
                   ┌─────────┴─────────┐
                   ▼                   ▼
               Continue             Re-enter
                                       │
                                       ▼
                                  Design Context

                             ↓

                    VALIDATION / HUMAN

                             ↓

                   CORRECTION / ASSETS

                             ↓

                    KNOWLEDGE EVOLUTION
```

---

# Part XVIII — Prax 的最终裁决标准

## 57. 判断一个新功能是否属于 Prax

问五个问题：

1. 它是否帮助 Agent 更正确理解用户、产品对象、关系或任务？
2. 它是否帮助 Agent 选择更合适的信息表达或设计方式？
3. 它是否帮助设计意图可靠进入真实实现？
4. 它是否帮助我们用真实 Evidence 判断结果是否正确？
5. 它是否帮助有效经验被正确地保留、复用和治理？

如果五个问题都是否定的，它很可能不应该进入 Prax Core。

---

## 58. 判断一个 Asset 是否应该被复用

顺序必须是：

```text
Task
↓
Information Structure
↓
Representation
↓
Capability Need
↓
Asset
```

绝不能反过来：

```text
Available Asset
↓
Force Product Structure
```

---

## 59. 判断一个经验是否应该升级成系统知识

必须回答：

- 是否只在当前项目有效？
- 是否只是实现 Bug？
- 是否只是某个 Skill 的偏差？
- 是否已有 Design Intelligence 可以解释，只是没有正确路由？
- 是否在多个独立 Case 重复出现？
- 是否有反例？
- 是否与 Standards / Research 冲突？

默认：

> **Local first, promotion later.**

---

# 60. 最终方法论

Prax 长期应指导 Agent 按以下逻辑解决 Web UI/UX 与前端问题：

```text
Understand the Product
        ↓
Understand the User Task
        ↓
Understand the Information Structure
        ↓
Choose / Explore the Representation
        ↓
Make Explicit Design Decisions
        ↓
Form the Design Contract
        ↓
Choose the Realization Strategy
        ↓
Route the Right Capabilities
        ↓
Implement with Agent Freedom
        ↓
Observe the Real Runtime
        ↓
Detect Semantic / Design Drift
        ↓
Validate Representation Fitness and User Outcome
        ↓
Capture Corrections and Evidence
        ↓
Evolve Project / User / Domain / System Assets
```

这套方法的核心不是让 Agent 遵守更多步骤，而是让它始终回答三个问题：

> **1. 用户真正要完成和理解什么？**  
> **2. 什么表达与交互最适合这个问题？**  
> **3. 我们有什么真实证据证明最终实现没有偏离，并且真的帮助了用户？**

如果 Prax 能稳定回答这三个问题，它就不再只是“前端设计辅助 MCP”，而会成为 AI Agent 时代连接 **Product Intent、Design Intelligence、Representation、Implementation Capability 与 Real Runtime** 的 Design Runtime。

---

# Appendix A — 与当前 Spec 的职责关系

本指导文档与 `Prax_Context_Evolution_and_Benchmark_Spec_v0.3.1.md` 的关系：

```text
Methodology Guide
“长期应该相信什么、为什么这样做”
            │
            ▼
Context Evolution & Benchmark Spec
“当前版本应该建设什么、Schema / Artifact / Benchmark 怎么落”
            │
            ▼
Implementation Plan
“本阶段 Coding Agent 具体改哪些文件、测试什么、按什么顺序提交”
```

出现冲突时：

- 方法论层负责长期方向；
- Spec 负责当前版本技术约束；
- Implementation Plan 不得自行改变前两者的核心语义。

---

# Appendix B — 外部研究对主要方向的支持强度

以下不是新的知识层，而是对当前路线的研究可信度提示。

| 方向 | 当前证据判断 |
|---|---|
| Product / outcome-first | 强：传统 HCI + 新一代 Generative UI / outcome-oriented thinking 均支持 |
| Context grounding / environment feedback | 强：Agent 工程实践和软件开发 Agent 均强调真实环境反馈 |
| Figma / Code roundtrip | 中强：成熟工业方向，仍在快速演进，不适合作为硬依赖 |
| Representation Planning | 强理论基础 + 中等 Agent 时代工业证据；Prax 应通过 Benchmark 继续实证 |
| Skill / Capability Routing | 中强：Agent 工具体系正在快速形成，治理问题真实存在 |
| Generative UI everywhere | 弱：趋势明确，但作为默认 UI 模式证据不足 |
| Community Asset Ecosystem | 中：软件与开源治理模式成熟，但对 Prax 的具体价值需晚期验证 |
| Full automated UX evaluation | 弱：Conformance 可自动化很多，真实 Outcome 仍需要 Human/User evidence |

建议 Prax 对快速变化的新兴实践保持：

```text
accept concept
→ keep scope narrow
→ benchmark
→ promote only with evidence
```

---

# Appendix C — 研究与参考资产

Prax 后续 Research Foundation 应继续以版本化快照方式维护至少以下来源类别：

- WCAG / W3C 等正式标准；
- HCI / CHI / CSCW / UIST 等研究；
- Nielsen Norman Group 关于 Generative UI / Outcome-Oriented Design 的研究与行业分析；
- Anthropic Agent engineering / design-agent 公开实践；
- Figma MCP / Code Connect / code-to-canvas 与 design-to-code 官方资料；
- OpenAI / MCP ecosystem 关于 Tool / UI / App Interface 的公开规范；
- Design System / Storybook / browser testing / accessibility 工业实践；
- Prax 自己的 D1–D9 Design Intelligence 研究；
- Prax Benchmark、Human Correction 与跨项目 Evidence。

原则：

> **Stable research is upstream, not disposable. Benchmarks calibrate and specialize it; they do not replace it.**
