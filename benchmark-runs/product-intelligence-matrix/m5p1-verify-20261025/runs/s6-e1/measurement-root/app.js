/* ============================================================
   发布指挥台 · 零失误护航（cell-j10-s09）
   纯静态实现：初始数据内联，页面加载即就绪，无任何网络请求。
   ============================================================ */
(function () {
"use strict";

/* ========== 内联流程数据（随首屏就绪的初始数据） ========== */
const FLOW = {
  id: "rel-2026-1025-018",
  name: "生产环境发布 · 订单服务 v2.7.0",
  ticket: "CHG-2417",
  phases: [
    {
      id: "p1", name: "阶段一 · 预检",
      steps: [
        {
          id: "s1", kind: "check",
          title: "核对变更单与回滚预案",
          desc: "确认变更已评审通过，且回滚预案具备可执行条件。",
          checks: [
            "变更单 CHG-2417 已评审通过",
            "回滚预案 ROLLBACK-2417 已确认可用"
          ]
        },
        {
          id: "s2", kind: "check",
          title: "检查系统基线",
          desc: "发布窗口开启前的健康检查。",
          checks: [
            "核心指标基线正常（错误率 < 0.1%）",
            "磁盘与连接水位安全（< 70%）"
          ]
        },
        {
          id: "s3", kind: "action",
          title: "通知值守团队进入发布窗口",
          desc: "向 #ops-oncall 同步发布计划与值守安排。",
          actionLabel: "标记已通知",
          simulateMs: 600,
          resultNote: "已通知 #ops-oncall：发布窗口 14:00 – 15:00"
        }
      ]
    },
    {
      id: "p2", name: "阶段二 · 构建",
      steps: [
        {
          id: "s4", kind: "action",
          title: "触发构建流水线 #1843",
          desc: "从 main@e41c2f 构建发布产物并推送生产仓库。",
          actionLabel: "触发构建",
          simulateMs: 2200,
          resultNote: "产物 order-service:2.7.0（sha256:9f2c…e1）已推送至生产仓库"
        },
        {
          id: "s5", kind: "check",
          title: "校验产物签名与镜像摘要",
          desc: "发布前最后一道产物完整性核对。",
          checks: [
            "镜像签名校验通过（cosign verify）",
            "摘要与流水线输出一致（sha256:9f2c…e1）"
          ]
        }
      ]
    },
    {
      id: "p3", name: "阶段三 · 发布",
      steps: [
        {
          id: "s6", kind: "irreversible",
          title: "冻结上游写入",
          desc: "上游写入进入排队，为切流做准备。",
          actionLabel: "冻结写入",
          consequence: "上游写入将进入排队（预计 ≤ 10 分钟），商户侧出现短暂写延迟；不影响已提交订单。",
          understandings: [
            "我已确认当前处于低峰时段，写队列容量充足",
            "我已知晓冻结期间新写入将排队而非丢失"
          ],
          confirmExpect: "CHG-2417",
          recoverySeconds: 10,
          undoText: "已撤销：解除写入冻结（恢复窗口内回退）",
          settleText: "落定生效：上游写入已冻结",
          rollbackPlan: "撤销冻结即完全恢复，写队列自动回放；本步骤无需数据回滚。"
        },
        {
          id: "s7", kind: "irreversible",
          title: "切换生产流量至 v2.7.0",
          desc: "网关全量切流，线上用户开始使用新版本。",
          actionLabel: "切换流量",
          consequence: "全量线上用户立即使用新版本；如异常须执行回滚预案（约 40 秒切回 v2.6.4）。",
          understandings: [
            "我已确认灰度批次无异常报告",
            "我已知晓切流后用户会话将平滑迁移"
          ],
          confirmExpect: "CHG-2417",
          recoverySeconds: 12,
          undoText: "已撤销：自动切回 v2.6.4（恢复窗口内回退）",
          settleText: "落定生效：生产流量已切换至 v2.7.0",
          rollbackPlan: "ROLLBACK-2417：网关切回 v2.6.4 镜像，约 40 秒生效；订单数据双写兼容，无需清洗。"
        },
        {
          id: "s8", kind: "check",
          title: "观察核心指标",
          desc: "切流后观察 5 秒（模拟窗口），确认指标平稳。",
          observe: {
            ms: 5000,
            buttonLabel: "开始观察（5 秒模拟窗口）",
            metrics: [
              { label: "错误率", value: "0.02%", threshold: "基线 0.1%" },
              { label: "P99 延迟", value: "182 ms", threshold: "基线 250 ms" }
            ]
          },
          checks: [
            "错误率 0.02% ≤ 基线 0.1%",
            "P99 延迟 182 ms ≤ 基线 250 ms"
          ]
        }
      ]
    },
    {
      id: "p4", name: "阶段四 · 收尾",
      steps: [
        {
          id: "s9", kind: "irreversible",
          title: "解除写入冻结，落定版本 v2.7.0",
          desc: "发布正式落定，恢复上游写入。",
          actionLabel: "落定版本",
          consequence: "发布正式落定；此后如需回退，必须执行完整回滚预案并向商户发布通告。",
          understandings: [
            "我已确认核心指标均在基线以内",
            "我已知晓落定后回退需走完整回滚流程"
          ],
          confirmExpect: "CHG-2417",
          recoverySeconds: 8,
          undoText: "已撤销：重新进入冻结状态（恢复窗口内回退）",
          settleText: "落定生效：版本 v2.7.0 已落定",
          rollbackPlan: "落定后回滚：执行 ROLLBACK-2417 全量预案并发布公告，预计 15 分钟恢复。"
        },
        {
          id: "s10", kind: "check",
          title: "归档发布记录并宣告完成",
          desc: "全程留痕归档，向相关方宣告发布完成。",
          checks: [
            "发布记录已归档至 CHANGELOG",
            "已在 #ops 频道宣告发布完成"
          ]
        }
      ]
    }
  ]
};

const STEPS = [];
FLOW.phases.forEach(function (ph) {
  ph.steps.forEach(function (st) { STEPS.push(Object.assign({}, st, { phaseId: ph.id })); });
});
const TOTAL = STEPS.length;
const IRREVERSIBLE_COUNT = STEPS.filter(function (s) { return s.kind === "irreversible"; }).length;

/* ========== DOM 引用 ========== */
function $(sel) { return document.querySelector(sel); }
const stepListEl = $("#step-list");
const phaseNavEl = $("#phase-nav");
const progressTextEl = $("#progress-text");
const progressBarEl = $("#progress-bar");
const progressFillEl = $("#progress-fill");
const elapsedEl = $("#elapsed");
const interceptCountEl = $("#intercept-count");
const zeroHintEl = $("#zero-hint");
const auditFeedEl = $("#audit-feed");
const summarySlotEl = $("#summary-slot");
const toastEl = $("#toast");
const modalRootEl = $("#modal-root");
const resetBtn = $("#reset-btn");

/* ========== 运行状态 ========== */
const state = {
  status: {},        // stepId -> locked | ready | executing | armed | done
  currentIdx: 0,
  intercepts: 0,
  undoCount: 0,
  confirmCount: 0,
  checked: {},       // stepId -> {index:true}
  observed: {},      // stepId -> true（观察窗口已结束，勾选可见）
  armedStepId: null,
  armedRemain: 0,    // 秒（0.1 精度）
  finished: false,
  startedAt: 0,
  finishedAt: 0,
  modalOpen: false
};
const cardRefs = {};   // stepId -> {card, chip, reason, button, note, progress, checkInputs, checkItems, metricList, observeArea, remainText, remainBar, undoBtn}
const phaseRefs = [];

/* ========== 工具 ========== */
function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}
function elapsedMs() { return (state.finishedAt || performance.now()) - state.startedAt; }
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

const AUDIT_TAGS = { system: "系统", execute: "执行", confirm: "确认", undo: "撤销", intercept: "拦截", done: "完成" };
function audit(kind, text) {
  const t = fmtClock(elapsedMs());
  const li = el("li", "ev ev-" + kind);
  li.appendChild(el("span", "ev-t", t));
  li.appendChild(el("span", "ev-tag", AUDIT_TAGS[kind] || kind));
  li.appendChild(el("span", "ev-text", text));
  auditFeedEl.prepend(li);
  while (auditFeedEl.children.length > 60) auditFeedEl.removeChild(auditFeedEl.lastChild);
}

let toastTimer = null;
function toast(msg, isDanger) {
  toastEl.textContent = msg;
  toastEl.classList.toggle("danger", !!isDanger);
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2800);
}

/* ========== 顺序守卫：派生步骤状态 ========== */
function refreshOrderStatuses() {
  let cur = -1;
  for (let i = 0; i < TOTAL; i++) {
    if (state.status[STEPS[i].id] !== "done") { cur = i; break; }
  }
  state.currentIdx = cur;
  STEPS.forEach(function (st, i) {
    const s = state.status[st.id];
    if (s === "executing" || s === "armed" || s === "done") return;
    state.status[st.id] = (i === cur) ? "ready" : "locked";
  });
  state.finished = (cur === -1);
}

/* ========== 拦截 ========== */
function intercept(step, reason) {
  if (state.finished) return;
  state.intercepts++;
  audit("intercept", "拦截越序操作：" + step.title + " — " + reason);
  toast(reason, true);
  const ref = cardRefs[step.id];
  if (ref) {
    ref.card.classList.remove("flash");
    void ref.card.offsetWidth;
    ref.card.classList.add("flash");
  }
  renderSideAndHeader();
}

/* ========== 步骤完成与推进 ========== */
function completeStep(step, customAuditText) {
  state.status[step.id] = "done";
  audit("done", customAuditText || ("完成：" + step.title));
  refreshOrderStatuses();
  if (state.finished) {
    finishFlow();
  } else {
    renderAll();
    focusCurrentControl();
  }
}

function finishFlow() {
  state.finishedAt = performance.now();
  const used = fmtClock(elapsedMs());
  audit("done", "发布完成：全部 " + TOTAL + " 步按序完成，用时 " + used +
        "，风险拦截 " + state.intercepts + " 次");
  renderSummary();
  renderAll();
}

function focusCurrentControl() {
  if (state.finished || state.currentIdx < 0) return;
  const step = STEPS[state.currentIdx];
  const ref = cardRefs[step.id];
  if (!ref) return;
  ref.card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  let target = null;
  if (step.kind === "check") {
    const enabled = ref.checkInputs.filter(function (i) { return !i.disabled; });
    target = enabled[0] || ref.observeButton || null;
  } else {
    target = ref.button;
  }
  if (target && !target.disabled) target.focus({ preventScroll: true });
}

/* ========== 动作类步骤（模拟执行） ========== */
function runAction(step) {
  const ref = cardRefs[step.id];
  state.status[step.id] = "executing";
  audit("execute", "执行：" + step.title);
  if (ref.progress) {
    ref.progress.style.transition = "none";
    ref.progress.style.width = "0%";
    void ref.progress.offsetWidth;
    ref.progress.style.transition = "width " + step.simulateMs + "ms linear";
    ref.progress.style.width = "100%";
  }
  renderAll();
  setTimeout(function () {
    if (state.status[step.id] !== "executing") return;
    if (ref.note && step.resultNote) {
      ref.note.textContent = step.resultNote;
      ref.note.classList.add("ok");
    }
    completeStep(step);
  }, step.simulateMs);
}

/* ========== 观察类步骤（核对 + 模拟窗口） ========== */
function runObserve(step) {
  const ref = cardRefs[step.id];
  state.status[step.id] = "executing";
  audit("execute", "开始观察：" + step.title + "（5 秒模拟窗口）");
  if (ref.progress) {
    ref.progress.style.transition = "none";
    ref.progress.style.width = "0%";
    void ref.progress.offsetWidth;
    ref.progress.style.transition = "width " + step.observe.ms + "ms linear";
    ref.progress.style.width = "100%";
  }
  renderAll();
  setTimeout(function () {
    if (state.status[step.id] !== "executing") return;
    state.observed[step.id] = true;
    state.status[step.id] = "ready";
    if (ref.metricList) ref.metricList.style.display = "flex";
    audit("system", "观察结束：指标在基线内，请逐项确认");
    renderAll();
    focusCurrentControl();
  }, step.observe.ms);
}

/* ========== 不可逆步骤：确认关卡 + 恢复窗口 ========== */
function executeIrreversible(step) {
  state.confirmCount++;
  audit("confirm", "确认执行：" + step.title + "（变更单 " + FLOW.ticket + "）");
  audit("execute", "执行：" + step.title);
  state.status[step.id] = "armed";
  state.armedStepId = step.id;
  state.armedRemain = step.recoverySeconds;
  renderAll();
}

function settleArmed() {
  const step = STEPS.filter(function (s) { return s.id === state.armedStepId; })[0];
  state.armedStepId = null;
  state.armedRemain = 0;
  if (!step) return;
  completeStep(step, step.settleText);
}

function undoArmed() {
  const step = STEPS.filter(function (s) { return s.id === state.armedStepId; })[0];
  state.armedStepId = null;
  state.armedRemain = 0;
  if (!step) return;
  state.undoCount++;
  audit("undo", step.undoText);
  state.status[step.id] = "ready";
  refreshOrderStatuses();
  renderAll();
  focusCurrentControl();
}

/* ========== 模态（确认关卡 / 重置确认） ========== */
function closeModal() {
  modalRootEl.innerHTML = "";
  state.modalOpen = false;
}

function openConfirmModal(step) {
  const idx = STEPS.indexOf(step);
  state.modalOpen = true;

  const backdrop = el("div", "modal-backdrop");
  const modal = el("div", "modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  const titleId = "modal-title-" + step.id;
  modal.setAttribute("aria-labelledby", titleId);

  const titleEl = el("h3", null, "确认执行 · " + step.title);
  titleEl.id = titleId;
  modal.appendChild(titleEl);
  modal.appendChild(el("p", "m-kind",
    "不可逆操作 · 第 " + (idx + 1) + " / " + TOTAL + " 步 · 执行后 " +
    step.recoverySeconds + " 秒恢复窗口内可撤销"));

  const secCon = el("div", "m-section");
  secCon.appendChild(el("h4", null, "执行后果"));
  secCon.appendChild(el("div", "m-consequence", step.consequence));
  modal.appendChild(secCon);

  const fieldset = el("fieldset", "m-understand");
  const legend = el("legend", null, "执行前请逐项确认");
  fieldset.appendChild(legend);
  const boxes = step.understandings.map(function (text, ui) {
    const item = el("div", "check-item");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = "und-" + step.id + "-" + ui;
    item.appendChild(input);
    const label = el("label", null, text);
    label.setAttribute("for", input.id);
    item.appendChild(label);
    fieldset.appendChild(item);
    return input;
  });
  modal.appendChild(fieldset);

  const secInput = el("div", "m-section m-input");
  const inputLabel = el("label", null, null);
  inputLabel.appendChild(document.createTextNode("输入变更单号 "));
  const code = el("code", null, step.confirmExpect);
  inputLabel.appendChild(code);
  inputLabel.appendChild(document.createTextNode(" 以确认操作意图"));
  secInput.appendChild(inputLabel);
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = step.confirmExpect;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "输入变更单号以确认操作意图");
  secInput.appendChild(input);
  secInput.appendChild(el("p", "m-input-hint", "输入式确认：确保你清楚正在操作的对象，而非顺手点击。"));
  modal.appendChild(secInput);

  const secRoll = el("div", "m-section m-rollback");
  secRoll.appendChild(el("h4", null, "恢复路径"));
  secRoll.appendChild(el("p", null,
    "执行后 " + step.recoverySeconds + " 秒恢复窗口内可一键撤销；落定后预案：" + step.rollbackPlan));
  modal.appendChild(secRoll);

  const actions = el("div", "m-actions");
  const cancelBtn = el("button", "btn ghost", "取消");
  cancelBtn.type = "button";
  const confirmBtn = el("button", "btn danger", "确认执行");
  confirmBtn.type = "button";
  confirmBtn.disabled = true;
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);

  function revalidate() {
    const allChecked = boxes.every(function (b) { return b.checked; });
    const typed = input.value.trim().toUpperCase() === step.confirmExpect.toUpperCase();
    confirmBtn.disabled = !(allChecked && typed);
  }
  boxes.forEach(function (b) { b.addEventListener("change", revalidate); });
  input.addEventListener("input", revalidate);

  cancelBtn.addEventListener("click", function () {
    audit("system", "关闭确认关卡：" + step.title + "（未执行）");
    closeModal();
    const ref = cardRefs[step.id];
    if (ref && ref.button) ref.button.focus({ preventScroll: true });
  });
  confirmBtn.addEventListener("click", function () {
    if (confirmBtn.disabled) return;
    closeModal();
    executeIrreversible(step);
  });
  backdrop.addEventListener("mousedown", function (e) {
    if (e.target === backdrop) cancelBtn.click();
  });

  backdrop.appendChild(modal);
  modalRootEl.appendChild(backdrop);

  document.addEventListener("keydown", escListener);
  boxes[0].focus();
}
function escListener(e) {
  if (!state.modalOpen) return;
  if (e.key === "Escape") {
    const cancel = modalRootEl.querySelector(".m-actions .btn.ghost");
    if (cancel) cancel.click();
  } else if (e.key === "Tab") {
    /* 焦点圈：模态打开时 Tab 循环限制在对话框内 */
    const focusables = modalRootEl.querySelectorAll("button, input");
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
}

function openResetModal() {
  state.modalOpen = true;
  const backdrop = el("div", "modal-backdrop");
  const modal = el("div", "modal reset-modal");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "reset-title");

  const resetTitle = el("h3", null, "重置演练？");
  resetTitle.id = "reset-title";
  modal.appendChild(resetTitle);
  modal.appendChild(el("p", "m-kind", "破坏性操作 · 全部进度与审计记录将被清空"));

  const secCon = el("div", "m-section");
  secCon.appendChild(el("h4", null, "影响范围"));
  secCon.appendChild(el("div", "m-consequence",
    "流程回到初始就绪态：步骤进度、恢复窗口、拦截计数与审计日志全部归零。此操作不可恢复。"));
  modal.appendChild(secCon);

  const actions = el("div", "m-actions");
  const cancelBtn = el("button", "btn ghost", "取消");
  cancelBtn.type = "button";
  const confirmBtn = el("button", "btn danger", "确认重置");
  confirmBtn.type = "button";
  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  modal.appendChild(actions);

  cancelBtn.addEventListener("click", function () {
    closeModal();
    resetBtn.focus({ preventScroll: true });
  });
  confirmBtn.addEventListener("click", function () {
    closeModal();
    resetAll();
  });
  backdrop.addEventListener("mousedown", function (e) {
    if (e.target === backdrop) cancelBtn.click();
  });

  backdrop.appendChild(modal);
  modalRootEl.appendChild(backdrop);
  document.addEventListener("keydown", escListener);
  cancelBtn.focus();
}

/* ========== DOM 构建（一次性） ========== */
function buildPhaseNav() {
  phaseNavEl.innerHTML = "";
  phaseRefs.length = 0;
  FLOW.phases.forEach(function (ph) {
    const btn = el("button", "phase-item");
    btn.type = "button";
    const dot = el("span", "phase-dot");
    btn.appendChild(dot);
    const name = el("span", "phase-name", ph.name);
    const sub = el("span", "phase-sub", "");
    btn.appendChild(name);
    btn.appendChild(sub);
    btn.addEventListener("click", function () {
      const heading = stepListEl.querySelector('[data-phase-heading="' + ph.id + '"]');
      if (heading) heading.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    phaseNavEl.appendChild(btn);
    phaseRefs.push({ phase: ph, btn: btn, sub: sub });
  });
}

function buildStepCard(step, idx) {
  const li = el("li", "step-card");
  li.setAttribute("data-step", step.id);

  const head = el("div", "step-head");
  const no = el("span", "step-no", String(idx + 1));
  head.appendChild(no);

  const titles = el("div", "step-titles");
  const titleRow = el("h3", "step-title");
  titleRow.appendChild(el("span", null, step.title));
  const badgeCls = step.kind === "irreversible" ? "kind-badge kind-irrev"
    : step.kind === "action" ? "kind-badge kind-action" : "kind-badge kind-check";
  const badgeText = step.kind === "irreversible" ? "不可逆" : step.kind === "action" ? "操作" : "核对";
  titleRow.appendChild(el("span", badgeCls, badgeText));
  titles.appendChild(titleRow);
  titles.appendChild(el("p", "step-desc", step.desc));
  head.appendChild(titles);

  const chip = el("span", "status-chip st-locked", "按序等待");
  head.appendChild(chip);
  li.appendChild(head);

  const body = el("div", "step-body");
  const ref = {
    card: li, chip: chip,
    checkInputs: [], checkItems: [],
    button: null, note: null, progress: null,
    metricList: null, observeButton: null,
    remainText: null, remainBar: null, undoBtn: null,
    rollback: null
  };

  if (step.kind === "check") {
    if (step.observe) {
      const ob = el("div", null);
      ob.style.marginBottom = "10px";
      const obBtn = el("button", "btn primary", step.observe.buttonLabel);
      obBtn.type = "button";
      obBtn.disabled = true;
      obBtn.addEventListener("click", function () {
        if (state.status[step.id] === "ready") runObserve(step);
      });
      ob.appendChild(obBtn);
      const prog = el("div", "inline-progress");
      const progFill = el("div");
      prog.appendChild(progFill);
      ob.appendChild(prog);
      const metrics = el("ul", "metric-list");
      metrics.style.display = "none";
      step.observe.metrics.forEach(function (m) {
        const chipM = el("li", "metric-chip");
        const b = el("b", null, m.value);
        chipM.appendChild(document.createTextNode(m.label + " "));
        chipM.appendChild(b);
        chipM.appendChild(document.createTextNode("（" + m.threshold + "）"));
        metrics.appendChild(chipM);
      });
      ob.appendChild(metrics);
      body.appendChild(ob);
      ref.observeButton = obBtn;
      ref.progress = progFill;
      ref.metricList = metrics;
    }
    const ul = el("ul", "check-list");
    step.checks.forEach(function (text, ci) {
      const item = el("li", "check-item");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "chk-" + step.id + "-" + ci;
      input.disabled = true;
      input.addEventListener("change", function () {
        onCheckChange(step, ci, input);
      });
      item.appendChild(input);
      const label = el("label", null, text);
      label.setAttribute("for", input.id);
      item.appendChild(label);
      ul.appendChild(item);
      ref.checkInputs.push(input);
      ref.checkItems.push(item);
    });
    body.appendChild(ul);
  }

  if (step.kind === "action") {
    const btn = el("button", "btn primary", step.actionLabel);
    btn.type = "button";
    btn.disabled = true;
    btn.addEventListener("click", function () {
      if (state.status[step.id] === "ready") runAction(step);
    });
    body.appendChild(btn);
    const prog = el("div", "inline-progress");
    prog.style.display = "none";
    const progFill = el("div");
    prog.appendChild(progFill);
    body.appendChild(prog);
    const note = el("p", "action-note");
    body.appendChild(note);
    ref.button = btn;
    ref.progress = progFill;
    ref.note = note;
  }

  if (step.kind === "irreversible") {
    const btn = el("button", "btn warn-solid", step.actionLabel);
    btn.type = "button";
    btn.disabled = true;
    btn.addEventListener("click", function () {
      if (state.status[step.id] === "ready") openConfirmModal(step);
    });
    body.appendChild(btn);

    const roll = el("details", "rollback");
    const sum = el("summary", null, "查看回滚预案");
    roll.appendChild(sum);
    roll.appendChild(el("p", null, step.rollbackPlan));
    body.appendChild(roll);
    ref.rollback = roll;

    const rec = el("div", "recovery-box");
    const top = el("div", "recovery-top");
    top.appendChild(el("span", "recovery-title", "⚠ 恢复窗口"));
    const remain = el("span", "recovery-count", "");
    top.appendChild(remain);
    const bar = el("div", "recovery-bar");
    const barFill = el("div");
    bar.appendChild(barFill);
    top.appendChild(bar);
    const undoBtn = el("button", "btn warn-solid", "撤销本次操作");
    undoBtn.type = "button";
    undoBtn.addEventListener("click", function () {
      if (state.armedStepId === step.id) undoArmed();
    });
    top.appendChild(undoBtn);
    rec.appendChild(top);
    rec.appendChild(el("p", "recovery-hint",
      "窗口落定后本步骤生效；落定前可一键撤销并恢复到执行前状态。"));
    body.appendChild(rec);

    ref.button = btn;
    ref.remainText = remain;
    ref.remainBar = barFill;
    ref.undoBtn = undoBtn;
  }

  li.appendChild(body);

  const reason = el("div", "guard-reason", "");
  li.appendChild(reason);
  ref.reason = reason;

  li.addEventListener("click", function (e) {
    if (state.finished) return;
    if (state.status[step.id] !== "locked") return;
    const cur = STEPS[state.currentIdx];
    if (!cur) return;
    const curStatus = state.status[cur.id];
    let reasonText;
    if (curStatus === "armed") reasonText = "恢复窗口进行中：先撤销或等待「" + cur.title + "」落定";
    else if (curStatus === "executing") reasonText = "当前步骤执行中：等待「" + cur.title + "」完成";
    else reasonText = "顺序守卫：需先完成「" + cur.title + "」";
    intercept(step, reasonText);
  });

  stepListEl.appendChild(li);
  cardRefs[step.id] = ref;
}

function buildStepList() {
  stepListEl.innerHTML = "";
  let idx = 0;
  FLOW.phases.forEach(function (ph) {
    const heading = el("li", "phase-heading", ph.name);
    heading.setAttribute("data-phase-heading", ph.id);
    stepListEl.appendChild(heading);
    ph.steps.forEach(function (st) {
      buildStepCard(st, idx);
      idx++;
    });
  });
}

function onCheckChange(step, ci, input) {
  const status = state.status[step.id];
  if (status !== "ready" || state.finished) { input.checked = !!state.checked[step.id]?.[ci]; return; }
  if (!state.checked[step.id]) state.checked[step.id] = {};
  state.checked[step.id][ci] = input.checked;
  cardRefs[step.id].checkItems[ci].classList.toggle("checked", input.checked);
  const all = step.checks.every(function (_t, i) { return state.checked[step.id][i]; });
  if (all) {
    const n = Object.keys(state.checked[step.id]).length;
    completeStep(step, "完成：" + step.title + "（" + n + " 项核对通过）");
  }
}

/* ========== 渲染 ========== */
const CHIP_CLS = { locked: "st-locked", ready: "st-ready", executing: "st-executing", armed: "st-armed", done: "st-done" };
const CHIP_TXT = { locked: "按序等待", ready: "可执行", executing: "执行中…", armed: "恢复窗口", done: "已完成" };
const REASON_TXT = {
  locked: "按序等待", ready: "当前步骤：完成它以解锁后续步骤",
  executing: "执行中，请稍候", armed: "恢复窗口倒计时中", done: "已完成并留痕"
};

function renderAll() { renderSteps(); renderSideAndHeader(); renderPhaseNav(); }

function renderSteps() {
  STEPS.forEach(function (step, i) {
    const ref = cardRefs[step.id];
    const status = state.status[step.id] || "locked";
    ref.card.className = "step-card" +
      (status === "locked" ? " locked" : "") +
      (step.kind === "irreversible" ? " irreversible" : "") +
      (status === "armed" ? " armed" : "") +
      (status === "done" ? " done" : "") +
      (i === state.currentIdx && !state.finished ? " current" : "");

    ref.chip.className = "status-chip " + CHIP_CLS[status];
    ref.chip.textContent = CHIP_TXT[status];

    const cur = STEPS[state.currentIdx];
    if (status === "locked") {
      const curStatus = cur ? state.status[cur.id] : null;
      let t = "按序等待：先完成「" + (cur ? cur.title : "") + "」";
      if (curStatus === "armed") t = "恢复窗口进行中：等待「" + cur.title + "」撤销或落定";
      else if (curStatus === "executing") t = "执行中：等待「" + cur.title + "」完成";
      ref.reason.textContent = t;
    } else {
      ref.reason.textContent = REASON_TXT[status];
    }

    const isReady = status === "ready";
    if (step.kind === "check") {
      const canCheck = isReady && (!step.observe || state.observed[step.id]);
      ref.checkInputs.forEach(function (input) { input.disabled = !canCheck; });
      if (ref.observeButton) {
        ref.observeButton.disabled = !isReady || !!state.observed[step.id];
        ref.observeButton.textContent = state.observed[step.id] ? "观察完成" : step.observe.buttonLabel;
        ref.observeButton.classList.toggle("primary", !state.observed[step.id]);
      }
    } else if (ref.button) {
      ref.button.disabled = !isReady;
      if (ref.progress) {
        ref.progress.parentElement.style.display = (status === "executing") ? "block" : "none";
      }
    }
    if (ref.rollback) ref.rollback.tabIndex = isReady ? 0 : -1;
    if (ref.undoBtn) ref.undoBtn.disabled = status !== "armed";
  });
}

function renderSideAndHeader() {
  const doneCount = STEPS.filter(function (s) { return state.status[s.id] === "done"; }).length;
  progressTextEl.textContent = doneCount + " / " + TOTAL + " 步";
  progressBarEl.setAttribute("aria-valuenow", String(doneCount));
  progressFillEl.style.width = (doneCount / TOTAL * 100) + "%";

  interceptCountEl.textContent = String(state.intercepts);
  interceptCountEl.classList.toggle("flawed", state.intercepts > 0);
  if (state.finished) {
    zeroHintEl.textContent = state.intercepts === 0
      ? "零失误走完全程 ✓"
      : "完成，但过程中有 " + state.intercepts + " 次风险操作被拦截";
  } else {
    zeroHintEl.textContent = "顺序守卫与确认关卡运行中";
  }
}

function renderPhaseNav() {
  phaseRefs.forEach(function (refObj) {
    const steps = refObj.phase.steps;
    const done = steps.filter(function (s) { return state.status[s.id] === "done"; }).length;
    refObj.sub.textContent = done + " / " + steps.length + " 步";
    refObj.btn.classList.toggle("done", done === steps.length);
    const hasCurrent = steps.some(function (s) { return STEPS[state.currentIdx] && STEPS[state.currentIdx].id === s.id; });
    refObj.btn.classList.toggle("active", hasCurrent);
  });
}

function renderSummary() {
  const ok = state.intercepts === 0;
  const used = fmtClock(elapsedMs());
  const evCount = auditFeedEl.children.length;
  summarySlotEl.innerHTML = "";
  const sec = el("section", "summary-card" + (ok ? "" : " flawed"));

  const badge = el("div", "sum-badge", ok ? "零失误" : (state.intercepts + " 次拦截"));
  sec.appendChild(badge);

  const wrap = el("div");
  wrap.appendChild(el("h2", null, ok ? "发布流程全程完成 · 零失误" : "发布流程全程完成"));
  wrap.appendChild(el("p", null, ok
    ? "订单服务 v2.7.0 已在生产环境落定：全部 " + TOTAL + " 步按序完成，未触发任何守卫拦截。"
    : "订单服务 v2.7.0 已落定，但过程中有 " + state.intercepts + " 次风险操作被顺序守卫拦截并留痕。"));
  const stats = el("div", "sum-stats");
  [["总用时", used],
   ["不可逆确认", state.confirmCount + " 次"],
   ["恢复窗口撤销", state.undoCount + " 次"],
   ["风险拦截", state.intercepts + " 次"],
   ["审计事件", evCount + " 条"]].forEach(function (p) {
    const s = el("div", "sum-stat");
    s.appendChild(el("b", null, p[1]));
    s.appendChild(document.createTextNode(p[0]));
    stats.appendChild(s);
  });
  wrap.appendChild(stats);
  sec.appendChild(wrap);
  summarySlotEl.appendChild(sec);
}

/* ========== 初始化 / 重置 ========== */
function resetCoreState() {
  STEPS.forEach(function (st) { state.status[st.id] = "locked"; });
  state.currentIdx = 0;
  state.intercepts = 0;
  state.undoCount = 0;
  state.confirmCount = 0;
  state.checked = {};
  state.observed = {};
  state.armedStepId = null;
  state.armedRemain = 0;
  state.finished = false;
  state.startedAt = performance.now();
  state.finishedAt = 0;
  refreshOrderStatuses();
}

function buildAll() {
  buildPhaseNav();
  buildStepList();
  auditFeedEl.innerHTML = "";
  summarySlotEl.innerHTML = "";
  audit("system", "发布窗口开启：流程就绪，共 " + TOTAL + " 步（含 " + IRREVERSIBLE_COUNT + " 步不可逆操作）");
  renderAll();
}

function resetAll() {
  resetCoreState();
  buildAll();
  toast("演练已重置：流程回到初始就绪态", false);
  const first = cardRefs[STEPS[0].id];
  if (first && first.checkInputs[0]) first.checkInputs[0].focus({ preventScroll: true });
}

/* 全局时钟：演练用时 + 恢复窗口倒计时 */
setInterval(function () {
  elapsedEl.textContent = fmtClock(elapsedMs());
  if (state.armedStepId) {
    state.armedRemain = Math.max(0, state.armedRemain - 0.1);
    const ref = cardRefs[state.armedStepId];
    if (ref && ref.remainText) {
      ref.remainText.textContent = "剩余 " + state.armedRemain.toFixed(1) + " 秒";
      const step = STEPS.filter(function (s) { return s.id === state.armedStepId; })[0];
      if (step && ref.remainBar) {
        ref.remainBar.style.width = (state.armedRemain / step.recoverySeconds * 100) + "%";
      }
    }
    if (state.armedRemain <= 0) settleArmed();
  }
}, 100);

resetBtn.addEventListener("click", openResetModal);

/* 启动：初始数据内联，脚本执行完毕即完成首屏渲染（就绪态） */
resetCoreState();
buildAll();

/* ========== 演示钩子：?demo=… 驱动与真实交互完全相同的代码路径，
   供截图取证与验收测量使用；正常使用不受影响。 ========== */
function demoHook() {
  const mode = new URLSearchParams(location.search).get("demo");
  if (!mode) return;
  const byId = function (id) { return STEPS.filter(function (s) { return s.id === id; })[0]; };
  if (mode === "confirm") {
    openConfirmModal(byId("s6"));
  } else if (mode === "armed") {
    executeIrreversible(byId("s6"));
  } else if (mode === "intercept") {
    intercept(byId("s4"), "顺序守卫：需先完成「" + byId("s1").title + "」");
  } else if (mode === "done") {
    STEPS.forEach(function (st) {
      if (st.kind === "check") {
        state.checked[st.id] = {};
        st.checks.forEach(function (_t, i) { state.checked[st.id][i] = true; });
        if (st.observe) state.observed[st.id] = true;
      }
      if (st.kind === "irreversible") {
        state.confirmCount++;
        state.status[st.id] = "done";
        audit("confirm", "确认执行：" + st.title + "（变更单 " + FLOW.ticket + "）");
        audit("done", st.settleText);
      } else {
        state.status[st.id] = "done";
        audit("done", "完成：" + st.title);
      }
    });
    refreshOrderStatuses();
    renderAll();
    if (state.finished) finishFlow();
  }
}
demoHook();

})();
