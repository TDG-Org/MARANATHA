import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
const PART_COLOR = [
  { re: /head/i, key: 'headOverride' }, // hooded head = cloth; bare head = skin (resolved below)
  { re: /arm/i, key: 'robe' },          // sleeves
  { re: /body|torso/i, key: 'robe' },
  { re: /leg/i, key: 'robeShade' },
];

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
  constructor({ mode = 'capsule', gltf = null, colors = {}, scale = 1, name = '', temp = false, staff = false, hoodIsCloth = false } = {}) {
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

    // 1) classify nodes
    const parts = [];
    this.rig.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const n = o.name || '';
      if (STAFF_RE.test(n)) { this.staffMesh = o; o.visible = !!staff; return; }
      if (CAPE_RE.test(n)) { this.capeMesh = o; o.visible = false; return; } // coat equips later
      if (HIDE_RE.test(n)) { o.visible = false; return; }
      parts.push(o);
    });

    // 2) per-part Alto colors (flat toon; the source texture is not used)
    const colorOf = (node) => {
      const n = node.name || '';
      for (const rule of PART_COLOR) {
        if (rule.re.test(n)) {
          if (rule.key === 'headOverride') return /hood/i.test(n) || hoodIsCloth ? this.colors.robe : this.colors.skin;
          return this.colors[rule.key] ?? this.colors.robe;
        }
      }
      return this.colors.robe;
    };

    // 3) merge every skinned part into ONE vertex-colored SkinnedMesh (1 draw).
    //    Falls back to per-part toon materials if the merge isn't possible.
    const skinned = parts.filter((p) => p.isSkinnedMesh);
    let merged = null;
    if (skinned.length > 1) merged = this._mergeSkinnedParts(skinned, colorOf);
    if (merged) {
      skinned.forEach((p) => { p.visible = false; });
      this.bodyMesh = merged;
    } else {
      parts.forEach((p) => { p.material = this._toon(colorOf(p)); });
      this.bodyMesh = skinned[0] || parts[0];
    }

    // 4) accessories get their own toon materials
    if (this.capeMesh) {
      this.capeMesh.material = this.colors.coat && this.colors.coat.length
        ? this._coatMaterial(this.colors.coat)
        : this._toon(this.colors.coat?.[0] ?? this.colors.robe);
    }
    if (this.staffMesh) this.staffMesh.material = this._toon(0x6b4a2c);

    // 5) size + animation
    const box = new THREE.Box3().setFromObject(this.rig);
    this.headHeight = Math.max(1.2, box.max.y - this.root.position.y) + 0.12;
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

  // Joseph's ornate coat: horizontal bands painted into a small canvas texture.
  _coatMaterial(bandColors) {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 64;
    const ctx = c.getContext('2d');
    const bandH = c.height / bandColors.length;
    bandColors.forEach((hex, i) => {
      ctx.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
      ctx.fillRect(0, Math.floor(i * bandH), c.width, Math.ceil(bandH));
    });
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

  update(dt) {
    this._t += dt;
    let d = this._targetYaw - this._yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this._yaw += d * Math.min(dt * 0.012, 1);
    this.facing.rotation.y = this._yaw;

    if (this.mode === 'glb' && this.mixer) { this.mixer.update(dt / 1000); return; }
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
