# Brief Template — product-intelligence-matrix (program M2)

每格简报由 `gen-briefs.mjs` 按本模板渲染（重生成必须字节一致，由
`tests/benchmark-matrix.test.ts` 钉死）。简报是双臂唯一共享的任务输入：
臂中立——不得提及 Prax、测量层或评价维度。

## 章节结构（固定顺序）

1. **标题行**：`# Product Brief — <cell-id> (<verb> × <shape-name>)`
2. **Benchmark 头**：程序与计划引用；Cell 行 = id · 层级（priority-1
   §43 原配对 / priority-1 对角带交叉格）· 源格（matrix.yaml 原文，交叉格无）
3. **用户任务（user_job）**：§43 原文三行——动词 / 对象 / 成功标准
4. **信息形状（shape 束）**：十 facet 表（值带原始英文枚举）+ 一句判别描述
5. **主对象建议**：object_type（本格取值）+ 建议备选（shape 的 suggested_objects）
6. **验收种子（acceptance seed）**：原配对格用 §43 原文；交叉格 =
   `成功标准；shape seed_clause`
7. **交付约束**：从零单页 Web 应用；静态可打开（根 index.html 或 dist/）；
   加载完成即可用（首屏数据就绪）；不部署；无后端/账号/持久化要求
8. **预算上限**：wall-clock ≤ 90 min；token ≤ 1.2M（AB-001 中位数的
   1.5 倍）；超限即停如实记录
9. **冻结纪律**：M2 冻结；执行臂不得改验收，只能就歧义提问（操作算子
   记录并对两臂对等回答）

## 冻结与再生成

- 简报冻结 = pilot-batch.yaml 所列格的 `benchmark-runs/
  product-intelligence-matrix/<cell-id>/brief.md` 提交入库
- 任何措辞修订必须改 `gen-briefs.mjs` 后整体重生成并重跑测试——
  不允许手改单份简报（避免双臂输入漂移）
