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
      // D8: C sits the hero down wherever he stands (a held kneel/sit pose —
      // any movement stands him back up; see the anim-state logic below).
      if (k === 'c' && this.enabled && this.vel.lengthSq() < 0.1) this.character.play('kneel');
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    // Input hardening: if focus leaves (right-click menu, screenshot overlay,
    // alt-tab, tab hide), keyups are lost and a held key would run forever.
    // Clear ALL transient input state on every such exit.
    this._clearInput = () => { this.keys.clear(); this.joystick.reset(); };
    this._onBlur = () => this._clearInput();
    this._onVisibility = () => { if (document.hidden) this._clearInput(); };
    this._onContextMenu = () => this._clearInput();
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('contextmenu', this._onContextMenu);
  }

  setEnabled(on) { this.enabled = on; if (!on) this._clearInput(); }

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
    const prevX = pos.x, prevZ = pos.z;
    pos.x += this.vel.x * dt * 0.001;
    pos.z += this.vel.y * dt * 0.001;
    if (this.colliders) this.colliders.resolve(pos, this.radius, this.dynamics);
    pos.x = clamp(pos.x, this.bounds.minX, this.bounds.maxX);
    pos.z = clamp(pos.z, this.bounds.minZ, this.bounds.maxZ);

    const speed = this.vel.length();
    this.moveVec.set(this.vel.x, this.vel.y);

    // REAL velocity = how far the body actually moved after collision/clamp.
    // Animation must follow this, not the desired velocity — pinned against a
    // fence means IDLE, sliding along it means walk (never running in place).
    const realSpeed = dt > 0 ? (Math.hypot(pos.x - prevX, pos.z - prevZ) / dt) * 1000 : 0;
    const animSpeed = Math.min(speed, realSpeed);

    // Turn + animation state (from real movement).
    if (animSpeed > 0.25) this.character.turnToward(this.vel.x, this.vel.y);
    const state = animSpeed < 0.35 ? 'idle' : (running && animSpeed > this.walkSpeed * 1.05 ? 'run' : 'walk');
    // Movement overrides a held kneel/talk pose; standing lets the pose hold.
    if (animSpeed > 0.35) this.character.play(state);
    else if (this.character.state !== 'kneel' && this.character.state !== 'talk') this.character.play('idle');
    this.character.update(dt, this.camera);

    // Footsteps — scene can supply a surface-aware handler (onFootstep).
    if (animSpeed > 0.5) {
      this._footT += animSpeed * dt * 0.001;
      const stride = state === 'run' ? 0.8 : 1.15;
      if (this._footT > stride) {
        this._footT = 0;
        if (this.onFootstep) this.onFootstep(pos);
        else Audio.footstep();
      }
    }
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('contextmenu', this._onContextMenu);
    this.joystick.dispose();
  }
}
