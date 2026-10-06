// Ana simülasyon döngüsü
import { N, TICKS_PER_MONTH, idx, inB, DIR8 } from '../core/constants.js';
import { SERVICES } from '../data/services.js';
import { computeConnectivity, accessCell } from './network.js';
import { pruneSegs, traceUncovered, normalizeNetwork } from './roadgeom.js';
import { computeZonable, growthTick, growthSlow } from './growth.js';
import { computeCoverage, computeNearRoad, computeShopAccess } from './coverage.js';
import { computeNetworks, allocateUtilities } from './utilities.js';
import { updatePollution, updateLandValue, computeWaterDist } from './environment.js';
import { updatePopulation, matchJobs, buildingServices, monthlyEducation } from './citizens.js';
import { computeRates, economyTick, computeDemand, computeProduction, computeTourism, avgLandValue } from './economy.js';
import { weatherTick } from './weather.js';
import { fireTick, fireRisk, disasterMonthly } from './events.js';
import { recomputeLines, transitMonthly, trafficTick, trafficSlow, trafficStats } from './transit.js';
import { monthlyXP, checkMilestones } from './progression.js';
import { chirperMonthly, chirpEvent, lifepathMonthly, chirp } from './chirper.js';

export function initRuntime(s) {
  s.rt = {
    dirty: { roads: true, zones: true, buildings: true, util: true, cov: true, overlay: true, trees: true, terrain: true, networks: true, lines: true, cand: true, icons: true },
    events: [], uiEvents: [], removed: [], vehicleSpawn: [], forestFire: new Set(), cityEffect: {}, ratio: {}, cap: {},
    daylight: 1, deathsThisMonth: 0, bodiesCollected: 0, selected: null, happyMap: new Float32Array(N * N),
    customerRatio: 1, eduAvg: 0.4, tornado: null, flash: 0,
  };
  for (let i = 0; i < N * N; i++) if (s.outside[i] === 1 && s.road[i]) { s.rt.outsideRoad = i; break; }
  computeWaterDist(s);
  if (!s.segs) s.segs = [];
  pruneSegs(s); traceUncovered(s);
  // ağ sürüm 2: kesişimlerde bölünmüş şeritler (eski kayıtlar bir kez dönüştürülür)
  if ((s.netV || 0) < 2) { normalizeNetwork(s); s.netV = 2; }
  refreshRoads(s);
  computeNetworks(s); s.rt.dirty.util = false;
  weatherTick(s);
  computeShopAccess(s);
  updatePopulation(s); matchJobs(s); computeCityEffects(s); buildingServices(s);
  computeCoverage(s); allocateUtilities(s); computeRates(s);
  if (!s.chirps.length) chirp(s, 'welcome');
}

export function refreshRoads(s) {
  computeBridges(s);
  computeConnectivity(s);
  computeZonable(s);
  computeNearRoad(s);
  const conn = s.rt.conn;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    b.access = accessCell(s, b);
    const d = b.kind === 'svc' ? SERVICES[b.type] : null;
    b.connected = (d && d.noRoad) ? true : b.access >= 0 && !!conn[b.access];
  }
  recomputeLines(s);
  s.rt.dirty.roads = false; s.rt.dirty.cov = true; s.rt.dirty.util = true; s.rt.dirty.cand = true;
}

// Köprü hücreleri: suyun üzerindeki yollar ve kıyıdaki rampa hücreleri
export function computeBridges(s) {
  const C = N * N; const br = s.rt.bridge || (s.rt.bridge = new Uint8Array(C)); br.fill(0);
  for (let i = 0; i < C; i++) {
    if (!s.road[i]) continue;
    if (s.water[i]) { br[i] = 1; continue; }
    const x = i % N, z = (i / N) | 0; const m = s.rConn[i];
    for (let d = 0; d < 8; d++) {
      if (!(m & (1 << d))) continue;
      const nx = x + DIR8[d][0], nz = z + DIR8[d][1];
      if (inB(nx, nz) && s.water[idx(nx, nz)]) { br[i] = 2; break; }
    }
  }
}

function computeCityEffects(s) {
  const ce = {};
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc' || b.collapsed) continue;
    const d = SERVICES[b.type]; if (!d.cityEffect) continue;
    const e = Math.min(1, b.eff ?? 1);
    for (const k in d.cityEffect) ce[k] = (ce[k] || 0) + d.cityEffect[k] * e;
  }
  if (ce.sickness) ce.sickness = Math.max(-0.5, ce.sickness);
  if (ce.crime) ce.crime = Math.max(-0.5, ce.crime);
  if (ce.happiness) ce.happiness = Math.min(8, ce.happiness);
  s.rt.cityEffect = ce;
  s.rt.prisonOk = ce.prison ? 1.15 : 1;
}

function computeHappyMap(s) {
  const m = s.rt.happyMap; m.fill(0);
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc') continue;
    const d = SERVICES[b.type]; if (!d.happy) continue;
    const cx = b.x + b.sx / 2, cz = b.z + b.sz / 2, R = 14;
    for (let z = (cz - R) | 0; z <= cz + R; z++) for (let x = (cx - R) | 0; x <= cx + R; x++) {
      if (!inB(x, z)) continue; const dd = Math.hypot(x - cx, z - cz); if (dd > R) continue;
      const i = idx(x, z); m[i] = Math.min(15, m[i] + d.happy * (1 - dd / R));
    }
  }
}

export function tick(s) {
  const t = s.time, rt = s.rt;
  t.tick++;
  t.tod += 24 / TICKS_PER_MONTH;
  if (rt.needWaterDist) { computeWaterDist(s); rt.needWaterDist = false; }
  if (rt.dirty.roads) refreshRoads(s);
  if (rt.dirty.util) { computeNetworks(s); rt.dirty.util = false; rt.utilFresh = true; }
  weatherTick(s);
  growthTick(s);
  fireTick(s);
  trafficTick(s);
  economyTick(s);
  if (t.tick % 4 === 0 || rt.utilFresh) { allocateUtilities(s); rt.utilFresh = false; }
  if (t.tick % 10 === 0) {
    updatePopulation(s); matchJobs(s); computeCityEffects(s); buildingServices(s);
    computeDemand(s); growthSlow(s); fireRisk(s); computeRates(s); trafficSlow(s); avgLandValue(s);
  }
  if (rt.dirty.cov && t.tick % 20 === 7 || t.tick % 90 === 47) { computeCoverage(s); rt.dirty.cov = false; }
  if (t.tick % 20 === 5) updatePollution(s);
  if (t.tick % 30 === 22) computeShopAccess(s);
  if (t.tick % 30 === 15) { updateLandValue(s); trafficStats(s); computeHappyMap(s); }
  if (t.tod >= 24) monthly(s);
  // olayları işle
  if (rt.events.length) {
    for (const e of rt.events) { chirpEvent(s, e); rt.uiEvents.push(e); }
    rt.events.length = 0;
    if (rt.uiEvents.length > 50) rt.uiEvents.splice(0, rt.uiEvents.length - 50);
  }
}

function monthly(s) {
  const t = s.time;
  t.tod -= 24; t.month++; t.monthsElapsed++;
  if (t.month > 11) { t.month = 0; t.year++; }
  monthlyEducation(s);
  computeProduction(s);
  computeTourism(s);
  transitMonthly(s);
  disasterMonthly(s);
  deathcareMonthly(s);
  garbageMonthly(s);
  monthlyXP(s);
  checkMilestones(s);
  chirperMonthly(s);
  lifepathMonthly(s);
  const st = s.stats;
  s.econ.last = { inc: { ...s.econ.inc }, exp: { ...s.econ.exp }, totalInc: s.econ.totalInc, totalExp: s.econ.totalExp };
  s.history.push({
    m: t.monthsElapsed, label: `${t.month + 1}/${t.year}`, pop: st.pop || 0, money: Math.round(s.money), inc: Math.round(s.econ.totalInc || 0), exp: Math.round(s.econ.totalExp || 0),
    happy: Math.round(st.happiness || 0), unemp: +(st.unemployment || 0).toFixed(3), traffic: Math.round(st.trafficFlow ?? 100), tourists: st.tourists || 0,
    deaths: s.rt.deathsThisMonth, births: Math.round((st.pop || 0) * 0.006), power: +(st.power?.cons || 0).toFixed(1), water: +(st.water?.cons || 0).toFixed(1), crime: Math.round(st.crimeRate || 0),
    edu: s.edu.map((v) => Math.round(v)), lv: Math.round(s.rt.avgLv || 0),
  });
  if (s.history.length > 240) s.history.shift();
  s.stats.deathsLastMonth = s.rt.deathsThisMonth;
  s.rt.deathsThisMonth = 0;
  s.rt.uiEvents.push({ type: 'month' });
}

function deathcareMonthly(s) {
  let bodies = s.rt.bodiesCollected; s.rt.bodiesCollected = 0;
  if (bodies <= 0) return;
  const facs = Object.values(s.buildings).filter((b) => b.kind === 'svc' && SERVICES[b.type].svc?.type === 'death');
  for (const b of facs) { const d = SERVICES[b.type]; if (d.processing) { const p = Math.min(bodies, d.processing * (b.eff ?? 1)); bodies -= p; b._processed = p; } }
  for (const b of facs) { const d = SERVICES[b.type]; if (d.storage && bodies > 0) { const p = Math.min(bodies, d.storage - (b.stored || 0)); b.stored = (b.stored || 0) + p; bodies -= p; } }
}

function garbageMonthly(s) {
  const gen = s.stats.garbageGen || 0;
  const collected = gen * Math.min(1, s.rt.ratio.garbage ?? 0);
  const facs = Object.values(s.buildings).filter((b) => b.kind === 'svc' && SERVICES[b.type].svc?.type === 'garbage');
  const capT = facs.reduce((a, b) => a + SERVICES[b.type].svc.cap * (b.eff ?? 1), 0) || 1;
  for (const b of facs) {
    const d = SERVICES[b.type]; const share = collected * (d.svc.cap * (b.eff ?? 1)) / capT;
    b._processed = share;
    if (d.storage) { b.stored = Math.min(d.storage, (b.stored || 0) + share); if (b.stored >= d.storage) s.rt.dirty.cov = true; }
  }
}

export function speedTicksPerSecond(speed) { return [0, 4, 8, 16][speed] || 0; }
