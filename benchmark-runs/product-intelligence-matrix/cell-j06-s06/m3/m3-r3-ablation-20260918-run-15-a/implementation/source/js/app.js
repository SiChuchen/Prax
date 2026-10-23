/* Ledgerline · 渲染与交互（原生 JS + SVG，无外部依赖） */
"use strict";
(function () {
  const $ = s => document.querySelector(s);
  const SVG_NS = "http://www.w3.org/2000/svg";
  const T0 = +new Date(WINDOW.start), T1 = +new Date(WINDOW.end);
  const SPAN = T1 - T0;

  /* ── 索引 ─────────────────────────────────────────── */
  const CH = {};
  CHANGES.forEach(c => { c.ms = +new Date(c.t); c.kids = []; CH[c.id] = c; });
  CHANGES.forEach(c => c.cause.forEach(pid => { if (CH[pid]) CH[pid].kids.push(c.id); }));

  /* ── 时序一致性校验：因果边必须由早指向晚 ──────────── */
  const violations = [];
  let edgeCount = 0;
  CHANGES.forEach(c => c.cause.forEach(pid => {
    edgeCount++;
    if (!CH[pid]) violations.push(c.id + " ← 未知原因 " + pid);
    else if (CH[pid].ms >= c.ms) violations.push(c.id + " ← " + pid + " 时序颠倒");
  }));
  const vb = $("#st-valid");
  if (violations.length) { vb.textContent = "时序校验失败 ×" + violations.length; vb.classList.add("fail"); console.error("[Ledgerline] " + violations.join("; ")); }
  else vb.textContent = "时序校验 " + edgeCount + "/" + edgeCount + " 通过 ✓";
  $("#st-n").textContent = CHANGES.length;
  $("#st-e").textContent = edgeCount;
  $("#hdr-range").textContent = "09-22 08:00 → 09-23 20:00 · 36h · " + COMPONENTS.length + " 组件";

  /* ── 全局状态 ─────────────────────────────────────── */
  /* 默认聚焦首日的密集变更窗口；全窗可用 ⤢ 按钮或滚轮缩小取回 */
  const view = { x0: +new Date("2026-09-22T08:00:00+08:00"), x1: +new Date("2026-09-22T22:00:00+08:00") };
  const S = { t: CH["c05"].ms, playing: false, speed: 1, sel: "c05", hidden: new Set() };
  let curChain = { has: false, anc: new Set(), desc: new Set() };

  try {
    const q = new URLSearchParams(location.search);
    if (q.get("sel") && CH[q.get("sel")]) S.sel = q.get("sel");
    if (q.has("t")) S.t = T0 + Math.min(SPAN, Math.max(0, parseFloat(q.get("t")) * 3600e3));
    else if (q.get("sel")) S.t = CH[S.sel].ms;
    const ph = q.get("phase") && PHASES.find(p => p.id === q.get("phase"));
    if (ph) { view.x0 = +new Date(ph.start); view.x1 = +new Date(ph.end); }
  } catch (e) { /* 静态打开时容错 */ }

  /* ── 工具 ─────────────────────────────────────────── */
  const pad2 = n => String(n).padStart(2, "0");
  const fmtMDHM = ms => { const d = new Date(ms); return pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
  const fmtHM = ms => { const d = new Date(ms); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };
  const fmtSpan = (a, b) => { const da = new Date(a), db = new Date(b); const same = da.getDate() === db.getDate() && da.getMonth() === db.getMonth(); return (same ? "" : pad2(da.getDate()) + " ") + pad2(da.getHours()) + ":" + pad2(da.getMinutes()) + "–" + (same ? "" : pad2(db.getDate()) + " ") + pad2(db.getHours()) + ":" + pad2(db.getMinutes()); };

  function el(name, attrs, parent) { const n = document.createElementNS(SVG_NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function html(tag, cls, parent, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; if (parent) parent.appendChild(n); return n; }

  function hexPath(cx, cy, r) { let d = ""; for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 6; d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(1) + " " + (cy + r * Math.sin(a)).toFixed(1) + " "; } return d + "Z"; }
  function shapeEl(type, cx, cy, r, parent) {
    let n;
    switch (TYPES[type].shape) {
      case "square": n = el("rect", { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 2, fill: TYPES[type].color }, parent); break;
      case "circle": n = el("circle", { cx, cy, r, fill: TYPES[type].color }, parent); break;
      case "diamond": n = el("rect", { x: cx - r * .88, y: cy - r * .88, width: 1.76 * r, height: 1.76 * r, rx: 1.5, fill: TYPES[type].color, transform: "rotate(45 " + cx + " " + cy + ")" }, parent); break;
      case "triangle": n = el("path", { d: "M " + cx + " " + (cy - r * 1.15) + " L " + (cx + r * 1.1) + " " + (cy + r * .8) + " L " + (cx - r * 1.1) + " " + (cy + r * .8) + " Z", fill: TYPES[type].color }, parent); break;
      default: n = el("path", { d: hexPath(cx, cy, r * 1.06), fill: TYPES[type].color }, parent);
    }
    n.classList.add("shape");
    return n;
  }

  /* ── 侧栏 ─────────────────────────────────────────── */
  const SW_CSS = { square: "border-radius:2px", circle: "border-radius:50%", diamond: "transform:rotate(45deg) scale(.82)", triangle: "clip-path:polygon(50% 0,100% 100%,0 100%)", hex: "clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)" };
  function buildLegend() {
    const box = $("#legend");
    Object.keys(TYPES).forEach(k => {
      const tp = TYPES[k];
      const n = html("div", "legend-item", box);
      const sw = html("span", "sw", n); sw.style.background = tp.color; sw.style.cssText += ";" + SW_CSS[tp.shape];
      html("span", "lb", n, tp.label);
      html("span", "n", n, CHANGES.filter(c => c.ty === k).length);
      n.onclick = () => { if (S.hidden.has(k)) S.hidden.delete(k); else S.hidden.add(k); n.classList.toggle("off", S.hidden.has(k)); drawTimeline(); };
    });
  }
  function buildPhaseList() {
    const box = $("#phase-list");
    PHASES.forEach(p => {
      const n = html("div", "phase-item", box);
      html("span", "dot", n).style.background = p.color;
      html("span", null, n, p.label);
      html("span", "tm", n, fmtSpan(+new Date(p.start), +new Date(p.end)));
      n.onclick = () => { view.x0 = +new Date(p.start); view.x1 = +new Date(p.end); drawAll(); };
    });
  }

  /* ── 时间轴 ───────────────────────────────────────── */
  const svg = $("#timeline");
  const PADL = 8, TOPH = 24, BOTH = 28, LBLW = 86;
  let TW = 800, TH = 420;

  const xOf = ms => LBLW + (ms - view.x0) / (view.x1 - view.x0) * (TW - LBLW - PADL);
  const tOf = x => view.x0 + (x - LBLW) / (TW - LBLW - PADL) * (view.x1 - view.x0);
  const laneH = () => (TH - TOPH - BOTH) / COMPONENTS.length;
  const laneY = i => TOPH + (i + .5) * laneH();

  function tickStep(spanH) { const steps = [0.25, 0.5, 1, 2, 3, 6, 12, 24]; for (const s of steps) if (spanH / s <= 11) return s; return 24; }

  function drawTimeline() {
    svg.innerHTML = "";
    svg.setAttribute("width", TW); svg.setAttribute("height", TH);
    const yBot = TH - BOTH, yAxis = yBot + 8;

    /* 阶段带 */
    PHASES.forEach((p, i) => {
      const a = Math.max(+new Date(p.start), view.x0), b = Math.min(+new Date(p.end), view.x1);
      if (b <= a) return;
      const x0 = xOf(a), x1 = xOf(b);
      el("rect", { x: x0, y: TOPH, width: x1 - x0, height: yBot - TOPH, class: "phase-band" + (i % 2 ? " alt" : "") }, svg);
      const lw = p.label.length * 11 + 8;
      let lx = null, anchor = null;
      if (x1 - x0 > lw) { lx = Math.min(Math.max((x0 + x1) / 2, x0 + lw / 2 + 4), x1 - lw / 2 - 4); anchor = "middle"; }
      else if (x1 - x0 >= 34) { lx = Math.max(x0 + 4, LBLW + 6); anchor = null; }
      if (lx != null) {
        const t = el("text", { x: lx, y: 15, class: "phase-label", "text-anchor": anchor }, svg); t.textContent = p.label;
        t.style.fill = p.color; t.style.opacity = .8;
      }
    });
    PHASES.forEach(p => {
      const x = xOf(+new Date(p.start));
      if (x > LBLW + 1 && x < TW - PADL) el("line", { x1: x, y1: TOPH, x2: x, y2: yBot, class: "phase-sep", "stroke-dasharray": "2 3" }, svg);
    });

    /* 泳道 */
    COMPONENTS.forEach((cp, i) => {
      if (i) el("line", { x1: 0, y1: TOPH + i * laneH(), x2: TW, y2: TOPH + i * laneH(), class: "lane-sep" }, svg);
      const t = el("text", { x: PADL, y: laneY(i) + 4, class: "lane-label" }, svg); t.textContent = COMPONENT_LABELS[cp];
    });

    /* 时间轴刻度 */
    el("line", { x1: 0, y1: yAxis, x2: TW, y2: yAxis, class: "axis-line" }, svg);
    const spanH = (view.x1 - view.x0) / 3600e3, step = tickStep(spanH), stepMs = step * 3600e3;
    const first = Math.ceil((view.x0 - T0) / stepMs) * stepMs + T0;
    for (let ms = first; ms <= view.x1; ms += stepMs) {
      const x = xOf(ms);
      el("line", { x1: x, y1: yAxis - 4, x2: x, y2: yAxis + 4, class: "tick" }, svg);
      const t = el("text", { x, y: yAxis + 18, "text-anchor": "middle", class: "tick-l" }, svg);
      const d = new Date(ms);
      t.textContent = (d.getHours() === 0 && d.getMinutes() === 0) ? fmtMDHM(ms) : fmtHM(ms);
      if (step >= 3) for (let k = 1; k < step; k++) {
        const xm = xOf(ms + k * 3600e3);
        if (xm < TW - PADL) el("line", { x1: xm, y1: yAxis - 2, x2: xm, y2: yAxis + 2, class: "tick minor" }, svg);
      }
    }

    /* 因果边：恒由早指向晚 */
    CHANGES.forEach(c => {
      if (S.hidden.has(c.ty)) return;
      c.cause.forEach(pid => {
        const p = CH[pid];
        if (!p || S.hidden.has(p.ty)) return;
        const x1 = xOf(p.ms), y1 = laneY(COMPONENTS.indexOf(p.cp));
        const x2 = xOf(c.ms), y2 = laneY(COMPONENTS.indexOf(c.cp));
        if (x2 < -20 || x1 > TW + 20) return;
        const dx = Math.max(24, x2 - x1);
        const bow = Math.min(18, 6 + Math.abs(y2 - y1) * .12) * (y2 >= y1 ? 1 : -1);
        const inSet = id => id === S.sel || curChain.anc.has(id) || curChain.desc.has(id);
        const inH = curChain.has && inSet(pid) && inSet(c.id);
        const d = "M " + x1 + " " + y1 + " C " + (x1 + dx * .38) + " " + (y1 + bow) + ", " + (x2 - dx * .38) + " " + (y2 + bow) + ", " + x2 + " " + y2;
        const path = el("path", { d, class: "link" + (inH ? " hl" : curChain.has ? " dim" : "") }, svg);
        if (inH) el("path", { d, fill: "none", stroke: "var(--accent)", "stroke-width": 1, "marker-end": "url(#arrow)", opacity: .9 }, svg);
      });
    });
    /* 箭头 marker（defs 每次重建） */
    const defs = el("defs", {}, svg);
    const mk = el("marker", { id: "arrow", viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "var(--accent)" }, mk);

    /* 节点 */
    CHANGES.forEach(c => {
      if (S.hidden.has(c.ty)) return;
      const x = xOf(c.ms), y = laneY(COMPONENTS.indexOf(c.cp));
      if (x < -12 || x > TW + 12) return;
      const g = el("g", { class: "node" + (c.id === S.sel ? " sel" : curChain.has && !curChain.anc.has(c.id) && !curChain.desc.has(c.id) && c.id !== S.sel ? " dim" : "") }, svg);
      g.dataset.id = c.id;
      shapeEl(c.ty, x, y, c.ty === "alert" ? 6 : 5.5, g);
      el("rect", { x: x - 9, y: y - 9, width: 18, height: 18, fill: "transparent" }, g);
      g.addEventListener("click", ev => { ev.stopPropagation(); select(c.id); });
      g.addEventListener("mouseenter", () => showTip(c));
      g.addEventListener("mousemove", ev => moveTip(ev));
      g.addEventListener("mouseleave", hideTip);
    });

    /* 回放游标（芯片置于底部刻度带，避让阶段标签） */
    const cx = xOf(S.t);
    if (cx >= LBLW - 2 && cx <= TW - PADL + 2) {
      el("line", { x1: cx, y1: TOPH - 2, x2: cx, y2: yBot + 8, class: "cursor-line" }, svg);
      const w = 82, chx = Math.min(Math.max(cx - w / 2, LBLW), TW - PADL - w);
      el("rect", { x: chx, y: yBot + 1, width: w, height: 15, rx: 4, class: "cursor-chip-r" }, svg);
      const t = el("text", { x: chx + w / 2, y: yBot + 12, "text-anchor": "middle", class: "cursor-chip-t" }, svg);
      t.textContent = fmtMDHM(S.t);
    }
  }

  /* ── 因果链 ───────────────────────────────────────── */
  function chainOf(id) {
    const anc = new Set(), desc = new Set();
    (function up(x) { CH[x].cause.forEach(p => { if (CH[p] && !anc.has(p)) { anc.add(p); up(p); } }); })(id);
    (function dn(x) { CH[x].kids.forEach(k => { if (!desc.has(k)) { desc.add(k); dn(k); } }); })(id);
    return { anc, desc };
  }
  function select(id) {
    S.sel = id;
    curChain = chainOf(id); curChain.has = curChain.anc.size + curChain.desc.size > 0;
    drawTimeline(); renderDetail(id);
  }

  /* ── 详情卡 ───────────────────────────────────────── */
  function chainItem(parent, id) {
    const c = CH[id], tp = TYPES[c.ty];
    const n = html("div", "chain-item", parent);
    html("span", "sw", n).style.cssText = "background:" + tp.color + ";" + SW_CSS[tp.shape];
    html("span", "tm", n, fmtHM(c.ms));
    html("span", "lb", n, c.title);
    n.onclick = () => select(id);
    return n;
  }
  function renderDetail(id) {
    const c = CH[id], tp = TYPES[c.ty];
    $("#d-id").textContent = c.id.toUpperCase();
    const box = $("#detail"); box.innerHTML = "";
    const head = html("div", "d-head", box);
    const chip = html("span", "type-chip", head, tp.label);
    chip.style.cssText = "color:" + tp.color + ";border-color:" + tp.color;
    html("span", "dimtx", head, COMPONENT_LABELS[c.cp]);
    html("div", "d-title", box, c.title);
    const rows = html("div", "d-rows", box);
    html("span", null, rows, "时刻"); html("span", "v", rows, fmtMDHM(c.ms));
    html("span", null, rows, "执行者"); html("span", "v", rows, c.by || "—");
    html("span", null, rows, "因果度"); html("span", "v", rows, "上游 " + c.cause.length + " · 下游 " + c.kids.length);
    if (c.pl) {
      const p = html("div", "payload", box);
      html("span", "lb", p, c.pl.lb);
      html("span", "from", p, c.pl.from);
      html("span", "arr", p, "→");
      html("span", "to", p, c.pl.to);
    }
    if (c.note) html("div", "d-note", box, c.note);
    html("div", "sec-h", box, "◀ 因 · 直接上游（" + c.cause.length + "）");
    if (c.cause.length) { const cl = html("div", "chain", box); c.cause.forEach(pid => chainItem(cl, pid)); }
    else html("div", "chain-empty", box, "无 —— 根因 / 计划内变更");
    html("div", "sec-h", box, "▶ 果 · 直接下游（" + c.kids.length + "）");
    if (c.kids.length) { const cl = html("div", "chain", box); c.kids.forEach(kid => chainItem(cl, kid)); }
    else html("div", "chain-empty", box, "无下游");
  }

  /* ── 时刻状态 ─────────────────────────────────────── */
  function renderState() {
    const t = S.t, kv = {};
    CHANGES.forEach(c => { if (c.ms <= t && c.st) c.st.forEach(a => { kv[a[0]] = { v: a[1], w: !!a[2] }; }); });
    const box = $("#state-kv"); box.innerHTML = "";
    let any = false;
    STATE_ORDER.forEach(k => {
      if (!kv[k]) return; any = true;
      const row = html("div", "kv", box);
      html("span", "k", row, k);
      html("span", "v" + (kv[k].w ? " warn" : ""), row, kv[k].v);
    });
    if (!any) html("div", "no-alert", box, "窗口尚未开始");
    const ph = PHASES.find(p => t >= +new Date(p.start) && t < +new Date(p.end));
    const pe = $("#state-phase"); pe.textContent = ph ? ph.label : "间隙期";
    pe.style.color = ph ? ph.color : "var(--muted)";
    const act = CHANGES.filter(c => c.alert && c.ms <= t && t < +new Date(c.alert.until));
    $("#alert-count").textContent = act.length ? act.length + " 激活" : "";
    const ab = $("#state-alerts"); ab.innerHTML = "";
    if (!act.length) html("div", "no-alert", ab, "无激活告警");
    act.forEach(c => {
      const r = html("div", "alert-row", ab);
      html("span", "alert-dot", r).style.background = TYPES.alert.color;
      html("span", "lb", r, "[" + c.alert.sev + "] " + c.cp + " · " + c.title);
      html("span", "tm", r, fmtHM(c.ms));
      r.onclick = () => select(c.id);
    });
  }

  /* ── 指标小倍数 ───────────────────────────────────── */
  const mrefs = [];
  function buildMetrics() {
    const strip = $("#metrics");
    METRICS.forEach(m => {
      const p = html("section", "mpanel", strip);
      const h = html("h3", null, p);
      html("span", null, h, m.label);
      const v = html("span", "mval", h, "–"); v.id = "mv-" + m.key;
      const sm = el("svg", {}, p);
      mrefs.push({ m, p, sm });
      p.addEventListener("pointerdown", ev => { scrubMetrics(ev); p.setPointerCapture(ev.pointerId); p.onpointermove = scrubMetrics; });
      p.addEventListener("pointerup", ev => { p.onpointermove = null; });
      p.addEventListener("wheel", ev => zoomPan(ev, (ev.clientX - p.getBoundingClientRect().left) / Math.max(1, p.clientWidth)), { passive: false });
    });
  }
  function interp(pts, h) {
    if (h <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (h <= pts[i][0]) {
      const [h0, v0] = pts[i - 1], [h1, v1] = pts[i];
      return v0 + (v1 - v0) * (h - h0) / (h1 - h0);
    }
    return pts[pts.length - 1][1];
  }
  const hoursOf = ms => (ms - T0) / 3600e3;
  function drawMetrics() {
    mrefs.forEach(({ m, sm }) => {
      const W = sm.parentElement.clientWidth, H = sm.parentElement.clientHeight - 22;
      if (W < 40) return;
      sm.setAttribute("width", W); sm.setAttribute("height", H); sm.innerHTML = "";
      const y = v => 6 + (1 - (v - m.domain[0]) / (m.domain[1] - m.domain[0])) * (H - 20);
      const x = ms => (ms - view.x0) / (view.x1 - view.x0) * W;
      [0, .5, 1].forEach(f => el("line", { x1: 0, y1: 6 + f * (H - 20), x2: W, y2: 6 + f * (H - 20), class: f === 1 ? "base-l" : "grid-l" }, sm));
      let dLine = "", dArea = "", started = false;
      const N = 160;
      for (let i = 0; i <= N; i++) {
        const ms = view.x0 + (view.x1 - view.x0) * i / N;
        const v = Math.max(m.domain[0], Math.min(m.domain[1], interp(m.pts, hoursOf(ms))));
        const px = x(ms).toFixed(1), py = y(v).toFixed(1);
        dLine += (started ? "L" : "M") + px + " " + py + " "; started = true;
      }
      dArea = dLine + "L " + W + " " + (H - 14) + " L 0 " + (H - 14) + " Z";
      el("path", { d: dArea, fill: m.color, class: "sarea" }, sm);
      el("path", { d: dLine, class: "sline", stroke: m.color }, sm);
      const cx = x(S.t);
      if (cx >= 0 && cx <= W) {
        el("line", { x1: cx, y1: 2, x2: cx, y2: H - 14, class: "cursor-line" }, sm);
        const v = Math.max(m.domain[0], Math.min(m.domain[1], interp(m.pts, hoursOf(S.t))));
        el("circle", { cx, cy: y(v), r: 4, fill: m.color, class: "mdot" }, sm);
        const lb = el("text", { x: Math.min(cx + 7, W - 52), y: y(v) - 6, class: "mval-t" }, sm);
        lb.textContent = m.fmt(v);
      }
      const mv = $("#mv-" + m.key);
      if (mv) {
        const v = Math.max(m.domain[0], Math.min(m.domain[1], interp(m.pts, hoursOf(S.t))));
        mv.textContent = m.fmt(v);
        mv.classList.toggle("warn", m.warn(v));
      }
    });
  }

  /* ── 交互：游标 / 缩放 / 播放 ──────────────────────── */
  const tip = $("#tooltip");
  let tipFor = null;
  function showTip(c) { tipFor = c; tip.innerHTML = '<div class="tt-t">' + fmtMDHM(c.ms) + " · " + TYPES[c.ty].label + " · " + COMPONENT_LABELS[c.cp] + '</div>' + c.title; tip.style.opacity = 1; }
  function moveTip(ev) { if (!tipFor) return; const W = 300; tip.style.left = Math.min(ev.clientX + 14, innerWidth - W) + "px"; tip.style.top = Math.min(ev.clientY + 12, innerHeight - 70) + "px"; }
  function hideTip() { tipFor = null; tip.style.opacity = 0; }

  function scrub(ev) { const r = svg.getBoundingClientRect(); S.t = Math.min(view.x1, Math.max(view.x0, tOf(ev.clientX - r.left))); update(); }
  function scrubMetrics(ev) { const p = ev.currentTarget; const f = (ev.clientX - p.getBoundingClientRect().left) / Math.max(1, p.clientWidth); S.t = view.x0 + Math.min(1, Math.max(0, f)) * (view.x1 - view.x0); update(); }

  svg.addEventListener("pointerdown", ev => { if (ev.target.closest("g.node")) return; svg.setPointerCapture(ev.pointerId); svg.onpointermove = scrub; scrub(ev); });
  svg.addEventListener("pointerup", () => { svg.onpointermove = null; });
  svg.addEventListener("wheel", ev => zoomPan(ev, (ev.clientX - svg.getBoundingClientRect().left) / Math.max(1, TW)), { passive: false });

  function zoomPan(ev, frac) {
    ev.preventDefault();
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
      const sh = (ev.deltaX > 0 ? 1 : -1) * (view.x1 - view.x0) * .12;
      view.x0 += sh; view.x1 += sh;
    } else {
      const anchor = view.x0 + Math.min(1, Math.max(0, frac)) * (view.x1 - view.x0);
      const k = ev.deltaY > 0 ? 1.25 : .8;
      let span = Math.min(SPAN, Math.max(.5 * 3600e3, (view.x1 - view.x0) * k));
      view.x0 = anchor - (anchor - view.x0) * span / (view.x1 - view.x0);
      view.x1 = view.x0 + span;
    }
    const vw = view.x1 - view.x0;
    if (view.x0 < T0) { view.x0 = T0; view.x1 = T0 + vw; }
    if (view.x1 > T1) { view.x1 = T1; view.x0 = T1 - vw; }
    drawAll();
  }
  $("#btn-fit").onclick = () => { view.x0 = T0; view.x1 = T1; drawAll(); };

  let raf = 0, last = 0;
  function frame(ts) {
    if (!S.playing) return;
    if (last) S.t += (ts - last) / 24000 * SPAN * S.speed;
    last = ts;
    if (S.t >= T1) { S.t = T1; setPlaying(false); }
    const x = xOf(S.t), vw = view.x1 - view.x0;
    if (x < LBLW || x > TW - PADL) {
      view.x0 = Math.max(T0, Math.min(T1 - vw, S.t - vw * .35));
      view.x1 = view.x0 + vw;
      if (view.x1 > T1) { view.x1 = T1; view.x0 = T1 - vw; }
    }
    update();
    raf = requestAnimationFrame(frame);
  }
  function setPlaying(on) {
    S.playing = on; last = 0;
    $("#btn-play").textContent = on ? "❚❚" : "▶";
    if (on) { if (S.t >= T1) S.t = T0; raf = requestAnimationFrame(frame); }
    else cancelAnimationFrame(raf);
  }
  $("#btn-play").onclick = () => setPlaying(!S.playing);
  $("#speed").onchange = ev => { S.speed = parseFloat(ev.target.value); };
  document.addEventListener("keydown", ev => {
    if (ev.target.tagName === "SELECT" || ev.target.tagName === "INPUT") return;
    if (ev.code === "Space") { ev.preventDefault(); setPlaying(!S.playing); }
    if (ev.code === "ArrowRight" || ev.code === "ArrowLeft") {
      ev.preventDefault();
      const times = CHANGES.map(c => c.ms);
      const nxt = ev.code === "ArrowRight" ? times.find(t => t > S.t) : [...times].reverse().find(t => t < S.t);
      if (nxt) { S.t = nxt; update(); }
    }
  });

  /* ── 装配 ─────────────────────────────────────────── */
  function resize() {
    const r = svg.parentElement.getBoundingClientRect();
    TW = Math.max(400, Math.round(r.width)); TH = Math.max(300, Math.round(r.height));
  }
  function drawAll() { drawTimeline(); drawMetrics(); }
  function update() { $("#clock").textContent = fmtMDHM(S.t); drawTimeline(); renderState(); drawMetrics(); }

  buildLegend(); buildPhaseList(); buildMetrics();
  window.addEventListener("resize", () => { resize(); drawAll(); });
  resize();
  $("#clock").textContent = fmtMDHM(S.t);
  select(S.sel);
  renderState();
  drawAll();
})();
