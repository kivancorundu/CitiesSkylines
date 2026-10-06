// Yollar, kaldırımlar, şerit çizgileri, köprüler, raylar, enerji hatları, sokak lambaları
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, DIRS, idx, inB, vidx } from '../core/constants.js';
import { ROADS } from '../data/roads.js';
import { Pool, baseBox, baseCyl, baseSphere } from './geom.js';

const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _c = new THREE.Color();
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _p = new THREE.Vector3();
const BRIDGE_Y = 2.2;
const GREEN = new THREE.Color(0x5f8f3f);

export class RoadView {
  constructor(scene, uniforms) {
    this.scene = scene;
    const box = baseBox();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.surface = new Pool(scene, box, mat, 4096, false);
    this.walk = new Pool(scene, box, new THREE.MeshLambertMaterial({ color: 0xffffff }), 4096, false);
    this.marks = new Pool(scene, box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 8192, false);
    this.pillars = new Pool(scene, baseCyl(8), new THREE.MeshLambertMaterial({ color: 0x9a9a9a }), 256, true);
    this.rails = new Pool(scene, box, new THREE.MeshLambertMaterial({ color: 0xffffff }), 4096, false);
    this.pylons = new Pool(scene, box, new THREE.MeshLambertMaterial({ color: 0x8c8f94 }), 1024, true);
    this.lampPosts = new Pool(scene, box, new THREE.MeshLambertMaterial({ color: 0x555a60 }), 4096, false);
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x777766 });
    this.lampHeads = new Pool(scene, box, this.lampMat, 4096, false);
    this.treeTrunk = new Pool(scene, baseCyl(5), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }), 2048, true);
    this.treeTop = new Pool(scene, baseSphere(), new THREE.MeshLambertMaterial({ color: 0xffffff }), 2048, true);
    this.wireGeo = new THREE.BufferGeometry();
    this.wires = new THREE.LineSegments(this.wireGeo, new THREE.LineBasicMaterial({ color: 0x222222 }));
    scene.add(this.wires);
    this.uniforms = uniforms;
    this.tint = null;
  }

  cellBasis(s, x, z, out) {
    const a = s.vh[vidx(x, z)], b = s.vh[vidx(x + 1, z)], c = s.vh[vidx(x, z + 1)], d = s.vh[vidx(x + 1, z + 1)];
    let y = (a + b + c + d) / 4; let sx = ((b + d) - (a + c)) / 2, sz = ((c + d) - (a + b)) / 2;
    if (s.water[idx(x, z)]) { y = BRIDGE_Y; sx = 0; sz = 0; }
    _bx.set(CS, sx, 0).normalize(); _bz.set(0, sz, CS).normalize(); _by.crossVectors(_bz, _bx).normalize();
    out.makeBasis(_bx, _by, _bz);
    out.setPosition((x + 0.5) * CS - HALF, y + 0.05, (z + 0.5) * CS - HALF);
    return y;
  }

  piece(pool, n, base, lx, ly, lz, sx, sy, sz, color, ry = 0) {
    _l.makeRotationY(ry); _l.scale(_p.set(sx, sy, sz)); _l.setPosition(lx, ly, lz);
    _m.multiplyMatrices(base, _l);
    pool.set(n, _m, color);
  }

  rebuild(s, tintFn) {
    let ns = 0, nw = 0, nm = 0, np = 0, nr = 0, npy = 0, nlp = 0, nlh = 0, ntt = 0;
    const base = new THREE.Matrix4();
    const C = N * N;
    let roadCount = 0, railCount = 0, powerCount = 0;
    for (let i = 0; i < C; i++) { if (s.road[i]) roadCount++; if (s.rail[i]) railCount++; if (s.power[i]) powerCount++; }
    this.surface.ensure(roadCount * 5 + 10); this.walk.ensure(roadCount + 10); this.marks.ensure(roadCount * 14 + 10);
    this.rails.ensure(railCount * 8 + roadCount + 10); this.pylons.ensure(powerCount + 10); this.lampPosts.ensure(roadCount + 10); this.lampHeads.ensure(roadCount + 10);
    this.treeTrunk.ensure(roadCount * 2 + 10); this.treeTop.ensure(roadCount * 2 + 10); this.pillars.ensure(roadCount + 10);
    const white = new THREE.Color(0xf2f2f2), walkC = new THREE.Color(0xb8b5ae), dark = new THREE.Color(0x303030);
    const cw = new THREE.Color(0xeeeeee);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x; const r = s.road[i];
      if (r) {
        const def = ROADS[r];
        this.cellBasis(s, x, z, base);
        const conn = [];
        for (let d = 0; d < 4; d++) { const nx = x + DIRS[d][0], nz = z + DIRS[d][1]; conn.push(inB(nx, nz) && s.road[idx(nx, nz)] > 0); }
        const deg = conn.filter(Boolean).length;
        _c.setHex(def.color);
        if (tintFn) { const t = tintFn(i); if (t !== null) _c.setHex(t); }
        const isHwy = def.key === 'highway', ped = def.key === 'pedestrian';
        const aw = isHwy ? 7.6 : ped ? 7.8 : 6.2;
        // kaldırım tabanı
        if (!isHwy && !ped) { this.piece(this.walk, nw++, base, 0, -0.05, 0, CS, 0.3, CS, walkC); }
        // merkez asfalt
        this.piece(this.surface, ns++, base, 0, 0, 0, aw, 0.3, aw, _c);
        for (let d = 0; d < 4; d++) {
          if (!conn[d]) continue;
          const [dx, dz] = DIRS[d]; const L = (CS - aw) / 2 + 0.02;
          const off = aw / 2 + L / 2;
          this.piece(this.surface, ns++, base, dx * off, 0, dz * off, dx ? L : aw, 0.3, dz ? L : aw, _c);
        }
        // çizgiler
        if (def.mark !== null && deg > 0) {
          _c.setHex(def.mark);
          if (deg <= 2) {
            for (let d = 0; d < 4; d++) {
              if (!conn[d]) continue; const [dx, dz] = DIRS[d];
              if (def.key === 'large') {
                // refüj (yeşil)
                this.piece(this.marks, nm++, base, dx * 2, 0.31, dz * 2, dx ? 4 : 1.0, 0.12, dz ? 4 : 1.0, GREEN);
              } else {
                this.piece(this.marks, nm++, base, dx * 2, 0.31, dz * 2, dx ? 2.2 : 0.22, 0.02, dz ? 2.2 : 0.22, _c);
              }
              if (def.lanes >= 4 || isHwy) {
                // şerit çizgileri
                for (const o of [-1.7, 1.7]) {
                  const ox = dz ? o : 0, oz = dx ? o : 0;
                  this.piece(this.marks, nm++, base, dx * 2.4 + ox, 0.31, dz * 2.4 + oz, dx ? 1.2 : 0.14, 0.02, dz ? 1.2 : 0.14, white);
                }
              }
              if (def.key === 'buslane') {
                for (const o of [-2.6, 2.6]) {
                  const ox = dz ? o : 0, oz = dx ? o : 0;
                  this.piece(this.marks, nm++, base, dx * 2 + ox, 0.305, dz * 2 + oz, dx ? 4 : 1.0, 0.02, dz ? 4 : 1.0, new THREE.Color(0x9a3a3a));
                }
              }
            }
          } else if (!isHwy) {
            // yaya geçitleri
            for (let d = 0; d < 4; d++) {
              if (!conn[d]) continue; const [dx, dz] = DIRS[d];
              for (let k = -2; k <= 2; k++) {
                const o = k * 1.2; const ox = dz ? o : 0, oz = dx ? o : 0;
                this.piece(this.marks, nm++, base, dx * 3.2 + ox, 0.31, dz * 3.2 + oz, dx ? 1.2 : 0.55, 0.02, dz ? 1.2 : 0.55, cw);
              }
            }
          }
        }
        // köprü ayakları
        if (s.water[i] && (x + z) % 2 === 0) {
          _m.makeScale(1.6, BRIDGE_Y + 6, 1.6); _m.setPosition((x + 0.5) * CS - HALF, -6, (z + 0.5) * CS - HALF);
          this.pillars.set(np++, _m, null);
        }
        // sokak lambaları
        if (!isHwy && !s.water[i] && (x + z) % 2 === 0) {
          let side = -1; for (let d = 0; d < 4; d++) if (!conn[d]) { side = d; break; }
          if (side >= 0) {
            const [dx, dz] = DIRS[side];
            this.piece(this.lampPosts, nlp++, base, dx * 3.6, 0, dz * 3.6, 0.18, 6, 0.18, null);
            this.piece(this.lampHeads, nlh++, base, dx * 3.3, 5.9, dz * 3.3, 0.8, 0.25, 0.8, null);
          }
        }
        // yol ağaçları
        if (s.roadUp[i] & 1) {
          for (let d = 0; d < 4; d++) {
            if (conn[d]) continue; const [dx, dz] = DIRS[d]; const px = dz ? 0 : 0;
            const ox = dx * 3.5 + (dz ? 2 : 0) + px, oz = dz * 3.5 + (dx ? 2 : 0);
            this.piece(this.treeTrunk, ntt, base, ox, 0, oz, 0.35, 2.2, 0.35, null);
            this.piece(this.treeTop, ntt++, base, ox, 1.8, oz, 2.6, 3.0, 2.6, new THREE.Color(0x4f8a35));
          }
        }
        if (s.roadUp[i] & 2) {
          for (let d = 0; d < 4; d++) { if (conn[d]) continue; const [dx, dz] = DIRS[d]; this.piece(this.marks, nm++, base, dx * 3.3, 0.2, dz * 3.3, dx ? 1.2 : 8, 0.18, dz ? 1.2 : 8, new THREE.Color(0x5f9f3f)); }
        }
        if (s.roadUp[i] & 4) this.piece(this.marks, nm++, base, 0, 0.31, 0, 5, 0.12, 0.7, new THREE.Color(0xd0b030));
      }
      // raylar
      const rl = s.rail[i];
      if (rl) {
        const y0 = this.cellBasis(s, x, z, base); void y0;
        const conn = [];
        for (let d = 0; d < 4; d++) { const nx = x + DIRS[d][0], nz = z + DIRS[d][1]; conn.push(inB(nx, nz) && s.rail[idx(nx, nz)] === rl); }
        if (rl === 1 && !r) {
          this.piece(this.rails, nr++, base, 0, -0.1, 0, 4.2, 0.45, 4.2, new THREE.Color(0x7a7066));
          for (let d = 0; d < 4; d++) if (conn[d]) { const [dx, dz] = DIRS[d]; this.piece(this.rails, nr++, base, dx * 3.05, -0.1, dz * 3.05, dx ? 1.9 : 4.2, 0.45, dz ? 1.9 : 4.2, new THREE.Color(0x7a7066)); }
        }
        const railC = new THREE.Color(rl === 1 ? 0x4a4a4a : 0x8a8a8a);
        const anyConn = conn.some(Boolean);
        for (let d = 0; d < 4; d++) {
          if (!conn[d] && anyConn) continue; const [dx, dz] = DIRS[d];
          for (const o of [-0.75, 0.75]) {
            const ox = dz ? o : 0, oz = dx ? o : 0;
            const ddx = anyConn ? dx : (d % 2 === 0 ? 1 : 0), ddz = anyConn ? dz : (d % 2 === 0 ? 0 : 1);
            this.piece(this.rails, nr++, base, ddx * 2 + ox, 0.32, ddz * 2 + oz, ddx ? 4.05 : 0.16, 0.14, ddz ? 4.05 : 0.16, railC);
          }
        }
      }
      // enerji direkleri
      if (s.power[i] && (x + z) % 3 === 0) {
        const h = this.cellBasis(s, x, z, base);
        _m.makeScale(0.7, 14, 0.7); _m.setPosition((x + 0.5) * CS - HALF, h, (z + 0.5) * CS - HALF); this.pylons.set(npy++, _m, null);
        _m.makeScale(4.5, 0.35, 0.35); _m.setPosition((x + 0.5) * CS - HALF, h + 12.5, (z + 0.5) * CS - HALF); this.pylons.set(npy++, _m, null);
      }
    }
    // teller
    const wv = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x; if (!s.power[i]) continue;
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        const nx = x + dx, nz = z + dz; if (!inB(nx, nz) || !s.power[idx(nx, nz)]) continue;
        const h1 = Math.max(0, s.vh[vidx(x, z)]) + 12.6, h2 = Math.max(0, s.vh[vidx(nx, nz)]) + 12.6;
        for (const o of [-1.8, 1.8]) {
          const ox = dz ? o : 0, oz = dx ? o : 0;
          wv.push((x + 0.5) * CS - HALF + ox, h1, (z + 0.5) * CS - HALF + oz, (nx + 0.5) * CS - HALF + ox, h2, (nz + 0.5) * CS - HALF + oz);
        }
      }
    }
    this.wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3));
    this.wireGeo.computeBoundingSphere();
    this.surface.commit(ns); this.walk.commit(nw); this.marks.commit(nm); this.pillars.commit(np);
    this.rails.commit(nr); this.pylons.commit(npy); this.lampPosts.commit(nlp); this.lampHeads.commit(nlh);
    this.treeTrunk.commit(ntt); this.treeTop.commit(ntt);
    void dark;
  }

  setNight(n) { this.lampMat.color.setRGB(0.47 + n * 0.53, 0.47 + n * 0.45, 0.4 + n * 0.25); }
}
