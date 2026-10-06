// Ekonomi: vergiler, ücretler, bakım giderleri, krediler, talep, üretim ve turizm
import { N, TICKS_PER_MONTH, clamp } from '../core/constants.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { ROADS, ROAD_UPGRADES, NETWORKS } from '../data/roads.js';
import { POLICIES, MILESTONES } from '../data/progression.js';
import { jobCap, bGroup } from './buildings.js';

export const WAGES = [90, 140, 200, 290, 420];
const PROFIT = { C: 62, I: 55, O: 85, R: 62 };

export const INCOME_NAMES = { res: 'Konut Vergisi', com: 'Ticari Vergi', ind: 'Sanayi Vergisi', off: 'Ofis Vergisi', fee_electricity: 'Elektrik Ücretleri', fee_water: 'Su Ücretleri', fee_garbage: 'Çöp Ücretleri', fee_health: 'Sağlık Ücretleri', fee_education: 'Eğitim Ücretleri', transit: 'Toplu Taşıma Biletleri', tourism: 'Turizm', export_power: 'Elektrik İhracatı', parking: 'Park Ücretleri' };
export const EXPENSE_NAMES = { services: 'Hizmet Bakımı', roads: 'Yol Bakımı', networks: 'Şebeke Bakımı', transitVehicles: 'Toplu Taşıma Araçları', loan: 'Kredi Faizi', policies: 'Politikalar', import_power: 'Elektrik İthalatı', subsidies: 'Sübvansiyonlar' };

// 10 tikte bir: aylık oranları hesapla
export function computeRates(s) {
  const inc = {}, exp = {};
  const pop = s.stats.pop || 0;
  const empByEdu = s.rt.empByEdu || [0, 0, 0, 0, 0];
  inc.res = empByEdu.reduce((a, e, L) => a + e * WAGES[L], 0) * s.taxes.res / 100;
  let com = 0, ind = 0, off = 0, comJobs = 0, indJobs = 0, offJobs = 0, comEmp = 0;
  const cr = clamp(s.rt.customerRatio ?? 1, 0.2, 1.3);
  const trade = 1 + (s.rt.tradeBonus || 0);
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.built < 1 || b.abandoned || b.collapsed) continue;
    const g = bGroup(b); const jc = jobCap(b); if (!jc) continue;
    const lvl = 1 + (b.level - 1) * 0.15;
    if (b.kind === 'svc' && !SERVICES[b.type].sig) continue;
    if (g === 'C' || (g === 'R' && b.kind === 'zone' && ZONES[b.type].jobs)) { com += b.emp * PROFIT.C * lvl * cr; comJobs += jc; comEmp += b.emp; }
    else if (g === 'I') { ind += b.emp * PROFIT.I * lvl * trade * (s.policies.pollution_mgmt ? 0.92 : 1); indJobs += jc; }
    else if (g === 'O') { off += b.emp * PROFIT.O * lvl; offJobs += jc; }
  }
  inc.com = com * s.taxes.com / 100 * (s.policies.smoke_free ? 0.95 : 1);
  inc.ind = ind * s.taxes.ind / 100;
  inc.off = off * s.taxes.off / 100;
  const P = s.stats.power || { cons: 0, imp: 0, exp: 0 };
  const Wt = s.stats.water || { cons: 0 };
  inc.fee_electricity = Math.max(0, P.cons - P.imp * 0) * 520 * s.fees.electricity / 100;
  inc.fee_water = Wt.cons * 130 * s.fees.water / 100;
  inc.fee_garbage = pop * 0.45 * s.fees.garbage / 100 * Math.min(1, s.rt.ratio?.garbage ?? 0);
  inc.fee_health = pop * 0.35 * s.fees.health / 100 * (s.stats.healthCov || 0);
  inc.fee_education = pop * 0.3 * s.fees.education / 100 * ((s.stats.eduCoverage || [0])[0] || 0);
  inc.transit = s.rt.transitRevenue || 0;
  inc.tourism = (s.stats.tourists || 0) * 3.2 * (s.taxes.com / 10);
  inc.export_power = P.exp * 140;
  let parkingCells = 0;
  if (s.districts.length) for (const d of s.districts) if (d.policies && d.policies.parking_fees) parkingCells += d.cells || 0;
  inc.parking = parkingCells * 6 * Math.min(1, pop / 2000);
  for (const id in s.buildings) { const b = s.buildings[id]; if (b.kind === 'svc' && SERVICES[b.type].parking) inc.parking += 220 * Math.min(1, pop / 1500); }
  // giderler
  let svc = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc') continue;
    const d = SERVICES[b.type];
    let u = d.upkeep || 0;
    for (const k of b.upgrades) { const ud = (d.upgrades || []).find((q) => q.key === k); if (ud) u += ud.upkeep || 0; }
    svc += u * (s.budgets[d.cat] ?? 100) / 100;
  }
  exp.services = svc;
  let roads = 0, nets = 0;
  for (let i = 0; i < N * N; i++) {
    if (s.road[i]) { roads += ROADS[s.road[i]].upkeep; if (s.roadUp[i]) for (const k in ROAD_UPGRADES) if (s.roadUp[i] & k) roads += ROAD_UPGRADES[k].upkeep; }
    if (s.pipeW[i]) nets += NETWORKS.pipeW.upkeep;
    if (s.pipeS[i]) nets += NETWORKS.pipeS.upkeep;
    if (s.power[i] && !s.outside[i]) nets += NETWORKS.power.upkeep;
    if (s.rail[i] === 1) nets += NETWORKS.train.upkeep; else if (s.rail[i] === 2) nets += NETWORKS.tram.upkeep;
    if (s.metro[i]) nets += NETWORKS.metro.upkeep;
  }
  exp.roads = roads; exp.networks = nets;
  exp.transitVehicles = s.rt.transitUpkeep || 0;
  exp.loan = s.loan * 0.05 / 12;
  let pol = 0;
  for (const k in s.policies) if (s.policies[k]) { const p = POLICIES[k]; if (!p) continue; pol += (p.costPerPop || 0) * pop + (p.costFlat || 0); }
  for (const d of s.districts) for (const k in d.policies || {}) if (d.policies[k]) pol += 150;
  exp.policies = pol;
  exp.import_power = P.imp * 1300;
  s.econ.inc = inc; s.econ.exp = exp;
  s.econ.totalInc = Object.values(inc).reduce((a, b) => a + b, 0);
  s.econ.totalExp = Object.values(exp).reduce((a, b) => a + b, 0);
  s.rt.jobsBy = { comJobs, indJobs, offJobs, comEmp };
}

// Her tik: parayı aylık oranın 1/TICKS kadarı değiştir
export function economyTick(s) {
  const net = (s.econ.totalInc || 0) - (s.econ.totalExp || 0);
  s.money += net / TICKS_PER_MONTH;
}

export function takeLoan(s, amount) {
  const max = MILESTONES[s.milestone].loan;
  const a = Math.min(amount, max - s.loan);
  if (a <= 0) return false;
  s.loan += a; s.money += a; return true;
}
export function repayLoan(s, amount) {
  const a = Math.min(amount, s.loan, Math.max(0, s.money));
  if (a <= 0) return false;
  s.loan -= a; s.money -= a; return true;
}

// Talep (10 tikte bir)
export function computeDemand(s) {
  const st = s.stats, D = s.demand;
  const pop = st.pop || 0;
  const unemp = st.unemployment || 0, vac = st.vacancy || 0, happy = st.happiness ?? 60;
  const jb = s.rt.jobsBy || { comJobs: 0, indJobs: 0, offJobs: 0 };
  const tourists = st.tourists || 0;
  const freeHH = Math.max(0, (st.hhCap || 0) - (st.households || 0));
  const unempW = Math.min(1, 0.3 + pop / 2000);
  let R = 0.5 + vac * 1.6 - Math.max(0, unemp - 0.04) * 3.2 * unempW + (happy - 55) / 110 - (s.taxes.res - 10) * 0.05 + (pop < 400 ? 0.3 : 0);
  if (freeHH > 60 + pop * 0.08) R -= 0.25;
  R = clamp(R, -1, 1);
  // ticari
  const consumers = pop + tourists * 0.6;
  const comCapacity = jb.comJobs * 9;
  s.rt.customerRatio = comCapacity > 0 ? consumers / comCapacity : 2;
  let C = (consumers * 0.11 - jb.comJobs) / Math.max(25, consumers * 0.11) * 1.1 - (s.taxes.com - 10) * 0.05 + Math.min(0.25, tourists / 6000);
  // sanayi
  const goodsNeed = pop * 0.09 + jb.comJobs * 0.55 + 20;
  let I = 0.25 + (goodsNeed - jb.indJobs) / Math.max(20, goodsNeed) * 0.75 - (s.taxes.ind - 10) * 0.05 + (s.rt.tradeBonus || 0) * 0.3;
  // ofis
  const [eduFree, totalW] = s.rt.eduSurplus || [0, 1];
  const eduSurplus = totalW > 0 ? eduFree / totalW : 0;
  let O = -0.15 + eduSurplus * 3.2 + (pop > 800 ? 0.15 : 0) + (pop > 3000 ? 0.1 : 0) - (s.taxes.off - 10) * 0.05 - jb.offJobs / Math.max(100, pop * 0.25) * 0.4;
  s.rt.officeShortage = Math.max(0, O);
  // iş gücü yetersizliği
  if (unemp < 0.03 && vac > 0.2 && pop > 200) { const pen = Math.min(0.6, (vac - 0.2) * 1.5); C -= pen; I -= pen; O -= pen; }
  if (pop < 50) { C = Math.min(C, 0.2); O = Math.min(O, 0); }
  const k = 0.25;
  D.res += (R - D.res) * k; D.com += (clamp(C, -1, 1) - D.com) * k; D.ind += (clamp(I, -1, 1) - D.ind) * k; D.off += (clamp(O, -1, 1) - D.off) * k;
  // konut yoğunluk ayrımı
  const avgLv = s.rt.avgLv || 20;
  const lvF = clamp(avgLv / 60, 0, 1.2);
  D.resLow = clamp(D.res * (1.05 - lvF * 0.35), -1, 1);
  D.resMed = clamp(D.res * (0.45 + lvF * 0.5) + (pop > 600 ? 0.1 : -0.1), -1, 1);
  D.resHigh = clamp(D.res * (0.15 + lvF * 0.9) + (pop > 3000 ? 0.15 : -0.2), -1, 1);
}

// Üretim zinciri (aylık)
export function computeProduction(s) {
  const prod = {}, cons = {};
  const addP = (k, v) => (prod[k] = (prod[k] || 0) + v), addC = (k, v) => (cons[k] = (cons[k] || 0) + v);
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.built < 1 || b.abandoned || b.collapsed) continue;
    if (b.kind === 'zone' && b.product) {
      const z = ZONES[b.type]; let out = b.emp * (1 + (b.level - 1) * 0.2);
      if (z.special) {
        // doğal kaynak tükenmesi: petrol ve cevher tükenir, tarım ve orman yenilenir
        let amt = 0, n = 0;
        for (let zz = b.z; zz < b.z + b.sz; zz++) for (let xx = b.x; xx < b.x + b.sx; xx++) {
          const i = xx + zz * N; amt += s.resAmt[i]; n++;
          if (z.res === 3 || z.res === 4) s.resAmt[i] = Math.max(0, s.resAmt[i] - 0.004 * (b.staffing ?? 1));
          else s.resAmt[i] = Math.min(1, s.resAmt[i] + 0.01);
        }
        b.resLeft = n ? amt / n : 0;
        out *= Math.min(1, b.resLeft * 2);
      }
      addP(b.product, out * (z.special ? 2 : 1));
      if (!z.special) {
        const raw = { food: 'grain', paper: 'wood', plastics: 'oil', metals: 'ore', goods: null }[b.product];
        if (raw) addC(raw, out * 0.8); else { addC('metals', out * 0.2); addC('plastics', out * 0.2); }
      }
      if (ZONES[b.type].group === 'C') addC('goods', b.emp * 0.5);
    }
    if (b.kind === 'svc') { const d = SERVICES[b.type]; if (d.produce) for (const k in d.produce) addP(k, d.produce[k] * b.eff / 10); }
  }
  const pop = s.stats.pop || 0;
  addC('food', pop * 0.05); addC('goods', pop * 0.06); addC('paper', pop * 0.015); addC('plastics', pop * 0.01);
  addC('software', (s.stats.jobs || 0) * 0.02);
  const res = {};
  let exportVal = 0, importVal = 0;
  const keys = new Set([...Object.keys(prod), ...Object.keys(cons)]);
  for (const k of keys) {
    const p = prod[k] || 0, c = cons[k] || 0;
    res[k] = { prod: p, cons: c, exp: Math.max(0, p - c), imp: Math.max(0, c - p) };
    exportVal += Math.max(0, p - c); importVal += Math.max(0, c - p);
  }
  s.resources = res;
  // ihracat sanayi kârını artırır
  let trade = 0;
  for (const id in s.buildings) { const b = s.buildings[id]; if (b.kind === 'svc' && SERVICES[b.type].trade) trade += SERVICES[b.type].trade * (b.eff ?? 1); }
  s.rt.tradeBonus = Math.min(0.8, trade + (exportVal > importVal ? 0.05 : 0));
}

// Turizm (aylık)
export function computeTourism(s) {
  let attract = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc' || b.collapsed) continue;
    const d = SERVICES[b.type]; if (d.attract) attract += d.attract * Math.min(1.2, b.eff ?? 1);
  }
  // doğal çekicilik: ağaçlar ve kıyılar
  let trees = 0; for (let i = 0; i < N * N; i += 7) trees += s.tree[i] ? 1 : 0;
  attract += Math.min(20, trees / 60);
  let access = 1;
  for (const id in s.buildings) { const d = SERVICES[s.buildings[id].type]; if (s.buildings[id].kind === 'svc' && d && (d.station === 'train' || d.key === 'harbor' || s.buildings[id].type === 'airport' || s.buildings[id].type === 'harbor')) access += 0.3; }
  const happy = (s.stats.happiness ?? 60) / 60;
  let tourists = attract * 18 * Math.min(access, 2.5) * happy * (s.policies.city_promotion ? 1.3 : 1);
  if ((s.stats.pop || 0) < 300) tourists *= 0.3;
  s.stats.attractiveness = Math.round(attract);
  s.stats.tourists = Math.round(tourists);
}

export function avgLandValue(s) {
  let sum = 0, n = 0;
  for (const id in s.buildings) { const b = s.buildings[id]; if (b.kind !== 'zone') continue; sum += s.lv[b.x + b.z * N]; n++; }
  s.rt.avgLv = n ? sum / n : 20;
}
