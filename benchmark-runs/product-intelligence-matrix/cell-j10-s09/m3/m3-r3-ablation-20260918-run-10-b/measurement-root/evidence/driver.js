/* 证据自动驾驶：按 ?stage=N 驱动应用走到目标状态后停住。
   无 ?stage 参数时不做任何事（= 首屏原始状态）。
   全部动作同步执行（click 触发的渲染同步完成），不注入应用内部状态。 */
(function () {
  "use strict";

  var q = new URLSearchParams(location.search);
  if (!q.has("stage")) { document.title = "EVIDENCE-A-firstscreen"; return; }
  var stage = Number(q.get("stage"));

  try { sessionStorage.clear(); } catch (e) {}

  function need(sel) {
    var el = document.querySelector(sel);
    if (!el) throw new Error("driver: missing " + sel);
    return el;
  }
  function all(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }
  function seqNow() {
    var el = document.querySelector(".jstep.is-current");
    return el ? Number(el.getAttribute("data-step").slice(1)) : 99;
  }
  function modalOpen() { return !need("#modal").hidden; }
  function checkAllChecks() {
    all("#focusCol .check-row input").forEach(function (c) { if (!c.checked) c.click(); });
  }
  // 完成当前步骤（自动识别普通/不可逆）
  function completeCurrent() {
    checkAllChecks();
    need("#btnAction").click();
    if (modalOpen()) { need("#modalAck").click(); need("#modalConfirm").click(); }
  }
  // 顺序推进到 toSeq（含）；deviateAtSeq 在该步骤先制造一次门禁偏差
  function runThrough(toSeq, deviateAtSeq) {
    var deviated = false, guard = 0;
    while (seqNow() <= toSeq && guard++ < 40) {
      if (!deviated && deviateAtSeq && seqNow() === deviateAtSeq) {
        need("#btnAction").click(); // 门禁未过即尝试执行 → 偏差 +1
        deviated = true;
      }
      completeCurrent();
    }
  }

  switch (stage) {
    case 2: // 门前拦截：s4 门禁未过即点击 → 错误块 + 偏差 1 + toast
      runThrough(3, 0);
      need("#btnAction").click();
      document.title = "EVIDENCE-B-gate-error";
      break;
    case 3: // 确认门（可撤销类 s4）
      runThrough(3, 0);
      checkAllChecks();
      need("#btnAction").click();
      document.title = "EVIDENCE-C-confirm-modal";
      break;
    case 4: // 撤销窗口横条
      runThrough(4, 0);
      document.title = "EVIDENCE-D-undo-strip";
      break;
    case 5: // 撤销后回到 s4
      runThrough(4, 0);
      need('[data-undo="s4"]').click();
      document.title = "EVIDENCE-E-after-undo";
      break;
    case 6: // 最终类确认门（s9 抹除数据盘）
      runThrough(8, 0);
      checkAllChecks();
      need("#btnAction").click();
      document.title = "EVIDENCE-F-final-confirm";
      break;
    case 7: // 全程完成（含 1 次门禁偏差）→ 偏差 1 凭证
      runThrough(12, 4);
      document.title = "EVIDENCE-G-certificate-dev1";
      break;
    case 8: // 执行记录抽屉
      runThrough(12, 4);
      need("#btnRecord").click();
      document.title = "EVIDENCE-H-record-drawer";
      break;
    case 9: // 全程零失误 → 零失误达成凭证
      runThrough(12, 0);
      document.title = "EVIDENCE-I-certificate-zero";
      break;
    case 10: // 键盘焦点可见性：程序聚焦旅程图当前步骤按钮
      var cur = document.querySelector(".jstep.is-current");
      if (cur) cur.focus();
      document.title = "EVIDENCE-K-keyboard-focus";
      break;
    case 11: // 抽屉空态：未执行任何步骤即打开执行记录
      need("#btnRecord").click();
      document.title = "EVIDENCE-L-empty-drawer";
      break;
    default:
      document.title = "EVIDENCE-unknown-stage";
  }
})();
