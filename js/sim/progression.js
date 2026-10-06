// Deneyim puanı, kilometre taşları, gelişim ağacı ve kilitler
import { MILESTONES, DEV_TREE, FEATURES } from '../data/progression.js';
import { SERVICES, CATEGORIES } from '../data/services.js';
import { ZONES } from '../data/zones.js';
import { TILES } from '../core/constants.js';

export function isUnlocked(s, spec) {
  if (spec === undefined || spec === null) return true;
  if (typeof spec === 'number') return s.milestone >= spec;
  return !!s.devNodes[spec];
}

export function featureOn(s, key) { return s.milestone >= (FEATURES[key] ?? 0); }

export function categoryUnlocked(s, catKey) {
  const c = CATEGORIES.find((q) => q.key === catKey); return c ? s.milestone >= c.unlock : true;
}

export function serviceUnlocked(s, key) {
  const d = SERVICES[key];
  if (!categoryUnlocked(s, d.cat)) return false;
  return isUnlocked(s, d.unlock);
}

export function zoneUnlocked(s, t) { return s.milestone >= ZONES[t].unlock; }

export function addXP(s, amount) {
  if (!(amount > 0)) return;
  s.xp += amount;
  checkMilestones(s);
}

export function checkMilestones(s) {
  while (s.milestone < MILESTONES.length - 1 && s.xp >= MILESTONES[s.milestone + 1].xp) {
    s.milestone++;
    const m = MILESTONES[s.milestone];
    s.money += m.money; s.devPoints += m.dp;
    s.rt.events.push({ type: 'milestone', m: s.milestone });
  }
}

export function allowedTiles(s) {
  let t = 0; for (let i = 0; i <= s.milestone; i++) t += MILESTONES[i].tiles;
  return Math.min(TILES * TILES, t);
}
export function ownedTiles(s) { let n = 0; for (const v of s.owned) n += v; return n; }
export function tileCost(s) { return 15000 + (ownedTiles(s) - 9) * 6000; }

export function devNodeById(id) {
  for (const cat in DEV_TREE) for (const n of DEV_TREE[cat]) if (n.id === id) return { ...n, cat };
  return null;
}

export function canUnlockNode(s, id) {
  const n = devNodeById(id); if (!n) return [false, 'Bilinmeyen'];
  if (s.devNodes[id]) return [false, 'Zaten açık'];
  if (!categoryUnlocked(s, n.cat)) return [false, 'Kategori kilitli'];
  if (n.req && !s.devNodes[n.req]) return [false, 'Önce: ' + devNodeById(n.req).name];
  if (s.devPoints < n.cost) return [false, 'Yetersiz gelişim puanı'];
  return [true, ''];
}

export function unlockNode(s, id) {
  const [ok, why] = canUnlockNode(s, id);
  if (!ok) return { ok, msg: why };
  const n = devNodeById(id);
  s.devPoints -= n.cost; s.devNodes[id] = true;
  return { ok: true, msg: n.name + ' açıldı' };
}

// Aylık XP: nüfus artışı + mutluluk
export function monthlyXP(s) {
  const pop = s.stats.pop || 0;
  if (pop > s.maxPop) { addXP(s, (pop - s.maxPop) * 1); s.maxPop = pop; }
  const h = s.stats.happiness ?? 50;
  if (h > 55) addXP(s, (pop / 250) * ((h - 55) / 45) * 3);
  // araştırma tesisi gelişim puanı
  if (s.rt.cityEffect.research) {
    s.rt.dpAcc = (s.rt.dpAcc || 0) + 0.25 * s.rt.cityEffect.research;
    if (s.rt.dpAcc >= 1) { s.devPoints += 1; s.rt.dpAcc -= 1; }
  }
}
