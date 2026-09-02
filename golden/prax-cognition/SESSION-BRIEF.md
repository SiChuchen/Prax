# Golden Case #6 — ECP Cognition Workspace（F4 试点启动包）

> 状态：待执行。本文件是 live 会话的唯一入口简报；执行者照此跑完整链，
> 完成后冻结 fixture，Gate 4 即闭。
> 依据：研究 §40–41（表达架构推导）+ 链 spec §5（测量/环路契约）+
> replan `docs/superpowers/specs/2026-09-02-phase4-empirical-loop.md` §F4。

## 0. 任务一句话

在 ECP 仓库里，用 **Prax 0.2 全链**（本试点的意义之一：0.2 载荷的首次
live 运行）从产品意图推导并实现 **Cognition Workspace**（认知工作台），
以测量收据收口，随后冻结 golden fixture。

## 1. 前置检查（会话开场执行）

```bash
# Prax：本仓 main（≥ 6f25526），MCP 已用户级注册（claude mcp list 应含 prax）
cd /e/codex-prj/Prax/Prax && npm test          # 319/319 基线绿
# ECP：离线包已就位（E:\codex-prj\ecp）
cd /e/codex-prj/ecp && npm ci && npm run build # 或其等价构建脚本
```

会话须在 **ECP 目录**启动（MCP local 语义 + 产物落对项目根）。
新 worktree 建议名：`ecp-cognition`（对齐 AB-001 的 worktree 纪律；
memory 目录先验证为基线状态——worktree 共享 memory 的坑已有先例）。

## 2. Product Brief（研究 §40 原文，不许改写）

> 让人在 Agent 高速推进项目的情况下，持续理解并掌控项目真实状态、
> 变化与原因。

预期表达架构（§41 推导结论，**必须经门禁论证而非直抄**——decide 阶段
要用 information_shape 逐项说明，SHELL_TERMS 触发时带 justification）：

```text
Architecture Canvas + Change Timeline + Search
        └──────── Selected Object ────────┘
                     Inspector
        + Decisions + Activity + Metrics + Guided Flows
```

§40 的 Job→Representation 表（12 行）是验收对照面：不同 Job 拥有不同
表达；Architecture Canvas 是关键表达但**不得成为 universal shell**。

## 3. 链执行（①→⑱ 映射到 11 工具，0.2 载荷）

| 步 | 工具 | 要点 |
|---|---|---|
| ①-④ | `design_start` + `design_frame` | frame **0.2**：jtbd（verb 建议 understand/explain）、primary_object、task_model 三块必填 |
| ⑤-⑧ | `design_context` → `design_route` → `design_inspect` → `design_decide` | decide **0.2**：information_shape 十维 + representation portfolio（primary/supporting≤4/rejected≥1）。注意：cards/dashboard/tabs/modal 触发词会要求 justification_vs_shape 并浮现 myth——预期组合不含触发词则不触发 |
| ⑨-⑬ | `design_sdir`（generate_from_decisions） | 自动产出 **0.2**：state_ownership 至少 selection/preview 有主、complexity_budget 十计数、acceptance ≥1 |
| ⑭ | `design_reconcile` → `design_realize`（direct_code propose） | |
| ⑮ | `design_prepare_implementation` | compiled context 应含 representation_portfolio / state_ownership / acceptance 三段（0.2） |
| ⑯ | 实现 + 测量 | 见 §4 |
| ⑰ | `design_validate` | submit_evidence 带 measurement_receipt；readiness 块全绿才 COMPLETE |
| ⑱ | 修正沉淀 | corrections.yaml + 本仓 phase report 记录新模式 |

## 4. 测量纪律（链 spec §5，硬约束）

```bash
node /e/codex-prj/Prax/Prax/packages/prax-measure/bin/prax-measure.mjs \
  --app <ECP 构建产物目录> \
  --out <会话 .prax/design/sessions/<id>> \
  --viewports 1280x860:desktop,1440x900:wide
```

- 六条 error 档检查（overflow/collision/truncation/contrast/focus_order/
  target_size——四条已晋升）任一 fail 则不许声明 pass（矛盾=BLOCK）；
  type size 仍 advisory。
- 收据放会话 `validation-evidence/`，evidence item 引用相对路径。
- **改产物必须重测**（收据陈旧自动失效，R3）；停滞两轮无改善即如实上报
  未决清单，不无限重试。

## 5. 完成与冻结（landing 先例）

1. COMPLETE + readiness 全绿 + 零缺失证据。
2. 冻结 `golden/prax-cognition/fixture/`：会话全部 YAML 工件 +
   validation-evidence 收据与截图（字节原样）。
3. 加重放测试 `tests/prax-cognition-fixture.test.ts`（模式抄
   `tests/prax-landing-fixture.test.ts`：golden digest 逐项断言）。
4. phase report 记录：表达组合是否与 §41 预期一致（偏离也是发现）、
   新模式进 saturation ledger、Gate 4 关闭。

## 6. 退出条件

- 链走完且 COMPLETE；或客观停滞（如实上报未决项后停）。
- 产物与 ECP 主线不冲突（认知工作台是新增面，不改既有面）。
