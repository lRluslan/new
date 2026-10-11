// Visual styles. Each style has its own sky and far-off hills, an accent
// colour for the interface, and a colour grade: a function that recolours
// every pixel of the world. The grade is baked into a lookup table once, so
// switching styles is instant and drawing stays fast.

// Background layers, far to near: body, highlight, shadow and trunk colours.
const AUTUMN_LAYERS = [
  { body: '#d9b568', hi: '#e8c77c', lo: '#c7a15b', trunk: '#c29a57' },
  { body: '#a69849', hi: '#c2b257', lo: '#8a7e3c', trunk: '#7f6a3a' },
  { body: '#5f7b34', hi: '#97a43d', lo: '#465f2b', trunk: '#5a4027' },
];

export const STYLES = [
  {
    id: 'autumn', name: 'Autumn', desc: 'Warm golden light and turning leaves.',
    sky: ['#e3a248', '#eab55a', '#f0c66c', '#f4d27f', '#f7dd95', '#f8e4a8'], layers: AUTUMN_LAYERS,
    accent: '#e8b24a', ink: '#1d1406',
  },
  {
    id: 'meadow', name: 'Meadow', desc: 'A fresh spring day under a blue sky.',
    sky: ['#5aa8e0', '#6eb6e6', '#86c4ec', '#a0d2f0', '#b8def2', '#cfe8f4'],
    layers: [
      { body: '#a8d0a0', hi: '#bcdcb2', lo: '#94c08e', trunk: '#8aa880' },
      { body: '#78b05a', hi: '#8cc46a', lo: '#62984a', trunk: '#6a7a4a' },
      { body: '#3e8a3a', hi: '#5aa84a', lo: '#2e6e2e', trunk: '#4a3a24' },
    ],
    accent: '#7cc04a', ink: '#0e1a06',
    grade: (h, s, v) => [h + 42 * bump(h, 52, 28), Math.min(1, s * 1.08), Math.min(1, v * 1.04)],
  },
  {
    id: 'teal', name: 'Teal forest', desc: 'Deep teal woods, cool and calm.',
    sky: ['#0e3436', '#123d3f', '#164a4a', '#1d5a57', '#256a64', '#2e7a70'],
    layers: [
      { body: '#1e5a54', hi: '#256a62', lo: '#184a46', trunk: '#163e3a' },
      { body: '#1a4e46', hi: '#21604f', lo: '#143e38', trunk: '#12302c' },
      { body: '#16443a', hi: '#1f5a48', lo: '#10342c', trunk: '#3a2a1e' },
    ],
    accent: '#5ed6bc', ink: '#032019',
    grade: (h, s, v) => [h + 110 * bump(h, 58, 30) + 40 * bump(h, 110, 45), s * 0.9, v * 0.82],
  },
  {
    id: 'winter', name: 'Winter', desc: 'Pale, frosty and quiet.',
    sky: ['#9fb4c8', '#adc0d2', '#bccbda', '#cad6e2', '#d8e2ea', '#e4ecf2'],
    layers: [
      { body: '#d4dee6', hi: '#e6eef4', lo: '#c2ced8', trunk: '#aab6c0' },
      { body: '#b4c2ce', hi: '#cad6e0', lo: '#9eacb8', trunk: '#7a8894' },
      { body: '#7e8e9a', hi: '#a6b4c0', lo: '#66747e', trunk: '#4a4038' },
    ],
    accent: '#a8d4f0', ink: '#0a1620',
    grade: (h, s, v) => [h - 12 * bump(h, 40, 60), s * 0.55, Math.min(1, v * 1.06)],
  },
  {
    id: 'desert', name: 'Desert sunset', desc: 'Dusky purples and burnt orange.',
    sky: ['#4a2a5a', '#6e3a62', '#9a4a5e', '#c8644e', '#e88a4a', '#f4b060'],
    layers: [
      { body: '#c87a52', hi: '#d88e60', lo: '#b06a46', trunk: '#9a5a3a' },
      { body: '#a85a3e', hi: '#bc6c48', lo: '#904a34', trunk: '#7a3e2a' },
      { body: '#7a4030', hi: '#965038', lo: '#623226', trunk: '#4a2a1e' },
    ],
    accent: '#f08a4a', ink: '#200c04',
    grade: (h, s, v) => [h - 45 * bump(h, 110, 60), Math.min(1, s * 1.1), v * 0.96],
  },
  {
    id: 'synthwave', name: 'Synthwave', desc: 'Neon pinks and cyans in the dark.',
    sky: ['#120824', '#1e0c36', '#2e1048', '#4a1458', '#7a1e6a', '#c03a7a'],
    layers: [
      { body: '#3a1458', hi: '#52207a', lo: '#2a0e42', trunk: '#220a36' },
      { body: '#2a0e46', hi: '#3e1866', lo: '#1e0a34', trunk: '#180828' },
      { body: '#1a0a2e', hi: '#2c1450', lo: '#120620', trunk: '#0e0418' },
    ],
    accent: '#ff5ac8', ink: '#22041a',
    grade: (h, s, v) => [h < 25 ? h : h < 90 ? 320 : h < 210 ? 185 : h, Math.min(1, s * 1.35 + 0.1), v * 0.8],
  },
  {
    id: 'candy', name: 'Candy', desc: 'Soft pastel colours.',
    sky: ['#f4b4d0', '#f6c2d8', '#f8d0e0', '#fadce6', '#fce6ec', '#fdf0f4'],
    layers: [
      { body: '#e8c8e8', hi: '#f2d8f2', lo: '#dab8dc', trunk: '#c8a8c8' },
      { body: '#c8b8ec', hi: '#d8caf4', lo: '#b4a4dc', trunk: '#a090c4' },
      { body: '#a8d8c8', hi: '#bce6d8', lo: '#94c8b6', trunk: '#b08a9a' },
    ],
    accent: '#f48ac0', ink: '#2a0a1a',
    grade: (h, s, v) => [h, s * 0.55, Math.min(1, v * 0.8 + 0.25)],
  },
  {
    id: 'gameboy', name: 'Game Boy', desc: 'Four shades of green, like 1989.',
    sky: null, layers: null, accent: '#9bbc0f', ink: '#0f380f',
    palette: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], byLight: true,
  },
  {
    id: 'retro16', name: 'Retro 16', desc: 'A classic 16-colour palette.',
    sky: null, layers: null, accent: '#ffa300', ink: '#1d2b53',
    palette: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
  },
  {
    id: 'noir', name: 'Noir', desc: 'Black and white. Only fire and blood keep their red.',
    sky: ['#2a2a2e', '#3a3a3e', '#4a4a4e', '#5c5c60', '#707074', '#858589'], layers: null,
    accent: '#e8e8e8', ink: '#111111', noir: true,
  },
];
export const STYLE_BY_ID = Object.fromEntries(STYLES.map(s => [s.id, s]));
for (const s of STYLES) { s.sky = s.sky || STYLES[0].sky; s.layers = s.layers || AUTUMN_LAYERS; }

// 1 at hue `at`, falling to 0 `width` degrees away (on the colour wheel).
function bump(h, at, width) {
  let d = Math.abs(((h - at) % 360 + 540) % 360 - 180);
  return d >= width ? 0 : 0.5 + 0.5 * Math.cos(d / width * Math.PI);
}

function rgbToHsv(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  return [(h + 360) % 360, max ? d / max : 0, max];
}
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); v = Math.max(0, Math.min(1, v));
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// A lookup table from a 15-bit colour (5 bits each of red, green and blue)
// to the style's packed colour, or null for a style that keeps colours as
// they are.
export function makeLut(style) {
  if (!style.grade && !style.palette && !style.noir) return null;
  const lut = new Uint32Array(32768);
  const pal = style.palette && style.palette.map(hex);
  // Game Boy: sort the four shades dark to light and pick by brightness.
  const lights = pal && style.byLight ? pal.map(c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) : null;
  for (let i = 0; i < 32768; i++) {
    let r = ((i & 31) << 3) | 4, g = (((i >> 5) & 31) << 3) | 4, b = (((i >> 10) & 31) << 3) | 4;
    if (style.grade) {
      const [h, s, v] = rgbToHsv(r / 255, g / 255, b / 255);
      [r, g, b] = hsvToRgb(...style.grade(h, s, v));
    } else if (style.noir) {
      const [h, s, v] = rgbToHsv(r / 255, g / 255, b / 255);
      const reddish = (h < 22 || h > 340) && s > 0.45 && v > 0.25;
      let l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
      l = l * l * (3 - 2 * l); // stronger contrast
      if (reddish) [r, g, b] = hsvToRgb(h, Math.min(1, s * 1.1), v);
      else { r = l * 235 + 6; g = l * 235 + 6; b = l * 240 + 8; }
    } else if (lights) {
      const l = 0.3 * r + 0.59 * g + 0.11 * b;
      const k = l < 60 ? 0 : l < 115 ? 1 : l < 175 ? 2 : 3;
      [r, g, b] = pal[k];
    } else {
      // Nearest palette colour, weighting green the most (as eyes do).
      let best = 0, bd = Infinity;
      for (let k = 0; k < pal.length; k++) {
        const dr = r - pal[k][0], dg = g - pal[k][1], db = b - pal[k][2];
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < bd) { bd = d; best = k; }
      }
      [r, g, b] = pal[best];
    }
    lut[i] = ((255 << 24) | (Math.round(b) << 16) | (Math.round(g) << 8) | Math.round(r)) >>> 0;
  }
  return lut;
}

// Recolour packed pixels in place, from index `from` to `to`. Fully
// transparent pixels (the empty parts of the creature layer) are left alone.
export function applyLut(buf, lut, from = 0, to = buf.length) {
  for (let p = from; p < to; p++) {
    const c = buf[p];
    if (c === 0) continue;
    buf[p] = lut[((c >> 3) & 31) | ((c >> 6) & 0x3e0) | ((c >> 9) & 0x7c00)];
  }
}
