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
import { createBeats } from './beats.js';

// JOSEPH — SCENE 1 in full 3D (Genesis 37:1–11): the GOLD TEMPLATE. A living
// golden-hour camp near Hebron, real rigged characters, authored camera,
// cutscenes as data, and the story as a beat state machine with checkpoints.
// (game-architecture: this file assembles; systems live in engine/, story in
// beats.js, set in props.js, cast in cast.js.)
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
      { x: -62, z: 6, flatCore: 9, falloff: 16 },    // the pit (cold open)
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
  scene.add(makeSun({ x: 8, y: 22, z: -200, core: 62, halo: 165 }));
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

  // --- presentation ---
  let disposed = false; // set on dispose(); async init + the story loop check it
  const cinema = createCinema({
    isPaused: () => app.paused,
    // beat fades ride a soft blur swell (smooth cross-transitions — D6)
    onFade: (toBlack, ms) => app.postFX.blurPulse(Math.min(ms * 1.3, 1400)),
  });

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
  const beds = {
    wind: Audio.playLoop('amb.camp_wind'),
    fire: Audio.playLoop('amb.fire_crackle', { gain: 0 }),
    sheepPen: Audio.playLoop('amb.sheep_pen', { gain: 0.5 }),
    chatter: Audio.playLoop('amb.camp_chatter', { gain: 0.4 }),
  };
  let music = Audio.playLoop('music.camp_warm');
  const setMusic = (key) => {
    if (disposed) return; // a zombie beat must never restart music after exit
    music.stop(1.4);
    music = Audio.playLoop(key);
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
    sound: (key) => { if (!disposed) Audio.play(key); },
    setMusic, camp, dream, pit, tentInterior, bounds, futureVignette,
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
    strays: [{ x: 3.5, z: 6.5 }, { x: 6.5, z: 4.5 }, { x: 8, z: 8 }],
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
    ready = true;

    // start (or resume) the story
    const fromBeat = Math.min(getCheckpoint('joseph3d'), 6);
    runStory(fromBeat);
  })();

  // --- story state machine ---
  const beats = createBeats(ctx);
  let storyDone = false;
  async function runStory(from) {
    try {
      if (from > 0) beats.applyState(from, ctx);
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
    motes.update(dt, t);
    smoke.update(dt, t);
    embers.update(dt, t);
    fireflies.update(dt, t);
    camp.sway.forEach((c, i) => { c.rotation.x = Math.sin(t * 1.1 + c.userData.sway.phase) * 0.13; });
    dream.update(dt, t);
    pit.update(dt, t);

    // fire glow: brighter at night (dark moods), flickering; the pool must
    // VISIBLY light the ground + nearby characters after dark (D6 boost).
    const dark = ['dusk', 'night', 'dream', 'ominous', 'tentWarm', 'pit'].includes(grading.current);
    fireLevel += ((dark ? 1 : 0.22) - fireLevel) * Math.min(dt * 0.0015, 1);
    for (const f of fireLights) {
      const flick = 2.15 + Math.sin(t * 11 + f.phase) * 0.34 + Math.sin(t * 5.3 + f.phase) * 0.2;
      f.light.intensity = fireLevel * Math.max(0, flick);
    }

    if (!ready) return;
    controller.update(dt);
    joseph.update(dt);
    director.setTarget(joseph.position);
    director.setLead(controller.vel.x, controller.vel.y);
    director.frame(dt);
    ctx.sheep.update(dt, joseph.position, t);
    npcs.update(dt);
    interactables.update();
    guide.update(dt, camera);
    nameTags.update(camera);

    // fire crackle proximity (live gain on the bed)
    const fires = camp.fireEmitters;
    let nearest = Infinity;
    for (const f of fires) nearest = Math.min(nearest, Math.hypot(joseph.position.x - f.x, joseph.position.z - f.z));
    beds.fire.setGain(Math.max(0, 1 - nearest / 7));
  }

  function dispose() {
    disposed = true; // stops the story loop, zombie async init, sound/finish
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
      { x: -62, z: 6, r: 7, label: 'pit' },
      { x: -62, z: -34, r: 6, label: 'tent-interior' },
    ],
  });

  return {
    update, dispose,
    whenReady: castReady, // the app's loading screen holds until the rigs are in
    debug: {
      get joseph() { return joseph; }, get controller() { return controller; },
      get ready() { return ready; }, get storyDone() { return storyDone; },
      cast, ctx, director, sheep: () => ctx.sheep, beats, colliders, factory, audit,
    },
  };
}

// --- the pit: the cold-open stage (Genesis 37:23–24) -------------------------
// A dry cistern in the Shechem wilderness. The cold open plays here with the
// REAL rigged cast (the story runner starts only after the GLBs load — no
// primitive stand-ins ever, level-layout law 8): the brothers carry Joseph in,
// tear off the tunic, and throw him down. Shown once, then never again.
function buildPitStage(tex = {}) {
  const group = new THREE.Group();
  const PIT = { x: -62, z: 6 };
  const rnd = mulberry32(37);

  // harsh rocky ground around the pit (Shechem wilderness — paler, rougher).
  // Real dirt texture, warm-tinted — never a flat gray disc (world-density law).
  const patchOpts = { color: 0xa89468, fog: true };
  if (tex.dirt) patchOpts.map = tex.dirt;
  const patch = new THREE.Mesh(new THREE.CircleGeometry(10, 26), new THREE.MeshBasicMaterial(patchOpts));
  patch.rotation.x = -Math.PI / 2; patch.position.set(PIT.x, 0.02, PIT.z);
  group.add(patch);
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0); rockGeo.translate(0, 0.18, 0);
  const rspots = [];
  for (let i = 0; i < 12; i++) { const a = rnd() * Math.PI * 2, r = 3.8 + rnd() * 5; rspots.push([PIT.x + Math.cos(a) * r, PIT.z + Math.sin(a) * r]); }
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshBasicMaterial({ color: 0x796d55, fog: true }), rspots.length);
  const rd = new THREE.Object3D();
  rspots.forEach((s, i) => { rd.position.set(s[0], 0, s[1]); rd.scale.setScalar(0.6 + rnd() * 1.3); rd.rotation.y = rnd() * 6; rd.updateMatrix(); rocks.setMatrixAt(i, rd.matrix); });
  rocks.instanceMatrix.needsUpdate = true; group.add(rocks);

  // the pit MOUTH — a dark hole in the ground
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(2.4, 22), new THREE.MeshBasicMaterial({ color: 0x120e18, fog: true }));
  mouth.rotation.x = -Math.PI / 2; mouth.position.set(PIT.x, 0.04, PIT.z); group.add(mouth);

  // the pit INTERIOR (below ground) — walls + dark floor for the fall shot
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.05, 4.6, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x372f47, side: THREE.BackSide, fog: true }));
  wall.position.set(PIT.x, -2.05, PIT.z); group.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.15, 20), new THREE.MeshBasicMaterial({ color: 0x1a1622, fog: true }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(PIT.x, -4.0, PIT.z); group.add(floor);

  // the SKY-LIGHT above the pit — a bright disc that SHRINKS as he falls in
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,246,220,0.95)'); g.addColorStop(1, 'rgba(255,246,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const skyLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0xfff2cf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  skyLight.position.set(PIT.x, 3.6, PIT.z); skyLight.scale.setScalar(8);
  group.add(skyLight);

  // the torn coat a brother carries off (argyle-red cloth). A cloth PROP —
  // characters in this cutscene are the real rigged cast, moved by the beat.
  const coatProp = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), new THREE.MeshBasicMaterial({ color: 0xb5643c, side: THREE.DoubleSide, fog: true }));
  coatProp.visible = false; group.add(coatProp);

  return {
    group, PIT, coatProp, skyLight,
    setSkyLight(k) { skyLight.material.opacity = 0.9 * k; },
    shrinkSkyLight(k) { skyLight.scale.setScalar(8 - 6.5 * k); }, // k 0→1 closes over him
    update() { /* static set — the beat animates the cast */ },
    dispose() {
      ringTex.dispose();
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
      group.parent?.remove(group);
    },
  };
}

// --- the DREAM: a moonlit farm field where the sky bows (Gen 37:7,9) ---------
// A proper wheat field under a cool night, heavy fog banks behind, a visible
// moonbeam, floating dream motes — you know instantly it's a dream. The 7
// sheaves still bow (dream 1); then sun + moon + 11 stars descend and bow
// (dream 2) in one authored cinematic.
function buildDreamField() {
  const group = new THREE.Group();
  const FIELD = { x: 62, z: 0 };
  const rnd = mulberry32(808);

  // dark cool ground disc
  const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshBasicMaterial({ color: 0x27304f, fog: true }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(FIELD.x, 0.01, FIELD.z);
  group.add(disc);

  // ROWS of tall wheat (instanced) — the clearing (r 6.4) around the sheaves
  // stays open. One draw; a gentle field-wide sway reads as night wind.
  // DREAM V2: a proper wheat BLADE (slim stalk + a rounded grain head), not a
  // pointy 4-sided cone — merged so the whole field is still a single draw.
  const _wStalk = new THREE.CylinderGeometry(0.016, 0.032, 1.3, 5);
  _wStalk.translate(0, 0.65, 0);
  const _wHead = new THREE.SphereGeometry(0.1, 6, 5);
  _wHead.scale(1, 1.8, 1);         // an ovoid grain head, not a spike
  _wHead.translate(0, 1.42, 0);
  const stalkGeo = mergeGeometries([_wStalk, _wHead]);
  const wheatSpots = [];
  for (let row = -13; row <= 13; row += 1.5) {
    for (let col = -13; col <= 13; col += 0.75) {
      const jx = (rnd() - 0.5) * 0.5, jz = (rnd() - 0.5) * 0.5;
      const x = col + jx, z = row + jz;
      const r = Math.hypot(x, z);
      if (r > 14.5 || r < 6.4) continue; // inside the field, outside the clearing
      wheatSpots.push([x, z, 0.7 + rnd() * 0.7, rnd() * Math.PI * 2]);
    }
  }
  const wheat = new THREE.InstancedMesh(stalkGeo, new THREE.MeshBasicMaterial({ color: 0xb39a5e, fog: true }), wheatSpots.length);
  const wd = new THREE.Object3D();
  wheatSpots.forEach((s, i) => {
    wd.position.set(FIELD.x + s[0], 0, FIELD.z + s[1]);
    wd.scale.set(1, s[2], 1);
    wd.rotation.set(0, s[3], 0);
    wd.updateMatrix();
    wheat.setMatrixAt(i, wd.matrix);
  });
  wheat.instanceMatrix.needsUpdate = true;
  group.add(wheat);

  // a sheaf = a bundle of leaning stalks with a tie-band (the 7 that bow). The
  // 6 stalks are MERGED into one mesh so a sheaf is 2 draws, not 7 (perf).
  const mkSheaf = (x, z, scale = 1) => {
    const g = new THREE.Group();
    const stalkGeos = [];
    // 7 leaning blades, each a stalk + rounded grain head, all merged to 1 mesh
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const st = new THREE.CylinderGeometry(0.028, 0.05, 1.5, 5); st.translate(0, 0.75, 0);
      const hd = new THREE.SphereGeometry(0.095, 6, 5); hd.scale(1, 1.9, 1); hd.translate(0, 1.52, 0);
      const blade = mergeGeometries([st, hd]);
      blade.rotateZ(Math.cos(a) * 0.22);
      blade.rotateX(-Math.sin(a) * 0.22);
      blade.translate(Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17);
      stalkGeos.push(blade);
    }
    const stalks = new THREE.Mesh(mergeGeometries(stalkGeos), new THREE.MeshBasicMaterial({ color: 0xd9b96a, fog: true }));
    g.add(stalks);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.05, 6, 10), new THREE.MeshBasicMaterial({ color: 0x8a5a2c, fog: true }));
    band.position.y = 0.58;
    band.rotation.x = Math.PI / 2;
    g.add(band);
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    return g;
  };
  const center = mkSheaf(FIELD.x, FIELD.z, 1.25);
  group.add(center);
  const outer = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const s = mkSheaf(FIELD.x + Math.cos(a) * 5.0, FIELD.z + Math.sin(a) * 5.0);
    s.userData = { bowK: 0, bowed: false, toCenter: a + Math.PI };
    outer.push(s);
    group.add(s);
  }

  // fog banks — big soft planes standing behind the field (dream haze)
  const softTex = (rgb) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${rgb},0.5)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  };
  const fogTex = softTex('150,160,205');
  const fogBanks = [];
  for (let i = 0; i < 6; i++) {
    const a = -1.1 + i * 0.44;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(15, 8), new THREE.MeshBasicMaterial({ map: fogTex, color: 0x6b7196, transparent: true, opacity: 0.46, depthWrite: false, fog: false }));
    m.position.set(FIELD.x + Math.sin(a) * 15, 3.4, FIELD.z + Math.cos(a) * 15 - 3);
    m.userData = { phase: i * 1.3, baseX: m.position.x };
    fogBanks.push(m); group.add(m);
  }

  // DREAM V2 · distinct fog GLOOM — broad, dark, low sheets of mist hugging the
  // field so it reads instantly as a heavy dream haze, not clear night air.
  const mistTex = softTex('90,100,140');
  const groundMist = [];
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(42, 42), new THREE.MeshBasicMaterial({ map: mistTex, color: 0x232b47, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(FIELD.x, 0.55 + i * 0.5, FIELD.z);
    m.userData = { phase: i * 2.3 };
    groundMist.push(m); group.add(m);
  }

  // the MOONBEAM — a visible cool shaft of light down onto the field.
  // (beamTex is CAPTURED so dispose() can free it — an inline softTex here
  // would leak one GPU texture on every scene exit.)
  const beamTex = softTex('200,215,255');
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 5.0, 16, 20, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTex, color: 0xcfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.position.set(FIELD.x + 3, 8, FIELD.z - 3);
  beam.rotation.z = -0.12;
  group.add(beam);
  // a soft MOON disc at the head of the shaft — the source of the moonlight
  const moonDiscTex = softTex('215,228,255');
  const moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonDiscTex, color: 0xdfe9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonDisc.scale.setScalar(5.5);
  moonDisc.position.set(FIELD.x + 3.4, 15.5, FIELD.z - 4);
  group.add(moonDisc);

  // floating dream motes (cool, drift upward)
  const moteCount = 60;
  const mp = new Float32Array(moteCount * 3);
  const mseed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    mp[i * 3] = FIELD.x + (rnd() - 0.5) * 26;
    mp[i * 3 + 1] = rnd() * 9;
    mp[i * 3 + 2] = FIELD.z + (rnd() - 0.5) * 26;
    mseed[i] = rnd() * Math.PI * 2;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: fogTex, color: 0xdfe7ff, size: 0.5, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  group.add(motes);

  // --- the celestial bodies: sun, moon, 11 stars (layered glow) ---
  const glowTex = softTex('255,255,255');
  const mkBody = (size, color, coreBoost = 1, layered = true) => {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.setScalar(size);
    const b = new THREE.Group();
    b.add(halo);
    let core = null;
    if (layered) { // sun + moon get a bright inner core; stars stay single-sprite (perf)
      core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      core.scale.setScalar(size * 0.42 * coreBoost);
      b.add(core);
    }
    b.userData = { halo, core, twinkle: rnd() * Math.PI * 2 };
    return b;
  };
  const sun = mkBody(4.6, 0xffe6a8);
  const moon = mkBody(3.4, 0xd2e0ff);
  const stars = [];
  for (let i = 0; i < 11; i++) stars.push(mkBody(1.15, 0xfff6df, 1, false));
  const bodies = [sun, moon, ...stars];
  bodies.forEach((b) => group.add(b));

  // three key positions per body: HIGH (start), MID (descended), LOW (bowed).
  const setPath = (b, hx, hy, hz, mx, my, mz, lx, ly, lz) => {
    b.userData.high = new THREE.Vector3(FIELD.x + hx, hy, FIELD.z + hz);
    b.userData.mid = new THREE.Vector3(FIELD.x + mx, my, FIELD.z + mz);
    b.userData.low = new THREE.Vector3(FIELD.x + lx, ly, FIELD.z + lz);
    b.position.copy(b.userData.high);
  };
  setPath(sun, -7, 22, -19, -5.5, 12, -10, -2.6, 4.6, -3.5);
  setPath(moon, 7, 23, -19, 5.5, 13, -10, 2.6, 5.0, -3.5);
  stars.forEach((s, i) => {
    const a = (i / 10) * Math.PI;
    setPath(s,
      Math.cos(a) * 11, 15 + Math.sin(a) * 4, -17,
      Math.cos(a) * 8, 9 + Math.sin(a) * 2.5, -9,
      Math.cos(a) * 3.4, 3.6 + Math.sin(a) * 1.2, -3.2);
  });

  // --- DREAM V2: the MOUNTAIN to climb + the SUMMIT where the sky bows --------
  const darkRock = (col) => new THREE.MeshBasicMaterial({ color: col, fog: true });
  // the looming massif to the NORTH — the dreamer climbs toward it (Gen 37:9)
  const mountainGroup = new THREE.Group();
  {
    const parts = [];
    const peak = (x, z, r, h) => { const c = new THREE.ConeGeometry(r, h, 6); c.translate(FIELD.x + x, h / 2, FIELD.z + z); parts.push(c); };
    peak(0, -24, 12, 21); peak(-8, -22, 7, 13); peak(9, -23, 8, 15);
    mountainGroup.add(new THREE.Mesh(mergeGeometries(parts), darkRock(0x171d33)));
  }
  group.add(mountainGroup);

  // a path of faintly glowing cairns leading from the clearing up to the base
  const cairnGeo = new THREE.DodecahedronGeometry(0.28, 0);
  const cairns = new THREE.InstancedMesh(cairnGeo, new THREE.MeshBasicMaterial({ color: 0x7f8cc4, fog: true }), 6);
  {
    const o = new THREE.Object3D();
    for (let i = 0; i < 6; i++) {
      o.position.set(FIELD.x + (i % 2 ? 0.6 : -0.6), 0.2, FIELD.z - 6 - i * 1.15);
      o.scale.setScalar(0.7 + (i % 2) * 0.3);
      o.updateMatrix(); cairns.setMatrixAt(i, o.matrix);
    }
    cairns.instanceMatrix.needsUpdate = true;
  }
  group.add(cairns);

  // the SUMMIT set — hidden until the climb ends. The dreamer is lifted onto the
  // peak (root.y = SUMMIT_Y, set by the beat); a sea of cloud rolls below and
  // lower peaks stand beyond → a real summit silhouette against the sky.
  const SUMMIT_Y = 3.6;
  const cloudTex = softTex('185,196,230');
  const summitGroup = new THREE.Group();
  summitGroup.visible = false;
  {
    const rock = new THREE.Mesh(new THREE.ConeGeometry(3.4, SUMMIT_Y + 1.6, 7), darkRock(0x121830));
    rock.position.set(FIELD.x, (SUMMIT_Y + 1.6) / 2 - 0.5, FIELD.z + 0.2);
    summitGroup.add(rock);
    // lower peaks beyond, in silhouette
    [[-11, -7, 5, 8], [12, -9, 6, 10], [-16, -13, 7, 6], [17, -14, 5, 7]].forEach(([x, z, r, h]) => {
      const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), darkRock(0x0f1428));
      p.position.set(FIELD.x + x, h / 2 - 1.2, FIELD.z + z);
      summitGroup.add(p);
    });
    // the cloud sea just below the summit
    const clouds = [];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), new THREE.MeshBasicMaterial({ map: cloudTex, color: 0x39456e, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
      c.rotation.x = -Math.PI / 2;
      c.position.set(FIELD.x + Math.cos(a) * 6, 1.3 + (i % 2) * 0.5, FIELD.z + Math.sin(a) * 6 - 1);
      c.userData = { phase: a, baseX: c.position.x };
      clouds.push(c); summitGroup.add(c);
    }
    summitGroup.userData.clouds = clouds;
  }
  group.add(summitGroup);

  // field elements that HIDE when we cut to the summit (they were dream 1)
  const fieldEls = [disc, wheat, center, ...outer, ...fogBanks, ...groundMist, beam, moonDisc, mountainGroup, cairns];
  const setSummit = (on) => { summitGroup.visible = on; fieldEls.forEach((e) => { e.visible = !on; }); };

  let skyState = 0; // 0 idle · 1 descending (→mid) · 2 bowing (→low)
  const setOpacity = (k) => bodies.forEach((b) => {
    b.userData.halo.material.opacity = k * (b === sun ? 0.9 : b === moon ? 0.8 : 0.95);
    if (b.userData.core) b.userData.core.material.opacity = k * 0.9;
  });

  return {
    group, FIELD, center, outer, sun, moon, stars, beam, SUMMIT_Y,
    showSummit: setSummit,
    // the moon shaft over the wheat field (dream 1)
    showMoon(k) { beam.material.opacity = k * 0.22; moonDisc.material.opacity = k * 0.9; },
    showSky(k) { setOpacity(k); },
    descendSky() { skyState = 1; },
    bowSky() { skyState = 2; },
    resetSky() {
      skyState = 0;
      setOpacity(0);
      beam.material.opacity = 0; moonDisc.material.opacity = 0;
      setSummit(false);
      bodies.forEach((b) => b.position.copy(b.userData.high));
    },
    update(dt, t) {
      if (!this.group.visible) return;
      // at the summit: drift the cloud sea + a touch of body motion only
      if (summitGroup.visible) {
        summitGroup.userData.clouds.forEach((c) => {
          c.position.x = c.userData.baseX + Math.sin(t * 0.12 + c.userData.phase) * 1.6;
          c.material.opacity = 0.42 + Math.sin(t * 0.3 + c.userData.phase) * 0.1;
        });
        bodies.forEach((b) => {
          const tw = 1 + Math.sin(t * 2 + b.userData.twinkle) * 0.08;
          if (b.userData.core) b.userData.core.material.rotation = t * 0.3 + b.userData.twinkle;
          b.scale.setScalar(tw);
          if (skyState === 1) b.position.lerp(b.userData.mid, Math.min(dt * 0.0006, 1));
          else if (skyState === 2) b.position.lerp(b.userData.low, Math.min(dt * 0.0012, 1));
        });
        return;
      }
      // field-wide wheat sway (cheap night wind)
      wheat.rotation.z = Math.sin(t * 0.7) * 0.015;
      wheat.rotation.x = Math.cos(t * 0.5) * 0.01;
      // low ground mist breathes
      groundMist.forEach((m) => { m.material.opacity = 0.24 + Math.sin(t * 0.25 + m.userData.phase) * 0.08; });
      // fog banks drift + breathe
      fogBanks.forEach((m) => {
        m.position.x = m.userData.baseX + Math.sin(t * 0.15 + m.userData.phase) * 1.2;
        m.material.opacity = 0.32 + Math.sin(t * 0.4 + m.userData.phase) * 0.1;
      });
      // dream motes drift upward, wrap
      const pos = moteGeo.attributes.position;
      for (let i = 0; i < moteCount; i++) {
        let y = pos.getY(i) + dt * 0.0004 * (1 + Math.sin(mseed[i]));
        if (y > 10) y -= 10;
        pos.setY(i, y);
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + mseed[i]) * dt * 0.00015);
      }
      pos.needsUpdate = true;
      // outer sheaves ease into their bow
      for (const s of outer) {
        const target = s.userData.bowed ? 1 : 0;
        s.userData.bowK += (target - s.userData.bowK) * Math.min(dt * 0.004, 1);
        const k = s.userData.bowK;
        s.rotation.x = Math.sin(s.userData.toCenter) * k * 0.85;
        s.rotation.z = -Math.cos(s.userData.toCenter) * k * 0.85;
      }
      const rise = outer.filter((s) => s.userData.bowed).length / outer.length;
      center.scale.setScalar(1.25 + rise * 0.35);
      // celestial bodies: twinkle + descend/bow toward their target
      bodies.forEach((b) => {
        const tw = 1 + Math.sin(t * 2 + b.userData.twinkle) * 0.08;
        if (b.userData.core) b.userData.core.material.rotation = t * 0.3 + b.userData.twinkle;
        b.scale.setScalar(tw);
        if (skyState === 1) b.position.lerp(b.userData.mid, Math.min(dt * 0.0006, 1));
        else if (skyState === 2) b.position.lerp(b.userData.low, Math.min(dt * 0.0012, 1));
      });
    },
    dispose() {
      glowTex.dispose(); fogTex.dispose(); beamTex.dispose();
      mistTex.dispose(); moonDiscTex.dispose(); cloudTex.dispose();
      group.traverse((o) => {
        if (o.isInstancedMesh) o.dispose(); // frees the wheat instance buffers
        if (o.isMesh || o.isSprite || o.isPoints) { o.geometry?.dispose?.(); o.material?.dispose?.(); }
      });
      group.parent?.remove(group);
    },
  };
}
