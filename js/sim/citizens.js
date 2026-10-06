// Nüfus, iş eşleştirme, eğitim, sağlık, çöp, ölüm, suç ve mutluluk
import { idx, clamp } from '../core/constants.js';
import { ZONES, JOB_EDU } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { hhCap, jobCap, residents, bGroup, svcStats } from './buildings.js';
import { bCov } from './coverage.js';

const IMMIGRANT_EDU = [0.3, 0.35, 0.22, 0.1, 0.03];

function budgetKey(cat) { return cat; }

// Nüfus istatistiklerini ve eğitim sayılarını güncelle
export function updatePopulation(s) {
  let pop = 0, hh = 0, hhCapT = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id];
    const r = residents(b); pop += r; hh += b.hh; hhCapT += hhCap(b);
  }
  s.stats.pop = Math.round(pop); s.stats.households = hh; s.stats.hhCap = hhCapT;
  const adults = pop * s.ageFrac[2];
  let tot = s.edu.reduce((a, b) => a + b, 0);
  if (adults > tot) {
    const add = adults - tot;
    const bonus = clamp((s.rt.officeShortage || 0), 0, 0.3);
    const dist = IMMIGRANT_EDU.map((v, L) => v + (L >= 2 ? bonus / 3 : -bonus / 2 / 2 * (L < 2 ? 1 : 0)));
    const ds = dist.reduce((a, b) => a + b, 0);
    for (let L = 0; L < 5; L++) s.edu[L] += add * dist[L] / ds;
  } else if (adults < tot && tot > 0) {
    const f = adults / tot; for (let L = 0; L < 5; L++) s.edu[L] *= f;
  }
  tot = adults;
  s.rt.eduAvg = tot > 0 ? s.edu.reduce((a, v, L) => a + v * L, 0) / (tot * 2.5) : 0.4;
}

// Eğitim ilerlemesi (aylık)
export function monthlyEducation(s) {
  const pop = s.stats.pop || 0; if (pop <= 0) return;
  const ratio = (t) => {
    let covered = 0, total = 0;
    for (const id in s.buildings) {
      const b = s.buildings[id]; const r = residents(b); if (r <= 0) continue;
      total += r; covered += r * Math.min(1, bCov(s, b, t) * 1.2);
    }
    let cap = 0, load = 0;
    for (const id in s.buildings) {
      const b = s.buildings[id]; if (b.kind !== 'svc') continue;
      const st = svcStats(b); if (!st || st.type !== t) continue;
      cap += st.cap * (b.eff ?? 1); load += b.load || 0;
    }
    const capR = load > 0 ? Math.min(1, cap / load) : (cap > 0 ? 1 : 0);
    return total > 0 ? (covered / total) * capR : 0;
  };
  const r = [ratio('edu1'), ratio('edu2'), ratio('edu3'), ratio('edu4')];
  s.stats.eduCoverage = r;
  const k = 3; // oyun temposu için hızlandırma
  const mv = [0.006 * r[0], 0.005 * r[1], 0.0035 * r[2], 0.0022 * r[3]];
  for (let L = 0; L < 4; L++) {
    const m = s.edu[L] * mv[L] * k;
    s.edu[L] -= m; s.edu[L + 1] += m;
  }
  // yaş dağılımı: hafif değişim (sağlık hizmeti yaşlıları artırır)
  const hcov = s.stats.healthCov || 0;
  const target = [0.2, 0.1, 0.55 - hcov * 0.03, 0.15 + hcov * 0.03];
  for (let i = 0; i < 4; i++) s.ageFrac[i] += (target[i] - s.ageFrac[i]) * 0.05;
}

// İş eşleştirme (10 tikte bir)
export function matchJobs(s) {
  // Önce şehir hizmetleri, sonra şirketler işçi alır
  const places = [[], []];
  const J = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]];
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.built < 1 || b.abandoned || b.collapsed) { b.staffing = 0; b.emp = 0; continue; }
    const jc = jobCap(b); if (jc <= 0) continue;
    const grp = bGroup(b); const g = grp === 'R' ? 'C' : grp;
    const dist = JOB_EDU[g]; const pri = grp === 'S' ? 0 : 1;
    for (let L = 0; L < 5; L++) J[pri][L] += jc * dist[L];
    places[pri].push([b, jc, dist]);
  }
  const W = s.edu.map((v) => v * 0.9);
  const totalW = W.reduce((a, b) => a + b, 0);
  const rem = W.slice();
  const fills = [];
  const filledAll = [0, 0, 0, 0, 0], Jall = [0, 0, 0, 0, 0];
  for (let p = 0; p < 2; p++) {
    const filled = [0, 0, 0, 0, 0];
    // hizmetler iş gücünün en fazla %35'ini öncelikli alır; kalanı şirketlerle eşit yarışır
    const scale = p === 0 ? Math.min(1, (totalW * 0.35) / Math.max(1, J[0].reduce((a, b) => a + b, 0))) : 1;
    for (let L = 4; L >= 0; L--) {
      let need = J[p][L] * scale;
      // önce aynı veya daha yüksek eğitimli, sonra (hizmetler için) bir alt seviyeden
      for (let k = L; k <= 4 && need > 0; k++) { const t = Math.min(need, rem[k]); rem[k] -= t; need -= t; filled[L] += t; }
      if (p === 0) for (let k = L - 1; k >= Math.max(0, L - 1) && need > 0; k--) { const t = Math.min(need, rem[k]); rem[k] -= t; need -= t; filled[L] += t; }
      filledAll[L] += filled[L]; Jall[L] += J[p][L];
    }
    fills.push(J[p].map((j, L) => (j > 0 ? filled[L] / j : 1)));
  }
  const fill = Jall.map((j, L) => (j > 0 ? filledAll[L] / j : 1));
  s.rt.empByEdu = W.map((w, L) => w - rem[L]);
  let emp = 0, jobs = 0;
  for (let p = 0; p < 2; p++) for (const [b, jc, dist] of places[p]) {
    let st = 0; for (let L = 0; L < 5; L++) st += dist[L] * fills[p][L];
    if (!b.power) st *= 0.5;
    b.staffing = b.staffing === undefined ? st : b.staffing + (st - b.staffing) * 0.3;
    b.emp = Math.round(jc * b.staffing);
    emp += b.emp; jobs += jc;
  }
  // dış bağlantı üzerinden şehir dışına çalışmaya gidenler (CS2'deki banliyö yolcuları)
  const outsideCap = s.rt.outsideRoad !== undefined ? totalW * 0.18 : 0;
  let commute = 0;
  for (let L = 4; L >= 0 && commute < outsideCap; L--) { const t = Math.min(rem[L], outsideCap - commute); rem[L] -= t; commute += t; s.rt.empByEdu[L] += t * 0.85; }
  s.stats.commuters = Math.round(commute);
  const unemployed = rem.reduce((a, b) => a + b, 0);
  s.stats.workers = Math.round(totalW); s.stats.employed = Math.round(totalW - unemployed); s.stats.jobs = Math.round(jobs);
  s.stats.unemployment = totalW > 0 ? unemployed / totalW : 0;
  s.stats.jobFill = fill;
  s.stats.vacancy = jobs > 0 ? Math.max(0, jobs - emp) / jobs : 0;
  s.rt.eduSurplus = [rem[2] + rem[3] + rem[4], totalW];
  // hizmet binalarının verimi: bütçe * personel * elektrik
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc') continue;
    const d = SERVICES[b.type];
    const budget = (s.budgets[budgetKey(d.cat)] ?? 100) / 100;
    const staff = d.workers ? Math.max(0.25, Math.pow(Math.max(0.05, b.staffing ?? 0), 0.5)) : 1;
    const pw = (d.prod && (d.prod.power || d.prod.battery)) || d.cat === 'parks' || d.cat === 'landmarks' ? 1 : (b.power ? 1 : 0.3);
    b.eff = clamp(budget, 0.5, 1.5) * staff * pw;
  }
}

// Bina düzeyinde hizmet etkileri (10 tikte bir)
export function buildingServices(s) {
  // küresel kapasite oranları
  const cap = {}, load = {};
  let garbageGen = 0, deadWaiting = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc' || b.collapsed) continue;
    const d = SERVICES[b.type]; const st = svcStats(b); if (!st) continue;
    if (d.storage && (b.stored || 0) >= d.storage) continue;
    cap[st.type] = (cap[st.type] || 0) + st.cap * (b.eff ?? 1);
  }
  const recyc = s.policies.recycling_drive ? 0.8 : 1;
  const sickBase = 0.025 * (1 + (s.rt.cityEffect.sickness || 0)) * (s.policies.smoke_free ? 0.85 : 1);
  const prison = (s.rt.cityEffect.prison || 0) > 0 ? 0.8 : 1;
  const crimeCity = 1 + (s.rt.cityEffect.crime || 0) + (s.policies.prerelease ? 0.1 : 0);
  const unemp = s.stats.unemployment || 0;
  let sickT = 0, popT = 0, crimeT = 0, happyT = 0, healthCovT = 0, nRes = 0;
  const pollutedWaterHit = [];
  for (const id in s.buildings) {
    const b = s.buildings[id];
    if (b.built < 1 || b.abandoned || b.collapsed) continue;
    const r = residents(b), j = b.kind === 'zone' ? jobCap(b) : 0;
    if (r <= 0 && j <= 0) continue;
    const i = idx(b.x, b.z);
    // çöp
    const gen = (r * 1 + j * 1.2) * recyc;
    garbageGen += gen;
    b.garbage = Math.min(150, (b.garbage || 0) + (s.milestone >= 1 ? 2.2 : 0.6));
    const gc = bCov(s, b, 'garbage');
    if (gc > 0.03) b.garbage = Math.max(0, b.garbage - (6 + 4 * gc) * (s.rt.ratio.garbage ?? 1));
    // sağlık
    const hc = bCov(s, b, 'health');
    const env = s.polG[i] * 0.12 + s.polA[i] * 0.1 + (b.waterPol || 0) * 0.25 + (b.water ? 0 : 0.05) + (b.garbage > 60 ? 0.03 : 0);
    const targetSick = (sickBase + env) * (1 - 0.65 * Math.min(1, hc) * (s.rt.ratio.health ?? 1)) * (1 - (s.rt.cityEffect.health || 0));
    b.sick = (b.sick || 0) + (targetSick - (b.sick || 0)) * 0.2;
    if (r > 0) { sickT += b.sick * r; popT += r; healthCovT += Math.min(1, hc) * r; }
    // ölüm
    if (r > 0) {
      const rate = 0.0035 * (1 + b.sick * 6) * (0.6 + s.ageFrac[3] * 3) / 12;
      b.deadAcc = (b.deadAcc || 0) + r * rate;
      while (b.deadAcc >= 1) { b.deadAcc -= 1; b.dead = (b.dead || 0) + 1; s.rt.deathsThisMonth++; }
      const dc = bCov(s, b, 'death');
      if (b.dead > 0 && dc > 0.03 && (s.rt.ratio.death ?? 0) > 0.05) { s.rt.bodiesCollected += b.dead; b.dead = 0; }
      deadWaiting += b.dead || 0;
    }
    // suç
    const pc = bCov(s, b, 'police');
    const base = 0.5 * (1 + unemp * 4) * crimeCity * (b.kind === 'zone' && ZONES[b.type].group === 'C' ? 1.3 : 1) * (s.district[i] && s.districts.find((q) => q.id === s.district[i])?.policies?.gated ? 0.6 : 1);
    b.crime = clamp((b.crime || 0) * 0.985 + base - pc * 3.2 * (s.rt.ratio.police ?? 1) * prison * (s.rt.prisonOk ?? 1), 0, 100);
    s.crimeMap[i] = b.crime / 100;
    crimeT += b.crime * Math.max(1, r);
    // mutluluk (konut)
    if (r > 0) {
      const h = happinessOf(s, b, i);
      b.happy = b.happy + (h - b.happy) * 0.25;
      happyT += b.happy * r; nRes++;
    } else if (j > 0) {
      b.happy = b.happy + (60 + (b.power ? 0 : -15) + (b.water ? 0 : -10) - b.crime * 0.2 - (b.garbage > 60 ? 10 : 0) - b.happy) * 0.25;
    }
    void pollutedWaterHit;
  }
  s.stats.garbageGen = garbageGen;
  s.stats.sickRate = popT > 0 ? sickT / popT : 0;
  s.stats.healthCov = popT > 0 ? healthCovT / popT : 0;
  s.stats.crimeRate = popT > 0 ? crimeT / Math.max(1, popT) : 0;
  s.stats.happiness = popT > 0 ? happyT / popT : 60;
  s.stats.deadWaiting = deadWaiting;
  // küresel oranlar (kapasite / talep)
  const pop = Math.max(1, s.stats.pop || 0);
  s.rt.ratio = {
    garbage: garbageGen > 0 ? Math.min(1, (cap.garbage || 0) / garbageGen) : 1,
    health: Math.min(1, (cap.health || 0) / pop),
    police: Math.min(1, (cap.police || 0) / pop),
    death: deathCapacity(s),
  };
  s.rt.cap = cap;
}

function deathCapacity(s) {
  let free = 0;
  for (const id in s.buildings) {
    const b = s.buildings[id]; if (b.kind !== 'svc') continue;
    const d = SERVICES[b.type];
    if (d.svc && d.svc.type === 'death') {
      if (d.storage) free += Math.max(0, d.storage - (b.stored || 0)) * (b.eff ?? 1);
      if (d.processing) free += d.processing * (b.eff ?? 1);
    }
  }
  return Math.min(1, free / 50);
}

export function happinessOf(s, b, i) {
  const c = s.cov;
  const a = b.access ?? -1;
  const cv = (t) => Math.min(1, Math.max(c[t][i], a >= 0 ? c[t][a] : 0));
  let h = 51;
  h += b.power ? 4 : -16;
  h += b.water ? 4 : -14;
  h += b.sewage ? 3 : -12;
  h += (b.waterPol || 0) > 0.2 ? -10 : 0;
  h += cv('health') * 7 + cv('police') * 5 + cv('fire') * 5 + (cv('edu1') + cv('edu2')) * 3 + cv('park') * 10 + cv('telecom') * 4 + cv('post') * 3 + c.transit[i] * 4 + cv('welfare') * 3;
  h -= b.garbage > 60 ? 10 : b.garbage > 30 ? 4 : 0;
  h -= (b.dead || 0) > 0 ? 8 : 0;
  h -= s.polG[i] * 16 + s.polA[i] * 14 + s.polN[i] * 10;
  h -= (b.crime || 0) * 0.12;
  h -= (b.sick || 0) * 40;
  h += (10 - s.taxes.res) * 1.4;
  h -= (s.stats.unemployment || 0) * 45;
  h += s.lv[i] * 0.06;
  // ücretler
  const f = s.fees; h -= ((f.electricity - 100) + (f.water - 100) + (f.garbage - 100) + (f.health - 100) + (f.education - 100)) * 0.02;
  // yakındaki simge yapılar
  h += s.rt.happyMap ? s.rt.happyMap[i] : 0;
  h += s.rt.cityEffect.happiness || 0;
  if (s.policies.parking_fees && s.district[i] && s.districts.find((q) => q.id === s.district[i])?.policies?.parking_fees) h -= 2;
  return clamp(h, 0, 100);
}

export { budgetKey };
