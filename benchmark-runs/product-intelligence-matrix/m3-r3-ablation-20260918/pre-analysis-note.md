# r3 客观测量预分析(非正式,2026-10-24 v2)

**性质声明:操作员侧非正式预分析,早于 R2 盲评完成与解盲。正式结论必须且只能出自
`analyze.mjs` 产出的 `ablation-report.md`(判据 A4 预登记冻结)。本文件汇总盘上客观
事实供操作员决策,不构成判据结论。**

**v2 修订(重要):v1 基于错误转述的基线数字(focus A 基线 1/16)误判 inconclusive
条款触发并怀疑"跨批次基线失效"。经核对 protocol-addendum.md A1/A4 原文与三批
transcript,该判断撤回。本版以预登记原文数字为准。**

## 权威基线(protocol-addendum.md A1,预登记)

B 臂(R1+R2 合并,valid):contrast 2/19, focus 3/19, target 5/19, type 2/19;
composite = 7/57 ≈ 12.3%(实例级口径)。
A 臂:contrast 1/16, focus 1/16, target 4/16, type 0/16;composite = 7/64 ≈ 10.9%。

## r3 实测(本提取,summary.yaml stdout_tail)

- B 臂有效 9(run-18 测量无效 empty document,不计分母):contrast 2/9(22.2%),
  focus 4/9(44.4%),type 0/9(0%);composite(实例级)= 6/27 = 22.2%
  (run 级三项全过 = 0/9 = 0%)
- A 臂 10:contrast 1/10(10%),focus 4/10(40%),type 0/10(0%);
  composite(实例级)= 5/30 = 16.7%(run 级 = 0/10)

## 对照预登记判据(A4)

| 条款 | 判定 |
|---|---|
| Success(composite ≥37% 且 B−A ≥20pp 且 contrast 或 type ≥50%) | ✗ 22.2%<37%;+5.5pp;contrast 22%/type 0% |
| Control validity(A ≤ 2×基线 10.9%→21.8%) | ✓ A=16.7%,1.53×,对照有效,**inconclusive 不触发** |
| Partial(恰好一项检查改善 ≥50%) | ✗ 两项相对改善超 50%(contrast +111%,focus +181%),非 exactly one;绝对口径下零项达 50% |
| → 结论方向 | **Negative("disclosure without application")** |
| Route check(H-23 须出现在 B 披露) | ✓ 9/10 B run 的 routing-log 含 H-23(run-09 未命中,待正式报告核对) |

口径备注:A4 文字("receipts passing contrast, type, and focus",run 级)与基线数字
(7/57,实例级)存在内部歧义;两种口径下上述判定不变(run 级:B 0/9 vs 37% 同败,
A 0/10 vs run 级基线 0 无跳变)。正式口径以 analyze.mjs 实现为准。

统计功效备注(诚实纪律):n=9/10 下判据功效低。B focus 4/9 vs 基线 3/19,
Fisher 精确 p≈0.22;contrast 2/9 vs 2/19 p≈0.63——单项"改善"均不显著。
Negative 的准确含义是**未达预登记阈值**,不是"证明知识无效";focus 项 44.4% vs
15.8%(2.8× 相对)是唯一值得后续关注的信号。

## 漂移假设核查(v1 提出,v2 排除为主要因素)

- 模型配置:三批(R1 09-06 / R2 09-09 / r3 09-18~10-23)transcript 的 model 串全部
  为 `glm-5.3-flash[1M]`,CLI 报告层面无版本差异(操作员确认 `--model sonnet` 即
  路由 glm-5.3-flash)。GLM 服务端静默权重升级无法从本地排除,但无证据支持。
- 客观项批次稳定性:B focus 3/9(R1)→ 2/10(R2)→ 4/9(r3);A focus 2/9→2/8→4/10
  ——均在抽样波动范围内,无单调趋势。
- 仍成立的协议缺口(与本批结论无关,建议修复):run-metadata 未记录模型/CLI 版本串;
  测量环境(Playwright/Chromium)未随冻结快照锁定;无效测量(run-18)无重测流程。

## 对 R1/R2"打平"的含义

本批未发现批次漂移证据,故 v1 提出的"R1/R2 打平可能系漂移噪声"的质疑**不成立**,
打平结论维持原状。但 n=9~10 的客观项置信区间极宽的教训同样适用于盲评维度:
后续轮次的判据设计应前置功效计算(见探针试点方案)。
