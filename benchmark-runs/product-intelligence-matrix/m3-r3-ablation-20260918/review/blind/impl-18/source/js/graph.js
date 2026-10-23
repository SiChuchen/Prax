/* 图算法（纯函数，无依赖）：构建、BFS 跟随、确定性分层布局。
   浏览器挂 window.GraphAlgo；Node 下 require 可用（供单元测试）。 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.GraphAlgo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** 构建图：id -> {…node, out:[出边(我依赖的)], in:[入边(依赖我的)]} */
  function buildGraph(data) {
    var nodes = new Map();
    data.nodes.forEach(function (n) {
      if (nodes.has(n.id)) throw new Error("duplicate node id: " + n.id);
      nodes.set(n.id, Object.assign({}, n, { out: [], in: [] }));
    });
    data.edges.forEach(function (e) {
      if (!nodes.has(e.from) || !nodes.has(e.to)) {
        throw new Error("edge references unknown node: " + e.from + " -> " + e.to);
      }
      nodes.get(e.from).out.push(e);
      nodes.get(e.to).in.push(e);
    });
    return { nodes: nodes, edges: data.edges, meta: data.meta || {}, nodeTypes: data.nodeTypes || {} };
  }

  /**
   * 从起点沿单一方向 BFS。
   * dir="up"   → 沿出边（我所依赖的，上游依赖）
   * dir="down" → 沿入边（依赖我的，下游影响）
   * 返回 { dist: Map(id->跳数，起点为 0), parent: Map(id->路径边), order: [按距离序的 id], max: 最大跳数 }
   */
  function bfs(graph, startId, dir) {
    if (!graph.nodes.has(startId)) throw new Error("unknown start node: " + startId);
    var dist = new Map([[startId, 0]]);
    var parent = new Map();
    var order = [startId];
    var queue = [startId];
    var max = 0;
    while (queue.length) {
      var id = queue.shift();
      var n = graph.nodes.get(id);
      var next = dir === "up" ? n.out : n.in;
      for (var i = 0; i < next.length; i++) {
        var e = next[i];
        var nid = dir === "up" ? e.to : e.from;
        if (!dist.has(nid)) {
          dist.set(nid, dist.get(id) + 1);
          parent.set(nid, { from: e.from, to: e.to });
          order.push(nid);
          max = Math.max(max, dist.get(nid));
          queue.push(nid);
        }
      }
    }
    return { dist: dist, parent: parent, order: order, max: max };
  }

  /** 闭包截断：dist <= steps 的子集（含起点）。steps 可为 Infinity。 */
  function closureUpTo(bfsResult, steps) {
    var out = new Map();
    bfsResult.dist.forEach(function (d, id) {
      if (d <= steps) out.set(id, d);
    });
    return out;
  }

  /** 起点到 target 的具体路径（边数组，起点在前）；不可达返回 []。 */
  function pathEdges(bfsResult, targetId, dir) {
    if (!bfsResult.dist.has(targetId)) return [];
    var edges = [];
    var cur = targetId;
    while (bfsResult.dist.get(cur) > 0) {
      var pe = bfsResult.parent.get(cur);
      if (!pe) return [];
      edges.unshift(pe);
      cur = dir === "up" ? pe.from : pe.to;
    }
    return edges;
  }

  /** 起点到 target 的节点序列（含两端）。 */
  function pathNodes(bfsResult, targetId, dir) {
    var edges = pathEdges(bfsResult, targetId, dir);
    if (!edges.length) return bfsResult.dist.has(targetId) ? [bfsResult.order[0]] : [];
    var ids = dir === "up" ? [edges[0].from] : [edges[0].to];
    for (var i = 0; i < edges.length; i++) {
      ids.push(dir === "up" ? edges[i].to : edges[i].from);
    }
    return ids;
  }

  /**
   * 确定性分层布局：层级 = 沿"依赖方向"（出边）的最长路径深度（回路安全），
   * 层内以相邻层重心法排序，往返 4 轮。同图同布局（位置不变量）。
   * 返回 { pos: Map(id->{x,y}), size:{w,h}, rows:[[id]], layerOf: Map, nodeW, nodeH }
   */
  function layout(graph, opts) {
    opts = opts || {};
    var nodeW = opts.nodeW || 152;
    var nodeH = opts.nodeH || 38;
    var colGap = opts.colGap || 44;
    var rowGap = opts.rowGap || 92;
    var marginX = opts.marginX || 56;
    var marginY = opts.marginY || 52;

    // 1) 分层（DFS 记忆化；进行中的回边按 0 处理，容忍回路）
    var layerOf = new Map();
    var mark = new Map(); // 1=进行中 2=完成
    function depth(id) {
      if (mark.get(id) === 2) return layerOf.get(id);
      if (mark.get(id) === 1) return 0;
      mark.set(id, 1);
      var n = graph.nodes.get(id);
      var d = 0;
      for (var i = 0; i < n.out.length; i++) d = Math.max(d, depth(n.out[i].to) + 1);
      mark.set(id, 2);
      layerOf.set(id, d);
      return d;
    }
    graph.nodes.forEach(function (_n, id) { depth(id); });

    // 2) 按层分组（保持插入序，保证确定性）
    var rows = [];
    graph.nodes.forEach(function (_n, id) {
      var L = layerOf.get(id);
      (rows[L] = rows[L] || []).push(id);
    });
    for (var i = 0; i < rows.length; i++) rows[i] = rows[i] || [];

    var colIndexOf = new Map();
    function reindex(row) { row.forEach(function (id, c) { colIndexOf.set(id, c); }); }
    rows.forEach(reindex);

    // 3) 重心法排序（向下/向上交替 4 轮）
    function barycenter(id, adjRow) {
      var n = graph.nodes.get(id);
      var sum = 0, cnt = 0;
      n.out.concat(n.in).forEach(function (e) {
        var other = e.to === id ? e.from : e.to;
        if (layerOf.get(other) === adjRow) { sum += colIndexOf.get(other); cnt++; }
      });
      return cnt ? sum / cnt : colIndexOf.get(id);
    }
    for (var round = 0; round < 4; round++) {
      for (var r = 1; r < rows.length; r++) {
        rows[r].sort(function (a, b) { return barycenter(a, r - 1) - barycenter(b, r - 1); });
        reindex(rows[r]);
      }
      for (var r2 = rows.length - 2; r2 >= 0; r2--) {
        rows[r2].sort(function (a, b) { return barycenter(a, r2 + 1) - barycenter(b, r2 + 1); });
        reindex(rows[r2]);
      }
    }

    // 4) 坐标：行内居中；画布行号 = maxLayer - 层号，
    //    使"依赖者在上、被依赖方在下"，箭头自上而下指向被依赖方
    var pos = new Map();
    var maxRowWidth = 0;
    rows.forEach(function (row) {
      maxRowWidth = Math.max(maxRowWidth, row.length * (nodeW + colGap) - colGap);
    });
    var maxLayer = rows.length - 1;
    rows.forEach(function (row, L) {
      var drawRow = maxLayer - L;
      var rowWidth = row.length * (nodeW + colGap) - colGap;
      var x0 = marginX + (maxRowWidth - rowWidth) / 2;
      row.forEach(function (id, c) {
        pos.set(id, {
          x: x0 + c * (nodeW + colGap),
          y: marginY + drawRow * (nodeH + rowGap)
        });
      });
    });

    return {
      pos: pos,
      size: {
        w: marginX * 2 + maxRowWidth,
        h: marginY * 2 + rows.length * (nodeH + rowGap) - rowGap
      },
      rows: rows,
      layerOf: layerOf,
      nodeW: nodeW,
      nodeH: nodeH
    };
  }

  return {
    buildGraph: buildGraph,
    bfs: bfs,
    closureUpTo: closureUpTo,
    pathEdges: pathEdges,
    pathNodes: pathNodes,
    layout: layout
  };
});
