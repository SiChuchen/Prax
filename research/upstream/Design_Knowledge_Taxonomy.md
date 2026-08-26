# D5 设计知识分类体系（Design Knowledge Taxonomy）

- 交付物编号：D5｜编制日期：2026-08-25
- 定位：Systemsmith 设计知识底座的分类骨架，供后续知识库建设、RAG 检索过滤、D7 规则模式（rule schema）引用
- 输入：dim01–dim08 研究简报、跨维度洞察（Insight 1–10）、交叉验证报告、统一 Source Registry

---

## 1. 设计目标与分类学约束

本 taxonomy 服务于一个明确的消费者：AI Coding/Design Agent。因此它不是图书分类法式的知识地图，而是一套**机器可执行的元数据方案**——每个知识条目入库时必须沿三个正交切面被标注，三个切面分别回答三个独立问题：这条知识**谈什么**（域）、它**凭什么成立**（知识类型）、Agent **怎么用它**（消费方式）。三个切面正交的含义是：任何一个域内都可以同时存在规范、实证模型、启发式与神话；任何一条启发式都可能被用作软启发、检索参考或冲突裁决因子。把三个问题压进一棵树（如传统的"视觉设计→色彩→对比度"目录）会造成同一条目被迫单归属，这正是本设计要避免的。

设计约束来自研究中已验证的四条结构性事实。第一，整个 HCI 知识体系存在"三次独立收敛的同一分层"：ISO 9241 系列自身按"概念（-11）→交互原则（-110）→呈现（-112/-125）→界面元素（-161）→过程（-210）"组织 [N040][N045][N049][N034][N016]；学术 MBUI 社区的 Cameleon 参考框架按 Task→AUI→CUI→FUI 四层组织 [A059][N024]；企业设计系统按 principles→guidelines→patterns→components→tokens 组织 [N032][C055]。三个互不隶属的体系收敛出同构分层，是本 taxonomy 骨架的最强证据。第二，三个体系共同表明唯一的硬边界是"删除该陈述是否丢失设计意图"（SDIR 判定测试），其余层间边界均为软分层。第三，经典知识在传播中丢失边界条件后会退化为神话（7±2→菜单≤7 项 [N044][B025]；Doherty 400ms [N030]；3-click rule [A032]），神话必须与有效知识物理隔离存储。第四，知识条目的死亡率与维护机制强相关，taxonomy 本身必须内建扩展与生命周期规则（见第 7 节）。

## 2. 第一切分：语义域 vs 渲染域

### 2.1 为什么不是 L0–L7

项目初始假设提出 L0–L7 八层知识分层。跨维度洞察的结论是：该分层不必推翻，但层数不是关键——八层暗示了七条边界，而三个独立体系一致证明**硬边界只有一条**：一个陈述是否可形式化为渲染值（像素、dp、token、组件属性）而不丢失设计意图 [A059][N024]。Cameleon 的 AUI/FUI 之分、dim07 的 SDIR 判定测试、dim04 关于"guidelines 管像素位置"的教训，全部收敛于这同一条断层线。因此 taxonomy 的第一切分是**两域**而非八层；L0–L7 保留为语义域与渲染域内部的**检索粒度编号**（软分层），其作用是 metadata filtering 的过滤键，而非知识性质的边界。

### 2.2 总结构图（两域四带 + 两个横切平面）

```
┌─ 语义域 Semantic Domain（删除即丢失设计意图；不可形式化为像素）
│   S1 原则带：设计意图与普适原则——认知/知觉/交互的科学与法则层
│      承载域：COG、PER、INT（原则部分）、HFS（原则与过程部分）、FBK/ERR 的原则条目
│   S2 结构带：任务、信息架构、模式、关系层——设计意图的结构化表达
│      承载域：IAN、PTN、VIZ（探索任务部分）、ERR/FBK 的流程条目
│      【关系层子带】region role / importance / visibility / density tradeoff：
│      现有工业制品的公共盲区，SDIR 的 MVP 内容（Insight 4），跨 S2–R1 显式建模
├─ 渲染域 Render Domain（可形式化为值；删除只损失具体表现不损失意图）
│   R1 惯例带：平台惯例与规范数值——绑定 platform + version + 硬件约束
│      承载域：PLT、ACC（合规数值部分）、VIS（惯例性条目）
│   R2 实现带：令牌、组件、布局——可直接代码化的知识
│      承载域：TOK、VIS（排版/网格数值部分）
├─ 横切平面 X1 验证层：评估方法与度量——对两域产出做判定
│      承载域：EVL（同时服务 Agent 的 validation 阶段）
└─ 横切平面 X2 元知识层：关于知识本身的知识——分级、冲突、检索、生命周期
       承载域：KAG（知识库自身的信息架构与治理）
```

三点说明。其一，**域归属测试**：对任一候选条目问"把这条知识从设计中删掉，丢失的是设计意图还是具体表现？"丢意图者入语义域，丢表现者入渲染域。例如"相关项应在视觉上分组"丢意图（S1，PER）；"正文行宽 45–75 字符"丢表现（R1/R2，VIS）——后者只是前者在排版惯例上的一个实例化。其二，**关系层子带**是四个维度独立指认的公共空白（Insight 4：tokens 管值、组件库管零件、存活 pattern 库管流程，但"这个区域为什么重要、何时可见、密度如何权衡"无任何工业制品承载），本 taxonomy 将其显式建模为 S2 与 R1 之间的过渡子带，条目以 VIS、IAN 为主归属域并打 `relational` 标记。其三，域（domain）与带（band）是两个不同字段：带回答"离渲染多远"，域回答"谈什么主题"；同一带内可容多个域，同一域的条目可跨带（如 ACC 的对比度数值在 R1、APG 行为契约在 R2、"无障碍是设计约束而非修饰"原则在 S1）。

## 3. 切面一：域分类（15 个域）

域的划分原则是**按知识回答的问题切分，而非按产品表面切分**。每个域节点给出：定义与边界、核心概念、关键来源、主导知识类型、架构位置、边界争议裁定。域代码为两至三字母大写，供第 6 节 ID 编码使用。

### 3.1 HFS · 人因工程与标准过程（Human Factors & Standards）

**定义与边界**：以 ISO 9241 系列为代表的规范层知识与以人为中心设计（HCD）过程知识。边界上，本域只收"标准文本本身断言什么"与"过程模型如何组织"，不收标准引用的认知科学证据本身（归 COG/PER）。
**核心概念**：usability 三要素（effectiveness/efficiency/satisfaction）与 outcome-of-use 定义、specified users/goals/context 强制绑定、ISO 9241-110 七条交互原则、-112 信息呈现六原则、-161 界面元素、-171 无障碍、-210 HCD 六原则与四活动循环、HCD 过程公共骨架（理解→框定→生成→收敛→验证）、合成用户的边界。
**关键来源**：[N040][N045][N049][N034][N052][N016][N063][A005][A006][B007]。
**主导知识类型**：normative standard。
**架构位置**：语义域 S1（原则）+ X1（-210 过程为验证层提供流程锚点）。
**边界裁定**：ISO 9241-110 的七条交互原则归 HFS（规范表述），但其认知根源（如 error tolerance 对应 Norman 的 slips/mistakes）归 COG/ERR——条目拆分、互设 related 链接，禁止合并为一条。usability 三要素的"指标映射"（effectiveness→成功率、satisfaction→SUS）归 EVL，HFS 只保留定义与绑定义务 [N040][A053]。

### 3.2 COG · 认知（Cognition）

**定义与边界**：关于记忆、认知负荷、学习与心智模型的实证科学。边界上只收可还原到认知机制的陈述；"基于认知机制得出的界面做法"归对应应用域。
**核心概念**：工作记忆容量（Cowan 4±1，单一来源中等置信）、chunking、Miller 7±2 及其范畴误用、recognition over recall、认知负荷理论（intrinsic/extraneous/germane，教学设计语境，迁移 UI 需降权）、序列位置效应（UI 应用为弱外推）、心智模型、专家逆转效应。
**关键来源**：[N043][N044][N020][N023][B039][B025]。
**主导知识类型**：empirical model（附边界条件）；神话条目单列隔离。
**架构位置**：语义域 S1。
**边界裁定**：COG 与 PER 的分界是"刺激呈现后是否需要中枢加工资源"——知觉分组、preattentive 归 PER，工作记忆、负荷、学习归 COG。心智模型作为认知构念归 COG；由心智模型推导页面结构的方法（OOUX/ORCA）归 IAN [B026][B027]。

### 3.3 PER · 知觉（Perception）

**定义与边界**：视觉（及部分听觉/触觉）知觉机制：刺激如何被前注意加工、分组与搜索。不收"如何用这些机制排版"（归 VIS）。
**核心概念**：Gestalt 分组原则（proximity/similarity/common region 等）、preattentive processing、选择性注意、变化盲与非注意盲、视觉搜索、视觉层级的感知基础、affordance 的生态心理学源头（Gibson）。
**关键来源**：[N027][A037][N028][N008][N009][A018][A038][N026]。
**主导知识类型**：empirical model（Gestalt 为描述性规律而非预测模型，需标注）。
**架构位置**：语义域 S1。
**边界裁定（视觉层级之争）**：视觉层级的**感知机制**（大小/色彩/位置如何驱动注意顺序）归 PER；视觉层级的**设计操作**（如何为一个界面建立层级）归 VIS。裁定理由：前者跨技术栈不变、可还原到知觉不变量；后者依赖媒介与惯例，两者证据等级与消费方式不同，合并会污染 universal 语料库。affordance 裁定：Gibson 源头归 PER 作溯源注记；Norman 的 perceived affordance/signifier 是交互概念模型，归 INT [N011][A002][N007]。

### 3.4 INT · 交互（Interaction）

**定义与边界**：人与系统交换动作与信息的机制层：运动控制、选择反应、对话节奏、概念模型。不收具体控件行为契约（归 TOK/ACC 的 APG 条目）。
**核心概念**：Fitts 定律（含 Shannon 形式与边界）、Hick–Hyman 定律（决定变量是信息量而非选项数）、响应时间阈值与 Doherty 神话、直接操纵三原则、affordance/signifier/mapping/constraints、Norman 七阶段与 gulfs、slips vs mistakes 的机制基础、键盘/指针输入特性。
**关键来源**：[N025][N017][N010][N030][B032][N021][N011][A002][N007]。
**主导知识类型**：empirical model + canon heuristic。
**架构位置**：语义域 S1（机制）为主。
**边界裁定**：Fitts 定律本体归 INT；target size 的三个数值体系（WCAG 24px、HIG 44pt、Material 48dp）不归 INT——它们是惯例与规范，分别归 ACC 与 PLT，以 related 链回 INT 的机制条目 [N002][B008][B013]。响应时间的**心理阈值知识**归 INT，"系统状态必须可见"的反馈义务归 FBK。

### 3.5 IAN · 信息架构与导航（Information Architecture & Navigation）

**定义与边界**：信息集合的组织、命名、寻路与检索。本域合并了任务书原方案中独立的 IA 与 Navigation 两域，理由：权威框架将 navigation 定义为 IA 四系统之一 [A020]，拆开后每条导航知识都将双重归属；且导航的全部独立实证方法（card sorting、tree testing）恰是 IA 的验证手段，两者共享同一来源群与消费方式。边界上，"导航控件的像素规格"归 PLT/TOK。
**核心概念**：四系统（organization/labeling/navigation/search）、分类学与受控词表、深度-广度权衡（16 顶层 × 2–3 层为 1998 年 Web 语境的低置信外推）、faceted classification、OOUX/ORCA 对象优先推导、information scent、导航模式（tabs/sidebar/breadcrumb/command palette）、card sorting、tree testing、progressive disclosure（实证基础薄弱，需标注）。
**关键来源**：[A020][B026][B027][B017][C020][C021][A058][N033][C028][B042][A013]。
**主导知识类型**：canon heuristic + industrial pattern；少量 empirical（scent 的理论根基归 COG 侧的信息觅食模型 [N018][N050]）。
**架构位置**：语义域 S2。
**边界裁定**：information foraging 的**理论模型**归 COG（行为科学），scent 的**标签设计应用**归 IAN。search 系统归 IAN；搜索框组件规格归 TOK。神话条目（3-click rule、菜单≤7 项）归 IAN 并打 myth 标记入隔离库 [A032][B025]。

### 3.6 PTN · 交互设计模式（Interaction Design Patterns）

**定义与边界**：以 problem–context–forces–solution 结构承载的、可复用的界面问题解法，及其方法论史（Alexander→GoF→Tidwell→企业设计系统 Patterns 层）。本域为任务书原方案之外的新增域，理由：dim03 与 dim06 均证明 pattern 是独立于组件的知识物种（problem 导向 vs solution 导向），2026 年其存活形态是企业设计系统的 Patterns 层 [N055][A063][C055]；不单独设域会使 20 个模式正典无家可归或错误并入 TOK。
**核心概念**：模式四要素结构、pattern≠component、模式语言的兴衰教训（无 owner 与更新流程即死）、List→Detail、Command Palette、Undo vs Confirm、Optimistic UI、Dashboard vs Explorer、empty states、inline editing、modal 使用边界。
**关键来源**：[N055][A019][A063][B038][C055][C059][B016][C057][E033][E035]。
**主导知识类型**：industrial pattern + canon heuristic（方法论部分）。
**架构位置**：语义域 S2；模式中的权衡（forces/tradeoffs）是 decision factor 的天然载体。
**边界裁定**：模式的**结构描述**（何时用、权衡什么）归 PTN；模式的**组件实现**归 TOK。empty state 的"何时出现/传达什么"归 PTN，"空状态是状态可见性义务的一部分"这一原则归 FBK。

### 3.7 VIS · 视觉设计（Visual Design）

**定义与边界**：界面视觉层的组织知识：排版、网格、色彩、密度、留白与"专业感"的关系层。边界上只收可跨平台陈述或显式标注为惯例的知识；纯 token 值归 TOK。
**核心概念**：CRAP 四原则（教学法层，非科学）、网格系统与 8pt/4pt 惯例、排版层级与行宽/行高、表格数字排版（tabular figures）、色彩语义与 color roles、密度作为一等设计维度、whitespace 的弱证据、"不专业"六病因、card 过度使用。
**关键来源**：[A054][A025][B034][B037][C007][A053][C029][B030][A038]。
**主导知识类型**：canon heuristic + industrial pattern；明确区分"感知证据支持"与"教学法惯例"。
**架构位置**：跨带域——感知基础条目链 PER（S1），密度/优先级等关系层条目在 S2–R1 过渡子带，排版网格数值在 R1/R2。
**边界裁定**：色彩**语义建模**（角色而非色值）归 VIS 与 TOK 双属——VIS 主属"为什么用角色"，TOK 主属"角色如何落成 token 层" [C007][B023]。密度裁定：密度权衡的**论证与原则**归 VIS（关系层），各平台的 density modes **实现**归 PLT/TOK [B014][C009]。

### 3.8 ACC · 无障碍（Accessibility）

**定义与边界**：使界面可被最大范围人群（含辅助技术用户）使用的规范、契约与验证知识。边界上收规范条文、行为契约与自动化边界；不收"为什么无障碍重要"的倡导性内容。
**核心概念**：WCAG 2.2（现行合规 baseline）与 3.0（watch-only，强制日期戳）、POUR、对比度数值（4.5:1/3:1）、SC 2.5.8 target size 24px、WAI-ARIA 1.2/1.3、APG 31 个行为契约模式、"No ARIA better than bad ARIA"、reduced motion、自动化检测覆盖率双口径（57.38% issue 量 / 31% WCAG 2.2 A/AA 55 SC，分母强制随行）、"工具不能判定无障碍"的官方立场。
**关键来源**：[N005][N004][N003][N001][N002][N006][C002][A001]。
**主导知识类型**：normative standard 为主；覆盖率证据为 product evidence。
**架构位置**：R1（规范数值）+ R2（APG 行为契约）+ S1（无障碍即设计约束的原则）。
**边界裁定**：对比度**数值合规**归 ACC（hard rule）；色彩**语义体系**归 VIS/TOK。APG 行为契约归 ACC 与 TOK 双属——它是无障碍规范也是框架无关组件模型语料 [N001]。WCAG 3.0 条目一律打 frontier 标记与强制过期（Insight 10）。

### 3.9 FBK · 反馈与状态（Feedback & Status）

**定义与边界**：系统向用户传达"发生了什么、正在发生什么、结果如何"的知识。边界上收状态可见性、进度、确认；错误内容的表达与恢复归 ERR。
**核心概念**：状态可见性（Nielsen #1）、响应时间与反馈节奏（即时/1s/10s 分级）、progress indicator、骨架屏与乐观更新的状态语义、empty states 的状态面向、系统状态与心智模型的对齐。
**关键来源**：[A050][N030][B032][N045][E033]。
**主导知识类型**：canon heuristic；响应时间阈值中 400ms 单点为低置信（IBM 内部报告不可复核）[N030]。
**架构位置**：语义域 S1（原则）+ S2（流程）。
**边界裁定**：FBK 与 ERR 的分界是"系统行为是否偏离用户意图"——正常状态与成功确认归 FBK，偏离后的告知、解释与挽回归 ERR。optimistic UI 的**模式条目**（何时可用、回滚权衡）归 PTN，其**状态语义原则**（用户必须能感知最终一致性）归 FBK [E033]。

### 3.10 ERR · 错误与恢复（Errors & Recovery）

**定义与边界**：防止、容忍、解释错误并支持恢复的知识。边界上收错误的人类侧机制与系统侧策略；纯评估中的问题严重性分级归 EVL。
**核心概念**：slips vs mistakes、error prevention over recovery、error tolerance（ISO -110 原则之一）、undo over confirmation（损失厌恶根基）、约束与 forcing functions、错误信息的可行动性、破坏性操作的分级防护。
**关键来源**：[N011][N045][A050]。
**主导知识类型**：empirical model（人类错误分类学）+ canon heuristic（策略层）。
**架构位置**：语义域 S1 + S2。
**边界裁定**：错误**预防机制**（约束、默认值）归 ERR；预防机制的**控件实现**归 TOK。"undo vs confirm"拆为两条：ERR-undo-over-confirm（原则，可还原到损失厌恶与 slips 机制）与 PTN-undo-vs-confirm-pattern（模式，含适用边界）——这是同一知识在原则带与结构带的合法双条目，非重复。

### 3.11 VIZ · 数据探索与可视化（Data Exploration & Visualization）

**定义与边界**：以图形编码支持数据理解、探索与决策的知识，含 dashboard 类高信息密度界面。边界上收可视化编码与探索任务；纯图表组件规格归 TOK。
**核心概念**：Visual Information-Seeking Mantra（overview first, zoom & filter, details-on-demand；作者自述无实证支撑，authority≠证据强度）、task-by-data-type 分类、preattentive 视觉编码通道、定量标度的通道有效性排序、dashboard 设计 vs 数据可视化的分野、密度与焦点的权衡。
**关键来源**：[N019][A021][E023][N028][A038][B012]。
**主导知识类型**：canon heuristic（mantra）+ empirical model（编码通道）。
**架构位置**：语义域 S2（探索任务）+ R1（编码惯例）。
**边界裁定**：preattentive 机制归 PER，其在可视化编码中的**应用排序**归 VIZ。dashboard 的**模式条目**（Dashboard vs Explorer 的适用场景）归 PTN，其**信息优先级与密度组织**归 VIZ 的关系层条目。mantra 的反向证据（search-first 场景）必须作为 counterexample 随条目存储（单一来源，中等置信）[A021]。

### 3.12 EVL · 评估与度量（Evaluation & Metrics）

**定义与边界**：判定界面质量的方法与指标：专家评估、用户测试、标准化量表、自动化检测与 LLM 评审的可信边界。这是唯一的"方法论域"——其知识对象不是界面而是评估活动本身。
**核心概念**：heuristic evaluation（λ≈0.31、N=5 约 75%，统一表述为成本-收益规划估计而非定律）、cognitive walkthrough、可用性测试指标操作化、SUS/UMUX-LITE/NASA-TLX、HEART 框架（engagement 在企业场景的局限）、严重性分级、自动化可行性三段式（地板/中间带/天花板）、LLM-as-judge 偏差（问题存在性 κ≈0.5 可初筛，严重性 α≈0 必须人工终裁）、合成用户不能替代真实用户。
**关键来源**：[N012][A022][A023][B019][A043][A044][A056][A052][A053][A017][B033][C006][A004][A028][A029][A055][C033][A005][A006]。
**主导知识类型**：empirical model + product evidence；方法学规范。
**架构位置**：横切平面 X1——对两域产出做判定，同时是 Agent validation 阶段的知识源。
**边界裁定**：Nielsen 十条启发式作为**评估工具**归 EVL；十条中每一条作为**设计知识**拆分到对应域（#1→FBK、#6→COG、#9→ERR 等），EVL 侧只保留评估用法与已知局限。HEART 的 engagement 维度与 ISO -110 的 user engagement 原则之张力保留为冲突区活例（C7），不作单一立场抹平 [N045][A053]。

### 3.13 PLT · 平台惯例（Platform Convention）

**定义与边界**：Apple HIG、Material Design 3、Fluent 2 等 OS 平台级规范发布的惯例知识。边界上只收"该平台 scope 内有效"的陈述；任何跨平台引用必须显式降级。
**核心概念**：HIG 2026 首页三原则（Hierarchy/Harmony/Consistency，单一来源）、44pt/48dp target 体系、8dp 网格、window size classes、M3 color roles 与 on-配对、M3 Expressive（厂商研究无独立复现）、Fluent density modes、SF Symbols 语义、Liquid Glass 演进。
**关键来源**：[B008][B013][B022][B023][B021][B014][B010][E012]。
**主导知识类型**：platform convention——scope 内为硬约束，跨 scope 降为参考。
**架构位置**：渲染域 R1。
**边界裁定**：PLT 与 ACC 的 target size 之争裁定：24px 是规范（ACC，universal 语义下的合规下限），44pt/48dp 是惯例（PLT，绑定平台），三者不可混用、不可互相推导 [N002][B008][B013]。平台设计系统是"惯例的权威发布"，企业设计系统是"治理机制的实证样本"（Insight 9）——前者内容入 PLT，后者机制入 TOK 与 KAG。

### 3.14 TOK · 设计令牌与组件模型（Design Tokens & Component Model）

**定义与边界**：设计决策的机器可读表达：token 三层模型、主题架构、组件契约与框架无关行为模型，含企业设计系统的治理与生命周期知识。
**核心概念**：DTCG Format Module 2025.10（首个 stable，Community Group Report 而非 standards-track）、primitive→semantic→component 三层、theme/density 的 token 分层实现、跨栈共享边界（平台约定尺寸不宜直接共享）、token 表达不了组合关系与语境（规则模式补齐）、headless UI 哲学、Zag.js 状态机行为契约、Open UI、组件成熟度模型（alpha→beta→stable→deprecated）与弃用路径、贡献治理。
**关键来源**：[N032][N031][N062][B031][B014][C050][C061][N042][C023][C017][C045][B015]。
**主导知识类型**：industrial pattern + normative-adjacent 社区规范 + platform convention（各系统实现部分）。
**架构位置**：渲染域 R2 为主；治理与成熟度知识归 X2 复用（知识条目生命周期直接借用组件成熟度模型，Insight 7）。
**边界裁定**：TOK 与 PLT 的分界是"是否绑定单一 OS 生态"——M3 的 token 规格同时是 Material 的发布物，归 PLT 主属、TOK 作跨栈模式参考；"三层 token 模型"作为跨系统共识归 TOK（H6，三维度独立取证）[B031][C050]。组件**视觉规格**归 TOK，组件**无障碍行为契约**归 ACC（APG）双属。

### 3.15 KAG · 知识工程与 Agent 消费（Knowledge Engineering & Agent Consumption）

**定义与边界**：关于"设计知识本身如何被形式化、分级、检索、裁决与维护"的元知识。这是唯一不直接谈界面设计的域，其知识对象是 Systemsmith 知识底座自身。
**核心概念**：长上下文退化（lost-in-the-middle、context rot）、hybrid search 与 metadata filtering、Agent Skills 三层渐进披露、provenance 随行与 entailment 检查、专家系统死因（知识获取瓶颈而非规则化错误）、policy-as-code 与 OPA 范式、GRADE 初始级+升降级域、lex specialis/posterior、ATAM 场景化冲突、ADR/设计决策记录、补偿 vs 非补偿裁决、frontier 层快速收录+强制过期策略。
**关键来源**：[A026][C031][B005][B029][B006][D002][C004][C019][B028][D006][N013][N014][N015][A033][A034][A007][B002][B003][A010]。
**主导知识类型**：跨域方法学（循证医学/法学/软件架构借鉴）+ product evidence。
**架构位置**：横切平面 X2；本域条目同时定义其他十四域条目的元数据结构。
**边界裁定**：KAG 与 EVL 的分界是"判定对象"——EVL 判定界面，KAG 判定知识条目与 Agent 输出。LLM-as-judge 作为**评估界面**的方法归 EVL，作为**验证 Agent 输出引用**的机制（entailment 检查）归 KAG [A040][A041][A042]。

## 4. 切面二：知识类型分类（确证性质）

域分类回答"谈什么"，知识类型回答"凭什么成立"。判定方法是**可还原性测试**（Insight 2）：能还原到人类认知/知觉不变量的为普适知识；能还原到硬件/OS/时代条件的为惯例；无法还原到一手来源的为神话。七个类型如下。

| 知识类型 | 定义 | 判定要点 | 典型例证 | Registry 权威级映射 |
|---|---|---|---|---|
| normative standard | 标准组织或法规发布的规范文本，scope 内具有约束力 | 有正式编号、版本、发布机构；必须带版本与日期 | ISO 9241-11:2018 [N040]、WCAG 2.2 [N005] | N（标准文本部分） |
| empirical model | 有原始实验、可复现数据、明确边界条件的科学模型 | 能指出原始实验与边界条件；警惕传播中丢失边界 | Fitts [N025]、Hick–Hyman [N010]、Cowan 4±1 [N043] | N（原始同行评审论文）/ A（综述与教科书转述） |
| canon heuristic | HCI 经典体系中的经验性判断工具，适用面广但可违反、需判断 | 有权威出处但非定律；评估者需按语境裁量 | Nielsen 10 条 [A050]、Norman 概念模型 [N011]、CRAP [A054] | A |
| platform convention | OS 平台级规范的惯例发布，绑定平台+版本+硬件 | scope 内硬约束，跨 scope 自动降级 | HIG 44pt [B008]、M3 8dp 网格 [B013] | B |
| industrial pattern | 工业界收敛的成熟实践模式，无标准地位但有跨组织收敛证据 | ≥2 个独立组织收敛为中等等级证据；单组织为弱证据 | 三层 token 模型 [B031][C050]、Carbon/Atlassian patterns [C055] | C |
| product evidence | 具体产品/工具/数据报告的实测证据，样本真实但常无独立复现 | 必须带样本、口径、日期；厂商自研数据标 C 并注明 | Deque 覆盖率报告 [C002]、WebAIM Million [A001] | D / C（厂商自研数据） |
| myth | 已证伪或无一手来源的流行"规则"，保留用于主动防御 | 隔离库存储；条目含证伪依据与正确知识链接 | 菜单≤7 项 [B025]、3-click rule [A032]、Doherty 400ms [N030] | E + 隔离标记 |

映射表的三点使用纪律。第一，**权威级与知识类型是两个维度**：Registry 的 N 级同时容纳 normative 标准文本与原始同行评审论文（如 Shneiderman 1996 [N019] 为 N 级，但其知识类型应标 canon heuristic——作者 2026 年自述 mantra 无实证支撑，权威级≠证据强度，两者分开标注）。第二，**同一来源的权威级是 scope 的函数**：平台规范在本平台 scope 内为硬约束（B），跨平台引用降为 C；企业设计系统条目作为机制先例为 B 级参考、作为具体数值为 C（Insight 9，已按交叉验证 §5 统一：B 仅保留给 Apple/Material/Fluent 等 OS 平台级规范，Carbon/ADS/Primer/EUI 一律 C）。第三，**myth 不是垃圾而是资产**：隔离库条目供 Agent 主动反驳用户输入中的神话，是知识库的反向价值；每条 myth 条目强制 `debunked_by` 与 `correct_entry` 两个链接字段。

类型的动态性按 Insight 6 执行：类型标注是初值，须附 `source_version + source_date + review_by` 时间戳三元组；GRADE 式升降级域（陈旧性、跨平台收敛、实证支持）可触发类型迁移（如某 industrial pattern 被标准化后迁为 normative）[N013][N014]。WCAG 3.0、M3 Expressive、AI 交互模式等前沿条目一律打 `frontier` 标记、默认 D 级以下、强制 6 个月过期复审（Insight 10）[N004][B021]。

## 5. 切面三：Agent 消费方式分类

第三个切面回答"Agent 怎么用它"。一条知识可同时具有多种消费方式（多值字段），但必须有一个主消费方式。分类依据是自动化可行性三段式（Insight 5）：地板（可确定性执行）、中间带（LLM 可做但需置信标注）、天花板（本质不可自动化）。

| 消费方式 | 定义 | 自动化段位 | 判定/使用机制 | 典型条目 |
|---|---|---|---|---|
| hard rule | 可确定性判定为通过/违规的知识，可 lint 化 | 地板 | 数值/布尔判定，要求零误报、不确定转人工（axe-core 范式） | 对比度 4.5:1 [N005]、target size 24px [N002]、token 引用合法性 [N032] |
| soft heuristic | 需要评估者或 Agent 按语境判断的启发式 | 中间带 | LLM 初判 + 置信标注 + needs-human-review 标志（κ≈0.5 量级） [C006] | 视觉层级是否成立、模式适用性初判 |
| retrieval reference | 推理时的背景知识，通过 RAG/渐进披露供给 | 服务全部段位 | 三层披露：L1 索引行 / L2 完整条目 / L3 例证与反例 [B006][D002] | 认知机制、方法论史、域概论 |
| validation target | 设计产出应满足的验收目标，判定依赖证据而非规则 | 天花板为主 | 绑定 specified users/goals/context 的实证验证；机器只能检查证据是否存在 [N040] | usability 三要素达成、真实用户体验指标 |
| decision factor | 冲突裁决时参与权衡的因子 | 中间带 | ATAM 式场景化裁决：冲突对×触发场景×权衡点 [A007]；上段（a11y/safety）非补偿、下段（视觉偏好）补偿 [A010] | 密度 vs 留白、engagement vs 专业工具（C7 活例） |

两条纪律。其一，**规则引擎只承载可判定子集**（Insight 7）：hard rule 之外的知识不得硬编码进 lint 规则——LLM 可推理的交给 soft heuristic 通道，否则重蹈专家系统脆性覆辙 [C019][B028]。其二，**引用≠支持**：Agent 输出中引用了某条目不代表结论被该条目支持，validation 阶段需逐条 entailment 检查（KAG 域机制）[A040][A041]。

## 6. 命名规范：知识条目 ID 编码方案

ID 格式为 `{域代码}-{概念slug}[-{变体}]`，全库唯一、永久稳定、不可复用。

- **域代码**：取第 3 节 15 个三字母代码（HFS/COG/PER/INT/IAN/PTN/VIS/ACC/FBK/ERR/VIZ/EVL/PLT/TOK/KAG）。域代码仅代表主归属域；跨域关系走 `related` 字段，不编码进 ID。
- **概念 slug**：小写英文连字符，取概念的最稳定学名而非具体数值，保证数值修订不改 ID。例：`PER-gestalt-proximity`、`COG-working-memory-capacity`、`INT-fitts-law`、`ACC-contrast-minimum`、`TOK-token-three-tier`。
- **变体段**：仅当同一概念在同一域内需按 scope 分裂时使用，优先用平台/场景名作变体：`PLT-target-size-ios`、`PLT-target-size-android`、`ACC-target-size-wcag`。变体分裂须满足"scope 字段已无法区分"的标准，防止 ID 膨胀。
- **神话条目**：slug 以 `myth-` 起头，实现检索层面的物理隔离可见性：`IAN-myth-three-click-rule`、`COG-myth-menu-seven-items`、`INT-myth-doherty-400ms`。
- **不在 ID 中编码的元数据**：库归属（universal/convention/myth-quarantine）、权威级、成熟度（draft→reviewed→stable→deprecated）、版本。理由：这些字段会随证据演进变化，而 ID 必须稳定；演进历史由 `supersedes`/`superseded_by` 链与成熟度字段承载 [C023]。唯一例外是 myth 前缀——因为"已证伪"这一状态本身即该条目的定义性特征，且 myth 条目永不"升级"为有效知识（证伪被推翻时新建条目而非复用旧 ID）。
- **粒度规则**：一个 ID 对应一个可独立引用、可独立验证的命题。复合知识（如 Nielsen 十条）不获单一 ID，而是十条各自拆分入域；集合本身以域内索引条目（`EVL-nielsen-heuristics-overview`）表达。

## 7. 三切面标注示例

以下 10 个条目演示三切面联合标注。`消费方式` 列主方式在前。所有条目均可按第 6 节方案直接编码入库。

| ID | 名称 | 域/带 | 知识类型（权威级） | 消费方式 | 关键来源 |
|---|---|---|---|---|---|
| COG-working-memory-capacity | 工作记忆容量 4±1 chunk | COG / S1 | empirical model（N，单一来源中等置信） | retrieval reference；decision factor（密度裁决） | [N043][N044] |
| PER-gestalt-common-region | 共同区域分组原则 | PER / S1 | empirical model（描述性规律，N/A） | retrieval reference；soft heuristic（卡片滥用判定） | [A018][N027][A037] |
| INT-fitts-law | Fitts 定律（Shannon 形式） | INT / S1 | empirical model（N） | retrieval reference；decision factor（目标尺寸权衡） | [N025][N017] |
| IAN-myth-three-click-rule | 三次点击规则（已证伪） | IAN / 隔离库 | myth（E） | retrieval reference（防御性反驳） | [A032][B025] |
| ACC-contrast-minimum | 文本对比度 4.5:1/3:1 | ACC / R1 | normative standard（N） | hard rule | [N005] |
| ACC-target-size-wcag | SC 2.5.8 目标尺寸 24×24 CSS px | ACC / R1 | normative standard（N） | hard rule；decision factor（与 PLT 条目冲突时） | [N002] |
| PLT-target-size-ios | HIG 最小点击目标 44×44 pt | PLT / R1 | platform convention（B） | hard rule（scope=apple 平台） | [B008] |
| ERR-undo-over-confirm | 撤销优于确认 | ERR / S1 | canon heuristic（A；可还原至 slips 机制与损失厌恶） | soft heuristic；decision factor（破坏性操作分级） | [N011][N045][A050] |
| VIZ-overview-first-mantra | 视觉信息检索口诀 | VIZ / S2 | canon heuristic（N 级权威但实证地位已被作者降格） | soft heuristic；retrieval reference | [N019][A021][E023] |
| TOK-token-three-tier | primitive→semantic→component 三层令牌模型 | TOK / R2 | industrial pattern（C；三系统独立收敛） | hard rule（命名与引用 lint）；retrieval reference | [B031][B014][C050][N032] |

示例展示的四种典型组合值得注意。规范数值（ACC-contrast-minimum）是"normative standard × hard rule"的纯粹形态，可直接进 lint 引擎；同一主题的机制知识（INT-fitts-law）却是"empirical model × decision factor"，只参与裁量不作判定——这正是第 3.4 节边界裁定的实例化。VIZ-overview-first-mantra 演示了权威级与知识类型的分离：来源为 N 级原始论文，类型却只能标 canon heuristic，且条目必须携带反向证据（search-first）作为反例 [A021]。IAN-myth-three-click-rule 演示隔离库条目的防御性用法：Agent 检测到用户输入含"三次点击"时，应检索该条目并返回证伪依据与正确知识（scent 才是真实机制 [N018]）。

## 8. 维护规则

### 8.1 新知识条目入库的分类决策流程

按以下顺序执行五个判定，每步产出写入条目元数据；任一步无法判定的条目不得进入 reviewed 成熟度。

**第一步·可还原性测试（定类型与库归属）**。依次问三个问题：该陈述能否还原到人类认知/知觉不变量（附不变量引用，即 `cognitive_anchor` 字段）？能，则标 empirical model 或 canon heuristic，入 universal 库。不能，则问：能否还原到具体平台、OS 版本、硬件或时代条件（填 `platform + valid_from/valid_to`）？能，则标 platform convention 或 industrial pattern，入 convention 库。两者都不能、且无一手来源，则入 myth-quarantine 库——不入库不是选项，因为神话条目承担防御职能（Insight 2）[B025][A032]。

**第二步·设计意图测试（定语义域/渲染域）**。问："从设计中删除该陈述，丢失的是设计意图还是具体表现？"丢意图入语义域（S1/S2），丢表现入渲染域（R1/R2）。答案含糊的条目优先怀疑是复合知识，按第 6 节粒度规则拆分后重新判定（SDIR 判定测试的入库应用）[A059]。

**第三步·问题匹配（定域）**。问"这条知识回答什么问题"，匹配第 3 节 15 个域的定义句。落入两域交界时查该两域的边界裁定条款；裁定条款未覆盖的新争议，记录为 taxonomy issue，按 8.2 节原则处理，禁止临时双主属（`related` 链接不受限）。

**第四步·自动化段位测试（定消费方式）**。问："该陈述的满足与否能否被确定性判定（数值/布尔）？"能，主标 hard rule。不能，问："判定它是否本质依赖 specified users/goals/context 的实证？"是，标 validation target（天花板，机器只验证据存在性）[N040]。都不是，则按用途标 soft heuristic；若条目同时承载权衡因子，加标 decision factor；所有条目默认兼具 retrieval reference。assistive 段位的判定输出强制携带 needs-human-review 标志（axe-core 范式）[B001]。

**第五步·时间戳与分级（定元数据）**。写入 `authority_initial`、`source_version/source_date/review_by`、scope、成熟度（单源未交叉验证一律 draft；≥2 独立来源方可 stable）、supersedes 链。命中前沿清单（AI 交互、WCAG 3.0、厂商新发布设计体系）者打 `frontier` 标记与 6 个月 `expires_at`（Insight 10）[N004]。WCAG 3.0 相关条目无日期戳视为不可信（交叉验证 C3 制度化要求）；覆盖率类数字必须绑定分母（C4 要求）。

### 8.2 域的合并、拆分与演进原则

taxonomy 本身是知识制品，遵循与知识条目相同的生命周期纪律（Insight 7）：其死亡率取决于维护机制而非初始质量。四条演进原则如下。

**拆分信号**：当某域同时满足两个条件时启动拆分评估——（a）域内出现一个内聚子簇，其条目数超过域总量约三分之一，且共享独立的来源群；（b）该子簇的主消费方式与域内其余条目系统性不同（如某域一半条目是 hard rule、另一半全是 retrieval reference）。IAN 域未来若 navigation 实证 corpus 独立壮大，可按此信号重新拆分；当前的合并决定（见 3.5）即由这两个条件的否命题支撑。

**合并信号**：两域条目互引率持续过高（related 链接横跨两域的比例超过任一域条目的半数）、来源群高度重叠、且边界裁定条款频繁被触发，说明边界划错了位置，应合并或重划。合并时旧域代码退役但不复用，存量条目批量迁移并保留 `former_domain` 痕迹。

**正交性守卫**：任何"新域"提案必须证明它无法被表达为现有域与知识类型、消费方式、scope 的组合。按主题表面新设域（如"移动端设计""AI 设计"）一律拒绝——移动端是 scope 值，AI 交互是 frontier 标记，都不是域。这条守卫是 taxonomy 防膨胀的核心机制。

**稳定性守卫**：域代码与条目 ID 一旦发布不可回收；域的语义可以修订（修订记入 taxonomy changelog 并附裁决依据），但修订不得使已发布 ID 的含义发生改变——含义变化通过新条目 + supersedes 链表达。taxonomy 的每次修订本身作为一条 Design Decision Record 归档 [B002][B003]，使分类决策与产品设计决策共享同一套可追溯机制。

---

*本 taxonomy 的 15 域、7 类型、5 消费方式与 ID 方案构成交付物 D7（Rule Schema）与 D9（架构建议）的分类骨架；域边界裁定条款随知识库运行持续增补，增补纪律见第 8.2 节。*
