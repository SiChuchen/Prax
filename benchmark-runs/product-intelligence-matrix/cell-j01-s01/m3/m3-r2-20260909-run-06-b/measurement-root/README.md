# 实体台账管理台（cell-j01-s01 · manage × entity-hierarchy）

面向「大量有层级归属的结构化实体集合」的单页批量管理台。核心命题：**批量选择与操作零误伤，状态归属显式**。

## 运行

零依赖、零构建：直接双击打开根目录 `index.html`（file:// 即可），或任意静态服务器：

```
cd cell-j01-s01-b
python -m http.server 8080   # 或任何静态服务
# 打开 http://localhost:8080
```

初始数据（3 站点 / 9 系统 / 20 单元 / 160 实体）内联于 `data.js`，随首屏同步就绪——
页面加载完成即处于 ready 状态，不存在可测的加载态。无后端、无账号、无持久化
（内存态，刷新还原；简报明确不要求持久化服务）。

## 零误伤机制（验收种子：批量选择与操作零误伤）

| # | 机制 | 说明 |
|---|------|------|
| 1 | **可见即作用域** | 行复选框、分组复选框、「全选可见」都只作用于**当前渲染可见**的实体行。折叠分支内的实体、被搜索/状态筛选隐藏的实体，在机制上进不了选择集 |
| 2 | 分组复选框三态 | 只统计该分组**当前渲染可见的下属实体**（含各展开层级）；折叠分支不贡献可见实体，故不会被选中 |
| 3 | 显式选择集 | 右侧检查器常驻列出选择集（按归属路径分组、逐项可移除）；普通点击行只设锚点不改选择，防误选 |
| 4 | 强制影响预览 | 批量状态变更 / 移动归属 / 删除执行前，模态按归属路径分组列出受影响实体与计数，需显式确认；取消不产生任何变更 |
| 5 | 移动归属零效果防线 | 目标分组与全部所选归属相同时，显式报错「影响 0 项」并阻止执行 |
| 6 | 回执 + 撤销 | 执行后常驻回执「已影响 N 项」+ 影响明细，可一步撤销（快照还原，含删除） |

## 状态归属显式

- 每个实体行常驻：状态徽标（在线 / 维护中 / 停用）+ 完整归属路径列（站点 / 系统 / 单元）
- 树表即结构：分组行展开/折叠承载层级，组头显示「直接数/下级总数」与三态选择进度
- 回执、预览、检查器中的每一条变更都带归属路径

## 交互

- 搜索（名称/编码）、状态筛选；筛选激活时自动揭示匹配分支
- 键盘：`Tab` 进入树表，`↑/↓` 移动行焦点，`Space` 勾选/取消，`←/→` 或 `Enter` 折叠/展开分组，`Home/End` 首末行；焦点在重渲染后保持
- `Shift+点击`：从锚点行到当前行的范围选择（仅当前可见行）

## 结构

```
index.html   入口（经典脚本，file:// 可直接打开）
data.js      内联种子数据（mulberry32 固定种子，确定性）
app.js       状态、选择器、动作、渲染（零依赖）
styles.css   设计令牌与紧凑密度样式
selftest.js  浏览器自证场景（仅 ?selftest=1 激活；正常打开零影响）
```

## 浏览器验证（一键证据）

`selftest.js` 内置 9 个阶段（stage 0..8）的累积场景与断言（初始渲染 / 折叠+分组勾选零误伤 /
筛选作用域全选 / 批量状态变更预览-执行-回执 / 撤销 / 移动归属 0 项错误态与取消保持 /
删除+撤销还原 / 键盘操作 / 空态），通过真实 DOM 事件驱动，结果渲染进
`#selftestPanel` 与 `<pre id="selftest-json">`。无头 Chromium 一条命令即可产出截图与断言：

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu ^
  --user-data-dir="%TEMP%\chrome-headless-cell" --window-size=1440,900 --virtual-time-budget=8000 ^
  --screenshot="stage3.png" ^
  "file:///<本目录>/index.html?selftest=1&stage=3"
```

（追加 `--dump-dom` 可导出含 JSON 断言结果的 DOM。页面正常打开——不带查询参数——完全不加载自证逻辑。）

> 环境备注：本执行臂会话内无 shell 与浏览器自动化工具（已用工具检索双重验证），
> 上述命令即为留给操作者的证据采集路径；所有断言逻辑随交付物自带、可复跑。

## 设计会话

Prax design session `ds_20260915172708_e17033a4`（greenfield，SDIR 0.2 于 sdir 闸门持久化）：
pattern `PAT-LIST-DETAIL-INSPECTOR` · density compact · realization direct_code。
产物见 `.prax/design/sessions/ds_20260915172708_e17033a4/`
（product-frame / design-decisions / screen.sdir / capability-gaps / validation-plan）。
前身会话 `ds_20260915163456_f5dc0e15`：sdir 闸门被自动生成的 0.1 SDIR 消耗，
验证器要求 0.2（含 representation/state_ownership/acceptance/complexity_budget），
故开本会话按同一设计重放；设计内容两会话一致。

## 验证状态（如实记录）

- 11 项验证检查：6 项确定性检查全部 **pass（measured）**；
  4 项 assistive/deterministic 静态检查 **pass（attested）**；
  2 项需真实渲染的检查（keyboard、hierarchy_review）**inconclusive**。
- 原因：本执行臂会话内无 shell、无浏览器自动化工具（已按工具装载契约用 ToolSearch
  双重验证；三种子代理类型亦均不可执行）。未伪造任何浏览器证据。
- 证据补全路径：见上文「浏览器验证」——任一操作者一条命令即可产出 9 阶段截图与断言 JSON。

实现说明：本臂会话环境中无 shell/npm 可用，故采用零构建原生 JS（无 React 运行时依赖），
区域结构、状态所有权与组件契约严格遵循 Prax 实现简报（WORKSPACE / STATE-FEEDBACK）。
