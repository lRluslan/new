// Starter worlds. The 2D one is an autumn pond with a dock, the 3D one is a
// small forest glade. Both are built from the same elements the player paints.

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

function blob2d(w, cx, cy, rx, ry, t, rand, rough = 0.5) {
  // Scalloped edge so canopies read as clusters of leaves.
  const lobes = 4 + ((rand() * 4) | 0), phase = rand() * 6.28;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      const edge = 1 - rough * 0.22 * (0.5 + 0.5 * Math.sin(Math.atan2(y - cy, x - cx) * lobes + phase));
      if (d > edge) continue;
      const i = w.index(x, y);
      if (w.type[i] === EMPTY) { w.set(i, t); w.life[i] = 0; }
    }
}

function tree2d(w, x0, ground, height, crown, rand) {
  const { H } = w;
  // Trunk, slightly wider at the base, with a gentle lean.
  let x = x0;
  for (let y = ground; y < Math.min(H - 2, ground + height); y++) {
    const t = (y - ground) / height;
    const half = t < 0.08 ? 4 : t < 0.5 ? 2.5 : t < 0.8 ? 2 : 1.5;
    if (rand() < 0.05) x += rand() < 0.5 ? -1 : 1;
    for (let dx = -Math.floor(half); dx <= Math.ceil(half) - 1; dx++) {
      const i = w.index(Math.max(0, Math.min(w.W - 1, x + dx)), y);
      w.set(i, WOOD);
    }
  }
  const top = ground + height;
  // Branches.
  for (const dir of [-1, 1]) {
    let bx = x, by = ground + Math.floor(height * 0.62);
    for (let k = 0; k < crown * 0.7; k++) {
      bx += dir; if (k % 2 === 0) by++;
      if (bx < 0 || bx >= w.W || by + 1 >= H) break;
      w.set(w.index(bx, by), WOOD);
      if (k < crown * 0.4) w.set(w.index(bx, by + 1), WOOD);
    }
  }
  // Canopy: a cluster of leafy clumps.
  const clumps = [
    [0, 2, crown, crown * 0.75],
    [-crown * 0.75, -crown * 0.25, crown * 0.7, crown * 0.55],
    [crown * 0.75, -crown * 0.2, crown * 0.7, crown * 0.55],
    [-crown * 0.35, crown * 0.45, crown * 0.6, crown * 0.5],
    [crown * 0.4, crown * 0.5, crown * 0.6, crown * 0.5],
  ];
  for (const [ox, oy, rx, ry] of clumps) blob2d(w, x + ox, top + oy, rx, ry, PLANT, rand, 0.55);
}

export function autumnPond(w) {
  w.clear();
  const { W, H } = w;
  const rand = rng(11);
  const base = Math.round(H * 0.3);
  const ground = new Int32Array(W);
  const pondC = W * 0.6, pondR = W * 0.17;
  const waterLevel = base - 2;
  for (let x = 0; x < W; x++) {
    let h = base + 3 * Math.sin(x * 0.03) + 2 * Math.sin(x * 0.083 + 1.7) + 1.2 * Math.sin(x * 0.21);
    const dx = (x - pondC) / pondR;
    if (Math.abs(dx) < 1) h = Math.min(h, waterLevel - 16 * (1 - dx * dx) ** 0.7 + 2);
    ground[x] = Math.round(h);
  }
  for (let x = 0; x < W; x++) {
    const h = ground[x];
    const soil = 16 + Math.round(3 * Math.sin(x * 0.05 + 2));
    for (let y = 0; y < h; y++) w.set(w.index(x, y), y < h - soil ? STONE : DIRT);
  }
  // Sandy pond bed and shore.
  for (let x = 0; x < W; x++) {
    const dx = (x - pondC) / pondR;
    if (Math.abs(dx) > 1.18) continue;
    const h = ground[x];
    const thick = Math.abs(dx) > 0.85 ? 3 : 2;
    for (let y = h - thick; y < h; y++) if (y >= 0) w.set(w.index(x, y), SAND);
  }
  for (let x = 0; x < W; x++)
    for (let y = ground[x]; y <= waterLevel; y++) w.set(w.index(x, y), WATER);

  // Wooden dock reaching over the water, with posts down to the bed.
  const dockY = waterLevel + 4;
  const dock0 = Math.round(pondC + pondR * 0.05), dock1 = Math.round(pondC + pondR * 1.15);
  for (let x = dock0; x <= dock1; x++)
    for (let y = dockY; y <= dockY + 1; y++) w.set(w.index(x, y), WOOD);
  for (let x = dock0 + 2; x < dock1; x += 10) {
    for (let y = ground[x] - 1; y < dockY; y++)
      for (let dx = 0; dx < 2; dx++) w.set(w.index(x + dx, y), WOOD);
  }
  // Log stumps in the water, like stepping stones.
  for (const fx of [-0.62, -0.42, -0.22]) {
    const x = Math.round(pondC + pondR * fx);
    for (let y = ground[x] - 1; y <= waterLevel + 2; y++)
      for (let dx = 0; dx < 3; dx++) w.set(w.index(x + dx, y), WOOD);
  }

  // Trees and bushes.
  const t1 = Math.round(W * 0.17);
  tree2d(w, t1, ground[t1], Math.round(H * 0.36), Math.max(9, Math.round(H * 0.13)), rand);
  const t2 = Math.round(W * 0.92);
  tree2d(w, t2, ground[t2], Math.round(H * 0.28), Math.max(7, Math.round(H * 0.1)), rand);
  for (const fx of [0.04, 0.3, 0.38, 0.84]) {
    const x = Math.round(W * fx);
    blob2d(w, x, ground[x] + 2, 5 + rand() * 3, 3.5 + rand() * 1.5, PLANT, rand, 0.4);
  }
  // A few rocks.
  for (const fx of [0.27, 0.8]) {
    const x = Math.round(W * fx);
    blob2d(w, x, ground[x], 3, 2.2, STONE, rand, 0.2);
  }
}

export function emptyBox2d(w) { w.clear(); }

// ----- 3D -----

function sphere3d(w, cx, cy, cz, r, t, rand, rough = 0.4) {
  const ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
    const x = Math.round(cx + dx), y = Math.round(cy + dy), z = Math.round(cz + dz);
    if (x < 0 || y < 0 || z < 0 || x >= w.W || y >= w.H || z >= w.D) continue;
    const d = Math.sqrt(dx * dx + (dy * 1.2) ** 2 + dz * dz) / r;
    if (d > 1 || (d > 0.8 && rand() < rough)) continue;
    const i = w.index(x, y, z);
    if (w.type[i] === EMPTY) { w.set(i, t); w.life[i] = 0; }
  }
}

function tree3d(w, x, z, ground, height, rand) {
  for (let y = ground; y < ground + height; y++) {
    const thick = y < ground + 3;
    for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++) w.set(w.index(x + dx, y, z + dz), WOOD);
    if (thick) {
      for (const [dx, dz] of [[-1, 0], [2, 1], [0, -1], [1, 2]]) if (rand() < 0.7) w.set(w.index(x + dx, y, z + dz), WOOD);
    }
  }
  const top = ground + height;
  // Two short branches.
  for (const [bx, bz] of [[1, 0], [-1, 1]]) {
    let px = x + (bx > 0 ? 1 : 0), py = ground + Math.floor(height * 0.6), pz = z + (bz > 0 ? 1 : 0);
    for (let k = 0; k < 4; k++) { px += bx; pz += bz; py++; w.set(w.index(px, py, pz), WOOD); }
    sphere3d(w, px, py + 1, pz, 3, PLANT, rand);
  }
  sphere3d(w, x + 0.5, top + 1, z + 0.5, 6, PLANT, rand);
  sphere3d(w, x + 3, top - 1, z - 2, 4, PLANT, rand);
  sphere3d(w, x - 2.5, top - 1.5, z + 2.5, 4, PLANT, rand);
}

// Rolling soil height for the glade; the 3D backdrop continues the same hills.
export const gladeHeight = (x, z) => 7 + 1.3 * Math.sin(x * 0.085 + 0.5) + 1.1 * Math.cos(z * 0.075) + 0.6 * Math.sin((x + z) * 0.14);

export function forestGlade(w) {
  w.clear();
  const { W, D } = w;
  const rand = rng(5);
  const pondX = W * 0.68, pondZ = D * 0.62, pondR = W * 0.2;
  const level = 6;
  const hmap = new Int32Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    let h = gladeHeight(x, z);
    const d = Math.hypot((x - pondX) / pondR, (z - pondZ) / (pondR * 0.85));
    if (d < 1.25) h = Math.min(h, level + (d - 1) * 6 + 1);
    hmap[x + z * W] = Math.max(2, Math.round(h));
  }
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = hmap[x + z * W];
    const d = Math.hypot((x - pondX) / pondR, (z - pondZ) / (pondR * 0.85));
    for (let y = 0; y < h; y++) {
      let t = y < 2 ? STONE : DIRT;
      if (d < 1.3 && y >= h - 2) t = SAND;
      w.set(w.index(x, y, z), t);
    }
    for (let y = h; y <= level; y++) w.set(w.index(x, y, z), WATER);
  }
  const g = (x, z) => hmap[x + z * W];
  tree3d(w, 16, 18, g(16, 18), 15, rand);
  tree3d(w, 46, 14, g(46, 14), 11, rand);
  for (const [x, z] of [[8, 44], [28, 10], [24, 52], [56, 34]]) sphere3d(w, x, g(x, z) + 1, z, 2.6, PLANT, rand, 0.3);
  for (const [x, z, r] of [[32, 36, 2.2], [38, 22, 1.8], [12, 30, 1.6]]) sphere3d(w, x, g(x, z), z, r, STONE, rand, 0.2);
}

export function emptyBox3d(w) {
  w.clear();
  for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) {
    w.set(w.index(x, 0, z), STONE);
    w.set(w.index(x, 1, z), STONE);
  }
}

export const SCENES_2D = { pond: autumnPond, empty: emptyBox2d };
export const SCENES_3D = { glade: forestGlade, empty: emptyBox3d };
