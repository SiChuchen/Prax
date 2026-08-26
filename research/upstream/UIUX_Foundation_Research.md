# UIUX Foundation Research

> Systemsmith Design Intelligence 基础研究 · 主报告（Deliverable 1）
> 研究完成日期：2026-08-25 ｜ 引用格式：Source Registry 全局 ID（见 Source_Registry.md）
>
> 本报告覆盖：HCI 历史与理论脉络（第 1 章）、核心标准（第 2 章）、核心理论（第 3 章）、认知基础（第 4 章）、信息架构（第 5 章）、交互设计模式（第 6 章）、视觉设计基础（第 7 章）、无障碍（第 8 章）、可用性评估（第 9 章）、平台设计系统（第 10 章）、企业设计系统与设计令牌（第 11 章）、AI/Agent 影响（第 12 章）。
> 配套交付物：Source Registry（D2）、Universal Design Principles（D3）、UX Heuristics（D4）、Knowledge Taxonomy（D5）、Pattern Language Research（D6）、Design Rule Schema（D7）、SDIR Feasibility（D8）、Architecture Recommendations（D9，含 Q1–Q15 回答）。

---

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

---

本部分处理知识底座的"结构层"：信息架构回答"内容如何组织才能被找到"（第 5 章），交互设计模式回答"组件如何组合才能解决用户问题"（第 6 章），视觉设计基础回答"信息结构与语义如何被感知系统读取"（第 7 章），无障碍回答"哪些设计要求已被规范化为可测试的硬约束"（第 8 章）。四章共享同一条纪律：区分实证模型、设计启发式、平台惯例与传播中的神话，并为每条知识标明适用边界。

## 5. 信息架构

### 5.1 IA 基本理论：北极熊书与四大系统

信息架构（Information Architecture, IA）的规范性文本是 Rosenfeld、Morville 与 Arango 合著的《Information Architecture for the Web and Beyond》第 4 版（2015 年 10 月，O'Reilly）；其第 1 版（1998）因封面被称为"北极熊书"，是第一部把 IA 作为独立专业实践处理的综合性文本，截至 2026 年 8 月尚无第 5 版 [A020]。该书的核心主张有二：其一，组织数字信息是一门独立学科，而非视觉设计或工程的副产品；其二，可查找性（findability）本身是一个设计问题——用户找不到的信息等于不存在。围绕这两个主张，书中给出沿用至今的四大系统框架：组织系统（organization，内容如何分组与结构化）、标签系统（labeling，如何命名）、导航系统（navigation，用户如何在结构中移动）、搜索系统（search，用户如何直接查询）[A020]。

对这套框架必须做批判性阅读。有书评者指出，四大系统围绕一个相对稳定的内容生产假设构建——"组织生产信息，用户消费并导航信息"；这一假设在用户生成内容、算法策展与信息流（feed）消解固定层级的场景下明显吃紧 [E021]。这一批评对 Systemsmith 的适用性判断恰好有建设性：开发者工具与企业软件恰恰是"有人控制语料库"的场景——实体、日志、任务、指标都是结构化对象，四大系统框架高度适用；但 Agent 生成的动态视图、个性化工作区属于"涌现式 IA"，超出北极熊书的建模范围，知识底座需要为其单设条目。导航设计另有标准层锚点：ISO 9241-115:2024 把导航设计明确纳入概念设计—交互设计—界面设计的过程指南体系 [N063]，说明 IA 已从社区方法论进入规范文本，但其形式仍是过程指南而非可测试条款。

### 5.2 从心智模型推导页面结构：OOUX 与 ORCA

IA 的有效性最终取决于一个心理学事实：心智模型是用户对系统如何工作的内部表征，可用性的核心困境是设计者模型与用户模型之间的鸿沟——用户只能通过系统映像（system image）了解产品 [B039]。推论是直接的：可查找性取决于结构是否匹配用户预期的位置，而非工程上的逻辑正确性；用户按"他们以为东西在哪"导航，而不是按"东西实际在哪"导航 [B039]。这回答了一个对 Agent 至关重要的问题——为什么从数据库表直接生成 UI 是错的：数据库 schema 反映的是存储组织，不是用户的对象模型；两者之间的转换层就是 IA。

当前最可操作的转换层方法是面向对象 UX（Object-Oriented UX, OOUX）及其 ORCA 流程。OOUX 由 Sophia Prater 提出，源于她 2012 年设计 CNN 美国大选网站的实践，2015 年经 A List Apart 宣言公开 [B027]；其核心主张是"对象优先于动作"——先识别系统的核心对象及其关系、属性，再设计流程与界面，依据是人类天然以对象为单位范畴化世界 [B026]。ORCA 是其操作化流程：Objects（对象）→ Relationships（关系）→ Calls-to-action（行动）→ Attributes（属性），一个 15 步的迭代过程 [E024]。该方法与 Systemsmith 的映射是直接的：对象 = 页面锚点；关系 = 导航路径；CTA = 每个对象的操作集；属性 = 列表列、筛选项（facet）与排序键。关键纪律在于对象的来源：对象清单应从用户访谈与日志中的名词提取（Prater 称之为 "noun foraging"）获得，而非对数据库 schema 的直译 [B027]——这正是"不从数据库表直接生成 UI"的正面替代方案。

OOUX 的局限同样必须入库：它不覆盖流程、动效与状态建模；对包含搜索、标签、权限的大型系统不替代完整 IA 层 [E025]。更根本的是证据地位问题——OOUX 目前没有任何独立同行评审的实证验证，证据形态是实践者案例与社区背书，交叉验证将其列为"实践共识而非研究证实"（Medium Confidence，单一维度来源）。知识底座应将其标注为方法论启发式（methodological heuristic）：结构可用、可教、可生成，但不得作为"已被实验证实"的知识引用。

### 5.3 导航与层级的实证：宽度、深度与信息气味

深度与广度的权衡是 IA 中最常被民科化的话题。"越扁平越好"和"三次点击规则"均属传播中丢失边界条件的简化。可回溯到实验的证据是 Larson & Czerwinski（Microsoft Research, CHI 1998）的层级菜单研究，经 Human Factors International 综述转述：约 16 个未分组顶层选项、下接 2–3 层的"中等宽度"结构在效率、可学性与错误率上最优；机制解释是用户在宽而浅的结构中把更少时间花在做分类决策上、更多时间花在视觉搜索上，而分类决策比视觉扫描更耗费认知资源 [B017]。同一综述还给出一个对导航设计优先级排序的直接结论：顶层标签之间的区分度——即信息气味（information scent）——比层级形状本身更关键；凹形层级（首层宽、中间窄、末层再宽）对浏览型任务最优 [B017]。置信度纪律：该结论经二手综述转述，原始实验语境为 1998 年的 Web，交叉验证列为 Low Confidence（L2）——方向可用，"16"这个具体数字不可当硬阈值引用。

信息气味有独立的理论来源：Pirolli & Card 的信息觅食理论（Information Foraging, 1999）把用户建模为在信息斑块（patch）间移动的觅食者，依靠链接文本、标题、搜索结果摘要中的"触发词"（trigger words）判断路径价值；气味弱则放弃 [N018][N050]。该理论的边际价值定理还有一个时代推论：站点间迁移成本越低（搜索引擎、快网），用户在单站停留越短，信息寻求从"宴席"变成"自助餐" [N050]。两组证据汇合于同一设计结论：导航标签的措辞直接决定 scent，标签优化就是导航性能优化——"减少点击数"若不以 scent 为前提是无效目标。这对 Agent 产品的含义是具体的：列表项标题、菜单项、空状态文案都是 scent 载体，应进入可验证检查项。

结构模式的适用条件可归档如下（均属设计惯例层，非实证定律）。导航系统按作用域分为全局导航（global，跨页面持久）、局部导航（local，当前分区内）与辅助导航（supplemental，站点地图、索引、指南），这一三分来自北极熊书 [A020]。hub-and-spoke（中心页链接辐条页）适合复杂信息组织，辐条页之间不互相链接，是设置（Settings）类界面的经典骨架 [A019]。面包屑（breadcrumb）有位置型、路径型、属性型三种成熟形态 [A020]；在分面（faceted）场景下，业界收敛于"集成式分面面包屑"——已选 facet 值串入面包屑路径、可单独移除，且面包屑中的值可下拉更换 [C020]。层级的总纪律与 5.3 开头的实证一致：结构形状服从 scent，scent 服从用户词汇。

### 5.4 IA 验证方法：card sorting、tree testing 与 progressive disclosure

IA 研究方法的正确分工是生成与验证分离。卡片分类（card sorting）是生成式方法，用于揭示用户心智模型中的分组：开放式（open）最常用，因为能获得用户分组的全貌；封闭式（closed）常被误用于验证，NN/g 明确建议改用树测试（tree testing）替代；混合式一般不推荐，因为预置类别会锚定用户 [A058]。同一条纪律：不要期待参与者产出可直接使用的最终标签——他们给出的类别名是研究素材，不是发布文案 [A058]。

树测试是评估式方法：给用户一棵纯文本的层级树和一个找物任务，把 IA 与视觉设计完全隔离。工具厂商给出的实践标准是健康树成功率 80% 以上、样本 30–50 人，交叉验证将其标注为 Low Confidence（L1，厂商建议值而非学术标准）[C052][C028]。2025 年出现了一条对方法论本身的重要实证：一项 180 名参与者、1800 次任务完成、6 条件的同行评审实验发现，树测试的变体选择显著影响结论——"完整显示历史导航选择且可直接回退"的变体与高保真原型中的真实导航行为最接近 [N033]。这条证据对 Systemsmith 有工程含义：若用 AI 模拟器自动化 IA 验证，模拟器必须保留路径历史与回退能力，否则结论存在系统性偏差。

渐进披露（progressive disclosure）需要单独标注证据状态。Nielsen 2006 年将其定义为"把高级或少用功能推迟到次级界面，使应用更易学、更少出错"，并给出四条指南：初始/次级功能的正确分割、通往次级层的入口 scent 必须明显、避免多条通往次级选项的路径、可为不同控制设置不同次级界面 [B042]。但其实证基础薄弱：方法源头是 Carroll & Rosson 1980 年代在 IBM 的"训练轮"研究，且原作者自己承认缺乏有效性证据——研究只覆盖单一应用（字处理器）与单一界面风格；IxDF 的学术百科条目明确标注 "Empirical research lacking" [B042]。其失效条件亦有共识：需要同时对比全部信息时、隐藏安全关键信息时、额外步骤成本大于其降低的复杂度时，不应使用 [B043]。入库定位：设计启发式，弱证据，带明确反模式条件——这是"流行但未被证实"的典型案例，与"菜单不超过 7 项"的神话（第 4 章）共享同一传播病理。

## 6. 交互设计模式

### 6.1 Pattern Language 方法论史：从建筑到 HCI

交互设计模式的知识结构源头是 Christopher Alexander 的建筑模式语言。Alexander 等人 1977 年出版的《A Pattern Language》收录 253 个模式，每个模式"描述一个在我们环境中反复出现的问题，然后描述该问题解法的核心，使得这个解法可以使用一百万次而不重复同一个样子"；完整条目结构为问题（problem）、语境（context）、作用力（forces）与解法（solution）四元组 [N055]。Alexander 超越"问题—力—解法"三元组的地方在于 pattern language 本身——模式之间存在构成关系，大模式由小模式构成，知识单元不是孤立条目而是一张关系网络。这一结构判断对 Systemsmith 是直接的：知识底座中的 pattern 条目必须携带 problem/context/forces/solution/tradeoffs 字段并互相链接，否则就退化为组件罗列。

传播链是可验证的里程碑序列：1977 年 Alexander 原书；1987 年 Kent Beck 与 Ward Cunningham 在 OOPSLA 用 Smalltalk 首次将模式思想应用于软件；1993 年 Hillside Group 组织首届 PLoP 会议；1994 年 GoF《Design Patterns》出版，模式成为软件工程主流词汇；1997–1999 年 Jenifer Tidwell 的 Common Ground 成为 HCI 领域第一个成规模的交互模式集，同期 CHI'97 举办"面向交互设计的模式语言"工作坊；2000 年代 van Duyne 的《The Design of Sites》与 van Welie 的模式库相继出现；2005 年 Tidwell《Designing Interfaces》第 1 版出版，当前为第 3 版（2020）[E037][B016][A019]。这条链上有一个常被忽略的方法论事实：HCI 继承的是 Alexander 的"条目结构"，但多数后来的模式库丢掉了"语言"——模式间关系。

模式的正确定义必须先把一个混淆排除：pattern ≠ component。组件是可编码的 UI 原子（按钮、输入框），模式描述组件如何组合起来解决一个用户问题（搜索 + 过滤 + 结果列表 + 空状态共同构成"查找对象"模式）；按 Brad Frost 原子设计的映射，组件是原子与分子，模式是生物体与模板 [B040]。另有一个对知识工程直接相关的警告：模式命名无标准本体，同一模式在不同库中名称不同甚至同名异物 [B016]——Systemsmith 知识底座必须自建 canonical 命名与别名映射，不能指望社区命名一致。

### 6.2 兴衰：独立模式库的死亡与 2026 年的存活形态

HCI 模式语言的规范性批判早已存在。Dearden & Finlay 2006 年在《Human–Computer Interaction》上发表的批判综述提出四个关键问题——什么是模式、什么是模式语言、模式如何被使用、价值如何反映在模式方法中——其实质结论是：HCI 模式语言概念不清（pattern、pattern language、guideline 混用），缺乏关于模式实际使用方式的实证研究，Alexander 的"价值负载"（quality without a name）在转译中丢失 [A063]。

此后十余年的历史证实了这一批判的预见性。Yahoo Pattern Library 随 Yahoo Developer Network 关闭而死（仅存 Wayback Machine 存档与 Malone 等人 2005 年的实施案例论文 [B038]）；van Welie 的 welie.com 模式库已下线；Infragistics 的 Quince 停止维护；ui-patterns.com 仍在线但已转型为付费内容产品 [C059]。死亡原因可归纳为四条，每条都对知识库建设有直接教训：其一，独立库无商业模式与维护所有权，作者兴趣或公司战略转移即死亡；其二，设计系统兴起后"带代码的组件"比"纯文档的模式"更接近交付物，模式文档被视为重复劳动；其三，多数库是扁平条目集合，没有 Alexander 式的模式间关系，退化为一次性参考列表；其四，条目无实证状态标注，无法区分"验证过的模式"与"某人的偏好" [A063][B040]。

2026 年存活的形态是企业设计系统的 Patterns 层。IBM Carbon 把模式定义为"用户达成目标的最佳实践解法"（best practice solutions for how a user achieves a goal），维护 14 个经审批的通用模式，覆盖 Common actions、Dialogs、Empty states、Filtering、Forms、Loading、Notifications、Search 等 [C055]；Atlassian 的 Patterns 层定位在页面与模板级，其 Forms 模式内含渐进披露与多步表单的应用规则（如"永远不要禁用提交按钮，改用校验与错误消息说明需要做什么"）[B045][C056]。同时出现一个新类目：AI 交互模式。2026 年的横向分析显示 Carbon、Cloudscape、Atlassian、GitLab 四个系统已收敛于三个共识模式——给 AI 一个独立入口、使生成输出可识别、回答"结果不好或错了怎么办" [E009]。历史教训的推论是：模式知识只有嵌入交付工作流才能存活；对 Systemsmith 而言，被 Agent 在生成时直接消费就是这个嵌入——知识底座不是又一个参考资料站，而是工作流的一部分。

### 6.3 核心模式解析

以下按 problem / context / forces / tradeoffs 结构解析对开发者工具最关键的十个模式。每个模式的证据等级随条目标注；这是知识底座 pattern 条目的示范形态。

**List→Detail / Master-detail**。问题：用户在集合中定位对象并查看、操作其细节。解法有两种骨架——双栏选择器（two-panel selector，列表与详情并存）与单窗钻取（one-window drilldown）[A019]。语境：桌面宽屏、对象集大、需频繁切换对比时用双栏；窄屏或沉浸式任务用钻取。作用力：屏幕占用 vs 切换成本。权衡：双栏占屏但对象间切换零成本；钻取丢失集合上下文，返回成本高。M3 的 canonical layout 体系将 list-detail 固化为窗口宽度档位的函数（compact 单栏、expanded 双栏常驻）[B022]——注意其断点数值（600/840/1200/1600 px）是平台惯例，"宽度档位驱动 pane 数"才是可迁移内核。

**Inspector（检查器）**。问题：查看、编辑当前选中对象的属性而不离开工作上下文——Shneiderman "details-on-demand" 的面板化 [N019]。语境：画布/编辑器类产品（架构画布、设计工具、IDE），与选择（selection）强绑定；三栏工具界面（browser = overview、canvas = zoom、inspector = details）是该 mantra 在专业工具上的标准映射。作用力：上下文面板挤占主工作区 vs 免去页面跳转。权衡：属性深时需要分组与面板内搜索；空选择状态必须设计（显示集合级信息还是引导选择）。证据等级：成熟实践共识，无期刊级实证。

**Settings（设置）**。问题：低频配置与高频操作分离存放，且能被找到。解法：hub-and-spoke——分类 hub 页 + 辐条详情页，外加设置内搜索兜底（用户记不得分类时直接搜设置项）[A019]。作用力：分类结构匹配用户心智模型 vs 工程模块划分；层级深度 vs 单页长度。权衡：分类错配心智模型即不可查找（scent 原则的实例，见 5.3 [B017]）；层级超过两层显著恶化。证据等级：惯例 + 间接实证（scent 证据链）。

**Search（搜索）**。问题：用户带着明确目标词进入——搜索是 findability 的直达路径，与浏览互补 [N050]。解法要点：自动补全、过滤器、排序、空结果恢复路径；Carbon 将 Search 列为通用模式并规定其行为契约 [C055]。作用力：搜索质量依赖索引与排序工程（界面之外）；结果必须落到 IA 节点上，即搜索与浏览结构需一致。权衡：弱索引上的好 UI 仍是坏搜索——此模式的失败大多在工程层而非交互层。证据等级：惯例 + 强理论锚（信息觅食）。

**Filter / Faceted（分面过滤）**。问题：在大结果集上按属性收窄。规则已高度收敛：facet 内取 OR、facet 间取 AND；已选条件以可移除的 chips 显示于结果列表上方并提供"清除全部"；显示各值计数；零结果值置灰禁用；facet 值默认显示前五个，其余渐进披露 [C021][C020]。关键纪律：facet 必须来自内容模型与用户研究而非 UI 团队的想象，覆盖不足约 15% 条目的 facet 应删除（它们制造空过滤状态）[C021]。作用力：过滤维度丰富度 vs 组合爆炸产生零结果死胡同。证据等级：多来源收敛的实践标准，置信高。

**Command Palette（命令面板）**。问题：在命令与对象数量庞大的工具中，专家用户需要不经菜单层级的直达路径。解法：⌘K/Ctrl+K 唤起，输入即搜索，同一界面完成跳转（findability）与动作执行；该模式从编辑器（Sublime、VS Code）扩散为 SaaS 通用模式，WordPress 6.9 将其全局化是主流化标志 [C057]。作用力：recognition over recall 的张力——菜单降低记忆负担，命令面板增加之；加速专家 vs 对新手不可发现。权衡：不可发现性必须用 UI 提示与快捷键教学补偿；它不能替代可见导航；结果排序质量决定模式成败。证据等级：成熟实践模式，无 HCI 期刊级实证（Low Confidence L3）——但其与 Systemsmith 的键盘导向专业用户场景高度匹配。

**Undo 优于 Confirmation（撤销优于确认）**。问题：如何防止破坏性操作造成损失。解法分叉：可逆操作应立即执行并提供限时撤销（toast/snackbar + Undo），只让真正犯错的人支付成本，而非让全体用户每次支付确认对话框的税；真正不可逆或高风险操作（删除账户、转账、全员广播）才保留确认。该模式的规范锚点是 Nielsen 十启发式中的"用户控制与自由"和"错误预防"两条 [A050]。作用力：流畅性 vs 安全性；防止错误 vs 防止习惯化——确认框滥用会训练用户机械点击，保护力归零。权衡：Undo 要求系统架构真的能恢复（软删除、回收站）；假 Undo 比确认框更糟。证据等级：启发式层（NN/g forgiveness 原则），方向一致性强。

**Modal vs Non-modal Dialog**。问题：何时可以打断用户。NN/g 的定义：模态对话框把系统切入特殊模式、禁用主内容，仅当信息"重要到值得打断"时使用；非关键任务用非模态 [A013]。NN/g 明确警告滥用后果："当非必要信息以模态这种高优先级格式呈现时，用户将拒绝对该格式的后续实例给予注意"——狼来了效应 [A013]。作用力：强制注意 vs 打断成本与上下文丢失（移动端全屏化后尤甚）。权衡之外还有无障碍契约，属实现层硬约束：焦点进入 dialog、背景 inert、Esc 关闭、关闭后焦点回到触发元素，原生 `<dialog>` 元素与 showModal() 已处理大部分 [C015][N001]。证据等级：NN/g 规范文章 + W3C 行为契约，置信高。

**Overview first → Zoom & Filter → Details-on-demand**。问题：数据探索型界面的组织顺序。这是 Shneiderman 1996 年"Visual Information-Seeking Mantra"的核心，外加 relate/history/extract 三个任务；原文被引逾 9000 次，是信息可视化最有影响力的组织原则 [N019]。但必须标注其证据性质：Shneiderman 本人在 2026 年访谈中确认该文"没有实证结果，是一篇 opinion piece"；Craft & Cairns 2005 年指出其缺乏实证验证却被当作规定性原则使用 [E023][A021]。存在反向 mantra：van Ham & Perer 2009 的"Search, show context, expand on demand"适用于数据量大到无法先给有意义 overview 的场景 [A021]。适用条件：数据集可整体概览、任务以探索/监控为主；失效条件：用户带明确目标进入（此时 search-first 更优）。证据等级：高影响力观点文章——authority 高（原始论文）而证据强度低（作者自述无实证），两者必须分开标注。

**Dashboard vs Explorer（监控型 vs 探索型数据界面）**。问题：两类"数据界面"实为不同产品。判别标准：Dashboard 是"没人要求也会每天打开"的运营监控界面——用户不探索，"打开它，知道看哪里，拿到所需，离开"，可预期性本身就是特性；Explorer 是带着问题来的分析性探索，交互服务于下钻与关联 [B012]。设计分叉：Dashboard 优先前注意编码（长度与二维位置在毫秒内被并行加工，面积与色相需要主动解释——在运营仪表盘上，这决定用户是抓住异常还是错过异常）、异常优先排序、stale/error/loading 状态契约；Explorer 优先 filter/drill-down/关联视图与可分享的查询状态（URL 可溯源）[B012]。两者可用 overview→drill-down 组合，但信息架构不同，混用导致两边都做不好。证据等级：行业分析 + 感知机制锚（前注意加工，见 7.1），置信中高。

## 7. 视觉设计基础

### 7.1 视觉属性如何表达信息结构：教学法和它的感知科学地基

设计入门教育中最流行的视觉组织框架是 CRAP——对比（Contrast）、重复（Repetition）、对齐（Alignment）、接近（Proximity）。它出自 Robin Williams 1994 年的《The Non-Designer's Design Book》；书中实际按 Proximity–Alignment–Repetition–Contrast（PARC）顺序讲授，CRAP 是后人为好记而倒排的缩写，Williams 本人都承认这个缩写"好记但相当不得体" [A054]。必须明确标注其性质：这是一本面向非设计师的教学法著作，书中无实验、无引文，四原则在学术界没有实证地位。但教学法不等于错误——CRAP 中的 Proximity 可向上追溯到 Gestalt 分组原则：Wertheimer 1923 年奠定的 proximity/similarity/continuation/closure 等分组律 [N027]，以及 Palmer & Rock 1994 年增补的 common region（共同区域）；对齐与对比则可分别锚定到网格系统实践（7.4）与前注意加工研究。知识底座的正确做法是分两层存放：教学法层（CRAP，作为可教的组织词汇）与感知机制层（Gestalt + 前注意加工，作为可验证的解释）。

视觉层级的感知机制是前注意加工（preattentive processing）：视觉系统在无需主动注意的情况下、约 500 毫秒以内并行处理颜色、形状（大小、方向、长度）、空间位置与运动四类属性 [A038][N028]。这一机制把"视觉层级"从美学偏好改写为通道工程：层级设计的实质是把信息的重要性映射到视觉系统的并行通道上，使重要元素在注意力介入之前就被抓取。反过来的诊断同样成立：若页面上所有元素的前注意权重相等，视觉系统拿不到任何显著性信号，用户的主观体验就是"不知道先看哪"——层级失败的症状定义由此而来。至于 Scale（层级强度的幅度）、Balance（视觉重量分布）、Rhythm（间距与重复的节拍）这三个平面设计词汇，没有独立的实证文献线，应作为"组织性描述符"而非可验证规则入库——它们有用，但不可被当作科学主张引用。

### 7.2 密度与留白：弱实证、强论证与工业实践

留白（whitespace）是被营销数字污染最严重的主题之一。广泛流传的"留白提升 20% 理解率"可回溯到的实证是 Chaparro 等人 2004 年在 Wichita State SURL 的实验：四种留白版式对比，结论是页边空白（margins）同时影响阅读速度与理解，行距（leading）不影响阅读绩效但影响满意度与偏好——样本为 20 名大学生 [B030]。方向性结论可用（留白大于零有益），但任何精确效应量（如"20%"）都不可外推，交叉验证列为 Low Confidence（L5）。

密度的证据结构更诚实。直接的绩效证据来自 AR 显示实验：降低信息密度显著减少视觉搜索时间与放弃时间 [C029]——单一研究、AR 语境，向桌面专业工具迁移时必须降权。真正有力的论证是任务结构层面的：HEART 框架原始论文明确指出"Engagement 在企业场景价值有限，因为很多用户不是选择使用系统，而是工作要求他们使用" [A053]。这把"专业工具为什么可以且应当密"从美学问题转成效率问题：专家/高频用户的效率指标是单位任务的完成时间与错误率，而这两项受益于单位屏幕的并行信息吞吐。结论是"结构化密度"（structured density）：密度本身不是敌人，无结构的密度才是——靠网格、对齐锚点与语义色维持可扫描性，而不是削减信息量。工业实践已把密度做成一等设计维度并交给用户控制：Elastic EUI 的 DataGrid 提供 allowDensity/allowRowHeight 密度切换 [C009]，Adobe Spectrum 2 把可定制密度与对比度列为专业密集 UI 的核心愿景 [C041]，Microsoft Fluent 2 以 Teams/Outlook/Word 的生产力密度著称并提供密度模式 [B014][E018]。跨维度交叉验证将"密度是专业/企业工具的一等设计维度"列为 High Confidence（H7，三个维度独立取证）。

### 7.3 排版：惯例、弱实证与一条平台级硬知识

排版知识必须按证据强度分层入库。第一层是惯例：正文字符行宽（measure）45–75 字符/行、行高为正文字号的 1.4–1.6 倍——这是 Bringhurst/Tinker 排版工艺传统的通行建议，边界值只有弱实证支撑，应标注为"惯例 + 弱实证"而非规则；过短行导致换行过频、过长行导致回行丢失的机制解释合理，但"45"和"75"不是实验产物。第二层是教学法共识：字号层级（type scale）的作用是建立无歧义的阅读顺序，层级之间的对比必须足够大——"几乎相同"的字号差会被感知为错误而非层级；层级信号的主通道依次是字号、字重、间距、颜色。这两条与 7.1 的对比原则同构，可互相印证。

第三层是少数可列为硬知识的条目：表格数字（tabular figures）。等宽数字使数字列垂直对齐，直接提升财务与数据界面的可读性；proportional figures 适合行文，tabular figures 适合列读——"数字将被按列阅读时应优先使用等宽数字"是字体厂商与平台文档的一致结论，Microsoft Learn 与 Monotype Fontology 互证 [B037]。工程形态是 `font-variant-numeric: tabular-nums` / OpenType `tnum`；附带收益是数字动态更新时消除布局抖动（计时器、实时指标）。对 Systemsmith 这类高数据密度工具，这条属于"默认启用、可 lint 验证"的确定性规则。

### 7.4 网格与对齐：秩序系统的价值与边界

网格系统的原始权威是 Josef Müller-Brockmann 1981 年的《Grid Systems in Graphic Design》（Niggli，德英双语），覆盖 8–32 格场的构造 [A025]。其地位要精确表述：它是瑞士国际主义风格的从业者手册与教学正典，核心命题"网格是秩序系统而非束缚"——网格使变化在不产生视觉混乱的前提下成为可能——是设计哲学而非实证；书中还带有"清晰组织 = 诚实的传达"的伦理性主张，阅读时应识别为设计观。

8pt 间距网格是工业惯例而非感知规律：源头是 Google Material Design 2014 年的 8dp 基线网格 [B013] 与 Bryn Jackson 2014 年在 spec.fm 发表的《The 8-Point Grid》（命名与普及者）[B034]。选 8 的理由全部是工程性的：可被 1/2/4/8 整除；在 1×/1.5×/2×/3× 屏幕密度下整数缩放不产生分数像素；倍数间距（16/24/32/48）在视觉上可分辨。4pt 变体用于组件内部细间距。其局限同样要明确：网格列宽、图片对齐、光学修正（如圆形图标需要视觉放大补偿）都需要破例——"规则是默认值，不是定律"。8pt 的价值不在 8，而在于把间距从自由变量收敛为可 lint 的 token 集合：这是它对 Agent 的真正意义——可验证性。

对齐的机制性解释来自 Williams 本人：页面上任何元素都应与其他元素建立视觉连接，"没有任何东西应被随意摆放" [A054]。操作化为对齐锚点（alignment anchors）：每个元素至少与一条共享边或中心线对齐。这条原则的特殊价值在于它是少数可完全自动化的视觉规则——边界盒坐标一致性可以静态 lint，属于设计判断自动化分层中的"地板"层。

### 7.5 核心分析：为什么"颜色和组件都不错"的页面仍然不专业

这是 Systemsmith 视觉方向的中心诊断问题。答案是结构性的：专业感不居住在任何单一元素里，而居住在元素之间的关系层——层级梯度、对齐锚点、间距节奏、语义一致性。组件库交付的是零件质量，关系层恰好是零件供应商不覆盖、必须逐页检查的部分。据此可把"不专业"归因于六个可诊断的结构性病因：

| # | 结构性病因 | 感知机制 | 可检测性 |
|---|---|---|---|
| 1 | 层级不清 | 前注意通道无显著性梯度，所有元素等权竞争注意 [A038] | 半自动（显著性分析 / LLM-as-judge） |
| 2 | 对齐失锚 | 元素未与共享边/中心线建立视觉连接，被感知为随机摆放 [A054] | 可自动（边界盒坐标 lint） |
| 3 | 节奏混乱 | 间距不合同一基数、行高不合基线，垂直节奏断裂 [B034] | 可自动（spacing token lint） |
| 4 | 装饰与信息竞争 | 阴影/渐变/高饱和非语义色抢占前注意通道，稀释 status 语义 [A038][C007] | 半自动（色彩审计 + 视觉判断） |
| 5 | 容器滥用 | common region 过度使用产生边界噪音，分组信号自相抵消 [A018] | 半自动 |
| 6 | 数字排版业余 | 数据列数字不等宽不对齐、单位/精度不一致 [B037] | 可自动（CSS feature lint） |

这张表同时也是验证策略表：六个病因里三个可完全自动化（2/3/6），三个需要半自动视觉判断（1/4/5）——"专业感"并非不可验证的玄学，而是大半可以 lint、其余可以结构化评审的属性。这直接支持 Systemsmith "quiet/structured/dense" 视觉方向的工程化落地。

第 4 病因需要展开其机制：色相与饱和度是前注意属性，每一处高饱和色都在竞争并行注意通道；语义色（红 = 错误、绿 = 成功、黄 = 警告）只有在稀缺时才保有信号价值，用色密度上升则信噪比下降、状态语义失效 [A038]。Atlassian 的色彩规范把这一点形式化为 token 契约：颜色按"角色"（neutral/brand/information/success/warning/danger）引用而非按色值，并显式规定"不要用 accent 色表达语义"；emphasis（对比强度）是独立的注意力预算轴 [C007]。M3 的 x/onX 前景背景配对则把对比度责任内建进 token 结构 [B023]——克制用色因此不是审美偏好，而是可 lint 的系统纪律。

第 5 病因（卡片滥用）有直接的权威证据。common region 是强分组线索且会压倒其他分组线索，但 NN/g 明确警告"过度使用制造杂乱"（Overuse Creates Clutter）：边界本身就是视觉元素，每加一个容器就增加边框、padding、背景层级三层噪音；当屏幕上所有内容都被框住时，容器的分组信号自相抵消 [A018]。从 figure-ground 视角看，卡片把自身立为 figure、页面背景降为 ground，嵌套卡片制造多级 figure-ground，每级都消耗对比度预算；卡片内还有卡片且背景色差不足时，层级与容器双重信号衰减。替代分组手段应按成本递增排序使用：留白（proximity）→ 对齐 → 细分隔线（hairline）→ 背景色块 → 带边框容器；专业工具应默认用低成本手段，把容器留给真正需要"模块化实体感"的内容（此排序为 dim04 基于 Gestalt 与网格证据的综合推论，方向可靠，标注为机制推断而非实证）。

## 8. 无障碍

### 8.1 WCAG 2.2 与 WCAG 3.0：现行规范与草案状态

截至 2026 年 8 月，WCAG 2.2 是唯一现行有效的 W3C 无障碍 Recommendation（2023-10-05 发布，2024-12-12 勘误再版）[N005]。其架构为四层：POUR 四原则（Perceivable 可感知、Operable 可操作、Understandable 可理解、Robust 健壮）→ 13 条 guidelines → 可测试的 success criteria（SC）→ A/AA/AAA 三级 conformance [N005]。W3C 明确不建议对整站要求 AAA（"It is not recommended that Level AAA conformance be required as a general policy for entire sites"），这为"AA 做工程 baseline、AAA 选择性吸收"提供了规范依据 [N005]。WCAG 2.2 相对 2.1 新增 9 条 SC、移除 1 条（4.1.1 Parsing 标记 obsolete），且完全向后兼容——符合 2.2 即符合 2.1/2.0 [N005][E001]。

| 编号 | 名称 | 级别 | 对工具类产品的意义 |
|---|---|---|---|
| 2.4.11 | Focus Not Obscured (Minimum) | AA | sticky header/overlay 不得遮挡焦点组件——AI 生成布局的常见缺陷 |
| 2.4.12 | Focus Not Obscured (Enhanced) | AAA | 焦点组件完全不被遮挡 |
| 2.4.13 | Focus Appearance | AAA | 焦点指示器的最小面积与对比度 |
| 2.5.7 | Dragging Movements | AA | 拖拽操作须有单指针替代路径 |
| 2.5.8 | Target Size (Minimum) | AA | 指针目标 ≥ 24×24 CSS px |
| 3.2.6 | Consistent Help | A | 帮助入口位置跨页面一致 |
| 3.3.7 | Redundant Entry | A | 不得重复索取同次会话已填信息 |
| 3.3.8 | Accessible Authentication (Minimum) | AA | 认证不得依赖认知功能测试（有例外） |
| 3.3.9 | Accessible Authentication (Enhanced) | AAA | 进一步放宽认证要求 |

对这张表的分析要点有三。第一，9 条新增中只有 6 条位于 A/AA（2.4.11、2.5.7、2.5.8、3.2.6、3.3.7、3.3.8），即从 2.1 升到 2.2 的 AA 层实际增量负担仅 6 条，且全部是可工程化条目（几何判定、结构判定、流程判定），不需要重新审计——这是"默认采用 2.2"的成本论证 [N005][E001]。第二，对 AI 生成 UI 最易踩中的是四条：2.4.11（sticky 布局遮挡焦点）、2.5.8（小图标按钮无 24px 热区）、2.5.7（生成模型偏爱拖拽交互但忘记单指针替代）、3.3.7（多步表单重复索取信息）——应直接进入 Systemsmith 的生成时检查清单。第三，三条 AAA 新增（2.4.12、2.4.13、3.3.9）不是合规负担，但 2.4.13 对重度键盘用户收益显著，是"选择性 AAA"的候选（见 8.5）。

WCAG 3.0（正式名 W3C Accessibility Guidelines）截至 2026 年 8 月仍是 Working Draft：最新公开草案为 2026-03-03，是 2021 年 1 月以来的第 9 版；W3C 官方表述为"数年内不会成为正式标准"，业界估计完成时间在 2028–2030 之间；草案明确 3.0 不废弃 2.x，且 2.x 在 3.0 定稿后数年内仍不会被废弃 [N004][E003]。必须处理一个活跃的冲突区（Conflict Zone C3）：网络上仍有大量 2026 年的二手文章描述"Bronze/Silver/Gold 奖牌制 + 174 outcomes"的旧草案框架，而 2026-03 草案已放弃奖牌制、改为 core/supplemental requirements + assertions 的通用 conformance 结构 [N004][E003]。由此产生一条入库硬规则：WCAG 3.0 相关条目必须强制携带草案日期戳，任何无日期戳的 3.0 描述视为不可信。Systemsmith 的定位判断：3.0 标记为 watch-only；当前做 2.2 AA 不浪费——按 W3C 的说法，2.2 AA 内容预期能满足 3.0 最低 conformance 层级的大部分要求 [N004]。

### 8.2 WAI-ARIA 与 APG：组件的行为契约层

WAI-ARIA 1.2 是 W3C Recommendation（2023-06）；ARIA 1.3 处于 Editor's Draft 阶段（2024–2025 活跃开发），新增 role=comment/mark/suggestion/code 与盲文标签属性等，属实验性，不应作为生成目标 [N003][E004]。真正的工程权威是 ARIA Authoring Practices Guide（APG）：它把可访问性语义落实到 31 个组件模式，每个模式规定必需的 role、aria-* 状态与属性、完整键盘交互模型（Tab/方向键/Enter/Esc/Home/End/打字定位）、DOM 结构与常见陷阱 [N001]。APG 的第一原则是 "No ARIA is better than bad ARIA"——原生 HTML 语义优先于自定义 widget [N001]。

对开发者工具最关键的契约包括：模态 Dialog 须满足 Esc 关闭、焦点圈禁（focus trap）在对话框内、打开时焦点移入、关闭时焦点还原到触发元素、aria-modal="true"、背景 inert；Combobox 是最难做对的常见组件（aria-expanded + aria-activedescendant 的焦點代理模型），能用原生 select/datalist 就不应自定义；Tabs 在 tablist 内用方向键移动、Tab 键进入面板；Tree 用方向键导航层级、左右键展开收起并支持 type-ahead；Grid 仅限真正的二维数据网格，布局表格不得滥用 [N001]。这一层知识对 Agent 有一个量化重要的性质：焦点管理（对话框开合、路由切换时的焦点去向）是 AI 生成代码最高频的缺陷类别之一，且无法被静态扫描充分覆盖——它属于 8.4 分层中"必须运行时测试"的层级，这正是 Agent Runtime/Visual Review 的不可替代价值点。

### 8.3 关键数值：target size、对比度与 reduced motion

指针目标尺寸是"平台惯例 ≠ 通用原则"的教科书案例，三个体系并存且不可混用：

| 规范 | 数值 | 级别/性质 | 出处与置信度 |
|---|---|---|---|
| WCAG 2.2 SC 2.5.8 Target Size (Minimum) | ≥ 24×24 CSS px | AA，合规地板 | [N005][N002]，规范原文逐字核实，High |
| WCAG 2.2 SC 2.5.5 Target Size (Enhanced) | ≥ 44×44 CSS px | AAA，增强 | [N005]，规范原文，High |
| Apple HIG | ≥ 44×44 pt | 平台惯例 | [B008][E031]，多源一致，Medium-High |
| Material Design | ≥ 48×48 dp | 平台惯例 | [E031]，多源一致，Medium-High |

分析要点有四。第一，三者不是同一要求的不同表述：24 CSS px 是 AA 合规的法定地板，44/48 是各平台的可用性目标；把它们写成"通用 44px 规则"是知识传播错误的典型。第二，单位不可混算：pt（iOS）与 dp（Android）在 1× 基准密度下与 CSS px 数值近似对应，但随密度缩放，不能直接当同一单位换算入库——跨维度交叉验证（H11）已把"target size 三体系不可混用"列为 High Confidence。第三，WCAG 2.5.8 的例外条款（间距例外——以目标为中心 24px 直径圆不相交即可、等效控件、行内、用户代理原生、essential）使其在密集工具界面上可合规实现：24px 是热区间距约束而非视觉尺寸约束 [N002]。第四，M3 的"视觉容器尺寸 ≠ 交互热区"分离原则（即使 XS 按钮视觉高度 32dp，热区仍须 ≥48×48dp）是可跨栈迁移的内核 [E031]——Systemsmith 的生成规则应是：默认目标 ≥24×24 CSS px 且相邻目标间距合规（自动检查项），icon-only 按钮推荐 40–48px 热区（最佳实践项）。

对比度数值为规范原文（High Confidence）：正文文本 AA ≥ 4.5:1、大文本（≥18pt 或 ≥14pt bold）≥ 3:1、AAA ≥ 7:1；非文本对比度（SC 1.4.11，AA）要求 UI 组件识别所需视觉信息与图形对象对相邻色 ≥ 3:1；计算公式为 (L1+0.05)/(L2+0.05)，L 为 sRGB 相对亮度 [N005]。WCAG 3.0 在探索 APCA 等新对比度模型，但现行合规仍是相对亮度公式 [N004]。

动效须精确分层以免误报：SC 2.2.2（Pause, Stop, Hide，A 级）要求自动开始、超过 5 秒且与其他内容并行的移动/闪烁/自动更新内容必须可暂停、停止或隐藏——这是硬要求；SC 2.3.3（Animation from Interactions，AAA）要求交互触发的动效可禁用，Web 上的标准机制是 `prefers-reduced-motion` 媒体查询——缺少该守卫不是 AA 失败，但属低成本高收益的最佳实践；SC 2.3.1（A 级）限制每秒闪烁不超过 3 次（防光敏性癫痫）[N005][E006]。工程纪律：reduce ≠ remove——透明度渐变与短时长过渡可保留，大位移、视差与缩放应当削减。

### 8.4 自动化验证分层：双口径覆盖率与三层架构

无障碍自动化检测的覆盖率存在两个都真实、但分母不同的数字，引用时必须"分母随行"（交叉验证 C4 的入库规则）：按 issue 数量口径，Deque 对 2,000 余次审计、13,000 余个页面状态、约 30 万个 issue 的分析测得自动化发现 57.38% 的问题 [C002]；按 success criteria 条数口径，W3C ACT Task Force 数据显示自动化只能全部或部分覆盖 WCAG 2.2 A/AA 55 条中的 17 条，即 31%（WCAG 2.1 AA 的 50 条口径下约 15–16 条，即 30%）[D001][C002]。两个数字不矛盾：高频问题（对比度、alt、表单 label）恰好是可自动化的，所以按 issue 量计的覆盖率远高于按条款计。独立批判性综述另给出人工对照：Adrian Roselli 2025 年的人工评审发现的问题数约为最佳自动工具的 7.5 倍、覆盖 3 倍多的 SC [D001]。

工具链事实同样需要精确：axe-core（MPL-2.0 开源）是 Lighthouse 无障碍审计、Microsoft Accessibility Insights、pa11y 的共同底层引擎，按"零误报"原则设计；Lighthouse 只运行其规则子集并输出加权 0–100 分，因此"Lighthouse 100 分"只证明可自动化子集通过 [B001]。Deque 的半自动 Intelligent Guided Tests 把覆盖率从 57% 提升到 80.39%（厂商自研数据，无独立复现）[C003]。W3C 的官方立场是一句话："Tools cannot check all accessibility aspects automatically. Human judgement is required." [N006]。现实基线则提供了紧迫感：WebAIM Million 2026 显示 95.9% 的首页存在可自动检测的 WCAG 2 失败，低对比度文本长期居首——自动化基建大规模普及并未消除基础失败 [A001]。

由此导出 Systemsmith 的三层验证架构：

| 层级 | 可验证内容 | 方式 |
|---|---|---|
| ① 静态/运行时自动（生成时即可保证） | 对比度数值、alt 存在性、表单 label 关联、页面语言、name/role/value、target size 几何、重复 id、landmark 结构 | axe-core / eslint-plugin-jsx-a11y / token 级对比度计算，确定性判定，可 fail 构建 |
| ② 运行时半自动 | focus 顺序与 trap、拖拽替代路径、status message 播报、320px reflow、prefers-reduced-motion 响应 | 脚本化键盘遍历、Playwright + axe、媒体查询仿真 |
| ③ 必须人工 / Agent Visual Review | alt 文本质量、链接文本独立可读性、阅读与焦点顺序合理性、屏幕阅读器公告语义、错误恢复流程、焦点"视觉上是否被遮挡"的场景判断（2.4.11） | 真实辅助技术（NVDA/VoiceOver）+ 人工或 Agent 视觉检查 |

对这张表的分析要点有三。第一，第①层是"自动化地板"：这些判定是几何与结构性的，误报率可压到零，应在 CI 中作为硬门；axe-core 的"零误报 + 不确定转人工"是设计 lint 的置信度处理范式 [B001]。第二，第②层是 Agent 的增量价值区：焦点流、键盘遍历、遮挡场景都依赖运行时状态，静态扫描原理性缺失，脚本化测试正是 Agent 可以稳定执行的部分。第三，第③层的边界由覆盖率数据定量支撑——按 issue 口径 57.38% 意味着约 43% 的问题天然漏出自动网，按 SC 口径 31% 意味着近七成条款无任何自动化判定；任何"自动化即可达标"的承诺都同时违反 Deque 数据、ACT 数据与 W3C 官方立场 [C002][D001][N006]。

### 8.5 明确建议：Systemsmith Web Profile 默认 baseline

建议：Systemsmith Web Profile 默认 baseline = WCAG 2.2 AA，并选择性吸收三条 AAA（2.3.3 Animation from Interactions、2.4.13 Focus Appearance、2.5.5 Target Size Enhanced）。论证分五步。

第一，合规面：现行法律框架（欧盟 EAA 经 EN 301 549、美国 Section 508、ADA Title II 2024 规则）全部引用 WCAG 2.x AA；WCAG 3.0 在 2028 年前不可能成为 Recommendation 且承诺不废弃 2.x [N005][N004]。第二，官方指引：W3C 明确建议各方"adopt WCAG 2.2 as their new conformance target, even if formal obligations mention previous versions" [N005]。第三，增量成本：AA 层相对 2.1 仅净增 6 条 SC，且全部可工程化（见 8.1），升级不是重新审计 [N005][E001]。第四，AAA 的取舍：W3C 原文明示不建议整站 AAA，故 AAA 不可做 baseline；但选择性吸收的三条对 Systemsmith 核心用户（重度键盘用户、低视力专业用户）收益显著且成本可控——reduced motion 只是一个媒体查询守卫，焦点可见性与更大热区在高密度工具界面上同时服务普通用户 [N005][E006][N002]。第五，验证经济性：AA 层约 57% 的 issue（数量口径）可在 CI 中被自动层拦截，剩余部分可按 8.4 的三层表结构化分配给运行时测试与 Agent Visual Review——baseline 的选择直接决定这套分工的可行性 [C002][N006]。

---

> 本文件承接第一、二部分（第 1–8 章），覆盖可用性评估、平台设计系统、企业设计系统与设计令牌、AI/Agent 影响四个主题。引用格式为 Source Registry 全局 ID。

## 9. 可用性评估

可用性评估是本知识底座中"可验证性"承诺的落点：如果 Agent 生成的设计无法被评估，前文全部分层与规则都只是单向输出。本章先梳理两类专家检查法与一套指标/量表体系，再回答本项目的关键问题——Agent 判断"设计真的变好"的能力边界在哪里。需要预先声明的批判性立场：本章方法几乎全部诞生于 1990–2010 年代的实验室传统，其指标操作化是成熟知识（empirical method），但任何指标数值的"好坏"判据都是情境依赖的；把实验室方法直接当作自动化评审批次，是近年工具厂商的常见过度承诺，本章 9.3 将用量化证据划清这条线。

### 9.1 专家评估：不接触真实用户的两种检查法

**启发式评估（Heuristic Evaluation, HE）** 由 Nielsen 与 Molich 于 1990 年提出，其方法论内核不是"十条启发式"本身，而是三条程序纪律：多名评估者**独立**评估、每人至少遍历界面两遍、汇总去重后再做严重性评级 [A022]。多人独立的要求来自评估者效应（evaluator effect）这一可重复观察：不同评估者发现的问题子集交集很小，没有任何单人能发现全部问题 [A022]。发现率随人数增长的拟合模型（Nielsen & Landauer 1993，λ≈0.31）给出"5 名评估者约发现 75% 问题、区间约 2/3–85%"的估算——但必须按交叉验证后的统一口径陈述：这是泊松模型下的成本-收益**规划估计**，用于决定"请几个人划算"，不是发现率的保证值或定律 [N012]。这一区分对 Agent 知识库尤为重要：把"5 人发现 85%"入库为硬阈值，就是把规划启发式误标为实证规律。

严重性评级使用 0–4 五级量表（0=不是问题，1=纯美观，2=次要，3=主要，4=灾难级，发布前必须修复），严重性由频率×影响×持续性三因子合成 [A017]。这里有一条被反复强调却常被忽视的实证警告：**单个评估者的严重性评级不可靠，实践中以 3 名评估者评级的均值为准**，且评级应在全部问题汇总之后独立进行，而非边发现边打分 [A017]。评估者间一致性差是该方法的已知缺陷，产业界因此出现量表简化实践：MeasuringU 因中间档难以区分，将自身严重性量表从七级一路缩减到三级（Minor/Moderate/Critical）[B033]。这条证据链直接约束 9.3 的自动化设计：严重性是一个连人类都需要多人平均才能稳定的判断，任何单模型单次输出都不应被当作严重性测量值。

**认知走查（Cognitive Walkthrough, CW）** 由 Wharton、Rieman、Lewis 与 Polson 提出，主流引用版本为 1994 年收入 Nielsen & Mack 主编《Usability Inspection Methods》的从业者指南章 [A023]。与 HE 的"广谱体检"不同，CW 的 scope 被明确限定为**可学性（learnability）**：模拟首次使用者"边做边学"，对任务每一步问四个问题——用户会尝试达成正确的目标吗？会注意到正确动作可用吗？会把该动作与目标关联吗？执行后会看到朝向目标的进展反馈吗？[A023]。Spencer 2000 年在 Microsoft 的工程环境中将其精简为两问（用户知道这一步该做什么吗？做对了会知道自己做对了吗？），以应对大公司的时间压力与评审会议中的防御心理——这是"方法学严谨性向工程社会约束妥协"的早期范本 [B019]。对知识底座的标注建议：HE 与 CW 都是 design heuristic 层的**检查程序**而非科学模型；它们的有效性证据是"比不做强"，其输出（问题清单+严重性）天然需要人去重与复核，这一点在 9.3 将与 LLM 评估器的能力边界形成同构对照。

### 9.2 测试与指标：从 ISO 定义到可测数字

真实用户测试的前提是指标的操作化（operationalization，指把抽象概念转化为可重复执行的测量程序）。Tullis & Albert 的体系给出了核心指标的标准定义 [A052]：**Task Success** 为二元（成功/失败）或分级（完全/部分/失败）判定，且成功判据必须在测试前预先定义；**Time on Task** 必须预定义起止点，否则计时不可重复，且任务时间呈偏态分布，应报告几何均值而非算术均值或中位数 [A051]；**Error Rate** 要求事先定义"何为错误"；**Efficiency** 的常用核心度量是任务完成率与平均任务时间之比；**Learnability** 操作化为绩效随重复试次的改善曲线；**Discoverability** 操作化为首次尝试成功率或发现时间 [A052]。这些定义的共同结构——"先定义判据，再采集数据"——正是设计判断可验证化的最小纪律。

标准化量表解决"态度与负荷"的测量。**SUS**（System Usability Scale，Brooke 1996）是 10 题 5 点 Likert 量表，计分规则为正题减 1、反题以 5 减之、求和后乘 2.5 得 0–100 分；注意它**不是百分制**，历史均值约 68 分 [A043]。**UMUX-LITE**（Lewis et al., CHI 2013）是两题 7 点量表，信度 .82–.83，与 SUS 相关 .81，可用回归公式换算到 SUS 刻度，适用于 SUS 过重的场景（如任务后弹窗）[A044]。**NASA-TLX**（Hart & Staveland 1988）测量主观工作负荷，含心理需求、身体需求、时间压力、绩效、努力、挫败感六个子维度，标准流程含 15 组两两比较加权（0–100 分），实践中常用不加权的 Raw TLX [A056]。三者分别对应"总体可用性态度""轻量可用性态度""认知负荷"，选择依据是测量对象而非流行度。

**HEART 框架**（Rodden, Hutchinson & Fu, CHI 2010）把指标推进到大规模线上场景：Happiness（态度/调查）、Engagement（使用深度与频次）、Adoption（新用户/新功能采用）、Retention（留存）、Task Success（完成率/时间/错误，与实验室指标同构）[A053]。两条使用纪律直接来自原论文：其一，必须配合 Goals–Signals–Metrics（GSM）流程使用，且只选与项目目标相关的 2–3 类，而非五类全测；其二，**Engagement 在企业场景价值有限**——原文明确指出企业用户是被要求使用系统而非主动选择，使用深度不反映体验质量 [A053]。后一条对专业工具产品具有方向性意义：它把"专业工具应追求什么"从参与度话语拉回任务效率话语，与第 6 章"结构化密度"的论证互为支撑。

这些指标的规范源头是 **ISO 9241-11:2018**：usability 被定义为"特定用户在特定使用情境下，以有效性（effectiveness）、效率（efficiency）与满意度（satisfaction）达成特定目标的程度" [N040]。三要素到可测指标的映射为：effectiveness → 任务成功率/错误率；efficiency → 任务时间、步数、心智负荷（NASA-TLX）；satisfaction → SUS/UMUX-LITE 等态度量表 [N040][A052]。需要按 2018 版现行定义引用（1998 版已撤销；交叉验证已确认两版 satisfaction 与 efficiency 措辞有实质差异，但上述指标映射结论在两版下均成立）[N040]。该定义的另一关键部分是**使用情境（context of use）**：可用性不是产品的绝对属性，而是"用户×任务×设备×环境"四元组的函数——这意味着任何不绑定用户、目标与情境的可用性断言（包括 Agent 的自评）在规范意义上不成立。

### 9.3 Agent 如何判断设计真的变好：自动化的地板、中间带与天花板

综合 dim04、dim05 与 dim08 的量化证据，设计评估的可自动化程度呈清晰的三段结构，这一分层是本项目验证架构的基石。

**地板：可确定性执行的检查。** 对比度数值、替代文本存在性、表单标签关联、name/role/value、目标尺寸几何、spacing token 合规、对齐坐标一致性等，可以由 axe-core 类规则引擎与 token lint 在 CI 中零误报执行 [B001][N005]。自动化的覆盖率必须按双口径陈述（交叉验证 C4 要求分母随行）：按真实页面 issue 数量口径，Deque 对 13,000+ 页面状态、约 30 万个 issue 的审计数据显示自动化可发现 57.38% 的问题；按 WCAG 2.2 A/AA 成功标准条数口径，W3C ACT 数据显示仅 17/55 条（31%）可全部或部分自动化 [C002][D001]。两个数字都真实：高频问题（对比度、alt、label）恰是可自动化的，而键盘操作、焦点管理、屏幕阅读器语义几乎不可静态检测。W3C 的官方立场是"工具无法自动判定无障碍，只能辅助" [N006]；WebAIM Million 2026 显示 95.9% 的首页仍存在可自动检测的失败 [A001]——自动化基建普及并未消除基础失败，说明地板层的价值在于"把低级错误拦在生成时"，而非证明质量。

**中间带：LLM 初筛 + 人工复核。** LLM 启发式评估的量化证据来自 Luchs & Nizamani（2025，单一来源但为首批量化 LLM 评估器评分者间信度的研究之一）：GPT-4o 对 30 个网站源码按 Nielsen 十原则评审 850+ 次，问题**检测**一致性中等（平均 pairwise Cohen's κ=0.50，exact agreement 84%），可用作初筛；但**严重性判断**不可靠（weighted κ=0.63 而 exact agreement 仅 56%，Krippendorff's α≈0），必须人工复核 [C006]。LLM-as-judge 的可靠性高度依赖评判协议：WebDevJudge 用 query-grounded rubric tree 把高层需求分解为可验证的细粒度标准，人类标注者间一致性超过 80%，显著高于非结构化评判的基线 [C034]；而 2026 年 54.1 万条判断的大规模复测发现，原始一致率高估机会校正后区分度 33–41 个百分点，评委排名跨基准迁移可漂移多达 14 位——未经校准的一致率数字系统性偏乐观 [C033]。此外，GPT-4 对 UI mockup 的启发式评审对"差设计"准确有用，但随设计迭代改进后性能下降，不适合作迭代评审工具 [A004]；只看首屏截图的评审会"产出流畅但证据薄弱的批评"，因为大量可用性失败是交互性的（禁用控件无解释、表单静默拒绝输入、错误恢复路径断裂），可靠评审必须操作控件、观察状态转移、测试错误路径 [C005]。中间带的正确架构因此是：结构化 rubric + LLM 初筛 + 交互式取证 + 人类复核标记。

**天花板：必须真实用户。** 任务成功率、任务时间、可学性曲线、SUS/UMUX-LITE/NASA-TLX 等态度测量，本质上是 outcome 而非 artifact 的属性——按 ISO 9241-11 的定义逻辑，它们不绑定 specified users/goals/context 就不可证伪 [N040]。合成用户（synthetic users）不能替代真实用户研究，NN/g 的实证对比与 ACM AHs 2025 的批判分析一致结论：LLM 扮演的"用户"仅可用于 desk research 与假设生成 [A005][A006]。

| 层级 | 评估对象 | 方法 | 关键证据 | 可信度边界 |
|---|---|---|---|---|
| 地板（全自动） | 对比度、语义标记、label、target size、token 合规 | axe-core 规则引擎 + token lint，CI 拦截 | 57.38% issue 量 / 31% SC（双口径）[C002][D001] | 零误报承诺；不确定项转人工而非判违规 [B001] |
| 中间带（半自动） | 启发式违规存在性、视觉层级、专业感初判 | LLM 评估 + 结构化 rubric tree + 交互式取证 | 检测 κ=0.50 可用 [C006]；rubric tree IAA>80% [C034] | 严重性 α≈0 必须人工 [C006]；一致率高估 33–41pp [C033] |
| 天花板（真实用户） | 任务成功率/时间、可学性、满意度、负荷 | 可用性测试、生产分析（HEART）、量表 | 操作化定义 [A052]；ISO 三要素 [N040] | 合成用户不可替代真人 [A005][A006] |

这张表对 Systemsmith 的直接约束有三层。第一，它给出 rule schema 中 `validation` 字段的三值化依据（deterministic / assistive / empirical）：只有地板层规则可以被架构性地强制执行，assistive 层输出必须强制携带"需人工复核"标志——这是 axe-core"零误报 + 不确定转人工"范式向整个设计验证领域的推广 [B001][D001]。第二，它解释为什么"LLM 说自己设计得好"不构成证据：LLM 对存在性判断尚有中等一致性，对严重性与质量排序的判断一致性趋近于零，而"变好"恰恰是一个排序判断 [C006][C033]。第三，它为产品诚实性划界——任何声称自动验证"体验质量"的功能都在承诺天花板之上的能力，重蹈 MBUID"全自动承诺必破"覆辙的风险远大于收益。

由此，本章对 Agent 自评给出明确禁令：**"looks good / modern / clean"式的自评输出不是评估**。这类判断（a）无操作化定义与判据，（b）落在中间带中最不可靠的排序判断区间，（c）锚定的是模型训练分布中的视觉偏好而非用户情境，恰好命中 LLM-as-judge 已知的 self-preference 与 fluency 偏差 [A028][C005]。合规的自评必须降级为可检查的形式：要么引用地板层的确定性检查清单（"对比度 4.6:1，通过 SC 1.4.3"），要么声明中间带初筛并附复核标记（"rubric R3.2 初判通过，需人工确认层级梯度"），要么明确承认该判断属于天花板之上、需要真实用户数据。

## 10. 平台设计系统

平台设计系统（Apple HIG、Material 3、Fluent 2）是知识底座中"platform convention"语料的主要来源。使用前必须确立批判性框架：这三套文档是**惯例的权威发布**，不是普适原则的证据库——它们的条目在各自 OS 生态内是硬约束，跨平台引用时自动降级；其视觉语言部分（材质、动效风格、形状系统）则是纯粹的生态身份标识，不具备任何跨栈迁移资格。本章逐系统盘点 2026 年现状，并对每条知识做出 universal insight 与 platform convention 的显式分离。

### 10.1 Apple HIG（2026 现状）：原则换代与一次公开的可读性事故

截至 2026-08，HIG 的信息架构为 Foundations / Patterns / Components / Technologies 四大板块加六平台分册 [B008]。首页列出的设计原则为三条，原文核实为：**Hierarchy**（建立清晰视觉层级，让控件与界面元素抬升并区分其下的内容）、**Harmony**（与软硬件同心圆设计对齐）、**Consistency**（采纳平台惯例以保持一致、并持续适配窗口尺寸与显示设备）[B008]。而广泛流传的"经典六原则"（Aesthetic integrity / Consistency / Direct manipulation / Feedback / Metaphors / User control）源自 1987 年 Macintosh HIG 十原则传统，2017 年 iOS 11 HIG 仍有专页，2018 年改版后从正文移除，属 1987–2017 年的历史传统而非现行条目 [B009][E013]。知识底座必须区分这两代原则：引用"Apple 六原则"而不注明版本，等于引用一个 2018 年起不再被 Apple 官方页面承载的快照；同时历史原则中的多数条目（见下表）可还原到更古老的 HCI 文献，其价值不依赖 Apple 是否继续挂出。

2025-06 WWDC 发布的 Liquid Glass（iOS 26 / macOS Tahoe 26 起）是 Apple 十年来最大视觉更新，并引发了持续至 2026 年的可读性/对比度争议：用户与媒体集中报告"更难阅读、对比度更弱、动画分散注意力、旧设备性能问题"（单一舆情来源，争议事实多源一致，程度评估为主观）[E012]。该事件的知识价值在于它是一个现成的结构性反例：半透明/玻璃拟态材质把文本对比度交给了不可控的动态背景，使 WCAG SC 1.4.3（正文 4.5:1）与 1.4.11（非文本 3:1）从"默认满足"变成"必须逐场景实测" [N005]。由此入库的通用规则是：**任何 translucency 材质必须附带"背景不可控时文本对比度必须实测"的验证要求**——这是"平台惯例 ≠ 可访问"的一次高成本公开演示。

| 条目 | 内容 | 判定 | 理由 |
|---|---|---|---|
| Hierarchy（现行原则） | 视觉层级服务内容、控件不喧宾夺主 | Universal | 可还原到前注意加工与格式塔知觉组织（见第 4 章） |
| Consistency（现行原则） | 采纳平台惯例以保持一致 | Universal（原则）/ Platform（具体惯例） | "一致性降低学习成本"可还原到认知迁移；"iOS 惯例"本身是平台特定 |
| Harmony（现行原则） | 与 Apple 软硬件同心圆设计对齐 | Platform | 纯 Apple 语境，无跨平台意义 |
| Direct manipulation（历史原则） | 直接操作对象、即时可见结果 | Universal | 可还原至 Shneiderman 1983 的原始 HCI 文献 [N021]，非 Apple 私有 |
| Feedback（历史原则） | 每个动作有可感知反馈 | Universal | 系统状态可见性是跨平台共识 |
| User control（历史原则） | 用户而非 app 掌控；危险操作可取消 | Universal | 与"undo 优于 confirm"的控制权研究传统一致 |
| Metaphors（历史原则） | 借熟悉经验加速学习 | Universal（思想）/ Platform（具体隐喻物） | 桌面隐喻本身已是特定时代包装 |
| safe area / tab bar ≤5 / modal sheet / Dynamic Type | iOS 具体交互与布局约定 | Platform | 绑定 iOS 硬件与系统行为，禁止生成到其他栈 |
| SF Symbols（7,000+ 符号、9 字重 × 3 档） | 图标与系统字重一体化 [B010] | Universal（思想）/ Platform（资产） | 图标-字重对齐思想可迁移；符号库授权仅限 Apple 平台 |
| 44×44 pt 最小触控目标 | Apple 触控目标约定 | Platform | 与 WCAG 24px、Material 48dp 是三个不同体系，不可混用 [N002][E031] |

此表的读法比内容更重要。判定的操作标准是"可还原性测试"：能还原到人类认知/知觉不变量（注意、记忆、知觉分组）的为 Universal；能还原到特定硬件/OS/生态的为 Platform；两者混杂的条目（Consistency、Metaphors、SF Symbols）必须拆成"思想层"与"实例层"分别入库。Apple 原则的两代更替本身也是证据：Hierarchy/Feedback/User control 等真正 universal 的条目在四十年间以不同措辞反复出现（1987 十原则 → 2017 六原则 → 2025 三原则），而被淘汰的恰是绑定具体交互形态的条目——原则的存活史就是 universal/platform 分离的自然实验。

### 10.2 Material 3（含 2025 Expressive 更新）：视觉语言是 Android 的，系统工程知识是全行业的

Material 3 Expressive 于 2025-05（Google I/O）发布，是 M3 的当前形态 [B021]。Google 称其为"most-researched update"（46 项研究、18,000+ 参与者、"定位关键 UI 元素快至 4 倍"）——这些数字是**厂商自研数据，无独立复现，按 Medium 置信度处理**，不能作为"Expressive 风格更优"的证据入库 [B021]。

M3 真正可跨栈迁移的是其系统工程知识，与视觉语言无关。**色彩架构**：key color → tonal palette → semantic color roles（primary/onPrimary/primaryContainer/onPrimaryContainer 等约 29 个 role），且每个 role 与"on-"配对内建对比度保证——"Each color has a paired onColor to guarantee readability" [B023][B024]。这一设计把对比度责任从"事后检查"前移为"token 结构的内建属性"，是可以直接映射到任何技术栈 design token 层的机制性知识（见第 11 章）。**自适应布局体系**：window size classes（compact <600 / medium 600–839 / expanded 840–1199 / large 1200–1599 / extra-large ≥1600）加三大 canonical layouts（list-detail / supporting pane / feed），规定各档位下的 pane 数与导航组件切换 [B022]。需要注明的置信度限定：这些断点数值经逐字镜像源交叉核实而未直接抓取官方原页，按 Medium-High 处理；且数值本身是 Material 的选择（Android 惯例），**可迁移的是"以窗口宽度档位而非设备类型驱动布局决策"这一思想与"canonical layout 作为页面骨架模板库"的方法**——前者与 CSS container query 时代的 Web 响应式思想同构，后者对工具型界面（列表-详情恰是 IDE/工作台的默认骨架）是高价值先验 [B022]。**视觉尺寸与交互热区分离**：无论视觉容器多小，触控热区必须 ≥48×48dp——这一分离原则可迁移所有触屏栈，但 48dp 数值是 Android 约定 [E031]。

反过来，必须显式标注为 Android 特定的部分包括：dynamic color 从壁纸取色的 Material You 个性化、形状与动效风格、navigation bar/rail/drawer 组件三件套 [B021][B022]。将 M3 的形状语言或动效曲线生成到桌面 Web 工具，是典型的"把生态身份误当设计质量"。

### 10.3 Fluent 2：桌面生产力密度与命令设计的参考系

Fluent 2（2023 起）是 Microsoft 的统一设计语言，一套 design token 加跨 Web/Windows/iOS/Android/macOS 的实现，Web 侧为 @fluentui/react-components（v9）[B014]。对专业工具最有参考价值的有三点。**其一，token 三层架构与 motion-as-tokens**：primitive → alias → component 的分层（如 colorBrandBackground、colorNeutralBackground1、spacingHorizontalM、durationFast 150ms），动效时长与曲线同样以 token 发布——这是与 M3 ref/sys/comp 独立收敛的同一架构（交叉验证 H6），进一步确认三层模型是行业共识而非某一家的偏好 [E018][B031]。**其二，密度作为一等设计维度**：Fluent 以 Teams/Outlook/Word 的生产力密度著称，是公开设计系统中对 dense UI 最系统的实践，与 EUI、Spectrum 2 的密度策略共同构成本报告第 11 章的核心证据链 [E018]。**其三，命令设计传统**：ribbon/command bar 的"命令按频率与重要性分级暴露"（高频直接可见、低频收纳 overflow）对 IDE 类工具直接适用；ribbon 本身是 Windows/Office 惯例，其"命令分组与渐进暴露"的内核才是可迁移部分 [B014]。

必须同时入库的警示是：Microsoft 自家产品的实际交付常与公开 Fluent 规范偏离，公开文档滞后于 Office 交付 [E018]。学习规范文本，不抄产品现状——这条原则对全部三个平台系统成立。

### 10.4 横向结论：平台系统的正确消费方式

三套系统的横向比较给出一致的消费策略。**消费其 platform convention 内容**：当目标栈确定时（为 iOS 设计、为 Android 设计），该平台的惯例数值与组件行为是 B 级硬约束——44pt 之于 iOS、48dp 之于 Android、24×24 CSS px 之于 Web 合规地板，三者是不同体系，混用即错误 [N002][E031]。**学习其工程机制**：on-配对色彩架构、三层 token、window size class 驱动布局、密度模式、命令分级暴露，这些机制已与具体视觉语言解耦，是可跨栈迁移的系统知识，且经多系统独立收敛验证。**不把平台惯例提升为通用原则**：Liquid Glass 的可读性争议证明连 Apple 自己都会在平台视觉实验中违反通用可读性约束 [E012][N005]——平台系统的权威性是 scope 的函数，在 scope 内服从其惯例，在 scope 外只借鉴其机制，这是知识底座 authority 标注必须支持的区分。

## 11. 企业设计系统与设计令牌

如果说平台设计系统提供的是"惯例内容"，企业级设计系统（GitHub Primer、Elastic EUI、IBM Carbon、Atlassian ADS、Adobe Spectrum 等）提供的则是另一类知识物种：**在高密度、长生命周期、多团队协作约束下沉淀的组织机制**——如何定义高于组件的 Pattern 层、如何把密度做成用户可控维度、如何用自动化而非文档做治理、如何给组件与 token 安排生命周期。这些机制正是 Systemsmith 自身知识库运营的直接模板。本章先横向比较五大系统，再深入 Design Tokens 的格式标准、三层架构与跨栈共享边界。

### 11.1 五大系统横向比较（2026-08 状态）

五个系统各自的代表性贡献如下。**Primer** 面向开发者产品的高密度界面，其导航 pattern 按"是否改变 URL"这一交互语义区分组件：改变 URL 用 UnderlineNav，仅切换同页面板用 UnderlinePanels，且两者不可混用——这是把导航语义做成可判定规则的教科书案例 [C036]。其治理是公开系统中最完整的：组件生命周期 Alpha → Beta → Stable → Deprecated → Removed 五级，每级有量化准入标准（Beta 要求生产环境多处使用、Stable 要求 API 至少一个月无 breaking change 且有 linter/codemod 防回退、Removed 要求提前至少一个月公告并提供自动迁移路径），新组件采用高门槛 upstreaming 模型（feature team 孵化 → 多团队常规使用 → maintainers 评审）[C023][C008]。多实现策略为同一规范下 CSS/React/ViewComponents 并存，复杂组件（如 QueryBuilder）以 Web Component 为内核跨实现共享 [C035][C001]。**EUI**（v119.1.0，2026-08-24）从 Kibana 孵化，自我定位为"API for user interfaces" [C037]；它把密度做成用户可控的一等显示维度——EuiDataGrid 工具栏内置 density 与 rowHeight 控制 [C009]；其 Borealis 主题迁移是一次公开的"语义 token 纪律"实战：`success` 被强制限定为纯语义绿（原先因恰好是品牌色而误用的场景须改用 accentSecondary）、数据可视化色板被禁止挪作 severity 语义、整批 token 更名为 `text*` 语义前缀——色值匹配不等于语义匹配 [C046]。**Carbon**（v11 Active，@carbon/react 1.114.0；v12 Preview 以 feature flag 渐进预置）建立在 IBM Design Language 之上（2x Grid、IBM Plex、IDL 色彩），v11 的核心变化是 token 语义化重命名（text-03 → text-placeholder）与 CSS grid 对齐 [C045][C017][C012]；它是少数自带完整数据可视化规范与图表库的系统，其 a11y 实践为组件级内建（键盘导航、焦点态、逐组件 ARIA pattern 与 WCAG 映射）[C038]；其 Pattern 层（empty states 三场景、filtering 全局清除、presentation/exploration 两类 dashboard）附带硬性 a11y 规则（empty state 必须整体替换所在容器，避免屏幕阅读器读完整个空结构）[C038][C022]。**ADS** 的 token 命名是可解析的三段式结构 Foundation.Property.Modifier（如 color.text、elevation.shadow.raised），官方纪律为"按含义而非按色值选 token" [C050]；治理上以生命周期化 token 治理加迁移自动化（lint、codemod、迁移指南）著称，被引为企业级样板（治理细节为单一二手来源，置信度中）[B015][E020]。**Spectrum** 面向专业创作工具的 dense UI，Spectrum 2 把可定制 density 与 contrast 作为核心能力 [C041]；其 @adobe/spectrum-tokens 14.3.0 将约 540 个组件级间距 token 收敛为约 100 个语义 layout token，旧 token 带 deprecated_comment/renamed 迁移元数据弃用——这是"组件级 token 爆炸"的公开纠偏案例 [C049]。

| 系统 | Pattern 层定义 | 密度策略 | 治理机制 | 版本状态（2026-08） |
|---|---|---|---|---|
| GitHub Primer | 工作流设计指南；导航按 URL 语义选组件 [C036] | 面向 data-dense 的组件集（TreeView/SplitPageLayout/DataTable）[C010] | 五级量化生命周期 + 高门槛 upstreaming [C023][C008] | @primer/react 38.36.0；三产品线重组 [C014] |
| Elastic EUI | 组件即 API，pattern 内建于 DataGrid 等重组件 | 用户可控 density/rowHeight 一等维度 [C009] | semver 周发布；主题迁移以 meta issue + CODEOWNERS checklist 驱动 [C037][C046] | v119.1.0（2026-08-24）[C037] |
| IBM Carbon | 独立 Patterns 导航（empty states/filtering/dashboards），含场景分类与 a11y 硬规则 [C038] | 2x Grid 间距体系；密度由布局网格承载 [C012] | Preview→Prerelease→Active→Maintenance→LTS→EOL；feature flag 预览下一 major [C045] | v11 Active / v12 Preview [C045] |
| Atlassian ADS | Patterns 区 + 组件内 pattern 化；Rovo UI 为 AI 专属层 [C040] | Primitives（Box/Stack 等）托管布局 token | 成熟度标签 + lint/codemod 自动化迁移 [C040][B015] | @atlaskit/tokens 16.8.0 [C040] |
| Adobe Spectrum | 面向创作工具的工作流组件（Spectrum 2 滚动交付 100+ 应用） | 可定制 density 与 contrast 为核心能力 [C041] | token 级弃用元数据（deprecated_comment + renamed）[C049] | spectrum-tokens 14.3.0（2026-04）[C049] |

横向比较后提炼出五条共同组织智慧，它们对 Systemsmith 知识库运营是直接可执行的。其一，**单一事实源 + 多实现**：设计规范一份、实现多份（CSS/React/Rails/Web Components），共享 token 与共享行为层消重 [C035][C001]。其二，**语义优于色值**：EUI、ADS、Carbon、Spectrum 四家独立执行了"按意图命名、按含义选用"的 token 语义化迁移，且全部配套弃用元数据与 codemod——多系统独立收敛使该结论达 High 置信度 [C046][C050][C017][C049]。其三，**密度是一等主题维度且正被交给最终用户**：EUI 的 display selector、Spectrum 2 的 customizable density、SLDS 2 Cosmos 的 Comfy/Compact 切换 [C016]，共同确认专业工具的密度不应由设计师一次性决定（交叉验证 H7）。其四，**治理靠自动化而非文档**：linter、codemod、CI 检查、feature flag、生命周期标签是共同抓手，"enterprise migrations succeed with automation, not documentation alone" [B015]。其五，**组件成熟度模型是通用语言**：Alpha/Beta/Stable/Deprecated 及其变体让消费方（包括 Agent）可按成熟度过滤可用组件——知识条目本身也可借用同一模型管理生命周期。

### 11.2 Design Tokens：DTCG 2025.10 的范围与地位

W3C Design Tokens Community Group 于 2025-10-28 发布 Design Tokens Format Module 首个 stable 版本 **2025.10** [N032][N062]。法律地位必须精确陈述：这是 W3C Community Group 的 **Final Community Group Report，不在 standards-track 上**，不是 W3C Recommendation；但 24+ 参与组织（Adobe、Google、Microsoft、Meta、Amazon、Salesforce、Shopify、Figma 等）与主流工具链（Style Dictionary、Tokens Studio、Figma、Penpot、Sketch）已实现，事实上成为行业交换格式 [N032]。核心机制包括：JSON 交换格式（媒体类型 application/design-tokens+json）；规范属性以 `$` 前缀——`$value`（必需）、`$type`、`$description`、`$extensions`、`$deprecated`；group 嵌套与 `$extends` 组继承；**双引用机制**——花括号别名 `{color.blue-600}` 与 JSON Pointer（RFC 6901）`$ref` 属性级引用，且工具必须检测循环引用并报错 [N032]。类型系统为 13 种 token type：7 种原始类型（color、dimension、fontFamily、fontWeight、duration、cubicBezier、number）加 6 种复合类型（border、strokeStyle、transition、shadow、gradient、typography）；dimension 值为 `{value, unit}` 对象且 unit 仅 px/rem [E028][E029]。

同样重要的是规范**刻意不包含**的东西：modes/theming 的机制表达、数学表达式、条件值暂居 `$extensions`，等待 Resolver Module 稳定 [N029]。Resolver Module（定义 sets、带 contexts 的 modifiers、resolutionOrder，即"同一 token 源在 light/dark/dense/brand 等多上下文下解析"的标准机制）截至 2026-07 仍为 draft 轨道 [N031]。这意味着"主题与密度的标准化解析"在 2026 年仍是过渡态——工业界现行方案是 Tokens Studio `$themes` 元数据或 Style Dictionary 多文件构建，知识底座引用 theming 机制时必须标注 Resolver 的草案状态 [N031]。DTCG 的官方自我定位也值得原文入库："交换格式而非架构格式……It defines the format for token exchange while leaving organizational strategy to design system teams" [N029]。

### 11.3 三层模型与跨栈共享判断

**Primitive → Semantic → Component 三层模型**是业界通行架构：Tier 1 Primitive 为无使用意图的原始值（blue-500、space-16），Tier 2 Semantic 为意图映射的别名（color-action-primary），Tier 3 Component 为组件作用域 token，依赖单向流动 [E032]。Material 3 是该模型最完整的公开参照：`md.ref.*`（reference 原始调板）→ `md.sys.*`（system 语义角色）→ `md.comp.*`（组件引用 sys token），且官方明确"theming 理想情况下应在 system 层解决，component token 不应感知 theming" [B031][E022]。主题切换的本质因此是"语义层重指向"：primitive 不变，semantic token 的别名在 light/dark/density 等 mode 下指向不同 primitive，组件代码不变。管道侧，Amazon 开源的 Style Dictionary（v5.5.2，v4 起一等支持 DTCG）以"一份 token 源 → 多平台输出"为核心，Tokens Studio/sd-transforms 负责设计侧 authoring、类型对齐与数学表达式预处理 [B011][B035]。

跨栈共享的判断必须逐类型做出，这是本研究对"tokens.json 能否全平台通吃"这一常见过度承诺的修正：

| token 类型 | 跨栈共享判断 | 依据 |
|---|---|---|
| 颜色（sRGB/oklch） | 可直接共享 | 色彩空间值无平台依赖；DTCG Color Module 覆盖 14 种色彩空间 [N032][E028] |
| 字族/字重 | 可直接共享 | 引用字体名与数值权重，各栈均有对应物 [E019][E014] |
| 无量纲比例（line-height、opacity） | 可直接共享 | 单位无关 |
| 动效时长与缓动曲线 | 可直接共享 | duration/cubicBezier 为 DTCG 原始类型 [E028] |
| 间距/圆角数值（px） | 可共享，构建期换算 | DTCG 规范明确 px 的 Android 等价物是 dp、iOS 是 pt，由转换工具换算 [N038] |
| rem | 需有损转换 | 规范原文："Not all platforms have an equivalent to rem… MAY need to do a lossy conversion to a fixed px size" [N038] |
| elevation | 不可直接共享 | Android 物理 elevation 与 iOS/Web 的阴影合成机制不同，需平台侧重新实现 [N038] |
| typography 复合样式 | 需有损转换 | 各栈渲染管线差异；Compose 有专门 shorthand transform [B035] |
| 平台约定尺寸（44pt/48dp/24px） | 不可共享 | 分属三个规范体系（见 10.4）[N002][E031] |

此表的实践含义是：跨栈 token 管道应把 token 分为"全栈共享集"与"构建期适配集"两类管理，并在 token 元数据中标注换算策略；Qt 因无官方 token 消费工具链，实践中按"tokens.json → 自定义生成 QML 主题资源"处理（社区实践，置信度中）。更根本的认知是：共享的从来不是"值"本身，而是"值所编码的决策"——elevation 不可共享恰恰因为它编码的是平台物理隐喻而非视觉决策，这再次印证第 10 章的 universal/platform 分离标准在 token 层面同样适用。

### 11.4 关键论断：token 是"词汇层"而非"语法层"

token 只能表达"值"，不能表达布局逻辑、信息层级与组合规则——这正是各系统在 token 之上仍需 Components、Patterns、Floorplans 层的原因。Cloudscape（AWS）官方对此表述最直接：design tokens 是构建自定义组件的最后手段，"永远优先使用预建组件，因为自定义组件失去内建的测试、可访问性、响应式与一致性" [C051]；DTCG 官方同样声明规范只管交换格式，组织策略留给各团队 [N029]。

对本项目的含义可以陈述为一个论断：**token 是 Design Intelligence 的词汇层，不是语法层**。它们能保证视觉一致性（颜色、间距、字号、圆角、时长），但不能回答"何时用 Tree 而非 Tabs""密度何时切换""empty state 用哪类场景""指标按什么动线排布"。这些决策知识分布在前述系统的 Pattern 层、组件使用指南与治理规则中——即 Systemsmith 需要结构化抽取的上层空间。token 与上层知识的衔接点恰是语义命名：`textWarning`、`color-action-primary` 这类语义层 token 已经编码了意图，是 Agent 可以断言（assert against）的设计契约——"tokens are the thing you can assert against later" [E007]。换言之，token 体系把"设计决策中可确定的部分"压缩到了词汇层，而 Design Intelligence 的不可替代空间，正是词汇之上、组件之间的那套语法与语义。

## 12. AI/Agent 影响

前述十一章回答"设计知识是什么"，本章回答"这些知识如何被 Agent 消费、验证与组装"。五个小节依次处理知识形式化（为什么不能全塞 context）、设计验证自动化、框架无关组件模型、SDIR（Semantic Design Intermediate Representation，语义化设计中间表示）的历史先例，以及综合边界判断。本章的历史证据密度较高，原因是该领域最深的教训恰恰来自失败——专家系统与 MBUID（Model-Based UI Development，模型驱动的用户界面开发）两代"把知识形式化后自动生成"的尝试，为今天的 Agent 知识工程提供了成本极低的反面教材。

### 12.1 知识形式化：为什么不能"全塞 context"

"把设计规范全部塞进系统提示词"是设计 Agent 最直觉的方案，其失败的证据链已经闭合。**Lost-in-the-Middle**（Liu et al., TACL 2024）证明 LLM 对长上下文中部信息的利用率呈 U 形曲线下降，相关信息置于开头或结尾时性能最好 [A026]；**Context Rot**（Chroma 2025，厂商技术报告、未同行评审，与前者方向一致，整体按 Medium-High 处理）测试 18 个前沿模型，全部随输入变长而性能退化，即使在简单检索任务上 [C031]；**Anthropic 官方工程立场**给出可操作阈值：知识库小于约 200k token（约 500 页）才可考虑全塞，更大则必须检索，且上下文工程的目标是"最大化预期结果的最小高信号 token 集" [B029][B005]。三条证据收敛为同一结论：知识必须结构化 + 按需检索 + 渐进披露，而不是堆 prompt——"输出仍然随机"不是 prompt 技巧问题，是注意力结构问题。

**Anthropic Agent Skills** 是目前最接近"知识条目形态"的工业事实标准（2025-10 发布，2025-12 成为开放标准）：三层渐进披露——L1 元数据（name+description，约 100 token）常驻系统提示、L2 SKILL.md 正文在判定相关时加载（<5k token）、L3 捆绑文件按需读取且容量无上限 [B006]。该模式在数月内被 OpenAI、Google、GitHub Copilot、Cursor 跟进，学术综述确认其架构定位是"注入程序性知识"而非工具调用 [C004]（该层证据为 2025–2026 新成果，按前沿层纪律处理）。Systemsmith 规则 schema 可直接映射：{id, category, scope, statement} 为 L1 索引，完整条目为 L2，examples/counterexamples/validation 为 L3；`applies_when` 字段同时承担触发条件与检索过滤键两个架构职能。

**规则引擎与专家系统的历史**给出形式化的边界。专家系统（MYCIN、XCON 谱系）的衰落主因不是"规则化"错了，而是知识获取昂贵、窄域之外脆性（规则外输入即崩溃）、维护不可持续 [C019][D003]；而生产规则引擎（Drools 类）至今存活于"规则外化"场景——规则独立于应用代码版本化、审计、热更新 [E027]。四十年经验转化为四条设计约束：(1) 规则只承载**可判定子集**（对比度数值、目标尺寸、token 引用合法性），LLM 能推理的不硬编码；(2) 规则库必须有知识获取流水线（从 WCAG/HIG/ISO 半自动抽取 + 人工审定），否则死于知识获取瓶颈；(3) 每条规则有 owner、版本与弃用路径，否则死于维护；(4) 规则外情形必须优雅降级到检索 + 推理，避免脆性。确定性规则引擎 + LLM 推理 + 人工兜底的混合架构，是这段历史收敛出的形态。

### 12.2 设计验证自动化：lint 模板与截图评审的可信度

**axe-core** 是设计领域最成功的规则引擎先例：其工程承诺为"零误报"——不确定的情形标记为"需人工复核"而非判违规，被 Google Lighthouse、Microsoft Accessibility Insights 等作为共同底层引擎采用 [B001][D001]。**OPA**（Open Policy Agent，CNCF graduated）证明了 policy-as-code 范式的另一半：策略（Rego，声明式、基于 Datalog、保证确定性与终止性）与应用代码解耦，同一策略文件跨系统复用，每次决策产生可回放的审计日志 [B028][D006]。两者拼合出设计 lint 的完整模板：确定性与终止性保证（Rego 式）+ 零误报与人工兜底（axe 式）+ 决策可审计回放（OPA 式）。2025–2026 年的 design lint 生态已在三个层面落地：代码层 token/组件合规校验（@lapidist/design-lint，JSON/SARIF 输出、CI 渐进收紧 warning→error）、Figma 文件层一致性检查（明确"宁可漏报不可误报、每条规则附解释"的保守哲学）、AI-handoff 就绪检查（层命名、变量绑定等"AI 可消费性"）[D005][E015][E010]。

与之对照，**LLM 截图评审**的可信度证据全部是约束性的。UXBench 的表述最精确：只看首屏渲染的评委"产出流畅但证据薄弱的批评"，因为大量可用性失败是交互性的，可靠评审必须操作控件、观察状态转移、测试错误与恢复路径，并把每条发现绑定到运行中界面的具体行为 [C005]；GPT-4 对 mockup 的启发式评审随设计迭代改进而性能退化 [A004]；前沿评估基准（VISTA）已开始混合确定性检查（Playwright 测试）、规则检查、CLIP 相似度与人工标注，以对冲单一 LLM 评委的提示词与顺序敏感 [C053]。设计验证的正确架构因此是 9.3 三段式的工程化：确定性 lint 做地板，LLM 初筛带偏差缓解协议（成对交换、多评委、rubric 锚定、定期与人类样本校准），交互式取证替代静态截图，人类保留终裁权。

### 12.3 框架无关组件模型：契约要素与意图层空白

组件能否脱离 React/Vue 定义？分项盘点显示大部分要素已被前人分别形式化。**行为契约**：WAI-ARIA APG 为约 30 个组件模式逐一规定 role、states/properties 与完整键盘交互模型，完全不引用任何框架实现，是事实上的框架无关行为契约语料库 [N001]。**解剖结构**：Open UI（W3C 社区组）的组件规范模板覆盖 anatomy、parts、slots、states、键盘交互、hit-testing 与 AAM 映射——一份"组件框架无关契约"的标准化目录；其最成熟成果 Customizable `<select>` 已于 Chrome/Edge 135（2025-04）发布 [N042][N060][N041]。2025-08 新成立的 W3C UI Specification Schema CG 进一步明确要定义 implementation-agnostic 的 UI 元素 meta-model，说明该方向是 W3C 社区的活跃前沿（项目极早期，仅作方向性证据）[N035]。**跨框架行为逻辑**：Zag.js 把 50+ 组件模式实现为有限状态机，`machine`（框架无关行为核）与 `connect`（状态到 props/ARIA 的语义投影）两段式架构经 Chakra UI、OVHCloud 等生产验证——组件行为可以用状态机做框架无关的正式定义；但必须注明其局限：machine 是 JS 代码而非声明式规范，跨 Compose/Flutter/Qt 等非 JS 栈需重新实现，且只覆盖单组件内部行为、不覆盖区域间布局语义 [C061][C027]。

综合上述载体，一份完整的**组件契约要素清单**为：Purpose（意图/用途）/ Anatomy 与 Parts / Slots / States / Behavior（行为与转换）/ Interaction（输入模态）/ Accessibility（ARIA 语义与键盘契约）/ Content rules（内容约束）/ Visual semantics（视觉语义，以 token 引用而非内嵌值）/ Platform mappings（平台映射表）。其中行为、状态、可达性、解剖四层已有强载体；**设计意图层（purpose、importance、visibility conditions、region role）几乎无现存形式化载体——这是工业空白**（该判断为多证据综合，置信度 Medium-High）。空白即定位：Agent 消费组件知识时，APG/Open UI/Zag 能告诉它"组件怎么做对"，但没有任何工业制品告诉它"这个区域为什么存在、多重要、何时可见"——这正是 SDIR 的差异化空间。

### 12.4 SDIR 先例：Cameleon、MARIA/TERESA 与 MBUID 的四条死因

为"语义化 UI 中间表示"寻找先例，首先是一次排除法。XUL、XAML、MXML、QML、Android XML 全部是 **Render IR**——声明式描述 widget 树 + 布局属性 + 数据绑定，直接编码渲染细节，没有任何一层表达"这个区域为什么存在/多重要/何时可见"；它们各自在单平台内成功（QML 之于 Qt、Android XML 至今主流），因为它们不假装跨平台，也随平台时代共生共死（XUL 随 Firefox 2017 移除扩展体系而消亡）[E026][E034]。

**SDIR 最直接的理论先例是 Cameleon Reference Framework 的 AUI 层**（Calvary、Coutaz、Thevenin 等，2003）：四层抽象 Task & Concepts → AUI（Abstract UI，模态无关）→ CUI（Concrete UI）→ FUI（Final UI），层间以 reification（抽象→具体）、abstraction、translation 三种变换连接，context of use = user × platform × environment [A059]。AUI "expresses any CUI independently of any interaction modality"——这正是 SDIR"不描述渲染细节、由 Platform Adapter 解释"的 2003 年版本 [A059]。在此框架内，两个系统提供了 SDIR 关键机制的学术原型：**MARIA**（Paternò 等，ACM TOCHI 2009 + 2012 W3C Member Submission）的 AUI 层把交互器按语义功能分类（edit/selection/output/control），其 AUI→CUI 细化表把抽象元素映射到具体控件——SingleChoice 可实现为 radio_button、list_box、drop_down_list 或 image_map——这张"语义→控件"细化表就是 Platform Adapter 决策表的学术原型 [A062]；**TERESA**（Mori, Paternò, Santoro 2003）的 AUI 组合算子按沟通目标分类为 Grouping / Relation / Ordering / **Hierarchy**（"some elements within the group are more important than others"）——这是学术史上与 SDIR importance/priority 语义最接近的正式机制 [A057][A009]。抽象 UI 建模并非全部失败：IFML 2013 年被 OMG 采纳为标准并在企业 MDD 利基存活，证明"平台无关 UI 建模"可以标准化——但其抽象对象是交互流与内容绑定，不含重要性语义 [N046]。

MBUID（1988–2012 全谱系）为何从未主流化？Szekely 1996 的领域自我回顾与 Myers/Hudson/Pausch 2000 的 threshold/ceiling 框架（失败工具要么上手成本太高、要么表达能力上限太低）是基准诊断 [A030][A048]，综合为四条死因（该综合为单一维度多源证据链，置信度 Medium-High）：**抽象泄漏**（CUI→FUI 总要暴露平台细节，"全自动"承诺必破）；**工具链成本**（建模语言学习成本高于直接编码，threshold 过高）；**生成 UI 天花板**（reification 本质是设计决策，启发式硬编码产出"通用但平庸"的 UI，设计师拒绝接受）；**设计意图无法形式化**（SingleChoice→radio 还是 dropdown 取决于空间、惯例与品牌，无法确定性编译）。

LLM 时代出现三个结构性新变量：(a) LLM 可直接读写语义模型，建模工具链成本坍塌——补死因之一；(b) 模型的消费者从代码生成器变成推理 Agent——Agent 不需要模型"编译"，只需要模型"可读"，死因之三（无活消费者）消除；(c) APG/headless/DTCG 已把行为契约与视觉值层工业化——SDIR 不必重建已解决的层。同时，端到端生成缺少语义中间层的代价已被实测：带意图澄清的系统平均 2.6 轮修改即可满意，而无澄清的 v0 需 6.1 轮且仍有用户不满 [A027]；v0 社区报告生成质量随模型版本"一夜之间显著下降"（舆情样本有偏，按 Low 处理，但方向与学术研究一致）[C032]——无中间表示的端到端生成，质量受模型漂移直接冲击，无任何稳定层可锚定。然而**第四条死因（reification 不可判定）是新变量补不上的**：语义→布局的映射含真实设计裁量，LLM 只是把裁量从人转给了 Agent，并未消除其不可判定性。正确应对不是假装能自动化，而是把裁量点显式建模为知识条目类型（decision point + 影响因子 + 默认启发式 + 何时升级人工）。

### 12.5 综合判断：SDIR 的边界守护原则

**"SDIR 不应成为另一种 CSS/JSX"的判断成立（High 置信度，三重证据）。** 其一，历史上所有编码渲染细节的 UI 语言都锁死在单平台时代，所有试图在同一 IR 内装下语义 + 渲染的系统都死于复杂度过载 [E026][A030]。其二，2026 年的工业现实已经"票选"了分层：DTCG 管值、APG/headless 管行为、框架管渲染——SDIR 若重复任何一层都是负价值，其独占空档是意图/角色/重要性/可见性这一工业空白层。其三，LLM 生成质量不稳的根因被多项研究定位为"缺意图/语义中间层"，SDIR 的价值恰是成为这个锚定层 [A027][C032]。

由此给出 SDIR 的内容边界与守护原则。应进入 IR 的：意图与目的（purpose）、区域角色（region role）、重要性与信息优先级（importance/priority，对标 TERESA Hierarchy 算子）、可见性条件（visibility conditions）、交互语义类型（MARIA 式 selection/edit/output/control + 引用 APG pattern 的行为契约）、组合关系（grouping/relation/ordering）、内容语义约束、平台映射的承诺与约束、对 Design Tokens 的引用。绝对不应进入的：像素/几何/坐标、布局算法与容器类型（flex/grid/stack 是 Adapter 的输出）、样式值（用 token 引用）、控件选型（radio vs dropdown 是 Adapter 裁量）、具体文案、框架/平台 API 痕迹。判定测试可形式化为一条**边界守护原则：SDIR 中不允许出现任何无法在非视觉模态（语音、无障碍树）下保持意义的陈述**——这既是 Cameleon AUI 的原始定义测试 [A059]，也给 Agent 提供了可执行的入库检查：一条陈述若翻译到无障碍树后意义丢失，它属于渲染层，不属于语义层。同时必须承认 Adapter 内的设计裁量是 feature 而非 bug：SDIR 的正确自我定位是"约束与意图的载体 + 裁量点的显式标注"，承诺确定性编译只会重蹈 MBUID 覆辙——这是四十年失败史为本项目划出的最清晰的一条边界。
