// Binaların örneklenmiş (instanced) çizimi
import * as THREE from '../vendor/three.module.min.js';
import { CS, HALF, vidx, DIRS } from '../core/constants.js';
import { Pool, baseBox, baseCyl, baseCone, baseSphere, gableGeo, windowMaterial, plainMaterial } from './geom.js';
import { genParts } from './buildingParts.js';

const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _sc = new THREE.Vector3(), _c = new THREE.Color(), _t = new THREE.Color();
const _e = new THREE.Euler(), _rz = new THREE.Matrix4();

export function facingAngle(f) { const [dx, dz] = DIRS[f]; return Math.atan2(dx, dz); }

export function buildingBaseY(s, b) {
  let mn = 1e9, mx = -1e9;
  for (const [x, z] of [[b.x, b.z], [b.x + b.sx, b.z], [b.x, b.z + b.sz], [b.x + b.sx, b.z + b.sz]]) { const h = s.vh[vidx(x, z)]; if (h < mn) mn = h; if (h > mx) mx = h; }
  return { min: mn, max: mx };
}

export class BuildingView {
  constructor(scene, uniforms) {
    this.scene = scene;
    const winMat = windowMaterial(uniforms), plMat = plainMaterial(uniforms);
    this.pools = {
      w: new Pool(scene, baseBox(), winMat, 2048),
      b: new Pool(scene, baseBox(), plMat, 4096),
      r: new Pool(scene, gableGeo(), plMat, 1024),
      c: new Pool(scene, baseCyl(10), plMat, 1024),
      k: new Pool(scene, baseCone(8), plMat, 512),
      s: new Pool(scene, baseSphere(), plMat, 1024),
      t: new Pool(scene, baseCyl(16, 0.36, 0.5), plMat, 64),
    };
    // rüzgar türbini pervaneleri
    const blade = new THREE.BoxGeometry(0.5, 12, 0.2); blade.translate(0, 6, 0);
    this.rotors = new Pool(scene, blade, new THREE.MeshLambertMaterial({ color: 0xf4f4f4 }), 64);
    this.rotorList = [];
    this.selBox = new THREE.Box3Helper(new THREE.Box3(), 0xffe066); this.selBox.visible = false; scene.add(this.selBox);
    this.hoverBox = new THREE.Box3Helper(new THREE.Box3(), 0xff4040); this.hoverBox.visible = false; scene.add(this.hoverBox);
    this.time = 0;
  }

  rebuild(s, tintFn) {
    const counts = { w: 0, b: 0, r: 0, c: 0, k: 0, s: 0, t: 0 };
    const all = [];
    for (const id in s.buildings) {
      const b = s.buildings[id];
      if (!b._parts || b._partsBuilt !== b.built >= 1) { b._parts = genParts(b); b._partsBuilt = b.built >= 1; }
      all.push(b);
      for (const p of b._parts) counts[p[0]]++;
    }
    for (const k in counts) this.pools[k].ensure(counts[k] + 8);
    const n = { w: 0, b: 0, r: 0, c: 0, k: 0, s: 0, t: 0 };
    this.rotorList = [];
    for (const b of all) {
      const { min } = buildingBaseY(s, b);
      const cx = (b.x + b.sx / 2) * CS - HALF, cz = (b.z + b.sz / 2) * CS - HALF;
      const ang = facingAngle(b.f);
      _r.makeRotationY(ang); _r.setPosition(cx, min, cz);
      const tint = tintFn ? tintFn(b) : null;
      for (const p of b._parts) {
        const [g, x, y, z, sx, sy, sz, col, ry] = p;
        _e.set(0, ry || 0, 0); _q.setFromEuler(_e);
        if (g === 'c' && ry === Math.PI / 2) { _e.set(0, 0, Math.PI / 2); _q.setFromEuler(_e); }
        _m.compose(_v.set(x, y, z), _q, _sc.set(sx, sy, sz));
        _m.premultiply(_r);
        _c.setHex(col);
        if (b.abandoned) _c.lerp(_t.setHex(0x5a5248), 0.65);
        if (tint !== null && tint !== undefined) { const l = 0.55 + 0.45 * (_c.r * 0.3 + _c.g * 0.59 + _c.b * 0.11); _c.setHex(tint).multiplyScalar(l); }
        this.pools[g].set(n[g]++, _m, _c);
      }
      if (b._rotor && b.built >= 1) {
        const [x, y, z] = b._rotor; _v.set(x, y, z).applyMatrix4(_r);
        this.rotorList.push({ pos: _v.clone(), ang, spd: 0.8 + Math.random() * 0.4, ph: Math.random() * 6 });
      }
    }
    for (const k in n) this.pools[k].commit(n[k]);
    this.rotors.ensure(this.rotorList.length * 3 + 3);
  }

  animate(dt, windStrength, paused) {
    if (!paused) this.time += dt;
    let i = 0;
    for (const r of this.rotorList) {
      const a = r.ph + this.time * r.spd * (0.5 + windStrength * 2.5);
      for (let k = 0; k < 3; k++) {
        _m.makeRotationY(r.ang); _m.multiply(_rz.makeRotationZ(a + k * 2.094));
        _m.setPosition(r.pos);
        this.rotors.set(i++, _m, null);
      }
    }
    this.rotors.commit(i);
  }

  setSelection(s, b, helper = this.selBox) {
    if (!b) { helper.visible = false; return; }
    const { min, max } = buildingBaseY(s, b);
    let top = 6; for (const p of b._parts || []) top = Math.max(top, p[2] + p[5]);
    helper.box.min.set(b.x * CS - HALF, min, b.z * CS - HALF);
    helper.box.max.set((b.x + b.sx) * CS - HALF, max + top, (b.z + b.sz) * CS - HALF);
    helper.visible = true;
  }
}
