// The home vista's time-of-day palettes, from the design project.
//
// One palette drives the WHOLE frame together — sky, every ridge row, the
// vegetation silhouettes, the sun/moon disc and its glow, the ground haze, and
// how much the stars and campfires read (lighting-mood's one-palette rule, in
// DOM form). Never tint a single layer on its own; move the palette.
export const PALETTES = {
  night: {
    label: 'Night',
    sky: 'linear-gradient(180deg,#01020a 0%,#03071a 13%,#061031 26%,#0a1842 39%,#102150 52%,#17284f 63%,#1d2b4a 73%,#222c42 84%,#242a38 94%)',
    ridges: ['#16224a', '#101a3a', '#0a122a', '#06091a', '#02040c'],
    veg: ['#080f24', '#04081a', '#01030c', '#000105'],
    lum: { x: 1200, y: 414, size: 128, glowSize: 640, ring: 250 },
    lumFill: 'radial-gradient(circle at 38% 34%,#ffffff 0%,#fdfeff 48%,#eaf0ff 66%,rgba(226,235,255,.42) 74%,rgba(223,232,255,0) 82%)',
    glowFill: 'radial-gradient(circle,rgba(206,226,255,.42) 0%,rgba(158,192,255,.15) 30%,rgba(140,178,255,0) 64%)',
    moonlight: 'radial-gradient(ellipse at center,rgba(174,202,255,.3) 0%,rgba(150,184,255,.14) 26%,rgba(130,168,250,.05) 48%,rgba(120,160,250,0) 70%)',
    haze: 'linear-gradient(180deg,rgba(96,134,220,0) 0%,rgba(70,106,200,.1) 58%,rgba(52,86,176,.18) 100%)',
    stars: 1,
    night: 1,
    fire: 1,
  },
  dusk: {
    label: 'Dusk',
    sky: 'linear-gradient(180deg,#05040f 0%,#0b0722 13%,#170b31 26%,#28103f 39%,#3f1544 52%,#571a41 64%,#75243c 76%,#963a36 88%,#b8583a 96%)',
    ridges: ['#2a1a44', '#1e1234', '#140b26', '#0a0518', '#04020c'],
    veg: ['#150a22', '#0b0416', '#04010a', '#010004'],
    lum: { x: 1200, y: 416, size: 122, glowSize: 600, ring: 236 },
    lumFill: 'radial-gradient(circle at 38% 34%,#fffdf8 0%,#faf2ff 46%,#e6dcf8 62%,rgba(230,220,248,.26) 71%,rgba(230,220,248,0) 79%)',
    glowFill: 'radial-gradient(circle,rgba(226,188,255,.26) 0%,rgba(196,152,255,.1) 32%,rgba(190,146,255,0) 66%)',
    moonlight: 'radial-gradient(ellipse at center,rgba(232,168,190,.26) 0%,rgba(210,140,170,.12) 26%,rgba(200,130,160,.04) 48%,rgba(200,130,160,0) 70%)',
    haze: 'linear-gradient(180deg,rgba(190,96,88,0) 0%,rgba(176,84,78,.12) 58%,rgba(164,74,70,.2) 100%)',
    stars: 0.8,
    night: 0.7,
    fire: 1,
  },
  dawn: {
    label: 'Before dawn',
    sky: 'linear-gradient(180deg,#01050c 0%,#04101c 13%,#07202c 26%,#0b3038 39%,#11423e 52%,#1a5147 63%,#2e5c48 74%,#5c6244 86%,#8a6b3f 96%)',
    ridges: ['#123240', '#0d2530', '#081a22', '#041016', '#010709'],
    veg: ['#07171e', '#030d12', '#010609', '#000304'],
    lum: { x: 1200, y: 418, size: 120, glowSize: 620, ring: 232 },
    lumFill: 'radial-gradient(circle,#fffef8 0%,#fff6de 46%,#ffe8b4 62%,rgba(255,222,158,.28) 71%,rgba(255,214,140,0) 79%)',
    glowFill: 'radial-gradient(circle,rgba(255,222,164,.28) 0%,rgba(255,196,120,.1) 32%,rgba(255,190,110,0) 66%)',
    moonlight: 'radial-gradient(ellipse at center,rgba(196,236,214,.24) 0%,rgba(160,214,196,.1) 26%,rgba(150,206,190,.04) 48%,rgba(150,206,190,0) 70%)',
    haze: 'linear-gradient(180deg,rgba(120,190,170,0) 0%,rgba(96,166,150,.1) 58%,rgba(84,150,138,.18) 100%)',
    stars: 0.62,
    night: 0.4,
    fire: 0.95,
  },
  day: {
    label: 'Overcast',
    sky: 'linear-gradient(180deg,#071420 0%,#0d2130 13%,#13323f 26%,#1b4550 39%,#265459 52%,#365e58 64%,#4d6a54 78%,#6e7450 90%,#8a7c52 97%)',
    ridges: ['#1c3f4a', '#152f38', '#0e2028', '#071319', '#030a0d'],
    veg: ['#0b1c22', '#051013', '#020809', '#000405'],
    lum: { x: 1200, y: 420, size: 110, glowSize: 560, ring: 220 },
    lumFill: 'radial-gradient(circle,#fffefa 0%,#fbf8ec 48%,rgba(248,244,224,0) 74%)',
    glowFill: 'radial-gradient(circle,rgba(236,240,224,.24) 0%,rgba(214,222,204,.08) 34%,rgba(210,218,200,0) 66%)',
    moonlight: 'radial-gradient(ellipse at center,rgba(206,226,222,.2) 0%,rgba(176,202,200,.08) 26%,rgba(170,196,194,.03) 48%,rgba(170,196,194,0) 70%)',
    haze: 'linear-gradient(180deg,rgba(150,184,190,0) 0%,rgba(128,164,172,.1) 58%,rgba(112,148,158,.16) 100%)',
    stars: 0.1,
    night: 0.15,
    fire: 0.8,
  },
};

// The vista follows the player's own clock, so opening the game at midnight
// looks like midnight. `?time=dusk` (or #home?time=dusk) pins one for review.
export function paletteKeyForNow(override = null) {
  if (override && PALETTES[override]) return override;
  const h = new Date().getHours();
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}
