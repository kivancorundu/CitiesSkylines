// Yaşam kalitesi denge sabitleri: fabrika kirliliği şikayetleri ve alışveriş erişimi (CS2 tarzı)

// Hava kirliliği maruziyeti (konut): polA + polG * POL_GROUND_W
export const POL_GROUND_W = 0.5;
export const POL_WARN = 0.18;       // bu değerin üstünde sakinler şikayet eder (sorun simgesi + Chirper)
export const POL_SEVERE = 0.6;     // bu değerin üstünde sakinler taşınır, terk edilme riski başlar
export const POL_HAPPY_K = 40;      // eşik üstü her birim maruziyet için mutluluk cezası
export const POL_HAPPY_MAX = 16;    // en fazla ek mutluluk cezası
export const NOISE_WARN = 0.85;     // gürültü şikayeti (yalnızca yazı, terk ettirmez)

// Alışveriş erişimi (yol ağı üzerinde hücre; 1 hücre = 8 m)
export const SHOP_RANGE = 70;       // ~560 m: sakinler daha uzağa alışverişe gitmez
export const SHOP_NEAR = 0.6;       // menzilin bu oranından sonra hafif mutsuzluk başlar
export const SHOP_HAPPY_PEN = 7;    // yakında market yoksa mutluluk cezası
export const SHOP_FAR_SHARE = 0.25; // marketi olmayan sakinlerin yine de (uzağa giderek) yaptığı alışveriş oranı
export const SHOP_DEMAND_K = 0.9;   // hizmet almayan nüfus oranı başına ek ticari talep
export const SHOP_DEMAND_MAX = 0.7;
export const SHOP_GRACE_MONTHS = 1; // yeni taşınılan binalarda sorun göstermeden önce bekleme

// Ticari binanın yerel müşteri havzası (kutu bulanıklaştırma yarıçapı, hücre)
export const CUST_R = 40;
export const CUST_LOW = 0.1;        // yerel müşteri oranı (sakin / (iş*9)) bunun altındaysa "müşteri az"
export const CUST_REL_LOW = 0.35;   // ve şehir genelindeki oranın bu katından da düşükse
export const CUST_WARN_TICKS = 36;  // ~3 ay (yavaş tik = 10 tik) sonra "Müşteri yok" yazısı
export const CUST_ISSUE_TICKS = 120; // ~10 ay sonra terk edilme sayacı işlemeye başlar
