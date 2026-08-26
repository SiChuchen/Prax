# D3 · Universal Design Principles（通用设计原则层）草案

- 交付物：D3｜版本：v0.1 草案｜日期：2026-08-25
- 定位：给 AI Coding/Design Agent 消费的结构化知识初稿，供设计判断、设计评审与生成时自检调用；姊妹文档 D4 承载 heuristic / convention / pattern 层。
- 输入：dim01–dim05 研究简报、跨维度洞察与交叉验证报告；来源一律以 Source Registry 全局 ID 标注（[Nxxx]=标准/原始论文，[Axxx]=HCI canon/同行评审研究，[Bxxx]=平台级规范，[Cxxx]=产品级系统/厂商数据）。
- 条目计数：29 条，分 8 域。

## 0. 方法论说明

本层只收录同时满足四条的命题：① technology-independent——陈述本身不绑定任何平台、框架或特定年代交互范式，ISO 9241-110 对"原则"的自我定位（"independent of situations of use, application, environment or technology"）是本层的规范参照 [N045]；② 有标准级（N）或 canon/原始研究级（A）证据，且每条知识显式区分 scientific/empirical model、design heuristic、platform convention 与 internet myth 四种性质；③ 可陈述为可判断命题——能写出 applies_when 与 does_not_apply_when，写不出反适用条件的候选不收录；④ 不是另一条原则的换皮——同根源的表述合并为一个条目并注明共同认知根源。

筛选的操作测试是"可还原性"：能还原到人类认知/知觉不变量（工作记忆容量、前注意加工、觅食行为、错误分类学）的命题进本层；能还原到特定硬件/OS/年代语境的进 D4；无法还原到一手来源的进神话隔离区。每条 Evidence 字段标注证据类型（standard / empirical / canon）与置信度；置信度沿用交叉验证报告的分级，Medium 注明单一来源，Low 与 Conflict Zone 在行文中呈现不确定性。Validation Possibility 字段三值化：可自动检测（deterministic，对应自动化地板）、启发式/半自动评估（assistive，LLM 初筛需人工复核，其检测一致性 κ≈0.50 而严重性判断 α≈0 [C006]）、必须用户测试（empirical，任务成功率、满意度等 outcome 类命题本质上是使用的结果而非产品属性 [N040]）。

与 D4 的分界：本层条目是"跨栈判断依据"，D4 是"带适用条件的经验法则与平台惯例"。凡证据强度停留在 B 级（平台规范）或实证基础被原作者自认薄弱的候选，即使流行度极高，一律降级并记录于文末。

---

## 1. 感知与视觉层级

### P-01 知觉分组（Perceptual Grouping）
- **ID**: P-01
- **Definition**: 视觉系统按邻近、相似、连续、闭合、共同命运、共同区域、连接性自动把元素组织成组；界面布局的分组结构必须与信息的逻辑结构一致。
- **Why**: 分组是前注意的、自动的感知过程而非习得惯例——用户从空间关系直接读出结构，不消耗工作记忆；当视觉分组与真实数据结构冲突时，感知分组总是获胜。
- **Evidence**: [N027] Wertheimer 1923 分组律（empirical，描述性定律，High；common region 为 Palmer & Rock 1994 增补）；[A037] Koffka 系统化（canon）；[A018] NN/g 对 common region 的应用化与"过度使用制造杂乱"警告（canon，High）。
- **Applies When**: 一切视觉呈现；高信息密度界面尤其依赖分组维持可扫描性——分组是密度的解药。
- **Does Not Apply When**: 非视觉模态（纯语音/听觉界面仅有时间分组类比）；连线/容器等强分组线索不应被用来"修正"错误的数据结构——此时应改结构而非加线索。
- **Examples**: 日志浏览器按 severity 着色（similarity）；Inspector 面板字段按所属对象以留白分组；架构图连线作为最强分组线索表达依赖关系。
- **Counterexamples**: 卡片套卡片——每个容器都增加边界、padding、背景三层噪音，全部框住时分组信号自相抵消 [A018]；同组元素却用不同色（similarity 自我矛盾）。
- **Related Principles**: P-02（同源：前注意加工）；P-03（互补：分组管结构，层级管优先级）；P-10（张力：容器是昂贵的分组手段）。
- **Potential Conflicts**: 分组线索成本递增（留白→对齐→分隔线→背景→边框容器），与 P-10 信噪比争夺视觉预算。
- **Validation Possibility**: 半自动——proximity/对齐违规可由边界盒与间距聚类静态检测；分组与语义的一致性需启发式评估。

### P-02 前注意通道编码（Preattentive Encoding）
- **ID**: P-02
- **Definition**: 需要在"扫一眼"级别被察觉的信息（异常、状态、选中态）必须编码在前注意视觉属性上：色相、亮度、方向、大小、形状、运动、位置。
- **Why**: 前注意属性在约 200–250ms 内被视觉系统并行加工、无需聚焦注意；编码在此通道上的差异是"物理上跳出来"，编码不在此通道上的差异需要逐格串行搜索——两者是数量级差异而非程度差异。
- **Evidence**: [N028] Healey, Booth & Enns 1993（empirical，High）；[A038] Ware《Information Visualization: Perception for Design》系统化（canon，High）。
- **Applies When**: 监控、告警、日志、指标面板等以扫描/发现异常为首要任务的高密度界面。
- **Does Not Apply When**: 特征间存在干扰与不对称（斜线中找竖线快，反向慢；随机色相干扰形状边界检测）——多特征叠加不等于多通道并行；长文本阅读任务不适用 pop-out 逻辑。
- **Examples**: 日志 severity 的红/灰编码；dashboard 异常格高亮；minimap 热力着色让"哪里坏了"一眼可见。
- **Counterexamples**: 满屏高饱和徽章——所有元素都 pop-out 等于没有 pop-out；要求逐格阅读才能发现异常的仪表盘浪费了 200ms 通道。
- **Related Principles**: P-01（同源）；P-04（互补：语义色是前注意通道的预算分配）；P-13（互补：静态显著 vs 变化显著）。
- **Potential Conflicts**: 与 P-10 信噪比：显著性编码越密集，单个信号价值越低。
- **Validation Possibility**: 半自动——截图显著性分析与 LLM-as-judge 可初筛，但需人工校准锚点 [C006]。

### P-03 视觉层级显著性梯度（Visual Hierarchy as Salience Gradient）
- **ID**: P-03
- **Definition**: 元素重要性必须映射为连续、无歧义的显著性梯度（尺寸、字重、对比、位置、留白）；相邻层级的差异必须大到不会被误读为噪差。
- **Why**: 初始注意分配由显著性驱动；若所有元素前注意权重相等，视觉系统无可抓取的入口——"不知道先看哪"就是层级失败的诊断症状。"几乎相同"的两级被感知为错误而非层级。
- **Evidence**: [A038]（canon，机制）；[N049] ISO 9241-112:2025 信息呈现原则的 discriminability 条款（standard，High）；CRAP 的 Contrast 条为同命题的教学法表述 [A054]（pedagogy，语义锚定回本条）。
- **Applies When**: 所有页面，特别是首屏需要引导任务入口的 dashboard 与详情页。
- **Does Not Apply When**: 刻意等权的同格陈列（grid of equals，如同级服务卡片墙）是合法设计；层级梯度不应建立在单一通道上（如只靠颜色深浅），否则消耗对比度预算并击穿 P-27。
- **Examples**: 指标面板的 big number vs 坐标轴标签的三级梯度；页面标题/分区标题/正文的字重尺寸阶梯。
- **Counterexamples**: 五个"差不多大"的标题；用高饱和色做唯一层级手段。
- **Related Principles**: P-02（机制底座）；P-04（张力：层级通道与语义通道争夺色彩预算）。
- **Potential Conflicts**: 层级强化（放大关键元素）与 P-10 结构化密度——专业工具的折中是"层级靠字重/位置而非面积"。
- **Validation Possibility**: 半自动——计算显著性模型 + LLM 评审可做存在性初筛（κ≈0.50），严重性与"是否专业"需人工复核 [C006]。

### P-04 语义色稀缺原则（Semantic Color Economy）
- **ID**: P-04
- **Definition**: 颜色按角色/语义建模（neutral/brand/information/success/warning/danger），语义色必须稀缺；前景与背景成对定义（x/onX），把对比度责任内建进色彩结构。
- **Why**: 色相与饱和度是前注意属性，每一处高饱和色都在竞争并行注意通道；语义色只有在稀缺时才保有信号价值——用色密度上升则信噪比下降，status 语义失效（saturation-as-noise 机制）。
- **Evidence**: 机制层 [N028][A038]（empirical，High）；形式化范本 [C007] Atlassian color roles 与"不要用 accent 色表达语义"契约（产品级，机制示范意义 High）；on-配对内建对比度责任 [B023]（platform canon，思想可迁移、数值不可迁移）。
- **Applies When**: 一切带 status 语义的工具界面（error/warning/success/info）；token 化的设计系统。
- **Does Not Apply When**: 数据可视化的分类色板是数据语义而非 UI 语义，遵循可视化自身的色板纪律，不与本条混用；品牌营销场景的表现力用色不受本条约束。
- **Examples**: 日志浏览器 severity 着色：仅 error 用红、warning 用黄，其余中性；brand 色不参与状态表达。
- **Counterexamples**: 十种"语义色"并存；用 accent 紫表达 success；装饰性渐变与 status 色争夺同一通道。
- **Related Principles**: P-02（机制同源）；P-27（对比度地板是语义色的合规下限）；P-10（互补）。
- **Potential Conflicts**: 品牌表现力 vs 信号价值；色板丰富度 vs 可访问性（色觉障碍要求语义色必须有非色彩冗余编码，见 P-29）。
- **Validation Possibility**: 可自动——token 角色引用 lint、语义色计数与对比度计算均可确定性执行 [B001]。

---

## 2. 认知与负荷

### P-05 工作记忆外化（Externalize Working Memory）
- **ID**: P-05
- **Definition**: 需要用户在脑中同时保持的信息不应超过约 4 个 chunk；超出部分必须外化到界面——可见的中间结果、驻留的上下文、持续显示的操作状态。
- **Why**: 阻断复述与组块化条件下，工作记忆纯容量约为 4±1 chunk；跨面板比较的中间值、多步操作的累计状态都直接消耗这一瓶颈，溢出即丢失。容量按 chunk 而非 item 计，chunk 由用户知识定义——界面替用户做好分组等于替用户扩容。
- **Evidence**: [N043] Cowan 2001（empirical，High，当前主流共识）；[N044] Miller 1956（empirical，历史原点与 chunking 概念）。
- **Applies When**: 多步任务（向导、配置）、跨视图比较（A/B 排查）、查询构建、任何需要"记住上一步"的流程。
- **Does Not Apply When**: 可见信息的扫描与再认不经过该瓶颈——"菜单不能超过 7 项"是把回忆容量误用于再认场景的范畴错误，Miller 本人明确否认此用法 [B025]；专家因 chunking 使等效容量更大，固定数字上限对专家界面无意义。
- **Examples**: 查询构建器把当前条件以 chips 持续可见；trace 瀑布图缩放时保留全局 minimap 上下文；多步表单显示已填摘要。
- **Counterexamples**: 向导第 3 步要求凭记忆输入第 1 步的值；跨标签页比较两个数字。
- **Related Principles**: P-06（互补：外化的信息同时成为再认线索）；P-07（同源理论框架）；P-23（overview 是 chunk 级外化）。
- **Potential Conflicts**: 全部状态外化 vs 屏幕空间——与 P-10 信噪比权衡。
- **Validation Possibility**: 启发式评估可发现明显违规；chunk 负荷计数依赖任务分析，属半自动。

### P-06 再认优于回忆（Recognition over Recall）
- **ID**: P-06
- **Definition**: 让对象、动作、选项可见可选，把"凭记忆输入"的任务转化为"从候选中认出"的任务。
- **Why**: 再认提供提取线索，记忆心理学长期实证中再认成绩系统性优于自由回忆；命令面板+模糊搜索的本质是把 recall 任务改写成 recognition 任务。
- **Evidence**: [A050] Nielsen #6 及其记忆心理学底座（canon，High）；与 P-05 同源于记忆系统研究 [N043][N044]。
- **Applies When**: 命令、查询、配置等"知道存在但记不全"的功能面；新手与低频用户界面。
- **Does Not Apply When**: 专家高频操作——练习把回忆成本摊销为零，强制走再认路径反而更慢（与 P-24 构成有意张力）；口令、密钥等秘密信息不应被"提示"。
- **Examples**: IDE 自动补全；命令面板模糊匹配；查询历史与最近文件列表；facet 值列表而非空输入框。
- **Counterexamples**: 要求用户背 trace ID 才能查询；把 recall 负担包装成"界面简洁"。
- **Related Principles**: P-05（同源）；P-24（张力与互补：专家加速通道）。
- **Potential Conflicts**: 选项可见性 vs P-10 密度/信噪比。
- **Validation Possibility**: 启发式评估与认知走查可评估 [A023]。

### P-07 外在认知负荷最小化（Minimize Extraneous Load）
- **ID**: P-07
- **Definition**: 削减与任务无关的认知开销（split-attention、冗余呈现、装饰性复杂）；对任务固有的复杂度做分段与序列化；把省下的工作记忆预算留给理解与学习。
- **Why**: 认知负荷理论三分：intrinsic（任务固有）/extraneous（呈现方式造成）/germane（图式构建）；设计能直接操作的杠杆是 extraneous——它挤占的是同一有限工作记忆池。
- **Evidence**: [N020] Sweller CLT 系列（empirical-理论框架，High；注意其语境为教学设计，迁到任务型工具时聚焦 extraneous load，且 germane 定义 2010 年已被作者修订——引用旧三源版本的二手材料不可信）。
- **Applies When**: 学习场景、文档、新手引导、复杂表单与错误恢复路径。
- **Does Not Apply When**: expertise reversal effect——对新手有益的支架（详细引导、worked examples）对专家成为冗余负荷，故本条不推出"专业工具应为新手极简化"；Bjork 的 desirable difficulties 提示并非所有费力都有害。
- **Examples**: 校验错误就地显示在出错字段旁而非汇总到另一页；图表标注内嵌于数据点而非靠图例往返对照。
- **Counterexamples**: 把说明文字全部删除美其名曰"降负荷"，实际删除了信息气味（见 P-21）。
- **Related Principles**: P-05、P-06（同记忆框架）；P-10（张力：减负的正确对象是不相关元素而非信息密度）。
- **Potential Conflicts**: 新手负荷 vs 专家效率（由 P-24 双速结构化解）。
- **Validation Possibility**: 启发式半自动；负荷测量（NASA-TLX [A056]）必须真实用户。

### P-08 选择成本按信息量计（Hick–Hyman Law）
- **ID**: P-08
- **Definition**: 决策时间随选项集的信息量（熵）对数增长；菜单设计的主杠杆是分类结构与概率排序，而不是机械削减选项数。
- **Why**: Hyman 证明决定变量是刺激的不确定性而非选项个数；成本单位是"一次翻倍"（1 bit）——64 个分类良好的选项约 6 bits，并非 2 个选项的 32 倍。高频选项前置、用分组把一次大选择变成两次小选择，是对数成本下的最优策略。
- **Evidence**: [N010] Hick 1952 / Hyman 1953（empirical，High；适用边界：等概率、简单刺激-反应映射的选择反应时）。
- **Applies When**: 菜单、命令列表、facet、设置页等离散选择场景。
- **Does Not Apply When**: 视觉搜索（并行扫视不经过串行决策）、高度练习的专家任务、已有清晰分类结构的菜单——斜率剧降或不适用；"选项越少越好"的线性解读不成立。
- **Examples**: 命令面板按使用频率排序；设置项先按域分组再陈列；facet 值按计数降序。
- **Counterexamples**: 为凑"少选项"把 12 个常用功能压进三层深菜单——用分类决策成本（更贵）换视觉扫描成本（更便宜），方向反了。
- **Related Principles**: P-21（标签质量决定每次选择的难度）；P-09（互补：决策之后是瞄准）。
- **Potential Conflicts**: 扁平化展示 vs 分类层级——分类降低熵但增加层级深度。
- **Validation Possibility**: 可建模估算（结构×频率分布）；实际决策时间需用户测试计时。

### P-09 瞄准成本按距离与尺寸计（Fitts's Law）
- **ID**: P-09
- **Definition**: 指针瞄准时间 = a + b·log₂(A/W + 1)：目标越小、越远，操作越慢；屏幕边缘与角落等价于无限宽目标。
- **Why**: 运动控制的信息论模型，HCI 中复现次数最多的定量定律；Shannon 形式由 MacKenzie 确立并被 ISO 9241-9 采用。尺寸收益对数递减——宽度翻倍只省约 1 bit。
- **Evidence**: [N025] Fitts 1954（empirical，High）；[N017] MacKenzie 1992（empirical，High）。
- **Applies When**: 指针设备（鼠标、触控板，触屏部分近似）上的快速瞄准；高频操作目标应大且近。
- **Does Not Apply When**: 键盘、语音、滚屏、拖拽轨迹不建模；二维目标需 smaller-of/W' 修正；"按钮越大越好"不成立（对数递减）；触屏无指针驻停，边缘/角落技巧失效。
- **Examples**: 日志行内 hover 操作的实际 hit area 大于图标视觉尺寸；高频过滤 chips 紧邻列表首行。
- **Counterexamples**: 数据行里 12px 图标按钮作为唯一入口——同时违反本条与 P-27 的 24px 合规地板。
- **Related Principles**: P-27（合规尺寸地板）；P-24（专家改用键盘后本条让位）。
- **Potential Conflicts**: hit area 扩大 vs 行密度（P-10）——透明热区是标准解。
- **Validation Possibility**: 几何尺寸可自动测量 [N002]；时间预测需受控实验。

### P-10 信噪比与结构化密度（Signal-to-Noise, Not Minimalism）
- **ID**: P-10
- **Definition**: 每个信息单元都在与同级单元竞争注意；应当削减的是与任务无关的元素，而不是信息量本身。密度不是敌人，"无结构的密度"才是——专业界面的密度必须靠分组、对齐、层级与语义色维持可扫描性。
- **Why**: 选择性注意是有限通道，无关元素稀释相关元素的相对可见性；专家/高频用户的效率来自单位屏幕的并行信息吞吐，企业场景中用户是被要求使用系统的，效率指标是 time-on-task 与 error rate 而非 engagement。
- **Evidence**: [A050] Nielsen #8 的正确读法（"这是信噪比原则而非少即是多"，canon）；[A053] HEART 原文"Engagement 在企业场景价值有限"（canon，High）；密度成本的实证存在但为 AR 语境单研究，外推需降权 [C029]（Medium）。
- **Applies When**: dashboard、日志/指标/trace 浏览器、数据表格等专家高频工具。
- **Does Not Apply When**: 消费级/营销首屏（转化目标下极简优先）；新手 onboarding 流程。
- **Examples**: 密表 + severity 语义色 + 列对齐 + tabular-nums 等宽数字保持纵向可扫描 [B037]；按子系统分区的多面板仪表盘。
- **Counterexamples**: 把专业工具"极简改造"成每屏一个数字（牺牲了专家的并行吞吐）；或反向，在密集界面上叠加阴影/渐变等装饰性前注意噪音。
- **Related Principles**: P-01、P-02、P-03（密度的四个结构支柱）；P-07（减负对象的辨析）。
- **Potential Conflicts**: 与流行的 minimalism 表述的结构性张力——本条是对 Nielsen #8 的纠错性重述；与 P-26 可读性要求争夺像素预算。
- **Validation Possibility**: 结构信号（对齐、间距基数、数字排版）可自动 lint；信息相关性判断与克制度需 LLM 初筛 + 人工校准 [C006]；密度收益终裁靠专家用户任务计时。

---

## 3. 反馈与系统状态

### P-11 系统状态持续可见（Visibility of System Status）
- **ID**: P-11
- **Definition**: 系统应在合理时间内让用户知悉正在发生什么：处理状态、进度、后台任务、连接与同步状态、数据的新鲜度。
- **Why**: 用户只能对可见状态形成正确概念模型（评估鸿沟）；状态不可见导致重复操作、把停滞误判为完成、把旧数据误判为当前——这类错误的根源在系统映像而非用户。
- **Evidence**: [A050] Nielsen #1（canon，High）；[N045] ISO 9241-110 self-descriptiveness"处理状态的清晰指示"（standard，High）；[N011] 反馈与评估鸿沟（canon）。
- **Applies When**: 任何存在时延或异步过程的系统；开发者工具的查询执行、索引构建、数据同步、trace 采样尤其关键。
- **Does Not Apply When**: <100ms 内完成的微操作不需要状态指示（多余指示本身成为噪音，见 P-13 张力）；状态可见不等于状态打扰。
- **Examples**: 查询执行 spinner + 已耗时显示；索引构建进度条；trace 采样率与数据时间范围常驻指示；协作编辑的同步状态点。
- **Counterexamples**: 静默失败后列表停在旧数据且无任何陈旧标记；整页白屏 loading 替换掉全部上下文。
- **Related Principles**: P-12（互补：状态是持续量，反馈是事件）；P-13（互补：变化需主动信号）；P-19（机制根源）。
- **Potential Conflicts**: 状态指示密度 vs P-10 信噪比。
- **Validation Possibility**: 启发式可评估存在性；运行时检测 loading/empty/error 三态覆盖可半自动化。

### P-12 反馈即时且分级（Immediate, Proportional Feedback）
- **ID**: P-12
- **Definition**: 每个动作都应有即时、可感知的反馈，反馈强度与动作重要性匹配——频繁小动作轻反馈，罕见大动作重反馈；操作序列应有开始、中间与结束（closure）。时延设计按 0.1s（直接操纵感）/1s（心流不断）/10s（注意保持）三级规划。
- **Why**: 反馈闭合感知-动作回路；完成信号让用户放下戒备计划（drop contingency plans）。反馈不足导致重复提交，反馈过度导致通告疲劳并被系统性忽略。
- **Evidence**: [N030] R. B. Miller 1968 时延三级框架（empirical/canon，High；比 Doherty 400ms 更稳健——后者为单一 IBM 内部报告、关键数字无法独立复核 [B032]，Low）；[A024] Shneiderman #3 反馈分级与 #4 closure（canon）；[N011]（canon）。
- **Applies When**: 所有交互；异步任务必须含完成反馈；破坏性与批量操作需加重反馈。
- **Does Not Apply When**: 400ms 之类的精确阈值不应作为硬指标引用；连续实时流（帧率）属渲染性能范畴而非对话反馈范畴。
- **Examples**: 按钮按下态；保存成功 toast；长任务进度 + 完成通知 + 失败重试入口；部署流水线的阶段式进度。
- **Counterexamples**: 每次保存都弹模态；indeterminate 进度条冒充真实进度；成功无反馈、失败才有反馈。
- **Related Principles**: P-11（互补）；P-13（变化显著性）；P-14（undo toast 是反馈与可逆性的合流）。
- **Potential Conflicts**: 重反馈 vs 打断成本——非关键信息用 modal 会训练用户无视该格式（"狼来了"）[A013]。
- **Validation Possibility**: 时延可自动测量；反馈适当性需启发式评估或用户测试。

### P-13 状态变化主动 signaling（Change Must Be Signalled）
- **ID**: P-13
- **Definition**: 不要指望用户注意到界面中悄然发生的变化；异步完成、数据刷新、配置漂移、他人协作修改必须有主动信号（badge、动画、toast、声音）。
- **Why**: 变更视盲与无意视盲是教科书级实证：注意被任务占据时，全程可见的变化也会被错过——真人对话中更换对话者，15 名被试中 8 人未察觉。"看到了"不等于"注意到了"。
- **Evidence**: [N009] Simons & Chabris 1999（empirical，High）；[N008] Simons & Levin 1998 门实验（empirical，High，生态效度高）。
- **Applies When**: 监控告警、后台任务完成、协作编辑、数据自动刷新的工具界面。
- **Does Not Apply When**: 用户当前注意焦点内的变化（直接操纵的即时效果无需额外信号）；高频刷新数值若全部动画化会变成干扰源——信号也要守 P-10 信噪比。
- **Examples**: 部署完成 badge；日志 tail 模式暂停时显示"有 N 条新日志"而非静默滚动；配置被他人修改的 diff 提示。
- **Counterexamples**: 告警靠"页面某处数字变了"来传达——必然漏报。
- **Related Principles**: P-02（信号的编码通道）；P-11（互补）。
- **Potential Conflicts**: 主动信号 vs ISO 9241-112 的 freedom from distraction [N049]——信号分级（badge < toast < modal）是解法。
- **Validation Possibility**: 信号存在性可启发式评估；显著性是否足够需用户测试或眼动验证。

---

## 4. 用户控制与错误

### P-14 可逆性与用户控制（Reversibility and User Control）
- **ID**: P-14
- **Definition**: 用户而非系统应是行动的发起者；操作应尽可能可逆。可逆的破坏性操作默认"立即执行 + 限时 undo"，确认对话框只保留给真正不可逆或高风险操作。
- **Why**: 可逆性解除焦虑、鼓励探索未知功能——"知道能撤销"是专家敢于深度使用工具的前提；确认对话框让所有用户为小概率错误纳税，且被习惯性点掉后即失去保护力。可控性内含行动的速度、顺序与个性化由用户掌握。
- **Evidence**: [A024] Shneiderman #6 easy reversal 与 #7 internal locus of control（canon，High）；[A050] Nielsen #3（canon）；[N045] ISO controllability（standard，High）；法律/财务/数据类操作要求确认或可撤销见 WCAG 2.2 SC 3.3.4 [N005]（standard）。
- **Applies When**: 删除、移动、覆盖等对象操作，且系统具备软删除/回收站/版本快照架构。
- **Does Not Apply When**: 真正不可逆操作（转账、全员发布、无备份的 DROP TABLE）——确认在此是必需品；undo 必须有真实恢复能力，假 undo 比确认框更糟。
- **Examples**: 删除 dashboard → 立即执行 + toast 内 10 秒 undo + 回收站慢速兜底；破坏性查询的 dry-run；时间旅行调试。
- **Counterexamples**: 每次删除都弹"你确定吗"；提供 undo 按钮但后端是硬删除。
- **Related Principles**: P-15（预防与可逆互补）；P-12（undo toast 依赖反馈分级）。
- **Potential Conflicts**: 安全 vs 流畅；undo 时限 vs WCAG 2.2.1 时限可调要求 [N005]。
- **Validation Possibility**: 存在性可启发式评估；undo 正确性需运行时测试。

### P-15 错误预防优于错误恢复（Error Prevention over Recovery）
- **ID**: P-15
- **Definition**: 先消除易错条件（约束、默认值、格式即时校验、不可逆操作二次确认），再谈错误信息质量；区分 slips（自动行为层面的失误）与 mistakes（概念模型错误），两者干预点不同。
- **Why**: slips 源于熟练行为的自动执行（mode error、capture error），mistakes 源于错误心智模型；预防的成本恒低于诊断加恢复。ISO 的表述是三层：avoidance → tolerance → recovery，顺序即优先级。
- **Evidence**: [A050] Nielsen #5（canon）；[N011] Norman slips/mistakes 分类学与四类约束（canon，High）；[N045] ISO use error robustness（standard，High）。
- **Applies When**: 破坏性、批量、生产环境操作；表单与查询输入；多模式界面（查看/编辑切换）。
- **Does Not Apply When**: 探索性操作不应被过度防呆扼杀（与 P-14 互补：防不住的错误靠可逆性兜底）；约束不能压制用户的真实意图——forcing function 用错场景就是死路。
- **Examples**: DROP TABLE 需输入库名确认；日期选择器禁选不可能区间；查询语法即时校验并标出出错位置；模式切换有强 signifier。
- **Counterexamples**: 用"你确定吗"代替约束设计；禁用提交按钮却不说明缺少什么；错误信息只有错误码没有人话（对开发者：错误码不能是唯一信息，可搜索的错误码+文档链接才是正解）。
- **Related Principles**: P-14（互补）；P-19（mistakes 的根源治理）；P-25（默认值是预防的一种）。
- **Potential Conflicts**: 约束 vs 专家灵活性——专家需要 escape hatch。
- **Validation Possibility**: 表单约束与校验存在性可自动检测；slip 诱发性与错误恢复质量需用户测试。

### P-16 直接操纵（Direct Manipulation）
- **ID**: P-16
- **Definition**: 对核心对象提供持续可见的表示，以物理动作（拖拽、框选、点选）代替命令语法，操作快速、增量、可逆且效果立即可见。
- **Why**: 把"指定-执行"鸿沟转为感知-动作回路：对象在场、动作直接、结果立现，探索成本趋近于零——这是它与 P-14 可逆性联用后产生"glowing enthusiasm"的机制。
- **Evidence**: [N021] Shneiderman 1983 三原则（canon-概念框架，High）；局限性（精度任务、批处理、视障可达性）为作者本人后续承认 [A024]。
- **Applies When**: 画布、时间轴、布局编辑、可视化过滤（框选时间窗）、关系连线等空间化任务。
- **Does Not Apply When**: 精确数值输入、批量/脚本化操作、宏——直接操纵在这些任务上弱于语法；任何拖拽交互必须提供单指针替代与键盘等价路径（WCAG 2.2 SC 2.5.7 [N005]）。
- **Examples**: 时间轴框选缩放到可疑区间；架构画布拖拽连线建立依赖；点选过滤 chip 改写查询条件。
- **Counterexamples**: 拖拽触发不可逆副作用且无预览；只能拖拽、无键盘路径的交互。
- **Related Principles**: P-14（可逆性是其第三要素）；P-20（可拖拽性需要 signifier）；P-28（键盘等价）。
- **Potential Conflicts**: 直接操纵 vs 精度与可访问性——正解是双通道并存而非二选一。
- **Validation Possibility**: 键盘/单指针替代可半自动检测；流畅性与学习曲线需用户测试。

---

## 5. 一致性与心智模型

### P-17 内部一致性（Internal Consistency）
- **ID**: P-17
- **Definition**: 同一对象、动作、状态在全系统使用同一术语、同一视觉编码、同一交互行为。
- **Why**: 一致性让用户把已学模型无损迁移到未学区域；每一处不一致都迫使用户重建局部模型，学习成本随不一致点数线性增长。
- **Evidence**: [A050] Nielsen #4（canon）；[N045] ISO conformity 推荐类别含内部一致性（standard）；WCAG 2.2 SC 3.2.4 Consistent Identification 把功能标识一致性列为 A 级合规义务 [N005]（standard——此条同时是规范义务）；action label 词典化实践 [C030]（产品级范本）。
- **Applies When**: 所有产品；多模块、多团队共建的大型工具尤其需要词典与 lint。
- **Does Not Apply When**: 一致性不能凌驾上下文合理性——刻意打破一致以标示模式/状态差异（如只读态与编辑态）是合法设计；"一致的坏设计"不值得为了一致而保留。
- **Examples**: 全系统"Delete（不可恢复）/ Move to trash（可恢复）"的语义分层 [C030]；severity 颜色映射全产品唯一；同一动作在各处同名同键位。
- **Counterexamples**: 同一概念三处三个名字（run/execution/job）；同一图标在不同模块不同含义。
- **Related Principles**: P-18（互补：内外两个层次）；P-01（视觉编码一致性是 similarity 的应用）。
- **Potential Conflicts**: 一致性 vs 语境最优；一致性 vs 演进（迁移期需要双轨与弃用路径）。
- **Validation Possibility**: 术语/标签/图标一致性可 lint（词典驱动 [C030]）；行为一致性需启发式评估。

### P-18 符合用户预期与外部惯例（Conformity with User Expectations）
- **ID**: P-18
- **Definition**: 系统行为应可由使用情境与该情境中的公认惯例预测；遵循平台与行业惯例，除非有明确且可辩护的理由偏离。
- **Why**: 用户的绝大部分交互经验来自其他系统（Jakob's Law 的实质：经验格言而非定律），惯例是免费的心智模型——偏离惯例等于向用户收取学习税，且税金由偏离方的产品体验支付。
- **Evidence**: [N045] ISO conformity with user expectations（standard，High）；[A050] Nielsen #4 含 "follow platform and industry conventions"（canon）；平台惯例本身是 convention 层知识，数值与细则应从各平台规范取用（如 [B008]），不得上提为 universal。
- **Applies When**: 平台内应用（键位、导航位置、对话框行为）；行业工具生态（IDE 键位、kubectl 语法、Git 词汇）。
- **Does Not Apply When**: 惯例本身错误、过时或不适用于任务时可偏离——但偏离决策须显式记录并承担验证责任；专家效率需求可否决外部惯例（与 P-24 联动）；不可把平台视觉惯例（如特定材质语言）当通用原则跨栈搬运。
- **Examples**: macOS 应用遵循系统快捷键体系；Web 工具提供 Ctrl/Cmd+K 命令面板（该模式已跨产品主流化，但尚无期刊级实证，按成熟实践对待 [C057]）。
- **Counterexamples**: 自创滚动方向或关闭键位；把 iOS 的 44pt 惯例当 Web 合规要求（单位与出处混淆，见 P-27）。
- **Related Principles**: P-17（互补）；P-20（惯例是最强 signifier）；P-24（张力）。
- **Potential Conflicts**: 外部一致性 vs 内部一致性（迁移期）；惯例 vs 创新——创新的成本用本条计价。
- **Validation Possibility**: 惯例符合性可检查单式评估；预期匹配度终裁需用户测试。

### P-19 系统映像传递概念模型（System Image Shapes the Conceptual Model）
- **ID**: P-19
- **Definition**: 界面是设计者模型与用户模型之间的唯一信道；命名、分组、层级、默认值共同投影出"系统如何工作"的解释——必须投影正确结构，并隐藏实现细节。
- **Why**: 用户只能通过 system image 构建心智模型；投影错位则产生系统性 mistakes（而非随机 slips），且此类错误无法靠错误信息修复，只能靠改投影。架构可视化的价值即在于把系统结构外化，使用户无需在脑中维护它。
- **Evidence**: [N011] Norman designer's model / system image / user's model 三方结构（canon，High）；心智模型研究方法的实践综述 [B039]（二手转引 Nielsen 与 Indi Young，Medium）。
- **Applies When**: 信息架构、对象模型设计、API/CLI 与 GUI 的同构设计、默认值与命名的每一处。
- **Does Not Apply When**: 用户模型天然多元——同一界面会被不同人群构建出不同模型，不存在唯一正确投影，须以目标人群的研究校准，不能由设计者单方宣布。
- **Examples**: 服务依赖图直接外化系统拓扑；导航按用户任务对象组织而非按微服务边界组织；默认值透露"典型用法"。
- **Counterexamples**: 把内部 job ID 作为一级导航维度；按数据库表结构生成菜单——实现细节污染用户模型。
- **Related Principles**: P-15（mistakes 的根源）；P-22（对象优先是本条的操作化）；P-17（一致投影才有可学性）。
- **Potential Conflicts**: 简化模型 vs 系统真实复杂度——模型必须"足够真"以支撑用户的任务预测。
- **Validation Possibility**: 必须用户研究（心智模型访谈、卡片分类 [A058]）；无法静态判定。

### P-20 示能符号必须可感知（Signifiers Must Be Perceivable）
- **ID**: P-20
- **Definition**: 每种交互可能性（affordance）必须配套可感知的信号（signifier）告知动作在哪里、如何发生；可交互但不可感知，等于不可交互。
- **Why**: affordance 是对象属性与行动者能力之间的关系，存在与否独立于是否被感知；signifier 是传达该关系的可感知信号，"必须可感知，否则失效"。开发者工具的 discoverability 缺陷几乎全部是"真实 affordance 存在 + signifier 缺失"（hidden affordance）。
- **Evidence**: [N011] Norman 2013 正式引入 signifier（canon，High）；[N026] Gibson 关系性定义（学术源头）；[N007] Gaver false/hidden affordance 分类（canon）；[A002] Norman 的澄清文章。
- **Applies When**: 可拖拽、可点击、可展开、可编辑、可框选等一切非显性交互；hover 揭示的上下文操作。
- **Does Not Apply When**: 专家加速通道（快捷键）允许隐藏——但须存在可发现的入口（如命令面板内提示键位），即 hidden affordance 只允许存在于加速层，不允许存在于唯一路径上。
- **Examples**: 列宽拖拽手柄在 hover 时显现；可点击 span 有 cursor 与 hover 态；可编辑字段的铅笔提示。
- **Counterexamples**: 无提示的隐藏手势作为唯一入口；看起来可点实则不可点（false affordance）。
- **Related Principles**: P-16（直接操纵依赖 signifier）；P-18（惯例是最廉价的 signifier）；P-24（加速层的可见性折中）。
- **Potential Conflicts**: 显性 signifier vs 视觉简洁——hover 揭示是标准折中，但它把发现成本转移给了探索行为。
- **Validation Possibility**: 认知走查第二问（"用户会注意到正确动作可用吗？"）可直接评估 [A023]；静态检测（无 cursor/tabindex 的可点元素）半自动。

---

## 6. 信息组织

### P-21 信息气味导航（Navigation by Information Scent）
- **ID**: P-21
- **Definition**: 导航质量由每一步链接、标签、标题预告其后内容的强度（information scent）决定；用户放弃发生在 scent 丢失处，而不是在第 N 次点击处。
- **Why**: 信息觅食理论：用户按近端线索（trigger words）对路径价值与成本做不完美评估并择优前进；分类决策比视觉扫描更费认知，因此首层标签的区分度是导航性能的第一杠杆——label 优化即导航性能优化。
- **Evidence**: [N018] Pirolli & Card 1999（empirical-理论模型，High；SNIF-ACT 可解释真实网站 72–90% 链接选择方差）；[N050]（学术综述）；3-click rule 已被实证证伪——超过 3 次点击后放弃率不上升、满意度与点击数无关 [A032]。
- **Applies When**: 导航体系、菜单、facet、搜索结果摘要、文档站；错误信息（错误码+描述+文档链接同样是 scent 载体）。
- **Does Not Apply When**: 单一任务流内无需搜寻的场景；"约 16 个顶层选项×2–3 层最优"一类精确数字源自 1998 年 Web 语境实验的二手转述，不可外推为当代通用值 [B017]（Low，仅作方向参考）。
- **Examples**: facet 名与取值直接可读（"severity: error"而非图标）；列表项标题含可检索关键词；面包屑显示用户词汇而非路由名。
- **Counterexamples**: 纯图标无文字标签的导航栏；标签用工程词汇（"ResourceInstance 管理"）代替用户词汇。
- **Related Principles**: P-08（每次选择的成本模型）；P-17（标签一致性）；P-22（对象结构是 scent 的骨架）。
- **Potential Conflicts**: 标签信息量 vs 简洁——正确的简洁是"无废词"而非"无词"。
- **Validation Possibility**: 标签 scent 可由 LLM 初筛 + tree testing 验证（tree testing 变体显著影响结果，须选保留路径历史与回退的变体 [N033]）。

### P-22 结构匹配领域对象（Object-First Structure）
- **ID**: P-22
- **Definition**: 信息架构应从用户心智模型中的领域对象及其关系推导——对象即页面锚点、关系即导航路径、属性即列表列与 facet、操作即对象上的动作集；不得从实现模型（数据库表、微服务边界）直译界面结构。
- **Why**: 人按对象组织世界，导航基于"用户预期东西在哪"而非工程逻辑正确性；结构错位制造的是系统性 mistakes。组织/标签/导航/搜索四大系统是 IA 的稳定分析框架，恰好覆盖结构化语料库（实体、日志、任务、文档）的工具产品。
- **Evidence**: [N011] 概念模型理论（canon，High）；[A020] 北极熊书第 4 版四大系统框架（canon，High）；OOUX/ORCA 是当前最可操作的 object-first 方法，但无同行评审实证，按实践共识使用 [B026][B027]（Medium，单一方法社群），其不覆盖 flow/状态/动效的局限见 [E025]。
- **Applies When**: 有人控制语料库的工具产品：Agent/Run/Task/Log/Metric/Dashboard 各为锚点对象。
- **Does Not Apply When**: 算法生成的动态内容流（feed 类产品）无稳定对象结构；对象方法输出的是结构骨架，不替代任务流设计。
- **Examples**: 从用户访谈与日志中做"名词提取"确定对象集；对象间关系（Run 属于 Agent、产生 Log）直接成为导航路径。
- **Counterexamples**: 按后端服务名单做一级导航；对象在列表页与详情页之间命名漂移。
- **Related Principles**: P-19（理论根源）；P-21（对象的命名即 scent）；P-17（跨视图一致性）。
- **Potential Conflicts**: 用户对象模型 vs 系统真实结构——暴露多少实现细节是裁量点，非规则可定。
- **Validation Possibility**: 必须用户研究——卡片分类（生成式 [A058]）与 tree testing（评估式 [N033]）分工验证。

### P-23 概览优先、缩放过滤、细节按需（Overview First, Zoom and Filter, Details on Demand）
- **ID**: P-23
- **Definition**: 数据探索界面默认提供全局概览，支持缩放与过滤，细节按需呈现且不离开上下文；同时保留操作历史（history）与结果提取（extract）能力。
- **Why**: overview 为 chunk 级模式识别提供锚点（专家扫的是模式不是格子），details-on-demand 把工作记忆负担还给界面；focus+context 并存避免页面跳转替换造成的上下文丢失。history 与 extract 使分析路径可回放、查询状态可分享——这是专业工具与普通 dashboard 的分水岭。
- **Evidence**: [N019] Shneiderman 1996（原始论文，High 影响力）。**证据强度警示**：作者本人 2026 年自述该文为 opinion piece、无实证结果 [E023]，Craft & Cairns 2005 指出其被当规定性原则使用但不可证伪 [A021]——本条按 Medium confidence 使用：作为组织数据探索界面的默认骨架有效，作为不可违背的定律不成立。
- **Applies When**: 数据可整体概览、任务以探索/监控为主：日志（时间直方图）、trace（瀑布+minimap）、指标（多面板）、依赖图（拓扑+minimap）。
- **Does Not Apply When**: 数据集过大无法有意义地 overview；用户带着明确目标进入（已知 ID 查单条 trace）——此时 search-first（"search, show context, expand on demand"）更优 [A021]。
- **Examples**: 日志浏览器：时间直方图 overview → severity 过滤 → 单条日志侧栏展开且保留前后 N 行；过滤条件为可移除 chips 并编码进 URL。
- **Counterexamples**: overview 与 detail 整页替换跳转；详情模态遮掉被比较对象；过滤状态不可分享。
- **Related Principles**: P-05（overview 是外化）；P-13（过滤条件可见可逆）；P-21（搜索路径的 scent）。
- **Potential Conflicts**: overview 成本 vs 首屏直达任务——运营监控与临时排查两类用户的最优首屏不同，是裁量点而非规则。
- **Validation Possibility**: 结构存在性可启发式评估；任务适配性必须用户测试。

---

## 7. 效率与专家化

### P-24 新手-专家双速界面（Dual-Speed Interface）
- **ID**: P-24
- **Definition**: 同一界面为新手提供可见、可发现的路径，为专家提供不增加新手负担的加速通道（快捷键、命令面板、批量操作、脚本化）。
- **Why**: 练习把受控加工转为自动加工，专家对界面元素的需求结构质变；expertise reversal 表明对新手的支架即专家的冗余负荷——单一速度的设计必然对其中一端征税。加速通道"对新手隐藏但可发现"是被反复验证的折中。
- **Evidence**: [A050] Nielsen #7（canon）；[A024] Shneiderman #2 shortcuts（canon）；[N020] expertise reversal（empirical-理论，High）；专家容量弹性 [N044]。
- **Applies When**: 高频使用的专业工具（IDE、终端、数据与可观测性工具）。
- **Does Not Apply When**: 低频消费级界面不需要加速层；加速通道不能是功能的唯一入口（与 P-20 的折中：隐藏 affordance 仅限加速层）。
- **Examples**: 命令面板列表项右侧提示键位；查询编辑器同时提供 UI 构建器与 raw 模式；表格批量选择与批量操作。
- **Counterexamples**: 只有快捷键没有菜单等价物；或为求"简洁"砍掉批量操作，让专家逐行点击 200 次。
- **Related Principles**: P-06（新手侧）；P-10（专家侧的密度正当性）；P-20（加速层的 signifier 折中）。
- **Potential Conflicts**: 可见性 vs 效率；同一屏幕服务两种用户时的密度标定。
- **Validation Possibility**: 通道存在性可启发式评估；加速收益需专家用户任务计时。

### P-25 任务适配与默认值（Task Suitability and Defaults）
- **ID**: P-25
- **Definition**: 功能与交互应基于任务特征而非实现技术设计；默认值应服务最常见任务路径，使多数用户无需配置即达目标，默认值即预先做好的决策。
- **Why**: 默认值把决策成本从多数用户转移给系统，且默认值本身在传递"典型用法"的概念模型（与 P-19 联动）；任务特征决定信息优先级与操作序列的组织方式。
- **Evidence**: [N045] ISO suitability for the user's tasks 及"支持任务的默认值"推荐（standard，High）；good defaults 为模式正典条目 [A019]（canon）。
- **Applies When**: 表单、过滤器、新建流程、dashboard 初始视图、查询时间窗。
- **Does Not Apply When**: 默认值不得锁定（与 P-14 可控性联动）；任务方差大的场景默认值收益低；安全与隐私相关默认值需显式审视而非随大流。
- **Examples**: 日志浏览器默认时间窗=最近 1 小时；新建 dashboard 预置最常用面板模板；过滤默认排除 debug 级日志。
- **Counterexamples**: 默认开启遥测、默认全选订阅——默认值被用作黑暗模式时即背叛本条。
- **Related Principles**: P-08（默认值消除一次决策）；P-15（默认值即预防）；P-19（默认值传递模型）。
- **Potential Conflicts**: 多数路径优化 vs 长尾任务可达性；默认效率 vs 用户控制。
- **Validation Possibility**: 默认值合理性需行为数据分析 + 用户测试，无法静态判定。

---

## 8. 无障碍基线

> 本域条目的性质与其他七域不同：它们是**规范义务（normative floor）**，不是可裁量的设计启发式。收录进 Universal 层的理由是 WCAG 2.2 AA 为 2026 年唯一现行合规基线 [N005]，且其原则层（POUR）technology-independent。具体 SC 清单、平台 target size 数值（44pt/48dp）属规范细则与平台惯例，不进入本层。

### P-26 无障碍基线义务（POUR and the WCAG 2.2 AA Floor）
- **ID**: P-26
- **Definition**: 内容须可感知（Perceivable）、可操作（Operable）、可理解（Understandable）、健壮（Robust）；工程基线为 WCAG 2.2 AA——这是合规地板，不是可选的"加分项"。
- **Why**: 能力分布是连续谱（永久、暂时、情境性障碍），且开发者工具的核心用户恰好包含重度键盘用户与低视力专业用户；AA 是现行全部法律框架（EAA/EN 301 549、Section 508、ADA Title II）的引用点，W3C 明确不建议整站要求 AAA。
- **Evidence**: [N005] WCAG 2.2（standard，High）；[N052] ISO 9241-171:2025 技术无关可达性框架并内置 WCAG 2.2 映射（standard，High）；WCAG 3.0 截至 2026-08 为 Working Draft（2026-03-03），watch-only，任何无日期戳的 3.0 描述视为不可信 [N004]。
- **Applies When**: 一切交付真实用户的产品；合规义务不随"内部工具"自动豁免，降级须显式记录风险。
- **Does Not Apply When**: 本原则不替代具体 SC 清单——它规定"必须有地板且地板是 2.2 AA"，细则查规范本身。
- **Examples**: 文本对比度 ≥4.5:1；全部功能键盘可达；状态消息可被辅助技术播报。
- **Counterexamples**: 把无障碍当上线后补审计；以"Lighthouse 100 分"宣称达标——Lighthouse 只跑 axe 规则子集，自动检测按 issue 量仅覆盖约 57.38%、按 WCAG 2.2 A/AA 成功准则口径仅 17/55≈31% [C002][D001]。
- **Related Principles**: P-27、P-28、P-29（三个可执行子域）。
- **Potential Conflicts**: 高密度 vs target size 与对比度预算；动效 vs reduced motion——冲突的裁决顺序是合规优先，密度在合规空间内优化。
- **Validation Possibility**: 分层：数值类全自动（P-27）；运行时行为半自动（P-28）；语义质量与真实 AT 体验必须人工（W3C 官方立场："tools cannot determine accessibility" [N006]；2026 年仍有 95.9% 首页存在可自动检出的失败 [A001]）。

### P-27 可判定数值地板（Deterministic Numeric Floors）
- **ID**: P-27
- **Definition**: 文本对比度（正文 ≥4.5:1、大文本 ≥3:1）、非文本对比度（≥3:1）与指针目标尺寸（≥24×24 CSS px 或满足间距例外）是确定性可验证的数值/几何地板。
- **Why**: 低视力与运动精度障碍的用户需求被规范转化为可计算阈值，消除了"看起来差不多"的裁量空间；这些是自动化地板上最硬的条目——可零误报执行。
- **Evidence**: [N005] SC 1.4.3 / 1.4.11 / 2.5.8（standard，High）；[N002] 2.5.8 Understanding 文档含 24px 圆相交判定法（standard）；平台更大目标（HIG 44pt、Material 48dp）是平台惯例而非 universal 地板，且 pt/dp 与 CSS px 不可当同一单位混用 [B008]。
- **Applies When**: 所有文本、控件、图标按钮、图表关键元素；高密度表格的行内操作。
- **Does Not Apply When**: 规范例外（incidental、logotype、inline、user-agent control、essential）；24px 是合规地板而非可用性最优——icon-only 按钮 40–48px 热区属 best practice 层（D4），误报与漏报都是错。
- **Examples**: 日志 severity 着色同时满足 3:1 非文本对比；16px 图标外扩 24px 透明热区；on-配对 token 内建对比度责任（见 P-04）。
- **Counterexamples**: 用 AAA 的 44px 当 AA 义务报错（误报）；把 Android 48dp 当 Web 合规要求（出处混淆）。
- **Related Principles**: P-09（尺寸的超合规收益）；P-04（色彩结构内建对比度）；P-26（义务框架）。
- **Potential Conflicts**: 热区 vs 行密度——透明热区 + 行高内命中区是标准解。
- **Validation Possibility**: 全自动——axe-core 规则引擎与 token 级对比度计算可确定性执行并 fail 构建，零误报设计范式 [B001]。

### P-28 键盘与焦点契约（Keyboard and Focus Contract）
- **ID**: P-28
- **Definition**: 全部功能键盘可达；焦点顺序合理、焦点可见且不被遮挡、模态内焦点圈闭、关闭后焦点还原到触发元素；拖拽必须有单指针替代。
- **Why**: 键盘是视障、运动障碍用户与专业重度用户的共同通道；focus 管理是组件库最高频缺陷类别之一，且无法被静态扫描充分覆盖——它发生在运行时状态迁移中。
- **Evidence**: [N005] SC 2.1.1/2.1.2/2.4.3/2.4.7/2.4.11/2.5.7（standard，High）；[N001] APG 31 个组件模式的完整键盘交互契约（tabs/dialog/combobox/tree/grid 等，standard-指南，High）。
- **Applies When**: 一切复杂自定义 widget；命令面板驱动的产品；模态与浮层密集的工具界面。
- **Does Not Apply When**: 绘图画布等本质空间操作允许方向键近似 + 替代路径，而非逐像素键盘复刻——契约要求"功能可达"，不要求"交互同形"。
- **Examples**: trace 树形视图方向键导航 + type-ahead 定位；dialog 用 Esc 关闭、焦点圈闭、关闭还原；sticky header 不遮挡获得焦点的行内按钮（2.4.11）。
- **Counterexamples**: div+onclick 自造按钮无 tabindex；路由切换后焦点丢失到 body；下拉打开后 Tab 逃逸到背景层。
- **Related Principles**: P-16（拖拽替代）；P-29（语义层对偶）；P-24（专家键盘流与无障碍键盘流是同一投资）。
- **Potential Conflicts**: roving tabindex 等正确模式的实现复杂度 vs 交付速度。
- **Validation Possibility**: 半自动——脚本化键盘遍历 + Playwright+axe 可检出大部分断链；焦点顺序与公告合理性需人工/AT 判断 [C002]。

### P-29 语义可程序化确定（Programmatically Determinable Semantics）
- **ID**: P-29
- **Definition**: 组件的 name/role/value、信息结构与关系、状态消息须可程序化确定并通知辅助技术；原生 HTML 语义优先于自定义 widget——"No ARIA is better than bad ARIA"。
- **Why**: 辅助技术消费语义树而非像素；仅由视觉传达的关系（颜色、位置、字号）若在语义层不存在，对 AT 用户即不存在。语义化是"可见性"原则（P-11）在非视觉模态的对偶。
- **Evidence**: [N005] SC 4.1.2 / 1.3.1 / 4.1.3（standard，High）；[N003] WAI-ARIA 1.2（standard）；[N001] APG 第一原则（standard-指南，High）。
- **Applies When**: 所有自定义组件；状态更新（成功/进度/错误）用 role=status / aria-live 播报；图标按钮必须有可访问名。
- **Does Not Apply When**: 纯装饰元素应显式对 AT 隐藏（aria-hidden）——语义化不是越多越好，错误 ARIA 比没有 ARIA 更糟。
- **Examples**: 日志 level 用文本+图标而非仅颜色（色彩不作唯一编码，与 P-04 联动）；保存成功 toast 带 role=status；树表格用 grid 语义而非嵌套 div。
- **Counterexamples**: 满屏 aria-label 复述可见文本；用颜色唯一表达 severity；自定义 combobox 不用 APG 契约（最高频做错组件 [N001]）。
- **Related Principles**: P-11（对偶）；P-28；P-26。
- **Potential Conflicts**: 语义标注成本 vs 交付速度——解法是组件库内建而非逐页面手补。
- **Validation Possibility**: 存在性全自动（axe 规则 [B001]）；语义质量（alt 文本好坏、公告措辞合理性、阅读顺序自然性）必须人工或真实 AT 实测 [N006]。

---

## 9. 合并与降级记录

### 9.1 同源合并记录

本层 29 条对 HCI 经典清单做了系统性去重。凡多源同根的表述，合并为一个条目并以其共同认知根源为锚：

1. **"一致性"家族 → P-17 / P-18**：Nielsen #4 [A050]、Shneiderman #1 [A024]、ISO conformity with user expectations 与 ISO 9241-112 consistency 条款 [N045][N049]、Jakob's Law、Apple HIG 的 Consistency [B008]——共同根源是心智模型的迁移成本。拆分为内部一致性（P-17）与外部惯例（P-18）两条，因两者的反适用条件不同。
2. **"反馈/状态"家族 → P-11 / P-12 / P-13**：Nielsen #1、Norman feedback、Shneiderman #3 与 #4 closure、ISO self-descriptiveness——共同根源是评估鸿沟 [N011]。拆为持续状态（P-11）、事件反馈（P-12）、变化显著性（P-13），分别对应稳态、事件、异步变更三种失效模式。
3. **"用户控制/错误"家族 → P-14 / P-15**：Nielsen #3/#5、Shneiderman #5/#6/#7、ISO controllability 与 use error robustness——共同根源是 Norman 的错误分类学与损失厌恶 [N011]。可逆性（P-14）与预防（P-15）是互补的两种成本控制，不合并。
4. **"记忆减负"家族 → P-05 / P-06**：Shneiderman #8、Nielsen #6、Miller/Cowan 容量研究——共同根源是工作记忆瓶颈 [N043]。拆为"脑内保持"（P-05）与"提取方式"（P-06）两个可独立判断的命题。
5. **CRAP 四原则 → 拆解锚定**：Proximity 归 P-01（Gestalt 分组的教学法重述），Contrast 归 P-03（显著性梯度），Alignment/Repetition 为排版工艺惯例降入 D4。CRAP 作为助记教学法 [A054] 本身不入选——其学术地位是入门教材，四原则中仅两条可上溯到感知证据。
6. **Nielsen #8"minimalist design" → P-10 纠错性重述**：流行解读（少即是多）与原文（信噪比）相反，本条以信噪比重新表述并吸收 HEART 的企业密度论证 [A053]。
7. **平台原则（Apple HIG 2026 三原则 Hierarchy/Harmony/Consistency [B008]、Material、Fluent）**：其 universal 成分已分别并入 P-03/P-17；Harmony 等表述绑定平台语境，不入选。
8. **ISO user engagement（[N045] 第 7 原则）不入选**：hedonic 色彩与 HEART"企业场景 engagement 价值有限"[A053] 构成未裁决冲突（交叉验证 C7，Open）。处理：保留为场景化裁决样例——Agent 对专业工具默认降权 engagement 类建议，但不删除该原则的存在性记录。

### 9.2 边界案例：降级到 D4（heuristic / convention 层）的候选

以下候选流行度高、部分有 canon 出处，但按本层筛选标准证据不足或可判定性不足，降入 D4 并记录理由：

| 候选 | 降级理由 | 关键来源 |
|---|---|---|
| Progressive disclosure（渐进披露） | 源头 Carroll & Rosson "training wheels" 研究，作者自认无有效性证据（"empirical research lacking"）；作为模式有效，作为可判断原则证据不足 | [B042][B043] |
| 8pt grid / spacing 基数 | 工程惯例（整数缩放、token 纪律），无感知实证；"spacing→可用性"因果链不存在 | [B034][B013] |
| 45–75 CPL 行宽、type scale 比率 | 排版工艺共识 + 弱实证；边界值不可外推；部分二手来源未达入库标准 | （dim04 判定惯例层；registry 未收录其一手来源） |
| Serial position effect 的 UI 应用 | 原始实验为自由回忆范式（SCI），向浏览/再认场景的迁移是弱外推 | [N023] |
| "约 16 顶层选项 × 2–3 层" | 1998 年 Web 语境经典实验的二手转述，方向兼容但精确数字不可外推 | [B017]（Low） |
| Undo toast 时限、facet 默认显示前 5 值、"Clear all" 等细则 | 属模式实现参数（D4 pattern 层），本层只保留 P-14 的可逆性命题本身 | [C021] |
| Command palette 作为通用模式 | 跨产品主流化是事实，但无 HCI 期刊级实证；本层仅以 P-06/P-24 涵盖其机制 | [C057]（Low） |
| Inline editing 优于 modal | 证据主要来自供应商立场来源，已自降权 | （dim03 判定 Low） |
| OOUX/ORCA 15 步流程 | 方法细节无同行评审实证；本层仅保留其核心命题为 P-22 | [B026][E025] |
| Peak-end、aesthetic-usability 等流行 "UX laws" | 原始实验存在但语境迁移降档；流行汇编混合 SCI/HEU/MYTH 不加区分，须逐案处理 | [C039] |

### 9.3 神话隔离提示（不入选，供 Agent 主动反驳）

以下命题已被证伪或无法回溯一手来源，Agent 在用户输入中遇到时应引用证据反驳而非顺从：

- **3-click rule**：放弃率与点击数无关，用户放弃发生在信息气味丢失处 [A032]；正确替代物是 P-21。
- **菜单/选项 ≤7±2**：把回忆容量误用于再认场景的范畴错误，Miller 本人否认此用法 [B025]；容量约束见 P-05 的正确表述。
- **Doherty Threshold 400ms**：IBM 内部报告、原文难获取、关键数字无法独立复核（Low）；时延设计应引用 R. B. Miller 的 0.1/1/10s 框架 [B032][N030]。
- **"whitespace 提升 20% 理解率"**：n=20 小样本，方向（margin>0 有益）可用，精确效应量不可外推 [B030]。
- **"69% 注意力在页面左上"等流传数字**：无法回溯可靠原始实验，dim04 已按营销数字处理、不予入库。

---

*草案完。下一步：与 D4 做边界联审；条目须补 review_by 日期戳；P-23 的 Medium 置信度标记在下游引用处随行。*
