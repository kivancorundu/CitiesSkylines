// Başsız (headless) simülasyon testi: node tests/sim.test.mjs
import { createState } from '../js/core/state.js';
import { initRuntime, tick } from '../js/sim/simulation.js';
import { buildRoad, paintZone, placeService, autoFacing, linePath, rectCells, buildNetwork } from '../js/sim/actions.js';
import { N, TICKS_PER_MONTH, idx } from '../js/core/constants.js';
import { ZONES } from '../js/data/zones.js';

const s = createState(12345);
initRuntime(s);
const hz = N / 2;
// otoyol ucundan doğuya ana cadde ve dik sokaklar
let hwEnd = 0; for (let x = 0; x < N; x++) if (s.road[idx(x, hz)]) hwEnd = x;
const log = (...a) => console.log(...a);
const r1 = buildRoad(s, linePath(hwEnd, hz, hwEnd + 30, hz), 3); log('ana cadde', r1.ok, r1.cost);
for (let k = 0; k < 6; k++) {
  const x = hwEnd + 3 + k * 5;
  buildRoad(s, linePath(x, hz - 14, x, hz + 14), 1);
}
// borular yollar boyunca
const roadCells = []; for (let i = 0; i < N * N; i++) if (s.road[i] && s.owned[0] !== undefined) roadCells.push([i % N, (i / N) | 0]);
const own = roadCells.filter(([x, z]) => s.owned[((z / 16) | 0) * 10 + ((x / 16) | 0)]);
log('su', buildNetwork(s, 'pipeW', own).ok, 'kanal', buildNetwork(s, 'pipeS', own).ok);
// bölgeleme
log('konut', paintZone(s, rectCells(hwEnd + 3, hz - 14, hwEnd + 14, hz - 1), 1).n);
log('ticari', paintZone(s, rectCells(hwEnd + 3, hz + 1, hwEnd + 10, hz + 6), 7).n);
log('sanayi', paintZone(s, rectCells(hwEnd + 14, hz + 1, hwEnd + 28, hz + 14), 9).n);
// rüzgar türbinleri
for (let k = 0; k < 4; k++) { const x = hwEnd + 16 + k * 2, z = hz - 2; const r = placeService(s, 'wind_turbine', x, z, autoFacing(s, 'wind_turbine', x, z)); if (!r.ok) log('türbin', r.msg); }
// su pompası ve kanalizasyon çıkışı: ana caddeyi nehre kadar uzat
let rx = hwEnd + 30; while (rx < N - 1 && !s.water[idx(rx + 1, hz)]) rx++;
buildRoad(s, linePath(hwEnd + 30, hz, rx, hz), 3);
buildNetwork(s, 'pipeW', linePath(hwEnd, hz, rx, hz)); buildNetwork(s, 'pipeS', linePath(hwEnd, hz, rx, hz));
const tryPlace = (key) => {
  for (let r = 1; r < 12; r++) for (let dz = -r; dz <= r; dz++) for (const dx of [-r, -1, 0, 1]) {
    const x = rx + dx, z = hz + dz;
    for (let f = 0; f < 4; f++) { const res = placeService(s, key, x, z, f); if (res.ok) return res.b; }
  }
  return null;
};
const pump = tryPlace('water_pump'); const outl = tryPlace('sewage_outlet');
log('pompa', !!pump, 'çıkış', !!outl);
for (const b of [pump, outl]) if (b) { const cells = []; for (let z = b.z - 1; z <= b.z + b.sz; z++) for (let x = b.x - 1; x <= b.x + b.sx; x++) cells.push([x, z]); buildNetwork(s, 'pipeW', cells); buildNetwork(s, 'pipeS', cells); }
log('başlangıç para', Math.round(s.money));
const months = +(process.argv[2] || 12);
const t0 = Date.now();
for (let m = 0; m < months; m++) {
  for (let t = 0; t < TICKS_PER_MONTH; t++) tick(s);
  const st = s.stats;
  log(`ay ${m + 1}: nüfus=${st.pop} bina=${Object.keys(s.buildings).length} para=${Math.round(s.money)} gelir=${Math.round(s.econ.totalInc)} gider=${Math.round(s.econ.totalExp)} R=${s.demand.res.toFixed(2)} C=${s.demand.com.toFixed(2)} I=${s.demand.ind.toFixed(2)} O=${s.demand.off.toFixed(2)} işsizlik=${(st.unemployment * 100).toFixed(1)}% mutluluk=${(st.happiness || 0).toFixed(0)} xp=${Math.round(s.xp)} ktaşı=${s.milestone} elek=${st.power.prod.toFixed(1)}/${st.power.cons.toFixed(1)} ithal=${st.power.imp.toFixed(1)}`);
}
log('süre ms', Date.now() - t0, 'ms/tik', ((Date.now() - t0) / (months * TICKS_PER_MONTH)).toFixed(2));
const byZone = {}; for (const id in s.buildings) { const b = s.buildings[id]; const k = b.kind === 'zone' ? ZONES[b.type].key : b.type; byZone[k] = (byZone[k] || 0) + 1; }
log(byZone);
