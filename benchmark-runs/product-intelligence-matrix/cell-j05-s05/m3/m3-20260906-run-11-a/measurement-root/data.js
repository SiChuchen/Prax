// 星脉 · 服务关系图谱 — 内联数据集（电商平台核心交易链路）
// 节点: {id, name, type: service|data|queue|external|client, team, crit, desc}
// 边: [source, target, kind] — source 依赖 target，箭头指向被依赖方
//     kind: call 同步调用 | data 数据读写 | pub 发布事件(影响双向) | sub 订阅事件
window.GRAPH = (function () {
  var N = function (id, name, type, team, crit, desc) {
    return { id: id, name: name, type: type, team: team, crit: crit, desc: desc };
  };

  var nodes = [
    // 客户端
    N('web', 'Web 商城', 'client', '前端', 'P1', 'PC / H5 下单入口'),
    N('app', 'App 商城', 'client', '前端', 'P1', 'iOS / Android 下单入口'),
    // 网关与基础
    N('gw', '统一网关', 'service', '基础设施', 'P0', '鉴权、路由与限流统一入口'),
    N('auth', '认证服务', 'service', '基础设施', 'P0', '登录态与令牌签发'),
    N('notify', '消息中心', 'service', '基础设施', 'P1', '短信 / Push 统一触达'),
    // 用户
    N('user', '用户服务', 'service', '用户', 'P0', '账户、地址与用户基础数据'),
    // 交易
    N('cart', '购物车服务', 'service', '交易', 'P1', '加购、改价与结算清单'),
    N('order', '订单服务', 'service', '交易', 'P0', '交易主流程编排'),
    N('product', '商品服务', 'service', '交易', 'P0', '商品与 SKU 主数据'),
    N('price', '价格中心', 'service', '交易', 'P0', '定价、划线价与价格试算'),
    N('search', '搜索服务', 'service', '交易', 'P1', '商品检索与搜索联想'),
    N('rec', '推荐服务', 'service', '数据', 'P2', '首页与详情页个性化推荐'),
    // 营销
    N('promo', '促销服务', 'service', '营销', 'P1', '满减 / 折扣规则引擎'),
    N('coupon', '券系统', 'service', '营销', 'P1', '发券、领券与核销'),
    // 履约
    N('inv', '库存服务', 'service', '履约', 'P0', '库存扣减、回补与预占'),
    N('logi', '物流服务', 'service', '履约', 'P1', '运单下发与轨迹跟踪'),
    N('wms', '仓储 WMS', 'service', '履约', 'P2', '拣货、打包与出库'),
    // 支付
    N('pay', '支付服务', 'service', '支付', 'P0', '收单聚合与支付状态机'),
    N('refund', '退款服务', 'service', '支付', 'P1', '退款与原路退回'),
    N('settle', '结算服务', 'service', '支付', 'P1', '商家结算与分账'),
    N('ledger', '台账服务', 'service', '支付', 'P1', '资金流水复式记账'),
    N('invoice', '发票服务', 'service', '支付', 'P2', '电子发票开具与红冲'),
    // 风控
    N('risk', '风控服务', 'service', '风控', 'P0', '下单 / 支付实时风险评估'),
    // 数据
    N('sync', '数据同步服务', 'service', '数据', 'P2', 'Binlog CDC 与事件入仓'),
    N('etl', '数仓 ETL', 'service', '数据', 'P2', '数仓分层加工调度'),
    N('bi', 'BI 报表', 'service', '数据', 'P2', '经营指标看板'),
    // 数据存储
    N('db-order', '订单主库', 'data', '交易', 'P0', '订单 / 子单持久化'),
    N('db-user', '用户主库', 'data', '用户', 'P0', '账户与地址持久化'),
    N('db-product', '商品主库', 'data', '交易', 'P0', '商品 / SKU / 类目'),
    N('db-pay', '支付流水库', 'data', '支付', 'P0', '支付单与资金流水'),
    N('redis-cart', '购物车缓存', 'data', '交易', 'P1', '购物车高频读写缓存'),
    N('redis-inv', '库存缓存', 'data', '履约', 'P0', '热点 SKU 库存扣减'),
    N('es-item', '商品搜索索引', 'data', '交易', 'P1', '商品检索倒排索引'),
    N('dw-dwd', '数仓明细层', 'data', '数据', 'P2', 'DWD 明细宽表'),
    N('dw-ads', '数仓应用层', 'data', '数据', 'P2', 'ADS 指标与用户画像'),
    // 消息主题
    N('k-order', 'order.events', 'queue', '交易', 'P0', '订单状态变更主题'),
    N('k-pay', 'pay.events', 'queue', '支付', 'P0', '支付结果主题'),
    N('k-inv', 'inv.events', 'queue', '履约', 'P1', '库存变更主题'),
    N('k-mkt', 'mkt.events', 'queue', '营销', 'P2', '营销活动与发券主题'),
    // 外部依赖
    N('ext-wxpay', '微信支付', 'external', '支付', 'P0', '外部收单渠道'),
    N('ext-alipay', '支付宝', 'external', '支付', 'P0', '外部收单渠道'),
    N('ext-sms', '三方短信通道', 'external', '基础设施', 'P2', '验证码与通知下行'),
    N('ext-sf', '顺丰开放平台', 'external', '履约', 'P1', '快递下单与轨迹回传'),
    N('ext-tax', '税务开票平台', 'external', '支付', 'P2', '电子发票开具通道')
  ];

  // [依赖方, 被依赖方, kind]
  var rawEdges = [
    // 入口 → 网关；网关 → 核心路由
    ['web', 'gw', 'call'],
    ['app', 'gw', 'call'],
    ['gw', 'auth', 'call'],
    ['gw', 'order', 'call'],
    ['gw', 'product', 'call'],
    ['gw', 'search', 'call'],
    ['gw', 'cart', 'call'],
    ['gw', 'pay', 'call'],
    // 购物车
    ['cart', 'redis-cart', 'data'],
    ['cart', 'product', 'call'],
    ['cart', 'price', 'call'],
    // 订单
    ['order', 'db-order', 'data'],
    ['order', 'product', 'call'],
    ['order', 'inv', 'call'],
    ['order', 'price', 'call'],
    ['order', 'promo', 'call'],
    ['order', 'coupon', 'call'],
    ['order', 'risk', 'call'],
    ['order', 'user', 'call'],
    ['order', 'pay', 'call'],
    ['order', 'k-order', 'pub'],
    // 支付
    ['pay', 'db-pay', 'data'],
    ['pay', 'ext-wxpay', 'call'],
    ['pay', 'ext-alipay', 'call'],
    ['pay', 'risk', 'call'],
    ['pay', 'k-pay', 'pub'],
    ['refund', 'pay', 'call'],
    ['refund', 'db-pay', 'data'],
    ['refund', 'k-pay', 'pub'],
    ['settle', 'db-pay', 'data'],
    ['settle', 'ledger', 'call'],
    ['settle', 'k-pay', 'sub'],
    ['settle', 'k-order', 'sub'],
    ['ledger', 'db-pay', 'data'],
    ['invoice', 'settle', 'call'],
    ['invoice', 'ext-tax', 'call'],
    // 库存与履约
    ['inv', 'redis-inv', 'data'],
    ['inv', 'product', 'call'],
    ['inv', 'k-inv', 'pub'],
    ['logi', 'ext-sf', 'call'],
    ['logi', 'wms', 'call'],
    ['logi', 'k-order', 'sub'],
    ['wms', 'k-inv', 'pub'],
    // 触达
    ['notify', 'ext-sms', 'call'],
    ['notify', 'k-pay', 'sub'],
    ['notify', 'k-mkt', 'sub'],
    // 商品 / 搜索 / 推荐
    ['product', 'db-product', 'data'],
    ['search', 'es-item', 'data'],
    ['search', 'product', 'call'],
    ['rec', 'db-user', 'data'],
    ['rec', 'product', 'call'],
    ['rec', 'dw-ads', 'data'],
    ['rec', 'k-mkt', 'sub'],
    // 营销
    ['promo', 'product', 'call'],
    ['coupon', 'promo', 'call'],
    ['coupon', 'k-mkt', 'pub'],
    // 风控 / 用户 / 认证
    ['risk', 'db-user', 'data'],
    ['risk', 'k-order', 'sub'],
    ['auth', 'db-user', 'data'],
    ['user', 'db-user', 'data'],
    // 数据链路
    ['sync', 'db-order', 'data'],
    ['sync', 'db-product', 'data'],
    ['sync', 'dw-dwd', 'data'],
    ['sync', 'k-inv', 'sub'],
    ['etl', 'dw-dwd', 'data'],
    ['etl', 'dw-ads', 'data'],
    ['etl', 'k-order', 'sub'],
    ['bi', 'dw-ads', 'data']
  ];

  var edges = rawEdges.map(function (e) {
    return { s: e[0], t: e[1], kind: e[2] };
  });

  return { nodes: nodes, edges: edges };
})();
