/* =====================================================================
 * selftest.js — 浏览器自证场景（仅 ?selftest=1 时激活；正常打开零影响）
 *
 * 通过真实 DOM 事件（click / input / change / keydown）驱动应用自身交互，
 * 逐阶段断言并把结果渲染进 #selftestPanel 与 #selftest-json，
 * 供无头浏览器截图与 DOM dump 作为运行证据。
 * 阶段语义：stage=N 表示从全新加载起顺序执行阶段 1..N（数据确定性种子）。
 * ===================================================================== */
(function () {
  "use strict";
  if (location.search.indexOf("selftest=1") < 0) return;

  var STAGE = Math.max(0, parseInt((location.search.match(/stage=(\d+)/) || [])[1] || "0", 10));
  var LOG = [];

  window.addEventListener("error", function (e) {
    LOG.push({ stage: STAGE, name: "jserror:" + e.message, pass: false, got: String(e.filename + ":" + e.lineno) });
    flush();
  });

  function log(name, pass, got) { LOG.push({ stage: STAGE, name: name, pass: !!pass, got: String(got) }); }
  function assertEq(name, got, want) { log(name + " [want=" + want + "]", got === want, "got=" + got); }
  function assertTrue(name, got) { log(name, !!got, "got=" + got); }

  function flush() {
    var panel = document.getElementById("selftestPanel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "selftestPanel";
      document.body.appendChild(panel);
      panel.appendChild(document.createElement("div")).id = "selftest-lines";
      var pre = document.createElement("pre");
      pre.id = "selftest-json";
      panel.appendChild(pre);
    }
    var lines = panel.querySelector("#selftest-lines");
    lines.replaceChildren();
    LOG.forEach(function (l) {
      var d = document.createElement("div");
      d.textContent = (l.pass ? "✓ " : "✗ ") + "S" + l.stage + " " + l.name + " — " + l.got;
      d.style.color = l.pass ? "#0a7a3d" : "#c0362c";
      lines.appendChild(d);
    });
    panel.querySelector("#selftest-json").textContent = JSON.stringify(LOG);
  }

  /* ---------- 驱动工具（全部走真实 DOM 事件） ---------- */
  function groupRowByName(text) {
    var rows = document.querySelectorAll("#treeGrid .trow.group-row");
    for (var i = 0; i < rows.length; i++) {
      var n = rows[i].querySelector(".c-name .name");
      if (n && n.textContent === text) return rows[i];
    }
    return null;
  }
  function entityRow(id) {
    return document.querySelector('#treeGrid [data-row="e:' + id + '"]');
  }
  function checkGroup(name) {
    var r = groupRowByName(name);
    var cb = r && r.querySelector('input[type="checkbox"]');
    if (cb && !cb.disabled) cb.click();
    return cb;
  }
  function setFilter(f) { document.querySelector('#statusSeg button[data-filter="' + f + '"]').click(); }
  function setQuery(q) {
    var i = document.getElementById("searchInput");
    i.value = q;
    i.dispatchEvent(new Event("input", { bubbles: true }));
  }
  function dialogBtn(text) {
    var btns = document.querySelectorAll("#modalRoot .dialog button");
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf(text) >= 0) return btns[i];
    }
    return null;
  }
  function receiptBtn(text) {
    var btns = document.querySelectorAll("#receiptSlot button");
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf(text) >= 0) return btns[i];
    }
    return null;
  }
  function counts() { return window.__REGISTRY__.counts(); }
  function entitiesByGroup(gid) { return window.__REGISTRY__.entitiesOfGroup(gid).map(function (e) { return e.id; }); }
  function selectedIds() { return Array.from(window.__REGISTRY__.state.selected); }

  /* ---------- 阶段（顺序累积执行） ---------- */
  var R = window.__REGISTRY__;

  function stage0() {
    assertEq("S0 total", counts().total, 160);
    assertEq("S0 selected", counts().selected, 0);
    assertEq("S0 visible", counts().visible, 160);
    assertTrue("S0 tree rows rendered", document.querySelectorAll("#treeGrid .trow").length > 100);
    assertEq("S0 phase ready", R.state.phase, "ready");
    assertTrue("S0 inspector empty-state", !!document.querySelector("#inspector .insp-empty"));
    assertTrue("S0 receipt absent", !document.querySelector("#receiptSlot .receipt"));
  }

  function stage1() {
    // 折叠「水务计量」（6 实体）→ 勾选系统「能耗计量系统」
    var wtr = groupRowByName("水务计量");
    wtr.querySelector("button.caret").click();
    assertEq("S1 visible after collapse", counts().visible, 154);
    var cb = checkGroup("能耗计量系统");
    assertEq("S1 selected (only rendered descendants)", counts().selected, 12);
    var bad = selectedIds().filter(function (id) { return R.entity(id).groupId === "sg-hq-ene-wtr"; });
    assertEq("S1 collapsed-unit entities selected", bad.length, 0);
    assertTrue("S1 checkbox fully checked over visible scope (not mixed)", !!cb && cb.checked === true && cb.indeterminate === false);
    assertEq("S1 system count chip shows subtree 18", groupRowByName("能耗计量系统").querySelector(".g-count").textContent, "0/18");
    assertEq("S1 inspector items", document.querySelectorAll("#inspector .insp-item").length, 12);
  }

  var retiredCount = 0;

  function stage2() {
    document.getElementById("btnClearSel").click();
    setFilter("retired");
    document.getElementById("btnSelectAll").click();
    assertEq("S2 selected == visible (retired scope)", counts().selected, counts().visible);
    assertTrue("S2 visible < total", counts().visible < counts().total);
    assertEq("S2 scope indicator shows retired only", document.getElementById("scope").textContent.indexOf("可见 " + counts().visible) >= 0, true);
  }

  function stage3() {
    var maintBefore = statusCount("maintenance");
    retiredCount = counts().selected; // = stage2 选中的全部停用实体
    setFilter("all");
    document.getElementById("btnStatus").click();
    var menuBtns = document.querySelectorAll("#menuSlot .menu button");
    var target = null;
    menuBtns.forEach(function (b) { if (b.textContent.indexOf("维护中") >= 0) target = b; });
    target.click();
    assertTrue("S3 preview dialog open", !!document.querySelector("#modalRoot .dialog"));
    var confirmBtn = dialogBtn("确认执行");
    assertEq("S3 preview affected count", confirmBtn.textContent, "确认执行（影响 " + retiredCount + " 项）");
    confirmBtn.click();
    assertTrue("S3 receipt shown", !!document.querySelector("#receiptSlot .receipt"));
    assertTrue("S3 receipt text", document.querySelector("#receiptSlot .receipt").textContent.indexOf("已影响 " + retiredCount + " 项") >= 0);
    assertEq("S3 maintenance after", statusCount("maintenance"), maintBefore + retiredCount);
    window.__S3 = { maintBefore: maintBefore, retired: retiredCount };
  }

  function stage4() {
    var before = window.__S3 || { maintBefore: statusCount("maintenance"), retired: 0 };
    receiptBtn("撤销此次操作").click();
    assertTrue("S4 receipt undone text", document.querySelector("#receiptSlot .receipt").textContent.indexOf("已撤销") >= 0);
    assertEq("S4 maintenance restored", statusCount("maintenance"), before.maintBefore);
    assertEq("S4 total intact", counts().total, 160);
  }

  function stage5() {
    document.getElementById("btnClearSel").click();
    checkGroup("温度监测");
    assertEq("S5 unit select count", counts().selected, 12);
    document.getElementById("btnMove").click();
    var sel = document.getElementById("moveTarget");
    // 5a: 目标 = 当前归属 → 显式 0 项错误状态
    sel.value = "sg-hq-env-temp";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    var err = document.querySelector("#modalRoot .dlg-error");
    assertTrue("S5 zero-effect error visible", !!err && err.textContent.indexOf("影响 0 项") >= 0);
    assertTrue("S5 confirm disabled at 0", dialogBtn("确认执行").disabled);
    // 5b: 有效目标 → 预览 12 项，取消保持选择
    sel.value = "sg-hq-env-hum";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    assertEq("S5 error cleared", !!document.querySelector("#modalRoot .dlg-error"), false);
    assertEq("S5 preview affected 12", dialogBtn("确认执行").textContent, "确认执行（影响 12 项）");
    dialogBtn("取消").click();
    assertEq("S5 selection preserved after cancel", counts().selected, 12);
    var still = entitiesByGroup("sg-hq-env-temp").length;
    assertEq("S5 no move executed", still, 12);
  }

  function stage6() {
    document.getElementById("btnClearSel").click();
    entityRow("E001").querySelector('input[type="checkbox"]').click();
    entityRow("E002").querySelector('input[type="checkbox"]').click();
    assertEq("S6 picked 2", counts().selected, 2);
    document.getElementById("btnDelete").click();
    dialogBtn("确认执行").click();
    assertEq("S6 total after delete", counts().total, 158);
    assertTrue("S6 receipt", document.querySelector("#receiptSlot .receipt").textContent.indexOf("已影响 2 项") >= 0);
    receiptBtn("撤销此次操作").click();
    assertEq("S6 total restored", counts().total, 160);
    assertTrue("S6 E001 back", !!window.__REGISTRY__.entity("E001"));
  }

  function stage7() {
    document.getElementById("btnClearSel").click();
    var rows = document.querySelectorAll("#treeGrid .trow.entity-row");
    var first = rows[0];
    first.focus();
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    var second = document.activeElement;
    assertTrue("S7 focus moved", second && second.closest && !!second.closest("#treeGrid"));
    second.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    assertEq("S7 space selects", counts().selected, 1);
    var rowId = second.getAttribute("data-row");
    assertEq("S7 selected is focused row", selectedIds()[0], rowId.slice(2));
  }

  function stage8() {
    setQuery("zzzz不存在");
    assertEq("S8 visible 0", counts().visible, 0);
    var empty = document.querySelector("#treeGrid .empty-state");
    assertTrue("S8 empty-state text", !!empty && empty.textContent.indexOf("无匹配实体") >= 0);
    // 清除筛选
    var btns = document.querySelectorAll("#treeGrid .empty-state button");
    btns[0].click();
    assertEq("S8 rows restored", counts().visible, 160);
  }

  function statusCount(st) {
    return window.__REGISTRY__.allEntities().filter(function (e) { return e.status === st; }).length;
  }

  /* ---------- 执行 ---------- */
  try {
    stage0();
    var seq = [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8];
    for (var i = 1; i <= STAGE && i <= seq.length; i++) seq[i - 1]();
  } catch (e) {
    log("exception: " + e.message, false, (e.stack || "").split("\n")[1] || "");
  }
  // 阶段标记进入 DOM，便于截图核对
  var tag = document.createElement("div");
  tag.id = "selftest-stage";
  tag.textContent = "SELFTEST stage=" + STAGE + " checks=" + LOG.length + " failed=" + LOG.filter(function (l) { return !l.pass; }).length;
  document.body.appendChild(tag);
  flush();
})();
