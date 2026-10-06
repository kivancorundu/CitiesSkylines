// Chirper (şehir sosyal medyası) ve Yaşam Yolu (takip edilen vatandaşlar)
import { CHIRPS, FIRST, LAST, HANDLES } from '../data/names.js';
import { MILESTONES } from '../data/progression.js';
import { MONTHS } from '../core/constants.js';
import { pick } from '../core/rng.js';
import { residents } from './buildings.js';

export function chirp(s, key, vars = {}) {
  const arr = CHIRPS[key]; if (!arr) return;
  let text = pick(arr);
  for (const k in vars) text = text.replace('{' + k + '}', vars[k]);
  const name = pick(FIRST) + ' ' + pick(LAST);
  const handle = pick(HANDLES) + ((Math.random() * 999) | 0);
  s.chirps.unshift({ name, handle, text, date: `${MONTHS[s.time.month]} ${s.time.year}`, likes: (Math.random() * 300) | 0, key });
  if (s.chirps.length > 60) s.chirps.length = 60;
  s.rt.newChirp = true;
}

function cool(s, key, months) {
  s.rt.chirpCd = s.rt.chirpCd || {};
  const last = s.rt.chirpCd[key] ?? -99;
  if (s.time.monthsElapsed - last < months) return false;
  s.rt.chirpCd[key] = s.time.monthsElapsed; return true;
}

export function chirperMonthly(s) {
  const st = s.stats; const pop = st.pop || 0;
  if (pop < 10) return;
  const n = Object.keys(s.buildings).length || 1;
  const P = st.power || {}, W = st.water || {}, S = st.sewage || {};
  if (P.unserved > n * 0.05 && cool(s, 'noPower', 3)) chirp(s, 'noPower');
  if (W.unserved > n * 0.05 && cool(s, 'noWater', 3)) chirp(s, 'noWater');
  if (S.unserved > n * 0.05 && cool(s, 'noSewage', 3)) chirp(s, 'noSewage');
  if ((s.rt.ratio?.garbage ?? 1) < 0.6 && pop > 150 && cool(s, 'garbage', 4)) chirp(s, 'garbage');
  if (st.deadWaiting > 3 && cool(s, 'dead', 4)) chirp(s, 'dead');
  if (st.crimeRate > 30 && cool(s, 'crime', 4)) chirp(s, 'crime');
  if (st.sickRate > 0.08 && cool(s, 'sick', 4)) chirp(s, 'sick');
  if (st.trafficFlow < 55 && cool(s, 'traffic', 5)) chirp(s, 'traffic');
  if (st.unemployment > 0.12 && cool(s, 'noJobs', 4)) chirp(s, 'noJobs');
  if (st.vacancy > 0.35 && pop > 300 && cool(s, 'workers', 5)) chirp(s, 'workers');
  if (s.taxes.res > 14 && cool(s, 'taxesHigh', 5)) chirp(s, 'taxesHigh');
  if (s.taxes.res < 8 && cool(s, 'taxesLow', 8)) chirp(s, 'taxesLow');
  if ((st.eduCoverage?.[0] ?? 0) < 0.3 && s.milestone >= 2 && pop > 400 && cool(s, 'education', 6)) chirp(s, 'education');
  if (st.happiness > 70 && cool(s, 'happy', 2)) chirp(s, 'happy');
  if (st.tourists > 1000 && cool(s, 'tourism', 6)) chirp(s, 'tourism');
  if (st.transitRiders > 200 && cool(s, 'transit', 8)) chirp(s, 'transit');
  if (s.money < 0 && cool(s, 'bankrupt', 3)) chirp(s, 'bankrupt');
  if (s.time.month === 0 && s.weather.snow > 0.2 && cool(s, 'winter', 10)) chirp(s, 'winter');
  if (s.time.month === 6 && cool(s, 'summer', 10)) chirp(s, 'summer');
}

export function chirpEvent(s, e) {
  if (e.type === 'milestone') chirp(s, 'milestone', { m: MILESTONES[e.m].name });
  else if (e.type === 'fire' && cool(s, 'fire', 1)) chirp(s, 'fire');
  else if (e.type === 'lightning') chirp(s, 'lightning');
  else if (e.type === 'tornado') chirp(s, 'disaster');
  else if (e.type === 'abandoned' && cool(s, 'abandoned', 3)) chirp(s, 'abandoned');
}

// ---------- Yaşam Yolu ----------
const EDU = ['Eğitimsiz', 'Az eğitimli', 'Eğitimli', 'İyi eğitimli', 'Yüksek eğitimli'];

export function followRandomCitizen(s) {
  const homes = Object.values(s.buildings).filter((b) => residents(b) > 0 && !b.abandoned);
  if (!homes.length) return null;
  const h = pick(homes);
  const c = { id: Date.now() + ((Math.random() * 1000) | 0), name: pick(FIRST) + ' ' + pick(LAST), age: 18 + ((Math.random() * 50) | 0), edu: (Math.random() * 3) | 0, home: h.id, job: null, alive: true, happy: h.happy, log: [] };
  c.log.push({ d: `${MONTHS[s.time.month]} ${s.time.year}`, t: `${h.name} adresine taşındı.` });
  s.tracked.push(c);
  if (s.tracked.length > 8) s.tracked.shift();
  return c;
}

export function lifepathMonthly(s) {
  const date = `${MONTHS[s.time.month]} ${s.time.year}`;
  for (const c of s.tracked) {
    if (!c.alive) continue;
    const home = s.buildings[c.home];
    if (!home || home.abandoned || home.collapsed) {
      const homes = Object.values(s.buildings).filter((b) => residents(b) > 0 && !b.abandoned);
      if (homes.length) { const h = pick(homes); c.home = h.id; c.log.push({ d: date, t: `Evini kaybetti ve ${h.name} adresine taşındı.` }); }
      else { c.log.push({ d: date, t: 'Şehirden ayrıldı.' }); c.alive = false; continue; }
    }
    const h = s.buildings[c.home]; c.happy = h.happy;
    if (s.time.month === 0) { c.age++; }
    const r = Math.random();
    if (!c.job && c.age < 65 && r < 0.25) {
      const works = Object.values(s.buildings).filter((b) => (b.emp || 0) > 0);
      if (works.length) { const w = pick(works); c.job = w.id; c.log.push({ d: date, t: `${w.name} adresinde işe başladı.` }); }
    } else if (c.job && !s.buildings[c.job]) { c.job = null; c.log.push({ d: date, t: 'İşyeri kapandı, işsiz kaldı.' }); }
    else if (r < 0.03 && c.edu < 4 && (s.stats.eduCoverage?.[Math.min(3, c.edu)] ?? 0) > 0.2) { c.edu++; c.log.push({ d: date, t: `Mezun oldu: ${EDU[c.edu]}.` }); }
    else if (r > 0.97 && h.sick > 0.05) { c.log.push({ d: date, t: 'Hastalandı ve tedavi gördü.' }); }
    else if (r > 0.95 && r < 0.97 && c.age > 22 && c.age < 45) { c.log.push({ d: date, t: 'Evlendi! 💍' }); }
    else if (r > 0.93 && r < 0.95 && c.age > 24 && c.age < 42) { c.log.push({ d: date, t: 'Bir bebeği oldu! 👶' }); }
    if (c.age >= 65 && c.job) { c.job = null; c.log.push({ d: date, t: 'Emekli oldu. 🎉' }); }
    if (c.age > 70 && Math.random() < 0.01 * (c.age - 70)) { c.alive = false; c.log.push({ d: date, t: 'Hayatını kaybetti. Huzur içinde yatsın. 🕊️' }); }
    if (c.log.length > 40) c.log.shift();
  }
}

export { EDU };
