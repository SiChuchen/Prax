# Prax Context Evolution, Implementation & Asset Ecosystem Spec v0.3.1

> **文档性质**：Prax 下一阶段整体架构、实现闭环、实验与资产生态规范  
> **状态**：Reviewed revision — required changes incorporated; ready for consistency review before implementation  
> **日期**：2026-08-26  
> **适用基线**：`SiChuchen/Prax` `main`，基线提交 `b0af8d467ea0628e675857e918342b7edef42852`  
> **主要输入**：当前 Prax v0 实现、Architecture Canvas Golden Case、`Prax_MegaPrompt_Insights.md`、D1–D9 Design Intelligence / SDIR 研究，以及 v0.3 Formal Review（Approve with required changes）  
> **目的**：定义 Prax 从“可执行 Product-first Design Protocol”向“面向真实 Coding Agent 工作的 Product-first Design Context Runtime”演进时的完整目标形态：既要管理 Product/Design Context，也要持续参与实现、收集 Execution Evidence、监督 Design Drift、编排内部/外部实现能力，并允许用户与组织持续积累、审查和贡献自己的知识与前端资产。v0.3.1 重点完成概念收口、实验协议可执行化与当前代码基线对齐；本文同时规定阶段化实施路线，避免 Agent 将完整蓝图误解为一次性重构任务。

---

## 0. Executive Decision

Prax 下一阶段不能只解决“设计前是否理解产品”，也不能在生成 SDIR / Implementation Brief 后退出。完整目标应当是一条持续闭环：

```text
Understand
   ↓
Design
   ↓
Compile Context + Select Capabilities
   ↓
Supervise Implementation
   ↓
Collect Runtime / Execution Evidence
   ↓
Validate
   ↓
Correct / Learn
   ↓
Evolve User / Project / Domain / System Assets
```

因此本 Spec 同时确立八项核心方向：

1. **First-class Relationship**：显式产品/语义关系，减少错误连线、错误联动、组件孤岛和 backend-driven structure。
2. **Task-scoped Context Compilation**：按当前任务提供最小高信号 Product Context，而不是 Artifact / Prompt Dump。
3. **Pre-implementation Validation Contract**：Agent 在写代码之前就知道必须证明什么，而不是最终才看到验收要求。
4. **Correction / Regression Memory**：人工修正成为项目级可追溯回归资产，避免同类错误重复发生。
5. **Implementation Supervision & Design Drift Control**：实现不是 Prax 的边界；Prax 负责设计意图是否真实穿过代码、运行态和交互。
6. **Execution Evidence & Reproducibility**：真实 A/B 和后续项目都必须留下可重放、可归因的过程证据，不依赖原聊天会话才能复盘。
7. **Implementation Intelligence & Capability Routing**：内部 Skill / Recipe / Primitive / Component 与外部 Skill 均作为可路由能力，由 Prax 决定什么时候使用、允许决定什么、不得覆盖什么。
8. **User/Organization Asset Evolution**：用户不仅消费 Prax，也能在长期使用中积累自己的设计、实现和回归资产；经明确分享与审查后，优秀资产可以进入 Community / System 层反哺生态。

这些方向必须建立在已有 Design Intelligence 研究之上，而不是用最新 Benchmark 替代过去经过标准、论文、工业实践和交叉验证得到的成熟知识。

下一阶段采用两条互补的演化路径：

```text
TOP-DOWN
D1–D9 / Standards / HCI / Pattern Research
        ↓
Stable Design Foundation
        ↓
Scoped Design Intelligence

BOTTOM-UP
Real Project / Agent Run / Human Review
        ↓
Execution Evidence
        ↓
Correction / Asset Candidate
        ↓
Knowledge & Asset Governance
```

二者在 Prax Runtime 中汇合：稳定知识提供设计下限，真实项目提供领域适应；任何局部经验默认先细化 scope，再考虑泛化。

六类 Mega Prompt 案例仅作为第一批 **Fidelity Benchmark Seeds**，不得成为封闭 Product Ontology。未来新题材通过“组合已有 Context Primitive + 暴露新缺口”进入系统，而不是不断增加互斥产品类别。

完整蓝图不等于一次性实施。**Agent 必须按本文后部的阶段化路线执行，每个阶段有独立退出条件；未通过前一阶段，不得因为本文描述了长期能力就提前建设完整 Registry、Community Marketplace 或大型 Context Ontology。**

## 0.1 Document Map for Agents

本文按“完整架构先定义、实际实施后分期”的方式组织：

```text
Sections 1–20
Foundation / Context / Relationship / Validation / Knowledge Evolution

Sections 21–24
Implementation Continuity / Design Drift / Controlled Re-entry / Execution Evidence

Sections 25–34
Implementation Intelligence / Capability Registry / Internal Assets / User & Community Asset Ecosystem / Governance

Sections 35–36
Benchmark Strategy

Section 37
Actual phased execution order — Coding Agent 应优先遵循这里

Sections 38–43
Tests / Observability / Source of Truth / Constitution Candidates / Deliverables / Decision Gates

Sections 44–45
Long-term architecture and final principles
```

如果任务是“开始下一阶段开发”，Agent 不应从 Sections 25–34 直接开始建设完整资产生态，而应先阅读 **Section 37 — Phased Implementation Sequence** 和 Appendix A。

## 0.2 v0.3 Formal Review Closure

v0.3 的正式评审结论为 **Approve with required changes**。v0.3.1 不扩大长期蓝图，重点关闭会让 Coding Agent 在执行时自行猜测的设计缺口。

本修订作出以下裁决：

1. Relationship 明确分为 **Product Relationship / SDIR Region Relationship / Implementation Representation** 三层；跨层引用可选且有类型，不建立万能 Graph IR。
2. `ExistingUnderstanding` 增加可选 `current_relationships`，保证 existing/modify 路径也能保留关系事实。
3. Context Manifest 与既有 `CanonicalClassification` 不并行竞争：Classification 是 bounded routing signal，Manifest 是更开放的 derived session profile，前者是后者的输入之一。
4. Validation 继续只有 `deterministic / assistive / empirical` 三种 claim kind；`semantic / behavioral / spatial / epistemic` 仅作为 facet/profile，不扩展 claim kind。
5. Validation Plan 必须在 implementation-ready 前持久化并锁定 revision；Implementation Brief 与后续 Validate 引用同一 plan revision。
6. H4 Correction Memory 从普通单任务 A/B 中拆出，改为 **双任务、跨新会话** 的独立实验。
7. Minimal Evidence/Representation Status 保留为已接受概念，但实现推迟到第二个 Data/Log Explorer Case，不在 Architecture Canvas P0 提前建设。
8. D1–D9 与 Mega Prompt Insights 必须形成仓库内、可版本锁定的 upstream research snapshot/digest，才能执行 Knowledge Absorption Review。
9. 第一次 A/B 不使用“显著提升”等统计措辞；至少做多次独立 run，并按证据级别报告方向性信号。
10. Benchmark 静态定义与 run evidence 分离并统一目录；Bare/Prax 两臂都依赖上层 Agent Harness 捕获可观察执行证据。
11. Manifest 为 Runtime-owned derived artifact，Agent 不得直接把它作为权威输入提交；上游 revision 变化时自动 stale/rederive。
12. Constitution / phase invariant / candidate 不再维护三套重复清单，统一进入 Principle Registry，以 `status` 管理。

除上述收口项外，v0.3 的长期方向保持不变。

# 1. Problem Statement

## 1.1 Prax 已解决的第一层问题

Prax 的原始问题是 Coding Agent 容易按如下顺序工作：

```text
Backend / API / Database
        ↓
Capability Model
        ↓
Navigation / Page / Form / Button
        ↓
UI Exists, Product Model Is Wrong
```

Prax v0 已通过 Requirement Confirmation、Product Framing、Existing Understanding、Design Context、Design Intelligence Routing、Design Decisions、SDIR、Capability Reconciliation 和 Validation 等机制，将起点前移到：

```text
User
→ Task
→ Product Object
→ Product Relationship
→ Information / Interaction Structure
→ Design Decision
→ Implementation
```

当前 Constitution 中“用户目标、任务和产品对象优先于 backend nouns”“SDIR 只记录语义与承诺”“capability gap 不得被 UI 静默降级”等原则继续有效，不在本阶段推翻。

## 1.2 新暴露出的第二层问题

复杂真实前端任务表明：

> Agent 即使从用户和任务出发，也未必知道“这个具体产品世界里什么是真的”。

长篇 Mega Prompt 往往不是普通需求，而是人手工编译的一次性 Product Context 包：

```text
Product Intent
+ User Tasks
+ Domain / Data Truth
+ Relationships
+ State & Causality
+ Runtime Semantics
+ Representation Constraints
+ Historical Corrections
+ Acceptance Conditions
= Human-compiled Context Packet
```

因此下一阶段的问题不是“怎样让 Prompt 更长”，而是：

> **怎样把决定 UI/UX 正确性的项目事实组织为可持续、可验证、可按任务披露的 Product Context，同时避免把 Prax 做成万能项目知识系统。**

---

# 2. Positioning

## 2.1 Recommended Positioning

Prax 推荐定位：

> **Prax is a Product-first Design Context Runtime for Coding Agents.**

中文解释：

> **Prax 是面向 Coding Agent 的产品优先设计上下文运行时。它帮助 Agent 在实现之前和实现过程中获得当前任务真正需要的产品事实、语义关系、设计知识、决策与验证条件。**

## 2.2 Context Admission Rule

Prax 不负责保存所有项目知识。

一条事实只有在它会影响下列至少一项时，才应进入 Prax Product Context：

- 用户**看到什么**；
- 用户**如何操作**；
- 用户**如何理解产品对象、状态和关系**；
- Agent **如何做设计决策**；
- 实现结果**如何被验证**。

例如：

| 信息 | 是否默认进入 Prax | 原因 |
|---|---:|---|
| 数据库索引类型 | 否 | 通常不影响 UI/UX 语义 |
| 订单“待支付→已支付→退款”状态 | 是 | 决定用户可见状态与操作 |
| Black Hole 数值积分全部内部实现 | 否 | 不是设计上下文本身 |
| 画面必须来源于真实模型，不得使用视觉伪装 | 是 | 决定表示正确性与验证 |
| API endpoint 名称 | 通常否 | capability evidence，而非 product model |
| 某功能当前 API 不支持 | 是 | 作为 capability gap 影响实现决策 |

该规则用于阻止 Prax 演化为完整 PM、系统建模或代码架构平台。


## 2.3 Responsibility Boundary Through Implementation

Prax 的责任边界不是“设计文档写完”，而是“设计承诺已被真实实现并取得足够证据”。

因此：

```text
SDIR 不包含 CSS / JSX / framework detail
                    ≠
Prax 不参与 CSS / JSX / runtime implementation 阶段
```

正确边界是：

> **Prax controls design fidelity, not implementation syntax.**

Prax 应控制：

- Product Truth 是否被保留；
- hierarchy / density / relationship / interaction / state 等设计承诺是否漂移；
- capability gap 是否被实现阶段静默降级；
- implementation-time 新出现的设计决策是否被记录；
- required evidence 是否真实产生；
- Human correction 是否进入可复用 memory。

Prax 默认不决定：

- 使用 Flex 还是 Grid；
- React state library；
- 文件拆分方式；
- 变量命名；
- 具体 CSS 技术；
- 只影响实现而不改变设计语义的局部重构。

如果实现细节开始改变用户看到、操作或理解的产品语义，它就从“implementation detail”升级为“design-impacting decision”，必须重新进入 Prax 的显式决策与验证体系。

---

# 3. Non-goals

本阶段明确**不做**：

1. 不建立“前端只有六大类”的封闭分类体系。
2. 不预先实现 Visual / Data / Domain / Runtime / Computational / Explanation 六个完整 Context Module。
3. 不把所有项目事实塞进 Product Frame。
4. 不把 SDIR 扩展为万能项目 IR、JSX/CSS 替代物或确定性 UI compiler input。
5. 不新增大量低层 MCP tools。
6. 不从 Backend Schema 自动生成 Product Model。
7. 不把每一次人工意见直接晋升为通用 Design Rule。
8. 不把“更漂亮”作为 A/B 的主要成功指标。
9. 不要求 visual_polish / defect_fix 等轻量路径支付完整 Context Gate 成本。
10. 不在有真实 Benchmark 证据前稳定化一套大型 Context Ontology。
11. 不把 Prax 做成逐行代码审查器；Implementation Supervision 以语义 checkpoint 为粒度。
12. 不让组件、Skill、Design System 或现成资产反向决定 Product Structure；防止 component-driven / skill-driven UI。
13. 不一次性激活所有外部 Skill；Capability Routing 优先于 Skill Dump。
14. 不因某个 Skill 的审美偏好覆盖已确认的 Product Context、SDIR、组织设计权威或用户明确决定。
15. 不把用户一次成功实现自动发布为 Organization / Community / System Asset。
16. 不自动把 Project/User 私有资产上传到外部 Registry。
17. 不用“复用次数”或“社区流行度”替代证据质量。
18. 不捕获或要求保存 Agent 的私有 chain-of-thought；Benchmark 只记录可观察动作、显式决策、tool/asset invocation、artifact 和 runtime evidence。
19. 不将 opaque proprietary database 作为用户资产唯一存储形式；关键资产必须可导出、可版本化、可读。
20. 不假设总有可复用资产；`no suitable asset` 是合法路由结果。

---

# 4. Unified Principle Registry

本 Spec 不再维护 Constitution、INV、CAND 三套平行原则文本。所有原则使用一个注册表，通过 `status` 区分当前已经是 Constitution、当前阶段必须遵守的 phase invariant，以及需要更多跨 Case 证据才能晋升的 candidate。

`status`：

- `constitution`：当前 v0 已生效的产品行为不变量；
- `phase_invariant`：v0.3.1 实施阶段必须遵守，但尚不自动写入 Constitution；
- `candidate`：长期方向已接受，但需要 Architecture Canvas + 至少一个独立 Case / 治理评审后才能晋升。

| ID | Status | Principle |
|---|---|---|
| PRAX-P-001 | constitution | Product framing precedes design knowledge routing. |
| PRAX-P-002 | constitution | User goals, tasks, and product objects outrank backend nouns. |
| PRAX-P-003 | constitution | The agent receives only knowledge relevant to the current decision. |
| PRAX-P-004 | constitution | Knowledge expands progressively; normal flows stay at shallow disclosure unless deeper evidence is needed. |
| PRAX-P-005 | constitution | Major structural choices name a Pattern, rationale, and rejected alternative. |
| PRAX-P-006 | constitution | Professional-tool density is acceptable only when hierarchy and grouping make it legible. |
| PRAX-P-007 | constitution | SDIR records meaning and commitments, never pixels, CSS, components, or frameworks. |
| PRAX-P-008 | constitution | Capability gaps remain explicit; UI is not silently downgraded to fit an API. |
| PRAX-P-009 | constitution | Deterministic, assistive, and empirical validation claims remain distinct. |
| PRAX-P-010 | constitution | User evidence is submitted by an external actor and is never synthesized as fact. |
| PRAX-P-011 | constitution | Filesystem handoff must let another agent resume from `design_session_id` alone. |
| PRAX-P-012 | constitution | High floor, soft ceiling: defaults prevent accidental low quality without forbidding justified deviation. |
| PRAX-P-013 | constitution | Requirement confirmation precedes design work and preserves quote/restatement/scope evidence. |
| PRAX-P-014 | constitution | Existing-system posture determines lifecycle depth; small changes never pay the full-chain tax. |
| PRAX-P-015 | phase_invariant | Six fidelity seeds are benchmark seeds, not a closed product ontology. |
| PRAX-P-016 | phase_invariant | Composition over classification: context is described on multiple open axes rather than a unique product class. |
| PRAX-P-017 | phase_invariant | Core Product Frame remains small; domain-specific facts live in scoped project context. |
| PRAX-P-018 | phase_invariant | Context Manifest is Runtime-owned derived metadata, not a lifecycle gate or independent authority. |
| PRAX-P-019 | phase_invariant | Product relationships are semantic before visual; region relationships and visual/runtime representations are separate layers. |
| PRAX-P-020 | phase_invariant | Unknown remains unknown; missing project facts are never completed by plausible defaults. |
| PRAX-P-021 | phase_invariant | Validation obligations are materialized and version-locked before implementation. |
| PRAX-P-022 | phase_invariant | Human correction becomes project memory before general knowledge. |
| PRAX-P-023 | phase_invariant | Context is compiled, not dumped. |
| PRAX-P-024 | phase_invariant | Existing MCP surface remains stable unless a genuinely independent workflow gate is proven necessary. |
| PRAX-P-025 | phase_invariant | Reviewed research is canonical upstream; benchmarks calibrate and specialize it rather than silently replacing it. |
| PRAX-P-026 | phase_invariant | Local evidence specializes before it generalizes. |
| PRAX-P-027 | phase_invariant | Domain intelligence adds conditions and examples; it does not replace the stable foundation. |
| PRAX-P-028 | candidate | Implementation is part of design closure; Prax remains responsible for fidelity until sufficient real implementation evidence exists. |
| PRAX-P-029 | candidate | Prax controls design fidelity, not implementation syntax. |
| PRAX-P-030 | candidate | Execution evidence is first-class and must survive the original agent conversation. |
| PRAX-P-031 | candidate | Available skills/components/frameworks/APIs are capabilities, not product-structure authority. |
| PRAX-P-032 | candidate | Capability routing is scoped; do not dump all available skills into the agent. |
| PRAX-P-033 | candidate | Asset scope and maturity are orthogonal. |
| PRAX-P-034 | candidate | User-created intelligence remains portable and user-controlled. |
| PRAX-P-035 | candidate | Contribution is explicit, sanitized, licensed, reviewed and scoped before it can affect shared/system intelligence. |
| PRAX-P-036 | candidate | Reproducibility requires versioned inputs and durable content/source references. |
| PRAX-P-037 | candidate | `no suitable asset` is a valid capability-routing result. |
| PRAX-P-038 | candidate | Local learning may propose candidates but must not silently mutate authoritative user/org/system assets. |
| PRAX-P-039 | candidate | External capability trust is explicit: origin, license, execution class, permissions and risk are part of routing. |
| PRAX-P-040 | candidate | Project truth is scoped to facts that materially affect user-visible meaning, interaction, design decisions or validation. |

原则文本只在本注册表维护一次。后续章节可以引用 ID、解释实施语义或提供示例，但不得复制出另一套独立原则清单。

# 5. Open Context Model

## 5.1 Do Not Model “Product Type = One of Six”

禁止把 Mega Prompt 六类直接做成封闭产品枚举：

```yaml
product_type:
  enum: [visual, information, behavioral, runtime, computational, explanation]
```

六类只属于 Fidelity Benchmark Seeds。真实项目可以同时命中多个 fidelity profile，也可以出现今天尚未定义的新 profile。

## 5.2 Recommended Multi-axis Description

Prax 长期使用可组合、开放维度描述项目，而不是唯一归类。初始轴如下：

### A. Product Archetype

示例：`professional_workspace / canvas_workspace / data_explorer / editor / realtime_monitor / configuration_surface / learning_experience / narrative_report / simulator`。保持 extensible string；v0.3.1 不稳定完整 enum。

### B. User Task Character

示例：`browse / inspect / compare / edit / create / monitor / diagnose / control / learn / explore / configure`。

### C. Product Objects & Relationships

描述用户心智中的产品对象与对象之间的语义关系。这里的 Relationship 是 Product Relationship，不与 SDIR Region Relationship 或视觉 edge 混用。

### D. Interaction Topology

示例：`form-driven / selection-driven / direct-manipulation / canvas-spatial / search-driven / command-driven / timeline / multi-pane-workspace`。

### E. State / Temporal Characteristics

示例：`persistent_user_state / domain_state / runtime_state / derived_state / async_generation / streaming / realtime / undo_redo / collaborative_state`。

### F. Fidelity Profiles

初始 seeds：

- `reference_visual_fidelity`；
- `information_fidelity`；
- `behavioral_fidelity`；
- `workspace_coherence`；
- `computational_fidelity`；
- `explanation_fidelity`。

允许新增 `accessibility_fidelity / collaborative_consistency / temporal_fidelity / privacy_feedback_fidelity / spatial_fidelity` 等，不要求事先穷举。

### G. Validation Profiles

Validation Profile 是一组检查的路由标签，不等于具体 check ID，也不等于 Rubric 名称。初始 profile 统一使用：

- `semantic_integrity`；
- `relationship_integrity`；
- `state_coverage`；
- `spatial_geometry`；
- `provenance_integrity`；
- `persistence_integrity`；
- `runtime_degradation`；
- `keyboard_accessibility`；
- `visual_snapshot`；
- `product_evidence`。

具体 Validator check 可以继续叫 `context_preservation`、`relationship_trace` 等；Rubric 也可以叫 Context Preservation，但三个层级必须在 schema 中使用不同字段（`profile` / `check.id` / `rubric.id`），不得共享一个无类型字符串空间。

## 5.3 CanonicalClassification Is a Bounded Signal, Not a Competing Ontology

当前 Runtime 已有 `CanonicalClassification`，并被 Router 使用。v0.3.1 不删除它，也不让 Context Manifest 再建立一套平行、互相竞争的封闭分类。

正式关系：

```text
Requirement / Confirmation / Frame / Understanding / DesignContext
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
CanonicalClassification   Other open signals
(bounded v0 routing)      (relationships/state/fidelity/unknowns/...)
          └─────────┬─────────┘
                    ▼
              Context Profiler
                    ▼
              Context Manifest
```

规则：

1. `CanonicalClassification` 是当前 v0 的 deterministic/bounded routing signal；
2. Context Manifest 是更宽的、开放的、session-level derived profile；
3. Manifest **必须记录其使用的 classification ref/revision**，但不得简单复制 classification 全部字段后另起一套含义；
4. Router 在当前阶段继续兼容 Classification；Context Compiler/Validation Router 可读取 Manifest；
5. 若未来 Benchmark 证明旧 Classification 不足，应通过迁移缩小/替换它，而不是长期维护两套互不相干的分类体系；
6. 去重原则适用于分类信号本身：新轴只有在能解释现有轴无法表达的真实决策差异时才进入稳定 schema。

# 6. P0 Capability 1 — First-class Relationship

## 6.1 Problem: Relationship Exists at Different Semantic Layers

当前代码里已经存在两层不同关系：

1. **Product Relationship** — `ProductFrame.relationships`，连接产品对象；
2. **Region Relationship** — `SdirSchema.screen.relationships`，连接 SDIR region。

两者不能混为一层。此前示例 `asset → inspector` 把产品对象与 UI region 直接连接，是 v0.3 的概念错误，v0.3.1 明确修正。

此外，existing/modify 路径当前 `ExistingUnderstanding` 没有关系字段，派生 ProductFrame 时容易出现 `relationships: []`，会使 Relationship 能力只在部分 lifecycle 生效；P0 必须补齐这一缺口。

## 6.2 Layer A — Product Relationship

Product Relationship 表达产品世界里的语义事实，例如：

```yaml
relationship:
  id: rel_service_api_dependency
  source: service_api
  target: database_primary
  type: depends_on
  direction: forward
  meaning: API service depends on the primary database for request completion
  condition: during normal request handling
  importance: primary
```

P0 字段：

- `id`：新写入 artifact 必须有稳定 id；legacy artifact 可在 normalize/migration 时生成 deterministic id；
- `source` / `target`：必须引用当前 ProductFrame `product_objects[].id`；
- `type`：P0 保持 extensible string；
- `direction`：`forward | bidirectional | none`；
- `meaning`：自然语言解释；
- `condition`：**opaque human-readable annotation**，P0 不做表达式求值，不引入 DSL/规则引擎；
- `importance`：`primary | supporting`。

Validation 至少检查：

- source/target object reference 存在；
- 禁止无意义 self-loop（除非以后显式支持某种关系类型）；
- stable id 唯一；
- legacy relationship 可以兼容读取/迁移。

## 6.3 Existing Understanding Must Capture Current Relationships

`ExistingUnderstanding` 增加可选：

```yaml
current_relationships:
  - id: rel_current_001
    source: service_api
    target: database_primary
    type: depends_on
    direction: forward
    meaning: current observable dependency
    evidence_refs: [repo-observation-17]
```

规则：

- source/target 引用 `current_objects[].id`；
- `evidence_refs` 保留现状事实来源；
- `existing_product/modify_surface`、`add_surface`、`rework` 均可消费；
- `derivedFrame()` 若需要生成 ProductFrame，必须保留可确认的 current relationships，而不是硬编码空数组；
- 如果关系未知则保持未知/缺失，不推断。

## 6.4 Layer B — SDIR Region Relationship

SDIR Region Relationship 连接 UI semantic region，例如：

```yaml
relationship:
  id: region_rel_canvas_inspector
  source: architecture_canvas
  target: inspector
  type: selection_drives_contextual_detail
```

它表达的是：

> 页面区域之间如何协作、控制、承载上下文或形成信息层级。

它**不是**产品对象关系的副本。

P0 至少为 SDIR relationship 增加稳定 `id`，并继续保持现有 region referential validation。

## 6.5 Layer C — Implementation Representation

真实实现可能用视觉或行为表达 Product Relationship：

```yaml
representation:
  id: edge_023
  kind: visual_edge
  represents_relationship_refs: [rel_service_api_dependency]
  evidence_ref: screenshot.edge-023
```

也可能通过：

- Inspector 内容联动；
- filter/highlight；
- detail expansion；
- animation/state change；
- accessibility description；
- 并列/包含/空间位置。

因此：

```text
Product Relationship
   ├─ may be represented by → Visual Edge
   ├─ may drive → Inspector / Highlight / Filter
   └─ may have no direct visual edge at all

Region Relationship
   └─ describes semantic coordination between UI regions
```

## 6.6 Cross-layer Mapping Policy

三层保持独立有效。跨层引用遵循：

1. **optional**：不是每个 Product Relationship 都必须映射到 Region Relationship；
2. **typed**：若建立 mapping，必须说明是 `represented_by / drives / explained_by / surfaced_in` 等关系，不能只存无类型 ref；
3. **no automatic visual inference**：`direction=forward` 不等于“必须画箭头”；
4. **no universal graph IR**：P0 不建立统一所有对象、region、DOM、edge 的万能图模型；
5. Architecture Canvas 的对象依赖主要在 Product Relationship + Implementation Representation 层验证；`canvas → inspector` 则属于 Region Relationship。

## 6.7 Context Compilation

Agent 的 implementation packet 只得到当前 task 相关的关系：

- relevant Product Relationships；
- relevant Region Relationships；
- 若已有 representation obligation，提供对应 ref；
- 不把整个 project graph dump 给 Agent。

## 6.8 Acceptance

P0 Relationship 至少必须支持：

1. Architecture Canvas fixture 明确声明关键 Product Relationships；
2. ExistingUnderstanding 能保留已有关系事实；
3. Product source/target 和 Region source/target 分别做各自引用完整性校验；
4. SDIR region relationship 具有稳定 id；
5. implementation brief/context packet 只披露当前 task 相关关系；
6. visual/runtime representation 可以回指 Product Relationship，但不与其同层；
7. 简单项目不被迫填写复杂 mapping/condition；
8. no expression engine / universal graph ontology is introduced in P0。

# 7. P0 Capability 2 — Session-level Context Manifest

## 7.1 Purpose

Context Manifest 不存完整项目知识，而回答：

> 当前 session/task 为做出正确设计与实现，需要哪些 Context 能力、Fidelity profile 和 Validation profile？

它是 **Runtime-owned derived routing metadata**，不是新的 lifecycle gate，也不是 Agent 可以直接提交的权威事实。

## 7.2 Minimal Concept

```yaml
context_manifest:
  version: "0.1"
  derived_from:
    session_revision: 12
    classification_revision: 3
    artifact_revisions:
      product_frame: 5
      existing_understanding: null
      design_context: 2

  product_archetypes:
    - professional_workspace
    - canvas_workspace

  fidelity_profiles:
    - workspace_coherence
    - explanation_fidelity

  context_capabilities:
    relationships: required
    existing_behavior: optional
    data_evidence: none
    computational_model: none

  validation_profiles:
    - relationship_integrity
    - spatial_geometry

  unresolved:
    - exact persistence requirement is unknown
```

`context_capabilities` 的 P0 值域明确为：

- `required`：当前 task 缺失该 Context 会显著增加设计/实现错误风险；
- `optional`：有证据时使用，但缺失不自动阻塞；
- `none`：当前 artifact 没有证据表明需要该能力；**不代表该能力在项目中永远不存在**。

## 7.3 Derivation Inputs

Manifest 由 Runtime 基于当前 lifecycle 已有 artifact 派生。

### Greenfield

- requirement-confirmation；
- product-frame；
- design-context；
- CanonicalClassification（若存在）。

### Existing Product / Modify Surface

- requirement-confirmation；
- existing-understanding（含 current_relationships，如有）；
- routing/SDIR delta intent；
- CanonicalClassification（若存在）。

### Visual Polish / Defect Fix

- requirement-confirmation；
- existing-understanding；
- intent-lite；
- 已有 classification signal（如有）。

轻量路径必须允许极小 Manifest，不能因此升级为 full chain。

## 7.4 Authority, Staleness and Re-derivation

1. Manifest 只能由 Runtime 生成/刷新；MCP 输入不得接受“Agent 直接提交 Manifest 并成为 authority”。
2. Manifest 落盘是为了 resume/reproducibility，不是为了让 Agent 手工编辑。
3. `derived_from` 必须保存 session/artifact/classification revision 或等价 digest。
4. 任一参与派生的 authoritative artifact 被 re-entry 修改后，旧 Manifest 标记 stale 并重新派生。
5. stale Manifest 不能进入新的 Context Compilation/Validation Routing。
6. 如果同一 authoritative state 重放，Manifest 在需要 deterministic 的字段上应稳定。

## 7.5 Runtime Behavior

- unknown Context 需求进入 `unresolved`；
- Manifest 不声明没有证据支持的 Truth；
- Manifest 可以路由 Project Context、Design Intelligence 与 Validation Profiles；
- Manifest 自身不是 Product Truth、Implementation Truth 或用户证据；
- `CanonicalClassification` 作为 bounded signal 被引用，而不是复制成第二套分类真值。

## 7.6 Open Schema Policy

`product_archetypes`、`fidelity_profiles`、`validation_profiles` 继续优先使用 extensible identifiers + known-catalog/lint，不在 P0 固化完整 enum。

新增 identifier 必须有真实 decision/routing value；仅因新 Case 出现新名词，不足以扩 Schema。

# 8. P0 Capability 3 — Pre-implementation Validation Contract

## 8.1 Do Not Create a Duplicate Acceptance System

当前 Prax 已有 Validation Plan / Validation Report 主干。本阶段不创建重复的 `acceptance-contract.yaml`。

真实缺口是：当前 prepare 期间可以计算 plan，但 plan 本身未形成稳定、版本锁定的独立 artifact；validate 在某些路径可能重新计算。严格前向流程下问题不明显，但 Controlled Re-entry 后会造成 Implementation Brief 引用的检查与最终 Validate 执行的检查漂移。

因此目标是：

> **Validation Plan 在 Agent 写代码前 materialize、persist、version-lock，并被 Implementation Brief 与后续 validation/checkpoint 共同引用。**

## 8.2 Required Flow

```text
Requirement / Understanding
        ↓
Frame / Decisions / SDIR
        ↓
Context-routed Validation Plan
        ↓
persist validation-plan.yaml @ revision N
        ↓
Implementation Brief → validation_plan_ref@N
        ↓
Coding Agent / semantic checkpoints
        ↓
Implementation Evidence
        ↓
Validate Against Plan Revision N
```

若 controlled re-entry 修改了影响 plan 的上游 artifact：

```text
plan N → stale
regenerate → plan N+1
implementation brief / active checkpoint must explicitly move to N+1
old plan remains auditable
```

## 8.3 Claim Kind vs Facet

Validation 的 `kind` 继续只有：

- `deterministic`；
- `assistive`；
- `empirical`。

`semantic / behavioral / spatial / epistemic / accessibility / runtime` 是 **facet/profile**，不是第四、第五种 kind。

推荐结构：

```yaml
check:
  id: relationship_trace
  profile: relationship_integrity
  facet: behavioral
  kind: empirical
  requirement: user can trace a relationship to its target without losing workspace context
  evidence_required: true
```

## 8.4 Example

```yaml
validation_plan:
  version: "0.1"
  revision: 7
  derived_from:
    session_revision: 18
    sdir_revision: 4
    decisions_revision: 3
  checks:
    - id: rel-selection-inspector
      profile: relationship_integrity
      facet: semantic
      kind: assistive
      requirement: selected object drives contextual inspector
      evidence_required: true

    - id: no-canvas-overflow
      profile: spatial_geometry
      facet: spatial
      kind: deterministic
      requirement: workspace does not introduce unintended page overflow
      evidence_required: true

    - id: selection-persists-during-pan
      profile: persistence_integrity
      facet: behavioral
      kind: empirical
      requirement: panning does not clear selection
      evidence_required: true

    - id: hierarchy-review
      profile: semantic_integrity
      facet: visual_hierarchy
      kind: assistive
      requirement: canvas remains dominant over contextual inspector
      evidence_required: true
```

## 8.5 Implementation Brief Requirement

`implementation-brief` 必须引用：

- relevant Product Relationships / Region Relationships；
- relevant unresolved facts；
- `validation_plan_ref` + exact revision/digest；
- relevant check IDs；
- capability compromises, if any。

Agent 在实现开始前必须知道“哪些设计承诺不能被破坏”和“怎样证明做对”。最终 Validation 如果没有显式 re-entry/revision transition，不得偷偷换成另一套 plan。

# 9. P0 Capability 4 — Correction / Regression Memory

## 9.1 Problem

当前 Human Review 的高价值修正仍可能只存在于对话或一次性 review artifact 中。

Architecture Canvas 已经出现过一个典型 correction：Inspector 从永久 primary prominence 调整为 selection-driven contextual importance。这种修正应该成为可追溯项目记忆，而不仅是一次文档修改。

## 9.2 Minimal Artifact

建议新增 project-local correction artifact，具体是否一条一文件或集合文件由实现计划决定。

概念格式：

```yaml
correction:
  id: corr_arch_canvas_001

  scope:
    project: architecture_canvas
    surface: main_workspace

  finding:
    type: hierarchy_semantics
    observed: inspector had equal persistent primary prominence

  intended:
    statement: inspector becomes important only when selection exists

  evidence_refs:
    - human_review_001

  regression:
    check_id: inspector_selection_driven

  supersedes:
    - decision.inspector.v1

  promotion:
    candidate: false
```

## 9.3 Lifecycle

```text
Human / Agent Finding
        ↓
Classify
        ↓
implementation_bug
project_correction
product_invariant
candidate_pattern
candidate_general_rule
        ↓
Project Regression Memory
        ↓
Repeated Independent Evidence
        ↓
Promotion Review
        ↓
Prax Primitive / Design Intelligence
```

## 9.4 Promotion Rule

默认不自动晋升。

只有满足以下条件时才进入 general candidate：

- 至少在多个相互独立的 Case 中出现；
- 错误具有相同语义原因，而不只是视觉相似；
- 有 Human Review 或可验证证据；
- 可以描述适用条件与反例；
- 不依赖单一项目品牌/像素/局部偏好。

## 9.5 Regression Behavior

后续同 project/session 的相关任务：

- Context Compiler 应能检索相关 correction；
- implementation packet 应包含相关 regression；
- validate 应检查是否复发；
- 不相关 correction 不应被 Context Dump 给 Agent。

---

# 10. Accepted Concept, Deferred Implementation — Minimal Evidence / Representation Status

## 10.1 Decision

Mega Prompt / Data-heavy Case 暴露的 Evidence Status 问题成立，但 Architecture Canvas 第一轮 P0 不能为了未来 Data/Evidence 场景提前建设完整 epistemic model。

因此：

> **Concept accepted; implementation deferred to Phase 12 — Data/Log Explorer second independent benchmark.**

在 Phase 12 之前，只复用当前已有 `evidence_refs`、user evidence boundary 与 unknown preservation，不新增广泛 Truth Registry。

## 10.2 Phase-12 Minimum Vocabulary Candidate

第二 Case 若再次证明需要，优先验证以下最小状态，而不是一次建立通用知识图谱：

- `measured`：来自实际测量/直接观测；
- `verified`：经当前验证流程确认；
- `reported`：由外部来源报告，未等同本地验证；
- `derived`：由已知输入推导；
- `illustrative`：教学/解释示意，不声明数值真实性；
- `synthetic_demo`：人工/程序生成的 demo 数据；
- `live` / `stale`：仅在 runtime data 场景适用；
- `unknown`；
- `unverified`；
- `incompatible`。

状态不一定处于同一正交轴；Phase 12 必须先区分“evidence origin / verification / freshness”是否需要拆字段，不得把上述列表直接做成一个万能 enum。

### Unknown Rule

如果 `status=unknown` 表示值本身未知，则不得同时提供一个看似精确的 authoritative `value`。可以记录 placeholder/display text，但必须与事实值字段分开。

## 10.3 Design Rule

Truth/Evidence 与 Representation 分层：

- measured/reported/derived fact 不由 UI decoration 改写；
- illustrative/synthetic_demo 必须被明确标识；
- missing/unknown 不被自动插值成确定事实；
- 只有真实 Case 证明 Agent/validation 会使用的字段才进入稳定 schema。

# 11. Context Compilation

## 11.1 Definition

Context Compilation 是 Prax 下一阶段最重要的长期能力之一：

> 根据当前 task、surface、lifecycle、product relationships、project evidence、design decisions、Design Intelligence 和 validation requirements，生成 Coding Agent 当前真正需要的最小高信号实现上下文。

## 11.2 Context Compilation Is Not Summarization

它不是简单把所有文件压缩成摘要。

它必须保留与当前任务相关的：

- authoritative facts；
- semantic relationships；
- must-preserve constraints；
- relevant corrections；
- design decisions；
- unresolved material unknowns；
- capability gaps；
- validation checks。

并排除：

- 当前任务无关的 project facts；
- 无关 knowledge entries；
- 已 supersede 的 correction；
- 与当前 surface 无关的 regression；
- 低价值历史细节。

## 11.3 Symmetry With Design Intelligence Routing

Prax 应逐步形成两条对称的 scoped disclosure：

```text
General Design Knowledge
        ↓
Knowledge Router
        ↓
Relevant Knowledge

Project Product Context
        ↓
Context Compiler
        ↓
Relevant Project Context
```

最终进入 implementation packet：

```text
Relevant Project Context
+ Relevant Design Knowledge
+ Decisions / SDIR
+ Validation Plan
= Implementation Context Packet
```

## 11.4 P0 Scope

本阶段只需要证明 task-scoped project context 可以工作，不要求建设完整 Context Compiler framework。

Architecture Canvas A/B 可以先用 deterministic selection rules / fixture-level compiler 验证价值。

---

# 12. Fidelity Benchmark Taxonomy v0.1

## 12.1 Purpose

六类 Mega Prompt 作为 Benchmark Seeds，用来覆盖不同的“Agent 可能把产品做错的维度”。

它们不是 Product Type。

## 12.2 Initial Profiles

### B1 — Reference / Visual Fidelity

主要验证：

- observable reference preservation；
- geometry；
- cardinality；
- density / hierarchy；
- regression recurrence。

### B2 — Information Fidelity

主要验证：

- provenance；
- missingness；
- unsupported interpolation；
- source / as-of；
- narrative/evidence consistency。

### B3 — Behavioral Fidelity

主要验证：

- domain invariant；
- state transition；
- causal chain；
- action/result consistency；
- recovery behavior。

### B4 — Workspace Coherence

主要验证：

- selection consistency；
- cross-region coordination；
- layout persistence；
- partial failure；
- live/stale/demo semantics。

### B5 — Computational Fidelity

主要验证：

- forbidden shortcut；
- underlying model path；
- derived state；
- observability；
- quality/performance contract。

### B6 — Explanation Fidelity

主要验证：

- concept ordering；
- semantic edge correctness；
- evidence vs illustration；
- mental-model support；
- temporal explanation integrity。

## 12.3 Extensibility Rule

新增 Fidelity Profile 只需证明：

1. 它描述一个与现有 profile 不能合理合并的重要失真维度；
2. 至少有真实任务或测试 fixture；
3. 有可以观察或评审的验证协议；
4. 不只是某个产品类型的名字。

---

# 13. Primary Experiment — Architecture Canvas Real Agent A/B

## 13.1 Goal

把当前 Architecture Canvas 从 artifact-level Golden Review 升级为真实 Coding Agent implementation A/B。

当前 Golden Case 只能支持 artifact-level quality-floor 结论；本实验回答：

> 同一个 Coding Agent 真正写代码时，Prax 是否产生可观察的产品/设计/实现行为差异，并且这些差异是否值得其额外流程成本？

## 13.2 Controlled Variables — Mandatory

A/B 两组必须尽量锁定，并在 `prax-lock.yaml`/benchmark manifest 中记录：

- same requirement snapshot；
- same model + exact model/version/config where observable；
- same agent harness；
- same repository base commit/worktree state；
- same frontend stack；
- same tool permissions；
- same browser/runtime；
- same non-Prax project/source artifacts；
- same review rubric；
- **same budget policy**：wall-clock cap、token/usage metrics（harness 可观测时）、tool-call policy；
- same stop conditions。

`if applicable` 不再作为成本记录的豁免。若某项（例如 provider token）不可观测，必须记为 `not_observable`，不能省略。

## 13.3 Minimum Replication

第一次 Architecture Canvas 实验至少执行：

```text
Bare Arm: ≥ 3 independent runs
Prax Arm: ≥ 3 independent runs
```

独立 run 必须使用干净 worktree/session；如果 Agent/model 不能固定随机种子，也要记录该限制。

该样本量仍不足以声称统计显著性，目的只是观察：

- failure pattern 是否一致；
- Prax 价值是否只来自一次幸运输出；
- workflow cost 是否稳定；
- 哪个 primitive 的作用是否可以重复观察。

## 13.4 Arm A — Bare Agent

Bare Agent 获得：

- 原始需求；
- 正常项目代码与允许的项目文件；
- 正常开发工具。

不得获得：

- Prax session artifacts；
- `.prax/` 残留；
- Prax knowledge routing；
- Prax compiled context；
- Prax validation plan；
- 任何由 Prax Arm 运行生成的 correction/asset。

允许 Agent 按自己的正常方式提问、阅读代码、实现和测试。

## 13.5 Arm B — Prax Agent

Prax Agent 获得同样原始需求与项目环境，同时按实际 Prax Runtime flow 工作。本实验至少使用：

- requirement confirmation；
- product framing / understanding appropriate to mode；
- relationship-aware context；
- scoped Design Intelligence；
- decisions；
- SDIR / delta as applicable；
- persisted pre-implementation validation plan revision；
- task-scoped compiled implementation context；
- post-implementation validation。

## 13.6 Benchmark Harness Is Above Both Arms

Execution Evidence Capture 不能只依赖 Prax service。Bare Arm 的 file reads/edits、commands、browser runs 等需要 Agent Harness 提供可观察日志。

正式结构：

```text
Benchmark Harness
├─ captures both arms: time / tools / files / commands / git / browser evidence
└─ Prax Arm adds: Prax calls / artifacts / routed knowledge / compiled context / plan revisions
```

Phase 6 在动工前必须确认所选 harness 能捕获两臂最小证据；若做不到，A/B 不得宣称“过程可完整复盘”。

## 13.7 Isolation and `.prax/` Contamination Control

- 每个 run 使用独立 clean worktree/repo clone；
- Bare Arm 启动前必须确认无 `.prax/`、Prax-generated file、Prax-specific env/config；
- Prax Arm 的 `.prax/` artifact 不得进入 Bare review material；
- final review bundle 应剥离 arm-identifying metadata；
- implementation repo 若自动 git-ignore `.prax/`，仍需显式检查，不依赖假设。

## 13.8 Review Blindness

对最终 UI/代码/交互的 R1–R7 主评审，至少执行：

1. arm label anonymization；
2. artifact/screenshot ordering randomization；
3. reviewer 在第一轮评分时不可查看 Prax-specific trace；
4. process/attribution review 在 outcome review 完成后再解盲；
5. 若能获得独立第二评审者，优先用于 R1–R7；若不能，记录 single-reviewer limitation。

## 13.9 No Hidden Human Advantage

不得给 Prax Arm 私下补充 Bare Arm 看不到、且原始 requirement 不包含的“正确答案”。如果 Prax 通过 human confirmation 获得额外信息，必须记录：

- 问了什么；
- 为什么问；
- Bare Agent 是否也提出类似问题；
- 信息来自用户还是 Prax 推断。

## 13.10 Known Baseline Limitations Must Be Pre-registered

当前 `componentContracts()` 仍存在硬编码字符串 stub，它不是完整的 semantic component contract。第一次 A/B 的 protocol 必须预登记：

- 该 stub 可能产生 component-driven / capability-mismatch 风险；
- 若相关失败出现，优先归因到 `Capability / Asset Mismatch` 或 baseline limitation，不直接归因“Prax Product-first 概念失败”；
- 第一次 A/B 不因长期 §27.4 描述了完整 component contract 就提前重构该系统，除非它阻塞实验公平性。

# 14. Architecture Canvas Hypotheses and Separate Memory Experiment

## H1 — Relationship Fidelity

**假设**：Prax Arm 的显式 Product/Region Relationship 与 task-scoped disclosure，会方向性减少：

- 无意义 visual connection；
- 错误 product relationship source/target；
- region interaction mismatch；
- selection 与 Inspector 不一致；
- 数据/依赖事实与 representation 不一致。

**Evidence**：product relationship validation、rendered representation review、interaction walkthrough、relationship error count。

## H2 — Context Compilation

**假设**：task-scoped compiled context 比 artifact/context dump 更容易保持 dominant task、相关产品对象/关系、must-preserve behavior、相关 correction，同时降低 irrelevant instruction load。

**Evidence**：compiled-context snapshot、selection/exclusion trace、relevant-context usage、irrelevant-context leakage、revision count。

## H3 — Validation Before Implementation

**假设**：实现前获得且锁定 Validation Plan 的 Agent，会方向性减少 missing states、silent downgrade、first-pass failures 和实现后临时返工。

**Evidence**：first-pass validation outcome、repair rounds、capability compromise traceability、plan revision consistency。

## H4 — Correction Memory Is a Separate Cross-session Experiment

H4 **不由普通 Architecture Canvas 单任务 A/B 直接检验**。它需要双任务、公平输入和新会话：

```text
Task 1
Bare A1 ---------------- Prax B1
   │                         │
   └── both receive SAME human correction ──┘
                 │
        close both conversations
                 │
        start fresh agent sessions
                 │
Task 2: related modification touching same semantic area
Bare A2 ---------------- Prax B2
   │                         │
   ▼                         ▼
recurrence?             correction artifact retrieved?
```

### Fairness Rules

1. Task 1 两组必须收到内容等价的 human correction；
2. Task 2 使用新 Agent 会话，避免 Bare 组依赖同一聊天窗口短期记忆；
3. Bare 组可获得正常项目文件，但不额外获得 Prax correction artifact；若人为把 correction 写成普通项目文档，则必须同样写入 Prax 组并将实验重新定义为“普通文档 vs scoped memory retrieval”；
4. 用于实验的 correction 必须选择**尚未被当前 stable Pattern/Knowledge 直接吸收**的内容；
5. 如果知识库已经表达了同一结论，必须区分：`knowledge_retrieval` 与 `correction_memory_retrieval`，不能把两者合并为一次成功。

### H4 Evidence

- correction persisted across session close/resume；
- Task 2 relevant correction retrieved yes/no；
- recurrence yes/no；
- unrelated correction leakage；
- same correction entered general knowledge? must be no during test；
- new-session evidence package can reconstruct both tasks。

H4 对应单独 Benchmark ID，例如 `PRAX-MEM-001`，不混入 `PRAX-AB-001` 的主因果结论。

# 15. Unified Evaluation Rubric v0.2

现有 Architecture Canvas 六项 Rubric 继续保留，同时增加下一阶段需要观察的 Agent/process 指标。

## 15.1 Product & Design Outcome

### R1 — Product Model Alignment

检查：

- UI 是否围绕用户对象而非 backend nouns；
- surface 划分是否符合用户 mental model；
- backend capability 是否被错误映射为 navigation/feature structure。

### R2 — Primary Task Clarity

检查：

- 主要任务是否成为 dominant interaction；
- 次要信息是否抢占工作区；
- 用户能否理解“进入页面先做什么”。

### R3 — Context Preservation

检查：

- selection；
- viewport；
- filter；
- focus；
- inspector context；
- back-and-forth operation 是否保持连续性。

### R4 — Hierarchy & Density

检查：

- 高密度是否结构化；
- 主工作区是否保持视觉主导；
- 辅助区域是否不过度竞争；
- 不以“大卡片+大留白”错误稀释专业工具效率。

### R5 — State Completeness

检查：

- empty；
- loading；
- selected；
- error；
- no-result；
- degraded/fallback；
- domain-specific states。

### R6 — Decision Traceability

检查：

- 重大结构选择有 rationale；
- rejected alternative 可追溯；
- implementation 是否能对应到 decision / SDIR；
- deviations 是否有记录。

## 15.2 New Fidelity Metrics

### R7 — Relationship Correctness

记录：

- declared relationships；
- implemented relationships；
- missing relationship；
- wrong source/target；
- misleading visual edge；
- cross-region interaction mismatch。

### R8 — Validation Readiness

记录：

- 实现前是否存在验证计划；
- deterministic checks 是否可执行；
- empirical claims 是否明确要求外部 evidence；
- 首次实现后失败数量。

### R9 — Correction Recurrence

该指标**不在主 `PRAX-AB-001` 单任务结论中评分**，只在 `PRAX-MEM-001` Cross-session Memory Benchmark 中记录：

- historical correction count applicable；
- recurrence count；
- retrieved correction count；
- unrelated correction leakage；
- regression pass rate；
- retrieval mechanism: `correction_memory | stable_knowledge | ordinary_project_doc | unknown`。

## 15.2.1 Operational Definition — First Pass

为保证两臂可比，`first pass` 定义为：

> **Agent 第一次声明实现已达到可验证状态，并触发协议规定的完整 validation suite/browser evidence collection 的那个代码 checkpoint。**

它不是第一次保存文件、第一次运行单元测试，也不以 Prax 的 `design_validate` tool call 独占定义。Bare Arm 必须通过 Harness 使用同一套“ready-for-evaluation”事件标记。

如果 Agent 在第一次完整验证前主动发现问题并继续修改，这仍属于 first implementation attempt 的内部工作，不计为 post-first-pass repair。

## 15.3 Process Metrics

### P1 — Product Questions Before Coding

记录 Agent 实现前提出的问题：

- product/user question；
- backend/implementation question；
- clarification quality；
- materially useful question count。

不能简单用“问题越多越好”。应判断问题是否改变设计正确性。

### P2 — Backend-driven UI Leakage

记录：

- backend entity directly becomes nav/page/form；
- API limitation silently changes intended UX；
- internal implementation term leaks into user-facing model。

### P3 — Revision Rounds

记录：

- deterministic repair rounds；
- human semantic correction rounds；
- visual polish rounds；
- regression repair rounds。

### P4 — Context Efficiency

记录：

- exposed context items；
- actually referenced/useful items；
- irrelevant context leakage；
- context missing that later caused failure。

该指标用于评估 Context Compilation，而不是只看 token 数。

---

# 16. Scoring and Evidence Claim Policy

## 16.1 Avoid One Composite “Beauty Score”

不把所有维度压成一个 0–100 总分。Outcome 以 dimension-level label + error count + process/cost metrics 表达。

## 16.2 Outcome Labels

每个 Rubric 项使用：

- `PASS`；
- `PASS_WITH_REVIEW`；
- `INCONCLUSIVE`；
- `FAIL`；
- `NOT_APPLICABLE`。

## 16.3 Evidence Levels

结论必须声明证据级别，至少区分：

- `L0_fixture_protocol` — schema/fixture/unit/protocol evidence；
- `L1_single_run_diagnostic` — 单次真实实现 run，只能支持诊断/方向性观察；
- `L2_replicated_implementation` — 同 Case 多次独立 run，支持“重复观察到的方向性信号”，仍不自动等同统计显著；
- `L3_cross_case` — 至少两个独立复杂 Case 上重复出现；
- `L4_browser_runtime_human_review` — 有运行态与盲/同协议人类评审；
- `L5_empirical_user` — 真实目标用户任务/行为证据。

一个结论可以同时具有多个 evidence tag，但 Claim Strength 取最弱的关键依赖。

禁止：

- 用 artifact evidence 写“实现已经证明”；
- 用 single-run 写“显著提升”；
- 用 developer/human reviewer impression 写“真实用户成功率提高”；
- 用多次同一 Case 代替 cross-domain generalization。

## 16.4 Failure Attribution Without Private CoT

Prax 不记录 private chain-of-thought，因此 `Agent Reasoning Failure` 必须满足更严格的可操作条件：

- Agent 已实际收到正确 context；**且**
- `decisions.ndjson`、implementation summary、tool-visible message 或代码中的显式决定与该 context 矛盾；
- 能排除 compiler/routing 未传达的问题。

若缺少显式决策证据，归因必须为 `INCONCLUSIVE` 或更上游的可证类别，不得靠猜测内部思路判定 reasoning failure。

# 17. A/B Success, Cost and Stop Criteria

第一次真实 A/B 的目标不是证明 Prax 全面优于 Bare Agent，而是判断机制是否产生**可重复观察、可归因、值得成本**的方向性价值。

## 17.1 Minimum Evidence of Continued Investment

若在 replicated runs 中，多项出现一致方向且无明显 workflow harm，可作为继续投资信号：

- relationship semantic/representation errors 较少；
- first-pass validation failures 较少；
- backend-driven UI leakage 较少；
- human semantic correction rounds 较少；
- context preservation/state completeness 更稳定；
- Agent 更早暴露 material product ambiguity；
- capability gap 被显式记录而不是静默降级；
- context packet 的相关性高于 artifact dump。

任何表述使用“方向性减少 / repeated signal / observed in N runs”，不使用“显著”除非未来有适当统计设计。

H4 historical correction recurrence 不列入主 A/B 的成功标准，单独由 `PRAX-MEM-001` 检验。

## 17.2 Mandatory Cost / Workflow Harm Metrics

以下必须报告，不允许只报质量收益：

- wall-clock elapsed；
- total agent/model usage/token（可观测时，否则 `not_observable`）；
- tool calls；
- Prax calls；
- human clarification count；
- artifacts generated/edited；
- implementation revisions；
- validation repair rounds。

Workflow harm 包括：

- 小改动被升级到 full chain；
- Manifest 产生大量无价值 profiling；
- Agent 主要时间花在维护 Prax artifact；
- compiled context 比需求更长且噪声更高；
- Prax 让 Agent 机械遵守错误 inference；
- relationship schema 强迫简单场景过度建模；
- validation plan 只是复制 requirement；
- correction memory 引入无关历史偏见。

## 17.3 Primitive Decision Is Provisional After First Case

Architecture Canvas 后可以对每个 primitive 做：

- `keep_provisional`；
- `revise`；
- `remove_if_harmful`；
- `defer`。

但“没有价值所以永久删除一个本应跨域验证的 primitive”的最终裁决，原则上要等第二独立 Case；除非第一 Case 已证明它产生确定性错误、无法满足 non-goal 或成本明显不可接受。

最终跨域 Stop/Revise 条件：

- Architecture Canvas 与第二独立 Case 均未观察到行为价值；或
- 成本持续高于收益；或
- 能被更小的已有机制完整替代。

这时允许删除、降级 project-local、合并 artifact 或改成 assistive metadata。

# 18. Benchmark Corpus and Run Directory Policy

为避免“静态 Benchmark 定义”和“每次执行 evidence”混成两套目录，v0.3.1 固定两层：

## 18.1 Static Benchmark Definition

```text
benchmarks/
└── architecture-canvas-ab/
    ├── benchmark.yaml
    ├── requirement.md
    ├── protocol.md
    ├── rubric.yaml
    ├── environment-policy.yaml
    └── known-limitations.md
```

这里只保存可复用的任务、变量控制、Rubric、Known Limitations；不保存某次 run 的 implementation。

## 18.2 Run Evidence

```text
benchmark-runs/
└── PRAX-AB-001/
    ├── experiment-manifest.yaml
    ├── prax-lock.yaml
    └── replicates/
        ├── run-01/
        ├── run-02/
        └── run-03/
```

每个 replicate 的 arm/evidence layout 以 §24.3 为唯一 schema。

Correction Memory 使用独立：

```text
benchmark-runs/PRAX-MEM-001/
```

## 18.3 Implementation Repository Policy

如果实现位于独立测试仓库：

- run package 保存 base/head commit、diff、worktree/ref 和 evidence；
- 不要求复制整个 repo；
- 必须保证以后能定位或归档精确源码快照；
- arm review bundle 与 raw trace 分离，支持盲评。

# 19. Context Primitive Promotion Policy

## 19.1 Why

未来一定会遇到六类之外的新前端形态，因此 Prax 必须通过开放晋升机制生长，而不是预先定义完整世界。

## 19.2 Promotion Ladder

```text
Case-specific Fact
      ↓
Project-local Context
      ↓
Repeated Missing Context
      ↓
Candidate Primitive
      ↓
Multiple Independent Benchmarks
      ↓
Stable Prax Primitive
      ↓
If General Design Knowledge:
Design Intelligence Candidate
```

## 19.3 Required Evidence for New Stable Primitive

新增 stable primitive 至少需要：

1. 两个或以上相互独立真实/Golden Case 出现相同语义需求；
2. 能解释具体 Agent failure；
3. 能证明显式化后改善决策、实现或验证；
4. 不能被现有 primitive 简单表达；
5. 有清晰适用范围；
6. 不要求所有项目支付成本。

## 19.4 Examples

### Keep Project-local

“ASIC Dashboard 主区宽度必须 460px。”

这是项目 reference constraint。

### Candidate Prax Primitive

“用户选择一个对象后，多个区域应共享同一 selection context。”

若在 Canvas、Data Explorer、Market Workspace 等独立产品重复出现，可形成 cross-region selection primitive。

### Candidate Design Intelligence

“表示方向性因果/数据流的视觉连线必须能识别 source 与 target；无语义装饰线不得冒充关系。”

若跨多个图形/教学/架构任务稳定成立，可进入 Pattern/Heuristic 候选。

---

# 20. Knowledge Evolution & Anti-Overfitting Policy

## 20.1 Purpose

Prax 必须同时避免两个对称风险：

```text
Only Top-down Knowledge
→ 变成一本不会适应真实产品的 UX 教科书

Only Bottom-up Benchmark Learning
→ 被最近几个案例塑形，过拟合局部领域
```

正确机制是：

```text
Standards / HCI / Research / Mature Practice
                    │
                    ▼
          Stable Design Foundation
                    │
                    ▼
             Knowledge Governor
                    ▲
                    │
       Benchmark / Product / Review
                    │
                    ▼
             Real Experience
```

Top-down 提供经过长期验证的设计下限和解释框架；Bottom-up 提供真实 Agent 在具体产品中的失败、例外、缺口和新证据；Knowledge Governance 决定经验应停留在项目、领域还是进入更高层知识。

## 20.2 Canonical Upstream Research Assets Must Be Versioned and Queryable

D1–D9 研究交付包是 Prax 的长期上游知识资产，但“在聊天/外部文件里存在”不足以支持 Coding Agent 执行 Knowledge Absorption。Phase -1 必须建立仓库内、可版本锁定、可查询的 upstream snapshot。

推荐最小结构：

```text
research/upstream/
├── manifest.yaml
├── UIUX_Foundation_Research.md
├── Universal_Design_Principles_Draft.md
├── UX_Heuristics_Draft.md
├── Design_Knowledge_Taxonomy.md
├── Pattern_Language_Research.md
├── Design_Rule_Schema_说明.md
├── SDIR_Prior_Art_and_Feasibility.md
├── Design_Intelligence_Architecture_Recommendations.md
├── Source_Registry.md
├── Source_Registry.csv
└── Prax_MegaPrompt_Insights.md
```

`manifest.yaml` 至少记录：

```yaml
upstream_release: research-2026-08-26
files:
  - path: Universal_Design_Principles_Draft.md
    sha256: ...
    role: universal_principles
  - path: Source_Registry.csv
    sha256: ...
    role: source_registry
```

原则：

- vendor/version 的是**研究产物与来源索引**，不是复制整个互联网；
- 如果某源受版权/许可限制，只保存合法的 registry metadata / citation / digest，不复制受限全文；
- Runtime 23 条 Knowledge Entry 是该上游的 compiled subset，不等于全部研究资产；
- Benchmark 新 Finding 加入稳定知识前必须能够在该 snapshot 中检索已有 Principle/Heuristic/Pattern；
- upstream release 本身进入 `prax-lock.yaml`；
- upstream 被更新时产生新 release，不静默覆写旧 Benchmark 所用版本。

```text
Versioned D1–D9 Research Snapshot
            │
      curate / review / compile
            ▼
    Design Intelligence Canon
            │
      scope / route / disclose
            ▼
      Prax Runtime Knowledge
            │
            ▼
         Coding Agent
```

因此 Runtime 暂未收录某研究结论不代表其被废弃；新 Benchmark 只能通过证据复核/知识生命周期挑战上游结论，不能 recent-result-wins。

## 20.3 Knowledge Scope Layers

为避免与当前 Progressive Disclosure 的 L0/L1/L2/L3 命名冲突，本 Spec 使用 `G0–G3` 表示**知识作用范围**，不表示披露深度。

### G0 — Foundational Design Knowledge

跨产品、跨题材保持稳定的基础知识，例如：

- human-centred design；
- cognition / perception；
- feedback / error prevention / recovery；
- information architecture；
- accessibility baseline；
- semantic vs rendering separation；
- real user evidence 与 Agent self-evaluation 的边界。

G0 可以包含不同知识类型：normative standard、empirical model、universal principle。它们的 evidence strength 不同，不能混成同一权威等级。

### G1 — Reusable Cross-domain Design Intelligence

在多个产品形态中可复用、但依赖 context / forces / tradeoffs 的知识，例如：

- Canvas Workspace；
- Data Explorer；
- progressive disclosure；
- contextual inspector；
- undo vs confirm；
- dense professional tool hierarchy；
- selection-driven detail；
- visual relationship representation。

主要载体是 Heuristic、Pattern、Platform Convention 和 reviewed rule。

### G2 — Domain / Archetype Intelligence

针对关键领域或产品 archetype 的细化知识，例如：

- graph / architecture exploration；
- professional data workspace；
- realtime monitoring；
- timeline editor；
- scientific visualization；
- explanation / learning experience；
- collaborative workspace。

G2 不覆盖 G0/G1，而是增加更具体的适用条件、领域对象、惯例、失败模式、validation profile 与 tradeoff。

### G3 — Project Truth & Experience

只对当前产品/项目成立的事实与经验：

- 当前产品对象与关系；
- stable user concepts；
- existing behavior；
- project decisions；
- reference constraints；
- Human Corrections；
- Regression Memory；
- capability gaps；
- 当前证据与 unresolved facts。

G3 默认不得自动进入通用知识库。

## 20.4 Orthogonal Knowledge Type Must Be Preserved

Scope 层级不能替代 D5/D7 已定义的知识性质区分。

同一个 G 层中仍必须区分至少：

- normative standard；
- empirical / scientific model；
- universal principle；
- heuristic；
- pattern；
- platform convention；
- product evidence；
- myth / disproven simplification。

原因是“适用范围有多广”和“它凭什么成立”是两个正交问题。

例如：

- WCAG baseline 与“常见专业工具做法”不能因为都跨项目出现就获得同等强制性；
- 一条 Pattern 即使多项目复用，也仍然必须保留 context / forces / tradeoffs，而不能被升级成无条件 law；
- Myth Quarantine 中的 3-click rule、菜单 ≤7 项、Doherty 400ms 等，不得因为新项目偶然符合就恢复为通用规则。

## 20.5 Knowledge Absorption Protocol

每次 Benchmark、真实项目或 Human Review 产生新经验时，必须按以下顺序吸收。

### Step 1 — Record the Finding Without Generalizing

先记录观察事实：

```yaml
finding:
  observed: ...
  task_context: ...
  affected_user_task: ...
  evidence_refs: [...]
  outcome: ...
```

不得在 Finding 阶段写成“所有产品都应该……”。

### Step 2 — Classify the Failure / Insight

至少判断属于：

- implementation bug；
- project correction；
- product invariant；
- missing project context；
- missing Prax primitive；
- existing Design Intelligence not routed；
- existing Design Intelligence scope too broad / too narrow；
- domain pattern candidate；
- general knowledge candidate；
- tooling / validation gap。

### Step 3 — Search Existing Knowledge Before Adding New Knowledge

优先检查：

1. 是否已经存在同义 Principle；
2. 是否已经存在 Heuristic，只缺更精确 scope；
3. 是否已有 Pattern，只缺新的 example / counterexample / force；
4. 是否只是现有知识没有被 Context Router 命中；
5. 是否已有规则与新 Finding 冲突；
6. 是否属于 Myth Quarantine 已知误用。

默认优先：

```text
add evidence / example
→ refine scope
→ refine counterexample
→ refine routing trigger
→ add domain specialization
→ only then create a new rule
```

### Step 4 — Keep Local Evidence Local by Default

单一 Case 的新经验首先进入 G3。

如果它在同一领域多个独立 Case 中重复出现，可成为 G2 candidate。

只有当跨独立领域仍表现出相同语义机制，并与上游 evidence 相容时，才进入 G1/G0 candidate review。

### Step 5 — Review Before Promotion

Promotion 不由 Runtime 自动执行。

Review 至少回答：

- 相同的是视觉表象，还是底层语义机制？
- `applies_when` 是什么？
- `does_not_apply_when` 是什么？
- 已知 counterexample 是什么？
- 与哪些现有条目重复？
- 与哪些条目冲突？
- 证据强度是什么？
- 这是 Pattern、Heuristic、Principle 还是 Project Fact？
- Agent 能否在运行时有效消费它？
- 是否有 owner / version / review lifecycle？

## 20.6 Promotion Ladder

知识晋升采用“先局部、再领域、最后通用”的方向：

```text
Observed Finding
      ↓
Project Correction / Evidence       [G3]
      ↓
Repeated in Related Cases
      ↓
Domain / Archetype Candidate        [G2]
      ↓
Independent Domain Evidence
      ↓
Cross-domain Pattern / Heuristic    [G1]
      ↓
Research / Standard Reconciliation
      ↓
Foundational Candidate              [G0]
```

注意：

- “重复出现”不是机械计数，必须确认相同语义原因；
- “跨领域”不代表自动成为 Universal Principle；
- G0 的提升门槛最高，应与规范、理论、实证或长期工业证据重新对照；
- 某条经验也可以永远停留在 G2，而这并不表示它价值较低，只表示 scope 更具体。

## 20.7 Local Evidence Specializes Before It Generalizes

这是本 Policy 的核心原则：

> **Local evidence specializes before it generalizes.**
>
> **局部经验首先细化适用条件，而不是立即改写通用原则。**

示例：

### Example A — Professional Density

Market Terminal A/B 发现高密度提升专家监控效率。

错误吸收：

```text
Professional UI should be dense.
```

正确吸收：

```yaml
applies_when:
  user_expertise: expert
  task_type: [monitoring, comparison]
  information_volume: high
  frequency: high

forces:
  favors: [scan_efficiency, simultaneous_context]
  costs: [learnability, initial_cognitive_load]

does_not_apply_when:
  - novice onboarding
  - low-frequency focused task
```

它应首先作为领域证据强化已有“Professional tool density is acceptable only when hierarchy/grouping make it legible”相关知识，而不是新建一个无边界的“高密度原则”。

### Example B — Architecture Canvas Inspector

Architecture Canvas 中“Inspector 应 selection-driven”首先是 G3 project correction。

如果 Canvas、Data Explorer、IDE Inspector 等多个独立 Case 都出现“contextual detail 不应持续压过 primary workspace”的同一问题，则可以形成 G1/G2 Pattern candidate。

它仍不等于“所有 Inspector 必须 selection-driven”。

### Example C — Semantic Edge

某次 Canvas Review 发现无意义连接线误导用户。

第一层经验可能是 graph visualization domain rule；若架构图、流程图、数据 lineage、教学图都出现同一机制，则可以抽象为：

> Representation must preserve the semantics of relationships.

这时才有资格进入更通用的 Design Intelligence 候选。

## 20.8 Conflict Resolution and Anti-Overwrite Rules

新经验与旧知识冲突时，不允许“最近 Benchmark 获胜”。

冲突处理顺序：

### 0. Harmonize First

先检查是否只是 scope 不清导致伪冲突。

例如：

```text
“保持界面简洁”
vs
“专家数据工具需要高密度”
```

往往可以通过 user expertise / task frequency / information volume / density intent 细化而同时成立。

### 1. Respect Non-compensatory Higher Constraints

用户明确需求、安全、无障碍、产品宪法等高层约束不能被大量低层偏好“积分覆盖”。

### 2. Prefer More Specific Applicable Knowledge Within Allowed Bounds

领域规则可以通过更精确 scope 在当前场景优先于一般 Heuristic，但不能越过更高层不可补偿约束。

### 3. Prefer Current Verified Source Version

平台规范、标准或外部事实发生版本更新时，应按 source_version / review lifecycle 处理，不以旧条目惯性继续生效。

### 4. Record the Design Decision

真正无法通过 scope 消解的 tradeoff，应记录为 Design Decision，而不是全局删掉其中一条知识。

### 5. Challenge Foundation Through Evidence Review, Not Local Override

如果多个真实 Case 持续挑战某条 Foundation：

```text
Observed Conflict
      ↓
Implementation / routing error?
      ↓
Scope error?
      ↓
Domain exception?
      ↓
Heuristic weakness?
      ↓
Re-open original evidence
      ↓
Revise confidence / scope / lifecycle
```

只有最后一步完成后，才允许修改 Foundation 条目。

## 20.9 Knowledge Lifecycle

延续 D7 的治理思想：knowledge confidence 与 lifecycle 是正交字段。

建议长期保留：

```text
draft
→ reviewed
→ stable
→ deprecated
```

基本纪律：

- draft 不进入默认高置信 routing；
- stable 必须有明确 scope 和反适用条件；
- deprecated 不物理删除，必须保留 supersedes / replacement；
- 新领域知识应有 owner、version、source_version / evidence_refs、review policy；
- 无人维护且长期未复核的领域规则应可降级，而不是永久成为“真理”。

本阶段不要求一次实现完整 governance engine，但所有新增 artifact/schema 不得阻止未来加入这些字段。

## 20.10 Knowledge Deduplication Rule

每新增一个 candidate 必须先回答：

> 它是在增加新的知识，还是只是在增加旧知识的一个新的适用例？

优先使用：

- `evidence_refs` 增强；
- `examples` 增强；
- `counterexamples` 增强；
- `applies_when` 细化；
- `does_not_apply_when` 细化；
- routing trigger 细化；
- relationship / related_pattern 链接；

而不是不断增加同义 Rule。

这用于防止 100 个 Benchmark 最终制造 500 条表达同一原则的知识碎片。

## 20.11 Runtime Composition Policy

稳定知识并不意味着每次都全量发送。

Agent 当前任务收到的上下文应由四层组合：

```text
Current Task / Surface
        │
        ▼
Context Profile
        │
        ├── Applicable G0 Foundation
        ├── Applicable G1 Cross-domain Intelligence
        ├── Applicable G2 Domain Intelligence
        └── Relevant G3 Project Truth / Corrections
                         │
                         ▼
                  Context Compiler
                         │
                         ▼
                    Coding Agent
```

Prax 的 Context Compiler 必须同时避免：

- **under-context**：缺少关键领域事实；
- **over-context**：把所有历史研究和项目经验 Dump 给 Agent；
- **wrong-context**：把一个领域的局部模式强塞给另一个领域；
- **stale-context**：披露被 supersede / deprecated 的知识；
- **authority-flattening**：把 Standard、Scientific Model、Heuristic、Project Preference 当同一等级。

## 20.12 Benchmark Absorption Record

建议每次正式 A/B 除 comparison report 外，再产生一个轻量 Knowledge Absorption Review：

```yaml
knowledge_absorption:
  benchmark_id: ...

  findings:
    - id: finding_01
      classification: project_correction
      existing_knowledge_refs: [H-08, PAT-CANVAS-WORKSPACE]
      action: refine_scope
      target_scope: project
      promotion: none

    - id: finding_02
      classification: domain_candidate
      existing_knowledge_refs: []
      action: collect_more_evidence
      target_scope: graph_exploration
      promotion: pending_second_case

  conflicts:
    - knowledge_a: ...
      knowledge_b: ...
      resolution: scope_refinement

  new_general_rules: []
```

默认情况下 `new_general_rules` 应为空。

这不是额外形式主义，而是显式防止 Benchmark 成为“看到问题就给核心库加规则”的捷径。

## 20.13 Anti-overfitting Audit Questions

每次准备把新经验写入 Prax Runtime / Design Intelligence 前，必须回答：

1. 这是一个项目事实，还是跨项目知识？
2. 我们看到的是共同机制，还是只是视觉/题材相似？
3. 原 D1–D9 是否已经存在相关 Principle / Heuristic / Pattern？
4. 是知识缺失，还是 routing / disclosure 失败？
5. 能否通过细化已有 `applies_when` 解决，而不是新增规则？
6. 反例是什么？
7. 在什么情况下它不应该被使用？
8. 它的证据类型和强度是什么？
9. 它是否只在一个领域成立？
10. 如果另一个完全不同的产品读取它，会不会被误导？
11. 它是否与更高优先级 requirement / accessibility / product constitution 冲突？
12. 谁负责后续复核和废弃？

任一关键问题无法回答时，默认保持 project/domain candidate，不进入 Stable General Knowledge。

## 20.14 Success Condition for Knowledge Evolution

Prax 的学习成功不应表现为“规则数量越来越多”，而应表现为：

- 同类知识重复减少；
- scope 更准确；
- context routing 更精准；
- Agent 在不同领域得到不同但不矛盾的细化指导；
- 通用原则在跨项目中保持稳定；
- 局部经验不会污染无关任务；
- 新真实证据可以修正旧知识而保留演化历史；
- Human Review 从一次性对话转化为可追溯、可晋升、可废弃的经验资产。

最终目标不是构建最大的设计知识库，而是构建一个**不会遗忘成熟经验、不会被最新案例带偏、又能持续适应新领域**的 Design Intelligence + Product Context 系统。

---


# 21. Implementation Continuity Model

## 21.1 Why `prepare → agent → validate` Is Not Enough

当前 Prax 已能在 Implementation Brief 中提供 approved pattern、component contracts、required states、capability gaps 和 validation requirements，但如果中间实现过程完全不受 Prax 观察，就会出现一种新的失真：

```text
Approved Product / Design Intent
          ↓
Implementation Brief
          ↓
Agent makes unrecorded decisions
          ↓
Real UI drifts
          ↓
Final validation discovers only part of it
```

这类失败不是“SDIR 写错”，而是 **Design Drift During Implementation**。

因此最终模型必须是：

```text
IMPLEMENTATION_READY
        ↓
Implementation Loop
        ↓
Semantic Checkpoint
        ↓
Evidence Capture
        ↓
Drift Evaluation
   ┌────┴─────┐
   ▼          ▼
continue    correct / re-enter
   │          │
   └────┬─────┘
        ▼
Final Validation
```

## 21.2 Implementation Supervision Is Not Micro-management

Prax 不应每次改文件就触发检查。监督粒度是**设计语义 checkpoint**，例如：

- Workspace 主结构完成；
- Selection + Inspector 交互完成；
- Relationship rendering 完成；
- Loading/Empty/Error state 完成；
- Responsive semantic transformation 完成；
- Capability workaround 被实现；
- 高风险交互可操作。

不应把以下事件默认当作 Prax checkpoint：

- 调整 padding；
- 重命名变量；
- 拆分组件文件；
- 无设计语义影响的 refactor。

## 21.3 Supervision Depth Follows Lifecycle Depth

继续遵循 high floor / soft ceiling：

### visual_polish

```text
implementation
→ screenshot / contrast / hierarchy evidence
→ regression
→ validate
```

### defect_fix

```text
implementation
→ original defect evidence
→ regression evidence
→ validate
```

### modify_surface

```text
sdir_delta
→ one or more semantic checkpoints
→ delta drift / regression
→ validate
```

### add_surface / greenfield / rework

```text
multiple semantic checkpoints
→ structure / behavior / states / relationships
→ browser/runtime evidence
→ final validation
```

监督深度不能让 light path 重新承担 full-chain tax。

## 21.4 Protocol Surface Policy

Implementation Supervision 是 Runtime responsibility，不自动等于新增 MCP Gate/Tool。当前优先级：

1. 先复用现有 `prepare / validate / evidence` 语义；
2. 必要时增加内部 session/evidence service；
3. 只有真实 Benchmark 证明存在独立、稳定、跨 lifecycle 的 Agent workflow action，才考虑新增外部 MCP tool。

目标是增加闭环能力，而不是因为“实现阶段更复杂”就让 10-tool surface 失控。

---

# 22. Design Drift Control

## 22.1 Definition

**Design Drift**：真实实现仍然“能运行”，但已经偏离已批准的 Product Truth、Design Decision、SDIR、Relationship、Capability Resolution 或 Validation Obligation。

它和普通代码 bug 不同：

```text
implementation compiles
≠
product meaning is preserved
```

## 22.2 Drift Categories

Prax 至少应能归因以下 drift：

### D1 — Structural Drift

例如 Canvas 被 toolbar / inspector 分割得不再 dominant。

### D2 — Relationship Drift

source/target、direction、selection dependency、causal relation 或跨组件联动被错误实现。

### D3 — Behavioral Drift

例如设计是 `selection → inspector`，实现变成 `hover → inspector`。

### D4 — State Drift

Required states 丢失、被合并、错误转换，或 state feedback 与真实 domain/runtime state 不一致。

### D5 — Capability Drift

Agent 因现有 API/组件不方便，静默把已批准体验降级为较弱功能。

### D6 — Hierarchy / Density Drift

实现方便性、第三方组件默认样式或 craft skill 改变了 primary/secondary prominence。

### D7 — Responsive Semantic Drift

移动端/窄屏只做缩放或堆叠，导致原 semantic hierarchy / task model 丢失。

### D8 — Epistemic / Evidence Drift

DEMO 冒充 LIVE、illustrative 冒充 measured、unknown 被填成 zero、stale 被当 current。

### D9 — Accessibility / Input Drift

实现破坏 keyboard/focus/reduced-motion/alternative input 等明确 contract。

## 22.3 Drift Report

语义 checkpoint 可产生：

```yaml
drift_report:
  checkpoint_id: cp-003
  session_revision: 18
  compared_against:
    - screen.sdir.yaml
    - design-decisions.yaml
    - validation-plan.yaml
  findings:
    - id: drift-007
      kind: relationship
      severity: high
      contract_ref: rel-asset-inspector
      observed: inspector updates on hover
      expected: inspector updates on explicit selection
      evidence_refs:
        - browser-run-12
      recommended_action: rework_implementation
```

Drift Report 是 implementation evidence，不自动修改 Design Contract。

---

# 23. Implementation-time Decisions and Controlled Re-entry

## 23.1 Unplanned Design Decisions Are Expected

真实开发必然遇到设计阶段未覆盖的问题。Prax 不应假设一次 Design Phase 可以提前穷尽所有实现决策。

需要区分：

```text
Implementation encounters unknown
          ↓
Pure implementation detail?
      /             \
    yes              no
    │                 │
Agent decides      Design-impacting?
freely                 │
                       ▼
                Record explicit decision
                       │
                 Prax evaluates impact
                  /               \
              accept              re-enter
```

## 23.2 Design-impacting Trigger

至少以下变化不得作为“实现细节”静默处理：

- 新增/删除 Product Object；
- 改变 major region structure；
- 改变 information hierarchy；
- 改变 relationship semantics；
- 改变 interaction model；
- 改变 state model；
- 新增/删除 capability；
- 改变 major responsive semantics；
- 改变 evidence status / data meaning；
- 推翻已批准 Pattern / major design decision。

## 23.3 Controlled Re-entry

Controlled re-entry 是长期必要能力，但与当前严格前向状态机差距较大。v0.3.1 明确区分 **long-term semantics** 与 **Phase 8 first implementation**，防止 Coding Agent直接扩成通用事务/回滚系统。

长期语义：

```text
Implementation Finding
        ↓
Identify earliest affected artifact / gate
        ↓
Invalidate only affected downstream artifacts
        ↓
Re-enter minimum necessary decision point
        ↓
Regenerate compiled context / validation obligations
        ↓
Continue implementation
```

不是：

```text
任何变化
→ 整个 session 从头再来
```

也不是：

```text
任何变化
→ Agent 自己在代码里决定
```

### Phase 8 First Re-entry Scope

第一次实现优先只支持一个被真实 drift 证明需要的路径：

```text
implementation finding
→ re-enter decide
→ invalidate active sdir / sdir_delta
→ invalidate active validation plan revision
→ invalidate active implementation brief
→ preserve prior revisions for audit
→ regenerate only affected downstream artifacts
```

如果 finding 实际要求回到 framing/understanding，Phase 8 先记录为 `REENTRY_SCOPE_UNSUPPORTED` + REVIEW，不自行扩大回退范围。只有真实 Case 重复需要更早 gate 时，再扩 re-entry policy。

## 23.4 History Must Be Preserved

被 supersede 的 decision / SDIR / context artifact 不应物理消失。至少在 audit/benchmark mode 中，应能回答：

- 原决定是什么；
- 什么实现证据触发了 re-entry；
- 谁修改；
- 哪些 downstream artifact 被 invalidated；
- 新版本是什么。

---

# 24. Execution Evidence & Benchmark Capture

## 24.1 Purpose

真实 A/B 不能只保存最终截图和最终代码。否则后续新会话只能判断“哪里不好”，无法判断：

- Agent 当时看到了什么；
- Prax 选中了什么 Context；
- Agent 实际调用了哪些资产；
- 第一次错误发生在哪里；
- Validation 是否成功修回；
- Human Review 是否重复纠正同类问题；
- 失败来自 Knowledge、Routing、Compiler、Agent、Implementation 还是 Validation。

因此第一次真实 A/B **之前**必须先有最小 Execution Evidence Capture。

## 24.2 What to Record

Benchmark 应至少保存四类证据。

### A. Immutable Inputs

- requirement snapshot；
- repo/base commit；
- environment；
- agent/model/tool versions；
- Prax version；
- knowledge/asset versions；
- arm-specific input；
- Prax Arm 实际得到的 compiled context。

### B. Observable Agent Actions

记录可观察动作与显式决策，例如：

- Prax/tool calls；
- file reads/edits；
- asset/skill invocation；
- implementation checkpoint；
- tests/browser runs；
- explicit decision / correction；
- validation submissions。

**不得要求记录 private chain-of-thought。**

### C. Implementation History

- changed files；
- git diff / commits；
- decision history；
- checkpoint snapshots；
- screenshots；
- browser/runtime evidence；
- drift reports。

### D. Review & Attribution

- rubric；
- human review；
- findings；
- root-cause classification；
- corrections；
- knowledge/asset absorption review。

## 24.3 Benchmark Package Layout — Canonical Run Schema

静态定义位于 `benchmarks/<benchmark-id>/`；以下只描述一次实验的 run evidence。

```text
benchmark-runs/
└── PRAX-AB-001/
    ├── experiment-manifest.yaml
    ├── prax-lock.yaml
    ├── replicates/
    │   ├── run-01/
    │   │   ├── arm-a-bare/
    │   │   │   ├── input/
    │   │   │   ├── execution/
    │   │   │   │   ├── events.ndjson
    │   │   │   │   └── decisions.ndjson
    │   │   │   ├── implementation/
    │   │   │   │   ├── git-diff.patch
    │   │   │   │   ├── changed-files.txt
    │   │   │   │   └── checkpoints/
    │   │   │   ├── evidence/
    │   │   │   │   ├── screenshots/
    │   │   │   │   ├── browser/
    │   │   │   │   └── validation-results.yaml
    │   │   │   └── summary.yaml
    │   │   └── arm-b-prax/
    │   │       ├── input/
    │   │       │   ├── compiled-context.md
    │   │       │   ├── context-compilation-trace.yaml
    │   │       │   └── prax-artifacts/
    │   │       ├── execution/
    │   │       ├── implementation/
    │   │       ├── evidence/
    │   │       └── summary.yaml
    │   ├── run-02/
    │   └── run-03/
    ├── review/
    │   ├── blinded-outcomes/
    │   ├── rubric.yaml
    │   ├── comparison.yaml
    │   └── findings.yaml
    └── lessons/
        ├── prax-gaps.yaml
        ├── candidate-corrections.yaml
        ├── asset-observations.yaml
        └── benchmark-learnings.md
```

Bare 与 Prax 的公共 execution evidence 必须由上层 Benchmark Harness 捕获；Prax-specific artifact 只存在于 Prax arm。

## 24.4 `summary.yaml`

完整事件可以很长，因此每个 Arm 必须有快速入口：

```yaml
run:
  id: PRAX-AB-001-B
  arm: prax

result:
  implementation_completed: true
  final_validation: REVIEW

process:
  wall_clock_seconds: 1840
  model_usage:
    input_tokens: 128000   # or not_observable
    output_tokens: 24000   # or not_observable
  tool_calls: 47
  prax_calls: 12
  asset_invocations: 2
  semantic_checkpoints: 4
  implementation_revisions: 3
  first_pass_validation_failures: 2
  post_first_pass_repair_rounds: 1
  human_clarifications: 2
  human_corrections: 1

important_events:
  - seq: 31
    finding: relationship direction incorrect
  - seq: 52
    finding: inspector became persistently prominent

open_questions:
  - relationship context may have been disclosed too late
```

## 24.5 Context Compilation Trace

必须能回答“Prax 为什么给了这些 Context”：

```yaml
context_compilation:
  task_ref: implementation.canvas.relationships
  signals:
    product_archetypes: [professional_workspace, graph_exploration]
    relationship_complexity: high
  selected:
    - ref: PAT-CANVAS-WORKSPACE
      reason: [canvas_workspace, persistent_context]
    - ref: rel-service-dependency
      reason: [task_surface_match]
  excluded:
    - ref: PAT-SETTINGS-SECTIONS
      reason: scope_mismatch
```

## 24.6 Failure Attribution Taxonomy

每个重要 Finding 尽量归因到：

1. **Knowledge Gap** — Prax 根本不知道；
2. **Context Routing Failure** — 知道但没选中；
3. **Context Compilation Failure** — 选中了但没有正确传给 Agent；
4. **Agent Reasoning Failure** — Agent 已收到正确 Context，且存在可观察、显式的矛盾判断；
5. **Implementation Failure** — 显式判断正确但代码/交互实现错误；
6. **Validation Gap** — 错误发生但 Prax 未检测；
7. **Requirement / Evidence Gap** — 输入本身不足；
8. **Process Overhead** — Prax 太重导致绕过、形式化完成或无效交互；
9. **Capability / Asset Mismatch** — 路由了不适合的 Skill/Component，或 baseline hardcoded stub 诱导错误；
10. **Authority Conflict Failure** — 多个资产/规则冲突未正确裁决；
11. **INCONCLUSIVE** — 当前 evidence 不足以诚实区分上述原因。

### No-CoT Attribution Rule

不得通过猜测 private chain-of-thought 判定 #4。只有当：

- compiled context snapshot 证明 Agent 收到了相关正确信息；
- `decisions.ndjson` / implementation summary / tool-visible decision / code-level explicit choice 显示相反判断；
- Router/Compiler failure 已被排除；

才归因 Agent Reasoning Failure。否则优先 `INCONCLUSIVE` 或可证的上游类别。

这个分类用于决定“该改哪一层”，避免所有失败最终变成“再加一条规则”。

## 24.7 Capture Modes

Evidence Capture 不应让普通开发承担 Benchmark 的全部成本。建议至少两档：

### Benchmark / Audit Mode

- immutable input snapshot；
- full observable event trace；
- exact versions / lock；
- semantic checkpoints；
- screenshots/runtime evidence；
- attribution/review package。

### Normal Project Mode

- key design-impacting decisions；
- selected capability/version；
- important correction/regression；
- validation evidence；
- final implementation ref；
- optional checkpoint summary。

两者使用同一 Evidence Model，只是采集强度不同，避免建设两套互不兼容的系统。

---

# 25. Implementation Intelligence

## 25.1 Why Prax Should Reuse Existing Implementation Expertise

Prax 不需要与成熟的前端 Skill、组件库、测试框架竞争“谁更会写 CSS/React”。真正应该形成的是：

> **Implementation Intelligence：怎样在已确认 Product/Design Contract 下可靠实现。**

它与 Design Intelligence 不同：

```text
Design Intelligence
“一个好的设计一般应知道什么”
        ↓
Prax Design Contract
        ↓
Implementation Intelligence
“在这个 contract 下怎样可靠实现”
```

## 25.2 Asset Types

Implementation Intelligence 可包含：

- `skill` — 实现方法/Agent 指令；
- `recipe` — 某类问题的组合实现流程；
- `primitive` — selection/focus/async cancellation 等基础行为资产；
- `component` — 可复用 UI / interaction 实现；
- `adapter` — 外部 Skill / library / MCP 到 Prax Contract 的适配层；
- `test_strategy` — 特定交互/视觉/运行时的验证方法；
- `reference_implementation` — 经验证的参考实现，而不是强制模板。

## 25.3 Internal and External Are Peers at Routing Time

Capability Router 不应因为资产是 Prax 自研就默认优先，也不应因为外部 Skill 流行就默认可信。

评价依据是：

- task capability match；
- stack compatibility；
- design authority scope；
- evidence；
- known risks；
- version / freshness；
- execution security；
- organization policy。

---

# 26. Implementation Capability Registry

## 26.1 Purpose

统一登记 Prax 内部资产、用户资产、组织资产和外部 Skill，使 Agent 不需要理解每个 provider 的内部细节。

最小 Registry contract 可类似：

```yaml
capability:
  id: ui-styling
  provider: external
  version: 1.x

  capabilities:
    - accessible_components
    - responsive_layout
    - styling

  stacks:
    - react
    - tailwind

  authority:
    level: implementation

  may_decide:
    - css_strategy
    - primitive_selection

  may_not_override:
    - product_objects
    - information_hierarchy
    - interaction_model
    - semantic_relationships
    - required_states

  strengths:
    - component_composition
    - accessibility

  risks:
    - may_apply_stack_defaults

  execution:
    class: instruction_only

  provenance:
    source: external
    license: review_required
```

## 26.2 Authority Is Mandatory

每个能力都必须回答：

- 它可以决定什么？
- 只能建议什么？
- 绝对不能覆盖什么？

特别是 broad design skill / visual craft skill，不能重新 frame 产品或覆盖 Prax 已确认的 hierarchy / density / relationship / state。

## 26.3 Risks Are First-class

Skill 不只有 strengths，也有偏见，例如：

- 可能过度留白；
- 可能过度装饰专业工具；
- 可能偏向某套 component library；
- 可能把 landing-page aesthetic 应用于 high-density workspace；
- 可能默认 mobile/consumer assumptions。

这些风险应成为 routing 输入，而不是事后抱怨。

## 26.4 Capability Routing, Not Skill Stacking

一个任务不应默认同时激活 UI/UX Pro Max、Hallmark、frontend-design、ui-styling 和所有内部 Skill。

正确流程：

```text
Implementation Need
      ↓
Capability Query
      ↓
Candidate Assets
      ↓
Authority / Conflict / Risk Filter
      ↓
Smallest Useful Capability Set
      ↓
Agent
```

## 26.5 Initial External Candidates

后续可选择少量外部 Skill 做适配实验，例如：

- 实现型 UI styling / component composition skill；
- visual craft / anti-generic review skill；
- broad UI/UX guidance skill。

具体 provider、版本与许可必须在实际集成阶段重新确认。本 Spec 不将任何当前第三方 Skill 固化为长期依赖。

---

# 27. Internal Skills, Components and Reusable Primitives

## 27.1 Prax Should Accumulate Its Own Implementation Assets

真实 Benchmark / 项目反复证明稳定的实现经验可以逐渐沉淀为第一方资产。

但规则是：

```text
one successful implementation
        ≠
stable Prax skill/component
```

推荐生命周期：

```text
successful local implementation
        ↓
project recipe
        ↓
reused in another independent context
        ↓
candidate internal asset
        ↓
benchmark / review
        ↓
reviewed / stable asset
```

## 27.2 Components Are Not Skills

- Skill 主要回答“怎么做”；
- Component 是“已经实现的可复用资产”；
- Primitive 通常是更底层的行为能力；
- Recipe 是多资产的组合方式。

这些类型需要分开治理。

## 27.3 Behavioral Primitives Are Often More Valuable Than Decorative Components

优先关注：

- focus management；
- selection model；
- undo/redo；
- async cancellation / generation token；
- persistence；
- state feedback；
- semantic edge；
- inspector coordination；
- partial failure isolation。

而不是只积累视觉 card / hero / button 模板。

## 27.4 Components Need Semantic Contracts

Prax Component 不应只有 props。它至少应说明：

```yaml
component_contract:
  id: PRAX-CONTEXTUAL-INSPECTOR
  intended_for:
    - expert workspace
    - selection-driven secondary detail
  supports:
    - keyboard focus
    - persistent primary context
  requires:
    - explicit selection model
  does_not_fit:
    - primary task content
    - persistent always-visible detail without rationale
  validation:
    - context_preservation
    - keyboard
```

这样 Agent 知道何时**不应该**复用。

## 27.5 Prevent Component-driven UI

如果现有组件不匹配 Product Context，Prax 必须允许：

- 不使用该组件；
- 组合多个 primitive；
- 新建实现并记录 candidate。

不能因为资产已经存在就扭曲产品结构。

## 27.6 External Capability Adaptation Paths

对于外部 Skill/组件/工具，Prax 可以有三种长期策略：

1. **Reference** — 直接按版本引用，由外部维护；
2. **Wrap / Adapt** — 保留外部实现，在外层增加 Prax Contract、authority、risk 和 evidence；
3. **Curate / Internalize** — 只有在许可证允许、价值反复验证、长期维护合理时，才把方法或实现重新沉淀为 internal asset。

禁止“因为外部 Skill 很好用”就复制其内容进入 Prax 而忽略来源、版本和许可证。

---

# 28. Prax Asset Layer — Project, User, Organization, Community, System

## 28.1 Why Assets Must Be User-facing

Prax 的积累能力不应只服务 Prax 开发者。长期用户和组织也应能形成自己的 Product/Design/Frontend Intelligence。

用户长期使用后的 Prax 应明显比第一天更懂：

- 这个用户/团队怎样设计；
- 哪些实现经过真实验证；
- 哪些错误过去已经发生；
- 哪些组织约定必须遵守；
- 哪些资产在什么条件下有效。

## 28.2 Asset Scope

建议作用域：

```text
PROJECT
  当前项目事实、correction、局部 recipe

USER
  个人跨项目复用经验与资产

ORGANIZATION
  团队/公司的 design authority、组件、skill、domain pattern

COMMUNITY
  用户主动公开、经过基本审查的共享资产

SYSTEM
  Prax 官方 curate / stable 的内置资产
```

此外 `EXTERNAL` 表示由第三方维护、Prax 只引用/适配的资产来源，它不是一个信任等级。

## 28.3 Scope ≠ Maturity

成熟度单独表示，例如：

```text
observed
→ candidate
→ reviewed
→ stable
→ superseded
→ deprecated
→ archived
```

因此可以存在：

- stable project asset；
- candidate organization asset；
- reviewed community asset；
- deprecated system asset。

## 28.4 Asset Families

用户/组织可以积累的不只是 Implementation Skill。资产至少包括：

### Design / Product Intelligence

- domain pattern；
- organization convention；
- design authority；
- scoped heuristic；
- relationship convention。

### Implementation Intelligence

- skill；
- recipe；
- primitive；
- component；
- adapter；
- test strategy。

### Experience / Evidence Assets

- correction；
- regression rule；
- benchmark fixture；
- validated decision；
- known failure / counterexample。

不同资产类型可以共享 scope/version/provenance/lifecycle 基础字段，但不得因为统一 Registry 就丢失各自语义。

## 28.5 Scope Resolution

Scope specificity 与 provider origin 是两条不同轴。

在 **同一 authority/type、均通过适用性与安全约束** 时，更具体 scope 通常优先：

```text
project
  > applicable user/organization asset
  > explicitly selected community asset
  > system default
```

但这不代表 internal/system provider 天生高于 external provider，也不代表 project asset 可以覆盖更高产品约束。§25.3 的“internal/external are peers at routing time”只讨论 **provider axis**；本节讨论 **scope axis**。两轴相遇时按 §31.1：先裁 Authority/Non-compensatory Constraint，再比较适用 scope、quality/evidence、risk/version。

因此：

- project local component 不能覆盖 confirmed requirement / current Design Contract；
- system default 可以被更具体 project asset 替代，但只能在双方拥有相同 authority、都适用且无 higher constraint 冲突时；
- external skill 可以击败 internal skill，如果它在当前 capability/task 上证据更强、风险可接受且不越权；
- provider 与 scope 不得被压成一个简单优先级数字。

---

# 29. User Learning and Asset Candidate Discovery

## 29.1 Prax May Detect, Not Auto-promote

在多个项目中发现重复成功结构时，Prax 可以提出：

> “检测到可能可复用的 Pattern / Skill / Component / Primitive。”

但默认动作是产生 `candidate`，不是自动修改用户正式资产。

## 29.2 Candidate Sources

可来自：

- 重复成功的 implementation；
- 多次 Human Review 后稳定的 correction；
- 多项目一致的 design decision；
- 经 Validation 反复通过的组件；
- 外部 Skill 的稳定 wrapper/adaptation；
- Organization 内重复出现的 domain rule。

## 29.3 Candidate Decision

用户/组织至少可选择：

```text
ignore
save as project asset
save as personal asset
submit to organization review
share to community candidate
```

## 29.4 Candidate Extraction Must Preserve Evidence

不能只抽取代码，还要保留：

- observed problem；
- context；
- forces；
- solution；
- known tradeoffs；
- successful contexts；
- failure contexts；
- validation evidence；
- dependencies / versions。

---

# 30. Contribution and Registry Feedback Loop

## 30.1 Contribution Is an Explicit Export

用户资产不应自动公开。

推荐流程：

```text
Project/User/Org Asset
        ↓
User explicitly chooses Share
        ↓
Contribution Package
        ↓
Sensitive / License / Dependency Scan
        ↓
Registry Candidate
        ↓
Maintainer / Community Review
        ↓
Benchmark / Evidence Review when needed
        ↓
Scope Classification
    ┌──────┼─────────┐
    ▼      ▼         ▼
 reject  community  curated/system candidate
```

## 30.2 Core Repo and Registry Should Be Separable

长期建议将 Runtime/Core 与高频变化资产生态解耦，例如：

```text
Prax Core Repository
        │
        └── consumes approved registry releases

Prax Asset Registry
├── design/
├── implementation/
├── domains/
├── adapters/
└── benchmarks/
```

是否独立仓库属于后续实施决策，但逻辑边界应从现在开始保持。

## 30.3 Community Popularity Is Not System Authority

stars/downloads/reuse count 可以作为 adoption signal，但不得直接决定：

- system knowledge promotion；
- default routing priority；
- general applicability。

证据、scope、review、known failures 和 safety 仍然是主要依据。

---

# 31. Asset Governance

## 31.1 Authority and Conflict Resolution

资产越来越多以后，最危险的问题不是缺能力，而是多套指导互相冲突。

Prax 必须显式保存 authority，而不是让 Agent 自己凭自然语言权衡。

对于高价值资产，至少应把以下维度视为相互独立：

```text
Scope      — 在哪里适用
Maturity   — 被验证到什么程度
Authority  — 可以决定/覆盖什么
Provenance — 从哪里来
Version    — 当前是哪一版
Risk       — 执行/依赖风险是什么
```

推荐裁决顺序不是简单的全局静态 ladder，而是：

### Step 1 — Resolve Non-compensatory Constraints

例如：

- confirmed requirement；
- explicit user evidence；
- normative accessibility/safety；
- explicit capability limitation；
- legal/license/security constraint。

这些不能被 aesthetic advice 补偿。

### Step 2 — Apply Mode-specific Product Authority

- existing_product：established product patterns 可能是 authoritative constraint；
- rework：existing system 只是 evidence/migration boundary；
- greenfield：没有 legacy authority。

### Step 3 — Prefer Explicit Current Human/Project Decisions

Human-approved override 必须留下 rationale/evidence，不是 silent override。

### Step 4 — Apply Approved Design Contract

Product Frame / Decision / SDIR / Correction / Validation Contract 是当前 Session 的主要设计 authority。

### Step 5 — Apply Scoped Domain/Implementation Knowledge

只在不违反前面 authority 的情况下使用：

- domain pattern；
- organization component；
- internal skill；
- external skill；
- craft advice。

### Step 6 — Record Material Conflict

如果冲突会改变 hierarchy、interaction、relationship、state、capability 或 major visual semantics，不允许 silent winner；应进入 explicit decision / correction。

## 31.2 Asset Dependency Metadata

高价值资产应逐步支持：

- `requires`；
- `conflicts_with`；
- `supersedes`；
- `incompatible_with`；
- `compatible_with`；
- `minimum_version`。

避免依赖只藏在 Skill 文本里。

## 31.3 Asset Quality Evaluation

资产质量不能只看复用次数。应保留多维证据：

```text
validated reuse contexts
+ benchmark pass/fail
+ human correction rate
+ regression history
+ known failure contexts
+ scope diversity
+ version freshness
+ dependency health
```

不建议立即压成一个单一 quality score；保留维度更利于治理。

## 31.4 Deprecation and Forgetting

积累和遗忘同等重要。

资产必须支持：

```text
stable
→ superseded
→ deprecated
→ archived
```

并记录：

- why deprecated；
- replacement；
- last compatible version；
- affected projects；
- migration guidance。

Prax 的成熟不应表现为资产数量无限增长，而应表现为更准确的 scope、更低重复、更清晰的替代关系。

## 31.5 Version & Reproducibility

建议引入逻辑上的 `prax-lock.yaml`：

```yaml
prax_lock:
  prax_version: 0.x
  runtime_commit: ...
  knowledge_release: ...
  upstream_research_release: research-2026-08-26
  asset_registry_release: ...

  capabilities:
    - id: prax.semantic-edge
      version: ...
    - id: external.ui-styling
      source_commit: ...

  agent:
    provider: ...
    model: ...

  project:
    base_commit: ...
```

Benchmark 必须锁定；普通项目可按风险选择简化记录。高价值 release/asset 最好同时保存 content digest / source commit，避免同一 version label 指向不同内容。

## 31.6 Provenance & License

外部、社区和内部派生资产至少需要：

- origin；
- source URL/repo/ref；
- license；
- modified_from；
- author/maintainer；
- redistribution constraints；
- dependency licenses where material。

“方法被验证有价值”不等于“代码/Skill 内容可以复制进入 Prax”。

## 31.7 Execution Security Classification

Capability Registry 至少区分：

```text
knowledge_only
instruction_only
code_generation_helper
local_executable
mcp_or_tool_provider
network_capable
```

风险越高，越需要明确：

- permission；
- filesystem scope；
- network access；
- secret handling；
- package/install behavior；
- sandbox expectations。

第三方 Skill 不应因名称是“Skill”就默认视为无害文本。

## 31.8 Portability

关键用户资产应能够导出/导入为：

- Markdown；
- YAML / JSON；
- source files；
- Git repository；
- explicit manifests。

原则：

> **Prax 不运行时，用户仍能理解和取回自己的核心资产。**

## 31.9 User Sovereignty

默认策略：

- private by default；
- candidate discovery 可关闭；
- candidate 不自动成为 authority；
- sharing 必须 opt-in；
- 用户能看到 asset source / scope / maturity；
- 用户能 export / delete；
- Organization promotion 需要组织权限/流程，而不是任一 Agent 自动完成。

---

# 32. Unknown / No-Asset Strategy

## 32.1 Why It Matters

当资产生态成熟后，会出现新的风险：

> 因为“已经有一个 Pattern / Component / Skill”，系统就强迫所有新问题套用它。

这与 Backend-driven UI、Component-driven UI 本质相同。

## 32.2 Valid Router Outcome

Router 必须允许：

```yaml
capability_route:
  status: no_suitable_asset
  reason:
    - available candidates have weak context match
    - existing component conflicts with approved hierarchy
  fallback:
    derive_from_product_context: true
    record_candidate_after_validation: true
```

## 32.3 Confidence Threshold

低 confidence 时应：

- disclose uncertainty；
- prefer generic implementation freedom；
- avoid强制复用；
- preserve evidence for later candidate review。

“没有成熟答案”本身是一种健康状态。

---

# 33. Product UX for Learning and Assets

Prax 内部可以有大量 YAML/NDJSON，但用户不应被迫理解所有内部 Artifact。

长期 UI 应让用户看到高价值决策，例如：

```text
当前任务将使用：
✓ Prax Canvas Pattern
✓ Organization Workspace Convention
✓ Internal Semantic Edge Primitive
✓ External Styling Skill

⚠ Visual Craft Skill 未启用
原因：与当前 compact professional density 存在潜在冲突
```

资产积累可以表现为：

```text
Prax 在 3 个项目中发现相似的 Contextual Inspector 实现。

[查看证据]
[保存为个人资产]
[提交组织评审]
[忽略]
```

Contribution 可以表现为：

```text
准备分享此资产
✓ 已移除 project-specific reference
✓ 未发现 secret
⚠ 依赖外部 Skill，许可证待确认

[查看贡献包]
[提交]
```

产品原则：

- 默认展示“为什么选择这个能力”；
- 冲突可见；
- scope/maturity 可见；
- 复杂 Artifact 按需展开；
- 用户拥有最终分享与晋升决定。

---

# 34. Unified Governance Model

Prax 长期可以理解为四个相互协作的治理面，加一个资产/版本底座。

## 34.1 Product Governance

回答：

> 当前产品什么是真实的？哪些用户/产品承诺不能被实现方便性改变？

主要对象：Requirement、Product Frame、Existing Understanding、Relationship、Decision、SDIR、Capability Gap。

## 34.2 Knowledge Governance

回答：

> 什么经验值得相信？适用于哪里？何时可以从项目晋升到领域/通用知识？

主要对象：D1–D9、Principle、Heuristic、Pattern、Domain Intelligence、Correction promotion。

## 34.3 Capability Governance

回答：

> 当前实现需要哪些能力？应该使用内部资产还是外部 Skill？它们可以决定什么？有什么风险？

主要对象：Capability Registry、Skill、Recipe、Primitive、Component、Adapter。

## 34.4 Evidence Governance

回答：

> 我们凭什么认为设计与实现正确？如果失败，失败发生在哪一层？

主要对象：Validation Plan、Execution Evidence、Drift Report、Benchmark Package、Human Review。

## 34.5 Asset / Version Substrate

贯穿四个治理面：

- scope；
- maturity；
- version；
- provenance；
- dependencies；
- license；
- security；
- portability；
- contribution history。

统一运行闭环：

```text
Understand
   ↓
Context / Product Governance
   ↓
Design / Knowledge Governance
   ↓
Capability Selection
   ↓
Implementation Supervision
   ↓
Evidence / Validation
   ↓
Correction / Asset Candidate
   ↓
Knowledge & Asset Evolution
```

---

# 35. Extended Benchmark Strategy

## 35.1 Primary Architecture Canvas A/B Remains the First Real Test

第一次真实实验仍然优先回答：

- Relationship 是否有价值；
- Context Compilation 是否有价值；
- Pre-implementation Validation 是否有价值；
- Correction Memory 是否减少重复错误；
- 最小 Implementation Supervision 是否能捕获 Drift。

不要为了测试外部 Skill 而污染第一次核心 A/B。

## 35.2 Capability Experiment Comes After Baseline

核心 A/B 有结果后，可增加次级实验：

```text
A — Bare Agent
B — Agent + generic implementation/UI skill
C — Agent + Prax
D — Agent + Prax + routed implementation capability
```

这用于回答：

> Prax 的价值是否来自“自己比 Skill 更会设计”，还是来自“让现有能力在正确 Product Context / Authority 下工作”。

推荐预期：D 应在 design fidelity + implementation craft 上优于单独 Skill，但该结论必须由真实 evidence 支持。

## 35.3 A Second Independent Case Is Mandatory Before Stabilization

Architecture Canvas 只能证明一类复杂 Workspace/Relationship 场景。任何准备进入 stable 的 Context / Implementation primitive，默认还需要第二个独立复杂 Case。

第二 Case 的具体推荐与目标见下一节。只有跨 Case 重复出现、且 scope 可以被清楚描述的需求，才考虑稳定化新的 Context / Implementation primitive。

---

# 36. Second Independent Benchmark Strategy

Architecture Canvas 完成真实 A/B 后，第二个 Case 推荐选择：

> **Data / Log Explorer / Professional Data Workspace**

原因：它能以相对可控的实现复杂度暴露下一批 Context Needs：

- data provenance；
- dense information hierarchy；
- filter/search；
- global selection；
- inspector；
- empty/loading/error；
- cross-region relationship；
- persistent preference；
- runtime state。

第二 Case 的目的不是“验证 Data Module”，而是观察：

> 当前 Relationship、Context Manifest、Validation Contract、Correction Memory 不够的地方究竟是什么。

只有反复出现的数据/证据缺口才进入新的 Context Primitive 设计。

---

# 37. Phased Implementation Sequence

> **Execution rule**：本节定义 Agent 实际开发顺序。前文是完整目标架构，不代表所有阶段一次实现。任何阶段 Exit 未满足时，不得提前建设后续生态层。

## Phase -2 — Freeze Baseline, Protocol and Harness Feasibility

在改 Runtime 代码前：

1. 记录 repo base commit / CI / test count；
2. 固定 v0.3.1 为本阶段 Spec；
3. 写 `benchmarks/architecture-canvas-ab/protocol.md`；
4. 明确主 A/B 的 evidence level、不可声称内容、≥3 independent runs/arm；
5. 定义 canonical Benchmark Package schema；
6. 确认 Agent Harness 能捕获 Bare/Prax 共用的 time/tool/file/command/git/browser 最小 evidence；
7. 预登记 `.prax/` isolation、blind review、component-contract stub 等 known limitations；
8. 定义 `first pass` 与成本指标。

### Exit

团队能回答：两臂如何隔离、如何捕获相同过程证据、如何复现、如何盲评、哪些结论允许/禁止。若 Harness 不能捕获 Bare Arm 关键证据，先解决 Harness，不进入 A/B。

## Phase -1 — Versioned Knowledge Baseline Declaration

1. 将 D1–D9、Source Registry、MegaPrompt Insights 形成 `research/upstream/` snapshot/digest；
2. 建 `manifest.yaml` + content hashes + upstream release；
3. Runtime 23 条 Knowledge Entry 明确为 compiled subset；
4. 启用 Knowledge Absorption Review；
5. 保证 Coding Agent 可以在 repo 内查询 upstream research，而不是依赖聊天附件；
6. 不要求 vendor 受版权限制的外部全文。

### Exit

新 Benchmark Finding 能被实际对照到版本锁定的上游知识，且 Benchmark 可锁定 `upstream_release`。

## Phase 0 — Documentation Normalization + Principle Registry

1. 对齐 lifecycle ADR / implementation spec / current code；
2. 清理 superseded confirmation/reconcile 描述；
3. Principle Registry 成为 Constitution/phase invariant/candidate 的唯一原则文本来源；
4. 写明 Product Relationship / Region Relationship / Representation 三层；
5. 写明 Classification ↔ Manifest、Validation kind ↔ facet；
6. 不改外部协议行为。

### Exit

Coding Agent 不会从 docs 得到互相冲突的 lifecycle、relationship、classification、validation 或“prepare 后 Prax 退出”的误解。

## Phase 1 — First-class Relationship

实现最小：

- Product Relationship stable id + direction/meaning/opaque condition/importance；
- Product object referential validation；
- ExistingUnderstanding `current_relationships`；
- derived-frame preservation；
- SDIR Region Relationship stable id；
- optional typed representation refs only where needed；
- backward compatibility；
- Architecture Canvas fixture + tests。

### Exit

Greenfield 与 existing/modify 路径都能表达关键关系；对象层、region 层和 visual/runtime representation 不混层；不引入表达式引擎或万能 Graph IR。

## Phase 2 — Session-level Context Manifest

实现：

- Runtime-owned artifact schema；
- Classification 作为输入之一；
- deterministic derivation；
- `required|optional|none` capability status；
- derived_from revisions/digests；
- stale/rederive；
- no new gate；
- light path protection；
- unknown preservation。

### Exit

不同 lifecycle 都能得到足够 routing metadata，Agent 无法把手改 Manifest 当 authority，上游 artifact 更新会使旧 Manifest 失效。

## Phase 3 — Persisted Pre-implementation Validation Obligations

实现：

- `validation-plan.yaml`（或等价 artifact）在 implementation-ready 前 materialize；
- plan revision/digest + derived_from；
- Implementation Brief 引用 exact plan revision；
- `design_validate` 默认使用同一 plan revision；
- re-entry 后旧 plan stale、新 plan 明确生成；
- 保持 `deterministic|assistive|empirical` 三 kind；facet 独立字段；
- 不造第二套 Acceptance 系统。

### Exit

Agent 写代码前知道必须证明什么；无 re-entry 时 prepare/validate 不会使用不同 plan；旧 plan 可审计。

## Phase 4 — Correction / Regression Memory

实现：

- project-local correction schema；
- store/resume；
- supersede；
- scoped routing；
- validation regression；
- 明确 project-local 默认，不自动晋升 knowledge。

### Exit

跨新 Agent 会话仍能按 scope 恢复 correction，无关任务不被污染。**此阶段只证明机制，不用当前已被 Pattern 吸收的 Inspector 修正声称 H4 因果价值。**

## Phase 5 — Minimal Context Compilation

实现：

- task-scoped packet；
- relevant Product/Region Relationship；
- relevant Correction / Decision / unresolved / Validation obligation；
- compiled-context artifact；
- context-compilation-trace；
- exclusion reasons；
- irrelevant context leakage measurement。

### Exit

Prax Arm 不依赖 artifact dump，并能回答“为什么给了/没给某 Context”。

## Phase 6 — Minimal Execution Evidence Capture

**必须在第一次真实 A/B 前完成。**

实现：

- Benchmark Harness 侧 Bare/Prax 共用 trace；
- experiment/run manifest；
- `prax-lock.yaml`；
- events/decisions NDJSON；
- time/token-or-not-observable/tool metrics；
- compiled context snapshot（Prax）；
- git diff / changed files / checkpoints；
- screenshots/runtime evidence paths；
- summary.yaml；
- failure attribution incl. INCONCLUSIVE；
- no private CoT。

### Exit

原 Agent 会话消失后，新会话仅通过 Benchmark Package 能重建关键可观察过程；Bare/Prax 两臂证据结构可比较。

## Phase 7 — Architecture Canvas Real Bare vs Prax A/B

执行：

- ≥3 independent runs/arm；
- same requirement/model/harness/tools/runtime/budget policy；
- clean isolated worktrees；
- `.prax/` contamination check；
- blinded/randomized outcome review；
- same Rubric + cost metrics；
- pre-registered known limitations。

### Exit

获得至少 `L2_replicated_implementation` 的方向性 evidence，并能做 primitive/failure-layer 归因；不声称统计显著或跨域通用。

## Phase 7B — Cross-session Correction Memory Experiment

使用 `PRAX-MEM-001`：

- Task 1 两组做同类工作；
- 两组收到同一条尚未进入 stable knowledge 的 human correction；
- 关闭会话；
- 新 Agent 会话执行相关 Task 2；
- 比较 recurrence / retrieval / leakage；
- 区分 knowledge retrieval 与 correction retrieval。

### Exit

H4 得到真实跨会话 evidence，或被判定需 revise/remove；不能用当前已被知识吸收的 correction 做因果证明。

## Phase 8 — Minimal Implementation Supervision & Drift Check

只根据 A/B 中真实 drift 实现最小能力：

- semantic checkpoint；
- authoritative contract ref；
- drift report；
- design-impacting decision detection；
- 最小 controlled re-entry（首版优先只支持 re-enter `decide`，使 `sdir/sdir_delta → validation plan → implementation brief` stale；如果真实 Case 需要更早 re-entry 再扩展）；
- light path supervision depth。

### Exit

至少一个真实 A/B drift 可以被实现时发现/回流；re-entry 不演化成通用事务系统。

## Phase 9 — Capability Registry v0.1

实现极小 Registry：

- internal/external unified manifest；
- capability/stack/authority/risk/origin/version/license；
- no-suitable-asset；
- invocation trace。

### Exit

Prax 能解释为什么选择/排除某 Skill，Skill 不会覆盖 Product/Design authority。

## Phase 10 — Routed Capability Experiment

比较：generic skill only / Prax only / Prax + routed capability。

### Exit

获得是否值得继续投入 Implementation Intelligence 的 evidence。

## Phase 11 — User/Organization Asset MVP

只做 private/org closed loop：save candidate、scope+maturity、provenance/version、export/import、explicit approval、no public upload by default。

### Exit

用户能把重复经验变成自己的可复用资产。

## Phase 12 — Data/Log Explorer Second Independent Benchmark + Evidence Status Validation

验证：

- Context Primitive 是否跨域；
- Domain Intelligence 是否只增加条件；
- Capability Router 不强迫 Canvas 资产；
- **Minimal Evidence/Representation Status 是否真实需要；**
- provenance/missing/demo/live-stale 等是否需要拆成正交字段；
- 是否产生有价值的 User/Org Asset Candidate。

### Exit

至少两个独立复杂 Case 对核心模型提供 evidence；Evidence Status 只有在此时有真实使用价值才进入 stable schema。

## Phase 13 — Contribution / Registry Prototype

只有 User/Org Asset MVP + cross-case evidence 成立后才做 contribution package、sanitization/license checks、review workflow、approved registry release、community/system distinction。

### Exit

用户资产可以安全地“主动贡献 → 审查 → 反哺”，不会直接污染 Core Runtime。

## Phase 14 — Stabilization Review

统一裁决：stable/experimental/remove/external adapter/internal asset/productization/Principle Registry promotion。

### Exit

完整蓝图经过真实证据收敛，而不是因为 Spec 写得完整就全部实现。

# 38. Test Requirements for P0 and Staged Implementation

## 38.1 Relationship Layers

- legacy Product Relationship parses/migrates；
- new Product source/target must resolve product object IDs；
- ExistingUnderstanding current relationship resolves current object IDs；
- derived frame preserves confirmed current relationships；
- Product Relationship direction/meaning preserved；
- `condition` remains opaque text and is not evaluated；
- SDIR Region Relationship has stable id and region referential validation；
- Product Relationship does not require Region Relationship or visual edge；
- representation ref can point to valid Product Relationship when used；
- simple project can omit advanced fields/mapping；
- no universal graph IR introduced。

## 38.2 Context Manifest

- greenfield/add/modify/visual_polish/defect_fix/rework derivation；
- CanonicalClassification can feed Manifest without being duplicated as competing ontology；
- `required|optional|none` semantics stable；
- unknown remains unresolved；
- no unsupported context capability auto-activation from weak evidence；
- Agent cannot submit Manifest as authority；
- upstream revision change makes Manifest stale/rederive；
- stale Manifest cannot compile context。

## 38.3 Validation Plan

- plan persisted before implementation-ready；
- implementation brief references exact revision/digest；
- validate uses same plan revision absent re-entry；
- re-entry stales old plan and creates auditable new revision；
- `kind` remains deterministic/assistive/empirical；
- profile/facet is separate from kind；
- no duplicate Acceptance artifact required。

## 38.4 Correction Memory

- correction persists across fresh Agent session；
- superseded correction excluded；
- unrelated correction not disclosed；
- relevant regression routed to validate；
- correction cannot fabricate user evidence；
- project correction does not auto-promote to general knowledge；
- H4 protocol can distinguish correction retrieval from stable knowledge retrieval。

## 38.5 Context Compilation

- current task receives relevant Product and Region Relationships；
- unrelated relationships excluded；
- applicable correction included；
- unresolved material fact preserved；
- relevant validation plan revision/checks included；
- classification/manifest selection trace present；
- output deterministic for same authoritative state where required。

## 38.6 Knowledge Evolution / Anti-overfitting

- versioned upstream snapshot is queryable；
- project correction does not enter general routing by default；
- domain candidate not disclosed outside matching scope；
- existing knowledge match prefers refine/evidence path over duplicate creation；
- deprecated/superseded knowledge excluded；
- single benchmark cannot auto-promote general rule；
- Knowledge Absorption Review records `project_local | domain_candidate | general_candidate | no_new_rule`。

## 38.7 Execution Evidence / Benchmark Harness

- Bare and Prax arms both produce common observable evidence；
- benchmark input snapshot immutable；
- exact repo/Prax/knowledge/upstream/capability/agent versions resolvable；
- wall-clock mandatory；token/usage either recorded or `not_observable`；
- compiled-context snapshot matches invocation revision；
- events/decisions monotonic；
- no private CoT field；
- `.prax/` contamination check recorded；
- blinded review bundle contains no arm labels；
- failure attribution supports INCONCLUSIVE；
- first-pass event uses shared Harness definition。

## 38.8 Implementation Supervision

- semantic checkpoint does not trigger on low-level file edit alone；
- design-impacting decision distinguishable from implementation detail；
- drift report references authoritative contract + evidence；
- light lifecycle does not inherit full supervision depth；
- first controlled re-entry only invalidates documented downstream artifacts；
- superseded history auditable。

## 38.9 Capability Registry

- internal/external assets use same capability contract；
- authority prevents skill override；
- scope axis/provider axis resolved via §31；
- risk/stack mismatch can exclude；
- no-suitable-asset valid；
- version/source/license/provenance recorded；
- conflicting assets require deterministic exclusion or explicit decision；
- invocation trace persisted in benchmark mode。

## 38.10 User / Organization Assets

- candidate does not become authority without explicit acceptance；
- project asset does not leak across scope；
- stable maturity does not imply wider scope；
- export/import preserves provenance/version；
- private asset not uploaded by default；
- superseded/deprecated asset excluded；
- unauthorized agent cannot mutate org authority。

## 38.11 Contribution / Security

- contribution package omits secrets/project-only evidence；
- missing/unknown license blocks public promotion when required；
- execution class changes trust/permission；
- network/local-executable capability not treated as instruction-only；
- community popularity cannot auto-promote system authority。

# 39. Required Observability

Prax 本阶段必须让实验和真实项目能够回答三类问题：

1. **Context Why** — 为什么 Agent 得到这些 Context/Knowledge；
2. **Capability Why** — 为什么调用/没有调用这些 Skill/Component；
3. **Outcome Why** — 为什么最终 PASS/REVIEW/BLOCK，失败归因在哪一层。

至少可追踪：

### Context / Knowledge

- selected artifact refs；
- relationship ids；
- correction ids；
- Design Intelligence ids；
- validation ids；
- exclusion reason；
- source session revision。

### Capability

- candidate assets；
- selected asset IDs + versions；
- exclusion reason；
- authority/risk conflict；
- invocation contract；
- changed files/evidence refs where known。

### Implementation

- semantic checkpoint；
- explicit implementation-time decisions；
- drift findings；
- re-entry / invalidation history；
- validation evidence；
- final commit/diff/screenshots；
- first-pass event；
- wall-clock；
- token/model usage where observable, otherwise explicit `not_observable`；
- total tool calls / Prax calls / repair rounds。

### Asset Evolution

- candidate source；
- scope/maturity changes；
- review decision；
- supersedes/deprecates；
- contribution history。

否则 A/B 或用户长期学习只能看到结果，无法判断 Prax 的哪一部分真正产生价值。

# 40. Documentation Source-of-Truth Policy

本阶段应明确不同“真值”的作用域，而不是只设一个总 source of truth：

1. **Runtime code + current ADR** 表示已经落地且审查后的实际 lifecycle behavior；
2. **D1–D9 Design Intelligence research package** 是通用设计知识、证据、taxonomy、Pattern、Rule Schema 与 SDIR 边界的 canonical upstream research assets；
3. **Runtime Knowledge Store** 是上游 Design Intelligence 经 curate / compile 后面向 Agent 的当前可执行子集，不等于全部研究资产；
4. Implementation Spec 必须及时同步，不得长期保留被 ADR amendment supersede 的描述；
5. Mega Prompt / Benchmark Insight 文档属于 architecture and empirical input，不直接覆盖 Runtime contract 或 Stable General Knowledge；
6. Project correction / regression 是 G3 project truth，不因进入 artifact store 而自动成为 Design Intelligence；
7. Benchmark conclusion 必须声明 evidence level；
8. Constitution 只保留足够稳定、跨案例成立的 invariant，不承载实验性 schema 细节；
9. 新 Benchmark 与既有知识冲突时，必须走 Knowledge Absorption / Conflict Review，不允许 recent-result-wins。
10. Capability Registry 描述“可以怎样实现”，不构成 Product Truth 或 Design Authority；
11. Internal/External Skill 的版本、来源和 license 是 implementation reproducibility 的一部分；
12. User/Organization Asset 是独立作用域 authority，不因存在于 Registry 而成为 System truth；
13. Community Registry main/head 不是 Runtime default truth，Runtime 应消费明确的 approved release/version；
14. Execution Evidence 是对某次 run 的事实记录，不自动晋升为通用 Knowledge；
15. Deprecated/Superseded asset 保留历史但不进入默认 routing。
16. **Versioned Upstream Research Snapshot** 是 Knowledge Absorption 的实际查询入口；聊天附件/临时本地文件不能作为唯一 canonical source。
17. Context Manifest 是 derived artifact；其权威来源是 `derived_from` 所指的 current authoritative artifacts，手工编辑不得成为新 source of truth。
18. Persisted Validation Plan revision 是实现阶段的验收权威；re-entry 必须显式产生新 revision，而不是 validate 时静默重算。

---

# 41. Principle Registry Promotion Queue

本节不再复制 candidate 原文。候选原则的唯一文本来源是 §4 Unified Principle Registry。

在 Architecture Canvas 主 A/B、Cross-session Memory Benchmark 和第二独立 Case 后，只评审以下 `candidate` ID 是否晋升为 `constitution`、继续 candidate、降级/删除：

- `PRAX-P-028` Implementation is part of design closure；
- `PRAX-P-029` Prax controls fidelity, not syntax；
- `PRAX-P-030` Execution evidence is first-class；
- `PRAX-P-031` Capabilities do not define product structure；
- `PRAX-P-032` Capability routing is scoped；
- `PRAX-P-033` Scope and maturity are orthogonal；
- `PRAX-P-034` User intelligence remains portable/user-controlled；
- `PRAX-P-035` Contribution is explicit/reviewed；
- `PRAX-P-036` Reproducibility requires versioned inputs；
- `PRAX-P-037` No reusable asset is a valid answer；
- `PRAX-P-038` Local learning proposes before it mutates；
- `PRAX-P-039` External capability trust is explicit；
- `PRAX-P-040` Project truth is scoped。

Promotion 必须引用 Benchmark IDs、Knowledge Absorption Review 和冲突/反例；“文档中已经写了”不是晋升证据。

# 42. Phase-scoped Deliverables

本节是**累计交付目录**，不是“下一次 Coding Agent 一口气交 26 项”。每次只交当前 Phase 与其明确前置项要求的产物，并在 phase report 中说明后续项 `not_started`。

## 42.1 Phase -2 to Phase 0

- baseline commit/CI/test snapshot；
- A/B protocol + static benchmark definition；
- Harness feasibility note；
- cost/first-pass/blind/isolation rules；
- versioned `research/upstream/` snapshot + manifest；
- docs/ADR normalization；
- Unified Principle Registry。

## 42.2 Phase 1 to Phase 5

- relationship three-layer schema + compatibility strategy；
- ExistingUnderstanding current_relationships；
- Context Manifest v0.1 + derived_from/staleness；
- persisted/revision-locked Validation Plan；
- correction/regression artifact；
- minimal context compiler / compiled-context.md / trace；
- unit/lifecycle/service tests；
- updated Architecture Canvas fixtures。

## 42.3 Phase 6 to Phase 7B

- Benchmark Harness evidence schema；
- `prax-lock.yaml`；
- Bare/Prax replicated run packages；
- commit/ref/diff/screenshots/runtime evidence；
- blinded outcome review；
- cost/process metrics；
- failure attribution report；
- Knowledge Absorption Review；
- provisional keep/revise/remove/defer；
- separate `PRAX-MEM-001` cross-session correction benchmark。

## 42.4 Phase 8+ Conditional Deliverables

只在对应 Phase 进入后要求：

- semantic checkpoint / drift report / controlled re-entry；
- Implementation Capability Registry v0.1；
- external capability adapter authority/risk/version manifest；
- internal reusable asset candidate + semantic contract；
- User/Organization Asset MVP；
- Data/Log Explorer second benchmark + Evidence Status decision；
- contribution/security/license review；
- final cross-case stabilization review。

## 42.5 Every Phase Must Report

- current status；
- exact code/doc refs；
- test/CI evidence；
- artifacts produced；
- unresolved questions；
- Keep / Revise / Remove / Defer；
- next phase preconditions；
- explicit list of long-term items **not implemented yet**。

# 43. Decision Gates After the A/B

完成 Architecture Canvas A/B 后，不直接进入“做更多模块”，而进行一次架构裁决。

## Gate A — Did Prax materially change agent behavior?

如果没有：

- 检查 protocol 是否只生成文档而未影响 implementation context；
- 检查 Context Compiler 是否无效；
- 删除低价值 artifact。

## Gate B — Which primitive caused value?

分别分析：

- Relationship；
- Context Manifest；
- Validation-before-code；
- Correction Memory；
- Design Intelligence routing。

避免把整个 Prax Arm 的好坏当成一个黑盒结论。

## Gate C — What new context was still missing?

将缺口分类为：

- project-local fact；
- missing primitive candidate；
- Design Intelligence gap；
- tooling/evidence gap；
- backend capability gap；
- agent implementation bug。

## Gate D — Is a second independent case needed before stabilizing schema?

默认答案：是。

Architecture Canvas 验证通过的 experimental primitive，在 Data/Log Explorer 等第二 Case 中再次出现后，再考虑 stable contract。

## Gate E — Did the Benchmark Change Knowledge at the Correct Scope?

检查：

- 是否把 project correction 错误升级成 general rule；
- 是否已有 D1–D9 / Runtime Knowledge 可以解释该 Finding；
- 是否应优先细化 scope / routing / counterexample；
- 是否存在 recent-case bias；
- 新领域知识是否污染无关 Context Compilation；
- 是否需要第二领域证据才能 generalize。

默认原则：一次 Benchmark 可以产生强 project evidence，但不产生 Stable General Knowledge。

## Gate F — Did implementation drift reveal a supervision need?

检查：

- 问题是否最终 Validation 已经足够捕获；
- 是否真的需要 implementation-time checkpoint；
- 哪个 checkpoint 最小且有价值；
- light flow 是否会因此变重。

## Gate G — Did an implementation capability help or distort?

检查：

- Skill/Component 是否提高 implementation quality；
- 是否覆盖/扭曲 Design Contract；
- 是否需要更严格 authority；
- 是 provider-specific 问题还是 capability type 问题；
- 是否值得建立 internal wrapper/adapter。

## Gate H — Is a repeated implementation worthy of an asset candidate?

必须区分：

- repeated code coincidence；
- project-local recipe；
- user/org reusable asset；
- domain asset candidate；
- system candidate。

## Gate I — Is sharing appropriate?

在进入 Community/System 前检查：

- explicit user opt-in；
- sensitive/project-specific data；
- provenance/license；
- execution security；
- evidence quality；
- scope classification。


---

# 44. Long-term Architecture Direction

```text
                   ┌──────────────────────────────┐
                   │ D1–D9 / Standards / Research │
                   │ Principles / Heuristics / PTN│
                   └──────────────┬───────────────┘
                                  │ curate / review
                                  ▼
                        ┌──────────────────────┐
                        │ Design Intelligence  │
                        │ General + Domain     │
                        └──────────┬───────────┘
                                   │
                            Knowledge Router
                                   │
                                   ▼

Requirement ─────────┐       ┌───────────────────────────┐
Existing Product ────┼──────▶│            PRAX           │◀──── User / Org Assets
Research / Data ─────┤       │                           │
Human Review ────────┘       │ Product Context           │
                             │ Relationships             │
                             │ Decisions / SDIR          │
                             │ Corrections               │
                             │ Validation Obligations    │
                             │ Context Manifest          │
                             └───────────┬───────────────┘
                                         │
                               Context Compiler
                                         │
                         ┌───────────────┼────────────────┐
                         ▼               ▼                ▼
                    Product         Design          Validation
                    Context        Knowledge        Obligations
                         └───────────────┬────────────────┘
                                         ▼
                              Capability Router
                             /        |         \
                            /         |          \
                           ▼          ▼           ▼
                    Internal       External     No Suitable
                    Assets         Skills       Asset / Derive
                       \             |            /
                        \            |           /
                         └────────────┬──────────┘
                                      ▼
                                  Coding Agent
                                      │
                                      ▼
                           Real Implementation Loop
                                      │
                           Semantic Checkpoints
                                      │
                         Execution / Runtime Evidence
                                      │
                               Drift Evaluation
                              /                \
                          continue           re-enter
                              \                /
                               └──────┬────────┘
                                      ▼
                                  Validation
                                  /         \
                               PASS        Finding
                                             │
                              ┌──────────────┴──────────────┐
                              ▼                             ▼
                         Correction                    Asset Candidate
                              │                             │
                              └──────────────┬──────────────┘
                                             ▼
                                Knowledge / Asset Governance
                                /            |             \
                               ▼             ▼              ▼
                           Project        User/Org       Community
                           Memory          Assets        Candidate
                               \             |              /
                                └────────────┼─────────────┘
                                             ▼
                                     Reviewed Registry
                                             │
                                             └──────▶ Future Prax Runs
```

## 44.1 What Prax Owns

- Product-first framing and context；
- scoped design knowledge；
- explicit semantic relationships；
- decision and correction trace；
- capability reconciliation；
- capability selection authority；
- implementation design-fidelity supervision；
- evidence/validation closure；
- asset/knowledge evolution rules。

## 44.2 What Prax Reuses

- external implementation skills；
- component libraries；
- testing/browser tools；
- visualization/graphics implementation expertise；
- project or organization assets。

## 44.3 What Prax Learns

- project corrections；
- repeated implementation recipes；
- asset success/failure contexts；
- domain-specific refinements；
- benchmark evidence。

## 44.4 What Prax Must Never Confuse

```text
Product Truth       ≠ Backend Capability
Design Intelligence ≠ Project Truth
Design Contract     ≠ Implementation Syntax
Capability          ≠ Design Authority
Reuse               ≠ Product Justification
Community Popularity≠ General Truth
Observed Success    ≠ Stable Asset
Project Scope       ≠ General Scope
```

# 45. Final Principle

Prax 的长期目标不是建立最大的 UI 规则库，也不是建立最大的组件库或 Skill Marketplace。

它要解决的是一个更稳定的问题：

> **让 Coding Agent 在面对任何新的产品题材时，都能从经过验证的通用设计底座出发，获得当前领域和项目真正相关的 Context，在实现过程中持续保留设计语义，并把真实结果重新转化为有 scope、有证据、可复用但不过拟合的知识与资产。**

因此完整演化循环是：

```text
Stable Research Foundation
        +
Scoped Domain Knowledge
        +
Project / User Truth
        ↓
Context Compilation
        ↓
Explicit Design Contract
        ↓
Capability Routing
        ↓
Implementation
        ↓
Implementation Supervision
        ↓
Execution Evidence
        ↓
Validation / Human Review
        ↓
Correction / Asset Candidate
        ↓
Governed Promotion
        ↓
Future Project Advantage
```

这套系统必须同时避免四种局部最优：

```text
Backend-driven UI
Component-driven UI
Skill-driven UI
Latest-benchmark-driven Knowledge
```

对应的四条保护原则是：

1. **Product Truth outranks implementation convenience.**
2. **Capabilities serve design contracts; they do not define them.**
3. **Local evidence specializes before it generalizes.**
4. **User and community assets are governed, versioned, portable, and reviewable.**

Prax 的价值最终不应只表现为“第一次生成的 UI 更好”，而应表现为：

- Agent 更早提出正确的产品问题；
- 设计意图更少在实现阶段丢失；
- 外部 Skill 和内部资产被更准确地使用；
- 同类错误越来越少重复；
- 用户和组织长期形成自己的可复用资产；
- 社区优秀经验能够安全反哺系统；
- Prax 在新领域中保持稳定基础，同时可以持续长出新的专科能力。

完整架构可以很大，但实际实现必须始终遵循：

> **smallest useful primitive → real evidence → review → next phase.**

这是防止 Prax 自身成为另一个过度设计系统的最后一道约束。

# Appendix A — Immediate Work Order

下一轮 Coding Agent **不是**一次执行完整 v0.3.1 蓝图。直接顺序：

```text
A0. Read v0.3.1 + current repo + lifecycle ADR + formal review closure
A1. Freeze baseline + A/B protocol + Harness feasibility + cost/first-pass/blind/isolation rules
A2. Vendor/version research upstream snapshot + manifest
A3. Normalize docs + Unified Principle Registry
A4. Relationship three-layer minimal extension + ExistingUnderstanding relationships
A5. Runtime-owned Context Manifest v0.1 + Classification integration
A6. Persist/version-lock Validation Plan before implementation
A7. Correction / Regression Memory
A8. Minimal task-scoped Context Compilation
A9. Minimal cross-arm Execution Evidence Capture
A10. Run Architecture Canvas Bare vs Prax replicated A/B (≥3 runs/arm)
A11. Produce blinded outcome review + attribution + Knowledge Absorption Review
A12. Provisional keep/revise/remove/defer decision
A13. Run separate cross-session Correction Memory experiment

---- Only after evidence ----

B1. Add minimal Implementation Supervision / Drift Check + narrow re-entry
B2. Add Capability Registry v0.1
B3. Integrate a very small internal/external capability set
B4. Run routed capability experiment
B5. Build User/Organization Asset MVP
B6. Run Data/Log Explorer second independent benchmark + decide Evidence Status schema
B7. Final cross-case review of Context/Implementation primitives and stop/revise decisions
B8. Prototype public contribution/registry only if justified
```

每阶段必须更新：current status、test/CI evidence、artifacts、unresolved、Keep/Revise/Remove/Defer、next preconditions。

**A12 的 keep/remove 对跨域 primitive 是 provisional。** 最终“两个独立 Case 都无价值”的 stop decision 只能在 B6/B7 后作出，除非第一 Case 已证明 deterministic harm 或明显违反 Non-goal。

禁止因为长期章节描述 Community Registry、Asset UX、Evidence Status 或 Capability Governance，就在第一次 A/B 前提前实现。

# Appendix B — Inputs and Baseline Notes

本 Spec 基于以下已确认输入编写：

- D1–D9 Design Intelligence 研究交付包：作为 canonical upstream research assets；包括 278 条 Source Registry、29 Universal Principles、31 Heuristics + 9 Myth Quarantine、三正交切面 taxonomy、Pattern Language、Rule Schema / progressive disclosure / conflict resolution、SDIR prior art 与 architecture recommendations。
- `Prax_MegaPrompt_Insights.md`：六类复杂前端案例分析；其关键价值被吸收为 Fidelity Benchmark Seeds、Product Context、Relationship、Validation、Failure Memory 与 Context Compilation 假设；六类不被视为封闭 ontology，也不覆盖 D1–D9 通用研究底座。
- 当前 Prax Constitution v0：Product-first、Backend nouns subordinate、scoped knowledge、semantic SDIR、explicit capability gaps、evidence distinction、cross-agent resume、high floor/soft ceiling、mode-differentiated lifecycle 等原则继续保持。
- 当前 runtime lifecycle policy：greenfield / existing_product(add_surface, modify_surface, visual_polish, defect_fix) / rework 使用不同 lifecycle depth。
- 当前 ProductFrame：已有 `product_objects` 与对象层 `relationships(source,target,type)`；当前 SDIR 另有 region-level relationships，二者属于不同语义层，v0.3.1 明确分离。
- 当前 ExistingUnderstanding 尚无 relationship 字段，existing/modify 路径需要新增可选 `current_relationships` 并保留 evidence refs。
- 当前 SDIR Engine 主要从 pattern 骨架生成 region relationship，不能假设它已经消费 ProductFrame relationships。
- 当前 CanonicalClassification 是 bounded routing signal；v0.3.1 规定它作为 Context Manifest 的输入之一，而不是与 Manifest 平行竞争。
- 当前 prepare 阶段可计算 Validation Plan，但 plan 本身尚未作为独立 revision-locked artifact 贯穿 prepare→validate；Phase 3 专门补该缺口。
- 当前 Architecture Canvas Golden Case：已有 artifact-level A/B rubric 和一次 Inspector hierarchy correction，但尚缺真实 implementation / browser / user evidence。

- 本 v0.3 进一步吸收后续讨论：Prax 对设计意图的责任延续到真实实现；Benchmark 必须留下可复盘 Execution Evidence；内部/外部实现 Skill 应进入统一 Capability Registry；Prax 可以积累自己的 Skill/Component/Primitive；用户和组织也应拥有同等的资产积累能力，并可在明确 opt-in、license/security review 和 evidence review 后贡献给 Community/System。
- 本文对 Implementation Intelligence、Asset Layer、Community Registry 描述的是完整目标架构。当前 P0 仍以 Architecture Canvas 真 A/B 所需的最小能力为准；Registry/Community/Product UX 等属于后续阶段，不得被 Coding Agent 解释为当前一次性开发范围。

# Appendix C — Formal Review Resolution Matrix

本表记录 v0.3 Formal Review 的处置结果，防止未来实现者重新打开已裁决问题或误以为某项被遗漏。

## A — Required Before Execution

| Review | Decision in v0.3.1 | Primary Location |
|---|---|---|
| A1 Relationship 双层混淆 | **Accepted + refined**：改为 Product Relationship / SDIR Region Relationship / Implementation Representation 三层；跨层 mapping optional + typed；ExistingUnderstanding 增 `current_relationships` | §6, Phase 1 |
| A2 Manifest vs CanonicalClassification | **Accepted**：Classification 是 bounded routing signal，Manifest 是 broader derived profile，前者为后者输入之一 | §5.3, §7 |
| A3 Validation 分类矛盾 | **Accepted**：`kind` 仅 deterministic/assistive/empirical；semantic/behavioral 等改为 facet/profile | §8.3–8.4 |
| A4 H4 单任务不可检验 | **Accepted**：拆为独立双任务、跨新会话 `PRAX-MEM-001` | §14 H4, Phase 7B |
| A5 Evidence Status 无阶段 | **Accepted**：概念保留，实施推迟到 Data/Log Explorer Phase 12 | §10, Phase 12 |
| A6 上游研究不可查询/无版本 | **Accepted**：建立 repo-local `research/upstream/` snapshot/digest + manifest/hash/release | §20.2, Phase -1 |
| A7 单次 A/B 与“显著”不匹配 | **Accepted**：≥3 independent runs/arm；证据分级；禁止统计显著措辞 | §13.3, §16–17 |

## B — Internal Consistency

| Review | Decision in v0.3.1 | Primary Location |
|---|---|---|
| B1 两套 Benchmark 目录 | **Accepted**：`benchmarks/` 只存静态定义，`benchmark-runs/` 存每次 evidence；§24.3 为 run schema 唯一来源 | §18, §24.3 |
| B2 Validation profile 命名漂移 | **Accepted**：profile/check/rubric 使用不同 typed fields/identifier spaces | §5.2.G, §8 |
| B3 Constitution/INV/CAND 重复 | **Accepted**：统一 `Principle Registry` + status | §4, §41 |
| B4 module 残留与 capability 值域 | **Accepted**：统一 `context_capability`；明确 `required|optional|none` | §7.2, §38.2 |
| B5 scope vs provider 优先级 | **Accepted**：明确是两条正交轴，先 authority，再 scope/evidence/risk | §28.5, §31 |
| B6 condition 语义未定 | **Accepted**：P0 为 opaque annotation，不实现表达式引擎 | §6.2 |
| B7 Evidence Status 词表不对称 | **Accepted**：Phase-12 candidate 加 measured/verified/live 等，并规定 unknown/value 边界 | §10.2 |
| B8 Manifest 权威/失效 | **Accepted**：Runtime-only derived artifact，保存 derived_from，stale/rederive | §7.4 |
| B9 A11 与第二 Case 时序冲突 | **Accepted**：第一次 keep/remove 仅 provisional，最终 cross-case stop 在 B6/B7 | §17.3, Appendix A |

## C — Experiment and Execution Risk

| Review | Decision in v0.3.1 | Primary Location |
|---|---|---|
| C1 Bare evidence 不在 Prax 控制 | **Accepted**：Benchmark Harness 位于两臂上方；Phase -2 先验证 capture feasibility | §13.6, Phase -2/6 |
| C2 盲评不具体 | **Accepted**：anonymize、randomize、outcome-first、可选独立 reviewer | §13.8 |
| C3 `.prax/` 泄漏 | **Accepted**：clean worktree + contamination check + review bundle stripping | §13.7 |
| C4 成本指标非强制 | **Accepted**：wall-clock 必报；usage/token 可观测则报，否则 `not_observable`；tool/Prax/repair rounds 必报 | §13.2, §17.2, §24.4, §39 |
| C5 first pass 未定义 | **Accepted**：用 Harness 的 first ready-for-full-evaluation checkpoint 统一定义 | §15.2.1 |
| C6 Reasoning Failure 与无 CoT 冲突 | **Accepted**：只有显式决策证据才归 #4，否则 INCONCLUSIVE/可证上游类别 | §16.4, §24.6 |
| C7 Controlled re-entry 与代码差距大 | **Accepted**：Phase 8 首版只允许真实 evidence 驱动的 narrow re-enter-to-decide；更早 gate 先 REVIEW | §23.3, Phase 8 |
| C8 hardcoded component contract baseline | **Accepted**：预登记 known limitation，失败优先做 capability/asset mismatch 归因，不提前扩大 scope | §13.10 |

**Closure rule**：若后续实现发现代码事实与本矩阵不符，应先更新 baseline/ADR 并重新评审受影响条目，不允许 Coding Agent 默默选择另一种解释。

