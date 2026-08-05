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
  ARK, KEEL_Y, EAVES_Y, DECK_Y, DECK_PITCH, DOOR, HOLD, CORRIDOR, HULL, COLORS, CUBIT,
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
  const SKY_TOP = 0x4d86b8;
  const SKY_BOTTOM = 0xcfe0dd;
  // FOG IS SCALED TO THE SUBJECT. Every other scene in this game is a camp
  // about forty units across, and the presets' 200-300 fog was tuned for that.
  // The ark alone is 137 units long, so a wide shot puts its far end at 150+ and
  // the preset fog erased the entire stern into white haze. The preset still
  // decides the RELATIVE draw distance; this scene just needs a lot more of it.
  const fogFar = () => Graphics.fogFar * 2.8;
  scene.fog = new THREE.Fog(0xa8bcc0, 170, fogFar());
  const sky = makeSky({ top: SKY_TOP, bottom: SKY_BOTTOM, offset: 0.06, exponent: 0.62 });
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
  const grassTex = loadTiled('textures/grass.jpg', 62, 44, THREE.MirroredRepeatWrapping);
  const dirtTex = loadTiled('textures/dirt.jpg', 8, 8);
  const worldTextures = { grass: grassTex, dirt: dirtTex };

  // The building site is a huge FLAT pad — level-layout law 1. A 137 m hull
  // cannot sit on rolling ground without the terrain coming up through it
  // somewhere along its length.
  const ground = makeGround({
    // WHITE base, near-white mottle. The supplied grass photo already carries
    // all the green there is (it averages about 0.13 linear), so any green tint
    // here MULTIPLIES it into near-black — the same trap D6 documented for the
    // camp. The mottle only breaks up the tiling.
    color: 0xffffff,
    mottle: [0xfbffe8, 0xf2e6c4],
    map: grassTex,
    width: 460, depth: 320, z: 0,
    // 110x76 was 16,720 triangles — 18% of the whole scene — spent on a pad
    // that is DEAD FLAT across the entire building site. Tessellation only buys
    // anything where the terrain actually rolls (beyond the pad) and for the
    // vertex mottle, and neither needs a vertex every four metres. At 64x44 the
    // cells are ~7m, the mottle is a near-white wash over a grass photo so it
    // reads identically, and 11,088 triangles come back.
    segX: 64, segZ: 44,
    pads: [{ x: 0, z: 8, flatCore: 118, falloff: 62 }],
  });
  ground.position.y = 0.02; // so the walked surface is exactly y = 0
  scene.add(ground);

  // Distinctly DARKER than the sky. At near-sky values these flats read as sheets
  // of glass standing in mid-air rather than as land, because they are unlit and
  // barely fogged at this draw distance.
  const ridges = makeRidges({ veryFar: 0x6f8fa2, far: 0x5d7d84, mid: 0x47664f });
  // Dropped so only the crests clear the treeline. At full height the far flat
  // is a pale sheet standing in an otherwise saturated sky and reads as glass;
  // the forest closes the horizon far better than a mountain range does.
  ridges.position.y = -34;
  scene.add(ridges);
  const sunSprite = makeSun({ x: 150, y: 96, z: 150, core: 44, halo: 128, color: 0xfff6e0 });
  scene.add(sunSprite);
  const motes = makeMotes({ count: particleCapacity(60), spanX: 200, spanZ: 140 });
  scene.add(motes.points);

  // One sun, one sky fill. No shadows anywhere in this engine, so the interior
  // gets its depth from baked vertex shading and from the lantern pool below.
  // The player spawns south of the hull and the follow camera looks north, so
  // the +Z side IS the hero side - the one with the door in it. Light that.
  const keyLight = new THREE.DirectionalLight(0xfff4dd, 1.62);
  keyLight.position.set(74, 54, 86);
  const hemiLight = new THREE.HemisphereLight(0xe4efe6, 0x6b7a52, 1.05);
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

  // The ground is FLAT across the building site and rolls beyond it, so anything
  // placed out in the landscape has to be planted on the terrain rather than on
  // y=0. Sampled once per prop at build time — 400-odd raycasts, then never
  // again — which is what stopped the far treeline hovering and sinking.
  const groundRay = new THREE.Raycaster();
  const groundDown = new THREE.Vector3(0, -1, 0);
  const groundFrom = new THREE.Vector3();
  ground.updateMatrixWorld(true);
  const heightAt = (x, z) => {
    groundFrom.set(x, 80, z);
    groundRay.set(groundFrom, groundDown);
    const hit = groundRay.intersectObject(ground, false)[0];
    return hit ? hit.point.y : 0;
  };

  // Where the player can actually go. Declared here because the forest's
  // level-of-detail bucketing is measured against it — two hard-coded copies
  // would drift the moment anyone widened the playable area.
  const bounds = { minX: -104, maxX: 104, minZ: -56, maxZ: 68 };

  const site = buildSite(wood, { heightAt, bounds });
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
      g.push(dyeGeometry(jamb, 0xc7b295));
    }
    const head = new THREE.BoxGeometry(DOOR.width + 0.9, 0.42, HULL.skin + 0.12);
    head.translate(DOOR.x, y1 + 0.2, (zIn + zOut) / 2);
    g.push(dyeGeometry(head, 0xc7b295));
    const sill = new THREE.BoxGeometry(DOOR.width + 0.9, 0.22, HULL.skin + 0.3);
    sill.translate(DOOR.x, y0 - 0.09, (zIn + zOut) / 2);
    g.push(dyeGeometry(sill, 0xd9c7ab));
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
  let lanternGlows = null;
  {
    const g = [];
    for (let d = 0; d < 3; d++) {
      for (let x = HOLD.minX + 8; x < HOLD.maxX; x += 13.5) {
        const z = (d % 2 ? 1 : -1) * (CORRIDOR.halfWidth + 0.55);
        const y = DECK_Y[d] + 2.35;
        lanternAnchors.push({ x, y, z, deck: d });
        const body = new THREE.CylinderGeometry(0.17, 0.20, 0.34, 7);
        body.translate(x, y, z);
        g.push(dyeGeometry(body, 0x6e6a63));
        const hook = new THREE.BoxGeometry(0.05, 0.5, 0.05);
        hook.translate(x, y + 0.4, z);
        g.push(dyeGeometry(hook, 0x57534d));
      }
    }
    const m = new THREE.Mesh(mergeGeometries(g), toonMat(0xffffff, { vertexColors: true }));
    m.geometry.computeVertexNormals();
    m.name = 'lanterns';
    arkGroup.add(m);

    // The flame glows, additive and fog-exempt. ONE material for all of them —
    // a Sprite is a draw call each, and eighteen of them was 22% of the whole
    // scene's draw budget spent on little blobs of light.
    const tex = glowSprite();
    const glowMat = new THREE.SpriteMaterial({
      map: tex, color: 0xffc487, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const sprites = new THREE.Group();
    lanternAnchors.forEach((a) => {
      const s = new THREE.Sprite(glowMat);
      s.position.set(a.x, a.y, a.z);
      s.scale.setScalar(1.1);
      s.userData.anchorY = a.y;
      sprites.add(s);
    });
    sprites.name = 'lantern-glows';
    lanternGlows = sprites;
    arkGroup.add(sprites);
  }

  // ── THE LIGHT FROM THE WINDOW BAND ─────────────────────────────────────────
  // Genesis 6:16 gives the ark one cubit of opening under the roof, the length of
  // both sides. On the top deck that is a ribbon of daylight, and shafts of it
  // falling in are the single prettiest thing in the interior.
  const shafts = new THREE.Group();
  let shaftOpacity = 0.20;
  {
    const tex = shaftTexture();
    for (let x = HOLD.minX + 6; x < HOLD.maxX; x += 9.5) {
      for (const side of [-1, 1]) {
        const st = station(x / ARK.halfLength);
        const w = 5.2;
        const h = EAVES_Y - DECK_Y[2];
        const geo = new THREE.PlaneGeometry(w, h);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          map: tex, transparent: true, opacity: 0.20, depthWrite: false,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
          color: 0xfff0cf,
        }));
        // leaning inward from the band toward the deck
        // Broadside to the corridor. Facing them ACROSS the ship put their
        // normal along the one axis the player always looks down, so the whole
        // effect was invisible edge-on — a light shaft nobody could ever see.
        m.position.set(x, DECK_Y[2] + h / 2, side * (st.halfWidth - HULL.skin - 1.9));
        m.rotation.z = side * 0.20;
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
  // ONE POOL, NOT TWO. The pitch fires and the below-decks lanterns are never
  // both relevant: the fires are outside and the whole site is hidden while the
  // player is aboard. Two separate pools meant the scene carried FIVE point
  // lights at all times, and every lit fragment in the game pays for every one
  // of them whether it contributes or not — the count cannot be changed at
  // runtime either, because it is baked into each material's shader cache key
  // (D24). Sharing three lights between the two jobs cuts the per-pixel lighting
  // work by 40% and never changes the count.
  const firePlaces = site.fireEmitters.map((e) => ({ x: e.x, y: 1.0, z: e.z, phase: e.x * 1.7 }));

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
      // Trailing DEAD astern puts the camera at exactly the player's x, so any
      // stanchion sharing that x stands squarely between the lens and the
      // player — and in a colonnaded hold that happens every few strides. The
      // posts cannot be faded (they are one instanced draw, so fading one ghosts
      // them all — the D4 tent lesson), so the lens moves off the axis instead.
      // It also composes better: you see down the hold rather than at the back
      // of a head.
      yaw: Math.PI * 0.90, distance: 5.6, height: 2.35, lookHeight: 1.45,
    },
    // On the boarding ramp, looking up at the door.
    {
      shape: 'rect',
      minX: DOOR.x - 6, maxX: DOOR.x + 6,
      minZ: ARK.halfWidth - 1, maxZ: ARK.halfWidth + 14,
      yaw: Math.PI, distance: 7.4, height: 3.1, lookHeight: 1.6,
    },
  ]);

  // THE SCENE'S OWN TRUTH ABOUT INPUT, kept separately from the controller's
  // live flag. The pause menu restores input on resume by asking the scene what
  // it WANTS ("a cutscene may have legally changed input state while we were
  // paused"). Asking `controller.enabled` cannot answer that: pause itself sets
  // it to false on the way in, so the question returns pause's own answer and
  // input is restored to OFF — permanently. Measured: after one Esc-open-close
  // the player could not move again for the rest of the visit, on keyboard AND
  // on the touch stick. Joseph has always kept this separate variable
  // (joseph3d/index.js `inputOn`); the ark was the one scene that did not.
  let sceneWantsInput = true;
  const setSceneInput = (on) => { sceneWantsInput = !!on; controller?.setEnabled(!!on); };

  const hud = buildHud({
    onHome: async () => {
      const wasOn = sceneWantsInput;
      setSceneInput(false);
      const leave = await confirmModal({
        title: 'Return home?',
        body: 'The ark will be here when you come back.',
        confirmText: 'Return home',
        cancelText: 'Keep looking',
      });
      if (leave) await app.navigate('home');
      else setSceneInput(wasOn !== false);
    },
  });

  const pause = createPauseMenu({
    app,
    isInputOn: () => sceneWantsInput,
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
    // Surface-aware: the whole interior and both ramps are planking, and the
    // building site outside is grass. The wood slot was declared with the rest
    // of the Noah audio and then never wired — every step on 137 m of timber
    // deck played the grass sample, which the headless runtime harness caught
    // on its first run.
    controller.onFootstep = () => {
      const onTimber = controller.deck !== null; // any deck, ramp or the gangway
      Audio.play(onTimber ? 'sfx.footstep_wood' : 'sfx.footstep_grass');
    };

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
  let poolRole = null;  // which job the shared point lights are currently doing
  let glowLevel = -999; // the height the lantern-glow visibility was last solved for
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
    // The motes are an OUTDOOR dust field spanning the whole site, and the ark
    // sits inside that span — so a mote drifting between the lens and the player
    // painted a soft additive blob on his chest while he stood below decks. Dust
    // in a sunbeam belongs outside; the interior has its own air.
    motes.points.visible = k < 0.5;
  }

  // ── PER-FRAME ──────────────────────────────────────────────────────────────
  const tmpV = new THREE.Vector3();
  const nearest3 = [null, null, null];   // reused lantern selection (no per-frame alloc)
  const nearDist = [Infinity, Infinity, Infinity];
  function update(dt, tMs) {
    const t = tMs / 1000;
    sky.update(dt);
    // Only simulate what is on screen. These were being stepped AND uploaded to
    // the GPU every frame while the player was below decks with the whole site
    // hidden — buffer traffic for particles nobody can see. Joseph gates its
    // camp particles the same way; this scene simply had not.
    if (motes.points.visible) motes.update(dt, t);
    // The smoke and embers belong to the fires OUTSIDE, but they are children of
    // the scene rather than of site.group — so gating only their SIMULATION left
    // them still being submitted below decks, two draw calls of frozen vertex
    // buffers hanging in mid-air inside the hull. Hide them as well as still them.
    if (smoke.points.visible !== site.group.visible) {
      smoke.points.visible = site.group.visible;
      embers.points.visible = site.group.visible;
    }
    if (site.group.visible) {
      smoke.update(dt, t);
      embers.update(dt, t);
    }
    if (!ready) return;
    controller.update(dt);

    const p = player.position;
    const wantInside = insideAt(p) ? 1 : 0;
    // A fade, not a cut: crossing the threshold should feel like walking in.
    insideK += (wantInside - insideK) * Math.min(dt * 0.006, 1);
    applyInsideness(insideK);

    // How much daylight this height gets: the tsohar band is at the top of the
    // ship, so the top deck is lit and the bottom one is not. The lanterns make
    // up the difference, which is why they matter most where the light does not
    // reach.
    const daylight = clamp01((p.y - DECK_Y[0]) / Math.max(0.001, DECK_Y[2] - DECK_Y[0]));
    // The lantern pool follows the player along whichever deck they are on.
    if (insideK > 0.05) {
      const deck = controller.deck;
      // Pick the three nearest lanterns on this deck WITHOUT building and
      // sorting a fresh array every frame — a selection pass over ~18 anchors
      // costs nothing and allocates nothing, where filter().sort() made two
      // arrays and a closure sixty times a second for the whole visit.
      nearest3[0] = nearest3[1] = nearest3[2] = null;
      nearDist[0] = nearDist[1] = nearDist[2] = Infinity;
      for (let i = 0; i < lanternAnchors.length; i++) {
        const a = lanternAnchors[i];
        if (deck && `deck${a.deck + 1}` !== deck && Math.abs(a.y - p.y) >= 3.2) continue;
        const d0 = Math.abs(a.x - p.x);
        for (let slot = 0; slot < 3; slot++) {
          if (d0 >= nearDist[slot]) continue;
          for (let k = 2; k > slot; k--) { nearDist[k] = nearDist[k - 1]; nearest3[k] = nearest3[k - 1]; }
          nearDist[slot] = d0; nearest3[slot] = a;
          break;
        }
      }
      for (let n = 0; n < lanternPool.length; n++) {
        const a = nearest3[n];
        if (!a) { lanternPool[n].intensity = 0; continue; }
        lanternPool[n].position.set(a.x, a.y, a.z);
        // Role only changes when the player crosses in or out, so writing the
        // colour and range every frame is 180 pointless conversions a second.
        if (poolRole !== 'lantern') { lanternPool[n].color.setHex(0xffb974); lanternPool[n].distance = 17; }
        lanternPool[n].intensity = insideK * (2.25 - daylight * 1.5) * (1 + Math.sin(t * 7 + a.x) * 0.06);
      }
      poolRole = 'lantern';
    } else {
      // Outside, the SAME three lights become the pitch fires. They are never
      // needed for both jobs at once — the whole site is hidden below decks —
      // so the scene never carries more than three point lights.
      for (let n = 0; n < lanternPool.length; n++) {
        const f = firePlaces[n];
        if (!f) { lanternPool[n].intensity = 0; continue; }
        lanternPool[n].position.set(f.x, f.y, f.z);
        if (poolRole !== 'fire') { lanternPool[n].color.setHex(0xff8a3c); lanternPool[n].distance = 9; }
        const flick = 0.85 + Math.sin(t * 11 + f.phase) * 0.16 + Math.sin(t * 5.3 + f.phase) * 0.09;
        lanternPool[n].intensity = Math.max(0, flick) * (1 - insideK);
      }
      poolRole = 'fire';
    }

    // A lantern two decks below is behind a solid deck slab: the depth test
    // throws its pixels away, but the DRAW CALL is paid in full either way.
    // Only the ones on the player's own level can ever be seen, and there is a
    // whole deck of headroom in the test so a ramp climb never pops one out.
    if (Math.abs(p.y - glowLevel) > 1.6) {
      glowLevel = p.y;
      for (const s of lanternGlows.children) {
        s.visible = Math.abs(s.userData.anchorY - p.y) < DECK_PITCH * 1.15;
      }
    }

    // The shafts only exist on the top deck; keep them out of the way otherwise.
    // The shafts are the top deck's whole character — the one cubit of opening
    // Genesis gives the vessel, falling in down the length of both sides.
    shafts.visible = insideK > 0.4 && p.y > DECK_Y[2] - 2;
    if (shafts.visible && shaftOpacity !== 0.34) {
      shaftOpacity = 0.34;
      for (const s of shafts.children) s.material.opacity = shaftOpacity;
    }

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
    scene.fog.far = fogFar();
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
    // The scene loaded these from files and owns them, so the scene frees them.
    // Same omission as the story's brick texture: disposeDeep() runs afterwards
    // and only reaches what is still hanging on the graph, so a texture used by
    // a stage that has already disposed its own group is freed by nobody.
    for (const texture of Object.values(worldTextures)) texture.dispose();
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
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

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
