# state_ownership_declared — 测量回执

- 校验方式：design_sdir(mode=validate) PASS（本会话）；读取 screen.sdir.yaml（v0.2）state_ownership 块
- selection → owner=data（记录表；store.selectedId，跨投影保持）
- preview → owner=data（分布图条形 title hover 提示）
- query → owner=session（app.js store.filters / store.projection；active_state 托盘为其归属视图）
- inspector → owner=detail（跟随 selection）
- viewport → owner=data（表格滚动位置）
- selection 与 preview 均有显式 region owner → pass
