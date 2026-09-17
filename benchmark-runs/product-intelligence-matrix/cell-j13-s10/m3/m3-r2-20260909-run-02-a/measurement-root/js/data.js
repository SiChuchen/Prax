/* 星穹棱镜 · 数据层：确定性种子生成系外行星目录（同步执行，随首屏就绪） */
window.Data = (function () {
  'use strict';

  // mulberry32 确定性伪随机
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20260902);
  function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function rf(a, b) { return a + rnd() * (b - a); }
  function gauss(mu, sd) { return mu + sd * (rnd() + rnd() + rnd() + rnd() - 2) * 1.2; }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }

  /* ---- 维度注册表：全应用共用 ---- */
  var NUMS = [
    { key: 'radius',   name: '行星半径',   unit: 'R⊕',   dp: 2 },
    { key: 'mass',     name: '行星质量',   unit: 'M⊕',   dp: 1 },
    { key: 'period',   name: '轨道周期',   unit: '天',    dp: 1 },
    { key: 'temp',     name: '平衡温度',   unit: 'K',    dp: 0 },
    { key: 'dist',     name: '距地距离',   unit: '光年',  dp: 0 },
    { key: 'starMass', name: '恒星质量',   unit: 'M☉',   dp: 2 },
    { key: 'starTemp', name: '恒星温度',   unit: 'K',    dp: 0 },
    { key: 'ecc',      name: '轨道离心率', unit: '',     dp: 2 },
    { key: 'metal',    name: '金属丰度',   unit: '[Fe/H]', dp: 2 },
    { key: 'esi',      name: '地球相似度', unit: 'ESI',  dp: 2 },
    { key: 'year',     name: '发现年份',   unit: '',     dp: 0 }
  ];
  var CATS = [
    { key: 'spec',   name: '恒星光谱型', values: ['M', 'K', 'G', 'F', 'A', 'B'] },
    { key: 'method', name: '探测方法',   values: ['凌星法', '视向速度', '微引力透镜', '直接成像', '脉冲星计时'] },
    { key: 'hz',     name: '位于宜居带', values: ['是', '否'] }
  ];
  var HIER = [
    { key: 'constel', name: '星座', type: 'cat' },
    { key: 'zone',    name: '天区', type: 'cat' }
  ];

  /* ---- 星座 → 天区（层级：天区 ⊃ 星座） ---- */
  var CONSTELS = [
    ['天鹅座', '北天'], ['天琴座', '北天'], ['仙后座', '北天'], ['仙女座', '北天'],
    ['大熊座', '北天'], ['牧夫座', '北天'], ['天鹰座', '北天'], ['猎户座', '赤道带'],
    ['双子座', '北天'], ['御夫座', '北天'], ['波江座', '赤道带'], ['长蛇座', '赤道带'],
    ['室女座', '赤道带'], ['天秤座', '赤道带'], ['天蝎座', '赤道带'], ['人马座', '赤道带'],
    ['南鱼座', '南天'], ['船帆座', '南天'], ['半人马座', '南天'], ['杜鹃座', '南天']
  ];

  var PREFIX = ['HD ', 'GJ ', 'TOI-', 'K2-', 'Kepler-', 'WASP-', 'HAT-P-'];

  /* ---- 生成目录 ---- */
  var rows = [], stars = {}, idc = 0;
  var NSTAR = 300;
  for (var s = 0; s < NSTAR; s++) {
    var cs = CONSTELS[s % CONSTELS.length];
    var spec, starTemp, starMass;
    var roll = rnd();
    if (roll < 0.42)      { spec = 'M'; starTemp = ri(2600, 3800); starMass = rf(0.10, 0.55); }
    else if (roll < 0.72) { spec = 'K'; starTemp = ri(3900, 5200); starMass = rf(0.55, 0.85); }
    else if (roll < 0.90) { spec = 'G'; starTemp = ri(5300, 6000); starMass = rf(0.85, 1.15); }
    else if (roll < 0.97) { spec = 'F'; starTemp = ri(6100, 7400); starMass = rf(1.15, 1.5); }
    else if (roll < 0.995){ spec = 'A'; starTemp = ri(7500, 9800); starMass = rf(1.5, 2.4); }
    else                  { spec = 'B'; starTemp = ri(10500, 22000); starMass = rf(2.6, 6.0); }

    var starName = pick(PREFIX) + ri(11, 99999);
    var nPlanets = rnd() < 0.55 ? 1 : (rnd() < 0.75 ? 2 : 3);
    var metal = clamp(gauss(-0.04, 0.17), -0.6, 0.5);
    var sysId = 'S' + s;

    for (var p = 0; p < nPlanets; p++) {
      // 周期：对数均匀 0.6..8000 天，同系统内层近外远
      var logP = rf(Math.log(0.6), Math.log(8000) - p * rf(0.8, 2.2));
      var period = Math.exp(clamp(logP, Math.log(0.6), Math.log(8000)));
      var aAU = Math.sqrt(starMass) * Math.pow(period / 365.25, 2 / 3);
      var temp = Math.round(clamp(278 * (starTemp / 5778) * Math.pow(1 / (2 * aAU), 0.5) * rf(0.85, 1.15), 35, 2400));

      // 半径/质量相关；短周期大行星偏热木星
      var baseR = Math.exp(rf(Math.log(0.8), Math.log(11)) - (period < 8 ? -rf(0.3, 1.4) : 0));
      var radius = clamp(baseR * rf(0.85, 1.18), 0.35, 14.5);
      var mass = clamp(Math.pow(radius, 3) * rf(0.25, 1.6) * (radius > 4 ? 0.35 : 1), 0.05, 4200);
      var ecc = clamp(gauss(0.08, 0.14) * (period < 10 ? 0.3 : 1), 0, 0.88);
      var dist = Math.round(Math.exp(rf(Math.log(9), Math.log(3200))));
      var esi = clamp(
        Math.exp(-0.85 * Math.pow(radius - 1, 2)) *
        Math.exp(-0.000011 * Math.pow(temp - 288, 2)), 0, 0.99);
      var hz = (temp >= 195 && temp <= 330) ? '是' : '否';

      // 发现方法与年份、行星大小相关
      var year = ri(1995, 2026);
      var method;
      var m = rnd();
      if (spec === 'B' || spec === 'A') method = (m < 0.55 ? '直接成像' : (m < 0.85 ? '视向速度' : '凌星法'));
      else if (year < 2009) method = (m < 0.8 ? '视向速度' : (m < 0.92 ? '凌星法' : '微引力透镜'));
      else method = (m < 0.72 ? '凌星法' : (m < 0.9 ? '视向速度' : (m < 0.97 ? '微引力透镜' : '直接成像')));
      if (rnd() < 0.004) method = '脉冲星计时';
      if (method === '直接成像') year = Math.max(year, 2008);

      rows.push({
        id: 'P' + (idc++),
        name: starName.replace(/ /g, '') + ['b', 'c', 'd'][p],
        sysName: starName, letter: ['b', 'c', 'd'][p],
        constel: cs[0], zone: cs[1],
        spec: spec, method: method, hz: hz,
        radius: +radius.toFixed(2),
        mass: +mass.toPrecision(3),
        period: +period.toFixed(1),
        temp: temp,
        dist: dist,
        starMass: +starMass.toFixed(2),
        starTemp: Math.round(starTemp / 10) * 10,
        ecc: +ecc.toFixed(2),
        metal: +metal.toFixed(2),
        esi: +esi.toFixed(2),
        year: year
      });
    }
    stars[sysId] = starName;
  }

  var byId = {};
  rows.forEach(function (r) { byId[r.id] = r; });

  // 层级维度的取值集（供过滤/编码共用）
  HIER.forEach(function (d) {
    var s = {};
    rows.forEach(function (r) { s[r[d.key]] = true; });
    d.values = Object.keys(s).sort();
  });

  // 每个数值维度的取值范围（供坐标轴与直方图使用）
  var extents = {};
  NUMS.forEach(function (d) {
    var lo = Infinity, hi = -Infinity;
    rows.forEach(function (r) { lo = Math.min(lo, r[d.key]); hi = Math.max(hi, r[d.key]); });
    extents[d.key] = [lo, hi];
  });

  return {
    rows: rows, byId: byId, stars: stars,
    NUMS: NUMS, CATS: CATS, HIER: HIER,
    extents: extents,
    nStars: NSTAR
  };
})();
