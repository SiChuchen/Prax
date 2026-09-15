# Product Brief — cell-j10-s09 (complete × consequential-flow)

Benchmark: product-intelligence-matrix（150 格全矩阵，plan 2026-09-02）
Cell: cell-j10-s09 · priority-1 §43 原配对 · 源格：cell-10（matrix.yaml 原文）

## 用户任务（user_job）

- 动词：complete
- 对象：高后果流程
- 成功标准：零失误走完全程

## 信息形状（shape 束：consequential-flow）

| facet | 取值 |
|---|---|
| 基数 | one (one) |
| 关系性 | 低 (low) |
| 层级性 | 高 (high) |
| 时间性 | 低 (low) |
| 密度 | 低 (low) |
| 维度性 | 中 (medium) |
| 空间性 | none (none) |
| 易变性 | 中 (medium) |
| 不确定性 | 中 (medium) |
| 比较需求 | none (none) |

判别：单一高后果流程，零失误走完全程、不可逆步骤有恢复/确认路径。

## 主对象建议

- object_type：workflow
- 建议备选：workflow

## 验收种子（acceptance seed）

不可逆步骤有恢复/确认路径

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

本简报由基准程序 M2 冻结（见 git 历史与 phase report 2026-09-03）；执行臂
不得要求修改验收标准，只能就歧义提问（操作算子记录并对两臂对等回答）。
