/* 星链 · 依赖全景 — 内联数据集：某电商数据平台的依赖网络
 * 方向语义：边 A→B 表示「A 依赖 B」（A 消费/读取/派生自 B）
 * 因此：沿箭头方向 = 跟随上游依赖；逆箭头方向 = 跟随下游影响 */
window.RW_DATA = {
  nodes: [
    /* 数据源 layer 5 */
    { id: "src_orders",  name: "订单主库",       type: "source", layer: 5, status: "ok",   owner: "交易研发",   desc: "交易核心 MySQL，订单主表与明细表的 binlog 源" },
    { id: "src_pay",     name: "支付流水库",     type: "source", layer: 5, status: "ok",   owner: "交易研发",   desc: "支付回调与对账流水" },
    { id: "src_events",  name: "用户行为埋点流", type: "source", layer: 5, status: "warn", owner: "增长工程",   desc: "客户端/服务端埋点事件流（当前丢失率 2.1%↑）" },
    { id: "src_sku",     name: "商品主档",       type: "source", layer: 5, status: "ok",   owner: "商品中台",   desc: "SPU/SKU、类目与价格主数据" },
    { id: "src_crm",     name: "CRM 客户档案",   type: "source", layer: 5, status: "ok",   owner: "会员研发",   desc: "客户注册信息与会员标签" },

    /* 数据仓库 layer 3 */
    { id: "dwd_orders",  name: "dwd_orders 订单明细", type: "store", layer: 3, status: "ok", owner: "平台数据组", desc: "清洗合并后的订单明细表（T+1）" },
    { id: "dim_sku",     name: "dim_sku 商品维表",   type: "store", layer: 3, status: "ok", owner: "平台数据组", desc: "商品维度表，全量+增量同步" },
    { id: "dwd_events",  name: "dwd_events 行为明细", type: "store", layer: 3, status: "ok", owner: "平台数据组", desc: "埋点清洗后的行为明细表" },
    { id: "dws_trade",   name: "dws_trade 交易日汇总", type: "store", layer: 3, status: "ok", owner: "平台数据组", desc: "按日聚合的交易宽表（GMV/买家数/单量）" },
    { id: "dws_user",    name: "dws_user 用户日汇总", type: "store", layer: 3, status: "ok", owner: "平台数据组", desc: "按人按日聚合的活跃与行为汇总表" },

    /* 管道作业 layer 4 */
    { id: "etl_clean",   name: "埋点清洗作业",     type: "job", layer: 4, status: "ok",   owner: "平台数据组", desc: "埋点去重/补全/逐出，产出 dwd_events" },
    { id: "flink_rt",    name: "实时聚合作业",     type: "job", layer: 4, status: "warn", owner: "实时计算组", desc: "Flink 分分钟交易聚合（当前消费延迟 4.2s）" },

    /* 在线服务 layer 2 */
    { id: "svc_order",   name: "订单服务",   type: "service", layer: 2, status: "ok", owner: "交易研发", desc: "下单/查单核心链路服务" },
    { id: "svc_search",  name: "搜索服务",   type: "service", layer: 2, status: "ok", owner: "搜索团队", desc: "商品检索与类目导航" },
    { id: "svc_rec",     name: "推荐服务",   type: "service", layer: 2, status: "ok", owner: "算法组",   desc: "首页/商详推荐，离线+实时双特征" },

    /* 指标 layer 1 */
    { id: "m_gmv",  name: "指标 GMV 成交额", type: "metric", layer: 1, status: "ok", owner: "增长分析", desc: "双口径：T+1 权威口径 + 实时口径" },
    { id: "m_dau",  name: "指标 DAU 活跃数", type: "metric", layer: 1, status: "ok", owner: "增长分析", desc: "按日去重活跃用户数" },
    { id: "m_cvr",  name: "指标 支付转化率", type: "metric", layer: 1, status: "ok", owner: "增长分析", desc: "下单人数 / 成交口径分母" },
    { id: "m_aov",  name: "指标 客单价",     type: "metric", layer: 1, status: "ok", owner: "增长分析", desc: "GMV / 买家数（派生指标）" },

    /* 应用消费 layer 0 */
    { id: "bi_trade",  name: "经营分析看板",     type: "app", layer: 0, status: "ok", owner: "经营分析组", desc: "管理层每日经营复盘看板" },
    { id: "bi_growth", name: "用户增长看板",     type: "app", layer: 0, status: "ok", owner: "增长分析",   desc: "拉新/活跃/转化跟踪看板" },
    { id: "rt_screen", name: "双11 实时大屏",    type: "app", layer: 0, status: "ok", owner: "实时计算组", desc: "大促实时作战分时大屏" },
    { id: "alert_cvr", name: "转化率异动告警",   type: "app", layer: 0, status: "ok", owner: "数据质量组", desc: "CVR 同环比异动监控告警" },
    { id: "ml_ctr",    name: "CTR 排序模型训练", type: "app", layer: 0, status: "ok", owner: "算法组",     desc: "搜索/推荐排序模型的离线训练任务" }
  ],

  edges: [
    { from: "dwd_orders", to: "src_orders", type: "data",   critical: true,  label: "binlog 实时同步" },
    { from: "dwd_orders", to: "src_pay",    type: "data",   critical: false, label: "关联合并支付回调" },
    { from: "dim_sku",    to: "src_sku",    type: "data",   critical: true,  label: "全量+增量同步" },
    { from: "dwd_events", to: "etl_clean",  type: "write",  critical: true,  label: "清洗作业产出写入" },
    { from: "etl_clean",  to: "src_events", type: "data",   critical: true,  label: "消费埋点事件流" },
    { from: "dws_trade",  to: "dwd_orders", type: "data",   critical: true,  label: "按日聚合订单明细" },
    { from: "dws_trade",  to: "dim_sku",    type: "data",   critical: false, label: "补全商品维度" },
    { from: "dws_user",   to: "dwd_events", type: "data",   critical: true,  label: "按人按日聚合" },
    { from: "dws_user",   to: "src_crm",    type: "data",   critical: false, label: "合并客户档案标签" },
    { from: "flink_rt",   to: "src_orders", type: "data",   critical: true,  label: "监听订单 CDC 流" },
    { from: "flink_rt",   to: "src_pay",    type: "data",   critical: false, label: "实时关联回调事件" },
    { from: "svc_order",  to: "src_orders", type: "call",   critical: true,  label: "读写订单库" },
    { from: "svc_search", to: "src_sku",    type: "call",   critical: false, label: "主档/类目查询" },
    { from: "svc_rec",    to: "dws_user",   type: "call",   critical: true,  label: "离线用户特征" },
    { from: "svc_rec",    to: "flink_rt",   type: "call",   critical: true,  label: "实时行为特征" },
    { from: "m_gmv",      to: "dws_trade",  type: "derive", critical: true,  label: "T+1 权威口径" },
    { from: "m_gmv",      to: "flink_rt",   type: "derive", critical: true,  label: "实时口径" },
    { from: "m_dau",      to: "dws_user",   type: "derive", critical: true,  label: "去重活跃计数" },
    { from: "m_cvr",      to: "dws_user",   type: "derive", critical: true,  label: "分子：下单人数" },
    { from: "m_cvr",      to: "dws_trade",  type: "derive", critical: true,  label: "分母：成交口径" },
    { from: "m_aov",      to: "dws_trade",  type: "derive", critical: false, label: "客单价 = GMV/买家数" },
    { from: "bi_trade",   to: "m_gmv",      type: "data",   critical: true,  label: "核心指标卡" },
    { from: "bi_trade",   to: "m_aov",      type: "data",   critical: false, label: "客单价趋势" },
    { from: "bi_trade",   to: "m_cvr",      type: "data",   critical: false, label: "转化漏斗" },
    { from: "bi_growth",  to: "m_dau",      type: "data",   critical: true,  label: "活跃趋势" },
    { from: "bi_growth",  to: "m_cvr",      type: "data",   critical: false, label: "留存转化" },
    { from: "rt_screen",  to: "flink_rt",   type: "data",   critical: true,  label: "分时曲线" },
    { from: "rt_screen",  to: "m_gmv",      type: "data",   critical: true,  label: "实时 GMV 大数" },
    { from: "alert_cvr",  to: "m_cvr",      type: "data",   critical: true,  label: "同环比异动检测" },
    { from: "alert_cvr",  to: "m_dau",      type: "data",   critical: false, label: "基数波动校验" },
    { from: "ml_ctr",     to: "dwd_events", type: "data",   critical: false, label: "样本行为序列" },
    { from: "ml_ctr",     to: "dws_user",   type: "data",   critical: false, label: "用户侧特征" },
    { from: "ml_ctr",     to: "dws_trade",  type: "data",   critical: false, label: "成交标签" }
  ]
};
