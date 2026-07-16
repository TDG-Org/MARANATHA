import * as THREE from 'three';

// A 3D toon character (Phase D1). Two modes, ONE API:
//   • 'glb'     — a rigged GLTF + AnimationMixer, crossfading real clips.
//   • 'capsule' — a clearly-labeled TEMP articulated stand-in (procedural
//                 idle/walk/run/talk/kneel) used until a real /models GLB exists.
// Shared API: play(state), update(dt, camera), turnToward(dx,dz), setPosition,
// root, headHeight, dispose. Materials are flat MeshToonMaterial (zero shine),
// Alto palette (art-style: needs the scene's minimal light rig).
export const CHARACTER_STATES = ['idle', 'walk', 'run', 'talk', 'kneel'];

const ANIM = {
  idle: { swing: 0.06, speed: 1.6, bob: 0.010 },
  walk: { swing: 0.55, speed: 6.5, bob: 0.030 },
  run: { swing: 0.95, speed: 10.0, bob: 0.055 },
  talk: { swing: 0.10, speed: 3.2, bob: 0.014 },
  kneel: { swing: 0.02, speed: 1.0, bob: 0.004 },
};

export class Character3D {
  constructor({ mode = 'capsule', gltf = null, colors = {}, scale = 1, name = '', temp = false } = {}) {
    this.name = name;
    this.mode = mode;
    this.isTemp = temp || mode === 'capsule';
    this.colors = { robe: 0x8a7f9e, skin: 0xcf9a63, hair: 0x2f2620, sash: null, coat: null, ...colors };
    this.root = new THREE.Group();      // at the feet; movement sets root.position
    this.facing = new THREE.Group();    // yaw toward travel direction
    this.root.add(this.facing);
    this.state = 'idle';
    this._t = 0;
    this._yaw = 0;
    this._targetYaw = 0;
    this._kneelK = 0;
    this._mats = [];

    if (mode === 'glb' && gltf) this._initGLB(gltf, scale);
    else this._initCapsule(scale);
  }

  _toon(color) {
    const m = new THREE.MeshToonMaterial({ color: new THREE.Color(color) });
    this._mats.push(m);
    return m;
  }

  // --- GLB: real rig + clips ---------------------------------------------
  _initGLB(gltf, scale) {
    this.rig = gltf.scene;
    this.rig.scale.setScalar(scale);
    this.facing.add(this.rig);
    this._applyToonToRig(this.rig);

    const box = new THREE.Box3().setFromObject(this.rig);
    this.headHeight = Math.max(1.2, box.max.y) + 0.15;

    this.mixer = new THREE.AnimationMixer(this.rig);
    this.actions = {};
    for (const s of CHARACTER_STATES) {
      const clip = this._findClip(gltf.animations, s);
      if (clip) this.actions[s] = this.mixer.clipAction(clip);
    }
    this.current = this.actions.idle || Object.values(this.actions)[0];
    this.current?.play();
  }

  _findClip(clips, state) {
    if (!clips || !clips.length) return null;
    return clips.find((c) => c.name && c.name.toLowerCase().includes(state)) || null;
  }

  _applyToonToRig(rig) {
    // A cast rig is often ONE unnamed skinned mesh, so unmatched materials must
    // default to the variant's robe/coat colour (NOT the original GLB colour) —
    // otherwise every variant renders identically. Named slots refine it.
    // Joseph's coat is represented by its first band here; true multi-colour
    // bands need an accessory-coat.glb (see /models/MODELS.md).
    const robeColor = (this.colors.coat && this.colors.coat.length) ? this.colors.coat[0] : this.colors.robe;
    rig.traverse((o) => {
      if (!o.isMesh) return;
      const name = (o.material && o.material.name ? o.material.name : '').toLowerCase();
      let color = robeColor;
      if (name.includes('skin') || name.includes('head') || name.includes('face')) color = this.colors.skin;
      else if (name.includes('hair') || name.includes('beard')) color = this.colors.hair;
      else if (name.includes('sash') || name.includes('belt')) color = this.colors.sash ?? robeColor;
      else if (name.includes('coat')) color = (this.colors.coat && this.colors.coat[0]) || robeColor;
      else if (name.includes('robe') || name.includes('cloth') || name.includes('body')) color = robeColor;
      o.material = this._toon(color);
      o.castShadow = false;
      o.receiveShadow = false;
    });
  }

  // --- Capsule: TEMP articulated stand-in --------------------------------
  _initCapsule(scale) {
    this.rig = new THREE.Group();
    const robe = this._toon(this.colors.robe);
    const skin = this._toon(this.colors.skin);
    const hair = this._toon(this.colors.hair);

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.66, 4, 12), robe);
    body.position.y = 0.92;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 18, 14), skin);
    head.position.y = 1.55;
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.215, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair);
    hairCap.position.y = 1.575;

    const limb = (mat, x, y, len) => {
      const g = new THREE.Group();
      g.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, len, 0.12), mat);
      m.position.y = -len / 2;
      g.add(m);
      return g;
    };
    this.armL = limb(robe, -0.34, 1.32, 0.62);
    this.armR = limb(robe, 0.34, 1.32, 0.62);
    this.legL = limb(this._toon(this.colors.skin), -0.15, 0.58, 0.58);
    this.legR = limb(this._toon(this.colors.skin), 0.15, 0.58, 0.58);

    this.rig.add(body, head, hairCap, this.armL, this.armR, this.legL, this.legR);

    // Joseph's coat = extra colored bands on the torso (distinct layered colors).
    if (this.colors.coat && this.colors.coat.length) {
      this.colors.coat.forEach((c, i) => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.315, 0.13, 14, 1, true), this._toon(c));
        band.position.y = 1.12 - i * 0.14;
        this.rig.add(band);
      });
    }

    this.rig.scale.setScalar(scale);
    this.facing.add(this.rig);
    this.headHeight = 1.78 * scale;
    this._bodyBaseY = 0.92;
    this._body = body;
  }

  // --- shared API --------------------------------------------------------
  addTo(scene) { scene.add(this.root); return this; }
  setPosition(x, z) { this.root.position.set(x, 0, z); return this; }
  get position() { return this.root.position; }

  play(state) {
    if (!CHARACTER_STATES.includes(state) || state === this.state) { this.state = state; return; }
    if (this.mode === 'glb' && this.actions) {
      const next = this.actions[state];
      if (next && next !== this.current) {
        next.reset().fadeIn(0.3).play();
        this.current?.fadeOut(0.3);
        this.current = next;
      }
    }
    this.state = state;
  }

  turnToward(dx, dz) {
    if (dx * dx + dz * dz > 1e-4) this._targetYaw = Math.atan2(dx, dz);
  }

  update(dt, camera) {
    this._t += dt;
    // ease facing yaw toward travel direction (shortest way)
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

    // kneel: ease the rig down + tuck legs
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
    // Capsule geometry is per-instance → safe to dispose. GLB geometry is SHARED
    // across SkeletonUtils clones + the factory base → do NOT dispose it here
    // (CharacterFactory.dispose() frees the base once). Materials are per-instance.
    if (this.mode === 'capsule') {
      this.root.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); });
    }
    this._mats.forEach((m) => m.dispose());
    this.root.parent?.remove(this.root);
  }
}
