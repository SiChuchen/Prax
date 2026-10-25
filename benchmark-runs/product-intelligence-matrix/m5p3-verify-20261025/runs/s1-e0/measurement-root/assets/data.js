/* ORRERY data layer — deterministic synthetic exoplanet catalog.
   Seeded PRNG generates all records synchronously at script evaluation:
   the dataset is ready with the first paint (no loading state, no network). */
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
  var rand = mulberry32(0xC0FFEE);
  function gauss() {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function pick(pairs) {
    var s = 0, i;
    for (i = 0; i < pairs.length; i++) s += pairs[i][1];
    var r = rand() * s;
    for (i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r <= 0) return pairs[i][0]; }
    return pairs[pairs.length - 1][0];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* hierarchy: sector (天区) → constellation (星座) → system (恒星系统) → planet (行星) */
  var SECTORS = [
    { id: 'north',   name: 'North Cap',       consts: [['Orion', 'Ori'], ['Cygnus', 'Cyg'], ['Lyra', 'Lyr']] },
    { id: 'equator', name: 'Equatorial Belt', consts: [['Hydra', 'Hya'], ['Cetus', 'Cet'], ['Bootes', 'Boo']] },
    { id: 'south',   name: 'South Reach',     consts: [['Carina', 'Car'], ['Vela', 'Vel'], ['Ara', 'Ara']] },
    { id: 'outer',   name: 'Outer Arm',       consts: [['Draco', 'Dra'], ['Phoenix', 'Pho'], ['Tucana', 'Tuc']] }
  ];
  var METHODS = [['Transit', 0.44], ['Radial Velocity', 0.28], ['Transit Timing', 0.09],
                 ['Microlensing', 0.07], ['Direct Imaging', 0.06], ['Astrometry', 0.06]];

  var records = [], systems = [], sysSeq = 0;
  var TARGET = 840;

  outer:
  for (var si = 0; si < SECTORS.length; si++) {
    var sec = SECTORS[si];
    for (var ci = 0; ci < sec.consts.length; ci++) {
      var cName = sec.consts[ci][0], cAbbr = sec.consts[ci][1];
      var nSys = 16 + Math.floor(rand() * 8); /* 16..23 systems per constellation */
      for (var k = 0; k < nSys; k++) {
        sysSeq++;
        var sysId = cAbbr + '-' + (100 + sysSeq);
        var distLy = clamp(Math.exp(3.6 + gauss() * 0.9), 4, 12000);
        var nStars = pick([[1, 0.84], [2, 0.12], [3, 0.04]]);
        var nPlanets = 1 + Math.floor(rand() * 6); /* 1..6 */
        if (records.length + nPlanets > TARGET) nPlanets = TARGET - records.length;
        for (var p = 0; p < nPlanets; p++) {
          var massE = clamp(Math.exp(0.8 + gauss() * 1.3), 0.05, 8000);
          var radiusE = clamp(1.12 * Math.pow(massE, 0.27) * Math.exp(gauss() * 0.25), 0.3, 16.5);
          var periodD = clamp(Math.exp(4.2 + gauss() * 1.8), 0.5, 22000);
          var tempK = clamp(1500 * Math.pow(periodD, -0.32) * Math.exp(gauss() * 0.4), 25, 2700);
          var year = 2009 + Math.floor(rand() * 17);
          var method = pick(METHODS);
          var hab = clamp(
            Math.exp(-Math.pow((tempK - 288) / 110, 2)) *
            (1 - Math.min(1, Math.log10(massE + 0.2) / 3.4)) *
            (radiusE < 2.5 ? 1 : 0.35),
            0, 1);
          records.push({
            id: sysId + ' ' + String.fromCharCode(98 + p),
            sys: sysId, constellation: cName, sector: sec.name, sectorId: sec.id,
            method: method, year: year,
            mass: +massE.toFixed(3), radius: +radiusE.toFixed(2),
            period: +periodD.toFixed(2), temp: Math.round(tempK),
            dist: Math.round(distLy), stars: nStars, hab: +hab.toFixed(3)
          });
        }
        systems.push(sysId);
        if (records.length >= TARGET) break outer;
      }
    }
  }

  var DIMENSIONS = [
    { id: 'mass',          label: '质量',     en: 'mass',          unit: 'M⊕', type: 'num',  log: true },
    { id: 'radius',        label: '半径',     en: 'radius',        unit: 'R⊕', type: 'num',  log: false },
    { id: 'period',        label: '轨道周期', en: 'period',        unit: '天',  type: 'num',  log: true },
    { id: 'temp',          label: '平衡温度', en: 'temp',          unit: 'K',   type: 'num',  log: false },
    { id: 'dist',          label: '距离',     en: 'dist',          unit: 'ly',  type: 'num',  log: true },
    { id: 'year',          label: '发现年份', en: 'year',          unit: '',    type: 'num',  log: false },
    { id: 'hab',           label: '宜居指数', en: 'hab',           unit: '',    type: 'num',  log: false },
    { id: 'stars',         label: '恒星数',   en: 'stars',         unit: '',    type: 'num',  log: false },
    { id: 'method',        label: '发现方法', en: 'method',        unit: '',    type: 'cat' },
    { id: 'constellation', label: '星座→天区', en: 'constellation', unit: '',    type: 'tree' }
  ];

  window.ORRERY_DATA = {
    records: records,
    dimensions: DIMENSIONS,
    sectors: SECTORS,
    methods: METHODS.map(function (m) { return m[0]; }),
    meta: {
      seed: '0xC0FFEE',
      total: records.length,
      systems: systems.length,
      note: '确定性合成目录：统计形状参照系外行星档案，数值为本地生成，非真实观测。'
    }
  };
})();
