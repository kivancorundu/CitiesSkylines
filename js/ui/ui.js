// Arayüz: üst/alt çubuklar, araç çubuğu, açılır menüler, bildirimler, menü
import { MONTHS, fmtMoney, fmtNum, clamp } from '../core/constants.js';
import { CATEGORIES, SERVICES } from '../data/services.js';
import { ROADS, ROAD_UPGRADES, NETWORKS } from '../data/roads.js';
import { ZONES } from '../data/zones.js';
import { MILESTONES, DEV_TREE } from '../data/progression.js';
import { isUnlocked, serviceUnlocked, zoneUnlocked, categoryUnlocked, devNodeById } from '../sim/progression.js';
import { LINE_TYPES } from '../sim/transit.js';
import { WEATHER_ICONS } from '../sim/weather.js';
import { PANELS, inspectorHTML, bindInspector, roadInspectorHTML } from './panels.js';
import { createDistrict } from '../sim/actions.js';

const $ = (id) => document.getElementById(id);

function unlockText(spec) {
  if (typeof spec === 'number') return `Kilometre taşı gerekli: ${MILESTONES[spec].name}`;
  const n = devNodeById(spec); return n ? `Gelişim ağacı: ${n.name} (${n.cost} ◆)` : '';
}

export class UI {
  constructor(game) {
    this.g = game; this.cat = null; this.panel = null; this.t = 0; this.panelT = 0;
    this.buildToolbar();
    document.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => this.togglePanel(b.dataset.panel)));
    document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => this.g.setSpeed(+b.dataset.speed)));
    $('btn-menu').addEventListener('click', () => this.menu());
    $('milestone').addEventListener('click', () => this.togglePanel('prog'));
    $('devpts').addEventListener('click', () => { this.togglePanel('prog'); });
    $('city-name').addEventListener('click', () => { const n = prompt('Şehir adı:', this.g.state.cityName); if (n) { this.g.state.cityName = n.slice(0, 40); } });
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el) this.tip(el.dataset.tip, e); else this.tip(null); });
    document.addEventListener('mousemove', (e) => { if (!$('tooltip').classList.contains('hidden')) this.placeTip(e); });
  }

  get s() { return this.g.state; }

  onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (this.g.tools.key(e)) { e.preventDefault(); return; }
    if (e.code === 'Escape') {
      if (!$('modal').classList.contains('hidden')) { this.closeModal(); return; }
      if (this.panel) { this.closePanel(); return; }
      if (!$('inspector').classList.contains('hidden')) { this.inspect(null); return; }
      this.menu(); return;
    }
    if (!$('modal').classList.contains('hidden')) return;
    if (e.code === 'Space') { e.preventDefault(); this.g.togglePause(); }
    else if (e.code === 'Digit1') this.g.setSpeed(1);
    else if (e.code === 'Digit2') this.g.setSpeed(2);
    else if (e.code === 'Digit3') this.g.setSpeed(3);
    else if (e.code === 'KeyB' && !e.ctrlKey) { this.selectCategory(null); this.g.tools.set({ type: 'bulldoze' }); }
    else if (e.code === 'KeyI') this.togglePanel('info');
    else if (e.code === 'KeyP') this.togglePanel('prog');
    else if (e.code === 'KeyM') this.togglePanel('econ');
    else if (e.code === 'KeyN') this.togglePanel('stats');
    else if (e.code === 'F5') { e.preventDefault(); this.g.quickSave(); }
    else if (e.code === 'F9') { e.preventDefault(); this.g.quickLoad(); }
  }

  // ---------------- araç çubuğu ----------------
  buildToolbar() {
    const tb = $('toolbar'); tb.innerHTML = '';
    for (const c of CATEGORIES) {
      const b = document.createElement('button'); b.className = 'cat'; b.dataset.cat = c.key; b.innerHTML = `${c.icon}<span class="lk"></span>`;
      b.dataset.tip = `<b>${c.name}</b>`;
      b.addEventListener('click', () => this.selectCategory(this.cat === c.key ? null : c.key));
      tb.appendChild(b);
    }
    const bd = document.createElement('button'); bd.className = 'cat'; bd.innerHTML = '🚜'; bd.dataset.tip = '<b>Yıkım</b> (B)'; bd.dataset.cat = 'bulldoze';
    bd.addEventListener('click', () => { this.selectCategory(null); this.g.tools.set({ type: 'bulldoze' }); bd.classList.add('on'); });
    tb.appendChild(bd);
  }

  refreshToolbar() {
    document.querySelectorAll('#toolbar .cat').forEach((b) => {
      const c = CATEGORIES.find((q) => q.key === b.dataset.cat);
      if (c) {
        const un = this.s.milestone >= c.unlock;
        b.classList.toggle('locked', !un); b.querySelector('.lk').textContent = un ? '' : '🔒';
        b.dataset.tip = `<b>${c.name}</b>${un ? '' : '<br>' + unlockText(c.unlock)}`;
      }
      b.classList.toggle('on', b.dataset.cat === this.cat || (b.dataset.cat === 'bulldoze' && this.g.tools.tool.type === 'bulldoze'));
    });
  }

  selectCategory(key) {
    if (key) { const c = CATEGORIES.find((q) => q.key === key); if (this.s.milestone < c.unlock) { this.toast(unlockText(c.unlock), 'bad'); return; } }
    this.cat = key;
    if (!key) { $('flyout').classList.add('hidden'); if (this.g.tools.tool.type !== 'bulldoze') this.g.tools.set({ type: 'select' }); }
    else { this.renderFlyout(); $('flyout').classList.remove('hidden'); this.g.tools.set({ type: 'select' }); }
    this.refreshToolbar();
  }

  card(o) {
    const lock = o.locked ? ' locked' : '';
    return `<button class="card${lock}${o.on ? ' on' : ''}" data-act="${o.act}" data-tip="${(o.tip || '').replace(/"/g, '&quot;')}"><div class="ic">${o.icon}</div><div class="nm">${o.name}</div><div class="cs">${o.cost || ''}</div></button>`;
  }

  renderFlyout() {
    const s = this.s, key = this.cat; const c = CATEGORIES.find((q) => q.key === key);
    let html = `<div class="fly-title"><span>${c.icon} ${c.name}</span><span id="fly-extra"></span></div>`;
    const items = [];
    const svcCards = (cat) => {
      for (const k in SERVICES) {
        const d = SERVICES[k]; if (d.cat !== cat) continue;
        const un = serviceUnlocked(s, k);
        const tip = `<b>${d.name}</b><br>${d.desc}<br>Maliyet: ${fmtMoney(d.cost)} · Bakım: ${fmtMoney(d.upkeep)}/ay${d.workers ? ' · Çalışan: ' + d.workers : ''}${d.prod?.power ? '<br>Üretim: ' + d.prod.power + ' MW' : ''}${d.prod?.water ? '<br>Su: ' + d.prod.water : ''}${d.svc ? '<br>Kapasite: ' + fmtNum(d.svc.cap) + ' · Menzil: ' + d.svc.radius * 8 + ' m' : ''}${d.attract ? '<br>Çekicilik: +' + d.attract : ''}${un ? '' : '<br><span class=neg>' + unlockText(d.unlock) + '</span>'}`;
        items.push(this.card({ act: 'svc:' + k, icon: d.icon, name: d.name, cost: d.cost ? fmtMoney(d.cost) : 'Ücretsiz', tip, locked: !un, on: this.g.tools.tool.key === k }));
      }
    };
    if (key === 'roads') {
      for (const r in ROADS) { const d = ROADS[r]; const un = isUnlocked(s, d.unlock); items.push(this.card({ act: 'road:' + r, icon: d.icon, name: d.name, cost: fmtMoney(d.cost) + '/hc', tip: `<b>${d.name}</b><br>${d.desc}<br>Hız: ${d.speed} km/s · Kapasite: ${d.cap}<br>Bakım: ${fmtMoney(d.upkeep)}/hücre/ay${un ? '' : '<br>' + unlockText(d.unlock)}`, locked: !un })); }
      items.push('<div style="width:10px"></div>');
      for (const b in ROAD_UPGRADES) { const u = ROAD_UPGRADES[b]; items.push(this.card({ act: 'upg:' + b, icon: u.icon, name: u.name, cost: fmtMoney(u.cost), tip: `<b>${u.name}</b><br>${u.desc}<br>Shift ile kaldırın.` })); }
    } else if (key === 'zoning') {
      for (const z in ZONES) { const d = ZONES[z]; const un = zoneUnlocked(s, z); items.push(this.card({ act: 'zone:' + z, icon: `<span style="display:inline-block;width:24px;height:24px;border-radius:5px;background:${d.color}"></span>`, name: d.name, tip: `<b>${d.name}</b><br>${d.desc}${d.res ? '<br>Sadece ilgili doğal kaynak üzerinde.' : ''}${un ? '' : '<br>' + unlockText(d.unlock)}`, locked: !un })); }
      items.push(this.card({ act: 'zone:0', icon: '❌', name: 'Bölge Kaldır', tip: 'Seçilen alandaki bölgelemeyi kaldırır.' }));
      html = html.replace('<span id="fly-extra"></span>', `<span class="modes" id="fly-extra">${['rect', 'brush', 'fill'].map((m) => `<button data-zmode="${m}" class="${this.g.tools.zoneMode === m ? 'on' : ''}">${{ rect: '▭ Dikdörtgen', brush: '🖌 Fırça', fill: '🪣 Doldur' }[m]}</button>`).join('')}</span>`);
    } else if (key === 'electricity') {
      items.push(this.card({ act: 'net:power', icon: NETWORKS.power.icon, name: NETWORKS.power.name, cost: fmtMoney(NETWORKS.power.cost) + '/hc', tip: `<b>${NETWORKS.power.name}</b><br>${NETWORKS.power.desc}` }));
      svcCards('electricity');
    } else if (key === 'water') {
      for (const k of ['pipeW', 'pipeS']) items.push(this.card({ act: 'net:' + k, icon: NETWORKS[k].icon, name: NETWORKS[k].name, cost: fmtMoney(NETWORKS[k].cost) + '/hc', tip: `<b>${NETWORKS[k].name}</b><br>${NETWORKS[k].desc}<br>İpucu: Boruları yolların altından çekin; binalar yol tarafındaki borulara bağlanır.` }));
      items.push(this.card({ act: 'pipeall', icon: '🔧', name: 'Tüm Yollara Boru Döşe', tip: 'Sahip olduğunuz tüm yolların altına su ve kanalizasyon borusu döşer (maliyetli).' }));
      svcCards('water');
    } else if (key === 'transport') {
      for (const lt in LINE_TYPES) { const T = LINE_TYPES[lt]; const un = isUnlocked(s, T.unlock); items.push(this.card({ act: 'line:' + lt, icon: T.icon, name: T.name + ' Hattı', tip: `<b>${T.name} Hattı Oluştur</b><br>Durakları sırayla seçin. Kapasite/araç: ${T.vcap}. Araç bakımı: ${fmtMoney(T.vUpkeep)}/ay${un ? '' : '<br>' + unlockText(T.unlock)}`, locked: !un })); }
      for (const k of ['tram', 'train', 'metro']) { const d = NETWORKS[k]; const un = isUnlocked(s, d.unlock); items.push(this.card({ act: 'net:' + k, icon: d.icon, name: d.name, cost: fmtMoney(d.cost) + '/hc', tip: `<b>${d.name}</b><br>${d.desc}${un ? '' : '<br>' + unlockText(d.unlock)}`, locked: !un })); }
      svcCards('transport');
    } else if (key === 'landscaping') {
      for (const [m, ic, nm] of [['raise', '⬆️', 'Yükselt'], ['lower', '⬇️', 'Alçalt'], ['level', '➖', 'Düzle'], ['smooth', '〰️', 'Yumuşat']]) items.push(this.card({ act: 'terrain:' + m, icon: ic, name: 'Arazi: ' + nm, tip: `<b>Arazi ${nm}</b><br>Basılı tutarak uygulayın. Su seviyesinin altına inen yerler suyla dolar.` }));
      items.push(this.card({ act: 'trees:0', icon: '🌲', name: 'Ağaç Dik', cost: '₺15/ağaç', tip: '<b>Ağaç Dik</b><br>Hava kirliliğini azaltır, arazi değerini ve turizmi artırır.' }));
      items.push(this.card({ act: 'trees:1', icon: '🪓', name: 'Ağaç Kes', tip: '<b>Ağaç Kes</b>' }));
    } else if (key === 'areas') {
      items.push(this.card({ act: 'tiles', icon: '🧩', name: 'Harita Karoları', tip: '<b>Harita Karoları</b><br>Şehrinizi genişletmek için yeni alan satın alın. Kilometre taşları daha fazla karo izni verir.' }));
      const dun = s.milestone >= 4;
      items.push(this.card({ act: 'newdistrict', icon: '➕', name: 'Yeni İlçe', locked: !dun, tip: '<b>İlçe Oluştur</b><br>İlçelere özel politikalar uygulayabilirsiniz.' + (dun ? '' : '<br>' + unlockText(4)) }));
      for (const d of s.districts) items.push(this.card({ act: 'district:' + d.id, icon: `<span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${d.color}"></span>`, name: d.name, tip: `<b>${d.name}</b><br>Boyamak için seçin.` }));
    } else svcCards(key);
    html += `<div class="fly-items">${items.join('')}</div>`;
    $('flyout').innerHTML = html;
    $('flyout').querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => this.flyAct(b.dataset.act, b)));
    $('flyout').querySelectorAll('[data-zmode]').forEach((b) => b.addEventListener('click', () => { this.g.tools.zoneMode = b.dataset.zmode; this.renderFlyout(); }));
  }

  flyAct(act, el) {
    if (el.classList.contains('locked')) { this.toast('Bu öğe henüz kilitli', 'bad'); return; }
    const [k, v] = act.split(':'); const T = this.g.tools;
    if (k === 'road') T.set({ type: 'road', road: +v });
    else if (k === 'upg') T.set({ type: 'upgrade', bit: +v });
    else if (k === 'zone') T.set({ type: 'zone', zone: +v });
    else if (k === 'svc') T.set({ type: 'svc', key: v });
    else if (k === 'net') T.set({ type: 'net', kind: v });
    else if (k === 'line') T.set({ type: 'line', lineType: v, lineId: null });
    else if (k === 'terrain') T.set({ type: 'terrain', mode: v });
    else if (k === 'trees') T.set({ type: 'trees', remove: v === '1' });
    else if (k === 'tiles') T.set({ type: 'tiles' });
    else if (k === 'district') T.set({ type: 'district', id: +v });
    else if (k === 'newdistrict') { const n = prompt('İlçe adı:', `İlçe ${this.s.districts.length + 1}`); if (n !== null) { const d = createDistrict(this.s, n); if (d) { this.renderFlyout(); T.set({ type: 'district', id: d.id }); } } return; }
    else if (k === 'pipeall') { this.g.pipeAllRoads(); return; }
    $('flyout').querySelectorAll('.card').forEach((c) => c.classList.toggle('on', c === el));
  }

  // ---------------- HUD ----------------
  update(dt) {
    const s = this.s; if (!s) return;
    this.t -= dt;
    while (s.rt.uiEvents.length) this.onEvent(s.rt.uiEvents.shift());
    if (this.t > 0) return;
    this.t = 0.25;
    const st = s.stats;
    $('st-pop').textContent = fmtNum(st.pop || 0);
    $('st-money').textContent = fmtMoney(s.money); $('st-money').className = s.money < 0 ? 'neg' : '';
    const net = (s.econ.totalInc || 0) - (s.econ.totalExp || 0);
    $('st-net').textContent = (net >= 0 ? '+' : '') + fmtMoney(net) + '/ay'; $('st-net').className = net >= 0 ? 'pos' : 'neg';
    const h = st.happiness ?? 60;
    $('st-happy').textContent = Math.round(h) + '%'; $('st-happy-ico').textContent = h > 75 ? '😄' : h > 60 ? '🙂' : h > 45 ? '😐' : h > 30 ? '🙁' : '😠';
    $('st-weather').textContent = WEATHER_ICONS[s.weather.state]; $('st-temp').textContent = Math.round(s.weather.temp) + '°C';
    const hh = Math.floor(s.time.tod), mm = Math.floor((s.time.tod - hh) * 60);
    $('date').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${MONTHS[s.time.month]} ${s.time.year}`;
    const D = s.demand;
    for (const [id, v] of [['d-r', Math.max(D.resLow, D.resMed, D.resHigh)], ['d-c', D.com], ['d-i', D.ind], ['d-o', s.milestone >= 4 ? D.off : -0.01]]) {
      const el = $(id); const val = clamp(v, -1, 1);
      el.style.height = Math.abs(val) * 50 + '%'; el.classList.toggle('negative', val < 0);
    }
    document.querySelector('.bb-demand').dataset.tip = `<b>Talep</b><br>Konut (düşük/orta/yüksek): ${pct(D.resLow)} / ${pct(D.resMed)} / ${pct(D.resHigh)}<br>Ticari: ${pct(D.com)}<br>Sanayi: ${pct(D.ind)}<br>Ofis: ${pct(D.off)}<br>İşsizlik: ${pct(st.unemployment || 0)}`;
    document.querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === this.g.speed));
    $('city-name').textContent = s.cityName;
    const ms = s.milestone, next = MILESTONES[ms + 1];
    $('ms-name').textContent = `${ms ? MILESTONES[ms].name : 'Yeni Şehir'}${next ? ' → ' + next.name : ''}`;
    const prevXP = MILESTONES[ms].xp;
    $('xp-fill').style.width = next ? clamp(((s.xp - prevXP) / (next.xp - prevXP)) * 100, 0, 100) + '%' : '100%';
    $('ms-xp').textContent = next ? `${fmtNum(s.xp)} / ${fmtNum(next.xp)} XP` : `${fmtNum(s.xp)} XP – Megalopolis!`;
    $('devpts').textContent = `◆ ${s.devPoints}`;
    $('chirp-dot').classList.toggle('on', !!s.rt.newChirp);
    this.panelT -= 0.25;
    if (this.panel && this.panelT <= 0 && PANELS[this.panel].live) { this.panelT = 1; this.refreshPanel(true); }
    if (this.inspected) {
      const b = s.buildings[this.inspected];
      if (!b) this.inspect(null);
      else if (!this.inspT || (this.inspT -= 0.25) <= 0) { this.inspT = 1; this.renderInspector(b); }
    }
  }

  onEvent(e) {
    const s = this.s;
    if (e.type === 'milestone') {
      const m = MILESTONES[e.m];
      this.banner(`<div style="font-size:40px">🏆</div><h1>${m.name}</h1><div>Yeni kilometre taşı!</div><ul><li>Ödül: ${fmtMoney(m.money)}</li><li>Gelişim puanı: +${m.dp} ◆</li><li>Harita karosu izni: +${m.tiles}</li>${m.unlocks.map((u) => `<li>${u}</li>`).join('')}</ul><button class="btn good" id="banner-ok">Harika!</button>`);
      this.refreshToolbar(); if (this.cat) this.renderFlyout();
      this.g.sound('milestone');
    } else if (e.type === 'fire') this.toast('🔥 Yangın çıktı!', 'bad');
    else if (e.type === 'lightning') this.toast('⚡ Yıldırım düştü!', 'bad');
    else if (e.type === 'forestfire') this.toast('🌲🔥 Orman yangını başladı!', 'bad');
    else if (e.type === 'tornado') this.toast(e.warned ? '🌪️ Erken uyarı: Hortum yaklaşıyor! Vatandaşlar sığınaklara yönlendirildi.' : '🌪️ Hortum! Bir hortum şehre yaklaşıyor!', 'bad');
    else if (e.type === 'collapsed') this.toast('💥 Bir bina yıkıldı', 'bad');
    else if (e.type === 'month') { if (s.money < 0) this.toast('⚠️ Kasa ekside! Vergileri artırın veya kredi alın.', 'bad'); if (this.panel && !PANELS[this.panel].live) this.refreshPanel(true); }
  }

  // ---------------- paneller ----------------
  togglePanel(name) { if (this.panel === name) this.closePanel(); else this.openPanel(name); }
  openPanel(name) {
    this.panel = name; this.panelState = this.panelState || {};
    document.querySelectorAll('[data-panel]').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
    $('panel').classList.remove('hidden');
    if (name === 'chirper') this.s.rt.newChirp = false;
    this.refreshPanel();
  }
  closePanel() {
    if (this.panel === 'info') this.g.renderer.setView(null);
    this.panel = null; $('panel').classList.add('hidden');
    document.querySelectorAll('[data-panel]').forEach((b) => b.classList.remove('on'));
  }
  refreshPanel(soft) {
    if (!this.panel) return;
    const P = PANELS[this.panel]; const el = $('panel');
    if (soft && P.update) { P.update(this, el); return; }
    const sc = el.scrollTop;
    el.innerHTML = `<div class="ph"><h2>${P.title}</h2><button class="x" id="panel-x">✕</button></div>` + P.render(this);
    $('panel-x').addEventListener('click', () => this.closePanel());
    if (P.bind) P.bind(this, el);
    el.scrollTop = sc;
  }

  inspect(b) {
    this.inspected = b ? b.id : null;
    if (!b) { $('inspector').classList.add('hidden'); if (this.s) this.s.rt.selected = null; return; }
    this.s.rt.selected = b.id;
    this.renderInspector(b);
  }
  renderInspector(b) {
    const el = $('inspector'); el.classList.remove('hidden');
    const sc = el.scrollTop;
    el.innerHTML = inspectorHTML(this, b);
    bindInspector(this, el, b);
    el.scrollTop = sc;
  }
  inspectRoad(i) {
    this.inspected = null; const el = $('inspector'); el.classList.remove('hidden');
    el.innerHTML = roadInspectorHTML(this, i);
    el.querySelector('.x')?.addEventListener('click', () => this.inspect(null));
  }

  // ---------------- yardımcılar ----------------
  setHint(t) { const h = $('hint'); h.textContent = t; h.classList.toggle('hidden', !t); }
  cursor(x, y, text) { const c = $('cursorinfo'); if (!text) { c.classList.add('hidden'); return; } c.textContent = text; c.style.left = x + 16 + 'px'; c.style.top = y + 18 + 'px'; c.classList.remove('hidden'); }
  toast(msg, kind = '') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; $('toasts').appendChild(d); setTimeout(() => d.remove(), 4000); while ($('toasts').children.length > 5) $('toasts').firstChild.remove(); }
  banner(html) { const b = $('banner'); b.innerHTML = html; b.classList.remove('hidden'); const ok = $('banner-ok'); if (ok) ok.addEventListener('click', () => b.classList.add('hidden')); setTimeout(() => b.classList.add('hidden'), 12000); }
  tip(html, e) { const t = $('tooltip'); if (!html) { t.classList.add('hidden'); return; } t.innerHTML = html; t.classList.remove('hidden'); this.placeTip(e); }
  placeTip(e) { const t = $('tooltip'); const w = t.offsetWidth, h = t.offsetHeight; let x = e.clientX + 14, y = e.clientY - h - 10; if (x + w > innerWidth) x = innerWidth - w - 6; if (y < 4) y = e.clientY + 20; t.style.left = x + 'px'; t.style.top = y + 'px'; }

  modal(html) { const m = $('modal'); m.innerHTML = `<div class="mbox">${html}</div>`; m.classList.remove('hidden'); this.g.modalPause(true); return m; }
  closeModal() { $('modal').classList.add('hidden'); this.g.modalPause(false); }

  menu() {
    const m = this.modal(`<h1>🏙️ Şehir Kurucu II</h1><div style="color:var(--muted)">${this.s ? this.s.cityName + ' · ' + fmtNum(this.s.stats.pop || 0) + ' nüfus' : ''}</div>
      <div class="menu">
        <button class="btn" data-m="resume">▶ Devam Et</button>
        <button class="btn" data-m="new">🆕 Yeni Oyun</button>
        <button class="btn" data-m="save">💾 Kaydet</button>
        <button class="btn" data-m="load">📂 Yükle</button>
        <button class="btn" data-m="export">⬇️ Dosyaya Aktar (.json)</button>
        <button class="btn" data-m="import">⬆️ Dosyadan Yükle</button>
        <button class="btn" data-m="settings">⚙️ Ayarlar</button>
        <button class="btn" data-m="help">❓ Kontroller ve Nasıl Oynanır</button>
      </div>`);
    m.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => this.menuAct(b.dataset.m)));
  }

  menuAct(a) {
    const g = this.g;
    if (a === 'resume') this.closeModal();
    else if (a === 'new') {
      const m = this.modal(`<h1>🆕 Yeni Oyun</h1><div class="row"><span class="l">Şehir adı</span><input type="text" id="ng-name" value="${['Yeşilvadi', 'Mavikent', 'Gökçeşehir', 'Altınkıyı'][(Math.random() * 4) | 0]}"></div><div class="row"><span class="l">Harita tohumu</span><input type="number" id="ng-seed" value="${(Math.random() * 99999) | 0}"></div><div class="row"><span class="l">Başlangıç parası</span><select id="ng-money"><option value="350000">Normal (₺350.000)</option><option value="1000000">Kolay (₺1.000.000)</option><option value="150000">Zor (₺150.000)</option><option value="99999999">Sınırsız</option></select></div><div class="row"><span class="l">Tüm kilitleri aç</span><input type="checkbox" id="ng-unlock"></div><div class="menu"><button class="btn good" id="ng-go">Şehri Kur</button><button class="btn" id="ng-back">Geri</button></div>`);
      m.querySelector('#ng-go').addEventListener('click', () => { g.newGame(+$('ng-seed').value, $('ng-name').value, { money: +$('ng-money').value, unlockAll: $('ng-unlock').checked }); this.closeModal(); });
      m.querySelector('#ng-back').addEventListener('click', () => this.menu());
    } else if (a === 'save') {
      const slots = g.listSaves();
      const m = this.modal(`<h1>💾 Kaydet</h1><div class="row"><input type="text" id="sv-name" value="${this.s.cityName}" style="flex:1"><button class="btn good" id="sv-go">Kaydet</button></div><div class="sec">Mevcut kayıtlar</div>${slots.map((sl) => `<div class="row"><span>${sl.name}<br><small class="l">${sl.date} · ${fmtNum(sl.pop)} nüfus</small></span><button class="btn" data-ow="${sl.key}">Üzerine yaz</button></div>`).join('') || '<div class="l">Kayıt yok</div>'}<div class="menu"><button class="btn" id="sv-back">Geri</button></div>`);
      m.querySelector('#sv-go').addEventListener('click', () => { if (g.save($('sv-name').value)) { this.toast('Kaydedildi', 'good'); this.closeModal(); } });
      m.querySelectorAll('[data-ow]').forEach((b) => b.addEventListener('click', () => { if (g.save(null, b.dataset.ow)) { this.toast('Kaydedildi', 'good'); this.closeModal(); } }));
      m.querySelector('#sv-back').addEventListener('click', () => this.menu());
    } else if (a === 'load') {
      const slots = g.listSaves();
      const m = this.modal(`<h1>📂 Yükle</h1>${slots.map((sl) => `<div class="row"><span>${sl.name}<br><small class="l">${sl.date} · ${fmtNum(sl.pop)} nüfus</small></span><span><button class="btn good" data-ld="${sl.key}">Yükle</button> <button class="btn danger" data-del="${sl.key}">Sil</button></span></div>`).join('') || '<div class="l">Kayıt yok</div>'}<div class="menu"><button class="btn" id="ld-back">Geri</button></div>`);
      m.querySelectorAll('[data-ld]').forEach((b) => b.addEventListener('click', () => { if (g.load(b.dataset.ld)) this.closeModal(); }));
      m.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { if (confirm('Kayıt silinsin mi?')) { g.deleteSave(b.dataset.del); this.menuAct('load'); } }));
      m.querySelector('#ld-back').addEventListener('click', () => this.menu());
    } else if (a === 'export') g.exportFile();
    else if (a === 'import') g.importFile();
    else if (a === 'settings') {
      const st = this.s.settings;
      const opt = (k, n) => `<div class="row"><span>${n}</span><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}></div>`;
      const m = this.modal(`<h1>⚙️ Ayarlar</h1>${opt('shadows', 'Gölgeler')}${opt('dayNight', 'Gün/gece döngüsü')}${opt('disasters', 'Doğal afetler')}${opt('autoDemolish', 'Terk edilmiş binaları otomatik yık')}${opt('edgeScroll', 'Kenar kaydırma')}<div class="row"><span>Ses efektleri</span><input type="checkbox" id="set-sound" ${g.soundOn ? 'checked' : ''}></div><div class="menu"><button class="btn" id="st-back">Geri</button></div>`);
      m.querySelectorAll('[data-set]').forEach((c) => c.addEventListener('change', () => { st[c.dataset.set] = c.checked; g.renderer.cam.edgeScroll = st.edgeScroll; }));
      m.querySelector('#set-sound').addEventListener('change', (e) => { g.soundOn = e.target.checked; });
      m.querySelector('#st-back').addEventListener('click', () => this.menu());
    } else if (a === 'help') {
      const m = this.modal(`<h1>❓ Nasıl Oynanır</h1>
        <div class="sec">Kamera</div>
        <div><span class="kbd">W A S D</span> / oklar: kaydır · <span class="kbd">Q E</span>: döndür · <span class="kbd">R F</span>: eğim · Tekerlek: yakınlaştır · Sağ tık sürükle: döndür · Orta tık sürükle: kaydır · <span class="kbd">Shift</span>: hızlı</div>
        <div class="sec">Kısayollar</div>
        <div><span class="kbd">Boşluk</span> duraklat · <span class="kbd">1 2 3</span> hız · <span class="kbd">B</span> yıkım · <span class="kbd">I</span> bilgi görünümleri · <span class="kbd">P</span> ilerleme · <span class="kbd">M</span> ekonomi · <span class="kbd">N</span> istatistik · <span class="kbd">, .</span> binayı döndür · <span class="kbd">[ ]</span> fırça boyutu · <span class="kbd">F5/F9</span> hızlı kaydet/yükle · <span class="kbd">Esc</span> iptal/menü</div>
        <div class="sec">Başlangıç</div>
        <ol style="padding-left:18px;line-height:1.5">
          <li>Otoyol bağlantısından şehre yollar çekin (Yollar).</li>
          <li>Yolların kenarlarına <b>Konut</b>, <b>Ticari</b> ve <b>Sanayi</b> bölgeleri boyayın. Sanayiyi konutlardan uzak tutun (kirlilik).</li>
          <li><b>Elektrik</b>: rüzgar türbini veya kömür santrali kurun; yollar elektriği taşır. Başlangıçta dış bağlantıdan elektrik ithal edilebilir.</li>
          <li><b>Su</b>: nehir kıyısına su pompası, akıntı yönünde aşağıya kanalizasyon çıkışı kurun. Yolların altından su ve kanalizasyon borusu çekin (veya "Tüm Yollara Boru Döşe").</li>
          <li>Alt çubuktaki talep çubuklarını (K/T/S/O) izleyin. Kilometre taşlarıyla sağlık, çöp, eğitim, itfaiye, polis, parklar ve daha fazlası açılır.</li>
          <li>Gelişim puanlarıyla (◆) gelişim ağacından yeni binalar açın.</li>
        </ol>`);
      void m;
      const back = document.createElement('div'); back.className = 'menu'; back.innerHTML = '<button class="btn">Geri</button>'; $('modal').querySelector('.mbox').appendChild(back); back.firstChild.addEventListener('click', () => this.menu());
    }
  }
}

function pct(v) { return Math.round(v * 100) + '%'; }
export { unlockText, DEV_TREE };
