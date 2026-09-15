# product_model_alignment — 测量回执

- 校验方式：Product Frame product_objects 与 UI 语言/结构逐项比对（工件：index.html、app.js）
- dataset → header『数据集：Nimbus SaaS 订单数据集』+ 记录总数
- dimension → 维度轨（`#dimension-rail`），文案『维度』，含基数（N 值）与类型图标
- projection → 中列标题『投影 · {维度名}』+ 度量/细分控件；切换交互『点名称＝投影』
- filter → 维度轨取值勾选、分布条点击、明细页『过滤』按钮；过滤徽标『N 过滤』
- active_state → 『生效状态』托盘，副标题『归属维度 + 来源 · 逐条可回退』
- record → 『记录』表与『记录明细』inspector
- 无后端概念泄漏；术语与用户心智模型（投影=视角层、过滤=约束层）一致
- 结论：pass
