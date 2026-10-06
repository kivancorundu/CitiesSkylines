// Yol türleri (CS2: Yollar menüsü)
// speed km/sa, capacity: araç/ay ölçeği, cost: hücre başına, upkeep: hücre başına aylık
export const ROADS = {
  1: { key: 'small', name: 'Küçük Yol', desc: 'İki şeritli, mahalle yolu.', icon: '🛣️', speed: 40, cap: 700, cost: 120, upkeep: 2, noise: 0.25, zonable: true, color: 0x46484c, mark: 0xf2f2f2, lanes: 2, unlock: 0 },
  2: { key: 'gravel', name: 'Toprak Yol', desc: 'Ucuz ama yavaş. Kırsal alanlar için.', icon: '🟫', speed: 25, cap: 300, cost: 40, upkeep: 0.5, noise: 0.1, zonable: true, color: 0x8a7656, mark: null, lanes: 2, unlock: 0 },
  3: { key: 'medium', name: 'Orta Yol', desc: 'Dört şeritli ana yol.', icon: '🛣️', speed: 50, cap: 1500, cost: 230, upkeep: 4, noise: 0.45, zonable: true, color: 0x3c3e42, mark: 0xffffff, lanes: 4, unlock: 0 },
  4: { key: 'large', name: 'Büyük Yol (Bulvar)', desc: 'Orta refüjlü altı şeritli bulvar.', icon: '🛣️', speed: 60, cap: 2600, cost: 380, upkeep: 7, noise: 0.7, zonable: true, color: 0x36383c, mark: 0xffd34d, lanes: 6, unlock: 2 },
  5: { key: 'buslane', name: 'Toplu Taşıma Şeritli Yol', desc: 'Otobüs ve taksilere ayrılmış şeritli orta yol. Otobüsler daha hızlı.', icon: '🚌', speed: 50, cap: 1200, cost: 280, upkeep: 5, noise: 0.45, zonable: true, color: 0x3c3e42, mark: 0xd04040, lanes: 4, unlock: 4 },
  6: { key: 'highway', name: 'Otoyol', desc: 'Yüksek hızlı, kavşaksız bağlantı. Kenarına imar yapılamaz.', icon: '🛤️', speed: 100, cap: 4000, cost: 600, upkeep: 10, noise: 1.0, zonable: false, color: 0x2f3134, mark: 0xffffff, lanes: 6, unlock: 5 },
  7: { key: 'pedestrian', name: 'Yaya Yolu', desc: 'Sadece yayalar ve hizmet araçları. Arazi değerini artırır.', icon: '🚶', speed: 10, cap: 50, cost: 150, upkeep: 2, noise: 0.0, zonable: true, color: 0xb9ab95, mark: null, lanes: 0, unlock: 4 },
};

export const ROAD_UPGRADES = {
  1: { key: 'trees', name: 'Ağaçlar', desc: 'Yol kenarına ağaç: gürültü ve hava kirliliği azalır, arazi değeri artar.', icon: '🌳', cost: 30, upkeep: 0.3 },
  2: { key: 'grass', name: 'Çim Şerit', desc: 'Çimenli şerit: küçük arazi değeri artışı.', icon: '🌱', cost: 15, upkeep: 0.1 },
  4: { key: 'bump', name: 'Hız Tümseği', desc: 'Gürültüyü ve hızı azaltır.', icon: '〰️', cost: 10, upkeep: 0 },
};

export const NETWORKS = {
  pipeW: { name: 'Su Borusu', desc: 'Temiz suyu binalara taşır. Yolların altından çekin.', icon: '💧', cost: 30, upkeep: 0.3, unlock: 0 },
  pipeS: { name: 'Kanalizasyon Borusu', desc: 'Atık suyu arıtma/çıkış tesisine taşır.', icon: '🟤', cost: 30, upkeep: 0.3, unlock: 0 },
  power: { name: 'Yüksek Gerilim Hattı', desc: 'Elektriği yollar dışında taşır. Yollar alçak gerilim hattı içerir.', icon: '🗼', cost: 60, upkeep: 0.6, unlock: 0 },
  train: { name: 'Tren Rayı', desc: 'Yolcu ve kargo trenleri için ray.', icon: '🛤️', cost: 180, upkeep: 3, unlock: 'n_train' },
  tram: { name: 'Tramvay Rayı', desc: 'Mevcut yolların üzerine tramvay rayı döşer.', icon: '🚋', cost: 100, upkeep: 2, unlock: 'n_tram' },
  metro: { name: 'Metro Tüneli', desc: 'Yeraltı metro tüneli.', icon: '🚇', cost: 250, upkeep: 4, unlock: 'n_metro' },
};
