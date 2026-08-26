# Systemsmith Design Intelligence — 基础理论研究交付包

研究完成：2026-08-25 ｜ 方法：8 维度并行深度研究（≥180 次检索）→ 交叉验证 → 9 份交付物 → 独立终审（PASS WITH FIXES，已全部修复）

## 交付物清单（D1–D9）

| # | 文件 | 内容 |
|---|---|---|
| D1 | `UIUX_Foundation_Research.md` | 主报告（12 章）：HCI 史 / ISO 9241 / Nielsen·Norman·Shneiderman / 认知基础 / IA / 交互模式 / 视觉 / 无障碍 / 评估 / 平台系统 / 企业系统与 Tokens / AI-Agent 影响 |
| D2 | `Source_Registry.md` / `Source_Registry.csv` | 278 条来源，全局 ID（N/A/B/C/D/E 六级权威分级），provenance / 版本 / 置信度标注 |
| D3 | `Universal_Design_Principles_Draft.md` | 29 条跨技术栈通用原则（含证据/适用边界/反例/冲突/验证方式）+ 同源合并与降级记录 |
| D4 | `UX_Heuristics_Draft.md` | 31 条评审启发式（Nielsen 改编 + 视觉/IA/专业工具）+ 9 条神话隔离区 + HE 执行规程 |
| D5 | `Design_Knowledge_Taxonomy.md` | 三正交切面分类法（15 域 × 7 知识类型 × 5 消费方式）+ 语义域/渲染域第一切分 + ID 编码方案 |
| D6 | `Pattern_Language_Research.md` | Pattern 方法论谱系与死亡教训 + Systemsmith Pattern Schema + 24 模式映射 + 首批 19 条清单 |
| D7 | `Design_Rule_Schema_Draft.yaml` + `Design_Rule_Schema_说明.md` | 3 个候选规则 Schema（扁平/三层渐进披露/policy-as-code）+ 冲突裁决机制 + B+C 混合推荐路径 |
| D8 | `SDIR_Prior_Art_and_Feasibility.md` | SDIR 先例全景（Cameleon/MARIA/MBUID/design-to-code）+ 边界守护原则 + 可行性结论与最小词汇表 v0 |
| D9 | `Design_Intelligence_Architecture_Recommendations.md` | L0–L7 重审与修正架构 + 证据分级/冲突链修正 + 流水线设计 + **Q1–Q15 逐条回答** + 风险登记 + 90 天计划 |

## 核心结论速览

1. **存在足够成熟的跨栈理论**——但分层：原则层（感知/认知/反馈/控制）成熟可引用；"关系层"（importance/density/priority 语义）是工业空白，恰是 Systemsmith 的独占定位。
2. **L0–L7 分层方向正确但需重切**：第一切分应为「语义域 / 渲染域」硬边界（两域四带），L2 宪法是价值取向不是知识层，证据分级与冲突裁决是横切机制。
3. **SDIR 值得做**，但正确定位 = 设计决策记录层 + Agent 推理脚手架（类比 ADR 而非编译器 IR）；边界守护原则：IR 中不允许出现无法在非视觉模态下保持意义的陈述。
4. **Web 无障碍 baseline = WCAG 2.2 AA** + 选择性 AAA（2.3.3 / 2.4.13 / 2.5.5）。
5. **知识必须结构化**（三层渐进披露 + 可判定子集 lint 化），"全塞 context"已被多重证据证伪；LLM 设计评审只能初筛，终裁必须人或真实用户测试。
6. **证伪的神话**（防御性识别）：3-click rule、菜单 ≤7 项、Doherty 400ms。

## 支撑材料

- `research/`（/mnt/agents/output/research/）：8 份维度研究简报 + 交叉验证 + 跨维度洞察
- `99_Review_Report.md`：独立终审报告（PASS WITH FIXES → 修复完成）
- `00_Execution_Outline.md`：执行大纲
- `archive/`：D1 写作中间稿（权威版本以 D1 合并版为准）

## 建议阅读顺序

D9（结论与路线图）→ D3/D4（知识内容）→ D5（组织结构）→ D7（Agent 消费格式）→ D8（SDIR 决策）→ D1（完整论证）→ D6（模式库）→ D2（来源核查）
