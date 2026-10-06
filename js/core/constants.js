// Temel sabitler ve ızgara yardımcıları
export const N = 160;            // harita kenarı (hücre)
export const CS = 8;             // hücre boyutu (metre) – CS2'deki 8 m'lik bölge hücresi
export const TILE = 16;          // harita karosu kenarı (hücre)
export const TILES = N / TILE;   // 10x10 karo
export const WATER_Y = -0.6;     // su seviyesi
export const TICKS_PER_MONTH = 120;
export const ZONE_DEPTH = 6;     // CS2: yoldan 6 hücre derinliğe kadar imar
export const HALF = (N * CS) / 2;

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // D, G, B, K

export const idx = (x, z) => z * N + x;
export const cx = (i) => i % N;
export const cz = (i) => (i / N) | 0;
export const inB = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
export const vidx = (x, z) => z * (N + 1) + x;
export const tileOf = (x, z) => ((z / TILE) | 0) * TILES + ((x / TILE) | 0);

export const worldX = (x) => (x + 0.5) * CS - HALF;
export const worldZ = (z) => (z + 0.5) * CS - HALF;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function cellHeight(state, x, z) {
  const N1 = N + 1, v = state.vh;
  return (v[z * N1 + x] + v[z * N1 + x + 1] + v[(z + 1) * N1 + x] + v[(z + 1) * N1 + x + 1]) / 4;
}

export function heightAt(state, wx, wz) {
  // bilinear yükseklik (dünya koordinatı)
  const fx = clamp((wx + HALF) / CS, 0, N - 0.001), fz = clamp((wz + HALF) / CS, 0, N - 0.001);
  const x = fx | 0, z = fz | 0, tx = fx - x, tz = fz - z, N1 = N + 1, v = state.vh;
  const a = v[z * N1 + x], b = v[z * N1 + x + 1], c = v[(z + 1) * N1 + x], d = v[(z + 1) * N1 + x + 1];
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
}

export function fmtMoney(v) {
  const s = Math.round(Math.abs(v)).toLocaleString('tr-TR');
  return (v < 0 ? '-₺' : '₺') + s;
}
export function fmtNum(v) { return Math.round(v).toLocaleString('tr-TR'); }

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
