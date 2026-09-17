/* AssetGrid — 内联种子数据：页面加载即就绪，无任何网络请求 */
(function () {
  var STATUS_META = {
    active:  { label: '运行中', cls: 'ok' },
    maint:   { label: '维护中', cls: 'warn' },
    paused:  { label: '已停用', cls: 'mute' },
    retired: { label: '已报废', cls: 'bad' }
  };
  var STATUS_ORDER = ['active', 'maint', 'paused', 'retired'];
  var DEFAULT_STATUS = 'active'; // 自身与各级分组均无设定时的系统默认生效状态

  /* 分组树：大区 › 城市 › 门店；policy = 分组状态策略，向子孙无自身状态的设备级联 */
  var GROUPS = [
    { id: 'east',  name: '华东大区', parent: null },
    { id: 'sh',    name: '上海',     parent: 'east' },
    { id: 'sh-ja', name: '静安门店', parent: 'sh' },
    { id: 'sh-pd', name: '浦东门店', parent: 'sh', policy: 'maint',  policyNote: '门店改造施工中' },
    { id: 'hz',    name: '杭州',     parent: 'east' },
    { id: 'hz-xh', name: '西湖门店', parent: 'hz' },
    { id: 'hz-bj', name: '滨江门店', parent: 'hz', policy: 'paused', policyNote: '筹备开业' },
    { id: 'north', name: '华北大区', parent: null },
    { id: 'bj',    name: '北京',     parent: 'north' },
    { id: 'bj-cy', name: '朝阳门店', parent: 'bj' },
    { id: 'bj-hd', name: '海淀门店', parent: 'bj' },
    { id: 'tj',    name: '天津',     parent: 'north', policy: 'paused', policyNote: '区域盘点临时停业' },
    { id: 'tj-hp', name: '和平门店', parent: 'tj' },
    { id: 'south', name: '华南大区', parent: null },
    { id: 'sz',    name: '深圳',     parent: 'south' },
    { id: 'sz-ns', name: '南山门店', parent: 'sz' },
    { id: 'sz-ft', name: '福田门店', parent: 'sz', policy: 'maint',  policyNote: '设备年度检修' }
  ];

  var OWNERS = ['张伟', '李娜', '王强', '陈静', '刘洋', '赵磊', '孙悦', '周敏', '郑浩', '吴迪'];

  var TYPES = {
    pos:     { name: '收银POS',    model: 'X-200',   tags: ['营收关键'] },
    cooler:  { name: '立式冷柜',   model: 'LC-350',  tags: ['温控'] },
    screen:  { name: '门口广告屏', model: 'AD-55',   tags: ['夜间运行'] },
    router:  { name: '门店路由',   model: 'RT-AX54', tags: [] },
    printer: { name: '小票打印机', model: 'TP-80',   tags: [] },
    ac:      { name: '中央空调',   model: 'AC-3P',   tags: [] },
    cam:     { name: '监控摄像头', model: 'CAM-2K',  tags: ['安防'] },
    esl:     { name: '价签网关',   model: 'ESL-GW',  tags: [] }
  };

  /* 每家门店的设备清单；own = 自身状态覆盖（下标→状态），locked = 受保护设备下标 */
  var STORES = [
    { group: 'sh-ja', short: '静安', devices: ['pos','pos','cooler','screen','router','printer','cam'], locked: [0], own: { 5: 'maint' } },
    { group: 'sh-pd', short: '浦东', devices: ['pos','cooler','screen','router','cam','esl'], own: { 2: 'retired' } },
    { group: 'hz-xh', short: '西湖', devices: ['pos','pos','cooler','ac','router','printer','cam','esl'], own: { 3: 'maint' } },
    { group: 'hz-bj', short: '滨江', devices: ['pos','cooler','screen','router','esl'] },
    { group: 'bj-cy', short: '朝阳', devices: ['pos','pos','cooler','screen','router','printer','cam','ac'], locked: [6], own: { 7: 'paused' } },
    { group: 'bj-hd', short: '海淀', devices: ['pos','cooler','screen','router','cam'], own: { 2: 'paused' } },
    { group: 'tj-hp', short: '和平', devices: ['pos','cooler','screen','router','printer','esl'], own: { 0: 'active', 1: 'active' } },
    { group: 'sz-ns', short: '南山', devices: ['pos','pos','cooler','screen','router','printer','cam','ac'], locked: [4], own: { 5: 'maint' } },
    { group: 'sz-ft', short: '福田', devices: ['pos','cooler','screen','router','cam','esl'], own: { 0: 'paused' } }
  ];

  var seq = 1001;
  var ENTITIES = [];
  STORES.forEach(function (st) {
    var cnt = {};
    st.devices.forEach(function (t, i) {
      cnt[t] = (cnt[t] || 0) + 1;
      var ty = TYPES[t];
      var tags = ty.tags.slice();
      if (i % 4 === 3) tags.push('待巡检');
      ENTITIES.push({
        id: 'DEV-' + (seq++),
        name: st.short + '·' + ty.name + '-' + (cnt[t] < 10 ? '0' + cnt[t] : cnt[t]),
        type: ty.name,
        model: ty.model,
        groupId: st.group,
        owner: OWNERS[seq % OWNERS.length],
        ownStatus: (st.own && st.own[i]) || null,
        tags: tags,
        locked: !!(st.locked && st.locked.indexOf(i) >= 0)
      });
    });
  });

  window.DATA = {
    STATUS_META: STATUS_META,
    STATUS_ORDER: STATUS_ORDER,
    DEFAULT_STATUS: DEFAULT_STATUS,
    GROUPS: GROUPS,
    ENTITIES: ENTITIES
  };
})();
