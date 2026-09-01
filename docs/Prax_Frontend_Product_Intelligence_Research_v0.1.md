# Prax Frontend Product Intelligence 大样本前端研究 v0.1

> **主题**：如何把“优秀前端”从个别设计师、明星产品或开源项目的经验，转化为我们自己可掌控、可积累、可交给 Agent 执行且不僵化的产品/UX/Frontend Engineering 能力。  
> **用途**：为 Prax 下一代 Frontend Product Intelligence、ECP 前端设计以及后续任意 Web 产品提供研究基础。  
> **状态**：研究工作稿 v0.1，包含当前采样、编码、统计、案例、理论证据、推论与下一阶段实验设计。  
> **重要边界**：本文不声称“穷尽整个 Web”。当前采用系统综述式的 taxonomy + 分层目的抽样；Wide Corpus 是研究编码集，不是互联网市场占比调查。部分闭源产品只根据可公开核实的真实界面、官方帮助/设计/工程资料编码；源码级结论仅来自开源或公开代码样本。

---

## 0. 核心结论摘要

这轮研究最重要的变化，不是找到更多“好看的前端”，而是开始形成一个可解释的因果模型：

```text
Product Intent
      ×
User Job / JTBD
      ×
Primary Object
      ×
Task Structure
      ×
Information Shape
      ×
Interaction Need
      ×
Context / Risk / Expertise
               ↓
     Representation Architecture
        primary + supporting
               ↓
   Information Architecture
               ↓
 Priority + Progressive Disclosure
               ↓
      Interaction Grammar
               ↓
        State Ownership
               ↓
    Visual Hierarchy Intent
               ↓
      Frontend Architecture
               ↓
         Validation Stack
               ↓
       Browser/User Evidence
               ↓
       Design Evolution Memory
```

当前证据已经足以否定几个常见但危险的假设：

1. **Backend Model 不能直接决定 Product UI。**
2. **Task 本身也不足以单独决定 Representation。**
3. **Object 类型本身也不足以单独决定 Representation。**
4. **不存在一种通用“优秀 Web Shell”。**
5. **Card/Grid、Dashboard、Tabs、Progressive Disclosure、Canvas 都是有适用域的表达工具，而不是默认答案。**
6. **优秀专业工具不一定“信息少”；核心是 Relevant Information Density，而不是 Minimum Information Density。**
7. **详情是 Page、Panel、Inline 还是 Modal，本质上是 Context Retention Decision。**
8. **复杂工具长期不变乱，靠的是 Product Principles + Semantic Object/Pattern + Interaction Grammar + Command/State Architecture + Validation/Evidence，而不只是组件库。**
9. **AI-native 产品中的 Chat 通常只是 Interaction Mode，不一定是 Product Representation。**
10. **Prax 应从“Representation Choice”升级到“Representation Architecture / Portfolio”。**

---

# 1. 研究问题

本研究不是回答：

> 哪些网站好看？  
> 哪些 UI Pattern 流行？  
> 哪套组件库值得复制？

而是回答：

> **为什么一个优秀产品在一个具体任务下应该以这种方式被组织、表达和操作？**

最终目标是让 Coding Agent 不再：

```text
Backend schema
    ↓
CRUD 页面
    ↓
Sidebar + Header
    ↓
Cards / Table / Form
```

而是经过显式的产品推理：

```text
User
 ↓
User Problem
 ↓
Job / Task
 ↓
Product Object
 ↓
Information Shape
 ↓
Representation
 ↓
Information Architecture
 ↓
Interaction
 ↓
Visual Hierarchy
 ↓
Implementation
```

这也是 Prax 的核心问题：**补齐从产品意图到前端实现之间，被 Coding Agent 经常跳过的中间推理层。**

---

# 2. 研究方法

## 2.1 为什么不继续用“明星产品案例法”

如果只研究：

- Archify
- Linear
- Figma
- Notion
- Stripe

很容易把局部规律误认为普遍规律，例如：

- Canvas dominant 是不是总更高级？
- Progressive disclosure 是不是越多越好？
- 极简是不是天然优于高密度？
- Command Palette 是否所有产品都该有？
- Dark mode 是否更像专业工具？

因此本轮采用：

```text
Web 表达范式 Taxonomy
        ↓
分层目的抽样
        ↓
Wide Corpus
        ↓
Deep Cases
        ↓
结构化编码
        ↓
描述性统计
        ↓
跨样本模式
        ↓
反例校正
        ↓
HCI/认知理论解释
        ↓
Prax 推论
```

---

## 2.2 两层样本

### Wide Corpus

当前：

- **120 个 Web 产品/页面样本**
- **20 个表达/产品范式**
- 每类 6 个代表样本
- 目标：扩大覆盖面、发现 Pattern、挑战已有假设

Wide Corpus 主要用于：

- Representation 频率
- Detail Pattern
- Density
- JTBD
- Primary Object
- Hybrid Representation
- 不同产品范式的结构差异

它**不是随机市场样本**，因此不能说：

> “22.5% 的互联网网站使用 Table。”

正确表述是：

> “在本轮用于覆盖多种 Web 表达任务的 120 个分层样本中，22.5% 被编码为 List/Table 主表达。”

### Deep Case Studies

当前重点深挖 **25 个案例**。

| 案例 | 开放性 | 主范式 | 本轮重点 |
| --- | --- | --- | --- |
| Archify | 开源 | Graph/Diagram | PRODUCT/DESIGN、visual evolution、viewer runtime、renderer/shared、validation |
| Figma | 闭源/公开工程资料 | Canvas/Editor | UI3 设计演进、floating→fixed panel 反例、Pattern Library |
| Penpot | 开源 | Canvas/Editor | design system、tokens、workspace、AI/MCP prompting、canvas organization |
| tldraw | 开源 | Canvas/Editor | Editor state machine、reactive state、tool/event ownership |
| Excalidraw | 开源 | Canvas/Editor | Command Palette、actions、shortcuts、低 chrome canvas |
| JupyterLab | 开源 | IDE/Notebook | centralized command system、menus/shortcuts/palette、extensibility |
| VS Code | 开源 | IDE | workbench、commands/menus/keybindings、multi-panel expert UI |
| Grafana | 开源 | Dashboard/Monitoring | design system、Storybook、panel tests、a11y/e2e/regression |
| Apache Superset | 开源 | BI | design guidelines、design system、testing、cross-browser/regression |
| PostHog | 开源 | Analytics | Quill tokens→primitives→components→blocks、empty-state product rules |
| Sentry | 开源 | Observability | core component docs、a11y/visual regression contribution contract |
| GitLab Pajamas | 公开设计系统 | Product/Admin | Objects、table/card usage、patterns vs components |
| Notion | 闭源/公开帮助资料 | Document/Database | 同一数据库多 view、document+database composition |
| Linear | 闭源/公开产品资料 | Issue/Project | keyboard-heavy、list/board/detail、command-oriented expert flow |
| AWS Cloudscape | 公开设计系统 | Resource management | Table/Card/Split View 按任务与对象形态选择 |
| TradingView | 闭源/公开产品资料 | Financial | chart/table/watchlist/multi-chart，information resolution |
| Our World in Data | 开放产品/公开文章 | Data Story | chart/map/table 多 representation，narrative+data |
| Mapbox Studio | 公开文档/产品 | Map/Editor | spatial representation、layers、zoom-dependent detail |
| GOV.UK | 公开设计系统 | Public service | tabs/dashboard/task-flow 的严格适用边界 |
| USWDS | 公开设计系统 | Public service | forms、step indicator、a11y、high-consequence workflow |
| Tally | 闭源/公开产品资料 | Form/Editor | document-like form creation，低 chrome、block model |
| Perplexity | 闭源/公开产品资料 | AI/Search | answer+sources、conversation+evidence |
| Replit | 部分开源生态/公开产品资料 | AI/IDE | chat+code+preview artifact surface |
| Stripe | 闭源/公开设计与文档 | Finance/Developer | docs/product/admin 不同 representation，强信息层级 |
| Airbnb | 闭源/公开产品资料 | Travel | list+map 同步组合，location 作为决策变量 |


Deep Cases 负责解释“为什么”以及“工程上如何维持”。

---

## 2.3 Web 表达范式 Taxonomy

本轮主动覆盖：

1. 搜索 / 信息检索
2. 内容 / 新闻 / 出版
3. 电商 / 商品决策
4. 旅行 / 地图 / 本地
5. 金融 / 支付 / 投资
6. 社交 / 社区 / 论坛
7. 视频 / 音频 / 流媒体
8. 教育 / 学习
9. 政府 / 公共服务
10. 创作 / 设计 / 编辑器
11. 开发者工具 / IDE / 代码
12. BI / 监控 / 分析
13. 项目 / 协作 / 知识
14. CRM / ERP / Admin
15. 表单 / 流程 / 审批
16. AI-native
17. 文档 / API / 知识站
18. 空间 / 图谱 / 复杂关系
19. 品牌 / 叙事 / 数据故事
20. 招聘 / 房产 / 本地决策

仍然存在未充分覆盖的区域，见“研究局限”。

---

# 3. 编码 Schema

每个 Wide Sample 至少按以下维度分析。

## 3.1 Product / Task

```yaml
product:
domain:
user:
jtbd:
primary_action:
success_condition:
```

### JTBD verb vocabulary（当前）

```text
scan
locate
navigate
compare
monitor
create
edit
manage
decide
transact
communicate
explore
learn
explain
control
troubleshoot
complete
review
```

---

## 3.2 Object

```yaml
primary_object:
object_cardinality:
object_hierarchy:
```

当前常见对象类型：

```text
document
item
entity
record
event
metric
location
relationship
timeline
media
workflow
conversation
code
canvas_object
dataset
change_set
```

---

## 3.3 Information Shape

这是本轮认为 Prax 必须正式结构化的一组变量：

```yaml
information_shape:
  cardinality:
  dimensionality:
  hierarchy:
  temporality:
  spatiality:
  relationality:
  volatility:
  uncertainty:
  density:
  comparison_need:
```

解释：

- **Cardinality**：对象数量
- **Dimensionality**：每个对象需要同时比较的属性数量
- **Hierarchy**：父子/层级结构强度
- **Temporality**：时间是否决定理解
- **Spatiality**：位置是否本身具有意义
- **Relationality**：对象关系是否为核心
- **Volatility**：数据变化频率
- **Uncertainty**：推断、置信度、来源差异
- **Density**：任务需要同时观察多少信息
- **Comparison Need**：是否必须并排比较

---

## 3.4 Operation Shape

```yaml
operation:
  frequency:
  reversibility:
  consequence:
  batchability:
  context_retention:
  collaboration:
  latency:
  expertise:
```

这些变量解释了为何相同对象在不同产品里需要不同 UI。

---

## 3.5 Representation

```yaml
representation:
  primary:
  supporting:
  alternate:
```

本轮特别区分：

- **Representation Primitive**
- **Representation Composition**

见后文。

---

## 3.6 IA / Disclosure

```yaml
ia:
  first_screen_priority:
  persistent_ui:
  contextual_ui:
  disclosure:
  navigation_model:
  detail_pattern:
```

---

## 3.7 Interaction

```yaml
interaction:
  focus_model:
  selection_model:
  preview_model:
  navigation:
  commands:
  search:
  filter:
  sort:
  drag:
```

以及：

```yaml
state_ownership:
```

---

## 3.8 Visual Grammar

```yaml
visual:
  hierarchy:
  spacing:
  typography:
  semantic_color:
  decorative_color:
  contrast:
  grouping:
  motion_purpose:
```

---

## 3.9 Quality

```yaml
quality:
  empty_state:
  loading:
  error:
  success:
  responsive:
  accessibility:
  visual_regression:
  browser_evidence:
```

---

# 4. Wide Corpus 数据

## 4.1 主 Representation 分布

在本轮 120 个分层样本中，按“当前 JTBD 下最主要的认知载体”归一化编码：

| 主表达家族 | 样本数 | 占比 |
| --- | --- | --- |
| List / Table | 27 | 22.5% |
| Document / Story | 24 | 20.0% |
| Canvas / Editor | 16 | 13.3% |
| Dashboard / Chart | 10 | 8.3% |
| Chat / Conversation | 8 | 6.7% |
| Form / Workflow | 7 | 5.8% |
| Map / Spatial | 6 | 5.0% |
| Media | 5 | 4.2% |
| Cards / Grid | 5 | 4.2% |
| Graph / Diagram | 4 | 3.3% |
| Feed / Conversation | 3 | 2.5% |
| Detail / Object | 2 | 1.7% |
| Interactive Learning | 1 | 0.8% |
| Comparison / Diff | 1 | 0.8% |
| Tree / Hierarchy | 1 | 0.8% |


### 观察

没有任何一种主表达超过 25%。

这直接反驳：

```text
“优秀 Web 有一个统一主框架”
```

尤其值得关注：

- List/Table：22.5%
- Document/Story：20.0%
- Canvas/Editor：13.3%
- Dashboard/Chart：8.3%
- Cards/Grid：仅 4.2%

**Card/Grid 并不是跨产品的默认答案。**

---

## 4.2 Detail Pattern 分布

| 详情呈现方式 | 样本数 | 占比 |
| --- | --- | --- |
| 独立 Page | 55 | 45.8% |
| Contextual Panel | 39 | 32.5% |
| Inline | 23 | 19.2% |
| Modal | 2 | 1.7% |
| Side Peek | 1 | 0.8% |


### 观察

Modal 在复杂对象详情中并不是主流承载形式。

更多出现的是：

```text
Page
Panel
Inline
```

这支持一个重要推论：

> Detail Surface 应从 Context Retention 推导，而不是从组件偏好推导。

---

## 4.3 当前 Density 分布

按本轮初步编码：

- High density：57
- Medium density：46
- Low density：17

这里的“密度”不是视觉拥挤程度，而是：

> 当前核心任务要求用户同时看到多少结构化信息。

### 注意

本轮曾做一个补充 chrome 观察，发现 high-density 专业工具通常拥有 medium/high persistent chrome，而 low-density narrative/task surfaces 倾向 low chrome。但该字段尚未像主表一样完成可复现逐条编码，因此**当前只作为趋势，不作为硬统计结论**。

---

# 5. Card/Grid：为什么 Agent 过度使用它

Card 真正适合：

- 对象相对独立
- Mixed media
- 图像/视觉身份重要
- 属性无需严格逐列比较
- 用户主要 scan / discover / shortlist

典型：

```text
Etsy
Netflix
YouTube
IKEA
```

不适合：

- 多对象多属性横向比较
- 用户需要 scan 同一字段
- 需要批量操作
- 数据集合持续增长
- 排序、筛选、密度比“对象独立感”更重要

典型：

```text
Admin product list
Model configurations
Security events
Deployments
Users
Tasks
Metrics
```

### 本质

```text
Card
= object identity oriented

Table
= attribute comparison oriented
```

这不是视觉风格选择。

---

# 6. Task 也不是 Representation 的唯一决定因素

例如同样都是：

```text
decide
```

可能需要：

```text
Cards
List
Map
Chart
Document
Detail View
```

原因在于：

```text
decide × product
```

还要继续问：

```text
位置是否重要？
需要比较多少属性？
视觉身份是否重要？
是否有时间序列？
是否需要精准值？
决策后果多高？
```

所以 Prax 不能只有：

```text
Task → Representation
```

而应是：

```text
Task × Object × Information Shape × Interaction Need
→ Representation
```

---

# 7. Object 也不是 Representation 的唯一决定因素

同样是 `Product`：

### Etsy

```text
discover
→ visually recognize
→ shortlist
→ decide
```

因此：

```text
Grid
+ Image
+ Price
+ Rating
+ Filters
```

### Shopify Admin

```text
manage
→ compare attributes
→ batch operation
→ edit
```

因此：

```text
Table/List
+ Filters
+ Bulk Actions
+ Detail
```

同一个 Object，不同 Job，UI 不同。

---

# 8. Representation Choice 应升级成 Representation Portfolio

TradingView、Our World in Data、Notion 等案例表明：

同一数据/对象，经常需要多种 representation。

例如：

```text
Trend
→ Line Chart

Exact comparison
→ Table

Geographic distribution
→ Map
```

所以建议 Prax 改成：

```yaml
representation:
  primary:
    type: line_chart
    reason: understand_trend

  supporting:
    - type: table
      reason: exact_value_comparison

    - type: map
      reason: geographic_distribution
```

即：

# Representation Portfolio

或更完整地叫：

# Representation Architecture

---

# 9. Representation Primitive 与 Composition

## 9.1 Primitive

```text
List
Table
Grid
Cards
Document
Feed
Thread
Chart
Map
Timeline
Calendar
Graph
Tree
Canvas
Diagram
Media
Form
Wizard
Search Results
Code Editor
Chat
```

## 9.2 Composition

现实优秀产品更常见的是组合：

```text
List + Detail Panel
List + Map
Table + Inspector
Chart + Table
Canvas + Layers + Inspector
Feed + Composer
Search Results + Filters
Document + TOC
Dashboard + Drilldown
Chat + Artifact Preview
Graph + Semantic Inspector
Map + Search + Detail
Code + Preview + Terminal
```

Prax 的 Representation 知识库不应只列 Primitive。

---

# 10. Context Retention 决定 Detail Surface

### Canvas / Map / Dashboard

这些产品的共同特征：

> 当前上下文本身有价值。

因此用户选中一个对象后：

```text
Main Context
+
Contextual Panel
```

通常比：

```text
Navigate to another full page
```

更合理。

Figma：

```text
Canvas
+ Selected object
+ Inspector
```

Google Maps：

```text
Map
+ Selected location
+ Detail
```

Grafana：

```text
Dashboard
+ panel/detail/editor
```

所以应有：

```yaml
detail_decision:
  context_retention: high
  surface: panel
```

---

# 11. Progressive Disclosure：不能成为设计教条

Progressive Disclosure 的价值：

- 降低同时可见复杂度
- 延后低频设置
- 保持主任务聚焦

但它有 retrieval cost。

如果用户：

- 高频访问
- 依赖空间记忆
- 需要同时比较
- 需要快速重复操作

隐藏 UI 反而可能更差。

Figma UI3 是重要反例：

其 floating panels / 过度弱化 chrome 的尝试暴露：

- 小屏 Canvas 被压迫
- UI 与内容空间关系不稳定
- 专业高频操作速度下降

因此：

```text
Progressive Disclosure
≠
Hide more UI
```

正确问题：

```text
Access frequency?
Comparison need?
Spatial memory value?
Retrieval cost?
Context role?
```

---

# 12. Tabs 的适用边界

Tabs 很容易成为 Agent 对“内容太多”的默认处理。

但当用户需要：

- 顺序理解
- 对比两个 section

Tabs 可能迫使用户：

```text
A
→ remember A
→ switch B
→ recall A
→ compare
```

这增加 working-memory burden。

因此：

```text
Need simultaneous comparison
→ don't hide behind mutually exclusive tabs
```

---

# 13. Dashboard 不是“有指标”的默认答案

Dashboard 更适合：

- 高频 monitor
- 数据持续变化
- 用户已经理解指标背景
- 主要任务是 scan anomaly / status

如果主要任务是：

- 解释原因
- 讲清复杂洞察
- 教用户理解问题
- 建立叙事

Document / Story / Multi-chart narrative 可能更好。

所以：

```text
Have KPIs
≠
Need Dashboard
```

---

# 14. Information Density：正确目标不是“越少越好”

优秀 UI 追求：

# Relevant Information Density

不是：

# Minimum Information Density

不同任务完全不同：

### Editorial / reading

更适合：

```text
restricted reading width
large whitespace
linear flow
```

### Trading / IDE / monitoring

可能需要：

```text
high density
persistent controls
multiple simultaneous views
stable spatial layout
```

因此 Prax 不应该用：

```text
more whitespace = better
```

这种规则。

---

# 15. “复杂 UI”与“乱 UI”不是一回事

失败的复杂 UI：

```text
System Complexity
→ directly exposed
→ UI Complexity
```

过度极简：

```text
Complex Task
→ hide everything
→ retrieval burden
```

成熟 UI：

```text
System Complexity
      ↓
Product compression / grouping / externalization
      ↓
Task-required Complexity
      ↓
UI
```

---

# 16. External Cognition：Table 为什么经常比 Cards 更容易比较

Working memory 有限，不意味着“屏幕只能有几个元素”。

更有价值的设计推论是：

> 不要让用户在脑中维持本来可以放到界面中的比较状态。

例如：

```text
Card A
Card B
Card C
```

如果属性位置不对齐，用户需要反复记忆。

Table 把：

- 列
- 对齐
- 相同属性
- 顺序

外置到界面。

这是一种 External Cognition。

---

# 17. Reading Depth 应升级为 Information Resolution

Archify：

```text
MAP
READ
FULL
```

但类似思想广泛存在：

- Map zoom level
- TradingView minimal/table watchlist
- Chart/Table switching
- Semantic focus
- Expert/novice modes

所以建议 Prax 抽象为：

# Information Resolution

它可由：

```text
Zoom
Selection
Task
Mode
Role
Query
Expertise
Viewport
```

驱动。

---

# 18. Progressive Disclosure 的机制分类

至少分成：

| Mechanism | 适合解决 |
|---|---|
| Selection → Inspector | 保持主环境上下文 |
| Peek / Preview | 快速查看，不切 navigation |
| Drilldown Page | 深度、长时详情任务 |
| Tabs / Switcher | 同对象互斥视角 |
| Collapsible Section | 降低同时密度 |
| Zoom / LOD | 空间尺度变化 |
| Search / Filter | 缩小候选集合 |
| Conditional Workflow | 隐藏与当前路径无关步骤 |

不能统称为“渐进式披露”后不再分析。

---

# 19. Archify：真正值得学习的是 Design Evolution Loop

Archify 的核心价值不只是 Renderer。

其 Visual Evolution 文档持续使用类似结构：

```text
Reader Problem
      ↓
Product Question
      ↓
Primary-source Research
      ↓
Pattern Comparison
      ↓
Borrow / Skip
      ↓
Product-specific Decision
      ↓
Interaction Contract
      ↓
Implementation
      ↓
Validation Contract
      ↓
Browser Evidence
```

这是一种成熟前端演进机制。

---

# 20. Archify Semantic Passport 案例

问题不是：

> “我们需要一个漂亮 Inspector。”

而是：

> 用户 Focus 一个节点后，仍然不知道其 technology、responsibility、semantic type、structural scope。

研究 LikeC4、Structurizr、D2 后，它选择：

```text
details on demand
```

并明确：

```text
不新增第二个永久 inspector
```

而是复用已有 Relationship Lens。

这是典型的：

# UI Surface Budget

---

# 21. Archify Semantic Radar 案例

问题：

> 大图怎么保持空间方向感，但不变成 Canvas Editor？

研究：

- React Flow MiniMap
- GoJS Overview
- Structurizr navigation

最终 Borrow：

- semantic node bounds
- viewport rectangle
- recenter
- focus

Skip：

- clone full SVG
- introduce graph runtime
- layout editing
- node movement
- always-open panel

关键不是 Minimap，而是：

# Borrow / Skip Boundary

---

# 22. Archify Intent Trace 案例

发现：

> click 后探索很好，但 click 前 affordance 不明确。

它区分：

```text
Hover/Focus
= temporary preview

Click
= durable focus
```

因此：

# Preview ≠ Selection

这直接涉及 State Semantics。

---

# 23. Archify Reading Depth 案例

问题：

> 同时信息密度过高。

不是继续加 filter。

而是：

```text
MAP
READ
FULL
```

通过不同 scale / intent 显示不同 detail tier。

关键思想：

> Structure 永远在；细节按认知需要增加。

---

# 24. Interaction Grammar：复杂工具的重要共同结构

在多个开源专业工具中出现了：

```text
Command
Action
State
Shortcut
Menu
Context Menu
Palette
```

共享同一语义动作。

## JupyterLab

官方设计明确：

> 所有 User Actions 都经过 centralized command system。

一个 command 可由：

- menu
- context menu
- shortcut
- command palette

调用。

## tldraw

将：

```text
onPointerDown
onPointerMove
onKeyDown
onEnter
onExit
```

放进显式状态系统。

当前 active state chain 决定事件所有权。

## Excalidraw

存在明确：

- Command Palette
- Action
- Shortcut

体系。

### Prax 推论

`Interaction Grammar` 必须是正式设计 Artifact。

---

# 25. State Ownership

Prax 不应该只生成：

```text
node clickable
```

应该描述：

```yaml
interaction:
  hover:
    intent: preview
    persistent: false
    owns:
      - highlight

  select:
    intent: inspect
    persistent: true
    owns:
      - selection
      - inspector

  double_click:
    intent: navigate

  escape:
    clears:
      - transient
      - selection
```

以及：

```yaml
state_ownership:
  preview: hover
  selection: main_view
  inspector: selected_object
  viewport: camera
  query: search
```

这样才能检测状态冲突。

---

# 26. Design System：优秀产品不只维护 Components

## PostHog Quill

明确分层：

```text
Tokens
 ↓
Primitives
 ↓
Components
 ↓
Blocks
```

## GitLab Pajamas

包括：

```text
Foundations
Components
Patterns
Objects
Data Visualization
Content
```

最重要的是 `Objects`：

> 产品概念对象独立于 visual representation。

例如：

```text
Merge Request
Repository
Job
```

不是：

```text
Card
Table
```

### Prax 推论

必须正式引入：

# Product Object Model

---

# 27. Semantic Object ≠ UI Component

例如：

```text
Deployment
```

可能在不同任务中：

```text
compare deployments
→ Table

inspect deployment
→ Detail

understand deployment topology
→ Architecture

see deployment history
→ Timeline
```

所以：

```text
Object → Component
```

是错误映射。

---

# 28. 前端长期不变乱的机制

跨样本逐渐形成如下链条：

```text
Product Principles
        ↓
Object Model
        ↓
Patterns
        ↓
Interaction Grammar
        ↓
Design System
        ↓
Command / State Architecture
        ↓
Acceptance Contract
        ↓
Regression / A11y / E2E
        ↓
Usage Evidence
        ↓
Evolution Records
```

---

# 29. Quality System 案例

## Grafana

公开代码/工程文档可以观察到：

- Storybook 管理 Design System
- panel accessibility tests
- keyboard accessibility
- E2E
- regression strategy
- canvas/uPlot 可视化专门测试策略

## Superset

公开文档覆盖：

- unit
- integration
- e2e
- cross-browser
- regression

## Sentry

Core component contribution 要求按情况增加：

- docs
- unit test
- accessibility test
- visual regression

### 推论

优秀前端不是“截图看起来不错”就结束。

---

# 30. AI-native：Chat 不是 Product Representation

很多 Agent 产品容易变成：

```text
Big Chat Window
```

但任务可能是：

```text
AI code
→ Code + Preview + Diagnostics

AI architecture
→ Canvas + Evidence

AI BI
→ Query + Chart/Table

AI research
→ Answer + Sources + Report

AI shopping
→ Results + Comparison

AI learning
→ Lesson + Manipulation + Feedback
```

因此 Prax 应有硬原则：

> **Conversation is an Interaction Mode, not necessarily the Product Representation.**

---

# 31. 为什么 LLM/Coding Agent 经常生成 Dashboard Shell

当前推论：

## 31.1 Backend Schema Salience

Prompt 里最具体的是：

- endpoint
- DB table
- field
- API

Agent自然围绕它们组织 UI。

## 31.2 Component Prior

训练语料中：

```text
sidebar
topbar
card
dashboard
table
form
```

具有非常高的模式可见性。

## 31.3 Missing User Model

没有：

```text
谁
什么时候
为什么
高频还是低频
专家还是新手
```

## 31.4 Missing Information Shape

不知道用户需要：

```text
compare
locate
monitor
explain
```

## 31.5 Missing Representation Decision

直接：

```text
Requirement
→ React Components
```

## 31.6 Missing Negative Knowledge

不知道：

> 为什么不应该使用 Dashboard / Card / Tab / Modal。

## 31.7 Missing Evolution Evidence

功能一直加，但没有：

```text
UI surface budget
state ownership
interaction arbitration
regression contract
```

---

# 32. Penpot 的 Agent 文档提供了一个有价值的佐证

Penpot 的公开 MCP/AI 设计文档明确指出：

> “Act like a UX/UI designer” 这种 Prompt 太模糊。

同时提出：

> Infinite Canvas 应该是 logical map，有明确目的和视觉入口，避免 chaotic infinite canvas。

这证明：

```text
Prompt Personality
≠
Design Intelligence
```

---

# 33. HCI / 认知理论：如何用于解释，而不是变教条

## 33.1 Working Memory

Cowan 的工作记忆研究常被概括为约 3–5 个 chunk 的核心容量。

**不能推导：**

```text
UI 最多只能放 4 个东西
```

**可以推导：**

> 不要让用户在脑中长期维持本可外置的比较、状态、关系。

---

## 33.2 Recognition vs Recall

适合：

- command discovery
- visible navigation
- known option selection

但专家产品也需要：

- shortcuts
- commands

因为长期用户愿意用 recall 换速度。

所以：

```text
Recognition good
≠
Never use recall
```

---

## 33.3 Gestalt Grouping

可解释：

- proximity
- alignment
- enclosure
- continuity

为什么能帮助用户快速形成对象组。

但不能替代产品语义。

---

## 33.4 Overview → Zoom/Filter → Details on Demand

Shneiderman 的 visualization mantra 对：

- graph
- map
- complex visualization

非常有用。

但不是所有产品的 universal layout。

例如：

- linear form
- article
- transaction flow

未必需要 overview-first。

---

## 33.5 Focus + Context

Furnas 的 focus+context 思想能解释：

- architecture
- maps
- timelines
- code minimap
- node inspector

为什么需要：

> 保留全局，同时强化局部。

---

## 33.6 Direct Manipulation

Canvas/editing 产品中：

- drag
- resize
- select

有很高价值。

但高风险/不可逆动作不能仅靠“直接操作感”。

---

## 33.7 Fitts / Hick-Hyman

只能作为局部设计分析工具。

不能粗暴变成：

```text
按钮越少越好
按钮越大越好
```

真实任务还有：

- frequency
- grouping
- expertise
- consequence

---

## 33.8 Graphical Perception

Cleveland & McGill 的经典研究说明：

> 图表编码的可解码精度存在差异。

因此：

```text
Chart Type
```

不能只是视觉风格。

---

## 33.9 Accessibility

WCAG 2.2 对 dragging 等交互提出 alternative 要求。

这意味着：

```text
Representation Capability
```

本身就应该携带 Accessibility Contract。

而不是最后 patch。

---

# 34. Prax 新的因果模型

建议从：

```text
Product-first
→ Representation Decision
→ SDIR
```

升级为：

```text
① Product Intent
         ↓
② User / JTBD
         ↓
③ Product Object Model
         ↓
④ Task Model
         ↓
⑤ Information Shape
         ↓
⑥ Representation Architecture
      Primary + Supporting
         ↓
⑦ Information Architecture
         ↓
⑧ Priority + Disclosure
         ↓
⑨ Interaction Grammar
         ↓
⑩ State Ownership
         ↓
⑪ Visual Hierarchy Intent
         ↓
⑫ Complexity Budget
         ↓
⑬ SDIR
         ↓
⑭ Capability / Runtime Binding
         ↓
⑮ Implementation
         ↓
⑯ Validation
         ↓
⑰ Browser / User Evidence
         ↓
⑱ Evolution Memory
```

---

# 35. Prax 最小必要中间状态

建议结构化：

## Stable / Structural

```text
Product Intent
User / JTBD
Primary Object
Task Structure
Information Shape
Representation Architecture
Priority
Disclosure
Interaction Grammar
State Ownership
Acceptance Contract
Evidence
```

## Semi-structured / Assistive

```text
Visual Hierarchy Intent
Density Intent
Complexity Budget
Alternative Representations
Rejected Alternatives
```

## 不应该结构化到 SDIR

```text
x
y
width
height
CSS class
Tailwind
border-radius
exact color
exact component implementation
```

否则 SDIR 会掉到实现层。

---

# 36. SDIR vNext 示例

```yaml
screen:
  intent: understand_current_project

user_job:
  verb: understand
  target: project_system
  success: identify_core_structure_and_recent_change

primary_object:
  type: system_component

information_shape:
  cardinality: many
  relationality: high
  hierarchy: medium
  temporality: medium
  spatiality: conceptual
  volatility: medium

representation:
  primary:
    type: architecture
    reason: relational_structure

  supporting:
    - search
    - change_timeline
    - semantic_inspector

priority:
  primary:
    - structure
    - critical_path

  contextual:
    - implementation_details
    - source_evidence

interaction:
  preview: hover
  inspect: select
  navigate: open
  locate: search

state_ownership:
  selection: architecture
  inspector: selected_object
  timeline: change_filter

complexity_budget:
  permanent_panels: 1
  permanent_primary_actions: 3

acceptance:
  - primary_path_identifiable
  - selected_object_keeps_context
  - source_evidence_reachable
```

---

# 37. Complexity Budget

每新增 Feature，不应只记录组件。

需要记录它是否新增：

```text
Permanent Surface +1?
Global Action +1?
Mode +1?
State Owner +1?
Navigation Level +1?
Panel +1?
Persistent Filter +1?
New Semantic Concept +1?
Keyboard Contract +1?
Mobile Conflict +1?
```

核心问题：

> 能否复用已有认知 Surface？

---

# 38. Design Evolution Loop

建议 Prax 正式拥有：

```text
Observed User Problem
        ↓
Product Question
        ↓
Primary-source Research
        ↓
Pattern Candidates
        ↓
Borrow / Skip Boundary
        ↓
Design Decision
        ↓
SDIR Delta
        ↓
Implementation
        ↓
Acceptance Contract
        ↓
Browser Evidence
        ↓
Empirical Evidence
        ↓
Evolution Memory
```

这是从 Archify 演进方式中抽象、又被 Figma/Grafana/Sentry 等产品机制进一步验证的部分。

---

# 39. Validation Stack

## 39.1 Deterministic

可程序检查：

```text
primary task 是否存在
primary object 是否存在
representation 是否已决策
relationship target 是否存在
selection 是否有 owner
两个 mode 是否冲突拥有 viewport
critical action 是否被错误隐藏
drag 是否存在 alternative
overflow
contrast
focus order
target size
responsive collision
```

## 39.2 Assistive

模型判断：

```text
Representation 是否适合
第一屏 hierarchy 是否清晰
density 是否匹配用户
Panel 是否喧宾夺主
是否有更简单 IA
产品语言是否一致
```

## 39.3 Empirical

必须真实验证：

```text
Task completion time
Error rate
Time to first understanding
Navigation count
Context loss
Information retrieval accuracy
Mental model accuracy
Expert user speed
Preference
Retention
```

---

# 40. ECP：从产品意图推导，而不是从 Archify 抄 Canvas

ECP 的核心产品意图：

> 让人在 Agent 高速推进项目的情况下，持续理解并掌控项目真实状态、变化与原因。

因此不同 Job 应拥有不同 Representation。

| ECP 用户问题 | Primary Representation |
|---|---|
| 整个系统现在是什么？ | Architecture / System Map |
| Agent 刚改了什么？ | Change Timeline / Delta |
| 有哪些模块？ | List / Table |
| 这个模块是什么？ | Detail Inspector |
| 登录请求怎么流转？ | Sequence / Guided Flow |
| 最近哪里不稳定？ | Status / Metrics |
| 某文件/模块在哪里？ | Search Results |
| 哪些决策还没解决？ | Decision List |
| 这个变化关联到谁？ | Relationship / Reach |
| 项目怎么演进到今天？ | Timeline / Story |
| Agent 最近在做什么？ | Activity Feed |
| 我今天应该关注什么？ | Prioritized Overview |

所以：

```text
Architecture Canvas
```

是 ECP 的关键 Representation，但不能变成整个 ECP 的 universal shell。

---

# 41. ECP 可能的 Representation Architecture

```text
                ECP Cognition Workspace

           ┌──────────┬───────────┐
           │          │           │
      Architecture   Change      Search
           │        Timeline       │
           │          │            │
           └──── Selected Object ──┘
                      │
                  Inspector

            + Decisions
            + Activity
            + Metrics
            + Guided Flows
```

这才是从 Product Intent 推导出的组合。

---

# 42. 为什么 Archify 仍然重要

Archify 对 ECP 不应只理解为：

```text
Renderer dependency
```

更重要是：

```text
Design Evolution Case
+
Technical Representation Benchmark
+
Interaction Grammar Case
+
Validation Case
```

我们的目标：

> 把 Archify 的成功从“别人做好的代码”变成“我们自己拥有的方法与能力”。

---

# 43. 下一阶段：Empirical Frontend Benchmark

当前大样本研究解决：

```text
我们应该研究哪些变量？
哪些模式值得进入 Prax？
```

下一阶段必须建立自己的数据。

建议 Benchmark：

```text
15 User Jobs
×
10 Information Shapes
×
multiple Object Types
```

示例：

```text
manage × structured entities
locate × large collection
compare × multi-attribute items
monitor × volatile metrics
understand × relational graph
understand × temporal change
create × spatial object
edit × document
decide × location-sensitive items
complete × high-consequence workflow
communicate × threaded conversation
learn × interactive concept
explore × multidimensional data
explain × narrative data
troubleshoot × system evidence
```

---

# 44. A/B

同一 Product Brief：

```text
Arm A:
Bare Coding Agent

Arm B:
Same Agent + Prax
```

评价：

```text
Representation Fit
Primary-task salience
Time to understand
Task completion time
Error rate
Context loss
Navigation cost
Information retrieval accuracy
UI surface complexity
Accessibility
Frontend rework
Token cost
Human preference
```

---

# 45. 建议增加 Inter-rater Coding

当前 Wide Corpus 是单研究者编码。

下一阶段应：

```text
同一批页面
 ↓
Researcher / Model A
Researcher / Model B
 ↓
independent coding
 ↓
compare disagreement
```

重点字段：

- JTBD
- Primary Object
- Primary Representation
- Density
- Detail Surface
- Context Retention
- Progressive Disclosure
- State Ownership

这样才能判断我们的 taxonomy 是否足够清晰。

---

# 46. Pattern Saturation

“穷尽所有 Web”不可实现。

应该使用：

```text
Taxonomy
 ↓
Stratified Samples
 ↓
New Pattern Rate
 ↓
Saturation
```

记录：

```text
第 1–30 样本：大量新增模式
31–60：仍有新组合
61–90：新增 Primitive 减少
91–120：主要新增是组合/边界而不是全新 Primitive
```

下一步应继续补覆盖薄弱范式，并记录每 20 个新增样本带来的：

```text
new representation primitive
new composition
new interaction grammar
new disclosure mechanism
new contradiction
```

当这些新增率趋近稳定，再称为“达到当前研究问题的 pattern saturation”。

---

# 47. 当前研究局限

必须明确：

1. Wide Corpus 是目的抽样，不是随机抽样。
2. 当前编码主要由单研究者完成。
3. 部分闭源产品的编码来自公开页面、帮助和设计/工程资料，不是源码。
4. 同一产品存在大量页面，本轮一个“产品样本”常代表一个主任务 surface，而不是整个产品。
5. Hybrid Representation 很难压缩成单一 family，因此频率统计是研究归一化，不是自然绝对分类。
6. 本轮未系统量化：
   - permanent surface count
   - click depth
   - screen area ratio
   - typography metrics
   - color usage proportion
7. 暂未做真实用户任务实验。
8. 没有做不同文化/语言界面的大规模对比。
9. 游戏、电商 checkout、医疗专业系统、工业控制、3D/CAD、无障碍专用应用等仍需要更深入覆盖。
10. 移动 Web / touch-first 不是本轮主样本。

---

# 48. 当前稳定度分级

## A. 当前证据较强

- Backend model 不能直接决定 UI。
- Task alone 不能决定 UI。
- Object alone 不能决定 UI。
- Representation 应由 Task × Object × Information Shape × Interaction Need 共同决定。
- 同一对象经常需要 Representation Portfolio。
- Detail Surface 与 Context Retention 强相关。
- Progressive Disclosure 有 retrieval cost。
- Information Density 必须匹配任务和 expertise。
- 高复杂度工具需要显式 Interaction/State architecture。
- Design System 应包含 semantic pattern/object，而非只有 tokens/components。
- 长期前端质量依赖 Evolution + Validation。

## B. 强趋势，仍需实验

- 高密度专家工具倾向稳定 persistent chrome。
- Panel 是 Canvas/Map/Monitoring 中常见的 context-preserving detail pattern。
- Card Grid 被通用 Agent 明显过度使用。
- AI-native 产品倾向从 chat-only 走向 chat + domain artifact。
- multi-representation switching 是复杂数据产品的重要能力。

## C. 不应写成通用规则

- 左侧导航一定最好。
- Dark mode 更专业。
- 页面最多 N 个 action。
- 固定几个 panel 最好。
- 所有 Canvas 都需要 minimap。
- Progressive Disclosure 越多越好。
- 留白越多越高级。
- 所有时间数据都必须 Timeline。
- 所有关系都必须 Graph。
- Dashboard 是所有管理系统的首页。

---

# 49. 研究资料索引

以下是本轮重点使用或核验的公开来源。闭源产品只使用官方公开资料或真实可核实界面资料，不根据 UI 猜测技术实现。

## Archify

- Repository: https://github.com/tt-a1i/archify
- PRODUCT.md: https://github.com/tt-a1i/archify/blob/main/PRODUCT.md
- DESIGN.md: https://github.com/tt-a1i/archify/blob/main/DESIGN.md
- Semantic Passport research:
  https://github.com/tt-a1i/archify/blob/main/docs/research-visual-evolution-round-17.md
- Semantic Radar:
  https://github.com/tt-a1i/archify/blob/main/docs/research-visual-evolution-round-18.md
- Intent Trace:
  https://github.com/tt-a1i/archify/blob/main/docs/research-visual-evolution-round-19.md
- Reading Depth:
  https://github.com/tt-a1i/archify/blob/main/docs/research-visual-evolution-round-23.md
- Viewer runtime:
  https://github.com/tt-a1i/archify/blob/main/archify/references/viewer-runtime.md

## Penpot

- Repository: https://github.com/penpot/penpot
- AI design prompting:
  https://github.com/penpot/penpot/blob/develop/docs/mcp/good-prompting-practices-design.md
- Design file structure:
  https://github.com/penpot/penpot/blob/develop/docs/mcp/design-file-structure-best-practices.md
- Design tokens:
  https://github.com/penpot/penpot/tree/develop/docs/user-guide/design-systems

## tldraw

- Repository: https://github.com/tldraw/tldraw
- Editor docs:
  https://github.com/tldraw/tldraw/blob/main/apps/docs/content/sdk-features/editor.mdx
- State architecture:
  https://github.com/tldraw/tldraw/blob/main/packages/state/ARCHITECTURE.md

## Excalidraw

- Repository: https://github.com/excalidraw/excalidraw
- Command Palette:
  https://github.com/excalidraw/excalidraw/tree/master/packages/excalidraw/components/CommandPalette

## JupyterLab

- Repository: https://github.com/jupyterlab/jupyterlab
- Commands:
  https://github.com/jupyterlab/jupyterlab/blob/main/docs/source/user/commands.md
- Interface:
  https://github.com/jupyterlab/jupyterlab/blob/main/docs/source/user/interface.md
- Design docs:
  https://github.com/jupyterlab/jupyterlab/tree/main/design

## Grafana

- Repository: https://github.com/grafana/grafana
- Storybook/design system:
  https://github.com/grafana/grafana/blob/main/contribute/style-guides/storybook.md

## Apache Superset

- Repository: https://github.com/apache/superset
- Design guidelines:
  https://github.com/apache/superset/blob/master/docs/developer_docs/guidelines/design-guidelines.md
- Testing:
  https://github.com/apache/superset/blob/master/docs/developer_docs/testing/overview.md

## PostHog

- Repository: https://github.com/PostHog/posthog
- Quill/design-system material:
  https://github.com/PostHog/posthog/tree/master/packages/quill

## Sentry

- Repository: https://github.com/getsentry/sentry
- Core components:
  https://github.com/getsentry/sentry/tree/master/static/app/components/core

## Figma

- UI3 design:
  https://www.figma.com/blog/our-approach-to-designing-ui3/
- Behind UI3:
  https://www.figma.com/blog/behind-our-redesign-ui3/
- Pattern Library:
  https://www.figma.com/blog/figma-pattern-library/

## TradingView

- Watchlist minimal mode:
  https://www.tradingview.com/blog/en/minimalistic-display-mode-for-watchlist-41721/
- Chart view/table documentation:
  https://www.tradingview.com/support/solutions/43000724233-chart-view-mode/
- Multi-chart layouts:
  https://www.tradingview.com/blog/en/new-chart-layout-patterns-45487/

## Our World in Data

- Redesigning interactive data visualizations:
  https://ourworldindata.org/redesigning-our-interactive-data-visualizations
- Example Grapher:
  https://ourworldindata.org/grapher/population-with-un-projections

## GOV.UK

- Tabs:
  https://design-system.service.gov.uk/components/tabs/
- Data dashboards:
  https://brand.design-system.service.gov.uk/data/dashboards/

## GitLab Pajamas

- Navigation / Objects:
  https://design.gitlab.com/get-started/navigating-pajamas/
- Table:
  https://design.gitlab.com/components/table/

## AWS Cloudscape

- Resource management view:
  https://cloudscape.design/patterns/resource-management/view/

## Carbon

- Grid / layout:
  https://carbondesignsystem.com/elements/2x-grid/usage/

## WCAG

- WCAG 2.2:
  https://www.w3.org/TR/WCAG22/
- Dragging Movements:
  https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html

## HCI / Visualization

- Furnas, Generalized Fisheye Views:
  https://doi.org/10.1145/22627.22342
- Cleveland & McGill, Graphical Perception:
  https://doi.org/10.1080/01621459.1984.10478080
- Cowan, working-memory capacity:
  https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/magical-number-4-in-shortterm-memory-a-reconsideration-of-mental-storage-capacity/44023F1147D4A1D44BDC0AD226838496

---

# 50. Appendix A — 120 个 Wide Corpus 样本矩阵

> 说明：这是当前研究工作表的精简版本。`Primary Representation` 可包含 hybrid 表达；前文 family 统计采用额外的 dominant-job 归一化编码，不是简单按该字符串自动分类。

| # | 范式 | 产品/页面 | Primary JTBD | Primary Object | Primary Representation | Supporting | 密度 | 详情 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 搜索/信息检索 | Google Search | locate / decide | information result | Search Results | filters / snippets | medium | page |
| 2 | 搜索/信息检索 | Bing Search | locate / decide | information result | Search Results | filters / rich answers | medium | page |
| 3 | 搜索/信息检索 | Kagi | locate / decide | information result | Search Results | ranking controls | medium | page |
| 4 | 搜索/信息检索 | Perplexity | explore / learn / decide | answer + sources | Conversation / Answer | sources / follow-up | medium | inline/page |
| 5 | 搜索/信息检索 | Wikipedia Search | locate | article | Search Results | suggestions | low | page |
| 6 | 搜索/信息检索 | Stack Overflow Search | locate / troubleshoot | question / answer | List / Search Results | filters / tags | high | page |
| 7 | 内容/媒体/出版 | Wikipedia Article | learn / reference | document | Document | TOC / references | medium | inline/page |
| 8 | 内容/媒体/出版 | Medium | read / learn | article | Document | author / related | low | page |
| 9 | 内容/媒体/出版 | Substack | read / follow | newsletter post | Document | subscription / archive | low | page |
| 10 | 内容/媒体/出版 | BBC News | scan / read | story | Document / News Listing | related stories | medium | page |
| 11 | 内容/媒体/出版 | Our World in Data | learn / explain / compare | dataset + narrative | Document / Chart | table / map / source | medium | inline |
| 12 | 内容/媒体/出版 | NYT Interactive | explain / explore | story + data | Interactive Story | charts / scroll narrative | medium | inline |
| 13 | 电商/商品决策 | Amazon | discover / compare / transact | product | Grid / List | filters / compare / detail | high | page |
| 14 | 电商/商品决策 | eBay | discover / compare / transact | listing | Grid / List | filters / auction detail | high | page |
| 15 | 电商/商品决策 | Etsy | discover / decide / transact | product | Grid | filters / image detail | medium | page |
| 16 | 电商/商品决策 | Apple Store | decide / transact | product | Document / Product Detail | comparison / configurator | low | page |
| 17 | 电商/商品决策 | IKEA | discover / decide | product | Grid | filters / room inspiration | medium | page |
| 18 | 电商/商品决策 | Shopify Admin | manage / edit / compare | product | Table / List | filters / bulk actions | high | page/panel |
| 19 | 旅行/地图/本地 | Airbnb | locate / compare / decide | stay + location | List + Map | filters / detail | high | page/panel |
| 20 | 旅行/地图/本地 | Booking.com | compare / decide / transact | hotel | List | filters / map / detail | high | page |
| 21 | 旅行/地图/本地 | Google Maps | locate / navigate / decide | location | Map | search / list / panel | high | panel |
| 22 | 旅行/地图/本地 | AllTrails | locate / decide | trail | Map + List | filters / elevation | medium | page/panel |
| 23 | 旅行/地图/本地 | Tripadvisor | compare / decide | place | List / Cards | filters / reviews | high | page |
| 24 | 旅行/地图/本地 | Yelp | locate / decide | business | List + Map | filters / reviews | high | page/panel |
| 25 | 金融/支付/投资 | Stripe Dashboard | monitor / troubleshoot / transact | payment / account object | Dashboard / Table | search / detail | high | page/panel |
| 26 | 金融/支付/投资 | Wise | transact / monitor | transfer | Workflow / Form | status / account | medium | page |
| 27 | 金融/支付/投资 | Robinhood | monitor / decide / transact | asset | Chart / Object Detail | watchlist / order | high | page |
| 28 | 金融/支付/投资 | TradingView | monitor / compare / analyze | market series | Chart | table / watchlist / multi-chart | high | panel |
| 29 | 金融/支付/投资 | Coinbase Advanced | monitor / decide / transact | market + order | Chart / Orderbook | forms / positions | high | panel |
| 30 | 金融/支付/投资 | OpenBB | analyze / compare | financial dataset | Dashboard / Table | charts / commands | high | page/panel |
| 31 | 社交/社区/论坛 | Reddit | scan / communicate | post / thread | Feed | comments / communities | high | page |
| 32 | 社交/社区/论坛 | Discord Web | communicate / monitor | conversation / channel | Conversation / Multi-pane | members / search | high | panel |
| 33 | 社交/社区/论坛 | LinkedIn | scan / communicate / decide | person / post / job | Feed | search / detail | high | page |
| 34 | 社交/社区/论坛 | X | scan / communicate | post / thread | Feed | search / detail | high | page |
| 35 | 社交/社区/论坛 | GitHub Discussions | communicate / troubleshoot | discussion | List + Thread | filters / labels | medium | page |
| 36 | 社交/社区/论坛 | Stack Overflow | troubleshoot / learn | Q&A | Document / Thread | tags / related | high | page |
| 37 | 视频/音频/流媒体 | YouTube | discover / consume | video | Media Grid | search / recommendations | medium | page |
| 38 | 视频/音频/流媒体 | Spotify Web | discover / consume | track / playlist | Media Library | sidebar / player | medium | page |
| 39 | 视频/音频/流媒体 | Netflix Web | discover / consume | show / movie | Media Grid | detail preview | low | overlay/page |
| 40 | 视频/音频/流媒体 | Twitch | discover / consume / communicate | stream | Media + Chat | directory / chat | high | page |
| 41 | 视频/音频/流媒体 | SoundCloud | discover / consume | track | Feed / Media List | waveform / comments | medium | page |
| 42 | 视频/音频/流媒体 | Vimeo | discover / consume | video | Media Grid | showcase / detail | low | page |
| 43 | 教育/学习 | Khan Academy | learn / practice | lesson / exercise | Document + Exercise | progress / hints | medium | page |
| 44 | 教育/学习 | Brilliant | learn / manipulate | concept / problem | Interactive Learning | stepwise feedback | medium | inline |
| 45 | 教育/学习 | Duolingo Web | learn / practice | exercise | Workflow / Interactive | progress / feedback | low | inline |
| 46 | 教育/学习 | Coursera | learn / navigate | course / lesson | Document / Course Outline | progress / video | medium | page |
| 47 | 教育/学习 | Desmos | explore / learn / create | mathematical object | Canvas / Graph | expression list | high | panel |
| 48 | 教育/学习 | GeoGebra | explore / learn / create | geometric object | Canvas | algebra panel / tools | high | panel |
| 49 | 政府/公共服务 | GOV.UK | complete / learn | service / guidance | Document / Form | task steps | low | page |
| 50 | 政府/公共服务 | USWDS examples | complete / navigate | public service task | Form / Workflow | step indicator / alerts | medium | page |
| 51 | 政府/公共服务 | USA.gov | locate / learn | public information | Document / Directory | search | low | page |
| 52 | 政府/公共服务 | Data.gov | locate / analyze | dataset | List / Search Results | filters / metadata | high | page |
| 53 | 政府/公共服务 | Healthcare.gov | decide / complete | plan / application | Workflow / Form | comparison / eligibility | medium | page |
| 54 | 政府/公共服务 | UK Planning Portal | locate / complete | application / guidance | Document / Workflow | search / forms | medium | page |
| 55 | 创作/设计/编辑器 | Figma | create / edit / collaborate | design object | Canvas / Editor | layers / inspector / toolbar | high | panel |
| 56 | 创作/设计/编辑器 | Penpot | create / edit / collaborate | design object | Canvas / Editor | layers / inspector | high | panel |
| 57 | 创作/设计/编辑器 | Canva | create / edit | design asset | Canvas / Editor | templates / asset panel | high | panel |
| 58 | 创作/设计/编辑器 | Excalidraw | create / explain | drawing object | Canvas | toolbar / command palette | medium | inline/panel |
| 59 | 创作/设计/编辑器 | tldraw | create / edit / embed | canvas shape | Canvas | toolbar / stateful tools | medium | panel |
| 60 | 创作/设计/编辑器 | Photopea | create / edit | image / layer | Canvas / Editor | layers / tools / menus | high | panel |
| 61 | 开发者工具/IDE/代码 | GitHub Pull Request | review / compare / decide | change set | Comparison / Diff | files / comments / checks | high | page |
| 62 | 开发者工具/IDE/代码 | VS Code Web | create / edit / troubleshoot | code / file | Code Editor | tree / panels / command palette | high | panel |
| 63 | 开发者工具/IDE/代码 | StackBlitz | create / run | code project | Code Editor | preview / terminal / files | high | panel |
| 64 | 开发者工具/IDE/代码 | CodeSandbox | create / run | code project | Code Editor | preview / files / console | high | panel |
| 65 | 开发者工具/IDE/代码 | Replit | create / run / agentic build | code project / artifact | Code + Preview + Chat | files / console | high | panel |
| 66 | 开发者工具/IDE/代码 | Vercel | deploy / monitor / troubleshoot | deployment | List / Dashboard | logs / analytics / detail | high | page/panel |
| 67 | BI/监控/分析 | Grafana | monitor / troubleshoot | metric / panel | Dashboard | time series / table / drilldown | high | panel |
| 68 | BI/监控/分析 | Apache Superset | analyze / explore | dataset / chart | Dashboard / Chart | filters / table | high | page/panel |
| 69 | BI/监控/分析 | Metabase | analyze / ask | question / dataset | Dashboard / Chart | table / filters | medium | page |
| 70 | BI/监控/分析 | Sentry | troubleshoot / monitor | issue / event | List + Detail | timeline / trace / tags | high | page/panel |
| 71 | BI/监控/分析 | PostHog | analyze / monitor | event / insight | Dashboard / Chart | table / filters / SQL | high | page/panel |
| 72 | BI/监控/分析 | Datadog | monitor / troubleshoot | metric / event | Dashboard | logs / traces / service map | high | page/panel |
| 73 | 项目/协作/知识 | Linear | manage / triage | issue / project | List / Board | detail panel / command | high | panel |
| 74 | 项目/协作/知识 | Notion | create / organize / manage | document / database object | Document / Database View | table / board / timeline / calendar | medium | page/panel |
| 75 | 项目/协作/知识 | Asana | manage / coordinate | task | List / Board | timeline / detail | high | panel |
| 76 | 项目/协作/知识 | Trello | manage / coordinate | card / task | Board | detail modal / filters | medium | modal |
| 77 | 项目/协作/知识 | Plane | manage / coordinate | issue / project | List / Board | cycles / modules | high | page/panel |
| 78 | 项目/协作/知识 | Outline | read / create / organize | document | Document | tree / search | medium | page |
| 79 | CRM/ERP/Admin | Salesforce | manage / operate | record | List / Record Detail | filters / actions | high | page |
| 80 | CRM/ERP/Admin | HubSpot | manage / operate | contact / deal | Table / Pipeline | detail / activity | high | page/panel |
| 81 | CRM/ERP/Admin | Twenty | manage | record | Table / Object Detail | filters / relations | high | page/panel |
| 82 | CRM/ERP/Admin | Appsmith | build / manage internal app | widget / data source | Canvas / Builder | properties / queries | high | panel |
| 83 | CRM/ERP/Admin | Retool | build / operate | app component / resource | Canvas / Builder | properties / state / query | high | panel |
| 84 | CRM/ERP/Admin | Directus | manage content/data | collection item | Table / Form | filters / relational detail | high | page |
| 85 | 表单/流程/审批 | Typeform | complete | question / response | Form / Step Flow | progress | low | inline |
| 86 | 表单/流程/审批 | Tally | create / complete | form block | Document-like Form | block editor | low | inline |
| 87 | 表单/流程/审批 | Google Forms | create / complete | question / response | Form | sections / validation | low | page |
| 88 | 表单/流程/审批 | Airtable Forms | complete | record | Form | conditional fields | low | page |
| 89 | 表单/流程/审批 | GOV.UK Task List | complete / track | service step | Task List | status / forms | medium | page |
| 90 | 表单/流程/审批 | ServiceNow | complete / approve | request / ticket | Workflow / Record | forms / state | high | page |
| 91 | AI-native | ChatGPT | ask / create / analyze | conversation + artifact | Conversation | attachments / tools / artifacts | medium | inline |
| 92 | AI-native | Claude | ask / create / analyze | conversation + artifact | Conversation | artifacts / files | medium | inline |
| 93 | AI-native | Perplexity Research | research / learn | answer + evidence | Conversation / Research Report | sources / follow-ups | medium | page |
| 94 | AI-native | v0 | create frontend | conversation + UI artifact | Chat + Preview | code / versions | medium | panel |
| 95 | AI-native | Lovable | create app | conversation + app artifact | Chat + Preview | code / deploy | medium | panel |
| 96 | AI-native | Replit Agent | create app | conversation + code artifact | Chat + Code + Preview | files / console | high | panel |
| 97 | 文档/API/知识站 | Stripe Docs | learn / implement | API concept | Document | nav / code examples | medium | page |
| 98 | 文档/API/知识站 | MDN | learn / reference | web API / concept | Document | TOC / examples | medium | page |
| 99 | 文档/API/知识站 | GitHub Docs | learn / troubleshoot | product concept | Document | nav / search | medium | page |
| 100 | 文档/API/知识站 | Vercel Docs | learn / implement | product concept | Document | nav / examples | medium | page |
| 101 | 文档/API/知识站 | Read the Docs | learn / reference | documentation | Document | tree / search | medium | page |
| 102 | 文档/API/知识站 | Docusaurus sites | learn / reference | documentation | Document | sidebar / TOC | medium | page |
| 103 | 空间/图谱/复杂关系 | Mapbox Studio | create / style / locate | map layer | Map / Canvas | layers / style panel | high | panel |
| 104 | 空间/图谱/复杂关系 | Archify | understand / explain | system relationship | Graph / Diagram | search / passport / radar / story | high | panel |
| 105 | 空间/图谱/复杂关系 | Structurizr | understand / explain | software architecture | Diagram | views / metadata | medium | page/panel |
| 106 | 空间/图谱/复杂关系 | LikeC4 | understand / explain | software architecture | Diagram | details / views | medium | panel |
| 107 | 空间/图谱/复杂关系 | Miro | create / collaborate / explain | canvas object | Canvas | toolbars / side panels | high | panel |
| 108 | 空间/图谱/复杂关系 | React Flow examples | create / manipulate relations | node graph | Graph / Canvas | controls / minimap | medium | panel |
| 109 | 品牌/叙事/数据故事 | Apple Product Pages | explain / persuade | product story | Document / Scrollytelling | media / transitions | low | inline |
| 110 | 品牌/叙事/数据故事 | Stripe Marketing | explain / persuade | product capability | Document / Marketing | interactive demos | low | inline |
| 111 | 品牌/叙事/数据故事 | Linear Marketing | explain / persuade | product capability | Document / Marketing | motion / product UI | low | inline |
| 112 | 品牌/叙事/数据故事 | Vercel Marketing | explain / persuade | platform capability | Document / Marketing | code / demos | low | inline |
| 113 | 品牌/叙事/数据故事 | NASA Interactive | explain / explore | scientific story | Interactive Story | map / media / scroll | medium | inline |
| 114 | 品牌/叙事/数据故事 | OWID Story | explain / learn | data narrative | Document / Data Story | chart / map | medium | inline |
| 115 | 招聘/房产/本地决策 | LinkedIn Jobs | locate / compare / decide | job | List + Detail | filters / company detail | high | panel |
| 116 | 招聘/房产/本地决策 | Indeed | locate / compare / decide | job | List + Detail | filters / apply | high | panel |
| 117 | 招聘/房产/本地决策 | Zillow | locate / compare / decide | property | Map + List | filters / detail | high | panel/page |
| 118 | 招聘/房产/本地决策 | Autotrader | compare / decide | vehicle | List / Cards | filters / comparison | high | page |
| 119 | 招聘/房产/本地决策 | OpenTable | locate / decide / transact | restaurant / time slot | List / Search Results | filters / map / booking | medium | page |
| 120 | 招聘/房产/本地决策 | Yelp Local | locate / decide | business | List + Map | reviews / filters | high | page/panel |


---

# 51. Appendix B — 建议 Prax 建立的知识资产

未来不应只积累：

```text
Button
Card
Table
Form
```

而应建立：

## Product Object Assets

```text
Issue
Deployment
Model Provider
User
Project
Dataset
Metric
Location
Conversation
Change
Decision
```

## Representation Assets

```text
Table
Map
Timeline
Architecture
Graph
Document
Feed
Canvas
Search Result
```

## Composition Assets

```text
List + Detail
List + Map
Chart + Table
Canvas + Inspector
Document + TOC
Chat + Artifact
Graph + Passport
```

## Interaction Pattern Assets

```text
Temporary Preview
Durable Focus
Selection Inspector
Command Palette
Direct Manipulation
Guided Story
Reach/Trace
Reading Depth
Peek
Drilldown
```

## Validation Assets

```text
representation fit
context preservation
state ownership
accessibility
density
hierarchy
regression
browser evidence
```

---

# 52. Appendix C — Prax 研究工作原则

后续任何“优秀前端样本”进入 Prax 前，都应回答：

1. 用户是谁？
2. 此刻最主要 Job 是什么？
3. Primary Object 是什么？
4. 信息形态是什么？
5. 为什么当前 Representation 合适？
6. Supporting Representation 为什么存在？
7. 哪些 UI 常驻？为什么？
8. 哪些按需出现？为什么？
9. Detail 为什么是 Page/Panel/Inline/Modal？
10. 哪些状态由谁拥有？
11. 产品复杂度被怎样压缩，而不是简单隐藏？
12. Visual hierarchy 如何服务任务？
13. Motion 是否表达状态/方向/连续性？
14. 哪些设计只是该品牌风格，不能泛化？
15. 哪些模式经过多个不同范式验证？
16. 有什么反例？
17. 有什么 acceptance contract？
18. 有真实 browser / user evidence 吗？

---

# 53. 最终研究判断

我们不应该建设：

> “优秀 UI 长什么样”的模板库。

应该建设：

> **“为什么这个产品在这个任务下应该这样表达”的 Frontend Product Intelligence。**

当前最接近本质的临时公式是：

```text
Product Intent
     ×
User Job
     ×
Product Object
     ×
Information Shape
     ×
Interaction Need
     ×
Context / Risk / Expertise
              ↓
     Representation Architecture
              ↓
 Information Architecture
              ↓
 Interaction Grammar
              ↓
      Visual Hierarchy
              ↓
      Implementation
              ↓
         Evidence
```

Prax 的竞争力不应该是“能生成漂亮页面”，而应该是：

> **让 Agent 能够先建立正确的 Product Mental Model，再选择正确的 Representation、信息结构与交互语法，最后才进入前端实现；并通过可验证的证据持续演进而不越做越乱。**

这也是我们未来真正能自己掌控、而不是等待别人先做出来再复用的前端能力。
