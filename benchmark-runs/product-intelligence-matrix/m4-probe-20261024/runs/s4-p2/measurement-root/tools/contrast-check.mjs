// AA contrast receipt — computes WCAG 2.1 relative-luminance contrast ratios
// for the exact token pairs used in styles.css. Run: node tools/contrast-check.mjs
const pairs = [
  ["body text --ink on panel", "#0f172a", "#ffffff"],
  ["secondary --ink-2 on panel", "#334155", "#ffffff"],
  ["muted --ink-3 on panel (min tier)", "#475569", "#ffffff"],
  ["muted --ink-3 on page bg", "#475569", "#eef2f7"],
  ["accent text on panel", "#1d4ed8", "#ffffff"],
  ["accent text on accent-soft", "#1d4ed8", "#eff4ff"],
  ["danger on panel", "#b91c1c", "#ffffff"],
  ["white on accent (btn-accent)", "#ffffff", "#1d4ed8"],
  ["chip text --ink-2 on panel", "#334155", "#ffffff"],
  ["count accent on accent-soft", "#1d4ed8", "#eff4ff"],
  ["tooltip text on ink bg", "#f8fafc", "#0f172a"],
  ["kind-projection text on chip bg", "#1e40af", "#e3ecfe"],
  ["kind-filter text on chip bg", "#065f46", "#e7f6ef"],
  ["kind-selection text on chip bg", "#9d174d", "#fdeef3"],
  ["insp muted --ink-3 on panel", "#475569", "#ffffff"],
  ["disabled btn text on panel", "#64748b", "#ffffff"],
];
function lum(hex) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    let v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
let allPass = true;
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  const pass = r >= 4.5;
  if (!pass) allPass = false;
  console.log(`${pass ? "PASS" : "FAIL"}  ${r.toFixed(2)}:1  ${name}`);
}
console.log(allPass ? "\nAll pairs meet WCAG 2.2 AA (>=4.5:1) for their size class." : "\nSome pairs FAIL.");
process.exit(allPass ? 0 : 1);
