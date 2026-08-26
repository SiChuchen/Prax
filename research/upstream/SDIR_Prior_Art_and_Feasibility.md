# SDIR 先例研究与可行性判断

- 交付物：D8｜Systemsmith Design Intelligence
- 日期：2026-08-25
- 输入：DIM-07（组件模型与 SDIR 先例）、DIM-08（知识形式化与 LLM 时代变量）、DIM-06（DTCG token 层）、跨维度洞察与交叉验证报告
- 引用约定：方括号内为全局 Source Registry ID；置信度纪律遵循交叉验证报告（High 按事实陈述，Medium 注明单一来源/单一维度综合，Low 与 Conflict Zone 呈现不确定性）
- 核心结论（先给出）：**SDIR 值得做，但它的正确定位是"设计决策的显式记录层 + Agent 推理脚手架"，而不是"全自动 UI 生成中间语言"；其抽象边界的守护原则是——IR 中不允许出现任何无法在非视觉模态下保持意义的陈述。任务书立场"SDIR 不应成为另一种 CSS/JSX"经三重独立证据验证成立（高置信度）。**

---

## 1. 问题定义：SDIR 要解决什么

Systemsmith 面临的基本工程事实是：同一个界面需要在 React/Vue/Compose/Flutter/Qt 等多个技术栈上落地，且同一屏幕在 Desktop 与 Mobile 上呈现为截然不同的物理形态。如果没有一个共享的中间层，设计意图只能以两种形态存在：存在于设计师脑中（不可检索、不可传递、Agent 无法消费），或存在于某一个平台的实现代码中（被渲染细节污染，无法跨平台复用）。SDIR（Systemsmith Design Intermediate Representation，语义化 UI 中间表示）要解决的问题因此可以精确表述为：**把"这个屏幕是什么、为什么这样组织"的设计语义，与"这个屏幕怎么画"的技术实现分离开来**——前者进入 SDIR，跨平台共享；后者由 Platform Adapter 结合平台惯例（platform convention）与技术栈约束决定，不进入共享层。

任务书给出的概念示例（按其字段集重构）说明了这个分离的形态：

```yaml
screen:
  archetype: master_detail_inspector      # 屏幕原型：主从+检查器
  intent: inspect_and_edit_entity         # 设计意图：检查并编辑实体
  density_intent: high                    # 密度意图：专业工具高信息密度
  regions:
    - id: object_tree
      role: primary_navigation            # 区域角色：主导航
      importance: primary                 # 重要性：一级
      visibility: always                  # 可见性条件：常驻
    - id: canvas
      role: primary_work_surface
      importance: primary
      visibility: always
    - id: inspector
      role: contextual_editing            # 上下文编辑区
      importance: supporting              # 重要性：辅助
      visibility: selection_driven        # 可见性条件：由选择驱动
```

这份 YAML 的每一行都对应一个明确的语义层次。`archetype` 是对屏幕整体组织形态的命名（master-detail、dashboard、wizard 等），它是 pattern 级的引用而非结构描述；`intent` 记录该屏幕存在的理由，是后续一切权衡的裁决依据；`regions[].role` 描述每个区域在信息架构中的功能角色（导航/工作面/上下文编辑），而非其视觉位置；`importance` 描述信息优先级——这是排版强调（emphasis）、折叠策略与移动端取舍的共同输入；`visibility` 描述的是可见性的**条件**（由选择驱动、由权限驱动）而非当前状态值；`density_intent` 记录的是"我们意图做多密"的设计承诺，具体密度值由 token 与平台决定。

这份示例的关键不在语法而在**缺席物**：没有像素、没有 flex/grid、没有颜色、没有控件选型。同一份 SDIR，Desktop Adapter 可以把它实现为经典三栏 Workspace（树在左、画布居中、检查器在右常驻），Mobile Adapter 则把 `object_tree` 与 `inspector` 降级为独立路由，把 `inspector` 的 `visibility: selection_driven` 实现为选中实体后弹出的 Bottom Sheet——两种实现在物理形态上毫无相似之处，但都忠实于同一组语义承诺。这个"同一语义、多种忠实实现"的性质，正是 SDIR 与一切渲染描述语言的本质区别，也是后文所有先例分析的检验标准。

需要先澄清一个术语纪律：本文所说的 IR 借用编译器领域"中间表示"一词，但 SDIR 不是编译意义上的 IR——它没有确定性编译目标，其下游（Platform Adapter）包含真实的人或 AI 设计裁量。这一点不是缺陷，而是第 4 节将论证的、由 40 年先例史证出的必然定位。

---

## 2. 先例全景：四条脉络与它们的终局

"用某种形式化描述表达 UI、再从中得到多平台实现"的想法至少有四十年历史，且沿着四条相对独立的脉络演进。逐一审视它们的抽象层级与终局，是判断 SDIR 可行性的唯一诚实方式——因为 SDIR 的每一个设计决策都能在这条墓道与幸存者名单上找到对应的实验数据。

### 2.1 声明式 UI 语言：全部是 Render IR，且全部锁死于单平台时代

XUL（Mozilla，1998 起）是 XML 声明式 UI 标记语言，描述 menus/toolbars/tabs/trees 等 widget 结构，配 CSS 做样式、JavaScript 做行为；其本质是"应用 chrome 的 widget 树描述"，不含任何任务、意图或重要性语义，并随 Mozilla 平台收缩而消亡（Firefox 2017 起移除 XUL 扩展体系）[E026]。XAML（WPF/Silverlight/UWP/WinUI）、MXML（Flex）、QML（Qt）、Android XML layout 与 XUL 同族：声明式描述 widget 树 + 布局属性 + 数据绑定，直接编码渲染细节（Grid.Row、anchors、padding）[E034]。

对这条脉络需要做一个精细的批判性区分：这些语言在其设计目标内是**成功**的——QML 之于 Qt、Android XML 至今是主流开发方式，因为它们从不假装跨平台，只承诺"在本平台内用声明式替代命令式"。它们的失败只发生在被误读为"UI 抽象层"时：de Icaza 2012 年弃 XAML 投 QML 的著名表态，争论焦点是语法人体工学而非语义抽象——即便在平台内部，这类语言的优劣也只是工具之争 [E034]。这条脉络给 SDIR 的教训是双重的：(a) Render 层的 IR 已经彻底 commoditized，每个平台都有成熟解，**任何新系统若在 render 层重做一遍都是零差异化**；(b) 与单一平台运行时绑定的 UI 描述语言没有跨时代生存能力 [E026]——SDIR 若含有任何平台痕迹，就继承了这条死线。

### 2.2 Model-driven UI 学术脉络：SDIR 的直接祖先与它的失败四因

学术界的野心大得多：不只描述 widget，而是从任务与概念出发，经抽象层逐层细化到可运行界面。这条脉络在文献中称 MBUID（Model-Based UI Development），其最有理论影响力的成果是 Cameleon Reference Framework（Calvary、Coutaz、Thevenin 等，2003）：定义四层抽象——Task & Concepts → AUI（Abstract UI，模态无关）→ CUI（Concrete UI，模态相关但平台/语言无关）→ FUI（Final UI，可运行代码）；层间三种变换为 reification（抽象→具体）、abstraction（反向）与 translation（同层跨使用情境平移），使用情境（context of use）= user × platform × environment 三元组。其中 AUI 的定义——"expresses any CUI independently of any interaction modality (e.g., graphical, vocal, tactile)"——正是 SDIR"不描述渲染细节、由 Adapter 解释"的 2003 年版本 [A059]。

围绕 Cameleon 产生了完整的语言与工具生态，其中三个与 SDIR 关系最直接。**UIML**（Virginia Tech/Harmonia，1997 起）把 UI 分解为 structure/style/content/behavior 四部分，由平台特定 renderer 映射到 Java/HTML/WML/VoiceXML；2002 年 OASIS 成立 UIML TC，目标是做"比一切具体语言更高抽象层的 canonical XML 表示"，最终止于 UIML 4.0 Committee Draft，TC 关闭，工业采用可忽略 [A049][N037][N036]。UIML 的 content 分离思想（文案不进描述）值得 SDIR 继承，但 W3C 的评估指出它"only partially compliant with the Cameleon Reference Framework (e.g., it does not have any task or context model)"——它的"抽象"止步于词汇抽象（generic button），没有 intent/importance 层 [N024]。**UsiXML**（Vanderdonckt 等）是覆盖 Cameleon 四层的完整 XML UIDL + 模型转换体系，W3C MBUI XG 的评价是"用图变换做模型转换，科学上严谨但带来性能问题……只覆盖 context-aware 适配的基本方面"，同样止步于学术界 [N024]。**MARIA**（Paternò、Santoro、Spano，ACM TOCHI 2009 + 2012 W3C Member Submission）是这条脉络中最成熟的 AUI 词汇表：把抽象交互器按语义功能分类（edit / selection / output / control / grouping），其 AUI→CUI 细化表把抽象元素映射到具体控件——"A SingleChoice can be implemented as a radio_button, list_box, drop_down_list or image_map" [A062]。这张"语义→控件"细化表就是 Platform Adapter 决策表的学术原型；MARIA 的自我定位——"让设计者 focus on the semantics of the interaction, namely what the intended goal of the interaction is"——与 SDIR 的问题陈述几乎逐字重合 [A062]。状态：配套工具 MARIAE 2011 年后基本停滞，作者本人承认 adoption limited [A008]。

任务模型一侧，ConcurTaskTrees（Paternò，1999 起；2014 年成为 W3C Note）[N047] 以层级分解+时序算子描述任务；TERESA（Mori、Paternò、Santoro，IUI'03）把 CTT 任务模型经 Enabled Task Sets 半自动变换到 AUI 与各平台 CUI。TERESA 的 AUI 组合算子按**沟通目标**分类：Grouping（逻辑关联）、Relation（一对多影响）、Ordering（顺序）、Hierarchy（重要性层级——"different levels of importance can be defined among a set of elements"）[A057][A009]。这个 Hierarchy 算子是学术史上与 SDIR 的 importance 语义最接近的正式机制——可以说 SDIR 的 importance 字段不是发明，而是把一个 2003 年就被形式化、但从未被工业化的概念接上新的消费者。此外，IFML（Interaction Flow Modeling Language）是唯一成为工业标准的抽象 UI 建模语言（OMG 2013-03 采纳），配套工具 WebRatio 有真实企业案例；但它建模的是交互流与内容绑定，不含视觉/区域重要性语义，且采用面局限于模型驱动企业开发 niche [N046][B018]。W3C 自身在 2005–2014 年间先后设 MBUI Incubator Group 与 XG，产出两份 Note 后标准化活动中止 [N022][N024]——直到 2025-08 才有新的 UI Specification Schema CG 重新提出"implementation-agnostic 的 UI meta-model"，且明确要对齐 Open UI 与 DTCG 词汇；该组极早期，仅作方向性证据 [N035]。

这条脉络为何整体未主流化？该领域的权威自我诊断来自 Szekely（HUMANOID/MASTERMIND 作者）1996 年在 CADUI 的回顾，以及 Myers/Hudson/Pausch 2000 年提出的 threshold（上手成本）/ceiling（表达能力上限）框架——失败的工具要么 threshold 太高，要么 ceiling 太低 [A030][A048]。基于 dim07 的证据链（交叉验证列为 M8：多源学术证据但属单一维度综合，置信度 Medium-High），失败可归为四因：**(1) 抽象泄漏**——CUI→FUI 一步总要暴露平台细节，MARIA 细化表与 TERESA 平台参数都靠人工选择，"全自动"承诺在真实项目上必破；**(2) 工具链成本**——UsiXML 图变换"严谨但性能有问题"，每个系统都要求设计者先学一套建模语言，threshold 过高 [N024]；**(3) 生成 UI 天花板**——reification 本质是设计决策（SingleChoice 实现为 radio 还是 dropdown 取决于空间、平台惯例、品牌），学术系统用启发式硬编码这些决策，产出"通用但平庸"的 UI，设计师拒绝接受，即 Myers 框架的 ceiling 问题 [A048]；**(4) 意图无法完全形式化与错的成功标准**——MBUID 以"自动生成多少代码"为指标，而工业界真正买单的是跨平台一致性与维护成本。这四因将在第 4 节逐一做 2026 年再评估。

### 2.3 Design-to-code 工业实践：中间表示是视觉树，缺意图层是输出不稳的根因

工业界走了另一条路：不从模型生成 UI，而是从视觉产物反向生成代码。pix2code（Beltramelli 2017，被引 530+）用 CNN+LSTM 从 GUI 截图生成自定义 DSL 再编译到 iOS/Android/Web，token 级准确率 >77%——其中间表示仍是 widget 级 Render IR，作者明确声明"not, in any way, intended, nor able to generate code in a real-world context" [A011]。后继工作（Sketch2Code、imgcook、CodeFun、UI2Code/PSD2Code 等）沿用同一"检测→层级重建→代码生成"范式 [A012]。

对 Locofy、Anima、Builder.io 等商用工具的独立评估（LUT 大学 2024）发现了两个系统性短板：所有受测工具都无法生成响应式适配不同屏宽的代码；均难以识别交互元素的意图——"identify design elements and understand their intended purpose"被点名为核心瓶颈 [A061]。换言之，**像素→代码管线缺的恰好是意图/语义层**：工具能还原视觉，不能还原"这是什么、为什么在这、何时出现"。Figma 生态对此有清醒的定位自觉：Dev Mode 的通行定位是"translation layer that helps developers read your blueprints more accurately"而非代码生成器，业界经验法则是首次导出后仍需 20–40% 手工修正，且"Messy Figma Files Produce Messy Code"——无语义命名的设计稿必然产生无语义代码（行业评测，单一来源，置信度 Medium）[C013]。这 20–40% 的手工修正率，正是"设计裁量点"在工业流水线上的实测体量。

### 2.4 LLM 时代 UI 生成：无显式 IR，意图直接坍缩为代码

v0、screenshot-to-code 等 LLM 生成系统把第三条路推到极端：中间没有任何显式表示，自然语言意图直接坍缩为代码。v0 的路线是"栈内约束"——模型针对 React+Tailwind+shadcn/ui 微调，用训练分布内的默认美学代替显式语义层（二手来源，置信度 Medium）[E008]。其代价已有实证：HCI 研究（CHI 体系 2025）发现 v0 类输出对设计师不可编辑（"the real work begins with the day of editing"），缺意图澄清导致 v0 平均需 6.1 轮修改仍不满意，而带意图澄清的对照系统只需 2.6 轮 [A027]；学术基准 Design2Code（484 真实网页）同样显示最强模型的细粒度短板是"回忆输入中的视觉元素"与"生成正确布局" [A047]。更说明问题的是稳定性：2025 年 v0 官方社区大量用户报告 UI 生成质量"一夜之间显著下降"——无中间语义表示的端到端生成，质量随模型版本漂移，没有任何稳定层可锚定（社区舆情，样本有偏，置信度 Low，但方向与学术研究一致）[C032]。

这条脉络对 SDIR 的意义是反向的：它用缺席证明了语义层的价值。LLM 生成不稳定的根因不是没有能力，而是**意图在生成瞬间被消费掉、不留下任何可检查、可复用、可回归的中间制品**。SDIR 的机会窗口正在于此。

### 2.5 先例对比总表

| 系统/脉络 | 年代 | 抽象层 | 是否语义化 | 终局状态 | 对 SDIR 的核心教训 |
|---|---|---|---|---|---|
| XUL / XAML / MXML / QML / Android XML | 1998–2010s | Render（widget 树+布局+样式） | 否 | 单平台内成功；跨平台无外溢 [E026][E034] | Render 层已 commoditized，无差异化空间 |
| UIML（OASIS TC） | 1997–2009 | Concrete（词汇抽象） | 半（无 task/context 模型） | TC 关闭，未完成标准 [N036][N037] | content 分离可借鉴；词汇抽象不等于语义抽象 [N024] |
| Cameleon Reference Framework | 2003 | 四层：Task→AUI→CUI→FUI | 是（AUI 模态无关） | 理论框架长存，工具链消亡 [A059] | SDIR 对标 AUI 层；translation 与 reification 分开设计 |
| UsiXML | 2000s | 覆盖 Cameleon 四层 | 是 | 学术停滞 [N024] | 图变换工具链成本是致死量 |
| MARIA | 2009–2012 | AUI 交互器分类 + 细化表 | 是 | 2011 后停滞，作者自认采用有限 [A062][A008] | 语义→控件细化表 = Platform Adapter 原型 |
| CTT / TERESA | 1999–2004 | Task→AUI 组合算子 | 是（Grouping/Relation/Ordering/Hierarchy） | 学术停滞 [A057] | Hierarchy 算子 = importance 语义的学术祖先 [A009] |
| IFML / WebRatio | 2013（OMG） | 交互流（platform-independent） | 半（无重要性/视觉语义） | 工业标准，niche 存活 [N046][B018] | 抽象 UI 建模可标准化，但采用面取决于生态 |
| APG / Open UI / Zag.js（行为契约层） | 2019–2026 | 组件行为契约 | 是（行为语义，不含布局） | 工业化成功：APG 31 patterns、Open UI 逐控件推进、Zag 50+ 状态机 [N001][N042][C061] | 范围克制（只定行为不定布局）者生存 |
| pix2code → Locofy/Anima/Builder.io | 2017–2026 | 视觉树（Render） | 否 | 商用存活但 20–40% 手工修正 [A011][C013] | 缺意图层是输出质量瓶颈 [A061] |
| v0 / LLM 端到端生成 | 2023–2026 | 无显式 IR | 否（意图坍缩为代码） | 质量随模型漂移 [A027][C032] | 语义中间层的缺席正是 SDIR 的机会窗口 |

读这张表可以得到一个不受单一来源支配的结构性结论：**抽象层级与生存率之间不是单调关系，而是"克制者生存"**——Render 层克制于单平台者活（QML、Android XML），行为契约层克制于行为者活（APG、Zag），交互流克制于企业 niche 者活（IFML）；而死去的（UIML、UsiXML、MARIA、TERESA）无一例外承诺了"一次建模、自动生成任意平台完整 UI"。这个模式本身就是对 SDIR 定位最强的先验约束。

---

## 3. Semantic IR 与 Render IR 的区分判据

先例全景表明，几乎所有失败系统都死于同一类病变：语义层与渲染层混装，复杂度互相感染。因此 SDIR 的第一设计物不是词汇表，而是**边界判据**——一个可机械执行、可用来裁决"这条陈述该不该进 IR"的测试。

### 3.1 边界守护原则

本文采用并正式表述如下原则（其思想源头是 Cameleon 对 AUI 的原始定义"模态无关" [A059]，dim07 将其操作化为判定测试）：

> **边界守护原则（Boundary Guard Principle）：SDIR 中不允许出现任何无法在非视觉模态下保持意义的陈述。**

检验方法是思想实验：把该陈述交给一个语音界面、一个无障碍树（accessibility tree）或一个纯文本摘要器，问它是否仍然传递设计意图。`importance: supporting` 在语音模态下依然有意义——朗读顺序与详略程度应由它决定，因此它属于 Semantic 层；`padding: 16` 在语音模态下毫无意义——它只是图形渲染的一个参数，因此它属于 Render 层。这个测试有一个等价但更易用的删除形式：**把该陈述从 IR 中删掉，UI 的设计意图是否受损？** 删掉"该区域是 supporting、由选择驱动可见"，Adapter 将无法在移动端做出"降级为 Bottom Sheet"的决策——意图丢失，属 Semantic；删掉 `display: flex`，意图可由语义重新导出，属 Render。

需要显式说明这个原则与 Cameleon AUI 原始定义的区别：AUI 的模态无关性只要求"不绑定图形模态"，而边界守护原则额外要求**陈述本身承载设计意图**——这是把 dim07 的删除测试与模态测试合并后的加强版。它同时也是一个治理工具：任何字段提案，只要提不出一个非视觉模态下的消费场景，就一票否决。

### 3.2 归类演示

下表用十四个候选陈述演示判据的执行，覆盖任务书与 dim07 讨论过的全部争议字段：

| 候选陈述 | 非视觉模态下是否有意义 | 归类 | 说明 |
|---|---|---|---|
| `role: primary_navigation` | 有（语音导航的入口排序） | Semantic | 区域角色是信息架构陈述 |
| `importance: supporting` | 有（朗读详略、折叠策略） | Semantic | 对应 TERESA Hierarchy 算子 [A009] |
| `visibility: selection_driven` | 有（何时提供该功能） | Semantic | 记录条件而非状态值 |
| `spatial_priority: before canvas` | 有（朗读/焦点顺序） | Semantic | 注意是顺序承诺，不是坐标 |
| `density_intent: high` | 有（信息量的设计承诺） | Semantic | 具体密度值由 token 决定 |
| `interaction: single_select` | 有（语音下单选同样成立） | Semantic | MARIA 交互器分类的继承 [A062] |
| `pattern_ref: master_detail` | 有（组织形态命名） | Semantic | 引用而非内嵌 pattern 定义 |
| `a11y_contract: apg/treeview` | 有（无障碍树直接消费） | Semantic | 引用 APG pattern [N001] |
| `width: 320px` | 无 | Render | 像素属 Adapter 输出 |
| `padding: 16` | 无 | Render | 间距值应以 token 引用，且不进 IR |
| `display: flex / grid` | 无 | Render | 布局算法是 Adapter 的选型决策 |
| `color: #1F6FEB` | 无 | Render | 色值；语义色角色经 token 间接引用 [N032] |
| `control: dropdown` | 无 | Render | 控件选型是 Adapter 裁量（SingleChoice→radio 还是 dropdown）[A062] |
| `font-size: 13px` | 无 | Render | 排版细节；emphasis 语义可由 importance 导出 |

两个边界案例值得单独说明。**`spatial_priority`** 是最容易被误杀的字段："A 在 B 之前"听起来像布局，但它的语义内核是顺序承诺（视觉上的先看到、语音上的先朗读、键盘上的先聚焦），只要不写成坐标或容器嵌套，它就是合法的 Semantic 陈述——这正是 Cameleon 区分 translation（同层跨平台平移）与 reification（向具体层细化）时保留下来的东西 [A059]。**`control: dropdown`** 则是最容易被误放的字段：它貌似"语义"（dropdown 是一个词而非像素），但 MARIA 细化表早已证明同一语义（SingleChoice）在不同平台、不同空间预算下的正确控件不同 [A062]——控件选型是 reification 决策，IR 只给语义类型加约束（如 `options_count_expected: small`）。

### 3.3 "SDIR 不应成为另一种 CSS/JSX"的验证

任务书立场经本文审视后判定**成立（高置信度）**，理由是三重相互独立的证据：

其一，历史证据。所有编码渲染细节的 UI 描述语言都锁死在单平台时代（XUL 随 Firefox 体系收缩消亡 [E026]）；所有试图在一个表示内同时装下语义与渲染的系统都死于复杂度过载（UsiXML 图变换的性能与工具链问题 [N024]）。SDIR 若退化为"带语义注释的 JSX"，等于同时继承两条死线。

其二，2026 年的工业现实已经用分层投票：DTCG tokens（2025.10 首个 stable，24+ 组织支持）管视觉值 [N062][N032]；APG/headless/Zag 管行为契约 [N001][C061]；各框架管渲染。工业界已经占满了 Render 层与行为层，剩下的独占空档恰恰是意图/角色/重要性/可见性这一关系层——dim07 对组件契约要素的盘点显示，该行的"现有形式化载体"为空白 [C061][N060]，而跨维度洞察（Insight 4）确认四个研究维度独立指认了同一空白。SDIR 若重复任何已被占满的层，产出的是负价值。

其三，机制证据。LLM 生成不稳的根因被多项独立研究定位为缺意图/语义中间层 [A061][A027]，而"全塞 context"失败（Lost-in-the-Middle 的 U 形注意力曲线 [A026]）表明 Agent 需要的是结构化、可检索的语义锚点而非又一份代码。一种新语法若只是代码的另一种写法，对 Agent 的消费模式没有任何增量。

还要指出一个语言层面的防御细节：CSS/JSX 的语法引力极强，一旦允许"在 IR 里临时加一个布局 hint"，用户压力会持续把 IR 推向渲染层（dim07 称之为"抽象泄漏诱惑"）。边界守护原则的价值就在于把这类争议从品味之争变成可裁决的合规测试：加这个字段，它在语音模态下还有意义吗？没有，则拒绝。

---

## 4. 失败四因与 LLM 时代再评估

第 2.2 节的失败四因是 1996–2012 年语境下的诊断。SDIR 的可行性判断不能停留在"祖先失败了"，必须逐一追问：每个死因在 2026 年是否仍然成立？以下再评估综合了 dim07 的先例证据与 dim08 的 LLM 时代变量（跨维度洞察 Insight 3 将此概括为"三补一不补"）。

### 4.1 抽象泄漏：仍在，但可以从"病变"降级为"裁量点"

抽象泄漏——从语义到实现的一步总要暴露平台细节——是物理性的，不会因工具进步消失：同一 `visibility: selection_driven` 在 Desktop 是右栏显隐、在 Mobile 是 Bottom Sheet，这个映射里含有真实的平台惯例知识。但 2026 年有两个缓解机制。其一，平台惯例知识本身已被部分形式化：平台设计系统（HIG/Material/Fluent）的存在使 Adapter 的决策有据可依，而非每次从零裁量；窗口尺寸类别、单手可达性等约束已有平台级规范表述。其二，更根本的姿态转变是**把泄漏点显式建模为裁量点（decision point）**：SDIR 不承诺语义到布局的确定性映射，而是在 Adapter 接口处声明"此处需要设计裁量"，并附带影响因子（空间预算、平台惯例、密度意图）与默认启发式。Figma-to-code 工具 20–40% 的实测手工修正率 [C013] 给出了裁量点的体量参照——这个比例的工作不应被假装自动化掉，而应被显式分配给人或 AI。这是从 MBUID 的"否认裁量"到 SDIR 的"治理裁量"的转变。

### 4.2 工具链成本：LLM 使建模成本坍塌，且方向反转

UsiXML 时代的成本结构是：人学习建模语言 → 人手工维护模型 → 模型的唯一消费者是代码生成器。三个环节全是成本，收益只在最后一环 [N024][A048]。2026 年这个结构被反转：LLM 可以直接读写结构化语义模型，建模从"人写模型"变为"Agent 生成 SDIR 草稿 + 人审"；同时模型的消费者从单一代码生成器变成了推理 Agent——Agent 不需要模型"可编译"，只需要模型"可读、可检索、可引用"。知识消费的工业形态也已收敛为"渐进披露 + 结构化检索 + 引用随行"（Anthropic Agent Skills 三层披露，2025-12 成为开放标准）[B006]，意味着 SDIR 文档可以按"元信息常驻 → 区域语义按需加载 → 契约细节按需展开"的方式被 Agent 低成本消费。Myers 框架的 threshold 一翼由此大幅压低。需要诚实标注的是：这一缓解是机制推断加早期工业证据（dim08 三源互证但属单一维度，交叉验证 M9/M10，置信度 Medium-High），尚无"Agent 维护语义模型五年不衰减"的长期数据。

### 4.3 生成 UI 天花板：放弃全自动承诺，ceiling 问题转化为接口设计

Myers 的 ceiling 问题——生成的 UI 不够好、设计师拒绝接受 [A048]——其根源是学术系统把 reification 当作可以启发式硬编码的确定性变换。SDIR 的应对不是更好的启发式，而是**架构上放弃"自动生成成品 UI"的承诺**：Adapter 的输出定位是"忠实于语义承诺的候选实现"，其视觉品质由设计系统组件、tokens 与（可选的）AI/人裁量共同保证。这个姿态在 2026 年有现成榜样：headless 生态用"行为复用"而非"代码生成"解决了跨平台一致性问题并获得主流采用——"the behavior is the hard part. Styling? Yours." [C058]；Zag.js 的 machine/connect 两段式（一次定义行为逻辑，经 adapter 投影到各框架）证明"核心语义一次定义、表现层多端适配"是工程上已验证的模式 [C061][C027]。SDIR 之于屏幕语义，正如 Zag 之于组件行为——但 SDIR 必须比 Zag 更谦逊：Zag 的状态机是可执行的，SDIR 的语义承诺是供推理与检查的，不承诺执行完备性。

### 4.4 意图形式化：部分可形式化，边界已被量化

第四因"设计意图无法完全形式化"需要拆成两半。可形式化的一半：intent（受控词汇 + 自然语言陈述）、importance/priority（TERESA Hierarchy 算子证明其可作为一等形式对象 [A009]）、visibility 条件、region role、交互语义类型（MARIA 分类 [A062]）——这些已经在学术先例中被形式化过，缺的只是工业化载体。不可形式化的一半：审美判断、品牌气质、微妙的空间节奏——这类判断的自动化边界已被量化研究标出：LLM 对 UI mockup 的评审在识别"差设计"时可用，但随设计迭代改进而退化，不适合作终裁 [A004]；截图级评审"产出流畅但证据薄弱的批评"，可靠评审需要交互式取证 [C005]；LLM-as-judge 存在系统性 position/verbosity/self-preference 偏差 [A028]。结论是：SDIR 只承载意图中**可陈述、可检查**的部分，审美裁量留在 Adapter 与人审环节——这与跨维度洞察 Insight 5 的"自动化地板/中间带/天花板"三段式一致。

### 4.5 reification 不可判定性：不变量，必须接纳而非对抗

四个死因中唯一纹丝不动的是 reification 的不可判定性：语义到布局的映射含有真实设计裁量，LLM 只是把这个裁量从人转移给 Agent，并未消除其不可判定性（Insight 3）。这导向 SDIR 架构的一条硬约束：**Adapter 必须保留裁量点，且裁量点是显式的一等公民**——每个裁量点记录影响因子、默认启发式与"何时升级人工"。这不是对自动化的妥协，而是与 axe-core"不确定项转人工复核"相同的置信度处理范式在生成侧的投影 [B001]。任何承诺"SDIR 确定性编译为多平台 UI"的版本都将重蹈 MBUID 覆辙，这句话应写入项目宪法。

### 4.6 最大风险

综合先例与再评估，SDIR 面临的最大风险按严重度排序为：

**风险一：语义词汇表膨胀。** importance 与 role 的取值集合没有自然边界——每个项目都会想加新取值，而无 APG 那样的权威机构收敛（MARIA 的交互器分类至少是单一研究团队的产物 [A062]）。治理方案：(a) 词汇表分核心集（项目级冻结、修改需设计治理流程）与扩展集（团队级注册、带 owner 与审查日期）；(b) 借用组件成熟度模型管理词条生命周期（draft → reviewed → stable → deprecated），知识制品的死亡率与维护机制强相关而非与初始质量强相关（Insight 7）；(c) 每个新词条必须通过边界守护原则的非视觉模态测试才能入核心集。

**风险二：SDIR 沦为"又一种配置格式"。** 若 SDIR 字段在实践中被当作布局参数的另一种写法（`importance: primary` 被读成"放左边并加宽"），它就退化为 JSX 的方言，全部历史教训同时生效。防御机制即第 3 节的两件套：边界守护原则作为字段准入测试，非视觉模态测试作为 CI 式合规检查——把 SDIR 文档翻译成语音摘要或无障碍树，人（或 Agent）读后应能复述该屏幕的设计意图；复述不出，说明 IR 里混入了渲染陈述或语义陈述不足。

**风险三：无验证机制导致的质量不可证伪。** Cameleon 之死的部分原因是无法证明生成 UI 的质量；SDIR 需要配套评估方法——跨平台语义保真度检查（两个 Adapter 的输出是否满足同一组语义承诺）与裁量点审计。LLM-as-judge 可作初筛不可作终裁的量化证据 [A028][A004][C005] 提示：语义保真度检查应优先做成确定性规则（"importance: primary 的区域在移动端不得默认折叠"是可机械检查的），把 LLM 评审限制在 assistive 角色。

---

## 5. 可行性结论

### 5.1 SDIR 是否值得做

**值得做，但必须按正确定位做。** 支持的证据链：(1) 需求侧，LLM 生成不稳、design-to-code 质量瓶颈的根因被多项独立研究定位为缺意图/语义中间层 [A061][A027][A047]——语义层是被缺席证明的；(2) 供给侧，意图/角色/重要性/可见性这一关系层在现有全部工业制品（tokens、组件库、headless 行为契约、pattern 库）中没有载体，且四个研究维度独立指认同一空白（Insight 4）——这是差异化定位而非重复建设；(3) 时机侧，MBUID 四大死因中三个被 LLM 时代的结构性变量缓解（第 4 节），剩下的 reification 不可判定性可由"裁量点显式建模"接纳；(4) 生态侧，2025-08 成立的 W3C UI Specification Schema CG 表明"implementation-agnostic 的 UI 规格 schema"正在重新成为标准化方向，SDIR 不孤立 [N035]；且截至 2026-08 没有任何主流产品实现"证据分级 + 冲突裁决 + 可验证语义 IR"的完整形态（Insight 10），Figma 的自动化 rules file 是最接近的实践但无 authority 分级与冲突解析 [C011]——这是窗口期。

**定位声明（建议写入项目宪法）：SDIR 是设计决策的显式记录层与 Agent 推理脚手架，不是全自动 UI 生成中间语言。** 它类比的对象不是编译器 IR，而是 ADR（Architecture Decision Record）之于架构决策——用结构化格式把"为什么"变成可检索、可引用、可回归检查的工程制品 [B003][B002]。它向 Agent 提供的是推理的锚点与约束，向 Adapter 提供的是语义承诺与裁量点清单。其价值度量不是"自动生成了多少代码"（MBUID 的错误指标），而是：设计意图在跨平台实现中的保真度、Agent 输出的可解释性与可回归性、设计决策的检索与审计成本。

### 5.2 最小词汇表 v0

基于第 3 节判据与先例中已验证的形式化成果，推荐 SDIR v0 只包含以下字段，其余一律推迟到有真实消费需求再进：

```yaml
screen:
  archetype: <受控词汇>        # 屏幕原型，引用 Pattern Library
  intent: <自然语言 + 受控动词>  # 设计意图陈述
  density_intent: high | medium | low
  regions:
    - id: <标识>
      role: primary_navigation | primary_work_surface
          | contextual_editing | supporting_info | global_chrome
      importance: primary | supporting | tertiary   # 对应 TERESA Hierarchy [A009]
      visibility: always | selection_driven
                | permission_driven | context_driven
      interaction: <MARIA 式语义类型：selection | edit | output | control>  # [A062]
  pattern_ref: <Pattern Library 条目 ID>          # 上游引用，不内嵌
  component_contract_ref: <语义组件契约 ID>        # 行为/状态/a11y 契约引用 [N001]
```

设计上三个刻意克制：(a) 词汇表每个字段都能指出先例祖先（archetype/pattern_ref → pattern 文献与 IFML 的容器语义；importance → TERESA；interaction → MARIA；visibility → Cameleon context of use [A059]），没有生造概念；(b) 行为契约不内嵌，引用 APG/Zag 已工业化的成果 [N001][C061]，避免重建已解决的层；(c) 视觉值一律不出现，需要时引用 DTCG token（2025.10 stable [N032]）——DTCG 自我定位为"交换格式而非架构格式"[N029]，恰好与 SDIR 互补：token 管值，SDIR 管意图。

**绝不进入 IR 的清单**（每条附先例依据）：像素/几何/坐标（Render 层已 commoditized）；布局算法与容器类型（flex/grid/stack 是 Adapter 输出）；样式值（颜色、字号、间距——用 token 引用）；控件选型（radio vs dropdown 是 Adapter 裁量，MARIA 细化表已证 [A062]）；具体文案内容（UIML content 分离原则 [A049]）；框架/平台特定 API 痕迹（XUL 死线 [E026]）；动画参数（可给"需要过渡反馈"的语义标记，不给 duration/easing）；当前状态值（IR 记条件不记状态）。

### 5.3 接口边界

SDIR 在 Systemsmith 架构中的位置与接口（文字描述）：

**上游**：Pattern Library 与语义组件契约（Semantic Component Contract）。SDIR 通过 `pattern_ref` 引用组织形态的权威定义，通过 `component_contract_ref` 引用组件级行为/状态/可达性契约——上游回答"这个模式/组件一般怎样"，SDIR 回答"这个屏幕具体承诺什么"。知识底座（规则库、证据分级、冲突裁决记录）为 SDIR 的编写与审查提供依据；冲突裁决沉淀为 Design Decision Record 回流入库（ADR 机制 [B003]）。

**下游**：Platform Adapter（React/Vue/Compose/Flutter/Qt 各一）。输入为 SDIR + 平台惯例知识 + context of use（user × platform × environment [A059]）；输出为具体布局与控件选型（CUI 级方案），再经框架渲染为 FUI。Adapter 内部含显式裁量点：每个裁量点带影响因子、默认启发式与升级人工的条件。视觉值经 DTCG tokens 供给 [N032]，Adapter 只做 token 引用不做值硬编码。跨平台转换（Desktop→Mobile）属 translation，语义→布局属 reification，两者决策性质不同、在 Adapter 接口上分开 [A059]。

**横切**：验证层。确定性检查（语义承诺的机械可验子集，如"primary 区域移动端不默认折叠"）→ assistive 检查（LLM 评审，带置信度与人工复核标记，axe-core 范式 [B001]）→ empirical 验证（可用性测试/Golden Screens 回归）。三类检查的划分与跨维度洞察 Insight 5 的自动化三段式一致。

### 5.4 验证路径：先试点，后工具链

MBUID 史反复证明的死亡路径是"先建完整建模工具链、再找真实用户"（UsiXML 的工具先行 [N024]）。SDIR 应采取相反顺序：

第一阶段（可行性试点）：选 2–3 个真实 Systemsmith 页面（建议一个 master-detail 工作区、一个高密度数据页），由人手工编写 SDIR，再由 Platform Adapter（初期就是"资深前端 + Agent 辅助"的人机组合）各自实现 Desktop 与 Mobile 版本。通过标准三条：(a) 两个实现在形态上不同但语义承诺全部可追溯回 SDIR 字段；(b) 非视觉模态测试——把 SDIR 翻成语音摘要，读者能复述设计意图；(c) SDIR 编写成本可接受（参照系：不超过同等设计文档的编写时间）。

第二阶段（词汇表收敛）：用试点中实际被使用、被争执、被提议的字段迭代词汇表，建立核心集/扩展集治理与词条生命周期。第三阶段（Agent 消费试点）：让 Agent 从需求生成 SDIR 草稿、人审，测量修改轮次（参照系：PrototypeFlow 的意图澄清把 6.1 轮降到 2.6 轮 [A027]），并检验 Agent 引用 SDIR 字段做设计解释的忠实度——引用不等于忠实，需逐条核验（dim08 A6 的 provenance 纪律）。完整工具链（编辑器、CI 检查、多 Adapter）只在三阶段之后立项。

---

## 6. 开放问题

以下问题本文无法回答，如实列出并标注性质：

**(1) 语义词汇表的完备性无法证明。** role/importance 的取值集"够用"判据只能是经验的（覆盖试点页面）而非演绎的。MARIA 的交互器分类有学术团队背书 [A062]，但 region role 层面不存在同等权威——核心集会经历一段治理摩擦期，且无法预知收敛点。性质：不可判定，只能治理。

**(2) 跨平台一致性与平台惯性的张力。** "忠实于同一 SDIR"与"忠实于各平台惯例"会真实冲突：HIG、Material、Fluent 对同一语义的惯例实现不同，Adapter 服从平台惯例越多，跨平台语义一致性越弱。先例对此无解——IFML 选择平台无关、牺牲地道感 [N046]；原生开发选择地道、放弃共享。SDIR 只能把这条张力显式化为裁量点，无法消除它。性质：价值权衡，需场景化裁决（lex specialis 式，参见 dim08）。

**(3) SDIR 自身的版本演进与存量迁移。** 词汇表演进后，存量 SDIR 文档如何迁移？设计系统的经验（组件成熟度 + semver + codemod，Insight 7）可借用，但语义层迁移比组件迁移更难验证——"新 role 取值是否改变了旧文档的语义"没有机械检查。WCAG 3.0 草案描述在二手网络大面积失真（交叉验证 C3）警示：任何无版本锚点的语义描述保质期以月计，SDIR 文档必须强制携带词汇表版本戳。性质：工程问题，有先例机制但无验证方法。

**(4) Agent 生成 SDIR 的质量评估方法缺失。** 判断"这份 SDIR 是否忠实表达了设计意图"目前只有人审一途；LLM-as-judge 的已知偏差 [A028]、UI 评审的迭代退化 [A004] 与截图评审的证据薄弱 [C005] 表明自动评审不能作终裁。语义保真度的可机械化子集（承诺级检查）有多大，需要试点实测。性质：方法空白，是本知识底座后续研究的最优先方向。

**(5) 治理权威的来源。** APG 有 W3C、DTCG 有 24+ 组织联盟 [N062]，SDIR 词汇表初期只有项目自身权威。W3C UI Specification Schema CG [N035] 的未来产出可能提供对齐锚点，但该组极早期、方向与成熟度均不确定。性质：外部依赖，监控即可，不可依赖。

---

*本文先例与置信度判断可回溯至 DIM-07/DIM-08 研究简报、交叉验证报告（M8、L7、C 区条目）与全局 Source Registry。结论一句话：做，但按"语义承诺层 + 裁量点显式化"做；边界守护原则是它区别于历代失败者的唯一结构性保证。*
