# 选址决定台（cell-j09-s03 · decide × comparison-panel）

单页静态 Web 应用：为 40 人团队在 4 个候选办公选址之间做决定。

- **主任务**：decide × 位置敏感的选项，成功标准 = 决策输入同屏可得
- **信息形状**：comparison-panel —— few 候选 · 高密度 · 比较必需，比较状态全程驻留同屏
- **验收种子**：地理语境与决策项同屏（左侧区位图 ↔ 右侧比较矩阵，恒常共驻一屏）

## 运行

零依赖、零构建：直接用浏览器打开根路径 `index.html` 即可（双击或任意静态服务器）。
所有数据内联于首屏脚本，页面解析完成即处于 ready 态，无加载态；完全离线可用，
不请求任何外部服务（区位图为内联 SVG 示意图，非瓦片地图）。

## 功能

- **区位图**（地理语境）：漕河、地铁 M1/M3、≈15/30min 通勤圈、团队重心、客户总部、
  高铁站、4 个候选点（含到最近地铁口的步行距离标注）
- **比较矩阵**（主工作面）：4 组 14 项标准 × 4 候选，一行一标准、一列一候选
- **行内优胜标注**：每行按权重方向即时计算优胜格（并列双标），色带 + 「优」角标
- **权重滑杆**：每标准 0–5，即时重算优胜与加权总分，领先者随时驻留顶栏
- **选中联动**：地图候选点 ↔ 矩阵列双向高亮（悬停预览、点击锁定、←/→ 切换）
- **排除 / 恢复**：不合格候选退出优胜与总分计算（全部排除时决定栏进入空态提示）
- **敲定此处**：显式落定决定，决定驻留顶栏 + 地图「已选定」标旗 + 列头徽记，可重选或重置

## 设计会话

Prax 设计会话 `ds_20260915150653_a22fc0e1`（greenfield）：
frame / context / route / inspect / decide / sdir / reconcile / realize / prepare 全部通过；
主结构 PAT-DATA-EXPLORER（tabular alignment），表示：primary=table，supporting=map+chart；
拒绝卡片网格（card-grid-for-dense-comparison 反模式）与弹层决定输入。
验证阶段：12/12 检查通过（含键盘焦点序实测回执，见
`.prax/design/sessions/ds_20260915150653_a22fc0e1/validation-evidence/`）。

## 浏览器实证

`.evidence/shots.js`（puppeteer-core + 本机 Chrome，18 项断言）与
`.evidence/measure-focus.js`（Tab 焦点序实测 + 测量回执生成）为实证脚本，
非交付物；交付物仅为根路径 `index.html` 与本说明。
