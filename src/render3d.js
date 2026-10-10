// 3D renderer: shows the voxel world as a diorama, a floating island hanging
// in a starry teal sky that you can turn around and see from every side.
// The world is turned into textured block meshes (only the faces you can see,
// with soft corner shadows). Rendered at a low resolution and scaled up so it
// keeps a pixel-art look.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as El from './elements.js';
import { buildAtlas, tileFor, COLS, ROWS, TILE, PAD, CELL } from './textures.js';
import { rng } from './scenes.js';

const { EMPTY, DIRT, WOOD, PLANT, STONE, WATER, STATE, GAS, GROUP3, ALPHA3, OCCLUDES, GLOWS } = El;

const FACES = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
// For each face corner, the three cells that can darken it (ambient occlusion).
for (const f of FACES) {
  const a = f.dir.findIndex(v => v !== 0);
  const [u, v] = [0, 1, 2].filter(k => k !== a);
  f.ao = f.corners.map(c => {
    const s1 = [...f.dir], s2 = [...f.dir];
    s1[u] += c[u] ? 1 : -1;
    s2[v] += c[v] ? 1 : -1;
    const cc = [...f.dir]; cc[u] += c[u] ? 1 : -1; cc[v] += c[v] ? 1 : -1;
    return [s1, s2, cc];
  });
}
const AO_LEVEL = [1, 0.8, 0.64, 0.5];
const ATLAS_W = COLS * CELL, ATLAS_H = ROWS * CELL;

// Where two different see-through materials touch, only one of them draws
// the shared face; drawing both puts two faces on one plane, which flickers.
const FACE_RANK = new Uint8Array(El.COUNT);
for (let t = 1; t < El.COUNT; t++) FACE_RANK[t] = GROUP3[t] === 3 ? 1 : 2;
const ownsFace = (t, nt) => nt === EMPTY || FACE_RANK[t] > FACE_RANK[nt] || (FACE_RANK[t] === FACE_RANK[nt] && t > nt);

// Fixed brightness variation per voxel, from its position only, so a voxel's
// colour never changes unless the voxel itself changes.
function tintAt(x, y, z) {
  let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return 0.93 + (((h ^ (h >>> 16)) >>> 0) / 4294967296) * 0.1;
}

class GeoBuf {
  constructor() { this.cap = 0; this.grow(4096); this.reset(); }
  grow(n) {
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 4);
    if (this.pos) { pos.set(this.pos); nor.set(this.nor); uv.set(this.uv); col.set(this.col); }
    this.pos = pos; this.nor = nor; this.uv = uv; this.col = col; this.cap = n;
  }
  reset() { this.n = 0; this.idx = []; }
  geometry() {
    if (this.n === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, this.n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, this.n * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, this.n * 4), 4));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// Build meshes for the box [x0,x1)×[y0,y1)×[z0,z1) of a voxel grid.
// src: { W, H, D, type, ox, oy, oz, openBelow?, capTop? } (offsets place it in
// the world; openBelow draws bottom faces, capTop hides top faces).
function meshBox(src, x0, y0, z0, x1, y1, z1, bufs, stats) {
  const { W, H, D, type } = src;
  const L = W * D;
  for (const b of bufs) b.reset();
  const solidAt = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) ? 0 : OCCLUDES[type[x + W * (z + D * y)]];
  for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
    const i = x + W * (z + D * y);
    const t = type[i];
    if (t === EMPTY) continue;
    const g = GROUP3[t], buf = bufs[g];
    if (GLOWS[t] && stats) { stats.n++; stats.x += x; stats.y += y; stats.z += z; }
    const above = y < H - 1 ? type[i + L] : EMPTY;
    const grassy = t === DIRT && !OCCLUDES[above] && above !== WATER;
    const tint = tintAt(x + src.ox, y + src.oy, z + src.oz);
    const boost = g === 2 ? 1.9 : 1;
    const alpha = ALPHA3[t];
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
      if (ny < 0 && !src.openBelow) continue;   // the world's floor sits on the island
      if (ny >= H && src.capTop) continue;      // the island's top is hidden under the world
      const nt = (nx < 0 || nz < 0 || ny < 0 || nx >= W || nz >= D || ny >= H) ? EMPTY : type[nx + W * (nz + D * ny)];
      if (nt === t || OCCLUDES[nt] || !ownsFace(t, nt)) continue;
      if (buf.n + 4 > buf.cap) buf.grow(buf.cap * 2);
      const tile = tileFor(t, f, grassy);
      const tc = tile % COLS, tr = Math.floor(tile / COLS);
      const base = buf.n;
      const ao = [1, 1, 1, 1];
      for (let k = 0; k < 4; k++) {
        const c = face.corners[k];
        const v = buf.n++;
        buf.pos[v * 3] = x + c[0] + src.ox; buf.pos[v * 3 + 1] = y + c[1] + src.oy; buf.pos[v * 3 + 2] = z + c[2] + src.oz;
        buf.nor[v * 3] = face.dir[0]; buf.nor[v * 3 + 1] = face.dir[1]; buf.nor[v * 3 + 2] = face.dir[2];
        buf.uv[v * 2] = (tc * CELL + PAD + c[3] * TILE) / ATLAS_W;
        buf.uv[v * 2 + 1] = 1 - (tr * CELL + PAD + (1 - c[4]) * TILE) / ATLAS_H;
        let light = 1;
        if (g === 0) {
          const [s1, s2, cc] = face.ao[k];
          const a = solidAt(x + s1[0], y + s1[1], z + s1[2]), b = solidAt(x + s2[0], y + s2[1], z + s2[2]);
          const occ = a && b ? 3 : a + b + solidAt(x + cc[0], y + cc[1], z + cc[2]);
          ao[k] = occ;
          light = AO_LEVEL[occ];
        }
        const l = light * tint * boost;
        buf.col[v * 4] = l; buf.col[v * 4 + 1] = l; buf.col[v * 4 + 2] = l; buf.col[v * 4 + 3] = alpha;
      }
      // Flip the quad diagonal so the shading gradient looks right.
      if (ao[0] + ao[3] > ao[1] + ao[2]) buf.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
      else buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
}

// Smooth value noise for the island's shape.
function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// The rocky underside the world sits on: an upside-down mountain that is
// thin at the rim and deepest in the middle, with roots, vines and a few
// ice crystals hanging from it.
function makeIsland(world) {
  const W = world.W, D = world.D;
  const IH = Math.round(Math.min(W, D) * 0.9 + 30);
  const type = new Uint8Array(W * IH * D);
  const rand = rng(77);
  const idx = (x, y, z) => x + W * (z + D * y);
  const depth = new Int32Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    // Rounded like an upside-down mountain: deepest in the middle, thin at the
    // rim, with lumpy ridges and clusters of stalactites.
    const r = Math.hypot((x - W / 2 + 0.5) / (W / 2), (z - D / 2 + 0.5) / (D / 2));
    const e = Math.min(x, W - 1 - x, z, D - 1 - z);
    const body = (IH - 14) * Math.pow(Math.max(0, 1 - r * r * 0.85), 1.6);
    const lumps = 10 * vnoise(x / 13, z / 11) + 5 * vnoise(x / 5 + 9, z / 5);
    const spikes = Math.pow(vnoise(x / 3.5 + 40, z / 3.5), 6) * 26;
    const d = Math.min(3 + e * 1.4, body + lumps + spikes) + 2;
    const dd = Math.max(2, Math.min(IH - 1, Math.round(d)));
    depth[x + W * z] = dd;
    // Rock layers in bands that follow the depth, so the island's rounded
    // shape reads clearly from any angle.
    const wobble = 3 * vnoise(x / 9, z / 9);
    for (let k = 0; k < dd; k++) {
      const y = IH - 1 - k;
      const band = Math.floor((k + wobble) / 5) % 5;
      let t = band === 1 ? DIRT : band === 3 ? El.SAND : STONE;
      if (k > 3 && hash2(x * 7 + k, z * 3 - k) < 0.03) t = El.OBSIDIAN;
      type[idx(x, y, z)] = t;
    }
  }
  const hang = (x, z, from, len, t) => {
    for (let k = 0; k < len; k++) {
      const y = IH - 1 - from - k;
      if (y < 0) break;
      const i = idx(x, y, z);
      if (type[i] === EMPTY) type[i] = t;
    }
  };
  // Roots and vines spill over the rim and dangle below the island.
  for (let n = 0; n < 160; n++) {
    const side = (rand() * 4) | 0;
    const x = side < 2 ? (rand() * W) | 0 : side === 2 ? 0 : W - 1;
    const z = side >= 2 ? (rand() * D) | 0 : side === 0 ? 0 : D - 1;
    hang(x, z, 0, 4 + ((rand() * 14) | 0), rand() < 0.35 ? WOOD : PLANT);
  }
  for (let n = 0; n < 160; n++) {
    const x = 2 + ((rand() * (W - 4)) | 0), z = 2 + ((rand() * (D - 4)) | 0);
    const d = depth[x + W * z];
    if (d < 8) continue;
    const t = rand() < 0.45 ? El.ICE : rand() < 0.5 ? WOOD : STONE;
    hang(x, z, d, 2 + ((rand() * (t === El.ICE ? 4 : 9)) | 0), t);
  }
  return { W, H: IH, D, type, ox: -W / 2, oy: -IH, oz: -D / 2, openBelow: true, capTop: true };
}

// A little floating rock with grass on top, sometimes with a tree.
function makeIslet(rand, size) {
  const S = size, H = Math.round(size * 1.6);
  const W = S * 2 + 1;
  const type = new Uint8Array(W * H * W);
  const idx = (x, y, z) => x + W * (z + W * y);
  const top = Math.round(H * 0.45);
  for (let z = 0; z < W; z++) for (let x = 0; x < W; x++) {
    const r = Math.hypot(x - S, z - S) / S;
    if (r > 1) continue;
    const d = Math.round((1 - r) * top * (0.75 + 0.5 * rand())) + 1;
    for (let k = 0; k < d; k++) type[idx(x, top - k, z)] = k < 2 ? DIRT : STONE;
  }
  if (rand() < 0.6) {
    const h = 3 + ((rand() * (H - top - 6)) | 0);
    for (let y = top + 1; y <= top + h; y++) type[idx(S, y, S)] = WOOD;
    const cr = 2 + rand() * 1.8, cy = top + h + 1;
    for (let y = Math.floor(cy - cr); y <= cy + cr; y++) for (let z = 0; z < W; z++) for (let x = 0; x < W; x++)
      if (y < H && Math.hypot(x - S, (y - cy) * 1.2, z - S) <= cr && type[idx(x, y, z)] === EMPTY) type[idx(x, y, z)] = PLANT;
  }
  return { W, H, D: W, type, ox: -S, oy: -top, oz: -S, openBelow: true };
}

// A soft voxel cloud.
function makeCloud(rand) {
  const W = 34, H = 9, D = 22;
  const type = new Uint8Array(W * H * D);
  for (let b = 0; b < 6; b++) {
    const cx = 6 + rand() * (W - 12), cz = 5 + rand() * (D - 10), cy = 3 + rand() * 2, r = 3 + rand() * 4;
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++)
      if (Math.hypot((x - cx) / 1.4, (y - cy) * 1.5, z - cz) <= r) type[x + W * (z + D * y)] = El.SNOW;
  }
  return { W, H, D, type, ox: -W / 2, oy: -H / 2, oz: -D / 2, openBelow: true };
}

export class Renderer3D {
  constructor(stage, world) {
    this.world = world;
    this.stage = stage;
    this.pixelScale = 2;
    const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1 / this.pixelScale);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.canvas = renderer.domElement;
    this.canvas.className = 'view3d';
    stage.append(this.canvas);

    const scene = this.scene = new THREE.Scene();
    const skyMid = new THREE.Color('#123d3f');

    // The camera circles the floating world; it can go all the way around,
    // underneath included, and zooms toward whatever is under the mouse.
    const camera = this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 3000);
    const target = new THREE.Vector3(0, world.H * 0.12, 0);
    this.home = { pos: target.clone().add(new THREE.Vector3(0.52, 0.42, 0.74).normalize().multiplyScalar(world.W * 1.25)), target };
    camera.position.copy(this.home.pos);
    const controls = this.controls = new OrbitControls(camera, this.canvas);
    controls.target.copy(this.home.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 20;
    controls.maxDistance = world.W * 3;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.zoomToCursor = true;
    controls.rotateSpeed = 0.8;
    this.homeDir = this.home.pos.clone().sub(target).normalize();
    this.userMoved = false;
    controls.addEventListener('start', () => { this.userMoved = true; });
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.autoRotateSpeed = 0.5;
    controls.update();

    // Sky: deep teal space, brighter toward the sun, with a faint nebula band.
    this.sunDir = new THREE.Vector3(0.55, 0.85, 0.3).normalize();
    const sky = this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1400, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          top: { value: new THREE.Color('#1d5a57') }, mid: { value: skyMid }, bottom: { value: new THREE.Color('#061416') },
          sunDir: { value: this.sunDir },
        },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vDir;
          void main(){ vec3 d = normalize(vDir); float h = d.y;
            vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.8, h)) : mix(mid, bottom, smoothstep(0.0, -0.6, h));
            float s = max(dot(d, sunDir), 0.0);
            c += vec3(0.55, 0.95, 0.8) * (pow(s, 5.0) * 0.28 + pow(s, 60.0) * 0.5);
            float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.2, -1.0))) * 2.2, 2.0));
            c += vec3(0.08, 0.2, 0.18) * band * (0.6 + 0.4 * sin(d.x * 7.0 + d.y * 5.0));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }));
    sky.renderOrder = -1;
    scene.add(sky);

    scene.add(new THREE.HemisphereLight('#a6f0dc', '#1d4a47', 1.2));
    // A soft teal light from below so the island's underside is never black.
    const under = new THREE.DirectionalLight('#6fd4c6', 1.8);
    under.position.set(-0.4, -1, -0.3);
    scene.add(under);
    const sun = this.sun = new THREE.DirectionalLight('#eafff2', 2.2);
    sun.position.copy(this.sunDir).multiplyScalar(110);
    sun.castShadow = true;
    const shadowSize = renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const reach = world.W / 2 + 30;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 10, far: reach * 4 });
    sun.position.copy(this.sunDir).multiplyScalar(reach * 1.8);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.3;
    scene.add(sun, sun.target);
    this.glowLight = new THREE.PointLight('#ff8a3a', 0, 70, 1.4);
    scene.add(this.glowLight);

    const atlas = new THREE.CanvasTexture(buildAtlas());
    // Crisp pixels up close, smoothly averaged with mipmaps far away, so distant
    // blocks do not sparkle or crawl when the camera moves.
    atlas.magFilter = THREE.NearestFilter;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.generateMipmaps = true;
    atlas.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    atlas.colorSpace = THREE.SRGBColorSpace;
    this.materials = [
      new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true }),
      // Water, ice, glass, acid: see-through but solid enough to write depth.
      new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true }),
      new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true }),
      // Smoke.
      new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, transparent: true, depthWrite: false }),
    ];

    // Lean toward the sharper mipmap level so blocks keep their pixel texture.
    for (const m of this.materials) {
      m.onBeforeCompile = sh => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
          'vec4 sampledDiffuseColor = texture2D( map, vMapUv, -0.9 ); diffuseColor *= sampledDiffuseColor;');
      };
    }

    this.bufs = [new GeoBuf(), new GeoBuf(), new GeoBuf(), new GeoBuf()];
    this.src = { W: world.W, H: world.H, D: world.D, type: world.type, ox: -world.W / 2, oy: 0, oz: -world.D / 2 };
    this.chunks = Array.from({ length: world.chunkCount }, () => [null, null, null, null]);
    this.chunkGlow = Array.from({ length: world.chunkCount }, () => ({ n: 0, x: 0, y: 0, z: 0 }));

    this.buildDiorama();
    this.buildSkyDetails();

    // Outline of the slice the 2D view shows. It fades in when the slice moves.
    const sm = this.sliceMarker = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(world.W, world.H)),
      new THREE.LineBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false }));
    sm.position.y = world.H / 2;
    sm.visible = false;
    this.sliceFade = 0;
    scene.add(sm);

    // Brush cursor.
    this.cursor = new THREE.Group();
    this.cursor.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: '#7ff0d0', transparent: true, opacity: 0.95, depthTest: false })));
    this.cursor.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: '#7ff0d0', transparent: true, opacity: 0.12, depthWrite: false })));
    this.cursor.children[0].renderOrder = 10;
    this.cursor.visible = false;
    scene.add(this.cursor);

    // 4× multisampling smooths block edges so they do not crawl as the camera moves.
    const composer = this.composer = new EffectComposer(renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.setPixelRatio(1 / this.pixelScale);
    composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.82);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());

    this.meshCursor = 0;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.time = 0;
  }

  // Mesh a decor voxel grid (all four material groups) into a group.
  meshDecor(src, S, opts = {}) {
    const group = new THREE.Group();
    const bufs = [new GeoBuf(), new GeoBuf(), new GeoBuf(), new GeoBuf()];
    for (let y = 0; y < src.H; y += S) for (let z = 0; z < src.D; z += S) for (let x = 0; x < src.W; x += S) {
      meshBox(src, x, y, z, Math.min(src.W, x + S), Math.min(src.H, y + S), Math.min(src.D, z + S), bufs, null);
      for (let g = 0; g < 4; g++) {
        const geo = bufs[g].geometry();
        if (!geo) continue;
        const m = new THREE.Mesh(geo, opts.material || this.materials[g]);
        m.castShadow = !!opts.shadows && g === 0;
        m.receiveShadow = !!opts.shadows && g !== 2;
        group.add(m);
      }
    }
    return group;
  }

  // The floating island under the world, little islets around it and clouds below.
  buildDiorama() {
    const w = this.world;
    this.scene.add(this.meshDecor(makeIsland(w), 32, { shadows: true }));
    const rand = rng(404);
    this.floaters = [];
    for (let k = 0; k < 7; k++) {
      const islet = this.meshDecor(makeIslet(rand, 4 + ((rand() * 6) | 0)), 32);
      const ang = (k / 7) * Math.PI * 2 + rand() * 0.5;
      const rx = w.W * (0.72 + rand() * 0.3), rz = w.D * 1.4 + w.W * 0.25 * rand();
      islet.position.set(Math.cos(ang) * rx, w.H * (-0.35 + rand() * 0.9), Math.sin(ang) * rz);
      islet.rotation.y = rand() * Math.PI * 2;
      this.floaters.push({ obj: islet, baseY: islet.position.y, phase: rand() * 6.28, spin: (rand() - 0.5) * 0.04, bob: 1.5 + rand() * 2 });
      this.scene.add(islet);
    }
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#dff7f0', transparent: true, opacity: 0.32, depthWrite: false });
    this.clouds = [];
    for (let k = 0; k < 12; k++) {
      const cloud = this.meshDecor(makeCloud(rand), 64, { material: cloudMat });
      cloud.position.set((rand() - 0.5) * w.W * 2.4, -w.H * (0.75 + rand() * 0.6), (rand() - 0.5) * w.W * 1.6);
      cloud.scale.setScalar(1 + rand() * 1.2);
      cloud.rotation.y = rand() * Math.PI;
      this.clouds.push({ obj: cloud, speed: 1.5 + rand() * 2.5 });
      this.scene.add(cloud);
    }
  }

  // Stars far away and dust motes floating around the island.
  buildSkyDetails() {
    const w = this.world, rand = rng(31);
    const n = 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1, a = rand() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(a) * r * 1200; pos[i * 3 + 1] = u * 1200; pos[i * 3 + 2] = Math.sin(a) * r * 1200;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#d6fff2', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, depthWrite: false, fog: false }));
    this.scene.add(this.stars);
    const m = 900, dp = new Float32Array(m * 3);
    for (let i = 0; i < m; i++) {
      dp[i * 3] = (rand() - 0.5) * w.W * 1.6; dp[i * 3 + 1] = -w.H * 0.6 + rand() * w.H * 1.6; dp[i * 3 + 2] = (rand() - 0.5) * (w.D + w.W * 0.6);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({
      color: '#d9fff0', size: 0.4, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.dustTop = w.H * 1.0; this.dustBottom = -w.H * 0.6;
    this.scene.add(this.dust);
  }

  setVisible(v) { this.canvas.hidden = !v; }

  setPixelScale(s) {
    this.pixelScale = s;
    this.renderer.setPixelRatio(1 / s);
    this.composer.setPixelRatio(1 / s);
    if (this.size) this.resize(this.size[0], this.size[1]);
  }

  resize(w, h) {
    this.size = [w, h];
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Pull the starting view back far enough that the whole island fits the screen.
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    const dist = Math.max(this.world.W * 1.25, (this.world.W * 0.62) / Math.tan(hHalf));
    this.home.pos.copy(this.home.target).addScaledVector(this.homeDir, dist);
    if (!this.userMoved) { this.camera.position.copy(this.home.pos); this.controls.update(); }
  }

  rebuildAll() { this.world.dirty.fill(1); }

  // Rebuild changed chunks for at most `maxMs` milliseconds, carrying on
  // next frame from where it stopped, so lots of moving water never stalls
  // a frame. Chunks in view go first.
  updateChunks(maxMs) {
    const w = this.world;
    const { CX, CZ } = w;
    const start = performance.now();
    let done = 0;
    if (!this.frustum) { this.frustum = new THREE.Frustum(); this.projView = new THREE.Matrix4(); this.box = new THREE.Box3(); }
    this.projView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < w.chunkCount; k++) {
        if (done > 0 && performance.now() - start > maxMs) break;
        const c = (this.meshCursor + k) % w.chunkCount;
        if (!w.dirty[c]) continue;
        if (pass === 0 && !this.chunkInView(c)) continue;
        this.rebuildChunk(c);
        done++;
      }
    }
    this.meshCursor = (this.meshCursor + 7) % w.chunkCount;
    if (done) this.updateGlowLight();
    return done;
  }

  chunkInView(c) {
    const w = this.world;
    const cx = c % w.CX, cz = Math.floor(c / w.CX) % w.CZ, cy = Math.floor(c / (w.CX * w.CZ));
    this.box.min.set(cx * 16 - w.W / 2, cy * 16, cz * 16 - w.D / 2);
    this.box.max.set(this.box.min.x + 16, this.box.min.y + 16, this.box.min.z + 16);
    return this.frustum.intersectsBox(this.box);
  }

  rebuildChunk(c) {
    const w = this.world;
    const { CX, CZ } = w;
    w.dirty[c] = 0;
    const cx = c % CX, cz = Math.floor(c / CX) % CZ, cy = Math.floor(c / (CX * CZ));
    const stats = this.chunkGlow[c];
    stats.n = stats.x = stats.y = stats.z = 0;
    meshBox(this.src, cx * 16, cy * 16, cz * 16, Math.min(w.W, cx * 16 + 16), Math.min(w.H, cy * 16 + 16), Math.min(w.D, cz * 16 + 16), this.bufs, stats);
    for (let g = 0; g < 4; g++) {
      const geo = this.bufs[g].geometry();
      let mesh = this.chunks[c][g];
      if (!geo) { if (mesh) { mesh.visible = false; } continue; }
      if (!mesh) {
        mesh = new THREE.Mesh(geo, this.materials[g]);
        mesh.castShadow = g === 0;
        mesh.receiveShadow = g === 0 || g === 1;
        mesh.matrixAutoUpdate = false;
        this.chunks[c][g] = mesh;
        this.scene.add(mesh);
      } else {
        mesh.geometry.dispose();
        mesh.geometry = geo;
        mesh.visible = true;
      }
    }
  }

  updateGlowLight() {
    let n = 0, x = 0, y = 0, z = 0;
    for (const s of this.chunkGlow) { n += s.n; x += s.x; y += s.y; z += s.z; }
    if (n === 0) { this.glowTarget = 0; return; }
    const w = this.world;
    this.glowPos = new THREE.Vector3(x / n - w.W / 2 + 0.5, y / n + 3, z / n - w.D / 2 + 0.5);
    if (!this.glowTarget) this.glowLight.position.copy(this.glowPos);
    this.glowTarget = Math.min(900, 40 * Math.sqrt(n));
  }

  orbit(angle) {
    const c = this.controls, off = this.camera.position.clone().sub(c.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    this.camera.position.copy(c.target).add(off);
    c.update();
  }

  // ----- fly mode: a free first-person camera for building -----
  setFly(on) {
    if (on === !!this.fly) return;
    this.fly = on;
    this.controls.enabled = !on;
    const cam = this.camera;
    if (on) {
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
      this.flyVel = new THREE.Vector3();
      this.flyHeld = 0;
      this.controls.autoRotate = false;
    } else {
      // Hand back to the orbit camera, circling a point just ahead of us.
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const hit = this.pickCenter();
      const dist = hit && hit.hit ? Math.max(20, cam.position.distanceTo(this.cellCenter(hit.hit))) : 60;
      this.controls.target.copy(cam.position).addScaledVector(dir, dist);
      this.userMoved = true;
      this.controls.update();
    }
  }

  // Turn the head by a mouse movement in pixels.
  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - dy * 0.0022));
  }

  // move: { f, r, u } in -1..1 (forward, right, up), from the keys held.
  flyStep(dt, move) {
    const cam = this.camera;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const want = new THREE.Vector3(
      -sy * move.f + cy * move.r,
      move.u,
      -cy * move.f - sy * move.r);
    const moving = want.lengthSq() > 0;
    // The longer you hold a direction, the faster you go.
    this.flyHeld = moving ? Math.min(this.flyHeld + dt, 2) : 0;
    const speed = 18 + 55 * Math.min(1, this.flyHeld / 1.5);
    if (moving) want.normalize().multiplyScalar(speed);
    this.flyVel.lerp(want, 1 - Math.exp(-dt * 10));
    cam.position.addScaledVector(this.flyVel, dt);
    const lim = this.world.W * 2.5;
    cam.position.clampScalar(-lim, lim);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  pickCenter() {
    const r = this.canvas.getBoundingClientRect();
    return this.pick(r.left + r.width / 2, r.top + r.height / 2);
  }

  cellCenter(c) {
    return new THREE.Vector3(c[0] - this.world.W / 2 + 0.5, c[1] + 0.5, c[2] - this.world.D / 2 + 0.5);
  }

  // Move the camera toward (factor > 1) or away from the point it circles.
  zoom(factor) {
    if (this.fly) return;
    const c = this.controls, off = this.camera.position.clone().sub(c.target);
    const len = Math.max(c.minDistance, Math.min(c.maxDistance, off.length() / factor));
    this.camera.position.copy(c.target).add(off.setLength(len));
    this.userMoved = true;
    c.update();
  }

  resetView() {
    this.userMoved = false;
    this.camera.position.copy(this.home.pos);
    this.controls.target.copy(this.home.target);
    this.controls.update();
  }

  // Briefly outline the slice at depth z that the 2D view is showing.
  showSlice(z) {
    this.sliceMarker.position.z = z - this.world.D / 2 + 0.5;
    this.sliceFade = 2.5;
  }

  // Find the voxel under the mouse with a grid walk along the camera ray.
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const { W, H, D, type } = this.world;
    const o = this.raycaster.ray.origin, d = this.raycaster.ray.direction;
    const O = [o.x + W / 2, o.y, o.z + D / 2], Dv = [d.x, d.y, d.z], S = [W, H, D];
    let tmin = 0, tmax = Infinity;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(Dv[a]) < 1e-9) { if (O[a] < 0 || O[a] > S[a]) return null; continue; }
      let t1 = (0 - O[a]) / Dv[a], t2 = (S[a] - O[a]) / Dv[a];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    }
    if (tmax < tmin) return null;
    const t0 = tmin + 1e-4;
    const p = [O[0] + Dv[0] * t0, O[1] + Dv[1] * t0, O[2] + Dv[2] * t0];
    const c = p.map((v, a) => Math.min(S[a] - 1, Math.max(0, Math.floor(v))));
    const step = Dv.map(v => (v > 0 ? 1 : -1));
    const tDelta = Dv.map(v => (v === 0 ? Infinity : Math.abs(1 / v)));
    const tMax = Dv.map((v, a) => (v === 0 ? Infinity : t0 + (v > 0 ? c[a] + 1 - p[a] : p[a] - c[a]) / Math.abs(v)));
    let prev = null;
    for (let n = 0; n < 1200; n++) {
      const t = type[c[0] + W * (c[2] + D * c[1])];
      if (t !== EMPTY && STATE[t] !== GAS) return { hit: [...c], place: prev };
      prev = [...c];
      const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : (tMax[1] < tMax[2] ? 1 : 2);
      c[a] += step[a];
      tMax[a] += tDelta[a];
      if (c[a] < 0 || c[a] >= S[a]) {
        if (a === 1 && c[1] < 0) return { hit: null, place: prev };
        return null;
      }
    }
    return null;
  }

  showCursor(cell, r) {
    if (!cell) { this.cursor.visible = false; return; }
    const { W, D } = this.world;
    const s = r * 2 + 1;
    this.cursor.visible = true;
    this.cursor.scale.set(s, s, s);
    this.cursor.position.set(cell[0] - W / 2 + 0.5, cell[1] + 0.5, cell[2] - D / 2 + 0.5);
  }

  setAccent(hex) {
    for (const m of this.cursor.children) m.material.color.set(hex);
  }

  render(dt, simulating) {
    this.time += dt;
    this.updateChunks(simulating ? 5 : 10);
    if (!this.fly) this.controls.update();
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    // Islets bob and turn slowly; clouds drift past underneath.
    for (const f of this.floaters) {
      f.obj.position.y = f.baseY + Math.sin(this.time * 0.35 + f.phase) * f.bob;
      f.obj.rotation.y += f.spin * dt;
    }
    const span = this.world.W * 1.2;
    for (const c of this.clouds) {
      c.obj.position.x += c.speed * dt;
      if (c.obj.position.x > span) c.obj.position.x -= span * 2;
    }
    const sm = this.sliceMarker;
    this.sliceFade = Math.max(0, this.sliceFade - dt);
    sm.visible = this.sliceFade > 0;
    sm.material.opacity = Math.min(1, this.sliceFade) * 0.45;
    const g = this.glowLight;
    // The glow from lava and fire eases toward its new strength and place, so
    // the scene lighting never flickers from frame to frame.
    const ease = 1 - Math.exp(-dt * 4);
    g.intensity += ((this.glowTarget || 0) - g.intensity) * ease;
    if (this.glowPos) g.position.lerp(this.glowPos, ease);
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.array[i * 3 + 1] + dt * (0.6 + (i % 7) * 0.08);
      if (y > this.dustTop) y = this.dustBottom;
      pos.array[i * 3 + 1] = y;
      pos.array[i * 3] += Math.sin(this.time * 0.5 + i) * dt * 0.3;
    }
    pos.needsUpdate = true;
    this.composer.render(dt);
  }
}
