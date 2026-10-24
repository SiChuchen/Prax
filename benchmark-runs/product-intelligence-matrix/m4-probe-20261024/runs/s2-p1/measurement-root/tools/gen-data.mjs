// 生成 cell-j13-s10 的内联数据集：480 行 × 10 维，确定性种子。
// 输出 js/data.js：const ROWS = [...]（浏览器经典 <script> 直接加载，无网络请求）。
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// mulberry32 确定性 PRNG（种子 20260902 = 冻结日期）
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260902);
const [lo, hi] = [[0.05, 1], [0.95, 1]]; // unused guard
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const rrange = (a, b) => a + rnd() * (b - a);
// 近似对数正态：乘性抖动
const logn = (base, spread) => base * Math.exp(rnd() * spread - spread / 2);

const CLASSES = ["岩质", "超级地球", "类海王星", "气态巨行星"];
const ATMOS = ["无大气", "稀薄", "浓密", "富氢"];
const DETECT = ["凌星法", "视向速度", "直接成像", "微引力透镜"];

const rows = [];
for (let i = 0; i < 480; i++) {
  const cls = pick(CLASSES);
  // 类别 → 质量分布（M⊕）
  const massBase = { "岩质": 1.2, "超级地球": 6, "类海王星": 22, "气态巨行星": 320 }[cls];
  const mass = +(logn(massBase, 2.4)).toFixed(2);
  // 半径与质量相关（R⊕）
  const radiusBase = { "岩质": 1.0, "超级地球": 1.8, "类海王星": 3.6, "气态巨行星": 11 }[cls];
  const radius = +(logn(radiusBase, 0.7)).toFixed(2);
  // 距离（光年）
  const distance = Math.round(rrange(11, 3200));
  // 平衡温度与距离负相关 + 大气调节（K）：~6000/√d，40–2200K
  const atm = pick(ATMOS);
  const atmBoost = { "无大气": 0.85, "稀薄": 1.0, "浓密": 1.45, "富氢": 1.25 }[atm];
  const temp = Math.round(Math.min(2200, Math.max(40, 6000 / Math.sqrt(distance) * atmBoost * logn(1, 0.35))));
  // 轨道周期（天）与温度相关
  const period = +(Math.max(0.6, Math.pow(temp / 288, -1.9) * 365 * logn(1, 0.8))).toFixed(1);
  // 发现方法与距离/半径相关
  let detection;
  const dr = rnd();
  if (radius > 7 && distance < 800 && dr < 0.5) detection = "直接成像";
  else if (dr < 0.55) detection = "凌星法";
  else if (dr < 0.85) detection = "视向速度";
  else detection = "微引力透镜";
  // 液态水：温度适宜 + 有大气
  const water = temp > 240 && temp < 340 && atm !== "无大气" && rnd() < 0.72;
  // 适生指数 0–100（序数量表）
  let habit = 0;
  if (water) habit += 38;
  habit += Math.max(0, 34 - Math.abs(temp - 288) / 4);
  habit += radius < 2.2 ? 18 : radius < 4 ? 7 : 0;
  habit += atm === "稀薄" ? 10 : atm === "浓密" ? 3 : 0;
  habit = Math.max(0, Math.min(100, Math.round(habit * rrange(0.75, 1.05))));

  rows.push({
    id: i,
    name: "KX-" + (1042 + i * 3),
    cls, mass, radius, temp, period, distance, atm, detection, water: water ? 1 : 0, habit,
  });
}

const js =
  `// cell-j13-s10 内联数据集 — KEPLER-EXT 480 系外行星巡天摘要（合成，确定性种子 20260902）\n` +
  `// 480 行 × 10 维：mass/radius/temp/period/distance/habit(数值) · cls/atm/detection(类别) · water(布尔)\n` +
  `// 由 tools/gen-data.mjs 生成；随首屏内联就绪，无网络请求。\n` +
  `const ROWS = ` + JSON.stringify(rows) + `;\n`;

writeFileSync(join(root, "js", "data.js"), js);
console.log("rows:", rows.length, "bytes:", js.length);
