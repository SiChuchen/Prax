> 中间稿（已归档）。权威版本为 ../UIUX_Foundation_Research.md

# UIUX Foundation Research（上）：标准、理论与认知基础

本部分回答一个问题：AI 设计 Agent 做判断时，可以合法地援引哪些"稳定知识"？答案是三层——国际标准提供的规范术语与原则层（第 2 章）、HCI 经典理论提供的概念框架（第 3 章）、认知心理学提供的可实证机制（第 4 章）。三层知识的证据性质不同：规范（normative）、启发式（heuristic）与科学模型（scientific model）必须分开存放、分开引用，混用是设计知识传播史上大多数错误的根源。本章先梳理这三层知识共同生长的学科脉络。

## 1. HCI 历史与理论脉络

**人因工程时代（1940s–1970s）**。HCI 的实证血统先于计算机而存在。二战期间航空与工业系统对"人作为系统部件"的定量研究留下了一批至今仍在被引用的科学模型：Fitts 1954 年对人臂瞄准运动信息容量的建模 [N025]、Hick 1952 年对选择反应时与信息增益关系的实验 [N010]、Miller 1956 年对信息处理容量上限的综述 [N044]，都产生于交互式图形界面出现之前。这一时代的遗产是方法论：把人当作可测量的通道，用实验与数学模型描述其限度。ISO 9241 系列自身也源自这一传统——它最初是"办公视觉显示终端工效学要求"的 17 部分标准，由 ISO/TC 159（Ergonomics）SC 4 维护，2006 年前后才重组为"人机系统交互工效学"并扩展为百位系列结构 [N057]。对 Design Intelligence 的意义：知识底座中证据最强的条目，恰恰是最老的条目。

**认知范式时代（1980s）**。个人计算机把"非职业操作者"引入系统使用者行列，研究对象从"操作员的身体与反应"转向"用户的目标、知识与心智模型"。这一转向的标志性文本几乎集中在十年内出现：Shneiderman 1983 年提出直接操纵（Direct Manipulation），论文副标题"超越编程语言的一步"本身就是认知转向的宣言——把用户从记诵语法中解放出来，转为对可见对象的直接操作 [N021]；Gould & Lewis 1985 年在 CACM 上提出以用户为中心设计的三原则（早期聚焦用户与任务、使用情况的实证测量、迭代设计）[A045]；Norman & Draper 1986 年编辑《User-Centered System Design》，首次把 UCD 作为系统设计哲学命名——"用户的需求应主导界面设计，界面的需求应主导系统其余部分的设计" [A046]；Norman 1988 年出版《The Psychology of Everyday Things》（2013 年修订版更名《The Design of Everyday Things》），把执行鸿沟、评估鸿沟、自然映射与概念模型普及为设计界的工作词汇 [N011]。遗产是概念框架：心智模型、概念模型、鸿沟、反馈——这些词至今仍是设计推理的工作词汇（第 3 章）。

**可用性工程时代（1990s）**。随着软件工业化，学界范式被转译为可嵌入开发流程的工程方法。Nielsen 1992/1993 年系统化"可用性工程生命周期"，把实证用户测试、原型与迭代设计组合为一套低成本方法 [A065]；1994 年他基于对 249 个真实可用性问题的因子分析提炼出 10 条启发式，使专家检查（heuristic evaluation）成为不依赖实验室的评估手段 [N039]；Nielsen & Landauer 1993 年进一步给出评估者数量的成本-收益数学模型（λ≈0.31，5 名评估者约发现 75% 问题），第一次让"做多少评估"成为可计算的工程决策 [N012]。同一时期，Gould & Lewis 的 UCD 框架经 ISO 13407:1999 标准化，后来演变为 ISO 9241-210 [A045]。遗产是流程与度量：可用性从研究课题变成有成本-收益模型的工程活动，"设计判断可验证"的立场由此确立——Systemsmith 对"可验证设计知识"的全部追求，方法论上都奠基于此。

**设计转向与 UX 时代（2000s）**。互联网与消费软件把竞争维度从"能否完成任务"扩展到"整体体验"，设计思维（Design Thinking）作为方法论话语兴起：IDEO 的 Inspiration–Ideation–Implementation 三阶段与 desirability/feasibility/viability 三透镜 [A014][A015]、d.school 的五阶段模型 [A016]、英国 Design Council 2004 年提出的 Double Diamond [A064]，把 1980 年代的 UCD 内核重新包装为面向商业创新的通用流程。遗产是一把双刃剑：设计获得了组织地位，但大量过程话语是对同一骨架的重复包装（见 2.4 节的映射分析）。

**平台化 Design System 与 AI 时代（2010s–2026）**。设计知识开始以机器可读形态沉淀：平台级规范（Apple HIG、Material、Fluent）成为"惯例的权威发布"，企业设计系统（Carbon、Primer、Atlassian）成为治理与冲突裁决的实证样本；与此同时 ISO 9241 在 2024–2025 年对软件工效学家族密集换代（112/115/161/171 四个部分）[N049][N063][N034][N052]。2020 年代中叶，LLM 驱动的 Coding/Design Agent 成为设计知识的新消费者——标准制定者对此明确留白：ISO 9241-110:2020 声明不覆盖 AI 特性的细节 [N045]；HCD 的实证底线也已被重申——NN/g 与 ACM 的同期研究一致判定 LLM 合成用户不能替代真实用户研究，仅能用于案头研究与假设生成 [A005][A006]。换言之，AI 时代没有改变"设计知识需要证据与边界"这一学科基本纪律，只是改变了知识的消费者形态——这正是 Systemsmith 项目的立足点。

**三次独立收敛到同一分层**。值得注意的是一个结构性事实：标准制定者（ISO 9241 的 -11 概念 → -110 交互原则 → -112/-125 呈现 → -161 UI 元素 → -210 过程 [N058]）、学术模型化 UI 社区（Cameleon 的 Task→AUI→CUI→FUI 四层）与企业设计系统（principles→tokens→components→patterns）三个互不隶属的体系，各自独立地把 UI 知识切成了几乎同构的分层——技术无关原则层在上，语义/结构层居中，平台惯例与实现值层在下。跨维度洞察 ① 据此判断：这种收敛验证了知识底座分层假设，但真正的硬边界只有一条——删除某条陈述是否丢失设计意图（语义层 vs 渲染层）。本报告第 2–4 章的内容几乎全部位于语义层一侧，这正是它们历经四十年仍然有效的原因。

## 2. 核心标准：ISO 9241 系列

ISO 9241 由 ISO/TC 159（Ergonomics）SC 4（Ergonomics of human-system interaction）维护，是 UI/UX 领域唯一具有国际标准法地位的规范体系。它原为 17 部分的"办公视觉显示终端（VDT）工效学要求"，2006 年前后重大重组为"Ergonomics of human-system interaction"，按百位系列划分：100 系列为软件工效学，200 系列为以人为中心的设计过程，300 系列为显示器，400 系列为物理输入设备，依此类推；未编入百位系列的部分保留旧编号（如 -11、-20）[N057]。ISO/TR 9241-100:2023 是 100 系列的官方导览，并明确指出 ISO 9241-11（概念框架）、ISO 9241-210 与 ISO 9241-220（组织内 HCD 过程）三份文件对软件交互系统设计具有跨系列的特殊相关性 [N058]。

### 2.1 系列结构与版本状态总表

下表版本状态均经 iso.org 标准目录页与 ISO Online Browsing Platform（OBP）于 2026-08 核实；成员体目录（EVS/BS/DIN 等）仅作旁证——交叉验证发现个别成员体页面存在国家采纳年份与 ISO 发布年份混记的情况，版本状态一律以 iso.org 为准 [N052][N059]。

| 部分号 | 名称 | 当前版本 | 年份 | 状态（2026-08） | 核心内容 | 对 Design Intelligence 的意义 |
|---|---|---|---|---|---|---|
| 9241-11 | Usability: Definitions and concepts | Ed.2 | 2018 | 有效，2023 系统评审确认 | usability 三要素定义、context of use、human-centred quality | 设计质量断言的形式化框架（见 2.2） |
| 9241-110 | Interaction principles | Ed.2 | 2020 | 有效 | 7 条交互原则 | 跨技术栈的交互评估框架顶层（见 2.3） |
| 9241-112 | Principles for the presentation of information | Ed.2 | 2025 | 2025-06 替代 2017 版 | 信息呈现 6 原则（detectability、discriminability、conciseness、interpretability、freedom from distraction、consistency），覆盖视觉/听觉/触觉三模态 | 高信息密度界面的感知层检查维度 |
| ISO/TR 9241-100 | Overview of ISO 9241 software ergonomic standards | Ed.2 | 2023 | 有效 | 1XX 家族导览；声明不覆盖安全关键系统与协同工作细节 | 系列检索地图；-11/-210/-220 的跨系列定位 |
| 9241-115 | Guidance on conceptual design, user-system interaction design, user interface design and navigation design | Ed.1 | 2024 | 首发；承接 ISO 14915-2:2003 | 概念设计/交互设计/UI 设计/导航设计指南；方法论无关 | 最接近"设计过程操作层"的 ISO 部分 |
| 9241-125 | Guidance on visual presentation of information | Ed.1 | 2017 | 有效，2022 确认 | 视觉编码技术、基于感知与记忆能力的信息组织 | 视觉层级/密度判断的最具体 ISO 依据；自述非规定性 |
| 9241-161 | Visual user-interface elements | Ed.2 | 2025 | 2016 版 2025-12-31 撤销，2025 版替代 | 平台无关的通用视觉 UI 元素全集、衍生/组合/状态、选择指南 | "控件选择知识"的规范来源 |
| 9241-171 | Software accessibility | Ed.2 | 2025 | 2008 版撤销，2025-12 发布（103 页） | 对齐 ISO/IEC 29138-1 的可达性需求；内置 WCAG 2.2 成功准则映射 | 原则层判断 → 可自动测试准则的翻译桥 |
| 9241-210 | Human-centred design for interactive systems | Ed.2 | 2019 | 有效，2025-05-22 确认（阶段码 90.93） | 6 条 HCD 原则 + 4 活动循环；Annex B 符合性检查单 | 唯一有可审计符合性机制的 HCD 过程规范 |

**表格分析**。三点结构性观察。其一，2024–2025 年是 1XX 软件工效学家族的集中换代期（112/115/161/171 四个部分），方向是术语向 -11:2018/-220:2019 的 human-centred quality 框架对齐、可达性主线向 WCAG 2.2 接轨、语言从"对话/控件"转向"交互/概念设计" [N049][N052]——这意味着任何引用旧版本的知识条目都已过时，authority 必须带版本号。其二，核心概念与过程部分（-11、-210）均在近两年内通过系统评审确认且无修订迹象，它们是知识底座中"稳定层"的候选；而 1XX 家族证明"ISO 部分"不等于"稳定"。其三，任务书的两处假设被证伪：ISO 9241-110:2006 旧版是 7 条对话原则而非 10 条（详见 2.3）；"ISO 9241-115 (Guidance on usability)"从未以此名发布，115 号部分 2024 年才以新标题首发，早期同名工作项已撤销（ICS 目录阶段码 95.99）[N063][N059]。

### 2.2 ISO 9241-11:2018：usability 的精确定义及其推论

ISO 9241-11:2018（第 2 版，替代 1998 版，2023 年确认有效）将 usability 定义为："extent to which a system, product or service can be used by specified users to achieve specified goals with effectiveness, efficiency and satisfaction in a specified context of use"（3.1.1）[N040]。三要素在同标准中有各自的规范定义：effectiveness 是"用户达成指定目标的准确性与完整性"（3.1.12）；efficiency 是"相对所达成结果而消耗的资源"（3.1.13），典型资源包括时间、人力、成本、材料；satisfaction 是"使用产生的生理、认知与情绪反应满足用户需求与期望的程度"（3.1.14）。context of use（使用情境）被定义为用户、目标与任务、资源、环境的组合，其中环境含技术、物理、社会、文化与组织环境（3.1.15）[N040]。

**版本纪律**。交叉验证发现 dim04 研究曾误引已被撤销的 1998 版定义（satisfaction 旧措辞为"freedom from discomfort, and positive attitudes…"）。两版差异是实质性的：2018 版将适用范围从产品扩展到系统与服务；目标范围纳入个人与组织成果；efficiency 改为"相对所达成结果"定义，不再绑定目标达成的准确性；satisfaction 澄清为涵盖更宽议题 [N040]。虽然指标映射结论（effectiveness→成功率、efficiency→时间、satisfaction→SUS 类量表）在两版下都成立，但所有引用必须锁定 2018 版——这是"authority 是时间的函数"的实例。

**关键含义一：usability 是"使用产出"而非产品属性**。标准明确："usability relates to the outcome of interacting with a system, product or service… is not an attribute of a product, although appropriate product attributes can contribute to the product being usable in a particular context of use"，并指出 usability"比通常理解的 ease-of-use 或 user friendliness 更综合" [N040]。这使任何 UI 质量断言都成为可证伪的三元组声明——对谁（specified users）、对什么目标（specified goals）、在什么情境（specified context of use）。"这个界面可用性好"在 ISO 框架下是不完整的句子；补全三个指定项之后它才成为可以测量与验证的命题。对 Agent 而言，这是"可验证设计判断"的规范基础：度量层可接 ISO/IEC 25022（quality in use 测量），9241-11 书目明确指向 SQuaRE 系列 [N040]。

**关键含义二：context of use 是设计推理的一等参数**。同标准还定义了 human-centred quality（usability + accessibility + user experience + avoidance of harm from use 四要求的达成度）、user experience（使用或预期使用产生的感知与反应）、use error（刻意采用 IEC 62366-1 的措辞以避免"user error"对用户的归罪）[N040]。这组术语给知识条目提供了强制元数据：凡涉及质量判断的规则，必须声明其适用的用户群、任务与环境范围——2.3 节 engagement 原则与专业工具密度的张力（Conflict Zone C7）正是"原则权重随 context of use 变化"的活例。

### 2.3 ISO 9241-110:2020：七条交互原则

ISO 9241-110:2020（第 2 版，"cancels and replaces"经实质性技术修订的 2006 版）确立 7 条交互原则 [N045]：

1. **Suitability for the user's tasks（任务适配性）**：系统支持用户完成任务，操作功能与交互基于任务特征而非所选技术。推荐类别：任务适配性识别、优化任务投入、支持任务的默认值。
2. **Self-descriptiveness（自我描述性）**：系统在用户需要处呈现恰当信息，使其能力与用法"无须多余交互即显而易见"，包括处理状态的清晰指示。
3. **Conformity with user expectations（符合用户预期）**：系统行为在使用情境与该情境公认惯例下可预测。推荐类别：适当的系统行为与响应、内部与外部一致性、使用情境变化。
4. **Learnability（可学习性）**：系统支持能力发现、允许探索、最小化学习需要并在需要时提供学习支持。推荐类别：discovery / exploration / retention。
5. **Controllability（可控性）**：用户保持对界面与交互的控制，包括交互的速度、顺序与个性化（individualization 已并入本条）。
6. **Use error robustness（使用错误稳健性）**：系统协助用户避免错误，对已识别错误宽容处理并协助恢复。推荐类别：avoidance / tolerance / recovery。
7. **User engagement（用户投入）**：系统以"inviting and motivating"的方式呈现功能与信息，支持持续交互。推荐类别：激励用户、系统可信性、提升投入 [N045]。

**技术无关性及其边界**。Scope 原文声明这些原则"formulated in general terms (i.e. independent of situations of use, application, environment or technology)"，适用于分析、设计与评估 [N045]——这是七原则可作为跨技术栈评估框架顶层的规范依据。但标准同时声明两条排除：不覆盖特定应用领域细节，明列 safety critical systems、collaborative work 与 **artificial intelligence features**；不考虑营销、美学与企业标识等设计方面 [N045]。前者是 AI 时代规范层的自证真空——Agent 系统的自我解释、可控性与错误恢复恰是 Agent 设计最需要指南而标准明确留白之处；后者提醒：ISO 原则层不承担视觉表现判断。

**2006 → 2020 的变更与一处必须更正的事实**。2020 版保持 7 条但重组：(a) individualization 原则并入 controllability；(b) 新增 user engagement；(c) suitability for learning 更名为 learnability，error tolerance 更名为 use error robustness；(d) 纳入原 ISO 14915-1 相关指南 [N045]。推荐的来源被标准自述为"工效学研究与多种通用及启发式指南的组合（包括 Bastien、Dzida、Molich、Nielsen 与 Tognazzini）"[N045]——即 ISO 交互原则与第 3 章的 HCI Canon 共享文献根系。需明确更正：任务书"2006 版 10 条对话原则"的假设已被证伪。ISO 9241-110:2006 §4.1 原文为"Seven principles have been identified as being important…"，且 2006 版本身是 ISO 9241-10:1996 的改名版，1996 版同样为 7 条 [N054][A060]；交叉验证另获三个独立学术来源逐条确认 [N054]。"10 条"疑似与 Nielsen 10 启发式混淆。

**Engagement 原则与专业工具密度的张力（Conflict Zone C7，保留不抹平）**。user engagement 带有明显的 hedonic（享乐性）色彩；而 HEART 度量框架的原始论文指出，engagement 在企业场景价值有限——因为用户是被要求使用系统的 [A053]。这不是事实矛盾，而是规范层与度量层对"engagement"价值的真实张力。dim01 研究自身也注明：engagement 对高信息密度专业工具的适用权重需按 context of use 校准，标准自己也声明原则应用优先级取决于 purpose/users/tasks/environment [N045]。裁决立场：本条目不抹平为单一结论，在知识库中保留为"原则应用优先级依赖 context of use"的场景化裁决样例——专业工具 scope 下 engagement 降权，可读性、可预期性与任务效率升权。

**原则的生态定位**。标准 Figure 1 将 ISO 9241-11（usability 概念）、ISO/IEC 29138-1（无障碍需求）、9241-110（交互原则）与 9241-112（信息呈现原则）定位为"实现 usability 的高层指南"，并把 Microsoft Windows UX Guidelines 与 iOS HIG 列为"非 ISO 的 standardized conventions"示例 [N045]——这是 ISO 官方对平台规范的层级定位：平台 HIG 是惯例层，不是原则层。

### 2.4 ISO 9241-210:2019：HCD 过程模型与共同骨架

ISO 9241-210:2019（第 2 版，谱系为 Gould & Lewis 1985 UCD 原则 → ISO 13407:1999 → 9241-210:2010 → 2019 版；2025-05-22 经系统评审确认继续有效）为交互系统全生命周期的以人为中心设计提供要求与推荐 [N016][A045]。其结构为 **6 条原则 + 4 活动循环**。6 条原则（Clause 5）：设计基于对用户、任务与环境的显式理解；用户全程参与设计开发；设计由以用户为中心的评估驱动并精炼；过程是迭代的；设计面向完整用户体验；设计团队包含多学科技能与视角 [N016]。4 项活动（Clause 7）迭代进行直至满足需求：理解并说明使用情境（输出 context-of-use description）→ 规定用户需求 → 产出满足需求的设计方案（含原型）→ 依据需求评估设计 [N016][C024]。2019 版的目标产出扩展为 effectiveness、efficiency、satisfaction、accessibility 与 well-being（即 human-centred quality），并强调 human-centred 宽于 user-centred——覆盖用户以外的利益相关者 [N016]。标准方法论无关，可嵌入瀑布、面向对象或敏捷生命周期；Annex B 提供符合性声明检查单，是唯一可审计的 HCD 过程规范 [N016]。

将 9241-210 与工业界流行的六个过程模型并排，可见高度同构的阶段结构：

| 公共骨架 | ISO 9241-210 [N016] | Double Diamond [A064] | d.school DT [A016] | IDEO [A014] | Lean UX [B020] | UCD (Gould & Lewis) [A045] | PD [A035] |
|---|---|---|---|---|---|---|---|
| Understand（理解人/任务/情境） | 理解并说明使用情境 | Discover（发散） | Empathize | Inspiration | 假设收集 | 早期聚焦用户与任务 | 民族志/现场工作 |
| Define（框定问题/需求） | 规定用户需求 | Define（收敛） | Define | Inspiration→Ideation 交界 | 假设→可验证假说 | 需求收集 | 共同定义问题 |
| Explore/Generate（发散生成） | 产出设计方案（前期） | Develop（发散） | Ideate | Ideation | Think | 概念设计 | 共同设计/未来工作坊 |
| Select/Converge（收敛决策） | 产出设计方案（收敛） | Develop→Deliver 交界 | （Test 筛选） | 三透镜筛选 | 最风险假设优先 | — | 共同决策 |
| Prototype（具象化） | 原型作为设计方案 | Deliver（小规模试验） | Prototype | 原型 | Make（MVP） | 原型用于实证测量 | mock-up/合作原型 |
| Validate（实证评估） | 依据需求评估设计 | Deliver（测试） | Test | 实施前验证 | Check（学习指标） | 实证测量 | 共同评估 |
| Implement（工程落地） | （生命周期内，非详述） | Deliver（落地） | — | Implementation | 与 sprint 融合 | — | — |
| Measure/Learn（度量再迭代） | 迭代回任一活动 | 非线性回溯 | 迭代 | 持续 | outcomes 度量 | 迭代设计 | 持续参与 |

**表格分析**。七个模型共享一个四元骨架——理解（问题域）→ 框定 → 生成-收敛（解域，含原型）→ 实证验证，外加两个横切性质：迭代（所有模型）与用户/利益相关者参与（所有模型，但参与深度从 UCD 的"研究对象"到 PD 的"共同决策者"不等——PD 的关键主张是问题定义权本身是权力问题，用户作为 co-designer 而非被研究对象 [A035][A036]）。各模型的独特贡献可精确归因：Double Diamond 贡献了显式的"发散/收敛×2"节奏（2004 年 Design Council 提出，2019 年并入 Framework for Innovation [A064]）；Lean UX 贡献了假设-实验-成果度量闭环（Think→Make→Check，以 outcomes 而非 deliverables 度量进展 [B020]）；9241-210 贡献了规范化输出物（context-of-use description、user requirements、评估计划）与符合性检查单 [N016]。d.school 五阶段与 IDEO 三阶段+三透镜之间没有本质差异——MDPI 2025 系统综述指出各 DT 框架收敛于四个共同原则：用户中心、迭代原型、创意发散、跨学科协作 [A016]。**结论：2000 年代以来的过程话语繁荣，主要是对 1985 年 UCD 骨架的重复包装与 rebranding，而非新知识的产生。**

**对任务书 8 阶段划分的评估：合理，且比任何单一模型更适合 Agent**。理由有四：其一，它把 Double Diamond 的两次发散/收敛显式拆为 Explore 与 Select 两个独立阶段，便于 Agent 分别施加"扩展候选"与"应用决策准则"两种不同算子；其二，它把 Lean UX 的 Measure 显式化为闭环末端，使设计判断可被 outcome 数据反哺——与 9241-11 的 usability-as-outcome 立场同构 [N040]；其三，它与 9241-210 的 4 活动循环兼容（Understand+Define ≈ 活动 1+2，Explore+Select+Prototype ≈ 活动 3，Validate ≈ 活动 4），Implement/Measure 填补了 9241-210 故意留白的生命周期末端；其四，每阶段可绑定规范锚点：Understand/Define → 9241-11（context of use）[N040]，Explore/Select → 9241-110/-112 原则 [N045][N049]，Prototype → 9241-115/-161 [N063][N034]，Validate → 9241-171/WCAG 可达性检查 [N052]。

**自动化边界：解域可自动化，问题域与实证验证必须人类在场**。Explore（方案发散与变体枚举）、Prototype（代码级原型生成）、Implement 与规范符合性检查（启发式检查单、WCAG 映射的可达性自动检测）可接近全自动化；Understand、Define 与真实用户 Validate 不可。证据是双重的：NN/g 2024 实证对比研究判定合成用户"cannot replace the depth and empathy gained from studying and speaking with real people"，仅可用于 desk research 与假设生成 [A005]；ACM Augmented Humans 2025 同行评审分析进一步指出合成用户存在 normative bias（规范性偏差）、circularity（无法产生训练数据之外的新洞察）与 convincing mimicry（逼真拟态）三重风险，明确建议"DO NOT USE… to replace authentic user research" [A006]。逻辑上这也由 9241-11 的定义决定：usability 是 specified users 在 specified context of use 中的使用产出，合成用户不满足该实证要求 [N040]。Systemsmith 的正确定位因而不是端到端自动化，而是**用规范知识让 Agent 的设计推理可审计，用结构化检查点在 Understand/Define/Validate 三处保留人类决策权**。

### 2.5 标准的局限

对 ISO 9241 必须保持批判距离，其局限有五点。**付费墙与可获得性**：正文每份 CHF 100–227，行业评论长期批评标准付费墙阻碍中小企业采用与理解；实践中团队更多依赖免费二手转述（NN/g、平台 HIG），标准本身的实践触达率低 [E036]。**抽象层级高、非规定性**：9241-110 自述不构成"允许直接规定设计方案的规定性指南集"，推荐非穷尽、需自行判断适用性 [N054]；9241-125 自述"cannot be applied without knowledge of the context of use… not intended to be used as a prescriptive set of rules to be applied in its entirety"，且部分条款基于拉丁字母语言习惯 [N061]。**滞后于 AI 实践**：110:2020 明确不覆盖 AI features 细节，系列中尚无针对生成式 AI/Agent 交互的部分 [N045]；WCAG 与平台 HIG 等免费且高频更新的体系在实操中影响力更大。**符合性难验证**：除少数部分（-171 的 WCAG 映射、-210 Annex B）外，多数部分缺乏可机器检查的符合性准则，对比 WCAG 的自动测试工具链，认证生态薄弱 [N052]。**积极面同样明确**：作为 normative 锚点，ISO 9241 提供稳定的术语体系（usability、context of use、use error、human-centred quality）、技术无关的原则层，以及采购/合规场景的可审计基线（医疗 IEC 62366、政府 RFP 常引用）[N034]。这正是 Agent 知识底座最需要的"稳定层"——但稳定层的知识必须带着它的非规定性自我声明一起入库，每条原则附带适用范围元数据，不能作为无条件规则。

## 3. 核心理论：HCI Canon

本章审查三份被引用最多的设计原则体系——Nielsen 10 启发式、Norman 的概念框架、Shneiderman 的规则与模型。审查立场一致：区分每条知识的证据性质（scientific/empirical model、design heuristic、platform convention、internet myth），并检验其跨技术栈性。

### 3.1 Nielsen 10 启发式：因子分析的产物，不是主观清单

**起源**。10 条启发式不是 Nielsen 的经验罗列。1990 年 Molich & Nielsen 提出启发式评估方法；1994 年 Nielsen 在 CHI 论文中对 249 个真实可用性问题 × 101 个候选启发式做因子分析，萃取出解释力最大的子集——即现行 10 条 [N039]。作者自述："Four years later, I refined the heuristics based on a factor analysis of 249 usability problems to derive a set of heuristics with maximum explanatory power" [N039]。此后条目本身从未变更；2020 年 NN/g 更新了文章的解释与示例并致谢 Kate Moran 与 Feifei Liu 刷新措辞，同时声明"the 10 heuristics themselves have remained relevant and unchanged since 1994"（该声明为作者本人单一来源，但属一手陈述）[A050]。互联网上所谓"2024 修订版"多为海报再设计，不构成内容变更 [A050]。

**逐条性质判断**。10 条的共同定位是 heuristic——Nielsen 自述："They are called 'heuristics' because they are broad rules of thumb and not specific usability guidelines" [A050]。但各条的证据底座不均等：

- **有独立实证心理学底座的三条**：#1 Visibility of system status（反馈与状态可见性，与 Miller 1968 时延阈值研究联动 [N030]）；#5 Error prevention（2020 版显式引入 slips vs mistakes 的人因错误分类学，源自 Norman/Reason [N011]）；#6 Recognition rather than recall（记忆心理学中再认系统性优于自由回忆的实证发现，见 4.2 节 [A050]）。这三条最接近跨技术栈普适。
- **高度依赖语境的其余条目**：#2 Match between system and real world 中"用户的语言"是领域相关的——对开发者，SQL/PromQL/trace span 术语就是"现实世界"，该条的执行不是"说人话"而是"说用户所在领域的话"；#3 User control and freedom（明确标示的"紧急出口"、undo/redo）在开发者工具中的对应物是可中断查询、回滚、dry-run 与时间旅行调试；#4 Consistency and standards 有两个层次——内部一致性接近硬性要求，外部一致性（平台/行业惯例，如 IDE 键位、kubectl 语法）可被专家效率需求否决；#7 Flexibility and efficiency of use 与 #6 存在结构性张力（快捷键对新手不可见），解法是可发现的加速器——命令面板在展示补全项时顺带提示键位；#8 Aesthetic and minimalist design 最易被误用——它是**信噪比**原则而非"少即是多"，原文明确"every extra unit of information competes with the relevant units"，NN/g 自己澄清"This heuristic doesn't mean you have to use a flat design"，高信息密度工具只要每个信息单元与任务相关就不违反此条 [A050]；#9 的"no error codes"对开发者工具应理解为"错误码不能是唯一信息"——可搜索的错误码反而助力文档可检索性；#10 Help and documentation 的理想是无需文档，现实解是上下文内嵌帮助（inline docs、hover 解释指标定义）[A050]。

**方法定位**。10 条启发式的设计用途是启发式评估（heuristic evaluation）——一种由多名评估者独立检查界面、汇总问题的专家检查法，其价值在于低成本、可在开发早期执行、不依赖真实用户 [N039][A050]。它发现的是"潜在问题的候选清单"，不是可用性的度量；度量必须回到 ISO 9241-11 的三元组框架（2.2 节）。把启发式当规范、把启发式评估当用户测试，是实践中最常见的两类误用。

**结构性张力与"只能是 heuristic"的论证**。条目之间的张力是天然的：#6 要求元素可见以降低记忆负荷，#8 要求抑制无关信息以保信噪比，#7 要求为专家提供隐藏的加速器——三者对同一屏幕提出相反方向的拉力。清单本身不提供权衡规则；设计是权衡，因此任何把这 10 条当作可机械验证硬规则的用法都是对原意的篡改。同样需降权引用的是启发式评估的量化模型：Nielsen & Landauer 1993 的泊松拟合（λ≈0.31，N=5 名评估者约发现 75% 问题，区间 2/3–85%）是成本-收益**规划估计**而非定律，不应作为硬阈值引用 [N012]。

### 3.2 Norman：affordance/signifier 的精确区分与概念模型三元组

**版本与概念谱系**。《The Design of Everyday Things》初版于 1988 年（原名《The Psychology of Everyday Things》）；2013 修订扩充版最大的理论变更是正式引入 signifier，以修复设计圈对 affordance 长达二十余年的系统性误用 [N011]。Norman 2008 年即已在个人网站撰文《Signifiers, not affordances》预告这一修正 [A002]。

**Affordance ≠ "看起来能点"**。这是设计圈传播最广的概念误用，Norman 本人在 2013 修订版中正式引入 signifier 予以修复 [N011]。精确区分：affordance 是**关系**而非物体属性——由物体属性与行动者能力共同决定，存在与否独立于是否被感知（概念源头为 Gibson 生态心理学 [N026]）；signifier 是**可感知的信号**，告知动作在哪里、如何发生。Norman 的原话（2013, pp. 13–14，经多源交叉验证）："Affordances determine what actions are possible. Signifiers communicate where the action should take place. We need both." 他明确否定设计圈"我在屏幕上放了一个 affordance"的说法——屏幕的可点击关系遍布整个屏幕，圆圈只是标示触摸应发生的位置 [N011][A002]。2013 版进一步区分：affordance 有些可感知有些不可感知；perceived affordance 常充当 signifier 但可能有歧义；"Signifiers must be perceivable, else they fail to function" [N011]。Gaver 1991 的补充分类仍是处理该概念最精确的工具：false affordance（看似可交互实则不可）与 hidden affordance（可交互但不可感知）[N007]。开发者工具的典型 discoverability 缺陷——可拖拽的列宽、可点击的 span、隐藏手势——全部是"真实 affordance 存在 + signifier 缺失"问题。把 affordance 简化为"按钮看起来能点"恰恰颠倒了澄清："看起来能点"是 perceived affordance 充当 signifier，真实 affordance 是控件与指针设备用户之间的可点击关系 [N011][N007]。

**其余概念簇**（均出自 2013 修订版 [N011]）。**Feedback**：每个动作应有即时、可感知、信息适量的反馈；不足导致重复操作与不确定，过度导致烦扰——与 Nielsen #1 同源。**Natural mapping**：利用空间类比与文化标准使控制-效果关系不言自明，"the proper natural mapping requires no diagrams, no labels, and no instructions"（经典例：炉灶旋钮与炉头的空间对应）。**Constraints 四类**：physical（直接排除错误操作）、semantic（依赖情境意义）、cultural（依赖习得惯例——随文化变化，跨文化产品不可当硬规则）、logical（空间/功能布局的逻辑关系）。**Gulf of Execution / Gulf of Evaluation**：前者是用户意图与系统允许动作之间的差距，后者是用户感知并解释系统状态所需的努力；设计师通过 signifiers、constraints、mapping 桥接前者，通过 feedback 与好的概念模型桥接后者。**七阶段行动模型**（goal → intention → specify → perform → perceive → interpret → evaluate）的工程用途是定位失败发生的阶段：用户卡在哪一阶段，就在哪一阶段投放设计干预——目标层对应信息架构与任务流，指定层对应控件语义与映射，感知层对应状态可见性，解释层对应数据呈现语义。**错误分类**：slips（自动行为层面的失误，含 capture、description、data-driven、associative-activation、loss-of-activation、mode error 六类——mode error 对 vim 式多模式工具、查看/编辑切换的开发者工具尤为相关）vs mistakes（有意识决策层面的错误，源于错误概念模型）[N011]。

**Designer's model – system image – user's model 三元组**是 Norman 框架对信息架构最直接的推论。设计者只能通过 system image（系统呈现出的全部可感知线索——命名、分组、层级、默认值）与用户沟通；可用性问题大多发生在三者之间的鸿沟 [N011]。由此得出三条信息架构纪律：(1) 架构必须选一个用户已知的隐喻基座（文件树、表、时间线、图）并保持一致，否则用户的 model 系统性错位；(2) 暴露实现细节（如把内部 job ID 作为一级导航维度）会污染用户概念模型；(3) 架构可视化的价值在于直接外化概念模型，使用户无需在脑中维护系统结构——这是"knowledge in the world vs knowledge in the head"的直接应用 [N011]。

### 3.3 Shneiderman：黄金规则、直接操纵与信息检索真言

**Eight Golden Rules** 出自《Designing the User Interface》（1986 年初版，持续修订至 2016 年第 6 版及以后），措辞在各版基本稳定 [A024]。八条为：consistency；enable frequent users to use shortcuts；offer informative feedback（含**反馈分级**——频繁小动作给温和反馈、罕见大动作给实质反馈，比 Nielsen #1 更细）；design dialog to yield closure（动作序列有 beginning/middle/end，完成反馈使用户放下应急预案）；offer simple error handling；permit easy reversal of actions（可逆性降低焦虑、鼓励探索——对调试与数据探索工具是核心论据）；support internal locus of control（使用户成为行动发起者而非响应者）；reduce short-term memory load [A024]。性质：HEU。与 Nielsen 10 条大面积重叠但视角互补——Nielsen 是评估者视角的检查清单，Shneiderman 是设计者视角的构造指令；#4 closure 与 #7 locus of control 是 Nielsen 未显式覆盖的。

**Direct Manipulation（1983）** 三原则：continuous representation of the object of interest；physical actions or labelled button presses instead of complex syntax；rapid, incremental, reversible operations whose impact is immediately visible [N021]。对开发者工具的映射：架构画布节点拖拽连线、时间轴直接框选时间窗、查询条件点选/拖动过滤 chip——把"语法操作"转为"对象操作"。反模式同样由原则 3 定义：拖拽触发不可逆副作用而无预览。性质判定：HEU（概念框架加大量后续理论化与实证），其价值不在"拖拽"这一技术形式而在三原则所定义的交互品质——持续表征、身体化动作、增量可逆；Canvas/Timeline 类复杂交互的评估可以直接以三原则为检查维度。

**Visual Information-Seeking Mantra（1996）**——"Overview first, zoom and filter, then details-on-demand"——出自 IEEE Visual Languages 会议论文，同文提出 task-by-data-type 分类学：7 种数据类型（1D/2D/3D/temporal/multi-dimensional/tree/network）× 7 种任务（overview, zoom, filter, details-on-demand, relate, history, extract）[N019]。该文被引逾 9000 次 [N019]。对 Systemsmith 目标形态的系统映射是直接的：架构画布/服务图 = 全系统依赖拓扑 overview（可配 minimap）+ 按 namespace/team/层级过滤、局部展开 + 选中节点属性面板（metrics 摘要、owner、SLO）——对应 overview + relate + details；数据浏览器（表）= 聚合视图（列分布直方图探查）+ facet 过滤/列选择/排序 + 行展开 record inspector——对应 filter + extract；日志浏览器 = 时间直方图（log volume over time）+ severity/service/全文过滤与时间窗缩放 + 单条展开结构化字段与前后文——对应 zoom + filter + details；指标面板 = 多面板 dashboard + 时间窗与 label 维度下钻 + 单点 tooltip 与 exemplar 跳转 trace——对应 overview + relate；Trace 浏览器从 trace 列表、瀑布图到 span 详情与火焰图，覆盖全部 7 任务；调试器/时间线 = 执行时间线全貌 + 缩放至可疑区间 + 单帧变量检查——对应 zoom + details + history。横切总原则是 overview 与 detail 并存（focus+context）而非页面跳转替换，过滤操作可逆可见（filter chips），details 不离开上下文（侧栏/popover 而非整页替换）[N019]。**常被遗忘的 history 与 extract 两个任务是专业工具与普通 dashboard 的分水岭**：history = "keep a history of actions to support undo, replay, and progressive refinement"，extract = "allow extraction of sub-collections and of the query parameters"——查询可分享（URL 编码全部状态）、分析路径可回放，都是这两个任务的直接实现 [N019]。

**批判：authority ≠ 证据强度**。mantra 本身是观点性文章而非实证模型。Craft & Cairns 2005 在 InfoVis 的批评指出：mantra 是经验性指导、不可证伪，且"overview first"并非对所有任务最优——已知目标搜索时 overview 是浪费（存在 search-first 的反向 mantra 场景）[A021]；Shneiderman 本人在 2026 年访谈中自述该文 "no empirical results… opinion piece"，且七任务中只有前四在后续文献中流行（单一来源，但为作者自述）[E023]。知识底座中该条目应标注：authority 高（原始同行评审论文，被引 9000+），证据强度按 HEU 对待。这一案例是证据分级制度的最佳教材：交叉验证中两个研究维度曾分别给该文赋 S 级与 A 级，裁决规则最终定为"原始同行评审论文 = S，教科书/综述 = A"，但 authority level 与证据强度必须分开标注——高被引与教科书地位提升的是可溯性，不是可证伪性。

### 3.4 共同根源分析：三套体系的交集、差异与后世的重复包装

三套体系的交集可以精确枚举。**一致性**是三者共同的第一原则：Nielsen #4、Shneiderman 规则 #1、Norman 的 cultural/logical constraints 与 conceptual model 一致性，全部指向"系统行为可预测"。**反馈**是共同第二原则：Nielsen #1、Shneiderman 规则 #3（且更细地分级）、Norman 的 feedback 与 Gulf of Evaluation。**错误观**同构：Nielsen #5/#9、Shneiderman 规则 #5/#6、Norman 的 slips/mistakes 分类，共同立场是"预防优于恢复、可逆性优于确认弹窗"。**记忆减负**：Nielsen #6、Shneiderman 规则 #8、Norman 的 knowledge in the world，共同根源是工作记忆容量限制（第 4 章）。差异在视角而非内容：Nielsen 面向评估（检查清单+成本模型）、Norman 面向概念（解释为什么出错）、Shneiderman 面向构造（设计指令+交互范式）。

两个推论。其一，ISO 9241-110:2020 自述其推荐来源是"Bastien、Dzida、Molich、Nielsen、Tognazzini 等工效学研究与启发式文献的组合" [N045]——规范层与 Canon 层共享同一文献根系，标准不是另一套知识，而是这些源头的制度化沉淀；换言之，第 2 章与第 3 章不是两棵知识树，而是同一根系在"规范"与"学术"两种载体上的分叉，知识底座可以用一组映射关系而非两份重复条目来承载。其二，后世层出不穷的"设计原则清单"（各类 UX laws 站点、设计系统原则页）大多是对这三个源头的重新包装与稀释：对照可见，Nielsen 10 条、Shneiderman 8 条与 ISO 7 原则在三倍的数量差异下覆盖的概念簇几乎相同——一致性、反馈、错误、记忆减负、用户控制；多出来的条目要么是同源的细分（engagement、closure），要么是语境特化（文档、效率）。知识底座应优先索引源头文献，对二手清单只做对照映射——同时按跨维度洞察 ② 执行可还原性测试：能还原到认知/知觉不变量的入 Universal 库，绑定平台时代的入 Convention 库，回溯不到一手来源的入 Myth-Quarantine 库。

## 4. 认知基础

本章收录证据强度最高的一层知识：可还原到人类感知与认知不变量的科学模型（[SCI]）。它们的共同特征是有原始实验、可复现数据与明确边界条件——也正因为有边界条件，它们被抽掉边界传播后就成了 UX 神话（4.5 节）。

### 4.1 感知：Gestalt、前注意加工与变更视盲

**Gestalt 分组原则**。proximity、similarity、good continuation、closure、common fate 与总纲 Prägnanz 源自柏林学派：Wertheimer 1912 年 phi 现象研究与 1923 年分组律专论，Koffka 1935 年与 Köhler 系统化 [N027][A037]。两处源流考证需记档：figure-ground 独立源自 Rubin (1915)；common region 与 uniform connectedness 是 Palmer & Rock 1994 的增补，**不在** Wertheimer 1923 原始清单中 [N027]。性质判定：描述性经验定律——原始演示是定性现象学而非受控实验，但鲁棒可复现并被现代视觉科学继承，作为 UI 依据强于一般 heuristic。工程含义：proximity 与 common region 是信息分组的零成本通道（留白/容器先于颜色与边框）；uniform connectedness 是最强分组线索——架构图中"连线"语义因此极重，滥用连线会造成虚假分组。另澄清一则讹传：Koffka 的原意是 "the whole is **other than** the sum of its parts"（整体是另一种东西），而非流行的 "greater than" [A037]。

**前注意加工（pre-attentive processing）**。有限的一组视觉特征（色相、朝向、强度、尺寸、形状、曲率、线长、closure、运动等）可在约 200–250ms 内、无需聚焦注意、并行地被检测——Healey、Booth & Enns 1993 年将其系统化为可视化设计方法，Ware 的教科书进一步工程化 [N028][A038]。这是视觉层级的实证机制：尺寸/对比/位置/留白之所以能引导初始注意分配，是因为它们作用于前注意通道。边界条件：特征间有干扰与不对称（斜线中找竖线快，反之慢；随机色相干扰形状边界检测），多特征叠加不等于多通道并行 [N028]。对可观测性 UI 的推论：异常检测应编码在前注意通道（红 vs 灰、长度、位置），让"扫一眼就知道哪里坏了"成为物理事实；要求逐格阅读才能发现异常的仪表盘，浪费了 200ms 通道。

**变更视盲与注意视盲**。Simons & Chabris 1999 大猩猩实验中约半数被试注意不到全程可见的意外事件 [N009]；Simons & Levin 1998 真人换脸"门"实验中 15 名被试有 8 人未发现对话者被替换 [N008]。教科书级反复复制的结论对专业工具是一条纪律：**不要指望用户注意到界面中悄然变化的状态**——异步任务完成、配置漂移、数据刷新必须有主动信号（badge/动画/toast），否则等同没发生；监控告警若靠"页面某处数字变了"传达，必然漏报。前注意加工决定"一眼能看到什么"，变更视盲决定"一眼之后还会错过什么"，两者互补。

### 4.2 记忆与认知负荷

**工作记忆容量：Miller 7±2 与 Cowan 4±1**。Miller 1956 年论文是一篇综述性讲稿，汇集两类任务的上限巧合——单维绝对判断（通道容量约 2.3–3 bits）与即时回忆广度（digit span）——并非单一常数的测量，Miller 本人称"七"为修辞性巧合 [N044]。Cowan 2001 年在阻断复述与组块化的条件下重估，纯粹容量约为 4±1 chunks，这是当前认知科学主流共识 [N043]。**"菜单/导航不能超过 7 项"是对 Miller 的范畴错误**：Miller 测的是回忆（脑中保持），可见菜单是再认（扫描），不经过该瓶颈；Miller 本人表态该上限"has nothing to do with a person's capacity to comprehend printed text"，Nielsen 与 Tufte 均公开驳斥此用法 [B025]。正确的 UI 推论有三：需要在脑中同时保持的东西（跨面板比较的中间结果、多步操作的临时状态）应 ≤4 chunks 或外化到界面；chunking 是设计杠杆——专家把模式当 chunk，因此专家界面的密度上限高于新手，**容量随 expertise 弹性变化，固定数字上限无意义**；决定菜单效率的是 Hick 定律（决策时间），不是 Miller [N044][N010]。

**Recognition vs recall**。记忆心理学的长期实证：再认成绩系统性优于自由回忆，因再认提供提取线索；Nielsen #6 是该发现的 UI 转译 [A050]。命令面板 + 模糊搜索、IDE 补全、查询历史、最近文件，都是把回忆任务转成再认任务；CLI 与 GUI 之争的部分本质是 recall vs recognition 之争。

**Cognitive Load Theory（Sweller）**。CLT 三分法：intrinsic（材料固有的元素交互复杂度）、extraneous（呈现方式造成的浪费）、germane（图式构建的生产性负荷）；设计目标是削减 extraneous、管理 intrinsic、为 germane 留预算 [N020]。两个易被忽略的事实：其一，2010 年 Sweller 已将 germane 重新定义为"重定向到处理 intrinsic 的工作记忆资源"而非独立第三负荷源，许多教科书仍在教旧版 [N020]；其二，**expertise reversal effect**——对新手有益的支架对专家变成冗余负荷，"不存在抽象的好设计，只有对特定专家度的好设计"。这是高密度开发者工具不必为新手极简化的理论依据，也是渐进披露的理论依据 [N020]。迁移边界：CLT 的语境是教学设计，搬到任务型工具时应聚焦 extraneous load（无关装饰、split-attention、冗余呈现），而非一味减负。

### 4.3 行动定律：Fitts、Hick-Hyman 与系列位置

**Fitts's Law**。Fitts 1954 年借 Shannon 信息论建模快速瞄准运动：MT = a + b·log₂(2A/W)；MacKenzie 1989/1992 证明 Shannon 形式 ID = log₂(A/W + 1) 拟合更优并成为 HCI 标准（ISO 9241-9）[N025][N017]。这是 HCI 中复现次数最多的定量模型之一 [N017]。适用条件：快速瞄准式指针运动（鼠标/触控/指点杆）、ID 中等范围；屏幕边缘/角落目标等价于无限大 W——这是菜单栏置顶、开始按钮置角的定量依据 [N017]。常见误用有四：不适用滚屏、拖拽、键盘、语音；一维形式向 2D 目标推广需 smaller-of 或 W' 模型；"按钮做大总没错"不成立（W 收益对数递减）；触屏无指针驻停，边缘技巧失效 [N017]。

**Hick–Hyman Law**。Hick 1952 年以 10 灯反应时实验发现 RT 随 log₂(n+1) 增长；Hyman 1953 年证明决定变量是**刺激信息量（熵）**而非选项数本身——操纵选项概率与序列条件概率后，RT 始终跟踪 bits [N010]。适用边界：等概率、简单刺激-反应映射的选择反应时；高度练习/专家任务、视觉搜索（并行扫视）、有明确分类结构的菜单不适用或斜率剧降。UX 圈"选项越少越好"的线性解读是错的——成本单位是"一次翻倍"（1 bit），64 个分类良好的选项约 6 bits，不是 32 倍于 2 个选项。工程杠杆是**分类与概率**（高频项前置、用分组把一次大选择变成两次小选择），不是机械砍选项数 [N010]。

**Serial position effect**。Murdock 1962 自由回忆实验的 U 型曲线（首因 primacy + 近因 recency）[N023]。其 UI 应用（导航首末位放重要项）是回忆范式向浏览/再认场景的启发式外推——页面浏览不是序列化自由回忆任务，应按 HEU 对待 [N023]。

### 4.4 信息觅食：Information Foraging Theory

Pirolli & Card 的信息觅食理论（CHI '95 初版，Psychological Review 1999 定版）借最优觅食理论建模信息搜寻：information patch（何时离开当前信息源）、**information scent**——"the user's (imperfect) perception of the value, cost, or access path of information sources obtained from proximal cues"（链接文字、标题、摘要等近端线索）、information diet（信源选择）[N018]。其 SNIF-ACT 模型能解释真实网站 72–90% 的链接选择方差（理论为高置信，定量预测效力为中高——用户并不总理性评估全部选项）[N018]。工程推论：导航质量的正确度量不是点击数而是**每一步的 scent 强度**——链接与过滤项的文案是否预示其后内容；文档站、错误码、span 命名、日志字段名都是 scent 载体。对高信息密度专业工具，这是信息架构与标签系统的第一性原理。

### 4.5 UX 神话鉴定

下表对传播最广的"UX 定律"逐条鉴定。判定标准：能否回溯到一手来源、原始主张的边界条件是否在传播中丢失。

| 流行条目 | 流行主张 | 判定 | 证据与正确替代 |
|---|---|---|---|
| 3-click rule | 任何内容 3 次点击内可达，否则用户流失 | **Myth，已证伪** | 源自 2001 年经验之谈，无实证。Porter/UIE 2003 测试：任务超过 3 次点击后放弃率不上升，满意度与点击数无关；Nielsen 报告某电商站把商品从 3 次点击改为 4 次后 findability 提升约 600%；NN/g 专文判定 "The 3-Click Rule for Navigation Is False" [A032]。正确替代：information scent——用户放弃发生在 scent 丢失处，不在第三次点击处 [N018]。 |
| Doherty Threshold | 响应时间 <400ms 生产率出现拐点 | **弱证据，数字不可复核** | 原始文献 Doherty & Thadhani 1982 是 IBM 内部技术报告（常误引为 IBM Systems Journal 论文，另有 "Doherty & Kelisky 1979" 讹传）；主结论来自大型机时代单一环境，原文难以获取，400ms 关键数字无法独立复核 [B032]。更稳健的框架是 R. B. Miller 1968 的 0.1s/1s/10s 三级阈值（Nielsen 1993 沿用至今）[N030]。方向性结论"越快越好"有当代支持，但 400ms 不应作为硬阈值引用。 |
| Tesler's Law | 复杂度守恒：每个应用有不可约减的复杂度，问题只是谁承担 | **格言，无实证** | Larry Tesler 1980 年代提出的设计哲学，无实验、无论文；作为"复杂度预算分配"的提醒有用（默认设置与自动化把复杂度从用户侧移到系统侧），不能当可验证规则；流行网页所附"研究基础"系二手拼凑（流行化载体见 [C039]）。 |
| "菜单 ≤ 7±2 项" | 导航/菜单项不得超过 7±2 | **Myth，范畴错误** | 对 Miller 1956 的误用：回忆容量 ≠ 可见菜单扫描；Miller 本人、Nielsen、Tufte 均公开驳斥 [N044][B025]。广而浅的菜单反而更优。决定菜单效率的是 Hick 定律与 scent [N010][N018]。 |
| Jakob's Law | 用户大部分时间花在别人的网站上，故应遵循惯例 | **HEU（合理格言）** | Nielsen 基于用户行为观察的格言，非实验定律；与 Nielsen #4 一致性原则同源 [A050]。作为平台惯例服从的论证可用，但属 convention 层，不是认知不变量。 |
| "N=5 评估者发现 85% 问题" | 5 人启发式评估即可发现绝大多数问题 | **有条件成立（规划估计）** | 同源 Nielsen & Landauer 1993 泊松拟合：λ≈0.31，N=5 时约 75%，区间 2/3–85%；是成本-收益规划估计而非定律，问题发现率随界面与评估者而异 [N012]。 |
| Peak-End / Aesthetic-Usability 等 | 峰终定体验；好看=好用 | **SCI 但降一档** | 峰终定律有 Kahneman 实验支撑但属记忆性评价规律，迁流至 UI 旅程设计是合理外推；aesthetic-usability effect 有 Kurosu & Kashimura 1995 原始证据，方向可靠但"好看=好用"的强版本不成立。均按 HEU 对待。 |

**表格分析**。三个模式贯穿全部神话。其一，**神话的共性不是"错误"而是边界条件丢失**：Miller 的"回忆"边界、Doherty 的"大型机时代"边界、3-click 的"无实证"出身，在二手传播中被逐一抹除，剩下的数字才显得像定律——这直接支持知识底座的入库纪律：每条规则强制携带适用范围与原始边界字段，无一手来源者物理隔离至 Myth-Quarantine 库。其二，**每个神话背后都有一个真实的、更弱的机制**：3-click 背后是 scent，"7±2 菜单"背后是 Hick 定律与 chunking，Doherty 背后是 Miller 1968 三级阈值——辟谣的正确动作不是删除而是替换。其三，**流行度与证据强度零相关**：Laws of UX 类汇编站把 SCI、HEU 与 MYTH 不加区分地并列 [C039]，是神话再生产的主要机制；对 Agent 而言这构成具体的输入风险——用户提示词中携带的神话（"帮我遵循三次点击原则"）应被知识库主动识别并反驳，这是神话库的反向价值。

