'use strict';
/* ============================================================
 * data.js — 指标目录 + 确定性数据流引擎的数据侧
 * - mulberry32 种子随机源：同一 seed 生成完全相同的初始历史
 * - 24 个指标 × 4 分组，每指标 90 点环形缓冲（带时间戳）
 * - 初始历史用"脚本化剧本"生成：页面加载即有 2 危急 + 4 告警
 *   在墙面上，且事件流与历史逐点一致（变化可追溯）
 * ============================================================ */

const TICK_MS = 1200;   // 流推进周期
const HIST    = 90;     // 环形缓冲长度（≈108s）
const DELTA_LAG = 25;   // Δ 对比基准：25 个采样之前（≈30s）
const FEED_MAX = 8;     // 异常事件流保留条数
const POINTS_SHOWN = 12; // inspector 逐点明细行数

/* ---------- 确定性随机源 ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0xC7041);
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ---------- 目录 ---------- */
const GROUPS = [
  { id: 'gateway',   name: '接入网关' },
  { id: 'orders',    name: '订单域' },
  { id: 'payments',  name: '支付域' },
  { id: 'inventory', name: '库存域' },
];

/* dir:'above' 越高越坏；dir:'below' 越低越坏。
   scripted: 初始历史剧本（i: 0..89），决定首屏可见的异常态势。 */
const METRICS = [
  // 接入网关
  { id: 'gw.req',     name: '请求速率',       group: 'gateway', unit: 'req/s',   dec: 0, dir: 'above', warn: 9500, crit: 12000, base: 6200, amp: 150 },
  { id: 'gw.p99',     name: 'P99 延迟',       group: 'gateway', unit: 'ms',      dec: 0, dir: 'above', warn: 400,  crit: 800,   base: 212,  amp: 9  },
  { id: 'gw.err',     name: '错误率',         group: 'gateway', unit: '%',       dec: 2, dir: 'above', warn: 1.5,  crit: 3,     base: 0.42, amp: 0.05,
    scripted: i => { if (i < 40) return 0.42 + Math.sin(i / 6) * 0.05 + gauss() * 0.02;
                     if (i < 78) return ramp(i, 40, 78, 0.45, 1.92);
                     return 1.9 + gauss() * 0.03; } },
  { id: 'gw.conn',    name: '活跃连接数',     group: 'gateway', unit: '连接',    dec: 0, dir: 'above', warn: 6000, crit: 8000,  base: 3120, amp: 90 },
  { id: 'gw.cache',   name: '缓存命中率',     group: 'gateway', unit: '%',       dec: 1, dir: 'below', warn: 75,   crit: 60,    base: 87,   amp: 1.1 },
  { id: 'gw.tls',     name: 'TLS 握手',       group: 'gateway', unit: '/s',      dec: 0, dir: 'above', warn: 900,  crit: 1400,  base: 482,  amp: 18 },

  // 订单域
  { id: 'od.rate',    name: '订单创建速率',   group: 'orders',  unit: '单/min',  dec: 0, dir: 'above', warn: 600,  crit: 900,   base: 342,  amp: 12 },
  { id: 'od.payok',   name: '支付成功率',     group: 'orders',  unit: '%',       dec: 2, dir: 'below', warn: 97,   crit: 94,    base: 99.1, amp: 0.16,
    scripted: i => { if (i < 50) return 99.1 + Math.sin(i / 5) * 0.12 + gauss() * 0.05;
                     if (i < 80) return ramp(i, 50, 80, 99.05, 96.35);
                     return 96.35 + gauss() * 0.06; } },
  { id: 'od.ck95',    name: '结算 P95',       group: 'orders',  unit: 'ms',      dec: 0, dir: 'above', warn: 1500, crit: 3000,  base: 838,  amp: 32 },
  { id: 'od.refund',  name: '退款率',         group: 'orders',  unit: '%',       dec: 2, dir: 'above', warn: 4,    crit: 7,     base: 1.82, amp: 0.12 },
  { id: 'od.queue',   name: '订单队列深度',   group: 'orders',  unit: '条',      dec: 0, dir: 'above', warn: 500,  crit: 800,   base: 132,  amp: 16,
    scripted: i => { if (i < 45) return 132 + Math.sin(i / 7) * 20 + gauss() * 6;
                     if (i < 80) return ramp(i, 45, 80, 140, 962);
                     return 950 + gauss() * 14; } },
  { id: 'od.saga',    name: 'Saga 失败',      group: 'orders',  unit: '单/h',    dec: 0, dir: 'above', warn: 25,   crit: 60,    base: 6,    amp: 1.2 },

  // 支付域
  { id: 'pm.txn',     name: '交易速率',       group: 'payments', unit: '笔/s',   dec: 0, dir: 'above', warn: 1300, crit: 1800,  base: 724,  amp: 22 },
  { id: 'pm.auth95',  name: '授权 P95',       group: 'payments', unit: 'ms',     dec: 0, dir: 'above', warn: 350,  crit: 700,   base: 162,  amp: 7 },
  { id: 'pm.decline', name: '卡拒付率',       group: 'payments', unit: '%',      dec: 2, dir: 'above', warn: 4,    crit: 6,     base: 2.2,  amp: 0.13,
    scripted: i => { if (i < 48) return 2.2 + Math.sin(i / 6) * 0.12 + gauss() * 0.04;
                     if (i < 84) return ramp(i, 48, 84, 2.25, 6.95);
                     return 6.9 + gauss() * 0.05; } },
  { id: 'pm.settle',  name: '清算滞后',       group: 'payments', unit: 's',      dec: 0, dir: 'above', warn: 90,   crit: 240,   base: 42,   amp: 3,
    scripted: i => { if (i < 55) return 42 + Math.sin(i / 8) * 5 + gauss() * 1.2;
                     if (i < 86) return ramp(i, 55, 86, 44, 138);
                     return 135 + gauss() * 2.5; } },
  { id: 'pm.charge',  name: '拒付申诉率',     group: 'payments', unit: '‱',      dec: 1, dir: 'above', warn: 12,   crit: 25,    base: 4.1,  amp: 0.3 },
  { id: 'pm.fraud',   name: '风控拦截',       group: 'payments', unit: '次/h',   dec: 0, dir: 'above', warn: 120,  crit: 300,   base: 38,   amp: 4 },

  // 库存域
  { id: 'iv.lag',     name: '库存同步滞后',   group: 'inventory', unit: 's',     dec: 0, dir: 'above', warn: 30,   crit: 90,    base: 9,    amp: 0.8,
    scripted: i => { if (i < 52) return 9 + Math.sin(i / 6) * 1.1 + gauss() * 0.3;
                     if (i < 82) return ramp(i, 52, 82, 9.5, 46);
                     return 44 + gauss() * 0.8; } },
  { id: 'iv.conf',    name: '占用冲突',       group: 'inventory', unit: '次/h',  dec: 0, dir: 'above', warn: 45,   crit: 100,   base: 12,   amp: 1.6 },
  { id: 'iv.wms',     name: 'WMS 事件流',     group: 'inventory', unit: 'evt/s', dec: 0, dir: 'above', warn: 1600, crit: 2200,  base: 952,  amp: 30 },
  { id: 'iv.lk95',    name: 'SKU 查询 P95',   group: 'inventory', unit: 'ms',    dec: 0, dir: 'above', warn: 150,  crit: 400,   base: 74,   amp: 3 },
  { id: 'iv.replen',  name: '补货速率',       group: 'inventory', unit: '单/h',  dec: 0, dir: 'below', warn: 800,  crit: 300,   base: 2140, amp: 60 },
  { id: 'iv.cpu',     name: '仓储服务 CPU',   group: 'inventory', unit: '%',     dec: 1, dir: 'above', warn: 85,   crit: 95,    base: 52,   amp: 2.4 },
];

/* 线性爬坡（带缓入），供剧本使用 */
function ramp(i, start, end, from, to) {
  if (i <= start) return from;
  if (i >= end) return to;
  const t = (i - start) / (end - start);
  return from + (to - from) * (t * t * 0.55 + t * 0.45);
}

/* 默认剧本：围绕基线的平稳波动 */
function plainWalk(i, m) { return m.base + Math.sin(i / 6 + i % 5) * m.amp * 0.55 + gauss() * m.amp * 0.35; }

/* ---------- 状态判定 ---------- */
function statusOf(m, v) {
  if (m.dir === 'above') return v >= m.crit ? 'crit' : v >= m.warn ? 'warn' : 'ok';
  return v <= m.crit ? 'crit' : v <= m.warn ? 'warn' : 'ok';
}

/* ---------- 初始历史生成（页面加载时同步执行 → 首屏即 ready） ---------- */
function buildInitialState(nowMs) {
  for (const m of METRICS) {
    m.vals = new Array(HIST);
    m.times = new Array(HIST);
    for (let i = 0; i < HIST; i++) {
      const fn = m.scripted ? m.scripted : (j => plainWalk(j, m));
      let v = fn(i);
      v = clampMetric(m, v);
      m.vals[i] = v;
      m.times[i] = nowMs - (HIST - 1 - i) * TICK_MS;
    }
    m.walk = 0; // 活跃期扰动归零，由事件模型接管
    const last = m.vals[HIST - 1];
    m.cur = last;
    m.status = statusOf(m, last);
    // 把剧本结束时相对基线的偏移交给事件模型"接力"，异常缓慢消退而非瞬间消失
    const off = last - m.base;
    if (m.scripted && Math.abs(off) > m.amp * 2) {
      m.ev = { phase: 'hold', off, cur: off, t: 0, len: 60 + Math.floor(rng() * 80), rampLen: 6 };
    } else {
      m.ev = null;
    }
  }
}

function clampMetric(m, v) {
  let lo = 0;
  let hi = m.unit === '%' ? 100 : Infinity;
  // 平稳指标限幅，避免长尾漂移出语境
  if (!m.scripted) hi = Math.min(hi, m.base + m.amp * 14);
  return Math.min(hi, Math.max(lo, v));
}

/* ---------- 活跃事件模型：偶尔孵化异常，爬坡→维持→衰减 ---------- */
function startEvent(m) {
  const badSign = m.dir === 'above' ? 1 : -1;
  const off = badSign * m.amp * (5 + Math.floor(rng() * 9));
  m.ev = { phase: 'ramp', off, cur: 0, t: 0, len: 5 + Math.floor(rng() * 7), hold: 24 + Math.floor(rng() * 48), rampLen: 6 };
}

function updateEvent(m) {
  if (!m.ev) { if (rng() < 0.006) startEvent(m); return; }
  const ev = m.ev;
  if (ev.phase === 'ramp') {
    ev.t++;
    ev.cur = ev.off * (ev.t / ev.len);
    if (ev.t >= ev.len) { ev.phase = 'hold'; ev.t = 0; ev.len = ev.hold; }
  } else if (ev.phase === 'hold') {
    ev.t++;
    if (ev.t >= ev.len) ev.phase = 'decay';
  } else { // decay
    ev.cur *= 0.955;
    if (Math.abs(ev.cur) < m.amp * 0.8) m.ev = null;
  }
}

/* ---------- 流推进：返回下一个采样值 ---------- */
function nextValue(m) {
  updateEvent(m);
  m.walk += -m.walk * 0.08 + gauss() * m.amp * 0.9; // 均值回归随机游走
  m.walk = Math.max(-m.amp * 3.5, Math.min(m.amp * 3.5, m.walk));
  const evOff = m.ev ? (m.ev.phase === 'hold' ? m.ev.off : m.ev.cur) : 0;
  return clampMetric(m, m.base + m.walk + evOff);
}

/* ---------- 格式化 ---------- */
function fmtVal(m, v) {
  return v.toLocaleString('en-US', { minimumFractionDigits: m.dec, maximumFractionDigits: m.dec });
}
function fmtTime(t) {
  const d = new Date(t);
  const p = n => String(n).padStart(2, '0');
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
