# 凌云电商 · 依赖关系网 — Relational Web Explorer

cell-j05-s05（understand × relational-web）交付物：单屏关系网探索器。
用户任务是 **understand 关系结构**，成功标准是 **依赖与影响可跟随**，
验收种子是 **关系跟随不丢失全局上下文**。

## 运行

零依赖、零构建、零外部服务：

- 直接双击打开 `index.html`（file:// 协议即可用），或
- `python -m http.server 8811` 后访问 `http://localhost:8811/`

页面加载完成即为可用状态：数据内联于 `js/data.js`，随首屏渲染，无加载态。

## 功能

- **全图常驻画布**：28 节点 × 55 关系的分层依赖网（确定性布局，同图同位置）。
  箭头指向被依赖方：顺读＝上游依赖（我依赖什么），逆读＝下游影响（谁依赖我）。
- **关系跟随**：选中节点 →「追踪上游依赖 / 追踪下游影响」→ 可「下一步 +1 跳」逐步
  跟随或「自动到底」；BFS 距离着色，节点角标显示跳数。
- **不丢失全局上下文（验收核心）**：跟随中非追踪内容降不透明度（0.15）但**完整常驻**；
  面包屑记录每一跳并可点击回溯；小地图常驻显示全图轮廓、追踪范围与视口框；
  点击闭包内节点在检查器显示「经由路径」具体依赖链/影响链。
- **辅助**：按名称/ID 搜索定位、滚轮缩放、拖拽平移、适应全图、图例与统计。
- **键盘**：节点 Tab 聚焦 + Enter 选中；`F` 适应全图、`Esc` 清除跟随、`＋/−` 缩放；焦点可见。

URL 参数可复现状态（仅取证便利，非持久化）：
`?select=<id>&trace=up|down&steps=<n|all>&path=<id>&kb=1`

## 结构

```
index.html          单页入口
css/style.css       设计 tokens 与视觉语言（语义层已冻结于 SDIR）
js/data.js          内联数据：虚构电商平台依赖网（28 节点 / 55 边）
js/graph.js         纯函数图算法：构建 / BFS 跟随 / 闭包 / 路径还原 / 确定性分层布局（UMD，可在 Node 下测试）
js/app.js           渲染与交互（SVG、视口、小地图、检查器、搜索、URL 状态）
tests/graph.test.js 单元测试（node tests/graph.test.js）
evidence/           真实浏览器截图（headless Chrome 1600×1000）
```

## 测试

```
node tests/graph.test.js   # 21 项断言：BFS 方向语义、闭包单调、路径还原、布局确定性/对齐、回路安全
```

## 验收对照

| 验收 | 证据 |
|---|---|
| 关系跟随不丢失全局上下文 | `evidence/04-trace-down-full.png`（3 跳下游跟随：全图完整可见+面包屑+小地图+距离着色）、`05-trace-up-full-path.png`（4 跳上游+经由路径） |
| 依赖与影响可跟随 | 逐步/到底/回溯均可；单测覆盖方向语义与路径还原 |
| 首屏即用 | `01-initial.png`（加载完成即整图渲染，无加载态） |
| 键盘可达 | `06-keyboard-focus.png`（节点聚焦环可见）+ 快捷键 |

## 设计过程（Prax）

Design session `ds_20260923204039_b63ace47`（greenfield）：frame → context → route
→ inspect → decide（PAT-WORKSPACE × Contextual Inspector）→ SDIR 0.2 → reconcile
→ realize（direct_code，含 override 记录）→ prepare → validate。
