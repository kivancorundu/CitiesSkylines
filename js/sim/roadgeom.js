// Pürüzsüz yol geometrisi (CS2 tarzı): her yol bir eğri şerit (segment) olarak saklanır.
// Segment = 2 m aralıklı örnek noktaları (hücre koordinatında, hücre merkezi = x + 0.5).
// Simülasyon, örneklerin geçtiği hücreleri yol hücresi olarak kullanır.
import { N, idx, inB, eachRoadNbr } from '../core/constants.js';
import { rasterLine8, bezier } from './roadtool.js';

export const STEP = 0.25; // hücre (2 m)

// Keskin köşeleri küçük bir yay ile yuvarla
export function roundCorners(pts, r = 0.9) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) {
    const a = pts[k - 1], b = pts[k], c = pts[k + 1];
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2);
    if (cos > 0.94) { out.push(b); continue; } // ~20° altı: köşe yok
    const d = Math.min(r, l1 * 0.45, l2 * 0.45);
    const p0 = [b[0] - (v1[0] / l1) * d, b[1] - (v1[1] / l1) * d], p2 = [b[0] + (v2[0] / l2) * d, b[1] + (v2[1] / l2) * d];
    for (const q of bezier(p0, b, p2, 6)) out.push(q);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Çizgiyi eşit aralıklarla yeniden örnekle
export function resample(pts, step = STEP) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0].slice()];
  let carry = 0;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-9) continue;
    let t = step - carry;
    while (t <= L + 1e-9) { out.push([a[0] + (b[0] - a[0]) * (t / L), a[1] + (b[1] - a[1]) * (t / L)]); t += step; }
    carry = L - (t - step);
  }
  const last = pts[pts.length - 1], lo = out[out.length - 1];
  if (Math.hypot(last[0] - lo[0], last[1] - lo[1]) > step * 0.3) out.push(last.slice()); else out[out.length - 1] = last.slice();
  return out;
}

export const cellOfPt = (p) => idx(Math.min(N - 1, Math.max(0, Math.floor(p[0]))), Math.min(N - 1, Math.max(0, Math.floor(p[1]))));

// Örnek noktalarından 8 bağlantılı hücre zinciri
export function samplesToChain(samples) {
  const out = [];
  for (const p of samples) {
    const x = Math.floor(p[0]), z = Math.floor(p[1]);
    if (!inB(x, z)) continue;
    const last = out[out.length - 1];
    if (last && last[0] === x && last[1] === z) continue;
    if (last && (Math.abs(last[0] - x) > 1 || Math.abs(last[1] - z) > 1)) {
      const seg = rasterLine8(last[0], last[1], x, z);
      for (let k = 1; k < seg.length - 1; k++) out.push(seg[k]);
    }
    out.push([x, z]);
  }
  return out;
}

// Tıklama noktalarından (hücre tamsayıları) çizgi geometrileri üret (hücre merkezli kayan noktalı)
export function geomsFor(mode, pts, opt = {}) {
  const C = (p) => [p[0] + 0.5, p[1] + 0.5];
  let geoms = [];
  if (mode === 'curved' && pts.length >= 3) {
    const [p0, p1, p2] = pts.map(C);
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    geoms.push(bezier(p0, p1, p2, Math.max(8, Math.ceil(L * 3))));
  } else if (mode === 'grid' && pts.length >= 2) {
    const [a, b] = pts; const sp = Math.max(3, opt.gridSpacing || 13);
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    const xs = []; for (let x = x0; x <= x1; x += sp) xs.push(x); if (xs[xs.length - 1] !== x1) xs.push(x1);
    const zs = []; for (let z = z0; z <= z1; z += sp) zs.push(z); if (zs[zs.length - 1] !== z1) zs.push(z1);
    for (const x of xs) geoms.push([C([x, z0]), C([x, z1])]);
    for (const z of zs) geoms.push([C([x0, z]), C([x1, z])]);
  } else if (pts.length >= 2) {
    geoms.push([C(pts[0]), C(pts[1])]);
  } else if (pts.length === 1) geoms.push([C(pts[0]), C(pts[0])]);
  if (opt.parallel && mode !== 'grid' && pts.length >= 2) {
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b[0] - a[0], dz = b[1] - a[1]; const L = Math.hypot(dx, dz) || 1;
    const off = opt.parallelSpacing || 3; const nx = (-dz / L) * off, nz = (dx / L) * off;
    geoms = geoms.concat(geomsFor(mode, pts.map(([x, z]) => [x + nx, z + nz]), { ...opt, parallel: false }));
  }
  return geoms;
}

// Geometri → örnekler (köşe yuvarlama + yeniden örnekleme) ve hücre zinciri
export function prepareGeom(g) {
  const samples = resample(roundCorners(g), STEP).filter((p) => p[0] >= 0 && p[1] >= 0 && p[0] < N && p[1] < N);
  return { samples, chain: samplesToChain(samples) };
}

// Uç noktayı mevcut bir yol şeridine yapıştır (kusursuz T kavşaklar için)
export function snapToSegs(s, p, radius = 0.85) {
  let best = null, bd = radius * radius;
  for (const sg of s.segs || []) {
    const a = sg.p;
    for (let k = 0; k < a.length; k += 2) {
      const dx = a[k] - p[0], dz = a[k + 1] - p[1]; const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = [a[k], a[k + 1]]; }
    }
  }
  return best;
}

let nextSegId = 1;
export function addSeg(s, samples) {
  if (!s.segs) s.segs = [];
  if (samples.length < 2) return null;
  const p = new Array(samples.length * 2);
  for (let k = 0; k < samples.length; k++) { p[k * 2] = Math.round(samples[k][0] * 100) / 100; p[k * 2 + 1] = Math.round(samples[k][1] * 100) / 100; }
  nextSegId = Math.max(nextSegId, ...s.segs.map((q) => q.id + 1), 1);
  const sg = { id: nextSegId++, p };
  s.segs.push(sg);
  return sg;
}

// Artık yol olmayan hücrelerdeki örnekleri at; segmentleri boşluklardan böl
export function pruneSegs(s) {
  if (!s.segs) { s.segs = []; return; }
  const out = [];
  for (const sg of s.segs) {
    let run = [];
    const flush = () => { if (run.length >= 4) out.push({ id: out.length + 1, p: run }); run = []; };
    for (let k = 0; k < sg.p.length; k += 2) {
      const c = cellOfPt([sg.p[k], sg.p[k + 1]]);
      if (s.road[c]) run.push(sg.p[k], sg.p[k + 1]); else flush();
    }
    flush();
  }
  out.forEach((q, i) => (q.id = i + 1));
  s.segs = out;
}

// Hiçbir segmentin geçmediği yol hücreleri için (eski kayıtlar, başlangıç otoyolu) bağlantılardan şerit çıkar
export function traceUncovered(s) {
  if (!s.segs) s.segs = [];
  const C = N * N; const cov = new Uint8Array(C);
  for (const sg of s.segs) for (let k = 0; k < sg.p.length; k += 2) cov[cellOfPt([sg.p[k], sg.p[k + 1]])] = 1;
  const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const usedEdge = new Set();
  const ek = (a, b) => (a < b ? a * C + b : b * C + a);
  const nbrs = (i) => { const m = s.rConn[i], out = []; const x = i % N, z = (i / N) | 0; for (let d = 0; d < 8; d++) if (m & (1 << d)) { const nx = x + D[d][0], nz = z + D[d][1]; if (inB(nx, nz)) out.push(nz * N + nx); } return out; };
  const deg = (i) => nbrs(i).length;
  const walk = (start, next) => {
    const path = [start, next]; usedEdge.add(ek(start, next));
    let prev = start, cur = next;
    while (deg(cur) === 2 && !cov[cur]) {
      const n2 = nbrs(cur).find((j) => j !== prev && !usedEdge.has(ek(cur, j)));
      if (n2 === undefined) break;
      usedEdge.add(ek(cur, n2)); path.push(n2); prev = cur; cur = n2;
    }
    return path;
  };
  const make = (path) => {
    if (!path.some((c) => !cov[c])) return;
    const pts = path.map((c) => [(c % N) + 0.5, ((c / N) | 0) + 0.5]);
    addSeg(s, relaxSamples(s, resample(roundCorners(simplifyCells(pts)), STEP)));
  };
  for (let i = 0; i < C; i++) {
    if (!s.road[i] || cov[i]) continue;
    const ns = nbrs(i);
    if (!ns.length) { addSeg(s, [[(i % N) + 0.3, ((i / N) | 0) + 0.5], [(i % N) + 0.7, ((i / N) | 0) + 0.5]]); continue; }
    if (deg(i) === 2) continue;
    for (const j of ns) if (!usedEdge.has(ek(i, j))) make(walk(i, j));
  }
  // döngüler / kalanlar
  for (let i = 0; i < C; i++) {
    if (!s.road[i] || cov[i]) continue;
    for (const j of nbrs(i)) if (!usedEdge.has(ek(i, j))) make(walk(i, j));
  }
}

// Eski (hücre tabanlı) yollar için: merdiven basamaklarını düzleştir (yalnızca köşe noktaları kalsın)
function simplifyCells(pts) {
  if (pts.length < 3) return pts;
  // ardışık kısa basamakları birleştir: yön değişimlerinin orta noktalarını köşe say
  const out = [pts[0]];
  for (let k = 1; k < pts.length - 1; k++) {
    const a = pts[k - 1], b = pts[k], c = pts[k + 1];
    const d1x = Math.sign(b[0] - a[0]), d1z = Math.sign(b[1] - a[1]), d2x = Math.sign(c[0] - b[0]), d2z = Math.sign(c[1] - b[1]);
    if (d1x !== d2x || d1z !== d2z) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Örnekleri komşu ortalamasıyla gevşet; uçlar sabit, hiçbir örnek yol olmayan hücreye taşmaz
export function relaxSamples(s, sm, passes = 12) {
  const n = sm.length; if (n < 5) return sm;
  let P = sm.map((p) => p.slice());
  for (let it = 0; it < passes; it++) {
    const Q = P.map((p) => p.slice());
    for (let k = 2; k < n - 2; k++) {
      const x = (P[k - 2][0] + P[k - 1][0] * 2 + P[k][0] * 2 + P[k + 1][0] * 2 + P[k + 2][0]) / 8;
      const z = (P[k - 2][1] + P[k - 1][1] * 2 + P[k][1] * 2 + P[k + 1][1] * 2 + P[k + 2][1]) / 8;
      if (s.road[cellOfPt([x, z])]) { Q[k][0] = x; Q[k][1] = z; }
    }
    P = Q;
  }
  return resample(P, STEP);
}

// "Değiştir" aracı: iki kavşak arasındaki yol parçası (CS2'deki gibi tek tıkla tüm parça)
export function roadStretch(s, i) {
  if (!s.road[i]) return [];
  const deg = (c) => { let n = 0; eachRoadNbr(s, c, (j) => { if (s.road[j]) n++; }); return n; };
  if (deg(i) !== 2) return [i];
  const seen = new Set([i]); const out = [i];
  const stack = [i];
  while (stack.length) {
    const c = stack.pop();
    eachRoadNbr(s, c, (j) => {
      if (!s.road[j] || seen.has(j)) return;
      seen.add(j);
      if (deg(j) === 2) { out.push(j); stack.push(j); }
    });
  }
  return out;
}

// İki yol hücresi arasındaki en kısa yol ağı güzergâhı (BFS)
export function roadPath(s, a, b, limit = 6000) {
  if (!s.road[a] || !s.road[b]) return [];
  if (a === b) return [a];
  const prev = new Map([[a, -1]]); const q = [a]; let h = 0;
  while (h < q.length && q.length < limit) {
    const c = q[h++];
    if (c === b) break;
    eachRoadNbr(s, c, (j) => { if (s.road[j] && !prev.has(j)) { prev.set(j, c); q.push(j); } });
  }
  if (!prev.has(b)) return [];
  const out = []; for (let c = b; c !== -1; c = prev.get(c)) out.push(c);
  return out.reverse();
}

// Verilen hücrelerden geçen şerit örnekleri (önizleme şeridi için), kesintisiz parçalara bölünmüş
export function samplesInCells(s, cells) {
  const set = cells instanceof Set ? cells : new Set(cells); const out = [];
  for (const sg of s.segs || []) {
    let run = [];
    for (let k = 0; k < sg.p.length; k += 2) {
      const p = [sg.p[k], sg.p[k + 1]];
      if (set.has(cellOfPt(p))) run.push(p); else { if (run.length >= 2) out.push(run); run = []; }
    }
    if (run.length >= 2) out.push(run);
  }
  return out;
}

export function cloneSegs(s) { return (s.segs || []).map((q) => ({ id: q.id, p: q.p.slice() })); }
