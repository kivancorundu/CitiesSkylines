// Mevsimler, hava durumu, gün/gece döngüsü (CS2: iklim ve hava)
import { clamp } from '../core/constants.js';

export const CLIMATE = [-2, 0, 5, 11, 16, 20, 23, 22, 17, 11, 5, 0];
export const SEASONS = ['Kış', 'Kış', 'İlkbahar', 'İlkbahar', 'İlkbahar', 'Yaz', 'Yaz', 'Yaz', 'Sonbahar', 'Sonbahar', 'Sonbahar', 'Kış'];
export const WEATHER_NAMES = { clear: 'Açık', partly: 'Parçalı Bulutlu', cloudy: 'Bulutlu', rain: 'Yağmurlu', storm: 'Fırtınalı', snow: 'Karlı', fog: 'Sisli' };
export const WEATHER_ICONS = { clear: '☀️', partly: '⛅', cloudy: '☁️', rain: '🌧️', storm: '⛈️', snow: '🌨️', fog: '🌫️' };

export function season(s) { return SEASONS[s.time.month]; }

// Görsel saat: bir gün 3 ay sürer (gün/gece döngüsü daha yavaş ve akıcı)
export const DAY_MONTHS = 3;
export function clockHour(s) { return ((s.time.monthsElapsed * 24 + s.time.tod) / DAY_MONTHS + 7) % 24; }

export function daylightAt(month, tod) {
  // yaz günleri uzun, kış günleri kısa
  const len = 9 + 6 * Math.sin(((month - 2.5) / 12) * Math.PI * 2) * 0.5 + 3; // ~9..15 saat
  const rise = 12 - len / 2, set = 12 + len / 2;
  if (tod < rise - 1 || tod > set + 1) return 0;
  if (tod < rise + 1) return clamp((tod - (rise - 1)) / 2, 0, 1);
  if (tod > set - 1) return clamp((set + 1 - tod) / 2, 0, 1);
  return 1;
}

export function weatherTick(s) {
  const w = s.weather, t = s.time;
  const base = CLIMATE[t.month] + (CLIMATE[(t.month + 1) % 12] - CLIMATE[t.month]) * (t.tod / 24);
  const hour = clockHour(s);
  const diurnal = Math.sin(((hour - 9) / 24) * Math.PI * 2) * 4;
  const cloudCool = w.cloud * -2;
  w.temp += (base + diurnal + cloudCool - w.temp) * 0.05;
  w.timer -= 1;
  if (w.timer <= 0) {
    w.timer = 25 + Math.random() * 50;
    const cold = CLIMATE[t.month] < 2, warm = CLIMATE[t.month] > 15;
    const r = Math.random();
    let st;
    if (r < (warm ? 0.45 : 0.3)) st = 'clear';
    else if (r < 0.55) st = 'partly';
    else if (r < 0.7) st = 'cloudy';
    else if (r < 0.78) st = 'fog';
    else if (r < 0.95) st = cold ? 'snow' : 'rain';
    else st = cold ? 'snow' : 'storm';
    if (st === 'snow' && !cold) st = 'rain';
    w.state = st;
  }
  const targetCloud = { clear: 0.05, partly: 0.35, cloudy: 0.75, rain: 0.85, storm: 0.95, snow: 0.85, fog: 0.6 }[w.state];
  w.cloud += (targetCloud - w.cloud) * 0.05;
  w.rain += ((w.state === 'rain' ? 0.7 : w.state === 'storm' ? 1 : 0) - w.rain) * 0.08;
  w.snow += ((w.state === 'snow' && w.temp < 1.5 ? 1 : 0) - w.snow) * 0.08;
  if (w.snow > 0.3) w.snowCover = Math.min(1, w.snowCover + 0.01);
  else if (w.temp > 2) w.snowCover = Math.max(0, w.snowCover - 0.004 * (w.temp - 1));
  w.fog = w.state === 'fog' ? Math.min(1, (w.fog || 0) + 0.05) : Math.max(0, (w.fog || 0) - 0.05);
  w.windStrength = clamp(w.windStrength + (Math.random() - 0.5) * 0.06 + (w.state === 'storm' ? 0.02 : 0) - (w.windStrength - 0.55) * 0.02, 0.1, 1.2);
  s.rt.daylight = daylightAt(t.month, hour);
}
