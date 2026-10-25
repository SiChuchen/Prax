// One-off build script: emits the static data.js payload shipped with the app.
// Deterministic (mulberry32, seed 20260902) so the dataset is reproducible.
// Run: node scripts/gen-data.js
'use strict';
const fs = require('fs');
const path = require('path');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260902);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + rnd() * (hi - lo);
const r1 = (x) => Math.round(x * 10) / 10;

const REGIONS = ['north', 'south', 'east', 'west'];
const MODELS = ['AX-2', 'AX-3', 'BX-1', 'CX-9', 'DX-4'];
const STATUSES = ['ok', 'degraded', 'fail'];

const N = 720;
const records = [];
for (let i = 0; i < N; i++) {
  const region = pick(REGIONS);
  const model = pick(MODELS);
  const health = rnd(); // status correlates with battery & signal below
  const status = health < 0.68 ? 'ok' : health < 0.9 ? 'degraded' : 'fail';

  const regionBase = { north: 8, south: 31, east: 24, west: 17 }[region];
  const temp_c = r1(regionBase + between(-6, 6) + (status === 'fail' ? 6 : 0));
  const humidity_pct = Math.round(Math.min(96, Math.max(12, 78 - temp_c * 1.1 + between(-8, 8))));
  const battery_pct = Math.round(
    status === 'fail' ? between(2, 22) : status === 'degraded' ? between(15, 55) : between(35, 100)
  );
  const signal_dbm = r1(
    status === 'fail' ? between(-96, -78) : status === 'degraded' ? between(-84, -62) : between(-70, -44)
  );
  const uptime_days = Math.round(between(0, 400) * (battery_pct / 100));
  const co2_ppm = Math.round(
    model.startsWith('AX') ? between(380, 620) : model.startsWith('BX') ? between(420, 760) : between(520, 980)
  );

  records.push({
    id: 'S-' + String(i + 1).padStart(4, '0'),
    region, model, status,
    temp_c, humidity_pct, battery_pct, signal_dbm, uptime_days, co2_ppm,
  });
}

const dataset = {
  name: 'Fleet telemetry — sensor grid A',
  seed: 20260902,
  count: records.length,
  dimensions: [
    { id: 'region', label: 'Region', type: 'categorical', values: REGIONS },
    { id: 'model', label: 'Model', type: 'categorical', values: MODELS },
    { id: 'status', label: 'Status', type: 'categorical', values: STATUSES },
    { id: 'temp_c', label: 'Temperature', type: 'numeric', unit: '°C', dp: 1 },
    { id: 'humidity_pct', label: 'Humidity', type: 'numeric', unit: '%', dp: 0 },
    { id: 'battery_pct', label: 'Battery', type: 'numeric', unit: '%', dp: 0 },
    { id: 'signal_dbm', label: 'Signal', type: 'numeric', unit: 'dBm', dp: 1 },
    { id: 'uptime_days', label: 'Uptime', type: 'numeric', unit: 'd', dp: 0 },
    { id: 'co2_ppm', label: 'CO₂', type: 'numeric', unit: 'ppm', dp: 0 },
  ],
  records,
};

const out = 'window.DATASET = ' + JSON.stringify(dataset) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'data.js'), out);
console.log('data.js written:', records.length, 'records,', dataset.dimensions.length, 'dimensions');
