// Yol ağı: bağlantı, yol bulma (A*), bina erişim hücreleri
import { N, DIRS, idx, inB, eachRoadNbr, SQRT2 } from '../core/constants.js';
import { ROADS } from '../data/roads.js';

export class MinHeap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n > 0) {
      let i = 0;
      while (true) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

// Dış bağlantıya ulaşan yol hücrelerini işaretle
export function computeConnectivity(s) {
  const C = N * N;
  const conn = s.rt.conn || (s.rt.conn = new Uint8Array(C));
  conn.fill(0);
  const q = [];
  for (let i = 0; i < C; i++) if (s.outside[i] === 1 && s.road[i]) { conn[i] = 1; q.push(i); }
  while (q.length) {
    const i = q.pop();
    eachRoadNbr(s, i, (j) => { if (!conn[j] && s.road[j]) { conn[j] = 1; q.push(j); } });
  }
  return conn;
}

// Binanın çevresindeki (ön taraf öncelikli) yol hücresi
export function accessCell(s, b) {
  const f = DIRS[b.f];
  // ön kenar hücreleri
  const cells = [];
  for (let z = b.z; z < b.z + b.sz; z++) for (let x = b.x; x < b.x + b.sx; x++) {
    const nx = x + f[0], nz = z + f[1];
    if (!inB(nx, nz)) continue;
    const j = idx(nx, nz);
    if (s.bld[j] !== b.id && s.road[j] && !s.rElev[j]) cells.push(j);
  }
  if (cells.length) return cells[(cells.length / 2) | 0];
  // herhangi bir komşu yol
  for (const c of perimeter(b)) if (s.road[c] && !s.rElev[c]) return c;
  return -1;
}

export function perimeter(b) {
  const out = [];
  for (let x = b.x; x < b.x + b.sx; x++) { if (b.z - 1 >= 0) out.push(idx(x, b.z - 1)); if (b.z + b.sz < N) out.push(idx(x, b.z + b.sz)); }
  for (let z = b.z; z < b.z + b.sz; z++) { if (b.x - 1 >= 0) out.push(idx(b.x - 1, z)); if (b.x + b.sx < N) out.push(idx(b.x + b.sx, z)); }
  return out;
}

export function footprint(b) {
  const out = [];
  for (let z = b.z; z < b.z + b.sz; z++) for (let x = b.x; x < b.x + b.sx; x++) out.push(idx(x, z));
  return out;
}

// A* yol bulma. mode: 'car' | 'service' | 'bus' | 'tram' | 'train' | 'metro'
export function findPath(s, start, goal, mode = 'car', maxIter = 12000) {
  if (start === goal) return [start];
  const passable = passFn(s, mode);
  const railMode = mode === 'train' || mode === 'metro';
  if (!passable(start) || !passable(goal)) return null;
  const gx = goal % N, gz = (goal / N) | 0;
  const g = s.rt.pfG || (s.rt.pfG = new Float32Array(N * N));
  const came = s.rt.pfC || (s.rt.pfC = new Int32Array(N * N));
  const stamp = s.rt.pfS || (s.rt.pfS = new Uint32Array(N * N));
  s.rt.pfStamp = (s.rt.pfStamp || 0) + 1; const st = s.rt.pfStamp;
  const heap = new MinHeap();
  g[start] = 0; came[start] = -1; stamp[start] = st;
  heap.push(0, start);
  let iter = 0;
  const traffic = s.traffic;
  while (heap.size && iter++ < maxIter) {
    const i = heap.pop();
    if (i === goal) {
      const path = []; let c = i; while (c !== -1) { path.push(c); c = came[c]; } return path.reverse();
    }
    const x = i % N, z = (i / N) | 0;
    const relax = (j, diag) => {
      if (!passable(j)) return;
      const cost = cellCost(s, j, mode, traffic) * (diag ? SQRT2 : 1);
      const ng = g[i] + cost;
      if (stamp[j] !== st || ng < g[j]) {
        stamp[j] = st; g[j] = ng; came[j] = i;
        const jx = j % N, jz = (j / N) | 0;
        const h = Math.max(Math.abs(jx - gx), Math.abs(jz - gz)) * 0.012;
        heap.push(ng + h, j);
      }
    };
    if (railMode) {
      for (let d = 0; d < 4; d++) { const nx = x + DIRS[d][0], nz = z + DIRS[d][1]; if (inB(nx, nz)) relax(nx + nz * N, 0); }
    } else eachRoadNbr(s, i, (j, d, diag) => relax(j, diag));
  }
  return null;
}

function passFn(s, mode) {
  if (mode === 'train') return (j) => s.rail[j] === 1;
  if (mode === 'metro') return (j) => s.metro[j] > 0;
  if (mode === 'tram') return (j) => s.rail[j] === 2 && s.road[j] > 0;
  return (j) => s.road[j] > 0;
}

export function cellCost(s, j, mode, traffic) {
  if (mode === 'train' || mode === 'metro') return 0.01;
  const r = ROADS[s.road[j]];
  let c = 1 / r.speed;
  if (r.key === 'pedestrian' && mode === 'car') c *= 30;
  if (mode === 'bus' && r.key === 'buslane') return c * 0.6;
  const cong = traffic[j] / r.cap;
  if (cong > 0.6) c *= 1 + (cong - 0.6) * 2.5;
  if (s.roadUp[j] & 4) c *= 1.3;
  return c;
}

// Belirli bir başlangıçtan Dijkstra ile mesafe haritası (hizmet kapsaması)
export function roadDistances(s, starts, maxDist) {
  const C = N * N;
  const dist = s.rt.dDist || (s.rt.dDist = new Float32Array(C));
  const stamp = s.rt.dStamp || (s.rt.dStamp = new Uint32Array(C));
  s.rt.dSt = (s.rt.dSt || 0) + 1; const st = s.rt.dSt;
  const done = s.rt.dDone || (s.rt.dDone = new Uint32Array(C));
  const heap = new MinHeap();
  for (const i of starts) { dist[i] = 0; stamp[i] = st; heap.push(0, i); }
  const visited = [];
  while (heap.size) {
    const i = heap.pop(); const d = dist[i];
    if (done[i] === st || d > maxDist) continue;
    done[i] = st;
    visited.push(i);
    eachRoadNbr(s, i, (j, k, diag) => {
      if (!s.road[j]) return;
      const step = (s.road[j] === 6 ? 0.7 : 1) * (diag ? SQRT2 : 1);
      const nd = d + step;
      if (nd <= maxDist && (stamp[j] !== st || nd < dist[j])) { stamp[j] = st; dist[j] = nd; heap.push(nd, j); }
    });
  }
  return { visited, dist };
}
