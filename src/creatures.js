// Creatures: little ragdolls that live in the world.
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
  SMOKE, HONEY, DISC, RUBBER, CACTUS, CO2, URANIUM, PLANT, LYE,
} = El;

const GRAVITY = 0.035;    // cells per step²: 9.8 m/s² when a cell is about 17 cm and a step is 1/50 s
const MAX_V = 2.5;        // fastest a point can move, cells per step
const ITERATIONS = 3;     // stick and collision passes per step
const MAX_CREATURES = 40;
const RESTING = 16;       // world flag bit for a resting liquid (see world.js)
const FALL_HURTS = 1.0;   // impact speed (cells per step) above which a landing hurts

// Body part groups, so a limb can come off as one piece. The left limbs are
// on the far side of the body and drawn behind it.
export const CORE = 0, HEAD = 1, ARM_L = 2, ARM_R = 3, LEG_L = 4, LEG_R = 5, TAIL = 6;
export const FAR_SIDE = new Uint8Array([0, 0, 1, 0, 1, 0, 0]);

const HARD_CELL = new Uint8Array(El.COUNT);
for (let t = 1; t < El.COUNT; t++) HARD_CELL[t] = (STATE[t] === SOLID || STATE[t] === POWDER) && t !== BODY ? 1 : 0;
// Solids you can still breathe through (leaves let air in).
const AIRY_SOLID = new Uint8Array(El.COUNT);
AIRY_SOLID[El.PLANT] = 1;
// Liquids that put out a burning body.
const DOUSES = new Uint8Array(El.COUNT);
for (const t of [WATER, BRINE, BLOOD, HONEY, El.MUD]) DOUSES[t] = 1;

const pick = (rand, a) => a[(rand() * a.length) | 0];

// ----- species -----
// A point: [name, forward, up, radius, mass, limb, muscle, gait, gait phase]
// forward/up place it in the standing pose; up is the height above the
// ground. muscle: how hard it is pulled toward that pose. gait: how it moves
// while walking (a foot, knee, hand or elbow), and phase 0 or 1 is half a
// stride apart.
// A stick: [a, b, thickness (0 = an invisible brace), colour, stiffness].
function biped(armsForward) {
  const hand = armsForward ? [2.5, 7.1] : [0.35, 4.6], elbow = armsForward ? [1.3, 7.2] : [0.05, 6.1];
  const arm = armsForward ? 0.12 : 0.07;
  return {
    points: [
      ['head', 0.15, 9.1, 1.0, 1.2, HEAD, 0.3],
      ['neck', 0, 7.7, 0.55, 1.5, CORE, 0.3],
      ['hips', 0, 4.7, 0.6, 1.8, CORE, 0.35],
      ['kneeL', 0.35, 2.5, 0.5, 0.8, LEG_L, 0.18, 'knee', 0],
      ['footL', 0, 0.5, 0.5, 0.8, LEG_L, 0.25, 'foot', 0],
      ['kneeR', 0.35, 2.5, 0.5, 0.8, LEG_R, 0.18, 'knee', 1],
      ['footR', 0, 0.5, 0.5, 0.8, LEG_R, 0.25, 'foot', 1],
      ['elbowL', elbow[0], elbow[1], 0.45, 0.6, ARM_L, arm, 'elbow', 1],
      ['handL', hand[0], hand[1], 0.45, 0.5, ARM_L, arm, 'hand', 1],
      ['elbowR', elbow[0], elbow[1], 0.45, 0.6, ARM_R, arm, 'elbow', 0],
      ['handR', hand[0], hand[1], 0.45, 0.5, ARM_R, arm, 'hand', 0],
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
      ['body', 0, 2.3, 0.75, 1.5, CORE, 0.35],
      ['chest', 0.9, 2.6, 0.65, 1.0, CORE, 0.3],
      ['head', 1.45, 3.9, 0.6, 0.6, HEAD, 0.3],
      ['tail', -1.1, 3.0, 0.5, 0.4, TAIL, 0.2],
      ['footL', 0.1, 0.35, 0.35, 0.3, LEG_L, 0.25, 'foot', 0],
      ['footR', 0.1, 0.35, 0.35, 0.3, LEG_R, 0.25, 'foot', 1],
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
      ['head', 1.4, 0, 0.55, 1.0, HEAD, 0.3],
      ['mid', 0.3, 0, 0.6, 1.2, CORE, 0.3],
      ['tailBase', -0.85, 0, 0.45, 0.8, TAIL, 0.3],
      ['tailTip', -1.75, 0, 0.4, 0.4, TAIL, 0.25],
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
  dog: {
    name: 'Dog', density: 1000, hp: 70, breathes: 'air', burns: 1.1, bleeds: BLOOD,
    walk: 0.08, run: 0.2, swims: true, heatMax: 55, acid: 1, head: 'dog', chases: 'chicken',
    desc: 'Trots about and loves chasing chickens. Runs from fire and paddles when it falls in water.',
    points: [
      ['hips', -1.0, 2.7, 0.6, 1.4, CORE, 0.35],
      ['chest', 1.0, 2.9, 0.65, 1.4, CORE, 0.35],
      ['head', 2.0, 3.9, 0.6, 0.8, HEAD, 0.3],
      ['tail', -2.1, 3.5, 0.35, 0.3, TAIL, 0.15],
      ['frontL', 1.15, 0.4, 0.4, 0.5, LEG_L, 0.25, 'foot', 0],
      ['frontR', 0.85, 0.4, 0.4, 0.5, LEG_R, 0.25, 'foot', 1],
      ['backL', -1.15, 0.4, 0.4, 0.5, LEG_L, 0.25, 'foot', 1],
      ['backR', -0.85, 0.4, 0.4, 0.5, LEG_R, 0.25, 'foot', 0],
    ],
    sticks: [
      ['hips', 'chest', 1.7, 'body'], ['chest', 'head', 0.9, 'body'], ['hips', 'tail', 0.45, 'tail'],
      ['chest', 'frontL', 0.55, 'leg'], ['chest', 'frontR', 0.55, 'leg'], ['hips', 'backL', 0.55, 'leg'], ['hips', 'backR', 0.55, 'leg'],
      ['head', 'hips', 0, null, 0.5], ['tail', 'chest', 0, null, 0.4],
      ['frontL', 'hips', 0, null, 0.3], ['frontR', 'hips', 0, null, 0.3], ['backL', 'chest', 0, null, 0.3], ['backR', 'chest', 0, null, 0.3],
    ],
    dots: [],
    root: 'hips', headPt: 'head', neckPt: 'chest', headR: 0.72, walker: true,
    colors(rand) {
      const c = pick(rand, [['#b07a42', '#8a5a2e', '#5a3a1e'], ['#e0b46a', '#c49450', '#8a6234'], ['#3a3330', '#2a2421', '#d8cfc4'], ['#f0ebe2', '#d8d0c4', '#8a7a6a']]);
      return { body: c[0], leg: c[1], tail: c[0], ear: c[2], nose: '#1a1410', eye: '#1a1410' };
    },
  },
  bird: {
    name: 'Bird', density: 400, hp: 15, breathes: 'air', burns: 1.2, bleeds: BLOOD,
    walk: 0.03, run: 0.16, swims: false, heatMax: 50, acid: 1, head: 'bird', flaps: true, flies: true, skittish: true,
    desc: 'Flies between perches and takes off at the first sign of trouble. Glides down gently.',
    points: [
      ['body', 0, 1.3, 0.5, 1.0, CORE, 0.35],
      ['head', 0.75, 1.9, 0.42, 0.5, HEAD, 0.3],
      ['tail', -0.9, 1.4, 0.3, 0.3, TAIL, 0.25],
      ['foot', 0.05, 0.25, 0.25, 0.3, LEG_L, 0.25, 'foot', 0],
    ],
    sticks: [
      ['body', 'head', 0.9, 'body'], ['body', 'tail', 0.7, 'tail'], ['body', 'foot', 0.2, 'leg'],
      ['head', 'tail', 0, null, 0.5], ['foot', 'head', 0, null, 0.3],
    ],
    dots: [],
    root: 'body', headPt: 'head', neckPt: 'body', headR: 0.48, walker: true,
    colors(rand) {
      const c = pick(rand, [['#4a7ac8', '#2a4a8a'], ['#c84a3a', '#5a3a2a'], ['#8a6a4a', '#5a4430'], ['#e8c840', '#3a3a3a']]);
      return { body: c[0], tail: c[1], leg: '#d8a040', beak: '#e8a33a', eye: '#1a1410' };
    },
  },
  frog: {
    name: 'Frog', density: 1050, hp: 25, breathes: 'both', burns: 1, bleeds: BLOOD,
    walk: 0.04, run: 0.1, swims: true, heatMax: 45, acid: 1.5, head: 'frog', hops: true, skittish: true,
    desc: 'Hops about and swims. Breathes air or water, so it never drowns. Delicate skin: acid hurts it more.',
    points: [
      ['body', 0, 0.9, 0.55, 1.0, CORE, 0.35],
      ['head', 0.75, 1.2, 0.5, 0.6, HEAD, 0.3],
      ['backFoot', -0.55, 0.25, 0.3, 0.4, LEG_L, 0.25],
      ['frontFoot', 0.55, 0.25, 0.3, 0.4, LEG_R, 0.25],
    ],
    sticks: [
      ['body', 'head', 1.3, 'body'], ['body', 'backFoot', 0.5, 'leg'], ['body', 'frontFoot', 0.35, 'leg'],
      ['head', 'backFoot', 0, null, 0.4], ['frontFoot', 'backFoot', 0, null, 0.3],
    ],
    dots: [],
    root: 'body', headPt: 'head', neckPt: 'body', headR: 0.62, walker: true,
    colors(rand) {
      const c = pick(rand, [['#5aa83a', '#3e8a2a'], ['#7ab84a', '#4e8a30'], ['#4a9a6a', '#2e7a4a']]);
      return { body: c[0], leg: c[1], belly: '#d8e8a0', eye: '#1a1410' };
    },
  },
};
// Four-legged animals share one skeleton, scaled.
function quadruped(len, height, head) {
  const f = len / 2;
  return {
    points: [
      ['hips', -f, height, 0.6, 1.4, CORE, 0.35],
      ['chest', f, height + 0.2, 0.65, 1.4, CORE, 0.35],
      ['head', f + head[0], height + head[1], 0.6, 0.8, HEAD, 0.3],
      ['tail', -f - 0.9, height + 0.5, 0.35, 0.3, TAIL, 0.15],
      ['frontL', f + 0.15, 0.4, 0.4, 0.5, LEG_L, 0.25, 'foot', 0],
      ['frontR', f - 0.15, 0.4, 0.4, 0.5, LEG_R, 0.25, 'foot', 1],
      ['backL', -f - 0.15, 0.4, 0.4, 0.5, LEG_L, 0.25, 'foot', 1],
      ['backR', -f + 0.15, 0.4, 0.4, 0.5, LEG_R, 0.25, 'foot', 0],
    ],
    sticks: [
      ['chest', 'head', 0.8, 'body'], ['hips', 'tail', 0.45, 'tail'],
      ['chest', 'frontL', 0.5, 'leg'], ['chest', 'frontR', 0.5, 'leg'], ['hips', 'backL', 0.5, 'leg'], ['hips', 'backR', 0.5, 'leg'],
      ['head', 'hips', 0, null, 0.5], ['tail', 'chest', 0, null, 0.4],
      ['frontL', 'hips', 0, null, 0.3], ['frontR', 'hips', 0, null, 0.3], ['backL', 'chest', 0, null, 0.3], ['backR', 'chest', 0, null, 0.3],
    ],
    dots: [],
    root: 'hips', headPt: 'head', neckPt: 'chest', headR: 0.7, walker: true,
  };
}
{
  const sheep = quadruped(2.2, 2.6, [1.0, 0.7]);
  sheep.sticks.unshift(['hips', 'chest', 2.6, 'wool']);
  SPECIES.sheep = {
    ...sheep, name: 'Sheep', density: 950, hp: 60, breathes: 'air', burns: 1.6, bleeds: BLOOD,
    walk: 0.035, run: 0.13, swims: true, heatMax: 50, acid: 1, head: 'sheep', grazes: true, fears: 'dog',
    desc: 'Grazes on grass, leaves and bushes, and runs from dogs. Its thick wool catches fire very easily.',
    colors(rand) {
      const wool = pick(rand, ['#f2ede2', '#e8e0d0', '#d8d0c0', '#4a4440']);
      return { wool, body: '#2e2a28', leg: '#2e2a28', tail: wool, ear: '#2e2a28', eye: '#f2e6c8' };
    },
  };
  const cat = quadruped(1.8, 1.9, [0.8, 0.9]);
  cat.sticks.unshift(['hips', 'chest', 1.3, 'body']);
  cat.points[3][2] += 1.2; // tail held up
  SPECIES.cat = {
    ...cat, name: 'Cat', density: 980, hp: 45, breathes: 'air', burns: 1.1, bleeds: BLOOD,
    walk: 0.06, run: 0.22, swims: true, heatMax: 50, acid: 1, head: 'cat', chases: 'bird', fears: 'dog', hatesWater: true, landsOnFeet: true,
    desc: 'Quick and nimble: hunts birds, always lands on its feet so falls barely hurt, runs from dogs and hates water.',
    colors(rand) {
      const c = pick(rand, [['#e08a3a', '#b8682a'], ['#3a3632', '#1e1c1a'], ['#a8a49c', '#787470'], ['#f0ece4', '#c8c0b4']]);
      return { body: c[0], leg: c[1], tail: c[0], ear: c[1], nose: '#e88a9a', eye: '#8ad84a' };
    },
  };
  SPECIES.dog.fears = null;
}
export const SPECIES_ORDER = ['human', 'zombie', 'robot', 'dog', 'cat', 'sheep', 'chicken', 'bird', 'frog', 'fish'];

// Work out indices and rest lengths once per species.
for (const sp of Object.values(SPECIES)) {
  const idx = Object.fromEntries(sp.points.map((p, k) => [p[0], k]));
  sp.idx = idx;
  sp.rootK = idx[sp.root]; sp.headK = idx[sp.headPt]; sp.neckK = idx[sp.neckPt];
  sp.rest = sp.points.map(p => [p[1], p[2]]);
  sp.stickList = sp.sticks.map(([a, b, thick, color, stiff]) => {
    const A = sp.rest[idx[a]], B = sp.rest[idx[b]];
    return { a: idx[a], b: idx[b], len: Math.hypot(A[0] - B[0], A[1] - B[1]), thick, color, stiff: stiff ?? 1 };
  });
  sp.dotList = (sp.dots || []).map(([p, r, color]) => ({ k: idx[p], r, color }));
  sp.height = Math.max(...sp.rest.map(r => r[1])) + sp.headR;
  sp.legL = sp.points.some(p => p[5] === LEG_L) ? 1 : 0;
  sp.legR = sp.points.some(p => p[5] === LEG_R) ? 1 : 0;
  sp.length = Math.max(...sp.rest.map(r => r[0])) - Math.min(...sp.rest.map(r => r[0]));
}

let nextId = 1;
class Creature {
  constructor(kind, x, y, facing, colors) {
    const sp = SPECIES[kind];
    this.id = nextId++;
    this.kind = kind; this.sp = sp;
    const n = this.n = sp.points.length;
    this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.ox = new Float32Array(n); this.oy = new Float32Array(n);
    this.r = new Float32Array(sp.points.map(p => p[3]));
    this.im = new Float32Array(sp.points.map(p => 1 / p[4]));
    this.limb = new Uint8Array(sp.points.map(p => p[5]));
    this.wound = new Float32Array(n);   // all harm a part has taken (for blood on clothes)
    this.cut = new Float32Array(n);     // open wounds
    this.bruise = new Float32Array(n);  // blunt harm
    this.bleed = new Float32Array(n);   // how fast each part is bleeding (clots over time)
    this.limbHp = new Float32Array(7).fill(sp.hp * 0.6); // each body part can be broken on its own
    this.detached = new Uint8Array(n);
    this.sticks = sp.stickList.map(s => ({ ...s, broken: false, bleed: 0 }));
    this.facing = facing;        // 1: facing right, -1: facing left
    for (let k = 0; k < n; k++) {
      const [f, u] = sp.rest[k];
      this.px[k] = this.ox[k] = x + f * facing;
      this.py[k] = this.oy[k] = y + u;
    }
    this.colors = colors;
    this.hp = sp.hp; this.alive = true;
    this.oxygen = 600; this.stamina = 600;
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
    this.flyY = 0; this.hopT = 30; this.limp = 1; this.fireCool = 0;
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
  }

  clear() {
    this.list.length = 0; this.owner.clear();
    if (this.was.length !== this.world.N) this.was = new Uint8Array(this.world.N);
    else for (const i of this.prevStamped) this.was[i] = 0;
    this.stamped.length = 0; this.prevStamped.length = 0;
  }

  spawn(kind, x, y, facing = Math.random() < 0.5 ? 1 : -1) {
    const w = this.world, sp = SPECIES[kind];
    // Start clear of anything solid.
    x = Math.max(2, Math.min(w.W - 3, x));
    const tall = Math.ceil(sp.height) + 1;
    for (let tries = 0; tries < 40 && y < w.H - tall; tries++) {
      let free = true;
      for (let u = 0; u < tall && free; u++) if (HARD_CELL[this.cellType(x, y + u)]) free = false;
      if (free) break;
      y++;
    }
    if (!sp.walker) y += 0.5;
    const c = new Creature(kind, x, y + 0.05, facing, sp.colors(Math.random));
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
  cellIndex(x, y) {
    const w = this.world;
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= w.W || iy >= w.H) return -1;
    return ix + w.W * iy;
  }
  cellType(x, y) {
    const i = this.cellIndex(x, y);
    return i < 0 ? (y < 0 ? El.STONE : EMPTY) : this.world.type[i];
  }

  // ----- the step -----
  step() {
    const w = this.world;
    this.feelWorld();
    for (const c of this.list) this.update(c);
    this.collideBodies();
    // Remove what has burnt to ash or crumbled away.
    for (let k = this.list.length - 1; k >= 0; k--) {
      const c = this.list[k];
      if (c.alive || c.char < 1) continue;
      for (let p = 0; p < c.n; p++) {
        const i = this.cellIndex(c.px[p], c.py[p]);
        if (i >= 0 && w.type[i] === EMPTY) w.set(i, ASH);
      }
      this.list.splice(k, 1);
    }
  }

  // Explosions, black holes and falling grains from the world's last step.
  feelWorld() {
    const w = this.world;
    const holes = w.holes;
    if (holes.length) {
      for (let j = this.list.length - 1; j >= 0; j--) {
        const c = this.list[j];
        let eaten = false;
        for (let h = 0; h < holes.length && !eaten; h += 2) {
          const hx = holes[h] + 0.5, hy = holes[h + 1] + 0.5;
          for (let k = 0; k < c.n; k++) {
            const dx = hx - c.px[k], dy = hy - c.py[k], d = Math.hypot(dx, dy);
            if (d > 20) continue;
            if (d < 1.6) { eaten = true; break; }
            const f = 0.06 * (1 - d / 20) / d;
            c.ox[k] -= dx * f; c.oy[k] -= dy * f;
            if (c.alive && d < 14) { c.stun = Math.max(c.stun, 10); c.mood = 'panic'; }
          }
        }
        if (eaten) { this.list.splice(j, 1); w.discover(DISC.BLACK_HOLE); }
      }
    }
    const b = w.blasts;
    for (let j = 0; j < b.length; j += 3) this.blast(b[j] + 0.5, b[j + 1] + 0.5, b[j + 2] * 1.7);
    b.length = 0;
    const h = w.hits;
    for (let j = 0; j < h.length; j += 2) {
      const o = this.owner.get(h[j]);
      if (o === undefined) continue;
      const c = this.list.find(c => c.id === o >> 8);
      if (!c) continue;
      const k = o & 255, power = h[j + 1] / 1600;
      c.oy[k] += power * 0.02;   // pushed down
      const dmg = (power - 2) * 0.3;
      if (dmg > 0) this.hurt(c, dmg, k, 'crush', dmg * 0.4);
    }
    h.length = 0;
  }

  blast(x, y, R = 12) {
    for (const c of this.list) {
      let best = 0, bk = 0;
      for (let k = 0; k < c.n; k++) {
        const dx = c.px[k] - x, dy = c.py[k] - y;
        const d = Math.hypot(dx, dy);
        if (d > R) continue;
        const f = 1 - d / R, s = d > 0.01 ? 2.1 * f / d : 0;
        c.ox[k] -= dx * s; c.oy[k] -= dy * s + 0.7 * f;
        if (f > best) { best = f; bk = k; }
        // Each part takes the blast it was close to: shrapnel cuts, the shock bruises.
        if (f > 0.2) this.injure(c, k, 45 * f * f, 'blast', 50 * f);
      }
      if (best > 0) { this.hurt(c, 55 * best * best, bk, 'blast', 60 * best); c.fire = Math.max(c.fire, c.sp.burns && best > 0.5 ? 200 : 0); }
    }
  }

  // A lightning bolt came down in column x and stopped at height hitY.
  // Anything sheltering under a roof below that is safe.
  lightning(x, hitY = 0) {
    for (const c of this.list) {
      const k = c.sp.headK;
      if (Math.abs(c.px[k] - x - 0.5) > 2.5 || c.py[k] < hitY - 3) continue;
      this.hurt(c, 40, k, 'lightning', 60);
      if (c.sp.burns) c.fire = 500;
      for (let p = 0; p < c.n; p++) { c.ox[p] += (Math.random() - 0.5) * 0.6; c.oy[p] -= Math.random() * 0.4; }
    }
  }

  update(c) {
    const sp = c.sp;
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
      let vx = c.px[k] - c.ox[k], vy = c.py[k] - c.oy[k];
      const v2 = vx * vx + vy * vy;
      if (v2 > MAX_V * MAX_V) { const s = MAX_V / Math.sqrt(v2); vx *= s; vy *= s; }
      const t = this.cellType(c.px[k], c.py[k]);
      let ay = -GRAVITY;
      if (STATE[t] === LIQUID) {
        const drag = 0.08 + 0.35 * (1 - VISC[t]);
        vx *= 1 - drag; vy *= 1 - drag;
        ay += GRAVITY * DENS[t] / rho;
      } else {
        vx *= 0.996;
        vy *= c.flapping && c.limb[k] !== LEG_L && c.limb[k] !== LEG_R ? 0.86 : 0.996;
      }
      c.ox[k] = c.px[k]; c.oy[k] = c.py[k];
      c.px[k] += vx; c.py[k] += vy + ay;
    }

    // Held by the mouse: that point follows the pointer, the rest swings.
    if (c.grab) {
      const k = c.grab.k;
      let dx = c.grab.x - c.px[k], dy = c.grab.y - c.py[k];
      const d = Math.hypot(dx, dy), lim = 2.2;
      if (d > lim) { dx *= lim / d; dy *= lim / d; }
      c.px[k] += dx * 0.5; c.py[k] += dy * 0.5;
      c.stun = Math.max(c.stun, 30);
    }

    c.impact = 0;
    for (let it = 0; it < ITERATIONS; it++) {
      this.solveSticks(c);
      this.collide(c, it === 0);
    }
    if (c.impact > FALL_HURTS && c.age > 5) {
      const k = c.impactK;
      const dmg = (c.impact - FALL_HURTS) * 45 * (k === sp.headK ? 1.3 : 1) * (sp.landsOnFeet ? 0.1 : 1);
      this.hurt(c, dmg, k, 'fall', dmg);
    }
    this.bloodStep(c);
    this.environment(c);
  }

  solveSticks(c) {
    const { px, py, im } = c;
    for (const s of c.sticks) {
      if (s.broken) continue;
      const a = s.a, b = s.b;
      const dx = px[b] - px[a], dy = py[b] - py[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
      const diff = (d - s.len) / d * s.stiff;
      const wa = im[a] / (im[a] + im[b]), wb = 1 - wa;
      px[a] += dx * diff * wa; py[a] += dy * diff * wa;
      px[b] -= dx * diff * wb; py[b] -= dy * diff * wb;
    }
  }

  // Push every point out of the solid and powder cells it overlaps. Moving
  // into a surface stops that part of the motion and rubs off some of the
  // sliding (friction); the hardest hit is remembered for fall damage.
  collide(c, first) {
    const w = this.world, type = w.type, W = w.W, H = w.H;
    for (let k = 0; k < c.n; k++) {
      const r = c.r[k];
      let x = c.px[k], y = c.py[k];
      const vx0 = x - c.ox[k], vy0 = y - c.oy[k];
      // The edges of the world are walls; the bottom is bedrock.
      let nx = 0, ny = 0;
      if (x < r) { x = r; nx = 1; } else if (x > W - r) { x = W - r; nx = -1; }
      if (y > H - r) y = H - r;
      if (y < r) { y = r; ny = 1; }
      const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.floor(x + r));
      const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.floor(y + r));
      let bouncy = false;
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        const ct = type[cx + W * cy];
        if (!HARD_CELL[ct]) continue;
        if (ct === RUBBER) bouncy = true;
        // Closest point of the cell to the point's centre.
        const qx = x < cx ? cx : x > cx + 1 ? cx + 1 : x;
        const qy = y < cy ? cy : y > cy + 1 ? cy + 1 : y;
        let dx = x - qx, dy = y - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        const d = Math.sqrt(d2);
        if (d < 1e-4) {
          // The centre is inside the cell: leave by the nearest open side, preferring up.
          const opts = [[0, 1, cy + 1 - y], [0, -1, y - cy], [1, 0, cx + 1 - x], [-1, 0, x - cx]];
          let best = null;
          for (const o of opts) {
            const ox = cx + o[0], oy = cy + o[1];
            const open = ox < 0 || ox >= W || oy >= H || (oy >= 0 && !HARD_CELL[type[ox + W * oy]]);
            const cost = o[2] + (open ? 0 : 3) - (o[1] === 1 ? 0.15 : 0);
            if (!best || cost < best[2]) best = [o[0], o[1], cost, o[2]];
          }
          dx = best[0]; dy = best[1];
          const depth = Math.min(1.5, best[3] + r);
          x += dx * depth; y += dy * depth;
        } else {
          dx /= d; dy /= d;
          x += dx * (r - d); y += dy * (r - d);
        }
        nx += dx; ny += dy;
      }
      if (nx !== 0 || ny !== 0) {
        const nl = Math.hypot(nx, ny); nx /= nl; ny /= nl;
        let vx = vx0, vy = vy0;
        const vn = vx * nx + vy * ny;
        if (vn < 0 && bouncy) {
          // Rubber gives the energy back: a bounce, not a crash.
          vx -= nx * vn * 1.75; vy -= ny * vn * 1.75;
          c.ox[k] = x - vx; c.oy[k] = y - vy;
          if (-vn > 0.5) this.world.discover(DISC.BOUNCE);
        } else if (vn < 0) {
          if (first && -vn > c.impact) { c.impact = -vn; c.impactK = k; }
          vx -= nx * vn; vy -= ny * vn;
          const fr = ny > 0.5 ? 0.35 : 0.15;
          vx *= 1 - fr; vy *= 1 - fr;
          c.ox[k] = x - vx; c.oy[k] = y - vy;
        }
      }
      c.px[k] = x; c.py[k] = y;
    }
  }

  // Bodies bump into each other.
  collideBodies() {
    const L = this.list;
    for (let a = 0; a < L.length; a++) {
      const A = L[a], ra = A.sp.rootK;
      for (let b = a + 1; b < L.length; b++) {
        const B = L[b], rb = B.sp.rootK;
        // Creatures walking about step past each other; ragdolls collide.
        if (A.strength > 0 && B.strength > 0) continue;
        const reach = A.sp.height + B.sp.height;
        if (Math.abs(A.px[ra] - B.px[rb]) > reach || Math.abs(A.py[ra] - B.py[rb]) > reach) continue;
        for (let i = 0; i < A.n; i++) for (let j = 0; j < B.n; j++) {
          const dx = B.px[j] - A.px[i], dy = B.py[j] - A.py[i];
          const R = (A.r[i] + B.r[j]) * 0.8, d2 = dx * dx + dy * dy;
          if (d2 >= R * R || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), push = (R - d) / d * 0.5;
          const wa = A.im[i] / (A.im[i] + B.im[j]) * 2, wb = 2 - wa;
          A.px[i] -= dx * push * wa; A.py[i] -= dy * push * wa;
          B.px[j] += dx * push * wb; B.py[j] += dy * push * wb;
        }
      }
    }
  }

  // ----- muscles: standing, walking, swimming -----
  // Height of the ground under x, searching down from y at most `depth`
  // cells, or -1 if there is none.
  groundBelow(x, y, depth) {
    const w = this.world;
    const ix = Math.floor(x);
    if (ix < 0 || ix >= w.W) return -1;
    let iy = Math.min(w.H - 1, Math.floor(y));
    const stop = Math.max(-1, Math.floor(y - depth));
    for (; iy > stop; iy--) {
      if (iy < 0) return 0;
      if (HARD_CELL[w.type[ix + w.W * iy]]) return iy + 1;
    }
    return iy < 0 ? 0 : -1;
  }

  muscles(c) {
    const sp = c.sp;
    // Broken legs: one makes it limp, two and it cannot stand (a bird can still fly).
    // A leg that is gone altogether, not just broken, cannot be stood on at all.
    const legGone = L => c.detached.some((d, k) => d && c.limb[k] === L);
    const legsOut = (sp.legL && c.limbHp[LEG_L] <= 0 ? (legGone(LEG_L) ? 2 : 1) : 0) + (sp.legR && c.limbHp[LEG_R] <= 0 ? (legGone(LEG_R) ? 2 : 1) : 0);
    const legs = sp.legL + sp.legR;
    c.limp = legsOut > 0 ? 0.35 : 1;
    if (c.limbHp[HEAD] <= 0 && c.alive) c.stun = Math.max(c.stun, 10); // concussed
    const downed = legs > 0 && legsOut >= legs && !(sp.flies && c.mood === 'fly');
    const able = c.alive && !c.grab && c.stun <= 0 && !c.detached[sp.rootK] && !downed;
    c.strength = able ? Math.min(1, c.strength + 0.025) : 0;
    c.flapping = false;
    c.swimming = false;
    if (!able) { this.flail(c); return; }
    const k0 = sp.rootK, fx = c.facing;
    const rx = c.px[k0], ry = c.py[k0];

    if (sp.swimmer) { this.swim(c); return; }
    if (sp.flies && c.mood === 'fly') { this.fly(c); return; }

    const rootU = sp.rest[k0][1];
    let ground = this.groundBelow(rx, ry, rootU + 2.5);
    // Look a step ahead too, so a creature lifts itself onto a ledge.
    if (c.speed > 0 && ground >= 0) {
      const ahead = this.groundBelow(rx + fx * 1.4, ry + 2.2, rootU + 4.5);
      if (ahead > ground && ahead - ground <= 2.5) ground = ahead;
    }
    // Falling fast: the legs cannot catch the body, it just lands.
    if (c.py[k0] - c.oy[k0] < -0.4) ground = -1;
    const rootT = this.cellType(rx, ry);
    const inLiquid = STATE[rootT] === LIQUID;
    // Lighter than the liquid it is in: it floats rather than standing on the bottom.
    if (inLiquid && sp.density < DENS[rootT] && !sp.swims) ground = -1;
    c.grounded = ground >= 0;
    let support = 1, base = ground;
    if (ground < 0) {
      // In the air or out of its depth: hold the pose around the hips.
      base = ry - rootU;
      support = 0.2;
      if (sp.flaps) c.flapping = true;
      if (inLiquid && sp.swims) c.swimming = true;
    }
    if (inLiquid && ground >= 0 && ry - ground > rootU + 1.5) c.swimming = sp.swims;
    // Quicksand, tar, slime and honey are too thick to swim or wade through.
    const feetT = this.cellType(rx, (ground >= 0 ? ground : ry - rootU) + 0.6);
    const thick = (inLiquid && VISC[rootT] < 0.2) || (STATE[feetT] === LIQUID && VISC[feetT] < 0.2);
    if (thick) c.swimming = false;

    // Treading water: swimmers keep their head up until they tire.
    if (c.swimming) {
      const h = sp.headK, n = sp.neckK;
      if (c.stamina > 0 && STATE[this.cellType(c.px[h], c.py[h] + 0.4)] === LIQUID) {
        c.oy[h] -= GRAVITY * 1.9; c.oy[n] -= GRAVITY * 1.3;
      }
      c.stamina--;
      if (c.speed > 0) c.ox[k0] -= fx * 0.02;
    } else if (c.grounded) c.stamina = Math.min(600, c.stamina + 3);

    // Hoppers stand still between jumps and leap forward.
    if (sp.hops && c.speed > 0 && c.grounded && !inLiquid && --c.hopT <= 0) {
      c.hopT = c.mood === 'flee' ? 22 + Math.random() * 15 : 40 + Math.random() * 40;
      for (let k = 0; k < c.n; k++) { c.oy[k] -= 0.42; c.ox[k] -= fx * 0.22; }
    }
    const speed = c.grounded && !sp.hops ? c.speed * (thick ? 0.08 : inLiquid ? 0.55 : 1) * c.limp : 0;
    if (speed > 0.005) c.phase += speed * 0.9;
    const stride = Math.min(sp.flaps ? 0.7 : 1.7, speed * 22), lift = Math.min(1, speed * 12);
    const bob = speed > 0.005 ? 0 : 0.08 * Math.sin(c.age * 0.05);
    // In the air the pose is held around the hips, so it moves with them.
    const air = ground < 0;
    const rvx = air ? rx - c.ox[k0] : 0, rvy = air ? ry - c.oy[k0] : 0;
    for (let k = 0; k < c.n; k++) {
      if (c.detached[k] || (k === k0 && air)) continue;
      const P = sp.points[k];
      let F = P[1], U = P[2];
      if (P[7]) {
        const ph = c.phase + (P[8] ? Math.PI : 0);
        const sn = Math.sin(ph), up = Math.max(0, Math.cos(ph));
        if (P[7] === 'foot') { F += stride * sn; U += lift * up; }
        else if (P[7] === 'knee') { F += stride * 0.5 * sn; U += lift * 0.5 * up; }
        else if (P[7] === 'hand') F -= stride * 0.8 * sn;
        else F -= stride * 0.4 * sn;
      }
      if (k === k0) U += bob;
      const tx = rx + fx * (F - sp.rest[k0][0]), ty = base + U;
      let m = P[6] * c.strength * support;
      // A broken arm or leg hangs limp.
      if (P[5] !== CORE && P[5] !== HEAD && c.limbHp[P[5]] <= 0) m = 0;
      if (c.swimming) m *= 0.5;
      let vx = c.px[k] - c.ox[k], vy = c.py[k] - c.oy[k];
      const gx = (tx - c.px[k]) * 0.35 + fx * speed + rvx, gy = (ty - c.py[k]) * 0.35 + rvy;
      vx += (gx - vx) * m; vy += (gy - vy) * m;
      c.ox[k] = c.px[k] - vx; c.oy[k] = c.py[k] - vy;
    }
  }

  // Flying: hold the pose, beat the wings, and steer toward a cruising height.
  fly(c) {
    const sp = c.sp, k0 = sp.rootK, fx = c.facing;
    c.flapping = true;
    const rx = c.px[k0], ry = c.py[k0], rootU = sp.rest[k0][1];
    const climb = Math.max(-0.15, Math.min(0.2, (c.flyY - ry) * 0.04));
    for (let k = 0; k < c.n; k++) {
      if (c.detached[k]) continue;
      const P = sp.points[k];
      const tx = rx + fx * (P[1] - sp.rest[k0][0]), ty = ry + P[2] - rootU;
      let vx = c.px[k] - c.ox[k], vy = c.py[k] - c.oy[k];
      // GRAVITY is added back so that, after falling this step, it moves as asked.
      const gx = (tx - c.px[k]) * 0.35 + fx * c.speed, gy = (ty - c.py[k]) * 0.35 + climb + GRAVITY;
      const m = 0.5 * c.strength;
      vx += (gx - vx) * m; vy += (gy - vy) * m;
      c.ox[k] = c.px[k] - vx; c.oy[k] = c.py[k] - vy;
    }
  }

  // Fish: in water they hold a straight body and beat the tail; out of
  // water they can only flop.
  swim(c) {
    const sp = c.sp, h = sp.headK, k0 = sp.rootK;
    const ht = this.cellType(c.px[h], c.py[h]);
    if (ht !== WATER && ht !== BRINE) {
      const lying = HARD_CELL[this.cellType(c.px[k0], c.py[k0] - c.r[k0] - 0.3)] || HARD_CELL[this.cellType(c.px[h], c.py[h] - c.r[h] - 0.3)];
      if (lying && Math.random() < 0.035) {
        const kick = 0.16 + Math.random() * 0.12, side = Math.random() < 0.5 ? -1 : 1;
        for (let k = 0; k < c.n; k++) { c.oy[k] -= kick * (k === 0 || k === c.n - 1 ? 1.2 : 0.8); c.ox[k] -= side * 0.06 * (k - 1.5); }
      }
      return;
    }
    c.phase += 0.25;
    const rx = c.px[k0], ry = c.py[k0], fx = c.facing;
    for (let k = 0; k < c.n; k++) {
      const F = sp.rest[k][0] - sp.rest[k0][0];
      const wig = k >= 2 ? Math.sin(c.phase - k) * 0.3 * (k - 1) : 0;
      const tx = rx + fx * F, ty = ry + wig;
      let vx = c.px[k] - c.ox[k], vy = c.py[k] - c.oy[k];
      const gx = (tx - c.px[k]) * 0.35 + fx * c.speed, gy = (ty - c.py[k]) * 0.35 + c.swimDY;
      const m = 0.3 * c.strength;
      vx += (gx - vx) * m; vy += (gy - vy) * m;
      c.ox[k] = c.px[k] - vx; c.oy[k] = c.py[k] - vy;
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
    const hx = c.px[h], hy = c.py[h];
    let fear = this.sense(c), prey = null;

    if (sp.hunts) prey = this.nearest(c, o => o.alive && o.kind === sp.hunts, 60);
    if (sp.chases) prey = this.nearest(c, o => o.alive && o.kind === sp.chases, 40);
    if (sp.fears) {
      const o = this.nearest(c, o => o.alive && o.kind === sp.fears, 14);
      if (o) { fear = (fear || 0) + Math.sign(hx - o.px[o.sp.rootK]) * 2; prey = null; }
    }
    if (sp.hatesWater && STATE[this.cellType(c.px[k0], c.py[k0])] === LIQUID) fear = fear || (Math.random() < 0.5 ? 1 : -1);
    // Sheep stop to nibble any leaves or grass by their head.
    // A sheep facing leaves stops and nibbles them, a mouthful at a time.
    if (sp.grazes && !fear) {
      const w0 = this.world;
      for (const [dx, dy] of [[0.8, 0], [1.4, -0.6], [0.8, -1], [0, -1.2], [1.6, 0.4], [2.2, -1], [2.2, -2], [1.6, -2.6], [2.6, 0]]) {
        const i = this.cellIndex(hx + dx * c.facing, hy + dy);
        if (i < 0 || w0.type[i] !== PLANT) continue;
        if (c.biteT <= 0) { w0.set(i, EMPTY); w0.discover(DISC.GRAZE); c.biteT = 25; }
        c.speed = 0; c.mood = 'idle'; c.moodT = 40 + Math.random() * 60;
        return;
      }
    }
    if (c.kind === 'human') {
      const z = this.nearest(c, o => o.alive && o.kind === 'zombie', 18);
      if (z) fear = (fear || 0) + Math.sign(hx - z.px[z.sp.headK]) * 2;
    }
    if (sp.skittish) {
      const o = this.nearest(c, o => o.alive && o !== c && o.kind !== c.kind, 7);
      if (o) fear = (fear || 0) + Math.sign(hx - o.px[o.sp.rootK]);
    }
    const face = dx => { c.facing = dx >= 0 ? 1 : -1; };

    if (sp.swimmer) {
      c.speed = sp.walk;
      c.moodT -= 5;
      const up = this.cellType(hx, hy + 1.2), down = this.cellType(hx, hy - 1.2);
      if (up !== WATER && up !== BRINE) c.swimDY = -0.01;
      else if (HARD_CELL[down]) c.swimDY = 0.01;
      else if (c.moodT <= 0) c.swimDY = (Math.random() - 0.5) * 0.02;
      if (fear) { face(fear); c.speed = sp.run; c.mood = 'flee'; }
      else if (c.moodT <= 0) {
        c.moodT = 100 + Math.random() * 200;
        if (Math.random() < 0.3) c.facing = -c.facing;
      }
      const ahead = this.cellType(hx + c.facing * 1.6, hy);
      if (ahead !== WATER && ahead !== BRINE) c.facing = -c.facing;
      return;
    }

    if (sp.flies && this.thinkFlight(c, fear)) return;

    if (c.fire > 0) {
      // On fire: run about in a panic.
      c.mood = 'panic'; c.speed = sp.run;
      if (c.moodT <= 0 || Math.random() < 0.1) { face(Math.random() - 0.5); c.moodT = 40; }
      c.moodT -= 5;
    } else if (fear) {
      face(fear); c.speed = sp.run; c.mood = 'flee'; c.moodT = 40;
    } else if (prey) {
      face(prey.px[prey.sp.rootK] - c.px[k0]);
      c.speed = sp.run; c.mood = 'hunt';
      // Zombies bite when close enough; a dog just plays.
      if (sp.hunts && c.biteT <= 0) {
        for (let k = 0; k < prey.n; k++) {
          if (Math.hypot(prey.px[k] - hx, prey.py[k] - hy) < 2.2) {
            c.biteT = 40;
            if (!prey.infected) prey.infected = 220;
            this.hurt(prey, 6, k, 'bite', 9);
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
          if (Math.random() < 0.35) c.facing = -c.facing;
        }
      }
    }

    // Turn back at walls, big drops and the edge of the world.
    if (c.speed > 0 && c.grounded && !c.swimming) {
      const ax = c.px[k0] + c.facing * 2.2;
      const foot = c.py[k0] - sp.rest[k0][1];
      let blocked = ax < 2 || ax > w.W - 2;
      for (let u = 3; u < sp.height && !blocked; u += 1.5) if (HARD_CELL[this.cellType(ax, foot + u)]) blocked = true;
      const panicky = c.mood === 'flee' || c.mood === 'panic';
      if (!blocked && !panicky && this.groundBelow(ax, foot + 1, 8) < 0 && STATE[this.cellType(ax, foot - 1)] !== LIQUID) blocked = true;
      if (blocked) { c.facing = -c.facing; c.moodT = Math.max(c.moodT, 30); }
    }
  }

  // Birds: perch for a while, then fly about at a cruising height, turning
  // at walls and the edges of the world. Danger sends them up and away.
  // Returns true when it has decided what to do.
  thinkFlight(c, fear) {
    const sp = c.sp, w = this.world, k0 = sp.rootK;
    const x = c.px[k0], y = c.py[k0];
    c.moodT -= 5;
    // Wet feathers: get out of the water.
    if (c.mood !== 'fly' && STATE[this.cellType(x, y)] === LIQUID) fear = fear || (Math.random() < 0.5 ? 1 : -1);
    if (fear || c.fire > 0) {
      if (c.mood !== 'fly') c.flyY = Math.min(w.H - 4, y + 18 + Math.random() * 10);
      c.mood = 'fly'; c.speed = sp.run; c.moodT = Math.max(c.moodT, 120);
      if (fear) c.facing = fear > 0 ? 1 : -1;
    } else if (c.moodT <= 0) {
      if (c.mood === 'fly') { c.mood = 'idle'; c.speed = 0; c.moodT = 150 + Math.random() * 300; }
      else { c.mood = 'fly'; c.speed = sp.walk + 0.1; c.moodT = 200 + Math.random() * 400; c.flyY = w.H * (0.45 + Math.random() * 0.4); }
    }
    if (c.mood !== 'fly') return false;
    if (Math.random() < 0.02) c.flyY = Math.max(4, Math.min(w.H - 4, c.flyY + (Math.random() - 0.5) * 12));
    const ax = x + c.facing * 3;
    if (ax < 3 || ax > w.W - 3) c.facing = -c.facing;
    else if (HARD_CELL[this.cellType(ax, y)] || HARD_CELL[this.cellType(ax, y + 1)]) { c.flyY = Math.min(w.H - 4, c.flyY + 6); if (Math.random() < 0.5) c.facing = -c.facing; }
    if (HARD_CELL[this.cellType(x, y - 2)]) c.flyY = Math.max(c.flyY, y + 3);
    return true;
  }

  // Look around the head for fire, lava and heat. Returns which way is away
  // from danger (a positive or negative number), or 0.
  sense(c) {
    const w = this.world, type = w.type, temp = w.temp;
    const h = c.sp.headK;
    const hx = Math.floor(c.px[h]), hy = Math.floor(c.py[h] - 3);
    const R = 10, robot = c.kind === 'robot';
    let away = 0, n = 0;
    for (let dy = -4; dy <= 8; dy++) {
      const y = hy + dy; if (y < 0 || y >= w.H) continue;
      for (let dx = -R; dx <= R; dx++) {
        const x = hx + dx; if (x < 0 || x >= w.W) continue;
        const i = x + w.W * y;
        const t = type[i];
        const bad = t === LAVA || t === MOLTEN || (!robot && (t === FIRE || temp[i] > 120));
        if (!bad) continue;
        away -= dx / (dx * dx + dy * dy + 1); n++;
      }
    }
    if (!n) return 0;
    return away || (Math.random() - 0.5);
  }

  nearest(c, test, maxD) {
    const k = c.sp.rootK;
    let best = null, bd = maxD;
    for (const o of this.list) {
      if (o === c || !test(o)) continue;
      const j = o.sp.rootK;
      const d = Math.hypot(o.px[j] - c.px[k], o.py[j] - c.py[k]);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ----- what the world does to a body -----
  environment(c) {
    const w = this.world, sp = c.sp, type = w.type, temp = w.temp;
    let maxT = -999, minT = 999, inLava = 0, inAcid = 0, inFire = 0, doused = false, embedded = 0;
    for (let k = 0; k < c.n; k++) {
      const i = this.cellIndex(c.px[k], c.py[k]);
      if (i < 0) continue;
      const t = type[i], T = temp[i];
      if (T > maxT) maxT = T;
      if (T < minT) minT = T;
      if (t === FIRE) inFire++;
      else if (t === LAVA || t === MOLTEN) inLava++;
      else if (t === ACID || t === LYE) {
        inAcid++;
        c.wound[k] += 0.03 * sp.acid;
        if (Math.random() < 0.01) w.set(i, SMOKE, T + 10);
      } else if (DOUSES[t]) doused = true;
      if (HARD_CELL[t]) embedded++;
    }

    // Fire.
    // (Just after the flames go out, the warm ground under the body does not relight it.)
    if (c.fireCool > 0) c.fireCool--;
    if (sp.burns && !doused && c.fire <= 0 && (inLava || (c.fireCool <= 0 && (inFire || maxT > 280) && Math.random() < 0.12))) {
      c.fire = 450 + Math.random() * 300;
      if (c.alive) w.discover(DISC.ON_FIRE);
    }
    if (c.fire > 0) {
      if (doused) { c.fire = 0; c.fireCool = 240; }
      else {
        if (--c.fire <= 0) c.fireCool = 240;
        c.char = Math.min(1, c.char + 0.0016 * sp.burns);
        if (c.alive) this.hurt(c, 0.06 * sp.burns, -1, 'fire');
        // Flames rise from the body and heat what it touches.
        const k = (Math.random() * c.n) | 0;
        const up = this.cellIndex(c.px[k], c.py[k] + 1);
        if (up >= 0 && type[up] === EMPTY && Math.random() < 0.3) w.set(up, FIRE);
        const at = this.cellIndex(c.px[k], c.py[k] - 0.6);
        if (at >= 0 && temp[at] < 420) { temp[at] = 420; w.heatAct[w.regionOf[at]] = 1; }
        if (!c.alive && c.char >= 1) c.fire = 0;
      }
    }
    if (inLava) {
      c.char = Math.min(1, c.char + 0.006 * inLava);
      if (c.alive) this.hurt(c, inLava * (c.kind === 'robot' ? 0.03 : 0.06), -1, 'lava');
    }
    if (!c.alive) return;
    if (maxT > sp.heatMax) this.hurt(c, Math.min(0.05, (maxT - sp.heatMax) * 0.0004), -1, 'heat');
    // Frostbite, and a shock from a live wire.
    if (minT < -20 && c.kind !== 'robot') this.hurt(c, Math.min(0.15, (-20 - minT) * 0.0008), -1, 'cold');
    if ((c.age + c.id) % 2 === 0) this.shock(c);
    if ((c.age + c.id) % 4 === 0) this.spines(c);
    if ((c.age + c.id) % 10 === 0) this.radiation(c);
    if (inAcid) this.hurt(c, inAcid * 0.03 * sp.acid, -1, 'acid');

    // Breathing.
    const h = sp.headK;
    if (sp.breathes) {
      const ht = this.cellType(c.px[h], c.py[h] + 0.3);
      const buried = (HARD_CELL[ht] && !AIRY_SOLID[ht]) || this.buried(c);
      const ok = sp.breathes === 'water' ? ht === WATER || ht === BRINE
        : sp.breathes === 'both' ? !buried && (STATE[ht] !== LIQUID || ht === WATER || ht === BRINE)
        : STATE[ht] !== LIQUID && ht !== CO2 && !buried;
      if (ok) c.oxygen = Math.min(600, c.oxygen + 4);
      else {
        c.oxygen--;
        if (sp.breathes === 'water' && c.oxygen < 250) w.discover(DISC.GASP);
        if (c.oxygen <= 0) this.hurt(c, 0.15, -1, sp.breathes === 'water' ? 'gasp' : buried ? 'buried' : ht === CO2 ? 'suffocate' : 'drown');
      }
      const rt = this.cellType(c.px[sp.rootK], c.py[sp.rootK]);
      if (c.kind === 'human' && ok && rt === BRINE && !c.grounded && !c.swimming) w.discover(DISC.SALT_FLOAT);
    }

    // Weight on top, or stuck inside something solid.
    if ((c.age + c.id) % 3 === 0) {
      let load = 0, lk = sp.rootK;
      for (const k of [sp.headK, sp.neckK, sp.rootK]) {
        const l = this.loadAbove(c.px[k], c.py[k] + c.r[k] + 0.2);
        if (l > load) { load = l; lk = k; }
      }
      if (load > 2.5) {
        for (let k = 0; k < c.n; k++) c.oy[k] += Math.min(0.06, load * 0.004);
        this.hurt(c, (load - 2.5) * 0.15, lk, 'crush');
      }
      if (embedded >= 2) this.hurt(c, embedded * 0.35, lk, 'crush');
    }

    // A zombie bite turns a person after a while, even after death.
    if (c.infected > 0 && --c.infected === 0) this.turnZombie(c);
  }

  // Any part touching a wire with a pulse in it gets a jolt.
  shock(c) {
    const w = this.world, fl = w.flags;
    for (let k = 0; k < c.n; k++) {
      const x = c.px[k], y = c.py[k], r = c.r[k] + 0.4;
      for (const [dx, dy] of [[0, -r], [r, 0], [-r, 0], [0, r]]) {
        const i = this.cellIndex(x + dx, y + dy);
        if (i < 0 || !(fl[i] & 32)) continue;   // 32: a pulse is in this wire (world.js SPARK)
        this.hurt(c, 2.5, k, 'shock', 12);
        for (let p = 0; p < c.n; p++) { c.ox[p] += (Math.random() - 0.5) * 0.5; c.oy[p] -= Math.random() * 0.3; }
        w.discover(DISC.SHOCK);
        return;
      }
    }
  }

  // Cactus spines prick anything brushing against them.
  spines(c) {
    for (let k = 0; k < c.n; k++) {
      const x = c.px[k], y = c.py[k], r = c.r[k] + 0.35;
      if (this.cellType(x + r, y) === CACTUS || this.cellType(x - r, y) === CACTUS || this.cellType(x, y - r) === CACTUS || this.cellType(x, y + r) === CACTUS) {
        this.hurt(c, 0.6, k, 'spine', 2);
        if (c.alive && c.mood !== 'flee') { c.facing = -c.facing; c.mood = 'flee'; c.moodT = 30; c.speed = c.sp.run; }
        return;
      }
    }
  }

  // Radiation from uranium nearby: slow, invisible harm.
  radiation(c) {
    const w = this.world, k0 = c.sp.rootK;
    const cx = Math.floor(c.px[k0]), cy = Math.floor(c.py[k0]);
    let n = 0;
    for (let y = Math.max(0, cy - 6); y <= Math.min(w.H - 1, cy + 6); y++)
      for (let x = Math.max(0, cx - 6); x <= Math.min(w.W - 1, cx + 6); x++) if (w.type[x + w.W * y] === URANIUM) n++;
    if (n) this.hurt(c, Math.min(1.5, n * 0.03), -1, 'radiation');
  }

  // Head boxed in above and on both sides by powder or solid: buried alive.
  buried(c) {
    const h = c.sp.headK, x = c.px[h], y = c.py[h], R = c.r[h] + 0.6;
    const shut = t => HARD_CELL[t] && !AIRY_SOLID[t];
    return shut(this.cellType(x, y + R)) && shut(this.cellType(x + R, y)) && shut(this.cellType(x - R, y));
  }

  // How heavy is the column of powder and solid resting above (x, y), in
  // units of about one cell of stone.
  loadAbove(x, y) {
    let load = 0;
    for (let k = 0; k < 30; k++) {
      const t = this.cellType(x, y + k);
      if (!HARD_CELL[t]) break;
      load += DENS[t] / 2000;
    }
    return load;
  }

  // ----- damage -----
  // How a cause harms the body: cuts open wounds that bleed, blunt force
  // bruises and breaks.
  static CUTS = { blast: 1, bite: 1, crush: 0.3, lightning: 0.3, spine: 0.6 };
  static BLUNT = { fall: 1, crush: 1, blast: 0.6, shock: 0.2 };

  // What a hit does to one body part: wounds, bruises, bleeding, a broken
  // limb, and with gore on, a limb torn off by one big enough blow.
  injure(c, k, amount, cause, jolt = 0) {
    const cut = Creatures.CUTS[cause] || 0, blunt = Creatures.BLUNT[cause] || 0;
    const L = c.limb[k];
    c.wound[k] += amount;
    c.cut[k] += amount * cut;
    c.bruise[k] += amount * blunt;
    if (cut && c.sp.bleeds) c.bleed[k] = Math.min(2, c.bleed[k] + amount * cut * 0.012);
    c.limbHp[L] -= amount * (L === CORE ? 0.5 : 1);
    if (this.gore && L !== CORE && c.limbHp[L] < -c.sp.hp * 0.5 && (cut > 0.5 || jolt > 90)) this.detach(c, L);
  }

  // amount: health lost. k: the point that was hit (-1 for the whole body).
  // jolt: a big hit knocks the creature out for a moment.
  hurt(c, amount, k, cause, jolt = 0) {
    if (amount <= 0) return;
    const sp = c.sp;
    if (k >= 0) this.injure(c, k, amount, cause, jolt);
    if (!c.alive) return;
    // Part of a cut's harm comes later, as blood loss.
    c.hp -= amount * (Creatures.CUTS[cause] ? 0.65 : 1);
    c.cause = cause;
    if (amount >= 1 || jolt > 0) { c.hurtT = 150; c.hurtFlash = Math.max(c.hurtFlash, jolt > 4 ? 8 : 3); }
    if (jolt > 6) c.stun = Math.max(c.stun, Math.min(140, jolt * 3));
    // A hard knock throws out a spray of blood from the wound.
    if (this.gore && sp.bleeds && k >= 0 && jolt > 6 && Creatures.CUTS[cause]) this.spray(c, k, Math.min(8, Math.round(jolt / 6)), 1.2);
    if (k >= 0 && c.limb[k] === HEAD && c.limbHp[HEAD] < -sp.hp * 0.4) { c.cause = 'head'; this.die(c); return; }
    if (c.hp <= 0) this.die(c);
  }

  die(c) {
    c.alive = false; c.hp = 0; c.strength = 0; c.speed = 0; c.mood = 'dead';
    const w = this.world;
    if (c.cause === 'drown') w.discover(DISC.DROWN);
    else if (c.cause === 'crush' || c.cause === 'buried') w.discover(DISC.CRUSH);
  }

  // Bleeding, healing and passing out, every step.
  // Wounds clot slowly. While the heart beats, a bad wound spurts in time
  // with it; after death blood only oozes out under its own weight.
  bloodStep(c) {
    const sp = c.sp;
    let total = 0, worst = -1, wb = 0;
    for (let k = 0; k < c.n; k++) {
      const b = c.bleed[k];
      if (b < 0.002) { c.bleed[k] = 0; continue; }
      total += b;
      if (b > wb) { wb = b; worst = k; }
      c.bleed[k] = b * (c.alive ? 0.9985 : 0.995);
      if (this.gore && Math.random() < b * (c.alive ? 0.05 : 0.025)) this.spray(c, k, 1, 0.15);
    }
    if (!c.alive) return;
    if (total > 0) {
      c.hp -= total * 0.01;
      if (c.hp <= 0) { c.cause = 'bleed'; this.die(c); return; }
      if (this.gore && worst >= 0 && wb > 0.5 && c.age % 42 === 0) this.spray(c, worst, 1 + Math.round(wb * 2), 0.9 + wb * 0.5);
    } else if (c.fire <= 0 && c.hp < sp.hp && c.kind !== 'robot') {
      // Healing slowly once nothing is bleeding.
      c.hp = Math.min(sp.hp, c.hp + 0.012);
      for (let L = 0; L < 7; L++) if (c.limbHp[L] < sp.hp * 0.6) c.limbHp[L] += 0.006;
    }
    // Badly hurt: passes out and lies still until a little better.
    if (c.hp < sp.hp * 0.2) { c.stun = Math.max(c.stun, 10); c.mood = 'out'; }
  }

  // Blood (or oil, for a robot) out of point k: `force` sends it flying
  // in an arc away from the body, a small force just lets it drip.
  spray(c, k, n, force) {
    const w = this.world, t = c.sp.bleeds;
    if (!t) return;
    const r = c.r[k] + 0.6;
    for (let j = 0; j < n; j++) {
      const a = Math.random() * Math.PI * 2;
      const i = this.cellIndex(c.px[k] + Math.cos(a) * r, c.py[k] + Math.sin(a) * r);
      if (i < 0 || w.type[i] !== EMPTY) continue;
      w.set(i, t);
      if (force > 0.3) {
        w.vx[i] = Math.cos(a) * force * (0.6 + Math.random() * 0.8);
        w.vy[i] = Math.abs(Math.sin(a)) * force * (0.5 + Math.random() * 0.9) + force * 0.3;
      }
    }
  }

  // A limb comes off: break every stick joining it to the rest of the body.
  // Both sides of the cut bleed hard at first.
  detach(c, limb) {
    if (limb === CORE) return;
    let broke = false;
    for (const s of c.sticks) {
      if (s.broken) continue;
      if ((c.limb[s.a] === limb) !== (c.limb[s.b] === limb)) {
        s.broken = true; broke = true;
        c.bleed[s.a] = Math.max(c.bleed[s.a], 1.4); c.bleed[s.b] = Math.max(c.bleed[s.b], 1.4);
        c.cut[s.a] += 30; c.cut[s.b] += 30;
      }
    }
    if (!broke) return;
    for (let k = 0; k < c.n; k++) if (c.limb[k] === limb) c.detached[k] = 1;
    if (limb === HEAD && c.alive) { c.cause = 'head'; this.die(c); }
  }

  turnZombie(c) {
    if (c.kind !== 'human' || c.char > 0.6 || c.detached[c.sp.headK]) return;
    const z = SPECIES.zombie;
    c.kind = 'zombie'; c.sp = z;
    c.colors = z.colors(Math.random, c.colors);
    c.hp = z.hp * (c.alive ? 1 : 0.6); c.alive = true; c.stun = 60; c.fire = 0; c.mood = 'walk';
    this.world.discover(DISC.INFECTION);
  }

  // ----- marking bodies in the grid -----
  // The cells under every visible part of every body become BODY while the
  // world steps, so falling and flowing things treat bodies as solid.
  stamp() {
    const w = this.world, type = w.type, W = w.W, H = w.H, was = this.was;
    // Swap lists: last step's cells are kept to see which ones the bodies left.
    const prev = this.stamped;
    const st = this.stamped = this.prevStamped;
    this.prevStamped = prev;
    st.length = 0;
    this.owner.clear();
    // Every cell a part overlaps, so nothing can settle into the body.
    const mark = (x, y, r, tag) => {
      const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(W - 1, Math.floor(x + r));
      const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(H - 1, Math.floor(y + r));
      for (let iy = y0; iy <= y1; iy++) for (let ix = x0; ix <= x1; ix++) {
        const i = ix + W * iy;
        if (type[i] !== EMPTY) continue;
        type[i] = BODY;
        st.push(i);
        this.owner.set(i, tag);
        if (was[i] === 1) was[i] = 2;   // still covered
        else this.wake(i);              // newly covered
      }
    };
    for (const c of this.list) {
      const id = c.id << 8;
      for (const s of c.sticks) {
        if (s.broken || !s.thick) continue;
        const ax = c.px[s.a], ay = c.py[s.a];
        const dx = c.px[s.b] - ax, dy = c.py[s.b] - ay;
        const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 1.5));
        const r = Math.min(0.55, s.thick * 0.45);
        for (let j = 0; j <= n; j++) mark(ax + dx * j / n, ay + dy * j / n, r, id | (j * 2 < n ? s.a : s.b));
      }
      const h = c.sp.headK;
      mark(c.px[h], c.py[h], c.r[h] * 0.9, id | h);
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
    w.wakeAt(i); // also wakes the region above or beside, at a region edge
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
  // Nearest body point to (x, y) within maxD.
  pickPoint(x, y, maxD) {
    let best = null, bd = maxD;
    for (const c of this.list) {
      for (let k = 0; k < c.n; k++) {
        const d = Math.hypot(c.px[k] - x, c.py[k] - y);
        if (d < bd) { bd = d; best = { c, k }; }
      }
    }
    return best;
  }

  startGrab(c, k) {
    c.grab = { k, x: c.px[k], y: c.py[k] };
    if (c.alive) { c.mood = 'panic'; c.hurtT = 150; }
  }
  moveGrab(c, x, y) { if (c.grab) { c.grab.x = x; c.grab.y = y; } }
  release(c) { if (c) { c.grab = null; c.stun = Math.max(c.stun, 25); } }

  // The Wind tool pushes bodies away; a strong gust knocks them over.
  blow(x, y, r) {
    for (const c of this.list) {
      let hit = 0;
      for (let k = 0; k < c.n; k++) {
        const dx = c.px[k] - x, dy = c.py[k] - y, d = Math.hypot(dx, dy);
        if (d > r || d < 0.01) continue;
        const f = (1 - d / r) * 0.12;
        c.ox[k] -= dx / d * f; c.oy[k] -= dy / d * f + f * 0.3;
        hit = Math.max(hit, f);
      }
      if (hit > 0.07 && c.alive) c.stun = Math.max(c.stun, 20);
    }
  }

  // The eraser removes any creature it touches.
  eraseAt(x, y, r) {
    for (let j = this.list.length - 1; j >= 0; j--) {
      const c = this.list[j];
      for (let k = 0; k < c.n; k++) {
        if (Math.hypot(c.px[k] - x, c.py[k] - y) <= r + 0.8) { this.list.splice(j, 1); break; }
      }
    }
  }

  // Short status text for the inspector.
  describe(c) {
    const bits = [c.sp.name];
    if (!c.alive) bits.push(c.char >= 0.6 ? 'charred' : 'dead');
    else {
      bits.push(`${Math.max(1, Math.round(c.hp))}/${c.sp.hp} HP`);
      if (c.mood === 'out' && c.stun > 0) bits.push('unconscious');
      else if (c.fire > 0) bits.push('burning');
      else if (c.sp.breathes && c.oxygen < 200) bits.push(c.sp.breathes === 'water' ? 'gasping' : 'out of breath');
      else if (c.infected) bits.push('bitten');
      else if (c.swimming) bits.push('swimming');
      else if (c.sp.grazes && c.mood === 'idle' && c.speed === 0) bits.push('grazing');
      else if (c.mood === 'fly') bits.push('flying');
      else if (c.stun > 0 && !c.grab) bits.push('knocked out');
      else if (c.mood === 'flee' || c.mood === 'panic') bits.push('scared');
      const bleeding = c.bleed.reduce((a, b) => a + b, 0);
      if (bleeding > 0.5) bits.push('bleeding badly'); else if (bleeding > 0.05) bits.push('bleeding');
      const broken = [];
      if (c.limbHp[ARM_L] <= 0 || c.limbHp[ARM_R] <= 0) broken.push('arm');
      if (c.limbHp[LEG_L] <= 0 || c.limbHp[LEG_R] <= 0) broken.push('leg');
      if (broken.length) bits.push('broken ' + broken.join(' and '));
    }
    return bits.join(' · ');
  }
}

// A creature standing in its rest pose with fixed colours, for icons.
export function iconCreature(kind) {
  let a = 7 + kind.length * 31;
  const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  return new Creature(kind, 0, 0, 1, SPECIES[kind].colors(rand));
}
