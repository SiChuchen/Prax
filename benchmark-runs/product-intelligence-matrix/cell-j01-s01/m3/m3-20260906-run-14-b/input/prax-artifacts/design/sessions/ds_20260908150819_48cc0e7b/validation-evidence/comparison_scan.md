# measurement receipt — comparison_scan
- 运行: msedge --headless --dump-dom 首屏
- 实测: 五状态徽章 tone-ok/info/warn/muted/danger（在用/待分配/维修中/已停用/已退役）在表格行内直接可扫；树节点 mbar 微条 title 属性含分状态计数（如「在用 23」）；状态 chip 全局计数 100/34/29/34/17（合计 214）。
- 结论: 状态归属无需打开任何详情即可在三处扫读比较；214 行同屏滚动可及。
- 工件: evidence/01-first-screen.png、evidence/07-undo-and-oplog.png
