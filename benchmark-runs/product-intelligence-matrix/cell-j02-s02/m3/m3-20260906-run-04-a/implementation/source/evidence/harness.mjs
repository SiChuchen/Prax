import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('../gen.js');
const { items } = globalThis.LOCI_GEN.generate();
const Mang = items.filter(i => /mangrove/i.test(i.name));
console.log(JSON.stringify({ total: items.length, first: items[0].id, first2: items[1].id,
  mangroveCount: Mang.length, mangroveFirst: Mang[0] ? Mang[0].id + '|' + Mang[0].name : null,
  csvCount: items.filter(i=>i.format==='CSV').length }, null, 1));
