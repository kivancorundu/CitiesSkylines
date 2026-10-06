// Panel içerikleri: bilgi görünümleri, ekonomi, ilerleme, istatistik, politikalar, ilçeler, ulaşım, üretim, yaşam yolu, chirper, bina denetçisi
import { fmtMoney, fmtNum, clamp, idx, N } from '../core/constants.js';
import { ZONES, PRODUCTS, LEVEL_NAMES } from '../data/zones.js';
import { SERVICES, BUDGET_KEYS, SERVICE_TYPES, CATEGORIES } from '../data/services.js';
import { ROADS } from '../data/roads.js';
import { MILESTONES, DEV_TREE, POLICIES, FEATURES } from '../data/progression.js';
import { INFO_VIEWS } from '../render/infoviews.js';
import { INCOME_NAMES, EXPENSE_NAMES, takeLoan, repayLoan } from '../sim/economy.js';
import { canUnlockNode, unlockNode, categoryUnlocked, featureOn, isUnlocked } from '../sim/progression.js';
import { LINE_TYPES, computeLinePath } from '../sim/transit.js';
import { hhCap, jobCap, residents, svcStats } from '../sim/buildings.js';
import { buyUpgrade, bulldozeCell, deleteDistrict } from '../sim/actions.js';
import { followRandomCitizen, EDU } from '../sim/chirper.js';
import { bCov } from '../sim/coverage.js';
import { SEASONS, WEATHER_NAMES } from '../sim/weather.js';

const bar = (v, col) => `<div class="bar"><div style="width:${clamp(v * 100, 0, 100)}%;${col ? 'background:' + col : ''}"></div></div>`;
const row = (l, r) => `<div class="row"><span class="l">${l}</span><span>${r}</span></div>`;
const pct = (v) => Math.round(v * 100) + '%';
const EDU_NAMES = ['Eğitimsiz', 'Az eğitimli', 'Eğitimli', 'İyi eğitimli', 'Yüksek eğitimli'];

export const PANELS = {
  info: {
    title: '📊 Bilgi Görünümleri',
    render(ui) {
      const v = ui.g.renderer.view;
      return `<div class="vlist">${INFO_VIEWS.map((q) => `<button class="vbtn ${v === q.key ? 'on' : ''}" data-view="${q.key}"><span>${q.icon}</span>${q.name}</button>`).join('')}</div>
        <div style="margin-top:10px">${v ? `<button class="btn" data-view="">Görünümü kapat</button>` : ''}</div>${v ? legend(ui, v) : '<p class="l">Bir görünüm seçin. Bilgi görünümleri şehrinizin durumunu harita üzerinde renklerle gösterir.</p>'}`;
    },
    bind(ui, el) { el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { ui.g.renderer.setView(b.dataset.view || null); ui.refreshPanel(); })); },
  },
  econ: {
    title: '💰 Ekonomi',
    render(ui) {
      const s = ui.s; const tab = ui.panelState.econ || 'budget';
      const tabs = [['budget', 'Bütçe'], ['taxes', 'Vergiler'], ['services', 'Hizmet Bütçeleri'], ['fees', 'Hizmet Ücretleri'], ['loans', 'Krediler']];
      let h = `<div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
      if (tab === 'budget') {
        const inc = s.econ.inc || {}, exp = s.econ.exp || {};
        h += `<div class="sec">Gelirler (aylık)</div>${Object.keys(INCOME_NAMES).map((k) => row(INCOME_NAMES[k], `<span class="pos">${fmtMoney(inc[k] || 0)}</span>`)).join('')}${row('<b>Toplam</b>', `<b class="pos">${fmtMoney(s.econ.totalInc || 0)}</b>`)}`;
        h += `<div class="sec">Giderler (aylık)</div>${Object.keys(EXPENSE_NAMES).map((k) => row(EXPENSE_NAMES[k], `<span class="neg">${fmtMoney(exp[k] || 0)}</span>`)).join('')}${row('<b>Toplam</b>', `<b class="neg">${fmtMoney(s.econ.totalExp || 0)}</b>`)}`;
        const net = (s.econ.totalInc || 0) - (s.econ.totalExp || 0);
        h += `<div class="sec">Özet</div>${row('Aylık bakiye', `<b class="${net >= 0 ? 'pos' : 'neg'}">${fmtMoney(net)}</b>`)}${row('Kasa', fmtMoney(s.money))}${row('Kredi borcu', fmtMoney(s.loan))}`;
      } else if (tab === 'taxes') {
        if (!featureOn(s, 'taxes')) return h + `<p class="neg">Vergi kontrolü "${MILESTONES[FEATURES.taxes].name}" kilometre taşında açılır.</p>`;
        h += '<p class="l">Vergiler gelir sağlar ama yüksek vergiler talebi ve mutluluğu düşürür.</p>';
        for (const [k, n] of [['res', 'Konut'], ['com', 'Ticari'], ['ind', 'Sanayi'], ['off', 'Ofis']]) h += `<div class="sec">${n}</div><div class="slider"><input type="range" min="0" max="30" step="1" value="${s.taxes[k]}" data-tax="${k}"><b id="tax-${k}">%${s.taxes[k]}</b></div>`;
      } else if (tab === 'services') {
        if (!featureOn(s, 'budget')) return h + `<p class="neg">Hizmet bütçeleri "${MILESTONES[FEATURES.budget].name}" kilometre taşında açılır.</p>`;
        h += '<p class="l">Bütçe, hizmetlerin verimini ve bakım maliyetini belirler (%50–%150).</p>';
        for (const k in BUDGET_KEYS) h += `<div class="row"><span class="l" style="min-width:130px">${BUDGET_KEYS[k]}</span><div class="slider" style="flex:1"><input type="range" min="50" max="150" step="5" value="${s.budgets[k]}" data-budget="${k}"><b id="bud-${k}">%${s.budgets[k]}</b></div></div>`;
      } else if (tab === 'fees') {
        h += '<p class="l">Hizmet ücretleri gelir sağlar; yüksek ücretler mutluluğu düşürür.</p>';
        const names = { electricity: 'Elektrik', water: 'Su', garbage: 'Çöp', health: 'Sağlık', education: 'Eğitim', transit: 'Toplu Taşıma' };
        for (const k in names) h += `<div class="row"><span class="l" style="min-width:110px">${names[k]}</span><div class="slider" style="flex:1"><input type="range" min="0" max="200" step="10" value="${s.fees[k]}" data-fee="${k}"><b id="fee-${k}">%${s.fees[k]}</b></div></div>`;
      } else if (tab === 'loans') {
        const max = MILESTONES[s.milestone].loan;
        if (!max) return h + `<p class="neg">Krediler "${MILESTONES[1].name}" kilometre taşında açılır.</p>`;
        h += `${row('Kredi limiti', fmtMoney(max))}${row('Mevcut borç', fmtMoney(s.loan))}${row('Faiz', '%5 yıllık')}${row('Aylık faiz', fmtMoney(s.loan * 0.05 / 12))}
          <div class="sec">Kredi al</div><div class="row">${[25000, 100000, 250000].map((a) => `<button class="btn" data-loan="${a}" ${s.loan + a > max ? 'disabled' : ''}>+${fmtMoney(a)}</button>`).join('')}</div>
          <div class="sec">Geri öde</div><div class="row">${[25000, 100000].map((a) => `<button class="btn" data-repay="${a}" ${s.loan <= 0 ? 'disabled' : ''}>-${fmtMoney(a)}</button>`).join('')}<button class="btn" data-repay="all" ${s.loan <= 0 ? 'disabled' : ''}>Tümü</button></div>`;
      }
      return h;
    },
    bind(ui, el) {
      const s = ui.s;
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { ui.panelState.econ = b.dataset.tab; ui.refreshPanel(); }));
      el.querySelectorAll('[data-tax]').forEach((r) => r.addEventListener('input', () => { s.taxes[r.dataset.tax] = +r.value; el.querySelector('#tax-' + r.dataset.tax).textContent = '%' + r.value; }));
      el.querySelectorAll('[data-budget]').forEach((r) => r.addEventListener('input', () => { s.budgets[r.dataset.budget] = +r.value; el.querySelector('#bud-' + r.dataset.budget).textContent = '%' + r.value; s.rt.dirty.cov = true; }));
      el.querySelectorAll('[data-fee]').forEach((r) => r.addEventListener('input', () => { s.fees[r.dataset.fee] = +r.value; el.querySelector('#fee-' + r.dataset.fee).textContent = '%' + r.value; }));
      el.querySelectorAll('[data-loan]').forEach((b) => b.addEventListener('click', () => { takeLoan(s, +b.dataset.loan); ui.refreshPanel(); }));
      el.querySelectorAll('[data-repay]').forEach((b) => b.addEventListener('click', () => { repayLoan(s, b.dataset.repay === 'all' ? s.loan : +b.dataset.repay); ui.refreshPanel(); }));
    },
  },
  prog: {
    title: '🏆 İlerleme',
    render(ui) {
      const s = ui.s; const tab = ui.panelState.prog || 'milestones';
      let h = `<div class="tabs"><button data-tab="milestones" class="${tab === 'milestones' ? 'on' : ''}">Kilometre Taşları</button>${Object.keys(DEV_TREE).map((k) => { const c = CATEGORIES.find((q) => q.key === k); return `<button data-tab="${k}" class="${tab === k ? 'on' : ''}" title="${c.name}">${c.icon}</button>`; }).join('')}</div>`;
      if (tab === 'milestones') {
        h += `${row('Deneyim', fmtNum(s.xp) + ' XP')}${row('Gelişim puanı', '◆ ' + s.devPoints)}`;
        MILESTONES.forEach((m, i) => {
          if (i === 0) return;
          const done = s.milestone >= i, cur = s.milestone + 1 === i;
          h += `<div class="ms-item ${done ? 'done' : ''} ${cur ? 'cur' : ''}"><div class="num">${i}</div><div style="flex:1"><b>${m.name}</b> <small>${fmtNum(m.xp)} XP · ${fmtMoney(m.money)} · ◆${m.dp} · +${m.tiles} karo</small>${cur ? bar((s.xp - MILESTONES[i - 1].xp) / (m.xp - MILESTONES[i - 1].xp)) : ''}<small>${m.unlocks.join(', ')}</small></div></div>`;
        });
      } else {
        const c = CATEGORIES.find((q) => q.key === tab);
        h += `<div class="sec">${c.icon} ${c.name} · ◆ ${s.devPoints}</div>`;
        if (!categoryUnlocked(s, tab)) h += `<p class="neg">Bu hizmet "${MILESTONES[c.unlock].name}" kilometre taşında açılır.</p>`;
        h += '<div class="dev-grid">';
        for (const n of DEV_TREE[tab]) {
          const own = !!s.devNodes[n.id]; const [can, why] = canUnlockNode(s, n.id);
          h += `<div class="node ${own ? 'owned' : ''}"><div><b>${n.name}</b> <span style="color:#ffd36b">◆${n.cost}</span><small>${n.desc}${n.req ? ' · Gerekli: ' + DEV_TREE[tab].find((q) => q.id === n.req).name : ''}</small></div>${own ? '<span class="okc">✔ Açık</span>' : `<button class="btn ${can ? 'good' : ''}" data-node="${n.id}" ${can ? '' : 'disabled'} title="${why}">Aç</button>`}</div>`;
        }
        h += '</div>';
      }
      return h;
    },
    bind(ui, el) {
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { ui.panelState.prog = b.dataset.tab; ui.refreshPanel(); }));
      el.querySelectorAll('[data-node]').forEach((b) => b.addEventListener('click', () => { const r = unlockNode(ui.s, b.dataset.node); ui.toast(r.msg, r.ok ? 'good' : 'bad'); ui.refreshPanel(); if (ui.cat) ui.renderFlyout(); }));
    },
  },
  stats: {
    title: '📈 Şehir İstatistikleri', live: true,
    render(ui) {
      const s = ui.s, st = s.stats;
      const tab = ui.panelState.stats || 'overview';
      let h = `<div class="tabs">${[['overview', 'Genel'], ['charts', 'Grafikler'], ['services', 'Hizmetler'], ['pop', 'Nüfus ve Eğitim']].map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
      if (tab === 'overview') {
        const P = st.power || {}, W = st.water || {}, S = st.sewage || {};
        h += `<div class="sec">Şehir</div>${row('Nüfus', fmtNum(st.pop || 0))}${row('Hane', `${fmtNum(st.households || 0)} / ${fmtNum(st.hhCap || 0)}`)}${row('Mutluluk', pct((st.happiness || 0) / 100))}${row('Ortalama arazi değeri', Math.round(s.rt.avgLv || 0))}
          ${row('Turist / ay', fmtNum(st.tourists || 0))}${row('Çekicilik', st.attractiveness || 0)}${row('Mevsim / Hava', `${SEASONS[s.time.month]} · ${WEATHER_NAMES[s.weather.state]} ${Math.round(s.weather.temp)}°C`)}
          <div class="sec">İş Gücü</div>${row('Çalışan nüfus', fmtNum(st.workers || 0))}${row('İstihdam', fmtNum(st.employed || 0))}${row('İş yeri', fmtNum(st.jobs || 0))}${row('İşsizlik', pct(st.unemployment || 0))}
          <div class="sec">Altyapı</div>${row('Elektrik', `${(P.prod || 0).toFixed(1)} / ${(P.cons || 0).toFixed(1)} MW ${P.imp > 0.05 ? '· ithal ' + P.imp.toFixed(1) : ''}${P.exp > 0.05 ? '· ihraç ' + P.exp.toFixed(1) : ''}`)}${row('Su', `${(W.prod || 0).toFixed(1)} / ${(W.cons || 0).toFixed(1)}`)}${row('Kanalizasyon', `${(S.prod || 0).toFixed(1)} / ${(S.cons || 0).toFixed(1)}`)}
          ${row('Trafik akışı', pct((st.trafficFlow ?? 100) / 100))}${row('Toplu taşıma yolcusu / ay', fmtNum(st.transitRiders || 0))}`;
      } else if (tab === 'charts') {
        h += chart('Nüfus', 'pop', '#5fcf5f') + chart('Kasa', 'money', '#ffd36b') + chart('Gelir / Gider', ['inc', 'exp'], ['#5fd068', '#ff5a4f']) + chart('Mutluluk', 'happy', '#4fb3ff') + chart('İşsizlik', 'unemp', '#ff9f43') + chart('Trafik Akışı', 'traffic', '#b66fe0') + chart('Turist', 'tourists', '#4fd1c5') + chart('Ölüm', 'deaths', '#aaa');
      } else if (tab === 'services') {
        const r = s.rt.ratio || {}; const cap = s.rt.cap || {};
        h += `<div class="sec">Hizmet kapasite oranları</div>`;
        for (const [k, n] of [['garbage', 'Çöp toplama'], ['health', 'Sağlık'], ['police', 'Polis'], ['death', 'Defin']]) h += `<div class="row"><span class="l" style="min-width:110px">${n}</span>${bar(r[k] ?? 0, (r[k] ?? 0) < 0.6 ? 'var(--bad)' : '')}<span style="min-width:40px;text-align:right">${pct(r[k] ?? 0)}</span></div>`;
        h += `<div class="sec">Eğitim kapsamı</div>${['İlkokul', 'Lise', 'Yüksekokul', 'Üniversite'].map((n, i) => `<div class="row"><span class="l" style="min-width:110px">${n}</span>${bar((st.eduCoverage || [])[i] || 0)}<span style="min-width:40px;text-align:right">${pct((st.eduCoverage || [])[i] || 0)}</span></div>`).join('')}`;
        h += `<div class="sec">Durum</div>${row('Hasta oranı', pct(st.sickRate || 0))}${row('Suç oranı', Math.round(st.crimeRate || 0))}${row('Bekleyen cenaze', st.deadWaiting || 0)}${row('Geçen ay ölüm', st.deathsLastMonth || 0)}${row('Çöp üretimi / ay', fmtNum(st.garbageGen || 0))}`;
        void cap;
      } else {
        const tot = s.edu.reduce((a, b) => a + b, 0) || 1;
        h += `<div class="sec">Yaş dağılımı</div>${['Çocuk', 'Genç', 'Yetişkin', 'Yaşlı'].map((n, i) => `<div class="row"><span class="l" style="min-width:90px">${n}</span>${bar(s.ageFrac[i] * 2)}<span style="min-width:60px;text-align:right">${fmtNum((st.pop || 0) * s.ageFrac[i])}</span></div>`).join('')}`;
        h += `<div class="sec">Yetişkin eğitim seviyesi</div>${EDU_NAMES.map((n, i) => `<div class="row"><span class="l" style="min-width:110px">${n}</span>${bar(s.edu[i] / tot, ['#888', '#9ab', '#4fb3ff', '#5fd068', '#ffd36b'][i])}<span style="min-width:60px;text-align:right">${fmtNum(s.edu[i])}</span></div>`).join('')}`;
        h += `<div class="sec">İş doluluğu (eğitim seviyesine göre)</div>${EDU_NAMES.map((n, i) => row(n, pct((st.jobFill || [])[i] ?? 1))).join('')}`;
      }
      return h;
    },
    bind(ui, el) { el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { ui.panelState.stats = b.dataset.tab; ui.refreshPanel(); })); drawCharts(ui, el); },
  },
  policies: {
    title: '📜 Politikalar',
    render(ui) {
      const s = ui.s;
      if (!featureOn(s, 'policies')) return `<p class="neg">Politikalar "${MILESTONES[FEATURES.policies].name}" kilometre taşında açılır.</p>`;
      let h = '<p class="l">Şehir geneli politikalar. İlçe politikaları İlçeler panelinden yönetilir.</p>';
      for (const k in POLICIES) {
        const p = POLICIES[k]; if (p.scope !== 'city') continue;
        const un = s.milestone >= p.unlock;
        h += `<div class="node ${s.policies[k] ? 'owned' : ''}"><div><b>${p.icon} ${p.name}</b><small>${p.desc}${p.costPerPop ? ' · Maliyet: ' + fmtMoney(p.costPerPop * (s.stats.pop || 0)) + '/ay' : p.costFlat ? ' · Maliyet: ' + fmtMoney(p.costFlat) + '/ay' : ''}${un ? '' : ' · 🔒 ' + MILESTONES[p.unlock].name}</small></div><input type="checkbox" data-pol="${k}" ${s.policies[k] ? 'checked' : ''} ${un ? '' : 'disabled'}></div>`;
      }
      return h;
    },
    bind(ui, el) { el.querySelectorAll('[data-pol]').forEach((c) => c.addEventListener('change', () => { ui.s.policies[c.dataset.pol] = c.checked; ui.refreshPanel(); })); },
  },
  districts: {
    title: '🗺️ İlçeler',
    render(ui) {
      const s = ui.s;
      if (!featureOn(s, 'districts')) return `<p class="neg">İlçeler "${MILESTONES[FEATURES.districts].name}" kilometre taşında açılır.</p>`;
      let h = '<p class="l">Alanlar menüsünden (🗺️) yeni ilçe oluşturup haritaya boyayın.</p>';
      if (!s.districts.length) h += '<p>Henüz ilçe yok.</p>';
      for (const d of s.districts) {
        let pop = 0; for (const id in s.buildings) { const b = s.buildings[id]; if (s.district[idx(b.x, b.z)] === d.id) pop += residents(b); }
        h += `<div class="line-item" style="border-color:${d.color}"><div class="row"><b>${d.name}</b><span><button class="btn" data-ren="${d.id}">✏️</button> <button class="btn" data-paint="${d.id}">🖌</button> <button class="btn danger" data-del="${d.id}">🗑</button></span></div>${row('Alan', d.cells + ' hücre')}${row('Nüfus', fmtNum(pop))}`;
        for (const k in POLICIES) { const p = POLICIES[k]; if (p.scope !== 'district') continue; const un = s.milestone >= p.unlock; h += `<div class="row"><span title="${p.desc}">${p.icon} ${p.name}${un ? '' : ' 🔒'}</span><input type="checkbox" data-dp="${d.id}:${k}" ${d.policies[k] ? 'checked' : ''} ${un ? '' : 'disabled'}></div>`; }
        h += '</div>';
      }
      return h;
    },
    bind(ui, el) {
      const s = ui.s;
      el.querySelectorAll('[data-dp]').forEach((c) => c.addEventListener('change', () => { const [id, k] = c.dataset.dp.split(':'); const d = s.districts.find((q) => q.id === +id); d.policies[k] = c.checked; if (c.checked) s.policies[k] = true; else if (!s.districts.some((q) => q.policies[k])) s.policies[k] = false; }));
      el.querySelectorAll('[data-ren]').forEach((b) => b.addEventListener('click', () => { const d = s.districts.find((q) => q.id === +b.dataset.ren); ui.ask('İlçe adı', d.name, (n) => { d.name = n; ui.refreshPanel(); }); }));
      el.querySelectorAll('[data-paint]').forEach((b) => b.addEventListener('click', () => { ui.selectCategory('areas'); ui.g.tools.set({ type: 'district', id: +b.dataset.paint }); }));
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { ui.confirmBox('İlçe silinsin mi? Politikaları da kaldırılır.', () => { deleteDistrict(s, +b.dataset.del); ui.refreshPanel(); }); }));
    },
  },
  transit: {
    title: '🚌 Ulaşım Genel Bakış', live: false,
    render(ui) {
      const s = ui.s;
      let h = `${row('Toplam yolcu / ay', fmtNum(s.stats.transitRiders || 0))}${row('Toplu taşıma payı', pct(s.rt.transitShare || 0))}${row('Bilet geliri / ay', fmtMoney(s.rt.transitRevenue || 0))}${row('Araç bakımı / ay', fmtMoney(s.rt.transitUpkeep || 0))}${row('Trafik akışı', pct((s.stats.trafficFlow ?? 100) / 100))}`;
      h += '<p class="l">Ulaşım menüsünden yeni hat oluşturun. Hatların çalışması için ilgili garaj/depo gereklidir.</p>';
      for (const l of s.lines) {
        const T = LINE_TYPES[l.type];
        h += `<div class="line-item" style="border-color:${l.color}"><div class="row"><b>${T.icon} ${l.name}</b><span><input type="color" value="${l.color}" data-col="${l.id}" style="width:28px;height:22px;border:none;background:none"> <button class="btn" data-ren="${l.id}">✏️</button> <button class="btn danger" data-del="${l.id}">🗑</button></span></div>
          ${row('Durak', l.stops.length)}${row('Uzunluk', (l.path.length * 8 / 1000).toFixed(1) + ' km')}${row('Yolcu / ay', fmtNum(l.riders || 0))}
          <div class="row"><span class="l">Araç sayısı</span><span><button class="btn" data-veh="${l.id}:-1">−</button> <b>${l.vehicles}</b> <button class="btn" data-veh="${l.id}:1">+</button></span></div>
          <div class="row"><span class="l">Durum</span><span>${l.valid ? '<span class="okc">Çalışıyor</span>' : `<span class="problem">${l.problem || 'Geçersiz'}</span>`}</span></div>
          <div class="row"><span></span><button class="btn" data-ext="${l.id}">➕ Durak ekle</button></div></div>`;
      }
      return h;
    },
    bind(ui, el) {
      const s = ui.s;
      el.querySelectorAll('[data-veh]').forEach((b) => b.addEventListener('click', () => { const [id, d] = b.dataset.veh.split(':'); const l = s.lines.find((q) => q.id === +id); l.vehicles = clamp(l.vehicles + +d, 1, 30); ui.refreshPanel(); }));
      el.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { s.lines = s.lines.filter((q) => q.id !== +b.dataset.del); ui.refreshPanel(); }));
      el.querySelectorAll('[data-ren]').forEach((b) => b.addEventListener('click', () => { const l = s.lines.find((q) => q.id === +b.dataset.ren); ui.ask('Hat adı', l.name, (n) => { l.name = n; ui.refreshPanel(); }); }));
      el.querySelectorAll('[data-col]').forEach((c) => c.addEventListener('change', () => { const l = s.lines.find((q) => q.id === +c.dataset.col); l.color = c.value; }));
      el.querySelectorAll('[data-ext]').forEach((b) => b.addEventListener('click', () => { const l = s.lines.find((q) => q.id === +b.dataset.ext); ui.g.tools.set({ type: 'line', lineType: l.type, lineId: l.id }); }));
    },
  },
  prod: {
    title: '🏭 Üretim ve Ticaret', live: true,
    render(ui) {
      const s = ui.s;
      if (!featureOn(s, 'production')) return `<p class="neg">Üretim paneli "${MILESTONES[FEATURES.production].name}" kilometre taşında açılır.</p>`;
      let h = '<p class="l">Şirketlerin aylık üretimi ve tüketimi. Fazlası ihraç edilir, eksik ithal edilir.</p><table><tr><th>Ürün</th><th class="n">Üretim</th><th class="n">Tüketim</th><th class="n">İhracat</th><th class="n">İthalat</th></tr>';
      for (const k in PRODUCTS) { const r = s.resources[k] || { prod: 0, cons: 0, exp: 0, imp: 0 }; h += `<tr><td>${PRODUCTS[k].icon} ${PRODUCTS[k].name}</td><td class="n">${fmtNum(r.prod)}</td><td class="n">${fmtNum(r.cons)}</td><td class="n pos">${fmtNum(r.exp)}</td><td class="n neg">${fmtNum(r.imp)}</td></tr>`; }
      h += `</table><div class="sec">Ticaret</div>${row('Ticaret bonusu (liman/havalimanı/kargo)', pct(s.rt.tradeBonus || 0))}${row('Müşteri oranı (ticari)', pct(Math.min(2, s.rt.customerRatio || 0)))}`;
      return h;
    },
  },
  life: {
    title: '👤 Yaşam Yolu',
    render(ui) {
      const s = ui.s;
      let h = '<p class="l">Vatandaşları takip edin ve hayatlarındaki olayları izleyin.</p><button class="btn good" id="follow">➕ Rastgele bir vatandaşı takip et</button>';
      for (const c of s.tracked.slice().reverse()) {
        const home = s.buildings[c.home]; const job = c.job ? s.buildings[c.job] : null;
        h += `<div class="line-item" style="border-color:${c.alive ? '#4fb3ff' : '#666'}"><div class="row"><b>${c.alive ? '🧑' : '🕊️'} ${c.name}</b><span class="l">${c.age} yaş</span></div>${row('Eğitim', EDU[c.edu])}${row('Ev', home ? home.name : '-')}${row('İş', job ? job.name : 'İşsiz')}${row('Mutluluk', Math.round(c.happy || 0) + '%')}
          <div style="max-height:120px;overflow:auto;font-size:11.5px;margin-top:4px">${c.log.slice().reverse().map((e) => `<div><span class="l">${e.d}:</span> ${e.t}</div>`).join('')}</div></div>`;
      }
      return h;
    },
    bind(ui, el) { el.querySelector('#follow').addEventListener('click', () => { const c = followRandomCitizen(ui.s); if (!c) ui.toast('Şehirde henüz vatandaş yok', 'bad'); ui.refreshPanel(); }); },
  },
  chirper: {
    title: '🐦 Chirper', live: true,
    render(ui) {
      const s = ui.s; s.rt.newChirp = false;
      return s.chirps.map((c) => `<div class="chirp"><div class="who">${c.name} <small>${c.handle}</small></div><div class="tx">${c.text}</div><div class="meta">${c.date} · ❤️ ${c.likes}</div></div>`).join('') || '<p class="l">Henüz chirp yok.</p>';
    },
  },
};

function legend(ui, v) {
  const items = {
    electricity: [['#50c060', 'Elektrikli'], ['#e03030', 'Elektriksiz'], ['#3060e0', 'Santral'], ['#ffdc28', 'Hat']],
    water: [['#50c060', 'Su var'], ['#e03030', 'Su yok'], ['#a07030', 'Kirli su'], ['#2896ff', 'Su borusu']],
    sewage: [['#50c060', 'Bağlı'], ['#e03030', 'Bağlı değil'], ['#966432', 'Kanalizasyon borusu']],
    happiness: [['#3cbe46', 'Mutlu'], ['#f0c828', 'Normal'], ['#dc3228', 'Mutsuz']],
    traffic: [['#3cc850', 'Akıcı'], ['#f0d228', 'Yoğun'], ['#e6321e', 'Sıkışık']],
    level: [['#a0a0a0', '1'], ['#60b0e0', '2'], ['#50c060', '3'], ['#e0c040', '4'], ['#e05030', '5']],
    resources: [['#bf9e40', 'Verimli toprak'], ['#2e7329', 'Orman'], ['#1a1a1a', 'Petrol'], ['#8c8ca6', 'Cevher']],
  }[v];
  const st = ui.s.stats; let extra = '';
  if (v === 'electricity') { const P = st.power || {}; extra = row('Üretim / Tüketim', `${(P.prod || 0).toFixed(1)} / ${(P.cons || 0).toFixed(1)} MW`) + row('İthalat / İhracat', `${(P.imp || 0).toFixed(1)} / ${(P.exp || 0).toFixed(1)} MW`) + row('Elektriksiz bina', P.unserved || 0); }
  if (v === 'water') { const W = st.water || {}; extra = row('Kapasite / Tüketim', `${(W.prod || 0).toFixed(1)} / ${(W.cons || 0).toFixed(1)}`) + row('Susuz bina', W.unserved || 0); }
  if (v === 'sewage') { const S = st.sewage || {}; extra = row('Kapasite / Atık su', `${(S.prod || 0).toFixed(1)} / ${(S.cons || 0).toFixed(1)}`) + row('Bağlı olmayan', S.unserved || 0); }
  if (v === 'traffic') extra = row('Trafik akışı', pct((st.trafficFlow ?? 100) / 100));
  return `<div class="sec">Açıklama</div>${items ? `<div class="legend">${items.map(([c, n]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>` : '<p class="l">Renk yoğunluğu değeri gösterir.</p>'}${extra}`;
}

function chart(title, key, color) {
  const keys = Array.isArray(key) ? key : [key]; const cols = Array.isArray(color) ? color : [color];
  return `<div class="sec">${title}</div><canvas class="chart" data-keys="${keys.join(',')}" data-cols="${cols.join(',')}" width="370" height="120"></canvas>`;
}
function drawCharts(ui, el) {
  const H = ui.s.history.slice(-120);
  el.querySelectorAll('canvas.chart').forEach((cv) => {
    const g = cv.getContext('2d'); const W = cv.width, Ht = cv.height;
    g.clearRect(0, 0, W, Ht);
    const keys = cv.dataset.keys.split(','), cols = cv.dataset.cols.split(',');
    if (H.length < 2) { g.fillStyle = '#789'; g.font = '12px sans-serif'; g.fillText('Veri birikiyor…', 10, 20); return; }
    let mn = Infinity, mx = -Infinity;
    for (const k of keys) for (const h of H) { const v = h[k]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx === mn) { mx += 1; mn -= 1; }
    g.strokeStyle = 'rgba(255,255,255,.08)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, (Ht * i) / 4); g.lineTo(W, (Ht * i) / 4); g.stroke(); }
    keys.forEach((k, ki) => {
      g.strokeStyle = cols[ki]; g.lineWidth = 2; g.beginPath();
      H.forEach((h, i) => { const x = (i / (H.length - 1)) * (W - 4) + 2, y = Ht - 14 - ((h[k] - mn) / (mx - mn)) * (Ht - 24); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    });
    g.fillStyle = '#9fb0c4'; g.font = '10px sans-serif';
    const f = (v) => (Math.abs(v) >= 1000 ? fmtNum(v) : (+v).toFixed(Math.abs(v) < 2 ? 2 : 0));
    g.fillText(f(mx), 4, 10); g.fillText(f(mn), 4, Ht - 3); g.fillText(H[0].label, W - 120, Ht - 3); g.fillText(H[H.length - 1].label, W - 40, Ht - 3);
  });
}

// ---------------- Bina denetçisi ----------------
export function inspectorHTML(ui, b) {
  const s = ui.s; const i = idx(b.x, b.z);
  const isZone = b.kind === 'zone'; const d = isZone ? ZONES[b.type] : SERVICES[b.type];
  let h = `<div class="ph"><h2>${isZone ? '' : d.icon + ' '}${b.name}</h2><button class="x">✕</button></div>`;
  h += `<div class="l" style="margin-bottom:6px">${isZone ? d.name : CATEGORIES.find((c) => c.key === d.cat)?.name || ''}${isZone ? ' · ' + LEVEL_NAMES[b.level] : ''}</div>`;
  let status = '<span class="okc">Faal</span>';
  if (b.built < 1) status = `İnşa ediliyor (${Math.round(b.built * 100)}%)`;
  else if (b.collapsed) status = '<span class="neg">Yıkılmış</span>';
  else if (b.abandoned) status = '<span class="neg">Terk edilmiş</span>';
  else if (b.fire) status = '<span class="neg">🔥 Yanıyor!</span>';
  h += row('Durum', status);
  if (b.probWhy && !b.abandoned) h += `<div class="problem">⚠️ ${b.probWhy}</div>`;
  if (isZone) {
    if (b.level < 5) h += `<div class="row"><span class="l">Seviye ilerlemesi</span>${bar(b.lvlProg)}</div>`;
    const hc = hhCap(b), jc = jobCap(b);
    if (hc) h += row('Hane', `${b.hh} / ${hc}`) + row('Sakin', fmtNum(residents(b)));
    if (jc) h += row('Çalışan', `${b.emp || 0} / ${jc}`) + `<div class="row"><span class="l">Personel</span>${bar(b.staffing || 0)}</div>`;
    if (b.product) h += row('Ürün', PRODUCTS[b.product]?.name || b.product);
    if (b.resLeft !== undefined) h += `<div class="row"><span class="l">Kalan kaynak</span>${bar(b.resLeft, b.resLeft < 0.2 ? 'var(--bad)' : '')}</div>`;
    h += `<div class="row"><span class="l">Mutluluk</span>${bar((b.happy || 0) / 100, b.happy < 40 ? 'var(--bad)' : b.happy > 65 ? 'var(--good)' : 'var(--warn)')}<span>${Math.round(b.happy || 0)}</span></div>`;
  } else {
    const st = svcStats(b);
    h += `<div class="row"><span class="l">Verim</span>${bar(Math.min(1, b.eff ?? 1))}<span>${pct(b.eff ?? 1)}</span></div>`;
    if (d.workers) h += row('Çalışan', `${b.emp || 0} / ${jobCap(b)}`);
    h += row('Bakım', fmtMoney(d.upkeep) + '/ay');
    if (st) h += row(SERVICE_TYPES[st.type] + ' kapasitesi', `${fmtNum(b.load || 0)} / ${fmtNum(st.cap)}`) + row('Menzil', st.radius * 8 + ' m');
    if (d.prod?.power) h += row('Elektrik üretimi', `${(b._out || 0).toFixed(1)} MW`);
    if (d.prod?.water) h += row('Su üretimi', `${(b._out || 0).toFixed(1)}`) + (d.place === 'shore' && b._waterCell >= 0 ? row('Su kirliliği', pct(Math.min(1, s.polW[b._waterCell]))) : '') + (d.place === 'shore' && !(b._waterCell >= 0) ? '<div class="problem">Suya erişim yok!</div>' : '');
    if (d.prod?.sewage) h += row('Atık su kapasitesi', `${(b._out || 0).toFixed(1)}`);
    if (d.prod?.battery) h += row('Depolanan enerji', `${(s.battery[b.id] || 0).toFixed(1)} / ${d.prod.battery} MWh`);
    if (d.storage) h += `<div class="row"><span class="l">Doluluk</span>${bar((b.stored || 0) / d.storage, (b.stored || 0) >= d.storage ? 'var(--bad)' : '')}<span>${fmtNum(b.stored || 0)} / ${fmtNum(d.storage)}</span></div>`;
    if (d.attract) h += row('Çekicilik', '+' + d.attract);
    if (d.depot) h += row('Depo türü', LINE_TYPES[d.depot]?.name || 'Taksi');
    if (d.upgrades && d.upgrades.length) {
      h += '<div class="sec">Eklentiler</div>';
      for (const u of d.upgrades) { const own = b.upgrades.includes(u.key); h += `<div class="row"><span>${u.name}<br><small class="l">${u.cap ? '+' + fmtNum(u.cap) + ' kapasite ' : ''}${u.radius ? '+' + u.radius * 8 + ' m menzil ' : ''}· ${fmtMoney(u.upkeep)}/ay</small></span>${own ? '<span class="okc">✔</span>' : `<button class="btn good" data-upg="${u.key}">${fmtMoney(u.cost)}</button>`}</div>`; }
    }
  }
  h += '<div class="sec">Altyapı</div>';
  h += row('Elektrik', b.power ? '<span class="okc">✔</span>' : '<span class="neg">✖</span>') + row('Su', b.water ? ((b.waterPol || 0) > 0.15 ? '<span class="neg">Kirli</span>' : '<span class="okc">✔</span>') : '<span class="neg">✖</span>') + row('Kanalizasyon', b.sewage ? '<span class="okc">✔</span>' : '<span class="neg">✖</span>') + row('Yol bağlantısı', b.connected ? '<span class="okc">✔</span>' : '<span class="neg">✖ Dış bağlantıya ulaşamıyor</span>');
  if (isZone || residents(b) > 0) {
    h += '<div class="sec">Hizmet kapsamı</div>';
    for (const [t, n] of [['health', 'Sağlık'], ['police', 'Polis'], ['fire', 'İtfaiye'], ['garbage', 'Çöp'], ['death', 'Defin'], ['edu1', 'İlkokul'], ['edu2', 'Lise'], ['park', 'Park'], ['telecom', 'Telekom'], ['post', 'Posta'], ['transit', 'Toplu Taşıma']]) h += `<div class="row"><span class="l" style="min-width:80px">${n}</span>${bar(Math.min(1, bCov(s, b, t)))}</div>`;
    h += '<div class="sec">Çevre</div>' + row('Arazi değeri', Math.round(s.lv[i])) + row('Toprak / Hava / Gürültü', `${pct(s.polG[i])} / ${pct(s.polA[i])} / ${pct(s.polN[i])}`) + row('Suç', Math.round(b.crime || 0)) + row('Çöp', Math.round(b.garbage || 0)) + row('Hastalık', pct(b.sick || 0));
  }
  if (s.district[i]) { const dd = s.districts.find((q) => q.id === s.district[i]); if (dd) h += row('İlçe', dd.name); }
  h += `<div class="row" style="margin-top:10px"><button class="btn danger" data-bull>🚜 Yık</button>${residents(b) > 0 ? '<button class="btn" data-follow>👤 Bir sakini takip et</button>' : ''}</div>`;
  return h;
}

export function bindInspector(ui, el, b) {
  el.querySelector('.x').addEventListener('click', () => ui.inspect(null));
  el.querySelector('[data-bull]')?.addEventListener('click', () => { bulldozeCell(ui.s, b.x, b.z, 'building'); ui.inspect(null); ui.g.sound('bulldoze'); });
  el.querySelectorAll('[data-upg]').forEach((x) => x.addEventListener('click', () => { const r = buyUpgrade(ui.s, b, x.dataset.upg); if (!r.ok) ui.toast(r.msg || 'Olmadı', 'bad'); ui.renderInspector(b); }));
  el.querySelector('[data-follow]')?.addEventListener('click', () => {
    const c = followRandomCitizen(ui.s); if (c) { c.home = b.id; c.log[0].t = `${b.name} adresinde yaşıyor.`; ui.openPanel('life'); }
  });
}

export function roadInspectorHTML(ui, i) {
  const s = ui.s; const r = ROADS[s.road[i]];
  const up = []; if (s.roadUp[i] & 1) up.push('Ağaçlar'); if (s.roadUp[i] & 2) up.push('Çim'); if (s.roadUp[i] & 4) up.push('Hız tümseği');
  return `<div class="ph"><h2>${r.icon} ${r.name}</h2><button class="x">✕</button></div>${row('Hız sınırı', r.speed + ' km/sa')}${row('Kapasite', r.cap)}${row('Trafik', Math.round(s.traffic[i]))}<div class="row"><span class="l">Yoğunluk</span>${bar(s.traffic[i] / r.cap, s.traffic[i] / r.cap > 0.9 ? 'var(--bad)' : '')}</div>${row('Bakım', fmtMoney(r.upkeep) + '/ay')}${row('Yükseltmeler', up.join(', ') || '-')}${row('Su borusu', s.pipeW[i] ? '✔' : '✖')}${row('Kanalizasyon', s.pipeS[i] ? '✔' : '✖')}${s.rail[i] === 2 ? row('Tramvay rayı', '✔') : ''}${row('Gürültü', pct(s.polN[i]))}`;
}

export { isUnlocked, computeLinePath, N };
