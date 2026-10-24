// Runs prax-measure against this deliverable and writes a canonical receipt
// into the session's validation-evidence/ directory.
import { runMeasurement } from "file:///E:/codex-prj/pi-m3-frozen-runtime-r3-20260918/packages/prax-measure/dist/index.js";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(join(fileURLToPath(import.meta.url), "..", ".."));
const SESSION = "ds_20261023220203_d3a93e5c";

const result = await runMeasurement({
  appDir: ROOT,
  // prax-measure 以会话目录为 outDir：内部追加 validation-evidence/ 存放回执，
  // 并从该目录捕获 screen.sdir.yaml 等契约摘要写入回执 binding
  outDir: join(ROOT, ".prax", "design", "sessions", SESSION),
  viewports: [
    { width: 1680, height: 1050, label: "desktop-large" },
    { width: 1280, height: 860, label: "desktop" },
  ],
  entry: "/index.html",
  sessionId: SESSION,
  scenario: "cell-j13-s10 explore×dimensional-space: switch projection dimensions and filters repeatedly, verifying state attribution and one-step revert; static open from index.html with inline dataset ready at first paint",
  readySelector: "#plot",
  readyTimeoutMs: 15000,
});
console.log(String(result));
