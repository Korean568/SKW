# ★★ CONTRACT v3 — STORY MODE (read this block first; it overrides everything below where they conflict)

The product changed direction. The user's game is **"Second Korean Wars — 스토리 1 · 서강시: 전쟁의 시작 (대한민국편)"**, a story-driven first-person game. The script is `story1.txt` in this folder (read it). Story 1: six ROK soldiers on leave ride an airliner; a North Korean missile hits it; it goes down and crash-lands; North Korean soldiers storm the wreck; the player (김민철 하사, first person) and the squad fight 50 of them in and around the crashed airliner. The user explicitly rejected **blocky** characters and scenery (a previous attempt looked like boxes): everything must be smooth, organic and believable — the quality bar is still the single-file WebGPU demo "Abyssal Garden" (dense, cinematic, art-directed, anti-aliased, no visible artefacts). No model files, no image files, no sound files: all procedural. The shipped file is a self-extracting single HTML (≈70-95 KB packed), so write readable, commented source but spend bytes wisely.

The naval game still exists as a second mode and must keep working untouched: `G.mode` is `'story'` (default) or `'naval'` (`?mode=naval`). `G.register(name, mod, mode)` registers hooks only when `mode` is omitted or equals `G.mode`. Naval-only modules: ocean, models, game. Story-only modules (new): **people, cabin, fps, story** — register with `'story'`. Shared: core, gpu, sky, post, mesh, fx, audio.

## Story-mode engine facts (core.js is the source of truth)
- Units metres, +Y up, right-handed. Model/plane axes: **forward +Z, up +Y, left (port) +X** (`M4.trs(pos, yaw, pitch, roll, scale)`; yaw 0 faces +Z).
- Camera: the story/fps module writes `G.cam.pos / target / up / fov / near` every frame (`near` 0.08 indoors). Projection is reversed-Z with infinite far plane.
- Shadows: sun shadow map on HIGH (4096²) **and on MEDIUM in story mode (2048²)**, none on LOW. The game sets `G.shadowFocus` (world point) and `G.shadowRange` (half-extent in metres, e.g. 30 inside the cabin). Render your casters in the `shadow(pass)` hook with `g.shadowVP`.
- Indoor factor: `G.setEnv({indoor: 0..1})` → WGSL `g.wind.w`. Shared lighting helpers (use them so people and scenery match): `sunAt(P, N)` = direct-sun visibility (shadow map × cloud shadow; returns 0 indoors on tiers without a shadow map, so the sun never shines through walls), `ambAt(N)` = sky hemisphere ambient (only 12% indoors), `pointLights(P, N)` = up to 4 dynamic point lights (cabin lamps, muzzle flashes, fire; the game re-adds persistent lamps every frame with `G.addLight(pos, rgb, intensity, radius, life)`), `skyBase(dir)` for reflections, and **always finish with `fogAt(col, P)`**.
- Pass A hooks `opaque(pass)` / `sky(pass)`; pass B `transparent(pass)` (blended, depth test, no depth write: glass, particles). MSAA: every pipeline used in those hooks needs `multisample: {count: G.Q.msaa}` and must be rebuilt in `onQuality(Q)` when the count changes (1 on LOW, 4 otherwise). `G.layout(...bgls)` gives a pipeline layout with the shared group 0; `G.shader(code, label)` prepends the shared WGSL.
- There is no ocean in story mode. Below the horizon the sky module draws haze/ground; scenery modules own their ground.
- Tiers: LOW must stay cheap (integrated GPU, 0.75x scale, no MSAA, no shadow map), MEDIUM solid, HIGH spectacular. Everything keys off `G.Q` (`level` 0/1/2, `msaa`, `shadows`).
- Never throw from a hook; report problems with `G.err(msg)`. `G.errors` must stay `[]` on LOW, MEDIUM and HIGH, across preset switches and resizes. APIs listed below must exist at module load time (top level), before `init`.

## New cross-module APIs (fixed names)

### people — `mod_people.js` (smooth skinned human characters; owns its own pipelines and shaders)
`G.people.add(kind, o)` → person `P`. Kinds: `'rok'` (ROK Army soldier: digital-camouflage combat uniform, patrol cap), `'mask'` (the colonel "마스크 대령": same uniform, black face mask covering nose and mouth), `'nk'` (KPA soldier: olive-khaki uniform, steel helmet or peaked cap by seed, chest webbing, AK-type rifle), `'civ'` (airline passenger in civilian clothes, colours by seed). `o` = initial fields.
Person fields the game reads/writes every frame (plain data, no setters): `p:[x,y,z]` feet position (world), `yaw`, `pose`, `look:[x,y,z]|null` world point the head/eyes turn to, `aim:[x,y,z]|null` world point the weapon points at, `talk` 0..1 (speaking: head/hand gestures, jaw), `gun` `0|'pistol'|'rifle'|'ak'`, `seed`, `hp`, `dead`, `M` optional parent mat4 (e.g. the aircraft transform — when set, `p`/`yaw` are in that parent space), `vis` (false = skip drawing).
Poses (procedural animation; the module blends smoothly, ≥0.2 s, whenever `pose` changes, and animates within a pose from `G.time`): `'sit'` (airline seat, hands on lap/armrest, breathing, small idle motion), `'sleep'` (seated, reclined, head tilted, eyes closed), `'brace'` (seated crash position / flinching, arms over head), `'stand'`, `'walk'`, `'run'` (speed from position change), `'stumble'` (loses balance, falls to hands and knees, gets back up: one-shot ≈2.5 s then `'stand'`), `'aim'` (weapon shouldered toward `aim`), `'fire'` (aim + recoil kick), `'crouch'` (kneeling behind cover, can still aim), `'hit'` (flinch, one-shot 0.4 s), `'dead'` (collapses and stays down; slumps in the seat if it was sitting; varied by seed).
`G.people.remove(P)`, `G.people.clear()`. `G.people.eye(P)` → world eye position; `G.people.muzzle(P)` → world muzzle position + direction `[x,y,z,dx,dy,dz]`. `G.people.ray(o, d, max)` → `{P, t, part}` or `null`: nearest hit of a world ray against living persons (capsule tests; `part` = `'head' | 'body' | 'limb'`). `G.people.list` = array of persons.
First-person view model: `G.people.fp = {on, gun, aim (0..1 ADS), kick (recoil 0..1), reload (0..1 progress or 0), bob, sway:[x,y]}` — when `on`, draw the player's forearms/hands and weapon in front of the camera (own depth range so it never clips into walls).
Budget: 60 persons visible on HIGH at 60 fps on an RTX 4070; LOW must cope with ~25.

### cabin — `mod_cabin.js` (the airliner inside and out, and the crash site; owns its own pipelines and shaders)
A single-aisle airliner (A321/B737 class): cabin floor width ≈3.5 m, 3+3 seats, 30 rows at ≈0.8 m pitch, aisle along Z. **Plane space**: origin on the cabin floor centreline at mid-cabin, +Z toward the nose, +X = left (port) side, floor at y = 0.
`G.cabin.place(pos, yaw, pitch, roll)` sets the aircraft's world transform; `G.cabin.M` (Float32Array 16) is that matrix (the game passes it as `P.M` to seated persons); `G.cabin.w(p)` plane→world point, `G.cabin.l(p)` world→plane point.
`G.cabin.seat(row, col)` → `{p:[x,y,z], yaw}` hip point of a seat in plane space (rows 1..30 from the nose, cols `'A'..'F'`, A = left window, C/D = aisle, F = right window; seats face +Z).
`G.cabin.K` key points in plane space: `{hole:[x,y,z] (centre of the blast hole: LEFT wall beside seat 12A), lavF, lavA (lavatory doors front/aft), doors:[..] (exit door centres), aisle:[zMin, zMax], tail:[..] (centre of the fuselage break in the crash state), spawn:[[x,y,z],..] (≥6 enemy entry/spawn points for the crash state, in WORLD space after the crash placement, outside the wreck), cover:[[x,y,z,hx,hy,hz],..] (cover boxes at the crash site, world space)}`.
`G.cabin.S` state the game mutates (the module reacts smoothly): `{hole: 0..1 (blast hole in the left wall: torn skin, missing seats 11A-13B, daylight and wind), gear: 1|0 (landing gear present; it is seen falling away in an exterior shot), power: 0..1 (cabin lighting; flickers below 1), masks: 0|1 (oxygen masks dropped), tilt: handled by place(), crash: 0|1 (crash-site dressing: fuselage broken open aft of the wing at K.tail, doors open, debris, ground scars), tv: 0|1 (seat-back screens on)}`.
`G.cabin.screen(canvas)` uploads a 2D canvas (512×288) shown on every seat-back screen (the story draws a news broadcast on it).
`G.cabin.collide(p, r)` → corrected plane-space position for a capsule of radius `r` standing at `p` (fuselage walls, seat rows, galley/lavatory blocks, the hole and breaks are passable in the crash state). `G.cabin.ray(o, d, max)` → distance of the first hit of a plane-space ray against the static geometry (walls, floor, seats as boxes), or `max`. `G.cabin.ground(x, z)` → world ground height at the crash site.
Draws: the exterior airliner (fuselage, wings, engines, tail, livery, lit windows, landing gear) for outside shots, the complete interior for first-person views (seats with cushions and headrests, carpeted aisle, side-wall panels with real window openings that show the sky, overhead bins, ceiling light strips, seat-back screens, lavatory/galley walls and doors), and in the crash state the site: ground with grass/soil, skid trench, torn-off engine/wing parts, scattered luggage and debris, treeline/hills on the horizon.

### fps — `mod_fps.js` (first-person combat; the fight after the cutscene)
`G.fps.start(o)` with `o = {pos (world), yaw, allies:[persons], total: 50, onEnd(win)}`; `G.fps.stop()`; `G.fps.on` (bool); `G.fps.S` = `{hp, ammo, mag, kills, total, alive}`. Owns: pointer-lock mouse look, WASD + Shift sprint + C/Ctrl crouch, left click fire, right click aim, R reload, E pick up; pistol at the start, AK rifles and ammunition dropped by enemies; hitscan with spread/recoil against `G.people.ray` and `G.cabin.ray`; enemy director (50 KPA soldiers in waves from `G.cabin.K.spawn`, entering through the hole, the doors and the tail break; they advance, use cover, aim with a reaction delay and miss often enough to be fair); allies that fight alongside; player damage with regeneration; the combat HUD (crosshair, hit marker, ammo, health vignette, "북한군 n / 50", objective line); calls `onEnd(true|false)`.

### story — `mod_story.js` (title screen, cutscene script, dialogue, scene direction, flow)
Owns the title/menu, the data-driven script of Story 1 (`G.STORY`), the dialogue box (speaker name + line, auto-advancing — the user's rules: text in parentheses is an ACTION to be shown on screen, never printed as dialogue; narration is not dialogue and goes in a separate caption style), cameras (first person from 김민철's seat with limited mouse look, plus exterior shots), staging of people and cabin state, the news broadcast canvas, the crash sequence, the hand-over to `G.fps.start`, and the ending card. Test hooks: `G.story.go(name)` jumps to a named beat (`'cruise' | 'talk' | 'hit' | 'fall' | 'news' | 'crash' | 'board' | 'fight' | 'end'`), `G.story.S` = state, URL params `scene=<name>`, `autostart`, `nohud`, `god`.

### sky / fx / audio additions in story mode
sky: the cruise scenes look DOWN on the cloud layer from above (camera 3-4 km up) — clouds must render correctly from above and inside the layer, and below the horizon there must be a plausible hazy ground/sea far below instead of a flat fog colour. fx: existing `burst/trail/tracer` API; story-mode kinds may be added (`'dust'`, `'blood'`, `'debris'`). audio: existing API; story-mode sounds may be added (`'rifle'`, `'pistol'`, `'reload'`, `'crash'`, loops `'cabin'`, `'wind'`, `'alarm'`). `G.sfx.play` ignores unknown names.

## Dev tools (this folder)
`node shot.js "step&mods=<list>&q=HIGH" out.png --frames N --dt s [--w --h] [--pre "JS" | --prefile setup.js] [--eval "JS"]` — headless Chromium on a CPU rasteriser (SwiftShader: slow, timings meaningless); `--pre/--prefile` runs before the frames (build your test scene there: place the camera with `G.cam.pos/target/near/fov`, call `G.setEnv({...})`, your module's API …), `--eval` after them; prints `G.errors` and the console. `mods` = comma list of real modules to load from this folder (`all` = everything present); `stubs.js` fills gpu/sky/post when absent. READ your renders with the Read tool and judge them harshly: smooth silhouettes, believable proportions and materials, no boxes.
# ★ CONTRACT v2 — read this block first; it overrides anything below that conflicts

The first version of every module exists and the game is live. This round is a **quality uplift**: the user wants the visual quality raised to the level of the viral single-file WebGPU demo "Abyssal Garden" (dense, cinematic, art-directed, anti-aliased, stable, no visible artefacts). The engine core changed to support that. Work in **`source/`** (this folder, served at `http://localhost:8765/source/`; `shot.js` here already points to it). `dev/` is the old tree — do not use it, except for reading `../dev/REFERENCE_DIGEST.md` if it exists (a technique digest of the reference demo with a per-module "Transfer plan"; check for it when you start and once more before your final polish pass).

## What changed in core (see `core.js`)
1. **4× MSAA.** `G.Q.msaa` is `1` (LOW) or `4` (MEDIUM, HIGH). Passes A and B (hooks `opaque`, `sky`, `water`, `transparent`) now render into multisampled colour+depth when `msaa > 1`. **Every pipeline used in those hooks must set `multisample: { count: G.Q.msaa }`** and must be re-created when `G.Q.msaa` changes: create scene pipelines in `onQuality(Q)` (cache the last sample count; rebuild only when it differs), not once in `init()`. The shadow pass, compute passes and your private passes stay single-sample. A pipeline with the wrong sample count is a validation error on every frame — test the switch sequence LOW→HIGH→LOW→MEDIUM.
2. **Targets.** `G.targets.hdrView` = resolved single-sample final scene colour and `G.targets.depthView` = resolved single-sample final scene depth; both are valid for sampling inside `post.run` (depth: `texture_depth_2d`, reversed-Z, sky = 0). `hdrCopyView` / `depthCopyView` (opaque-only colour/depth, single-sample, only when `G.Q.refract`) keep their meaning for pass B. Never bind `G.targets.ms*` yourself.
3. **Dynamic resolution.** `G.dyn` (0.5–1) scales the render size at runtime; `onResize()` can now be called often (every couple of seconds). It must be cheap and leak-free: destroy and recreate only size-dependent textures/bind groups. Never cache `G.targets.w/h` outside `onResize`.
4. `G.gpuMs` = measured GPU frame time when `timestamp-query` is available (else 0).
5. Sun shadow map is 4096² on HIGH with a 900 m depth range; `shadowAt()` fades out at the map edge.
6. `G.Q` also has `level` 0/1/2 as before; nothing was removed from the API.
7. **Shared cloud-shadow map (added mid-round — optional to use this round).** WGSL `cloudVis(P) -> f32` (1 = sunlit, 0 = fully cloud-shadowed, returns 1 when no map is registered) samples `cloudTex` (group 0 binding 5). The sky module may register a map with `G.setCloudMap(view, sizeMetres)` (call only when the view changes; it rebuilds `G.bg0`) and move its centre every frame via `G.cloudMap.x / .z` (world xz, texel-snapped). The map is indexed by *ground* position (bake the sun-direction shear in). Consumers (ocean sun term/glitter, mesh direct light, particles, shafts) multiply their direct sun light by `cloudVis(P)`. **Never cache `G.bg0` / `G.bg0s`** — read them at use time.
8. `fogAt()` is now per-channel aerial perspective with height falloff and clamps its result to ≤ 40; keep calling it last.

## Build is now minified (the shipped file is ~100 KB **after** minification)
`build.js` collapses whitespace and strips `//` comments inside WGSL template literals and minifies JS with esbuild inside one closure. Consequences:
- Size caps are on **readable source** and were raised (your brief gives your cap). Write readable, commented code — it is minified away.
- WGSL must not depend on newlines. A WGSL fragment that is concatenated or `${}`-interpolated into another must not end with a `//` comment. Never write `a - -b` style code that changes meaning when spaces are removed (`a--b`).
- Don't rely on function/class `.name`, `toString()` of functions, or globals other than `G`, `V3`, `M4` (they exist only inside the closure; `window.G` is kept for tests).

## Quality bar for this round
- No aliasing crawl, shimmer, popping, banding, hard sprite edges, z-fighting, or visible tiling at normal play distances (camera 90–2500 m from the ship, also the low cinematic angles). MSAA handles geometry edges; **shader aliasing is your job** (fade/filter high-frequency normals, specular and foam with distance or screen-space derivatives; dither gradients).
- Art direction: cinematic naval look — believable physically-motivated lighting, strong atmosphere and depth, rich but controlled colour (deep teal/blue sea, warm sun, cool shadows), detail that holds up in a close hero shot of the destroyer and in wide shots.
- HIGH should be spectacular on an RTX 4070 at 1440p (≤ ~5 ms GPU for your module), MEDIUM solid on a GTX 1660 at 1080p, LOW still clean and cheap on an Intel Iris Xe at 720p. Fill-rate counts 4× less than you think with MSAA only at edges, but blended overdraw into a 4× target is expensive: keep big translucent sprites under control.
- Zero per-frame JS allocations in your hot paths where practical (preallocate typed arrays, reuse objects).
- Everything from v1 still applies (API names, hooks, conventions, verification loop, `G.errors` must stay `[]` on all presets and across preset switches and resizes).

---

# SKW Naval — module contract (read fully before writing code)

## 0. What we are building
A single-file (`index.html`, ~100 KB total) **WebGPU** 3D naval/air counter-attack shooter prototype. Pure JavaScript + WGSL + Web Audio.
**No** external engine, model, image texture, sound file, font or CDN. Everything is procedural.
Player commands a ROK Navy Aegis destroyer against enemy ships, jets and anti-ship missiles (scenario is supplied later; the engine must be generic).
The final file is produced by concatenating `core.js` + `mod_*.js` into one `<script>` (see `build.js`). Each module is developed in isolation against stubs.

Directory: this file's folder. Served at `http://localhost:8765/source/` (if the server is down: `python3 ../serve.py 8765 &` from this folder).

| file | owner | purpose |
|---|---|---|
| `core.js` | lead (read-only for you) | math, WebGPU init, presets, globals uniform, frame graph, shared WGSL. **Source of truth — read it.** |
| `stubs.js` | lead (read-only) | dev-only minimal stand-ins for every module that is not loaded + a demo scene. Not shipped. |
| `dev.html` | lead (read-only) | harness: `dev.html?mods=a,b` loads `mod_a.js`,`mod_b.js`, stubs fill the rest |
| `shot.js` | lead (read-only) | headless screenshot/inspection tool |
| `mod_<name>.js` | **you** | your module. Only write your own module file(s) and scratch files inside `work_<name>/`. |

Never edit `core.js`, `stubs.js`, `dev.html`, `shot.js`, `build.js`, or another module's file. If you need a core change, describe it in your final report (`coreRequests`) and work around it locally.

## 1. Testing (mandatory, iterate until clean)
```
node shot.js "step&mods=ocean&q=HIGH&cam=35,12,300,12" work_ocean/a.png --frames 20 --w 960 --h 540
node shot.js "step&mods=models&show=aegis&cam=120,10,260"  work_models/aegis.png --frames 2
node shot.js "mods=fx" --wait 3000 --eval "G.fps"            # realtime loop (no screenshot possible, see below)
```
- First arg = query string for `dev.html` (or a full URL). `step` = deterministic stepping: runs `--frames N` frames of `--dt` seconds (default 1/30) then captures. **Screenshots only work with `step`** (the headless WebGPU canvas is not composited; `step` renders to an offscreen texture and reads it back).
- Query params: `q=LOW|MEDIUM|HIGH` forces a preset, `cam=azimuthDeg,elevationDeg,distance[,targetY]` fixes the demo camera, `t0=seconds` start time, `show=<model>` shows a single model at the origin, `mods=…`.
- `--eval "<js expr>"` evaluates in the page and prints the result (may be async). Output always includes `G.errors` (WGSL compile errors, WebGPU validation errors, exceptions) and console warnings/errors. **`errors` must be `[]` and the console clean on LOW, MEDIUM and HIGH, including after runtime preset switches** — test with `--eval "(async()=>{for(const q of ['HIGH','LOW','MEDIUM','HIGH']){G.setQuality(q,1);await G.test.run(3)} return G.errors})()"`.
- **Look at your screenshots** with the Read tool and judge them critically (composition, colour, artefacts, broken particles, z-fighting, banding, holes at the horizon…). Iterate until it looks genuinely good, not just "renders".
- The machine has no GPU: Chromium runs WebGPU on **SwiftShader (CPU)**. It is slow (HIGH can take seconds per frame — use `--w 640 --h 360 --frames 3` for heavy shaders) and its timings say nothing about real GPUs. Reason about real-GPU cost yourself (see §6 budgets). 4 CPU cores are shared with other agents: keep test runs short.
- `queue.onSubmittedWorkDone()` is unreliable in this headless build; use `mapAsync` on a readback buffer if you need a fence in a test.
- You may write extra test pages/scripts in `work_<name>/` (e.g. your own html that includes `../core.js`, your module and `../stubs.js`, then calls `G.boot()`).

## 2. Global conventions
- One global object `G`, plus `V3`, `M4` (see `core.js`). A module file is a single block `'use strict'; { … }` that calls `G.register('<name>', {...hooks})`. No other globals. No ES modules/imports. No top-level `await`.
- Units: metres, seconds, radians. World: **+Y up**, sea level y=0, right-handed.
- Model space: **forward = +Z, up = +Y, +X = port (left)**. `M4.trs(pos,yaw,pitch,roll,scale)`: forward = (sin yaw·cos pitch, sin pitch, cos yaw·cos pitch). `M4.fromDir(pos, dir)` orients +Z along `dir`.
- Matrices: column-major `Float32Array(16)` (matches WGSL `mat4x4f`).
- **Reversed-Z, infinite far plane**: depth cleared to **0**, nearer = larger. Scene pipelines use `depthCompare:'greater'` (sky: `'equal'` at z=0, no depth write). Depth format `G.DEPTH` (`depth32float`). `g.misc.x` = near (1 m); view distance = near / depth.
- Scene colour target is **linear HDR** `G.HDR` (`rgba16float`), not tonemapped. Reference radiances: sunlit mid-grey surface ≈ 1.5–2, sky ≈ 0.3–0.9, sun disc/flames/flashes 5–50 (only those should bloom). Tonemapping/exposure/gamma happen once, in the post module.
- Transparent blending convention: **premultiplied alpha** (`src: one, dst: one-minus-src-alpha`); additive = output alpha 0.
- Every pipeline that uses group 0 must use an **explicit layout** `G.layout(...yourBindGroupLayouts)` (never `layout:'auto'`), and shaders are created with `G.shader(wgsl, label)` which prepends the shared WGSL and reports compile errors into `G.errors`. Your own bind groups start at `@group(1)`.
- UI text/comments: Korean, short. Code: compact, readable, 2-space indent, no dead code, no `console.log` in the final module.
- Robustness: every GPU resource that depends on preset or resolution is rebuilt in `onQuality`/`onResize` and the old one destroyed. No per-frame creation of pipelines/textures/bind groups/buffers. No per-frame JS garbage in hot loops where avoidable.

## 3. Core API (see `core.js` for exact code)
- `G.dev`, `G.canvas`, `G.fmt` (canvas format), `G.HDR`, `G.DEPTH`, `G.params` (URLSearchParams), `G.ui` (overlay root div, `pointer-events:none`), `G.el(tag, props, parent)`, `G.css(text)`.
- `G.Q` current preset: `{name, level 0|1|2, scale, particles 500|3000|12000, ocean 0|1|2, clouds 0|1|2, shadows 0|1, bloom 0|1, refract 0|1, shadowRes}`. `G.setQuality(name, manual)`.
- `G.targets`: `{w,h (render size), cw,ch (canvas size), hdr,hdrView, depth,depthView, hdrCopyView, depthCopyView}`. The `*Copy` views hold the opaque pass result (colour+depth, before water) **only when `G.Q.refract`**; otherwise they are 1×1 dummies (always bindable).
- `G.bgl0`/`G.bg0` group-0 layout/bind group (already set by core on every pass), `G.linSamp` (linear repeat), `G.clampSamp` (linear clamp), `G.noiseView` (256² RGBA8 white noise), `G.dummyView`, `G.dummyDepthView`.
- `G.time`, `G.dt`, `G.frame`, `G.fps`, `G.keys[code]`, `G.cam {pos,target,up,fov,near,view,proj,viewProj}`, `G.project(p) → [cssX, cssY, w]`.
- `G.env {sunAz,sunEl,cloud,haze,sea,windDir,windSpd,fogDen,exposure}` + `G.setEnv(patch)`; `G.sun {dir,col}`.
- `G.waves` + `G.waveAt(x,z[,t])` → sea surface height (same 6 Gerstner waves as WGSL `gerstner()`); ships float on this.
- `G.addLight(pos, rgb, intensity, radius, life)` short-lived point light (explosions). Top 4 are in `g.lights`, use WGSL `pointLights(P,N)`.
- `G.shadowFocus`, `G.shadowRange` (m, half-extent of the single sun shadow map, HIGH only), `G.shadowView`, `G.bg0s`.
- `G.rng(seed)` deterministic RNG, `G.clamp`, `G.lerp`, `G.err(msg)`.

### Hooks (all optional, called in registration order)
| hook | when |
|---|---|
| `init()` | once (may be async). `G.Q`/`G.targets` are valid. |
| `onQuality(Q)` | after init and on every preset change (targets already rebuilt) |
| `onResize()` | after `onQuality` and on every window resize |
| `update(dt)` | simulation step (game queues draws / emits fx here) |
| `prepare()` | after all `update`s and after globals are written: upload your per-frame buffers |
| `compute(enc)` | `GPUCommandEncoder`: your compute passes or private render passes (e.g. half-res clouds, spectrum synthesis) |
| `shadow(pass)` | HIGH only. depth-only pass into the sun shadow map (standard z, clear 1, `'less'`), group 0 = `G.bg0s` already set |
| `opaque(pass)` | pass A (HDR + depth, cleared). opaque geometry |
| `sky(pass)` | pass A after opaque: sky at the far plane |
| `water(pass)` | pass B (loads A): ocean surface |
| `transparent(pass)` | pass B after water: particles etc. (depth test, no depth write) |
| `post.run(enc, dstView)` | **post module only**: read `G.targets.hdrView`, write the final image to `dstView` (format `G.fmt`, size `cw×ch`) |

### Shared WGSL (prepended by `G.shader`) — see `G.WGSL` in core.js
`g: Globals` uniform (`viewProj, invViewProj, shadowVP, cam(xyz,time), sun(xyz,quality), sunCol(rgb,shadowsOn), res, fog(density,cloud,haze,sea), wind(dir.xz,speed), misc(near,dt,frame,exposure), waves[12], lights[8]`), `shadowTex/shadowSamp/noiseTex/linSamp`, `vsFull` + `FSOut` (fullscreen triangle), `hash21 hash33 vnoise fbm`, `worldAt(uv,depth)`, `viewRay(uv)`, `skyBase(dir)`, `fogAt(col,P)`, `shadowAt(P,N)`, `gerstner(xz,t)`, `pointLights(P,N)`, `PI`. Do not redefine these names.
All lit scene shaders end with `fogAt()` and use `skyBase()` for ambient/reflection so everything sits in the same atmosphere.

## 4. Quality tiers (what each tier must deliver)
| | LOW (integrated GPU) | MEDIUM (ordinary discrete) | HIGH (RTX 4070+/5070+) |
|---|---|---|---|
| render scale | 0.75× | 1× | 1× |
| ocean | cheap sine/Gerstner surface | mid-res wave shader, basic reflection | hi-res spectral/noise waves, specular reflection, foam, refraction |
| particles | 500 | 3 000 | ≥ 10 000 (cap 12 000) |
| clouds | none / trivially cheap | cheap 2D | volumetric |
| shadows | none | none | dynamic sun shadow map |
| post | tonemap only | bloom | bloom (+ extras) |
Everything keys off `G.Q` fields (and `g.sun.w` in WGSL). LOW must stay genuinely cheap (few texture taps, no loops over many octaves per pixel); HIGH should look spectacular.

## 5. Cross-module APIs (fixed names — other modules call these)
All of these must exist at **module load time** (top level of your block, not inside `init`) and must never throw, even before `init`.

**mesh** (`mod_mesh.js`): `G.meshes`, `G.addMesh(name, Float32Array verts, meta)` (non-indexed triangles, **10 floats/vertex: pos3, normal3, rgb3, mat1**; CCW = front; `mat` 0..1 = gloss/specular strength, `mat ≥ 2` = emissive with intensity `mat-1`; stores `G.modelData[name] = {verts, ...meta}`), `G.draw(name, mat4, tint=[r,g,b,heat])` immediate-mode instance for this frame (tint.rgb multiplies colour, `heat` 0..1 adds hot glow). Also owns terrain: registers `island0`, `island1` (meta `{radius, hp:{site:[x,y,z]}}`).

**models** (`mod_models.js`): in `init()` calls `G.addMesh` for: `aegis` (166 m long, origin at waterline amidships, hull continues below y=0), `gun` (127 mm turret, origin = mount base, barrel along +Z), `ciws` (origin = base, barrel +Z), `frigate` (enemy, ~102 m), `boat` (enemy missile boat ~44 m), `jet` (fighter ~17 m, origin at centre), `sam` (6.5 m), `ssm` (anti-ship missile 5.2 m), `battery` (coastal missile launcher ~12 m, origin on ground).
meta = `{radius, hp:{…}}` hardpoints in model space: aegis `{gun, ciws:[fwd,aft], vlsF, vlsA, ssm, bridge, stack:[..], stern}`; gun/ciws `{muzzle}`; frigate `{gun, ssm, stack:[..], stern}`; boat `{ssm, stack:[..], stern}`; jet/sam/ssm `{nozzle}`; battery `{ssm}`.

**fx** (`mod_fx.js`): `G.fx.burst(kind, pos, opt)` kinds `'explosion' | 'flash' (air intercept flash) | 'splash' (water column) | 'launch' (VLS/booster plume) | 'muzzle' | 'hit' (sparks) | 'smoke'`; opt `{size=1, dir=[0,1,0], vel=[0,0,0]}`. `G.fx.trail(pos, vel, kind, dt)` called every frame per emitter, kinds `'missile' | 'jet' | 'fire' (burning wreck: flame + black smoke) | 'stack' (funnel haze)`. `G.fx.tracer(pos, dirUnit, speed=900)` one tracer round. `G.fx.alive` ≈ live particle count.

**audio** (`mod_audio.js`): `G.sfx.init()` (from a user gesture; idempotent), `G.sfx.play(name, {pos,gain=1,rate=1})` one-shots `'ping' 'launch' 'explosion' 'intercept' 'splash' 'gun' 'hit' 'lock' 'alert' 'click'`, `G.sfx.loop(name, on, {gain,rate})` sustained `'ciws' 'siren' 'engine' 'missile' 'sea'`, `G.sfx.music('off'|'calm'|'combat')`, `G.sfx.listener(pos, fwd)`, `G.sfx.volume(v)`.

**ocean** (`mod_ocean.js`): `G.ocean.wake(x, z, yaw, speed, len)` per frame per ship (≤ 8, cleared every frame), `G.ocean.ripple(x, z, size)` one-shot foam ring.

**post** (`mod_post.js`): `run(enc, dstView)` hook (required). **sky** (`mod_sky.js`): `sky(pass)` hook.
**gpu** (`mod_gpu.js`, lead): `detect(adapter, dev)`; perf HUD. **game** (`mod_game.js`, lead): gameplay, HUD, camera.

## 6. Real-GPU performance budgets (think, since SwiftShader can't tell you)
Target 60 fps: LOW on Intel Iris Xe / Apple M1 at ~720p (0.75× scale), MEDIUM on GTX 1660/RTX 3050-class at 1080p, HIGH on RTX 4070 at 1440p.
Rough per-frame GPU budget for your module: LOW ≤ 2 ms on an iGPU, MEDIUM ≤ 3 ms, HIGH ≤ 5 ms. Prefer texture lookups over many-octave procedural hashes per pixel, half-resolution for volumetrics, and keep overdraw of large alpha-blended sprites under control.

## 7. Final report (your last message — it is parsed)
Return: file(s) + byte size, which presets you verified clean, any API you added beyond §5, deviations from this contract, `coreRequests`, known issues, and your honest assessment of visual quality and real-GPU cost per tier.
