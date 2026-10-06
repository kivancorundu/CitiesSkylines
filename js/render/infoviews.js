// Bilgi görünümleri (CS2: Info Views) – katman renkleri ve bina renklendirme
import { N, TILE, TILES, clamp } from '../core/constants.js';
import { ZONES, RESOURCES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { ROADS } from '../data/roads.js';
import { residents } from '../sim/buildings.js';

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const zoneRGB = {}; for (const k in ZONES) zoneRGB[k] = hex(parseInt(ZONES[k].color.slice(1), 16));
const grad = (t, stops) => {
  t = clamp(t, 0, 1); const n = stops.length - 1; const i = Math.min(n - 1, Math.floor(t * n)); const f = t * n - i;
  const a = stops[i], b = stops[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};
const RG = [[220, 50, 40], [240, 200, 40], [60, 190, 70]];
const GR = [[60, 190, 70], [240, 200, 40], [220, 50, 40]];
const BLUE = [[20, 40, 90], [40, 130, 220], [140, 220, 255]];
const toHex = ([r, g, b]) => ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
const covView = (key, name, icon, color) => ({ key, name, icon, cov: key === 'education' ? ['edu1', 'edu2', 'edu3', 'edu4'] : [key], color });

export const INFO_VIEWS = [
  { key: 'electricity', name: 'Elektrik', icon: '⚡' },
  { key: 'water', name: 'Su', icon: '💧' },
  { key: 'sewage', name: 'Kanalizasyon', icon: '🚽' },
  { key: 'landvalue', name: 'Arazi Değeri', icon: '💰' },
  { key: 'polG', name: 'Toprak Kirliliği', icon: '🟤' },
  { key: 'polA', name: 'Hava Kirliliği', icon: '🌫️' },
  { key: 'polN', name: 'Gürültü Kirliliği', icon: '🔊' },
  { key: 'polW', name: 'Su Kirliliği', icon: '☣️' },
  { key: 'traffic', name: 'Trafik', icon: '🚦' },
  { key: 'happiness', name: 'Mutluluk', icon: '😊' },
  { key: 'crime', name: 'Suç', icon: '🚨' },
  covView('health', 'Sağlık', '🏥', [230, 80, 80]),
  covView('death', 'Defin', '⚰️', [150, 120, 180]),
  covView('garbage', 'Çöp', '🗑️', [140, 170, 70]),
  covView('education', 'Eğitim', '🎓', [80, 140, 230]),
  covView('fire', 'İtfaiye', '🚒', [240, 110, 40]),
  covView('police', 'Polis', '🚓', [60, 100, 220]),
  covView('park', 'Eğlence / Parklar', '🌳', [70, 190, 90]),
  covView('telecom', 'Telekom', '📡', [180, 90, 220]),
  covView('post', 'Posta', '📮', [230, 180, 40]),
  covView('transit', 'Toplu Taşıma', '🚌', [50, 160, 230]),
  { key: 'level', name: 'Bina Seviyesi', icon: '⭐' },
  { key: 'zones', name: 'Bölgeler', icon: '🏘️' },
  { key: 'resources', name: 'Doğal Kaynaklar', icon: '⛏️' },
  { key: 'groundwater', name: 'Yeraltı Suyu', icon: '🌊' },
  { key: 'wind', name: 'Rüzgar', icon: '🌬️' },
  { key: 'districts', name: 'İlçeler', icon: '🗺️' },
  { key: 'tiles', name: 'Harita Karoları', icon: '🧩' },
];

// opts: { view, tool: { zoning, district, tiles, zoneGrid } }
export function buildOverlay(s, out, opts) {
  const view = opts.view; const zd = s.rt.zdepth;
  out.fill(0);
  const C = N * N;
  const set = (i, r, g, b, a) => { const o = i * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a; };
  // varsayılan: imar edilmiş boş hücreler
  const showZones = !view || view === 'zones';
  for (let i = 0; i < C; i++) {
    if (showZones && s.zone[i]) {
      const c = zoneRGB[s.zone[i]];
      if (s.bld[i] < 0) set(i, c[0], c[1], c[2], opts.tool?.zoning ? 170 : 75);
      else if (opts.tool?.zoning) set(i, c[0], c[1], c[2], 70);
    } else if (opts.tool?.zoning && zd && zd[i] && !s.road[i] && s.bld[i] < 0) set(i, 255, 255, 255, 40);
  }
  if (view) {
    const v = INFO_VIEWS.find((q) => q.key === view);
    for (let i = 0; i < C; i++) {
      if (s.road[i] && !['electricity', 'water', 'sewage', 'districts', 'transit', 'tiles'].includes(view)) continue;
      let c = null, a = 150;
      switch (view) {
        case 'electricity': if (s.power[i]) { c = [255, 220, 40]; a = 220; } else if (s.road[i]) { c = [240, 200, 60]; a = 110; } break;
        case 'water': if (s.pipeW[i]) { c = [40, 150, 255]; a = 230; } else if (s.water[i] && s.polW[i] > 0.05) { c = grad(s.polW[i], [[60, 140, 200], [120, 90, 40]]); a = 200; } break;
        case 'sewage': if (s.pipeS[i]) { c = [150, 100, 50]; a = 230; } break;
        case 'landvalue': if (!s.water[i]) { c = grad(s.lv[i] / 100, [[60, 60, 200], [60, 200, 80], [250, 230, 60], [240, 80, 40]]); a = 140; } break;
        case 'polG': if (s.polG[i] > 0.03) { c = [130, 80, 30]; a = clamp(s.polG[i] * 230, 0, 210); } break;
        case 'polA': if (s.polA[i] > 0.03) { c = [120, 60, 140]; a = clamp(s.polA[i] * 230, 0, 210); } break;
        case 'polN': if (s.polN[i] > 0.05) { c = grad(s.polN[i], [[240, 220, 60], [230, 60, 40]]); a = clamp(s.polN[i] * 220, 0, 200); } break;
        case 'polW': if (s.water[i]) { c = grad(s.polW[i], [[40, 140, 230], [140, 100, 40]]); a = 200; } break;
        case 'crime': if (s.crimeMap[i] > 0.02) { c = grad(s.crimeMap[i], GR); a = 170; } break;
        case 'resources': if (s.res[i]) { const r = RESOURCES[s.res[i]].color; c = [r[0] * 255, r[1] * 255, r[2] * 255]; a = 170; } break;
        case 'groundwater': if (!s.water[i]) { c = grad(s.gw[i], BLUE); a = 150; } break;
        case 'wind': if (!s.water[i]) { c = grad(s.wind[i], [[200, 200, 220], [120, 200, 240], [40, 90, 230]]); a = 140; } break;
        case 'districts': if (s.district[i]) { const d = s.districts.find((q) => q.id === s.district[i]); if (d) { c = hex(parseInt(d.color.slice(1), 16)); a = 120; } } break;
        case 'happiness': case 'level': case 'zones': case 'traffic': break;
        default:
          if (v && v.cov) {
            let m = 0; for (const k of v.cov) m = Math.max(m, s.cov[k][i]);
            if (m > 0.02) { c = v.color; a = clamp(m * 200, 30, 190); }
          }
      }
      if (c) set(i, c[0], c[1], c[2], a);
    }
  }
  // ilçe aracı
  if (opts.tool?.district && view !== 'districts') {
    for (let i = 0; i < C; i++) if (s.district[i]) { const d = s.districts.find((q) => q.id === s.district[i]); if (d) { const c = hex(parseInt(d.color.slice(1), 16)); set(i, c[0], c[1], c[2], 110); } }
  }
  // imar ızgarası: imar edilebilir hücrelerde alfa tek sayı (gölgelendirici ızgara çizer)
  if (opts.tool?.zoning && zd) {
    for (let i = 0; i < C; i++) { const o = i * 4 + 3; if (zd[i] && !s.road[i]) out[o] = Math.max(41, out[o]) | 1; else out[o] &= 0xfe; }
  }
  // sahip olunmayan karolar karartılır
  const tilesTool = opts.tool?.tiles || view === 'tiles';
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const t = ((z / TILE) | 0) * TILES + ((x / TILE) | 0);
    if (s.owned[t]) {
      if (tilesTool) { const fx = x % TILE, fz = z % TILE; if (fx === 0 || fz === 0) set(z * N + x, 255, 255, 255, 90); }
      continue;
    }
    const i = z * N + x;
    if (tilesTool) {
      const ok = opts.buyable && opts.buyable.has(t);
      const fx = x % TILE, fz = z % TILE; const edge = fx === 0 || fz === 0 || fx === TILE - 1 || fz === TILE - 1;
      if (ok) set(i, 80, 200, 255, edge ? 200 : 70); else set(i, 0, 0, 0, edge ? 120 : 90);
    } else set(i, 10, 15, 25, 70);
  }
}

// Bina renklendirme
export function buildingTint(s, view) {
  if (!view || ['tiles', 'districts', 'resources', 'groundwater', 'wind', 'polW'].includes(view)) return null;
  switch (view) {
    case 'electricity': return (b) => { const d = b.kind === 'svc' ? SERVICES[b.type] : null; if (d?.prod?.power || d?.prod?.battery) return 0x3060e0; return b.power ? 0x50c060 : 0xe03030; };
    case 'water': return (b) => { const d = b.kind === 'svc' ? SERVICES[b.type] : null; if (d?.prod?.water) return 0x3060e0; if (!b.water) return 0xe03030; return (b.waterPol || 0) > 0.15 ? 0xa07030 : 0x50c060; };
    case 'sewage': return (b) => { const d = b.kind === 'svc' ? SERVICES[b.type] : null; if (d?.prod?.sewage) return 0x8a5a2a; return b.sewage ? 0x50c060 : 0xe03030; };
    case 'happiness': return (b) => (residents(b) > 0 || b.kind === 'zone' ? toHex(grad(b.happy / 100, RG)) : 0x888888);
    case 'crime': return (b) => toHex(grad((b.crime || 0) / 100, GR));
    case 'health': return (b) => (residents(b) > 0 ? toHex(grad((b.sick || 0) * 5, GR)) : 0x888888);
    case 'garbage': return (b) => toHex(grad((b.garbage || 0) / 80, GR));
    case 'death': return (b) => ((b.dead || 0) > 0 ? 0xe03030 : 0x888888);
    case 'level': return (b) => (b.kind === 'zone' ? [0, 0xa0a0a0, 0x60b0e0, 0x50c060, 0xe0c040, 0xe05030][b.level] : 0x888888);
    case 'zones': return (b) => (b.kind === 'zone' ? parseInt(ZONES[b.type].color.slice(1), 16) : 0x888888);
    case 'landvalue': return (b) => toHex(grad(s.lv[b.x + b.z * N] / 100, [[60, 60, 200], [60, 200, 80], [250, 230, 60], [240, 80, 40]]));
    default: return () => 0x9a9a9a;
  }
}

export function roadTint(s, view) {
  if (view === 'traffic') return (i) => toHex(grad(s.traffic[i] / ROADS[s.road[i]].cap, [[60, 200, 80], [240, 210, 40], [230, 50, 30]]));
  if (view === 'transit') return (i) => (s.road[i] === 5 ? 0x3a70c0 : null);
  return null;
}
