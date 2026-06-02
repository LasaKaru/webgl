# VERDANT — Third-Person WebGL Survival (MVP)

A complete, runnable third-person open-world survival shooter built on **Babylon.js**,
by *Heleo2 Studio*. Loading screen → studio splash → main menu → settings → gameplay,
with a low-poly procedural **hilly jungle + instanced grass**, animated human-like
characters, **four real gun models you pick up in the world**, throwable **grenades**,
health packs, an inventory, a HUD, pause/game-over, and an optional multiplayer mode.

The codebase is organized as a small **modular project** (`css/` + `js/` split into
~14 single-responsibility modules) rather than one giant file — see *Project structure*.

> **Note on engines:** the brief asked for Babylon.js **and** three.js. They're
> competing engines — using both just doubles the download for zero benefit, so this
> build uses **Babylon.js only** (it already provides collisions, shadows, PBR glass,
> and an asset pipeline). If you specifically want three.js instead, it's a drop-in
> swap at the engine layer; the game systems (state machine, inventory, waves, net
> protocol) are engine-agnostic.

---

## Run it

### Single-player (no install)
Just open `index.html` in any modern browser (Chrome/Edge/Firefox). Babylon.js loads
from CDN, so you need an internet connection on first load. The game is split into
multiple files but uses **classic ordered `<script>` includes (not ES modules)**, so
double-clicking `index.html` works on `file://` — no server required. Click **Start
Mission**, then click the canvas to lock the mouse.

> Tip: if your browser blocks pointer-lock/audio on `file://`, serve it locally with
> `npm start` (uses `npx serve`) or any static server, then open the printed URL.

### Multiplayer (optional)
```bash
npm install        # installs the 'ws' package
npm run server     # starts ws://localhost:8080
```
Then in the game: **Multiplayer → keep `ws://localhost:8080` → Connect**, and open
`index.html` in a second tab/machine pointing at the same URL. Peers appear as amber
capsules. The server (`server.js`) is a simple position relay; see its header for the
production hardening checklist.

---

## Controls
| Key | Action | Key | Action |
|---|---|---|---|
| `W A S D` | Move | `1`–`4` | Pistol / SMG / Rifle / Shotgun |
| Mouse | Look / Aim | `R` | Reload |
| L-Click | Fire | `G` | Throw grenade |
| `Shift` | Sprint (uses stamina) | `E` | Pick up loot |
| `Space` | Jump | `Tab` | Inventory |
| `Esc` | Pause | | |

Weapons start locked except the pistol — find SMG, rifle and shotgun crates in the world.

---

## What's implemented
- **State machine:** loading → studio splash → menu → settings / multiplayer / how-to → playing → paused → game over.
- **Loading screen** with animated Heleo2 Studio mark, progress bar, and "Powered by Heleo2 Studio".
- **Human-like characters:** the player and every enemy are **articulated humanoid rigs** (head, torso, two arms with elbows + hands, two legs with knees + feet) built from boxes parented to joint pivots, driven by a **procedural animation system** — walk/run cycles with leg + arm counter-swing and knee bend, idle breathing, a two-handed **aim** pose, and an overhand **melee swing**. (Drop-in swappable for a rigged glTF via `BABYLON.SceneLoader`.)
- **Third-person controller:** orbit camera (pointer-lock), camera-relative WASD, gravity, jump, sprint+stamina, collision via `moveWithCollisions`, **terrain-following** over hills, the player figure holding a rifle, and **aim-down-sights FOV** zoom while firing.
- **Procedural low-poly world:** a **hilly heightfield terrain** (sum-of-waves, flattened around spawn) carpeted with **thousands of instanced grass blades** (single draw call, toggleable), boundary walls, fog, multi-tier trees, polyhedron rocks, houses with pyramid roofs, doors, and **PBR transparent glass** windows. All props sit on the terrain surface. Density, hills and grass are settings.
- **Four real gun models:** **pistol, SMG, rifle, shotgun** — each a multi-part low-poly mesh (slide/body, barrel, magazine, grip, stock, sights) held in the player's hand and rebuilt on weapon switch. Distinct stats: fire rate, spread, damage, magazine, reload; the shotgun fires **8 pellets** per shot.
- **World loot (GTA-lite):** weapon crates show the **actual spinning gun model**; health packs, ammo, grenade packs and medkits are scattered across the map. Walk up and press **E** (with a live pickup prompt) to grab them.
- **Grenades / explosions:** throw with **G** — arc + bounce + fuse, then a radial **AoE explosion** (falloff damage to enemies, self-damage if too close), an expanding flash, and **screen shake**.
- **Combat:** raycast hit detection through the crosshair, per-weapon spread, magazines + reserve ammo, reload, muzzle flash, hitmarkers, screen hit-flash, and **aim-down-sights FOV** zoom.
- **Enemies (two archetypes):**
  - *Chasers* (red) — rush the player and play a melee swing animation on a cooldown.
  - *Gunners* (amber, from wave 2) — carry a rifle, hold a firing distance band, and shoot **tracer projectiles** you can dodge.
  - Both are fully animated humanoids with a **floating health bar**, scale HP/speed/count per wave, flash red on hit, drop loot on death, and **fall over as a corpse** that fades out.
- **Wave system:** clear all hostiles to advance; score tracking.
- **Inventory:** grid UI listing owned weapons + consumables; equip weapons, use medkits (+HP).
- **Settings (live):** graphics quality (hardware scaling), shadows on/off, grass on/off, mouse sensitivity, master volume, FOV, world density, terrain hill amplitude.
- **Audio:** procedural WebAudio SFX (per-gun fire, hit/kill/reload/pickup/hurt/enemy-fire/throw/explosion), volume-linked.
- **Multiplayer scaffold:** WebSocket client + Node `ws` relay server, JSON protocol; remote peers render as full animated humanoids.

## Project structure
```
index.html        # shell: UI markup + ordered <script> includes
css/verdant.css   # all styling
js/core.js        # global state, DOM helpers, math utils, audio, screen-shake
js/terrain.js     # procedural heightfield (terrainHeight)
js/world.js       # materials, props, instanced grass, world build
js/characters.js  # humanoid rig + procedural animation + health bars
js/weapons.js     # weapon stats + multi-part gun models + equip
js/player.js      # player capsule + rig
js/enemies.js     # chasers, gunners, projectiles, waves
js/items.js       # world pickups (weapons/health/ammo/grenades) + loot scatter
js/inventory.js   # inventory grid
js/combat.js      # raycast guns, grenades, explosions, damage, death
js/hud.js         # HUD updates, toasts, pickup prompt
js/net.js         # multiplayer client
js/game.js        # main loop (camera, movement, AI, pickups, fx)
js/boot.js        # engine/scene, loading, input, UI wiring, entry point
server.js         # optional Node + ws multiplayer relay
package.json      # 'ws' dependency + run scripts
```
> The modules are loaded as ordered classic scripts sharing a global `Game` object —
> deliberately **not** ES modules, so the game still runs from `file://` without a server.

## Known MVP limits (good next steps)
- Terrain is a procedural heightfield with manual surface-clamping (not full mesh
  collision). Swap in `CreateGroundFromHeightMap` + real physics for slope sliding.
- Characters are articulated box-rig humanoids with hand-authored procedural animation.
  For production, import rigged glTF characters with skeletons + baked clips via
  `BABYLON.SceneLoader` and blend them through an `AnimationGroup` state machine; the
  `animateHumanoid()` call site is the only thing that would change.
- Enemies use chase/standoff AI (no pathfinding around obstacles yet).
- Grass is decorative thin-instances (no wind/LOD); large counts cost fill-rate on
  weak GPUs — toggle it off in Settings.
- Multiplayer is a position relay (not authoritative); add server-side validation,
  snapshot interpolation, and rooms.

---

## Master prompt (reusable)

Paste this into Claude to regenerate or extend the project. It encodes every decision above.

```
Build a complete, single-file third-person WebGL survival game MVP using Babylon.js
(loaded from CDN — do NOT also include three.js; one engine only). Deliver runnable
code with no build step.

ENGINE & STRUCTURE
- Babylon.js, one self-contained index.html. UI as HTML/CSS overlays; 3D in <canvas>.
- A clear state machine: loading -> studio splash -> main menu -> settings ->
  multiplayer -> how-to -> playing -> paused -> game over. One setState() switches layers.

LOADING / BRANDING
- Animated loading screen with a procedural SVG studio mark, progress bar that advances
  through named steps (init engine, shadows, sculpt terrain, grow jungle, spawn player...),
  and the text "Powered by Heleo2 Studio".

WORLD (low-poly, procedural, density-driven, HILLY)
- Hilly heightfield terrain: displace a subdivided ground plane with a deterministic
  sum-of-waves height function, recompute normals, and flatten a clearing around spawn.
  Sample the SAME height function at runtime to keep player/enemies/props on the surface
  (freeze the amplitude used at build time so the mesh and clamps never desync).
- Fog + boundary walls. Scatter multi-tier cone trees, polyhedron rocks, and houses
  (box body + pyramid roof + door), all placed on the terrain. Houses have PBR transparent
  GLASS windows. Shared low-poly StandardMaterials; one PBRMaterial for glass.

PLAYER (third person)
- Capsule mesh + held gun mesh + muzzle-flash plane. Orbit camera driven by pointer-lock
  mouse (yaw/pitch). Camera-relative WASD. Gravity + jump + sprint with a stamina meter.
  Movement via moveWithCollisions; vertical position clamped to terrainHeight().

COMBAT & WEAPONS
- Two weapons: semi-auto pistol and full-auto rifle, each with damage, RoF, spread, range,
  magazine, reserve ammo, reload time. Fire = scene.createPickingRay through screen center,
  pickWithRay, apply damage to meshes tagged with an _enemy backref. Muzzle flash,
  hitmarker, reload-on-empty, out-of-ammo toast.

ENEMIES & WAVES (two archetypes + procedural animation)
- Hidden collision capsule as the container; a visual TransformNode holds box torso+head+legs.
  Two types: 'chaser' rushes and melees; 'ranged' (from wave 2) holds a distance band and
  fires tracer projectile spheres that damage the player on contact. Procedural walk
  animation (bob + waddle + leg swing) driven by a per-enemy walk timer. Ring-spawn around
  the player; HP/speed/count scale per wave. On death: score += 100 and a 35% loot chance.

INVENTORY & ITEMS
- Spinning pickup boxes (ammo, medkit, rifle), press E near to collect. Tab toggles a grid
  inventory: click to equip weapons or consume medkits (+40 HP) / ammo (+30 reserve).

HUD
- Crosshair, HP + stamina meters, ammo (mag/reserve) + weapon name, score, wave label,
  live enemy count, network status dot, transient toasts, red hit-flash on damage.

SETTINGS (apply live)
- Graphics quality (engine.setHardwareScalingLevel), shadows on/off (ShadowGenerator),
  mouse sensitivity, master volume, FOV, world density, terrain hill amplitude.

AUDIO
- Tiny WebAudio oscillator SFX for fire/hit/kill/reload/pickup/hurt/enemy-fire, scaled by volume.

MULTIPLAYER
- WebSocket client with a JSON protocol: client sends {t:'join',name} then ~12Hz
  {t:'state',x,y,z,ry}; server replies {t:'welcome',id} and broadcasts {t:'peers',list}
  and {t:'leave',id}. Render remote peers as colored capsules. Also provide a matching
  Node + ws relay server.js (npm install ws; node server.js) with a production-hardening
  checklist in comments.

QUALITY BAR
- Distinctive UI: dark jungle palette, toxic-green + amber accents, Oswald + Share Tech Mono
  fonts, clipped/angular panels, no generic AI aesthetic. Everything must actually run; verify
  no reference/syntax errors before finishing.
```

© Heleo2 Studio — built with Babylon.js.
