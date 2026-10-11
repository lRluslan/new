// Pixel art for creatures. Draws a ragdoll into a 32-bit pixel buffer at a
// few pixels per world cell, with a dark outline, a face, and the marks of
// what has happened to it: wounds, burns, a flash when it is hit.

import { hexToRgb } from './elements.js';
import { FAR_SIDE, ARM_R, LEG_R } from './creatures.js';

const pack = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
const packHex = h => { const [r, g, b] = hexToRgb(h); return pack(r, g, b); };
const R = c => c & 255, G = c => (c >> 8) & 255, B = c => (c >> 16) & 255;
export function blend(a, b, f) {
  return pack(R(a) + (R(b) - R(a)) * f | 0, G(a) + (G(b) - G(a)) * f | 0, B(a) + (B(b) - B(a)) * f | 0);
}
const scale = (c, f) => pack(Math.min(255, R(c) * f) | 0, Math.min(255, G(c) * f) | 0, Math.min(255, B(c) * f) | 0);

const OUTLINE = packHex('#1b130e');
const BLOOD = [packHex('#8a1915'), packHex('#a8221b'), packHex('#6e120f')];
const GASH = packHex('#4a0806'), BRUISE = packHex('#5e3a6a'), BONE = packHex('#efe6d0'), FLESH = packHex('#b33a2c');
const CHAR = packHex('#2a1d17');
const WHITE = packHex('#fff6e6'), HURT = packHex('#ff4a3a');
const FLAME = [packHex('#ffb636'), packHex('#ffe07a'), packHex('#ff8a1f')];
const BANG = packHex('#fff3c4'), BAR_BG = packHex('#2a211b');
const BAR = [packHex('#d8452c'), packHex('#e8b53a'), packHex('#7cc04a')];
const BUBBLE = packHex('#e8fbf6');
const VISOR = packHex('#252b33'), ANTENNA = packHex('#e2503a');

// Head shapes: extra blobs on the head (forward, up, radius, all in head
// radii, and colour), and where the eye sits.
const ANIMAL = { dog: 1, bird: 1, frog: 1 };
const HEAD_EXTRAS = {
  chicken: [[-0.2, 0.95, 0.42, 'comb'], [1.05, 0, 0.4, 'beak']],
  dog: [[0.95, -0.25, 0.58, 'body'], [-0.35, 0.55, 0.45, 'ear']],
  bird: [[1.05, -0.05, 0.38, 'beak']],
  frog: [[0.15, 0.78, 0.42, 'body']],
};
const EYE_AT = { dog: [0.45, 0.25], frog: [0.2, 0.85], bird: [0.4, 0.15] };

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Packed colours for a creature, cached until its colours change.
function palette(c) {
  if (c._pal && c._palFrom === c.colors) return c._pal;
  const p = {};
  for (const [k, v] of Object.entries(c.colors)) if (typeof v === 'string') p[k] = packHex(v);
  c._pal = p; c._palFrom = c.colors;
  return p;
}

// Draw creature c. o: { buf, BW, BH, S (pixels per cell), x0, y0 (world
// position of the buffer's top-left corner), gore, tick, tint(X, Y, col) }.
export function drawCreature(c, o) {
  const { buf, BW, BH, S, x0, y0, gore, tick } = o;
  const sp = c.sp, pal = palette(c);
  const tint = o.tint;
  const X = wx => (wx - x0) * S, Y = wy => (y0 - wy) * S;
  const k0 = sp.rootK, h = sp.headK, nk = sp.neckK;
  const facing = c.facing;
  // Drawing order: far arm and leg, body, near arm and leg, wing, head.
  const layer = k => FAR_SIDE[c.limb[k]] ? 0 : c.limb[k] === ARM_R || c.limb[k] === LEG_R ? 2 : 1;
  const char = Math.min(1, c.char * 1.1);
  const flash = c.hurtFlash > 0 ? (gore ? HURT : WHITE) : 0;
  const burning = c.fire > 0;

  // Final colour of one pixel of a part.
  const shadeOf = (base, k, px, py) => {
    let col = base;
    if (gore && k >= 0) {
      // Bruises darken the skin; open cuts show as dark gashes ringed with
      // blood, and blood soaks into clothes around them.
      if (c.bruise[k] > 10) col = blend(col, BRUISE, Math.min(0.25, c.bruise[k] / 200));
      const h1 = hash(px * 7 + c.id, py * 13);
      const cut = c.cut[k];
      if (cut > 3 && h1 < Math.min(0.7, cut / 70)) col = h1 < Math.min(0.18, cut / 260) ? GASH : BLOOD[(hash(px, py + 3) * 3) | 0];
      else if (cut > 1 && h1 < Math.min(0.3, cut / 120)) col = BLOOD[2];
    }
    if (char > 0) col = blend(col, CHAR, char * 0.88);
    if (!c.alive) col = blend(col, scale(col, 0.75), 0.5);
    if (burning && hash(px + tick * 3, py - tick * 5) < 0.28) col = blend(col, FLAME[(hash(px, py + tick) * 3) | 0], 0.75);
    if (flash) col = blend(col, flash, 0.55);
    return col;
  };
  const put = (px, py, col) => {
    if (px < 0 || py < 0 || px >= BW || py >= BH) return;
    buf[py * BW + px] = tint ? tint(px, py, col) : col;
  };
  const disc = (cx, cy, r, col, k, outline) => {
    const rr = r + (outline ? 1 : 0), r2 = rr * rr;
    const xa = Math.floor(cx - rr), xb = Math.ceil(cx + rr), ya = Math.floor(cy - rr), yb = Math.ceil(cy + rr);
    for (let py = ya; py <= yb; py++) for (let px = xa; px <= xb; px++) {
      const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      put(px, py, outline ? OUTLINE : shadeOf(col, k, px, py));
    }
  };
  const line = (ax, ay, bx, by, r, col, k, outline) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len * 2));
    for (let j = 0; j <= n; j++) disc(ax + (bx - ax) * j / n, ay + (by - ay) * j / n, r, col, k, outline);
  };

  // Parts, far side first.
  const parts = [];
  for (const s of c.sticks) {
    if (s.broken || !s.thick) continue;
    const z = Math.min(layer(s.a), layer(s.b)) === 0 ? 0 : Math.max(layer(s.a), layer(s.b));
    parts.push({ kind: 'stick', s, z, far: z === 0 });
  }
  for (const d of sp.dotList) parts.push({ kind: 'dot', d, z: layer(d.k) + 0.5, far: layer(d.k) === 0 });
  if (sp.flaps) parts.push({ kind: 'wing', z: 3, far: false });
  if (sp.head !== 'fish') parts.push({ kind: 'head', z: 4, far: false });
  parts.sort((a, b) => a.z - b.z);

  const hx = X(c.px[h]), hy = Y(c.py[h]);
  // Head frame: "up" from neck to head, "forward" across it toward where it faces.
  let ux = c.px[h] - c.px[nk], uy = c.py[h] - c.py[nk];
  if (sp.head === 'fish') { ux = -(c.py[h] - c.py[nk]) * facing; uy = (c.px[h] - c.px[nk]) * facing; }
  const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  // Animals: the head tilts with the whole body rather than with a neck.
  if (ANIMAL[sp.head]) {
    const rf = sp.rest[h][0] - sp.rest[k0][0], ru = sp.rest[h][1] - sp.rest[k0][1];
    const rot = Math.atan2(c.py[h] - c.py[k0], c.px[h] - c.px[k0]) - Math.atan2(ru, rf * facing);
    ux = -Math.sin(rot); uy = Math.cos(rot);
  }
  const fwx = uy * facing, fwy = -ux * facing; // forward in world units (x right, y up)
  const HR = sp.headR * S;

  const drawPart = (p, outline) => {
    if (p.kind === 'stick') {
      const s = p.s;
      let col = pal[s.color] ?? pal.body;
      if (p.far && !outline) col = scale(col, 0.8);
      const k = c.wound[s.a] > c.wound[s.b] ? s.a : s.b;
      line(X(c.px[s.a]), Y(c.py[s.a]), X(c.px[s.b]), Y(c.py[s.b]), Math.max(0.6, s.thick * S / 2), col, k, outline);
      if (!outline && c.colors.torn && s.color === 'shirt') {
        // Rips in a zombie's clothes.
        const mx = X((c.px[s.a] + c.px[s.b]) / 2), my = Y((c.py[s.a] + c.py[s.b]) / 2);
        put(Math.floor(mx + 1), Math.floor(my), shadeOf(pal.skin, k, 0, 0));
        put(Math.floor(mx - 1), Math.floor(my + 2), shadeOf(pal.skin, k, 0, 0));
      }
    } else if (p.kind === 'dot') {
      let col = pal[p.d.color];
      if (p.far && !outline) col = scale(col, 0.8);
      disc(X(c.px[p.d.k]), Y(c.py[p.d.k]), p.d.r * S, col, p.d.k, outline);
    } else if (p.kind === 'wing') {
      const flap = c.flapping ? Math.sin(c.age * 0.9) * 0.5 : 0;
      disc(X(c.px[k0] - 0.1 * facing), Y(c.py[k0] + 0.15 + flap), 0.62 * S, pal.tail, k0, outline);
    } else drawHead(outline);
  };

  const drawHead = outline => {
    const style = sp.head;
    if (style === 'box') {
      const half = HR * 0.92 + (outline ? 1 : 0);
      const ext = Math.ceil(half * 1.5);
      for (let py = Math.floor(hy - ext); py <= Math.ceil(hy + ext); py++) for (let px = Math.floor(hx - ext); px <= Math.ceil(hx + ext); px++) {
        const dx = px + 0.5 - hx, dy = -(py + 0.5 - hy);
        const lu = dx * ux + dy * uy, lf = dx * fwx + dy * fwy;
        if (Math.abs(lu) > half || Math.abs(lf) > half) continue;
        if (outline) { put(px, py, OUTLINE); continue; }
        let col = pal.skin;
        if (lu > -0.1 * half && lu < 0.42 * half && lf > -0.35 * half) col = VISOR;
        put(px, py, shadeOf(col, h, px, py));
      }
      // Antenna.
      const ax = hx + ux * HR * 1.55, ay = hy - uy * HR * 1.55;
      if (outline) disc(ax, ay, 1, OUTLINE, -1, true);
      else { line(hx + ux * HR, hy - uy * HR, ax, ay, 0.5, pal.shirt, h, false); put(Math.floor(ax), Math.floor(ay), c.alive ? ANTENNA : OUTLINE); }
      if (!outline) {
        const eye = c.alive ? pal.eye : OUTLINE;
        for (const f of [0.3, 0.72]) put(Math.floor(hx + fwx * HR * f + ux * HR * 0.16), Math.floor(hy - fwy * HR * f - uy * HR * 0.16), eye);
      }
      return;
    }
    const r = HR;
    // Head-relative position (forward, up, in head radii) to buffer pixels.
    const at = (f, u) => [hx + (fwx * f + ux * u) * r, hy - (fwy * f + uy * u) * r];
    const extras = HEAD_EXTRAS[style] || [];
    if (outline) {
      disc(hx, hy, r, 0, h, true);
      for (const [f, u, rad] of extras) { const [px, py] = at(f, u); disc(px, py, r * rad, 0, h, true); }
      return;
    }
    // Round head: skin with hair on top and at the back.
    const r2 = r * r;
    for (let py = Math.floor(hy - r); py <= Math.ceil(hy + r); py++) for (let px = Math.floor(hx - r); px <= Math.ceil(hx + r); px++) {
      const dx = px + 0.5 - hx, dy = -(py + 0.5 - hy);
      if (dx * dx + dy * dy > r2) continue;
      const lu = (dx * ux + dy * uy) / r, lf = (dx * fwx + dy * fwy) / r;
      let col = style === 'round' || style === 'box' ? pal.skin : pal.body;
      if (style === 'round' && (lu > 0.28 || (lf < -0.3 && lu > -0.45))) {
        col = pal.hair;
        if (c.colors.torn && hash(px, py) < 0.3) col = pal.skin; // patchy
      }
      put(px, py, shadeOf(col, h, px, py));
    }
    for (const [f, u, rad, key] of extras) { const [px, py] = at(f, u); disc(px, py, r * rad, pal[key], h, false); }
    if (style === 'chicken') { const [px, py] = at(0.75, -0.55); put(Math.floor(px), Math.floor(py), shadeOf(pal.comb, h, 0, 0)); }
    if (style === 'dog') { const [px, py] = at(1.45, -0.2); put(Math.floor(px), Math.floor(py), pal.nose); }
    // Eye, or crosses when dead.
    const [eyeF, eyeU] = EYE_AT[style] || [0.5, 0.05];
    const [exf, eyf] = at(eyeF, eyeU);
    const ex = Math.floor(exf), ey = Math.floor(eyf);
    if (c.alive) put(ex, ey, pal.eye);
    else { put(ex - 1, ey - 1, OUTLINE); put(ex + 1, ey - 1, OUTLINE); put(ex, ey, OUTLINE); put(ex - 1, ey + 1, OUTLINE); put(ex + 1, ey + 1, OUTLINE); }
  };

  for (const p of parts) drawPart(p, true);
  for (const p of parts) drawPart(p, false);

  // Where a limb came off: raw flesh with the end of the bone showing.
  if (gore) for (const s of c.sticks) {
    if (!s.broken || !s.thick) continue;
    for (const k of [s.a, s.b]) {
      const sx = X(c.px[k]), sy = Y(c.py[k]), r = Math.max(1, s.thick * S * 0.55);
      disc(sx, sy, r, FLESH, -1, false);
      put(Math.floor(sx), Math.floor(sy), BONE);
      if (r > 1.5) put(Math.floor(sx) + 1, Math.floor(sy), BONE);
    }
  }

  // Fish: a pale stripe and an eye.
  if (sp.head === 'fish') {
    const m = sp.idx.mid;
    let bx = c.px[h] - c.px[m], by = c.py[h] - c.py[m];
    const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    const sx = X(c.px[m] + bx * 0.35), sy = Y(c.py[m] + by * 0.35);
    line(sx - by * S * 0.75, sy - bx * S * 0.75, sx + by * S * 0.75, sy + bx * S * 0.75, 0.6, pal.stripe, m, false);
    const ex = Math.floor(hx + bx * S * 0.3 - by * S * 0.2 * facing), ey = Math.floor(hy - by * S * 0.3 - bx * S * 0.2 * facing);
    if (c.alive) { put(ex, ey, pal.eye); put(ex + 1, ey, WHITE); }
    else { put(ex - 1, ey - 1, OUTLINE); put(ex + 1, ey + 1, OUTLINE); put(ex, ey, OUTLINE); put(ex + 1, ey - 1, OUTLINE); put(ex - 1, ey + 1, OUTLINE); }
  }

  if (!o.marks || !c.alive) return;
  const top = Y(c.py[h]) - HR - S * 0.9;
  const cx = Math.floor(X(c.px[h]));
  // "!" when scared or grabbed.
  if (c.mood === 'flee' || c.mood === 'panic' || c.grab) {
    const bx = cx, by = Math.floor(top - S * 1.6);
    for (let yy = -1; yy <= 6; yy++) for (let xx = -1; xx <= 1; xx++) put(bx + xx, by + yy, OUTLINE);
    for (let yy = 0; yy < 4; yy++) put(bx, by + yy, BANG);
    put(bx, by + 5, BANG);
  }
  // Health bar after being hurt.
  if (c.hurtT > 0 && c.hp < sp.hp) {
    const wbar = Math.max(8, Math.round(S * 3.2)), by = Math.floor(top);
    const f = Math.max(0, c.hp / sp.hp), fill = Math.round(wbar * f);
    const col = BAR[f < 0.3 ? 0 : f < 0.6 ? 1 : 2];
    for (let xx = -1; xx <= wbar; xx++) for (let yy = -1; yy <= 2; yy++) put(cx - (wbar >> 1) + xx, by + yy, OUTLINE);
    for (let xx = 0; xx < wbar; xx++) for (let yy = 0; yy < 2; yy++) put(cx - (wbar >> 1) + xx, by + yy, xx < fill ? col : BAR_BG);
  }
  // Bubbles while holding its breath under water.
  if (o.underwater && o.underwater(c)) {
    for (let j = 0; j < 2; j++) {
      const t = (tick * 0.6 + j * 9 + c.id * 5) % 16;
      const bx = Math.floor(hx + fwx * HR + Math.sin(t * 0.8 + j) * 2), by = Math.floor(hy - HR - t);
      put(bx, by, BUBBLE);
    }
  }
}
