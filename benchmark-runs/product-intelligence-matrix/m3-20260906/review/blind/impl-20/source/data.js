/* Orbit CDN · 发布列车 R2026-35 —— 变更历史数据集（内联，随首屏就绪）
 *
 * 不变量（数据完整性约定，app.js 启动时校验并在控制台报告）：
 *   1. changeSets 按 ts 严格递增（时间序 = 序列序）。
 *   2. causalLinks 中 cause 的时间戳必须严格早于 effect（时间结构与因果语义一致）。
 *   3. 每条 change 作用于恰好一个元素；rename 通过 to 声明新元素名。
 */
window.ORBIT_DATA = {
  product: "Orbit CDN",
  windowLabel: "发布列车 R2026-35 · 变更窗口",
  changeSets: [
    {
      id: "cs-01",
      ts: "2026-08-31T09:12:00+08:00",
      title: "列车 R2026-35 启动",
      author: "release-bot",
      trigger: "pipeline",
      tags: ["列车启动"],
      changes: [
        { id: "cs-01-c1", type: "add", element: "flag/http3", before: null,
          after: "off（灰度名单为空）", note: "随列车骨架合入，功能开关默认关闭" },
        { id: "cs-01-c2", type: "modify", element: "cfg/tls-min-version", before: "TLSv1.0",
          after: "TLSv1.2", note: "列车安全基线：最低 TLS 版本抬升" },
        { id: "cs-01-c3", type: "modify", element: "svc/cache-node", before: "v4.12.3",
          after: "v4.13.0-rc.1", note: "候选版进入金丝雀池" }
      ]
    },
    {
      id: "cs-02",
      ts: "2026-08-31T16:40:00+08:00",
      title: "南亚扩容 + edge 新版部署",
      author: "ops:linz",
      trigger: "manual",
      tags: ["容量", "部署"],
      changes: [
        { id: "cs-02-c1", type: "modify", element: "pool/ap-south", before: "weight 40",
          after: "weight 55", note: "南亚晚高峰前扩容" },
        { id: "cs-02-c2", type: "modify", element: "svc/edge-gateway", before: "v2.30.1",
          after: "v2.31.0", note: "接入 HTTP/3 监听器（受 flag/http3 控制）" }
      ]
    },
    {
      id: "cs-03",
      ts: "2026-09-01T10:05:00+08:00",
      title: "安全基线扫描整改",
      author: "sec-bot",
      trigger: "scanner",
      tags: ["安全基线"],
      changes: [
        { id: "cs-03-c1", type: "modify", element: "cfg/tls-min-version", before: "TLSv1.2",
          after: "TLSv1.3", note: "扫描建议：新握手一律 TLSv1.3" },
        { id: "cs-03-c2", type: "modify", element: "cert/*.orbit-cdn.io",
          before: "expires 2026-09-30", after: "expires 2027-09-30", note: "证书自动续期" }
      ]
    },
    {
      id: "cs-04",
      ts: "2026-09-01T19:30:00+08:00",
      title: "HTTP/3 灰度放量 5%",
      author: "release-bot",
      trigger: "pipeline",
      tags: ["灰度"],
      changes: [
        { id: "cs-04-c1", type: "modify", element: "flag/http3", before: "off",
          after: "on（灰度 5%）", note: "首批 5% 会话启用 HTTP/3" },
        { id: "cs-04-c2", type: "modify", element: "pool/ap-south", before: "weight 55",
          after: "weight 45", note: "让出容量给灰度节点组" }
      ]
    },
    {
      id: "cs-05",
      ts: "2026-09-02T11:15:00+08:00",
      title: "缓存 TTL 语义收敛",
      author: "ops:linz",
      trigger: "manual",
      tags: ["配置治理"],
      changes: [
        { id: "cs-05-c1", type: "rename", element: "cfg/cache-ttl-static",
          to: "cfg/cache-ttl-default", before: "86400s", after: "3600s",
          note: "静态缓存 TTL 收敛为 1h，与灰度策略对齐" },
        { id: "cs-05-c2", type: "remove", element: "cfg/cache-ttl-api", before: "300s",
          after: null, note: "短 TTL 项移除，由 default 项覆盖" }
      ]
    },
    {
      id: "cs-06",
      ts: "2026-09-03T02:47:00+08:00",
      title: "热回滚：QUIC 握手超时",
      author: "oncall:k",
      trigger: "incident",
      tags: ["回滚", "事故"],
      changes: [
        { id: "cs-06-c1", type: "modify", element: "svc/edge-gateway", before: "v2.31.0",
          after: "v2.30.1", note: "热回滚至上一稳定版" },
        { id: "cs-06-c2", type: "modify", element: "flag/http3", before: "on（灰度 5%）",
          after: "off", note: "关闭灰度入口" }
      ]
    },
    {
      id: "cs-07",
      ts: "2026-09-03T15:20:00+08:00",
      title: "Hotfix：QUIC 握手修复",
      author: "build-bot",
      trigger: "pipeline",
      tags: ["hotfix"],
      changes: [
        { id: "cs-07-c1", type: "modify", element: "svc/edge-gateway", before: "v2.30.1",
          after: "v2.31.1", note: "QUIC 握手超时修复（#8821）" },
        { id: "cs-07-c2", type: "modify", element: "flag/sticky-routing", before: "off",
          after: "on", note: "灰度会话粘滞，避免握手抖动放大" }
      ]
    },
    {
      id: "cs-08",
      ts: "2026-09-04T10:00:00+08:00",
      title: "恢复放量 + 候选版转正",
      author: "release-bot",
      trigger: "pipeline",
      tags: ["恢复放量"],
      changes: [
        { id: "cs-08-c1", type: "modify", element: "flag/http3", before: "off",
          after: "on（灰度 20%）", note: "补丁版就绪后恢复灰度" },
        { id: "cs-08-c2", type: "modify", element: "svc/cache-node",
          before: "v4.13.0-rc.1", after: "v4.13.0", note: "候选版观察 12h 无异常，转正" },
        { id: "cs-08-c3", type: "modify", element: "pool/ap-south", before: "weight 45",
          after: "weight 50", note: "容量逐步回补" }
      ]
    }
  ],
  causalLinks: [
    { id: "cl-1", cause: "cs-01", effect: "cs-02",
      reason: "edge v2.31.0 依赖缓存节点 v4.13 的协议头，需在 rc.1 就位后部署" },
    { id: "cl-2", cause: "cs-01", effect: "cs-03",
      reason: "列车启动触发基线扫描；证书距到期不足 60 天进入整改队列" },
    { id: "cl-3", cause: "cs-02", effect: "cs-04",
      reason: "edge v2.31.0 完成部署，满足开启 HTTP/3 灰度的前置条件" },
    { id: "cl-4", cause: "cs-04", effect: "cs-05",
      reason: "灰度指标显示静态缓存命中率下降（97%→88%），需统一缓存 TTL 语义" },
    { id: "cl-5", cause: "cs-04", effect: "cs-06",
      reason: "灰度开启后 QUIC 握手 P99 超时告警（3.2%→41%），触发热回滚" },
    { id: "cl-6", cause: "cs-06", effect: "cs-07",
      reason: "回滚定位到 v2.31.0 的 QUIC 缺陷，针对该缺陷出补丁版" },
    { id: "cl-7", cause: "cs-07", effect: "cs-08",
      reason: "补丁版金丝雀观察 12h 无异常，恢复 HTTP/3 灰度放量" }
  ]
};
