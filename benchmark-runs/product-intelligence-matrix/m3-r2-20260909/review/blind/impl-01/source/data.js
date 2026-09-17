/* ============================================================
 * 脉络 Trace · 数据层
 * 电商平台的完整依赖关系网（35 节点 / 56 关系）
 * 边方向语义：from → to 表示「from 依赖 to」（调用/发布/读写）
 *   - 依赖跟随 = 沿出边向下
 *   - 影响跟随 = 沿入边向上（下游全受波及）
 * ============================================================ */

const GRAPH = {
  meta: {
    title: '青梧电商平台 · 服务依赖图谱',
    updated: '2026-09',
    bandNote: '依赖方向自上而下流动：接入层 → 业务服务 → 消息总线 → 数据与外部',
  },

  nodes: [
    /* ---- 接入层 ---- */
    { id: 'web-app',      name: 'Web 商城',   type: 'access', band: 'access',  row: 0, domain: '交易', owner: '前端组', crit: 'P1', desc: '面向买家的浏览器端商城（SPA），所有页面请求经 API 网关进入后端。' },
    { id: 'mobile-app',   name: 'App 商城',   type: 'access', band: 'access',  row: 0, domain: '交易', owner: '前端组', crit: 'P1', desc: 'iOS / Android 双端原生应用，与 Web 端共用网关与后端服务。' },
    { id: 'open-api',     name: '开放平台',   type: 'access', band: 'access',  row: 0, domain: '平台', owner: '平台组', crit: 'P2', desc: '面向 ISV 与合作伙伴的开放 API 入口，走独立鉴权与限流配额。' },
    { id: 'api-gateway',  name: 'API 网关',   type: 'access', band: 'access',  row: 0, domain: '平台', owner: '平台组', crit: 'P0', desc: '全站统一入口：路由、鉴权、限流、灰度分流。是全网依赖汇聚点。' },

    /* ---- 业务服务 · 第一行 ---- */
    { id: 'auth-svc',      name: '认证服务',   type: 'service', band: 'service', row: 0, domain: '用户', owner: '账号组', crit: 'P0', desc: '登录态维护、Token 签发与校验，所有请求鉴权的源头。' },
    { id: 'user-svc',      name: '用户服务',   type: 'service', band: 'service', row: 0, domain: '用户', owner: '账号组', crit: 'P0', desc: '账户、档案、收货地址管理，并向消息总线发布用户域事件。' },
    { id: 'merchant-svc',  name: '商家服务',   type: 'service', band: 'service', row: 0, domain: '商品', owner: '商家组', crit: 'P1', desc: '商家入驻、店铺装修与资质审核。' },
    { id: 'product-svc',   name: '商品服务',   type: 'service', band: 'service', row: 0, domain: '商品', owner: '商品组', crit: 'P0', desc: 'SPU / SKU、类目与详情管理，写商品索引并归属到商家。' },
    { id: 'search-svc',    name: '搜索服务',   type: 'service', band: 'service', row: 0, domain: '商品', owner: '搜索组', crit: 'P1', desc: '商品检索与搜索联想，消费库存事件回写售罄状态。' },
    { id: 'pricing-svc',   name: '价格服务',   type: 'service', band: 'service', row: 0, domain: '交易', owner: '交易组', crit: 'P0', desc: '原价、会员价与优惠叠算的唯一计价入口，购物车与订单共用。' },
    { id: 'promo-svc',     name: '营销服务',   type: 'service', band: 'service', row: 0, domain: '营销', owner: '营销组', crit: 'P1', desc: '优惠券、满减与大促活动，消费用户事件刷新人群资格。' },
    { id: 'cart-svc',      name: '购物车服务', type: 'service', band: 'service', row: 0, domain: '交易', owner: '交易组', crit: 'P1', desc: '购物车增删改与结算前校验：实时计价、商品快照、库存预检。' },

    /* ---- 业务服务 · 第二行 ---- */
    { id: 'order-svc',     name: '订单服务',   type: 'service', band: 'service', row: 1, domain: '交易', owner: '交易组', crit: 'P0', desc: '交易主流程：下单、拆单、状态机。同步依赖计价/库存/风控/支付，并对外发布订单事件。' },
    { id: 'payment-svc',   name: '支付服务',   type: 'service', band: 'service', row: 1, domain: '支付', owner: '支付组', crit: 'P0', desc: '收单、退款与支付渠道路由，记账并发布支付事件。' },
    { id: 'ledger-svc',    name: '账务服务',   type: 'service', band: 'service', row: 1, domain: '支付', owner: '财务组', crit: 'P1', desc: '交易流水记账与日结对账，订阅支付事件、读取订单流水。' },
    { id: 'inventory-svc', name: '库存服务',   type: 'service', band: 'service', row: 1, domain: '履约', owner: '履约组', crit: 'P0', desc: '库存扣减、锁定与回补，库存变化对外发布事件。' },
    { id: 'shipping-svc',  name: '履约服务',   type: 'service', band: 'service', row: 1, domain: '履约', owner: '履约组', crit: 'P1', desc: '发货、运单与物流跟踪，订阅「支付成功」事件触发履约。' },
    { id: 'risk-svc',      name: '风控服务',   type: 'service', band: 'service', row: 1, domain: '平台', owner: '风控组', crit: 'P0', desc: '交易反欺诈、名单与限购校验；下单链路的同步关卡。' },
    { id: 'notify-svc',    name: '通知服务',   type: 'service', band: 'service', row: 1, domain: '用户', owner: '增长组', crit: 'P2', desc: '短信 / 站内信 / 邮件触达，订阅订单与支付事件驱动消息下发。' },
    { id: 'recommend-svc', name: '推荐服务',   type: 'service', band: 'service', row: 1, domain: '商品', owner: '算法组', crit: 'P2', desc: '个性化推荐与猜你喜欢，读行为明细与商品候选集。' },

    /* ---- 消息总线 ---- */
    { id: 't-order',     name: '订单事件流', type: 'topic', band: 'topic', row: 0, domain: '交易', owner: '平台组', crit: 'P0', desc: 'Kafka Topic：订单域事件（创建 / 支付成功 / 取消）。履约、通知、数仓共同订阅。' },
    { id: 't-payment',   name: '支付事件流', type: 'topic', band: 'topic', row: 0, domain: '支付', owner: '平台组', crit: 'P0', desc: 'Kafka Topic：支付域事件（成功 / 退款）。驱动通知、记账与数仓入仓。' },
    { id: 't-inventory', name: '库存事件流', type: 'topic', band: 'topic', row: 0, domain: '履约', owner: '平台组', crit: 'P1', desc: 'Kafka Topic：库存变化事件。搜索据此回写售罄态，数仓实时入仓。' },
    { id: 't-user',      name: '用户事件流', type: 'topic', band: 'topic', row: 0, domain: '用户', owner: '平台组', crit: 'P1', desc: 'Kafka Topic：用户域事件（注册 / 资料变更）。营销、风控、推荐订阅。' },

    /* ---- 数据与外部 · 第一行 ---- */
    { id: 'pg-orders',    name: '订单库',     type: 'data', band: 'data', row: 0, domain: '交易', owner: 'DBA 组', crit: 'P0', desc: 'PostgreSQL 订单主库，交易域事实数据的事实来源（Source of Truth）。' },
    { id: 'pg-users',     name: '用户库',     type: 'data', band: 'data', row: 0, domain: '用户', owner: 'DBA 组', crit: 'P0', desc: 'PostgreSQL 账户主库。认证、风控、营销的资格与名单都取自这里。' },
    { id: 'es-catalog',   name: '商品索引',   type: 'data', band: 'data', row: 0, domain: '商品', owner: '搜索组', crit: 'P1', desc: 'Elasticsearch 商品检索索引，由商品服务写入、搜索与推荐读取。' },
    { id: 'redis-cart',   name: '购物车缓存', type: 'data', band: 'data', row: 0, domain: '交易', owner: 'DBA 组', crit: 'P1', desc: 'Redis 购物车会话数据，允许丢失重建（可从用户行为恢复）。' },
    { id: 'redis-session',name: '会话缓存',   type: 'data', band: 'data', row: 0, domain: '用户', owner: 'DBA 组', crit: 'P0', desc: 'Redis 登录态与 Token 存储。失效即全员掉线。' },

    /* ---- 数据与外部 · 第二行 ---- */
    { id: 'ch-analytics', name: '分析仓库',   type: 'data',     band: 'data', row: 1, domain: '平台', owner: '数据组', crit: 'P2', desc: 'ClickHouse 全域行为与交易明细，三条事件流实时入仓，供风控特征与推荐训练。' },
    { id: 'oss-media',    name: '媒体存储',   type: 'data',     band: 'data', row: 1, domain: '商品', owner: '平台组', crit: 'P2', desc: '对象存储：商品图片、店铺装修素材与附件。' },
    { id: 'wechat-pay',   name: '微信支付',   type: 'external', band: 'data', row: 1, domain: '支付', owner: '支付组', crit: 'P0', desc: '外部支付渠道（微信），不可控依赖，需对账兜底。' },
    { id: 'alipay',       name: '支付宝',     type: 'external', band: 'data', row: 1, domain: '支付', owner: '支付组', crit: 'P0', desc: '外部支付渠道（支付宝），不可控依赖，需对账兜底。' },
    { id: 'sf-express',   name: '顺丰物流',   type: 'external', band: 'data', row: 1, domain: '履约', owner: '履约组', crit: 'P1', desc: '外部运单创建与轨迹查询 API。' },
    { id: 'sms-gw',       name: '短信通道',   type: 'external', band: 'data', row: 1, domain: '用户', owner: '增长组', crit: 'P2', desc: '外部短信服务商，验证码与通知下行通道。' },
  ],

  edges: [
    /* 接入层 → 网关 → 服务路由 */
    { from: 'web-app',      to: 'api-gateway',  kind: 'sync',  label: 'HTTPS 路由' },
    { from: 'mobile-app',   to: 'api-gateway',  kind: 'sync',  label: 'HTTPS 路由' },
    { from: 'open-api',     to: 'api-gateway',  kind: 'sync',  label: '开放接口路由' },
    { from: 'api-gateway',  to: 'auth-svc',     kind: 'sync',  label: 'Token 校验' },
    { from: 'api-gateway',  to: 'user-svc',     kind: 'sync',  label: '路由 /users' },
    { from: 'api-gateway',  to: 'product-svc',  kind: 'sync',  label: '路由 /products' },
    { from: 'api-gateway',  to: 'cart-svc',     kind: 'sync',  label: '路由 /cart' },
    { from: 'api-gateway',  to: 'order-svc',    kind: 'sync',  label: '路由 /orders' },
    { from: 'api-gateway',  to: 'search-svc',   kind: 'sync',  label: '路由 /search' },
    { from: 'api-gateway',  to: 'recommend-svc',kind: 'sync',  label: '推荐位路由' },

    /* 账号域 */
    { from: 'auth-svc',     to: 'redis-session',kind: 'data',  label: '会话读写' },
    { from: 'auth-svc',     to: 'user-svc',     kind: 'sync',  label: '档案读取' },
    { from: 'user-svc',     to: 'pg-users',     kind: 'data',  label: '账户主数据' },
    { from: 'user-svc',     to: 't-user',       kind: 'event', label: '发布用户事件' },

    /* 商品域 */
    { from: 'product-svc',  to: 'es-catalog',   kind: 'data',  label: '写商品索引' },
    { from: 'product-svc',  to: 'oss-media',    kind: 'data',  label: '商品图片' },
    { from: 'product-svc',  to: 'merchant-svc', kind: 'sync',  label: '归属校验' },
    { from: 'search-svc',   to: 'es-catalog',   kind: 'data',  label: '检索查询' },
    { from: 'merchant-svc', to: 'oss-media',    kind: 'data',  label: '店铺素材' },

    /* 计价 · 购物车 */
    { from: 'pricing-svc',  to: 'promo-svc',    kind: 'sync',  label: '优惠叠算' },
    { from: 'pricing-svc',  to: 'product-svc',  kind: 'sync',  label: '原价查询' },
    { from: 'promo-svc',    to: 'user-svc',     kind: 'sync',  label: '资格校验' },
    { from: 'promo-svc',    to: 't-user',       kind: 'event', label: '订阅·人群刷新' },
    { from: 'cart-svc',     to: 'redis-cart',   kind: 'data',  label: '购物车读写' },
    { from: 'cart-svc',     to: 'pricing-svc',  kind: 'sync',  label: '实时计价' },
    { from: 'cart-svc',     to: 'product-svc',  kind: 'sync',  label: '商品快照' },
    { from: 'cart-svc',     to: 'inventory-svc',kind: 'sync',  label: '库存预检' },

    /* 订单主干 */
    { from: 'order-svc',    to: 'pricing-svc',  kind: 'sync',  label: '订单计价' },
    { from: 'order-svc',    to: 'inventory-svc',kind: 'sync',  label: '锁定库存' },
    { from: 'order-svc',    to: 'risk-svc',     kind: 'sync',  label: '下单风控' },
    { from: 'order-svc',    to: 'payment-svc',  kind: 'sync',  label: '发起收单' },
    { from: 'order-svc',    to: 'pg-orders',    kind: 'data',  label: '订单落库' },
    { from: 'order-svc',    to: 't-order',      kind: 'event', label: '发布订单事件' },

    /* 支付 · 账务 */
    { from: 'payment-svc',  to: 'wechat-pay',   kind: 'sync',  label: '渠道收单' },
    { from: 'payment-svc',  to: 'alipay',       kind: 'sync',  label: '渠道收单' },
    { from: 'payment-svc',  to: 'ledger-svc',   kind: 'sync',  label: '实时记账' },
    { from: 'payment-svc',  to: 't-payment',    kind: 'event', label: '发布支付事件' },
    { from: 'ledger-svc',   to: 't-payment',    kind: 'event', label: '订阅·对账触发' },
    { from: 'ledger-svc',   to: 'pg-orders',    kind: 'data',  label: '流水核对' },

    /* 库存 · 履约 */
    { from: 'inventory-svc',to: 't-inventory',  kind: 'event', label: '发布库存事件' },
    { from: 'shipping-svc', to: 't-order',      kind: 'event', label: '订阅·支付成功发货' },
    { from: 'shipping-svc', to: 'sf-express',   kind: 'sync',  label: '运单创建' },
    { from: 'notify-svc',   to: 't-order',      kind: 'event', label: '订阅·订单通知' },
    { from: 'notify-svc',   to: 't-payment',    kind: 'event', label: '订阅·支付通知' },
    { from: 'notify-svc',   to: 'sms-gw',       kind: 'sync',  label: '短信下发' },
    { from: 'notify-svc',   to: 'user-svc',     kind: 'sync',  label: '取联系方式' },

    /* 风控 · 推荐 · 数仓 */
    { from: 'risk-svc',     to: 'pg-users',     kind: 'data',  label: '名单查询' },
    { from: 'risk-svc',     to: 'ch-analytics', kind: 'data',  label: '特征读取' },
    { from: 'risk-svc',     to: 't-user',       kind: 'event', label: '订阅·名单更新' },
    { from: 'recommend-svc',to: 'ch-analytics', kind: 'data',  label: '行为明细' },
    { from: 'recommend-svc',to: 'es-catalog',   kind: 'data',  label: '候选集读取' },
    { from: 'recommend-svc',to: 't-user',       kind: 'event', label: '订阅·兴趣更新' },
    { from: 'ch-analytics', to: 't-order',      kind: 'event', label: '实时入仓' },
    { from: 'ch-analytics', to: 't-payment',    kind: 'event', label: '实时入仓' },
    { from: 'ch-analytics', to: 't-inventory',  kind: 'event', label: '实时入仓' },
    { from: 'search-svc',   to: 't-inventory',  kind: 'event', label: '订阅·售罄回写' },
  ],
};
