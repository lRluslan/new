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
];
const TOOL_ICONS = {
  erase: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 10 9 4l4 4-6 6H4l-1-1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M6 7l4 4" stroke="currentColor" stroke-width="1.5"/><path d="M8 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  heat: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c.5 2.4 3.5 3.8 3.5 7.2A3.5 3.5 0 0 1 4.5 8.7c0-1.6.8-2.6 1.6-3.4.1 1.3.7 2 1.4 2.3C7.3 5.3 7.4 3.4 8 1.5z" fill="currentColor"/></svg>',
  cool: '<svg viewBox="0 0 16 16" aria-hidden="true"><g stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M8 1.5v13M2.4 4.75l11.2 6.5M2.4 11.25l11.2-6.5"/><path d="M6.3 2.8 8 4.3l1.7-1.5M6.3 13.2 8 11.7l1.7 1.5"/></g></svg>',
};

// ----- the world -----
const world = new World(WORLD_SIZE.W, WORLD_SIZE.H, WORLD_SIZE.D);
autumnGlade(world);
const r2d = new Renderer2D(stage, world);
let r3d = null, loading3d = null;   // the 3D view loads the first time it is opened

const state = {
  mode: '2d',
  selected: { kind: 'el', id: El.SAND },
  paused: false,
  speed: store.get('speed', 1),
  brush: { '2d': 4, '3d': 3 },
  thermal: false,
  painting: null,     // 'add' | 'erase' | 'heat' | 'cool' while a button is held
  pointer: null,      // last pointer position over the stage
  lastCell: null,
  stepOnce: false,
  acc: 0,
};

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
}

// ----- controls -----
const brushInput = $('#brush'), brushOut = $('#brush-out');
const BRUSH_MAX = { '2d': 16, '3d': 8 };
function syncBrush() {
  const max = BRUSH_MAX[state.mode];
  brushInput.min = state.mode === '2d' ? 1 : 0;
  brushInput.max = max;
  brushInput.value = state.brush[state.mode];
  brushOut.textContent = state.brush[state.mode];
}
brushInput.addEventListener('input', () => { state.brush[state.mode] = +brushInput.value; brushOut.textContent = brushInput.value; });

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
function resetScene() { autumnGlade(world); }
function clearScene() { emptyWorld(world); }

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
  return state.selected.kind === 'tool' ? state.selected.id : 'add';
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
  state.painting = modeForButton(e.button);
  state.lastCell = null;
  dismissCoach();
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
window.addEventListener('pointerup', stopPaint);
window.addEventListener('pointercancel', stopPaint);

function attach3dInput(canvas) {
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    state.pointer = { x: e.clientX, y: e.clientY };
    if (e.button !== 0) return;
    if (e.pointerType === 'touch' && !e.isPrimary) { stopPaint(); return; }
    state.painting = modeForButton(0);
    dismissCoach();
  });
  canvas.addEventListener('pointermove', e => { state.pointer = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerleave', () => { if (!state.painting) state.pointer = null; });
}

// The 2D brush paints into the shared grid as a thin disc through the
// current slice (5 cells deep), so it shows up as a solid shape in 3D.
const SLICE_DEPTH = 2, SLICE_POUR = 3.5;
function paint2d() {
  if (!state.pointer) { r2d.cursor = null; return null; }
  const c = r2d.toCell(state.pointer.x, state.pointer.y);
  const r = state.brush['2d'];
  const z = r2d.z;
  r2d.cursor = c.inside ? { x: c.x, y: c.y, r } : null;
  if (state.painting) {
    const from = state.lastCell || c;
    const steps = Math.max(1, Math.abs(c.x - from.x), Math.abs(c.y - from.y));
    const every = Math.max(1, Math.floor(r / 2));
    const t = state.selected.kind === 'el' ? state.selected.id : 0;
    for (let s = 0; s <= steps; s += every) {
      const x = Math.round(from.x + (c.x - from.x) * s / steps), y = Math.round(from.y + (c.y - from.y) * s / steps);
      world.paint(x, y, z, r, state.painting, t, Math.min(r, SLICE_DEPTH), SLICE_POUR);
    }
    state.lastCell = c;
  }
  return c.inside ? world.index(c.x, c.y, z) : null;
}

function paint3d() {
  if (!state.pointer) { r3d.showCursor(null); return null; }
  const p = r3d.pick(state.pointer.x, state.pointer.y);
  const r = state.brush['3d'];
  const mode = state.painting || (state.selected.kind === 'tool' ? state.selected.id : 'add');
  const target = p ? (mode === 'add' ? p.place : (p.hit || p.place)) : null;
  r3d.showCursor(target, r);
  if (state.painting && target) {
    const t = state.selected.kind === 'el' ? state.selected.id : 0;
    world.paint(target[0], target[1], target[2], r + 0.5, state.painting, t);
  }
  const look = p && (p.hit || p.place);
  return look ? world.index(look[0], look[1], look[2]) : null;
}

const KEY_TOOLS = { e: 'erase', h: 'heat', j: 'cool' };
window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
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
    const max = BRUSH_MAX[state.mode], min = state.mode === '2d' ? 1 : 0;
    state.brush[state.mode] = Math.max(min, Math.min(max, state.brush[state.mode] + d));
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
function inspect(i) {
  let text = '';
  if (i == null) { inspector.classList.add('idle'); text = 'idle'; }
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

// ----- main loop -----
// One clock drives the one world, whichever view is on screen.
const RATE = 50; // simulation steps per second at 1× speed
let last = performance.now();
let fpsT = 0, fpsN = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const is2d = state.mode === '2d' || !r3d;
  const hover = is2d ? paint2d() : paint3d();
  if (!state.paused) {
    state.acc += dt * state.speed * RATE;
    // At most 3 steps, and stop early if this frame's simulation time runs
    // out, so heavy moments slow the simulation slightly instead of the frame rate.
    const t0 = performance.now();
    let n = 0;
    while (state.acc >= 1 && n < 3 && (n === 0 || performance.now() - t0 < 10)) { world.step(); state.acc -= 1; n++; }
    if (state.acc > 3) state.acc = 0;
  } else if (state.stepOnce) {
    world.step();
    state.stepOnce = false;
  }
  if (is2d) r2d.render(now / 1000, state.thermal);
  else r3d.render(dt, !state.paused);
  while (world.events.length) addDiscovery(world.events.shift());
  inspect(hover);
  fpsT += dt; fpsN++;
  if (fpsT > 1) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = 0; fpsN = 0; }
  requestAnimationFrame(frame);
}

// Handy for poking at the simulation from the browser console.
window.sandgrove = { world, r2d, get r3d() { return r3d; }, El };

// ----- start -----
select(state.selected);
setSlice(r2d.z);
setSpeed(state.speed);
syncBrush();
drawSwatches();
renderDiscoveries();
resize();
if (!store.get('welcomed', false)) openPanel('help');
requestAnimationFrame(frame);
if (store.get('mode', '2d') === '3d') setMode('3d');
