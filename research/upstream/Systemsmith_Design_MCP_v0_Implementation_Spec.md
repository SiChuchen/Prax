# Systemsmith Design MCP v0 Implementation Spec

> **Status:** Draft for implementation review  
> **Version:** v0.1  
> **Date:** 2026-08-25  
> **Project:** Systemsmith Design Intelligence / Systemsmith Design MCP  
> **Primary consumer:** AI Coding / Design Agents  
> **Implementation target:** MCP Server, local-first, TypeScript  
> **Normative language:** MUST / MUST NOT / SHOULD / MAY are requirement levels for v0.

---

# 0. Executive Summary

Systemsmith Design MCP v0 is not a UI generator, not a component library, and not a UI/UX encyclopedia.

It is a **Design Engineering Runtime for Agents** whose primary purpose is to raise the minimum quality of UI/UX and frontend work by changing the Agent's decision process:

```text
Backend / Feature Driven
        ↓
        ✗

Product / User / Task Driven
        ↓
Design Context
        ↓
Design Routing
        ↓
Progressive Knowledge Disclosure
        ↓
Pattern / Principle Selection
        ↓
Explicit Design Decisions
        ↓
SDIR
        ↓
Capability Reconciliation
        ↓
Implementation
        ↓
Validation
        ↓
Evidence
```

The v0 system MUST make it difficult for an Agent to jump directly from a backend feature list, API schema, database schema, or existing component tree into page implementation.

The runtime MUST instead require the Agent to establish the product framing and user task first, then progressively disclose only the design knowledge relevant to the current decision.

The core design philosophy is:

> **High floor, soft ceiling.**

Systemsmith Design MCP should strongly prevent low-quality, structurally weak, inconsistent UI while retaining room for context-sensitive design judgment above that floor.

---

# 1. Why This Exists

## 1.1 Repeated failure mode

The recurring failure in prior frontend work is not primarily inability to write CSS or React/Vue code.

The typical sequence is:

```text
Backend capabilities
→ APIs / fields / database entities
→ feature list
→ place each feature somewhere
→ table / form / card
→ implement
→ visually adjust after the fact
```

This produces functionally complete but product-weak interfaces:

- information hierarchy is unclear;
- page structure mirrors backend boundaries rather than user mental models;
- Cards become default grouping mechanisms;
- navigation, toolbar, inspector and content compete for attention;
- professional high-density views are "simplified" into low-efficiency spacious layouts;
- backend constraints silently dictate UX;
- different Agents produce incompatible interaction patterns;
- implementation starts before the user task is understood;
- visual review becomes repeated subjective patching.

The intended sequence is instead:

```text
User
→ Goal
→ Task
→ Product Objects
→ Mental Model
→ Information Architecture
→ Interaction Pattern
→ Design Decisions
→ UI
↕
Backend Capabilities
```

## 1.2 Core product thesis

A frontend is not a visualization skin over a backend.

> **Frontend is the Product Interaction Layer.**

Backend capabilities constrain implementation, but they do not automatically define product concepts, navigation structure, task flow, or information hierarchy.

## 1.3 What "high floor" means

v0 is successful if it systematically reduces low-level design failures such as:

- architecture derived directly from API/database structure;
- missing primary task;
- missing page hierarchy;
- Card Everything;
- unexplained density;
- auxiliary UI overpowering the primary workspace;
- inconsistent states and terminology;
- hidden important actions without justification;
- unsupported custom interaction patterns;
- implementation diverging from stated design intent;
- missing loading / empty / error / selected states;
- Agent self-review consisting only of "looks clean/modern".

The v0 goal is not to guarantee world-class design.

The goal is:

> **Any Agent that follows the runtime protocol should have difficulty producing obviously low-quality UI.**

---

# 2. Research Basis and Decision Provenance

The architecture draws from the project's completed UI/UX foundation research.

Research-derived foundations include:

- semantic domain vs render domain separation;
- universal Principle vs Heuristic vs Platform Convention separation;
- Pattern as `problem + context + forces + solution + tradeoffs`, not as component;
- SDIR as a semantic design decision record / reasoning scaffold rather than render IR;
- progressive disclosure and metadata-driven knowledge retrieval;
- deterministic vs assistive vs empirical validation boundaries;
- explicit provenance and lifecycle metadata;
- platform-specific conventions kept below universal semantic intent;
- real user outcome evidence remaining distinct from Agent self-evaluation.

The following are **project decisions frozen through the design discussion**, not claims that the research itself mandates them:

- Product-First Gate as the first design gate;
- backend-as-constraint, not product-model rule;
- Design Router as a runtime component;
- knowledge disclosure gated by current decision phase;
- MCP Tools as the primary Agent-facing interface;
- knowledge not directly enumerable by Agents in v0;
- explicit `design_session_id` application state;
- local filesystem artifact persistence in v0;
- strong Systemsmith defaults for professional tools;
- Architecture Canvas as the first vertical-slice benchmark.

The following remain **v0 experimental choices** and MUST remain easy to change:

- exact MCP tool names;
- exact number of initial Principles / Heuristics / Patterns;
- routing caps;
- exact SDIR vocabulary;
- exact directory layout;
- exact validation rubric structure;
- exact confidence thresholds.

---

# 3. Core Invariants

These requirements are the highest-level implementation constraints.

## INV-001 — PRODUCT FIRST

The Agent MUST resolve:

- target user;
- user goal;
- primary task;
- product objects;
- relevant task flow / relationships;

before it is allowed to derive UI architecture.

The Agent MUST NOT derive page architecture directly from:

- database tables;
- API endpoints;
- backend modules;
- service boundaries;
- repository directory layout;
- existing component structure.

## INV-002 — BACKEND IS A CONSTRAINT, NOT THE PRODUCT MODEL

Backend capabilities MAY constrain implementation.

They MUST NOT automatically define:

- user-facing object taxonomy;
- navigation hierarchy;
- layout archetype;
- task model;
- information priority.

If the product need and backend capability conflict, the runtime MUST expose a capability gap rather than silently degrading UX.

## INV-003 — PROGRESSIVE DISCLOSURE BY DEFAULT

The Agent MUST NOT receive the full Design Intelligence knowledge base by default.

Knowledge MUST be disclosed progressively, based on:

- current design phase;
- resolved Design Context;
- current decision;
- applicable scope;
- explicit Agent request for deeper evidence.

## INV-004 — CLASSIFY BEFORE RETRIEVE

The Agent MUST classify the current design problem before substantive knowledge retrieval.

The runtime MUST route by context rather than expose a general-purpose "search all design knowledge" tool.

## INV-005 — DECISION BEFORE IMPLEMENTATION

No implementation-ready handoff is valid until:

- Product Frame is accepted;
- Design Context is accepted;
- relevant Patterns / Principles have been considered;
- Design Decisions are recorded;
- SDIR is valid;
- capability reconciliation has run.

## INV-006 — REUSE BEFORE INVENTION

If a stable Pattern or semantic contract exists and applies, the Agent SHOULD use it.

New Patterns / contracts MUST NOT be created silently.

A new abstraction MUST enter an explicit proposal path.

## INV-007 — ACCESSIBILITY / SAFETY ARE NON-COMPENSATORY

Lower-level visual preferences MUST NOT override accessibility or safety requirements.

## INV-008 — PRIMARY CONTENT / TASK DOMINANCE

Supporting chrome, navigation, inspectors, decorative surfaces and status UI MUST NOT visually dominate the user's primary task surface unless the current task explicitly makes them primary.

## INV-009 — STRUCTURED DENSITY

Professional tools MAY be dense.

Density MUST be made legible through hierarchy, grouping, alignment, typography, rhythm and restrained semantic color.

Whitespace or large surfaces MUST NOT be treated as universally preferable to high information density.

## INV-010 — SDIR IS SEMANTIC

SDIR MUST encode design intent and semantic relationships.

SDIR MUST NOT encode implementation-specific rendering details such as:

- CSS layout;
- pixel/dp dimensions;
- framework component names;
- raw colors;
- concrete grid/flex configuration;
- platform API calls.

Spatial semantics MAY exist when they are themselves part of the design meaning, e.g. `spatial_overview`, `hierarchical_flow`, `dominant_workspace`.

## INV-011 — VALIDATION IS PART OF COMPLETION

Frontend work is not complete because it compiles or renders.

The runtime MUST require validation evidence appropriate to the page context.

## INV-012 — NO UNJUSTIFIED DESIGN ASSERTIONS

The Agent MUST NOT treat statements such as:

- "this looks modern";
- "this is cleaner";
- "this feels premium";

as validation evidence.

Design judgments MUST be expressed as:

- deterministic rule results;
- scoped heuristic findings;
- semantic conformance findings;
- explicit human review;
- or product/user evidence.

## INV-013 — EXPLICIT APPLICATION STATE

MCP protocol state MUST NOT be relied upon as the source of design workflow state.

The Design Runtime MUST use an explicit `design_session_id` and persistent artifacts.

## INV-014 — KNOWLEDGE MUST BE EARNED THROUGH A GATE

> The Agent does not receive substantive design knowledge until the current decision gate establishes that the knowledge is relevant.

This is a runtime invariant, not merely a prompt guideline.

---

# 4. Non-Goals for v0

v0 MUST NOT become:

- a general RAG service for UI/UX literature;
- a complete visual design system;
- a Figma replacement;
- a deterministic UI compiler;
- a universal cross-platform code generator;
- a design Knowledge Graph platform;
- a database-backed knowledge management product;
- a web administration console;
- an autonomous user-research simulator;
- a replacement for real usability testing;
- a multi-tenant remote SaaS;
- a weighted expert-system rules engine;
- a full React/Vue/Compose/Flutter adapter suite;
- a giant MCP server exposing dozens of low-level design tools.

Deferred work is explicitly listed in Section 27.

---

# 5. Runtime Architecture

```text
                       Coding / Design Agent
                                │
                         tiny bootstrap skill
                                │
                                ▼
                    Systemsmith Design Skill
                 (protocol + tool usage only)
                                │
                                ▼
                         MCP Tool Surface
                                │
               ┌────────────────┴────────────────┐
               │ Systemsmith Design Runtime      │
               │                                 │
               │  Workflow / Gate Engine         │
               │          │                      │
               │  Product Framing                │
               │          │                      │
               │  Design Context Builder         │
               │          │                      │
               │  Design Router                  │
               │          │                      │
               │  Progressive Disclosure         │
               │          │                      │
               │  Decision Validator             │
               │          │                      │
               │  SDIR Engine                    │
               │          │                      │
               │  Capability Reconciliation      │
               │          │                      │
               │  Validation Runtime             │
               └──────┬────────┬────────┬────────┘
                      │        │        │
                      ▼        ▼        ▼
                 Knowledge  Patterns  Profiles
                      │                 │
                      └────────┬────────┘
                               ▼
                          Artifacts
```

## 5.1 Internal planes

### Semantic plane

Contains:

- Product Frame;
- Design Context;
- Principles;
- Heuristics;
- Patterns;
- Design Decisions;
- SDIR.

### Render / implementation plane

Contains:

- platform conventions;
- runtime-specific adapter guidance;
- tokens;
- approved components;
- implementation constraints.

### Validation plane

Cross-cuts both semantic and implementation planes.

### Meta-knowledge plane

Contains:

- provenance;
- lifecycle;
- scope;
- conflicts;
- disclosure depth;
- routing records;
- decision records.

---

# 6. MCP Technical Baseline

## 6.1 Protocol baseline

At implementation start, v0 SHOULD target the official MCP `2026-07-28` specification and the stable TypeScript SDK v2 line.

The 2026-07-28 MCP core is stateless. Therefore:

- Design workflow state belongs to the application runtime;
- every stateful design operation MUST reference a `design_session_id`;
- runtime behavior MUST NOT depend on a specific persistent MCP transport connection.

## 6.2 Language and transport

v0 baseline:

```text
Language: TypeScript
Runtime: Node.js
MCP SDK: official TypeScript SDK v2
Primary transport: stdio
Remote HTTP: deferred
Database: none
Network dependency: none by default
```

## 6.3 MCP surface policy

v0 SHOULD expose **Tools only** as the normal Agent-facing surface.

The knowledge base MUST NOT be exposed as a freely enumerable MCP Resource catalog in v0.

Reason:

```text
resources/list → full knowledge discovery
```

would allow an Agent to bypass Progressive Disclosure.

If MCP Resources are added later, they MUST preserve the same authorization / disclosure gates as Tool-based access.

Prompts are not required for v0 because the bootstrap Skill carries the small protocol instructions.

---

# 7. Design Session Model

## 7.1 Explicit session handle

Every design workflow starts with:

```yaml
design_session_id: ds_<stable-id>
```

A design session is an application object persisted independently of the MCP connection.

## 7.2 Session phases

```text
NEW
 ↓
PRODUCT_FRAMING
 ↓
CONTEXT
 ↓
ROUTING
 ↓
DECISION
 ↓
SDIR
 ↓
CAPABILITY_RECONCILIATION
 ↓
IMPLEMENTATION_READY
 ↓
VALIDATION
 ↓
COMPLETE
```

Optional terminal / side states:

```text
REVIEW_REQUIRED
BLOCKED
ABANDONED
```

## 7.3 Universal gate outcomes

All gates MUST return one of:

| Status | Meaning |
|---|---|
| `PASS` | gate satisfied; advance allowed |
| `EXPAND` | more context / knowledge required |
| `RETRY` | submitted artifact is invalid or inconsistent |
| `WARN` | advance allowed with explicitly recorded risk |
| `REVIEW` | human / higher-level design review required |
| `BLOCK` | advance prohibited |

Tool-specific invented status vocabularies are prohibited.

## 7.4 Session record

```yaml
design_session:
  id: ds_001
  project_id: optional
  mode: existing_product
  phase: CONTEXT
  created_at: ...
  updated_at: ...

  requirement_ref: requirement.md

  completed_gates:
    - product_framing

  current_gate:
    name: context

  disclosures:
    - knowledge_id: P-19
      depth: L1
      trigger: product_model_alignment

  artifacts:
    product_frame: product-frame.yaml
    design_context: design-context.yaml

  unresolved:
    - cross_resource_comparison_frequency
```

## 7.5 Cross-Agent handoff

A second Agent MUST be able to continue the design session using:

- `design_session_id`;
- persisted design artifacts;
- routing / decision history.

Full chat transcript replay MUST NOT be required.

---

# 8. Product Framing Protocol

Product Framing is Gate 1.

It exists specifically to prevent Backend-Driven UI.

## 8.1 Required outputs

```yaml
product_frame:
  user:
    primary_role: ...
    expertise: novice | intermediate | expert | mixed
    familiarity: low | medium | high | unknown

  goal:
    primary: ...

  tasks:
    primary: ...
    secondary: []

  product_objects:
    - id: ...
      user_name: ...
      purpose: ...

  relationships:
    - source: ...
      target: ...
      type: ...

  mental_model_hypothesis:
    summary: ...
    confidence: high | medium | low
    evidence:
      - user_requirement
      - existing_product
      - domain_convention

  primary_success_definition:
    ...

  open_questions: []
```

## 8.2 Product objects vs system objects

The Agent MUST distinguish:

```text
Product Object
≠
Database Entity
≠
API Resource
≠
Backend Service
```

A backend resource MAY map 1:1 to a Product Object, but that mapping must be justified.

## 8.3 Backend Quarantine Rule

Before Product Framing is accepted:

The Agent MAY inspect:

- user requirement;
- current UI;
- product documentation;
- user-visible behavior;
- prior product decisions.

The Agent SHOULD NOT use detailed backend/API/database structure to derive the Product Model.

In an existing product, limited backend inspection MAY occur for orientation, but backend terms MUST be quarantined from Product Model decisions unless corroborated by user/domain evidence.

## 8.4 Existing product mode

For `existing_product`, Product Framing MUST also record:

```yaml
existing_product:
  stable_user_concepts: []
  stable_patterns: []
  current_user_pain_points: []
  current_constraints: []
  legacy_debt: []
```

Existing conventions SHOULD be preserved when:

- users already rely on them;
- they do not violate hard constraints;
- they remain suitable for the current task.

Existing implementation MUST NOT be treated as automatically correct.

---

# 9. Design Context Protocol

Product Frame describes the product/user meaning.

Design Context describes the decision environment for this specific UI.

## 9.1 v0 schema

```yaml
design_context:
  id: ...

  user:
    expertise: expert
    familiarity: high

  task:
    primary: inspect_architecture
    modes:
      - explore
      - trace_relationship
      - inspect_entity
    frequency: high

  domain:
    type: developer_tool
    entities:
      - architecture_node
      - edge
      - flow

  information:
    volume: high
    relationship_complexity: high
    change_rate: medium
    comparison_need: medium

  platform:
    family: web
    form_factor: desktop
    input:
      - pointer
      - keyboard
    viewport: large

  risk:
    destructive_actions: low
    error_cost: medium

  priorities:
    - comprehension
    - scanning_efficiency
    - context_preservation
    - readability

  density_intent: compact

  confidence:
    overall: high

  unknowns: []
```

## 9.2 Context completeness gate

Context is not complete merely because every field exists.

The runtime SHOULD request `EXPAND` when a missing context property can materially change:

- pattern selection;
- information architecture;
- interaction model;
- density;
- destructive-action policy;
- platform presentation.

## 9.3 Unknown is valid

The system MUST support `unknown`.

The Agent MUST NOT invent user research or product evidence to fill missing fields.

---

# 10. Design Router

The Router decides what the Agent is allowed to inspect next.

It is not a generic semantic search engine.

## 10.1 Router inputs

- Product Frame;
- Design Context;
- current phase;
- unresolved design question;
- previously disclosed knowledge;
- stable Systemsmith Constitution.

## 10.2 Router output

The Router returns candidate **indexes**, not full bodies.

Example:

```yaml
route_result:
  phase: DECISION
  question: choose_primary_page_pattern

  candidate_domains:
    - information_architecture
    - resource_management
    - settings

  principles:
    - id: P-19
      label: System Image Shapes the Conceptual Model
      why_selected: product object hierarchy must not mirror backend structure

  heuristics:
    - id: H-06
      label: Recognition over Recall
      why_selected: repeated configuration task

  patterns:
    - id: PAT-LIST-DETAIL
      why_selected: homogeneous resources + frequent switching
    - id: PAT-SETTINGS-SECTIONS
      why_selected: configuration-heavy detail surface

  excluded:
    - id: PAT-DASHBOARD
      reason: primary task is management, not monitoring

  platform_profile:
    - WEB-DESKTOP

  confidence: high
  next_action: inspect_candidates
```

## 10.3 v0 routing algorithm

v0 MUST remain simple.

No Knowledge Graph or vector DB is required.

Suggested sequence:

1. phase filter;
2. hard scope filter;
3. task / domain / platform trigger matching;
4. exact scope before generic scope;
5. stable lifecycle before experimental;
6. return capped candidates;
7. record why selected.

## 10.4 Candidate caps

Default caps SHOULD be small:

```text
Principles: max 5
Heuristics: max 5
Patterns: max 3
Platform Profiles: max 1 primary profile
```

If confidence is low, return `EXPAND` rather than silently adding large amounts of knowledge.

## 10.5 Routing audit

Every selected item MUST have:

```yaml
selected_because:
trigger:
scope_match:
confidence:
```

Important excluded candidates SHOULD record `reason`.

This data is required to tune the system later.

---

# 11. Progressive Knowledge Disclosure Protocol

Progressive disclosure is a runtime behavior.

It MUST NOT be implemented only as a long Markdown document and a prompt saying "read what you need".

## 11.1 Disclosure levels

### L0 — Index

Always lightweight.

Contains:

```yaml
id:
type:
name:
one_line_use:
triggers:
scope:
lifecycle:
```

Purpose:

> "Could this be relevant?"

### L1 — Decision

Loaded when the candidate appears relevant.

Contains:

```yaml
statement:
applies_when:
does_not_apply_when:
priority_class:
known_exceptions:
```

Purpose:

> "Should I use it here?"

### L2 — Reasoning

Loaded only for actual decision work, comparison, or conflict.

Contains:

```yaml
rationale:
forces:
tradeoffs:
examples:
counterexamples:
related:
conflicts:
```

Purpose:

> "Why is this the right choice and what does it cost?"

### L3 — Evidence

Loaded for dispute, deep review, source verification, or rule evolution.

Contains:

```yaml
evidence:
source_refs:
confidence:
version:
research_notes:
validation_history:
```

Purpose:

> "What evidence supports this and how strong is it?"

## 11.2 Default disclosure behavior

Most normal design flows SHOULD stay in L0/L1.

L2 is expected when selecting / rejecting major Patterns.

L3 is exceptional.

## 11.3 Disclosure authorization

An Agent MAY request a deeper level only for:

- a candidate returned by Router;
- a rule directly related to an unresolved conflict;
- a source explicitly required during review.

The runtime MUST reject unrestricted "dump all evidence" requests in normal mode.

## 11.4 No direct knowledge enumeration

v0 MUST NOT provide:

```text
list_all_principles
list_all_heuristics
list_all_patterns
search_everything
```

as normal Agent tools.

Administration / research tooling can be built separately later.

---

# 12. Knowledge Contract

## 12.1 Knowledge types

v0 supports:

- `principle`
- `heuristic`
- `pattern`
- `platform_convention`
- `myth`
- `product_evidence`

## 12.2 Common metadata

```yaml
id:
type:
name:
summary:

scope:
  user_type: []
  task_type: []
  domain: []
  platform: []
  density: []

triggers: []

lifecycle:
  status: draft | reviewed | stable | deprecated
  version:
  owner:
  review_by:

provenance:
  source_refs: []
  confidence:

validation:
  mode: deterministic | assistive | empirical
```

## 12.3 Evidence dimensions MUST remain orthogonal

v0 SHOULD NOT rely on a single linear `N > A > B > C` authority score.

Where needed, represent separately:

```yaml
source:
  type: peer_reviewed_paper

authority:
  category: academic

evidence:
  certainty: high

scope:
  applicability: universal

recommendation:
  strength: moderate
```

This avoids mixing source class, evidence certainty, scope and recommendation strength.

## 12.4 Myth quarantine

Known myths / overgeneralizations MUST be stored separately and MUST NOT participate in normal positive recommendations.

They MAY be surfaced when an Agent or user invokes the myth as a design claim.

---

# 13. Pattern Selection Protocol

Patterns are not page templates and not component bundles.

## 13.1 Required Pattern contract

```yaml
pattern:
  id:
  name:
  aliases: []

  problem:
  context:
  forces: []
  solution:
  tradeoffs: []
  consequences: []

  applies_when: []
  does_not_apply_when: []

  related_patterns:
    composed_of: []
    complements: []
    alternatives: []

  anti_patterns: []

  evidence: []
  lifecycle:
```

## 13.2 Pattern comparison requirement

For major page architecture selection, the Agent MUST:

- name the chosen primary Pattern;
- state why it applies;
- identify at least one plausible alternative when available;
- state why the alternative was rejected.

Example:

```yaml
pattern_decision:
  chosen: PAT-LIST-DETAIL
  reasons:
    - multiple homogeneous resources
    - frequent cross-resource switching
    - detail information exceeds row capacity

  rejected:
    PAT-DASHBOARD:
      reason: primary task is management, not monitoring
    PAT-WIZARD:
      reason: repeated operational task, not one-shot onboarding
```

## 13.3 New Pattern proposal

If no stable Pattern applies:

```text
search alternatives
→ inspect tradeoffs
→ still unsuitable
→ explicit pattern proposal
→ experimental
→ repeated validation
→ candidate/stable
```

The Agent MUST NOT silently invent a new reusable Pattern during feature implementation.

---

# 14. Design Decision Contract

The Design Decision artifact is the bridge between knowledge and SDIR.

It records what the Agent chose, not hidden chain-of-thought.

## 14.1 Required structure

```yaml
design_decisions:
  session_id: ds_001

  primary_structure:
    pattern: PAT-CANVAS-WORKSPACE
    rationale:
      - architecture is the primary object of inspection
      - supporting controls must remain subordinate

  information_hierarchy:
    primary:
      - architecture
    secondary:
      - navigation
      - contextual_inspector

  density:
    intent: compact
    strategy:
      - grouping
      - alignment
      - typography
      - subtle_dividers
    avoid:
      - card_per_entity
      - decorative_surfaces

  major_choices:
    - id: inspector_behavior
      choice: selection_driven
      rationale: preserve workspace context while exposing contextual detail

  rejected:
    - option: dashboard_card_layout
      reason: architecture exploration is not dashboard consumption

  unresolved: []
```

## 14.2 Decision validation

The runtime checks:

- consistency with Product Frame;
- consistency with Design Context;
- Pattern applicability;
- hard invariant violations;
- unresolved high-impact unknowns;
- explicit rationale for major deviations from defaults.

## 14.3 Decision confidence

Major decisions SHOULD carry:

```yaml
confidence: high | medium | low
```

Low-confidence major decisions trigger `EXPAND` or `REVIEW`.

---

# 15. SDIR v0 Contract

## 15.1 Purpose

SDIR records:

> what the interface means and what it commits to,

not how it is rendered.

## 15.2 v0 schema

```yaml
sdir:
  version: "0.1"

  screen:
    id:
    intent:
      primary_task:
      secondary_tasks: []

    archetype:
      pattern_ref:

    density_intent: compact | regular | spacious

    regions:
      - id:
        role:
        importance: dominant | primary | supporting | contextual
        visibility:
          condition: always | selection_driven | permission_driven | task_driven
        behavior_intent: []

    relationships:
      - source:
        target:
        type:

    interaction_intents: []

    required_states:
      - loading
      - empty
      - ready
      - error

    decision_points:
      - id:
        question:
        adapter_may_choose: []
```

## 15.3 Allowed semantic examples

```text
dominant_workspace
contextual_inspector
primary_navigation
hierarchical_flow
spatial_overview
comparison_group
selection_driven
direct_selection
pan_zoom
progressive_inspection
```

## 15.4 Forbidden implementation examples

```text
width: 320px
padding: 16px
display: flex
grid-template-columns
blue-500
rounded-xl
RadixDialog
VueComponentName
ComposeModifier
```

## 15.5 SDIR boundary test

A field is acceptable when:

> changing framework / platform presentation does not destroy the design meaning encoded by the field.

A field is unacceptable when it merely rephrases a concrete rendering mechanism.

## 15.6 SDIR lint

v0 MUST implement schema lint that rejects known render-level keys / namespaces.

---

# 16. Capability Reconciliation

Capability Reconciliation occurs after SDIR and before Implementation Ready.

## 16.1 Purpose

Compare:

```text
Product / UX Need
        ↕
Existing Technical Capability
```

## 16.2 Required mapping

```yaml
capability_reconciliation:
  needs:
    - id: validate_provider
      product_action: validate a model provider and understand failure
      required_experience:
        - explicit progress
        - meaningful error
        - discovered models visible in context

      capabilities:
        - POST /provider/test
        - GET /models

      status: supported | composable | gap | blocked

      resolution:
        type: frontend_composition | bff | backend_change | explicit_compromise
        notes:
```

## 16.3 No silent UX downgrade

When a gap exists, the Agent MUST NOT simply reshape the UI to match the backend.

It MUST record one of:

- frontend composition;
- BFF / aggregation;
- backend capability change;
- explicit compromise with reason.

## 16.4 Implementation may expose backend limitations

The runtime does not require every UX ideal to trigger backend changes.

It requires that the trade-off be **explicit rather than accidental**.

---

# 17. Platform / Implementation Handoff

The MCP does not need to generate product code itself.

Its job is to make the Agent implementation-ready.

## 17.1 Implementation-ready packet

When all prior gates pass:

```yaml
implementation_brief:
  platform_profile: WEB-DESKTOP
  framework: react

  sdir_ref: screen.sdir.yaml
  decision_ref: design-decisions.yaml

  approved_patterns:
    - PAT-LIST-DETAIL

  approved_component_contracts:
    - RESOURCE-LIST
    - DETAIL-VIEW
    - VALIDATION-FEEDBACK

  states_required:
    - loading
    - empty
    - ready
    - error

  capability_gaps: []

  validation_requirements:
    - semantic_conformance
    - keyboard
    - hierarchy_review
```

## 17.2 Adapter responsibility

Platform/runtime adapters MAY decide concrete realization details.

They MUST preserve SDIR semantic commitments.

## 17.3 v0 adapter scope

v0 only requires:

```text
Web
Desktop
Pointer + keyboard
React-oriented implementation guidance
```

Vue / Compose / Flutter are deferred.

The semantic contracts MUST nevertheless avoid React-specific vocabulary.

---

# 18. Validation Runtime

Validation is context-routed, just like knowledge.

The runtime SHOULD NOT run the same review packet for every UI.

## 18.1 V1 — Deterministic

Examples:

- artifact schema;
- required state coverage;
- SDIR forbidden keys;
- unknown Pattern / contract references;
- lifecycle/deprecated reference;
- token policy when token metadata is available;
- explicit confirmation/recovery requirement for marked destructive actions.

Outputs can `BLOCK`.

## 18.2 V2 — Semantic Conformance

Questions include:

- does implementation preserve the primary task?
- is the dominant region actually treated as primary?
- are contextual regions conditionally presented?
- are required interactions present?
- does the implementation match SDIR relationships?
- did backend structure leak into navigation/product taxonomy without a decision record?

Outputs:

`PASS / WARN / BLOCK`.

## 18.3 V3 — Heuristic / Visual Review

Context-specific rubric.

### Canvas example

- workspace dominance;
- node / edge readability;
- grouping;
- spatial hierarchy;
- context preservation;
- inspector competition;
- zoom / overview discoverability.

### Data Explorer example

- scan efficiency;
- numeric typography;
- status encoding;
- filtering;
- visible query state;
- row density;
- loading / empty / error;
- comparison support.

### Settings example

- conceptual grouping;
- product vocabulary;
- validation feedback;
- progressive disclosure;
- error prevention;
- save model;
- destructive action clarity.

V3 is assistive.

It MUST NOT pretend to be deterministic.

## 18.4 V4 — Product Evidence

Examples:

- task success;
- time on task;
- error rate;
- learnability;
- user feedback;
- repeated revision cost.

This layer cannot be replaced by Agent self-review.

## 18.5 Evidence submission

The runtime MAY ask the Coding Agent to collect evidence using its available browser / screenshot / testing tools.

Example:

```yaml
validation_evidence:
  check: workspace_dominance
  evidence_type: screenshot_review
  artifact: preview-selected.png
  finding:
    status: warn
    reason: inspector and navigation occupy comparable visual emphasis to canvas
  reviewer: agent_assistive
```

The MCP itself does not need embedded computer vision in v0.

---

# 19. MCP Tool Contract

v0 SHOULD expose a small, staged tool set.

Proposed Tools:

1. `design_start`
2. `design_frame`
3. `design_context`
4. `design_route`
5. `design_inspect`
6. `design_decide`
7. `design_sdir`
8. `design_reconcile`
9. `design_prepare_implementation`
10. `design_validate`

Exact names are v0 experimental.

---

## 19.1 `design_start`

### Purpose

Create a Design Session.

### Input

```yaml
requirement:
project_root:
mode: greenfield | existing_product
```

### Output

```yaml
status: PASS
design_session_id: ds_001
phase: PRODUCT_FRAMING
next:
  tool: design_frame
required:
  - user
  - goal
  - primary_task
  - product_objects
```

It MUST NOT return design knowledge.

---

## 19.2 `design_frame`

### Purpose

Submit / validate Product Frame.

### Input

```yaml
design_session_id:
product_frame:
```

### Output

```yaml
status: PASS | EXPAND | RETRY | REVIEW
missing_or_uncertain: []
next:
```

If Product Frame is incomplete, route MUST remain inaccessible.

---

## 19.3 `design_context`

### Purpose

Submit / validate Design Context.

### Input

```yaml
design_session_id:
design_context:
```

### Output

```yaml
status:
material_unknowns: []
next:
```

---

## 19.4 `design_route`

### Purpose

Return minimal candidate indexes.

### Input

```yaml
design_session_id:
question:
```

### Output

```yaml
status:
candidate_domains: []
principles: []
heuristics: []
patterns: []
platform_profile: []
confidence:
next:
```

No substantive L2/L3 content.

---

## 19.5 `design_inspect`

### Purpose

Progressively expand approved candidate knowledge.

### Input

```yaml
design_session_id:
ids:
  - PAT-LIST-DETAIL
depth: L0 | L1 | L2 | L3
reason:
```

### Runtime behavior

- verify item was routed or valid for conflict review;
- verify requested depth is allowed;
- record disclosure;
- return only requested depth.

---

## 19.6 `design_decide`

### Purpose

Submit Design Decision artifact.

### Input

```yaml
design_session_id:
design_decisions:
```

### Output

```yaml
status:
conflicts: []
warnings: []
required_expansions: []
next:
```

---

## 19.7 `design_sdir`

### Purpose

Create or validate SDIR.

### Input

```yaml
design_session_id:
mode: generate_from_decisions | validate
sdir:
```

### Output

```yaml
status:
schema_errors: []
semantic_errors: []
next:
```

v0 generation can be template-assisted; correctness validation matters more than automatic generation.

---

## 19.8 `design_reconcile`

### Purpose

Record technical capability mapping.

### Input

```yaml
design_session_id:
capability_map:
```

### Output

```yaml
status:
gaps: []
required_decisions: []
next:
```

---

## 19.9 `design_prepare_implementation`

### Purpose

Produce an implementation-ready packet.

### Input

```yaml
design_session_id:
platform:
framework:
```

### Output

```yaml
status:
implementation_brief:
```

If prior gates are incomplete, return `BLOCK`.

---

## 19.10 `design_validate`

### Purpose

Return context-specific validation plan and/or accept validation evidence.

### Modes

```text
plan
submit_evidence
evaluate
```

### Output

```yaml
status: PASS | WARN | REVIEW | BLOCK | EXPAND
checks:
findings:
missing_evidence:
```

---

# 20. State Machine Enforcement

Tool order is not just documentation.

The runtime MUST enforce legal transitions.

Example:

```text
PRODUCT_FRAMING
  allowed:
    design_frame
  blocked:
    design_route
    design_decide
    design_sdir
    design_prepare_implementation
```

Example error:

```yaml
status: BLOCK
code: GATE_NOT_SATISFIED
message: Primary task and Product Objects are not resolved.
required_next_action:
  tool: design_frame
```

A Coding Agent MUST NOT be able to bypass the workflow by simply calling later-stage tools.

---

# 21. Artifact Model

MCP calls are transient.

Artifacts are the source of design continuity.

## 21.1 Required artifacts

For a completed design session:

```text
product-frame.yaml
design-context.yaml
routing-log.yaml
design-decisions.yaml
screen.sdir.yaml
capability-gaps.yaml
implementation-brief.yaml
validation-report.yaml
```

## 21.2 Suggested project-local structure

```text
.systemsmith/
└── design/
    └── sessions/
        └── ds_001/
            ├── session.yaml
            ├── product-frame.yaml
            ├── design-context.yaml
            ├── routing-log.yaml
            ├── design-decisions.yaml
            ├── screen.sdir.yaml
            ├── capability-gaps.yaml
            ├── implementation-brief.yaml
            └── validation-report.yaml
```

## 21.3 Atomic persistence

Each successful gate SHOULD atomically persist its artifact.

A failed gate MUST NOT overwrite the last valid artifact.

## 21.4 Human-editable

Artifacts MUST remain readable and editable by humans.

YAML is preferred for v0 design artifacts unless JSON Schema tooling materially benefits from JSON.

---

# 22. v0 Knowledge Scope

The project already has broader research content.

v0 MUST intentionally use only a small subset.

## 22.1 Principles

Target approximately 15 high-value Principles.

Recommended seed families:

- perceptual grouping;
- visual hierarchy;
- semantic color economy;
- externalize working memory;
- recognition over recall;
- signal-to-noise;
- state visibility;
- event feedback;
- user control / reversibility;
- error prevention;
- internal consistency;
- external/platform expectations;
- system image / conceptual model;
- accessibility semantics;
- information exploration / context preservation where applicable.

The exact list should be selected from D3 during implementation, preserving D3 IDs and provenance.

## 22.2 Heuristics

Target approximately 10–15.

High-value seed candidates:

- system status visibility;
- user language / domain vocabulary;
- user control;
- consistency;
- error prevention;
- recognition over recall;
- flexibility / expert efficiency;
- signal-to-noise;
- error diagnosis / recovery;
- conceptual grouping;
- alignment / spacing rhythm;
- professional-tool density;
- state shareability for analysis tools;
- information scent / labeling;
- loading / empty-state contracts.

The exact subset should be selected from D4.

## 22.3 Patterns

Target 6–8:

- Application Shell;
- Workspace;
- Canvas Workspace;
- List → Detail;
- List → Detail → Inspector;
- Data Explorer;
- Settings Sections;
- Resource Management.

Pattern contents MUST preserve `problem/context/forces/tradeoffs`.

## 22.4 Platform profile

Only:

```text
WEB-DESKTOP
```

for v0.

## 22.5 Constitution

The v0 Constitution is small and always-on.

Suggested content:

1. Product/User/Task first.
2. Primary content visibility over decoration.
3. Structured density for professional tools.
4. Supporting surfaces remain subordinate.
5. Reuse and consistency over novelty.
6. State must be visible.
7. Accessibility/safety are non-compensatory.
8. Backend is a capability constraint, not the user model.
9. Do not silently downgrade UX to backend structure.
10. Do not invent rationale or user evidence.

The Constitution SHOULD fit comfortably in the bootstrap context.

---

# 23. Repository Structure

Recommended v0:

```text
systemsmith-design-mcp/
├── package.json
├── tsconfig.json
├── README.md
│
├── src/
│   ├── server/
│   │   ├── mcp-server.ts
│   │   └── tools/
│   │
│   ├── runtime/
│   │   ├── session/
│   │   ├── gates/
│   │   ├── router/
│   │   ├── disclosure/
│   │   ├── decisions/
│   │   ├── sdir/
│   │   ├── reconciliation/
│   │   └── validation/
│   │
│   ├── storage/
│   │   └── filesystem/
│   │
│   └── schemas/
│
├── constitution/
│   └── constitution.yaml
│
├── knowledge/
│   ├── principles/
│   ├── heuristics/
│   ├── patterns/
│   └── myths/
│
├── profiles/
│   └── web-desktop.yaml
│
├── golden/
│   ├── architecture-canvas/
│   ├── data-explorer/
│   └── model-settings/
│
├── tests/
│   ├── unit/
│   ├── protocol/
│   ├── routing/
│   ├── disclosure/
│   ├── sdir/
│   └── fixtures/
│
└── docs/
    ├── architecture.md
    ├── tool-contracts.md
    └── knowledge-authoring.md
```

No database is required.

No network service is required.

---

# 24. Architecture Canvas Golden Case

Architecture Canvas is the first end-to-end pressure test.

## 24.1 Product framing

Primary purpose:

> help a professional user understand and inspect a complex software architecture while preserving system context.

Not:

> render nodes and edges because the backend provides `nodes[]` and `edges[]`.

## 24.2 Example Product Frame

```yaml
user:
  primary_role: technical_operator_or_engineer
  expertise: expert

goal:
  primary: understand_system_architecture

tasks:
  primary: inspect_architecture
  secondary:
    - trace_relationship
    - inspect_entity
    - follow_flow

product_objects:
  - architecture_node
  - relationship
  - flow
  - group

primary_success_definition:
  user can locate, understand and follow a relationship without losing global context
```

## 24.3 Expected relevant knowledge

Router is expected to surface, among others:

- perceptual grouping;
- visual hierarchy;
- system image / conceptual model;
- signal-to-noise;
- context preservation;
- Canvas Workspace;
- Contextual Inspector;
- overview / filter / detail-family patterns where applicable.

It SHOULD NOT surface unrelated Settings or form patterns.

## 24.4 Expected high-level decisions

Likely but not hard-coded:

- canvas/workspace is dominant;
- navigation is supporting;
- inspector is contextual;
- selection drives contextual detail;
- dense information is acceptable if structured;
- toolbar and chrome should remain quieter than architecture content.

## 24.5 Required states

At minimum:

- loading;
- empty;
- ready;
- selected;
- error.

## 24.6 Golden artifact package

```text
golden/architecture-canvas/
├── requirement.md
├── context.yaml
├── decisions.yaml
├── screen.sdir.yaml
├── reference.png
├── reference.html            # when available
├── states/
├── review.yaml
└── README.md
```

Golden Cases teach:

> why the design exists,

not just:

> what the screenshot looks like.

---

# 25. A/B Benchmark

The first benchmark compares:

```text
Same Requirement
       │
 ┌─────┴─────┐
 ▼           ▼
Bare Agent   Design MCP Agent
 │           │
 ▼           ▼
Result A     Result B
 └─────┬─────┘
       ▼
Same Review Protocol
```

## 25.1 Initial benchmark cases

1. Architecture Canvas — required for v0.
2. Data / Log Explorer — fixture defined, full benchmark may follow v0.
3. Model / Provider Settings — fixture defined, full benchmark may follow v0.

## 25.2 Measure design process, not only screenshot appearance

Capture:

- number of explicit Product Framing corrections;
- number of backend-driven UI leaks;
- high-severity heuristic findings;
- missing-state findings;
- Pattern reuse;
- number of unrecorded custom abstractions;
- SDIR → implementation conformance;
- human revision rounds;
- user-requested layout corrections;
- capability gaps detected vs silently ignored.

## 25.3 Review discipline

A/B review SHOULD be blind to which result used MCP where practical.

"Looks nicer" is not sufficient.

Findings SHOULD name:

- rule / heuristic / Pattern;
- evidence;
- consequence;
- severity / confidence.

---

# 26. Tests and Acceptance Criteria

## 26.1 Protocol tests

MUST verify:

- server starts via stdio;
- all Tools register;
- malformed inputs are rejected;
- `design_session_id` is required after start;
- tool calls do not depend on persistent transport session state.

## 26.2 State machine tests

MUST verify:

- out-of-order tools return `BLOCK`;
- successful gate advances phase;
- failed gate does not advance;
- resume works from persisted session;
- second client/Agent can resume same session using explicit session ID.

## 26.3 Progressive disclosure tests

MUST verify:

- `design_route` returns indexes only;
- L2/L3 knowledge is not returned by default;
- `design_inspect` enforces allowed depth;
- unrestricted dump requests are blocked;
- disclosure history persists.

## 26.4 Routing tests

Fixtures MUST prove:

- Canvas context does not receive Settings-only knowledge;
- Settings context does not receive Canvas-only knowledge;
- exact scope outranks generic scope;
- deprecated knowledge is not preferred;
- low confidence produces `EXPAND/REVIEW` rather than uncontrolled expansion.

## 26.5 Product-first tests

MUST include a fixture where backend exposes:

```text
provider
provider_model
route_config
proxy_config
credential
```

and verify the runtime does not automatically reproduce these as top-level user-facing navigation.

## 26.6 Capability reconciliation tests

MUST verify:

- capability gap can be recorded;
- gap requires explicit resolution type;
- UX cannot be silently marked supported when required backend capability is missing.

## 26.7 SDIR tests

MUST verify:

- semantic schema accepts valid intent/role/importance/relationship fields;
- forbidden render fields are rejected;
- unknown vocabulary can be experimental but not silently stable;
- implementation brief cannot be emitted without valid SDIR.

## 26.8 Validation tests

MUST verify:

- deterministic findings can block;
- assistive findings are not labeled deterministic;
- user evidence is never fabricated;
- context-specific review packet differs by page type.

## 26.9 v0 acceptance

v0 is accepted only if all of the following hold:

### Runtime

- [ ] MCP server works locally over stdio.
- [ ] explicit Design Session state persists.
- [ ] state machine gates cannot be bypassed.
- [ ] Product Framing precedes design routing.
- [ ] backend details cannot silently define Product Model.
- [ ] Router returns scoped candidates only.
- [ ] Progressive Disclosure works through L0–L3.
- [ ] Design Decisions are persisted.
- [ ] SDIR validates and rejects render-level leakage.
- [ ] Capability Reconciliation records gaps.
- [ ] Implementation handoff is blocked before prerequisite gates.
- [ ] Validation packet is context-routed.

### Knowledge

- [ ] v0 Constitution exists.
- [ ] initial Principle subset exists.
- [ ] initial Heuristic subset exists.
- [ ] 6–8 Pattern contracts exist.
- [ ] Web Desktop profile exists.
- [ ] all knowledge has scope + lifecycle + provenance metadata.

### Vertical slice

- [ ] Architecture Canvas runs end-to-end through the MCP.
- [ ] a bare-Agent baseline is captured.
- [ ] Design-MCP result is captured.
- [ ] both are reviewed with the same rubric.
- [ ] review records whether the system raised the quality floor.
- [ ] at least one architecture decision is revised based on observed benchmark evidence.

The last item is intentional:

> v0 is a learning experiment; a benchmark that causes no architecture correction is suspicious.

---

# 27. Explicitly Deferred Work

Do not implement these in v0 unless required by a blocker discovered during the vertical slice:

## Infrastructure

- remote Streamable HTTP deployment;
- OAuth;
- multi-user tenancy;
- Postgres / Supabase storage;
- distributed state;
- web admin UI;
- hosted SaaS.

## Knowledge infrastructure

- vector database;
- Knowledge Graph;
- generic semantic search;
- automatic web research;
- automatic source ingestion;
- full 278-source research corpus in runtime;
- full 29 + 31 knowledge catalog;
- complex GRADE engine;
- weighted additive conflict scoring.

## Platform

- Vue adapter;
- Android Compose;
- Flutter;
- Qt;
- mobile platform profiles.

## Design generation

- deterministic SDIR → code compiler;
- Figma import/export;
- screenshot-to-code;
- autonomous visual design generation.

## Validation

- embedded vision model;
- synthetic user replacement;
- automatic usability scoring;
- automatic severity final judgment.

## Product

- Design Intelligence web dashboard;
- pattern authoring studio;
- rule management UI.

---

# 28. Implementation Priorities

Recommended coding order:

```text
1. MCP server skeleton
2. explicit session store
3. state machine / gates
4. artifact schemas
5. Product Framing
6. Design Context
7. small Knowledge Store
8. Router
9. Progressive Disclosure
10. Design Decision validation
11. SDIR validation
12. Capability Reconciliation
13. Implementation brief
14. Validation packet
15. Architecture Canvas vertical slice
16. A/B benchmark
17. architecture correction
```

Do not begin by importing all research documents.

Do not begin by writing a component library.

Do not begin by implementing visual generation.

---

# 29. Definition of Done for the First Development Cycle

The first Work development cycle is done when a Coding Agent can be given an Architecture Canvas requirement and can successfully execute:

```text
design_start
→ design_frame
→ design_context
→ design_route
→ design_inspect
→ design_decide
→ design_sdir
→ design_reconcile
→ design_prepare_implementation
→ implement externally
→ design_validate
```

and the resulting artifacts make clear:

- who the user is;
- what task the screen serves;
- why the chosen Pattern was selected;
- why major alternatives were rejected;
- what semantic commitments the UI must preserve;
- where backend capabilities do or do not satisfy product needs;
- what was validated;
- what remains uncertain.

A second Agent must be able to resume that work without reconstructing design intent from the full conversation history.

---

# 30. Final Product Principle

Systemsmith Design MCP is not intended to replace excellent designers.

Its purpose is:

> **to make product-first design reasoning, progressive knowledge use, reusable patterns, explicit decisions and multi-layer validation the default operating environment for AI Agents, so that low-quality UI becomes difficult to produce accidentally.**

The system succeeds when the Agent no longer asks first:

> "What fields and APIs do I need to display?"

but instead asks:

> "Who is using this, what are they trying to accomplish, what do they believe the product contains, what information must dominate, which proven pattern best supports that task, and only then—how can the current system capabilities implement it?"

---

# Appendix A — v0 Always-On Agent Bootstrap

The bootstrap Skill SHOULD remain small.

A v0 form can communicate only:

```text
You are working under Systemsmith Design Runtime.

For UI / frontend product work:

1. Product before backend.
2. Resolve user, goal, task and product objects before UI structure.
3. Do not implement before the runtime marks implementation-ready.
4. Use only design knowledge routed for the current decision.
5. Expand knowledge progressively; do not request the full knowledge base.
6. Reuse stable Patterns before inventing new ones.
7. Treat accessibility and safety as non-compensatory.
8. Record major choices and rejected alternatives.
9. Do not silently degrade UX to backend structure; record capability gaps.
10. Validation requires evidence; "looks good" is not evidence.

Follow the next gate returned by the Design MCP.
```

The Skill SHOULD NOT contain the full Principles, Heuristics, Patterns or source corpus.

---

# Appendix B — Technical References Used for v0 Baseline

## Project research artifacts

- `UIUX_Foundation_Research.md`
- `Universal_Design_Principles_Draft.md`
- `UX_Heuristics_Draft.md`
- `Design_Knowledge_Taxonomy.md`
- `Pattern_Language_Research.md`
- `Design_Rule_Schema_Draft.yaml`
- `Design_Rule_Schema_说明.md`
- `SDIR_Prior_Art_and_Feasibility.md`
- `Design_Intelligence_Architecture_Recommendations.md`
- `Source_Registry.md`
- `99_Review_Report.md`

## Current MCP implementation baseline verified 2026-08-25

- Model Context Protocol specification `2026-07-28`
- Official TypeScript SDK v2 stable line
- stateless protocol core
- explicit application state recommended for stateful workflows
- server supports Tools / Resources / Prompts; v0 intentionally uses controlled Tools as the primary surface
