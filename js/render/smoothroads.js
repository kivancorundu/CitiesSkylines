// Pürüzsüz yol çizimi (CS2 tarzı): eğri şeritler, kaldırımlar, çizgiler, kavşaklar, köprüler, bariyerler, lambalar, tüneller
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, WATER_Y, heightAt, eachRoadNbr } from '../core/constants.js';
import { ROADS } from '../data/roads.js';
import { cellOfPt } from '../sim/roadgeom.js';

const DECK_Y = 3.2;           // su üzerindeki köprü tabliyesi yüksekliği
const ELEV_H = 7.5;           // yükseltilmiş yol yüksekliği
const RAMP = 0.13;            // rampa eğimi (m/m)
// Yol genişlikleri (m) ve kaldırım
const WIDTH = { small: 6.4, gravel: 6.0, medium: 7.6, large: 8.0, buslane: 7.6, highway: 8.4, pedestrian: 6.6 };
const WALK = { small: 0.9, gravel: 0, medium: 0.8, large: 0.7, buslane: 0.8, highway: 0, pedestrian: 0 };

class Buf {
  constructor() { this.p = []; this.c = []; this.i = []; }
  v(x, y, z, col) { this.p.push(x, y, z); this.c.push(col.r, col.g, col.b); return this.p.length / 3 - 1; }
  quad(a, b, c, d, col) { const i0 = this.v(...a, col), i1 = this.v(...b, col), i2 = this.v(...c, col), i3 = this.v(...d, col); this.i.push(i0, i1, i2, i0, i2, i3); }
  box(cx, cy, cz, sx, sy, sz, col, ang = 0) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (x, y, z) => [cx + x * ca - z * sa, cy + y, cz + x * sa + z * ca];
    const hx = sx / 2, hz = sz / 2;
    const c = [P(-hx, 0, -hz), P(hx, 0, -hz), P(hx, 0, hz), P(-hx, 0, hz), P(-hx, sy, -hz), P(hx, sy, -hz), P(hx, sy, hz), P(-hx, sy, hz)];
    this.quad(c[4], c[7], c[6], c[5], col); // üst
    this.quad(c[0], c[1], c[5], c[4], col); this.quad(c[1], c[2], c[6], c[5], col); this.quad(c[2], c[3], c[7], c[6], col); this.quad(c[3], c[0], c[4], c[7], col);
  }
  disc(cx, cy, cz, r, col, n = 18) {
    const c0 = this.v(cx, cy, cz, col);
    const first = this.p.length / 3;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; this.v(cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r, col); }
    for (let k = 0; k < n; k++) this.i.push(c0, first + ((k + 1) % n), first + k);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i.length > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeVertexNormals();
    return g;
  }
}

const C_WALK = new THREE.Color(0xb9b5ad), C_CURB = new THREE.Color(0x8f8c86), C_CONC = new THREE.Color(0x9b978f), C_CONC_D = new THREE.Color(0x77736c);
const C_RAIL = new THREE.Color(0xc8ccd2), C_POST = new THREE.Color(0x6f747a), C_GREEN = new THREE.Color(0x5f8f3f), C_WHITE = new THREE.Color(0xf2f2f2);
const C_YEL = new THREE.Color(0xf0c94a), C_BUS = new THREE.Color(0x8e3b36), C_DARK = new THREE.Color(0x15171a), C_LAMP = new THREE.Color(0x4d5157);

export class SmoothRoads {
  constructor(scene) {
    this.scene = scene;
    this.matLit = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.matSurf = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this.matMark = new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    this.matLamp = new THREE.MeshBasicMaterial({ color: 0x777766 });
    this.meshes = [];
    this.cellPos = new Float32Array(N * N * 3);
    this.cellHas = new Uint8Array(N * N);
    this.treePts = [];
  }

  setNight(n) { this.matLamp.color.setRGB(0.47 + n * 0.53, 0.47 + n * 0.45, 0.4 + n * 0.25); }

  clear() { for (const m of this.meshes) { this.scene.remove(m); m.geometry.dispose(); } this.meshes = []; }

  add(buf, mat, shadow = false) {
    if (!buf.i.length) return;
    const m = new THREE.Mesh(buf.geometry(), mat); m.receiveShadow = true; m.castShadow = shadow; m.frustumCulled = false;
    this.scene.add(m); this.meshes.push(m);
  }

  rebuild(s, tintFn) {
    this.clear();
    const surf = new Buf(), walk = new Buf(), mark = new Buf(), struct = new Buf(), lamps = new Buf(), heads = new Buf();
    const C = N * N;
    const acc = new Float32Array(C * 4); // araçlar için hücre konumu: x, y, z, sayı
    this.treePts = [];
    // araçlar: derecesi ≥3 olan hücrelerde kavşak merkezi
    const deg = (i) => { let n = 0; eachRoadNbr(s, i, () => n++); return n; };
    const junc = new Map();
    for (let i = 0; i < C; i++) if (s.road[i] && deg(i) >= 3 && s.rElev[i] !== 2) junc.set(i, { x: 0, z: 0, y: -1e9, n: 0 });
    const colOf = (c) => { const t = tintFn ? tintFn(c) : null; return new THREE.Color(t !== null && t !== undefined ? t : ROADS[s.road[c]].color); };
    // 1. geçiş: örnekleri dünya koordinatına çevir, yükseklikleri hesapla
    const prepared = [];
    for (const sg of s.segs || []) {
      const n = sg.p.length / 2; if (n < 2) continue;
      const X = new Float32Array(n), Z = new Float32Array(n), Y = new Float32Array(n), T = new Float32Array(n), cell = new Int32Array(n), ok = new Uint8Array(n);
      for (let k = 0; k < n; k++) {
        const cx = sg.p[k * 2], cz = sg.p[k * 2 + 1];
        X[k] = cx * CS - HALF; Z[k] = cz * CS - HALF;
        const c = cellOfPt([cx, cz]); cell[k] = c; ok[k] = s.road[c] ? 1 : 0;
        const ter = heightAt(s, X[k], Z[k]);
        let tgt = Math.max(ter, -0.2);
        if (s.water[c]) tgt = DECK_Y;
        if (s.rElev[c] === 1) tgt = Math.max(ter, 0) + ELEV_H;
        T[k] = tgt; Y[k] = tgt;
      }
      // rampa zarfı: yükseklik farkı eğimle sınırlanır (yalnızca yükseltir)
      for (let k = 1; k < n; k++) { const ds = Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]); Y[k] = Math.max(Y[k], Y[k - 1] - ds * RAMP); }
      for (let k = n - 2; k >= 0; k--) { const ds = Math.hypot(X[k] - X[k + 1], Z[k] - Z[k + 1]); Y[k] = Math.max(Y[k], Y[k + 1] - ds * RAMP); }
      // rampa başı/sonu kırılmasın: yumuşatma (zemin altına inmeden)
      const Y2 = new Float32Array(n);
      for (let pass = 0; pass < 5; pass++) {
        for (let k = 0; k < n; k++) Y2[k] = k === 0 || k === n - 1 ? Y[k] : Y[k - 1] * 0.25 + Y[k] * 0.5 + Y[k + 1] * 0.25;
        for (let k = 0; k < n; k++) Y[k] = Math.max(Y2[k], T[k] - (s.water[cell[k]] || s.rElev[cell[k]] === 1 ? 0.15 : 0.05));
      }
      for (let k = 0; k < n; k++) {
        Y[k] += 0.12;
        const c = cell[k]; if (!ok[k]) continue;
        const tun = s.rElev[c] === 2;
        const o = c * 4; acc[o] += X[k]; acc[o + 1] += tun ? Y[k] - 14 : Y[k]; acc[o + 2] += Z[k]; acc[o + 3]++;
        const j = junc.get(c); if (j) { j.x += X[k]; j.z += Z[k]; j.y = Math.max(j.y, Y[k]); j.n++; }
      }
      const c0 = ok[0] ? cell[0] : cell[n - 1];
      const key = ROADS[s.road[c0] || 1].key;
      prepared.push({ X, Z, Y, cell, ok, n, key, W: WIDTH[key], SW: WALK[key], tS: 0, tE: 0, nS: null, nE: null });
    }
    for (const j of junc.values()) if (j.n) { j.x /= j.n; j.z /= j.n; }
    this.cellHas.fill(0);
    for (let i = 0; i < C; i++) {
      const o = i * 4; if (!acc[o + 3]) continue;
      const j = junc.get(i);
      if (j && j.n) { this.cellPos[i * 3] = j.x; this.cellPos[i * 3 + 1] = j.y; this.cellPos[i * 3 + 2] = j.z; }
      else { this.cellPos[i * 3] = acc[o] / acc[o + 3]; this.cellPos[i * 3 + 1] = acc[o + 1] / acc[o + 3]; this.cellPos[i * 3 + 2] = acc[o + 2] / acc[o + 3]; }
      this.cellHas[i] = 1;
    }
    // 2. düğümler: şerit uçlarının çakıştığı noktalar
    const nodes = new Map();
    const endDir = (P, atStart) => {
      const { X, Z, n } = P; let k = atStart ? 0 : n - 1; const step = atStart ? 1 : -1; let L = 0;
      while (k + step >= 0 && k + step < n && L < 3) { L += Math.hypot(X[k + step] - X[k], Z[k + step] - Z[k]); k += step; }
      const e = atStart ? 0 : n - 1; const dx = X[k] - X[e], dz = Z[k] - Z[e]; const l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    };
    for (const P of prepared) for (const atStart of [true, false]) {
      const e = atStart ? 0 : P.n - 1;
      const key = Math.round(P.X[e] * 4) + ',' + Math.round(P.Z[e] * 4);
      let nd = nodes.get(key); if (!nd) nodes.set(key, (nd = { x: P.X[e], z: P.Z[e], y: -1e9, ends: [], cell: P.cell[e] }));
      nd.y = Math.max(nd.y, P.Y[e]);
      const d = endDir(P, atStart);
      nd.ends.push({ P, atStart, d, ang: Math.atan2(d[1], d[0]), hw: P.W / 2, ow: P.W / 2 + P.SW });
      if (atStart) P.nS = nd; else P.nE = nd;
    }
    // kavşaklarda şeritleri kırp: diğer yolların genişliği kadar geri çek
    const segLen = (P) => { let L = 0; for (let k = 1; k < P.n; k++) L += Math.hypot(P.X[k] - P.X[k - 1], P.Z[k] - P.Z[k - 1]); return L; };
    for (const nd of nodes.values()) {
      nd.deg = nd.ends.length;
      if (nd.deg < 3) continue;
      for (const e of nd.ends) {
        let need = 0;
        for (const o of nd.ends) {
          if (o === e) continue;
          const sin = Math.abs(e.d[0] * o.d[1] - e.d[1] * o.d[0]);
          need = Math.max(need, o.ow / Math.max(0.5, sin) * 0.9);
        }
        const t = Math.min(need + 0.8, segLen(e.P) * 0.45);
        e.trim = t; if (e.atStart) e.P.tS = t; else e.P.tE = t;
      }
    }
    // kırpılmış şerit dizileri
    for (const P of prepared) {
      const { X, Z, Y, cell, ok, n } = P; const S = new Float32Array(n);
      for (let k = 1; k < n; k++) S[k] = S[k - 1] + Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]);
      const a = P.tS, b = S[n - 1] - P.tE;
      const X2 = [], Z2 = [], Y2 = [], C2 = [], O2 = [];
      const at = (sv) => { let k = 0; while (k < n - 2 && S[k + 1] < sv) k++; const t = (sv - S[k]) / Math.max(1e-6, S[k + 1] - S[k]); X2.push(X[k] + (X[k + 1] - X[k]) * t); Z2.push(Z[k] + (Z[k + 1] - Z[k]) * t); Y2.push(Y[k] + (Y[k + 1] - Y[k]) * t); const kk = t < 0.5 ? k : k + 1; C2.push(cell[kk]); O2.push(ok[kk]); };
      if (b - a > 0.3) {
        at(a);
        for (let k = 0; k < n; k++) if (S[k] > a + 0.05 && S[k] < b - 0.05) { X2.push(X[k]); Z2.push(Z[k]); Y2.push(Y[k]); C2.push(cell[k]); O2.push(ok[k]); }
        at(b);
      }
      P.D = { X: Float32Array.from(X2), Z: Float32Array.from(Z2), Y: Float32Array.from(Y2), cell: Int32Array.from(C2), ok: Uint8Array.from(O2), n: X2.length };
    }
    // 3. şeritleri çiz
    for (const P of prepared) {
      const { X, Z, Y, cell, ok, n } = P.D; if (n < 2) continue;
      const jS = P.nS && P.nS.deg >= 3, jE = P.nE && P.nE.deg >= 3;
      let dash = 0, lampAcc = 0, postAcc = 0, pillarAcc = 6, run = 0;
      let total = 0; for (let k = 1; k < n; k++) total += Math.hypot(X[k] - X[k - 1], Z[k] - Z[k - 1]);
      for (let k = 0; k < n - 1; k++) {
        const a = k, b = k + 1;
        const ds = Math.hypot(X[b] - X[a], Z[b] - Z[a]); run += ds;
        if (!ok[a] || !ok[b]) continue;
        const ca = cell[a], cb = cell[b];
        const tunA = s.rElev[ca] === 2, tunB = s.rElev[cb] === 2;
        if (tunA !== tunB) { this.portal(struct, X, Z, Y, tunA ? b : a, tunA ? -1 : 1, WIDTH[ROADS[s.road[tunA ? cb : ca]].key]); }
        if (tunA && tunB) continue;
        const def = ROADS[s.road[ca]], key = def.key;
        const W = WIDTH[key], SW = WALK[key];
        const tA = this.tangent(X, Z, a, n), tB = this.tangent(X, Z, b, n);
        const nA = [-tA[1], tA[0]], nB = [-tB[1], tB[0]];
        const L = (k2, nn, off, dy = 0) => [X[k2] + nn[0] * off, Y[k2] + dy, Z[k2] + nn[1] * off];
        const col = colOf(ca);
        surf.quad(L(a, nA, W / 2), L(b, nB, W / 2), L(b, nB, -W / 2), L(a, nA, -W / 2), col);
        const raised = Y[a] - Math.max(heightAt(s, X[a], Z[a]), WATER_Y) > 1.6;
        const bridge = s.water[ca] || s.rElev[ca] === 1 || raised;
        if (SW > 0) {
          const grass = s.roadUp[ca] & 2;
          for (const sd of [1, -1]) {
            const i0 = sd * W / 2, i1 = sd * (W / 2 + SW);
            walk.quad(L(a, nA, i0, 0.15), L(b, nB, i0, 0.15), L(b, nB, i1, 0.15), L(a, nA, i1, 0.15), grass ? C_GREEN : C_WALK);
            walk.quad(L(a, nA, i0, 0), L(b, nB, i0, 0), L(b, nB, i0, 0.15), L(a, nA, i0, 0.15), C_CURB);
            walk.quad(L(a, nA, i1, 0.15), L(b, nB, i1, 0.15), L(b, nB, i1, bridge ? -1.2 : -0.6), L(a, nA, i1, bridge ? -1.2 : -0.6), C_CURB);
          }
        } else if (bridge || key === 'highway') {
          for (const sd of [1, -1]) surf.quad(L(a, nA, sd * W / 2, 0), L(b, nB, sd * W / 2, 0), L(b, nB, sd * W / 2, bridge ? -1.2 : -0.5), L(a, nA, sd * W / 2, bridge ? -1.2 : -0.5), C_CONC_D);
        }
        const EW = W / 2 + SW;
        if (bridge) {
          struct.quad(L(a, nA, EW, -1.2), L(b, nB, EW, -1.2), L(b, nB, -EW, -1.2), L(a, nA, -EW, -1.2), C_CONC_D);
          for (const sd of [1, -1]) {
            const e = sd * (EW - 0.1);
            struct.quad(L(a, nA, e, 1.0), L(b, nB, e, 1.0), L(b, nB, e, 1.12), L(a, nA, e, 1.12), C_RAIL);
            struct.quad(L(a, nA, e, 0.45), L(b, nB, e, 0.45), L(b, nB, e, 0.55), L(a, nA, e, 0.55), C_RAIL);
          }
          postAcc += ds;
          if (postAcc >= 2.5) { postAcc = 0; for (const sd of [1, -1]) { const p = L(a, nA, sd * (EW - 0.1)); struct.box(p[0], p[1], p[2], 0.14, 1.12, 0.14, C_POST); } }
          pillarAcc += ds;
          const ground = s.water[ca] ? -6 : heightAt(s, X[a], Z[a]);
          if (pillarAcc >= 18 && Y[a] - ground > 2.2) {
            pillarAcc = 0;
            const ang = Math.atan2(tA[1], tA[0]);
            const top = Y[a] - 1.2; const h = top - ground;
            struct.box(X[a], ground, Z[a], 1.6, h, Math.min(EW * 1.4, 6), C_CONC, ang);
            struct.box(X[a], top - 0.9, Z[a], 1.8, 0.9, EW * 2, C_CONC, ang);
          }
        } else if (key === 'highway') {
          for (const sd of [1, -1]) { const e = sd * (W / 2 - 0.2); struct.quad(L(a, nA, e, 0.45), L(b, nB, e, 0.45), L(b, nB, e, 0.75), L(a, nA, e, 0.75), C_RAIL); }
          postAcc += ds; if (postAcc >= 4) { postAcc = 0; for (const sd of [1, -1]) { const p = L(a, nA, sd * (W / 2 - 0.2)); struct.box(p[0], p[1], p[2], 0.12, 0.75, 0.12, C_POST); } }
        }
        // kavşak ağızlarında yaya geçidi ve dur çizgisi
        const fromS = run - ds, toE = total - run;
        const zebraOn = def.mark !== null && key !== 'highway' && key !== 'gravel';
        if (zebraOn && jS && fromS < 1e-3) this.zebra(mark, L, a, nA, tA, W, 1.6);
        if (zebraOn && jE && toE < 1e-3) this.zebra(mark, L, b, nB, tB, W, -1.6);
        if ((!jS || fromS > 3.5) && (!jE || toE > 3.5)) this.markings(mark, L, a, b, nA, nB, key, W, def, dash, ds);
        dash += ds;
        if (s.roadUp[ca] & 4 && (k % 6 === 0)) mark.quad(L(a, nA, W / 2), L(b, nB, W / 2), L(b, nB, -W / 2), L(a, nA, -W / 2), C_YEL);
        lampAcc += ds;
        if (lampAcc >= 14 && key !== 'highway' && key !== 'gravel' && fromS > 4 && toE > 4) {
          lampAcc = 0;
          const sd = (k / 7) % 2 < 1 ? 1 : -1; const p = L(a, nA, sd * (W / 2 + Math.max(0.4, SW * 0.5)), SW ? 0.15 : 0);
          lamps.box(p[0], p[1], p[2], 0.16, 6.2, 0.16, C_LAMP);
          const h = [p[0] - nA[0] * sd * 0.9, p[1] + 6.0, p[2] - nA[1] * sd * 0.9];
          heads.box(h[0], h[1], h[2], 0.9, 0.22, 0.5, C_WHITE, Math.atan2(nA[1], nA[0]));
        }
        if ((s.roadUp[ca] & 1) && k % 4 === 0 && !bridge && fromS > 3 && toE > 3) for (const sd of [1, -1]) { const p = L(a, nA, sd * (W / 2 + SW + 0.6)); this.treePts.push(p); }
      }
    }
    // 4. düğümler: kavşak yüzeyleri, kıvrımlar, çıkmaz sokak uçları
    for (const nd of nodes.values()) {
      if (s.rElev[nd.cell] === 2 || !s.road[nd.cell]) continue;
      if (nd.deg === 1) {
        const e = nd.ends[0]; const P = e.P;
        surf.disc(nd.x, nd.y + 0.004, nd.z, P.W / 2, colOf(nd.cell));
        if (P.SW > 0) this.capWalk(walk, nd, e);
        continue;
      }
      if (nd.deg === 2) {
        const [e1, e2] = nd.ends; if (e1.d[0] * e2.d[0] + e1.d[1] * e2.d[1] < -0.996) continue; // düz devam
      }
      this.junction(surf, walk, nd, colOf(nd.cell));
    }
    this.add(surf, this.matSurf, false);
    this.add(walk, this.matLit, false);
    this.add(mark, this.matMark, false);
    this.add(struct, this.matLit, true);
    this.add(lamps, this.matLit, false);
    this.add(heads, this.matLamp, false);
  }

  // Kavşak yüzeyi: kollar açıya göre sıralanır, aralarındaki kaldırım köşeleri kavisle birleştirilir
  junction(surf, walk, nd, col) {
    const ends = nd.ends.slice().sort((a, b) => a.ang - b.ang);
    const y = nd.y + 0.006, m = ends.length;
    const base = (e) => { const t = e.trim || 0; return [nd.x + e.d[0] * t, nd.z + e.d[1] * t]; };
    const nrm = (e) => [-e.d[1], e.d[0]];
    // iki kenar doğrusunun kavisli bağlantısı (kontrol noktası: doğruların düğüm tarafındaki kesişimi)
    const fillet = (p0, d0, p2, d2) => {
      const den = d0[0] * d2[1] - d0[1] * d2[0];
      let ctl = null;
      if (Math.abs(den) > 0.05) {
        const a = ((p2[0] - p0[0]) * d2[1] - (p2[1] - p0[1]) * d2[0]) / den;
        const b = ((p2[0] - p0[0]) * d0[1] - (p2[1] - p0[1]) * d0[0]) / den;
        if (a < 0.05 && b < 0.05) ctl = [p0[0] + d0[0] * a, p0[1] + d0[1] * a];
      }
      const out = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        if (!ctl) out.push([p0[0] + (p2[0] - p0[0]) * t, p0[1] + (p2[1] - p0[1]) * t]);
        else { const u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * ctl[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * ctl[1] + t * t * p2[1]]); }
      }
      return out;
    };
    const poly = [];
    for (let i = 0; i < m; i++) {
      const e = ends[i], f = ends[(i + 1) % m];
      const B = base(e), n1 = nrm(e), Bf = base(f), n2 = nrm(f);
      poly.push([B[0] - n1[0] * e.hw, B[1] - n1[1] * e.hw], [B[0] + n1[0] * e.hw, B[1] + n1[1] * e.hw]);
      const inner = fillet([B[0] + n1[0] * e.hw, B[1] + n1[1] * e.hw], e.d, [Bf[0] - n2[0] * f.hw, Bf[1] - n2[1] * f.hw], f.d);
      for (let k = 1; k < inner.length - 1; k++) poly.push(inner[k]);
      // kaldırım köşesi
      if (e.ow > e.hw + 0.05 || f.ow > f.hw + 0.05) {
        const outer = fillet([B[0] + n1[0] * e.ow, B[1] + n1[1] * e.ow], e.d, [Bf[0] - n2[0] * f.ow, Bf[1] - n2[1] * f.ow], f.d);
        for (let k = 0; k < inner.length - 1; k++) {
          const a0 = inner[k], a1 = inner[k + 1], b0 = outer[k], b1 = outer[k + 1];
          walk.quad([a0[0], y + 0.15, a0[1]], [a1[0], y + 0.15, a1[1]], [b1[0], y + 0.15, b1[1]], [b0[0], y + 0.15, b0[1]], C_WALK);
          walk.quad([a0[0], y, a0[1]], [a1[0], y, a1[1]], [a1[0], y + 0.15, a1[1]], [a0[0], y + 0.15, a0[1]], C_CURB);
          walk.quad([b0[0], y + 0.15, b0[1]], [b1[0], y + 0.15, b1[1]], [b1[0], y - 0.6, b1[1]], [b0[0], y - 0.6, b0[1]], C_CURB);
        }
      }
    }
    // merkezden yelpaze üçgenleme
    const c0 = surf.v(nd.x, y, nd.z, col); const first = surf.p.length / 3;
    for (const q of poly) surf.v(q[0], y, q[1], col);
    for (let k = 0; k < poly.length; k++) surf.i.push(c0, first + ((k + 1) % poly.length), first + k);
  }

  // çıkmaz sokak ucunda yarım daire kaldırım
  capWalk(walk, nd, e) {
    const y = nd.y; const a0 = Math.atan2(e.d[1], e.d[0]);
    for (let k = 0; k < 12; k++) {
      const t0 = a0 + Math.PI / 2 + (k / 12) * Math.PI, t1 = a0 + Math.PI / 2 + ((k + 1) / 12) * Math.PI;
      const P = (r, t, dy) => [nd.x + Math.cos(t) * r, y + dy, nd.z + Math.sin(t) * r];
      walk.quad(P(e.hw, t0, 0.15), P(e.hw, t1, 0.15), P(e.ow, t1, 0.15), P(e.ow, t0, 0.15), C_WALK);
      walk.quad(P(e.hw, t0, 0), P(e.hw, t1, 0), P(e.hw, t1, 0.15), P(e.hw, t0, 0.15), C_CURB);
    }
  }

  tangent(X, Z, k, n) {
    const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
    const dx = X[b] - X[a], dz = Z[b] - Z[a]; const L = Math.hypot(dx, dz) || 1;
    return [dx / L, dz / L];
  }

  markings(mark, L, a, b, nA, nB, key, W, def, dash, ds) {
    const on = (dash % 6) < 3; // 3 m çizgi, 3 m boşluk
    const line = (off, w, col, solid) => { if (!solid && !on) return; mark.quad(L(a, nA, off + w / 2, 0.02), L(b, nB, off + w / 2, 0.02), L(b, nB, off - w / 2, 0.02), L(a, nA, off - w / 2, 0.02), col); };
    void ds;
    if (key === 'small') line(0, 0.18, C_WHITE, false);
    else if (key === 'medium') { line(0.12, 0.12, C_WHITE, true); line(-0.12, 0.12, C_WHITE, true); line(W / 4, 0.14, C_WHITE, false); line(-W / 4, 0.14, C_WHITE, false); }
    else if (key === 'buslane') { line(0, 0.18, C_WHITE, true); mark.quad(L(a, nA, W / 2 - 0.2, 0.015), L(b, nB, W / 2 - 0.2, 0.015), L(b, nB, W / 4 + 0.1, 0.015), L(a, nA, W / 4 + 0.1, 0.015), C_BUS); mark.quad(L(a, nA, -W / 4 - 0.1, 0.015), L(b, nB, -W / 4 - 0.1, 0.015), L(b, nB, -W / 2 + 0.2, 0.015), L(a, nA, -W / 2 + 0.2, 0.015), C_BUS); }
    else if (key === 'large') { line(0, 1.2, C_GREEN, true); line(W / 4 + 0.3, 0.13, C_WHITE, false); line(-W / 4 - 0.3, 0.13, C_WHITE, false); line(W / 2 - 0.35, 0.12, C_WHITE, true); line(-W / 2 + 0.35, 0.12, C_WHITE, true); }
    else if (key === 'highway') { line(0, 0.15, C_YEL, true); for (const o of [W / 6, -W / 6, W / 3, -W / 3]) line(o, 0.13, C_WHITE, false); line(W / 2 - 0.4, 0.14, C_WHITE, true); line(-W / 2 + 0.4, 0.14, C_WHITE, true); }
  }

  zebra(mark, L, a, nA, tA, W, along = 0) {
    for (let o = -W / 2 + 0.6; o <= W / 2 - 0.5; o += 1.0) {
      const p0 = L(a, nA, o, 0.025); const p = [p0[0] + tA[0] * along, p0[1], p0[2] + tA[1] * along];
      const hw = 0.28, hl = 1.2;
      mark.quad([p[0] + nA[0] * hw - tA[0] * hl, p[1], p[2] + nA[1] * hw - tA[1] * hl], [p[0] + nA[0] * hw + tA[0] * hl, p[1], p[2] + nA[1] * hw + tA[1] * hl], [p[0] - nA[0] * hw + tA[0] * hl, p[1], p[2] - nA[1] * hw + tA[1] * hl], [p[0] - nA[0] * hw - tA[0] * hl, p[1], p[2] - nA[1] * hw - tA[1] * hl], C_WHITE);
    }
  }

  portal(struct, X, Z, Y, k, dir, W) {
    const n = X.length; const t = this.tangent(X, Z, k, n);
    const ang = Math.atan2(t[1], t[0]);
    const y = Y[k];
    struct.box(X[k], y - 0.2, Z[k], 1.2, 5.2, W + 2.4, C_CONC, ang);
    struct.box(X[k] + t[0] * dir * 0.62, y, Z[k] + t[1] * dir * 0.62, 0.05, 4.4, W, C_DARK, ang);
  }
}

export { WIDTH };
