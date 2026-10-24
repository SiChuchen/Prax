/* EXO·LENS — 系外行星维度探索
 * data.js — 确定性数据集（种子化 PRNG，脚本解析期同步生成，无网络/无加载态）
 * 全局：window.DATA = { dims, records, palette }
 */
(function () {
  'use strict';

  // mulberry32 — 确定性种子随机数
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rng = mulberry32(20260242);
  function u() { return rng(); }
  function gauss() { // Box-Muller
    var a = Math.max(u(), 1e-9), b = u();
    return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
  }
  function pick(weights) { // 归一化权重抽取
    var s = 0, i; for (i = 0; i < weights.length; i++) s += weights[i];
    var r = u() * s, acc = 0;
    for (i = 0; i < weights.length; i++) { acc += weights[i]; if (r < acc) return i; }
    return weights.length - 1;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  var METHODS = ['凌星法', '径向速度', '凌星时间变分', '微引力透镜', '直接成像', '天体测量'];
  var STARS = ['M', 'K', 'G', 'F', 'A'];
  var STAR_TEMP = { M: [2500, 3700], K: [3700, 5200], G: [5200, 6000], F: [6000, 7500], A: [7500, 9500] };

  // 维度注册表：extent 固定（不随过滤变化）→ 坐标系是稳定认知锚点
  var dims = [
    { id: 'method',     label: '发现方法', type: 'cat', values: METHODS,
      short: { '凌星法': '凌星', '径向速度': '视速', '凌星时间变分': 'TTV', '微引力透镜': '微透', '直接成像': '成像', '天体测量': '天测' } },
    { id: 'starType',   label: '恒星光谱型', type: 'cat', values: STARS },
    { id: 'systemSize', label: '系统行星数', type: 'cat', values: ['1', '2', '3', '4+'] },
    { id: 'radius',  label: '行星半径', type: 'num', unit: 'R⊕', min: 0.3, max: 16 },
    { id: 'mass',    label: '行星质量', type: 'num', unit: 'M⊕', min: 0.05, max: 3200, scale: 'log' },
    { id: 'period',  label: '轨道周期', type: 'num', unit: '天', min: 0.6, max: 12000, scale: 'log' },
    { id: 'starTemp',label: '恒星温度', type: 'num', unit: 'K', min: 2500, max: 9500 },
    { id: 'distance',label: '距离',     type: 'num', unit: '光年', min: 4, max: 3200, scale: 'log' },
    { id: 'year',    label: '发现年份', type: 'num', unit: '年', min: 1998, max: 2025, integer: true },
    { id: 'name',    label: '名称',     type: 'id' }
  ];

  var PREFIX = ['Kepler', 'TOI', 'HD', 'GJ', 'K2-', 'HAT-P', 'WASP', 'LHS'];
  var LETTER = ['b', 'c', 'd', 'e', 'f'];

  function makeName() {
    var p = PREFIX[Math.floor(u() * PREFIX.length)];
    var n = 1 + Math.floor(u() * 4800);
    var l = LETTER[Math.floor(u() * LETTER.length)];
    return p + '-' + n + ' ' + l;
  }

  var records = [];
  for (var i = 0; i < 420; i++) {
    var mi = pick([0.42, 0.24, 0.10, 0.08, 0.09, 0.07]);
    var method = METHODS[mi];

    // 半径：按方法偏置（成像→巨行星，凌星→偏小）
    var rLo, rHi, skew;
    if (method === '直接成像')        { rLo = 7;   rHi = 14;  skew = 1.0; }
    else if (method === '微引力透镜') { rLo = 2.8; rHi = 10;  skew = 1.4; }
    else if (method === '径向速度')   { rLo = 1.6; rHi = 13;  skew = 1.6; }
    else                             { rLo = 0.6; rHi = 8;   skew = 2.2; }
    var radius = clamp(rLo + (rHi - rLo) * Math.pow(u(), skew), 0.3, 16);
    radius = +radius.toFixed(2);

    // 质量：岩石 r^3.9，气巨 r^1.7（物理上都是指数律近似）
    var mass = radius < 1.7
      ? Math.pow(radius, 3.9) * (0.7 + 0.6 * u())
      : Math.pow(radius, 1.7) * (0.6 + 0.8 * u());
    mass = +clamp(mass, 0.05, 3200).toFixed(2);

    // 周期：对数正态；热木星例外（大半径 × 短周期）
    var period = Math.exp(4.2 + 2.1 * gauss());
    if (radius > 8 && u() < 0.35) period = 1.5 + 4 * u();
    period = +clamp(period, 0.6, 12000).toFixed(1);

    // 恒星
    var si = pick([0.38, 0.25, 0.18, 0.12, 0.07]);
    var starType = STARS[si];
    var tr = STAR_TEMP[starType];
    var starTemp = Math.round(tr[0] + (tr[1] - tr[0]) * u());

    // 距离：对数正态；成像/微透显著更远
    var distance = Math.exp(4.4 + 1.15 * gauss());
    if (method === '直接成像' || method === '微引力透镜') distance += 400 + 600 * u();
    distance = Math.round(clamp(distance, 4, 3200));

    // 年份：后期凌星巡天占优
    var year;
    if (method === '凌星法' || method === '凌星时间变分') year = 2009 + Math.floor(Math.pow(u(), 0.7) * 17);
    else year = 1998 + Math.floor(Math.pow(u(), 1.2) * 28);
    year = clamp(year, 1998, 2025);

    // 系统行星数：凌星法多行星系统更多
    var sizeIdx = method === '凌星法' ? pick([0.42, 0.28, 0.16, 0.14]) : pick([0.72, 0.16, 0.08, 0.04]);
    var systemSize = ['1', '2', '3', '4+'][sizeIdx];

    records.push({
      id: 'r' + i, name: makeName(), method: method, starType: starType,
      systemSize: systemSize, radius: radius, mass: mass, period: period,
      starTemp: starTemp, distance: distance, year: year
    });
  }
  // 名称唯一化（同缀再加字母）
  (function uniq() {
    var seen = {};
    records.forEach(function (r) {
      if (seen[r.name]) r.name = r.name.replace(/[bcdef]$/, function (m) {
        return LETTER[Math.min(LETTER.indexOf(m) + 1 + Math.floor(u() * 2), 4)];
      });
      seen[r.name] = true;
    });
  })();

  var palette = ['#5ec8ff', '#8be28b', '#ffd166', '#ff8fa3', '#c792ea', '#7fdbca', '#f4a261', '#b8c0cc'];

  window.DATA = { dims: dims, records: records, palette: palette };
})();
