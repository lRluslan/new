// The physics engine: one 2D grid of cells, seen from the side. y = 0 is the
// bottom row and y grows upward.
//
// Each step does three things:
//   1. Phase changes and chemistry (melting, burning, acid, growth...).
//   2. Movement: gravity with real acceleration, density sorting, liquids
//      levelling out, gases rising, and flying debris from explosions.
//   3. Heat: conduction between neighbours (weighted by heat capacity),
//      hot air rising (convection) and slow cooling to room temperature.

import {
  EMPTY, STONE, DIRT, SAND, GUNPOWDER, SEED, WATER, OIL, ACID, LAVA, SMOKE,
  FIRE, WOOD, PLANT, OBSIDIAN, ASH, ICE, SNOW, SALT, BRINE, MUD, COAL,
  METAL, RUST, MERCURY, FUSE, THERMITE, CLONER, DRAIN, GLASS, BODY, BLOOD, GOLD, CEMENT, CONCRETE, NAPALM, NITRO, C4,
  WAX, MOLTEN_WAX, FUNGUS, FIREWORK, SPARKLE, CLOUD, BATTERY, LAMP, DRIED_BLOOD, COUNT, SOLID, POWDER, LIQUID, GAS, AMBIENT, FIRE_TEMP, DISC,
  STATE, DENS, K, CAP, TEMP0, HOT_AT, HOT_TO, HOT_DISC, COLD_AT, COLD_TO, COLD_DISC, LATENT_HOT, LATENT_COLD,
  IGNITE, BURN_TIME, BURN_HEAT, ASH_CHANCE, BURN_TO, OWN_OXYGEN, FLOW, VISC, RISE, LIFE_MIN, LIFE_SPAN, SLIDE,
  HARD, GLOWS,
} from './elements.js';

const GRAVITY = 0.3;   // cells per step², so falling things speed up
const MAX_SPEED = 7;   // terminal velocity in cells per step
const BURNING = 4;     // flag bit: this cell is on fire
const GROWING = 8;     // flag bit: tip of a growing tree
const RESTING = 16;    // flag bit: a liquid that found nowhere to go; skipped until a neighbour changes
const SPARK = 32;      // flag bit: an electric pulse is in this wire cell right now
const ZAPPED = 64;     // flag bit: a pulse just passed; the wire rests a moment so the pulse runs one way
const REGION = 16;     // the world is simulated in 16×16 regions that can sleep
const LOOK_AHEAD = 24; // how far a liquid looks sideways for somewhere lower to flow

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

// Explosives: blast radius and push. Gunpowder is the small one.
const BLAST_R = new Float32Array(COUNT), BLAST_P = new Float32Array(COUNT);
BLAST_R[GUNPOWDER] = 7; BLAST_P[GUNPOWDER] = 5;
BLAST_R[NITRO] = 9; BLAST_P[NITRO] = 6;
BLAST_R[C4] = 13; BLAST_P[C4] = 7;
// Electricity runs through metal and gold, and its sparks set these off.
const CONDUCTS = new Uint8Array(COUNT);
CONDUCTS[METAL] = 1; CONDUCTS[GOLD] = 1;
const SPARK_LIGHTS = new Uint8Array(COUNT);
for (const t of [GUNPOWDER, NITRO, C4, FUSE, THERMITE, FIREWORK, OIL, NAPALM]) SPARK_LIGHTS[t] = 1;
// Solids that keep working while their life counter runs: growing plants
// and fungus, and a lamp while it is lit.
const LIVES = new Uint8Array(COUNT);
LIVES[PLANT] = 1; LIVES[FUNGUS] = 1; LIVES[LAMP] = 1;

// Cells that can rest: solids and powders. A resting cell at a steady
// temperature is skipped, which keeps the large buried ground cheap.
const BLOCKS = new Uint8Array(COUNT);
const BLOCKS_OR_LIQUID = new Uint8Array(COUNT);
const CAN_SLEEP = new Uint8Array(COUNT);
const WAKE_T = new Float32Array(COUNT);
for (let t = 1; t < COUNT; t++) {
  BLOCKS[t] = STATE[t] === SOLID || STATE[t] === POWDER ? 1 : 0;
  BLOCKS_OR_LIQUID[t] = BLOCKS[t] || STATE[t] === LIQUID ? 1 : 0;
  // Seeds, salt and the machines keep working, so they never sleep.
  CAN_SLEEP[t] = BLOCKS[t] && t !== SEED && t !== SALT && t !== CLONER && t !== DRAIN && t !== BATTERY && t !== BODY ? 1 : 0;
  WAKE_T[t] = Math.min(IGNITE[t] || Infinity, GLOWS[t] ? Infinity : 525);
}

export class World {
  constructor(W, H) {
    this.clock = 0;
    this.found = new Uint8Array(64);
    this.events = [];
    this.blasts = [];   // explosions this step, for the creatures to feel: x, y
    this.hits = [];     // falling grains that landed on a creature: cell, speed × density
    this.fx = [];       // things worth a visual effect: { k: 'blast' | 'burst' | 'splash' | 'bolt', x, y, ... }
    this.steps = 0;
    this.wind = 1;      // which way clouds drift: 1 right, -1 left
    this.quiet = 0;     // steps to ignore discoveries for, while a new scene settles
    this.resize(W, H);
  }

  // Make a new, empty grid of W × H cells.
  resize(W, H) {
    this.W = W; this.H = H;
    const N = this.N = W * H;
    this.type = new Uint8Array(N);
    this.temp = new Float32Array(N).fill(AMBIENT);
    this.life = new Int16Array(N);
    this.latent = new Float32Array(N); // heat soaked up toward a phase change
    this.shade = new Uint8Array(N);
    this.flags = new Uint8Array(N);
    this.vx = new Float32Array(N);
    this.vy = new Float32Array(N);
    this.stamp = new Uint8Array(N);
    this.setupRegions();
    // Cells whose options change when a cell changes: itself, its four sides,
    // and the two diagonals above it (which could slide down into it).
    this.near = [0, 1, -1, W, -W, W - 1, W + 1];
    this.blasts.length = 0; this.hits.length = 0;
  }

  // ----- regions, so only the parts of the world where something happens are simulated -----
  setupRegions() {
    const { W, H, N } = this;
    this.CX = Math.ceil(W / REGION); this.CY = Math.ceil(H / REGION);
    this.regionCount = this.CX * this.CY;
    this.heatAct = new Uint8Array(this.regionCount).fill(1); // regions holding heat away from 20 °C
    this.awake = new Uint8Array(this.regionCount).fill(1);   // regions where something may move
    this.restRegion = new Uint8Array(this.regionCount);       // regions holding resting liquid
    this.awakeNext = new Uint8Array(this.regionCount).fill(1);
    this.regionOf = new Uint16Array(N);
    this.edge = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = x + W * y;
      this.regionOf[i] = (x >> 4) + this.CX * (y >> 4);
      const lx = x & 15, ly = y & 15;
      let e = 0;
      if (lx === 0 && x > 0) e |= 1;
      if (lx === 15 && x < W - 1) e |= 2;
      if (ly === 0 && y > 0) e |= 4;
      if (ly === 15 && y < H - 1) e |= 8;
      this.edge[i] = e;
    }
  }

  // A cell changed: its region must be simulated next step, and resting
  // liquids next to it (or diagonally above) get another look.
  touch(i) {
    const fl = this.flags, near = this.near;
    for (let k = 0; k < near.length; k++) fl[i + near[k]] &= ~RESTING; // out-of-range writes are ignored
    this.wakeAt(i);
  }

  wakeAt(i) {
    const c = this.regionOf[i], a = this.awakeNext;
    a[c] = 1;
    const e = this.edge[i];
    if (e) {
      if (e & 1) a[c - 1] = 1;
      if (e & 2) a[c + 1] = 1;
      if (e & 4) a[c - this.CX] = 1;
      if (e & 8) a[c + this.CX] = 1;
    }
  }

  index(x, y) { return x + this.W * y; }

  // Ask the renderer for a visual effect (it collects them each frame).
  addFx(e) { if (this.fx.length < 200) this.fx.push(e); }

  discover(id) {
    if (id >= 0 && !this.found[id] && this.quiet === 0) { this.found[id] = 1; this.events.push(id); }
  }

  // ----- cell edits -----
  set(i, t, T) {
    this.type[i] = t;
    this.shade[i] = (Math.random() * 256) | 0;
    this.flags[i] = (Math.random() * 2) | 0; // random flow direction for liquids
    this.vx[i] = 0; this.vy[i] = 0;
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
    this.vx[i] = 0; this.vy[i] = 0;
    this.life[i] = LIFE_MIN[t] + ((Math.random() * LIFE_SPAN[t]) | 0);
    this.latent[i] = 0;
    this.touch(i);
  }

  swap(a, b) {
    const ty = this.type, te = this.temp, li = this.life, sh = this.shade, fl = this.flags;
    const vx = this.vx, vy = this.vy, la = this.latent;
    let u = ty[a]; ty[a] = ty[b]; ty[b] = u;
    let f = te[a]; te[a] = te[b]; te[b] = f;
    u = li[a]; li[a] = li[b]; li[b] = u;
    u = sh[a]; sh[a] = sh[b]; sh[b] = u;
    u = fl[a]; fl[a] = fl[b]; fl[b] = u;
    f = vx[a]; vx[a] = vx[b]; vx[b] = f;
    f = vy[a]; vy[a] = vy[b]; vy[b] = f;
    f = la[a]; la[a] = la[b]; la[b] = f;
    this.stamp[a] = this.clock; this.stamp[b] = this.clock;
    this.touch(a); this.touch(b);
  }

  clear() {
    this.type.fill(0); this.temp.fill(AMBIENT); this.life.fill(0); this.flags.fill(0); this.latent.fill(0);
    this.vx.fill(0); this.vy.fill(0);
    this.heatAct.fill(1);
    this.awake.fill(1);
    this.restRegion.fill(0);
    this.awakeNext.fill(1);
    this.blasts.length = 0; this.hits.length = 0; this.fx.length = 0;
    this.quiet = 90;
  }

  // ----- neighbours -----
  hasNeighbor(i, x, y, t) {
    const ty = this.type, W = this.W;
    if (x > 0 && ty[i - 1] === t) return true;
    if (x < W - 1 && ty[i + 1] === t) return true;
    if (y > 0 && ty[i - W] === t) return true;
    if (y < this.H - 1 && ty[i + W] === t) return true;
    return false;
  }

  // Is there oxygen next to this cell? Flames and smoke mix with air.
  hasAir(i, x, y) {
    const ty = this.type, W = this.W;
    if (x > 0 && AIRY[ty[i - 1]]) return true;
    if (x < W - 1 && AIRY[ty[i + 1]]) return true;
    if (y > 0 && AIRY[ty[i - W]]) return true;
    if (y < this.H - 1 && AIRY[ty[i + W]]) return true;
    return false;
  }

  randomNeighbor(i, x, y) {
    switch ((Math.random() * 4) | 0) {
      case 0: return x > 0 ? i - 1 : -1;
      case 1: return x < this.W - 1 ? i + 1 : -1;
      case 2: return y > 0 ? i - this.W : -1;
      default: return y < this.H - 1 ? i + this.W : -1;
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
    const { W, H, type, stamp, temp, flags, vx, vy, life, heatAct, restRegion, CX, CY } = this;
    const clock = this.clock, phase = this.steps & 15;
    const flipX = clock & 1;
    for (let cy = 0; cy < CY; cy++) {
      const y0 = cy * REGION, y1 = Math.min(H, y0 + REGION);
      for (let cxx = 0; cxx < CX; cxx++) {
        const cx = flipX ? CX - 1 - cxx : cxx;
        const c = cx + CX * cy;
        // Every 16 steps each region re-checks its resting liquid once, in
        // case somewhere lower opened up further away than its neighbours.
        const recheck = restRegion[c] === 1 && (c & 15) === phase;
        if (recheck) restRegion[c] = 0;
        else if (!awake[c] && !heatAct[c]) continue;
        const x0 = cx * REGION, x1 = Math.min(W, x0 + REGION);
        for (let y = y0; y < y1; y++) {
          const row = W * y;
          for (let xx = x0; xx < x1; xx++) {
            const x = flipX ? x1 - 1 - (xx - x0) : xx;
            const i = row + x;
            const t = type[i];
            if (t === EMPTY || stamp[i] === clock) continue;
            const T = temp[i];
            if (T !== AMBIENT) heatAct[c] = 1;
            // Fast path: a resting solid or powder with nothing to react to.
            if (CAN_SLEEP[t] && T <= HOT_AT[t] && T >= COLD_AT[t] && T < WAKE_T[t] && (flags[i] & (BURNING | GROWING | SPARK | ZAPPED)) === 0) {
              if (STATE[t] === SOLID) { if (!LIVES[t] || life[i] <= 0) continue; }
              else if (vx[i] === 0 && vy[i] === 0 && this.settled(i, x, y)) continue;
            } else if ((flags[i] & RESTING) && T <= HOT_AT[t] && T >= COLD_AT[t] && T < WAKE_T[t]) {
              // Resting liquid: nothing around it has changed since it last tried to move.
              // On a re-check, liquid boxed in on every side still cannot move.
              if (!recheck) continue;
              if (this.enclosed(i, t, x, y)) { restRegion[c] = 1; continue; }
            }
            next[c] = 1;
            this.update(i, t, x, y);
          }
        }
      }
    }
    this.conduct();
  }

  // A liquid with full sides that cannot fall or slide has nowhere to go.
  enclosed(i, t, x, y) {
    const { W, type } = this;
    if (x > 0 && !BLOCKS_OR_LIQUID[type[i - 1]]) return false;
    if (x < W - 1 && !BLOCKS_OR_LIQUID[type[i + 1]]) return false;
    return this.supported(i, t, x, y);
  }

  // True when a liquid surely cannot fall or slide: the cell below and both
  // diagonals below are solid, or liquid at least as dense.
  supported(i, t, x, y) {
    if (y === 0) return true;
    const { W, type } = this;
    const b = i - W;
    if (!this.holds(t, type[b])) return false;
    if (x > 0 && !this.holds(t, type[b - 1])) return false;
    if (x < W - 1 && !this.holds(t, type[b + 1])) return false;
    return true;
  }

  holds(t, o) { return BLOCKS[o] === 1 || (STATE[o] === LIQUID && DENS[o] >= DENS[t]); }

  // A powder is settled when the cell below and both diagonals below are full.
  settled(i, x, y) {
    if (y === 0) return true;
    const { W, type } = this;
    const b = i - W;
    if (!BLOCKS[type[b]]) return false;
    if (x > 0 && !BLOCKS[type[b - 1]]) return false;
    if (x < W - 1 && !BLOCKS[type[b + 1]]) return false;
    return true;
  }

  update(i, t, x, y) {
    const T = this.temp[i];

    // Phase changes driven by temperature.
    if (T > HOT_AT[t]) {
      const lat = LATENT_HOT[t];
      if (lat) {
        // Extra heat goes into melting/boiling instead of raising the temperature.
        const p = this.latent[i] + (T - HOT_AT[t]);
        this.temp[i] = HOT_AT[t];
        // Once melted (or boiled), heat beyond what the change needed stays in it.
        if (p >= lat) { this.morph(i, HOT_TO[t]); this.temp[i] = HOT_AT[t] + Math.min(p - lat, 400); this.discover(HOT_DISC[t]); return; }
        this.latent[i] = p;
      } else if (Math.random() < 0.25) {
        this.morph(i, HOT_TO[t]);
        this.discover(HOT_DISC[t]);
        return;
      }
    } else if (T < COLD_AT[t]) {
      if (this.cool(i, t, x, y)) return;
    }

    // Combustion.
    if (this.flags[i] & BURNING) {
      if (t === FIREWORK) { this.rocket(i, x, y); return; }
      if (this.burn(i, t, x, y)) return;
    } else if (IGNITE[t] && T >= IGNITE[t]) {
      // Explosives carry their own oxidiser. Everything else needs air to catch fire.
      if (BLAST_R[t]) { this.explode(x, y, BLAST_R[t], BLAST_P[t], t); return; }
      if (t === FIREWORK) {
        this.flags[i] |= BURNING;
        this.life[i] = 22 + ((Math.random() * 16) | 0);
        this.discover(DISC.FIREWORK);
        return;
      }
      if (!OWN_OXYGEN[t] && !this.hasAir(i, x, y)) {
        // Wood that is hot but cannot reach air chars into coal.
        if (t === WOOD) { this.morph(i, COAL); this.discover(DISC.CHARCOAL); return; }
        return this.moveOnly(i, t, x, y);
      }
      this.flags[i] |= BURNING;
      this.life[i] = BURN_TIME[t] * (0.6 + Math.random() * 0.8);
      this.discover(t === OIL ? DISC.OIL_FIRE : t === WOOD || t === COAL ? DISC.BURN_WOOD
        : t === FUSE ? DISC.FUSE : t === THERMITE ? DISC.THERMITE : t === NAPALM ? DISC.NAPALM
        : t === WAX || t === MOLTEN_WAX ? DISC.CANDLE : DISC.WILDFIRE);
    }

    const s = STATE[t];
    if (T > 525 && !GLOWS[t] && (s === SOLID || s === POWDER)) this.discover(DISC.GLOW);

    switch (s) {
      case POWDER: {
        if (t === SALT && this.salt(i, x, y)) return;
        const j = this.movePowder(i, t, x, y);
        if (t === SEED && j === i) this.sprout(i, x, y);
        break;
      }
      case LIQUID:
        if (t === ACID && this.corrode(i, x, y)) return;
        // Cement sets into concrete after a while, wherever it is.
        if (t === CEMENT && --this.life[i] <= 0) { this.morph(i, CONCRETE); this.discover(DISC.CONCRETE); return; }
        // Blood dries into a crust after half a minute or so; water keeps it wet.
        if (t === BLOOD && --this.life[i] <= 0) {
          if (this.hasNeighbor(i, x, y, WATER)) { this.morph(i, WATER); return; }
          this.morph(i, DRIED_BLOOD); return;
        }
        this.moveLiquid(i, t, x, y);
        break;
      case GAS:
        if (t === SPARKLE) this.sparkle(i, x, y);
        else if (t === CLOUD) this.cloud(i, x, y);
        else this.updateGas(i, t, x, y);
        break;
      case SOLID:
        if (this.flags[i] & (SPARK | ZAPPED)) this.zap(i, x, y);
        if (t === CLONER) this.cloner(i, x, y);
        else if (t === BATTERY) this.battery(i, x, y);
        else if (t === LAMP) this.lamp(i, x, y);
        else if (t === FUNGUS) this.fungus(i, x, y);
        else if (t === DRAIN) this.drain(i, x, y);
        else if (t === PLANT) this.growPlant(i, x, y);
        else if (t === WOOD && (this.flags[i] & GROWING)) this.growTree(i, x, y);
        break;
    }
  }

  moveOnly(i, t, x, y) {
    const s = STATE[t];
    if (s === POWDER) this.movePowder(i, t, x, y);
    else if (s === LIQUID) this.moveLiquid(i, t, x, y);
  }

  cool(i, t, x, y) {
    if (t === LAVA) {
      // Water quenches lava straight into volcanic glass.
      if (this.hasNeighbor(i, x, y, WATER)) {
        this.morph(i, OBSIDIAN);
        this.discover(DISC.OBSIDIAN);
        return true;
      }
      // Otherwise lava only sets on top of something solid, so a pool turns
      // to stone from the bottom up, one layer at a time. Until then it stays
      // molten even where its surface has cooled.
      if (y > 0 && !BLOCKS[this.type[i - this.W]]) return false;
      const p = this.latent[i] - (COLD_AT[t] - this.temp[i]);
      this.temp[i] = COLD_AT[t];
      if (p <= -LATENT_COLD[t]) { this.morph(i, STONE); this.discover(DISC.CRUST); return true; }
      this.latent[i] = p;
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

  burn(i, t, x, y) {
    // Fire needs air. Buried fuel stops making heat and soon goes out
    // (thermite brings its own oxygen, so it keeps going).
    if (!OWN_OXYGEN[t] && !this.hasAir(i, x, y)) {
      if (Math.random() < 0.1) { this.flags[i] &= ~BURNING; this.temp[i] = Math.min(this.temp[i], IGNITE[t] - 20); }
      return false;
    }
    const life = --this.life[i];
    if (this.temp[i] < BURN_HEAT[t]) this.temp[i] = BURN_HEAT[t];

    // Water smothers burning solids. Oil floats on water, so oil fires keep going.
    if (t !== OIL && t !== NAPALM && !OWN_OXYGEN[t] && this.hasNeighbor(i, x, y, WATER) && Math.random() < 0.4) {
      this.flags[i] &= ~BURNING;
      this.temp[i] = 90;
      this.discover(DISC.EXTINGUISH);
      return false;
    }

    // Flames lick upward into the air.
    const up = y < this.H - 1 ? i + this.W : -1;
    if (up >= 0 && this.type[up] === EMPTY && Math.random() < 0.25) {
      this.set(up, FIRE);
    } else {
      const n = this.randomNeighbor(i, x, y);
      if (n >= 0 && this.type[n] === EMPTY && Math.random() < 0.15) this.set(n, FIRE);
    }

    if (life <= 0) {
      if (BURN_TO[t]) this.morph(i, BURN_TO[t]);            // thermite leaves molten iron
      else if (Math.random() < ASH_CHANCE[t]) this.morph(i, ASH);
      else this.set(i, FIRE, FIRE_TEMP);
      return true;
    }
    return false;
  }

  // An explosion of radius r at (x, y). `kind` is what blew up.
  explode(x, y, r = 7, power = 5, kind = GUNPOWDER) {
    const { W, H, type, temp } = this;
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      const ny = y + dy; if (ny < 0 || ny >= H) continue;
      for (let dx = -ri; dx <= ri; dx++) {
        const nx = x + dx; if (nx < 0 || nx >= W) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const j = nx + W * ny;
        const t = type[j];
        const f = 1 - d / r;
        const hot = AMBIENT + 700 * f;
        if (temp[j] < hot) temp[j] = hot;
        this.heatAct[this.regionOf[j]] = 1;
        if (t === EMPTY) { if (d < r * 0.6 && Math.random() < 0.7) this.set(j, FIRE, 1400); continue; }
        const s = STATE[t];
        // Other explosives nearby go off too.
        if (BLAST_R[t]) { temp[j] = Math.max(temp[j], IGNITE[t] + 60); continue; }
        if (d < r * 0.5 && HARD[t] > 0.3 && t !== WATER) { this.set(j, FIRE, 1400); continue; }
        if ((s === POWDER || s === LIQUID) && d > 0) {
          const k = power * f / d;
          this.vx[j] += dx * k;
          this.vy[j] += dy * k + power * f * 0.6;
        }
      }
    }
    this.set(x + W * y, FIRE, 1500);
    this.blasts.push(x, y, r);
    this.addFx({ k: 'blast', x, y, r });
    this.discover(kind === NITRO ? DISC.NITRO : kind === C4 ? DISC.C4 : DISC.EXPLODE);
  }

  // ----- movement -----
  movePowder(i, t, x, y) {
    if (this.vx[i] !== 0 || this.vy[i] > 0) return this.fly(i, t, x, y);
    const j = this.fall(i, t, y);
    if (j >= 0) return j;
    if (y > 0 && Math.random() < SLIDE[t]) {
      const k = this.slideDown(i, t, x);
      if (k >= 0) return k;
    }
    return i;
  }

  moveLiquid(i, t, x, y) {
    if (this.vx[i] !== 0 || this.vy[i] > 0) return this.fly(i, t, x, y);
    if (VISC[t] < 1 && Math.random() > VISC[t]) return i;
    const j = this.fall(i, t, y);
    if (j >= 0) return j;
    if (y > 0) {
      const k = this.slideDown(i, t, x);
      if (k >= 0) return k;
    }
    // Water touching metal slowly rusts it; salt water is much faster.
    if ((t === WATER || t === BRINE) && this.hasNeighbor(i, x, y, METAL)) {
      if (Math.random() < (t === BRINE ? 0.02 : 0.004)) {
        const n = this.randomNeighbor(i, x, y);
        if (n >= 0 && this.type[n] === METAL) { this.morph(n, RUST); this.discover(DISC.RUST); }
      }
      return this.spread(i, t, x, y); // stays awake while it has metal to work on
    }
    const s = this.spread(i, t, x, y);
    // Standing water slowly soaks into bare soil underneath, turning it to mud.
    if (s === i && t === WATER && y > 0 && this.type[i - this.W] === DIRT && Math.random() < 0.1) {
      this.morph(i - this.W, MUD);
      this.set(i, EMPTY, this.temp[i]);
      this.discover(DISC.MUD);
      return i;
    }
    if (s === i && t !== ACID && t !== CEMENT && t !== BLOOD && this.supported(i, t, x, y)) {
      this.flags[i] |= RESTING;
      this.restRegion[this.regionOf[i]] = 1;
    }
    return s;
  }

  // Free fall with acceleration. Returns the new index, or -1 if blocked.
  fall(i, t, y) {
    const W = this.W, ty = this.type;
    if (y === 0) { this.vy[i] = 0; return -1; }
    const below = ty[i - W];
    if (!this.canEnter(t, below)) {
      if (below === BODY && STATE[t] === POWDER && this.vy[i] < -2) this.hits.push(i - W, -this.vy[i] * DENS[t]);
      if (below === MERCURY && t !== MERCURY && this.vy[i] < -0.5) this.discover(DISC.MERCURY_FLOAT);
      if (t === OIL && (below === WATER || below === BRINE)) this.discover(DISC.FLOAT); // oil poured on water floats
      this.vy[i] = 0;
      return -1;
    }
    if (STATE[below] === LIQUID) {
      // A fast drop into a liquid splashes.
      if (this.vy[i] < -2.5 && Math.random() < 0.25) this.addFx({ k: 'splash', x: i % W, y, t: below });
      if (STATE[t] === POWDER) this.discover(DISC.SINK);
      else if (below === OIL && t === WATER) this.discover(DISC.FLOAT);
      else if (below === WATER && t === BRINE) this.discover(DISC.BRINE_SINKS);
    }
    let v = this.vy[i] - GRAVITY;
    if (v < -MAX_SPEED) v = -MAX_SPEED;
    let n = Math.max(1, Math.round(-v));
    let cur = i, cy = y;
    // Drop straight through open air in one move.
    let k = 0;
    while (k < n && cy - k > 0 && ty[cur - (k + 1) * W] === EMPTY) k++;
    if (k > 0) { this.swap(cur, cur - k * W); cur -= k * W; cy -= k; n -= k; }
    while (n > 0 && cy > 0 && this.canEnter(t, ty[cur - W])) {
      this.swap(cur, cur - W);
      cur -= W; cy--; n--;
    }
    // Landing on mercury: it is heavy enough to float sand and iron.
    if (n > 0 && cy > 0 && ty[cur - W] === MERCURY && t !== MERCURY) this.discover(DISC.MERCURY_FLOAT);
    // A falling grain that lands on a creature hits it.
    if (n > 0 && cy > 0 && ty[cur - W] === BODY && STATE[t] === POWDER && v < -2) this.hits.push(cur - W, -v * DENS[t]);
    // Water landing on bare soil soaks in and turns it to mud.
    if (n > 0 && cy > 0 && t === WATER && ty[cur - W] === DIRT && Math.random() < 0.6) {
      this.morph(cur - W, MUD);
      this.set(cur, EMPTY);
      this.discover(DISC.MUD);
      return cur;
    }
    // Nitroglycerin goes off if it lands hard.
    if (t === NITRO && (n > 0 || cy === 0) && v < -3) { this.explode(cur % W, cy, BLAST_R[NITRO], BLAST_P[NITRO], NITRO); return cur; }
    // Hitting something stops the fall; liquids splash sideways a little.
    if (n > 0 || cy === 0) {
      if (STATE[t] === LIQUID && v < -3 && Math.random() < 0.3) {
        const sp = -v * 0.35;
        this.vx[cur] = Math.random() < 0.5 ? sp : -sp;
      }
      v = 0;
    }
    this.vy[cur] = v;
    return cur;
  }

  slideDown(i, t, x) {
    const { W, type } = this;
    const below = i - W;
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

  // Liquids flow sideways only when there is a reason to: a drop within reach
  // (so the surface levels out), or the weight of liquid above pushing it
  // out. A level pool or a thin film therefore stays perfectly still instead
  // of sloshing back and forth.
  spread(i, t, x, y) {
    const { W, H, type } = this;
    const fl = this.flags;
    let dir = fl[i] & 1;
    const steps = FLOW[t];
    const pressed = y < H - 1 && STATE[type[i + W]] === LIQUID;
    for (let attempt = 0; attempt < 2; attempt++) {
      const dx = dir ? -1 : 1;
      let j = i, cx = x, open = 0, drop = 0;
      for (let s = 1; s <= LOOK_AHEAD; s++) {
        cx += dx;
        if (cx < 0 || cx >= W) break;
        j += dx;
        const o = type[j];
        if (o !== EMPTY && STATE[o] !== GAS) break;
        open = s;
        if (y > 0) { const b = type[j - W]; if (b === EMPTY || STATE[b] === GAS) { drop = s; break; } }
      }
      // Head toward the drop, at most `steps` cells per step.
      const go = drop ? Math.min(drop, steps) : (pressed && open ? 1 : 0);
      if (go) {
        const target = i + dx * go;
        // Water flowing over bare soil soaks into it.
        if (t === WATER && y > 0 && type[target - W] === DIRT && Math.random() < 0.15) {
          this.morph(target - W, MUD);
          this.set(i, EMPTY, this.temp[i]);
          this.discover(DISC.MUD);
          return i;
        }
        this.swap(i, target);
        fl[target] = (fl[target] & ~3) | dir;
        return target;
      }
      dir ^= 1;
    }
    fl[i] = (fl[i] & ~3) | dir;
    return i;
  }

  // Ballistic flight for things thrown by explosions and splashes.
  fly(i, t, x, y) {
    const { W, H, type } = this;
    let vx = this.vx[i], vy = this.vy[i] - GRAVITY;
    if (vy < -MAX_SPEED) vy = -MAX_SPEED;
    if (vy > MAX_SPEED) vy = MAX_SPEED;
    if (vx > MAX_SPEED) vx = MAX_SPEED; else if (vx < -MAX_SPEED) vx = -MAX_SPEED;
    const steps = Math.ceil(Math.max(Math.abs(vx), Math.abs(vy)));
    let cur = i, cx = x, cy = y, hit = false;
    for (let s = 1; s <= steps; s++) {
      const nx = x + Math.round(vx * s / steps);
      const ny = y + Math.round(vy * s / steps);
      if (nx === cx && ny === cy) continue;
      if (nx < 0 || nx >= W) { vx = -vx * 0.3; hit = true; break; }
      if (ny < 0 || ny >= H) { vy = 0; hit = true; break; }
      const j = nx + W * ny;
      if (this.canEnter(t, type[j])) {
        this.swap(cur, j);
        cur = j; cx = nx; cy = ny;
      } else {
        hit = true;
        if (ny < cy) vy = 0; else if (ny > cy) vy *= -0.2;
        break;
      }
    }
    if (hit && t === NITRO && Math.abs(vx) + Math.abs(vy) > 3) { this.explode(cx, cy, BLAST_R[NITRO], BLAST_P[NITRO], NITRO); return cur; }
    vx *= hit ? 0.5 : 0.97;
    if (Math.abs(vx) < 0.35) vx = 0;
    this.vx[cur] = vx; this.vy[cur] = vy;
    return cur;
  }

  updateGas(i, t, x, y) {
    const life = --this.life[i];
    const { W, type } = this;
    if (t === FIRE) {
      if (this.temp[i] < FIRE_TEMP) this.temp[i] = FIRE_TEMP;
      if (this.hasNeighbor(i, x, y, WATER) && Math.random() < 0.5) {
        // The flame dies and its heat goes into the water.
        this.set(i, EMPTY, 100);
        const n = this.randomNeighbor(i, x, y);
        if (n >= 0 && type[n] === WATER) this.temp[n] += 8;
        this.discover(DISC.EXTINGUISH);
        return;
      }
      if (life <= 0) { this.set(i, Math.random() < 0.3 ? SMOKE : EMPTY, this.temp[i] * 0.4); return; }
      // Flames heat whatever they touch (radiant heat), which is how fire spreads.
      const n = this.randomNeighbor(i, x, y);
      if (n >= 0) {
        const o = type[n];
        if (o !== EMPTY && o !== FIRE && o !== WATER) this.temp[n] += (FIRE_TEMP - this.temp[n]) * 0.25;
      }
      if (y > 0) {
        const b = i - W, o = type[b];
        if (o !== EMPTY && o !== FIRE && o !== WATER) this.temp[b] += (FIRE_TEMP - this.temp[b]) * 0.25;
      }
    } else if (t === SMOKE) {
      if (life <= 0 || (y === this.H - 1 && Math.random() < 0.05)) { this.set(i, EMPTY, this.temp[i]); return; }
    }

    if (y < this.H - 1 && Math.random() < RISE[t]) {
      const up = i + W;
      const o = type[up];
      if (o === EMPTY || (STATE[o] === GAS && DENS[o] > DENS[t]) || (STATE[o] === LIQUID && Math.random() < 0.3)) {
        this.swap(i, up);
        return;
      }
      // Blocked: slip diagonally upward around the obstacle.
      const dx = Math.random() < 0.5 ? -1 : 1, nx = x + dx;
      if (nx >= 0 && nx < W && type[up + dx] === EMPTY) { this.swap(i, up + dx); return; }
    }
    if (Math.random() < 0.5) {
      const dx = Math.random() < 0.5 ? -1 : 1, nx = x + dx;
      if (nx >= 0 && nx < W && type[i + dx] === EMPTY) this.swap(i, i + dx);
    }
  }

  // ----- chemistry and life -----
  corrode(i, x, y) {
    if (Math.random() > 0.3) return false;
    const n = this.randomNeighbor(i, x, y);
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

  // Salt dissolves into water, and melts ice and snow it touches.
  salt(i, x, y) {
    if (Math.random() > 0.2) return false;
    const n = this.randomNeighbor(i, x, y);
    if (n < 0) return false;
    const o = this.type[n];
    if (o === WATER) {
      this.set(n, BRINE, this.temp[n]);
      this.set(i, EMPTY, this.temp[i]);
      this.discover(DISC.DISSOLVE);
      return true;
    }
    if ((o === ICE || o === SNOW) && Math.random() < 0.3) {
      this.morph(n, WATER);
      this.temp[n] = Math.max(this.temp[n], 0);
      this.discover(DISC.DEICE);
    }
    return false;
  }

  // Cloner: remembers the first thing that touches it, then keeps making it.
  cloner(i, x, y) {
    const kept = this.life[i];
    if (!kept) {
      // Not set yet: look at every side for something to copy.
      const { W, H, type } = this;
      const near = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const n of near) {
        const o = n >= 0 ? type[n] : EMPTY;
        if (o !== EMPTY && o !== CLONER && o !== DRAIN && o !== BODY) { this.life[i] = o; return; }
      }
      return;
    }
    const n = this.randomNeighbor(i, x, y);
    if (n >= 0 && this.type[n] === EMPTY && Math.random() < 0.3) this.set(n, kept);
  }

  // Drain: swallows whatever touches it.
  drain(i, x, y) {
    const n = this.randomNeighbor(i, x, y);
    if (n < 0) return;
    const o = this.type[n];
    if (o !== EMPTY && o !== CLONER && o !== DRAIN && o !== BODY) this.set(n, EMPTY, AMBIENT);
  }

  // A lightning bolt from the sky down to the first thing it meets in column x.
  // It leaves a short-lived trail of fire and a blast of heat where it lands.
  strike(x) {
    const { W, H, type } = this;
    if (x < 0 || x >= W) return null;
    let y = H - 1;
    while (y > 0 && (type[x + W * y] === EMPTY || STATE[type[x + W * y]] === GAS)) y--;
    const hitY = y;
    // The jagged trail.
    let bx = x;
    for (let yy = H - 1; yy > hitY; yy--) {
      if (Math.random() < 0.3) bx = Math.max(0, Math.min(W - 1, bx + (Math.random() < 0.5 ? -1 : 1)));
      const j = bx + W * yy;
      if (type[j] === EMPTY) { this.set(j, FIRE, 1500); this.life[j] = 4 + ((Math.random() * 4) | 0); }
    }
    // The strike: very hot for a moment around the impact point.
    for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = hitY + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = nx + W * ny;
      const heat = 1800 - 300 * (Math.abs(dx) + Math.abs(dy));
      if (this.temp[j] < heat) this.temp[j] = heat;
      this.heatAct[this.regionOf[j]] = 1;
      this.awakeNext[this.regionOf[j]] = 1;
      if (type[j] === SAND && Math.random() < 0.6) this.morph(j, GLASS); // fulgurite
    }
    this.addFx({ k: 'bolt', x, y: hitY });
    this.discover(DISC.LIGHTNING);
    return [x, hitY];
  }

  // ----- electricity -----
  // A pulse sits in a wire cell for one step, then moves on to the next
  // cells of wire. The cell it leaves rests for a few steps, so the pulse
  // runs away from the battery instead of bouncing back.
  zap(i, x, y) {
    const { W, H, type, flags, life } = this;
    if (flags[i] & SPARK) {
      const near = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const n of near) {
        if (n < 0) continue;
        const o = type[n];
        if (CONDUCTS[o]) {
          if (!(flags[n] & (SPARK | ZAPPED))) { flags[n] |= SPARK; this.stamp[n] = this.clock; this.wakeAt(n); this.discover(DISC.ELECTRIC); }
        } else if (o === LAMP) {
          if (life[n] <= 0) this.wakeAt(n);
          life[n] = 16;
          this.discover(DISC.LAMP);
        } else if (SPARK_LIGHTS[o] && this.temp[n] < IGNITE[o] + 40) {
          this.temp[n] = IGNITE[o] + 40;
          this.heatAct[this.regionOf[n]] = 1;
          this.wakeAt(n);
        }
      }
      flags[i] = (flags[i] & ~SPARK) | ZAPPED;
      life[i] = 3;
    } else if (--life[i] <= 0) {
      flags[i] &= ~ZAPPED;
      life[i] = 0;
    }
  }

  // A battery sends a pulse into the wires touching it every 15 steps.
  battery(i, x, y) {
    if (--this.life[i] > 0) return;
    this.life[i] = 15;
    const { W, H, type, flags } = this;
    for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (n >= 0 && CONDUCTS[type[n]] && !(flags[n] & (SPARK | ZAPPED))) { flags[n] |= SPARK; this.stamp[n] = this.clock; this.wakeAt(n); }
    }
  }

  // A lit lamp passes its light to the rest of the lamp, a little dimmer.
  lamp(i, x, y) {
    const { W, H, type, life } = this;
    const l = life[i];
    if (l <= 0) return;
    life[i] = l - 1;
    if (l < 3) return;
    for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (n >= 0 && type[n] === LAMP && life[n] < l - 1) { if (life[n] <= 0) this.wakeAt(n); life[n] = l - 1; }
    }
  }

  // ----- fireworks -----
  // A lit firework is a rocket: it climbs on its own thrust, trailing
  // sparks, and bursts when its fuse runs out or it hits something.
  rocket(i, x, y) {
    const left = --this.life[i];
    this.vy[i] = Math.max(this.vy[i], 3.2);
    if (Math.random() < 0.3) this.vx[i] += (Math.random() - 0.5) * 0.8;
    const j = this.fly(i, FIREWORK, x, y);
    const stuck = j === i;
    // Trail of fire behind it.
    if (!stuck && i !== j && this.type[i] === EMPTY) { this.set(i, FIRE, 900); this.life[i] = 3 + ((Math.random() * 4) | 0); }
    if (left <= 0 || stuck) this.burst(j);
  }

  burst(i) {
    const { W, H, type } = this;
    const x = i % W, y = (i / W) | 0;
    const colors = [(Math.random() * 6) | 0, (Math.random() * 6) | 0];
    this.set(i, FIRE, 1200);
    for (let k = 0; k < 90; k++) {
      const a = Math.random() * Math.PI * 2, sp = 0.7 + Math.random() * 1.3;
      const d = 1 + Math.random() * 4;
      const nx = x + Math.round(Math.cos(a) * d), ny = y + Math.round(Math.sin(a) * d);
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const j = nx + W * ny;
      if (type[j] !== EMPTY) continue;
      this.set(j, SPARKLE);
      this.vx[j] = Math.cos(a) * sp; this.vy[j] = Math.sin(a) * sp;
      this.shade[j] = colors[k & 1];
      this.stamp[j] = this.clock;
    }
    this.addFx({ k: 'burst', x, y, c: colors[0] });
  }

  // Firework stars: drift outward, sag under gravity and burn out.
  sparkle(i, x, y) {
    if (--this.life[i] <= 0) { this.set(i, EMPTY, this.temp[i]); return; }
    let vx = this.vx[i] * 0.97, vy = this.vy[i] * 0.97 - 0.035;
    this.vx[i] = vx; this.vy[i] = vy;
    const dx = Math.abs(vx) >= 1 ? Math.round(vx) : Math.random() < Math.abs(vx) ? Math.sign(vx) : 0;
    const dy = Math.abs(vy) >= 1 ? Math.round(vy) : Math.random() < Math.abs(vy) ? Math.sign(vy) : 0;
    if (!dx && !dy) return;
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || nx >= this.W || ny < 0 || ny >= this.H) { this.set(i, EMPTY, this.temp[i]); return; }
    const j = nx + this.W * ny, o = this.type[j];
    if (o === EMPTY) this.swap(i, j);
    else if (STATE[o] !== GAS) {
      // Landing on something: a hot little spark that can start a fire.
      this.temp[j] += 120;
      this.heatAct[this.regionOf[j]] = 1;
      this.set(i, EMPTY, this.temp[i]);
    }
  }

  // ----- clouds -----
  // Clouds keep their height, drift slowly with the wind and drop rain (or
  // snow when it is freezing). Raining uses the cloud up.
  cloud(i, x, y) {
    const { W, type } = this;
    if (--this.life[i] <= 0) { this.set(i, EMPTY, this.temp[i]); return; }
    if (Math.random() < 0.004 && y > 0 && type[i - W] === EMPTY) {
      this.set(i - W, this.temp[i] < 0 ? SNOW : WATER);
      this.life[i] -= 200;
      this.discover(DISC.RAIN_CLOUD);
    }
    if (Math.random() < 0.05) {
      const dx = this.wind || 1, nx = x + dx;
      if (nx < 0 || nx >= W) { this.set(i, EMPTY, this.temp[i]); return; }
      if (type[i + dx] === EMPTY) this.swap(i, i + dx);
    } else if (Math.random() < 0.004) {
      const dy = Math.random() < 0.5 ? -1 : 1, ny = y + dy;
      if (ny >= 0 && ny < this.H && type[i + dy * W] === EMPTY) this.swap(i, i + dy * W);
    }
  }

  // ----- fungus -----
  // Fungus creeps over surfaces next to it and rots wood. Its life counter is
  // how much further it can spread; damp ground tops it up.
  fungus(i, x, y) {
    if (Math.random() > 0.03) return;
    const { W, H, type, life } = this;
    const n = this.randomNeighbor(i, x, y);
    if (n < 0) return;
    const o = type[n];
    if (o === WOOD && Math.random() < 0.2) {
      this.morph(n, FUNGUS); life[n] = life[i];
      this.discover(DISC.ROT);
      return;
    }
    if (o !== EMPTY) return;
    const nx = n % W, ny = (n / W) | 0;
    let surface = false, damp = false;
    for (const m of [nx > 0 ? n - 1 : -1, nx < W - 1 ? n + 1 : -1, ny > 0 ? n - W : -1, ny < H - 1 ? n + W : -1]) {
      if (m < 0 || m === i) continue;
      const q = type[m];
      if (BLOCKS[q] && q !== FUNGUS) surface = true;
      if (q === WATER || q === MUD || q === BLOOD || q === BRINE) damp = true;
    }
    if (!surface) return;
    this.set(n, FUNGUS);
    life[n] = damp ? Math.min(8, life[i]) : life[i] - 1;
    life[i]--;
  }

  growPlant(i, x, y) {
    if (this.life[i] <= 0 || Math.random() > 0.03) return;
    const n = this.randomNeighbor(i, x, y);
    if (n >= 0 && this.type[n] === WATER) {
      this.set(n, PLANT);
      this.life[n] = this.life[i] - 1;
      this.life[i]--;
      this.discover(DISC.GROW);
    }
  }

  sprout(i, x, y) {
    if (y === 0) return;
    const below = this.type[i - this.W];
    const T = this.temp[i];
    if (T < 4 || T > 45) return;
    const wet = this.hasNeighbor(i, x, y, WATER);
    let chance = 0;
    if (below === MUD) chance = 0.05;
    else if (below === DIRT) chance = wet ? 0.05 : 0.004;
    else if (below === SAND || below === PLANT) chance = wet ? 0.01 : 0;
    if (Math.random() >= chance) return;
    this.morph(i, WOOD);
    this.flags[i] = GROWING;
    this.life[i] = 16 + ((Math.random() * 22) | 0);
    // Water touching the seed is drunk by the sprouting tree.
    if (wet) {
      const n = this.randomNeighbor(i, x, y);
      if (n >= 0 && this.type[n] === WATER) this.set(n, EMPTY);
    }
    this.discover(DISC.SPROUT);
  }

  growTree(i, x, y) {
    if (Math.random() > 0.15) return;
    const { W, H, type } = this;
    const left = this.life[i];
    this.flags[i] &= ~GROWING;
    if (left <= 0 || y >= H - 2) { this.leaves(x, y); return; }
    let dx = 0;
    const r = Math.random();
    if (r < 0.12) dx = -1; else if (r < 0.24) dx = 1;
    const nx = x + dx;
    if (nx < 0 || nx >= W) { this.leaves(x, y); return; }
    const j = i + W + dx;
    const o = type[j];
    if (o !== EMPTY && o !== PLANT && o !== WATER && STATE[o] !== GAS) { this.leaves(x, y); return; }
    this.set(j, WOOD, AMBIENT);
    this.flags[j] = GROWING;
    this.life[j] = left - 1;
    this.stamp[j] = this.clock;
    // Thicker trunk near the ground.
    if (left > 18 && x + 1 < W && type[i + 1] === EMPTY) this.set(i + 1, WOOD, AMBIENT);
    // Occasional side branch.
    if (left < 14 && left > 4 && Math.random() < 0.18) {
      const bx = x + (Math.random() < 0.5 ? -2 : 2);
      if (bx >= 0 && bx < W) {
        const b = bx + W * (y + 1);
        if (type[b] === EMPTY) { this.set(b, WOOD, AMBIENT); this.flags[b] = GROWING; this.life[b] = (left * 0.5) | 0; }
      }
    }
  }

  leaves(x, y) {
    const { W, H, type } = this;
    for (const [ox, oy, r] of [[0, 2, 6 + Math.random() * 3], [-5, -1, 4.5], [5, -1, 4.5]]) {
      const ri = Math.ceil(r);
      for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
        const nx = x + ox + dx, ny = y + oy + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const d = Math.sqrt(dx * dx + (dy * 1.3) ** 2) / r;
        if (d > 1 || (d > 0.75 && Math.random() < 0.5)) continue;
        const j = nx + W * ny;
        if (type[j] === EMPTY) { this.set(j, PLANT, AMBIENT); this.life[j] = 0; }
      }
    }
  }

  // ----- heat -----
  // Heat flows only in regions that hold heat (or touch one that does);
  // everywhere else is already at room temperature.
  conduct() {
    const { W, H, CX, CY, heatAct } = this;
    for (let cy = 0; cy < CY; cy++) for (let cx = 0; cx < CX; cx++) {
      const c = cx + CX * cy;
      const nx = cx + 1 < CX, ny = cy + 1 < CY;
      if (!(heatAct[c] || (nx && heatAct[c + 1]) || (ny && heatAct[c + CX]))) continue;
      const any = this.conductBox(cx * REGION, Math.min(W, cx * REGION + REGION), cy * REGION, Math.min(H, cy * REGION + REGION));
      heatAct[c] = any;
      if (any) { if (nx) heatAct[c + 1] = 1; if (ny) heatAct[c + CX] = 1; }
    }
  }

  conductBox(x0, x1, y0, y1) {
    const { W, H, type, temp } = this;
    let any = 0;
    for (let y = y0; y < y1; y++) {
      const top = y < H - 1;
      let i = x0 + W * y;
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
        if (top) {
          const j = i + W, tj = temp[j];
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
    return any;
  }

  // ----- painting -----
  // mode: 'add' | 'erase' | 'heat' | 'cool'. The brush is a disc of radius r.
  // pour scales how densely loose materials are poured.
  paint(cx, cy, r, mode, t, pour = 1) {
    const { W, H, type, temp } = this;
    const ri = Math.floor(r);
    const s = STATE[t];
    let density = 1;
    if (mode === 'add') {
      if (s === POWDER) density = 0.12 * pour;
      else if (s === LIQUID) density = 0.18 * pour;
      else if (s === GAS) density = 0.12 * pour;
      if (t === SEED) density = 0.01 * pour;
    }
    const r2 = r * r + 0.5;
    for (let dy = -ri; dy <= ri; dy++) {
      const y = cy + dy; if (y < 0 || y >= H) continue;
      for (let dx = -ri; dx <= ri; dx++) {
        const x = cx + dx; if (x < 0 || x >= W) continue;
        if (dx * dx + dy * dy > r2) continue;
        const i = x + W * y;
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
          this.heatAct[this.regionOf[i]] = 1;
        } else if (mode === 'cool') {
          temp[i] = Math.max(temp[i] - 25, -200);
          this.heatAct[this.regionOf[i]] = 1;
        }
      }
    }
  }

  // Wind: blow powders, liquids and gases away from (cx, cy).
  blow(cx, cy, r, power) {
    const { W, H, type, vx, vy } = this;
    const ri = Math.ceil(r);
    for (let dy = -ri; dy <= ri; dy++) {
      const y = cy + dy; if (y < 0 || y >= H) continue;
      for (let dx = -ri; dx <= ri; dx++) {
        const x = cx + dx; if (x < 0 || x >= W) continue;
        const d = Math.hypot(dx, dy);
        if (d > r || d < 0.5) continue;
        const i = x + W * y, t = type[i];
        if (t === EMPTY || t === BODY) continue;
        const s = STATE[t], f = (1 - d / r) * power, nx = dx / d, ny = dy / d;
        if (s === POWDER || s === LIQUID) {
          if (Math.random() > 0.5) continue;
          vx[i] = Math.max(-6, Math.min(6, vx[i] + nx * f * 1.5));
          vy[i] = Math.max(-6, Math.min(6, vy[i] + ny * f + 0.3 * f));
          this.wakeAt(i);
        } else if (s === GAS && Math.random() < f) {
          const j = Math.abs(nx) > Math.abs(ny) ? (nx > 0 && x < W - 1 ? i + 1 : nx < 0 && x > 0 ? i - 1 : -1)
            : (ny > 0 && y < H - 1 ? i + W : ny < 0 && y > 0 ? i - W : -1);
          if (j >= 0 && type[j] === EMPTY) this.swap(i, j);
        }
      }
    }
  }

  fill(x0, y0, x1, y1, t) {
    for (let y = Math.max(0, y0); y <= Math.min(this.H - 1, y1); y++)
      for (let x = Math.max(0, x0); x <= Math.min(this.W - 1, x1); x++)
        this.set(this.index(x, y), t);
  }
}
