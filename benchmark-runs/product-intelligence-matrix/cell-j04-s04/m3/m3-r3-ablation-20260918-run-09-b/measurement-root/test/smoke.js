// Node 冒烟测试：验证数据引擎（不涉及 DOM）
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8');
const test = src + `

// ---- 断言 ----
const now = Date.now();
buildInitialState(now);
const counts = { ok: 0, warn: 0, crit: 0 };
for (const m of METRICS) { counts[m.status]++; if (m.vals.length !== 90) throw new Error('hist len'); if (m.times[89] > now) throw new Error('future time'); }
console.log('initial status counts:', JSON.stringify(counts));
if (counts.crit < 2) throw new Error('expected >=2 crit at load');
if (counts.warn < 3) throw new Error('expected >=3 warn at load');

// 初始事件重放
let evs = [];
for (const m of METRICS) {
  let prev = statusOf(m, m.vals[0]);
  for (let i = 1; i < 90; i++) {
    const st = statusOf(m, m.vals[i]);
    if (st !== prev) { evs.push({ id: m.id, sev: st, t: m.times[i] }); prev = st; }
  }
}
console.log('initial events:', evs.length);
evs.sort((a, b) => b.t - a.t);
console.log('newest 3:', evs.slice(0, 3).map(e => e.id + ':' + e.sev).join(', '));

// 100 tick 稳定性：无 NaN、无越界、事件正常产生
let transitions = 0;
for (let t = 0; t < 100; t++) {
  for (const m of METRICS) {
    const v = nextValue(m);
    if (!isFinite(v) || v < 0) throw new Error('bad value ' + m.id + ' ' + v);
    if (m.unit === '%' && v > 100) throw new Error('pct overflow ' + m.id + ' ' + v);
    m.vals.push(v); m.vals.shift();
    const st = statusOf(m, v);
    if (st !== m.status) { transitions++; m.status = st; }
  }
}
console.log('100 ticks ok, live transitions:', transitions);
const c2 = { ok: 0, warn: 0, crit: 0 };
for (const m of METRICS) c2[m.status]++;
console.log('after 100 ticks:', JSON.stringify(c2));
console.log('sample anomaly timeline (pm.decline last 5):');
const dm = METRICS.find(m => m.id === 'pm.decline');
for (let i = 85; i < 90; i++) console.log(' ', new Date(dm.times[i]).toISOString().slice(11, 19), dm.vals[i].toFixed(2), statusOf(dm, dm.vals[i]));
console.log('SMOKE OK');
`;
new Function(test)();
