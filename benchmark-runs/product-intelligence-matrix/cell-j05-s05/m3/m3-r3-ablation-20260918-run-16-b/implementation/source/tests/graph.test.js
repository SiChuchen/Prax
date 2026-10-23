/* 单元测试：node tests/graph.test.js
   覆盖：图构建、BFS 方向语义（上游=出边 / 下游=入边）、闭包截断、
   具体路径还原、确定性分层布局、回路安全。 */
"use strict";
var A = require("../js/graph.js");
var DATA = require("./data-node.js");

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("  PASS  " + msg); }
  else { failed++; console.error("  FAIL  " + msg); }
}
function eqSet(actual, expected, msg) {
  var a = Array.isArray(actual) ? actual : Array.from(actual);
  var okFlag = a.length === expected.length &&
    expected.every(function (v) { return a.indexOf(v) >= 0; });
  ok(okFlag, msg + "（期望 [" + expected.join(", ") + "]，实际 [" + a.join(", ") + "]）");
}

/* ---- 1. 构建 ---- */
var g = A.buildGraph(DATA);
ok(g.nodes.size === 28, "节点数 = 28");
ok(g.edges.length === 55, "关系数 = 55");
ok(g.nodes.get("order-svc").out.some(function (e) { return e.to === "payment-svc"; }),
  "邻接表：order-svc 出边含 payment-svc（我依赖它）");
ok(g.nodes.get("order-svc").in.some(function (e) { return e.from === "api-gw"; }),
  "邻接表：order-svc 入边含 api-gw（它依赖我）");

/* ---- 2. BFS 上游（沿出边 = 我依赖的） ---- */
var up = A.bfs(g, "order-svc", "up");
eqSet(Array.from(up.dist.entries()).filter(function (p) { return p[1] === 1; }).map(function (p) { return p[0]; }),
  ["mysql-order", "inventory-svc", "promo-svc", "payment-svc", "risk-svc", "kafka"],
  "order-svc 上游第 1 跳");
ok(up.dist.get("pay-channel") === 2, "order-svc 上游第 2 跳含 pay-channel（经 payment-svc）");
ok(!up.dist.has("web-store"), "上游闭包不含 web-store（它是下游）");
ok(up.dist.get("order-svc") === 0, "闭包含起点且距离为 0");

/* ---- 3. BFS 下游（沿入边 = 依赖我的） ---- */
var down = A.bfs(g, "mysql-main", "down");
eqSet(Array.from(down.dist.entries()).filter(function (p) { return p[1] === 1; }).map(function (p) { return p[0]; }),
  ["user-svc", "product-svc", "inventory-svc", "payment-svc", "promo-svc", "logistics-svc", "ledger-svc"],
  "mysql-main 下游第 1 跳");
ok(down.dist.get("auth-svc") === 2 && down.dist.get("api-gw") === 2,
  "mysql-main 下游：auth-svc 与 api-gw 均在第 2 跳（都直接依赖 user-svc）");
ok(down.dist.get("web-store") === 3, "mysql-main 下游：web-store 第 3 跳");
ok(down.max >= 3, "mysql-main 下游可跟随 ≥3 跳（max=" + down.max + "）");

/* ---- 4. 闭包截断单调 ---- */
var c1 = A.closureUpTo(up, 1).size, c2 = A.closureUpTo(up, 2).size, cAll = A.closureUpTo(up, Infinity).size;
ok(c1 <= c2 && c2 <= cAll && cAll === up.dist.size, "闭包随跳数单调扩大（" + c1 + "≤" + c2 + "≤" + cAll + "）");

/* ---- 5. 具体路径还原 ---- */
var peUp = A.pathEdges(up, "pay-channel", "up");
ok(peUp.length === 2 && peUp[0].from === "order-svc" && peUp[0].to === "payment-svc" &&
  peUp[1].to === "pay-channel", "上游具体路径：order-svc→payment-svc→pay-channel");
var pnDown = A.pathNodes(down, "web-store", "down");
eqSet(pnDown, ["mysql-main", "user-svc", "api-gw", "web-store"],
  "下游具体路径节点序（影响链）");

/* ---- 6. 确定性分层布局 ---- */
var lay1 = A.layout(g, {}), lay2 = A.layout(g, {});
var deterministic = true;
lay1.pos.forEach(function (p, id) {
  var q = lay2.pos.get(id);
  if (p.x !== q.x || p.y !== q.y) deterministic = false;
});
ok(deterministic, "布局确定性：两次计算结果完全一致");
var allPlaced = true;
g.nodes.forEach(function (_n, id) { if (!lay1.pos.get(id)) allPlaced = false; });
ok(allPlaced, "布局覆盖全部节点");
var layerOK = true;
DATA.edges.forEach(function (e) {
  if (!(lay1.layerOf.get(e.from) > lay1.layerOf.get(e.to))) layerOK = false;
});
ok(layerOK, "每条依赖边：依赖者层号大（画在上）、被依赖方层号小（画在下），箭头向下");
var sameRowSameY = true;
lay1.rows.forEach(function (row) {
  var y = lay1.pos.get(row[0]).y;
  row.forEach(function (id) { if (lay1.pos.get(id).y !== y) sameRowSameY = false; });
});
ok(sameRowSameY, "同层节点同行对齐");

/* ---- 7. 回路安全（小循环图不悬挂、可计算） ---- */
var cyc = A.buildGraph({
  nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
  edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }, { from: "b", to: "c" }]
});
var cycBfs = A.bfs(cyc, "a", "up");
ok(cycBfs.dist.size === 3, "回路图 BFS 覆盖全部节点且终止");
var cycLay = A.layout(cyc, {});
ok(cycLay.pos.size === 3, "回路图布局终止且覆盖全部节点");

/* ---- 结果 ---- */
console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
