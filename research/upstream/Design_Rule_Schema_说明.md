# 设计规则 Schema 草案说明（D7 配套文档）

- 日期：2026-08-25｜状态：草案评审稿
- 主文件：`Design_Rule_Schema_Draft.yaml`（含 Schema A/B/C 完整字段定义、各 2 条真实规则实例、冲突裁决机制与完整裁决示例）
- 本文档回答三个问题：为什么规则需要 Schema（而非散文）、三个候选 Schema 各自付出什么代价、以及冲突与验证这两个"规则系统的真实难点"如何处理。

---

## 1. 设计目标与约束

设计规则 Schema 的服务对象不是人类读者，而是 AI Coding/Design Agent。这决定了它必须同时满足六个性质，且其中四个性质直接来自已核验的工程证据，而非审美偏好。

**Agent 可读**。规则必须是结构化数据而非散文段落，因为检索基础设施要求"先过滤后检索"：`applies_when`、`scope`、`category` 等字段就是 metadata filtering 的过滤键，这是纯文本 chunking 做不到的能力 [B029]。规则条目应按"检索单元"设计——自包含、带情境、可独立于上下文被理解——而非按"阅读章节"设计。

**可检索与 context 经济**。全量加载在原理上不可行：LLM 对长上下文中部信息的利用呈 U 形曲线下降 [A026]，18 个前沿模型全部随输入变长而性能退化（厂商报告，未同行评审，方向与前者一致）[C031]；Anthropic 的工程立场是"最小高信号 token 集"，知识库超过约 200k token 即必须检索 [B005]。一个数百条规则的知识底座恰好处于这一阈值的边缘并必然越过它，因此 Schema 从第一天起就要支持"只加载当前需要的规则"。

**可执行与可验证**。规则必须标注它能否被机器检查、以什么方式检查。专家系统四十年的教训是：规则引擎只应承载**可判定子集**，把 LLM 能推理的东西硬编码成规则会重演知识获取瓶颈、窄域脆性与维护崩塌 [C019][D003]；而 axe-core 证明了"确定性规则 + 零误报承诺 + 不确定转人工"是设计领域可工业化运行的范式 [B001][D001]。

**可追溯**。每条规则必须能回答"Systemsmith 为什么有这条规则"，证据链为 statement ← rationale ← evidence ← source。归因研究给出的标准是"可归因到已识别来源"而非"看似合理" [A040]，且引用不等于忠实——即使提供了来源，30–50% 的 LLM 陈述缺乏充分引用支持 [A042]，因此来源 ID 必须在规则**生成时**随行携带，而非事后补挂。

**可演进**。authority 是时间的函数：ISO 9241 系列 2024–2025 密集换代、WCAG 3.0 草案一年三变（当前 WD 2026-03-03，watch-only）[N004]。规则必须带版本、owner、复审日期与弃用路径——知识制品的死亡率与其维护机制强相关，与其初始质量弱相关，pattern library 与专家系统都死在没有 owner 与更新流程。

上述约束中有两条是批判性纪律，贯穿全部三个 Schema：其一，每条规则强制标注知识类型（scientific_model / design_heuristic / platform_convention / internet_myth），防止把 Material 的视觉表现当通用原则、把流行当正确；其二，每条规则强制 `does_not_apply_when`——没有反适用条件的规则不得进入 stable 状态，因为 HCI 知识神话的共性不是"错误"而是**边界条件丢失**（7±2 被误用为菜单上限、3-click rule 均属此类）。

---

## 2. 三个候选 Schema 与 trade-off 对比

三个候选不是互斥的三个产品，而是同一份知识内容的三种组织与消费协议。任务书初始设想（id/category/scope/authority/source/statement/rationale/applies_when/does_not_apply_when/conflicts_with/examples/counterexamples/validation）的合理内核被全部保留，并做了三处强化：evidence 从单个 source 升级为 {source_ids, authority_initial, confidence} 结构；scope 细化为 {user_type, task_type, density, platform} 四维；validation 细化为 {method, automatable, procedure} 三要素。

**Schema A：扁平规则条目**。单文件单规则，全部字段平铺。它是三个方案中生成成本最低、diff 最友好、最适合人工审定的形态，天然适合作为知识采集管线的"录入格式"。缺陷同样明确：无分层意味着消费端要么全量加载（撞上 context 经济约束 [A026][C031]），要么把检索与分层完全外包给外部基础设施——条目自身不携带触发语义，"什么时候该用这条规则"这一关键信息游离在 Schema 之外。

**Schema B：三层渐进披露**。直接映射 Anthropic Agent Skills 的工业事实标准：L1 索引（约 100 token 元数据，常驻可枚举）→ L2 正文（<5k token，触发后加载）→ L3 例证与验证档案（按需读取，容量不设限）[B006]；该模式已在 2025Q4–2026Q1 被多家前沿厂商跟进，实测发现成本中位约 80 token/条、正文中位约 2000 token（单一来源，中等置信）[C004][D002]。Schema B 的核心设计是 `trigger_conditions` 的检索语义：task type / domain entity / component type / density / platform / phase 六面组合，匹配逻辑为"跨面 AND、面内 OR"，先 metadata 硬过滤再 hybrid search（BM25 补精确术语、embedding 补语义 [B029]），最后按 scope 匹配精确度排序——这一排序同时是 lex specialis 的运行时实现。`applies_when` 因此一身三职：触发条件、过滤键、冲突裁决的具体性依据。代价是三层一致性维护：L1 的一句话摘要必须是 L2 正文的忠实缩写（入库时做 ALCE 式 entailment 检查 [A041]），trigger 与 applies_when 必须由同一内容源生成，禁止手工双写——否则检索会在规则修订中悄悄失灵。

**Schema C：policy-as-code 分层**。按"可判定性"把规则分成两个物种。machine_checkable 类是声明式条件（match + assert），确定性执行、零误报、不确定转人工、输出 SARIF/JSON 进 CI、每次决策留可回放审计日志——这是 OPA 与 axe-core 已验证的范式 [B028][D006][B001]。judgment_required 类不可编译为布尔判定，表达为结构化评审 rubric：锚点式量表 + 必收集的运行态证据 + 评委协议（成对交换、多评委、定期人类校准）+ 显式人工终裁点。Schema C 是唯一"可直接执行"的方案，但它诚实承认只能覆盖可判定子集：自动化无障碍检测按 issue 量口径覆盖约 57% [C002]（该数字为厂商自研数据，权威级 C，且必须绑定分母引用），LLM 对可用性问题的检测一致性 κ≈0.50 而严重性判断 α≈0 [C006][A017]。规则外情形必须优雅降级到检索 + LLM 推理，并给输出打上 unverified_reasoning 标签，防止推理结果伪装成规则结论。

| 维度 | A 扁平条目 | B 三层渐进披露 | C policy-as-code |
|---|---|---|---|
| 解决的核心问题 | 采集与审定成本 | context 经济性 | 可执行性与 CI 集成 |
| 生成/维护成本 | 低 | 高（每条规则三份一致表述） | 中高（match/assert 需工程化） |
| 检索支持 | 依赖外部索引 | 内建（trigger_conditions） | 不适用（按包加载执行） |
| 可执行性 | 无 | 间接（L3 验证规程） | 直接（lint 子集确定性执行） |
| 主要失效模式 | 全量加载撞上 context 上限 | 三层漂移导致检索失灵 | 过度承诺可判定范围（专家系统覆辙） |
| 对 Agent 的上下文开销 | 全量或零 | ~100 token/条常驻 + 按需 | 仅命中规则的执行结果 |
| 与工业先例的对应 | ADR 式单文件记录 [B003] | Agent Skills [B006] | OPA / axe-core [B028][B001] |

三个 Schema 共享一组与证据分级正交的生命周期字段（draft → reviewed → stable → deprecated），其设计直接借用企业设计系统的组件成熟度模型：分级管可信度，成熟度管生命周期。draft 是单一来源未交叉验证的条目，不进默认检索语料；stable 要求至少两个独立来源收敛；deprecated 条目不删除而是保留索引并标注替代者——防止 Agent 引用死规则，supersedes 链同时保留完整演化历史。这一安排针对的是反复出现的历史死因：pattern library 死于没有嵌入工作流，专家系统死于没有知识获取流水线，而 ISO 标准靠 systematic review 纪律存活。知识条目自身即是需要治理的制品，Schema 把 owner、version、source_version、review_by 设为强制字段，等于把治理义务编码进了数据结构：无 owner 的规则不得入库，超过 review_by 未复审的规则自动命中 staleness 降级域。

---

## 3. 冲突裁决机制详述

冲突处理是规则系统与"原则清单"的分水岭。本设计采用 dim08 给出的分层混合模型，四个机制协同工作，且全部在 YAML 主文件的 `priority_layers` 与 `conflict_resolution` 两节中形式化。

**分层非补偿/补偿混合**。优先级链七层（L0 用户任务/需求 → L1 安全/无障碍 → L2 产品宪法 → L2.5 通用 UX 原则（D3）→ L3 平台惯例 → L4 产品模式 → L5 视觉偏好）。决策科学的证据是：字典序（非补偿）与加权加性（补偿）各有适用域，两阶段混合——先非补偿筛选、后补偿排序——是被验证的折中 [A010][A039]。落到本设计：L0–L2 非补偿，任何视觉偏好的加权总和不得覆盖 WCAG 违规（合规 baseline 为 WCAG 2.2 AA [N005]）；L2.5–L5 允许补偿式打分。补偿区 = L2.5/L3/L4/L5，与 D9 §3.3 一致。纯优先级排序的失效模式是同层内冲突无裁决依据；纯打分的失效模式是安全约束被大量低层偏好"积分兑掉"（补偿泄漏）。L0 另设防滥用条款：确立 user need 只接受 D 级可用性测试证据，PM 主张不构成 need——否则任何需求都可声称是 user need，整条链被顶层架空。

**正交裁决维度**。静态优先级链只有一个维度（lex superior），法学规范冲突理论补充了两个正交维度 [A033][A034]：lex specialis（适用范围更具体的规则优先）映射为 scope 匹配精确度——"专业工具高密度表格"的具体规则覆盖"保持界面简洁"的一般规则，跨级适用但不得突破非补偿层；lex posterior（后法优先）映射为版本时效——WCAG 2.2 覆盖 2.1、HIG 现行版覆盖存档版，其数据基础是每条规则强制携带的 source_version 与 review_by。

**和谐解释优先**。冲突裁决管线的第 0 步不是裁决，而是细化双方 `applies_when` 尝试消解——法学的经验是多数表面冲突是适用条件界定不清的伪冲突 [A033]。只有消解失败才进入裁决，这直接压低了冲突记录的数量膨胀。

**场景化裁决与 DDR**。真实权衡不在原则层抽象裁决，而是落到 ATAM 式场景（source/stimulus/environment/artifact/response/response_measure 六要素）上定位 tradeoff point [A007][D004]。裁决产出 Design Decision Record（ADR 格式：context/decision/status/consequences/supersedes [B003][B002]），裁决本身沉淀为 D 级证据回流知识库。YAML 主文件给出了完整示例：极简主义规则 vs 专业信息密度规则在企业数据浏览器场景的裁决——和谐解释失败（双方适用域真实重叠）→ 层检查（均属补偿层）→ lex specialis 裁决（密度规则的 scope 精确匹配 expert/data_exploration/compact 场景；极简主义规则来源语境为消费级产品，命中 indirectness 降级域）→ 决策"密度规则在该 scope 内优先，极简主义降权而非废除"。同一机制也解释了为什么"批量删除"与"单条删除"对确认弹窗的裁决可以不同：场景化使冲突处理从全局一刀切变为条件规则。

**证据动态分级**。静态 S–E 分级打 GRADE 补丁 [N013][N014][N015]：authority_initial 只是初始级，随后按降级域（陈旧性、间接性、不一致性）与升级域（跨平台收敛、实证支持）动态调整；并刻意分离"证据确定性"与"推荐强度"——authority 高不等于强制推行 [N014]。这一设计的必要性是实测的：八个研究维度在共享同一套分级图例的情况下仍产生四组"同一来源、不同级别"的矛盾，根因正是分级语义中"原始论文是否自动最高级""B/C 边界在哪"两个未定点。

---

## 4. 验证字段设计：四分类与自动化边界

`validation.method` 取四值：lint / heuristic_review / runtime / user_test。这个四分类不是拍脑袋的分法，而是把跨维度量化证据拼合后得到的"自动化地板—中间带—天花板"三段式的操作化。

**lint（地板）**。token 引用合法性、对比度数值、target size、组件属性完备性——可确定性判定，应零误报执行。axe-core 是这一层的工程范式：覆盖 WCAG 2.0–2.2 规则库，承诺零误报，不确定的情形标记为"需人工复核"而非判违规 [B001][D001]。2025–2026 年的 design lint 生态（token 白名单校验、组件合规、SARIF 输出、CI 渐进收紧 warning→error）证明该层在工程上成立 [D005]。但地板的面积有限：自动化无障碍检测按 issue 量口径覆盖约 57.38%，按 SC 条数口径仅约 30–31% [C002]——三个口径数字入库时必须绑定各自分母，这是交叉验证定下的硬性入库规则。

**heuristic_review（中间带）**。启发式问题存在性、模式适用性初判——LLM 可做但不稳定：检测一致性 κ≈0.50，而严重性排序 α≈0 [C006][A017]；GPT-4 级评委与人类偏好一致率虽超过 80%，但存在系统性 position/verbosity/self-preference 偏差 [A028]，2026 年 54.1 万条判断的大规模复测发现机会校正后区分度缩水 33–41 个百分点、评委排名跨 benchmark 移动多达 14 位 [C033]。因此本类验证强制偏差缓解协议：优先成对比较（绝对打分与批量排序显著发散 [A055]）、顺序交换复评、rubric 锚定、与人类标注样本定期校准（κ 低于门槛即暂停自动评审）。LLM 评审可作初筛，不可作终裁。

**runtime（取证的强制性）**。截图级评审的根本局限是：大量可用性失败是交互性的——禁用控件无解释、表单静默拒绝输入、破坏性操作隐藏后果；只看首屏渲染的评委"产出流畅但证据薄弱的批评" [C005]。可靠评审要求操作控件、观察状态转移、测试错误恢复路径。因此 Schema C 的 judgment_required 类规则把 evidence_required（运行态证据清单）列为 rubric 的前置条件，GPT-4 对 UI mockup 的评审随设计迭代改进而性能下降、不适合作迭代评审工具的实证 [A004] 进一步支持"评审必须锚定行为而非外观"。

**user_test（天花板）**。usability 在规范上被定义为 outcome 而非 property——宣称可用性必须绑定 specified users/goals/context of use，否则命题在逻辑上不可证伪 [N040]。严重性排序、权衡裁决、真实用户体验属机器不可判定层，人工终裁不可省。这套四分类也是对客户的诚实声明：任何声称自动验证"体验质量"的功能应在架构上被拒绝。

两条实例规则恰好展示谱系两端：R-ERR-001（破坏性操作可恢复）主体为 lint——在组件树上检索 destructive 入口的 undo/确认契约是确定性判定，仅"确认文案是否指明对象"需语义判断，按零误报原则转人工；R-LAY-001（工作区层级主导）为 heuristic_review——面积占比与对比度量级可 lint，"首次注视落点"必须评审加 runtime 取证。同一份知识，可判定部分编译为 policy，不可判定部分保留为 rubric，这正是 Schema C 两个物种的分工。

---

## 5. provenance 字段设计：回答"Systemsmith 为什么有这条规则"

每条规则的证据链为 statement ← rationale ← evidence ← source，四个字段各司其职。statement 是单一可判定命题，禁止"尽量""合理"等不可证伪措辞；rationale 是机制层解释（认知机制、实证发现或平台约束），不是 statement 的复述——例如 R-ERR-001 的 rationale 可还原到 slip 类错误不可完全预防、因此恢复通道优于更多确认弹窗的错误分类理论，这使它与"破坏性操作要弹确认框"这种惯例级说法区分开来；evidence 携带 Source Registry 全局 ID、初始权威级与置信度；source 的原文关键句摘录存放在 L3 层供审计。

这一设计的依据有三。第一，归因标准：陈述应可归因到已识别来源而非看似合理 [A040]，引用质量可用 entailment 方法逐条核验（引用来源蕴含句子；移除任一来源则不蕴含）[A041]。第二，引用不等于忠实：即使提供了来源，30–50% 的 LLM 医学陈述缺乏充分引用支持 [A042]——因此"Agent 引用了规则 R12"与"输出确实被 R12 支持"是两件事，provenance 必须生成时随行携带（检索返回结构化条目而非拼接文本），并在验证阶段做逐条 entailment 检查。第三，分级语义已统一裁决：N 保留给规范级文本，A 给原始同行评审研究与 HCI Canon，B 仅给 OS 平台级规范，C 给产品级设计系统与厂商自研数据；同一来源的 authority 是 scope 的函数——平台规范在其平台 scope 内是 B 级硬约束，跨平台引用时降为 C。

provenance 还承担防御功能。LLM 训练数据中视觉灵感类内容占比极高，E 级"灵感"会通过模型先验隐性覆盖高级证据——因此 E 级条目不得进入检索索引的默认语料，只能由显式 inspiration 工具调用；D 级（自有测试）证明的是"对本产品用户成立"，泛化引用时降级。internet_myth 类条目物理隔离于 myth_quarantine，保留它们不是供遵守，而是供 Agent 主动反驳用户输入中的神话（3-click rule、菜单≤7 项）——这是知识库的反向价值。

---

## 6. 推荐路径：B + C 混合，A 起步

建议的目标形态是 **B 组织 + C 执行化子集**：知识内容以三层渐进披露组织（解决 context 经济与检索），其中 machine-checkable 子集编译为 policy-as-code 在 CI 与评审管线中确定性执行（解决可验证）。理由：Schema B 的三层与 HCI 知识自身的分层（原则层 → 指南/模式层 → 实现层）同构，L1 索引对应原则层、L2 正文对应指南层、L3 档案对应实现层，知识架构与消费架构是同一张图；Schema C 则回答了"规则如何变成行为"——截至 2026-08，没有任何主流产品实现"证据分级 + 冲突裁决 + 可验证"的完整形态，Figma 的自动 rules file 是最接近的实践但为单层、无 authority 分级、无冲突解析 [C011]，这是本项目的差异化窗口。

迁移路线分三步，刻意避免一步到位。**第一步以 A 起步采集**：用扁平条目作为录入格式跑通知识获取流水线（从 WCAG/HIG/ISO/实证研究半自动抽取 + 人工审定），目标是先积累 100–200 条 reviewed 以上状态的规则，并在此阶段强制 owner、source_version、review_by 字段——专家系统死于没有知识获取管线而非规则本身 [C019][D003]，流水线是一等交付物。**第二步加 trigger 层**：从 A 条目的 scope/applies_when 机械生成 L1 索引（trigger_conditions 与 applies_when 同源生成，禁止手工双写），上线 hybrid search + metadata filtering，入库时做 L1↔L2 的 entailment 一致性检查 [A041]。**第三步可判定子集执行化**：对 validation.automatable=full 的规则生成 match/assert policy，按"先 warning 后 error"渐进收紧接入 CI [D005]；judgment_required 子集配置 rubric 与评委协议，建立与人类标注的季度校准机制。三步中任何一步都不抛弃前一步的产出：A 是 B 的内容超集，B 是 C 的分发载体，C 是 B 中可判定子集的执行投影。

---

## 7. 反模式清单

以下反模式在 Schema 层面设防，但仍需在评审流程中人工把关。

**规则膨胀**。每条新规则都想进库会导致维护崩塌——知识制品死于无维护机制而非初始质量。防线：入库必须回答"这条规则的可判定子集是什么、owner 是谁、何时复审"；draft 状态规则不进默认检索语料；前沿层条目（AI 交互模式、WCAG 3.0、M3 Expressive 类）强制 expires_at 与低权威标记。

**无反适用条件的规则**。缺少 does_not_apply_when 的规则是神话的胚胎——HCI 知识神话的共性是边界条件丢失而非错误。防线：Schema 级强制（缺该字段不得进 stable）；评审时要求至少一个 counterexample。

**authority 虚标**。把厂商营销内容标 B、把二手转述标 A、把"原始论文"自动标最高级，都会污染下游裁决——交叉验证实测到同一来源被不同维度赋四级差异。防线：分级语义全局统一（N/A/B/C/D/E 边界已裁决）；authority 是初始级而非终身爵位，升降级域命中必须留痕；authority level ≠ 证据强度（个别高权威来源的实证地位已被作者本人削弱，引用以 Registry notes 为准）。

**把审美偏好写成 hard rule**。"界面要简洁""留白要充足"类偏好若无 scope、无可证伪 statement、放进了非补偿层，就会系统性压制有实证支撑的密度与效率知识。防线：视觉偏好类规则强制归入 L5 补偿层；statement 必须可判定；E 级灵感源不进默认语料。相关地，平台规范的视觉表现（Material 的色彩系统、HIG 的排版）是 platform_convention 而非通用原则，跨平台引用必须降级并带 platform + 版本约束——target size 三体系（24px AA / 44pt HIG / 48dp Material）不可混用 [N002]。

另需警惕两个流程性反模式：**三层手工双写**（L1 与 L2 漂移导致检索静默失灵，必须同源生成 + entailment 校验）与**引用后补**（先写规则再找来源，必然产生弱支持条目，来源 ID 必须生成时随行 [A040][A042]）。

---

*本文档与 YAML 主文件共同构成 D7。所有来源标注 [ID] 见 Source_Registry.md；置信度与冲突区背景见 systemsmith_cross_verification.md 与 systemsmith_insight.md。*
