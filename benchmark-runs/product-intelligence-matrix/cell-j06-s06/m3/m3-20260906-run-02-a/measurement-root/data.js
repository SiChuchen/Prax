/* data.js — 舰队变更史（cell-j06-s06 · understand × temporal-sequence）
   主对象：change_set —— 7 个发布窗口 · 21 项变更 · 4 条因果链。
   数据内联随首屏就绪；经典脚本挂 window.DATA，file:// 直接可开。 */
window.DATA = {
  meta: {
    title: "舰队变更史",
    subtitle: "Fleet Chronicle — 服务舰队随时间的状态演化"
  },

  /* 服务目录：名称与分类（含中途新增的服务） */
  catalog: {
    "api-gateway":   { name: "API 网关",   kind: "边缘层" },
    "auth":          { name: "认证服务",   kind: "核心链路" },
    "order-svc":     { name: "订单服务",   kind: "核心链路" },
    "payment-svc":   { name: "支付服务",   kind: "核心链路" },
    "inventory-svc": { name: "库存服务",   kind: "核心链路" },
    "notify-svc":    { name: "通知服务",   kind: "支撑" },
    "metric-agent":  { name: "指标采集",   kind: "观测" },
    "legacy-report": { name: "旧报表服务", kind: "数据" },
    "search-svc":    { name: "搜索服务",   kind: "数据" },
    "audit-log":     { name: "审计日志",   kind: "合规" }
  },

  /* 基线：t0 时刻已在役的服务及其字段 */
  baseline: [
    { id: "api-gateway",   fields: { "版本": "3.0.2", "副本": 3, "限流 QPS": 5000, "通知路由限流": "未启用" } },
    { id: "auth",          fields: { "版本": "2.4.2", "副本": 2, "限流 QPS": 800, "令牌 TTL": "15min" } },
    { id: "order-svc",     fields: { "版本": "4.0.1", "副本": 4, "限流 QPS": 600, "连接池": 50 } },
    { id: "payment-svc",   fields: { "版本": "5.2.0", "副本": 3, "限流 QPS": 200 } },
    { id: "inventory-svc", fields: { "版本": "3.7.4", "副本": 3, "限流 QPS": 800, "连接池": 40 } },
    { id: "notify-svc",    fields: { "版本": "1.9.0", "副本": 2, "内存": "1Gi", "死信队列": "关闭" } },
    { id: "metric-agent",  fields: { "版本": "0.8.3", "副本": 2, "采集周期": "15s" } },
    { id: "legacy-report", fields: { "版本": "0.9.9", "副本": 2, "内存": "2Gi" } }
  ],

  /* 发布窗口（change_set）序列，按时间升序；changes 内亦按发生顺序排列。
     变更因果：c.parent 指向引发本变更的更早变更 —— 因必须先于果。 */
  windows: [
    {
      id: "w0", version: "v2.8.0", date: "2026-08-24 10:00",
      trigger: { label: "双周迭代", tone: "ok" },
      note: "常规双周迭代窗口。",
      metrics: { "可用率": "99.95%", "p95 延迟": "205ms", "错误率": "0.08%", "日成本": "¥1,330" },
      changes: [
        { id: "c01", op: "add", target: "search-svc",
          fields: { "版本": "1.0.0", "副本": 2, "内存": "2Gi", "查询 p95": "410ms" },
          reason: "商品搜索需求 #142 上线" },
        { id: "c02", op: "modify", target: "api-gateway", field: "版本", from: "3.0.2", to: "3.1.0",
          reason: "HTTP/3 支持灰度转全量" }
      ]
    },
    {
      id: "w1", version: "v2.8.1", date: "2026-08-26 09:30",
      trigger: { label: "大促备战", tone: "warn" },
      note: "大促前容量备战窗口。",
      metrics: { "可用率": "99.97%", "p95 延迟": "190ms", "错误率": "0.07%", "日成本": "¥1,520" },
      changes: [
        { id: "c03", op: "modify", target: "order-svc", field: "副本", from: 4, to: 8,
          reason: "大促压测：订单链路 QPS 预期翻倍" },
        { id: "c04", op: "modify", target: "metric-agent", field: "版本", from: "0.8.3", to: "0.8.4",
          reason: "新增 order-svc 容量告警规则" }
      ]
    },
    {
      id: "w2", version: "v2.8.2", date: "2026-08-29 14:05",
      trigger: { label: "事故修复 INC-2201", tone: "incident" },
      note: "营销活动触发通知风暴，多处联动修复。",
      metrics: { "可用率": "99.71%", "p95 延迟": "340ms", "错误率": "0.42%", "日成本": "¥1,560" },
      changes: [
        { id: "c05", op: "modify", target: "notify-svc", field: "副本", from: 2, to: 6,
          reason: "INC-2201：活动通知风暴，投递队列积压 43 分钟" },
        { id: "c06", op: "modify", target: "search-svc", field: "内存", from: "2Gi", to: "4Gi", parent: "c01",
          reason: "索引量涨至 3×，内存水位 95%" },
        { id: "c07", op: "modify", target: "search-svc", field: "查询 p95", from: "410ms", to: "800ms", parent: "c06",
          reason: "索引膨胀导致查询延迟恶化" },
        { id: "c08", op: "modify", target: "auth", field: "限流 QPS", from: 800, to: 600, parent: "c05",
          reason: "登录风暴外溢，临时收紧认证限流" }
      ]
    },
    {
      id: "w3", version: "v2.8.3", date: "2026-09-01 11:00",
      trigger: { label: "复盘加固", tone: "info" },
      note: "INC-2201 复盘决议落地。",
      metrics: { "可用率": "99.92%", "p95 延迟": "265ms", "错误率": "0.15%", "日成本": "¥1,530" },
      changes: [
        { id: "c09", op: "modify", target: "api-gateway", field: "通知路由限流", from: "未启用", to: "120 QPS", parent: "c05",
          reason: "复盘决议 #1：为通知路由加网关限流保护" },
        { id: "c10", op: "modify", target: "inventory-svc", field: "限流 QPS", from: 800, to: 1200, parent: "c03",
          reason: "订单副本 ×2 后库存调用峰值达限流 92%" },
        { id: "c11", op: "modify", target: "legacy-report", field: "副本", from: 2, to: 1,
          reason: "FinReview：30 天访问量 -90%，先行缩容" }
      ]
    },
    {
      id: "w4", version: "v2.8.4", date: "2026-09-03 16:20",
      trigger: { label: "合规 + 容量复审", tone: "info" },
      note: "合规扫描整改与下游容量复审。",
      metrics: { "可用率": "99.96%", "p95 延迟": "240ms", "错误率": "0.09%", "日成本": "¥1,565" },
      changes: [
        { id: "c12", op: "add", target: "audit-log",
          fields: { "版本": "1.0.0", "副本": 2, "保留期": "90 天" },
          parent: "c11",
          reason: "合规扫描：资源下线前须补齐审计链路" },
        { id: "c13", op: "modify", target: "inventory-svc", field: "连接池", from: 40, to: 80, parent: "c10",
          reason: "限流上调后连接等待超阈值" },
        { id: "c14", op: "modify", target: "notify-svc", field: "死信队列", from: "关闭", to: "开启", parent: "c09",
          reason: "被限流丢弃的通知需可追溯" }
      ]
    },
    {
      id: "w5", version: "v2.9.0", date: "2026-09-05 10:00",
      trigger: { label: "季度清理", tone: "ok" },
      note: "季度清理窗口：下线与升级。",
      metrics: { "可用率": "99.97%", "p95 延迟": "225ms", "错误率": "0.07%", "日成本": "¥1,450" },
      changes: [
        { id: "c15", op: "remove", target: "legacy-report", parent: "c12",
          reason: "缩容后 30 天零调用，审计链路已就绪，正式下线" },
        { id: "c16", op: "modify", target: "search-svc", field: "版本", from: "1.0.0", to: "2.0.0", parent: "c07",
          reason: "查询缓存上线（v2 索引引擎）" },
        { id: "c17", op: "modify", target: "search-svc", field: "查询 p95", from: "800ms", to: "520ms", parent: "c16",
          reason: "缓存命中后延迟回落" },
        { id: "c18", op: "modify", target: "payment-svc", field: "版本", from: "5.2.0", to: "5.3.0",
          reason: "对账改异步，夜间批处理提速" }
      ]
    },
    {
      id: "w6", version: "v2.9.1", date: "2026-09-07 09:00",
      trigger: { label: "例行维护", tone: "ok" },
      note: "例行维护窗口。",
      metrics: { "可用率": "99.98%", "p95 延迟": "215ms", "错误率": "0.05%", "日成本": "¥1,490" },
      changes: [
        { id: "c19", op: "modify", target: "api-gateway", field: "副本", from: 3, to: 4,
          reason: "网关连接数回升至预警线 80%" },
        { id: "c20", op: "modify", target: "metric-agent", field: "版本", from: "0.8.4", to: "0.9.0", parent: "c14",
          reason: "支持死信队列指标采集" },
        { id: "c21", op: "modify", target: "auth", field: "令牌 TTL", from: "15min", to: "30min", parent: "c08",
          reason: "风暴结束：放宽会话以减少重复登录摩擦" }
      ]
    }
  ]
};
