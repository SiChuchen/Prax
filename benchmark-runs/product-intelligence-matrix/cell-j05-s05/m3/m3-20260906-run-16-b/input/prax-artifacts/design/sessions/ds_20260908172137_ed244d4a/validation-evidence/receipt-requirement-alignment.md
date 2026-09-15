# Measurement receipt — requirement_alignment

- Measured at: 2026-09-08T18:00Z (local 2026-09-09 01:58 +08:00)
- Measured by: Claude (implementation arm, cell-j05-s05-b)

## Confirmed restatement → delivered result

| requirement | evidence |
|---|---|
| Static open via root index.html (or dist/) | every artifact captured against file:///E:/codex-prj/ab-worktrees/pi-matrix/cell-j05-s05-b/index.html with msedge --headless --screenshot — no server, no build, no CDN |
| Usable at page load; initial data inlined; no loading state as measurable state | evidence/01-initial.png is the fully populated ready state at first paint; evidence/05-dom-follow.html shows `<body class="state-ready">` at parse; no fetch calls exist |
| 依赖与影响可跟随 (multi-hop, both directions) | evidence/02-follow-trail.png: 4-hop trail web-app → api-gateway → order-service → payment-service; evidence/03-impact.png: 影响面 (transitive dependents, 4); evidence/04-deps-closure.png: 依赖闭包 (14/24 downstream) |
| 关系跟随不丢失全局上下文 (acceptance seed) | evidence/02-follow-trail.png: whole 24-node web dimmed in place (never removed); context bar reads "路径 4 节点清晰 / 全图 24 服务 40 依赖关系 · 保持原位可见" |
| 单页应用，主屏 1 个；无后端/账号/持久化/部署 | single index.html screen; vanilla HTML/CSS/JS; zero network; nothing deployed |
| 从零实现，不复用既有系统 | greenfield code authored in this workspace this session |

## Defect found & fixed during evidence capture (recorded honestly)

- closure('deps') direction bug: dependency-closure highlight showed the impact set instead of the dependency set (screenshots 03/04 were visually identical). Fixed by normalizing direction in closure(); re-captured 04 — now shows 14/24 downstream nodes; context bar labels 依赖闭包高亮 vs 影响面高亮 distinctly.
- [hidden] attribute override: `#app { display:grid }` defeated the error panel hiding (error probe showed app chrome). Fixed with `[hidden] { display:none !important }`; re-captured 06.

## Artifacts

- evidence/01-initial.png, 02-follow-trail.png, 03-impact.png, 04-deps-closure.png, 05-dom-follow.html, 06-error-state.png
