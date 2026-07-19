import * as THREE from 'three';
import { clamp } from '../world.js';
import { Audio } from '../../systems/AudioSystem.js';

// Free movement for the player: WASD / arrow keys (camera-relative), tap /
// click to move, and an on-screen joystick on touch devices. Velocity ramps in
// and coasts out (animation skill); the character animates itself from the
// velocity we hand it. Movement is clamped to a walkable band.
export class PlayerController {
  constructor({ camera, character, domElement, bounds, walkSpeed = 3.4 }) {
    this.camera = camera;
    this.character = character;
    this.dom = domElement;
    this.walkSpeed = walkSpeed;
    this.bounds = bounds || { minX: -12, maxX: 12, minZ: -12, maxZ: 8 };
    this.enabled = true;

    this.vel = new THREE.Vector2(0, 0); // (x, z) world velocity
    this.keys = new Set();
    this.joy = new THREE.Vector2(0, 0); // analog, [-1..1], y down
    this.target = null;                 // tap-to-move destination
    this._footT = 0;

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();

    this._bindKeys();
    this._bindTap();
    this._buildJoystick();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) { this.keys.clear(); this.joy.set(0, 0); this.target = null; }
  }

  // --- input ---------------------------------------------------------------
  _bindKeys() {
    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        this.target = null; // keyboard overrides tap-to-move
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _bindTap() {
    this._onTap = (e) => {
      if (!this.enabled) return;
      const rect = this.dom.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera({ x: nx, y: ny }, this.camera);
      if (this._raycaster.ray.intersectPlane(this._plane, this._hit)) {
        this.target = new THREE.Vector2(
          clamp(this._hit.x, this.bounds.minX, this.bounds.maxX),
          clamp(this._hit.z, this.bounds.minZ, this.bounds.maxZ),
        );
      }
    };
    this.dom.addEventListener('pointerdown', this._onTap);
  }

  _buildJoystick() {
    // Only on touch devices; desktop uses keys + tap.
    this.hasJoystick = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!this.hasJoystick) return;
    const base = document.createElement('div');
    base.style.cssText = [
      'position:fixed', 'left:20px', 'bottom:22px', 'z-index:35',
      'width:120px', 'height:120px', 'border-radius:50%', 'touch-action:none',
      'background:rgba(16,14,26,0.28)', 'border:1px solid rgba(255,255,255,0.16)',
      'backdrop-filter:blur(2px)',
    ].join(';');
    const thumb = document.createElement('div');
    thumb.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%', 'width:52px', 'height:52px',
      'margin:-26px 0 0 -26px', 'border-radius:50%',
      'background:rgba(242,184,128,0.5)', 'border:1px solid rgba(255,255,255,0.3)',
      'transition:transform 60ms linear',
    ].join(';');
    base.append(thumb);
    document.body.append(base);
    this._joyBase = base;

    const R = 46;
    let id = null;
    const set = (cx, cy, ev) => {
      const r = base.getBoundingClientRect();
      let dx = ev.clientX - (r.left + r.width / 2);
      let dy = ev.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, R);
      dx = (dx / len) * cl; dy = (dy / len) * cl;
      thumb.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.set(dx / R, dy / R);
      this.target = null;
    };
    this._joyDown = (ev) => { id = ev.pointerId; base.setPointerCapture?.(id); set(0, 0, ev); };
    this._joyMove = (ev) => { if (ev.pointerId === id) set(0, 0, ev); };
    this._joyUp = (ev) => {
      if (ev.pointerId !== id) return;
      id = null; this.joy.set(0, 0); thumb.style.transform = 'translate(0,0)';
    };
    base.addEventListener('pointerdown', this._joyDown);
    base.addEventListener('pointermove', this._joyMove);
    base.addEventListener('pointerup', this._joyUp);
    base.addEventListener('pointercancel', this._joyUp);
  }

  // --- per-frame -----------------------------------------------------------
  _cameraBasis() {
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0; this._fwd.normalize();
    this._right.set(-this._fwd.z, 0, this._fwd.x); // 90° right on the ground
  }

  update(dt) {
    const pos = this.character.position;
    let wantX = 0, wantZ = 0;

    if (this.enabled) {
      this._cameraBasis();
      let ix = 0, iz = 0; // input in camera space: iz forward, ix right
      const k = this.keys;
      if (k.has('w') || k.has('arrowup')) iz += 1;
      if (k.has('s') || k.has('arrowdown')) iz -= 1;
      if (k.has('d') || k.has('arrowright')) ix += 1;
      if (k.has('a') || k.has('arrowleft')) ix -= 1;
      if (this.joy.lengthSq() > 0.02) { ix += this.joy.x; iz += -this.joy.y; }

      if (ix !== 0 || iz !== 0) {
        const dir = new THREE.Vector3()
          .addScaledVector(this._fwd, iz)
          .addScaledVector(this._right, ix);
        if (dir.lengthSq() > 1) dir.normalize(); // keep analog (joystick) magnitude ≤1
        wantX = dir.x * this.walkSpeed;
        wantZ = dir.z * this.walkSpeed;
        this.target = null;
      } else if (this.target) {
        const dx = this.target.x - pos.x;
        const dz = this.target.y - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.28) { this.target = null; } else {
          wantX = (dx / d) * this.walkSpeed;
          wantZ = (dz / d) * this.walkSpeed;
        }
      }
    }

    // Ease velocity (ramp in / coast out) and integrate.
    const acc = Math.min(dt * 0.012, 1);
    this.vel.x += (wantX - this.vel.x) * acc;
    this.vel.y += (wantZ - this.vel.y) * acc;
    pos.x = clamp(pos.x + this.vel.x * dt * 0.001, this.bounds.minX, this.bounds.maxX);
    pos.z = clamp(pos.z + this.vel.y * dt * 0.001, this.bounds.minZ, this.bounds.maxZ);

    // Footstep ticks scaled to gait.
    const speed = this.vel.length();
    if (speed > 0.4) {
      this._footT += speed * dt * 0.001;
      if (this._footT > 1.15) { this._footT = 0; Audio.footstep(); }
    }

    this.character.animate(dt, this.camera, this.vel.x, this.vel.y, this.walkSpeed);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.dom.removeEventListener('pointerdown', this._onTap);
    this._joyBase?.remove();
  }
}
