// Bölgeleme, parsel üretimi, bina büyümesi, taşınma, seviye atlama ve terk edilme
import { N, DIRS, ZONE_DEPTH, idx, inB, tileOf } from '../core/constants.js';
import { ZONES } from '../data/zones.js';
import { ROADS } from '../data/roads.js';
import { SERVICES } from '../data/services.js';
import { makeBuilding, removeBuilding, hhCap } from './buildings.js';
import { accessCell } from './network.js';
import { shuffle } from './util.js';

// İmar edilebilir hücreler: zonable yollardan en fazla 6 hücre derinliğe kadar
export function computeZonable(s) {
  const C = N * N;
  const zd = s.rt.zdepth || (s.rt.zdepth = new Uint8Array(C));
  const zf = s.rt.zfront || (s.rt.zfront = new Int8Array(C));
  zd.fill(0); zf.fill(-1);
  for (let i = 0; i < C; i++) {
    const r = s.road[i]; if (!r || !ROADS[r].zonable) continue;
    const x = i % N, z = (i / N) | 0;
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIRS[d];
      for (let k = 1; k <= ZONE_DEPTH; k++) {
        const nx = x + dx * k, nz = z + dz * k; if (!inB(nx, nz)) break;
        const j = idx(nx, nz);
        if (s.road[j] || s.water[j] || !s.owned[tileOf(nx, nz)]) break;
        const b = s.bld[j] >= 0 ? s.buildings[s.bld[j]] : null;
        if (b && b.kind === 'svc') break;
        if (s.rail[j] === 1) break;
        if (zd[j] === 0 || k < zd[j]) { zd[j] = k; zf[j] = (d + 2) % 4; }
      }
    }
  }
  // artık imar edilemeyen bölgeleri temizle (bina yoksa)
  for (let i = 0; i < C; i++) if (s.zone[i] && !zd[i] && s.bld[i] < 0) s.zone[i] = 0;
  s.rt.dirty.zones = true;
  s.rt.dirty.overlay = true;
}

function rebuildCandidates(s) {
  const cand = {};
  for (const t in ZONES) cand[t] = [];
  const zd = s.rt.zdepth, zf = s.rt.zfront, conn = s.rt.conn;
  for (let i = 0; i < N * N; i++) {
    const t = s.zone[i];
    if (!t || s.bld[i] >= 0 || zd[i] !== 1) continue;
    const f = zf[i]; const x = i % N, z = (i / N) | 0;
    const ri = idx(x + DIRS[f][0], z + DIRS[f][1]);
    if (!conn[ri]) continue;
    cand[t].push(i);
  }
  s.rt.cand = cand;
  s.rt.dirty.cand = false;
}

function tryLot(s, t, c) {
  const zdef = ZONES[t];
  const zd = s.rt.zdepth, zf = s.rt.zfront;
  const f = zf[c]; const x0 = c % N, z0 = (c / N) | 0;
  const p = DIRS[(f + 1) % 4], back = DIRS[(f + 2) % 4];
  const [minW, maxW, minD, maxD] = zdef.lot;
  const ws = []; for (let w = maxW; w >= minW; w--) ws.push(w);
  const ds = []; for (let d = maxD; d >= minD; d--) ds.push(d);
  if (Math.random() < 0.35) shuffle(ws);
  shuffle(ds);
  for (const w of ws) for (const d of ds) {
    for (const off of [0, -(w - 1)]) {
      let ok = true; const cells = [];
      for (let a = 0; a < w && ok; a++) for (let bb = 0; bb < d && ok; bb++) {
        const x = x0 + p[0] * (a + off) + back[0] * bb, z = z0 + p[1] * (a + off) + back[1] * bb;
        if (!inB(x, z)) { ok = false; break; }
        const j = idx(x, z);
        if (s.zone[j] !== +t || s.bld[j] >= 0 || zd[j] !== bb + 1 || zf[j] !== f) { ok = false; break; }
        if (zdef.res && s.res[j] !== zdef.res) { ok = false; break; }
        cells.push([x, z]);
      }
      if (!ok) continue;
      let mx = 1e9, mz = 1e9; for (const [x, z] of cells) { if (x < mx) mx = x; if (z < mz) mz = z; }
      return { x: mx, z: mz, w, d, f };
    }
  }
  return null;
}

function demandFor(s, t) {
  const z = ZONES[t], D = s.demand;
  if (z.group === 'R') {
    if (z.key === 'res_low') return D.resLow;
    if (z.key === 'res_high') return D.resHigh;
    if (z.key === 'res_lowrent') return Math.max(D.resMed, D.resLow * 0.6);
    return D.resMed;
  }
  if (z.group === 'C') return z.density === 2 ? D.com * 0.8 : D.com;
  if (z.group === 'O') return D.off;
  return D.ind;
}

// Her tikte çağrılır
export function growthTick(s) {
  if (s.rt.dirty.cand || !s.rt.cand || s.time.tick % 30 === 0) rebuildCandidates(s);
  for (const t in ZONES) {
    const list = s.rt.cand[t]; if (!list || !list.length) continue;
    const D = demandFor(s, t);
    if (D <= 0.03) continue;
    if (Math.random() > Math.min(0.9, D * 0.55)) continue;
    for (let tries = 0; tries < 6; tries++) {
      const k = (Math.random() * list.length) | 0; const c = list[k];
      if (s.bld[c] >= 0 || s.zone[c] !== +t) { list[k] = list[list.length - 1]; list.pop(); if (!list.length) break; continue; }
      const lot = tryLot(s, t, c);
      if (!lot) continue;
      const b = makeBuilding(s, 'zone', +t, lot.x, lot.z, lot.w, lot.d, lot.f);
      b.access = accessCell(s, b);
      list[k] = list[list.length - 1]; list.pop();
      break;
    }
  }
  // inşaat, taşınma
  const resD = s.demand.res;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.kind === 'svc' && SERVICES[b.type].sig) {
      // imza konutları da yavaşça dolar
      const cap = hhCap(b);
      if (b.hh < cap && Math.random() < 0.2) b.hh++;
      continue;
    }
    if (b.kind !== 'zone') continue;
    if (b.built < 1) { b.built = Math.min(1, b.built + 0.03 + Math.random() * 0.02); if (b.built >= 1) s.rt.dirty.buildings = true; continue; }
    if (b.abandoned || b.collapsed) continue;
    const cap = hhCap(b);
    if (cap > 0) {
      if (b.hh < cap && b.connected && Math.random() < 0.03 + 0.25 * Math.max(0, resD) * (b.happy / 70)) b.hh++;
      else if (b.hh > cap) b.hh = cap;
      if (b.hh > 0 && b.happy < 25 && Math.random() < 0.004) b.hh--;
    }
  }
}

// Periyodik (10 tikte bir): seviye atlama, terk edilme
export function growthSlow(s) {
  const autoDemolish = s.settings.autoDemolish;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.kind !== 'zone' || b.built < 1) continue;
    const z = ZONES[b.type];
    if (b.collapsed) {
      if (s.time.monthsElapsed - b.collapsed > 2) removeBuilding(s, b, true);
      continue;
    }
    if (b.abandoned) {
      if (autoDemolish && s.time.monthsElapsed - b.abandoned > 4) removeBuilding(s, b, true);
      continue;
    }
    // sorunlar
    let issues = 0, why = [];
    if (!b.power) { issues++; why.push('Elektrik yok'); }
    if (!b.water) { issues++; why.push('Su yok'); }
    if (!b.sewage) { issues++; why.push('Kanalizasyon yok'); }
    // çöp ve cenaze doğrudan terk ettirmez; mutluluğu düşürür
    if (b.garbage > 80 && s.milestone >= 1) why.push('Çöp birikti');
    if (b.dead > 2 && s.milestone >= 1) why.push('Cenaze toplanmıyor');
    if (!b.connected) { issues += 2; why.push('Yol bağlantısı yok'); }
    if (z.group === 'R' && b.happy < 22) { issues++; why.push('Çok mutsuz'); }
    if (z.group !== 'R' && b.staffing < 0.25 && s.time.monthsElapsed - b.born > 3) { issues++; why.push('Çalışan yok'); }
    if (z.group === 'C' && s.rt.customerRatio < 0.35) { issues++; why.push('Müşteri yok'); }
    b.probWhy = why.join(', ');
    if (issues) b.prob += issues; else b.prob = Math.max(0, b.prob - 2);
    if (b.prob > 160) {
      b.abandoned = s.time.monthsElapsed || 1; b.hh = 0; b.emp = 0; b.prob = 0;
      s.rt.dirty.buildings = true;
      s.rt.events.push({ type: 'abandoned', b: b.id });
      continue;
    }
    // seviye atlama
    if (b.level < 5) {
      const lv = s.lv[idx(b.x, b.z)];
      let p = 0;
      if (z.group === 'R') p = (lv - 10 - b.level * 10) / 60 + (b.happy - 45 - b.level * 4) / 80;
      else if (z.group === 'C') p = (lv - 10 - b.level * 10) / 60 + (b.staffing - 0.7) + (s.rt.customerRatio - 0.8) * 0.5;
      else if (z.group === 'O') p = (lv - 15 - b.level * 10) / 60 + (b.staffing - 0.7) + (s.cov.telecom[idx(b.x, b.z)] - 0.3) * 0.5;
      else p = (b.staffing - 0.65) + (s.rt.eduAvg - 0.6 - b.level * 0.15) * 0.8;
      if (s.policies.high_tech_housing && z.group === 'R') p += 0.1;
      if (z.special) p = Math.min(p, 0.15);
      if (p > 0) {
        b.lvlProg += p * 0.03;
        if (b.lvlProg >= 1) {
          b.level++; b.lvlProg = 0; b._parts = null; s.rt.dirty.buildings = true;
          s.rt.events.push({ type: 'levelup', b: b.id });
        }
      } else b.lvlProg = Math.max(0, b.lvlProg + p * 0.01);
    }
  }
}

export function zoneCellOk(s, i, t) {
  const zd = s.rt.zdepth; if (!zd[i]) return false;
  const z = ZONES[t];
  if (z.res && s.res[i] !== z.res) return false;
  return true;
}
