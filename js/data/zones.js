// İmar bölgeleri (CS2: Bölgeleme menüsü)
// lot: [minW,maxW,minD,maxD] ; hh: hücre başına hane ; jobs: hücre başına iş ; floors: [min,max]
// res: özel sanayi için gerekli doğal kaynak
export const ZONES = {
  1: { key: 'res_low', group: 'R', name: 'Düşük Yoğunluklu Konut', desc: 'Müstakil aile evleri. Her parselde tek hane.', color: '#5fcf5f', lot: [1, 2, 2, 3], hhFixed: 1, hhSize: 3.1, floors: [1, 2], style: 'house', unlock: 0, density: 0 },
  2: { key: 'res_row', group: 'R', name: 'Orta Yoğunluklu Sıra Evler', desc: 'Bitişik nizam sıra evler.', color: '#4cb84c', lot: [1, 1, 2, 3], hh: 0.9, hhSize: 2.8, floors: [2, 3], style: 'row', unlock: 2, density: 1 },
  3: { key: 'res_med', group: 'R', name: 'Orta Yoğunluklu Konut', desc: 'Apartmanlar.', color: '#3aa53a', lot: [2, 3, 2, 3], hh: 2.2, hhSize: 2.4, floors: [3, 5], style: 'apartment', unlock: 2, density: 1 },
  4: { key: 'res_lowrent', group: 'R', name: 'Düşük Kiralı Konut', desc: 'Düşük arazi değerinde uygun fiyatlı konut.', color: '#7ca33a', lot: [2, 3, 2, 3], hh: 2.6, hhSize: 2.6, floors: [4, 6], style: 'lowrent', unlock: 4, density: 1 },
  5: { key: 'res_mixed', group: 'R', name: 'Karma Konut', desc: 'Zemin katta dükkânlar, üst katlarda daireler.', color: '#2fa58a', lot: [2, 3, 2, 3], hh: 1.6, hhSize: 2.2, jobs: 1.2, floors: [3, 5], style: 'mixed', unlock: 5, density: 1 },
  6: { key: 'res_high', group: 'R', name: 'Yüksek Yoğunluklu Konut', desc: 'Yüksek apartman kuleleri.', color: '#1f8a1f', lot: [2, 3, 2, 4], hh: 6, hhSize: 2.0, floors: [9, 24], style: 'tower', unlock: 8, density: 2 },
  7: { key: 'com_low', group: 'C', name: 'Düşük Yoğunluklu Ticari', desc: 'Küçük dükkânlar, restoranlar.', color: '#4f8fe6', lot: [1, 2, 2, 3], jobs: 2.2, floors: [1, 2], style: 'shop', unlock: 0, density: 0 },
  8: { key: 'com_high', group: 'C', name: 'Yüksek Yoğunluklu Ticari', desc: 'Alışveriş merkezleri ve büyük mağazalar.', color: '#2c6fd0', lot: [2, 3, 2, 4], jobs: 6, floors: [4, 12], style: 'mall', unlock: 9, density: 2 },
  9: { key: 'ind', group: 'I', name: 'Sanayi', desc: 'Fabrikalar ve depolar. Mal üretir, kirlilik yaratır.', color: '#e6c34f', lot: [2, 3, 2, 4], jobs: 2.8, floors: [1, 2], style: 'factory', unlock: 0, density: 0 },
  10: { key: 'off_low', group: 'O', name: 'Düşük Yoğunluklu Ofis', desc: 'Küçük ofis binaları. Eğitimli işçi ister.', color: '#b66fe0', lot: [1, 2, 2, 3], jobs: 3.5, floors: [3, 5], style: 'office', unlock: 4, density: 1 },
  11: { key: 'off_high', group: 'O', name: 'Yüksek Yoğunluklu Ofis', desc: 'Gökdelen ofisler. Yüksek eğitimli işçi ister.', color: '#9440c8', lot: [2, 3, 2, 3], jobs: 11, floors: [10, 32], style: 'skyscraper', unlock: 10, density: 2 },
  12: { key: 'agri', group: 'I', special: true, name: 'Tarım (Özel Sanayi)', desc: 'Verimli toprakta tahıl, sebze ve hayvancılık.', color: '#c9b04a', lot: [2, 4, 3, 4], jobs: 0.7, floors: [1, 1], style: 'farm', unlock: 3, res: 1, product: 'grain', density: 0 },
  13: { key: 'forest', group: 'I', special: true, name: 'Ormancılık (Özel Sanayi)', desc: 'Ormanlık alanda kereste üretimi.', color: '#6a8d3a', lot: [2, 3, 2, 4], jobs: 0.8, floors: [1, 1], style: 'forestry', unlock: 4, res: 2, product: 'wood', density: 0 },
  14: { key: 'oil', group: 'I', special: true, name: 'Petrol (Özel Sanayi)', desc: 'Petrol yataklarında sondaj.', color: '#40403a', lot: [2, 3, 2, 3], jobs: 1.0, floors: [1, 1], style: 'oil', unlock: 8, res: 3, product: 'oil', density: 0 },
  15: { key: 'ore', group: 'I', special: true, name: 'Madencilik (Özel Sanayi)', desc: 'Cevher, kömür ve taş madenciliği.', color: '#8a8a96', lot: [2, 3, 2, 3], jobs: 1.0, floors: [1, 1], style: 'mine', unlock: 5, res: 4, product: 'ore', density: 0 },
};

export const ZONE_GROUP_NAMES = { R: 'Konut', C: 'Ticari', I: 'Sanayi', O: 'Ofis' };
export const RES_ZONES = [1, 2, 3, 4, 5, 6];
export const COM_ZONES = [7, 8];
export const IND_ZONES = [9, 12, 13, 14, 15];
export const OFF_ZONES = [10, 11];

// Seviye isimleri
export const LEVEL_NAMES = ['', 'Seviye 1', 'Seviye 2', 'Seviye 3', 'Seviye 4', 'Seviye 5'];

// İş yerlerinin eğitim gereksinimi dağılımı [eğitimsiz, az eğitimli, eğitimli, iyi eğitimli, yüksek eğitimli]
export const JOB_EDU = {
  R: [0.4, 0.4, 0.15, 0.05, 0],
  C: [0.35, 0.4, 0.18, 0.07, 0],
  I: [0.45, 0.33, 0.15, 0.06, 0.01],
  O: [0, 0.1, 0.3, 0.4, 0.2],
  S: [0.1, 0.25, 0.3, 0.22, 0.13],
};

// Doğal kaynaklar
export const RESOURCES = {
  1: { key: 'fertile', name: 'Verimli Toprak', color: [0.75, 0.62, 0.25] },
  2: { key: 'forest', name: 'Orman', color: [0.18, 0.45, 0.16] },
  3: { key: 'oil', name: 'Petrol', color: [0.1, 0.1, 0.1] },
  4: { key: 'ore', name: 'Cevher', color: [0.55, 0.55, 0.65] },
};

// Ürünler (Üretim paneli)
export const PRODUCTS = {
  grain: { name: 'Tarım Ürünleri', icon: '🌾', raw: true },
  wood: { name: 'Kereste', icon: '🪵', raw: true },
  oil: { name: 'Ham Petrol', icon: '🛢️', raw: true },
  ore: { name: 'Cevher / Kömür / Taş', icon: '⛏️', raw: true },
  food: { name: 'Gıda', icon: '🥫', from: 'grain' },
  goods: { name: 'Mamul Mallar', icon: '📦', from: null },
  paper: { name: 'Kâğıt ve Mobilya', icon: '🪑', from: 'wood' },
  plastics: { name: 'Plastik ve Kimya', icon: '🧪', from: 'oil' },
  metals: { name: 'Metal ve Makine', icon: '⚙️', from: 'ore' },
  software: { name: 'Yazılım ve Hizmetler', icon: '💾', office: true },
};
