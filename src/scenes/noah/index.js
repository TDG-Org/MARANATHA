import * as THREE from 'three';
import { makeSky, makeRidges, makeGround, makeSun, makeMotes, mulberry32, mergeGeometries, dyeGeometry, toonMat } from '../../engine/world.js';
import { ColliderWorld } from '../../engine/collision.js';
import { CameraDirector } from '../../engine/CameraDirector.js';
import { PlayerController3D } from '../../engine/PlayerController3D.js';
import { CharacterFactory } from '../../engine/CharacterFactory.js';
import { ContactShadowPool } from '../../engine/ContactShadowPool.js';
import { makeSmoke, makeEmbers } from '../../engine/particles.js';
import { loadOwnedTexture } from '../../engine/textureLoader.js';
import { auditLayout } from '../../engine/layoutAudit.js';
import { Graphics, particleCapacity } from '../../systems/Graphics.js';
import { Audio } from '../../systems/AudioSystem.js';
import { createPauseMenu } from '../../ui/pause.js';
import { openSettings } from '../../ui/settings.js';
import { confirmModal } from '../../ui/modal.js';
import { makeAbortError } from '../../core/async.js';
import {
  ARK, KEEL_Y, EAVES_Y, DECK_Y, DOOR, HOLD, CORRIDOR, HULL, COLORS, CUBIT,
} from './arkSpec.js';
import { buildHull, station } from './hull.js';
import { buildDecks } from './decks.js';
import { buildSite } from './site.js';
import { createWood } from './wood.js';
import { buildHud } from './hud.js';

// NOAH — THE ARK, WALKABLE.
//
// Deliberately NOT a story scene yet. Nate asked for the environment and the
// model first: somewhere to stand at the foot of a 137 m hull, walk up the ramp,
// go in through the door, and climb all three decks. No beats, no dialogue, no
// verses on screen. The whole scene is a place, and the point is whether the
// place is worth being in.
//
// Genesis 6:14-16 is the spec, and arkSpec.js holds every number it gives.

export function buildNoahArk({ scene, camera, renderer, app, signal = null }) {
  if (signal?.aborted) throw signal.reason || makeAbortError('Noah scene build aborted');
  let disposed = false;

  // ── THE WORLD BEFORE THE FLOOD ─────────────────────────────────────────────
  // Genesis 6 happens in a world that has never seen rain (Gen 2:5-6 is the
  // usual reading). So: green, deep, unhurried, and completely dry. The weather
  // in this scene is the last good weather there was.
  const SKY_TOP = 0x6f9fc4;
  const SKY_BOTTOM = 0xdfe8dc;
  scene.fog = new THREE.Fog(0xc8d6c9, 90, Graphics.fogFar);
  const sky = makeSky({ top: SKY_TOP, bottom: SKY_BOTTOM, offset: 0.18, exponent: 0.7 });
  scene.add(sky.mesh);

  const textureReadiness = [];
  const loadTiled = (url, rx, ry, wrap = THREE.RepeatWrapping) => {
    const { texture, whenReady } = loadOwnedTexture(url, {
      signal,
      configure: (t) => {
        t.wrapS = t.wrapT = wrap;
        t.repeat.set(rx, ry);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = Graphics.anisotropy;
      },
    });
    textureReadiness.push(whenReady);
    return texture;
  };
  const grassTex = loadTiled('textures/grass.jpg', 120, 80, THREE.MirroredRepeatWrapping);
  const dirtTex = loadTiled('textures/dirt.jpg', 8, 8);
  const worldTextures = { grass: grassTex, dirt: dirtTex };

  // The building site is a huge FLAT pad — level-layout law 1. A 137 m hull
  // cannot sit on rolling ground without the terrain coming up through it
  // somewhere along its length.
  const ground = makeGround({
    color: 0xffffff,
    mottle: [0xdfefb8, 0xc7b98a],
    map: grassTex,
    width: 460, depth: 320, z: 0,
    segX: 110, segZ: 76,
    pads: [{ x: 0, z: 8, flatCore: 118, falloff: 62 }],
  });
  ground.position.y = 0.02; // so the walked surface is exactly y = 0
  scene.add(ground);

  const ridges = makeRidges({ veryFar: 0x8fa3ad, far: 0x7d94a0, mid: 0x5f7a72 });
  scene.add(ridges);
  const sunSprite = makeSun({ x: -120, y: 74, z: -240, core: 54, halo: 150, color: 0xfff6e0 });
  scene.add(sunSprite);
  const motes = makeMotes({ count: particleCapacity(60), spanX: 200, spanZ: 140 });
  scene.add(motes.points);

  // One sun, one sky fill. No shadows anywhere in this engine, so the interior
  // gets its depth from baked vertex shading and from the lantern pool below.
  const keyLight = new THREE.DirectionalLight(0xfff4dd, 1.22);
  keyLight.position.set(-52, 46, 34);
  const hemiLight = new THREE.HemisphereLight(0xdfe8dc, 0x54603f, 0.62);
  scene.add(keyLight, hemiLight);

  // ── THE ARK ────────────────────────────────────────────────────────────────
  const wood = createWood();
  const colliders = new ColliderWorld();
  colliders.bodyHeight = 1.7;

  const hull = buildHull(wood);
  const arkGroup = new THREE.Group();
  arkGroup.name = 'ark';
  arkGroup.add(hull.exterior, hull.interior);
  scene.add(arkGroup);

  const decks = buildDecks(wood);
  arkGroup.add(decks.group);
  decks.colliders.forEach((c) => colliders.add(c));

  const site = buildSite(wood);
  scene.add(site.group);
  site.colliders.forEach((c) => colliders.add(c));

  // The door reveal: the hull skin is 0.42 m thick, and a hole cut through it
  // with nothing lining it reads as paper. This is the jamb, head and sill you
  // actually walk between.
  {
    const g = [];
    const zOut = station(DOOR.x / ARK.halfLength).halfWidth;
    const zIn = zOut - HULL.skin;
    const y0 = DOOR.sillY;
    const y1 = DOOR.sillY + DOOR.height;
    for (const sx of [-1, 1]) {
      const jamb = new THREE.BoxGeometry(0.34, y1 - y0 + 0.5, HULL.skin + 0.12);
      jamb.translate(DOOR.x + sx * (DOOR.width / 2 + 0.14), (y0 + y1) / 2, (zIn + zOut) / 2);
      g.push(dyeGeometry(jamb, COLORS.timberDark));
    }
    const head = new THREE.BoxGeometry(DOOR.width + 0.9, 0.42, HULL.skin + 0.12);
    head.translate(DOOR.x, y1 + 0.2, (zIn + zOut) / 2);
    g.push(dyeGeometry(head, COLORS.timberDark));
    const sill = new THREE.BoxGeometry(DOOR.width + 0.9, 0.22, HULL.skin + 0.3);
    sill.translate(DOOR.x, y0 - 0.09, (zIn + zOut) / 2);
    g.push(dyeGeometry(sill, COLORS.beam));
    const frame = new THREE.Mesh(mergeGeometries(g), wood.matTimber());
    frame.geometry.computeVertexNormals();
    frame.name = 'door-frame';
    arkGroup.add(frame);
  }

  // ── LANTERNS ───────────────────────────────────────────────────────────────
  // The interior would otherwise be lit exactly like the outdoors, because a
  // directional light does not know a wall is in the way. Three point lights
  // ride with the player as a warm pool, and static lantern glows down each
  // corridor give the eye something to walk toward. The light COUNT never
  // changes — it is baked into every lit material's shader key, so toggling one
  // would recompile the world mid-stride.
  const lanternPool = [0, 1, 2].map(() => {
    const l = new THREE.PointLight(0xffb974, 0, 17, 1.5);
    scene.add(l);
    return l;
  });
  const lanternAnchors = [];
  {
    const g = [];
    for (let d = 0; d < 3; d++) {
      for (let x = HOLD.minX + 8; x < HOLD.maxX; x += 13.5) {
        const z = (d % 2 ? 1 : -1) * (CORRIDOR.halfWidth + 0.55);
        const y = DECK_Y[d] + 2.35;
        lanternAnchors.push({ x, y, z, deck: d });
        const body = new THREE.CylinderGeometry(0.17, 0.20, 0.34, 7);
        body.translate(x, y, z);
        g.push(dyeGeometry(body, COLORS.ironDark));
        const hook = new THREE.BoxGeometry(0.05, 0.5, 0.05);
        hook.translate(x, y + 0.4, z);
        g.push(dyeGeometry(hook, COLORS.ironDark));
      }
    }
    const m = new THREE.Mesh(mergeGeometries(g), wood.matTimber());
    m.geometry.computeVertexNormals();
    m.name = 'lanterns';
    arkGroup.add(m);

    // the flame glows, additive and fog-exempt
    const tex = glowSprite();
    const sprites = new THREE.Group();
    lanternAnchors.forEach((a) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0xffc487, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      s.position.set(a.x, a.y, a.z);
      s.scale.setScalar(1.1);
      sprites.add(s);
    });
    sprites.name = 'lantern-glows';
    arkGroup.add(sprites);
  }

  // ── THE LIGHT FROM THE WINDOW BAND ─────────────────────────────────────────
  // Genesis 6:16 gives the ark one cubit of opening under the roof, the length of
  // both sides. On the top deck that is a ribbon of daylight, and shafts of it
  // falling in are the single prettiest thing in the interior.
  const shafts = new THREE.Group();
  {
    const tex = shaftTexture();
    for (let x = HOLD.minX + 6; x < HOLD.maxX; x += 9.5) {
      for (const side of [-1, 1]) {
        const st = station(x / ARK.halfLength);
        const w = 3.4;
        const h = EAVES_Y - DECK_Y[2];
        const geo = new THREE.PlaneGeometry(w, h);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.20, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
          color: 0xfff0cf,
        }));
        // leaning inward from the band toward the deck
        m.position.set(x, DECK_Y[2] + h / 2, side * (st.halfWidth - HULL.skin - 1.5));
        m.rotation.y = Math.PI / 2;
        m.rotation.z = side * 0.16;
        shafts.add(m);
      }
    }
    shafts.name = 'window-shafts';
    arkGroup.add(shafts);
  }

  // ── PARTICLES ──────────────────────────────────────────────────────────────
  const smoke = makeSmoke({ count: particleCapacity(26) });
  const embers = makeEmbers({ count: particleCapacity(14) });
  site.fireEmitters.forEach((e) => { smoke.addEmitter(e.x, e.y, e.z); embers.addEmitter(e.x, e.y, e.z); });
  smoke.init();
  embers.init();
  scene.add(smoke.points, embers.points);
  const fireLights = site.fireEmitters.map((e) => {
    const l = new THREE.PointLight(0xff8a3c, 0.9, 9, 1.6);
    l.position.set(e.x, 1.0, e.z);
    scene.add(l);
    return { light: l, phase: e.x * 1.7 };
  });

  // ── AUDIO ──────────────────────────────────────────────────────────────────
  Audio.unlock?.();
  const silent = () => ({ stop() {}, setGain() {} });
  let beds = null;
  let audioActivated = false;
  const startBeds = () => {
    if (beds) return;
    beds = {
      wind: Audio.playLoop('amb.camp_wind', { gain: 0.85 }) || silent(),
      fire: Audio.playLoop('amb.fire_crackle', { gain: 0 }) || silent(),
      work: Audio.playLoop('amb.shipyard', { gain: 0.7 }) || silent(),
    };
  };
  let music = null;

  // ── PLAYER + CAMERA ────────────────────────────────────────────────────────
  const factory = new CharacterFactory();
  let player = null;
  let controller = null;
  let contactShadows = null;
  let ready = false;

  const bounds = { minX: -104, maxX: 104, minZ: -56, maxZ: 68 };
  const director = new CameraDirector(camera, {
    yaw: Math.PI,
    // Outside, stand well back: the subject of the shot is a 137 m ship, not a
    // person. This is a wider, higher lens than any other scene in the game.
    distance: 9.4,
    height: 4.0,
    lookHeight: 1.6,
    // Inside, a prop between the lens and the player must not ghost the whole
    // hull, so nothing is registered as an occluder; the interior/exterior swap
    // below does that job in O(1) instead of raycasting 22k triangles a frame.
    occludeOpacity: 1,
  });
  director.setZones([
    // Aboard: the decks are 21 m wide and under 4 m high, so the outdoor lens
    // would put the camera through the ceiling and out the far side.
    {
      shape: 'rect',
      minX: HOLD.minX - 6, maxX: HOLD.maxX + 6,
      minZ: -HOLD.halfWidth - 2, maxZ: HOLD.halfWidth + 2,
      yaw: Math.PI, distance: 5.4, height: 2.05, lookHeight: 1.5,
    },
    // On the boarding ramp, looking up at the door.
    {
      shape: 'rect',
      minX: DOOR.x - 6, maxX: DOOR.x + 6,
      minZ: ARK.halfWidth - 1, maxZ: ARK.halfWidth + 14,
      yaw: Math.PI, distance: 7.4, height: 3.1, lookHeight: 1.6,
    },
  ]);

  const hud = buildHud({
    onHome: async () => {
      const wasOn = controller?.enabled;
      controller?.setEnabled(false);
      const leave = await confirmModal({
        title: 'Return home?',
        body: 'The ark will be here when you come back.',
        confirmText: 'Return home',
        cancelText: 'Keep looking',
      });
      if (leave) await app.navigate('home');
      else controller?.setEnabled(wasOn !== false);
    },
    onSettings: () => openSettings({}),
  });

  const pause = createPauseMenu({
    app,
    isInputOn: () => !!controller?.enabled,
    setInput: (on) => controller?.setEnabled(on),
    onSettings: () => openSettings({}),
    onHome: async () => {
      const leave = await confirmModal({
        title: 'Return home?',
        body: 'The ark will be here when you come back.',
        confirmText: 'Return home',
        cancelText: 'Keep looking',
      });
      if (leave) await app.navigate('home');
      return leave;
    },
  });

  const onCanvasContextMenu = (e) => e.preventDefault();
  renderer.domElement.addEventListener('contextmenu', onCanvasContextMenu);

  const castReady = (async () => {
    await factory.loadBase();
    if (disposed || signal?.aborted) { factory.dispose(); return false; }
    player = factory.create({
      name: 'Noah',
      scale: 1.0,
      colors: { robe: 0x7d6a4e, skin: 0xc08a55, hair: 0xb9b0a4 },
    }).addTo(scene);
    player.setPosition(decks.spawn.x, decks.spawn.z);
    player.position.y = 0;

    controller = new PlayerController3D({
      camera,
      character: player,
      bounds,
      colliders,
      radius: 0.42,
      floors: decks.floors,
      signal,
    });
    controller.onFootstep = () => Audio.play('sfx.footstep_grass');

    if (Graphics.contactShadow) {
      contactShadows = new ContactShadowPool(scene, 4);
      contactShadows.add(player);
    }

    director.setTarget(player.position);
    director.snap();

    await Promise.all(textureReadiness);
    ready = true;
    return true;
  })();

  // ── INSIDE OR OUTSIDE ──────────────────────────────────────────────────────
  // The one piece of per-frame logic the whole walkable interior needs. The
  // outer skin faces outward, so a camera behind a player standing inside is
  // looking at the back of it — the hull would simply be a wall across the
  // screen. Hiding the outer skin lets the camera see straight through to the
  // interior, because the INNER skin faces inward and is itself invisible from
  // outside. That is the entire cutaway system: one boolean and a fade.
  const insideAt = (p) => (
    p.y > KEEL_Y - 0.4
    && Math.abs(p.x) < ARK.halfLength - 1
    && Math.abs(p.z) < station(p.x / ARK.halfLength).halfWidth - 0.1
  );
  let insideK = 0;      // 0 = fully outside, 1 = fully aboard
  let hullFaded = false;
  hull.exterior.material.transparent = false;

  function applyInsideness(k) {
    const opacity = 1 - k;
    const mat = hull.exterior.material;
    if (opacity >= 0.999) {
      if (hullFaded) {
        mat.opacity = 1;
        mat.transparent = false;
        mat.depthWrite = true;
        hull.exterior.visible = true;
        hullFaded = false;
      }
      return;
    }
    hullFaded = true;
    // Fully faded: stop drawing it at all rather than submitting a transparent
    // 11k-triangle pass every frame the player is aboard.
    hull.exterior.visible = opacity > 0.02;
    mat.transparent = true;
    mat.depthWrite = false;
    mat.opacity = opacity;
    // The scaffolding and stocks stand between an outside camera and an inside
    // player too, and a lattice across the lens is worse than a wall.
    site.group.visible = k < 0.85;
  }

  // ── PER-FRAME ──────────────────────────────────────────────────────────────
  const tmpV = new THREE.Vector3();
  function update(dt, tMs) {
    const t = tMs / 1000;
    sky.update(dt);
    motes.update(dt, t);
    smoke.update(dt, t);
    embers.update(dt, t);
    for (const f of fireLights) {
      const flick = 0.85 + Math.sin(t * 11 + f.phase) * 0.16 + Math.sin(t * 5.3 + f.phase) * 0.09;
      f.light.intensity = Math.max(0, flick);
    }

    if (!ready) return;
    controller.update(dt);

    const p = player.position;
    const wantInside = insideAt(p) ? 1 : 0;
    // A fade, not a cut: crossing the threshold should feel like walking in.
    insideK += (wantInside - insideK) * Math.min(dt * 0.006, 1);
    applyInsideness(insideK);

    // The lantern pool follows the player along whichever deck they are on.
    if (insideK > 0.05) {
      const deck = controller.deck;
      let n = 0;
      // nearest anchors on this deck, forward and back
      const sorted = lanternAnchors
        .filter((a) => !deck || `deck${a.deck + 1}` === deck || Math.abs(a.y - p.y) < 3.2)
        .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
      for (; n < lanternPool.length; n++) {
        const a = sorted[n];
        if (!a) { lanternPool[n].intensity = 0; continue; }
        lanternPool[n].position.set(a.x, a.y, a.z);
        lanternPool[n].intensity = insideK * (1.5 + Math.sin(t * 7 + a.x) * 0.12);
      }
    } else {
      for (const l of lanternPool) l.intensity = 0;
    }

    // The shafts only exist on the top deck; keep them out of the way otherwise.
    shafts.visible = insideK > 0.4 && p.y > DECK_Y[2] - 2;

    if (contactShadows?.mesh.visible) contactShadows.update();
    director.setTarget(p);
    director.setLead(controller.vel.x, controller.vel.y);
    director.frame(dt);

    // fire crackle proximity
    if (beds) {
      let nearest = Infinity;
      for (const e of site.fireEmitters) nearest = Math.min(nearest, Math.hypot(p.x - e.x, p.z - e.z));
      beds.fire.setGain(Math.max(0, 1 - nearest / 9));
    }

    hud.setReadout(p, controller.deck, insideK);
  }

  const applyLiveGraphics = (graphics = Graphics) => {
    scene.fog.far = graphics.fogFar;
    for (const tex of Object.values(worldTextures)) {
      if (tex.anisotropy === graphics.anisotropy) continue;
      tex.anisotropy = graphics.anisotropy;
      tex.needsUpdate = true;
    }
    motes.setActiveCount?.(graphics.particles(60));
    smoke.setActiveCount?.(graphics.particles(26));
    embers.setActiveCount?.(graphics.particles(14));
  };
  const unsubscribeGraphics = Graphics.subscribe((g) => applyLiveGraphics(g));
  applyLiveGraphics(Graphics);

  function dispose() {
    if (disposed) return;
    disposed = true;
    ready = false;
    renderer.domElement.removeEventListener('contextmenu', onCanvasContextMenu);
    Object.values(beds || {}).forEach((b) => b.stop(0.6));
    music?.stop(0.6);
    Audio.stopOneShots();
    Audio.stopMusic();
    unsubscribeGraphics();
    hud.destroy();
    pause.destroy();
    controller?.dispose();
    contactShadows?.dispose();
    player?.dispose();
    factory.dispose();
    smoke.dispose();
    embers.dispose();
    decks.dispose();
    site.dispose();
    wood.dispose();
  }

  const audit = () => auditLayout({
    colliderWorld: colliders,
    ground,
    decorations: site.decorations,
    zones: [],
    stages: [{ x: 0, z: 8, r: 100, label: 'building-site' }],
  });

  return {
    update,
    dispose,
    whenReady: Promise.all([castReady, Promise.all(textureReadiness)]).then(() => {
      if (disposed || signal?.aborted) throw signal?.reason || makeAbortError('Noah scene left before readiness');
      return true;
    }),
    activate() {
      if (disposed || audioActivated) return;
      audioActivated = true;
      startBeds();
      music = Audio.playLoop('music.build') || silent();
    },
    // The site is full of authored motion (smoke, embers, motes, the fire
    // flicker), but none of it is fast, so a parked player still drops to eco.
    fullRate: () => !ready
      || (controller && (controller.vel.lengthSq() > 0.02 || controller.falling))
      || (insideK > 0.01 && insideK < 0.99)
      || director.inCinematic,
    debugSnapshot: () => ({
      pos: player ? [round2(player.position.x), round2(player.position.y), round2(player.position.z)] : null,
      deck: controller?.deck ?? null,
      inside: round2(insideK),
    }),
    debug: {
      get player() { return player; },
      get controller() { return controller; },
      get ready() { return ready; },
      get insideK() { return insideK; },
      hull, decks, site, colliders, director, factory, audit,
      floors: decks.floors,
    },
  };
}

const round2 = (v) => Math.round(v * 100) / 100;

function glowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,225,180,1)');
  g.addColorStop(0.4, 'rgba(255,180,110,0.45)');
  g.addColorStop(1, 'rgba(255,160,90,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A soft vertical wedge — brightest at the top where it enters the band, fading
// as it falls to the deck. Additive, so it reads as light rather than as a card.
function shaftTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,246,222,0.95)');
  g.addColorStop(0.55, 'rgba(255,240,205,0.35)');
  g.addColorStop(1, 'rgba(255,236,196,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 128);
  // feather the vertical edges so the plane never shows as a rectangle
  const edge = ctx.createLinearGradient(0, 0, 32, 0);
  edge.addColorStop(0, 'rgba(0,0,0,1)');
  edge.addColorStop(0.5, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 32, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
