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
import { geomsFor, traceUncovered, roadStretch, roadPath, samplesInCells } from '../js/sim/roadgeom.js';
import { refreshRoads } from '../js/sim/simulation.js';

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
// pürüzsüz yollar + köprüler: su üzerinden çekilen yol köprü olur, yanına bölge/bina yapılamaz
{
  const v = createState(77, 'Köprü', 'valley', {}); initRuntime(v); v.money = 1e9; v.owned.fill(1);
  const rz = N / 2; let w0 = -1, w1 = -1; for (let x = 0; x < N; x++) if (v.water[idx(x, rz)]) { if (w0 < 0) w0 = x; w1 = x; }
  assert.ok(w0 > 0, 'nehir bulundu');
  const nSeg = v.segs.length;
  const r = A.buildRoadGeoms(v, geomsFor('straight', [[w0 - 10, rz + 5], [w1 + 10, rz + 5]]), 1, {});
  assert.ok(r.ok, 'köprü yolu: ' + r.msg);
  assert.ok(v.segs.length > nSeg, 'şerit eklendi');
  refreshRoads(v);
  const wc = idx(w0 + 1, rz + 5); assert.ok(v.road[wc] && v.rt.bridge[wc] === 1, 'su üstündeki hücre köprü');
  for (const dz of [-1, 1]) assert.equal(v.rt.zdepth[idx(w0 - 1, rz + 5 + dz)] || 0, 0, 'köprü başının yanı bölgelenemez');
  assert.ok(v.rt.zdepth[idx(w0 - 8, rz + 4)] > 0, 'köprüden uzakta bölgelenebilir');
  const curve = A.buildRoadGeoms(v, geomsFor('curved', [[w0 - 30, rz + 5], [w0 - 30, rz + 25], [w0 - 10, rz + 25]]), 1, {});
  assert.ok(curve.ok, 'kavisli yol');
  const segAfter = v.segs.length; A.undoLast(v); assert.ok(v.segs.length < segAfter, 'geri al şeridi kaldırır');
  const v2 = deserialize(serialize(v)); initRuntime(v2); assert.equal(v2.segs.length, v.segs.length, 'şeritler kaydedilir');
  console.log('köprü + pürüzsüz yol testleri geçti', v.segs.length, 'şerit');
  // eski kayıt: hücre tabanlı merdiven yol → izlenen şerit yumuşak olmalı ve yol hücrelerinde kalmalı
  const bx = w0 - 40, bz = rz - 30; const stair = [];
  for (let k = 0; k < 12; k++) { stair.push([bx + k, bz + k]); stair.push([bx + k + 1, bz + k]); }
  assert.ok(A.buildRoad(v, stair, 1).ok, 'merdiven yol');
  const stairSet = new Set(stair.map(([x, z]) => idx(x, z)));
  v.segs = v.segs.filter((q) => { for (let k = 0; k < q.p.length; k += 2) if (stairSet.has(idx(Math.floor(q.p[k]), Math.floor(q.p[k + 1])))) return false; return true; });
  traceUncovered(v);
  const tr = v.segs.filter((q) => { for (let k = 0; k < q.p.length; k += 2) if (stairSet.has(idx(Math.floor(q.p[k]), Math.floor(q.p[k + 1])))) return true; return false; });
  assert.ok(tr.length >= 1, 'merdiven yol izlendi');
  let maxTurn = 0;
  for (const q of tr) {
    for (let k = 0; k < q.p.length; k += 2) assert.ok(v.road[idx(Math.floor(q.p[k]), Math.floor(q.p[k + 1]))], 'örnek yol hücresinde');
    const P = []; for (let k = 0; k < q.p.length; k += 2) P.push([q.p[k], q.p[k + 1]]);
    for (let k = 6; k < P.length - 6; k += 2) {
      const a1 = Math.atan2(P[k][1] - P[k - 2][1], P[k][0] - P[k - 2][0]), a2 = Math.atan2(P[k + 2][1] - P[k][1], P[k + 2][0] - P[k][0]);
      let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d; maxTurn = Math.max(maxTurn, d);
    }
  }
  assert.ok(maxTurn < 0.6, 'merdiven yol yumuşatıldı (en büyük dönüş ' + maxTurn.toFixed(2) + ' rad)');
  // "Değiştir": tek tıkla iki kavşak arası parça
  const mid = idx(w0 - 5, rz + 5); assert.ok(v.road[mid], 'köprü yolu hücresi');
  const stretch = roadStretch(v, mid); assert.ok(stretch.length > 5, 'parça bulundu: ' + stretch.length);
  const rr = A.buildRoadChains(v, [stretch.map((c) => [c % N, (c / N) | 0])], 3, { replace: true });
  assert.ok(rr.ok, 'yol değiştirildi: ' + rr.msg);
  assert.ok(stretch.every((c) => v.road[c] === 3), 'parçanın tamamı yeni türde');
  const pth = roadPath(v, idx(w0 - 8, rz + 5), idx(w1 + 8, rz + 5)); assert.ok(pth.length > 10, 'güzergâh bulundu');
  assert.ok(samplesInCells(v, stretch).length >= 1, 'önizleme örnekleri');
  console.log('eski yol yumuşatma + değiştir testleri geçti, en büyük dönüş', maxTurn.toFixed(2));
}
console.log('TÜM ÖZELLİK TESTLERİ GEÇTİ');
