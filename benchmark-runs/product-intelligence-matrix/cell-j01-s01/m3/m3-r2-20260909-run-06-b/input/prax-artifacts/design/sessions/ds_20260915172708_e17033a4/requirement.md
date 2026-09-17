# Product Brief — cell-j01-s01 (manage × entity-hierarchy)

Benchmark: product-intelligence-matrix（150 格全矩阵，plan 2026-09-02）
Cell: cell-j01-s01 · priority-1 §43 原配对 · 源格：cell-01（matrix.yaml 原文）

## 用户任务（user_job）
- 动词：manage
- 对象：结构化实体集合
- 成功标准：批量操作无误完成

## 信息形状（shape 束：entity-hierarchy）
基数 many / 关系性 medium / 层级性 high / 时间性 low / 密度 high / 维度性 medium / 空间性 none / 易变性 medium / 不确定性 low / 比较需求 none
判别：大量有层级归属的结构化实体集合，成败在批量操作零误伤与状态归属显式。

## 主对象建议
object_type：entity（备选：entity、record）

## 验收种子
批量选择与操作零误伤，状态归属显式

## 交付约束
- 从零实现一个单页 Web 应用（新目录、新代码，不得复用既有业务系统）
- 交付物必须能直接静态打开（根路径 index.html，或构建产物 dist/）
- 页面加载完成即处于可用状态（初始数据随首屏就绪，不得以加载态作为可测状态）
- 不得部署到外部服务；本地可运行、可构建；单页应用，主屏 1 个；不要求后端、账号体系或持久化服务

## 冻结纪律
本简报由基准程序 M2 冻结；执行臂不得要求修改验收标准，只能就歧义提问。（会话 2：会话 1 ds_20260915163456_f5dc0e15 的 sdir 闸门被自动生成的 0.1 SDIR 消耗，而验证器要求会话 SDIR 为 0.2 并含 representation/state_ownership/acceptance/complexity_budget 块；0.2 SDIR 只能在 sdir 闸门处提交持久化，故开新会话按既定设计重放各闸门。）
