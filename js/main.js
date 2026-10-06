// Giriş noktası: oyun döngüsü, kaydet/yükle, ses
import { N, idx, tileOf } from './core/constants.js';
import { createState, serialize, deserialize } from './core/state.js';
import { initRuntime, tick, speedTicksPerSecond } from './sim/simulation.js';
import { buildNetwork } from './sim/actions.js';
import * as Actions from './sim/actions.js';
import { MILESTONES, DEV_TREE } from './data/progression.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { Tools } from './ui/tools.js';
import { fmtMoney } from './core/constants.js';

const SAVE_PREFIX = 'sk2_save_';

class Game {
  constructor() {
    this.state = null; this.speed = 1; this.prevSpeed = 1; this.paused = false; this.soundOn = true; this.acc = 0;
    this.renderer = new Renderer(document.getElementById('c'), () => this.state);
    this.ui = new UI(this);
    this.tools = new Tools(this);
    this.last = performance.now();
    this.fpsT = 0; this.frames = 0;
  }

  newGame(seed, name, opts = {}) {
    const s = createState(seed || ((Math.random() * 1e6) | 0), name);
    if (opts.money) s.money = opts.money;
    if (opts.unlockAll) { s.milestone = MILESTONES.length - 1; s.xp = MILESTONES[s.milestone].xp; s.devPoints = 0; for (const c in DEV_TREE) for (const n of DEV_TREE[c]) s.devNodes[n.id] = true; s.owned.fill(1); }
    this.setState(s);
    this.ui.toast(`${s.cityName} kuruldu! İlk yolları otoyol bağlantısından çekin.`, 'good');
  }

  setState(s) {
    this.state = s;
    initRuntime(s);
    this.renderer.resetForState(s);
    this.tools.set({ type: 'select' });
    this.ui.selectCategory(null);
    this.ui.inspect(null);
    this.ui.closePanel();
    this.ui.refreshToolbar();
    this.renderer.cam.edgeScroll = s.settings.edgeScroll;
  }

  setSpeed(v) { this.speed = v; if (v > 0) this.prevSpeed = v; }
  togglePause() { if (this.speed === 0) this.setSpeed(this.prevSpeed || 1); else this.setSpeed(0); }
  modalPause(on) { if (on) { if (this.modalPrev === undefined) this.modalPrev = this.speed; this.speed = 0; } else if (this.modalPrev !== undefined) { this.speed = this.modalPrev; this.modalPrev = undefined; } }

  loop() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (this.state) {
      const tps = speedTicksPerSecond(this.speed);
      this.acc += dt * tps;
      let n = 0; const t0 = performance.now();
      while (this.acc >= 1 && n < 12) { tick(this.state); this.acc -= 1; n++; if (performance.now() - t0 > 22) { this.acc = Math.min(this.acc, 2); break; } }
      if (this.acc > 4) this.acc = 4;
      const vis = [0, 1, 1.7, 2.6][this.speed];
      this.renderer.frame(dt, vis, { buyable: this.tools.tool.type === 'tiles' ? this.buyableTiles() : null, showLines: this.tools.tool.type === 'line' });
      this.ui.update(dt);
    }
    requestAnimationFrame(() => this.loop());
  }

  buyableTiles() {
    const s = this.state; const set = new Set(); const T = 10;
    for (let t = 0; t < T * T; t++) { if (s.owned[t]) continue; const tx = t % T, tz = (t / T) | 0; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const nx = tx + dx, nz = tz + dz; return nx >= 0 && nz >= 0 && nx < T && nz < T && s.owned[nz * T + nx]; })) set.add(t); }
    return set;
  }

  pipeAllRoads() {
    const s = this.state; const cells = [];
    for (let i = 0; i < N * N; i++) { const x = i % N, z = (i / N) | 0; if (s.road[i] && s.road[i] !== 6 && s.owned[tileOf(x, z)]) cells.push([x, z]); }
    const a = buildNetwork(s, 'pipeW', cells), b = buildNetwork(s, 'pipeS', cells);
    if (!a.ok || !b.ok) this.ui.toast(a.msg || b.msg || 'Yapılamadı', 'bad');
    else this.ui.toast(`Borular döşendi (${fmtMoney((a.cost || 0) + (b.cost || 0))})`, 'good');
    void idx;
  }

  // ---------- kayıt ----------
  listSaves() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!k.startsWith(SAVE_PREFIX + 'meta_')) continue;
      try { const m = JSON.parse(localStorage.getItem(k)); out.push({ ...m, key: k.slice((SAVE_PREFIX + 'meta_').length) }); } catch { /* yoksay */ }
    }
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  save(name, key) {
    const s = this.state; key = key || 'k' + Date.now();
    try {
      const data = serialize(s);
      localStorage.setItem(SAVE_PREFIX + key, data);
      localStorage.setItem(SAVE_PREFIX + 'meta_' + key, JSON.stringify({ name: name || s.cityName, date: new Date().toLocaleString('tr-TR'), pop: s.stats.pop || 0, ts: Date.now() }));
      return true;
    } catch (e) { this.ui.toast('Kaydedilemedi: ' + e.message, 'bad'); return false; }
  }
  load(key) {
    try { const d = localStorage.getItem(SAVE_PREFIX + key); if (!d) return false; this.setState(deserialize(d)); this.ui.toast('Yüklendi', 'good'); return true; }
    catch (e) { console.error(e); this.ui.toast('Yüklenemedi: ' + e.message, 'bad'); return false; }
  }
  deleteSave(key) { localStorage.removeItem(SAVE_PREFIX + key); localStorage.removeItem(SAVE_PREFIX + 'meta_' + key); }
  quickSave() { if (this.save(this.state.cityName + ' (hızlı)', 'quick')) this.ui.toast('Hızlı kayıt alındı (F9 ile yükle)', 'good'); }
  quickLoad() { if (!this.load('quick')) this.ui.toast('Hızlı kayıt yok', 'bad'); }
  exportFile() {
    const blob = new Blob([serialize(this.state)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${this.state.cityName.replace(/\s+/g, '_')}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  importFile() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then((t) => { try { this.setState(deserialize(t)); this.ui.closeModal(); this.ui.toast('Şehir yüklendi', 'good'); } catch (e) { this.ui.toast('Geçersiz dosya: ' + e.message, 'bad'); } }); };
    inp.click();
  }

  // ---------- ses (WebAudio ile basit efektler) ----------
  sound(kind) {
    if (!this.soundOn) return;
    try {
      this.ac = this.ac || new (window.AudioContext || window.webkitAudioContext)();
      const ac = this.ac, o = ac.createOscillator(), g = ac.createGain();
      const t = ac.currentTime;
      const cfg = { build: [520, 0.06, 'triangle'], bulldoze: [140, 0.15, 'sawtooth'], milestone: [660, 0.5, 'sine'] }[kind] || [440, 0.05, 'sine'];
      o.type = cfg[2]; o.frequency.setValueAtTime(cfg[0], t);
      if (kind === 'milestone') { o.frequency.setValueAtTime(523, t); o.frequency.setValueAtTime(659, t + 0.12); o.frequency.setValueAtTime(784, t + 0.24); }
      if (kind === 'bulldoze') o.frequency.exponentialRampToValueAtTime(60, t + cfg[1]);
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + cfg[1] + 0.05);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + cfg[1] + 0.06);
    } catch { /* ses yok */ }
  }
}

const game = new Game();
window.game = game;
window.SK = { A: Actions, tick };
// son hızlı kayıt varsa sor, yoksa yeni oyun
game.newGame((Math.random() * 99999) | 0);
document.getElementById('loading').remove();
game.loop();
