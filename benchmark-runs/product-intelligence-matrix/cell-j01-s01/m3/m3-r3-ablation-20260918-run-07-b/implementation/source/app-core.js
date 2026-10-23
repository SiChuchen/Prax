// app-core.js — 纯逻辑层：层级索引、筛选、选中集、批量操作、撤销
// 被 index.html（UI）与 tests/run-tests.html（自检）共用；不触碰 DOM。
(function (global) {
  "use strict";

  var STATUS_META = {
    active:    { key: "active",    label: "在用",     cls: "st-active" },
    repair:    { key: "repair",    label: "维修中",   cls: "st-repair" },
    stock:     { key: "stock",     label: "库存备用", cls: "st-stock" },
    suspended: { key: "suspended", label: "停用",     cls: "st-suspended" },
    scrap:     { key: "scrap",     label: "待报废",   cls: "st-scrap" }
  };

  // ---------- 层级索引 ----------

  // tree: [{id,name,children:[{id,name}...]}...]（叶子为科室，实体挂在叶子）
  function buildTreeIndex(tree) {
    var parentOf = {};        // nodeId -> parentId|null
    var nameOf = {};          // nodeId -> name
    var pathOf = {};          // nodeId -> [祖先名..., 自己名]
    var subtreeNodeIds = {};  // nodeId -> [nodeId...]（含自身）
    var subtreeDeptIds = {};  // nodeId -> [叶子科室 id...]
    var centerIds = [];       // 一级节点
    var deptIds = [];         // 叶子科室

    function visit(node, parent, ancestors) {
      parentOf[node.id] = parent;
      nameOf[node.id] = node.name;
      pathOf[node.id] = ancestors.concat([node.name]);
      var nodes = [node.id];
      var depts = [];
      var children = node.children || [];
      if (children.length === 0) {
        depts.push(node.id);
        deptIds.push(node.id);
      } else {
        for (var i = 0; i < children.length; i++) {
          var c = children[i];
          visit(c, node.id, ancestors.concat([node.name]));
          var sub = subtreeNodeIds[c.id];
          var subD = subtreeDeptIds[c.id];
          for (var j = 0; j < sub.length; j++) nodes.push(sub[j]);
          for (var k = 0; k < subD.length; k++) depts.push(subD[k]);
        }
      }
      subtreeNodeIds[node.id] = nodes;
      subtreeDeptIds[node.id] = depts;
    }

    tree.forEach(function (root) { visit(root, null, []); centerIds.push(root.id); });
    return { parentOf: parentOf, nameOf: nameOf, pathOf: pathOf,
             subtreeNodeIds: subtreeNodeIds, subtreeDeptIds: subtreeDeptIds,
             centerIds: centerIds, deptIds: deptIds };
  }

  function entityPathString(index, entity) {
    return index.pathOf[entity.deptId].join(" / ");
  }

  function entityDeptName(index, entity) {
    return index.nameOf[entity.deptId];
  }

  // 实体在某个节点子树内（节点本身或其下属科室）
  function inSubtree(index, nodeId, entity) {
    return index.subtreeDeptIds[nodeId].indexOf(entity.deptId) !== -1;
  }

  // ---------- 筛选（只影响可见性，绝不影响选中集） ----------

  // view = { locatedNode: nodeId|null, status: statusKey|null, query: string }
  function matchesFilters(index, entity, view) {
    if (view.locatedNode && !inSubtree(index, view.locatedNode, entity)) return false;
    if (view.status && entity.status !== view.status) return false;
    if (view.query) {
      var q = view.query.toLowerCase();
      if (entity.id.toLowerCase().indexOf(q) === -1 &&
          entity.name.toLowerCase().indexOf(q) === -1 &&
          entity.model.toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  }

  function visibleIds(entities, index, view) {
    var out = [];
    entities.forEach(function (e, id) {
      if (matchesFilters(index, e, view)) out.push(id);
    });
    out.sort();
    return out;
  }

  // 视图内各状态计数（剔除状态筛选自身，保留定位与搜索）
  function statusCounts(entities, index, view) {
    var counts = {};
    var base = { locatedNode: view.locatedNode, status: null, query: view.query };
    entities.forEach(function (e) {
      if (matchesFilters(index, e, base)) {
        counts[e.status] = (counts[e.status] || 0) + 1;
      }
    });
    return counts;
  }

  // ---------- 批量操作（唯一作用域 = 传入快照 ids） ----------

  function snapshotOf(e) {
    return { name: e.name, model: e.model, status: e.status, deptId: e.deptId };
  }

  // op = { type:"status"|"move"|"delete", ids:[...], value?, deptId? }
  // 返回 { entities, confirmedCount, affectedIds, skippedIds, record }
  // 不变量：只触碰 op.ids 中的实体；skipped = 已处于目标状态/归属的实体（未改动，如实报告）
  function applyBatch(entities, op) {
    var ids = op.ids.filter(function (id) { return entities.has(id); });
    var before = {};
    var next = new Map(entities);
    var affected = [];
    var skipped = [];

    if (op.type === "status") {
      ids.forEach(function (id) {
        var e = entities.get(id);
        before[id] = snapshotOf(e);
        if (e.status !== op.value) {
          var copy = Object.assign({}, e); copy.status = op.value;
          next.set(id, copy);
          affected.push(id);
        } else {
          skipped.push(id);
        }
      });
    } else if (op.type === "move") {
      ids.forEach(function (id) {
        var e = entities.get(id);
        before[id] = snapshotOf(e);
        if (e.deptId !== op.deptId) {
          var copy = Object.assign({}, e); copy.deptId = op.deptId;
          next.set(id, copy);
          affected.push(id);
        } else {
          skipped.push(id);
        }
      });
    } else if (op.type === "delete") {
      ids.forEach(function (id) {
        before[id] = snapshotOf(entities.get(id));
        next.delete(id);
        affected.push(id);
      });
    } else {
      throw new Error("unknown op type: " + op.type);
    }

    return {
      entities: next,
      confirmedCount: ids.length,
      affectedIds: affected,
      skippedIds: skipped,
      record: { op: { type: op.type, ids: ids, value: op.value, deptId: op.deptId }, before: before }
    };
  }

  // 整体撤销：按 record.before 精确恢复该次快照集合（不多不少）
  function undoBatch(entities, record) {
    var next = new Map(entities);
    Object.keys(record.before).forEach(function (id) {
      var snap = record.before[id];
      next.set(id, { id: id, name: snap.name, model: snap.model,
                     status: snap.status, deptId: snap.deptId });
    });
    return next;
  }

  // 移动归属业务规则：待报废设备不可移动 → 返回被阻止的 id 列表
  function validateMove(entities, ids) {
    var blocked = ids.filter(function (id) {
      var e = entities.get(id);
      return e && e.status === "scrap";
    });
    return { ok: blocked.length === 0, blockedIds: blocked };
  }

  // ---------- 汇总 ----------

  // 选中集分组摘要：按科室 → 状态
  function summarize(entities, index, ids) {
    var byStatus = {};
    var byDept = {};
    ids.forEach(function (id) {
      var e = entities.get(id);
      if (!e) return;
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      var d = byDept[e.deptId];
      if (!d) { d = byDept[e.deptId] = { total: 0, statuses: {} }; }
      d.total += 1;
      d.statuses[e.status] = (d.statuses[e.status] || 0) + 1;
    });
    var deptRows = Object.keys(byDept).map(function (deptId) {
      return { deptId: deptId, name: index.nameOf[deptId] || deptId,
               path: index.pathOf[deptId].join(" / "), total: byDept[deptId].total,
               statuses: byDept[deptId].statuses };
    });
    deptRows.sort(function (a, b) { return b.total - a.total || (a.name < b.name ? -1 : 1); });
    return { byStatus: byStatus, deptCount: deptRows.length, deptRows: deptRows };
  }

  // 节点子树内的实体 id（供树节点显式全选，数量可预览）
  function entityIdsInSubtree(entities, index, nodeId) {
    var deptSet = index.subtreeDeptIds[nodeId];
    var out = [];
    entities.forEach(function (e, id) {
      if (deptSet.indexOf(e.deptId) !== -1) out.push(id);
    });
    out.sort();
    return out;
  }

  var Core = {
    STATUS_META: STATUS_META,
    buildTreeIndex: buildTreeIndex,
    entityPathString: entityPathString,
    entityDeptName: entityDeptName,
    inSubtree: inSubtree,
    matchesFilters: matchesFilters,
    visibleIds: visibleIds,
    statusCounts: statusCounts,
    applyBatch: applyBatch,
    undoBatch: undoBatch,
    validateMove: validateMove,
    summarize: summarize,
    entityIdsInSubtree: entityIdsInSubtree
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Core;
  global.Core = Core;
})(typeof window !== "undefined" ? window : globalThis);
