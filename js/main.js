// Giriş noktası: oyun döngüsü, menüler, seçenekler, kaydet/yükle, ses
import { N, idx, tileOf, MONTHS, fmtMoney } from './core/constants.js';
import { createState, serialize, deserialize } from './core/state.js';
import { initRuntime, tick, speedTicksPerSecond } from './sim/simulation.js';
import { buildNetwork } from './sim/actions.js';
import * as Actions from './sim/actions.js';
import { MILESTONES, DEV_TREE } from './data/progression.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { Tools } from './ui/tools.js';
import { Menus } from './ui/menus.js';
import { TouchControls } from './ui/touch.js';
import { options, onOptions, IS_TOUCH } from './core/options.js';
import { buildDemoCity } from './core/demo.js';
import { setBuildingTheme } from './render/buildingParts.js';

const SAVE_PREFIX = 'sk2_save_';

class Game {
  constructor() {
    this.state = null; this.speed = 1; this.prevSpeed = 1; this.acc = 0; this.inMenu = false;
    this.touchMode = IS_TOUCH;
    document.body.classList.toggle('touch', this.touchMode);
    this.renderer = new Renderer(document.getElementById('c'), () => this.state, { antialias: options().graphics.antialias });
    this.ui = new UI(this);
    this.tools = new Tools(this);
    this.menus = new Menus(this);
    this.touch = new TouchControls(this);
    this.last = performance.now(); this.lastFrame = 0;
    this.autosaveT = 0;
    onOptions(() => this.applyOptions());
    this.applyOptions();
    window.addEventListener('blur', () => { if (options().general.pauseOnBlur && !this.inMenu && this.speed) { this.blurPaused = true; this.modalPause(true); } });
    window.addEventListener('focus', () => { if (this.blurPaused) { this.blurPaused = false; this.modalPause(false); } });
    // ilk kullanıcı etkileşiminde ortam sesini başlat
    const startAudio = () => { this.ensureAudio(); window.removeEventListener('pointerdown', startAudio); window.removeEventListener('keydown', startAudio); };
    window.addEventListener('pointerdown', startAudio); window.addEventListener('keydown', startAudio);
  }

  // ---------- seçenekleri uygula ----------
  applyOptions() {
    const o = options();
    this.renderer.applyGraphics(o.graphics);
    const cam = this.renderer.cam;
    cam.edgeScroll = o.gameplay.edgeScroll; cam.speed = o.gameplay.camSpeed; cam.keys2 = o.keys; cam.mouseOpts = o.mouse;
    document.documentElement.style.setProperty('--ui-scale', o.interface.uiScale);
    document.body.classList.toggle('no-tips', !o.interface.tooltips);
    document.body.classList.toggle('no-hints', !o.interface.hints);
    document.body.classList.toggle('cam-buttons', this.touchMode && o.touch.camButtons);
    if (this.state && !this.inMenu) this.syncStateSettings();
    const fs = !!o.graphics.fullscreen;
    if (window.electronAPI?.setFullscreen) window.electronAPI.setFullscreen(fs);
    else if (fs && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (!fs && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    if (this.ambGain) this.ambGain.gain.value = o.audio.mute ? 0 : o.audio.master * o.audio.ambient * 0.05;
  }
  syncStateSettings() {
    const o = options(), st = this.state.settings;
    st.disasters = o.gameplay.disasters; st.autoDemolish = o.gameplay.autoDemolish; st.dayNight = o.graphics.dayNight; st.advisor = o.general.tutorial && st.advisor !== false;
    st.shadows = o.graphics.shadows !== 'off'; st.icons = o.interface.icons; st.weatherFx = o.graphics.weatherFx;
  }

  // ---------- menü ve oyun akışı ----------
  enterMenuMode() {
    this.inMenu = true; document.body.classList.add('in-menu');
    if (!this.demoState) { this.demoState = buildDemoCity(); }
    if (this.state !== this.demoState) { this.setState(this.demoState, true); }
    this.speed = 1; this.modalPrev = undefined;
    const c = this.renderer.cam; c.tDist = 330; c.tPitch = 0.55;
  }
  toMainMenu() { this.tools.set({ type: 'select' }); this.ui.closePanel(); this.ui.inspect(null); this.menus.showMain(); }

  startNewGame(o) {
    const s = createState((Math.random() * 1e6) | 0, o.name, o.map, { theme: o.theme, leftHand: o.leftHand });
    if (o.unlimited) s.money = 9e12; s.unlimited = !!o.unlimited;
    if (o.unlockAll) { s.milestone = MILESTONES.length - 1; s.xp = MILESTONES[s.milestone].xp; s.devPoints = 0; for (const c in DEV_TREE) for (const n of DEV_TREE[c]) s.devNodes[n.id] = true; s.owned.fill(1); }
    s.settings.disasters = o.disasters;
    this.setState(s);
    this.ui.toast(`${s.cityName} kuruldu! İlk yolları otoyol bağlantısından çekin.`, 'good');
  }
  newGame(seed, name, opts = {}) { this.startNewGame({ name, map: 'valley', theme: 'eu', disasters: true, ...opts }); }

  setState(s, menu = false) {
    this.state = s;
    if (!s.rt) initRuntime(s);
    setBuildingTheme(s.theme);
    for (const id in s.buildings) s.buildings[id]._parts = null;
    this.renderer.resetForState(s);
    this.tools.set({ type: 'select' });
    this.ui.selectCategory(null);
    this.ui.inspect(null);
    this.ui.closePanel();
    this.ui.refreshToolbar();
    if (!menu) {
      this.inMenu = false; document.body.classList.remove('in-menu');
      this.speed = 1; this.modalPrev = undefined; this.autosaveT = 0;
      this.syncStateSettings();
      if (s.settings.disasters === undefined) s.settings.disasters = true;
    }
  }

  setSpeed(v) { this.speed = v; if (v > 0) this.prevSpeed = v; }
  togglePause() { if (this.speed === 0) this.setSpeed(this.prevSpeed || 1); else this.setSpeed(0); }
  modalPause(on) { if (on) { if (this.modalPrev === undefined) this.modalPrev = this.speed; this.speed = 0; } else if (this.modalPrev !== undefined) { this.speed = this.modalPrev; this.modalPrev = undefined; } }

  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const cap = options().graphics.maxFps;
    if (cap && now - this.lastFrame < 1000 / cap - 2) return;
    this.lastFrame = now;
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (!this.state) return;
    const tps = speedTicksPerSecond(this.speed);
    this.acc += dt * tps;
    let n = 0; const t0 = performance.now();
    while (this.acc >= 1 && n < 12) { tick(this.state); this.acc -= 1; n++; if (performance.now() - t0 > 22) { this.acc = Math.min(this.acc, 2); break; } }
    if (this.acc > 4) this.acc = 4;
    if (this.state.unlimited && this.state.money < 1e12) this.state.money = 9e12;
    if (this.inMenu) this.renderer.cam.tYaw += dt * 0.04;
    const vis = [0, 1, 1.7, 2.6][this.speed];
    this.renderer.frame(dt, vis, { buyable: this.tools.tool.type === 'tiles' ? this.buyableTiles() : null, showLines: this.tools.tool.type === 'line' });
    if (!this.inMenu) {
      this.ui.update(dt);
      const o = options().general;
      if (o.autosave && this.speed > 0) { this.autosaveT += dt; if (this.autosaveT > o.autosaveMin * 60) { this.autosaveT = 0; if (this.save('Otomatik Kayıt — ' + this.state.cityName, 'auto', true)) this.ui.toast('💾 Otomatik kaydedildi'); } }
    }
    this.updateAmbient();
  }

  buyableTiles() {
    const s = this.state; const set = new Set(); const T = 10;
    for (let t = 0; t < T * T; t++) { if (s.owned[t]) continue; const tx = t % T, tz = (t / T) | 0; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const nx = tx + dx, nz = tz + dz; return nx >= 0 && nz >= 0 && nx < T && nz < T && s.owned[nz * T + nx]; })) set.add(t); }
    return set;
  }

  pipeAllRoads() {
    const s = this.state; const cells = [];
    for (let i = 0; i < N * N; i++) { const x = i % N, z = (i / N) | 0; if (s.road[i] && s.road[i] !== 6 && !s.rElev[i] && s.owned[tileOf(x, z)]) cells.push([x, z]); }
    const a = buildNetwork(s, 'pipeW', cells), b = buildNetwork(s, 'pipeS', cells);
    if (!a.ok || !b.ok) this.ui.toast(a.msg || b.msg || 'Yapılamadı', 'bad');
    else this.ui.toast(`Borular döşendi (${fmtMoney((a.cost || 0) + (b.cost || 0))})`, 'good');
    void idx;
  }

  // ---------- kayıt ----------
  listSaves() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i); if (!k.startsWith(SAVE_PREFIX + 'meta_')) continue;
        try { const m = JSON.parse(localStorage.getItem(k)); out.push({ ...m, key: k.slice((SAVE_PREFIX + 'meta_').length) }); } catch { /* yoksay */ }
      }
    } catch { /* depo kapalı */ }
    return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }
  thumbnail() {
    try {
      const r = this.renderer; r.renderer.render(r.scene, r.camera);
      const src = r.renderer.domElement; const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const g = c.getContext('2d'); const ar = src.width / src.height; let sw = src.width, sh = src.height;
      if (ar > 16 / 9) sw = sh * 16 / 9; else sh = sw * 9 / 16;
      g.drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, 320, 180);
      return c.toDataURL('image/jpeg', 0.7);
    } catch { return null; }
  }
  save(name, key, quiet) {
    const s = this.state; key = key || 'k' + Date.now();
    if (this.inMenu) return false;
    try {
      const data = serialize(s);
      localStorage.setItem(SAVE_PREFIX + key, data);
      const meta = { name: name || s.cityName, date: new Date().toLocaleString('tr-TR'), pop: s.stats.pop || 0, ts: Date.now(), money: Math.round(s.money), map: s.map, ms: s.milestone, gdate: `${MONTHS[s.time.month]} ${s.time.year}`, thumb: this.thumbnail() };
      try { localStorage.setItem(SAVE_PREFIX + 'meta_' + key, JSON.stringify(meta)); } catch { delete meta.thumb; localStorage.setItem(SAVE_PREFIX + 'meta_' + key, JSON.stringify(meta)); }
      return true;
    } catch (e) { if (!quiet) this.ui.toast('Kaydedilemedi: depolama alanı dolu olabilir (' + e.message + ')', 'bad'); return false; }
  }
  load(key) {
    try { const d = localStorage.getItem(SAVE_PREFIX + key); if (!d) return false; this.setState(deserialize(d)); this.ui.toast('Yüklendi', 'good'); return true; }
    catch (e) { console.error(e); this.ui.toast('Yüklenemedi: ' + e.message, 'bad'); return false; }
  }
  deleteSave(key) { localStorage.removeItem(SAVE_PREFIX + key); localStorage.removeItem(SAVE_PREFIX + 'meta_' + key); }
  quickSave() { if (this.save(this.state.cityName + ' (hızlı)', 'quick')) this.ui.toast('Hızlı kayıt alındı', 'good'); }
  quickLoad() { if (!this.load('quick')) this.ui.toast('Hızlı kayıt yok', 'bad'); }
  exportFile() {
    const blob = new Blob([serialize(this.state)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${this.state.cityName.replace(/\s+/g, '_')}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  importFile() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then((t) => { try { this.menus.hide(); this.setState(deserialize(t)); this.ui.toast('Şehir yüklendi', 'good'); } catch (e) { this.ui.toast('Geçersiz dosya: ' + e.message, 'bad'); } }); };
    inp.click();
  }

  // ---------- ses ----------
  ensureAudio() {
    try {
      if (!this.ac) this.ac = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ac.state === 'suspended') this.ac.resume();
      if (!this.ambGain) {
        // şehir uğultusu: filtrelenmiş kahverengi gürültü
        const ac = this.ac, len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
        let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
        this.ambFilter = ac.createBiquadFilter(); this.ambFilter.type = 'lowpass'; this.ambFilter.frequency.value = 600;
        this.ambGain = ac.createGain(); this.ambGain.gain.value = 0;
        src.connect(this.ambFilter); this.ambFilter.connect(this.ambGain); this.ambGain.connect(ac.destination); src.start();
      }
    } catch { /* ses yok */ }
  }
  updateAmbient() {
    if (!this.ambGain || !this.state) return;
    const o = options().audio; const s = this.state;
    const city = Math.min(1, (s.stats.pop || 0) / 20000) * 0.6 + 0.2;
    const near = Math.max(0.15, 1 - this.renderer.cam.dist / 1500);
    const rain = s.weather.rain * 0.8;
    const v = o.mute ? 0 : o.master * o.ambient * 0.06 * (city * near + rain);
    this.ambGain.gain.value += (v - this.ambGain.gain.value) * 0.05;
    this.ambFilter.frequency.value = 400 + rain * 1600;
  }
  sound(kind) {
    const o = options().audio; if (o.mute || o.master * o.ui <= 0.01) return;
    try {
      this.ensureAudio();
      const ac = this.ac, osc = ac.createOscillator(), g = ac.createGain();
      const t = ac.currentTime;
      const cfg = { build: [520, 0.06, 'triangle'], bulldoze: [140, 0.15, 'sawtooth'], milestone: [660, 0.5, 'sine'], click: [880, 0.03, 'sine'] }[kind] || [440, 0.05, 'sine'];
      osc.type = cfg[2]; osc.frequency.setValueAtTime(cfg[0], t);
      if (kind === 'milestone') { osc.frequency.setValueAtTime(523, t); osc.frequency.setValueAtTime(659, t + 0.12); osc.frequency.setValueAtTime(784, t + 0.24); }
      if (kind === 'bulldoze') osc.frequency.exponentialRampToValueAtTime(60, t + cfg[1]);
      g.gain.setValueAtTime(0.08 * o.master * o.ui, t); g.gain.exponentialRampToValueAtTime(0.0001, t + cfg[1] + 0.05);
      osc.connect(g); g.connect(ac.destination); osc.start(t); osc.stop(t + cfg[1] + 0.06);
    } catch { /* ses yok */ }
  }
}

const game = new Game();
window.game = game;
window.SK = { A: Actions, tick };
setTimeout(() => {
  game.menus.showMain();
  document.getElementById('loading').remove();
  game.loop();
}, 30);
