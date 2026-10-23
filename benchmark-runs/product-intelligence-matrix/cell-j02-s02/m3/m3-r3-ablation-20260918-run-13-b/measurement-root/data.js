/* PartAtlas — inlined catalog snapshot.
 *
 * The catalog is generated deterministically (seeded PRNG) at script-evaluation
 * time, i.e. synchronously BEFORE first paint: data.js executes before app.js,
 * both are classic scripts, so the full collection is present in memory the
 * moment the screen becomes visible. There is no fetch, no async, no loading
 * state. Snapshot label reflects the frozen-brief date, 2026-09-24.
 */
(function () {
  'use strict';

  /* ── seeded PRNG (mulberry32) ─────────────────────────────────────────── */
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(20260902);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));

  /* ── family configuration ─────────────────────────────────────────────── */
  // pkg entry: [package, packageGroup, mount]
  const G_CHIP_S  = 'Chip · 0201–0805';
  const G_CHIP_L  = 'Chip · 1206+';
  const G_SO      = 'Small outline · SOT/SOIC';
  const G_GRID    = 'Grid · QFN/QFP';
  const G_THT     = 'Through-hole · TO/Axial/Radial';
  const G_MODULE  = 'Module';
  const G_CONN    = 'Connector housing';
  const G_SPEC    = 'Specialized';

  const F = [
    // ── Capacitors ──
    { cat: 'cap', fam: 'Ceramic MLCC', n: 120, pre: 'CER', tols: ['±5%','±10%','±20%'],
      volts: ['6.3 V','10 V','16 V','25 V','50 V','100 V'],
      pkgs: [['0402',G_CHIP_S,'SMD'],['0603',G_CHIP_S,'SMD'],['0805',G_CHIP_S,'SMD'],['1206',G_CHIP_L,'SMD']],
      vals: ['10 pF','22 pF','47 pF','100 pF','220 pF','470 pF','1 nF','2.2 nF','4.7 nF','10 nF','22 nF','47 nF','100 nF','220 nF','470 nF','1 µF','2.2 µF','4.7 µF','10 µF','22 µF'],
      desc: (p) => `${pick(['X7R','X5R','C0G'])} dielectric MLCC, ${p.value} ${p.tol} ${p.volt}` },
    { cat: 'cap', fam: 'Aluminum Electrolytic', n: 80, pre: 'ALU', tols: ['±20%'],
      volts: ['6.3 V','10 V','16 V','25 V','35 V','50 V','63 V','100 V','160 V','250 V','450 V'],
      pkgs: [['Radial Ø6.3',G_THT,'Through-Hole'],['Radial Ø8',G_THT,'Through-Hole'],['Radial Ø10',G_THT,'Through-Hole'],['SMD Ø6.3',G_THT,'SMD'],['SMD Ø8',G_THT,'SMD']],
      vals: ['1 µF','2.2 µF','4.7 µF','10 µF','22 µF','47 µF','100 µF','220 µF','470 µF','1000 µF','2200 µF','4700 µF'],
      desc: (p) => `Aluminum electrolytic, ${p.value} ${p.volt}, ${pick(['1000 h','2000 h','5000 h'])} load life` },
    { cat: 'cap', fam: 'Film', n: 70, pre: 'FIL', tols: ['±5%','±10%'],
      volts: ['50 V','100 V','250 V','400 V','630 V'],
      pkgs: [['0805',G_CHIP_S,'SMD'],['1206',G_CHIP_L,'SMD'],['Radial 5 mm',G_THT,'Through-Hole'],['Radial 7.5 mm',G_THT,'Through-Hole'],['Radial 10 mm',G_THT,'Through-Hole']],
      vals: ['1 nF','2.2 nF','4.7 nF','10 nF','22 nF','47 nF','100 nF','220 nF','470 nF','1 µF','2.2 µF','4.7 µF'],
      desc: (p) => `${pick(['PET','PP','PEN'])} film capacitor, ${p.value} ${p.tol} ${p.volt}` },
    { cat: 'cap', fam: 'Tantalum', n: 70, pre: 'TAN', tols: ['±10%','±20%'],
      volts: ['6.3 V','10 V','16 V','25 V','35 V'],
      pkgs: [['Case A 3216',G_CHIP_L,'SMD'],['Case B 3528',G_CHIP_L,'SMD'],['Case C 6032',G_CHIP_L,'SMD'],['Case D 7343',G_CHIP_L,'SMD']],
      vals: ['1 µF','2.2 µF','4.7 µF','10 µF','22 µF','47 µF','100 µF','220 µF'],
      desc: (p) => `Tantalum solid electrolytic, ${p.value} ${p.volt}, ${pick(['10 Ω','8 Ω','6 Ω'])} ESR max` },

    // ── Resistors ──
    { cat: 'res', fam: 'Chip SMD', n: 130, pre: 'CHR', tols: ['±1%','±5%'],
      volts: ['25 V','50 V','75 V','150 V','200 V'],
      pkgs: [['0201',G_CHIP_S,'SMD'],['0402',G_CHIP_S,'SMD'],['0603',G_CHIP_S,'SMD'],['0805',G_CHIP_S,'SMD'],['1206',G_CHIP_L,'SMD']],
      vals: ['10 Ω','12 Ω','15 Ω','22 Ω','33 Ω','47 Ω','68 Ω','100 Ω','150 Ω','220 Ω','330 Ω','470 Ω','680 Ω','1 kΩ','1.5 kΩ','2.2 kΩ','3.3 kΩ','4.7 kΩ','6.8 kΩ','10 kΩ','15 kΩ','22 kΩ','33 kΩ','47 kΩ','68 kΩ','100 kΩ','220 kΩ','470 kΩ','1 MΩ','2.2 MΩ','4.7 MΩ','10 MΩ'],
      desc: (p) => `Thick-film chip resistor, ${p.value} ${p.tol}, ${pick(['1/16 W','1/10 W','1/8 W','1/4 W'])}` },
    { cat: 'res', fam: 'Through-Hole', n: 80, pre: 'RTH', tols: ['±5%','±10%'],
      volts: ['250 V','350 V','500 V'],
      pkgs: [['Axial 1/4 W',G_THT,'Through-Hole'],['Axial 1/2 W',G_THT,'Through-Hole'],['Axial 1 W',G_THT,'Through-Hole'],['Axial 2 W',G_THT,'Through-Hole']],
      vals: ['1 Ω','2.2 Ω','4.7 Ω','10 Ω','22 Ω','47 Ω','100 Ω','220 Ω','470 Ω','1 kΩ','2.2 kΩ','4.7 kΩ','10 kΩ','22 kΩ','47 kΩ','100 kΩ','470 kΩ','1 MΩ','4.7 MΩ','10 MΩ'],
      desc: (p) => `Carbon-film axial resistor, ${p.value} ${p.tol}` },
    { cat: 'res', fam: 'Precision', n: 70, pre: 'PRC', tols: ['±0.1%','±0.5%','±1%'],
      volts: ['25 V','50 V','75 V','150 V','200 V'],
      pkgs: [['0603',G_CHIP_S,'SMD'],['0805',G_CHIP_S,'SMD'],['1206',G_CHIP_L,'SMD'],['MELF',G_SPEC,'SMD']],
      vals: ['100 Ω','470 Ω','1 kΩ','2.5 kΩ','4.99 kΩ','10 kΩ','20 kΩ','49.9 kΩ','100 kΩ','499 kΩ','1 MΩ'],
      desc: (p) => `Thin-film precision resistor, ${p.value} ${p.tol}, ${pick(['15 ppm/°C','25 ppm/°C','50 ppm/°C'])} TCR` },
    { cat: 'res', fam: 'Current Sense', n: 60, pre: 'CSN', tols: ['±0.5%','±1%'],
      volts: ['75 V','100 V','200 V'],
      pkgs: [['1206',G_CHIP_L,'SMD'],['2010',G_CHIP_L,'SMD'],['2512',G_CHIP_L,'SMD'],['3920',G_CHIP_L,'SMD']],
      vals: ['1 mΩ','2 mΩ','3.3 mΩ','4.7 mΩ','6.8 mΩ','10 mΩ','15 mΩ','22 mΩ','33 mΩ','47 mΩ','68 mΩ','100 mΩ'],
      desc: (p) => `Current-sense resistor, ${p.value} ${p.tol}, ${pick(['1 W','2 W','3 W'])}` },

    // ── Inductors & Magnetics ──
    { cat: 'ind', fam: 'Power Inductors', n: 90, pre: 'PWR', tols: ['±20%'],
      volts: ['—'],
      pkgs: [['1212',G_CHIP_L,'SMD'],['4020',G_CHIP_L,'SMD'],['5020',G_CHIP_L,'SMD'],['6045',G_CHIP_L,'SMD'],['7070',G_CHIP_L,'SMD']],
      vals: ['1 µH','2.2 µH','4.7 µH','10 µH','22 µH','33 µH','47 µH','100 µH','220 µH','470 µH'],
      desc: (p) => `Shielded power inductor, ${p.value}, ${pick(['2 A','3.5 A','5 A','8 A','10 A'])} Isat` },
    { cat: 'ind', fam: 'Ferrite Beads', n: 70, pre: 'FBD', tols: ['±25%'],
      volts: ['—'],
      pkgs: [['0402',G_CHIP_S,'SMD'],['0603',G_CHIP_S,'SMD'],['0805',G_CHIP_S,'SMD'],['1206',G_CHIP_L,'SMD']],
      vals: ['120 Ω @ 100 MHz','220 Ω @ 100 MHz','470 Ω @ 100 MHz','600 Ω @ 100 MHz','1 kΩ @ 100 MHz'],
      desc: (p) => `Ferrite bead, ${p.value}, ${pick(['0.3 Ω','0.5 Ω','0.8 Ω'])} DCR max` },
    { cat: 'ind', fam: 'RF Inductors', n: 60, pre: 'RFI', tols: ['±2%','±5%','±10%'],
      volts: ['—'],
      pkgs: [['0402',G_CHIP_S,'SMD'],['0603',G_CHIP_S,'SMD'],['Wire-wound 4×4',G_SPEC,'SMD']],
      vals: ['3.3 nH','4.7 nH','6.8 nH','10 nH','15 nH','22 nH','33 nH','47 nH','68 nH','100 nH'],
      desc: (p) => `High-Q RF inductor, ${p.value}, Q ${pick(['30','40','50'])} @ 100 MHz` },

    // ── Connectors ──
    { cat: 'con', fam: 'Board-to-Board', n: 70, pre: 'B2B', tols: ['—'],
      volts: ['—'],
      pkgs: [['0.35 mm SMD',G_CONN,'SMD'],['0.4 mm SMD',G_CONN,'SMD'],['0.5 mm SMD',G_CONN,'SMD'],['0.8 mm SMD',G_CONN,'SMD'],['1.0 mm SMD',G_CONN,'SMD']],
      vals: ['10 pin','20 pin','30 pin','40 pin','50 pin','60 pin','80 pin','100 pin'],
      desc: (p) => `Mezzanine connector, ${p.value}, ${pick(['stack 4 mm','stack 5 mm','stack 8 mm','coplanar'])}` },
    { cat: 'con', fam: 'Wire-to-Board', n: 90, pre: 'W2B', tols: ['—'],
      volts: ['—'],
      pkgs: [['1.0 mm SMD',G_CONN,'SMD'],['1.25 mm THT',G_CONN,'Through-Hole'],['1.5 mm THT',G_CONN,'Through-Hole'],['2.0 mm THT',G_CONN,'Through-Hole'],['2.54 mm THT',G_CONN,'Through-Hole'],['3.96 mm THT',G_CONN,'Through-Hole']],
      vals: ['2 pin','3 pin','4 pin','5 pin','6 pin','8 pin','10 pin','12 pin'],
      desc: (p) => `Wire-to-board header, ${p.value}, ${pick(['vertical','right-angle'])}, friction lock` },
    { cat: 'con', fam: 'Terminal Blocks', n: 70, pre: 'TBK', tols: ['—'],
      volts: ['300 V','450 V','600 V'],
      pkgs: [['2.54 mm THT',G_CONN,'Through-Hole'],['3.5 mm THT',G_CONN,'Through-Hole'],['3.81 mm THT',G_CONN,'Through-Hole'],['5.0 mm THT',G_CONN,'Through-Hole'],['5.08 mm THT',G_CONN,'Through-Hole']],
      vals: ['2 pole','3 pole','4 pole','6 pole','8 pole','12 pole'],
      desc: (p) => `Terminal block, ${p.value}, ${p.volt}, ${pick(['8 A','12 A','16 A','24 A'])}` },
    { cat: 'con', fam: 'USB & I/O', n: 70, pre: 'USB', tols: ['—'],
      volts: ['—'],
      pkgs: [['SMD shell',G_CONN,'SMD'],['Hybrid SMD+THT',G_CONN,'Through-Hole']],
      vals: ['USB-C 16P','USB-C 24P','USB 2.0 A','USB 2.0 B','Micro-B','USB 3.0 A','RJ45 8P8C','SD card push'],
      desc: (p) => `${p.value.split(' ')[0]} connector, ${pick(['mid-mount','top-mount','right-angle'])}, ${pick(['5 000','10 000','15 000'])} cycles` },

    // ── Semiconductors ──
    { cat: 'semi', fam: 'Microcontrollers', n: 90, pre: 'MCU', tols: ['—'],
      volts: ['1.8 V','3.3 V','5 V'],
      pkgs: [['QFN-32',G_GRID,'SMD'],['LQFP-48',G_GRID,'SMD'],['LQFP-64',G_GRID,'SMD'],['TQFP-100',G_GRID,'SMD'],['WLCSP-36',G_GRID,'SMD']],
      vals: ['8 MHz','16 MHz','24 MHz','48 MHz','72 MHz','120 MHz','168 MHz','480 MHz'],
      desc: (p) => `ARM ${pick(['Cortex-M0+','Cortex-M3','Cortex-M4','Cortex-M7'])} MCU, ${p.value} core, ${pick(['16 KB','32 KB','64 KB','128 KB','256 KB','512 KB','1 MB'])} flash` },
    { cat: 'semi', fam: 'Logic ICs', n: 90, pre: 'LOG', tols: ['—'],
      volts: ['1.65–5.5 V','2–6 V','4.5–5.5 V'],
      pkgs: [['SOIC-14',G_SO,'SMD'],['TSSOP-14',G_SO,'SMD'],['SOIC-16',G_SO,'SMD'],['TSSOP-20',G_SO,'SMD'],['SC-70',G_SO,'SMD'],['SOT-23-5',G_SO,'SMD']],
      vals: ['74HC00','74HC08','74HC32','74HC86','74HC138','74HC245','74HC574','74LVC1G17','74LVC2G14','74AHC74'],
      desc: (p) => `Logic gate / register, ${p.value}, CMOS` },
    { cat: 'semi', fam: 'Op-Amps', n: 80, pre: 'OPA', tols: ['—'],
      volts: ['2.7 V','5 V','±5 V','±15 V','36 V'],
      pkgs: [['SOIC-8',G_SO,'SMD'],['MSOP-8',G_SO,'SMD'],['TSSOP-8',G_SO,'SMD'],['SOT-23-5',G_SO,'SMD'],['SOIC-14',G_SO,'SMD']],
      vals: ['1 MHz GBW','3 MHz GBW','10 MHz GBW','50 MHz GBW','200 MHz GBW'],
      desc: (p) => `${pick(['Single','Dual','Quad'])} op-amp, ${p.value}, ${pick(['rail-to-rail I/O','rail-to-rail out','precision, 25 µV offset','low-noise 5 nV/√Hz'])}` },
    { cat: 'semi', fam: 'Voltage Regulators', n: 100, pre: 'VRE', tols: ['—'],
      volts: ['—'],
      pkgs: [['SOT-23-5',G_SO,'SMD'],['SOT-223',G_SO,'SMD'],['TO-220',G_THT,'Through-Hole'],['DFN-8',G_GRID,'SMD'],['SOIC-8',G_SO,'SMD']],
      vals: ['1.2 V out','1.8 V out','2.5 V out','3.0 V out','3.3 V out','5.0 V out','12 V out','adjustable'],
      desc: (p) => `${pick(['LDO','buck converter','LDO, low-Iq'])} regulator, ${p.value}, ${pick(['150 mA','300 mA','500 mA','1 A','2 A','3 A'])}` },

    // ── Sensors ──
    { cat: 'sen', fam: 'Temperature', n: 60, pre: 'TMP', tols: ['—'],
      volts: ['1.8 V','3.3 V','5 V'],
      pkgs: [['SOT-23-5',G_SO,'SMD'],['TO-92',G_THT,'Through-Hole'],['MSOP-8',G_SO,'SMD'],['DFN-4',G_GRID,'SMD']],
      vals: ['±0.1 °C','±0.25 °C','±0.5 °C','±1.0 °C','±2.0 °C'],
      desc: (p) => `Temperature sensor, accuracy ${p.value}, ${pick(['I²C','SPI','1-Wire','analog out'])}` },
    { cat: 'sen', fam: 'Motion & IMU', n: 50, pre: 'IMU', tols: ['—'],
      volts: ['1.8 V','3.3 V'],
      pkgs: [['LGA-14',G_GRID,'SMD'],['LGA-16',G_GRID,'SMD'],['QFN-24',G_GRID,'SMD']],
      vals: ['±2 g','±4 g','±8 g','±16 g','±125 dps','±250 dps','±1000 dps','±2000 dps','6-axis','9-axis'],
      desc: (p) => `${pick(['Accelerometer','Gyroscope','IMU'])}, range ${p.value}, ${pick(['I²C','SPI','I²C/SPI'])}` },
    { cat: 'sen', fam: 'Optical', n: 50, pre: 'OPT', tols: ['—'],
      volts: ['2.8 V','3.3 V','5 V'],
      pkgs: [['SMD 2×2',G_SPEC,'SMD'],['OLDFN-8',G_GRID,'SMD'],['SMD 3×4',G_SPEC,'SMD'],['Photodiode THT',G_THT,'Through-Hole']],
      vals: ['ambient light','proximity','ToF 2 m','ToF 4 m','color sensor','IR receiver 38 kHz'],
      desc: (p) => `Optical sensor, ${p.value}, ${pick(['I²C','UART','analog'])}` },
    { cat: 'sen', fam: 'Pressure', n: 40, pre: 'PRS', tols: ['—'],
      volts: ['3.3 V','5 V'],
      pkgs: [['LGA-10',G_GRID,'SMD'],['SOP-8',G_SO,'SMD'],['SMD 6×6',G_SPEC,'SMD']],
      vals: ['260–1260 hPa','300–1200 hPa','0–40 kPa diff','0–1.6 MPa','0–10 bar'],
      desc: (p) => `Pressure sensor, range ${p.value}, ${pick(['I²C','SPI','ratiometric analog'])}` },

    // ── Power Management ──
    { cat: 'pwr', fam: 'DC-DC Modules', n: 70, pre: 'DCM', tols: ['—'],
      volts: ['—'],
      pkgs: [['LGA module',G_MODULE,'SMD'],['BGA module',G_MODULE,'SMD'],['QFN module',G_MODULE,'SMD'],['Open-frame ½in',G_MODULE,'Through-Hole']],
      vals: ['0.5 A out','1 A out','2 A out','3 A out','5 A out','10 A out'],
      desc: (p) => `DC-DC module, ${p.value}, in ${pick(['4.5–18 V','8–36 V','18–72 V'])}` },
    { cat: 'pwr', fam: 'Battery Management', n: 50, pre: 'BMS', tols: ['—'],
      volts: ['—'],
      pkgs: [['TSSOP-16',G_SO,'SMD'],['QFN-24',G_GRID,'SMD'],['SOIC-8',G_SO,'SMD'],['SSOP-28',G_SO,'SMD']],
      vals: ['1S','2S','3S','4S','6S','8S','12S'],
      desc: (p) => `Battery management IC, ${p.value} pack, ${pick(['charger','protection','fuel gauge','charger + gauge'])}` },
    { cat: 'pwr', fam: 'AC-DC Converters', n: 60, pre: 'ACD', tols: ['—'],
      volts: ['—'],
      pkgs: [['Encapsulated PCB',G_MODULE,'Through-Hole'],['Open frame',G_MODULE,'Through-Hole'],['DIN-rail',G_MODULE,'Through-Hole']],
      vals: ['5 W','10 W','15 W','25 W','65 W','120 W'],
      desc: (p) => `AC-DC converter, ${p.value}, out ${pick(['5 V','12 V','15 V','24 V','48 V'])}` },

    // ── Electromechanical ──
    { cat: 'em', fam: 'Relays', n: 80, pre: 'RLY', tols: ['—'],
      volts: ['—'],
      pkgs: [['SMD relay',G_SPEC,'SMD'],['PCB THT',G_THT,'Through-Hole'],['Sealed SMD',G_SPEC,'SMD']],
      vals: ['3 V coil','5 V coil','12 V coil','24 V coil'],
      desc: (p) => `Signal relay, ${p.value}, ${pick(['SPST-NO','SPDT','DPDT'])}, ${pick(['1 A','2 A','5 A','8 A'])} contacts` },
    { cat: 'em', fam: 'Switches', n: 100, pre: 'SWC', tols: ['—'],
      volts: ['—'],
      pkgs: [['SMD 6×6',G_SPEC,'SMD'],['THT 12×12',G_THT,'Through-Hole'],['Side-actuated SMD',G_SPEC,'SMD'],['DIP THT',G_THT,'Through-Hole']],
      vals: ['SPST tactile','SPDT slide','DPDT slide','rotary 3-pos','rotary 8-pos','DIP 4-way','DIP 8-way','detector'],
      desc: (p) => `${p.value} switch, ${pick(['160 gf','250 gf','320 gf'])} actuation, ${pick(['50 000','100 000','500 000'])} cycles` },
    { cat: 'em', fam: 'Encoders', n: 60, pre: 'ENC', tols: ['—'],
      volts: ['—'],
      pkgs: [['THT 20 mm',G_THT,'Through-Hole'],['SMD 12 mm',G_SPEC,'SMD'],['THT 25 mm',G_THT,'Through-Hole']],
      vals: ['12 PPR','16 PPR','24 PPR','32 PPR','64 PPR','1024 CPR optical'],
      desc: (p) => `Rotary encoder, ${p.value}, ${pick(['incremental','incremental w/ switch','absolute'])}` },
  ];

  /* ── categories (order defines collection order) ──────────────────────── */
  const CATS = [
    { id: 'cap',  name: 'Capacitors' },
    { id: 'res',  name: 'Resistors' },
    { id: 'ind',  name: 'Inductors & Magnetics' },
    { id: 'con',  name: 'Connectors' },
    { id: 'semi', name: 'Semiconductors' },
    { id: 'sen',  name: 'Sensors' },
    { id: 'pwr',  name: 'Power Management' },
    { id: 'em',   name: 'Electromechanical' },
  ];

  /* ── mpn helpers ──────────────────────────────────────────────────────── */
  function valueCode(v) {
    return v
      .replace(/µ/g, 'U').replace(/Ω/g, 'R').replace(/°/g, '').replace(/±/g, '')
      .replace(/[^A-Za-z0-9.]+/g, '').toUpperCase();
  }
  function pkgCode(p) {
    return p.replace(/[^A-Za-z0-9]+/g, '').toUpperCase().slice(0, 8);
  }

  /* ── generation ───────────────────────────────────────────────────────── */
  const parts = [];
  let id = 0;
  const famsByCat = {};
  for (const c of CATS) famsByCat[c.id] = [];

  for (const f of F) {
    const famId = f.cat + '/' + f.pre;
    famsByCat[f.cat].push({ id: famId, name: f.fam });
    for (let i = 0; i < f.n; i++) {
      const value = f.vals[i % f.vals.length];
      const [pkg, group, mount] = f.pkgs[(i + Math.floor(rand() * f.pkgs.length)) % f.pkgs.length];
      const tol = pick(f.tols);
      const volt = pick(f.volts);
      // stock: ~78% healthy, ~14% low, ~8% out
      const r = rand();
      const stock = r < 0.08 ? 0 : r < 0.22 ? rint(1, 50) : rint(51, 5200);
      const p = {
        id: ++id,
        mpn: `PA-${f.pre}-${valueCode(value)}-${pkgCode(pkg)}${String(rint(1, 999)).padStart(3, '0')}`,
        cat: f.cat, fam: famId,
        value, pkg, pkgGroup: group, mount, tol, volt, stock,
        desc: f.desc({ value, tol, volt }),
      };
      parts.push(p);
    }
  }

  // Precompute a lowercase haystack per part so every keystroke is a single pass.
  for (const p of parts) {
    p.hay = [p.mpn, p.desc, p.value, p.pkg, p.pkgGroup, p.mount,
      p.tol === '—' ? '' : p.tol, p.volt === '—' ? '' : p.volt,
      famNameOf(p.fam), catNameOf(p.cat)]
      .join(' ').toLowerCase();
  }
  function famNameOf(fid) { for (const f of F) if (f.cat + '/' + f.pre === fid) return f.fam; return fid; }
  function catNameOf(cid) { for (const c of CATS) if (c.id === cid) return c.name; return cid; }

  // Availability band (derived facet).
  function availOf(stock) { return stock === 0 ? 'Out of stock' : stock <= 50 ? 'Low stock' : 'In stock'; }
  for (const p of parts) p.avail = availOf(p.stock);

  /* ── export ───────────────────────────────────────────────────────────── */
  window.CATALOG = {
    generated: '2026-09-24',
    categories: CATS,
    families: famsByCat,
    parts,
  };
})();
