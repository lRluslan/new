// Element table shared by the 2D and 3D worlds.
// Densities are in kg/m³ and temperatures in °C. They are based on the real
// materials and tuned a little so reactions happen at a fun pace.

export const EMPTY = 0, STONE = 1, DIRT = 2, SAND = 3, SNOW = 4, ASH = 5,
  GUNPOWDER = 6, SEED = 7, WATER = 8, OIL = 9, ACID = 10, LAVA = 11,
  SMOKE = 12, FIRE = 13, WOOD = 14, PLANT = 15, ICE = 16,
  GLASS = 17, OBSIDIAN = 18, METAL = 19, SALT = 20, BRINE = 21, MUD = 22, BRICK = 23, COAL = 24;

export const SOLID = 1, POWDER = 2, LIQUID = 3, GAS = 4;

export const AMBIENT = 20;     // room temperature
export const FIRE_TEMP = 1000; // a wood fire burns at roughly 600–1100 °C

// Discoveries: reactions the player can find.
export const DISC = {
  MELT: 0, FREEZE: 1, BOIL: 2, OBSIDIAN: 4, CRUST: 5, ROCK_MELT: 6,
  GLASS: 7, BURN_WOOD: 8, OIL_FIRE: 9, WILDFIRE: 10, GROW: 11, SPROUT: 12,
  ACID: 13, EXPLODE: 14, THAW: 15, EXTINGUISH: 16, FLOAT: 17, SINK: 18, GLOW: 19,
  DISSOLVE: 20, DEICE: 21, SALT_CRYSTALS: 22, MUD: 23, BRICK: 24, CHARCOAL: 25, BRINE_SINKS: 26,
};

export const DISCOVERIES = [
  { id: DISC.MELT, title: 'Melting', recipe: 'Ice + heat', hint: 'What happens to ice when it warms up?',
    text: 'Ice melts at 0 °C. It soaks up a lot of heat before it turns to water, so it melts slowly.' },
  { id: DISC.FREEZE, title: 'Freezing', recipe: 'Water + cold', hint: 'Try making water very cold.',
    text: 'Water freezes below 0 °C. Ice pulls heat out of the water next to it, so freezing spreads.' },
  { id: DISC.BOIL, title: 'Boiling', recipe: 'Water + heat', hint: 'Heat some water.',
    text: 'Water boils at 100 °C and evaporates. Turning into vapour soaks up a lot of heat.' },
  { id: DISC.OBSIDIAN, title: 'Obsidian', recipe: 'Lava + water', hint: 'Pour water on something very hot.',
    text: 'Water cools lava so fast that crystals cannot form. It hardens into dark volcanic glass.' },
  { id: DISC.CRUST, title: 'Lava rock', recipe: 'Lava cools down', hint: 'Leave some lava alone for a while.',
    text: 'Lava hardens below 700 °C, starting where it rests on cold ground and building up layer by layer.' },
  { id: DISC.ROCK_MELT, title: 'Molten rock', recipe: 'Stone + 1200 °C', hint: 'Stone is not as solid as it looks.',
    text: 'Rock melts above about 1200 °C, hotter than lava itself, and flows again as lava.' },
  { id: DISC.GLASS, title: 'Glassmaking', recipe: 'Sand + 950 °C', hint: 'Sand next to something glowing hot.',
    text: 'Sand grains fuse together into glass when they get hot enough.' },
  { id: DISC.BURN_WOOD, title: 'Combustion', recipe: 'Wood + 350 °C', hint: 'Wood and a spark.',
    text: 'Wood ignites near 350 °C and burns down to ash. Fire needs air: a sealed fire goes out.' },
  { id: DISC.OIL_FIRE, title: 'Oil fire', recipe: 'Oil + 220 °C', hint: 'Oil burns. Can water stop it?',
    text: 'Oil ignites at about 220 °C. Water sinks under burning oil, so it cannot put the fire out.' },
  { id: DISC.WILDFIRE, title: 'Wildfire', recipe: 'Plants + fire', hint: 'Plants are full of fuel.',
    text: 'Leaves are full of water, but once they pass about 260 °C they burn fast.' },
  { id: DISC.GROW, title: 'Growth', recipe: 'Plant + water', hint: 'Give a plant something to drink.',
    text: 'Fresh plants drink the water next to them and grow into it.' },
  { id: DISC.SPROUT, title: 'Sprouting', recipe: 'Seed + soil', hint: 'Seeds need soil, and water helps.',
    text: 'A seed resting on soil sprouts into a tree. Water makes it sprout much faster.' },
  { id: DISC.ACID, title: 'Corrosion', recipe: 'Acid + matter', hint: 'Acid eats almost anything.',
    text: 'Acid dissolves most materials and is used up as it works. Glass and obsidian resist it.' },
  { id: DISC.EXPLODE, title: 'Explosion', recipe: 'Gunpowder + heat', hint: 'Gunpowder hates heat.',
    text: 'Gunpowder burns so fast that the hot gas throws everything nearby outward.' },
  { id: DISC.THAW, title: 'Thaw', recipe: 'Snow + warmth', hint: 'Snow does not last forever.',
    text: 'Snow is loose ice crystals. Above 0 °C it melts into water.' },
  { id: DISC.EXTINGUISH, title: 'Extinguishing', recipe: 'Fire + water', hint: 'Fight fire with water.',
    text: 'Water absorbs heat and smothers flames.' },
  { id: DISC.FLOAT, title: 'Buoyancy', recipe: 'Oil + water', hint: 'Mix two liquids.',
    text: 'Oil (850 kg/m³) is lighter than water (1000 kg/m³), so it rises and floats on top.' },
  { id: DISC.SINK, title: 'Sinking', recipe: 'Sand + water', hint: 'Drop a powder into a liquid.',
    text: 'Sand (1600 kg/m³) is denser than water, so it sinks and settles on the bottom.' },
  { id: DISC.GLOW, title: 'Incandescence', recipe: 'Anything + 525 °C', hint: 'Get something really hot.',
    text: 'Above about 525 °C (the Draper point) hot matter starts to glow red, then orange and yellow.' },
  { id: DISC.DISSOLVE, title: 'Dissolving', recipe: 'Salt + water', hint: 'Some powders vanish in water.',
    text: 'Salt dissolves in water and makes salt water, which is a little heavier than fresh water.' },
  { id: DISC.DEICE, title: 'De-icing', recipe: 'Salt + ice', hint: 'Why do people salt icy roads?',
    text: 'Salt lowers the freezing point of water, so ice and snow it touches melt even below 0 °C.' },
  { id: DISC.SALT_CRYSTALS, title: 'Salt crystals', recipe: 'Salt water + 100 °C', hint: 'Boil the sea.',
    text: 'When salt water boils away, the water leaves but the salt stays behind as crystals.' },
  { id: DISC.MUD, title: 'Mud', recipe: 'Water poured on soil', hint: 'Pour water onto bare soil.',
    text: 'Soil soaks up water and turns into heavy, sticky mud. Seeds love it.' },
  { id: DISC.BRICK, title: 'Brickmaking', recipe: 'Mud + 600 °C', hint: 'Bake some mud.',
    text: 'Fired mud hardens into brick, one of the oldest building materials there is.' },
  { id: DISC.CHARCOAL, title: 'Charcoal', recipe: 'Wood + heat, no air', hint: 'Heat wood that cannot breathe.',
    text: 'Wood heated without air cannot burn, so it chars into coal instead. Coal burns long and hot.' },
  { id: DISC.BRINE_SINKS, title: 'Salt layer', recipe: 'Salt water + water', hint: 'Pour salt water into fresh water.',
    text: 'Salt water (1030 kg/m³) is denser than fresh water, so it sinks and forms a layer at the bottom.' },
];

// Look up a discovery by its id (ids stay stable even if one is retired).
export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map(d => [d.id, d]));

// state: how it moves. k: heat conductivity (0..0.3). c: heat capacity.
// hot/cold: phase change thresholds. latent: heat (in degrees) a cell must
// soak up or give away at the threshold before it changes phase, so ice
// stays at 0 °C while melting and water stays at 100 °C while boiling.
// ignite/burn: [burn time, flame temperature, chance of leaving ash].
// c2: 2D palette (warm autumn). c3: 3D palette (teal forest).
// group3: 0 opaque, 1 see-through, 2 glowing, 3 drifting gas. a3: 3D opacity.
const DEFS = [];
function def(id, d) { DEFS[id] = d; }

def(EMPTY, { name: 'Air', state: 0, density: 1.2, k: 0.008, c: 0.25 });

def(STONE, { name: 'Stone', cat: 'solid', state: SOLID, density: 2600, k: 0.12, c: 0.8,
  hot: [1200, LAVA, DISC.ROCK_MELT], hard: 0.25,
  desc: 'Heavy rock. Melts into lava above 1200 °C.',
  c2: ['#8e8a76', '#7d7a69', '#9c9884', '#6f6c5e'], c3: ['#566c70', '#4a5f63', '#62797c', '#3f5255'] });

def(DIRT, { name: 'Soil', cat: 'powder', state: POWDER, density: 1500, k: 0.06, c: 0.8, slide: 0.18, hard: 0.6,
  desc: 'Earth that grass grows on. Seeds sprout in it.',
  c2: ['#7a4b2a', '#6b4025', '#855430', '#5e3820'], c3: ['#4f3c2c', '#5a4532', '#443326', '#634c37'] });

def(SAND, { name: 'Sand', cat: 'powder', state: POWDER, density: 1600, k: 0.07, c: 0.8, slide: 0.95, hard: 0.6,
  hot: [950, GLASS, DISC.GLASS],
  desc: 'Fine grains that pile up and sink in water. Fuses into glass when very hot.',
  c2: ['#f0d9a0', '#e5c98a', '#f6e4b4', '#d9bb79'], c3: ['#c4a56a', '#b5965d', '#d1b47a', '#a88a53'] });

def(SNOW, { name: 'Snow', cat: 'powder', state: POWDER, density: 300, k: 0.05, c: 1.6, slide: 0.45, temp: -8, hard: 1,
  hot: [0.5, WATER, DISC.THAW], latent: [60, 0],
  desc: 'Light ice crystals. Melts above 0 °C.',
  c2: ['#f7f4ec', '#ebe7dc', '#ffffff', '#dfdbcf'], c3: ['#e4f4f0', '#d3eae6', '#f2fbf9', '#c4dfda'] });

def(ASH, { name: 'Ash', cat: 'powder', state: POWDER, density: 700, k: 0.04, c: 0.5, slide: 0.7, hard: 1,
  desc: 'What is left after a fire. Light enough to float.',
  c2: ['#9a958d', '#8a857e', '#aaa59c', '#7c7871'], c3: ['#6f7a78', '#626c6a', '#7d8886', '#566060'] });

def(GUNPOWDER, { name: 'Gunpowder', cat: 'powder', state: POWDER, density: 1700, k: 0.06, c: 0.6, slide: 0.85,
  ignite: 180, hard: 1,
  desc: 'Explodes when it gets hotter than 180 °C.',
  c2: ['#45423e', '#524e49', '#3a3835', '#5f5a53'], c3: ['#3a4040', '#454c4b', '#303535', '#525a59'] });

def(SEED, { name: 'Seed', cat: 'life', state: POWDER, density: 1100, k: 0.05, c: 0.8, slide: 0.55,
  ignite: 200, burn: [20, 600, 0.6], hard: 1,
  desc: 'Drop on soil to grow a tree. Water speeds it up.',
  c2: ['#b07f3a', '#956a2f', '#c8954b', '#7f592a'], c3: ['#8f6c3c', '#7c5c33', '#a67f48', '#6a4e2b'] });

def(WATER, { name: 'Water', cat: 'liquid', state: LIQUID, density: 1000, k: 0.14, c: 1.6, flow: 5, visc: 1, hard: 0,
  hot: [100, EMPTY, DISC.BOIL], cold: [0, ICE, DISC.FREEZE], latent: [300, 60],
  desc: 'Flows and levels out. Boils at 100 °C, freezes at 0 °C.',
  c2: ['#62a89a', '#5a9f92', '#6db1a3', '#559789'], c3: ['#2fa397', '#2b998e', '#38ad9f', '#278c82'], group3: 1, a3: 0.7 });

def(OIL, { name: 'Oil', cat: 'liquid', state: LIQUID, density: 850, k: 0.035, c: 0.6, flow: 3, visc: 0.8,
  ignite: 220, burn: [45, 850, 0], hard: 0.8,
  desc: 'Floats on water and burns hot. Ignites near 220 °C.',
  c2: ['#3d2b1e', '#4a3423', '#33241a', '#57402b'], c3: ['#2e2219', '#3a2b1f', '#251b14', '#463425'] });

def(ACID, { name: 'Acid', cat: 'liquid', state: LIQUID, density: 1200, k: 0.12, c: 1.2, flow: 4, visc: 1, hard: 0,
  desc: 'Dissolves almost everything it touches, except glass.',
  c2: ['#a4e23c', '#92d32f', '#b8ef5c', '#80c228'], c3: ['#9be33a', '#88d12e', '#adf05a', '#74bd26'], group3: 1, a3: 0.8 });

// Real lava is a poor conductor of heat and hardens slowly: it has to give up
// a lot of latent heat, and it sets from the cool ground upward.
def(LAVA, { name: 'Lava', cat: 'liquid', state: LIQUID, density: 2700, k: 0.02, c: 1.0, flow: 2, visc: 0.22, temp: 1150,
  cold: [700, STONE, DISC.CRUST], latent: [0, 1100], hard: 0, glow: true,
  desc: 'Molten rock at about 1150 °C. Hardens slowly, from the bottom up, into stone.',
  c2: ['#ff7a1a', '#ff9a2e', '#e8561b', '#ffc04a'], c3: ['#ff7a1a', '#ff9a2e', '#e8561b', '#ffc04a'], group3: 2 });

def(SMOKE, { name: 'Smoke', cat: 'gas', state: GAS, density: 1.0, k: 0.03, c: 0.3, life: [90, 220], rise: 0.5, hard: 0,
  desc: 'Soot carried up by hot air. Fades away over time.',
  c2: ['#4b4740', '#56514a', '#423e38', '#5f5a52'], c3: ['#8a9794', '#7d8a87', '#96a3a0', '#71807c'], group3: 3, a3: 0.42 });

def(FIRE, { name: 'Fire', cat: 'gas', state: GAS, density: 0.4, k: 0.2, c: 0.05, temp: FIRE_TEMP, life: [18, 42],
  rise: 0.7, hard: 0, glow: true,
  desc: 'Burning gas at about 1000 °C. Spreads to anything that can burn.',
  c2: ['#ffd04a', '#ff8a1f', '#fff2b0', '#e04a17'], c3: ['#ffd04a', '#ff8a1f', '#fff2b0', '#e04a17'], group3: 2 });

def(WOOD, { name: 'Wood', cat: 'solid', state: SOLID, density: 700, k: 0.04, c: 0.9, ignite: 350, burn: [150, 750, 0.55],
  hard: 0.5,
  desc: 'Solid fuel. Catches fire near 350 °C and burns to ash. Heated without air, it turns to charcoal.',
  c2: ['#7a4a2c', '#6b3f25', '#8a5733', '#5e3820'], c3: ['#7a5230', '#8f6438', '#664428', '#a3733f'] });

def(PLANT, { name: 'Plant', cat: 'life', state: SOLID, density: 600, k: 0.06, c: 1.0, ignite: 260, burn: [22, 650, 0.25],
  hard: 1,
  desc: 'Leaves that drink water and grow. Very flammable.',
  c2: ['#3e5f2c', '#567a32', '#2f4a26', '#6d8a34'], c3: ['#1c5f48', '#247255', '#154c3a', '#348563'] });

def(ICE, { name: 'Ice', cat: 'solid', state: SOLID, density: 917, k: 0.16, c: 2.4, temp: -25, hard: 0.8,
  hot: [0.5, WATER, DISC.MELT], latent: [60, 0],
  desc: 'Frozen water at -25 °C. Chills and freezes water around it.',
  c2: ['#cdeef0', '#b6e3ea', '#e4f8f8', '#a3d6df'], c3: ['#a9e6ec', '#97dbe3', '#bdeff3', '#86cfd8'], group3: 1, a3: 0.82 });

def(GLASS, { name: 'Glass', cat: 'solid', state: SOLID, density: 2500, k: 0.08, c: 0.7, acidProof: true,
  desc: 'See-through and acid-proof. Made by melting sand.',
  c2: ['#dff2ee', '#cfe9e4', '#eef9f6', '#bfe0da'], c3: ['#d4f2ec', '#c4e9e2', '#e6f8f5', '#b3ddd5'], group3: 1, a3: 0.32 });

def(OBSIDIAN, { name: 'Obsidian', cat: 'powder', state: POWDER, density: 2400, k: 0.1, c: 0.8, slide: 0.08, acidProof: true,
  hot: [1200, LAVA, DISC.ROCK_MELT],
  desc: 'Chunks of volcanic glass made when water cools lava fast. Sinks, and resists acid.',
  c2: ['#2a2238', '#352b45', '#1f1a2b', '#43375a'], c3: ['#241d33', '#2e2540', '#1a1526', '#3a2f51'] });

def(METAL, { name: 'Metal', cat: 'solid', state: SOLID, density: 7800, k: 0.3, c: 0.5, hard: 0.08,
  desc: 'Conducts heat far better than anything else.',
  c2: ['#9aa4ab', '#aeb7bd', '#858f97', '#c4ccd1'], c3: ['#8fa3a8', '#a2b5b9', '#7a8e93', '#b7c8cb'] });

def(SALT, { name: 'Salt', cat: 'powder', state: POWDER, density: 2160, k: 0.08, c: 0.7, slide: 0.75, hard: 0.9,
  desc: 'Crystals that dissolve in water and melt ice.',
  c2: ['#f4f1ea', '#e7e2d6', '#fbfaf6', '#d9d3c5'], c3: ['#e3ebe9', '#d2dcda', '#f1f6f5', '#c2cecb'] });

def(BRINE, { name: 'Salt water', cat: 'liquid', state: LIQUID, density: 1030, k: 0.14, c: 1.6, flow: 5, visc: 1, hard: 0,
  hot: [100, SALT, DISC.SALT_CRYSTALS], cold: [-2, ICE, DISC.FREEZE], latent: [300, 60],
  desc: 'Sea water. Sinks under fresh water, freezes at -2 °C and leaves salt when it boils.',
  c2: ['#6aa69a', '#629d91', '#74afa2', '#5a9488'], c3: ['#3aa597', '#349b8e', '#43af9f', '#2e8f83'], group3: 1, a3: 0.74 });

def(MUD, { name: 'Mud', cat: 'powder', state: POWDER, density: 1800, k: 0.1, c: 1.4, slide: 0.06, hard: 0.7,
  hot: [600, BRICK, DISC.BRICK],
  desc: 'Wet soil. Heavy and sticky. Seeds sprout fast in it. Bakes into brick at 600 °C.',
  c2: ['#5a3f2b', '#4e3625', '#664832', '#45301f'], c3: ['#3f3024', '#4a382a', '#36291f', '#544030'] });

def(BRICK, { name: 'Brick', cat: 'solid', state: SOLID, density: 1900, k: 0.07, c: 0.84, hard: 0.3,
  desc: 'Fired mud. Strong, heat-proof building blocks.',
  c2: ['#a8552f', '#934a29', '#b8653b', '#7e3f23'], c3: ['#94503a', '#83462f', '#a35c43', '#723c27'] });

def(COAL, { name: 'Coal', cat: 'solid', state: SOLID, density: 1350, k: 0.05, c: 0.9, ignite: 420, burn: [700, 1100, 0.35],
  hard: 0.6,
  desc: 'Charcoal. Hard to light, but burns for a long time at about 1100 °C.',
  c2: ['#2b2a2c', '#353336', '#232224', '#413e42'], c3: ['#262628', '#303032', '#1e1e20', '#3b3a3d'] });

export const COUNT = DEFS.length;
export const ELEMENTS = DEFS;

// Typed lookup tables for the hot simulation loop.
export const STATE = new Uint8Array(COUNT);
export const DENS = new Float32Array(COUNT);
export const K = new Float32Array(COUNT);
export const CAP = new Float32Array(COUNT);
export const TEMP0 = new Float32Array(COUNT);
export const HOT_AT = new Float32Array(COUNT).fill(Infinity);
export const HOT_TO = new Uint8Array(COUNT);
export const HOT_DISC = new Int8Array(COUNT).fill(-1);
export const COLD_AT = new Float32Array(COUNT).fill(-Infinity);
export const COLD_TO = new Uint8Array(COUNT);
export const COLD_DISC = new Int8Array(COUNT).fill(-1);
export const LATENT_HOT = new Float32Array(COUNT);
export const LATENT_COLD = new Float32Array(COUNT);
export const IGNITE = new Float32Array(COUNT);
export const BURN_TIME = new Float32Array(COUNT);
export const BURN_HEAT = new Float32Array(COUNT);
export const ASH_CHANCE = new Float32Array(COUNT);
export const SLIDE = new Float32Array(COUNT);
export const FLOW = new Uint8Array(COUNT);
export const VISC = new Float32Array(COUNT);
export const RISE = new Float32Array(COUNT);
export const LIFE_MIN = new Int16Array(COUNT);
export const LIFE_SPAN = new Int16Array(COUNT);
export const HARD = new Float32Array(COUNT);   // how easily acid dissolves it (0 = never)
export const GLOWS = new Uint8Array(COUNT);
export const GROUP3 = new Uint8Array(COUNT);
export const ALPHA3 = new Float32Array(COUNT).fill(1);
export const OCCLUDES = new Uint8Array(COUNT); // blocks light / hides faces in 3D

for (let t = 0; t < COUNT; t++) {
  const d = DEFS[t];
  STATE[t] = d.state;
  DENS[t] = d.density;
  K[t] = d.k;
  CAP[t] = d.c;
  TEMP0[t] = d.temp ?? AMBIENT;
  if (d.hot) { HOT_AT[t] = d.hot[0]; HOT_TO[t] = d.hot[1]; HOT_DISC[t] = d.hot[2]; }
  if (d.cold) { COLD_AT[t] = d.cold[0]; COLD_TO[t] = d.cold[1]; COLD_DISC[t] = d.cold[2]; }
  if (d.latent) { LATENT_HOT[t] = d.latent[0]; LATENT_COLD[t] = d.latent[1]; }
  IGNITE[t] = d.ignite ?? 0;
  if (d.burn) { BURN_TIME[t] = d.burn[0]; BURN_HEAT[t] = d.burn[1]; ASH_CHANCE[t] = d.burn[2]; }
  SLIDE[t] = d.slide ?? 0;
  FLOW[t] = d.flow ?? 0;
  VISC[t] = d.visc ?? 1;
  RISE[t] = d.rise ?? 0;
  if (d.life) { LIFE_MIN[t] = d.life[0]; LIFE_SPAN[t] = d.life[1] - d.life[0]; }
  HARD[t] = d.acidProof ? 0 : (d.hard ?? 0.5);
  GLOWS[t] = d.glow ? 1 : 0;
  GROUP3[t] = d.group3 ?? 0;
  ALPHA3[t] = d.a3 ?? 1;
  OCCLUDES[t] = t !== EMPTY && GROUP3[t] === 0 && d.state !== GAS ? 1 : 0;
}

// Order of the buttons in the element palette.
export const PALETTE = [
  { cat: 'Powders', items: [SAND, DIRT, SNOW, GUNPOWDER, ASH, OBSIDIAN, SALT, MUD] },
  { cat: 'Liquids', items: [WATER, OIL, LAVA, ACID, BRINE] },
  { cat: 'Gases', items: [FIRE, SMOKE] },
  { cat: 'Solids', items: [STONE, WOOD, ICE, METAL, GLASS, BRICK, COAL] },
  { cat: 'Life', items: [PLANT, SEED] },
];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
