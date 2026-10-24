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

## 可达性（H-23 AA 底线）

正文 `#e6edf3`（≈14.8:1）、次级 `#9fb0c0`（≈6.4:1）于 `#0d1117`；分类色板为
亮色系（≥3:1 图形对比）；颜色编码配图例/芯片文字（非仅靠颜色）。

## 文件

- `index.html` — 入口（经典 `<script>`，file:// 可直接打开）
- `styles.css` — 紧凑专业暗色范式 + AA 令牌
- `js/data.js` — 种子化数据集与维度注册表（`window.DATA`）
- `js/app.js` — 状态 store（lens/selection/axis + 撤销栈）、分区渲染器、
  `#journey=<step>` 证据 harness（与 UI 事件同一动作管线）
- `evidence/shoot.mjs` — 真实浏览器取证脚本（见下）

## 证据状态（如实记录）

本会话的执行环境**没有提供任何 shell / 浏览器工具**（Bash、CDP MCP、子代理
Bash 均不可用，已逐一验证）。因此：

- 静态验证已完成：数据/状态/渲染管线经源码级审查（含 3 处缺陷修复：
  null 属性序列化、循环闭包捕获、分类维度选中标签格式化）。
- 视觉证据**未能在会话内捕获**。`evidence/shoot.mjs` 是就绪的一键取证脚本
  （本机已验证套路：常驻无头 Edge + Node 内置 WebSocket 走 CDP，本地 http
  8412 / CDP 9223，避开 Windows 保留端口段），执行：

  ```
  node evidence/shoot.mjs
  ```

  即产出 `evidence/shots/01…10.png` + `report.json`（每步 before/after 存储
  快照：选中 id、过滤芯片、可见计数、撤销深度）。脚本派发真实 DOM 事件 +
  CDP 可信键盘事件（Enter 激活、Ctrl+Z）。
- `.mcp.json` 已注册 `chrome` MCP（superpowers-chrome），下个会话批准即得
  `use_browser` 工具。

## 设计会话

Prax：`ds_20261024000046_e6648d02`（greenfield；frame→context→route→inspect
→decide→sdir→reconcile→realize→prepare 全门通过；模式 PAT-DATA-EXPLORER +
Contextual Inspector；信息形状束 dimensional-space 按简报冻结值落档）。
