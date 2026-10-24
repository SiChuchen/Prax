# KEPLER-EXT 480 · 多维探索台

**cell-j13-s10 · explore × dimensional-space** — 单页 Web 应用（greenfield，vanilla JS，无构建、无依赖、无网络请求）。

## 运行

- **直接打开**：双击 `index.html`（file:// 已验证可用，见 `evidence/shots/11-file-open.png`）。
- 或起任意静态服务器：`python -m http.server` / `node tools/gen-data.mjs` 同级的任意 serve 均可。

首屏即就绪：数据集（480 行 × 10 维，`js/data.js` 内联常量）随脚本同步加载，无加载态。

## 这是什么

面向"explore 多维数据"的探索工作台。核心成功标准：**维度切换不重置认知**。

- **维度轨**（左）：10 个维度（6 数值 / 3 类别 / 1 布尔），带角色徽标（X/Y/色/像/序）与迷你分布。
  键盘：`Enter`=X，`Shift+Enter`=Y，`P`=画像，`C`=颜色，`S`=排序。
- **投影舞台**（中，dominant）：canvas 散点（换 X/Y/颜色维即时重投影，被过滤行以 ghost 保持上下文）；
  维度画像（直方图拖刷 / 类别条点击 = 过滤）；明细表（列头点击换排序维，点行=选中）。
- **状态条**（顶）：过滤/投影/选中的每个状态都是一枚 chip，**带归属标签**（产生动作 + 维度），
  可单条 × 移除；`撤销 (Ctrl+Z)` / `重做 (Ctrl+Y)` / `复位`。
- **检查器**（右）：选中记录全维度明细 + **状态轨迹**（每条变更带归属，点击任意条目回退到该状态）。

认知连续性的实现根基：`proj / filters / selection / focus / view(缩放)` 全部挂在数据集或行级，
换维只写 `proj` 子树 → 选中、过滤、缩放、焦点跨维度切换保留。

## 目录

```
index.html          入口（根路径直接打开）
css/app.css         token + 布局（compact dark）
js/data.js          内联数据集（tools/gen-data.mjs 生成，种子 20260902）
js/app.js           状态模型 / trail / canvas 渲染 / 交互
tools/gen-data.mjs  数据生成器
evidence/           真实浏览器证据（Edge + CDP）
  shoot.mjs           采集脚本（10 步场景 + 断言 + 截图）
  measure.mjs         a11y.focus_order 实测（真实 Tab 穿越）+ 绑定回执生成
  filecheck.mjs       file:// 直开验证
  probe.mjs           拖刷链路诊断（保留作记录）
  shots/*.png         截图证据 + report.json（逐步状态快照）
.prax/              Prax 设计会话（frame/context/route/decide/sdir/reconcile/realize/validate）
```

## 验收种子 → 实现

**过滤/投影状态有归属且可回退**
- 归属：每条状态记录 `{tag(动作), label, dim, origin}`；chips 与状态轨迹同源渲染。
- 回退：单条 chip 移除 / Ctrl+Z·Ctrl+Y / 一键复位 / 轨迹条目点击时间回退（jumpTo）。
- 证据：`evidence/shots/04`（拖刷生成归属 chip）→ `06`（换维后三枚 chip 与选中 37 行、缩放 1.18 原样保留）
  → `07`（单条移除 86→480 行）→ `08`（Ctrl+Z 两次恢复）→ `09`（复位）→ `10`（空状态）。

预算：wall-clock 与 token 见交付说明（上限 90 min / 1.2M）。
