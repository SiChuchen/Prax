# Knowledge Intake Protocol (spec §7.4, research §52 / Appendix C)

任何"优秀前端样本"进入 Prax 知识资产前必须逐条回答研究文档 §52（Appendix C）
的 18 问——**原文照录，不许改写**：

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

第 14 问是品牌风格过滤（不泛化）；第 16 问强制反例（没有反例的规则不收录）；
第 17/18 问绑定 acceptance contract 与浏览器/用户证据——收据化验证的前置。

## 稳定性分级规则（研究 §48，spec §7.1）

- **A**：当前证据较强（§48A 层）——跨范式验证 + 反例齐全。
- **B**：强趋势，仍需实验（§48B 层）——多样本一致但因果未闭。
- **C**：不应写成通用规则（§48C 层）——进入 myth 隔离条目（`myth-` 前缀），
  refutation 反驳全称量词而非域内价值。

升降级：stability 变更需要 `evidence.review_by` 复审记录；C→A/B 必须补
多范式反例证据（§48A/B 判据）。首批迁移的 A 级为**临时级**
（`data/stability-assignments.draft.yaml`，全部 `confirmed: false`）——
人工确认后才能作为最终分级。

## 首批语料（corpus-2026-09）

首批 ≥20 条收录自研究 Appendix A 的 120 样本矩阵（`data/corpus-2026-09.yaml`）：

- 每条 `type: product_evidence` / `asset_class: representation`——单个样本的
  表达组合证据，不是可泛化规则；
- `trigger_conditions` 六面编码自矩阵行（task_type 动词按 19 动词表对齐，
  超出词表的动词按钉定同义表映射：read→review、reference→locate、follow→monitor、
  discover→explore）；
- `authority_initial: C`（样本编码级）、`review_by` 首批复审日期；
- 收录规程即上述 18 问；矩阵行是工作表精简版，Primary Representation 可含
  hybrid 表达（Appendix A 说明），编码时保留 hybrid 语义。
