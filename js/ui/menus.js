// CS2 tarzı menüler: Ana menü, Yeni Oyun, Oyun Yükle, Seçenekler, Krediler, Duraklatma menüsü
import { N, TILE, fmtMoney, fmtNum, MONTHS } from '../core/constants.js';
import { MAPS, CLIMATES, mapByKey } from '../data/maps.js';
import { MILESTONES } from '../data/progression.js';
import { CITY_NAMES } from '../data/names.js';
import { createState } from '../core/state.js';
import { options, setOption, resetOptions, KEY_NAMES, keyLabel, GRAPHICS_PRESETS, IS_TOUCH } from '../core/options.js';

const $ = (id) => document.getElementById(id);
export const VERSION = '0.4.0';

// ---- seçenek tanımları (sekme → satırlar) ----
const sel = (key, label, choices, desc) => ({ t: 'select', key, label, choices, desc });
const tog = (key, label, desc) => ({ t: 'toggle', key, label, desc });
const sld = (key, label, min, max, step, fmt, desc) => ({ t: 'slider', key, label, min, max, step, fmt, desc });
const pct = (v) => Math.round(v * 100) + '%';
export const OPTION_TABS = [
  { key: 'general', name: 'Genel', icon: '⚙️', rows: [
    tog('autosave', 'Otomatik kaydetme', 'Oyun belirli aralıklarla otomatik olarak kaydedilir.'),
    sel('autosaveMin', 'Otomatik kayıt aralığı', [[5, '5 dakika'], [10, '10 dakika'], [15, '15 dakika'], [30, '30 dakika']], 'İki otomatik kayıt arasındaki gerçek zaman süresi.'),
    tog('tutorial', 'Danışman ipuçları', 'Yeni oyuncular için adım adım rehberlik gösterir.'),
    tog('pauseOnBlur', 'Pencere arka plana geçince duraklat', 'Başka bir sekmeye veya uygulamaya geçtiğinizde oyunu duraklatır.'),
  ] },
  { key: 'graphics', name: 'Grafik', icon: '🖥️', rows: [
    tog('fullscreen', 'Tam ekran', 'Oyunu tam ekran oynayın.'),
    sel('preset', 'Genel kalite', [['very_low', 'Çok Düşük'], ['low', 'Düşük'], ['medium', 'Orta'], ['high', 'Yüksek'], ['custom', 'Özel']], 'Tüm grafik ayarlarını tek seferde belirler. Mobil cihazlarda Düşük önerilir.'),
    sld('resScale', 'Çözünürlük ölçeği', 0.5, 1.5, 0.05, pct, 'Oyunun işlendiği iç çözünürlük. Düşük değerler performansı artırır.'),
    sel('shadows', 'Gölge kalitesi', [['off', 'Kapalı'], ['low', 'Düşük'], ['medium', 'Orta'], ['high', 'Yüksek']], 'Güneşin oluşturduğu gölgeler. En pahalı grafik ayarlarından biridir.'),
    sel('treeDetail', 'Ağaç ayrıntısı', [['low', 'Düşük'], ['medium', 'Orta'], ['high', 'Yüksek']], 'Çizilen ağaç sayısı.'),
    sld('vehicleDensity', 'Araç yoğunluğu', 0.2, 1.5, 0.05, pct, 'Ekranda görünen araç sayısı (simülasyonu etkilemez).'),
    tog('pedestrians', 'Yayalar', 'Kaldırımlarda yürüyen vatandaşları göster.'),
    tog('particles', 'Parçacık efektleri', 'Duman, ateş ve hortum efektleri.'),
    sel('waterQuality', 'Su kalitesi', [['low', 'Düşük'], ['high', 'Yüksek']], 'Su yüzeyinin yansıma kalitesi.'),
    tog('fog', 'Sis', 'Uzak mesafede atmosferik sis.'),
    tog('dayNight', 'Gün/gece döngüsü', 'Kapalıyken hep gündüz görünür.'),
    tog('weatherFx', 'Hava efektleri', 'Yağmur ve kar parçacıkları.'),
    sel('maxFps', 'Kare hızı sınırı', [[30, '30 FPS'], [60, '60 FPS'], [0, 'Sınırsız']], 'Pil ömrü için kare hızını sınırlayın.'),
    tog('antialias', 'Kenar yumuşatma (yeniden başlatma gerekir)', 'Kenarlardaki tırtıkları giderir. Değişiklik oyunu yeniden açtığınızda uygulanır.'),
  ] },
  { key: 'gameplay', name: 'Oynanış', icon: '🎮', rows: [
    tog('disasters', 'Doğal afetler', 'Hortum, yıldırım ve orman yangınları.'),
    tog('autoDemolish', 'Terk edilmiş binaları otomatik yık', 'Terk edilmiş ve yıkılmış binalar bir süre sonra kendiliğinden kaldırılır.'),
    tog('edgeScroll', 'Kenar kaydırma', 'Fare ekran kenarına gelince kamera kayar.'),
    sld('camSpeed', 'Kamera hızı', 0.3, 2.5, 0.1, pct, 'Klavye ile kamera hareket hızı.'),
    sel('tempUnit', 'Sıcaklık birimi', [['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)']], ''),
  ] },
  { key: 'interface', name: 'Arayüz', icon: '🪟', rows: [
    sld('uiScale', 'Arayüz ölçeği', 0.7, 1.4, 0.05, pct, 'Menü ve panellerin boyutu.'),
    tog('tooltips', 'Araç ipuçları', 'Öğelerin üzerine gelince açıklama göster.'),
    tog('clock24', '24 saat biçimi', ''),
    tog('icons', 'Bina sorun simgeleri', 'Binaların üzerindeki elektrik, su, çöp vb. uyarı simgeleri.'),
    tog('chirperToasts', 'Olay bildirimleri', 'Yangın, kilometre taşı gibi olaylar için ekran bildirimleri.'),
    tog('hints', 'Araç kullanım ipuçları', 'Ekranın üstünde aracın nasıl kullanılacağını göster.'),
  ] },
  { key: 'audio', name: 'Ses', icon: '🔊', rows: [
    sld('master', 'Ana ses', 0, 1, 0.05, pct, ''),
    sld('ui', 'Arayüz sesleri', 0, 1, 0.05, pct, 'İnşa, yıkım ve kilometre taşı sesleri.'),
    sld('ambient', 'Ortam sesi', 0, 1, 0.05, pct, 'Şehir uğultusu, rüzgar ve yağmur.'),
    tog('mute', 'Tüm sesleri kapat', ''),
  ] },
  { key: 'keys', name: 'Klavye', icon: '⌨️', rows: Object.keys(KEY_NAMES).map((k) => ({ t: 'key', key: k, label: KEY_NAMES[k] })) },
  { key: 'mouse', name: 'Fare', icon: '🖱️', rows: [
    tog('invertX', 'Yatay dönüşü ters çevir', ''), tog('invertY', 'Dikey eğimi ters çevir', ''),
    sld('rotSens', 'Döndürme hassasiyeti', 0.3, 2.5, 0.1, pct, 'Sağ tık sürüklemesiyle döndürme hızı.'),
    sld('zoomSens', 'Yakınlaştırma hassasiyeti', 0.3, 2.5, 0.1, pct, 'Fare tekerleği hızı.'),
    sld('panSens', 'Kaydırma hassasiyeti', 0.3, 2.5, 0.1, pct, 'Orta tık sürüklemesiyle kaydırma hızı.'),
  ] },
  { key: 'touch', name: 'Dokunmatik', icon: '👆', rows: [
    sld('panSens', 'Kaydırma hassasiyeti', 0.3, 2.5, 0.1, pct, 'Parmakla sürükleme hızı.'),
    sld('pinchSens', 'Yakınlaştırma hassasiyeti', 0.3, 2.5, 0.1, pct, 'İki parmakla sıkıştırma hızı.'),
    tog('twist', 'İki parmakla döndürme', 'İki parmağı çevirerek kamerayı döndür.'),
    tog('camButtons', 'Kamera düğmeleri', 'Ekranda döndürme ve eğim düğmelerini göster.'),
    tog('confirmPlace', 'Yerleştirmeyi onayla', 'Binayı yerleştirmek için aynı yere ikinci kez dokunun.'),
  ] },
];

export class Menus {
  constructor(game) {
    this.g = game; this.root = $('menu-root'); this.optTab = 'general'; this.selMap = MAPS[0].key; this.thumbCache = {};
    this.newOpts = { name: CITY_NAMES[(Math.random() * CITY_NAMES.length) | 0], theme: 'eu', leftHand: false, disasters: true, unlimited: false, unlockAll: false };
  }
  get open() { return !this.root.classList.contains('hidden'); }
  show(html, cls = '') { this.root.className = 'menu-root ' + cls; this.root.innerHTML = html; this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); this.root.innerHTML = ''; }
  back() { if (this.backFn) this.backFn(); }

  // ---------------- ANA MENÜ ----------------
  showMain() {
    this.g.enterMenuMode();
    const last = this.g.listSaves()[0];
    this.backFn = null;
    const item = (k, label, dis, sub = '') => `<button class="mm-item" data-mm="${k}" ${dis ? 'disabled' : ''}><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
    this.show(`<div class="mm-shade"></div>
      <div class="mm-left">
        <div class="mm-logo"><div class="mm-l1">ŞEHİR KURUCU</div><div class="mm-l2">II</div></div>
        <nav class="mm-nav">
          ${item('continue', 'Devam Et', !last, last ? `${last.name} · ${last.date}` : 'Kayıtlı oyun yok')}
          ${item('new', 'Yeni Oyun')}
          ${item('load', 'Oyun Yükle', !last)}
          ${item('options', 'Seçenekler')}
          ${IS_TOUCH && !window.electronAPI && !this.g.isStandalone() ? item('fullscreen', this.g.isFullscreen() ? 'Tam Ekrandan Çık' : 'Tam Ekran', false, 'Telefonda tüm ekranı kullan') : ''}
          ${item('credits', 'Krediler')}
          ${item('quit', 'Çıkış')}
        </nav>
      </div>
      ${last ? `<div class="mm-card"><div class="mm-card-t">Son oynanan</div>${last.thumb ? `<img src="${last.thumb}" alt="">` : ''}<b>${last.name}</b><small>${fmtNum(last.pop || 0)} nüfus · ${last.date}</small></div>` : ''}
      <div class="mm-ver">Şehir Kurucu II · sürüm ${VERSION} · ${IS_TOUCH ? 'Mobil' : 'PC'}</div>`, 'main');
    this.root.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => this.mainAct(b.dataset.mm)));
  }
  mainAct(a) {
    this.g.sound('click');
    if (a === 'continue') { const last = this.g.listSaves()[0]; if (last && this.g.load(last.key)) this.hide(); }
    else if (a === 'new') this.showNewGame();
    else if (a === 'load') this.showLoad(() => this.showMain());
    else if (a === 'options') this.showOptions(() => this.showMain());
    else if (a === 'credits') this.showCredits();
    else if (a === 'fullscreen') { this.g.toggleFullscreen(); setTimeout(() => { if (this.g.inMenu) this.showMain(); }, 400); }
    else if (a === 'quit') this.quit();
  }
  quit() {
    if (window.electronAPI?.quit) { window.electronAPI.quit(); return; }
    this.g.ui.confirmBox('Oyundan çıkılsın mı? Kaydedilmemiş ilerleme kaybolur.', () => {
      try { window.close(); } catch { /* yoksay */ }
      this.show('<div class="mm-shade full"></div><div class="mm-bye"><h1>Görüşmek üzere!</h1><p>Oyunu kapatmak için bu sekmeyi kapatabilirsiniz.</p><button class="btn" id="bye-back">Ana menüye dön</button></div>', 'main');
      $('bye-back').onclick = () => this.showMain();
    });
  }

  // ---------------- YENİ OYUN ----------------
  mapThumb(key) {
    if (this.thumbCache[key]) return this.thumbCache[key];
    const m = mapByKey(key); const s = createState(m.seed, 'x', m.key);
    const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); const img = g.createImageData(N, N);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x, o = i * 4; const h = (s.vh[z * (N + 1) + x] + s.vh[(z + 1) * (N + 1) + x + 1]) / 2;
      let r, gg, b;
      if (s.water[i]) { const d = Math.min(1, -h / 8); r = 40 - d * 20; gg = 110 - d * 40; b = 160 - d * 30; }
      else if (h > 45) { r = gg = b = 235; }
      else if (h > 25) { r = 130; gg = 125; b = 115; }
      else { const f = s.res[i] === 2 ? 0.75 : 1; r = (90 + h * 2) * f; gg = (140 + h) * f; b = (70 + h) * f; if (s.res[i] === 1) { r += 30; gg += 10; } }
      if (s.road[i]) { r = gg = b = 60; }
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // başlangıç alanı çerçevesi
    g.strokeStyle = 'rgba(255,230,120,.9)'; g.lineWidth = 1.5; const t0 = Math.floor(10 / 2 - 1.5) * TILE; g.strokeRect(t0 + 0.5, t0 + 0.5, TILE * 3 - 1, TILE * 3 - 1);
    const stats = { water: 0, res: [0, 0, 0, 0, 0], build: 0 };
    for (let i = 0; i < N * N; i++) { if (s.water[i]) stats.water++; else stats.build++; stats.res[s.res[i]]++; }
    return (this.thumbCache[key] = { url: c.toDataURL(), stats });
  }

  showNewGame() {
    this.backFn = () => this.showMain();
    const o = this.newOpts; const m = mapByKey(this.selMap); const th = this.mapThumb(m.key);
    const C = N * N; const bar = (v, col) => `<div class="ng-bar"><div style="width:${Math.min(100, v * 100)}%;background:${col}"></div></div>`;
    const list = MAPS.map((mp) => `<button class="ng-map ${mp.key === m.key ? 'on' : ''}" data-map="${mp.key}"><img src="${this.mapThumb(mp.key).url}" alt=""><div><b>${mp.name}</b><small>${CLIMATES[mp.climate].name}</small></div></button>`).join('');
    const tog = (k, label) => `<label class="ng-tog"><input type="checkbox" data-ng="${k}" ${o[k] ? 'checked' : ''}><span>${label}</span></label>`;
    this.show(`<div class="mm-shade full"></div><div class="ng">
      <div class="ng-head"><button class="btn" data-ngb="back">← Geri</button><h1>Yeni Oyun</h1><span></span></div>
      <div class="ng-body">
        <div class="ng-list"><div class="ng-sub">Harita seçin</div>${list}</div>
        <div class="ng-preview">
          <img class="ng-big" src="${th.url}" alt="${m.name}">
          <div class="ng-info">
            <h2>${m.name}</h2><p>${m.desc}</p>
            <div class="ng-grid">
              <div><span>İklim</span><b>${CLIMATES[m.climate].name}</b></div>
              <div><span>Sıcaklık</span><b>${Math.min(...CLIMATES[m.climate].temps)}° / ${Math.max(...CLIMATES[m.climate].temps)}°C</b></div>
              <div><span>Alan</span><b>${((N * 8) / 1000).toFixed(1)} × ${((N * 8) / 1000).toFixed(1)} km</b></div>
              <div><span>İnşa edilebilir</span><b>%${Math.round((th.stats.build / C) * 100)}</b></div>
            </div>
            <div class="ng-sub">Doğal kaynaklar</div>
            <div class="ng-res"><span>🌾 Verimli toprak</span>${bar(th.stats.res[1] / C * 5, '#c9b04a')}<span>🌲 Orman</span>${bar(th.stats.res[2] / C * 4, '#4f8a35')}<span>🛢️ Petrol</span>${bar(th.stats.res[3] / C * 8, '#555')}<span>⛏️ Cevher</span>${bar(th.stats.res[4] / C * 8, '#8a8a96')}<span>💧 Su</span>${bar(th.stats.water / C * 2, '#3a8fd0')}</div>
            <div class="ng-sub">Dış bağlantılar</div>
            <div class="ng-conn"><span class="on">🛣️ Otoyol</span><span class="on">⚡ Elektrik</span><span class="${m.rail ? 'on' : ''}">🚆 Tren</span><span class="${m.ship ? 'on' : ''}">🚢 Gemi</span><span class="${m.air ? 'on' : ''}">✈️ Uçak</span></div>
          </div>
        </div>
        <div class="ng-opts">
          <div class="ng-sub">Şehir ayarları</div>
          <label class="ng-field"><span>Şehir adı</span><input type="text" id="ng-name" maxlength="32" value="${o.name}"></label>
          <div class="ng-field"><span>Tema</span><div class="seg">${[['eu', 'Avrupa'], ['na', 'Kuzey Amerika']].map(([k, n]) => `<button data-theme="${k}" class="${o.theme === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
          ${tog('leftHand', 'Soldan trafik')}${tog('disasters', 'Doğal afetler')}${tog('unlimited', 'Sınırsız para')}${tog('unlockAll', 'Tüm kilitleri aç')}
          <button class="btn good ng-start" data-ngb="start">Oyunu Başlat</button>
        </div>
      </div></div>`, 'sub');
    this.root.querySelectorAll('[data-map]').forEach((b) => b.addEventListener('click', () => { this.selMap = b.dataset.map; this.newOpts.name = $('ng-name').value; this.showNewGame(); }));
    this.root.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => { o.theme = b.dataset.theme; o.name = $('ng-name').value; this.showNewGame(); }));
    this.root.querySelectorAll('[data-ng]').forEach((c) => c.addEventListener('change', () => { o[c.dataset.ng] = c.checked; }));
    this.root.querySelector('[data-ngb="back"]').onclick = () => this.showMain();
    this.root.querySelector('[data-ngb="start"]').onclick = () => {
      o.name = ($('ng-name').value || 'Yeni Şehir').trim();
      this.hide();
      this.g.startNewGame({ map: m.key, ...o });
    };
  }

  // ---------------- OYUN YÜKLE ----------------
  showLoad(back) {
    this.backFn = back;
    const saves = this.g.listSaves();
    if (!this.selSave || !saves.find((q) => q.key === this.selSave)) this.selSave = saves[0]?.key;
    const sv = saves.find((q) => q.key === this.selSave);
    const list = saves.map((q) => `<button class="ld-item ${q.key === this.selSave ? 'on' : ''}" data-sv="${q.key}"><b>${q.name}</b><small>${q.date}</small></button>`).join('') || '<p class="l">Kayıtlı oyun yok.</p>';
    this.show(`<div class="mm-shade full"></div><div class="ng">
      <div class="ng-head"><button class="btn" data-ldb="back">← Geri</button><h1>Oyun Yükle</h1><span></span></div>
      <div class="ld-body"><div class="ld-list">${list}</div>
        <div class="ld-detail">${sv ? `${sv.thumb ? `<img src="${sv.thumb}" alt="">` : '<div class="ld-nothumb">Önizleme yok</div>'}
          <h2>${sv.name}</h2>
          <div class="ng-grid"><div><span>Nüfus</span><b>${fmtNum(sv.pop || 0)}</b></div><div><span>Para</span><b>${sv.money !== undefined ? fmtMoney(sv.money) : '-'}</b></div><div><span>Harita</span><b>${sv.map ? mapByKey(sv.map).name : '-'}</b></div><div><span>Kilometre taşı</span><b>${sv.ms !== undefined ? MILESTONES[sv.ms].name : '-'}</b></div><div><span>Oyun tarihi</span><b>${sv.gdate || '-'}</b></div><div><span>Kaydedilme</span><b>${sv.date}</b></div></div>
          <div class="row" style="margin-top:14px;gap:8px;justify-content:flex-start"><button class="btn good" data-ldb="load">Yükle</button><button class="btn danger" data-ldb="del">Sil</button></div>` : ''}
        </div></div></div>`, 'sub');
    this.root.querySelectorAll('[data-sv]').forEach((b) => b.addEventListener('click', () => { this.selSave = b.dataset.sv; this.showLoad(back); }));
    this.root.querySelector('[data-ldb="back"]').onclick = () => back();
    const lb = this.root.querySelector('[data-ldb="load"]'); if (lb) lb.onclick = () => { if (this.g.load(this.selSave)) this.hide(); };
    const db = this.root.querySelector('[data-ldb="del"]'); if (db) db.onclick = () => this.g.ui.confirmBox('Bu kayıt kalıcı olarak silinsin mi?', () => { this.g.deleteSave(this.selSave); this.selSave = null; this.showLoad(back); });
  }

  // ---------------- SEÇENEKLER ----------------
  showOptions(back) {
    this.backFn = back;
    const op = options(); const tab = OPTION_TABS.find((q) => q.key === this.optTab) || OPTION_TABS[0];
    const sec = tab.key; const vals = op[sec];
    const rows = tab.rows.map((r) => {
      const v = vals[r.key];
      let ctl = '';
      if (r.t === 'toggle') ctl = `<button class="op-tog ${v ? 'on' : ''}" data-op="${r.key}" data-t="toggle"><i></i></button>`;
      else if (r.t === 'select') ctl = `<div class="op-sel"><button data-op="${r.key}" data-t="prev">‹</button><span>${(r.choices.find((c) => String(c[0]) === String(v)) || r.choices[0])[1]}</span><button data-op="${r.key}" data-t="next">›</button></div>`;
      else if (r.t === 'slider') ctl = `<div class="op-sld"><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}" data-op="${r.key}" data-t="slider"><b>${r.fmt(v)}</b></div>`;
      else if (r.t === 'key') ctl = `<button class="op-key" data-op="${r.key}" data-t="key">${keyLabel(v)}</button>`;
      return `<div class="op-row" data-desc="${(r.desc || '').replace(/"/g, '&quot;')}"><span>${r.label}</span>${ctl}</div>`;
    }).join('');
    this.show(`<div class="mm-shade full"></div><div class="op">
      <div class="ng-head"><button class="btn" data-opb="back">← Geri</button><h1>Seçenekler</h1><span></span></div>
      <div class="op-body"><div class="op-tabs">${OPTION_TABS.map((t) => `<button class="${t.key === sec ? 'on' : ''}" data-tab="${t.key}"><span>${t.icon}</span>${t.name}</button>`).join('')}</div>
        <div class="op-main"><div class="op-rows">${rows}</div><div class="op-desc" id="op-desc">${sec === 'keys' ? 'Bir tuşu değiştirmek için üzerine tıklayın, ardından yeni tuşa basın.' : 'Açıklamayı görmek için bir ayarın üzerine gelin.'}</div></div></div>
      <div class="op-foot"><button class="btn" data-opb="reset">Bu sekmeyi varsayılana sıfırla</button><button class="btn good" data-opb="back">Tamam</button></div></div>`, 'sub');
    const R = this.root;
    R.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.optTab = b.dataset.tab; this.showOptions(back); }));
    R.querySelectorAll('[data-opb="back"]').forEach((b) => (b.onclick = () => back()));
    R.querySelector('[data-opb="reset"]').onclick = () => { resetOptions(sec); this.showOptions(back); };
    R.querySelectorAll('.op-row').forEach((r) => { const show = () => { if (r.dataset.desc) $('op-desc').textContent = r.dataset.desc; }; r.addEventListener('mouseenter', show); r.addEventListener('touchstart', show, { passive: true }); });
    R.querySelectorAll('[data-op]').forEach((el) => {
      const key = el.dataset.op, t = el.dataset.t; const row = tab.rows.find((q) => q.key === key);
      if (t === 'toggle') el.onclick = () => { setOption(sec, key, !options()[sec][key]); this.showOptions(back); };
      else if (t === 'prev' || t === 'next') el.onclick = () => {
        const ch = row.choices.filter((c) => c[0] !== 'custom'); const cur = ch.findIndex((c) => String(c[0]) === String(options()[sec][key]));
        const n = ch[(Math.max(0, cur) + (t === 'next' ? 1 : -1) + ch.length) % ch.length][0];
        setOption(sec, key, n); this.showOptions(back);
      };
      else if (t === 'slider') { el.oninput = () => { el.nextElementSibling.textContent = row.fmt(+el.value); }; el.onchange = () => { setOption(sec, key, +el.value); if (sec === 'graphics') this.showOptions(back); }; }
      else if (t === 'key') el.onclick = () => {
        el.textContent = 'Bir tuşa basın…'; el.classList.add('wait');
        const h = (e) => { e.preventDefault(); e.stopPropagation(); window.removeEventListener('keydown', h, true); if (e.code !== 'Escape') setOption('keys', key, e.code); this.showOptions(back); };
        window.addEventListener('keydown', h, true);
      };
    });
  }

  // ---------------- KREDİLER ----------------
  showCredits() {
    this.backFn = () => this.showMain();
    this.show(`<div class="mm-shade full"></div><div class="ng cr">
      <div class="ng-head"><button class="btn" data-crb="back">← Geri</button><h1>Krediler</h1><span></span></div>
      <div class="cr-body">
        <h2>Şehir Kurucu II</h2>
        <p>Cities: Skylines II'den esinlenerek sıfırdan yazılmış bağımsız bir şehir kurma oyunu. Tüm modeller, sesler ve kod oyuna özgüdür.</p>
        <div class="ng-sub">Geliştirme</div><p>Oyun tasarımı, simülasyon, grafik ve arayüz: Şehir Kurucu II ekibi</p>
        <div class="ng-sub">Kullanılan açık kaynak yazılım</div><p>three.js — MIT Lisansı (© three.js authors)</p>
        <div class="ng-sub">İlham</div><p>Cities: Skylines II — Colossal Order ve Paradox Interactive. Bu proje onlarla bağlantılı değildir.</p>
        <p class="l">Sürüm ${VERSION}</p>
      </div></div>`, 'sub');
    this.root.querySelector('[data-crb="back"]').onclick = () => this.showMain();
  }

  // ---------------- DURAKLATMA MENÜSÜ ----------------
  showPause() {
    this.g.modalPause(true);
    this.backFn = () => { this.hide(); this.g.modalPause(false); };
    const s = this.g.state;
    const item = (k, label) => `<button class="pm-item" data-pm="${k}">${label}</button>`;
    this.show(`<div class="mm-shade"></div><div class="pm">
      <div class="pm-title">${s.cityName}</div><div class="pm-sub">${fmtNum(s.stats.pop || 0)} nüfus · ${MONTHS[s.time.month]} ${s.time.year}</div>
      ${item('resume', 'Devam Et')}${item('save', 'Oyunu Kaydet')}${item('load', 'Oyun Yükle')}${item('options', 'Seçenekler')}${item('export', 'Dosyaya Aktar')}${item('import', 'Dosyadan Yükle')}${item('help', 'Kontroller')}${item('main', 'Ana Menüye Dön')}
    </div>`, 'pause');
    this.root.querySelectorAll('[data-pm]').forEach((b) => b.addEventListener('click', () => this.pauseAct(b.dataset.pm)));
  }
  pauseAct(a) {
    const g = this.g;
    if (a === 'resume') { this.hide(); g.modalPause(false); }
    else if (a === 'save') this.showSave();
    else if (a === 'load') this.showLoad(() => this.showPause());
    else if (a === 'options') this.showOptions(() => this.showPause());
    else if (a === 'export') g.exportFile();
    else if (a === 'import') { this.hide(); g.modalPause(false); g.importFile(); }
    else if (a === 'help') this.showHelp();
    else if (a === 'main') g.ui.confirmBox('Ana menüye dönülsün mü? Kaydedilmemiş ilerleme kaybolur.', () => { g.modalPause(false); g.toMainMenu(); });
  }
  showSave() {
    this.backFn = () => this.showPause();
    const saves = this.g.listSaves().filter((q) => q.key !== 'auto');
    this.show(`<div class="mm-shade"></div><div class="pm wide">
      <div class="pm-title">Oyunu Kaydet</div>
      <div class="row" style="gap:8px"><input type="text" id="sv-name" value="${this.g.state.cityName}" maxlength="40" style="flex:1"><button class="btn good" id="sv-go">Yeni kayıt</button></div>
      <div class="ng-sub">Üzerine yaz</div>
      <div class="sv-list">${saves.map((q) => `<button class="ld-item" data-ow="${q.key}"><b>${q.name}</b><small>${q.date} · ${fmtNum(q.pop || 0)} nüfus</small></button>`).join('') || '<p class="l">Kayıt yok</p>'}</div>
      <button class="pm-item" id="sv-back">Geri</button></div>`, 'pause');
    $('sv-go').onclick = () => { if (this.g.save($('sv-name').value)) { this.g.ui.toast('Kaydedildi', 'good'); this.showPause(); } };
    this.root.querySelectorAll('[data-ow]').forEach((b) => (b.onclick = () => { if (this.g.save(null, b.dataset.ow)) { this.g.ui.toast('Kaydedildi', 'good'); this.showPause(); } }));
    $('sv-back').onclick = () => this.showPause();
  }
  showHelp() {
    this.backFn = () => this.showPause();
    const k = options().keys; const L = keyLabel;
    this.show(`<div class="mm-shade"></div><div class="pm wide help">
      <div class="pm-title">Kontroller</div>
      <div class="ng-sub">Bilgisayar</div>
      <p><span class="kbd">${L(k.panUp)} ${L(k.panLeft)} ${L(k.panDown)} ${L(k.panRight)}</span> kaydır · <span class="kbd">${L(k.rotLeft)} ${L(k.rotRight)}</span> döndür · <span class="kbd">${L(k.tiltUp)} ${L(k.tiltDown)}</span> eğim · <span class="kbd">${L(k.camView || 'KeyV')}</span> kamera görünümü (klasik / alçak açı / sokak / kuşbakışı) · Tekerlek: yakınlaştır · Sağ tık sürükle: döndür ve eğ · Orta tık sürükle: kaydır · Sağ tık: iptal · <span class="kbd">Ctrl+Z</span> yol geri al · <span class="kbd">${L(k.rotBldLeft)} ${L(k.rotBldRight)}</span> binayı döndür · <span class="kbd">${L(k.pause)}</span> duraklat · <span class="kbd">${L(k.speed1)} ${L(k.speed2)} ${L(k.speed3)}</span> hız</p>
      <div class="ng-sub">Dokunmatik</div>
      <p>Tek parmak: kaydır (araç seçiliyken araç kullanılır) · İki parmak: kaydır, sıkıştırarak yakınlaştır, çevirerek döndür, birlikte yukarı/aşağı sürükleyerek eğ (3D perspektif) · Sağ alttaki düğmeler: döndür, eğim ve 🎥 kamera görünümü · Araç seçenekleri panelindeki <b>İptal</b> ve <b>Silgi</b> düğmeleri</p>
      <div class="ng-sub">Yol araçları</div>
      <p><b>Düz</b>: iki nokta · <b>Kavisli</b>: başlangıç, kontrol, bitiş · <b>Sürekli</b>: zincirleme · <b>Izgara</b>: dikdörtgen alana ızgara · <b>Değiştir</b>: mevcut yolu yükselt. Yükseklik ile köprü/üst geçit ya da tünel yapın.</p>
      <button class="pm-item" id="hp-back">Geri</button></div>`, 'pause');
    $('hp-back').onclick = () => this.showPause();
  }
}
