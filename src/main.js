// Sandgrove: app shell. Builds the interface, reads the mouse and keyboard,
// runs the simulation clock and switches between the two views.
//
// There is exactly one world: a 3D voxel grid with one simulation. The 3D
// view shows all of it; the 2D view shows one slice of it. Switching views
// never touches the world, so everything keeps running in both.

import * as El from './elements.js';
import { World } from './world.js';
import { autumnGlade, emptyWorld, WORLD_SIZE } from './scenes.js';
import { Renderer2D } from './render2d.js';
import { drawSwatch } from './textures.js';
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
  { id: 'erase', name: 'Eraser', key: 'E', desc: 'Removes anything it touches.' },
  { id: 'heat', name: 'Heat', key: 'H', desc: 'Raises the temperature. Melts, boils and ignites things.' },
  { id: 'cool', name: 'Cool', key: 'J', desc: 'Lowers the temperature, down to -200 °C. Freezes water.' },
  { id: 'grab', name: 'Grab', key: 'G', desc: 'Click and drag a creature to pick it up. Let go to drop it, or flick the mouse to throw it.' },
];
const TOOL_ICONS = {
  erase: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10 9 4l4 4-6 6H4l-1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 7l4 4" stroke="currentColor" stroke-width="1.5"/><path d="M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  heat: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c.5 2.4 3.5 3.8 3.5 7.2A3.5 3.5 0 0 1 4.5 8.7c0-1.6.8-2.6 1.6-3.4.1 1.3.7 2 1.4 2.3C7.3 5.3 7.4 3.4 8 1.5z" fill="currentColor"/></svg>',
  grab: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.2 8.2V3.6a1 1 0 0 1 2 0V7.5m0-.4V2.8a1 1 0 0 1 2 0v4.6m0-.3V3.8a1 1 0 0 1 2 0v5.4c0 2.8-1.6 4.8-4.2 4.8-1.6 0-2.5-.7-3.4-2L2.4 9.2a1 1 0 0 1 1.5-1.3l1.3 1.3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cool: '<svg viewBox="0 0 16 16" aria-hidden="true"><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5"/><path d="M6.3 2.8 8 4.3l1.7-1.5M6.3 13.2 8 11.7l1.7 1.5"/></g></svg>',
};

// ----- the world -----
const world = new World(WORLD_SIZE.W, WORLD_SIZE.H, WORLD_SIZE.D);
autumnGlade(world);
const creatures = new Creatures(world);
creatures.gore = store.get('gore', true);
const r2d = new Renderer2D(stage, world);
r2d.creatures = creatures;
let r3d = null, loading3d = null;   // the 3D view loads the first time it is opened

const state = {
  mode: '2d',
  selected: { kind: 'el', id: El.SAND },
  paused: false,
  speed: store.get('speed', 1),
  brush: { '2d': 4, '3d': 3, fly: 0 },
  thermal: false,
  painting: null,     // 'add' | 'erase' | 'heat' | 'cool' while a button is held
  pointer: null,      // last pointer position over the stage
  lastCell: null,
  stepOnce: false,
  acc: 0,
  fly: false,         // 3D free camera
  locked: false,      // mouse captured for looking around
  noLock: false,      // this page cannot capture the mouse: drag to look instead
  held: null,         // the creature being carried by the mouse
  holdDist: 0,        // 3D: how far along the mouse ray it is held
};
const keysDown = new Set();

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

function drawSwatches() {
  for (const [k, b] of elButtons) {
    if (!k.startsWith('el:')) continue;
    drawSwatch(b.querySelector('canvas'), +k.slice(3), state.mode);
  }
  drawSwatch($('#info-swatch'), state.selected.kind === 'el' ? state.selected.id : El.STONE, state.mode);
}

function fmtTemp(t) { return `${Math.round(t)} °C`; }

function select(sel) {
  state.selected = sel;
  for (const [k, b] of elButtons) b.classList.toggle('on', k === `${sel.kind}:${sel.id}`);
  const info = $('#info');
  if (sel.kind === 'el') {
    const e = El.ELEMENTS[sel.id];
    const facts = [];
    facts.push(['State', { 1: 'Solid', 2: 'Powder', 3: 'Liquid', 4: 'Gas' }[e.state]]);
    facts.push(['Density', `${e.density.toLocaleString('en-US')} kg/m³`]);
    if (e.temp !== undefined) facts.push(['Starts at', fmtTemp(e.temp)]);
    if (e.hot) facts.push([{ [El.EMPTY]: 'Boils', [El.GLASS]: 'Fuses' }[e.hot[1]] || 'Melts', fmtTemp(Math.floor(e.hot[0]))]);
    if (e.cold) facts.push([{ [El.ICE]: 'Freezes', [El.WATER]: 'Condenses' }[e.cold[1]] || 'Hardens', fmtTemp(Math.floor(e.cold[0]))]);
    if (e.ignite) facts.push([sel.id === El.GUNPOWDER ? 'Explodes' : 'Ignites', fmtTemp(e.ignite)]);
    info.querySelector('h3').textContent = e.name;
    info.querySelector('p').textContent = e.desc;
    info.querySelector('dl').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#info-swatch').hidden = false;
    $('#info-icon').hidden = true;
    drawSwatch($('#info-swatch'), sel.id, state.mode);
  } else if (sel.kind === 'mob') {
    const sp = SPECIES[sel.id];
    const facts = [
      ['Health', `${sp.hp}`],
      ['Density', `${sp.density.toLocaleString('en-US')} kg/m³`],
      ['Breathes', sp.breathes === 'water' ? 'Water' : sp.breathes ? 'Air' : 'Nothing'],
      ['Speed', sp.run >= 0.13 ? 'Fast' : sp.run >= 0.1 ? 'Medium' : 'Slow'],
    ];
    info.querySelector('h3').textContent = sp.name;
    info.querySelector('p').textContent = sp.desc + ' Click to drop one in; click and drag one to throw it.';
    info.querySelector('dl').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('#info-swatch').hidden = true;
    const icon = $('#info-icon');
    icon.hidden = false;
    icon.className = 'info-icon';
    icon.innerHTML = '<canvas width="24" height="24" style="width:100%;height:100%;image-rendering:pixelated"></canvas>';
    drawMobIcon(icon.querySelector('canvas'), sel.id);
  } else {
    const t = TOOLS.find(t => t.id === sel.id);
    info.querySelector('h3').textContent = t.name;
    info.querySelector('p').textContent = t.desc;
    info.querySelector('dl').innerHTML = '';
    $('#info-swatch').hidden = true;
    const icon = $('#info-icon');
    icon.hidden = false;
    icon.className = 'info-icon tool-' + t.id;
    icon.innerHTML = TOOL_ICONS[t.id];
  }
  $('#btn-clear-mobs').hidden = !(sel.kind === 'mob' || (sel.kind === 'tool' && sel.id === 'grab'));
}
$('#btn-clear-mobs').addEventListener('click', () => { dropHeld(); creatures.clear(); });

// ----- controls -----
const brushInput = $('#brush'), brushOut = $('#brush-out');
// Separate brush sizes for 2D, the 3D orbit view and fly mode (where a
// size of 0 means one block at a time, like a creative-mode builder).
const BRUSH_MAX = { '2d': 16, '3d': 8, fly: 8 };
const brushKey = () => (state.fly ? 'fly' : state.mode);
function syncBrush() {
  const key = brushKey();
  brushInput.min = key === '2d' ? 1 : 0;
  brushInput.max = BRUSH_MAX[key];
  brushInput.value = state.brush[key];
  brushOut.textContent = state.brush[key];
}
brushInput.addEventListener('input', () => { state.brush[brushKey()] = +brushInput.value; brushOut.textContent = brushInput.value; });

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

// Reset and Clear act on the one shared world, whichever view is open.
function resetScene() { dropHeld(); creatures.clear(); autumnGlade(world); }
function clearScene() { dropHeld(); creatures.clear(); emptyWorld(world); }

// ----- blood and damage effects -----
function setGore(on) {
  creatures.gore = on;
  store.set('gore', on);
  $('#btn-gore').setAttribute('aria-pressed', String(on));
  $('#gore-label').textContent = on ? 'Blood' : 'No blood';
}
$('#btn-gore').addEventListener('click', () => setGore(!creatures.gore));

// ----- slice -----
const sliceInput = $('#slice'), sliceOut = $('#slice-out');
sliceInput.max = world.D - 1;
function setSlice(z) {
  r2d.setSlice(z);
  sliceInput.value = r2d.z;
  sliceOut.textContent = r2d.z;
  if (r3d) r3d.showSlice(r2d.z);
}
sliceInput.addEventListener('input', () => setSlice(+sliceInput.value));

$('#btn-thermal').addEventListener('click', () => {
  state.thermal = !state.thermal;
  $('#btn-thermal').setAttribute('aria-pressed', String(state.thermal));
  $('#thermal-legend').hidden = !state.thermal;
});
$('#btn-orbit').addEventListener('click', () => {
  if (!r3d) return;
  r3d.controls.autoRotate = !r3d.controls.autoRotate;
  $('#btn-orbit').setAttribute('aria-pressed', String(r3d.controls.autoRotate));
});
$('#btn-view').addEventListener('click', () => {
  if (state.mode === '2d') r2d.resetZoom();
  else if (r3d) r3d.resetView();
});
for (const b of document.querySelectorAll('[data-pixel]')) b.addEventListener('click', () => {
  const s = +b.dataset.pixel;
  for (const o of document.querySelectorAll('[data-pixel]')) o.setAttribute('aria-pressed', String(o === b));
  store.set('pixel', s);
  if (r3d) r3d.setPixelScale(s);
});

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
function notice(text) {
  const t = document.createElement('div');
  t.className = 'toast notice';
  t.innerHTML = `<div><b>${text}</b></div>`;
  toasts.prepend(t);
  setTimeout(() => t.classList.add('out'), 5200);
  setTimeout(() => t.remove(), 5700);
}

// ----- mode switching -----
async function setMode(mode) {
  if (mode === state.mode && (mode === '2d' || r3d)) return;
  if (mode === '2d' && state.fly) setFly(false);
  if (mode === '3d' && !r3d) {
    if (!loading3d) loading3d = load3d();
    $('#loading').hidden = false;
    try { await loading3d; } catch (err) {
      console.error(err);
      loading3d = null;
      $('#loading').hidden = true;
      notice('The 3D engine could not load. Check your internet connection and try again.');
      return;
    }
    $('#loading').hidden = true;
  }
  state.mode = mode;
  app.dataset.mode = mode;
  state.painting = null;
  for (const b of document.querySelectorAll('[data-mode-btn]')) b.setAttribute('aria-selected', String(b.dataset.modeBtn === mode));
  r2d.setVisible(mode === '2d');
  if (r3d) {
    r3d.setVisible(mode === '3d');
    if (mode === '3d') { r3d.updateChunks(Infinity); r3d.showSlice(r2d.z); }
  }
  syncBrush();
  drawSwatches();
  store.set('mode', mode);
  resize();
}
// Only the 3D view is created here; the world it shows already exists.
async function load3d() {
  const { Renderer3D } = await import('./render3d.js');
  r3d = new Renderer3D(stage, world);
  r3d.creatures = creatures;
  r3d.setPixelScale(store.get('pixel', 2));
  for (const o of document.querySelectorAll('[data-pixel]')) o.setAttribute('aria-pressed', String(+o.dataset.pixel === r3d.pixelScale));
  r3d.setVisible(false);
  attach3dInput(r3d.canvas);
  resize();
  r3d.updateChunks(Infinity);
}
for (const b of document.querySelectorAll('[data-mode-btn]')) b.addEventListener('click', () => setMode(b.dataset.modeBtn));

// ----- input -----
function modeForButton(button) {
  if (button === 2) return 'erase';
  if (state.selected.kind === 'mob') return 'spawn';
  return state.selected.kind === 'tool' ? state.selected.id : 'add';
}

// ----- creatures and the mouse -----
// With a creature or the Grab tool selected, pressing on a creature picks it
// up; with a creature selected, pressing anywhere else drops a new one in.
function dropHeld() {
  if (state.held) creatures.release(state.held);
  state.held = null;
}
// Position under the pointer in the 2D view, in (fractional) cell units.
function point2d(clientX, clientY) {
  const r = r2d.canvas.getBoundingClientRect();
  const { W, H } = world;
  return { x: (clientX - r.left) / r.width * W, y: H - (clientY - r.top) / r.height * H };
}
function press2d(mode, e) {
  const p = point2d(e.clientX, e.clientY);
  const hit = creatures.pickPoint(p.x, p.y, r2d.z + 0.5, mode === 'grab' ? 2.6 : 1.4, true);
  if (hit) { state.held = hit.c; creatures.startGrab(hit.c, hit.k); creatures.moveGrab(hit.c, p.x, p.y, hit.c.pz[hit.k]); return; }
  if (mode !== 'spawn') return;
  if (p.x < 0 || p.y < 0 || p.x >= world.W || p.y >= world.H) return;
  creatures.spawn(state.selected.id, p.x, Math.floor(p.y), r2d.z, { lane: r2d.z });
}
// 3D: a ray from the camera (orbit view: through the mouse; fly mode: the crosshair).
function press3d(mode, ray, pick) {
  const ground = pick && pick.hit ? Math.hypot(pick.hit[0] + 0.5 - ray.o[0], pick.hit[1] + 0.5 - ray.o[1], pick.hit[2] + 0.5 - ray.o[2]) : 1e9;
  const hit = creatures.pickRay(ray.o, ray.d, ground + 1, mode === 'grab' ? 2.2 : 1.2);
  if (hit) { state.held = hit.c; state.holdDist = hit.t; creatures.startGrab(hit.c, hit.k); return; }
  if (mode !== 'spawn' || !pick || !pick.place) return;
  const [x, y, z] = pick.place;
  creatures.spawn(state.selected.id, x + 0.5, y, z + 0.5);
}
function carry3d(ray) {
  const c = state.held;
  if (!c) return;
  const d = state.holdDist;
  creatures.moveGrab(c, ray.o[0] + ray.d[0] * d, ray.o[1] + ray.d[1] * d, ray.o[2] + ray.d[2] * d);
}

// 2D: left paints, right erases, middle-drag pans. On touch, one finger
// paints and two fingers pinch to zoom and drag to pan.
const touches = new Map();
let pinch = null, panFrom = null;
const stagePoint = (x, y) => { const r = stage.getBoundingClientRect(); return [x - r.left, y - r.top]; };
function pinchState() {
  const [a, b] = [...touches.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}
r2d.canvas.addEventListener('contextmenu', e => e.preventDefault());
r2d.canvas.addEventListener('pointerdown', e => {
  try { r2d.canvas.setPointerCapture(e.pointerId); } catch { /* not every pointer can be captured */ }
  state.pointer = { x: e.clientX, y: e.clientY };
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) { stopPaint(); pinch = pinchState(); return; }
    if (touches.size > 2) return;
  }
  if (e.button === 1) { e.preventDefault(); panFrom = { x: e.clientX, y: e.clientY }; return; }
  if (e.button !== 0 && e.button !== 2) return;
  const mode = modeForButton(e.button);
  dismissCoach();
  if (mode === 'spawn' || mode === 'grab') { press2d(mode, e); return; }
  state.painting = mode;
  state.lastCell = null;
});
r2d.canvas.addEventListener('pointermove', e => {
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
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  if (e.button === 1 || e.pointerType !== 'touch') panFrom = null;
};
r2d.canvas.addEventListener('pointerup', endPointer);
r2d.canvas.addEventListener('pointercancel', endPointer);
r2d.canvas.addEventListener('pointerleave', () => { if (!state.painting) state.pointer = null; });
const stopPaint = () => { state.painting = null; state.lastCell = null; };
window.addEventListener('pointerup', () => { stopPaint(); dropHeld(); });
window.addEventListener('pointercancel', stopPaint);

let dragLook = null; // fly mode without mouse capture: left-drag looks, a click places
function attach3dInput(canvas) {
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    state.pointer = { x: e.clientX, y: e.clientY };
    if (state.fly) { flyPointerDown(e); return; }
    if (e.button !== 0) return;
    if (e.pointerType === 'touch' && !e.isPrimary) { stopPaint(); dropHeld(); return; }
    const mode = modeForButton(0);
    dismissCoach();
    if (mode === 'spawn' || mode === 'grab') { press3d(mode, r3d.ray(e.clientX, e.clientY), r3d.pick(e.clientX, e.clientY)); return; }
    state.painting = mode;
  });
  canvas.addEventListener('pointermove', e => {
    state.pointer = { x: e.clientX, y: e.clientY };
    if (!state.fly) return;
    if (state.locked) r3d.look(e.movementX, e.movementY);
    else if (dragLook) {
      r3d.look(e.clientX - dragLook.x, e.clientY - dragLook.y);
      dragLook.moved += Math.abs(e.clientX - dragLook.x) + Math.abs(e.clientY - dragLook.y);
      dragLook.x = e.clientX; dragLook.y = e.clientY;
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (dragLook && e.button === 0) {
      if (dragLook.moved < 6) {
        // A click, not a drag: place once (or drop a creature in).
        const mode = modeForButton(0);
        if (mode === 'spawn') press3d(mode, r3d.rayCenter(), r3d.pickCenter());
        else flyAct(mode, true);
      }
      dragLook = null;
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!state.painting) state.pointer = null; });
}

// ----- fly mode -----
function setFly(on) {
  if (on && (state.mode !== '3d' || !r3d)) return;
  if (on === state.fly) return;
  state.fly = on;
  app.dataset.fly = on ? 'on' : 'off';
  keysDown.clear();
  stopPaint();
  r3d.setFly(on);
  r3d.setAccent(on ? '#ffffff' : '#7ff0d0');
  $('#btn-fly').setAttribute('aria-pressed', String(on));
  syncBrush();
  if (on) { captureMouse(); dismissCoach(); }
  else if (document.pointerLockElement) document.exitPointerLock();
  updateFlyHint();
}

function captureMouse() {
  if (state.noLock || !r3d) return;
  try {
    const p = r3d.canvas.requestPointerLock();
    if (p && p.catch) p.catch(lockFailed);
  } catch { lockFailed(); }
}
function lockFailed() {
  if (state.noLock) return;
  state.noLock = true;
  updateFlyHint();
}
document.addEventListener('pointerlockchange', () => {
  state.locked = !!r3d && document.pointerLockElement === r3d.canvas;
  if (!state.locked) stopPaint();
  updateFlyHint();
});
document.addEventListener('pointerlockerror', lockFailed);

function updateFlyHint() {
  $('#crosshair').hidden = !state.fly;
  $('#fly-hint').hidden = !state.fly;
  $('#fly-lock').textContent = state.noLock
    ? 'Drag with the left mouse button to look around.'
    : state.locked ? 'Esc frees the mouse.' : 'Click to look around.';
}

function flyPointerDown(e) {
  e.preventDefault();
  if (!state.locked && !state.noLock) { captureMouse(); return; } // first click captures the mouse
  if (e.button === 1) { pickAimed(); return; }
  if (e.button === 2) { flyAct('erase', true); state.painting = 'erase'; return; }
  if (e.button !== 0) return;
  const mode = modeForButton(0);
  if (mode === 'grab' || mode === 'spawn') {
    const ray = r3d.rayCenter(), pick = r3d.pickCenter();
    const hit = creatures.pickRay(ray.o, ray.d, 1e9, 1.6);
    if (hit || mode === 'grab' || !state.noLock) { press3d(mode, ray, pick); return; }
  }
  if (state.noLock) { dragLook = { x: e.clientX, y: e.clientY, moved: 0 }; return; }
  flyAct(mode, true);
  state.painting = mode;
}

// Middle click: pick up the element you are looking at.
function pickAimed() {
  const p = r3d.pickCenter();
  if (!p || !p.hit) return;
  const t = world.type[world.index(p.hit[0], p.hit[1], p.hit[2])];
  if (elButtons.has('el:' + t)) select({ kind: 'el', id: t });
}

// Place, remove, heat or cool at the crosshair. Blocks go on the face you aim at.
let lastFlyAct = 0;
function flyAct(mode, now) {
  const t0 = performance.now();
  const repeat = mode === 'heat' || mode === 'cool' ? 0 : 140;
  if (!now && t0 - lastFlyAct < repeat) return;
  lastFlyAct = t0;
  const p = r3d.pickCenter();
  if (!p) return;
  const target = mode === 'add' ? p.place : (p.hit || p.place);
  if (!target) return;
  const r = state.brush.fly + 0.5;
  const t = state.selected.kind === 'el' ? state.selected.id : 0;
  if (mode === 'erase') creatures.eraseAt(target[0] + 0.5, target[1] + 0.5, target[2] + 0.5, r);
  if (mode === 'spawn' || mode === 'grab') return;
  world.paint(target[0], target[1], target[2], r, mode, t, r, 9); // full blocks, not a sprinkle
}

function paintFly(dt) {
  const f = (keysDown.has('KeyW') ? 1 : 0) - (keysDown.has('KeyS') ? 1 : 0);
  const rr = (keysDown.has('KeyD') ? 1 : 0) - (keysDown.has('KeyA') ? 1 : 0);
  const u = (keysDown.has('Space') ? 1 : 0) - (keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') ? 1 : 0);
  r3d.flyStep(dt, { f, r: rr, u });
  if (state.held) carry3d(r3d.rayCenter());
  const p = r3d.pickCenter();
  r3d.showCursor(p ? (p.hit || p.place) : null, state.brush.fly);
  if (state.painting) flyAct(state.painting, false);
  const look = p && (p.hit || p.place);
  return look ? world.index(look[0], look[1], look[2]) : null;
}
$('#btn-fly').addEventListener('click', () => setFly(!state.fly));
const FLY_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight']);
window.addEventListener('keyup', e => keysDown.delete(e.code));
window.addEventListener('blur', () => keysDown.clear());

// The 2D brush paints into the shared grid as a thin disc through the
// current slice (5 cells deep), so it shows up as a solid shape in 3D.
const SLICE_DEPTH = 2, SLICE_POUR = 3.5;
function paint2d() {
  if (!state.pointer) { r2d.cursor = null; return null; }
  const c = r2d.toCell(state.pointer.x, state.pointer.y);
  const r = state.brush['2d'];
  const z = r2d.z;
  const mobTool = state.selected.kind === 'mob' || (state.selected.kind === 'tool' && state.selected.id === 'grab');
  r2d.cursor = c.inside && !mobTool ? { x: c.x, y: c.y, r } : null;
  if (state.held) {
    const p = point2d(state.pointer.x, state.pointer.y);
    creatures.moveGrab(state.held, p.x, p.y, state.held.grab ? state.held.grab.z : r2d.z + 0.5);
  }
  if (state.painting) {
    const from = state.lastCell || c;
    const steps = Math.max(1, Math.abs(c.x - from.x), Math.abs(c.y - from.y));
    const every = Math.max(1, Math.floor(r / 2));
    const t = state.selected.kind === 'el' ? state.selected.id : 0;
    for (let s = 0; s <= steps; s += every) {
      const x = Math.round(from.x + (c.x - from.x) * s / steps), y = Math.round(from.y + (c.y - from.y) * s / steps);
      world.paint(x, y, z, r, state.painting, t, Math.min(r, SLICE_DEPTH), SLICE_POUR);
      if (state.painting === 'erase') creatures.eraseAt(x + 0.5, y + 0.5, z + 0.5, r, true);
    }
    state.lastCell = c;
  }
  return c.inside ? world.index(c.x, c.y, z) : null;
}

function paint3d() {
  if (!state.pointer) { r3d.showCursor(null); return null; }
  const p = r3d.pick(state.pointer.x, state.pointer.y);
  const r = state.brush['3d'];
  const mode = state.painting || modeForButton(0);
  const target = p ? (mode === 'add' || mode === 'spawn' ? p.place : (p.hit || p.place)) : null;
  r3d.showCursor(mode === 'grab' ? null : target, mode === 'spawn' ? 0 : r);
  if (state.held) carry3d(r3d.ray(state.pointer.x, state.pointer.y));
  if (state.painting && target) {
    const t = state.selected.kind === 'el' ? state.selected.id : 0;
    world.paint(target[0], target[1], target[2], r + 0.5, state.painting, t);
    if (state.painting === 'erase') creatures.eraseAt(target[0] + 0.5, target[1] + 0.5, target[2] + 0.5, r + 0.5);
  }
  const look = p && (p.hit || p.place);
  return look ? world.index(look[0], look[1], look[2]) : null;
}

const KEY_TOOLS = { e: 'erase', h: 'heat', j: 'cool', g: 'grab' };
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (state.mode === '3d' && e.code === 'Tab') { e.preventDefault(); setFly(!state.fly); return; }
  if (state.fly) {
    if (FLY_KEYS.has(e.code)) { e.preventDefault(); keysDown.add(e.code); return; }
    if (k === 'r' || k === 'c') return; // no accidental resets while flying
  }
  if (k === 'escape') { closePanels(); return; }
  if (k === ' ') { e.preventDefault(); setPaused(!state.paused); return; }
  if (k === '.') { setPaused(true); state.stepOnce = true; return; }
  if (keyFor.has(k)) { select({ kind: 'el', id: keyFor.get(k) }); return; }
  if (KEY_TOOLS[k]) { select({ kind: 'tool', id: KEY_TOOLS[k] }); return; }
  if (k === 't' && state.mode === '2d') { $('#btn-thermal').click(); return; }
  if (k === 'm') { setMode(state.mode === '2d' ? '3d' : '2d'); return; }
  if (k === 'r') { resetScene(); return; }
  if (k === 'c') { clearScene(); return; }
  if (k === '?' || k === '/') { openPanel('help'); return; }
  if (k === '+' || k === '=') { zoomBy(1.25); return; }
  if (k === '-' || k === '_') { zoomBy(0.8); return; }
  if (k === 'w' || k === 's' || (state.mode === '2d' && (k === 'arrowup' || k === 'arrowdown'))) {
    e.preventDefault();
    setSlice(r2d.z + (k === 'w' || k === 'arrowup' ? -1 : 1));
    return;
  }
  if (k === '[' || k === ']') {
    const d = k === '[' ? -1 : 1;
    const key = brushKey(), max = BRUSH_MAX[key], min = key === '2d' ? 1 : 0;
    state.brush[key] = Math.max(min, Math.min(max, state.brush[key] + d));
    syncBrush();
    return;
  }
  if (state.mode === '3d' && r3d) {
    if (k === 'a' || k === 'arrowleft') r3d.orbit(-0.12);
    if (k === 'd' || k === 'arrowright') r3d.orbit(0.12);
  }
});
// Scroll zooms the 2D view toward the mouse (the 3D camera handles its own
// scroll zoom). Shift + scroll changes the brush size instead.
stage.addEventListener('wheel', e => {
  if (state.fly) {
    e.preventDefault();
    const d = (e.deltaY || e.deltaX) > 0 ? -1 : 1;
    state.brush.fly = Math.max(0, Math.min(BRUSH_MAX.fly, state.brush.fly + d));
    syncBrush();
    return;
  }
  if (state.mode !== '2d') return;
  e.preventDefault();
  if (e.shiftKey) {
    const d = (e.deltaY || e.deltaX) > 0 ? -1 : 1;
    state.brush['2d'] = Math.max(1, Math.min(BRUSH_MAX['2d'], state.brush['2d'] + d));
    syncBrush();
    return;
  }
  const [sx, sy] = stagePoint(e.clientX, e.clientY);
  r2d.zoomAt(sx, sy, Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.0025));
}, { passive: false });

function zoomBy(factor) {
  if (state.mode === '2d' || !r3d) { const r = stage.getBoundingClientRect(); r2d.zoomAt(r.width / 2, r.height / 2, factor); }
  else r3d.zoom(factor);
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
function hoverMob2d() {
  if (!state.pointer || !creatures.list.length) return null;
  const p = point2d(state.pointer.x, state.pointer.y);
  const hit = creatures.pickPoint(p.x, p.y, r2d.z + 0.5, 1.6, true);
  return hit ? hit.c : null;
}
function hoverMob3d() {
  if (!r3d || !creatures.list.length) return null;
  if (!state.fly && !state.pointer) return null;
  const ray = state.fly ? r3d.rayCenter() : r3d.ray(state.pointer.x, state.pointer.y);
  const hit = creatures.pickRay(ray.o, ray.d, 1e9, 1);
  return hit ? hit.c : null;
}
function inspect(i, mob) {
  let text = '';
  if (mob) {
    inspector.classList.remove('idle');
    const c = mob.sp.headK;
    text = creatures.describe(mob) + '|' + fmtTemp(world.temp[world.index(Math.max(0, Math.min(world.W - 1, Math.floor(mob.px[c]))), Math.max(0, Math.min(world.H - 1, Math.floor(mob.py[c]))), Math.max(0, Math.min(world.D - 1, Math.floor(mob.pz[c]))))]);
    i = -1;
  } else if (i == null) { inspector.classList.add('idle'); text = 'idle'; }
  else {
    inspector.classList.remove('idle');
    const t = world.type[i];
    const name = El.ELEMENTS[t].name;
    const burning = world.flags[i] & 4 ? ' · burning' : '';
    text = name + burning + '|' + fmtTemp(world.temp[i]);
  }
  if (text === lastIns) return;
  lastIns = text;
  if (i != null) {
    const [a, b] = text.split('|');
    insName.textContent = a;
    insTemp.textContent = b;
  }
}

// ----- layout -----
function resize() {
  const r = stage.getBoundingClientRect();
  r2d.resize(r.width, r.height);
  if (r3d) r3d.resize(r.width, r.height);
}
new ResizeObserver(resize).observe(stage);

// ----- weather -----
// Rain and snow fall over the whole world (with a little extra on the slice
// the side view shows, so you can see it there). Storms add lightning.
const WEATHERS = ['clear', 'rain', 'storm', 'snow'];
const WEATHER_NAMES = { clear: 'Clear', rain: 'Rain', storm: 'Storm', snow: 'Snow' };
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
  const t = w === 'snow' ? El.SNOW : El.WATER;
  const top = world.H - 1;
  const drop = (x, z) => {
    const i = world.index(x, top, z);
    if (world.type[i] === El.EMPTY) world.set(i, t);
  };
  const n = w === 'snow' ? 3 : w === 'storm' ? 6 : 4;
  for (let k = 0; k < n; k++) drop((Math.random() * world.W) | 0, (Math.random() * world.D) | 0);
  if (state.mode === '2d' && Math.random() < 0.6) drop((Math.random() * world.W) | 0, r2d.z);
}

function weatherTick(now) {
  if (state.weather !== 'storm' || state.paused || now < nextStrike) return;
  nextStrike = now + 5000 + Math.random() * 9000;
  const x = 4 + ((Math.random() * (world.W - 8)) | 0);
  const z = state.mode === '2d' || !r3d ? r2d.z : 4 + ((Math.random() * (world.D - 8)) | 0);
  world.strike(x, z);
  creatures.lightning(x, z);
  const f = $('#flash');
  f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
}

// ----- main loop -----
// One clock drives the one world, whichever view is on screen.
const RATE = 50; // simulation steps per second at 1× speed
let last = performance.now();
let fpsT = 0, fpsN = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const is2d = state.mode === '2d' || !r3d;
  const hover = is2d ? paint2d() : state.fly ? paintFly(dt) : paint3d();
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
  if (is2d) r2d.render(now / 1000, state.thermal);
  else r3d.render(dt, !state.paused);
  while (world.events.length) addDiscovery(world.events.shift());
  inspect(hover, is2d ? hoverMob2d() : hoverMob3d());
  fpsT += dt; fpsN++;
  if (fpsT > 1) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}

// Handy for poking at the simulation from the browser console.
window.sandgrove = { world, creatures, r2d, get r3d() { return r3d; }, El };

// ----- start -----
select(state.selected);
setSlice(r2d.z);
setWeather(state.weather);
setGore(creatures.gore);
setSpeed(state.speed);
syncBrush();
drawSwatches();
renderDiscoveries();
resize();
if (!store.get('welcomed', false)) openPanel('help');
requestAnimationFrame(frame);
if (store.get('mode', '2d') === '3d') setMode('3d');
