import * as THREE from 'three';
import { clamp, lerp, easeInOut } from './world.js';

// Camera v2 (cinematography): AUTHORED framing, no player control. The camera
// holds a designed angle (yaw/distance/height are data), keeps the character
// low-third with sky behind, and GLIDES to a new authored angle when the
// player enters a camera zone (data volumes). Dramatic beats still use
// cinematicMoveTo()/release(). Raycast pull-in prevents clipping.
//
// zone: { shape:'circle', x,z,r,  yaw, distance, height, lookHeight }
//    or { shape:'rect', minX,maxX,minZ,maxZ, ... }
export class CameraDirector {
  constructor(camera, {
    yaw = Math.PI,      // world yaw the camera looks ALONG (camera sits behind)
    distance = 5.6,
    height = 2.3,
    lookHeight = 1.45,
    lookAhead = 1.6,
    posDamp = 0.0045,
    lookDamp = 0.006,
    paramDamp = 0.0022, // zone-to-zone glide speed
    minDist = 1.4,
  } = {}) {
    this.camera = camera;
    this.defaults = { yaw, distance, height, lookHeight };
    this.p = { ...this.defaults };       // live (damped) params
    this.pTarget = { ...this.defaults }; // authored targets (zone or defaults)
    this.lookAhead = lookAhead;
    this.posDamp = posDamp;
    this.lookDamp = lookDamp;
    this.paramDamp = paramDamp;
    this.minDist = minDist;

    this.target = new THREE.Vector3();
    this.lead = new THREE.Vector2();
    this.zones = [];
    this.colliders = [];
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
    this._pull = 0; // smoothed pull-in amount (hysteresis kills prop jitter)

    this.pose = null;
    this.poseK = 0;
    this._poseDir = 0;
    this._poseSpeed = 0;
  }

  setTarget(v) { this.target.copy(v); }
  setLead(vx, vz) { this.lead.set(vx, vz); }
  setZones(zones) { this.zones = zones || []; }
  setColliders(arr) { this.colliders = arr || []; }

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

    // 1) authored params: active zone (or defaults), damped for the glide.
    const zn = this._zoneAt(this.target.x, this.target.z);
    const goal = zn ? { ...this.defaults, ...zn } : this.defaults;
    const k = Math.min(dt * this.paramDamp, 1);
    // yaw eases the short way around
    let dy = goal.yaw - this.p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.p.yaw += dy * k;
    this.p.distance = lerp(this.p.distance, goal.distance, k);
    this.p.height = lerp(this.p.height, goal.height, k);
    this.p.lookHeight = lerp(this.p.lookHeight, goal.lookHeight, k);

    // 2) desired transform from params
    const sin = Math.sin(this.p.yaw), cos = Math.cos(this.p.yaw);
    this._desired.set(
      this.target.x - sin * this.p.distance,
      this.target.y + this.p.height,
      this.target.z - cos * this.p.distance,
    );
    this._head.set(this.target.x, this.target.y + this.p.lookHeight, this.target.z);
    this._lookT.copy(this._head);
    this._lookT.x += this.lead.x * 0.001 * this.lookAhead * 160;
    this._lookT.z += this.lead.y * 0.001 * this.lookAhead * 160;

    // 3) pull-in: nothing may sit between the head and the camera. The pull
    // AMOUNT is its own damped value — fast in (don't clip), slow out — with a
    // small deadband, so a ray grazing a prop edge can never pump the camera
    // (the jitter bug). Blockers are BIG props only (level-layout law 4).
    if (this.colliders.length) {
      this._dir.copy(this._desired).sub(this._head);
      const len = this._dir.length() || 1;
      this._dir.divideScalar(len);
      this._ray.set(this._head, this._dir);
      this._ray.far = len;
      this._ray.camera = this.camera; // required when groups contain Sprites
      const hits = this._ray.intersectObjects(this.colliders, true).filter((h) => !h.object.isSprite);
      let targetPull = 0;
      if (hits.length && hits[0].distance < len - 0.05) {
        targetPull = len - Math.max(this.minDist, hits[0].distance - 0.3);
      }
      const pk = targetPull > this._pull ? Math.min(dt * 0.02, 1) : Math.min(dt * 0.0028, 1);
      this._pull += (targetPull - this._pull) * pk;
      if (this._pull > 0.01) {
        this._desired.copy(this._head).addScaledVector(this._dir, Math.max(this.minDist, len - this._pull));
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
    const breath = Math.sin(this._t * 0.0009) * 0.045;
    if (this.pose && this.poseK > 0) {
      const kk = easeInOut(this.poseK);
      this.camera.position.set(
        lerp(this._pos.x, this.pose.pos.x, kk),
        lerp(this._pos.y, this.pose.pos.y, kk) + breath,
        lerp(this._pos.z, this.pose.pos.z, kk),
      );
      this._blend.set(
        lerp(this._look.x, this.pose.look.x, kk),
        lerp(this._look.y, this.pose.look.y, kk),
        lerp(this._look.z, this.pose.look.z, kk),
      );
      this.camera.lookAt(this._blend);
    } else {
      this.camera.position.set(this._pos.x, this._pos.y + breath, this._pos.z);
      this.camera.lookAt(this._look);
    }
  }

  // Beat API — identical contract to the D1 camera so sequences are portable.
  cinematicMoveTo({ angle = 0, target = this.target, distance = 4, height = 1.6, lookHeight = 1.3, duration = 1400 } = {}) {
    const t = target.isVector3 ? target.clone() : new THREE.Vector3(target.x, target.y || 0, target.z);
    const pos = new THREE.Vector3(t.x - Math.sin(angle) * distance, t.y + height, t.z - Math.cos(angle) * distance);
    const look = new THREE.Vector3(t.x, t.y + lookHeight, t.z);
    this.pose = { pos, look };
    this._poseDir = 1;
    this._poseSpeed = 1 / Math.max(1, duration);
  }

  release(duration = 1400) { this._poseDir = -1; this._poseSpeed = 1 / Math.max(1, duration); }
  get inCinematic() { return this.poseK > 0.001 || this._poseDir > 0; }

  snap() { this._init = false; this.frame(0); }
}
