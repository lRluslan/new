// The physics engine. One grid of cells runs both modes: the 2D world is a
// grid that is one cell deep, the 3D world is a full block of voxels.
//
// Each step does three things:
//   1. Phase changes and chemistry (melting, burning, acid, growth...).
//   2. Movement: gravity with real acceleration, density sorting, liquids
//      levelling out, gases rising, and flying debris from explosions.
//   3. Heat: conduction between neighbours (weighted by heat capacity),
//      hot air rising (convection) and slow cooling to room temperature.

import {
  EMPTY, STONE, DIRT, SAND, GUNPOWDER, SEED, WATER, OIL, ACID, LAVA, STEAM, SMOKE,
  FIRE, WOOD, PLANT, OBSIDIAN, ASH, COUNT, SOLID, POWDER, LIQUID, GAS, AMBIENT, FIRE_TEMP, DISC,
  STATE, DENS, K, CAP, TEMP0, HOT_AT, HOT_TO, HOT_DISC, COLD_AT, COLD_TO, COLD_DISC, LATENT_HOT, LATENT_COLD,
  IGNITE, BURN_TIME, BURN_HEAT, ASH_CHANCE, SLIDE, FLOW, VISC, RISE, LIFE_MIN, LIFE_SPAN,
  HARD, GLOWS,
} from './elements.js';

const GRAVITY = 0.3;   // cells per step², so falling things speed up
const MAX_SPEED = 7;   // terminal velocity in cells per step
const BURNING = 4;     // flag bit: this cell is on fire
const GROWING = 8;     // flag bit: tip of a growing tree
const CHUNK = 16;      // 3D mesh chunk size

// How fast heat flows between two element types, and the chance that a
// heavier element sinks through a lighter liquid in one step.
const PAIR_K = new Float32Array(COUNT * COUNT);
const SINK = new Float32Array(COUNT * COUNT);
for (let a = 0; a < COUNT; a++) {
  for (let b = 0; b < COUNT; b++) {
    PAIR_K[a * COUNT + b] = Math.min(K[a], K[b]) * CAP[a] * CAP[b] / (CAP[a] + CAP[b]);
    SINK[a * COUNT + b] = DENS[a] > DENS[b] ? Math.min(1, 1.6 * (DENS[a] - DENS[b]) / DENS[a]) : 0;
  }
}
const INV_CAP = CAP.map(c => 1 / c);
const AIRY = new Uint8Array(COUNT);
AIRY[EMPTY] = 1; AIRY[FIRE] = 1; AIRY[SMOKE] = 1;

// Cells that can rest: solids and powders. A resting cell at a steady
// temperature is skipped, which keeps the large buried ground cheap.
const BLOCKS = new Uint8Array(COUNT);
const CAN_SLEEP = new Uint8Array(COUNT);
const WAKE_T = new Float32Array(COUNT);
for (let t = 1; t < COUNT; t++) {
  BLOCKS[t] = STATE[t] === SOLID || STATE[t] === POWDER ? 1 : 0;
  CAN_SLEEP[t] = BLOCKS[t] && t !== SEED ? 1 : 0;
  WAKE_T[t] = Math.min(IGNITE[t] || Infinity, GLOWS[t] ? Infinity : 525);
}
// Liquids that can rest when calm (acid keeps working, so it never rests).
const CALM_OK = new Uint8Array(COUNT);
const FULL = new Uint8Array(COUNT);
for (let t = 1; t < COUNT; t++) {
  CALM_OK[t] = STATE[t] === LIQUID && t !== ACID ? 1 : 0;
  FULL[t] = STATE[t] !== GAS ? 1 : 0;
}

export class World {
  constructor(W, H, D = 1) {
    this.W = W; this.H = H; this.D = D;
    this.L = W * D;            // cells per horizontal layer
    this.N = W * H * D;
    this.is3D = D > 1;
    const N = this.N;
    this.type = new Uint8Array(N);
    this.temp = new Float32Array(N).fill(AMBIENT);
    this.life = new Int16Array(N);
    this.latent = new Float32Array(N); // heat soaked up toward a phase change
    this.shade = new Uint8Array(N);
    this.flags = new Uint8Array(N);
    this.vx = new Float32Array(N);
    this.vy = new Float32Array(N);
    this.vz = new Float32Array(N);
    this.stamp = new Uint8Array(N);
    this.clock = 0;
    this.found = new Uint8Array(32);
    this.events = [];
    this.steps = 0;
    this.quiet = 0;   // steps to ignore discoveries for, while a new scene settles
    this.setupChunks();
  }

  // ----- 3D chunk bookkeeping so the renderer only rebuilds what changed -----
  setupChunks() {
    const { W, H, D, N } = this;
    this.CX = Math.ceil(W / CHUNK); this.CY = Math.ceil(H / CHUNK); this.CZ = Math.ceil(D / CHUNK);
    this.chunkCount = this.CX * this.CY * this.CZ;
    this.dirty = new Uint8Array(this.chunkCount).fill(1);
    this.heatAct = new Uint8Array(this.chunkCount).fill(1); // regions holding heat away from 20 °C
    this.awake = new Uint8Array(this.chunkCount).fill(1);   // regions where something may move
    this.awakeNext = new Uint8Array(this.chunkCount).fill(1);
    this.chunkOf = new Uint16Array(N);
    this.edge = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const i = x + W * (z + D * y);
      const cx = x >> 4, cy = y >> 4, cz = z >> 4;
      this.chunkOf[i] = cx + this.CX * (cz + this.CZ * cy);
      const lx = x & 15, ly = y & 15, lz = z & 15;
      let e = 0;
      if (lx === 0 && x > 0) e |= 1;
      if (lx === 15 && x < W - 1) e |= 2;
      if (lz === 0 && z > 0) e |= 4;
      if (lz === 15 && z < D - 1) e |= 8;
      if (ly === 0 && y > 0) e |= 16;
      if (ly === 15 && y < H - 1) e |= 32;
      this.edge[i] = e;
    }
  }

  // A cell changed: its region needs a new mesh and must be simulated next step.
  touch(i) {
    const c = this.chunkOf[i], d = this.dirty, a = this.awakeNext;
    d[c] = 1; a[c] = 1;
    const e = this.edge[i];
    if (e) {
      const sz = this.CX, sy = this.CX * this.CZ;
      if (e & 1) { d[c - 1] = 1; a[c - 1] = 1; }
      if (e & 2) { d[c + 1] = 1; a[c + 1] = 1; }
      if (e & 4) { d[c - sz] = 1; a[c - sz] = 1; }
      if (e & 8) { d[c + sz] = 1; a[c + sz] = 1; }
      if (e & 16) { d[c - sy] = 1; a[c - sy] = 1; }
      if (e & 32) { d[c + sy] = 1; a[c + sy] = 1; }
    }
  }

  index(x, y, z = 0) { return x + this.W * (z + this.D * y); }

  discover(id) {
    if (id >= 0 && !this.found[id] && this.quiet === 0) { this.found[id] = 1; this.events.push(id); }
  }

  // ----- cell edits -----
  set(i, t, T) {
    this.type[i] = t;
    this.shade[i] = (Math.random() * 256) | 0;
    this.flags[i] = (Math.random() * 4) | 0; // random flow direction for liquids
    this.vx[i] = 0; this.vy[i] = 0; this.vz[i] = 0;
    this.life[i] = LIFE_MIN[t] + ((Math.random() * LIFE_SPAN[t]) | 0);
    this.latent[i] = 0;
    if (T !== undefined) this.temp[i] = T;
    else if (t !== EMPTY) this.temp[i] = TEMP0[t];
    this.touch(i);
  }

  // Change what a cell is made of but keep its heat (phase changes).
  morph(i, t) {
    this.type[i] = t;
    this.flags[i] &= 3;
    this.vx[i] = 0; this.vy[i] = 0; this.vz[i] = 0;
    this.life[i] = LIFE_MIN[t] + ((Math.random() * LIFE_SPAN[t]) | 0);
    this.latent[i] = 0;
    this.touch(i);
  }

  swap(a, b) {
    const ty = this.type, te = this.temp, li = this.life, sh = this.shade, fl = this.flags;
    const vx = this.vx, vy = this.vy, vz = this.vz;
    let u = ty[a]; ty[a] = ty[b]; ty[b] = u;
    let f = te[a]; te[a] = te[b]; te[b] = f;
    u = li[a]; li[a] = li[b]; li[b] = u;
    u = sh[a]; sh[a] = sh[b]; sh[b] = u;
    u = fl[a]; fl[a] = fl[b]; fl[b] = u;
    f = vx[a]; vx[a] = vx[b]; vx[b] = f;
    f = vy[a]; vy[a] = vy[b]; vy[b] = f;
    f = vz[a]; vz[a] = vz[b]; vz[b] = f;
    const la = this.latent;
    f = la[a]; la[a] = la[b]; la[b] = f;
    this.stamp[a] = this.clock; this.stamp[b] = this.clock;
    this.touch(a); this.touch(b);
  }

  clear() {
    this.type.fill(0); this.temp.fill(AMBIENT); this.life.fill(0); this.flags.fill(0); this.latent.fill(0);
    this.vx.fill(0); this.vy.fill(0); this.vz.fill(0);
    this.dirty.fill(1);
    this.heatAct.fill(1);
    this.awake.fill(1);
    this.awakeNext.fill(1);
    this.quiet = 90;
  }

  // ----- neighbours -----
  hasNeighbor(i, x, y, z, t) {
    const ty = this.type, W = this.W, L = this.L;
    if (x > 0 && ty[i - 1] === t) return true;
    if (x < W - 1 && ty[i + 1] === t) return true;
    if (y > 0 && ty[i - L] === t) return true;
    if (y < this.H - 1 && ty[i + L] === t) return true;
    if (this.is3D) {
      if (z > 0 && ty[i - W] === t) return true;
      if (z < this.D - 1 && ty[i + W] === t) return true;
    }
    return false;
  }

  // Is there oxygen next to this cell? Flames and smoke mix with air;
  // steam does not, which is why steam smothers fires.
  hasAir(i, x, y, z) {
    const ty = this.type, W = this.W, L = this.L;
    if (x > 0 && AIRY[ty[i - 1]]) return true;
    if (x < W - 1 && AIRY[ty[i + 1]]) return true;
    if (y > 0 && AIRY[ty[i - L]]) return true;
    if (y < this.H - 1 && AIRY[ty[i + L]]) return true;
    if (this.is3D) {
      if (z > 0 && AIRY[ty[i - W]]) return true;
      if (z < this.D - 1 && AIRY[ty[i + W]]) return true;
    }
    return false;
  }

  randomNeighbor(i, x, y, z) {
    const r = (Math.random() * (this.is3D ? 6 : 4)) | 0;
    switch (r) {
      case 0: return x > 0 ? i - 1 : -1;
      case 1: return x < this.W - 1 ? i + 1 : -1;
      case 2: return y > 0 ? i - this.L : -1;
      case 3: return y < this.H - 1 ? i + this.L : -1;
      case 4: return z > 0 ? i - this.W : -1;
      default: return z < this.D - 1 ? i + this.W : -1;
    }
  }

  // Can a particle of type t move into a cell holding type o?
  canEnter(t, o) {
    if (o === EMPTY) return true;
    const so = STATE[o];
    if (so === GAS) return STATE[t] !== GAS || DENS[o] > DENS[t];
    if (so === LIQUID) return Math.random() < SINK[t * COUNT + o];
    return false;
  }

  // ----- main step -----
  step() {
    this.clock = (this.clock % 255) + 1;
    this.steps++;
    if (this.quiet > 0) this.quiet--;
    // Regions marked during the last step (or by painting since) are scanned
    // now; this step's activity marks regions for the next one.
    const awake = this.awakeNext;
    this.awakeNext = this.awake;
    this.awake = awake;
    const next = this.awakeNext;
    next.fill(0);
    const { W, H, D, type, stamp, temp, flags, vx, vy, vz, life, heatAct, CX, CY, CZ } = this;
    const clock = this.clock;
    const flipX = clock & 1, flipZ = (clock >> 1) & 1;
    for (let cy = 0; cy < CY; cy++) {
      const y0 = cy * CHUNK, y1 = Math.min(H, y0 + CHUNK);
      for (let czz = 0; czz < CZ; czz++) {
        const cz = flipZ ? CZ - 1 - czz : czz;
        const z0 = cz * CHUNK, z1 = Math.min(D, z0 + CHUNK);
        for (let cxx = 0; cxx < CX; cxx++) {
          const cx = flipX ? CX - 1 - cxx : cxx;
          const c = cx + CX * (cz + CZ * cy);
          if (!awake[c] && !heatAct[c]) continue;
          const x0 = cx * CHUNK, x1 = Math.min(W, x0 + CHUNK);
          for (let y = y0; y < y1; y++) {
            for (let zz = z0; zz < z1; zz++) {
              const z = flipZ ? z1 - 1 - (zz - z0) : zz;
              const row = W * (z + D * y);
              for (let xx = x0; xx < x1; xx++) {
                const x = flipX ? x1 - 1 - (xx - x0) : xx;
                const i = row + x;
                const t = type[i];
                if (t === EMPTY || stamp[i] === clock) continue;
                const T = temp[i];
                if (T !== AMBIENT) heatAct[c] = 1;
                // Fast path: a resting solid or powder with nothing to react to.
                if (CAN_SLEEP[t] && T <= HOT_AT[t] && T >= COLD_AT[t] && T < WAKE_T[t] && (flags[i] & (BURNING | GROWING)) === 0) {
                  if (STATE[t] === SOLID) { if (t !== PLANT || life[i] <= 0) continue; }
                  else if (vx[i] === 0 && vy[i] === 0 && vz[i] === 0 && this.settled(i, x, y, z)) continue;
                } else if (CALM_OK[t] && T <= HOT_AT[t] && T >= COLD_AT[t] && T < WAKE_T[t] && (flags[i] & BURNING) === 0 &&
                  vx[i] === 0 && vy[i] === 0 && vz[i] === 0 && this.calm(i, t, x, y, z)) {
                  continue;
                }
                next[c] = 1;
                this.update(i, t, x, y, z);
              }
            }
          }
        }
      }
    }
    this.conduct();
  }

  // A liquid is calm when it cannot fall, slide or flow: everything below is
  // solid or at least as dense, and its sides are full.
  calm(i, t, x, y, z) {
    const { W, H, D, L, type } = this;
    if (y > 0) {
      const b = i - L;
      if (!this.holds(t, type[b])) return false;
      for (let k = 0; k < 8; k++) {
        const nx = x + DIAG_X[k], nz = z + DIAG_Z[k];
        if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
        if (!this.holds(t, type[b + DIAG_X[k] + DIAG_Z[k] * W])) return false;
      }
    }
    if (x > 0 && !FULL[type[i - 1]]) return false;
    if (x < W - 1 && !FULL[type[i + 1]]) return false;
    if (z > 0 && !FULL[type[i - W]]) return false;
    if (z < D - 1 && !FULL[type[i + W]]) return false;
    return true;
  }

  holds(t, o) { return BLOCKS[o] === 1 || (STATE[o] === LIQUID && DENS[o] >= DENS[t]); }

  // A powder is settled when the cell below and every diagonal below are full.
  settled(i, x, y, z) {
    if (y === 0) return true;
    const { W, D, type } = this;
    const b = i - this.L;
    if (!BLOCKS[type[b]]) return false;
    for (let k = 0; k < 8; k++) {
      const nx = x + DIAG_X[k], nz = z + DIAG_Z[k];
      if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
      if (!BLOCKS[type[b + DIAG_X[k] + DIAG_Z[k] * W]]) return false;
    }
    return true;
  }

  update(i, t, x, y, z) {
    const T = this.temp[i];

    // Phase changes driven by temperature.
    if (T > HOT_AT[t]) {
      const lat = LATENT_HOT[t];
      if (lat) {
        // Extra heat goes into melting/boiling instead of raising the temperature.
        const p = this.latent[i] + (T - HOT_AT[t]);
        this.temp[i] = HOT_AT[t];
        if (p >= lat) { this.morph(i, HOT_TO[t]); this.discover(HOT_DISC[t]); return; }
        this.latent[i] = p;
      } else if (Math.random() < 0.25) {
        this.morph(i, HOT_TO[t]);
        this.discover(HOT_DISC[t]);
        return;
      }
    } else if (T < COLD_AT[t]) {
      if (this.cool(i, t, x, y, z)) return;
    }

    // Combustion.
    if (this.flags[i] & BURNING) {
      if (this.burn(i, t, x, y, z)) return;
    } else if (IGNITE[t] && T >= IGNITE[t]) {
      // Gunpowder carries its own oxidiser. Everything else needs air to catch fire.
      if (t === GUNPOWDER) { this.explode(x, y, z); return; }
      if (!this.hasAir(i, x, y, z)) return this.moveOnly(i, t, x, y, z);
      this.flags[i] |= BURNING;
      this.life[i] = BURN_TIME[t] * (0.6 + Math.random() * 0.8);
      this.discover(t === OIL ? DISC.OIL_FIRE : t === WOOD ? DISC.BURN_WOOD : DISC.WILDFIRE);
    }

    const s = STATE[t];
    if (T > 525 && !GLOWS[t] && (s === SOLID || s === POWDER)) this.discover(DISC.GLOW);

    switch (s) {
      case POWDER: {
        const j = this.movePowder(i, t, x, y, z);
        if (t === SEED && j === i) this.sprout(i, x, y, z);
        break;
      }
      case LIQUID:
        if (t === ACID && this.corrode(i, x, y, z)) return;
        this.moveLiquid(i, t, x, y, z);
        break;
      case GAS:
        this.updateGas(i, t, x, y, z);
        break;
      case SOLID:
        if (t === PLANT) this.growPlant(i, x, y, z);
        else if (t === WOOD && (this.flags[i] & GROWING)) this.growTree(i, x, y, z);
        break;
    }
  }

  moveOnly(i, t, x, y, z) {
    const s = STATE[t];
    if (s === POWDER) this.movePowder(i, t, x, y, z);
    else if (s === LIQUID) this.moveLiquid(i, t, x, y, z);
  }

  cool(i, t, x, y, z) {
    if (t === LAVA) {
      if (Math.random() < 0.3) {
        const quenched = this.hasNeighbor(i, x, y, z, WATER) || this.hasNeighbor(i, x, y, z, STEAM);
        this.morph(i, quenched ? OBSIDIAN : STONE);
        this.discover(quenched ? DISC.OBSIDIAN : DISC.CRUST);
        return true;
      }
      return false;
    }
    if (t === STEAM) {
      // Condensation needs time, and happens faster at the ceiling.
      const chance = y === this.H - 1 ? 0.03 : 0.006;
      if (Math.random() < chance || this.life[i] <= 0) {
        this.morph(i, WATER);
        this.discover(DISC.RAIN);
        return true;
      }
      return false;
    }
    const lat = LATENT_COLD[t];
    if (lat) {
      const p = this.latent[i] - (COLD_AT[t] - this.temp[i]);
      this.temp[i] = COLD_AT[t];
      if (p <= -lat) { this.morph(i, COLD_TO[t]); this.discover(COLD_DISC[t]); return true; }
      this.latent[i] = p;
      return false;
    }
    if (Math.random() < 0.15) {
      this.morph(i, COLD_TO[t]);
      this.discover(COLD_DISC[t]);
      return true;
    }
    return false;
  }

  burn(i, t, x, y, z) {
    // Fire needs air. Buried fuel stops making heat and soon goes out.
    if (!this.hasAir(i, x, y, z)) {
      if (Math.random() < 0.1) { this.flags[i] &= ~BURNING; this.temp[i] = Math.min(this.temp[i], IGNITE[t] - 20); }
      return false;
    }
    const life = --this.life[i];
    if (this.temp[i] < BURN_HEAT[t]) this.temp[i] = BURN_HEAT[t];

    // Water smothers burning solids. Oil floats on water, so oil fires keep going.
    if (t !== OIL && this.hasNeighbor(i, x, y, z, WATER) && Math.random() < 0.4) {
      this.flags[i] &= ~BURNING;
      this.temp[i] = 90;
      this.discover(DISC.EXTINGUISH);
      return false;
    }

    // Flames lick upward into the air.
    const L = this.L;
    const up = y < this.H - 1 ? i + L : -1;
    if (up >= 0 && this.type[up] === EMPTY && Math.random() < 0.25) {
      this.set(up, FIRE);
    } else {
      const n = this.randomNeighbor(i, x, y, z);
      if (n >= 0 && this.type[n] === EMPTY && Math.random() < 0.15) this.set(n, FIRE);
    }

    if (life <= 0) {
      if (Math.random() < ASH_CHANCE[t]) this.morph(i, ASH);
      else this.set(i, FIRE, FIRE_TEMP);
      return true;
    }
    return false;
  }

  explode(x, y, z) {
    const { W, H, D, type, temp } = this;
    const r = this.is3D ? 4.5 : 7;
    const ri = Math.ceil(r);
    const power = this.is3D ? 3.2 : 5;
    for (let dy = -ri; dy <= ri; dy++) {
      const ny = y + dy; if (ny < 0 || ny >= H) continue;
      for (let dz = -ri; dz <= ri; dz++) {
        const nz = z + dz; if (nz < 0 || nz >= D) continue;
        if (!this.is3D && dz !== 0) continue;
        for (let dx = -ri; dx <= ri; dx++) {
          const nx = x + dx; if (nx < 0 || nx >= W) continue;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > r) continue;
          const j = nx + W * (nz + D * ny);
          const t = type[j];
          const f = 1 - d / r;
          const hot = AMBIENT + 700 * f;
          if (temp[j] < hot) temp[j] = hot;
          this.heatAct[this.chunkOf[j]] = 1;
          if (t === EMPTY) { if (d < r * 0.6 && Math.random() < 0.7) this.set(j, FIRE, 1400); continue; }
          const s = STATE[t];
          if (t === GUNPOWDER) { temp[j] = Math.max(temp[j], 400); continue; }
          if (d < r * 0.5 && HARD[t] > 0.3 && t !== WATER) { this.set(j, FIRE, 1400); continue; }
          if ((s === POWDER || s === LIQUID) && d > 0) {
            const k = power * f / d;
            this.vx[j] += dx * k;
            this.vy[j] += dy * k + power * f * 0.6;
            this.vz[j] += dz * k;
          }
        }
      }
    }
    const i = x + W * (z + D * y);
    this.set(i, FIRE, 1500);
    this.discover(DISC.EXPLODE);
  }

  // ----- movement -----
  movePowder(i, t, x, y, z) {
    if (this.vx[i] !== 0 || this.vz[i] !== 0 || this.vy[i] > 0) return this.fly(i, t, x, y, z);
    const j = this.fall(i, t, y);
    if (j >= 0) return j;
    if (y > 0 && Math.random() < SLIDE[t]) {
      const k = this.slideDown(i, t, x, z);
      if (k >= 0) return k;
    }
    return i;
  }

  moveLiquid(i, t, x, y, z) {
    if (this.vx[i] !== 0 || this.vz[i] !== 0 || this.vy[i] > 0) return this.fly(i, t, x, y, z);
    if (VISC[t] < 1 && Math.random() > VISC[t]) return i;
    const j = this.fall(i, t, y);
    if (j >= 0) return j;
    if (y > 0) {
      const k = this.slideDown(i, t, x, z);
      if (k >= 0) return k;
    }
    return this.spread(i, t, x, y, z);
  }

  // Free fall with acceleration. Returns the new index, or -1 if blocked.
  fall(i, t, y) {
    const L = this.L, ty = this.type;
    if (y === 0) { this.vy[i] = 0; return -1; }
    const below = ty[i - L];
    if (!this.canEnter(t, below)) { this.vy[i] = 0; return -1; }
    if (STATE[below] === LIQUID) {
      if (STATE[t] === POWDER) this.discover(DISC.SINK);
      else if (below === OIL && t === WATER) this.discover(DISC.FLOAT);
    }
    let v = this.vy[i] - GRAVITY;
    if (v < -MAX_SPEED) v = -MAX_SPEED;
    let n = Math.max(1, Math.round(-v));
    let cur = i, cy = y;
    while (n > 0 && cy > 0 && this.canEnter(t, ty[cur - L])) {
      this.swap(cur, cur - L);
      cur -= L; cy--; n--;
    }
    // Hitting something stops the fall; liquids splash sideways a little.
    if (n > 0 || cy === 0) {
      if (STATE[t] === LIQUID && v < -3 && Math.random() < 0.3) {
        const sp = -v * 0.35;
        if (this.is3D && Math.random() < 0.5) this.vz[cur] = Math.random() < 0.5 ? sp : -sp;
        else this.vx[cur] = Math.random() < 0.5 ? sp : -sp;
      }
      v = 0;
    }
    this.vy[cur] = v;
    return cur;
  }

  slideDown(i, t, x, z) {
    const { W, D, L, type } = this;
    const below = i - L;
    if (!this.is3D) {
      const first = Math.random() < 0.5 ? -1 : 1;
      for (let k = 0; k < 2; k++) {
        const dx = k === 0 ? first : -first;
        const nx = x + dx;
        if (nx < 0 || nx >= W) continue;
        const j = below + dx;
        if (this.canEnter(t, type[j])) { this.swap(i, j); return j; }
      }
      return -1;
    }
    const start = (Math.random() * 8) | 0;
    for (let k = 0; k < 8; k++) {
      const d = (start + k) & 7;
      const dx = DIAG_X[d], dz = DIAG_Z[d];
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nx >= W || nz < 0 || nz >= D) continue;
      const j = below + dx + dz * W;
      if (this.canEnter(t, type[j])) { this.swap(i, j); return j; }
    }
    return -1;
  }

  // Liquids flow sideways and keep their direction until blocked,
  // which lets them level out like real water.
  spread(i, t, x, y, z) {
    const { W, D, L, type } = this;
    const fl = this.flags;
    const dirs = this.is3D ? 4 : 2;
    let dir = fl[i] & 3;
    if (dir >= dirs) dir &= 1;
    const steps = FLOW[t];
    for (let attempt = 0; attempt < 2; attempt++) {
      const dx = SIDE_X[dir], dz = SIDE_Z[dir];
      const off = dx + dz * W;
      let cur = i, cx = x, cz = z;
      for (let s = 0; s < steps; s++) {
        cx += dx; cz += dz;
        if (cx < 0 || cx >= W || cz < 0 || cz >= D) break;
        const j = cur + off;
        const o = type[j];
        if (o !== EMPTY && STATE[o] !== GAS) break;
        this.swap(cur, j);
        cur = j;
        if (y > 0 && type[j - L] === EMPTY) break; // found a drop, fall next step
      }
      if (cur !== i) {
        fl[cur] = (fl[cur] & ~3) | dir;
        return cur;
      }
      dir = this.is3D ? (Math.random() * 4) | 0 : dir ^ 1;
    }
    fl[i] = (fl[i] & ~3) | dir;
    return i;
  }

  // Ballistic flight for things thrown by explosions and splashes.
  fly(i, t, x, y, z) {
    const { W, H, D, type } = this;
    let vx = this.vx[i], vy = this.vy[i] - GRAVITY, vz = this.vz[i];
    if (vy < -MAX_SPEED) vy = -MAX_SPEED;
    if (vy > MAX_SPEED) vy = MAX_SPEED;
    if (vx > MAX_SPEED) vx = MAX_SPEED; else if (vx < -MAX_SPEED) vx = -MAX_SPEED;
    if (vz > MAX_SPEED) vz = MAX_SPEED; else if (vz < -MAX_SPEED) vz = -MAX_SPEED;
    const steps = Math.ceil(Math.max(Math.abs(vx), Math.abs(vy), Math.abs(vz)));
    let cur = i, cx = x, cy = y, cz = z, hit = false;
    for (let s = 1; s <= steps; s++) {
      const nx = x + Math.round(vx * s / steps);
      const ny = y + Math.round(vy * s / steps);
      const nz = z + Math.round(vz * s / steps);
      if (nx === cx && ny === cy && nz === cz) continue;
      if (nx < 0 || nx >= W) { vx = -vx * 0.3; hit = true; break; }
      if (nz < 0 || nz >= D) { vz = -vz * 0.3; hit = true; break; }
      if (ny < 0 || ny >= H) { vy = 0; hit = true; break; }
      const j = nx + W * (nz + D * ny);
      if (this.canEnter(t, type[j])) {
        this.swap(cur, j);
        cur = j; cx = nx; cy = ny; cz = nz;
      } else {
        hit = true;
        if (ny < cy) vy = 0; else if (ny > cy) vy *= -0.2;
        break;
      }
    }
    vx *= hit ? 0.5 : 0.97;
    vz *= hit ? 0.5 : 0.97;
    if (Math.abs(vx) < 0.35) vx = 0;
    if (Math.abs(vz) < 0.35) vz = 0;
    this.vx[cur] = vx; this.vy[cur] = vy; this.vz[cur] = vz;
    return cur;
  }

  updateGas(i, t, x, y, z) {
    const life = --this.life[i];
    if (t === FIRE) {
      if (this.temp[i] < FIRE_TEMP) this.temp[i] = FIRE_TEMP;
      if (this.hasNeighbor(i, x, y, z, WATER) && Math.random() < 0.5) {
        // The flame dies and its heat goes into the water.
        this.set(i, EMPTY, 100);
        const n = this.randomNeighbor(i, x, y, z);
        if (n >= 0 && this.type[n] === WATER) this.temp[n] += 8;
        this.discover(DISC.EXTINGUISH);
        return;
      }
      if (life <= 0) { this.set(i, Math.random() < 0.3 ? SMOKE : EMPTY, this.temp[i] * 0.4); return; }
      // Flames heat whatever they touch (radiant heat), which is how fire spreads.
      const n = this.randomNeighbor(i, x, y, z);
      if (n >= 0) {
        const o = this.type[n];
        if (o !== EMPTY && o !== FIRE && o !== WATER) this.temp[n] += (FIRE_TEMP - this.temp[n]) * 0.25;
      }
      if (y > 0) {
        const b = i - this.L, o = this.type[b];
        if (o !== EMPTY && o !== FIRE && o !== WATER) this.temp[b] += (FIRE_TEMP - this.temp[b]) * 0.25;
      }
    } else if (t === SMOKE) {
      if (life <= 0 || (y === this.H - 1 && Math.random() < 0.05)) { this.set(i, EMPTY, this.temp[i]); return; }
    } else if (t === STEAM && life <= 0) {
      this.morph(i, WATER);
      this.discover(DISC.RAIN);
      return;
    }

    const { W, D, L, type } = this;
    if (y < this.H - 1 && Math.random() < RISE[t]) {
      const up = i + L;
      const o = type[up];
      if (o === EMPTY || (STATE[o] === GAS && DENS[o] > DENS[t]) || (STATE[o] === LIQUID && Math.random() < 0.3)) {
        this.swap(i, up);
        return;
      }
      // Blocked: slip diagonally upward around the obstacle.
      const d = this.is3D ? (Math.random() * 4) | 0 : (Math.random() * 2) | 0;
      const nx = x + SIDE_X[d], nz = z + SIDE_Z[d];
      if (nx >= 0 && nx < W && nz >= 0 && nz < D) {
        const j = up + SIDE_X[d] + SIDE_Z[d] * W;
        if (type[j] === EMPTY) { this.swap(i, j); return; }
      }
    }
    if (Math.random() < 0.5) {
      const d = this.is3D ? (Math.random() * 4) | 0 : (Math.random() * 2) | 0;
      const nx = x + SIDE_X[d], nz = z + SIDE_Z[d];
      if (nx >= 0 && nx < W && nz >= 0 && nz < D) {
        const j = i + SIDE_X[d] + SIDE_Z[d] * W;
        if (type[j] === EMPTY) this.swap(i, j);
      }
    }
  }

  // ----- chemistry and life -----
  corrode(i, x, y, z) {
    if (Math.random() > 0.3) return false;
    const n = this.randomNeighbor(i, x, y, z);
    if (n < 0) return false;
    const o = this.type[n];
    if (o === EMPTY || o === ACID || STATE[o] === GAS) return false;
    if (Math.random() < HARD[o] * 0.5) {
      this.set(n, Math.random() < 0.25 ? SMOKE : EMPTY, this.temp[n] + 15);
      this.discover(DISC.ACID);
      if (Math.random() < 0.3) { this.set(i, EMPTY); return true; }
    }
    return false;
  }

  growPlant(i, x, y, z) {
    if (this.life[i] <= 0 || Math.random() > 0.03) return;
    const n = this.randomNeighbor(i, x, y, z);
    if (n >= 0 && this.type[n] === WATER) {
      this.set(n, PLANT);
      this.life[n] = this.life[i] - 1;
      this.life[i]--;
      this.discover(DISC.GROW);
    }
  }

  sprout(i, x, y, z) {
    if (y === 0) return;
    const below = this.type[i - this.L];
    const T = this.temp[i];
    if (T < 4 || T > 45) return;
    const wet = this.hasNeighbor(i, x, y, z, WATER);
    let chance = 0;
    if (below === DIRT) chance = wet ? 0.05 : 0.004;
    else if (below === SAND || below === PLANT) chance = wet ? 0.01 : 0;
    if (Math.random() >= chance) return;
    this.morph(i, WOOD);
    this.flags[i] = GROWING;
    this.life[i] = this.is3D ? 8 + ((Math.random() * 9) | 0) : 16 + ((Math.random() * 22) | 0);
    // Water touching the seed is drunk by the sprouting tree.
    if (wet) {
      const n = this.randomNeighbor(i, x, y, z);
      if (n >= 0 && this.type[n] === WATER) this.set(n, EMPTY);
    }
    this.discover(DISC.SPROUT);
  }

  growTree(i, x, y, z) {
    if (Math.random() > (this.is3D ? 0.1 : 0.15)) return;
    const { W, H, D, L, type } = this;
    const left = this.life[i];
    this.flags[i] &= ~GROWING;
    if (left <= 0 || y >= H - 2) { this.leaves(x, y, z); return; }
    let dx = 0, dz = 0;
    const r = Math.random();
    if (r < 0.12) dx = -1; else if (r < 0.24) dx = 1;
    else if (this.is3D && r < 0.3) dz = -1; else if (this.is3D && r < 0.36) dz = 1;
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nx >= W || nz < 0 || nz >= D) { this.leaves(x, y, z); return; }
    const j = i + L + dx + dz * W;
    const o = type[j];
    if (o !== EMPTY && o !== PLANT && o !== WATER && STATE[o] !== GAS) { this.leaves(x, y, z); return; }
    this.set(j, WOOD, AMBIENT);
    this.flags[j] = GROWING;
    this.life[j] = left - 1;
    this.stamp[j] = this.clock;
    // Thicker trunk near the ground in 2D.
    if (!this.is3D && left > 18 && x + 1 < W && type[i + 1] === EMPTY) this.set(i + 1, WOOD, AMBIENT);
    // Occasional side branch.
    if (!this.is3D && left < 14 && left > 4 && Math.random() < 0.18) {
      const bx = x + (Math.random() < 0.5 ? -2 : 2);
      if (bx >= 0 && bx < W) {
        const b = bx + W * (y + 1);
        if (type[b] === EMPTY) { this.set(b, WOOD, AMBIENT); this.flags[b] = GROWING; this.life[b] = (left * 0.5) | 0; }
      }
    }
  }

  leaves(x, y, z) {
    const { W, H, D, type } = this;
    const blobs = this.is3D
      ? [[0, 1, 0, 3.2]]
      : [[0, 2, 0, 6 + Math.random() * 3], [-5, -1, 0, 4.5], [5, -1, 0, 4.5]];
    for (const [ox, oy, oz, r] of blobs) {
      const ri = Math.ceil(r);
      for (let dy = -ri; dy <= ri; dy++) for (let dz = this.is3D ? -ri : 0; dz <= (this.is3D ? ri : 0); dz++)
        for (let dx = -ri; dx <= ri; dx++) {
          const nx = x + ox + dx, ny = y + oy + dy, nz = z + oz + dz;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || nz < 0 || nz >= D) continue;
          const d = Math.sqrt(dx * dx + (dy * 1.3) ** 2 + dz * dz) / r;
          if (d > 1 || (d > 0.75 && Math.random() < 0.5)) continue;
          const j = nx + W * (nz + D * ny);
          if (type[j] === EMPTY) { this.set(j, PLANT, AMBIENT); this.life[j] = 0; }
        }
    }
  }

  // ----- heat -----
  // Heat flows only in 16³ regions that hold heat (or touch one that does);
  // everywhere else is already at room temperature.
  conduct() {
    const { W, H, D, L, type, temp, CX, CY, CZ, heatAct } = this;
    const sZ = CX, sY = CX * CZ;
    for (let cy = 0; cy < CY; cy++) for (let cz = 0; cz < CZ; cz++) for (let cx = 0; cx < CX; cx++) {
      const c = cx + sZ * cz + sY * cy;
      const nx = cx + 1 < CX, nz = cz + 1 < CZ, ny = cy + 1 < CY;
      if (!(heatAct[c] || (nx && heatAct[c + 1]) || (nz && heatAct[c + sZ]) || (ny && heatAct[c + sY]))) continue;
      const any = this.conductBox(cx * CHUNK, Math.min(W, cx * CHUNK + CHUNK), cy * CHUNK, Math.min(H, cy * CHUNK + CHUNK),
        cz * CHUNK, Math.min(D, cz * CHUNK + CHUNK));
      heatAct[c] = any;
      if (any) { if (nx) heatAct[c + 1] = 1; if (nz) heatAct[c + sZ] = 1; if (ny) heatAct[c + sY] = 1; }
    }
  }

  conductBox(x0, x1, y0, y1, z0, z1) {
    const { W, H, D, L, type, temp } = this;
    let any = 0;
    for (let y = y0; y < y1; y++) {
      const top = y < H - 1;
      for (let z = z0; z < z1; z++) {
        const back = z < D - 1;
        let i = x0 + W * (z + D * y);
        for (let x = x0; x < x1; x++, i++) {
          const a = type[i];
          let ti = temp[i];
          const base = a * COUNT;
          if (x < W - 1) {
            const j = i + 1, tj = temp[j];
            if (ti !== tj) {
              const b = type[j];
              const f = (ti - tj) * PAIR_K[base + b];
              ti -= f * INV_CAP[a]; temp[j] = tj + f * INV_CAP[b];
            }
          }
          if (back) {
            const j = i + W, tj = temp[j];
            if (ti !== tj) {
              const b = type[j];
              const f = (ti - tj) * PAIR_K[base + b];
              ti -= f * INV_CAP[a]; temp[j] = tj + f * INV_CAP[b];
            }
          }
          if (top) {
            const j = i + L, tj = temp[j];
            if (ti !== tj) {
              const b = type[j];
              const f = (ti - tj) * PAIR_K[base + b];
              ti -= f * INV_CAP[a]; temp[j] = tj + f * INV_CAP[b];
              // Convection: hot air rises and carries its heat upward.
              if (a === EMPTY && b === EMPTY && ti > tj + 1) {
                const m = (ti - temp[j]) * 0.3;
                ti -= m; temp[j] += m;
              }
            }
          }
          // Slow loss of heat to the surroundings.
          const dAmb = AMBIENT - ti;
          if (dAmb !== 0) {
            if (dAmb < 0.5 && dAmb > -0.5) ti = AMBIENT; // close enough to room temperature
            else ti += dAmb * (a === EMPTY ? 0.02 : 0.0001);
          }
          temp[i] = ti;
          if (ti !== AMBIENT) any = 1;
        }
      }
    }
    return any;
  }

  // ----- painting -----
  // mode: 'add' | 'erase' | 'heat' | 'cool'. The brush is a ball of radius r,
  // squashed to half-depth rz along z (the 2D view paints a thin disc through
  // its slice). pour scales how densely loose materials are poured.
  paint(cx, cy, cz, r, mode, t, rz = r, pour = 1) {
    const { W, H, D, type, temp } = this;
    const ri = Math.floor(r);
    const zr = Math.min(Math.floor(rz), D - 1);
    const s = STATE[t];
    let density = 1;
    if (mode === 'add') {
      if (s === POWDER) density = 0.12 * pour;
      else if (s === LIQUID) density = 0.18 * pour;
      else if (s === GAS) density = 0.12 * pour;
      if (t === SEED) density = 0.01 * pour;
    }
    const r2 = r * r + 0.5, rz2 = rz * rz + 0.5;
    for (let dy = -ri; dy <= ri; dy++) {
      const y = cy + dy; if (y < 0 || y >= H) continue;
      for (let dz = -zr; dz <= zr; dz++) {
        const z = cz + dz; if (z < 0 || z >= D) continue;
        for (let dx = -ri; dx <= ri; dx++) {
          const x = cx + dx; if (x < 0 || x >= W) continue;
          if ((dx * dx + dy * dy) / r2 + (dz * dz) / rz2 > 1) continue;
          const i = x + W * (z + D * y);
          const o = type[i];
          if (mode === 'add') {
            if ((o === EMPTY || (STATE[o] === GAS && o !== t)) && Math.random() < density) {
              this.set(i, t);
              if (t === PLANT) this.life[i] = 5;
            }
          } else if (mode === 'erase') {
            if (o !== EMPTY) this.set(i, EMPTY, AMBIENT);
          } else if (mode === 'heat') {
            temp[i] = Math.min(temp[i] + 50, 2500);
            this.heatAct[this.chunkOf[i]] = 1;
          } else if (mode === 'cool') {
            temp[i] = Math.max(temp[i] - 25, -200);
            this.heatAct[this.chunkOf[i]] = 1;
          }
        }
      }
    }
  }

  fill(x0, y0, z0, x1, y1, z1, t) {
    for (let y = Math.max(0, y0); y <= Math.min(this.H - 1, y1); y++)
      for (let z = Math.max(0, z0); z <= Math.min(this.D - 1, z1); z++)
        for (let x = Math.max(0, x0); x <= Math.min(this.W - 1, x1); x++)
          this.set(this.index(x, y, z), t);
  }
}

const DIAG_X = [1, -1, 0, 0, 1, 1, -1, -1];
const DIAG_Z = [0, 0, 1, -1, 1, -1, 1, -1];
const SIDE_X = [1, -1, 0, 0];
const SIDE_Z = [0, 0, 1, -1];
