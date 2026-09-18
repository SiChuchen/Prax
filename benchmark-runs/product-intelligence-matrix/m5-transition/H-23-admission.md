# H-23 Admission Record — Accessibility AA Floor (2026-09-18)

Intake per `docs/knowledge-intake-protocol.md` (18 问, 原文照录). Entry:
`H-23 / heuristic / draft` in `packages/prax-knowledge/data/knowledge.yaml`.
Admission evidence base: R1+R2 benchmark receipts (40 receipts, 35 valid
measurement runs; failure magnitudes in `a11y-root-cause.md`).

1. 用户是谁？ — Web desktop 终端用户，含键盘与低视力用户（AA 底线即为其可
   用性下限）。
2. 此刻最主要 Job 是什么？ — 阅读/操作界面完成单元格 brief 的主任务；低对
   比文本与缺失焦点指示直接阻碍该 Job。
3. Primary Object 是什么？ — 各单元格的 primary object（列表/画布/文档等）
   及其文本与交互控件。
4. 信息形态是什么？ — 不限（本条目与信息形态正交；四十轮样本覆盖 10 形态）。
5. 为什么当前 Representation 合适？ — 不适用（正交条目）， representation
   不改变 AA 数值要求。
6. Supporting Representation 为什么存在？ — 不适用（同上）。
7. 哪些 UI 常驻？为什么？ — 常驻文本与常驻交互控件是本条目的作用面。
8. 哪些按需出现？为什么？ — 按需面板同样受 AA 约束（出现即需可读可控）。
9. Detail 为什么是 Page/Panel/Inline/Modal？ — 不适用（正交）。
10. 哪些状态由谁拥有？ — 焦点指示状态由交互控件拥有；本条目要求其可见性。
11. 产品复杂度被怎样压缩？ — 允许用色彩明度分层压缩视觉复杂度，但压缩后
    的文本仍须 ≥AA 比率（禁止用 300/400 灰阶承载正文）。
12. Visual hierarchy 如何服务任务？ — 层级应由字号/字重/间距承载，不得以
    低于 AA 的对比度承载。
13. Motion 是否表达状态/方向/连续性？ — 不适用；但 `:focus-visible` 指示
    属于状态表达，必须可见。
14. 哪些设计只是该品牌风格，不能泛化？ — Tailwind slate 系具体色值不泛化；
    泛化的是"灰阶 token 做正文文本前必须验算 ≥4.5:1/3:1"这一规则。
15. 哪些模式经过多个不同范式验证？ — WCAG 2.2 AA 阈值本身（跨范式国际标
    准）；40 轮基准中失败模式在全部 10 个形态格重复出现。
16. 有什么反例？ — ≥24px（或 ≥18.66px bold）大字只须 3:1；纯装饰图形与
    logotype、禁用控件豁免对比度要求（已写入 does_not_apply_when）。
17. 有什么 acceptance contract？ — 即 prax-measure 四检查：a11y.contrast、
    a11y.focus_order、a11y.target_size、type.min_projected_size（entry 的
    validation.checks 与之一一对应，收据化验证前置已满足）。
18. 有真实 browser / user evidence 吗？ — 有：40 份 Chromium 实测收据
    （9,183 个失败对比对、2,425 个不足靶区、33 份 <12px 字号、27 份焦点失
    败；手算复核确认测量正确——见 a11y-root-cause.md）。

## 稳定性分级

- **stability: A**（跨范式验证 + 反例齐全：WCAG 2.2 为外部权威标准，失败
  模式在 10 形态 × 2 臂重复出现，反例见 Q16）。
- **authority_initial: C**（本批编码级，按规程惯例）；`review_by: 2026-12-31`
  复审；`lifecycle.status: draft`——按规程"首批临时级"惯例，人工确认后才
  可转 stable。

## 消融用途（本准入的动机）

裸臂无知识机制 = 天然控制组。r3 消融批（protocol-addendum 见
m3-r3-ablation-20260918/）预登记：若 Prax 臂在 contrast/type/focus 上相对
基线显著改善而裸臂不动，即为 Gate B 缺失的因果信号；若无改善，则记录
"路由 ≠ 应用"为 Gate B 负证据。
