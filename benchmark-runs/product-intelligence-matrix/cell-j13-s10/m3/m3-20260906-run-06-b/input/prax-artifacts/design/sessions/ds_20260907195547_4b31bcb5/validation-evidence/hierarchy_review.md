# hierarchy_review — 测量回执

- 状态：**inconclusive（渲染证据被沙箱阻塞，无截图）**
- 层级实现与 SDIR importance 的静态映射：
  - data（dominant）→ 三列 grid 中列 `minmax(0,1fr)`，占最大幅面；图表为最强视觉元素（P-22 Signal over Chrome：控件弱化、灰阶 chrome）
  - collection / active_state（primary）→ 两侧 272px/316px 常驻面板
  - detail（contextual, selection_driven）→ 右下面板，无选中时为引导文案
  - density=compact：12.5px 基准、密排行高、组头分隔线（H-13 结构化密度）
- 视觉 prominence 的最终确认需真实渲染截图；`evidence/run.ps1` 可产出（本会话无法执行）
