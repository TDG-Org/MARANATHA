import * as THREE from 'three';

// A gentle follow camera for playable stories (depth-and-camera skill):
// trails the player with position AND lookAt smoothed separately, lookAt led
// slightly by the player's motion, plus a soft breath. Dramatic beats can ease
// it to a fixed cinematic pose and back.
export class FollowCamera {
  constructor(camera, {
    offset = new THREE.Vector3(0, 6.2, 11.5), // camera sits up & back (+Z)
    lookOffset = new THREE.Vector3(0, 1.9, 0),
    posLerp = 0.0022,
    lookLerp = 0.0035,
  } = {}) {
    this.camera = camera;
    this.offset = offset;
    this.lookOffset = lookOffset;
    this.posLerp = posLerp;
    this.lookLerp = lookLerp;

    this.target = new THREE.Vector3();       // player feet
    this.lead = new THREE.Vector3();         // motion lead for lookAt
    this._pos = new THREE.Vector3().copy(offset);
    this._look = new THREE.Vector3();
    this._desiredPos = new THREE.Vector3();
    this._desiredLook = new THREE.Vector3();
    this._t = 0;

    this.pose = null;   // { pos, look } cinematic override
    this.poseK = 0;     // 0 = follow, 1 = full pose
    this._poseDir = 0;  // +1 easing toward pose, -1 easing back
    this._poseSpeed = 0;
  }

  setTarget(vec3) { this.target.copy(vec3); }
  setLead(vx, vz) { this.lead.set(vx, 0, vz); }

  // Ease to a fixed cinematic pose (drama), or release() back to follow.
  toPose(pos, look, ms = 1400) { this.pose = { pos: pos.clone(), look: look.clone() }; this._poseDir = 1; this._poseSpeed = 1 / ms; }
  release(ms = 1400) { this._poseDir = -1; this._poseSpeed = 1 / ms; }

  snapToTarget() {
    this._desiredPos.copy(this.target).add(this.offset);
    this._pos.copy(this._desiredPos);
    this._look.copy(this.target).add(this.lookOffset);
  }

  frame(dt) {
    this._t += dt;

    // Follow targets.
    this._desiredPos.copy(this.target).add(this.offset);
    this._desiredLook.copy(this.target).add(this.lookOffset).addScaledVector(this.lead, 0.35);

    // Smooth (frame-rate independent enough for our dt clamp).
    const pk = Math.min(dt * this.posLerp, 1);
    const lk = Math.min(dt * this.lookLerp, 1);
    this._pos.lerp(this._desiredPos, pk);
    this._look.lerp(this._desiredLook, lk);

    // Blend toward/away from a cinematic pose if one is set.
    if (this._poseDir !== 0) {
      this.poseK = THREE.MathUtils.clamp(this.poseK + this._poseDir * this._poseSpeed * dt, 0, 1);
      if (this.poseK === 0 && this._poseDir < 0) { this._poseDir = 0; this.pose = null; }
      if (this.poseK === 1 && this._poseDir > 0) this._poseDir = 0;
    }

    const outPos = this._pos;
    const outLook = this._look;
    if (this.pose && this.poseK > 0) {
      const k = 0.5 - 0.5 * Math.cos(Math.PI * this.poseK); // ease
      this.camera.position.set(
        THREE.MathUtils.lerp(this._pos.x, this.pose.pos.x, k),
        THREE.MathUtils.lerp(this._pos.y, this.pose.pos.y, k) + Math.sin(this._t * 0.0009) * 0.06,
        THREE.MathUtils.lerp(this._pos.z, this.pose.pos.z, k),
      );
      this._blendLook = this._blendLook || new THREE.Vector3();
      this._blendLook.set(
        THREE.MathUtils.lerp(this._look.x, this.pose.look.x, k),
        THREE.MathUtils.lerp(this._look.y, this.pose.look.y, k),
        THREE.MathUtils.lerp(this._look.z, this.pose.look.z, k),
      );
      this.camera.lookAt(this._blendLook);
    } else {
      this.camera.position.set(outPos.x, outPos.y + Math.sin(this._t * 0.0009) * 0.06, outPos.z);
      this.camera.lookAt(outLook);
    }
  }
}
