# 设备资产工作台 — cell-j01-s01（manage × entity-hierarchy）

面向「管理大量有层级归属的结构化实体集合」的单页 Web 应用。领域实例化为医院
设备资产台账（4 中心 / 13 科室 / 196 台设备，5 种生命周期状态）。成败判据：
**批量选择与操作零误伤，状态归属显式**。

## 运行

无需构建、无外部服务、无网络请求：

- 直接双击打开 `index.html`（file:// 即可），或
- `python -m http.server` / 任意静态服务器后访问根路径。

页面解析期同步装配种子数据（`seed.js`，确定性生成），**首屏完成即处于可用状态，
不存在加载态**。功能自检页：`tests/run-tests.html`（浏览器内断言套件，12 个场景）。

## 文件

| 文件 | 作用 |
|---|---|
| `index.html` | 应用本体（内联样式与 UI 逻辑，单主屏） |
| `seed.js` | 种子数据（页面解析期同步构建 `window.SEED`，等价内联数据） |
| `app-core.js` | 纯逻辑层：层级索引 / 筛选 / 选中集 / 批量操作 / 撤销（不触 DOM，与应用、测试共用） |
| `tests/run-tests.html` | 真实浏览器执行的断言套件（零误伤为核心场景） |
| `scripts/gen-seed.mjs` | 已弃用占位（本环境无 Node 通道；数据权威来源为 seed.js） |

## 零误伤机制（对应验收种子）

1. **选中集与视图解耦**：选中集是显式实体 ID 集合（`Set`），定位/筛选/搜索/折叠只改
   变可见性，绝不增删选中成员。已选但被隐藏的实体在托盘以
   「⚠ N 项不在当前可见范围（批量操作仍包含）」显式计数提示，可一键显示。
2. **快照绑定**：批量操作（改状态 / 移动归属 / 删除）执行前经确认对话框，对话框
   绑定当时选中集快照；`Core.applyBatch` 只触碰快照内的 ID。
3. **回执强一致**：回执区分「确认 N 项 / 影响 M 项」；已处目标状态（归属）的实体
   如实计入 skipped 而非影响数；对话框内预演 hidden 与 skipped 数量。
4. **整体撤销**：每次操作入撤销栈，撤销按同一快照逆向恢复状态与归属（仅该集合），
   可逆序多次撤销；行内单台状态修改同样入栈。
5. **选中只经显式动作**：行复选框、Shift 范围选、树节点「选 N」（带数量预览）、
   「＋全选可见 (N)」；点击树节点名称仅定位过滤，绝不隐式选中；表头勾选指示为
   信息性，不代替用户执行全选。
6. **状态归属显式**：每行常驻彩色状态徽标（行内下拉可直接修正）与完整归属路径
   「中心 / 科室」；批量移动后路径即时刷新；树上以「选 N」徽标显示各子树选中数。
7. **显式报错而非静默部分成功**：移动归属遇「待报废」设备（业务规则）时对话框
   阻止执行、逐台列明，并提供「从选中集排除这 N 项」的补救动作。

## 交付约束核对

- 静态可开：根路径 `index.html`，零依赖、零 CDN、零字体请求 ✔
- 首屏可用：数据同步内联，无 loading 态 ✔
- 本地可运行、未部署 ✔
- 单页单主屏；无后端 / 账号 / 持久化（刷新回到种子数据，属简报明示的边界）✔

## Prax 设计会话与验证结果（如实记录）

会话 `ds_20260918185228_83959c3b`（greenfield）：frame → context → route → inspect →
decide（PAT-WORKSPACE × PAT-RESOURCE-MANAGEMENT，compact）→ sdir → reconcile
（持久化 = 简报明示的 explicit_compromise）→ realize（direct_code）→ prepare →
validate（plan / submit_evidence / evaluate ×3）。

**evaluate 最终状态：BLOCK，4 项 unresolved，如实报告如下。**

| 检查 | 结果 | 说明 |
|---|---|---|
| semantic_conformance / state_completeness / representation_decided* / state_ownership_declared* / acceptance_contract_present* / complexity_budget_declared | measured | *后三项 fail：评估器读取的是 prepare 时刻物化的 SDIR 工件，validate 门内不可再物化（prepare/apply_delta 均 GATE_NOT_SATISFIED），而 lint 已通过的 0.2 完整内容不回写该工件。已在 design_sdir mode=validate 取得 PASS（含 table+tree+list 表示、selection+preview 双 owner、6 条 acceptance、complexity_budget），并记录 correction `sdir-artifact-materialization-vs-validate-gate` 至 `.prax/corrections.yaml`。 |
| product_model_alignment / hierarchy_review / destructive_recovery / requirement_alignment | attested pass | 代码工件检视 + `tests/run-tests.html`（浏览器可执行断言套件 T1–T12，含零误伤逐字段核验、skipped 如实报告、删除→撤销精确恢复、逆序多级撤销）。 |
| keyboard | **inconclusive** | 本执行环境无 shell/浏览器工具（ToolSearch 全模式检索确认），无法产出运行时键盘走查取证；按不伪造证据原则如实标记，留待有浏览器通道的验收方复核（Tab 遍历 + Shift 范围选 + Esc 即可验证）。 |

**真实浏览器截图：本会话未能产出**（执行通道缺失，见上）。视觉与交互的验收证据
= 打开 `index.html` 直接检查 + 打开 `tests/run-tests.html` 一键复跑断言套件。

状态覆盖：ready（首屏）/ empty（筛选空与全删空两分支）/ selected（托盘与行态）/
error（移动规则阻止 + 补救）；loading 已声明但按交付约束不作为可测状态。
键盘契约：Shift 范围选、Esc 关闭对话框。

## 预算（如实记录）

- token：约 16 万（上限 120 万）✔
- wall-clock：约 45 分钟（上限 90 分钟）✔
