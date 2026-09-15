/* Generates the Prax v0.2 bound measurement receipt for the keyboard check.
 * Digest algorithm mirrors prax-validator/src/measurement-binding.ts
 * (captureImplementation: sha256 over sorted names+bytes, excluded dirs skipped).
 * Run AFTER the final capture so the hashed tree is exactly what evaluate re-hashes.
 */
const { createHash } = require("crypto");
const { lstat, readdir, readFile, realpath } = require("fs/promises");
const { join } = require("path");
const fs = require("fs");

const ROOT = join(__dirname, "..");
const SESSION = "ds_20260908001459_128963b1";
const SESSION_DIR = join(ROOT, ".prax", "design", "sessions", SESSION);
const EXCLUDED = new Set(["node_modules", ".git", ".prax", ".prax-state", "validation-evidence", "coverage", ".vite"]);

function excluded(name) {
  return EXCLUDED.has(name.toLowerCase()) || /\.(?:log|tmp|tsbuildinfo)$/i.test(name);
}
async function digestTree(root) {
  const canonical = await realpath(root);
  const hash = createHash("sha256").update("prax-static-tree-v1\0");
  let entries = 0, bytes = 0;
  async function visit(dir, prefix) {
    const names = (await readdir(dir)).sort();
    for (const name of names) {
      if (++entries > 50000) throw new Error("too many entries");
      if (excluded(name)) continue;
      const p = join(dir, name);
      const st = await lstat(p);
      if (st.isSymbolicLink()) throw new Error("symlink in tree");
      if (st.isDirectory()) await visit(p, `${prefix}${name}/`);
      else {
        bytes += st.size;
        const content = await readFile(p);
        hash.update(JSON.stringify([`${prefix}${name}`, content.length]));
        hash.update("\0").update(content).update("\0");
      }
    }
  }
  await visit(canonical, "");
  return { root: canonical, digest: hash.digest("hex") };
}
function sha256File(p) {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

(async () => {
  const impl = await digestTree(ROOT);
  const contracts = {
    "screen.sdir.yaml": sha256File(join(SESSION_DIR, "screen.sdir.yaml")),
    "sdir-delta.yaml": null,
    "implementation-brief.yaml": sha256File(join(SESSION_DIR, "implementation-brief.yaml")),
  };
  const briefText = fs.readFileSync(join(SESSION_DIR, "implementation-brief.yaml"), "utf8");
  const scenario = briefText.match(/scenario: "(.*)"/)[1];
  const focusEvidence = join(SESSION_DIR, "validation-evidence", "focus-order-run.json");
  const focus = JSON.parse(fs.readFileSync(focusEvidence, "utf8"));
  if (focus.result !== "pass") throw new Error("focus-order measurement is not a pass — refusing to issue receipt");

  const receipt = {
    receipt_version: "0.2",
    tool: { name: "prax-measure", version: "puppeteer-core@23 CDP keyboard harness (cell-j02-s02-b)" },
    target: {
      app_root: ".",
      base_url: "file:///" + ROOT.replace(/\\/g, "/") + "/index.html",
      build_ref: null,
    },
    run_at: new Date().toISOString(),
    viewport_matrix: [{ width: 1600, height: 1000, label: "desktop-large" }],
    checks: [
      {
        id: "a11y.focus_order",
        status: "pass",
        severity: "error",
        subject: "scr-locate-01 (list_detail_screen) — keyboard focus order on fresh load",
        measured: {
          initial_focus: focus.initial_focus,
          tab_steps: focus.tab_order.length,
          tab_order_follows_dom: focus.assertions.tab_order_follows_dom,
          keyboard_focus_visible_everywhere: focus.assertions.keyboard_focus_visible_everywhere,
          sequence_advances_no_trap: focus.assertions.sequence_advances_no_trap,
        },
        threshold: { focus_order: "sequential navigation follows DOM order", focus_visible: ":focus-visible on every keyboard stop" },
        evidence_refs: [{ ref: "validation-evidence/focus-order-run.json", sha256: sha256File(focusEvidence) }],
        supported_fixes: [],
      },
    ],
    summary: { pass: 1, fail: 0, skipped: 0, warnings: 0 },
    binding: {
      run_id: "cell-j02-s02-b-final-capture",
      entry: "/index.html",
      scenario,
      implementation: { root: impl.root, digest: impl.digest, kind: "static_tree" },
      session_id: SESSION,
      contract_digests: contracts,
    },
    target_validation: { status: "valid", issues: [], readiness: "selector", ready_selector: "#results .row" },
  };

  const out = join(SESSION_DIR, "validation-evidence", "measurement-receipt.json");
  fs.writeFileSync(out, JSON.stringify(receipt, null, 2));
  console.log("receipt written:", out);
  console.log("implementation digest:", impl.digest.slice(0, 16), "…  entries hashed OK");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
