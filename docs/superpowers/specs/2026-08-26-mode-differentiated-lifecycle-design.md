# Prax 模式分化生命周期设计（Mode-Differentiated Lifecycle）

日期：2026-08-26
状态：已与用户对齐（brainstorming 结论），待实施
驱动：真实使用反馈第 4 条（瀑布门禁与迭代节奏冲突）+ 用户对前期定位/需求确认/存量把握/执行形态的产品判断

## 1. 背景与动机

Prax v0 的十阶段链路对所有项目一视同仁。真实使用中，agent 在"登录页只想改视觉"的场景被完整流程拖累后绕过 Prax 手写；观测平台重设计（有存量但不受其约束）被迫走绿地推导。`design_start.mode` 字段（greenfield/existing_product）存在但只影响一个 frame 附加块，没有兑现分化。

本设计把生命周期改为**策略表驱动**：按"对存量的态度"分三模式，增量模式再按"变更类型"定深度，前期增加需求确认与存量理解两道门禁，执行与验证按模式分化。

## 2. 目标与非目标

**目标**

1. `mode` 真正改变流程形态与深度，消除"小变更被全流程拖累"
2. 需求确认成为所有模式的第一道门禁（结构化证据，可审计）
3. 存量项目（增量/重构）先建立全面的项目把握再设计
4. 外部设计权威（DESIGN.md/设计系统）成为一等输入
5. 执行计划与验证按模式分化（集成计划/变更序列/迁移计划/回归检查）

**非目标**

- Prax 不做执行编排/workflow engine（分步执行协议被否决）
- 不做 Prax 自身的代码库扫描器（存量理解由 agent 阅读+填写，Prax 校验）
- 不做跨产品/设计系统一致性管理
- 十个 MCP 工具的数量与名称不变
- 会话内不允许改 mode/change_kind（误判就开新会话引用旧产物）

## 3. 语义模型

```yaml
# design_start 扩展（新字段全部可选或带默认，向后兼容）
mode: greenfield | existing_product | rework      # 枚举扩一值
change_kind: add_surface | modify_surface | visual_polish | defect_fix
  # existing_product 必填；rework 可选（范围提示）；greenfield 禁止
design_authorities: [docs/DESIGN.md, design/tokens.yaml]   # 可选，任意模式
```

| 模式 | 存量在设计中的地位 | 核心约束 |
|---|---|---|
| greenfield | 不存在 | 一切从用户/任务推导 |
| existing_product | 权威约束 | 必须对齐既有模式、习惯、信息架构；变更保持全局一致 |
| rework | 证据 + 迁移边界，不是解决方案的权威 | 从用户/任务重新推导（禁抄旧结构）；存量回答：实际用法、痛点、什么必须活过迁移 |

已覆盖的细分场景（写清语义，不加新模式）：平台迁移 = rework（preserve 产品模型，replace 交互呈现）；混合项目 = 会话级 rework + 执行计划按面标注 preserve/rework。

## 4. 新门禁

### 4.1 需求确认门禁（所有模式第一道门）

产物 `requirement-confirmation.yaml`：

```yaml
version: "0.1"
user_quote:            # 用户原话引用，min 1，防转述失真
  - "把登录页的字调小一点，太大了"
restatement: >-        # agent 复述：谁/要什么/为什么/成功标准
boundaries:
  in_scope: [login surface typography]
  out_of_scope: [registration flow, form fields]   # 必须非空，防范围漂移
open_questions: []
confirmed_with_user: true    # agent 声明已与用户对齐（构造 #10：不合成事实）
confirmed_at: "2026-08-26T12:00:00.000Z"
```

校验：user_quote 非空；out_of_scope 非空；high-impact open question 必须解决或显式接受；confirmed_with_user 必须为 true。最终 validate 回头核对 restatement 与产出的一致性（不符 → REVIEW）。

### 4.2 存量理解门禁（existing_product 与 rework，问题集不同）

产物 `existing-understanding.yaml`，两套问题集：

**existing_product 集**：current_objects（现有产品对象及用户称呼）、current_surfaces（现有面与信息架构）、established_patterns（已确立模式与组件）、user_habits、constraints_and_debt、change_targets（本次触及的面）、design_authorities。

硬校验：change_targets ⊆ current_surfaces；每项支持 evidence_refs（指向代码/文档路径，agent 填写）。

**rework 集**：actual_usage（用户实际怎么用）、pain_points（必填，重设计依据）、must_preserve（数据/关键流程肌肉记忆）、must_replace、free_to_reconsider、migration_notes、design_authorities。

硬校验：三桶互斥且覆盖声明（每个已声明的现有对象/面须落入且仅落入一桶）；pain_points 为空即拒绝（EXPAND）。

## 5. 策略表与状态机

阶段机从硬编码 `ALLOWED_PHASES` 升级为策略表：`design_start` 时按 (mode, change_kind) 展开门禁序列快照，存入 `session.lifecycle_policy`（version "1"）。

| (mode, change_kind) | 必经门禁序列 |
|---|---|
| greenfield | 确认 → frame → context → route → inspect → decide → sdir → reconcile → prepare → validate |
| existing + add_surface | 确认 → 理解(聚焦集成) → frame(仅新面推导) → context → route → decide → sdir → prepare(含集成计划) → validate |
| existing + modify_surface | 确认 → 理解(聚焦该面) → route → decide(局部) → sdir_delta → prepare → validate(含回归) |
| existing + visual_polish | 确认 → 意图轻录 → validate(层级/可读性回归) |
| existing + defect_fix | 确认 → 意图轻录 → validate(回归) |
| rework | 确认 → 理解 → frame(重新推导) → context → route → decide → sdir → prepare(含迁移计划) → validate(含迁移) |

机制要点：

- 轻路径中 reconcile 按需触发（sdir_delta 声明新能力需求时）
- GATE_NOT_SATISFIED 永远指向该会话策略的下一个必经门禁
- 旧会话无 lifecycle_policy 字段 → 默认展开完整链，行为与当前完全一致
- 未知 (mode, change_kind) 组合 → design_start BLOCK `UNKNOWN_LIFECYCLE_POLICY`（列出支持组合）
- frame 门禁在 existing/rework 下读取理解产物：existing 模式 frame 的 product_objects 应能对应 current_objects（增量），rework 模式 frame 禁止以旧结构为对象来源（fresh_derivation 辅助检查）

## 6. 新产物 Schema

### 6.1 sdir_delta.yaml（modify_surface 专用）

```yaml
version: "0.1"
surface: settings
base_regions:                      # 该面当前区域（agent 从代码提炼，语义层）
  - { id: settings_navigation, role: primary_navigation, importance: supporting }
changes:                           # action: add | modify | remove | preserve_explicit
  - { region: settings, action: modify, fields: { importance: dominant }, rationale: "..." }
preserved: [settings_navigation]   # 显式声明不受影响
regression_points: [键盘路径, 保存态可见性]
```

校验：changes[].region ∈ base_regions ∪ 本次 add 区域（复用 SDIR_RELATION_REGION_NOT_FOUND 系列错误码）；render-leak lint 同样适用。

### 6.2 intent-lite.yaml（visual_polish / defect_fix 专用）

```yaml
version: "0.1"
kind: visual_polish | defect_fix
surfaces: [login]
current_hierarchy_summary: "表单优先居中，错误内联"
change: "字阶 token 降一级；间距 S2→S1"
basis: "审查发现登录标题层级与全站不一致"
evidence_refs: [docs/DESIGN.md#typography]
regression_points: [对比度, 焦点可见性, 键盘路径]
```

### 6.3 implementation-brief 按模式分化

- add_surface：集成计划（壳/导航/模式对齐点 + 新面实现顺序）
- modify_surface：变更序列 + 逐步回归风险
- visual_polish / defect_fix：变更清单 + 回归检查
- rework：迁移计划（用户过渡、数据、切换策略、按面标注 preserve/rework）
- greenfield：保持现状

## 7. 验证扩展（按模式装配检查集）

在现有五项通用检查之上：

| 模式/类型 | 新增检查 |
|---|---|
| existing 全部 | untouched_surface_regression、pattern_consistency、authority_consistency |
| rework | fresh_derivation_check（assistive）、migration_readiness |
| visual_polish | hierarchy_preserved、readability |
| defect_fix | 仅回归检查 |

## 8. 错误处理

- `UNKNOWN_LIFECYCLE_POLICY`：不支持的组合，列出支持矩阵
- 确认复述与产出不符：validate 阶段 REVIEW，要求解释证据
- change_targets 对不上 current_surfaces：EXPAND 指明缺口
- 会话内改 mode：拒绝并引导开新会话引用旧产物
- 其余沿用现有错误码体系

## 9. 兼容与迁移

- session.yaml 新增 lifecycle_policy 字段；旧会话默认完整链（零行为变化）
- 十个工具不变；design_start/design_validate 新输入可选或带默认
- 现有 38 个测试必须全过（存量路径回归零容忍）
- Schema 版本：新产物均为 version "0.1"，独立文件，不影响既有 artifact

## 10. 测试策略

1. 策略表穷举：每个 (mode, change_kind) 组合断言门禁序列与默认行为
2. 六条路径各一条 e2e（含中文 user_quote fixture）
3. 每个新门禁的正负向单测（确认缺 out_of_scope、痛点为空、三桶冲突等）
4. 旧会话兼容测试（无 policy 字段 → 完整链）
5. sdir_delta 引用完整性正负向测试

## 11. 实施顺序（writing-plans 细化）

① 需求确认门禁（全模式受益）→ ② 策略表 + rework 模式 → ③ 存量理解门禁 → ④ 轻路径（modify/polish/fix + sdir_delta + intent-lite）→ ⑤ 验证扩展

## 12. 决策记录

- 设计对象 = Prax 产品本身的生命周期（用户确认）
- 需求确认 = 结构化证据门禁，非 HITL 通道、非 agent 自证（用户选 A）
- 存量理解 = 清单 + 校验器，agent 填写，Prax 不扫描代码（用户选 A，evidence_refs 附带）
- 执行 = 变更执行计划，不做执行编排（用户选 A）
- 三模式 + 变更类型维度 + 外部设计权威维度（用户确认，均采纳）
- 实现方案 = 门禁路由/策略表（方案一），否决新工具集与模板方案（用户认可）
