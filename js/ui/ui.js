// Arayüz: üst/alt çubuklar, araç çubuğu, açılır menüler, bildirimler, menü
import { MONTHS, fmtMoney, fmtNum, clamp } from '../core/constants.js';
import { CATEGORIES, SERVICES } from '../data/services.js';
import { ROADS, ROAD_UPGRADES, NETWORKS } from '../data/roads.js';
import { ZONES } from '../data/zones.js';
import { MILESTONES, DEV_TREE } from '../data/progression.js';
import { isUnlocked, serviceUnlocked, zoneUnlocked, categoryUnlocked, devNodeById } from '../sim/progression.js';
import { LINE_TYPES } from '../sim/transit.js';
import { WEATHER_ICONS, clockHour } from '../sim/weather.js';
import { PANELS, inspectorHTML, bindInspector, roadInspectorHTML } from './panels.js';
import { createDistrict } from '../sim/actions.js';
import { renderToolPanels, updatePreview } from './toolpanels.js';
import { toLayout, layoutW } from '../core/screen.js';
import { options } from '../core/options.js';

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
    $('city-name').addEventListener('click', () => this.ask('Şehir adı', this.g.state.cityName, (n) => { this.g.state.cityName = n.slice(0, 40); }));
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el) this.tip(el.dataset.tip, e); else this.tip(null); });
    document.addEventListener('mousemove', (e) => { if (!$('tooltip').classList.contains('hidden')) this.placeTip(e); });
  }

  get s() { return this.g.state; }

  onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const M = this.g.menus;
    if (M.open) { if (e.code === 'Escape' && !this.g.inMenu) { e.preventDefault(); M.back(); } return; }
    if (!$('dialog').classList.contains('hidden')) return;
    if (this.g.tools.key(e)) { e.preventDefault(); return; }
    if (e.code === 'Escape') {
      if (!$('modal').classList.contains('hidden')) { this.closeModal(); return; }
      if (this.panel) { this.closePanel(); return; }
      if (!$('inspector').classList.contains('hidden')) { this.inspect(null); return; }
      if (this.cat) { this.selectCategory(null); return; }
      this.menu(); return;
    }
    if (!$('modal').classList.contains('hidden')) return;
    const K = options().keys; const c = e.code;
    if (c === K.pause) { e.preventDefault(); this.g.togglePause(); }
    else if (c === K.speed1) this.g.setSpeed(1);
    else if (c === K.speed2) this.g.setSpeed(2);
    else if (c === K.speed3) this.g.setSpeed(3);
    else if (c === K.bulldoze && !e.ctrlKey) { this.selectCategory(null); this.g.tools.set({ type: 'bulldoze' }); this.refreshToolbar(); }
    else if (c === K.infoviews) this.togglePanel('info');
    else if (c === K.progression) this.togglePanel('prog');
    else if (c === K.economy) this.togglePanel('econ');
    else if (c === K.stats) this.togglePanel('stats');
    else if (c === K.quicksave) { e.preventDefault(); this.g.quickSave(); }
    else if (c === K.quickload) { e.preventDefault(); this.g.quickLoad(); }
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
      for (const r in ROADS) { const d = ROADS[r]; const un = isUnlocked(s, d.unlock); items.push(this.card({ act: 'road:' + r, icon: d.icon, name: d.name, cost: fmtMoney(d.cost) + '/hc', tip: `<b>${d.name}</b><br>${d.desc}<br>Hız: ${d.speed} km/sa · Kapasite: ${d.cap}<br>Bakım: ${fmtMoney(d.upkeep)}/hücre/ay${un ? '' : '<br>' + unlockText(d.unlock)}`, locked: !un })); }
      items.push('<div style="width:10px"></div>');
      for (const b in ROAD_UPGRADES) { const u = ROAD_UPGRADES[b]; items.push(this.card({ act: 'upg:' + b, icon: u.icon, name: u.name, cost: fmtMoney(u.cost), tip: `<b>${u.name}</b><br>${u.desc}<br>Shift ile kaldırın.` })); }
    } else if (key === 'zoning') {
      for (const z in ZONES) { const d = ZONES[z]; const un = zoneUnlocked(s, z); items.push(this.card({ act: 'zone:' + z, icon: `<span style="display:inline-block;width:24px;height:24px;border-radius:5px;background:${d.color}"></span>`, name: d.name, tip: `<b>${d.name}</b><br>${d.desc}${d.res ? '<br>Sadece ilgili doğal kaynak üzerinde.' : ''}${un ? '' : '<br>' + unlockText(d.unlock)}`, locked: !un })); }
      items.push(this.card({ act: 'zone:0', icon: '❌', name: 'Bölge Kaldır', tip: 'Seçilen alandaki bölgelemeyi kaldırır.' }));

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
    else if (k === 'newdistrict') { this.ask('Yeni ilçenin adı', `İlçe ${this.s.districts.length + 1}`, (n) => { const d = createDistrict(this.s, n); if (d) { this.renderFlyout(); T.set({ type: 'district', id: d.id }); } }); return; }
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
    $('st-weather').textContent = WEATHER_ICONS[s.weather.state]; const tu = options().gameplay.tempUnit; $('st-temp').textContent = (tu === 'F' ? Math.round(s.weather.temp * 1.8 + 32) + '°F' : Math.round(s.weather.temp) + '°C');
    const ck = clockHour(s); const hh = Math.floor(ck), mm = Math.floor((ck - hh) * 60);
    const c24 = options().interface.clock24; const hs = c24 ? String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') : `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'ÖÖ' : 'ÖS'}`;
    $('date').textContent = layoutW() <= 760 || document.body.classList.contains('land') ? `${MONTHS[s.time.month].slice(0, 3)} ${s.time.year}` : `${hs} · ${MONTHS[s.time.month]} ${s.time.year}`;
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
    this.advT = (this.advT || 0) - 0.25;
    if (this.advT <= 0) { this.advT = 2; this.advisor(); }
    this.panelT -= 0.25;
    if (this.panel && this.panelT <= 0 && PANELS[this.panel].live) { this.panelT = 1; this.refreshPanel(true); }
    if (this.inspected) {
      const b = s.buildings[this.inspected];
      if (!b) this.inspect(null);
      else if (!this.inspT || (this.inspT -= 0.25) <= 0) { this.inspT = 1; this.renderInspector(b); }
    }
  }

  // Danışman: yeni oyunculara sıradaki adımı gösterir
  advisor() {
    const s = this.s; const el = document.getElementById('advisor');
    if (!s.settings.advisor) { el.classList.add('hidden'); return; }
    let roads = 0, zones = 0, pipesW = 0, pipesS = 0;
    for (let i = 0; i < s.road.length; i++) { if (s.road[i] && s.road[i] !== 6) roads++; if (s.zone[i]) zones++; if (s.pipeW[i]) pipesW++; if (s.pipeS[i]) pipesS++; }
    const has = (pred) => Object.values(s.buildings).some((b) => b.kind === 'svc' && pred(SERVICES[b.type]));
    const hasType = (t) => Object.values(s.buildings).some((b) => b.type === t);
    let tip = null;
    if (roads < 12) tip = '🛣️ Otoyolun ucundan başlayarak şehre yollar çekin (<b>Yollar</b> menüsü). Küçük yollar mahalleler için idealdir.';
    else if (zones < 20) tip = '🏘️ Yolların kenarına <b>konut</b>, <b>ticari</b> ve <b>sanayi</b> bölgeleri boyayın. Sanayiyi konutlardan biraz uzak tutun.';
    else if (!has((d) => d.prod?.power)) tip = '⚡ <b>Elektrik</b> menüsünden rüzgar türbini veya kömür santrali kurun. Yollar elektriği taşır. (Şimdilik dış bağlantıdan pahalı elektrik ithal ediliyor.)';
    else if (!has((d) => d.prod?.water)) tip = '💧 Nehir veya göl kıyısına <b>Su Pompalama İstasyonu</b> kurun.';
    else if (!has((d) => d.prod?.sewage)) tip = '🚽 <b>Kanalizasyon Çıkışı</b> kurun – su pompasından uzağa, akıntı yönünde!';
    else if (pipesW < roads * 0.5 || pipesS < roads * 0.5) tip = '🔧 Yolların altına <b>su ve kanalizasyon boruları</b> döşeyin (Su menüsü → "Tüm Yollara Boru Döşe").';
    else if (s.milestone >= 1 && !hasType('landfill') && !hasType('incinerator')) tip = '🗑️ Çöp birikiyor: bir <b>Çöp Sahası</b> kurun.';
    else if (s.milestone >= 1 && !has((d) => d.svc?.type === 'health')) tip = '🏥 Vatandaşların sağlığı için bir <b>Sağlık Ocağı</b> kurun.';
    else if (s.milestone >= 1 && !has((d) => d.svc?.type === 'death')) tip = '🪦 Bir <b>Mezarlık</b> kurun.';
    else if (s.milestone >= 2 && !hasType('elementary')) tip = '🎓 <b>Eğitim</b> açıldı: İlkokul ve lise kurun; eğitimli işçiler ofisleri ve seviye atlamayı mümkün kılar.';
    else if (s.milestone >= 3 && !has((d) => d.svc?.type === 'police')) tip = '🚓 Suçu önlemek için <b>Polis Karakolu</b> kurun.';
    else if (s.milestone >= 3 && !has((d) => d.svc?.type === 'fire')) tip = '🚒 Yangınlara karşı <b>İtfaiye Binası</b> kurun.';
    else if (s.devPoints > 0 && s.milestone >= 2) tip = `◆ ${s.devPoints} gelişim puanınız var. <b>İlerleme</b> panelinden yeni binaların kilidini açın.`;
    else if (s.milestone >= 4 && !s.lines.length) tip = '🚌 Trafiği azaltmak için <b>Otobüs Garajı</b> kurup otobüs hatları oluşturun.';
    if (!tip) { el.classList.add('hidden'); return; }
    el.innerHTML = `<div class="adv-h">🧑‍💼 Danışman <button class="x" id="adv-x" title="Danışmanı kapat">✕</button></div><div>${tip}</div>`;
    el.classList.remove('hidden');
    document.getElementById('adv-x').onclick = () => { s.settings.advisor = false; el.classList.add('hidden'); };
  }

  onEvent(e) {
    const s = this.s;
    if (e.type === 'milestone') {
      const m = MILESTONES[e.m];
      this.banner(`<div style="font-size:40px">🏆</div><h1>${m.name}</h1><div>Yeni kilometre taşı!</div><ul><li>Ödül: ${fmtMoney(m.money)}</li><li>Gelişim puanı: +${m.dp} ◆</li><li>Harita karosu izni: +${m.tiles}</li>${m.unlocks.map((u) => `<li>${u}</li>`).join('')}</ul><button class="btn good" id="banner-ok">Harika!</button>`);
      this.refreshToolbar(); if (this.cat) this.renderFlyout();
      this.g.sound('milestone');
    } else if (!options().interface.chirperToasts) { /* olay bildirimleri kapalı */ }
    else if (e.type === 'fire') this.toast('🔥 Yangın çıktı!', 'bad');
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

  renderToolPanels() { if (this.g.tools) renderToolPanels(this); }
  updateToolPreview() { updatePreview(this); }

  // ---------------- yardımcılar ----------------
  setHint(t) { const h = $('hint'); h.textContent = t; h.classList.toggle('hidden', !t); }
  cursor(x, y, text) { const c = $('cursorinfo'); if (!text) { c.classList.add('hidden'); return; } c.textContent = text; c.style.left = x + 16 + 'px'; c.style.top = y + 18 + 'px'; c.classList.remove('hidden'); }
  toast(msg, kind = '') { const d = document.createElement('div'); d.className = 'toast ' + kind; d.textContent = msg; $('toasts').appendChild(d); setTimeout(() => d.remove(), 4000); while ($('toasts').children.length > 5) $('toasts').firstChild.remove(); }
  banner(html) { const b = $('banner'); b.innerHTML = html; b.classList.remove('hidden'); const ok = $('banner-ok'); if (ok) ok.addEventListener('click', () => b.classList.add('hidden')); setTimeout(() => b.classList.add('hidden'), 12000); }
  tip(html, e) { const t = $('tooltip'); if (!html) { t.classList.add('hidden'); return; } t.innerHTML = html; t.classList.remove('hidden'); this.placeTip(e); }
  placeTip(e) { const t = $('tooltip'); const w = t.offsetWidth, h = t.offsetHeight; const [cx, cy] = toLayout(e.clientX, e.clientY); let x = cx + 14, y = cy - h - 10; if (x + w > layoutW()) x = layoutW() - w - 6; if (y < 4) y = cy + 20; t.style.left = x + 'px'; t.style.top = y + 'px'; }

  // Tarayıcı prompt/confirm yerine oyun içi küçük diyaloglar
  ask(title, value, cb) {
    const d = $('dialog');
    d.innerHTML = `<div class="dbox"><div class="sec">${title}</div><input type="text" id="dlg-in" maxlength="40"><div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" id="dlg-no">Vazgeç</button><button class="btn good" id="dlg-ok">Tamam</button></div></div>`;
    d.classList.remove('hidden');
    const inp = $('dlg-in'); inp.value = value || ''; inp.focus(); inp.select();
    const close = () => d.classList.add('hidden');
    const ok = () => { const v = inp.value.trim(); close(); if (v) cb(v); };
    $('dlg-ok').onclick = ok; $('dlg-no').onclick = close;
    inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  }
  confirmBox(text, cb) {
    const d = $('dialog');
    d.innerHTML = `<div class="dbox"><div style="margin-bottom:12px">${text}</div><div class="row" style="justify-content:flex-end"><button class="btn" id="dlg-no">Vazgeç</button><button class="btn danger" id="dlg-ok">Evet</button></div></div>`;
    d.classList.remove('hidden');
    const close = () => d.classList.add('hidden');
    $('dlg-ok').onclick = () => { close(); cb(); }; $('dlg-no').onclick = close;
  }

  modal(html) { const m = $('modal'); m.innerHTML = `<div class="mbox">${html}</div>`; m.classList.remove('hidden'); this.g.modalPause(true); return m; }
  closeModal() { $('modal').classList.add('hidden'); this.g.modalPause(false); }

  menu() { this.g.menus.showPause(); }

}

function pct(v) { return Math.round(v * 100) + '%'; }
export { unlockText, DEV_TREE };
