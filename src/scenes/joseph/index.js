import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes, glowTexture, easeInOut } from '../../engine/world.js';
import { Audio } from '../../systems/AudioSystem.js';
import { setSceneProgress } from '../../systems/SaveSystem.js';
import { createStoryHud } from '../../ui/storyHud.js';
import { confirmModal } from '../../ui/modal.js';
import { createDialogue } from '../../ui/dialogue.js';
import { createVerseDisplay } from '../../ui/verse.js';
import { makeJoseph, giveCoat, makeJacob, makeReuben, makeJudah, makeBrother, makeSheep } from './cast.js';
import { PlayerController } from '../../engine/legacy2d/PlayerController.js';
import { FollowCamera } from '../../engine/legacy2d/FollowCamera.js';
import { Guidance } from '../../engine/Guidance.js';
import { Interaction } from '../../engine/legacy2d/Interaction.js';
import { Narrator } from '../../systems/Narrator.js';
import { abortReason, isAbortError, makeAbortError } from '../../core/async.js';

// JOSEPH — SCENE 1: The Coat & the Dreams (Genesis 37:1-11).
// The player walks the warm camp, receives the robe of many colors from Jacob,
// meets the jealous brothers, sees the two dreams by night, and tells them by
// morning — ending on the tension that carries into the pit. All BSB verses on
// their beats (verified). This is the check-in point: it does NOT complete the
// whole Joseph story, only records Scene 1 done.

// Name-tag colours for dialogue (character-design: distinct per person).
const NAME = { jacob: '#e0b877', joseph: '#ecd9a4', reuben: '#93a8cc', judah: '#d8ac68' };

// Warm-camp vs night palettes (environment-vibes).
const DAY = { top: 0xf2b880, bottom: 0xffe9c9, fog: 0xffdfba };
const NIGHT = { top: 0x0b1026, bottom: 0x2b3a67, fog: 0x1b2340 };

export function buildJoseph({ scene, camera, renderer, app, signal = null }) {
  scene.fog = new THREE.Fog(DAY.fog, 44, 250);
  const sky = makeSky({ top: DAY.top, bottom: DAY.bottom });
  scene.add(sky.mesh);
  scene.add(makeGround());
  scene.add(makeRidges());
  scene.add(makeSun());
  const motes = makeMotes({ count: 80 });
  scene.add(motes.points);
  scene.add(makeTents());

  let ambience = Audio.playLoop('amb.camp');
  let score = Audio.playLoop('music.warm_camp');

  // --- cast --------------------------------------------------------------
  const joseph = makeJoseph().placeAt(4, 6).addTo(scene);

  const jacob = makeJacob().placeAt(-2.5, -4).addTo(scene);
  const judah = makeJudah().placeAt(8, -3.5).addTo(scene);
  const reuben = makeReuben().placeAt(10.5, -5.5).addTo(scene);
  const b1 = makeBrother(0).placeAt(6, -6.2).addTo(scene);
  const b2 = makeBrother(1).placeAt(12, -3.2).addTo(scene);
  const sheep = [[-9, 3], [-11, -1.5], [9, 5]].map(([x, z]) => makeSheep().placeAt(x, z).addTo(scene));
  const extras = [b1, b2, ...sheep]; // idle-animated, non-interactive

  // --- systems -----------------------------------------------------------
  const controller = new PlayerController({
    camera, character: joseph, domElement: renderer.domElement,
    bounds: { minX: -13, maxX: 13, minZ: -13, maxZ: 9 },
  });
  const follow = new FollowCamera(camera);
  follow.setTarget(joseph.position);
  follow.snapToTarget();
  follow.frame(0);

  const guide = new Guidance(scene);
  const dialogue = createDialogue({ signal });
  const verse = createVerseDisplay({ signal });

  const hud = createStoryHud({
    onHome: async () => {
      controller.setEnabled(false);
      const leave = await confirmModal({
        title: 'Return home?',
        body: 'Scene 1 is saved once you reach the end. Leave now?',
        confirmText: 'Return home', cancelText: 'Keep playing',
      });
      if (leave) app.navigate('home'); else if (!storyOver) controller.setEnabled(true);
    },
    signal,
  });

  const interaction = new Interaction({ camera, getPlayerPos: () => joseph.position });

  // --- tween helpers (frame-driven so they pause with the tab) -----------
  const tweens = new Set();
  const tween = (dur, onUpdate, ease = easeInOut) => {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    return new Promise((res, reject) => tweens.add({ t: 0, dur, onUpdate, ease, res, reject }));
  };
  const sleep = (ms) => tween(ms, () => {});
  const observe = (promise) => promise.catch((error) => {
    if (!isAbortError(error)) console.error('[legacy-joseph] detached tween failed', error);
  });
  const cancelTweens = (error) => {
    for (const tw of tweens) tw.reject(error);
    tweens.clear();
  };
  const onAbort = () => cancelTweens(abortReason(signal));
  signal?.addEventListener('abort', onAbort, { once: true });
  function tickTweens(dt) {
    for (const tw of tweens) {
      tw.t += dt;
      tw.onUpdate(tw.ease(Math.min(1, tw.t / tw.dur)));
      if (tw.t >= tw.dur) { tw.res(); tweens.delete(tw); }
    }
  }
  const fogTo = (near, far, ms) => {
    const n0 = scene.fog.near, f0 = scene.fog.far;
    return tween(ms, (k) => { scene.fog.near = n0 + (near - n0) * k; scene.fog.far = f0 + (far - f0) * k; });
  };

  // --- beat state --------------------------------------------------------
  let coatDone = false;
  let brothersDone = false;
  let storyOver = false;

  interaction.add({ character: jacob, name: 'Jacob', tag: 'your father', color: NAME.jacob, radius: 2.9, onInteract: coatBeat });
  interaction.add({ character: judah, name: 'Judah', tag: 'your brother', color: NAME.judah, radius: 3.0, onInteract: brothersBeat });
  interaction.add({ character: reuben, name: 'Reuben', tag: 'the eldest', color: NAME.reuben, radius: 3.0, onInteract: brothersBeat });

  hud.setObjective('Go to your father, Jacob.');
  guide.setTarget(jacob.position);

  // --- BEAT 2: the coat (Gen 37:3) ---------------------------------------
  async function coatBeat() {
    if (coatDone) { await dialogue.say('Jacob', 'Wear it well, my son.', { color: NAME.jacob }); dialogue.hide(); return; }
    coatDone = true;
    controller.setEnabled(false);
    interaction.setEnabled(false);
    guide.setTarget(null);
    const jp = jacob.position;
    follow.toPose(new THREE.Vector3(jp.x + 3, 3.7, jp.z + 6.5), new THREE.Vector3(jp.x + 0.6, 1.7, jp.z), 1300);

    await dialogue.say('Jacob', 'Joseph… my son. Come here, close to me.', { color: NAME.jacob });
    await dialogue.say('Jacob', 'You were born to me in my old age — a joy I never dared to hope for.', { color: NAME.jacob });
    await dialogue.say('Jacob', 'Here — a robe of many colors. Let everyone see how I love you.', { color: NAME.jacob });
    dialogue.hide();

    giveCoat(joseph);
    Audio.play('sfx.robe');
    Audio.play('stinger.gift');
    await sleep(400);
    await verse.show('gen_37_3');
    verse.hide();

    follow.release(1300);
    controller.setEnabled(true);
    interaction.setEnabled(true);
    hud.setObjective('Show your brothers.');
    guide.setTarget(judah.position);
  }

  // --- BEAT 3: the brothers' jealousy (Gen 37:4) → night -----------------
  async function brothersBeat() {
    if (!coatDone || brothersDone) return;
    brothersDone = true;
    controller.setEnabled(false);
    interaction.setEnabled(false);
    guide.setTarget(null);
    const mid = new THREE.Vector3((judah.position.x + reuben.position.x) / 2, 0, (judah.position.z + reuben.position.z) / 2);
    follow.toPose(new THREE.Vector3(mid.x - 1, 3.9, mid.z + 7), new THREE.Vector3(mid.x, 1.8, mid.z), 1300);

    await dialogue.say('Judah', 'There he is — in that robe. Our father’s favorite.', { color: NAME.judah });
    await dialogue.say('Reuben', 'Say nothing to him.', { color: NAME.reuben });
    await dialogue.say('Judah', 'Nothing kind, at least.', { color: NAME.judah });
    dialogue.hide();
    Audio.play('stinger.turn');
    await verse.show('gen_37_4');
    verse.hide();

    await dreamSequence();
    await morningBeat();
    endScene();
  }

  // --- BEAT 4: the two dreams by night (Gen 37:7, 37:9) ------------------
  async function dreamSequence() {
    hud.setObjective('Night falls…');
    guide.setTarget(null);
    // Ease into night.
    sky.setColors(NIGHT.top, NIGHT.bottom, 2600);
    observe(fogTo(24, 150, 2600));
    observe(tween(2600, (k) => { scene.fog.color.lerpColors(new THREE.Color(DAY.fog), new THREE.Color(NIGHT.fog), k); }));
    ambience.stop();
    score.stop();
    ambience = Audio.playLoop('amb.night');
    score = Audio.playLoop('music.wonder');
    Audio.play('stinger.dream');
    await sleep(2200);
    hud.setObjective('');

    const jp = joseph.position;
    const tex = glowTexture(128);
    const dream = new THREE.Group();
    scene.add(dream);
    const mkGlow = (sx, sy, color, opacity) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      s.scale.set(sx, sy, 1);
      dream.add(s);
      return s;
    };

    // Sheaves: 7 around, 1 (Joseph's) in the middle. Outer bow to the center.
    follow.toPose(new THREE.Vector3(jp.x + 1, 4.4, jp.z + 8.5), new THREE.Vector3(jp.x, 1.1, jp.z - 0.5), 1600);
    const center = mkGlow(0.7, 1.9, 0xffe7ad, 0.95);
    center.position.set(jp.x, 1.0, jp.z - 0.5);
    const outer = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const g = mkGlow(0.55, 1.5, 0xffd98f, 0.85);
      g.position.set(jp.x + Math.cos(a) * 3, 1.0, jp.z - 0.5 + Math.sin(a) * 3);
      g.userData = { base: g.position.clone() };
      outer.push(g);
    }
    await verse.show('gen_37_7');
    // center rises; the others bow down toward it.
    await tween(1500, (k) => {
      center.position.y = 1.0 + k * 0.7;
      center.material.opacity = 0.95;
      for (const g of outer) {
        const b = g.userData.base;
        g.position.y = b.y - k * 0.7;
        g.position.x = b.x + (jp.x - b.x) * k * 0.3;
        g.position.z = b.z + (jp.z - 0.5 - b.z) * k * 0.3;
        g.scale.y = 1.5 * (1 - k * 0.5);
        g.material.opacity = 0.85 * (1 - k * 0.4);
      }
    });
    Audio.play('sfx.bow');
    await sleep(700);
    verse.hide();
    // fade the sheaves out
    await tween(900, (k) => { dream.children.forEach((s) => { s.material.opacity *= (1 - k * 0.25); }); });
    center.visible = false; outer.forEach((g) => { g.visible = false; });

    // Sun, moon, and eleven stars, high above — they bow toward Joseph.
    follow.toPose(new THREE.Vector3(jp.x, 3.0, jp.z + 11), new THREE.Vector3(jp.x, 8.5, jp.z - 8), 1700);
    const sunG = mkGlow(3.2, 3.2, 0xfff0c8, 0.0); sunG.position.set(jp.x - 5, 12, jp.z - 22); sunG.userData = { base: sunG.position.clone() };
    const moonG = mkGlow(2.2, 2.2, 0xcfd8ff, 0.0); moonG.position.set(jp.x + 6, 13, jp.z - 22); moonG.userData = { base: moonG.position.clone() };
    const stars = [];
    for (let i = 0; i < 11; i++) {
      const st = mkGlow(0.5, 0.5, 0xfff8e7, 0.0);
      const a = (i / 11) * Math.PI - Math.PI * 0.5;
      st.position.set(jp.x + Math.sin(a) * 9, 10.5 + Math.cos(a) * 2.2, jp.z - 20);
      st.userData = { base: st.position.clone() };
      stars.push(st);
    }
    const sky2 = [sunG, moonG, ...stars];
    await tween(1100, (k) => { sky2.forEach((s) => { s.material.opacity = (s === sunG ? 0.85 : s === moonG ? 0.7 : 0.9) * k; }); });
    await verse.show('gen_37_9');
    await tween(1600, (k) => {
      const dip = easeInOut(k);
      sky2.forEach((s) => {
        const b = s.userData.base;
        s.position.y = b.y - dip * 2.6;
        s.position.z = b.z + dip * 3.0;
      });
    });
    Audio.play('sfx.bow');
    await sleep(800);
    verse.hide();
    await tween(1000, (k) => { dream.children.forEach((s) => { s.material.opacity *= (1 - k * 0.3); }); });

    // clean up dream objects
    dream.children.forEach((s) => s.material.dispose());
    scene.remove(dream);
    tex.dispose();
    follow.release(1500);
  }

  // --- BEAT 5: morning — Joseph tells the dream; anger (Gen 37:8, 37:11) --
  async function morningBeat() {
    sky.setColors(DAY.top, DAY.bottom, 2600);
    observe(fogTo(44, 250, 2600));
    observe(tween(2600, (k) => { scene.fog.color.lerpColors(new THREE.Color(NIGHT.fog), new THREE.Color(DAY.fog), k); }));
    ambience.stop();
    score.stop();
    ambience = Audio.playLoop('amb.camp');
    score = Audio.playLoop('music.warm_camp');
    await sleep(2000);

    await dialogue.say('Joseph', 'Brothers — hear the dream I had.', { color: NAME.joseph });
    await dialogue.say('Joseph', 'The sun and moon and eleven stars… they bowed down to me.', { color: NAME.joseph });
    await dialogue.say('Judah', 'Do you intend to reign over us? Will you actually rule us?', { color: NAME.judah });
    dialogue.hide();
    Audio.play('stinger.turn');
    await verse.show('gen_37_8');
    verse.hide();

    await dialogue.say('Jacob', 'Enough… but I will keep this in my heart.', { color: NAME.jacob });
    dialogue.hide();
    await verse.show('gen_37_11');
    verse.hide();
  }

  function endScene() {
    storyOver = true;
    setSceneProgress('joseph', 1);
    guide.setTarget(null);
    hud.setObjective('');
    showEndCard(app, {
      title: 'The Coat & the Dreams',
      passage: 'Genesis 37:1-11',
      note: 'Jealousy is kindled, and a promise is planted. Joseph’s road to Egypt begins next.',
    });
  }

  // --- per-frame ---------------------------------------------------------
  function update(dt, tMs) {
    const t = tMs / 1000;
    sky.update(dt);
    motes.update(dt, t);
    tickTweens(dt);
    controller.update(dt); // idles Joseph in place when disabled
    follow.setTarget(joseph.position);
    follow.setLead(controller.vel.x, controller.vel.y);
    follow.frame(dt);
    guide.update(dt, camera);
    interaction.update(dt); // animates jacob/judah/reuben + proximity prompts
    for (const c of extras) c.animate(dt, camera, 0, 0);

    // Idle nudge on the current objective if the player stands still.
    if (!storyOver && controller.vel.length() < 0.2 && guide.visible) {
      idle += dt; if (idle > 12000) { hud.pulse(); idle = 0; }
    } else idle = 0;
  }
  let idle = 0;

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener('abort', onAbort);
    cancelTweens(signal?.aborted ? abortReason(signal) : makeAbortError('Legacy Joseph disposed'));
    Narrator.stop('scene-exit');
    ambience.stop();
    score.stop();
    hud.destroy();
    dialogue.destroy();
    verse.destroy();
    guide.dispose();
    interaction.dispose();
    controller.dispose();
    joseph.dispose();
    jacob.dispose(); judah.dispose(); reuben.dispose();
    extras.forEach((c) => c.dispose());
    document.getElementById('joseph-endcard')?.remove();
  }

  return {
    update,
    dispose,
    // The legacy route still contains authored camera/tween/dialogue motion.
    // Keep those moments at 60 fps; only its truly parked ambient state may
    // use the app-wide eco cadence.
    fullRate: () => tweens.size > 0
      || controller.vel.lengthSq() > 0.01
      || interaction.busy
      || dialogue.isOpen
      || verse.el.style.opacity === '1'
      || follow.poseK > 0
      || follow._poseDir !== 0,
    debug: { joseph, jacob, judah, reuben, controller, follow, guide, interaction, coatBeat, brothersBeat },
  };
}

// A few simple tents so the camp reads as a place. One instanced draw call.
function makeTents() {
  const geo = new THREE.ConeGeometry(1.6, 2.0, 4);
  geo.rotateY(Math.PI / 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xb89a6a, fog: true });
  const spots = [[-9, -8], [10, -9], [-12, 1], [13, 4], [-4, -12]];
  const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
  const d = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    d.position.set(x, 1.0, z);
    const s = 0.9 + (i % 3) * 0.25;
    d.scale.set(s, s, s);
    d.rotation.y = i * 0.7;
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// The closing card for Scene 1 (this is the check-in point — it does not
// complete the whole Joseph story).
function showEndCard(app, { title, passage, note }) {
  const wrap = document.createElement('div');
  wrap.id = 'joseph-endcard';
  wrap.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:55', 'display:flex', 'align-items:center', 'justify-content:center',
    'background:rgba(8,7,14,0.72)', 'opacity:0', 'transition:opacity 600ms ease',
    'font-family:"Segoe UI",system-ui,sans-serif', 'color:#fdf6e3', 'pointer-events:auto',
  ].join(';');
  const card = document.createElement('div');
  card.style.cssText = [
    'text-align:center', 'max-width:min(90vw,440px)', 'padding:26px 28px',
    'background:rgba(16,14,26,0.9)', 'border:1px solid rgba(242,184,128,0.2)', 'border-radius:16px',
    'box-shadow:0 16px 48px rgba(0,0,0,0.5)',
  ].join(';');
  card.innerHTML =
    `<div style="font-family:Georgia,serif;font-size:26px;margin-bottom:4px">${title}</div>` +
    `<div style="font-size:12.5px;letter-spacing:0.14em;opacity:0.62;margin-bottom:16px">${passage}</div>` +
    `<div style="font-size:14.5px;line-height:1.6;font-style:italic;opacity:0.9;margin-bottom:22px">${note}</div>`;
  const btn = document.createElement('button');
  btn.textContent = 'Return to the map';
  btn.style.cssText = 'font:600 15px "Segoe UI",system-ui,sans-serif;padding:12px 24px;border-radius:11px;border:none;background:#f2b880;color:#241f38;cursor:pointer;';
  btn.onclick = () => { Audio.uiClick(); app.navigate('home'); };
  card.append(btn);
  wrap.append(card);
  document.body.append(wrap);
  requestAnimationFrame(() => { wrap.style.opacity = '1'; });
}
