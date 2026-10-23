# Product Brief — cell-j01-s01 (manage × entity-hierarchy)

Benchmark: product-intelligence-matrix（150 格全矩阵，plan 2026-09-02）
Cell: cell-j01-s01 · priority-1 §43 原配对 · 源格：cell-01（matrix.yaml 原文）

## 用户任务（user_job）

- 动词：manage
- 对象：结构化实体集合
- 成功标准：批量操作无误完成

## 信息形状（shape 束：entity-hierarchy）

| facet | 取值 |
|---|---|
| 基数 | many (many) |
| 关系性 | 中 (medium) |
| 层级性 | 高 (high) |
| 时间性 | 低 (low) |
| 密度 | 高 (high) |
| 维度性 | 中 (medium) |
| 空间性 | none (none) |
| 易变性 | 中 (medium) |
| 不确定性 | 低 (low) |
| 比较需求 | none (none) |

判别：大量有层级归属的结构化实体集合，成败在批量操作零误伤与状态归属显式。

## 主对象建议

- object_type：entity
- 建议备选：entity、record

## 验收种子（acceptance seed）

批量选择与操作零误伤，状态归属显式

## 交付约束

- 从零实现一个单页 Web 应用（新目录、新代码，不得复用既有业务系统）
- 技术栈自选；交付物必须能直接静态打开（根路径 index.html，或构建产物 dist/）
- 应用在页面加载完成时即处于可用状态（初始数据随首屏就绪，不得以加载态作为可测状态）
- 不得部署到外部服务；本地可运行、可构建
- 规模上限：单页应用，主屏 1 个；不要求后端、账号体系或持久化服务

## 预算上限（超出即停，如实记录）

- wall-clock ≤ 90 min
- token ≤ 1.2M（AB-001 中位数的 1.5 倍）

## 冻结纪律

本简报由基准程序 M2 冻结（见 git 历史与 phase report 2026-09-03）；执行臂不得要求修改验收标准，只能就歧义提问（操作算子记录并对两臂对等回答）。
