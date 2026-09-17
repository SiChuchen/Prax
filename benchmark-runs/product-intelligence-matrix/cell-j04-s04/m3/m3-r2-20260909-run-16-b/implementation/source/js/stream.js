/* ============================================================
 * PulseWall · stream.js — 本地模拟流引擎（无后端、无依赖）
 * 职责：指标定义、确定性种子历史（首屏即满数据）、1Hz 推进、
 *       滞回状态机（防闪烁）、事件生成、异常注入。
 * 全局命名空间：window.PulseStream
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 确定性 PRNG（mulberry32）+ 高斯噪声 ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260917);
  let spare = null;
  function gauss() {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  }

  /* ---------- 指标定义（24 项 · 4 域 · 位置即数组序，恒定不重排） ---------- */
  // dir=+1 越高越坏；dir=-1 越低越坏
  const METRICS = [
    // 接入网关 edge
    { id: 'http.rps',          name: '请求速率',   dom: 'edge', unit: 'req/s', base: 12400, dir: -1 },
    { id: 'http.p99',          name: '入口 P99',   dom: 'edge', unit: 'ms',    base: 118,   dir: +1 },
    { id: 'http.err',          name: '错误率',     dom: 'edge', unit: '%',     base: 0.42,  dir: +1 },
    { id: 'edge.cache',        name: '边缘缓存命中', dom: 'edge', unit: '%',   base: 92.5,  dir: -1 },
    { id: 'edge.conn',         name: '活动连接',   dom: 'edge', unit: '',      base: 4560,  dir: +1 },
    { id: 'edge.block',        name: '拦截速率',   dom: 'edge', unit: '/s',    base: 31,    dir: +1 },
    // 服务层 svc
    { id: 'svc.orders',        name: '订单 QPS',   dom: 'svc',  unit: '/s',    base: 852,   dir: -1 },
    { id: 'svc.pay.lat',       name: '支付延迟',   dom: 'svc',  unit: 'ms',    base: 182,   dir: +1 },
    { id: 'svc.cart.lat',      name: '购物车延迟', dom: 'svc',  unit: 'ms',    base: 61,    dir: +1 },
    { id: 'svc.search',        name: '搜索 QPS',   dom: 'svc',  unit: '/s',    base: 2380,  dir: -1 },
    { id: 'svc.queue',         name: '队列积压',   dom: 'svc',  unit: '条',    base: 128,   dir: +1 },
    { id: 'svc.retry',         name: '重试率',     dom: 'svc',  unit: '%',     base: 1.18,  dir: +1 },
    // 数据层 data
    { id: 'db.qps',            name: '查询 QPS',   dom: 'data', unit: '/s',    base: 5240,  dir: +1 },
    { id: 'db.lag',            name: '复制延迟',   dom: 'data', unit: 's',     base: 0.82,  dir: +1 },
    { id: 'db.slow',           name: '慢查询',     dom: 'data', unit: '/min',  base: 13.6,  dir: +1 },
    { id: 'cache.hit',         name: '缓存命中率', dom: 'data', unit: '%',     base: 88.4,  dir: -1 },
    { id: 'mq.lag',            name: '消息积压',   dom: 'data', unit: '万',    base: 2.35,  dir: +1 },
    { id: 'es.p95',            name: '检索 P95',   dom: 'data', unit: 'ms',    base: 216,   dir: +1 },
    // 资源层 infra
    { id: 'infra.cpu',         name: 'CPU 使用率', dom: 'infra', unit: '%',    base: 44.6,  dir: +1 },
    { id: 'infra.mem',         name: '内存使用率', dom: 'infra', unit: '%',    base: 61.8,  dir: +1 },
    { id: 'infra.iowait',      name: 'IO 等待',    dom: 'infra', unit: '%',    base: 5.8,   dir: +1 },
    { id: 'infra.net.out',     name: '出带宽',     dom: 'infra', unit: 'Gbps', base: 4.24,  dir: +1 },
    { id: 'infra.pod.restart', name: 'Pod 重启',   dom: 'infra', unit: '/h',   base: 0.52,  dir: +1 },
    { id: 'infra.pod.pend',    name: '待调度 Pod', dom: 'infra', unit: '个',   base: 3.1,   dir: +1 },
  ];

  const DOM_LABELS = { edge: '接入网关', svc: '服务层', data: '数据层', infra: '资源层' };
  const DOM_ORDER = ['edge', 'svc', 'data', 'infra'];

  const WINDOW = 90;          // 每指标 90 个采样点（≈90s）
  const WARN_K = 0.25;        // 警告阈值距离系数
  const CRIT_K = 0.45;        // 严重阈值距离系数

  function thresholdsOf(m) {
    const wd = m.base * WARN_K, cd = m.base * CRIT_K;
    return m.dir > 0
      ? { warn: m.base + wd, crit: m.base + cd, wd: wd, cd: cd }
      : { warn: m.base - wd, crit: m.base - cd, wd: wd, cd: cd };
  }

  /* ---------- 引擎状态 ---------- */
  const state = {};   // id -> { m, th, samples:[{t,v}], status, sinceT, okTicks, incident }
  let t0 = 0;
  let lastTickAt = 0;
  let running = true;
  let transitions = 0;
  const events = [];  // 新事件 unshift，cap 200

  function noiseSigma(m) { return m.base * 0.022; }

  function rawValue(m, tRel, envAmp) {
    // 均值回归随机游走 + 异常包络
    const s = state[m.id];
    const prev = s.samples.length ? s.samples[s.samples.length - 1].v : m.base;
    let v = prev + (m.base - prev) * 0.08 + gauss() * noiseSigma(m);
    if (envAmp) v += envAmp;
    return v;
  }

  /* 异常包络形状：attack-hold-release */
  function envelope(inc, tRel) {
    if (!inc) return 0;
    const dt = tRel - inc.start;
    if (dt < 0 || dt > inc.dur + inc.rel) return 0;
    const a = Math.min(1, dt / inc.atk);
    let r = 1;
    if (dt > inc.dur) r = Math.max(0, 1 - (dt - inc.dur) / inc.rel);
    return inc.amp * a * r;
  }

  function makeIncident(m, type, tStart) {
    const th = state[m.id].th;
    const overCrit = (th.crit - m.base) * 1.25; // 方向由 (crit-base) 符号自带（dir=-1 时为负）
    if (type === 'spike') {
      return { type: 'spike', start: tStart, dur: 6 + rand() * 4, atk: 1.5, rel: 4, amp: overCrit };
    }
    return { type: 'drift', start: tStart, dur: 24 + rand() * 10, atk: 6, rel: 4, amp: overCrit };
  }

  /* ---------- 状态机（滞回 + 最短驻留 → 无闪烁） ---------- */
  function classify(m, v) {
    const th = state[m.id].th;
    const dir = m.dir > 0 ? 1 : -1;
    const s = (v - m.base) * dir;
    const margin = m.base * 0.02;
    const sCrit = (th.crit - m.base) * dir;
    const sWarn = (th.warn - m.base) * dir;
    if (s >= sCrit + margin) return 'crit';
    if (s >= sWarn + margin * 0.5) return 'warn';
    return 'ok';
  }

  function advance(m, v, now) {
    const s = state[m.id];
    const proposed = classify(m, v);
    const dwell = now - s.sinceT;
    if (proposed === s.status) { s.okTicks = 0; return; }
    if (proposed === 'crit') { setStatus(m, v, now, 'crit'); return; }        // 升级立即
    if (proposed === 'warn') { if (dwell >= 3000) setStatus(m, v, now, 'warn'); return; }
    if (proposed === 'ok') {
      s.okTicks++;
      if (s.okTicks >= 3 && dwell >= 5000) setStatus(m, v, now, 'ok');        // 恢复需连续 3 拍确认
    }
  }

  function setStatus(m, v, now, st) {
    const s = state[m.id];
    const from = s.status;
    s.status = st;
    s.sinceT = now;
    s.okTicks = 0;
    if (st === 'ok') s.injectFlag = false;
    if (from === st) return;
    transitions++;
    if (from !== null) {
      const kind = st === 'ok' ? 'ok' : st;
      events.unshift({
        t: now, id: m.id, name: m.name, unit: m.unit,
        kind: s.injectFlag && st !== 'ok' ? 'inject' : kind,
        from: from, to: st, v: v,
        msg: st === 'ok'
          ? '恢复正常 ' + fmt(m, v) + m.unit
          : (st === 'crit' ? '升至严重 ' : '进入警告 ') + fmt(m, v) + m.unit
      });
      if (events.length > 200) events.pop();
    }
  }

  /* ---------- 数值格式化 ---------- */
  function fmt(m, v) {
    if (m.unit === '%') return v.toFixed(1);
    if (Math.abs(m.base) >= 1000) return Math.round(v).toLocaleString('en-US');
    if (Math.abs(m.base) >= 100) return v.toFixed(0);
    if (Math.abs(m.base) >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }

  /* ---------- 种子历史（首屏即满数据，无加载态） ---------- */
  // 预置异常：svc.queue 漂移中（t0-35s 起，60s 时长）→ 加载即为 warn，约 15s 后升 crit
  const SEEDED_INCIDENTS = [
    { id: 'svc.queue', type: 'drift', start: 35, dur: 60, atk: 6, rel: 4 },
  ];
  // 预置历史事件（与包络大体吻合，构成可追溯的既有证据链）
  const SEEDED_EVENTS = [
    { ago: 47000, id: 'infra.net.out', kind: 'ok',   from: 'warn', to: 'ok' },
    { ago: 62000, id: 'infra.net.out', kind: 'warn', from: 'ok',   to: 'warn' },
    { ago: 74000, id: 'infra.cpu',     kind: 'ok',   from: 'crit', to: 'ok' },
    { ago: 82000, id: 'infra.cpu',     kind: 'crit', from: 'warn', to: 'crit' },
    { ago: 86000, id: 'infra.cpu',     kind: 'warn', from: 'ok',   to: 'warn' },
  ];

  function seed() {
    t0 = Date.now();
    const incMap = {};
    SEEDED_INCIDENTS.forEach(function (si) {
      const m = METRICS.find(function (x) { return x.id === si.id; });
      incMap[si.id] = {
        type: si.type, start: si.start, dur: si.dur, atk: si.atk, rel: si.rel,
        amp: (state[si.id].th.crit - m.base) * 1.25
      };
    });
    METRICS.forEach(function (m) {
      const s = state[m.id];
      s.samples = [];
      for (let i = WINDOW - 1; i >= 0; i--) {
        const t = t0 - i * 1000;
        const inc = incMap[m.id];
        // inc.start 为“距 now 的秒数”：采样 i 秒前位于异常开始后 (start - i) 秒
        const env = inc ? envelope(inc, inc.start - i) : 0;
        const prev = s.samples.length ? s.samples[s.samples.length - 1].v : m.base;
        const v = prev + (m.base - prev) * 0.08 + gauss() * noiseSigma(m) + env;
        s.samples.push({ t: t, v: v });
      }
      const last = s.samples[s.samples.length - 1].v;
      const raw = classify(m, last);
      s.status = raw === 'warn' || raw === 'crit' ? raw : 'ok';
      s.sinceT = t0 - 32000; // 预置异常已持续 ~32s
      s.okTicks = 0;
      if (raw !== 'ok') s.sinceT = t0 - (SEEDED_INCIDENTS[0].id === m.id ? 32 : 20) * 1000;
      s.incident = incMap[m.id] || null;
    });
    SEEDED_EVENTS.forEach(function (se) {
      const m = METRICS.find(function (x) { return x.id === se.id; });
      events.push({
        t: t0 - se.ago, id: m.id, name: m.name, unit: m.unit, kind: se.kind,
        from: se.from, to: se.to,
        msg: se.to === 'ok' ? '恢复正常' : (se.to === 'crit' ? '升至严重' : '进入警告')
      });
    });
    events.sort(function (a, b) { return b.t - a.t; });
  }

  /* ---------- 1Hz 推进 ---------- */
  function tick(now) {
    METRICS.forEach(function (m) {
      const s = state[m.id];
      const tRel = (now - t0) / 1000;
      // 自然偶发异常（低概率）
      if (!s.incident && rand() < 0.0006) {
        s.incident = makeIncident(m, rand() < 0.5 ? 'spike' : 'drift', tRel);
      }
      let env = 0;
      if (s.incident) {
        env = envelope(s.incident, tRel);
        if (env === 0 && tRel > s.incident.start + s.incident.dur + s.incident.rel) s.incident = null;
      }
      const v = Math.max(0, rawValue(m, tRel, env));
      s.samples.push({ t: now, v: v });
      if (s.samples.length > WINDOW) s.samples.shift();
      advance(m, v, now);
    });
    lastTickAt = now;
  }

  /* ---------- 人工注入（走同一条检测管线） ---------- */
  function inject() {
    const okList = METRICS.filter(function (m) { return state[m.id].status === 'ok' && !state[m.id].incident; });
    if (!okList.length) return null;
    const m = okList[Math.floor(rand() * okList.length)];
    const type = rand() < 0.5 ? 'spike' : 'drift';
    state[m.id].incident = makeIncident(m, type, (Date.now() - t0) / 1000);
    state[m.id].injectFlag = true;
    events.unshift({
      t: Date.now(), id: m.id, name: m.name, unit: m.unit, kind: 'inject',
      msg: '人工注入' + (type === 'spike' ? '突刺' : '漂移') + '（演示）'
    });
    if (events.length > 200) events.pop();
    return m.id;
  }

  /* ---------- 初始化 ---------- */
  METRICS.forEach(function (m) {
    state[m.id] = {
      m: m, th: thresholdsOf(m), samples: [],
      status: null, sinceT: 0, okTicks: 0, incident: null, injectFlag: false
    };
  });
  seed();
  lastTickAt = Date.now();

  /* ---------- 导出 ---------- */
  window.PulseStream = {
    METRICS: METRICS,
    DOM_LABELS: DOM_LABELS,
    DOM_ORDER: DOM_ORDER,
    WINDOW: WINDOW,
    state: state,
    events: events,
    fmt: fmt,
    classify: classify,
    tick: tick,
    inject: inject,
    t0: function () { return t0; },
    isRunning: function () { return running; },
    setRunning: function (r) { running = r; if (r) lastTickAt = Date.now(); },
    lastTickAt: function () { return lastTickAt; },
    transitions: function () { return transitions; }
  };
})();
