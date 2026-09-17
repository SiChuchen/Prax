# Product Brief — cell-j09-s03 (decide × comparison-panel)

Benchmark: product-intelligence-matrix（150 格全矩阵，plan 2026-09-02）
Cell: cell-j09-s03 · priority-1 §43 原配对 · 源格：cell-09（matrix.yaml 原文）

## 用户任务（user_job）
- 动词：decide
- 对象：位置敏感的选项
- 成功标准：决策输入同屏可得

## 信息形状（shape 束：comparison-panel）
| facet | 取值 |
|---|---|
| 基数 | few (few) |
| 关系性 | 中 (medium) |
| 层级性 | 低 (low) |
| 时间性 | 低 (low) |
| 密度 | 高 (high) |
| 维度性 | 中 (medium) |
| 空间性 | none (none) |
| 易变性 | 中 (medium) |
| 不确定性 | 低 (low) |
| 比较需求 | required (required) |

判别：少量高密度条目并排比较，比较本身是任务、比较状态必须驻留同屏。

## 主对象建议
- object_type：location
- 建议备选：item、location

## 验收种子（acceptance seed）
地理语境与决策项同屏

## 交付约束
- 从零实现一个单页 Web 应用（新目录、新代码，不得复用既有业务系统）
- 技术栈自选；交付物必须能直接静态打开（根路径 index.html，或构建产物 dist/）
- 应用在页面加载完成时即处于可用状态（初始数据随首屏就绪，不得以加载态作为可测状态）
- 不得部署到外部服务；本地可运行、可构建
- 规模上限：单页应用，主屏 1 个；不要求后端、账号体系或持久化服务
