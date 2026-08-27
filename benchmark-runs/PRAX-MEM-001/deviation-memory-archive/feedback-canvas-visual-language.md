---
name: canvas-visual-language
description: ECP Architecture Canvas 视觉语言长期规则：强调只复用边宽/线型 + emphasis 状态，禁止色相编码方向或类别、禁止 glow/阴影
metadata: 
  node_type: memory
  type: feedback
  originSessionId: db77233f-bdaa-4d5f-a80c-d484cdbfd27a
---

Architecture Canvas 的视觉强调必须复用既有语法：**边宽（edge weight）与线型（dash pattern）+ 对象 emphasis 状态**。禁止为影响方向或影响类别引入色相编码；禁止 glow 或 shadow halo。

**Why:** 2026-08-27 impact emphasis 首版用蓝/琥珀双色相 + 彩色徽章标记上下游，用户 review 判定 "too loud and off-language"。v1 冻结约束本就要求 active 边以权重压过普通拓扑、无 glow、无按类型着色；被强调的边仍是它原本的关系类型，线型不得改。上游/下游的方向可读性必须来自边自身的方向（箭头）或等效非色彩通道。

**How to apply:** 在 [[canvas-runtime-pitfalls]] 的画布上做任何强调/高亮设计时：对象只用 primary/related/context/muted 状态；边只用 active/related/normal/muted/suppressed + 既有线型语法；方向信息用箭头尺寸/朝向、字形（↑/↓）、文字标签等非色彩通道表达。新会话继续画布视觉工作时先读本条。
