# Sandgrove

A falling-sand physics sandbox. You paint elements (sand, water, fire, oil,
lava, ice, plants, acid and more) and watch how they react. Everything follows
simple real-world physics: heavy things sink, liquids level out, heat flows
from hot to cold, and things melt, boil, freeze and burn at their real
temperatures.

There are two modes. Switch between them with the **2D / 3D** button at the top, or press **M**:

- **2D side view**: warm autumn pixel art with a pond, a wooden dock and trees.
- **3D voxel world**: a misty teal forest made of blocks. You can turn the camera around it.

There are 20 reactions to discover, such as obsidian, rain, glassmaking and
explosions. The **Discoveries** button in the top right keeps track of them.

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
| Camera | | Right-drag turns, scroll zooms, middle-drag moves, A and D keys orbit |
| Brush size | Scroll wheel, or the `[` and `]` keys | `[` and `]` keys |
| Touch | Drag a finger to paint | One finger paints, two fingers turn and zoom |

Everywhere:
- `1` to `0` pick elements. `E` is the eraser, `H` heat, `J` cool.
- `Space` pauses, `.` moves one step forward.
- `R` resets the scene and `C` clears it.
- `T` turns on the thermal camera (2D).
- `M` switches between 2D and 3D. `?` opens the help.

Things to try:
- Pour lava into the pond and watch obsidian and steam form.
- Drop a seed on the grass, then add a little water next to it.
- Use the Heat tool on the tree, or on a pile of sand.
- Pour oil on water, then set it on fire.
- Make a gunpowder pile and touch it with fire.
- Turn on the thermal camera to watch hot air rise.

---

## Why JavaScript, and what the game is built with

The game is written in **JavaScript** and runs in the web browser. The 3D mode
uses **three.js**, a well-known free 3D engine for the web. Here is why:

- **Nothing to install to play.** Anyone with a browser can play it on Windows,
  Mac, Linux or a phone. You can share it with a link.
- **One language for both modes.** The physics engine is shared: the 2D world
  is just a grid that is one cell deep, the 3D world is a full block of cells.
  Every rule (melting, burning, sinking...) works the same way in both.
- **Fast enough.** A falling-sand game updates every cell many times a second.
  Modern browsers run JavaScript very fast. Here the 2D world takes about 1 ms
  per step and the 3D world about 4–6 ms.
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
2. **Reacts.** Fire needs air (steam smothers it), acid eats most materials,
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
| `src/world.js` | The physics engine shared by both modes. |
| `src/scenes.js` | The starting worlds (autumn pond and forest glade). |
| `src/render2d.js` | Draws the 2D pixel-art view. |
| `src/render3d.js` | Builds and draws the 3D voxel world with three.js. |
| `src/textures.js` | Draws the pixel textures for the 3D blocks and the palette swatches. |
| `src/main.js` | Buttons, mouse, keyboard, switching modes and the game loop. |
| `server.js` | The small local web server started by `npm start`. |
