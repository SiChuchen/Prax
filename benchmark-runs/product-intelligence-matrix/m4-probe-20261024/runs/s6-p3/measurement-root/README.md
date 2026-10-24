# EXO·LENS — 系外行星维度探索（cell-j13-s10）

explore × dimensional-space 单屏应用：对 420 条记录 × 10 个维度的「系外行星目录」
做可换维投影探索。**维度切换不重置认知**（成功标准）；**过滤/投影状态有归属且
可回退**（验收种子）。

## 运行

无依赖、无构建、无网络请求：

- 直接双击打开 `index.html`（file:// 即可），或
- 任意静态服务器托管本目录（如 `python -m http.server`）。

页面加载完成即处于可用状态：数据集由确定性种子生成器（mulberry32，seed
20260242）在脚本解析期同步构建（420×10，含受控相关性：成像→远距巨行星、
质量≈半径幂律、热木星短周期等），随首屏就绪，不存在加载流程。

## 使用

- **投影**：左栏三个固定选择器（X 轴 / Y 轴 / 颜色）。X 为分类 → 堆叠条形；
  X 为数值 → 28 桶直方图；X、Y 均为数值 → 散点。坐标定义域固定为全量数据的
  维度定义域（不随过滤缩放）——坐标系是稳定认知锚点。**切换维度只重投影中央
  视图**，镜头条 / 维度栏 / 检查器 / 页脚位置与内容全部不动。
- **选中**：点击散点或记录表行。选中以稳定 id 为键，跨维度切换、跨过滤保持；
  检查器恒等卡展示该记录全部 10 维取值（数值维度带定义域位置标记）。
- **过滤**：直方图/条形点击刷选（来源标注「图表」）、图例点击（来源「图例」）、
  内联构建器（来源「手动」）。每条过滤是带归属的芯片：`来源 · 维度谓词 · ×`。
- **回退（三级）**：单芯片 ×；`Ctrl+Z` 撤销栈（页脚显示步数）；「重置镜头」
  一键回退过滤+投影到默认（自身可撤销）。X/Y/颜色三个投影芯片常驻显示当前
  指派，× 回退该轴到默认。

## 键盘

`Tab` 遍历控件（芯片 ×、维度按钮、图表刷选区、记录行均可聚焦）；`Enter/Space`
激活刷选/选中；`Ctrl+Z` 撤销；`:focus-visible` 可见焦点（2px 描边）。

## 可达性（H-23 AA 底线，实测）

正文 `#e6edf3`（≈14.8:1）、次级 `#9fb0c0`（≈6.4:1）、弱化态 `#7d8fa1`（≈5.2:1，
不用 opacity）于 `#0d1117`；全部文本 ≥12px（SVG ≥13px 投影补偿）；交互目标
≥24×24（芯片 × 24px、图例 26px、散点 24px 透明命中圆）；`:focus-visible` 2px
可见焦点；DOM 顺序 = 视觉/tab 顺序（brand→lensbar→rail→view→inspector→table→foot）。
自动化审计（CDP 实测 1680×950）：min 对比 5.47:1、min 目标 24px、min 文本 12px。

## 文件

- `index.html` — 入口（经典 `<script>`，file:// 可直接打开）
- `styles.css` — 紧凑专业暗色范式 + AA 令牌
- `js/data.js` — 种子化数据集与维度注册表（`window.DATA`）
- `js/app.js` — 状态 store（lens/selection/axis + 撤销栈）、分区渲染器、
  `#journey=<step>` 证据 harness（与 UI 事件同一动作管线）
- `evidence/shoot.mjs` — 真实浏览器取证脚本（见下）

## 证据状态（真实浏览器，已捕获）

`chrome` MCP（superpowers-chrome，CDP）已在本会话获批并用于实测：

- 自动化 a11y 审计（Runtime.evaluate，1680×950）：**min 对比 5.47:1（原 2.24，
  根因是 opacity 弱化态，已改为显式 `--dim2`）**；**min 交互目标 24px**（芯片 ×
  18→24、图例/按钮 ≥26、散点加 24px 透明命中圆）；**min 文本 12px**（原 10px
  徽章/10.5px 栏头/SVG 10.5px tick 已全部提升）；**焦点顺序 = 视觉顺序**
  （inspector 移到 tablepane 之前、表行冗余 tabindex 移除；113 个可聚焦点）。
- 核心旅程实测（真实 click + 可信键盘事件）：选中 r16 → 图表刷选过滤 → 切
  X=行星半径 → **选中/过滤/计数 166 全部保持**，直方图重投影 + 选中带标注；
  **真实 Ctrl+Z** 撤销回 x=发现方法（undoStack 2→1）；空态（过滤无匹配）+
  重置镜头恢复均验证。
- 截图：`evidence/shots/fix-01-initial-ready.png`、`fix-04-dimswitch-context-kept.png`、
  `fix-05-undo.png`（均已人工目检）。
- `evidence/shoot.mjs` 保留：一键重放完整 10 步旅程取证（`node evidence/shoot.mjs`）。

## 设计会话

Prax：`ds_20261024000046_e6648d02`（greenfield；frame→context→route→inspect
→decide→sdir→reconcile→realize→prepare 全门通过；模式 PAT-DATA-EXPLORER +
Contextual Inspector；信息形状束 dimensional-space 按简报冻结值落档）。
