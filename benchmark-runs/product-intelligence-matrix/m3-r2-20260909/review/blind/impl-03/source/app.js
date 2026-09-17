/* Meridian 变更时序档案 — cell-j06-s06 · understand × temporal-sequence
   渲染、因果闭包、时序校验、状态回放。同步初始化，无加载态。 */
(function () {
  "use strict";
  const D = window.CHANGE_SET;
  const EV = D.events.slice().sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  const byId = {};
  EV.forEach(e => { byId[e.id] = e; });
  const COMP = D.components, TYPE = D.types;

  /* ---- 因果索引：downs[id] = 以 id 为因的记录 ---- */
  const downs = {};
  EV.forEach(e => { downs[e.id] = []; });
  EV.forEach(e => (e.causes || []).forEach(c => { if (downs[c]) downs[c].push(e.id); }));
  const ups = {};
  EV.forEach(e => { ups[e.id] = (e.causes || []).filter(c => byId[c]); });

  /* ---- 时序校验：记录有序 + 因果边满足「因先于果」 ---- */
  let edges = 0, bad = 0;
  EV.forEach(e => (e.causes || []).forEach(c => {
    edges++;
    if (!(byId[c] && byId[c].t < e.t)) bad++;
  }));
  let ordered = true;
  for (let i = 1; i < EV.length; i++) if (EV[i].t <= EV[i - 1].t) ordered = false;

  /* ---- 闭包 ---- */
  function closure(id, map) {
    const seen = new Set(), st = (map[id] || []).slice();
    while (st.length) {
      const x = st.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      (map[x] || []).forEach(y => st.push(y));
    }
    return seen;
  }

  /* ---- 状态回放：按时间顺序折叠 set 操作 ---- */
  function stateAt(v) {
    const s = {};
    D.stateFields.forEach(f => {
      s[f.comp + "." + f.key] = { comp: f.comp, key: f.key, label: f.label, val: f.init, by: null };
    });
    for (let i = 0; i < v; i++) {
      const e = EV[i];
      (e.set || []).forEach(op => {
        const k = op.comp + "." + op.key;
        if (s[k]) { s[k].val = op.val; s[k].by = e; }
      });
    }
    return s;
  }

  /* ---- 应用状态 ---- */
  const S = { sel: "c02", asOf: EV.length, fc: new Set(), ft: new Set() };

  /* ---- 工具 ---- */
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const hm = t => t.slice(11, 16);
  const dayOf = t => t.slice(0, 10);
  const WD = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const wd = t => WD[new Date(dayOf(t) + "T00:00:00").getDay()];
  const tierLabel = c => COMP[c].tier === "core" ? "核心链路" : "支撑服务";

  const OBS_TYPES = ["alert", "report", "recover", "note"];
  function isShown(e) {
    return (S.fc.size === 0 || S.fc.has(e.comp)) && (S.ft.size === 0 || S.ft.has(e.type));
  }
  function sevTag(e) {
    if (e.sev === "high") return '<span class="sev h">严重</span>';
    if (e.sev === "warn") return '<span class="sev w">关注</span>';
    return "";
  }
  function linkChip(id) {
    const e = byId[id];
    if (!e) return "";
    return '<button class="link-chip t-' + e.type + '" data-id="' + id + '">' +
      '<span class="cdot"></span>' + id + ' · ' + hm(e.t) + ' ' + TYPE[e.type].name + '</button>';
  }

  /* ---- 头部 ---- */
  function renderHeader() {
    $("#envTxt").textContent = D.system + " · " + D.env;
    $("#stEv").textContent = EV.length;
    $("#stEdge").textContent = edges;
    $("#stObs").textContent = EV.filter(e => OBS_TYPES.indexOf(e.type) >= 0).length;
    const pill = $("#valPill");
    if (ordered && bad === 0) {
      pill.className = "pill ok";
      pill.textContent = "时序校验 ✓ " + EV.length + "/" + EV.length + " 有序 · " + edges + "/" + edges + " 因果「因先于果」";
    } else {
      pill.className = "pill bad";
      pill.textContent = "时序校验 ✗ 存在乱序或因果冲突（" + bad + " 条）";
    }
    $("#winTxt").textContent = "窗口 " + D.window;
    $("#digestTxt").textContent = D.digest;
  }

  /* ---- 筛选 chips ---- */
  function renderFilters() {
    $("#fComp").innerHTML = D.compOrder.map(c =>
      '<button class="chip' + (S.fc.has(c) ? " on" : "") + '" data-g="c" data-v="' + c + '">' +
      esc(COMP[c].name) + '</button>').join("");
    $("#fType").innerHTML = Object.keys(TYPE).map(t =>
      '<button class="chip t-' + t + (S.ft.has(t) ? " on" : "") + '" data-g="t" data-v="' + t + '">' +
      '<span class="cdot"></span>' + TYPE[t].name + '</button>').join("");
  }

  /* ---- 时间线 ---- */
  function renderTimeline() {
    const up = closure(S.sel, ups), down = closure(S.sel, downs);
    const keep = new Set();
    EV.forEach(e => {
      if (isShown(e) || e.id === S.sel || up.has(e.id) || down.has(e.id)) keep.add(e.id);
    });
    const keptByDay = {};
    EV.forEach(e => { if (keep.has(e.id)) keptByDay[dayOf(e.t)] = (keptByDay[dayOf(e.t)] || 0) + 1; });

    let html = "", lastDay = "", hidden = [];
    const flush = () => {
      if (hidden.length) {
        html += '<div class="gap">⋯ 已按筛选隐藏 ' + hidden.length + ' 条（' +
          hm(hidden[0].t) + ' – ' + hm(hidden[hidden.length - 1].t) + '）⋯</div>';
        hidden = [];
      }
    };
    EV.forEach(e => {
      if (!keep.has(e.id)) { hidden.push(e); return; }
      flush();
      const d = dayOf(e.t);
      if (d !== lastDay) {
        lastDay = d;
        html += '<div class="dayh">' + d + ' ' + wd(e.t) +
          '<span>' + (keptByDay[d] || 0) + ' 条记录</span></div>';
      }
      const isSel = e.id === S.sel, isUp = up.has(e.id), isDown = down.has(e.id);
      let tags = sevTag(e);
      if (isUp) tags += '<span class="ctag up">上游 · 因</span>';
      if (isDown) tags += '<span class="ctag down">下游 · 果</span>';
      if (!isShown(e)) tags += '<span class="ctag dim">链路保留</span>';
      html += '<article class="ev t-' + e.type + (isSel ? " sel" : "") + (isUp ? " up" : "") + (isDown ? " down" : "") +
        '" data-id="' + e.id + '">' +
        '<div class="ev-time">' + hm(e.t) + '</div>' +
        '<div class="ev-main"><div class="ev-top">' +
        '<span class="badge t-' + e.type + '">' + TYPE[e.type].name + '</span>' +
        '<span class="comp">' + esc(COMP[e.comp].name) + '</span>' + tags +
        '<span class="eid">' + e.id + '</span></div>' +
        '<div class="ev-title">' + esc(e.title) + '</div></div></article>';
    });
    flush();
    $("#timeline").innerHTML = html;
  }

  /* ---- 因果链路条 ---- */
  function renderChain() {
    const up = closure(S.sel, ups), down = closure(S.sel, downs);
    const chain = Array.from(new Set([].concat(Array.from(up), [S.sel], Array.from(down))))
      .sort((a, b) => (byId[a].t < byId[b].t ? -1 : 1));
    let ch = "";
    if (up.size) ch += '<span class="cap">根因 ▸</span>';
    chain.forEach((id, i) => {
      const e = byId[id];
      ch += '<button class="lk t-' + e.type + (id === S.sel ? " cur" : "") + '" data-id="' + id + '">' +
        '<span class="cdot"></span>' + id + ' ' + TYPE[e.type].name + ' ' + hm(e.t) + '</button>';
      if (i < chain.length - 1) ch += '<span class="arr">→</span>';
    });
    if (down.size) ch += '<span class="cap tail">▸ 结果</span>';
    if (chain.length === 1) ch += '<span class="chain-empty">该记录暂无上下游因果关联</span>';
    $("#chain").innerHTML = ch;
  }

  /* ---- 详情 ---- */
  function renderDetail() {
    const e = byId[S.sel];
    let h = '<div class="d-head">' +
      '<span class="badge t-' + e.type + '">' + TYPE[e.type].name + '</span>' +
      '<span class="d-comp">' + esc(COMP[e.comp].name) + '</span>' +
      '<span class="d-time">' + e.t + '</span>' + sevTag(e) +
      '<span class="eid">' + e.id + '</span></div>' +
      '<h2 class="d-title">' + esc(e.title) + '</h2>' +
      '<div class="d-meta">操作 · ' + esc(e.actor) + '　　触发 · ' + esc(e.trigger) + '</div>';
    if (e.rows && e.rows.length) {
      h += '<table class="d-rows"><thead><tr><th>维度</th><th>变更前</th><th>变更后 / 观测</th></tr></thead><tbody>' +
        e.rows.map(r => '<tr><td>' + esc(r.k) + '</td><td class="b">' + esc(r.b) + '</td><td class="a">' + esc(r.a) + '</td></tr>').join("") +
        '</tbody></table>';
    }
    if (e.notes && e.notes.length) {
      h += '<ul class="d-notes">' + e.notes.map(n => '<li>' + esc(n) + '</li>').join("") + '</ul>';
    }
    const cs = ups[e.id], ds = downs[e.id];
    h += '<div class="d-causal">' +
      '<div class="dc"><h3>上游因果 · ' + cs.length + '</h3>' +
      (cs.length ? cs.map(linkChip).join("") : '<span class="none">无（根因记录）</span>') + '</div>' +
      '<div class="dc"><h3>下游结果 · ' + ds.length + '</h3>' +
      (ds.length ? ds.map(linkChip).join("") : '<span class="none">无直接后续</span>') + '</div></div>' +
      '<button class="locbtn" data-id="' + e.id + '">⟲ 状态回放定位至此时刻</button>';
    $("#detail").innerHTML = h;
    $("#selHint").textContent = "记录 " + e.id;
  }

  /* ---- 回放 ---- */
  function renderReplay() {
    const v = S.asOf, slider = $("#asOf");
    slider.max = EV.length; slider.value = v;
    $("#asOfTxt").textContent = v === 0
      ? "窗口起点（初始状态，尚未重放任何变更）"
      : EV[v - 1].t + " 之后 · 已重放 " + v + "/" + EV.length + " 条";
    const st = stateAt(v);
    let h = "";
    D.compOrder.forEach(c => {
      const fields = Object.keys(st).map(k => st[k]).filter(f => f.comp === c);
      if (!fields.length) return;
      h += '<div class="sg"><div class="sg-h"><span class="cdot" style="background:' +
        (COMP[c].tier === "core" ? "#4c8dff" : "#8fa3b8") + '"></span>' + esc(COMP[c].name) +
        '<span class="sg-t">' + tierLabel(c) + '</span></div>' +
        fields.map(f => {
          const fresh = v > 0 && f.by && f.by === EV[v - 1];
          return '<div class="sr' + (fresh ? " fresh" : "") + '"><span class="k">' + esc(f.label) +
            '</span><span class="v">' + esc(String(f.val)) + '</span><span class="by">' +
            (f.by ? "← " + f.by.id + " " + hm(f.by.t) : "初始值") + '</span></div>';
        }).join("") + '</div>';
    });
    $("#stateTable").innerHTML = h;
    const nb = $("#nextBtn");
    if (v < EV.length) {
      const n = EV[v];
      nb.hidden = false;
      nb.innerHTML = "下一条 ▸ " + n.id + " " + hm(n.t) + " " + TYPE[n.type].name + " · " + esc(n.title);
      nb.dataset.id = n.id;
    } else { nb.hidden = true; }
  }

  function renderAll() { renderChain(); renderTimeline(); renderDetail(); renderReplay(); updateHash(); }

  /* ---- 深链：#sel=c21&asof=29&fc=paycore,notify&ft=alert ---- */
  function parseHash() {
    if (!location.hash || location.hash.length < 2) return;
    const q = new URLSearchParams(location.hash.slice(1));
    const sel = q.get("sel"); if (sel && byId[sel]) S.sel = sel;
    const asof = +q.get("asof"); if (asof >= 0 && asof <= EV.length) S.asOf = asof;
    const fc = q.get("fc"); if (fc) fc.split(",").forEach(x => { if (COMP[x]) S.fc.add(x); });
    const ft = q.get("ft"); if (ft) ft.split(",").forEach(x => { if (TYPE[x]) S.ft.add(x); });
  }
  function updateHash() {
    const q = new URLSearchParams();
    if (S.sel) q.set("sel", S.sel);
    q.set("asof", String(S.asOf));
    if (S.fc.size) q.set("fc", Array.from(S.fc).join(","));
    if (S.ft.size) q.set("ft", Array.from(S.ft).join(","));
    const h = "#" + q.toString();
    if (location.hash !== h) { try { history.replaceState(null, "", h); } catch (e) {} }
  }

  /* ---- 交互 ---- */
  document.addEventListener("click", function (ev) {
    const t = ev.target.closest("[data-id],[data-g]");
    if (!t) return;
    if (t.classList.contains("chip")) {
      const set = t.dataset.g === "c" ? S.fc : S.ft;
      if (set.has(t.dataset.v)) set.delete(t.dataset.v); else set.add(t.dataset.v);
      renderFilters(); renderTimeline();
      return;
    }
    const id = t.dataset.id;
    if (!id || !byId[id]) return;
    if (t.classList.contains("locbtn")) {
      S.asOf = EV.indexOf(byId[id]) + 1;
      renderReplay();
      return;
    }
    if (t.classList.contains("nextbtn")) {
      S.sel = id;
      S.asOf = EV.indexOf(byId[id]) + 1;
      renderAll();
      return;
    }
    S.sel = id;
    renderAll();
  });
  $("#asOf").addEventListener("input", function (e) { S.asOf = +e.target.value; renderReplay(); });

  /* ---- 同步初始化：脚本执行完首屏即就绪 ---- */
  parseHash();
  renderHeader();
  renderFilters();
  renderAll();
})();
