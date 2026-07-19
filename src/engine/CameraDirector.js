import * as THREE from 'three';
import { clamp, lerp, easeInOut } from './world.js';

// ── CAMERA COMFORT KNOBS ────────────────────────────────────────────────────
// The whole game reframes from here — tweak and reload. (Nate: these five.)
export const CAMERA_TUNING = {
  height: 2.75,        // how high the follow camera sits behind the hero
  distance: 6.4,       // how far back it sits (a touch more room than before)
  lookHeight: 1.55,    // the point on the hero the camera looks at
  minGroundY: 0.45,    // the camera never dips below this world Y (ground-clip)
  occludeOpacity: 0.3, // props between camera and hero fade to this, then restore
};

// Camera v2 (cinematography): AUTHORED framing, no player control. The camera
// holds a designed angle (yaw/distance/height are data), keeps the character
// low-third with sky behind, and GLIDES to a new authored angle when the
// player enters a camera zone (data volumes). Dramatic beats still use
// cinematicMoveTo()/release(). The camera does NOT collide with props — a prop
// between the camera and the hero fades out instead (navigation never fights
// the camera); only the ground-clip keeps it above the floor.
//
// zone: { shape:'circle', x,z,r,  yaw, distance, height, lookHeight }
//    or { shape:'rect', minX,maxX,minZ,maxZ, ... }
export class CameraDirector {
  constructor(camera, {
    yaw = Math.PI,      // world yaw the camera looks ALONG (camera sits behind)
    distance = CAMERA_TUNING.distance,
    height = CAMERA_TUNING.height,
    lookHeight = CAMERA_TUNING.lookHeight,
    lookAhead = 1.6,
    posDamp = 0.0045,
    lookDamp = 0.006,
    paramDamp = 0.0022, // zone-to-zone glide speed
    minGroundY = CAMERA_TUNING.minGroundY,
    occludeOpacity = CAMERA_TUNING.occludeOpacity,
  } = {}) {
    this.camera = camera;
    this.defaults = { yaw, distance, height, lookHeight };
    this.p = { ...this.defaults };       // live (damped) params
    this.pTarget = { ...this.defaults }; // authored targets (zone or defaults)
    this.lookAhead = lookAhead;
    this.posDamp = posDamp;
    this.lookDamp = lookDamp;
    this.paramDamp = paramDamp;
    this.minGroundY = minGroundY;
    this.occludeOpacity = occludeOpacity;

    this.target = new THREE.Vector3();
    this.lead = new THREE.Vector2();
    this.zones = [];
    this.occluders = [];   // big props that FADE when between camera and hero
    this._t = 0;
    this._init = false;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._head = new THREE.Vector3();
    this._lookT = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._blend = new THREE.Vector3();
    this._ray = new THREE.Raycaster();
    this._occ = new Map(); // occluder object -> target opacity (eased)
    this._hits = [];       // reusable raycast target (no per-frame alloc)
    this._goal = { ...this.defaults }; // reusable zone-merge scratch

    this.pose = null;
    this.poseK = 0;
    this._poseDir = 0;
    this._poseSpeed = 0;

    // NEVER-STATIC drift (cutscene-director): while on, authored poses orbit
    // almost imperceptibly and the follow camera sways — a frame is never
    // frozen during narration.
    this.drift = false;
    this._driftT = 0;
    this._poseRot = new THREE.Vector3();
  }

  setDrift(on) { this.drift = !!on; }

  // D9: a TRUE still — even the idle breathing sine stops (the finale's held
  // final frame). Any new cinematicMoveTo()/release() wakes the camera again.
  setStill(on) { this.still = !!on; }

  setTarget(v) { this.target.copy(v); }
  setLead(vx, vz) { this.lead.set(vx, vz); }
  setZones(zones) { this.zones = zones || []; }
  // The occluder list (big props). Named setColliders for call-site continuity,
  // but these no longer collide — they fade (Task D4-2).
  setColliders(arr) { this.occluders = arr || []; }
  setOccluders(arr) { this.occluders = arr || []; }

  _zoneAt(x, z) {
    for (const zn of this.zones) {
      if (zn.shape === 'circle') {
        const dx = x - zn.x, dz = z - zn.z;
        if (dx * dx + dz * dz <= zn.r * zn.r) return zn;
      } else if (zn.shape === 'rect') {
        if (x >= zn.minX && x <= zn.maxX && z >= zn.minZ && z <= zn.maxZ) return zn;
      }
    }
    return null;
  }

  frame(dt) {
    this._t += dt;
    if (this.drift) this._driftT += dt;

    // 1) authored params: active zone (or defaults), damped for the glide.
    // Zone params merge into a reusable scratch — a {...spread} here allocated
    // an object EVERY frame the player stood inside any camera zone.
    const zn = this._zoneAt(this.target.x, this.target.z);
    let goal = this.defaults;
    if (zn) {
      const g = this._goal, d = this.defaults;
      g.yaw = zn.yaw ?? d.yaw;
      g.distance = zn.distance ?? d.distance;
      g.height = zn.height ?? d.height;
      g.lookHeight = zn.lookHeight ?? d.lookHeight;
      goal = g;
    }
    const k = Math.min(dt * this.paramDamp, 1);
    // yaw eases the short way around
    let dy = goal.yaw - this.p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.p.yaw += dy * k;
    this.p.distance = lerp(this.p.distance, goal.distance, k);
    this.p.height = lerp(this.p.height, goal.height, k);
    this.p.lookHeight = lerp(this.p.lookHeight, goal.lookHeight, k);

    // 2) desired transform from params (+ follow-mode drift sway)
    const driftYaw = this.drift ? Math.sin(this._t * 0.00022) * 0.05 : 0;
    const sin = Math.sin(this.p.yaw + driftYaw), cos = Math.cos(this.p.yaw + driftYaw);
    this._desired.set(
      this.target.x - sin * this.p.distance,
      this.target.y + this.p.height,
      this.target.z - cos * this.p.distance,
    );
    this._head.set(this.target.x, this.target.y + this.p.lookHeight, this.target.z);
    this._lookT.copy(this._head);
    this._lookT.x += this.lead.x * 0.001 * this.lookAhead * 160;
    this._lookT.z += this.lead.y * 0.001 * this.lookAhead * 160;

    // 3) OCCLUDER FADE (replaces camera collision): the camera holds its
    // authored distance no matter what — a prop between the hero and the
    // camera fades to ~30% and restores when it clears, so navigation never
    // fights the camera and there is no pull-in jitter.
    if (this.occluders.length) {
      // Cast FROM the camera TOWARD the character's body (target.y + 0.6), not
      // the head — a tent between camera and hero blocks the body even when the
      // raised camera looks clean over its roof. Stop just short of the body.
      this._dir.set(
        this.target.x - this._desired.x,
        this.target.y + 0.6 - this._desired.y,
        this.target.z - this._desired.z,
      );
      const len = this._dir.length() || 1;
      this._dir.divideScalar(len);
      this._ray.set(this._desired, this._dir);
      this._ray.far = Math.max(0, len - 0.4); // don't count the hero's own body
      this._ray.camera = this.camera; // required when groups contain Sprites
      // Allocation-free: assume every tracked occluder cleared, then re-mark
      // whatever the ray still hits (same semantics as the old Set diff).
      for (const o of this._occ.keys()) this._occ.set(o, 1);
      this._hits.length = 0;
      this._ray.intersectObjects(this.occluders, true, this._hits);
      for (let i = 0; i < this._hits.length; i++) {
        const o = this._hits[i].object;
        if (!o.isSprite) this._occ.set(o, this.occludeOpacity);
      }
    }
    // ease every tracked occluder toward its target opacity
    if (this._occ.size) {
      const ease = Math.min(dt * 0.012, 1);
      for (const [o, tgt] of this._occ) {
        const m = o.material;
        if (!m) { this._occ.delete(o); continue; }
        if (tgt < 1) { m.transparent = true; m.depthWrite = false; }
        m.opacity += (tgt - (m.opacity ?? 1)) * ease;
        if (tgt >= 1 && m.opacity > 0.985) {
          m.opacity = 1; m.transparent = false; m.depthWrite = true;
          this._occ.delete(o);
        }
      }
    }

    // 4) damp position + look
    if (!this._init) { this._pos.copy(this._desired); this._look.copy(this._lookT); this._init = true; }
    this._pos.lerp(this._desired, Math.min(dt * this.posDamp, 1));
    this._look.lerp(this._lookT, Math.min(dt * this.lookDamp, 1));

    // 5) cinematic pose blend
    if (this._poseDir !== 0) {
      this.poseK = clamp(this.poseK + this._poseDir * this._poseSpeed * dt, 0, 1);
      if (this.poseK === 0 && this._poseDir < 0) { this._poseDir = 0; this.pose = null; }
      if (this.poseK === 1 && this._poseDir > 0) this._poseDir = 0;
    }
    const breath = this.still ? 0 : Math.sin(this._t * 0.0009) * 0.045;
    if (this.pose && this.poseK > 0) {
      const kk = easeInOut(this.poseK);
      // pose drift: orbit the held shot around its look target (~0.03 rad/s)
      // + a slow rise — felt, never seen (cutscene-director NEVER-STATIC).
      let px = this.pose.pos.x, py = this.pose.pos.y, pz = this.pose.pos.z;
      if (this.drift) {
        const a = this._driftT * 0.00003;
        const ox = px - this.pose.look.x, oz = pz - this.pose.look.z;
        const ca = Math.cos(a), sa = Math.sin(a);
        px = this.pose.look.x + ox * ca - oz * sa;
        pz = this.pose.look.z + ox * sa + oz * ca;
        py += Math.sin(this._driftT * 0.00012) * 0.12;
      }
      this.camera.position.set(
        lerp(this._pos.x, px, kk),
        lerp(this._pos.y, py, kk) + breath,
        lerp(this._pos.z, pz, kk),
      );
      if (this.camera.position.y < this.minGroundY) this.camera.position.y = this.minGroundY;
      this._blend.set(
        lerp(this._look.x, this.pose.look.x, kk),
        lerp(this._look.y, this.pose.look.y, kk),
        lerp(this._look.z, this.pose.look.z, kk),
      );
      this.camera.lookAt(this._blend);
    } else {
      this.camera.position.set(this._pos.x, this._pos.y + breath, this._pos.z);
      if (this.camera.position.y < this.minGroundY) this.camera.position.y = this.minGroundY;
      this.camera.lookAt(this._look);
    }
  }

  // Beat API — identical contract to the D1 camera so sequences are portable.
  cinematicMoveTo({ angle = 0, target = this.target, distance = 4, height = 1.6, lookHeight = 1.3, duration = 1400 } = {}) {
    this.still = false; // any new shot wakes the camera from a held still
    const t = target.isVector3 ? target.clone() : new THREE.Vector3(target.x, target.y || 0, target.z);
    const pos = new THREE.Vector3(t.x - Math.sin(angle) * distance, t.y + height, t.z - Math.cos(angle) * distance);
    const look = new THREE.Vector3(t.x, t.y + lookHeight, t.z);
    this.pose = { pos, look };
    this._poseDir = 1;
    this._poseSpeed = 1 / Math.max(1, duration);
    this._driftT = 0; // each shot's drift arc starts from ITS authored frame
  }

  release(duration = 1400) { this.still = false; this._poseDir = -1; this._poseSpeed = 1 / Math.max(1, duration); }
  get inCinematic() { return this.poseK > 0.001 || this._poseDir > 0; }

  snap() { this._init = false; this.frame(0); }
}
