/* =====================================================================
 * AURORA 电商平台 · 生产环境变更数据集（内联，首屏即用）
 *
 * 数据不变式（渲染前由 app.js 自检）：
 *  1. events 按 ts 严格递增；
 *  2. 每条因果边 causes[i] 的 ts 严格早于本事件（时间结构与变更语义一致）；
 *  3. 每条变更 changes[k].from 等于折叠到该事件之前的字段值（快照折叠语义一致）。
 * ===================================================================== */

window.DATA = {
  system: {
    name: "AURORA 电商平台",
    env: "生产环境",
    windowStart: "2026-09-21T09:00:00+08:00",
    windowEnd: "2026-09-23T18:00:00+08:00"
  },

  components: [
    { id: "api-gateway",  name: "API 网关" },
    { id: "order-service", name: "订单服务" },
    { id: "payment-service", name: "支付服务" },
    { id: "inventory-service", name: "库存服务" },
    { id: "notification-service", name: "通知服务" },
    { id: "cdn-edge", name: "前端 CDN" }
  ],

  /* 字段元数据：显示名 + 取值格式化 */
  fields: {
    "version":        { label: "版本" },
    "replicas":       { label: "副本数" },
    "timeoutMs":      { label: "网关超时 (ms)" },
    "rateLimitRps":   { label: "限流 (RPS)" },
    "jvmHeapGb":      { label: "JVM 堆 (GB)" },
    "oneClickOrder":  { label: "一键下单开关", bool: true },
    "sdkChannel":     { label: "收单通道" },
    "paymentTimeoutMs": { label: "支付超时 (ms)" },
    "cacheTtlSec":    { label: "缓存 TTL (s)" },
    "queueWorkers":   { label: "队列线程" },
    "cachePolicy":    { label: "缓存策略" },
    "tlsVersion":     { label: "TLS 版本" },
    "health":         { label: "健康度", health: true }
  },

  /* 事件类型：中性操作 → 分类色板（已通过校验器）；状态性事件 → 状态色板（icon+label 双编码） */
  eventTypes: {
    "deploy":   { label: "发版",   glyph: "⬆", channel: "cat",  slot: 1 },
    "config":   { label: "配置",   glyph: "⚙", channel: "cat",  slot: 2 },
    "scale":    { label: "扩缩容", glyph: "⇅", channel: "cat",  slot: 3 },
    "incident": { label: "故障",   glyph: "⚠", channel: "status", status: "critical" },
    "rollback": { label: "回滚",   glyph: "↩", channel: "status", status: "serious" },
    "fix":      { label: "修复",   glyph: "✚", channel: "status", status: "good" }
  },

  healthStates: {
    "healthy":  { label: "健康", glyph: "●", status: "good" },
    "degraded": { label: "降级", glyph: "▲", status: "warning" },
    "error":    { label: "故障", glyph: "■", status: "critical" }
  },

  /* 窗口起点的初始状态（游标最早可回到此处） */
  initialState: {
    "api-gateway":         { "version": "v1.9.4", "replicas": 8, "timeoutMs": 3000, "rateLimitRps": 800, "health": "healthy" },
    "order-service":       { "version": "v2.4.0", "replicas": 6, "jvmHeapGb": 8, "oneClickOrder": false, "health": "healthy" },
    "payment-service":     { "version": "v3.1.2", "replicas": 6, "sdkChannel": "UNION_LEGACY", "paymentTimeoutMs": 5000, "health": "healthy" },
    "inventory-service":   { "version": "v1.7.1", "replicas": 4, "cacheTtlSec": 30, "health": "healthy" },
    "notification-service":{ "version": "v2.0.3", "replicas": 3, "queueWorkers": 8, "health": "healthy" },
    "cdn-edge":            { "cachePolicy": "stale-while-revalidate", "tlsVersion": "TLS 1.3", "health": "healthy" }
  },

  /* 变更事件：ts 严格递增；causes 指向时间上游；changes 记录字段级 前值→后值 */
  events: [
    {
      id: "e01", ts: "2026-09-21T09:12:00+08:00", type: "deploy",
      title: "订单服务 v2.5.0 发布：一键下单全量",
      detail: "常规周发布，携带一键下单特性并全量打开开关。发布窗口内各项指标平稳。",
      actor: "林晓", ticket: "CHG-1041", causes: [],
      changes: [
        { component: "order-service", field: "version", from: "v2.4.0", to: "v2.5.0" },
        { component: "order-service", field: "oneClickOrder", from: false, to: true }
      ]
    },
    {
      id: "e02", ts: "2026-09-21T10:05:00+08:00", type: "scale",
      title: "库存服务扩容：4 → 6 副本",
      detail: "大促预热：库存读写峰值预估上调，提前扩容副本。",
      actor: "陈默", ticket: "CHG-1043", causes: [],
      changes: [
        { component: "inventory-service", field: "replicas", from: 4, to: 6 }
      ]
    },
    {
      id: "e03", ts: "2026-09-21T11:40:00+08:00", type: "config",
      title: "网关限流上调：800 → 1200 RPS",
      detail: "大促流量预案：入口限流按容量评估上调至 1200 RPS。",
      actor: "陈默", ticket: "CHG-1044", causes: [],
      changes: [
        { component: "api-gateway", field: "rateLimitRps", from: 800, to: 1200 }
      ]
    },
    {
      id: "e04", ts: "2026-09-21T15:22:00+08:00", type: "deploy",
      title: "支付服务 v3.2.0 发布：接入收单通道 V2",
      detail: "切换收单通道 UNION_LEGACY → UNION_V2。发布前单通道压测通过，未做全链路高并发验证——此处埋下后续故障的种子。",
      actor: "林晓", ticket: "CHG-1046", causes: [],
      changes: [
        { component: "payment-service", field: "version", from: "v3.1.2", to: "v3.2.0" },
        { component: "payment-service", field: "sdkChannel", from: "UNION_LEGACY", to: "UNION_V2" }
      ]
    },
    {
      id: "e05", ts: "2026-09-22T00:00:00+08:00", type: "scale",
      title: "大促开幕：网关扩容 8 → 12 副本",
      detail: "零点大促开场，入口流量按预案扩容，网关自身平稳。",
      actor: "陈默", ticket: "CHG-1051", causes: [],
      changes: [
        { component: "api-gateway", field: "replicas", from: 8, to: 12 }
      ]
    },
    {
      id: "e06", ts: "2026-09-22T00:38:00+08:00", type: "incident",
      title: "支付延迟飙升：成功率跌至 91%",
      detail: "支付 P99 延迟升至 8.2s，成功率跌至 91%。定位：收单通道 V2 在高并发下对上游超时敏感，触发重试风暴（起因：昨日 e04 通道切换）。",
      actor: "值班 · 苏晴", ticket: "INC-2261", causes: ["e04"],
      changes: [
        { component: "payment-service", field: "health", from: "healthy", to: "degraded" }
      ]
    },
    {
      id: "e07", ts: "2026-09-22T00:51:00+08:00", type: "config",
      title: "网关超时放宽：3000 → 8000 ms（掩盖性缓解）",
      detail: "为抑制网关侧超时报错放宽支付路由超时。报错量下降，但支付积压继续累积——该配置掩盖了根因信号，后续复盘列为反面项。",
      actor: "陈默", ticket: "CHG-1052", causes: ["e06"],
      changes: [
        { component: "api-gateway", field: "timeoutMs", from: 3000, to: 8000 }
      ]
    },
    {
      id: "e08", ts: "2026-09-22T01:20:00+08:00", type: "scale",
      title: "支付服务扩容：6 → 10 副本（效果有限）",
      detail: "按『容量不足』假设横向扩容支付服务。重试风暴源于通道本身而非容量，扩容未缓解延迟。",
      actor: "值班 · 苏晴", ticket: "CHG-1053", causes: ["e06"],
      changes: [
        { component: "payment-service", field: "replicas", from: 6, to: 10 }
      ]
    },
    {
      id: "e09", ts: "2026-09-22T02:05:00+08:00", type: "incident",
      title: "故障连锁：订单转化率下跌",
      detail: "支付超时连锁传导至下单链路：购物车提交大量失败，转化率较基线下跌 18%。",
      actor: "值班 · 苏晴", ticket: "INC-2262", causes: ["e06", "e07"],
      changes: [
        { component: "order-service", field: "health", from: "healthy", to: "degraded" }
      ]
    },
    {
      id: "e10", ts: "2026-09-22T02:47:00+08:00", type: "rollback",
      title: "支付服务回滚 v3.2.0 → v3.1.2，切回 LEGACY 通道",
      detail: "根因确认为收单通道 V2：执行回滚并切回 UNION_LEGACY 通道。这是本次故障的转折点。",
      actor: "林晓", ticket: "CHG-1054", causes: ["e06", "e08"],
      changes: [
        { component: "payment-service", field: "version", from: "v3.2.0", to: "v3.1.2" },
        { component: "payment-service", field: "sdkChannel", from: "UNION_V2", to: "UNION_LEGACY" }
      ]
    },
    {
      id: "e11", ts: "2026-09-22T03:12:00+08:00", type: "fix",
      title: "支付恢复：成功率回升至 99.6%",
      detail: "回滚生效，支付成功率回升至 99.6%，P99 降至 780ms，支付服务恢复健康。",
      actor: "值班 · 苏晴", ticket: "INC-2261", causes: ["e10"],
      changes: [
        { component: "payment-service", field: "health", from: "degraded", to: "healthy" }
      ]
    },
    {
      id: "e12", ts: "2026-09-22T03:40:00+08:00", type: "fix",
      title: "订单链路自愈，转化率回到基线",
      detail: "支付恢复后订单链路自行恢复，转化率回到基线，订单服务恢复健康。",
      actor: "值班 · 苏晴", ticket: "INC-2262", causes: ["e11"],
      changes: [
        { component: "order-service", field: "health", from: "degraded", to: "healthy" }
      ]
    },
    {
      id: "e13", ts: "2026-09-22T10:30:00+08:00", type: "config",
      title: "撤销掩盖性配置：网关超时回调 3000 ms",
      detail: "复盘立即项：将 e07 放宽的超时回调至保守值 3000ms，恢复故障信号的灵敏度。",
      actor: "陈默", ticket: "CHG-1056", causes: ["e07"],
      changes: [
        { component: "api-gateway", field: "timeoutMs", from: 8000, to: 3000 }
      ]
    },
    {
      id: "e14", ts: "2026-09-22T16:00:00+08:00", type: "deploy",
      title: "支付服务 v3.1.3 热修复：连接池上限提高",
      detail: "对回滚基线做热修复：收单通道连接池上限提高，为通道 V2 重新上线做准备。",
      actor: "林晓", ticket: "CHG-1057", causes: ["e10"],
      changes: [
        { component: "payment-service", field: "version", from: "v3.1.2", to: "v3.1.3" }
      ]
    },
    {
      id: "e15", ts: "2026-09-23T11:00:00+08:00", type: "config",
      title: "库存缓存 TTL 加大：30 → 120 s",
      detail: "复盘行动项：大促期间库存热点键接近击穿阈值，缓存 TTL 加大并补充逻辑过期。",
      actor: "周岚", ticket: "CHG-1061", causes: [],
      changes: [
        { component: "inventory-service", field: "cacheTtlSec", from: 30, to: 120 }
      ]
    },
    {
      id: "e16", ts: "2026-09-23T14:20:00+08:00", type: "scale",
      title: "通知服务扩容：3 → 5 副本、队列线程 8 → 16",
      detail: "复盘行动项：故障期间告警洪峰导致通知积压 11 分钟，通知服务整体扩容。",
      actor: "周岚", ticket: "CHG-1062", causes: [],
      changes: [
        { component: "notification-service", field: "replicas", from: 3, to: 5 },
        { component: "notification-service", field: "queueWorkers", from: 8, to: 16 }
      ]
    },
    {
      id: "e17", ts: "2026-09-23T16:45:00+08:00", type: "config",
      title: "限流回归稳态：1200 → 1000 RPS",
      detail: "大促流量回落，入口限流从预案值回归稳态值 1000 RPS（保留少量余量）。",
      actor: "陈默", ticket: "CHG-1063", causes: [],
      changes: [
        { component: "api-gateway", field: "rateLimitRps", from: 1200, to: 1000 }
      ]
    },
    {
      id: "e18", ts: "2026-09-23T17:30:00+08:00", type: "deploy",
      title: "网关 v1.10.0：限流规则支持运行时动态调整",
      detail: "复盘加固的最后一个动作：网关热升级，后续限流调整不再需要发布。",
      actor: "林晓", ticket: "CHG-1064", causes: [],
      changes: [
        { component: "api-gateway", field: "version", from: "v1.9.4", to: "v1.10.0" }
      ]
    }
  ]
};
