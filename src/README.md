# src/ — code map

Where everything lives. One line per module; folders ordered by how often you'll open them.

## Entry

- `main.js` — boot: registers screens, routes by URL hash, mounts global UI (volume, skip)
- `../index.html` — canvas container + persistent DOM (#volume, #debug) + phone media CSS

## `scenes/joseph3d/` — the live story scene (Genesis 37:1–11, full 3D)

- `index.js` — assembly + lifecycle: world, lights, post-reveal audio activation,
  cast/texture readiness + prewarm, live quality ownership, story runner, update/dispose
- `beats/` — the STORY as data/flow, one file per ACT (each beat sets its own
  presentation state, so any checkpoint can start fresh):
  - `index.js` — `createBeats(ctx)`: the running order + checkpoint `applyState`
  - `helpers.js` — shared sequencing + the dialogue-camera grammar (`shot`/`twoShot`)
  - `coldOpen.js` — beat 0: the flash-forward to the pit
  - `camp.js` — beats 1–4: herd · report to Jacob · the coat · the dusk fire
  - `dream.js` — beat 5: the dream (its finale is signed off — do not restage)
  - `telling.js` — beats 6–7: telling the brothers · the close
- `checkpointEntry.js` — first-frame/input ownership for resume paths; interactive
  beats establish their objective behind black without running twice
- `props.js` — the camp prop kit + layout data (tents, fires, well, pen, clutter, borders)
- `cast.js` — who's in the scene (colors/builds) + AmbientNPCs (wander/gesture/freeze)
- `sheep.js` — the instanced flock + herding/routing/unstick
- `pit.js` — the cold-open pit stage (Gen 37:24)
- `dreamField.js` — the dream: wheat field, sheaves, celestial bodies, summit

## `engine/` — reusable, story-agnostic (never imports from scenes/)

- `world.js` — sky/ridges/ground/sun/motes makers + toon materials + merge/dye helpers
- `CameraDirector.js` — authored follow camera: zones, cinematicMoveTo/release, occluder
  fade, drift/still (CAMERA_TUNING knobs at the top)
- `PlayerController3D.js` — camera-relative movement + scriptMoveTo (cutscene walks);
  idle static-collision work sleeps behind `CollisionGate`
- `Character3D.js` + `CharacterFactory.js` — rigged toon characters (GLB clone, merged
  body, coat/belt/beard/mouth, grief pose, anim LOD) + shared-base loading
- `ContactShadowPool.js` — one instanced character-shadow draw with change-gated uploads
- `Sequencer.js` — data-driven cutscene steps + pausableWait
- `MoodGrading.js` — MOODS table; one grade moves sky/fog/lights/ridges/tint together
- `collision.js` — circle/AABB slide collision (`ColliderWorld`) + dirty-driven idle gate
- `Interactables.js` — proximity prompts (talk pill) + trigger volumes
- `Guidance.js` — the golden waypoint arrow + ground ring
- `particles.js` — pooled smoke/embers/fireflies
- `textureLoader.js` — abortable owned Image/decode readiness for scene textures
- `PostFX.js` — canvas grade + named looks (future/dream) + cheap focus washes (app-owned)
- `layoutAudit.js` — the level-layout overlap/flatness audit (`debug.audit()`)
- `ThirdPersonCamera.js` — playground-only (story scenes use CameraDirector)
- `legacy2d/` — the frozen 2D-era engine for `#legacy-joseph` (see its README)

## `systems/` — engine-agnostic singletons

- `AudioSystem.js` — WebAudio: buses, streamed loops, bus-owned one-shots, procedural fallbacks,
  bounded compressed/decoded VO caches, channel-safe resume/teardown hardening
- `Narrator.js` — file-first baked VO (one voice; `npm run vo`), bounded abortable preload,
  event-driven active-time deadlines, TTS emergency fallback
- `Settings.js` — channel levels + HUD toggle (persisted) · `Graphics.js` — Low/Med/High
  presets (DPR/particles/shadows/fog) · `SaveSystem.js` — progress + beat checkpoints

## `ui/` — DOM over the canvas (crisp text, real a11y)

- `dialogue.js` (speaker boxes + history) · `verseCard.js` (scripture card, narrated)
- `storyHud.js` (atomic objectives + pause-aware banner/counters/emotes) ·
  `objectivePrepaint.js` (generic synchronous checkpoint first-frame scope) · `cinema.js` (letterbox/title/
  fade/tint) · `nameTags.js` (projected tags) · `pause.js` (true pause) · `settings.js` ·
  `modal.js` (confirm + isModalOpen) · `joystick.js` · `volume.js` · `skipButton.js` ·
  `veil.js` (screen transitions) · `loader.js` (loading screen) · `verse.js` (legacy 2D)

## `core/` — the app shell

- `app.js` — screen navigation, readiness recovery, loading/pause gates, zero-dt
  prepaint, post-reveal activation — and the LAZY ENGINE: the shell itself is
  three-free; renderer/camera/loop arrive via `engine3d.js` on the first
  non-flat navigation (idle-prefetched while the menu is up), so booting into
  the DOM home downloads zero bytes of Three.js
- `engine3d.js` — the one dynamic edge that imports three (re-exports
  createRenderer/startLoop + the THREE namespace)
- `renderer.js` — one WebGLRenderer + the rAF loop: GPU power preference, eco sleeping,
  and it feeds the pacer the chained callbacks it measures the panel from
- `framePacer.js` — measures the display's real refresh period and paces every frame to a
  WHOLE MULTIPLE of it, so frames land on vsync instead of averaging out to the right
  number while stuttering (`snapToRefresh` is the pure, testable core)
- `quality.js` — tier detect · `AdaptiveQuality` (sticky-down DPR) · `RateGovernor` (the
  full-rate ceiling, sticky-down) · the `#debug` HUD. Every threshold is a fraction of the
  PACED budget, never an absolute millisecond count
- `deadline.js` (bounded async gate) · `lazyScreen.js` (retry-safe import identity/cache) ·
  `dispose.js` (deep GPU free) · `reducedMotion.js` (the one shared
  prefers-reduced-motion gate every DOM surface asks)

## `screens/` + `data/`

- `screens/home/` — the story map: one night road through the Bible. DOM/CSS/SVG
  only — it declares `flat`, so the app hides the canvas and submits no GPU
  frames while it is up. Imported from the Claude Design project:
  - `index.js` — the screen: shell, palette, camera/pan, selection, the gate,
    responsive layout (design-space stage vs viewport-space UI), audio, dispose
  - `backdrop.js` — GENERATED by `tools/import-home-design.mjs`. Never
    hand-edit: change the design, then re-run the importer
  - `styles.js` — the design's keyframes + the overlay UI stylesheet
  - `atlas.js` — where each chapter stands on the road, the road path and its
    dark bed, the gate, and the grouped ambient particle fields
  - `palettes.js` — the four time-of-day palettes
- `../tools/import-home-design.mjs` — the design importer. Applies the fixed
  performance transforms (de-blurred clouds, no `mix-blend-mode`, no live
  filters, far-band sway dropped, bands tagged) and prints a counted report,
  so a regression in the design shows up as a changed count.
- `screens/pages.js` — About/Support. NOT routes: they are panels the home opens over
  itself, so its music keeps playing and the real map stays behind them
- `screens/playground.js` (#playground test bench)
- `data/versesWEB.js` (WEB scripture — verified verbatim; + NARRATION + routing table) ·
  `data/audioManifest.js` (every sound key → file/fallback) · `data/stories.js` (the 35
  chapters + eras; `sceneKey` marks which are built) · `data/verses.js` (legacy BSB, 2D only)
