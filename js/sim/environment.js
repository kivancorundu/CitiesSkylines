// Kirlilik (toprak, hava, gürültü, su) ve arazi değeri
import { N, DIRS, idx, inB, clamp } from '../core/constants.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { ROADS } from '../data/roads.js';
import { jobCap } from './buildings.js';

function boxBlur(src, dst, r, tmp) {
  // ayrılabilir kutu bulanıklaştırma
  for (let z = 0; z < N; z++) {
    let acc = 0; const row = z * N;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, 0, N - 1)];
    for (let x = 0; x < N; x++) {
      tmp[row + x] = acc / (2 * r + 1);
      acc += src[row + clamp(x + r + 1, 0, N - 1)] - src[row + clamp(x - r, 0, N - 1)];
    }
  }
  for (let x = 0; x < N; x++) {
    let acc = 0;
    for (let z = -r; z <= r; z++) acc += tmp[clamp(z, 0, N - 1) * N + x];
    for (let z = 0; z < N; z++) {
      dst[z * N + x] = acc / (2 * r + 1);
      acc += tmp[clamp(z + r + 1, 0, N - 1) * N + x] - tmp[clamp(z - r, 0, N - 1) * N + x];
    }
  }
}

function districtHas(s, i, key) {
  const d = s.district[i]; if (!d) return false;
  const dd = s.districts.find((q) => q.id === d); return !!(dd && dd.policies && dd.policies[key]);
}

export function updatePollution(s) {
  const C = N * N;
  const rt = s.rt;
  const eG = rt.eG || (rt.eG = new Float32Array(C)), eA = rt.eA || (rt.eA = new Float32Array(C)), eN = rt.eN || (rt.eN = new Float32Array(C));
  const tmp = rt.blurTmp || (rt.blurTmp = new Float32Array(C)), out = rt.blurOut || (rt.blurOut = new Float32Array(C));
  eG.fill(0); eA.fill(0); eN.fill(0);
  const mgmt = s.policies.pollution_mgmt ? 0.65 : 1;
  const add = (b, g, a, n) => {
    const area = b.sx * b.sz;
    for (let z = b.z; z < b.z + b.sz; z++) for (let x = b.x; x < b.x + b.sx; x++) {
      const i = idx(x, z); eG[i] += g / area * 4; eA[i] += a / area * 4; eN[i] += n / area * 4;
    }
  };
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.built < 1 || b.abandoned || b.collapsed) continue;
    if (b.kind === 'zone') {
      const z = ZONES[b.type]; const area = b.sx * b.sz; const st = b.staffing ?? 1;
      if (z.group === 'I') {
        let g = 0.25, a = 0.35, n = 0.25;
        if (z.key === 'oil') { g = 0.45; a = 0.25; }
        if (z.key === 'ore') { g = 0.5; a = 0.1; n = 0.4; }
        if (z.key === 'forest') { g = 0.02; a = 0.02; n = 0.15; }
        if (z.key === 'agri') { g = 0.1; a = 0.01; n = 0.05; }
        if (b.kind === 'zone' && !z.special) { const lvlF = 1 - (b.level - 1) * 0.12; g *= lvlF; a *= lvlF; }
        let hn = districtHas(s, idx(b.x, b.z), 'heavy_traffic_ban') ? 0.6 : 1;
        add(b, g * area * st * mgmt, a * area * st * mgmt, n * area * st * hn);
      } else if (z.group === 'C') add(b, 0, 0, 0.08 * area);
      else if (z.group === 'O') add(b, 0, 0, 0.02 * area);
    } else {
      const d = SERVICES[b.type];
      if (d.pol) add(b, (d.pol.ground || 0) * b.eff * 3, (d.pol.air || 0) * b.eff * 3, (d.pol.noise || 0) * 3);
    }
  }
  // trafik kaynaklı
  for (let i = 0; i < C; i++) {
    const r = s.road[i]; if (!r) continue;
    const rd = ROADS[r]; const t = s.traffic[i] / rd.cap;
    let n = rd.noise * (0.2 + Math.min(1.5, t)) * 0.9, a = Math.min(1.5, t) * 0.12;
    if (s.roadUp[i] & 1) { n *= 0.6; a *= 0.7; }
    if (s.roadUp[i] & 4) n *= 0.8;
    if (districtHas(s, i, 'combustion_ban')) { a *= 0.3; n *= 0.6; }
    if (districtHas(s, i, 'speed_bumps')) n *= 0.8;
    eN[i] += n; eA[i] += a;
  }
  // ağaçlar havayı temizler
  for (let i = 0; i < C; i++) if (s.tree[i]) eA[i] -= 0.04 * s.tree[i];
  const relax = (field, src, r, scale, k) => {
    boxBlur(src, out, r, tmp);
    for (let i = 0; i < C; i++) field[i] = clamp(field[i] + (out[i] * scale - field[i]) * k, 0, 1.5);
  };
  relax(s.polG, eG, 2, 1.4, 0.15);
  relax(s.polA, eA, 6, 2.2, 0.3);
  relax(s.polN, eN, 2, 1.0, 0.5);
  // su kirliliği: kanalizasyon çıkışları ve su hücrelerinde yayılma
  const W = s.polW;
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc') continue;
    const d = SERVICES[b.type];
    if (d.waterPol && b._waterCell >= 0) W[b._waterCell] = Math.min(3, W[b._waterCell] + (b._used || 0) * d.waterPol * 0.02);
  }
  for (let it = 0; it < 3; it++) {
    tmp.set(W);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x; if (!s.water[i]) { W[i] = 0; continue; }
      let sm = tmp[i], c = 1;
      for (const [dx, dz] of DIRS) { const nx = x + dx, nz = z + dz; if (!inB(nx, nz)) continue; const j = nz * N + nx; if (s.water[j]) { sm += tmp[j]; c++; } }
      W[i] = (sm / c) * 0.985 + s.polG[i] * 0.002;
    }
  }
  s.rt.dirty.overlay = true;
}

export function computeWaterDist(s) {
  const C = N * N; const d = new Float32Array(C).fill(99); const q = [];
  for (let i = 0; i < C; i++) if (s.water[i]) { d[i] = 0; q.push(i); }
  let h = 0;
  while (h < q.length) {
    const i = q[h++]; const x = i % N, z = (i / N) | 0;
    if (d[i] >= 12) continue;
    for (const [dx, dz] of DIRS) { const nx = x + dx, nz = z + dz; if (!inB(nx, nz)) continue; const j = nz * N + nx; if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); } }
  }
  s.rt.waterDist = d;
}

export function updateLandValue(s) {
  const C = N * N; const c = s.cov;
  if (!s.rt.waterDist) computeWaterDist(s);
  const wd = s.rt.waterDist;
  // ticari yakınlık
  const comMap = s.rt.comMap || (s.rt.comMap = new Float32Array(C)); comMap.fill(0);
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.kind === 'zone' && ZONES[b.type].group === 'C' && b.built >= 1 && !b.abandoned) comMap[idx(b.x, b.z)] += jobCap(b) * 0.05;
    if (b.kind === 'svc') {
      const d = SERVICES[b.type];
      if (d.attract || d.happy) comMap[idx(b.x, b.z)] += ((d.attract || 0) + (d.happy || 0) * 2) * 0.1;
    }
  }
  const tmp = s.rt.blurTmp || (s.rt.blurTmp = new Float32Array(C)), out = s.rt.blurOut || (s.rt.blurOut = new Float32Array(C));
  boxBlur(comMap, out, 5, tmp);
  const lv = s.lv;
  for (let i = 0; i < C; i++) {
    if (s.water[i]) { lv[i] = 0; continue; }
    let v = 12
      + 10 * c.health[i] + 8 * c.police[i] + 6 * c.fire[i] + 5 * c.edu1[i] + 5 * c.edu2[i] + 4 * c.edu3[i] + 4 * c.edu4[i]
      + 18 * c.park[i] + 6 * c.telecom[i] + 4 * c.post[i] + 10 * c.transit[i] + 3 * c.welfare[i]
      + Math.max(0, 8 - wd[i]) * 1.6 + Math.min(14, out[i] * 6)
      - 28 * s.polG[i] - 16 * s.polA[i] - 12 * s.polN[i] - 10 * s.crimeMap[i];
    if (s.road[i] === 7) v += 8;
    if (s.roadUp[i] & 1) v += 4;
    if (s.roadUp[i] & 2) v += 2;
    if (s.tree[i]) v += 2;
    if (districtHas(s, i, 'gated')) v += 6;
    v = clamp(v, 0, 140);
    lv[i] += (v - lv[i]) * 0.25;
  }
  s.rt.dirty.overlay = true;
}
