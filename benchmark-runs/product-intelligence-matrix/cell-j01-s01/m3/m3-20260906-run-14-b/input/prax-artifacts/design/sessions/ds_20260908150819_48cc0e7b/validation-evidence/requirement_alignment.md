# measurement receipt — requirement_alignment
- 运行: scene=selftest 真实 DOM 事件自测（12 项断言）+ dump-dom 多场景 + 源码检索
- 实测:
  1) 首屏就绪无加载态: 首屏 dump-dom 214 行同步渲染；index.html/js 源码 grep -i "loading|spinner|骨架|skeleton" 零命中。
  2) 零误伤: 自测 F 断言模态摘要「已选 42 项 | 将生效 35 项 | 跳过（无变更）7 项」（35+7=42 守恒）；G 断言执行后 chip 计数 +35 且表格徽章一致；预览与执行共用 computeAffected()（js/app.js 单一函数）。
  3) 状态归属显式: 行徽章/树微条/预览前后对照三处同源（nodeAgg/statusBadge 单一来源）。
  4) 静态交付: file:// 直开（全部取证均以 file:/// 直开完成，无任何网络请求）。
  5) 持久化: 会话内存态为简报边界内显式取舍，状态栏注明「内存态，刷新重置为种子数据」。
- 输出原文: "SELFTEST 12/12 :: …全 PASS"（evidence/rendered-dom-selftest.html）
