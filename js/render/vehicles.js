// Araçlar: özel araçlar, kamyonlar, hizmet araçları ve toplu taşıma
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, vidx, clamp } from '../core/constants.js';
import { ROADS } from '../data/roads.js';
import { LINE_TYPES } from '../sim/transit.js';
import { Pool, mergeGeos, plainMaterial } from './geom.js';

const _m = new THREE.Matrix4(), _c = new THREE.Color(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
const CAR_COLORS = [0xd0d0d0, 0x202020, 0xf0f0f0, 0xa02020, 0x2040a0, 0x606870, 0x8a8a8a, 0x2a6a3a, 0xc0a040, 0x5a3a8a];
const KIND_COLORS = { truck: 0xe8e4dc, garbage: 0x5a8a3a, ambulance: 0xf4f4f4, fire: 0xd02a1a, police: 0x2a4aa0, hearse: 0x1a1a1a, post: 0xe0b020 };

function carGeo(len, w, h, cabin = true) {
  const body = new THREE.BoxGeometry(w, h * 0.55, len); body.translate(0, 0.35 + h * 0.275, 0);
  if (!cabin) return body;
  const cab = new THREE.BoxGeometry(w * 0.85, h * 0.42, len * 0.5); cab.translate(0, 0.35 + h * 0.55 + h * 0.21, -len * 0.05);
  return mergeGeos([body, cab]);
}

function cellY(s, c) {
  if (s.water[c]) return 2.25;
  const x = c % N, z = (c / N) | 0;
  return (s.vh[vidx(x, z)] + s.vh[vidx(x + 1, z)] + s.vh[vidx(x, z + 1)] + s.vh[vidx(x + 1, z + 1)]) / 4 + 0.35;
}

export class VehicleView {
  constructor(scene, uniforms) {
    const mat = plainMaterial(uniforms);
    this.pools = {
      car: new Pool(scene, carGeo(4.3, 1.9, 1.7), mat, 512),
      truck: new Pool(scene, carGeo(7.5, 2.4, 3.2, false), mat, 128),
      bus: new Pool(scene, carGeo(11, 2.5, 3.2, false), mat, 64),
      tram: new Pool(scene, carGeo(7, 2.5, 3.4, false), mat, 128),
      train: new Pool(scene, carGeo(14, 3, 3.8, false), mat, 128),
    };
    this.agents = [];
    this.transit = new Map();
    this.max = 450;
    this.lineGeo = new THREE.BufferGeometry();
    this.lineObj = new THREE.LineSegments(this.lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lineObj.renderOrder = 10; this.lineObj.visible = false;
    scene.add(this.lineObj);
  }

  spawn(s, path, kind = 'car') {
    if (!path || path.length < 2) return;
    if (this.agents.length >= this.max) this.agents.shift();
    const col = kind === 'car' ? CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0] : (KIND_COLORS[kind] || 0xffffff);
    this.agents.push({ path, u: 0, kind, col, pool: kind === 'car' ? 'car' : kind === 'truck' ? 'truck' : 'car', spd: 0.85 + Math.random() * 0.3 });
  }

  clear() { this.agents = []; this.transit.clear(); }

  posAt(s, path, u, out, laneOff = 1.7) {
    const n = path.length - 1;
    const i = clamp(Math.floor(u), 0, n - 1), t = clamp(u - i, 0, 1);
    const a = path[i], b = path[i + 1];
    const ax = (a % N + 0.5) * CS - HALF, az = (((a / N) | 0) + 0.5) * CS - HALF;
    const bx = (b % N + 0.5) * CS - HALF, bz = (((b / N) | 0) + 0.5) * CS - HALF;
    let dx = bx - ax, dz = bz - az; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    out.x = ax + (bx - ax) * t - dz * laneOff;
    out.z = az + (bz - az) * t + dx * laneOff;
    out.y = cellY(s, a) * (1 - t) + cellY(s, b) * t;
    out.ang = Math.atan2(dx, dz);
    return out;
  }

  update(s, dt, speedMul, showLines) {
    const counts = { car: 0, truck: 0, bus: 0, tram: 0, train: 0 };
    const P = { x: 0, y: 0, z: 0, ang: 0 };
    const pools = this.pools;
    const put = (pool, p, col, yoff = 0) => {
      _q.setFromAxisAngle(_up, p.ang); _m.compose(_v.set(p.x, p.y + yoff, p.z), _q, _s);
      _c.setHex(col); pools[pool].set(counts[pool]++, _m, _c);
    };
    pools.car.ensure(this.agents.length + 4); pools.truck.ensure(this.agents.length + 4);
    const keep = [];
    for (const a of this.agents) {
      const c = a.path[Math.min(a.path.length - 1, Math.floor(a.u))];
      const r = s.road[c];
      if (!r) continue; // yol kaldırıldı
      const def = ROADS[r];
      const cong = s.traffic[c] / def.cap;
      let v = (def.speed / 50) * 2.0 * a.spd * speedMul;
      if (cong > 0.8) v /= 1 + (cong - 0.8) * 2.5;
      a.u += v * dt;
      if (a.u >= a.path.length - 1) continue;
      this.posAt(s, a.path, a.u, P);
      put(a.pool, P, a.col);
      keep.push(a);
    }
    this.agents = keep;
    // toplu taşıma araçları
    const tv = s.lines.reduce((a, l) => a + l.vehicles * 4, 0) + 4;
    pools.bus.ensure(tv); pools.tram.ensure(tv); pools.train.ensure(tv);
    const lineVerts = [], lineCols = [];
    const seen = new Set();
    for (const line of s.lines) {
      seen.add(line.id);
      if (!line.valid || !line.path.length) { this.transit.delete(line.id); continue; }
      const T = LINE_TYPES[line.type];
      let st = this.transit.get(line.id);
      if (!st || st.n !== line.vehicles || st.len !== line.path.length) {
        st = { n: line.vehicles, len: line.path.length, vs: [] };
        for (let k = 0; k < line.vehicles; k++) st.vs.push({ u: (k / line.vehicles) * (line.path.length - 1), wait: 0 });
        this.transit.set(line.id, st);
      }
      const stopSet = new Set(line.stopIdx || []);
      const col = new THREE.Color(line.color).getHex();
      for (const v of st.vs) {
        if (v.wait > 0) v.wait -= dt * speedMul;
        else {
          const before = Math.floor(v.u);
          v.u += T.speed * 1.6 * speedMul * dt * (line.type === 'bus' && s.road[line.path[before]] === 5 ? 1.3 : 1);
          if (v.u >= line.path.length - 1) v.u -= line.path.length - 1;
          const after = Math.floor(v.u);
          if (after !== before && stopSet.has(line.path[after])) v.wait = 1.2;
        }
        if (line.type === 'metro') continue; // yeraltında
        if (line.type === 'bus') { this.posAt(s, line.path, v.u, P); put('bus', P, col); }
        else if (line.type === 'tram') { for (let k = 0; k < 3; k++) { const u = v.u - k * 0.9; if (u < 0) continue; this.posAt(s, line.path, u, P, 0); put('tram', P, col); } }
        else if (line.type === 'train') { for (let k = 0; k < 4; k++) { const u = v.u - k * 1.8; if (u < 0) continue; this.posAt(s, line.path, u, P, 0); put('train', P, k === 0 ? 0xd35400 : 0xb8bcc0); } }
      }
      if (showLines) {
        _c.set(line.color);
        for (let k = 0; k < line.path.length - 1; k++) {
          const a = line.path[k], b = line.path[k + 1];
          const off = line.type === 'metro' ? 0.5 : 3.5;
          lineVerts.push((a % N + 0.5) * CS - HALF, cellY(s, a) + off, (((a / N) | 0) + 0.5) * CS - HALF, (b % N + 0.5) * CS - HALF, cellY(s, b) + off, (((b / N) | 0) + 0.5) * CS - HALF);
          lineCols.push(_c.r, _c.g, _c.b, _c.r, _c.g, _c.b);
        }
      }
    }
    for (const id of this.transit.keys()) if (!seen.has(id)) this.transit.delete(id);
    for (const k in counts) pools[k].commit(counts[k]);
    this.lineObj.visible = showLines;
    if (showLines) {
      this.lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineVerts, 3));
      this.lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineCols, 3));
      this.lineGeo.computeBoundingSphere();
    }
  }
}
