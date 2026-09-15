# measurement receipt — filter_state
- 运行: msedge --headless --dump-dom "index.html?scene=selected"（真实代码路径：子树全选→状态筛选）
- 实测字符串: 警示条「已选 23 项中有 10 项被当前筛选/范围隐藏——批量操作仍会包含它们。」；操作条「已选 23 项 （10 项当前不可见，仍将包含）」；表尾「已选 23 · 可见 … · 范围内 …」。
- 自测场景 C（真实 DOM 事件）断言通过（SELFTEST 12/12 之内）：筛选改变后选择集保持 42 项不变且警示出现。
- 工件: evidence/02-selected-hidden-warning.png、evidence/rendered-dom-selftest.html
