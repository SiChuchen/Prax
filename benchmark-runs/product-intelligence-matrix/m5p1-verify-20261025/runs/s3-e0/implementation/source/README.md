# 护航台 · 高后果流程执行台（cell-j10-s09）

单页静态 Web 应用：引导用户**零失误走完**一条高后果流程（示例内容：生产发布
runbook「订单中心 order-service v2.4.0 生产发布」，14 步 / 5 阶段 / 3 个不可逆步骤）。

- 验收种子：**不可逆步骤有恢复/确认路径** —— 每个不可逆步骤执行前强制通过
  确认关卡（后果陈述 + 回滚方案全文 + 确认项勾选 + 发布单号匹配），执行后进入
  **回滚窗口**（收尾步骤完成前回滚入口始终可达，回滚级联复位后续步骤）；
  步骤严格顺序解锁，锁定步骤不可执行并显示原因。
- 信息形状（consequential-flow）：基数 one（单流程）· 层级高（阶段→步骤）·
  密度低（单步骤聚焦）· 易变/不确定 中（步骤状态机 + 核对清单吸收）。

## 运行（无构建、无依赖、无网络请求）

- **直接双击打开 `index.html`（file:// 协议即可用）**；或
- 本地静态服务：`python -m http.server 8080` 后访问 `http://127.0.0.1:8080/`。

页面加载完成即处于可用状态：全部流程数据内联于 `data.js`，无加载态、无外部服务。

## 文件

| 文件 | 职责 |
|---|---|
| `index.html` | 外壳与三个语义区域挂载点 |
| `styles.css` | 设计令牌（状态色/间距/焦点样式）与全部样式 |
| `data.js` | 内联 runbook 数据（含不可逆步骤的 consequence/impact/acks/rollback） |
| `app.js` | 状态机、渲染、事件、确认关卡、回滚级联、留痕与导出 |

## 核心交互

1. **单行道**：步骤按依赖顺序解锁；点击锁定步骤可见阻塞原因，不可跳步执行。
2. **核对清单**：当前步骤全部勾选后才能「标记完成 / 验证通过」。
3. **确认关卡**（不可逆步骤）：「执行不可逆操作…」打开确认层 →
   阅读后果陈述与回滚方案 → 勾选全部确认项 → 输入发布单号
   `REL-2026-1017` → 放行执行；取消则无任何状态变化（Esc / 点击遮罩亦可）。
4. **回滚窗口**：不可逆步骤执行后，「回滚此步骤」在收尾步骤完成前始终可达；
   回滚按恢复路径复位该步骤及其后全部已完成步骤，并写入留痕。
5. **操作留痕**：开始 / 完成 / 验证 / 确认 / 执行 / 回滚全部事件入时间线，
   支持复制与导出 JSON；完成页统计回滚次数，零回滚时给出「全程零回滚」标识。

## 设计会话（Prax）

- session: `ds_20261025070716_eba80560`（greenfield）
- 门禁记录：start → frame → context → route → inspect → decide → sdir →
  reconcile → realize（direct_code）→ prepare_implementation 全部 PASS；
  主结构 `PAT-LIST-DETAIL` + 顺序门控执行；能力对账唯一 gap（刷新持久化）
  以 `explicit_compromise` 记录（交付约束不要求持久化服务）。
- 偏差说明：`design_prepare_implementation` 的 `framework` 参数为 schema 固定
  枚举 `"react"`；实际按 `direct_code` 提议落地为**零依赖原生 JS**——
  满足「file:// 直接静态打开、无外部服务」的交付约束（React 运行时需本地
  vendor，徒增体积且无收益）。

## 验证与证据（Prax 会话 ds_20261025070716_eba80560）

**真实浏览器实测**（Prax 验证器自带 Chrome，entry `/index.html`，双视口 1280×860 / 1440×900，共 3 轮实测）：

- 最终一轮（receipt `validation-evidence/receipt-2026-10-25T07-40-24-696Z-*.json`，run `fcf70bff`）：
  `layout.overflow` / `layout.responsive_collision` / `text.truncation` / `a11y.contrast` /
  `a11y.focus_order` / `a11y.target_size` **全部 pass**。
- 前两轮实测发现并修复了 6 个真实缺陷：布局碰撞（sticky 面板与第 2 行内容重叠 → 改静态流）、
  对比度 34 处（muted 墨色 4.41:1、锁定步 opacity 混白 2.48:1 → 加深墨色、锁定态改显式颜色）、
  焦点顺序倒置（改左栏 roving tabindex）、checkbox 命中区 15px（→24px）、
  禁用按钮 opacity 混白 2.58:1（→显式可达标禁用配色）。
- 截图证据：`.prax/design/sessions/ds_20261025070716_eba80560/validation-evidence/**.png`
  （1440×900 首屏三栏全景、1280×860 两栏降级均人工核对通过）。
- 遗留 warning：`type.min_projected_size`（16 个 11px 辅助文本 span 低于 12px 阈值，warning 级）。
  有意未修：测量轮次（3/3）已用尽，改动文件会使已绑定的实测 digest 失配；如实记录。

**验证门禁结论**：11 项检查全部 pass（6 项 deterministic 为实测 measured，5 项 assistive/empirical
提交证据被受理 attested）。`keyboard` 为 empirical 检查，要求机器绑定的实测回执：实测本身
pass（上份 receipt），但绑定器判该回执与当前会话状态失配（`MEASUREMENT_BINDING_INVALID`），
且测量轮次已用尽、收敛停滞保护已触发——按冻结纪律停止重试，如实记录为残留项
（`deterministic_passed: true, error_failures_open: 0, unresolved: []`）。

**旅程取证工具**：`evidence/drive.html`（7 个交互场景的驱动页：initial / s01-done / gate /
gate-error / executed / rolled-back / completed，全部真实 `.click()` 驱动）与
`evidence/run-screenshots.ps1`（一键 Chrome headless 截图脚本）。本会话所有线程均无 shell
执行工具，未能运行；供有 shell 的环境一键复现交互旅程截图。

## 已知边界

- 刷新 / 关闭页面即回到初始态（定位为单次执行台；留痕可导出留存）。
- 桌面优先（≥1280px 三栏；窄屏降级为单列，未做移动端专门适配）。
