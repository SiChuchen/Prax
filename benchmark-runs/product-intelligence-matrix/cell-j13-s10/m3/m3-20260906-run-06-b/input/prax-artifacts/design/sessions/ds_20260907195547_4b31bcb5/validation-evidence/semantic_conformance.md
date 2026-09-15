# semantic_conformance — 测量回执

- 校验方式：design_sdir(mode=validate) 于 2026-09-08 本会话执行，返回 status=PASS，schema_errors=[]，semantic_errors=[]
- SDIR 版本：0.2（.prax/design/sessions/ds_20260907195547_4b31bcb5/screen.sdir.yaml）
- 工件核对：index.html 中四区域与 SDIR regions 一一对应：
  - data（dominant）→ `#projection-surface`（分布图 + 记录表）
  - collection（primary）→ `#dimension-rail`
  - active_state（primary）→ `#state-tray`
  - detail（contextual, selection_driven）→ `#inspector`
- 结论：SDIR 有效、语义一致、与 PAT-DATA-EXPLORER 对齐 → pass
