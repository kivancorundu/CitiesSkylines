// Elektrik, su ve kanalizasyon şebekeleri
import { N, DIRS, idx, inB, clamp } from '../core/constants.js';
import { SERVICES } from '../data/services.js';
import { ZONES } from '../data/zones.js';
import { perimeter, footprint } from './network.js';
import { residents, jobCap, hhCap } from './buildings.js';

function label(s, isNode) {
  const C = N * N; const comp = new Int32Array(C).fill(-1); let n = 0;
  const stack = [];
  for (let i = 0; i < C; i++) {
    if (comp[i] >= 0 || !isNode(i)) continue;
    comp[i] = n; stack.push(i);
    while (stack.length) {
      const c = stack.pop(); const x = c % N, z = (c / N) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz; if (!inB(nx, nz)) continue;
        const j = nz * N + nx; if (comp[j] < 0 && isNode(j)) { comp[j] = n; stack.push(j); }
      }
    }
    n++;
  }
  return { comp, n };
}

function attach(s, b, comp) {
  for (const c of perimeter(b)) if (comp[c] >= 0) return comp[c];
  for (const c of footprint(b)) if (comp[c] >= 0) return comp[c];
  return -1;
}

// Ağ yapısı değiştiğinde çağrılır
export function computeNetworks(s) {
  const e = label(s, (i) => s.road[i] > 0 || s.power[i] > 0);
  const w = label(s, (i) => s.pipeW[i] > 0);
  const sw = label(s, (i) => s.pipeS[i] > 0);
  s.rt.net = { e, w, sw };
  const outsideE = new Set();
  for (let i = 0; i < N * N; i++) if (s.outside[i] && e.comp[i] >= 0) outsideE.add(e.comp[i]);
  s.rt.net.outsideE = outsideE;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    b._ec = attach(s, b, e.comp); b._wc = attach(s, b, w.comp); b._sc = attach(s, b, sw.comp);
    if (b.kind === 'svc') {
      const d = SERVICES[b.type];
      if (d.place === 'shore') {
        let wc = -1;
        for (const c of perimeter(b)) if (s.water[c]) { wc = c; break; }
        if (wc < 0) {
          // iki hücre uzaklığa kadar ara
          for (let z = b.z - 2; z < b.z + b.sz + 2 && wc < 0; z++) for (let x = b.x - 2; x < b.x + b.sx + 2; x++) if (inB(x, z) && s.water[idx(x, z)]) { wc = idx(x, z); break; }
        }
        b._waterCell = wc;
      }
    }
  }
}

export function powerUse(s, b) {
  if (b.abandoned || b.collapsed || b.built < 1) return 0;
  let u = 0;
  if (b.kind === 'zone') {
    const z = ZONES[b.type];
    u = b.hh * 0.004 + jobCap(b) * (z.group === 'I' ? 0.01 : z.group === 'O' ? 0.008 : 0.006) * (b.staffing ?? 1);
  } else {
    const d = SERVICES[b.type];
    if (d.prod && (d.prod.power || d.prod.battery)) return 0;
    u = 0.04 + (d.workers || 0) * 0.012 + hhCap(b) * 0.004 + (d.sigJobs || 0) * 0.007;
  }
  if (s.policies.energy_awareness) u *= 0.85;
  if (s.policies.high_tech_housing && b.district && s.districts.find((q) => q.id === b.district)?.policies?.high_tech_housing) u *= 0.8;
  if (s.weather.temp < 5) u *= 1 + (5 - s.weather.temp) * 0.02;
  return u;
}

export function waterUse(s, b) {
  if (b.abandoned || b.collapsed || b.built < 1) return 0;
  let u;
  if (b.kind === 'zone') u = residents(b) * 0.011 + jobCap(b) * 0.007 * (b.staffing ?? 1);
  else { const d = SERVICES[b.type]; if (d.prod && (d.prod.water || d.prod.sewage)) return 0; u = 0.02 + (d.workers || 0) * 0.01 + residents(b) * 0.011; }
  if (s.policies.water_awareness) u *= 0.85;
  if (s.weather.temp > 24) u *= 1.1;
  return u;
}

function prodPower(s, b, d) {
  let p = d.prod.power * b.eff;
  const i = idx(b.x, b.z);
  if (d.windDependent) p *= clamp(s.wind[i] * (0.4 + s.weather.windStrength * 1.1), 0.05, 1.4);
  if (d.solarDependent) p *= s.rt.daylight * (1 - s.weather.cloud * 0.6);
  return p;
}

// Her birkaç tikte: üretim/tüketim dağıtımı
export function allocateUtilities(s) {
  if (!s.rt.net) computeNetworks(s);
  const { e, w, sw, outsideE } = s.rt.net;
  const eP = new Float64Array(e.n), eC = new Float64Array(e.n);
  const wP = new Float64Array(w.n), wC = new Float64Array(w.n), wPol = new Float64Array(w.n);
  const sP = new Float64Array(sw.n), sC = new Float64Array(sw.n);
  const consumers = [];
  const batteries = [];
  let totP = 0, totC = 0, totWP = 0, totWC = 0, totSP = 0, totSC = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.kind === 'svc' && !b.collapsed) {
      const d = SERVICES[b.type];
      if (d.prod) {
        if (d.prod.power && b._ec >= 0) { const p = prodPower(s, b, d); eP[b._ec] += p; totP += p; b._out = p; }
        if (d.prod.battery && b._ec >= 0) batteries.push(b);
        if (d.prod.water && b._wc >= 0) {
          let p = d.prod.water * b.eff;
          if (d.groundwater) p *= clamp(s.gw[idx(b.x, b.z)] * 1.4, 0.1, 1.2);
          if (d.place === 'shore' && (b._waterCell ?? -1) < 0) p = 0;
          const pol = d.place === 'shore' && b._waterCell >= 0 ? s.polW[b._waterCell] * (1 - (d.filter || 0)) : 0;
          wP[b._wc] += p; wPol[b._wc] += p * pol; totWP += p; b._out = p;
        }
        if (d.prod.sewage && b._sc >= 0) {
          let p = d.prod.sewage * b.eff; if (d.place === 'shore' && (b._waterCell ?? -1) < 0) p = 0;
          sP[b._sc] += p; totSP += p; b._out = p;
        }
      }
    }
    const pu = powerUse(s, b), wu = waterUse(s, b);
    b._pu = pu; b._wu = wu;
    if (pu > 0 || wu > 0) consumers.push(b);
    if (b._ec >= 0) eC[b._ec] += pu;
    if (b._wc >= 0) wC[b._wc] += wu;
    if (b._sc >= 0) sC[b._sc] += wu * 0.95;
    totC += pu; totWC += wu; totSC += wu * 0.95;
  }
  // bataryalar
  const dtH = 1;
  for (const b of batteries) {
    const c = b._ec; const cap = SERVICES[b.type].prod.battery * b.eff;
    let ch = s.battery[b.id] || 0;
    const bal = eP[c] - eC[c];
    if (bal > 0) { const add = Math.min(bal, 10, cap - ch); ch += add * 0.05 * dtH; eP[c] -= add * 0.5; }
    else if (bal < 0 && ch > 0) { const out = Math.min(-bal, 10, ch * 4); eP[c] += out; ch -= out * 0.05; }
    s.battery[b.id] = clamp(ch, 0, cap);
  }
  // dış bağlantı: ithalat/ihracat
  let imp = 0, exp = 0;
  for (const c of outsideE) {
    const bal = eP[c] - eC[c];
    if (bal < 0) { const m = Math.min(-bal, 80); eP[c] += m; imp += m; }
    else if (bal > 0) { const m = Math.min(bal, 40); exp += m; }
  }
  // dağıtım (yeterli değilse bina kimliği sırasıyla)
  const eUsed = new Float64Array(e.n), wUsed = new Float64Array(w.n), sUsed = new Float64Array(sw.n);
  let unpowered = 0, unwatered = 0, unsewered = 0;
  for (const b of consumers) {
    const wasP = b.power, wasW = b.water, wasS = b.sewage;
    if (b._pu > 0) {
      if (b._ec >= 0 && eUsed[b._ec] + b._pu <= eP[b._ec] + 1e-6) { eUsed[b._ec] += b._pu; b.power = true; } else { b.power = false; unpowered++; }
    } else b.power = true;
    if (b._wu > 0) {
      if (b._wc >= 0 && wUsed[b._wc] + b._wu <= wP[b._wc] + 1e-6) { wUsed[b._wc] += b._wu; b.water = true; } else { b.water = false; unwatered++; }
      if (b._sc >= 0 && sUsed[b._sc] + b._wu * 0.95 <= sP[b._sc] + 1e-6) { sUsed[b._sc] += b._wu * 0.95; b.sewage = true; } else { b.sewage = false; unsewered++; }
      b.waterPol = b._wc >= 0 && wP[b._wc] > 0 ? wPol[b._wc] / wP[b._wc] : 0;
    } else { b.water = true; b.sewage = true; b.waterPol = 0; }
    if (wasP !== b.power || wasW !== b.water || wasS !== b.sewage) s.rt.dirty.icons = true;
  }
  // tesislerin gerçek kullanımı (atık su kirliliği için)
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc') continue;
    const d = SERVICES[b.type];
    if (d.prod && d.prod.sewage && b._sc >= 0 && sP[b._sc] > 0) b._used = (b._out || 0) * Math.min(1, sUsed[b._sc] / sP[b._sc]);
  }
  s.stats.power = { prod: totP, cons: totC, imp, exp, unserved: unpowered };
  s.stats.water = { prod: totWP, cons: totWC, unserved: unwatered };
  s.stats.sewage = { prod: totSP, cons: totSC, unserved: unsewered };
}
