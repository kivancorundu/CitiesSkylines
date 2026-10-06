// Bina oluşturma/kaldırma ve kapasite hesapları
import { idx, DIRS } from '../core/constants.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { STREET } from '../data/names.js';
import { pick } from '../core/rng.js';
import { attachNetworks } from './utilities.js';

export function dimsFor(w, d, f) { return f % 2 === 0 ? [d, w] : [w, d]; }

export function makeBuilding(s, kind, type, x, z, w, d, f) {
  const [sx, sz] = dimsFor(w, d, f);
  const b = {
    id: s.nextId++, kind, type, x, z, sx, sz, w, d, f,
    level: 1, lvlProg: 0, built: kind === 'zone' ? 0 : 1,
    hh: 0, emp: 0, seed: (Math.random() * 1e9) | 0,
    abandoned: false, collapsed: 0, fire: 0,
    power: true, water: true, sewage: true, connected: true,
    garbage: 0, crime: 0, sick: 0, dead: 0, happy: 60, prob: 0, probWhy: '',
    upgrades: [], stored: 0, eff: 1, staffing: 1, born: s.time.monthsElapsed,
  };
  if (kind === 'zone') {
    const zd = ZONES[type];
    b.name = `${pick(STREET)} Sok. No:${1 + ((Math.random() * 120) | 0)}`;
    if (zd.product) b.product = zd.product;
    else if (zd.group === 'I') b.product = pick(['goods', 'goods', 'food', 'paper', 'plastics', 'metals']);
    else if (zd.group === 'O') b.product = 'software';
  } else {
    b.name = SERVICES[type].name;
  }
  s.buildings[b.id] = b;
  for (let zz = z; zz < z + sz; zz++) for (let xx = x; xx < x + sx; xx++) {
    const i = idx(xx, zz); s.bld[i] = b.id; s.tree[i] = 0;
  }
  s.rt.dirty.buildings = true;
  if (kind === 'svc') { s.rt.dirty.util = true; s.rt.dirty.cov = true; }
  else attachNetworks(s, b);
  return b;
}

export function removeBuilding(s, b, keepZone = true) {
  for (let zz = b.z; zz < b.z + b.sz; zz++) for (let xx = b.x; xx < b.x + b.sx; xx++) {
    const i = idx(xx, zz); if (s.bld[i] === b.id) { s.bld[i] = -1; if (!keepZone) s.zone[i] = 0; }
  }
  delete s.buildings[b.id];
  if (s.rt.selected === b.id) s.rt.selected = null;
  s.rt.dirty.buildings = true; s.rt.dirty.zones = true; s.rt.dirty.cand = true;
  if (b.kind === 'svc') { s.rt.dirty.util = true; s.rt.dirty.cov = true; }
  s.rt.removed.push(b.id);
}

export function svcDef(b) { return b.kind === 'svc' ? SERVICES[b.type] : null; }
export function zoneDef(b) { return b.kind === 'zone' ? ZONES[b.type] : null; }

// Hane kapasitesi
export function hhCap(b) {
  if (b.kind === 'svc') { const d = SERVICES[b.type]; return d.sigHH ? d.sigHH : 0; }
  const z = ZONES[b.type]; if (z.group !== 'R') return 0;
  if (z.hhFixed) return z.hhFixed;
  return Math.max(1, Math.round(b.sx * b.sz * z.hh * (1 + 0.18 * (b.level - 1))));
}

// İş kapasitesi
export function jobCap(b) {
  if (b.kind === 'svc') {
    const d = SERVICES[b.type];
    let w = d.sigJobs || d.workers || 0;
    for (const u of b.upgrades) { const ud = (d.upgrades || []).find((q) => q.key === u); if (ud) w += Math.round((ud.upkeep || 0) / 60); }
    return w;
  }
  const z = ZONES[b.type]; if (!z.jobs) return 0;
  return Math.max(1, Math.round(b.sx * b.sz * z.jobs * (1 + 0.15 * (b.level - 1))));
}

export function bGroup(b) {
  if (b.kind === 'zone') return ZONES[b.type].group;
  const d = SERVICES[b.type];
  if (d.sig) return ZONES[d.sig].group;
  return 'S';
}

export function residents(b) {
  if (b.kind === 'zone') { const z = ZONES[b.type]; return b.hh * (z.hhSize || 2.5); }
  return b.hh * 2.4;
}

// Hizmet binasının kapasite ve yarıçapı (yükseltmeler dahil)
export function svcStats(b) {
  const d = SERVICES[b.type]; if (!d.svc) return null;
  let cap = d.svc.cap, radius = d.svc.radius;
  for (const u of b.upgrades) {
    const ud = (d.upgrades || []).find((q) => q.key === u); if (!ud) continue;
    if (ud.cap) cap += ud.cap; if (ud.radius) radius += ud.radius;
  }
  return { cap, radius, type: d.svc.type, str: d.svc.str, wireless: d.svc.wireless };
}

export function frontCells(b) {
  const f = DIRS[b.f], out = [];
  for (let z = b.z; z < b.z + b.sz; z++) for (let x = b.x; x < b.x + b.sx; x++) out.push([x + f[0], z + f[1]]);
  return out;
}
