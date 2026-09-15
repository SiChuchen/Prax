# filter_state — 测量回执

- 校验方式：代码静态审查（数据结构 + 渲染路径完整闭环）
- 活跃过滤器显式表示：`store.filters` = [{id, dim, valueIdx, origin, at}]（app.js）——每条带归属维度与来源
- 结果状态显式呈现：header『当前命中 N』、表尾『命中 N 条 · 显示前 60 条』、分布条『N 条』计数
- active_state 托盘逐条渲染：kind 徽标（过滤/投影）+ 归属维度 + 取值摘要 + origin + 单条 × 回退；孤儿过滤器带『不在当前投影 · 仍生效』标注
- 回退闭环：单条 ×（removeFilter op）→ Ctrl+Z（undoStack）→ Reset All（快照式 op，可撤销）
- 行为断言已就绪：evidence/scenario3.html S6/S7/S11–S17 直接检验上述各点（自包含页，双击即得 PASS/FAIL；本会话无法执行浏览器）
- 结论：过滤与结果状态显式表示完整 → pass（运行时断言留复核路径）
