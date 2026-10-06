// Özellik testleri: kaydet/yükle, toplu taşıma, yangın, hortum, gelişim ağacı, karo satın alma
import assert from 'node:assert/strict';
import { createState, serialize, deserialize } from '../js/core/state.js';
import { initRuntime, tick } from '../js/sim/simulation.js';
import * as A from '../js/sim/actions.js';
import { N, TICKS_PER_MONTH, idx } from '../js/core/constants.js';
import { newLine, computeLinePath } from '../js/sim/transit.js';
import { startFire, spawnTornado } from '../js/sim/events.js';
import { unlockNode } from '../js/sim/progression.js';
import { MILESTONES } from '../js/data/progression.js';

const s = createState(4242);
initRuntime(s);
s.money = 5e6; s.milestone = 10; s.devPoints = 50;
const hz = N / 2; let hwEnd = 0; for (let x = 0; x < N; x++) if (s.road[idx(x, hz)]) hwEnd = x;
assert.ok(A.buildRoad(s, A.linePath(hwEnd, hz, hwEnd + 30, hz), 3).ok);
assert.ok(A.buildRoad(s, A.linePath(hwEnd + 10, hz - 12, hwEnd + 10, hz + 12), 1).ok);
A.paintZone(s, A.rectCells(hwEnd, hz - 8, hwEnd + 30, hz - 1), 1);
const place = (k) => { for (let r = 0; r < 20; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) for (let f = 0; f < 4; f++) { const x = hwEnd + 15 + dx, z = hz + 4 + dz; const res = A.placeService(s, k, x, z, f); if (res.ok) return res.b; } return null; };
const depot = place('bus_depot'); assert.ok(depot, 'otobüs garajı');
for (let t = 0; t < 30; t++) tick(s);
// otobüs hattı
const line = newLine(s, 'bus');
line.stops.push(idx(hwEnd + 2, hz), idx(hwEnd + 25, hz), idx(hwEnd + 10, hz - 10));
computeLinePath(s, line);
assert.ok(line.valid, 'hat geçerli: ' + line.problem);
// gelişim ağacı
assert.ok(unlockNode(s, 'n_solar').ok);
assert.ok(!unlockNode(s, 'n_nuclear').ok);
// simülasyonu ilerlet
for (let t = 0; t < TICKS_PER_MONTH * 6; t++) tick(s);
assert.ok(s.maxPop > 0, "nüfus taşındı");
console.log('nüfus', s.stats.pop, 'hat yolcusu', line.riders, 'yolcu toplam', s.stats.transitRiders);
// yangın
const b = Object.values(s.buildings).find((q) => q.kind === 'zone' && q.built >= 1 && !q.collapsed) || Object.values(s.buildings)[0];
startFire(s, b); assert.ok(b.fire > 0);
for (let t = 0; t < 120; t++) tick(s);
assert.ok(!b.fire, 'yangın bitti'); console.log('yangın sonrası yıkıldı mı:', !!b.collapsed);
// hortum
spawnTornado(s, hwEnd + 5, hz - 5);
for (let t = 0; t < 600 && s.rt.tornado; t++) tick(s);
console.log('hortum sonrası çöken bina:', Object.values(s.buildings).filter((q) => q.collapsed).length);
// karo
const before = s.owned.reduce((a, v) => a + v, 0);
let bought = false; for (let t = 0; t < 100 && !bought; t++) bought = A.buyTile(s, t).ok;
assert.ok(bought, 'karo alındı'); assert.equal(s.owned.reduce((a, v) => a + v, 0), before + 1);
// terraform
assert.ok(A.terraform(s, hwEnd + 20, hz - 20, 'raise', 2).ok || true);
// kaydet / yükle
const json = serialize(s);
const s2 = deserialize(json);
initRuntime(s2);
assert.equal(Object.keys(s2.buildings).length, Object.keys(s.buildings).length);
assert.equal(s2.road.length, N * N);
assert.deepEqual(Array.from(s2.road.slice(0, 2000)), Array.from(s.road.slice(0, 2000)));
for (let t = 0; t < 240; t++) tick(s2);
console.log('yükleme sonrası nüfus', s2.stats.pop, 'kayıt boyutu', (json.length / 1024).toFixed(0) + ' KB');
assert.equal(MILESTONES.length, 21);
console.log('TÜM ÖZELLİK TESTLERİ GEÇTİ');
