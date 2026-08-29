# 从“超级 Prompt”到 Prax

## 六类复杂前端案例对 Product/UI Context Layer 的启示、问题诊断与架构建议

**文档性质**：Prax 设计研究综合稿 / 后续架构与 A/B Benchmark 输入  
**日期**：2026-08-26  
**结论级别**：架构方向建议，不替代当前 v0 Implementation Spec；用于解释为什么需要扩展、扩展什么、哪些边界不能突破。

---

## 执行摘要

这次分析的起点并不是研究“怎样写一个更强的前端 Prompt”，而是反过来观察一个现象：为了让 Coding Agent 真正做对复杂 UI/UX，人正在被迫编写数百到上千行的“超级 Prompt”。这些 Prompt 不只是需求说明，它们往往同时包含产品定位、用户任务、设计语言、数据契约、领域对象、状态机、因果关系、运行时状态、失败处理、响应式规则、可访问性、测试接口、历史错误和验收标准。

六类案例虽然形态差异极大，却共同指向同一个问题：**Coding Agent 缺少的主要不是 CSS、React 或 Three.js 知识，而是一层稳定、结构化、可持续读取和验证的 Product/UI Context。** 当这层上下文不存在时，人只能把脑中的产品认知、设计判断和历史经验“编译”为超长 Prompt，再一次性灌给 Agent。

对 Prax 最重要的结论不是把这些 Prompt 的全部字段复制进一个巨大 Schema，而是：

1. **Prax 的定位应从“前端设计 MCP”收敛为 Coding Agent 的 Product/UI Context Runtime。**它负责让 Agent 在实现之前理解这个具体产品“是什么、为什么这样、哪些事实不能被破坏”，并在实现过程中按任务提供恰到好处的上下文。
2. **前端只是 Product Truth 的人可感知投影。**不同产品的 Truth 不同：可能是参考视觉、数据与来源、机械因果、运行时实体、数学模型，或者需要用户形成的概念理解。
3. **Product Frame 仍应保持小而稳定，但其后需要一组按项目类型启用的 Context Modules。**这些模块不应全部塞进 SDIR，也不应全部成为 MCP tools。
4. **SDIR 的现有边界应继续保持：它记录设计意图、角色、重要性、关系、可见性等语义承诺，而不是像素、CSS、JSX 或确定性编译指令。**复杂产品需要更多上下文制品，但不意味着把 SDIR 膨胀成万能 IR。
5. **Truth 与 Representation 必须分离。**“数据是什么”和“怎么画”、“物理模型是什么”和“怎么做 Bloom”、“论文事实是什么”和“教学示意怎么画”不能混为一层。
6. **Relationship 应成为一等公民。**复杂 UI 最容易出错的往往不是单个组件，而是对象之间、状态之间、组件之间、数据与结论之间、视觉连线之间的关系。
7. **Validation 必须成为 Product Context 的组成部分，而不是写完代码后的附属 QA。**优秀 Prompt 已经在用 DOM 几何、SVG BBox、稳定截图模式、真实用户操作序列、数据口径检查等方式把“好不好”转换成可验证条件。
8. **Human Review 应转化为可追溯的 Failure Memory。**“这条线没有意义”“这里又错一格”“DEMO 不能伪装 LIVE”不应只存在于聊天记录，而应沉淀为项目级 correction/regression，再根据重复性和证据决定是否晋升为通用规则。
9. **Prax 的关键技术能力应是 Context Compilation，而不是 Context Dump。**同一产品的 News Wire、Canvas、Settings、Shader 调参需要的上下文完全不同。Prax 应按任务路由 Product Truth、Design Intelligence、决策和验收要求。
10. **这六个 Prompt 可以形成一套非常有价值的 Prax Benchmark Corpus。**它们分别测试 Visual、Information、Behavioral、Runtime、Computational、Explanation 六类 fidelity，能比 Landing Page 更真实地验证 Prax 是否真的提高 Agent 的产品理解与前端质量。

一句话概括：

> **Prax 应帮助 Coding Agent 先获得“这个产品的真实世界模型”，再把其中与当前任务相关的部分编译成实现上下文；UI 代码只是这个模型在具体平台上的一次实现。**

---

# 1. 背景：为什么要分析这些 Prompt

## 1.1 Prax 最初要解决的问题

Prax 的出发点是一个在 Agent 开发中反复出现的问题：Coding Agent 很容易从后端能力、API、数据库实体和“现在能写什么代码”出发组织 UI，而不是先从用户任务、产品对象、信息结构和使用心智出发。

典型路径是：

```text
Backend / API / Database
        ↓
Agent 理解系统能力
        ↓
把 capability 直接映射成导航、页面、表单和按钮
        ↓
功能存在，但产品难用、结构后端化、心智模型错误
```

Prax 当前 v0 已经明确用 Product Framing Gate、Backend Quarantine、Design Context、Design Decision、SDIR、Capability Reconciliation 和 Validation 去阻止这一问题。这个方向是正确的。

但这批复杂 Prompt 暴露出一个新的问题：**Product Framing 解决了“从谁的角度开始思考”，却还不足以承载复杂产品中决定 UI 正确性的全部项目事实。**

例如：

- 一个精确复刻任务需要“视觉和几何真相”；
- 一个数据叙事页面需要“数据来源、口径和缺失状态”；
- 一个机械模拟器需要“领域对象、因果关系和不变量”；
- 一个交易终端需要“跨组件焦点、LIVE/STALE/DEMO 和工作区持久化”；
- 一个黑洞渲染器需要“数值模型、派生状态、质量与性能权衡”；
- 一个论文教学页需要“概念依赖、教学顺序、事实与示意的边界”。

这些内容不能简单归结为“更多 UI 规则”。

## 1.2 超级 Prompt 是一个症状

这些 Prompt 长达数百到上千行，不是因为作者喜欢写长文，而是因为如果不把这些内容写出来，Agent 往往会自己补空白，而复杂前端最危险的恰恰就是“合理但错误的补空白”。

超级 Prompt 的真实结构通常是：

```text
Product Intent
+ User Task
+ Domain / Data Truth
+ Information Architecture
+ Visual Grammar
+ Interaction / State Machine
+ Runtime / Failure Rules
+ Historical Corrections
+ Acceptance Tests
= 一次性 Product Context 包
```

因此应把它理解为一种“人肉 Product Context Compiler”的产物，而不是普通 Prompt Engineering。

问题不在于“怎样把 1000 行压缩成 200 行”，而在于：

> **怎样让这些知识不再必须以一次性自然语言巨文存在，而能成为项目中的结构化、可查询、可演进、可验证制品。**

---

# 2. 分析方法：六类案例分别测试了什么

这次选取的案例具有明显互补性，不是六份相似的 UI Prompt。

| 案例 | 产品类型 | 主要 Truth | 最容易出现的 Agent 错误 |
|---|---|---|---|
| ASIC V8 | 精确视觉/交互复刻 | Visual Truth | “参考风格”变成重新设计；几何、密度、数量漂移 |
| Shipping Visualization | 数据叙事与研究报告 | Information Truth | 猜数据、补缺口、把示意当事实、叙事失真 |
| THE IMPACT Typewriter | 领域模拟与复杂交互 | Behavioral Truth | 只做表面动画，不建立机械因果和状态不变量 |
| Global Market Terminal | 专业工作区与实时监控 | Runtime / Workspace Truth | Widget 孤岛、LIVE/DEMO 混淆、布局/状态生命周期混乱 |
| GARGANTUA | 科学计算与实时可视化 | Computational Truth | 做“长得像”的效果，而不真正遵循模型 |
| Attention Residuals | 技术解释与可执行教程 | Explanation Truth | 图看起来正确，但概念关系、教学顺序或证据边界错误 |

这六种 Truth 并不互斥。真实产品往往同时包含两到三种，但把它们分开有助于看清 Prax 需要承载的不同上下文类型。

---

# 3. 案例一：ASIC V8 —— Visual Truth、失败记忆与可执行验收

## 3.1 这个 Prompt 实际在做什么

ASIC V8 Prompt 表面是“复刻一个网页”，实际上是把一个既有产品的可观察体验编译成极强的实现协议。它不仅给颜色和 CSS，还明确：

- 什么是最高优先级错误，哪些失败绝不能再次出现；
- 主内容、正文和宽图分别应该多宽；
- Dashboard 的定位、Canvas 的坐标和分辨率处理；
- 章节数量、图表数量、quote 数量、事件数量等 cardinality；
- 数据 K-register 的唯一事实来源；
- 页面总高度和信息密度；
- 浏览器里必须实际测量的 geometry；
- 哪些视觉模式被明确禁止；
- 最终必须跑浏览器验证，而不能只“看代码觉得对”。

它事实上等价于：

```text
Product Spec
+ Design Spec
+ Data Contract
+ Regression Corpus
+ Acceptance Test Spec
```

## 3.2 对 Prax 的启发

### A. “正确”必须可被观察

“像原版”“专业”“高信息密度”都不够。高价值规则应尽量编译成可观察事实，例如：

- bounding box；
- position；
- count；
- viewport；
- page height；
- element visibility；
- fixed / sticky；
- interaction state。

Prax 的 Validation 不应只输出审美意见，而应尽可能把可判定部分转成 deterministic evidence。

### B. Human Review 可以变成 Failure Memory

大量“不得再次出现”的条目说明这个 Prompt 不是一次生成的，而像是经历多轮失败后把人工反馈永久固化。

这给 Prax 一个直接闭环：

```text
Human Review
→ 识别失败类型
→ 记录 correction
→ 生成项目级 regression rule
→ 下次 Agent 自动获得
→ 自动验证是否复发
```

### C. Cardinality 是完整性的低成本代理

“19 section / 26 charts / 9 quotes”这类约束虽然粗糙，却非常有效地阻止 Agent 交一个“看起来差不多，但少了一半内容”的结果。

Prax 的 Acceptance Contract 应支持：

- required_count；
- required_state；
- required_region；
- required_interaction；
- forbidden_extra。

### D. 视觉 fidelity 不只是颜色和间距，还包括密度与滚动叙事

页面总高度、文字宽度和图表密度都属于体验。Prax 不应把“visual fidelity”缩成 token diff。

## 3.3 不应照搬的部分

ASIC Prompt 的问题也很明显：大量项目级历史补丁、CSS 常量、业务内容、数据、测试和实现建议混在一起，接近 Prompt Overload。

Prax 不应把这种 1400 行结构原样变成一个统一 Schema。正确方向是拆分事实来源和生命周期，并通过 Context Compiler 只给当前任务所需部分。

---

# 4. 案例二：Shipping Visualization —— 数据契约、叙事模型和证据完整性

## 4.1 最关键的结构：先归一化数据，再渲染

这个 Prompt 不是让页面直接读取用户文件，而是要求先把 JSON、Markdown、CSV、XLSX 等材料解析成统一的 `window.DATA`，再由页面消费。

其意义不在 JavaScript 变量名，而在于建立了一层 Intermediate Representation：

```text
Raw Research Data
      ↓
Normalize / Interpret
      ↓
Semantic Data Contract
      ↓
Charts / Narrative / Interaction
```

数据字段不是纯数值，而包含：

- basis；
- source；
- as-of；
- metric definition；
- stage；
- signal；
- falsifier；
- limitation；
- gap register。

因此这已经接近一个面向数据叙事的 DSL。

## 4.2 对 Prax 的启发

### A. Data Truth 必须有 provenance

一个数字不是 `42.1`，而应理解为：

```text
value
+ unit
+ basis
+ source
+ as_of
+ evidence_status
```

这对研究型 UI、监控 UI、报告 UI 都成立。

### B. Missing Data 本身也是产品事实

Prompt 明确禁止把披露点插值成连续线，并要求缺口可见。

这代表一个很重要的 Product Invariant：

> Unknown ≠ Zero；Missing ≠ Interpolatable。

Prax 应允许数据/信息上下文表达 unknown、missing、unverified、incompatible，而不是只表达“有值”。

### C. Narrative 是一种结构，不是文案排列

十三个区块构成认知顺序：现在在哪 → 历史怎么发生 → 企业怎么出清 → 利润如何传导 → 历史是否可类比 → 当前阶段 → 未来监控什么 → 数据有什么缺口。

这说明一些前端产品存在独立的 Narrative Model：

```text
question
→ evidence
→ comparison
→ mechanism
→ conclusion
→ monitoring
```

### D. 视觉资产也可以是声明式 Primitive

像素船用字符矩阵生成，不依赖图片。其价值不是“像素风”，而是把视觉资产变成可复现、可版本化的程序性定义。

## 4.3 对 Prax 的直接扩展

需要一个可选的 **Data & Evidence Context Module**，承载：

- data contract；
- provenance；
- gap / missingness；
- metric definition；
- derived calculation rules；
- evidence / illustration status；
- narrative relation。

它不应进入所有项目的 Product Frame，只在数据密集产品里被 context routing 激活。

---

# 5. 案例三：THE IMPACT Typewriter —— Domain Model、因果链与 Mental Model 一致性

## 5.1 它不是在描述“长什么样”，而是在定义“这个对象是什么”

这个 Prompt 把机械打字机拆成：

- 机架；
- 键盘；
- 键杆；
- 连杆；
- 字杆；
- 字篮；
- 逃逸机构；
- 滑架；
- 色带；
- 纸张。

更重要的是，它规定了这些对象之间如何因果连接。

一次击键不是“按键下沉 + 页面出现字符”，而是：

```text
Key
→ Key Lever
→ Linkage
→ Typebar
→ Ribbon Vibrator
→ Impact
→ Escapement
→ Carriage
→ Document State
```

因此它真正建立的是 Domain / Causal Model。

## 5.2 状态机与产品不变量

Prompt 进一步明确：

- 每页 44 行、每行 72 格；
- 第 66 列响铃；
- 72 列后拒绝字符；
- Backspace 只退滑架，不删除墨迹；
- 再输入形成 overstrike；
- pageFull 后禁止继续输入；
- explodeCurrent 超过阈值时禁止打字；
- Unicode 是“现代适配器”，不是历史机械能力。

这些不是 UI 行为偏好，而是 Domain Invariants。

## 5.3 对 Prax 的启发

### A. Product Object 不只需要名字，还需要关系和规则

当前 Product Framing 中已有 `product_objects` 和 `relationships`，但复杂产品需要允许进一步引用可选领域制品：

```text
Domain Object
├── role
├── properties
├── relationships
├── invariants
├── actions
├── events
└── derived state
```

### B. UI 应与 Domain Mental Model 一致

“拆解后不能打字”“Backspace 不擦除字迹”“Unicode 作为 contemporary adapter”都是优秀产品设计，因为功能没有破坏世界观。

Prax 在设计评审时应该能问：

> 当前交互是否与用户建立的产品世界模型一致？

### C. Event Vocabulary 是强大的跨层契约

`keyTravel / linkage / impact / escapement / bell / changed / structure` 使动画、声音、文稿、UI 反馈可以围绕同一领域事件协作。

Prax 可以把“事件”和“状态转移”作为 Behavior Context 的结构，而不是把所有东西归为 button click。

### D. Deterministic Imperfection

纸张墨迹可以有 jitter，但必须可复现。这说明“随机表现”也可以被产品契约约束：视觉自然感不能破坏状态稳定性和测试可复现性。

---

# 6. 案例四：Global Market Terminal —— Workspace、跨组件联动和运行时真实性

## 6.1 这不是 Dashboard，而是 Workspace

这个 Prompt 的关键不是 Bloomberg 风格，而是：

- Widget 可拖动、缩放、删除、恢复、锁定；
- VIEW 与 EDIT LAYOUT 分离；
- 布局可保存；
- 用户有 GLOBAL / EQUITIES / METALS / NEWS 等 preset；
- 同一资产选择联动 Heatmap、Chart、News、Inspector；
- 页面可以长期打开并持续变化。

因此它的核心对象变成：

```text
Workspace
├── Widget
├── Entity
├── Layout
├── Focus
├── Filter
├── Inspector
├── Data Feed
└── Persistence
```

## 6.2 对 Prax 的启发

### A. Cross-component Relationship 必须显式

复杂工具最容易出现“每个组件都正常，但整体不像一个产品”的问题。

需要表达：

```text
selected_asset
  ├→ heatmap highlight
  ├→ price chart
  ├→ related news
  └→ inspector
```

这不是组件规范，而是跨组件 Interaction Contract。

### B. 数据还有 Runtime Epistemic State

LIVE、STALE、DEMO、UNKNOWN 是数据的一部分，而不是 UI badge。

一个报价对象应带：

```text
value
source
as_of
timezone
freshness
mode
latency
error
```

### C. Persistent User State 与 Runtime State 必须分开

布局、时区、筛选偏好属于长期用户状态；行情和新闻属于瞬时运行态。改变 data mode 不能覆盖用户布局。

Prax 的 Runtime Context 应帮助 Agent区分：

- persistent preference；
- session state；
- derived state；
- external live state。

### D. Partial Failure 是正式产品状态

某个 adapter 失败不应拖垮整页。每个 Widget 都可能处于 live / stale / demo / error / unavailable。

### E. Information Density 是产品策略，不是风格错误

交易终端明确需要高密度。这个案例再次证明“更多留白”“更大的卡片”不是普适的 Good UI。密度需要根据用户角色和任务确定，并通过分组、对齐、层级和语义色变得可读。

---

# 7. 案例五：GARGANTUA —— Underlying Model、计算真实性与可观测性

## 7.1 最关键的约束：不能做“看起来像”

这个 Prompt 明确禁止：

- 黑球 + 平面圆环；
- GIF / 视频 / 截图；
- 静态星空；
- 与物理模型无关的表面伪装。

要求真正通过 Schwarzschild null geodesic、吸积盘交叉、Doppler、gravitational redshift 等得到画面。

这意味着产品的 Truth 是一套 Underlying Computational Model。

```text
Physical Model
→ Numerical Integration
→ Derived State
→ Ray Result
→ Visual Representation
```

## 7.2 对 Prax 的启发

### A. 一些 UI 背后存在决定一切的不可见模型

这类模型可能是：

- physics model；
- financial model；
- simulation；
- graph algorithm；
- layout engine；
- optimization model。

Prax 不需要理解所有数学，但需要允许项目上下文声明：

> UI 的哪些结果必须由哪个 underlying model 推导，而不能用视觉捷径替代。

### B. Model State 与 Representation 必须分层

Bloom、ACES、grain 是表现层；null geodesic 是模型层。把两者混合会让 Agent 用表现层“修”模型错误。

### C. Quality / Performance 是正式 Trade-off Contract

STANDARD / HIGH / CINEMATIC 同时影响步骤数、DPR 和性能。系统可以提示降档，但不能偷偷替用户改档。

### D. Debug View 是 Observability Plane

steps heatmap、crossing radius、minR、crossing count 等 debug view 不是装饰，它们把计算过程暴露为可检查状态。

复杂前端尤其适合让 Prax 记录：

- observable internal state；
- debug mode；
- test fixture；
- readiness signal。

### E. Testability 可以是产品能力

`?shot`、稳定若干帧、停止 RAF、发出 `SHOT_OK` 这类接口说明产品主动为自动化验证设计，而不是让测试工具猜什么时候“差不多稳定”。

这是 Agent 时代非常值得推广的原则。

---

# 8. 案例六：Attention Residuals —— Explanation Model、语义几何和事实/示意边界

## 8.1 真正的输出不是“页面”，而是用户形成正确 Mental Model

这个页面从标准残差的深度稀释，逐步讲到 Full AttnRes、Block AttnRes、两阶段推理和实验效果。

核心不是把论文分章节排版，而是控制学习路径：

```text
Problem
→ Mechanism
→ Alternative
→ Scalable Form
→ Efficient Implementation
→ Evidence
```

因此它需要独立的 Explanation Model。

## 8.2 Semantic Geometry

Prompt 特别纠正 Layer 与 `f_i` 错位，并要求节点和连线使用共享坐标函数。

这里的关键不是“不要有 5px 偏差”，而是：

> **几何必须忠实投影语义关系。**

Layer 3 连接到 `f_4`，哪怕画面再整齐都是错误。

## 8.3 Visual Relationship Contract

Prompt 要求所有长线都有 source、target、direction 和 label；装饰性曲线删除；leader 不能伪装成数据路径。

这可以抽象成：

```text
Edge
├── source
├── target
├── semantic_type
├── direction
├── condition
└── label
```

对于 Canvas、架构图、流程图、技术教学图，这比“stroke-width 是多少”重要得多。

## 8.4 事实与示意必须分开

Prompt 明确区分：

- paper-reported facts；
- manually generated teaching weights；
- qualitative illustrative curves。

这要求 Product Context 存在 Evidence Status，例如：

```text
measured
reported
derived
illustrative
synthetic
demo
```

## 8.5 Existing Implementation 不是 Truth

这份 Prompt 明确说参考源码有已知问题，必须按更高优先级校正规则修复，而不是机械复制。

因此正确模型是：

```text
Product Intent
+ Evidence
+ Existing Implementation
+ Known Defects
+ Human Corrections
= Current Product Truth
```

这条结论对 Prax 非常关键：不能把现状自动抽取后就当规范。

## 8.6 Async Temporal Integrity

播放器用 generation token 防止 reset 前的异步任务回写新状态。这揭示一个通用问题：

> 异步结果只能作用于产生它的那一代状态。

这不仅适用于动画，也适用于搜索、AI generation、autocomplete、live query 和预览。

---

# 9. 六个案例共同揭示的核心规律

## 9.1 UI 是 Product Truth 的投影

六个案例可以分别概括为：

```text
Visual Truth
Information Truth
Behavioral Truth
Runtime / Workspace Truth
Computational Truth
Explanation Truth
        ↓
      UI / UX
```

这并不是要给每个项目贴标签，而是在提醒：

> **在开始实现之前，必须先问“这个 UI 正在代表什么真相？”**

如果 Agent 不知道答案，它就会用视觉和代码自行补全。

## 9.2 Truth 与 Representation 必须分离

典型对应：

| Truth | Representation |
|---|---|
| Schwarzschild 模型 | Bloom / ACES / HUD |
| 数据及来源 | Chart / Tooltip / Card |
| 机械因果 | Three.js 动画 / 音效 |
| LIVE/STALE 状态 | Badge / Color / Label |
| 论文事实 | 教学热力图 / 动画 |
| 参考产品结构 | CSS / Canvas 几何实现 |

Prax 应把“什么是真的”和“如何表现”作为不同的 Context 层处理。

## 9.3 Relationship 往往比 Component 更重要

复杂产品中的关键错误大量发生在：

- node → edge；
- source → metric → conclusion；
- object → action → state；
- selected entity → multiple widgets；
- model state → derived state → feedback；
- concept → explanation step。

组件库可以告诉 Agent“按钮怎么做”，但无法告诉它“为什么这个按钮应该影响这三个区域”。

## 9.4 State 需要被进一步区分

六个案例共同说明“state”不是一个平面概念。至少应区分：

- **User State**：选择、输入、布局偏好；
- **Domain State**：pageFull、exploded、selected part；
- **Runtime State**：loading、live、stale、error；
- **Derived State**：market open、minR、breadth summary；
- **Temporal State**：cinematic time、playback generation；
- **Evidence State**：measured / illustrative / demo / unknown。

这不意味着 Product Frame 要包含所有字段，而意味着可选上下文制品必须能表达它们。

## 9.5 响应式的目标是保持语义，不是保持像素

Typewriter、Attention 和 Workspace 都明确反对“把桌面缩小到手机”。

正确原则是：

```text
Same Product Meaning
        ↓
Different Spatial Realization
```

这与 SDIR “同一语义，多平台忠实实现”的定位一致。

## 9.6 Failure / Degradation 属于产品模型

产品不是只有 happy path：

- WebGL 不可用；
- HalfFloat 不支持；
- live API 失败；
- holiday 未验证；
- pageFull；
- machine exploded；
- data missing。

这些都需要用户可理解的状态和恢复路径。

## 9.7 Testability 可以被设计

优秀 Prompt 不只是列“请测试”，而是在产品中主动创造可测试条件：

- DOM geometry；
- SVG `getBBox()`；
- deterministic demo；
- shot mode；
- stable ready signal；
- exact state count；
- reproducible pseudo-random；
- explicit user action sequence。

这意味着可测试性应被视为 Product/Implementation Contract 的一部分。

## 9.8 Human Review 应形成 Failure Memory，而不是聊天历史

人的价值不应只体现在“发现这次错了”，而应体现在“系统下一次不再重复同类错”。

Failure Memory 的目标不是把每次意见升级成通用原则，而是建立分层：

```text
Local Correction
→ Project Regression Rule
→ Repeated Evidence
→ Candidate Pattern / Rule
→ Design Intelligence Review
```

这样既能学习，又避免把单个项目偏好错误泛化。

---

# 10. 对 Prax 定位的修正

## 10.1 推荐定义

> **Prax 是 Coding Agent 的 Product/UI Context Runtime。它把用户意图、产品对象、关系、项目事实、交互行为、视觉语义、运行时状态、设计决策和验收标准组织成可查询、可演进、可验证的 Product Context，并按当前开发任务编译出恰到好处的实现上下文。**

这里有三个关键词：

### Runtime

Prax 不是静态知识库。它需要管理 session、gate、decision、artifact、correction 和 validation evidence。

### Product/UI Context

它不是完整产品管理系统，也不是后端建模系统。它只关注那些会决定用户看到什么、怎样操作、怎样理解的产品事实。

### Compile

Agent 不应每次得到所有知识，而是得到当前任务需要的那部分。

## 10.2 Design Intelligence 与 Prax 的边界

两者不要混在一起。

**Design Intelligence** 回答：

> 一个优秀的 Design Agent 一般应该知道什么？

包括：principles、heuristics、patterns、platform conventions、accessibility、evidence、design knowledge governance。

**Prax** 回答：

> 这个具体产品现在是什么？当前任务应该遵守哪些项目事实和设计承诺？

因此正确关系是：

```text
General Design Knowledge
   Design Intelligence
          │
          ▼
   ┌───────────────┐
   │     Prax      │ ← Requirement / Existing Product / Human Decisions
   │ Product Truth │
   └───────┬───────┘
           │
           ▼
    Context Compiler
           │
           ▼
      Coding Agent
```

## 10.3 SDIR 的边界不要改变

这些案例证明需要更多上下文，但不证明 SDIR 应该包含所有东西。

SDIR 仍然应回答：

- 这个 screen / region 的 intent 是什么；
- role 是什么；
- importance 如何；
- visibility 如何；
- semantic relationship 是什么；
- density / spatial intent 是什么。

而下列内容应存在于其他 Context Artifact 中：

- raw data schema；
- 物理方程；
- 机械完整状态机；
- 具体 CSS 坐标；
- live adapter 配置；
- 测试脚本实现。

SDIR 是语义设计承诺层，不是万能项目 IR。

---

# 11. 推荐架构：Core Product Frame + Context Modules + SDIR

## 11.1 整体流程

```text
User Requirement / Existing Product / Research / Human Feedback
                         │
                         ▼
                 1. Product Framing
                         │
                         ▼
                 2. Context Profiling
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
     Project Context Modules   Design Intelligence
             │                 scoped knowledge
             └───────────┬───────────┘
                         ▼
                 3. Design Decisions
                         │
                         ▼
                     4. SDIR
                         │
                         ▼
              5. Capability Reconcile
                         │
                         ▼
              6. Implementation Brief
                         │
                         ▼
                    Coding Agent
                         │
                         ▼
                 Runtime Evidence
                         │
                         ▼
                    7. Validate
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
         PASS / Handoff        Correction / Failure Memory
                                      │
                                      └──────→ Product Context
```

这不是要重写现有 v0 流程，而是在 Product Framing 与 Design Decision 之间把 `design_context` 从“页面上下文”扩展为“按需的项目上下文集合”。

## 11.2 Core Product Frame 继续保持小

所有项目都应该有：

```yaml
product_frame:
  user:
    primary_role: ...
    expertise: ...
  goal:
    primary: ...
  tasks:
    primary: ...
    secondary: []
  product_objects: []
  relationships: []
  mental_model_hypothesis: ...
  primary_success_definition: ...
  open_questions: []
```

不要因为案例复杂，就把 300 个字段塞进 Product Frame。

## 11.3 新增 Context Manifest

建议增加一个很小的路由制品，描述这个产品“需要理解哪些 Truth”：

```yaml
context_manifest:
  product_archetypes:
    - professional_workspace
    - realtime_monitoring

  truth_domains:
    - information
    - runtime
    - workspace

  active_modules:
    - data_evidence
    - workspace_runtime
    - cross_component_relationships

  validation_profiles:
    - data_truth
    - persistence
    - workspace_geometry
    - semantic_conformance
```

Manifest 不保存大量内容，只决定该加载哪些制品。

---

# 12. 推荐的可选 Context Modules

下面不是要求 v0 一次实现全部，而是从六个案例中抽象出的长期模块边界。

## 12.1 Visual Fidelity Module

**适用**：复刻、Golden Screen、已有成熟产品重构。

内容：

- reference observations；
- geometry constraints；
- visual invariants；
- cardinality；
- density targets；
- known visual defects；
- regression checks。

关键原则：参考实现不是 Truth 本身，必须允许 correction/supersedes。

## 12.2 Data & Evidence Module

**适用**：研究报告、Dashboard、市场数据、分析工具。

内容：

- normalized data contract；
- metric definitions；
- source / as-of；
- missingness；
- compatibility；
- derived calculation；
- evidence status；
- narrative dependency。

## 12.3 Domain & Behavior Module

**适用**：复杂编辑器、模拟器、业务流程工具、具有明确领域规则的产品。

内容：

- domain objects；
- causal relationships；
- actions；
- events；
- invariants；
- state transitions；
- feedback mapping。

## 12.4 Workspace & Runtime Module

**适用**：IDE、监控台、数据工作台、Canvas、长期运行工具。

内容：

- widgets / regions；
- global selection；
- cross-widget relationships；
- layout state；
- persistent preference；
- live / stale / demo / error；
- partial failure；
- inspector contract。

## 12.5 Underlying / Computational Model Module

**适用**：科学可视化、仿真、图形算法、金融/工程模型。

内容：

- model identity；
- required inputs；
- equations / rules / algorithm references；
- derived state；
- model invariants；
- approximation boundaries；
- quality/performance tradeoff；
- observable debug state。

Prax 不需要执行模型，只需要知道哪些 UI 结果必须由模型产生、哪些捷径是不允许的。

## 12.6 Explanation / Narrative Module

**适用**：技术科普、架构演示、算法教学、交互式教程。

内容：

- learning goal；
- concept dependencies；
- reveal order；
- explanation steps；
- visual relationships；
- evidence vs illustration；
- completion definition。

其最终成功标准不是“动画跑完”，而是“用户能形成正确 Mental Model”。

## 12.7 Cross-cutting Contracts

有些内容不属于单一模块，应横切：

- **Temporal Contract**：playback、generation、cancellation、stable state；
- **Spatial Contract**：workspace、viewpoint、semantic geometry；
- **Failure / Degradation Contract**：unavailable、fallback、recovery；
- **Observability / Automation Contract**：debug view、test fixture、ready signal；
- **Accessibility Contract**：input modes、focus、reduced motion、fallback；
- **Acceptance Contract**：当前 Context 需要哪些验证。

---

# 13. Context Compiler：Prax 最值得形成差异化的能力

## 13.1 为什么不能 Context Dump

一个真实项目最终可能拥有几十份 Context Artifact。如果每次都发送给 Agent，就会重现超级 Prompt 的问题，只是从 Markdown 换成 YAML。

Prax 的价值在于：

> **先建立完整、可维护的项目 Truth，再按当前任务编译最小高信号上下文。**

## 13.2 示例：Market Terminal 的 News Wire 任务

Agent 正在实现 News Wire 时，不需要知道全部 Market Pulse 节假日算法和 Metals 比率公式。

Context Compiler 应得到类似：

```text
TASK
News Wire implementation

PRODUCT INTENT
长期监控；把新闻与行情变化连接起来

ENTITY CONTRACT
news_item / ticker / source / timestamp

INTERACTION
filter / search / pause / unread / click → Inspector

CROSS-COMPONENT
news related tickers ↔ focusedAsset

RUNTIME
LIVE / STALE / DEMO；不得虚构新闻

VISUAL
terminal dense / mono / hard borders

ACCEPTANCE
DEMO clearly labeled
filter correct
Inspector opens
no fabricated source
mobile drawer works
```

这才是“Agent 真正需要的上下文”。

## 13.3 与现有 Progressive Disclosure 的关系

现有 v0 的 Design Intelligence progressive disclosure 解决“不要把所有设计知识给 Agent”。

Context Compiler 进一步解决：

> **不要把所有项目事实也给 Agent。**

两者应该共享相同哲学：先 scope，再 disclose。

---

# 14. Truth / Representation Contract

建议在 Context 层增加一组横切元数据，不需要做成一个复杂知识系统。

例如：

```yaml
truth_record:
  id: metric.gpqa_delta
  kind: reported_fact
  value: 7.5
  source_ref: paper_result
  as_of: 2026-03
  confidence: high

representation:
  kind: stat_card
  may_transform: false
```

教学示意则可能是：

```yaml
truth_record:
  id: figure5_gradient_trend
  kind: qualitative_report
  statement: gradients become substantially more uniform with depth

representation:
  kind: illustrative_curve
  numeric_fidelity: false
  must_label_as_illustrative: true
```

这样 Agent 才不会把“示意图”在实现过程中悄悄升级成“事实数据”。

推荐最小枚举：

```text
measured
reported
derived
illustrative
synthetic_demo
stale
unknown
unverified
incompatible
```

它们不必全部互斥，可以根据数据类型设计更精确的字段。

---

# 15. Relationship 应成为 Prax 的核心语义之一

当前研究已经指出 role / importance / visibility / relationship 是现有 tokens、组件库和 pattern 库的公共空白。这六个案例再次验证了这一点。

建议 Prax 的关系至少能表达：

```yaml
relationship:
  source: ...
  target: ...
  type: data_flow | controls | derives | selects | explains | contains | depends_on | causal
  direction: forward | bidirectional | none
  condition: ...
  meaning: ...
  importance: primary | supporting
```

对于视觉连线，还可以在实现/validation artifact 中补：

```yaml
visual_edge:
  relationship_ref: rel_023
  must_show_direction: true
  label_required: true
  endpoint_semantics: boundary_to_boundary
```

注意：后者不一定属于 SDIR。SDIR 保存“有一条什么语义关系”，几何如何绘制由平台/实现和 validation 决定。

---

# 16. Validation：从“最后检查”变成“与设计并行的契约”

## 16.1 保留当前 V1–V4 架构，但增加 Context-routed facets

现有 v0 将 Validation 分为 deterministic、semantic conformance、heuristic/visual、product evidence，这是合理骨架，不必推翻。

复杂案例提示我们在每层内部按 Context 选择不同 facet：

### Deterministic Facets

- schema；
- count；
- geometry；
- overflow；
- state coverage；
- forbidden dependency；
- deterministic data fixture；
- persistence；
- console / 404。

### Semantic Conformance Facets

- relationship 是否保留；
- dominant task 是否仍 dominant；
- visual edge 是否表达正确 source/target；
- interaction 是否符合 domain invariant；
- reference correction 是否已覆盖旧实现。

### Epistemic / Data Facets

- DEMO 是否冒充 LIVE；
- missing 是否被插值；
- incompatible source 是否被混算；
- illustrative 是否被标成 measured；
- source/as-of 是否完整。

### Behavioral / Runtime Facets

- state transition；
- reset/cancellation；
- partial failure；
- user preference persistence；
- mode switching；
- fallback / recovery。

### Computational Facets（只在相关项目启用）

- required model path 是否真实执行；
- debug state 是否来自内部真实变量；
- quality profile 是否改变正确参数；
- numerical failure 是否有降级。

### Heuristic / Visual Facets

继续保持 assistive，不伪装 deterministic。

### Product Evidence

任务成功率、时间、真实用户反馈仍然不能由 Agent 自评替代。

## 16.2 Acceptance Contract 与 Design Contract 同等级

实现 brief 不应只说“要做什么”，还应该说“怎样证明做对了”。

例如：

```yaml
acceptance:
  semantic:
    - selected_asset_drives_inspector
  deterministic:
    - no_horizontal_overflow
    - widgets_do_not_overlap
  runtime:
    - demo_fallback_visible
  evidence:
    - source_and_asof_present
  manual_review:
    - information_density_is_scannable
```

---

# 17. Failure Memory：让人工评审真正积累能力

## 17.1 为什么需要单独设计

ASIC 和 Attention 两份 Prompt 都明显带有多轮修订痕迹。真正有价值的不是“规则很多”，而是它们证明人工评审可以被转化为回归资产。

## 17.2 推荐生命周期

```text
Human Finding
      ↓
Classification
      ↓
Is this:
  implementation bug?
  project correction?
  product invariant?
  reusable pattern?
  general design rule?
      ↓
Project Regression
      ↓
Repeated Evidence / Review
      ↓
Optional Promotion to Design Intelligence
```

## 17.3 Project-local 与 General Knowledge 必须隔离

例如：

“ASIC Dashboard 必须 460px”是项目事实，不是通用设计原则。

“有方向的数据流连线应明确 source/target，不能用无语义装饰线冒充”则可能在多个架构/教学图项目中重复出现，才有资格成为更高层 Pattern/Rule 候选。

## 17.4 推荐 correction artifact

```yaml
correction:
  id: corr-svg-edge-004
  scope: attention-residuals/sec4
  problem: cache-to-softmax path looked like an unexplained U-shape
  intended_semantics: shared K/V read
  decision: replace with short dashed directed edge + label
  regression_check: edge_has_label_and_direction
  supersedes: implementation.v1
  promotion_candidate: true
```

这比在 Prompt 里写“绝对不要再出现 U 形线”更可维护。

---

# 18. 对 MCP/API 设计的影响：不要因为模型变丰富就暴增 Tools

这些案例很容易诱导我们新增：

```text
get_domain_model
get_runtime_model
get_explanation_model
get_visual_model
get_data_model
...
```

不建议这样做。

当前 v0“少量高层工具 + 显式 session + artifact”的方向更好。

推荐：

- `design_frame` 继续负责 Core Product Frame；
- `design_context` 生成/更新 `context_manifest` 并声明需要哪些 module；
- Context Artifacts 由 session store 持久化；
- `design_route / design_inspect` 同时可以路由 Design Intelligence 与已存在的 project context；
- `design_decide` 记录跨模块权衡；
- `design_sdir` 只生成语义设计层；
- `design_validate` 根据 manifest 自动选择 validation facets；
- human correction 可以作为 `design_validate` / review 结果的一类 artifact 回流，而不一定新增独立 tool。

如果未来确实需要新增 Tool，也应证明它代表一个独立 workflow gate，而不是一个文件读取便利函数。

---

# 19. 六类 Prompt 作为 Prax Benchmark Suite

## 19.1 为什么它们比 Landing Page 更有价值

Landing Page 主要测试视觉表现和文案构图，无法覆盖 Prax 最有价值的能力：产品对象、复杂状态、数据真实性、跨组件关系和系统行为。

这六类案例刚好形成六个互补维度。

## 19.2 建议 Benchmark Categories

### B1 — Visual Fidelity

来源：ASIC 类任务。

测量：

- geometry mismatch；
- count completeness；
- hierarchy / density；
- human visual correction rounds；
- regression recurrence。

### B2 — Information Fidelity

来源：Shipping 类任务。

测量：

- provenance completeness；
- missing-data violations；
- unsupported interpolation；
- narrative correctness；
- source / as-of coverage。

### B3 — Behavioral Fidelity

来源：Typewriter 类任务。

测量：

- state machine violations；
- invariant violations；
- causal chain fidelity；
- mode / recovery correctness；
- interaction test pass rate。

### B4 — Workspace Coherence

来源：Market Terminal 类任务。

测量：

- cross-widget consistency；
- layout persistence；
- partial failure isolation；
- LIVE/STALE/DEMO correctness；
- user-layout preservation。

### B5 — Computational Fidelity

来源：GARGANTUA 类任务。

测量：

- forbidden visual shortcuts；
- model-output fidelity；
- debug observability；
- quality/performance contract；
- stable automation state。

### B6 — Explanation Fidelity

来源：Attention Residuals 类任务。

测量：

- semantic edge correctness；
- concept ordering；
- fact/illustration labeling；
- animation generation race；
- user mental-model review。

## 19.3 A/B 方法

保持现有 Prax 思路：

```text
Same Agent
Same Requirement
Same Runtime / Tools
        │
   ┌────┴────┐
   ▼         ▼
Bare       Prax
Agent      Agent
   │         │
   ▼         ▼
Result A   Result B
   └────┬────┘
        ▼
Same Review Protocol
```

“Prax 版本看起来更漂亮”不是成功标准。

应该继续记录：

- Product Framing corrections；
- backend-driven UI leaks；
- missing states；
- semantic relationship errors；
- unsupported facts；
- user-requested revision rounds；
- acceptance failures；
- unrecorded design decisions；
- capability gaps silently ignored vs explicitly resolved。

## 19.4 不需要一次实现六个 Full Benchmark

建议分层：

- **Fixture**：小规模抽取核心风险，便于 CI 和协议测试；
- **Golden Case**：有完整 requirement/context/decision/SDIR/reference/review；
- **Full Challenge**：只有少数真正做完整前端 A/B。

当前 Architecture Canvas 仍然适合作为 v0 第一个 Full Challenge；这六类 Prompt 更适合作为后续 Benchmark Taxonomy 和 Golden Case 来源。

---

# 20. 对当前 Prax v0 的具体影响

## 20.1 不需要推翻的部分

当前 v0 中下列方向被这批案例进一步验证：

- Product Framing 必须先于实现；
- Backend Quarantine；
- explicit session state；
- Design Intelligence progressive disclosure；
- Design Decisions 持久化；
- SDIR 保持 semantic；
- Capability Reconciliation；
- implementation-ready packet；
- context-routed validation；
- A/B Benchmark 测量设计过程，而不只看截图。

这些都应保留。

## 20.2 建议 P0 增补

### P0-1 Context Manifest

让 Prax 显式知道当前产品需要哪些 Truth / Modules / Validation Profiles。

### P0-2 First-class Relationship

增强 Product Frame / SDIR 中 relationship 的语义类型和方向，特别服务 Architecture Canvas。

### P0-3 Truth / Representation Metadata

先做最小版，至少支持：fact / derived / illustrative / demo / unknown，以及 source/as-of。

### P0-4 Acceptance Contract

让 implementation brief 同时引用一个 context-routed acceptance artifact。

### P0-5 Correction / Regression Artifact

允许 human review 形成项目级“已知错误 → 正确意图 → 回归检查”。

### P0-6 Benchmark Taxonomy

把现有 Architecture Canvas benchmark 放进更大的 Fidelity 分类里，为后续扩展预留统一评审字段。

## 20.3 建议 P1

- Data & Evidence Module；
- Domain & Behavior Module；
- Workspace & Runtime Module；
- Explanation Module 的最小 schema；
- Context Compiler 对 project artifact 的按任务披露；
- validation facet routing。

## 20.4 建议 P2

- Underlying / Computational Model Module；
- browser evidence ingestion；
- stable screenshot/test fixture convention；
- failure memory promotion workflow；
- 六类 Golden Case corpus；
- 更完整的 cross-agent handoff。

---

# 21. 明确不应该做什么

这批 Prompt 很容易把 Prax 引向过度设计，因此下面这些边界同样重要。

## 21.1 不做万能巨大 Schema

不能要求每个项目同时填写 physics、workspace、data、narrative、domain 等所有字段。

正确方式是 Core + Optional Modules。

## 21.2 不把 SDIR 变成第二份 JSX/CSS

像素、flex/grid、颜色和具体组件实现继续留在 platform / implementation 层。

## 21.3 不做确定性 Product Model → Code 编译器

案例已经证明大量设计决策依赖情境裁量。Prax 的职责是让裁量显式、有依据、可验证，不是假装把设计自动编译掉。

## 21.4 不从 Backend 自动生成 Product Model

这仍然是 Prax 最需要防止的问题之一。

## 21.5 不把所有人工意见升级成通用规则

项目事实、个人偏好、局部修复和通用原则必须有不同生命周期。

## 21.6 不把“更漂亮”作为主要目标

复杂产品的正确性可能是：

- 更高信息密度；
- 更准确的因果关系；
- 更严格的 provenance；
- 更真实的模型；
- 更少的误导；
- 更好的错误恢复。

这些不一定对应“更像 Dribbble”。

## 21.7 不建立大量低层 MCP tools

Prax 是 workflow/runtime，不是一个 UI utility toolbox。

---

# 22. 最终答案：问题是什么、我们做了什么、得到什么答案

## 22.1 问题是什么

Coding Agent 在复杂前端开发中经常缺失一层产品理解：它知道代码、框架、组件和后端能力，却不知道“这个具体产品为什么存在、用户如何理解它、哪些关系和事实决定 UI 是否正确”。

为了补这个缺口，人不得不手工编写超级 Prompt，把产品认知、视觉判断、领域规则、数据口径、状态机、历史失败和验收条件全部一次性写进去。

这种方法有效，但不可扩展：

- token 成本高；
- 维护困难；
- 规则冲突；
- 历史补丁不断堆积；
- 项目知识不能稳定跨 Agent 复用；
- 人工 review 无法自动变成下一次的能力。

## 22.2 我们做了什么

我们把六种高度不同的复杂 Prompt 放在一起，不去比较它们的视觉风格，而是分析“为了让 Agent 做对，人究竟被迫显式写出了哪些知识”。

结果发现六种核心 Truth：

1. Visual Truth；
2. Information Truth；
3. Behavioral Truth；
4. Runtime / Workspace Truth；
5. Computational Truth；
6. Explanation Truth。

同时反复出现八类横切要求：

- relationship；
- state；
- provenance / evidence；
- temporal causality；
- failure / degradation；
- responsive semantic preservation；
- observability / testability；
- human correction / regression memory。

## 22.3 答案是什么

答案不是把这六类 Prompt 合并成一份更大的 Prompt，也不是把所有字段塞进 SDIR。

推荐答案是：

> **把 Prax 建成 Coding Agent 的 Product/UI Context Runtime。**

具体来说：

1. Core Product Frame 保持小而稳定；
2. 用 Context Manifest 识别当前产品需要哪些 Truth；
3. 用可选 Context Modules 承载数据、领域、workspace、计算、解释等项目特有事实；
4. Design Intelligence 继续提供通用原则/heuristic/pattern，而不是项目事实；
5. 用 Context Compiler 按当前任务把项目 Truth + Design Knowledge + Decisions + Acceptance 编译成最小高信号上下文；
6. SDIR 只记录设计语义承诺，不承担所有项目模型；
7. Validation 与实现契约同时生成，并按 Context 路由；
8. Human Review 进入 Correction / Regression Memory，逐步形成项目经验；
9. 只有经过重复验证的项目经验才晋升到 Design Intelligence；
10. 用六类 Fidelity Benchmark 验证 Prax 是否真的让 Agent 更懂产品，而不是只生成更多文档。

---

# 23. 推荐的 Prax 长期概念模型

```text
                        ┌──────────────────────────┐
                        │   Design Intelligence    │
                        │ Principles / Heuristics  │
                        │ Patterns / Platform      │
                        └────────────┬─────────────┘
                                     │ scoped knowledge
                                     ▼
┌─────────────────┐        ┌──────────────────────────┐
│ Human / Product │───────▶│           Prax           │
│ Requirement     │        │  Product/UI Context RT   │
└─────────────────┘        ├──────────────────────────┤
                           │ Core Product Frame       │
┌─────────────────┐        │ Context Manifest         │
│ Existing UI /   │───────▶│ Optional Context Modules │
│ Research / Data │        │ Decisions / Corrections  │
└─────────────────┘        │ SDIR / Acceptance        │
                           └────────────┬─────────────┘
                                      │
                               Context Compiler
                                      │
                                      ▼
                               ┌──────────────┐
                               │ Coding Agent │
                               └──────┬───────┘
                                      │
                                      ▼
                               Implementation
                                      │
                                      ▼
                              Runtime Evidence
                                      │
                                      ▼
                                 Validation
                                      │
                       ┌──────────────┴──────────────┐
                       ▼                             ▼
                     PASS                   Human / Agent Finding
                                                     │
                                                     ▼
                                            Correction / Regression
                                                     │
                                                     └──────→ Prax
```

这张图表达的核心不是多几个文件，而是一个闭环：

> **产品事实被显式化 → Agent 按需消费 → 实现产生运行证据 → 验证事实是否被保留 → 人工修正进入可复用记忆。**

---

# 24. 可以直接进入下一轮 Prax 设计/开发的决策清单

1. **确认 Prax 的正式定位用语**：从 Design MCP 收敛为 Product/UI Context Runtime（对外名字仍可保持 Prax）。
2. **保留现有 v0 gate，不重写协议主流程。**
3. **给 `design_context` 增加 `context_manifest` 概念。**
4. **增强 Product Object Relationship schema。**
5. **定义最小 Truth/Evidence Status。**
6. **新增项目级 Correction / Regression Artifact。**
7. **让 implementation brief 引用 Acceptance Contract。**
8. **把 Architecture Canvas 作为 B1/B6 混合型 Golden Case：重点测试关系、语义几何、context preservation。**
9. **后续新增 Data/Log Explorer 时主动验证 Data & Evidence / Workspace Runtime 两类 Context。**
10. **暂时不要实现全部 Optional Modules；先通过 Golden Cases 证明哪些字段真的会被 Agent 使用。**
11. **每次 Benchmark 都观察“Prax 是否迫使 Agent 提出更好的产品问题”，而不仅是最终截图差异。**
12. **凡是人类反复纠正的错误，都要求判断：它是 bug、项目 correction、pattern 还是 universal rule；禁止只留在对话里。**

---

# 附录 A：六类案例的“Truth → Context → Validation”映射

| 案例 | Truth | 建议 Context | 典型 Validation |
|---|---|---|---|
| ASIC | Visual | Visual Fidelity / Correction | geometry、count、page height、browser screenshot |
| Shipping | Information | Data & Evidence / Narrative | provenance、gap、no interpolation、source/as-of |
| Typewriter | Behavioral | Domain & Behavior | state transition、invariant、causal sequence、real interaction |
| Market Terminal | Runtime / Workspace | Workspace & Runtime | cross-widget sync、persistence、fallback、layout collision |
| GARGANTUA | Computational | Underlying Model / Observability | model path、debug state、quality profile、stable shot |
| Attention | Explanation | Explanation / Visual Relationship | concept sequence、edge semantics、evidence label、BBox、async generation |

---

# 附录 B：与当前 Prax/Design Intelligence 的关系

这份综合结论不要求推翻当前研究成果，反而与其中几条核心判断一致：

- Design Intelligence 应服务 Agent 的通用设计判断，而不是变成具体项目 UI 的事实库；
- SDIR 的价值是语义化设计决策记录和 Agent 推理脚手架，不是确定性 UI 编译器；
- Product Framing 必须先于后端能力映射；
- knowledge 和 validation 都应 context-routed；
- progressive disclosure 是必要机制；
- “professional tool 可以高密度，但密度必须结构化”应继续作为重要产品宪法；
- 真实用户证据不能被 Agent 自评替代。

这次 Prompt 分析新增的核心，不是另一套理论，而是**来自复杂真实任务的项目级证据**：Product Context 需要比最小 Product Frame 更丰富，但应以可选模块和 Context Compilation 的方式扩展，而不是让 SDIR 或 Prompt 无限膨胀。

---

# 附录 C：来源范围

本文件综合依据本次对以下六类用户提供 Prompt 的逐项分析：

1. ASIC V8 精确复刻 Prompt；
2. Shipping 数据叙事 / Scrollytelling Prompt；
3. THE IMPACT No. 01 机械打字机 Prompt；
4. Bloomberg Terminal × ASCII 全球市场工作台 Prompt；
5. GARGANTUA Schwarzschild Black Hole Raytracer Prompt；
6. Attention Residuals 技术讲解 Prompt。

并与当前 Prax / Systemsmith Design MCP v0 Implementation Spec、Design Intelligence 的 SDIR 可行性与架构研究结论进行对照，用于判断哪些是已有方向的验证、哪些是需要新增的 Context 能力。
