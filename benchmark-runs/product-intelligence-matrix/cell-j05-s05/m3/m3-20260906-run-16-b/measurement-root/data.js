/* DepAtlas 内联数据集 —— 页面加载即就绪，无任何网络请求。
 * 一个虚构电商系统：24 个服务、4 个团队、4 个层级、40 条依赖关系。 */
window.DEPATLAS_DATA = {
  meta: { name: "星衡电商 · 生产系统", nodes: 24, edges: 40 },
  teams: {
    platform: { name: "平台组", color: "#a78bfa" },
    trade:    { name: "交易组", color: "#fb923c" },
    growth:   { name: "增长组", color: "#34d399" },
    data:     { name: "数据组", color: "#60a5fa" }
  },
  tiers: [
    { n: 1, name: "客户端入口" },
    { n: 2, name: "网关接入" },
    { n: 3, name: "业务服务" },
    { n: 4, name: "数据与基础设施" }
  ],
  nodes: [
    /* T1 客户端入口 */
    { id: "web-app",                zh: "Web 商城",   tier: 1, team: "growth",   desc: "浏览器端商城单页应用" },
    { id: "mobile-app",             zh: "App 客户端", tier: 1, team: "growth",   desc: "iOS / Android 原生客户端" },
    { id: "partner-api",            zh: "开放接口",   tier: 1, team: "growth",   desc: "面向合作方的开放接口" },
    /* T2 网关接入 */
    { id: "api-gateway",            zh: "统一网关",   tier: 2, team: "platform", desc: "统一入口：路由、限流、聚合" },
    { id: "edge-auth",              zh: "边缘鉴权",   tier: 2, team: "platform", desc: "会话鉴权与令牌签发" },
    /* T3 业务服务 */
    { id: "user-service",           zh: "用户服务",   tier: 3, team: "platform", desc: "账户、资料与登录态" },
    { id: "order-service",          zh: "订单服务",   tier: 3, team: "trade",    desc: "订单生命周期与状态机" },
    { id: "payment-service",        zh: "支付服务",   tier: 3, team: "trade",    desc: "收单、退款与对账" },
    { id: "inventory-service",      zh: "库存服务",   tier: 3, team: "trade",    desc: "库存扣减与预占" },
    { id: "fraud-check",            zh: "风控引擎",   tier: 3, team: "trade",    desc: "交易风控规则引擎" },
    { id: "promotion-service",      zh: "营销服务",   tier: 3, team: "trade",    desc: "优惠券与活动规则" },
    { id: "shipping-service",       zh: "物流服务",   tier: 3, team: "trade",    desc: "运单与物流对接" },
    { id: "notification-service",   zh: "通知服务",   tier: 3, team: "platform", desc: "短信、邮件与站内信" },
    { id: "catalog-service",        zh: "商品服务",   tier: 3, team: "growth",   desc: "商品与类目管理" },
    { id: "search-service",         zh: "搜索服务",   tier: 3, team: "growth",   desc: "商品搜索入口" },
    { id: "recommendation-service", zh: "推荐服务",   tier: 3, team: "growth",   desc: "个性化推荐计算" },
    { id: "identity-service",       zh: "身份服务",   tier: 3, team: "platform", desc: "主体身份与权限源" },
    /* T4 数据与基础设施 */
    { id: "postgres-cluster",       zh: "PostgreSQL", tier: 4, team: "data",     desc: "核心关系库（主备）" },
    { id: "redis-cache",            zh: "Redis",      tier: 4, team: "data",     desc: "热点缓存与分布式锁" },
    { id: "elasticsearch",          zh: "ES 集群",    tier: 4, team: "data",     desc: "搜索与日志检索集群" },
    { id: "kafka-bus",              zh: "Kafka",      tier: 4, team: "data",     desc: "领域事件总线" },
    { id: "ledger-db",              zh: "流水账本",   tier: 4, team: "data",     desc: "支付流水账（只追加）" },
    { id: "object-storage",         zh: "对象存储",   tier: 4, team: "data",     desc: "图片与附件存储" },
    { id: "config-center",          zh: "配置中心",   tier: 4, team: "platform", desc: "配置下发与灰度开关" }
  ],
  edges: [
    { id: "e01", from: "web-app",                to: "api-gateway",            type: "call", critical: false },
    { id: "e02", from: "mobile-app",             to: "api-gateway",            type: "call", critical: false },
    { id: "e03", from: "partner-api",            to: "api-gateway",            type: "call", critical: false },
    { id: "e04", from: "api-gateway",            to: "edge-auth",              type: "call", critical: true  },
    { id: "e05", from: "api-gateway",            to: "user-service",           type: "call", critical: false },
    { id: "e06", from: "api-gateway",            to: "order-service",          type: "call", critical: true  },
    { id: "e07", from: "api-gateway",            to: "catalog-service",        type: "call", critical: false },
    { id: "e08", from: "api-gateway",            to: "search-service",         type: "call", critical: false },
    { id: "e09", from: "edge-auth",              to: "identity-service",       type: "call", critical: true  },
    { id: "e10", from: "edge-auth",              to: "redis-cache",            type: "data", critical: false },
    { id: "e11", from: "user-service",           to: "postgres-cluster",       type: "data", critical: true  },
    { id: "e12", from: "user-service",           to: "redis-cache",            type: "data", critical: false },
    { id: "e13", from: "order-service",          to: "payment-service",        type: "call", critical: true  },
    { id: "e14", from: "order-service",          to: "inventory-service",      type: "call", critical: true  },
    { id: "e15", from: "order-service",          to: "promotion-service",      type: "call", critical: false },
    { id: "e16", from: "order-service",          to: "shipping-service",       type: "call", critical: false },
    { id: "e17", from: "order-service",          to: "kafka-bus",              type: "data", critical: true  },
    { id: "e18", from: "order-service",          to: "postgres-cluster",       type: "data", critical: true  },
    { id: "e19", from: "payment-service",        to: "fraud-check",            type: "call", critical: true  },
    { id: "e20", from: "payment-service",        to: "ledger-db",              type: "data", critical: true  },
    { id: "e21", from: "payment-service",        to: "notification-service",   type: "call", critical: false },
    { id: "e22", from: "inventory-service",      to: "postgres-cluster",       type: "data", critical: true  },
    { id: "e23", from: "inventory-service",      to: "redis-cache",            type: "data", critical: false },
    { id: "e24", from: "catalog-service",        to: "postgres-cluster",       type: "data", critical: false },
    { id: "e25", from: "catalog-service",        to: "elasticsearch",          type: "data", critical: true  },
    { id: "e26", from: "catalog-service",        to: "object-storage",         type: "data", critical: false },
    { id: "e27", from: "search-service",         to: "elasticsearch",          type: "data", critical: true  },
    { id: "e28", from: "search-service",         to: "recommendation-service", type: "call", critical: false },
    { id: "e29", from: "recommendation-service", to: "kafka-bus",              type: "data", critical: false },
    { id: "e30", from: "recommendation-service", to: "redis-cache",            type: "data", critical: false },
    { id: "e31", from: "promotion-service",      to: "postgres-cluster",       type: "data", critical: false },
    { id: "e32", from: "promotion-service",      to: "redis-cache",            type: "data", critical: false },
    { id: "e33", from: "shipping-service",       to: "kafka-bus",              type: "data", critical: false },
    { id: "e34", from: "shipping-service",       to: "notification-service",   type: "call", critical: false },
    { id: "e35", from: "notification-service",   to: "kafka-bus",              type: "data", critical: false },
    { id: "e36", from: "notification-service",   to: "config-center",          type: "data", critical: false },
    { id: "e37", from: "fraud-check",            to: "identity-service",       type: "call", critical: true  },
    { id: "e38", from: "fraud-check",            to: "redis-cache",            type: "data", critical: false },
    { id: "e39", from: "identity-service",       to: "postgres-cluster",       type: "data", critical: true  },
    { id: "e40", from: "config-center",          to: "object-storage",         type: "data", critical: false }
  ]
};
