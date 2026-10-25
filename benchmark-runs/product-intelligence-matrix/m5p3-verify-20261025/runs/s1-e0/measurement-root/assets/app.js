/* ORRERY app — dimensional-space explorer (cell-j13-s10)
   Success criterion: 维度切换不重置认知 — selection, filters and per-projection
   viewports survive channel switches. Acceptance seed: 过滤/投影状态有归属且可回退 —
   every state change is recorded in the ledger with its owning region + action,
   and is one click revertible (undo/redo/revert-to-entry).

   State machine: READY is the initial and only steady state (data is synchronous);
   EMPTY (filter excludes all), SELECTED, ERROR are reachable. A LOADING state is
   intentionally absent/unreachable per the brief (初始数据随首屏就绪，不得以加载态作为可测状态). */
(function () {
  'use strict';

  /* ---------- error state ---------- */
  var fatalBox = document.getElementById('fatal');
  function fatal(msg) {
    fatalBox.hidden = false;
    document.getElementById('fatal-msg').textContent = msg;
  }
  window.addEventListener('error', function (e) { fatal('运行时错误：' + e.message); });

  var D = window.ORRERY_DATA;
  if (!D || !D.records || !D.records.length) { fatal('数据不可用：ORRERY_DATA 为空'); return; }

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function trim2(x) { return String(Math.round(x * 100) / 100); }
  function fmtN(v) {
    if (!isFinite(v)) return '–';
    var a = Math.abs(v);
    if (a >= 1e6) return trim2(v / 1e6) + 'M';
    if (a >= 1e4) return trim2(v / 1e3) + 'k';
    if (a >= 100) return String(Math.round(v));
    if (a >= 10) return trim2(Math.round(v * 10) / 10);
    if (a >= 1) return trim2(Math.round(v * 100) / 100);
    return String(Math.round(v * 1000) / 1000);
  }
  function fmtTime(ts) {
    var d = new Date(ts), p = function (x) { return (x < 10 ? '0' : '') + x; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function hexRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mix(c1, c2, t) {
    return 'rgb(' + Math.round(c1[0] + (c2[0] - c1[0]) * t) + ',' +
      Math.round(c1[1] + (c2[1] - c1[1]) * t) + ',' + Math.round(c1[2] + (c2[2] - c1[2]) * t) + ')';
  }

  /* ---------- dimensions & domains ---------- */
  var DIM = {};
  D.dimensions.forEach(function (d) { DIM[d.id] = d; });
  function tOf(d, v) { return d.log ? Math.log10(Math.max(v, 1e-6)) : v; }
  function vOf(d, t) { return d.log ? Math.pow(10, t) : t; }

  D.dimensions.forEach(function (d) {
    if (d.type !== 'num') return;
    var lo = Infinity, hi = -Infinity, i, r;
    for (i = 0; i < D.records.length; i++) {
      r = D.records[i][d.id];
      if (r < lo) lo = r; if (r > hi) hi = r;
    }
    if (d.log && lo <= 0) lo = Math.min(hi, 1e-3);
    if (d.log) {
      var a = Math.log10(lo), b = Math.log10(hi), pad = (b - a) * 0.04;
      lo = Math.pow(10, a - pad); hi = Math.pow(10, b + pad);
    } else {
      var p = (hi - lo) * 0.05 || 1; lo -= p; hi += p;
    }
    d.dom = [lo, hi];
  });

  var SECTOR_COLORS = { north: '#4cc2ff', equator: '#7ee787', south: '#ffb454', outer: '#d2a8ff' };
  var CAT_COLORS = ['#4cc2ff', '#ffb454', '#7ee787', '#ff7b72', '#d2a8ff', '#f2da4e', '#f778ba', '#79c0ff'];
  var GRAD = ['#2b1e8c', '#3455c8', '#2f9fd0', '#35c48d', '#9ed75a', '#f2e15a'].map(hexRgb);
  var SEL_COLOR = '#ffd166';
  var CH_NAME = { x: 'X', y: 'Y', color: '颜色', size: '大小' };
  var CH_LETTER = { x: 'X', y: 'Y', color: 'C', size: 'S' };
  var CH_SHORT = { x: 'cx', y: 'cy', color: 'cc', size: 'cs' };
  var CH_COLOR = { x: '#4cc2ff', y: '#d2a8ff', color: '#7ee787', size: '#ffb454' };

  function channelAllowed(ch, d) {
    if (ch === 'x' || ch === 'y' || ch === 'size') return d.type === 'num';
    return true; /* color accepts any dimension */
  }
  function catIndex(d, v) { return D.methods.indexOf(v); }

  function colorFor(rec, cd) {
    if (!cd) return '#8b94a7';
    if (cd.type === 'cat') {
      var i = catIndex(cd, rec[cd.id]);
      return CAT_COLORS[(i < 0 ? 0 : i) % CAT_COLORS.length];
    }
    if (cd.type === 'tree') return SECTOR_COLORS[rec.sectorId] || '#8b94a7';
    var t = (tOf(cd, rec[cd.id]) - tOf(cd, cd.dom[0])) / (tOf(cd, cd.dom[1]) - tOf(cd, cd.dom[0]));
    t = clamp(t, 0, 1) * (GRAD.length - 1);
    var s = Math.floor(t); if (s >= GRAD.length - 1) { s = GRAD.length - 2; t = GRAD.length - 1; }
    return mix(GRAD[s], GRAD[s + 1], t - s);
  }

  /* ---------- state (single owner) ---------- */
  function freshState() {
    return {
      channels: { x: 'dist', y: 'temp', color: 'method', size: 'radius' },
      logAxes: { x: true, y: false },
      filters: {},   /* dimId -> {lo,hi} | {off:[values]} ; range in data units */
      selection: [], /* record ids, ordered */
      viewports: {}, /* projKey -> {k,tx,ty} : per-projection viewport memory */
      k: 1, tx: 0, ty: 0
    };
  }
  function snapshot(s) {
    return JSON.parse(JSON.stringify({
      channels: s.channels, logAxes: s.logAxes, filters: s.filters,
      selection: s.selection, viewports: s.viewports, k: s.k, tx: s.tx, ty: s.ty
    }));
  }
  var state = freshState();

  /* ---------- ledger (attribution + reversibility) ---------- */
  var history = [], cur = -1, seq = 0;
  function commit(kind, actor, label) {
    seq++;
    history.splice(cur + 1);
    history.push({ seq: seq, ts: Date.now(), kind: kind, actor: actor, label: label, state: snapshot(state) });
    if (history.length > 61) history.shift();
    cur = history.length - 1;
    renderAll(true);
  }
  function act(kind, actor, label, mutate) {
    if (mutate) mutate(state);
    commit(kind, actor, label);
  }
  function undo() {
    if (cur <= 0) return;
    cur--;
    state = snapshot(history[cur].state);
    renderAll(true);
  }
  function redo() {
    if (cur >= history.length - 1) return;
    cur++;
    state = snapshot(history[cur].state);
    renderAll(true);
  }
  function revertTo(i) {
    if (i === cur || i < 0 || i >= history.length) return;
    var h = history[i];
    act('revert', '状态台账', '回退到 #' + h.seq + '「' + h.label + '」', function (s) {
      var t = h.state;
      s.channels = JSON.parse(JSON.stringify(t.channels));
      s.logAxes = JSON.parse(JSON.stringify(t.logAxes));
      s.filters = JSON.parse(JSON.stringify(t.filters));
      s.selection = JSON.parse(JSON.stringify(t.selection));
      s.viewports = JSON.parse(JSON.stringify(t.viewports));
      s.k = t.k; s.tx = t.tx; s.ty = t.ty;
    });
  }

  /* ---------- filters ---------- */
  function rangeFilterActive(id) {
    var f = state.filters[id], d = DIM[id];
    return !!(f && (f.lo > d.dom[0] + 1e-9 || f.hi < d.dom[1] - 1e-9));
  }
  function setFilterActive(id) {
    var f = state.filters[id];
    if (!f) return false;
    if (f.lo != null) return rangeFilterActive(id);
    return !!(f.off && f.off.length);
  }
  function activeFilterCount() {
    var n = 0, k;
    for (k in state.filters) if (setFilterActive(k)) n++;
    return n;
  }
  function passes(rec) {
    for (var id in state.filters) {
      var f = state.filters[id];
      if (f.lo != null) {
        if (rangeFilterActive(id) && (rec[id] < f.lo || rec[id] > f.hi)) return false;
      } else if (f.off && f.off.length && f.off.indexOf(rec[id]) >= 0) return false;
    }
    return true;
  }
  function filterLabel(id) {
    var f = state.filters[id], d = DIM[id];
    if (f.lo != null) return d.label + ' ' + fmtN(f.lo) + ' – ' + fmtN(f.hi) + (d.unit ? ' ' + d.unit : '');
    if (d.type === 'tree') {
      var names = f.off || [];
      return '星座 ≠ ' + names.slice(0, 2).join(', ') + (names.length > 2 ? ' +' + (names.length - 2) : '');
    }
    return d.label + ' ≠ ' + (f.off || []).join(', ');
  }

  /* ---------- visible set ---------- */
  var visibleList = [], ghostList = [];
  function classify() {
    visibleList.length = 0; ghostList.length = 0;
    for (var i = 0; i < D.records.length; i++) {
      var r = D.records[i];
      (passes(r) ? visibleList : ghostList).push(r);
    }
  }

  /* ---------- canvas ---------- */
  var canvas = $('plot'), ctx = canvas.getContext('2d');
  var M = { l: 64, r: 18, t: 16, b: 44 };
  var PW = 0, PH = 0, dpr = 1;
  var hitPts = [], hoverRec = null;
  var projKey = function () { return state.channels.x + '|' + state.channels.y; };

  function resizeCanvas() {
    var box = canvas.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(50, Math.round(box.width * dpr));
    canvas.height = Math.max(50, Math.round(box.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sx(v, dx) {
    var t0 = tOf(dx, dx.dom[0]), t1 = tOf(dx, dx.dom[1]);
    return M.l + (tOf(dx, v) - t0) / (t1 - t0) * PW * state.k + state.tx;
  }
  function sy(v, dy) {
    var t0 = tOf(dy, dy.dom[0]), t1 = tOf(dy, dy.dom[1]);
    return M.t + PH - (tOf(dy, v) - t0) / (t1 - t0) * PH * state.k + state.ty;
  }
  function invX(px, dx) {
    var t0 = tOf(dx, dx.dom[0]), t1 = tOf(dx, dx.dom[1]);
    return vOf(dx, t0 + (px - M.l - state.tx) / (PW * state.k) * (t1 - t0));
  }
  function invY(py, dy) {
    var t0 = tOf(dy, dy.dom[0]), t1 = tOf(dy, dy.dom[1]);
    return vOf(dy, t0 + (M.t + PH - py - state.ty) / (PH * state.k) * (t1 - t0));
  }

  function ticksFor(d, spanPx) {
    var t0 = tOf(d, d.dom[0]), t1 = tOf(d, d.dom[1]), out = [];
    if (d.log) {
      var dec = Math.ceil(t0), step = (t1 - t0) > 7 ? 2 : 1;
      if (dec <= t0) dec += step;
      for (; dec <= t1; dec += step) out.push(Math.pow(10, dec));
    } else {
      var target = clamp(Math.round(spanPx / 90), 3, 9);
      var span = t1 - t0, mag = Math.pow(10, Math.floor(Math.log10(span / target)));
      var norm = span / target / mag;
      var step2 = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
      var v = Math.ceil(t0 / step2) * step2;
      for (; v <= t1; v += step2) out.push(v);
    }
    return out;
  }

  var boxSel = null; /* {x0,y0,x1,y1} px, shift-drag rubber band */

  function draw() {
    var W = canvas.clientWidth, H = canvas.clientHeight;
    PW = Math.max(10, W - M.l - M.r); PH = Math.max(10, H - M.t - M.b);
    ctx.clearRect(0, 0, W, H);
    var dx = DIM[state.channels.x], dy = DIM[state.channels.y];

    /* grid + ticks */
    ctx.font = '10.5px ' + getComputedStyle(document.body).getPropertyValue('--mono');
    ctx.fillStyle = '#5c6577'; ctx.strokeStyle = '#1a2030'; ctx.lineWidth = 1;
    var xt = ticksFor(dx, PW * state.k), i, x;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (i = 0; i < xt.length; i++) {
      x = sx(xt[i], dx);
      if (x < M.l - 1 || x > M.l + PW + 1) continue;
      ctx.beginPath(); ctx.moveTo(x, M.t); ctx.lineTo(x, M.t + PH); ctx.stroke();
      ctx.fillText(fmtN(xt[i]), x, M.t + PH + 6);
    }
    var yt = ticksFor(dy, PH * state.k), y;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (i = 0; i < yt.length; i++) {
      y = sy(yt[i], dy);
      if (y < M.t - 1 || y > M.t + PH + 1) continue;
      ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(M.l + PW, y); ctx.stroke();
      ctx.fillText(fmtN(yt[i]), M.l - 7, y);
    }
    /* frame */
    ctx.strokeStyle = '#232a3a';
    ctx.strokeRect(M.l + .5, M.t + .5, PW - 1, PH - 1);
    /* axis titles */
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = CH_COLOR.x;
    ctx.fillText(dx.label + (dx.unit ? ' (' + dx.unit + ')' : '') + (dx.log ? ' ·log' : ''), M.l + PW / 2, H - 20);
    ctx.save();
    ctx.translate(14, M.t + PH / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = CH_COLOR.y; ctx.textBaseline = 'top';
    ctx.fillText(dy.label + (dy.unit ? ' (' + dy.unit + ')' : '') + (dy.log ? ' ·log' : ''), 0, 0);
    ctx.restore();

    /* points */
    var sd = DIM[state.channels.size];
    var s0 = tOf(sd, sd.dom[0]), s1 = tOf(sd, sd.dom[1]);
    var cd = DIM[state.channels.color];
    hitPts.length = 0;
    function radius(r) {
      var n = (tOf(sd, r[sd.id]) - s0) / (s1 - s0);
      return 1.6 + 5.2 * Math.sqrt(clamp(n, 0, 1));
    }
    function plot(rec, ghost) {
      var x = sx(rec[dx.id], dx), y = sy(rec[dy.id], dy);
      if (x < M.l - 14 || x > M.l + PW + 14 || y < M.t - 14 || y > M.t + PH + 14) return;
      var r = radius(rec), sel = state.selection.indexOf(rec.id) >= 0;
      if (ghost) {
        ctx.globalAlpha = 0.08; ctx.fillStyle = '#8b94a7';
      } else {
        ctx.globalAlpha = sel ? 0.98 : 0.55;
        ctx.fillStyle = colorFor(rec, cd);
      }
      ctx.beginPath(); ctx.arc(x, y, ghost ? 1.3 : r, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1;
      if (!ghost && sel) {
        ctx.strokeStyle = SEL_COLOR; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(x, y, r + 2.6, 0, 6.2832); ctx.stroke();
      }
      if (!ghost) hitPts.push({ x: x, y: y, r: r, rec: rec });
    }
    for (i = 0; i < ghostList.length; i++) plot(ghostList[i], true);
    for (i = 0; i < visibleList.length; i++) plot(visibleList[i], false);

    if (hoverRec) {
      var hx = sx(hoverRec[dx.id], dx), hy = sy(hoverRec[dy.id], dy);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(hx, hy, radius(hoverRec) + 4.2, 0, 6.2832); ctx.stroke();
    }
    /* rubber band */
    if (boxSel) {
      ctx.strokeStyle = CH_COLOR.c; ctx.setLineDash([4, 3]);
      ctx.fillStyle = 'rgba(126,231,135,.08)';
      var bx = Math.min(boxSel.x0, boxSel.x1), by = Math.min(boxSel.y0, boxSel.y1);
      var bw = Math.abs(boxSel.x1 - boxSel.x0), bh = Math.abs(boxSel.y1 - boxSel.y0);
      ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
    }
  }

  /* ---------- tooltip ---------- */
  var tip = $('tooltip');
  function showTip(rec, cx, cy) {
    var dx = DIM[state.channels.x], dy = DIM[state.channels.y];
    var cd = DIM[state.channels.color], sd = DIM[state.channels.size];
    tip.textContent = '';
    var name = el('div', 'tt-name', rec.id);
    var sub = el('div', 'tt-sub', rec.sys + ' · ' + rec.constellation + ' · ' + rec.sector);
    tip.appendChild(name); tip.appendChild(sub);
    function row(ch, d, v) {
      var r = el('div', 'tt-row');
      var k = el('span', 'tt-k', CH_NAME[ch]); k.style.background = CH_COLOR[ch];
      var val = el('span', 'tt-v', fmtN(v) + (d.unit ? ' ' + d.unit : ''));
      r.appendChild(k); r.appendChild(el('span', 'tt-dim', d.label)); r.appendChild(val);
      return r;
    }
    tip.appendChild(row('x', dx, rec[dx.id]));
    tip.appendChild(row('y', dy, rec[dy.id]));
    tip.appendChild(row('color', cd, rec[cd.id]));
    tip.appendChild(row('size', sd, rec[sd.id]));
    var extra = el('div', 'tt-extra', '宜居指数 ' + rec.hab + ' · 发现 ' + rec.year + ' · ' + rec.stars + ' 星系统');
    tip.appendChild(extra);
    tip.hidden = false;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(cx + 16, 6, window.innerWidth - tw - 8) + 'px';
    tip.style.top = clamp(cy - th - 10, 6, window.innerHeight - th - 8) + 'px';
  }

  function hitTest(mx, my) {
    var best = null, bd = 1e9;
    for (var i = 0; i < hitPts.length; i++) {
      var p = hitPts[i];
      var d = (p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my);
      var rad = Math.max(9, p.r + 3);
      if (d <= rad * rad && d < bd) { bd = d; best = p; }
    }
    return best ? best.rec : null;
  }

  /* ---------- pointer interactions on canvas ---------- */
  var drag = null; /* {mode:'pan'|'box', sx, sy, moved, k0, tx0, ty0} */
  var wheelTimer = null;

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var k0 = state.k, k1 = clamp(k0 * Math.pow(1.0016, -e.deltaY), 1, 80);
    if (k1 === k0) return;
    state.tx = mx - (mx - state.tx) * (k1 / k0);
    state.ty = my - (my - state.ty) * (k1 / k0);
    state.k = k1;
    draw();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () {
      commit('viewport', '画布', '缩放 ×' + fmtN(state.k) + '（' + projKeyLabel() + '）');
    }, 260);
  }, { passive: false });

  canvas.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    var rect = canvas.getBoundingClientRect();
    drag = {
      mode: e.shiftKey ? 'box' : 'pan',
      sx: e.clientX - rect.left, sy: e.clientY - rect.top,
      moved: false, k0: state.k, tx0: state.tx, ty0: state.ty
    };
    if (drag.mode === 'box') boxSel = { x0: drag.sx, y0: drag.sy, x1: drag.sx, y1: drag.sy };
    e.preventDefault();
  });
  window.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var inside = mx >= M.l && mx <= M.l + PW && my >= M.t && my <= M.t + PH && rect.left >= -1;
    if (drag) {
      var dxp = mx - drag.sx, dyp = my - drag.sy;
      if (Math.abs(dxp) + Math.abs(dyp) > 3) drag.moved = true;
      if (drag.mode === 'pan' && drag.moved) {
        state.tx = drag.tx0 + dxp; state.ty = drag.ty0 + dyp;
        draw();
      } else if (drag.mode === 'box' && drag.moved) {
        boxSel.x1 = mx; boxSel.y1 = my;
        draw();
      }
      return;
    }
    var rec = (inside && e.target === canvas) ? hitTest(mx, my) : null;
    if (rec !== hoverRec) { hoverRec = rec; if (!drag) draw(); }
    if (rec) showTip(rec, e.clientX, e.clientY); else tip.hidden = true;
  });
  window.addEventListener('mouseup', function (e) {
    if (!drag) return;
    var d = drag; drag = null;
    if (d.mode === 'pan') {
      if (d.moved) {
        commit('viewport', '画布', '平移视口 ×' + fmtN(state.k) + '（' + projKeyLabel() + '）');
      } else {
        /* click = toggle selection (cognition anchor: survives re-projection) */
        var rect = canvas.getBoundingClientRect();
        var rec = hitTest(e.clientX - rect.left, e.clientY - rect.top);
        if (rec) {
          var idx = state.selection.indexOf(rec.id), added = idx < 0;
          var n = state.selection.length + (added ? 1 : -1);
          act('selection', '画布', (added ? '选集 + ' : '选集 − ') + rec.id + '（共 ' + n + ' 项）', function (s) {
            if (added) s.selection.push(rec.id); else s.selection.splice(idx, 1);
          });
        }
      }
    } else if (d.mode === 'box') {
      var b = boxSel; boxSel = null;
      if (d.moved && b && Math.abs(b.x1 - b.x0) > 6 && Math.abs(b.y1 - b.y0) > 6) {
        var dx = DIM[state.channels.x], dy = DIM[state.channels.y];
        var xlo = invX(Math.min(b.x0, b.x1), dx), xhi = invX(Math.max(b.x0, b.x1), dx);
        var ylo = invY(Math.max(b.y0, b.y1), dy), yhi = invY(Math.min(b.y0, b.y1), dy);
        act('filter', '画布 · 框选', '框选过滤：' + dx.label + ' ' + fmtN(xlo) + '–' + fmtN(xhi) +
          ' · ' + dy.label + ' ' + fmtN(ylo) + '–' + fmtN(yhi) + (dx.unit ? ' ' + dx.unit : ''), function (s) {
            s.filters[dx.id] = { lo: xlo, hi: xhi };
            s.filters[dy.id] = { lo: ylo, hi: yhi };
          });
      } else draw();
    }
  });
  canvas.addEventListener('mouseleave', function () { hoverRec = null; tip.hidden = true; draw(); });

  /* ---------- channel assignment (dimension rail) ---------- */
  function projKeyLabel() {
    return DIM[state.channels.x].label + '×' + DIM[state.channels.y].label;
  }
  function setChannel(ch, dimId, actor) {
    var d = DIM[dimId];
    if (!d || !channelAllowed(ch, d) || state.channels[ch] === dimId) return;
    var oldKey = projKey();
    var prev = state.channels[ch];
    act('projection', actor, CH_NAME[ch] + ': ' + prevLabel(prev) + ' → ' + d.label, function (s) {
      s.viewports[oldKey] = { k: s.k, tx: s.tx, ty: s.ty };
      s.channels[ch] = dimId;
      if (ch === 'x' || ch === 'y') {
        var saved = s.viewports[s.channels.x + '|' + s.channels.y];
        s.k = saved ? saved.k : 1; s.tx = saved ? saved.tx : 0; s.ty = saved ? saved.ty : 0;
        s.logAxes[ch] = !!d.log;
      }
    });
  }
  function prevLabel(id) { return DIM[id] ? DIM[id].label : id; }

  function cycleChannel(ch, dir, actor) {
    var eligible = D.dimensions.filter(function (d) { return channelAllowed(ch, d); });
    var i = eligible.indexOf(DIM[state.channels[ch]]);
    var next = eligible[(i + dir + eligible.length) % eligible.length];
    setChannel(ch, next.id, actor);
  }

  /* ---------- ledger label helpers for filters ---------- */
  function commitFilter(id, actor, verb) {
    var d = DIM[id];
    if (!setFilterActive(id)) {
      var had = !!state.filters[id];
      delete state.filters[id];
      if (had) commit('filter', actor, '移除过滤器：' + d.label);
      else renderAll(true);
      return;
    }
    commit('filter', actor, (verb ? verb + '：' : '') + filterLabel(id));
  }

  /* ---------- UI: dimension rail ---------- */
  var dimList = $('dim-list');
  function buildRail() {
    dimList.textContent = '';
    $('dim-count').textContent = String(D.dimensions.length);
    D.dimensions.forEach(function (d) {
      var li = el('li', 'dim'); li.id = 'dim-row-' + d.id; li.dataset.dim = d.id;
      var top = el('div', 'dim-top');
      top.appendChild(el('span', 'dim-name', d.label));
      top.appendChild(el('span', 'dim-en', d.en));
      var badge = el('span', 'badge ' + d.type, d.type === 'num' ? '数值' : d.type === 'cat' ? '分类' : '层级');
      top.appendChild(badge);
      li.appendChild(top);
      var chan = el('div', 'chan');
      chan.appendChild(el('span', 'chan-unit', d.unit ? '单位 ' + d.unit : ''));
      ['x', 'y', 'color', 'size'].forEach(function (ch) {
        var b = el('button', 'ch ch-' + ch, CH_LETTER[ch]);
        b.dataset.ch = ch; b.dataset.dim = d.id;
        var ok = channelAllowed(ch, d);
        b.disabled = !ok;
        b.title = ok ? '投影到 ' + CH_NAME[ch] : (d.type === 'num' ? '' : CH_NAME[ch] + ' 通道仅接受数值维度');
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () { setChannel(ch, d.id, '维度轨道'); });
        chan.appendChild(b);
      });
      li.appendChild(chan);
      dimList.appendChild(li);
    });
  }
  function renderRail() {
    var rows = dimList.children, i, j;
    for (i = 0; i < rows.length; i++) {
      var id = rows[i].dataset.dim;
      rows[i].classList.toggle('active-filter-src', setFilterActive(id));
      var btns = rows[i].querySelectorAll('.ch');
      for (j = 0; j < btns.length; j++) {
        var ch = btns[j].dataset.ch;
        var on = state.channels[ch] === id;
        btns[j].classList.toggle('on', on);
        btns[j].classList.toggle(CH_SHORT[ch], on);
        btns[j].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    }
  }

  /* ---------- UI: title / stats / legend ---------- */
  function renderTitle() {
    var t = $('proj-title'); t.textContent = '';
    function ax(ch, cls) {
      var d = DIM[state.channels[ch]];
      var s = el('span', 'ax ' + cls, (ch === 'x' || ch === 'y') ? d.label + (d.unit ? ' ' + d.unit : '') : d.label);
      return s;
    }
    t.appendChild(el('span', 'ax ax-x', 'X ')); t.appendChild(ax('x', 'ax-x'));
    t.appendChild(el('span', null, '  →  '));
    t.appendChild(el('span', 'ax ax-y', 'Y ')); t.appendChild(ax('y', 'ax-y'));
    t.appendChild(el('span', null, '　·　'));
    t.appendChild(el('span', 'ax ax-c', '颜色 = ')); t.appendChild(ax('color', 'ax-c'));
    t.appendChild(el('span', null, '　·　'));
    t.appendChild(el('span', 'ax ax-s', '大小 = ')); t.appendChild(ax('size', 'ax-s'));
    canvas.setAttribute('aria-label', '散点投影画布：X=' + DIM[state.channels.x].label +
      '，Y=' + DIM[state.channels.y].label + '，颜色=' + DIM[state.channels.color].label +
      '，大小=' + DIM[state.channels.size].label);
  }

  function renderStats() {
    $('stat-total').textContent = String(D.meta.total);
    $('stat-visible').textContent = String(visibleList.length);
    $('stat-selected').textContent = String(state.selection.length);
    $('stat-filters').textContent = String(activeFilterCount());
  }

  function renderLegend() {
    var lg = $('legend'); lg.textContent = '';
    var cd = DIM[state.channels.color];
    if (cd.type === 'cat') {
      D.methods.forEach(function (m, i) {
        var n = 0; for (var j = 0; j < visibleList.length; j++) if (visibleList[j].method === m) n++;
        var it = el('span', 'lg-item');
        var sw = el('i', 'lg-sw'); sw.style.background = CAT_COLORS[i % CAT_COLORS.length];
        it.appendChild(sw); it.appendChild(el('span', null, m)); it.appendChild(el('span', 'lg-n', String(n)));
        lg.appendChild(it);
      });
    } else if (cd.type === 'tree') {
      D.sectors.forEach(function (s) {
        var n = 0; for (var j = 0; j < visibleList.length; j++) if (visibleList[j].sectorId === s.id) n++;
        var it = el('span', 'lg-item');
        var sw = el('i', 'lg-sw'); sw.style.background = SECTOR_COLORS[s.id];
        it.appendChild(sw); it.appendChild(el('span', null, s.name)); it.appendChild(el('span', 'lg-n', String(n)));
        lg.appendChild(it);
      });
    } else {
      var it2 = el('span', 'lg-item');
      it2.appendChild(el('span', null, fmtN(cd.dom[0])));
      var bar = el('i', 'lg-bar');
      bar.style.background = 'linear-gradient(90deg,' + GRAD.map(function (c) {
        return 'rgb(' + c.join(',') + ')';
      }).join(',') + ')';
      it2.appendChild(bar);
      it2.appendChild(el('span', null, fmtN(cd.dom[1])));
      it2.appendChild(el('span', null, cd.label + (cd.unit ? ' ' + cd.unit : '')));
      lg.appendChild(it2);
    }
    lg.appendChild(el('i', 'lg-sep'));
    var sd = DIM[state.channels.size];
    var sz = el('span', 'lg-item');
    var d1 = el('i', 'lg-dot'); d1.style.width = '4px'; d1.style.height = '4px';
    var d2 = el('i', 'lg-dot'); d2.style.width = '11px'; d2.style.height = '11px';
    sz.appendChild(d1); sz.appendChild(d2);
    sz.appendChild(el('span', null, sd.label + (sd.unit ? ' ' + sd.unit : '') + ' ' + fmtN(sd.dom[0]) + '–' + fmtN(sd.dom[1])));
    lg.appendChild(sz);
  }

  /* ---------- UI: filters (one dimension editor; chips carry all active filters) ---------- */
  var filterEditor = $('filter-editor');
  var filterSelect = $('filter-dim');
  var editingDim = 'dist';
  var fref = null; /* active editor refs {dim, lo, hi, vlo, vhi, row, clear, checks} */

  function sliderDomain(d) {
    return d.log ? [Math.log10(d.dom[0]), Math.log10(d.dom[1])] : [d.dom[0], d.dom[1]];
  }
  function toSlider(d, v) { return d.log ? Math.log10(Math.max(v, 1e-6)) : v; }
  function fromSlider(d, t) { return d.log ? Math.pow(10, t) : t; }

  function buildFilterUI() {
    D.dimensions.forEach(function (d) {
      var opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.label + '（' + (d.type === 'num' ? '数值' : d.type === 'cat' ? '分类' : '层级') + '）';
      if (d.id === editingDim) opt.selected = true;
      filterSelect.appendChild(opt);
    });
    filterSelect.addEventListener('change', function () {
      editingDim = filterSelect.value;
      buildFilterEditor();
    });
    buildFilterEditor();
  }

  function buildFilterEditor() {
    var d = DIM[editingDim];
    filterEditor.textContent = '';
    var row = el('div', 'f-row'); row.id = 'f-row-' + d.id;
      var head = el('div', 'f-head');
      head.appendChild(el('span', null, d.label));
      if (d.unit) head.appendChild(el('span', 'unit', d.unit));
      var clear = el('button', 'f-clear', '✕');
      clear.title = '移除过滤器'; clear.setAttribute('aria-label', '移除过滤器：' + d.label);
      clear.addEventListener('click', function () {
        act('filter', '检查器 · 过滤器', '移除过滤器：' + d.label, function (s) { delete s.filters[d.id]; });
      });
      head.appendChild(clear);
      row.appendChild(head);
      fref = { dim: d, row: row, clear: clear };

      if (d.type === 'num') {
        var sdom = sliderDomain(d);
        var step = (sdom[1] - sdom[0]) / 400;
        var lo = document.createElement('input'), hi = document.createElement('input');
        lo.type = hi.type = 'range';
        lo.min = hi.min = String(sdom[0]); lo.max = hi.max = String(sdom[1]);
        lo.step = hi.step = String(step);
        lo.setAttribute('aria-label', d.label + ' 下界');
        hi.setAttribute('aria-label', d.label + ' 上界');
        var rowLo = el('div', 'f-slider');
        rowLo.appendChild(el('span', 'fs-k', '下界')); rowLo.appendChild(lo);
        var rowHi = el('div', 'f-slider');
        rowHi.appendChild(el('span', 'fs-k', '上界')); rowHi.appendChild(hi);
        row.appendChild(rowLo); row.appendChild(rowHi);
        var vals = el('div', 'f-vals');
        var vlo = el('span'), vhi = el('span');
        vals.appendChild(vlo); vals.appendChild(vhi);
        row.appendChild(vals);
        function live() {
          var a = fromSlider(d, parseFloat(lo.value)), b = fromSlider(d, parseFloat(hi.value));
          if (a > b) { var t = a; a = b; b = t; }
          state.filters[d.id] = { lo: a, hi: b };
          afterLiveFilter(d);
        }
        lo.addEventListener('input', live);
        hi.addEventListener('input', live);
        lo.addEventListener('change', function () { commitFilter(d.id, '检查器 · 过滤器'); });
        hi.addEventListener('change', function () { commitFilter(d.id, '检查器 · 过滤器'); });
        fref.lo = lo; fref.hi = hi; fref.vlo = vlo; fref.vhi = vhi;
      } else if (d.type === 'cat') {
        var box = el('div', 'f-checks');
        D.methods.forEach(function (m, i) {
          var lab = el('label');
          var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true;
          cb.dataset.val = m;
          cb.addEventListener('change', function () {
            toggleSetVal(d, m, !cb.checked, '检查器 · 过滤器');
          });
          var sw = el('i', 'lg-sw'); sw.style.background = CAT_COLORS[i % CAT_COLORS.length];
          lab.appendChild(cb); lab.appendChild(sw); lab.appendChild(el('span', null, m));
          box.appendChild(lab);
        });
        row.appendChild(box);
        fref.checks = box;
      } else { /* tree */
        var tree = el('div', 'f-tree');
        D.sectors.forEach(function (s) {
          var det = el('details');
          var sum = el('summary');
          var sw = el('i', 'lg-sw'); sw.style.background = SECTOR_COLORS[s.id];
          sum.appendChild(sw); sum.appendChild(el('span', null, s.name));
          sum.appendChild(el('span', 'lg-n', s.consts.length + ' 星座'));
          det.appendChild(sum);
          var kids = el('div', 'tree-kids');
          s.consts.forEach(function (c) {
            var lab = el('label');
            var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = true;
            cb.dataset.val = c[0];
            cb.addEventListener('change', function () {
              toggleSetVal(d, c[0], !cb.checked, '检查器 · 过滤器');
            });
            lab.appendChild(cb); lab.appendChild(el('span', null, c[0]));
            kids.appendChild(lab);
          });
          det.appendChild(kids);
          tree.appendChild(det);
        });
        row.appendChild(tree);
        fref.checks = tree;
      }
      filterEditor.appendChild(row);
    updateFilterRow(d, fref, false);
  }

  function toggleSetVal(d, val, exclude, actor) {
    act('filter', actor, (exclude ? '排除 ' : '恢复 ') + d.label + '：' + val, function (s) {
      var f = s.filters[d.id] || { off: [] };
      f.off = f.off || [];
      var i = f.off.indexOf(val);
      if (exclude && i < 0) f.off.push(val);
      if (!exclude && i >= 0) f.off.splice(i, 1);
      if (!f.off.length) delete s.filters[d.id]; else s.filters[d.id] = f;
    });
  }

  function afterLiveFilter(d) {
    classify(); draw(); renderStats(); renderChips(); renderLegend(); renderEmpty(); renderRail();
    if (fref && fref.dim === d) updateFilterRow(d, fref, true);
  }

  function updateFilterRow(d, ref, skipSliders) {
    var f = state.filters[d.id];
    if (d.type === 'num') {
      var sdom = sliderDomain(d);
      var lo = f ? clamp(toSlider(d, f.lo), sdom[0], sdom[1]) : sdom[0];
      var hi = f ? clamp(toSlider(d, f.hi), sdom[0], sdom[1]) : sdom[1];
      if (!skipSliders) { ref.lo.value = String(lo); ref.hi.value = String(hi); }
      var act2 = rangeFilterActive(d.id);
      ref.vlo.textContent = f ? fmtN(f.lo) : fmtN(d.dom[0]);
      ref.vhi.textContent = f ? fmtN(f.hi) : fmtN(d.dom[1]);
      ref.row.classList.toggle('active', act2);
    } else {
      var off = (f && f.off) || [];
      var cbs = ref.checks.querySelectorAll('input[type=checkbox]');
      for (var i = 0; i < cbs.length; i++) cbs[i].checked = off.indexOf(cbs[i].dataset.val) < 0;
      ref.row.classList.toggle('active', !!(f && f.off && f.off.length));
    }
  }
  function updateFilterControls() {
    if (fref) updateFilterRow(fref.dim, fref, false);
  }

  function renderChips() {
    var box = $('filter-chips'); box.textContent = '';
    var n = 0;
    D.dimensions.forEach(function (d) {
      if (!setFilterActive(d.id)) return;
      n++;
      var chip = el('span', 'chip', filterLabel(d.id));
      var x = el('button', null, '✕');
      x.setAttribute('aria-label', '移除过滤器：' + d.label);
      x.addEventListener('click', function () {
        act('filter', '检查器 · 过滤器', '移除过滤器：' + d.label, function (s) { delete s.filters[d.id]; });
      });
      chip.appendChild(x);
      box.appendChild(chip);
    });
    $('filter-count').textContent = String(n);
    $('btn-clear-filters').hidden = n === 0;
  }

  /* ---------- UI: selection tray ---------- */
  function renderSelection() {
    var ul = $('sel-list'); ul.textContent = '';
    state.selection.forEach(function (id) {
      var li = el('li');
      li.appendChild(el('i', 'sel-dot'));
      li.appendChild(el('span', null, id));
      var x = el('button', 'sel-x', '✕');
      x.setAttribute('aria-label', '从选集移除：' + id);
      x.addEventListener('click', function () {
        var idx = state.selection.indexOf(id);
        act('selection', '检查器 · 选集', '选集 − ' + id + '（共 ' + (state.selection.length - 1) + ' 项）', function (s) {
          s.selection.splice(idx, 1);
        });
      });
      li.appendChild(x);
      ul.appendChild(li);
    });
    $('sel-count').textContent = String(state.selection.length);
    $('btn-clear-selection').hidden = state.selection.length === 0;
    $('sel-hint').hidden = state.selection.length > 0;
  }

  /* ---------- UI: ledger ---------- */
  var KIND_LABEL = {
    projection: '投影', filter: '过滤', selection: '选集',
    viewport: '视口', revert: '回退', reset: '重置'
  };
  function renderLedger() {
    var ol = $('ledger-list'); ol.textContent = '';
    for (var i = history.length - 1; i >= 0; i--) {
      (function (idx) {
        var h = history[idx];
        var li = el('li');
        var btn = el('button', 'l-entry' + (idx === cur ? ' cur' : ''));
        btn.appendChild(el('span', 'l-seq', '#' + h.seq));
        btn.appendChild(el('span', 'l-kind k-' + h.kind, KIND_LABEL[h.kind] || h.kind));
        btn.appendChild(el('span', 'l-label', h.label));
        btn.appendChild(el('span', 'l-revert-hint', idx === cur ? '当前' : '回退到此 ↩'));
        var meta = el('span', 'l-meta');
        meta.appendChild(el('span', 'l-actor', '来源：' + h.actor));
        meta.appendChild(el('span', 'l-time', fmtTime(h.ts)));
        btn.appendChild(meta);
        btn.title = idx === cur ? '当前视图状态' : '回退到此状态（记录为新的台账条目，可重做/再回退）';
        btn.addEventListener('click', function () { revertTo(idx); });
        li.appendChild(btn);
        ol.appendChild(li);
      })(i);
    }
  }

  /* ---------- render orchestration ---------- */
  function renderEmpty() {
    $('empty-note').hidden = visibleList.length > 0;
  }
  function renderAll(updateControls) {
    classify();
    draw();
    renderStats(); renderTitle(); renderLegend(); renderRail();
    renderChips(); renderSelection(); renderLedger(); renderEmpty();
    $('log-x').checked = state.logAxes.x;
    $('log-y').checked = state.logAxes.y;
    $('btn-undo').disabled = cur <= 0;
    $('btn-redo').disabled = cur >= history.length - 1;
    if (updateControls) updateFilterControls();
  }

  /* ---------- global controls ---------- */
  $('btn-undo').addEventListener('click', undo);
  $('btn-redo').addEventListener('click', redo);
  $('btn-empty-undo').addEventListener('click', undo);
  $('btn-reset').addEventListener('click', function () {
    act('reset', '顶栏', '重置视图（初始投影 / 清空过滤与选集）', function (s) {
      var f = freshState();
      s.channels = f.channels; s.logAxes = f.logAxes; s.filters = f.filters;
      s.selection = f.selection; s.viewports = f.viewports;
      s.k = 1; s.tx = 0; s.ty = 0;
    });
  });
  $('btn-clear-filters').addEventListener('click', function () {
    act('filter', '检查器 · 过滤器', '清空全部过滤器（' + activeFilterCount() + ' 项）', function (s) { s.filters = {}; });
  });
  $('btn-clear-selection').addEventListener('click', function () {
    act('selection', '检查器 · 选集', '清空选集（' + state.selection.length + ' 项）', function (s) { s.selection = []; });
  });
  $('btn-fitview').addEventListener('click', function () {
    act('viewport', '画布', '适配视口（×1，' + projKeyLabel() + '）', function (s) {
      s.k = 1; s.tx = 0; s.ty = 0;
      s.viewports[s.channels.x + '|' + s.channels.y] = { k: 1, tx: 0, ty: 0 };
    });
  });
  $('log-x').addEventListener('change', function () {
    var on = $('log-x').checked;
    act('projection', '画布', 'X 轴刻度 → ' + (on ? '对数' : '线性'), function (s) { s.logAxes.x = on; });
  });
  $('log-y').addEventListener('change', function () {
    var on = $('log-y').checked;
    act('projection', '画布', 'Y 轴刻度 → ' + (on ? '对数' : '线性'), function (s) { s.logAxes.y = on; });
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
      return;
    }
    var k = e.key.toLowerCase();
    if (k === 'x') cycleChannel('x', e.shiftKey ? -1 : 1, '键盘');
    else if (k === 'y') cycleChannel('y', e.shiftKey ? -1 : 1, '键盘');
    else if (k === 'c') cycleChannel('color', e.shiftKey ? -1 : 1, '键盘');
    else if (k === 's') cycleChannel('size', e.shiftKey ? -1 : 1, '键盘');
  });

  window.addEventListener('resize', function () { resizeCanvas(); draw(); });

  /* ---------- boot: synchronous, first-paint ready ---------- */
  try {
    buildRail();
    buildFilterUI();
    resizeCanvas();
    /* history[0] = initial ready state (data inlined, no loading state ever shown) */
    commit('reset', '系统', '初始视图（首屏就绪）');
  } catch (err) {
    fatal('初始化失败：' + (err && err.message || err));
  }
})();
