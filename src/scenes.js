// The starting world: an autumn glade seen from the side, with rolling
// ground, a pond with a sandy bed, a wooden dock, log stumps and trees.
// Everything is placed in fractions of the world size, so the scene fits
// whatever size the screen makes the world.

import { STONE, DIRT, SAND, WATER, WOOD, PLANT, EMPTY } from './elements.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The world is sized to the screen so it fills it exactly: about 5 screen
// pixels per cell, with limits so it stays fast on very big screens and
// keeps enough room on phones.
export function worldSizeFor(width, height) {
  let cell = 5;
  if (width / cell < 150) cell = Math.max(3, width / 150);
  if (width / cell > 420) cell = width / 420;
  if (height / cell > 300) cell = height / 300;
  return { W: Math.max(60, Math.round(width / cell)), H: Math.max(60, Math.round(height / cell)) };
}

// Rolling soil height before the pond is dug.
function groundHeight(x, W, H) {
  const u = x / W * 256; // the hills keep their shape at any width
  return H * 0.3 + H * (0.023 * Math.sin(u * 0.045) + 0.014 * Math.sin(u * 0.11 + 1.7) + 0.008 * Math.sin(u * 0.23 + 0.4));
}

// A lumpy ellipse of leaves (or stone), with a scalloped edge so it looks bushy.
function blob(w, cx, cy, rx, ry, t, rand, rough = 0.5) {
  const lobes = 4 + ((rand() * 4) | 0), phase = rand() * 6.28;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const edge = 1 - rough * 0.22 * (0.5 + 0.5 * Math.sin(Math.atan2(y - cy, x - cx) * lobes + phase));
      if (d > edge) continue;
      const i = w.index(x, y);
      if (w.type[i] === EMPTY) { w.set(i, t); w.life[i] = 0; }
    }
}

function tree(w, x0, ground, height, crown, rand) {
  const put = (x, y) => { if (x >= 0 && x < w.W && y >= 0 && y < w.H) w.set(w.index(x, y), WOOD); };
  let x = x0;
  for (let y = ground - 1; y < Math.min(w.H - 2, ground + height); y++) {
    const f = (y - ground) / height;
    const half = f < 0.06 ? 4 : f < 0.5 ? 3 : f < 0.8 ? 2 : 1;
    if (f > 0.2 && rand() < 0.05) x += rand() < 0.5 ? -1 : 1;
    for (let dx = -half; dx < half; dx++) put(x + dx, y);
  }
  // Roots flaring into the ground.
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) put(x0 + s * (3 + k), ground - 1 - (k >> 1));
  const top = ground + height;
  // Two branches reaching out sideways.
  for (const s of [-1, 1]) {
    let px = x, py = ground + Math.floor(height * 0.6);
    const len = Math.round(crown * 0.75);
    for (let k = 0; k < len; k++) {
      px += s; if (k % 2 === 0) py++;
      put(px, py);
      if (k < len * 0.5) put(px, py + 1);
    }
  }
  const c = crown;
  const clumps = [
    [0, 2, c * 1.1, c * 0.8],
    [-c * 0.8, -c * 0.25, c * 0.75, c * 0.55],
    [c * 0.8, -c * 0.2, c * 0.75, c * 0.55],
    [-c * 0.4, c * 0.55, c * 0.65, c * 0.5],
    [c * 0.45, c * 0.6, c * 0.65, c * 0.5],
  ];
  for (const [ox, oy, rx, ry] of clumps) blob(w, x + ox, top + oy, rx, ry, PLANT, rand, 0.55);
}

export function autumnGlade(w) {
  w.clear();
  const { W, H } = w;
  const rand = rng(11);
  const pondX = W * 0.6, pondR = W * 0.17;
  const level = Math.round(H * 0.3) - 2;
  const depth = Math.max(8, Math.round(H * 0.1));
  const ground = new Int32Array(W);
  for (let x = 0; x < W; x++) {
    let h = groundHeight(x, W, H);
    const d = Math.abs(x - pondX) / pondR;
    if (d < 1) h = Math.min(h, level - depth * (1 - d * d) ** 0.7 + 2);
    ground[x] = Math.round(h);
  }
  const g = x => ground[Math.max(0, Math.min(W - 1, Math.round(x)))];

  for (let x = 0; x < W; x++) {
    const h = ground[x];
    const soil = Math.round(H * 0.1 + 2 * Math.sin(x * 0.05 + 2));
    const d = Math.abs(x - pondX) / pondR;
    const sandy = d < 1.18 || h <= level ? (d > 0.85 ? 3 : 2) : 0; // the pond bed is sand
    for (let y = 0; y < h; y++) w.set(w.index(x, y), y >= h - sandy ? SAND : y < h - soil ? STONE : DIRT);
    for (let y = h; y <= level; y++) w.set(w.index(x, y), WATER);
  }

  // Wooden dock across the pond, with posts down to the bed.
  const dockY = level + 4;
  const dock0 = Math.round(pondX + pondR * 0.05), dock1 = Math.min(W - 1, Math.round(pondX + pondR * 1.15));
  for (let x = dock0; x <= dock1; x++) w.set(w.index(x, dockY), WOOD);
  for (let x = dock0 + 2; x < dock1; x += 8)
    for (let y = g(x) - 1; y < dockY; y++) w.set(w.index(x, y), WOOD);
  // Log stumps standing in the water.
  for (const fx of [-0.62, -0.42, -0.22]) {
    const x = Math.round(pondX + pondR * fx);
    for (let y = g(x) - 1; y <= level + 2; y++) for (let dx = 0; dx < 3; dx++) w.set(w.index(x + dx, y), WOOD);
  }

  // A big tree on the left, a smaller one on the right, bushes and rocks.
  tree(w, Math.round(W * 0.17), g(W * 0.17), Math.round(H * 0.36), Math.round(H * 0.13), rand);
  tree(w, Math.round(W * 0.92), g(W * 0.92), Math.round(H * 0.28), Math.round(H * 0.1), rand);
  for (const fx of [0.04, 0.3, 0.38, 0.84]) {
    const x = Math.round(W * fx);
    blob(w, x, g(x) + 2, H * 0.05 + rand() * 3, H * 0.035 + rand() * 1.5, PLANT, rand, 0.4);
  }
  for (const fx of [0.27, 0.8]) {
    const x = Math.round(W * fx);
    blob(w, x, g(x), 3, 2.2, STONE, rand, 0.2);
  }
}

// A clear world keeps a stone floor, thick enough to sit above the toolbar
// at the bottom of the screen so you can see what lands on it.
export function emptyWorld(w) {
  w.clear();
  const floor = Math.max(2, Math.round(w.H * 0.08));
  for (let y = 0; y < floor; y++) for (let x = 0; x < w.W; x++) w.set(w.index(x, y), STONE);
}
