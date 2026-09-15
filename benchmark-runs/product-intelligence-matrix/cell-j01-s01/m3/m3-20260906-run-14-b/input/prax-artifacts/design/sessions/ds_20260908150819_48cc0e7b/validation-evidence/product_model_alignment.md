# measurement receipt — product_model_alignment
- 运行: msedge --headless --dump-dom "file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j01-s01-b/index.html"（2026-09-08 23:3x，本地无网络）
- 实测: 214 个 class="ent" 表格行；40 个层级树节点（全部实体/研发中心/生产运营/数据平台/基础设施/职能支持…）；状态栏「就绪 · 批量操作经逐项预览确认后生效」「操作记录 (0)」；工具栏「范围：全部实体（含子层级）」「选当前筛选结果 (214)」「选子树全部 (214)」；状态 chip 全局计数 在用100/待分配34/维修中29/已停用34/已退役17。
- 工件: evidence/rendered-dom-first-screen.html（完整渲染 DOM）、evidence/01-first-screen.png
- 结论: 界面对象语言与 Product Frame（entity/domain/category/selection/batch_op/op_record）一一对应，无 backend 术语泄漏。
