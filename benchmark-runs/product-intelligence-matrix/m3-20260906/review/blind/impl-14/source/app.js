/* app.js — 舰队变更史：时间轴 × 状态回放 × 因果链（无依赖，file:// 直接可开） */
(function () {
  "use strict";

  var DATA = window.DATA;
  var WIN = DATA.windows;
  var METRIC_KEYS = ["可用率", "p95 延迟", "错误率", "日成本"];
  var OP_LABEL = { add: "新增", modify: "修改", remove: "下线" };

  /* ---------- 索引 ---------- */
  var changeById = {};   /* id -> change（附 _w = 所属窗口下标） */
  var childrenOf = {};   /* 父变更 id -> [子变更 id] */
  var svcChanges = {};   /* 服务 id -> [{ wi, c }] */
  WIN.forEach(function (w, wi) {
    w.changes.forEach(function (c) {
      c._w = wi;
      changeById[c.id] = c;
      if (c.parent) (childrenOf[c.parent] = childrenOf[c.parent] || []).push(c.id);
      (svcChanges[c.target] = svcChanges[c.target] || []).push({ wi: wi, c: c });
    });
  });
  /* 无父且有子 → 因果链的源头 */
  var chainRoots = Object.keys(changeById).filter(function (id) {
    return !changeById[id].parent && childrenOf[id];
  });

  function catName(id) { return (DATA.catalog[id] || {}).name || id; }
  function el(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- 一致性校验（验收种子：时间结构与变更语义一致） ----------
     1) 因果序：父变更必须先于子变更（更早窗口，或同窗口更早列出）；
     2) 语义序：按时间回放，modify 的 from 必须与现场一致，add/remove 目标必须在场。 */
  function validate() {
    var errs = [];
    WIN.forEach(function (w, wi) {
      w.changes.forEach(function (c, ci) {
        if (!c.parent) return;
        var p = changeById[c.parent];
        if (!p) { errs.push(c.id + ": 未知因果父变更 " + c.parent); return; }
        var pi = WIN[p._w].changes.indexOf(p);
        if (p._w > wi || (p._w === wi && pi >= ci)) {
          errs.push(c.id + ": 因果倒置（" + c.parent + " 未先于本变更发生）");
        }
      });
    });
    var st = {};
    DATA.baseline.forEach(function (b) {
      st[b.id] = { fields: Object.assign({}, b.fields), addedAt: -1, removedAt: null };
    });
    WIN.forEach(function (w, wi) {
      w.changes.forEach(function (c) {
        var s = st[c.target];
        if (c.op === "add") {
          st[c.target] = { fields: Object.assign({}, c.fields), addedAt: wi, removedAt: null };
        } else if (c.op === "remove") {
          if (!s || s.removedAt != null) errs.push(c.id + ": " + c.target + " 不在场却下线 @" + w.version);
          else s.removedAt = wi;
        } else {
          if (!s || s.removedAt != null) errs.push(c.id + ": " + c.target + " 不在役 @" + w.version);
          else if (String(s.fields[c.field]) !== String(c.from)) {
            errs.push(c.id + ": from 与现场不符（" + s.fields[c.field] + " ≠ " + c.from + "）@" + w.version);
          } else {
            s.fields[c.field] = c.to;
          }
        }
      });
    });
    return errs;
  }

  /* ---------- 状态回放 ---------- */
  function stateAt(idx) {
    var st = {};
    DATA.baseline.forEach(function (b) {
      st[b.id] = { fields: Object.assign({}, b.fields), addedAt: -1, removedAt: null };
    });
    for (var w = 0; w <= idx; w++) {
      WIN[w].changes.forEach(function (c) {
        if (c.op === "add") st[c.target] = { fields: Object.assign({}, c.fields), addedAt: w, removedAt: null };
        else if (c.op === "remove") st[c.target].removedAt = w;
        else st[c.target].fields[c.field] = c.to;
      });
    }
    return st;
  }

  function chainOf(id) {
    var anc = [], c = changeById[id];
    while (c && c.parent) { anc.push(changeById[c.parent]); c = changeById[c.parent]; }
    var desc = [];
    (function walk(pid) {
      (childrenOf[pid] || []).forEach(function (kid) {
        desc.push(changeById[kid]);
        walk(kid);
      });
    })(id);
    return { anc: anc, self: changeById[id], desc: desc };
  }
  function chainIds(id) {
    var r = chainOf(id), out = {};
    r.anc.concat([r.self], r.desc).forEach(function (c) { out[c.id] = true; });
    return Object.keys(out);
  }
  function fmtLine(c) {
    if (c.op === "modify") return catName(c.target) + " · " + c.field + " " + c.from + " → " + c.to;
    if (c.op === "add") return catName(c.target) + " 新增（" + Object.keys(c.fields).join(" / ") + "）";
    return catName(c.target) + " 下线";
  }

  /* ---------- 应用状态 ---------- */
  var selWin = WIN.length - 1;   /* 默认停在最新窗口：首屏即当前状态 */
  var selChange = null;
  var traceSet = new Set();      /* 追踪中的变更 id 集合 */
  var timer = null;

  /* ---------- 渲染 ---------- */
  function renderChip(errs) {
    var chip = el("chip");
    if (errs.length) {
      chip.className = "chip bad";
      chip.textContent = "⚠ 一致性校验失败 ×" + errs.length + "（见控制台）";
    } else {
      chip.className = "chip ok";
      chip.textContent = "✓ 时间-因果一致性校验通过 · " + Object.keys(changeById).length +
        " 项变更 · " + chainRoots.length + " 条因果链";
    }
  }

  function renderTimeline() {
    var html = WIN.map(function (w, wi) {
      var nAdd = 0, nMod = 0, nRm = 0;
      w.changes.forEach(function (c) {
        if (c.op === "add") nAdd++; else if (c.op === "modify") nMod++; else nRm++;
      });
      var chips = [];
      if (nAdd) chips.push('<span class="op-chip add">新增 ' + nAdd + "</span>");
      if (nMod) chips.push('<span class="op-chip mod">修改 ' + nMod + "</span>");
      if (nRm) chips.push('<span class="op-chip rm">下线 ' + nRm + "</span>");
      var traced = !!traceSet.size && w.changes.some(function (c) { return traceSet.has(c.id); });
      var m = w.metrics;
      var errBad = parseFloat(m["错误率"]) >= 0.2;
      return '<button class="tl-item' + (wi === selWin ? " active" : "") + (traced ? " traced" : "") +
        '" data-w="' + wi + '">' +
        '<span class="tl-rail"><i class="tl-dot"></i></span>' +
        '<span class="tl-body">' +
          '<span class="tl-top"><b class="tl-ver">' + w.version + "</b><time>" + w.date + "</time></span>" +
          '<span class="tl-trig tone-' + w.trigger.tone + '">' + w.trigger.label + "</span>" +
          '<span class="tl-ops">' + chips.join("") + "</span>" +
          '<span class="tl-metrics' + (errBad ? " bad" : "") + '">' +
            "<span>" + m["可用率"] + "</span><span>" + m["p95 延迟"] + "</span>" +
            "<span>" + m["错误率"] + "</span><span>" + m["日成本"] + "</span>" +
          "</span>" +
        "</span></button>";
    }).join("");
    el("tl-list").innerHTML = html;
  }

  function renderState() {
    var w = WIN[selWin];
    var st = stateAt(selWin);
    var entries = Object.keys(st).map(function (id) { return [id, st[id]]; });
    var removedCnt = entries.filter(function (e) { return e[1].removedAt != null; }).length;
    var activeCnt = entries.length - removedCnt;

    if (traceSet.size) {
      var span = {};
      traceSet.forEach(function (id) { span[changeById[id]._w] = true; });
      el("state-head").innerHTML =
        '<div class="trace-banner"><span>因果链追踪中 · ' + traceSet.size +
        " 项变更 · 跨 " + Object.keys(span).length + " 个窗口</span>" +
        '<button class="mini-btn" data-act="trace-exit">退出追踪</button></div>';
    } else {
      el("state-head").innerHTML =
        '<div class="state-line"><h2>舰队状态 <span class="at">@ ' + w.version + " · " + w.date +
        '</span></h2><span class="cnt">在役 ' + activeCnt + " · 已下线 " + removedCnt +
        " · 本窗口变更 " + w.changes.length + " 项 · 点选右侧变更可查看因果链</span></div>";
    }

    var byTarget = {};
    w.changes.forEach(function (c) { (byTarget[c.target] = byTarget[c.target] || []).push(c); });

    el("fleet").innerHTML = entries.map(function (e) {
      var id = e[0], s = e[1];
      var cat = DATA.catalog[id] || {};
      var wc = byTarget[id] || [];
      var removedNow = s.removedAt === selWin;
      var hit = !!traceSet.size && wc.some(function (c) { return traceSet.has(c.id); });

      var badges = [];
      if (s.addedAt === selWin) badges.push('<span class="badge add">本窗口新增</span>');
      if (removedNow) badges.push('<span class="badge rm">本窗口下线</span>');
      if (s.removedAt != null && !removedNow) {
        badges.push('<span class="badge rm">已于 ' + WIN[s.removedAt].version + " 下线</span>");
      }

      var rows = Object.keys(s.fields).map(function (fn) {
        var mod = null, k;
        for (k = 0; k < wc.length; k++) {
          if (wc[k].op === "modify" && wc[k].field === fn) { mod = wc[k]; break; }
        }
        var dd = mod
          ? '<s class="old">' + esc(mod.from) + '</s><span class="arr">→</span><b class="newv">' + esc(mod.to) + "</b>"
          : '<span class="val">' + esc(s.fields[fn]) + "</span>";
        return '<div class="f' + (mod ? " changed" : "") + '"><dt>' + esc(fn) + "</dt><dd>" + dd + "</dd></div>";
      }).join("");

      var squares = WIN.map(function (_, wi) {
        var list = (svcChanges[id] || []).filter(function (x) { return x.wi === wi; });
        if (!list.length) return '<i class="sq' + (wi === selWin ? " cur" : "") + '" data-sw="' + wi + '"></i>';
        var ops = {};
        list.forEach(function (x) { ops[x.c.op] = true; });
        var cls = ops.remove ? "rm" : (ops.add ? "add" : "mod");
        var tip = list.map(function (x) { return x.c.id + " " + fmtLine(x.c); }).join("；");
        return '<i class="sq on ' + cls + (wi === selWin ? " cur" : "") +
          '" data-sw="' + wi + '" title="' + esc(tip) + '"></i>';
      }).join("");

      var cls = "svc";
      if (s.removedAt != null) cls += " removed";
      if (s.addedAt === selWin) cls += " fresh";
      if (wc.length) cls += " touched";
      if (traceSet.size) cls += hit ? " trace-hit" : " dim";

      return '<article class="' + cls + '">' +
        '<header class="svc-h"><b class="svc-name">' + esc(cat.name || id) +
        '</b><span class="svc-kind">' + esc(cat.kind || "") + "</span>" + badges.join("") + "</header>" +
        '<dl class="fields">' + rows + "</dl>" +
        '<div class="strip">' + squares + "</div>" +
        "</article>";
    }).join("");
  }

  function renderDetail() {
    var w = WIN[selWin];
    var m = w.metrics;
    var metricHtml = METRIC_KEYS.map(function (k) {
      return '<span class="wm"><i>' + k + "</i><b>" + m[k] + "</b></span>";
    }).join("");

    var list = w.changes.map(function (c) {
      var p = c.parent ? changeById[c.parent] : null;
      var kids = childrenOf[c.id] || [];
      var links = [];
      if (p) {
        var pr = p.reason;
        links.push('<span class="lnk up">↑ 因 ' + p.id + " · " + esc(pr.length > 16 ? pr.slice(0, 16) + "…" : pr) + "</span>");
      }
      if (kids.length) links.push('<span class="lnk down">↓ 引发 ' + kids.length + " 项</span>");
      var diff;
      if (c.op === "modify") diff = '<span class="chg-diff"><s>' + esc(c.from) + "</s> → <b>" + esc(c.to) + "</b></span>";
      else if (c.op === "add") diff = '<span class="chg-diff">' + esc(Object.keys(c.fields).join(" / ")) + "</span>";
      else diff = '<span class="chg-diff">移出舰队</span>';
      return '<button class="chg' + (selChange === c.id ? " sel" : "") +
        (traceSet.has(c.id) ? " traced" : "") + '" data-c="' + c.id + '">' +
        '<span class="op-tag ' + c.op + '">' + OP_LABEL[c.op] + "</span>" +
        '<span class="chg-main">' +
          '<span class="chg-t">' + esc(catName(c.target)) +
            (c.field ? ' · <i class="mono">' + esc(c.field) + "</i>" : "") + "</span>" +
          diff +
          '<span class="chg-reason">' + esc(c.reason) + "</span>" +
          (links.length ? '<span class="chg-links">' + links.join("") + "</span>" : "") +
        "</span></button>";
    }).join("");

    el("det-win").innerHTML =
      '<div class="panel-h"><h3>发布窗口 ' + w.version + '</h3><span class="mono mut">' + w.date + "</span></div>" +
      '<div class="win-note"><i class="tone-dot tone-' + w.trigger.tone + '"></i><b>' +
        w.trigger.label + "</b><span>" + w.note + "</span></div>" +
      '<div class="win-metrics">' + metricHtml + "</div>" +
      '<div class="panel-sub">本窗口变更 · ' + w.changes.length + "</div>" +
      '<div class="chg-list">' + list + "</div>";

    el("det-chain").innerHTML = renderChain();
  }

  function renderChain() {
    if (!selChange) {
      return '<div class="panel-h"><h3>变更因果链</h3></div>' +
        '<p class="hint">在上方点选一项变更，查看它的因与果。</p>';
    }
    var r = chainOf(selChange);
    var nodes = r.anc.slice().reverse().concat([r.self], r.desc);
    var btn = '<button class="mini-btn accent" data-act="trace">' +
      (traceSet.size ? "取消高亮" : "高亮整条链") + "</button>";
    var body = nodes.map(function (c, i) {
      var node = '<div class="chain-node' + (c.id === selChange ? " self" : "") +
        (traceSet.has(c.id) ? " on" : "") + '">' +
        '<span class="cn-win mono">' + WIN[c._w].version + " · " + WIN[c._w].date + "</span>" +
        '<span class="cn-line">' + esc(fmtLine(c)) + "</span>" +
        '<span class="cn-reason">' + esc(c.reason) + "</span>" +
        "</div>";
      return node + (i < nodes.length - 1 ? '<div class="chain-arrow">↓ 引发</div>' : "");
    }).join("");
    return '<div class="panel-h"><h3>因果链 · ' + nodes.length + " 项</h3>" + btn + "</div>" +
      (nodes.length === 1 ? '<p class="hint">该项变更暂无已记录的因果上下游。</p>' : "") +
      '<div class="chain">' + body + "</div>";
  }

  function renderAll() { renderTimeline(); renderState(); renderDetail(); }

  /* ---------- 交互 ---------- */
  function clearTrace() { traceSet = new Set(); }

  function selectWindow(i) {
    selWin = Math.max(0, Math.min(WIN.length - 1, i));
    selChange = null;
    clearTrace();
    renderAll();
  }
  function selectChange(id) {
    selChange = id;
    clearTrace();
    renderAll();
  }
  function toggleTrace() {
    if (!selChange) return;
    if (traceSet.size) clearTrace();
    else traceSet = new Set(chainIds(selChange));
    renderAll();
  }

  function stopPlay() {
    if (timer) { clearInterval(timer); timer = null; el("btn-play").textContent = "▶"; }
  }
  function togglePlay() {
    if (timer) { stopPlay(); return; }
    if (selWin >= WIN.length - 1) selectWindow(0);
    el("btn-play").textContent = "⏸";
    timer = setInterval(function () {
      if (selWin >= WIN.length - 1) { stopPlay(); return; }
      selectWindow(selWin + 1);
    }, 1600);
  }

  document.addEventListener("click", function (ev) {
    var n = ev.target.closest("[data-sw], [data-w], [data-c], [data-act]");
    if (!n) return;
    if (n.hasAttribute("data-sw")) { selectWindow(+n.getAttribute("data-sw")); return; }
    if (n.hasAttribute("data-w")) { selectWindow(+n.getAttribute("data-w")); return; }
    if (n.hasAttribute("data-c")) { selectChange(n.getAttribute("data-c")); return; }
    var act = n.getAttribute("data-act");
    if (act === "trace") toggleTrace();
    else if (act === "trace-exit") { clearTrace(); renderAll(); }
  });

  el("btn-first").addEventListener("click", function () { stopPlay(); selectWindow(0); });
  el("btn-prev").addEventListener("click", function () { stopPlay(); selectWindow(selWin - 1); });
  el("btn-next").addEventListener("click", function () { stopPlay(); selectWindow(selWin + 1); });
  el("btn-last").addEventListener("click", function () { stopPlay(); selectWindow(WIN.length - 1); });
  el("btn-play").addEventListener("click", togglePlay);

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowRight") { stopPlay(); selectWindow(selWin + 1); }
    else if (ev.key === "ArrowLeft") { stopPlay(); selectWindow(selWin - 1); }
    else if (ev.key === "Escape") { clearTrace(); renderAll(); }
  });

  /* ---------- 启动：先校验，后渲染（数据内联，无加载态） ---------- */
  var errs = validate();
  if (errs.length) console.error("[时间-因果一致性校验] 失败：", errs);
  else console.log("[时间-因果一致性校验] 通过 · " + Object.keys(changeById).length +
    " 项变更 · " + chainRoots.length + " 条因果链 · 修改 from 与现场全部吻合");

  /* 深链：?w=窗口下标 & c=变更ID & trace=1（便于复现交互态与外部取证截图） */
  var qs = new URLSearchParams(location.search);
  var qw = parseInt(qs.get("w"), 10);
  var qc = qs.get("c");
  if (qc && changeById[qc]) { selWin = changeById[qc]._w; selChange = qc; }
  else if (!isNaN(qw)) { selWin = Math.max(0, Math.min(WIN.length - 1, qw)); }
  if (qs.get("trace") === "1" && selChange) traceSet = new Set(chainIds(selChange));

  renderChip(errs);
  renderAll();
})();
