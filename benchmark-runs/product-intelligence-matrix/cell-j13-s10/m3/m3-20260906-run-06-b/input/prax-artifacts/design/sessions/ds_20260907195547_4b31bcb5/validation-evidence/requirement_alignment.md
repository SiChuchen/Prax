# requirement_alignment — 测量回执

- 状态：**inconclusive（成功标准的运行时证明被沙箱阻塞；静态范围已逐条对齐）**
- 已核对（工件级）：
  - 根路径 index.html 静态打开：4 个静态文件（html/css/js×2），无构建、无模块、无 fetch/外部 URL、无 CDN
  - 首屏即用：data.js 同步生成 1,280 条（种子 20260908），app.js 同步首渲染，无加载态
  - 单页单屏；无后端/账号/持久化；未部署
  - 确认过的复述（restatement）三要素在 UI 全部落地：投影切换、维度值过滤、带归属可回退的状态托盘
- 『维度切换不重置认知』按构造保证：makeSetProjection 只写 store.projection，不触碰 store.filters / store.selectedId；S8–S15 断言直接检验该不变量
- 阻塞事实：本会话无浏览器/shell（详见 keyboard.md 沙箱记录）。运行时证明路径：双击 evidence/scenario3.html（S1–S17）与 evidence/scenario4.html（N1–N4），或执行 evidence/run.ps1
