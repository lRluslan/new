// Element table: every material in the world and its real-world numbers.
// Densities are in kg/m³ and temperatures in °C. They are based on the real
// materials and tuned a little so reactions happen at a fun pace.

export const EMPTY = 0, STONE = 1, DIRT = 2, SAND = 3, SNOW = 4, ASH = 5,
  GUNPOWDER = 6, SEED = 7, WATER = 8, OIL = 9, ACID = 10, LAVA = 11,
  SMOKE = 12, FIRE = 13, WOOD = 14, PLANT = 15, ICE = 16,
  GLASS = 17, OBSIDIAN = 18, METAL = 19, SALT = 20, BRINE = 21, MUD = 22, BRICK = 23, COAL = 24,
  THERMITE = 25, MOLTEN = 26, RUST = 27, MERCURY = 28, HONEY = 29, FUSE = 30, CLONER = 31, DRAIN = 32,
  BLOOD = 33, BODY = 34, GRAVEL = 35, CEMENT = 36, CONCRETE = 37, NAPALM = 38, NITRO = 39, C4 = 40,
  NITROGEN = 41, SLIME = 42, WAX = 43, MOLTEN_WAX = 44, GOLD = 45, MOLTEN_GOLD = 46, FUNGUS = 47,
  FIREWORK = 48, SPARKLE = 49, CLOUD = 50, BATTERY = 51, LAMP = 52, DRIED_BLOOD = 53,
  QUICKSAND = 54, URANIUM = 55, HYDROGEN = 56, CORN = 57, POPCORN = 58, DIAMOND = 59, TAR = 60, CACTUS = 61,
  FLOWER = 62, BLOOM = 63, SPONGE = 64, RUBBER = 65, DRY_ICE = 66, CO2 = 67, LYE = 68, TORCH = 69,
  BLACK_HOLE = 70, HEATER = 71, FREEZER = 72, HAIL = 73, METEOR = 74;

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
  CONCRETE: 40, NAPALM: 41, NITRO: 42, C4: 43, CRYO: 44, CANDLE: 45, GOLD: 46, ROT: 47,
  FIREWORK: 48, RAIN_CLOUD: 49, ELECTRIC: 50, LAMP: 51, SHOCK: 52,
  MELTDOWN: 53, HYDROGEN: 54, POPCORN: 55, DIAMOND: 56, NEUTRALIZE: 57, BOUNCE: 58, GRAZE: 59,
  SUBLIME: 60, BLACK_HOLE: 61, BLOOM: 62, METEOR: 63,
  BIRTH: 64, HOME: 65, FORESTER: 66, FOOD_CHAIN: 67,
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
  { id: DISC.CONCRETE, title: 'Concrete', recipe: 'Cement + time', hint: 'Pour some cement and wait.',
    text: 'Cement reacts with the water mixed into it and slowly sets into hard concrete, even under water.' },
  { id: DISC.NAPALM, title: 'Sticky fire', recipe: 'Napalm + fire', hint: 'Set napalm alight, then try to put it out.',
    text: 'Napalm is jellied fuel. It clings, burns for a long time at about 1300 °C, and floats on water, so water cannot put it out.' },
  { id: DISC.NITRO, title: 'Shock sensitive', recipe: 'Nitroglycerin + a bump', hint: 'Drop some nitroglycerin from high up.',
    text: 'Nitroglycerin is so unstable that a hard knock sets it off, not just heat.' },
  { id: DISC.C4, title: 'Plastic explosive', recipe: 'C4 + heat', hint: 'C4 ignores knocks. What does it need?',
    text: 'C4 is very stable: you can drop it or even burn the outside slowly. Real heat or a spark sets off a huge blast.' },
  { id: DISC.CRYO, title: 'Cryogenics', recipe: 'Liquid nitrogen', hint: 'Pour liquid nitrogen on something.',
    text: 'Nitrogen boils at -196 °C. As it boils away it pulls heat out of everything it touches and freezes water solid.' },
  { id: DISC.CANDLE, title: 'Candle', recipe: 'Wax + flame', hint: 'Heat some wax, then light it.',
    text: 'Wax melts at about 60 °C. A wax flame burns slowly and steadily, melting more wax as it goes.' },
  { id: DISC.GOLD, title: 'Molten gold', recipe: 'Gold + 1064 °C', hint: 'Gold does not rust or dissolve. Can you melt it?',
    text: 'Gold melts at 1064 °C. It weighs 19,300 kg/m³, heavy enough to sink even in mercury, though it is hot enough to boil mercury away.' },
  { id: DISC.ROT, title: 'Rot', recipe: 'Fungus + damp wood', hint: 'Grow fungus near water and wood.',
    text: 'Fungus feeds on dead wood and spreads fastest where it is damp, slowly turning logs into more fungus.' },
  { id: DISC.FIREWORK, title: 'Fireworks', recipe: 'Firework + fire', hint: 'Light a firework.',
    text: 'A firework rocket burns its fuel to climb, then its charge bursts into burning metal salts: strontium red, copper blue, barium green.' },
  { id: DISC.RAIN_CLOUD, title: 'Rain cloud', recipe: 'Cloud', hint: 'Make a cloud and watch it.',
    text: 'Clouds are tiny drops of water floating in the air. When they join into bigger drops, they fall as rain, or snow in the cold.' },
  { id: DISC.ELECTRIC, title: 'Electricity', recipe: 'Battery + metal', hint: 'Put a battery next to a metal wire.',
    text: 'A battery pushes electric current through metal. Gold and iron both conduct; the pulse runs along the wire.' },
  { id: DISC.LAMP, title: 'Let there be light', recipe: 'Battery + wire + lamp', hint: 'Power a lamp with a wire.',
    text: 'Current through a lamp heats its filament until it glows. It is brightest at night.' },
  { id: DISC.SHOCK, title: 'Electrocution', recipe: 'Creature + live wire', hint: 'What happens if someone touches a live wire?',
    text: 'Current through a body makes the muscles jump and hurts. Do not try this at home.' },
  { id: DISC.MELTDOWN, title: 'Meltdown', recipe: 'A big pile of uranium', hint: 'Pile up a lot of uranium in one place.',
    text: 'Uranium gives off heat as it decays. A small lump stays warm; pile enough together and the heat builds until it glows and melts everything around it.' },
  { id: DISC.HYDROGEN, title: 'Hydrogen blast', recipe: 'Hydrogen + flame', hint: 'Light a cloud of hydrogen.',
    text: 'Hydrogen is the lightest gas. It rises fast, and mixed with air even a small spark makes it explode.' },
  { id: DISC.POPCORN, title: 'Popcorn', recipe: 'Corn + 180 °C', hint: 'Heat some corn.',
    text: 'The water inside a corn kernel turns to steam and bursts the shell, puffing the starch up to many times its size.' },
  { id: DISC.DIAMOND, title: 'Diamond', recipe: 'Coal + great heat, no air', hint: 'Coal that is very hot but cannot burn...',
    text: 'Diamond is pure carbon, packed tight by great heat and pressure. It is the hardest thing there is, but it does burn in hot air.' },
  { id: DISC.NEUTRALIZE, title: 'Neutralisation', recipe: 'Acid + lye', hint: 'What cancels out an acid?',
    text: 'An acid and a base cancel each other out, making salt water and heat.' },
  { id: DISC.BOUNCE, title: 'Trampoline', recipe: 'Creature + rubber', hint: 'Drop someone onto rubber.',
    text: 'Rubber is elastic: it stores the energy of a fall and gives it back, so a landing on it bounces instead of hurting.' },
  { id: DISC.GRAZE, title: 'Grazing', recipe: 'Sheep + plants', hint: 'Let a sheep near some grass and bushes.',
    text: 'Sheep eat leaves and grass. A flock can strip a bush bare.' },
  { id: DISC.SUBLIME, title: 'Sublimation', recipe: 'Dry ice + warmth', hint: 'Leave dry ice out in the warm.',
    text: 'Dry ice is frozen carbon dioxide at -78 °C. It turns straight into gas without melting first. The gas is heavier than air, so it pools low, puts out fires, and you cannot breathe it.' },
  { id: DISC.BLACK_HOLE, title: 'Event horizon', recipe: 'Black hole', hint: 'Put something near a black hole.',
    text: 'Nothing that gets close enough to a black hole escapes. Things near it are stretched and swallowed.' },
  { id: DISC.BLOOM, title: 'Blooming', recipe: 'Flower seed + soil', hint: 'Plant flower seeds in soil.',
    text: 'A flower seed on soil sends up a stem and opens a bloom.' },
  { id: DISC.METEOR, title: 'Impact', recipe: 'Meteor', hint: 'Call down a meteor.',
    text: 'A meteor hits the ground at tens of kilometres per second, blasting out a crater and scattering molten rock.' },
  { id: DISC.BIRTH, title: 'New life', recipe: 'Two well-fed animals', hint: 'Keep a pair of animals fed and safe for a while.',
    text: 'Two grown-up animals of the same kind that have eaten well have a baby. It starts small and grows up over a couple of days.' },
  { id: DISC.HOME, title: 'Home sweet home', recipe: 'A person + wood', hint: 'Leave people alone long enough to gather wood.',
    text: 'People gather wood and build a little hut, plank by plank. They sleep there at night and shelter there from the rain.' },
  { id: DISC.FORESTER, title: 'Tree planter', recipe: 'A person + a seed', hint: 'People pick up seeds that fall from trees.',
    text: 'People and robots plant the seeds they collect. On soil a seed grows into a new tree, so the forest keeps going.' },
  { id: DISC.FOOD_CHAIN, title: 'Food chain', recipe: 'A hungry hunter', hint: 'Let a cat or a dog go hungry near smaller animals.',
    text: 'Plants feed the plant eaters, and hungry cats and dogs hunt the small animals. Each eats the one below it.' },
];

// Look up a discovery by its id (ids stay stable even if one is retired).
export const DISCOVERY_BY_ID = Object.fromEntries(DISCOVERIES.map(d => [d.id, d]));

// state: how it moves. k: heat conductivity (0..0.3). c: heat capacity.
// hot/cold: phase change thresholds. latent: heat (in degrees) a cell must
// soak up or give away at the threshold before it changes phase, so ice
// stays at 0 °C while melting and water stays at 100 °C while boiling.
// ignite/burn: [burn time, flame temperature, chance of leaving ash].
// c2: palette (green forest pixel art).
const DEFS = [];
function def(id, d) { DEFS[id] = d; }

def(EMPTY, { name: 'Air', state: 0, density: 1.2, k: 0.008, c: 0.25 });

def(STONE, { name: 'Stone', cat: 'solid', state: SOLID, density: 2600, k: 0.12, c: 0.8,
  hot: [1200, LAVA, DISC.ROCK_MELT], hard: 0.25,
  desc: 'Heavy rock. Melts into lava above 1200 °C.',
  c2: ['#848c80', '#737b70', '#959c8e', '#646c62'] });

def(DIRT, { name: 'Soil', cat: 'powder', state: POWDER, density: 1500, k: 0.06, c: 0.8, slide: 0.18, hard: 0.6,
  desc: 'Earth that grass grows on. Seeds sprout in it.',
  c2: ['#6a4630', '#5c3c28', '#785238', '#4e3222'] });

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
  c2: ['#4faa9c', '#47a093', '#5ab4a6', '#3f968c'] });

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
  c2: ['#6e4a32', '#5e3e2a', '#7e583c', '#503424'] });

def(PLANT, { name: 'Plant', cat: 'life', state: SOLID, density: 600, k: 0.06, c: 1.0, ignite: 260, burn: [22, 650, 0.25],
  hard: 1,
  desc: 'Leaves that drink water and grow. Very flammable.',
  c2: ['#468e3c', '#5caa42', '#367436', '#7cc44c'] });

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
  c2: ['#6aa89c', '#62a094', '#74b2a6', '#5a978c'] });

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
def(BLOOD, { name: 'Blood', cat: 'liquid', state: LIQUID, density: 1060, k: 0.14, c: 1.5, flow: 3, visc: 0.55, hard: 0.2,
  hot: [100, EMPTY, DISC.BOIL], latent: [200, 0], life: [2400, 4200],
  desc: 'Comes out of hurt creatures. Flows like thin water.',
  c2: ['#9e1f1a', '#8a1915', '#b22a20', '#741410'] });

// Not a real material: the space a creature's body fills, written into the
// grid while the world moves so sand piles on bodies and water flows round
// them, and removed again before anything is drawn.
def(BODY, { name: 'Creature', state: SOLID, density: 99999, k: 0, c: 1, acidProof: true,
  c2: ['#000000'] });

def(GRAVEL, { name: 'Gravel', cat: 'powder', state: POWDER, density: 1800, k: 0.1, c: 0.8, slide: 0.3, hard: 0.6,
  desc: 'Small stones. Heavier than sand and piles up in steep heaps.',
  c2: ['#8f8a80', '#a29c90', '#77736b', '#b3ad9f'] });

def(CEMENT, { name: 'Cement', cat: 'liquid', state: LIQUID, density: 2300, k: 0.1, c: 0.9, flow: 2, visc: 0.3, hard: 0.5,
  life: [500, 800],
  desc: 'Wet concrete. Flows slowly, then sets hard after about ten seconds, even under water.',
  c2: ['#b8b2a6', '#aaa498', '#c4beb2', '#9d978b'] });

def(CONCRETE, { name: 'Concrete', cat: 'solid', state: SOLID, density: 2400, k: 0.1, c: 0.9, hard: 0.25,
  desc: 'Set cement. Hard, heavy, and slow for acid to eat.',
  c2: ['#a7a296', '#b5b0a4', '#9a958a', '#bdb8ac'] });

def(NAPALM, { name: 'Napalm', cat: 'liquid', state: LIQUID, density: 900, k: 0.04, c: 0.6, flow: 1, visc: 0.15, hard: 0.6,
  ignite: 150, burn: [420, 1300, 0],
  desc: 'Jellied fuel. Clings, burns very hot for a long time, and floats on water, so water cannot put it out.',
  c2: ['#c26a1e', '#b35d18', '#d27a2a', '#a14f12'] });

def(NITRO, { name: 'Nitroglycerin', cat: 'explosive', state: LIQUID, density: 1600, k: 0.06, c: 0.6, flow: 3, visc: 0.9, hard: 0.4,
  ignite: 170,
  desc: 'A liquid explosive so unstable that a hard bump sets it off. Heat does too.',
  c2: ['#e8e2a0', '#ddd690', '#f2edb4', '#d0c880'] });

def(C4, { name: 'C4', cat: 'explosive', state: SOLID, density: 1600, k: 0.05, c: 0.8, ignite: 320, hard: 0.5,
  desc: 'Plastic explosive. Safe to drop, but heat or a spark sets off a huge blast.',
  c2: ['#d9d2b6', '#cfc8aa', '#e3dcc2', '#c4bd9e'] });

def(NITROGEN, { name: 'Liquid nitrogen', cat: 'liquid', state: LIQUID, density: 808, k: 0.14, c: 1.0, flow: 5, visc: 1, hard: 0,
  temp: -196, hot: [-196, EMPTY, DISC.CRYO], latent: [70, 0],
  desc: 'At -196 °C it boils away fast, freezing water and anything it touches.',
  c2: ['#d8f2ff', '#c4e8fb', '#e6f8ff', '#b4dcf2'] });

def(SLIME, { name: 'Slime', cat: 'liquid', state: LIQUID, density: 1100, k: 0.06, c: 1.2, flow: 1, visc: 0.06, hard: 0.2,
  desc: 'Very thick green goo. Oozes, and anything that falls in gets stuck.',
  c2: ['#6fd04a', '#5fc23c', '#82dc5c', '#4fae30'] });

def(WAX, { name: 'Wax', cat: 'solid', state: SOLID, density: 900, k: 0.05, c: 1.2, hard: 0.6,
  hot: [62, MOLTEN_WAX, DISC.CANDLE], latent: [40, 0], ignite: 240, burn: [700, 620, 0],
  desc: 'Candle wax. Melts at 62 °C and burns slowly with a small flame.',
  c2: ['#f4ead2', '#ede0c2', '#f8f1df', '#e4d6b4'] });

def(MOLTEN_WAX, { name: 'Molten wax', cat: 'liquid', state: LIQUID, density: 880, k: 0.05, c: 1.2, flow: 2, visc: 0.5, hard: 0.6,
  temp: 70, cold: [55, WAX, -1], latent: [0, 40], ignite: 240, burn: [700, 620, 0],
  desc: 'Melted wax. Sets again as it cools.',
  c2: ['#f7e7b8', '#f2dea6', '#fbefca', '#ebd292'] });

def(GOLD, { name: 'Gold', cat: 'solid', state: SOLID, density: 19300, k: 0.3, c: 0.13, acidProof: true,
  hot: [1064, MOLTEN_GOLD, DISC.GOLD], latent: [60, 0],
  desc: 'Never rusts and acid cannot touch it. Conducts electricity. Melts at 1064 °C.',
  c2: ['#f2c440', '#e3b02a', '#ffd966', '#c9961c'] });

def(MOLTEN_GOLD, { name: 'Molten gold', cat: 'liquid', state: LIQUID, density: 17300, k: 0.3, c: 0.13, flow: 3, visc: 0.6, temp: 1250,
  cold: [1064, GOLD, DISC.CASTING], latent: [0, 400], hard: 0, glow: true, acidProof: true,
  desc: 'Liquid gold. So heavy it sinks through mercury.',
  c2: ['#ffe27a', '#ffd04a', '#fff0a8', '#ffbf2a'] });

def(FUNGUS, { name: 'Fungus', cat: 'life', state: SOLID, density: 600, k: 0.05, c: 1.0, ignite: 220, burn: [40, 600, 0.4], hard: 0.9, life: [5, 8],
  desc: 'Creeps over damp ground and rots wood into more fungus. Grows fastest near water.',
  c2: ['#c9b48a', '#b39c70', '#d8c69e', '#8f7a52'] });

def(FIREWORK, { name: 'Firework', cat: 'explosive', state: POWDER, density: 1200, k: 0.06, c: 0.6, slide: 0.4, ignite: 200, hard: 0.8,
  desc: 'Light it and it shoots up into the sky and bursts into colours.',
  c2: ['#c8463a', '#3a7ac8', '#e8b53a', '#4aa85a'] });

// The burning stars of a firework burst.
def(SPARKLE, { name: 'Firework spark', state: GAS, density: 0.5, k: 0.05, c: 0.05, temp: 500, life: [30, 70], hard: 0, glow: true,
  c2: ['#ff5a4a', '#5aa8ff', '#ffd84a', '#6aff7a', '#ff7ad8', '#ffffff'] });

def(CLOUD, { name: 'Cloud', cat: 'gas', state: GAS, density: 0.9, k: 0.02, c: 0.4, hard: 0, life: [1500, 2500],
  desc: 'Drifts across the sky and rains. In the cold it snows instead.',
  c2: ['#f4f1ea', '#e6e2da', '#fbfaf6', '#d6d2ca'] });

def(BATTERY, { name: 'Battery', cat: 'machine', state: SOLID, density: 99999, k: 0.0, c: 9, acidProof: true,
  desc: 'Sends pulses of electricity into any metal or gold wire touching it.',
  c2: ['#2f3a2a', '#3a4733', '#e0b43a', '#c84a3a'] });

def(LAMP, { name: 'Lamp', cat: 'machine', state: SOLID, density: 2500, k: 0.05, c: 0.8, hard: 0.2,
  desc: 'Lights up while electricity flows into it. Wire it to a battery.',
  c2: ['#6a6250', '#5e5646', '#776e5a', '#fff2b0'] });

// Blood that has lain still long enough dries into a dark crust.
def(DRIED_BLOOD, { name: 'Dried blood', state: POWDER, density: 1300, k: 0.08, c: 1.0, slide: 0.03, hard: 0.9,
  desc: 'Old blood, dried into a dark crust.',
  c2: ['#4a1210', '#5a1712', '#3e0f0d', '#64201a'] });

def(QUICKSAND, { name: 'Quicksand', cat: 'liquid', state: LIQUID, density: 1900, k: 0.08, c: 1.2, flow: 1, visc: 0.04, hard: 0.6,
  desc: 'Wet sand that flows like very thick mud. Creatures sink in and get stuck.',
  c2: ['#c7a96c', '#b8995c', '#d4b87c', '#a98a50'] });

def(URANIUM, { name: 'Uranium', cat: 'solid', state: SOLID, density: 19000, k: 0.15, c: 0.12, hard: 0.2,
  hot: [1132, LAVA, DISC.MELTDOWN], latent: [120, 0], glow: false,
  desc: 'Radioactive metal. It warms itself as it decays; a big pile gets dangerously hot. Its radiation slowly hurts creatures nearby.',
  c2: ['#4a6a3a', '#567a42', '#3e5a30', '#6a8c4a'] });

def(HYDROGEN, { name: 'Hydrogen', cat: 'gas', state: GAS, density: 0.09, k: 0.18, c: 0.4, life: [1200, 2400], rise: 0.95, hard: 0,
  ignite: 500,
  desc: 'The lightest gas. Rises fast and explodes when it meets a flame.',
  c2: ['#e8f4ff', '#dcecfa', '#f2f8ff', '#d0e4f4'] });

def(CORN, { name: 'Corn', cat: 'powder', state: POWDER, density: 750, k: 0.05, c: 1.0, slide: 0.6, hard: 1,
  hot: [180, POPCORN, DISC.POPCORN],
  desc: 'Corn kernels. Heat them to 180 °C and they pop.',
  c2: ['#f2c43a', '#e8b32a', '#f8d45a', '#d89e1e'] });

def(POPCORN, { name: 'Popcorn', cat: 'powder', state: POWDER, density: 60, k: 0.03, c: 1.0, slide: 0.5, hard: 1,
  ignite: 300, burn: [30, 600, 0.6],
  desc: 'Light, fluffy and edible. Burns if it gets too hot.',
  c2: ['#fbf4dc', '#f4ead0', '#fffaea', '#ecd9a8'] });

def(DIAMOND, { name: 'Diamond', cat: 'solid', state: SOLID, density: 3500, k: 0.3, c: 0.5, acidProof: true,
  ignite: 900, burn: [200, 1100, 0],
  desc: 'Pure carbon, the hardest thing there is. Acid cannot touch it, but it burns in hot air.',
  c2: ['#d8f8ff', '#b8eef8', '#f0fdff', '#9ee0ee'] });

def(TAR, { name: 'Tar', cat: 'liquid', state: LIQUID, density: 1150, k: 0.04, c: 0.9, flow: 1, visc: 0.05, hard: 0.7,
  ignite: 320, burn: [380, 900, 0],
  desc: 'Black and sticky. Barely flows, traps whatever walks into it, and burns with thick smoke.',
  c2: ['#1e1a18', '#262120', '#161312', '#2e2826'] });

def(CACTUS, { name: 'Cactus', cat: 'life', state: SOLID, density: 700, k: 0.05, c: 1.2, life: [6, 11], hard: 0.8,
  ignite: 400, burn: [60, 600, 0.3],
  desc: 'Grows tall on sand without needing much water. Its spines hurt anything that touches it.',
  c2: ['#4e8a3a', '#5a9a44', '#447a32', '#3a6a2a'] });

def(FLOWER, { name: 'Flower seeds', cat: 'life', state: POWDER, density: 900, k: 0.05, c: 0.8, slide: 0.5, hard: 1,
  desc: 'Scatter on soil and they grow into flowers.',
  c2: ['#6a4a2a', '#7a5a34', '#5a3e22', '#8a6a3e'] });

def(BLOOM, { name: 'Flower', state: SOLID, density: 300, k: 0.05, c: 1.0, ignite: 250, burn: [15, 600, 0.3], hard: 1,
  c2: ['#e84a6a', '#f2c43a', '#a86ae8', '#f08a3a', '#f4f0ff', '#4aa8e8'] });

def(SPONGE, { name: 'Sponge', cat: 'solid', state: SOLID, density: 300, k: 0.03, c: 1.0, hard: 0.9, ignite: 350, burn: [40, 600, 0.3],
  desc: 'Soaks up water around it until it is full. Heat dries it out again.',
  c2: ['#f0d85a', '#e8cc48', '#f6e278', '#d8b838'] });

def(RUBBER, { name: 'Rubber', cat: 'solid', state: SOLID, density: 1100, k: 0.02, c: 1.4, hard: 0.5, ignite: 330, burn: [120, 700, 0.2],
  desc: 'Bouncy. Creatures that land on it spring back up instead of getting hurt. Does not carry electricity.',
  c2: ['#3a3a42', '#444450', '#30303a', '#c84a4a'] });

def(DRY_ICE, { name: 'Dry ice', cat: 'solid', state: SOLID, density: 1560, k: 0.1, c: 0.85, temp: -78, hard: 0.9,
  hot: [-78, CO2, DISC.SUBLIME], latent: [90, 0],
  desc: 'Frozen carbon dioxide at -78 °C. Turns straight into gas as it warms, making a cold fog that sinks.',
  c2: ['#e8f0f4', '#dce6ec', '#f4f8fa', '#cfdbe2'] });

def(CO2, { name: 'Carbon dioxide', cat: 'gas', state: GAS, density: 1.98, k: 0.02, c: 0.8, life: [700, 1400], hard: 0,
  desc: 'Heavier than air, so it sinks and pools in low places. Puts out fires, and nothing can breathe it.',
  c2: ['#d8e2e8', '#cdd8de', '#e2eaee', '#c2ced6'] });

def(LYE, { name: 'Lye', cat: 'liquid', state: LIQUID, density: 1150, k: 0.12, c: 1.2, flow: 4, visc: 1, hard: 0,
  desc: 'A strong base. Mixed with acid it makes salt water and heat. Stings like acid.',
  c2: ['#c8d0f0', '#bcc6ea', '#d4dcf6', '#aeb8e0'] });

def(TORCH, { name: 'Torch', cat: 'machine', state: SOLID, density: 99999, k: 0.0, c: 9, acidProof: true,
  desc: 'Burns forever with a steady flame. Good for lighting things, and for lighting up the night.',
  c2: ['#6a4a2a', '#5a3e22', '#7a5634', '#ffb636'] });

def(BLACK_HOLE, { name: 'Black hole', cat: 'machine', state: SOLID, density: 99999, k: 0.0, c: 9, acidProof: true,
  desc: 'Pulls in everything nearby and swallows it, creatures included.',
  c2: ['#050308', '#0a0612', '#000000', '#3a1e6a'] });

def(HEATER, { name: 'Heater', cat: 'machine', state: SOLID, density: 99999, k: 0.3, c: 9, temp: 400, acidProof: true,
  desc: 'Stays at 400 °C, warming everything it touches.',
  c2: ['#8a3a2a', '#a8442e', '#7a3224', '#ff8a4a'] });

def(FREEZER, { name: 'Freezer', cat: 'machine', state: SOLID, density: 99999, k: 0.3, c: 9, temp: -80, acidProof: true,
  desc: 'Stays at -80 °C, chilling and freezing everything it touches.',
  c2: ['#2a4a6a', '#30587a', '#24405e', '#8ad8ff'] });

def(HAIL, { name: 'Hail', cat: 'powder', state: POWDER, density: 900, k: 0.16, c: 2.1, slide: 0.7, temp: -5, hard: 0.8,
  hot: [0, WATER, DISC.MELT], latent: [40, 0],
  desc: 'Balls of ice. They hurt when they land on someone, and melt in the warm.',
  c2: ['#eef8fc', '#dceef6', '#ffffff', '#c8e2ee'] });

// A meteor: a rock glowing from its fall through the air. Blasts a crater where it lands.
def(METEOR, { name: 'Meteor', state: POWDER, density: 3500, k: 0.1, c: 0.8, temp: 1500, slide: 0.2, hard: 0.2, glow: true,
  c2: ['#ffcf6a', '#ff8a2a', '#ffe8a8', '#e8561e'] });

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
  { cat: 'Powders', items: [SAND, DIRT, SNOW, GRAVEL, ASH, OBSIDIAN, SALT, MUD, THERMITE, RUST, CORN, HAIL] },
  { cat: 'Liquids', items: [WATER, OIL, LAVA, ACID, BRINE, MERCURY, HONEY, MOLTEN, CEMENT, NAPALM, NITROGEN, SLIME, QUICKSAND, TAR, LYE] },
  { cat: 'Gases', items: [FIRE, SMOKE, CLOUD, HYDROGEN, CO2] },
  { cat: 'Solids', items: [STONE, WOOD, ICE, METAL, GLASS, BRICK, COAL, FUSE, CONCRETE, WAX, GOLD, DIAMOND, URANIUM, RUBBER, SPONGE, DRY_ICE] },
  { cat: 'Explosives', items: [GUNPOWDER, NITRO, C4, FIREWORK] },
  { cat: 'Life', items: [PLANT, SEED, FUNGUS, CACTUS, FLOWER] },
  { cat: 'Machines', items: [CLONER, DRAIN, BATTERY, LAMP, TORCH, HEATER, FREEZER, BLACK_HOLE] },
];

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
