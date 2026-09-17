/* Aurora 变更编年史 —— 内联数据集（首屏随页面就绪，无加载态）
 * 域模型（与 Prax 会话 product_objects 一致）：
 *   phase        阶段：时间上相邻变更集的分组（层级：中）
 *   change_set   变更集：一次可归属的变更，含字段级操作 ops（主对象）
 *   entity       组件：被变更作用的服务/配置，携带可演化字段
 *   causal_link  因果链：change.cause → 本变更，方向严格沿时间向前
 *   state_snapshot 状态切片：运行时对 ≤t 的变更按序折叠得到，不单独存数据
 */
window.AURORA_DATA = {
  meta: {
    product: "Aurora 变更编年史",
    system: "Aurora 电商平台 · 平台工程部",
    period: "2026 Q2",
    range: ["2026-04-01T00:00:00", "2026-06-30T23:59:59"]
  },

  types: {
    release:   { label: "发布", color: "#1971c2" },
    config:    { label: "配置", color: "#e8890c" },
    migration: { label: "迁移", color: "#7048e8" },
    incident:  { label: "故障", color: "#e03131" },
    rollback:  { label: "回滚", color: "#0ca678" }
  },

  entities: [
    { id: "order-api",        name: "订单服务",   group: "应用",
      fields: [["version", "3.2.0"], ["replicas", "6"], ["timeout", "800ms"], ["status", "正常"]] },
    { id: "payment-gateway",  name: "支付网关",   group: "应用",
      fields: [["version", "2.7.1"], ["replicas", "4"], ["provider", "仅微信渠道"], ["timeout", "1500ms"], ["status", "正常"]] },
    { id: "inventory-service", name: "库存服务",  group: "应用",
      fields: [["version", "1.9.0"], ["replicas", "3"], ["dedup", "关闭"], ["stock_mode", "实时扣减"]] },
    { id: "notify-worker",    name: "通知任务",   group: "应用",
      fields: [["version", "1.4.2"], ["queue", "Redis List"], ["rate_limit", "200 条/秒"]] },
    { id: "search-index",     name: "搜索索引",   group: "数据",
      fields: [["version", "5.1.0"], ["engine", "Elasticsearch 7.10"], ["freshness", "T+1 天"]] },
    { id: "pg-cluster",       name: "主数据库集群", group: "数据",
      fields: [["size", "4C16G ×2"], ["max_conn", "400"], ["backup", "每日全量 ×1"]] },
    { id: "feature-flags",    name: "功能开关",   group: "配置",
      fields: [["promo_preview", "off"], ["one_click_buy", "off"], ["audit", "无记录"]] },
    { id: "edge-cdn",         name: "边缘 CDN",   group: "基础设施",
      fields: [["cache_ttl", "300s"], ["nodes", "华东 ×4"], ["bypass", "大促全量回源"]] }
  ],

  fieldLabels: {
    version: "版本", replicas: "副本", timeout: "超时", status: "状态",
    provider: "支付渠道", dedup: "幂等去重", stock_mode: "扣减模式",
    queue: "消息队列", rate_limit: "消费限流", engine: "引擎",
    freshness: "新鲜度", promo_preview: "促销预热", one_click_buy: "一键购",
    audit: "开关审计", cache_ttl: "缓存 TTL", nodes: "节点",
    bypass: "回源策略", size: "规格", max_conn: "最大连接",
    backup: "备份策略", breaker: "熔断器"
  },

  phases: [
    { id: "P1", name: "架构奠基",   start: "2026-04-01T00:00:00", end: "2026-04-19T23:59:59", goal: "链路解耦与技术债清理" },
    { id: "P2", name: "大促备战",   start: "2026-04-20T00:00:00", end: "2026-05-17T23:59:59", goal: "峰值容量与新链路灰度" },
    { id: "P3", name: "大促冲刺",   start: "2026-05-18T00:00:00", end: "2026-05-31T23:59:59", goal: "618 预售全量就绪" },
    { id: "P4", name: "峰值与修复", start: "2026-06-01T00:00:00", end: "2026-06-04T23:59:59", goal: "峰值故障的止血与恢复" },
    { id: "P5", name: "复盘与稳定", start: "2026-06-05T00:00:00", end: "2026-06-30T23:59:59", goal: "复盘结论落地为长期改进" }
  ],

  changes: [
    { id: "c01", t: "2026-04-03T10:00:00", type: "release", actor: "陈曦 · 订单组", phase: "P1",
      title: "订单服务 3.3.0：库存调用异步化", short: "订单服务 3.3.0",
      summary: "订单服务升级 3.3.0，库存扣减改为异步消息，接口超时收紧以释放线程。",
      origin: "季度架构目标：为 618 峰值做链路解耦。",
      ops: [
        { e: "order-api", k: "version", op: "set", to: "3.3.0" },
        { e: "order-api", k: "timeout", op: "set", to: "500ms" }
      ] },

    { id: "c02", t: "2026-04-07T14:30:00", type: "config", actor: "韩磊 · 库存组", phase: "P1",
      title: "库存幂等去重进入压测模式", short: "库存去重压测",
      summary: "在压测环境开启库存去重，验证异步扣减下的幂等语义。",
      cause: "c01", why: "异步化后库存幂等性必须先行验证，先在压测环境开启去重。",
      ops: [ { e: "inventory-service", k: "dedup", op: "set", to: "压测演练模式" } ] },

    { id: "c03", t: "2026-04-10T09:00:00", type: "migration", actor: "周雨桐 · 搜索组", phase: "P1",
      title: "搜索索引迁移至 Elasticsearch 8.5", short: "搜索迁移 ES8.5",
      summary: "搜索集群整体迁移到 es-8.5，索引结构重建，双写验证后切换。",
      origin: "技术债专项：es-7.10 今年内 EOL。",
      ops: [
        { e: "search-index", k: "engine",  op: "set", to: "Elasticsearch 8.5" },
        { e: "search-index", k: "version", op: "set", to: "5.2.0" }
      ] },

    { id: "c04", t: "2026-04-15T11:00:00", type: "config", actor: "周雨桐 · 搜索组", phase: "P1",
      title: "搜索新鲜度提升至 15 分钟", short: "索引近实时",
      summary: "利用新引擎的近实时写入能力，把商品索引新鲜度从 T+1 提升到 15 分钟。",
      cause: "c03", why: "新引擎支持近实时写入，顺带把新鲜度从 T+1 提到 15 分钟。",
      ops: [ { e: "search-index", k: "freshness", op: "set", to: "15 分钟" } ] },

    { id: "c05", t: "2026-04-18T15:00:00", type: "release", actor: "韩磊 · 库存组", phase: "P1",
      title: "库存服务 2.0.0：幂等去重全量上线", short: "库存 2.0 去重上线",
      summary: "库存服务 2.0.0 发布，幂等去重正式在生产全量启用。",
      cause: "c02", why: "压测通过，幂等去重正式全量启用。",
      ops: [
        { e: "inventory-service", k: "version", op: "set", to: "2.0.0" },
        { e: "inventory-service", k: "dedup",   op: "set", to: "开启" }
      ] },

    { id: "c06", t: "2026-04-22T10:00:00", type: "config", actor: "赵一鸣 · 基础设施", phase: "P2",
      title: "数据库规格扩容至 8C32G ×3", short: "数据库扩容",
      summary: "按 5 倍峰值预估先行扩容数据库规格并上调连接池上限。",
      cause: "c01", why: "大促峰值预估 5 倍，订单链路异步化评估后先行扩容数据库。",
      ops: [
        { e: "pg-cluster", k: "size",     op: "set", to: "8C32G ×3" },
        { e: "pg-cluster", k: "max_conn", op: "set", to: "800" }
      ] },

    { id: "c07", t: "2026-04-26T14:00:00", type: "release", actor: "李彤 · 支付组", phase: "P2",
      title: "支付网关 2.8.0：接入支付宝渠道", short: "双支付渠道",
      summary: "支付网关升级 2.8.0，支付宝渠道上线，双渠道分流降低单渠道风险。",
      origin: "支付宝渠道商务谈判完成，双渠道分流。",
      ops: [
        { e: "payment-gateway", k: "version",  op: "set", to: "2.8.0" },
        { e: "payment-gateway", k: "provider", op: "set", to: "微信 + 支付宝" }
      ] },

    { id: "c08", t: "2026-05-06T10:30:00", type: "config", actor: "赵一鸣 · 基础设施", phase: "P2",
      title: "CDN 大促白名单缓存", short: "CDN 白名单缓存",
      summary: "静态资源与商品详情页进入缓存白名单，TTL 上调，减轻回源压力。",
      origin: "大促备战：详情页读多写少，进缓存白名单。",
      ops: [
        { e: "edge-cdn", k: "cache_ttl", op: "set", to: "600s" },
        { e: "edge-cdn", k: "bypass",    op: "set", to: "白名单缓存" }
      ] },

    { id: "c09", t: "2026-05-10T16:00:00", type: "release", actor: "吴倩 · 大促项目组", phase: "P2",
      title: "通知任务 1.5.0：队列迁移 RocketMQ", short: "通知队列迁移",
      summary: "通知消费队列从 Redis List 迁移到 RocketMQ，获得堆积与重试能力。",
      cause: "c05", why: "库存去重全量后扣减事件量翻倍，Redis List 有积压风险。",
      ops: [
        { e: "notify-worker", k: "queue",   op: "set", to: "RocketMQ" },
        { e: "notify-worker", k: "version", op: "set", to: "1.5.0" }
      ] },

    { id: "c10", t: "2026-05-13T11:00:00", type: "config", actor: "吴倩 · 大促项目组", phase: "P2",
      title: "通知消费限流上调至 800 条/秒", short: "通知限流上调",
      summary: "新队列压测吞吐充足，消费限流从 200 条/秒上调到 800 条/秒。",
      cause: "c09", why: "新队列压测可达 2k/s，消费限流相应上调。",
      ops: [ { e: "notify-worker", k: "rate_limit", op: "set", to: "800 条/秒" } ] },

    { id: "c11", t: "2026-05-16T10:00:00", type: "config", actor: "王砚 · 平台组", phase: "P2",
      title: "一键购链路 5% 灰度", short: "一键购灰度",
      summary: "一键购新链路开启 5% 灰度，同时补齐功能开关的审计日志。",
      origin: "一键购新链路开启灰度，同步补齐开关审计。",
      ops: [
        { e: "feature-flags", k: "one_click_buy", op: "set", to: "5% 灰度" },
        { e: "feature-flags", k: "audit",         op: "set", to: "全量审计日志" }
      ] },

    { id: "c12", t: "2026-05-19T10:00:00", type: "config", actor: "王砚 · 平台组", phase: "P3",
      title: "促销预热开关全量打开", short: "促销预热全量",
      summary: "promo_preview 全量打开，大促活动页与预热触达正式生效。",
      cause: "c11", why: "灰度一周无异常，促销预热开关按计划全量。",
      ops: [ { e: "feature-flags", k: "promo_preview", op: "set", to: "on" } ] },

    { id: "c13", t: "2026-05-24T15:00:00", type: "release", actor: "陈曦 · 订单组", phase: "P3",
      title: "订单服务 3.4.0：一键购链路", short: "订单 3.4 一键购",
      summary: "订单服务 3.4.0 发布，提供一键购下单原子链路，赶在预售前完成。",
      cause: "c12", why: "促销引流落地页依赖一键购链路，赶在预售前发布。",
      ops: [ { e: "order-api", k: "version", op: "set", to: "3.4.0" } ] },

    { id: "c14", t: "2026-05-28T10:00:00", type: "config", actor: "王砚 · 平台组", phase: "P3",
      title: "一键购全量放开", short: "一键购全量",
      summary: "一键购从 5% 灰度直接放开到 100%，迎接 5 月 31 日预售开场。",
      cause: "c13", why: "新链路发布后观察 4 天平稳，全量放开迎接预售。",
      ops: [ { e: "feature-flags", k: "one_click_buy", op: "set", to: "100% 全量" } ] },

    { id: "c15", t: "2026-05-30T09:30:00", type: "config", actor: "赵一鸣 · 基础设施", phase: "P3",
      title: "CDN 紧急扩容华东 ×8", short: "CDN 紧急扩容",
      summary: "白名单缓存命中率 62% 低于预期，回源压力偏大，紧急增加 4 个边缘节点。",
      cause: "c08", why: "白名单缓存命中率 62% 低于预期，回源压力大，紧急加节点。",
      ops: [ { e: "edge-cdn", k: "nodes", op: "set", to: "华东 ×8" } ] },

    { id: "c16", t: "2026-05-31T20:05:00", type: "incident", actor: "李彤 · 支付组", phase: "P3",
      title: "P0：预售开场支付大面积超时", short: "预售支付超时",
      summary: "预售开场 5 分钟支付超时雪崩：支付网关超时降级，订单接口排队积压。",
      cause: "c14", why: "一键购全量后支付请求为平日 6 倍，支付宝渠道 RT 飙至 8s，预售开场即超时雪崩。",
      ops: [
        { e: "payment-gateway", k: "status", op: "set", to: "超时降级" },
        { e: "order-api",       k: "status", op: "set", to: "排队积压" }
      ] },

    { id: "c17", t: "2026-05-31T20:40:00", type: "rollback", actor: "李彤 · 支付组", phase: "P3",
      title: "临时关闭支付宝渠道止血", short: "断支付宝止血",
      summary: "切断 RT 异常的支付宝渠道，支付流量全部回落到微信主链路。",
      cause: "c16", why: "止血优先：先切断 RT 异常的支付宝渠道，保住微信主链路。",
      ops: [ { e: "payment-gateway", k: "provider", op: "set", to: "仅微信（支付宝暂闭）" } ] },

    { id: "c18", t: "2026-06-01T00:15:00", type: "config", actor: "赵一鸣 · 基础设施", phase: "P4",
      title: "支付网关扩容 ×12 并收紧超时", short: "网关扩容回调",
      summary: "凌晨定位为网关容量不足：副本 4→12，超时参数回调至 2s，状态转入恢复。",
      cause: "c17", why: "复盘定位为网关容量不足，凌晨紧急扩容并收紧超时参数。",
      ops: [
        { e: "payment-gateway", k: "replicas", op: "set", to: "12" },
        { e: "payment-gateway", k: "timeout",  op: "set", to: "2000ms" },
        { e: "payment-gateway", k: "status",   op: "set", to: "恢复中" }
      ] },

    { id: "c19", t: "2026-06-01T09:00:00", type: "config", actor: "李彤 · 支付组", phase: "P4",
      title: "支付宝渠道恢复，一键购限流 70%", short: "渠道恢复限流",
      summary: "容量恢复后支付宝渠道回归，一键购降至 70% 限流防止二次雪崩，全链路转正常。",
      cause: "c18", why: "容量恢复后支付宝渠道回归，一键购限流 70% 防二次雪崩。",
      ops: [
        { e: "payment-gateway", k: "provider", op: "set", to: "微信 + 支付宝" },
        { e: "payment-gateway", k: "status",   op: "set", to: "正常" },
        { e: "order-api",       k: "status",   op: "set", to: "正常" },
        { e: "feature-flags",   k: "one_click_buy", op: "set", to: "70% 限流" }
      ] },

    { id: "c20", t: "2026-06-03T14:00:00", type: "release", actor: "吴倩 · 大促项目组", phase: "P4",
      title: "通知任务 1.5.1：消费削峰", short: "通知削峰 1.5.1",
      summary: "预售夜通知积压 40 万条；1.5.1 增加削峰填谷，限流上调到 1200 条/秒。",
      cause: "c16", why: "预售夜通知积压 40 万条，消费侧加削峰并上调限流。",
      ops: [
        { e: "notify-worker", k: "version",    op: "set", to: "1.5.1" },
        { e: "notify-worker", k: "rate_limit", op: "set", to: "1200 条/秒" }
      ] },

    { id: "c21", t: "2026-06-05T10:00:00", type: "migration", actor: "赵一鸣 · 基础设施", phase: "P5",
      title: "订单库读写分离落地", short: "订单库读写分离",
      summary: "新增两个只读副本承载读流量，写连接上限相应回调，缓解读写混布瓶颈。",
      cause: "c06", why: "大促写峰值证实瓶颈在读写混布，落地读写分离。",
      ops: [
        { e: "pg-cluster", k: "size",     op: "set", to: "8C32G ×3 + 只读 ×2" },
        { e: "pg-cluster", k: "max_conn", op: "set", to: "600" }
      ] },

    { id: "c22", t: "2026-06-10T11:00:00", type: "config", actor: "赵一鸣 · 基础设施", phase: "P5",
      title: "备份策略升级为小时级增量", short: "备份策略升级",
      summary: "只读副本引入后 RPO 要求提升，备份升级为每小时增量 + 每日全量。",
      cause: "c21", why: "只读副本引入后 RPO 要求提升，备份策略同步升级。",
      ops: [ { e: "pg-cluster", k: "backup", op: "set", to: "每小时增量 + 每日全量" } ] },

    { id: "c23", t: "2026-06-16T15:00:00", type: "release", actor: "李彤 · 支付组", phase: "P5",
      title: "支付网关 2.9.0：渠道级自动熔断", short: "网关自动熔断",
      summary: "复盘结论落地：网关内置渠道级自动熔断，异常渠道自动摘除，不再依赖人工止血。",
      cause: "c16", why: "复盘结论：人工断渠道太慢，网关内置渠道级自动熔断。",
      ops: [
        { e: "payment-gateway", k: "version", op: "set", to: "2.9.0" },
        { e: "payment-gateway", k: "breaker", op: "add", to: "自动熔断（渠道级）" }
      ] },

    { id: "c24", t: "2026-06-24T10:00:00", type: "config", actor: "王砚 · 平台组", phase: "P5",
      title: "一键购恢复全量，复盘项关闭", short: "一键购恢复全量",
      summary: "一键购限流运行两周无异常，恢复 100% 全量；审计升级为审计 + 周报，复盘项关闭。",
      cause: "c19", why: "限流运行两周无异常，恢复全量并关闭复盘项。",
      ops: [
        { e: "feature-flags", k: "one_click_buy", op: "set", to: "100% 全量" },
        { e: "feature-flags", k: "audit",         op: "set", to: "审计 + 周报" }
      ] }
  ]
};
