// Hizmet kapsama alanları (yol mesafesine göre, CS2'deki gibi araçlar yol ağıyla ulaşır)
import { N, DIRS, idx, inB } from '../core/constants.js';
import { SERVICES } from '../data/services.js';
import { roadDistances, perimeter } from './network.js';
import { svcStats, residents, jobCap } from './buildings.js';

const SPREAD = 6;

export function computeCoverage(s) {
  const cov = s.cov;
  for (const t in cov) if (t !== 'transit') cov[t].fill(0);
  const C = N * N;
  const areas = [];
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.kind !== 'svc' || b.collapsed) continue;
    const d = SERVICES[b.type];
    if (!d.svc) continue;
    const st = svcStats(b);
    const arr = cov[st.type]; if (!arr) continue;
    let eff = b.eff ?? 1;
    if (st.type === 'death' && d.storage && b.stored >= d.storage) eff = 0;
    if (st.type === 'garbage' && d.storage && b.stored >= d.storage) eff = 0;
    const capR = b.capRatio ?? 1;
    const str = st.str * Math.min(1.2, eff) * (0.4 + 0.6 * capR);
    const radius = st.radius * (0.75 + 0.25 * Math.min(1.2, eff));
    const cells = [];
    if (st.wireless || st.type === 'park' || st.type === 'shelter' || d.noRoad) {
      const cxm = b.x + b.sx / 2, czm = b.z + b.sz / 2;
      const r = Math.ceil(radius);
      for (let z = Math.max(0, (czm - r) | 0); z < Math.min(N, czm + r); z++) for (let x = Math.max(0, (cxm - r) | 0); x < Math.min(N, cxm + r); x++) {
        const dd = Math.hypot(x + 0.5 - cxm, z + 0.5 - czm);
        if (dd > radius) continue;
        const v = str * (1 - (dd / radius) * 0.7);
        const i = idx(x, z);
        if (v > arr[i]) arr[i] = v;
        cells.push(i);
      }
    } else {
      const starts = perimeter(b).filter((c) => s.road[c] && !s.rElev[c]);
      if (!starts.length) continue;
      const { visited, dist } = roadDistances(s, starts, radius);
      for (const i of visited) {
        const v = str * (1 - (dist[i] / radius) * 0.6);
        if (v > arr[i]) arr[i] = v;
        cells.push(i);
      }
    }
    areas.push({ b, st, cells });
  }
  // yol hücrelerinden çevredeki parsellere yay (en yakın yol hücresi haritası ile)
  if (!s.rt.nearRoad) computeNearRoad(s);
  const nr = s.rt.nearRoad, nd = s.rt.nearRoadD;
  for (const t of ['health', 'death', 'garbage', 'edu1', 'edu2', 'edu3', 'edu4', 'fire', 'police', 'post', 'welfare']) {
    const arr = cov[t];
    for (let i = 0; i < C; i++) {
      const r = nr[i]; if (r < 0 || r === i) continue;
      const v = arr[r] * (1 - nd[i] * 0.03); if (v > arr[i]) arr[i] = v;
    }
  }
  // her hizmet binasının yükü: kapsama alanındaki talep
  const loadMap = buildLoadMaps(s);
  for (const a of areas) {
    const lm = loadMap[a.st.type]; if (!lm) { a.b.capRatio = 1; a.b.load = 0; continue; }
    let load = 0;
    for (const i of a.cells) load += lm[i];
    // komşu parselleri de dahil etmek için kaba bir çarpan
    load *= a.st.wireless || a.st.type === 'park' ? 1 : 1.0;
    a.b.load = Math.round(load);
    a.b.capRatio = load > 0 ? Math.min(1, a.st.cap / load) : 1;
  }
  s.rt.dirty.overlay = true;
}

// Talep haritaları: binaların erişim hücresine (yol) yazılır
function buildLoadMaps(s) {
  const C = N * N;
  const pop = new Float32Array(C), kids = new Float32Array(C), teens = new Float32Array(C), adults = new Float32Array(C), garb = new Float32Array(C), all = new Float32Array(C);
  const [fc, ft, fa] = s.ageFrac;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    const r = residents(b), j = b.kind === 'zone' ? jobCap(b) : 0;
    if (r <= 0 && j <= 0) continue;
    const a = b.access ?? -1;
    const cells = a >= 0 ? [a] : [idx(b.x, b.z)];
    // binanın kendi hücresine de yaz (kablosuz/park kapsaması için)
    cells.push(idx(b.x, b.z));
    for (const c of cells) {
      pop[c] += r / 2; kids[c] += (r * fc) / 2; teens[c] += (r * ft) / 2; adults[c] += (r * fa * 0.12) / 2;
      garb[c] += (r * 1 + j * 1.2) / 2; all[c] += (r + j * 0.5) / 2;
    }
  }
  return { health: pop, death: pop, police: all, fire: all, park: pop, post: all, telecom: all, edu1: kids, edu2: teens, edu3: adults, edu4: adults, garbage: garb, shelter: pop, welfare: pop };
}

// Bir hücrenin (bina) belirli bir hizmetten aldığı kapsama değeri
export function bCov(s, b, t) {
  const a = s.cov[t];
  let m = a[idx(b.x, b.z)];
  if (b.access >= 0 && b.access !== undefined) m = Math.max(m, a[b.access]);
  return m;
}

// Her hücre için en yakın yol hücresi (en fazla SPREAD adım)
export function computeNearRoad(s) {
  const C = N * N;
  const nr = s.rt.nearRoad || (s.rt.nearRoad = new Int32Array(C));
  const nd = s.rt.nearRoadD || (s.rt.nearRoadD = new Uint8Array(C));
  nr.fill(-1); nd.fill(255);
  let q = [];
  for (let i = 0; i < C; i++) if (s.road[i]) { nr[i] = i; nd[i] = 0; q.push(i); }
  for (let d = 1; d <= SPREAD && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % N, z = (i / N) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz; if (!inB(nx, nz)) continue;
        const j = nz * N + nx; if (nd[j] !== 255) continue;
        nd[j] = d; nr[j] = nr[i]; nq.push(j);
      }
    }
    q = nq;
  }
}
