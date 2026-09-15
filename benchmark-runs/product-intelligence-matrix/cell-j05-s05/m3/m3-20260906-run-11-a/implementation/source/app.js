// 星脉 · 服务关系图谱 — 布局 / 渲染 / 交互（无框架、零外部依赖）
(function () {
  'use strict';

  // 初始化错误显式上报（避免白屏静默失败）
  window.addEventListener('error', function (ev) {
    var d = document.createElement('div');
    d.id = 'app-error';
    d.textContent = 'JS错误: ' + ev.message + ' @line ' + ev.lineno;
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999;background:#7a1f1f;color:#fff;padding:4px 10px;font:12px monospace';
    document.body.appendChild(d);
  });

  var G = window.GRAPH;
  var nodes = G.nodes;
  var edges = G.edges;
  var byId = {};
  nodes.forEach(function (n) { byId[n.id] = n; });

  var TYPE_META = {
    service:  { label: '服务',   color: '#5aa2ff' },
    data:     { label: '数据',   color: '#2fbf9b' },
    queue:    { label: '消息',   color: '#b48cf2' },
    external: { label: '外部',   color: '#f0b429' },
    client:   { label: '客户端', color: '#e8688a' }
  };
  var KIND_META = {
    call: { label: '同步调用', tag: '调用', marker: 'm-call', color: '#4d6f96', dash: null },
    data: { label: '数据读写', tag: '读写', marker: 'm-data', color: '#2f8577', dash: null },
    pub:  { label: '发布事件', tag: '发布', marker: 'm-event', color: '#8d6fd6', dash: '6 3' },
    sub:  { label: '订阅事件', tag: '订阅', marker: 'm-event', color: '#8d6fd6', dash: '2 4' }
  };
  var DEP_COLOR = '#4da3ff';
  var IMP_COLOR = '#ff8c42';

  /* ================= 邻接与统计 ================= */
  // 语义：边 A→B = A 依赖 B；影响沿反向传播。pub（发布事件）为相互影响。
  var outAdj = new Map();  // a -> [b, ...]   a 依赖谁
  var inAdj = new Map();   // b -> [a, ...]   谁依赖 b（即 b 的影响对象）
  function pushAdj(m, a, b) {
    if (!m.has(a)) m.set(a, []);
    m.get(a).push(b);
  }
  var deg = {};
  edges.forEach(function (e) {
    pushAdj(outAdj, e.s, e.t);
    pushAdj(inAdj, e.t, e.s);
    if (e.kind === 'pub') { // 双向
      pushAdj(outAdj, e.t, e.s);
      pushAdj(inAdj, e.s, e.t);
    }
    deg[e.s] = (deg[e.s] || 0) + 1;
    deg[e.t] = (deg[e.t] || 0) + 1;
  });

  function bfsDepth(start, adj) {
    var depth = new Map([[start, 0]]);
    var q = [start];
    while (q.length) {
      var cur = q.shift();
      var d = depth.get(cur);
      var nx = adj.get(cur) || [];
      for (var i = 0; i < nx.length; i++) {
        if (!depth.has(nx[i])) { depth.set(nx[i], d + 1); q.push(nx[i]); }
      }
    }
    return depth;
  }

  /* ================= 确定性力导向布局 ================= */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // 类型簇中心（手排五角位，保证簇间分离、图面可读）
  var CLUSTER = {
    client:   [-460, -270],
    service:  [0, 0],
    queue:    [370, -230],
    data:     [380, 250],
    external: [-360, 280]
  };
  function computeLayout() {
    var rng = mulberry32(20260908);
    var pos = {};
    nodes.forEach(function (n) {
      var c = CLUSTER[n.type];
      pos[n.id] = { x: c[0] + (rng() - 0.5) * 300, y: c[1] + (rng() - 0.5) * 300, vx: 0, vy: 0 };
    });
    var ITER = 340;
    for (var it = 0; it < ITER; it++) {
      var i, j, a, b, dx, dy, d2, d, f;
      // 斥力
      for (i = 0; i < nodes.length; i++) {
        for (j = i + 1; j < nodes.length; j++) {
          a = pos[nodes[i].id]; b = pos[nodes[j].id];
          dx = a.x - b.x; dy = a.y - b.y;
          d2 = dx * dx + dy * dy; if (d2 < 4) d2 = 4;
          d = Math.sqrt(d2);
          f = 34000 / d2;
          dx /= d; dy /= d;
          a.vx += dx * f; a.vy += dy * f;
          b.vx -= dx * f; b.vy -= dy * f;
        }
      }
      // 边弹簧
      edges.forEach(function (e) {
        a = pos[e.s]; b = pos[e.t];
        dx = b.x - a.x; dy = b.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;
        f = (d - 128) * 0.024;
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      });
      // 引力：全图中心 + 类型簇
      nodes.forEach(function (n) {
        var p = pos[n.id], c = CLUSTER[n.type];
        p.vx += (0 - p.x) * 0.003 + (c[0] - p.x) * 0.022;
        p.vy += (0 - p.y) * 0.003 + (c[1] - p.y) * 0.022;
      });
      // 积分
      nodes.forEach(function (n) {
        var p = pos[n.id];
        p.vx *= 0.8; p.vy *= 0.8;
        p.x += p.vx; p.y += p.vy;
      });
    }
    return pos;
  }
  var pos = computeLayout();

  // 适配 viewBox（整图恒在的关键：一次算好，永不裁剪）
  var PAD = 72;
  var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  nodes.forEach(function (n) {
    var p = pos[n.id];
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  });
  var vb = { x: minX - PAD, y: minY - PAD, w: (maxX - minX) + PAD * 2, h: (maxY - minY) + PAD * 2 };
  var LABEL_BELOW = 20; // 标签在节点下方的余量
  vb.h += LABEL_BELOW;

  var nodeR = {};
  nodes.forEach(function (n) {
    nodeR[n.id] = 6.5 + Math.sqrt(deg[n.id] || 1) * 2.05;
  });

  /* ================= SVG 构建 ================= */
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('graph');
  var gEdges = document.getElementById('edges');
  var gNodes = document.getElementById('nodes');
  svg.setAttribute('viewBox', vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h);

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // 边（在依赖方向上略收边，给箭头留位）
  var edgeEls = [];
  edges.forEach(function (e, idx) {
    var a = pos[e.s], b = pos[e.t];
    var dx = b.x - a.x, dy = b.y - a.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / d, uy = dy / d;
    var x1 = a.x + ux * (nodeR[e.s] + 2), y1 = a.y + uy * (nodeR[e.s] + 2);
    var x2 = b.x - ux * (nodeR[e.t] + 5.5), y2 = b.y - uy * (nodeR[e.t] + 5.5);
    var km = KIND_META[e.kind];
    var line = el('line', {
      x1: x1, y1: y1, x2: x2, y2: y2,
      stroke: km.color, 'class': 'edge'
    });
    if (km.dash) line.setAttribute('stroke-dasharray', km.dash);
    line.dataset.s = e.s; line.dataset.t = e.t;
    line.dataset.marker = 'url(#' + km.marker + ')';
    line.setAttribute('marker-end', line.dataset.marker);
    var ti = el('title', {});
    ti.textContent = byId[e.s].name + ' —' + km.label + '→ ' + byId[e.t].name;
    line.appendChild(ti);
    gEdges.appendChild(line);
    edgeEls.push(line);
  });

  // 节点
  var nodeEls = new Map();
  nodes.forEach(function (n) {
    var p = pos[n.id];
    var r = nodeR[n.id];
    var g = el('g', { 'class': 'node', transform: 'translate(' + p.x + ',' + p.y + ')' });
    g.appendChild(el('circle', { 'class': 'halo halo-imp', r: r + 11 }));
    g.appendChild(el('circle', { 'class': 'halo halo-dep', r: r + 6 }));
    g.appendChild(el('circle', { 'class': 'focusring', r: r + 3 }));
    var tm = TYPE_META[n.type];
    var c = el('circle', {
      'class': 'main', r: r,
      fill: tm.color, 'fill-opacity': .16,
      stroke: tm.color, 'stroke-width': 2
    });
    g.appendChild(c);
    var t = el('text', { 'class': 'label', y: r + 15 });
    t.textContent = n.name;
    g.appendChild(t);
    g.dataset.id = n.id;
    gNodes.appendChild(g);
    nodeEls.set(n.id, g);
  });

  /* ================= 状态 ================= */
  var state = {
    focus: 'order',          // 首屏默认焦点：订单服务
    trail: ['order'],
    radius: 1,
    hiddenTypes: new Set(),
    p0Only: false
  };
  var currentH = null; // {st, dep, imp}

  function radiusLabel() {
    return state.radius >= 99 ? '全部' : state.radius + ' 跳';
  }

  /* ================= 高亮刷新 ================= */
  function refresh() {
    var H = null, dep = null, imp = null;
    if (state.focus) {
      dep = bfsDepth(state.focus, outAdj);
      imp = bfsDepth(state.focus, inAdj);
    }
    var R = state.radius;
    var st = {};
    nodes.forEach(function (n) {
      var gd = dep && dep.get(n.id), gi = imp && imp.get(n.id);
      st[n.id] = {
        d: (gd !== undefined && gd <= R) ? gd : Infinity,
        i: (gi !== undefined && gi <= R) ? gi : Infinity,
        hidden: state.hiddenTypes.has(n.type) || (state.p0Only && n.crit !== 'P0')
      };
    });

    // 跟随路径上的边
    var trailPair = new Set();
    for (var i = 0; i + 1 < state.trail.length; i++) {
      trailPair.add(state.trail[i] + '|' + state.trail[i + 1]);
    }

    nodeEls.forEach(function (g, id) {
      var s = st[id];
      g.classList.toggle('off', s.hidden);
      g.classList.toggle('dim', !s.hidden && !!state.focus && s.d === Infinity && s.i === Infinity);
      g.classList.toggle('focus', state.focus === id);
      g.classList.toggle('dep', s.d < Infinity && state.focus !== id);
      g.classList.toggle('imp', s.i < Infinity && state.focus !== id);
      var hd = g.querySelector('.halo-dep'), hi = g.querySelector('.halo-imp');
      hd.style.opacity = (state.focus && s.d > 0 && s.d < Infinity) ? Math.max(.28, .95 - s.d * .2) : 0;
      hi.style.opacity = (state.focus && s.i > 0 && s.i < Infinity) ? Math.max(.28, .95 - s.i * .2) : 0;
      hd.style.transitionDelay = (s.d < Infinity ? s.d * 70 : 0) + 'ms';
      hi.style.transitionDelay = (s.i < Infinity ? s.i * 70 : 0) + 'ms';
    });

    edgeEls.forEach(function (L) {
      var s = st[L.dataset.s], t = st[L.dataset.t];
      var hidden = s.hidden || t.hidden;
      L.classList.toggle('hidden', hidden);
      var trail = trailPair.has(L.dataset.s + '|' + L.dataset.t) || trailPair.has(L.dataset.t + '|' + L.dataset.s);
      var lit = !!state.focus && ((s.d < Infinity || s.i < Infinity) && (t.d < Infinity || t.i < Infinity));
      L.classList.toggle('trail', trail);
      L.classList.toggle('lit', lit && !trail);
      L.classList.toggle('dim', !!state.focus && !lit && !trail);
      L.setAttribute('marker-end', trail ? 'url(#m-trail)' : L.dataset.marker);
    });

    currentH = { st: st, dep: dep, imp: imp };
  }

  /* ================= 面板 ================= */
  var panel = document.getElementById('panel');

  function kindSummary(items) {
    var cnt = {};
    items.forEach(function (it) { cnt[it.kind] = (cnt[it.kind] || 0) + 1; });
    return Object.keys(cnt).map(function (k) { return KIND_META[k].tag + ' ' + cnt[k]; }).join(' · ');
  }

  // 一跳关系（pub 视为相互依赖：主题的依赖里含发布方）
  function collectDeps(id) {
    var out = [];
    edges.forEach(function (e) {
      if (e.s === id) out.push({ id: e.t, kind: e.kind });
      if (e.kind === 'pub' && e.t === id) out.push({ id: e.s, kind: 'pub' });
    });
    return out;
  }
  function collectImps(id) {
    var out = [];
    edges.forEach(function (e) {
      if (e.t === id) out.push({ id: e.s, kind: e.kind });
    });
    return out;
  }

  function relItemHTML(item, depth) {
    var n = byId[item.id];
    var tm = TYPE_META[n.type];
    var depDepth = (currentH.dep && currentH.dep.get(item.id));
    var depTxt = (depDepth !== undefined && depDepth > 0 && depDepth <= state.radius)
      ? '<span class="depth-chip">径 ' + depDepth + '</span>' : '';
    return '<button type="button" class="rel-item" data-id="' + n.id + '">' +
      '<span class="dot" style="background:' + tm.color + '"></span>' +
      '<span class="rel-name">' + n.name + '</span>' +
      (depth ? '<span class="depth-chip">' + depth + '跳</span>' : depTxt) +
      '<span class="rel-kind">' + KIND_META[item.kind].tag + '</span>' +
      '<span class="crit ' + n.crit + '">' + n.crit + '</span>' +
      '<span class="rel-go">›</span></button>';
  }

  function groupedListHTML(items, depthMap) {
    if (!items.length) return '<div class="rel-none">（无）</div>';
    var byDepth = {};
    items.forEach(function (it) {
      var d = depthMap && depthMap.get(it.id);
      if (d === undefined || d > state.radius) d = 1;
      (byDepth[d] = byDepth[d] || []).push(it);
    });
    var html = '';
    Object.keys(byDepth).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
      if (Object.keys(byDepth).length > 1) {
        html += '<div class="rel-group">第 ' + d + ' 跳</div>';
      }
      byDepth[d].forEach(function (it) {
        html += relItemHTML(it, Object.keys(byDepth).length > 1 ? d : 0);
      });
    });
    return html;
  }

  function renderPanel() {
    if (!state.focus) {
      panel.innerHTML =
        '<div class="p-empty"><span class="big">◍</span>' +
        '点击任意节点开始跟随<br>' +
        '<b style="color:#b9c4d2">蓝环</b> = 它依赖的上游 · <b style="color:#ffd4b3">橙环</b> = 依赖它的下游<br>' +
        '整图始终可见，跟随不会丢失全局上下文</div>';
      return;
    }
    var n = byId[state.focus];
    var tm = TYPE_META[n.type];
    var deps = collectDeps(n.id);
    var imps = collectImps(n.id);

    var impCount = 0, impP0 = 0, depCount = 0;
    nodes.forEach(function (m) {
      if (m.id === n.id) return;
      var s = currentH.st[m.id];
      if (s.i < Infinity) { impCount++; if (m.crit === 'P0') impP0++; }
      if (s.d < Infinity) depCount++;
    });

    panel.innerHTML =
      '<div class="p-head">' +
        '<span class="type-badge" style="--c:' + tm.color + '">' + tm.label + '</span>' +
        '<h2>' + n.name + ' <span class="crit ' + n.crit + '">' + n.crit + '</span></h2>' +
        '<div class="p-meta"><span>' + n.team + '</span><span class="sid">#' + n.id + '</span></div>' +
        '<p class="p-desc">' + n.desc + '</p>' +
      '</div>' +
      '<div class="p-narrative">若「<b>' + n.name + '</b>」不可用，' +
        '半径 <b>' + radiusLabel() + '</b> 内 <span class="n-imp">' + impCount + ' 个节点受影响</span>' +
        (impP0 ? '（含 P0 ×' + impP0 + '）' : '') +
        '；其自身<span class="n-dep">依赖 ' + depCount + ' 个节点</span>。</div>' +
      '<div class="p-radius"><span>高亮半径</span><div class="seg" id="radius-seg">' +
        [1, 2, 3, 99].map(function (r) {
          return '<button type="button" data-r="' + r + '" class="' + (state.radius === r ? 'on' : '') + '">' +
            (r >= 99 ? '全部' : r + ' 跳') + '</button>';
        }).join('') +
      '</div></div>' +
      '<div class="p-stats">' +
        '<div class="stat-card imp"><div class="num">' + impCount + '</div>' +
          '<div class="lab">影响节点（≤' + radiusLabel() + '）</div>' +
          '<div class="sub">P0 ×' + impP0 + '</div></div>' +
        '<div class="stat-card dep"><div class="num">' + depCount + '</div>' +
          '<div class="lab">依赖节点（≤' + radiusLabel() + '）</div>' +
          '<div class="sub">上游' + (depCount ? '' : '（无）') + '</div></div>' +
      '</div>' +
      '<section class="p-sec"><h3><span class="tag" style="background:' + IMP_COLOR + '"></span>影响 · 谁依赖它' +
        '<span class="cnt">' + imps.length + ' 项一跳</span>' +
        (imps.length ? '<span class="kinds">' + kindSummary(imps) + '</span>' : '') + '</h3>' +
        groupedListHTML(imps, currentH.imp) +
      '</section>' +
      '<section class="p-sec"><h3><span class="tag" style="background:' + DEP_COLOR + '"></span>依赖 · 它依赖谁' +
        '<span class="cnt">' + deps.length + ' 项一跳</span>' +
        (deps.length ? '<span class="kinds">' + kindSummary(deps) + '</span>' : '') + '</h3>' +
        groupedListHTML(deps, currentH.dep) +
      '</section>';
  }

  /* ================= 面包屑 ================= */
  var crumbbar = document.getElementById('crumbbar');
  var crumbsEl = document.getElementById('crumbs');
  function renderCrumbs() {
    if (!state.trail.length) { crumbbar.classList.add('hidden'); return; }
    crumbbar.classList.remove('hidden');
    crumbsEl.innerHTML = state.trail.map(function (id, i) {
      var n = byId[id];
      var last = i === state.trail.length - 1;
      return (i ? '<li class="crumb-sep">›</li>' : '') +
        '<li><button type="button" class="crumb' + (last ? ' current' : '') + '" data-i="' + i + '">' +
        '<span class="crumb-type" style="background:' + TYPE_META[n.type].color + '"></span>' +
        n.name + '</button></li>';
    }).join('');
  }
  crumbsEl.addEventListener('click', function (ev) {
    var b = ev.target.closest('.crumb');
    if (!b || b.classList.contains('current')) return;
    state.trail = state.trail.slice(0, +b.dataset.i + 1);
    state.focus = state.trail[state.trail.length - 1];
    refresh(); renderPanel(); renderCrumbs();
  });
  document.getElementById('crumb-reset').addEventListener('click', function () {
    if (state.focus) state.trail = [state.focus];
    refresh(); renderPanel(); renderCrumbs();
  });

  /* ================= 跟随 ================= */
  function follow(id) {
    var idx = state.trail.indexOf(id);
    if (idx >= 0) state.trail = state.trail.slice(0, idx + 1);
    else state.trail.push(id);
    state.focus = id;
    refresh(); renderPanel(); renderCrumbs();
  }
  function clearFocus() {
    state.focus = null;
    state.trail = [];
    refresh(); renderPanel(); renderCrumbs();
  }

  panel.addEventListener('click', function (ev) {
    var b = ev.target.closest('.rel-item');
    if (b) { follow(b.dataset.id); return; }
    var rb = ev.target.closest('#radius-seg button');
    if (rb) {
      state.radius = +rb.dataset.r;
      refresh(); renderPanel();
    }
  });

  /* ================= 图交互 ================= */
  nodeEls.forEach(function (g, id) {
    g.addEventListener('click', function (ev) { ev.stopPropagation(); follow(id); });
    g.addEventListener('mouseenter', function () { showTip(id); });
    g.addEventListener('mousemove', moveTip);
    g.addEventListener('mouseleave', hideTip);
  });
  svg.addEventListener('click', function (ev) {
    if (ev.target.id === 'bg') clearFocus();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { clearFocus(); hideSearchDrop(); }
    if (ev.key === '/' && document.activeElement !== searchInput) {
      ev.preventDefault(); searchInput.focus();
    }
  });

  /* ================= Tooltip ================= */
  var tip = document.getElementById('tooltip');
  var wrap = document.getElementById('canvas-wrap');
  function showTip(id) {
    var n = byId[id];
    var tm = TYPE_META[n.type];
    var nin = (inAdj.get(id) || []).length, nout = (outAdj.get(id) || []).length;
    tip.innerHTML =
      '<div class="tt-name"><span class="dot" style="width:8px;height:8px;border-radius:50%;display:inline-block;background:' + tm.color + '"></span>' +
      n.name + '<span class="crit ' + n.crit + '" style="margin-left:6px">' + n.crit + '</span></div>' +
      '<div class="tt-meta">' + tm.label + ' · ' + n.team + ' · 连接 ' + (deg[id] || 0) + '</div>' +
      '<div class="tt-desc">' + n.desc + '</div>' +
      '<div class="tt-go">依赖 ' + nout + ' · 被依赖 ' + nin + ' · 点击跟随</div>';
    tip.classList.remove('hidden');
  }
  function moveTip(ev) {
    var r = wrap.getBoundingClientRect();
    var x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14;
    if (x + 260 > r.width) x -= 280;
    if (y + 130 > r.height) y -= 145;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { tip.classList.add('hidden'); }

  /* ================= 搜索 ================= */
  var searchInput = document.getElementById('search');
  var searchDrop = document.getElementById('search-drop');
  function hideSearchDrop() { searchDrop.classList.add('hidden'); }
  searchInput.addEventListener('input', function () {
    var q = searchInput.value.trim().toLowerCase();
    if (!q) { hideSearchDrop(); return; }
    var hits = nodes.filter(function (n) {
      return n.name.toLowerCase().indexOf(q) >= 0 || n.id.toLowerCase().indexOf(q) >= 0;
    }).slice(0, 7);
    searchDrop.innerHTML = hits.length
      ? hits.map(function (n) {
          return '<div class="search-item" data-id="' + n.id + '">' +
            '<span class="dot" style="background:' + TYPE_META[n.type].color + '"></span>' +
            n.name + '<span class="sid">' + n.id + '</span></div>';
        }).join('')
      : '<div class="search-empty">无匹配节点</div>';
    searchDrop.classList.remove('hidden');
  });
  searchDrop.addEventListener('mousedown', function (ev) {
    var it = ev.target.closest('.search-item');
    if (it) { follow(it.dataset.id); searchInput.value = ''; hideSearchDrop(); searchInput.blur(); }
  });
  searchInput.addEventListener('blur', function () { setTimeout(hideSearchDrop, 150); });

  /* ================= 图例 / 过滤 ================= */
  var legendRow = document.getElementById('legend-types');
  legendRow.innerHTML = Object.keys(TYPE_META).map(function (t) {
    var cnt = nodes.filter(function (n) { return n.type === t; }).length;
    return '<button type="button" class="lg-type" data-type="' + t + '">' +
      '<span class="dot" style="background:' + TYPE_META[t].color + '"></span>' +
      TYPE_META[t].label + '<span class="cnt">' + cnt + '</span></button>';
  }).join('');
  legendRow.addEventListener('click', function (ev) {
    var b = ev.target.closest('.lg-type');
    if (!b) return;
    var t = b.dataset.type;
    if (state.hiddenTypes.has(t)) { state.hiddenTypes.delete(t); b.classList.remove('off'); }
    else { state.hiddenTypes.add(t); b.classList.add('off'); }
    refresh();
  });
  document.getElementById('p0-only').addEventListener('change', function (ev) {
    state.p0Only = ev.target.checked;
    refresh();
  });

  /* ================= 顶栏统计 ================= */
  document.getElementById('global-stats').innerHTML =
    '<span><b>' + nodes.length + '</b> 节点</span>' +
    '<span><b>' + edges.length + '</b> 关系</span>' +
    '<span><b>' + Object.keys(TYPE_META).length + '</b> 类型</span>';

  /* ================= 启动 ================= */
  // 深链：#focus=id & r=1|2|3|99 & trail=a,b,c（便于分享与自动化验证）
  (function initFromHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (kv) {
      var p = kv.split('=');
      var k = p[0], v = decodeURIComponent(p[1] || '');
      if (k === 'focus' && byId[v]) { state.focus = v; state.trail = [v]; }
      if (k === 'trail') {
        var ids = v.split(',').filter(function (id) { return !!byId[id]; });
        if (ids.length) { state.trail = ids; state.focus = ids[ids.length - 1]; }
      }
      if (k === 'r' && +v) state.radius = +v >= 99 ? 99 : Math.min(3, Math.max(1, +v));
    });
  })();
  refresh();
  renderPanel();
  renderCrumbs();
})();
