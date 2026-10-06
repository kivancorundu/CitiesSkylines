// Araçlar (CS2 tarzı): seçim, yol (Düz/Kavisli/Sürekli/Izgara/Değiştir), şebeke, bölgeleme, bina, yıkım, karo, ilçe, arazi, ağaç, yol yükseltme, toplu taşıma hattı
import { N, TILE, TILES, DIRS, idx, inB, fmtMoney, CS } from '../core/constants.js';
import { ROADS, ROAD_UPGRADES, NETWORKS } from '../data/roads.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import * as A from '../sim/actions.js';
import { svcStats } from '../sim/buildings.js';
import { tileCost, allowedTiles, ownedTiles } from '../sim/progression.js';
import { newLine, computeLinePath, LINE_TYPES } from '../sim/transit.js';
import { zoneCellOk } from '../sim/growth.js';
import { chainsFor, snapAngle, snapLength } from '../sim/roadtool.js';
import { geomsFor, roadStretch, roadPath, samplesInCells } from '../sim/roadgeom.js';
import { WIDTH as ROAD_W } from '../render/smoothroads.js';
import { options } from '../core/options.js';
import { refreshRoads } from '../sim/simulation.js';

export const ROAD_MODES = [
  { key: 'straight', name: 'Düz', icon: '╱', tip: 'İki nokta arasında düz yol (her açıda).' },
  { key: 'curved', name: 'Kavisli', icon: '⌒', tip: 'Başlangıç, kontrol noktası ve bitiş ile kavisli yol.' },
  { key: 'continuous', name: 'Sürekli', icon: '⟋⟍', tip: 'Her bitiş noktası yeni bir başlangıç olur.' },
  { key: 'grid', name: 'Izgara', icon: '#', tip: 'Seçilen dikdörtgen alana yol ızgarası çizer.' },
  { key: 'replace', name: 'Değiştir', icon: '⇄', tip: 'Mevcut yolları seçilen yol türüyle değiştirir.' },
];
export const NET_MODES = ROAD_MODES.filter((m) => ['straight', 'curved', 'continuous'].includes(m.key));

export class Tools {
  constructor(game) {
    this.g = game; this.tool = { type: 'select' }; this.hover = null; this.pts = []; this.mouseDown = false; this.rot = null;
    this.downCell = null; this.lastApply = 0; this.dragRect = null;
    // kalıcı araç seçenekleri
    this.o = {
      road: { mode: 'straight', angle: 15, snapLen: false, snapExisting: true, elev: 0, parallel: false, parSp: 3, gridSp: 13 },
      net: { mode: 'straight' },
      zone: { mode: 'fill', size: 2 },
      bulldoze: { filter: 'all' },
      terrain: { size: 3, strength: 0.8 },
      trees: { size: 2, density: 0.7 },
      district: { size: 3 },
      svc: { autoFace: true },
      erase: false,
    };
    const cv = game.renderer.renderer.domElement;
    // sürükleme sırasında fare arayüzün üzerine gelse bile araç çalışmaya devam eder
    window.addEventListener('mousemove', (e) => {
      if (e.target === cv || this.mouseDown) this.onMove(e);
      else if (this.hover) { this.hover = null; this.refresh(); this.g.ui.cursor(0, 0, ''); }
    });
    cv.addEventListener('mousedown', (e) => { if (e.button === 0) this.onDown(e); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.onUp(e); if (e.button === 2) this.onRight(e); });
  }
  get s() { return this.g.state; }
  get fx() { return this.g.renderer.effects; }
  get brushR() { const t = this.tool.type; return t === 'zone' ? this.o.zone.size : t === 'terrain' ? this.o.terrain.size : t === 'trees' ? this.o.trees.size : t === 'district' ? this.o.district.size : 2; }
  set brushR(v) { const t = this.tool.type; if (this.o[t] && 'size' in this.o[t]) this.o[t].size = v; }
  get zoneMode() { return this.o.zone.mode; }
  set zoneMode(v) { this.o.zone.mode = v; }
  erasing() { return this.shift || this.o.erase; }
  isLineTool() { return ['road', 'net', 'upgrade'].includes(this.tool.type); }
  lineMode() { const t = this.tool.type; return t === 'road' ? this.o.road.mode : t === 'net' ? this.o.net.mode : (this.o.net.mode === 'curved' ? 'straight' : this.o.net.mode); }

  set(tool) {
    if (this.tool.type === 'line' && this.tool.lineId) this.finishLine();
    this.tool = tool; this.pts = []; this.rot = null; this.mouseDown = false; this.dragRect = null; this.o.erase = false;
    const r = this.g.renderer;
    r.toolFlags = { zoning: tool.type === 'zone', district: tool.type === 'district', tiles: tool.type === 'tiles', grid: tool.type === 'zone' };
    if (this.s) this.s.rt.dirty.overlay = true;
    this.fx.hideCells(); this.fx.hideBuildingGhost(); this.fx.hideBrush();
    this.g.ui.setHint(this.hintText());
    this.g.ui.renderToolPanels();
    this.refresh();
  }
  optionsChanged() { this.g.ui.renderToolPanels(); this.g.ui.setHint(this.hintText()); this.refresh(); }
  cancel() { if (this.pts.length || this.dragRect) { this.pts = []; this.dragRect = null; this.refresh(); this.g.ui.renderToolPanels(); return true; } return false; }

  hintText() {
    const t = this.tool; const touch = this.g.touchMode;
    const c = touch ? 'Dokun' : 'Tıkla';
    switch (t.type) {
      case 'road': case 'net': case 'upgrade': {
        const m = this.lineMode();
        if (m === 'curved') return `${c}: başlangıç → kontrol noktası → bitiş. ${touch ? '' : 'Sağ tık: iptal'}`;
        if (m === 'grid') return `${c}: ızgaranın iki köşesini seçin.`;
        if (m === 'replace') return `${c}: iki kavşak arasındaki yol parçasını değiştir · Sürükle: başlangıçtan bitişe kadar tüm güzergâhı değiştir.`;
        if (m === 'continuous') return `${c}: noktaları art arda seçin; her bitiş yeni başlangıçtır. ${touch ? 'Bitirmek için İptal' : 'Sağ tık: bitir'}`;
        return `${c}: başlangıç → bitiş (sürükleyebilirsiniz). ${t.type !== 'road' ? (touch ? 'Silgi modu: kaldır' : 'Shift: kaldır') : ''}`;
      }
      case 'zone': return t.zone ? `${{ fill: 'Doldur: bir bloğa ' + c.toLowerCase() + 'n', rect: 'Seçim: alanı sürükleyin', brush: 'Boya: sürükleyerek boyayın' }[this.o.zone.mode]}. ${touch ? 'Silgi modu: bölge kaldır' : 'Shift: bölge kaldır'}` : 'Bölge kaldırma';
      case 'svc': return touch ? 'Yerleştirmek için dokunun. Döndürmek için araç seçeneklerini kullanın.' : 'Binayı yerleştirin. Ön cephe yola bakmalı. , ve . tuşları: döndür. Sağ tık: iptal';
      case 'bulldoze': return 'Yıkım: dokunun/tıklayın veya alan seçin';
      case 'tiles': return `Harita karosu satın alın (${ownedTiles(this.s)}/${allowedTiles(this.s)} izinli). Maliyet: ${fmtMoney(tileCost(this.s))}`;
      case 'district': return 'İlçe boyayın.';
      case 'terrain': return 'Basılı tutarak araziyi düzenleyin.';
      case 'trees': return t.remove ? 'Ağaçları kaldırın' : 'Ağaç dikin (basılı tutun).';
      case 'line': return `${LINE_TYPES[t.lineType].name} hattı: durakları sırayla seçin; ilk durağı tekrar seçerek hattı kapatın.`;
      default: return '';
    }
  }

  // ---------- işaretçi olayları (fare ve dokunmatik ortak) ----------
  onMove(e) {
    this.mx = e.clientX; this.my = e.clientY; this.shift = !!e.shiftKey;
    const p = this.g.renderer.pick(e.clientX, e.clientY);
    const changed = !this.hover || !p || p.x !== this.hover.x || p.z !== this.hover.z;
    this.hover = p;
    if (this.mouseDown && p && ['district', 'terrain', 'trees'].includes(this.tool.type)) this.continuous();
    if (this.mouseDown && p && this.tool.type === 'zone' && this.o.zone.mode === 'brush') this.continuous();
    if (changed) this.refresh();
    if (!this.g.touchMode) this.g.ui.cursor(e.clientX, e.clientY, this.cursorText);
  }

  onDown(e) {
    if (!this.s) return;
    this.shift = !!e.shiftKey; this.mouseDown = true;
    const h = this.hover; if (!h) return;
    const t = this.tool;
    this.downCell = [h.x, h.z];
    if (this.isLineTool()) {
      if (!this.pts.length) this.pts = [this.snapPoint(h, true)];
      else this.addPoint(this.snapPoint(h));
      this.refresh(); this.g.ui.renderToolPanels();
      return;
    }
    switch (t.type) {
      case 'select': {
        const b = this.buildingAt(h);
        this.s.rt.selected = b ? b.id : null; this.g.ui.inspect(b);
        if (!b && this.s.road[idx(h.x, h.z)]) this.g.ui.inspectRoad(idx(h.x, h.z));
        break;
      }
      case 'zone':
        if (this.o.zone.mode === 'fill') { this.fillZone(h); this.mouseDown = false; }
        else if (this.o.zone.mode === 'brush') this.continuous();
        else this.dragRect = [h.x, h.z];
        break;
      case 'bulldoze': this.dragRect = [h.x, h.z]; break;
      case 'svc': {
        const f = this.facing(h); const r = A.placeService(this.s, t.key, h.x, h.z, f);
        if (!r.ok) this.g.ui.toast(r.msg, 'bad'); else { this.g.sound('build'); this.g.ui.toast(`${SERVICES[t.key].name} inşa edildi`, 'good'); this.g.ui.renderToolPanels(); }
        break;
      }
      case 'tiles': this.buyTile(h); break;
      case 'district': case 'terrain': case 'trees': this.continuous(true); break;
      case 'line': this.lineClick(h); break;
    }
    this.refresh();
  }

  onUp() {
    if (!this.mouseDown) return;
    this.mouseDown = false;
    const h = this.hover, t = this.tool;
    if (!this.s) return;
    // "Değiştir": sürüklemeden tıklama → tüm parça, sürükleme → güzergâh
    if (t.type === 'road' && this.lineMode() === 'replace' && this.pts.length === 1) {
      const dragged = h && this.downCell && (h.x !== this.downCell[0] || h.z !== this.downCell[1]);
      const cells = this.replaceCells(!!dragged);
      if (cells.length) this.commitChains([cells.map((c) => [c % N, (c / N) | 0])]);
      else this.g.ui.toast('Değiştirmek için bir yola tıklayın', 'bad');
      this.pts = []; this.downCell = null; this.refresh(); this.g.ui.renderToolPanels();
      return;
    }
    // sürükleme ile ikinci nokta
    if (this.isLineTool() && this.pts.length === 1 && h && this.downCell && (h.x !== this.downCell[0] || h.z !== this.downCell[1]) && (h.x !== this.pts[0][0] || h.z !== this.pts[0][1])) {
      this.addPoint(this.snapPoint(h));
    }
    if (t.type === 'zone' && this.o.zone.mode === 'rect' && this.dragRect && h) {
      const cells = A.rectCells(this.dragRect[0], this.dragRect[1], h.x, h.z);
      const r = A.paintZone(this.s, cells, this.erasing() ? 0 : t.zone); this.dragRect = null;
      if (!r.ok && r.msg) this.g.ui.toast(r.msg, 'bad');
    }
    if (t.type === 'bulldoze' && this.dragRect && h) { this.bulldozeRect(this.dragRect, [h.x, h.z]); this.dragRect = null; }
    this.downCell = null;
    this.refresh(); this.g.ui.renderToolPanels();
  }

  onRight() {
    const cam = this.g.renderer.cam;
    if ((cam.lastDragMoved || 0) > 6) return;
    this.back();
  }
  // geri/iptal: önce yarım işlem, sonra araç
  back() {
    if (this.cancel()) return;
    if (this.tool.type === 'line' && this.tool.lineId) { this.finishLine(); return; }
    if (this.tool.type !== 'select') { this.g.ui.selectCategory(null); this.set({ type: 'select' }); }
  }

  key(e) {
    const K = options().keys;
    if (e.code === K.rotBldLeft || e.code === K.rotBldRight) {
      if (this.tool.type === 'svc') { this.rotate(e.code === K.rotBldRight ? 1 : -1); return true; }
    }
    if (e.code === K.brushDown) { this.brushR = Math.max(1, this.brushR - 1); this.optionsChanged(); return true; }
    if (e.code === K.brushUp) { this.brushR = Math.min(10, this.brushR + 1); this.optionsChanged(); return true; }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { if (A.undoLast(this.s)) this.g.ui.toast('Geri alındı'); this.refresh(); this.g.ui.renderToolPanels(); return true; }
    if (e.code === 'Escape') {
      if (this.cancel()) return true;
      if (this.tool.type === 'line' && this.tool.lineId) { this.finishLine(); return true; }
      if (this.tool.type !== 'select') { this.g.ui.selectCategory(null); this.set({ type: 'select' }); return true; }
    }
    return false;
  }

  rotate(dir) { const cur = this.rot ?? this.facing(this.hover || { x: 0, z: 0 }); this.rot = (cur + (dir > 0 ? 1 : 3)) % 4; this.o.svc.autoFace = false; this.refresh(); this.g.ui.renderToolPanels(); }
  buildingAt(h) { const i = idx(h.x, h.z); return this.s.bld[i] >= 0 ? this.s.buildings[this.s.bld[i]] : null; }
  facing(h) { if (this.rot !== null && !this.o.svc.autoFace) return this.rot; return A.autoFacing(this.s, this.tool.key, h.x, h.z, this.rot ?? 1); }

  // ---------- çizgi araçları (yol / şebeke / yükseltme) ----------
  snapPoint(h, first) {
    let p = [h.x, h.z];
    const ro = this.o.road;
    if (this.tool.type === 'road' && ro.snapExisting && !this.s.road[idx(h.x, h.z)]) {
      // yakındaki yol hücresine yapış
      let best = null, bd = 9;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = h.x + dx, z = h.z + dz; if (inB(x, z) && this.s.road[idx(x, z)]) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [x, z]; } } }
      if (best && (first || bd <= 1)) p = best;
    }
    const last = this.pts[this.pts.length - 1];
    const mode = this.lineMode();
    if (!first && last && this.tool.type === 'road' && ['straight', 'continuous', 'replace'].includes(mode)) {
      if (ro.angle) p = snapAngle(last, p, ro.angle);
      if (ro.snapLen) p = snapLength(last, p, 4);
    }
    return [Math.max(0, Math.min(N - 1, p[0])), Math.max(0, Math.min(N - 1, p[1]))];
  }

  rawPts(withHover) {
    const pts = this.pts.slice();
    if (withHover && this.hover) pts.push(this.snapPoint(this.hover, !pts.length));
    return pts;
  }

  // pürüzsüz yol aracı mı (değiştirme modu hariç)
  smoothRoad() { return this.tool.type === 'road' && this.lineMode() !== 'replace'; }

  geoms(withHover = true) {
    const pts = this.rawPts(withHover); if (!pts.length) return [];
    const mode = this.lineMode(); const ro = this.o.road;
    let m = mode; if (mode === 'curved' && pts.length < 3) m = 'straight';
    if (m === 'continuous') m = 'straight';
    return geomsFor(m, pts, { gridSpacing: ro.gridSp, parallel: ro.parallel, parallelSpacing: ro.parSp });
  }

  // "Değiştir" modu: imlecin altındaki/yakınındaki yol hücresi
  roadCellNear(p) {
    if (!p) return -1; const s = this.s;
    let best = -1, bd = 9;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = p[0] + dx, z = p[1] + dz; if (inB(x, z) && s.road[idx(x, z)]) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = idx(x, z); } } }
    return best;
  }

  // değiştirilecek hücreler: tek nokta → kavşaktan kavşağa parça; iki nokta → yol ağı üzerindeki güzergâh
  replaceCells(withHover = true) {
    const s = this.s; const a = this.pts.length ? this.roadCellNear(this.pts[0]) : -1;
    const hv = withHover && this.hover ? this.roadCellNear([this.hover.x, this.hover.z]) : -1;
    if (a >= 0 && hv >= 0 && a !== hv) return roadPath(s, a, hv);
    const c = a >= 0 ? a : hv;
    return c >= 0 ? roadStretch(s, c) : [];
  }

  chains(withHover = true) {
    if (this.smoothRoad()) return A.prepareRoadGeoms(this.s, this.geoms(withHover)).chains;
    if (this.tool.type === 'road' && this.lineMode() === 'replace') { const cells = this.replaceCells(withHover); return cells.length ? [cells.map((c) => [c % N, (c / N) | 0])] : []; }
    const pts = this.rawPts(withHover);
    if (!pts.length) return [];
    const mode = this.lineMode(); const ro = this.o.road;
    const four = this.tool.type !== 'road';
    let m = mode;
    if (mode === 'curved' && pts.length < 3) m = 'straight';
    return chainsFor(m, pts, { four, gridSpacing: ro.gridSp, parallel: this.tool.type === 'road' && ro.parallel && mode !== 'replace', parallelSpacing: ro.parSp });
  }

  addPoint(p) {
    const last = this.pts[this.pts.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    this.pts.push(p);
    const need = this.lineMode() === 'curved' ? 3 : 2;
    if (this.pts.length >= need) {
      if (this.smoothRoad()) this.commitGeoms(this.geoms(false));
      else this.commitChains(this.chains(false));
      this.pts = this.lineMode() === 'continuous' ? [p] : [];
    }
  }

  commitGeoms(geoms) {
    const t = this.tool;
    const r = A.buildRoadGeoms(this.s, geoms, t.road, { elev: this.o.road.elev });
    if (r && !r.ok && r.msg) this.g.ui.toast(r.msg, 'bad'); else if (r && r.ok) this.g.sound('build');
    this.g.ui.renderToolPanels();
  }

  commitChains(chains) {
    const t = this.tool; let r;
    const flat = []; for (const c of chains) for (const p of c) flat.push(p);
    if (t.type === 'road') r = A.buildRoadChains(this.s, chains, t.road, { elev: this.o.road.elev, replace: this.o.road.mode === 'replace' });
    else if (t.type === 'net') r = this.erasing() ? A.removeNetwork(this.s, t.kind, flat) : A.buildNetwork(this.s, t.kind, flat);
    else if (t.type === 'upgrade') r = A.roadUpgrade(this.s, flat, t.bit, this.erasing());
    if (r && !r.ok && r.msg) this.g.ui.toast(r.msg, 'bad'); else if (r && r.ok) this.g.sound('build');
    this.g.ui.renderToolPanels();
  }

  continuous(first) {
    const now = performance.now();
    const h = this.hover; if (!h) return;
    const t = this.tool; const R = this.brushR;
    if (t.type === 'zone') {
      const cells = []; for (let z = h.z - R + 1; z < h.z + R; z++) for (let x = h.x - R + 1; x < h.x + R; x++) if (inB(x, z)) cells.push([x, z]);
      A.paintZone(this.s, cells, this.erasing() ? 0 : t.zone);
    } else if (t.type === 'district') {
      const cells = []; for (let z = h.z - R; z <= h.z + R; z++) for (let x = h.x - R; x <= h.x + R; x++) if (inB(x, z) && Math.hypot(x - h.x, z - h.z) <= R) cells.push([x, z]);
      A.paintDistrict(this.s, cells, this.erasing() ? 0 : t.id);
    } else if (t.type === 'terrain') {
      if (!first && now - this.lastApply < 60) return; this.lastApply = now;
      A.terraform(this.s, h.x, h.z, t.mode, R, this.o.terrain.strength);
    } else if (t.type === 'trees') {
      if (!first && now - this.lastApply < 90) return; this.lastApply = now;
      A.plantTrees(this.s, h.x, h.z, R, t.remove || this.erasing(), this.o.trees.density);
    }
  }

  fillZone(h) {
    const s = this.s;
    if (s.rt.dirty.roads) refreshRoads(s); const t = this.erasing() ? 0 : this.tool.zone;
    const zd = s.rt.zdepth; const start = idx(h.x, h.z);
    if (!zd || !zd[start]) return;
    const seen = new Set([start]); const q = [start]; const cells = [];
    while (q.length && cells.length < 900) {
      const i = q.pop(); cells.push([i % N, (i / N) | 0]);
      const x = i % N, z = (i / N) | 0;
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz; if (!inB(nx, nz)) continue; const j = idx(nx, nz);
        if (seen.has(j) || !zd[j] || s.road[j]) continue;
        if (t && s.bld[j] >= 0 && s.buildings[s.bld[j]].kind === 'svc') continue;
        seen.add(j); q.push(j);
      }
    }
    A.paintZone(s, cells, t);
  }

  bulldozeRect(a, b) {
    const s = this.s; const f = this.o.bulldoze.filter;
    const cells = A.rectCells(a[0], a[1], b[0], b[1]); let n = 0;
    if (cells.length === 1) { const [x, z] = cells[0]; const r = f === 'tree' ? A.plantTrees(s, x, z, 0, true) : A.bulldozeCell(s, x, z, f === 'building' ? 'building' : f === 'road' ? 'road' : 'all'); if (r.ok) n++; }
    else {
      if (f === 'all' || f === 'building') for (const [x, z] of cells) { const i = idx(x, z); if (s.bld[i] >= 0 && A.bulldozeCell(s, x, z, 'building').ok) n++; }
      if (f === 'all' || f === 'road') { const roads = cells.filter(([x, z]) => s.road[idx(x, z)]); if (roads.length) { A.removeRoads(s, roads); n += roads.length; } }
      if (f === 'all' || f === 'net') for (const k of ['power', 'train', 'pipeW', 'pipeS', 'metro', 'tram']) { const r = A.removeNetwork(s, k, cells); if (r.ok) n += r.n; }
      if (f === 'all' || f === 'tree') for (const [x, z] of cells) { const i = idx(x, z); if (s.tree[i]) { s.tree[i] = 0; s.rt.dirty.trees = true; n++; } }
    }
    if (n) this.g.sound('bulldoze');
  }

  buyTile(h) {
    const t = ((h.z / TILE) | 0) * TILES + ((h.x / TILE) | 0);
    const r = A.buyTile(this.s, t);
    if (r.ok) { this.g.ui.toast('Harita karosu satın alındı', 'good'); this.g.ui.setHint(this.hintText()); this.g.sound('build'); this.g.ui.renderToolPanels(); }
    else this.g.ui.toast(r.msg, 'bad');
  }

  lineClick(h) {
    const s = this.s; const t = this.tool; const T = LINE_TYPES[t.lineType];
    let stop = null;
    if (T.station) {
      const b = this.buildingAt(h);
      if (!b || b.kind !== 'svc' || SERVICES[b.type].station !== T.station) { this.g.ui.toast(`${T.name} istasyonuna dokunun`, 'bad'); return; }
      stop = b.id;
    } else {
      const i = idx(h.x, h.z);
      if (!s.road[i] || ROADS[s.road[i]].key === 'highway' || s.rElev[i]) { this.g.ui.toast('Durak zemin seviyesindeki bir yol üzerinde olmalı', 'bad'); return; }
      if (t.lineType === 'tram' && s.rail[i] !== 2) { this.g.ui.toast('Tramvay durağı tramvay rayı olan yolda olmalı', 'bad'); return; }
      stop = i;
    }
    let line = t.lineId ? s.lines.find((l) => l.id === t.lineId) : null;
    if (!line) { line = newLine(s, t.lineType); t.lineId = line.id; }
    if (line.stops.length >= 2 && stop === line.stops[0]) { this.finishLine(); return; }
    if (line.stops.includes(stop)) return;
    line.stops.push(stop);
    computeLinePath(s, line);
    s.rt.dirty.lines = true;
    this.g.ui.refreshPanel(); this.g.ui.renderToolPanels();
  }

  finishLine() {
    const s = this.s; const t = this.tool; const line = s.lines.find((l) => l.id === t.lineId);
    t.lineId = null;
    if (!line) return;
    if (line.stops.length < 2) { s.lines = s.lines.filter((l) => l !== line); this.g.ui.toast('Hat iptal edildi (en az 2 durak gerekli)'); }
    else { computeLinePath(s, line); this.g.ui.toast(line.valid ? `${line.name} oluşturuldu` : `${line.name}: ${line.problem}`, line.valid ? 'good' : 'bad'); }
    this.g.ui.refreshPanel(); this.g.ui.renderToolPanels();
  }

  // ---------- önizleme ----------
  refresh() {
    const s = this.s; if (!s) return;
    const fx = this.fx; const h = this.hover; const t = this.tool;
    if (t.type === 'zone' && s.rt.dirty.roads) refreshRoads(s);
    fx.hideCells(); fx.hideBuildingGhost(); fx.hideBrush();
    this.g.renderer.buildings.hoverBox.visible = false;
    this.cursorText = ''; this.preview = null;
    if (!h) { this.g.ui.cursor(0, 0, ''); return; }
    switch (t.type) {
      case 'select': {
        const b = this.buildingAt(h);
        if (b) { this.g.renderer.buildings.setSelection(s, b, this.g.renderer.buildings.hoverBox); this.cursorText = b.name; }
        else if (s.road[idx(h.x, h.z)]) { const i = idx(h.x, h.z); this.cursorText = `${ROADS[s.road[i]].name} · Trafik ${Math.round(s.traffic[i])}/${ROADS[s.road[i]].cap}`; }
        break;
      }
      case 'road': case 'net': case 'upgrade': {
        let chains, plan, samples = null;
        if (this.smoothRoad()) { const pr = A.prepareRoadGeoms(s, this.geoms(true)); chains = pr.chains; samples = pr.samplesList; }
        else if (t.type === 'road' && this.lineMode() === 'replace') { chains = this.chains(true); samples = chains.length ? samplesInCells(s, chains[0].map(([x, z]) => idx(x, z))) : []; }
        else chains = this.chains(true);
        if (t.type === 'road') plan = A.planRoadChains(s, chains, t.road, { elev: this.o.road.elev, replace: this.o.road.mode === 'replace' });
        else {
          const flat = []; for (const c of chains) for (const p of c) flat.push(p);
          if (t.type === 'net') plan = A.planNetwork(s, t.kind, flat);
          else plan = { cost: flat.filter(([x, z]) => s.road[idx(x, z)]).length * ROAD_UPGRADES[t.bit].cost, cells: flat.map(([x, z]) => ({ x, z, ok: !!s.road[idx(x, z)] })) };
        }
        const rem = this.erasing() && t.type !== 'road';
        const hgt = t.type === 'net' && t.kind === 'power' ? 2 : t.type === 'road' && this.o.road.elev === 1 ? 7.5 : 0.6;
        let len = 0;
        if (samples) {
          // pürüzsüz yol: hayalet şerit + yalnızca sorunlu hücreler
          const bad = plan.cells.filter((c) => !c.ok && !c.skip);
          fx.showCells(s, bad.map((c) => [c.x, c.z, 0xe04040]), null, 0.4);
          const ok = !bad.length && plan.cost <= s.money;
          fx.showRoadRibbon(s, samples, (ROAD_W[ROADS[t.road].key] || 7) + 1.2, ok, this.lineMode() === 'replace' ? 'auto' : this.o.road.elev);
          for (const sm of samples) for (let k = 1; k < sm.length; k++) len += Math.hypot(sm[k][0] - sm[k - 1][0], sm[k][1] - sm[k - 1][1]);
          len = Math.round(len);
        } else {
          fx.showCells(s, plan.cells.filter((c) => !c.skip).map((c) => [c.x, c.z, rem ? 0xe04040 : !c.ok ? 0xe04040 : c.same || c.have ? 0x60a0ff : 0x40e070]), null, hgt);
          for (const c of chains) len += Math.max(0, c.length - 1);
        }
        this.preview = { cost: plan.cost, cells: plan.cells.length, len: len * CS };
        this.cursorText = rem ? 'Kaldır' : `${fmtMoney(plan.cost)}${plan.cost > s.money ? ' (yetersiz para)' : ''} · ${len * CS} m`;
        break;
      }
      case 'zone': {
        let cells;
        if (this.o.zone.mode === 'rect' && this.dragRect && this.mouseDown) cells = A.rectCells(this.dragRect[0], this.dragRect[1], h.x, h.z);
        else if (this.o.zone.mode === 'brush') { cells = []; const R = this.brushR; for (let z = h.z - R + 1; z < h.z + R; z++) for (let x = h.x - R + 1; x < h.x + R; x++) if (inB(x, z)) cells.push([x, z]); }
        else cells = [[h.x, h.z]];
        const er = this.erasing() || !t.zone;
        const col = er ? 0xe04040 : parseInt(ZONES[t.zone].color.slice(1), 16);
        fx.showCells(s, cells.filter(([x, z]) => { const i = idx(x, z); return s.rt.zdepth && s.rt.zdepth[i] && (er || zoneCellOk(s, i, t.zone)); }).map(([x, z]) => [x, z, col]), null, 0.3);
        this.cursorText = er ? 'Bölge kaldır' : ZONES[t.zone].name;
        break;
      }
      case 'bulldoze': {
        const a = this.dragRect && this.mouseDown ? this.dragRect : [h.x, h.z];
        const cells = A.rectCells(a[0], a[1], h.x, h.z);
        fx.showCells(s, cells.map(([x, z]) => [x, z, 0xe04040]), null, 0.8);
        const b = this.buildingAt(h); if (b) { this.g.renderer.buildings.setSelection(s, b, this.g.renderer.buildings.hoverBox); this.cursorText = `Yık: ${b.name}`; }
        break;
      }
      case 'svc': {
        const f = this.facing(h); const v = A.validateService(s, t.key, h.x, h.z, f);
        const d = SERVICES[t.key]; const st = d.svc ? svcStats({ type: t.key, upgrades: [] }) : null;
        fx.showBuildingGhost(s, v.fp, d.style === 'wind' ? 28 : 10, v.ok, f, st ? st.radius : 0);
        this.cursorText = `${d.name} · ${fmtMoney(d.cost)}${v.ok ? '' : ' · ' + v.msg}`;
        this.preview = { ok: v.ok, msg: v.msg };
        break;
      }
      case 'tiles': {
        const tt = ((h.z / TILE) | 0) * TILES + ((h.x / TILE) | 0); const [ok, msg] = A.canBuyTile(s, tt);
        this.cursorText = s.owned[tt] ? 'Sahip olunan karo' : ok ? `Satın al: ${fmtMoney(tileCost(s))}` : msg;
        break;
      }
      case 'district': case 'terrain': case 'trees': fx.showBrush(s, h.x, h.z, this.brushR); break;
      case 'line': {
        const line = t.lineId ? s.lines.find((l) => l.id === t.lineId) : null;
        this.cursorText = line ? `${line.name}: ${line.stops.length} durak` : 'İlk durağı seçin';
        if (LINE_TYPES[t.lineType].station) { const b = this.buildingAt(h); if (b) this.g.renderer.buildings.setSelection(s, b, this.g.renderer.buildings.hoverBox); }
        else fx.showCells(s, [[h.x, h.z, 0x40a0ff]], null, 3);
        break;
      }
    }
    if (this.isLineTool() || t.type === 'svc') this.g.ui.updateToolPreview?.();
  }
}

export { NETWORKS };
