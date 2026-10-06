// Oyuncu eylemleri: yol, bölgeleme, bina yerleştirme, yıkım, şebekeler, arazi
import { N, TILE, TILES, DIRS, idx, inB, tileOf, vidx, clamp } from '../core/constants.js';
import { ROADS, ROAD_UPGRADES, NETWORKS } from '../data/roads.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { flattenCell } from '../core/state.js';
import { makeBuilding, removeBuilding, dimsFor } from './buildings.js';
import { accessCell } from './network.js';
import { addXP, serviceUnlocked, zoneUnlocked, isUnlocked, allowedTiles, ownedTiles, tileCost } from './progression.js';
import { zoneCellOk } from './growth.js';
import { refreshRoads } from './simulation.js';

const ownedCell = (s, x, z) => !!s.owned[tileOf(x, z)];

export function linePath(x0, z0, x1, z1) {
  const out = [[x0, z0]];
  let x = x0, z = z0;
  const stepX = () => { while (x !== x1) { x += Math.sign(x1 - x); out.push([x, z]); } };
  const stepZ = () => { while (z !== z1) { z += Math.sign(z1 - z); out.push([x, z]); } };
  if (Math.abs(x1 - x0) >= Math.abs(z1 - z0)) { stepX(); stepZ(); } else { stepZ(); stepX(); }
  return out;
}

export function rectCells(x0, z0, x1, z1) {
  const out = [];
  for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) out.push([x, z]);
  return out;
}

function markRoadsDirty(s) {
  const d = s.rt.dirty; d.roads = true; d.terrain = true; d.overlay = true; d.cand = true; d.roadMesh = true; d.cov = true; d.util = true;
}

// ---------------- YOLLAR ----------------
export function planRoad(s, cells, type) {
  const def = ROADS[type]; let cost = 0; const res = [];
  for (const [x, z] of cells) {
    if (!inB(x, z)) { res.push({ x, z, ok: false }); continue; }
    const i = idx(x, z);
    let ok = ownedCell(s, x, z);
    const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null;
    if (b && b.kind === 'svc') ok = false;
    if (s.road[i] === type) { res.push({ x, z, ok: true, same: true }); continue; }
    let c = def.cost * (s.water[i] ? 3 : 1);
    if (s.road[i]) c = Math.max(0, c - ROADS[s.road[i]].cost * 0.5);
    if (ok) cost += c;
    res.push({ x, z, ok });
  }
  return { cost: Math.round(cost), cells: res };
}

export function buildRoad(s, cells, type) {
  if (!isUnlocked(s, ROADS[type].unlock)) return { ok: false, msg: 'Bu yol türü henüz açılmadı' };
  const plan = planRoad(s, cells, type);
  if (plan.cost > s.money) return { ok: false, msg: 'Yetersiz para' };
  let n = 0;
  for (const c of plan.cells) {
    if (!c.ok || c.same) continue;
    const i = idx(c.x, c.z);
    const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null;
    if (b) removeBuilding(s, b, false);
    s.road[i] = type; s.zone[i] = 0; s.tree[i] = 0;
    if (!s.water[i]) smoothRoadCell(s, c.x, c.z);
    n++;
  }
  s.money -= plan.cost;
  addXP(s, n * 0.15);
  markRoadsDirty(s); s.rt.dirty.trees = true;
  return { ok: true, n, cost: plan.cost };
}

function smoothRoadCell(s, x, z) {
  // köşe yüksekliklerini hafifçe ortala (yokuşlar korunur)
  const vs = [vidx(x, z), vidx(x + 1, z), vidx(x, z + 1), vidx(x + 1, z + 1)];
  let avg = 0; for (const v of vs) avg += s.vh[v]; avg /= 4;
  if (avg < 0.3) avg = 0.3;
  for (const v of vs) s.vh[v] = s.vh[v] * 0.4 + avg * 0.6;
}

export function removeRoads(s, cells) {
  let refund = 0, n = 0;
  for (const [x, z] of cells) {
    if (!inB(x, z)) continue; const i = idx(x, z);
    if (!s.road[i] || s.outside[i]) continue;
    if (!ownedCell(s, x, z)) continue;
    refund += ROADS[s.road[i]].cost * 0.5; s.road[i] = 0; s.roadUp[i] = 0; if (s.rail[i] === 2) s.rail[i] = 0; n++;
  }
  s.money += refund; markRoadsDirty(s);
  return { ok: n > 0, n, refund };
}

export function roadUpgrade(s, cells, bit, remove = false) {
  const u = ROAD_UPGRADES[bit]; let cost = 0, n = 0;
  for (const [x, z] of cells) {
    if (!inB(x, z)) continue; const i = idx(x, z); if (!s.road[i]) continue;
    if (remove) { if (s.roadUp[i] & bit) { s.roadUp[i] &= ~bit; n++; } continue; }
    if (s.roadUp[i] & bit) continue;
    if (cost + u.cost > s.money) break;
    s.roadUp[i] |= bit; cost += u.cost; n++;
  }
  s.money -= cost; s.rt.dirty.roadMesh = true; s.rt.dirty.overlay = true;
  return { ok: n > 0, n, cost };
}

// ---------------- ŞEBEKELER ----------------
export function planNetwork(s, kind, cells) {
  const def = NETWORKS[kind]; let cost = 0; const res = [];
  for (const [x, z] of cells) {
    if (!inB(x, z)) continue; const i = idx(x, z);
    let ok = ownedCell(s, x, z), have = false;
    if (kind === 'pipeW') have = !!s.pipeW[i];
    else if (kind === 'pipeS') have = !!s.pipeS[i];
    else if (kind === 'power') { have = !!s.power[i]; const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null; if (b && b.kind === 'zone') ok = false; }
    else if (kind === 'train') { have = s.rail[i] === 1; const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null; if (b && !(b.kind === 'svc' && SERVICES[b.type].station === 'train')) ok = false; if (s.water[i]) ok = ok && true; }
    else if (kind === 'tram') { have = s.rail[i] === 2; if (!s.road[i] || ROADS[s.road[i]].key === 'highway') ok = false; }
    else if (kind === 'metro') have = !!s.metro[i];
    if (!have && ok) cost += def.cost * (kind === 'train' && s.water[i] ? 3 : 1);
    res.push({ x, z, ok, have });
  }
  return { cost: Math.round(cost), cells: res };
}

export function buildNetwork(s, kind, cells) {
  const def = NETWORKS[kind];
  if (!isUnlocked(s, def.unlock)) return { ok: false, msg: 'Kilitli' };
  const plan = planNetwork(s, kind, cells);
  if (plan.cost > s.money) return { ok: false, msg: 'Yetersiz para' };
  for (const c of plan.cells) {
    if (!c.ok || c.have) continue; const i = idx(c.x, c.z);
    if (kind === 'pipeW') s.pipeW[i] = 1;
    else if (kind === 'pipeS') s.pipeS[i] = 1;
    else if (kind === 'power') { s.power[i] = 1; s.tree[i] = 0; }
    else if (kind === 'train') {
      const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null; void b;
      s.rail[i] = 1; s.tree[i] = 0; s.zone[i] = 0; if (!s.water[i]) smoothRoadCell(s, c.x, c.z);
    }
    else if (kind === 'tram') s.rail[i] = 2;
    else if (kind === 'metro') s.metro[i] = 1;
  }
  s.money -= plan.cost;
  const d = s.rt.dirty; d.util = true; d.netMesh = true; d.overlay = true; d.trees = true; d.lines = true;
  if (kind === 'train') { d.roads = true; d.terrain = true; }
  if (kind === 'train' || kind === 'tram' || kind === 'metro') d.roads = true;
  return { ok: true, cost: plan.cost };
}

export function removeNetwork(s, kind, cells) {
  let n = 0;
  for (const [x, z] of cells) {
    if (!inB(x, z)) continue; const i = idx(x, z); if (s.outside[i]) continue;
    if (kind === 'pipeW' && s.pipeW[i]) { s.pipeW[i] = 0; n++; }
    if (kind === 'pipeS' && s.pipeS[i]) { s.pipeS[i] = 0; n++; }
    if (kind === 'power' && s.power[i]) { s.power[i] = 0; n++; }
    if (kind === 'train' && s.rail[i] === 1) { s.rail[i] = 0; n++; }
    if (kind === 'tram' && s.rail[i] === 2) { s.rail[i] = 0; n++; }
    if (kind === 'metro' && s.metro[i]) { s.metro[i] = 0; n++; }
  }
  const d = s.rt.dirty; d.util = true; d.netMesh = true; d.overlay = true; d.roads = true;
  return { ok: n > 0, n };
}

// ---------------- BÖLGELEME ----------------
export function paintZone(s, cells, t) {
  if (s.rt.dirty.roads) refreshRoads(s);
  if (t && !zoneUnlocked(s, t)) return { ok: false, msg: 'Bu bölge türü kilitli' };
  let n = 0;
  for (const [x, z] of cells) {
    if (!inB(x, z)) continue; const i = idx(x, z);
    if (!ownedCell(s, x, z) || s.road[i] || s.water[i]) continue;
    if (t && !zoneCellOk(s, i, t)) continue;
    if (s.zone[i] === t) continue;
    const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null;
    if (b && b.kind === 'svc') continue;
    if (b && b.kind === 'zone' && b.type !== t) removeBuilding(s, b, false);
    s.zone[i] = t; n++;
  }
  s.rt.dirty.zones = true; s.rt.dirty.cand = true; s.rt.dirty.overlay = true;
  return { ok: n > 0, n };
}

// ---------------- HİZMET BİNALARI ----------------
export function footprintAt(def, hx, hz, f) {
  const [w, d] = def.size; const [sx, sz] = dimsFor(w, d, f);
  return { x: hx - ((sx - 1) >> 1), z: hz - ((sz - 1) >> 1), sx, sz, w, d, f };
}

export function autoFacing(s, key, hx, hz, pref = 1) {
  const def = SERVICES[key]; let best = pref, bestScore = -1;
  for (let k = 0; k < 4; k++) {
    const f = (pref + k) % 4;
    const fp = footprintAt(def, hx, hz, f);
    let score = 0;
    const [dx, dz] = DIRS[f];
    for (let z = fp.z; z < fp.z + fp.sz; z++) for (let x = fp.x; x < fp.x + fp.sx; x++) {
      const nx = x + dx, nz = z + dz;
      if (nx >= fp.x && nx < fp.x + fp.sx && nz >= fp.z && nz < fp.z + fp.sz) continue;
      if (inB(nx, nz) && s.road[idx(nx, nz)]) score++;
      if (def.place === 'shore' && inB(nx + dx, nz + dz) && s.water[idx(nx + dx, nz + dz)]) score += 0.1;
    }
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

export function validateService(s, key, hx, hz, f) {
  const def = SERVICES[key];
  const fp = footprintAt(def, hx, hz, f);
  const res = { ok: true, msg: '', fp, cost: def.cost };
  if (!serviceUnlocked(s, key)) return { ...res, ok: false, msg: 'Kilitli' };
  if (def.unique && Object.values(s.buildings).some((b) => b.type === key)) return { ...res, ok: false, msg: 'Bu benzersiz yapı zaten inşa edildi' };
  let water = 0, road = false;
  for (let z = fp.z; z < fp.z + fp.sz; z++) for (let x = fp.x; x < fp.x + fp.sx; x++) {
    if (!inB(x, z)) return { ...res, ok: false, msg: 'Harita dışında' };
    const i = idx(x, z);
    if (!ownedCell(s, x, z)) return { ...res, ok: false, msg: 'Bu harita karosu satın alınmamış' };
    if (s.water[i]) return { ...res, ok: false, msg: 'Su üzerine inşa edilemez' };
    if (s.road[i]) return { ...res, ok: false, msg: 'Yol üzerine inşa edilemez' };
    if (s.rail[i] === 1 && def.station !== 'train') return { ...res, ok: false, msg: 'Ray üzerine inşa edilemez' };
    const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null;
    if (b && b.kind === 'svc') return { ...res, ok: false, msg: 'Başka bir binayla çakışıyor' };
  }
  // ön cephe yolu
  const [dx, dz] = DIRS[f];
  for (let z = fp.z - 2; z < fp.z + fp.sz + 2; z++) for (let x = fp.x - 2; x < fp.x + fp.sx + 2; x++) {
    if (!inB(x, z)) continue; if (s.water[idx(x, z)]) water++;
  }
  for (let z = fp.z; z < fp.z + fp.sz; z++) for (let x = fp.x; x < fp.x + fp.sx; x++) {
    const nx = x + dx, nz = z + dz;
    if (inB(nx, nz) && s.road[idx(nx, nz)]) road = true;
  }
  if (!road && (def.prod?.power)) {
    // enerji santralleri yüksek gerilim hattıyla da bağlanabilir
    for (let z = fp.z - 1; z <= fp.z + fp.sz; z++) for (let x = fp.x - 1; x <= fp.x + fp.sx; x++) if (inB(x, z) && (s.power[idx(x, z)] || s.road[idx(x, z)])) road = true;
  }
  if (!road && !def.noRoad) return { ...res, ok: false, msg: 'Önü bir yola bakmalı' };
  if (def.place === 'shore' && !water) return { ...res, ok: false, msg: 'Kıyıya (suya bitişik) yerleştirilmeli' };
  if (def.cost > s.money) return { ...res, ok: false, msg: 'Yetersiz para' };
  return res;
}

export function placeService(s, key, hx, hz, f) {
  const v = validateService(s, key, hx, hz, f);
  if (!v.ok) return v;
  const def = SERVICES[key]; const fp = v.fp;
  // çakışan imar binalarını kaldır
  for (let z = fp.z; z < fp.z + fp.sz; z++) for (let x = fp.x; x < fp.x + fp.sx; x++) {
    const i = idx(x, z); const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null;
    if (b) removeBuilding(s, b, false);
    s.zone[i] = 0;
  }
  // araziyi düzle
  let avg = 0, n = 0;
  for (let z = fp.z; z <= fp.z + fp.sz; z++) for (let x = fp.x; x <= fp.x + fp.sx; x++) { avg += s.vh[vidx(x, z)]; n++; }
  avg = Math.max(0.3, avg / n);
  for (let z = fp.z; z < fp.z + fp.sz; z++) for (let x = fp.x; x < fp.x + fp.sx; x++) flattenCell(s, x, z, avg);
  const b = makeBuilding(s, 'svc', key, fp.x, fp.z, fp.w, fp.d, f);
  b.access = accessCell(s, b);
  b.connected = def.noRoad ? true : b.access >= 0 && !!s.rt.conn?.[b.access];
  s.money -= def.cost;
  addXP(s, def.xp || 0);
  const d = s.rt.dirty; d.terrain = true; d.trees = true; d.zones = true; d.overlay = true; d.cand = true; d.roads = true;
  if (def.station || def.depot) d.lines = true;
  return { ok: true, b };
}

export function buyUpgrade(s, b, key) {
  const def = SERVICES[b.type]; const u = (def.upgrades || []).find((q) => q.key === key);
  if (!u || b.upgrades.includes(key)) return { ok: false };
  if (u.cost > s.money) return { ok: false, msg: 'Yetersiz para' };
  s.money -= u.cost; b.upgrades.push(key); b._parts = null;
  s.rt.dirty.buildings = true; s.rt.dirty.cov = true;
  return { ok: true };
}

// ---------------- YIKIM ----------------
export function bulldozeCell(s, x, z, mode = 'all') {
  if (!inB(x, z)) return { ok: false };
  const i = idx(x, z);
  const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null;
  if (b && mode !== 'road') {
    if (b.kind === 'svc') s.money += Math.round((SERVICES[b.type].cost || 0) * 0.25);
    removeBuilding(s, b, b.kind === 'zone');
    s.rt.dirty.roads = true; s.rt.dirty.lines = true;
    return { ok: true, what: 'building' };
  }
  if (s.road[i] && mode !== 'building') return removeRoads(s, [[x, z]]);
  if (s.rail[i] === 1) return removeNetwork(s, 'train', [[x, z]]);
  if (s.power[i]) return removeNetwork(s, 'power', [[x, z]]);
  if (s.tree[i]) { s.tree[i] = 0; s.rt.dirty.trees = true; return { ok: true }; }
  return { ok: false };
}

// ---------------- HARİTA KAROLARI ----------------
export function canBuyTile(s, t) {
  if (s.owned[t]) return [false, 'Zaten sahipsiniz'];
  if (ownedTiles(s) >= allowedTiles(s)) return [false, 'Daha fazla karo için kilometre taşı gerekli'];
  const tx = t % TILES, tz = (t / TILES) | 0;
  const adj = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const nx = tx + dx, nz = tz + dz; return nx >= 0 && nz >= 0 && nx < TILES && nz < TILES && s.owned[nz * TILES + nx]; });
  if (!adj) return [false, 'Sahip olunan bir karoya komşu olmalı'];
  if (tileCost(s) > s.money) return [false, 'Yetersiz para'];
  return [true, ''];
}
export function buyTile(s, t) {
  const [ok, msg] = canBuyTile(s, t); if (!ok) return { ok, msg };
  s.money -= tileCost(s); s.owned[t] = 1;
  s.rt.dirty.roads = true; s.rt.dirty.overlay = true; s.rt.dirty.terrain = true;
  return { ok: true };
}

// ---------------- ARAZİ DÜZENLEME ----------------
export function terraform(s, hx, hz, mode, radius = 2, strength = 0.8) {
  const cost = 40 * radius * radius;
  if (s.money < cost) return { ok: false, msg: 'Yetersiz para' };
  const cxv = hx + 0.5, czv = hz + 0.5; let target = 0, tn = 0;
  for (let z = hz - radius; z <= hz + radius + 1; z++) for (let x = hx - radius; x <= hx + radius + 1; x++) if (x >= 0 && z >= 0 && x <= N && z <= N) { target += s.vh[vidx(x, z)]; tn++; }
  target /= tn || 1;
  if (s.rt.levelTarget !== undefined && mode === 'level') target = s.rt.levelTarget;
  let changed = 0;
  for (let z = hz - radius; z <= hz + radius + 1; z++) for (let x = hx - radius; x <= hx + radius + 1; x++) {
    if (x < 0 || z < 0 || x > N || z > N) continue;
    const d = Math.hypot(x - cxv, z - czv); if (d > radius + 0.6) continue;
    // binaların/yolların köşelerini değiştirme
    let blocked = false;
    for (const [ax, az] of [[x - 1, z - 1], [x, z - 1], [x - 1, z], [x, z]]) {
      if (!inB(ax, az)) continue; const i = idx(ax, az);
      if (s.road[i] || s.bld[i] >= 0 || s.rail[i] || !ownedCell(s, ax, az)) blocked = true;
    }
    if (blocked) continue;
    const fall = 1 - d / (radius + 0.6);
    const v = vidx(x, z);
    if (mode === 'raise') s.vh[v] += strength * fall;
    else if (mode === 'lower') s.vh[v] -= strength * fall;
    else if (mode === 'level') s.vh[v] += (target - s.vh[v]) * 0.5 * fall;
    else if (mode === 'smooth') s.vh[v] += (target - s.vh[v]) * 0.2 * fall;
    s.vh[v] = clamp(s.vh[v], -8, 80);
    changed++;
  }
  // su hücrelerini güncelle
  for (let z = hz - radius - 1; z <= hz + radius + 1; z++) for (let x = hx - radius - 1; x <= hx + radius + 1; x++) {
    if (!inB(x, z)) continue; const i = idx(x, z);
    const h = (s.vh[vidx(x, z)] + s.vh[vidx(x + 1, z)] + s.vh[vidx(x, z + 1)] + s.vh[vidx(x + 1, z + 1)]) / 4;
    const w = h < -0.8 ? 1 : 0;
    if (w !== s.water[i] && !s.road[i]) { s.water[i] = w; if (w) { s.zone[i] = 0; s.tree[i] = 0; } s.rt.waterChanged = true; }
  }
  if (!changed) return { ok: false };
  s.money -= cost;
  s.rt.dirty.terrain = true; s.rt.dirty.trees = true;
  if (s.rt.waterChanged) { s.rt.waterChanged = false; s.rt.dirty.roads = true; s.rt.dirty.util = true; s.rt.needWaterDist = true; }
  return { ok: true };
}

export function plantTrees(s, hx, hz, radius = 1, remove = false) {
  let n = 0;
  for (let z = hz - radius; z <= hz + radius; z++) for (let x = hx - radius; x <= hx + radius; x++) {
    if (!inB(x, z)) continue; const i = idx(x, z);
    if (remove) { if (s.tree[i]) { s.tree[i] = 0; n++; } continue; }
    if (s.water[i] || s.road[i] || s.bld[i] >= 0 || s.rail[i] || !ownedCell(s, x, z)) continue;
    if (s.tree[i] < 3 && Math.random() < 0.7) { s.tree[i]++; n++; }
  }
  const cost = remove ? 0 : n * 15;
  s.money -= cost; s.rt.dirty.trees = true;
  return { ok: n > 0, n };
}

// ---------------- İLÇELER ----------------
const DCOLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ff6b81', '#7f8c8d', '#c0392b'];
export function createDistrict(s, name) {
  const id = (s.districts.reduce((m, d) => Math.max(m, d.id), 0) || 0) + 1;
  if (id > 250) return null;
  const d = { id, name: name || `İlçe ${id}`, color: DCOLORS[(id - 1) % DCOLORS.length], policies: {}, cells: 0 };
  s.districts.push(d); return d;
}
export function paintDistrict(s, cells, id) {
  for (const [x, z] of cells) { if (!inB(x, z)) continue; s.district[idx(x, z)] = id; }
  for (const d of s.districts) d.cells = 0;
  for (let i = 0; i < N * N; i++) if (s.district[i]) { const d = s.districts.find((q) => q.id === s.district[i]); if (d) d.cells++; }
  for (const bid in s.buildings) { const b = s.buildings[bid]; b.district = s.district[idx(b.x, b.z)]; }
  s.rt.dirty.overlay = true;
}
export function deleteDistrict(s, id) {
  s.districts = s.districts.filter((d) => d.id !== id);
  for (let i = 0; i < N * N; i++) if (s.district[i] === id) s.district[i] = 0;
  s.rt.dirty.overlay = true;
}

export { ZONES };
