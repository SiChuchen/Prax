"use strict";
/* ============================================================
   发布关口 · Release Gate
   单页 · 零依赖 · 初始数据内联，脚本执行即完成首屏渲染。
   用户任务：零失误走完一次高后果发布流程；
   不可逆步骤 = 确认门（提交前）+ 恢复点（提交后）。
   ============================================================ */

/* ---------------- 内联初始数据（首屏就绪，无任何异步加载） ---------------- */
const WORKFLOW = {
  code: "CHG-8842",
  title: "生产发布 · 订单服务 order-service v2.4.0",
  window: "变更窗口 22:00–23:30",
  phases: [
    {
      id: "P1", name: "阶段一 · 预检",
      steps: [
        {
          id: "S1", name: "变更单与预案核对", irreversible: false,
          actionLabel: "完成核验",
          why: "确认这次发布「该不该发、出了事怎么办」在纸面上已经闭环。这一步做实了，后面每个关口才有依据。",
          checks: [
            "变更单 CHG-8842 已批准，且在变更窗口内（22:00–23:30）",
            "影响面评估已确认：订单 / 支付 / 库存 3 个下游已同步",
            "回滚预案已评审，并在值班群周知"
          ]
        },
        {
          id: "S2", name: "构建产物验证", irreversible: false,
          actionLabel: "完成核验",
          why: "发布只允许使用经过验证的制品。checksum、冒烟与安全扫描三者齐全，才允许进入执行阶段。",
          checks: [
            "制品 order-service:2.4.0 的 checksum 与构建记录一致",
            "staging 冒烟测试全部通过",
            "安全扫描无高危漏洞"
          ]
        }
      ]
    },
    {
      id: "P2", name: "阶段二 · 发布执行",
      steps: [
        {
          id: "S3", name: "灰度发布（5% 流量）", irreversible: false,
          actionLabel: "开始灰度",
          why: "先放 5% 真实流量试水。此步可逆：流量可即时切回 v2.3.9，不产生持久性变更。",
          checks: [
            "灰度批次实例健康检查通过",
            "5% 流量下错误率 < 0.1% 且持续 10 分钟",
            "核心下单链路拨测正常"
          ]
        },
        {
          id: "S4", name: "数据库迁移（schema v23 → v24）", irreversible: true,
          actionLabel: "执行迁移", passcode: "MIGRATE",
          why: "本次迁移包含不可回退的 DDL。这是全流程第一个「过了就回不去」的关口，必须在确认门下执行。",
          consequence: "迁移脚本包含不可回退的 DDL：orders 表分片重建、v23 历史字段废弃。迁移完成后无法直接退回 v23 schema——只能依赖迁移前快照（将自动创建为恢复点）还原，还原预计 25 分钟，期间服务只读。",
          recoveryPlan: "自动创建迁移前全量快照作为恢复点；从恢复点还原预计 25 分钟（服务只读窗口）。",
          checks: [
            "迁移演练已在 staging 完成（实测 18 分钟）",
            "迁移前快照任务已排队，存储容量确认充足",
            "DBA 与值班负责人双人在岗"
          ]
        },
        {
          id: "S5", name: "全量发布切换", irreversible: true,
          actionLabel: "全量切换", passcode: "CUTOVER",
          why: "灰度观察达标后放量到 100%。v2.3.9 将从集群下线，配置中心切换立即生效。",
          consequence: "全量切换后 v2.3.9 从集群下线（镜像保留 72 小时），配置中心切换立即生效。此后回退不能简单「切回」，需从恢复点回退集群与配置，并重新走发布流程。",
          recoveryPlan: "提交时自动创建切换前恢复点；从恢复点回退集群与配置预计 8 分钟。",
          checks: [
            "灰度 30 分钟内错误率 < 0.1%、P99 < 380ms",
            "客服与运营已收到灰度通告",
            "回退脚本已在预发环境验证通过"
          ]
        }
      ]
    },
    {
      id: "P3", name: "阶段三 · 验证与关闭",
      steps: [
        {
          id: "S6", name: "生产验证", irreversible: false,
          actionLabel: "标记验证通过",
          why: "用生产数据说话：链路拨测、系统指标、业务指标三线确认，验证期发现任何异常都可回退。",
          checks: [
            "核心链路拨测（下单 / 支付 / 退款）通过",
            "错误率与容量指标连续 15 分钟正常",
            "业务指标（下单量、转化率）无异动告警"
          ]
        },
        {
          id: "S7", name: "关闭变更单并归档", irreversible: true, final: true,
          actionLabel: "关闭归档", passcode: "CLOSE",
          why: "观察期满无异常，本次发布正式终结。关闭是终局动作：变更单归档、流程锁定为「已完成」。",
          consequence: "关闭后变更单归档，本次发布状态锁定为「已完成」。此后发现问题需走新的变更单（紧急回滚通道仍开放）。关闭后 24 小时内可从终局恢复点重开本记录。",
          recoveryPlan: "提交时自动创建终局恢复点；关闭后 24 小时内可从该恢复点重开本次演练记录。",
          checks: [
            "监控观察期满（发布后 1 小时）无异常",
            "变更单执行记录已导出归档",
            "团队已同步发布完成"
          ]
        }
      ]
    }
  ]
};

/* ---------------- 派生常量 ---------------- */
const ALL_STEPS = WORKFLOW.phases.flatMap(p => p.steps.map(s => ({ ...s, phaseId: p.id, phaseName: p.name })));
const IRREVERSIBLE_STEPS = ALL_STEPS.filter(s => s.irreversible);
const TOTAL_CHECKS = ALL_STEPS.reduce((n, s) => n + s.checks.length, 0);
const stepById = id => ALL_STEPS.find(s => s.id === id);

/* ---------------- 状态（全屏唯一状态所有者） ---------------- */
function freshState() {
  const done = {};
  ALL_STEPS.forEach(s => { done[s.id] = { checks: s.checks.map(() => false), finished: false }; });
  return {
    done,
    selected: "S1",                 // selection
    gate: null,                     // mode: {kind:"commit"|"recover"|"reset", ...}
    checkpoints: [],                // inspector: 恢复点台账
    ledger: [],                     // inspector: 执行记录
    completedAt: null,
    startedAt: Date.now(),
    seq: 0,
    previewRp: null,                // preview: 悬停恢复点 → 导航器高亮来源步骤
    lastGateOpener: null
  };
}
let state = freshState();

/* ---------------- 工具 ---------------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => new Date().toLocaleTimeString("zh-CN", { hour12: false });
function elapsed(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
}

function log(kind, text) {
  state.ledger.push({ at: now(), kind, text });
}
function stepStatus(s) {
  if (state.done[s.id].finished) return s.irreversible ? "committed" : "done";
  const firstOpen = ALL_STEPS.findIndex(x => !state.done[x.id].finished);
  return ALL_STEPS.findIndex(x => x.id === s.id) === firstOpen ? "active" : "locked";
}
const isOpen = s => stepStatus(s) === "active";
const checksAllDone = s => state.done[s.id].checks.every(Boolean);
const checkedCount = () => ALL_STEPS.reduce((n, s) => n + state.done[s.id].checks.filter(Boolean).length, 0);
const confirmedCount = () => IRREVERSIBLE_STEPS.filter(s => state.done[s.id].finished).length;
const availableRp = () => state.checkpoints.filter(rp => !rp.superseded).length;

let toastTimer = null;
function toast(msg, cls) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast show" + (cls ? " is-" + cls : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = "toast"; }, 2800);
}

/* ---------------- 渲染 ---------------- */
function render() {
  renderHeader();
  renderNav();
  renderDetail();
  renderSide();
  renderGate();
}

function renderHeader() {
  $("#wf-title").textContent = WORKFLOW.title + " · " + WORKFLOW.code;
  const finished = state.completedAt != null;
  const badges = [
    { cls: "is-accent", html: `<span class="dot"></span>核验 <b>${checkedCount()}/${TOTAL_CHECKS}</b>` },
    { cls: confirmedCount() === IRREVERSIBLE_STEPS.length ? "is-ok" : "", html: `<span class="dot"></span>确认门 <b>${confirmedCount()}/${IRREVERSIBLE_STEPS.length}</b>` },
    { cls: "is-violet", html: `<span class="dot"></span>恢复点 <b>${availableRp()}</b> 可用` },
    { cls: finished ? "is-ok" : "", html: `<span class="dot"></span>流程 <b>${finished ? "已完成" : "进行中"}</b>` }
  ];
  $("#badges").innerHTML = badges.map(b => `<span class="badge ${b.cls}">${b.html}</span>`).join("");
  $("#nav-progress").textContent = `${ALL_STEPS.filter(s => state.done[s.id].finished).length}/${ALL_STEPS.length} 步`;
  $("#btn-reset").disabled = false;
}

const ST_ICON = { locked: "🔒", active: "▶", done: "✓", committed: "✓" };
const ST_TEXT = { locked: "锁定", active: "当前步骤", done: "已完成", committed: "已提交" };

function renderNav() {
  let html = "";
  WORKFLOW.phases.forEach((p, pi) => {
    const doneAll = p.steps.every(s => state.done[s.id].finished);
    const started = p.steps.some(s => state.done[s.id].finished) || p.steps.some(isOpen);
    html += `<div class="phase-label ${doneAll ? "is-done" : started ? "is-open" : ""}">
      <span class="phase-idx">${doneAll ? "✓" : pi + 1}</span>${esc(p.name)}<span class="phase-line"></span></div>`;
    p.steps.forEach(s => {
      const st = stepStatus(s);
      const sel = state.selected === s.id ? " is-selected" : "";
      const stepRps = state.checkpoints.filter(c => c.stepId === s.id && !c.superseded);
      const rp = stepRps[stepRps.length - 1];  // 同步多恢复点时，显示最新可用者
      html += `<button type="button" class="step-item${sel} is-${st}" data-action="select" data-step="${s.id}"
        tabindex="${state.selected === s.id ? "0" : "-1"}"
        aria-current="${state.selected === s.id ? "step" : "false"}"
        ${state.previewRp && rp && rp.id === state.previewRp ? ' data-preview="1" style="box-shadow:0 0 0 2px var(--violet-line)"' : ""}>
        <span class="st-icon" aria-hidden="true">${ST_ICON[st]}</span>
        <span class="st-body"><span class="st-name">${esc(s.name)}</span>
        <span class="st-meta">${ST_TEXT[st]}${s.irreversible ? " · 不可逆" : ""}</span></span>
        ${s.irreversible && st !== "committed" ? '<span class="st-flag">⚠ 不可逆</span>' : ""}
        ${rp ? `<span class="st-rp">${rp.id}</span>` : ""}
      </button>`;
    });
  });
  $("#nav-list").innerHTML = html;
}

function renderDetail() {
  const s = stepById(state.selected);
  const st = stepStatus(s);
  const rec = state.done[s.id];
  const finishedAll = state.completedAt != null;
  let html = `<div class="detail-inner">`;

  if (finishedAll) {
    const mins = elapsed(state.completedAt - state.startedAt);
    html += `<section class="complete-banner" aria-label="流程完成">
      <h2>✓ 流程完成 · 零失误走完全程</h2>
      <p>${esc(WORKFLOW.title)} 已关闭归档。全部核验项完成，${IRREVERSIBLE_STEPS.length} 个不可逆步骤均经确认门提交，每个提交都有恢复点可回溯（24 小时内可重开）。</p>
      <div class="complete-stats">
        <span class="stat-chip"><b>${checkedCount()}/${TOTAL_CHECKS}</b>核验项</span>
        <span class="stat-chip"><b>${confirmedCount()}/${IRREVERSIBLE_STEPS.length}</b>确认门通过</span>
        <span class="stat-chip"><b>${state.checkpoints.length}</b>恢复点</span>
        <span class="stat-chip"><b>${mins}</b>全程用时</span>
      </div></section>`;
  }

  html += `<div class="crumb">${esc(s.phaseName)} · 步骤 ${ALL_STEPS.findIndex(x => x.id === s.id) + 1}/${ALL_STEPS.length}
      ${s.irreversible ? '<span class="tag is-danger">⚠ 不可逆步骤</span>' : '<span class="tag">可逆步骤</span>'}
      ${st === "committed" ? '<span class="tag is-violet">已提交</span>' : st === "done" ? '<span class="tag is-ok">已完成</span>' : st === "locked" ? '<span class="tag is-lock">🔒 锁定</span>' : ""}</div>
    <div class="title-row"><h1>${esc(s.name)}</h1></div>
    <p class="why">${esc(s.why)}</p>`;

  if (st === "locked") {
    html += `<div class="locked-note">🔒 前置步骤未完成，此步骤已锁定。按顺序完成前面的步骤后自动解锁——流程不允许跳步。</div>`;
  } else {
    html += `<div class="section-label">核验清单 <span class="count">${rec.checks.filter(Boolean).length}/${s.checks.length}</span></div>
      <div class="checks" role="group" aria-label="核验清单">`;
    s.checks.forEach((c, i) => {
      const on = rec.checks[i];
      const dis = st !== "active" || rec.finished;
      html += `<label class="check${on ? " is-checked" : ""}${dis ? " is-disabled" : ""}">
        <input type="checkbox" data-action="toggle-check" data-step="${s.id}" data-idx="${i}"
          ${on ? "checked" : ""} ${dis ? "disabled" : ""} aria-label="${esc(c)}">
        <span class="check-text">${esc(c)}</span></label>`;
    });
    html += `</div>`;

    if (s.irreversible && !rec.finished) {
      html += `<div class="section-label">提交后果与恢复预案</div>
        <div class="consequence" id="consequence_panel">
          <h3>⚠ 此步骤不可逆</h3>
          <p>${esc(s.consequence)}</p>
          <div class="recovery-hint"><b>恢复路径：</b>${esc(s.recoveryPlan)} 提交成功后将自动创建恢复点。</div>
        </div>`;
    }

    // 主操作
    if (!rec.finished) {
      const ready = st === "active" && checksAllDone(s);
      const missing = s.checks.length - rec.checks.filter(Boolean).length;
      html += `<div class="action-row">
        <button type="button" class="btn ${s.irreversible ? "btn-danger" : "btn-primary"}" id="btn-primary"
          data-action="${s.irreversible ? "open-commit-gate" : "commit"}" data-step="${s.id}"
          ${ready ? "" : "disabled"}>
          ${s.irreversible ? "⚠ " : ""}${esc(s.actionLabel)}${s.final ? "（终局）" : ""}</button>
        <span class="action-hint">${st !== "active" ? "前置步骤未完成"
          : missing > 0 ? `还差 ${missing} 项核验未完成，完成后解锁` : s.irreversible ? "将打开确认门，需明示后果并输入口令" : "此步骤可逆，执行后仍可按预案回退"}</span>
      </div>`;
    } else if (s.irreversible) {
      const stepRps = state.checkpoints.filter(c => c.stepId === s.id && !c.superseded);
      const rp = stepRps[stepRps.length - 1];  // 同步多恢复点时，显示最新可用者
      html += `<div class="committed-note">✔ 已提交 · 不可直接撤销。<span class="rp-ref">${rp ? rp.id : "恢复点"}</span>
        已就绪，如需回退请使用右侧「恢复点」面板的恢复路径。</div>`;
    } else {
      html += `<div class="done-note">✔ 本步骤已完成（可逆步骤，如需可按预案重新执行前置检查）。</div>`;
    }
  }
  html += `</div>`;
  $("#step_detail").innerHTML = html;
}

function renderSide() {
  // 恢复点
  const rpEl = $("#rp-list");
  if (!state.checkpoints.length) {
    rpEl.innerHTML = `<div class="rp-empty">尚无恢复点。第一个不可逆步骤提交时，会自动在这里创建恢复点。</div>`;
  } else {
    rpEl.innerHTML = state.checkpoints.map(rp => `
      <div class="rp-card${rp.superseded ? " is-superseded" : ""}" data-rp="${rp.id}">
        <div class="rp-top"><span class="rp-id">${rp.id}</span><span class="rp-step">${esc(rp.stepName)} · ${esc(rp.actionLabel)}前</span></div>
        <span class="rp-time">创建于 ${rp.at}</span>
        <div class="rp-actions">
          <button type="button" class="btn-recover" data-action="open-recover-gate" data-rp="${rp.id}"
            ${rp.superseded ? "disabled" : ""}>恢复到此点</button>
          <span class="rp-mark">${rp.superseded ? "已被更新的提交取代" : "恢复需确认"}</span>
        </div></div>`).join("");
  }
  // 执行记录
  const lgEl = $("#ledger-list");
  if (!state.ledger.length) {
    lgEl.innerHTML = `<div class="ledger-empty">尚无执行记录。你的每个动作（核验 / 提交 / 恢复 / 重置）都会留痕在这里。</div>`;
  } else {
    const ICON = { check: "☑", commit: "⚠", recover: "↺", reset: "⟲", note: "ℹ" };
    lgEl.innerHTML = state.ledger.slice().reverse().map(e => `
      <li class="is-${e.kind}"><span class="lg-icon" aria-hidden="true">${ICON[e.kind] || "•"}</span>
      <span class="lg-body">${esc(e.text)}<span class="lg-time">${e.at}</span></span></li>`).join("");
  }
}

/* ---------------- 确认门（commit / recover / reset 三态模态） ---------------- */
function openGate(g, openerId) {
  state.lastGateOpener = openerId || null;
  state.gate = g;
  renderGate();
}
function closeGate() {
  state.gate = null;
  renderGate();
  if (state.lastGateOpener) {
    const back = document.getElementById(state.lastGateOpener);
    if (back && !back.disabled) back.focus();
  }
}

function renderGate() {
  const root = $("#modal-root");
  const g = state.gate;
  if (!g) { root.innerHTML = ""; document.body.style.overflow = ""; return; }
  document.body.style.overflow = "hidden";

  if (g.kind === "commit") {
    const s = stepById(g.stepId);
    root.innerHTML = `<div class="overlay" data-action="gate-overlay">
      <div class="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div class="gate-head">
          <div class="gate-kicker">⚠ 确认门 · 不可逆步骤</div>
          <h2 id="gate-title">${esc(s.actionLabel)}：${esc(s.name)}</h2>
        </div>
        <div class="gate-body">
          <div class="gate-consequence"><b>提交后不可直接撤销。</b>${esc(s.consequence)}</div>
          <div class="gate-checkpoint">提交成功将自动创建恢复点 <span class="rp-ref">RP-${state.seq + 1}</span>（恢复路径：${esc(s.recoveryPlan)}）</div>
          <label class="gate-ack"><input type="checkbox" id="gate-ack" data-action="gate-ack">
            <span>我已理解上述后果，确认核验清单全部满足、恢复预案可用，<b>有意执行</b>本不可逆操作。</span></label>
          <div class="gate-pass">
            <label for="gate-pass-input">输入口令 <code>${s.passcode}</code> 以启用提交</label>
            <input id="gate-pass-input" type="text" autocomplete="off" spellcheck="false"
              placeholder="输入 ${s.passcode}" data-action="gate-pass" aria-describedby="gate-err">
            <div class="gate-err" id="gate-err" role="alert"></div>
          </div>
        </div>
        <div class="gate-foot">
          <button type="button" class="btn btn-ghost" data-action="gate-cancel">取消</button>
          <button type="button" class="btn btn-danger" id="gate-confirm" data-action="gate-confirm" disabled>确认提交</button>
        </div>
      </div></div>`;
    $("#gate-ack").focus();
  }

  if (g.kind === "recover") {
    const rp = state.checkpoints.find(c => c.id === g.rpId);
    root.innerHTML = `<div class="overlay" data-action="gate-overlay">
      <div class="gate is-recover" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div class="gate-head">
          <div class="gate-kicker">↺ 恢复确认 · Recovery Gate</div>
          <h2 id="gate-title">从恢复点 ${rp.id} 恢复？</h2>
        </div>
        <div class="gate-body">
          <div class="gate-consequence">流程状态将回退到 <b>${esc(rp.stepName)}（${rp.actionLabel}）提交之前</b>：
            其后所有已提交步骤将回到待执行状态，其核验勾选将还原；本操作会记入执行记录。</div>
          <label class="gate-ack"><input type="checkbox" id="gate-ack" data-action="gate-ack">
            <span>我确认执行恢复，并理解其后已提交的步骤需要重新执行。</span></label>
          <div class="gate-err" id="gate-err" role="alert"></div>
        </div>
        <div class="gate-foot">
          <button type="button" class="btn btn-ghost" data-action="gate-cancel">取消</button>
          <button type="button" class="btn btn-danger" id="gate-confirm" data-action="gate-confirm" disabled>确认恢复</button>
        </div>
      </div></div>`;
    $("#gate-ack").focus();
  }

  if (g.kind === "reset") {
    root.innerHTML = `<div class="overlay" data-action="gate-overlay">
      <div class="gate is-reset" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div class="gate-head">
          <div class="gate-kicker">⟲ 重启演练</div>
          <h2 id="gate-title">重置整个流程到初始态？</h2>
        </div>
        <div class="gate-body">
          <div class="gate-consequence">当前演练的全部进度、${state.checkpoints.length} 个恢复点与执行记录将被清空，流程回到第一步。此操作不可撤销。</div>
          <label class="gate-ack"><input type="checkbox" id="gate-ack" data-action="gate-ack">
            <span>我确认丢弃当前演练进度并重新开始。</span></label>
          <div class="gate-pass">
            <label for="gate-pass-input">输入口令 <code>RESET</code> 以启用重置</label>
            <input id="gate-pass-input" type="text" autocomplete="off" spellcheck="false"
              placeholder="输入 RESET" data-action="gate-pass" aria-describedby="gate-err">
            <div class="gate-err" id="gate-err" role="alert"></div>
          </div>
        </div>
        <div class="gate-foot">
          <button type="button" class="btn btn-ghost" data-action="gate-cancel">取消</button>
          <button type="button" class="btn btn-danger" id="gate-confirm" data-action="gate-confirm" disabled>确认重置</button>
        </div>
      </div></div>`;
    $("#gate-ack").focus();
  }
}

/* 口令/勾选变化 → 仅同步提交按钮可用性（不整屏重渲染，保持输入焦点） */
function syncGateButton() {
  const g = state.gate;
  if (!g) return;
  const btn = $("#gate-confirm");
  const err = $("#gate-err");
  if (!btn) return;
  const ack = $("#gate-ack").checked;
  let passOk = true;
  if (g.kind === "commit") passOk = $("#gate-pass-input").value.trim() === stepById(g.stepId).passcode;
  if (g.kind === "reset") passOk = $("#gate-pass-input").value.trim() === "RESET";
  const ok = ack && passOk;
  btn.disabled = !ok;
  if (!ack) { err.textContent = ""; }
  else if (!passOk) { err.textContent = "口令不匹配——请核对括号中的口令原文（这是防误触的最后一道闸）。"; }
  else { err.textContent = ""; }
}

/* ---------------- 动作 ---------------- */
function commitStep(stepId) {
  const s = stepById(stepId);
  if (!isOpen(s) || !checksAllDone(s)) return;
  let rp = null;
  if (s.irreversible) {
    // 恢复点快照必须在标记完成之前取：它保存的是「提交前」的流程状态
    state.seq += 1;
    const snapshot = structuredClone({ done: state.done, completedAt: state.completedAt });
    rp = { id: "RP-" + state.seq, seq: state.seq, stepId: s.id,
      stepName: s.name, actionLabel: s.actionLabel, at: now(), snapshot, superseded: false };
  }
  state.done[stepId].finished = true;
  if (rp) {
    state.checkpoints.push(rp);
    log("commit", `已通过确认门提交「${s.name}」（口令 ${s.passcode}）· 自动创建恢复点 ${rp.id}`);
    toast(`已提交：${s.name} · 恢复点 ${rp.id} 已创建`, "violet");
  } else {
    log("check", `已完成可逆步骤「${s.name}」（${s.actionLabel}）`);
    toast(`已完成：${s.name}`);
  }
  if (s.final) {
    state.completedAt = Date.now();
    log("note", `流程完成 · 零失误走完全程（用时 ${elapsed(state.completedAt - state.startedAt)}）`);
  }
  // 推进选择到下一个未完成步骤
  const next = ALL_STEPS.find(x => !state.done[x.id].finished);
  state.selected = next ? next.id : s.id;
  render();
  const btn = $("#btn-primary");
  if (btn && !btn.disabled) btn.focus();
}

function doRecover(rpId) {
  const rp = state.checkpoints.find(c => c.id === rpId);
  if (!rp || rp.superseded) return;
  state.done = structuredClone(rp.snapshot.done);
  state.completedAt = rp.snapshot.completedAt;
  state.checkpoints.forEach(c => { if (c.seq > rp.seq) c.superseded = true; });
  const next = ALL_STEPS.find(x => !state.done[x.id].finished);
  state.selected = next ? next.id : rp.stepId;
  log("recover", `已从恢复点 ${rp.id} 恢复 · 流程回退到「${rp.stepName}」提交前，其后提交已回退`);
  toast(`已从 ${rp.id} 恢复 · 流程回退到「${rp.stepName}」提交前`, "violet");
  render();
}

function doReset() {
  const stats = `${checkedCount()} 项核验 · ${state.checkpoints.length} 个恢复点`;
  state = freshState();
  log("reset", `演练已重置（丢弃 ${stats}），流程回到初始态`);
  render();
  toast("演练已重置，流程回到第一步", "warn");
}

/* ---------------- 事件（委托） ---------------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el) {
    if (state.gate && e.target.classList && e.target.classList.contains("overlay")) closeGate();
    return;
  }
  const act = el.dataset.action;
  if (act === "gate-overlay") {
    if (e.target === el) closeGate();  // 仅点击遮罩本身关闭，点击对话框内部不关闭
    return;
  }
  if (act === "select") {
    state.selected = el.dataset.step;
    render();
  }
  if (act === "toggle-check") {
    const s = stepById(el.dataset.step);
    if (!isOpen(s) || state.done[s.id].finished) return;
    const i = Number(el.dataset.idx);
    const on = !state.done[s.id].checks[i];
    state.done[s.id].checks[i] = on;
    log("check", `${on ? "勾选" : "取消"}核验「${s.checks[i]}」（${s.name}）`);
    render();
  }
  if (act === "commit") commitStep(el.dataset.step);
  if (act === "open-commit-gate") {
    const s = stepById(el.dataset.step);
    if (!isOpen(s) || !checksAllDone(s)) return;
    openGate({ kind: "commit", stepId: s.id }, el.id || null);
  }
  if (act === "open-recover-gate") openGate({ kind: "recover", rpId: el.dataset.rp }, "btn-primary");
  if (act === "open-reset") openGate({ kind: "reset" }, "btn-reset");
  if (act === "gate-cancel") closeGate();
  if (act === "gate-confirm") {
    const g = state.gate;
    if (!g) return;
    if (g.kind === "commit") { state.gate = null; commitStep(g.stepId); }
    else if (g.kind === "recover") { state.gate = null; doRecover(g.rpId); }
    else if (g.kind === "reset") { state.gate = null; doReset(); }
  }
});

document.addEventListener("change", e => {
  if (e.target.matches('[data-action="gate-ack"]')) syncGateButton();
});
document.addEventListener("input", e => {
  if (e.target.matches('[data-action="gate-pass"]')) syncGateButton();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && state.gate) { closeGate(); return; }
  if (e.key === "Enter" && state.gate) {
    const btn = $("#gate-confirm");
    if (btn && !btn.disabled && e.target.id === "gate-pass-input") { e.preventDefault(); btn.click(); }
    return;
  }
  // 导航器方向键：↑/↓ 在步骤间移动选择（键盘等价路径）
  if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !state.gate) {
    const item = e.target.closest(".step-item");
    if (!item) return;
    e.preventDefault();
    const idx = ALL_STEPS.findIndex(s => s.id === item.dataset.step);
    const nextIdx = e.key === "ArrowDown" ? Math.min(ALL_STEPS.length - 1, idx + 1) : Math.max(0, idx - 1);
    state.selected = ALL_STEPS[nextIdx].id;
    render();
    const btn = document.querySelector(`.step-item[data-step="${state.selected}"]`);
    if (btn) btn.focus();
  }
});

// 恢复点悬停预览 → 导航器高亮来源步骤（preview state）
document.addEventListener("mouseover", e => {
  const card = e.target.closest("[data-rp]");
  const id = card ? card.dataset.rp : null;
  if (id !== state.previewRp) {
    state.previewRp = id;
    renderNav();
  }
});
document.addEventListener("mouseout", e => {
  if (e.target.closest && e.target.closest("[data-rp]") && state.previewRp) {
    state.previewRp = null;
    renderNav();
  }
});

/* ---------------- 首屏：脚本执行即同步渲染，页面加载完成即为可用状态 ---------------- */
render();
