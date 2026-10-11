// Renderer: draws the world one pixel per cell, scaled up with crisp edges.
// The art direction is a green forest: misty layers of trees behind, sunbeams
// through the canopy, mossy rocks and lush grass. Colours are picked per cell
// and shaded by how deep a cell sits below the open air (grass tops, lit leaf
// edges, darker deep water).

import * as El from './elements.js';
import { rng } from './scenes.js';
import { drawCreature, blend as blendC } from './creatureArt.js';

const MOB_S = 3; // creature pixels per world cell: creatures are drawn finer than the world

const {
  EMPTY, STONE, DIRT, SAND, SNOW, WATER, OIL, ACID, LAVA, SMOKE, FIRE, WOOD, PLANT,
  ICE, GLASS, SEED, SALT, BRINE, MUD, BRICK, COAL, MOLTEN, MERCURY, HONEY, FUSE, CLONER, DRAIN, STATE, GAS, GLOWS,
  METAL, GOLD, MOLTEN_GOLD, LAMP, BATTERY, SPARKLE, CLOUD, NITROGEN, CEMENT, CONCRETE, SLIME, FUNGUS, NAPALM,
  FIREWORK, WAX, MOLTEN_WAX, GRAVEL, NITRO, C4, LIQUID, BLOOD, DRIED_BLOOD, URANIUM, HYDROGEN, CO2, DRY_ICE, POPCORN,
  DIAMOND, TAR, CACTUS, BLOOM, SPONGE, TORCH, BLACK_HOLE, HEATER, FREEZER, HAIL, QUICKSAND, METEOR,
} = El;
const SPARK = 32, ZAPPED = 64; // wire flags (see world.js)

const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const packHex = h => { const [r, g, b] = El.hexToRgb(h); return pack(r, g, b); };
const R = c => c & 255, G = c => (c >> 8) & 255, B = c => (c >> 16) & 255;
function blend(a, b, f) {
  return pack(R(a) + (R(b) - R(a)) * f | 0, G(a) + (G(b) - G(a)) * f | 0, B(a) + (B(b) - B(a)) * f | 0);
}
function scale(c, f) {
  return pack(Math.min(255, R(c) * f) | 0, Math.min(255, G(c) * f) | 0, Math.min(255, B(c) * f) | 0);
}

const PAL = El.ELEMENTS.map(e => (e.c2 || ['#000000']).map(packHex));
const GRASS = ['#a6e05a', '#74c447', '#53a53d', '#3d8838'].map(packHex);
const BLADE = ['#94d854', '#5fae40', '#4a9a3a'].map(packHex);
const MOSS = ['#8cc456', '#6aa84a', '#4f8c40'].map(packHex);
const WATER_D = ['#c2f0dc', '#86d6c0', '#62bcaa', '#4faa9c', '#42998f', '#378883', '#2d7676', '#25646a'].map(packHex);
const LEAF_D = ['#d4f07e', '#a4dc5c', '#7cc44c', '#5caa42', '#468e3c', '#367436', '#2a5c30', '#20482a'].map(packHex);
const LEAF_UNDER = packHex('#173a24');
// Little decorations on open grass: flowers and red-capped mushrooms.
const PETALS = ['#ffffff', '#ffe066', '#ff8ab8', '#b8a4ff', '#ff6a5a'].map(packHex);
const STEM = packHex('#3f8f3a'), CAP = packHex('#e0483a'), CAP_DOT = packHex('#fff2e0'), CAP_STALK = packHex('#efe4c8');
const FIRE_P = ['#fff6c4', '#ffe07a', '#ffb636', '#ff8a1f', '#ec5a1a', '#b8361a'].map(packHex);
const LAVA_P = ['#ffd86e', '#ffab3a', '#ff7f1d', '#ec5a1b', '#c8401a'].map(packHex);
const CRUST = packHex('#4a1e12');
const HOT_RED = packHex('#ff4a14'), HOT_YEL = packHex('#ffcf6a');
const SMOKE_C = packHex('#3f3b35'), GLASS_C = packHex('#e8f6f2');
const SAND_TOP = packHex('#f6ecc4'), SNOW_TOP = packHex('#ffffff');
const OIL_TOP = packHex('#6a5a3a'), WOOD_TOP = packHex('#9a7048'), ICE_TOP = packHex('#f2fdfd');
const BRINE_TINT = packHex('#9fb3a8'), MUD_TOP = packHex('#7a5c40'), SALT_TOP = packHex('#ffffff');
const MORTAR = packHex('#c9b79c'), COAL_GLINT = packHex('#7a7680');
const MOLTEN_P = ['#fff6d6', '#ffe9a8', '#ffd27a', '#ffb84a', '#f39a35'].map(packHex);
const MERCURY_HI = packHex('#f4f8fa'), HONEY_D = ['#f6c45a', '#e8a93a', '#d9952a', '#c7821f', '#b06f18'].map(packHex);
const CLONER_FRAME = packHex('#5b6270'), DRAIN_CORE = packHex('#05040a'), DRAIN_RIM = packHex('#4a3a78');
const LEAF_COLORS = ['#8ccf4e', '#6ab944', '#b4e264', '#4f9e3c', '#d2ec7a'].map(packHex);
const MOTE = packHex('#fffbd2');
// The inside of a hut: plank back wall and a window that glows at night.
const HUT_WALL = ['#5a3e2a', '#4e3424'].map(packHex), HUT_SEAM = packHex('#3a2818');
const WINDOW_DAY = packHex('#9fc8c0'), WINDOW_NIGHT = packHex('#ffd27a'), WINDOW_FRAME = packHex('#6e4a32');
// Little signs above creatures: a "z" while asleep, a heart for a new baby.
const ZZ_C = packHex('#eef4ff'), HEART_C = packHex('#ff6f94'), CHIP_C = ['#b98a5a', '#8a6444', '#d8b080'].map(packHex), DUST_C = packHex('#e6d6b4');
const GLYPHS = {
  6: [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
  7: [[1, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [2, 3]],
};
const SPARK_C = packHex('#effcff'), ZAP_TINT = packHex('#8fe0ff');
const GOLD_GLINT = packHex('#fff4c2'), LAMP_ON = packHex('#fff3b8'), LAMP_RIM = packHex('#ffcf5a'), LAMP_OFF = packHex('#857c68');
const CLOUD_TOP = packHex('#ffffff'), CLOUD_BASE = packHex('#c9c4bb');
const SPORE = packHex('#f0e2bc'), SPORE_GLOW = packHex('#9ff0c8');
const NIGHT = packHex('#06181c');
const FIREFLY = packHex('#d8ff7a');
// Blood: glossy and bright on top, dark where it pools deep; fresh blood is redder.
const RAD_GLOW = packHex('#8aff6a'), WHITE = packHex('#ffffff'), TAR_HI = packHex('#5a524c'), SPINE = packHex('#ece4b4');
const SPONGE_WET = packHex('#a88a2e'), FLAME = packHex('#ffb636'), HOLE_RIM = packHex('#8a4af0'), HOLE_SWIRL = packHex('#c8a8ff');
const BLOOD_D = ['#b82a1e', '#9a1d16', '#851812', '#70140f', '#5c100c'].map(packHex), BLOOD_HI = packHex('#d84a3a');

// Thermal camera colours from -50 °C to 2500 °C.
const THERMAL = (() => {
  const stops = [[-50, '#2a3bff'], [0, '#3d8bff'], [20, '#121a24'], [60, '#4b2580'], [150, '#a32c74'],
    [400, '#ea5130'], [800, '#ffae2c'], [1500, '#fff4b8'], [2500, '#ffffff']].map(([t, h]) => [t, packHex(h)]);
  const lut = new Uint32Array(2551);
  for (let i = 0; i < lut.length; i++) {
    const T = i - 50;
    let k = 0;
    while (k < stops.length - 2 && T > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1];
    lut[i] = blend(c0, c1, Math.max(0, Math.min(1, (T - t0) / (t1 - t0))));
  }
  return lut;
})();
const thermal = T => THERMAL[Math.max(0, Math.min(2550, (T + 50) | 0))];

// Smooth value noise, used to give leaves clumps and stone a block pattern.
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const leafHeight = (x, y) => 0.75 * vnoise(x / 4.5, y / 3.6) + 0.25 * vnoise(x / 2 + 7, y / 1.7 + 3);

// 4×4 ordered dither, the classic pixel-art way to blend two colours.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);

// ----- the forest behind the world -----
// Four layers of trees, palest and haziest far away, darkest up close, with
// a leafy canopy along the top, sunbeams fanning down through a gap in the
// leaves and mist lying low over the ground. Day and night are built from the
// same shapes, so dusk can blend smoothly from one to the other.
const DAY_PAL = {
  sky: ['#86c6a6', '#98d0aa', '#aad9ad', '#bde2b0', '#cfe9b3', '#dff0b8'],
  glow: '#fdf8d4', glowK: 0.8,
  layers: [ // far to near
    { body: '#a3d2a6', hi: '#b6dead', lo: '#93c69c', trunk: '#97c6a0' },
    { body: '#78b487', hi: '#90c890', lo: '#66a47b', trunk: '#6aa27e' },
    { body: '#4f8e66', hi: '#68aa6e', lo: '#407a58', trunk: '#46745a' },
    { body: '#2d6045', hi: '#42844c', lo: '#224c38', trunk: '#2c4a3a' },
  ],
  beam: '#fbf8cc', beamK: 0.34, mist: '#e2f2cf', mistK: 0.5,
};
const NIGHT_PAL = {
  sky: ['#040c12', '#071218', '#0a181d', '#0e1f23', '#13272a', '#183030'],
  glow: '#2e5052', glowK: 0.9,
  layers: DAY_PAL.layers.map((L, k) => Object.fromEntries(Object.entries(L).map(([n, h]) => {
    const c = blend(packHex(h), packHex('#05121a'), 0.72 + k * 0.05);
    return [n, '#' + [R(c), G(c), B(c)].map(v => v.toString(16).padStart(2, '0')).join('')];
  }))),
  beam: '#3c6464', beamK: 0.45, mist: '#24403f', mistK: 0.45,
};
const STAR = packHex('#eef6ff'), MOON = packHex('#eef2dc'), MOON_DARK = packHex('#c4ccb4'), NIGHT_SKY1 = packHex('#071218');

// Where the light comes from: a gap in the canopy, above the top right.
const sunAt = (W, H) => [W * 0.7, -H * 0.06];

function buildForest(W, H, pal) {
  const buf = new Uint32Array(W * H), painted = new Uint8Array(W * H), beam = new Uint8Array(W * H);
  const rand = rng(77);
  const dith = (r, x) => BAYER[(r & 3) * 4 + (x & 3)];
  // Sky: a soft gradient, brighter low down where the haze catches the light.
  const sky = pal.sky.map(packHex);
  for (let r = 0; r < H; r++) {
    const f = (r / (H * 0.8)) * (sky.length - 1);
    for (let x = 0; x < W; x++) buf[r * W + x] = sky[Math.max(0, Math.min(sky.length - 1, Math.floor(f + dith(r, x))))];
  }
  const [sx, sr] = sunAt(W, H);
  const layerDefs = [
    { crownAt: [0.56, 0.74], crownR: [0.06, 0.09], per: 15, tw: [1, 2], ground: 0.44 },
    { crownAt: [0.64, 0.82], crownR: [0.07, 0.1], per: 22, tw: [2, 3], ground: 0.4 },
    { crownAt: [0.84, 0.96], crownR: [0.08, 0.12], per: 34, tw: [3, 4], ground: 0.36, gap: 0.08 },
    { crownAt: [0.95, 1.04], crownR: [0.09, 0.14], per: 58, tw: [4, 7], ground: 0.3, gap: 0.13 },
  ];
  layerDefs.forEach((D, li) => {
    const L = pal.layers[li];
    const body = packHex(L.body), hi = packHex(L.hi), lo = packHex(L.lo), trunk = packHex(L.trunk);
    const trunkHi = blend(trunk, hi, 0.5), trunkLo = blend(trunk, lo, 0.6);
    const put = (x, y, c) => { if (x < 0 || x >= W || y < 0 || y >= H) return; const p = (H - 1 - y) * W + x; buf[p] = c; painted[p] = 1; };
    const crowns = [];
    const n = Math.ceil(W / D.per) + 2;
    for (let k = 0; k < n; k++) {
      const cx = (k + 0.15 + rand() * 0.7) * D.per - D.per * 0.5;
      const cy = H * (D.crownAt[0] + rand() * (D.crownAt[1] - D.crownAt[0]));
      const r = H * (D.crownR[0] + rand() * (D.crownR[1] - D.crownR[0]));
      const tw = D.tw[0] + ((rand() * (D.tw[1] - D.tw[0] + 1)) | 0);
      const extra = [0, 1, 2].map(() => [(rand() - 0.5) * r * 1.9, (rand() - 0.55) * r * 0.9, r * (0.5 + rand() * 0.35)]);
      const lean = (rand() - 0.5) * 0.06;
      // The canopy layers leave a gap where the sun comes through.
      if (D.gap && Math.abs(cx - sx) < W * D.gap) continue;
      // Trunk, lit on the right where the sun is, with a little bark texture.
      for (let y = 0; y < cy; y++) {
        const x0 = Math.round(cx - tw / 2 + lean * y);
        for (let dx = 0; dx < tw; dx++) {
          let c = dx === tw - 1 && tw > 1 ? trunkHi : dx === 0 && tw > 2 ? trunkLo : trunk;
          if (tw > 2 && hash(x0 + dx, y >> 1) < 0.1) c = trunkLo;
          put(x0 + dx, y, c);
        }
      }
      crowns.push([cx + lean * cy, cy, r], ...extra.map(([ox, oy, rr]) => [cx + lean * cy + ox, cy + oy, rr]));
    }
    // Undergrowth: a bumpy band of bushes and ferns along the bottom.
    for (let x = 0; x < W; x++) {
      let top = H * D.ground + 2.5 * vnoise(x / 6, li * 10) + 1.2 * Math.sin(x * 0.13 + li);
      if (hash(x, li + 40) < 0.12) top += 1 + (hash(x, li + 41) < 0.4);
      for (let y = 0; y < top; y++) put(x, y, y > top - 1.5 ? hi : (hash(x, y + li * 99) < 0.08 ? lo : body));
    }
    // Leafy crowns: fluffy edges, lit from the top right.
    for (const [cx, cy, r] of crowns) {
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
        if (y < 0 || y >= H) continue;
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (x < 0 || x >= W) continue;
          const dx = (x - cx) / r, dy = (y - cy) / r;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 1 - 0.24 * vnoise(x / 2.2 + li * 13, y / 2.2)) continue;
          const row = H - 1 - y;
          const light = dx * 0.45 + dy * 0.8 + (leafHeight(x + li * 31, y) - 0.5) * 0.8;
          const t = dith(row, x) * 0.3;
          put(x, y, light > 0.36 + t ? hi : light < -0.38 + t ? lo : body);
        }
      }
    }
  });
  // Glow around the gap in the canopy (open sky only).
  const glow = packHex(pal.glow), gr = H * 0.6;
  for (let r = 0; r < H; r++) for (let x = 0; x < W; x++) {
    const p = r * W + x;
    if (painted[p]) continue;
    const d = Math.hypot((x - sx) * 0.8, r - sr) / gr;
    if (d >= 1) continue;
    const a = pal.glowK * (1 - d) * (1 - d);
    buf[p] = blend(buf[p], glow, Math.floor(a * 5 + dith(r, x)) / 5);
  }
  // Mist lying low over the ground.
  const mist = packHex(pal.mist);
  for (let r = 0; r < H; r++) {
    const y = H - 1 - r, m = pal.mistK * Math.max(0, 1 - Math.abs(y - H * 0.32) / (H * 0.17));
    if (m <= 0) continue;
    for (let x = 0; x < W; x++) {
      const k = Math.floor(m * (0.75 + 0.5 * vnoise(x / 14, y / 5)) * 6 + dith(r, x)) / 6;
      if (k > 0) buf[r * W + x] = blend(buf[r * W + x], mist, Math.min(0.8, k));
    }
  }
  // Sunbeams fanning down from the gap, fading toward the ground.
  const beamCol = packHex(pal.beam), rb = rng(5);
  const beams = Array.from({ length: 6 }, () => [-0.85 + rb() * 0.95, 0.018 + rb() * 0.04, 0.45 + rb() * 0.55]);
  for (let r = 0; r < H; r++) for (let x = 0; x < W; x++) {
    const ang = Math.atan2(x - sx, r - sr);
    let I = 0;
    for (const [c, w, a] of beams) { const d = Math.abs(ang - c) / w; if (d < 1) I += a * (1 - d * d); }
    if (I <= 0) continue;
    I = Math.min(1, I) * Math.max(0, 1 - r / (H * 0.95));
    const p = r * W + x;
    beam[p] = I * 255;
    const k = Math.floor(I * pal.beamK * 8 + dith(r, x)) / 8;
    if (k > 0) buf[p] = blend(buf[p], beamCol, k);
  }
  return { buf, painted, beam };
}

// Stars and the moon in the open sky of the night forest. Returns where the
// stars are, so a few can twinkle.
function addStarsAndMoon(buf, painted, W, H) {
  const rand = rng(4242), stars = [];
  for (let k = 0; k < W * H / 45; k++) {
    const x = (rand() * W) | 0, r = (rand() * H * 0.42) | 0, p = r * W + x;
    if (painted[p]) continue;
    buf[p] = blend(buf[p], STAR, 0.35 + rand() * 0.65);
    stars.push(p);
  }
  const [sx] = sunAt(W, H), my = H * 0.13, mr = Math.max(3.5, H * 0.03);
  for (let r = Math.floor(my - mr); r <= my + mr; r++) for (let x = Math.floor(sx - mr); x <= sx + mr; x++) {
    if (x < 0 || r < 0 || x >= W || r >= H || painted[r * W + x]) continue;
    if (Math.hypot(x + 0.5 - sx, r + 0.5 - my) > mr) continue;
    buf[r * W + x] = hash(x >> 1, r >> 1) < 0.22 ? MOON_DARK : MOON;
  }
  return stars;
}

export class Renderer2D {
  constructor(stage, world) {
    this.world = world;
    this.wrap = document.createElement('div');
    this.wrap.className = 'view2d';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sim2d';
    this.glowCanvas = document.createElement('canvas');
    this.glowCanvas.className = 'glow2d';
    // Creatures get their own layer, drawn at a finer pixel size.
    this.mobCanvas = document.createElement('canvas');
    this.mobCanvas.className = 'mob2d';
    this.wrap.append(this.canvas, this.mobCanvas, this.glowCanvas);
    stage.append(this.wrap);
    this.ctx = this.canvas.getContext('2d');
    this.gctx = this.glowCanvas.getContext('2d');
    this.mctx = this.mobCanvas.getContext('2d');
    this.creatures = null;
    this.cursor = null;
    this.line = null;
    this.parts = [];        // little visual-only particles: embers, sparks, splashes, fireflies
    this.shake = 0;         // screen shake after explosions, in screen pixels
    this.night = 0;         // 0 day .. 1 night
    this.lastTime = 0;
    this.rebuild();
  }

  // Set up everything that depends on the size of the world.
  rebuild() {
    const { W, H } = this.world;
    this.builtW = W; this.builtH = H;
    for (const c of [this.canvas, this.glowCanvas]) { c.width = W; c.height = H; }
    this.mobCanvas.width = W * MOB_S; this.mobCanvas.height = H * MOB_S;
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.gimg = this.gctx.createImageData(W, H);
    this.gbuf = new Uint32Array(this.gimg.data.buffer);
    this.mimg = this.mctx.createImageData(W * MOB_S, H * MOB_S);
    this.mbuf = new Uint32Array(this.mimg.data.buffer);
    this.mobBox = null;
    this.buildSky();
    this.parts.length = 0;
    this.depth = new Uint8Array(W * H);
    // Fixed per-position patterns: leaf lighting (a bumpy surface lit from the
    // top left) and the stacked blocks of stone.
    this.leafTone = new Uint8Array(W * H);
    this.stonePat = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = leafHeight(x, y);
      const lit = leafHeight(x + 1, y - 1) - leafHeight(x - 1, y + 1);
      this.leafTone[x + W * y] = Math.max(0, Math.min(255, (0.42 + lit * 1.7 + (h - 0.5) * 0.4) * 255));
      // Cobbles: nearest jittered point on a 7×5 grid, with dark gaps between stones.
      const gx = Math.floor(x / 7), gy = Math.floor(y / 5);
      let d1 = 1e9, d2 = 1e9, tone = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cx = gx + ox, cy = gy + oy;
        const px = (cx + 0.15 + hash(cx, cy) * 0.7) * 7, py = (cy + 0.15 + hash(cy, cx + 99) * 0.7) * 5;
        const d = Math.hypot((x + 0.5 - px) / 1.3, y + 0.5 - py);
        if (d < d1) { d2 = d1; d1 = d; tone = (hash(cx + 7, cy + 3) * 4) | 0; } else if (d < d2) d2 = d;
      }
      this.stonePat[x + W * y] = tone | (d2 - d1 < 0.9 ? 4 : 0) | (d1 < 1.6 ? 8 : 0);
    }
    const rand = rng(9);
    this.leaves = Array.from({ length: Math.round(W / 9) }, () => ({
      x: rand() * W, y: rand() * H, s: 0.06 + rand() * 0.1, p: rand() * 6.28,
      c: LEAF_COLORS[(rand() * LEAF_COLORS.length) | 0], big: rand() < 0.35,
    }));
    this.cam = null;
    if (this.view) this.resize(this.view.w, this.view.h);
    this.wrap.style.transform = '';
  }

  // The forest behind the world, by day and by night.
  buildSky() {
    const { W, H } = this.world;
    const day = buildForest(W, H, DAY_PAL), night = buildForest(W, H, NIGHT_PAL);
    this.bg = day.buf; this.beam = day.beam;
    this.bgNight = night.buf; this.stars = addStarsAndMoon(night.buf, night.painted, W, H);
    this.bgMix = new Uint32Array(W * H); this.bgMixAt = -1;
  }

  resize(w, h) {
    this.view = { w, h };
    if (!this.cam) this.resetZoom(true);
    else { this.clamp(this.goal); this.clamp(this.cam); this.layout(); }
  }

  // Scale at zoom 1: the world covers the whole screen. It is made to fit the
  // screen's shape, so at most a thin edge is cut off if the window changes.
  baseScale() {
    const { w, h } = this.view;
    return Math.max(w / this.world.W, h / this.world.H);
  }

  // Keep a camera (zoom, and u, v: the view centre in cells) inside the world.
  clamp(cam) {
    const { W, H } = this.world, { w, h } = this.view;
    const s = this.baseScale() * cam.zoom;
    const hw = w / 2 / s, hh = h / 2 / s;
    cam.u = W <= 2 * hw ? W / 2 : Math.max(hw, Math.min(W - hw, cam.u));
    cam.v = H <= 2 * hh ? H / 2 : Math.max(hh, Math.min(H - hh, cam.v));
  }

  // Place the canvases for the current camera.
  layout() {
    const { W, H } = this.world;
    const { w, h } = this.view, cam = this.cam;
    const s = this.baseScale() * cam.zoom;
    const left = w / 2 - cam.u * s, top = h / 2 - cam.v * s;
    this.scale = s;
    for (const c of [this.canvas, this.glowCanvas, this.mobCanvas]) {
      c.style.width = W * s + 'px'; c.style.height = H * s + 'px';
      c.style.left = left + 'px'; c.style.top = top + 'px';
    }
  }

  // Zoom by `factor`, keeping the point under (sx, sy) (stage pixels) still.
  // The camera glides there over a few frames unless `instant` (pinching).
  zoomAt(sx, sy, factor, instant = false) {
    const g = instant ? this.cam : this.goal;
    const { w, h } = this.view, base = this.baseScale();
    const s = base * g.zoom;
    const pu = g.u + (sx - w / 2) / s, pv = g.v + (sy - h / 2) / s;
    g.zoom = Math.max(1, Math.min(8, g.zoom * factor));
    const s2 = base * g.zoom;
    g.u = pu - (sx - w / 2) / s2; g.v = pv - (sy - h / 2) / s2;
    this.clamp(g);
    if (instant) { Object.assign(this.goal, this.cam); this.layout(); }
  }

  pan(dx, dy) {
    for (const c of [this.cam, this.goal]) {
      c.u -= dx / this.scale; c.v -= dy / this.scale;
      this.clamp(c);
    }
    this.layout();
  }

  resetZoom(instant = false) {
    const home = { zoom: 1, u: this.world.W / 2, v: this.world.H / 2 };
    this.goal = { ...home };
    if (instant || !this.cam) this.cam = { ...home };
    if (this.view) { this.clamp(this.goal); this.clamp(this.cam); this.layout(); }
  }

  // Time of day, 0 (day) to 1 (night). At night the glow of fire, lava and
  // lamps spreads further.
  setNight(v) {
    this.night = v;
    if (Math.abs((this.glowAt ?? -1) - v) < 0.02) return;
    this.glowAt = v;
    this.glowCanvas.style.opacity = (0.85 + 0.15 * v).toFixed(2);
    this.glowCanvas.style.filter = `blur(${(9 + 6 * v).toFixed(1)}px) saturate(1.3)`;
  }

  // Ease the camera toward where it is heading.
  glide(dt) {
    const c = this.cam, g = this.goal;
    const dz = g.zoom - c.zoom, du = g.u - c.u, dv = g.v - c.v;
    if (Math.abs(dz) < 1e-3 && Math.abs(du) < 0.01 && Math.abs(dv) < 0.01) {
      if (dz || du || dv) { Object.assign(c, g); this.layout(); }
      return;
    }
    const k = 1 - Math.exp(-dt * 12);
    // Zoom in log space so it feels even at every scale.
    c.zoom = Math.exp(Math.log(c.zoom) + (Math.log(g.zoom) - Math.log(c.zoom)) * k);
    c.u += du * k; c.v += dv * k;
    this.clamp(c);
    this.layout();
  }

  toCell(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const { W, H } = this.world;
    const x = Math.floor((clientX - r.left) / r.width * W);
    const y = H - 1 - Math.floor((clientY - r.top) / r.height * H);
    return { x, y, inside: x >= 0 && y >= 0 && x < W && y < H };
  }

  computeDepth() {
    const { W, H, type } = this.world;
    const depth = this.depth;
    for (let x = 0; x < W; x++) {
      let prev = -1, run = 0, exposed = 64;
      for (let y = H - 1; y >= 0; y--) {
        const i = x + W * y, t = type[i];
        if (t === prev) { if (run < 63) run++; }
        else {
          run = 0;
          exposed = prev === -1 || prev === EMPTY || STATE[prev] === GAS || prev === PLANT || prev === WOOD || prev === SEED ? 64 : 0;
          prev = t;
        }
        depth[i] = run | exposed;
      }
    }
  }

  render(time, thermalView) {
    if (this.builtW !== this.world.W || this.builtH !== this.world.H) this.rebuild();
    const dt = Math.min(0.1, Math.max(0, time - this.lastTime));
    this.lastTime = time;
    this.glide(dt);
    this.shakeView(dt);
    const { W, H, type, temp, shade, life, flags } = this.world;
    const buf = this.buf, gbuf = this.gbuf, depth = this.depth, leafTone = this.leafTone, stonePat = this.stonePat;
    this.computeDepth();
    // Day or night sky (the mix is cached while the time of day holds still).
    const night = this.night;
    if (night > 0.003) {
      if (Math.abs(this.bgMixAt - night) > 0.004) {
        const bg = this.bg, bn = this.bgNight, mix = this.bgMix;
        for (let p = 0; p < mix.length; p++) mix[p] = blend(bg[p], bn[p], night);
        this.bgMixAt = night;
      }
      buf.set(this.bgMix);
      // A few stars twinkle.
      if (night > 0.5) for (let k = (time * 7) % 9 | 0; k < this.stars.length; k += 9) buf[this.stars[k]] = blend(buf[this.stars[k]], NIGHT_SKY1, 0.6);
    } else buf.set(this.bg);
    const sky = night > 0.003 ? this.bgMix : this.bg;
    gbuf.fill(0);
    const sparkChance = Math.min(1, 0.012 * (1 + night));

    // Falling leaves drift behind everything.
    for (const lf of this.leaves) {
      lf.y += lf.s * dt * 60; lf.x += (Math.sin(lf.p + time * 1.3) * 0.12 + 0.04) * dt * 60;
      if (lf.y > H) { lf.y = -2; lf.x = Math.random() * W; }
      if (lf.x >= W) lf.x -= W; else if (lf.x < 0) lf.x += W;
      const x = lf.x | 0, row = lf.y | 0;
      if (row < 0 || row >= H) continue;
      if (type[x + W * (H - 1 - row)] === EMPTY) buf[row * W + x] = lf.c;
      if (lf.big && x + 1 < W && type[x + 1 + W * (H - 1 - row)] === EMPTY) buf[row * W + x + 1] = scale(lf.c, 0.85);
    }

    const tick = (time * 6) | 0;
    for (let y = 0; y < H; y++) {
      const row = (H - 1 - y) * W;
      for (let x = 0; x < W; x++) {
        const i = x + W * y;
        const t = type[i];
        const p = row + x;
        if (t === EMPTY) {
          if (thermalView) buf[p] = blend(buf[p], thermal(temp[i]), 0.85);
          continue;
        }
        const sh = shade[i];
        const d = depth[i], run = d & 63, exposed = d & 64;
        let c = PAL[t][sh & 3];
        switch (t) {
          case DIRT:
            if (exposed && run < 4) {
              c = GRASS[run];
              if (run === 0 && (sh & 7) === 0) c = BLADE[0];
              // Open grass grows blades that sway, and here and there a flower or a mushroom.
              if (run === 0 && y < H - 2 && type[i + W] === EMPTY) {
                const up2 = type[i + 2 * W] === EMPTY, hx = hash(x, 17);
                if (hx < 0.035 && up2) {
                  buf[p - W] = STEM; buf[p - 2 * W] = PETALS[(hash(x, 3) * 5) | 0];
                } else if (hx < 0.05 && up2 && x > 0 && x < W - 1 && type[i + W - 1] === EMPTY && type[i + W + 1] === EMPTY) {
                  buf[p - W] = CAP_STALK;
                  buf[p - 2 * W - 1] = CAP; buf[p - 2 * W] = (x & 1) ? CAP_DOT : CAP; buf[p - 2 * W + 1] = CAP;
                } else if (((x * 7 + (x >> 2)) % 5) < 2) {
                  buf[p - W] = BLADE[1 + ((x >> 1) & 1)];
                  if (hx > 0.72 && up2) {
                    const sway = Math.sin(time * 1.7 + x * 0.23) > 0.55 ? 1 : 0;
                    if (x + sway < W && type[i + 2 * W + sway] === EMPTY) buf[p - 2 * W + sway] = BLADE[0];
                  }
                }
              }
            } else c = scale(c, 1 - Math.min(run, 36) / 36 * 0.4);
            break;
          case WATER: {
            c = WATER_D[Math.min(7, run < 2 ? run : 2 + ((run - 2) >> 1))];
            if (run === 0 && !exposed) c = WATER_D[2];
            if (run > 0 && ((x * 13 + y * 7 + tick * 3 + (sh >> 5)) % 97) === 0) c = WATER_D[0];
            break;
          }
          case PLANT: {
            // Greens come from the bumpy clump pattern; gold only where sunlight hits the top.
            let l = leafTone[i] / 255;
            if (!exposed) l -= 0.1;
            if (y > 0 && type[i - W] === EMPTY) l -= 0.3;
            let k = Math.max(2, Math.min(7, Math.round((1 - l) * 5) + 2));
            if (k === 2 && (sh & 7) === 0) k = 1; // a few sunlit leaves inside the canopy
            if (exposed && run < 3 && l > 0.38) k = run === 0 ? 0 : run === 1 ? 1 : 2;
            c = l < 0.08 ? LEAF_UNDER : LEAF_D[k];
            break;
          }
          case WOOD:
            c = PAL[WOOD][((x + (sh >> 6)) & 3)];
            if (flags[i] & 2) { c = scale(PAL[WOOD][(y >> 1) & 3], (x & 1) ? 0.55 : 0.62); break; } // a hut's back wall
            if (exposed && run === 0) c = WOOD_TOP;
            if (x > 0 && type[i - 1] === EMPTY) c = scale(c, 1.25);
            else if (x < W - 1 && type[i + 1] === EMPTY) c = scale(c, 0.72);
            break;
          case SAND: if (exposed && run === 0) c = SAND_TOP; break;
          case STONE: {
            const sp = stonePat[i];
            c = PAL[STONE][sp & 3];
            if (sp & 4) c = scale(c, 0.66);
            else if (sp & 8) c = scale(c, 1.08);
            // Moss grows on top of rocks open to the air.
            if (exposed && run === 0) c = MOSS[(sh >> 2) % 3];
            else if (exposed && run === 1 && (sh & 3) === 0) c = MOSS[2];
            else if (y > 0 && type[i - W] === EMPTY) c = scale(c, 0.8);
            else c = scale(c, 1 - Math.min(run, 50) / 50 * 0.45);
            break;
          }
          case SNOW: if (exposed && run === 0) c = SNOW_TOP; break;
          case OIL: if (run === 0) c = OIL_TOP; break;
          case ICE: if (exposed && run === 0) c = ICE_TOP; break;
          case FIRE: {
            const f = 1 - life[i] / 42;
            c = FIRE_P[Math.max(0, Math.min(5, (f * 6 + ((sh + tick) & 1)) | 0))];
            if (Math.random() < sparkChance) this.ember(x + Math.random(), y + 0.5);
            break;
          }
          case LAVA: {
            c = LAVA_P[((sh >> 4) + tick + (x >> 1) + (y >> 1)) % 5];
            const T = temp[i];
            if (T < 950) c = blend(c, CRUST, Math.min(0.75, (950 - T) / 330));
            if (run === 0 && Math.random() < 0.0015) this.pop(x + 0.5, y + 1, c);
            break;
          }
          case SMOKE: c = blend(buf[p], SMOKE_C, 0.55 + (sh & 3) * 0.06); break;
          case GLASS: c = blend(buf[p], GLASS_C, 0.4); if (exposed && run === 0) c = GLASS_C; break;
          case ACID: if (run === 0) c = PAL[ACID][2]; break;
          case BRINE: {
            c = blend(WATER_D[Math.min(7, run < 2 ? run : 2 + ((run - 2) >> 1))], BRINE_TINT, 0.22);
            if (run === 0 && !exposed) c = blend(WATER_D[2], BRINE_TINT, 0.22);
            break;
          }
          case BRICK: {
            // Courses of bricks: 3 rows tall, 6 wide, every other course offset.
            const course = (y / 3) | 0, off = course & 1 ? 3 : 0;
            c = (y % 3 === 0 || (x + off) % 6 === 0) ? MORTAR : PAL[BRICK][((((x + off) / 6) | 0) + course) & 3];
            if (exposed && run === 0) c = scale(c, 1.15);
            break;
          }
          case COAL: if ((sh & 31) === 0) c = COAL_GLINT; break;
          case MOLTEN: c = MOLTEN_P[((sh >> 4) + tick + (x >> 1)) % 5]; break;
          case MERCURY: {
            // Liquid metal: bright rim on top, a slow moving sheen inside.
            const glint = ((x + y * 2 + tick) % 23) === 0;
            c = run === 0 ? MERCURY_HI : glint ? MERCURY_HI : PAL[MERCURY][(run + (x >> 2)) & 3];
            break;
          }
          case HONEY: c = HONEY_D[Math.min(4, run >> 1)]; if (run === 0) c = scale(c, 1.12); break;
          case FUSE: c = PAL[FUSE][(x + y) & 1 ? 3 : (sh & 1)]; break;
          case CLONER: {
            // Frame, filled with the colour of whatever it copies.
            const kept = life[i];
            const edge = !(y > 0 && type[i - W] === CLONER) || !(y < H - 1 && type[i + W] === CLONER) ||
              !(x > 0 && type[i - 1] === CLONER) || !(x < W - 1 && type[i + 1] === CLONER);
            c = edge ? CLONER_FRAME : kept && PAL[kept] ? blend(PAL[kept][sh & 3], CLONER_FRAME, 0.35) : PAL[CLONER][sh & 3];
            break;
          }
          case DRAIN: {
            const edge = !(y > 0 && type[i - W] === DRAIN) || !(y < H - 1 && type[i + W] === DRAIN) ||
              !(x > 0 && type[i - 1] === DRAIN) || !(x < W - 1 && type[i + 1] === DRAIN);
            c = edge ? DRAIN_RIM : ((x * 3 + y * 5 + tick) % 11 === 0 ? PAL[DRAIN][3] : DRAIN_CORE);
            break;
          }
          case MUD: if (exposed && run === 0) c = MUD_TOP; break;
          case METAL: case GOLD: {
            if (t === GOLD) {
              c = PAL[GOLD][(sh >> 1) & 3];
              if (((x + y * 2 + tick) % 37) === 0 || (exposed && run === 0)) c = GOLD_GLINT;
            }
            const f = flags[i];
            if (f & SPARK) { c = SPARK_C; gbuf[p] = SPARK_C; if (Math.random() < 0.05) this.spark(x + 0.5, y + 0.5); }
            else if (f & ZAPPED) { c = blend(c, ZAP_TINT, 0.45); gbuf[p] = scale(ZAP_TINT, 0.5); }
            break;
          }
          case LAMP: {
            const lit = life[i] > 0;
            const edge = !(y > 0 && type[i - W] === LAMP) || !(y < H - 1 && type[i + W] === LAMP) ||
              !(x > 0 && type[i - 1] === LAMP) || !(x < W - 1 && type[i + 1] === LAMP);
            c = lit ? (edge ? LAMP_RIM : LAMP_ON) : (edge ? scale(LAMP_OFF, 0.8) : LAMP_OFF);
            if (lit) gbuf[p] = LAMP_ON;
            break;
          }
          case BATTERY: c = PAL[BATTERY][(y & 3) === 0 ? 2 : (x + y) % 7 === 0 ? 3 : sh & 1]; break;
          case SPARKLE: {
            const f = Math.min(1, life[i] / 28);
            c = blend(sky[p], PAL[SPARKLE][sh % 6], 0.3 + 0.7 * f);
            if (((tick + sh) & 3) === 0) c = scale(c, 1.25);
            if (Math.random() < 0.08) this.glitter(x + 0.5, y + 0.5, PAL[SPARKLE][sh % 6]);
            break;
          }
          case CLOUD: {
            // Bright tops, grey undersides, soft at the edges.
            const below = y > 0 ? type[i - W] : CLOUD, above = y < H - 1 ? type[i + W] : EMPTY;
            c = above !== CLOUD ? CLOUD_TOP : below !== CLOUD ? CLOUD_BASE : PAL[CLOUD][sh & 3];
            // Thin at the edges, thick in the middle.
            const n = (above === CLOUD) + (below === CLOUD) + (x > 0 && type[i - 1] === CLOUD) + (x < W - 1 && type[i + 1] === CLOUD);
            c = blend(sky[p], c, 0.3 + n * 0.16);
            break;
          }
          case NITROGEN: c = run === 0 ? PAL[NITROGEN][2] : PAL[NITROGEN][sh & 3]; break;
          case CEMENT: if (run === 0) c = scale(c, 1.08); break;
          case CONCRETE: if ((sh & 15) === 0) c = scale(c, 0.78); else if (exposed && run === 0) c = scale(c, 1.1); break;
          case SLIME: if (run === 0) c = PAL[SLIME][2]; if ((sh & 15) === 0) gbuf[p] = scale(c, 0.45); break;
          case FUNGUS:
            if ((sh & 7) === 0) { c = SPORE; if (night > 0.2) gbuf[p] = SPORE_GLOW; }
            break;
          case NAPALM: if (run === 0) c = scale(c, 1.15); break;
          case FIREWORK: c = PAL[FIREWORK][((x >> 1) + y) & 3]; break;
          case WAX: case MOLTEN_WAX: if (run === 0) c = scale(c, 1.05); break;
          case MOLTEN_GOLD: c = blend(PAL[MOLTEN_GOLD][((sh >> 4) + tick + (x >> 1)) & 3], GOLD_GLINT, 0.15); break;
          case GRAVEL: if ((sh & 3) === 0) c = scale(c, 0.8); break;
          case BLOOD:
            c = BLOOD_D[Math.min(4, (run >> 1) + (sh & 1))];
            if (run === 0 && y < H - 1 && type[i + W] === EMPTY && (sh & 3) === 0) c = BLOOD_HI;
            if (life[i] < 600) c = blend(c, PAL[DRIED_BLOOD][0], (600 - life[i]) / 900);
            break;
          case DRIED_BLOOD: c = PAL[DRIED_BLOOD][(sh >> 3) & 3]; break;
          case URANIUM:
            if ((sh & 7) === 0) { c = RAD_GLOW; gbuf[p] = scale(RAD_GLOW, 0.5); }
            break;
          case HYDROGEN: c = blend(sky[p], PAL[HYDROGEN][sh & 3], 0.22); break;
          case CO2: c = blend(sky[p], PAL[CO2][sh & 3], 0.3 + (sh & 3) * 0.04); break;
          case DRY_ICE: if (exposed && run === 0) c = WHITE; break;
          case POPCORN: if ((sh & 3) === 0) c = scale(c, 0.9); break;
          case DIAMOND:
            if (((x * 7 + y * 3 + tick) % 17) === 0) { c = WHITE; gbuf[p] = scale(WHITE, 0.5); }
            else if (exposed && run === 0) c = scale(c, 1.1);
            break;
          case TAR: if (run === 0 && (sh & 3) === 0) c = TAR_HI; break;
          case CACTUS:
            c = PAL[CACTUS][(x & 1) ? 0 : 2];
            if ((sh & 15) === 0) c = SPINE;
            break;
          case BLOOM: c = PAL[BLOOM][sh % 6]; break;
          case SPONGE:
            if (((x * 3 + y * 5) % 7) === 0) c = scale(c, 0.7);
            if (life[i] >= 5) c = blend(c, SPONGE_WET, 0.45);
            break;
          case TORCH:
            c = PAL[TORCH][sh & 1];
            if (y === H - 1 || type[i + W] !== TORCH) { c = FLAME; gbuf[p] = FLAME; }
            break;
          case BLACK_HOLE: {
            const rim = (x > 0 && type[i - 1] !== BLACK_HOLE) || (x < W - 1 && type[i + 1] !== BLACK_HOLE) ||
              (y > 0 && type[i - W] !== BLACK_HOLE) || (y < H - 1 && type[i + W] !== BLACK_HOLE);
            c = rim ? HOLE_RIM : PAL[BLACK_HOLE][2];
            if (rim) gbuf[p] = HOLE_RIM;
            if (Math.random() < 0.04) this.swirl(x + 0.5, y + 0.5);
            break;
          }
          case HEATER: c = (y & 1) ? PAL[HEATER][3] : PAL[HEATER][sh & 1]; if (y & 1) gbuf[p] = scale(c, 0.5); break;
          case FREEZER: c = (y & 1) ? PAL[FREEZER][3] : PAL[FREEZER][sh & 1]; if (y & 1) gbuf[p] = scale(c, 0.35); break;
          case HAIL: if (exposed && run === 0) c = WHITE; break;
          case QUICKSAND: if (run === 0) c = scale(c, 0.9); break;
          case METEOR: c = PAL[METEOR][((sh >> 4) + tick) & 3]; break;
          case NITRO: if (run === 0) c = scale(c, 1.1); break;
          case C4: if (((x + y) & 3) === 0) c = scale(c, 0.9); break;
          case SALT: if (exposed && run === 0) c = SALT_TOP; break;
        }
        // Hot things glow: red at ~525 °C, orange and yellow beyond.
        const T = temp[i];
        if (T > 480 && !GLOWS[t]) {
          const f = Math.min(1, (T - 480) / 900);
          c = blend(c, f < 0.5 ? HOT_RED : HOT_YEL, Math.min(0.9, 0.35 + f));
          gbuf[p] = c;
        }
        if (GLOWS[t]) gbuf[p] = c;
        else if (t === ACID && (sh & 7) === 0) gbuf[p] = scale(c, 0.6);
        if (thermalView) c = blend(c, thermal(T), 0.82);
        buf[p] = c;
      }
    }
    // Huts: fill the open inside with a plank back wall and a window.
    if (this.life && !thermalView) for (const h of this.life.homes) {
      const wx0 = h.x0 + 3, wx1 = h.x0 + 5, wy1 = h.y0 + h.hw - 3, wy0 = wy1 - 2;
      for (let y = h.y0; y < h.y0 + h.hw; y++) {
        if (y < 0 || y >= H) continue;
        const row = (H - 1 - y) * W;
        for (let x = h.x0 + 1; x <= h.x0 + 7; x++) {
          const i = x + W * y;
          if (type[i] !== EMPTY || x < 0 || x >= W) continue;
          const p = row + x;
          let c = (x - h.x0) % 3 === 0 ? HUT_SEAM : HUT_WALL[(y >> 1) & 1];
          if (x >= wx0 - 1 && x <= wx1 + 1 && y >= wy0 - 1 && y <= wy1 + 1) c = WINDOW_FRAME;
          if (x >= wx0 && x <= wx1 && y >= wy0 && y <= wy1) {
            c = blend(WINDOW_DAY, WINDOW_NIGHT, night);
            if (night > 0.3) gbuf[p] = scale(WINDOW_NIGHT, night * 0.8);
          }
          buf[p] = c;
        }
      }
    }
    // Night: everything that is not lit by its own glow sinks into the dark.
    if (night > 0.003 && !thermalView) {
      const k = night * 0.66;
      for (let p = 0; p < buf.length; p++) if (gbuf[p] === 0 && buf[p] !== sky[p]) buf[p] = blend(buf[p], NIGHT, k);
    }
    this.updateParts(dt, gbuf);
    this.drawCursor();
    this.ctx.putImageData(this.img, 0, 0);
    this.gctx.putImageData(this.gimg, 0, 0);
    this.drawMobs(time);
  }

  // ----- particles -----
  // Purely visual sparks and drops, in cell units (y up) and cells per second.
  // kind 0: ember (rises and flickers), 1: debris or drop (falls), 2: spark
  // (falls slowly), 3: firefly (wanders and blinks), 4: black-hole swirl,
  // 5: dust mote (floats in a sunbeam).
  addPart(x, y, vx, vy, life, col, kind, glow) {
    if (this.parts.length >= 900) return;
    this.parts.push({ x, y, vx, vy, life, max: life, col, kind, glow, ph: Math.random() * 6.28 });
  }
  ember(x, y) { this.addPart(x, y, (Math.random() - 0.5) * 3, 4 + Math.random() * 6, 0.6 + Math.random() * 0.9, FIRE_P[1 + ((Math.random() * 3) | 0)], 0, true); }
  pop(x, y, c) { for (let k = 0; k < 3; k++) this.addPart(x, y, (Math.random() - 0.5) * 8, 6 + Math.random() * 8, 0.5 + Math.random() * 0.4, c, 1, true); }
  spark(x, y) { this.addPart(x, y, (Math.random() - 0.5) * 14, Math.random() * 10, 0.25 + Math.random() * 0.25, SPARK_C, 2, true); }
  // Matter spiralling into a black hole at (x, y).
  swirl(x, y) {
    const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 6;
    this.addPart(x + Math.cos(a) * d, y + Math.sin(a) * d, 0, 0, 2.5, Math.random() < 0.5 ? HOLE_SWIRL : HOLE_RIM, 4, true);
    const q = this.parts[this.parts.length - 1];
    if (q) { q.cx = x; q.cy = y; }
  }
  glitter(x, y, c) { this.addPart(x, y, (Math.random() - 0.5) * 2, -1 - Math.random() * 2, 0.6 + Math.random() * 0.6, c, 2, true); }

  // Effects the world asked for this step: blasts, firework bursts, splashes, lightning.
  takeFx() {
    const fx = this.world.fx;
    for (const e of fx) {
      if (e.k === 'blast') {
        this.shake = Math.max(this.shake, Math.min(16, e.r * 1.4));
        const n = 24 + e.r * 4;
        for (let k = 0; k < n; k++) {
          const a = Math.random() * Math.PI * 2, sp = 8 + Math.random() * 30;
          this.addPart(e.x + 0.5, e.y + 0.5, Math.cos(a) * sp, Math.sin(a) * sp + 8, 0.5 + Math.random() * 0.9, FIRE_P[(Math.random() * 4) | 0], 1, true);
        }
      } else if (e.k === 'burst') {
        this.shake = Math.max(this.shake, 2);
        const c = PAL[SPARKLE][e.c % 6];
        const c2 = PAL[SPARKLE][(e.c + 3) % 6];
        for (let k = 0; k < 70; k++) {
          const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * 30;
          this.addPart(e.x + 0.5, e.y + 0.5, Math.cos(a) * sp, Math.sin(a) * sp, 0.8 + Math.random() * 1.2, k & 3 ? c : c2, 2, true);
        }
        // A bright flash at the centre.
        for (let k = 0; k < 12; k++) this.addPart(e.x + 0.5, e.y + 0.5, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 0.2, SPARK_C, 2, true);
      } else if (e.k === 'splash') {
        const c = PAL[e.t] ? PAL[e.t][1] : WATER_D[1];
        for (let k = 0; k < 5; k++) this.addPart(e.x + 0.5, e.y + 0.5, (Math.random() - 0.5) * 10, 8 + Math.random() * 12, 0.6, c, 1, false);
      } else if (e.k === 'zz') this.addPart(e.x, e.y, 0.3, 1.4, 2.4, ZZ_C, 6, false);
      else if (e.k === 'heart') this.addPart(e.x, e.y, 0, 1.6, 1.8, HEART_C, 7, false);
      else if (e.k === 'born') {
        for (let k = 0; k < 10; k++) this.addPart(e.x, e.y, (Math.random() - 0.5) * 8, Math.random() * 8, 0.6 + Math.random() * 0.5, k & 1 ? HEART_C : WHITE, 2, true);
      } else if (e.k === 'chips') {
        for (let k = 0; k < 3; k++) this.addPart(e.x, e.y, (Math.random() - 0.5) * 10, 4 + Math.random() * 6, 0.6, CHIP_C[k], 1, false);
      } else if (e.k === 'crumb') {
        const c = PAL[e.t] ? PAL[e.t][1] : CHIP_C[0];
        for (let k = 0; k < 2; k++) this.addPart(e.x, e.y, (Math.random() - 0.5) * 5, 2 + Math.random() * 4, 0.45, c, 1, false);
      } else if (e.k === 'sip') this.addPart(e.x, e.y + 0.6, (Math.random() - 0.5) * 3, 2.5, 0.3, WATER_D[0], 1, false);
      else if (e.k === 'knock') {
        for (let k = 0; k < 2; k++) this.addPart(e.x, e.y, (Math.random() - 0.5) * 6, Math.random() * 3, 0.35, DUST_C, 2, false);
      } else if (e.k === 'bolt') {
        this.shake = Math.max(this.shake, 6);
        for (let k = 0; k < 24; k++) this.spark(e.x + 0.5, e.y + 1);
      }
    }
    fx.length = 0;
  }

  updateParts(dt, gbuf) {
    this.takeFx();
    const { W, H, type } = this.world;
    // By day, specks of dust float in the sunbeams.
    if (this.night < 0.4 && Math.random() < 0.5) {
      const motes = this.parts.reduce((n, q) => n + (q.kind === 5 ? 1 : 0), 0);
      const x = Math.random() * W, y = Math.random() * H, p = (H - 1 - (y | 0)) * W + (x | 0);
      if (motes < W / 6 && this.beam[p] > 70 && type[(x | 0) + W * (y | 0)] === EMPTY)
        this.addPart(x, y, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4, 4 + Math.random() * 5, MOTE, 5, true);
    }
    // Fireflies come out at dusk, near the ground.
    if (this.night > 0.5 && Math.random() < 0.15) {
      const flies = this.parts.reduce((n, q) => n + (q.kind === 3 ? 1 : 0), 0);
      if (flies < W / 14) {
        const x = Math.random() * W;
        let y = H - 1;
        while (y > 0 && type[(x | 0) + W * y] === EMPTY) y--;
        if (y < H - 4) this.addPart(x, y + 2 + Math.random() * 14, 0, 0, 6 + Math.random() * 8, FIREFLY, 3, true);
      }
    }
    const parts = this.parts;
    let n = 0;
    for (const q of parts) {
      q.life -= dt;
      if (q.life <= 0) continue;
      if (q.kind === 0) { q.vx += (Math.random() - 0.5) * 30 * dt; q.vy *= 1 - dt * 0.8; }
      else if (q.kind === 1) q.vy -= 45 * dt;
      else if (q.kind === 2) { q.vy -= 12 * dt; q.vx *= 1 - dt * 1.5; }
      else if (q.kind === 4) {
        // Orbit inward: mostly sideways, a little toward the centre.
        const dx = q.cx - q.x, dy = q.cy - q.y, d = Math.hypot(dx, dy) || 1;
        if (d < 1) continue;
        q.vx = (-dy / d * 9 + dx / d * 4) * (8 / (d + 2)); q.vy = (dx / d * 9 + dy / d * 4) * (8 / (d + 2));
      }
      else if (q.kind >= 6) q.vx = Math.sin(q.ph + q.life * 3) * 0.7; // signs drift up, swaying
      else if (q.kind === 5) {
        q.vx += (Math.random() - 0.5) * 2 * dt; q.vy += Math.sin(q.ph + q.life) * 0.4 * dt;
        q.vx = Math.max(-0.8, Math.min(0.8, q.vx)); q.vy = Math.max(-0.5, Math.min(0.5, q.vy));
        if (this.night > 0.5) q.life = Math.min(q.life, 0.5);
      }
      else {
        q.vx += (Math.random() - 0.5) * 20 * dt; q.vy += (Math.random() - 0.5) * 20 * dt;
        q.vx = Math.max(-2.5, Math.min(2.5, q.vx)); q.vy = Math.max(-2.5, Math.min(2.5, q.vy));
        if (this.night < 0.4) q.life = Math.min(q.life, 0.5);
      }
      q.x += q.vx * dt; q.y += q.vy * dt;
      const cx = q.x | 0, cy = q.y | 0;
      if (cx < 0 || cx >= W || cy < 0 || cy >= H) continue;
      const t = type[cx + W * cy];
      // Drops and debris stop at the first solid or liquid they hit.
      if (q.kind < 6 && t !== EMPTY && STATE[t] !== GAS) {
        if (q.kind === 3) { q.vy = Math.abs(q.vy) + 0.5; q.y += 0.3; }
        else continue;
      }
      // Glowing ones light up the glow layer (fireflies only when lit).
      const on = q.kind === 5 ? Math.sin(q.ph + q.life * 2) > 0.6 : q.kind !== 3 || Math.sin(q.ph + q.life * 4) > 0.2;
      if (q.glow && on) gbuf[(H - 1 - cy) * W + cx] = q.col;
      parts[n++] = q;
    }
    parts.length = n;
  }

  drawParts(buf, BW, BH) {
    const H = this.world.H, S = MOB_S;
    for (const q of this.parts) {
      const f = Math.min(1, q.life / (q.max * 0.4));
      if (q.kind === 3 && Math.sin(q.ph + q.life * 4) <= 0.2) continue;
      if (q.kind === 5 && (Math.sin(q.ph + q.life * 2) < -0.3 || f < 0.5)) continue;
      if (q.kind === 0 && Math.random() < 0.25) continue; // flicker
      const px = (q.x * S) | 0, py = ((H - q.y) * S) | 0;
      if (px < 0 || py < 0 || px >= BW - 1 || py >= BH - 1) continue;
      if (q.kind >= 6) {
        if (f < 0.4 && ((q.life * 12) | 0) % 2) continue; // blink out at the end
        for (const [dx, dy] of GLYPHS[q.kind]) {
          const gx = px + dx - 2, gy = py + dy - 2;
          if (gx >= 0 && gy >= 0 && gx < BW && gy < BH) buf[gy * BW + gx] = q.col;
        }
        continue;
      }
      const c = f < 1 && q.kind !== 5 ? blend(q.col, FIRE_P[5], 1 - f) : q.col;
      buf[py * BW + px] = c;
      // Bright sparks and debris are 2×2 while fresh.
      if (q.kind !== 0 && q.kind !== 3 && q.kind !== 5 && f > 0.6) { buf[py * BW + px + 1] = c; buf[(py + 1) * BW + px] = c; buf[(py + 1) * BW + px + 1] = c; }
    }
  }

  // Shake the view after a blast, settling quickly.
  shakeView(dt) {
    if (this.shake < 0.3) {
      if (this.shook) { this.wrap.style.transform = ''; this.shook = false; }
      this.shake = 0;
      return;
    }
    const a = this.shake;
    this.wrap.style.transform = `translate(${((Math.random() - 0.5) * a).toFixed(1)}px, ${((Math.random() - 0.5) * a).toFixed(1)}px)`;
    this.shook = true;
    this.shake *= Math.exp(-dt * 7);
  }

  // Creatures, on their own finer layer. Under water they take on the
  // water's colour.
  drawMobs(time) {
    const cr = this.creatures;
    const near = cr ? cr.list : [];
    const { W, H } = this.world, BW = W * MOB_S, BH = H * MOB_S;
    // Only the box around the creatures and particles (and where they were
    // last frame) is cleared and redrawn; the layer is large.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of near) for (let k = 0; k < c.n; k++) {
      if (c.px[k] < x0) x0 = c.px[k]; if (c.px[k] > x1) x1 = c.px[k];
      if (c.py[k] < y0) y0 = c.py[k]; if (c.py[k] > y1) y1 = c.py[k];
    }
    x0 -= 4; x1 += 4; y0 -= 3; y1 += 7;
    for (const q of this.parts) {
      if (q.x < x0) x0 = q.x - 1; if (q.x > x1) x1 = q.x + 1;
      if (q.y < y0) y0 = q.y - 1; if (q.y > y1) y1 = q.y + 1;
    }
    const box = x1 < x0 ? null : [Math.max(0, Math.floor(x0 * MOB_S)), Math.max(0, Math.floor((H - y1) * MOB_S)),
      Math.min(BW, Math.ceil(x1 * MOB_S)), Math.min(BH, Math.ceil((H - y0) * MOB_S))];
    const old = this.mobBox;
    this.mobBox = box;
    if (!box && !old) return;
    const u = box && old ? [Math.min(box[0], old[0]), Math.min(box[1], old[1]), Math.max(box[2], old[2]), Math.max(box[3], old[3])] : box || old;
    const mbuf = this.mbuf;
    for (let py = u[1]; py < u[3]; py++) mbuf.fill(0, py * BW + u[0], py * BW + u[2]);
    const flush = () => { if (u[2] > u[0] && u[3] > u[1]) this.mctx.putImageData(this.mimg, 0, 0, u[0], u[1], u[2] - u[0], u[3] - u[1]); };
    if (!box) { flush(); return; }
    const type = this.world.type;
    const nightK = this.night * 0.55;
    const tint = (px, py, col) => {
      const x = (px / MOB_S) | 0, y = H - 1 - ((py / MOB_S) | 0);
      if (y < 0 || y >= H) return nightK ? blendC(col, NIGHT, nightK) : col;
      const t = type[x + W * y];
      if (STATE[t] === El.LIQUID) col = blendC(col, PAL[t][0], t === WATER || t === BRINE ? 0.38 : 0.6);
      return nightK ? blendC(col, NIGHT, nightK) : col;
    };
    const underwater = c => {
      const k = c.sp.headK;
      const x = Math.max(0, Math.min(W - 1, Math.floor(c.px[k]))), y = Math.max(0, Math.min(H - 1, Math.floor(c.py[k])));
      return c.sp.breathes === 'air' && STATE[type[x + W * y]] === El.LIQUID;
    };
    const o = { buf: this.mbuf, BW, BH, S: MOB_S, x0: 0, y0: H, gore: cr.gore, tick: Math.floor(time * 12), tint, marks: true, underwater };
    for (const c of near) drawCreature(c, o);
    this.drawParts(this.mbuf, BW, BH);
    flush();
  }

  drawCursor() {
    // The Line tool's preview: a dotted line from where the drag started.
    const ln = this.line;
    if (ln) {
      const { W, H } = this.world;
      const n = Math.max(1, Math.abs(ln.x1 - ln.x0), Math.abs(ln.y1 - ln.y0));
      for (let k = 0; k <= n; k++) {
        if (k % 3 === 2) continue;
        const x = Math.round(ln.x0 + (ln.x1 - ln.x0) * k / n), y = Math.round(ln.y0 + (ln.y1 - ln.y0) * k / n);
        if (x >= 0 && y >= 0 && x < W && y < H) this.buf[(H - 1 - y) * W + x] = pack(255, 248, 225);
      }
    }
    const c = this.cursor;
    if (!c) return;
    const { W, H } = this.world;
    const r = Math.max(0.5, c.r), ri = Math.ceil(r) + 1;
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - r) > 0.5) continue;
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const p = (H - 1 - y) * W + x;
      const v = this.buf[p];
      const lum = R(v) * 0.3 + G(v) * 0.59 + B(v) * 0.11;
      this.buf[p] = lum > 140 ? pack(30, 26, 20) : pack(255, 248, 225);
    }
  }
}
