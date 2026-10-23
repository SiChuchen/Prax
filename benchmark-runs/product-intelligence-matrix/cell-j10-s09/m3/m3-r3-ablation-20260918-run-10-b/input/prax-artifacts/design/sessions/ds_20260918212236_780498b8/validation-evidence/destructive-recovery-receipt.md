# Measurement receipt — destructive_recovery

- Method: driver stages 3/4/5/6/8 drive the app to each safety state; headless Chrome screenshots;
  `--dump-dom` text verification for state strings.
- Artifacts and verified strings:
  - evidence/shotC-confirm-modal.png — confirm gate for undoable step s4: 执行后果 + 恢复路径 blocks,
    ack checkbox, confirm disabled until ack. DOM: 「从负载均衡摘除节点」 title matched.
  - evidence/shotD-undo-strip.png — amber undo strip with live countdown; DOM matched 撤销窗口剩余 / 撤销此步.
  - evidence/shotE-after-undo.png — after clicking 撤销此步: app back on step 4 (executed-before state),
    checks preserved, deviation count unchanged (recovery is not penalized), toast 已撤销.
  - evidence/shotF-final-confirm.png — final-type step s9 modal: consequence 永久不可恢复,
    recovery = restore point bk-20260919-final; two overlapping undo strips visible above (s4 00:29, s8 00:44).
  - evidence/shotH-record-drawer.png — 24-record timeline incl. deviation +1 and undo entries;
    certificate audit table shows s4/s8 窗口关闭，已生效 and s9/s11 不可撤销（恢复点已留档）
    (DOM re-dump verified all four strings 1/1 after the audit-cell fix).
- Gate interception: evidence/shotB-gate-error.png — attempting execution with unmet checks is blocked,
  inline unmet list shown, deviation recorded (偏差 1).
- Captured: 2026-09-19 by implementation-arm.
