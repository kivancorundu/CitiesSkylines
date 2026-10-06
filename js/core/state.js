// Oyun durumu: oluşturma, harita üretimi, kaydet/yükle serileştirme
import { N, TILE, TILES, idx, vidx, inB, clamp, tileOf } from './constants.js';
import { makeNoise, mulberry32 } from './rng.js';
import { CITY_NAMES } from '../data/names.js';

const ARRAYS_U8 = ['water', 'road', 'roadUp', 'zone', 'pipeW', 'pipeS', 'power', 'rail', 'metro', 'district', 'tree', 'res', 'owned', 'outside'];
const ARRAYS_F32 = ['vh', 'resAmt', 'gw', 'wind', 'polG', 'polA', 'polN', 'polW', 'lv', 'traffic', 'crimeMap'];
export const COV_TYPES = ['health', 'death', 'garbage', 'edu1', 'edu2', 'edu3', 'edu4', 'fire', 'police', 'park', 'post', 'telecom', 'shelter', 'welfare', 'transit'];

export function createState(seed = (Math.random() * 1e9) | 0, cityName) {
  const C = N * N;
  const s = {
    version: 1,
    seed,
    cityName: cityName || CITY_NAMES[seed % CITY_NAMES.length],
    vh: new Float32Array((N + 1) * (N + 1)),
    water: new Uint8Array(C), road: new Uint8Array(C), roadUp: new Uint8Array(C), zone: new Uint8Array(C),
    bld: new Int32Array(C).fill(-1),
    pipeW: new Uint8Array(C), pipeS: new Uint8Array(C), power: new Uint8Array(C),
    rail: new Uint8Array(C), metro: new Uint8Array(C), district: new Uint8Array(C), tree: new Uint8Array(C),
    res: new Uint8Array(C), resAmt: new Float32Array(C), gw: new Float32Array(C), wind: new Float32Array(C),
    owned: new Uint8Array(TILES * TILES), outside: new Uint8Array(C),
    polG: new Float32Array(C), polA: new Float32Array(C), polN: new Float32Array(C), polW: new Float32Array(C),
    lv: new Float32Array(C).fill(20), traffic: new Float32Array(C), crimeMap: new Float32Array(C),
    cov: {},
    buildings: {}, nextId: 1,
    money: 350000, loan: 0,
    taxes: { res: 10, com: 10, ind: 10, off: 10 },
    fees: { electricity: 100, water: 100, garbage: 100, health: 100, education: 100, transit: 100 },
    budgets: { electricity: 100, water: 100, health: 100, garbage: 100, education: 100, fire: 100, police: 100, transport: 100, parks: 100, comms: 100, landmarks: 100 },
    time: { tick: 0, month: 4, year: 2026, tod: 8, monthsElapsed: 0 },
    xp: 0, milestone: 0, devPoints: 0, devNodes: {}, maxPop: 0,
    policies: {},
    districts: [],
    lines: [], nextLineId: 1,
    history: [],
    chirps: [],
    weather: { state: 'clear', temp: 15, cloud: 0.2, rain: 0, snow: 0, windStrength: 0.6, timer: 0, snowCover: 0 },
    settings: { disasters: true, autoDemolish: true, shadows: true, edgeScroll: false, dayNight: true },
    edu: [0, 0, 0, 0, 0],     // yetişkin eğitim seviyesi sayıları
    ageFrac: [0.2, 0.1, 0.55, 0.15],
    econ: { inc: {}, exp: {}, last: null, lastMonthBalance: 0 },
    demand: { res: 0.6, resLow: 0.7, resMed: 0.2, resHigh: 0, com: 0.3, ind: 0.5, off: 0 },
    stats: {},
    tracked: [],
    resources: {},
    battery: {},
    landfillStored: {},
  };
  for (const t of ['health', 'death', 'garbage', 'edu1', 'edu2', 'edu3', 'edu4', 'fire', 'police', 'park', 'post', 'telecom', 'shelter', 'welfare', 'transit']) s.cov[t] = new Float32Array(C);
  generateMap(s);
  return s;
}

// ---------------- Harita üretimi ----------------
function generateMap(s) {
  const nz = makeNoise(s.seed), nz2 = makeNoise(s.seed + 11), nz3 = makeNoise(s.seed + 23), nz4 = makeNoise(s.seed + 37), nz5 = makeNoise(s.seed + 51);
  const rand = mulberry32(s.seed + 5);
  const N1 = N + 1;
  const riverX = (z) => N * 0.565 + Math.sin(z * 0.045 + s.seed % 7) * 6 + nz.noise(z * 0.03, 3.3) * 5 + Math.max(0, Math.abs(z - N / 2) - 30) * 0.25;
  const lakeCx = N * 0.2 + rand() * 10, lakeCz = N * 0.82 + rand() * 6, lakeR = 13 + rand() * 4;
  const startC = N / 2;
  for (let z = 0; z <= N; z++) {
    for (let x = 0; x <= N; x++) {
      const e = nz.fbm(x * 0.018, z * 0.018, 5);
      // kenarlara doğru dağlar
      const dx = (x - startC) / (N / 2), dz = (z - startC) / (N / 2);
      const edge = clamp(Math.max(Math.abs(dx), Math.abs(dz)) - 0.55, 0, 1) / 0.45;
      const ridge = 1 - Math.abs(nz2.fbm(x * 0.03, z * 0.03, 4));
      const centerFlat = 1 - clamp(1 - Math.hypot(dx, dz) * 1.6, 0, 1) * 0.65;
      let h = 3 + e * 9 * centerFlat + edge * edge * ridge * 55;
      // nehir
      const rd = Math.abs(x - riverX(z));
      const rw = 3.2 + nz3.noise(z * 0.05, 1) * 1.2;
      if (rd < rw) h = -4.5 + (rd / rw) * 2;
      else if (rd < rw + 6) h = Math.min(h, -2.5 + ((rd - rw) / 6) * (h + 2.5) + 1.2);
      // göl
      const ld = Math.hypot(x - lakeCx, z - lakeCz);
      if (ld < lakeR) h = Math.min(h, -4 + (ld / lakeR) * 3.0);
      else if (ld < lakeR + 6) h = Math.min(h, -1 + ((ld - lakeR) / 6) * (h + 1));
      s.vh[z * N1 + x] = h;
    }
  }
  // hücre özellikleri
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const i = idx(x, z);
      const a = s.vh[vidx(x, z)], b = s.vh[vidx(x + 1, z)], c = s.vh[vidx(x, z + 1)], d = s.vh[vidx(x + 1, z + 1)];
      const h = (a + b + c + d) / 4;
      if (h < -0.8) s.water[i] = 1;
      s.gw[i] = clamp(0.5 + nz4.fbm(x * 0.04, z * 0.04, 3) * 1.1 - (h > 15 ? 0.3 : 0), 0, 1);
      s.wind[i] = clamp(0.35 + h / 40 + nz5.fbm(x * 0.03, z * 0.03, 2) * 0.35, 0.1, 1);
      if (s.water[i]) continue;
      const slope = Math.max(Math.abs(a - d), Math.abs(b - c));
      const fert = nz3.fbm(x * 0.05 + 100, z * 0.05, 3);
      const forest = nz4.fbm(x * 0.06 + 50, z * 0.06 + 50, 3);
      const oil = nz5.fbm(x * 0.07 + 200, z * 0.07, 2);
      const ore = nz2.fbm(x * 0.06 + 300, z * 0.06, 3);
      if (h > 14 && ore > 0.25) { s.res[i] = 4; s.resAmt[i] = 1; }
      else if (oil > 0.42 && h < 10) { s.res[i] = 3; s.resAmt[i] = 1; }
      else if (forest > 0.22) { s.res[i] = 2; s.resAmt[i] = 1; }
      else if (fert > 0.18 && h < 8 && slope < 2) { s.res[i] = 1; s.resAmt[i] = 1; }
      // ağaçlar
      if (s.res[i] === 2) s.tree[i] = 2 + (rand() * 2) | 0;
      else if (forest > 0.05 && rand() < 0.5) s.tree[i] = 1;
      else if (rand() < 0.025) s.tree[i] = 1;
    }
  }
  // başlangıç karoları (orta 3x3)
  const t0 = TILES / 2 - 1.5 | 0;
  for (let tz = t0; tz < t0 + 3; tz++) for (let tx = t0; tx < t0 + 3; tx++) s.owned[tz * TILES + tx] = 1;
  // başlangıç otoyolu (batı kenarından) – CS2'de harita otoyol bağlantısıyla başlar
  const hz = (N / 2) | 0;
  const startX = t0 * TILE + 4;
  for (let x = 0; x <= startX; x++) {
    const i = idx(x, hz);
    s.road[i] = 6; s.tree[i] = 0; s.res[i] = 0;
    s.power[idx(x, hz - 1)] = x < startX - 1 ? 1 : 0; // dış elektrik bağlantısı hattı
    s.tree[idx(x, hz - 1)] = 0;
  }
  s.outside[idx(0, hz)] = 1;           // otoyol dış bağlantısı
  s.outside[idx(0, hz - 1)] = 2;       // elektrik dış bağlantısı
  // otoyolun bittiği yerden küçük bir bağlantı yolu
  for (let x = startX + 1; x <= startX + 3; x++) { const i = idx(x, hz); s.road[i] = 3; s.tree[i] = 0; }
  // dış tren bağlantısı (kuzey kenar)
  s.outsideRail = { x: (N * 0.45) | 0, z: 0 };
  // yolların altındaki araziyi düzle
  for (let x = 0; x <= startX + 3; x++) flattenCell(s, x, hz, null, true);
}

// Hücrenin köşe yüksekliklerini hedefe yaklaştır
export function flattenCell(s, x, z, target = null, allowWater = false) {
  const N1 = N + 1;
  const vs = [vidx(x, z), vidx(x + 1, z), vidx(x, z + 1), vidx(x + 1, z + 1)];
  let avg = 0; for (const v of vs) avg += s.vh[v]; avg /= 4;
  let t = target === null ? avg : target;
  if (!allowWater && t < 0.2) t = 0.2;
  if (s.water[idx(x, z)] && allowWater) return; // köprü – arazi değişmez
  for (const v of vs) s.vh[v] = t;
  void N1;
}

// ---------------- Serileştirme ----------------
function u8ToB64(arr) {
  let s = ''; const CH = 0x8000;
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}
function b64ToBytes(b64) {
  const s = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function serialize(s) {
  const o = {};
  for (const k of Object.keys(s)) {
    if (k === 'rt') continue;
    const v = s[k];
    if (v instanceof Uint8Array || v instanceof Float32Array || v instanceof Int32Array) o[k] = { __t: v.constructor.name, d: u8ToB64(v) };
    else if (k === 'cov') { o.cov = {}; for (const t in v) o.cov[t] = { __t: 'Float32Array', d: u8ToB64(v[t]) }; }
    else if (k === 'buildings') {
      o.buildings = {};
      for (const id in v) { const b = { ...v[id] }; for (const kk of Object.keys(b)) if (kk.startsWith('_')) delete b[kk]; o.buildings[id] = b; }
    } else o[k] = v;
  }
  return JSON.stringify(o);
}

export function deserialize(json) {
  const o = JSON.parse(json);
  const fix = (v) => {
    if (v && v.__t) {
      const bytes = b64ToBytes(v.d);
      const T = { Uint8Array, Float32Array, Int32Array }[v.__t];
      return new T(bytes.buffer, 0, bytes.byteLength / T.BYTES_PER_ELEMENT);
    }
    return v;
  };
  for (const k of Object.keys(o)) o[k] = fix(o[k]);
  for (const t in o.cov) o.cov[t] = fix(o.cov[t]);
  return o;
}

export { ARRAYS_U8, ARRAYS_F32, inB, tileOf };
