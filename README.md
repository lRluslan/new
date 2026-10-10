# Sandgrove

A falling-sand physics sandbox. You paint elements (sand, water, fire, oil,
lava, ice, plants, acid and more) and watch how they react. Everything follows
simple real-world physics: heavy things sink, liquids level out, heat flows
from hot to cold, and things melt, boil, freeze and burn at their real
temperatures.

There is **one world**, a block of 256 × 112 × 64 voxels (about 1.8 million cells), with one simulation
running all the time. You can look at it two ways. Switch with the **2D / 3D**
button at the top, or press **M**:

- **3D voxel world**: the whole world as a diorama, a floating island of blocks hanging in a starry
  teal sky with little islets and clouds drifting around it. Turn it to see it from every side,
  even from underneath, where its rocky base and hanging roots and crystals are. The sides of the
  island show the world in cross-section, so you can see the soil and stone layers.
- **2D side view**: one slice cut straight through the same world, drawn as warm autumn pixel art,
  like looking at the side of an ant farm. Move the cut forward and back with the **Slice** slider
  or the **W** and **S** keys.

Anything you paint in one view is in the other right away, because it is the
same world. Switching views never resets anything: fire keeps burning, water
keeps flowing and lava keeps cooling while you look from the other side.

Because the 2D view is a slice of a 3D world, things can move out of the slice.
Water poured on flat ground spreads out in depth too, so it gets thinner in
the side view, just as it really would.

There are 39 reactions to discover, such as obsidian, boiling, glassmaking, brickmaking, charcoal,
thermite, casting, rust, lightning, explosions, drowning and zombie infection. The **Discoveries** button in the top right keeps track of them.

### Creatures

The **Creatures** group in the palette has five kinds of little ragdoll creatures:

| | |
|---|---|
| **Human** | Walks about, runs from fire and zombies, swims until tired. Needs air. |
| **Zombie** | Shambles after people. A bite turns a person into a zombie a few seconds later. Does not breathe, so it walks along the bottom of ponds. Burns easily. |
| **Robot** | Heavy and tough. Fire hardly bothers it, but it sinks in water, leaks oil when hurt, and acid eats it fast. |
| **Chicken** | Scurries away from everyone. Light enough to float, and flaps its wings so falls do not hurt it. |
| **Fish** | Swims in water. On land it flops about and soon suffocates. |

Pick one and click to drop it in. With a creature or the **Grab** tool (`G`) selected, click and drag a creature to pick
it up. Let go to drop it, or flick the mouse to throw it. The **Eraser** (or right mouse) removes creatures.

They follow the same physics as everything else. Their bodies are made of joined parts (head, body, arms, legs) that
fall, tumble and collide. Sand piles up on them and can bury them, and water flows around them. They float or sink by
their real density: people barely sink in fresh water but float in salt water, robots sink, chickens bob on top.

What hurts them:
- **Falls and throws:** landing hard hurts. A fall of about 4 m (25 cells) badly hurts a person, about 7 m (40 cells) nearly kills them, and higher is deadly. Being thrown into a wall hurts the same way.
- **Fire** sets them alight. They panic and run, spreading the flames, until water puts them out. Burnt bodies crumble to ash.
- **Lava** kills in about a second.
- **Acid** eats at them slowly.
- **Water:** air breathers hold their breath for about 8 seconds, then drown. Swimmers tire after about 12 seconds.
- **Weight:** a heavy pile of sand, stone or metal on top crushes them, and so does being trapped inside a solid block.
- **Explosions and lightning.**

Hover over a creature to see its health. A small health bar appears over it after it gets hurt, and a "!" when it is scared.

The **Blood** button at the bottom turns blood and damage effects on or off. With it on, hurt creatures bleed real
blood (a liquid that flows and boils away like water), show wounds, and can lose limbs in big blasts or impacts. With it
off, they just flash when hurt.

Creatures dropped in the 2D view stay on that slice so you can keep watching them. Creatures dropped in 3D wander
anywhere, and only show in the 2D view while they are near the slice.

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

> **Internet:** the 3D engine and the fonts download from the internet the
> first time you play. The 2D mode still works offline.

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

| | 2D side view | 3D voxel world |
|---|---|---|
| Paint | Left mouse | Left mouse |
| Erase | Right mouse, or the Eraser tool | Eraser tool |
| Slice | Slice slider, `W` and `S` (or arrow up and down) | `W` and `S` (the slice flashes in yellow) |
| Camera | | Right-drag turns all the way around (even underneath), scroll zooms toward the mouse, middle-drag moves, A and D keys orbit |
| Zoom | Scroll wheel or pinch (zooms toward the mouse), `+` and `−` keys | Scroll wheel or pinch, `+` and `−` keys |
| Move around | Middle-drag, or drag with two fingers | Middle-drag |
| Brush size | Shift + scroll, or the `[` and `]` keys | `[` and `]` keys |
| Creatures | Pick one and click to drop it in. Drag one to carry or throw it | The same, in the orbit view and in fly mode (aim with the crosshair) |
| Touch | Drag a finger to paint | One finger paints, two fingers turn and zoom |

**Fly mode (3D, like creative mode in block games).** Press **Tab** (or the
**Fly** button) to switch between the orbit view and a free camera:

- Move the mouse to look around. The first click captures the mouse; **Esc** frees it.
- **W A S D** move, **Space** flies up, **Shift** flies down. You speed up the longer you hold a direction,
  and you can fly anywhere, even through the ground.
- A crosshair shows where you aim, and the block under it is outlined.
- **Left click** places the selected element against the face you aim at, **right click** removes,
  **middle click** picks up the element you aim at. Hold a button to keep building.
- **Scroll** (or `[` and `]`) sets the size: 0 means one block at a time.
- **Tab** goes back to the orbit view, looking at where you were.

If the page is not allowed to capture the mouse (some embedded pages), drag with the left mouse button to look around instead, and click without dragging to place.

Everywhere:
- `1` to `0` pick elements. `E` is the eraser, `H` heat, `J` cool, `G` grab.
- `Space` pauses, `.` moves one step forward.
- `R` resets the world and `C` clears it (in either view, since there is one world).
- `T` turns on the thermal camera (2D).
- `M` switches between 2D and 3D. `?` opens the help.

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
- **Fuse** burns slowly along its length, so you can light one end and stand back.

**Machines** (in their own group in the palette):
- **Cloner:** touch it with any element and it starts making copies of that element.
- **Drain:** deletes whatever touches it, like a plughole.

**Weather:** the **Weather** button at the bottom switches between Clear, Rain,
Storm and Snow. In a storm, lightning strikes every few seconds. It sets trees
on fire and fuses sand into glass where it hits.

More things to try:
- Put thermite on a metal plate and heat it.
- Drop sand onto a pool of mercury and watch it float.
- Lay a fuse from a fire to a pile of gunpowder.
- Put water on a cloner and make a fountain. Put a drain below it.
- Turn on the thermal camera to watch hot air rise.

---

## Why JavaScript, and what the game is built with

The game is written in **JavaScript** and runs in the web browser. The 3D mode
uses **three.js**, a well-known free 3D engine for the web. Here is why:

- **Nothing to install to play.** Anyone with a browser can play it on Windows,
  Mac, Linux or a phone. You can share it with a link.
- **One language, one world.** Both views draw the same voxel grid, run by the
  same physics engine, so every rule (melting, burning, sinking...) is
  identical whichever way you look at it.
- **Fast enough.** A falling-sand game updates every cell many times a second.
  Modern browsers run JavaScript very fast. The engine skips regions where
  nothing can happen (buried rock, calm water, ground at room temperature),
  so a step of the whole 1.8-million-cell world takes under 1 ms when it is
  calm, and around 10 ms in the middle of a big fire. The 3D view only
  rebuilds the 16×16×16 blocks that changed, and only draws the ones in view.
- **Still means still.** Resting sand and calm water do not move at all, a
  voxel's shading is fixed by its position, faces that touch are never drawn
  twice, and textures are mipmapped, so the 3D world does not flicker or
  shimmer when nothing is happening or when the camera turns.
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
| `src/world.js` | The physics engine: the one world both views show. |
| `src/creatures.js` | The creatures: their ragdoll bodies, muscles, behaviour and everything that can hurt them. |
| `src/creatureArt.js` | Draws the creatures as pixel art for the 2D view and the palette. |
| `src/scenes.js` | The world size and the starting scene (autumn pond, dock and trees). |
| `src/render2d.js` | Draws one slice of the world as 2D pixel art. |
| `src/render3d.js` | Draws the whole world as 3D voxels with three.js, plus the forest around it. |
| `src/textures.js` | Draws the pixel textures for the 3D blocks and the palette swatches. |
| `src/main.js` | Buttons, mouse, keyboard, switching modes and the game loop. |
| `server.js` | The small local web server started by `npm start`. |
