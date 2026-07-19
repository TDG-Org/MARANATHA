import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { blobShadow, canvasTexture } from './world.js';

// Shared mouth flipbook (D4): 4 dark mouth shapes that cycle fast on whoever is
// speaking (state === 'talk'), giving cheap, charming lip-flap over the painted
// face. Built once, shared by every character.
let _mouthTex = null;
function mouthTextures() {
  if (_mouthTex) return _mouthTex;
  const shape = (rx, ry) => canvasTexture(32, 32, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(48,22,20,0.9)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // closed → small → wide → mid (a natural flap loop)
  _mouthTex = [shape(6, 1.4), shape(5.5, 4), shape(6.5, 6.5), shape(5.5, 3.4)];
  return _mouthTex;
}

// A 3D toon character. Two modes, ONE API:
//   • 'glb'     — a real rigged character (KayKit-style: one skin, named part
//                 nodes, big shared clip library). Parts are re-colored to the
//                 Alto palette and MERGED into one vertex-colored SkinnedMesh
//                 (1 draw call per character) — crowds stay inside the budget.
//   • 'capsule' — the labeled TEMP stand-in (procedural), kept as the graceful
//                 fallback when /models has no GLB.
// Shared API: play(state), update(dt), turnToward(dx,dz), setPosition, setCoat,
// root, headHeight, dispose.
export const CHARACTER_STATES = ['idle', 'walk', 'run', 'talk', 'kneel'];

// State → candidate clip names, best first. Matching: exact (case-insensitive)
// first, then substring — so `Idle` wins over `2H_Melee_Idle`, and rigs without
// dedicated talk/kneel clips fall back to documented stand-ins (CREDITS.md).
const CLIP_CANDIDATES = {
  idle: ['idle', 'unarmed_idle', 'idle_a'],
  walk: ['walking_a', 'walking_b', 'walk'],
  run: ['running_a', 'running_b', 'run'],
  talk: ['talk', 'interact', 'use_item', 'cheer'],
  kneel: ['kneel', 'sit_floor_idle', 'sit_floor_pose', 'pickup'],
};

// Node-name classification for KayKit-style rigs (generic enough for others).
const HIDE_RE = /spellbook|wand|hat\b|_hat|knife|crossbow|throwable|sword|shield|axe|dagger|quiver|arrow|smokebomb|mug|1h_|2h_(?!staff)/i;
const CAPE_RE = /cape|coat/i;
const STAFF_RE = /2h_staff|staff/i;

const ANIM = { // capsule-mode procedural params
  idle: { swing: 0.06, speed: 1.6, bob: 0.010 },
  walk: { swing: 0.55, speed: 6.5, bob: 0.030 },
  run: { swing: 0.95, speed: 10.0, bob: 0.055 },
  talk: { swing: 0.10, speed: 3.2, bob: 0.014 },
  kneel: { swing: 0.02, speed: 1.0, bob: 0.004 },
};

const _srgb = new THREE.Color();
function linearColor(hex) { return _srgb.set(hex).convertSRGBToLinear().clone(); }

export class Character3D {
  constructor({ mode = 'capsule', gltf = null, colors = {}, scale = 1, name = '', temp = false, staff = false, elder = false, hoodIsCloth = false } = {}) {
    this.elder = elder;
    this.name = name;
    this.mode = mode;
    this.isTemp = temp || mode === 'capsule';
    this.colors = {
      robe: 0x8a7f9e, robeShade: 0x6e6483, skin: 0xcf9a63, hair: 0x2f2620,
      sash: null, coat: null, ...colors,
    };
    this.root = new THREE.Group();   // feet; movement writes root.position
    this.facing = new THREE.Group(); // yaw toward travel
    this.root.add(this.facing);
    this.state = 'idle';
    this._t = 0;
    this._yaw = 0;
    this._targetYaw = 0;
    this._kneelK = 0;
    this._mats = [];
    this._ownedGeo = []; // geometry created per-instance (merged body, capsule parts)
    this.capeMesh = null;
    this.staffMesh = null;

    if (mode === 'glb' && gltf) this._initGLB(gltf, scale, { staff, hoodIsCloth });
    else this._initCapsule(scale);
  }

  _toon(color, opts = {}) {
    const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...opts });
    this._mats.push(m);
    return m;
  }

  // --- GLB: real rig -------------------------------------------------------
  _initGLB(gltf, scale, { staff, hoodIsCloth }) {
    this.rig = gltf.scene;
    this.rig.scale.setScalar(scale);
    this.facing.add(this.rig);

    // 1) classify meshes. Hide fantasy accessories; keep the HEAD aside so it
    //    can keep its painted face (real eyes) instead of being merged flat.
    const parts = [];
    let headNode = null;
    this.rig.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const n = o.name || '';
      if (STAFF_RE.test(n)) { this.staffMesh = o; o.visible = !!staff; return; }
      if (CAPE_RE.test(n)) { this.capeMesh = o; o.visible = false; return; } // coat equips later
      if (HIDE_RE.test(n)) { o.visible = false; return; }
      if (/head|face/i.test(n) && !headNode) headNode = o;
      parts.push(o);
    });

    // 2) per-part Alto colors for the BODY (flat toon; source texture unused)
    const colorOf = (node) => {
      const n = node.name || '';
      if (/leg/i.test(n)) return this.colors.robeShade;
      if (/belt/i.test(n)) return this.colors.belt ?? this.colors.sash ?? this.colors.robe;
      if (/sash/i.test(n)) return this.colors.sash ?? this.colors.robe;
      return this.colors.robe; // arms, body, torso, cloth, anything unnamed
    };

    // 3) merge the BODY (everything but the head) into ONE vertex-colored
    //    SkinnedMesh (1 draw); the head stays separate + textured (+1 draw/char).
    const bodyParts = parts.filter((p) => p.isSkinnedMesh && p !== headNode);
    let merged = null;
    if (bodyParts.length > 1) merged = this._mergeSkinnedParts(bodyParts, colorOf);
    if (merged) {
      bodyParts.forEach((p) => { p.visible = false; });
      this.bodyMesh = merged;
    } else {
      bodyParts.forEach((p) => { p.material = this._toon(colorOf(p)); });
      this.bodyMesh = bodyParts[0] || parts[0];
    }

    // 4) the HEAD keeps its painted face (toon-shaded, zero shine) so nobody is
    //    faceless. Falls back to a flat skin tone if the rig has no map.
    if (headNode) {
      const faceMap = headNode.material && headNode.material.map ? headNode.material.map : null;
      headNode.visible = true;
      headNode.material = faceMap ? this._toon(0xffffff, { map: faceMap }) : this._toon(this.colors.skin);
    }
    this.headNode = headNode;

    // 5) accessories get their own toon materials
    if (this.capeMesh) {
      this.capeMesh.material = this.colors.coat && this.colors.coat.length
        ? this._coatMaterial(this.colors.coat)
        : this._toon(this.colors.coat?.[0] ?? this.colors.robe);
    }
    if (this.staffMesh) this.staffMesh.material = this._toon(0x6b4a2c);

    // 6) head height from the HEAD BONE (hidden accessories can't inflate it)
    this.rig.updateWorldMatrix(true, true);
    const headBone = this.rig.getObjectByName('head');
    this._headBone = headBone || null; // grief pose bows it post-mixer (D8)
    if (headBone) {
      const hp = new THREE.Vector3();
      headBone.getWorldPosition(hp);
      this.headHeight = Math.max(1.3, hp.y) + 0.3;
      // ELDER: a chunky gray-white beard rides the head bone (likeness pass —
      // the painted face texture can't be re-tinted, so age is worn, not drawn).
      if (this.elder) {
        const beardGeo = new THREE.ConeGeometry(0.15, 0.34, 6);
        beardGeo.translate(0, -0.13, 0);
        beardGeo.scale(1.15, 1, 0.75);
        const beard = new THREE.Mesh(beardGeo, this._toon(0xd8d2c8));
        beard.position.set(0, 0.02, 0.3); // chin, bone-local — proud of the face
        beard.rotation.x = 0.3;
        headBone.add(beard);
        this._ownedGeo.push(beardGeo);
        this.beardMesh = beard;
      }
      // HEADBAND (D6, worn detail): a thin cloth band around the brow — cast
      // config sets `colors.headband`. Joseph wears cream-with-terracotta: a
      // touch of care in his dress, still humble beside the coat to come.
      if (this.colors.headband) {
        const bandGeo = new THREE.CylinderGeometry(0.235, 0.245, 0.075, 10, 1, true);
        const band = new THREE.Mesh(bandGeo, this._toon(this.colors.headband, { side: THREE.DoubleSide }));
        band.position.set(0, 0.11, 0.02);
        band.rotation.x = -0.08;
        headBone.add(band);
        this._ownedGeo.push(bandGeo);
        // the knot tail at the back of the band
        const tailGeo = new THREE.PlaneGeometry(0.07, 0.16);
        const tail = new THREE.Mesh(tailGeo, this._toon(this.colors.headbandTail ?? this.colors.headband, { side: THREE.DoubleSide }));
        tail.position.set(0.03, 0.02, -0.24);
        tail.rotation.x = 0.35;
        headBone.add(tail);
        this._ownedGeo.push(tailGeo);
      }
      // MOUTH FLIPBOOK — a tiny plane on the head bone, in front of the face,
      // hidden until this character speaks (see play/update). Bone-local so it
      // rides every head movement for free.
      const mGeo = new THREE.PlaneGeometry(0.11, 0.095);
      const mMat = new THREE.MeshBasicMaterial({ map: mouthTextures()[0], transparent: true, depthWrite: false, fog: false });
      const mouth = new THREE.Mesh(mGeo, mMat);
      mouth.position.set(0, this.elder ? -0.11 : -0.06, this.elder ? 0.34 : 0.33);
      mouth.visible = false;
      headBone.add(mouth);
      this._ownedGeo.push(mGeo);
      this._mats.push(mMat);
      this.mouthMesh = mouth;
      this._mouthT = 0;
      this._mouthFrame = 0;
    } else {
      let top = 1.8;
      const g = this.bodyMesh?.geometry;
      if (g) { g.computeBoundingBox(); top = g.boundingBox.max.y * scale; }
      this.headHeight = Math.max(1.3, top) + 0.2;
    }

    // BELT (D8): the KayKit rigs have NO belt/sash mesh (the old "terracotta
    // sash" color never had a node to land on) — so a belt is WORN geometry,
    // a leather band riding the spine bone like the headband rides the head.
    if (this.colors.belt) {
      const waist = this.rig.getObjectByName('spine') || this.rig.getObjectByName('hips');
      if (waist) {
        // sized to the MEASURED torso at belt height (±0.42 wide, ±0.36 deep —
        // the robe is bulky; a round 0.29 band drowned inside it invisibly)
        const beltGeo = new THREE.CylinderGeometry(0.435, 0.45, 0.13, 14, 1, true);
        const belt = new THREE.Mesh(beltGeo, this._toon(this.colors.belt, { side: THREE.DoubleSide }));
        belt.position.set(0, 0.0, 0);
        belt.scale.set(1, 1, 0.86); // elliptical — hugs the robe, front and back
        waist.add(belt);
        this._ownedGeo.push(beltGeo);
        this.beltMesh = belt;
      }
    }

    this.mixer = new THREE.AnimationMixer(this.rig);
    this.actions = {};
    for (const s of CHARACTER_STATES) {
      const clip = findClip(gltf.animations, s);
      if (clip) this.actions[s] = this.mixer.clipAction(clip);
    }
    this.current = this.actions.idle || Object.values(this.actions)[0];
    this.current?.play();
  }

  // Concatenate skinned primitives (same skeleton/material layout) into one
  // geometry with a per-part COLOR attribute. Returns a bound SkinnedMesh or
  // null if anything doesn't line up (caller falls back).
  _mergeSkinnedParts(skinnedParts, colorOf) {
    try {
      const ref = skinnedParts[0];
      const geos = [];
      for (const p of skinnedParts) {
        const g = p.geometry.clone();
        // strip attributes that may differ; keep what skinning + toon need
        const keep = ['position', 'normal', 'skinIndex', 'skinWeight'];
        for (const key of Object.keys(g.attributes)) if (!keep.includes(key)) g.deleteAttribute(key);
        const count = g.attributes.position.count;
        const col = new Float32Array(count * 3);
        const c = linearColor(colorOf(p));
        for (let i = 0; i < count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geos.push(g);
      }
      const mergedGeo = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!mergedGeo) return null;
      this._ownedGeo.push(mergedGeo);
      const mat = this._toon(0xffffff, { vertexColors: true });
      const mesh = new THREE.SkinnedMesh(mergedGeo, mat);
      mesh.bind(ref.skeleton, ref.bindMatrix.clone());
      mesh.frustumCulled = false; // skinned bounds are unreliable; chars are few
      ref.parent.add(mesh);
      return mesh;
    } catch (e) {
      console.warn('[Character3D] skinned merge failed — per-part fallback', e);
      return null;
    }
  }

  // Joseph's coat of many colors (D6 rework): BOLD geometric bands + diamond
  // rows in earth-tone dyes — deep red, indigo, ochre, olive, cream — drawn
  // big and high-contrast so the pattern is CLEARLY readable on the coat's
  // BACK (the cape mesh is mostly back surface; the old fine argyle smeared
  // into noise there). No neon, no pink — period dye colors only.
  _coatMaterial(dyeColors) {
    const hex = (h) => `#${(h >>> 0).toString(16).padStart(6, '0')}`;
    const dyes = (dyeColors && dyeColors.length ? dyeColors : [0xa8321f, 0xcf8a2c, 0x2c3f78, 0x6b7038, 0xe8dcc0]).map(hex);
    const cream = '#e9dcbf';
    const W = 192, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');

    // 1) five BOLD horizontal dye bands — the "many colors", readable at range
    const bandH = H / 5;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = dyes[i % dyes.length];
      ctx.fillRect(0, Math.floor(i * bandH), W, Math.ceil(bandH) + 1);
    }
    // 2) cream separator stripes between the bands (crisp structure)
    ctx.fillStyle = cream;
    for (let i = 1; i < 5; i++) ctx.fillRect(0, Math.floor(i * bandH) - 3, W, 6);
    // 3) ONE row of large solid diamonds per band, alternating dye, outlined
    //    cream — big enough to survive the cape's UV stretch on the back.
    const dw = W / 3; // three diamonds across
    for (let i = 0; i < 5; i++) {
      const cy = i * bandH + bandH / 2;
      const dye = dyes[(i + 2) % dyes.length];
      for (let j = 0; j < 3; j++) {
        const cx = dw / 2 + j * dw;
        ctx.beginPath();
        ctx.moveTo(cx, cy - bandH * 0.34);
        ctx.lineTo(cx + dw * 0.3, cy);
        ctx.lineTo(cx, cy + bandH * 0.34);
        ctx.lineTo(cx - dw * 0.3, cy);
        ctx.closePath();
        ctx.fillStyle = dye;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = cream;
        ctx.stroke();
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    this._coatTex = tex;
    return this._toon(0xffffff, { map: tex });
  }

  // Show/hide the coat (Joseph's gift beat). No-op when the rig has no cape.
  setCoat(on) {
    if (this.capeMesh) this.capeMesh.visible = !!on;
    else if (this.mode === 'capsule') this._capsuleCoat?.forEach((b) => { b.visible = !!on; });
  }

  // --- Capsule: TEMP stand-in ----------------------------------------------
  _initCapsule(scale) {
    this.rig = new THREE.Group();
    const robe = this._toon(this.colors.robe);
    const skin = this._toon(this.colors.skin);
    const hair = this._toon(this.colors.hair);

    const mk = (geo, mat, y) => {
      this._ownedGeo.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      return m;
    };
    const body = mk(new THREE.CapsuleGeometry(0.30, 0.66, 4, 12), robe, 0.92);
    const head = mk(new THREE.SphereGeometry(0.20, 18, 14), skin, 1.55);
    const hairCap = mk(new THREE.SphereGeometry(0.215, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, 1.575);
    const limb = (mat, x, y, len) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      const geo = new THREE.BoxGeometry(0.12, len, 0.12);
      this._ownedGeo.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = -len / 2;
      g.add(m);
      return g;
    };
    this.armL = limb(robe, -0.34, 1.32, 0.62);
    this.armR = limb(robe, 0.34, 1.32, 0.62);
    this.legL = limb(skin, -0.15, 0.58, 0.58);
    this.legR = limb(skin, 0.15, 0.58, 0.58);
    this.rig.add(body, head, hairCap, this.armL, this.armR, this.legL, this.legR);

    this._capsuleCoat = [];
    if (this.colors.coat && this.colors.coat.length) {
      this.colors.coat.forEach((c, i) => {
        const geo = new THREE.CylinderGeometry(0.315, 0.315, 0.13, 14, 1, true);
        this._ownedGeo.push(geo);
        const band = new THREE.Mesh(geo, this._toon(c));
        band.position.y = 1.12 - i * 0.14;
        band.visible = false; // coat equips via setCoat(true)
        this.rig.add(band);
        this._capsuleCoat.push(band);
      });
    }
    this.rig.scale.setScalar(scale);
    this.facing.add(this.rig);
    this.headHeight = 1.78 * scale;
    this._bodyBaseY = 0.92;
    this._body = body;
  }

  // --- shared API -----------------------------------------------------------
  addTo(scene) { scene.add(this.root); return this; }
  setPosition(x, z) { this.root.position.set(x, 0, z); return this; }
  get position() { return this.root.position; }

  // A soft fake contact shadow under the feet (Graphics High only). It's a
  // child of root, so it follows the character for free.
  addContactShadow(width = 1.15) {
    if (this.shadowMesh) return this;
    const blob = blobShadow(width);
    blob.position.y = 0.03;
    this.root.add(blob);
    this.shadowMesh = blob;
    return this;
  }

  play(state) {
    if (!CHARACTER_STATES.includes(state) || state === this.state) { this.state = state; return; }
    if (this.mode === 'glb' && this.actions) {
      const next = this.actions[state];
      if (next && next !== this.current) {
        next.reset().fadeIn(0.25).play();
        this.current?.fadeOut(0.25);
        this.current = next;
      }
    }
    this.state = state;
  }

  turnToward(dx, dz) {
    if (dx * dx + dz * dz > 1e-4) this._targetYaw = Math.atan2(dx, dz);
  }

  // GRIEF (D8 cold open): the boy at the bottom of the pit weeps — head bowed
  // deep, shoulders hitching in small sobs. Applied AFTER the mixer each frame
  // (the animation clip owns the bones; this rides on top), eased in and out.
  // `amount` scales the pose: 1 = full weeping · ~0.5 = stung/dejected · a low
  // residual (~0.35) reads as walking with his head down.
  setGrief(on, amount = 1) { this._grief = !!on; if (on) this._griefAmt = amount; }

  update(dt) {
    this._t += dt;
    let d = this._targetYaw - this._yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this._yaw += d * Math.min(dt * 0.012, 1);
    this.facing.rotation.y = this._yaw;

    if (this.mode === 'glb' && this.mixer) {
      this.mixer.update(dt / 1000);
      // grief pose (post-mixer, additive): bow the head deep + sob hitches in
      // the shoulders. Eased, so it settles in rather than snapping.
      const gk = this._griefK ?? 0;
      const gTarget = this._grief ? 1 : 0;
      if (gk !== gTarget) this._griefK = gk + (gTarget - gk) * Math.min(dt * 0.0022, 1);
      if ((this._griefK ?? 0) > 0.003) {
        const k = this._griefK * (this._griefAmt ?? 1);
        const s = this._t / 1000;
        const sob = Math.sin(s * 7.6) * 0.5 + Math.sin(s * 13.1) * 0.22; // uneven hitches
        if (this._headBone) this._headBone.rotation.x += k * (0.72 + sob * 0.06);
        this.rig.rotation.x = k * (0.14 + sob * 0.05);
      } else if (this._griefWas) {
        this.rig.rotation.x = 0; // fully recovered — stand straight again
      }
      this._griefWas = (this._griefK ?? 0) > 0.003;
      // mouth flipbook: flap fast while speaking, hidden otherwise
      if (this.mouthMesh) {
        if (this.state === 'talk') {
          this.mouthMesh.visible = true;
          this._mouthT += dt;
          if (this._mouthT > 85) {
            this._mouthT = 0;
            this._mouthFrame = (this._mouthFrame + 1) % 4;
            this.mouthMesh.material.map = mouthTextures()[this._mouthFrame];
          }
        } else if (this.mouthMesh.visible) {
          this.mouthMesh.visible = false;
        }
      }
      return;
    }
    this._animateCapsule(dt);
  }

  _animateCapsule(dt) {
    const t = this._t / 1000;
    const cfg = ANIM[this.state] || ANIM.idle;
    const s = Math.sin(t * cfg.speed);
    this.armL.rotation.x = s * cfg.swing;
    this.armR.rotation.x = -s * cfg.swing;
    this.legL.rotation.x = -s * cfg.swing;
    this.legR.rotation.x = s * cfg.swing;
    if (this._body) this._body.position.y = this._bodyBaseY + Math.abs(Math.sin(t * cfg.speed)) * cfg.bob;
    const target = this.state === 'kneel' ? 1 : 0;
    this._kneelK += (target - this._kneelK) * Math.min(dt * 0.008, 1);
    this.rig.position.y = -this._kneelK * 0.45;
    if (this._kneelK > 0.01) {
      this.legL.rotation.x = -1.1 * this._kneelK;
      this.legR.rotation.x = -1.1 * this._kneelK;
    }
  }

  dispose() {
    this.mixer?.stopAllAction();
    // Only per-instance geometry is freed here; the factory owns the shared
    // base GLB geometry (see CharacterFactory.dispose).
    this._ownedGeo.forEach((g) => g.dispose());
    this._coatTex?.dispose();
    this._mats.forEach((m) => m.dispose());
    if (this.shadowMesh) {
      this.shadowMesh.geometry.dispose();
      this.shadowMesh.material.map?.dispose();
      this.shadowMesh.material.dispose();
    }
    this.root.parent?.remove(this.root);
  }
}

// Exact-name-first, then substring, per candidate priority (see CREDITS.md).
export function findClip(clips, state) {
  if (!clips || !clips.length) return null;
  const cands = CLIP_CANDIDATES[state] || [state];
  const lower = clips.map((c) => (c.name || '').toLowerCase());
  for (const cand of cands) {
    const exact = lower.indexOf(cand);
    if (exact !== -1) return clips[exact];
  }
  for (const cand of cands) {
    const idx = lower.findIndex((n) => n.includes(cand));
    if (idx !== -1) return clips[idx];
  }
  return null;
}
