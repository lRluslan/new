// Life: what creatures do on their own, and the little ecosystem around them.
//
// Every creature has needs that slowly grow: hunger, thirst and tiredness
// (energy). When nothing is chasing or burning it, it looks after them:
// it walks to food and eats, walks to water and drinks, and sleeps at its
// time of day. People also gather wood, build little huts, sleep at home,
// shelter from the rain, pick up seeds and plant trees. Well-fed grown-ups
// have babies, which grow up. Hungry cats and dogs hunt small animals.
//
// The world keeps going too: in daylight grass grows back on open soil and
// trees drop seeds, which grow into new trees where there is room. Bodies
// return to the soil after a while.
//
// All movement still goes through the ragdoll muscles in creatures.js; this
// file only decides where to go and what to do there.

import * as El from './elements.js';
import { NATURAL_SEED, PASS, BACKWALL } from './world.js';

const { EMPTY, DIRT, WATER, PLANT, SEED, CORN, POPCORN, HONEY, FLOWER, WOOD, DRIED_BLOOD, STATE, SOLID, POWDER, LIQUID, GAS, DISC } = El;

const DAY = 14400;            // simulation steps in a day (four minutes at 60 steps a second)
const THINKS = DAY / 5;       // creatures think every 5 steps
const HUNGER = 1 / (0.9 * THINKS), THIRST = 1 / (1.2 * THINKS);
const TIRE = 1 / (0.7 * THINKS), REST = 1 / (0.22 * THINKS);
const GROW = 0.5 / (1.6 * THINKS); // a baby grows up in about a day and a half
const GROWING = 8;            // world flag: the tip of a growing tree

// How each kind lives. eats: food cells (or 'meat'). hunts: what it catches
// when hungry. metab: how fast it gets hungry (a hunter's big meal lasts). sleeps: when it sleeps. life: lifespan in days. cap: most of
// this kind at once (for babies). social: flock, follow people, or chat.
const LIFE = {
  human:   { eats: [CORN, POPCORN, HONEY], forage: true, drinks: true, sleeps: 'night', life: 16, cap: 8, social: 'chat', builds: true, plants: true },
  // The dog is a companion: it follows people, who share their food with it.
  dog:     { eats: 'meat', drinks: true, sleeps: 'night', life: 11, cap: 5, social: 'follow', metab: 0.4 },
  cat:     { eats: 'meat', hunts: ['bird', 'frog', 'chicken'], drinks: true, sleeps: 'day', life: 11, cap: 5, metab: 0.4 },
  sheep:   { eats: [PLANT], drinks: true, sleeps: 'night', life: 10, cap: 8, social: 'flock' },
  chicken: { eats: [SEED, CORN, POPCORN, FLOWER, PLANT], drinks: true, sleeps: 'night', life: 8, cap: 8, social: 'flock' },
  bird:    { eats: [SEED, CORN, POPCORN, FLOWER, PLANT], sleeps: 'night', life: 8, cap: 6, social: 'flock' },
  frog:    { sleeps: 'day', life: 7, cap: 6 },
  fish:    { life: 8, cap: 8 },
  robot:   { plants: true },
};
// How much a mouthful takes off hunger.
const FOOD = { [PLANT]: 0.28, [SEED]: 0.3, [CORN]: 0.4, [POPCORN]: 0.45, [HONEY]: 0.5, [FLOWER]: 0.3 };
const MEAT_KINDS = new Set(['dog', 'cat', 'sheep', 'chicken', 'bird', 'frog', 'fish']);
const TASK_WORDS = {
  eat: 'eating', drink: 'drinking', meat: 'eating', chop: 'gathering wood', pickup: 'picking up a seed',
  plant: 'planting a tree', build: 'building a home', home: 'going home',
};

const isGround = t => (STATE[t] === SOLID || STATE[t] === POWDER) && t !== PLANT && t !== El.BODY;
const isOpen = t => t === EMPTY || t === PLANT || STATE[t] === GAS;

export class Life {
  constructor(creatures, world) {
    this.cr = creatures;
    this.w = world;
    this.night = 0;        // 0 day .. 1 night (set by the game each frame)
    this.raining = false;
    this.clock = 0;
    this.homes = [];
    this.plants = 0; this.seeds = 0; this.plantBudget = 0;
  }

  reset() { this.homes.length = 0; this.plantBudget = 0; this.clock = 0; }

  // ----- every step: the world's own life -----
  tick() {
    this.clock++;
    if (this.clock % 30 === 0) this.upkeep();
    if (this.clock % 120 === 1) this.census();
    if (this.night < 0.55) this.grow();
  }

  // Count plants and seeds now and then, to keep growth in check.
  census() {
    const type = this.w.type;
    let p = 0, s = 0;
    for (let i = 0; i < type.length; i++) { const t = type[i]; if (t === PLANT) p++; else if (t === SEED) s++; }
    this.plants = p; this.seeds = s;
    // The forest can fill in a little beyond what it started with, no more.
    if (!this.plantBudget) this.plantBudget = Math.max(p * 1.25, type.length * 0.03);
  }

  // Look at a few random cells each step: grass grows back on open soil and
  // leaves high in a tree drop seeds.
  grow() {
    const w = this.w, { W, H, type } = w;
    for (let s = 0; s < 30; s++) {
      const i = W + ((Math.random() * W * (H - 4)) | 0), t = type[i];
      if (t === DIRT) {
        if (this.plants > this.plantBudget || Math.random() > 0.08) continue;
        if (type[i + W] !== EMPTY || type[i + 2 * W] !== EMPTY) continue;
        const T = w.temp[i + W];
        if (T < 3 || T > 40) continue;
        const x = i % W, y = (i / W) | 0;
        let near = false;
        for (let dx = -2; dx <= 2 && !near; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < W && type[nx + W * (y + 1)] === PLANT) near = true;
        }
        if (near || this.inHome(x, y + 1)) continue;
        w.set(i + W, PLANT); w.life[i + W] = 0;
        if (Math.random() < 0.5) { w.set(i + 2 * W, PLANT); w.life[i + 2 * W] = 0; }
        this.plants += 2;
      } else if (t === PLANT && Math.random() < 0.012 && this.seeds < W / 18) {
        // Only leaves with open air below them for a few cells: tree canopies.
        if (type[i - W] !== EMPTY || type[i - 2 * W] !== EMPTY || type[i - 3 * W] !== EMPTY || i < 4 * W) continue;
        w.set(i - W, SEED); w.life[i - W] = NATURAL_SEED;
        this.seeds++;
      }
    }
  }

  // Bodies return to the soil; homes that have burnt or been knocked down
  // are given up.
  upkeep() {
    const list = this.cr.list, w = this.w;
    for (let k = list.length - 1; k >= 0; k--) {
      const c = list[k];
      if (c.alive || c.deadT < DAY * 0.35 || c.grab) continue;
      const i = this.cr.cellIndex(c.px[c.sp.rootK], c.py[c.sp.rootK]);
      if (i >= 0 && isOpen(w.type[i]) && STATE[w.type[i]] !== GAS) w.set(i, DIRT);
      list.splice(k, 1);
    }
    for (let k = this.homes.length - 1; k >= 0; k--) {
      const h = this.homes[k];
      let n = 0;
      for (const i of h.cells) if (w.type[i] === WOOD) n++;
      if (n < h.cells.length * 0.6) { h.ok = false; this.homes.splice(k, 1); }
    }
    for (const c of list) {
      if (c.home && !c.home.ok) c.home = null;
      if (c.avoid.size > 40) for (const [i, until] of c.avoid) if (until < c.age) c.avoid.delete(i);
    }
  }

  inHome(x, y) {
    return this.homes.some(h => x >= h.x0 - 1 && x <= h.x0 + 9 && y >= h.y0 - 1 && y <= h.y0 + h.hw + 3);
  }

  // ----- every think: needs, growing up, old age, babies -----
  needs(c) {
    if (c.alarmT > 0) c.alarmT--;
    if (c.chatT > 0 && (!c.partner || !c.partner.alive)) c.chatT = 0;
    const L = LIFE[c.kind];
    if (!L || !c.alive) return;
    const asleep = c.mood === 'sleep';
    if (L.eats) c.hunger = Math.min(1.2, c.hunger + HUNGER * (asleep ? 0.4 : 1) * (L.metab || 1));
    if (L.drinks) c.thirst = Math.min(1.2, c.thirst + THIRST * (asleep ? 0.4 : 1));
    if (L.sleeps) c.energy = asleep ? Math.min(1, c.energy + REST) : Math.max(0, c.energy - TIRE * (c.speed > c.sp.walk * 1.3 ? 2 : 1));
    if (c.hunger >= 1 || c.thirst >= 1) this.cr.hurt(c, 0.06, -1, c.hunger >= 1 ? 'hunger' : 'thirst');
    if (c.size < 1) {
      const s = Math.min(1, c.size + GROW);
      // Stretch the body in small steps, so the ragdoll stays smooth.
      if (s >= 1 || Math.floor(s * 60) !== Math.floor(c.size * 60)) this.cr.setSize(c, s); else c.size = s;
    }
    if (L.life && c.age > L.life * DAY && Math.random() < 0.0004) { c.cause = 'age'; this.cr.die(c); return; }
    if (L.cap) {
      if (c.breedT > 0) c.breedT--;
      else if (Math.random() < 0.05) this.tryBreed(c, L);
    }
  }

  // Two well-fed grown-ups of the same kind, close together, have a baby.
  tryBreed(c, L) {
    if (c.size < 0.97 || c.hunger > 0.4 || c.thirst > 0.6 || c.mood === 'sleep' || c.fire > 0 || c.stun > 0 || this.night > 0.6) return;
    const list = this.cr.list;
    let same = 0;
    for (const o of list) if (o.alive && o.kind === c.kind) same++;
    if (same >= L.cap || list.length >= 36) return;
    const mate = this.cr.nearest(c, o => o.alive && o.kind === c.kind && o.size >= 0.97 && o.breedT <= 0 &&
      o.hunger < 0.45 && o.mood !== 'sleep' && o.fire <= 0, 14);
    if (!mate) return;
    c.breedT = mate.breedT = 1.3 * THINKS * (0.8 + Math.random() * 0.4);
    c.hunger += 0.2; mate.hunger += 0.2;
    const k0 = c.sp.rootK;
    const x = (c.px[k0] + mate.px[mate.sp.rootK]) / 2;
    const y = c.sp.swimmer ? c.py[k0] : c.py[k0] - c.sp.rest[k0][1] * c.size + 0.3;
    const baby = this.cr.spawn(c.kind, x, y, c.facing, 0.5);
    // A mix of both parents' looks.
    const col = {};
    for (const key of Object.keys(c.colors)) col[key] = (Math.random() < 0.5 ? c : mate).colors[key];
    baby.colors = col;
    baby.hunger = 0.15; baby.energy = 1; baby.breedT = 2 * THINKS;
    baby.mother = c; baby.home = c.home || mate.home;
    for (const o of [c, mate]) this.w.addFx({ k: 'heart', x: o.px[o.sp.headK], y: o.py[o.sp.headK] + 1.5 });
    this.w.addFx({ k: 'born', x, y: y + 1, c: baby });
    this.w.discover(DISC.BIRTH);
  }

  // ----- deciding what to do -----
  // Called when nothing is chasing or burning the creature. Returns true if
  // it has decided, false to let it simply wander.
  decide(c) {
    const L = LIFE[c.kind];
    if (!L) return false;
    c.act = null;
    if (c.mood === 'sleep') {
      if (!this.wakes(c, L)) {
        c.speed = 0;
        if (Math.random() < 0.035) this.w.addFx({ k: 'zz', x: c.px[c.sp.headK], y: c.py[c.sp.headK] + 1 });
        return true;
      }
      c.mood = 'idle'; c.moodT = 20; c.speed = 0;
    }
    // In over its head: make for dry land (frogs are at home in the water).
    if (c.kind !== 'frog' && !c.sp.swimmer && (c.swimming || STATE[this.w.type[this.cr.cellIndex(c.px[c.sp.rootK], c.py[c.sp.rootK])]] === LIQUID)) {
      const dir = this.shoreDir(c);
      if (dir) { c.facing = dir; c.speed = c.sp.walk * 1.5; c.mood = 'walk'; if (c.task && c.task.kind !== 'drink') c.task = null; return true; }
    }
    // Desperately hungry or thirsty: that comes before bed and shelter.
    const desperate = c.hunger > 0.9 || c.thirst > 0.9;
    if (L.sleeps && !desperate && this.sleepy(c, L)) {
      if (c.home && !this.atHome(c) && c.energy > 0.03 && !(c.homeFailT > c.age)) { if (this.goHome(c)) return true; }
      // Not right by the water: lying down there could mean a face in the pond.
      const wet = (c.dryT || 0) < 40 ? this.waterNear(c) : 0;
      if (wet) { c.dryT = (c.dryT || 0) + 1; c.facing = -wet; c.speed = c.sp.walk; c.mood = 'walk'; c.task = null; return true; }
      const inWater = STATE[this.w.type[Math.max(0, this.cr.cellIndex(c.px[c.sp.rootK], c.py[c.sp.rootK]))]] === LIQUID;
      if (c.grounded && !c.swimming && !inWater && c.oxygen > 590) { c.mood = 'sleep'; c.speed = 0; c.task = null; c.dryT = 0; return true; }
    }
    // People head home out of the rain.
    if (this.raining && c.home && c.kind === 'human' && !desperate) {
      if (!this.atHome(c)) { if (!(c.homeFailT > c.age) && this.goHome(c)) return true; }
      else { c.speed = 0; c.mood = 'idle'; return true; }
    }
    if (c.chatT > 0) {
      c.chatT--; c.speed = 0; c.mood = 'idle';
      if (c.partner) c.facing = c.partner.px[c.partner.sp.rootK] >= c.px[c.sp.rootK] ? 1 : -1;
      return true;
    }
    if (c.task) { if (this.work(c)) return true; c.task = null; }
    if (c.lookT > 0) c.lookT--;
    else {
      const t = this.choose(c, L);
      c.lookT = t ? 0 : 5;
      if (t) { this.setTask(c, t); if (this.work(c)) return true; }
    }
    return this.social(c, L);
  }

  goHome(c) {
    if (!c.task || c.task.kind !== 'home') this.setTask(c, { kind: 'home' });
    return this.work(c);
  }

  sleepy(c, L) {
    if (c.energy < 0.08) return true;
    if (L.sleeps === 'night') return this.night > 0.62;
    return this.night < 0.25 && c.energy < 0.7;
  }

  wakes(c, L) {
    if (c.hunger > 0.97 || c.thirst > 0.97 || c.oxygen < 500) return true;
    if (L.sleeps === 'night') return (this.night < 0.35 && c.energy > 0.6) || (this.night < 0.62 && c.energy >= 1);
    return this.night > 0.5 || c.energy >= 1;
  }

  // Pick the most pressing thing to do.
  choose(c, L) {
    const w = this.w, type = w.type;
    if (L.drinks && c.thirst > 0.55) {
      // Water can be far away: a thirsty animal will cross the whole glade for it.
      const i = this.find(c, (t, i, x, y) => t === WATER && this.openAbove(i, 6) && this.shore(x, y), w.W);
      if (i >= 0) return { kind: 'drink', i };
    }
    // Once it starts eating, it eats until it is full.
    if (c.hunger > 0.45 || (c.eatMore && c.hunger > 0.12)) {
      c.eatMore = true;
      if (Array.isArray(L.eats)) {
        // (Not food lying under water.)
        const i = this.find(c, (t, i) => L.eats.includes(t) && STATE[type[i + w.W]] !== LIQUID, 55, c.sp.flies ? 40 : 0);
        if (i >= 0) return { kind: 'eat', i };
      }
      if (L.forage) {
        const i = this.find(c, (t, i, x, y) => t === PLANT && !this.inHome(x, y), 50);
        if (i >= 0) return { kind: 'eat', i };
      }
      if (L.eats === 'meat') {
        const o = this.cr.nearest(c, o => !o.alive && !o.grab && MEAT_KINDS.has(o.kind) && o.meat > 0 && o.char < 0.6, 60);
        if (o) return { kind: 'meat', o };
      }
      c.eatMore = false; // nothing to eat around here
    } else c.eatMore = false;
    if (c.size < 0.97) return null;
    if (L.builds && !c.home && this.night < 0.55) {
      // A half-built hut to finish?
      if (c.site) {
        const left = c.site.cells.filter(i => type[i] !== WOOD).length;
        if (!left) { this.finishHome(c, c.site); c.site = null; return null; }
        if (c.inv.wood >= Math.min(left, 12)) return { kind: 'build', site: c.site, n: 0 };
      }
      const site = !c.site && c.inv.wood >= 45 ? this.findSite(c) : null;
      if (site && c.inv.wood >= site.cells.length) return { kind: 'build', site, n: 0 };
      if (c.inv.wood < 60) {
        const i = this.find(c, (t, i, x, y) => this.choppable(i, x, y), 60);
        if (i >= 0) return { kind: 'chop', i };
      }
    }
    if (L.plants && c.inv.seed > 0 && Math.random() < 0.3) {
      const i = this.plantSpot(c);
      if (i >= 0) return { kind: 'plant', i };
    }
    if (L.plants && c.inv.seed < 4) {
      const i = this.find(c, t => t === SEED, 40);
      if (i >= 0) return { kind: 'pickup', i };
    }
    return null;
  }

  setTask(c, t) {
    t.t = 0; t.work = 0; t.lastX = c.px[c.sp.rootK];
    c.task = t;
  }

  giveUp(c) {
    const t = c.task;
    if (t && t.i >= 0) c.avoid.set(t.i, c.age + 4000);
    if (t && t.site) c.avoid.set(-t.site.x0 - 1, c.age + 4000);
    if (t && t.kind === 'home') c.homeFailT = c.age + 3000; // cannot get home: sleep where it is
    c.task = null; c.lookT = 4;
    return false;
  }

  // Where the current task is, in world cells.
  target(c) {
    const t = c.task, W = this.w.W;
    if (!t) return null;
    if (t.o) return [t.o.px[t.o.sp.rootK], t.o.py[t.o.sp.rootK]];
    if (t.kind === 'home') return c.home ? [c.home.x0 + 4.5, c.home.y0 + 0.5] : null;
    if (t.kind === 'build') { const i = t.site.cells[Math.min(t.n, t.site.cells.length - 1)]; return [i % W + 0.5, ((i / W) | 0) + 0.5]; }
    return [t.i % W + 0.5, ((t.i / W) | 0) + 0.5];
  }

  // Walk to the task and do it. Returns false when the task is over.
  work(c) {
    const t = c.task, w = this.w, W = w.W, type = w.type, sp = c.sp, k0 = sp.rootK;
    if (++t.t > 700) return this.giveUp(c);
    // Is the thing still there?
    switch (t.kind) {
      case 'eat': if (!(FOOD[type[t.i]] || type[t.i] === PLANT)) return false; break;
      case 'drink': if (type[t.i] !== WATER) return false; break;
      case 'chop': if (type[t.i] !== WOOD) return false; break;
      case 'pickup': if (type[t.i] !== SEED) return false; break;
      case 'plant': if (!isOpen(type[t.i]) || type[t.i - W] !== DIRT || c.inv.seed <= 0) return false; break;
      case 'meat': if (t.o.alive || t.o.meat <= 0 || !this.cr.list.includes(t.o)) return false; break;
      case 'home': if (!c.home) return false; break;
      case 'build': {
        const cells = t.site.cells;
        while (t.n < cells.length && type[cells[t.n]] === WOOD) t.n++;
        if (t.n >= cells.length) { this.finishHome(c, t.site); c.site = null; return false; }
        // Out of planks: remember the spot, fetch more wood, come back to finish.
        if (c.inv.wood <= 0) { c.site = t.site; return false; }
        // Something solid is in the way: leave that plank out.
        if (!isOpen(type[cells[t.n]])) { t.n++; return true; }
        break;
      }
    }
    const [tx, ty] = this.target(c);
    const rx = c.px[k0], foot = c.py[k0] - sp.rest[k0][1] * c.size;
    const tall = sp.height * c.size;
    const drink = t.kind === 'drink';
    const reachX = t.kind === 'build' ? 6 : t.kind === 'home' ? 1.2 : (drink ? 3.2 + sp.length * 0.5 : 1.4 + 1.3 * c.size) * (drink ? c.size : 1) + (t.kind === 'meat' ? 1 : 0);
    const reachUp = t.kind === 'build' ? 8 : 2;
    let near = Math.abs(tx - rx) <= reachX && ty >= foot - (drink ? 6 : 3) && ty <= foot + tall + reachUp;
    // Stopped at the top of the bank above the water: lean down and drink from there.
    if (drink && c.age - (c.edgeAt ?? -1e9) < 15 && Math.abs(tx - rx) < 10 && ty < foot + 1) near = true;
    if (!near) {
      c.facing = tx >= rx ? 1 : -1;
      c.speed = sp.walk * (t.kind === 'meat' || c.hunger > 0.8 || c.thirst > 0.8 ? 1.5 : 1);
      c.mood = 'walk';
      // Not getting anywhere (a wall, a cliff, deep water): give up on it.
      if (t.t % 80 === 0) {
        if (Math.abs(rx - t.lastX) < 1.5) return this.giveUp(c);
        t.lastX = rx;
      }
      return true;
    }
    c.speed = 0; c.mood = 'idle';
    if (Math.abs(tx - rx) > 0.4) c.facing = tx >= rx ? 1 : -1;
    t.work++;
    switch (t.kind) {
      case 'eat': {
        c.act = 'eat';
        if (t.work < 6) return true;
        const food = type[t.i];
        c.hunger = Math.max(0, c.hunger - (c.kind === 'human' && food === PLANT ? 0.22 : FOOD[food] || 0.2));
        w.addFx({ k: 'crumb', x: tx, y: ty, t: food });
        // People share with a dog at their side.
        if (c.kind === 'human') for (const o of this.cr.list) {
          if (o.alive && o.kind === 'dog' && o.hunger > 0.2 && Math.abs(o.px[o.sp.rootK] - rx) < 10) {
            o.hunger = Math.max(0, o.hunger - 0.3);
            w.addFx({ k: 'heart', x: o.px[o.sp.headK], y: o.py[o.sp.headK] + 1.5 });
          }
        }
        w.set(t.i, EMPTY);
        if (c.kind === 'sheep') w.discover(DISC.GRAZE);
        // Still hungry: look for the next mouthful straight away.
        c.lookT = 0;
        return false;
      }
      case 'drink':
        c.act = 'drink';
        if (t.work % 4 === 0) w.addFx({ k: 'sip', x: tx, y: ty });
        if (t.work < 12) return true;
        c.thirst = 0;
        if (Math.random() < 0.15) w.set(t.i, EMPTY);
        return false;
      case 'meat': {
        c.act = 'eat';
        if (t.work % 8 !== 0) return true;
        const o = t.o;
        o.meat -= 0.25; c.hunger = Math.max(0, c.hunger - 0.3);
        w.addFx({ k: 'crumb', x: tx, y: ty + 0.5, t: this.cr.gore ? El.BLOOD : PLANT });
        w.discover(DISC.FOOD_CHAIN);
        if (o.meat <= 0) {
          const i = this.cr.cellIndex(tx, ty);
          if (this.cr.gore && i >= 0 && type[i] === EMPTY) w.set(i, DRIED_BLOOD);
          this.cr.list.splice(this.cr.list.indexOf(o), 1);
          return false;
        }
        return c.hunger > 0.05;
      }
      case 'chop':
        c.act = 'chop';
        if (t.work % 6 === 0) w.addFx({ k: 'chips', x: tx, y: ty });
        if (t.work < 24) return true;
        w.set(t.i, EMPTY);
        c.inv.wood += 4;
        return false;
      case 'pickup':
        c.act = 'plant';
        if (t.work < 4) return true;
        w.set(t.i, EMPTY);
        c.inv.seed++;
        return false;
      case 'plant':
        c.act = 'plant';
        if (t.work < 10) return true;
        w.set(t.i, SEED);
        c.inv.seed--;
        w.addFx({ k: 'crumb', x: tx, y: ty, t: SEED });
        w.discover(DISC.FORESTER);
        return false;
      case 'build': {
        c.act = 'build';
        if (t.work % 4 !== 0) return true;
        const i = t.site.cells[t.n];
        const bx = i % W + 0.5, by = ((i / W) | 0) + 0.5;
        // Never build a plank into someone: step aside and wait.
        for (const o of this.cr.list) for (let k = 0; k < o.n; k++) {
          if (Math.abs(o.px[k] - bx) < 1.2 && Math.abs(o.py[k] - by) < 1.2) {
            if (o === c) { c.facing = rx < bx ? -1 : 1; c.speed = sp.walk; c.act = null; }
            return true;
          }
        }
        if (t.n === 0) for (const j of t.site.clear) if (type[j] === PLANT) w.set(j, EMPTY);
        w.set(i, WOOD);
        // The walls are the back of the hut: people walk in and out past them.
        if (!t.site.solid.has(i)) w.flags[i] |= PASS | BACKWALL;
        c.inv.wood--;
        t.n++;
        w.addFx({ k: 'knock', x: bx, y: by });
        return true;
      }
      case 'home':
        return false;
    }
    return false;
  }

  atHome(c) {
    const h = c.home;
    if (!h) return false;
    const k0 = c.sp.rootK, x = c.px[k0], foot = c.py[k0] - c.sp.rest[k0][1] * c.size;
    return x > h.x0 + 1 && x < h.x0 + 8 && Math.abs(foot - h.y0) < 3;
  }

  // ----- finding things -----
  // Nearest cell (by walking distance, roughly) that passes test, in a band
  // around the creature's height. Birds look further down.
  find(c, test, R, below = 0) {
    const w = this.w, W = w.W, H = w.H, type = w.type, sp = c.sp, k0 = sp.rootK;
    const cx = Math.floor(c.px[k0]), foot = Math.floor(c.py[k0] - sp.rest[k0][1] * c.size);
    const y0 = Math.max(1, foot - 4 - below), y1 = Math.min(H - 2, foot + Math.ceil(sp.height * c.size) + 2);
    const x0 = Math.max(0, cx - R), x1 = Math.min(W - 1, cx + R);
    let best = -1, bd = Infinity;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = x + W * y;
      if (!test(type[i], i, x, y)) continue;
      const d = Math.abs(x - cx) + 2 * Math.abs(y - foot);
      if (d >= bd) continue;
      const until = c.avoid.get(i);
      if (until && until > c.age) continue;
      bd = d; best = i;
    }
    return best;
  }

  // Nothing but air for n cells above cell i (no dock overhead).
  openAbove(i, n) {
    const w = this.w, W = w.W, type = w.type;
    for (let k = 1; k <= n; k++) { const j = i + k * W; if (j >= type.length) break; if (type[j] !== EMPTY && type[j] !== PLANT) return false; }
    return true;
  }

  // Water at the edge of dry land, where an animal can drink without wading in.
  shore(x, y) {
    const w = this.w, W = w.W, type = w.type;
    for (const dx of [-2, -1, 1, 2]) {
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      for (let dy = 0; dy <= 2; dy++) {
        const t = type[nx + W * (y + dy)];
        if (isGround(t) && t !== WOOD && type[nx + W * (y + dy + 1)] !== WATER) return true;
      }
    }
    return false;
  }

  // Which side water is on, within a few cells of where a creature stands (or 0).
  waterNear(c) {
    const w = this.w, W = w.W, type = w.type, k0 = c.sp.rootK;
    const x = Math.floor(c.px[k0]), foot = Math.floor(c.py[k0] - c.sp.rest[k0][1] * c.size);
    const R = Math.ceil(c.sp.height * c.size * 0.6) + 2;
    for (let d = 0; d <= R; d++) for (const s of [-1, 1]) {
      const nx = x + s * d;
      if (nx < 0 || nx >= W) continue;
      for (let y = foot - 2; y <= foot + 1; y++) if (y >= 0 && STATE[type[nx + W * y]] === LIQUID) return s;
    }
    return 0;
  }

  // Which way the nearest dry land is from a creature in the water (or 0).
  shoreDir(c) {
    const w = this.w, W = w.W, type = w.type, k0 = c.sp.rootK;
    const x = Math.floor(c.px[k0]), y = Math.floor(c.py[k0]);
    for (let d = 1; d < 80; d++) for (const s of [-1, 1]) {
      const nx = x + s * d;
      if (nx < 1 || nx >= W - 1) continue;
      for (let dy = -2; dy <= 24; dy++) { // from the bottom of a pond, the shore is far above
        const ny = y + dy;
        if (ny < 1 || ny >= w.H - 1) continue;
        const i = nx + W * ny, up = type[i + W];
        // Real dry land: open ground with air above it (not a dock post).
        if (isGround(type[i]) && type[i] !== WOOD && (up === EMPTY || up === PLANT)) return s;
      }
    }
    return 0;
  }

  // A loose bit of wood people can take: the open top of a log, a post or a
  // branch end, never a growing tree, a home or wood over water.
  choppable(i, x, y) {
    const w = this.w, W = w.W, type = w.type;
    if (type[i] !== WOOD || (w.flags[i] & (GROWING | PASS)) || type[i + W] === WOOD) return false;
    let wood = 0, open = false;
    for (const n of [i - 1, i + 1, i - W, i + W]) {
      if (type[n] === WOOD) wood++;
      else if (type[n] === EMPTY) open = true;
    }
    if (!open || wood > 2) return false;
    for (let d = 1; d <= 4 && y - d >= 0; d++) if (STATE[type[i - d * W]] === LIQUID) return false;
    // Not the roots of a living tree.
    for (let dy = -2; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= W || ny < 0 || ny >= w.H) continue;
      const j = nx + W * ny;
      if (type[j] === WOOD && (w.flags[j] & PASS) && !(w.flags[j] & BACKWALL)) return false;
    }
    return !this.inHome(x, y);
  }

  // Open soil away from other trees and homes, for a new tree.
  plantSpot(c) {
    const w = this.w, W = w.W, type = w.type;
    return this.find(c, (t, i, x, y) => {
      if (!isOpen(t) || STATE[t] === GAS || type[i - W] !== DIRT || !isOpen(type[i + W])) return false;
      if (w.treeNear(x, y, 11) || this.inHome(x, y)) return false;
      for (let dx = -6; dx <= 6; dx++) if (x + dx >= 0 && x + dx < W && type[i + dx] === SEED) return false;
      return true;
    }, 45);
  }

  // Ground height (the first open row) of column x, looking down from y.
  // Logs and other wood do not count: a hut needs real ground.
  groundAt(x, y) {
    const w = this.w, W = w.W, type = w.type;
    let open = false;
    for (; y >= 0; y--) {
      const t = type[x + W * y];
      if (STATE[t] === LIQUID || (t === WOOD && open)) return -1;
      if (isGround(t)) { if (open) return y + 1; }
      else open = true;
    }
    return -1;
  }

  // A flat spot near a person for a hut: 9 wide, a little taller than a
  // person inside, with a pointed roof. The walls are its back wall, so
  // people walk in and out; the roof keeps the rain off.
  findSite(c) {
    const w = this.w, W = w.W, H = w.H, type = w.type, k0 = c.sp.rootK;
    const cx = Math.round(c.px[k0]), foot = Math.round(c.py[k0] - c.sp.rest[k0][1] * c.size);
    const hw = Math.ceil(c.sp.height) + 3;
    for (let r = 0; r <= 45; r += 2) for (const s of [1, -1]) {
      const x0 = cx + s * r - 4;
      if (x0 < 4 || x0 + 13 > W - 4 || (c.avoid.get(-x0 - 1) ?? 0) > c.age) continue;
      if (this.homes.some(h => Math.abs(h.x0 - x0) < 18)) continue;
      const g = [];
      let lo = Infinity, hi = -Infinity;
      for (let x = x0 - 1; x <= x0 + 9; x++) {
        const y = this.groundAt(x, Math.min(H - 1, foot + 14));
        if (y < 0) { lo = -1; break; }
        g.push(y); lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
      // Gently sloping ground is fine: the wall posts go down to the soil.
      if (lo < 0 || hi - lo > 3 || Math.abs(hi - foot) > 8 || hi + hw + 4 >= H) continue;
      const y0 = hi, cells = [], clear = [];
      let ok = true;
      const add = (x, y) => { const i = x + W * y; if (!isOpen(type[i])) ok = false; cells.push(i); };
      for (const wx of [x0, x0 + 8]) for (let y = g[wx - x0 + 1]; y < y0; y++) add(wx, y); // footings
      const footN = cells.length;
      for (const wx of [x0, x0 + 8]) for (let y = y0; y < y0 + hw; y++) add(wx, y);
      const roofFrom = cells.length;
      for (let x = x0 - 1; x <= x0 + 9; x++) add(x, y0 + hw);
      for (let x = x0 + 1; x <= x0 + 7; x++) add(x, y0 + hw + 1);
      for (let x = x0 + 3; x <= x0 + 5; x++) add(x, y0 + hw + 2);
      for (let y = y0; y < y0 + hw && ok; y++) for (let x = x0 + 1; x <= x0 + 7; x++) {
        const t = type[x + W * y];
        if (!isOpen(t)) ok = false; else if (t === PLANT) clear.push(x + W * y);
      }
      if (ok) return { x0, y0, hw, cells, clear, solid: new Set([...cells.slice(0, footN), ...cells.slice(roofFrom)]) };
    }
    return null;
  }

  finishHome(c, site) {
    const home = { x0: site.x0, y0: site.y0, hw: site.hw, cells: site.cells, ok: true };
    this.homes.push(home);
    c.home = home;
    // The family moves in too.
    for (const o of this.cr.list) if (o.alive && o.kind === 'human' && !o.home && (o.mother === c || c.mother === o)) o.home = home;
    this.w.discover(DISC.HOME);
  }

  // ----- getting along -----
  social(c, L) {
    const sp = c.sp, k0 = sp.rootK, rx = c.px[k0];
    const walkTo = (x, fast) => { c.facing = x >= rx ? 1 : -1; c.speed = sp.walk * (fast ? 1.5 : 1); c.mood = 'walk'; c.moodT = 40; return true; };
    // Babies keep close to their mother.
    if (c.size < 0.97 && c.mother && c.mother.alive) {
      const mx = c.mother.px[c.mother.sp.rootK];
      if (Math.abs(mx - rx) > 6) return walkTo(mx, true);
    }
    if (L.social === 'flock') {
      let n = 0, sx = 0;
      for (const o of this.cr.list) {
        if (o === c || !o.alive || o.kind !== c.kind) continue;
        const d = o.px[o.sp.rootK] - rx;
        if (Math.abs(d) < 70) { sx += d; n++; }
      }
      if (n && Math.abs(sx / n) > 12) return walkTo(rx + sx / n, false);
    } else if (L.social === 'follow') {
      const o = this.cr.nearest(c, o => o.alive && o.kind === 'human', 80);
      if (o) {
        const d = o.px[o.sp.rootK] - rx;
        if (Math.abs(d) > 9) return walkTo(rx + d, Math.abs(d) > 25);
        if (Math.abs(d) < 4 && Math.random() < 0.6) { c.speed = 0; c.mood = 'idle'; c.facing = d >= 0 ? 1 : -1; return true; }
      }
    } else if (L.social === 'chat' && Math.random() < 0.04) {
      const o = this.cr.nearest(c, o => o.alive && o.kind === c.kind && o.mood !== 'sleep' && !o.task && o.chatT <= 0, 8);
      if (o) {
        c.chatT = o.chatT = 30 + Math.random() * 40;
        c.partner = o; o.partner = c;
        c.speed = o.speed = 0; c.mood = o.mood = 'idle';
        return true;
      }
    }
    return false;
  }

  // Fear spreads to others of the same kind close by (and people warn people).
  alarm(c, dir) {
    const k0 = c.sp.rootK;
    for (const o of this.cr.list) {
      if (o === c || !o.alive || o.kind !== c.kind || o.alarmT > 0) continue;
      if (Math.abs(o.px[o.sp.rootK] - c.px[k0]) < 14 && Math.abs(o.py[o.sp.rootK] - c.py[k0]) < 10) {
        o.alarmT = 30; o.alarmDir = dir > 0 ? 1 : -1;
      }
    }
  }

  // ----- hunting -----
  prey(c) {
    const L = LIFE[c.kind];
    if (c.huntRest > 0) c.huntRest--;
    if (!L || !L.hunts || c.hunger < 0.62 || c.thirst > 0.8 || c.mood === 'sleep' || c.size < 0.9 || c.huntRest > 0 ||
      (c.task && c.task.kind === 'meat')) { c.huntT = 0; return null; }
    // Not prey that is in or over the water.
    const o = this.cr.nearest(c, o => o.alive && L.hunts.includes(o.kind) && !o.grab &&
      STATE[this.w.type[Math.max(0, this.cr.cellIndex(o.px[o.sp.rootK], o.py[o.sp.rootK] - 2))]] !== LIQUID, 45);
    if (!o) { c.huntT = 0; return null; }
    // A long chase that gets nowhere: give up and rest a while.
    if (++c.huntT > 240) { c.huntT = 0; c.huntRest = 600; return null; }
    return o;
  }

  pounce(c, prey) {
    if (c.biteT > 0) return;
    const h = c.sp.headK, hx = c.px[h], hy = c.py[h];
    for (let k = 0; k < prey.n; k++) {
      if (Math.hypot(prey.px[k] - hx, prey.py[k] - hy) > 2.6) continue;
      c.biteT = 25;
      this.cr.hurt(prey, 22, k, 'bite', 10);
      if (!prey.alive) { this.setTask(c, { kind: 'meat', o: prey }); c.speed = 0; }
      return;
    }
  }

  // ----- birds -----
  // Asleep, roosting at night, or about to eat: stay on the ground.
  stayDown(c) {
    if (c.mood === 'sleep' || this.night > 0.6 || c.chatT > 0) return true;
    const tg = this.target(c);
    return !!tg && Math.abs(tg[0] - c.px[c.sp.rootK]) < 5;
  }

  // A bird with somewhere to be flies there.
  flyTo(c) {
    const tg = this.target(c);
    if (!tg) return false;
    if (++c.task.t > 700) { this.giveUp(c); return false; }
    c.mood = 'fly'; c.flyY = tg[1] + 4; c.speed = c.sp.walk + 0.1;
    c.facing = tg[0] >= c.px[c.sp.rootK] ? 1 : -1;
    return true;
  }

  // ----- for the inspector -----
  doing(c) {
    if (c.chatT > 0) return 'chatting';
    if (c.mood === 'hunt') return 'hunting';
    if (!c.task) return null;
    if (c.task.kind === 'eat' && c.kind === 'sheep') return 'grazing';
    return TASK_WORDS[c.task.kind];
  }

  feelings(c, bits) {
    const L = LIFE[c.kind];
    if (!L) return;
    if (L.eats) { if (c.hunger >= 1) bits.push('starving'); else if (c.hunger > 0.7) bits.push('hungry'); }
    if (L.drinks && c.thirst > 0.75) bits.push('thirsty');
    if (L.sleeps && c.energy < 0.2 && c.mood !== 'sleep') bits.push('sleepy');
    if (c.inv.wood > 0) bits.push(`${c.inv.wood} planks`);
    if (c.inv.seed > 0) bits.push(`${c.inv.seed} seed${c.inv.seed > 1 ? 's' : ''}`);
    if (c.home) bits.push('has a home');
  }
}
