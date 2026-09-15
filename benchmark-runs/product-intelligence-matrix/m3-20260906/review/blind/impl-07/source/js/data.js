/* 切换指挥台 · 运行数据（内联初始数据：页面加载即就绪，无任何网络请求）
 * 领域：生产数据库迁移切换（高后果流程演示场景）
 * 不可逆步骤：S7 / S8 / S12 —— 均带确认码（确认路径）+ 恢复程序与恢复窗口（恢复路径）
 */
(function (global) {
  'use strict';

  global.RUNBOOK = {
    meta: {
      changeCode: 'CHG-2026-0912',
      title: '核心支付库迁移切换',
      env: '生产环境 · PAY-PROD',
      window: '变更窗口 09-12 01:00–03:00'
    },
    phases: [
      {
        id: 'P1', name: '阶段一 · 预检确认',
        steps: [
          {
            id: 'S1', code: 'S1', title: '变更窗口与人员核对',
            goal: '确认变更单、窗口时间与在场角色一致，方可开始切换。',
            actions: [
              '对照变更单 CHG-2026-0912 核对窗口时间 01:00–03:00',
              '确认 DBA、应用值班、业务方三方已到场并在值守群报到'
            ],
            checks: [
              { id: 'c1', text: '变更单状态为「已批准」且窗口未过期', expect: '变更单系统显示绿色「执行中」' },
              { id: 'c2', text: '三方角色均已在值守群报到', expect: '群内可见 DBA / 应用 / 业务三条报到消息' }
            ],
            irreversible: false,
            fallback: '重新核对并重跑本步骤；不产生任何系统变更。',
            contingency: {
              trigger: '人员未到场或变更单过期',
              steps: ['挂起变更并上报值班经理', '顺延窗口后重新发起本步骤'],
              note: ''
            }
          },
          {
            id: 'S2', code: 'S2', title: '双库健康基线核对',
            goal: '确认主库与目标新库均处于健康状态，记录复制延迟基线。',
            actions: [
              '在监控台核对主库与目标新库健康分',
              '记录当前复制延迟基线值到变更单'
            ],
            checks: [
              { id: 'c1', text: '主库健康分 ≥ 95', expect: '监控台绿灯' },
              { id: 'c2', text: '新库复制延迟 < 1s', expect: '延迟面板读数 < 1000ms' }
            ],
            irreversible: false,
            fallback: '等待指标恢复后重测；必要时通知 DBA 介入。',
            contingency: {
              trigger: '复制延迟持续 > 1s',
              steps: ['暂停推进并通知 DBA 排查网络与磁盘 IO', '延迟恢复后重测本步骤检查项'],
              note: '延迟未追平前严禁进入切换执行阶段。'
            }
          },
          {
            id: 'S3', code: 'S3', title: '交易探针基线',
            goal: '取得切换前的交易链路基线，作为切换后比对依据。',
            actions: [
              '触发交易探针（下单 → 支付 → 退款）',
              '截图保存基线指标并归档到变更单'
            ],
            checks: [
              { id: 'c1', text: '探针成功率 ≥ 99.95%', expect: '探针台显示 PASS' },
              { id: 'c2', text: '基线截图已归档到变更单', expect: '附件区可见 baseline.png' }
            ],
            irreversible: false,
            fallback: '重新触发探针；基线截图可覆盖归档。',
            contingency: {
              trigger: '探针失败',
              steps: ['立即终止变更并按预案回退冻结计划', '由应用值班定位后另行排期'],
              note: ''
            }
          }
        ]
      },
      {
        id: 'P2', name: '阶段二 · 冻结与备份',
        steps: [
          {
            id: 'S4', code: 'S4', title: '应用侧写入冻结',
            goal: '停止生产写入，为备份与切换创建静止点。',
            actions: [
              '打开应用配置台「交易只读」开关',
              '确认消息队列消费者已全部暂停'
            ],
            checks: [
              { id: 'c1', text: '交易只读开关生效', expect: '探针下单返回「系统维护中」' },
              { id: 'c2', text: 'MQ 消费者组 lag 停止增长', expect: 'lag 曲线走平' }
            ],
            irreversible: false,
            fallback: '关闭只读开关即可解除冻结（解冻后需重新冻结再推进）。',
            contingency: {
              trigger: '冻结后仍有写入流量',
              steps: ['定位未下线的写入方并手动封禁', '确认写入归零后重勾本步骤'],
              note: ''
            }
          },
          {
            id: 'S5', code: 'S5', title: '全量备份快照',
            goal: '取得主库全量快照 —— 这是切换后一切恢复路径的依赖。',
            actions: [
              '对主库触发全量快照',
              '校验快照校验和并记录快照 ID（snap-0912-a7）'
            ],
            checks: [
              { id: 'c1', text: '快照状态 COMPLETE 且校验和一致', expect: '备份台显示 ✓' },
              { id: 'c2', text: '快照 ID 已登记变更单', expect: '变更单备注含 snap- 前缀 ID' }
            ],
            irreversible: false,
            fallback: '重新触发快照；失败快照可安全删除。',
            contingency: {
              trigger: '备份失败或校验和不一致',
              steps: ['终止变更（本步为硬门槛）', '解冻应用，另行排期'],
              note: '没有有效快照，S7/S8 的恢复路径不成立。'
            }
          },
          {
            id: 'S6', code: 'S6', title: '增量同步追平',
            goal: '确认新旧库增量同步完全追平，数据零差异。',
            actions: [
              '观察增量同步延迟归零并保持 60 秒',
              '运行行数比对脚本，抽样核对最新记录'
            ],
            checks: [
              { id: 'c1', text: '同步延迟 = 0 且稳定 60s', expect: '同步面板读数归零' },
              { id: 'c2', text: '三张核心表行数一致', expect: '对账脚本输出 matched' }
            ],
            irreversible: false,
            fallback: '继续等待追平并重测；不影响任何线上流量。',
            contingency: {
              trigger: '同步延迟反复抖动',
              steps: ['延长冻结窗口并通知业务方', '追平后重测；两次追平失败则终止变更'],
              note: ''
            }
          }
        ]
      },
      {
        id: 'P3', name: '阶段三 · 切换执行',
        steps: [
          {
            id: 'S7', code: 'S7', title: '流量切换至新库',
            goal: '将应用数据源指向新库，生产流量正式进入新库。',
            actions: [
              '在配置中心将数据源指向新库并下发',
              '观察首批交易写入情况'
            ],
            checks: [
              { id: 'c1', text: '新库连接数呈上升趋势', expect: '连接面板新库 > 旧库' },
              { id: 'c2', text: '首批交易写入新库成功', expect: '订单表出现新写入记录' }
            ],
            irreversible: true,
            confirmCode: 'GO-NEWDB',
            consequence: '全部生产交易实时写入新库。此动作触发后不能直接撤销，回切必须走完整恢复流程（停写 → 指回旧库 → 对账）。',
            recovery: {
              windowMinutes: 15,
              summary: '窗口内回切旧库可实现零交易损失；超窗后需对窗口期交易做对账合并。',
              steps: [
                '停止新库写入（应用只读开关）',
                '将应用数据源指回旧库并灰度 5% 验证',
                '全量放开流量并对账窗口期交易'
              ],
              note: '恢复窗口 15:00；每延迟 1 分钟约多 2.3 万笔交易进入对账队列（演示语义，页面倒计时呈现）。'
            },
            contingency: {
              trigger: '新库写入错误率 > 0.1%',
              steps: ['立即启动恢复路径（15 分钟窗口）', '回切后冻结现场并升级至 DBA 与架构师'],
              note: ''
            }
          },
          {
            id: 'S8', code: 'S8', title: '解除写入冻结',
            goal: '恢复生产写入，交易正式落库新库 —— 不可逆生效点。',
            actions: [
              '关闭应用配置台「交易只读」开关',
              '恢复消息队列写入侧，观察交易探针'
            ],
            checks: [
              { id: 'c1', text: '交易探针全链路 PASS', expect: '下单 / 支付 / 退款三项绿灯' },
              { id: 'c2', text: '错误率 < 0.05% 且持续 5 分钟', expect: '错误率面板低于阈值线' }
            ],
            irreversible: true,
            confirmCode: 'UNFREEZE-OK',
            consequence: '生产交易正式落库新库，为不可逆生效点。此后任何回滚都会产生待对账交易，需按对账补偿流程处理。',
            recovery: {
              windowMinutes: 30,
              summary: '停写后以快照 snap-0912-a7 回滚新库（RTO 45 分钟），窗口期交易走对账补偿。',
              steps: [
                '再次开启交易只读冻结',
                '以快照 snap-0912-a7 回滚新库并校验',
                '对窗口期交易执行对账补偿脚本'
              ],
              note: '恢复窗口 30:00；窗口内交易将进入人工对账队列（演示语义，页面倒计时呈现）。'
            },
            contingency: {
              trigger: '探针失败或错误率超标',
              steps: ['执行恢复路径：停写 → 快照回滚 → 对账补偿', '同步向业务方发送延迟公告'],
              note: ''
            }
          }
        ]
      },
      {
        id: 'P4', name: '阶段四 · 验证与收尾',
        steps: [
          {
            id: 'S9', code: 'S9', title: '交易链路验证',
            goal: '对切换后的生产链路做全量验证与抽样核对。',
            actions: [
              '运行全量探针（下单 / 支付 / 退款 / 对账文件）',
              '抽样 20 笔交易核对落库一致性'
            ],
            checks: [
              { id: 'c1', text: '四类探针全部 PASS', expect: '探针台 4/4 绿灯' },
              { id: 'c2', text: '抽样交易落库一致', expect: '20/20 matched' }
            ],
            irreversible: false,
            fallback: '重跑探针与抽样；异常样本进入人工核对。',
            contingency: {
              trigger: '抽样不一致',
              steps: ['启动 S8 恢复路径评估', '业务影响评估后决定回滚或定点修复'],
              note: ''
            }
          },
          {
            id: 'S10', code: 'S10', title: '恢复全量流量',
            goal: '解除降级：恢复异步任务、批处理与消息消费。',
            actions: [
              '解除降级开关，恢复异步任务与批处理调度',
              '恢复 MQ 消费者组'
            ],
            checks: [
              { id: 'c1', text: '异步任务恢复调度', expect: '调度台任务转 RUNNING' },
              { id: 'c2', text: '消费者 lag 开始下降', expect: 'lag 曲线下行' }
            ],
            irreversible: false,
            fallback: '重新开启降级开关即可恢复受限流量。',
            contingency: {
              trigger: 'lag 持续增长',
              steps: ['重新降级并限流', '排查消费能力后再次放开'],
              note: ''
            }
          },
          {
            id: 'S11', code: 'S11', title: '监控观察期',
            goal: '保持 15 分钟增强观察，确认指标平稳。',
            actions: [
              '保持 15 分钟增强观察（演示环境下直接确认）',
              '记录核心指标曲线到变更单'
            ],
            checks: [
              { id: 'c1', text: '15 分钟错误率 < 0.05%', expect: '观察面板处于绿区' },
              { id: 'c2', text: '无 P3 及以上告警', expect: '告警台静默' }
            ],
            irreversible: false,
            fallback: '延长观察期；观察期不产生系统变更。',
            contingency: {
              trigger: '观察期内指标恶化',
              steps: ['按 S8 恢复路径回滚', '升级为重大变更事故流程'],
              note: ''
            }
          },
          {
            id: 'S12', code: 'S12', title: '旧库下线置维',
            goal: '旧库转为只读归档并进入回收队列，完成切换闭环。',
            actions: [
              '变更单更新为「成功」并归档',
              '在资产台将旧库实例转入回收队列'
            ],
            checks: [
              { id: 'c1', text: '变更单更新为「成功」并归档', expect: '变更单状态蓝色「已关闭」' },
              { id: 'c2', text: '旧库实例进入回收队列', expect: '资产台显示待回收标记' }
            ],
            irreversible: true,
            confirmCode: 'RETIRE-OLD',
            consequence: '旧库转为只读归档并进入回收队列。回收执行后无法紧急回滚，只能从快照重建（RTO 4 小时）。',
            recovery: {
              windowMinutes: 1440,
              summary: '回收队列 24 小时内可一键撤回；超时后只能走快照重建预案。',
              steps: [
                '在资产台对旧库实例执行「撤回回收」',
                '确认实例恢复可写并重新挂载监控'
              ],
              note: '恢复窗口 24 小时（演示语义，页面倒计时呈现）。'
            },
            contingency: {
              trigger: '误将实例直接销毁',
              steps: ['24 小时内撤回回收队列', '超时则按快照重建预案执行（RTO 4h）'],
              note: ''
            }
          }
        ]
      }
    ]
  };
})(window);
