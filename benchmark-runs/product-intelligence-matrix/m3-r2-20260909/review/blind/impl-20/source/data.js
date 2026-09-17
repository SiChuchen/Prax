/* AURORA Exoplanet Catalog — synthetic dataset, deterministically generated (seed 42).
   Inlined at load: no fetch, no loading state. Exposed as window.CATALOG. */
(function () {
  'use strict';

  // mulberry32 — small seeded PRNG so the catalog is identical on every load.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rand = mulberry32(42);
  function gauss(mu, sigma) {
    var u = 1 - rand(), v = rand();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function pickWeighted(pairs) {
    var r = rand(), acc = 0;
    for (var i = 0; i < pairs.length; i++) { acc += pairs[i][1]; if (r <= acc) return pairs[i][0]; }
    return pairs[pairs.length - 1][0];
  }
  function round(v, n) { var m = Math.pow(10, n); return Math.round(v * m) / m; }

  var STAR_MASS = { M: [0.30, 0.12], K: [0.70, 0.14], G: [1.00, 0.14], F: [1.28, 0.18], A: [1.85, 0.30] };

  var N = 1204;
  var records = [];
  for (var i = 0; i < N; i++) {
    var starClass = pickWeighted([['M', 0.50], ['K', 0.20], ['G', 0.17], ['F', 0.09], ['A', 0.04]]);
    var sm = STAR_MASS[starClass];
    var starMass = round(clamp(gauss(sm[0], sm[1]), 0.08, 2.6), 2);

    var radius = round(clamp(Math.exp(gauss(0.9, 0.8)), 0.3, 45), 2);          // Earth radii
    var mass = round(clamp(Math.pow(radius, 1.3) * Math.exp(gauss(0, 0.5)), 0.05, 5200), 2); // Earth masses
    var period = round(clamp(Math.exp(gauss(2.2, 1.5)), 0.5, 3200), 2);        // days
    var temp = Math.round(clamp(250 + 1200 * Math.pow(period, -0.5) * Math.exp(gauss(0, 0.35)), 20, 3000)); // K
    var distance = Math.round(clamp(Math.exp(gauss(4.2, 1.1)), 4, 12000));     // light years
    var habit = round(1 / (1 + Math.exp(-(0.9 * (1 - Math.abs(Math.log(radius / 1.2)) * 0.8 - Math.abs(Math.log(clamp(temp, 1, 1e9) / 288)) * 0.9 + gauss(0, 0.4))))), 3);
    var method = pickWeighted([['Transit', 0.55], ['Radial Velocity', 0.22], ['Microlensing', 0.08], ['Imaging', 0.06], ['Astrometry', 0.05], ['Eclipse Timing', 0.04]]);
    var year = 2009 + Math.floor(Math.pow(rand(), 0.7) * 17);                  // 2009–2025

    records.push({
      id: 'AUR-' + (1000 + i),
      method: method,
      star_class: starClass,
      star_mass: starMass,
      radius: radius,
      mass: mass,
      period: period,
      temp: temp,
      distance: distance,
      habit: habit,
      year: year
    });
  }

  // Dimension metadata: the swappable lenses of the explorer.
  window.CATALOG = {
    name: 'AURORA Exoplanet Catalog',
    records: records,
    dimensions: [
      { id: 'radius',    label: 'Planet Radius',      type: 'q', unit: 'R⊕',   fmt: 2 },
      { id: 'period',    label: 'Orbital Period',     type: 'q', unit: 'days', fmt: 2 },
      { id: 'mass',      label: 'Planet Mass',        type: 'q', unit: 'M⊕',   fmt: 2 },
      { id: 'temp',      label: 'Equil. Temperature', type: 'q', unit: 'K',    fmt: 0 },
      { id: 'distance',  label: 'Distance',           type: 'q', unit: 'ly',   fmt: 0 },
      { id: 'star_mass', label: 'Stellar Mass',       type: 'q', unit: 'M☉',   fmt: 2 },
      { id: 'habit',     label: 'Habitability Index', type: 'q', unit: '',     fmt: 3 },
      { id: 'year',      label: 'Discovery Year',     type: 'q', unit: '',     fmt: 0 },
      { id: 'method',    label: 'Discovery Method',   type: 'c',
        cats: ['Transit', 'Radial Velocity', 'Microlensing', 'Imaging', 'Astrometry', 'Eclipse Timing'] },
      { id: 'star_class', label: 'Stellar Class',     type: 'c', cats: ['M', 'K', 'G', 'F', 'A'] }
    ]
  };
})();
