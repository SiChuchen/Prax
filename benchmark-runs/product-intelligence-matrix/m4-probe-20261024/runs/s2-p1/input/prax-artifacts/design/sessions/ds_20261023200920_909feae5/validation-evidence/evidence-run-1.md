# Validation evidence run 1 — cell-j13-s10 / ds_20261023200920_909feae5

采集：2026-10-23T21:15Z · 真实浏览器 Edge 155 headless（CDP，Node 24 内置 WebSocket）
环境：本地 http://127.0.0.1:8412/（另做 file:// 直开验证）
产物：`evidence/shots/01–11 *.png` + `evidence/shots/report.json`（逐步 before/after 状态快照）
脚本：`evidence/shoot.mjs`（10 步场景，真实 DOM 事件派发）、`evidence/filecheck.mjs`

## 共同基线（report.json step01）

`dataStatus=ready, spinner=false, railRows=10, tableRows=60, visible=480, focusRingVisible=true`
首屏即 ready：数据内联（js/data.js 480×10），无加载态可测。

## 各检查回执

### product_model_alignment — pass
- 证据：shots/01、shots/06；六产品对象以用户语言呈现：维度轨（dimension）、状态条 chips（filter/projection 带归属）、状态轨迹（state_trail）、记录检查（selection detail）。
- step01 DOM 计数：维度轨 10 行、明细表 60 行、chips 初始 0（默认投影提示文案）。

### keyboard — pass
- step06：合成 `KeyboardEvent("Enter")` 于维度轨 → X 切至 适生指数；`KeyboardEvent("c")` → 颜色=发现方法（state.proj 实际变更）。
- step08：`Ctrl+Z` 两次 → past 8→6 / future 0→2（撤销实测生效）。
- step01：维度轨首项 `focus()` 后 computed outline/box-shadow 非空（focusRingVisible=true）。
- 快捷键契约：Enter / ⇧Enter / P / C / S（维度轨）、Ctrl+Z / Ctrl+Y（全局）、表头 Enter 换排序。

### hierarchy_review — pass
- shots/01：data surface（scatter 舞台）为 dominant 最大区域（~55% 高度居中）；维度轨 238px / 检查器 302px 为 primary/supporting；状态条 34px 常驻；无装饰 chrome；compact 密度（12.5px 基准）。

### filter_state — pass
- step04 after：`filters=["画像拖刷:radius:3.9-9.4"], chips=2, visible 480→86`；chip 文案「画像拖刷 · 半径 ∈ [3.92, 9.36] R⊕ ×」（归属=动作+维度，×可单条移除）。
- step07 after：单条移除后 `filters=[], visible=480`。
- 顶栏行计数「行 480 → 86 可见 · 选中 37」常驻显式呈现结果状态。

### comparison_scan — pass
- shots/01、shots/06：明细表 60 行 × 3 数值列（X/Y/画像）免开详情即可扫读；列头点击/Enter 换排序维（▼/▲指示）；维度画像直方图 + 维度轨 sparkline 同屏。

### requirement_alignment — pass（核心判据：维度切换不重置认知）
- step06 before→after（一次操作串内换 X/颜色/画像/排序四维）：
  - proj：`{mass,temp,cls,radius,mass} → {habit,temp,detection,period,period}`（换维生效）
  - **不变**：sel=37、filters=[画像拖刷:radius:3.9-9.4]、k=1.18（缩放）、focus=2、visible=86
- 回退链：chips 单条移除（step07）→ Ctrl+Z×2 恢复（step08）→ 复位（step09：state==INITIAL，sel 0 / chips 0 / k 1）→ 状态轨迹条目点击时间回退（jumpTo，轨迹带 #seq/动作/维度）。
- 空状态：step10 chk `status=empty, overlay=true`（shots/10）。
- file:// 直开：`protocol="file:", status=ready, visible=480`（shots/11-file-open.png）。
- 交付注记：implementation brief 的 framework 常量为工具侧固定值（react）；交付遵循冻结简报「根路径静态直开」与 SDIR rejected-alternatives 的 vanilla 决策（realization=direct_code）。

### semantic_conformance — pass
- 服务端 SDIR 校验 PASS（无 schema/semantic error）；canonical 区域 data(dominant)/collection/state bar/inspector/detail(selection_driven) 与 index.html 区块一一对应。

### state_completeness — pass
- ready（step01）、empty（step10，overlay+复位入口+表格「无匹配行」）、error（app.js 初始化 try/catch → `data-status=error` 全屏提示）。
- loading 为声明性状态：数据内联同步初始化，不可达即设计意图（无加载态是简报的可测要求）。

### representation_decided — pass
- design-decisions.yaml：representation.primary=canvas（散点投影舞台，非空 reason）；supporting=list/chart/table；justification_vs_shape 对抗 card-grid 默认（myth-card-grid-default）。

### state_ownership_declared — pass
- SDIR state_ownership：selection→app store（行级持久）、query→app store（状态链+trail 唯一所有）、viewport→canvas（store 持有，换维保留比例）、inspector→app store、mode→app store。
- 实现：js/app.js 单 store（clone/mutate/undo/redo/jumpTo），换维仅写 proj 子树。

### acceptance_contract_present — pass
- SDIR acceptance 5 条：换维保留（shots/06）、chips 归属+单条移除（04/07）、首屏 ready（01）、刷选生成 chip（04）、AA 对比度（深色 token 对比度 ≥4.5:1 设计，正文 #d9e0e8 on #171d24）。

### complexity_budget_declared — pass
- 4 永久面板 / 3 永久主动作 / 1 模式 / 1 状态所有者 / 1 导航层级 / 8 持久过滤上限 / 3 新语义概念 / 2 键盘契约 / 0 移动冲突 / 4 永久表面。
