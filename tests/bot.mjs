// Denge testi: basit bir "belediye başkanı botu" şehri yönetir. node tests/bot.mjs [ay]
import { createState } from '../js/core/state.js';
import { initRuntime, tick } from '../js/sim/simulation.js';
import { buildRoad, paintZone, placeService, linePath, rectCells, buildNetwork } from '../js/sim/actions.js';
import { N, TICKS_PER_MONTH, TILE, TILES, idx } from '../js/core/constants.js';
import { serviceUnlocked } from '../js/sim/progression.js';
import { MILESTONES } from '../js/data/progression.js';

const s = createState(+(process.argv[3] || 777));
initRuntime(s);
const log = (...a) => console.log(...a);
const hz = N / 2;
let hwEnd = 0; for (let x = 0; x < N; x++) if (s.road[idx(x, hz)]) hwEnd = x;
const t0 = Math.floor(TILES / 2 - 1.5) * TILE;
const ownedX0 = t0, ownedX1 = t0 + 3 * TILE - 1, ownedZ0 = t0, ownedZ1 = t0 + 3 * TILE - 1;
let riverX = hwEnd; while (riverX < N - 1 && !s.water[idx(riverX + 1, hz)]) riverX++;
const east = Math.min(ownedX1, riverX - 1);
// yol ızgarası
buildRoad(s, linePath(hwEnd, hz, east, hz), 3);
const vx = []; for (let x = hwEnd + 1; x <= east; x += 13) vx.push(x);
for (const x of vx) buildRoad(s, linePath(x, ownedZ0 + 1, x, ownedZ1 - 1), 1);
for (const z of [hz - 13, hz - 26, hz + 13]) if (z > ownedZ0 && z < ownedZ1) buildRoad(s, linePath(vx[0], z, vx[vx.length - 1], z), 1);
const allRoad = () => { const c = []; for (let i = 0; i < N * N; i++) if (s.road[i] && s.road[i] !== 6) c.push([i % N, (i / N) | 0]); return c; };
buildNetwork(s, 'pipeW', allRoad()); buildNetwork(s, 'pipeS', allRoad());
// bölgeler: kuzey konut, ana cadde boyunca ticari, güney sanayi
paintZone(s, rectCells(ownedX0, ownedZ0, east, hz - 2), 1);
paintZone(s, rectCells(ownedX0, hz - 1, east, hz - 1), 7);
paintZone(s, rectCells(ownedX0, hz + 1, east, hz + 2), 7);
paintZone(s, rectCells(ownedX0, hz + 3, east, ownedZ1), 9);

function placeNear(key, cx, cz, rmax = 30) {
  if (!serviceUnlocked(s, key)) return null;
  for (let r = 0; r < rmax; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    for (let f = 0; f < 4; f++) { const res = placeService(s, key, cx + dx, cz + dz, f); if (res.ok) { pipeAround(res.b); return res.b; } }
  }
  return null;
}
function pipeAround(b) { const c = []; for (let z = b.z - 1; z <= b.z + b.sz; z++) for (let x = b.x - 1; x <= b.x + b.sx; x++) c.push([x, z]); buildNetwork(s, 'pipeW', c); buildNetwork(s, 'pipeS', c); }
const have = (k) => Object.values(s.buildings).filter((b) => b.type === k).length;

placeNear('water_pump', riverX - 2, hz - 6); placeNear('sewage_outlet', riverX - 2, hz + 10);
for (let k = 0; k < 3; k++) placeNear('wind_turbine', vx[1] + 2, hz - 3);

const months = +(process.argv[2] || 60);
const T = Date.now();
for (let m = 0; m < months; m++) {
  for (let t = 0; t < TICKS_PER_MONTH; t++) tick(s);
  const st = s.stats;
  // bot kararları
  if (st.power.cons > st.power.prod * 0.85) { if (!placeNear('coal_small', vx[vx.length - 1], hz + 8)) placeNear('wind_turbine', vx[1], hz + 5); }
  if (st.water.cons > st.water.prod * 0.8) placeNear('water_pump', riverX - 2, hz - 15 + (m % 20));
  if (st.sewage.cons > st.sewage.prod * 0.8) placeNear('sewage_outlet', riverX - 2, hz + 15 - (m % 10));
  if (s.milestone >= 1) { if (have('landfill') < 1 + (st.pop > 4000)) placeNear('landfill', vx[vx.length - 1] - 4, hz + 20); if (have('clinic') < 1 + Math.floor(st.pop / 3000)) placeNear('clinic', vx[1], hz - 8); if (have('cemetery') < 1 + Math.floor(st.pop / 6000)) placeNear('cemetery', vx[2], hz + 18); }
  if (s.milestone >= 2) { if (have('elementary') < 1 + Math.floor(st.pop / 2500)) placeNear('elementary', vx[1], hz - 18); if (have('high_school') < 1 + Math.floor(st.pop / 5000)) placeNear('high_school', vx[2], hz - 20); }
  if (s.milestone >= 2 && m % 6 === 0) paintZone(s, rectCells(ownedX0, ownedZ0, east, hz - 20), 3);
  if (s.milestone >= 3) { if (have('police_station') < 1 + Math.floor(st.pop / 4000)) placeNear('police_station', vx[2], hz - 6); if (have('fire_house') < 1 + Math.floor(st.pop / 4000)) placeNear('fire_house', vx[1], hz + 5); }
  if (s.milestone >= 4) { if (have('small_park') < 2 + Math.floor(st.pop / 1500)) placeNear('small_park', vx[(m % (vx.length - 1)) + 1] - 3, hz - 10); paintZone(s, rectCells(ownedX0, hz + 3, east, hz + 8), 10); }
  if (s.milestone >= 5 && have('post_office') < 1) placeNear('post_office', vx[2], hz - 4);
  if (s.money < 20000 && s.loan < MILESTONES[s.milestone].loan) { s.loan += 50000; s.money += 50000; }
  if ((m + 1) % 3 === 0) log(`ay ${m + 1}: nüfus=${st.pop} bina=${Object.keys(s.buildings).length} para=${Math.round(s.money)} net=${Math.round(s.econ.totalInc - s.econ.totalExp)} R=${s.demand.res.toFixed(2)} C=${s.demand.com.toFixed(2)} I=${s.demand.ind.toFixed(2)} O=${s.demand.off.toFixed(2)} işsiz=${(st.unemployment * 100).toFixed(1)}% mutlu=${(st.happiness || 0).toFixed(0)} xp=${Math.round(s.xp)} kt=${s.milestone} elek=${st.power.prod.toFixed(1)}/${st.power.cons.toFixed(1)} su=${st.water.prod.toFixed(0)}/${st.water.cons.toFixed(0)} trafik=${(st.trafficFlow ?? 0).toFixed(0)} turist=${st.tourists || 0} terk=${Object.values(s.buildings).filter((b) => b.abandoned).length}`);
}
log('ms/tik', ((Date.now() - T) / (months * TICKS_PER_MONTH)).toFixed(2));
const why = {}; for (const id in s.buildings) { const b = s.buildings[id]; if (b.probWhy) why[b.probWhy] = (why[b.probWhy] || 0) + 1; } log(why);
log('gelir', Object.fromEntries(Object.entries(s.econ.inc).map(([k, v]) => [k, Math.round(v)])));
log('gider', Object.fromEntries(Object.entries(s.econ.exp).map(([k, v]) => [k, Math.round(v)])));
log('eğitim', s.edu.map(Math.round), 'iş doluluk', s.stats.jobFill.map((v) => v.toFixed(2)));
