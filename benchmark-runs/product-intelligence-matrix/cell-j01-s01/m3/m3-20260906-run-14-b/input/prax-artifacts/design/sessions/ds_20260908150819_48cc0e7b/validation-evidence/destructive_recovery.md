# measurement receipt — destructive_recovery
- 运行: dump-dom "?scene=delete" 与 "?scene=undo"；自测场景 G/H（真实 DOM 事件）
- 实测: 删除模态 btn-confirm disabled=true 且 modal-error="请先勾选确认框"（未勾选时）；勾选后按钮启用「确认删除 N 项」。
- 自测 G: 确认执行 35 项改状态 → 回执「✓ 已将 35 项状态改为「已停用」」，已停用 chip 34→69（+35，逐项守恒）。
- 自测 H: 点击撤销 → 回执「已撤销：…」，已停用 chip 69→34 精确恢复；dump-dom "?scene=undo" 实测表格已停用徽章回到基线 46。
- 工件: evidence/04-delete-confirm.png、evidence/06-receipt-after-batch.png、evidence/07-undo-and-oplog.png
