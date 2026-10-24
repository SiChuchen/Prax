# 星巡台 ASTRA · cell-j13-s10

**explore × dimensional-space** 的单页实现：在系外行星巡天数据（600 条 × 10 维）上换轴投影、过滤、聚焦 —— **维度切换不重置认知**，且**过滤/投影状态有归属、可回退**。

## 运行

无构建、无依赖、无网络请求：

- 直接双击打开根路径 `index.html`（file:// 协议即可），或
- `python -m http.server` / `npx serve` 后访问（非必需）。

页面加载完成即处于可用状态：数据由 `js/data.js` 内联同步初始化（实测同步启动 ≈ 4ms），无加载态。

## 界面（主屏 1 个，五区骨架）

| 区域 | 职责 |
|---|---|
| 顶部锁点条 | 常驻锚点：当前投影、度量、匹配数、聚焦记录、轨迹深度、活动过滤芯片（含归属 tooltip，点 × 移除） |
| 左侧维度轨 | 10 个维度按族分组，X/Y 换轴按钮、覆盖直方图、漏斗过滤编辑器（分类勾选 / 数量区间） |
| 中央投影画布 | 维度×维度交叉聚合格：分类×分类热力表、分类×数量 / 数量×数量分箱热力；行列表合计；单元格点击下钻为过滤；聚焦落点高亮；度量切换（计数 / 平均·任一数量维度） |
| 右上检查器 | 聚焦记录全维取值 + 当前投影落点（换轴自动更新） |
| 右中记录列表 | 当前过滤匹配记录（ESI 序，前 60 条），点击聚焦 |
| 右下状态轨迹 | 每次过滤/投影变更的快照时间线：归属 = 触发操作 + 来源 + 时间；点击回退；↶↷ 撤销/重做（Ctrl+Z / Ctrl+Shift+Z）；⤺ 回到初始 |

## 设计契约 → 实现机制

1. **维度切换不重置认知**（成功标准）：状态分为 viewport（投影轴）/ query（过滤）/ selection（聚焦）三个所有者，换轴只写 viewport。换轴后锁点条计数、聚焦、轨迹原样保留，并以 toast 明示「维度已切换 · 过滤 n 项、聚焦与轨迹全部保留」。数量维度分箱与覆盖直方图使用全量固定域 —— 过滤/换轴后参照系不漂移。
2. **过滤/投影状态有归属且可回退**（验收种子）：所有变更统一走 `commit(action, source, mutate)` —— 压入完整状态快照，归属元数据 = 触发操作名 + 来源 + 时间戳。轨迹条目即快照引用，点击即恢复；历史点上新操作截断重做分支（标准时间旅行语义）。过滤芯片 tooltip 显示其归属条目。
3. **首屏即用**：`js/data.js` 内联 `window.SURVEY`，同步初始化，无 loading 可测态、无外部请求。

## 数据

`scripts/gen-data.js`（Node 运行）确定性生成（种子 20260903）：600 条系外行星，4 分类维度（发现方法/行星类别/恒星光谱型/天区）+ 6 数量维度（轨道半长轴/半径/质量/平衡温度/距离/宜居指数）。维度间保留相关结构（类别↔半径、温度↔轨道与恒星型、质量↔半径、宜居指数↔温度半径），使探索有真实结构可发现。重新生成：`node scripts/gen-data.js`。

## 测试与证据

- `test/harness.html`：10 项断言在真实浏览器中执行（首屏就绪 / 换轴认知保持 / 归属 / 回退 / 撤销重做 / 键盘 / 下钻 / 空态恢复 / 聚焦落点）。
  运行：`chrome --headless=new --dump-dom file:///<...>/test/harness.html`，读 `<title>`（当前 **HARNESS 10/10 OK**，boot 4.3ms）。
- `shots/01-initial.png`：首屏（真实浏览器截图）。
- `shots/02-journey.png`：真实 DOM 点击旅程 —— 过滤→聚焦→换轴，锁点条/轨迹/聚焦全部保留。
- `shots/03-revert.png`：点击轨迹 #1 回退，X 轴恢复、聚焦清空、游标 2/4、过去态变暗。
- `shots/dom.html`：harness 运行的 DOM 快照存档。

## 设计会话

Prax 设计会话 `ds_20261023205741_2a9a445c`（greenfield）：frame → context → route → inspect → decide（PAT-DATA-EXPLORER）→ sdir（screen_explore_main）→ reconcile（7 项需求全部 frontend_composition/supported）→ realize（direct_code）→ prepare → validate。信息形状：unbounded / medium / medium / low / high / 维度性 high / 空间性 none / 易变性 medium / 不确定性 low / 比较需求 none。
