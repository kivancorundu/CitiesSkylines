// Prosedürel bina modelleri: her bina küçük parçalardan (kutu, çatı, silindir...) oluşur
import { CS } from '../core/constants.js';
import { mulberry32 } from '../core/rng.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';

let THEME = 'eu';
export function setBuildingTheme(t) { THEME = t || 'eu'; }
const HOUSE_NA = [0xd6dfe6, 0xe9e4d8, 0xb9c7cf, 0xf2f2ee, 0xc9c1b0, 0x9fb3bf, 0xe6d6b8];
const ROOF_NA = [0x3f4248, 0x55504a, 0x2f3338, 0x6a5e52];
const HOUSE = [0xf2e6d0, 0xe8d5b5, 0xd9e3ea, 0xf5f1e6, 0xe6c9a8, 0xcfd8c4, 0xf0d9d9, 0xdcdcdc, 0xe9dcc0];
const ROOF = [0x8a4b3a, 0x5a4a42, 0x6b3f2f, 0x4a5560, 0x7a3a2a, 0x3f3f44, 0x6a5a50];
const APT = [0xe0d6c8, 0xc9b8a3, 0xd8d0c0, 0xbfb6a8, 0xe8e2d4, 0xc4a98a, 0xd5c7b0];
const BRICK = [0xa0563e, 0x8f4b36, 0xb0705a, 0x96604a, 0x8a5a48];
const GLASS = [0x6f8fa8, 0x5c7d96, 0x88a6b8, 0x4f6f86, 0x7b98a6, 0x5f7f8f];
const COM = [0xd7e3f0, 0xe9e2d0, 0xc6d6e6, 0xf0e8d8, 0xe0d0e0];
const AWN = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x16a085, 0xd35400];
const IND = [0xb9b2a5, 0xa8a59c, 0xc2b8a0, 0x9fa6a9, 0xb0a890];
const OFF = [0xcfd6dc, 0xb8c4cc, 0xdfe3e6, 0xa9b6bf, 0xc5cdd3];
const GRASS = 0x6a9a4a, PAVE = 0xb5b0a5, CONC = 0x9c9a94, ASPH = 0x55575a, DIRT = 0x8a7656;

function P(out, g, x, y, z, sx, sy, sz, c, ry = 0) { out.push([g, x, y, z, sx, sy, sz, c, ry]); }
const pick = (R, a) => a[(R() * a.length) | 0];

export function genParts(b) {
  const out = []; const R = mulberry32(b.seed);
  const W = b.w * CS, D = b.d * CS;
  b._smoke = []; b._rotor = null;
  if (b.collapsed) {
    P(out, 'b', 0, 0, 0, W * 0.9, 0.3, D * 0.9, 0x6a625a);
    for (let k = 0; k < 6; k++) P(out, 'k', (R() - 0.5) * W * 0.6, 0, (R() - 0.5) * D * 0.6, 3 + R() * 4, 1.5 + R() * 2.5, 3 + R() * 4, pick(R, [0x7a7068, 0x5f5850, 0x8a7a6a]));
    return out;
  }
  if (b.kind === 'zone') zoneParts(out, b, R, W, D);
  else serviceParts(out, b, R, W, D);
  if (b.built < 1) {
    // inşaat: iskele + vinç
    const H = out.reduce((m, p) => Math.max(m, p[2] + p[5]), 4);
    const h = Math.max(1, H * b.built);
    out.length = 0;
    P(out, 'b', 0, 0, 0, W * 0.92, 0.2, D * 0.92, DIRT);
    P(out, 'b', 0, 0, -D * 0.05, W * 0.7, h, D * 0.6, 0xbfb39a);
    P(out, 'b', 0, h, -D * 0.05, W * 0.74, 0.3, D * 0.64, 0xe0b030);
    if (H > 14) { P(out, 'b', W * 0.38, 0, D * 0.3, 0.8, H + 6, 0.8, 0xe0b030); P(out, 'b', W * 0.1, H + 5.5, D * 0.3, W * 0.7, 0.6, 0.6, 0xe0b030); }
  }
  return out;
}

function floorsFor(R, z, lvl) {
  const [a, b] = z.floors;
  return Math.max(1, Math.round(a + (b - a) * (0.35 * R() + 0.65 * (lvl - 1) / 4)));
}

function zoneParts(out, b, R, W, D) {
  const z = ZONES[b.type]; const lvl = b.level; const fl = floorsFor(R, z, lvl); const H = fl * 3.1;
  switch (z.style) {
    case 'house': {
      P(out, 'b', 0, 0, 0, W - 0.4, 0.15, D - 0.4, GRASS);
      const bw = Math.min(W - 2.5, 7 + R() * 3 + lvl * 0.5), bd = Math.min(D * 0.5, 6.5 + R() * 2);
      const zc = D / 2 - 2.5 - bd / 2; const col = pick(R, THEME === 'na' ? HOUSE_NA : HOUSE);
      P(out, 'w', -W * 0.08, 0, zc, bw, H, bd, col);
      const roofH = 2.4 + R() * 1.2; const rc = pick(R, THEME === 'na' ? ROOF_NA : ROOF);
      if (R() < 0.75) P(out, 'r', -W * 0.08, H, zc, bw + 0.6, roofH, bd + 0.8, rc);
      else { P(out, 'r', -W * 0.08, H, zc, bd + 0.8, roofH, bw + 0.6, rc, Math.PI / 2); }
      if (W > 10) P(out, 'b', W / 2 - 2.6, 0, D / 2 - 4, 3.4, 0.12, 8, ASPH); // araba yolu
      if (lvl >= 3) P(out, 'w', -W * 0.08 + bw / 2 + 1.5, 0, zc, 3, 3, bd * 0.7, col); // ek bina
      if (lvl >= 4 && D > 18) P(out, 'b', -W * 0.15, 0.05, -D / 2 + 4, 4, 0.2, 3, 0x3a8fc0); // havuz
      const tx = (R() - 0.5) * W * 0.6, tz = -D / 2 + 3 + R() * 2;
      P(out, 'c', tx, 0, tz, 0.5, 2, 0.5, 0x6b4a2f); P(out, 's', tx, 1.6, tz, 3.4, 3.8, 3.4, pick(R, [0x4f8a35, 0x5b9a3c, 0x46803a]));
      break;
    }
    case 'row': {
      const col = pick(R, BRICK.concat(APT));
      P(out, 'b', 0, 0, 0, W, 0.15, D, GRASS);
      const bd = D * 0.55; const zc = D / 2 - 1.2 - bd / 2;
      P(out, 'w', 0, 0, zc, W - 0.1, H, bd, col);
      if (R() < 0.6) P(out, 'r', 0, H, zc, W, 2.6, bd + 0.6, pick(R, ROOF));
      else P(out, 'b', 0, H, zc, W, 0.6, bd, 0x5a5550);
      P(out, 'b', 0, 0, D / 2 - 0.6, 1.4, 1.0, 1.2, 0x8a8a8a);
      break;
    }
    case 'apartment': case 'lowrent': {
      const col = z.style === 'lowrent' ? pick(R, BRICK) : pick(R, APT);
      P(out, 'b', 0, 0, 0, W, 0.12, D, z.style === 'lowrent' ? PAVE : GRASS);
      const bw = W * (0.8 + R() * 0.12), bd = D * (0.6 + R() * 0.15);
      const zc = D / 2 - 1.5 - bd / 2;
      P(out, 'w', 0, 0, zc, bw, H, bd, col);
      P(out, 'b', 0, H, zc, bw + 0.4, 0.5, bd + 0.4, 0x6e6a64);
      if (R() < 0.5) P(out, 'b', (R() - 0.5) * bw * 0.4, H + 0.5, zc, 3, 2.4, 3, 0x8a8680);
      if (z.style === 'lowrent' && R() < 0.5) P(out, 'w', bw * 0.25, 0, zc - bd * 0.2, bw * 0.4, H * 0.7, bd * 0.6, col);
      break;
    }
    case 'mixed': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, PAVE);
      const bw = W * 0.92, bd = D * 0.7, zc = D / 2 - 0.8 - bd / 2;
      P(out, 'w', 0, 0, zc, bw, 4.2, bd, pick(R, GLASS));
      P(out, 'b', 0, 3.2, D / 2 - 0.8 + 0.6, bw, 0.3, 1.2, pick(R, AWN));
      P(out, 'w', 0, 4.2, zc - 0.4, bw - 0.6, H - 3, bd - 0.8, pick(R, APT.concat(BRICK)));
      P(out, 'b', 0, H + 1.2, zc - 0.4, bw - 0.2, 0.5, bd - 0.4, 0x6e6a64);
      break;
    }
    case 'tower': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, PAVE);
      const zc = 0; const col = pick(R, APT.concat(GLASS));
      P(out, 'w', 0, 0, zc, W * 0.9, 7, D * 0.85, pick(R, GLASS));
      const tw = W * (0.55 + R() * 0.15), td = D * (0.5 + R() * 0.15);
      P(out, 'w', 0, 7, zc, tw, H, td, col);
      P(out, 'b', 0, 7 + H, zc, tw * 0.6, 2.5, td * 0.6, 0x8a8a8a);
      if (lvl >= 4) P(out, 'w', 0, 7 + H + 2.5, zc, tw * 0.5, 6, td * 0.5, col);
      break;
    }
    case 'shop': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, ASPH);
      const bw = W * 0.88, bd = D * 0.55, zc = D / 2 - 1 - bd / 2; const h = Math.max(4.2, H);
      P(out, 'w', 0, 0, zc, bw, h, bd, pick(R, COM));
      P(out, 'b', 0, h - 1.4, zc + bd / 2 + 0.7, bw, 0.25, 1.4, pick(R, AWN));
      P(out, 'b', 0, h, zc + bd / 2 - 0.3, bw * 0.6, 1.4, 0.3, pick(R, AWN));
      P(out, 'b', 0, h, zc, bw, 0.4, bd, 0x777370);
      for (let k = 0; k < Math.min(4, b.w * 2); k++) P(out, 'b', -W / 2 + 2 + k * 3, 0.1, -D / 2 + 3, 1.8, 1.2, 4, pick(R, AWN.concat([0xdddddd, 0x333333])));
      break;
    }
    case 'mall': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, PAVE);
      const bw = W * 0.92, bd = D * 0.8;
      P(out, 'w', 0, 0, 0, bw, 8, bd, pick(R, COM));
      P(out, 'w', 0, 8, -D * 0.05, bw * 0.7, H, bd * 0.7, pick(R, GLASS));
      P(out, 'b', 0, 8 + H, -D * 0.05, bw * 0.72, 0.6, bd * 0.72, 0x55585c);
      P(out, 'b', 0, 6, bd / 2 + 0.1, bw * 0.5, 1.8, 0.4, pick(R, AWN));
      break;
    }
    case 'factory': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, CONC);
      const bw = W * 0.8, bd = D * 0.6, zc = -D * 0.12, h = 6 + R() * 3 + (lvl - 1) * 0.8;
      const col = pick(R, IND);
      P(out, 'b', 0, 0, zc, bw, h, bd, col);
      const nRoof = Math.max(2, Math.round(bd / 5));
      for (let k = 0; k < nRoof; k++) P(out, 'r', 0, h, zc - bd / 2 + (k + 0.5) * bd / nRoof, bw, 2, bd / nRoof, 0x7c8288);
      const cx = bw / 2 - 2, cz = zc - bd / 2 + 2;
      if (R() < 0.8) { const ch = h + 8 + R() * 8; P(out, 'c', cx, 0, cz, 1.6, ch, 1.6, 0x8d7f74); b._smoke.push([cx, ch, cz]); }
      if (R() < 0.6) for (let k = 0; k < 2; k++) P(out, 'c', -bw / 2 + 2 + k * 3.4, 0, D / 2 - 3.5, 3, 7 + R() * 3, 3, 0xc8c8c0);
      P(out, 'b', bw * 0.2, 0, D / 2 - 3, 6, 2.6, 3, pick(R, [0x3060a0, 0xa03030, 0x30a060])); // kamyon/konteyner
      break;
    }
    case 'office': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, PAVE);
      const bw = W * 0.82, bd = D * 0.65, zc = D / 2 - 1.5 - bd / 2;
      P(out, 'w', 0, 0, zc, bw, H, bd, pick(R, OFF.concat(GLASS)));
      P(out, 'b', 0, H, zc, bw * 0.5, 2, bd * 0.5, 0x8a8a8a);
      break;
    }
    case 'skyscraper': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, PAVE);
      const col = pick(R, GLASS.concat(OFF));
      let w = W * 0.85, d = D * 0.8, y = 0; const steps = 2 + ((R() * 2) | 0);
      for (let k = 0; k < steps; k++) {
        const h = H / steps; P(out, 'w', 0, y, 0, w, h, d, col); y += h; w *= 0.8; d *= 0.8;
      }
      P(out, 'b', 0, y, 0, w, 1.2, d, 0x555a60);
      if (R() < 0.6) P(out, 'c', 0, y, 0, 0.5, 10 + R() * 12, 0.5, 0xcccccc);
      break;
    }
    case 'farm': {
      const crop = pick(R, [[0xc8b45a, 0xb09a40], [0x7aa040, 0x5e8a30], [0x9a7a4a, 0x7a6038], [0xa8c060, 0x8aa048]]);
      const rows = Math.max(4, Math.round(W / 3));
      for (let k = 0; k < rows; k++) P(out, 'b', -W / 2 + (k + 0.5) * W / rows, 0, -D * 0.1, W / rows * 0.9, 0.25 + (k % 2) * 0.15, D * 0.75, crop[k % 2]);
      P(out, 'b', W / 2 - 5, 0, D / 2 - 4, 7, 5, 6, 0xa03a2a); P(out, 'r', W / 2 - 5, 5, D / 2 - 4, 7.4, 3, 6.4, 0x5a4a42);
      P(out, 'c', W / 2 - 10, 0, D / 2 - 4, 3, 9, 3, 0xc0c0b8);
      break;
    }
    case 'forestry': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, DIRT);
      for (let k = 0; k < 6; k++) { const tx = (R() - 0.5) * W * 0.8, tz = -D / 2 + 3 + R() * D * 0.4; P(out, 'c', tx, 0, tz, 0.6, 3, 0.6, 0x6b4a2f); P(out, 'k', tx, 2, tz, 3.6, 7, 3.6, 0x2f5a2a); }
      for (let k = 0; k < 4; k++) P(out, 'c', -W / 4 + k * 1.2, 0.6, D / 2 - 4, 1.2, 8, 1.2, 0x8a6a42, Math.PI / 2);
      P(out, 'b', W / 4, 0, D / 2 - 4, 6, 4, 5, 0x7a6a50); P(out, 'r', W / 4, 4, D / 2 - 4, 6.4, 2, 5.4, 0x4a4a44);
      break;
    }
    case 'oil': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, 0x6a6458);
      for (let k = 0; k < 2; k++) { const px = -W / 4 + k * W / 2, pz = -D * 0.15; P(out, 'b', px, 0, pz, 2, 1.2, 4, 0x444444); P(out, 'b', px, 3.5, pz, 0.8, 0.8, 7, 0x2a2a2a, 0.3); P(out, 'b', px, 0, pz + 1, 0.6, 4, 0.6, 0x555555); }
      P(out, 'c', W / 3, 0, D / 2 - 4, 5, 5, 5, 0xd8d4c8); P(out, 'c', -W / 3, 0, D / 2 - 4, 4, 4, 4, 0xd8d4c8);
      break;
    }
    case 'mine': {
      P(out, 'b', 0, 0, 0, W, 0.12, D, 0x7a7266);
      P(out, 'k', -W / 4, 0, -D / 6, 8, 5, 8, 0x8a8a90); P(out, 'k', W / 5, 0, -D / 5, 6, 4, 6, 0x5a5048);
      P(out, 'b', 0, 0, D / 2 - 4, 7, 6, 5, 0x9a8a70); P(out, 'b', 0, 6, D / 2 - 6, 1.5, 1, 10, 0x555555, 0.5);
      P(out, 'b', W / 3, 7, 0, 1, 14, 1, 0x6a6a6a);
      break;
    }
    default: P(out, 'w', 0, 0, 0, W * 0.8, H, D * 0.8, 0xcccccc);
  }
}

function serviceParts(out, b, R, W, D) {
  const d = SERVICES[b.type]; const st = d.style; const col = d.color || 0xd8d2c8;
  const ground = (c = PAVE) => P(out, 'b', 0, 0, 0, W, 0.15, D, c);
  const trees = (n, area = 0.8) => { for (let k = 0; k < n; k++) { const tx = (R() - 0.5) * W * area, tz = (R() - 0.5) * D * area; P(out, 'c', tx, 0, tz, 0.5, 2, 0.5, 0x6b4a2f); P(out, 's', tx, 1.6, tz, 3.5 + R() * 1.5, 4 + R(), 3.5 + R() * 1.5, pick(R, [0x4f8a35, 0x5b9a3c, 0x46803a, 0x3d7030])); } };
  switch (st) {
    case 'wind': P(out, 'b', 0, 0, 0, 4, 0.4, 4, CONC); P(out, 'c', 0, 0, 0, 1.2, 26, 1.2, 0xf2f2f2); P(out, 'b', 0, 26, -0.5, 1.6, 1.6, 3.2, 0xf2f2f2); b._rotor = [0, 26.8, 1.3]; break;
    case 'plant': {
      ground(CONC); P(out, 'b', -W * 0.1, 0, D * 0.1, W * 0.6, 12, D * 0.5, col); P(out, 'b', -W * 0.1, 12, D * 0.1, W * 0.6, 1, D * 0.5, 0x6a6a6a);
      const n = W > 24 ? 3 : 2;
      for (let k = 0; k < n; k++) { const cx = W * 0.3, cz = -D * 0.3 + k * 6; const h = 26 + W * 0.5; P(out, 'c', cx, 0, cz, 2.4, h, 2.4, 0x9a8a80); P(out, 'c', cx, h - 2, cz, 2.7, 1, 2.7, 0xb03030); b._smoke.push([cx, h, cz]); }
      P(out, 'c', -W * 0.3, 0, -D * 0.3, 6, 5, 6, 0x5a5048);
      break;
    }
    case 'solar': ground(0x8a9a6a); for (let r = 0; r < Math.floor(D / 4); r++) for (let c = 0; c < Math.floor(W / 7); c++) P(out, 'b', -W / 2 + 4 + c * 7, 1, -D / 2 + 2.5 + r * 4, 6, 0.25, 2.6, 0x1e3a6a, 0); P(out, 'b', W / 2 - 3, 0, D / 2 - 3, 4, 3, 4, 0xdddddd); break;
    case 'dam': ground(CONC); P(out, 'b', 0, 0, 0, W, 10, D * 0.5, 0xb0aaa0); P(out, 'b', 0, 0, D * 0.3, W * 0.6, 6, D * 0.3, 0xd0ccc0); P(out, 'c', -W * 0.3, 10, 0, 3, 3, 3, 0x6688aa); break;
    case 'nuclear': {
      ground(CONC);
      for (let k = 0; k < 2; k++) { const cx = -W * 0.22 + k * W * 0.44, cz = -D * 0.2; P(out, 't', cx, 0, cz, 14, 28, 14, 0xd8d4cc); b._smoke.push([cx, 28, cz]); }
      P(out, 'c', 0, 0, D * 0.25, 10, 10, 10, 0xe0e0e0); P(out, 's', 0, 7, D * 0.25, 10, 8, 10, 0xe8e8e8); P(out, 'b', W * 0.3, 0, D * 0.3, 10, 9, 8, 0xc8c8c8);
      break;
    }
    case 'battery': ground(CONC); for (let k = 0; k < 4; k++) P(out, 'b', -W / 2 + 2.5 + (k % 2) * 7, 0, -D / 4 + ((k / 2) | 0) * 7, 5.5, 2.8, 2.6, 0xe8e8e0); break;
    case 'pump': ground(CONC); P(out, 'w', -W * 0.15, 0, 0, W * 0.5, 6, D * 0.6, 0x6c8aa8); P(out, 'c', W * 0.25, 0, -D * 0.1, W * 0.35, 5, W * 0.35, 0x8ab0cc); P(out, 'c', 0, 0.5, D * 0.4, 0.8, 1, 0.8, 0x4a6a8a); break;
    case 'gwpump': ground(CONC); P(out, 'b', 0, 0, 0, 4, 3, 4, 0x6c8aa8); P(out, 'c', 1.5, 0, 1.5, 1.5, 4, 1.5, 0x8ab0cc); break;
    case 'watertower': P(out, 'b', 0, 0, 0, 5, 0.3, 5, CONC); P(out, 'c', 0, 0, 0, 1.2, 16, 1.2, 0x9aa0a8); P(out, 's', 0, 14, 0, 6.5, 6, 6.5, 0x7aa0c8); break;
    case 'outlet': ground(CONC); P(out, 'b', 0, 0, -D * 0.1, W * 0.5, 3, D * 0.4, 0x7a6a5a); P(out, 'c', 0, 0.2, D * 0.35, 1.6, 1.6, 1.6, 0x5a4a3a); break;
    case 'treatment': ground(CONC); for (let k = 0; k < 4; k++) P(out, 'c', -W / 4 + (k % 2) * W / 2, 0, -D / 4 + ((k / 2) | 0) * D / 2, W * 0.32, 2.5, W * 0.32, 0x6a8a7a); P(out, 'w', 0, 0, 0, 6, 5, 6, 0xc0c8c0); break;
    case 'clinic': ground(); P(out, 'w', 0, 0, 0, W * 0.8, 7, D * 0.65, 0xf0f0f0); P(out, 'b', 0, 7, 0, W * 0.8, 0.5, D * 0.65, 0x9aa); P(out, 'b', 0, 4.2, D * 0.33, 2.6, 0.7, 0.3, 0xd03030); P(out, 'b', 0, 3.25, D * 0.33, 0.7, 2.6, 0.3, 0xd03030); if (b.upgrades.includes('wing')) P(out, 'w', W * 0.3, 0, -D * 0.25, W * 0.3, 5, D * 0.4, 0xeaeaea); break;
    case 'hospital': ground(); P(out, 'w', 0, 0, 0, W * 0.85, 8, D * 0.7, 0xeeeeee); P(out, 'w', -W * 0.1, 8, -D * 0.05, W * 0.45, 18, D * 0.45, 0xf4f4f4); P(out, 'b', -W * 0.1, 18 + 8, -D * 0.05, 6, 0.4, 6, 0x666666); P(out, 'b', 0, 6, D * 0.35 + 0.2, 4, 1, 0.3, 0xd03030); P(out, 'b', 0, 5.5, D * 0.35 + 0.2, 1, 4, 0.3, 0xd03030); break;
    case 'cemetery': {
      ground(GRASS);
      for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) P(out, 'b', -W / 2 + 3 + c * (W - 6) / 5, 0, -D / 2 + 4 + r * (D - 10) / 4, 0.6, 1.1, 0.25, 0x9a9a9a);
      P(out, 'b', W * 0.3, 0, D * 0.35, 5, 5, 4, 0xd8d0c0); P(out, 'r', W * 0.3, 5, D * 0.35, 5.4, 3, 4.4, 0x5a4a42); trees(3); break;
    }
    case 'crematorium': ground(); P(out, 'b', 0, 0, 0, W * 0.7, 6, D * 0.6, 0xb8b0a8); P(out, 'c', W * 0.25, 0, -D * 0.2, 1.6, 14, 1.6, 0x8a8078); b._smoke.push([W * 0.25, 14, -D * 0.2]); break;
    case 'landfill': {
      ground(DIRT);
      for (let k = 0; k < 5; k++) P(out, 's', (R() - 0.5) * W * 0.6, -1.5, (R() - 0.5) * D * 0.6, 8 + R() * 6, 4 + R() * 3 + Math.min(5, (b.stored || 0) / 8000), 8 + R() * 6, pick(R, [0x7a6a50, 0x6a7a50, 0x8a7a60]));
      P(out, 'b', W / 2 - 3, 0, D / 2 - 3, 4, 3, 3, 0xa0a0a0); break;
    }
    case 'recycling': ground(CONC); P(out, 'b', 0, 0, -D * 0.1, W * 0.7, 8, D * 0.5, 0x6a9a6a); for (let k = 0; k < 4; k++) P(out, 'b', -W / 3 + k * W / 5, 0, D * 0.35, 3, 2.4, 2, pick(R, AWN)); break;
    case 'depot': { ground(ASPH); P(out, 'b', 0, 0, -D * 0.1, W * 0.85, 7, D * 0.55, col); P(out, 'b', 0, 7, -D * 0.1, W * 0.86, 0.5, D * 0.56, 0x555555); for (let k = 0; k < 3; k++) P(out, 'b', -W / 3 + k * W / 3, 0, D * 0.32, 2.2, 2.4, 4.5, col); break; }
    case 'school': ground(GRASS); P(out, 'w', -W * 0.15, 0, -D * 0.15, W * 0.6, 8, D * 0.35, col); P(out, 'w', W * 0.25, 0, D * 0.05, W * 0.3, 8, D * 0.6, col); P(out, 'b', -W * 0.15, 0.05, D * 0.3, W * 0.5, 0.15, D * 0.25, 0xb05a3a); P(out, 'c', -W * 0.4, 0, D * 0.4, 0.2, 9, 0.2, 0xdddddd); P(out, 'b', -W * 0.4 + 0.9, 8, D * 0.4, 1.6, 1, 0.1, 0xd02020); break;
    case 'college': ground(GRASS); P(out, 'w', 0, 0, -D * 0.2, W * 0.8, 12, D * 0.3, 0xc8b8a0); P(out, 'w', -W * 0.3, 0, D * 0.15, W * 0.25, 9, D * 0.35, 0xc8b8a0); P(out, 's', 0, 10, -D * 0.2, 7, 6, 7, 0x6a8aa0); trees(4); break;
    case 'university': ground(GRASS); P(out, 'w', 0, 0, -D * 0.3, W * 0.7, 14, D * 0.25, 0xd8c8a8); P(out, 's', 0, 12, -D * 0.3, 9, 9, 9, 0x5a7a8a); P(out, 'w', -W * 0.32, 0, D * 0.1, W * 0.22, 10, D * 0.4, 0xc8b898); P(out, 'w', W * 0.32, 0, D * 0.1, W * 0.22, 10, D * 0.4, 0xc8b898); for (let k = 0; k < 6; k++) P(out, 'c', -W * 0.3 + k * W * 0.12, 0, -D * 0.3 + D * 0.13, 1, 12, 1, 0xf0f0f0); trees(6); break;
    case 'firehouse': ground(); P(out, 'w', 0, 0, -D * 0.1, W * 0.85, 7, D * 0.6, 0xb5442f); for (let k = 0; k < 3; k++) P(out, 'b', -W * 0.3 + k * W * 0.3, 0, D * 0.2 + 0.05, W * 0.22, 4.5, 0.3, 0x3a3a3a); P(out, 'b', W * 0.35, 0, -D * 0.3, 3, 14, 3, 0xa03a28); break;
    case 'police': ground(); P(out, 'w', 0, 0, -D * 0.05, W * 0.8, 8, D * 0.6, 0x5a6a8a); P(out, 'b', 0, 8, -D * 0.05, W * 0.8, 0.6, D * 0.6, 0x333a4a); P(out, 'b', 0, 6.4, D * 0.25 + 0.1, W * 0.4, 1.2, 0.3, 0x2050c0); for (let k = 0; k < 2; k++) P(out, 'b', -W * 0.3 + k * 4, 0, D * 0.4, 2, 1.5, 4, 0xffffff); break;
    case 'prison': { ground(CONC); const t = 0.8; P(out, 'b', 0, 0, -D / 2 + 1, W - 1, 6, t, 0x8a8a84); P(out, 'b', 0, 0, D / 2 - 1, W - 1, 6, t, 0x8a8a84); P(out, 'b', -W / 2 + 1, 0, 0, t, 6, D - 1, 0x8a8a84); P(out, 'b', W / 2 - 1, 0, 0, t, 6, D - 1, 0x8a8a84); P(out, 'w', 0, 0, 0, W * 0.5, 10, D * 0.4, 0x9a968c); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P(out, 'b', sx * (W / 2 - 1.5), 0, sz * (D / 2 - 1.5), 2.5, 10, 2.5, 0x7a7a74); break; }
    case 'cityhall': ground(); P(out, 'w', 0, 0, -D * 0.05, W * 0.8, 12, D * 0.6, 0xe8e0d0); for (let k = 0; k < 6; k++) P(out, 'c', -W * 0.35 + k * W * 0.14, 0, D * 0.27, 1.2, 10, 1.2, 0xf4f0e8); P(out, 'r', 0, 12, -D * 0.05, W * 0.82, 4, D * 0.62, 0x9aa0a8); P(out, 'c', 0, 15, -D * 0.05, 7, 4, 7, 0xe8e0d0); P(out, 's', 0, 17, -D * 0.05, 8, 7, 8, 0x5a8a7a); break;
    case 'office': ground(); P(out, 'w', 0, 0, 0, W * 0.8, 9 + W * 0.3, D * 0.65, col); break;
    case 'park': {
      ground(GRASS); P(out, 'b', 0, 0.16, 0, W * 0.15, 0.06, D * 0.9, 0xd8cfb8); P(out, 'b', 0, 0.16, 0, W * 0.9, 0.06, D * 0.15, 0xd8cfb8);
      trees(Math.round(W * D / 40)); if (W > 20) P(out, 'c', 0, 0.2, 0, 6, 0.6, 6, 0x5a9ad0);
      if (b.type === 'zoo') { for (let k = 0; k < 4; k++) P(out, 'b', (R() - 0.5) * W * 0.6, 0, (R() - 0.5) * D * 0.6, 6, 1.2, 6, 0xa08a60); }
      if (b.type === 'botanical') P(out, 's', W * 0.2, -2, -D * 0.2, 12, 10, 12, 0x9ad0d8);
      break;
    }
    case 'plaza': ground(0xcfc6b0); P(out, 'c', 0, 0, 0, 5, 0.8, 5, 0xa8a090); P(out, 'c', 0, 0.8, 0, 1, 2.2, 1, 0xb8b0a0); P(out, 'c', 0, 0.85, 0, 4.2, 0.1, 4.2, 0x5aa0e0); trees(2, 0.9); break;
    case 'playground': ground(0xa0c070); P(out, 'b', -2, 0, 0, 2, 2.5, 2, 0xe04040); P(out, 'b', 1.5, 0, 2, 1.5, 3, 1.5, 0x4080e0); P(out, 'b', 1, 0, -3, 3, 1.5, 0.3, 0xf0c030, 0.4); break;
    case 'campfire': P(out, 'b', 0, 0, 0, W, 0.12, D, DIRT); P(out, 'k', 0, 0, 0, 1.4, 1.6, 1.4, 0xf08020); for (let k = 0; k < 3; k++) P(out, 'b', Math.cos(k * 2.1) * 2.4, 0, Math.sin(k * 2.1) * 2.4, 1.8, 0.5, 0.5, 0x7a5a3a, k * 2.1); b._smoke.push([0, 1.6, 0]); break;
    case 'sports': ground(0x4f9a3f); P(out, 'b', 0, 0.16, 0, W * 0.8, 0.04, 0.3, 0xffffff); P(out, 'b', 0, 0.16, D * 0.4, W * 0.5, 0.04, 0.3, 0xffffff); P(out, 'b', 0, 0.16, -D * 0.4, W * 0.5, 0.04, 0.3, 0xffffff); for (const sz of [-1, 1]) P(out, 'b', 0, 0, sz * D * 0.42, 5, 2.2, 0.3, 0xffffff); break;
    case 'tower': ground(); P(out, 'b', 0, 0, 0, 1.2, 18, 1.2, 0x9a9a9a); P(out, 'b', 0, 16, 0, 3, 2, 3, 0xd0b020); P(out, 'b', 3, 0, 3, 4, 3, 4, 0xc8c8c8); break;
    case 'bunker': ground(GRASS); P(out, 's', 0, -3, 0, W * 0.8, 7, D * 0.8, 0x7a8a6a); P(out, 'b', 0, 0, D * 0.35, 3, 2.5, 1.5, 0x5a5a5a); break;
    case 'mast': P(out, 'b', 0, 0, 0, 4, 0.3, 4, CONC); P(out, 'c', 0, 0, 0, 0.6, 28, 0.6, 0xcc4444); P(out, 'c', 0, 14, 0, 0.62, 2, 0.62, 0xeeeeee); break;
    case 'antenna': ground(CONC); P(out, 'b', 0, 0, 0, 2, 36, 2, 0xc8c8c8); P(out, 's', 0, 20, 2, 5, 5, 1.2, 0xeeeeee); P(out, 'b', W * 0.3, 0, D * 0.3, 6, 4, 5, 0xbbbbbb); break;
    case 'station': ground(PAVE); P(out, 'b', 0, 0, 0, W * 0.9, 1, D * 0.9, 0xa0a0a0); P(out, 'b', 0, 5, 0, W * 0.95, 0.5, D * 0.95, 0x6a7a8a); for (let k = 0; k < 4; k++) P(out, 'c', -W * 0.4 + k * W * 0.27, 0, 0, 0.5, 5, 0.5, 0x777777); P(out, 'w', 0, 0, D * 0.3, W * 0.6, 8, D * 0.3, 0xd8c8a8); break;
    case 'metro': ground(PAVE); P(out, 'w', 0, 0, 0, W * 0.5, 3.5, D * 0.4, 0x8aa0b8); P(out, 'b', 0, 3.5, 0, W * 0.6, 0.4, D * 0.5, 0x3a3a3a); P(out, 'b', W * 0.35, 0, D * 0.35, 0.3, 4, 0.3, 0x444444); P(out, 'b', W * 0.35, 4, D * 0.35, 1.4, 1.4, 0.3, 0x8040c0); break;
    case 'harbor': ground(CONC); for (let k = 0; k < 2; k++) { P(out, 'b', -W * 0.25 + k * W * 0.5, 0, D * 0.3, 2, 18, 2, 0xd04020); P(out, 'b', -W * 0.25 + k * W * 0.5, 18, D * 0.3 + 4, 2, 2, 12, 0xd04020); } for (let k = 0; k < 8; k++) P(out, 'b', -W * 0.35 + (k % 4) * 5, ((k / 4) | 0) * 2.6, -D * 0.25, 4.5, 2.6, 2.4, pick(R, AWN)); P(out, 'w', W * 0.3, 0, -D * 0.3, 8, 7, 7, 0xc8d0d8); break;
    case 'airport': { ground(0x8a9a7a); P(out, 'b', -W * 0.15, 0.16, 0, W * 0.2, 0.08, D * 0.95, 0x444448); for (let k = 0; k < 10; k++) P(out, 'b', -W * 0.15, 0.25, -D * 0.45 + k * D * 0.1, 0.6, 0.02, 3, 0xffffff); P(out, 'w', W * 0.3, 0, 0, W * 0.25, 10, D * 0.4, 0xb8c8d8); P(out, 'c', W * 0.3, 0, D * 0.3, 2.5, 22, 2.5, 0xd8d8d8); P(out, 'c', W * 0.3, 22, D * 0.3, 4, 3, 4, 0x4a6a8a); P(out, 'b', W * 0.1, 0.5, -D * 0.2, 2.2, 2.2, 14, 0xf0f0f0); P(out, 'b', W * 0.1, 1.5, -D * 0.2, 14, 0.5, 3, 0xf0f0f0); break; }
    case 'cargo': ground(CONC); for (let k = 0; k < 12; k++) P(out, 'b', -W * 0.35 + (k % 4) * 6, ((k / 4) | 0) * 2.6, -D * 0.1, 5.5, 2.6, 2.4, pick(R, AWN)); P(out, 'b', 0, 0, D * 0.3, W * 0.9, 12, 1.5, 0xe0a020); break;
    case 'parking': ground(ASPH); for (let k = 0; k < 8; k++) P(out, 'b', -W * 0.35 + (k % 4) * W * 0.23, 0, -D * 0.2 + ((k / 4) | 0) * D * 0.4, 1.9, 1.4, 4.2, pick(R, [0xc03030, 0x3060c0, 0xe0e0e0, 0x303030, 0x909090])); break;
    case 'helipad': ground(CONC); P(out, 'c', -W * 0.15, 0.15, 0, 10, 0.1, 10, 0x4a4a4a); P(out, 'b', -W * 0.15, 0.26, 0, 0.6, 0.02, 4, 0xffffff); P(out, 'b', W * 0.3, 0, 0, 7, 6, 10, 0xb04030); break;
    case 'sig_house': ground(GRASS); P(out, 'w', 0, 0, 0, W * 0.7, 7, D * 0.5, 0xf8f8f8); P(out, 'w', W * 0.15, 7, -D * 0.05, W * 0.45, 4, D * 0.4, 0x8ab0c8); P(out, 'b', -W * 0.2, 0.1, -D * 0.35, 6, 0.3, 4, 0x3a9ae0); trees(3); break;
    case 'sig_tower': ground(PAVE); { let y = 0; const cs = [0xe05050, 0xe0a040, 0xe0e050, 0x50c060, 0x4080e0, 0x8050c0]; for (let k = 0; k < 6; k++) { P(out, 'w', 0, y, 0, W * 0.6, 11, D * 0.6, cs[k], k * 0.12); y += 11; } } break;
    case 'sig_market': ground(0xc8b898); P(out, 'w', 0, 0, 0, W * 0.85, 7, D * 0.8, 0xd8b888); for (let k = 0; k < 3; k++) P(out, 's', -W * 0.3 + k * W * 0.3, 5, 0, 6, 5, 6, 0x8a9aa0); break;
    case 'sig_factory': ground(CONC); P(out, 'w', 0, 0, 0, W * 0.8, 10, D * 0.6, 0x9a4a32); P(out, 'r', 0, 10, 0, W * 0.82, 4, D * 0.62, 0x5a3a2a); P(out, 'c', W * 0.3, 0, -D * 0.3, 2.4, 24, 2.4, 0x9a4a32); b._smoke.push([W * 0.3, 24, -D * 0.3]); break;
    case 'sig_office': ground(PAVE); P(out, 'w', 0, 0, 0, W * 0.6, 90, D * 0.6, 0x7ab0d0, 0.785); P(out, 'k', 0, 90, 0, W * 0.5, 18, D * 0.5, 0x9ac0e0); break;
    case 'stadium': {
      ground(PAVE); P(out, 'b', 0, 0.16, 0, W * 0.55, 0.1, D * 0.6, 0x4f9a3f);
      const n = 28; for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; P(out, 'b', Math.cos(a) * W * 0.4, 0, Math.sin(a) * D * 0.42, 6, 16, 4, 0xd8d8d8, -a + Math.PI / 2); }
      break;
    }
    case 'tvtower': ground(PAVE); P(out, 'c', 0, 0, 0, 4, 120, 4, 0xe0e0e0); P(out, 's', 0, 92, 0, 14, 12, 14, 0xe8e8e8); P(out, 'c', 0, 104, 0, 7, 3, 7, 0xd04030); P(out, 'c', 0, 120, 0, 0.8, 25, 0.8, 0xcc3333); break;
    case 'cathedral': ground(PAVE); P(out, 'w', 0, 0, -D * 0.05, W * 0.45, 16, D * 0.8, 0xd8ccb0); P(out, 'r', 0, 16, -D * 0.05, D * 0.82, 9, W * 0.47, 0x6a7078, Math.PI / 2); for (const sx of [-1, 1]) { P(out, 'w', sx * W * 0.15, 0, D * 0.36, 5, 30, 5, 0xd8ccb0); P(out, 'k', sx * W * 0.15, 30, D * 0.36, 5.5, 12, 5.5, 0x6a7078); } break;
    case 'opera': ground(PAVE); for (let k = 0; k < 4; k++) P(out, 's', -W * 0.3 + k * W * 0.2, -4, (k % 2 ? -1 : 1) * D * 0.08, W * 0.3, 22 - k * 3, D * 0.45, 0xf4f4f0); P(out, 'b', 0, 0, D * 0.3, W * 0.8, 4, D * 0.2, 0xb8a888); break;
    default: ground(); P(out, 'w', 0, 0, 0, W * 0.7, 8, D * 0.6, col);
  }
}
