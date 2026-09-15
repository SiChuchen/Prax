/* cell-j01-s01 实体目录管理台 — 种子数据
 * 确定性生成（固定种子），随首屏内联就绪；无任何网络请求、无外部依赖。 */
(function () {
  'use strict';

  // ---- 确定性伪随机（LCG）----
  var seed = 20260908;
  function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
  function ri(n) { return Math.floor(rnd() * n); }
  function pick(a) { return a[ri(a.length)]; }

  // ---- 状态字典（全应用唯一状态来源）----
  var STATUSES = [
    { id: 'active',      label: '在用',   tone: 'ok' },
    { id: 'pending',     label: '待分配', tone: 'info' },
    { id: 'maintenance', label: '维修中', tone: 'warn' },
    { id: 'disabled',    label: '已停用', tone: 'muted' },
    { id: 'retired',     label: '已退役', tone: 'danger' }
  ];
  // 加权分布：在用为主，保证各状态均有样本
  var STATUS_POOL = [
    'active', 'active', 'active', 'active', 'active', 'active',
    'pending', 'pending',
    'maintenance', 'maintenance',
    'disabled', 'disabled',
    'retired'
  ];

  var OWNERS = ['陈晓雨', '李昊然', '王静怡', '张启明', '刘一诺', '赵文博', '孙嘉禾', '周慕云'];
  var TAGS = ['核心', '待巡检', '年检到期', '外借', '高耗能', '新入库', '封存'];
  var NOTES = ['按季度巡检', '等待备件', '纳入本轮盘点', '租用设备', '性能达标', '计划更换', '保修期内', '无特殊备注'];

  // ---- 层级：域 → 类别 → 子类别（叶子挂实体）----
  var TREE = [
    { id: 'd1', name: '研发中心', children: [
      { id: 'c1', name: '应用研发', children: [
        { id: 'c11', name: '前端平台' }, { id: 'c12', name: '服务端' }, { id: 'c13', name: '移动端' }
      ]},
      { id: 'c2', name: '质量与测试', children: [
        { id: 'c14', name: '自动化测试' }, { id: 'c15', name: '设备实验室' }
      ]}
    ]},
    { id: 'd2', name: '生产运营', children: [
      { id: 'c3', name: '产线设备', children: [
        { id: 'c21', name: '装配线' }, { id: 'c22', name: '包装线' }
      ]},
      { id: 'c4', name: '仓储物流', children: [
        { id: 'c23', name: '立库堆垛' }, { id: 'c24', name: 'AGV 运输' }
      ]}
    ]},
    { id: 'd3', name: '数据平台', children: [
      { id: 'c5', name: '计算资源', children: [
        { id: 'c31', name: 'GPU 集群' }, { id: 'c32', name: '通用算力' }
      ]},
      { id: 'c6', name: '存储与备份', children: [
        { id: 'c33', name: '对象存储' }, { id: 'c34', name: '磁带库' }
      ]}
    ]},
    { id: 'd4', name: '基础设施', children: [
      { id: 'c7', name: '网络', children: [
        { id: 'c41', name: '核心交换' }, { id: 'c42', name: '接入层' }
      ]},
      { id: 'c8', name: '机房设施', children: [
        { id: 'c43', name: '供配电' }, { id: 'c44', name: '制冷' }
      ]}
    ]},
    { id: 'd5', name: '职能支持', children: [
      { id: 'c9', name: '办公设备', children: [
        { id: 'c51', name: '工位终端' }, { id: 'c52', name: '会议系统' }
      ]},
      { id: 'c54', name: '公务车辆' }
    ]}
  ];

  // 各叶类别的实体名词表
  var VOCAB = {
    c11: ['构建机', 'UI 自动化终端', '兼容性测试机', '原型评审平板'],
    c12: ['API 网关节点', '业务服务实例', '消息队列节点', '定时任务机'],
    c13: ['iOS 测试机', 'Android 测试机', '真机云终端'],
    c14: ['压测发生器', '回归测试机', '失败重放终端'],
    c15: ['信号发生器', '频谱分析仪', '环境试验箱'],
    c21: ['装配机械臂', '拧紧工作站', '视觉检测台'],
    c22: ['贴标机', '封箱机', '称重复核台'],
    c23: ['堆垛机', '输送分拣段', '托盘读取器'],
    c24: ['搬运 AGV', '充电桩', '调度基站'],
    c31: ['训练服务器', '推理卡节点'],
    c32: ['虚拟化宿主机', '批处理节点'],
    c33: ['存储节点', '纠删码机柜'],
    c34: ['磁带库体', '归档磁带组'],
    c41: ['核心交换机', '出口路由器'],
    c42: ['接入交换机', '无线 AP', '物联网关'],
    c43: ['UPS 主机', '精密配电柜', '柴发机组'],
    c44: ['精密空调', '冷通道天窗'],
    c51: ['办公笔记本', '台式终端', '液晶显示器'],
    c52: ['视频会议终端', '无线投屏器', '会议室中控'],
    c54: ['商务车', '厢式货车']
  };

  // ---- 展平层级 + 生成实体 ----
  var domains = [], categories = [], entities = [];
  var seq = 0;

  TREE.forEach(function (d) {
    domains.push({ id: d.id, name: d.name });
    walk(d, null, d.id, 0);
  });

  function walk(node, parentId, domainId, depth) {
    categories.push({ id: node.id, name: node.name, parentId: parentId, domainId: domainId, depth: depth });
    if (node.children && node.children.length) {
      node.children.forEach(function (ch) { walk(ch, node.id, domainId, depth + 1); });
    } else {
      emitEntities(node.id);
    }
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = '0' + n; return n; }

  function emitEntities(catId) {
    var vocab = VOCAB[catId];
    var count = 8 + ri(6); // 每叶类 8~13 条，总计约 210 条
    for (var i = 0; i < count; i++) {
      seq += 1;
      var tagCount = rnd() < 0.55 ? (rnd() < 0.25 ? 2 : 1) : 0;
      var tags = [];
      while (tags.length < tagCount) {
        var t = pick(TAGS);
        if (tags.indexOf(t) === -1) tags.push(t);
      }
      var month = 6 + ri(4);            // 2026-06 ~ 2026-09
      var day = 1 + ri(28);
      entities.push({
        id: 'ENT-' + pad(seq, 4),
        name: pick(vocab) + ' ' + pad(i + 1, 2),
        categoryId: catId,
        status: pick(STATUS_POOL),
        owner: pick(OWNERS),
        tags: tags,
        note: pick(NOTES),
        updatedAt: '2026-' + pad(month, 2) + '-' + pad(day, 2)
      });
    }
  }

  window.SEED = { statuses: STATUSES, domains: domains, categories: categories, entities: entities };
})();
