// Tohumlu rastgele sayı üreteci ve gürültü fonksiyonları
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function makeNoise(seed) {
  const val = (x, y) => hash2(x, y, seed) * 2 - 1;
  const smooth = (t) => t * t * (3 - 2 * t);
  function noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = smooth(x - x0), ty = smooth(y - y0);
    const a = val(x0, y0), b = val(x0 + 1, y0), c = val(x0, y0 + 1), d = val(x0 + 1, y0 + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  function fbm(x, y, oct = 4) {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }
  return { noise, fbm };
}

// Rastgele yardımcılar (Math.random tabanlı – oyun içi olaylar için)
export const rnd = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const rndi = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const chance = (p) => Math.random() < p;
