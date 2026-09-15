# measurement receipt — keyboard
- 运行: msedge --headless --dump-dom "file:///E:/…/index.html?scene=selftest"（真实 DOM 事件：el.click()/new Event('change')/new KeyboardEvent('keydown')）
- 实测输出（DOM #selftest-out 原文）: "SELFTEST 12/12 :: PASS A 树点击… PASS H 撤销→计数恢复 PASS I 键盘 / 聚焦搜索 PASS J 行复选勾选→选择集 PASS K 删除模态门禁…（Esc 关闭） PASS L 状态列排序"
- 键盘相关项: I（"/" 聚焦搜索框）、K（Esc 关闭模态）、J（原生 checkbox 激活=Tab+空格可达）；:focus-visible 全局焦点样式（css/styles.css）。
- 工件: evidence/rendered-dom-selftest.html、evidence/08-selftest-12of12.png
