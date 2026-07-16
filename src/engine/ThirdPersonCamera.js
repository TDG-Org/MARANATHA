import * as THREE from 'three';
import { clamp, lerp, easeInOut } from './world.js';

// True 3rd-person camera (cinematography skill): sits behind + above the
// shoulder, trails the move direction with smooth-damped position AND yaw, and
// leads the look slightly in the move direction. Dramatic beats ease to a
// cinematic framing via cinematicMoveTo() and hand control back with release().
// A raycast pull-in keeps it from clipping terrain/props.
export class ThirdPersonCamera {
  constructor(camera, {
    distance = 6.5, height = 3.4, shoulderH = 1.7, lookAhead = 2.2,
    posDamp = 0.006, lookDamp = 0.009, yawDamp = 0.006, minDist = 1.5,
  } = {}) {
    this.camera = camera;
    this.distance = distance;
    this.height = height;
    this.shoulderH = shoulderH;
    this.lookAhead = lookAhead;
    this.posDamp = posDamp;
    this.lookDamp = lookDamp;
    this.yawDamp = yawDamp;
    this.minDist = minDist;

    this.target = new THREE.Vector3();
    this.colliders = [];
    this._yaw = 0;
    this._t = 0;
    this._init = false;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._head = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._ray = new THREE.Raycaster();

    this.pose = null;
    this.poseK = 0;
    this._poseDir = 0;
    this._poseSpeed = 0;
    this._blend = new THREE.Vector3();
  }

  setTarget(v) { this.target.copy(v); }
  setColliders(arr) { this.colliders = arr || []; }
  setYaw(y) { this._yaw = y; } // initial facing

  frame(dt, moveX = 0, moveZ = 0) {
    this._t += dt;
    this._head.set(this.target.x, this.target.y + this.shoulderH, this.target.z);

    // Trail the move direction (eased yaw); hold when idle.
    if (moveX * moveX + moveZ * moveZ > 0.02) {
      const desiredYaw = Math.atan2(moveX, moveZ);
      let d = desiredYaw - this._yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this._yaw += d * Math.min(dt * this.yawDamp, 1);
    }
    this._fwd.set(Math.sin(this._yaw), 0, Math.cos(this._yaw));

    // Desired camera position: behind + above the head.
    this._desired.copy(this._head).addScaledVector(this._fwd, -this.distance);
    this._desired.y += this.height - this.shoulderH;

    // Raycast pull-in: never let terrain/props come between head and camera.
    if (this.colliders.length) {
      this._dir.copy(this._desired).sub(this._head);
      const len = this._dir.length() || 1;
      this._dir.divideScalar(len);
      this._ray.set(this._head, this._dir);
      this._ray.far = len;
      const hits = this._ray.intersectObjects(this.colliders, true);
      if (hits.length && hits[0].distance < len) {
        this._desired.copy(this._head).addScaledVector(this._dir, Math.max(this.minDist, hits[0].distance - 0.3));
      }
    }

    const lookTarget = this._head.clone().addScaledVector(this._fwd, this.lookAhead);
    if (!this._init) { this._pos.copy(this._desired); this._look.copy(lookTarget); this._init = true; }
    this._pos.lerp(this._desired, Math.min(dt * this.posDamp, 1));
    this._look.lerp(lookTarget, Math.min(dt * this.lookDamp, 1));

    // Cinematic pose blend.
    if (this._poseDir !== 0) {
      this.poseK = clamp(this.poseK + this._poseDir * this._poseSpeed * dt, 0, 1);
      if (this.poseK === 0 && this._poseDir < 0) { this._poseDir = 0; this.pose = null; }
      if (this.poseK === 1 && this._poseDir > 0) this._poseDir = 0;
    }
    const breath = Math.sin(this._t * 0.0009) * 0.05;
    if (this.pose && this.poseK > 0) {
      const k = easeInOut(this.poseK);
      this.camera.position.set(
        lerp(this._pos.x, this.pose.pos.x, k),
        lerp(this._pos.y, this.pose.pos.y, k) + breath,
        lerp(this._pos.z, this.pose.pos.z, k),
      );
      this._blend.set(
        lerp(this._look.x, this.pose.look.x, k),
        lerp(this._look.y, this.pose.look.y, k),
        lerp(this._look.z, this.pose.look.z, k),
      );
      this.camera.lookAt(this._blend);
    } else {
      this.camera.position.set(this._pos.x, this._pos.y + breath, this._pos.z);
      this.camera.lookAt(this._look);
    }
  }

  // Ease to a cinematic framing: `angle` = yaw around the target, from which
  // the camera sits back `distance` and up `height`, looking at `target`.
  cinematicMoveTo({ angle = 0, target = this.target, distance = this.distance, height = this.height, duration = 1400 } = {}) {
    const t = target.isVector3 ? target.clone() : new THREE.Vector3(target.x, target.y, target.z);
    const fwd = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const pos = t.clone().addScaledVector(fwd, -distance);
    pos.y += height;
    const look = t.clone();
    look.y += this.shoulderH;
    this.pose = { pos, look };
    this._poseDir = 1;
    this._poseSpeed = 1 / Math.max(1, duration);
  }

  release(duration = 1400) { this._poseDir = -1; this._poseSpeed = 1 / Math.max(1, duration); }
  get inCinematic() { return this.poseK > 0.001 || this._poseDir > 0; }
}
