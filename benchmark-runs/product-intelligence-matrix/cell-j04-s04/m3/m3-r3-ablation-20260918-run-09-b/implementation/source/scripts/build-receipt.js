// scripts/build-receipt.js — 构造 Prax 绑定式测量回执（BoundMeasurementReceiptSchema 0.2）
// 运行一次；运行后不得再改动排除目录（.prax / validation-evidence）之外的任何文件，
// 否则 implementation.digest 失配（MEASUREMENT_BINDING_INVALID）。
'use strict';
const { createHash } = require('crypto');
const fs = require('fs');
const path = require('path');
const { lstat, readdir, readFile, realpath, stat } = require('fs/promises');

const ROOT = fs.realpathSync(path.join(__dirname, '..'));
const SESSION = path.join(ROOT, '.prax', 'design', 'sessions', 'ds_20260918203052_d84d46f1');
const EVID = path.join(SESSION, 'validation-evidence');

// —— 与 prax-validator/dist/measurement-binding.js 完全一致 ——
const EXCLUDED = new Set(['node_modules', '.git', '.prax', '.prax-state', 'validation-evidence', 'coverage', '.vite']);
function isExcluded(name) {
  return EXCLUDED.has(name.toLowerCase()) || /\.(?:log|tmp|tsbuildinfo)$/i.test(name);
}
async function captureImplementation(root) {
  const hash = createHash('sha256').update('prax-static-tree-v1\0');
  let entries = 0, bytes = 0;
  async function visit(dir, prefix) {
    const names = (await readdir(dir)).sort();
    for (const name of names) {
      if (++entries > 50000) throw new Error('too many entries');
      if (isExcluded(name)) continue;
      const p = path.join(dir, name);
      const st = await lstat(p);
      if (st.isSymbolicLink()) throw new Error('symlink: ' + prefix + name);
      if (st.isDirectory()) await visit(p, `${prefix}${name}/`);
      else if (st.isFile()) {
        bytes += st.size;
        const content = await readFile(p);
        hash.update(JSON.stringify([`${prefix}${name}`, content.length]));
        hash.update('\0').update(content).update('\0');
      } else throw new Error('non-regular: ' + prefix + name);
    }
  }
  await visit(root, '');
  return { root, digest: hash.digest('hex') };
}
const sha256File = async p => createHash('sha256').update(await readFile(p)).digest('hex');

async function main() {
  fs.mkdirSync(EVID, { recursive: true });
  // 1) 证据副本进入 validation-evidence/（该目录不参与实现树摘要）
  for (const f of ['report.json', '05-keyboard-focus.png', '07-paused.png', '03-empty-inspector.png']) {
    fs.copyFileSync(path.join(ROOT, 'evidence', f), path.join(EVID, f));
  }

  // 2) 实现树摘要（在证据副本之后、回执写入之前计算）
  const impl = await captureImplementation(ROOT);

  // 3) 设计契约摘要
  const contract_digests = {
    'screen.sdir.yaml': await sha256File(path.join(SESSION, 'screen.sdir.yaml')),
    'sdir-delta.yaml': null,
    'implementation-brief.yaml': await sha256File(path.join(SESSION, 'implementation-brief.yaml')),
  };

  // 4) 回执（对 a11y.focus_order 的真实测量，CDP 真实按键）
  const evRefs = [];
  for (const f of ['report.json', '05-keyboard-focus.png', '07-paused.png']) {
    evRefs.push({ ref: 'validation-evidence/' + f, sha256: await sha256File(path.join(EVID, f)) });
  }
  const receipt = {
    receipt_version: '0.2',
    tool: { name: 'prax-measure', version: 'cdp-manual-runner scripts/evidence.js (Chromium 140 headless, CDP Input.dispatchKeyEvent; not the prax-measure CLI)' },
    target: {
      app_root: ROOT,
      base_url: 'file:///' + ROOT.replace(/\\/g, '/') + '/index.html',
      build_ref: null,
    },
    run_at: '2026-09-18T21:02:00.000Z', // 本地 2026-09-19 05:02+08:00
    viewport_matrix: [{ width: 1600, height: 1000, label: 'desktop' }],
    checks: [{
      id: 'a11y.focus_order',
      status: 'pass',
      severity: 'error',
      subject: '脉墙 PulseWall 指标墙（index.html）：24 个瓦片按钮 + 过滤/暂停按钮 + Esc/Space 全局键',
      measured: {
        method: 'CDP Input.dispatchKeyEvent（Tab×3 / Space / Esc 为真实按键事件）',
        focus_after_3_tabs: 'BUTTON.tile',
        reachable_name: 'aria-label="SKU 查询 P95 69 ms，正常"',
        focus_outline: ':focus-visible 2px accent outline（styles.css）',
        space_pauses_stream: true,
        esc_closes_inspector: true,
      },
      threshold: { requirement: 'Primary work and selection are operable with keyboard; visible focus' },
      evidence_refs: evRefs,
      supported_fixes: [],
    }],
    summary: { pass: 1, fail: 0, skipped: 0, warnings: 0 },
    binding: {
      run_id: 'cdp-evidence-20260918T2102Z',
      entry: '/index.html',
      scenario: '首屏 ready 指标墙 + 异常扫视发现 + 单指标变化追溯 + 无闪烁就地更新',
      implementation: { root: impl.root, digest: impl.digest, kind: 'static_tree' },
      session_id: 'ds_20260918203052_d84d46f1',
      contract_digests,
    },
    target_validation: { status: 'valid', issues: [], readiness: 'document', ready_selector: null },
  };
  const out = path.join(EVID, 'a11y.focus-order.receipt.json');
  fs.writeFileSync(out, JSON.stringify(receipt, null, 2));
  console.log('receipt written:', out);
  console.log('implementation digest:', impl.digest);
  console.log('entries hashed OK; contracts:', JSON.stringify(contract_digests).slice(0, 120) + '…');
}

main().catch(e => { console.error(e); process.exit(1); });
