// CS2 tarzı kamera: WASD kaydırma, Q/E döndürme, R/F eğim, tekerlek yakınlaştırma, sağ tık sürükle döndür, orta tık sürükle kaydır
import * as THREE from '../vendor/three.module.min.js';
import { HALF, clamp, heightAt } from '../core/constants.js';

export class CameraController {
  constructor(camera, dom, getState) {
    this.camera = camera; this.dom = dom; this.getState = getState;
    this.target = new THREE.Vector3(0, 0, 0);
    this.yaw = -0.6; this.pitch = 0.85; this.dist = 420;
    this.tYaw = this.yaw; this.tPitch = this.pitch; this.tDist = this.dist; this.tTarget = this.target.clone();
    this.keys = new Set();
    this.drag = null;
    this.edgeScroll = false;
    this.mouse = { x: 0, y: 0, inside: false };
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.button === 1) { this.drag = { b: e.button, x: e.clientX, y: e.clientY, moved: 0 }; }
    });
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY; this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.b === 2) { this.tYaw -= dx * 0.005; this.tPitch = clamp(this.tPitch + dy * 0.004, 0.12, 1.5); }
      else this.panScreen(-dx, -dy);
    });
    window.addEventListener('mouseup', (e) => { if (this.drag && (e.button === this.drag.b)) { this.lastDragMoved = this.drag.moved; this.drag = null; } });
    dom.addEventListener('wheel', (e) => { e.preventDefault(); this.tDist = clamp(this.tDist * Math.pow(1.0015, e.deltaY), 25, 1900); }, { passive: false });
    window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; this.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('mouseenter', () => (this.mouse.inside = true));
    dom.addEventListener('mouseleave', () => (this.mouse.inside = false));
  }

  panScreen(dx, dy) {
    const k = this.dist * 0.0018;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.tTarget.x += (dx * c + dy * s) * k;
    this.tTarget.z += (-dx * s + dy * c) * k;
  }

  focus(x, z, dist) { this.tTarget.set(x, 0, z); if (dist) this.tDist = dist; }

  update(dt) {
    const k = this.keys; let px = 0, pz = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) pz -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) pz += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) px -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) px += 1;
    if (this.edgeScroll && this.mouse.inside && !this.drag) {
      const m = 12, W = window.innerWidth, H = window.innerHeight;
      if (this.mouse.x < m) px -= 1; if (this.mouse.x > W - m) px += 1;
      if (this.mouse.y < m) pz -= 1; if (this.mouse.y > H - m) pz += 1;
    }
    const fast = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.5 : 1;
    if (px || pz) this.panScreen(px * 900 * dt * fast, pz * 900 * dt * fast);
    if (k.has('KeyQ')) this.tYaw += dt * 1.6;
    if (k.has('KeyE')) this.tYaw -= dt * 1.6;
    if (k.has('KeyR')) this.tPitch = clamp(this.tPitch + dt * 0.9, 0.12, 1.5);
    if (k.has('KeyF')) this.tPitch = clamp(this.tPitch - dt * 0.9, 0.12, 1.5);
    if (k.has('PageUp') || k.has('Equal') || k.has('NumpadAdd')) this.tDist = clamp(this.tDist * (1 - dt * 1.5), 25, 1900);
    if (k.has('PageDown') || k.has('Minus') || k.has('NumpadSubtract')) this.tDist = clamp(this.tDist * (1 + dt * 1.5), 25, 1900);
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
    // araziye girmesin
    if (s) { const th = heightAt(s, pos.x, pos.z) + 6; if (pos.y < th) pos.y = th; }
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }
}
