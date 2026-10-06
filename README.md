# 🏙️ Şehir Kurucu II

**Cities: Skylines II**'den esinlenen, tarayıcıda çalışan, sıfırdan yazılmış 3D şehir kurma oyunu.
Saf JavaScript (ES modülleri) + [three.js](https://threejs.org) ile yazıldı; derleme adımı yok, hiçbir dış servis gerektirmez.

> Not: Bu proje hayran yapımı bağımsız bir yeniden yorumlamadır. Paradox/Colossal Order'ın hiçbir varlığı (model, doku, ses, kod) kullanılmamıştır; tüm modeller prosedürel olarak üretilir.

## 🚀 Çalıştırma

```bash
npm start            # tarayıcı sürümü: http://localhost:8080
npm install && npm run desktop   # masaüstü (Electron) sürümü
```

### Platformlar
- **PC (Windows/macOS/Linux):** `desktop/` klasöründeki Electron sarmalayıcısı oyunu yerel bir uygulama olarak açar (`npm run desktop`). `npm run dist:win|dist:mac|dist:linux` komutları için `electron-builder` kurulmalıdır (`npm i -D electron-builder`).
- **Steam:** Yayın için Steamworks hesabı (Steam Direct ücreti), uygulama kimliği ve Steamworks SDK entegrasyonu (başarımlar, bulut kayıt) gerekir; Electron derlemesi Steam'e "depot" olarak yüklenir. Bu entegrasyon henüz yapılmadı.
- **Mobil:** Oyun dokunmatik kontrollerle mobil tarayıcıda çalışır (tek parmak kaydır/araç, iki parmak yakınlaştır/döndür, iki parmakla yukarı/aşağı sürükleyerek 3D eğim, 🎥 kamera görünümü ve diğer ekran düğmeleri). Uygulama mağazaları için Capacitor veya benzeri bir sarmalayıcıyla paketlenebilir.

Herhangi bir statik sunucu da olur (ör. `python3 -m http.server`). ES modülleri kullanıldığı için `index.html` dosyasını doğrudan çift tıklayarak (file://) açmak çalışmaz.

Testler (tarayıcı gerekmez, simülasyonu başsız çalıştırır):

```bash
npm test             # tests/sim.test.mjs + tests/bot.mjs
node tests/bot.mjs 60   # şehri 60 ay boyunca bir "bot belediye başkanı" ile yönetir
```

## 🎮 Kontroller

| Tuş / Fare | İşlev |
|---|---|
| `W A S D` / oklar | Kamerayı kaydır (`Shift` ile hızlı) |
| `Q` / `E` | Kamerayı döndür |
| `R` / `F` | Kamera eğimi (kuşbakışından yer seviyesine kadar serbest) |
| `V` | Kamera görünümü: klasik → alçak açı → sokak görünümü → kuşbakışı |
| Fare tekerleği, `+`/`-` | Yakınlaştır / uzaklaştır |
| Sağ tık sürükle | Kamerayı döndür ve eğ |
| Orta tık sürükle | Kamerayı kaydır |
| Sol tık | Aracı kullan / binayı seç |
| Sağ tık (sürüklemeden) | İptal / araçtan çık |
| `,` `.` | Yerleştirilen binayı döndür |
| `Ctrl+Z` | Son yol işlemini geri al |
| `[` `]` | Fırça boyutu |
| `Shift` + sürükle | Kaldırma modu (bölge, boru, hat, yol yükseltmesi, ilçe) |
| `Boşluk` | Duraklat / devam |
| `1` `2` `3` | Oyun hızı |
| `B` | Yıkım aracı |
| `I` `P` `M` `N` | Bilgi görünümleri / İlerleme / Ekonomi / İstatistik |
| `F5` / `F9` | Hızlı kaydet / hızlı yükle |
| `Esc` | İptal, paneli kapat, ana menü |

## 🆕 Sürüm 0.3 – CS2 arayüzü
- **Ana menü** (arkada dönen demo şehir): Devam Et, Yeni Oyun, Oyun Yükle, Seçenekler, Krediler, Çıkış
- **Yeni Oyun ekranı:** 6 harita (Yeşil Vadi, Göl Kıyısı, Mavi Körfez, Dağ Geçidi, Kuzey Ovası, Tropik Adalar), 4 iklim, harita önizlemesi, kaynak/bağlantı bilgisi, tema (Avrupa / Kuzey Amerika), soldan trafik, doğal afetler, sınırsız para, tüm kilitleri aç
- **Oyun Yükle ekranı:** küçük resimli kayıtlar, nüfus/para/harita/kilometre taşı bilgisi; otomatik kayıt
- **Seçenekler:** Genel, Grafik (kalite ön ayarları Çok Düşük–Yüksek, çözünürlük ölçeği, gölgeler, ağaç ayrıntısı, araç yoğunluğu, FPS sınırı…), Oynanış, Arayüz (ölçek, 24 saat…), Ses, Klavye (tuş atama), Fare, Dokunmatik
- **Duraklatma menüsü:** Devam Et, Kaydet, Yükle, Seçenekler, Ana Menüye Dön
- **CS2 sol panelleri:** her araçta üstte seçili öğe bilgisi, altta araç seçenekleri
- **Yol aracı modları:** Düz (her açı), Kavisli, Sürekli, Izgara, Değiştir; açı/uzunluk/mevcut yol yapıştırma; yükseklik (zemin / yükseltilmiş / tünel); paralel mod; geri al (Ctrl+Z)
- **8 yönlü yol ağı:** çapraz ve kavisli yollar; paralel yollar artık birbirine kendiliğinden bağlanmaz

## ✅ Cities: Skylines II özellik listesi ve oyundaki karşılıkları

CS2'nin özellikleri tek tek ele alınıp (kilometre taşı listesi, bölge türleri, hizmet binaları, gelişim ağacı, politikalar, bilgi görünümleri vb.) oyuna eklendi:

### Harita ve arazi
- 160×160 hücrelik (8 m'lik CS2 hücresi) prosedürel harita: tepeler, kenarlarda dağlar, kıvrılan nehir, göl
- **Harita karoları**: 10×10 karo; başlangıçta 3×3, kilometre taşlarıyla satın alınabilir karo sayısı artar
- **Doğal kaynaklar**: verimli toprak, orman, petrol, cevher (+ yeraltı suyu ve rüzgar haritaları)
- **Arazi düzenleme**: yükselt, alçalt, düzle, yumuşat (su seviyesinin altına inen yerler suyla dolar – kanal kazabilirsiniz)
- Ağaç dikme/kesme; ormanlar hava kirliliğini azaltır ve turizmi artırır
- Başlangıçta otoyol ve yüksek gerilim **dış bağlantısı**

### Yollar ve ulaşım
- Küçük yol, toprak yol, orta yol, büyük bulvar (refüjlü), toplu taşıma şeritli yol, otoyol, yaya yolu
- **Pürüzsüz yol geometrisi** (CS2 gibi): yollar 2 m aralıklı eğri şeritler olarak saklanır ve çizilir; kavisler, köşe yuvarlama, kusursuz T kavşaklar (uçlar mevcut yola yapışır), kavşak dolguları, yaya geçitleri, çıkmaz sokak uçları
- Yol çizerken yarı saydam **hayalet yol önizlemesi**; araçlar eğrileri Catmull-Rom ile izler
- Su üzerinden çekilen yollar otomatik **köprü** olur: tabliye, korkuluklar (dikmeli), ayaklar ve yumuşak rampalar; köprü ve köprü başlarının yanına bölge/bina konamaz
- Otoyollarda bariyerler, eğimli arazide yokuşlar, sokak lambaları
- **Yol yükseltmeleri**: ağaçlar, çim şerit, hız tümseği
- Düz, kavisli, sürekli, ızgara ve değiştir modları; yükseltilmiş yollar ve tüneller
- Yolların altından geçen alçak gerilim (CS2'deki gibi yollar elektrik taşır)
- **Trafik simülasyonu**: A* ile yol bulan yolculuklar (ev→iş, ev→alışveriş, sanayi kamyonları), sıkışıklık, trafik akışı istatistiği, hareketli araçlar
- **Toplu taşıma hatları**: Otobüs, Tramvay (tramvay rayı ile), Metro (yeraltı tünel + istasyon), Tren (ray + istasyon); depo/garaj gereksinimi, araç sayısı, yolcu ve bilet geliri, hat renkleri
- Taksi garajı, otopark, liman, havalimanı, kargo tren terminali (ticaret ve turizm)

### Bölgeleme (CS2 bölge türleri)
- Konut: düşük yoğunluklu, orta yoğunluklu sıra evler, orta yoğunluklu, **düşük kiralı**, **karma (zemin kat dükkân)**, yüksek yoğunluklu
- Ticari: düşük / yüksek yoğunluk · Ofis: düşük / yüksek yoğunluk · Sanayi
- **Özel sanayi**: tarım, ormancılık, petrol, madencilik (yalnızca ilgili kaynak üzerinde)
- Yoldan 6 hücre derinliğe kadar imar ızgarası; dikdörtgen, fırça ve **doldur** modları
- Parseller yola bakacak şekilde otomatik oluşur; inşaat (iskele ve vinçlerle), **5 bina seviyesi**, terk edilme, yangında yıkılma

### Simülasyon
- **RCI(O) talebi**: konut (düşük/orta/yüksek ayrı), ticari, sanayi, ofis
- Haneler, nüfus, yaş grupları, **5 eğitim seviyesi**, eğitim seviyesine göre iş eşleştirme, işsizlik
- **Mutluluk**: altyapı, hizmetler, kirlilik, suç, vergi, ücretler, işsizlik, arazi değeri, simge yapılar
- **Arazi değeri**, **kirlilik** (toprak, hava, gürültü, su – sanayi, santraller, trafik, çöp sahaları, kanalizasyon çıkışları)
- Kirli suyu pompalayan pompalar hastalığa yol açar (CS2'deki gibi çıkışı akıntı yönüne koyun!)
- Hastalık, ölüm, cenaze toplama; çöp birikmesi; suç
- **Üretim zinciri**: ham madde → işlenmiş ürün → ticari tüketim; ithalat/ihracat (Üretim paneli)
- **Turizm**: çekicilik, turist sayısı, turizm geliri

### Şehir hizmetleri (60+ bina)
- **Elektrik**: rüzgar türbini (dönen pervaneler, rüzgara bağlı), küçük/büyük kömür, güneş (gündüz/bulut), doğalgaz, jeotermal, hidroelektrik, nükleer, batarya; yüksek gerilim hatları; dış bağlantıdan ithalat/ihracat
- **Su ve kanalizasyon**: kıyı pompası, yeraltı suyu pompası, su kulesi, büyük filtreli pompa, kanalizasyon çıkışı, arıtma tesisi; su ve kanalizasyon boruları (tek tıkla "tüm yollara boru döşe")
- **Sağlık ve defin**: sağlık ocağı, hastane, hastalık kontrol, tıbbi araştırma, mezarlık (dolar), krematoryum
- **Çöp**: çöp sahası (dolar), yakma tesisi (elektrik üretir), geri dönüşüm, aktarma istasyonu
- **Eğitim**: ilkokul, lise, meslek yüksekokulu, üniversite, araştırma tesisi (gelişim puanı üretir)
- **İtfaiye**: itfaiye binası/istasyonu, yangın helikopteri, erken uyarı sistemi, sığınak
- **Polis ve yönetim**: karakol, emniyet müdürlüğü, cezaevi, istihbarat, belediye binası, sosyal yardım ofisi
- **Parklar**: küçük park, oyun parkı, köpek parkı, meydan, kamp ateşi, şehir parkı, spor sahası, botanik bahçesi, hayvanat bahçesi
- **İletişim**: postane, posta ayrıştırma, radyo direği, telekom merkezi
- **Simge yapılar ve imza binalar**: imza konut/ticari/sanayi/ofis binaları, stadyum, TV kulesi, katedral, opera
- Hizmet kapsamı **yol mesafesiyle** hesaplanır; kapasite, çalışan, bütçe ve elektrik verimi etkiler; bina **eklentileri** (ör. hastane laboratuvarı)
- Hizmet araçları (itfaiye) olay yerine yol bularak gider

### İlerleme
- CS2'nin **20 kilometre taşı** (Minik Köy → Megalopolis): para ödülü, gelişim puanı, karo izni, kredi limiti ve kilitler
- **Gelişim ağacı**: 11 hizmet kategorisi için gelişim puanıyla açılan düğümler (1/2/4/8 puan)
- Özellik kilitleri: vergi kontrolü, hizmet bütçeleri, ilçeler, politikalar, afetler, üretim paneli…

### Ekonomi
- Bölge başına **vergiler**, **hizmet bütçeleri** (%50–150), **hizmet ücretleri** (elektrik, su, çöp, sağlık, eğitim, toplu taşıma)
- **Krediler** (kilometre taşına bağlı limit, faiz), ayrıntılı gelir/gider tablosu

### Yönetim
- **İlçeler** (boyama, isimlendirme) ve **ilçe politikaları**: ağır trafik yasağı, içten yanmalı motor yasağı, hız tümsekleri, park ücretleri, korunaklı site, yüksek teknolojili konutlar
- **Şehir politikaları**: enerji/su bilinci, gelişmiş kirlilik yönetimi, şehir tanıtımı, ücretsiz toplu taşıma, geri dönüşüm, erken tahliye, taksi ücreti, sigarasız şehir

### Dünya ve olaylar
- **Gün/gece döngüsü** (gece yanan pencereler ve sokak lambaları), **mevsimler** (yapraklar sonbaharda sararır, kışın dökülür), **hava durumu** (yağmur, kar örtüsü, sis, fırtına), sıcaklık (ısınma için elektrik tüketimi)
- **Doğal afetler**: hortum, yıldırım (fırtınada), orman yangını; erken uyarı ve sığınaklar kayıpları azaltır
- Bina yangınları, yangının yayılması, itfaiye müdahalesi

### Arayüz
- CS2 tarzı araç çubuğu ve açılır menüler, kilitli öğeler ve ipuçları
- **28 bilgi görünümü** (elektrik, su, kanalizasyon, arazi değeri, 4 kirlilik türü, trafik, mutluluk, suç, tüm hizmetler, eğitim, seviye, bölgeler, kaynaklar, yeraltı suyu, rüzgar, ilçeler, karolar…)
- Bina denetçisi (sakinler, çalışanlar, seviye ilerlemesi, kapsam, sorunlar, eklentiler), bina üstü sorun simgeleri
- İstatistik grafikleri, üretim paneli, ulaşım genel bakış
- **Chirper** (vatandaşların şehir hakkındaki paylaşımları) ve **Yaşam Yolu** (vatandaş takibi)
- Kaydet/yükle (tarayıcı deposu), JSON dosyasına dışa/içe aktarma, hızlı kayıt, ayarlar

## 🧱 Mimari

```
index.html, css/style.css
js/main.js             oyun döngüsü, kayıt, ses
js/core/               sabitler, RNG/gürültü, durum + harita üretimi + serileştirme
js/data/               yollar, bölgeler, hizmetler, kilometre taşları, gelişim ağacı, politikalar, isimler
js/sim/                simülasyon (tarayıcıdan bağımsız, Node'da test edilebilir)
  simulation.js          ana tik döngüsü (120 tik = 1 ay)
  actions.js             oyuncu eylemleri ve doğrulama
  growth.js              imar, parsel üretimi, büyüme, seviye, terk edilme
  network.js             yol bağlantısı, A* yol bulma, Dijkstra
  utilities.js           elektrik/su/kanalizasyon şebekeleri
  coverage.js            hizmet kapsama alanları
  citizens.js            nüfus, iş eşleştirme, eğitim, sağlık, suç, mutluluk
  environment.js         kirlilik ve arazi değeri
  economy.js             vergiler, giderler, talep, üretim, turizm
  transit.js             toplu taşıma hatları ve trafik
  events.js, weather.js  yangın/afetler, hava/mevsimler
  progression.js, chirper.js
js/render/             three.js çizimi (örneklenmiş mesh'ler, prosedürel binalar, pencere gölgelendiricisi)
js/ui/                 arayüz, paneller, araçlar
tests/                 başsız simülasyon testleri
```

## Kaynaklar

Özellik listesi için yararlanılan kaynaklar: Cities: Skylines II resmi özellik tanıtımları ve CS2 Wiki (kilometre taşları, bölgeleme, hizmet binaları, gelişim ağacı), ör. [Dexerto – Milestones](https://www.dexerto.com/gaming/cities-skylines-2-milestones-explained-all-rewards-2348210/), [CS2 Wiki – Zoning](https://cs2.paradoxwikis.com/Zoning), [CS2 Wiki – Service buildings](https://cs2.paradoxwikis.com/Service_buildings), [GameRant – Development Tree](https://gamerant.com/cities-skylines-2-every-development-tree-and-what-to-buy-first/).

three.js MIT lisanslıdır (`js/vendor/THREE_LICENSE`).
