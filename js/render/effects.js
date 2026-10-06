// Parçacıklar (duman, ateş), hava (yağmur, kar), hortum, yıldırım, önizleme hayaletleri, bildirim simgeleri
import * as THREE from '../vendor/three.module.min.js';
import { N, CS, HALF, heightAt, cellHeight } from '../core/constants.js';
import { buildingBaseY, facingAngle } from './buildings.js';

class Particles {
  constructor(scene, max, color, size, additive = false) {
    this.max = max;
    this.pos = new Float32Array(max * 3); this.alpha = new Float32Array(max); this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uScale: { value: 300 } },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute float aAlpha; attribute float aSize; varying float vA; uniform float uScale; void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; gl_FragColor = vec4(uColor, vA * (1.0 - r * 2.0)); }',
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false;
    scene.add(this.points);
    this.next = 0;
  }
  emit(x, y, z, vx, vy, vz, life, size) {
    const i = this.next; this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.size[i] = size;
  }
  update(dt, grow = 1.5, fade = 0.6) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.max(0, t) * fade; this.size[i] += grow * dt;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.aAlpha.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.smoke = new Particles(scene, 1500, 0x9a9a9a, 6);
    this.fire = new Particles(scene, 800, 0xff7a20, 4, true);
    // hava parçacıkları
    this.wN = 3500;
    this.wPos = new Float32Array(this.wN * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.wPos, 3));
    this.wMat = new THREE.PointsMaterial({ color: 0xaaccff, size: 0.6, transparent: true, opacity: 0.6, depthWrite: false });
    this.weather = new THREE.Points(g, this.wMat); this.weather.frustumCulled = false; scene.add(this.weather);
    for (let i = 0; i < this.wN; i++) { this.wPos[i * 3] = (Math.random() - 0.5) * 600; this.wPos[i * 3 + 1] = Math.random() * 250; this.wPos[i * 3 + 2] = (Math.random() - 0.5) * 600; }
    // hortum
    const tg = new THREE.CylinderGeometry(28, 3, 140, 20, 6, true); tg.translate(0, 70, 0);
    this.tornado = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: 0x6a6a70, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    this.tornado.visible = false; scene.add(this.tornado);
    // yıldırım
    this.boltGeo = new THREE.BufferGeometry();
    this.bolt = new THREE.Line(this.boltGeo, new THREE.LineBasicMaterial({ color: 0xffffff })); this.bolt.visible = false; scene.add(this.bolt);
    this.boltT = 0;
    // önizleme
    this.ghostMatOk = new THREE.MeshBasicMaterial({ color: 0x40e070, transparent: true, opacity: 0.45, depthWrite: false });
    this.ghostMatBad = new THREE.MeshBasicMaterial({ color: 0xe04040, transparent: true, opacity: 0.45, depthWrite: false });
    const cg = new THREE.BoxGeometry(1, 1, 1); cg.translate(0, 0.5, 0);
    this.cellGhost = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }), 4096);
    this.cellGhost.count = 0; this.cellGhost.frustumCulled = false; this.cellGhost.renderOrder = 5;
    this.cellGhost.setColorAt(0, new THREE.Color(1, 1, 1));
    scene.add(this.cellGhost);
    this.bGhost = new THREE.Mesh(cg, this.ghostMatOk); this.bGhost.visible = false; this.bGhost.renderOrder = 5; scene.add(this.bGhost);
    this.arrow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })); this.arrow.visible = false; scene.add(this.arrow);
    this.radius = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    this.radius.visible = false; scene.add(this.radius);
    this.brush = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.brush.visible = false; scene.add(this.brush);
    // yol önizleme şeridi (CS2 tarzı yarı saydam hayalet yol)
    this.ribbonGeo = new THREE.BufferGeometry();
    // derinlik testi yok: ağaçların/binaların arkasında kalmaz
    this.ribbon = new THREE.Mesh(this.ribbonGeo, new THREE.MeshBasicMaterial({ color: 0x7fd0ff, transparent: true, opacity: 0.6, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    this.ribbon.visible = false; this.ribbon.frustumCulled = false; this.ribbon.renderOrder = 6; scene.add(this.ribbon);
    this.ribbonEdge = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false }));
    this.ribbonEdge.visible = false; this.ribbonEdge.frustumCulled = false; this.ribbonEdge.renderOrder = 7; scene.add(this.ribbonEdge);
    // simgeler
    this.iconGroup = new THREE.Group(); scene.add(this.iconGroup);
    this.iconMats = {};
    this.iconT = 0;
    this.emitT = 0;
  }

  iconMat(emoji) {
    if (this.iconMats[emoji]) return this.iconMats[emoji];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(20,30,45,0.85)'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffcc33'; g.lineWidth = 3; g.stroke();
    g.font = '36px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 32, 35);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (this.iconMats[emoji] = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  }

  updateIcons(s, dist) {
    this.iconGroup.clear();
    if (dist > 1100 || this.iconsOn === false) return;
    let n = 0;
    for (const id in s.buildings) {
      const b = s.buildings[id];
      const e = problemIcon(s, b); if (!e) continue;
      if (n++ > 400) break;
      const sp = new THREE.Sprite(this.iconMat(e));
      const { max } = buildingBaseY(s, b);
      let top = 8; for (const p of b._parts || []) top = Math.max(top, p[2] + p[5]);
      sp.position.set((b.x + b.sx / 2) * CS - HALF, max + top + 5, (b.z + b.sz / 2) * CS - HALF);
      const sc = 5 + dist * 0.012; sp.scale.set(sc, sc, sc); sp.renderOrder = 20;
      this.iconGroup.add(sp);
    }
  }

  update(s, dt, speedMul, camTarget, nightF, dist) {
    const sim = speedMul > 0;
    // duman ve ateş yayıcıları
    this.emitT += dt;
    if (this.emitT > 0.08 && this.particlesOn !== false) {
      this.emitT = 0;
      for (const id in s.buildings) {
        const b = s.buildings[id];
        if (b._smoke && b._smoke.length && b.built >= 1 && !b.abandoned && !b.collapsed && sim && Math.random() < 0.35) {
          const ang = facingAngle(b.f), ca = Math.cos(ang), sa = Math.sin(ang);
          const { min } = buildingBaseY(s, b);
          for (const [x, y, z] of b._smoke) {
            const wx = (b.x + b.sx / 2) * CS - HALF + x * ca + z * sa, wz = (b.z + b.sz / 2) * CS - HALF - x * sa + z * ca;
            this.smoke.emit(wx, min + y, wz, 1.5 + Math.random(), 3 + Math.random() * 2, 0.8, 6 + Math.random() * 3, 4);
          }
        }
        if (b.fire) {
          const { max } = buildingBaseY(s, b);
          for (let k = 0; k < 3; k++) {
            const wx = (b.x + Math.random() * b.sx) * CS - HALF, wz = (b.z + Math.random() * b.sz) * CS - HALF;
            this.fire.emit(wx, max + 2 + Math.random() * 6, wz, (Math.random() - 0.5) * 2, 6 + Math.random() * 6, (Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.6, 5);
            this.smoke.emit(wx, max + 8, wz, 1, 6, 1, 5, 6);
          }
        }
      }
      if (s.rt.forestFire) {
        let k = 0;
        for (const c of s.rt.forestFire) {
          if (k++ > 120) break;
          const x = c % N, z = (c / N) | 0; const wx = (x + Math.random()) * CS - HALF, wz = (z + Math.random()) * CS - HALF;
          const y = cellHeight(s, x, z);
          this.fire.emit(wx, y + 3 + Math.random() * 5, wz, 0, 5 + Math.random() * 4, 0, 0.9, 5);
          if (Math.random() < 0.4) this.smoke.emit(wx, y + 10, wz, 1, 5, 1, 5, 7);
        }
      }
    }
    this.smoke.update(dt, 2.2, 0.45); this.fire.update(dt, 1.0, 0.9);
    // hava
    const w = s.weather;
    const rain = w.rain, snow = w.snow;
    this.weather.visible = this.weatherOn !== false && (rain > 0.05 || snow > 0.05);
    if (this.weather.visible) {
      const isSnow = snow > rain;
      this.wMat.color.setHex(isSnow ? 0xffffff : 0x9fb8d8); this.wMat.size = isSnow ? 1.4 : 0.7; this.wMat.opacity = Math.min(0.8, (isSnow ? snow : rain) + 0.1);
      const fall = isSnow ? 18 : 140, cx = camTarget.x, cz = camTarget.z, cy = camTarget.y;
      const act = Math.floor(this.wN * Math.min(1, (isSnow ? snow : rain)));
      for (let i = 0; i < this.wN; i++) {
        let y = this.wPos[i * 3 + 1] - fall * dt;
        if (i >= act) { this.wPos[i * 3 + 1] = -999; continue; }
        if (y < cy - 20 || y > cy + 400) { y = cy + 150 + Math.random() * 100; this.wPos[i * 3] = cx + (Math.random() - 0.5) * 700; this.wPos[i * 3 + 2] = cz + (Math.random() - 0.5) * 700; }
        if (isSnow) { this.wPos[i * 3] += Math.sin(y * 0.1 + i) * dt * 3; }
        this.wPos[i * 3 + 1] = y;
      }
      this.weather.geometry.attributes.position.needsUpdate = true;
    }
    // hortum
    const t = s.rt.tornado;
    this.tornado.visible = !!t;
    if (t) {
      const wx = t.x * CS - HALF, wz = t.z * CS - HALF;
      this.tornado.position.set(wx, heightAt(s, wx, wz), wz); this.tornado.rotation.y += dt * 6;
      for (let k = 0; k < 4; k++) { const a = Math.random() * 6.28, r = 5 + Math.random() * 25; this.smoke.emit(wx + Math.cos(a) * r, this.tornado.position.y + Math.random() * 60, wz + Math.sin(a) * r, -Math.sin(a) * 25, 4, Math.cos(a) * 25, 1.5, 5); }
    }
    // yıldırım
    if (s.rt.lightningAt !== undefined && s.rt.lightningAt !== null) {
      const c = s.rt.lightningAt; s.rt.lightningAt = null;
      const x = (c % N + 0.5) * CS - HALF, z = (((c / N) | 0) + 0.5) * CS - HALF, y = cellHeight(s, c % N, (c / N) | 0);
      const pts = []; let px = x, pz = z;
      for (let k = 0; k <= 10; k++) { pts.push(px, y + 300 - k * 30, pz); px += (Math.random() - 0.5) * 25; pz += (Math.random() - 0.5) * 25; }
      pts[pts.length - 3] = x; pts[pts.length - 2] = y; pts[pts.length - 1] = z;
      this.boltGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); this.boltT = 0.25;
    }
    this.boltT -= dt; this.bolt.visible = this.boltT > 0;
    this.iconT -= dt;
    if (this.iconT <= 0 || s.rt.dirty.icons) { this.iconT = 0.6; s.rt.dirty.icons = false; this.updateIcons(s, dist); }
    void nightF;
  }

  // ---- önizleme ----
  showCells(s, cells, colorFn, height = 0.6) {
    const n = Math.min(cells.length, 4096); const m = new THREE.Matrix4(), c = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const [x, z, col] = cells[k];
      const y = s.water[z * N + x] ? 2.2 : cellHeight(s, x, z);
      m.makeScale(CS * 0.92, height, CS * 0.92); m.setPosition((x + 0.5) * CS - HALF, y + 0.2, (z + 0.5) * CS - HALF);
      this.cellGhost.setMatrixAt(k, m); c.setHex(col ?? (colorFn ? colorFn(x, z) : 0x40e070)); this.cellGhost.setColorAt(k, c);
    }
    this.cellGhost.count = n; this.cellGhost.instanceMatrix.needsUpdate = true; if (this.cellGhost.instanceColor) this.cellGhost.instanceColor.needsUpdate = true;
  }
  hideCells() { this.cellGhost.count = 0; this.ribbon.visible = false; this.ribbonEdge.visible = false; }

  // samplesList: hücre koordinatlı örnek dizileri; elev: 0 zemin, 1 yükseltilmiş, 2 tünel, 'auto' mevcut yolun yüksekliği
  showRoadRibbon(s, samplesList, width, ok, elev = 0) {
    const pos = [], ind = [], edge = [];
    // uzaktan bakınca da görünsün: ekranda en az birkaç piksel genişlik
    const f = samplesList[0] && samplesList[0][0];
    if (f) { const cp = this.camera.position; const d = Math.hypot(cp.x - (f[0] * CS - HALF), cp.y, cp.z - (f[1] * CS - HALF)); width = Math.max(width, d * 0.03); }
    for (const sm of samplesList) {
      const n = sm.length; if (n < 2) continue;
      const X = [], Y = [], Z = [];
      for (const p of sm) {
        const x = p[0] * CS - HALF, z = p[1] * CS - HALF;
        const c = Math.min(N - 1, Math.max(0, Math.floor(p[1]))) * N + Math.min(N - 1, Math.max(0, Math.floor(p[0])));
        let y = Math.max(heightAt(s, x, z), -0.2);
        const el = elev === 'auto' ? s.rElev[c] : elev;
        if (s.water[c]) y = 3.2;
        if (el === 1) y = Math.max(y, 0) + 7.5;
        X.push(x); Y.push(y + 0.45 + (el === 2 ? 0.3 : 0)); Z.push(z);
      }
      for (let k = 1; k < n; k++) Y[k] = Math.max(Y[k], Y[k - 1] - CS * 0.25 * 0.22);
      for (let k = n - 2; k >= 0; k--) Y[k] = Math.max(Y[k], Y[k + 1] - CS * 0.25 * 0.22);
      const b0 = pos.length / 3;
      for (let k = 0; k < n; k++) {
        const a = Math.max(0, k - 1), b = Math.min(n - 1, k + 1);
        let dx = X[b] - X[a], dz = Z[b] - Z[a]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
        const nx = -dz * width / 2, nz = dx * width / 2;
        pos.push(X[k] + nx, Y[k], Z[k] + nz, X[k] - nx, Y[k], Z[k] - nz);
        if (k) { const i = b0 + k * 2; ind.push(i - 2, i - 1, i, i - 1, i + 1, i); edge.push(...pos.slice((i - 2) * 3, (i - 1) * 3), ...pos.slice(i * 3, i * 3 + 3), ...pos.slice((i - 1) * 3, i * 3), ...pos.slice((i + 1) * 3, (i + 2) * 3)); }
      }
      // uç noktalarında daire (başlangıç / bitiş belirgin olsun)
      for (const k of [0, n - 1]) {
        const c0 = pos.length / 3; pos.push(X[k], Y[k], Z[k]);
        const r = width * 0.62;
        for (let q = 0; q <= 20; q++) { const t = (q / 20) * Math.PI * 2; pos.push(X[k] + Math.cos(t) * r, Y[k], Z[k] + Math.sin(t) * r); if (q) { ind.push(c0, c0 + q, c0 + q + 1); edge.push(X[k] + Math.cos(t - Math.PI / 10) * r, Y[k], Z[k] + Math.sin(t - Math.PI / 10) * r, X[k] + Math.cos(t) * r, Y[k], Z[k] + Math.sin(t) * r); } }
      }
    }
    if (!ind.length) { this.ribbon.visible = false; this.ribbonEdge.visible = false; return; }
    this.ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.ribbonGeo.setIndex(ind);
    this.ribbon.material.color.setHex(ok ? (elev === 2 ? 0xc0a0ff : 0x7fd0ff) : 0xff6050);
    this.ribbonEdge.geometry.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
    this.ribbon.visible = true; this.ribbonEdge.visible = true;
  }

  showBuildingGhost(s, fp, height, ok, f, radiusCells) {
    let y = -1e9; for (let z = fp.z; z <= fp.z + fp.sz; z++) for (let x = fp.x; x <= fp.x + fp.sx; x++) { const h = cellHeight(s, Math.min(N - 1, Math.max(0, x)), Math.min(N - 1, Math.max(0, z))); if (h > y) y = h; }
    y = Math.max(y, 0.3);
    const cx = (fp.x + fp.sx / 2) * CS - HALF, cz = (fp.z + fp.sz / 2) * CS - HALF;
    this.bGhost.material = ok ? this.ghostMatOk : this.ghostMatBad;
    this.bGhost.scale.set(fp.sx * CS - 0.5, height, fp.sz * CS - 0.5);
    this.bGhost.position.set(cx, y, cz); this.bGhost.visible = true;
    const ang = facingAngle(f);
    const ext = (f % 2 === 0 ? fp.sx : fp.sz) * CS / 2 + 5;
    this.arrow.position.set(cx + Math.sin(ang) * ext, y + 1, cz + Math.cos(ang) * ext);
    this.arrow.rotation.y = ang; this.arrow.visible = true;
    if (radiusCells) { this.radius.scale.set(radiusCells * CS, 1, radiusCells * CS); this.radius.position.set(cx, y + 0.5, cz); this.radius.visible = true; } else this.radius.visible = false;
  }
  hideBuildingGhost() { this.bGhost.visible = false; this.arrow.visible = false; this.radius.visible = false; }
  showBrush(s, x, z, r) { const wx = (x + 0.5) * CS - HALF, wz = (z + 0.5) * CS - HALF; this.brush.scale.set(r * CS, 1, r * CS); this.brush.position.set(wx, heightAt(s, wx, wz) + 0.5, wz); this.brush.visible = true; }
  hideBrush() { this.brush.visible = false; }
}

export function problemIcon(s, b) {
  if (b.fire) return '🔥';
  if (b.collapsed) return '💥';
  if (b.abandoned) return '🏚️';
  if (b.built < 1) return null;
  if (!b.connected) return '🚫';
  if (!b.power) return '⚡';
  if (!b.water) return '💧';
  if (!b.sewage) return '🚽';
  if ((b.dead || 0) > 1) return '⚰️';
  if (b.garbage > 60) return '🗑️';
  if ((b.sick || 0) > 0.15) return '🤒';
  if ((b.crime || 0) > 70) return '🚨';
  if (b.kind === 'zone' && b.staffing !== undefined && b.staffing < 0.3 && b.emp !== undefined && s.time.monthsElapsed - b.born > 2 && b.type >= 7) return '👷';
  if (b.probIcon) return b.probIcon;
  return null;
}
