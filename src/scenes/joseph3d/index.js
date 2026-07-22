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
import { Graphics } from '../../systems/Graphics.js';
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

// JOSEPH — SCENE 1 in full 3D (Genesis 37:1–11): the GOLD TEMPLATE. A living
// golden-hour camp near Hebron, real rigged characters, authored camera,
// cutscenes as data, and the story as a beat state machine with checkpoints.
// (game-architecture: this file assembles; systems live in engine/, story in
// beats.js, set in props.js, cast in cast.js, sheep in sheep.js, and the two
// off-camp stages in pit.js + dreamField.js.)
export function buildJoseph3D({ scene, camera, renderer, app }) {
  // --- world (Alto look, D3 grade: warmer, more saturated, earthier ground).
  // Base palette comes straight from MOODS.goldenHour — one source of truth.
  const gh = MOODS.goldenHour;
  scene.fog = new THREE.Fog(gh.fog, gh.fogNear, Graphics.fogFar);
  const sky = makeSky({ top: gh.skyTop, bottom: gh.skyBottom });
  scene.add(sky.mesh);

  // --- real textures (D5): grass ground, limestone rock, dirt paths (CC0) ---
  // TextureLoader.load() returns immediately; the image streams in and updates
  // the GPU when ready, so no await is needed.
  const texLoader = new THREE.TextureLoader();
  const loadTiled = (url, rx, ry) => {
    const t = texLoader.load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
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
      { x: -62, z: 6, flatCore: 2.6, falloff: 3.2, sink: 5 },
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
  const motes = makeMotes({ count: Graphics.particles(70) });
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
  const smoke = makeSmoke({ count: Graphics.particles(30) });
  const embers = makeEmbers({ count: Graphics.particles(16) });
  camp.fireEmitters.forEach((e) => { smoke.addEmitter(e.x, e.y, e.z); embers.addEmitter(e.x, e.y, e.z); });
  smoke.init(); embers.init();
  const fireflies = makeFireflies({ count: Graphics.particles(26), span: 34 });
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
  let fireLevel = 0.35; // 0..1 base intensity scale (grading raises it at night)
  let lastFireGain = -1; // change-gate for the crackle bed's proximity gain

  // --- presentation ---
  let disposed = false; // set on dispose(); async init + the story loop check it
  const cinema = createCinema({
    isPaused: () => app.paused,
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

  const verseCard = createVerseCard();
  const dialogue = createDialogue();
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
  const startBeat = Math.min(getCheckpoint('joseph3d'), 6); // also picks the opening music below
  const startsAtColdOpen = startBeat === 0;
  const bedScale = startsAtColdOpen ? 0 : 1;
  const beds = {
    wind: Audio.playLoop('amb.camp_wind', { gain: CAMP_BED_GAIN.wind * bedScale }),
    fire: Audio.playLoop('amb.fire_crackle', { gain: 0 }), // proximity-driven below
    sheepPen: Audio.playLoop('amb.sheep_pen', { gain: CAMP_BED_GAIN.sheepPen * bedScale }),
    chatter: Audio.playLoop('amb.camp_chatter', { gain: CAMP_BED_GAIN.chatter * bedScale }),
  };
  // level 0..1 — the whole camp bed layer, faded as one.
  const setCampAmbience = (level, fade = 2) => {
    beds.wind.setGain(CAMP_BED_GAIN.wind * level, fade);
    beds.sheepPen.setGain(CAMP_BED_GAIN.sheepPen * level, fade);
    beds.chatter.setGain(CAMP_BED_GAIN.chatter * level, fade);
    // The PROCEDURAL bird layer only exists when the real bed file is missing
    // (the fallback path) — never double it on top of Nate's recording.
    Audio.ambience({ birds: level > 0 && !Audio.samples['amb.camp_wind'] ? 0.18 : 0 });
  };
  if (startsAtColdOpen) setCampAmbience(0, 0.1); // silence before the first frame
  // MUSIC STATE MACHINE (D8): the score is beat-driven, crossfade-only, and
  // NEVER doubles. The cold open starts in silence (no warm camp theme under a
  // betrayal); a checkpoint resume opens on the emotional state of its beat
  // (tension holds from the envy scene until the dream — calm never sneaks
  // back in between). Same-key requests are no-ops, so a track can't restart
  // over itself.
  // D9: the cold open carries a low DREAD bed (Nate heard silence and missed
  // the tension — a real music/betrayal_dark.mp3 takes over when it lands)
  const MUSIC_BY_BEAT = { 0: 'music.betrayal_dark', 1: 'music.camp_warm', 2: 'music.camp_warm', 3: 'music.camp_warm', 4: 'music.ominous_turn', 5: null, 6: 'music.camp_warm' };
  // (`in`, not `??` — beats 0 and 5 map to a DELIBERATE null = silence, which
  // `??` would silently coalesce back into the warm theme)
  let musicKey = startBeat in MUSIC_BY_BEAT ? MUSIC_BY_BEAT[startBeat] : 'music.camp_warm';
  let music = musicKey ? Audio.playLoop(musicKey) : { stop() {}, setGain() {} };
  let musicHealT = 0;
  const setMusic = (key) => {
    if (disposed) return; // a zombie beat must never restart music after exit
    if (key === musicKey) return; // already the playing state — no restart blip
    musicKey = key;
    music.stop(1.4);
    music = Audio.playLoop(key);
  };
  // Heal: if the requested track's file decodes AFTER the request (samples
  // stream in post-unlock), upgrade the silent/fallback handle to the real
  // loop — the state machine's correctness can't depend on decode timing.
  const healMusic = (dt) => {
    musicHealT += dt;
    if (musicHealT < 1000) return;
    musicHealT = 0;
    if (musicKey && !music.real && Audio.samples[musicKey]) {
      music.stop(0.4);
      music = Audio.playLoop(musicKey);
    }
  };

  // --- cast (async GLB load; world plays while it streams) ---
  const factory = new CharacterFactory();
  const npcs = new AmbientNPCs(colliders);
  const cast = {};
  let joseph = null;
  let controller = null;
  let ready = false;

  const askLeave = () => confirmModal({
    title: 'Return home?',
    body: 'Your place in this scene is saved — you can pick it right back up.',
    confirmText: 'Return home', cancelText: 'Keep playing',
  });

  const hud = createStoryHud({
    onHome: async () => {
      // freeze ALL input surfaces while the confirm is up (controller AND
      // interactables — E must not start a dialogue behind the modal)
      const wasOn = inputOn;
      setInput(false);
      const leave = await askLeave();
      if (leave) app.navigate('home');
      else setInput(wasOn);
    },
  });

  const interactables = new Interactables({ camera, dom: renderer.domElement, getPlayerPos: () => joseph?.position || { x: 0, z: 0 } });

  // Right-click does nothing in-game (no camera use) — swallow the browser
  // context menu on the canvas so it never pops over the scene.
  const onCanvasContextMenu = (e) => e.preventDefault();
  renderer.domElement.addEventListener('contextmenu', onCanvasContextMenu);

  let inputOn = true;
  const setInput = (on) => {
    inputOn = on;
    if (ready) controller.setEnabled(on);
    interactables.setEnabled(on);
  };

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
      if (leave) app.navigate('home');
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
  const tentInterior = makeTentInterior(TENT_I.x, TENT_I.z);
  tentInterior.group = tentInterior.mesh; // stage contract
  tentInterior.POS = TENT_I;
  tentInterior.mesh.visible = false;
  scene.add(tentInterior.mesh);

  // --- beats context (everything the story data needs) ---
  // bounds sit JUST BEHIND the visible tree/rock border so any stop reads as
  // "blocked by the trees/rocks," never an invisible wall in open ground.
  const bounds = { minX: -18.3, maxX: 18.3, minZ: -16, maxZ: 16.4 };
  const ctx = {
    scene, app, cinema, verseCard, dialogue, hud, guide, grading, interactables,
    camera: director, sequencer: null, setInput,
    isPaused: () => app.paused,
    sound: (key, gain) => { if (!disposed) Audio.play(key, gain !== undefined ? { gain } : {}); },
    setMusic, setCampAmbience, camp, dream, pit, tentInterior, bounds, futureVignette, sunSprite,
    postFX: app.postFX, // named filter looks (dream/future) + blur transitions
    get joseph() { return joseph; },
    get cast() { return cast; },
    npcs,
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
    if (disposed) return; // scene was exited during the GLB load — stand down
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
    nameTags.add(cast.jacob.char, 'Jacob · your father');
    nameTags.add(cast.reuben.char, 'Reuben');
    nameTags.add(cast.judah.char, 'Judah');
    nameTags.add(cast.simeon.char, 'Simeon');
    nameTags.add(cast.levi.char, 'Levi');

    // soft contact-shadow blobs under every character (Graphics High only)
    if (Graphics.contactShadow) {
      joseph.addContactShadow();
      Object.values(cast).forEach((n) => n.char?.addContactShadow(n.char === cast.child?.char ? 0.7 : 1.15));
    }

    controller = new PlayerController3D({
      camera, character: joseph, bounds, colliders, radius: 0.42,
    });
    controller.dynamics = [...ctx.sheep.dynamics, ...npcs.dynamics];
    controller.onFootstep = (pos) => {
      // surface-aware: dirt on the path decals, grass elsewhere
      const paths = [[0, -2.5, 3.6], [-5, -5, 3.3], [5.5, 3, 3.2], [10, 8, 3.1]];
      const onPath = paths.some(([x, z, r]) => (pos.x - x) ** 2 + (pos.z - z) ** 2 < r * r);
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
    try {
      const wasDream = dream.group.visible, wasPit = pit.group.visible, wasTent = tentInterior.mesh.visible;
      dream.group.visible = true; pit.group.visible = true; tentInterior.mesh.visible = true;
      scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) {
          for (const k in m) { const v = m[k]; if (v && v.isTexture) renderer.initTexture(v); }
        }
      });
      renderer.compile(scene, camera);
      dream.group.visible = wasDream; pit.group.visible = wasPit; tentInterior.mesh.visible = wasTent;
    } catch (e) { console.warn('[joseph3d] stage pre-warm skipped', e); }

    ready = true;

    // start (or resume) the story (startBeat also chose the opening music)
    runStory(startBeat);
  })();

  // --- story state machine ---
  const beats = createBeats(ctx);
  let storyDone = false;
  async function runStory(from) {
    try {
      // a checkpoint resume starts behind the D8 pre-black — apply the state,
      // then lift gently (the intro beat manages its own fades from black).
      if (from > 0) { beats.applyState(from, ctx); cinema.fade(false, 800); }
      for (let i = from; i < beats.list.length; i++) {
        if (disposed) return; // exited mid-story: no more beats, no checkpoint writes
        setCheckpoint('joseph3d', i);
        await beats.list[i](ctx);
      }
      if (disposed) return;
      storyDone = true;
    } catch (e) {
      console.error('[joseph3d] story error', e);
    }
  }

  // --- per-frame ---
  const clock = { t: 0 };
  function update(dt, tMs) {
    const t = tMs / 1000;
    clock.t = t;
    sky.update(dt);
    grading.update(dt);
    healMusic(dt);
    motes.update(dt, t);
    smoke.update(dt, t);
    embers.update(dt, t);
    fireflies.update(dt, t);
    camp.sway.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.1 + c.userData.sway.phase) * 0.13; });
    dream.update(dt, t);
    pit.update(dt, t);

    // fire glow: brighter at night (dark moods), flickering; the pool must
    // VISIBLY light the ground + nearby characters after dark (D6 boost).
    const dark = ['dusk', 'night', 'dream', 'ominous', 'tentWarm', 'pit', 'pitTalk'].includes(grading.current);
    fireLevel += ((dark ? 1 : 0.22) - fireLevel) * Math.min(dt * 0.0015, 1);
    for (const f of fireLights) {
      const flick = 2.15 + Math.sin(t * 11 + f.phase) * 0.34 + Math.sin(t * 5.3 + f.phase) * 0.2;
      f.light.intensity = fireLevel * Math.max(0, flick);
    }

    if (!ready) return;
    controller.update(dt);
    director.setTarget(joseph.position);
    director.setLead(controller.vel.x, controller.vel.y);
    director.frame(dt);
    ctx.sheep.update(dt, joseph.position, t);
    npcs.update(dt, joseph.position);
    interactables.update();
    guide.update(dt, camera);
    nameTags.update(camera, dt);

    // fire crackle proximity — change-gated: an unconditional setGain queued
    // ~60 WebAudio automation events/s on the bed all game long
    const fires = camp.fireEmitters;
    let nearest = Infinity;
    for (const f of fires) nearest = Math.min(nearest, Math.hypot(joseph.position.x - f.x, joseph.position.z - f.z));
    const fireGain = Math.max(0, 1 - nearest / 7);
    if (Math.abs(fireGain - lastFireGain) > 0.005) {
      lastFireGain = fireGain;
      beds.fire.setGain(fireGain);
    }
  }

  function dispose() {
    disposed = true; // stops the story loop, zombie async init, sound/finish
    // (D11: scripted camera moves all ride CameraDirector's per-frame pose
    // driver now — no timer loops exist to outlive the scene)
    // (canvas filter/vignette live in app.postFX now — app resets on navigate)
    renderer.domElement.removeEventListener('contextmenu', onCanvasContextMenu);
    Object.values(beds).forEach((b) => b.stop(0.6));
    music.stop(0.6);
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
      || director.inCinematic || !!director._poseDriver || director.drift
      || (controller && (!!controller._script || controller.vel.lengthSq() > 0.02))
      || ctx.sheep.sheep.some((s) => s.state === 'flee'),
    // the loading screen holds for BOTH the rigs and the full narration —
    // every verse mp3 decodes up front, so the one voice can never drop to
    // TTS from a mid-scene network blip (D7).
    whenReady: Promise.all([castReady, Narrator.preload([...Object.values(WEB), ...Object.values(NARRATION)].map((v) => v.vo))]),
    debug: {
      get joseph() { return joseph; }, get controller() { return controller; },
      get ready() { return ready; }, get storyDone() { return storyDone; },
      cast, ctx, director, sheep: () => ctx.sheep, beats, colliders, factory, audit,
    },
  };
}
