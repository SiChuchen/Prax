# state_completeness — 测量回执

- 校验方式：app.js 逐函数静态走查（本会话完成，覆盖全部渲染与状态分支）
- ready：初始化即同步 renderAll()（app.js 末尾 try 块），数据内联（data.js 生成 1,280 条），无 fetch/异步 → 页面加载完成即 ready
- empty：renderTable() hit===0 → 空态块 + 『清空全部过滤』按钮；renderTray() 无条目 → 托盘空态文案
- selected：表格行 class="sel" 高亮 + inspector 渲染；Esc 可取消
- error：init try/catch → `.app-error` 错误面板（结构性兜底，正常路径不触发）
- loading：**结构性不可达**——同步内联初始化、零网络请求。这是冻结简报的明确交付约束（"初始数据随首屏就绪，不得以加载态作为可测状态"），加载态不出现即其正确实现
- 结论：四个可达状态均存在且实现 → pass（loading 按约束不适用）
