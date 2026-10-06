// Büyük şehir stres testi: tüm harita, ızgara yollar, karışık bölgeler. node tests/bigcity.mjs [ay]
import { createState } from '../js/core/state.js';
import { initRuntime, tick } from '../js/sim/simulation.js';
import * as A from '../js/sim/actions.js';
import { N, TICKS_PER_MONTH, idx } from '../js/core/constants.js';
import { DEV_TREE } from '../js/data/progression.js';

const s = createState(+(process.argv[3] || 99));
initRuntime(s);
s.money = 5e7; s.milestone = 20; s.xp = 65000; for (const c in DEV_TREE) for (const n of DEV_TREE[c]) s.devNodes[n.id] = true; s.owned.fill(1);
const lo = 20, hi = N - 20, step = 13;
for (let x = lo; x <= hi; x += step) A.buildRoad(s, A.linePath(x, lo, x, hi), x % 26 === lo % 26 ? 3 : 1);
for (let z = lo; z <= hi; z += step) A.buildRoad(s, A.linePath(lo, z, hi, z), z === lo + step * 4 ? 4 : 1);
// otoyolu ızgaraya bağla
let hwEnd = 0; for (let x = 0; x < N; x++) if (s.road[idx(x, N / 2)] === 6) hwEnd = x;
A.buildRoad(s, A.linePath(hwEnd, N / 2, lo, N / 2), 3);
const cells = []; for (let i = 0; i < N * N; i++) if (s.road[i] && s.road[i] !== 6) cells.push([i % N, (i / N) | 0]);
A.buildNetwork(s, 'pipeW', cells); A.buildNetwork(s, 'pipeS', cells);
// bölgeler: merkeze yakın yüksek yoğunluk
const c0 = N / 2;
for (let z = lo; z < hi; z += 2) for (let x = lo; x < hi; x += 2) {
  const d = Math.hypot(x - c0, z - c0);
  const q = (x * 7 + z * 13) % 10;
  let t = 1;
  if (d < 22) t = q < 4 ? 6 : q < 6 ? 8 : q < 8 ? 11 : 5;
  else if (d < 40) t = q < 4 ? 3 : q < 6 ? 2 : q < 8 ? 7 : 10;
  else t = q < 5 ? 1 : q < 7 ? 7 : 9;
  A.paintZone(s, [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]], t);
}
const place = (k, cx, cz) => { for (let r = 0; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; for (let f = 0; f < 4; f++) { const res = A.placeService(s, k, cx + dx, cz + dz, f); if (res.ok) { const c = []; for (let z = res.b.z - 1; z <= res.b.z + res.b.sz; z++) for (let x = res.b.x - 1; x <= res.b.x + res.b.sx; x++) c.push([x, z]); A.buildNetwork(s, 'pipeW', c); A.buildNetwork(s, 'pipeS', c); return res.b; } } } return null; };
// su: nehir kıyısı
let placedW = 0, placedS = 0;
for (let z = lo; z < hi && (placedW < 6 || placedS < 6); z += 6) for (let x = lo; x < hi; x++) {
  if (!s.water[idx(x + 2, z)] || s.water[idx(x, z)]) continue;
  if (placedW < 6 && z < c0 && place('water_large', x - 1, z)) placedW++;
  else if (placedS < 6 && z > c0 && place('sewage_treatment', x - 2, z)) placedS++;
  break;
}
place('nuclear', lo + 6, hi - 8); place('coal', lo + 6, lo + 8);
for (let z = lo + 8; z < hi; z += 26) for (let x = lo + 8; x < hi; x += 26) {
  for (const k of ['hospital', 'police_hq', 'fire_station', 'elementary', 'high_school', 'city_park', 'post_office', 'antenna', 'cemetery', 'landfill']) place(k, x + ((Math.random() * 8) | 0), z + ((Math.random() * 8) | 0));
}
place('university', c0 + 10, c0 + 10); place('crematorium', c0 - 20, c0); place('incinerator', lo + 20, hi - 6);
console.log('kurulum bitti: binalar', Object.keys(s.buildings).length, 'para', Math.round(s.money));
const months = +(process.argv[2] || 36); const T = Date.now(); let worst = 0;
for (let m = 0; m < months; m++) {
  const t0 = Date.now();
  for (let t = 0; t < TICKS_PER_MONTH; t++) { const a = performance.now(); tick(s); if (m > 0) worst = Math.max(worst, performance.now() - a); }
  const st = s.stats;
  if ((m + 1) % 6 === 0) console.log(`ay ${m + 1}: nüfus=${st.pop} bina=${Object.keys(s.buildings).length} net=${Math.round(s.econ.totalInc - s.econ.totalExp)} R=${s.demand.res.toFixed(2)} C=${s.demand.com.toFixed(2)} I=${s.demand.ind.toFixed(2)} O=${s.demand.off.toFixed(2)} işsiz=${(st.unemployment * 100).toFixed(1)}% mutlu=${(st.happiness || 0).toFixed(0)} elek=${st.power.prod.toFixed(0)}/${st.power.cons.toFixed(0)} su=${st.water.prod.toFixed(0)}/${st.water.cons.toFixed(0)} trafik=${(st.trafficFlow ?? 0).toFixed(0)} terk=${Object.values(s.buildings).filter((b) => b.abandoned).length} ms/ay=${Date.now() - t0}`);
}
console.log('ortalama ms/tik', ((Date.now() - T) / (months * TICKS_PER_MONTH)).toFixed(2), 'en kötü tik ms', worst.toFixed(1));
const lv = {}; for (const id in s.buildings) { const b = s.buildings[id]; if (b.kind === 'zone') lv[b.level] = (lv[b.level] || 0) + 1; } console.log('seviyeler', lv);
const why = {}; for (const id in s.buildings) { const b = s.buildings[id]; if (b.probWhy) why[b.probWhy] = (why[b.probWhy] || 0) + 1; } console.log(why);
console.log('gelir', Object.fromEntries(Object.entries(s.econ.inc).map(([k, v]) => [k, Math.round(v)])));
console.log('gider', Object.fromEntries(Object.entries(s.econ.exp).map(([k, v]) => [k, Math.round(v)])));
