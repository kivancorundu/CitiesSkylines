// Hizmet binaları (CS2: Şehir Hizmetleri)
// unlock: sayı => kilometre taşı, 'n_...' => gelişim ağacı düğümü
// svc: { type, radius (hücre), cap (kapasite), str (güç) }
// prod: { power (MW), water, sewage, garbage (aylık işleme), battery (MWh) }
// pol: { air, ground, noise } kirlilik yayımı ; attract: turizm çekiciliği ; leisure: eğlence
export const CATEGORIES = [
  { key: 'roads', name: 'Yollar', icon: '🛣️', unlock: 0 },
  { key: 'zoning', name: 'Bölgeleme', icon: '🏘️', unlock: 0 },
  { key: 'electricity', name: 'Elektrik', icon: '⚡', unlock: 0 },
  { key: 'water', name: 'Su ve Kanalizasyon', icon: '💧', unlock: 0 },
  { key: 'health', name: 'Sağlık ve Defin', icon: '🏥', unlock: 1 },
  { key: 'garbage', name: 'Çöp Yönetimi', icon: '🗑️', unlock: 1 },
  { key: 'education', name: 'Eğitim ve Araştırma', icon: '🎓', unlock: 2 },
  { key: 'fire', name: 'İtfaiye ve Kurtarma', icon: '🚒', unlock: 3 },
  { key: 'police', name: 'Polis ve Yönetim', icon: '🚓', unlock: 3 },
  { key: 'transport', name: 'Ulaşım', icon: '🚌', unlock: 4 },
  { key: 'parks', name: 'Parklar ve Rekreasyon', icon: '🌳', unlock: 4 },
  { key: 'comms', name: 'İletişim', icon: '📡', unlock: 5 },
  { key: 'landmarks', name: 'Simge Yapılar', icon: '🏛️', unlock: 6 },
  { key: 'landscaping', name: 'Arazi Düzenleme', icon: '⛰️', unlock: 0 },
  { key: 'areas', name: 'Alanlar', icon: '🗺️', unlock: 0 },
];

export const SERVICES = {
  // ---------------- ELEKTRİK ----------------
  wind_turbine: { cat: 'electricity', name: 'Rüzgar Türbini', icon: '🌬️', desc: 'Rüzgara bağlı temiz enerji. Yüksek ve açık alanlarda verimli.', size: [1, 1], cost: 6000, upkeep: 120, workers: 0, prod: { power: 2.2 }, windDependent: true, pol: { noise: 0.4 }, unlock: 0, style: 'wind', xp: 3 },
  coal_small: { cat: 'electricity', name: 'Küçük Kömür Santrali', icon: '🏭', desc: 'Ucuz ve güvenilir, ama çok kirletici.', size: [3, 3], cost: 42000, upkeep: 1300, workers: 25, prod: { power: 18 }, pol: { air: 3.5, ground: 1.2, noise: 1.2 }, unlock: 0, style: 'plant', color: 0x7a6e66, xp: 10 },
  solar: { cat: 'electricity', name: 'Güneş Enerjisi Santrali', icon: '☀️', desc: 'Kirliliksiz; gündüz ve açık havada üretir.', size: [4, 4], cost: 70000, upkeep: 900, workers: 8, prod: { power: 22 }, solarDependent: true, unlock: 'n_solar', style: 'solar', xp: 15 },
  gas: { cat: 'electricity', name: 'Doğalgaz Santrali', icon: '🔥', desc: 'Kömürden temiz, verimli santral.', size: [3, 4], cost: 95000, upkeep: 2100, workers: 30, prod: { power: 45 }, pol: { air: 1.6, noise: 1.0 }, unlock: 'n_gas', style: 'plant', color: 0x9aa3ad, xp: 20 },
  coal: { cat: 'electricity', name: 'Kömür Santrali', icon: '🏭', desc: 'Büyük kapasiteli kömür santrali.', size: [4, 5], cost: 140000, upkeep: 2800, workers: 60, prod: { power: 90 }, pol: { air: 6, ground: 2, noise: 1.6 }, unlock: 'n_coal', style: 'plant', color: 0x6f645c, xp: 25 },
  geothermal: { cat: 'electricity', name: 'Jeotermal Santral', icon: '🌋', desc: 'Yerin ısısından sürekli, temiz enerji.', size: [3, 3], cost: 160000, upkeep: 2600, workers: 25, prod: { power: 60 }, pol: { noise: 0.6 }, unlock: 'n_geothermal', style: 'plant', color: 0xc9b9a6, xp: 25 },
  hydro: { cat: 'electricity', name: 'Hidroelektrik Santrali', icon: '🌊', desc: 'Nehir kıyısına kurulur, büyük ve temiz enerji.', size: [3, 3], cost: 210000, upkeep: 2200, workers: 20, prod: { power: 110 }, place: 'shore', pol: { noise: 0.8 }, unlock: 'n_hydro', style: 'dam', xp: 30 },
  nuclear: { cat: 'electricity', name: 'Nükleer Santral', icon: '☢️', desc: 'Muazzam enerji; pahalı ve gürültülü.', size: [5, 6], cost: 600000, upkeep: 9000, workers: 120, prod: { power: 400 }, pol: { noise: 1.5 }, unlock: 'n_nuclear', style: 'nuclear', xp: 60 },
  battery: { cat: 'electricity', name: 'Acil Durum Batarya İstasyonu', icon: '🔋', desc: 'Fazla elektriği depolar, açıkta devreye girer.', size: [2, 2], cost: 30000, upkeep: 400, workers: 3, prod: { battery: 40 }, unlock: 'n_battery', style: 'battery', xp: 6 },

  // ---------------- SU ----------------
  water_pump: { cat: 'water', name: 'Su Pompalama İstasyonu', icon: '🚰', desc: 'Kıyıya kurulur; temiz su pompalar. Kirli suyun yakınına koymayın!', size: [2, 2], cost: 18000, upkeep: 550, workers: 6, prod: { water: 45 }, place: 'shore', unlock: 0, style: 'pump', xp: 6 },
  groundwater_pump: { cat: 'water', name: 'Yeraltı Suyu Pompası', icon: '⛲', desc: 'Kıyıya ihtiyaç duymaz; yeraltı suyuna bağlıdır.', size: [1, 1], cost: 9000, upkeep: 260, workers: 2, prod: { water: 14 }, groundwater: true, unlock: 0, style: 'gwpump', xp: 3 },
  water_tower: { cat: 'water', name: 'Su Kulesi', icon: '🗼', desc: 'Az miktarda yeraltı suyu çeker, şebekeyi dengeler.', size: [1, 1], cost: 12000, upkeep: 200, workers: 1, prod: { water: 10 }, groundwater: true, unlock: 'n_watertower', style: 'watertower', xp: 3 },
  water_large: { cat: 'water', name: 'Büyük Su Pompalama İstasyonu', icon: '🚰', desc: 'Yüksek kapasiteli kıyı pompası; filtreleme içerir.', size: [3, 3], cost: 60000, upkeep: 1600, workers: 14, prod: { water: 160 }, place: 'shore', filter: 0.6, unlock: 'n_waterlarge', style: 'pump', xp: 15 },
  sewage_outlet: { cat: 'water', name: 'Kanalizasyon Çıkışı', icon: '🕳️', desc: 'Atık suyu arıtmadan suya boşaltır; su kirliliği yaratır.', size: [2, 2], cost: 14000, upkeep: 400, workers: 4, prod: { sewage: 50 }, place: 'shore', waterPol: 1.0, pol: { ground: 0.3 }, unlock: 0, style: 'outlet', xp: 5 },
  sewage_treatment: { cat: 'water', name: 'Atık Su Arıtma Tesisi', icon: '♻️', desc: 'Atık suyu %90 arıtarak suya verir.', size: [4, 4], cost: 85000, upkeep: 2100, workers: 20, prod: { sewage: 180 }, place: 'shore', waterPol: 0.1, unlock: 'n_treatment', style: 'treatment', xp: 20 },

  // ---------------- SAĞLIK & DEFİN ----------------
  clinic: { cat: 'health', name: 'Sağlık Ocağı', icon: '🏥', desc: 'Küçük sağlık tesisi; hasta vatandaşları tedavi eder.', size: [2, 2], cost: 32000, upkeep: 1100, workers: 12, svc: { type: 'health', radius: 26, cap: 3000, str: 1 }, unlock: 1, style: 'clinic', xp: 8,
    upgrades: [{ key: 'wing', name: 'Hasta Kanadı', cost: 15000, upkeep: 400, cap: 1500 }] },
  hospital: { cat: 'health', name: 'Hastane', icon: '🏨', desc: 'Büyük hastane; geniş kapsama.', size: [4, 4], cost: 160000, upkeep: 4200, workers: 80, svc: { type: 'health', radius: 55, cap: 16000, str: 1 }, unlock: 'n_hospital', style: 'hospital', xp: 25,
    upgrades: [{ key: 'heli', name: 'Ambulans Helikopteri Pisti', cost: 40000, upkeep: 900, radius: 20 }, { key: 'lab', name: 'Laboratuvar', cost: 30000, upkeep: 600, cap: 4000 }] },
  disease_control: { cat: 'health', name: 'Hastalık Kontrol Merkezi', icon: '🧬', desc: 'Şehir genelinde hastalık oranını düşürür.', size: [3, 3], cost: 120000, upkeep: 2400, workers: 30, cityEffect: { sickness: -0.3 }, unlock: 'n_disease', style: 'hospital', xp: 15 },
  research_hospital: { cat: 'health', name: 'Tıbbi Araştırma Merkezi', icon: '🔬', desc: 'Sağlığı şehir çapında iyileştirir, ofis talebini artırır.', size: [4, 3], cost: 220000, upkeep: 5000, workers: 70, cityEffect: { health: 0.1 }, svc: { type: 'health', radius: 40, cap: 8000, str: 1 }, unlock: 'n_research', style: 'hospital', xp: 30 },
  cemetery: { cat: 'health', name: 'Mezarlık', icon: '🪦', desc: 'Ölüleri defneder; kapasitesi zamanla dolar.', size: [3, 4], cost: 22000, upkeep: 700, workers: 6, svc: { type: 'death', radius: 40, cap: 1600, str: 1 }, storage: 1600, unlock: 1, style: 'cemetery', xp: 6 },
  crematorium: { cat: 'health', name: 'Krematoryum', icon: '⚱️', desc: 'Cenazeleri işler; dolmaz.', size: [2, 3], cost: 60000, upkeep: 1500, workers: 12, svc: { type: 'death', radius: 50, cap: 120, str: 1 }, processing: 120, pol: { air: 0.4 }, unlock: 'n_crematorium', style: 'crematorium', xp: 12 },

  // ---------------- ÇÖP ----------------
  landfill: { cat: 'garbage', name: 'Çöp Sahası', icon: '🗑️', desc: 'Çöpü depolar. Toprak kirliliği yaratır, zamanla dolar.', size: [4, 4], cost: 26000, upkeep: 900, workers: 10, svc: { type: 'garbage', radius: 45, cap: 1500, str: 1 }, storage: 60000, pol: { ground: 2.5, noise: 0.5 }, unlock: 1, style: 'landfill', xp: 6 },
  incinerator: { cat: 'garbage', name: 'Çöp Yakma Tesisi', icon: '🔥', desc: 'Çöpü yakarak elektrik üretir. Hava kirliliği yaratır.', size: [3, 3], cost: 95000, upkeep: 2300, workers: 25, svc: { type: 'garbage', radius: 55, cap: 4000, str: 1 }, prod: { power: 8 }, pol: { air: 2.4, noise: 0.6 }, unlock: 'n_incinerator', style: 'plant', color: 0x8c8378, xp: 15 },
  recycling: { cat: 'garbage', name: 'Geri Dönüşüm Merkezi', icon: '♻️', desc: 'Çöpü geri dönüştürür ve mal üretir.', size: [3, 3], cost: 110000, upkeep: 2500, workers: 30, svc: { type: 'garbage', radius: 50, cap: 3000, str: 1 }, produce: { goods: 200 }, pol: { noise: 0.5 }, unlock: 5, style: 'recycling', xp: 15 },
  transfer: { cat: 'garbage', name: 'Çöp Aktarma İstasyonu', icon: '🚛', desc: 'Toplama alanını genişletir.', size: [2, 2], cost: 30000, upkeep: 700, workers: 8, svc: { type: 'garbage', radius: 40, cap: 800, str: 1 }, unlock: 'n_transfer', style: 'depot', color: 0x7f8c55, xp: 6 },

  // ---------------- EĞİTİM ----------------
  elementary: { cat: 'education', name: 'İlkokul', icon: '🏫', desc: 'Çocuklara temel eğitim verir.', size: [2, 3], cost: 40000, upkeep: 1400, workers: 20, svc: { type: 'edu1', radius: 30, cap: 450, str: 1 }, unlock: 2, style: 'school', color: 0xc9a26b, xp: 10,
    upgrades: [{ key: 'ext', name: 'Ek Derslik', cost: 18000, upkeep: 500, cap: 250 }] },
  high_school: { cat: 'education', name: 'Lise', icon: '🏫', desc: 'Gençlere orta öğretim.', size: [3, 3], cost: 75000, upkeep: 2200, workers: 35, svc: { type: 'edu2', radius: 40, cap: 700, str: 1 }, unlock: 2, style: 'school', color: 0xb38a5a, xp: 15,
    upgrades: [{ key: 'gym', name: 'Spor Salonu', cost: 20000, upkeep: 400, cap: 200 }] },
  college: { cat: 'education', name: 'Meslek Yüksekokulu', icon: '🎓', desc: 'Yetişkinlere yükseköğrenim.', size: [3, 4], cost: 150000, upkeep: 3600, workers: 50, svc: { type: 'edu3', radius: 60, cap: 1200, str: 1 }, unlock: 'n_college', style: 'college', xp: 25 },
  university: { cat: 'education', name: 'Üniversite', icon: '🏛️', desc: 'En yüksek eğitim seviyesi. Ofis talebini artırır.', size: [5, 5], cost: 320000, upkeep: 6500, workers: 110, svc: { type: 'edu4', radius: 90, cap: 3000, str: 1 }, attract: 30, unlock: 'n_university', style: 'university', xp: 40 },
  research: { cat: 'education', name: 'Araştırma Tesisi', icon: '🧪', desc: 'Gelişim puanı kazanma hızını artırır.', size: [3, 3], cost: 250000, upkeep: 5000, workers: 60, cityEffect: { research: 1 }, unlock: 'n_researchfac', style: 'college', xp: 30 },

  // ---------------- İTFAİYE ----------------
  fire_house: { cat: 'fire', name: 'İtfaiye Binası', icon: '🚒', desc: 'Yangınları söndürür, yangın riskini azaltır.', size: [2, 2], cost: 30000, upkeep: 1000, workers: 12, svc: { type: 'fire', radius: 30, cap: 4000, str: 1 }, unlock: 3, style: 'firehouse', xp: 8 },
  fire_station: { cat: 'fire', name: 'İtfaiye İstasyonu', icon: '🚒', desc: 'Daha fazla araç ve geniş kapsama.', size: [3, 3], cost: 90000, upkeep: 2500, workers: 35, svc: { type: 'fire', radius: 55, cap: 14000, str: 1 }, unlock: 'n_firestation', style: 'firehouse', xp: 18 },
  fire_heli: { cat: 'fire', name: 'Yangın Helikopteri Deposu', icon: '🚁', desc: 'Orman yangınlarına karşı havadan müdahale; geniş alan.', size: [3, 3], cost: 120000, upkeep: 2800, workers: 20, svc: { type: 'fire', radius: 80, cap: 8000, str: 0.7 }, forest: true, unlock: 'n_fireheli', style: 'helipad', xp: 15 },
  early_warning: { cat: 'fire', name: 'Erken Afet Uyarı Sistemi', icon: '📢', desc: 'Afetleri önceden haber verir, kayıpları azaltır.', size: [2, 2], cost: 50000, upkeep: 900, workers: 4, cityEffect: { warning: 1 }, unlock: 'n_warning', style: 'tower', xp: 8 },
  shelter: { cat: 'fire', name: 'Acil Durum Sığınağı', icon: '🛖', desc: 'Afet sırasında vatandaşları korur.', size: [2, 2], cost: 40000, upkeep: 600, workers: 4, svc: { type: 'shelter', radius: 40, cap: 2000, str: 1 }, unlock: 'n_shelter', style: 'bunker', xp: 6 },

  // ---------------- POLİS & YÖNETİM ----------------
  police_station: { cat: 'police', name: 'Polis Karakolu', icon: '🚓', desc: 'Suçu azaltır.', size: [2, 2], cost: 30000, upkeep: 1100, workers: 15, svc: { type: 'police', radius: 30, cap: 4000, str: 1 }, unlock: 3, style: 'police', xp: 8,
    upgrades: [{ key: 'cells', name: 'Nezarethane', cost: 12000, upkeep: 300, cap: 1500 }] },
  police_hq: { cat: 'police', name: 'Emniyet Müdürlüğü', icon: '🏢', desc: 'Büyük kapasite ve geniş kapsama.', size: [3, 4], cost: 120000, upkeep: 3500, workers: 60, svc: { type: 'police', radius: 60, cap: 18000, str: 1 }, unlock: 'n_policehq', style: 'police', xp: 20 },
  prison: { cat: 'police', name: 'Cezaevi', icon: '⛓️', desc: 'Suçluları barındırır; polis verimini artırır.', size: [4, 4], cost: 140000, upkeep: 3200, workers: 40, cityEffect: { prison: 1 }, pol: { noise: 0.4 }, unlock: 'n_prison', style: 'prison', xp: 15 },
  intelligence: { cat: 'police', name: 'İstihbarat Teşkilatı', icon: '🕵️', desc: 'Şehir genelinde suçu azaltır.', size: [3, 3], cost: 200000, upkeep: 4500, workers: 50, cityEffect: { crime: -0.25 }, unlock: 'n_intel', style: 'office', color: 0x445566, xp: 20 },
  city_hall: { cat: 'police', name: 'Belediye Binası', icon: '🏛️', desc: 'Yönetim merkezi; mutluluk ve gelişim puanı kazancını artırır.', size: [4, 4], cost: 150000, upkeep: 2500, workers: 40, cityEffect: { happiness: 3 }, attract: 15, unique: true, unlock: 'n_cityhall', style: 'cityhall', xp: 25 },
  welfare: { cat: 'police', name: 'Sosyal Yardım Ofisi', icon: '🤝', desc: 'Düşük gelirli hanelere destek: mutluluk artar.', size: [2, 2], cost: 40000, upkeep: 1200, workers: 10, svc: { type: 'welfare', radius: 35, cap: 5000, str: 1 }, unlock: 'n_welfare', style: 'office', color: 0x9ab07a, xp: 8 },

  // ---------------- ULAŞIM ----------------
  bus_depot: { cat: 'transport', name: 'Otobüs Garajı', icon: '🚌', desc: 'Otobüs hatlarının çalışması için gereklidir.', size: [3, 3], cost: 35000, upkeep: 900, workers: 20, depot: 'bus', unlock: 4, style: 'depot', color: 0x3d7fb5, xp: 8 },
  taxi_depot: { cat: 'transport', name: 'Taksi Garajı', icon: '🚕', desc: 'Taksiler trafiği hafifletir.', size: [2, 2], cost: 25000, upkeep: 600, workers: 15, depot: 'taxi', cityEffect: { traffic: -0.04 }, unlock: 4, style: 'depot', color: 0xe0c040, xp: 5 },
  parking: { cat: 'transport', name: 'Otopark', icon: '🅿️', desc: 'Çevresinde trafiği azaltır, park ücreti geliri sağlar.', size: [2, 2], cost: 12000, upkeep: 150, workers: 1, parking: true, unlock: 4, style: 'parking', xp: 3 },
  tram_depot: { cat: 'transport', name: 'Tramvay Deposu', icon: '🚋', desc: 'Tramvay hatları için gereklidir.', size: [3, 4], cost: 70000, upkeep: 1500, workers: 25, depot: 'tram', unlock: 'n_tram', style: 'depot', color: 0xb5463d, xp: 12 },
  train_station: { cat: 'transport', name: 'Tren İstasyonu', icon: '🚉', desc: 'Raylara bağlanır; turist getirir, tren hattı durağıdır.', size: [3, 5], cost: 90000, upkeep: 1800, workers: 25, station: 'train', attract: 15, unlock: 'n_train', style: 'station', xp: 15 },
  train_depot: { cat: 'transport', name: 'Tren Deposu', icon: '🚆', desc: 'Şehir içi tren hatları için gereklidir.', size: [3, 5], cost: 80000, upkeep: 1600, workers: 25, depot: 'train', unlock: 'n_train', style: 'depot', color: 0x7a5a3a, xp: 12 },
  metro_station: { cat: 'transport', name: 'Metro İstasyonu', icon: '🚇', desc: 'Metro tünellerine bağlanır.', size: [2, 2], cost: 50000, upkeep: 900, workers: 10, station: 'metro', unlock: 'n_metro', style: 'metro', xp: 10 },
  metro_depot: { cat: 'transport', name: 'Metro Deposu', icon: '🚇', desc: 'Metro hatları için gereklidir.', size: [3, 3], cost: 80000, upkeep: 1600, workers: 20, depot: 'metro', unlock: 'n_metro', style: 'depot', color: 0x6a4a9a, xp: 12 },
  harbor: { cat: 'transport', name: 'Yolcu ve Kargo Limanı', icon: '⚓', desc: 'Kıyıya kurulur; turizm ve ihracatı artırır.', size: [4, 4], cost: 180000, upkeep: 3000, workers: 40, place: 'shore', attract: 25, trade: 0.25, unlock: 'n_harbor', style: 'harbor', xp: 25 },
  airport: { cat: 'transport', name: 'Havalimanı', icon: '✈️', desc: 'Büyük turizm ve ticaret artışı. Gürültülü.', size: [6, 10], cost: 450000, upkeep: 7000, workers: 120, attract: 80, trade: 0.4, pol: { noise: 2.5 }, unlock: 'n_airport', style: 'airport', xp: 50 },
  cargo_terminal: { cat: 'transport', name: 'Kargo Tren Terminali', icon: '📦', desc: 'Sanayi ihracatını artırır, kamyon trafiğini azaltır.', size: [4, 5], cost: 140000, upkeep: 2400, workers: 40, trade: 0.3, pol: { noise: 1.2 }, unlock: 'n_cargo', style: 'cargo', xp: 18 },

  // ---------------- PARKLAR ----------------
  small_park: { cat: 'parks', name: 'Küçük Park', icon: '🌳', desc: 'Komşuluk parkı: mutluluk ve arazi değeri.', size: [2, 2], cost: 6000, upkeep: 120, workers: 1, svc: { type: 'park', radius: 10, cap: 1200, str: 0.8 }, leisure: 2, unlock: 4, style: 'park', xp: 3 },
  playground: { cat: 'parks', name: 'Oyun Parkı', icon: '🛝', desc: 'Çocuklar için oyun alanı.', size: [1, 2], cost: 4000, upkeep: 80, workers: 0, svc: { type: 'park', radius: 8, cap: 600, str: 0.6 }, leisure: 1, unlock: 4, style: 'playground', xp: 2 },
  dog_park: { cat: 'parks', name: 'Köpek Parkı', icon: '🐕', desc: 'Evcil hayvan sahipleri için.', size: [2, 2], cost: 5000, upkeep: 100, workers: 0, svc: { type: 'park', radius: 9, cap: 800, str: 0.6 }, leisure: 1, unlock: 4, style: 'park', xp: 2 },
  plaza: { cat: 'parks', name: 'Küçük Meydan', icon: '⛲', desc: 'Çeşmeli şehir meydanı.', size: [2, 2], cost: 8000, upkeep: 150, workers: 1, svc: { type: 'park', radius: 10, cap: 1000, str: 0.8 }, leisure: 2, attract: 2, unlock: 4, style: 'plaza', xp: 3 },
  campfire: { cat: 'parks', name: 'Kamp Ateşi Alanı', icon: '🏕️', desc: 'Doğa içinde eğlence; doğal çekicilik.', size: [1, 1], cost: 3000, upkeep: 50, workers: 0, svc: { type: 'park', radius: 6, cap: 300, str: 0.5 }, leisure: 1, attract: 2, noRoad: true, unlock: 4, style: 'campfire', xp: 2 },
  city_park: { cat: 'parks', name: 'Şehir Parkı', icon: '🏞️', desc: 'Büyük park; geniş etki alanı.', size: [4, 4], cost: 40000, upkeep: 700, workers: 5, svc: { type: 'park', radius: 18, cap: 5000, str: 1 }, leisure: 5, attract: 10, unlock: 'n_citypark', style: 'park', xp: 10 },
  sports: { cat: 'parks', name: 'Spor Sahası', icon: '⚽', desc: 'Futbol sahası; gençlerin favorisi.', size: [3, 4], cost: 30000, upkeep: 500, workers: 4, svc: { type: 'park', radius: 15, cap: 3000, str: 0.9 }, leisure: 4, attract: 5, unlock: 'n_sports', style: 'sports', xp: 8 },
  botanical: { cat: 'parks', name: 'Botanik Bahçesi', icon: '🌺', desc: 'Turist çeken büyük bahçe.', size: [4, 5], cost: 90000, upkeep: 1400, workers: 12, svc: { type: 'park', radius: 20, cap: 6000, str: 1 }, leisure: 6, attract: 25, unlock: 'n_botanical', style: 'park', xp: 15 },
  zoo: { cat: 'parks', name: 'Hayvanat Bahçesi', icon: '🦒', desc: 'Büyük turizm cazibesi.', size: [5, 5], cost: 160000, upkeep: 2600, workers: 30, svc: { type: 'park', radius: 22, cap: 8000, str: 1 }, leisure: 8, attract: 45, unlock: 'n_zoo', style: 'park', xp: 25 },

  // ---------------- İLETİŞİM ----------------
  post_office: { cat: 'comms', name: 'Postane', icon: '📮', desc: 'Posta hizmeti verir.', size: [2, 2], cost: 25000, upkeep: 700, workers: 10, svc: { type: 'post', radius: 35, cap: 6000, str: 1 }, unlock: 5, style: 'office', color: 0xd9a441, xp: 6 },
  post_sorting: { cat: 'comms', name: 'Posta Ayrıştırma Tesisi', icon: '📦', desc: 'Geniş posta ağı.', size: [4, 4], cost: 90000, upkeep: 2000, workers: 40, svc: { type: 'post', radius: 70, cap: 25000, str: 1 }, unlock: 'n_postsort', style: 'depot', color: 0xd9a441, xp: 15 },
  radio_mast: { cat: 'comms', name: 'Radyo Direği', icon: '📻', desc: 'Telekom ağı: ofisler ve konutlar için önemli.', size: [1, 1], cost: 12000, upkeep: 300, workers: 0, svc: { type: 'telecom', radius: 18, cap: 3000, str: 0.8, wireless: true }, unlock: 5, style: 'mast', xp: 4 },
  antenna: { cat: 'comms', name: 'Telekom Merkezi', icon: '📡', desc: 'Yüksek kapasiteli ağ; ofis verimini artırır.', size: [3, 3], cost: 80000, upkeep: 1800, workers: 20, svc: { type: 'telecom', radius: 45, cap: 20000, str: 1, wireless: true }, unlock: 'n_telecom', style: 'antenna', xp: 15 },

  // ---------------- SİMGE YAPILAR / İMZA BİNALAR ----------------
  sig_house: { cat: 'landmarks', name: 'Mimar Evi (İmza Konut)', icon: '🏡', desc: 'Düşük yoğunluklu imza konut binası. Çevresine çekicilik katar.', size: [2, 3], cost: 0, upkeep: 0, workers: 0, sig: 1, sigHH: 4, attract: 8, happy: 6, unlock: 6, style: 'sig_house', xp: 10 },
  sig_tower: { cat: 'landmarks', name: 'Gökkuşağı Kulesi (İmza Konut)', icon: '🏙️', desc: 'Yüksek imza konut kulesi.', size: [3, 3], cost: 0, upkeep: 0, workers: 0, sig: 6, sigHH: 120, attract: 20, happy: 8, unlock: 11, style: 'sig_tower', xp: 20 },
  sig_market: { cat: 'landmarks', name: 'Kapalı Çarşı (İmza Ticari)', icon: '🛍️', desc: 'Turistleri çeken tarihi çarşı.', size: [3, 3], cost: 0, upkeep: 0, workers: 0, sig: 7, sigJobs: 60, attract: 30, happy: 4, unlock: 7, style: 'sig_market', xp: 15 },
  sig_factory: { cat: 'landmarks', name: 'Tarihi Bira Fabrikası (İmza Sanayi)', icon: '🍺', desc: 'Az kirleten imza sanayi binası.', size: [3, 4], cost: 0, upkeep: 0, workers: 0, sig: 9, sigJobs: 80, attract: 12, unlock: 7, style: 'sig_factory', xp: 15 },
  sig_office: { cat: 'landmarks', name: 'Kristal Plaza (İmza Ofis)', icon: '🏢', desc: 'İkonik cam gökdelen ofis.', size: [3, 3], cost: 0, upkeep: 0, workers: 0, sig: 11, sigJobs: 400, attract: 35, happy: 3, unlock: 12, style: 'sig_office', xp: 25 },
  stadium: { cat: 'landmarks', name: 'Stadyum', icon: '🏟️', desc: 'Dev bir turizm çekim noktası.', size: [6, 7], cost: 400000, upkeep: 4000, workers: 60, attract: 120, leisure: 15, svc: { type: 'park', radius: 25, cap: 15000, str: 1 }, unique: true, unlock: 13, style: 'stadium', xp: 60 },
  tv_tower: { cat: 'landmarks', name: 'TV Kulesi', icon: '🗼', desc: 'Şehrin simgesi; telekom ve turizm.', size: [3, 3], cost: 300000, upkeep: 2500, workers: 15, attract: 90, svc: { type: 'telecom', radius: 60, cap: 30000, str: 1, wireless: true }, unique: true, unlock: 10, style: 'tvtower', xp: 50 },
  cathedral: { cat: 'landmarks', name: 'Katedral', icon: '⛪', desc: 'Tarihi simge yapı; mutluluk ve turizm.', size: [3, 5], cost: 250000, upkeep: 1800, workers: 10, attract: 70, happy: 10, unique: true, unlock: 9, style: 'cathedral', xp: 40 },
  opera: { cat: 'landmarks', name: 'Opera Binası', icon: '🎭', desc: 'Kültür ve sanat merkezi.', size: [4, 4], cost: 350000, upkeep: 3000, workers: 40, attract: 100, leisure: 10, happy: 8, unique: true, unlock: 15, style: 'opera', xp: 50 },
};

export const SERVICE_TYPES = {
  health: 'Sağlık', death: 'Defin', garbage: 'Çöp Toplama', edu1: 'İlkokul', edu2: 'Lise', edu3: 'Yüksekokul', edu4: 'Üniversite',
  fire: 'İtfaiye', police: 'Polis', park: 'Park ve Eğlence', post: 'Posta', telecom: 'Telekom', shelter: 'Sığınak', welfare: 'Sosyal Yardım',
};

// Bütçe kalemleri
export const BUDGET_KEYS = {
  electricity: 'Elektrik', water: 'Su ve Kanalizasyon', health: 'Sağlık ve Defin', garbage: 'Çöp Yönetimi',
  education: 'Eğitim', fire: 'İtfaiye', police: 'Polis ve Yönetim', transport: 'Ulaşım', parks: 'Parklar', comms: 'İletişim', landmarks: 'Simge Yapılar',
};
