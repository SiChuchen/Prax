/* Ledgerline · 内联变更集数据 —— 随首屏就绪，无加载态 */
"use strict";

const WINDOW = { start: "2026-09-22T08:00:00+08:00", end: "2026-09-23T20:00:00+08:00" };

/* 变更类型：颜色 + 形状双重编码（形状为色觉无关的次级通道） */
const TYPES = {
  deploy: { label: "发布", color: "#3987e5", shape: "square"   },
  config: { label: "配置", color: "#c98500", shape: "circle"   },
  flag:   { label: "开关", color: "#9085e9", shape: "diamond"  },
  alert:  { label: "告警", color: "#e66767", shape: "triangle" },
  action: { label: "操作", color: "#199e70", shape: "hex"      },
};

const COMPONENTS = ["api", "web", "cache", "db", "infra"];
const COMPONENT_LABELS = { api: "订单 API", web: "Web 前端", cache: "缓存层", db: "数据库", infra: "基础设施" };

/* 阶段：时间的高层结构，与变更语义对应 */
const PHASES = [
  { id: "p1", label: "常规发布", start: "2026-09-22T08:00:00+08:00", end: "2026-09-22T09:12:00+08:00", color: "#3987e5" },
  { id: "p2", label: "延迟回归", start: "2026-09-22T09:12:00+08:00", end: "2026-09-22T11:30:00+08:00", color: "#e66767" },
  { id: "p3", label: "缓存连锁", start: "2026-09-22T13:00:00+08:00", end: "2026-09-22T16:30:00+08:00", color: "#c98500" },
  { id: "p4", label: "结算灰度", start: "2026-09-22T18:00:00+08:00", end: "2026-09-23T12:00:00+08:00", color: "#9085e9" },
  { id: "p5", label: "维护窗口", start: "2026-09-23T14:00:00+08:00", end: "2026-09-23T20:00:00+08:00", color: "#199e70" },
];

/* 变更集：t 单调参与因果 —— 约束：cause 引用的变更时刻必须早于本变更 */
const CHANGES = [
  /* P1 常规发布 */
  { id: "c01", t: "2026-09-22T08:05:00+08:00", ty: "config", cp: "infra", by: "平台组", title: "Kafka 分区扩容 24→32", pl: { lb: "partitions", from: "24", to: "32" }, cause: [], st: [["kafka 分区", "32"]], note: "例行容量规划，随周二维护窗口执行。" },
  { id: "c02", t: "2026-09-22T08:20:00+08:00", ty: "deploy", cp: "api", by: "deploy-bot", title: "api v2.13.9 · 订单查询优化", pl: { lb: "api 版本", from: "v2.13.8", to: "v2.13.9" }, cause: [], st: [["api 版本", "v2.13.9"]] },
  { id: "c03", t: "2026-09-22T08:40:00+08:00", ty: "deploy", cp: "web", by: "deploy-bot", title: "web v5.7.0 · 结算页改版", pl: { lb: "web 版本", from: "v5.6.4", to: "v5.7.0" }, cause: [], st: [["web 版本", "v5.7.0"]] },
  { id: "c04", t: "2026-09-22T08:55:00+08:00", ty: "config", cp: "db", by: "dba 组", title: "慢查询阈值收紧 200→150ms", pl: { lb: "slowms", from: "200", to: "150" }, cause: [], st: [["db 慢查询阈值", "150ms"]] },
  /* P2 延迟回归 */
  { id: "c05", t: "2026-09-22T09:12:00+08:00", ty: "deploy", cp: "api", by: "deploy-bot", title: "api v2.14.0 · 误配连接池 pool.max=5", pl: { lb: "api 版本", from: "v2.13.9", to: "v2.14.0" }, cause: [], st: [["api 版本", "v2.14.0"], ["pool.max", "5", 1]], note: "变更单 CR-2214 附带连接池参数误配（模板变量覆盖），发布门禁未拦截。", root: 1 },
  { id: "c06", t: "2026-09-22T09:31:00+08:00", ty: "alert", cp: "api", by: "监控", title: "p99 延迟越限 · 警告（1.2s）", cause: ["c05"], alert: { sev: "警告", until: "2026-09-22T10:58:00+08:00" }, note: "延迟自发布起 19 分钟越过警告水位。" },
  { id: "c07", t: "2026-09-22T09:47:00+08:00", ty: "alert", cp: "api", by: "监控", title: "p99 延迟越限 · 严重（3.8s）· 呼叫值班", cause: ["c06"], alert: { sev: "严重", until: "2026-09-22T10:58:00+08:00" } },
  { id: "c08", t: "2026-09-22T10:02:00+08:00", ty: "action", cp: "infra", by: "林亦舟 · 值班", title: "api 副本临时扩容 6→10", cause: ["c07"], st: [["api 副本", "10"]], note: "横向扩容缓解排队，但瓶颈在实例内连接池上限，收效有限。" },
  { id: "c09", t: "2026-09-22T10:19:00+08:00", ty: "action", cp: "api", by: "林亦舟 · 值班", title: "定位根因：v2.14.0 连接池误配", cause: ["c07"], note: "对比发布前后 pool 配置 diff 确认。" },
  { id: "c10", t: "2026-09-22T10:26:00+08:00", ty: "config", cp: "api", by: "林亦舟 · 值班", title: "连接池回调 pool.max 5→20", pl: { lb: "pool.max", from: "5", to: "20" }, cause: ["c09"], st: [["pool.max", "20"]] },
  { id: "c11", t: "2026-09-22T10:58:00+08:00", ty: "alert", cp: "api", by: "监控", title: "p99 恢复正常 · 告警解除", cause: ["c10"], note: "p99 回落至 420ms 并持续 5 分钟。" },
  { id: "c12", t: "2026-09-22T11:15:00+08:00", ty: "action", cp: "infra", by: "林亦舟 · 值班", title: "api 副本回缩 10→6", cause: ["c11"], st: [["api 副本", "6"]] },
  /* P3 缓存连锁 */
  { id: "c13", t: "2026-09-22T13:05:00+08:00", ty: "deploy", cp: "cache", by: "deploy-bot", title: "cache-proxy v1.9.0 · 键空间调整", pl: { lb: "cache 版本", from: "v1.8.3", to: "v1.9.0" }, cause: [], st: [["cache 版本", "v1.9.0"]] },
  { id: "c14", t: "2026-09-22T13:22:00+08:00", ty: "config", cp: "cache", by: "deploy-bot", title: "热点键 TTL 30→10 分钟（随 v1.9.0 生效）", pl: { lb: "热点 TTL", from: "30m", to: "10m" }, cause: ["c13"], st: [["热点键 TTL", "10m", 1]], note: "新键空间策略将热点 TTL 一并下调，未在变更单标注。" },
  { id: "c15", t: "2026-09-22T13:58:00+08:00", ty: "alert", cp: "cache", by: "监控", title: "缓存命中率跌破 80% · 警告", cause: ["c14"], alert: { sev: "警告", until: "2026-09-22T16:10:00+08:00" } },
  { id: "c16", t: "2026-09-22T14:30:00+08:00", ty: "alert", cp: "db", by: "监控", title: "db 连接数越限 · 警告", cause: ["c15"], alert: { sev: "警告", until: "2026-09-22T16:25:00+08:00" }, note: "未命中流量直打数据库。" },
  { id: "c17", t: "2026-09-22T14:41:00+08:00", ty: "action", cp: "db", by: "dba 组", title: "db 只读副本 +1（2→3）", cause: ["c16"], st: [["db 只读副本", "3"]] },
  { id: "c18", t: "2026-09-22T15:02:00+08:00", ty: "config", cp: "cache", by: "沈其远", title: "热点 TTL 回调 10→30 分钟", pl: { lb: "热点 TTL", from: "10m", to: "30m" }, cause: ["c16"], st: [["热点键 TTL", "30m"]] },
  { id: "c19", t: "2026-09-22T15:40:00+08:00", ty: "action", cp: "cache", by: "沈其远", title: "缓存预热（Top 500 热点键）", cause: ["c18"] },
  { id: "c20", t: "2026-09-22T16:10:00+08:00", ty: "alert", cp: "cache", by: "监控", title: "命中率恢复 92% · 告警解除", cause: ["c19"] },
  { id: "c21", t: "2026-09-22T16:25:00+08:00", ty: "alert", cp: "db", by: "监控", title: "db 连接数回落 · 告警解除", cause: ["c20"] },
  /* P4 结算灰度 */
  { id: "c22", t: "2026-09-22T18:00:00+08:00", ty: "flag", cp: "api", by: "产品组", title: "新结算流程灰度 0→5%", pl: { lb: "flag 结算_v2", from: "off", to: "5%" }, cause: ["c03"], st: [["flag · 新结算流程", "5%"]] },
  { id: "c23", t: "2026-09-22T19:30:00+08:00", ty: "flag", cp: "api", by: "产品组", title: "灰度 5%→20%", pl: { lb: "flag 结算_v2", from: "5%", to: "20%" }, cause: ["c22"], st: [["flag · 新结算流程", "20%"]] },
  { id: "c24", t: "2026-09-22T20:15:00+08:00", ty: "alert", cp: "api", by: "监控", title: "结算接口错误率上升 0.8% · 警告", cause: ["c23"], alert: { sev: "警告", until: "2026-09-22T21:35:00+08:00" }, note: "金额精度缺陷 PAY-1182 在 20% 流量下显形。" },
  { id: "c25", t: "2026-09-22T20:22:00+08:00", ty: "flag", cp: "api", by: "产品组", title: "灰度暂停（保持 20%）", pl: { lb: "flag 结算_v2", from: "20% ↑", to: "20% · 暂停" }, cause: ["c24"], st: [["flag · 新结算流程", "20% · 暂停", 1]] },
  { id: "c26", t: "2026-09-22T20:40:00+08:00", ty: "action", cp: "api", by: "结算组", title: "修复 PAY-1182 金额精度（hotfix）", cause: ["c24"] },
  { id: "c27", t: "2026-09-22T21:10:00+08:00", ty: "deploy", cp: "api", by: "deploy-bot", title: "api v2.14.1 · 含 PAY-1182 hotfix", pl: { lb: "api 版本", from: "v2.14.0", to: "v2.14.1" }, cause: ["c26"], st: [["api 版本", "v2.14.1"]] },
  { id: "c28", t: "2026-09-22T21:35:00+08:00", ty: "alert", cp: "api", by: "监控", title: "结算错误率回落 0.1% · 告警解除", cause: ["c27"] },
  { id: "c29", t: "2026-09-23T09:00:00+08:00", ty: "flag", cp: "api", by: "产品组", title: "灰度恢复 20%→50%", pl: { lb: "flag 结算_v2", from: "20%", to: "50%" }, cause: ["c28"], st: [["flag · 新结算流程", "50%"]] },
  { id: "c30", t: "2026-09-23T11:00:00+08:00", ty: "flag", cp: "api", by: "产品组", title: "灰度 50%→100% 全量", pl: { lb: "flag 结算_v2", from: "50%", to: "100%" }, cause: ["c29"], st: [["flag · 新结算流程", "100%"]] },
  { id: "c31", t: "2026-09-23T11:20:00+08:00", ty: "deploy", cp: "web", by: "deploy-bot", title: "web v5.7.1 · 移除旧结算代码路径", pl: { lb: "web 版本", from: "v5.7.0", to: "v5.7.1" }, cause: ["c30"], st: [["web 版本", "v5.7.1"]] },
  /* P5 维护窗口 */
  { id: "c32", t: "2026-09-23T14:00:00+08:00", ty: "config", cp: "infra", by: "平台组", title: "维护窗口 MW-0923 开始", cause: [], note: "公告 MW-0923，窗口 14:00–19:00。" },
  { id: "c33", t: "2026-09-23T14:10:00+08:00", ty: "action", cp: "db", by: "dba 组", title: "主从切换演练（耗时 42s）", cause: ["c32"] },
  { id: "c34", t: "2026-09-23T14:12:00+08:00", ty: "alert", cp: "api", by: "监控", title: "连接抖动 · 瞬时警告", cause: ["c33"], alert: { sev: "警告", until: "2026-09-23T14:15:00+08:00" } },
  { id: "c35", t: "2026-09-23T14:15:00+08:00", ty: "action", cp: "db", by: "dba 组", title: "连接池重连完成 · 恢复", cause: ["c34"] },
  { id: "c36", t: "2026-09-23T15:30:00+08:00", ty: "config", cp: "infra", by: "平台组", title: "对象存储生命周期规则更新", cause: ["c32"] },
  { id: "c37", t: "2026-09-23T17:00:00+08:00", ty: "deploy", cp: "infra", by: "平台组", title: "节点内核升级 batch 1/3", cause: ["c32"] },
  { id: "c38", t: "2026-09-23T17:40:00+08:00", ty: "deploy", cp: "infra", by: "平台组", title: "节点内核升级 batch 2/3", cause: ["c37"] },
  { id: "c39", t: "2026-09-23T18:20:00+08:00", ty: "deploy", cp: "infra", by: "平台组", title: "节点内核升级 batch 3/3", cause: ["c38"] },
  { id: "c40", t: "2026-09-23T19:00:00+08:00", ty: "config", cp: "infra", by: "平台组", title: "维护窗口 MW-0923 结束", cause: ["c32"] },
  { id: "c41", t: "2026-09-23T19:30:00+08:00", ty: "action", cp: "api", by: "值班经理", title: "CS-0922 复盘纪要归档", cause: [], note: "改进项：发布模板变量校验、缓存策略变更单标注。" },
  { id: "c42", t: "2026-09-23T19:45:00+08:00", ty: "config", cp: "db", by: "dba 组", title: "慢查询阈值复盘调整 150→180ms", pl: { lb: "slowms", from: "150", to: "180" }, cause: [], st: [["db 慢查询阈值", "180ms"]] },
];

/* 时刻状态卡的字段展示顺序 */
const STATE_ORDER = ["api 版本", "web 版本", "cache 版本", "pool.max", "api 副本", "db 只读副本", "热点键 TTL", "flag · 新结算流程", "db 慢查询阈值", "kafka 分区"];

/* 指标小倍数：关键点线性插值（h = 自窗口起点起的小时数） */
const METRICS = [
  { key: "p99", label: "API p99 延迟", unit: "ms", color: "#d95926", domain: [0, 4000], fmt: v => Math.round(v) + " ms", warn: v => v >= 800,
    pts: [[0, 210], [1, 225], [1.2, 240], [1.52, 1200], [1.78, 3800], [2.03, 2500], [2.25, 3100], [2.33, 3700], [2.43, 2900], [2.67, 1900], [2.97, 420], [3.33, 235], [4, 215], [10, 220], [12.25, 340], [12.67, 360], [13.17, 300], [13.58, 230], [24, 215], [36, 220]] },
  { key: "err", label: "API 错误率", unit: "%", color: "#3987e5", domain: [0, 1.6], fmt: v => v.toFixed(2) + " %", warn: v => v >= 0.5,
    pts: [[0, .05], [1.2, .06], [1.78, .4], [2.03, 1.1], [2.33, 1.3], [2.43, 1.15], [2.78, .5], [2.97, .12], [4, .06], [12.25, .8], [12.67, .9], [13.17, .55], [13.58, .14], [14.5, .06], [27, .05], [36, .06]] },
  { key: "hit", label: "缓存命中率", unit: "%", color: "#199e70", domain: [60, 100], fmt: v => v.toFixed(0) + " %", warn: v => v < 80,
    pts: [[0, 94], [5.08, 94], [5.37, 92], [5.97, 78], [6.5, 71], [7.03, 69], [7.67, 74], [8.17, 92], [9, 93], [24, 93], [36, 93]] },
];
