// Kalıcı oyun seçenekleri (tüm şehirler için ortak) – CS2 Seçenekler menüsü
const KEY = 'sk2_options';
export const IS_TOUCH = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && matchMedia('(pointer: coarse)').matches;

export const GRAPHICS_PRESETS = {
  very_low: { resScale: 0.6, shadows: 'off', treeDetail: 'low', vehicleDensity: 0.35, pedestrians: false, particles: false, waterQuality: 'low', fog: true, maxFps: 30 },
  low: { resScale: 0.8, shadows: 'off', treeDetail: 'medium', vehicleDensity: 0.6, pedestrians: true, particles: true, waterQuality: 'low', fog: true, maxFps: 60 },
  medium: { resScale: 1, shadows: 'medium', treeDetail: 'high', vehicleDensity: 1, pedestrians: true, particles: true, waterQuality: 'high', fog: true, maxFps: 60 },
  high: { resScale: 1.25, shadows: 'high', treeDetail: 'high', vehicleDensity: 1.3, pedestrians: true, particles: true, waterQuality: 'high', fog: true, maxFps: 0 },
};

export const DEFAULT_OPTIONS = {
  general: { autosave: true, autosaveMin: 10, tutorial: true, pauseOnBlur: false },
  graphics: { preset: IS_TOUCH ? 'low' : 'medium', ...GRAPHICS_PRESETS[IS_TOUCH ? 'low' : 'medium'], dayNight: true, weatherFx: true, antialias: !IS_TOUCH, fullscreen: false },
  gameplay: { edgeScroll: false, disasters: true, autoDemolish: true, tempUnit: 'C', camSpeed: 1, leftHand: false },
  interface: { uiScale: IS_TOUCH ? 1 : 1, tooltips: true, clock24: true, icons: true, chirperToasts: true, hints: true },
  audio: { master: 0.8, ui: 0.7, ambient: 0.4, mute: false },
  keys: {
    panUp: 'KeyW', panDown: 'KeyS', panLeft: 'KeyA', panRight: 'KeyD', rotLeft: 'KeyQ', rotRight: 'KeyE', tiltUp: 'KeyR', tiltDown: 'KeyF', zoomIn: 'Equal', zoomOut: 'Minus', camView: 'KeyV',
    pause: 'Space', speed1: 'Digit1', speed2: 'Digit2', speed3: 'Digit3', bulldoze: 'KeyB', infoviews: 'KeyI', progression: 'KeyP', economy: 'KeyM', stats: 'KeyN',
    rotBldLeft: 'Comma', rotBldRight: 'Period', brushDown: 'BracketLeft', brushUp: 'BracketRight', quicksave: 'F5', quickload: 'F9',
  },
  mouse: { invertX: false, invertY: false, rotSens: 1, zoomSens: 1, panSens: 1 },
  touch: { pinchSens: 1, twist: true, panSens: 1, camButtons: true, confirmPlace: true },
};

export const KEY_NAMES = {
  panUp: 'Kamera ileri', panDown: 'Kamera geri', panLeft: 'Kamera sola', panRight: 'Kamera sağa', rotLeft: 'Sola döndür', rotRight: 'Sağa döndür', tiltUp: 'Eğimi artır', tiltDown: 'Eğimi azalt', zoomIn: 'Yakınlaştır', zoomOut: 'Uzaklaştır', camView: 'Kamera görünümü (kuşbakışı / sokak)',
  pause: 'Duraklat / Devam', speed1: 'Hız 1', speed2: 'Hız 2', speed3: 'Hız 3', bulldoze: 'Yıkım aracı', infoviews: 'Bilgi görünümleri', progression: 'İlerleme', economy: 'Ekonomi', stats: 'İstatistikler',
  rotBldLeft: 'Binayı sola döndür', rotBldRight: 'Binayı sağa döndür', brushDown: 'Fırçayı küçült', brushUp: 'Fırçayı büyüt', quicksave: 'Hızlı kaydet', quickload: 'Hızlı yükle',
};

function deepMerge(a, b) {
  const out = Array.isArray(a) ? a.slice() : { ...a };
  for (const k in b) out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] ? deepMerge(a[k], b[k]) : b[k];
  return out;
}

let current = null;
const listeners = new Set();

export function options() {
  if (current) return current;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
  current = deepMerge(DEFAULT_OPTIONS, saved);
  return current;
}
export function saveOptions() { try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* depo kapalı */ } }
export function setOption(section, key, value) {
  const o = options();
  o[section][key] = value;
  if (section === 'graphics' && key !== 'preset' && key in GRAPHICS_PRESETS.medium) o.graphics.preset = 'custom';
  if (section === 'graphics' && key === 'preset' && GRAPHICS_PRESETS[value]) Object.assign(o.graphics, GRAPHICS_PRESETS[value]);
  saveOptions();
  for (const fn of listeners) fn(section, key, value);
}
export function resetOptions(section) {
  const o = options();
  if (section) o[section] = JSON.parse(JSON.stringify(DEFAULT_OPTIONS[section])); else current = JSON.parse(JSON.stringify(DEFAULT_OPTIONS));
  saveOptions();
  for (const fn of listeners) fn(section || '*', null, null);
}
export function onOptions(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function keyLabel(code) {
  if (!code) return '—';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Space', 'Boşluk').replace('Comma', ',').replace('Period', '.').replace('BracketLeft', '[').replace('BracketRight', ']').replace('Equal', '+').replace('Minus', '-')
    .replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('Escape', 'Esc');
}
