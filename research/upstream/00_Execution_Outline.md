# Systemsmith Design Intelligence 研究交付物执行大纲

研究阶段已完成（8 维度 dim 文件 + cross_verification + insight，位于 /mnt/agents/output/research/）。
本大纲是写作阶段的执行契约。所有交付物输出到 /mnt/agents/output/systemsmith-research/。
语言：中文（引用原文可保留英文）。引用方式：统一使用 Source Registry 全局 ID（如 [S012]），由 D2 注册表先行建立。

## 依赖关系
- Round 0：D2 Source Registry（先行，为所有写作提供全局来源 ID）
- Round 1（并行）：D1a/D1b/D1c（主报告三段）、D3、D4、D5、D6、D7、D8
- Round 2：D9（依赖 D3/D7/D8 草稿结论）+ D1 合并
- Round 3：审校

## 交付物规格

### D1 UIUX_Foundation_Research.md（主报告，~3 万字，三段合并）
- D1a 章节：1 HCI 历史与理论脉络（HCI 学科史→三次范式：人因工程/认知范式/设计转向）；2 核心标准（ISO 9241 全系列版本状态表 + HCD 过程模型比较）；3 核心理论（Nielsen/Norman/Shneiderman，含原始出处与批判）；4 认知基础（感知/记忆/认知负荷/定律，scientific vs heuristic vs myth 三分类）。输入：dim01, dim02, insight, cross_verification
- D1b 章节：5 信息架构（四系统、OOUX/心智模型→页面结构推导、导航模式实证）；6 交互设计模式（Pattern Language 方法论兴衰、20 模式 problem→context→forces→tradeoffs 结构）；7 视觉设计基础（视觉属性表达信息语义、密度/排版/网格、"不专业"六病因）；8 无障碍（WCAG 2.2/3.0 状态、ARIA APG、自动化验证分层、baseline 建议）。输入：dim03, dim04, dim05, insight, cross_verification
- D1c 章节：9 可用性评估（HE/CW/测试指标/SUS/HEART、自动化可行性分层）；10 平台设计系统（Apple/M3/Fluent，universal vs convention 分离）；11 企业设计系统与设计令牌（Primer/EUI/Carbon/ADS 横向比较、DTCG、三层 token 模型）；12 AI/Agent 影响（知识形式化、Agent Skills、LLM 评审边界、SDIR 先例与定位）。输入：dim04, dim05, dim06, dim07, dim08, insight, cross_verification

### D2 Source_Registry.md + Source_Registry.csv（Round 0）
合并 8 份 dim 文件的 Source Registry，去重，分配全局 ID（S001…），修正 cross_verification 发现的 4 组 authority level 矛盾，标注 primary/secondary、版本、URL、authority level。

### D3 Universal_Design_Principles_Draft.md（~20-30 条原则）
每条含：ID/Name/Definition/Why/Evidence(Registry ID)/Applies When/Does Not Apply When/Examples/Counterexamples/Related Principles/Potential Conflicts/Validation Possibility。严格只收"真正跨技术栈"的原则；合并重复包装（指出共同根源）；标注证据等级。输入：dim01,02,03,04,05 + insight

### D4 UX_Heuristics_Draft.md
与 D3 严格区分：heuristic = 经验性判断工具（适用面广但可违反、需评估者判断）。每条含：ID/名称/来源/适用 scope/评估问题（heuristic evaluation 可用的检查问题）/自动化可能性/已知例外。输入：dim02, dim04 + insight

### D5 Design_Knowledge_Taxonomy.md
完整 taxonomy（Human Factors/Cognition/Perception/Interaction/IA/Visual/Accessibility/Navigation/Feedback/Errors/Data Exploration/Evaluation/Platform/Knowledge Engineering…），每个节点：定义、核心概念、关键来源 ID、知识类型（scientific/heuristic/convention/myth）、在 Systemsmith 分层中的位置。输入：全部 dim + insight

### D6 Pattern_Language_Research.md
Pattern Language 方法论史（Alexander→GoF→Tidwell→企业 DS Patterns 层）、独立 pattern 库死亡原因、Systemsmith Pattern Library 建设方案（pattern 结构 schema、治理、与组件库的关系、首批建议模式清单）。输入：dim03, dim06 + insight

### D7 Design_Rule_Schema_Draft.yaml
≥3 个候选 Rule Schema（如：扁平规则条目 / 三层渐进披露（Agent Skills 式）/ policy-as-code 式），每个含完整 YAML 示例与 trade-off 分析；含冲突裁决字段（priority layer、lex specialis/posterior、场景条件）、验证方式字段、provenance 字段。输入：dim08, dim07 + insight

### D8 SDIR_Prior_Art_and_Feasibility.md
先例全景（声明式 UI DSL / MBUID / Cameleon / UsiXML / MARIA / design-to-code / LLM UI 生成）、失败四因、LLM 时代新变量、明确回答：SDIR 是否值得做 + 正确抽象边界（Semantic IR vs Render IR、边界守护原则、裁量点显式建模）。输入：dim07, dim08 + insight

### D9 Design_Intelligence_Architecture_Recommendations.md（Round 2）
重审 L0–L7 分层（验证/修改/合并/推翻，基于 insight ①"语义域/渲染域硬边界"重切）；证据分级与冲突优先级修正版；Knowledge→Retrieval→Reasoning→SDIR→Validation→Implementation 流水线设计；**明确逐条回答 Q1–Q15**；下一步实施路线图（Q15）。输入：insight + cross_verification + D3/D7/D8 草稿 + 全部 dim 摘要
