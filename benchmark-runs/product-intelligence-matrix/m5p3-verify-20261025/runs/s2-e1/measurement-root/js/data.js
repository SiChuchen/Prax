/*
 * OSS Radar 520 — 多维演示数据集（确定性内联）
 * 由确定性 PRNG（mulberry32, seed=20260925）生成：同种子恒产出同一数据集。
 * 本文件即静态 JS：随页面同步解析执行，无 fetch、无加载态，首帧即就绪。
 * 10 个维度：4 分类 + 5 数值 + 1 时间。
 */
(function () {
  'use strict';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rand = mulberry32(20260925);
  function normal() {
    var u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

  var CATEGORIES = ['基础设施', '数据库', '开发者工具', '人工智能', '前端框架', '安全'];
  var LICENSES = ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'GPL-3.0'];
  var LANG_BY_CAT = {
    '基础设施': ['Go', 'Rust', 'C++', 'Zig'],
    '数据库': ['Rust', 'Go', 'C++', 'Java'],
    '开发者工具': ['Go', 'Rust', 'TypeScript'],
    '人工智能': ['Python', 'C++', 'TypeScript'],
    '前端框架': ['TypeScript', 'Rust'],
    '安全': ['Rust', 'Go', 'C++']
  };
  var NAME_SUFFIX = {
    '基础设施': ['net', 'mesh', 'link', 'bus', 'gate'],
    '数据库': ['db', 'store', 'sql', 'kv', 'tsdb'],
    '开发者工具': ['cli', 'kit', 'dev', 'forge', 'lint'],
    '人工智能': ['ai', 'llm', 'nn', 'infer', 'embed'],
    '前端框架': ['ui', 'dom', 'view', 'web', 'grid'],
    '安全': ['vault', 'shield', 'scan', 'auth', 'seal']
  };
  var NAME_PREFIX = ['nova', 'quark', 'pulse', 'atlas', 'vertex', 'ember', 'cobalt', 'drift',
    'lumen', 'onyx', 'raven', 'sigma', 'tide', 'kestrel', 'zephyr', 'iris',
    'mono', 'pyro', 'flux', 'crux', 'halo', 'orbit', 'plinth', 'delta'];
  var CAT_STARS_MULT = { '基础设施': 1.6, '数据库': 1.8, '开发者工具': 1.2, '人工智能': 2.4, '前端框架': 1.0, '安全': 0.9 };
  var CAT_CLOSE_BASE = { '基础设施': 72, '数据库': 74, '开发者工具': 70, '人工智能': 62, '前端框架': 68, '安全': 66 };

  var CURRENT_YEAR = 2026;
  var usedNames = Object.create(null);
  var records = [];

  for (var i = 0; i < 520; i++) {
    var category = pick(CATEGORIES);
    var language = pick(LANG_BY_CAT[category]);
    var license = pick(LICENSES);
    var age = 1 + Math.floor(rand() * 17);            // 1..17 年
    var year = CURRENT_YEAR - age;
    var stars = clamp(+(Math.exp(normal() * 1.0 + 1.55) * CAT_STARS_MULT[category]).toFixed(1), 0.2, 240); // 单位 k
    var contributors = Math.max(2, Math.round(Math.sqrt(stars) * 6 * (0.6 + rand() * 0.8)));
    var prwk = Math.max(0, Math.round(contributors * (0.08 + rand() * 0.12)));
    var closeRate = clamp(Math.round(CAT_CLOSE_BASE[category] + normal() * 10 + (age > 8 ? 4 : 0)), 21, 99);
    var deps = Math.max(0, Math.round(Math.exp(normal() * 1.1 + 2.1) * (category === '人工智能' ? 1.5 : 1)));

    // 生命周期由 年龄×热度 推导，带少量噪声（派生维度，非独立抽样）
    var stage = (age >= 12 && stars >= 30) ? '成熟' : (age >= 5 ? '成长' : '孵化');
    if (rand() < 0.10) stage = (stage === '孵化') ? '成长' : (stage === '成长' ? '成熟' : '成长');

    var name = '';
    var guard = 0;
    do {
      name = pick(NAME_PREFIX) + '-' + pick(NAME_SUFFIX[category]) + (rand() < 0.45 ? String(1 + Math.floor(rand() * 98)) : '');
      guard++;
    } while (usedNames[name] && guard < 50);
    usedNames[name] = true;

    records.push({
      id: 'r' + String(i + 1).padStart(3, '0'),
      name: name,
      category: category,
      language: language,
      license: license,
      stage: stage,
      stars: stars,
      contributors: contributors,
      prwk: prwk,
      closeRate: closeRate,
      deps: deps,
      year: year
    });
  }

  window.OSS_RADAR = {
    name: 'OSS Radar 520',
    title: '开源仓库观测集',
    description: '520 个开源仓库 × 10 个维度的演示观测集（确定性生成，seed=20260925；数值为演示用途，非真实统计）',
    seed: 20260925,
    records: records
  };
})();
