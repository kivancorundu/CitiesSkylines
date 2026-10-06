// Yol ağı testleri: kesişimde bölme, T kavşak, çakışan yolu birleştirme, eski kayıt dönüşümü
import assert from 'node:assert/strict';
import { createState } from '../js/core/state.js';
import { initRuntime } from '../js/sim/simulation.js';
import * as A from '../js/sim/actions.js';
import { geomsFor, normalizeNetwork } from '../js/sim/roadgeom.js';
import { idx } from '../js/core/constants.js';

const s = createState(5, 'Yol', 'valley', {}); s.money = 1e12; s.owned.fill(1); initRuntime(s);
const b = (m, pts, t = 1) => { const r = A.buildRoadGeoms(s, geomsFor(m, pts), t, {}); assert.ok(r.ok, r.msg); };
// düğüm dereceleri: şerit uçlarının çakıştığı noktalar
const nodes = () => { const m = new Map(); for (const q of s.segs) for (const k of [0, q.p.length - 2]) { const key = q.p[k].toFixed(2) + ',' + q.p[k + 1].toFixed(2); m.set(key, (m.get(key) || 0) + 1); } return m; };
const degAt = (x, z) => nodes().get(x.toFixed(2) + ',' + z.toFixed(2)) || 0;

b('straight', [[30, 40], [30, 70]], 3);
b('straight', [[18, 55], [45, 55]]);
assert.equal(degAt(30.5, 55.5), 4, 'dört yollu kavşak düğümü');
// T: yan yoldan 1 hücre uzakta bitse bile mevcut yola yapışır
b('straight', [[31, 63], [44, 63]]);
assert.equal(degAt(30.5, 63.5), 3, 'T kavşak düğümü');
assert.ok(s.rConn[idx(30, 63)] && s.road[idx(30, 63)], 'T kavşak simülasyonda bağlı');
let linked = false; for (let d = 0; d < 8; d++) if (s.rConn[idx(30, 63)] & (1 << d)) linked = true; assert.ok(linked);
// mevcut yolun üzerinden geçen yeni yol çift şerit oluşturmaz
const before = s.segs.length;
b('straight', [[30, 45], [30, 50]]);
assert.equal(s.segs.length, before, 'üst üste çizilen yol eklenmedi');
// aynı hatta devam eden yol: çakışan kısım atılır, yeni kısım uçtan bağlanır
b('straight', [[30, 60], [30, 76]]);
assert.ok(degAt(30.5, 70.5) >= 2, 'uzatma eski uca bağlandı');
let over = 0; for (const q of s.segs) for (let k = 0; k < q.p.length; k += 2) if (Math.abs(q.p[k] - 30.5) < 0.01 && q.p[k + 1] > 56 && q.p[k + 1] < 62) over++;
assert.ok(over <= 26, 'çakışan örnek yok: ' + over);
// çapraz yol mevcut kavşaktan geçer → 6 kollu düğüm
b('straight', [[20, 45], [40, 65]]);
assert.equal(degAt(30.5, 55.5), 6, 'çapraz yol kavşaktan geçti');
// eski kayıt: bölünmemiş, kesişen şeritler → normalize
const s2 = createState(6, 'Eski', 'valley', {}); s2.money = 1e12; s2.owned.fill(1); initRuntime(s2);
const t2 = (pts) => { const o = []; for (const [x, z] of pts) o.push(x, z); return { id: 0, p: o }; };
const line = (x0, z0, x1, z1) => { const o = []; const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.25); for (let k = 0; k <= n; k++) o.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n]); return o; };
s2.segs.push(t2(line(40.5, 30.5, 40.5, 50.5)), t2(line(30.5, 40.5, 50.5, 40.5)));
normalizeNetwork(s2);
const m2 = new Map(); for (const q of s2.segs) for (const k of [0, q.p.length - 2]) { const key = q.p[k].toFixed(2) + ',' + q.p[k + 1].toFixed(2); m2.set(key, (m2.get(key) || 0) + 1); }
assert.equal(m2.get('40.50,40.50'), 4, 'eski kayıtta kesişim bölündü');
// geri al şeritleri geri getirir
const n1 = s.segs.length; b('straight', [[50, 40], [50, 60]]); A.undoLast(s); assert.equal(s.segs.length, n1, 'geri al');
console.log('YOL AĞI TESTLERİ GEÇTİ', s.segs.length, 'şerit');
