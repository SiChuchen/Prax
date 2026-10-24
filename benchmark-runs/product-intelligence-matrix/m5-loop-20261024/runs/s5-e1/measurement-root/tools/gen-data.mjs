// Seeded generator for the ExoLens snapshot dataset (deterministic).
// NOTE: index.html embeds its own identical copy of this generator (this app ships
// as a single static file with no build step). This script exists for provenance:
// run it to reproduce src/data.json and verify the snapshot is byte-stable.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// mulberry32 — deterministic PRNG
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260902);
const R = () => rnd();
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const rf = (lo, hi) => lo + rnd() * (hi - lo);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const round4 = (v) => Math.round(v * 10000) / 10000;

const METHODS = ['凌星法', '视向速度法', '凌星时间变幅法', '微引力透镜法', '直接成像法', '天体测量法'];
const METHOD_W = [0.44, 0.24, 0.08, 0.06, 0.10, 0.08];
const STARS = ['M型', 'K型', 'G型', 'F型', 'A型'];
const STAR_W = [0.40, 0.22, 0.21, 0.12, 0.05];
const MISSIONS = [
  { name: 'Kepler', years: [2009, 2013], inst: ['Kepler 光度计'], dist: [200, 1600] },
  { name: 'K2', years: [2014, 2018], inst: ['K2 光度计'], dist: [40, 900] },
  { name: 'TESS', years: [2018, 2025], inst: ['TESS 光度计'], dist: [20, 640] },
  { name: 'CoRoT', years: [2007, 2012], inst: ['CoRoT 光度计'], dist: [150, 1200] },
  { name: '地基巡天', years: [2004, 2025], inst: ['HARPS 光谱仪', 'NRES 光谱仪', 'WFCAM 测光'], dist: [10, 2600] },
];
const MISSION_W = [0.34, 0.12, 0.28, 0.05, 0.21];
const CLASSES = ['类地', '超级地球', '海王星级', '木星级'];
const SUFFIX = ['b', 'c', 'd', 'e', 'f', 'g'];

function pickW(values, weights) {
  let x = rnd(), acc = 0;
  for (let i = 0; i < values.length; i++) { acc += weights[i]; if (x < acc) return values[i]; }
  return values[values.length - 1];
}

// Star-name pool per mission so multi-planet systems share a host.
const usedStars = new Set();
function makeStar(mission) {
  for (let tries = 0; tries < 200; tries++) {
    let name;
    if (mission === 'Kepler') name = 'Kepler-' + ri(4, 1900);
    else if (mission === 'K2') name = 'K2-' + ri(1, 400);
    else if (mission === 'TESS') name = 'TOI-' + ri(2, 860);
    else if (mission === 'CoRoT') name = 'CoRoT-' + ri(1, 36);
    else name = (R() < 0.5 ? 'HD ' + ri(2000, 220000) : 'GJ ' + ri(1, 1210));
    if (!usedStars.has(name)) { usedStars.add(name); return name; }
  }
  return mission + '-' + ri(10000, 99999);
}

function starTemp(type) { // K
  return { 'M型': rf(2500, 3800), 'K型': rf(3900, 5200), 'G型': rf(5300, 5900), 'F型': rf(6000, 7200), 'A型': rf(7500, 9800) }[type];
}

const records = [];
let id = 0;
const N = 480;

while (records.length < N) {
  const mission = pickW(MISSIONS, MISSION_W);
  const host = makeStar(mission.name);
  const nPlanets = R() < 0.30 ? ri(2, 3) : 1;
  const starType = pickW(STARS, STAR_W);
  const tStar = starTemp(starType);
  const metal = round2(Math.max(-0.62, Math.min(0.55, rf(-0.32, 0.26) + (rnd() < 0.18 ? rf(0.08, 0.3) : 0))));
  const year = ri(mission.years[0], mission.years[1]);

  for (let p = 0; p < nPlanets && records.length < N; p++) {
    const pclass = pickW(CLASSES, [0.30, 0.22, 0.27, 0.21]);
    // radius by class (Earth radii)
    let radius = {
      '类地': rf(0.42, 1.55), '超级地球': rf(1.55, 3.1),
      '海王星级': rf(3.1, 6.9), '木星级': Math.exp(rf(Math.log(6.9), Math.log(15.5))),
    }[pclass];
    // period: log-uniform, hot-Jupiter style correlation for giants
    let logp = rf(Math.log(0.8), Math.log(3200));
    if (pclass === '木星级' && R() < 0.35) logp = rf(Math.log(1.2), Math.log(30));
    if (pclass === '类地') logp = Math.max(logp, rf(Math.log(1.5), Math.log(8)));
    const period = round1(Math.exp(logp));
    // equilibrium temperature: stellar flux ~ T*/sqrt(a); a from Kepler-ish scaling
    const aAU = round2(Math.cbrt((period / 365) * (period / 365) * (0.8 + tStar / 5800 * 0.4)));
    let tempK = Math.round(tStar * Math.sqrt(0.9 / Math.max(aAU, 0.011)) * rf(0.88, 1.12));
    tempK = Math.max(28, Math.min(2600, tempK));
    // mass from radius with density scatter (Earth masses)
    const dens = pclass === '木星级' ? rf(0.18, 1.5) : rf(0.5, 1.6);
    let mass = dens * Math.pow(radius, 3);
    mass = Math.max(0.06, Math.round4(mass * 1.0));
    // eccentricity: tides circularize close orbits
    let ecc = round2(Math.min(0.92, Math.abs(rnd() * rnd() * 0.85) * (period < 12 ? 0.25 : 1)));
    // distance per mission band, weighted down for nearby M dwarfs
    let distLy = Math.round(rf(mission.dist[0], mission.dist[1]) * (starType === 'M型' ? 0.45 : 1));
    // detection method: transit missions dominated by 凌星; ground split RV/transit
    let method;
    if (mission.name === '地基巡天') method = pickW(METHODS, [0.34, 0.44, 0.04, 0.06, 0.08, 0.04]);
    else method = pickW(METHODS, METHOD_W);

    records.push({
      i: id++,
      n: host + ' ' + SUFFIX[p],
      ms: mission.name,
      yr: year,
      me: method,
      ty: starType,
      pc: pclass,
      r: round2(radius),
      p: period,
      t: tempK,
      m: mass,
      d: distLy,
      f: metal,
      e: ecc,
    });
  }
}

const payload = { generated: '2026-10-25', seed: 20260902, count: records.length, records };
writeFileSync(join(root, 'src', 'data.json'), JSON.stringify(payload, null, 1), 'utf8');
console.log('records:', records.length);
console.log('sample:', JSON.stringify(records.slice(0, 3), null, 1));
