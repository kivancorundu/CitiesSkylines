// Araçlar: seçim, yol, şebeke, bölgeleme, bina, yıkım, karo, ilçe, arazi, ağaç, yol yükseltme, toplu taşıma hattı
import { N, TILE, TILES, DIRS, idx, inB, fmtMoney, CS } from '../core/constants.js';
import { ROADS, ROAD_UPGRADES, NETWORKS } from '../data/roads.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import * as A from '../sim/actions.js';
import { svcStats } from '../sim/buildings.js';
import { tileCost, allowedTiles, ownedTiles } from '../sim/progression.js';
import { newLine, computeLinePath, LINE_TYPES } from '../sim/transit.js';
import { zoneCellOk } from '../sim/growth.js';

export class Tools {
  constructor(game) {
    this.g = game; this.tool = { type: 'select' }; this.hover = null; this.start = null; this.mouseDown = false; this.rot = null;
    this.brushR = 2; this.zoneMode = 'rect'; this.bulldozeMode = 'all'; this.lastApply = 0;
    const cv = game.renderer.renderer.domElement;
    cv.addEventListener('mousemove', (e) => this.onMove(e));
    cv.addEventListener('mousedown', (e) => { if (e.button === 0) this.onDown(e); });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.onUp(e); if (e.button === 2) this.onRight(e); });
    cv.addEventListener('mouseleave', () => { this.hover = null; this.refresh(); });
  }
  get s() { return this.g.state; }
  get fx() { return this.g.renderer.effects; }

  set(tool) {
    if (this.tool.type === 'line' && this.tool.lineId) this.finishLine();
    this.tool = tool; this.start = null; this.rot = null; this.mouseDown = false;
    const r = this.g.renderer;
    r.toolFlags = { zoning: tool.type === 'zone', district: tool.type === 'district', tiles: tool.type === 'tiles', grid: tool.type === 'zone' };
    if (this.s) this.s.rt.dirty.overlay = true;
    this.fx.hideCells(); this.fx.hideBuildingGhost(); this.fx.hideBrush();
    this.g.ui.setHint(this.hintText());
    this.refresh();
  }

  hintText() {
    const t = this.tool;
    switch (t.type) {
      case 'road': return 'Sol tık: başlangıç → bitiş noktası (sürükle veya iki tık). Mevcut yolun üzerine çizerek yükseltin. Sağ tık: iptal';
      case 'net': return `${NETWORKS[t.kind].name}: çizgi çekin. Shift + sürükle: kaldır. Sağ tık: iptal`;
      case 'zone': return t.zone ? 'Bölge boyayın. Yoldan 6 hücre derinliğe kadar. Shift: bölge kaldır. Mod: Dikdörtgen / Fırça / Doldur' : 'Bölge kaldırma: alanı seçin';
      case 'svc': return 'Binayı yerleştirin. Ön cephe yola bakmalı. , ve . tuşları: döndür. Sağ tık: iptal';
      case 'bulldoze': return 'Yıkım: tıklayın veya alan seçin. Sağ tık: çıkış';
      case 'tiles': return `Harita karosu satın alın (${ownedTiles(this.s)}/${allowedTiles(this.s)} izinli). Maliyet: ${fmtMoney(tileCost(this.s))}`;
      case 'district': return 'İlçe boyayın. Shift: sil. [ ve ]: fırça boyutu';
      case 'terrain': return 'Basılı tutarak araziyi düzenleyin. [ ve ]: fırça boyutu';
      case 'trees': return t.remove ? 'Ağaçları kaldırın' : 'Ağaç dikin (basılı tutun). [ ve ]: fırça boyutu';
      case 'upgrade': return `${ROAD_UPGRADES[t.bit].name}: yol boyunca çizin. Shift: kaldır`;
      case 'line': return `${LINE_TYPES[t.lineType].name} hattı: durakları sırayla tıklayın; ilk durağa tıklayarak hattı kapatın. ${t.lineType === 'metro' || t.lineType === 'train' ? 'Durak olarak istasyonları seçin.' : 'Durak için yol hücrelerine tıklayın.'}`;
      default: return '';
    }
  }

  onMove(e) {
    this.mx = e.clientX; this.my = e.clientY; this.shift = e.shiftKey;
    const p = this.g.renderer.pick(e.clientX, e.clientY);
    const changed = !this.hover || !p || p.x !== this.hover.x || p.z !== this.hover.z;
    this.hover = p;
    if (this.mouseDown && p && ['zone', 'district', 'terrain', 'trees'].includes(this.tool.type)) this.continuous();
    if (changed) this.refresh();
    this.g.ui.cursor(e.clientX, e.clientY, this.cursorText);
  }

  onDown(e) {
    if (!this.s) return;
    this.shift = e.shiftKey; this.mouseDown = true;
    const h = this.hover; if (!h) return;
    const t = this.tool;
    switch (t.type) {
      case 'select': {
        const b = this.buildingAt(h);
        this.s.rt.selected = b ? b.id : null; this.g.ui.inspect(b);
        if (!b && this.s.road[idx(h.x, h.z)]) this.g.ui.inspectRoad(idx(h.x, h.z));
        break;
      }
      case 'road': case 'net': case 'upgrade':
        if (this.start) { this.commitLine(this.start, h); this.start = null; }
        else this.start = { x: h.x, z: h.z, click: true };
        break;
      case 'zone':
        if (this.zoneMode === 'fill') { this.fillZone(h); this.mouseDown = false; }
        else if (this.zoneMode === 'brush') this.continuous();
        else this.start = { x: h.x, z: h.z };
        break;
      case 'bulldoze': this.start = { x: h.x, z: h.z }; break;
      case 'svc': {
        const f = this.facing(h); const r = A.placeService(this.s, t.key, h.x, h.z, f);
        if (!r.ok) this.g.ui.toast(r.msg, 'bad'); else { this.g.sound('build'); this.g.ui.toast(`${SERVICES[t.key].name} inşa edildi`, 'good'); }
        break;
      }
      case 'tiles': this.buyTile(h); break;
      case 'district': case 'terrain': case 'trees': this.continuous(true); break;
      case 'line': this.lineClick(h); break;
    }
    this.refresh();
  }

  onUp(e) {
    if (!this.mouseDown) return;
    this.mouseDown = false;
    const h = this.hover, t = this.tool;
    if (!this.s) return;
    if ((t.type === 'road' || t.type === 'net' || t.type === 'upgrade') && this.start && h && (h.x !== this.start.x || h.z !== this.start.z)) { this.commitLine(this.start, h); this.start = null; }
    if (t.type === 'zone' && this.zoneMode === 'rect' && this.start && h) {
      const cells = A.rectCells(this.start.x, this.start.z, h.x, h.z);
      const r = A.paintZone(this.s, cells, this.shift ? 0 : t.zone); this.start = null;
      if (!r.ok && r.msg) this.g.ui.toast(r.msg, 'bad');
    }
    if (t.type === 'bulldoze' && this.start && h) {
      const cells = A.rectCells(this.start.x, this.start.z, h.x, h.z); this.start = null;
      let n = 0;
      if (cells.length === 1) { const r = A.bulldozeCell(this.s, h.x, h.z, this.bulldozeMode); if (r.ok) n++; }
      else for (const [x, z] of cells) { const i = idx(x, z); if (this.bulldozeMode !== 'road' && this.s.bld[i] >= 0) { if (A.bulldozeCell(this.s, x, z, 'building').ok) n++; } }
      if (cells.length > 1 && this.bulldozeMode !== 'building') { const roads = cells.filter(([x, z]) => this.s.road[idx(x, z)]); if (roads.length) { A.removeRoads(this.s, roads); n += roads.length; } }
      if (cells.length > 1 && this.bulldozeMode === 'all') { for (const [x, z] of cells) { const i = idx(x, z); if (this.s.tree[i] || this.s.power[i] || this.s.rail[i] === 1) A.bulldozeCell(this.s, x, z); } }
      if (n) this.g.sound('bulldoze');
    }
    this.refresh();
  }

  onRight() {
    const cam = this.g.renderer.cam;
    if ((cam.lastDragMoved || 0) > 6) return;
    if (this.start) { this.start = null; this.refresh(); return; }
    if (this.tool.type === 'line' && this.tool.lineId) { this.finishLine(); return; }
    if (this.tool.type !== 'select') { this.g.ui.selectCategory(null); this.set({ type: 'select' }); }
  }

  key(e) {
    if (e.code === 'Comma' || e.code === 'Period') {
      if (this.tool.type === 'svc') { const cur = this.rot ?? this.facing(this.hover || { x: 0, z: 0 }); this.rot = (cur + (e.code === 'Period' ? 1 : 3)) % 4; this.refresh(); return true; }
    }
    if (e.code === 'BracketLeft') { this.brushR = Math.max(1, this.brushR - 1); this.refresh(); return true; }
    if (e.code === 'BracketRight') { this.brushR = Math.min(8, this.brushR + 1); this.refresh(); return true; }
    if (e.code === 'Escape') {
      if (this.start) { this.start = null; this.refresh(); return true; }
      if (this.tool.type === 'line' && this.tool.lineId) { this.finishLine(); return true; }
      if (this.tool.type !== 'select') { this.g.ui.selectCategory(null); this.set({ type: 'select' }); return true; }
    }
    return false;
  }

  buildingAt(h) { const i = idx(h.x, h.z); return this.s.bld[i] >= 0 ? this.s.buildings[this.s.bld[i]] : null; }
  facing(h) { if (this.rot !== null) return this.rot; return A.autoFacing(this.s, this.tool.key, h.x, h.z, 1); }

  commitLine(a, b) {
    const t = this.tool; const cells = A.linePath(a.x, a.z, b.x, b.z);
    let r;
    if (t.type === 'road') r = A.buildRoad(this.s, cells, t.road);
    else if (t.type === 'net') r = this.shift ? A.removeNetwork(this.s, t.kind, cells) : A.buildNetwork(this.s, t.kind, cells);
    else if (t.type === 'upgrade') r = A.roadUpgrade(this.s, cells, t.bit, this.shift);
    if (r && !r.ok && r.msg) this.g.ui.toast(r.msg, 'bad'); else if (r && r.ok) this.g.sound('build');
  }

  continuous(first) {
    const now = performance.now();
    const h = this.hover; if (!h) return;
    const t = this.tool; const R = this.brushR;
    if (t.type === 'zone') {
      const cells = []; for (let z = h.z - R + 1; z < h.z + R; z++) for (let x = h.x - R + 1; x < h.x + R; x++) if (inB(x, z)) cells.push([x, z]);
      A.paintZone(this.s, cells, this.shift ? 0 : t.zone);
    } else if (t.type === 'district') {
      const cells = []; for (let z = h.z - R; z <= h.z + R; z++) for (let x = h.x - R; x <= h.x + R; x++) if (inB(x, z) && Math.hypot(x - h.x, z - h.z) <= R) cells.push([x, z]);
      A.paintDistrict(this.s, cells, this.shift ? 0 : t.id);
    } else if (t.type === 'terrain') {
      if (!first && now - this.lastApply < 60) return; this.lastApply = now;
      A.terraform(this.s, h.x, h.z, t.mode, R);
    } else if (t.type === 'trees') {
      if (!first && now - this.lastApply < 90) return; this.lastApply = now;
      A.plantTrees(this.s, h.x, h.z, Math.max(1, R - 1), t.remove);
    }
  }

  fillZone(h) {
    const s = this.s; const t = this.shift ? 0 : this.tool.zone;
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

  buyTile(h) {
    const t = ((h.z / TILE) | 0) * TILES + ((h.x / TILE) | 0);
    const r = A.buyTile(this.s, t);
    if (r.ok) { this.g.ui.toast('Harita karosu satın alındı', 'good'); this.g.ui.setHint(this.hintText()); this.g.sound('build'); }
    else this.g.ui.toast(r.msg, 'bad');
  }

  lineClick(h) {
    const s = this.s; const t = this.tool; const T = LINE_TYPES[t.lineType];
    let stop = null;
    if (T.station) {
      const b = this.buildingAt(h);
      if (!b || b.kind !== 'svc' || SERVICES[b.type].station !== T.station) { this.g.ui.toast(`${T.name} istasyonuna tıklayın`, 'bad'); return; }
      stop = b.id;
    } else {
      const i = idx(h.x, h.z);
      if (!s.road[i] || ROADS[s.road[i]].key === 'highway') { this.g.ui.toast('Durak bir yol üzerinde olmalı', 'bad'); return; }
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
    this.g.ui.refreshPanel();
  }

  finishLine() {
    const s = this.s; const t = this.tool; const line = s.lines.find((l) => l.id === t.lineId);
    t.lineId = null;
    if (!line) return;
    if (line.stops.length < 2) { s.lines = s.lines.filter((l) => l !== line); this.g.ui.toast('Hat iptal edildi (en az 2 durak gerekli)'); }
    else { computeLinePath(s, line); this.g.ui.toast(line.valid ? `${line.name} oluşturuldu` : `${line.name}: ${line.problem}`, line.valid ? 'good' : 'bad'); }
    this.g.ui.refreshPanel();
  }

  // önizlemeleri güncelle
  refresh() {
    const s = this.s; if (!s) return;
    const fx = this.fx; const h = this.hover; const t = this.tool;
    fx.hideCells(); fx.hideBuildingGhost(); fx.hideBrush();
    this.g.renderer.buildings.hoverBox.visible = false;
    this.cursorText = '';
    this.g.renderer.overlayHook = null;
    if (!h) { this.g.ui.cursor(0, 0, ''); return; }
    switch (t.type) {
      case 'select': {
        const b = this.buildingAt(h);
        if (b) { this.g.renderer.buildings.setSelection(s, b, this.g.renderer.buildings.hoverBox); this.cursorText = b.name; }
        else if (s.road[idx(h.x, h.z)]) { const i = idx(h.x, h.z); this.cursorText = `${ROADS[s.road[i]].name} · Trafik ${Math.round(s.traffic[i])}/${ROADS[s.road[i]].cap}`; }
        break;
      }
      case 'road': case 'net': case 'upgrade': {
        const a = this.start || h; const cells = A.linePath(a.x, a.z, h.x, h.z);
        let plan;
        if (t.type === 'road') plan = A.planRoad(s, cells, t.road);
        else if (t.type === 'net') plan = A.planNetwork(s, t.kind, cells);
        else plan = { cost: cells.filter(([x, z]) => s.road[idx(x, z)]).length * ROAD_UPGRADES[t.bit].cost, cells: cells.map(([x, z]) => ({ x, z, ok: !!s.road[idx(x, z)] })) };
        const rem = this.shift && t.type !== 'road';
        fx.showCells(s, plan.cells.map((c) => [c.x, c.z, rem ? 0xe04040 : !c.ok ? 0xe04040 : c.same || c.have ? 0x60a0ff : 0x40e070]), null, t.type === 'net' && t.kind === 'power' ? 2 : 0.6);
        this.cursorText = rem ? 'Kaldır' : `${fmtMoney(plan.cost)}${plan.cost > s.money ? ' (yetersiz para)' : ''} · ${cells.length} hücre (${cells.length * CS} m)`;
        break;
      }
      case 'zone': {
        let cells;
        if (this.zoneMode === 'rect' && this.start && this.mouseDown) cells = A.rectCells(this.start.x, this.start.z, h.x, h.z);
        else if (this.zoneMode === 'brush') { cells = []; const R = this.brushR; for (let z = h.z - R + 1; z < h.z + R; z++) for (let x = h.x - R + 1; x < h.x + R; x++) if (inB(x, z)) cells.push([x, z]); }
        else cells = [[h.x, h.z]];
        const col = this.shift || !t.zone ? 0xe04040 : parseInt(ZONES[t.zone].color.slice(1), 16);
        fx.showCells(s, cells.filter(([x, z]) => { const i = idx(x, z); return s.rt.zdepth && s.rt.zdepth[i] && (this.shift || !t.zone || zoneCellOk(s, i, t.zone)); }).map(([x, z]) => [x, z, col]), null, 0.3);
        this.cursorText = this.shift || !t.zone ? 'Bölge kaldır' : ZONES[t.zone].name;
        break;
      }
      case 'bulldoze': {
        const a = this.start && this.mouseDown ? this.start : h;
        const cells = A.rectCells(a.x, a.z, h.x, h.z);
        fx.showCells(s, cells.map(([x, z]) => [x, z, 0xe04040]), null, 0.8);
        const b = this.buildingAt(h); if (b) { this.g.renderer.buildings.setSelection(s, b, this.g.renderer.buildings.hoverBox); this.cursorText = `Yık: ${b.name}`; }
        break;
      }
      case 'svc': {
        const f = this.facing(h); const v = A.validateService(s, t.key, h.x, h.z, f);
        const d = SERVICES[t.key]; const st = d.svc ? svcStats({ type: t.key, upgrades: [] }) : null;
        fx.showBuildingGhost(s, v.fp, d.style === 'wind' ? 28 : 10, v.ok, f, st ? st.radius : 0);
        this.cursorText = `${d.name} · ${fmtMoney(d.cost)}${v.ok ? '' : ' · ' + v.msg}`;
        break;
      }
      case 'tiles': {
        const tt = ((h.z / TILE) | 0) * TILES + ((h.x / TILE) | 0); const [ok, msg] = A.canBuyTile(s, tt);
        this.cursorText = s.owned[tt] ? 'Sahip olunan karo' : ok ? `Satın al: ${fmtMoney(tileCost(s))}` : msg;
        break;
      }
      case 'district': case 'terrain': case 'trees': fx.showBrush(s, h.x, h.z, this.brushR); this.cursorText = t.type === 'terrain' ? `Fırça: ${this.brushR}` : ''; break;
      case 'line': {
        const line = t.lineId ? s.lines.find((l) => l.id === t.lineId) : null;
        this.cursorText = line ? `${line.name}: ${line.stops.length} durak` : 'İlk durağı seçin';
        if (LINE_TYPES[t.lineType].station) { const b = this.buildingAt(h); if (b) this.g.renderer.buildings.setSelection(s, b, this.g.renderer.buildings.hoverBox); }
        else fx.showCells(s, [[h.x, h.z, 0x40a0ff]], null, 3);
        break;
      }
    }
  }
}
