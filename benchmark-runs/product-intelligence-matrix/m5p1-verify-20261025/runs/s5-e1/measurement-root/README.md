# 维界 Lens — cell-j13-s10（explore × dimensional-space）

单屏多维数据集探索器。基准：product-intelligence-matrix 150 格全矩阵 · cell-j13-s10（priority-1 §43）。

## 运行

零构建、零依赖、纯静态：

- **直接打开**：双击 `index.html`（file:// 协议即可用，经典脚本无 CORS 限制），或
- **静态服务**：任意静态服务器指向本目录（如 `python -m http.server`）后访问根路径。

页面加载完成即处于 **ready** 可用状态：480 条 record × 14 维度的合成数据集随首屏内联（`data.js` 同步生成），**不存在可测的加载态**（`loading` 按 SDIR 设计为不可达态）。无后端、无账号、无外部服务、不部署。

## 功能 ↔ 简报映射

| 简报要求 | 实现 |
|---|---|
| explore × 多维数据 | 14 个维度（产品线/平台/区域/渠道/状态/优先级/负责人/季度/来源/标签/版本线/语言/风险等级/客户规模）+ 3 数值指标（MRR/DAU/健康分）× 480 条 |
| **维度切换不重置认知**（成功标准） | 切换「观察轴」只改变网格组织轴与维度面板焦点；选中行、过滤、投影、排序、搜索、变更轨迹全部跨维度保留 |
| **过滤/投影状态有归属**（验收种子） | 顶部常驻 lens-bar：类型着色 chips（过滤/投影/排序/观察轴/搜索），每条标注作用对象，tooltip 可溯源到引入步骤（#序号+时间）；「作用于 · 数据集」归属徽标 |
| **…且可回退** | 单一 lens 状态所有者 + revision 时间旅行：逐条 undo/redo（Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y）、chip × 逐条移除、变更轨迹点击任意步跳转（后续操作分叉）、reset 一键回初始（本身可撤销） |
| 基数 unbounded / 密度 high | 可滚动表格行集 + 实时匹配计数 + 紧凑高密度布局（compact） |
| 关系性/层级性 medium | 分面计数条、同维排序、色彩编码；不引入 graph/map/tree（空间性 none、比较需求 none） |

## 键盘

| 键 | 行为 |
|---|---|
| `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y` | 撤销 / 重做（输入框聚焦时不劫持） |
| `Esc` | 取消选中 |
| `/` | 聚焦跨维度搜索 |

## 结构

```
index.html    入口（根路径静态可开）
data.js       确定性合成数据集（mulberry32 种子 20260902，内联生成）
app.js        lens store（revision 时间旅行）+ SDIR 区域渲染/事件
styles.css    compact 设计令牌（对比度 ≥4.5:1，焦点可见，目标尺寸 ≥24px）
```

SDIR 区域契约：`data-region = lens-bar / overview / dimension-panel / data(dominant) / inspector(selection_driven) / trail`；状态契约：`data-app-state = ready / selected / empty / error`（完整性校验失败进入 error）。

## 验证证据（真实浏览器）

Prax 测量器（prax-measure 0.2.0）于 `http://127.0.0.1:8451/` 对交付树实测两视口（1280×860 / 1440×900）：

- 布局 0 溢出、0 碰撞、0 截断；对比度 0 失败；焦点顺序 21 停靠点 0 倒置 0 缺失指示；目标尺寸 0 不足
- 截图与 receipt：`.prax/design/sessions/ds_20261025084723_a4485245/validation-evidence/`
- 验证门最终状态 **PASS / COMPLETE**（12/12 检查通过，receipt 已绑定实现树 digest）

已知非阻塞项：`type.min_projected_size` warning（次级文本 10–11.5px）——SDIR 已声明 `density_intent=compact`，符合检查建议的密度意图豁免路径。

## 预算记录（如实）

- wall-clock ≈ 45 min（≤ 90 min 上限内）
- token ≈ 0.17M（≤ 1.2M 上限内）
- 环境偏差（已记录为项目 correction `corr-vanilla-nobuild-delivery`）：本执行环境无 shell/构建工具链，Prax 实现 brief 的 framework 字段为固定枚举 `react`，实际按零构建 vanilla JS 交付；DOM 语义与 SDIR 完全对齐，验收以浏览器实测为准。
