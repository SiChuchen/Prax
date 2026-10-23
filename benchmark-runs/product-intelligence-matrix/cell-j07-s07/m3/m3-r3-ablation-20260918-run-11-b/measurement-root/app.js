/* Plotboard — 落位即意图 · placement is intent
   A spatial workspace: land objects into zones; position is the only source of truth.
   Every spatial operation has a keyboard equivalent (acceptance seed). */
(function () {
  "use strict";

  // ---------- constants ----------
  var G = 20;             // grid unit (world px)
  var OBJ_W = 96, OBJ_H = 64;
  var REGION_W = 360, REGION_H = 240;
  var ZOOM_MIN = 0.25, ZOOM_MAX = 2.5;
  var STORE_KEY = "plotboard.v1";
  var PALETTE = ["#5b8def", "#3fbf8f", "#e8a33d", "#8d7ae5", "#4fc3dd", "#c973b8", "#9ccc50", "#e06c75"];

  // ---------- initial scene (inlined: first paint is immediately usable) ----------
  function scene() {
    return {
      seq: 114,
      regions: [
        { id: "z1", name: "Entrance Hall", x: 80,  y: 80,  w: 480, h: 360 },
        { id: "z2", name: "Main Gallery",  x: 600, y: 80,  w: 560, h: 540 },
        { id: "z3", name: "North Wing",    x: 80,  y: 480, w: 480, h: 340 },
        { id: "z4", name: "Archive",       x: 1200, y: 80, w: 320, h: 540 }
      ],
      objects: [
        { id: "o1",  name: "Ticket Desk",  x: 120, y: 120 },
        { id: "o2",  name: "Info Panel",   x: 120, y: 220 },
        { id: "o3",  name: "Coat Check",   x: 300, y: 120 },
        { id: "o4",  name: "Bronze Helm",  x: 660, y: 140 },
        { id: "o5",  name: "Stone Stele",  x: 660, y: 300 },
        { id: "o6",  name: "Tapestry",     x: 900, y: 140 },
        { id: "o7",  name: "Vitrine Set",  x: 900, y: 300 },
        { id: "o8",  name: "Prints Rack",  x: 120, y: 540 },
        { id: "o9",  name: "Sketch Wall",  x: 300, y: 540 },
        { id: "o10", name: "Prep Table",   x: 120, y: 680 },
        { id: "o11", name: "Crate 7",      x: 1260, y: 140 },
        { id: "o12", name: "Flat File",    x: 1260, y: 300 },
        { id: "o13", name: "Rolling Cart", x: 660, y: 700 }
      ]
    };
  }

  // ---------- state ----------
  var state = {
    seq: 0,
    regions: [],
    objects: [],
    sel: null,        // {kind:'object'|'region', id} — primary selection
    selMany: null,    // [ids] when select-all is active
    placing: null,    // {kind:'object'|'region', x, y}
    renaming: null,   // {kind, id}
    snap: true,
    zoom: 1, panX: 0, panY: 0,
    cursor: null,     // {x, y} world
    landing: null,    // region id under ghost / dragged selection
    flash: null,      // transient status message
    storageOK: true
  };

  // ---------- dom ----------
  var $ = function (id) { return document.getElementById(id); };
  var viewport, world, zoneLayer, objLayer, fxLayer, emptyState;
  var zoneListEl, floorRowEl, inspectorEl;
  var statusHint, statusCoords, statusStats;
  var helpOverlay, btnReset, btnSnap, btnZoomLabel;

  // ---------- helpers ----------
  function snap(v) { return state.snap ? Math.round(v / G) * G : Math.round(v); }
  function byId(kind, id) {
    var arr = kind === "region" ? state.regions : state.objects;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }
  function centerOf(o) {
    var s = o.w ? o : { w: OBJ_W, h: OBJ_H };
    return { x: o.x + s.w / 2, y: o.y + s.h / 2 };
  }
  function zoneAt(cx, cy) {
    for (var i = 0; i < state.regions.length; i++) {
      var r = state.regions[i];
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return r;
    }
    return null;
  }
  function zoneOf(o) { var c = centerOf(o); return zoneAt(c.x, c.y); }
  function zoneColor(i) { return PALETTE[i % PALETTE.length]; }
  function zoneIndex(id) {
    for (var i = 0; i < state.regions.length; i++) if (state.regions[i].id === id) return i;
    return -1;
  }
  function nearestTo(o) {
    var c1 = centerOf(o), best = null, bd = Infinity;
    for (var i = 0; i < state.objects.length; i++) {
      var t = state.objects[i];
      if (t.id === o.id) continue;
      var c2 = centerOf(t);
      var d = Math.hypot(c2.x - c1.x, c2.y - c1.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best ? { obj: best, dist: bd } : null;
  }
  function overlaps(x, y, w, h, ignoreId) {
    for (var i = 0; i < state.objects.length; i++) {
      var o = state.objects[i];
      if (o.id === ignoreId) continue;
      if (x < o.x + OBJ_W && x + w > o.x && y < o.y + OBJ_H && y + h > o.y) return true;
    }
    return false;
  }
  function findSlot(region, ignoreId) {
    for (var y = region.y + G; y + OBJ_H <= region.y + region.h - G / 2; y += G) {
      for (var x = region.x + G; x + OBJ_W <= region.x + region.w - G / 2; x += G) {
        if (!overlaps(x, y, OBJ_W, OBJ_H, ignoreId)) return { x: x, y: y };
      }
    }
    return { x: snap(region.x + region.w / 2 - OBJ_W / 2), y: snap(region.y + region.h / 2 - OBJ_H / 2) };
  }
  function selectedObjects() {
    if (state.selMany) return state.objects.filter(function (o) { return state.selMany.indexOf(o.id) >= 0; });
    if (state.sel && state.sel.kind === "object") {
      var o = byId("object", state.sel.id);
      return o ? [o] : [];
    }
    return [];
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- persistence (courtesy, never a loading state) ----------
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        v: 1, seq: state.seq, regions: state.regions, objects: state.objects, snap: state.snap
      }));
      if (!state.storageOK) { state.storageOK = true; renderStatus(); }
    } catch (e) {
      if (state.storageOK) { state.storageOK = false; renderStatus(); }
    }
  }
  var saveDebounced = null;
  function queueSave() {
    if (saveDebounced) clearTimeout(saveDebounced);
    saveDebounced = setTimeout(save, 250);
  }
  function load() {
    var fresh = scene();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) { applyScene(fresh); return; }
      var data = JSON.parse(raw);
      if (!data || data.v !== 1 || !Array.isArray(data.regions) || !Array.isArray(data.objects)) {
        applyScene(fresh); return;
      }
      state.seq = data.seq || 1000;
      state.regions = data.regions;
      state.objects = data.objects;
      state.snap = !!data.snap;
    } catch (e) {
      state.storageOK = false;
      applyScene(fresh);
    }
  }
  function applyScene(s) {
    state.seq = s.seq;
    state.regions = JSON.parse(JSON.stringify(s.regions));
    state.objects = JSON.parse(JSON.stringify(s.objects));
  }

  // ---------- view ----------
  function applyView() {
    world.style.transform = "translate(" + state.panX + "px," + state.panY + "px) scale(" + state.zoom + ")";
    viewport.style.backgroundSize =
      (G * 5 * state.zoom) + "px " + (G * 5 * state.zoom) + "px," +
      (G * 5 * state.zoom) + "px " + (G * 5 * state.zoom) + "px," +
      (G * state.zoom) + "px " + (G * state.zoom) + "px," +
      (G * state.zoom) + "px " + (G * state.zoom) + "px";
    viewport.style.backgroundPosition =
      state.panX + "px " + state.panY + "px," + state.panX + "px " + state.panY + "px," +
      state.panX + "px " + state.panY + "px," + state.panX + "px " + state.panY + "px";
    if (btnZoomLabel) btnZoomLabel.textContent = Math.round(state.zoom * 100) + "%";
  }
  function contentBBox() {
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity, any = false;
    function acc(x, y, w, h) {
      any = true;
      x1 = Math.min(x1, x); y1 = Math.min(y1, y);
      x2 = Math.max(x2, x + w); y2 = Math.max(y2, y + h);
    }
    state.regions.forEach(function (r) { acc(r.x, r.y, r.w, r.h); });
    state.objects.forEach(function (o) { acc(o.x, o.y, OBJ_W, OBJ_H); });
    return any ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : { x: 0, y: 0, w: 800, h: 600 };
  }
  function fitView() {
    var b = contentBBox();
    var vw = viewport.clientWidth, vh = viewport.clientHeight;
    var z = Math.min((vw - 80) / b.w, (vh - 80) / b.h);
    z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    state.zoom = z;
    state.panX = (vw - b.w * z) / 2 - b.x * z;
    state.panY = (vh - b.h * z) / 2 - b.y * z;
    applyView();
  }
  function zoomAt(cx, cy, factor) {
    var z2 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom * factor));
    var k = z2 / state.zoom;
    state.panX = cx - (cx - state.panX) * k;
    state.panY = cy - (cy - state.panY) * k;
    state.zoom = z2;
    applyView();
    renderStatus();
  }
  function panBy(dx, dy) {
    state.panX += dx; state.panY += dy;
    applyView();
  }
  function toWorld(clientX, clientY) {
    var r = viewport.getBoundingClientRect();
    return { x: (clientX - r.left - state.panX) / state.zoom, y: (clientY - r.top - state.panY) / state.zoom };
  }
  function worldToScreen(x, y) {
    var r = viewport.getBoundingClientRect();
    return { x: r.left + x * state.zoom + state.panX, y: r.top + y * state.zoom + state.panY };
  }
  function ensureVisible(el) {
    var r = viewport.getBoundingClientRect();
    var p1 = worldToScreen(el.x, el.y), p2 = worldToScreen(el.x + (el.w || OBJ_W), el.y + (el.h || OBJ_H));
    var m = 70;
    if (p2.x < r.left + m) state.panX += (r.left + m - p2.x);
    if (p1.x > r.right - m) state.panX -= (p1.x - (r.right - m));
    if (p2.y < r.top + m) state.panY += (r.top + m - p2.y);
    if (p1.y > r.bottom - m) state.panY -= (p1.y - (r.bottom - m));
    applyView();
  }

  // ---------- selection ----------
  function select(kind, id) {
    state.sel = id ? { kind: kind, id: id } : null;
    state.selMany = null;
    state.landing = null;
    render();
  }
  function selectAllObjects() {
    if (!state.objects.length) return;
    state.selMany = state.objects.map(function (o) { return o.id; });
    state.sel = { kind: "object", id: state.selMany[0] };
    render();
    flash(state.objects.length + " tiles selected — arrows nudge all · 1–8 send all · Del removes");
  }
  function cycleSelection(dir) {
    var objs = state.objects;
    if (!objs.length) return;
    var idx = 0;
    if (state.sel && state.sel.kind === "object") {
      for (var i = 0; i < objs.length; i++) if (objs[i].id === state.sel.id) idx = i;
      idx = (idx + dir + objs.length) % objs.length;
    } else if (dir < 0) {
      idx = objs.length - 1;
    }
    var o = objs[idx];
    state.selMany = null;
    state.sel = { kind: "object", id: o.id };
    ensureVisible(o);
    render();
  }

  // ---------- mutations ----------
  function commitPlacing() {
    if (!state.placing) return;
    var p = state.placing;
    var item;
    if (p.kind === "region") {
      item = { id: "z" + (state.seq++), name: "Zone " + (state.regions.length + 1), x: p.x, y: p.y, w: REGION_W, h: REGION_H };
      state.regions.push(item);
    } else {
      item = { id: "o" + (state.seq++), name: "Tile " + (state.objects.length + 1), x: p.x, y: p.y };
      state.objects.push(item);
    }
    state.placing = null;
    state.selMany = null;
    state.sel = { kind: p.kind === "region" ? "region" : "object", id: item.id };
    queueSave();
    render();
    startRename(state.sel.kind, item.id);
    flash("Placed — 落位即意图. Name it:");
  }
  function startPlace(kind) {
    cancelRename(false);
    var vw = viewport.clientWidth, vh = viewport.clientHeight;
    var c = { x: (vw / 2 - state.panX) / state.zoom, y: (vh / 2 - state.panY) / state.zoom };
    state.placing = { kind: kind, x: snap(c.x - (kind === "region" ? REGION_W : OBJ_W) / 2), y: snap(c.y - (kind === "region" ? REGION_H : OBJ_H) / 2) };
    updateLanding();
    render();
  }
  function movePlacing(dx, dy) {
    var p = state.placing;
    if (!p) return;
    p.x = snap(p.x + dx); p.y = snap(p.y + dy);
    updateLanding();
    renderGhostAndLanding();
    renderStatus();
  }
  function updateLanding() {
    var target = null;
    if (state.placing) {
      var s = state.placing.kind === "region" ? { w: REGION_W, h: REGION_H } : { w: OBJ_W, h: OBJ_H };
      target = zoneAt(state.placing.x + s.w / 2, state.placing.y + s.h / 2);
    } else {
      var objs = selectedObjects();
      if (objs.length) { var c = centerOf(objs[0]); target = zoneAt(c.x, c.y); }
    }
    state.landing = target ? target.id : null;
  }
  function nudge(dx, dy, coarse) {
    var step = state.snap ? G : 1;
    if (coarse) step *= 5;
    // regions move with arrows too (keyboard parity for every spatial op)
    if (state.sel && state.sel.kind === "region") {
      var r = byId("region", state.sel.id);
      if (r) {
        r.x = snap(r.x + dx * step); r.y = snap(r.y + dy * step);
        updateLanding(); ensureVisible(r); queueSave(); render();
      }
      return;
    }
    var objs = selectedObjects();
    // no selection: arrows pan the view, matching WASD semantics (ArrowUp looks up)
    if (!objs.length) { panBy(-dx * 40, -dy * 40); return; }
    objs.forEach(function (o) { o.x = snap(o.x + dx * step); o.y = snap(o.y + dy * step); });
    updateLanding();
    ensureVisible(objs[0]);
    queueSave();
    render();
  }
  function duplicateSelection() {
    var objs = selectedObjects();
    if (objs.length !== 1) return;
    var src = objs[0];
    var x = snap(src.x + G + G / 2), y = snap(src.y + G + G / 2), tries = 0;
    while (overlaps(x, y, OBJ_W, OBJ_H, null) && tries++ < 40) { x = snap(x + G); if (tries % 8 === 0) { x = snap(src.x); y = snap(y + G); } }
    var copy = { id: "o" + (state.seq++), name: src.name + " copy", x: x, y: y };
    state.objects.push(copy);
    state.selMany = null;
    state.sel = { kind: "object", id: copy.id };
    ensureVisible(copy);
    queueSave();
    render();
    flash("Duplicated — " + copy.name);
  }
  function deleteSelection() {
    if (state.selMany) {
      var ids = state.selMany;
      state.objects = state.objects.filter(function (o) { return ids.indexOf(o.id) < 0; });
      state.sel = null; state.selMany = null;
      queueSave(); render();
      flash(ids.length + " tiles removed");
      return;
    }
    if (!state.sel) return;
    if (state.sel.kind === "region") {
      var r = byId("region", state.sel.id);
      state.regions = state.regions.filter(function (z) { return z.id !== r.id; });
      flash('Zone "' + r.name + '" removed — its tiles stay on the floor');
    } else {
      var o = byId("object", state.sel.id);
      state.objects = state.objects.filter(function (t) { return t.id !== o.id; });
      flash('Tile "' + o.name + '" removed');
    }
    state.sel = null;
    queueSave(); render();
  }
  function sendToZone(idx) {
    var region = state.regions[idx];
    var objs = selectedObjects();
    if (!region) { flash("No zone " + (idx + 1)); return; }
    if (!objs.length) { flash("Select a tile first (Tab), then press " + (idx + 1)); return; }
    objs.forEach(function (o) {
      var slot = findSlot(region, o.id);
      o.x = slot.x; o.y = slot.y;
    });
    state.selMany = null;
    state.sel = { kind: "object", id: objs[0].id };
    ensureVisible(objs[0]);
    queueSave(); render();
    flash("Sent to " + region.name + " — " + (zoneOf(objs[0]) === region ? "membership derived ✓" : "no room, landed beside it"));
  }
  function reorder(dir) {
    if (!state.sel || state.sel.kind !== "object") return;
    var o = byId("object", state.sel.id);
    var i = state.objects.indexOf(o);
    state.objects.splice(i, 1);
    if (dir > 0) state.objects.push(o); else state.objects.unshift(o);
    queueSave(); render();
  }

  // ---------- rename ----------
  function startRename(kind, id) {
    cancelRename(false);
    var el = document.querySelector('.tile[data-id="' + id + '"], .zone-chip[data-id="' + id + '"]');
    var item = byId(kind, id);
    if (!el || !item) return;
    var rect = el.getBoundingClientRect();
    var input = document.createElement("input");
    input.className = "rename-input";
    input.value = item.name;
    input.setAttribute("aria-label", "Rename " + item.name);
    var pw = rect.width, ph = Math.max(28, rect.height);
    input.style.left = rect.left + "px";
    input.style.top = rect.top + (rect.height - ph) / 2 + "px";
    input.style.width = pw + "px";
    input.style.height = ph + "px";
    document.body.appendChild(input);
    input.focus();
    input.select();
    state.renaming = { kind: kind, id: id, input: input };
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); cancelRename(true); }
      else if (e.key === "Escape") { e.preventDefault(); cancelRename(false); }
    });
    input.addEventListener("blur", function () { if (state.renaming) cancelRename(true); });
  }
  function cancelRename(apply) {
    var r = state.renaming;
    if (!r) return;
    state.renaming = null;
    var val = r.input.value.trim();
    r.input.remove();
    if (apply && val) {
      var item = byId(r.kind, r.id);
      if (item) item.name = val;
      queueSave();
    }
    render();
  }

  // ---------- render ----------
  function render() {
    renderWorld();
    renderRail();
    renderInspector();
    renderStatus();
    renderToolbar();
  }

  function renderWorld() {
    var landingId = state.landing;
    var zh = "";
    state.regions.forEach(function (r, i) {
      var count = 0;
      state.objects.forEach(function (o) { if (zoneOf(o) === r) count++; });
      zh += '<div class="zone' + (r.id === landingId ? " landed" : "") + '" data-id="' + r.id + '" style="left:' + r.x + "px;top:" + r.y + "px;width:" + r.w + "px;height:" + r.h + 'px;--zc:' + zoneColor(i) + '">' +
        '<button class="zone-chip" data-id="' + r.id + '" title="Zone — click to select, double-click to rename" style="--zc:' + zoneColor(i) + '">' +
        '<span class="z-chip-name">' + esc(r.name) + "</span>" +
        '<span class="z-count">' + count + "</span>" +
        (i < 8 ? "<kbd>" + (i + 1) + "</kbd>" : "") +
        "</button></div>";
    });
    zoneLayer.innerHTML = zh;

    var oh = "";
    state.objects.forEach(function (o, i) {
      var z = zoneOf(o);
      var zIdx = z ? zoneIndex(z.id) : -1;
      var isSel = state.sel && state.sel.kind === "object" && state.sel.id === o.id;
      var inMany = state.selMany && state.selMany.indexOf(o.id) >= 0;
      oh += '<div class="tile' + (isSel || inMany ? " selected" : "") + '" data-id="' + o.id + '"' +
        ' style="left:' + o.x + "px;top:" + o.y + "px;z-index:" + (10 + i) + ';--zc:' + (zIdx >= 0 ? zoneColor(zIdx) : "transparent") + '"' +
        ' role="button" aria-label="' + esc(o.name) + (z ? " in " + esc(z.name) : " on the floor, outside every zone") + '">' +
        '<span class="t-dot' + (z ? "" : " hollow") + '" title="' + (z ? esc(z.name) : "unassigned") + '"></span>' +
        '<span class="t-name">' + esc(o.name) + "</span></div>";
    });
    objLayer.innerHTML = oh;

    renderGhostAndLanding();
  }

  function renderGhostAndLanding() {
    var gh = "";
    if (state.placing) {
      var p = state.placing;
      var w = p.kind === "region" ? REGION_W : OBJ_W;
      var h = p.kind === "region" ? REGION_H : OBJ_H;
      gh += '<div class="ghost" style="left:' + p.x + "px;top:" + p.y + "px;width:" + w + "px;height:" + h + 'px">' +
        (p.kind === "region" ? "NEW ZONE" : "NEW TILE") + "</div>";
    }
    // relation link for the selection (derived, never stored)
    if (state.sel && state.sel.kind === "object" && !state.selMany) {
      var o = byId("object", state.sel.id);
      var near = o && nearestTo(o);
      if (near) {
        var c1 = centerOf(o), c2 = centerOf(near.obj);
        var len = Math.hypot(c2.x - c1.x, c2.y - c1.y);
        var ang = Math.atan2(c2.y - c1.y, c2.x - c1.x);
        gh += '<div class="link" style="left:' + c1.x + "px;top:" + c1.y + "px;width:" + len + "px;transform:rotate(" + ang + 'rad)"></div>' +
          '<div class="link-label" style="left:' + ((c1.x + c2.x) / 2) + "px;top:" + ((c1.y + c2.y) / 2) + 'px">' +
          (len / G).toFixed(1) + " u — " + esc(near.obj.name) + "</div>";
      }
    }
    fxLayer.innerHTML = gh;
    emptyState.hidden = !(state.objects.length === 0 && !state.placing);
  }

  function renderRail() {
    var lh = "";
    state.regions.forEach(function (r, i) {
      var count = 0;
      state.objects.forEach(function (o) { if (zoneOf(o) === r) count++; });
      var isSel = state.sel && state.sel.kind === "region" && state.sel.id === r.id;
      lh += '<li><button class="zone-row' + (isSel ? " selected" : "") + '" data-id="' + r.id + '" style="--z-dot:' + zoneColor(i) + '"' +
        ' title="Select zone">' +
        '<span class="z-dot"></span><span class="z-name">' + esc(r.name) + "</span>" +
        '<span class="z-count">' + count + "</span>" +
        (i < 8 ? "<kbd>" + (i + 1) + "</kbd>" : "") +
        "</button></li>";
    });
    zoneListEl.innerHTML = lh;
    var un = 0;
    state.objects.forEach(function (o) { if (!zoneOf(o)) un++; });
    floorRowEl.innerHTML = '<span class="z-dot hollow"></span><span class="z-name">Floor · unassigned</span><span class="z-count">' + un + "</span>";
  }

  function renderInspector() {
    var h = '<h2>Inspector</h2>';
    if (state.selMany) {
      h += '<div class="insp-title">' + state.selMany.length + " tiles selected</div>" +
        '<div class="insp-kind">multi-selection</div>' +
        '<div class="insp-kbd-list">' +
        "<div><kbd>↑↓←→</kbd> nudge all (Shift ×5)</div>" +
        "<div><kbd>1</kbd>–<kbd>8</kbd> send all to zone n</div>" +
        "<div><kbd>Del</kbd> remove all</div>" +
        "<div><kbd>Esc</kbd> deselect all</div></div>";
      inspectorEl.innerHTML = h;
      return;
    }
    if (state.sel && state.sel.kind === "object") {
      var o = byId("object", state.sel.id);
      if (!o) { state.sel = null; inspectorEl.innerHTML = h; return; }
      var z = zoneOf(o);
      var near = nearestTo(o);
      var zIdx = z ? zoneIndex(z.id) : -1;
      h += '<div class="insp-title">' + esc(o.name) + "</div>" +
        '<div class="insp-kind">placed object · ' + o.id + "</div><dl>" +
        '<div class="fact"><dt>Zone</dt><dd>' +
        (z ? '<span class="z-dot" style="--zc:' + zoneColor(zIdx) + '"></span>' + esc(z.name) : '<span class="z-dot hollow"></span><span class="mut">floor — outside every zone</span>') +
        "</dd></div>" +
        '<div class="fact"><dt>Position</dt><dd>col ' + Math.round(o.x / G) + " · row " + Math.round(o.y / G) + " <span class=\"mut\">(" + o.x + ", " + o.y + ")</span></dd></div>" +
        '<div class="fact"><dt>Nearest</dt><dd>' + (near ? esc(near.obj.name) + " · " + (near.dist / G).toFixed(1) + " u" : '<span class="mut">— alone on the floor</span>') + "</dd></div>" +
        "</dl>" +
        '<div class="insp-actions">' +
        '<button data-act="duplicate">Duplicate <kbd>D</kbd></button>' +
        '<button data-act="delete" class="danger">Delete <kbd>Del</kbd></button>' +
        "</div>" +
        '<p class="insp-note">Facts above derive from position alone — zone membership is containment, "nearest" is center distance. Move the tile and they re-derive. 落位即意图.</p>';
    } else if (state.sel && state.sel.kind === "region") {
      var rg = byId("region", state.sel.id);
      if (!rg) { state.sel = null; inspectorEl.innerHTML = h; return; }
      var count = 0;
      state.objects.forEach(function (t) { if (zoneOf(t) === rg) count++; });
      var rIdx = zoneIndex(rg.id);
      h += '<div class="insp-title">' + esc(rg.name) + "</div>" +
        '<div class="insp-kind">zone · key ' + (rIdx < 8 ? rIdx + 1 : "—") + "</div><dl>" +
        '<div class="fact"><dt>Occupancy</dt><dd>' + count + " tile" + (count === 1 ? "" : "s") + "</dd></div>" +
        '<div class="fact"><dt>Rect</dt><dd>' + rg.x + ", " + rg.y + " · " + rg.w + "×" + rg.h + "</dd></div>" +
        "</dl>" +
        '<div class="insp-actions">' +
        '<button data-act="rename">Rename <kbd>Enter</kbd></button>' +
        '<button data-act="delete" class="danger">Delete zone <kbd>Del</kbd></button>' +
        "</div>" +
        '<p class="insp-note">Membership is read off position: a tile whose center is inside this rect belongs here. Deleting the zone never deletes tiles.</p>';
    } else {
      h += '<div class="insp-empty"><div class="insp-title">Nothing selected</div>' +
        '<div class="insp-kind">derived facts appear here</div>' +
        '<div class="insp-kbd-list">' +
        "<div><kbd>Tab</kbd> cycle tiles</div>" +
        "<div><kbd>N</kbd> new object</div>" +
        "<div><kbd>R</kbd> new zone</div>" +
        "<div><kbd>?</kbd> keyboard map</div>" +
        "<div><kbd>0</kbd> fit view</div></div>" +
        '<p class="insp-note">Click a tile or a zone chip to inspect. Everything the inspector shows is computed from where things sit — nothing is entered via forms.</p></div>';
    }
    inspectorEl.innerHTML = h;
  }

  function renderStatus() {
    var landingTxt = "";
    if (state.placing) {
      var z = state.landing ? byId("region", state.landing) : null;
      landingTxt = ' — landing → <span class="landing">' + (z ? esc(z.name) : "floor (unassigned)") + "</span>";
    }
    var hint;
    if (state.flash) hint = '<span class="flash">' + esc(state.flash) + "</span>";
    else if (state.placing) hint = "Placing " + (state.placing.kind === "region" ? "zone" : "object") + " — arrows position · Enter drops · Esc cancels" + landingTxt;
    else if (state.sel) hint = "Selected — arrows nudge · Enter renames · Del removes" + (state.landing ? " — landing → " + esc((byId("region", state.landing) || {}).name || "floor") : "");
    else hint = "Ready — Tab selects · N new object · R new zone · ? keyboard map";
    statusHint.innerHTML = hint;
    statusCoords.textContent = state.cursor
      ? "x " + Math.floor(state.cursor.x / G) + " · y " + Math.floor(state.cursor.y / G) + " u"
      : "—";
    var stats = state.objects.length + " tiles · " + state.regions.length + " zones · " + Math.round(state.zoom * 100) + "% · snap " + (state.snap ? "on" : "off");
    if (!state.storageOK) stats += ' · <span class="warn">autosave unavailable</span>';
    statusStats.innerHTML = stats;
  }

  function renderToolbar() {
    btnSnap.setAttribute("aria-pressed", state.snap ? "true" : "false");
  }

  var flashTimer = null;
  function flash(msg) {
    state.flash = msg;
    renderStatus();
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { state.flash = null; renderStatus(); }, 2200);
  }

  // ---------- pointer interactions ----------
  var drag = null; // {mode:'move'|'pan', ...}

  function onPointerDown(e) {
    if (helpOverlay && !helpOverlay.hidden) return;
    closeHelpIfOutside(e);

    if (state.placing && e.button === 0) {
      var wpt = toWorld(e.clientX, e.clientY);
      var p = state.placing;
      var s = p.kind === "region" ? { w: REGION_W, h: REGION_H } : { w: OBJ_W, h: OBJ_H };
      p.x = snap(wpt.x - s.w / 2); p.y = snap(wpt.y - s.h / 2);
      updateLanding();
      commitPlacing();
      return;
    }
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      drag = { mode: "pan", sx: e.clientX, sy: e.clientY, px: state.panX, py: state.panY };
      viewport.classList.add("panning");
      e.preventDefault();
      return;
    }
    if (e.button !== 0) return;

    var tileEl = e.target.closest(".tile");
    if (tileEl) {
      var id = tileEl.getAttribute("data-id");
      var multi = state.selMany && state.selMany.indexOf(id) >= 0;
      if (!multi) {
        state.selMany = null;
        state.sel = { kind: "object", id: id };
      }
      var objs = selectedObjects();
      var origins = {};
      objs.forEach(function (o) { origins[o.id] = { x: o.x, y: o.y }; });
      var start = toWorld(e.clientX, e.clientY);
      drag = { mode: "move", start: start, origins: origins, primary: objs[0], moved: false };
      updateLanding();
      render();
      return;
    }
    var chipEl = e.target.closest(".zone-chip");
    if (chipEl) {
      select("region", chipEl.getAttribute("data-id"));
      return;
    }
    if (e.target === viewport || e.target === world || e.target === zoneLayer || e.target === objLayer || e.target === fxLayer) {
      if (state.sel || state.selMany) select(null);
    }
  }

  function onPointerMove(e) {
    var wpt = toWorld(e.clientX, e.clientY);
    state.cursor = wpt;
    if (drag && drag.mode === "pan") {
      state.panX = drag.px + (e.clientX - drag.sx);
      state.panY = drag.py + (e.clientY - drag.sy);
      applyView();
    } else if (drag && drag.mode === "move") {
      var dx = wpt.x - drag.start.x, dy = wpt.y - drag.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) drag.moved = true;
      var sdx = snap(dx), sdy = snap(dy);
      Object.keys(drag.origins).forEach(function (oid) {
        var o = byId("object", oid);
        if (!o) return;
        o.x = drag.origins[oid].x + sdx;
        o.y = drag.origins[oid].y + sdy;
        var el = document.querySelector('.tile[data-id="' + oid + '"]');
        if (el) { el.style.left = o.x + "px"; el.style.top = o.y + "px"; }
      });
      updateLanding();
      renderLandingOnly();
    } else if (state.placing) {
      var p = state.placing;
      var s = p.kind === "region" ? { w: REGION_W, h: REGION_H } : { w: OBJ_W, h: OBJ_H };
      p.x = snap(wpt.x - s.w / 2); p.y = snap(wpt.y - s.h / 2);
      updateLanding();
      renderGhostAndLanding();
    }
    renderCoords();
  }

  function renderLandingOnly() {
    zoneLayer.querySelectorAll(".zone").forEach(function (el) {
      el.classList.toggle("landed", el.getAttribute("data-id") === state.landing);
    });
    renderStatus();
  }
  function renderCoords() {
    statusCoords.textContent = state.cursor
      ? "x " + Math.floor(state.cursor.x / G) + " · y " + Math.floor(state.cursor.y / G) + " u"
      : "—";
  }

  function onPointerUp() {
    if (drag && drag.mode === "move" && drag.moved) {
      queueSave();
      render();
      flash("Moved — zone membership re-derived");
    }
    drag = null;
    viewport.classList.remove("panning");
  }

  function onWheel(e) {
    e.preventDefault();
    var r = viewport.getBoundingClientRect();
    zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  }

  function onDblClick(e) {
    var tileEl = e.target.closest(".tile");
    if (tileEl) { startRename("object", tileEl.getAttribute("data-id")); return; }
    var chipEl = e.target.closest(".zone-chip");
    if (chipEl) { startRename("region", chipEl.getAttribute("data-id")); return; }
    if (!state.placing) {
      var wpt = toWorld(e.clientX, e.clientY);
      var item = { id: "o" + (state.seq++), name: "Tile " + (state.objects.length + 1), x: snap(wpt.x - OBJ_W / 2), y: snap(wpt.y - OBJ_H / 2) };
      state.objects.push(item);
      state.selMany = null;
      state.sel = { kind: "object", id: item.id };
      queueSave();
      render();
      startRename("object", item.id);
      flash("Placed at cursor — name it:");
    }
  }

  // ---------- keyboard ----------
  var spaceDown = false;
  function isTyping(el) {
    return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  }
  function activeIsWorkspace() {
    var a = document.activeElement;
    return !a || a === document.body || a === viewport;
  }

  function onKeyDown(e) {
    if (isTyping(e.target)) return; // rename input handles its own keys

    // help overlay: Esc / ? close
    if (!helpOverlay.hidden) {
      if (e.key === "Escape" || e.key === "?") { e.preventDefault(); toggleHelp(false); }
      return;
    }
    if (e.key === "Escape") {
      if (state.placing) { state.placing = null; state.landing = null; render(); flash("Placing cancelled"); }
      else if (state.sel || state.selMany) select(null);
      viewport.focus({ preventScroll: true });
      return;
    }
    if (e.key === "?") { e.preventDefault(); toggleHelp(); return; }

    // placing mode: arrows + Enter only
    if (state.placing) {
      var step = state.snap ? G : 1;
      if (e.shiftKey) step *= 5;
      switch (e.key) {
        case "ArrowUp": e.preventDefault(); movePlacing(0, -step); return;
        case "ArrowDown": e.preventDefault(); movePlacing(0, step); return;
        case "ArrowLeft": e.preventDefault(); movePlacing(-step, 0); return;
        case "ArrowRight": e.preventDefault(); movePlacing(step, 0); return;
        case "Enter": e.preventDefault(); commitPlacing(); return;
      }
      return;
    }

    var ws = activeIsWorkspace();

    if (e.key === "Tab" && ws) {
      e.preventDefault();
      cycleSelection(e.shiftKey ? -1 : 1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A") && ws) {
      e.preventDefault();
      selectAllObjects();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
      e.preventDefault();
      duplicateSelection();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser combos alone

    // focus context: the rest applies when the workspace (not a control) has focus
    if (!ws) return;

    switch (e.key) {
      case "ArrowUp": e.preventDefault(); nudge(0, -1, e.shiftKey); return;
      case "ArrowDown": e.preventDefault(); nudge(0, 1, e.shiftKey); return;
      case "ArrowLeft": e.preventDefault(); nudge(-1, 0, e.shiftKey); return;
      case "ArrowRight": e.preventDefault(); nudge(1, 0, e.shiftKey); return;
      case "Enter":
        if (state.sel) { e.preventDefault(); startRename(state.sel.kind, state.sel.id); }
        return;
      case "Delete":
      case "Backspace":
        if (state.sel || state.selMany) { e.preventDefault(); deleteSelection(); }
        return;
      case "n": case "N": e.preventDefault(); startPlace("object"); return;
      case "r": case "R": e.preventDefault(); startPlace("region"); return;
      case "g": case "G":
        state.snap = !state.snap;
        renderToolbar(); renderStatus();
        flash("Grid snap " + (state.snap ? "on" : "off"));
        return;
      case "=": case "+": zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.2); return;
      case "-": case "_": zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.2); return;
      case "0": fitView(); return;
      case "f": case "F": {
        var sel = selectedObjects()[0] || (state.sel && state.sel.kind === "region" ? byId("region", state.sel.id) : null);
        if (sel) {
          var c = centerOf(sel);
          state.panX = viewport.clientWidth / 2 - c.x * state.zoom;
          state.panY = viewport.clientHeight / 2 - c.y * state.zoom;
          applyView();
        }
        return;
      }
      case "[": reorder(-1); return;
      case "]": reorder(1); return;
      case " ": e.preventDefault(); spaceDown = true; return;
    }

    // pan WASD (D included — duplicate lives on Ctrl+D)
    var panStep = 44;
    if (e.key === "w" || e.key === "W") { e.preventDefault(); panBy(0, panStep); return; }
    if (e.key === "s" || e.key === "S") { e.preventDefault(); panBy(0, -panStep); return; }
    if (e.key === "a" || e.key === "A") { e.preventDefault(); panBy(panStep, 0); return; }
    if (e.key === "d" || e.key === "D") { e.preventDefault(); panBy(-panStep, 0); return; }

    // send-to-zone 1..8
    if (e.key >= "1" && e.key <= "8") {
      sendToZone(Number(e.key) - 1);
      return;
    }
  }
  function onKeyUp(e) {
    if (e.key === " ") spaceDown = false;
  }

  // ---------- help overlay ----------
  function toggleHelp(force) {
    var show = typeof force === "boolean" ? force : helpOverlay.hidden;
    helpOverlay.hidden = !show;
    if (show) $("btnHelpClose").focus();
    else viewport.focus({ preventScroll: true });
  }
  function closeHelpIfOutside(e) {
    if (!helpOverlay.hidden && !e.target.closest(".help-card")) toggleHelp(false);
  }

  // ---------- reset (two-step confirm, no native dialogs) ----------
  var resetArm = null;
  function onResetClick() {
    if (!btnReset.classList.contains("confirm")) {
      btnReset.classList.add("confirm");
      btnReset.textContent = "Really reset?";
      resetArm = setTimeout(function () { disarmReset(); }, 3000);
      return;
    }
    disarmReset();
    try { localStorage.removeItem(STORE_KEY); } catch (err) { /* noop */ }
    applyScene(scene());
    state.sel = null; state.selMany = null; state.placing = null; state.landing = null;
    fitView();
    render();
    flash("Scene reset to the built-in demo floor");
  }
  function disarmReset() {
    if (resetArm) clearTimeout(resetArm);
    resetArm = null;
    btnReset.classList.remove("confirm");
    btnReset.textContent = "Reset scene";
  }

  // ---------- boot ----------
  function boot() {
    viewport = $("viewport"); world = $("world");
    zoneLayer = $("zoneLayer"); objLayer = $("objLayer"); fxLayer = $("fxLayer");
    emptyState = $("emptyState");
    zoneListEl = $("zoneList"); floorRowEl = $("floorRow"); inspectorEl = $("inspector");
    statusHint = $("statusHint"); statusCoords = $("statusCoords"); statusStats = $("statusStats");
    helpOverlay = $("helpOverlay"); btnReset = $("btnReset"); btnSnap = $("btnSnap"); btnZoomLabel = $("btnZoomLabel");

    load();
    fitView();
    render();

    // pointer
    viewport.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("wheel", onWheel, { passive: false });
    viewport.addEventListener("dblclick", onDblClick);

    // keyboard
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // rail (delegated)
    zoneListEl.addEventListener("click", function (e) {
      var row = e.target.closest(".zone-row");
      if (!row) return;
      var id = row.getAttribute("data-id");
      var r = byId("region", id);
      select("region", id);
      if (r) ensureVisible(r);
    });

    // inspector buttons (delegated)
    inspectorEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-act]");
      if (!b) return;
      if (b.getAttribute("data-act") === "delete") deleteSelection();
      if (b.getAttribute("data-act") === "duplicate") duplicateSelection();
      if (b.getAttribute("data-act") === "rename" && state.sel) startRename(state.sel.kind, state.sel.id);
    });

    // toolbar — every action hands focus back to the canvas so shortcuts keep flowing
    function refocus() { viewport.focus({ preventScroll: true }); }
    $("btnNewObject").addEventListener("click", function () { startPlace("object"); refocus(); });
    $("btnNewZone").addEventListener("click", function () { startPlace("region"); refocus(); });
    btnSnap.addEventListener("click", function () {
      state.snap = !state.snap; renderToolbar(); renderStatus(); refocus();
    });
    $("btnZoomIn").addEventListener("click", function () { zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.2); refocus(); });
    $("btnZoomOut").addEventListener("click", function () { zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.2); refocus(); });
    btnZoomLabel.addEventListener("click", function () { fitView(); refocus(); });
    $("btnFit").addEventListener("click", function () { fitView(); refocus(); });
    $("btnKeys").addEventListener("click", function () { toggleHelp(); });
    $("btnHelpClose").addEventListener("click", function () { toggleHelp(false); });
    helpOverlay.addEventListener("click", closeHelpIfOutside);
    btnReset.addEventListener("click", function () { onResetClick(); refocus(); });

    window.addEventListener("resize", function () { applyView(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
