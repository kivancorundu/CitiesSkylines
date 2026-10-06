// Yol ağı görünümü: pürüzsüz yollar (SmoothRoads) + raylar, enerji hatları, yol ağaçları
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, DIRS, idx, inB, vidx, eachRoadNbr } from '../core/constants.js';
import { Pool, baseBox, baseCyl, baseSphere } from './geom.js';
import { SmoothRoads } from './smoothroads.js';

const _m = new THREE.Matrix4(), _l = new THREE.Matrix4();
const _bx = new THREE.Vector3(), _by = new THREE.Vector3(), _bz = new THREE.Vector3(), _p = new THREE.Vector3();
const BRIDGE_Y = 2.2;

export class RoadView {
  constructor(scene, uniforms) {
    this.scene = scene;
    const box = baseBox();
    this.smooth = new SmoothRoads(scene);
    this.rails = new Pool(scene, box, new THREE.MeshLambertMaterial({ color: 0xffffff }), 4096, false);
    this.pylons = new Pool(scene, box, new THREE.MeshLambertMaterial({ color: 0x8c8f94 }), 1024, true);
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
    const i0 = idx(x, z);
    if (s.water[i0]) { y = Math.max(y, BRIDGE_Y); sx = 0; sz = 0; }
    const el = s.rElev ? s.rElev[i0] : 0;
    if (el === 1 && s.road[i0]) {
      // yükseltilmiş: bağlı tüm komşular yükseltilmişse tam, değilse rampa yüksekliği
      let full = true; eachRoadNbr(s, i0, (j) => { if (s.rElev[j] !== 1) full = false; });
      y = Math.max(y, 0) + (full ? 7 : 3.5); sx *= 0.3; sz *= 0.3;
    }
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
    let nr = 0, npy = 0, ntt = 0;
    const base = new THREE.Matrix4();
    const C = N * N;
    let railCount = 0, powerCount = 0;
    for (let i = 0; i < C; i++) { if (s.rail[i]) railCount++; if (s.power[i]) powerCount++; }
    // yol yüzeyi, kaldırım, çizgiler, köprüler, lambalar: pürüzsüz şerit çizici
    this.smooth.rebuild(s, tintFn);
    const P = this.smooth.cellPos, has = this.smooth.cellHas;
    const trees = this.smooth.treePts;
    this.rails.ensure(railCount * 16 + 10); this.pylons.ensure(powerCount + 10);
    this.treeTrunk.ensure(trees.length + 10); this.treeTop.ensure(trees.length + 10);
    const treeC = new THREE.Color(0x4f8a35);
    for (const t of trees) {
      _m.makeScale(0.35, 2.2, 0.35); _m.setPosition(t[0], t[1], t[2]); this.treeTrunk.set(ntt, _m, null);
      _m.makeScale(2.6, 3.0, 2.6); _m.setPosition(t[0], t[1] + 1.8, t[2]); this.treeTop.set(ntt++, _m, treeC);
    }
    const railC = new THREE.Color(0x8a8a8a);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x; const r = s.road[i];
      // tramvay rayları (yol eğrisini izler)
      if (r && s.rail[i] === 2 && has[i] && s.rElev[i] !== 2) {
        eachRoadNbr(s, i, (j) => {
          if (s.rail[j] !== 2 || !has[j]) return;
          const ax = P[i * 3], ay = P[i * 3 + 1], az = P[i * 3 + 2], bx = (ax + P[j * 3]) / 2, by = (ay + P[j * 3 + 1]) / 2, bz = (az + P[j * 3 + 2]) / 2;
          const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, ry = Math.atan2(-dz, dx);
          for (const o of [-0.75, 0.75]) {
            _l.makeRotationY(ry); _l.scale(_p.set(L + 0.1, 0.14, 0.16));
            _l.setPosition((ax + bx) / 2 - (dz / L) * o, (ay + by) / 2 + 0.03, (az + bz) / 2 + (dx / L) * o);
            this.rails.set(nr++, _l, railC);
          }
        });
      }
      // raylar
      const rl = s.rail[i];
      if (rl && !(rl === 2 && r)) {
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
    this.rails.commit(nr); this.pylons.commit(npy);
    this.treeTrunk.commit(ntt); this.treeTop.commit(ntt);
  }

  setNight(n) { this.smooth.setNight(n); }
}
