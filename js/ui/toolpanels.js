// CS2 tarzı sol paneller: üstte "Seçili Öğe" bilgisi, altta "Araç Seçenekleri"
import { fmtMoney, fmtNum, CS, idx } from '../core/constants.js';
import { ROADS, ROAD_UPGRADES, NETWORKS } from '../data/roads.js';
import { ZONES } from '../data/zones.js';
import { SERVICES } from '../data/services.js';
import { LINE_TYPES, hasDepot } from '../sim/transit.js';
import { svcStats, residents } from '../sim/buildings.js';
import { tileCost, allowedTiles, ownedTiles } from '../sim/progression.js';
import { canUndo, createDistrict } from '../sim/actions.js';
import { layoutW } from '../core/screen.js';
import { ROAD_MODES, NET_MODES } from './tools.js';

const $ = (id) => document.getElementById(id);
const stat = (l, v) => `<div class="ti-row"><span>${l}</span><b>${v}</b></div>`;
const meter = (l, v, col) => `<div class="ti-row"><span>${l}</span><div class="ti-meter"><div style="width:${Math.max(0, Math.min(1, v)) * 100}%;${col ? 'background:' + col : ''}"></div></div></div>`;
const group = (title, inner) => `<div class="to-group"><div class="to-title">${title}</div><div class="to-body">${inner}</div></div>`;
const btn = (act, label, on, tip = '', extra = '') => `<button class="to-btn${on ? ' on' : ''}" data-to="${act}" title="${tip}" ${extra}>${label}</button>`;
const stepper = (act, val) => `<div class="to-step"><button class="to-btn" data-to="${act}:-">−</button><span>${val}</span><button class="to-btn" data-to="${act}:+">+</button></div>`;
const slider = (act, min, max, step, val, label) => `<div class="to-slider"><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-tos="${act}"><span>${label}</span></div>`;

const TERRAIN_MODES = [['raise', '⬆️', 'Yükselt'], ['lower', '⬇️', 'Alçalt'], ['level', '➖', 'Düzle'], ['smooth', '〰️', 'Yumuşat']];
const ELEV = ['Zemin', 'Yükseltilmiş', 'Tünel'];

function infoHTML(ui) {
  const T = ui.g.tools, t = T.tool, s = ui.s;
  const head = (icon, name, sub) => `<div class="ti-head"><div class="ti-icon">${icon}</div><div><div class="ti-name">${name}</div>${sub ? `<div class="ti-sub">${sub}</div>` : ''}</div></div>`;
  const pv = T.preview;
  switch (t.type) {
    case 'road': {
      const d = ROADS[t.road];
      return head(d.icon, d.name, 'Yollar') + `<p class="ti-desc">${d.desc}</p>` +
        stat('İnşa maliyeti', `${fmtMoney(d.cost)} / ${CS} m`) + stat('Bakım', `${fmtMoney(d.upkeep)} / ${CS} m / ay`) + stat('Hız sınırı', `${d.speed} km/sa`) + stat('Şerit', d.lanes || '-') + stat('Kapasite', fmtNum(d.cap)) +
        meter('Gürültü', d.noise, 'var(--bad)') + stat('Bölgelenebilir', d.zonable && T.o.road.elev === 0 ? 'Evet' : 'Hayır') +
        `<div id="ti-preview">${previewHTML(ui)}</div>`;
    }
    case 'net': { const d = NETWORKS[t.kind]; return head(d.icon, d.name, 'Şebeke') + `<p class="ti-desc">${d.desc}</p>` + stat('Maliyet', `${fmtMoney(d.cost)} / ${CS} m`) + stat('Bakım', `${fmtMoney(d.upkeep)} / ${CS} m / ay`) + `<div id="ti-preview">${previewHTML(ui)}</div>`; }
    case 'upgrade': { const d = ROAD_UPGRADES[t.bit]; return head(d.icon, d.name, 'Yol yükseltmesi') + `<p class="ti-desc">${d.desc}</p>` + stat('Maliyet', `${fmtMoney(d.cost)} / ${CS} m`) + stat('Bakım', `${fmtMoney(d.upkeep)} / ${CS} m / ay`) + `<div id="ti-preview">${previewHTML(ui)}</div>`; }
    case 'zone': {
      if (!t.zone) return head('❌', 'Bölge Kaldır', 'Bölgeleme') + '<p class="ti-desc">Seçilen hücrelerdeki bölgelemeyi kaldırır. Üzerindeki binalar yıkılır.</p>';
      const z = ZONES[t.zone]; const D = s.demand;
      const dem = z.group === 'R' ? (z.key === 'res_low' ? D.resLow : z.key === 'res_high' ? D.resHigh : D.resMed) : z.group === 'C' ? D.com : z.group === 'O' ? D.off : D.ind;
      return head(`<span class="ti-swatch" style="background:${z.color}"></span>`, z.name, 'Bölgeleme') + `<p class="ti-desc">${z.desc}</p>` +
        (z.hhFixed ? stat('Hane / parsel', z.hhFixed) : z.hh ? stat('Hane / hücre', z.hh) : '') + (z.jobs ? stat('İş / hücre', z.jobs) : '') +
        stat('Kat sayısı', `${z.floors[0]}–${z.floors[1]}`) + stat('Parsel', `${z.lot[0]}–${z.lot[1]} × ${z.lot[2]}–${z.lot[3]} hücre`) +
        meter('Talep', (dem + 1) / 2, dem > 0 ? 'var(--good)' : 'var(--bad)') + (z.res ? stat('Gerekli kaynak', ['', 'Verimli toprak', 'Orman', 'Petrol', 'Cevher'][z.res]) : '');
    }
    case 'svc': {
      const d = SERVICES[t.key]; const st = d.svc ? svcStats({ type: t.key, upgrades: [] }) : null;
      const built = Object.values(s.buildings).filter((b) => b.type === t.key).length;
      let h = head(d.icon, d.name, '') + `<p class="ti-desc">${d.desc}</p>` + stat('Maliyet', d.cost ? fmtMoney(d.cost) : 'Ücretsiz') + stat('Bakım', `${fmtMoney(d.upkeep)} / ay`) + stat('Boyut', `${d.size[0]} × ${d.size[1]} hücre`);
      if (d.workers) h += stat('Çalışan', d.workers);
      if (d.prod?.power) h += stat('Elektrik üretimi', `${d.prod.power} MW${d.windDependent ? ' (rüzgara bağlı)' : d.solarDependent ? ' (güneşe bağlı)' : ''}`);
      if (d.prod?.water) h += stat('Su pompalama', d.prod.water);
      if (d.prod?.sewage) h += stat('Atık su işleme', d.prod.sewage);
      if (d.prod?.battery) h += stat('Depolama', `${d.prod.battery} MWh`);
      if (st) h += stat('Kapasite', fmtNum(st.cap)) + stat('Etki alanı', `${st.radius * CS} m`);
      if (d.storage) h += stat('Depo', fmtNum(d.storage));
      if (d.attract) h += stat('Çekicilik', '+' + d.attract);
      if (d.pol) { if (d.pol.air) h += meter('Hava kirliliği', d.pol.air / 6, 'var(--bad)'); if (d.pol.ground) h += meter('Toprak kirliliği', d.pol.ground / 3, 'var(--bad)'); if (d.pol.noise) h += meter('Gürültü', d.pol.noise / 2.5, 'var(--bad)'); }
      if (d.place === 'shore') h += stat('Yerleşim', 'Kıyıya');
      h += stat('İnşa edilen', built + (d.unique ? ' (benzersiz)' : ''));
      h += `<div id="ti-preview">${previewHTML(ui)}</div>`;
      return h;
    }
    case 'bulldoze': return head('🚜', 'Yıkım Aracı', '') + '<p class="ti-desc">Binaları, yolları, şebekeleri ve ağaçları kaldırır. Hizmet binalarında maliyetin %25\'i, yollarda %50\'si iade edilir.</p>';
    case 'terrain': { const m = TERRAIN_MODES.find((q) => q[0] === t.mode) || TERRAIN_MODES[0]; return head(m[1], 'Arazi: ' + m[2], 'Arazi Düzenleme') + '<p class="ti-desc">Basılı tutarak araziyi şekillendirin. Su seviyesinin altına inen yerler suyla dolar.</p>' + stat('Maliyet', `${fmtMoney(40 * T.o.terrain.size ** 2)} / uygulama`); }
    case 'trees': return head(t.remove ? '🪓' : '🌲', t.remove ? 'Ağaç Kes' : 'Ağaç Dik', 'Arazi Düzenleme') + '<p class="ti-desc">Ağaçlar hava kirliliğini azaltır, arazi değerini ve turizmi artırır.</p>' + stat('Maliyet', t.remove ? 'Ücretsiz' : '₺15 / ağaç');
    case 'tiles': return head('🧩', 'Harita Karoları', 'Alanlar') + '<p class="ti-desc">Şehrinizi genişletmek için komşu karoları satın alın.</p>' + stat('Sahip olunan', `${ownedTiles(s)} / ${allowedTiles(s)} izinli`) + stat('Sonraki karo', fmtMoney(tileCost(s)));
    case 'district': {
      const d = s.districts.find((q) => q.id === t.id); if (!d) return '';
      let pop = 0; for (const id in s.buildings) { const b = s.buildings[id]; if (s.district[idx(b.x, b.z)] === d.id) pop += residents(b); }
      return head(`<span class="ti-swatch round" style="background:${d.color}"></span>`, d.name, 'İlçe') + stat('Alan', `${d.cells} hücre`) + stat('Nüfus', fmtNum(pop)) + stat('Politika', Object.values(d.policies).filter(Boolean).length);
    }
    case 'line': {
      const L = LINE_TYPES[t.lineType]; const line = t.lineId ? s.lines.find((l) => l.id === t.lineId) : null;
      return head(L.icon, `${L.name} Hattı`, 'Toplu Taşıma') + stat('Araç kapasitesi', L.vcap) + stat('Araç bakımı', `${fmtMoney(L.vUpkeep)} / ay`) + stat('Bilet', fmtMoney(L.fare)) + stat('Depo', hasDepot(s, t.lineType) ? '<span class="okc">Var</span>' : '<span class="neg">Yok</span>') +
        (line ? stat('Durak', line.stops.length) + stat('Uzunluk', `${((line.path.length * CS) / 1000).toFixed(1)} km`) + (line.problem ? `<div class="problem">${line.problem}</div>` : '') : '<p class="ti-desc">İlk durağı seçin.</p>');
    }
    default: return '';
  }
}

function previewHTML(ui) {
  const T = ui.g.tools, pv = T.preview;
  if (!pv) return '';
  if (T.tool.type === 'svc') return pv.ok ? '<div class="ti-ok">✔ Buraya yerleştirilebilir</div>' : `<div class="problem">✖ ${pv.msg || ''}</div>`;
  if (!T.pts.length) return '';
  return `<div class="ti-sep"></div>${stat('Uzunluk', `${pv.len} m`)}${stat('Toplam maliyet', `<span class="${pv.cost > ui.s.money ? 'neg' : ''}">${fmtMoney(pv.cost)}</span>`)}`;
}

function optionsHTML(ui) {
  const T = ui.g.tools, t = T.tool, o = T.o, s = ui.s;
  const touch = ui.g.touchMode;
  const pending = T.pts.length > 0 || !!T.dragRect;
  const cancel = pending || (t.type === 'line' && t.lineId) ? btn('cancel', '✖ İptal', false, 'Yarım kalan işlemi iptal et') : '';
  const eraser = btn('erase', '🧽 Silgi', o.erase, 'Kaldırma modu (masaüstünde Shift)');
  switch (t.type) {
    case 'road': {
      let h = group('Mod', ROAD_MODES.map((m) => btn('rmode:' + m.key, `<i>${m.icon}</i>${m.name}`, o.road.mode === m.key, m.tip)).join(''));
      h += group('Yapıştırma', btn('angle', `∠ ${o.road.angle ? o.road.angle + '°' : 'Kapalı'}`, !!o.road.angle, 'Açı yapıştırma') + btn('snapLen', '📏 Uzunluk', o.road.snapLen, 'Uzunluğu 32 m katlarına yapıştır') + btn('snapEx', '🧲 Mevcut yollar', o.road.snapExisting, 'Yakındaki yollara yapış'));
      h += group('Yükseklik', `<div class="to-step"><button class="to-btn" data-to="elev:-">▼</button><span>${ELEV[o.road.elev]}</span><button class="to-btn" data-to="elev:+">▲</button></div>`);
      if (o.road.mode === 'grid') h += group('Izgara aralığı', stepper('gridSp', `${o.road.gridSp} hücre (${o.road.gridSp * CS} m)`));
      else if (o.road.mode !== 'replace') h += group('Paralel mod', btn('parallel', o.road.parallel ? 'Açık' : 'Kapalı', o.road.parallel) + (o.road.parallel ? stepper('parSp', `${o.road.parSp * CS} m`) : ''));
      h += `<div class="to-actions">${btn('undo', '↶ Geri Al', false, 'Son yol işlemini geri al (Ctrl+Z)', canUndo(s) ? '' : 'disabled')}${cancel}</div>`;
      return h;
    }
    case 'net': return group('Mod', NET_MODES.map((m) => btn('nmode:' + m.key, `<i>${m.icon}</i>${m.name}`, o.net.mode === m.key, m.tip)).join('')) + `<div class="to-actions">${eraser}${cancel}</div>`;
    case 'upgrade': return group('Mod', NET_MODES.filter((m) => m.key !== 'curved').map((m) => btn('nmode:' + m.key, `<i>${m.icon}</i>${m.name}`, o.net.mode === m.key, m.tip)).join('')) + `<div class="to-actions">${eraser}${cancel}</div>`;
    case 'zone': {
      let h = group('Bölgeleme modu', [['fill', '🪣', 'Doldur'], ['rect', '▭', 'Seçim'], ['brush', '🖌', 'Boya']].map(([k, i, n]) => btn('zmode:' + k, `<i>${i}</i>${n}`, o.zone.mode === k)).join(''));
      if (o.zone.mode === 'brush') h += group('Fırça boyutu', slider('zsize', 1, 8, 1, o.zone.size, o.zone.size));
      return h + `<div class="to-actions">${t.zone ? eraser : ''}${cancel}</div>`;
    }
    case 'svc': return group('Döndürme', btn('rot:-', '⟲', false, 'Sola döndür (,)') + btn('rot:+', '⟳', false, 'Sağa döndür (.)') + btn('autoface', '🧭 Otomatik yön', o.svc.autoFace, 'Ön cepheyi en yakın yola çevir'));
    case 'bulldoze': return group('Filtre', [['all', 'Hepsi'], ['building', 'Binalar'], ['road', 'Yollar'], ['net', 'Şebekeler'], ['tree', 'Ağaçlar']].map(([k, n]) => btn('bfilter:' + k, n, o.bulldoze.filter === k)).join(''));
    case 'terrain': return group('Mod', TERRAIN_MODES.map(([k, i, n]) => btn('tmode:' + k, `<i>${i}</i>${n}`, t.mode === k)).join('')) + group('Fırça boyutu', slider('tsize', 1, 10, 1, o.terrain.size, o.terrain.size)) + group('Güç', slider('tstr', 0.2, 2, 0.1, o.terrain.strength, Math.round(o.terrain.strength * 100) + '%'));
    case 'trees': return group('Mod', btn('tree:0', '<i>🌲</i>Dik', !t.remove) + btn('tree:1', '<i>🪓</i>Kes', !!t.remove)) + group('Fırça boyutu', slider('trsize', 1, 8, 1, o.trees.size, o.trees.size)) + group('Yoğunluk', slider('trden', 0.1, 1, 0.1, o.trees.density, Math.round(o.trees.density * 100) + '%'));
    case 'district': return group('İlçe', s.districts.map((d) => btn('dsel:' + d.id, `<span class="ti-swatch round" style="background:${d.color}"></span>${d.name}`, t.id === d.id)).join('') + btn('dnew', '➕ Yeni', false)) + group('Fırça boyutu', slider('dsize', 1, 10, 1, o.district.size, o.district.size)) + `<div class="to-actions">${eraser}</div>`;
    case 'line': return `<div class="to-actions">${t.lineId ? btn('finish', '✔ Hattı Bitir', false) : ''}${cancel}</div>`;
    default: return '';
  }
}

export function renderToolPanels(ui) {
  const T = ui.g.tools; const t = T.tool;
  const info = $('tool-info'), opts = $('tool-opts');
  const active = t.type !== 'select';
  document.body.classList.toggle('tool-active', active);
  if (!active || !ui.s) { info.classList.add('hidden'); opts.classList.add('hidden'); return; }
  const ih = infoHTML(ui), oh = optionsHTML(ui);
  info.innerHTML = ih; info.classList.toggle('hidden', !ih || !!ui.collapsedInfo);
  opts.innerHTML = oh ? `<div class="to-head"><span>Araç Seçenekleri</span><button class="to-btn mini" data-to="toggleinfo" title="Bilgi panelini göster/gizle">ⓘ</button></div>${oh}` : '';
  opts.classList.toggle('hidden', !oh);
  document.body.classList.toggle('has-opts', !!oh);
  opts.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); act(ui, b.dataset.to); }));
  opts.querySelectorAll('[data-tos]').forEach((r) => r.addEventListener('input', () => slide(ui, r.dataset.tos, +r.value, r)));
}

export function updatePreview(ui) {
  const el = document.getElementById('ti-preview'); if (el) el.innerHTML = previewHTML(ui);
}

function act(ui, a) {
  const T = ui.g.tools, o = T.o, t = T.tool;
  const [k, v] = a.split(':');
  switch (k) {
    case 'rmode': o.road.mode = v; T.pts = []; break;
    case 'nmode': o.net.mode = v; T.pts = []; break;
    case 'angle': o.road.angle = o.road.angle === 0 ? 15 : o.road.angle === 15 ? 45 : 0; break;
    case 'snapLen': o.road.snapLen = !o.road.snapLen; break;
    case 'snapEx': o.road.snapExisting = !o.road.snapExisting; break;
    case 'elev': { const order = [2, 0, 1]; const k2 = Math.max(0, Math.min(2, order.indexOf(o.road.elev) + (v === '+' ? 1 : -1))); o.road.elev = order[k2]; break; }
    case 'gridSp': o.road.gridSp = Math.max(4, Math.min(30, o.road.gridSp + (v === '+' ? 1 : -1))); break;
    case 'parallel': o.road.parallel = !o.road.parallel; break;
    case 'parSp': o.road.parSp = Math.max(2, Math.min(12, o.road.parSp + (v === '+' ? 1 : -1))); break;
    case 'undo': { import('../sim/actions.js').then((A) => { if (A.undoLast(ui.s)) ui.toast('Geri alındı'); T.refresh(); renderToolPanels(ui); }); return; }
    case 'cancel': if (!T.cancel() && t.type === 'line') T.finishLine(); break;
    case 'erase': o.erase = !o.erase; break;
    case 'zmode': o.zone.mode = v; break;
    case 'rot': T.rotate(v === '+' ? 1 : -1); return;
    case 'autoface': o.svc.autoFace = !o.svc.autoFace; if (o.svc.autoFace) T.rot = null; break;
    case 'bfilter': o.bulldoze.filter = v; break;
    case 'tmode': t.mode = v; break;
    case 'tree': t.remove = v === '1'; break;
    case 'dsel': t.id = +v; break;
    case 'dnew': ui.ask('Yeni ilçenin adı', `İlçe ${ui.s.districts.length + 1}`, (n) => { const d = createDistrict(ui.s, n); if (d) { t.id = d.id; if (ui.cat === 'areas') ui.renderFlyout(); T.optionsChanged(); } }); return;
    case 'finish': T.finishLine(); break;
    case 'toggleinfo': if (ui.g.touchMode || layoutW() <= 760) document.body.classList.toggle('show-info'); else ui.collapsedInfo = !ui.collapsedInfo; break;
  }
  T.optionsChanged();
}

function slide(ui, k, v, el) {
  const o = ui.g.tools.o;
  if (k === 'zsize') o.zone.size = v; else if (k === 'tsize') o.terrain.size = v; else if (k === 'tstr') o.terrain.strength = v;
  else if (k === 'trsize') o.trees.size = v; else if (k === 'trden') o.trees.density = v; else if (k === 'dsize') o.district.size = v;
  const lab = el.nextElementSibling; if (lab) lab.textContent = k === 'tstr' || k === 'trden' ? Math.round(v * 100) + '%' : v;
  ui.g.tools.refresh();
}
