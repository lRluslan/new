// Procedural pixel-art textures. The 3D world uses a 16×16 tile per block
// face, drawn here at start-up (no image files needed). The palette buttons
// use the same art as small swatches.

import * as El from './elements.js';
import { rng } from './scenes.js';

// Each 16×16 tile sits in a 32×32 cell, surrounded by repeats of itself, so
// the smaller mipmap levels never blend in a neighbouring tile.
export const TILE = 16, PAD = 8, CELL = TILE + 2 * PAD, COLS = 8, ROWS = 4;

const T = {
  stone: 0, dirt: 1, grassTop: 2, grassSide: 3, sand: 4, snow: 5, ash: 6, gunpowder: 7,
  seed: 8, water: 9, oil: 10, acid: 11, lava: 12, smoke: 14, fire: 15,
  woodSide: 16, woodTop: 17, leaves: 18, ice: 19, glass: 20, obsidian: 21, metal: 22,
  salt: 13, brine: 23, mud: 24, brick: 25, coal: 26,
};

const BY_ELEMENT = {
  [El.STONE]: T.stone, [El.DIRT]: T.dirt, [El.SAND]: T.sand, [El.SNOW]: T.snow, [El.ASH]: T.ash,
  [El.GUNPOWDER]: T.gunpowder, [El.SEED]: T.seed, [El.WATER]: T.water, [El.OIL]: T.oil,
  [El.ACID]: T.acid, [El.LAVA]: T.lava, [El.SMOKE]: T.smoke, [El.FIRE]: T.fire,
  [El.WOOD]: T.woodSide, [El.PLANT]: T.leaves, [El.ICE]: T.ice, [El.GLASS]: T.glass,
  [El.OBSIDIAN]: T.obsidian, [El.METAL]: T.metal, [El.SALT]: T.salt, [El.BRINE]: T.brine,
  [El.MUD]: T.mud, [El.BRICK]: T.brick, [El.COAL]: T.coal,
};

// face: 0 left, 1 right, 2 bottom, 3 top, 4 back, 5 front.
// grassy: a soil block with open air above it.
export function tileFor(t, face, grassy) {
  if (t === El.DIRT && grassy) return face === 3 ? T.grassTop : face === 2 ? T.dirt : T.grassSide;
  if (t === El.WOOD && (face === 2 || face === 3)) return T.woodTop;
  return BY_ELEMENT[t] ?? T.stone;
}

const rgb = h => El.hexToRgb(h);
const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const shadeC = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

function painter(rand) {
  const pick = pal => pal[(rand() * pal.length) | 0];
  return {
    speckle(pal) { const p = pal.map(rgb); return () => pick(p); },
    stone(pal) {
      const p = pal.map(rgb);
      const seeds = Array.from({ length: 6 }, () => [rand() * 16, rand() * 16, pick(p)]);
      return (x, y) => {
        let d1 = 1e9, d2 = 1e9, c = p[0];
        for (const [sx, sy, sc] of seeds) for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) {
          const d = Math.hypot(x + 0.5 - sx - ox, y + 0.5 - sy - oy);
          if (d < d1) { d2 = d1; d1 = d; c = sc; } else if (d < d2) d2 = d;
        }
        if (d2 - d1 < 1.1) return shadeC(c, 0.62);
        return shadeC(c, 0.92 + rand() * 0.16 + (d1 < 2 ? 0.08 : 0));
      };
    },
    grassSide(dirtPal, grassPal) {
      const dp = dirtPal.map(rgb), gp = grassPal.map(rgb);
      const drip = Array.from({ length: 16 }, () => 6 + ((rand() * 5) | 0));
      return (x, y) => (y < drip[x] ? (y === drip[x] - 1 ? shadeC(pick(gp), 0.8) : pick(gp)) : pick(dp));
    },
    bark(pal) {
      const p = pal.map(rgb);
      const col = Array.from({ length: 16 }, () => pick(p));
      return (x, y) => {
        let c = col[x];
        if ((x + Math.floor(y / 6)) % 5 === 0) c = shadeC(c, 0.7);
        if (x === 11 || x === 12) c = mix(c, [214, 158, 92], 0.35); // light streak, like a sunlit trunk
        return shadeC(c, 0.92 + rand() * 0.14);
      };
    },
    rings(pal) {
      const p = pal.map(rgb);
      return (x, y) => {
        const d = Math.hypot(x - 7.5, y - 7.5);
        if (d > 6.8) return shadeC(p[0], 0.7);
        return Math.floor(d * 0.85) % 2 ? mix(p[3], [200, 160, 110], 0.4) : mix(p[1], [190, 150, 100], 0.3);
      };
    },
    leaves(pal) {
      const p = pal.map(rgb);
      const clumps = Array.from({ length: 7 }, () => [rand() * 16, rand() * 16, 2.5 + rand() * 1.5]);
      return (x, y) => {
        let c = shadeC(p[2], 0.95);
        for (const [cx, cy, r] of clumps) for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) {
          const dx = x + 0.5 - cx - ox, dy = y + 0.5 - cy - oy;
          const d = Math.hypot(dx, dy);
          if (d < r) c = dx + dy < -r * 0.6 ? mix(p[3], [140, 220, 170], 0.25) : d > r - 0.9 ? shadeC(p[0], 0.85) : p[1];
        }
        return shadeC(c, 0.94 + rand() * 0.12);
      };
    },
    water(pal) {
      const p = pal.map(rgb);
      return (x, y) => {
        const wave = (y + Math.round(1.5 * Math.sin(x * 0.75))) % 8 === 0 && x % 5 !== 0;
        return wave ? mix(p[2], [230, 255, 245], 0.25) : shadeC(p[(x + y) % 2 ? 0 : 1], 0.97 + rand() * 0.06);
      };
    },
    lava(pal) {
      const p = pal.map(rgb);
      const blobs = Array.from({ length: 4 }, () => [rand() * 16, rand() * 16, 1.5 + rand() * 2]);
      return (x, y) => {
        for (const [cx, cy, r] of blobs) if (Math.hypot(x - cx, y - cy) < r) return mix([120, 30, 10], p[2], rand() * 0.4);
        return rand() < 0.15 ? p[3] : pick(p.slice(0, 3));
      };
    },
    ice(pal) {
      const p = pal.map(rgb);
      return (x, y) => ((x - y + 32) % 7 < 2 ? mix(p[2], [255, 255, 255], 0.6) : pick(p));
    },
    glass(pal) {
      const p = pal.map(rgb);
      return (x, y) => {
        if (x === 0 || y === 0 || x === 15 || y === 15) return mix(p[0], [255, 255, 255], 0.5);
        if (x - y === 3 || x - y === 4 || x - y === -6) return [255, 255, 255];
        return shadeC(p[0], 0.75);
      };
    },
    metal(pal) {
      const p = pal.map(rgb);
      return (x, y) => {
        if ((x === 2 || x === 13) && (y === 2 || y === 13)) return shadeC(p[1], 1.2);
        if (x === 0 || y === 0) return mix(p[3], [255, 255, 255], 0.3);
        if (x === 15 || y === 15) return shadeC(p[2], 0.7);
        return shadeC(p[0], 0.96 + rand() * 0.08);
      };
    },
    fire() {
      const h = Array.from({ length: 16 }, () => 6 + rand() * 10);
      return (x, y) => {
        const f = (15 - y) / h[x];
        if (f > 1) return [190, 50, 20];
        if (f > 0.75) return [240, 100, 30];
        if (f > 0.4) return [255, 170, 50];
        return [255, 238, 160];
      };
    },
    // Courses of bricks with pale mortar lines, every other row offset.
    brick(pal) {
      const p = pal.map(rgb);
      const tone = Array.from({ length: 8 }, () => pick(p));
      return (x, y) => {
        const row = (y / 4) | 0, off = row & 1 ? 4 : 0;
        if (y % 4 === 3 || (x + off) % 8 === 7) return [176, 160, 140];
        return shadeC(tone[(row * 2 + (((x + off) / 8) | 0)) & 7], 0.92 + rand() * 0.14);
      };
    },
    sparkle(pal, accent, chance) {
      const p = pal.map(rgb), a = rgb(accent);
      return () => (rand() < chance ? a : pick(p));
    },
  };
}

let cachedAtlas = null;

// Returns a canvas with every tile laid out in a grid.
export function buildAtlas() {
  if (cachedAtlas) return cachedAtlas;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL; canvas.height = ROWS * CELL;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(canvas.width, canvas.height);
  const rand = rng(1234);
  const P = painter(rand);
  const c3 = t => El.ELEMENTS[t].c3;
  const grass = ['#2a6f59', '#307b63', '#24614e', '#3a8a6d'];
  const fns = {
    [T.stone]: P.stone(c3(El.STONE)),
    [T.dirt]: P.speckle(c3(El.DIRT)),
    [T.grassTop]: P.sparkle(grass, '#5fae8c', 0.07),
    [T.grassSide]: P.grassSide(c3(El.DIRT), grass),
    [T.sand]: P.sparkle(c3(El.SAND), '#e3c98f', 0.08),
    [T.snow]: P.sparkle(c3(El.SNOW), '#ffffff', 0.2),
    [T.ash]: P.speckle(c3(El.ASH)),
    [T.gunpowder]: P.sparkle(c3(El.GUNPOWDER), '#7d8784', 0.12),
    [T.seed]: P.sparkle(c3(El.SEED), '#3d2a14', 0.15),
    [T.water]: P.water(c3(El.WATER)),
    [T.oil]: P.sparkle(c3(El.OIL), '#7a5a35', 0.06),
    [T.acid]: P.sparkle(c3(El.ACID), '#e6ff9a', 0.1),
    [T.lava]: P.lava(c3(El.LAVA)),
    [T.smoke]: P.speckle(c3(El.SMOKE)),
    [T.fire]: P.fire(),
    [T.woodSide]: P.bark(c3(El.WOOD)),
    [T.woodTop]: P.rings(c3(El.WOOD)),
    [T.leaves]: P.leaves(c3(El.PLANT)),
    [T.ice]: P.ice(c3(El.ICE)),
    [T.glass]: P.glass(c3(El.GLASS)),
    [T.obsidian]: P.sparkle(c3(El.OBSIDIAN), '#6b56a0', 0.05),
    [T.metal]: P.metal(c3(El.METAL)),
    [T.salt]: P.sparkle(c3(El.SALT), '#ffffff', 0.18),
    [T.brine]: P.water(c3(El.BRINE)),
    [T.mud]: P.sparkle(c3(El.MUD), '#6b5642', 0.08),
    [T.brick]: P.brick(c3(El.BRICK)),
    [T.coal]: P.sparkle(c3(El.COAL), '#6d6a72', 0.07),
  };
  for (const [tileStr, fn] of Object.entries(fns)) {
    const tile = +tileStr;
    const ox = (tile % COLS) * CELL, oy = Math.floor(tile / COLS) * CELL;
    const px = [];
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) px.push(fn(x, y));
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const c = px[((y - PAD + TILE) % TILE) * TILE + ((x - PAD + TILE) % TILE)];
      const o = ((oy + y) * canvas.width + ox + x) * 4;
      img.data[o] = Math.max(0, Math.min(255, c[0]));
      img.data[o + 1] = Math.max(0, Math.min(255, c[1]));
      img.data[o + 2] = Math.max(0, Math.min(255, c[2]));
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedAtlas = canvas;
  return canvas;
}

// Small preview for an element button.
export function drawSwatch(canvas, t, mode) {
  const ctx = canvas.getContext('2d');
  if (mode === '3d') {
    canvas.width = TILE; canvas.height = TILE;
    const tile = tileFor(t, 0, t === El.DIRT);
    ctx.drawImage(buildAtlas(), (tile % COLS) * CELL + PAD, Math.floor(tile / COLS) * CELL + PAD, TILE, TILE, 0, 0, TILE, TILE);
    return;
  }
  const S = 10;
  canvas.width = S; canvas.height = S;
  const rand = rng(t * 97 + 3);
  const pal = El.ELEMENTS[t].c2.map(rgb);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let c = pal[(rand() * pal.length) | 0];
    if (t === El.DIRT && y < 3) c = rgb(['#e2b844', '#d6a22b', '#c08a22'][y]);
    else if (y === 0 && El.STATE[t] !== El.GAS) c = mix(c, [255, 244, 210], 0.3);
    if (t === El.FIRE) c = rgb(['#fff2b0', '#ffd04a', '#ff8a1f', '#e04a17'][Math.min(3, Math.floor((S - 1 - y) / 2.6) + (rand() < 0.3 ? 1 : 0))]);
    const o = (y * S + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
