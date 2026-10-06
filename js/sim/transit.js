// Toplu taşıma hatları (otobüs, tramvay, tren, metro) ve trafik örneklemesi
import { N, idx, inB, clamp } from '../core/constants.js';
import { SERVICES } from '../data/services.js';
import { ROADS } from '../data/roads.js';
import { SHOP_RANGE, SHOP_FAR_SHARE } from '../data/balance.js';
import { findPath, footprint, perimeter } from './network.js';
import { residents, jobCap } from './buildings.js';

export const LINE_TYPES = {
  bus: { name: 'Otobüs', icon: '🚌', radius: 6, vcap: 35, fare: 1.6, vUpkeep: 260, speed: 1, color: '#2e86de', unlock: 4, mode: 'bus' },
  tram: { name: 'Tramvay', icon: '🚋', radius: 7, vcap: 90, fare: 2.0, vUpkeep: 450, speed: 1.2, color: '#e74c3c', unlock: 'n_tram', mode: 'tram' },
  metro: { name: 'Metro', icon: '🚇', radius: 10, vcap: 220, fare: 2.5, vUpkeep: 800, speed: 2.4, color: '#8e44ad', unlock: 'n_metro', mode: 'metro', station: 'metro' },
  train: { name: 'Tren', icon: '🚆', radius: 12, vcap: 260, fare: 3.0, vUpkeep: 900, speed: 2.8, color: '#d35400', unlock: 'n_train', mode: 'train', station: 'train' },
};
const LINE_COLORS = ['#2e86de', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad', '#16a085', '#d35400', '#c0392b', '#2c3e50', '#e84393'];

export function newLine(s, type) {
  const id = s.nextLineId++;
  const line = { id, type, name: `${LINE_TYPES[type].name} Hattı ${id}`, color: LINE_COLORS[(id - 1) % LINE_COLORS.length], stops: [], vehicles: 2, path: [], valid: false, riders: 0, active: true };
  s.lines.push(line);
  return line;
}

// İstasyon tabanlı hatlarda durak hücresini istasyon binasından bul
export function stationNode(s, b, mode) {
  const cells = [...footprint(b), ...perimeter(b)];
  for (const c of cells) {
    if (mode === 'train' && s.rail[c] === 1) return c;
    if (mode === 'metro' && s.metro[c]) return c;
  }
  return -1;
}

export function stopNode(s, line, stop) {
  const T = LINE_TYPES[line.type];
  if (T.station) { const b = s.buildings[stop]; return b ? stationNode(s, b, T.mode) : -1; }
  return stop;
}

export function hasDepot(s, type) {
  for (const id in s.buildings) { const b = s.buildings[id]; if (b.kind === 'svc' && SERVICES[b.type].depot === type) return true; }
  return false;
}

export function computeLinePath(s, line) {
  const T = LINE_TYPES[line.type];
  line.path = []; line.valid = false; line.problem = '';
  if (line.stops.length < 2) { line.problem = 'En az 2 durak gerekli'; return; }
  if (!hasDepot(s, line.type)) { line.problem = `${T.name} deposu/garajı yok`; }
  const nodes = line.stops.map((st) => stopNode(s, line, st));
  if (nodes.some((n) => n < 0)) { line.problem = 'Durak ağa bağlı değil'; return; }
  const full = [];
  for (let k = 0; k < nodes.length; k++) {
    const a = nodes[k], b = nodes[(k + 1) % nodes.length];
    const p = findPath(s, a, b, T.mode, 20000);
    if (!p) { line.problem = `Durak ${k + 1} → ${((k + 1) % nodes.length) + 1} arası yol yok`; return; }
    if (full.length) p.shift();
    full.push(...p);
  }
  line.path = full;
  line.stopIdx = nodes;
  if (!line.problem) line.valid = true;
}

export function recomputeLines(s) { for (const l of s.lines) computeLinePath(s, l); s.rt.dirty.lines = true; }

// Aylık yolcu sayısı, gelir, kapsama
export function transitMonthly(s) {
  const cov = s.cov.transit; cov.fill(0);
  let revenue = 0, upkeep = 0, totalRiders = 0;
  const free = !!s.policies.free_transit;
  const feeF = s.fees.transit / 100;
  for (const line of s.lines) {
    const T = LINE_TYPES[line.type];
    upkeep += line.vehicles * T.vUpkeep;
    if (!line.valid || !line.active) { line.riders = 0; continue; }
    let catchment = 0;
    const seen = new Set();
    for (const n of line.stopIdx) {
      const x0 = n % N, z0 = (n / N) | 0, R = T.radius;
      for (let z = z0 - R; z <= z0 + R; z++) for (let x = x0 - R; x <= x0 + R; x++) {
        if (!inB(x, z)) continue; const d = Math.hypot(x - x0, z - z0); if (d > R) continue;
        const i = idx(x, z); const v = 1 - d / R; if (v > cov[i]) cov[i] = v;
        const bi = s.bld[i]; if (bi >= 0 && !seen.has(bi)) { seen.add(bi); const b = s.buildings[bi]; catchment += residents(b) + jobCap(b) * 0.3; }
      }
    }
    const freq = clamp(line.vehicles / Math.max(1, line.path.length / 45), 0.2, 1.5);
    const stopsF = Math.min(1, (line.stops.length - 1) / 4);
    let share = 0.22 * freq * stopsF * T.speed ** 0.3 * (free ? 1.4 : clamp(1.6 - feeF * 0.6, 0.5, 1.3));
    let riders = catchment * share * 4;
    const capacity = line.vehicles * T.vcap * 40;
    riders = Math.min(riders, capacity);
    line.riders = Math.round(riders);
    totalRiders += riders;
    if (!free) revenue += riders * T.fare * feeF;
  }
  s.rt.transitRevenue = revenue;
  s.rt.transitUpkeep = upkeep;
  s.stats.transitRiders = Math.round(totalRiders);
  s.rt.transitShare = clamp(totalRiders / Math.max(1, (s.stats.pop || 0) * 1.6 * 4), 0, 0.6);
}

// ---------- trafik örneklemesi ----------
function buildWeights(s) {
  const homes = [], hw = [], works = [], ww = [], shops = [], sw = [], inds = [], iw = [];
  let ht = 0, wt = 0, st = 0, it = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.access === undefined || b.access < 0 || b.built < 1 || b.abandoned || b.collapsed) continue;
    const r = residents(b); if (r > 0) { ht += r; homes.push(b); hw.push(ht); }
    const e = b.emp || 0; if (e > 0) { wt += e; works.push(b); ww.push(wt); }
    if (b.kind === 'zone' && b.type <= 8 && b.type >= 7 && e > 0) { st += e; shops.push(b); sw.push(st); }
    if (b.kind === 'zone' && (b.type === 9 || b.type >= 12) && e > 0) { it += e; inds.push(b); iw.push(it); }
  }
  s.rt.tw = { homes, hw, ht, works, ww, wt, shops, sw, st, inds, iw, it };
}
function pickW(list, cum, tot) {
  if (!list.length) return null;
  const r = Math.random() * tot; let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
  return list[lo];
}

export function trafficSlow(s) {
  // trafiği sönümle ve ağırlıkları yenile
  const t = s.traffic;
  for (let i = 0; i < t.length; i++) if (t[i] > 0) t[i] *= 0.9;
  buildWeights(s);
}

export function trafficTick(s) {
  const tw = s.rt.tw; if (!tw || !tw.homes.length) return;
  const pop = s.stats.pop || 0;
  const K = Math.min(6, 1 + Math.floor(pop / 1500));
  const share = s.rt.transitShare || 0;
  const taxi = s.rt.cityEffect.traffic || 0;
  const monthlyTrips = pop * 1.6 * (1 - share) * (1 + taxi) + tw.it * 0.8;
  const perSample = monthlyTrips / (10 * K * 12) * 1.0;
  let costSum = 0, nOk = 0;
  for (let k = 0; k < K; k++) {
    let a, b, kind = 'car';
    const r = Math.random();
    if (r < 0.12 && tw.inds.length) {
      // kamyon: sanayiden dış bağlantıya
      a = pickW(tw.inds, tw.iw, tw.it); b = { access: s.rt.outsideRoad ?? -1 }; kind = 'truck';
    } else {
      a = pickW(tw.homes, tw.hw, tw.ht);
      if (r < 0.6) b = pickW(tw.works, tw.ww, tw.wt);
      else {
        // alışveriş: menzil içindeki en yakın dükkân tercih edilir; menzilde dükkân yoksa yolculuk yapılmaz
        b = a ? shopFor(s, a, tw) : null;
        if (b === false) continue;
      }
      if (!b) b = pickW(tw.works, tw.ww, tw.wt);
      if (!b && Math.random() < 0.5) b = { access: s.rt.outsideRoad ?? -1 };
    }
    if (!a || !b || a.access < 0 || b.access < 0 || a === b) continue;
    const path = findPath(s, a.access, b.access, 'car', 8000);
    if (!path) { s.rt.noRoute = (s.rt.noRoute || 0) + 1; continue; }
    const w = perSample * (kind === 'truck' ? 1.5 : 1);
    for (const c of path) t_add(s, c, w);
    costSum += path.length; nOk++;
    if (s.rt.vehicleSpawn.length < 40 && Math.random() < 0.7) s.rt.vehicleSpawn.push({ path, kind });
  }
  if (nOk) s.rt.avgTrip = (s.rt.avgTrip || 10) * 0.95 + (costSum / nOk) * 0.05;
}
function t_add(s, c, w) { s.traffic[c] += w; }

// Evden alışveriş hedefi: false = menzilde dükkân yok (yolculuk kaybedilir)
function shopFor(s, home, tw) {
  const sd = s.rt.shopDist, sn = s.rt.shopNear;
  if (!sd || home.access < 0 || !tw.shops.length) return pickW(tw.shops, tw.sw, tw.st);
  if (sd[home.access] > SHOP_RANGE) return Math.random() < SHOP_FAR_SHARE ? pickW(tw.shops, tw.sw, tw.st) : false;
  const near = s.buildings[sn[home.access]];
  // biraz çeşitlilik: rastgele bir dükkân menzil içindeyse (kuş uçuşu) ona da gidilebilir
  if (Math.random() < 0.3) {
    const c = pickW(tw.shops, tw.sw, tw.st);
    if (c && c.access >= 0 && Math.abs((c.access % N) - (home.access % N)) + Math.abs(((c.access / N) | 0) - ((home.access / N) | 0)) <= SHOP_RANGE * 0.8) return c;
  }
  return near && near.access >= 0 ? near : pickW(tw.shops, tw.sw, tw.st);
}

export function trafficStats(s) {
  let load = 0, n = 0;
  for (let i = 0; i < N * N; i++) {
    const r = s.road[i]; if (!r) continue;
    n++; load += Math.min(1.5, s.traffic[i] / ROADS[r].cap);
  }
  s.stats.trafficFlow = n ? clamp(100 - (load / n) * 120, 0, 100) : 100;
}
