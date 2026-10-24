# measurement receipt — 核心旅程：维度切换上下文保持 + 过滤归属回退

- measured_at: 2026-10-24T02:05Z
- instrument: chrome MCP use_browser（真实 click + 可信 keyboard_press + Runtime.evaluate 状态断言）
- session dir: C:/Users/SiChuchen/AppData/Local/superpowers/browser/2026-10-24/session-1792803214149

## 旅程与断言（App 只读钩子 + DOM 双重验证）

| 步骤 | 操作 | 实测 |
|---|---|---|
| 1 | 点击表首行 | selection="r16"（Kepler-4128 b），inspector「已选中」+ 恒等卡 |
| 2 | 点击凌星法条形 | 芯片「图表 发现方法 ∈ {凌星}」，visible 420→166 |
| 3 | 维度栏点 行星半径 | x="radius"，直方图重投影；**selection/filters/visible 全部不变**；selBand 渲染（截图 fix-04） |
| 4 | Ctrl+Z（可信键盘事件） | x 回 "method"，undoStack 2→1，selection/过滤保持（截图 fix-05） |

页脚最近操作：「切换 X 轴 → 行星半径（选中 保持 · 过滤 1 项保持）」。

## 对应验收

- 成功标准：维度切换不重置认知 — 步骤 3 实测保持。
- 验收种子：过滤/投影状态有归属且可回退 — 芯片带「图表」归属标签；步骤 4 撤销回退。
