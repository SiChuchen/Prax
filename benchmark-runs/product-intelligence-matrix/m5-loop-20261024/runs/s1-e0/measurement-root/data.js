/*
 * PRISM · 深空巡天观测目录 — 内联数据模块
 * 确定性种子生成（mulberry32）：同一 seed 恒定产出同一数据集。
 * 同步执行、随首屏就绪：无 fetch、无加载态。
 */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var SEED = 20260924;
  var rnd = mulberry32(SEED);
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function pickW(entries) { // [[value, weight],...]
    var total = 0, i;
    for (i = 0; i < entries.length; i++) total += entries[i][1];
    var r = rnd() * total;
    for (i = 0; i < entries.length; i++) { r -= entries[i][1]; if (r <= 0) return entries[i][0]; }
    return entries[entries.length - 1][0];
  }
  function rand(a, b) { return a + rnd() * (b - a); }
  function r2(x) { return Math.round(x * 100) / 100; }

  /* ── 维度取值域 ─────────────────────────────── */
  var QUADRANTS = ['北天·第一象限', '北天·第二象限', '南天·第一象限', '南天·第二象限'];
  var CONSTELLATIONS = [
    ['天鹰座', 0], ['天鹅座', 0], ['天琴座', 1], ['仙后座', 1],
    ['牧夫座', 2], ['半人马座', 2], ['船帆座', 3], ['波江座', 3],
    ['蛇夫座', 1], ['猎户座', 0]
  ];
  var METHODS = [['凌星法', 30], ['径向速度法', 22], ['微引力透镜', 10], ['直接成像', 12], ['脉冲星计时法', 8], ['天体测量法', 18]];
  var FACILITIES = [['开普勒空间望远镜', 20], ['TESS', 22], ['韦伯空间望远镜', 16], ['昆仑轨道站', 14], ['南山 2.5m 阵列', 12], ['PAR-40 射电阵', 8], ['天琴干涉仪', 8]];
  var CLASSES = [['岩质行星', 30], ['海洋世界', 18], ['气态巨行星', 24], ['冰巨星', 16], ['双星伴星', 12]];
  var ATMOS = [['水蒸气云', 16], ['甲烷雾霾', 14], ['富氢', 20], ['富碳', 12], ['无大气', 22], ['未确定', 16]];
  var BANDS = [['光学', 30], ['近红外', 28], ['射电', 12], ['X 射线', 12], ['紫外', 18]];
  var TEAMS = [['凤凰计划组', 20], ['昆仑深空组', 18], ['南门二联合队', 17], ['北落师门小组', 15], ['格利泽协作网', 16], ['远望队', 14]];
  var YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  var NOTES = [
    '光谱信噪比良好', '存在二次凌星事件', '视向速度待复核', '疑似与邻近源混淆',
    '多波段测光一致', '轨道解仍在收敛', '恒星星斑活动干扰较强', '候选体编号已归档',
    '凌星深度存在周期性漂移', '背景星等影响已扣除'
  ];

  var COUNT = 960;
  var records = [];

  for (var i = 0; i < COUNT; i++) {
    var cEl = pick(CONSTELLATIONS);
    var co = cEl[0];
    var quadrant = QUADRANTS[cEl[1]];
    var year = pickW(YEARS.map(function (y, k) { return [y, 8 + k * 2.4]; })); // 近年更多

    // 探测方法随年代演化 + 设施与方法强关联
    var method = pickW([
      ['凌星法', year < 2022 ? 34 : 22],
      ['径向速度法', 20],
      ['微引力透镜', 10],
      ['直接成像', year >= 2023 ? 20 : 7],
      ['脉冲星计时法', 8],
      ['天体测量法', 15]
    ]);
    var facility = pickW(({
      '凌星法': [['开普勒空间望远镜', 26], ['TESS', 34], ['昆仑轨道站', 24], ['韦伯空间望远镜', 8], ['南山 2.5m 阵列', 8]],
      '径向速度法': [['南山 2.5m 阵列', 40], ['天琴干涉仪', 18], ['PAR-40 射电阵', 12], ['昆仑轨道站', 16], ['TESS', 14]],
      '微引力透镜': [['PAR-40 射电阵', 46], ['南山 2.5m 阵列', 22], ['天琴干涉仪', 20], ['昆仑轨道站', 12]],
      '直接成像': [['韦伯空间望远镜', 48], ['天琴干涉仪', 30], ['昆仑轨道站', 22]],
      '脉冲星计时法': [['PAR-40 射电阵', 56], ['天琴干涉仪', 28], ['昆仑轨道站', 16]],
      '天体测量法': [['天琴干涉仪', 38], ['昆仑轨道站', 26], ['韦伯空间望远镜', 20], ['TESS', 16]]
    })[method]);

    var cls = pickW(CLASSES);
    // 半径/质量/温度按类别分布
    var radius, mass, tempK;
    if (cls === '岩质行星') { radius = rand(0.8, 2.4); mass = radius * rand(0.9, 1.6); }
    else if (cls === '海洋世界') { radius = rand(1.4, 3.8); mass = radius * rand(1.1, 2.2); }
    else if (cls === '气态巨行星') { radius = rand(8, 14.5); mass = radius * rand(18, 60); }
    else if (cls === '冰巨星') { radius = rand(3.2, 6.4); mass = radius * rand(3.4, 9); }
    else { radius = rand(4, 18); mass = radius * radius * rand(8, 30); }

    var periodDays = (cls === '气态巨行星' || cls === '双星伴星') ? Math.pow(10, rand(0.3, 3.4)) : Math.pow(10, rand(-0.4, 2.9));
    var distLy = Math.pow(10, rand(1.35, 3.35)); // ~22 ly – ~2200 ly
    tempK = Math.round(cls === '岩质行星' || cls === '海洋世界'
      ? 520000 / Math.pow(periodDays, 0.72) * rand(0.8, 1.2)
      : 180000 / Math.pow(periodDays, 0.6) * rand(0.8, 1.2));
    tempK = Math.max(28, Math.min(2400, tempK));

    var confidence = r2(Math.min(0.99, Math.max(0.5, 0.99 - Math.pow(rnd(), 2.2) * 0.49)));
    var priority = confidence >= 0.9 ? (tempK > 240 && tempK < 320 ? '高' : rnd() < 0.6 ? '高' : '中')
      : confidence >= 0.72 ? '中' : (rnd() < 0.8 ? '低' : '中');

    // 大气与类别相关
    var atmos = pickW(({
      '岩质行星': [['水蒸气云', 26], ['甲烷雾霾', 18], ['富碳', 10], ['无大气', 26], ['未确定', 20]],
      '海洋世界': [['水蒸气云', 46], ['甲烷雾霾', 24], ['富氢', 10], ['未确定', 20]],
      '气态巨行星': [['富氢', 44], ['富碳', 22], ['甲烷雾霾', 16], ['未确定', 18]],
      '冰巨星': [['甲烷雾霾', 38], ['富氢', 30], ['富碳', 14], ['未确定', 18]],
      '双星伴星': [['富氢', 36], ['无大气', 30], ['未确定', 34]]
    })[cls]);

    var band = pickW(({
      '凌星法': [['光学', 52], ['近红外', 34], ['紫外', 14]],
      '径向速度法': [['光学', 58], ['近红外', 28], ['紫外', 14]],
      '微引力透镜': [['近红外', 40], ['光学', 36], ['射电', 24]],
      '直接成像': [['近红外', 58], ['X 射线', 22], ['紫外', 20]],
      '脉冲星计时法': [['射电', 78], ['X 射线', 22]],
      '天体测量法': [['光学', 40], ['近红外', 34], ['紫外', 26]]
    })[method]);

    var prefix = pick(['KX', 'GL', 'NP', 'TY', 'AV', 'LM']);
    records.push({
      id: 'OBS-' + String(i + 1).padStart(4, '0'),
      name: prefix + '-' + String(112 + (i * 37) % 887) + ' ' + 'bcdefg'[i % 6],
      constellation: co, quadrant: quadrant,
      method: method, facility: facility, planet_class: cls,
      atmos: atmos, band: band, team: pickW(TEAMS),
      priority: priority, year: year,
      radius_r: r2(radius), mass_m: Math.round(mass),
      temp_k: tempK, distance_ly: Math.round(distLy),
      period_d: r2(periodDays), confidence: confidence,
      distance_band: distLy < 50 ? '<50 光年' : distLy < 200 ? '50–200 光年' : distLy < 500 ? '200–500 光年' : distLy < 1000 ? '500–1000 光年' : '>1000 光年',
      period_band: periodDays < 10 ? '<10 天' : periodDays < 100 ? '10–100 天' : periodDays < 1000 ? '100–1000 天' : '>1000 天',
      note: pick(NOTES)
    });
  }

  /* ── 维度元数据（标签 / 层级）────────────────── */
  var DIMENSIONS = [
    { id: 'constellation', label: '星座', parent: 'quadrant' },
    { id: 'quadrant', label: '天区象限', parent: null },
    { id: 'method', label: '探测方法', parent: null },
    { id: 'facility', label: '发现设施', parent: null },
    { id: 'planet_class', label: '天体类别', parent: null },
    { id: 'atmos', label: '大气特征', parent: null },
    { id: 'band', label: '发现波段', parent: null },
    { id: 'team', label: '巡天团队', parent: null },
    { id: 'priority', label: '跟踪优先级', parent: null },
    { id: 'distance_band', label: '距离带', parent: null },
    { id: 'period_band', label: '轨道周期带', parent: null },
    { id: 'year', label: '发现年份', parent: null }
  ];

  window.PRISM_DATA = {
    app: 'PRISM · 多维透镜探索台',
    dataset: '深空巡天观测目录 · 巡天批次 S-43',
    seed: SEED,
    count: records.length,
    dimensions: DIMENSIONS,
    records: records,
    generatedAt: '2026-10-24T00:00:00Z'
  };
})();
