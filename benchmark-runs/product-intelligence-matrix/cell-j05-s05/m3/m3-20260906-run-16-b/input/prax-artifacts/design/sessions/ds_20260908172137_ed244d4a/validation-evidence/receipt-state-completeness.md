# Measurement receipt — state_completeness

- Measured at: 2026-09-08T18:00Z (local 2026-09-09 01:58 +08:00)
- Measured by: Claude (implementation arm, cell-j05-s05-b)
- Method: headless Edge (msedge --headless --screenshot / --dump-dom, --virtual-time-budget=4000) against file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j05-s05-b/index.html and evidence/error-probe.html.

## Observed states

| state | observation | artifact |
|---|---|---|
| ready | full 24-node / 40-edge graph at first paint; context bar "全局视图 · 24 服务 · 40 依赖关系 · 全部可见" | evidence/01-initial.png |
| selected | node selected + trail + inspector populated | evidence/02-follow-trail.png, 03-impact.png, 04-deps-closure.png |
| empty | inspector empty-state at load (01); search "无匹配服务" branch in app.js bindSearch() | evidence/01-initial.png |
| error | body.state-error, styled 数据错误 panel with message "内联数据缺失或为空：nodes/edges 必须非空数组。" | evidence/06-error-state.png (+ evidence/error-probe.html) |
| loading | unreachable by design: DOM dump shows `<body class="state-ready">` at parse; render synchronous from inlined data.js; zero runtime fetches | evidence/05-dom-follow.html |
