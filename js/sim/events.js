// Yangınlar ve doğal afetler (hortum, yıldırım, orman yangını)
import { N, idx, inB, worldX, worldZ, CS } from '../core/constants.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { FEATURES } from '../data/progression.js';
import { bCov } from './coverage.js';
import { findPath, perimeter } from './network.js';

export function startFire(s, b, cause = 'fire') {
  if (b.fire || b.collapsed) return;
  b.fire = 1; b.fireStart = s.time.tick;
  s.rt.dirty.icons = true;
  s.rt.events.push({ type: cause, b: b.id });
  // itfaiye aracı gönder
  const fc = bCov(s, b, 'fire');
  if (fc > 0.05) dispatchFrom(s, b, (d) => d.svc && d.svc.type === 'fire', 'fire');
  b.fireCovered = fc;
}

export function dispatchFrom(s, target, pred, kind) {
  if (target.access === undefined || target.access < 0) return;
  let best = null, bd = 1e9;
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc') continue;
    const d = SERVICES[b.type]; if (!pred(d)) continue;
    const dd = Math.abs(b.x - target.x) + Math.abs(b.z - target.z);
    if (dd < bd) { bd = dd; best = b; }
  }
  if (!best) return;
  const st = perimeter(best).find((c) => s.road[c]);
  if (st === undefined) return;
  const path = findPath(s, st, target.access, 'service', 6000);
  if (path) s.rt.vehicleSpawn.push({ path, kind, target: target.id });
}

// Her tik
export function fireTick(s) {
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (!b.fire) continue;
    b.fire++;
    const covered = (b.fireCovered || 0) > 0.05;
    const putOut = covered ? 25 + 40 / Math.max(0.2, b.fireCovered) : 1e9;
    if (b.fire > putOut) { b.fire = 0; s.rt.dirty.icons = true; continue; }
    if (b.fire > 90) {
      b.fire = 0; b.collapsed = s.time.monthsElapsed || 1; b.hh = 0; b.emp = 0;
      b._parts = null; s.rt.dirty.buildings = true; s.rt.dirty.icons = true;
      s.rt.events.push({ type: 'collapsed', b: b.id });
      continue;
    }
    // yayılma
    if (!covered && b.fire > 30 && Math.random() < 0.004) {
      for (const c of perimeter(b)) {
        const o = s.bld[c] >= 0 ? s.buildings[s.bld[c]] : null;
        if (o && !o.fire && !o.collapsed && Math.random() < 0.3) { startFire(s, o); break; }
        if (s.tree[c] && Math.random() < 0.2) s.rt.forestFire.add(c);
      }
    }
  }
  // orman yangınları
  if (s.rt.forestFire.size) {
    const next = [];
    for (const c of s.rt.forestFire) {
      const x = c % N, z = (c / N) | 0;
      if (Math.random() < 0.04) {
        s.tree[c] = Math.max(0, s.tree[c] - 1); s.rt.dirty.trees = true;
        if (!s.tree[c]) { s.rt.forestFire.delete(c); continue; }
      }
      // helikopter/itfaiye kapsamı söndürür
      if (s.cov.fire[c] > 0.3 && Math.random() < 0.05) { s.rt.forestFire.delete(c); continue; }
      if (Math.random() < 0.02) {
        const nx = x + ((Math.random() * 3) | 0) - 1, nz = z + ((Math.random() * 3) | 0) - 1;
        if (inB(nx, nz)) {
          const j = idx(nx, nz);
          if (s.tree[j]) next.push(j);
          const o = s.bld[j] >= 0 ? s.buildings[s.bld[j]] : null;
          if (o && Math.random() < 0.2) startFire(s, o);
        }
      }
    }
    for (const j of next) if (s.rt.forestFire.size < 400) s.rt.forestFire.add(j);
  }
  tornadoTick(s);
}

// Periyodik: yangın çıkma olasılığı
export function fireRisk(s) {
  const dry = s.weather.temp > 22 && s.weather.rain < 0.1 ? 1.5 : 1;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.built < 1 || b.collapsed || b.fire) continue;
    if (b.kind === 'svc' && ['parks', 'landmarks'].includes(SERVICES[b.type].cat) && !SERVICES[b.type].sig) continue;
    const fc = bCov(s, b, 'fire');
    let risk = 0.00022 * (1 - Math.min(0.92, fc * 1.3)) * dry;
    if (b.kind === 'zone' && ZONES[b.type].group === 'I') risk *= 2;
    if (b.abandoned) risk *= 3;
    if (Math.random() < risk) startFire(s, b);
  }
  // fırtınada yıldırım
  if (s.settings.disasters && s.milestone >= FEATURES.disasters && s.weather.state === 'storm' && Math.random() < 0.08) lightning(s);
  // sıcak ve kuru yazda orman yangını
  if (s.settings.disasters && s.milestone >= FEATURES.disasters && dry > 1 && Math.random() < 0.01) {
    for (let k = 0; k < 30; k++) { const c = (Math.random() * N * N) | 0; if (s.tree[c] >= 2) { s.rt.forestFire.add(c); s.rt.events.push({ type: 'forestfire', cell: c }); break; } }
  }
}

export function lightning(s, cell) {
  if (cell === undefined) cell = (Math.random() * N * N) | 0;
  s.rt.flash = 1; s.rt.lightningAt = cell;
  const b = s.bld[cell] >= 0 ? s.buildings[s.bld[cell]] : null;
  if (b) startFire(s, b, 'lightning');
  else if (s.tree[cell]) s.rt.forestFire.add(cell);
}

// Aylık: hortum olasılığı
export function disasterMonthly(s) {
  if (!s.settings.disasters || s.milestone < FEATURES.disasters) return;
  const m = s.time.month;
  const p = m >= 3 && m <= 8 ? 0.035 : 0.01;
  if (Math.random() < p) spawnTornado(s);
}

export function spawnTornado(s, x, z) {
  const side = (Math.random() * 4) | 0;
  if (x === undefined) {
    x = side === 0 ? 0 : side === 1 ? N - 1 : Math.random() * N;
    z = side === 2 ? 0 : side === 3 ? N - 1 : Math.random() * N;
  }
  const tx = N / 2 + (Math.random() - 0.5) * N * 0.4, tz = N / 2 + (Math.random() - 0.5) * N * 0.4;
  const len = Math.hypot(tx - x, tz - z) || 1;
  const warned = !!s.rt.cityEffect.warning;
  s.rt.tornado = { x, z, dx: (tx - x) / len * 0.35, dz: (tz - z) / len * 0.35, ttl: 500, warned };
  s.rt.events.push({ type: 'tornado', warned });
}

function tornadoTick(s) {
  const t = s.rt.tornado; if (!t) return;
  t.x += t.dx + (Math.random() - 0.5) * 0.3; t.z += t.dz + (Math.random() - 0.5) * 0.3; t.ttl--;
  if (t.ttl <= 0 || !inB(t.x | 0, t.z | 0)) { s.rt.tornado = null; return; }
  const r = 2;
  for (let z = (t.z - r) | 0; z <= t.z + r; z++) for (let x = (t.x - r) | 0; x <= t.x + r; x++) {
    if (!inB(x, z)) continue;
    const i = idx(x, z);
    if (s.tree[i] && Math.random() < 0.3) { s.tree[i] = 0; s.rt.dirty.trees = true; }
    const b = s.bld[i] >= 0 ? s.buildings[s.bld[i]] : null;
    if (b && !b.collapsed && Math.random() < 0.25) {
      // sığınak ve erken uyarı kayıpları azaltır
      const sh = bCov(s, b, 'shelter');
      const lost = b.hh * (t.warned ? 0.02 : 0.1) * (1 - Math.min(1, sh));
      s.rt.deathsThisMonth += Math.round(lost * 2);
      b.collapsed = s.time.monthsElapsed || 1; b.hh = 0; b.emp = 0; b.fire = 0;
      b._parts = null; s.rt.dirty.buildings = true; s.rt.dirty.icons = true;
    }
  }
  void worldX; void worldZ; void CS;
}
