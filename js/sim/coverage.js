// Hizmet kapsama alanları (yol mesafesine göre, CS2'deki gibi araçlar yol ağıyla ulaşır)
import { N, DIRS, idx, inB, eachRoadNbr, SQRT2, clamp } from '../core/constants.js';
import { SERVICES } from '../data/services.js';
import { ZONES } from '../data/zones.js';
import { SHOP_RANGE, CUST_R, CUST_LOW, CUST_REL_LOW } from '../data/balance.js';
import { roadDistances, perimeter, MinHeap } from './network.js';
import { svcStats, residents, jobCap, bGroup } from './buildings.js';
import { boxBlur } from './environment.js';

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

// ---------- Alışveriş erişimi (CS2: ticari bölgeler, vatandaşlar uzağa alışverişe gitmez) ----------
export const NO_SHOP = 999;

// Dükkân sayılan binalar: ticari bölgeler, karma konutların zemin kat dükkânları, ticari imza binaları
export function isShop(b) {
  if (b.built < 1 || b.abandoned || b.collapsed) return false;
  if (b.kind === 'zone') { const z = ZONES[b.type]; return z.group === 'C' || (z.group === 'R' && !!z.jobs); }
  return bGroup(b) === 'C';
}

// Ticari binalardan yol ağı üzerinde çok kaynaklı Dijkstra: s.rt.shopDist (hücre), s.rt.shopNear (en yakın dükkân id)
// Ayrıca her dükkânın yerel müşteri havzası (kutu bulanıklaştırma, binadan bağımsız maliyet)
export function computeShopAccess(s) {
  const C = N * N, rt = s.rt;
  const sd = rt.shopDist || (rt.shopDist = new Float32Array(C));
  const sn = rt.shopNear || (rt.shopNear = new Int32Array(C));
  const done = rt.shopDone || (rt.shopDone = new Uint8Array(C));
  const resM = rt.custRes || (rt.custRes = new Float32Array(C)), jobM = rt.custJobs || (rt.custJobs = new Float32Array(C));
  sd.fill(NO_SHOP); sn.fill(-1); done.fill(0); resM.fill(0); jobM.fill(0);
  const heap = new MinHeap(); const maxD = SHOP_RANGE * 1.5;
  const shops = []; let resT = 0, jobT = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    const r = residents(b); if (r > 0) { resM[idx(b.x, b.z)] += r; resT += r; }
    if (!isShop(b)) continue;
    const j = jobCap(b); jobM[idx(b.x, b.z)] += j; jobT += j;
    shops.push(b);
    for (const c of perimeter(b)) if (s.road[c] && !s.rElev[c] && sd[c] > 0) { sd[c] = 0; sn[c] = b.id; heap.push(0, c); }
  }
  while (heap.size) {
    const i = heap.pop(); if (done[i]) continue; done[i] = 1;
    const d = sd[i], lbl = sn[i];
    eachRoadNbr(s, i, (j, k, diag) => {
      if (!s.road[j] || done[j]) return;
      const nd = d + (s.road[j] === 6 ? 0.7 : 1) * (diag ? SQRT2 : 1);
      if (nd < sd[j] && nd <= maxD) { sd[j] = nd; sn[j] = lbl; heap.push(nd, j); }
    });
  }
  // yol dışı hücrelere en yakın yoldan yay
  if (!rt.nearRoad) computeNearRoad(s);
  const nr = rt.nearRoad, nd = rt.nearRoadD;
  for (let i = 0; i < C; i++) {
    if (s.road[i]) continue; const r = nr[i];
    if (r >= 0 && sd[r] < NO_SHOP) { sd[i] = sd[r] + nd[i]; sn[i] = sn[r]; }
  }
  // yerel müşteri havzası: çevredeki sakinler / çevredeki ticari iş kapasitesi
  const tmp = rt.blurTmp || (rt.blurTmp = new Float32Array(C));
  const oR = rt.custResB || (rt.custResB = new Float32Array(C)), oJ = rt.custJobsB || (rt.custJobsB = new Float32Array(C));
  boxBlur(resM, oR, CUST_R, tmp); boxBlur(jobM, oJ, CUST_R, tmp);
  let wSum = 0, wl = 0;
  for (const b of shops) {
    const i = idx(b.x, b.z); b._custLocal = oJ[i] > 1e-6 ? oR[i] / (oJ[i] * 9) : 2;
    const j = jobCap(b); wSum += j; wl += j * Math.min(2, b._custLocal);
  }
  // iş kapasitesine göre ağırlıklı ortalama: gelir etkisi dükkânlar arasında yeniden dağılır, toplamı değişmez
  const mean = wSum > 0 ? wl / wSum : 1;
  for (const b of shops) b._custRel = mean > 1e-6 ? clamp(Math.min(2, b._custLocal) / mean, 0, 1.6) : 1;
  rt.custGlobal = jobT > 0 ? resT / (jobT * 9) : 2;
  rt.shopCount = shops.length;
  rt.dirty.overlay = true;
}

// Dükkânın yerel müşteri oranının dükkân ortalamasına göre katsayısı (1 = ortalama)
export function shopCustRel(s, b) { return b._custRel ?? 1; }

// Çevresinde konut olmayan dükkân: yerel müşteri oranı hem mutlak olarak hem de şehir geneline göre çok düşük
export function shopIsolated(s, b) {
  if (b._custLocal === undefined) return false;
  return b._custLocal < CUST_LOW && b._custLocal < (s.rt.custGlobal ?? 1) * CUST_REL_LOW;
}

// Binanın en yakın dükkâna yol mesafesi (erişim hücresinden)
export function shopDistOf(s, b) {
  const sd = s.rt.shopDist; if (!sd) return 0;
  const a = b.access ?? -1;
  const d0 = sd[idx(b.x, b.z)];
  return a >= 0 ? Math.min(sd[a], d0) : d0;
}
