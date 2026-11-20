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
