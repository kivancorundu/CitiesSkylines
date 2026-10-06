// CS2 tarzı serbest 3D kamera: WASD kaydırma, Q/E döndürme, R/F eğim, tekerlek yakınlaştırma, sağ tık sürükle döndür/eğ,
// orta tık sürükle kaydır, V ile görünüm ön ayarları (kuşbakışı → klasik → alçak açı → sokak görünümü)
import * as THREE from '../vendor/three.module.min.js';
import { toLayout, layoutW, layoutH } from '../core/screen.js';
import { HALF, clamp, heightAt } from '../core/constants.js';

export const PITCH_MIN = 0.04, PITCH_MAX = 1.52, DIST_MIN = 9, DIST_MAX = 1900;
export const VIEW_PRESETS = [
  { name: 'Klasik', pitch: 0.82, dist: 380 },
  { name: 'Alçak açı', pitch: 0.38, dist: 150 },
  { name: 'Sokak görünümü', pitch: 0.07, dist: 26 },
  { name: 'Kuşbakışı', pitch: 1.5, dist: 700 },
];

export class CameraController {
  constructor(camera, dom, getState) {
    this.camera = camera; this.dom = dom; this.getState = getState;
    this.target = new THREE.Vector3(0, 0, 0);
    this.yaw = -0.6; this.pitch = 0.62; this.dist = 360; this.viewIdx = 0;
    this.tYaw = this.yaw; this.tPitch = this.pitch; this.tDist = this.dist; this.tTarget = this.target.clone();
    this.keys = new Set();
    this.drag = null;
    this.edgeScroll = false;
    this.mouse = { x: 0, y: 0, inside: false };
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.button === 1) { const [x, y] = toLayout(e.clientX, e.clientY); this.drag = { b: e.button, x, y, moved: 0 }; }
    });
    window.addEventListener('mousemove', (e) => {
      const [mx, my] = toLayout(e.clientX, e.clientY);
      this.mouse.x = mx; this.mouse.y = my;
      if (!this.drag) return;
      const dx = mx - this.drag.x, dy = my - this.drag.y;
      this.drag.x = mx; this.drag.y = my; this.drag.moved += Math.abs(dx) + Math.abs(dy);
      const mo = this.mouseOpts || {};
      if (this.drag.b === 2) { this.tYaw -= dx * 0.005 * (mo.rotSens || 1) * (mo.invertX ? -1 : 1); this.tPitch = clamp(this.tPitch + dy * 0.004 * (mo.rotSens || 1) * (mo.invertY ? -1 : 1), PITCH_MIN, PITCH_MAX); }
      else this.panScreen(-dx * (mo.panSens || 1), -dy * (mo.panSens || 1));
    });
    window.addEventListener('mouseup', (e) => { if (this.drag && (e.button === this.drag.b)) { this.lastDragMoved = this.drag.moved; this.drag = null; } });
    dom.addEventListener('wheel', (e) => { e.preventDefault(); this.tDist = clamp(this.tDist * Math.pow(1.0015, e.deltaY * ((this.mouseOpts || {}).zoomSens || 1)), DIST_MIN, DIST_MAX); }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      this.keys.add(e.code);
      if (e.code === ((this.keys2 || {}).camView || 'KeyV') && !e.repeat && !e.ctrlKey && !e.metaKey) this.cycleView();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mouseenter', () => (this.mouse.inside = true));
    dom.addEventListener('mouseleave', () => (this.mouse.inside = false));
  }

  panScreen(dx, dy) {
    const k = Math.max(this.dist, 30) * 0.0018;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.tTarget.x += (dx * c + dy * s) * k;
    this.tTarget.z += (-dx * s + dy * c) * k;
  }

  // görünüm ön ayarları arasında geçiş; yakın görünümlerde mesafe ile eğim birlikte değişir
  cycleView(dir = 1) {
    this.viewIdx = (this.viewIdx + dir + VIEW_PRESETS.length) % VIEW_PRESETS.length;
    const v = VIEW_PRESETS[this.viewIdx];
    this.tPitch = v.pitch; this.tDist = v.dist;
    if (this.onView) this.onView(v);
    return v;
  }

  tilt(d) { this.tPitch = clamp(this.tPitch + d, PITCH_MIN, PITCH_MAX); }

  focus(x, z, dist) { this.tTarget.set(x, 0, z); if (dist) this.tDist = dist; }

  update(dt) {
    const k = this.keys; let px = 0, pz = 0;
    const K = this.keys2 || {};
    const on = (name, alt) => k.has(K[name] || alt);
    if (on('panUp', 'KeyW') || k.has('ArrowUp')) pz -= 1;
    if (on('panDown', 'KeyS') || k.has('ArrowDown')) pz += 1;
    if (on('panLeft', 'KeyA') || k.has('ArrowLeft')) px -= 1;
    if (on('panRight', 'KeyD') || k.has('ArrowRight')) px += 1;
    if (this.edgeScroll && this.mouse.inside && !this.drag) {
      const m = 12, W = layoutW(), H = layoutH();
      if (this.mouse.x < m) px -= 1; if (this.mouse.x > W - m) px += 1;
      if (this.mouse.y < m) pz -= 1; if (this.mouse.y > H - m) pz += 1;
    }
    const fast = (k.has('ShiftLeft') || k.has('ShiftRight') ? 2.5 : 1) * (this.speed || 1);
    if (px || pz) this.panScreen(px * 900 * dt * fast * (this.dist < 60 ? 0.6 : 1), pz * 900 * dt * fast * (this.dist < 60 ? 0.6 : 1));
    if (on('rotLeft', 'KeyQ')) this.tYaw += dt * 1.6;
    if (on('rotRight', 'KeyE')) this.tYaw -= dt * 1.6;
    if (on('tiltUp', 'KeyR')) this.tPitch = clamp(this.tPitch + dt * 0.9, PITCH_MIN, PITCH_MAX);
    if (on('tiltDown', 'KeyF')) this.tPitch = clamp(this.tPitch - dt * 0.9, PITCH_MIN, PITCH_MAX);
    if (k.has('PageUp') || on('zoomIn', 'Equal') || k.has('NumpadAdd')) this.tDist = clamp(this.tDist * (1 - dt * 1.5), DIST_MIN, DIST_MAX);
    if (k.has('PageDown') || on('zoomOut', 'Minus') || k.has('NumpadSubtract')) this.tDist = clamp(this.tDist * (1 + dt * 1.5), DIST_MIN, DIST_MAX);
    const lim = HALF + 100;
    this.tTarget.x = clamp(this.tTarget.x, -lim, lim); this.tTarget.z = clamp(this.tTarget.z, -lim, lim);
    const a = 1 - Math.exp(-dt * 10);
    this.yaw += (this.tYaw - this.yaw) * a; this.pitch += (this.tPitch - this.pitch) * a; this.dist += (this.tDist - this.dist) * a;
    this.target.x += (this.tTarget.x - this.target.x) * a; this.target.z += (this.tTarget.z - this.target.z) * a;
    const s = this.getState();
    const gy = s ? Math.max(0, heightAt(s, this.target.x, this.target.z)) : 0;
    this.target.y += (gy - this.target.y) * a;
    const cp = Math.cos(this.pitch);
    const pos = new THREE.Vector3(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z + Math.cos(this.yaw) * cp * this.dist,
    );
    // araziye girmesin (yakın görünümde göz yüksekliği ~1.7 m)
    if (s) { const th = Math.max(heightAt(s, pos.x, pos.z), -0.4) + (this.dist < 60 ? 1.8 : 6); if (pos.y < th) pos.y = th; }
    this.camera.position.copy(pos);
    // alçak eğimde ufka doğru bak (sokak görünümü), yüksek eğimde hedefe
    const lift = Math.max(0, 0.45 - this.pitch) / 0.45;
    this._look = this._look || new THREE.Vector3();
    this._look.copy(this.target); this._look.y += lift * lift * this.dist * 0.35;
    this.camera.lookAt(this._look);
  }
}
