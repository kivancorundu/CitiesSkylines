// Yol aracı geometrisi (CS2 modları): Düz, Kavisli, Sürekli, Izgara, Değiştir
// Zincir = ardışık hücreleri 8 yönlü komşu olan [x, z] dizisi
import { N, idx, inB, dir8Of } from '../core/constants.js';

// 8 bağlantılı Bresenham
export function rasterLine8(x0, z0, x1, z1) {
  const out = []; let x = x0, z = z0;
  const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0), sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
  let err = dx - dz;
  for (;;) {
    out.push([x, z]);
    if (x === x1 && z === z1) break;
    const e2 = 2 * err;
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
  }
  return out;
}

// 4 bağlantılı çizgi (borular, raylar: çapraz bağlantı yok)
export function rasterLine4(x0, z0, x1, z1) {
  const c8 = rasterLine8(x0, z0, x1, z1); const out = [c8[0]];
  for (let k = 1; k < c8.length; k++) {
    const [ax, az] = out[out.length - 1], [bx, bz] = c8[k];
    if (ax !== bx && az !== bz) out.push([bx, az]);
    out.push([bx, bz]);
  }
  return out;
}

// Noktalar dizisini (kesirli olabilir) zincire çevir
export function polyToChain(pts, four = false) {
  const out = [];
  for (let k = 0; k < pts.length; k++) {
    const p = [Math.round(pts[k][0]), Math.round(pts[k][1])];
    if (!out.length) { out.push(p); continue; }
    const last = out[out.length - 1];
    if (last[0] === p[0] && last[1] === p[1]) continue;
    const seg = four ? rasterLine4(last[0], last[1], p[0], p[1]) : rasterLine8(last[0], last[1], p[0], p[1]);
    for (let j = 1; j < seg.length; j++) out.push(seg[j]);
  }
  return (four ? out : smoothChain(out)).filter(([x, z]) => inB(x, z));
}

// Merdiven köşelerini kaldır: a→b→c dik dönüşü, a ile c çapraz komşuysa b atlanır
export function smoothChain(ch) {
  let out = ch;
  for (let pass = 0; pass < 2; pass++) {
    const r = [out[0]];
    for (let k = 1; k < out.length - 1; k++) {
      const a = r[r.length - 1], c = out[k + 1];
      if (Math.abs(a[0] - c[0]) === 1 && Math.abs(a[1] - c[1]) === 1) continue;
      r.push(out[k]);
    }
    if (out.length > 1) r.push(out[out.length - 1]);
    out = r;
  }
  return out;
}

export function bezier(p0, p1, p2, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    pts.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]);
  }
  return pts;
}

// Açı yapıştırma: başlangıçtan bitişe yönü 45° (veya 15°) katlarına yuvarla
export function snapAngle(a, b, stepDeg) {
  const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (!L) return b;
  const st = (stepDeg * Math.PI) / 180; const ang = Math.round(Math.atan2(dz, dx) / st) * st;
  return [Math.round(a[0] + Math.cos(ang) * L), Math.round(a[1] + Math.sin(ang) * L)];
}
export function snapLength(a, b, step) {
  const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz); if (!L || step <= 1) return b;
  const L2 = Math.max(step, Math.round(L / step) * step);
  return [Math.round(a[0] + (dx / L) * L2), Math.round(a[1] + (dz / L) * L2)];
}

// Mod ve tıklama noktalarından zincir listesi üret
// pts: tıklanan noktalar ([x,z]) – Düz/Sürekli: 2, Kavisli: 3, Izgara: 2 (köşeler)
export function chainsFor(mode, pts, opt = {}) {
  const four = !!opt.four;
  let chains = [];
  if (mode === 'curved' && pts.length >= 3) {
    const [p0, p1, p2] = pts; const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    chains.push(polyToChain(bezier(p0, p1, p2, Math.max(4, Math.ceil(L * 1.5))), four));
  } else if (mode === 'grid' && pts.length >= 2) {
    const [a, b] = pts; const sp = Math.max(3, opt.gridSpacing || 13);
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    for (let x = x0; x <= x1; x += sp) chains.push(rasterLine4(x, z0, x, z1));
    if ((x1 - x0) % sp) chains.push(rasterLine4(x1, z0, x1, z1));
    for (let z = z0; z <= z1; z += sp) chains.push(rasterLine4(x0, z, x1, z));
    if ((z1 - z0) % sp) chains.push(rasterLine4(x0, z1, x1, z1));
  } else if (pts.length >= 2) {
    const [a, b] = pts;
    chains.push(four ? rasterLine4(a[0], a[1], b[0], b[1]) : rasterLine8(a[0], a[1], b[0], b[1]));
  } else if (pts.length === 1) chains.push([pts[0]]);
  // paralel mod: normal yönünde kaydırılmış ikinci yol
  if (opt.parallel && mode !== 'grid' && pts.length >= 2) {
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1;
    const off = opt.parallelSpacing || 3; const nx = (-dz / L) * off, nz = (dx / L) * off;
    const sh = pts.map(([x, z]) => [x + nx, z + nz]);
    const more = chainsFor(mode, sh, { ...opt, parallel: false });
    chains = chains.concat(more);
  }
  return chains.map((c) => c.filter(([x, z]) => inB(x, z))).filter((c) => c.length);
}

// ----- bağlantı yardımcıları -----
export function linkCells(s, a, b) {
  const ax = a % N, az = (a / N) | 0, bx = b % N, bz = (b / N) | 0;
  const d = dir8Of(bx - ax, bz - az); if (d < 0) return;
  s.rConn[a] |= 1 << d; s.rConn[b] |= 1 << ((d + 4) % 8);
}
export function unlinkAll(s, i) {
  const m = s.rConn[i]; if (!m) return;
  const x = i % N, z = (i / N) | 0;
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  for (let d = 0; d < 8; d++) {
    if (!(m & (1 << d))) continue;
    const nx = x + D[d][0], nz = z + D[d][1]; if (!inB(nx, nz)) continue;
    s.rConn[idx(nx, nz)] &= ~(1 << ((d + 4) % 8));
  }
  s.rConn[i] = 0;
}

// Çapraz adım mevcut bir çapraz bağlantıyla kesişiyorsa kavşak hücresinden geçir
export function fixCrossings(s, chain) {
  const out = [chain[0]];
  for (let k = 1; k < chain.length; k++) {
    const [ax, az] = out[out.length - 1], [bx, bz] = chain[k];
    const dx = bx - ax, dz = bz - az;
    if (dx && dz) {
      const c1 = idx(bx, az), c2 = idx(ax, bz);
      const d12 = dir8Of(ax - bx, bz - az);
      if (s.road[c1] && s.road[c2] && d12 >= 0 && (s.rConn[c1] & (1 << d12))) out.push([bx, az]);
    }
    out.push([bx, bz]);
  }
  return out;
}

// ----- geri al -----
export function snapshotCells(s, set) {
  const rec = [];
  for (const i of set) rec.push([i, s.road[i], s.rConn[i], s.rElev[i], s.roadUp[i], s.zone[i], s.tree[i], s.rail[i]]);
  return rec;
}
export function restoreCells(s, rec) {
  for (const [i, r, c, e, u, z, t, rl] of rec) { s.road[i] = r; s.rConn[i] = c; s.rElev[i] = e; s.roadUp[i] = u; s.zone[i] = z; s.tree[i] = t; s.rail[i] = rl; }
}
export function neighborhood(chains) {
  const set = new Set();
  for (const ch of chains) for (const [x, z] of ch) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, z + dz)) set.add(idx(x + dx, z + dz));
  return set;
}
