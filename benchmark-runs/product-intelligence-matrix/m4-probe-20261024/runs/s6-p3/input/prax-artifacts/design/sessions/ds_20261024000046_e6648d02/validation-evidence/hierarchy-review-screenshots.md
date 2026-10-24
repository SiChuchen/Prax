# measurement receipt — hierarchy_review（视觉层级）

- measured_at: 2026-10-24T02:05Z
- instrument: chrome MCP (superpowers-chrome 3.0.1) use_browser — CDP 实渲染
- session dir: C:/Users/SiChuchen/AppData/Local/superpowers/browser/2026-10-24/session-1792803214149
- viewport: 1680×950, page: file:///E:/codex-prj/ab-worktrees/pi-matrix-m4/s6-p3/index.html

## 观测

截图（已复制到项目 evidence/shots/）：

- fix-01-initial-ready.png — 初始态：dominant 投影视图居中（6 根按恒星光谱型堆叠的条形），
  lens_bar/维度栏/检查器 primary 常驻，records_table（200px 行）与 status_footer supporting。
- fix-04-dimswitch-context-kept.png — 切换后：28 桶直方图 + 黄色选中带 + 选中标注
  「选中：Kepler-4128 b（2.7 R⊕）」；芯片「图表 发现方法 ∈ {凌星}」；计数胶囊 166/420。

自动化 a11y 审计（同一 CDP 会话，Runtime.evaluate）：

- min 文本对比度 5.47:1（≥4.5 AA）
- min 交互目标 24px（≥24 WCAG 2.2 Target Size Minimum）
- min 文本 12px / SVG 投影 ≥13px
- tabbable 113，焦点顺序无显著视觉回跳（仅 rail→中心列的列序跳转，符合网格阅读序）

## 结论

视觉显著性排序 = SDIR importance（projection_view dominant > lens_bar/dimension_rail/
inspector primary > records_table/status_footer supporting）。
