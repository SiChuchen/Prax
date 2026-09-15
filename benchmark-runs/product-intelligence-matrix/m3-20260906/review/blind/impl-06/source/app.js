/* ============================================================
   选址决策台 · app（selection / weights / verdict 状态壳）
   状态所有权：selection → 应用壳（矩阵列 ↔ 地图点共享）；
              query(权重) → region-weights。
   ============================================================ */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var svg = $('#map');
  var tableWrap = $('#matrix-wrap');
  var weightsBox = $('#weights');
  var verdictBox = $('#region-verdict');
  var mapInfo = $('#map-info');
  var chip = $('#w-chip');

  var DEFAULT_W = {};
  CRITERIA.forEach(function (c) { DEFAULT_W[c.id] = c.w; });

  var state = {
    sel: null,      // 选中候选（矩阵列与地图点联动）
    locked: null,   // 锁定的最终选择
    weights: Object.assign({}, DEFAULT_W),
  };

  /* ---------- 评分模型 ---------- */
  // 各准则按三案极值归一为 0–100（better: low → 越小越优）
  function normScores() {
    var out = {};
    CRITERIA.forEach(function (c) {
      var vs = SITES.map(function (s) { return s.vals[c.id]; });
      var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs);
      out[c.id] = {};
      SITES.forEach(function (s) {
        out[c.id][s.id] = (max === min) ? 50 :
          (c.better === 'low' ? (max - s.vals[c.id]) : (s.vals[c.id] - min)) / (max - min) * 100;
      });
    });
    return out;
  }

  function wSum() {
    return CRITERIA.reduce(function (a, c) { return a + (state.weights[c.id] || 0); }, 0);
  }

  // 返回 {siteId: {fit, rank, scores}}；无可用药重时 fit=null
  function computeFit() {
    var ns = normScores();
    var sum = wSum();
    var fits = {};
    SITES.forEach(function (s) {
      var f = null;
      if (sum > 0) {
        f = 0;
        CRITERIA.forEach(function (c) { f += ns[c.id][s.id] * (state.weights[c.id] || 0); });
        f = Math.round(f / sum);
      }
      fits[s.id] = { fit: f, scores: ns };
    });
    var order = SITES.slice().sort(function (a, b) { return (fits[b.id].fit || -1) - (fits[a.id].fit || -1); });
    order.forEach(function (s, i) { fits[s.id].rank = (fits[s.id].fit == null) ? 0 : i + 1; });
    return fits;
  }

  function leaderInfo(fits) {
    if (wSum() === 0) return null;
    var a = SITES[0], b = SITES[1];
    if ((fits[b.id].fit || 0) > (fits[a.id].fit || 0)) { var t = a; a = b; b = t; }
    for (var i = 2; i < SITES.length; i++) if ((fits[SITES[i].id].fit || 0) > (fits[a.id].fit || 0)) { b = a; a = SITES[i]; }
    else if ((fits[SITES[i].id].fit || 0) > (fits[b.id].fit || 0)) { b = SITES[i]; }
    return { lead: a, second: b };
  }

  // 领先者相对第二名的关键差距准则（加权分差最大者）
  function keyDriver(fits, lead, second) {
    var best = null;
    CRITERIA.forEach(function (c) {
      var d = (state.weights[c.id] || 0) * (fits[lead.id].scores[c.id][lead.id] - fits[lead.id].scores[c.id][second.id]);
      if (!best || d > best.d) best = { c: c, d: d };
    });
    if (!best || best.d <= 0) return null;
    return {
      label: best.c.label,
      a: best.c.fmt(lead.vals[best.c.id]),
      b: best.c.fmt(second.vals[best.c.id]),
    };
  }

  function crit(cId) { return CRITERIA.filter(function (c) { return c.id === cId; })[0]; }
  function site(sId) { return SITES.filter(function (s) { return s.id === sId; })[0]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  /* ---------- 比较矩阵（主工作面） ---------- */
  function buildMatrix() {
    var h = '<colgroup><col class="c-label"><col span="' + SITES.length + '"></colgroup>';
    h += '<thead><tr><th class="rowh" scope="col">比较准则</th>';
    SITES.forEach(function (s, i) {
      h += '<th class="col" scope="col" data-col="' + s.id + '">' +
        '<button type="button" class="col-btn" data-site="' + s.id + '" tabindex="' + (i + 1) + '" aria-pressed="false" ' +
        'title="选中候选 ' + esc(s.key) + '（与地图点联动）">' +
        '<span class="site-key">' + esc(s.key) + '</span><span class="site-name">' + esc(s.name) + '</span>' +
        '<span class="site-addr">' + esc(s.addr) + ' · ' + esc(s.kind) + '</span>' +
        '<span data-chip></span></button></th>';
    });
    h += '</tr></thead><tbody>';

    h += '<tr class="row-fit"><th class="rowh" scope="row">契合分<span class="u">0–100 · 权重加权</span></th>';
    SITES.forEach(function (s) { h += '<td data-cell="fit:' + s.id + '" data-col="' + s.id + '"></td>'; });
    h += '</tr>';

    CRITERIA.forEach(function (c) {
      h += '<tr data-crit="' + c.id + '"><th class="rowh" scope="row">' + esc(c.label) + '<span class="u">' + esc(c.unit) + '</span></th>';
      SITES.forEach(function (s) { h += '<td data-cell="crit:' + c.id + ':' + s.id + '" data-col="' + s.id + '"></td>'; });
      h += '</tr>';
    });

    h += '<tr><th class="rowh" scope="row">预估月租<span class="u">面积 × 单价 × 30 天</span></th>';
    SITES.forEach(function (s) { h += '<td class="cell-arch" data-cell="arch:' + s.id + '" data-col="' + s.id + '"></td>'; });
    h += '</tr>';

    h += '<tr><th class="rowh" scope="row">一句话点评</th>';
    SITES.forEach(function (s) { h += '<td class="cell-note" data-cell="note:' + s.id + '" data-col="' + s.id + '">' + esc(s.note) + '</td>'; });
    h += '</tr>';

    h += '</tbody>';
    tableWrap.innerHTML = '<table aria-label="候选铺位比较矩阵">' + h + '</table>';
  }

  function renderMatrix(fits) {
    var table = $('table', tableWrap);
    var hasSel = !!state.sel, locked = state.locked;
    table.classList.toggle('is-locked-col', !!locked);

    SITES.forEach(function (s) {
      var f = fits[s.id];
      var isSel = state.sel === s.id;
      var isBestFit = (f.rank === 1 && f.fit != null);

      // 列头
      var th = $('th.col[data-col="' + s.id + '"]', table);
      th.classList.toggle('is-sel', isSel);
      th.classList.toggle('is-locked-col', locked === s.id);
      $('button.col-btn', th).setAttribute('aria-pressed', isSel ? 'true' : 'false');
      $('[data-chip]', th).innerHTML =
        (isBestFit && !locked ? '<span class="chip-lead">领先</span>' : '') +
        (locked === s.id ? '<span class="chip-lock">已锁定</span>' : '');

      // 契合分
      var fitTd = $('[data-cell="fit:' + s.id + '"]', table);
      fitTd.className = (f.rank === 1 && f.fit != null ? 'rank1 ' : '') + (isSel ? 'is-sel ' : '');
      fitTd.innerHTML = (f.fit == null)
        ? '<span class="fit-empty">— 待设权重</span>'
        : '<span class="fit-score">' + f.fit + '</span><span class="fit-rank" title="名次">' + f.rank + '</span>';

      // 准则行：数值 + 行内微条形 + 行最优徽标
      CRITERIA.forEach(function (c) {
        var td = $('[data-cell="crit:' + c.id + ':' + s.id + '"]', table);
        var sc = f.scores[c.id][s.id];
        var isBest = SITES.every(function (o) { return sc >= f.scores[c.id][o.id] - 1e-9; }) &&
          (SITES.length < 2 || sc > Math.max.apply(null, SITES.filter(function (o) { return o.id !== s.id; })
            .map(function (o) { return f.scores[c.id][o.id]; })));
        td.className = (isBest ? 'best ' : '') + (isSel ? 'is-sel' : '');
        td.innerHTML = '<span class="val">' + esc(c.fmt(s.vals[c.id])) + '</span>' +
          (isBest ? '<span class="badge-best">优</span>' : '') +
          '<div class="bar" aria-hidden="true"><i style="width:' + Math.round(sc) + '%"></i></div>';
      });

      // 档案
      var arch = $('[data-cell="arch:' + s.id + '"]', table);
      arch.className = 'cell-arch' + (isSel ? ' is-sel' : '');
      arch.innerHTML = '≈ <b>' + monthlyRentWan(s).toFixed(1) + '</b> 万/月（' + s.area + '㎡ × ' +
        esc(crit('rent').fmt(s.vals.rent)) + '）';

      var noteTd = $('[data-cell="note:' + s.id + '"]', table);
      noteTd.classList.toggle('is-sel', isSel);
    });
  }

  /* ---------- 商圈地图：选中联动 + 行悬停关联 ---------- */
  var REL = { commute: ['.m-metro', '.m-anchor'], traffic: ['.m-flow'], rival: ['.m-rivals'] };

  function renderMap(fits) {
    var lead = leaderInfo(fits);
    SITES.forEach(function (s) {
      var pin = $('.pin[data-site="' + s.id + '"]', svg);
      pin.classList.toggle('is-sel', state.sel === s.id);
      pin.classList.toggle('is-lead', !!lead && lead.lead.id === s.id && !state.locked);
      pin.classList.toggle('is-locked', state.locked === s.id);
      pin.setAttribute('aria-pressed', state.sel === s.id ? 'true' : 'false');
    });

    var wl = $('#walk-line'), wlt = $('#walk-label');
    if (state.sel) {
      var s = site(state.sel);
      var x1 = s.pinXY[0], y1 = s.pinXY[1], x2 = s.stationXY[0], y2 = s.stationXY[1];
      wl.setAttribute('x1', x1); wl.setAttribute('y1', y1);
      wl.setAttribute('x2', x2); wl.setAttribute('y2', y2);
      wl.setAttribute('visibility', 'visible');
      wlt.setAttribute('x', (x1 + x2) / 2); wlt.setAttribute('y', (y1 + y2) / 2 - 5);
      wlt.setAttribute('text-anchor', 'middle');
      wlt.textContent = '步行 ' + s.walkToStation + '′';
      wlt.setAttribute('visibility', 'visible');
      mapInfo.innerHTML = '已选 <strong>' + esc(s.key) + ' ' + esc(s.name) + '</strong> — 距' +
        esc(s.station) + '步行 ' + s.walkToStation + '′ · 至江北商务区 ' + s.vals.commute + '′（均步行）';
    } else {
      wl.setAttribute('visibility', 'hidden'); wlt.setAttribute('visibility', 'hidden');
      mapInfo.innerHTML = '点击候选点或右侧列头，双向联动选中。';
    }
  }

  function bindMapHover() {
    var table = $('table', tableWrap);
    table.addEventListener('mouseover', function (e) {
      var tr = e.target.closest('tr[data-crit]');
      if (!tr || tr === bindMapHover._last) return;
      clearHot(); bindMapHover._last = tr;
      var rels = REL[tr.getAttribute('data-crit')] || [];
      if (!rels.length) return;
      svg.classList.add('has-hot');
      rels.forEach(function (sel) { var g = $(sel, svg); if (g) g.classList.add('hot'); });
    });
    table.addEventListener('mouseout', function (e) {
      if (e.target.closest('tr[data-crit]')) { clearHot(); bindMapHover._last = null; }
    });
    function clearHot() {
      svg.classList.remove('has-hot');
      Array.prototype.forEach.call(svg.querySelectorAll('.hot'), function (g) { g.classList.remove('hot'); });
    }
  }

  /* ---------- 权重轨（query 状态所有者） ---------- */
  function buildWeights() {
    weightsBox.innerHTML = CRITERIA.map(function (c, i) {
      return '<div class="w-item">' +
        '<label for="w-' + c.id + '">' + esc(c.label) + '<span class="w-unit">' + esc(c.unit) + '</span></label>' +
        '<output id="wo-' + c.id + '" for="w-' + c.id + '">' + state.weights[c.id] + '</output>' +
        '<input type="range" id="w-' + c.id + '" min="0" max="5" step="1" value="' + state.weights[c.id] + '" ' +
        'tabindex="' + (8 + i) + '" aria-label="准则权重：' + esc(c.label) + '（0–5）">' +
        '</div>';
    }).join('');
    weightsBox.addEventListener('input', function (e) {
      var id = String(e.target.id || '').replace('w-', '');
      if (!crit(id)) return;
      state.weights[id] = +e.target.value;
      updateWeightsMeta();
      render();
    });
  }

  function updateWeightsMeta() {
    CRITERIA.forEach(function (c) {
      var out = $('#wo-' + c.id); if (out) out.value = state.weights[c.id];
      var inp = $('#w-' + c.id); if (inp && +inp.value !== state.weights[c.id]) inp.value = state.weights[c.id];
    });
    var custom = CRITERIA.some(function (c) { return state.weights[c.id] !== DEFAULT_W[c.id]; });
    chip.hidden = !custom;
  }

  function resetWeights() {
    state.weights = Object.assign({}, DEFAULT_W);
    updateWeightsMeta(); render();
  }

  /* ---------- 决策结论条（常驻） ---------- */
  function renderVerdict(fits) {
    var lead = leaderInfo(fits);
    var acts = '';
    if (state.locked) {
      var s = site(state.locked);
      var f = fits[s.id];
      var top = CRITERIA.slice().sort(function (a, b) {
        return (f.scores[b.id][s.id] * (state.weights[b.id] || 0)) - (f.scores[a.id][s.id] * (state.weights[a.id] || 0));
      })[0];
      verdictBox.innerHTML =
        '<span class="v-lockmsg">🔒 已锁定</span>' +
        '<span class="v-leader"><strong>' + esc(s.key) + ' ' + esc(s.name) + '</strong></span>' +
        '<span class="v-detail">契合 <b>' + (f.fit == null ? '—' : f.fit) + '</b> 分 · 最强项 <b>' + esc(top.label) + '</b>' +
        ' · 距' + esc(s.station) + '步行 ' + s.walkToStation + '′ · ' + esc(s.kind) + '</span>' +
        '<span class="v-actions"><button type="button" class="btn-unlock" data-act="unlock" tabindex="14">改选 / 解锁</button></span>';
    } else if (lead) {
      var L = lead.lead, R = lead.second;
      var fL = fits[L.id].fit, fR = fits[R.id].fit;
      var d = keyDriver(fits, L, R);
      var driverTxt = d ? ' · 关键差距：<b>' + esc(d.label) + '</b>（' + esc(d.a) + ' vs ' + esc(d.b) + '）'
        : (fL === fR ? ' · 两案并列，调整权重以突出侧重' : '');
      verdictBox.innerHTML =
        '<span class="v-leader">当前领先：<strong>' + esc(L.key) + ' ' + esc(L.name) + '</strong></span>' +
        '<span class="v-detail">契合 <b>' + fL + '</b> 分 · 领先第 2 名（' + esc(R.key) + ' ' +
        esc(R.name) + '）<b>' + (fL - fR) + '</b> 分' + driverTxt + '</span>' +
        '<span class="v-actions"><button type="button" class="btn-primary" data-act="lock" tabindex="14">锁定选择：' +
        esc(L.key) + ' ' + esc(L.name) + '</button></span>';
    } else {
      verdictBox.innerHTML =
        '<span class="v-leader">暂无有效评分</span>' +
        '<span class="v-detail">请至少为 <b>一项准则</b> 设置大于 0 的权重，即可计算契合分并得出领先者。</span>' +
        '<span class="v-actions"><button type="button" class="btn-primary" data-act="lock" disabled tabindex="14">锁定选择</button></span>';
    }
  }

  function toggleLock() {
    if (state.locked) { state.locked = null; }
    else {
      var fits = computeFit();
      var lead = leaderInfo(fits);
      if (!lead) return;
      state.locked = state.sel || lead.lead.id;
    }
    render();
  }

  /* ---------- 总渲染 ---------- */
  function render() {
    var fits = computeFit();
    renderMatrix(fits);
    renderMap(fits);
    renderVerdict(fits);
  }

  function selectSite(id) {
    state.sel = (state.sel === id) ? null : id;
    render();
  }

  /* ---------- 事件 ---------- */
  function bindEvents() {
    // 列头点击（事件委托，重渲染后仍有效）
    tableWrap.addEventListener('click', function (e) {
      var btn = e.target.closest('button.col-btn');
      if (btn) selectSite(btn.getAttribute('data-site'));
    });
    // 地图候选点
    svg.addEventListener('click', function (e) {
      var pin = e.target.closest('.pin');
      if (pin) selectSite(pin.getAttribute('data-site'));
    });
    svg.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var pin = e.target.closest('.pin');
      if (pin) { e.preventDefault(); selectSite(pin.getAttribute('data-site')); }
    });
    // 结论条动作
    verdictBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.getAttribute('data-act') === 'lock') toggleLock();
      if (b.getAttribute('data-act') === 'unlock') { state.locked = null; render(); }
    });
    $('#w-reset').addEventListener('click', resetWeights);

    // 键盘契约：←/→ 切换 · 1–3 选中 · L 锁定 · R 重置权重
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target && e.target.tagName;
      var t = e.target;
      var isRange = tag === 'INPUT' && t && t.type === 'range';
      if (tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (tag === 'INPUT' && !isRange) return;
      // 滑杆聚焦时仍允许 L/R 快捷键（滑杆本身不消费字母键）；方向键与数字留给滑杆原生行为
      if (isRange && e.key !== 'l' && e.key !== 'L' && e.key !== 'r' && e.key !== 'R') return;
      var ids = SITES.map(function (s) { return s.id; });
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var i = ids.indexOf(state.sel);
        i = e.key === 'ArrowRight' ? (i + 1) % ids.length : (i - 1 + ids.length) % ids.length;
        if (i === 0 && state.sel == null && e.key === 'ArrowLeft') i = ids.length - 1;
        state.sel = ids[i < 0 ? 0 : i];
        render();
      } else if (/^[1-9]$/.test(e.key) && +e.key <= ids.length) {
        selectSite(ids[+e.key - 1]);
      } else if (e.key === 'l' || e.key === 'L') {
        toggleLock();
      } else if (e.key === 'r' || e.key === 'R') {
        resetWeights();
      }
    });
  }

  /* ---------- 初始化（同步、无加载态） ---------- */
  function init() {
    if (!Array.isArray(SITES) || SITES.length === 0 || !Array.isArray(CRITERIA) || CRITERIA.length === 0) {
      var err = $('#app-error');
      err.hidden = false;
      err.textContent = '候选数据缺失：无法进行选址比较。请检查 data.js。';
      $('#region-main').style.display = 'none';
      verdictBox.style.display = 'none';
      return;
    }
    $('#data-note').textContent = SCENARIO.note;
    buildMatrix();
    buildWeights();
    bindMapHover();
    bindEvents();
    updateWeightsMeta();
    render();   // 首帧即 ready：无骨架、无 loading
  }

  try { init(); } catch (err) {
    var box = $('#app-error');
    box.hidden = false;
    box.textContent = '初始化失败：' + (err && err.message ? err.message : err);
  }
})();
