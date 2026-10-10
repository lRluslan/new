// The starting world. There is only one world: a 3D block of voxels. The 2D
// view shows one slice of it, so the scene is laid out so that the middle
// slice cuts through the pond, the dock and the two big trees, while more
// trees and bushes fill the depth for the 3D view.

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

// Size of the shared world, in cells: wide, fairly tall and moderately deep.
export const WORLD_SIZE = { W: 256, H: 112, D: 64 };

// Rolling soil height before the pond is dug. The 3D backdrop continues the
// same hills outside the play area.
export function groundHeight(x, z, H = WORLD_SIZE.H) {
  return H * 0.3 + 2.6 * Math.sin(x * 0.045) + 1.6 * Math.sin(x * 0.11 + 1.7) + 1.3 * Math.cos(z * 0.13 + 0.4) + 0.8 * Math.sin((x + z) * 0.09);
}

// Ellipsoid of one element, with a scalloped edge so leaf clumps look bushy.
function blob(w, cx, cy, cz, rx, ry, rz, t, rand, rough = 0.5) {
  const lobes = 4 + ((rand() * 4) | 0), phase = rand() * 6.28;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (x < 0 || y < 0 || z < 0 || x >= w.W || y >= w.H || z >= w.D) continue;
        const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2);
        const edge = 1 - rough * 0.22 * (0.5 + 0.5 * Math.sin(Math.atan2(y - cy, x - cx) * lobes + phase + z * 0.7));
        if (d > edge) continue;
        const i = w.index(x, y, z);
        if (w.type[i] === EMPTY) { w.set(i, t); w.life[i] = 0; }
      }
}

function tree(w, x0, z0, ground, height, crown, rand) {
  let x = x0;
  for (let y = ground - 1; y < Math.min(w.H - 2, ground + height); y++) {
    const f = (y - ground) / height;
    const r = f < 0.08 ? 3 : f < 0.5 ? 2 : f < 0.8 ? 1.6 : 1.2;
    if (rand() < 0.05) x += rand() < 0.5 ? -1 : 1;
    const ri = Math.ceil(r);
    for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
      if (dx * dx + dz * dz > r * r + 0.3) continue;
      const px = x + dx, pz = z0 + dz;
      if (px < 0 || pz < 0 || px >= w.W || pz >= w.D || y < 0) continue;
      w.set(w.index(px, y, pz), WOOD);
    }
  }
  const top = ground + height;
  // Two branches reaching sideways along the slice, two more into the depth.
  for (const [bx, bz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let px = x, py = ground + Math.floor(height * 0.62), pz = z0;
    const len = Math.round(crown * (bz ? 0.45 : 0.7));
    for (let k = 0; k < len; k++) {
      px += bx; pz += bz; if (k % 2 === 0) py++;
      if (px < 0 || px >= w.W || pz < 0 || pz >= w.D || py + 1 >= w.H) break;
      w.set(w.index(px, py, pz), WOOD);
      if (k < len * 0.55) w.set(w.index(px, py + 1, pz), WOOD);
    }
  }
  const c = crown;
  const clumps = [
    [0, 2, 0, c, c * 0.75, c * 0.8],
    [-c * 0.75, -c * 0.25, 0, c * 0.7, c * 0.55, c * 0.6],
    [c * 0.75, -c * 0.2, 0, c * 0.7, c * 0.55, c * 0.6],
    [-c * 0.35, c * 0.45, -c * 0.3, c * 0.6, c * 0.5, c * 0.55],
    [c * 0.4, c * 0.5, c * 0.3, c * 0.6, c * 0.5, c * 0.55],
    [0, -c * 0.1, -c * 0.6, c * 0.6, c * 0.5, c * 0.5],
    [0, -c * 0.1, c * 0.6, c * 0.6, c * 0.5, c * 0.5],
  ];
  for (const [ox, oy, oz, rx, ry, rz] of clumps) blob(w, x + ox, top + oy, z0 + oz, rx, ry, rz, PLANT, rand, 0.55);
}

export function autumnGlade(w) {
  w.clear();
  const { W, H, D } = w;
  const rand = rng(11);
  const zs = Math.floor(D / 2);
  const pondX = W * 0.6, pondRX = W * 0.17, pondRZ = D * 0.3;
  const level = Math.round(H * 0.3) - 2;
  const pondD = (x, z) => Math.hypot((x - pondX) / pondRX, (z - zs) / pondRZ);
  const ground = new Int32Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    let h = groundHeight(x, z, H);
    const d = pondD(x, z);
    if (d < 1) h = Math.min(h, level - 10 * (1 - d * d) ** 0.7 + 2);
    ground[x + W * z] = Math.round(h);
  }
  const g = (x, z) => ground[Math.max(0, Math.min(W - 1, Math.round(x))) + W * Math.max(0, Math.min(D - 1, Math.round(z)))];

  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const h = ground[x + W * z];
    const soil = 12 + Math.round(2 * Math.sin(x * 0.05 + 2) + Math.cos(z * 0.2));
    const d = pondD(x, z);
    const sandy = d < 1.18 ? (d > 0.85 ? 3 : 2) : 0;
    for (let y = 0; y < h; y++) w.set(w.index(x, y, z), y >= h - sandy ? SAND : y < h - soil ? STONE : DIRT);
    for (let y = h; y <= level; y++) w.set(w.index(x, y, z), WATER);
  }

  // Wooden dock across the pond, with posts down to the bed.
  const dockY = level + 4;
  const dock0 = Math.round(pondX + pondRX * 0.05), dock1 = Math.min(W - 1, Math.round(pondX + pondRX * 1.15));
  for (let x = dock0; x <= dock1; x++)
    for (let z = zs - 2; z <= zs + 2; z++) w.set(w.index(x, dockY, z), WOOD);
  for (let x = dock0 + 2; x < dock1; x += 8)
    for (const z of [zs - 2, zs, zs + 2])
      for (let y = g(x, z) - 1; y < dockY; y++) w.set(w.index(x, y, z), WOOD);
  // Log stumps standing in the water.
  for (const fx of [-0.62, -0.42, -0.22]) {
    const x = Math.round(pondX + pondRX * fx);
    for (let y = g(x, zs) - 1; y <= level + 2; y++)
      for (let dz = -1; dz <= 1; dz++) for (let dx = 0; dx < 3; dx++) w.set(w.index(x + dx, y, zs + dz), WOOD);
  }

  // The two big trees sit on the middle slice; the rest fill the depth.
  tree(w, Math.round(W * 0.17), zs, g(W * 0.17, zs), Math.round(H * 0.36), Math.round(H * 0.13), rand);
  tree(w, Math.round(W * 0.92), zs, g(W * 0.92, zs), Math.round(H * 0.28), Math.round(H * 0.1), rand);
  // Positions in depth are fractions of D, so the scene fits any world size.
  const Z = f => Math.round(D * f);
  for (const [fx, fz, hf, cf] of [[0.36, 0.15, 0.3, 0.1], [0.08, 0.82, 0.26, 0.09], [0.55, 0.86, 0.24, 0.08], [0.82, 0.12, 0.27, 0.09],
    [0.27, 0.85, 0.22, 0.08], [0.68, 0.14, 0.25, 0.09], [0.97, 0.8, 0.22, 0.08]]) {
    const x = Math.round(W * fx), z = Z(fz);
    tree(w, x, z, g(x, z), Math.round(H * hf), Math.round(H * cf), rand);
  }
  for (const [fx, fz] of [[0.04, 0.5], [0.3, 0.52], [0.38, 0.48], [0.84, 0.5], [0.22, 0.7], [0.47, 0.25], [0.7, 0.92],
    [0.95, 0.78], [0.15, 0.12], [0.6, 0.3], [0.12, 0.62], [0.88, 0.3]]) {
    const x = Math.round(W * fx), z = Z(fz);
    blob(w, x, g(x, z) + 2, z, 5 + rand() * 3, 3.5 + rand() * 1.5, 4 + rand() * 2, PLANT, rand, 0.4);
  }
  for (const [fx, fz] of [[0.27, 0.5], [0.8, 0.52], [0.6, 0.12], [0.42, 0.8], [0.06, 0.3]]) {
    const x = Math.round(W * fx), z = Z(fz);
    blob(w, x, g(x, z), z, 3, 2.2, 2.6, STONE, rand, 0.2);
  }
}

export function emptyWorld(w) {
  w.clear();
  for (let z = 0; z < w.D; z++) for (let x = 0; x < w.W; x++) {
    w.set(w.index(x, 0, z), STONE);
    w.set(w.index(x, 1, z), STONE);
  }
}
