// Ağaçlar (mevsime göre renk değiştirir)
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, heightAt } from '../core/constants.js';
import { hash2 } from '../core/rng.js';
import { Pool, baseCyl, baseCone, plainMaterial } from './geom.js';

const _m = new THREE.Matrix4(), _c = new THREE.Color();

export class TreeView {
  constructor(scene, uniforms) {
    const mat = plainMaterial(uniforms);
    this.trunk = new Pool(scene, baseCyl(5, 0.18, 0.28), new THREE.MeshLambertMaterial({ color: 0x5e4630 }), 8192);
    this.leaf = new Pool(scene, new THREE.IcosahedronGeometry(1, 0).translate(0, 1, 0), mat, 8192);
    this.coni = new Pool(scene, baseCone(7), mat, 8192);
  }
  rebuild(s, month) {
    let total = 0; for (let i = 0; i < N * N; i++) total += s.tree[i];
    this.trunk.ensure(total + 8); this.leaf.ensure(total + 8); this.coni.ensure(total + 8);
    let nt = 0, nl = 0, nc = 0;
    const autumn = month >= 8 && month <= 10, winter = month === 11 || month <= 1, spring = month >= 2 && month <= 3;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x; const k = s.tree[i]; if (!k) continue;
      for (let t = 0; t < k; t++) {
        const r1 = hash2(x * 7 + t, z, 11), r2 = hash2(x, z * 5 + t, 13), r3 = hash2(x + t, z + t, 17);
        const wx = (x + 0.15 + r1 * 0.7) * CS - HALF, wz = (z + 0.15 + r2 * 0.7) * CS - HALF;
        const y = heightAt(s, wx, wz) - 0.2;
        const sc = 0.8 + r3 * 0.6;
        const conifer = s.res[i] === 2 ? r3 < 0.6 : r3 < 0.25;
        _m.makeScale(sc, sc * 3, sc); _m.setPosition(wx, y, wz); this.trunk.set(nt++, _m, null);
        if (conifer) {
          _m.makeScale(4.2 * sc, 9 * sc, 4.2 * sc); _m.setPosition(wx, y + 1.5 * sc, wz);
          _c.setRGB(0.17 + r1 * 0.05, 0.33 + r2 * 0.08, 0.17);
          this.coni.set(nc++, _m, _c);
        } else {
          _m.makeScale(2.6 * sc, 2.8 * sc, 2.6 * sc); _m.setPosition(wx, y + 2.2 * sc, wz);
          if (winter) { _m.makeScale(2.0 * sc, 2.6 * sc, 2.0 * sc); _m.setPosition(wx, y + 2.4 * sc, wz); _c.setRGB(0.42 + r1 * 0.06, 0.36, 0.3); }
          else if (autumn) _c.setRGB(0.75 + r1 * 0.2, 0.35 + r2 * 0.3, 0.1);
          else if (spring && r3 > 0.75) _c.setRGB(0.95, 0.75, 0.85);
          else _c.setRGB(0.25 + r1 * 0.12, 0.45 + r2 * 0.15, 0.18 + r3 * 0.05);
          this.leaf.set(nl++, _m, _c);
        }
      }
    }
    this.trunk.commit(nt); this.leaf.commit(nl); this.coni.commit(nc);
  }
}
