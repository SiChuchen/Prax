/* 生成内联数据集 js/data.js —— cell-j13-s10
 * 确定性（种子 20260903）：600 条系外行星巡天记录 × 10 个维度（4 分类 + 6 数量）。
 * 维度间保留真实感的相关结构：类别由半径派生、温度随轨道距离与恒星型变化、
 * 质量随半径增长、宜居指数由温度与半径共同决定 —— 保证探索有结构可发现。
 * 运行：node scripts/gen-data.js  （输出覆盖 js/data.js）
 */
'use strict';
const fs = require('fs');
const path = require('path');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260903);
const rand = () => rnd();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
function weighted(pairs) { // [[value, weight],...]
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = rand() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
}
function lognormal(median, sigma) {
  // Box–Muller
  const u = Math.max(rand(), 1e-9), v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return median * Math.exp(sigma * z);
}
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---- 维度元数据（与 data.js 一并内联）----
const DIMS = [
  { id: 'method', label: '发现方法', type: 'cat', family: '观测属性',
    values: ['凌星法', '视向速度法', '凌星时间变分', '微引力透镜', '直接成像', '脉冲星计时', '天体测量'] },
  { id: 'pclass', label: '行星类别', type: 'cat', family: '观测属性',
    values: ['岩石行星', '超级地球', '海王星类', '气态巨行星'] },
  { id: 'star', label: '恒星光谱型', type: 'cat', family: '恒星系统',
    values: ['M 型', 'K 型', 'G 型', 'F 型', 'A 型'] },
  { id: 'sky', label: '天区', type: 'cat', family: '恒星系统',
    values: ['北天·一象限', '北天·二象限', '南天·三象限', '南天·四象限'] },
  { id: 'orbit', label: '轨道半长轴', type: 'quant', family: '轨道物理', unit: 'AU', min: 0.02, max: 60, bins: 8, dec: 2 },
  { id: 'radius', label: '行星半径', type: 'quant', family: '行星物理', unit: 'R⊕', min: 0.3, max: 15, bins: 8, dec: 1 },
  { id: 'mass', label: '质量', type: 'quant', family: '行星物理', unit: 'M⊕', min: 0.1, max: 4000, bins: 8, dec: 1 },
  { id: 'temp', label: '平衡温度', type: 'quant', family: '行星物理', unit: 'K', min: 20, max: 2200, bins: 8, dec: 0 },
  { id: 'dist', label: '距离', type: 'quant', family: '恒星系统', unit: 'ly', min: 10, max: 9000, bins: 8, dec: 0 },
  { id: 'esi', label: '宜居指数', type: 'quant', family: '行星物理', unit: '', min: 0, max: 1, bins: 8, dec: 2 },
];
const STAR_T = { 'M 型': 3200, 'K 型': 4800, 'G 型': 5700, 'F 型': 6500, 'A 型': 8500 };

// ---- 生成 600 条 ----
const PREFIX = ['KOI', 'TOI', 'HD', 'GJ', 'WASP', 'HAT-P', 'K2-', 'Kepler'];
const used = new Set();
function makeName() {
  for (;;) {
    const n = pick(PREFIX) + Math.floor(1 + rand() * 9400);
    if (!used.has(n)) { used.add(n); return n; }
  }
}
const records = [];
for (let i = 0; i < 600; i++) {
  // 半径：约 22% 巨行星，其余对数正态
  const isGiant = rand() < 0.22;
  let radius;
  if (isGiant) radius = 6 + rand() * 8.5;
  else radius = clamp(lognormal(1.35, 0.5), 0.3, 5.8);
  const pclass = radius < 1.6 ? '岩石行星' : radius < 2.5 ? '超级地球' : radius < 6 ? '海王星类' : '气态巨行星';

  // 轨道：对数正态，巨行星略偏远
  const orbit = clamp(lognormal(isGiant ? 1.6 : 0.35, 1.1), 0.02, 55);

  // 恒星型 → 有效温度
  const star = weighted([['M 型', 38], ['K 型', 24], ['G 型', 18], ['F 型', 12], ['A 型', 8]]);
  const tStar = STAR_T[star] * (0.92 + rand() * 0.16);

  // 平衡温度 ~ T_star^0.5 / sqrt(a)，巨行星加内部热
  let temp = 278 * Math.sqrt(tStar / 5778) / Math.sqrt(orbit) * (0.9 + rand() * 0.2);
  if (isGiant) temp += 40 + rand() * 110;
  temp = clamp(Math.round(temp), 20, 2200);

  // 质量：半径超指数增长 + 噪声（岩石更致密）
  const densityFactor = radius < 1.6 ? 1.1 : radius < 6 ? 0.55 : 0.3;
  const mass = clamp(Math.pow(radius, 3.4) * densityFactor * (0.7 + rand() * 0.6), 0.08, 4200);

  // 距离：帕累托式长尾
  const dist = clamp(Math.round(15 + 120 * Math.pow(rand(), -0.85) * 0.12), 11, 8980);

  // 宜居指数：温度 288K、半径 1.2R⊕ 附近最高
  const esi = clamp(Math.exp(-Math.pow((temp - 288) / 130, 2) - Math.pow((radius - 1.2) / 2.6, 2)), 0, 1);

  // 发现方法：与轨道相关性（凌星偏向近轨），其余按权重
  let method;
  if (orbit < 0.6) method = weighted([['凌星法', 62], ['视向速度法', 20], ['凌星时间变分', 10], ['天体测量', 4], ['直接成像', 1], ['脉冲星计时', 1], ['微引力透镜', 2]]);
  else if (orbit < 5) method = weighted([['凌星法', 34], ['视向速度法', 40], ['凌星时间变分', 12], ['微引力透镜', 8], ['天体测量', 4], ['直接成像', 1], ['脉冲星计时', 1]]);
  else method = weighted([['直接成像', 38], ['微引力透镜', 34], ['视向速度法', 14], ['凌星法', 6], ['天体测量', 6], ['凌星时间变分', 2]]);

  const sky = pick(DIMS[3].values);

  records.push({
    id: 'r' + String(i + 1).padStart(3, '0'),
    name: makeName(),
    method, pclass, star, sky,
    orbit: +orbit.toFixed(orbit < 1 ? 3 : 2),
    radius: +radius.toFixed(2),
    mass: +(mass < 10 ? mass.toFixed(2) : mass.toFixed(1)),
    temp, dist,
    esi: +esi.toFixed(3),
  });
}

// ---- 输出 ----
const out = `/* cell-j13-s10 · 内联数据集：系外行星巡天量表（600 条 × 10 维）
 * 由 scripts/gen-data.js 确定性生成（种子 20260903），随首屏内联加载，无网络请求。
 * 维度间保留相关结构：类别↔半径、温度↔轨道与恒星型、质量↔半径、宜居指数↔温度半径。 */
(function () {
  'use strict';
  var DIMS = ${JSON.stringify(DIMS)};
  var RECORDS = ${JSON.stringify(records)};
  window.SURVEY = {
    name: '系外行星巡天量表',
    note: '600 条确认系外行星 · 10 个维度 · 确定性样本（种子 20260903）',
    dims: DIMS,
    records: RECORDS
  };
})();
`;
const outPath = path.join(__dirname, '..', 'js', 'data.js');
fs.writeFileSync(outPath, out, 'utf8');
const cats = {};
records.forEach(r => { cats[r.pclass] = (cats[r.pclass] || 0) + 1; });
console.log('WROTE', outPath, records.length, 'records,', (out.length / 1024).toFixed(1) + 'KB');
console.log('pclass 分布:', JSON.stringify(cats));
