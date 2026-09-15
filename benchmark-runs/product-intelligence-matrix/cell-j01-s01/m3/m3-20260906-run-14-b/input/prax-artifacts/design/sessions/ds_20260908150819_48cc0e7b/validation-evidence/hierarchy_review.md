# measurement receipt — hierarchy_review
- 运行: msedge --headless --screenshot（1680×950）首屏与预览模态场景
- 实测: evidence/01-first-screen.png 表格区占据内容区主体（支配面 region-table=dominant）；左树 262px 定宽（region-tree=primary）；操作条仅选择后出现、深色底+accent 顶边强调（evidence/02 截图可见，region-actionbar=primary, selection_driven）；状态栏单行支撑信息（region-statusbar=supporting）。字号 13px 基准（css/styles.css body 与 --font）。
- 结论: 视觉比重与 SDIR importance 排序一致，无装饰性元素。
