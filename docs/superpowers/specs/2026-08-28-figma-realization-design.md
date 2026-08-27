# Prax 设计→Figma 实现路径设计（Design Realization: figma_first）

日期：2026-08-28（子代理审查后修订 r2；plan 审查后 r3：provider 中立命名 provider_refs/provider_refs_verified、drift 双侧证据落为两条 artifact_refs 约定、拼接辅助函数置于 realization.ts）
状态：已与用户对齐（brainstorming 结论）+ codex 子代理审查修订，待实施
驱动：用户 2026-08-28 决策——暂停 benchmark 驱动（MEM-001 切断），按文档建设 Design Realization 能力；Methodology Part V / §50 Phase 3 是 v0 之后规划中解锁的下一层

## 1. 背景与动机

Systemsmith v0 规范 §27 将 Figma import/export 与确定性 SDIR→code 编译器列为延后项；Methodology §17–19 定义了 Design Realization Strategy 的长期语义：Design 与 Production Code 之间不是固定一条路，Figma 是 Representation Surface 而非真理源。Resource Guide §14 规定 Figma 接入只在存在真实 Figma Golden Case 时启动——本设计同时交付能力与该 Golden Case。

2026-08 事实变化：官方 Figma remote MCP server 已支持写画布（`use_figma`：创建/编辑 frames、components、variables、text、auto layout），Claude Code 在 Figma 允许接入的客户端目录内。这使"agent 经 Figma MCP 按 SDIR 生成 frames 草稿 + 人审"成为现实路径。

## 2. 目标与非目标

**目标**

1. `realization_mode` 决策点：full-SDIR 会话在 sdir 之后、prepare 之前显式决定 `direct_code | figma_first`（按 §18 适配条件）
2. figma_first 时创建 Representation Artifact（`representation-artifact.yaml`），semantic_refs 指向 SDIR regions 并绑定 SDIR digest，Figma refs 只作表达证据
3. 人工审批复用 REVIEW gate 语义：整批审 + 定向反馈，审批绑定不可变证据（SDIR digest + 截图 digest），完整历史留档
4. approved figma ref 进 implementation-brief 与 compiled context
5. validation plan 增 Design↔Figma↔Runtime 最小 drift 检查（deterministic 检查必须真实执行、fail-closed）
6. Golden Case：Prax landing page（greenfield/高视觉不确定型），单次真实使用跑满全链（含实现与运行时），跑后固化为可回归 fixture

**非目标**

- 不做确定性 SDIR→Figma 编译器；生成由 agent + Figma MCP 完成，Prax 管契约与追踪
- 不做 Figma import（读回方向）、Code Connect、Figma Variables 同步
- 不建 Representation 分类表、通用 provider Registry、Representation Capability 路由
- 不实现 `executable_prototype_first` / `hybrid_roundtrip` 两模式（枚举与条件表为其预留位置，但不注册）
- 不做非模型可伪造的人工确认 token（需宿主 UI 集成，明确延后；当前以结构化 provenance + 已知限制声明处理，与 confirmation evidence 同一边界）
- 方法论与核心 schema 不写死 Figma：Figma 是版本化 provider 表的第一项

## 3. 硬护栏

1. 权威链永远是 Design Contract → Representation Artifact → Figma。Figma ≠ Product Truth ≠ SDIR ≠ Runtime Truth（§19，防 Figma-driven UI 反模式 §42.5）
2. figma_first 只用于适配场景（§18.2），判定走可执行决策谓词，不得全局默认
3. Figma 作为版本化 provider 进入接入层（Resource Guide §16）；注册表只声明"Prax 支持的 adapter"，不声称运行时可用性（Prax 不直连 Figma，可用性由 agent 侧实测）
4. 确认是证据不是 boolean（架构师评审 #2 教训）；同时如实记录信任边界：`human_decision` 证据是 agent 转述 + 结构化 provenance，runtime 无法验证"确为人作"——与 validate 自证限制同源，属已知限制
5. runtime 能验证的必须验证（SDIR digest、region 覆盖、证据文件存在性与 digest、路径安全）；runtime 不能验证的（Figma 内容版本）必须记录补偿控制（drift 检查）并文档化

## 4. 工具与生命周期

### 4.1 新工具 `design_realize`（第 11 个，provider 无关命名）

payload 分派，与 `design_sdir` 同构；客户端 schema 拍平 + 服务端分支校验（AB-001 gap-mcp-anyof-schema 教训）：

```yaml
# propose —— realization 提案
mode: propose
realization_mode: direct_code | figma_first
provider: figma                # figma_first 必填，∈ 已注册 provider 表
conditions: [{ id, holds, basis }]   # §18 条件逐条声明+依据；必须与所选 mode 的固定条件集完全一致

# submit_draft —— agent 经 Figma MCP 生成 frames 后回填
mode: submit_draft
provider_refs:
  file_key: <string>
  frames: [{ node_id, name, sdir_region }]

# submit_review —— 人审结果
mode: submit_review
status: approved | rejected
provider_refs_verified: { file_key, frame_node_ids: [...] }
feedback: { text, region_annotations: [{ sdir_region, note }] }   # rejected 必填
evidence: [{ type, ref, notes }]    # approved 须含 ≥1 screenshot + ≥1 human_decision
```

### 4.2 Gate 拼接与状态机

- 新 gate：`realize`，新 phase：`REALIZATION`（进 GATE_PHASE / NEXT_TOOL_BY_GATE）
- `propose(figma_first)` 校验通过 → 在 sdir（+reconcile 若有）与 prepare 之间动态拼接 realize gate（复用 sdir_delta 拼接 reconcile 的先例，policy 默认表不变），创建 `representation-artifact.yaml`（status: pending_generation，绑定当时 SDIR digest）
- `propose(direct_code)` → 仅落盘 `realization-decision.yaml`，不拼 gate，next = prepare
- `submit_draft` 通过 → artifact status=under_review，返回 **REVIEW**（人审中，gate 不推进）
- `submit_review(approved)` → realize gate 完成，artifact approved，next = prepare
- `submit_review(rejected)` → gate 停留 REVIEW，artifact 回 revision_requested，review 记录入档（history 只追加），agent 修改后重新 submit_draft（轮次不限）

**改判状态转换（有限集，事务性更新 policy/phase/gate/revision）**：

| 转换 | 条件 | 效果 |
|---|---|---|
| direct_code → figma_first | realize gate 未完成 | 拼接 realize gate，supersedes 链记录改判 |
| figma_first → direct_code | artifact 未 approved | **移除已拼接的 realize gate**，artifact status=abandoned（归档原因入 decision 链），next = prepare |
| 任何 re-propose | realize gate 已完成（approved） | BLOCK `REALIZATION_LOCKED` |

provider 故障/seat 不可用的逃生路径 = 第二行转换（改判 direct_code），agent 换路径而不是卡死在 realize gate——对齐"ROUTING 死锁"教训：门禁必须留出口。

### 4.3 提案义务边界（policy v1/v2 判别）

**Lifecycle policy 升 v2**：`LifecyclePolicySchema` 改为 v1/v2 discriminated union（literal version 字段判别）。新建 full-SDIR 会话（greenfield / rework / add_surface）使用 v2；其余 policy 同步升 v2 但无 realization 义务差异。

- **仅 v2 且 policy 含完整 `sdir` gate 的会话必须先 propose 才能 prepare**；direct_code 也要显式提案（审计"为什么不用 Figma"）
- v1 旧会话：恢复行为完全不变，不执行 realization 强制，`design_realize` 对其不可达（BLOCK `REALIZATION_WINDOW_INVALID`）
- modify_surface 与轻路径（v2）：realization 隐式为 direct_code，不强制提案、不允许 figma_first

### 4.4 兼容

- v1 持久化会话按 v1 策略恢复（现有 normalizeCompletedGates 行为不动）
- v1/v2 恢复迁移测试：v1 会话恢复→prepare 无 realization 拦截；v2 direct_code、v2 figma_first 各一组
- ADR-003 记录：十工具→十一（修订 ADR-002 #7）、policy v2、realize gate、provider 版本化

## 5. Artifacts

### 5.1 `realization-decision.yaml`（propose 必落，两模式都落）

```yaml
version: "0.1"
realization_mode: figma_first        # | direct_code
provider: figma                      # figma_first 时
provider_contract_version: remote-mcp-2026-08   # 取自 provider 注册表，审计用
conditions:
  - { id: greenfield, holds: true, basis: "session mode=greenfield, no existing surfaces" }
  - { id: high_visual_uncertainty, holds: true, basis: "..." }
  - { id: runtime_dependency_low, holds: true, basis: "静态页，无复杂交互状态" }
proposed_at: "<iso>"
supersedes: { prior_mode: <direct_code | figma_first>, reason: "<改判原因，改判时必填>" }
```

### 5.2 `representation-artifact.yaml`（仅 figma_first；§16 最小裁剪）

```yaml
version: "0.1"
id: rep-<session-slug>
representation: { role: primary }
semantic_refs:
  sdir_ref: screen.sdir.yaml
  sdir_digest: "sha256:<propose 时的 SDIR 内容 digest>"   # 审批绑定的不可变锚点（runtime 可验证）
  regions: [<sdir region id 列表>]
realization:
  provider: figma
  provider_contract_version: remote-mcp-2026-08
  refs: null                         # submit_draft 回填 provider_refs
status: pending_generation           # → under_review → revision_requested | approved | abandoned
validation: [design_representation_coverage, representation_runtime_drift]
```

§16 的 `task_support` / `interaction_contract` / `capability` 等字段本轮不建（护栏 5：等真实需求）。

### 5.3 `representation-review.yaml`（单文件，history 完整记录、只追加）

```yaml
version: "0.1"
round: 2
status: rejected                     # approved | rejected
provider_refs_verified: { file_key, frame_node_ids: [...] }
feedback:
  text: "hero 太弱，features 顺序反了"
  region_annotations: [{ sdir_region: hero, note: "对比度不足" }]
evidence:
  - { type: screenshot, ref: rep-evidence/round-2/frame-hero.png, sha256: "<digest>", collected_at: "<iso>" }
  - type: human_decision
    actor_type: human
    actor_ref: "user:SiChuchen"
    source_type: conversation
    source_ref: "<会话消息标识或渠道引用>"
    quote: "用户反馈原文摘录"
    confirmed_at: "<iso>"
decided_at: "<iso>"
sdir_digest_at_review: "sha256:<审轮时 SDIR digest>"
history:                              # 前轮完整记录（同构字段），只追加不重写
  - round: 1
    status: rejected
    provider_refs_verified: { ... }
    feedback: { ... }
    evidence: [ ... ]
    decided_at: "<iso>"
```

**已知限制（如实声明）**：`human_decision` 为 agent 转述 + 结构化 provenance，runtime 无法独立验证确为人作；非模型可伪造 token 需宿主 UI 集成，明确延后。`screenshot.sha256` 由 runtime 落盘时计算（不信任 agent 自报）。

### 5.4 证据落盘与验证（runtime 强制）

- 截图由 agent 经 Figma MCP `get_screenshot` 取回，存 `sessions/<id>/rep-evidence/round-<n>/`
- runtime 在 accept 前逐项验证：路径为相对路径、`rep-evidence/` 前缀、`realpath` 解析后仍位于 session 证据目录内（拒绝 symlink 逃逸）、文件存在且为 regular file、大小 > 0；通过后计算并记录 sha256
- 与 validator `ValidationEvidenceItem.artifact_refs` 哲学同构：结构化证据缺项 = 自证/EXPAND，记 warning 或要求补全

## 6. 校验规则

### 6.1 propose

| 规则 | 结果 | 码 |
|---|---|---|
| 枚举合法；figma_first 必带 provider 且 ∈ 注册表 | BLOCK | `REALIZATION_MODE_INVALID` |
| 时序：仅 policy v2、sdir(+reconcile) 完成后、prepare 前、policy 含 `sdir` gate | BLOCK | `REALIZATION_WINDOW_INVALID` |
| figma_first 仅限 full-SDIR 路径 | BLOCK | `REALIZATION_MODE_INVALID` |
| 条件集与所选 mode 固定条件集**完全一致**（exact-set）：缺失/多余/重复/未知 id | BLOCK | `REALIZATION_CONDITIONS_INCOMPLETE` |
| basis 逐条非空 | EXPAND | `REALIZATION_BASIS_MISSING` |
| **决策谓词**（可执行，版本化）：
  figma_first eligible = `runtime_dependency_low ∧ (greenfield ∨ high_visual_uncertainty ∨ marketing_editorial ∨ stakeholder_visual_approval ∨ spatial_exploration_value)`；
  声明不满足谓词却提 figma_first → REVIEW + 推荐 direct_code | REVIEW | `REALIZATION_MODE_MISMATCH` |
| 条件声明与可推导事实矛盾（如 greenfield.holds=true 但 session mode=rework） | REVIEW + 推荐值 | `REALIZATION_CONDITION_MISMATCH` |
| realize gate 已完成后 re-propose | BLOCK | `REALIZATION_LOCKED` |

**REVIEW 语义**：REVIEW 结果**不落盘 decision、不拼接/移除 gate**；agent 改述（修正条件声明）后重提，或走人类 override（显式 `override: true` + 理由，落盘标记 `overridden: true` 供审计）。谓词版本号随条件表常量版本化。

条件 id 固定词表（runtime contracts 常量）：direct_code 对应 §18.1（defect_fix_fit / visual_polish_fit / small_modification / mature_design_system）；figma_first 对应 §18.2（greenfield / high_visual_uncertainty / marketing_editorial / stakeholder_visual_approval / spatial_exploration_value / runtime_dependency_low）。

### 6.2 submit_draft

- 时序：decision=figma_first 且 artifact status ∈ {pending_generation, revision_requested}
- 覆盖检查（确定性）：每个 SDIR region ≥1 frame 映射，缺失列表 → EXPAND
- refs 形状：file_key 非空、node_id 非空去重、sdir_region ∈ artifact regions
- 通过 → under_review，返回 REVIEW

### 6.3 submit_review

- 时序：artifact status=under_review
- `provider_refs_verified` 与 artifact refs 完全一致，否则 RETRY
- rejected 必带非空 feedback；approved 必带 ≥1 screenshot（通过 §5.4 全部验证）+ ≥1 human_decision（结构化字段齐全），否则 EXPAND
- approved 时 runtime 重读 SDIR 计算 digest，与 artifact `sdir_digest` 不一致 → BLOCK `REALIZATION_SDIR_DRIFT`（SDIR 在审批期被改，须重走 draft→review）
- approved → gate 完成；rejected → revision_requested + 完整 review 记录入档

### 6.4 prepare 端强制

仅 policy v2 且含 `sdir` gate 的会话调 `design_prepare_implementation`：无 realization-decision 或 figma_first 未 approved → BLOCK `REALIZATION_REQUIRED`，next 指向 `design_realize`（防绕过锚）。v1 会话不拦。

## 7. prepare / compiled context / 验证计划集成

figma_first approved 后：

- implementation-brief 增 `realization` 块：`{ mode, provider, provider_contract_version, representation_artifact_ref, review: {round, decided_at}, provider_refs, sdir_digest }`
- compileContext 增输入 representation（artifact + region→frame 映射）→ compiled-context 增 representation 段：实现 agent 按 region 找到 approved frame 引用；brief 同时携带 **live node refs 与 approved 锚点（round + sdir_digest + 截图 digest 清单）**——实现对照物是"审批时刻的表达快照"，不是可变的 live 节点
- resolveValidationPlan 增读 realization-decision + representation artifact + approved review；**plan 的 `derived_from.artifact_digests` 纳入全部依赖**：sdir、realization-decision、representation-artifact、representation-review——任一变化 → plan revision 变化

direct_code：brief 增一行 `realization: { mode: direct_code }`，其余无变化。

**Drift 三角最小覆盖**：

| Drift 对 | 检查 | kind | 机制 |
|---|---|---|---|
| Design↔Figma | `design_representation_coverage` | deterministic（**必须真实执行，fail-closed**） | evaluate() 增类型化输入：representation artifact + approved review + sdir。缺失 artifact / 非 approved / SDIR digest 与 artifact 不符 / 任一 region 无 frame → **FAIL**。禁止未知 deterministic check 静默 PASS（测试断言每个 deterministic check 产出 finding） |
| Design↔Runtime | `semantic_conformance`（现有） | 现有 | 不新增 |
| Figma↔Runtime | `representation_runtime_drift` | empirical（**双侧证据，服务端验证**） | evidence 项携带恰好两条 `artifact_refs`：第一条 = approved 审轮截图 ref（须在 review 记录内，digest 锚定），第二条 = 运行时快照（存 `rep-evidence/runtime-*`，runtime 按 §5.4 验证存在/containment/sha256）；缺任一侧或缺验证 → EXPAND（不是 warning） |

**Figma 同节点编辑边界（如实声明）**：runtime 不直连 Figma，无法验证 file_key/node_id 指向的内容自审批后未变。补偿控制 = ①审轮截图 digest 锚定"批准了什么"；②`representation_runtime_drift` 以运行时截图对照 approved 截图；③差异 → Controlled Re-entry。此边界写入 architecture.md 已知限制。

时序自洽：plan 在 prepare materialize 并 lock，而 realize gate 在 prepare 之前——drift 检查进 plan 时 realization 已定，无锁后变更窗口。

## 8. Provider 注册（版本化，非通用 Registry）

runtime contracts 内静态常量：

```ts
REALIZATION_PROVIDERS = {
  figma: { id: "figma", contract_version: "remote-mcp-2026-08", capabilities: ["write_canvas", "screenshot", "metadata"] }
}
```

注册表语义 = **Prax 支持的 adapter 契约版本**，不代表运行时可用性（Prax 不直连 provider；可用性由 agent 侧实测，故障时走 §4.2 改判路径）。decision/artifact 落盘 `provider_contract_version` 供审计。新增 provider = 改这张表 + 校验规则，不动架构、不动方法论。

## 9. Golden Case：Prax landing page（两层）

**层 1 — Live acceptance run（真实使用）**：

- 位置：`golden/prax-landing/`，含 requirement.md（Prax 产品官网首页：hero / 价值主张 / features / CTA）+ run-manifest（输入清单：agent CLI/model、Prax/Figma MCP 版本快照、逐 gate 预期结果与 pass/fail 判据——§18 条件应判 figma_first、region→frame 覆盖、人审轮次记录、drift 证据齐全、REALIZATION 系列 gate 状态正确）
- 性质：**单次真实使用**，非 A/B 实验。用户新会话挂 Prax + Figma remote MCP 跑全链，人审由用户在 Figma 真实把关
- 实现产物：`apps/prax-landing/`（静态页，可实际使用）
- 前置：接入官方 Figma plugin，`whoami` 实测 seat 可用性

**层 2 — Frozen regression fixture（跑后固化）**：

live run 通过后，将完整 session 产物脱敏固化为 `golden/prax-landing/fixture/`（session artifacts + 各轮 review + 截图 digest + 预期 gate/status/code 清单），作为后续改动的回归对照。固化动作本身列入 plan 的验收后步骤。

## 10. 代码落点（零新包）

```text
packages/prax-runtime/src/
├── contracts.ts          # realize gate、三个 artifact 类型、REALIZATION_PROVIDERS、条件词表与谓词、policy v1/v2 union
├── lifecycle-policy.ts   # GATE_PHASE / NEXT_TOOL_BY_GATE 增 realize；v2 policy 生成
├── state-machine.ts      # 动态拼接/移除 realize gate（改判转换）
├── realization.ts        # 新文件：§6 全部校验规则 + §5.4 证据验证
├── artifact-store.ts     # ARTIFACT_FILES / ArtifactKey / ARTIFACT_SCHEMAS 增三项（恢复时 schema 校验）
├── context-compiler.ts   # representation 输入
└── index.ts              # 公共导出
packages/prax-mcp/src/
├── schemas.ts            # design_realize flat schema + policy v2 判别
├── service.ts            # designRealize + prepare 集成（REALIZATION_REQUIRED 仅 v2）
└── server.ts             # 注册第 11 个工具
packages/prax-validator/
├── contracts.ts          # evaluate 增类型化 representation 输入、结构化双侧 drift evidence
└── validator.ts          # design_representation_coverage 确定性执行分支（fail-closed）、drift evidence 校验、profile 装配
```

## 11. 测试与文档

测试（TDD，`npm test`）：

- lifecycle：v2 policy 生成、realize 拼接/移除（改判三转换）、**v1 会话恢复不受 realization 影响**、v2 direct_code / figma_first 各一组
- realization.ts：§6 校验矩阵（每个码）、谓词各分支、REVIEW 不落盘、override 落盘、证据验证（路径逃逸/symlink/不存在/空文件）
- service：全链（propose → draft REVIEW → reject 循环 → approved → prepare 带 realization 块与 digest 锚点）、REALIZATION_SDIR_DRIFT、REALIZATION_REQUIRED（仅 v2）、provider 故障改判路径
- validator：coverage deterministic 真实执行且 fail-closed（四类失败各一）、deterministic check 无静默 PASS 断言、drift 双侧证据缺失 EXPAND、plan digest 依赖变化 → revision 变化
- compiler：representation 段

文档：`docs/adr-003-realization-gate.md`（新工具、修订 ADR-002 #7、policy v2、provider 版本化）；architecture.md 更新（十一工具、三 artifact、realize gate、Figma 边界与已知限制）。

## 12. 决策记录（brainstorming 裁定 + 子代理审查修订）

1. Figma MCP 选型：官方 remote server（写能力齐、Claude Code 在允许目录；社区 GLips 只读、write bridge 成熟度低）——seat 可用性连接后 `whoami` 实测
2. 人审粒度：整批审 + 定向反馈，`representation-review.yaml` 落盘，history 完整记录只追加
3. Golden Case：Prax landing page，跑满全链（含实现 + Runtime drift）；live run + 跑后固化 fixture 两层
4. realization 判定：agent 提案 + runtime 交叉校验 + 可执行决策谓词（与 change-impact classification / confirmation evidence 同构）
5. 工具形态：独立第 11 工具 `design_realize`（用户裁定不死守十工具；ADR-003 记录）
6. （r2）policy v1/v2 判别解决旧会话兼容与强制规则冲突
7. （r2）审批绑定 SDIR digest + 截图 digest；Figma 内容不可变性以 drift 检查 + 已知限制声明补偿
8. （r2）改判有限转换集；provider 故障走改判逃生，不留死锁门
9. （r2）deterministic 检查必须真实执行、fail-closed；plan digest 纳入全部 realization 依赖
10. （r2）human_decision 结构化 provenance；非伪造 token 延后（宿主 UI 范畴）
