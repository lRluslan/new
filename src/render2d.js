// 2D renderer: shows one slice (a cross-section at depth z) of the shared 3D
// world, one pixel per cell, scaled up with crisp edges. Colours are picked
// per cell from warm autumn palettes, shaded by how deep a cell sits below
// the open air (grass tops, lit leaf edges, darker deep water).

import * as El from './elements.js';
import { rng } from './scenes.js';

const {
  EMPTY, STONE, DIRT, SAND, SNOW, WATER, OIL, ACID, LAVA, SMOKE, FIRE, WOOD, PLANT,
  ICE, GLASS, SEED, SALT, BRINE, MUD, BRICK, COAL, MOLTEN, MERCURY, HONEY, FUSE, CLONER, DRAIN, STATE, GAS, GLOWS,
} = El;

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
const GRASS = ['#efc94f', '#dcaa2e', '#c8931f', '#a9781f'].map(packHex);
const BLADE = ['#f3d36a', '#e2b844'].map(packHex);
const WATER_D = ['#b3e2d2', '#8cccb9', '#72b8a7', '#68ae9f', '#5fa498', '#579b8f', '#4f9287', '#47887e'].map(packHex);
const LEAF_D = ['#e6c650', '#c9b343', '#97a23a', '#6f8c33', '#567a32', '#45682d', '#3a5a2a', '#2f4a26'].map(packHex);
const LEAF_UNDER = packHex('#263f20');
const FIRE_P = ['#fff6c4', '#ffe07a', '#ffb636', '#ff8a1f', '#ec5a1a', '#b8361a'].map(packHex);
const LAVA_P = ['#ffd86e', '#ffab3a', '#ff7f1d', '#ec5a1b', '#c8401a'].map(packHex);
const CRUST = packHex('#4a1e12');
const HOT_RED = packHex('#ff4a14'), HOT_YEL = packHex('#ffcf6a');
const SMOKE_C = packHex('#3f3b35'), GLASS_C = packHex('#e8f6f2');
const SAND_TOP = packHex('#fcf0c8'), STONE_TOP = packHex('#b9b399'), SNOW_TOP = packHex('#ffffff');
const OIL_TOP = packHex('#7a5a35'), WOOD_TOP = packHex('#a8743f'), ICE_TOP = packHex('#f2fdfd');
const BRINE_TINT = packHex('#9fb3a8'), MUD_TOP = packHex('#7a5c40'), SALT_TOP = packHex('#ffffff');
const MORTAR = packHex('#c9b79c'), COAL_GLINT = packHex('#7a7680');
const MOLTEN_P = ['#fff6d6', '#ffe9a8', '#ffd27a', '#ffb84a', '#f39a35'].map(packHex);
const MERCURY_HI = packHex('#f4f8fa'), HONEY_D = ['#f6c45a', '#e8a93a', '#d9952a', '#c7821f', '#b06f18'].map(packHex);
const CLONER_FRAME = packHex('#5b6270'), DRAIN_CORE = packHex('#05040a'), DRAIN_RIM = packHex('#4a3a78');
const LEAF_COLORS = ['#e08a2c', '#d9a531', '#c4562a', '#f0c24a', '#b5462a'].map(packHex);

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

function buildBackground(W, H) {
  const buf = new Uint32Array(W * H);
  const rand = rng(77);
  const sky = ['#e3a248', '#eab55a', '#f0c66c', '#f4d27f', '#f7dd95', '#f8e4a8'].map(packHex);
  for (let r = 0; r < H; r++) {
    const f = (r / (H * 0.75)) * (sky.length - 1);
    for (let x = 0; x < W; x++) {
      const k = Math.min(sky.length - 1, Math.floor(f + BAYER[(r & 3) * 4 + (x & 3)] - 0.5 + 0.5));
      buf[r * W + x] = sky[Math.max(0, k)];
    }
  }
  const layers = [
    { base: 0.4, spread: 0.3, rmin: 0.05, rmax: 0.09, per: 18, body: '#d9b568', hi: '#e8c77c', lo: '#c7a15b', trunk: '#c29a57' },
    { base: 0.3, spread: 0.28, rmin: 0.06, rmax: 0.11, per: 26, body: '#a69849', hi: '#c2b257', lo: '#8a7e3c', trunk: '#7f6a3a' },
    { base: 0.2, spread: 0.24, rmin: 0.07, rmax: 0.12, per: 34, body: '#5f7b34', hi: '#97a43d', lo: '#465f2b', trunk: '#5a4027' },
  ];
  for (const L of layers) {
    const body = packHex(L.body), hi = packHex(L.hi), lo = packHex(L.lo), trunk = packHex(L.trunk);
    const trunkHi = blend(trunk, hi, 0.4);
    const blobs = [];
    const n = Math.ceil(W / L.per) + 2;
    for (let k = 0; k < n; k++) {
      const cx = (k + rand() * 0.8) * L.per - L.per * 0.5;
      const cyUp = H * (L.base + rand() * L.spread);
      const r = H * (L.rmin + rand() * (L.rmax - L.rmin));
      const tw = 1 + ((rand() * 3) | 0);
      for (let y = 0; y < cyUp; y++) for (let x = Math.round(cx - tw / 2); x < Math.round(cx + tw / 2) + 1; x++) {
        if (x < 0 || x >= W) continue;
        const row = H - 1 - y;
        buf[row * W + x] = x === Math.round(cx - tw / 2) ? trunkHi : trunk;
      }
      blobs.push([cx, cyUp, r]);
      for (let j = 0; j < 3; j++) {
        blobs.push([cx + (rand() - 0.5) * r * 1.8, cyUp + (rand() - 0.6) * r * 0.9, r * (0.5 + rand() * 0.35)]);
      }
    }
    // Undergrowth band so lower layers are never plain sky.
    const bandTop = H * (L.base * 0.75);
    for (let x = 0; x < W; x++) {
      const top = bandTop + 2 * Math.sin(x * 0.2 + L.base * 40) + 1.5 * Math.sin(x * 0.07);
      for (let y = 0; y < top; y++) buf[(H - 1 - y) * W + x] = y > top - 1.5 ? hi : body;
    }
    for (const [cx, cyUp, r] of blobs) {
      for (let y = Math.floor(cyUp - r); y <= Math.ceil(cyUp + r); y++) {
        if (y < 0 || y >= H) continue;
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          if (x < 0 || x >= W) continue;
          const dx = (x - cx) / r, dy = (y - cyUp) / r;
          if (dx * dx + dy * dy > 1) continue;
          const row = H - 1 - y;
          const light = -dx * 0.5 + dy * 0.85;
          const d = BAYER[(row & 3) * 4 + (x & 3)] * 0.3;
          buf[row * W + x] = light > 0.42 + d ? hi : light < -0.45 + d ? lo : body;
        }
      }
    }
  }
  return buf;
}

export class Renderer2D {
  constructor(stage, world) {
    this.world = world;
    const { W, H } = world;
    this.z = Math.floor(world.D / 2); // which slice is shown
    // The current slice, copied out of the world each frame.
    this.slice = { W, H, type: new Uint8Array(W * H), temp: new Float32Array(W * H), shade: new Uint8Array(W * H), life: new Int16Array(W * H) };
    this.wrap = document.createElement('div');
    this.wrap.className = 'view2d';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sim2d';
    this.glowCanvas = document.createElement('canvas');
    this.glowCanvas.className = 'glow2d';
    for (const c of [this.canvas, this.glowCanvas]) { c.width = W; c.height = H; }
    this.wrap.append(this.canvas, this.glowCanvas);
    stage.append(this.wrap);
    this.ctx = this.canvas.getContext('2d');
    this.gctx = this.glowCanvas.getContext('2d');
    this.img = this.ctx.createImageData(W, H);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.gimg = this.gctx.createImageData(W, H);
    this.gbuf = new Uint32Array(this.gimg.data.buffer);
    this.bg = buildBackground(W, H);
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
    this.cursor = null;
  }

  setVisible(v) { this.wrap.hidden = !v; }

  setSlice(z) { this.z = Math.max(0, Math.min(this.world.D - 1, z)); }

  // Copy slice z of the 3D grid into flat 2D arrays.
  extract() {
    const { W, H, D, type, temp, shade, life } = this.world;
    const sl = this.slice, z = this.z;
    for (let y = 0; y < H; y++) {
      const src = W * (z + D * y), dst = W * y;
      sl.type.set(type.subarray(src, src + W), dst);
      sl.temp.set(temp.subarray(src, src + W), dst);
      sl.shade.set(shade.subarray(src, src + W), dst);
      sl.life.set(life.subarray(src, src + W), dst);
    }
  }

  resize(w, h) {
    this.view = { w, h };
    if (!this.cam) this.cam = { zoom: 1, u: this.world.W / 2, v: this.world.H / 2 }; // u, v: view centre in cells
    this.layout();
  }

  // Place the canvas for the current zoom. At zoom 1 the whole slice fits;
  // zoomed in, the view never slides past the edge of the world.
  layout() {
    const { W, H } = this.world;
    const { w, h } = this.view, cam = this.cam;
    const s = Math.min(w / W, h / H) * cam.zoom;
    const cw = W * s, ch = H * s;
    let left = w / 2 - cam.u * s, top = h / 2 - cam.v * s;
    left = cw <= w ? (w - cw) / 2 : Math.min(0, Math.max(w - cw, left));
    top = ch <= h ? (h - ch) / 2 : Math.min(0, Math.max(h - ch, top));
    cam.u = (w / 2 - left) / s; cam.v = (h / 2 - top) / s;
    this.scale = s;
    for (const c of [this.canvas, this.glowCanvas]) {
      c.style.width = Math.round(cw) + 'px'; c.style.height = Math.round(ch) + 'px';
      c.style.left = Math.round(left) + 'px'; c.style.top = Math.round(top) + 'px';
    }
  }

  // Zoom by `factor`, keeping the point under (sx, sy) (stage pixels) still.
  zoomAt(sx, sy, factor) {
    const cam = this.cam, s = this.scale;
    const { w, h } = this.view;
    const pu = cam.u + (sx - w / 2) / s, pv = cam.v + (sy - h / 2) / s;
    cam.zoom = Math.max(1, Math.min(8, cam.zoom * factor));
    const s2 = Math.min(w / this.world.W, h / this.world.H) * cam.zoom;
    cam.u = pu - (sx - w / 2) / s2; cam.v = pv - (sy - h / 2) / s2;
    this.layout();
  }

  pan(dx, dy) {
    this.cam.u -= dx / this.scale; this.cam.v -= dy / this.scale;
    this.layout();
  }

  resetZoom() {
    this.cam = { zoom: 1, u: this.world.W / 2, v: this.world.H / 2 };
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
    const { W, H, type } = this.slice;
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
    this.extract();
    const { W, H, type, temp, shade, life } = this.slice;
    const buf = this.buf, gbuf = this.gbuf, depth = this.depth, leafTone = this.leafTone, stonePat = this.stonePat;
    this.computeDepth();
    buf.set(this.bg);
    gbuf.fill(0);

    // Falling leaves drift behind everything.
    for (const lf of this.leaves) {
      lf.y += lf.s; lf.x += Math.sin(lf.p + time * 1.3) * 0.12 + 0.04;
      if (lf.y > H) { lf.y = -2; lf.x = Math.random() * W; }
      if (lf.x > W) lf.x -= W;
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
              // Grass tufts poke up into the air above.
              if (run === 0 && y < H - 1 && type[i + W] === EMPTY && ((x * 7 + (x >> 2)) % 5) < 2) {
                buf[p - W] = BLADE[(x >> 1) & 1];
                if ((x % 9) === 0 && y < H - 2 && type[i + 2 * W] === EMPTY) buf[p - 2 * W] = BLADE[0];
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
            if (exposed && run === 0) c = STONE_TOP;
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
            break;
          }
          case LAVA: {
            c = LAVA_P[((sh >> 4) + tick + (x >> 1) + (y >> 1)) % 5];
            const T = temp[i];
            if (T < 950) c = blend(c, CRUST, Math.min(0.75, (950 - T) / 330));
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
    this.drawCursor();
    this.ctx.putImageData(this.img, 0, 0);
    this.gctx.putImageData(this.gimg, 0, 0);
  }

  drawCursor() {
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
