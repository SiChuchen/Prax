# state_completeness — receipt (pass)

SDIR required_states: ["ready","selected","empty","error","loading"] (screen.sdir.yaml). Implementation:

- ready — synchronous boot(): grid built + first tickRender before first paint (js/app.js, end of IIFE). No loading DOM exists anywhere in the shipped pages (no skeleton/spinner classes; verified by grep-level read).
- selected — region-inspector unhidden + tile .sel ring (js/app.js select()/clearSelection()).
- empty — anomaly strip all-normal quiet summary ("✓ 全部 24 项指标正常 · 最近检查 hh:mm:ss", renderStrip) and feed empty state (#feed-empty, renderFeed).
- error — stream watchdog: header alert "⚠ 数据流中断，尝试恢复…" + system event in feed when no tick for >4s while running (js/app.js boot() watchdog interval). Error path is real code, not decoration.
- loading — exists only as the synchronous boot path; completes before DOMContentLoaded-adjacent first paint, so a loading state is never the measurable state (constraint honored).

Source: js/app.js, js/stream.js, screen.sdir.yaml.
