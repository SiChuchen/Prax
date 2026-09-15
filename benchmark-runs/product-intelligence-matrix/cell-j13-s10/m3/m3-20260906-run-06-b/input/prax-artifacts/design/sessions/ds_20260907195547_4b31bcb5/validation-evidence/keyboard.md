# keyboard — 测量回执

- 状态：**inconclusive（运行时证据被沙箱阻塞）**
- 沙箱事实：本会话无任何进程/浏览器执行工具。已逐项验证不可用：Bash（ToolSearch select 无此工具）、general-purpose / codex:codex-rescue / superpowers-chrome:browser-user 子代理（工具集解析后均无执行能力）、CronCreate（仅排程 prompt）、WebFetch（无 JS 执行）、webReader（拒绝 file:// 且不执行 JS）。因此无法进行真实键盘操作取证。
- 已实现的键盘支持（静态定位到代码）：
  - 分布条形 = 原生 `<button>`（Enter/Space 原生触发，aria-pressed）
  - 记录行 = `<tr tabindex="0">` + Enter/Space 选择处理器（app.js:525-529）
  - 维度展开/投影/取值 = 原生 button + checkbox
  - 全局快捷键 Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z / Esc（app.js:566-573）
  - `:focus-visible` 可见焦点环（styles.css）；渲染后焦点按 data-k 恢复（app.js:208-222）
- 复核路径：任何浏览器打开 `evidence/scenario3.html`，Tab 移动焦点、Ctrl+Z 撤销；或执行 `evidence/run.ps1`
