// Element table: every material in the world and its real-world numbers.
// Densities are in kg/m³ and temperatures in °C. They are based on the real
// materials and tuned a little so reactions happen at a fun pace.

export const EMPTY = 0, STONE = 1, DIRT = 2, SAND = 3, SNOW = 4, ASH = 5,
  GUNPOWDER = 6, SEED = 7, WATER = 8, OIL = 9, ACID = 10, LAVA = 11,
  SMOKE = 12, FIRE = 13, WOOD = 14, PLANT = 15, ICE = 16,
  GLASS = 17, OBSIDIAN = 18, METAL = 19, SALT = 20, BRINE = 21, MUD = 22, BRICK = 23, COAL = 24,
  THERMITE = 25, MOLTEN = 26, RUST = 27, MERCURY = 28, HONEY = 29, FUSE = 30, CLONER = 31, DRAIN = 32,
  BLOOD = 33, BODY = 34;

export const SOLID = 1, POWDER = 2, LIQUID = 3, GAS = 4;

export const AMBIENT = 20;     // room temperature
export const FIRE_TEMP = 1000; // a wood fire burns at roughly 600–1100 °C

// Discoveries: reactions the player can find.
export const DISC = {
  MELT: 0, FREEZE: 1, BOIL: 2, OBSIDIAN: 4, CRUST: 5, ROCK_MELT: 6,
  GLASS: 7, BURN_WOOD: 8, OIL_FIRE: 9, WILDFIRE: 10, GROW: 11, SPROUT: 12,
  ACID: 13, EXPLODE: 14, THAW: 15, EXTINGUISH: 16, FLOAT: 17, SINK: 18, GLOW: 19,
  DISSOLVE: 20, DEICE: 21, SALT_CRYSTALS: 22, MUD: 23, BRICK: 24, CHARCOAL: 25, BRINE_SINKS: 26,
  THERMITE: 27, MELT_METAL: 28, CASTING: 29, RUST: 30, MERCURY_FLOAT: 31, FUSE: 32, LIGHTNING: 33,
  DROWN: 34, ON_FIRE: 35, CRUSH: 36, INFECTION: 37, GASP: 38, SALT_FLOAT: 39,
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
  { id: DISC.THERMITE, title: 'Thermite', recipe: 'Thermite + 600 °C', hint: 'Light the grey powder with something very hot.',
    text: 'Aluminium burns with rust at about 2500 °C. It carries its own oxygen, so it burns underwater, and leaves molten iron behind.' },
  { id: DISC.MELT_METAL, title: 'Molten metal', recipe: 'Metal + 1500 °C', hint: 'Metal melts too, if you get it hot enough.',
    text: 'Iron melts at about 1500 °C into a glowing liquid that flows like water but is eight times heavier.' },
  { id: DISC.CASTING, title: 'Casting', recipe: 'Molten metal cools', hint: 'Let molten metal cool in a mould.',
    text: 'Liquid metal sets back into solid metal below 1450 °C, taking the shape of whatever holds it.' },
  { id: DISC.RUST, title: 'Rusting', recipe: 'Metal + water', hint: 'Leave metal in water for a while. Salt water is faster.',
    text: 'Iron slowly reacts with water and oxygen to make crumbly rust. Salt speeds it up, which is why the sea is hard on ships.' },
  { id: DISC.MERCURY_FLOAT, title: 'Heavy liquid', recipe: 'Something on mercury', hint: 'Drop sand or iron into mercury.',
    text: 'Mercury weighs 13,500 kg/m³, so sand, gravel and even molten iron float on top of it.' },
  { id: DISC.FUSE, title: 'Fuse', recipe: 'Fuse + fire', hint: 'Light one end of a fuse.',
    text: 'A fuse burns quickly along its length, carrying the flame to whatever is at the other end.' },
  { id: DISC.LIGHTNING, title: 'Lightning', recipe: 'Storm weather', hint: 'Change the weather to a storm.',
    text: 'A lightning bolt heats the air to about 30,000 °C. It sets trees on fire and fuses sand into glass.' },
  { id: DISC.DROWN, title: 'Drowning', recipe: 'Creature + deep water', hint: 'People need air. What if they cannot reach it?',
    text: 'A person is only a little denser than water. Swimming keeps the head up until they tire, then they sink.' },
  { id: DISC.ON_FIRE, title: 'On fire', recipe: 'Creature + fire', hint: 'Fire and living things do not mix.',
    text: 'Clothes and fur catch fire, and a burning creature runs and spreads the flames. Water puts it out.' },
  { id: DISC.CRUSH, title: 'Crushed', recipe: 'Creature + heavy load', hint: 'Bury someone, or drop something heavy on them.',
    text: 'A pile of sand or stone weighs a lot. Too much on top of a body crushes it.' },
  { id: DISC.INFECTION, title: 'Infection', recipe: 'Zombie + human', hint: 'Let a zombie catch a person.',
    text: 'A zombie bite spreads. A few seconds later the bitten person turns into a zombie too.' },
  { id: DISC.GASP, title: 'Fish out of water', recipe: 'Fish + air', hint: 'Fish breathe water. Take one out.',
    text: 'Gills only work in water. A fish on land flops about and soon suffocates.' },
  { id: DISC.SALT_FLOAT, title: 'Salt water floats you', recipe: 'Person + salt water', hint: 'Throw someone into salt water.',
    text: 'Salt water is denser than a person, so you float without swimming, like in the Dead Sea.' },
];

// Look up a discovery by its id (ids stay stable even if one is retired).
export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map(d => [d.id, d]));

// state: how it moves. k: heat conductivity (0..0.3). c: heat capacity.
// hot/cold: phase change thresholds. latent: heat (in degrees) a cell must
// soak up or give away at the threshold before it changes phase, so ice
// stays at 0 °C while melting and water stays at 100 °C while boiling.
// ignite/burn: [burn time, flame temperature, chance of leaving ash].
// c2: palette (warm autumn pixel art).
const DEFS = [];
function def(id, d) { DEFS[id] = d; }

def(EMPTY, { name: 'Air', state: 0, density: 1.2, k: 0.008, c: 0.25 });

def(STONE, { name: 'Stone', cat: 'solid', state: SOLID, density: 2600, k: 0.12, c: 0.8,
  hot: [1200, LAVA, DISC.ROCK_MELT], hard: 0.25,
  desc: 'Heavy rock. Melts into lava above 1200 °C.',
  c2: ['#8e8a76', '#7d7a69', '#9c9884', '#6f6c5e'] });

def(DIRT, { name: 'Soil', cat: 'powder', state: POWDER, density: 1500, k: 0.06, c: 0.8, slide: 0.18, hard: 0.6,
  desc: 'Earth that grass grows on. Seeds sprout in it.',
  c2: ['#7a4b2a', '#6b4025', '#855430', '#5e3820'] });

def(SAND, { name: 'Sand', cat: 'powder', state: POWDER, density: 1600, k: 0.07, c: 0.8, slide: 0.95, hard: 0.6,
  hot: [950, GLASS, DISC.GLASS],
  desc: 'Fine grains that pile up and sink in water. Fuses into glass when very hot.',
  c2: ['#f0d9a0', '#e5c98a', '#f6e4b4', '#d9bb79'] });

def(SNOW, { name: 'Snow', cat: 'powder', state: POWDER, density: 300, k: 0.05, c: 1.6, slide: 0.45, temp: -8, hard: 1,
  hot: [0.5, WATER, DISC.THAW], latent: [60, 0],
  desc: 'Light ice crystals. Melts above 0 °C.',
  c2: ['#f7f4ec', '#ebe7dc', '#ffffff', '#dfdbcf'] });

def(ASH, { name: 'Ash', cat: 'powder', state: POWDER, density: 700, k: 0.04, c: 0.5, slide: 0.7, hard: 1,
  desc: 'What is left after a fire. Light enough to float.',
  c2: ['#9a958d', '#8a857e', '#aaa59c', '#7c7871'] });

def(GUNPOWDER, { name: 'Gunpowder', cat: 'powder', state: POWDER, density: 1700, k: 0.06, c: 0.6, slide: 0.85,
  ignite: 180, hard: 1,
  desc: 'Explodes when it gets hotter than 180 °C.',
  c2: ['#45423e', '#524e49', '#3a3835', '#5f5a53'] });

def(SEED, { name: 'Seed', cat: 'life', state: POWDER, density: 1100, k: 0.05, c: 0.8, slide: 0.55,
  ignite: 200, burn: [20, 600, 0.6], hard: 1,
  desc: 'Drop on soil to grow a tree. Water speeds it up.',
  c2: ['#b07f3a', '#956a2f', '#c8954b', '#7f592a'] });

def(WATER, { name: 'Water', cat: 'liquid', state: LIQUID, density: 1000, k: 0.14, c: 1.6, flow: 5, visc: 1, hard: 0,
  hot: [100, EMPTY, DISC.BOIL], cold: [0, ICE, DISC.FREEZE], latent: [300, 60],
  desc: 'Flows and levels out. Boils at 100 °C, freezes at 0 °C.',
  c2: ['#62a89a', '#5a9f92', '#6db1a3', '#559789'] });

def(OIL, { name: 'Oil', cat: 'liquid', state: LIQUID, density: 850, k: 0.035, c: 0.6, flow: 3, visc: 0.8,
  ignite: 220, burn: [45, 850, 0], hard: 0.8,
  desc: 'Floats on water and burns hot. Ignites near 220 °C.',
  c2: ['#3d2b1e', '#4a3423', '#33241a', '#57402b'] });

def(ACID, { name: 'Acid', cat: 'liquid', state: LIQUID, density: 1200, k: 0.12, c: 1.2, flow: 4, visc: 1, hard: 0,
  desc: 'Dissolves almost everything it touches, except glass.',
  c2: ['#a4e23c', '#92d32f', '#b8ef5c', '#80c228'] });

// Real lava is a poor conductor of heat and hardens slowly: it has to give up
// a lot of latent heat, and it sets from the cool ground upward.
def(LAVA, { name: 'Lava', cat: 'liquid', state: LIQUID, density: 2700, k: 0.02, c: 1.0, flow: 2, visc: 0.22, temp: 1150,
  cold: [700, STONE, DISC.CRUST], latent: [0, 1100], hard: 0, glow: true,
  desc: 'Molten rock at about 1150 °C. Hardens slowly, from the bottom up, into stone.',
  c2: ['#ff7a1a', '#ff9a2e', '#e8561b', '#ffc04a'] });

def(SMOKE, { name: 'Smoke', cat: 'gas', state: GAS, density: 1.0, k: 0.03, c: 0.3, life: [90, 220], rise: 0.5, hard: 0,
  desc: 'Soot carried up by hot air. Fades away over time.',
  c2: ['#4b4740', '#56514a', '#423e38', '#5f5a52'] });

def(FIRE, { name: 'Fire', cat: 'gas', state: GAS, density: 0.4, k: 0.2, c: 0.05, temp: FIRE_TEMP, life: [18, 42],
  rise: 0.7, hard: 0, glow: true,
  desc: 'Burning gas at about 1000 °C. Spreads to anything that can burn.',
  c2: ['#ffd04a', '#ff8a1f', '#fff2b0', '#e04a17'] });

def(WOOD, { name: 'Wood', cat: 'solid', state: SOLID, density: 700, k: 0.04, c: 0.9, ignite: 350, burn: [150, 750, 0.55],
  hard: 0.5,
  desc: 'Solid fuel. Catches fire near 350 °C and burns to ash. Heated without air, it turns to charcoal.',
  c2: ['#7a4a2c', '#6b3f25', '#8a5733', '#5e3820'] });

def(PLANT, { name: 'Plant', cat: 'life', state: SOLID, density: 600, k: 0.06, c: 1.0, ignite: 260, burn: [22, 650, 0.25],
  hard: 1,
  desc: 'Leaves that drink water and grow. Very flammable.',
  c2: ['#3e5f2c', '#567a32', '#2f4a26', '#6d8a34'] });

def(ICE, { name: 'Ice', cat: 'solid', state: SOLID, density: 917, k: 0.16, c: 2.4, temp: -25, hard: 0.8,
  hot: [0.5, WATER, DISC.MELT], latent: [60, 0],
  desc: 'Frozen water at -25 °C. Chills and freezes water around it.',
  c2: ['#cdeef0', '#b6e3ea', '#e4f8f8', '#a3d6df'] });

def(GLASS, { name: 'Glass', cat: 'solid', state: SOLID, density: 2500, k: 0.08, c: 0.7, acidProof: true,
  desc: 'See-through and acid-proof. Made by melting sand.',
  c2: ['#dff2ee', '#cfe9e4', '#eef9f6', '#bfe0da'] });

def(OBSIDIAN, { name: 'Obsidian', cat: 'powder', state: POWDER, density: 2400, k: 0.1, c: 0.8, slide: 0.08, acidProof: true,
  hot: [1200, LAVA, DISC.ROCK_MELT],
  desc: 'Chunks of volcanic glass made when water cools lava fast. Sinks, and resists acid.',
  c2: ['#2a2238', '#352b45', '#1f1a2b', '#43375a'] });

def(METAL, { name: 'Metal', cat: 'solid', state: SOLID, density: 7800, k: 0.3, c: 0.5, hard: 0.08,
  hot: [1500, MOLTEN, DISC.MELT_METAL], latent: [150, 0],
  desc: 'Iron. Conducts heat far better than anything else. Rusts in water and melts at 1500 °C.',
  c2: ['#9aa4ab', '#aeb7bd', '#858f97', '#c4ccd1'] });

def(SALT, { name: 'Salt', cat: 'powder', state: POWDER, density: 2160, k: 0.08, c: 0.7, slide: 0.75, hard: 0.9,
  desc: 'Crystals that dissolve in water and melt ice.',
  c2: ['#f4f1ea', '#e7e2d6', '#fbfaf6', '#d9d3c5'] });

def(BRINE, { name: 'Salt water', cat: 'liquid', state: LIQUID, density: 1030, k: 0.14, c: 1.6, flow: 5, visc: 1, hard: 0,
  hot: [100, SALT, DISC.SALT_CRYSTALS], cold: [-2, ICE, DISC.FREEZE], latent: [300, 60],
  desc: 'Sea water. Sinks under fresh water, freezes at -2 °C and leaves salt when it boils.',
  c2: ['#6aa69a', '#629d91', '#74afa2', '#5a9488'] });

def(MUD, { name: 'Mud', cat: 'powder', state: POWDER, density: 1800, k: 0.1, c: 1.4, slide: 0.06, hard: 0.7,
  hot: [600, BRICK, DISC.BRICK],
  desc: 'Wet soil. Heavy and sticky. Seeds sprout fast in it. Bakes into brick at 600 °C.',
  c2: ['#5a3f2b', '#4e3625', '#664832', '#45301f'] });

def(BRICK, { name: 'Brick', cat: 'solid', state: SOLID, density: 1900, k: 0.07, c: 0.84, hard: 0.3,
  desc: 'Fired mud. Strong, heat-proof building blocks.',
  c2: ['#a8552f', '#934a29', '#b8653b', '#7e3f23'] });

def(COAL, { name: 'Coal', cat: 'solid', state: SOLID, density: 1350, k: 0.05, c: 0.9, ignite: 420, burn: [700, 1100, 0.35],
  hard: 0.6,
  desc: 'Charcoal. Hard to light, but burns for a long time at about 1100 °C.',
  c2: ['#2b2a2c', '#353336', '#232224', '#413e42'] });

def(THERMITE, { name: 'Thermite', cat: 'powder', state: POWDER, density: 2700, k: 0.1, c: 0.8, slide: 0.8, hard: 0.8,
  ignite: 600, burn: [55, 2500, 0], burnsInto: MOLTEN, ownOxygen: true,
  desc: 'Aluminium and rust powder. Hard to light, then burns at 2500 °C, even underwater, leaving molten iron.',
  c2: ['#8a8174', '#7a7266', '#9b9283', '#6b645a'] });

def(MOLTEN, { name: 'Molten metal', cat: 'liquid', state: LIQUID, density: 7000, k: 0.25, c: 0.5, flow: 3, visc: 0.5, temp: 1600,
  cold: [1450, METAL, DISC.CASTING], latent: [0, 150], hard: 0, glow: true,
  desc: 'Liquid iron at 1600 °C. Sets into metal below 1450 °C.',
  c2: ['#ffe9a8', '#ffd27a', '#fff4d0', '#ffb84a'] });

def(RUST, { name: 'Rust', cat: 'powder', state: POWDER, density: 5200, k: 0.08, c: 0.65, slide: 0.35, hard: 1,
  desc: 'Iron oxide. Flaky orange powder left when metal rusts.',
  c2: ['#9c4f24', '#87421d', '#b0602e', '#73391a'] });

def(MERCURY, { name: 'Mercury', cat: 'liquid', state: LIQUID, density: 13534, k: 0.2, c: 0.3, flow: 4, visc: 1, hard: 0.5,
  hot: [357, EMPTY, DISC.BOIL], latent: [100, 0],
  desc: 'A liquid metal so heavy (13,500 kg/m³) that sand, stone chips and even iron float on it.',
  c2: ['#c9d1d6', '#b3bcc2', '#dde3e6', '#9aa4ab'] });

def(HONEY, { name: 'Honey', cat: 'liquid', state: LIQUID, density: 1420, k: 0.05, c: 1.2, flow: 1, visc: 0.12, hard: 0.3,
  desc: 'Thick and sticky. Flows very slowly and sinks under water.',
  c2: ['#e3a12b', '#d18f1f', '#f0b545', '#bf7d17'] });

def(FUSE, { name: 'Fuse', cat: 'solid', state: SOLID, density: 600, k: 0.3, c: 0.4, ignite: 150, burn: [5, 900, 0], hard: 0.6,
  desc: 'Burns fast along its length. Use it to light gunpowder from far away.',
  c2: ['#6b5a3a', '#7d6a45', '#5a4b30', '#c9a24a'] });

def(CLONER, { name: 'Cloner', cat: 'machine', state: SOLID, density: 99999, k: 0.0, c: 9, acidProof: true,
  desc: 'Copies the first thing that touches it, then keeps making more of it. Try water, sand or lava.',
  c2: ['#3a3f4a', '#454b57', '#31353e', '#6fd6c0'] });

def(DRAIN, { name: 'Drain', cat: 'machine', state: SOLID, density: 99999, k: 0.0, c: 9, acidProof: true,
  desc: 'Swallows anything that touches it.',
  c2: ['#120f1a', '#1b1626', '#0b0910', '#3b2f5c'] });

// Blood: thin salty water with cells in it. Boils away like water.
def(BLOOD, { name: 'Blood', cat: 'liquid', state: LIQUID, density: 1060, k: 0.14, c: 1.5, flow: 4, visc: 0.7, hard: 0.2,
  hot: [100, EMPTY, DISC.BOIL], latent: [200, 0],
  desc: 'Comes out of hurt creatures. Flows like thin water.',
  c2: ['#9e1f1a', '#8a1915', '#b22a20', '#741410'] });

// Not a real material: the space a creature's body fills, written into the
// grid while the world moves so sand piles on bodies and water flows round
// them, and removed again before anything is drawn.
def(BODY, { name: 'Creature', state: SOLID, density: 99999, k: 0, c: 1, acidProof: true,
  c2: ['#000000'] });

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
export const BURN_TO = new Uint8Array(COUNT);    // what a fuel leaves behind (0 = ash or a last flame)
export const OWN_OXYGEN = new Uint8Array(COUNT); // burns without air (gunpowder, thermite)
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
  BURN_TO[t] = d.burnsInto ?? 0;
  OWN_OXYGEN[t] = d.ownOxygen ? 1 : 0;
  SLIDE[t] = d.slide ?? 0;
  FLOW[t] = d.flow ?? 0;
  VISC[t] = d.visc ?? 1;
  RISE[t] = d.rise ?? 0;
  if (d.life) { LIFE_MIN[t] = d.life[0]; LIFE_SPAN[t] = d.life[1] - d.life[0]; }
  HARD[t] = d.acidProof ? 0 : (d.hard ?? 0.5);
  GLOWS[t] = d.glow ? 1 : 0;
}

// Order of the buttons in the element palette.
export const PALETTE = [
  { cat: 'Powders', items: [SAND, DIRT, SNOW, GUNPOWDER, ASH, OBSIDIAN, SALT, MUD, THERMITE, RUST] },
  { cat: 'Liquids', items: [WATER, OIL, LAVA, ACID, BRINE, MERCURY, HONEY, MOLTEN] },
  { cat: 'Gases', items: [FIRE, SMOKE] },
  { cat: 'Solids', items: [STONE, WOOD, ICE, METAL, GLASS, BRICK, COAL, FUSE] },
  { cat: 'Life', items: [PLANT, SEED] },
  { cat: 'Machines', items: [CLONER, DRAIN] },
];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
