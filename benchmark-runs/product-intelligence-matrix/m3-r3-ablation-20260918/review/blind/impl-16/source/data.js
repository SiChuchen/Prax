/* 脉络 · 依赖关系网 —— 初始数据（随首屏内联，无任何网络请求）
 * 方向约定：边的 from → to 表示「from 依赖 to」（from 调用/订阅/读写 to）。
 * 因此「to 出故障」时，沿 in 边反向传播即为影响面（blast radius）。
 */
"use strict";

const LANES = [
  { id: "entry", name: "客户端入口", x: 60,   accent: "#8fb8f0" },
  { id: "edge",  name: "接入层",     x: 350,  accent: "#5f9fe9" },
  { id: "biz",   name: "业务服务",   x: 645,  accent: "#3f8ce0" },
  { id: "plat",  name: "平台支撑",   x: 955,  accent: "#2f6fb8" },
  { id: "data",  name: "数据与基础设施", x: 1255, accent: "#9085e9" },
  { id: "ext",   name: "外部服务",   x: 1550, accent: "#d55181" },
];

const NODES = [
  // ── 客户端入口 ──────────────────────────────────────────
  { id: "web",   name: "Web 商城",     lane: "entry", team: "前端平台组", x: 60, y: 150,  desc: "浏览器端电商主站，所有买家流量的主入口" },
  { id: "app",   name: "App 客户端",   lane: "entry", team: "前端平台组", x: 60, y: 300,  desc: "iOS / Android 原生应用，承载约 70% 的成交流量" },
  { id: "mini",  name: "小程序",       lane: "entry", team: "前端平台组", x: 60, y: 450,  desc: "微信生态轻量入口，拉新与裂变活动的主阵地" },
  { id: "open",  name: "开放平台",     lane: "entry", team: "基础平台组", x: 60, y: 620,  desc: "面向第三方开发者的 OpenAPI 与应用市场" },

  // ── 接入层 ─────────────────────────────────────────────
  { id: "gateway", name: "API 网关",    lane: "edge", team: "基础平台组", x: 350, y: 220, desc: "统一入口：路由、限流、鉴权与灰度分流" },
  { id: "bff",     name: "BFF 聚合层",  lane: "edge", team: "交易平台组", x: 350, y: 410, desc: "面向页面场景的接口聚合与字段裁剪" },
  { id: "webhook", name: "Webhook 接入", lane: "edge", team: "基础平台组", x: 350, y: 640, desc: "接收外部系统异步回调，转发为内部事件" },

  // ── 业务服务 ───────────────────────────────────────────
  { id: "product",   name: "商品中心",  lane: "biz", team: "商品团队",   x: 645, y: 85,  desc: "商品类目、详情、价格与上下架状态" },
  { id: "search",    name: "搜索服务",  lane: "biz", team: "商品团队",   x: 645, y: 185, desc: "商品全文检索、联想词与排序" },
  { id: "rec",       name: "推荐服务",  lane: "biz", team: "数据团队",   x: 645, y: 285, desc: "个性化推荐：猜你喜欢、相似商品" },
  { id: "cart",      name: "购物车",    lane: "biz", team: "交易平台组", x: 645, y: 390, desc: "加购、多端合并与结算清单管理" },
  { id: "order",     name: "订单服务",  lane: "biz", team: "交易平台组", x: 645, y: 500, desc: "交易主流程：下单、履约与状态机管理" },
  { id: "pay",       name: "支付服务",  lane: "biz", team: "交易平台组", x: 645, y: 615, desc: "收银台、支付渠道路由与对账" },
  { id: "inventory", name: "库存服务",  lane: "biz", team: "交易平台组", x: 645, y: 720, desc: "库存扣减、预占与回补，防超卖" },
  { id: "promo",     name: "营销服务",  lane: "biz", team: "用户增长组", x: 645, y: 820, desc: "优惠券、满减活动与核销" },
  { id: "user",      name: "用户中心",  lane: "biz", team: "用户增长组", x: 645, y: 915, desc: "账号、资料、会员等级与收货地址" },

  // ── 平台支撑 ───────────────────────────────────────────
  { id: "auth",      name: "认证中心",  lane: "plat", team: "安全组",     x: 955, y: 100, desc: "登录态签发、OAuth 与权限校验" },
  { id: "mq",        name: "消息总线",  lane: "plat", team: "基础平台组", x: 955, y: 260, desc: "Kafka 集群，业务事件发布订阅的主干" },
  { id: "idgen",     name: "发号器",    lane: "plat", team: "基础平台组", x: 955, y: 420, desc: "全局唯一 ID 发放：订单号、凭证号" },
  { id: "notify",    name: "通知中心",  lane: "plat", team: "基础平台组", x: 955, y: 545, desc: "站内信、Push、短信、邮件多通道触达" },
  { id: "risk",      name: "风控引擎",  lane: "plat", team: "安全组",     x: 955, y: 660, desc: "实时反作弊与交易风险评分" },
  { id: "file",      name: "文件服务",  lane: "plat", team: "基础平台组", x: 955, y: 775, desc: "上传中转、图片压缩与 CDN 预热" },
  { id: "scheduler", name: "任务调度",  lane: "plat", team: "基础平台组", x: 955, y: 880, desc: "分布式定时任务与批处理编排" },

  // ── 数据与基础设施 ─────────────────────────────────────
  { id: "redis",   name: "Redis 缓存",    lane: "data", team: "DBA 组",   x: 1255, y: 130, desc: "热点缓存、分布式锁与会话存储" },
  { id: "mysql",   name: "MySQL 集群",    lane: "data", team: "DBA 组",   x: 1255, y: 280, desc: "核心交易库：分库分表 + 一主两从" },
  { id: "es",      name: "Elasticsearch", lane: "data", team: "数据团队", x: 1255, y: 430, desc: "商品索引集群与日志检索" },
  { id: "oss",     name: "对象存储",      lane: "data", team: "基础平台组", x: 1255, y: 570, desc: "图片、附件与静态资源的冷存储" },
  { id: "dw",      name: "数据仓库",      lane: "data", team: "数据团队", x: 1255, y: 720, desc: "T+1 离线数仓与用户画像标签" },
  { id: "monitor", name: "监控告警",      lane: "data", team: "基础平台组", x: 1255, y: 860, desc: "指标采集、告警路由与值班升级" },

  // ── 外部服务 ───────────────────────────────────────────
  { id: "wxpay",     name: "微信支付",  lane: "ext", team: "外部服务商", x: 1550, y: 300, desc: "外部支付渠道：小程序与 App 支付" },
  { id: "alipay",    name: "支付宝",    lane: "ext", team: "外部服务商", x: 1550, y: 440, desc: "外部支付渠道：PC 与 App 支付" },
  { id: "sms",       name: "短信通道",  lane: "ext", team: "外部服务商", x: 1550, y: 640, desc: "第三方短信服务商：验证码与通知" },
  { id: "logistics", name: "物流平台",  lane: "ext", team: "外部服务商", x: 1550, y: 800, desc: "外部物流：运单创建与轨迹回传" },
];

/* type: call=同步调用（蓝实线） / event=事件·异步（橙虚线） / data=数据读写（绿细线）
 * crit: P0=核心 / P1=重要 / P2=一般                                              */
const EDGES = [
  // 客户端 → 接入层
  { f: "web",   t: "gateway", type: "call",  proto: "HTTPS", crit: "P0", label: "页面接口",     desc: "所有页面请求经网关路由与限流" },
  { f: "app",   t: "gateway", type: "call",  proto: "HTTPS", crit: "P0", label: "页面接口",     desc: "App 原生接口请求入口" },
  { f: "mini",  t: "gateway", type: "call",  proto: "HTTPS", crit: "P0", label: "页面接口",     desc: "小程序接口请求入口" },
  { f: "open",  t: "gateway", type: "call",  proto: "HTTPS", crit: "P1", label: "OpenAPI 调用", desc: "第三方开发者流量与内部流量隔离限流" },
  { f: "web",   t: "bff",     type: "call",  proto: "HTTPS", crit: "P0", label: "首页聚合",     desc: "首页一次请求聚合商品、推荐、购物车" },
  { f: "app",   t: "bff",     type: "call",  proto: "HTTPS", crit: "P0", label: "首页聚合",     desc: "App 首页聚合接口" },
  { f: "mini",  t: "bff",     type: "call",  proto: "HTTPS", crit: "P0", label: "首页聚合",     desc: "小程序首页聚合接口" },

  // 接入层 → 业务
  { f: "gateway", t: "bff",     type: "call", proto: "gRPC", crit: "P1", label: "透传路由",   desc: "未命中缓存的聚合请求透传给 BFF" },
  { f: "gateway", t: "user",    type: "call", proto: "gRPC", crit: "P0", label: "登录注册路由", desc: "登录、注册与账号接口路由" },
  { f: "gateway", t: "product", type: "call", proto: "gRPC", crit: "P0", label: "商品路由",   desc: "商品详情与列表接口路由" },
  { f: "gateway", t: "order",   type: "call", proto: "gRPC", crit: "P0", label: "交易路由",   desc: "下单、查单与售后接口路由" },
  { f: "bff",     t: "product", type: "call", proto: "gRPC", crit: "P0", label: "商品卡片",   desc: "首页商品卡片的详情与价格" },
  { f: "bff",     t: "rec",     type: "call", proto: "gRPC", crit: "P1", label: "推荐位",     desc: "首页推荐位候选商品" },
  { f: "bff",     t: "cart",    type: "call", proto: "gRPC", crit: "P0", label: "购物车浮层", desc: "角标数量与购物车浮层内容" },
  { f: "open",    t: "auth",    type: "call", proto: "HTTPS", crit: "P1", label: "应用鉴权",  desc: "第三方应用的 AppSecret 与令牌校验" },

  // 业务内部
  { f: "cart",      t: "product",  type: "call",  proto: "gRPC",  crit: "P1", label: "加购价格校验", desc: "加购时校验商品状态与最新价格" },
  { f: "cart",      t: "promo",    type: "call",  proto: "gRPC",  crit: "P2", label: "优惠试算",     desc: "结算前试算可用优惠券与满减" },
  { f: "order",     t: "cart",     type: "call",  proto: "gRPC",  crit: "P1", label: "结算清车",     desc: "下单成功后移除已结算条目" },
  { f: "order",     t: "inventory", type: "call", proto: "gRPC",  crit: "P0", label: "锁定库存",     desc: "下单同步预占库存，防超卖关键路径" },
  { f: "order",     t: "promo",    type: "call",  proto: "gRPC",  crit: "P1", label: "核销优惠券",   desc: "下单同步核销，失败则整个下单回滚" },
  { f: "order",     t: "pay",      type: "call",  proto: "HTTP",  crit: "P0", label: "发起支付",     desc: "创建支付单并跳转收银台" },
  { f: "order",     t: "idgen",    type: "call",  proto: "gRPC",  crit: "P1", label: "取订单号",     desc: "发号器分配全局唯一订单号" },
  { f: "order",     t: "risk",     type: "call",  proto: "gRPC",  crit: "P0", label: "下单风险评分", desc: "同步风控评分，命中规则直接拦截" },
  { f: "order",     t: "mq",       type: "event", proto: "Kafka", crit: "P0", label: "发布「订单已创建」", desc: "下游通知、积分、仓储均依赖此事件" },
  { f: "order",     t: "logistics", type: "call", proto: "HTTPS", crit: "P1", label: "创建运单",     desc: "支付完成后向物流平台创建运单" },
  { f: "pay",       t: "wxpay",    type: "call",  proto: "HTTPS", crit: "P0", label: "统一下单",     desc: "微信支付渠道下单与支付结果查询" },
  { f: "pay",       t: "alipay",   type: "call",  proto: "HTTPS", crit: "P0", label: "统一下单",     desc: "支付宝渠道下单与支付结果查询" },
  { f: "pay",       t: "mq",       type: "event", proto: "Kafka", crit: "P0", label: "发布「支付结果」", desc: "订单状态机消费该事件推进履约" },
  { f: "search",    t: "product",  type: "call",  proto: "gRPC",  crit: "P1", label: "结果补全",     desc: "对索引命中的 SKU 回查上架状态与价格" },
  { f: "search",    t: "es",       type: "data",  proto: "HTTP",  crit: "P0", label: "查询索引",     desc: "全文检索查询商品索引集群" },
  { f: "rec",       t: "product",  type: "call",  proto: "gRPC",  crit: "P1", label: "候选详情",     desc: "候选商品的可购状态与价格校验" },
  { f: "rec",       t: "dw",       type: "data",  proto: "SQL",   crit: "P1", label: "读取画像",     desc: "查询用户画像标签与行为序列" },
  { f: "rec",       t: "redis",    type: "data",  proto: "RESP",  crit: "P1", label: "特征缓存",     desc: "用户特征向量的在线缓存" },
  { f: "user",      t: "auth",     type: "call",  proto: "gRPC",  crit: "P0", label: "密码校验",     desc: "登录时委托认证中心做凭证校验" },
  { f: "user",      t: "mysql",    type: "data",  proto: "SQL",   crit: "P0", label: "资料读写",     desc: "用户主数据的持久化" },
  { f: "user",      t: "redis",    type: "data",  proto: "RESP",  crit: "P1", label: "资料缓存",     desc: "热点用户资料与会话缓存" },
  { f: "product",   t: "mysql",    type: "data",  proto: "SQL",   crit: "P0", label: "商品库读写",   desc: "商品主数据持久化" },
  { f: "product",   t: "es",       type: "data",  proto: "HTTP",  crit: "P1", label: "同步索引",     desc: "商品变更准实时写入搜索索引" },
  { f: "product",   t: "redis",    type: "data",  proto: "RESP",  crit: "P1", label: "详情缓存",     desc: "热门商品详情页缓存" },
  { f: "product",   t: "file",     type: "call",  proto: "gRPC",  crit: "P1", label: "图片上传",     desc: "商品主图与详情图上传中转" },
  { f: "promo",     t: "mysql",    type: "data",  proto: "SQL",   crit: "P1", label: "券库存读写",   desc: "优惠券模板与核销记录持久化" },
  { f: "promo",     t: "redis",    type: "data",  proto: "RESP",  crit: "P1", label: "券缓存",       desc: "活动高峰期的券库存预热缓存" },
  { f: "inventory", t: "redis",    type: "data",  proto: "RESP",  crit: "P0", label: "预占锁",       desc: "Redis 原子扣减做库存预占" },
  { f: "inventory", t: "mysql",    type: "data",  proto: "SQL",   crit: "P0", label: "扣减流水",     desc: "库存流水与对账数据持久化" },

  // 平台支撑
  { f: "auth",      t: "mysql",  type: "data",  proto: "SQL",   crit: "P0", label: "账号库",       desc: "凭证与权限数据持久化" },
  { f: "auth",      t: "redis",  type: "data",  proto: "RESP",  crit: "P0", label: "会话存储",     desc: "登录态 Token 的分布式存储" },
  { f: "auth",      t: "notify", type: "call",  proto: "gRPC",  crit: "P2", label: "验证码下发",   desc: "短信验证码经通知中心触达" },
  { f: "notify",    t: "sms",    type: "call",  proto: "HTTPS", crit: "P1", label: "通道触达",     desc: "第三方短信通道路由与重试" },
  { f: "notify",    t: "mq",     type: "event", proto: "Kafka", crit: "P1", label: "订阅业务事件", desc: "消费订单/支付事件转站内信与 Push" },
  { f: "risk",      t: "mq",     type: "event", proto: "Kafka", crit: "P1", label: "订阅交易事件", desc: "消费交易事件更新设备与账号画像" },
  { f: "file",      t: "oss",    type: "data",  proto: "S3",    crit: "P1", label: "对象写入",     desc: "压缩后的图片写入对象存储" },
  { f: "scheduler", t: "order",  type: "call",  proto: "gRPC",  crit: "P2", label: "超时关单",     desc: "批处理扫描超时未支付订单关单" },
  { f: "scheduler", t: "dw",     type: "data",  proto: "SQL",   crit: "P2", label: "驱动 ETL",     desc: "调度离线数仓的每日构建任务" },
  { f: "webhook",   t: "order",  type: "event", proto: "HTTP",  crit: "P1", label: "售后回调",     desc: "物流异常回调转内部事件推进售后" },

  // 外部 → 内部（回调）
  { f: "logistics", t: "webhook", type: "event", proto: "HTTPS", crit: "P1", label: "轨迹回调",     desc: "物流轨迹变化回调 Webhook 接入" },

  // 数据与基础设施
  { f: "dw",        t: "mq",     type: "event", proto: "Kafka", crit: "P2", label: "订阅全量事件", desc: "数仓订阅业务事件做离线入仓" },
  { f: "monitor",   t: "mq",     type: "event", proto: "Kafka", crit: "P1", label: "指标接入",     desc: "消费埋点与运行时指标流" },
  { f: "monitor",   t: "notify", type: "call",  proto: "gRPC",  crit: "P0", label: "告警触达",     desc: "P0 告警升级电话与短信值班" },
];

/* 元信息：关于本工具的说明（概览卡片展示） */
const META = {
  title: "星舟电商 · 核心链路关系网",
  note: "示例系统：33 个节点、58 条关系。方向 = 依赖方向（A → B 表示 A 依赖 B）。",
};
