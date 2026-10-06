// Harita ön ayarları (CS2: Yeni Oyun → harita seçimi)
export const CLIMATES = {
  temperate: { name: 'Ilıman', temps: [-2, 0, 5, 11, 16, 20, 23, 22, 17, 11, 5, 0] },
  cold: { name: 'Soğuk (Kuzey)', temps: [-12, -10, -4, 3, 10, 15, 18, 16, 10, 3, -4, -9] },
  warm: { name: 'Akdeniz', temps: [9, 10, 13, 16, 20, 25, 28, 28, 24, 19, 14, 10] },
  tropical: { name: 'Tropikal', temps: [24, 25, 26, 27, 28, 28, 28, 28, 27, 27, 26, 25] },
};

export const MAPS = [
  { key: 'valley', name: 'Yeşil Vadi', desc: 'Kıvrılan bir nehrin böldüğü verimli vadi. Yeni başlayanlar için ideal.', climate: 'temperate', seed: 1001,
    river: { x: 0.565, amp: 6, width: 3.2 }, lakes: [{ x: 0.2, z: 0.82, r: 14 }], sea: null, mountains: 55, rough: 9, forest: 0.22, fertile: 0.18, oil: 0.42, ore: 0.25, rail: true, ship: false, air: true },
  { key: 'lake', name: 'Göl Kıyısı', desc: 'Büyük bir gölün kenarında, ormanlarla çevrili sakin bir arazi.', climate: 'temperate', seed: 2024,
    river: null, lakes: [{ x: 0.66, z: 0.42, r: 22 }, { x: 0.25, z: 0.2, r: 9 }], sea: null, mountains: 40, rough: 10, forest: 0.12, fertile: 0.22, oil: 0.5, ore: 0.3, rail: true, ship: false, air: true },
  { key: 'bay', name: 'Mavi Körfez', desc: 'Doğusu denize açılan sıcak bir kıyı. Liman ve turizm için harika.', climate: 'warm', seed: 3131,
    river: { x: 0.45, amp: 4, width: 2.4, toSea: true }, lakes: [], sea: { side: 'east', w: 0.33 }, mountains: 45, rough: 8, forest: 0.32, fertile: 0.2, oil: 0.36, ore: 0.3, rail: true, ship: true, air: true },
  { key: 'pass', name: 'Dağ Geçidi', desc: 'Karlı dağların arasında dar bir vadi. Zengin maden yatakları, zorlu arazi.', climate: 'cold', seed: 4646,
    river: { x: 0.6, amp: 8, width: 2.8 }, lakes: [{ x: 0.3, z: 0.3, r: 8 }], sea: null, mountains: 85, rough: 16, forest: 0.1, fertile: 0.3, oil: 0.55, ore: 0.1, rail: true, ship: false, air: false },
  { key: 'plains', name: 'Kuzey Ovası', desc: 'Geniş, düz tarım ovası. Bol verimli toprak ve petrol.', climate: 'cold', seed: 5757,
    river: { x: 0.58, amp: 9, width: 2.4 }, lakes: [], sea: null, mountains: 20, rough: 4, forest: 0.3, fertile: 0.05, oil: 0.32, ore: 0.4, rail: true, ship: false, air: true },
  { key: 'islands', name: 'Tropik Adalar', desc: 'Turkuaz denizle çevrili büyük bir ada. Turizm cenneti, sınırlı alan.', climate: 'tropical', seed: 6868,
    river: null, lakes: [{ x: 0.56, z: 0.58, r: 6 }], sea: { side: 'ring', w: 0.24 }, mountains: 35, rough: 9, forest: 0.18, fertile: 0.25, oil: 0.6, ore: 0.35, rail: false, ship: true, air: true },
];
export const mapByKey = (k) => MAPS.find((m) => m.key === k) || MAPS[0];
