/* ============================================================
   护航台 · 内联流程数据 — 生产发布 runbook（首屏即用，无任何请求）
   不可逆步骤（reversibility: "irreversible"）必含 consequence /
   impact / acks / rollback（恢复路径），执行经确认关卡放行。
   ============================================================ */
"use strict";

var RELEASE = {
  ticket: "REL-2026-1017",
  title: "订单中心 order-service v2.4.0 生产发布",
  window: "2026-10-17 22:00 – 23:00",
  phases: [
    {
      id: "p1",
      name: "发布前准备",
      steps: [
        {
          id: "s01",
          name: "核对发布单与变更窗口",
          risk: "normal",
          reversibility: "reversible",
          kind: "task",
          guide: [
            "打开发布单 REL-2026-1017，逐项确认审批链完整、版本号与构建产物一致。",
            "核对变更窗口与报备信息一致，确认值班人员到位。"
          ],
          checklist: [
            "发布单 REL-2026-1017 审批链完整（开发 → 测试 → SRE）",
            "版本 v2.4.0 与发布单、构建产物三方一致",
            "变更窗口 22:00–23:00 已在变更系统报备",
            "值班发布负责人与回滚决策人已就位"
          ],
          expected: "发布单状态为「已批准」，无待办审批节点。"
        },
        {
          id: "s02",
          name: "确认回滚预案与会签",
          risk: "caution",
          reversibility: "reversible",
          kind: "task",
          guide: [
            "与值班经理会签，确认回滚决策路径与 24 小时联系方式。",
            "核对数据库迁移回滚脚本与最近一次恢复演练记录。"
          ],
          checklist: [
            "迁移回滚脚本 rollback-migration.sh 已在预发演练通过",
            "恢复演练记录在 30 天内（最近一次：2026-10-11）",
            "回滚决策人（值班经理）已会签并确认联系方式"
          ],
          expected: "回滚预案评审记录已挂到发布单，决策路径无歧义。"
        },
        {
          id: "s03",
          name: "冻结发布期间的变更",
          risk: "normal",
          reversibility: "reversible",
          kind: "task",
          guide: [
            "在变更系统开启发布冻结（21:45 起），公告其他团队暂停合入与配置变更。"
          ],
          checklist: [
            "变更系统冻结已生效（21:45 起）",
            "冻结公告已发至 #order-release 频道",
            "配置中心发布期间锁定已开启"
          ],
          expected: "冻结生效记录已附至发布单。"
        }
      ]
    },
    {
      id: "p2",
      name: "构建与预检",
      steps: [
        {
          id: "s04",
          name: "拉取构建产物并校验签名",
          risk: "normal",
          reversibility: "reversible",
          kind: "task",
          guide: [
            "从制品库拉取 v2.4.0 产物，核对 SHA-256 摘要与镜像签名。",
            "归档 SBOM 至发布单附件。"
          ],
          checklist: [
            "制品 manifest SHA-256 与制品库一致",
            "镜像签名验签通过（cosign verify）",
            "SBOM 已归档至发布单"
          ],
          expected: "三项校验输出均为 PASS。"
        },
        {
          id: "s05",
          name: "预发环境回归验证",
          risk: "caution",
          reversibility: "reversible",
          kind: "verify",
          guide: [
            "确认预发环境全量回归已完成且结论达标。",
            "抽查两条核心链路的回归录屏。"
          ],
          checklist: [
            "核心链路回归 32/32 通过",
            "支付回调与库存扣减链路抽查通过",
            "无新增 P1/P2 缺陷（缺陷看板已核对）"
          ],
          expected: "回归报告 v2.4.0-rc2 结论为「可发布」。"
        },
        {
          id: "s06",
          name: "灰度预案确认",
          risk: "normal",
          reversibility: "reversible",
          kind: "task",
          guide: [
            "确认灰度批次（5% → 25% → 100%）与每批次观察指标、暂停条件。"
          ],
          checklist: [
            "灰度批次与暂停阈值已在发布单勾选",
            "每批次观察 10 分钟，自动回切阈值 0.5% 错误率"
          ],
          expected: "灰度参数与发布单完全一致。"
        }
      ]
    },
    {
      id: "p3",
      name: "数据库迁移（不可逆）",
      steps: [
        {
          id: "s07",
          name: "备份数据库并验证可恢复",
          risk: "critical",
          reversibility: "reversible",
          kind: "task",
          guide: [
            "执行全量备份并记录 binlog 位点。",
            "在备份副本上完成一次恢复演练，验证备份可用。"
          ],
          checklist: [
            "全量备份完成且校验和一致（order-prod-20261017-full）",
            "binlog 位点已记录（mysql-bin.001883:44721）",
            "恢复演练在备份副本上完成（实测 12 分钟）"
          ],
          expected: "备份可在 20 分钟内完整恢复（演练实测 12 分钟）。"
        },
        {
          id: "s08",
          name: "执行数据库迁移（不可逆）",
          risk: "critical",
          reversibility: "irreversible",
          kind: "task",
          guide: [
            "确认消费组已暂停、写入已缓冲后，执行迁移脚本 migrate_v239_v240.sql。",
            "监控迁移进度直至完成，记录结束时间。"
          ],
          checklist: [
            "消费组已暂停（lag = 0 已确认）",
            "迁移脚本 dry-run 输出与评审版本一致"
          ],
          consequence: "迁移事务提交后无法直接撤销。若需回退，只能从全量备份恢复数据库，期间订单服务不可写入，预计影响 20–30 分钟。",
          impact: [
            "order_db 全部 14 张表结构升级（新增分表 2 张）",
            "存量约 4.2 亿行数据重建索引",
            "迁移期间写入暂停（由队列缓冲承接）"
          ],
          acks: [
            "我已确认全量备份（order-prod-20261017-full）可用且恢复演练通过",
            "我已确认消费组暂停、写入已缓冲，迁移窗口充足",
            "我已知悉回滚需要 20–30 分钟数据恢复时间"
          ],
          rollback: {
            title: "从全量备份恢复数据库",
            cost: "预计 20–30 分钟，期间订单服务不可写入；由值班经理决策后执行。",
            steps: [
              "停止应用写入与队列消费（bin/stop-writers.sh）",
              "恢复全量备份 order-prod-20261017-full（约 12 分钟）",
              "回放 binlog 至位点 mysql-bin.001883:44721",
              "验证数据一致性后恢复消费（bin/start-writers.sh）"
            ]
          },
          expected: "迁移日志结尾出现 MIGRATION OK，schema 版本号为 240。"
        },
        {
          id: "s09",
          name: "迁移后数据抽检",
          risk: "caution",
          reversibility: "reversible",
          kind: "verify",
          guide: [
            "对迁移后数据做抽样一致性核对：行数快照比对与金额聚合抽检。"
          ],
          checklist: [
            "核心表行数与迁移前快照一致（±0）",
            "订单金额聚合抽样 10 个批次误差为 0",
            "新分表路由抽测 100 单全部正确"
          ],
          expected: "抽检报告无差异项。"
        }
      ]
    },
    {
      id: "p4",
      name: "流量切换（高危）",
      steps: [
        {
          id: "s10",
          name: "执行实例滚动升级",
          risk: "caution",
          reversibility: "reversible",
          kind: "task",
          guide: [
            "在发布系统按批次（每批 25% 实例）将 order-service 滚动升级至 v2.4.0。",
            "每批次完成后核对健康检查与重启次数。"
          ],
          checklist: [
            "批次 1（25%）健康检查通过",
            "批次 2（50%）健康检查通过",
            "批次 3（100%）健康检查通过，无重启风暴"
          ],
          expected: "全部实例版本号为 v2.4.0。"
        },
        {
          id: "s11",
          name: "切换生产流量至新版本（不可逆入口）",
          risk: "critical",
          reversibility: "irreversible",
          kind: "task",
          guide: [
            "确认灰度批次全部通过后，将网关生产流量 100% 切换至 v2.4.0 集群。",
            "确认网关配置同步至全部边缘节点。"
          ],
          checklist: [
            "灰度 5%、25% 批次观察通过（各 10 分钟）",
            "网关权重已更新并同步全部边缘节点"
          ],
          consequence: "流量切换提交后，网关配置立即全球生效。回切需重新发布网关配置，生效前约 1–2 分钟内新旧版本并存，存在短时重复处理风险（幂等已开启，风险低但非零）。",
          impact: [
            "生产流量 100% 进入 v2.4.0",
            "网关配置变更对全部用户即时生效"
          ],
          acks: [
            "我已确认灰度批次全部通过、暂停阈值未触发",
            "我已确认幂等开关已全局开启",
            "我已知悉回切约需 1–2 分钟并存在短时双写窗口"
          ],
          rollback: {
            title: "网关流量回切至 v2.3.9",
            cost: "预计 1–2 分钟生效；切换决定需值班经理确认。",
            steps: [
              "发布网关回切配置（weight 100% → v2.3.9 集群）",
              "确认边缘节点同步完成（约 60 秒）",
              "观察错误率回落并通知值班经理"
            ]
          },
          expected: "网关监控显示 v2.4.0 流量占比 100%，边缘节点同步完成。"
        },
        {
          id: "s12",
          name: "生产核心指标观察",
          risk: "caution",
          reversibility: "reversible",
          kind: "verify",
          guide: [
            "在监控大盘对核心指标连续观察 15 分钟，逐项核对达标。"
          ],
          checklist: [
            "错误率 < 0.1% 持续 15 分钟",
            "P99 延迟 ≤ 基线 +10%",
            "订单创建成功率 ≥ 99.95%",
            "无新增 P3 及以上告警"
          ],
          expected: "大盘 15 分钟窗口内全部指标绿灯。"
        }
      ]
    },
    {
      id: "p5",
      name: "收尾",
      steps: [
        {
          id: "s13",
          name: "归档产物并清理旧版本（不可逆）",
          risk: "critical",
          reversibility: "irreversible",
          kind: "task",
          guide: [
            "将 v2.3.9 产物归档至冷备并校验，随后删除旧版本实例与镜像。",
            "确认冷备归档单生成后再执行清理。"
          ],
          checklist: [
            "v2.3.9 产物已归档冷备并校验",
            "冷备归档单已生成（保留 24 小时）",
            "旧版本实例已缩容至 0"
          ],
          consequence: "旧版本镜像与实例删除后不可直接恢复。若需回退到 v2.3.9，只能从冷备重新拉起并重建实例，预计约 40 分钟。",
          impact: [
            "生产集群删除 v2.3.9 实例与镜像",
            "冷备仅保留 24 小时"
          ],
          acks: [
            "我已确认 v2.3.9 产物归档完成且校验通过",
            "我已确认 v2.4.0 生产观察达标（s12 验证通过）",
            "我已知悉此步骤后回退需约 40 分钟冷备恢复"
          ],
          rollback: {
            title: "从冷备恢复 v2.3.9 实例",
            cost: "预计约 40 分钟；高成本恢复路径，需值班经理与 SRE 共同决策。",
            steps: [
              "从冷备拉取 v2.3.9 镜像并重新部署",
              "网关回切流量至 v2.3.9",
              "重建实例并观察指标"
            ]
          },
          expected: "集群中仅存在 v2.4.0 实例，冷备归档单已生成。"
        },
        {
          id: "s14",
          name: "关闭变更单并解除冻结",
          risk: "normal",
          reversibility: "reversible",
          kind: "finalize",
          guide: [
            "在变更系统关闭发布单、解除变更冻结，并向相关方发送发布完成通报。"
          ],
          checklist: [
            "发布单 REL-2026-1017 已关闭（结论：成功）",
            "变更冻结已解除",
            "发布完成通报已发送"
          ],
          expected: "变更系统状态为「已完结」，冻结解除。"
        }
      ]
    }
  ]
};
