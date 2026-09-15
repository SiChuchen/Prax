/* ============ 数据集：Nimbus SaaS 订单数据集（确定性内联生成） ============
 * cardinaity 语义上无界（记录可继续追加），此处内联 1,280 条确定性记录，
 * 页面加载即就绪 —— 不存在加载态（交付约束）。 */
(function (global) {
  'use strict';

  /* mulberry32 —— 种子确定性 PRNG，保证每次打开数据一致 */
  function mulberry32(seed) {
    var a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rnd = mulberry32(20260908);

  function weighted(pairs) { // [[value, weight], ...]
    var total = 0, i;
    for (i = 0; i < pairs.length; i++) total += pairs[i][1];
    var r = rnd() * total;
    for (i = 0; i < pairs.length; i++) {
      r -= pairs[i][1];
      if (r <= 0) return pairs[i][0];
    }
    return pairs[pairs.length - 1][0];
  }

  var CATEGORICAL = [
    {
      id: 'region', name: '区域', icon: '◍',
      values: ['亚太', '欧洲', '北美', '拉美', '中东非'],
      weights: [[0, 28], [1, 24], [2, 26], [3, 12], [4, 10]]
    },
    {
      id: 'category', name: '产品线', icon: '◈',
      values: ['分析平台', '协作套件', '安全网关', '云数据库', '开发者工具', 'AI 助手'],
      weights: [[0, 22], [1, 18], [2, 15], [3, 17], [4, 13], [5, 15]]
    },
    {
      id: 'segment', name: '客户规模', icon: '◉',
      values: ['初创', '中小企业', '中型市场', '大型企业'],
      weights: [[0, 22], [1, 34], [2, 26], [3, 18]]
    },
    {
      id: 'plan', name: '订阅方案', icon: '▤',
      values: ['Free', 'Pro', 'Business', 'Enterprise'],
      weights: [[0, 16], [1, 34], [2, 30], [3, 20]]
    },
    {
      id: 'channel', name: '渠道', icon: '⊕',
      values: ['直销', '渠道伙伴', '在线电商', '市场联盟'],
      weights: [[0, 34], [1, 26], [2, 28], [3, 12]]
    },
    {
      id: 'quarter', name: '季度', icon: '◫',
      values: ['2025Q1', '2025Q2', '2025Q3', '2025Q4', '2026Q1', '2026Q2'],
      weights: [[0, 12], [1, 14], [2, 16], [3, 18], [4, 19], [5, 21]]
    },
    {
      id: 'rep', name: '销售代表', icon: '✦',
      values: ['陈曦', '李昀', '王砚秋', '赵聆', '孙沐', '周子墨', '吴桐', '郑楚'],
      weights: [[0, 14], [1, 13], [2, 14], [3, 12], [4, 12], [5, 13], [6, 11], [7, 11]]
    }
  ];

  /* 数值维度：订单收入 —— 以分箱参与投影/过滤，与类别维度同构 */
  var NUMERIC = [
    { id: 'revenue', name: '订单收入', icon: '◆', binCount: 8, extent: [0, 64000] }
  ];

  var SEG_BASE = { '初创': 3200, '中小企业': 8600, '中型市场': 16500, '大型企业': 30500 };
  var PLAN_F = { 'Free': 0.16, 'Pro': 0.72, 'Business': 1.25, 'Enterprise': 2.1 };
  var CAT_F = { '分析平台': 1.18, '协作套件': 0.72, '安全网关': 0.95, '云数据库': 1.22, '开发者工具': 0.62, 'AI 助手': 1.05 };
  var CH_M = { '直销': 8, '渠道伙伴': 2, '在线电商': 12, '市场联盟': -2 };

  function buildRecords(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var region = weighted(CATEGORICAL[0].weights);
      var category = weighted(CATEGORICAL[1].weights);
      var segment = weighted(CATEGORICAL[2].weights);
      var plan = weighted(CATEGORICAL[3].weights);
      var channel = weighted(CATEGORICAL[4].weights);
      var quarter = weighted(CATEGORICAL[5].weights);
      var rep = weighted(CATEGORICAL[6].weights);

      var revenue = SEG_BASE[CATEGORICAL[2].values[segment]] *
        PLAN_F[CATEGORICAL[3].values[plan]] *
        CAT_F[CATEGORICAL[1].values[category]] *
        (0.55 + rnd() * 1.15);
      revenue = Math.round(revenue / 100) * 100;
      revenue = Math.max(200, Math.min(63000, revenue));

      var units = Math.max(1, Math.min(96, Math.round(revenue / (220 + rnd() * 950))));

      var margin = 26 + CH_M[CATEGORICAL[4].values[channel]] +
        (CATEGORICAL[3].values[plan] === 'Enterprise' ? 6 : CATEGORICAL[3].values[plan] === 'Business' ? 3 : 0) +
        Math.round(rnd() * 14 - 7);
      margin = Math.max(8, Math.min(78, margin));

      var rec = {
        id: 'ORD-' + String(10001 + i),
        region: region, category: category, segment: segment,
        plan: plan, channel: channel, quarter: quarter, rep: rep,
        revenue: revenue, units: units, margin: margin
      };
      out.push(rec);
    }
    return out;
  }

  var RECORDS = buildRecords(1280);

  /* 数值维度分箱：为每条记录预计算 bin 下标，分箱与类别值同构参与过滤/投影 */
  var rev = NUMERIC[0];
  var binW = (rev.extent[1] - rev.extent[0]) / rev.binCount;
  rev.binWidth = binW;
  rev.binLabels = [];
  for (var b = 0; b < rev.binCount; b++) {
    rev.binLabels.push(fmtBin(rev.extent[0] + b * binW, rev.extent[0] + (b + 1) * binW));
  }
  function fmtBin(lo, hi) {
    function k(v) { return v >= 10000 ? (v / 10000).toFixed(v % 10000 ? 1 : 0) + '万' : Math.round(v / 1000) + 'k'; }
    return k(lo) + '–' + k(hi);
  }
  for (var r = 0; r < RECORDS.length; r++) {
    RECORDS[r]._revBin = Math.min(rev.binCount - 1,
      Math.floor(RECORDS[r].revenue / binW));
  }

  /* 维度统一视图：dim.values(i) / dim.valueOf(record) */
  var DIMENSIONS = [];
  CATEGORICAL.forEach(function (d, idx) {
    DIMENSIONS.push({
      id: d.id, name: d.name, icon: d.icon, kind: 'categorical',
      values: d.values, order: idx,
      valueOf: function (rec) { return rec[d.id]; }
    });
  });
  NUMERIC.forEach(function (d) {
    DIMENSIONS.push({
      id: d.id, name: d.name, icon: d.icon, kind: 'numeric',
      values: d.binLabels, order: 7,
      valueOf: function (rec) { return d.binLabels[rec._revBin]; }
    });
  });

  global.PRISM_DATASET = {
    name: 'Nimbus SaaS 订单数据集',
    version: 'v2026-06 · 内联快照',
    records: RECORDS,
    dimensions: DIMENSIONS,
    measures: [
      { id: 'revenue', name: '收入合计', fmt: 'money' },
      { id: 'units', name: '数量合计', fmt: 'int' },
      { id: 'margin', name: '平均利润率', fmt: 'pct' }
    ],
    generated: { seed: 20260908, count: RECORDS.length }
  };
})(window);
