import * as THREE from 'three';
import { clamp } from './world.js';
import { Joystick } from '../ui/joystick.js';
import { Audio } from '../systems/AudioSystem.js';

// Moves a Character3D relative to the camera (WASD / arrows + touch joystick),
// eased. The character turns toward its move direction and picks idle/walk/run.
// Exposes moveVec so the 3rd-person camera can trail the movement.
export class PlayerController3D {
  constructor({ camera, character, bounds, walkSpeed = 3.4, runSpeed = 6.6, colliders = null, radius = 0.42 }) {
    this.camera = camera;
    this.character = character;
    this.walkSpeed = walkSpeed;
    this.runSpeed = runSpeed;
    this.bounds = bounds || { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
    this.colliders = colliders; // ColliderWorld (optional)
    this.dynamics = null;       // array of {x,z,r} live circles (NPCs/sheep)
    this.radius = radius;
    this.enabled = true;

    this.vel = new THREE.Vector2(0, 0);   // world (x, z)
    this.moveVec = new THREE.Vector2(0, 0); // normalized move dir for the camera
    this.keys = new Set();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._moveDir = new THREE.Vector3(); // scratch (no per-frame alloc)
    this._footT = 0;

    this.joystick = new Joystick({ side: 'left' });

    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) this.keys.add(k);
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  setEnabled(on) { this.enabled = on; if (!on) { this.keys.clear(); } }

  _cameraBasis() {
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    this._fwd.normalize();
    this._right.set(-this._fwd.z, 0, this._fwd.x);
  }

  update(dt) {
    const pos = this.character.position;
    let ix = 0, iz = 0, running = false;

    if (this.enabled) {
      this._cameraBasis();
      const k = this.keys;
      if (k.has('w') || k.has('arrowup')) iz += 1;
      if (k.has('s') || k.has('arrowdown')) iz -= 1;
      if (k.has('d') || k.has('arrowright')) ix += 1;
      if (k.has('a') || k.has('arrowleft')) ix -= 1;
      if (this.joystick.active) {
        ix += this.joystick.vec.x;
        iz += -this.joystick.vec.y;
      }
      running = k.has('shift') || (this.joystick.active && this.joystick.vec.x ** 2 + this.joystick.vec.y ** 2 > 0.72);
    }

    let wantX = 0, wantZ = 0;
    this._moveDir.set(0, 0, 0);
    if (ix !== 0 || iz !== 0) {
      this._moveDir.addScaledVector(this._fwd, iz).addScaledVector(this._right, ix);
      if (this._moveDir.lengthSq() > 1) this._moveDir.normalize();
      const spd = running ? this.runSpeed : this.walkSpeed;
      wantX = this._moveDir.x * spd;
      wantZ = this._moveDir.z * spd;
    }

    // Ease velocity, integrate, resolve collision (smooth slide), clamp.
    const acc = Math.min(dt * 0.012, 1);
    this.vel.x += (wantX - this.vel.x) * acc;
    this.vel.y += (wantZ - this.vel.y) * acc;
    pos.x += this.vel.x * dt * 0.001;
    pos.z += this.vel.y * dt * 0.001;
    if (this.colliders) this.colliders.resolve(pos, this.radius, this.dynamics);
    pos.x = clamp(pos.x, this.bounds.minX, this.bounds.maxX);
    pos.z = clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);

    const speed = this.vel.length();
    this.moveVec.set(this.vel.x, this.vel.y);

    // Turn + animation state.
    if (speed > 0.25) this.character.turnToward(this.vel.x, this.vel.y);
    const state = speed < 0.35 ? 'idle' : (running && speed > this.walkSpeed * 1.05 ? 'run' : 'walk');
    // Movement overrides a held kneel/talk pose; standing lets the pose hold.
    if (speed > 0.35) this.character.play(state);
    else if (this.character.state !== 'kneel' && this.character.state !== 'talk') this.character.play('idle');
    this.character.update(dt, this.camera);

    // Footsteps.
    if (speed > 0.5) {
      this._footT += speed * dt * 0.001;
      const stride = state === 'run' ? 0.8 : 1.15;
      if (this._footT > stride) { this._footT = 0; Audio.footstep(); }
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.joystick.dispose();
  }
}
