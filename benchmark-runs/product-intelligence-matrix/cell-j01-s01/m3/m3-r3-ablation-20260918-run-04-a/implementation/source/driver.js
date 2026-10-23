/* 证据驱动脚本：仅被 evidence.html 引用，交付主页面 index.html 不含此文件。
   通过 URL hash 选择场景（#s2…#s7），用真实 DOM 事件驱动界面，供无头浏览器截图。
   页面左下角徽标显示场景名与 JS 错误计数。 */
(function () {
  const errs = [];
  window.addEventListener('error', function (e) { errs.push(String(e.message)); });

  const q = function (s) { return document.querySelector(s); };
  const click = function (s) {
    const el = q(s);
    if (!el) { errs.push('selector not found: ' + s); return; }
    el.click();
  };
  const type = function (s, val) {
    const el = q(s);
    if (!el) { errs.push('selector not found: ' + s); return; }
    el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const SCENARIOS = {
    // s2：勾选两个系统节点 → 批量条显式明细（设备/组织节点分开计）
    s2: [
      function () { click('.tn[data-id="n2"] input[data-act="check"]'); },
      function () { click('.tn[data-id="n34"] input[data-act="check"]'); }
    ],
    // s3：批量改状态确认弹窗（逐台枚举 旧→新 + 范围核对）
    s3: [
      function () { click('.tn[data-id="n2"] input[data-act="check"]'); },
      function () { click('#btn-status'); },
      function () { click('#dd-status [data-status="maintenance"]'); }
    ],
    // s4：执行改状态 → toast、操作记录抽屉、行状态更新
    s4: [
      function () { click('.tn[data-id="n2"] input[data-act="check"]'); },
      function () { click('#btn-status'); },
      function () { click('#dd-status [data-status="maintenance"]'); },
      function () { click('#m-ok'); },
      function () { click('#btn-log'); }
    ],
    // s5：搜索过滤 + 全选可见（仅作用于筛选结果）
    s5: [
      function () { type('#inp-search', '空调'); },
      function () { click('#btn-selectvisible'); },
      function () { click('#btn-status'); },
      function () { click('#dd-status [data-status="stopped"]'); }
    ],
    // s6：改状态后一键撤销 → 状态精确回滚
    s6: [
      function () { click('.tn[data-id="n2"] input[data-act="check"]'); },
      function () { click('#btn-status'); },
      function () { click('#dd-status [data-status="scrapping"]'); },
      function () { click('#m-ok'); },
      function () { click('#op-list [data-undo]'); },
      function () { click('#btn-log'); }
    ],
    // s7：子树范围聚焦 + 全选可见 + 删除确认（组织节点保护说明）
    s7: [
      function () { click('.tn[data-id="n61"] .tn-name'); },
      function () { click('#btn-selectvisible'); },
      function () { click('#btn-delete'); }
    ]
  };

  const name = (location.hash.match(/s\d+/) || [])[0];
  const steps = SCENARIOS[name] || [];
  let i = 0;
  (function next() {
    if (i < steps.length) { steps[i++](); setTimeout(next, 260); return; }
    const badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;font:11px monospace;padding:2px 8px;border-radius:4px;background:' +
      (errs.length ? '#d33131' : '#17994f') + ';color:#fff';
    badge.textContent = 'evidence:' + (name || 'none') + ' · JS errors: ' + errs.length +
      (errs.length ? ' | ' + errs.join(' ; ') : '');
    document.body.appendChild(badge);
  })();
})();
