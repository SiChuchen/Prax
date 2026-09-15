# Product Brief — cell-j06-s06 (understand × temporal-sequence)

Benchmark: product-intelligence-matrix（150 格全矩阵，plan 2026-09-02）
Cell: cell-j06-s06 · priority-1 §43 原配对 · 源格：cell-06（matrix.yaml 原文）

## 用户任务（user_job）
- 动词：understand
- 对象：随时间演化的状态
- 成功标准：变更因果可读

## 信息形状（shape 束：temporal-sequence）
| facet | 取值 |
|---|---|
| 基数 | many (many) |
| 关系性 | 中 (medium) |
| 层级性 | 中 (medium) |
| 时间性 | 高 (high) |
| 密度 | 中 (medium) |
| 维度性 | 中 (medium) |
| 空间性 | none (none) |
| 易变性 | 中 (medium) |
| 不确定性 | 低 (low) |
| 比较需求 | none (none) |

判别：随时间演化的多元素序列，变更因果与时间结构必须互相一致。

## 主对象建议
- object_type：change_set
- 建议备选：change_set、dataset

## 验收种子（acceptance seed）
时间结构与变更语义一致

## 交付约束
- 从零实现一个单页 Web 应用（新目录、新代码，不得复用既有业务系统）
- 技术栈自选；交付物必须能直接静态打开（根路径 index.html，或构建产物 dist/）
- 应用在页面加载完成时即处于可用状态（初始数据随首屏就绪，不得以加载态作为可测状态）
- 不得部署到外部服务；本地可运行、可构建
- 规模上限：单页应用，主屏 1 个；不要求后端、账号体系或持久化服务

## 预算上限（超出即停，如实记录）
- wall-clock ≤ 90 min
- token ≤ 1.2M

## 冻结纪律
本简报由基准程序 M2 冻结（见 git 历史与 phase report 2026-09-03）；执行臂不得要求修改验收标准，只能就歧义提问（操作算子记录并对两臂对等回答）。
