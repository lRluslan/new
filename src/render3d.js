// 3D renderer: turns the voxel world into textured block meshes (only the
// faces you can see, with soft corner shadows), and surrounds it with a misty
// teal forest, light shafts and floating dust. Rendered at a low resolution
// and scaled up so it keeps a pixel-art look.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as El from './elements.js';
import { buildAtlas, tileFor, COLS, ROWS, TILE, PAD, CELL } from './textures.js';
import { rng, groundHeight } from './scenes.js';

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
// src: { W, H, D, type, ox, oy, oz } (offsets place it in the world).
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
      if (ny < 0) continue;
      const nt = (nx < 0 || nz < 0 || nx >= W || nz >= D || ny >= H) ? EMPTY : type[nx + W * (nz + D * ny)];
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

function makeDecor(world) {
  // A ring of tall pixel trees around the play area, fading into the fog.
  // Ground and trees go in separate grids so trees can be hidden when they
  // block the camera.
  const PW = world.W, PD = world.D;          // play area size
  const DW = PW + 150, DH = Math.round(world.H * 0.3) + 86, DD = PD + 180;
  const ground = new Uint8Array(DW * DH * DD);
  const trees = new Uint8Array(DW * DH * DD);
  const rand = rng(2024);
  const idx = (x, y, z) => x + DW * (z + DD * y);
  const put = (x, y, z, t) => {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (x < 0 || y < 0 || z < 0 || x >= DW || y >= DH || z >= DD) return;
    if (Math.abs(x - DW / 2 + 0.5) < PW / 2 && Math.abs(z - DD / 2 + 0.5) < PD / 2 && y < world.H) return; // play area
    (t === STONE || t === DIRT ? ground : trees)[idx(x, y, z)] = t;
  };
  const blob = (cx, cy, cz, r, ry, t) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = ((x - cx) / r) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / r) ** 2;
        if (d <= 1 && !(d > 0.75 && rand() < 0.45)) put(x, y, z, t);
      }
  };
  // Ground continues the play area's rolling soil, then smooths out into
  // gentle hills that rise toward the edge.
  // Distance outside the play area's rectangle (0 inside it).
  const outside = (x, z) => Math.hypot(Math.max(0, Math.abs(x - DW / 2) - PW / 2), Math.max(0, Math.abs(z - DD / 2) - PD / 2));
  const base = world.H * 0.3;
  const height = (x, z) => {
    const sx = x - DW / 2 + PW / 2, sz = z - DD / 2 + PD / 2;
    const out = outside(x, z);
    const near = groundHeight(sx, sz, world.H);
    const far = base + 2.2 * Math.sin(x * 0.045 + 1) * Math.cos(z * 0.05) + Math.max(0, out - 25) * 0.14;
    const f = Math.min(1, out / 12);
    return Math.round(near + (far - near) * f);
  };
  for (let z = 0; z < DD; z++) for (let x = 0; x < DW; x++) {
    const h = height(x, z);
    for (let y = 0; y < h; y++) put(x, y, z, y < h - 4 ? STONE : DIRT);
  }
  const placed = [];
  for (let k = 0; k < 600 && placed.length < 90; k++) {
    const x = 6 + rand() * (DW - 12), z = 6 + rand() * (DD - 12);
    const out = outside(x, z);
    if (out < 14 || out > 70) continue;
    if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 11)) continue;
    const rad = out + 60;
    placed.push([x, z]);
    const g = height(Math.round(x), Math.round(z));
    const h = Math.min(DH - 14, 36 + rand() * 28 + (rad > 90 ? 12 : 0));
    const w = rad > 85 ? 3 + ((rand() * 2) | 0) : 2 + ((rand() * 2) | 0);
    for (let y = g - 1; y < g + h; y++) {
      const flare = y < g + 3 ? 1 : 0;
      for (let dz = -flare; dz < w + flare; dz++) for (let dx = -flare; dx < w + flare; dx++) {
        if (flare && (dx < 0 || dx >= w) && (dz < 0 || dz >= w)) continue;
        put(x + dx, y, z + dz, WOOD);
      }
    }
    const nb = 2 + ((rand() * 3) | 0);
    for (let b = 0; b < nb; b++) {
      const a = rand() * Math.PI * 2, len = 6 + rand() * 9;
      let bx = x + w / 2, by = g + h * (0.45 + rand() * 0.4), bz = z + w / 2;
      for (let s = 0; s < len; s++) { bx += Math.cos(a); bz += Math.sin(a); by += 0.55; put(bx, by, bz, WOOD); }
      blob(bx, by + 1, bz, 3.5 + rand() * 2.5, 2.6 + rand() * 1.5, PLANT);
      for (let v = 0; v < 3; v++) {
        const vx = bx + (rand() - 0.5) * 6, vz = bz + (rand() - 0.5) * 6, vl = 3 + rand() * 9;
        for (let s = 0; s < vl; s++) put(vx, by - 1 - s, vz, PLANT);
      }
    }
    const top = g + h;
    blob(x + w / 2, top + 1, z + w / 2, 6 + rand() * 4, 4 + rand() * 2, PLANT);
    blob(x + w / 2 + (rand() - 0.5) * 8, top - 3, z + w / 2 + (rand() - 0.5) * 8, 4 + rand() * 3, 3 + rand(), PLANT);
  }
  for (let k = 0; k < 300; k++) {
    const x = rand() * DW, z = rand() * DD;
    const out = outside(x, z);
    if (out < 3 || out > 60) continue;
    blob(x, height(Math.round(x), Math.round(z)) + 1, z, 2 + rand() * 2.5, 1.6 + rand() * 1.2, rand() < 0.15 ? STONE : PLANT);
  }
  const src = { W: DW, H: DH, D: DD, ox: -DW / 2, oy: 0, oz: -DD / 2 };
  return { ground: { ...src, type: ground }, trees: { ...src, type: trees } };
}

// Soft additive beam that fades out when seen edge-on.
function shaftMaterial(tex) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { map: { value: tex }, color: { value: new THREE.Color('#b9f7df') }, opacity: { value: 0.1 } },
    vertexShader: `varying vec2 vUv; varying float vFacing;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal); vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv; varying float vFacing;
      void main(){ float a = texture2D(map, vUv).a * opacity * smoothstep(0.15, 0.6, vFacing);
        gl_FragColor = vec4(color * a, a); }`,
  });
}

function shaftTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(64, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 64; x++) {
    const h = Math.exp(-(((x - 31.5) / 18) ** 2));
    const v = Math.pow(1 - y / 255, 0.6) * Math.min(1, y / 30);
    const o = (y * 64 + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = Math.round(255 * h * v);
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
    const fogColor = new THREE.Color('#1c5752');
    scene.fog = new THREE.Fog(fogColor, world.W * 0.6, world.W * 1.6);

    const camera = this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1200);
    this.home = { pos: new THREE.Vector3(world.W * 0.35, world.H * 0.75, world.W * 0.55), target: new THREE.Vector3(0, world.H * 0.3, 0) };
    camera.position.copy(this.home.pos);
    const controls = this.controls = new OrbitControls(camera, this.canvas);
    controls.target.copy(this.home.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 22;
    controls.maxDistance = world.W * 1.4;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.autoRotateSpeed = 0.5;
    controls.update();

    // Sky: a teal gradient with a soft glow where the light comes from.
    this.sunDir = new THREE.Vector3(0.55, 0.85, 0.3).normalize();
    const sky = this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(800, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          top: { value: new THREE.Color('#3f9886') }, mid: { value: fogColor }, bottom: { value: new THREE.Color('#0a2a29') },
          sunDir: { value: this.sunDir },
        },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; varying vec3 vDir;
          void main(){ float h = vDir.y;
            vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.7, h)) : mix(mid, bottom, smoothstep(0.0, -0.25, h));
            float s = max(dot(normalize(vDir), sunDir), 0.0);
            c += vec3(0.5, 0.95, 0.78) * (pow(s, 6.0) * 0.35 + pow(s, 40.0) * 0.4);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }));
    sky.renderOrder = -1;
    scene.add(sky);

    scene.add(new THREE.HemisphereLight('#9fe6d2', '#103230', 1.1));
    const sun = this.sun = new THREE.DirectionalLight('#eafff2', 2.0);
    sun.position.copy(this.sunDir).multiplyScalar(110);
    sun.castShadow = true;
    const shadowSize = renderer.capabilities.maxTextureSize >= 8192 ? 4096 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    const reach = world.W / 2 + 40;
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

    this.buildDecor();
    this.buildAtmosphere();

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

  buildDecor() {
    const { ground, trees } = makeDecor(this.world);
    const bufs = [new GeoBuf(), new GeoBuf(), new GeoBuf(), new GeoBuf()];
    this.treeChunks = [];
    for (const [src, S] of [[ground, 48], [trees, 16]]) {
      for (let y = 0; y < src.H; y += S) for (let z = 0; z < src.D; z += S) for (let x = 0; x < src.W; x += S) {
        meshBox(src, x, y, z, Math.min(src.W, x + S), Math.min(src.H, y + S), Math.min(src.D, z + S), bufs, null);
        const geo = bufs[0].geometry();
        if (!geo) continue;
        const m = new THREE.Mesh(geo, this.materials[0]);
        const cx = x + S / 2 - src.W / 2, cz = z + S / 2 - src.D / 2;
        const near = Math.hypot(cx, cz) < 110;
        m.castShadow = near; m.receiveShadow = near;
        m.matrixAutoUpdate = false;
        this.scene.add(m);
        if (src === trees) this.treeChunks.push({ mesh: m, x: cx, z: cz });
      }
    }
  }

  // Hide background trees that stand between the camera and the play area.
  hideBlockingTrees() {
    const cam = this.camera.position, tgt = this.controls.target;
    const dx = tgt.x - cam.x, dz = tgt.z - cam.z;
    const len2 = dx * dx + dz * dz || 1;
    for (const c of this.treeChunks) {
      const t = ((c.x - cam.x) * dx + (c.z - cam.z) * dz) / len2;
      let hide = false;
      if (t > -0.35 && t < 0.8) {
        const px = cam.x + dx * t - c.x, pz = cam.z + dz * t - c.z;
        const reach = 26 + 34 * Math.max(0, 0.8 - t); // wider near the camera
        hide = px * px + pz * pz < reach * reach;
      }
      c.mesh.visible = !hide;
    }
  }

  buildAtmosphere() {
    // Light shafts: crossed additive planes lined up with the sunlight.
    const tex = shaftTexture();
    const mat = shaftMaterial(tex);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.sunDir);
    this.shafts = [];
    const rand = rng(31);
    for (let k = 0; k < 7; k++) {
      const g = new THREE.Group();
      const w = 6 + rand() * 12;
      for (let j = 0; j < 2; j++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 190), mat.clone());
        p.position.y = 95;
        p.rotation.y = j * Math.PI / 2;
        g.add(p);
      }
      g.quaternion.copy(q);
      g.position.set((rand() - 0.5) * (this.world.W + 60), 0, (rand() - 0.5) * (this.world.D + 90));
      g.userData.phase = rand() * 6.28;
      this.shafts.push(g);
      this.scene.add(g);
    }
    // Dust motes drifting through the light.
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rand() - 0.5) * (this.world.W + 50); pos[i * 3 + 1] = rand() * 70; pos[i * 3 + 2] = (rand() - 0.5) * (this.world.D + 70);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#d9fff0', size: 0.32, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
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

  resetView() {
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
    this.controls.update();
    this.hideBlockingTrees();
    this.sky.position.copy(this.camera.position);
    const sm = this.sliceMarker;
    this.sliceFade = Math.max(0, this.sliceFade - dt);
    sm.visible = this.sliceFade > 0;
    sm.material.opacity = Math.min(1, this.sliceFade) * 0.7;
    const g = this.glowLight;
    // The glow from lava and fire eases toward its new strength and place, so
    // the scene lighting never flickers from frame to frame.
    const ease = 1 - Math.exp(-dt * 4);
    g.intensity += ((this.glowTarget || 0) - g.intensity) * ease;
    if (this.glowPos) g.position.lerp(this.glowPos, ease);
    for (const s of this.shafts) {
      const o = 0.08 + 0.04 * Math.sin(this.time * 0.4 + s.userData.phase);
      for (const p of s.children) p.material.uniforms.opacity.value = o;
    }
    const pos = this.dust.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.array[i * 3 + 1] + dt * (0.6 + (i % 7) * 0.08);
      if (y > 70) y = 0;
      pos.array[i * 3 + 1] = y;
      pos.array[i * 3] += Math.sin(this.time * 0.5 + i) * dt * 0.3;
    }
    pos.needsUpdate = true;
    this.composer.render(dt);
  }
}
