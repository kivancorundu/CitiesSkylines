// Dokunmatik kontroller: tek parmak kaydır/araç, iki parmak kaydır + sıkıştır (yakınlaştır) + çevir (döndür)
import { options } from '../core/options.js';
import { clamp } from '../core/constants.js';

const DRAG_TOOLS = new Set(['road', 'net', 'upgrade', 'bulldoze', 'terrain', 'trees', 'district']);

export class TouchControls {
  constructor(game) {
    this.g = game; this.pts = new Map(); this.mode = null; this.pendingPlace = null;
    const cv = game.renderer.renderer.domElement;
    cv.addEventListener('touchstart', (e) => this.start(e), { passive: false });
    cv.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    cv.addEventListener('touchend', (e) => this.end(e), { passive: false });
    cv.addEventListener('touchcancel', (e) => this.end(e), { passive: false });
    this.bindCamButtons();
  }
  get T() { return this.g.tools; }
  get cam() { return this.g.renderer.cam; }
  fake(t) { return { clientX: t.clientX, clientY: t.clientY, shiftKey: false }; }

  isDragTool() {
    const t = this.T.tool;
    if (DRAG_TOOLS.has(t.type)) return true;
    if (t.type === 'zone') return this.T.o.zone.mode !== 'fill';
    return false;
  }

  start(e) {
    e.preventDefault();
    if (this.g.inMenu) return;
    this.g.touchMode = true; document.body.classList.add('touch');
    for (const t of e.changedTouches) this.pts.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now() });
    if (this.pts.size === 1) {
      const t = e.changedTouches[0];
      this.mode = this.isDragTool() ? 'tool' : 'pan';
      if (this.mode === 'tool') { this.T.onMove(this.fake(t)); this.T.onDown(this.fake(t)); }
    } else if (this.pts.size === 2) {
      // tek parmakla başlayan araç işlemini iptal et, iki parmak hareketine geç
      if (this.mode === 'tool') { this.T.mouseDown = false; this.T.cancel(); }
      this.mode = 'gesture'; this.gest = this.gesture();
    }
  }

  gesture() {
    const [a, b] = [...this.pts.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y), ang: Math.atan2(b.y - a.y, b.x - a.x), dy: (a.y + b.y) / 2 };
  }

  move(e) {
    e.preventDefault();
    if (this.g.inMenu) return;
    for (const t of e.changedTouches) { const p = this.pts.get(t.identifier); if (p) { p.px = p.x; p.py = p.y; p.x = t.clientX; p.y = t.clientY; } }
    const o = options().touch;
    if (this.mode === 'tool' && this.pts.size === 1) { const t = e.changedTouches[0]; this.T.onMove(this.fake(t)); }
    else if (this.mode === 'pan' && this.pts.size === 1) {
      const p = [...this.pts.values()][0];
      const dx = p.x - (p.px ?? p.x), dy = p.y - (p.py ?? p.y);
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) { this.cam.panScreen(-dx * 1.2 * o.panSens, -dy * 1.2 * o.panSens); this.moved = true; }
    } else if (this.mode === 'gesture' && this.pts.size >= 2) {
      const g = this.gesture(), p = this.gest;
      this.cam.panScreen(-(g.cx - p.cx) * 1.2 * o.panSens, -(g.cy - p.cy) * 1.2 * o.panSens);
      if (p.d > 10 && g.d > 10) this.cam.tDist = clamp(this.cam.tDist * Math.pow(p.d / g.d, o.pinchSens), 25, 1900);
      if (o.twist) { let da = g.ang - p.ang; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; this.cam.tYaw -= da; }
      this.gest = g;
    }
  }

  end(e) {
    e.preventDefault();
    if (this.g.inMenu) { this.pts.clear(); return; }
    const t = e.changedTouches[0];
    const p = this.pts.get(t.identifier);
    for (const tt of e.changedTouches) this.pts.delete(tt.identifier);
    if (this.mode === 'tool') { this.T.onMove(this.fake(t)); this.T.onUp(this.fake(t)); }
    else if (this.mode === 'pan' && p) {
      const isTap = Math.hypot(p.x - p.sx, p.y - p.sy) < 12 && performance.now() - p.t0 < 450;
      if (isTap) this.tap(t);
    }
    if (this.pts.size === 0) { this.mode = null; this.moved = false; }
    else if (this.pts.size === 1 && this.mode === 'gesture') { this.mode = 'none'; }
  }

  tap(t) {
    const T = this.T; const f = this.fake(t);
    T.onMove(f);
    const h = T.hover;
    if (T.tool.type === 'svc' && options().touch.confirmPlace && h) {
      // ilk dokunuş önizler, aynı yere ikinci dokunuş yerleştirir
      if (!this.pendingPlace || this.pendingPlace[0] !== h.x || this.pendingPlace[1] !== h.z) { this.pendingPlace = [h.x, h.z]; this.g.ui.toast('Yerleştirmek için tekrar dokunun'); return; }
      this.pendingPlace = null;
    }
    T.onDown(f); T.onUp(f);
  }

  bindCamButtons() {
    const box = document.getElementById('cam-btns'); if (!box) return;
    box.querySelectorAll('[data-cam]').forEach((b) => {
      const code = () => ({ rotL: 'KeyQ', rotR: 'KeyE', up: 'KeyR', down: 'KeyF', zin: 'Equal', zout: 'Minus' })[b.dataset.cam];
      const map = () => { const K = options().keys; return { rotL: K.rotLeft, rotR: K.rotRight, up: K.tiltUp, down: K.tiltDown, zin: K.zoomIn, zout: K.zoomOut }[b.dataset.cam] || code(); };
      const on = (e) => { e.preventDefault(); this.cam.keys.add(map()); };
      const off = (e) => { e.preventDefault(); this.cam.keys.delete(map()); };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
    const back = document.getElementById('cam-back'); if (back) back.addEventListener('click', () => this.T.back());
  }
}
