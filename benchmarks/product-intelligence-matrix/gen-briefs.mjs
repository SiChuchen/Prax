#!/usr/bin/env node
/**
 * Brief generator (benchmark program M2, plan 2026-09-02).
 *
 *   node gen-briefs.mjs    # (re)writes brief.md for every pilot-batch entry
 *
 * Renders the frozen per-cell product brief from brief-template semantics:
 * user_job verbatim + shape bundle + object suggestion + acceptance seed +
 * budget cap + arm-neutral delivery constraints. Deterministic — no
 * timestamps; regeneration must be byte-identical (pinned by test).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parse } from "yaml";

const matrixDir = import.meta.dirname;

const FACET_LABELS = [
  ["cardinality", "基数", { one: "单一", few: "少量", many: "多量", unbounded: "无界" }],
  ["relationality", "关系性", null],
  ["hierarchy", "层级性", null],
  ["temporality", "时间性", null],
  ["density", "密度", null],
  ["dimensionality", "维度性", null],
  ["spatiality", "空间性", { none: "无", conceptual: "概念", physical: "物理" }],
  ["volatility", "易变性", null],
  ["uncertainty", "不确定性", null],
  ["comparison_need", "比较需求", { none: "无", optional: "可选", required: "必需" }],
];
const TERNARY = { low: "低", medium: "中", high: "高" };

function facetLine(facet, value) {
  const mapped = TERNARY[value] ?? value;
  return `| ${FACET_LABELS.find(([key]) => key === facet)[1]} | ${mapped} (${value}) |`;
}

export function renderBrief(cell, shape, sourceCell) {
  const layer = sourceCell === null || sourceCell === undefined ? "priority-1 对角带交叉格" : "priority-1 §43 原配对";
  const sourceLine = sourceCell ? ` · 源格：${sourceCell}（matrix.yaml 原文）` : "";
  const facetTable = FACET_LABELS.map(([facet]) => facetLine(facet, cell.information_shape[facet])).join("\n");
  return `# Product Brief — ${cell.id} (${cell.user_job.verb} × ${shape.name})

Benchmark: product-intelligence-matrix（150 格全矩阵，plan 2026-09-02）
Cell: ${cell.id} · ${layer}${sourceLine}

## 用户任务（user_job）

- 动词：${cell.user_job.verb}
- 对象：${cell.user_job.target}
- 成功标准：${cell.user_job.success}

## 信息形状（shape 束：${shape.name}）

| facet | 取值 |
|---|---|
${facetTable}

判别：${shape.description}

## 主对象建议

- object_type：${cell.object_type}
- 建议备选：${shape.suggested_objects.join("、")}

## 验收种子（acceptance seed）

${cell.acceptance_seed}

## 交付约束

- 从零实现一个单页 Web 应用（新目录、新代码，不得复用既有业务系统）
- 技术栈自选；交付物必须能直接静态打开（根路径 index.html，或构建产物 dist/）
- 应用在页面加载完成时即处于可用状态（初始数据随首屏就绪，不得以加载态作为可测状态）
- 不得部署到外部服务；本地可运行、可构建
- 规模上限：单页应用，主屏 1 个；不要求后端、账号体系或持久化服务

## 预算上限（超出即停，如实记录）

- wall-clock ≤ 90 min
- token ≤ 1.2M（AB-001 中位数的 1.5 倍）

## 冻结纪律

本简报由基准程序 M2 冻结（见 git 历史与 phase report 2026-09-03）；执行臂
不得要求修改验收标准，只能就歧义提问（操作算子记录并对两臂对等回答）。
`;
}

const invokedDirectly = resolve(process.argv[1] ?? "") === resolve(import.meta.filename);
if (invokedDirectly) {
  const read = (file) => readFile(join(matrixDir, file), "utf8").then(parse);
  const [batch, full, shapes] = await Promise.all([read("pilot-batch.yaml"), read("matrix-full.yaml"), read("shapes.yaml")]);
  const byId = new Map(full.cells.map((cell) => [cell.id, cell]));
  const shapeByName = new Map(shapes.shapes.map((shape) => [shape.name, shape]));
  for (const entry of [...batch.pilot_cells, ...batch.warmup_cells]) {
    const outDir = join(matrixDir, "..", "..", "benchmark-runs", "product-intelligence-matrix", entry.id);
    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, "brief.md"), renderBrief(byId.get(entry.id), shapeByName.get(entry.shape), entry.source_cell ?? null));
    console.log(`brief: ${entry.id}/brief.md`);
  }
}
