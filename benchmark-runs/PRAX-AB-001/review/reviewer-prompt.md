# PRAX-AB-001 盲评任务（Outcome Review）

你是一名独立 UI/UX 与前端工程评审。你的工作目录是 `E:\codex-prj\Prax\Prax`。

## 评审对象

六个匿名实现包，位于 `benchmark-runs/PRAX-AB-001/review/blinded-outcomes/`：

- `impl-1/` … `impl-6/`，每个包含：
  - `screenshots/` —— 真实浏览器截图（**必须逐张 Read 查看**）
  - `review-patch.diff` —— 相对同一基线的完整代码改动（**以这份为准**；见 PACKAGING-NOTE.md）
  - `git-diff.patch` —— 原始审计留档（有已知打包缺陷，评分勿用）
  - `changed-files.txt` —— 变更文件清单

**纪律**：你只知道 impl-1…impl-6。禁止读取以下任何内容：
`review/blinding-map.yaml`、`review/comparison.yaml`、`replicates/` 目录、
任何 summary/summary.yaml、任何 transcript、任何 prax-artifacts。
这些包含臂信息，读了就破坏盲评。

## 背景：它们在解决什么问题

同一需求：修正一个架构画布（Architecture Canvas）的可读性。基线版本的问题
（用户原话性质的拒绝理由）：默认视图像超大缩略图——标签压到不可读、顶层
Region 排成长横条、Landscape 隐藏对象却无摘要、关系线难跟随、Trace 无有序
主路径、Inspector 覆盖画布无相机重构。

六个实现应共同满足的空间/可读性契约：
1. 可读的屏幕空间节点尺寸（验收单位是屏幕空间，不是 fit 前布局宽度）
2. 顶层 Region 二维组合（不是横条）
3. 架构级默认密度（默认不进 Landscape，Region/关键对象标签可读）
4. 画布内容占据有效视口大部分
5. Inspector 停靠化（相机响应停靠/收起）
6. 稳定地图 + 有序 Trace 走廊（入口→步骤→结果可读）

固定约束：保留 Semantic Graph/ELK/React Flow 基础；不靠彩虹配色；画布是
安静、结构化、可读的专业工具（禁 AI SaaS 卡片/营销装饰/永久发光）；Human
Web 只读；现有数据形状兼容。

## 打分：每个 impl 对 R1–R7 各给一个标签 + 一行证据

标签只用：`PASS` / `PASS_WITH_REVIEW` / `INCONCLUSIVE` / `FAIL` / `NOT_APPLICABLE`

- **R1 产品模型对齐**：改动是否围绕用户可理解对象（Region/Object/Relationship/Flow）与六条契约，而非纯渲染细节重构
- **R2 主任务清晰度**：默认视图是否第一眼传达"读架构"为主任务；标签是否不缩放即可读；次级 chrome 是否不抢戏
- **R3 上下文保持**：Browse/Inspect/Focus/Trace 之间切换是否保持连续（选中保持、Inspector 停靠不遮挡、focus/trace 退出可还原）——从截图与 diff 的交互逻辑推断
- **R4 层级与密度**：专业密度是否有结构（二维 Region 组合、画布占视口、无缩略图效应、无过度留白稀释）
- **R5 状态完整性**：loading/empty/ready/selected/error 等状态在 diff 中是否显式处理
- **R6 决策可追溯**：重大结构选择（密度策略、Inspector 停靠方式、Trace 走廊实现）是否在 diff/注释/文档中留有 rationale 与被拒备选
- **R7 关系正确性**：关系 source/target/方向是否保真；是否引入无意义视觉连线；Trace 是否暴露有序主路径；关系语法是否依赖彩虹色

## 输出

把完整结果写入 `benchmark-runs/PRAX-AB-001/review/blinded-scores-1.yaml`，格式：

```yaml
reviewer: reviewer-1
rubric_version: v0.2
scores:
  impl-1:
    R1: { label: PASS, evidence: "…" }
    R2: { label: PASS_WITH_REVIEW, evidence: "…" }
    ...
  impl-2: { ... }
  ...
overall_impression:
  strongest: impl-N   # 一句话理由
  weakest: impl-N     # 一句话理由
notes: >-
  任何你认为评审方应知道的观察（如截图缺失导致某项 INCONCLUSIVE）
```

评分纪律：证据必须具体（引用截图文件名或 diff 中的文件/行为）；不确定就给
INCONCLUSIVE 并说明缺什么证据；不要为了整齐而给 PASS。完成后在终端输出
"SCORES WRITTEN"。
