# measurement receipt — keyboard（键盘可操作性）

- measured_at: 2026-10-24T02:05Z
- instrument: chrome MCP use_browser — keyboard_press（可信 OS 级键盘事件）+ Runtime.evaluate
- session dir: C:/Users/SiChuchen/AppData/Local/superpowers/browser/2026-10-24/session-1792803214149

## 事件序列（真实浏览器）

1. click `#table-body tr[data-id] .rowbtn` → App.state.selection = "r16"（Kepler-4128 b），
   inspector 徽章「已选中」+ 恒等卡（004 click 存档）。
2. click `#view-body svg .hit`（凌星法条形）→ 过滤芯片出现（111→112 buttons，005 存档）。
3. eval 点击维度按钮 行星半径 → x="radius"，直方图重投影（006 eval 存档）。
4. **keyboard_press ctrl+z（可信键盘事件，事件 007）** → DOM before/after diff 存档于
   007-keypress-before/after.html；随后 eval 实测：
   - App.state.x: "radius" → "method"（撤销成功）
   - App.state.undoStack.length: 2 → 1
   - selection 保持 "r16"，过滤保持 ["图表:method"]，visible 166 不变
   - 视图回到 6 根条形（bars: 6）
   截图：evidence/shots/fix-05-undo.png

## 机制核查（源码级，配合实测）

- 主动作全部为原生 `<button>`（Enter/Space 激活由 HTML 语义保证）或
  tabindex+keydown（表行按钮、SVG 刷选区 .hit、选中散点命中圆 .pt-hit）。
- document 级 Ctrl+Z 处理器（preventDefault）。
- `:focus-visible` 2px 描边（styles.css）；tabbable 113，无正 tabindex。

## 结论

主要工作（换维/过滤/选中/撤销/重置）均可键盘操作且有可见焦点；实测通过。
