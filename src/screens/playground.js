import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, mulberry32, mergeGeometries } from '../engine/world.js';
import { Audio } from '../systems/AudioSystem.js';
import { Narrator } from '../systems/Narrator.js';
import { CharacterFactory } from '../engine/CharacterFactory.js';
import { ThirdPersonCamera } from '../engine/ThirdPersonCamera.js';
import { PlayerController3D } from '../engine/PlayerController3D.js';
import { createNameTags } from '../ui/nameTags.js';
import { openSettings } from '../ui/settings.js';
import { CHARACTER_STATES } from '../engine/Character3D.js';
import { isAbortError } from '../core/async.js';

// PLAYGROUND (#playground) — NOT a story scene. A flat world to exercise the
// Phase D1 foundation: 3D characters (TEMP capsules until a GLB exists), the
// 5 animation states, the 3rd-person camera + a dramatic beat, and the narrator
// live-slider / skip demo. FPS HUD is on (Settings default).
export function buildPlayground({ scene, camera, renderer, app, signal = null }) {
  scene.fog = new THREE.Fog(0xffdfba, 46, 260);
  scene.add(makeSky({ top: 0xf2b880, bottom: 0xffe9c9 }).mesh);
  const ground = makeGround({ flatCore: 26, falloff: 40 });
  scene.add(ground);
  scene.add(makeRidges());
  scene.add(makeSun());
  const trees = makePlaygroundTrees();
  scene.add(trees);

  // Minimal light rig for the toon characters (deliberate exception to "no
  // lights" — scoped here; the world stays unlit). Warm key from the sun side.
  const key = new THREE.DirectionalLight(0xfff2d6, 1.15);
  key.position.set(-6, 10, 5);
  scene.add(key, new THREE.HemisphereLight(0xffe9c9, 0x4c4066, 0.6));

  Audio.unlock();
  const ambience = Audio.playLoop('amb.camp');
  const score = Audio.playLoop('music.warm_camp');

  const factory = new CharacterFactory();
  const nameTags = createNameTags();
  const chars = [];
  let hero = null, controller = null, tcam = null, ready = false;
  let disposed = false;
  let beatTimer = 0;

  const ui = buildUI({
    onState: (s) => hero?.play(s),
    onBeat: () => {
      if (disposed || signal?.aborted || !tcam || !hero) return;
      clearTimeout(beatTimer);
      tcam.cinematicMoveTo({ angle: Math.PI * 0.28, target: hero.position, distance: 3.4, height: 1.3, duration: 1200 });
      hero.play('talk');
      beatTimer = setTimeout(() => {
        beatTimer = 0;
        if (disposed || signal?.aborted || !tcam || !hero) return;
        tcam.release(1500);
        hero.play('idle');
      }, 2600);
    },
    onNarrate: () => {
      if (disposed || signal?.aborted) return;
      Audio.unlock();
      // Real path first (audio/vo/playground/demo/line-1); missing → a clearly
      // labeled placeholder buffer on the VOICE BUS so live sliders + skip are
      // demonstrable (TTS can't change volume mid-line).
      Narrator.speak(
        'In the beginning, God created the heavens and the earth.',
        'playground/demo/line-1',
        { signal },
      ).catch((error) => {
        if (!isAbortError(error)) console.error('[playground] narration failed', error);
      });
    },
    onSettings: () => openSettings({}),
    onHome: () => app.navigate('home'),
  });

  const whenReady = (async () => {
    const loadedGLB = await factory.loadBase(); // false while /models is empty → capsules
    if (disposed || signal?.aborted) {
      factory.dispose();
      return false;
    }
    hero = factory.create({ name: 'Joseph', scale: 1, colors: { robe: 0xcdbf9e, skin: 0xcf9a63, hair: 0x2f2620, coat: [0xb5643c, 0xcf9a4e, 0x6f8256, 0x8a5a72, 0x3f7a86] } }).setPosition(0, 1).addTo(scene);
    const jacob = factory.create({ name: 'Jacob', colors: { robe: 0x8a5a3c, skin: 0xb98a55, hair: 0xc3bdb0 } }).setPosition(-3.2, -2).addTo(scene);
    const reuben = factory.create({ name: 'Reuben', colors: { robe: 0x5a6b86, skin: 0xc98d5a, hair: 0x3a2c22 } }).setPosition(3.2, -2).addTo(scene);
    chars.push(hero, jacob, reuben);

    controller = new PlayerController3D({
      camera,
      character: hero,
      bounds: { minX: -24, maxX: 24, minZ: -24, maxZ: 20 },
      signal,
    });
    tcam = new ThirdPersonCamera(camera);
    tcam.setTarget(hero.position);
    tcam.setColliders([trees]); // pull-in vs trees (flat ground here; a hilly scene would add it)
    tcam.setYaw(Math.PI);
    tcam.frame(0, 0, 0);

    nameTags.add(hero, 'Joseph (you)');
    nameTags.add(jacob, 'Jacob');
    nameTags.add(reuben, 'Reuben');
    ui.note.textContent = loadedGLB ? 'GLB rig loaded.' : 'TEMP capsule stand-ins — drop a rig in /models to see real toon characters.';
    ready = true;
    return true;
  })();

  function update(dt) {
    if (!ready) return;
    controller.update(dt);
    tcam.setTarget(hero.position);
    tcam.frame(dt, controller.moveVec.x, controller.moveVec.y);
    for (const c of chars) if (c !== hero) c.update(dt, camera);
    nameTags.update(camera, dt);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    ready = false;
    clearTimeout(beatTimer);
    beatTimer = 0;
    ambience.stop();
    score.stop();
    ui.destroy();
    nameTags.destroy();
    controller?.dispose();
    chars.forEach((c) => c.dispose());
    factory.dispose();
  }

  return {
    update, dispose, whenReady,
    // D12 power governor hint (see app.js): full rate for motion/cinematics/
    // narration; the parked bench idles at eco-30.
    fullRate: () => !ready || Narrator.speaking || (tcam && tcam.poseK > 0)
      || (controller && controller.vel.lengthSq() > 0.02),
    debug: { get hero() { return hero; }, get controller() { return controller; }, get tcam() { return tcam; }, factory },
  };
}

// A few low-poly pines as one instanced draw call (also camera pull-in colliders).
function makePlaygroundTrees() {
  const c1 = new THREE.ConeGeometry(1.0, 2.2, 7); c1.translate(0, 2.0, 0);
  const c2 = new THREE.ConeGeometry(0.72, 1.8, 7); c2.translate(0, 3.3, 0);
  const trunk = new THREE.CylinderGeometry(0.13, 0.16, 1.1, 5); trunk.translate(0, 0.5, 0);
  const merged = mergeGeometries([c1, c2, trunk]);
  const mesh = new THREE.InstancedMesh(merged, new THREE.MeshBasicMaterial({ color: 0x3f4a3a, fog: true }), 14);
  const d = new THREE.Object3D();
  const rnd = mulberry32(7);
  let n = 0;
  while (n < 14) {
    const x = (rnd() - 0.5) * 46;
    const z = -6 - rnd() * 34;
    if (Math.hypot(x, z) < 8) continue;
    const s = 0.8 + rnd() * 1.5;
    d.position.set(x, 0, z); d.scale.setScalar(s); d.rotation.y = rnd() * Math.PI;
    d.updateMatrix(); mesh.setMatrixAt(n, d.matrix); n++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function buildUI({ onState, onBeat, onNarrate, onSettings, onHome }) {
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed; inset:0; z-index:24; pointer-events:none; font-family:"Segoe UI",system-ui,sans-serif; color:#fdf6e3;';

  const title = document.createElement('div');
  title.innerHTML = 'PLAYGROUND <span style="opacity:0.6">— Phase D1 (TEMP)</span>';
  title.style.cssText = 'position:fixed; top:calc(12px + env(safe-area-inset-top)); left:0; right:0; text-align:center; font-size:clamp(13px,2vw,16px); letter-spacing:0.14em; opacity:0.85;';

  const note = document.createElement('div');
  note.style.cssText = 'position:fixed; top:calc(38px + env(safe-area-inset-top)); left:0; right:0; text-align:center; font-size:clamp(10px,1.4vw,12px); opacity:0.6;';

  const home = mkBtn('⌂ Home', onHome);
  home.style.cssText += 'position:fixed; top:calc(12px + env(safe-area-inset-top)); left:calc(14px + env(safe-area-inset-left));';
  const gear = mkBtn('⚙', onSettings);
  gear.style.cssText += 'position:fixed; top:calc(12px + env(safe-area-inset-top)); right:calc(14px + env(safe-area-inset-right));';

  // Animation state row (also keys 1-5).
  const row = document.createElement('div');
  row.style.cssText = 'position:fixed; left:50%; transform:translateX(-50%); bottom:calc(80px + env(safe-area-inset-bottom)); display:flex; gap:8px; flex-wrap:wrap; justify-content:center; max-width:96vw;';
  CHARACTER_STATES.forEach((s, i) => {
    const b = mkBtn(`${i + 1} ${s}`, () => onState(s));
    row.append(b);
  });

  // Action row.
  const actions = document.createElement('div');
  actions.style.cssText = 'position:fixed; left:50%; transform:translateX(-50%); bottom:calc(28px + env(safe-area-inset-bottom)); display:flex; gap:8px; flex-wrap:wrap; justify-content:center; max-width:96vw;';
  actions.append(mkBtn('▶ Dramatic beat', onBeat), mkBtn('▶ Narrator test', onNarrate));

  root.append(title, note, home, gear, row, actions);
  document.body.append(root);

  const onKey = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= CHARACTER_STATES.length) onState(CHARACTER_STATES[n - 1]); };
  window.addEventListener('keydown', onKey);

  return { root, note, destroy() { window.removeEventListener('keydown', onKey); root.remove(); } };

  function mkBtn(label, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = [
      'pointer-events:auto', 'font:600 clamp(12px,1.5vw,13.5px) "Segoe UI",system-ui,sans-serif',
      'padding:9px 14px', 'border-radius:10px', 'cursor:pointer', 'color:#fdf6e3',
      'background:rgba(16,14,26,0.6)', 'border:1px solid rgba(242,184,128,0.28)',
      'transition:filter 150ms ease',
    ].join(';');
    b.onmouseenter = () => { b.style.filter = 'brightness(1.15)'; };
    b.onmouseleave = () => { b.style.filter = 'none'; };
    b.onclick = () => { Audio.uiClick?.(); onClick(); };
    return b;
  }
}
