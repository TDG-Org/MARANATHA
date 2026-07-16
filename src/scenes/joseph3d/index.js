import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes } from '../../engine/world.js';
import { Audio } from '../../systems/AudioSystem.js';
import { getCheckpoint, setCheckpoint, clearCheckpoint, setSceneProgress } from '../../systems/SaveSystem.js';
import { ColliderWorld } from '../../engine/collision.js';
import { auditLayout } from '../../engine/layoutAudit.js';
import { CameraDirector } from '../../engine/CameraDirector.js';
import { PlayerController3D } from '../../engine/PlayerController3D.js';
import { Interactables } from '../../engine/Interactables.js';
import { Guidance } from '../../engine/Guidance.js';
import { MoodGrading } from '../../engine/MoodGrading.js';
import { Sequencer } from '../../engine/Sequencer.js';
import { makeSmoke, makeEmbers, makeFireflies } from '../../engine/particles.js';
import { CharacterFactory } from '../../engine/CharacterFactory.js';
import { createCinema } from '../../ui/cinema.js';
import { createVerseCard } from '../../ui/verseCard.js';
import { createDialogue } from '../../ui/dialogue.js';
import { createStoryHud } from '../../ui/storyHud.js';
import { createNameTags } from '../../ui/nameTags.js';
import { confirmModal } from '../../ui/modal.js';
import { createPauseMenu } from '../../ui/pause.js';
import { openSettings } from '../../ui/settings.js';
import { buildCamp } from './props.js';
import { SheepFlock } from './sheep.js';
import { buildNamed, buildGenericBrother, buildWorker, AmbientNPCs } from './cast.js';
import { createBeats } from './beats.js';

// JOSEPH — SCENE 1 in full 3D (Genesis 37:1–11): the GOLD TEMPLATE. A living
// golden-hour camp near Hebron, real rigged characters, authored camera,
// cutscenes as data, and the story as a beat state machine with checkpoints.
// (game-architecture: this file assembles; systems live in engine/, story in
// beats.js, set in props.js, cast in cast.js.)
export function buildJoseph3D({ scene, camera, renderer, app }) {
  // --- world (unchanged Alto look) ---
  scene.fog = new THREE.Fog(0xffdfba, 44, 250);
  const sky = makeSky({ top: 0xf2b880, bottom: 0xffe9c9 });
  scene.add(sky.mesh);
  // Every story STAGE carves its own flat pad (level-layout law 1): the camp
  // and the dream field — un-carved, the terrain swell pierced the wheat.
  const ground = makeGround({
    pads: [
      { x: 0, z: 0, flatCore: 27, falloff: 42 },   // the camp
      { x: 62, z: 0, flatCore: 17.5, falloff: 24 }, // the dream field
    ],
  });
  scene.add(ground);
  scene.add(makeRidges());
  scene.add(makeSun());
  const motes = makeMotes({ count: 70 });
  scene.add(motes.points);

  // character light rig (the deliberate exception — no shadows)
  const keyLight = new THREE.DirectionalLight(0xfff2d6, 1.15);
  keyLight.position.set(-6, 10, 5);
  const hemiLight = new THREE.HemisphereLight(0xffe9c9, 0x4c4066, 0.6);
  scene.add(keyLight, hemiLight);

  // --- camp set + collision ---
  const colliders = new ColliderWorld();
  const camp = buildCamp(colliders);
  scene.add(camp.group);

  // --- particles ---
  const smoke = makeSmoke({ count: 30 });
  const embers = makeEmbers({ count: 16 });
  camp.fireEmitters.forEach((e) => { smoke.addEmitter(e.x, e.y, e.z); embers.addEmitter(e.x, e.y, e.z); });
  smoke.init(); embers.init();
  const fireflies = makeFireflies({ count: 26, span: 34 });
  fireflies.init();
  scene.add(smoke.points, embers.points, fireflies.points);

  // --- presentation ---
  const cinema = createCinema();
  const verseCard = createVerseCard();
  const dialogue = createDialogue();
  const nameTags = createNameTags();
  const guide = new Guidance(scene);
  const grading = new MoodGrading({ sky, fog: scene.fog, keyLight, hemiLight, cinema });

  // --- camera (authored, close) ---
  const director = new CameraDirector(camera, { yaw: Math.PI, distance: 5.6, height: 2.3, lookHeight: 1.5 });
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
  const setMusic = (key) => { music.stop(1.4); music = Audio.playLoop(key); };

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
      controller?.setEnabled(false);
      const leave = await askLeave();
      if (leave) app.navigate('home');
      else if (ready && inputOn) controller.setEnabled(true);
    },
  });

  const interactables = new Interactables({ camera, dom: renderer.domElement, getPlayerPos: () => joseph?.position || { x: 0, z: 0 } });

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

  // --- beats context (everything the story data needs) ---
  const bounds = { minX: -19, maxX: 19, minZ: -16.5, maxZ: 17 };
  const ctx = {
    scene, app, cinema, verseCard, dialogue, hud, guide, grading, interactables,
    camera: director, sequencer: null, setInput,
    sound: (key) => Audio.play(key),
    setMusic, camp, dream, bounds,
    get joseph() { return joseph; },
    get cast() { return cast; },
    npcs,
    sheep: null,
    sparkle: (n) => Audio.sparkle(n),
    onDusk: () => fireflies.setFade(1),
    onDawn: () => fireflies.setFade(0),
    finish: () => {
      setSceneProgress('joseph', 1);
      clearCheckpoint('joseph3d');
      app.navigate('home');
    },
  };
  ctx.sequencer = new Sequencer(ctx);

  // --- sheep (independent of GLB load) ---
  ctx.sheep = new SheepFlock({
    scene, colliderWorld: colliders, pen: camp.pen, bounds,
    count: 9,
    strays: [{ x: -15, z: 9 }, { x: -2, z: 15.5 }, { x: 16.5, z: -8 }],
    onPenned: (n) => { Audio.play('sfx.pen_gate'); ctx.onStrayPenned?.(n); },
  });

  (async () => {
    await factory.loadBase();
    joseph = buildNamed(factory, 'joseph').addTo(scene);
    joseph.setPosition(0, 15);
    cast.jacob = npcs.add(buildNamed(factory, 'jacob').addTo(scene), { x: -9.8, z: -5.2, wanderR: 0, gestureEvery: 14000 });
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
        setCheckpoint('joseph3d', i);
        await beats.list[i](ctx);
      }
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
    ],
  });

  return {
    update, dispose,
    debug: {
      get joseph() { return joseph; }, get controller() { return controller; },
      get ready() { return ready; }, get storyDone() { return storyDone; },
      cast, ctx, director, sheep: () => ctx.sheep, beats, colliders, factory, audit,
    },
  };
}

// --- the dream field: wheat sheaves that BOW, and a sky that answers --------
function buildDreamField() {
  const group = new THREE.Group();
  const FIELD = { x: 62, z: 0 };

  // ground disc for the dream stage (silver-blue)
  const disc = new THREE.Mesh(new THREE.CircleGeometry(16, 28), new THREE.MeshBasicMaterial({ color: 0x3a3f66, fog: true }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(FIELD.x, 0.01, FIELD.z);
  group.add(disc);

  // a sheaf = a few leaning cones bundled; player's sheaf center, 7 around
  const mkSheaf = (x, z, scale = 1) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xd9b96a, fog: true });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.5, 4), mat);
      stalk.position.set(Math.cos(a) * 0.16, 0.75, Math.sin(a) * 0.16);
      stalk.rotation.z = Math.cos(a) * 0.22;
      stalk.rotation.x = -Math.sin(a) * 0.22;
      g.add(stalk);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 10), new THREE.MeshBasicMaterial({ color: 0x8a5a2c, fog: true }));
    band.position.y = 0.55;
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
    const s = mkSheaf(FIELD.x + Math.cos(a) * 5.2, FIELD.z + Math.sin(a) * 5.2);
    s.userData = { bowK: 0, bowed: false, toCenter: a + Math.PI };
    outer.push(s);
    group.add(s);
  }

  // sky lights for the second dream: sun, moon, eleven stars (sprites)
  const tex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d').createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    const ctx2 = c.getContext('2d');
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  })();
  const mkGlow = (size, color) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    s.scale.setScalar(size);
    return s;
  };
  const sunG = mkGlow(3.4, 0xfff0c8);
  const moonG = mkGlow(2.4, 0xcfd8ff);
  const stars = [];
  for (let i = 0; i < 11; i++) stars.push(mkGlow(0.7, 0xfff8e7));
  [sunG, moonG, ...stars].forEach((s) => group.add(s));
  sunG.position.set(FIELD.x - 6, 13, FIELD.z - 16);
  moonG.position.set(FIELD.x + 7, 14, FIELD.z - 16);
  stars.forEach((s, i) => {
    const a = (i / 11) * Math.PI;
    s.position.set(FIELD.x + Math.cos(a) * 10, 11 + Math.sin(a) * 3, FIELD.z - 14);
  });
  [sunG, moonG, ...stars].forEach((s) => { s.userData = { base: s.position.clone() }; });

  let bowingSky = 0; // 0 none, 1 descending
  return {
    group, FIELD, center, outer, sunG, moonG, stars,
    showSky(k) { [sunG, moonG, ...stars].forEach((s) => { s.material.opacity = k * (s === sunG ? 0.85 : s === moonG ? 0.7 : 0.9); }); },
    bowSky() { bowingSky = 1; },
    resetSky() {
      bowingSky = 0;
      [sunG, moonG, ...stars].forEach((s) => { s.position.copy(s.userData.base); s.material.opacity = 0; });
    },
    update(dt, t) {
      if (!this.group.visible) return;
      // outer sheaves ease into their bow
      for (const s of outer) {
        const target = s.userData.bowed ? 1 : 0;
        s.userData.bowK += (target - s.userData.bowK) * Math.min(dt * 0.004, 1);
        const k = s.userData.bowK;
        s.rotation.x = Math.sin(s.userData.toCenter) * k * 0.85;
        s.rotation.z = -Math.cos(s.userData.toCenter) * k * 0.85;
      }
      // center sheaf stands taller as others bow
      const bowedCount = outer.filter((s) => s.userData.bowed).length;
      const rise = bowedCount / outer.length;
      center.scale.setScalar(1.25 + rise * 0.35);
      // the sky bows: lights sink toward the player's sheaf
      if (bowingSky) {
        [sunG, moonG, ...stars].forEach((s) => {
          s.position.y += ((4.2) - s.position.y) * Math.min(dt * 0.0011, 1);
          s.position.x += ((FIELD.x + (s.userData.base.x - FIELD.x) * 0.35) - s.position.x) * Math.min(dt * 0.0009, 1);
          s.position.z += ((FIELD.z - 4 + (s.userData.base.z - FIELD.z) * 0.3) - s.position.z) * Math.min(dt * 0.0009, 1);
        });
      }
    },
    dispose() {
      tex.dispose();
      group.traverse((o) => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
      group.parent?.remove(group);
    },
  };
}
