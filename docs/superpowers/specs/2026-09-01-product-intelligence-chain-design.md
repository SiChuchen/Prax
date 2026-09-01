# Prax 产品智能链与产物测量设计（Product-Intelligence Chain + Measured Artifact Validation）

日期：2026-09-01
状态：已与用户对齐（方向裁定），待子代理审查后实施
驱动：研究文档 `docs/Prax_Frontend_Product_Intelligence_Research_v0.1.md`（120 样本编码 + 深案例）；archify 外部解剖（2026-09-01）；AB-001 自证缺口；ECP 画布失败根因分析
决策记录：`docs/adr-005-product-intelligence-chain.md`
执行计划：`docs/superpowers/plans/2026-09-01-product-intelligence-chain.md`

## 1. 背景与动机

三条独立证据链指向同一个缺口：

1. **研究文档 v0.1** 给出因果模型（其 §34，18 步链）与 Agent 产出 dashboard shell 的七因诊断（其 §31：Backend Schema Salience、Component Prior、Missing User Model / Information Shape / **Representation Decision** / Negative Knowledge / Evolution Evidence）。当前 Prax 门禁链覆盖了流程顺序与证据存在性，但这七因中的五个 Missing 类因（User Model / Information Shape / Representation Decision / Negative Knowledge / Evolution Evidence）仍没有结构化载体。
2. **archify 解剖** 证明：AI 产物的高质量来自"意图受约束 + 机器测量 + 可执行诊断 + 字节绑定冻结"，而不是来自更努力的迭代。其核心机制——编译/测量层在 Agent 与产物之间收走像素级自由——与 D8 的"SDIR 类比 ADR 而非编译器 IR"不冲突：像素自由由**资产实现 + 运行态测量**收走，SDIR 保持纯语义。
3. **自身运行证据**：AB-001 发生"截图含报错弹窗但自证 pass"（现仅警告级）；ECP 画布（外部项目）多轮迭代不可读，根因是构图无归属、可读性无度量。

D8/D9 已锁定两个承重立场：SDIR 是设计决策记录层 + 推理脚手架（边界守护原则不变）；可判定子集 lint 化、不可判定的诚实委托。本设计在此之上补齐中间推理状态与产物测量层。

## 2. 目标与非目标

**目标**

1. 中间推理状态结构化：User/JTBD、Product Object、Information Shape、Representation Architecture（primary + supporting + rejected）、State Ownership、Complexity Budget、Acceptance 成为一等公民的门控数据（扩展现有门禁，不加新门禁）
2. 产物测量层：新包 `prax-measure` 对运行态页面做浏览器实测，产出结构化收据（`{code, subject, measured_evidence, threshold, supported_fixes}`）；validator 解析收据、核验证据文件字节、交叉比对 Agent 声明——机器能验内容的 empirical 证据必须验内容（AB-001 缺口在 BLOCK 级关闭）
3. 修正闭环收敛协议：open findings 计数不创新低两轮即停滞上报，诚实报告优先于无限重试
4. 证据绑定字节：测量收据引用的截图 sha256 由 runtime 复核；validation report 经由 plan `derived_from.artifact_digests` 绑定依赖产物摘要（现有机制扩展覆盖测量收据）
5. 知识资产重组为五类资产 + 稳定性分级 + trigger_conditions 路由 + 神话隔离条目（Phase 3）
6. 默认外壳负知识在决策点强制消费：dashboard / card-grid / 互斥 tabs / modal detail 作为主表达时必须对 information_shape 显式论证
7. ECP cognition workspace 作为第六个 golden case 试点新链（Phase 4）

**非目标**

- 不做 SDIR→代码编译器、不做通用 UI 自动布局引擎（D8 先例四死因；本设计以"资产携带像素 + 测量判定对错"替代编译任意 UI）
- 不加新 MCP 工具、不加新生命周期门禁（PRAX-P-024；扩展 decide/sdir/validate 载荷）
- SDIR 不引入像素/CSS/组件/坐标字段（边界守护原则；render-leak lint 范围不变地覆盖新字段）
- 不建 VLM 终裁；感知终审永远是人。assistive 判定保持人/Agent 判断属性，但必须留下可审计证据痕迹
- Phase 4 的实证基准本 spec 只定框架与门禁，不定执行细节（Phase 1–3 证据到手后 replan）
- 不追求测量目录一次完备：catalog v0 只含可零误报执行的检查；品味类检查从 warning 起步，零过杀验证后才晋升 error

## 3. 硬护栏

1. 权威链不变：Product Frame → Design Decisions → SDIR → (Representation) → Implementation → Validation。测量层是判定者，不是决策者；它永不修改产物，只产出收据
2. 声明分层不可换算（PRAX-P-009）：deterministic / assistive / empirical 一层通过不蕴含另一层；`skipped` 不是 `passed`；未运行不是 skipped（skipped 必须携带 reason）
3. 测量能覆盖的，attestation 不许冒充：validator 对映射表内的 check，无测量收据的 empirical pass 一律 EXPAND（缺失证据），收据 fail 却声明 pass 一律 BLOCK
4. 检查先 advisory 后 blocking：每条新测量检查默认 warning，在 golden 案例上验证零过杀后才晋升 error（晋升动作 = 改 catalog 常量 + 变更记录；archify standard→showcase 同构）
5. 诊断可执行：收据的 `supported_fixes` 只列真实可操作的修复方向；无法分类的内部失败显式 `status: skipped` + reason，绝不猜修复
6. 收敛是纪律：修复以 open-findings 创新低为唯一前进依据；连续两轮无改善 → REVIEW + 如实上报未决项；停滞检测永不锁死门禁（留出口，"路由死锁"教训）
7. 存量兼容：持久化的 0.1 会话按原行为恢复；0.2 义务只约束新建 full-chain 会话；轻链（visual_polish / defect_fix / modify_surface 的 sdir_delta）完全不动
8. 词汇表治理：JTBD 动词、对象类型、表达原语全部作为**版本化常量表**进代码（REALIZATION_PROVIDERS 先例）；新增词条须过非视觉模态测试（D8 边界守护的治理用法）
9. **人审位于机器门禁下游**：任何阶段请求人类审查前，runtime 计算的 readiness 块必须全绿或如实标注未就绪项（§5.7）；人审只裁决机器不可判定层，永不用于捕捉机器能查的失败

## 4. 总体架构：18 步链 ↔ 现有门禁映射

研究文档 §34 的 18 步链是语义模型，不是门禁清单。映射到现有骨架（不加新门禁）：

```text
① Product Intent ② User/JTBD ③ Product Object ④ Task Model
        → design_frame（product-frame.yaml 扩展：jtbd / primary_object / task_model）
⑤ Information Shape ⑥ Representation Architecture ⑦ IA ⑧ Priority/Disclosure
        → design_context（已有 density_intent/risk）+ design_decide（design-decisions.yaml
          扩展：information_shape + representation portfolio + rejected）
⑨ Interaction Grammar ⑩ State Ownership ⑪ Visual Hierarchy Intent ⑫ Complexity Budget ⑬ SDIR
        → design_sdir（screen.sdir.yaml 0.2：interaction / state_ownership /
          complexity_budget / acceptance；visual hierarchy 保持 assistive，不结构化进 SDIR）
⑭ Capability/Runtime Binding → design_reconcile / design_realize（不动）
⑮ Implementation → design_prepare_implementation（compiled context 增新段）
⑯ Validation → design_validate（测量收据集成 + 收敛协议 + 新 deterministic 检查）
⑰ Browser/User Evidence → prax-measure 收据 + 现有证据链
⑱ Evolution Memory → corrections.yaml（不动）+ 检查目录单调晋升机制
```

## 5. 组件 A：产物测量层

### 5.1 新包 `packages/prax-measure/`

第一个新包。职责唯一：对运行态页面执行浏览器测量并产出收据。模式直接继承 `apps/prax-wizard/evidence/wizard-checks.mjs`（spawn `vite preview` + Playwright chromium + 逐条 check + 截图），泛化为：

- `src/receipt.ts`：MeasurementReceipt zod schema（§5.2）、收据写盘（原子写，与 artifact-store 同模式：临时文件 + rename）
- `src/checks/*.ts`：每条目录检查一个文件，统一签名 `(page, viewport) → CheckOutcome`
- `src/runner.ts`：编排——启动/复用服务、按 viewport_matrix 逐视口跑目录、收集截图到 `validation-evidence/`、计算每张截图 sha256 写入收据、汇总 summary
- CLI 入口 `bin/prax-measure.mjs`：`node bin/prax-measure.mjs --app <appDir> --out <sessionDir> --viewports 1280x860,1440x900[,390x844]`；退出码：0 = 无 error 级 fail，1 = 有 error 级 fail，2 = 环境失败（浏览器不可用等，收据 status skipped + reason）
- 依赖：playwright（仓库已有），不引入其他运行时依赖

### 5.2 测量收据 schema（定死）

```yaml
receipt_version: "0.1"
tool: { name: "prax-measure", version: "<semver>" }
target: { app_root: "<string>", base_url: "<string>", build_ref: "<string|null>" }
run_at: "<iso8601>"
viewport_matrix: [{ width: 1280, height: 860, label: "desktop" }]   # min 1
checks:                                                              # min 1
  - id: layout.overflow                  # ∈ §5.3 目录
    status: pass | fail | skipped        # skipped 必带 reason
    severity: warning                    # 运行时刻生效档：warning | error（来自 catalog 常量）
    subject: "<选择器/区域描述；fail/skipped 必填>"
    measured: { }                        # 实测值，如 { overflow_px: 14, viewport: "1280x860" }
    threshold: { }                       # 阈值，如 { max_overflow_px: 0 }
    evidence_refs:                       # 相对 session 目录路径，全部位于 validation-evidence/
      - { ref: "validation-evidence/overflow-1280.png", sha256: "<64hex>" }
    supported_fixes: ["<可操作修复方向>"]  # 可为空数组；不许编造
    reason: "<status=skipped 时必填>"
summary: { pass: <int>, fail: <int>, skipped: <int>, warnings: <int> }
```

zod 常量：`MeasurementReceiptSchema`（prax-validator `contracts.ts` 持有，prax-measure 与 runtime 共用同一 schema 源——防漂移的关键：写收据的和验收据的用同一份 schema）。schema 层即强制 `evidence_refs[].ref` 前缀为 `validation-evidence/`（zod refine）；`tool.version` 刻意为 NonEmpty 而非 semver 约束。

### 5.3 检查目录 v0（定死；全部默认 warning 档）

| id | 测量内容 | 阈值（measured/threshold 字段） | 晋升 error 的判据 |
|---|---|---|---|
| `layout.overflow` | 页面级横向溢出 + 元素级内容溢出 | `scrollWidth ≤ innerWidth`；元素 `scrollWidth > clientWidth + 1`（1px 取整容差）计数 = 0 | 全部可运行 golden app 零误报（当前 landing/dashboard/wizard） |
| `layout.responsive_collision` | 每视口可见交互元素两两重叠检测 | 重叠对数 = 0（豁免：父子包含、显式 overlay 角色） | 全部可运行 golden app 零误报 |
| `text.truncation` | 可见文本节点被裁切且无省略意图标记 | 计数 = 0（豁免：`.truncation-intended` 或 title 属性承载全文） | 全部可运行 golden app 零误报 |
| `a11y.contrast` | 可见文本对比度 | WCAG 2.2 AA：正文 ≥ 4.5、大字 ≥ 3.0；报告失败对及实测比值 | 直接 error 档出生（规范义务，无过杀风险） |
| `a11y.focus_order` | Tab 序与阅读序一致 + 焦点可见 | 焦点 indicator 非 none/0px；跳变报告 | 全部可运行 golden app 零误报 |
| `a11y.target_size` | 交互目标尺寸 | ≥ 24×24 CSS px（WCAG 2.2 AA 2.5.8）；豁免：句内链接、等效备选控件 | 直接 error 档出生 |
| `type.min_projected_size` | 主内容区文字计算字号 | ≥ 12px（advisory） | 永不默认 error；与密度意图联动的阈值细化延后（runner 无密度输入通道，见 §12 决策 11） |

目录治理：新增检查 = catalog 常量加一行 + 检查文件 + golden 零误报验证 + spec 修订；删除/改阈值走同一路径。**目录只允许单调增长检查 id，语义变更必须新 id**（archify "门禁计数单调上升"机制）。

### 5.4 validator 集成（反自证的机器闭环）

`packages/prax-validator/src/contracts.ts`：

- `ValidationEvidenceItemSchema` 增可选字段 `measurement_receipt: NonEmpty`（相对 session 目录路径，前缀必须 `validation-evidence/`）
- 新增映射表常量 `CHECK_MEASUREMENT_MAP: Record<string, string[]>`（validator check id → 测量目录 id 列表）：
  - `readability` → `[a11y.contrast, type.min_projected_size]`
  - `keyboard` → `[a11y.focus_order]`
  - `regression_check` → `[layout.overflow]`（defect_fix 轻链的最小回归面）
  - `untouched_surface_regression` → `[layout.overflow, layout.responsive_collision]`
  - 其余 check 不列入表中；查找语义为**缺键 ≡ 空映射**（不强制）

`packages/prax-validator/src/artifact-evidence.ts`（新文件），评估期对每个 evidence item 执行：

1. `measurement_receipt` 存在时：generalized `verifyEvidenceFile`（见 §5.5）验证存在性/包含性（文件不可读、为空或越界 → EXPAND `EVIDENCE_FILE_INVALID`）→ 解析 `MeasurementReceiptSchema`（失败 → BLOCK `MEASUREMENT_RECEIPT_INVALID`）→ 对收据内每个 `evidence_refs` 重算 sha256 并与收据声明值比对（不一致 → BLOCK `EVIDENCE_DIGEST_MISMATCH`）
2. 交叉比对：收据中 `status=fail` 的检查，若其目录 id 映射回当前 claimed `pass` 的 check → BLOCK `VALIDATION_MEASUREMENT_CONTRADICTION`
3. 强制覆盖：`CHECK_MEASUREMENT_MAP[check_id]` 非空且 outcome=pass 的 item 必须携带覆盖全部映射 id 的收据，缺失 → EXPAND（缺证据，`MEASUREMENT_RECEIPT_MISSING`）
4. skipped 的诚实出口：收据中 `skipped` 且带 reason 的检查**满足覆盖要求**（证据通道被诚实行使），但对应 finding 只能标记 `attested` 并记 warning（"测量不可用，自证已被如实降级标注"）——skipped 永不显示为 measured，也永不直接导致 PASS；skipped 蔓延（>50% 目录 skipped）→ REVIEW 并要求人工确认环境。此规则保证无可测量运行目标（如纯逻辑修复）的会话不会死锁在覆盖要求上，同时不自欺

**声明分离落点**：评估输出的 `ValidationFinding` 增 `provenance: "measured" | "attested"` 字段——measured = 有核验收据支撑；attested = 自证。报告层如实分列，attested 永不显示为 measured。

### 5.5 证据文件验证泛化（runtime）

`packages/prax-runtime/src/realization.ts` 的 `verifyEvidenceFile(sessionDirectory, ref)` 泛化为 `verifyEvidenceFile(sessionDirectory, ref, allowedPrefix = "rep-evidence/")`；现有调用点行为不变（默认参数）；validator 集成处传 `"validation-evidence/"`。函数移入 `artifact-store.ts` 或新 `evidence-files.ts`（实现时择一，以不破坏现有导出为准），realization.ts 重导出保持兼容。

### 5.6 收敛协议（runtime/validator 交界）

- `session.yaml` 增 runtime 自有字段 `validation_loop: { history: [{ evaluated_at, open_findings }] }`（每次非 PASS 评估追加；schema 进 contracts.ts DesignSessionSchema，默认 `{ history: [] }` 兼容存量）
- 规则：评估时计算 open_findings（fail + inconclusive 计数）；**首次非 PASS 评估建立基线，不计入"无改善"**；之后每次非 PASS 评估若 open_findings ≥ 历史最小值记一次无改善；**连续两次无改善（即最早发生在第 3 轮非 PASS 评估）**→ 评估 status 降为 REVIEW，code `VALIDATION_CONVERGENCE_STALLED`，message 要求如实上报未决 findings 清单；**不停滞锁门**——后续 validate 调用照常受理，停滞事件入 session warnings
- COMPLETE 判据不变（PASS + 零缺失证据，service.ts 现有语义）

### 5.7 迭代环路与审查准入标准（Loop Contract）

原型稿（representation draft）与最终实现代码都不是一次成型的产物——两者共用同一份环路契约。本节的立场：迭代是流程的一等公民，但**人审永远位于机器门禁的下游**；Agent 必须先达到客观标准，才许请人审查。

**两类环路，同一契约**：

1. **机器门禁环（Agent 侧）**：产出候选 → 跑门禁（schema / 语义 / 测量收据）→ 按诊断修复 → 重跑。前进度量 = 客观失败计数创新低；停滞 = 连续两轮无改善 → 停机并如实上报未决诊断。载体分工（定死）：**validate 环的停滞由 runtime 机器追踪**（§5.6 的 `validation_loop`）；**representation draft 环复用同一停滞语义，但由 Agent 侧纪律承载**（作为指令注入 compiled context，runtime 不做机器追踪——ADR-003 的人审轮次记录已是其证据形态）。
2. **人审环**：人审反馈（representation review rounds / 最终感知评审）→ 回到机器门禁环重跑。**人审改动产物后，先前全部机器证据失效**——收据陈旧判定见 R3，强制重新测量与验证（archify "If visual review changes the candidate, validation and delivery must run again" 同构）。

**审查准入标准（review-readiness，runtime 计算，Agent 不可自报）**：

`design_validate` 评估输出与 representation 人审请求必须携带 runtime 计算的 `readiness` 块：

```yaml
readiness:
  deterministic_passed: <bool>         # 全部适用 deterministic 门禁 PASS
  measurement:
    receipt_ref: <path | null>
    error_failures_open: <int>         # error 档未决失败数
    warning_dispositions:              # warning 档失败逐条处置，不许裸奔
      [{ check_id, disposition: accepted | deferred, reason: <NonEmpty> }]
  convergence: { stalled: <bool>, unresolved: [<findings 清单>] }
  evidence_current: <bool>             # 收据不陈旧（R3）
  claims: { measured: [...], attested: [...], skipped: [...] }   # 三层如实分列
```

规则（定死）：

- R1 `deterministic_passed = false` → 不得请求人审/完成：评估降 REVIEW，码 `REVIEW_NOT_READY`
- R2 `error_failures_open > 0` → 同上；warning 档失败必须带 disposition 才不算未决
- R3 **收据陈旧回边**：receipt `run_at` 早于 `screen.sdir.yaml` 或 `implementation-brief.yaml` 的最新修改时间（runtime 按文件 mtime 比较）→ 该收据不计覆盖 → EXPAND `MEASUREMENT_RECEIPT_STALE`。这是人审环回边的强制执行点：人改了产物，旧证据自动失效
- R4 `convergence.stalled = true` → readiness 不判全绿；`convergence.unresolved` 清单**由 runtime 从评估 open findings 填充**（Agent 不得自报、不得删减）——停滞时的如实上报由数据载体强制，不靠 Agent 自觉
- R5 readiness 全绿才可进入人审或请求完成；人审只裁决机器不可判定层（感知、品味、产品适配）——**人不被抓来查机器能查的东西**

**轮数不设硬上限**（有依据的分歧，定死）：archify 的 `correction_rounds ≤ 2` 存在于其每轮交付都是完整冻结周期；我们的修复轮成本低，且停滞规则（每轮必须创新低）本身自限——N 轮最多净修复 N 个 findings。v0 以停滞规则为唯一收敛治理，记为与 archify 的刻意分歧点。

**声明分离的完成形态**：evaluation 输出的 findings 携带 `provenance`（二值：measured / attested——skipped 检查的对应 finding 只能标记 attested，§5.4 已定死）；`readiness.claims` 在检查层另列 skipped 清单，三层如实分列——这是本系统的 handoff receipt 对应物（archify 的固定词表交接收据：`browser_evidence` / `visual_review` / `correction_rounds` 分层不可换算）。

**figma_first 路径的既有准入不动**：representation 人审的准入 = draft 覆盖检查 PASS + SDIR digest 绑定（ADR-003），本契约向其追加的只有 R3 的陈旧语义（审后改动 → digest 失配 → 既有 `REALIZATION_SDIR_DRIFT` 已覆盖）。

## 6. 组件 B：中间状态结构化

### 6.1 SDIR 0.2（`packages/prax-sdir/src/contracts.ts`）

判别联合：`SdirSchema = z.discriminatedUnion("version", [SdirV01Schema（现有原样）, SdirV02Schema])`。0.2 在 0.1 基础上增改（全部位于 `screen` 下）：

```yaml
version: "0.2"
screen:
  # —— 0.1 已有字段保留；archetype.pattern_ref 在 0.2 降为 optional ——
  user_job:                              # 必填
    verb: <JTBD_VERBS 之一>              # scan|locate|navigate|compare|monitor|create|edit|manage|
                                         # decide|transact|communicate|explore|learn|explain|understand|
                                         # control|troubleshoot|complete|review（19 个，含首批增补 understand）
    target: <NonEmpty>
    success: <NonEmpty>
  primary_object:                        # 必填
    type: <OBJECT_TYPES 之一>            # document|item|entity|record|event|metric|location|
                                         # relationship|timeline|media|workflow|conversation|code|
                                         # canvas_object|dataset|change_set
    label: <NonEmpty, 可选>
  information_shape:                     # 必填块；前五个必填，其余带默认
    cardinality: one | few | many | unbounded
    relationality: low | medium | high
    hierarchy: low | medium | high
    temporality: low | medium | high
    density: low | medium | high
    dimensionality: low | medium | high        # 默认 medium
    spatiality: none | conceptual | physical   # 默认 none
    volatility: low | medium | high            # 默认 medium
    uncertainty: low | medium | high           # 默认 low
    comparison_need: none | optional | required # 默认 none
  representation:                        # 必填；与 design_decide 的决策一致（交叉校验见 §6.3）
    primary: { type: <REPRESENTATION_PRIMITIVES 之一>, reason: <NonEmpty> }
    supporting: [{ type, reason }]       # max 4
  priority:                              # 必填；引用 region id（引用完整性校验）
    primary: [<region id>]
    contextual: [<region id>]
  interaction:                           # 带默认的语法块（§24 交互语法 + §36 示例）
    preview: none | hover | focus        # 默认 none
    inspect: none | select | open        # 默认 select
    navigate: none | drill | open        # 默认 none
    locate: none | search | filter       # 默认 none
  state_ownership:                       # 必填，min 1（§25 State Ownership 落地）；owner ∈ regions ∪ {session, url}
    - { state: selection | preview | inspector | viewport | query | mode, owner: <region id|session|url> }
  complexity_budget:                     # 可选块；十计数器均 int ≥ 0
    permanent_panels: 1
    permanent_primary_actions: 3
    modes: 0
    state_owners: <int>
    navigation_levels: <int>
    persistent_filters: <int>
    new_semantic_concepts: <int>
    keyboard_contracts: <int>
    mobile_conflicts: <int>
    permanent_surfaces: <int>
  acceptance: [<NonEmpty>]               # 必填，min 1——验收契约，验证计划的语义输入
```

词汇表常量：`SDIR_VOCAB = { version: "2026-09", jtbd_verbs: [...19], object_types: [...16], representation_primitives: [...22 原语：list|table|grid|cards|document|feed|thread|chart|map|timeline|calendar|graph|tree|canvas|diagram|architecture|media|form|wizard|search_results|code_editor|chat] }`，置于 prax-sdir `vocab.ts`（新文件）。词汇演进 = 常量表版本 bump + spec 修订；词条准入须过非视觉模态测试（护栏 8）。

出处与首批增补裁决（定死）：字段集是研究文档 §36 示例的超集；information_shape 的取值枚举为本 spec 定义（研究 §3.3 只定义变量、未定义取值），与 §36 示例值兼容。词表 v2026-09 即带两条首批增补：JTBD 动词增补 `understand`（研究 §36/§43 示例已使用但 §3.1 原表未收，→19）、表达原语增补 `architecture`（§36 示例已使用但 §9.1 原表未收，→22）。增补理由与非视觉模态测试记录随常量表入库。

边界守护与 render-leak lint：现有 FORBIDDEN_KEY/FORBIDDEN_VALUE 递归遍历自然覆盖新字段；**必须新增测试**：在新字段内埋 pixel/css/class 词（如 `representation.primary.reason` 含 "flexbox"）断言被拒。

兼容性：`sdir_delta` 保持 0.1 不动；0.1 会话恢复行为不变；`design_sdir` generate 模式在 Phase 2 上线后默认产出 0.2。

### 6.2 design_frame 扩展（product-frame.yaml 0.2）

ProductFrame 增三个可选→0.2 必填块（版本化同 SDIR 模式）：

```yaml
jtbd: { verb: <JTBD_VERBS>, target: <NonEmpty>, success: <NonEmpty> }
primary_object: { type: <OBJECT_TYPES>, label: <NonEmpty?> }
task_model:
  frequency: low | medium | high
  reversibility: reversible | costly | irreversible
  consequence: low | medium | high
  expertise: novice | mixed | expert
```

注（定死的裁剪声明）：`task_model` 是研究文档 §3.4 Operation Shape 八变量的架构师裁剪——弃 `batchability` / `context_retention` / `collaboration` / `latency`（当前无门禁消费场景，待真实需求再进，符合 D9 "词汇表膨胀" 风险纪律）；四个保留字段的枚举值为本 spec 定义。

gate-validation 新增：`design_frame` 0.2 会话缺任一块 → EXPAND `FRAME_PRODUCT_MODEL_INCOMPLETE`。

### 6.3 design_decide 扩展（design-decisions.yaml）

DesignDecisions 载荷增：

```yaml
information_shape: <同 §6.1 结构>          # 0.2 会话必填
representation:
  primary: { type, reason }
  supporting: [{ type, reason }]           # max 4
  rejected: [{ option, reason }]           # 沿用现有 rejected_alternatives 语义，针对表达层
  justification_vs_shape: <NonEmpty>       # 仅当 §6.3 SHELL_TERMS 检测被触发时必填
```

出处与性质（定死）：研究文档 §31.6 将 Dashboard/Card/Tab/Modal 并列为负知识对象；其中 `cards` 是 §9.1 原语，`dashboard` 是 §9.2 组合，`tabs` 是 §18 披露机制，`modal` 是 §10/§52-Q9 的 detail surface 机制——四者只有 `cards` 可能出现在 `representation.primary.type` 枚举里，因此检测机制必须覆盖文本层。

检测机制（定死）：`SHELL_TERMS = ["dashboard", "cards", "tabs", "modal"]`（常量版本化，随 SDIR_VOCAB 治理）。触发条件 = 任一成立：

1. `representation.primary.type === "cards"`；
2. 对以下字段的拼接文本做**大小写不敏感的词边界匹配**命中任一 SHELL_TERMS 词元（含固定中文同义词 `仪表盘|卡片|标签页|模态`）：`representation.primary.reason`、`representation.supporting[].reason`、`representation.rejected[].option`、`major_choices[].*` 自由文本。

触发即要求 `justification_vs_shape` 必填且引用 ≥1 个 information_shape 变量名（cardinality/relationality/hierarchy/temporality/density 等字面量出现于文本即判定引用成立）。

新增 gate-validation 规则：

| 规则 | 结果 | 码 |
|---|---|---|
| 0.2 会话缺 information_shape / representation 块 | EXPAND | `DECISION_SHAPE_MISSING` |
| SHELL_TERMS 检测被触发（§6.3 机制）且 justification_vs_shape 未引用任一 information_shape 变量名 | REVIEW | `DECISION_DEFAULT_SHELL_UNJUSTIFIED` |
| representation.rejected 为空 | WARN（首版） | `DECISION_NO_REJECTED_REPRESENTATION` |
| decisions.representation.primary.type 与后续 SDIR 0.2 representation.primary.type 不一致 | REVIEW（sdir 门禁交叉校验） | `SDIR_REPRESENTATION_DRIFT` |

### 6.4 context-compiler 与 prepare 集成

compiled-context.yaml 增三段（数据全部来自已门禁产物，编译不新增语义）：`representation`（portfolio + rejected）、`state_ownership`、`acceptance`；implementation-brief 增对应引用行。修正回归义务注入逻辑不动。

### 6.5 validator 新 deterministic 检查（评估 SDIR/决策产物，零浏览器）

加入 UNIVERSAL_CHECKS（kind: deterministic，evidence_required: false；仅对 0.2 会话装配，0.1 会话不装配——兼容纪律）：

| id | requirement | 失败语义 |
|---|---|---|
| `representation_decided` | representation.primary 存在且 reason 非空 | fail |
| `state_ownership_declared` | selection 与 preview 两态均有 owner | fail |
| `acceptance_contract_present` | acceptance ≥ 1 条 | fail |
| `complexity_budget_declared` | complexity_budget 块存在（值不评） | warning |

CHECK_PROFILE 增四行映射（profile: `semantic_integrity`，facet: `semantic`）。

## 7. 组件 C：知识资产重组（Phase 3）

### 7.1 knowledge.yaml 0.2 schema

`version: "0.2"`；entry 增改字段（现有字段全保留）：

```yaml
- id: PAT-CANVAS-WORKSPACE
  asset_class: pattern            # principle|heuristic|pattern|profile|product_object|
                                  # representation|composition|interaction_pattern|validation_asset|myth
  stability: A                    # A|B|C（研究文档 §48 三级）
  trigger_conditions:             # 六面；跨面 AND、面内 OR（机制引自 D7；面名与取值按 Prax 词表适配——
                                  # D7 原面 domain_entities/component_types，density/phase 枚举不同）
    task_type: [inspect, trace]                    # ∈ 19 JTBD 动词
    object_type: [relationship, dataset]           # ∈ 16 对象类型（§6.1）
    representation: [canvas, graph]                # ∈ 22 表达原语（§6.1）
    density: [medium, high]                        # low|medium|high（与 SDIR density 同词表）
    platform: [web_desktop]                        # web_desktop|web_mobile（沿用现有 scope 词表）
    phase: [decision, validation]                  # framing|context|routing|decision|sdir|validation
  evidence: { authority_initial: B, source_version: "<str?>", source_date: "<date?>", review_by: "<date>" }
  # authority_initial ∈ N|A|B|C|D|E = D2/D5 的来源权威级，≠ 证据强度；GRADE 式动态升降级本版不建（D9 机制延后）
  # myth 条目专属：id 以 myth- 起头；refutation: <NonEmpty>；correct_ref: <NonEmpty>
```

六面词表（定死，随 SDIR_VOCAB 同版本治理）：`task_type` = 19 JTBD 动词；`object_type` = 16 对象类型；`representation` = 22 表达原语；`density` = low|medium|high；`platform` = web_desktop|web_mobile；`phase` = framing|context|routing|decision|sdir|validation。

schema 落点（定死）：knowledge 0.2 同时改**两层**——压缩 seed（`KnowledgeSeedSchema`，store.ts）与展开后完整条目（`KnowledgeEntry`，contracts.ts，含 disclosure L0–L3），以及两处硬编码 version 字面量（contracts.ts 与 store.ts）。迁移覆盖 disclosure 层，不只是 seed 层。

### 7.2 路由升级（prax-router）

在现有 hardScopeMismatch 硬过滤 + 确定性打分之上做增量改动：trigger_conditions 六面匹配位数作为 lex specialis 加权分（D7 冲突裁决的运行时实现；面名与词表按 §7.1 适配）。myth 排除默认路由**已是现状**（router 现跳过 type=myth / product_evidence）——本版将其从 type 层迁到 asset_class 层并保持行为不变；myth 仅在 design_decide 默认外壳校验与显式 inspect 时浮现。

23 条存量条目迁移：主源是结构化 `scope` 字段（task_type/platform/density/phase），自由文本 `triggers` 仅辅助；type → asset_class 映射 = principle→principle、heuristic→heuristic、pattern→pattern、platform_convention→profile（**非直译**，无同名项）；lifecycle.status → stability：stable → A/B 逐条人工标注，现存 3 条 reviewed → B。迁移脚本轮出 + 人工确认清单（`data/stability-assignments.yaml`）入库——人机交接步骤见 plan K1。

### 7.3 负知识种子（定死首批 11 条 myth）

研究文档 §48C 全量 10 条 + `myth-card-grid-default`（§5 与 §4.1：Cards/Grid 在 120 样本主表达中仅占 4.2%，且被通用 Agent 明显过度使用）：myth-left-nav-best、myth-dark-more-professional、myth-max-n-actions、myth-fixed-panels-best、myth-canvas-needs-minimap、myth-more-disclosure-better、myth-whitespace-more-premium、myth-all-temporal-timeline、myth-all-relational-graph、myth-dashboard-default-home（§48C 末条；§13 展开）、myth-card-grid-default（§5/§4.1）。每条 refutation 引用研究文档对应章节；**refutation 反驳的是其作为通用默认的合法性（全称量词），不是模式在适用域内的价值**——§48C 的语义是"不可泛化"，不是"已证伪"。

决策点浮现映射（定死，随 SHELL_TERMS 同表治理）：

```ts
SHELL_MYTH_MAP = {
  dashboard: "myth-dashboard-default-home",
  cards: "myth-card-grid-default",
  tabs: "myth-more-disclosure-better",   // §12：互斥标签强迫工作记忆维持比较状态
  modal: "myth-more-disclosure-better",  // §10/§52-Q9：detail surface 应由 context retention 推导
}
```

### 7.4 语料扩容

研究文档 Appendix A 的 120 样本矩阵是种子语料；每条新资产过 Appendix C 18 问收录规程 + 稳定性分级随行。本 Phase 只建机制与首批，不追求覆盖率。

## 8. 组件 D：演进环与实证基准（Phase 4，框架级）

1. **检查晋升回路**：测量失败 → correction（现有 design_correct）→ 若同类失败在 ≥2 项目复发 → 提案新测量检查（catalog 准入流程 §5.3）→ warning 档出生 → golden 零过杀 → error 档。这是"真实失败 → 命名门禁"的机器化，演进环复利的对象从流程知识扩展到产物质量
2. **实证基准**：15 User Jobs × 10 Information Shapes 矩阵（研究文档 §43 清单原样）；A/B 双臂（裸 Agent vs Agent+Prax，§44 的 13 项指标）；inter-rater 双编码（§45 重点字段清单）；pattern saturation 每 20 样本新增率台账（§46）
3. **ECP cognition workspace 试点**：golden case #6，按研究文档 §40–41 的 Representation Architecture 推导（Canvas + Change Timeline + Search + Inspector 组合，非 universal shell）；作为新链端到端验收
4. Phase 4 的详细 plan 在 Phase 1–3 门禁通过后 replan——本 spec 不定其任务级内容（诚实边界：实证协议需要前三个 Phase 的测量数据校准）

## 9. 校验规则总表（新增错误码）

| 码 | 位置 | 语义 |
|---|---|---|
| `MEASUREMENT_RECEIPT_INVALID` | artifact-evidence | 收据 schema 解析失败（BLOCK） |
| `EVIDENCE_FILE_INVALID` | artifact-evidence | 收据声明的证据文件不可读/为空/越界（EXPAND） |
| `EVIDENCE_DIGEST_MISMATCH` | artifact-evidence | 收据声明 sha256 与重算不符（BLOCK） |
| `VALIDATION_MEASUREMENT_CONTRADICTION` | artifact-evidence | 收据 fail 与声明 pass 冲突（BLOCK） |
| `MEASUREMENT_RECEIPT_MISSING` | artifact-evidence | 映射表要求的收据缺失或部分覆盖（EXPAND） |
| `MEASUREMENT_RECEIPT_STALE` | artifact-evidence | 收据早于 SDIR/brief 最新修改，陈旧不计覆盖（EXPAND，§5.7 R3） |
| `REVIEW_NOT_READY` | service/validate | readiness 未达标即请求人审/完成（REVIEW，§5.7 R1/R2；R4 停滞使 readiness 不绿） |
| `VALIDATION_CONVERGENCE_STALLED` | service/validate | 基线后连续两轮无改善（REVIEW，不锁门，§5.6） |
| `FRAME_PRODUCT_MODEL_INCOMPLETE` | gate-validation | 0.2 frame 缺块（EXPAND） |
| `DECISION_SHAPE_MISSING` | gate-validation | 0.2 决策缺 shape/representation（EXPAND） |
| `DECISION_DEFAULT_SHELL_UNJUSTIFIED` | gate-validation | 默认外壳触发且未论证（REVIEW，§6.3 机制） |
| `DECISION_NO_REJECTED_REPRESENTATION` | gate-validation | 无表达层 rejected（WARN） |
| `SDIR_REPRESENTATION_DRIFT` | gate-validation/sdir | 决策与 SDIR 主表达不一致（REVIEW） |

## 10. 代码落点

```text
packages/prax-measure/                 # 新包（Phase 1）
├── package.json                       # 仅依赖 playwright（仓库已有）+ prax-validator（schema 共用）
├── bin/prax-measure.mjs               # CLI：--app --out --viewports
└── src/
    ├── receipt.ts                     # 收据写盘（原子写）
    ├── runner.ts                      # 编排：服务启动/视口矩阵/截图/sha256
    └── checks/                        # 每检查一文件，统一签名
        ├── layout-overflow.ts
        ├── layout-responsive-collision.ts
        ├── text-truncation.ts
        ├── a11y-contrast.ts
        ├── a11y-focus-order.ts
        ├── a11y-target-size.ts
        └── type-min-projected-size.ts
packages/prax-validator/src/
├── contracts.ts                       # MeasurementReceiptSchema、evidence item 扩展、
│                                      #   CHECK_MEASUREMENT_MAP、finding provenance
├── artifact-evidence.ts               # 新：收据验证 + 交叉比对 + 覆盖强制
└── validator.ts                       # 4 条新 UNIVERSAL 检查 + 装配条件 + CHECK_PROFILE
packages/prax-runtime/src/
├── evidence-files.ts                  # verifyEvidenceFile 泛化（或留 realization.ts 重导出）
├── gate-validation.ts                 # frame/decide/sdir 新规则
├── context-compiler.ts                # representation / state_ownership / acceptance 段
├── corrections.ts                     # 不动
├── contracts.ts                       # DesignSession.validation_loop
└── lifecycle-policy.ts                # 不动（本设计不加门禁）
packages/prax-sdir/src/
├── contracts.ts                       # SdirV01/SdirV02 判别联合
├── vocab.ts                           # 新：SDIR_VOCAB 版本化词表
└── engine.ts                          # render-leak lint 不变；generate 默认 0.2
packages/prax-mcp/src/
├── schemas.ts                         # frame/decide/sdir/validate 载荷扩展（client schema 拍平，
│                                      #   AB-001 anyOf 教训）
├── service.ts                         # validate 集成 + 收敛追踪
└── server.ts                          # 工具描述更新；不加新工具
packages/prax-knowledge/
├── data/knowledge.yaml                # 0.2（Phase 3）
└── src/schema.ts                      # 0.2 entry schema + 迁移
packages/prax-router/src/              # trigger_conditions 匹配（Phase 3）
tests/                                 # 新增测试文件见 plan；golden fixture 重放模式复用
```

## 11. 测试策略与阶段门禁

**全程纪律**：TDD（先写失败测试）；`npm test`（build + vitest）全绿是任何提交的前置；每 Phase 结束跑 golden fixture 重放回归；测量层自身的误报率用全部可运行 golden app（当前 landing / dashboard / wizard 三个构建；pricing 与 architecture-canvas 无可运行构建，不作校准集）校准。

| Phase | 测试门禁（完成定义） |
|---|---|
| 0 文档 | ADR/spec/plan 子代理审查通过并修订；研究文档与本文档集入库（用户执行 git 操作） |
| 1 测量层 | 新测试全绿；runner 在全部可运行 golden app（当前 landing / dashboard / wizard）真实构建上产出合法收据；收据重放进 fixture 测试；**矛盾案例演示**：伪造 fail 收据 + 声明 pass → BLOCK；skipped≠pass（skipped 计 attested + warning）断言；收敛停滞案例（基线 + 连续两轮无改善，共三轮非 PASS）→ REVIEW 且门不锁；readiness 块全绿方可 COMPLETE（§5.7） |
| 2 中间状态 | SDIR 0.2 往返 + 0.1 存量恢复；render-leak 新字段渗透测试；decide/frame 新规则矩阵；SDIR_REPRESENTATION_DRIFT 交叉校验；compiler 新段 |
| 3 知识资产 | 23 条迁移往返；trigger 六面匹配矩阵；myth 默认路由排除；负知识种子在 decide 校验生效 |
| 4 实证 | 基准矩阵可运行；A/B 协议文档评审；ECP 试点 golden 固化 |

**文档同步**（每 Phase 的收尾任务，写进 plan）：architecture.md（工具描述、artifact 清单增 validation-evidence、概念边界增"测量/声明分离"）；README.md（包清单 + 能力段）；phase report（keep/revise/remove/defer 台账更新）；principle-registry.md（候选原则走既有晋升规则，本 spec 不直接晋升任何条目）。

## 12. 决策记录

1. **扩展 decide/sdir，不加新门禁**：PRAX-P-024（MCP surface 稳定）；18 步链是语义模型而非门禁清单；轻链税不变
2. **不加新 MCP 工具**：测量收据是证据，走 design_validate 证据通道；runner 由执行 Agent 本地调用
3. **像素自由由"资产 + 测量"收走，不由编译器收走**：D8 的 ADR 定位与 archify 的结构性质量两全；通用 UI 不可全量编译
4. **收据 schema 单源**：prax-validator contracts 持有，prax-measure 引用——写验收据同 schema，防漂移
5. **检查先 warning 后 error**：archify standard→showcase 与 D7 policy-as-code 迁移路径同构；a11y 规范义务类（contrast / target_size）因零过杀风险直接 error 档出生
6. **收敛停滞不锁门**：REVIEW 状态 + 如实上报义务，出口保留（figma spec 的"门禁必须留出口"教训）
7. **SHELL_TERMS 校验放 REVIEW 而非 BLOCK**：负知识的确定性边界是"必须论证"，不是"不许用"——研究文档 §48C 明确这些不应写成通用规则
8. **Phase 4 只定框架**：实证协议需 Phase 1–3 测量数据校准，提前定死是过度承诺
9. **myth 条目不路由只浮现**：负知识的消费点是决策校验与显式查阅，默认路由混入会污染正知识排序
10. **存量会话零迁移义务**：0.1 会话行为不变；0.2 义务只约束新会话——与 lifecycle policy v1/v2 判别先例一致
11. **density 联动阈值延后**：runner v0 无会话密度输入通道，`type.min_projected_size` 固定 12px advisory；需要时以 `--density` 或 session 读取机制另行提案（§5.3）
12. **词表首批增补即入库治理**：`understand` 动词与 `architecture` 原语是研究文档自身示例（§36/§43）已使用但原表未收的两条，作为 v2026-09 的首批增补裁决记录在案（§6.1）
13. **迭代环路契约 + 人审准入**：环路是流程一等公民（机器门禁环 + 人审环回边证据失效）；review-readiness 由 runtime 计算、Agent 不可自报；修复轮数不设硬上限，停滞规则为唯一收敛治理——与 archify `correction_rounds ≤ 2` 的刻意分歧已记录理由（§5.7）
