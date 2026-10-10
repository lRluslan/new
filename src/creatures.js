// Creatures: little ragdolls that live in the shared world.
//
// A body is a set of points (head, neck, hips, knees, feet, hands...) joined
// by sticks and moved with Verlet physics. Each point feels the cell it is
// in: gravity, buoyancy and drag in liquids, and it collides with the solid
// and powder cells around it. Living creatures use their muscles: they pull
// their points toward a standing pose and swing their feet, so they walk,
// and they go limp when they are knocked out, grabbed or killed.
//
// While the world moves, the cells a body fills are marked as solid (BODY),
// so sand piles up on bodies and water flows around them. The marks are
// removed again before anything is drawn.

import * as El from './elements.js';

const {
  EMPTY, STATE, SOLID, POWDER, LIQUID, DENS, VISC, FIRE, LAVA, MOLTEN, ACID, WATER, BRINE, BLOOD, BODY, OIL, ASH,
  SMOKE, HONEY, DISC,
} = El;

const GRAVITY = 0.035;    // cells per step²: 9.8 m/s² when a cell is about 17 cm and a step is 1/50 s
const MAX_V = 2.5;        // fastest a point can move, cells per step
const ITERATIONS = 3;     // stick and collision passes per step
const MAX_CREATURES = 40;
const RESTING = 16;       // world flag bit for a resting liquid (see world.js)
const FALL_HURTS = 0.95;  // impact speed (cells per step) above which a landing hurts

// Body part groups, so a limb can come off as one piece.
export const CORE = 0, HEAD = 1, ARM_L = 2, ARM_R = 3, LEG_L = 4, LEG_R = 5, TAIL = 6;

const HARD_CELL = new Uint8Array(El.COUNT);
for (let t = 1; t < El.COUNT; t++) HARD_CELL[t] = (STATE[t] === SOLID || STATE[t] === POWDER) && t !== BODY ? 1 : 0;
// Liquids that put out a burning body.
const DOUSES = new Uint8Array(El.COUNT);
for (const t of [WATER, BRINE, BLOOD, HONEY, El.MUD]) DOUSES[t] = 1;

const pick = (rand, a) => a[(rand() * a.length) | 0];

// ----- species -----
// A point: [name, forward, up, side, radius, mass, limb, muscle, gait, gait phase]
// forward/up/side place it in the standing pose; up is the height above the
// ground. muscle: how hard it is pulled toward that pose. gait: how it moves
// while walking (a foot, knee, hand or elbow), and phase 0 or 1 is half a
// stride apart.
// A stick: [a, b, thickness (0 = an invisible brace), colour, stiffness].
function biped(armsForward) {
  const hand = armsForward ? [2.5, 7.1] : [0.35, 4.6], elbow = armsForward ? [1.3, 7.2] : [0.05, 6.1];
  return {
    points: [
      ['head', 0.15, 9.1, 0, 1.0, 1.2, HEAD, 0.3],
      ['neck', 0, 7.7, 0, 0.55, 1.5, CORE, 0.3],
      ['hips', 0, 4.7, 0, 0.6, 1.8, CORE, 0.35],
      ['kneeL', 0.35, 2.5, -0.5, 0.5, 0.8, LEG_L, 0.18, 'knee', 0],
      ['footL', 0, 0.5, -0.5, 0.5, 0.8, LEG_L, 0.25, 'foot', 0],
      ['kneeR', 0.35, 2.5, 0.5, 0.5, 0.8, LEG_R, 0.18, 'knee', 1],
      ['footR', 0, 0.5, 0.5, 0.5, 0.8, LEG_R, 0.25, 'foot', 1],
      ['elbowL', elbow[0], elbow[1], -1.0, 0.45, 0.6, ARM_L, armsForward ? 0.12 : 0.07, 'elbow', 1],
      ['handL', hand[0], hand[1], -1.0, 0.45, 0.5, ARM_L, armsForward ? 0.12 : 0.07, 'hand', 1],
      ['elbowR', elbow[0], elbow[1], 1.0, 0.45, 0.6, ARM_R, armsForward ? 0.12 : 0.07, 'elbow', 0],
      ['handR', hand[0], hand[1], 1.0, 0.45, 0.5, ARM_R, armsForward ? 0.12 : 0.07, 'hand', 0],
    ],
    sticks: [
      ['neck', 'head', 0.8, 'skin'],
      ['neck', 'hips', 2.1, 'shirt'],
      ['hips', 'kneeL', 1.1, 'pants'], ['kneeL', 'footL', 1.0, 'pants'],
      ['hips', 'kneeR', 1.1, 'pants'], ['kneeR', 'footR', 1.0, 'pants'],
      ['neck', 'elbowL', 0.85, 'shirt'], ['elbowL', 'handL', 0.75, 'skin'],
      ['neck', 'elbowR', 0.85, 'shirt'], ['elbowR', 'handR', 0.75, 'skin'],
      ['head', 'hips', 0, null, 0.4],
    ],
    dots: [['footL', 0.62, 'shoe'], ['footR', 0.62, 'shoe'], ['handL', 0.48, 'skin'], ['handR', 0.48, 'skin']],
    root: 'hips', headPt: 'head', neckPt: 'neck', headR: 1.15, walker: true,
  };
}

export const SPECIES = {
  human: {
    ...biped(false), name: 'Human', density: 1010, hp: 100, breathes: 'air', burns: 1, bleeds: BLOOD,
    walk: 0.065, run: 0.16, swims: true, heatMax: 55, acid: 1, head: 'round',
    desc: 'Walks around, runs from fire and zombies, and swims until tired. Needs air.',
    colors(rand) {
      return {
        skin: pick(rand, ['#f1c9a5', '#e0ac80', '#c68a5e', '#8d5a3b', '#5c3a24']),
        hair: pick(rand, ['#2b1d14', '#5a3a22', '#8a5a2b', '#d9b06a', '#3a3a3a', '#a33a1a']),
        shirt: pick(rand, ['#c4562a', '#3d6e8f', '#6f8c33', '#d9a531', '#8f3b5a', '#e8e2d0', '#4a8a7a']),
        pants: pick(rand, ['#3b4a6b', '#4a3a2a', '#2e2f36', '#6b5a3a']),
        shoe: '#2a1e16', eye: '#1a1410',
      };
    },
  },
  zombie: {
    ...biped(true), name: 'Zombie', density: 1060, hp: 90, breathes: null, burns: 1.5, bleeds: BLOOD,
    walk: 0.035, run: 0.065, swims: false, heatMax: 60, acid: 1, head: 'round', hunts: 'human',
    desc: 'Shambles after people. One bite and they turn too. Does not breathe, so it walks along the bottom of ponds. Burns easily.',
    colors(rand, from) {
      return {
        skin: pick(rand, ['#8fae6a', '#7d9c5c', '#9ab87a']),
        hair: '#2a2f22',
        shirt: from ? from.shirt : pick(rand, ['#5b5f4a', '#6a5a4a', '#4a5560']),
        pants: from ? from.pants : '#3f4636', shoe: '#22261c', eye: '#e23b2a', torn: true,
      };
    },
  },
  robot: {
    ...biped(false), name: 'Robot', density: 4200, hp: 170, breathes: null, burns: 0, bleeds: OIL,
    walk: 0.05, run: 0.11, swims: false, heatMax: 350, acid: 2, head: 'box',
    desc: 'Heavy and tough. Fire hardly bothers it, but it sinks in water, leaks oil when hurt and acid eats it fast.',
    colors(rand) {
      const body = pick(rand, ['#a9b2bc', '#c2c8cc', '#b59a5e']);
      return { skin: body, hair: body, shirt: '#7d8792', pants: '#5b6270', shoe: '#3a3f4a', eye: '#6fd6c0', metal: true };
    },
  },
  chicken: {
    name: 'Chicken', density: 520, hp: 30, breathes: 'air', burns: 1.2, bleeds: BLOOD,
    walk: 0.045, run: 0.13, swims: false, heatMax: 50, acid: 1, head: 'chicken', flaps: true, skittish: true,
    desc: 'Pecks about and scurries away from everything. Light enough to float, and flaps to slow its fall.',
    points: [
      ['body', 0, 2.3, 0, 0.75, 1.5, CORE, 0.35],
      ['chest', 0.9, 2.6, 0, 0.65, 1.0, CORE, 0.3],
      ['head', 1.45, 3.9, 0, 0.6, 0.6, HEAD, 0.3],
      ['tail', -1.1, 3.0, 0, 0.5, 0.4, TAIL, 0.2],
      ['footL', 0.1, 0.35, -0.35, 0.35, 0.3, LEG_L, 0.25, 'foot', 0],
      ['footR', 0.1, 0.35, 0.35, 0.35, 0.3, LEG_R, 0.25, 'foot', 1],
    ],
    sticks: [
      ['body', 'chest', 1.9, 'body'], ['chest', 'head', 0.8, 'body'], ['body', 'tail', 1.2, 'tail'],
      ['body', 'footL', 0.32, 'leg'], ['body', 'footR', 0.32, 'leg'],
      ['chest', 'tail', 0, null, 0.6], ['head', 'body', 0, null, 0.4],
      ['footL', 'chest', 0, null, 0.25], ['footR', 'chest', 0, null, 0.25],
    ],
    dots: [],
    root: 'body', headPt: 'head', neckPt: 'chest', headR: 0.72, walker: true,
    colors(rand) {
      const brown = rand() < 0.4;
      return { body: brown ? '#c68a4e' : '#f4efe4', tail: brown ? '#9a6436' : '#e2d7c4', comb: '#d23a2a', beak: '#e8a33a', leg: '#e8a33a', eye: '#1a1410' };
    },
  },
  fish: {
    name: 'Fish', density: 1000, hp: 35, breathes: 'water', burns: 1, bleeds: BLOOD,
    walk: 0.05, run: 0.12, swims: false, heatMax: 40, acid: 1, head: 'fish', swimmer: true,
    desc: 'Swims in water and breathes through its gills. On land it flops about and soon suffocates.',
    points: [
      ['head', 1.4, 0, 0, 0.55, 1.0, HEAD, 0.3],
      ['mid', 0.3, 0, 0, 0.6, 1.2, CORE, 0.3],
      ['tailBase', -0.85, 0, 0, 0.45, 0.8, TAIL, 0.3],
      ['tailTip', -1.75, 0, 0, 0.4, 0.4, TAIL, 0.25],
    ],
    sticks: [
      ['head', 'mid', 1.7, 'body'], ['mid', 'tailBase', 1.35, 'body'], ['tailBase', 'tailTip', 0.6, 'fin'],
      ['head', 'tailBase', 0, null, 0.5], ['mid', 'tailTip', 0, null, 0.3],
    ],
    dots: [['tailTip', 0.75, 'fin']],
    root: 'mid', headPt: 'head', neckPt: 'mid', headR: 0.6, walker: false,
    colors(rand) {
      const c = pick(rand, [['#f08a32', '#c45a1a'], ['#4a9ad8', '#2a6aa8'], ['#e8c840', '#b8962a']]);
      return { body: c[0], fin: c[1], stripe: '#fbf4e8', eye: '#1a1410' };
    },
  },
};
export const SPECIES_ORDER = ['human', 'zombie', 'robot', 'chicken', 'fish'];

// Work out indices and rest lengths once per species.
for (const sp of Object.values(SPECIES)) {
  const idx = Object.fromEntries(sp.points.map((p, k) => [p[0], k]));
  sp.idx = idx;
  sp.rootK = idx[sp.root]; sp.headK = idx[sp.headPt]; sp.neckK = idx[sp.neckPt];
  sp.rest = sp.points.map(p => [p[1], p[2], p[3]]);
  sp.stickList = sp.sticks.map(([a, b, thick, color, stiff]) => {
    const A = sp.rest[idx[a]], B = sp.rest[idx[b]];
    return { a: idx[a], b: idx[b], len: Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]), thick, color, stiff: stiff ?? 1 };
  });
  sp.dotList = (sp.dots || []).map(([p, r, color]) => ({ k: idx[p], r, color }));
  sp.height = Math.max(...sp.rest.map(r => r[1])) + sp.headR;
  sp.length = Math.max(...sp.rest.map(r => r[0])) - Math.min(...sp.rest.map(r => r[0]));
}

let nextId = 1;
class Creature {
  constructor(kind, x, y, z, heading, lane, colors) {
    const sp = SPECIES[kind];
    this.id = nextId++;
    this.kind = kind; this.sp = sp;
    const n = this.n = sp.points.length;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.ox = new Float32Array(n); this.oy = new Float32Array(n); this.oz = new Float32Array(n);
    this.r = new Float32Array(sp.points.map(p => p[4]));
    this.im = new Float32Array(sp.points.map(p => 1 / p[5]));
    this.limb = new Uint8Array(sp.points.map(p => p[6]));
    this.wound = new Float32Array(n);
    this.detached = new Uint8Array(n);
    this.sticks = sp.stickList.map(s => ({ ...s, broken: false, bleed: 0 }));
    this.heading = heading;
    this.lane = lane;            // creatures made in the side view keep to their slice
    const cx = Math.cos(heading), cz = Math.sin(heading);
    for (let k = 0; k < n; k++) {
      const [f, u, s] = sp.rest[k];
      this.px[k] = this.ox[k] = x + f * cx - s * cz;
      this.py[k] = this.oy[k] = y + u;
      this.pz[k] = this.oz[k] = z + f * cz + s * cx;
    }
    this.colors = colors;
    this.hp = sp.hp; this.alive = true;
    this.oxygen = 400; this.stamina = 600;
    this.fire = 0; this.char = 0;
    this.stun = 0; this.strength = 1;
    this.speed = 0; this.phase = 0;
    this.mood = 'walk'; this.moodT = 40;
    this.hurtT = 0; this.hurtFlash = 0;
    this.infected = 0; this.biteT = 0;
    this.age = 0; this.deadT = 0;
    this.grab = null; this.cause = '';
    this.swimming = false; this.grounded = false;
    this.impact = 0; this.impactK = 0;
    this.swimDY = 0; this.flapping = false;
    this.lastHit = 0;
  }
}

export class Creatures {
  constructor(world) {
    this.world = world;
    this.list = [];
    this.gore = true;
    this.stamped = [];
    this.prevStamped = [];
    this.was = new Uint8Array(world.N);   // cells that held a body last step
    this.owner = new Map();
    this.rand = Math.random;
  }

  clear() {
    this.list.length = 0; this.owner.clear();
    for (const i of this.prevStamped) this.was[i] = 0;
    this.stamped.length = 0; this.prevStamped.length = 0;
  }

  spawn(kind, x, y, z, opts = {}) {
    const w = this.world, sp = SPECIES[kind];
    // Start a little above the ground, clear of anything solid.
    x = Math.max(2, Math.min(w.W - 3, x)); z = Math.max(1.5, Math.min(w.D - 2.5, z));
    const tall = Math.ceil(sp.height) + 1;
    for (let tries = 0; tries < 40 && y < w.H - tall; tries++) {
      let free = true;
      for (let u = 0; u < tall && free; u++) if (HARD_CELL[this.cellType(x, y + u, z)]) free = false;
      if (free) break;
      y++;
    }
    if (!sp.walker) y += 0.5;
    const lane = opts.lane ?? null;
    const heading = opts.heading ?? (lane != null ? (Math.random() < 0.5 ? 0 : Math.PI) : Math.random() * Math.PI * 2);
    const c = new Creature(kind, x, y + 0.05, lane != null ? lane + 0.5 : z, heading, lane != null ? lane + 0.5 : null, sp.colors(Math.random));
    this.list.push(c);
    // Too many: the oldest body goes first, then the oldest creature.
    if (this.list.length > MAX_CREATURES) {
      let k = this.list.findIndex(o => !o.alive);
      if (k < 0) k = 0;
      this.list.splice(k, 1);
    }
    return c;
  }

  // ----- world access -----
  cellIndex(x, y, z) {
    const w = this.world;
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= w.W || iy >= w.H || iz >= w.D) return -1;
    return ix + w.W * (iz + w.D * iy);
  }
  cellType(x, y, z) {
    const i = this.cellIndex(x, y, z);
    return i < 0 ? (y < 0 ? El.STONE : EMPTY) : this.world.type[i];
  }

  // ----- the step -----
  step() {
    const w = this.world;
    this.feelWorld();
    for (const c of this.list) this.update(c);
    this.collideBodies();
    // Remove what has burnt to ash, fallen out of the world or crumbled away.
    for (let k = this.list.length - 1; k >= 0; k--) {
      const c = this.list[k];
      const gone = c.py[c.sp.rootK] < -4 || (!c.alive && c.char >= 1);
      if (!gone) continue;
      if (c.char >= 1) {
        for (let p = 0; p < c.n; p++) {
          const i = this.cellIndex(c.px[p], c.py[p], c.pz[p]);
          if (i >= 0 && w.type[i] === EMPTY) w.set(i, ASH);
        }
      }
      this.list.splice(k, 1);
    }
  }

  // Explosions and falling grains from the world's last step.
  feelWorld() {
    const w = this.world;
    const b = w.blasts;
    for (let j = 0; j < b.length; j += 3) this.blast(b[j] + 0.5, b[j + 1] + 0.5, b[j + 2] + 0.5);
    b.length = 0;
    const h = w.hits;
    for (let j = 0; j < h.length; j += 2) {
      const o = this.owner.get(h[j]);
      if (o === undefined) continue;
      const c = this.list.find(c => c.id === o >> 8);
      if (!c) continue;
      const k = o & 255, power = h[j + 1] / 1600;
      c.oy[k] += power * 0.02;   // pushed down
      const dmg = (power - 2) * 0.45;
      if (dmg > 0) this.hurt(c, dmg, k, 'crush', dmg * 0.4);
    }
    h.length = 0;
  }

  blast(x, y, z) {
    const R = 10;
    for (const c of this.list) {
      let best = 0, bk = 0;
      for (let k = 0; k < c.n; k++) {
        const dx = c.px[k] - x, dy = c.py[k] - y, dz = c.pz[k] - z;
        const d = Math.hypot(dx, dy, dz);
        if (d > R) continue;
        const f = 1 - d / R, s = d > 0.01 ? 2.1 * f / d : 0;
        c.ox[k] -= dx * s; c.oy[k] -= dy * s + 0.7 * f; c.oz[k] -= dz * s;
        if (f > best) { best = f; bk = k; }
        // Blown apart, if blood and damage effects are on.
        if (this.gore && f > 0.55 && c.limb[k] !== CORE && Math.random() < 0.35) this.detach(c, c.limb[k]);
      }
      if (best > 0) { this.hurt(c, 95 * best, bk, 'blast', 60); c.fire = Math.max(c.fire, c.sp.burns && best > 0.4 ? 200 : 0); }
    }
  }

  // A lightning bolt came down at column (x, z).
  lightning(x, z) {
    for (const c of this.list) {
      const k = c.sp.headK;
      if (Math.hypot(c.px[k] - x - 0.5, c.pz[k] - z - 0.5) > 2.5) continue;
      this.hurt(c, 85, k, 'lightning', 80);
      if (c.sp.burns) c.fire = 500;
      for (let p = 0; p < c.n; p++) { c.ox[p] += (Math.random() - 0.5) * 0.6; c.oy[p] -= Math.random() * 0.4; }
    }
  }

  update(c) {
    const sp = c.sp, w = this.world;
    c.age++;
    if (c.stun > 0) c.stun--;
    if (c.hurtFlash > 0) c.hurtFlash--;
    if (c.hurtT > 0) c.hurtT--;
    if (c.biteT > 0) c.biteT--;
    if (!c.alive) c.deadT++;
    if (c.alive) this.think(c);
    this.muscles(c);

    // Gravity, buoyancy and drag from the cell each point is in.
    const rho = sp.density;
    for (let k = 0; k < c.n; k++) {
      let vx = c.px[k] - c.ox[k], vy = c.py[k] - c.oy[k], vz = c.pz[k] - c.oz[k];
      const v2 = vx * vx + vy * vy + vz * vz;
      if (v2 > MAX_V * MAX_V) { const s = MAX_V / Math.sqrt(v2); vx *= s; vy *= s; vz *= s; }
      const t = this.cellType(c.px[k], c.py[k], c.pz[k]);
      let ay = -GRAVITY;
      if (STATE[t] === LIQUID) {
        const drag = 0.08 + 0.35 * (1 - VISC[t]);
        vx *= 1 - drag; vy *= 1 - drag; vz *= 1 - drag;
        ay += GRAVITY * DENS[t] / rho;
      } else {
        vx *= 0.996; vz *= 0.996;
        vy *= c.flapping && c.limb[k] !== LEG_L && c.limb[k] !== LEG_R ? 0.86 : 0.996;
      }
      c.ox[k] = c.px[k]; c.oy[k] = c.py[k]; c.oz[k] = c.pz[k];
      c.px[k] += vx; c.py[k] += vy + ay; c.pz[k] += vz;
    }

    // Held by the mouse: that point follows the pointer, the rest swings.
    if (c.grab) {
      const k = c.grab.k;
      let dx = c.grab.x - c.px[k], dy = c.grab.y - c.py[k], dz = c.grab.z - c.pz[k];
      const d = Math.hypot(dx, dy, dz), lim = 2.2;
      if (d > lim) { dx *= lim / d; dy *= lim / d; dz *= lim / d; }
      c.px[k] += dx * 0.5; c.py[k] += dy * 0.5; c.pz[k] += dz * 0.5;
      c.stun = Math.max(c.stun, 30);
    }

    c.impact = 0;
    for (let it = 0; it < ITERATIONS; it++) {
      this.solveSticks(c);
      this.collide(c, it === 0);
    }
    if (c.impact > FALL_HURTS && c.age > 5) {
      const k = c.impactK;
      const dmg = (c.impact - FALL_HURTS) * 105 * (k === sp.headK ? 1.4 : 1);
      this.hurt(c, dmg, k, 'fall', dmg);
    }
    this.environment(c);
    if (c.lane != null && !c.grab) {
      // Bodies made in the side view drift back toward their slice.
      const k = sp.rootK, dz = c.lane - c.pz[k];
      if (Math.abs(dz) > 0.6) for (let p = 0; p < c.n; p++) c.pz[p] += dz * 0.01;
    }
  }

  solveSticks(c) {
    const { px, py, pz, im } = c;
    for (const s of c.sticks) {
      if (s.broken) continue;
      const a = s.a, b = s.b;
      const dx = px[b] - px[a], dy = py[b] - py[a], dz = pz[b] - pz[a];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      const diff = (d - s.len) / d * s.stiff;
      const wa = im[a] / (im[a] + im[b]), wb = 1 - wa;
      px[a] += dx * diff * wa; py[a] += dy * diff * wa; pz[a] += dz * diff * wa;
      px[b] -= dx * diff * wb; py[b] -= dy * diff * wb; pz[b] -= dz * diff * wb;
    }
  }

  // Push every point out of the solid and powder cells it overlaps. Moving
  // into a surface stops that part of the motion and rubs off some of the
  // sliding (friction); the hardest hit is remembered for fall damage.
  collide(c, first) {
    const w = this.world, type = w.type, W = w.W, H = w.H, D = w.D;
    for (let k = 0; k < c.n; k++) {
      const r = c.r[k];
      let x = c.px[k], y = c.py[k], z = c.pz[k];
      const vx0 = x - c.ox[k], vy0 = y - c.oy[k], vz0 = z - c.oz[k];
      // The edges of the world are walls; the bottom is bedrock.
      if (x < r) x = r; else if (x > W - r) x = W - r;
      if (z < r) z = r; else if (z > D - r) z = D - r;
      if (y > H - r) y = H - r;
      let nx = 0, ny = 0, nz = 0;
      if (y < r) { y = r; ny = 1; }
      const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.floor(y + r));
      const z0 = Math.floor(z - r), z1 = Math.floor(z + r);
      for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) {
        if (cz < 0 || cz >= D) continue;
        for (let cx = x0; cx <= x1; cx++) {
          if (cx < 0 || cx >= W) continue;
          const t = type[cx + W * (cz + D * cy)];
          if (!HARD_CELL[t]) continue;
          // Closest point of the cell's box to the point's centre.
          const qx = x < cx ? cx : x > cx + 1 ? cx + 1 : x;
          const qy = y < cy ? cy : y > cy + 1 ? cy + 1 : y;
          const qz = z < cz ? cz : z > cz + 1 ? cz + 1 : z;
          let dx = x - qx, dy = y - qy, dz = z - qz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= r * r) continue;
          let d = Math.sqrt(d2);
          if (d < 1e-4) {
            // The centre is inside the cell: leave by the nearest open side, preferring up.
            const opts = [[0, 1, 0, cy + 1 - y], [0, -1, 0, y - cy], [1, 0, 0, cx + 1 - x], [-1, 0, 0, x - cx], [0, 0, 1, cz + 1 - z], [0, 0, -1, z - cz]];
            let best = null;
            for (const o of opts) {
              const ox = cx + o[0], oy = cy + o[1], oz = cz + o[2];
              const open = ox < 0 || ox >= W || oz < 0 || oz >= D || oy >= H || (oy >= 0 && !HARD_CELL[type[ox + W * (oz + D * oy)]]);
              const cost = o[3] + (open ? 0 : 3) - (o[1] === 1 ? 0.15 : 0);
              if (!best || cost < best[3]) best = [o[0], o[1], o[2], cost, o[3]];
            }
            dx = best[0]; dy = best[1]; dz = best[2];
            const depth = Math.min(1.5, best[4] + r);
            x += dx * depth; y += dy * depth; z += dz * depth;
          } else {
            dx /= d; dy /= d; dz /= d;
            x += dx * (r - d); y += dy * (r - d); z += dz * (r - d);
          }
          nx += dx; ny += dy; nz += dz;
        }
      }
      if (nx !== 0 || ny !== 0 || nz !== 0) {
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        let vx = vx0, vy = vy0, vz = vz0;
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn < 0) {
          if (first && -vn > c.impact) { c.impact = -vn; c.impactK = k; }
          vx -= nx * vn; vy -= ny * vn; vz -= nz * vn;
          const fr = ny > 0.5 ? 0.35 : 0.15;
          vx *= 1 - fr; vy *= 1 - fr; vz *= 1 - fr;
          c.ox[k] = x - vx; c.oy[k] = y - vy; c.oz[k] = z - vz;
        }
      }
      c.px[k] = x; c.py[k] = y; c.pz[k] = z;
    }
  }

  // Bodies bump into each other.
  collideBodies() {
    const L = this.list;
    for (let a = 0; a < L.length; a++) {
      const A = L[a], ra = A.sp.rootK;
      for (let b = a + 1; b < L.length; b++) {
        const B = L[b], rb = B.sp.rootK;
        const reach = A.sp.height + B.sp.height;
        if (Math.abs(A.px[ra] - B.px[rb]) > reach || Math.abs(A.py[ra] - B.py[rb]) > reach || Math.abs(A.pz[ra] - B.pz[rb]) > reach) continue;
        for (let i = 0; i < A.n; i++) for (let j = 0; j < B.n; j++) {
          const dx = B.px[j] - A.px[i], dy = B.py[j] - A.py[i], dz = B.pz[j] - A.pz[i];
          const R = A.r[i] + B.r[j], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= R * R || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), push = (R - d) / d * 0.5;
          const wa = A.im[i] / (A.im[i] + B.im[j]) * 2, wb = 2 - wa;
          A.px[i] -= dx * push * wa; A.py[i] -= dy * push * wa; A.pz[i] -= dz * push * wa;
          B.px[j] += dx * push * wb; B.py[j] += dy * push * wb; B.pz[j] += dz * push * wb;
        }
      }
    }
  }

  // ----- muscles: standing, walking, swimming -----
  // Height of the ground under (x, z), searching down from y at most `depth`
  // cells, or -1 if there is none.
  groundBelow(x, y, z, depth) {
    const w = this.world;
    const ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= w.W || iz >= w.D) return -1;
    let iy = Math.min(w.H - 1, Math.floor(y));
    const stop = Math.max(-1, Math.floor(y - depth));
    for (; iy > stop; iy--) {
      if (iy < 0) return 0;
      if (HARD_CELL[w.type[ix + w.W * (iz + w.D * iy)]]) return iy + 1;
    }
    return iy < 0 ? 0 : -1;
  }

  muscles(c) {
    const sp = c.sp;
    const able = c.alive && !c.grab && c.stun <= 0 && !c.detached[sp.rootK];
    c.strength = able ? Math.min(1, c.strength + 0.025) : 0;
    c.flapping = false;
    c.swimming = false;
    if (!able) { this.flail(c); return; }
    const k0 = sp.rootK;
    const fx = Math.cos(c.heading), fz = Math.sin(c.heading);
    const sx = -fz, sz = fx;
    const rx = c.px[k0], ry = c.py[k0], rz = c.pz[k0];

    if (sp.swimmer) { this.swim(c, fx, fz, sx, sz); return; }

    const rootU = sp.rest[k0][1];
    let ground = this.groundBelow(rx, ry, rz, rootU + 2.5);
    // Look a step ahead too, so a creature lifts itself onto a ledge.
    if (c.speed > 0 && ground >= 0) {
      const ahead = this.groundBelow(rx + fx * 1.4, ry + 2.2, rz + fz * 1.4, rootU + 4.5);
      if (ahead > ground && ahead - ground <= 2.5) ground = ahead;
    }
    c.grounded = ground >= 0;
    const rootT = this.cellType(rx, ry, rz);
    const inLiquid = STATE[rootT] === LIQUID;
    let support = 1, base = ground;
    // Falling fast: the legs cannot catch the body, it just lands.
    if (c.py[k0] - c.oy[k0] < -0.4) ground = -1;
    if (ground < 0) {
      // In the air or out of its depth: hold the pose around the hips.
      base = ry - rootU;
      support = 0.2;
      if (sp.flaps) c.flapping = true;
      if (inLiquid && sp.swims) c.swimming = true;
    }
    if (inLiquid && ground >= 0 && ry - ground > rootU + 1.5) c.swimming = sp.swims;

    // Treading water: swimmers keep their head up until they tire.
    if (c.swimming) {
      const h = sp.headK, n = sp.neckK;
      const headT = this.cellType(c.px[h], c.py[h] + 0.4, c.pz[h]);
      if (c.stamina > 0 && STATE[headT] === LIQUID) {
        c.oy[h] -= GRAVITY * 1.9; c.oy[n] -= GRAVITY * 1.3;
      }
      c.stamina--;
      if (c.speed > 0) { c.ox[k0] -= fx * 0.02; c.oz[k0] -= fz * 0.02; }
    } else if (c.grounded) c.stamina = Math.min(600, c.stamina + 3);

    const speed = c.grounded ? c.speed * (inLiquid ? 0.55 : 1) : 0;
    if (speed > 0.005) c.phase += speed * 0.9;
    const stride = Math.min(sp.flaps ? 0.7 : 1.7, speed * 22), lift = Math.min(1, speed * 12);
    const laneZ = c.lane;
    // In the air the pose is held around the hips, so it moves with them.
    const air = ground < 0;
    const rvx = air ? rx - c.ox[k0] : 0, rvy = air ? ry - c.oy[k0] : 0, rvz = air ? rz - c.oz[k0] : 0;
    const bob = speed > 0.005 ? 0 : 0.08 * Math.sin(c.age * 0.05);
    for (let k = 0; k < c.n; k++) {
      if (c.detached[k]) continue;
      const P = sp.points[k];
      let F = P[1], U = P[2];
      const S = P[3];
      if (P[8]) {
        const ph = c.phase + (P[9] ? Math.PI : 0);
        const sn = Math.sin(ph), up = Math.max(0, Math.cos(ph));
        if (P[8] === 'foot') { F += stride * sn; U += lift * up; }
        else if (P[8] === 'knee') { F += stride * 0.5 * sn; U += lift * 0.5 * up; }
        else if (P[8] === 'hand') F -= stride * 0.8 * sn;
        else F -= stride * 0.4 * sn;
      }
      if (k === k0) U += bob;
      const tx = rx + fx * F + sx * S;
      const ty = base + U;
      const tz = (laneZ != null ? laneZ : rz) + fz * F + sz * S;
      let m = P[7] * c.strength * support;
      if (k === k0 && ground < 0) continue;
      let vx = c.px[k] - c.ox[k], vy = c.py[k] - c.oy[k], vz = c.pz[k] - c.oz[k];
      const gx = (tx - c.px[k]) * 0.35 + fx * speed + rvx, gy = (ty - c.py[k]) * 0.35 + rvy, gz = (tz - c.pz[k]) * 0.35 + fz * speed + rvz;
      if (c.swimming) m *= 0.5;
      vx += (gx - vx) * m; vy += (gy - vy) * m; vz += (gz - vz) * m;
      c.ox[k] = c.px[k] - vx; c.oy[k] = c.py[k] - vy; c.oz[k] = c.pz[k] - vz;
    }
  }

  // Fish: in water they hold a straight body and beat the tail; out of
  // water they can only flop.
  swim(c, fx, fz, sx, sz) {
    const sp = c.sp, h = sp.headK, k0 = sp.rootK;
    const ht = this.cellType(c.px[h], c.py[h], c.pz[h]);
    if (ht !== WATER && ht !== BRINE) {
      const lying = HARD_CELL[this.cellType(c.px[k0], c.py[k0] - c.r[k0] - 0.3, c.pz[k0])] || HARD_CELL[this.cellType(c.px[h], c.py[h] - c.r[h] - 0.3, c.pz[h])];
      if (lying && Math.random() < 0.035) {
        const kick = 0.16 + Math.random() * 0.12, side = Math.random() < 0.5 ? -1 : 1;
        for (let k = 0; k < c.n; k++) { c.oy[k] -= kick * (k === 0 || k === c.n - 1 ? 1.2 : 0.8); c.ox[k] -= side * 0.06 * (k - 1.5); }
      }
      return;
    }
    c.phase += 0.25;
    const rx = c.px[k0], ry = c.py[k0], rz = c.lane ?? c.pz[k0];
    for (let k = 0; k < c.n; k++) {
      const F = sp.rest[k][0];
      const wig = k >= 2 ? Math.sin(c.phase - k) * 0.35 * (k - 1) : 0;
      const tx = rx + fx * F + sx * wig, ty = ry, tz = rz + fz * F + sz * wig;
      let vx = c.px[k] - c.ox[k], vy = c.py[k] - c.oy[k], vz = c.pz[k] - c.oz[k];
      const gx = (tx - c.px[k]) * 0.35 + fx * c.speed, gy = (ty - c.py[k]) * 0.35 + c.swimDY, gz = (tz - c.pz[k]) * 0.35 + fz * c.speed;
      const m = 0.3 * c.strength;
      vx += (gx - vx) * m; vy += (gy - vy) * m; vz += (gz - vz) * m;
      c.ox[k] = c.px[k] - vx; c.oy[k] = c.py[k] - vy; c.oz[k] = c.pz[k] - vz;
    }
  }

  // Held, knocked out or dying: arms and legs twitch a little.
  flail(c) {
    if (!c.alive || Math.random() > (c.grab ? 0.25 : 0.05)) return;
    const k = (Math.random() * c.n) | 0;
    if (c.limb[k] === CORE) return;
    c.ox[k] += (Math.random() - 0.5) * 0.25; c.oy[k] += (Math.random() - 0.5) * 0.25;
  }

  // ----- behaviour -----
  think(c) {
    const sp = c.sp;
    if ((c.age + c.id) % 5 !== 0) return;
    if (c.stun > 0 || c.grab) { c.speed = 0; return; }
    const w = this.world;
    const k0 = sp.rootK, h = sp.headK;
    const hx = c.px[h], hy = c.py[h], hz = c.pz[h];
    let fear = this.sense(c), prey = null;

    if (sp.hunts) prey = this.nearest(c, o => o.alive && o.kind === sp.hunts, 40);
    if (c.kind === 'human') {
      const z = this.nearest(c, o => o.alive && o.kind === 'zombie', 16);
      if (z) fear = { x: (fear ? fear.x : 0) + (hx - z.px[z.sp.headK]) * 2, z: (fear ? fear.z : 0) + (hz - z.pz[z.sp.headK]) * 2 };
    }
    if (sp.skittish) {
      const o = this.nearest(c, o => o.alive && o !== c && o.kind !== c.kind, 7);
      if (o) fear = { x: (fear ? fear.x : 0) + hx - o.px[o.sp.rootK], z: (fear ? fear.z : 0) + hz - o.pz[o.sp.rootK] };
    }
    const lane = c.lane != null;
    const setHeading = (dx, dz) => {
      if (lane) c.heading = dx >= 0 ? 0 : Math.PI;
      else c.heading = Math.atan2(dz, dx);
    };

    if (sp.swimmer) {
      c.speed = sp.walk;
      c.moodT -= 5;
      const up = this.cellType(hx, hy + 1.2, hz), down = this.cellType(hx, hy - 1.2, hz);
      if (up !== WATER && up !== BRINE) c.swimDY = -0.01;
      else if (HARD_CELL[down]) c.swimDY = 0.01;
      else if (c.moodT <= 0) { c.swimDY = (Math.random() - 0.5) * 0.02; }
      if (fear) { setHeading(fear.x, fear.z); c.speed = sp.run; c.mood = 'flee'; }
      else if (c.moodT <= 0) {
        c.moodT = 100 + Math.random() * 200;
        if (!lane) c.heading += (Math.random() - 0.5) * 2;
        else if (Math.random() < 0.3) c.heading += Math.PI;
      }
      const ahead = this.cellType(hx + Math.cos(c.heading) * 1.6, hy, hz + Math.sin(c.heading) * 1.6);
      if (ahead !== WATER && ahead !== BRINE) c.heading += lane ? Math.PI : Math.PI * (0.6 + Math.random() * 0.8);
      return;
    }

    if (c.fire > 0) {
      // On fire: run about in a panic.
      c.mood = 'panic'; c.speed = sp.run;
      if (c.moodT <= 0 || Math.random() < 0.1) { setHeading(Math.random() - 0.5, Math.random() - 0.5); c.moodT = 40; }
      c.moodT -= 5;
    } else if (fear) {
      setHeading(fear.x, fear.z); c.speed = sp.run; c.mood = 'flee'; c.moodT = 40;
    } else if (prey) {
      const p = prey.sp.rootK;
      setHeading(prey.px[p] - c.px[k0], prey.pz[p] - c.pz[k0]);
      c.speed = sp.run; c.mood = 'hunt';
      // Bite when close enough.
      if (c.biteT <= 0) {
        for (let k = 0; k < prey.n; k++) {
          if (Math.hypot(prey.px[k] - hx, prey.py[k] - hy, prey.pz[k] - hz) < 2.2) {
            c.biteT = 40;
            if (!prey.infected) prey.infected = 220;
            this.hurt(prey, 9, k, 'bite', 9);
            break;
          }
        }
      }
    } else {
      c.moodT -= 5;
      if (c.mood === 'flee' || c.mood === 'panic' || c.mood === 'hunt') c.moodT = 0;
      if (c.moodT <= 0) {
        if (Math.random() < 0.35) { c.mood = 'idle'; c.speed = 0; c.moodT = 60 + Math.random() * 160; }
        else {
          c.mood = 'walk'; c.speed = sp.walk; c.moodT = 120 + Math.random() * 300;
          if (lane) { if (Math.random() < 0.35) c.heading += Math.PI; }
          else c.heading += (Math.random() - 0.5) * 2.4;
        }
      }
    }

    // Turn back at walls, big drops and the edge of the world.
    if (c.speed > 0 && c.grounded && !c.swimming) {
      const fx = Math.cos(c.heading), fz = Math.sin(c.heading);
      const ax = c.px[k0] + fx * 2.2, az = c.pz[k0] + fz * 2.2;
      const foot = c.py[k0] - sp.rest[k0][1];
      let blocked = ax < 2 || ax > w.W - 2 || az < 1 || az > w.D - 1;
      for (let u = 3; u < sp.height && !blocked; u += 1.5) if (HARD_CELL[this.cellType(ax, foot + u, az)]) blocked = true;
      const panicky = c.mood === 'flee' || c.mood === 'panic';
      if (!blocked && !panicky && this.groundBelow(ax, foot + 1, az, 8) < 0 && STATE[this.cellType(ax, foot - 1, az)] !== LIQUID) blocked = true;
      if (blocked) {
        if (lane) c.heading += Math.PI;
        else c.heading += Math.PI * (0.6 + Math.random() * 0.8);
        c.moodT = Math.max(c.moodT, 30);
      }
    }
  }

  // Look around the head for fire, lava and heat. Returns which way is away
  // from danger, or null.
  sense(c) {
    const w = this.world, type = w.type, temp = w.temp;
    const h = c.sp.headK;
    const hx = Math.floor(c.px[h]), hy = Math.floor(c.py[h] - 3), hz = Math.floor(c.pz[h]);
    const R = 9, robot = c.kind === 'robot';
    const zs = c.lane != null ? [-2, 0, 2] : [-8, -6, -4, -2, 0, 2, 4, 6, 8];
    let ax = 0, az = 0, n = 0;
    for (const dz of zs) {
      const z = hz + dz; if (z < 0 || z >= w.D) continue;
      for (let dy = -4; dy <= 8; dy += 2) {
        const y = hy + dy; if (y < 0 || y >= w.H) continue;
        for (let dx = -R; dx <= R; dx += 2) {
          const x = hx + dx; if (x < 0 || x >= w.W) continue;
          const i = x + w.W * (z + w.D * y);
          const t = type[i];
          const bad = t === LAVA || t === MOLTEN || (!robot && (t === FIRE || temp[i] > 120));
          if (!bad) continue;
          const d2 = dx * dx + dy * dy + dz * dz + 1;
          ax -= dx / d2; az -= dz / d2; n++;
        }
      }
    }
    if (!n) return null;
    if (Math.abs(ax) < 1e-3 && Math.abs(az) < 1e-3) ax = Math.random() - 0.5;
    return { x: ax, z: az };
  }

  nearest(c, test, maxD) {
    const k = c.sp.rootK;
    let best = null, bd = maxD;
    for (const o of this.list) {
      if (o === c || !test(o)) continue;
      const j = o.sp.rootK;
      if (c.lane != null && Math.abs(o.pz[j] - c.pz[k]) > 3) continue;
      const d = Math.hypot(o.px[j] - c.px[k], o.py[j] - c.py[k], o.pz[j] - c.pz[k]);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ----- what the world does to a body -----
  environment(c) {
    const w = this.world, sp = c.sp, type = w.type, temp = w.temp;
    let maxT = -999, minT = 999, inLava = 0, inAcid = 0, inFire = 0, doused = false, embedded = 0;
    for (let k = 0; k < c.n; k++) {
      const i = this.cellIndex(c.px[k], c.py[k], c.pz[k]);
      if (i < 0) continue;
      const t = type[i], T = temp[i];
      if (T > maxT) maxT = T;
      if (T < minT) minT = T;
      if (t === FIRE) inFire++;
      else if (t === LAVA || t === MOLTEN) inLava++;
      else if (t === ACID) {
        inAcid++;
        c.wound[k] += 0.05 * sp.acid;
        if (Math.random() < 0.01) w.set(i, SMOKE, T + 10);
      } else if (DOUSES[t]) doused = true;
      if (HARD_CELL[t]) embedded++;
    }

    // Fire.
    if (sp.burns && !doused && c.fire <= 0 && (inLava || ((inFire || maxT > 280) && Math.random() < 0.12))) {
      c.fire = 450 + Math.random() * 300;
      if (c.alive) w.discover(DISC.ON_FIRE);
    }
    if (c.fire > 0) {
      if (doused) c.fire = 0;
      else {
        c.fire--;
        c.char = Math.min(1, c.char + 0.0016 * sp.burns);
        if (c.alive) this.hurt(c, 0.16 * sp.burns, -1, 'fire');
        // Flames rise from the body and heat what it touches.
        const k = (Math.random() * c.n) | 0;
        const up = this.cellIndex(c.px[k], c.py[k] + 1, c.pz[k]);
        if (up >= 0 && type[up] === EMPTY && Math.random() < 0.3) w.set(up, FIRE);
        const at = this.cellIndex(c.px[k], c.py[k] - 0.6, c.pz[k]);
        if (at >= 0 && temp[at] < 420) { temp[at] = 420; w.heatAct[w.chunkOf[at]] = 1; }
        if (!c.alive && c.char >= 1) c.fire = 0;
      }
    }
    if (inLava) {
      c.char = Math.min(1, c.char + 0.006 * inLava);
      if (c.alive) this.hurt(c, inLava * (c.kind === 'robot' ? 0.45 : 1.1), -1, 'lava');
    }
    if (!c.alive) return;
    if (maxT > sp.heatMax) this.hurt(c, Math.min(1.2, (maxT - sp.heatMax) * 0.004), -1, 'heat');
    if (minT < -20 && sp.breathes) this.hurt(c, 0.03, -1, 'cold');
    if (inAcid) this.hurt(c, inAcid * 0.05 * sp.acid, -1, 'acid');

    // Breathing.
    const h = sp.headK;
    if (sp.breathes) {
      const ht = this.cellType(c.px[h], c.py[h] + 0.3, c.pz[h]);
      const ok = sp.breathes === 'water' ? ht === WATER || ht === BRINE : STATE[ht] !== LIQUID && !HARD_CELL[ht] && !this.buried(c);
      if (ok) c.oxygen = Math.min(sp.breathes === 'water' ? 500 : 400, c.oxygen + 4);
      else {
        c.oxygen--;
        if (sp.breathes === 'water' && c.oxygen < 250) w.discover(DISC.GASP);
        if (c.oxygen <= 0) this.hurt(c, 0.4, -1, sp.breathes === 'water' ? 'gasp' : HARD_CELL[ht] || this.buried(c) ? 'buried' : 'drown');
      }
      if (c.kind === 'human' && !c.swimming && ok && STATE[this.cellType(c.px[sp.rootK], c.py[sp.rootK], c.pz[sp.rootK])] === LIQUID
        && this.cellType(c.px[sp.rootK], c.py[sp.rootK], c.pz[sp.rootK]) === BRINE && !c.grounded) w.discover(DISC.SALT_FLOAT);
    }

    // Weight on top, or stuck inside something solid.
    if ((c.age + c.id) % 3 === 0) {
      let load = 0, lk = sp.rootK;
      for (const k of [sp.headK, sp.neckK, sp.rootK]) {
        const l = this.loadAbove(c.px[k], c.py[k] + c.r[k] + 0.2, c.pz[k]);
        if (l > load) { load = l; lk = k; }
      }
      if (load > 2.5) {
        for (let k = 0; k < c.n; k++) c.oy[k] += Math.min(0.06, load * 0.004);
        this.hurt(c, (load - 2.5) * 0.4, lk, 'crush');
      }
      if (embedded >= 2) this.hurt(c, embedded * 1.2, lk, 'crush');
    }

    // A zombie bite turns a person after a while, even after death.
    if (c.infected > 0 && --c.infected === 0) this.turnZombie(c);
  }

  // Head boxed in on every side by powder or solid: buried alive.
  buried(c) {
    const h = c.sp.headK, x = c.px[h], y = c.py[h], z = c.pz[h], R = c.r[h] + 0.6;
    return HARD_CELL[this.cellType(x, y + R, z)] && HARD_CELL[this.cellType(x + R, y, z)] && HARD_CELL[this.cellType(x - R, y, z)]
      && (this.world.D < 2 || (HARD_CELL[this.cellType(x, y, z + R)] && HARD_CELL[this.cellType(x, y, z - R)]));
  }

  // How heavy is the column of powder and solid resting above (x, y, z),
  // in units of about one cell of stone.
  loadAbove(x, y, z) {
    const w = this.world;
    let load = 0;
    for (let k = 0; k < 30; k++) {
      const t = this.cellType(x, y + k, z);
      if (!HARD_CELL[t]) break;
      load += DENS[t] / 2000;
    }
    return load;
  }

  // ----- damage -----
  // amount: health lost. k: the point that was hit (-1 for the whole body).
  // jolt: a big hit knocks the creature out for a moment.
  hurt(c, amount, k, cause, jolt = 0) {
    if (amount <= 0) return;
    const sp = c.sp;
    if (k >= 0) c.wound[k] += amount;
    if (!c.alive) {
      if (this.gore && jolt > 40 && k >= 0 && c.limb[k] !== CORE && Math.random() < 0.5) this.detach(c, c.limb[k]);
      return;
    }
    c.hp -= amount;
    c.cause = cause;
    if (amount >= 1 || jolt > 0) { c.hurtT = 150; c.hurtFlash = Math.max(c.hurtFlash, jolt > 4 ? 8 : 3); }
    if (jolt > 6) c.stun = Math.max(c.stun, Math.min(140, jolt * 3));
    if (this.gore && sp.bleeds) {
      const n = jolt > 0 ? Math.min(6, Math.round(jolt / 7)) : k >= 0 && Math.random() < amount * 0.15 ? 1 : 0;
      if (n) this.bleed(c, k >= 0 ? k : sp.rootK, n);
      if (jolt > 45 && k >= 0 && c.limb[k] !== CORE && Math.random() < 0.4) this.detach(c, c.limb[k]);
    }
    if (c.hp <= 0) this.die(c);
  }

  die(c) {
    c.alive = false; c.hp = 0; c.strength = 0; c.speed = 0; c.mood = 'dead';
    const w = this.world;
    if (c.cause === 'drown') w.discover(DISC.DROWN);
    else if (c.cause === 'crush' || c.cause === 'buried') w.discover(DISC.CRUSH);
  }

  // Splash blood (or oil, for a robot) into empty cells around point k.
  bleed(c, k, n) {
    const w = this.world, t = c.sp.bleeds;
    for (let j = 0; j < n; j++) {
      const i = this.cellIndex(c.px[k] + (Math.random() - 0.5) * 2.4, c.py[k] + (Math.random() - 0.3) * 2, c.pz[k] + (Math.random() - 0.5) * 2.4);
      if (i >= 0 && w.type[i] === EMPTY) w.set(i, t);
    }
  }

  // A limb comes off: break every stick joining it to the rest of the body.
  detach(c, limb) {
    if (limb === CORE) return;
    let broke = false;
    for (const s of c.sticks) {
      if (s.broken) continue;
      if ((c.limb[s.a] === limb) !== (c.limb[s.b] === limb)) { s.broken = true; s.bleed = 120; broke = true; }
    }
    if (!broke) return;
    for (let k = 0; k < c.n; k++) if (c.limb[k] === limb) c.detached[k] = 1;
    if (limb === HEAD && c.alive) { c.cause = 'blast'; this.die(c); }
    const legs = c.detached[c.sp.idx.footL] && c.detached[c.sp.idx.footR];
    if (legs && c.alive) c.stun = 1e9; // cannot stand any more
  }

  turnZombie(c) {
    if (c.kind !== 'human' || c.char > 0.6 || c.detached[c.sp.headK]) return;
    const z = SPECIES.zombie;
    c.kind = 'zombie'; c.sp = z;
    c.colors = z.colors(Math.random, c.colors);
    c.hp = z.hp * (c.alive ? 1 : 0.6); c.alive = true; c.stun = 60; c.fire = 0; c.mood = 'walk';
    this.world.discover(DISC.INFECTION);
  }

  // Ongoing bleeding from wounds and lost limbs.
  ooze(c) {
    if (!this.gore || !c.sp.bleeds) return;
    for (const s of c.sticks) {
      if (!s.broken || s.bleed <= 0) continue;
      s.bleed--;
      if (Math.random() < 0.06) this.bleed(c, c.detached[s.a] ? s.b : s.a, 1);
    }
    if (c.alive && c.hp < c.sp.hp * 0.5 && Math.random() < 0.01) this.bleed(c, c.sp.rootK, 1);
  }

  // ----- marking bodies in the grid -----
  // The cells along each visible part of every body become BODY while the
  // world steps, so falling and flowing things treat bodies as solid.
  stamp() {
    const w = this.world, type = w.type, W = w.W, D = w.D, H = w.H, was = this.was;
    // Swap lists: last step's cells are kept to see which ones the bodies left.
    const prev = this.stamped;
    const st = this.stamped = this.prevStamped;
    this.prevStamped = prev;
    st.length = 0;
    this.owner.clear();
    // Every cell a part overlaps, so nothing can settle into the body.
    const mark = (x, y, z, r, tag) => {
      const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.floor(x + r));
      const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.floor(y + r));
      const z0 = Math.max(0, Math.floor(z - r)), z1 = Math.min(D - 1, Math.floor(z + r));
      for (let iy = y0; iy <= y1; iy++) for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
        const i = ix + W * (iz + D * iy);
        if (type[i] !== EMPTY) continue;
        type[i] = BODY;
        st.push(i);
        this.owner.set(i, tag);
        if (was[i] === 1) was[i] = 2;   // still covered
        else this.wake(i);              // newly covered
      }
    };
    for (const c of this.list) {
      this.ooze(c);
      const id = c.id << 8;
      for (const s of c.sticks) {
        if (s.broken || !s.thick) continue;
        const ax = c.px[s.a], ay = c.py[s.a], az = c.pz[s.a];
        const dx = c.px[s.b] - ax, dy = c.py[s.b] - ay, dz = c.pz[s.b] - az;
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) * 1.5));
        const r = Math.min(0.55, s.thick * 0.45);
        for (let j = 0; j <= n; j++) mark(ax + dx * j / n, ay + dy * j / n, az + dz * j / n, r, id | (j * 2 < n ? s.a : s.b));
      }
      const h = c.sp.headK;
      mark(c.px[h], c.py[h], c.pz[h], c.r[h] * 0.9, id | h);
    }
    // Cells a body has just left: what rests on them or beside them may move now.
    for (const i of prev) {
      if (was[i] !== 2) this.wake(i);
      was[i] = 0;
    }
    for (const i of st) was[i] = 1;
  }

  wake(i) {
    const w = this.world, fl = w.flags, near = w.near;
    for (let k = 0; k < near.length; k++) fl[i + near[k]] &= ~RESTING;
    w.awakeNext[w.chunkOf[i]] = 1;
  }

  unstamp() {
    const type = this.world.type;
    for (const i of this.stamped) if (type[i] === BODY) type[i] = EMPTY;
  }

  // One full tick: creatures move, then the world moves around them.
  tick() {
    this.step();
    this.stamp();
    this.world.step();
    this.unstamp();
  }

  // ----- the mouse -----
  // Nearest body point to (x, y, z) within maxD. In the side view only depth
  // near the slice counts, and distance is measured in the slice plane.
  pickPoint(x, y, z, maxD, slice = false) {
    let best = null, bd = maxD;
    for (const c of this.list) {
      for (let k = 0; k < c.n; k++) {
        if (slice && Math.abs(c.pz[k] - z) > 3.5) continue;
        const d = slice ? Math.hypot(c.px[k] - x, c.py[k] - y) : Math.hypot(c.px[k] - x, c.py[k] - y, c.pz[k] - z);
        if (d < bd) { bd = d; best = { c, k }; }
      }
    }
    return best;
  }

  // Nearest body point to a ray (origin o, unit direction d, in cell units)
  // that is closer than maxT along it.
  pickRay(o, d, maxT, maxD = 1.6) {
    let best = null, bd = maxD;
    for (const c of this.list) {
      for (let k = 0; k < c.n; k++) {
        const vx = c.px[k] - o[0], vy = c.py[k] - o[1], vz = c.pz[k] - o[2];
        const t = vx * d[0] + vy * d[1] + vz * d[2];
        if (t < 0 || t > maxT) continue;
        const dist = Math.hypot(vx - d[0] * t, vy - d[1] * t, vz - d[2] * t) - c.r[k];
        if (dist < bd) { bd = dist; best = { c, k, t }; }
      }
    }
    return best;
  }

  startGrab(c, k) {
    c.grab = { k, x: c.px[k], y: c.py[k], z: c.pz[k] };
    if (c.alive) { c.mood = 'panic'; c.hurtT = 150; }
  }
  moveGrab(c, x, y, z) { if (c.grab) { c.grab.x = x; c.grab.y = y; c.grab.z = z; } }
  release(c) { if (c) { c.grab = null; c.stun = Math.max(c.stun, 25); } }

  // The eraser removes any creature it touches.
  eraseAt(x, y, z, r, slice = false) {
    for (let j = this.list.length - 1; j >= 0; j--) {
      const c = this.list[j];
      for (let k = 0; k < c.n; k++) {
        const dz = slice ? (Math.abs(c.pz[k] - z) <= 3.5 ? 0 : 99) : c.pz[k] - z;
        if (Math.hypot(c.px[k] - x, c.py[k] - y, dz) <= r + 0.8) { this.list.splice(j, 1); break; }
      }
    }
  }

  // Short status text for the inspector.
  describe(c) {
    const bits = [c.sp.name];
    if (!c.alive) bits.push(c.char >= 0.6 ? 'charred' : 'dead');
    else {
      bits.push(`${Math.max(1, Math.round(c.hp))}/${c.sp.hp} HP`);
      if (c.fire > 0) bits.push('burning');
      else if (c.sp.breathes && c.oxygen < 200) bits.push(c.sp.breathes === 'water' ? 'gasping' : 'out of breath');
      else if (c.infected) bits.push('bitten');
      else if (c.swimming) bits.push('swimming');
      else if (c.stun > 0 && !c.grab) bits.push('knocked out');
      else if (c.mood === 'flee' || c.mood === 'panic') bits.push('scared');
    }
    return bits.join(' · ');
  }
}

// A creature standing in its rest pose with fixed colours, for icons.
export function iconCreature(kind) {
  let a = 7 + kind.length * 31;
  const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  return new Creature(kind, 0, 0, 0, 0, null, SPECIES[kind].colors(rand));
}
