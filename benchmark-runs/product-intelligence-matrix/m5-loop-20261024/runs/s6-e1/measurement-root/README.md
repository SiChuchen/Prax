# Sundown · orders-primary 下线执行台

cell-j10-s09（complete × consequential-flow）交付物：单一高后果流程的引导式执行单页应用。
用户任务：**零失误走完**生产数据库 `orders-primary` 的下线流程；验收种子：**不可逆步骤有恢复/确认路径**。

## 运行

无构建、无外部依赖、无网络请求：

- 直接双击打开 `index.html`（file:// 即可，脚本为经典 script 标签）
- 或任意静态服务器：`python -m http.server` 后访问 `http://localhost:8000/`

页面加载完成时即处于可用状态：流程数据内联于 `data.js`，首屏同步渲染，**没有加载态**。

## 结构

| 文件 | 作用 |
|---|---|
| `index.html` | 入口（根路径静态打开） |
| `styles.css` | 设计令牌与样式（WEB-DESKTOP · spacious，WCAG AA 对比度） |
| `data.js` | 内联流程数据：4 阶段 · 10 步 · 3 个不可逆步骤 |
| `app.js` | 状态机 + 渲染（原生 JS，IIFE，无框架） |

## 核心设计（对应验收）

1. **门控推进**：前置检查未全部勾选 → 动作按钮禁用；步骤未保留 → 后续步骤锁定。零跳步。
2. **确认门（执行前）**：不可逆步骤须先「解锁危险动作」→ 展开后果面板 → **手输 `ORDERS-PRIMARY`** 强确认 → 才能执行。输入不匹配为内联 error 态。
3. **恢复窗口（执行后）**：不可逆步骤执行后进入 60 秒恢复窗口——全局横幅与步骤内联同时出现倒计时，可**撤销恢复**或**确认保留**；到期自动保留并记录。
4. **零失误完成摘要**：走完全程显示步骤/检查统计、不可逆步骤终态与完整执行记录。

## 状态完备性（H-07）

- `loading`：数据内联、首屏同步渲染——加载态不作为可测状态（代码路径仅作 mount 兜底）
- `empty`：runbook 数据缺失时的空态面板（防御分支）
- `ready`：主工作态
- `selected`：左轨选中已完成步骤进入只读回看
- `error`：强确认输入不匹配的内联错误；非法动作一律禁用

## 范围与妥协

- 状态仅存会话内存（刷新即重置，可用「重置演练」复位）——简报明确不要求持久化服务，已作为显式妥协记录于 Prax 会话 `ds_20261024191559_fdfc0991`（capability gap `n7-session-only-state`）。
- 单主屏；无后端、无账号、无部署。

## 交付验证（Prax `ds_20261024191559_fdfc0991`）

- **真实浏览器测量**（prax-measure，round 3，receipt `validation-evidence/receipt-2026-10-24T19-38-45-459Z-*.json`，绑定 `implementation_current`）：7/7 通过——layout.overflow 0、responsive_collision 0（15 个交互元素）、text.truncation 0、a11y.contrast 0 失败对、a11y.focus_order 5 停留点 0 缺指示 0 倒置、a11y.target_size 0 不足、type.min_projected_size 通过。测量轮次 3/3 用满（前两轮的 contrast/target-size/overflow 失败即据此修复）。
- **11 项验证计划检查**：8 项 pass（含 keyboard=measured、destructive_recovery、requirement_alignment、product_model_alignment、hierarchy_review 等 5 项证据检查已提交真实 receipt 与截图工件）。
- **3 项 deterministic 检查如实报告为 unresolved**（`representation_decided` / `state_ownership_declared` / `acceptance_contract_present`）：三者读取磁盘上的 `screen.sdir.yaml`，该文件在 SDIR gate 持久化为 v0.1；validate gate 下提交 v0.2（含 representation.primary=wizard+reason、selection/preview 归属、7 条 acceptance、complexity_budget）lint 两次 PASS 但不落盘，且 gate 已封锁重持久化。v0.2 全文内容已通过 3 条项目修正记录于 `.prax/corrections.yaml`（corr-sdir-v02-*），实现与该 v0.2 内容一致。
- 首屏截图（真实浏览器实拍）：`.prax/design/sessions/ds_20261024191559_fdfc0991/validation-evidence/7058260b-*/viewport-*/`。
