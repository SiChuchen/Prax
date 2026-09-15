# acceptance_contract_present — 测量回执

- 校验方式：读取 screen.sdir.yaml（v0.2）acceptance 块（validate 已 PASS）
- 5 条验收判据：
  1. 维度切换后过滤仍生效、托盘逐条可见、选中跨投影保持（认知连续）
  2. 状态条目含归属维度 + origin 来源，单条 × 回退；Ctrl+Z 撤销；Reset All 清空
  3. 加载完成即 ready，数据内联首屏，无加载态
  4. 零命中呈现 empty 态 + 『清空全部过滤』，非错误
  5. 主工作与选择可键盘操作且有可见焦点
- 全部可追溯到冻结简报（验收种子 + 交付约束 + 成功标准）→ pass
