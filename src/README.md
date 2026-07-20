# src/ — code map

Where everything lives. One line per module; folders ordered by how often you'll open them.

## Entry

- `main.js` — boot: registers screens, routes by URL hash, mounts global UI (volume, skip)
- `../index.html` — canvas container + persistent DOM (#volume, #debug) + phone media CSS

## `scenes/joseph3d/` — the live story scene (Genesis 37:1–11, full 3D)

- `index.js` — assembly + lifecycle: world, lights, audio beds + music state machine,
  cast loading, story runner, per-frame update, dispose, `debug.*` hooks
- `beats/` — the STORY as data/flow, one file per ACT (each beat sets its own
  presentation state, so any checkpoint can start fresh):
  - `index.js` — `createBeats(ctx)`: the running order + checkpoint `applyState`
  - `helpers.js` — shared sequencing + the dialogue-camera grammar (`shot`/`twoShot`)
  - `coldOpen.js` — beat 0: the flash-forward to the pit
  - `camp.js` — beats 1–4: herd · report to Jacob · the coat · the dusk fire
  - `dream.js` — beat 5: the dream (its finale is signed off — do not restage)
  - `telling.js` — beats 6–7: telling the brothers · the close
- `props.js` — the camp prop kit + layout data (tents, fires, well, pen, clutter, borders)
- `cast.js` — who's in the scene (colors/builds) + AmbientNPCs (wander/gesture/freeze)
- `sheep.js` — the instanced flock + herding/routing/unstick
- `pit.js` — the cold-open pit stage (Gen 37:24)
- `dreamField.js` — the dream: wheat field, sheaves, celestial bodies, summit

## `engine/` — reusable, story-agnostic (never imports from scenes/)

- `world.js` — sky/ridges/ground/sun/motes makers + toon materials + merge/dye helpers
- `CameraDirector.js` — authored follow camera: zones, cinematicMoveTo/release, occluder
  fade, drift/still (CAMERA_TUNING knobs at the top)
- `PlayerController3D.js` — camera-relative movement + scriptMoveTo (cutscene walks)
- `Character3D.js` + `CharacterFactory.js` — rigged toon characters (GLB clone, merged
  body, coat/belt/beard/mouth, grief pose, anim LOD) + shared-base loading
- `Sequencer.js` — data-driven cutscene steps + pausableWait
- `MoodGrading.js` — MOODS table; one grade moves sky/fog/lights/ridges/tint together
- `collision.js` — circle/AABB slide collision (ColliderWorld)
- `Interactables.js` — proximity prompts (talk pill) + trigger volumes
- `Guidance.js` — the golden waypoint arrow + ground ring
- `particles.js` — pooled smoke/embers/fireflies
- `PostFX.js` — canvas grade + named looks (future/dream) + blur pulses (app-owned)
- `layoutAudit.js` — the level-layout overlap/flatness audit (`debug.audit()`)
- `ThirdPersonCamera.js` — playground-only (story scenes use CameraDirector)
- `legacy2d/` — the frozen 2D-era engine for `#legacy-joseph` (see its README)

## `systems/` — engine-agnostic singletons

- `AudioSystem.js` — WebAudio: buses (master/music/sfx/voice), manifest loops/one-shots,
  procedural fallbacks, VO decode/play, resume hardening
- `Narrator.js` — file-first baked VO (one voice; `npm run vo`), TTS emergency fallback
- `Settings.js` — channel levels + HUD toggle (persisted) · `Graphics.js` — Low/Med/High
  presets (DPR/particles/shadows/fog) · `SaveSystem.js` — progress + beat checkpoints

## `ui/` — DOM over the canvas (crisp text, real a11y)

- `dialogue.js` (speaker boxes + history) · `verseCard.js` (scripture card, narrated)
- `storyHud.js` (home btn + objective banner + counters) · `cinema.js` (letterbox/title/
  fade/tint) · `nameTags.js` (projected tags) · `pause.js` (true pause) · `settings.js` ·
  `modal.js` (confirm + isModalOpen) · `joystick.js` · `volume.js` · `skipButton.js` ·
  `veil.js` (screen transitions) · `loader.js` (loading screen) · `verse.js` (legacy 2D)

## `core/` — the app shell

- `app.js` — renderer/camera/loop owner, screen navigation, loading gate, pause paint
- `renderer.js` (one WebGLRenderer + rAF loop) · `quality.js` (tier detect, adaptive DPR,
  #debug HUD) · `dispose.js` (deep GPU free)

## `screens/` + `data/`

- `screens/home.js` (story map) · `screens/pages.js` (About/Support) ·
  `screens/playground.js` (#playground test bench)
- `data/versesWEB.js` (WEB scripture — verified verbatim; + NARRATION + routing table) ·
  `data/audioManifest.js` (every sound key → file/fallback) · `data/stories.js` (registry)
  · `data/verses.js` (legacy BSB, 2D scene only)
