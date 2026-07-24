import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes, mulberry32, mergeGeometries } from '../../engine/world.js';
import { Audio } from '../../systems/AudioSystem.js';
import { getCheckpoint, setCheckpoint, clearCheckpoint, setSceneProgress } from '../../systems/SaveSystem.js';
import { ColliderWorld } from '../../engine/collision.js';
import { auditLayout } from '../../engine/layoutAudit.js';
import { CameraDirector } from '../../engine/CameraDirector.js';
import { PlayerController3D } from '../../engine/PlayerController3D.js';
import { Interactables } from '../../engine/Interactables.js';
import { Guidance } from '../../engine/Guidance.js';
import { MoodGrading, MOODS } from '../../engine/MoodGrading.js';
import { Sequencer } from '../../engine/Sequencer.js';
import { makeSmoke, makeEmbers, makeFireflies } from '../../engine/particles.js';
import { CharacterFactory } from '../../engine/CharacterFactory.js';
import { Graphics, particleCapacity } from '../../systems/Graphics.js';
import { createCinema } from '../../ui/cinema.js';
import { createVerseCard } from '../../ui/verseCard.js';
import { createDialogue } from '../../ui/dialogue.js';
import { createStoryHud } from '../../ui/storyHud.js';
import { createNameTags } from '../../ui/nameTags.js';
import { confirmModal } from '../../ui/modal.js';
import { createPauseMenu } from '../../ui/pause.js';
import { openSettings } from '../../ui/settings.js';
import { buildCamp, makeTentInterior } from './props.js';
import { SheepFlock } from './sheep.js';
import { buildNamed, buildGenericBrother, buildWorker, AmbientNPCs } from './cast.js';
import { createBeats } from './beats/index.js';
import { buildPitStage } from './pit.js';
import { buildDreamField } from './dreamField.js';
import { Narrator } from '../../systems/Narrator.js';
import { WEB, NARRATION } from '../../data/versesWEB.js';
import { CutsceneMotion } from '../../engine/CutsceneMotion.js';
import { ContactShadowPool } from '../../engine/ContactShadowPool.js';
import { loadOwnedTexture } from '../../engine/textureLoader.js';
import { isAbortError, makeAbortError } from '../../core/async.js';
import {
  createInputGate,
  isInteractiveCheckpoint,
  runInteractiveCheckpointEntry,
} from './checkpointEntry.js';

// JOSEPH — SCENE 1 in full 3D (Genesis 37:1–11): the GOLD TEMPLATE. A living
// golden-hour camp near Hebron, real rigged characters, authored camera,
// cutscenes as data, and the story as a beat state machine with checkpoints.
// (game-architecture: this file assembles; systems live in engine/, story in
// beats.js, set in props.js, cast in cast.js, sheep in sheep.js, and the two
// off-camp stages in pit.js + dreamField.js.)
export function buildJoseph3D({ scene, camera, renderer, app, signal = null }) {
  if (signal?.aborted) throw signal.reason || makeAbortError('Joseph scene build aborted');
  // --- world (Alto look, D3 grade: warmer, more saturated, earthier ground).
  // Base palette comes straight from MOODS.goldenHour — one source of truth.
  const gh = MOODS.goldenHour;
  scene.fog = new THREE.Fog(gh.fog, gh.fogNear, Graphics.fogFar);
  const sky = makeSky({ top: gh.skyTop, bottom: gh.skyBottom });
  scene.add(sky.mesh);

  // --- real textures (D5): grass ground, limestone rock, dirt paths (CC0) ---
  // Materials receive their Texture objects immediately, but minimum scene
  // readiness waits for all three images to decode. This prevents a cold-load
  // reveal from popping the ground/path textures in on the first visible frame.
  const textureReadiness = [];
  const loadTiled = (url, rx, ry) => {
    const { texture: t, whenReady } = loadOwnedTexture(url, {
      signal,
      configure: (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(rx, ry);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Graphics.anisotropy;
      },
    });
    textureReadiness.push(whenReady);
    return t;
  };
  const grassTex = loadTiled('textures/grass.jpg', 26, 11);
  const rockTex = loadTiled('textures/rock.jpg', 1, 1);
  const dirtTex = loadTiled('textures/dirt.jpg', 2, 2);
  const worldTextures = { grass: grassTex, rock: rockTex, dirt: dirtTex };
  // Every story STAGE carves its own flat pad (level-layout law 1): the camp,
  // the dream field, the pit, and Jacob's tent interior. D4: the ground is a
  // sun-lit GRASS field — green base with brighter grass + dry-dirt patches.
  const ground = makeGround({
    // D6: vertex colors recentred on WHITE — the grass photo already carries
    // the green (it averages ~0.13 linear), so any green vertex tint MULTIPLIES
    // it into mud (the "gray ground" complaint). White base + near-white mottle
    // keeps the patch variety while the texture keeps its true richness.
    color: 0xffffff,
    mottle: [0xeaf7c0, 0xd8b98a], // sun-bright tufts + warm dry patches
    map: grassTex,
    segX: 96, segZ: 30,
    pads: [
      { x: 0, z: 0, flatCore: 27, falloff: 42 },    // the camp
      { x: 62, z: 0, flatCore: 17.5, falloff: 24 },  // the dream field
      { x: -62, z: 6, flatCore: 9, falloff: 16 },    // the pit stage (flat)
      // the SHAFT itself craters the terrain (D7: the hole is real — the
      // heightfield used to run right under the rim and read as a lawn lid).
      // Sized to catch the ~3.3–4.3u vertex grid; the r10 ring hides the dent.
      // Clear the whole 1.95u cistern floor plus its wall shoulder. A smaller
      // sink let the continuous terrain rise through the black floor at its
      // edge as grass-covered wedges.
      { x: -62, z: 6, flatCore: 4.5, falloff: 3.2, sink: 5 },
      { x: -62, z: -34, flatCore: 8, falloff: 14 },  // Jacob's tent interior
    ],
  });
  scene.add(ground);
  // D6 SUNRISE: a saddle carved into the ridge rows due NORTH — the exact
  // direction the follow camera faces at every spawn (default yaw π) — and
  // the sun sits LOW in that gap: the player always wakes looking into the
  // sunrise between the two mountains, never anywhere else.
  const ridges = makeRidges({ sunNotch: { x: 8, width: 34, depth: 30 } });
  scene.add(ridges);
  // named handle: the cold open HIDES the sun (the pit plays as night — D11)
  // and the morning brings it back.
  const sunSprite = makeSun({ x: 8, y: 22, z: -200, core: 62, halo: 165 });
  scene.add(sunSprite);
  const motes = makeMotes({ count: particleCapacity(70) });
  scene.add(motes.points);

  // The SUN — a real warm directional key light that now shapes the WHOLE
  // world (props, ground, characters), plus a hemisphere sky/ground fill.
  // MoodGrading arcs its position + color across the day (afternoon→dusk→night).
  const keyLight = new THREE.DirectionalLight(gh.key, gh.keyI);
  keyLight.position.set(...(gh.sun ?? [-9, 13, 6]));
  const hemiLight = new THREE.HemisphereLight(gh.hemiSky ?? gh.skyBottom, 0x4a5a34, gh.hemi);
  scene.add(keyLight, hemiLight);

  // --- camp set + collision ---
  const colliders = new ColliderWorld();
  const camp = buildCamp(colliders, worldTextures);
  scene.add(camp.group);

  // --- particles ---
  const smoke = makeSmoke({ count: particleCapacity(30) });
  const embers = makeEmbers({ count: particleCapacity(16) });
  camp.fireEmitters.forEach((e) => { smoke.addEmitter(e.x, e.y, e.z); embers.addEmitter(e.x, e.y, e.z); });
  smoke.init(); embers.init();
  const fireflies = makeFireflies({ count: particleCapacity(26), span: 34 });
  fireflies.init();
  scene.add(smoke.points, embers.points, fireflies.points);

  // NIGHT FIRE GLOW (D5): a warm point light at each fire pools + flickers on the
  // ground and nearby characters/props. Subtle by day (the sun dominates),
  // strong at night — grading scales it via fireLevel.
  const fireLights = camp.fireEmitters.map((e) => {
    const L = new THREE.PointLight(0xff8a3c, 0, 8.5, 1.6);
    L.position.set(e.x, 1.0, e.z);
    scene.add(L);
    return { light: L, phase: e.x * 1.7 };
  });
  const DARK_FIRE_MOODS = new Set(['dusk', 'night', 'dream', 'ominous', 'tentWarm', 'pit', 'pitTalk']);
  const FOOTSTEP_PATHS = [[0, -2.5, 3.6], [-5, -5, 3.3], [5.5, 3, 3.2], [10, 8, 3.1]];
  let fireLevel = 0.35; // 0..1 base intensity scale (grading raises it at night)
  let lastFireGain = -1; // change-gate for the crackle bed's proximity gain

  // --- presentation ---
  let disposed = false; // set on dispose(); async init + the story loop check it
  // The renderer already sleeps while a tab is hidden. Story time must sleep
  // with it: otherwise DOM/timer-backed waits can complete off-screen and the
  // player returns several lines or a checkpoint later.
  const isScenePaused = () => app.paused || document.hidden;
  const cinema = createCinema({
    isPaused: isScenePaused,
    signal,
    // beat fades ride a soft blur swell (smooth cross-transitions — D6)
    onFade: (toBlack, ms) => app.postFX.blurPulse(Math.min(ms * 1.3, 1400)),
  });
  // D8: the FIRST painted frame is black — the loader used to lift onto a
  // flash of golden camp before the cold open's own fade landed (the "awkward
  // cut at the very start"). The intro (or the resume path below) lifts it.
  cinema.fade(true, 0);

  // FILTER LOOKS (D6): the app-wide PostFX owns the canvas grade now — the
  // cold open asks for the named 'future' look (gloomy vignette + blur +
  // drain), the dream asks for 'dream'. The always-on vibrance base grade
  // lives in PostFX and scales with the Graphics preset.
  const futureVignette = (on) => app.postFX.setFilter(on ? 'future' : 'none');

  const verseCard = createVerseCard({ signal, isPaused: isScenePaused });
  const dialogue = createDialogue({ signal, isPaused: isScenePaused });
  const nameTags = createNameTags();
  const guide = new Guidance(scene);
  const grading = new MoodGrading({ sky, fog: scene.fog, keyLight, hemiLight, cinema, ridges: ridges.userData.materials });

  // --- camera (authored, close) ---
  // base follow comes from CAMERA_TUNING (raised + a touch more zoom-out in D4);
  // zones below still override per-area framing.
  const director = new CameraDirector(camera, { yaw: Math.PI });
  director.setZones([
    // pen area: swing the camera west so the pen + gate read clearly
    { shape: 'rect', minX: 7, maxX: 20, minZ: 5, maxZ: 17, yaw: Math.PI * 0.72, distance: 6.2, height: 2.7 },
    // Jacob's tent: reverse angle, closer + lower (drama)
    { shape: 'circle', x: -10.5, z: -6.5, r: 5.2, yaw: -Math.PI * 0.62, distance: 4.6, height: 1.9 },
    // dream field: hold a wide-ish stage frame
    { shape: 'rect', minX: 48, maxX: 76, minZ: -14, maxZ: 14, yaw: Math.PI, distance: 6.6, height: 2.6 },
  ]);
  director.setColliders(camp.cameraBlockers); // BIG props only — small props never pump the camera

  // --- audio: beds via manifest (real file OR fallback OR silence) ---
  Audio.unlock?.();
  // D14: the camp's OWN ambience — its resting levels live here so a scene that
  // happens somewhere else (the cold open, 60u away at the pit) can take it to
  // silence and the morning can bring it back. `amb.camp_wind` carries
  // BIRDSONG, so this is also what keeps birds out of the night wilderness.
  const CAMP_BED_GAIN = { wind: 1, sheepPen: 0.5, chatter: 0.4 };
  const savedBeat = Number(getCheckpoint('joseph3d'));
  // A hand-edited/corrupt localStorage value must never turn the story loop
  // into `for (let i = NaN; ...)` and leave the player in an empty camp.
  const startBeat = Number.isFinite(savedBeat)
    ? Math.max(0, Math.min(7, Math.floor(savedBeat)))
    : 0; // also picks the opening music below
  const silentLoop = () => ({ stop() {}, setGain() {} });
  let audioActivated = false;
  let campAmbienceLevel = 0;
  let beds = null;
  const startBeds = () => {
    if (beds) return;
    beds = {
      wind: Audio.playLoop('amb.camp_wind', { gain: CAMP_BED_GAIN.wind * campAmbienceLevel }) || silentLoop(),
      fire: Audio.playLoop('amb.fire_crackle', { gain: 0 }) || silentLoop(), // proximity-driven below
      sheepPen: Audio.playLoop('amb.sheep_pen', { gain: CAMP_BED_GAIN.sheepPen * campAmbienceLevel }) || silentLoop(),
      chatter: Audio.playLoop('amb.camp_chatter', { gain: CAMP_BED_GAIN.chatter * campAmbienceLevel }) || silentLoop(),
    };
  };
  // level 0..1 — the whole camp bed layer, faded as one.
  const setCampAmbience = (level, fade = 2) => {
    campAmbienceLevel = Math.max(0, level);
    if (!audioActivated || !beds) return;
    beds.wind.setGain(CAMP_BED_GAIN.wind * level, fade);
    beds.sheepPen.setGain(CAMP_BED_GAIN.sheepPen * level, fade);
    beds.chatter.setGain(CAMP_BED_GAIN.chatter * level, fade);
    // The wind handle owns its file-or-procedural fallback, including birds.
    // Callers never inspect decode state, so a slow stream cannot double beds.
  };
  // MUSIC STATE MACHINE (D8): the score is beat-driven, crossfade-only, and
  // NEVER doubles. The cold open starts in silence (no warm camp theme under a
  // betrayal); a checkpoint resume opens on the emotional state of its beat
  // (tension holds from the envy scene until the dream — calm never sneaks
  // back in between). Same-key requests are no-ops, so a track can't restart
  // over itself.
  // D9: the cold open carries a low DREAD bed (Nate heard silence and missed
  // the tension — a real music/betrayal_dark.mp3 takes over when it lands)
  const MUSIC_BY_BEAT = {
    0: 'music.betrayal_dark',
    1: 'music.camp_warm',
    2: 'music.camp_warm',
    3: 'music.camp_warm',
    4: 'music.ominous_turn',
    5: null,
    6: 'music.camp_warm',
    7: 'music.ominous_turn',
  };
  // (`in`, not `??` — beats 0 and 5 map to a DELIBERATE null = silence, which
  // `??` would silently coalesce back into the warm theme)
  let musicKey = startBeat in MUSIC_BY_BEAT ? MUSIC_BY_BEAT[startBeat] : 'music.camp_warm';
  let music = null;
  const startMusic = () => {
    if (music) return;
    music = musicKey ? (Audio.playLoop(musicKey) || silentLoop()) : silentLoop();
  };
  const setMusic = (key) => {
    if (disposed) return; // a zombie beat must never restart music after exit
    if (key === musicKey) return; // already the playing state — no restart blip
    musicKey = key;
    if (!audioActivated) return;
    music?.stop(1.4);
    music = key ? (Audio.playLoop(key) || silentLoop()) : silentLoop();
  };
  // --- cast (async GLB load; world plays while it streams) ---
  const factory = new CharacterFactory();
  const npcs = new AmbientNPCs(colliders, { signal });
  const cast = {};
  let joseph = null;
  let controller = null;
  let ready = false;
  let contactShadows = null;
  const syncContactShadows = (graphics = Graphics) => {
    if (!graphics.contactShadow) {
      if (contactShadows) contactShadows.mesh.visible = false;
      return;
    }
    if (!contactShadows && joseph) {
      contactShadows = new ContactShadowPool(scene, 16);
      contactShadows.add(joseph);
      Object.values(cast).forEach((n) => {
        if (n.char) contactShadows.add(n.char, n.char === cast.child?.char ? 0.7 : 1.15);
      });
    }
    if (contactShadows) contactShadows.mesh.visible = true;
  };

  const askLeave = () => confirmModal({
    title: 'Return home?',
    body: 'Your place in this scene is saved — you can pick it right back up.',
    confirmText: 'Return home', cancelText: 'Keep playing',
  });

  const hud = createStoryHud({
    signal,
    isPaused: isScenePaused,
    onHome: async () => {
      // freeze ALL input surfaces while the confirm is up (controller AND
      // interactables — E must not start a dialogue behind the modal)
      const wasOn = inputOn;
      setInput(false);
      const leave = await askLeave();
      if (leave) await app.navigate('home');
      else setInput(wasOn);
    },
  });

  const interactables = new Interactables({ camera, dom: renderer.domElement, signal, getPlayerPos: () => joseph?.position || { x: 0, z: 0 } });

  // Right-click does nothing in-game (no camera use) — swallow the browser
  // context menu on the canvas so it never pops over the scene.
  const onCanvasContextMenu = (e) => e.preventDefault();
  renderer.domElement.addEventListener('contextmenu', onCanvasContextMenu);

  let inputOn = true;
  const inputGate = createInputGate((on) => {
    inputOn = on;
    if (ready) controller.setEnabled(on);
    interactables.setEnabled(on);
  });
  const setInput = (on) => inputGate.set(on);
  signal?.addEventListener('abort', () => setInput(false), { once: true });

  // Esc / ⏸ — true pause: loop frozen, audio suspended, zero input bleed.
  const pause = createPauseMenu({
    app,
    isInputOn: () => inputOn,
    setInput: (on) => {
      if (ready) controller.setEnabled(on);
      interactables.setEnabled(on);
    },
    onSettings: () => openSettings({}),
    onHome: async () => {
      const leave = await askLeave();
      if (leave) await app.navigate('home');
      return leave;
    },
  });

  // --- the dream field (far east of camp; hidden until the dream beat) ---
  const dream = buildDreamField();
  dream.group.visible = false;
  scene.add(dream.group);

  // --- the pit (far west; the cold-open flash of Gen 37:24) ---
  const pit = buildPitStage(worldTextures);
  pit.group.visible = false;
  scene.add(pit.group);

  // --- Jacob's tent interior (lamplit stage; the coat is given HERE) ---
  const TENT_I = { x: -62, z: -34 };
  const tentInterior = makeTentInterior(TENT_I.x, TENT_I.z, worldTextures);
  tentInterior.group = tentInterior.mesh; // stage contract
  tentInterior.POS = TENT_I;
  tentInterior.mesh.visible = false;
  scene.add(tentInterior.mesh);

  // --- beats context (everything the story data needs) ---
  // bounds sit JUST BEHIND the visible tree/rock border so any stop reads as
  // "blocked by the trees/rocks," never an invisible wall in open ground.
  const bounds = { minX: -18.3, maxX: 18.3, minZ: -16, maxZ: 16.4 };
  const motion = new CutsceneMotion();
  const storyEvents = [];
  const onLifetimeAbort = () => motion.cancel(makeAbortError('Scene lifetime ended'));
  signal?.addEventListener('abort', onLifetimeAbort, { once: true });
  const ctx = {
    scene, app, cinema, verseCard, dialogue, hud, guide, grading, interactables, signal,
    camera: director, sequencer: null, setInput,
    isPaused: isScenePaused,
    sound: (key, gain) => { if (!disposed) Audio.play(key, gain !== undefined ? { gain } : {}); },
    setMusic, setCampAmbience, camp, dream, pit, tentInterior, bounds, motion, futureVignette, sunSprite,
    postFX: app.postFX, // named filter looks (dream/future) + blur transitions
    get joseph() { return joseph; },
    get cast() { return cast; },
    npcs,
    storyEvent: (event) => { storyEvents.push(event); },
    sheep: null,
    sparkle: (n) => Audio.sparkle(n),
    onDusk: () => fireflies.setFade(1),
    onDawn: () => fireflies.setFade(0),
    finish: () => {
      if (disposed) return; // a zombie close beat must not touch saves or nav
      setSceneProgress('joseph', 1);
      clearCheckpoint('joseph3d');
      app.navigate('home');
    },
  };
  ctx.sequencer = new Sequencer(ctx);
  Object.defineProperty(ctx, 'contactShadows', {
    configurable: true,
    get: () => contactShadows,
  });

  // Automatic quality can demote while this scene remains open. Apply every
  // live-safe preset owner immediately instead of waiting for a reload:
  // draw/simulate fewer particles, hide the pooled shadow draw, and shorten
  // fog distance together with the already-live DPR/PostFX changes.
  const applyLiveGraphics = (graphics = Graphics) => {
    scene.fog.far = graphics.fogFar;
    for (const texture of Object.values(worldTextures)) {
      if (texture.anisotropy === graphics.anisotropy) continue;
      texture.anisotropy = graphics.anisotropy;
      texture.needsUpdate = true;
    }
    motes.setActiveCount?.(graphics.particles(70));
    smoke.setActiveCount?.(graphics.particles(30));
    embers.setActiveCount?.(graphics.particles(16));
    fireflies.setActiveCount?.(graphics.particles(26));
    dream.setParticleScale?.(graphics.particleScale);
    syncContactShadows(graphics);
  };
  const unsubscribeGraphics = Graphics.subscribe((graphics) => applyLiveGraphics(graphics));
  applyLiveGraphics(Graphics);

  // One explicit stage owns the expensive life layer. Camp particles, sheep,
  // fire lights, sway and background AI must sleep while the camera is 60u
  // away in the pit/dream/tent. Every switch happens under black in the beats,
  // so this removes invisible work without changing a painted frame.
  let activeStage = 'camp';
  const stageStats = { campFrames: 0, offstageFrames: 0 };
  const setStage = (name) => {
    if (!['camp', 'pit', 'dream', 'tent'].includes(name) || name === activeStage) return;
    activeStage = name;
    const campOn = name === 'camp';
    camp.group.visible = campOn;
    motes.points.visible = campOn;
    smoke.points.visible = campOn;
    embers.points.visible = campOn;
    fireflies.points.visible = campOn;
    ctx.sheep.bodies.visible = campOn;
    ctx.sheep.heads.visible = campOn;
    for (const f of fireLights) f.light.visible = campOn;
    // The stage owns its soundscape too. Sheep/chatter/bird loops should not
    // keep streaming or leak into the pit, dream, or isolated tent interior.
    setCampAmbience(campOn ? 1 : 0, campOn ? 1.2 : 0.6);
    if (!campOn) {
      lastFireGain = 0;
      beds?.fire.setGain(0, 0.35);
    }
  };
  ctx.setStage = setStage;

  // --- sheep (independent of GLB load) ---
  // The 3 stray LAMBS sit DEEP in the camp, all WEST/SW of the pen in open
  // ground, so the player's natural push funnels each toward the pen ENTRANCE
  // (the west gate ~10,11.4) — never toward the trap-prone SE corner. (Nate
  // restarted 3× on the old SE spawn; this + the un-stick makes it un-failable.)
  ctx.sheep = new SheepFlock({
    scene, colliderWorld: colliders, pen: camp.pen, bounds,
    count: 9,
    // D7: strays SPREAD across the camp (west, south-centre, north-east) — a
    // real little herding journey, not three lambs already at the pen fence
    strays: [{ x: -11, z: 1.5 }, { x: -4, z: 10.5 }, { x: 6, z: -8.5 }],
    onPenned: (n) => { Audio.play('sfx.pen_gate'); ctx.onStrayPenned?.(n); },
  });

  const castReady = (async () => {
    await factory.loadBase();
    if (disposed || signal?.aborted) {
      // `loadBase()` can finish after the earlier scene dispose. Release the
      // bases it just populated instead of leaving their GLB textures alive.
      factory.dispose();
      return false;
    }
    joseph = buildNamed(factory, 'joseph').addTo(scene);
    joseph.setPosition(0, 15);
    cast.jacob = npcs.add(buildNamed(factory, 'jacob').addTo(scene), { x: -9.8, z: -5.2, wanderR: 0, gestureEvery: 14000, speed: 0.7 });
    cast.reuben = npcs.add(buildNamed(factory, 'reuben').addTo(scene), { x: 1.8, z: -7.9, wanderR: 1.4 });
    cast.judah = npcs.add(buildNamed(factory, 'judah').addTo(scene), { x: 0.3, z: -8.6, wanderR: 1.4 });
    cast.simeon = npcs.add(buildNamed(factory, 'simeon').addTo(scene), { x: -1.6, z: -7.7, wanderR: 1.6 });
    cast.levi = npcs.add(buildNamed(factory, 'levi').addTo(scene), { x: 2.9, z: -6.8, wanderR: 1.6 });
    for (let i = 0; i < 6; i++) {
      const spots = [[-6.5, 2.2], [9.5, -7.6], [12, 2], [-13, 0.5], [6.5, 6.5], [-4.5, -10.5]];
      cast[`brother${i}`] = npcs.add(buildGenericBrother(factory, i).addTo(scene), { x: spots[i][0], z: spots[i][1], wanderR: 2.4 });
    }
    cast.worker1 = npcs.add(buildWorker(factory, 0).addTo(scene), { x: 0.9, z: -5.4, wanderR: 1.2, gestureEvery: 7000 });
    cast.worker2 = npcs.add(buildWorker(factory, 1).addTo(scene), { x: 4.9, z: -0.2, wanderR: 1.5, gestureEvery: 8000 });
    cast.child = npcs.add(buildWorker(factory, 2, true).addTo(scene), { x: -1.5, z: 8.2, wanderR: 3, gestureEvery: 6000 });

    // name tags for the named cast
    nameTags.add(joseph, 'Joseph');
    nameTags.add(cast.jacob.char, 'Jacob (Israel) · your father');
    nameTags.add(cast.reuben.char, 'Reuben');
    nameTags.add(cast.judah.char, 'Judah');
    nameTags.add(cast.simeon.char, 'Simeon');
    nameTags.add(cast.levi.char, 'Levi');

    // Soft contact-shadow blobs under every character (one pooled draw on
    // Medium/High; Low removes the cue entirely).
    syncContactShadows(Graphics);

    controller = new PlayerController3D({
      camera, character: joseph, bounds, colliders, radius: 0.42, signal,
    });
    controller.dynamics = [...ctx.sheep.dynamics, ...npcs.dynamics];
    controller.onFootstep = (pos) => {
      // surface-aware: dirt on the path decals, grass elsewhere
      let onPath = false;
      for (const [x, z, r] of FOOTSTEP_PATHS) {
        if ((pos.x - x) ** 2 + (pos.z - z) ** 2 < r * r) {
          onPath = true;
          break;
        }
      }
      Audio.play(onPath ? 'sfx.footstep_dirt' : 'sfx.footstep_grass');
    };
    ctx.controller = controller;

    director.setTarget(joseph.position);
    director.snap();

    // D13 GPU PRE-WARM (the other half of the "choppy dream intro"): the pit
    // and dream stages are built hidden, so their shaders compile and their
    // textures upload on the FIRST frame they appear — a guaranteed hitch at
    // the exact moment a cutscene starts. Warm them here instead, behind the
    // loading screen (the veil covers the frames these lines may touch).
    await Promise.all(textureReadiness);
    const wasDream = dream.group.visible;
    const wasPit = pit.group.visible;
    const wasTent = tentInterior.mesh.visible;
    try {
      dream.group.visible = true; pit.group.visible = true; tentInterior.mesh.visible = true;
      scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          for (const k in m) { const v = m[k]; if (v && v.isTexture) renderer.initTexture(v); }
        }
      });
      renderer.compile(scene, camera);
    } catch (e) {
      console.warn('[joseph3d] stage pre-warm skipped', e);
    } finally {
      dream.group.visible = wasDream;
      pit.group.visible = wasPit;
      tentInterior.mesh.visible = wasTent;
    }

  })();

  // Readiness and activation are separate contracts. Rigs and compressed
  // narration preload in parallel behind the loader; the story clock does not
  // start until the app has actually revealed this ready screen.
  const sceneReady = Promise.all([
    castReady,
    Promise.all(textureReadiness),
    Narrator.preload(
      [...Object.values(WEB), ...Object.values(NARRATION)].map((v) => v.vo),
      { signal },
    ),
  ]).then((result) => {
    if (disposed || signal?.aborted) {
      throw signal?.reason || makeAbortError('Joseph scene left before readiness');
    }
    ready = true;
    return result;
  });
  let activated = false;
  const activate = () => {
    if (activated || disposed || signal?.aborted) return;
    if (!ready) throw new Error('Joseph scene activated before readiness');
    activated = true;
    // Construction/readiness happen behind the loader and own no audible
    // transport. Start the exact checkpoint soundscape only after reveal.
    audioActivated = true;
    campAmbienceLevel = [1, 2, 4, 6, 7].includes(startBeat) ? 1 : 0;
    startBeds();
    startMusic();
    // startBeat also chose the opening music/checkpoint presentation.
    runStory(startBeat);
  };

  // --- story state machine ---
  const beats = createBeats(ctx);
  let storyDone = false;
  async function runStory(from) {
    try {
      // A checkpoint resume starts behind the D8 pre-black. Interactive beats
      // establish their objective/guide before reveal while input stays held.
      // Beats 3/5 own their stage reveal; beat 7 precomposes its close.
      let loopFrom = from;
      if (from > 0 && isInteractiveCheckpoint(from)) {
        loopFrom = await runInteractiveCheckpointEntry({
          index: from,
          holdInput: () => inputGate.hold(),
          prepare: () => {
            beats.applyState(from, ctx);
            setCheckpoint('joseph3d', from);
          },
          invokeBeat: () => beats.list[from](ctx),
          reveal: () => cinema.fade(false, 800),
        });
      } else if (from > 0) {
        // Beats 3 and 5 own their black-to-stage reveal. Beat 7 owns its
        // precomposed close. No generic camp frame may appear before them.
        ctx.setInput(false);
        beats.applyState(from, ctx);
        if (from === 7) {
          ctx.hud.setLetterbox?.(true);
          ctx.camera.setDrift(true);
          // Establish the close's opening composition while the checkpoint
          // veil is still opaque. Previously the veil lifted for ~800ms onto
          // the generic follow camera before the authored shot took ownership.
          ctx.camera.cinematicMoveTo({
            angle: 0.35,
            target: { x: 0.2, z: -6.6 },
            distance: 4.5,
            height: 2.2,
            lookHeight: 1.3,
            duration: 1,
            path: 'groupArc',
            arcCenter: { x: 0, z: -6 },
            arcRadius: 6.4,
          });
          await cinema.letterbox(true);
          await cinema.fade(false, 800);
        }
      }
      for (let i = loopFrom; i < beats.list.length; i++) {
        if (disposed || signal?.aborted) return; // exited mid-story: no more beats/checkpoints
        setCheckpoint('joseph3d', i);
        await beats.list[i](ctx);
      }
      if (disposed || signal?.aborted) return;
      storyDone = true;
    } catch (e) {
      if (!isAbortError(e)) console.error('[joseph3d] story error', e);
    }
  }

  // --- per-frame ---
  const clock = { t: 0 };
  function update(dt, tMs) {
    const t = tMs / 1000;
    clock.t = t;
    sky.update(dt);
    grading.update(dt);
    const campActive = activeStage === 'camp';
    if (campActive) {
      stageStats.campFrames += 1;
      motes.update(dt, t);
      smoke.update(dt, t);
      embers.update(dt, t);
      fireflies.update(dt, t);
      for (const c of camp.sway) {
        c.rotation.x = Math.sin(t * 1.1 + c.userData.sway.phase) * 0.13;
      }
    } else {
      stageStats.offstageFrames += 1;
    }
    dream.update(dt, t);
    pit.update(dt, t);

    // fire glow: brighter at night (dark moods), flickering; the pool must
    // VISIBLY light the ground + nearby characters after dark (D6 boost).
    const dark = DARK_FIRE_MOODS.has(grading.current);
    if (campActive) {
      fireLevel += ((dark ? 1 : 0.22) - fireLevel) * Math.min(dt * 0.0015, 1);
      for (const f of fireLights) {
        const flick = 2.15 + Math.sin(t * 11 + f.phase) * 0.34 + Math.sin(t * 5.3 + f.phase) * 0.2;
        f.light.intensity = fireLevel * Math.max(0, flick);
      }
    }

    if (!ready) return;
    controller.update(dt);
    // 24u comfortably spans every active camp/pit/tent composition. Actors
    // beyond it are behind another stage and pause until staged nearby.
    npcs.update(dt, joseph.position, 24);
    if (contactShadows?.mesh.visible) contactShadows.update();
    motion.update(dt);
    director.setTarget(joseph.position);
    director.setLead(controller.vel.x, controller.vel.y);
    director.frame(dt);
    if (campActive) ctx.sheep.update(dt, joseph.position, t);
    interactables.update();
    guide.update(dt, camera);
    nameTags.update(camera, dt);

    // fire crackle proximity — change-gated: an unconditional setGain queued
    // ~60 WebAudio automation events/s on the bed all game long
    if (campActive) {
      const fires = camp.fireEmitters;
      let nearest = Infinity;
      for (const f of fires) nearest = Math.min(nearest, Math.hypot(joseph.position.x - f.x, joseph.position.z - f.z));
      const fireGain = Math.max(0, 1 - nearest / 7);
      if (Math.abs(fireGain - lastFireGain) > 0.005) {
        lastFireGain = fireGain;
        beds?.fire.setGain(fireGain);
      }
    }
  }

  function dispose() {
    disposed = true; // stops the story loop, zombie async init, sound/finish
    const abortError = signal?.reason instanceof Error ? signal.reason : makeAbortError('Joseph scene disposed');
    director.setPoseDriver(null);
    controller?.cancelScriptMove?.();
    motion.cancel(abortError);
    signal?.removeEventListener('abort', onLifetimeAbort);
    Narrator.stop('aborted');
    // (D11: scripted camera moves all ride CameraDirector's per-frame pose
    // driver now — no timer loops exist to outlive the scene)
    // (canvas filter/vignette live in app.postFX now — app resets on navigate)
    renderer.domElement.removeEventListener('contextmenu', onCanvasContextMenu);
    Object.values(beds || {}).forEach((b) => b.stop(0.6));
    music?.stop(0.6);
    Audio.stopOneShots();
    Audio.ambience({ wind: 0, birds: 0, night: 0 });
    Audio.stopMusic();
    hud.destroy();
    pause.destroy();
    cinema.destroy();
    verseCard.destroy();
    dialogue.destroy();
    nameTags.destroy();
    interactables.dispose();
    guide.dispose();
    controller?.dispose();
    npcs.dispose();
    unsubscribeGraphics();
    contactShadows?.dispose();
    ctx.sheep.dispose();
    smoke.dispose(); embers.dispose(); fireflies.dispose();
    joseph?.dispose();
    Object.values(cast).forEach((n) => (n.char || n).dispose?.());
    factory.dispose();
    dream.dispose();
    pit.dispose();
    tentInterior.dispose();
  }

  // level-layout audit (run in QA via debug.audit() — must return []).
  const audit = () => auditLayout({
    colliderWorld: colliders,
    ground,
    decorations: camp.decorations,
    zones: [
      ...interactables.triggers.map((t) => ({ x: t.x, z: t.z, label: t.id })),
      ...interactables.prompts.map((p) => {
        const pos = p.getPos ? p.getPos() : p;
        return { x: pos.x, z: pos.z, label: p.id };
      }),
    ],
    stages: [
      { x: 0, z: 0, r: 24, label: 'camp' },
      { x: 62, z: 0, r: 16, label: 'dream-field' },
      // pit ring sampled at r10.5 — just past the r10 rock ring the actors
      // stand on. Inside it the terrain intentionally dips: the D7 shaft
      // crater + its vertex-interpolation skirt (coarse 4.3u z-rows carry the
      // sink one row out, ~r10.1 worst case), all hidden under the flat ring.
      { x: -62, z: 6, r: 10.5, label: 'pit' },
      { x: -62, z: -34, r: 6, label: 'tent-interior' },
    ],
  });

  const hasFleeingSheep = () => {
    if (activeStage !== 'camp') return false;
    for (const sheep of ctx.sheep.sheep) {
      if (sheep.state === 'flee') return true;
    }
    return false;
  };

  return {
    update, dispose,
    // D12 power governor hint: TRUE whenever this scene can move fast — the
    // app renders at full 60 then, and drops the pure ambient idle (standing
    // in the camp, nothing scripted running) to eco-30. Broad on purpose:
    // any cutscene machinery, narration, dialogue, camera move, scripted or
    // player motion, or a fleeing lamb forces full rate.
    fullRate: () =>
      !ready
      || Narrator.speaking
      || dialogue.isOpen
      || ctx.sequencer.running
      || motion.active
      || director.inCinematic || !!director._poseDriver || director.drift
      || (controller && (!!controller._script || controller.vel.lengthSq() > 0.02))
      || hasFleeingSheep(),
    // The loading screen holds for the rigs and compressed narration bytes.
    // Audio decodes on demand into a two-line LRU, avoiding a scene-long PCM
    // allocation while keeping every line locally ready before the veil lifts.
    whenReady: sceneReady,
    activate,
    debug: {
      get joseph() { return joseph; }, get controller() { return controller; },
      get ready() { return ready; }, get storyDone() { return storyDone; },
      cast, ctx, director, sheep: () => ctx.sheep, beats, colliders, factory, audit,
      get contactShadows() { return contactShadows; },
      get activeStage() { return activeStage; },
      stageStats, storyEvents,
    },
  };
}
