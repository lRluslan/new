# Sandgrove

A falling-sand physics sandbox. You paint elements (sand, water, fire, oil,
lava, ice, plants, acid and more) and watch how they react. Everything follows
simple real-world physics: heavy things sink, liquids level out, heat flows
from hot to cold, and things melt, boil, freeze and burn at their real
temperatures.

The world is a side view, drawn as warm autumn pixel art, like looking at the
side of an ant farm. It fills the whole screen: when the game starts, the
world is made to match the shape and size of your screen (about 5 screen
pixels per cell). Reset or Clear fits it again if you have resized the window.
Zoom in with the scroll wheel or a pinch to see the details.

There are 52 reactions to discover, such as obsidian, boiling, glassmaking, brickmaking, charcoal,
thermite, casting, rust, lightning, explosions, concrete, fireworks, electricity, drowning and zombie infection. The **Discoveries** button in the top right keeps track of them.

### Creatures

The **Creatures** group in the palette has five kinds of little ragdoll creatures:

| | |
|---|---|
| **Human** | Walks about, runs from fire and zombies, swims until tired. Needs air. |
| **Zombie** | Shambles after people. A bite turns a person into a zombie a few seconds later. Does not breathe, so it walks along the bottom of ponds. Burns easily. |
| **Robot** | Heavy and tough. Fire hardly bothers it, but it sinks in water, leaks oil when hurt, and acid eats it fast. |
| **Chicken** | Scurries away from everyone. Light enough to float, and flaps its wings so falls do not hurt it. |
| **Dog** | Trots about on four legs and loves chasing chickens (it only plays). Paddles when it falls in water. |
| **Bird** | Perches, then flies about at a cruising height. Takes off at the first sign of danger and glides down gently. |
| **Frog** | Hops along and swims. Breathes air or water, so it never drowns, but its skin is sensitive to acid. |
| **Fish** | Swims in water. On land it flops about and soon suffocates. |

Pick one and click to drop it in. With a creature or the **Grab** tool (`G`) selected, click and drag a creature to pick
it up. Let go to drop it, or flick the mouse to throw it. The **Eraser** (or right mouse) removes creatures.

They follow the same physics as everything else. Their bodies are made of joined parts (head, body, arms, legs) that
fall, tumble and collide. Sand piles up on them and can bury them, and water flows around them. They float or sink by
their real density: people barely sink in fresh water but float in salt water, robots sink, chickens bob on top.

What hurts them (they are tough: most things take a while to kill, and they heal):
- **Falls and throws:** landing hard hurts and bruises. A person survives a fall of about 10 m (60 cells) badly hurt;
  much higher is deadly. Being thrown into a wall hurts the same way.
- **Fire** sets them alight. They panic and run, spreading the flames, until water puts them out. Burning once is
  survivable; staying in a fire kills in about 15 seconds. Burnt bodies crumble to ash.
- **Lava** kills in a few seconds.
- **Acid** eats at them slowly.
- **Water:** air breathers hold their breath for about 10 seconds, then slowly drown. Swimmers tire after about 10 seconds.
- **Weight:** a heavy pile of sand, stone or metal on top crushes them, and so does being trapped inside a solid block.
- **Explosions and lightning:** a blast right next to them is deadly; further away they are thrown, cut and bruised.

**Injuries.** Each body part is hurt on its own. A broken arm hangs limp; a broken leg makes them limp along, and with
both legs gone they cannot stand. A hard knock to the head knocks them out. Cuts bleed: blood loss drains their
health over time, and a bad wound spurts with each heartbeat. Wounds clot after a while, and once nothing is bleeding
a creature slowly heals. Badly hurt creatures pass out and lie still until they recover a little.

Hover over a creature to see its health. A small health bar appears over it after it gets hurt, and a "!" when it is scared.

The **Blood** button at the bottom turns blood and gore on or off. With it on, cuts show as dark gashes and blood
soaks into clothes, blunt hits leave bruises, and blood sprays out in arcs from big hits and pumps from bad wounds.
It is real liquid: it runs, pools, mixes into water and dries into dark stains after about half a minute. A limb hit
hard enough can be torn off, leaving a raw stump with the bone showing. After death the heart stops, so blood only
oozes. With Blood off, creatures just flash when hurt (they are still injured and bleed internally).

---

## How to run it on your computer

You only have to do steps 1 and 2 once.

### 1. Install Node.js

Node.js is a free program that lets your computer run a small web server for
the game.

1. Go to **https://nodejs.org**.
2. Click the big green button that says **LTS** (it means "the stable version").
3. Open the file you downloaded and click **Next** until it is finished. Keep all the default settings.

### 2. Download the game

1. Open this project's page on GitHub.
2. The game lives on the branch called **`claude/new-session-ke6x3d`**.
   Click the branch menu near the top left (it usually says `main`) and pick that branch.
3. Click the green **Code** button, then **Download ZIP**.
4. Find the ZIP file in your Downloads folder and unzip it.
   On Windows: right-click it and choose **Extract All**. On a Mac: double-click it.

### 3. Start the game

**On Windows**

1. Open the unzipped folder. You should see `index.html`, `server.js` and a `src` folder.
2. Click the address bar at the top of the folder window, type `cmd` and press **Enter**.
   A black window opens.
3. Type `npm start` and press **Enter**.

**On a Mac**

1. Open the **Terminal** app (press Cmd + Space, type "Terminal", press Enter).
2. Type `cd ` (with a space after it), then drag the unzipped folder into the
   Terminal window and press **Enter**.
3. Type `npm start` and press **Enter**.

You will see `Sandgrove is running. Open http://localhost:8080 in your browser.`

### 4. Play

Open your web browser (Chrome, Edge, Firefox or Safari) and go to
**http://localhost:8080**.

To stop the game server, go back to the black or Terminal window and press **Ctrl + C**.
Next time you only need step 3.

> **Why not just double-click `index.html`?** Browsers block web pages that are
> opened straight from a file from loading their other code files, for safety.
> The small server in `server.js` gets around this. It only runs on your own
> computer.

> **Internet:** only the fonts come from the internet. The game itself works
> offline; without internet it just uses your computer's standard fonts.

---

## Put it online for free (optional)

With GitHub Pages, anyone (including you on your phone) can play from a link,
without installing anything.

1. On the project's GitHub page, click **Settings**, then **Pages** in the left menu.
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Pick the branch `claude/new-session-ke6x3d` (or `main`, if you have merged it), and the folder **/ (root)**. Click **Save**.
4. Wait a minute or two, then refresh the page. GitHub shows your link, which will look like
   `https://lrluslan.github.io/new/`.

GitHub Pages is free for public projects. For a private project it needs a paid GitHub plan.

---

## Controls

| | Mouse | Touch |
|---|---|---|
| Paint | Left mouse | Drag one finger |
| Erase | Right mouse, or the Eraser tool | The Eraser tool |
| Zoom | Scroll wheel (zooms toward the mouse), `+` and `−` keys | Pinch with two fingers |
| Move around | Middle-drag, or the arrow keys | Drag with two fingers |
| Brush size | Shift + scroll, or the `[` and `]` keys | The Brush slider |
| Creatures | Pick one and click to drop it in. Drag one to carry or throw it | The same, with one finger |

Keys:
- `1` to `0` pick elements. `E` is the eraser, `H` heat, `J` cool, `G` grab, `B` bomb, `L` lightning, `W` wind.
- `Space` pauses, `.` moves one step forward.
- `R` resets the world and `C` clears it.
- `T` turns on the thermal camera. The **View** button zooms back out to the whole world.
- `?` opens the help.

Things to try:
- Pour lava into the pond and watch obsidian form as the water boils away.
- Drop a seed on the grass, then add a little water next to it.
- Use the Heat tool on the tree, or on a pile of sand.
- Pour oil on water, then set it on fire.
- Make a gunpowder pile and touch it with fire.
- Sprinkle salt into the pond, or onto ice. Then boil some salt water with the Heat tool.
- Pour water onto bare soil to make mud, drop a seed in it, or bake the mud into brick.
- Bury some wood under stone and heat it: with no air it turns into coal.
- Fill a hollow with lava and watch it set into stone from the bottom up.
- Drop a zombie next to a few people and watch the infection spread. Then set the zombies on fire.
- Throw a person into the pond, then into a pool of salt water.
- Bury someone in sand, or put a chicken on a pile of gunpowder and light it.

**About lava:** lava is about 1150 °C, just below the melting point of rock,
so it cannot melt through stone. Like real lava it is a poor conductor of
heat, so a small flow scorches wood without always setting it alight. It has
to give up a lot of heat before it sets, and it only sets where it rests on
something solid, so a pool hardens layer by layer from the bottom up and
stays molten on top for minutes.

**Materials added later:**
- **Salt, Mud, Salt water, Brick and Coal.**
- **Thermite** carries its own oxygen, so once it is lit (around 600 °C) it burns
  even underwater. It burns at about 2500 °C and leaves **Molten metal** behind.
- **Molten metal** cools and sets into **Metal** (casting). Metal heated past
  1500 °C melts back into it.
- **Rust:** metal touching water slowly rusts, and much faster in salt water.
- **Mercury** is the densest liquid (13,534 kg/m³). Sand, stone and even molten
  iron float on it. It boils away at 357 °C.
- **Honey** is a very thick, slow liquid.
- **Fuse** burns quickly along its length, carrying the flame from one end to the other.

**Machines** (in their own group in the palette):
- **Cloner:** touch it with any element and it starts making copies of that element.
- **Drain:** deletes whatever touches it, like a plughole.

**Weather:** the **Weather** button at the bottom switches between Sunny, Rain,
Storm and Snow. In a storm, lightning strikes every few seconds. It sets trees
on fire and fuses sand into glass where it hits.

**The newest additions:**

| | |
|---|---|
| **Gravel** | Small stones. Heavier than sand, piles up in steep heaps. |
| **Cement** | Flows slowly, then sets into **Concrete** after about ten seconds, even under water. |
| **Napalm** | Jellied fuel. Clings, burns at about 1300 °C for a long time, and floats on water, so water cannot put it out. |
| **Liquid nitrogen** | At -196 °C it boils away fast, freezing water (and creatures) it touches. |
| **Slime** | Very thick goo. Anything that falls in gets stuck. |
| **Cloud** | Drifts with the wind and rains, or snows when it is freezing. |
| **Wax** | Melts at 62 °C and burns slowly like a candle. |
| **Gold** | Never rusts and acid cannot touch it. Conducts electricity. Melts at 1064 °C. |
| **Nitroglycerin** | Liquid explosive. A hard bump sets it off, not just heat. Keep it in a cup! |
| **C4** | Plastic explosive. Safe to drop, but heat or a spark sets off a huge blast. |
| **Firework** | Light it and it rockets up and bursts into coloured stars. |
| **Fungus** | Creeps over damp ground and rots wood into more fungus. Glows faintly at night. |
| **Battery** | Sends pulses of electricity along metal or gold wires. You can watch the pulse run. Sparks set off gunpowder, fuses and C4, and a creature touching a live wire gets a shock. |
| **Lamp** | Lights up while a wire from a battery powers it. |

New tools: **Bomb** (`B`, click for an explosion; a bigger brush makes a bigger blast), **Lightning** (`L`, click to
call down a bolt) and **Wind** (`W`, hold to blow sand, water, smoke, fire and creatures away from the pointer).

**Day and night:** the moon button at the bottom switches between Day, Night, and Day & night (a full day every four
minutes). At night the sky fills with stars, fireflies come out, and anything glowing (fire, lava, lamps, live
wires, fireworks, fungus) lights up the dark.

**Smoother visuals:** the game now runs one physics step per screen frame (60 a second) so movement is even, zooming
glides smoothly, fire throws off embers, lava pops, splashes spray, explosions throw glowing debris and shake the
screen, and fireworks fill the sky with stars.

More things to try:
- Build a battery, a long metal wire and a lamp, then switch to Night.
- Lay a gold wire from a battery to a block of C4, and stand well back.
- Launch a row of fireworks at night.
- Pour cement into the pond and watch it set under water.
- Pour liquid nitrogen onto the pond.
- Drop a dog next to a few chickens.
- Put thermite on a metal plate and heat it.
- Drop sand onto a pool of mercury and watch it float.
- Lay a fuse from a fire to a pile of gunpowder.
- Put water on a cloner and make a fountain. Put a drain below it.
- Turn on the thermal camera to watch hot air rise.

---

## Why JavaScript, and what the game is built with

The game is written in **JavaScript** and runs in the web browser, with no
engine or library. Here is why:

- **Nothing to install to play.** Anyone with a browser can play it on Windows,
  Mac, Linux or a phone. You can share it with a link.
- **Fast enough.** A falling-sand game updates every cell many times a second.
  Modern browsers run JavaScript very fast. The engine also skips regions where
  nothing can happen (buried rock, calm water, ground at room temperature), so
  a step of the whole world takes well under a millisecond when it is calm,
  even with 40 creatures walking about.
- **Still means still.** Resting sand and calm water do not move at all, so
  nothing flickers or shimmers when nothing is happening.
- **No game engine needed for the physics.** Engines like Unity or Godot come
  with rigid-body physics (bouncing boxes). Falling-sand physics is a different
  kind of simulation that every sand game writes itself. A big engine would
  add a large install and a complicated editor without helping much.
- **Easy for a non-programmer to keep going.** The project is plain files with
  no build step. You can ask an AI assistant to change something and refresh the page.

---

## How the physics works

Each element has real properties: density (kg/m³), how well it conducts heat,
how much heat it holds, and the temperatures where it melts, boils, freezes or
catches fire. Many times a second, every cell:

1. **Changes phase** if it is hot or cold enough. Melting and boiling use
   latent heat, so ice stays at 0 °C while it melts and water stays at 100 °C
   while it boils.
2. **Reacts.** Fire needs air, water smothers it, acid eats most materials,
   plants drink water and grow, seeds sprout into trees, and gunpowder explodes.
3. **Moves.** Gravity speeds falling things up, denser things sink through
   lighter liquids, liquids flow sideways to level out, gases rise, and
   explosions throw debris in arcs.
4. **Shares heat** with its neighbours. Hot air rises (convection) and
   everything slowly cools toward room temperature (20 °C). Anything above
   about 525 °C glows.

---

## Project files

| File | What it does |
|---|---|
| `index.html` | The page: layout of the buttons and panels. |
| `styles.css` | The dark interface styling. |
| `src/elements.js` | Every element and its real-world numbers, plus the discoveries list. Change numbers here to change how things behave. |
| `src/world.js` | The physics engine. |
| `src/creatures.js` | The creatures: their ragdoll bodies, muscles, behaviour and everything that can hurt them. |
| `src/creatureArt.js` | Draws the creatures as pixel art, in the world and on the buttons. |
| `src/scenes.js` | How big the world is for your screen, and the starting scene (autumn pond, dock and trees). |
| `src/render2d.js` | Draws the world as pixel art, with zoom and the thermal camera. |
| `src/swatches.js` | Draws the little previews on the element buttons. |
| `src/main.js` | Buttons, mouse, touch, keyboard, weather and the game loop. |
| `server.js` | The small local web server started by `npm start`. |
