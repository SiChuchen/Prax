/* 哨兵 Runbook · 流程定义（首屏内联数据，加载即就绪） */
window.RUNBOOK = {
  title: "核心数据库主从切换",
  code: "RUNBOOK-DB-FAILOVER-01",
  incident: "INC-20260916-0042",
  intro: "本流程用于核心数据库主库故障时的主从切换。全程共 4 个阶段 13 个步骤，其中包含不可逆操作。" +
         "请严格按顺序执行：每一步必须完成全部验证检查项并填写执行证据后才能放行；" +
         "不可逆步骤执行前将强制进入确认仪式，并展示对应的恢复路径。",
  retroPoints: [
    "核对切换时间线：从故障确认到写入恢复的实际耗时与目标值（≤ 30 分钟）对比",
    "检查决策门 s5 的采样证据是否足以支撑当时的判断",
    "确认旧主库处置工单已建立，冗余恢复责任到人",
    "将本次切换的偏差记录（如有）纳入复盘会议议题"
  ],
  phases: [
    {
      id: "phase-prep",
      name: "阶段一 · 预检与冻结",
      steps: [
        {
          id: "s1",
          kind: "normal",
          title: "成立应急响应",
          summary: "确认故障成立，组建双人操作组。任何关键操作前必须双人复核，杜绝单人误操作。",
          actions: [
            "核对监控告警与业务影响面，确认达到切换启动标准",
            "指定切换指挥 1 名、数据库操作员 1 名、记录员 1 名",
            "建立作战室通信频道（语音 + 文字）"
          ],
          checks: [
            "已确认告警 ID 与影响面，达到切换启动标准",
            "双人制角色已指定并知悉（指挥 / 操作 / 记录）",
            "作战室频道已建立且全员在线"
          ],
          evidence: [
            { id: "alarm_id", label: "告警编号", placeholder: "如 ALERT-8842" },
            { id: "commander", label: "切换指挥", placeholder: "姓名" }
          ]
        },
        {
          id: "s2",
          kind: "normal",
          title: "冻结变更与发布",
          summary: "切换期间禁止一切非相关变更，防止环境状态漂移导致切换基线失效。",
          actions: [
            "暂停发布流水线与相关定时任务",
            "在变更平台挂起所有待执行变更",
            "通知相关业务与研发负责人"
          ],
          checks: [
            "发布流水线已暂停，且无进行中的构建",
            "变更平台待执行变更已全部挂起",
            "相关负责人已确认冻结生效"
          ],
          evidence: [
            { id: "freeze_time", label: "冻结生效时间（HH:MM）", placeholder: "如 14:30", pattern: "^([01]?\\d|2[0-3]):[0-5]\\d$", patternHint: "格式：HH:MM" }
          ]
        },
        {
          id: "s3",
          kind: "normal",
          title: "广播切换公告",
          summary: "让所有受影响方知晓切换可能产生的短暂写入中断（预计 ≤ 90 秒）。",
          actions: [
            "向业务方发送切换公告与预计中断时长",
            "确认值班矩阵与升级路径可用"
          ],
          checks: [
            "已向业务方发送切换公告与预计中断时长",
            "值班矩阵与升级路径已确认"
          ],
          evidence: [
            { id: "notice_channel", label: "公告渠道", placeholder: "如 群公告 / 邮件列表" }
          ]
        }
      ]
    },
    {
      id: "phase-decision",
      name: "阶段二 · 故障确认与决策",
      steps: [
        {
          id: "s4",
          kind: "normal",
          title: "采集主库健康证据",
          summary: "用数据说话：连续两次采样确认主库是否真的不可恢复，避免误切换。",
          actions: [
            "采集主库进程、连接数与错误日志",
            "查询复制延迟与 IO 线程状态",
            "60 秒后二次采样，对比趋势"
          ],
          checks: [
            "已完成两次间隔 ≥ 60s 的采样并留存截图",
            "复制延迟趋势无收敛迹象",
            "已与存储 / 网络值班确认底层无共享故障"
          ],
          evidence: [
            { id: "replica_lag", label: "复制延迟（秒，最新采样）", placeholder: "如 180", pattern: "^\\d+(\\.\\d+)?$", patternHint: "纯数字" }
          ]
        },
        {
          id: "s5",
          kind: "decision",
          title: "决策门：重试主库，还是执行切换",
          summary: "本步骤决定是否进入不可逆执行阶段。请引用 s4 的采样数据做出可审计的决策。",
          decision: {
            options: [
              {
                id: "retry",
                label: "重试主库，中止切换",
                detail: "两次采样显示延迟在收敛，或故障为可自愈类（如连接风暴）。优先修复主库，本流程以安全中止结束，不产生任何不可逆变更。",
                outcome: "选择本分支将安全中止本次切换（可逆出口，不构成失误）",
                aborts: true
              },
              {
                id: "failover",
                label: "确认切换，进入执行阶段",
                detail: "主库确认无法在 10 分钟内恢复。进入切换执行；自下一步起将出现不可逆操作。",
                outcome: "后续步骤包含不可逆操作，需逐步确认",
                aborts: false
              }
            ]
          },
          checks: [
            "指挥与操作员对决策达成一致（双人复核）",
            "已向作战室广播决策结论"
          ],
          evidence: [
            { id: "decision_reason", label: "决策依据（引用采样数据）", placeholder: "引用两次采样的复制延迟数据说明判断依据", textarea: true }
          ]
        }
      ]
    },
    {
      id: "phase-exec",
      name: "阶段三 · 切换执行",
      steps: [
        {
          id: "s6",
          kind: "normal",
          title: "拍摄最终快照并记录位点",
          summary: "为不可逆操作留下最后的退路：快照与位点是后续所有恢复路径的基石。",
          actions: [
            "对主库执行最终快照",
            "记录当前 GTID / 复制位点",
            "校验快照可读（试恢复表结构）"
          ],
          checks: [
            "最终快照完成且校验可读",
            "GTID / 位点已记录并双人复核"
          ],
          evidence: [
            { id: "snapshot_id", label: "快照 ID", placeholder: "如 snap-20260916-1430" },
            { id: "gtid", label: "GTID / 位点号", placeholder: "如 3E11FA47-71BA-…:1-8842" }
          ]
        },
        {
          id: "s7",
          kind: "irreversible",
          title: "隔离旧主库（Fencing）",
          summary: "将旧主库隔离：撤销其写权限并断开应用连接，杜绝脑裂双写。",
          actions: [
            "在旧主库开启只读并断开应用连接",
            "在接入层摘除旧主节点",
            "复核确认无残留写入连接"
          ],
          checks: [
            "旧主库只读已生效，应用连接已断开",
            "接入层已摘除旧主节点",
            "无残留写入连接（复核查询已截图）"
          ],
          consequence: "旧主库将立即停止所有写入服务，应用连接被强制断开。执行后旧主库不能再作为写入节点，直至显式解除隔离。",
          confirmWord: "FENCE",
          recovery: {
            title: "解除隔离并回切",
            trigger: "仅当尚未执行「提升从库为主库」时可用：fencing 后发现误操作，或主库判定有误。",
            impact: "旧主恢复写入服务，本步骤回退为待执行状态，需重新走确认仪式；将记录 1 次偏差。",
            steps: [
              "解除旧主库只读，恢复接入层节点",
              "校验应用写入恢复，确认无双写",
              "向作战室通报，听候指挥指令"
            ]
          },
          evidence: [
            { id: "fence_operator", label: "Fencing 执行人", placeholder: "姓名" },
            { id: "fence_time", label: "完成时间（HH:MM）", placeholder: "如 15:02", pattern: "^([01]?\\d|2[0-3]):[0-5]\\d$", patternHint: "格式：HH:MM" }
          ]
        },
        {
          id: "s8",
          kind: "irreversible",
          title: "提升从库为主库（Promote）",
          summary: "将延迟最小的从库提升为新主库，使其永久脱离旧复制拓扑。",
          actions: [
            "确认目标从库复制已追平至 s6 记录的位点",
            "执行提升序列（停复制 → 重置拓扑 → 开启读写）",
            "校验新主库可写"
          ],
          checks: [
            "目标从库复制已追平（位点 ≥ s6 记录值）",
            "提升序列执行完成，新主库可写",
            "新主库错误日志无致命错误"
          ],
          consequence: "从库将永久脱离旧主复制拓扑成为独立主库。此后旧主库无法以「直接重新加入」的方式恢复主从关系，必须从快照重建。",
          confirmWord: "PROMOTE",
          recovery: {
            title: "从快照重建旧主并回切",
            trigger: "仅当写入端点尚未全部切完时可用：提升后 30 分钟观察窗内发现新主异常。",
            impact: "需要 20–40 分钟重建窗口，本步骤回退为待执行状态；将记录 1 次偏差。",
            steps: [
              "以 s6 快照与位点将旧主重建为新主库的从库",
              "校验复制追平后执行回切预演",
              "由指挥确认后回切，并通报作战室"
            ]
          },
          evidence: [
            { id: "promoted_host", label: "新主机名", placeholder: "如 db-05" },
            { id: "promote_operator", label: "提升操作人", placeholder: "姓名" }
          ]
        },
        {
          id: "s9",
          kind: "irreversible",
          title: "切换写入端点（Cutover）",
          summary: "将应用写入流量指向新主库并重置连接池，让业务写入真正落到新主。",
          actions: [
            "更新代理 / VIP 指向新主库",
            "滚动重置应用连接池",
            "观察首分钟写入量与错误率"
          ],
          checks: [
            "端点已指向新主库，连接池重置完成",
            "写入探针连续 3 次成功",
            "错误率回落至切换前基线"
          ],
          consequence: "全部应用写入流量将指向新主库，连接池与长连接被重置，业务将经历一次秒级写入抖动；如需回切将再次抖动。",
          confirmWord: "CUTOVER",
          recovery: {
            title: "端点回切至旧主",
            trigger: "仅当旧主尚未重建、且可解除只读时可用：切换后写入错误率持续高于阈值且定位为新主问题。",
            impact: "业务再次经历秒级抖动，本步骤回退为待执行状态；将记录 1 次偏差。",
            steps: [
              "接入层回指旧主库（先解除其只读）",
              "重置连接池并观察写入恢复",
              "通报作战室，转入复盘流程"
            ]
          },
          evidence: [
            { id: "cutover_time", label: "切换生效时间（HH:MM）", placeholder: "如 15:18", pattern: "^([01]?\\d|2[0-3]):[0-5]\\d$", patternHint: "格式：HH:MM" },
            { id: "change_no", label: "变更单号", placeholder: "如 CHG-2026-0916-07" }
          ]
        },
        {
          id: "s10",
          kind: "normal",
          title: "验证新主写入与复制",
          summary: "确认新主库真实承载写入，且新的从库链路正常追平。",
          actions: [
            "执行写入探针（写测试表并读回比对）",
            "检查从库复制延迟",
            "确认备份任务已指向新主库"
          ],
          checks: [
            "写入探针成功且读回一致",
            "从库复制延迟 < 1s",
            "备份任务已指向新主库"
          ],
          evidence: [
            { id: "probe_ms", label: "探针延迟（ms）", placeholder: "如 12", pattern: "^\\d+$", patternHint: "纯数字" }
          ]
        }
      ]
    },
    {
      id: "phase-close",
      name: "阶段四 · 验证与收尾",
      steps: [
        {
          id: "s11",
          kind: "normal",
          title: "业务冒烟验证",
          summary: "用真实业务链路验证切换结果，避免「数据库正常但业务不可用」。",
          actions: [
            "执行核心链路冒烟用例",
            "观察支付 / 下单等关键链路错误率",
            "与客服侧确认无相关投诉上升"
          ],
          checks: [
            "核心链路冒烟用例全部通过",
            "关键链路错误率恢复正常",
            "客服侧无相关投诉上升"
          ],
          evidence: [
            { id: "smoke_ticket", label: "冒烟执行单号", placeholder: "如 ST-0916-114" }
          ]
        },
        {
          id: "s12",
          kind: "normal",
          title: "观察期监控",
          summary: "切换后 15 分钟观察窗：盯紧延迟、错误率与复制健康度。",
          actions: [
            "保持观察窗内高频巡检",
            "对比切换前后 P99 延迟曲线"
          ],
          checks: [
            "观察窗内无 P0 / P1 告警",
            "复制延迟持续 < 1s",
            "应用 P99 延迟回落至基线"
          ],
          evidence: [
            { id: "observe_start", label: "观察窗开始时间（HH:MM）", placeholder: "如 15:26", pattern: "^([01]?\\d|2[0-3]):[0-5]\\d$", patternHint: "格式：HH:MM" }
          ]
        },
        {
          id: "s13",
          kind: "decision",
          title: "复盘与旧主处置决策",
          summary: "高后果流程的闭环：把本次切换沉淀为资产，并尽快恢复冗余。",
          decision: {
            options: [
              {
                id: "rebuild",
                label: "重建旧主为新从库（推荐）",
                detail: "以 s6 快照将旧主库重建为新的从库，恢复一主一从冗余，预计 2 小时内完成。",
                outcome: "完成后冗余恢复，流程正常收尾",
                aborts: false
              },
              {
                id: "standby",
                label: "旧主降级待重建",
                detail: "资源受限时先将旧主下线隔离，挂重建工单；期间单副本运行并提升告警级别。",
                outcome: "单副本运行期需提升告警级别，流程正常收尾",
                aborts: false
              }
            ]
          },
          checks: [
            "复盘会议已排期（24 小时内）",
            "旧主处置方案已确认并指派负责人",
            "切换时间线已归档至作战室文档"
          ],
          evidence: [
            { id: "retro_doc", label: "复盘文档编号", placeholder: "如 RETRO-20260916" },
            { id: "rebuild_owner", label: "重建负责人", placeholder: "姓名" }
          ]
        }
      ]
    }
  ]
};
