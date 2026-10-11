// Sandgrove: app shell. Builds the interface, reads the mouse, touch and
// keyboard, and runs the simulation clock.
//
// The world is a 2D grid seen from the side. It is sized to the screen when
// the game starts (and again on Reset or Clear), so it always fills it.

import * as El from './elements.js';
import { World } from './world.js';
import { autumnGlade, emptyWorld, worldSizeFor } from './scenes.js';
import { Renderer2D } from './render2d.js';
import { drawSwatch } from './swatches.js';
import { Creatures, SPECIES, SPECIES_ORDER, iconCreature } from './creatures.js';
import { drawCreature } from './creatureArt.js';

const $ = sel => document.querySelector(sel);
const app = $('#app');
app.dataset.input = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
const stage = $('#stage');

const store = {
  get(key, fallback) { try { const v = localStorage.getItem('sandgrove.' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem('sandgrove.' + key, JSON.stringify(value)); } catch { /* storage unavailable */ } },
};

const TOOLS = [
  { id: 'erase', name: 'Eraser', key: 'E', desc: 'Removes anything it touches, creatures included.' },
  { id: 'heat', name: 'Heat', key: 'H', desc: 'Raises the temperature. Melts, boils and ignites things.' },
  { id: 'cool', name: 'Cool', key: 'J', desc: 'Lowers the temperature, down to -200 °C. Freezes water.' },
  { id: 'grab', name: 'Grab', key: 'G', desc: 'Click and drag a creature to pick it up. Let go to drop it, or flick the mouse to throw it.' },
  { id: 'bomb', name: 'Bomb', key: 'B', desc: 'Click to set off an explosion. A bigger brush makes a bigger blast.' },
  { id: 'bolt', name: 'Lightning', key: 'L', desc: 'Click to call down a lightning bolt. It sets trees alight and turns sand to glass.' },
  { id: 'wind', name: 'Wind', key: 'W', desc: 'Hold to blow things away from the pointer: sand, water, smoke, fire and creatures.' },
  { id: 'line', name: 'Line', key: 'N', desc: 'Drag to draw a straight line of the last element you picked. Handy for walls, floors and wires.' },
  { id: 'fill', name: 'Fill', key: 'F', desc: 'Click to fill a space with the last element you picked, like a paint bucket.' },
  { id: 'meteor', name: 'Meteor', key: 'M', desc: 'Click to call down a meteor. It streaks in from the sky and blasts a crater of molten rock.' },
];
const TOOL_ICONS = {
  erase: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10 9 4l4 4-6 6H4l-1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 7l4 4" stroke="currentColor" stroke-width="1.5"/><path d="M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  heat: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c.5 2.4 3.5 3.8 3.5 7.2A3.5 3.5 0 0 1 4.5 8.7c0-1.6.8-2.6 1.6-3.4.1 1.3.7 2 1.4 2.3C7.3 5.3 7.4 3.4 8 1.5z" fill="currentColor"/></svg>',
  cool: '<svg viewBox="0 0 16 16" aria-hidden="true"><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5"/><path d="M6.3 2.8 8 4.3l1.7-1.5M6.3 13.2 8 11.7l1.7 1.5"/></g></svg>',
  bomb: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="9.5" r="4.6" fill="currentColor"/><path d="M10.2 5.8 12 4m0 0 1.6-.4M12 4l.4-1.6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  bolt: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 1.5 3.8 9h3.6l-1 5.5L12.2 7H8.6z" fill="currentColor"/></svg>',
  line: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="3" cy="13" r="1.6" fill="currentColor"/><circle cx="13" cy="3" r="1.6" fill="currentColor"/></svg>',
  fill: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 7.5 7.5 3l5 5-4.5 4.5a1.4 1.4 0 0 1-2 0L3 9.5a1.4 1.4 0 0 1 0-2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.2"/><path d="M13.5 10.5c.6 1 1 1.6 1 2.1a1 1 0 0 1-2 0c0-.5.4-1.1 1-2.1z" fill="currentColor"/></svg>',
  meteor: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="10.5" cy="10.5" r="3.2" fill="currentColor"/><path d="M2 2l5.5 5.5M5 1.5l4 4M1.5 5l4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  wind: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h8.5a2 2 0 1 0-2-2M2 10h11a2 2 0 1 1-2 2M2 8h6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  grab: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 8.2V3.6a1 1 0 0 1 2 0V7.5m0-.4V2.8a1 1 0 0 1 2 0v4.6m0-.3V3.8a1 1 0 0 1 2 0v5.4c0 2.8-1.6 4.8-4.2 4.8-1.6 0-2.5-.7-3.4-2L2.4 9.2a1 1 0 0 1 1.5-1.3l1.3 1.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ----- the world -----
function screenSize() {
  const r = stage.getBoundingClientRect();
  return worldSizeFor(r.width || innerWidth, r.height || innerHeight);
}
const size0 = screenSize();
const world = new World(size0.W, size0.H);
autumnGlade(world);
const creatures = new Creatures(world);
creatures.gore = store.get('gore', true);
const r2d = new Renderer2D(stage, world);
r2d.creatures = creatures;

const state = {
  selected: { kind: 'el', id: El.SAND },
  paused: false,
  speed: store.get('speed', 1),
  brush: 4,
  thermal: false,
  painting: null,     // 'add' | 'erase' | 'heat' | 'cool' while a button is held
  pointer: null,      // last pointer position over the stage
  lastCell: null,
  stepOnce: false,
  acc: 0,
  held: null,         // the creature being carried by the mouse
  lastElement: El.SAND, // what the Line and Fill tools use
  lineFrom: null,     // where a Line drag started
};
let touched = false;  // set once the player paints or drops something in
const BRUSH_MAX = 16;
const POUR = 2.2;     // how thickly loose materials pour from the brush

// ----- discoveries -----
const found = new Set(store.get('found', []).filter(id => El.DISCOVERY_BY_ID[id]));
for (const id of found) world.found[id] = 1;

function addDiscovery(id) {
  if (found.has(id)) return;
  found.add(id);
  store.set('found', [...found]);
  world.found[id] = 1;
  const d = El.DISCOVERY_BY_ID[id];
  toast(d.title, d.recipe, d.text);
  renderDiscoveries();
}

// ----- palette -----
const palette = $('#palette');
const elButtons = new Map();
let keyIndex = 0;
const keyFor = new Map();
for (const group of El.PALETTE) {
  const sec = document.createElement('section');
  sec.className = 'group';
  sec.innerHTML = `<h2>${group.cat}</h2><div class="grid"></div>`;
  const grid = sec.querySelector('.grid');
  for (const id of group.items) {
    const e = El.ELEMENTS[id];
    const b = document.createElement('button');
    b.className = 'el';
    b.type = 'button';
    b.dataset.id = id;
    const key = keyIndex < 10 ? String((keyIndex + 1) % 10) : '';
    if (key) keyFor.set(key, id);
    keyIndex++;
    b.title = `${e.name}${key ? ` (${key})` : ''}`;
    b.innerHTML = `<canvas width="10" height="10"></canvas><span>${e.name}</span>${key ? `<kbd>${key}</kbd>` : ''}`;
    drawSwatch(b.querySelector('canvas'), id);
    b.addEventListener('click', () => select({ kind: 'el', id }));
    grid.append(b);
    elButtons.set('el:' + id, b);
  }
  palette.append(sec);
}
{
  const sec = document.createElement('section');
  sec.className = 'group';
  sec.innerHTML = '<h2>Creatures</h2><div class="grid"></div>';
  const grid = sec.querySelector('.grid');
  for (const kind of SPECIES_ORDER) {
    const sp = SPECIES[kind];
    const b = document.createElement('button');
    b.className = 'el mob';
    b.type = 'button';
    b.title = `${sp.name}: click to drop one in`;
    b.innerHTML = `<canvas class="mob-icon" width="24" height="24"></canvas><span>${sp.name}</span>`;
    drawMobIcon(b.querySelector('canvas'), kind);
    b.addEventListener('click', () => select({ kind: 'mob', id: kind }));
    grid.append(b);
    elButtons.set('mob:' + kind, b);
  }
  palette.append(sec);
}
{
  const sec = document.createElement('section');
  sec.className = 'group';
  sec.innerHTML = '<h2>Tools</h2><div class="grid"></div>';
  const grid = sec.querySelector('.grid');
  for (const t of TOOLS) {
    const b = document.createElement('button');
    b.className = 'el tool tool-' + t.id;
    b.type = 'button';
    b.title = `${t.name} (${t.key})`;
    b.innerHTML = `<i>${TOOL_ICONS[t.id]}</i><span>${t.name}</span><kbd>${t.key}</kbd>`;
    b.addEventListener('click', () => select({ kind: 'tool', id: t.id }));
    grid.append(b);
    elButtons.set('tool:' + t.id, b);
  }
  palette.append(sec);
}

// A creature's portrait: the real sprite, standing, scaled to fit.
function drawMobIcon(canvas, kind) {
  const c = iconCreature(kind);
  const sp = SPECIES[kind];
  const ctx = canvas.getContext('2d');
  const BW = canvas.width, BH = canvas.height;
  const img = ctx.createImageData(BW, BH);
  const buf = new Uint32Array(img.data.buffer);
  const S = Math.max(1.6, Math.min(4, 19 / Math.max(sp.height + (sp.walker ? 0 : 1.5), sp.length + 1.5)));
  const minY = Math.min(...c.py) - (sp.walker ? 0.6 : 0.8), maxY = Math.max(...c.py) + sp.headR;
  const minX = Math.min(...c.px), maxX = Math.max(...c.px);
  const x0 = (minX + maxX) / 2 - BW / 2 / S, y0 = (minY + maxY) / 2 + BH / 2 / S;
  drawCreature(c, { buf, BW, BH, S, x0, y0, gore: false, tick: 0 });
  ctx.putImageData(img, 0, 0);
}

function fmtTemp(t) { return `${Math.round(t)} °C`; }

function select(sel) {
  state.selected = sel;
  if (sel.kind === 'el') state.lastElement = sel.id;
  for (const [k, b] of elButtons) b.classList.toggle('on', k === `${sel.kind}:${sel.id}`);
  const info = $('#info');
  const icon = $('#info-icon');
  let facts = [];
  if (sel.kind === 'el') {
    const e = El.ELEMENTS[sel.id];
    facts.push(['State', { 1: 'Solid', 2: 'Powder', 3: 'Liquid', 4: 'Gas' }[e.state]]);
    facts.push(['Density', `${e.density.toLocaleString('en-US')} kg/m³`]);
    if (e.temp !== undefined) facts.push(['Starts at', fmtTemp(e.temp)]);
    if (e.hot) facts.push([{ [El.EMPTY]: 'Boils', [El.GLASS]: 'Fuses', [El.SALT]: 'Boils', [El.BRICK]: 'Bakes', [El.POPCORN]: 'Pops', [El.CO2]: 'Turns to gas' }[e.hot[1]] || 'Melts', fmtTemp(Math.floor(e.hot[0]))]);
    if (e.cold) facts.push([{ [El.ICE]: 'Freezes', [El.WATER]: 'Condenses' }[e.cold[1]] || 'Hardens', fmtTemp(Math.floor(e.cold[0]))]);
    if (e.ignite) facts.push([e.cat === 'explosive' && sel.id !== El.FIREWORK ? 'Explodes' : sel.id === El.FIREWORK ? 'Launches' : 'Ignites', fmtTemp(e.ignite)]);
    info.querySelector('h3').textContent = e.name;
    info.querySelector('p').textContent = e.desc;
    $('#info-swatch').hidden = false;
    icon.hidden = true;
    drawSwatch($('#info-swatch'), sel.id);
  } else if (sel.kind === 'mob') {
    const sp = SPECIES[sel.id];
    facts = [
      ['Health', `${sp.hp}`],
      ['Density', `${sp.density.toLocaleString('en-US')} kg/m³`],
      ['Breathes', sp.breathes === 'water' ? 'Water' : sp.breathes ? 'Air' : 'Nothing'],
      ['Speed', sp.run >= 0.13 ? 'Fast' : sp.run >= 0.1 ? 'Medium' : 'Slow'],
    ];
    info.querySelector('h3').textContent = sp.name;
    info.querySelector('p').textContent = sp.desc + ' Click to drop one in; click and drag one to throw it.';
    $('#info-swatch').hidden = true;
    icon.hidden = false;
    icon.className = 'info-icon';
    icon.innerHTML = '<canvas width="24" height="24" style="width:100%;height:100%;image-rendering:pixelated"></canvas>';
    drawMobIcon(icon.querySelector('canvas'), sel.id);
  } else {
    const t = TOOLS.find(t => t.id === sel.id);
    info.querySelector('h3').textContent = t.name;
    info.querySelector('p').textContent = t.desc;
    $('#info-swatch').hidden = true;
    icon.hidden = false;
    icon.className = 'info-icon tool-' + t.id;
    icon.innerHTML = TOOL_ICONS[t.id];
  }
  info.querySelector('dl').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  // Tools without a brush ring show a normal pointer over the world.
  const ringless = sel.kind === 'mob' || (sel.kind === 'tool' && (sel.id === 'grab' || sel.id === 'bolt'));
  r2d.canvas.dataset.cursor = !ringless ? '' : sel.id === 'grab' ? 'grab' : 'crosshair';
  $('#btn-clear-mobs').hidden = !(sel.kind === 'mob' || (sel.kind === 'tool' && sel.id === 'grab'));
}
$('#btn-clear-mobs').addEventListener('click', () => { dropHeld(); creatures.clear(); });

// ----- controls -----
const brushInput = $('#brush'), brushOut = $('#brush-out');
function syncBrush() {
  brushInput.max = BRUSH_MAX;
  brushInput.value = state.brush;
  brushOut.textContent = state.brush;
}
brushInput.addEventListener('input', () => { state.brush = +brushInput.value; brushOut.textContent = brushInput.value; });
function setBrush(b) { state.brush = Math.max(1, Math.min(BRUSH_MAX, b)); syncBrush(); }

function setSpeed(s) {
  state.speed = s;
  store.set('speed', s);
  for (const b of document.querySelectorAll('[data-speed]')) b.setAttribute('aria-pressed', String(+b.dataset.speed === s));
}
for (const b of document.querySelectorAll('[data-speed]')) b.addEventListener('click', () => setSpeed(+b.dataset.speed));

function setPaused(p) {
  state.paused = p;
  const btn = $('#btn-play');
  btn.setAttribute('aria-pressed', String(p));
  btn.title = p ? 'Play (Space)' : 'Pause (Space)';
  btn.querySelector('.i-pause').hidden = p;
  btn.querySelector('.i-play').hidden = !p;
  $('#paused-badge').hidden = !p;
}
$('#btn-play').addEventListener('click', () => setPaused(!state.paused));
$('#btn-step').addEventListener('click', () => { setPaused(true); state.stepOnce = true; });
$('#btn-reset').addEventListener('click', resetScene);
$('#btn-clear').addEventListener('click', clearScene);

// Reset and Clear also refit the world to the screen, in case the window
// changed shape since the game started.
function fitWorld() {
  const { W, H } = screenSize();
  if (W === world.W && H === world.H) return;
  world.resize(W, H);
  r2d.rebuild();
}
function resetScene() { dropHeld(); fitWorld(); creatures.clear(); autumnGlade(world); r2d.resetZoom(); }
function clearScene() { dropHeld(); fitWorld(); creatures.clear(); emptyWorld(world); }

$('#btn-thermal').addEventListener('click', () => {
  state.thermal = !state.thermal;
  $('#btn-thermal').setAttribute('aria-pressed', String(state.thermal));
  $('#thermal-legend').hidden = !state.thermal;
});
$('#btn-view').addEventListener('click', () => r2d.resetZoom());

// ----- blood and damage effects -----
function setGore(on) {
  creatures.gore = on;
  store.set('gore', on);
  $('#btn-gore').setAttribute('aria-pressed', String(on));
  $('#gore-label').textContent = on ? 'Blood' : 'No blood';
}
$('#btn-gore').addEventListener('click', () => setGore(!creatures.gore));

// ----- panels -----
function openPanel(id) {
  for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== id;
  $('#scrim').hidden = false;
}
function closePanels() {
  for (const p of document.querySelectorAll('.panel')) p.hidden = true;
  $('#scrim').hidden = true;
  store.set('welcomed', true);
}
$('#btn-help').addEventListener('click', () => openPanel('help'));
$('#disc-chip').addEventListener('click', () => openPanel('disc-panel'));
$('#scrim').addEventListener('click', closePanels);
for (const b of document.querySelectorAll('.panel .close')) b.addEventListener('click', closePanels);
$('#help-start').addEventListener('click', closePanels);

function renderDiscoveries() {
  $('#disc-count').textContent = found.size;
  $('#disc-total').textContent = El.DISCOVERIES.length;
  $('#disc-bar').style.setProperty('--p', found.size / El.DISCOVERIES.length);
  $('#disc-summary').textContent = `${found.size} of ${El.DISCOVERIES.length} reactions found`;
  $('#disc-list').innerHTML = El.DISCOVERIES.map(d => {
    const ok = found.has(d.id);
    return `<li class="${ok ? 'found' : 'locked'}">
      <span class="mark" aria-hidden="true"></span>
      <div><h4>${ok ? d.title : 'Undiscovered'}</h4>
      <p class="recipe">${ok ? d.recipe : 'Hint'}</p>
      <p>${ok ? d.text : d.hint}</p></div></li>`;
  }).join('');
}
$('#disc-reset').addEventListener('click', () => {
  const btn = $('#disc-reset');
  if (btn.dataset.confirm !== '1') {
    btn.dataset.confirm = '1';
    btn.textContent = 'Click again to forget all';
    setTimeout(() => { btn.dataset.confirm = ''; btn.textContent = 'Reset progress'; }, 3000);
    return;
  }
  btn.dataset.confirm = '';
  btn.textContent = 'Reset progress';
  found.clear();
  store.set('found', []);
  world.found.fill(0);
  renderDiscoveries();
});

const toasts = $('#toasts');
function toast(title, recipe, text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<div class="star" aria-hidden="true"></div><div><small>New discovery</small><b>${title}</b><span>${recipe}</span></div>`;
  t.title = text;
  toasts.prepend(t);
  while (toasts.children.length > 3) toasts.lastChild.remove();
  setTimeout(() => t.classList.add('out'), 4200);
  setTimeout(() => t.remove(), 4700);
}

// ----- input -----
function modeForButton(button) {
  if (button === 2) return 'erase';
  if (state.selected.kind === 'mob') return 'spawn';
  return state.selected.kind === 'tool' ? state.selected.id : 'add';
}

// One-shot tools: a bomb or a lightning bolt where you click.
function strikeAt(x) {
  const hit = world.strike(x);
  creatures.lightning(x, hit ? hit[1] : 0);
  const f = $('#flash');
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}
// Paint bucket: fill the connected patch of whatever was clicked (usually
// open air) with an element, up to a limit so the sky cannot all fill at once.
function floodFill(x0, y0, el) {
  const { W, H, type } = world;
  const start = world.index(x0, y0), from = type[start];
  if (from === el || STATE_MACHINE.has(from)) return;
  const seen = new Uint8Array(W * H), queue = new Int32Array(Math.min(W * H, 20000));
  let head = 0, tail = 0;
  queue[tail++] = start; seen[start] = 1;
  while (head < tail) {
    const i = queue[head++];
    world.set(i, el);
    const x = i % W, y = (i / W) | 0;
    for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (n < 0 || seen[n] || type[n] !== from || tail >= queue.length) continue;
      seen[n] = 1; queue[tail++] = n;
    }
  }
}
const STATE_MACHINE = new Set([El.CLONER, El.DRAIN, El.BATTERY, El.BLACK_HOLE, El.TORCH, El.HEATER, El.FREEZER]);

// A meteor streaks in from high up at an angle toward (x, y).
function meteor(x, y) {
  const side = Math.random() < 0.5 ? -1 : 1;
  const sx = Math.max(1, Math.min(world.W - 2, x + side * (12 + Math.random() * 20))), sy = world.H - 2;
  const i = world.index(Math.round(sx), sy);
  world.set(i, El.METEOR);
  const steps = Math.max(4, (sy - y) / 6);
  world.vx[i] = Math.max(-6, Math.min(6, (x - sx) / steps));
  world.vy[i] = -6;
}

function clickTool(mode, e) {
  const c = r2d.toCell(e.clientX, e.clientY);
  if (!c.inside) return;
  if (mode === 'bomb') world.explode(c.x, c.y, 5 + state.brush * 0.6, 5 + state.brush * 0.15);
  else if (mode === 'fill') floodFill(c.x, c.y, state.lastElement);
  else if (mode === 'meteor') meteor(c.x, c.y);
  else strikeAt(c.x);
}

// Position under the pointer, in (fractional) cell units.
function worldPoint(clientX, clientY) {
  const r = r2d.canvas.getBoundingClientRect();
  const { W, H } = world;
  return { x: (clientX - r.left) / r.width * W, y: H - (clientY - r.top) / r.height * H };
}

// With a creature or the Grab tool selected, pressing on a creature picks it
// up; with a creature selected, pressing anywhere else drops a new one in.
function dropHeld() {
  if (state.held) creatures.release(state.held);
  state.held = null;
}
function pressCreature(mode, e) {
  const p = worldPoint(e.clientX, e.clientY);
  const hit = creatures.pickPoint(p.x, p.y, mode === 'grab' ? 2.6 : 1.4);
  if (hit) { state.held = hit.c; creatures.startGrab(hit.c, hit.k); creatures.moveGrab(hit.c, p.x, p.y); return; }
  if (mode !== 'spawn') return;
  if (p.x < 0 || p.y < 0 || p.x >= world.W || p.y >= world.H) return;
  creatures.spawn(state.selected.id, p.x, Math.floor(p.y));
}

// Left paints, right erases, middle-drag pans. On touch, one finger paints
// and two fingers pinch to zoom and drag to pan.
const touches = new Map();
let pinch = null, panFrom = null;
const stagePoint = (x, y) => { const r = stage.getBoundingClientRect(); return [x - r.left, y - r.top]; };
function pinchState() {
  const [a, b] = [...touches.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}
const canvas = r2d.canvas;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not every pointer can be captured */ }
  state.pointer = { x: e.clientX, y: e.clientY };
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { pendingTouch = null; stopPaint(); dropHeld(); pinch = pinchState(); return; }
    if (touches.size > 2) return;
  }
  if (e.button === 1) { e.preventDefault(); panFrom = { x: e.clientX, y: e.clientY }; return; }
  if (e.button !== 0 && e.button !== 2) return;
  const mode = modeForButton(e.button);
  // A finger waits a moment: if a second finger follows, it is a pinch, not a tap.
  if (e.pointerType === 'touch') { pendingTouch = { mode, clientX: e.clientX, clientY: e.clientY, at: performance.now() }; return; }
  startAction(mode, e);
});
let pendingTouch = null;
function startAction(mode, e) {
  dismissCoach();
  touched = true;
  if (mode === 'spawn' || mode === 'grab') { pressCreature(mode, e); return; }
  if (mode === 'bomb' || mode === 'bolt' || mode === 'fill' || mode === 'meteor') { clickTool(mode, e); return; }
  if (mode === 'line') { const c = r2d.toCell(e.clientX, e.clientY); if (c.inside) state.lineFrom = c; return; }
  state.painting = mode;
  state.lastCell = null;
}
// Start a waiting touch once it has clearly not become a pinch.
function settleTouch(force) {
  const p = pendingTouch;
  if (!p) return;
  if (touches.size > 1) { pendingTouch = null; return; }
  const moved = state.pointer && Math.hypot(state.pointer.x - p.clientX, state.pointer.y - p.clientY) > 8;
  if (!force && !moved && performance.now() - p.at < 90) return;
  pendingTouch = null;
  startAction(p.mode, p);
  if (force && state.painting) paint(); // a quick tap still paints a dab
}
canvas.addEventListener('pointermove', e => {
  state.pointer = { x: e.clientX, y: e.clientY };
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && touches.size === 2) {
    const now = pinchState();
    const [sx, sy] = stagePoint(now.mx, now.my);
    r2d.pan(now.mx - pinch.mx, now.my - pinch.my);
    if (pinch.d > 0) r2d.zoomAt(sx, sy, now.d / pinch.d);
    pinch = now;
  } else if (panFrom) {
    r2d.pan(e.clientX - panFrom.x, e.clientY - panFrom.y);
    panFrom = { x: e.clientX, y: e.clientY };
  }
});
const endPointer = e => {
  if (e.pointerType === 'touch' && touches.size === 1) settleTouch(true);
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (e.button === 1 || e.pointerType !== 'touch') panFrom = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!state.painting && !state.held) state.pointer = null; });
const stopPaint = () => { state.painting = null; state.lastCell = null; };
window.addEventListener('pointerup', () => { finishLine(); stopPaint(); dropHeld(); });
// The Line tool draws when the button is let go.
function finishLine() {
  const a = state.lineFrom;
  state.lineFrom = null;
  r2d.line = null;
  if (!a || !state.pointer) return;
  const b = r2d.toCell(state.pointer.x, state.pointer.y);
  const r = Math.max(0.5, state.brush * 0.5);
  const n = Math.max(1, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
  for (let k = 0; k <= n; k++) {
    const x = Math.round(a.x + (b.x - a.x) * k / n), y = Math.round(a.y + (b.y - a.y) * k / n);
    if (x >= 0 && y >= 0 && x < world.W && y < world.H) world.paint(x, y, r, 'add', state.lastElement, 9);
  }
}
window.addEventListener('pointercancel', () => { stopPaint(); dropHeld(); });

// The brush paints along the path the pointer took since the last frame.
function paint() {
  if (!state.pointer) { r2d.cursor = null; return null; }
  const c = r2d.toCell(state.pointer.x, state.pointer.y);
  const r = state.brush;
  const mobTool = state.selected.kind === 'mob' || (state.selected.kind === 'tool' && ['grab', 'bolt', 'fill', 'meteor'].includes(state.selected.id));
  r2d.line = state.lineFrom && c.inside ? { x0: state.lineFrom.x, y0: state.lineFrom.y, x1: c.x, y1: c.y } : null;
  r2d.cursor = c.inside && !mobTool ? { x: c.x, y: c.y, r } : null;
  if (state.held) {
    const p = worldPoint(state.pointer.x, state.pointer.y);
    creatures.moveGrab(state.held, p.x, p.y);
  }
  if (state.painting) {
    const from = state.lastCell || c;
    const steps = Math.max(1, Math.abs(c.x - from.x), Math.abs(c.y - from.y));
    const every = Math.max(1, Math.floor(r / 2));
    const t = state.selected.kind === 'el' ? state.selected.id : 0;
    for (let s = 0; s <= steps; s += every) {
      const x = Math.round(from.x + (c.x - from.x) * s / steps), y = Math.round(from.y + (c.y - from.y) * s / steps);
      if (state.painting === 'wind') { world.blow(x, y, r * 2.5 + 4, 3); creatures.blow(x + 0.5, y + 0.5, r * 2.5 + 4); continue; }
      world.paint(x, y, r, state.painting, t, POUR);
      if (state.painting === 'erase') creatures.eraseAt(x + 0.5, y + 0.5, r);
    }
    state.lastCell = c;
  }
  return c.inside ? world.index(c.x, c.y) : null;
}

const KEY_TOOLS = { e: 'erase', h: 'heat', j: 'cool', g: 'grab', b: 'bomb', l: 'bolt', w: 'wind', n: 'line', f: 'fill', m: 'meteor' };
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'escape') { closePanels(); return; }
  if (!$('#scrim').hidden) return; // a panel is open: no shortcuts behind it
  if (k === ' ') { e.preventDefault(); setPaused(!state.paused); return; }
  if (k === '.') { setPaused(true); state.stepOnce = true; return; }
  if (keyFor.has(k)) { select({ kind: 'el', id: keyFor.get(k) }); return; }
  if (KEY_TOOLS[k]) { select({ kind: 'tool', id: KEY_TOOLS[k] }); return; }
  if (k === 't') { $('#btn-thermal').click(); return; }
  if (k === 'r') { resetScene(); return; }
  if (k === 'c') { clearScene(); return; }
  if (k === '?' || k === '/') { openPanel('help'); return; }
  if (k === '+' || k === '=') { zoomBy(1.25); return; }
  if (k === '-' || k === '_') { zoomBy(0.8); return; }
  if (k === '[' || k === ']') { setBrush(state.brush + (k === '[' ? -1 : 1)); return; }
  // Arrow keys move the view around when zoomed in.
  const pan = { arrowleft: [1, 0], arrowright: [-1, 0], arrowup: [0, 1], arrowdown: [0, -1] }[k];
  if (pan) { e.preventDefault(); r2d.pan(pan[0] * 60, pan[1] * 60); }
});
// Scroll zooms toward the mouse. Shift + scroll changes the brush size instead.
stage.addEventListener('wheel', e => {
  if (e.target.closest('.panel') || !$('#scrim').hidden) return; // let panels scroll
  e.preventDefault();
  if (e.shiftKey) { setBrush(state.brush + ((e.deltaY || e.deltaX) > 0 ? -1 : 1)); return; }
  const [sx, sy] = stagePoint(e.clientX, e.clientY);
  r2d.zoomAt(sx, sy, Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.0025));
}, { passive: false });

function zoomBy(factor) {
  const r = stage.getBoundingClientRect();
  r2d.zoomAt(r.width / 2, r.height / 2, factor);
}

// ----- coach mark -----
const coach = $('#coach');
if (store.get('painted', false)) coach.hidden = true;
function dismissCoach() {
  if (coach.hidden) return;
  coach.classList.add('out');
  setTimeout(() => { coach.hidden = true; }, 400);
  store.set('painted', true);
}

// ----- inspector -----
const insName = $('#ins-name'), insTemp = $('#ins-temp'), inspector = $('#inspector');
let lastIns = '';
function hoverMob() {
  if (!state.pointer || !creatures.list.length) return null;
  const p = worldPoint(state.pointer.x, state.pointer.y);
  const hit = creatures.pickPoint(p.x, p.y, 1.6);
  return hit ? hit.c : null;
}
function cellAt(x, y) {
  return world.index(Math.max(0, Math.min(world.W - 1, Math.floor(x))), Math.max(0, Math.min(world.H - 1, Math.floor(y))));
}
function inspect(i, mob) {
  let text;
  if (mob) {
    const h = mob.sp.headK;
    text = creatures.describe(mob) + '|' + fmtTemp(world.temp[cellAt(mob.px[h], mob.py[h])]);
  } else if (i == null) text = 'idle';
  else {
    const t = world.type[i];
    const burning = world.flags[i] & 4 ? ' · burning' : '';
    text = El.ELEMENTS[t].name + burning + '|' + fmtTemp(world.temp[i]);
  }
  if (text === lastIns) return;
  lastIns = text;
  inspector.classList.toggle('idle', text === 'idle');
  if (text === 'idle') return;
  const [a, b] = text.split('|');
  insName.textContent = a;
  insTemp.textContent = b;
}

// ----- layout -----
function resize() {
  const r = stage.getBoundingClientRect();
  // While the page is still settling (fonts, phone toolbars), keep refitting
  // the untouched starting scene so it always fills the screen exactly.
  if (!touched) {
    const { W, H } = screenSize();
    if (W !== world.W || H !== world.H) { world.resize(W, H); creatures.clear(); autumnGlade(world); r2d.rebuild(); }
  }
  r2d.resize(r.width, r.height);
}
new ResizeObserver(resize).observe(stage);

// ----- weather -----
// Rain and snow fall from the top of the sky. Storms add lightning.
const WEATHERS = ['clear', 'rain', 'storm', 'snow', 'hail', 'acid'];
const WEATHER_NAMES = { clear: 'Sunny', rain: 'Rain', storm: 'Storm', snow: 'Snow', hail: 'Hail', acid: 'Acid rain' };
state.weather = WEATHERS.includes(store.get('weather', 'clear')) ? store.get('weather', 'clear') : 'clear';
let nextStrike = 0;
function setWeather(w) {
  state.weather = w;
  store.set('weather', w);
  $('#weather-label').textContent = WEATHER_NAMES[w];
  $('#btn-weather').dataset.weather = w;
  nextStrike = performance.now() + 3000;
}
$('#btn-weather').addEventListener('click', () => setWeather(WEATHERS[(WEATHERS.indexOf(state.weather) + 1) % WEATHERS.length]));

function weatherStep() {
  const w = state.weather;
  if (w === 'clear') return;
  const t = { snow: El.SNOW, hail: El.HAIL, acid: El.ACID }[w] || El.WATER;
  const n = (w === 'storm' ? 2.2 : w === 'snow' ? 0.9 : w === 'hail' ? 0.7 : 1.3) * world.W / 200;
  const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
  for (let k = 0; k < count; k++) {
    const i = world.index((Math.random() * world.W) | 0, world.H - 1);
    if (world.type[i] === El.EMPTY) world.set(i, t);
  }
}

function weatherTick(now) {
  if (state.weather !== 'storm' || state.paused || now < nextStrike) return;
  nextStrike = now + 5000 + Math.random() * 9000;
  const x = 4 + ((Math.random() * (world.W - 8)) | 0);
  strikeAt(x);
}

// ----- time of day -----
// Day, night, or a slow cycle through both (four minutes a day). The light
// changes gradually rather than switching.
const TIMES = ['day', 'night', 'cycle'];
const TIME_NAMES = { day: 'Day', night: 'Night', cycle: 'Day & night' };
state.time = TIMES.includes(store.get('time', 'day')) ? store.get('time', 'day') : 'day';
let nightNow = state.time === 'night' ? 1 : 0, cycleT = 0;
function setTime(t) {
  state.time = t;
  store.set('time', t);
  $('#time-label').textContent = TIME_NAMES[t];
  $('#btn-time').dataset.time = t;
}
$('#btn-time').addEventListener('click', () => setTime(TIMES[(TIMES.indexOf(state.time) + 1) % TIMES.length]));
function timeTick(dt) {
  if (!state.paused) cycleT += dt;
  const target = state.time === 'day' ? 0 : state.time === 'night' ? 1
    : Math.min(1, Math.max(0, 0.5 - 0.62 * Math.cos(cycleT / 240 * Math.PI * 2)));
  nightNow += Math.max(-dt * 0.5, Math.min(dt * 0.5, target - nightNow));
  r2d.setNight(nightNow);
}

// ----- main loop -----
// One simulation step per screen frame on a 60 Hz screen, so motion is even.
const RATE = 60; // simulation steps per second at 1× speed
let last = performance.now();
let fpsT = 0, fpsN = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  settleTouch(false);
  const hover = paint();
  if (!state.paused) {
    state.acc += dt * state.speed * RATE;
    // At most 3 steps, and stop early if this frame's simulation time runs
    // out, so heavy moments slow the simulation slightly instead of the frame rate.
    const t0 = performance.now();
    let n = 0;
    while (state.acc >= 1 && n < 3 && (n === 0 || performance.now() - t0 < 10)) { weatherStep(); creatures.tick(); state.acc -= 1; n++; }
    if (state.acc > 3) state.acc = 0;
  } else if (state.stepOnce) {
    creatures.tick();
    state.stepOnce = false;
  }
  weatherTick(now);
  timeTick(dt);
  r2d.render(now / 1000, state.thermal);
  while (world.events.length) addDiscovery(world.events.shift());
  inspect(hover, hoverMob());
  fpsT += dt; fpsN++;
  if (fpsT > 1) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}

// Handy for poking at the simulation from the browser console.
window.sandgrove = { world, creatures, r2d, El };

// ----- start -----
select(state.selected);
setWeather(state.weather);
setTime(state.time);
setGore(creatures.gore);
setSpeed(state.speed);
syncBrush();
renderDiscoveries();
resize();
if (!store.get('welcomed', false)) openPanel('help');
requestAnimationFrame(frame);
