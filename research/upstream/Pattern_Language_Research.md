# Pattern Language Research：Systemsmith Pattern Library 的方法论与治理方案

本文回答一个建设性问题：Systemsmith 如何建立一套不会重蹈历史覆辙的 Pattern Library。结论先行：HCI 领域的独立模式库（pattern library）在 2010 年代中期已被证明是不可持续的形态——Yahoo Pattern Library、welie.com、Quince 相继死亡，死亡原因不是模式质量而是结构性缺陷（无维护机制、与组件库功能重叠、无组合语法、无证据标注）[A063][B040]。2026 年存活的形态是企业设计系统的 Patterns 层与新兴的 AI 交互模式类目 [C055][E009]。Systemsmith 的机会在于第三条路：模式库的消费者不是设计师而是 AI Design Agent——这第一次给了模式库一个持续、高频、不会转移兴趣的消费者。本文第 1 章解剖谱系与死因，第 2 章比较工业界现存 Patterns 层，第 3–6 章给出 Systemsmith 的条目 Schema、分类体系、治理机制与首批建设清单。

## 1. Pattern Language 方法论谱系

### 1.1 Alexander 的原始概念（1977）

模式语言的全部正统结构来自 Christopher Alexander 等人的《A Pattern Language》（1977），该书收录 253 个城镇与建筑模式 [N055]。其定义至今仍是最好的定义："Each pattern describes a problem which occurs over and over again in our environment, and then describes the core of the solution to that problem, in such a way that you can use this solution a million times over, without ever doing it the same way twice" [N055]。三个要点构成本文后续全部设计的判据。其一，模式的条目结构是四元组：problem（反复出现的问题）、context（问题出现的场景）、forces（塑造问题的相互冲突的力量）、solution（平衡这些力量的解法核心）——其中 forces 是精髓，它使模式区别于"最佳实践清单"：模式不声称唯一正确解，而是显式记录权衡 [N055][E037]。其二，模式不是组件，是"反复出现的问题的解"——同一模式每次实现形态不同，这与"可复用的代码零件"在概念上互斥。其三，Alexander 的超越三元组之处在于 pattern language：模式之间存在组合关系网络，大模式由小模式构成，模式不是孤立条目而是图 [N055]。这三点将被证明恰好是后世模式库逐一丢失、并因此死亡的三样东西。

### 1.2 软件化与 HCI 化的传播链

传播时间线有清晰的可验证里程碑 [E037]：1987 年 Kent Beck 与 Ward Cunningham 在 OOPSLA 用 Smalltalk 首次将模式引入软件；1993 年 Hillside Group 组织首届 PLoP（Pattern Languages of Programs）会议；1994 年 GoF《Design Patterns》出版，确立了模式在软件工程中的经典形态——值得注意，GoF 条目保留了 intent/motivation/applicability/consequences 字段，即 forces 与 tradeoffs 的软件化表达，其知识密度远高于后来多数 UI 模式库。HCI 一侧，1997–1999 年 Jenifer Tidwell 的 Common Ground 是第一个成规模的交互模式集，同期 CHI'97 workshop"Towards a pattern language for interaction design"（Bayle、Bellamy、Casaday、Erickson 等）标志模式正式进入 HCI 议程；2000 年 Thomas Erickson 的"Lingua Francas for Design"（DIS'00）把模式语言定位为设计共同语言；2001 年 Borchers《A Pattern Approach to Interaction Design》、2002 年 van Duyne/Landay/Hong《The Design of Sites》、2003 年 van Welie 的 INTERACT 论文相继跟进 [E037][B016]。2005 年 Tidwell《Designing Interfaces》第 1 版把这一脉络沉淀为教科书，2020 年第 3 版（与 Brewer、Valencia 合著，592 页）至今仍是 HCI 模式库的活经典 [A019]。

这条谱系对 Systemsmith 有两条直接的批判性含义。第一，同名异物问题已被权威综述确认：不同模式库对同一模式使用不同名称、或对同一名称赋予不同含义，模式命名从未有过标准本体 [B016]——这意味着 Systemsmith 必须建立自己的 canonical 命名与别名映射（schema 中的 `aliases` 字段），而不能假设外部文献的模式名可以直接索引。第二，传播过程是知识递减过程：Alexander 的 forces 与关系网络在 GoF 那里保留了大半，到网页模式库时代退化为"截图 + 一句话描述"——Dearden & Finlay 的批判正是针对这一退化（见 1.4）。

### 1.3 独立模式库时代与集体死亡（2000s–2010s）

2000 年代出现了一批公共独立模式库：Yahoo Pattern Library（有专门的公司级实施案例论文记录其内部运作 [B038]）、Martijn van Welie 的 welie.com、Infragistics 的 Quince、Anders Toxboe 的 ui-patterns.com。2010–2013 年的学术论文仍将这四者并列为活跃资源 [A063][B040]。至 2026 年，结局已全部可验证：Yahoo Pattern Library 随 Yahoo Developer Network 关闭，原 URL 死链，仅存 Wayback Machine 快照与 2005 年案例论文 [B038]；welie.com 模式内容下线；Quince 停止维护；ui-patterns.com 仍在线但已转型为付费卡片内容产品，不再是协作式公共语言 [C059]。

死因不是模式本身错误，而是四个结构性缺陷，每一个都可对应到一个可验证的事实 [A063][B040]：

- **维护成本与所有权缺位**。独立库无商业模式，作者兴趣转移即死亡；Yahoo 案例证明即使有公司支持，宿主公司战略变化同样致死 [B038]。
- **与组件库的功能重叠**。设计系统兴起后，"带代码的组件"比"纯文档的模式"更接近交付物，模式文档被视为重复劳动——但这是对模式的误读：组件回答"用什么实现"，模式回答"什么时候为什么"，两者本应分层共存（见第 2 章）[B040]。
- **缺乏组合语法**。多数库是扁平条目集合，丢失了 Alexander 的模式间关系网络，退化为一次性的参考列表而非可推理的语言 [N055][A063]。
- **证据缺失**。条目几乎不标注实证状态，"验证过的模式"与"某人的偏好"无法区分——这使模式库在严肃的工程决策中丧失可信度 [A063]。

### 1.4 Dearden & Finlay 的规范性批判（2006）

死亡发生之前，学界已给出诊断。Dearden & Finlay 在《Human–Computer Interaction》期刊的批判综述"Pattern Languages in HCI: A Critical Review"（2006）提出四个关键问题：什么是模式、什么是模式语言、模式与模式语言如何被使用、价值如何在模式方法中被反映 [A063]。其实质结论有三：HCI 界对 pattern / pattern language / guideline 三个概念长期混用；模式"如何被真实使用"缺乏实证研究；Alexander 的"价值负载"（quality without a name——模式指向一种难以命名的整体质量）在转译中几乎完全丢失。这篇文献是 A 级（HCI Canon 同行评审）规范性批判，它给出的不是"模式方法不可用"的结论，而是"现有的库都不是 Alexander 意义上的模式语言"的判定 [A063]。Systemsmith 的 schema 设计（第 3 章）逐项回应了这四个问题。

### 1.5 2026 年的存活形态

两条血脉存活。第一条是企业设计系统的 Patterns 层：IBM Carbon 把模式定义为"best practice solutions for how a user achieves a goal"，维护 14 个通用模式（Common actions、Dialogs、Empty states、Filtering、Forms、Global header、Loading、Login、Notifications、Search、Text toolbar 等）[C055]；Atlassian 的 Patterns 层定位在页面与模板级 [C056][B045]；SAP Fiori 的 floorplans 甚至做到"页面模板即代码"[C018]。第二条是 2026 年新出现的类目：AI 交互模式。四大系统（Carbon、Cloudscape、Atlassian、GitLab）已收敛于三个共识模式——给 AI 一个独立入口、让生成结果可识别、回答"结果不好怎么办"；Cloudscape 的生成式 AI 模式库已覆盖 ingress、chat、output labels、response regeneration、citations、follow-up questions 等十二类 [E009]。注意 E009 为 E 级分析文章，但其所引各系统文档可直接验证，且四系统独立收敛本身构成中等强度证据。

形态的实质变化是：模式从"行业通用知识语言"退化为"组织内复用资产"。这对 Systemsmith 恰好是好消息——行业通用模式语言的位置空出来了，而它的新消费者（AI Agent）恰好需要 Alexander 原始结构（problem/context/forces/solution + 关系网络）才能做条件化推理。

### 1.6 模式库死亡的结构性教训清单

把 §1.3–1.5 合并，得到 Systemsmith 必须逐条规避的六条教训，后文各章分别落实：

1. **必须有活的、不会转移兴趣的消费者**——Systemsmith 的消费者是 Agent 检索与推理管线，模式库嵌入交付工作流而非独立网站（对应死因一）。
2. **必须与组件库明确分层**——模式引用语义组件角色，不复制组件文档（对应死因二，见第 2、3 章）。
3. **必须保留 Alexander 的 forces 与关系网络**——schema 强制 `forces` 与 `related_patterns` 字段（对应死因三，见第 3 章）。
4. **必须逐条标注证据与置信度**——`evidence` 字段使用 Source Registry 全局 ID 并区分 scientific / heuristic / convention / myth（对应死因四，见第 3、5 章）。
5. **必须有生命周期治理**——成熟度分级、owner、废弃路径（对应死因一，见第 5 章）。
6. **必须承认价值判断的边界**——Dearden & Finlay 的第四问（价值如何被反映）在 Systemsmith 中的回应是：模式条目不假装中性，`tradeoffs` 与 `scope` 显式声明该模式服务的价值取向（如密度优先 vs 易学性优先）[A063]。

## 2. 工业界现存 Patterns 层比较

2026 年仍可考察的 Patterns 层分布在六家企业设计系统中。下表按粒度、边界与治理三个维度比较（证据均为一手官方文档，C 级 Mature Product Systems）：

| 系统 | Patterns 层定位与粒度 | 代表模式 | 与组件库的边界 | 治理与成熟度机制 |
|---|---|---|---|---|
| IBM Carbon | 组件组合/工作流级："reusable combinations of components and templates that address common user objectives with sequences and flows"；14 个通用模式 [C055] | Empty states（三场景）、Filtering、Notifications、Loading、Search | 独立 Patterns 导航，模式页引用组件而非重复组件 API；空状态等条目含 a11y 硬规则 [C038] | 模式同样受 Carbon release 阶段模型约束（Preview→Active→Maintenance→EOL）；Dashboards 模式明确标注 WIP [C045][C038] |
| Atlassian (ADS) | 页面/模板级：page header、forms、modals；外加 Rovo UI 作为 AI 模式层 [C056][B045] | Forms（multi-step、progressive disclosure、验证规则） | Patterns 与 Components 分栏；组件内也可"模式化"（editor、empty state） [C040] | 成熟度标签（Early Access/Beta/Caution/Deprecated）；Contribution Ladder 贡献阶梯（提案→DS 团队评审→工程可行性→lead 批准）[C040][E020] |
| GitHub Primer | 工作流指南级："Design guidelines covering common user workflows" [C014] | Navigation（按 URL 语义选组件）、empty states、button usage | 模式页裁决"哪个组件用于哪个语义"——组件存在但选择逻辑在模式层 [C036] | 组件级 Alpha→Beta→Stable→Deprecated→Removed 五级量化生命周期；高门槛 upstreaming 贡献模型 [C023][C008] |
| SAP Fiori | 页面级模板（floorplans）：Overview Page、List Report、Object Page；由 Fiori Elements 代码生成 [C018] | List Report、Object Page | 模式即代码：模板直接生成页面实现，边界最模糊也最强制 | 公司级产品标准强制（product standard for UX consistency）[C018] |
| Shopify Polaris | 模式内建于组件：index table / resource list / filters 即模式 [E016] | 资源管理三件套 | 无独立 Patterns 层；模式随组件分发 | 中央质量控制 + 分布式创新（二手转述，置信中）[E016] |
| AWS Cloudscape | 生成式 AI 模式库（2026 前沿类目） | ingress、chat、output labels、citations、regeneration 等十二类 [E009] | 模式层覆盖 AI 特有的流式/会话交互，传统组件层不覆盖 | 官方立场：永远优先预建组件，自定义组件丧失内建测试与一致性 [C051] |

### 2.1 粒度的三种形态与选择

表中的粒度谱系分三种。**组件组合级**（Carbon）：模式描述若干组件如何组合成一个用户目标的完整路径，粒度最小、数量可控（14 个）、每个都经得起全公司审查 [C055]。**页面/模板级**（Atlassian、Fiori）：模式描述整页的结构骨架，Fiori 进一步把模板做成代码生成物，代价是灵活性——floorplan 之外的设计需要破例审批 [C018]。**工作流指南级**（Primer）：模式不规定布局而规定选择逻辑，最典型的是导航模式按"激活 tab 是否改变 URL"这一交互语义裁决使用 UnderlineNav 还是 UnderlinePanels，并禁止混用两种语义的 tab [C036]。Primer 形态最接近 Alexander 原意：它裁决的是"什么时候为什么"，把"用什么实现"留给组件层。Systemsmith 的产品是高密度 Workspace（Canvas/Inspector/Tree/Timeline），页面级模板过于刚性，建议以组件组合级为主体、工作流指南级为裁决规则、仅在高频整页场景（如对象工作台）保留少量模板级模式。

### 2.2 边界：Pattern ≠ Component，Pattern ≠ Template

Pattern 与 Component 的分层是行业共识定义："Components are individual UI elements (a button, an input field). Patterns describe how components are composed to solve a user problem… components are atoms and molecules; patterns are organisms and templates"（按 Brad Frost Atomic Design 映射）[B040]。用消费问题区分最干净：组件条目回答"用什么实现、API 是什么"；模式条目回答"在什么场景下、为什么问题、用哪种组合、代价是什么"。这解释了死因二——模式文档被视为组件文档的重复劳动，只会发生在模式条目丢失了 problem/context/forces 而退化为组件罗列之后；保留 Alexander 结构的模式层与组件层功能正交 [B040][A063]。

Pattern 与 Template 的区分常被忽略：template 是模式的一次实例化产物（具体布局、具体组件、具体文案槽位），模式是生成无数 template 的解的核心——Alexander 的"用一百万次而不重复同一个样子"正是这个区分 [N055]。Fiori floorplans 是"模式即模板"的极端形态，其代价是模式数量被模板枚举能力限制 [C018]。Systemsmith 跨 React/Vue/Compose/Flutter/Qt 五栈，模式层必须停留在语义组件角色（如 collection-view、inspector-panel）之上，template 由各栈的实现层各自生成——否则模式库将退化为五份模板库的并集。

还有一个隐性边界值得记录：各系统的模式条目普遍包含 do/don't 反例，且部分模式含硬性 a11y 规则——Carbon 空状态模式要求空状态整体替换所在容器（含表头表尾），避免屏幕阅读器先读完整个空结构 [C038]；Carbon Filtering 要求每个 filter category 可一键清除、多 category 时可全局清除 [C022]。这表明成熟的 Patterns 层已经不是"灵感图库"，而是携带可执行契约的知识层——这是 Systemsmith 可以直接对齐的目标形态。

### 2.3 AI 模式层：2026 年的新增类目及其证据状态

上表中 Cloudscape 与 Atlassian Rovo UI 代表了一个 2026 年才成形的新类目：AI 交互模式。四大系统（Carbon、Cloudscape、Atlassian、GitLab）已收敛于三个共识——给 AI 一个独立入口（ingress）、让生成输出可识别（output labels）、回答"结果弱或错怎么办"（regeneration / 补救路径）；Cloudscape 的生成式 AI 模式库进一步细分为 ingress、chat、loading、output labels、response regeneration、support prompts、citations、follow-up questions、thinking、progressive steps、context、authorization 十二类 [E009]。引用该类目必须遵守前沿层纪律：E009 是 E 级分析文章（单一来源），其证据强度来自"四个独立系统收敛"这一事实而非文章本身；且该类目变化速度大于证据积累速度，规范制定者明确缺席。Systemsmith 的对策是收录但隔离：AI 模式条目强制 `frontier` 标记、默认置信度不超过"中"、强制 6 个月 `review_by`——这与知识底座全局对前沿层的"快速收录 + 强制过期 + 显式低权威"策略一致（见第 6 章第 19 条）。

### 2.4 治理方式的横向结论

六家系统的治理细节见第 5 章引用，此处只记录与本章相关的结构性事实：凡存活至今的 Patterns 层，全部满足三个条件——挂在有全职团队的设计系统之内（解决所有权）、模式与组件共用同一成熟度标签体系（解决生命周期）、贡献采用高门槛评审制（Primer upstreaming 要求组件先被多个 feature team 常规使用才进入评审 [C008]；Atlassian Contribution Ladder 要求无工程对应实现的提案不上线 [E020]，该条为二手转述、单一来源）。独立公共模式库三个条件全都不满足——这是 1.6 清单的经验来源，而非推测。

## 3. Systemsmith Pattern 结构 Schema

Schema 的设计原则只有一条：**每个字段必须回答一个 Agent 消费时的具体问题**，没有消费问题的字段不进入 schema。这一原则同时落实 Alexander 的四元组（1.1）、Dearden & Finlay 的四问（1.4）与死亡教训三、四（1.6）。字段分七组：

- **标识组**（`id` / `name` / `aliases`）：回答"如何在检索中命中与去重"。`aliases` 承载 1.2 节确认的同名异物问题——外部文献中的 master-detail、two-panel selector 等异名全部映射到唯一 canonical id [B016]。
- **意图组**（`intent` / `context`）：回答"这个模式解决什么用户问题、在什么场景适用"。这是模式区别于组件的本质字段 [B040]。`context` 进一步结构化：产品形态、数据规模、用户专业度、视口/设备——scope 标注是引用纪律，只适用于特定 scope 的规则必须显式标明（如 novice vs expert、dense vs sparse）。
- **权衡组**（`forces` / `tradeoffs` / `consequences`）：回答"这个模式在平衡什么、代价是什么、采用后必须接受什么后果"。forces 是 Alexander 结构的精髓，也是"模式 ≠ 最佳实践清单"的分界线；没有 forces 的条目不得入库 [N055][A063]。
- **解法组**（`solution` / `anti_patterns`）：回答"结构是什么、什么用法是错的"。`solution` 只引用语义组件角色（collection-view、inspector-panel 等），不引用任何技术栈的具体组件——这是 Pattern ≠ Component、跨五栈复用的实现机制 [B040]。`anti_patterns` 对齐工业 Patterns 层普遍携带 do/don't 的实践（2.2）[C038]。
- **关系组**（`related_patterns`）：回答"它与哪些模式组成、互补、替代"。三类关系还原 Alexander 的 pattern language 网络：`composed_of`（大模式由小模式构成）、`complements`（同一任务链中相邻）、`alternatives`（解决同一问题但权衡不同，必须附 `when` 切换条件）[N055]。
- **证据组**（`evidence` / `confidence` / `evidence_type` / `review_by`）：回答"凭什么相信它"。`evidence` 使用 Source Registry 全局 ID；`evidence_type` 强制区分 scientific/empirical model、design heuristic、platform convention、internet myth 四类——研究已确认多个"常识"实为弱证据（progressive disclosure 无实证支撑 [B042]、Shneiderman mantra 被作者本人定性为 opinion piece [E023]），不分类就会制造新神话。`review_by` 是强制复审日期，前沿条目（如 AI 交互模式）强制 6 个月过期 [E009]。
- **验证组**（`validation`）：回答"如何检查一个界面是否符合该模式"。按自动化三段式分级：deterministic（可机器判定，如焦点管理、aria 绑定）、assistive（机器初筛 + 人工复核）、empirical（只能靠真实用户验证，如任务完成时间）——天花板之上的"体验质量"断言不允许写入 deterministic 检查。

### 3.1 完整条目示例：List → Detail → Inspector

```yaml
id: P-SS-0042
name: List → Detail → Inspector（三栏对象工作台）
aliases: [master-detail, two-panel selector, browse-and-inspect]
category: collection-browsing
status: stable            # draft | reviewed | stable | deprecated
version: 1.1.0
supersedes: []
intent: >
  用户需要在大型对象集合中快速定位目标对象，在不丢失集合上下文的
  前提下查看并编辑其属性；任务形态是"扫视—选中—检查—切换"的循环。
context:
  product_scope: [desktop, dense-workspace, developer-tool, enterprise]
  data_scale: 对象数 ≥100 且需频繁跨对象比较
  user_scope: [intermediate, expert]
  viewport: "≥1280px 宽屏；窄屏退化为 One-Window Drilldown（见 alternatives）"
forces:
  - 信息密度 vs 认知负荷：三栏并列最大化上下文保留，但单栏可用宽度被压缩
  - 切换成本 vs 屏幕占用：并置面板使对象切换零成本，但常驻面板挤占主工作区
  - 属性深度 vs 面板宽度：属性层级深时，固定宽度 Inspector 必须引入分组与搜索
solution: >
  左栏为集合视图（list / tree / table 之一，依实体的结构关系选择）；中栏为
  选中对象的主详情区；右栏为 Inspector，与当前 selection 强绑定，承载属性
  查看与就地编辑。三栏只引用语义组件角色 collection-view / detail-view /
  inspector-panel；selection 是跨栏共享的唯一状态源，任何一栏的选中动作
  立即同步其余两栏。
tradeoffs: >
  三栏布局在 <1280px 视口下不可行；Inspector 对深层属性对象的承载能力有限
  （超过两级嵌套应钻取而非继续加栏）；并置三栏对新手用户的初始认知负荷高
  于单栏钻取。
consequences: >
  采用本模式即承诺：selection 状态全局唯一且可深链（URL 可分享当前选中
  对象）；Inspector 内的编辑遵守就地编辑契约；栏宽可被用户调整并被记忆。
related_patterns:
  composed_of: [tree-navigation, faceted-filter, inline-editing]
  complements: [command-palette, global-search, breadcrumb-location]
  alternatives:
    - pattern: one-window-drilldown
      when: 窄屏、移动端、或沉浸式单对象任务（如阅读长日志）
    - pattern: overview-then-filter-detail
      when: 任务以探索/监控为主而非对象定位为主
anti_patterns:
  - 在 Inspector 内嵌套第二级 master-detail（selection 焦点歧义）
  - 列表与详情各自维护独立 selection 状态（必然失同步）
  - 无 selection 时 Inspector 展示占位广告而非空状态
evidence:
  - id: A019      # Tidwell《Designing Interfaces》3rd ed：two-panel selector / one-window drilldown
    role: canon-definition
  - id: N019      # Shneiderman 1996 Visual Information-Seeking Mantra：details-on-demand 的理论源头
    role: theory-anchor
    caveat: "作者 2026 自述该 mantra 无实证、属 opinion piece [E023]——作结构启发用，不作普适规定"
  - id: C036      # Primer Navigation pattern：NavList/TreeView 与 split-page parent-detail 的工业实例
    role: industry-validation
evidence_type: design-heuristic   # 非 scientific model；含 canon + 工业验证
confidence: high
scope: [expert, desktop, dense]
validation:
  - type: deterministic
    check: "selection 变化时 detail-view 与 inspector-panel 的 aria-label / 数据绑定同步更新"
  - type: deterministic
    check: "当前 URL 可还原 selection 状态（deep-linked state）"
  - type: empirical
    check: "Golden Screen 对照：'定位对象 X 并修改属性 Y' 任务的完成时间与误操作率不低于基线"
review_by: "2027-02"
```

### 3.2 字段与 Agent 消费阶段的映射

Schema 的七组字段不是对称的：它们分别服务 Agent 管线的不同阶段，缺任何一组都会在对应阶段失能。标识组服务**检索命中**（hybrid search 的过滤键）；意图组服务**路由决策**（task type 与 domain entity 的匹配面）；权衡组服务**方案推理**——Agent 在 forces 之间做权衡时需要的是显式声明的冲突力量，而不是从示例截图里逆向猜测，这正是 GoF 条目（intent/motivation/applicability/consequences）比网页模式库截图更适合机器推理的原因 [E037]；关系组服务**方案组合**（Agent 组装多模式方案时沿 `composed_of` / `complements` 遍历）；证据组服务**置信传播**（Agent 输出的每条设计建议可以回溯到带来源等级的证据链）；验证组服务**产出审查**（validation 阶段的 deterministic checks）。反过来说，字段完备性是生命周期状态机的迁移条件（见 5.2）：没有 `forces` 的条目不许入 draft 以上，没有 `alternatives` 的条目不许升 stable——用 schema 完整性代替人工评审的随意性。

三个设计决策需要说明。第一，`evidence` 允许携带 `caveat`：Shneiderman mantra 的引用是该字段的必要性证明——它是被引 9000+ 的 canon 条目 [N019]，但作者本人在 2026 年访谈中确认"had no empirical results, which was an opinion piece"，且存在反向 mantra（van Ham & Perer 2009 的 "Search, show context, expand on demand"，适用于数据量大到无法先给 overview 的场景）[E023]。authority 与证据强度分离标注，正是 Schema 对"高被引 ≠ 已验证"这一神话机制的对冲。第二，`validation` 中的 empirical 检查引用 Systemsmith 内部的 Golden Screen 机制（见 5.1）——模式入库与升 stable 都以通过内部基准界面验证为条件，这把"模式如何被使用"这一 Dearden & Finlay 指出从未被实证的问题，变成入库流水线的一部分 [A063]。第三，`scope` 与 `context.user_scope` 同时存在：`context` 描述模式适用的世界，`scope` 是检索匹配键——一个字段是知识，一个字段是索引，职责分开。

## 4. 模式分类体系

分类体系按 Systemsmith 产品域（高信息密度 Workspace）而非按通用 UI 教科书的章节组织——Tidwell 的章节结构（组织内容/导航/布局/列表/动作/可视化/表单/构建器）[A019] 面向通用界面，对开发者工具特有的域（运行监控、Trace、画布导航）无覆盖。九类别如下，dim03 共产出 24 个已结构化模式（按下方映射表逐行计数；§6 首批详细规格化其中 19 条）按类映射：

| 类别 | 已有模式（映射自 dim03 的 24 模式） | 证据强度 |
|---|---|---|
| 导航与结构 | Settings Hub-and-Spoke [A019][B017]；Drill-down [A019]；Breadcrumb（location/path/attribute 三型）[A020][C020] | 高 |
| 集合浏览 | List→Detail / Master-detail [A019]；Tree / Table 选择（tree table、sortable table）[A019] | 高 |
| 详情与检查 | Inspector [N019]；Inline Editing [E035] | 中高 / 中 |
| 数据探索 | Global Search [C055][N050]；Faceted Filter [C021][C020]；Overview→Filter→Detail [N019][E023]；Dashboard vs Explorer [B012][C038] | 高（含批判标注） |
| 画布与可视化 | Direct Manipulation [B044]；Overview + Detail（画布双视图）[A019] | 高 |
| 输入与创建流 | Wizard / Multi-step [C056]；Progressive Disclosure [B042][B043]；Forgiving Format / Structured Format（表单容错）[A019] | 中高（progressive disclosure 需带批判标注） |
| 反馈与状态 | Empty State（四型）[C038][E038]；Loading / Skeleton [C055]；Optimistic UI [E033] | 中高 |
| 错误与恢复 | Undo > Confirmation [A050]；Confirmation（不可逆操作）[A050]；Error Recovery（可见性+白话+补救）[A050]；Modal vs Non-modal [A013][C015] | 高 |
| 命令与效率 | Command Palette [C057] | 中（成熟实践，无期刊级实证，单一产品证据） |

四个分类决策需要说明。**其一，类别即检索分区**。九类别与 Agent 检索的 task type 查询键一一对应（定位→集合浏览、创建→输入与创建流、监控→反馈与状态、恢复→错误与恢复），分类体系首先是索引结构而非学科 taxonomy——这与 IA 的教训一致：组织方案应匹配消费者（Agent）的查找路径，而非作者的知识结构 [A020]。**其二，数据探索类是 Systemsmith 的密度主战场**。该类四个模式共享同一条底层理论链：信息觅食（用户凭 scent 导航）[N050] 与视觉信息检索 mantra（overview→zoom→filter→details-on-demand）[N019]，且该类模式两两互为 `alternatives`（search-first vs overview-first、dashboard vs explorer），是 5.4 冲突裁决机制最主要的服务对象。**其三，错误与恢复类的四个模式实为一条政策谱系**。从最优到最保守：Undo（立即执行+限时撤销）→ Optimistic UI（先反馈后同步）→ Modal 确认（打断但可取消）→ Confirmation（不可逆前的硬门槛）；选择沿"可逆性 × 风险等级"两轴移动，而非四个并列选项——`related_patterns` 中应把这条谱系显式编码为同一权衡空间内的梯度 [A050][E033]。**其四，命令与效率类当前只有 Command Palette 一个模式**，且其证据状态是全部 24 个模式中最弱的之一（成熟实践、无期刊级实证、单一产品来源）[C057]；它入选是因为与开发者工具的键盘导向工作流高度匹配，但条目必须显式登记其局限——不可发现性、不替代可见导航（recognition over recall）、结果排序质量决定成败——并标注置信度为"中"。

### 4.2 识别出的空白：需自建并验证

对照 Systemsmith 产品域，以下模式在文献与现存工业 Patterns 层中均无成熟条目，属"开发者工具特有但未被模式化"的空白。它们全部标注为**需自建**：初始 `status: draft`，证据来源为 Systemsmith 内部 Golden Screen 验证与用户使用数据，入库置信度上限为"实践共识"，直到积累第二独立来源：

- **Run/Task 生命周期视图**：对象（一次运行/任务）沿状态机（queued→running→succeeded/failed/cancelled）推进的时间-状态复合视图，含重试、日志锚点与产物链接。最接近的工业参照是 Primer 的 Timeline 组件与 StateLabel，但它们只覆盖"状态呈现"不覆盖"生命周期导航"这一模式问题。
- **Trace 瀑布（Span Waterfall）**：层级化 span 的时间轴并置，选择 span 后详情在 Inspector 联动——是 List→Detail→Inspector 在时间域的特化，但缩放、临界路径高亮、与日志互跳均为文献未覆盖的权衡。
- **架构画布导航**：节点-边大图上的 zoom/pan + minimap + 聚焦邻域，即 Shneiderman mantra 的"zoom & filter"在图结构上的实例化；通用 Overview+Detail 模式 [A019] 不回答"图密度超过可读阈值时如何渐进呈现"。
- **日志 Explorer 的 live-tail 与冻结**：流式数据追加与用户阅读位置的冲突（自动滚动 vs 阅读锚定），属于 Dashboard vs Explorer 分叉 [B012] 在流式语境下的未覆盖子问题。
- **多对象批量操作**：集合选择（含跨页选择、过滤后全选）与批量动作的确认/撤销策略，是 Undo>Confirmation 与集合浏览的交叉地带，Carbon 14 模式未覆盖 [C055]。
- **AI 生成结果的标识与再生**：四系统已收敛的共识模式（可识别的 AI 输出 + regeneration + 弱化结果的补救路径）[E009]，但作为前沿类目，入库时强制 `frontier` 标记与 6 个月 `review_by`。

空白清单本身就是知识资产：它标出了 Systemsmith 相对于现存全部工业 Patterns 层的增量位置——通用模式靠借鉴与标注，特有模式靠自建与验证，两类条目在库中以 `evidence_type` 物理区分。

## 5. 治理与生命周期

### 5.1 入库标准：证据下限 + 内部确认

模式入库设双门槛。**证据门槛**：至少一项 C 级（Mature Product Systems）工业验证——如 Carbon/Atlassian/Primer 的对应模式页 [C055][C056][C036]——或一项 B 级平台验证；纯学术 canon（A/N 级）可支撑 `draft` 与 `reviewed`，但不足以单独支撑 `stable`。这一规则直接来自死亡教训四（证据缺失）与交叉验证的发现：同一来源的权威级是 scope 的函数，企业设计系统作为"机制先例"可信、作为"通用数值来源"需降权。**内部门槛**：升 `stable` 前必须通过 Systemsmith Golden Screen 确认——即模式在一组内部基准界面（Golden Screens）上被实际应用，且其 `validation` 字段中的 deterministic 检查全部通过、empirical 检查不低于基线。证据分级采用动态机制：初始权威级 + 升降级域（陈旧性、跨平台收敛、实证支持）+ 时间戳（`review_by`），与知识底座全局的 GRADE 式评级一致 [N013][N014]。

### 5.2 生命周期：借用组件成熟度模型

知识制品的死亡率与维护机制强相关、与初始质量弱相关——独立模式库死于无 owner 与更新流程，而企业设计系统组件靠成熟度模型存活。Systemsmith 模式条目直接借用 Primer 的五级生命周期并裁剪为四级：**draft**（单一来源、未交叉验证）→ **reviewed**（≥2 独立来源或 1 来源 + Golden Screen 通过）→ **stable**（证据门槛 + 内部门槛双通过、schema 全字段完备）→ **deprecated**（被新模式取代或证据基础失效）。Primer 原模型的量化准入（生产环境多处使用、a11y 文档齐全、无性能回退）[C023] 映射为：draft→reviewed 要求证据字段非空且 evidence_type 已分类；reviewed→stable 要求 validation 三类检查齐备且 alternatives 至少登记一个；任何废弃必须提前一个 minor 版本公告、给出 `supersedes` 链与迁移说明——对齐 Primer"Removed 需 ≥1 月公告 + 迁移路径"的纪律 [C023] 与 Spectrum 的 token 级弃用元数据实践（deprecated_comment + renamed 指向替代者）[C049]。每个条目强制 `owner`；前沿条目（AI 交互模式）额外强制 6 个月 `review_by`，过期未复审自动降级 [E009]。

### 5.3 与其他知识层的引用关系

模式层在知识底座中处于语义域一侧，与三个相邻层的契约关系必须单向：**Design Tokens 层**只被模式的 `solution` 以语义角色名间接引用（如 inspector-panel 的间距语义），模式条目不得出现任何具体 token 值——token 是渲染域的"词汇层"，管值不管组合 [N029]；**语义组件契约层**提供 `solution` 引用的角色清单（collection-view 等），组件契约引用模式，模式不反向依赖组件实现——这与 DTCG"交换格式而非架构格式"的自我定位同理 [N029]；**SDIR 层**（语义中间表示）是模式的实例化载体：一个具体界面的 SDIR 声明它应用了哪些 pattern id，validation 阶段的 deterministic 检查即按 SDIR 中的 pattern 引用逐一执行。引用方向固定为 tokens ← 组件契约 ← 模式 ← SDIR 实例，任何反向引用都意味着分层泄漏。

### 5.4 模式冲突的裁决

模式间冲突（两个模式适用于同一场景但给出不同解法）按场景化机制裁决，不设全局优先级链。裁决流程借用 ATAM 的敏感点-权衡点结构：冲突记录为"冲突模式对 × 触发场景 × 权衡点 × 裁决 × 裁决依据"，裁决本身沉淀为 Design Decision Record 进入证据库 [A007]。两条元规则沿用国际法原则：lex specialis——scope 更具体的模式优先（如"窄屏下的集合浏览"优先于通用 List→Detail）[A033]；lex posterior——同 scope 下版本更新的模式优先，但须以 `source_version` + `review_by` 为数据基础 [A034]。一个活例：Overview-first mantra 与 Search-first 反向 mantra 的冲突不能全局裁决，只能按 context 裁决——数据可整体概览且任务以探索为主时前者适用，数据量过大或用户带明确目标进入时后者适用 [N019][E023]；`alternatives.when` 字段就是这一裁决的持久化形态。

### 5.5 Agent 消费方式：检索触发与渐进披露

模式库的消费者是 Agent，检索协议按"触发条件 → 候选集 → 全字段按需加载"设计。**检索触发**的查询键三元组为：task type（用户在做什么：定位/浏览/创建/监控/恢复）、domain entity（操作什么对象：Agent/Run/Task/Log/Trace 等）、密度要求（dense/standard/sparse）——三元组先过滤 `context` 与 `scope` 匹配的候选模式集，再按 confidence 与 status 排序。**加载方式**采用三层渐进披露（Agent Skills 的工业验证结构 [B006][D002]）：L1 层只暴露 `{id, name, category, intent, scope}` 索引（约百 token，供路由决策）；L2 层加载完整条目（forces/tradeoffs/related_patterns，供方案推理）；L3 层按需加载 evidence 细节、anti_patterns 与 validation 检查（供产出审查）。检索采用混合检索（语义向量 + metadata 过滤），`context`/`scope`/`category` 同时充当过滤键——一个字段服务知识、索引与裁决三个职能 [B029]。消费纪律的最后一条：Agent 引用模式 ≠ 输出被模式支持，validation 阶段需对 Agent 产出做逐条 entailment 检查——引用了 P-SS-0042 的界面必须真的满足其 deterministic checks，否则视为未遵循。

## 6. 首批建议清单

首批 19 个模式按"证据成熟度 × Systemsmith 产品域覆盖率"选取：P0 为知识底座 MVP 必需，P1 为第二迭代，P2 为待验证储备。证据基础列使用 Source Registry 全局 ID；"备注"标明借鉴来源或自建性质。

| # | 模式 | 类别 | 证据基础 | 置信度 | 优先级 | 备注 |
|---|---|---|---|---|---|---|
| 1 | List → Detail → Inspector | 集合浏览/详情与检查 | [A019][N019][C036] | 高 | P0 | 自建组合模式（三栏 Workspace 骨架）；mantra 引用须带 opinion-piece caveat [E023] |
| 2 | Command Palette | 命令与效率 | [C057] | 中（单一来源；无期刊级实证） | P0 | 借鉴 VS Code/SaaS 成熟实践；须登记"不可发现性"反模式与 recognition-over-recall 约束 |
| 3 | Faceted Filter | 数据探索 | [C021][C020] | 高（多来源收敛） | P0 | 直接借鉴：facet 内 OR、facet 间 AND、chips、计数、禁用零结果值 |
| 4 | Global Search | 数据探索 | [C055][N050] | 高 | P0 | 借鉴 Carbon Search；label/trigger-word 密度按信息觅食理论优化 [N050] |
| 5 | Overview → Filter → Detail | 数据探索 | [N019][E023] | 高（出处）/中（普适有效性） | P0 | 必须携带失效条件与 search-first 反向替代；标注 evidence_type=design-heuristic |
| 6 | Tree Navigation | 集合浏览 | [A019][C010] | 高 | P0 | 借鉴 Primer TreeView；与 List→Detail 组合使用 |
| 7 | Undo > Confirmation | 错误与恢复 | [A050][N005] | 高 | P0 | 借鉴 NN/g forgiveness 原则；WCAG 2.2 SC 2.2.1/3.3.4 为合规锚点；假 Undo 为首要反模式 |
| 8 | Confirmation（不可逆操作） | 错误与恢复 | [A050] | 高 | P1 | 仅用于删账户/转账/广播级操作；习惯化失效为主要风险 |
| 9 | Empty State（四型） | 反馈与状态 | [C038][E038] | 中高 | P0 | 借鉴 Carbon 三场景分类 + "整体替换容器"a11y 硬规则；NN/g 空状态专文已 404 不可引用 |
| 10 | Loading / Skeleton | 反馈与状态 | [C055] | 中高 | P1 | 借鉴 Carbon Loading；>1s 给骨架、确定时长用 determinate、保持布局稳定 |
| 11 | Error Recovery | 错误与恢复 | [A050] | 高 | P0 | 消息四要素：发生了什么+为何重要+下一步+不怪用户；清空输入为反模式 |
| 12 | Modal vs Non-modal | 错误与恢复 | [A013][C015] | 高 | P1 | 借鉴 NN/g 定义与"狼来了"效应；a11y 契约（焦点/inert/Esc）按 C015 |
| 13 | Wizard / Multi-step | 输入与创建流 | [C056] | 中高 | P1 | 借鉴 Atlassian Forms：进度指示 + 保存进度 + 不禁用 submit |
| 14 | Progressive Disclosure | 输入与创建流 | [B042][B043] | 高（含批判：实证基础薄弱） | P1 | 条目必须标注 Carroll & Rosson 自认缺乏有效性证据；分割点须基于用户观察 |
| 15 | Settings Hub-and-Spoke | 导航与结构 | [A019][B017] | 高 | P1 | 借鉴 Tidwell hub-and-spoke；层级 ≤2 层 + 搜索兜底；首层标签 scent 优先 |
| 16 | Dashboard vs Explorer | 数据探索 | [B012][C038] | 中高 | P1 | 借鉴 Fuselab 分叉判据与 Carbon dashboard 两类；混用为反模式 |
| 17 | Inline Editing | 详情与检查 | [E035] | 中（供应商立场来源，已降权） | P2 | 单字段快改适用；需补 Golden Screen 验证后方可升 reviewed |
| 18 | Optimistic UI | 反馈与状态 | [E033] | 中高（工程共识） | P1 | 限低失败率可回滚操作；支付/权限变更禁用 |
| 19 | AI 生成结果标识与再生 | 反馈与状态（前沿） | [E009] | 中（四系统收敛；分析文章） | P1 | frontier 标记 + 6 个月 review_by；借鉴 Cloudscape 十二类子模式 |

自建模式（Run/Task 生命周期视图、Trace 瀑布、架构画布导航、live-tail 冻结、批量操作）不列入首批：它们以 `draft` 状态先行登记 intent 与 forces，待 Golden Screen 验证产出后再按 5.2 流程升级——首批清单的原则是"借得动的先借，借不动的先立档"，避免库龄第一天就背上未验证条目。
