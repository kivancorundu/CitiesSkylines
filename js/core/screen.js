// Ekran yönü: telefonda oyun her zaman yatay oynanır. Cihaz dikey tutuluyorsa (veya otomatik döndürme kapalıysa)
// tüm arayüz CSS ile 90° döndürülür; dokunma/fare koordinatları buradaki dönüşümle oyun düzenine çevrilir.
export const SCR = { rot: false };

export const layoutW = () => (SCR.rot ? window.innerHeight : window.innerWidth);
export const layoutH = () => (SCR.rot ? window.innerWidth : window.innerHeight);

// ekran (viewport) koordinatı → oyun düzeni koordinatı
export function toLayout(x, y) { return SCR.rot ? [y, window.innerWidth - x] : [x, y]; }

// mode: 'landscape' (zorla yatay) | 'auto' (cihaz yönünü izle)
export function applyOrientation(mode, touch) {
  const rot = !!touch && mode === 'landscape' && window.innerHeight > window.innerWidth;
  SCR.rot = rot;
  const b = document.body, r = document.documentElement.style;
  b.classList.toggle('rot', rot);
  if (rot) { b.style.width = window.innerHeight + 'px'; b.style.height = window.innerWidth + 'px'; } else { b.style.width = ''; b.style.height = ''; }
  r.setProperty('--vw', layoutW() / 100 + 'px');
  r.setProperty('--vh', layoutH() / 100 + 'px');
  b.classList.toggle('land', !!touch && layoutW() > layoutH());
  return rot;
}

// tam ekrandayken gerçek yön kilidi (Android Chrome); başarılı olursa döndürmeye gerek kalmaz
export function lockLandscape() {
  try { const p = screen.orientation?.lock?.('landscape'); if (p && p.catch) p.catch(() => {}); } catch { /* desteklenmiyor */ }
}
