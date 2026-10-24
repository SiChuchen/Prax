/* app.js — Lenscope 多维透镜
   核心不变量（H-21 Orientation Invariants）：
   选区 / 过滤器 / 锚定记录 / 状态日志 / 足迹 存储在透镜状态之外；
   切换透镜只修改投影映射（lens + 排序跟随），其余认知状态一律不动。
   每个过滤/投影动作都会在状态日志中留下一条具名条目（归属），
   任何条目可一键恢复（可回退）；undo/redo 与日志共用同一个栈。 */
(function () {
  "use strict";

  const { dims, records, stats, size } = window.APP_DATA;
  const DIM = {};
  dims.forEach(d => { DIM[d.id] = d; });

  const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"]; // 已验证 all-pairs 的前三个槽位
  const CAT_COLORS = {
    band: { "成熟": SERIES[0], "新兴": SERIES[1], "边境": SERIES[2] },
    coastal: { "沿海": SERIES[0], "内陆": SERIES[1], "岛屿": SERIES[2] },
  };
  const COLORABLE = Object.keys(CAT_COLORS);
  const MAX_JOURNAL = 80;

  const $ = (id) => document.getElementById(id);

  // ── 状态（唯一事实来源）──────────────────────────────────────────────
  const state = {
    lens: "population",       // 投影透镜（活动维度）
    companion: "happiness",   // Y 轴
    colorBy: "band",          // 着色维度
    filters: [],              // [{kind:'cat',dim,values[]}|{kind:'range',dim,min,max}]
    search: "",
    sortDim: "population", sortDir: -1,
    selection: new Set(),     // 认知状态：跨透镜切换保持
    anchor: null,             // 认知状态：跨透镜切换保持
    expanded: new Set(),      // 仅 UI：rail 展开的筛选面板
    trail: ["population"],    // 认知状态：最近浏览的透镜
  };

  // ── 状态日志（归属 + 可回退）────────────────────────────────────────
  const journal = { entries: [], pointer: -1, seq: 0, folded: 0 };

  function snapshot() {
    return {
      lens: state.lens, companion: state.companion, colorBy: state.colorBy,
      filters: state.filters.map(f => Object.assign({}, f, { values: f.values ? f.values.slice() : undefined })),
      search: state.search,
      sortDim: state.sortDim, sortDir: state.sortDir,
      selection: Array.from(state.selection),
      anchor: state.anchor,
    };
  }

  function journalPush(label) {
    // 新动作落在指针位置之后 —— 丢弃被放弃的前向分支
    journal.entries = journal.entries.slice(0, journal.pointer + 1);
    journal.seq += 1;
    const snap = snapshot();
    journal.entries.push({
      seq: journal.seq, label, ts: new Date(),
      snap, visible: records.filter(r => passFilter(r, snap.filters, snap.search)).length,
      selected: snap.selection.length,
    });
    if (journal.entries.length > MAX_JOURNAL) { journal.entries.shift(); journal.folded += 1; }
    journal.pointer = journal.entries.length - 1;
  }

  function applySnap(snap) {
    state.lens = snap.lens; state.companion = snap.companion; state.colorBy = snap.colorBy;
    state.filters = snap.filters.map(f => Object.assign({}, f, { values: f.values ? f.values.slice() : undefined }));
    state.search = snap.search;
    state.sortDim = snap.sortDim; state.sortDir = snap.sortDir;
    state.selection = new Set(snap.selection);
    state.anchor = snap.anchor;
    if (state.trail.indexOf(state.lens) < 0) state.trail.unshift(state.lens);
    if (state.trail.length > 10) state.trail.length = 10;
  }

  function undo() { if (journal.pointer > 0) { journal.pointer -= 1; applySnap(journal.entries[journal.pointer].snap); renderAll(); } }
  function redo() { if (journal.pointer < journal.entries.length - 1) { journal.pointer += 1; applySnap(journal.entries[journal.pointer].snap); renderAll(); } }
  function restoreAt(i) { if (i >= 0 && i < journal.entries.length) { journal.pointer = i; applySnap(journal.entries[i].snap); renderAll(); } }

  // ── 过滤求值 ────────────────────────────────────────────────────────
  function passFilter(r, filters, search) {
    if (search) { const q = search.toLowerCase(); if (r.name.toLowerCase().indexOf(q) < 0) return false; }
    for (const f of filters) {
      if (f.kind === "cat") { if (f.values.indexOf(r[f.dim]) < 0) return false; }
      else if (f.kind === "range") {
        const v = r[f.dim];
        if (f.min != null && v < f.min) return false;
        if (f.max != null && v > f.max) return false;
      }
    }
    return true;
  }

  function visibleRecords() { return records.filter(r => passFilter(r, state.filters, state.search)); }

  // ── 工具 ────────────────────────────────────────────────────────────
  function fmtVal(dim, v) {
    if (v == null) return "–";
    if (dim.type === "cat") return v;
    if (dim.fmt === "fix1") return v.toFixed(1);
    return Math.round(v).toLocaleString("en-US");
  }
  function median(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function niceTicks(min, max, n) {
    const span = max - min || 1;
    const step0 = span / n;
    const mag = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10));
    const norm = step0 / mag;
    const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
    const out = [];
    for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(t);
    return out;
  }
  function hashJitter(seed) { // 稳定伪随机 ∈ [-0.5, 0.5]
    let h = (seed * 2654435761) % 1000;
    h = (h ^ (h >> 3)) % 1000;
    return ((h < 0 ? h + 1000 : h) / 1000) - 0.5;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ── 动作（每个过滤/投影动作 = 一条具名日志）─────────────────────────
  function actionSetLens(dimId, via) {
    if (state.lens === dimId) return;
    state.lens = dimId;
    state.sortDim = dimId; state.sortDir = -1; // 排序跟随透镜
    if (state.trail.indexOf(dimId) < 0) state.trail.unshift(dimId);
    if (state.trail.length > 10) state.trail.length = 10;
    journalPush((via ? via + " · " : "") + "透镜 → " + DIM[dimId].name + "（排序跟随）");
    renderAll();
  }
  function actionSetCompanion(dimId) {
    if (state.companion === dimId) return;
    state.companion = dimId;
    journalPush("对比轴 → " + DIM[dimId].name);
    renderAll();
  }
  function actionSetColorBy(dimId) {
    if (state.colorBy === dimId) return;
    state.colorBy = dimId;
    journalPush("着色 → " + DIM[dimId].name);
    renderAll();
  }
  function actionToggleCat(dimId, value) {
    let f = state.filters.find(x => x.kind === "cat" && x.dim === dimId);
    let label;
    if (!f) {
      f = { kind: "cat", dim: dimId, values: [value] };
      state.filters.push(f);
      label = "筛选 " + DIM[dimId].name + " ⊇ {" + value + "}";
    } else {
      const i = f.values.indexOf(value);
      if (i >= 0) {
        f.values.splice(i, 1);
        if (!f.values.length) state.filters = state.filters.filter(x => x !== f);
        label = "移除筛选 " + DIM[dimId].name + " ∌ {" + value + "}";
      } else {
        f.values.push(value);
        label = "筛选 " + DIM[dimId].name + " ⊇ {" + f.values.join(", ") + "}";
      }
    }
    journalPush(label);
    renderAll();
  }
  function actionSetRange(dimId, min, max) {
    const prev = state.filters.find(f => f.kind === "range" && f.dim === dimId);
    if (prev && prev.min === min && prev.max === max) return; // 重复应用同一范围：无状态变化，不入日志
    if (!prev && min == null && max == null) return; // 空应用且本无过滤器：无状态变化，不入日志
    state.filters = state.filters.filter(f => !(f.kind === "range" && f.dim === dimId));
    let label = "移除筛选 " + DIM[dimId].name;
    if (min != null || max != null) {
      state.filters.push({ kind: "range", dim: dimId, min, max });
      const d = DIM[dimId];
      label = "筛选 " + d.name + " " + (min != null ? fmtVal(d, min) : "−∞") + " – " + (max != null ? fmtVal(d, max) : "+∞") + (d.unit ? " " + d.unit : "");
    }
    journalPush(label);
    renderAll();
  }
  function actionSearch(q) {
    q = (q || "").trim();
    if (q === state.search) return;
    const had = !!state.search;
    state.search = q;
    journalPush(q ? "搜索 “" + q + "”" : (had ? "清除搜索" : "搜索（空）"));
    renderAll();
  }
  function actionClearFilters() {
    const n = state.filters.length + (state.search ? 1 : 0);
    if (!n) return;
    state.filters = []; state.search = "";
    journalPush("清除全部过滤器（" + n + " 项）");
    renderAll();
  }
  function actionSort(dimId) {
    if (state.sortDim === dimId) state.sortDir = -state.sortDir;
    else { state.sortDim = dimId; state.sortDir = -1; }
    const d = DIM[dimId];
    journalPush("排序 → " + (d ? d.name : "城市名") + (state.sortDir > 0 ? " ↑" : " ↓"));
    renderAll();
  }
  function actionToggleSelect(id) {
    if (state.selection.has(id)) state.selection.delete(id); else state.selection.add(id);
    renderCounts(); renderTable(); renderStage(); renderInspector();
  }
  function actionClearSelection() { state.selection.clear(); renderCounts(); renderTable(); renderStage(); renderInspector(); }
  function actionToggleAnchor(id) {
    state.anchor = state.anchor === id ? null : id;
    renderTable(); renderStage(); renderInspector();
  }

  // ── 渲染 ────────────────────────────────────────────────────────────
  function renderAll() {
    renderCounts(); renderChips(); renderRail(); renderStage(); renderTable(); renderInspector(); renderJournal(); renderUndoRedo();
  }

  function renderCounts() {
    $("count-total").textContent = size.toLocaleString("en-US");
    $("count-visible").textContent = visibleRecords().length.toLocaleString("en-US");
    $("count-selected").textContent = state.selection.size.toLocaleString("en-US");
  }

  function renderUndoRedo() {
    $("btn-undo").disabled = journal.pointer <= 0;
    $("btn-redo").disabled = journal.pointer >= journal.entries.length - 1;
  }

  function chipLabel(f) {
    const d = DIM[f.dim];
    if (f.kind === "cat") return d.name + ": " + f.values.join("、");
    if (f.kind === "range") {
      return d.name + ": " + (f.min != null ? fmtVal(d, f.min) : "−∞") + "–" + (f.max != null ? fmtVal(d, f.max) : "+∞") + (d.unit ? " " + d.unit : "");
    }
    return "";
  }
  function renderChips() {
    const tray = $("chip-tray");
    const parts = [];
    for (const f of state.filters) {
      parts.push('<span class="chip"><b>' + esc(chipLabel(f)) + '</b><button class="chip-x" data-xcat="' + esc(f.dim) + '" data-xkind="' + f.kind + '" title="移除该过滤器" aria-label="移除过滤器 ' + esc(chipLabel(f)) + '">✕</button></span>');
    }
    if (state.search) {
      parts.push('<span class="chip"><b>搜索: “' + esc(state.search) + '”</b><button class="chip-x" data-xkind="search" title="移除搜索" aria-label="移除搜索">✕</button></span>');
    }
    tray.innerHTML = parts.join("") || '<span class="muted" style="font-size:11.5px">无活动过滤器 —— 数据集完整可见</span>';
    $("btn-clear-filters").disabled = !(state.filters.length || state.search);
    const si = $("search-input"); // 恢复/撤销后同步输入框（不打断正在输入的焦点）
    if (document.activeElement !== si && si.value !== state.search) si.value = state.search;
  }

  function sparklineSVG(dim) {
    const W = 62, H = 16;
    if (dim.type === "num") {
      const st = stats[dim.id], bins = new Array(22).fill(0);
      for (const r of records) {
        const t = (r[dim.id] - st.min) / (st.max - st.min || 1);
        bins[Math.min(21, Math.floor(t * 22))] += 1;
      }
      const mx = Math.max.apply(null, bins);
      let path = "M0," + H;
      bins.forEach((b, i) => {
        const x = ((i / 22) * W).toFixed(1), y = (H - (b / mx) * (H - 2) - 1).toFixed(1);
        path += "L" + x + "," + y + "L" + (((i + 1) / 22) * W).toFixed(1) + "," + y;
      });
      path += "L" + W + "," + H + "Z";
      return '<svg class="dim-spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><path d="' + path + '" fill="rgba(42,120,214,.16)" stroke="#2a78d6" stroke-width="1.2"/></svg>';
    }
    // 分类：分段条（2px 间隔），按值计数
    const counts = dim.values.map(v => records.reduce((n, r) => n + (r[dim.id] === v ? 1 : 0), 0));
    const total = records.length;
    let x = 0;
    let segs = "";
    const colors = CAT_COLORS[dim.id];
    counts.forEach((c, i) => {
      const w = Math.max(2, (c / total) * (W - 2 * (dim.values.length - 1)));
      const fill = colors ? colors[dim.values[i]] : "#2a78d6";
      segs += '<rect x="' + x.toFixed(1) + '" y="1" width="' + w.toFixed(1) + '" height="' + (H - 2) + '" rx="2" fill="' + fill + '"/>';
      x += w + 2;
    });
    return '<svg class="dim-spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + segs + "</svg>";
  }

  function filterPanelHTML(d) {
    let inner = "";
    if (d.type === "cat") {
      inner = d.values.map(v => {
        const cnt = records.reduce((n, r) => n + (r[d.id] === v ? 1 : 0), 0);
        const f = state.filters.find(x => x.kind === "cat" && x.dim === d.id);
        const on = !!(f && f.values.indexOf(v) >= 0);
        const sw = CAT_COLORS[d.id] ? '<span class="swatch" style="background:' + CAT_COLORS[d.id][v] + '"></span>' : "";
        const cid = "ck-" + d.id + "-" + v;
        return '<div class="ck-row">' + sw + '<input type="checkbox" data-cat="' + d.id + '" data-val="' + esc(v) + '" id="' + cid + '"' + (on ? " checked" : "") + '><label for="' + cid + '">' + esc(v) + '</label><span class="ck-count">' + cnt + "</span></div>";
      }).join("");
    } else {
      const f = state.filters.find(x => x.kind === "range" && x.dim === d.id);
      const st = stats[d.id];
      inner = '<div class="range-row">' +
        '<input type="number" data-rmin="' + d.id + '" placeholder="' + Math.round(st.min) + '" value="' + (f && f.min != null ? f.min : "") + '" aria-label="' + esc(d.name) + ' 最小值">' +
        '<span class="muted">–</span>' +
        '<input type="number" data-rmax="' + d.id + '" placeholder="' + Math.round(st.max) + '" value="' + (f && f.max != null ? f.max : "") + '" aria-label="' + esc(d.name) + ' 最大值">' +
        '<button class="btn" data-rapply="' + d.id + '">应用</button></div>' +
        '<div class="range-hint">范围 ' + fmtVal(d, st.min) + " – " + fmtVal(d, st.max) + (d.unit ? " " + d.unit : "") + " · 留空 = 不限</div>";
    }
    return '<div class="dim-filter">' + inner + "</div>";
  }

  function renderRail() {
    const list = $("dim-list");
    const parts = [];
    for (const d of dims) {
      const active = d.id === state.lens;
      const open = state.expanded.has(d.id);
      parts.push('<div class="dim-row' + (active ? " active" : "") + '" data-dim="' + d.id + '">');
      parts.push('<button class="dim-main" data-lens="' + d.id + '" title="设为透镜：' + esc(d.name) + '">');
      parts.push('<span class="dim-type">' + (d.type === "num" ? "123" : "ABC") + "</span>");
      parts.push('<span class="dim-txt"><span class="dim-name">' + esc(d.name) + (active ? ' <span class="lens-pill">透镜</span>' : "") + '</span><span class="dim-unit">' + (d.unit || (d.type === "cat" ? d.values.length + " 个取值" : "")) + "</span></span>");
      parts.push(sparklineSVG(d));
      parts.push("</button>");
      parts.push('<button class="dim-toggle" data-toggle="' + d.id + '" aria-expanded="' + open + '" title="筛选 ' + esc(d.name) + '">' + (open ? "▾" : "▸") + "</button>");
      parts.push("</div>");
      if (open) parts.push(filterPanelHTML(d));
    }
    list.innerHTML = parts.join("");

    const tr = $("trail");
    tr.innerHTML = state.trail.length
      ? state.trail.map(id => '<button class="trail-chip" data-trail="' + id + '"' + (id === state.lens ? ' style="border-color:var(--accent);color:var(--accent)"' : "") + ">" + esc(DIM[id].name) + "</button>").join("")
      : '<span class="trail-empty">尚未浏览</span>';
  }

  // ── lens stage（散点投影）───────────────────────────────────────────
  const chart = $("chart");
  const ctx = chart.getContext("2d");

  function makeXScale(dimId, w, mL, mR) {
    const d = DIM[dimId];
    const innerW = w - mL - mR;
    if (d.type === "num") {
      const st = stats[dimId];
      const pad = (st.max - st.min) * 0.03 || 1;
      const lo = st.min - pad, hi = st.max + pad;
      return {
        cat: false, ticks: niceTicks(st.min, st.max, 5),
        to: v => mL + ((v - lo) / (hi - lo)) * innerW,
        toRec: r => mL + ((r[dimId] - lo) / (hi - lo)) * innerW,
      };
    }
    const bw = innerW / d.values.length;
    const center = i => mL + bw * (i + 0.5);
    return {
      cat: true, values: d.values, center,
      toRec: r => {
        const i = Math.max(0, d.values.indexOf(r[dimId]));
        return center(i) + hashJitter(r.id + 1) * bw * 0.72;
      },
    };
  }
  function makeYScale(dimId, h, mT, mB) {
    const st = stats[dimId];
    const innerH = h - mT - mB;
    const pad = (st.max - st.min) * 0.05 || 1;
    const lo = st.min - pad, hi = st.max + pad;
    return {
      ticks: niceTicks(st.min, st.max, 4),
      to: v => mT + innerH - ((v - lo) / (hi - lo)) * innerH,
    };
  }

  let plotGeom = null;

  function renderStage() {
    const dpr = window.devicePixelRatio || 1;
    const rect = chart.parentElement.getBoundingClientRect();
    const w = Math.max(80, rect.width), h = Math.max(60, rect.height);
    if (chart.width !== Math.round(w * dpr) || chart.height !== Math.round(h * dpr)) {
      chart.width = Math.round(w * dpr); chart.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const mL = 52, mR = 14, mT = 10, mB = 34;
    const vis = visibleRecords();
    const xs = makeXScale(state.lens, w, mL, mR);
    const ys = makeYScale(state.companion, h, mT, mB);
    plotGeom = { mL, mR, mT, mB, w, h, xs, ys, vis };
    const lensDim = DIM[state.lens], compDim = DIM[state.companion];

    ctx.font = "10.5px system-ui, sans-serif";
    // 网格 + 刻度（recessive）
    ctx.strokeStyle = "#e1e0d9"; ctx.fillStyle = "#898781"; ctx.lineWidth = 1;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (const t of ys.ticks) {
      const y = Math.round(ys.to(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(mL, y); ctx.lineTo(w - mR, y); ctx.stroke();
      ctx.fillText(fmtVal(compDim, t), mL - 6, y);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    if (xs.cat) {
      for (let i = 0; i < xs.values.length; i++) {
        const cx = Math.round(xs.center(i)) + 0.5;
        ctx.beginPath(); ctx.moveTo(cx, mT); ctx.lineTo(cx, h - mB); ctx.stroke();
        ctx.fillText(xs.values[i], xs.center(i), h - mB + 8);
      }
    } else {
      for (const t of xs.ticks) {
        const x = Math.round(xs.to(t)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x, mT); ctx.lineTo(x, h - mB); ctx.stroke();
        ctx.fillText(fmtVal(lensDim, t), x, h - mB + 8);
      }
    }
    // 基线
    ctx.strokeStyle = "#c3c2b7";
    ctx.beginPath(); ctx.moveTo(mL, h - mB + 0.5); ctx.lineTo(w - mR, h - mB + 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mL + 0.5, mT); ctx.lineTo(mL + 0.5, h - mB); ctx.stroke();

    // 轴标题
    ctx.fillStyle = "#52514e"; ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText((xs.cat ? "" : "→ ") + lensDim.name + (lensDim.unit ? "（" + lensDim.unit + "）" : ""), xs.cat ? mL : mL + 2, h - 2);
    ctx.save();
    ctx.translate(10, mT); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "right"; ctx.textBaseline = "top";
    ctx.fillText("↑ " + compDim.name + (compDim.unit ? "（" + compDim.unit + "）" : ""), 0, 0);
    ctx.restore();

    // 点（先清 stale 坐标，保证命中检测只对本帧有效）
    for (const r of records) { r._x = null; r._y = null; }
    const colors = CAT_COLORS[state.colorBy];
    for (const r of vis) {
      const x = xs.toRec(r), y = ys.to(r[state.companion]);
      if (x < mL - 2 || x > w - mR + 2) continue;
      r._x = x; r._y = y;
      const sel = state.selection.has(r.id), anc = state.anchor === r.id;
      ctx.beginPath(); ctx.arc(x, y, anc ? 5 : sel ? 4 : 2.8, 0, 6.2832);
      ctx.fillStyle = colors[r[state.colorBy]] || "#898781";
      ctx.fill();
      if (sel || anc) { ctx.lineWidth = 2; ctx.strokeStyle = "#fcfcfb"; ctx.stroke(); } // 2px surface ring
      if (sel) { ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.2832); ctx.lineWidth = 1.6; ctx.strokeStyle = "#0b0b0b"; ctx.stroke(); }
      if (anc) { // 菱形锚点 + 直接标注
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
        ctx.lineWidth = 2; ctx.strokeStyle = "#4a3aa7"; ctx.strokeRect(-4.6, -4.6, 9.2, 9.2);
        ctx.restore();
        ctx.font = "600 10.5px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
        const lx = Math.min(x + 9, w - mR - ctx.measureText(r.name).width);
        ctx.fillStyle = "#4a3aa7"; ctx.fillText(r.name, lx, y - 8);
      }
    }

    // 头部：透镜名 + 统计 + 图例 + selects
    $("stage-lens-name").textContent = lensDim.name + (lensDim.unit ? "（" + lensDim.unit + "）" : "");
    if (lensDim.type === "num") {
      const vals = vis.map(r => r[state.lens]);
      $("stage-lens-stats").textContent = vals.length
        ? "最小 " + fmtVal(lensDim, Math.min.apply(null, vals)) + " · 中位 " + fmtVal(lensDim, median(vals)) + " · 最大 " + fmtVal(lensDim, Math.max.apply(null, vals)) + " · n=" + vals.length
        : "无匹配记录";
    } else {
      const cnt = lensDim.values.map(v => vis.reduce((n, r) => n + (r[state.lens] === v ? 1 : 0), 0)).join(" / ");
      $("stage-lens-stats").textContent = "取值计数 " + cnt + " · n=" + vis.length;
    }
    const lg = DIM[state.colorBy];
    $("legend").innerHTML = lg.values.map(v =>
      '<span class="lg"><span class="sw" style="background:' + CAT_COLORS[state.colorBy][v] + '"></span>' + esc(v) + "</span>").join("");

    resetSelect($("sel-companion"), dims.filter(d => d.type === "num"), state.companion);
    resetSelect($("sel-colorby"), dims.filter(d => COLORABLE.indexOf(d.id) >= 0), state.colorBy);
  }

  function resetSelect(sel, opts, val) {
    const sig = opts.map(o => o.id).join("|") + "#" + val;
    if (sel._sig === sig) return;
    sel._sig = sig;
    sel.innerHTML = opts.map(o => '<option value="' + o.id + '"' + (o.id === val ? " selected" : "") + ">" + esc(o.name) + "</option>").join("");
  }

  function nearestPoint(mx, my) {
    if (!plotGeom) return null;
    let best = null, bd = 121; // 11px 命中半径
    for (const r of plotGeom.vis) {
      if (r._x == null) continue;
      const dx = r._x - mx, dy = r._y - my, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = r; }
    }
    return best;
  }
  chart.addEventListener("mousemove", (ev) => {
    const rect = chart.getBoundingClientRect();
    const best = nearestPoint(ev.clientX - rect.left, ev.clientY - rect.top);
    const tip = $("tooltip");
    if (!best) { tip.hidden = true; return; }
    const ld = DIM[state.lens], cd = DIM[state.companion], kd = DIM[state.colorBy];
    tip.innerHTML = '<div class="tt-name">' + esc(best.name) + "</div>" +
      '<div class="tt-row"><span>' + esc(ld.name) + '</span><b>' + esc(fmtVal(ld, best[state.lens])) + "</b></div>" +
      '<div class="tt-row"><span>' + esc(cd.name) + '</span><b>' + esc(fmtVal(cd, best[state.companion])) + "</b></div>" +
      '<div class="tt-row"><span>' + esc(kd.name) + '</span><b>' + esc(best[state.colorBy]) + "</b></div>" +
      (state.selection.has(best.id) ? '<div class="tt-row"><span>已选中</span><b>✓</b></div>' : "");
    tip.hidden = false;
    tip.style.left = Math.min(ev.clientX + 14, window.innerWidth - 260) + "px";
    tip.style.top = (ev.clientY + 14) + "px";
  });
  chart.addEventListener("mouseleave", () => { $("tooltip").hidden = true; });
  chart.addEventListener("click", (ev) => {
    const rect = chart.getBoundingClientRect();
    const best = nearestPoint(ev.clientX - rect.left, ev.clientY - rect.top);
    if (best) actionToggleSelect(best.id);
  });

  // ── record table（主导数据面）───────────────────────────────────────
  const EXTRA_NUMS = ["gdpPerCapita", "happiness"];
  function renderTable() {
    const scroll = $("table-scroll");
    const st = scroll.scrollTop; // viewport 归属 record-table：重渲染间保持
    const prev = document.activeElement;
    const focusedRec = prev && prev.matches && prev.matches("tr.rec-row") ? +prev.getAttribute("data-rec") : null;
    const vis = visibleRecords();
    const lensDim = DIM[state.lens];

    const numCols = [state.lens];
    if (state.companion !== state.lens) numCols.push(state.companion);
    for (const e of EXTRA_NUMS) if (numCols.indexOf(e) < 0) numCols.push(e);

    const sortDimDef = DIM[state.sortDim];
    vis.sort((a, b) => {
      let va = a[state.sortDim], vb = b[state.sortDim];
      if (sortDimDef && sortDimDef.type === "cat") { va = sortDimDef.values.indexOf(va); vb = sortDimDef.values.indexOf(vb); }
      let c = va < vb ? -1 : va > vb ? 1 : (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
      return c * state.sortDir;
    });

    const head = ['<th title="锚定">☆</th><th data-sort="name"' + (state.sortDim === "name" ? (state.sortDir > 0 ? ' class="th-sorted th-sorted-asc"' : ' class="th-sorted"') : "") + ">城市</th>"];
    for (const id of numCols) {
      const d = DIM[id];
      head.push('<th data-sort="' + id + '" class="' + (id === state.lens ? "th-lens " : "") + (id === state.sortDim ? (state.sortDir > 0 ? "th-sorted th-sorted-asc" : "th-sorted") : "") + '">' + esc(d.name) + (id === state.lens ? " ·透镜" : "") + "</th>");
    }
    head.push('<th data-sort="region">大区</th><th data-sort="band">发展带</th>');
    $("table-head").innerHTML = "<tr>" + head.join("") + "</tr>";

    const rows = vis.map(r => {
      const sel = state.selection.has(r.id), anc = state.anchor === r.id;
      let tds = '<td><button class="anchor-btn" data-anchor="' + r.id + '" tabindex="-1" title="锚定到检查器（网格内 Shift+Enter）" aria-label="锚定 ' + esc(r.name) + '">☆</button></td>';
      tds += '<td class="td-name" title="' + esc(r.name) + '">' + esc(r.name) + "</td>";
      for (const id of numCols) {
        const d = DIM[id];
        let cell = esc(fmtVal(d, r[id]));
        if (id === state.lens && d.type === "num") {
          const s = stats[id];
          const wpx = Math.max(2, Math.round(((r[id] - s.min) / (s.max - s.min || 1)) * 46));
          cell = '<span class="cellbar" style="width:' + wpx + 'px"></span>' + cell;
        }
        tds += "<td>" + cell + "</td>";
      }
      tds += "<td>" + esc(r.region) + '</td><td><span class="badge">' + esc(r.band) + "</span></td>";
      return '<tr class="rec-row' + (sel ? " row-sel" : "") + (anc ? " row-anchor" : "") + '" data-rec="' + r.id + '" tabindex="-1" aria-selected="' + sel + '" aria-label="' + esc(r.name) + '">' + tds + "</tr>";
    });
    $("table-body").innerHTML = rows.join("");
    $("table-count-line").textContent = "显示 " + vis.length.toLocaleString("en-US") + " / " + size.toLocaleString("en-US") + " 条记录" + (state.selection.size ? " · 已选 " + state.selection.size + " 条" : "");
    $("table-empty").hidden = vis.length !== 0;
    scroll.scrollTop = st;
    if (focusedRec != null) { // 键盘焦点跨重渲染保持（网格行）
      const el = $("table-body").querySelector('tr[data-rec="' + focusedRec + '"]');
      if (el) el.focus();
    }
  }

  // ── inspector ───────────────────────────────────────────────────────
  function renderInspector() {
    const body = $("inspector-body");
    const r = state.anchor == null ? null : records[state.anchor];
    if (!r) {
      body.innerHTML = '<div class="insp-empty">未锚定记录 —— 点击表格行首 ☆，把一条记录固定在这里，跨全部 ' + dims.length + " 个维度查看。</div>";
      return;
    }
    const rows = dims.map(d => {
      const isLens = d.id === state.lens;
      let valCell;
      if (d.type === "num") {
        const s = stats[d.id];
        const pct = Math.max(4, Math.round(((r[d.id] - s.min) / (s.max - s.min || 1)) * 100));
        valCell = "<td>" + esc(fmtVal(d, r[d.id])) + (d.unit ? ' <span class="muted" style="font-size:10px">' + esc(d.unit) + "</span>" : "") +
          '<span class="insp-bar" style="width:' + pct + '%"></span></td>';
      } else {
        const sw = CAT_COLORS[d.id] ? '<span class="swatch" style="display:inline-block;background:' + CAT_COLORS[d.id][r[d.id]] + '"></span> ' : "";
        valCell = "<td>" + sw + esc(r[d.id]) + "</td>";
      }
      return "<tr" + (isLens ? ' class="insp-lens"' : "") + '><td>' + esc(d.name) + (isLens ? ' <span class="lens-pill">透镜</span>' : "") + "</td>" + valCell + "</tr>";
    });
    body.innerHTML =
      '<div class="insp-title"><h2>' + esc(r.name) + "</h2>" +
      '<span class="badge">' + esc(r.region) + '</span><span class="badge">' + esc(r.band) + " · " + esc(r.coastal) + "</span>" +
      '<span class="insp-actions">' +
      '<button class="btn" id="insp-sel">' + (state.selection.has(r.id) ? "取消选中" : "选中") + "</button>" +
      '<button class="btn" id="insp-unanchor">清除锚点</button></span></div>' +
      '<table class="insp-grid"><tbody>' + rows.join("") + "</tbody></table>";
    $("insp-sel").onclick = () => actionToggleSelect(r.id);
    $("insp-unanchor").onclick = () => actionToggleAnchor(r.id);
  }

  // ── journal ─────────────────────────────────────────────────────────
  function renderJournal() {
    const list = $("journal-list");
    const parts = [];
    for (let i = journal.entries.length - 1; i >= 0; i--) {
      const e = journal.entries[i];
      const cur = i === journal.pointer;
      const t = e.ts.toTimeString().slice(0, 8);
      parts.push('<button class="j-entry' + (cur ? " current" : "") + '" data-restore="' + i + '" title="恢复到此状态">' +
        '<span class="j-n">#' + e.seq + "</span>" +
        '<span class="j-main"><span class="j-label">' + esc(e.label) + "</span>" +
        '<span class="j-sub">' + t + " · 可见 " + e.visible.toLocaleString("en-US") + " · 已选 " + e.selected + "</span></span>" +
        (cur ? '<span class="j-restore" style="color:var(--ink-3)">当前</span>' : '<span class="j-restore">恢复</span>') +
        "</button>");
    }
    list.innerHTML = parts.join("");
    const fn = $("journal-fold-note");
    if (journal.folded > 0) { fn.hidden = false; fn.textContent = "已折叠最早 " + journal.folded + " 条（日志上限 " + MAX_JOURNAL + "）"; }
    else fn.hidden = true;
    const old = document.querySelector(".j-undo-note");
    if (old) old.remove();
    const n = journal.entries.length - 1;
    if (journal.pointer < n) {
      const div = document.createElement("div");
      div.className = "j-undo-note";
      div.textContent = "指针在 #" + journal.entries[journal.pointer].seq + " —— 直接操作将放弃其后 " + (n - journal.pointer) + " 条（可先恢复到末尾）";
      list.parentElement.insertBefore(div, list);
    }
  }

  // ── 事件绑定 ────────────────────────────────────────────────────────
  document.addEventListener("click", (ev) => {
    const th = ev.target.closest("th[data-sort]");
    if (th) { actionSort(th.getAttribute("data-sort")); return; }
    const t = ev.target.closest("[data-lens],[data-toggle],[data-trail],[data-rapply],[data-anchor],[data-rec],[data-restore],[data-xkind],#btn-clear-filters,#btn-empty-clear,#btn-clear-selection");
    if (!t) return;
    if (t.hasAttribute("data-lens")) actionSetLens(t.getAttribute("data-lens"));
    else if (t.hasAttribute("data-toggle")) {
      const id = t.getAttribute("data-toggle");
      if (state.expanded.has(id)) state.expanded.delete(id); else state.expanded.add(id);
      renderRail();
    }
    else if (t.hasAttribute("data-trail")) actionSetLens(t.getAttribute("data-trail"), "足迹");
    else if (t.hasAttribute("data-rapply")) {
      const id = t.getAttribute("data-rapply");
      const mn = document.querySelector('[data-rmin="' + id + '"]'), mx = document.querySelector('[data-rmax="' + id + '"]');
      const min = mn && mn.value !== "" ? +mn.value : null;
      const max = mx && mx.value !== "" ? +mx.value : null;
      actionSetRange(id, min, max);
    }
    else if (t.hasAttribute("data-anchor")) actionToggleAnchor(+t.getAttribute("data-anchor"));
    else if (t.hasAttribute("data-restore")) restoreAt(+t.getAttribute("data-restore"));
    else if (t.hasAttribute("data-xkind")) {
      const kind = t.getAttribute("data-xkind");
      if (kind === "search") actionSearch("");
      else {
        const dim = t.getAttribute("data-xcat");
        const f = state.filters.find(x => x.kind === kind && x.dim === dim);
        if (f) {
          state.filters = state.filters.filter(x => x !== f);
          journalPush("移除筛选 " + DIM[dim].name);
          renderAll();
        }
      }
    }
    else if (t.id === "btn-clear-filters" || t.id === "btn-empty-clear") actionClearFilters();
    else if (t.id === "btn-clear-selection") actionClearSelection();
    else if (t.hasAttribute("data-rec") && !ev.target.closest(".anchor-btn")) actionToggleSelect(+t.getAttribute("data-rec"));
  });

  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.matches("[data-cat]")) actionToggleCat(t.getAttribute("data-cat"), t.getAttribute("data-val"));
    else if (t.id === "sel-companion") actionSetCompanion(t.value);
    else if (t.id === "sel-colorby") actionSetColorBy(t.value);
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && ev.target.matches && ev.target.matches("[data-rmin],[data-rmax]")) {
      // 范围筛选输入框内回车 = 应用（键盘可达）
      ev.preventDefault();
      const id = ev.target.getAttribute("data-rmin") || ev.target.getAttribute("data-rmax");
      const btn = document.querySelector('[data-rapply="' + id + '"]');
      if (btn) btn.click();
      return;
    }
    if (ev.key === "Enter" && ev.target.id === "search-input") {
      // 搜索框内回车 = 立即应用（跳过防抖等待）
      ev.preventDefault();
      clearTimeout(searchTimer);
      actionSearch(ev.target.value);
      return;
    }
    if (ev.target.matches && ev.target.matches("input,select,textarea")) return;
    if (ev.key === "[" || ev.key === "]") {
      const i = dims.findIndex(d => d.id === state.lens);
      const ni = (i + (ev.key === "]" ? 1 : dims.length - 1)) % dims.length;
      actionSetLens(dims[ni].id, "键盘 " + ev.key);
      ev.preventDefault();
    } else if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === "z") {
      ev.preventDefault(); undo();
    } else if (((ev.ctrlKey || ev.metaKey) && ev.shiftKey && ev.key.toLowerCase() === "z") || ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "y")) {
      ev.preventDefault(); redo();
    } else if (ev.key === "Enter" && ev.target.matches && ev.target.matches("tr.rec-row")) {
      ev.preventDefault();
      if (ev.shiftKey) actionToggleAnchor(+ev.target.getAttribute("data-rec"));
      else actionToggleSelect(+ev.target.getAttribute("data-rec"));
    } else if ((ev.key === "ArrowDown" || ev.key === "ArrowUp") && ev.target.closest && ev.target.closest("#table-scroll")) {
      // 记录表网格导航：上下键在行间移动（roving tabindex）
      const rows = Array.from(document.querySelectorAll("tr.rec-row"));
      if (rows.length) {
        ev.preventDefault();
        const cur = rows.indexOf(ev.target.closest("tr.rec-row"));
        const next = ev.key === "ArrowDown" ? Math.min(rows.length - 1, cur + 1) : Math.max(0, cur <= 0 ? 0 : cur - 1);
        const row = rows[cur < 0 ? 0 : next];
        row.focus();
        row.scrollIntoView({ block: "nearest" });
      }
    }
  });

  let searchTimer = null;
  $("search-input").addEventListener("input", (ev) => {
    clearTimeout(searchTimer);
    const q = ev.target.value;
    searchTimer = setTimeout(() => actionSearch(q), 400);
  });

  $("btn-undo").addEventListener("click", undo);
  $("btn-redo").addEventListener("click", redo);

  window.addEventListener("resize", renderStage);

  // error 状态：任何未捕获异常可见地报告（不静默）
  window.addEventListener("error", (ev) => {
    const b = $("error-banner");
    b.hidden = false;
    b.textContent = "出现意外错误：" + (ev.message || "未知") + " —— 界面可能不完整，请刷新页面。";
  });

  // ── 初始化：同步完成，首屏即 ready（数据内联，无加载态）────────────
  journal.seq = 1;
  journal.entries.push({
    seq: 1, label: "初始状态 · 默认透镜 人口", ts: new Date(),
    snap: snapshot(),
    visible: records.filter(r => passFilter(r, state.filters, state.search)).length,
    selected: 0,
  });
  journal.pointer = 0;
  state.anchor = 0; // 首屏即有锚定记录，检查器不为空
  renderAll();
  // 只读调试句柄（供验收证据脚本断言；不参与应用逻辑）
  window.__lenscope = { state, journal, records, size, get plot() { return plotGeom; } };
})();
