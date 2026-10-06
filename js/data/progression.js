// Kilometre taşları, gelişim ağacı ve politikalar (CS2: İlerleme)
export const MILESTONES = [
  { name: 'Başlangıç', xp: 0, money: 0, dp: 0, tiles: 9, loan: 0, unlocks: [] },
  { name: 'Minik Köy', xp: 25, money: 20000, dp: 1, tiles: 2, loan: 50000, unlocks: ['Sağlık ve Defin', 'Çöp Yönetimi', 'Kredi'] },
  { name: 'Küçük Köy', xp: 120, money: 30000, dp: 2, tiles: 2, loan: 100000, unlocks: ['Vergi Kontrolü', 'Orta Yoğunluklu Konut', 'Sıra Evler', 'Eğitim ve Araştırma', 'Büyük Yol'] },
  { name: 'Büyük Köy', xp: 300, money: 40000, dp: 2, tiles: 2, loan: 150000, unlocks: ['Hizmet Bütçeleri', 'Tarım', 'İtfaiye ve Kurtarma', 'Polis ve Yönetim'] },
  { name: 'Ulu Köy', xp: 600, money: 55000, dp: 3, tiles: 3, loan: 250000, unlocks: ['İlçeler', 'Politikalar', 'Doğal Afetler', 'Üretim Paneli', 'Düşük Kiralı Konut', 'Düşük Yoğunluklu Ofis', 'Ormancılık', 'Parklar', 'Otobüs ve Taksi', 'Yaya Yolu', 'Toplu Taşıma Şeritli Yol'] },
  { name: 'Minik Kasaba', xp: 1000, money: 70000, dp: 3, tiles: 3, loan: 350000, unlocks: ['Karma Konut', 'Madencilik', 'Geri Dönüşüm', 'İletişim', 'Otoyol'] },
  { name: 'Patlayan Kasaba', xp: 1600, money: 90000, dp: 4, tiles: 3, loan: 450000, unlocks: ['Simge Yapılar', 'İmza Binalar', 'Gelişmiş Kirlilik Yönetimi'] },
  { name: 'Hareketli Kasaba', xp: 2400, money: 110000, dp: 4, tiles: 3, loan: 550000, unlocks: ['İmza Ticari ve Sanayi Binaları'] },
  { name: 'Büyük Kasaba', xp: 3500, money: 140000, dp: 5, tiles: 4, loan: 700000, unlocks: ['Yüksek Yoğunluklu Konut', 'Petrol'] },
  { name: 'Ulu Kasaba', xp: 5000, money: 170000, dp: 5, tiles: 4, loan: 850000, unlocks: ['Yüksek Yoğunluklu Ticari', 'Katedral'] },
  { name: 'Küçük Şehir', xp: 7000, money: 200000, dp: 6, tiles: 4, loan: 1000000, unlocks: ['Yüksek Yoğunluklu Ofis', 'TV Kulesi', 'Şehir Tanıtımı'] },
  { name: 'Büyük Şehir', xp: 9500, money: 240000, dp: 6, tiles: 4, loan: 1200000, unlocks: ['İmza Konut Kulesi', 'Kredi Artışı'] },
  { name: 'Geniş Şehir', xp: 12500, money: 280000, dp: 7, tiles: 4, loan: 1400000, unlocks: ['İmza Ofis', 'Kredi Artışı'] },
  { name: 'Devasa Şehir', xp: 16000, money: 320000, dp: 7, tiles: 5, loan: 1600000, unlocks: ['Stadyum', 'Kredi Artışı'] },
  { name: 'Ulu Şehir', xp: 20000, money: 360000, dp: 8, tiles: 5, loan: 1800000, unlocks: ['Kredi Artışı'] },
  { name: 'Metropol', xp: 25000, money: 420000, dp: 8, tiles: 5, loan: 2000000, unlocks: ['Opera Binası', 'Kredi Artışı'] },
  { name: 'Gelişen Metropol', xp: 31000, money: 480000, dp: 9, tiles: 5, loan: 2300000, unlocks: ['Kredi Artışı'] },
  { name: 'Serpilen Metropol', xp: 38000, money: 540000, dp: 9, tiles: 6, loan: 2600000, unlocks: ['Kredi Artışı'] },
  { name: 'Geniş Metropol', xp: 46000, money: 600000, dp: 10, tiles: 6, loan: 3000000, unlocks: ['Kredi Artışı'] },
  { name: 'Muazzam Metropol', xp: 55000, money: 700000, dp: 10, tiles: 6, loan: 3500000, unlocks: ['Kredi Artışı'] },
  { name: 'Megalopolis', xp: 65000, money: 1000000, dp: 12, tiles: 100, loan: 4000000, unlocks: ['Tüm harita karoları'] },
];

// Özellik kilitleri (kilometre taşı numarası)
export const FEATURES = { loan: 1, taxes: 2, budget: 3, districts: 4, policies: 4, disasters: 4, production: 4, transportOverview: 4, lifepath: 2 };

// Gelişim ağacı (Gelişim Puanı ile açılır). Kademe maliyetleri: 1,2,4,8
export const DEV_TREE = {
  electricity: [
    { id: 'n_solar', name: 'Güneş Enerjisi', cost: 1, desc: 'Güneş Enerjisi Santrali' },
    { id: 'n_battery', name: 'Enerji Depolama', cost: 1, desc: 'Acil Durum Batarya İstasyonu' },
    { id: 'n_gas', name: 'Doğalgaz', cost: 2, req: 'n_solar', desc: 'Doğalgaz Santrali' },
    { id: 'n_coal', name: 'Büyük Kömür', cost: 2, req: 'n_battery', desc: 'Kömür Santrali' },
    { id: 'n_geothermal', name: 'Jeotermal', cost: 4, req: 'n_gas', desc: 'Jeotermal Santral' },
    { id: 'n_hydro', name: 'Hidroelektrik', cost: 4, req: 'n_gas', desc: 'Hidroelektrik Santrali' },
    { id: 'n_nuclear', name: 'Nükleer Enerji', cost: 8, req: 'n_geothermal', desc: 'Nükleer Santral' },
  ],
  water: [
    { id: 'n_watertower', name: 'Su Kulesi', cost: 1, desc: 'Su Kulesi' },
    { id: 'n_treatment', name: 'Atık Su Arıtma', cost: 2, desc: 'Atık Su Arıtma Tesisi' },
    { id: 'n_waterlarge', name: 'Büyük Pompa', cost: 2, req: 'n_watertower', desc: 'Büyük Su Pompalama İstasyonu (filtreli)' },
  ],
  health: [
    { id: 'n_crematorium', name: 'Krematoryum', cost: 1, desc: 'Krematoryum' },
    { id: 'n_hospital', name: 'Hastane', cost: 2, desc: 'Hastane' },
    { id: 'n_disease', name: 'Hastalık Kontrolü', cost: 4, req: 'n_hospital', desc: 'Hastalık Kontrol Merkezi' },
    { id: 'n_research', name: 'Tıbbi Araştırma', cost: 8, req: 'n_disease', desc: 'Tıbbi Araştırma Merkezi' },
  ],
  garbage: [
    { id: 'n_transfer', name: 'Aktarma İstasyonu', cost: 1, desc: 'Çöp Aktarma İstasyonu' },
    { id: 'n_incinerator', name: 'Çöp Yakma', cost: 2, desc: 'Çöp Yakma Tesisi (elektrik üretir)' },
  ],
  education: [
    { id: 'n_college', name: 'Yükseköğretim', cost: 2, desc: 'Meslek Yüksekokulu' },
    { id: 'n_university', name: 'Üniversite', cost: 4, req: 'n_college', desc: 'Üniversite' },
    { id: 'n_researchfac', name: 'Araştırma', cost: 8, req: 'n_university', desc: 'Araştırma Tesisi (+gelişim puanı)' },
  ],
  fire: [
    { id: 'n_warning', name: 'Erken Uyarı', cost: 1, desc: 'Erken Afet Uyarı Sistemi' },
    { id: 'n_shelter', name: 'Sığınak', cost: 1, desc: 'Acil Durum Sığınağı' },
    { id: 'n_firestation', name: 'İtfaiye İstasyonu', cost: 2, desc: 'İtfaiye İstasyonu' },
    { id: 'n_fireheli', name: 'Yangın Helikopteri', cost: 2, req: 'n_firestation', desc: 'Yangın Helikopteri Deposu' },
  ],
  police: [
    { id: 'n_welfare', name: 'Sosyal Yardım', cost: 1, desc: 'Sosyal Yardım Ofisi' },
    { id: 'n_policehq', name: 'Emniyet Müdürlüğü', cost: 2, desc: 'Emniyet Müdürlüğü' },
    { id: 'n_prison', name: 'Cezaevi', cost: 2, req: 'n_policehq', desc: 'Cezaevi' },
    { id: 'n_cityhall', name: 'Belediye Binası', cost: 4, req: 'n_welfare', desc: 'Belediye Binası' },
    { id: 'n_intel', name: 'İstihbarat', cost: 8, req: 'n_prison', desc: 'İstihbarat Teşkilatı' },
  ],
  transport: [
    { id: 'n_tram', name: 'Tramvay', cost: 2, desc: 'Tramvay rayları ve deposu' },
    { id: 'n_train', name: 'Tren', cost: 2, desc: 'Tren rayı, istasyon ve depo' },
    { id: 'n_metro', name: 'Metro', cost: 4, req: 'n_tram', desc: 'Metro tünelleri, istasyon ve depo' },
    { id: 'n_harbor', name: 'Liman', cost: 4, req: 'n_train', desc: 'Yolcu ve Kargo Limanı' },
    { id: 'n_cargo', name: 'Kargo Treni', cost: 4, req: 'n_train', desc: 'Kargo Tren Terminali' },
    { id: 'n_airport', name: 'Havalimanı', cost: 8, req: 'n_harbor', desc: 'Havalimanı' },
  ],
  parks: [
    { id: 'n_citypark', name: 'Şehir Parkı', cost: 1, desc: 'Şehir Parkı' },
    { id: 'n_sports', name: 'Spor', cost: 2, req: 'n_citypark', desc: 'Spor Sahası' },
    { id: 'n_botanical', name: 'Botanik', cost: 4, req: 'n_citypark', desc: 'Botanik Bahçesi' },
    { id: 'n_zoo', name: 'Hayvanat Bahçesi', cost: 8, req: 'n_botanical', desc: 'Hayvanat Bahçesi' },
  ],
  comms: [
    { id: 'n_postsort', name: 'Posta Ayrıştırma', cost: 2, desc: 'Posta Ayrıştırma Tesisi' },
    { id: 'n_telecom', name: 'Telekom', cost: 2, desc: 'Telekom Merkezi' },
  ],
};

// Politikalar (şehir geneli veya ilçe bazlı)
export const POLICIES = {
  energy_awareness: { name: 'Enerji Tüketimi Bilinci', icon: '💡', desc: 'Elektrik tüketimi %15 azalır. Aylık maliyet nüfusa bağlı.', scope: 'city', unlock: 5, costPerPop: 0.05 },
  water_awareness: { name: 'Su Tasarrufu Kampanyası', icon: '🚿', desc: 'Su tüketimi ve atık su %15 azalır.', scope: 'city', unlock: 4, costPerPop: 0.04 },
  pollution_mgmt: { name: 'Gelişmiş Kirlilik Yönetimi', icon: '🏭', desc: 'Sanayi kirliliği %35 azalır; sanayi verimi biraz düşer.', scope: 'city', unlock: 6, costPerPop: 0.06 },
  city_promotion: { name: 'Şehir Tanıtımı', icon: '📣', desc: 'Turist sayısı %30 artar.', scope: 'city', unlock: 10, costFlat: 3000 },
  free_transit: { name: 'Ücretsiz Toplu Taşıma', icon: '🎫', desc: 'Toplu taşıma kullanımı artar, bilet geliri kaybolur.', scope: 'city', unlock: 4 },
  recycling_drive: { name: 'Geri Dönüşüm Teşviki', icon: '♻️', desc: 'Çöp üretimi %20 azalır.', scope: 'city', unlock: 5, costPerPop: 0.03 },
  prerelease: { name: 'Erken Tahliye Programları', icon: '🔓', desc: 'Cezaevi kapasitesi rahatlar, suç biraz artar.', scope: 'city', unlock: 5 },
  taxi_fare: { name: 'Taksi Asgari Ücreti', icon: '🚕', desc: 'Taksi geliri artar, kullanım biraz azalır.', scope: 'city', unlock: 4 },
  smoke_free: { name: 'Sigarasız Şehir', icon: '🚭', desc: 'Sağlık artar, ticari gelir biraz düşer.', scope: 'city', unlock: 3, costPerPop: 0.02 },
  heavy_traffic_ban: { name: 'Ağır Trafik Yasağı', icon: '🚛', desc: 'İlçede kamyon yasak: gürültü azalır, sanayi verimi düşer.', scope: 'district', unlock: 6 },
  combustion_ban: { name: 'İçten Yanmalı Motor Yasağı', icon: '🚗', desc: 'Hava ve gürültü kirliliği azalır.', scope: 'district', unlock: 10 },
  speed_bumps: { name: 'Hız Tümsekleri', icon: '〰️', desc: 'Trafik gürültüsü ve kaza riski azalır.', scope: 'district', unlock: 5 },
  parking_fees: { name: 'Yol Kenarı Park Ücretleri', icon: '🅿️', desc: 'Park geliri sağlar, mutluluğu biraz azaltır.', scope: 'district', unlock: 5 },
  gated: { name: 'Korunaklı Site', icon: '🚧', desc: 'Suç azalır, arazi değeri artar; çevre mutluluğu biraz düşer.', scope: 'district', unlock: 6 },
  high_tech_housing: { name: 'Yüksek Teknolojili Konutlar', icon: '🔌', desc: 'Konutların elektrik tüketimi azalır, seviye atlaması kolaylaşır.', scope: 'district', unlock: 8 },
};
