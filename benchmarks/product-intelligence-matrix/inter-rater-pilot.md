# Inter-Rater Coding Pilot (research §45; Phase 4 F3)

当前 Wide Corpus 为单研究者编码。试点目标：判断 taxonomy 是否足够清晰。

## 程序

```text
同一批页面
 ↓
Researcher / Model A   +   Researcher / Model B
 ↓
independent coding（互不可见）
 ↓
compare disagreement → 逐字段裁决 → taxonomy 修订记录
```

- 样本：从 corpus-2026-09 抽 20 页 + 新增 10 页（含此前未覆盖范式）。
- 双编码器独立工作，编码后对齐会话前不得互通。
- 分歧不只裁决，还要归因：词表缺项 / 定义含混 / 真正的边界样本，
  三类分别记入 saturation ledger 的 new_boundaries。

## 重点字段（§45 原文照录，8 项）

- JTBD
- Primary Object
- Primary Representation
- Density
- Detail Surface
- Context Retention
- Progressive Disclosure
- State Ownership

一致性度量：逐字段 percent agreement + 分歧类型分布；某字段一致率
< 70% 触发该字段定义复审（词表优先于裁决者记忆）。

## Pattern Saturation Ledger（§46）

`data/saturation-ledger.yaml` 按每 30 样本带记录五个计数器；
新增率趋平（new_pattern_rate 连续两带下降且 < 5%）判定该层饱和，
停止扩张该层、转深耕组合与边界。
