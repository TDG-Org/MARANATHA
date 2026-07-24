import * as THREE from 'three';
import { glowTexture, mulberry32 } from './world.js';

// Pooled particle effects (vfx-particles skill): one THREE.Points per effect,
// fixed count, particles recycle (never spawn/destroy), zero per-frame
// allocation. Emitters are data ({x,y,z}) registered by props. Global opacity
// is fadeable so mood grading can bring effects in/out (fireflies at dusk).
class PointsEffect {
  constructor({ count, size, color, blending = THREE.AdditiveBlending, opacity = 0.5, fog = true, seed = 1 }) {
    this.count = count;
    this.activeCount = count;
    this.rnd = mulberry32(seed);
    this.pos = new Float32Array(count * 3);
    this.life = new Float32Array(count);   // 0..1
    this.speed = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.emIdx = new Uint8Array(count);    // which emitter owns the particle
    this.emitters = [];
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setDrawRange(0, count);
    this.mat = new THREE.PointsMaterial({
      map: glowTexture(64), color, size, sizeAttenuation: true, transparent: true,
      opacity, blending, depthWrite: false, fog,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.baseOpacity = opacity;
    this.fade = 1; // grading target 0..1
    this._fadeCur = 1;
  }

  addEmitter(x, y, z) { this.emitters.push({ x, y, z }); return this.emitters.length - 1; }

  // Quality can demote while a scene is live. Draw and simulate only the
  // active prefix; the fixed backing buffers remain reusable if the player
  // explicitly raises quality again during the same scene.
  setActiveCount(count) {
    this.activeCount = Math.max(0, Math.min(this.count, Math.round(count)));
    this.geo.setDrawRange(0, this.activeCount);
  }

  _respawn(i) {
    if (!this.emitters.length) return;
    const e = this.emitters[i % this.emitters.length];
    this.emIdx[i] = i % this.emitters.length;
    this.pos[i * 3] = e.x + (this.rnd() - 0.5) * 0.4;
    this.pos[i * 3 + 1] = e.y;
    this.pos[i * 3 + 2] = e.z + (this.rnd() - 0.5) * 0.4;
    this.life[i] = this.rnd(); // stagger
    this.speed[i] = 0.6 + this.rnd() * 0.8;
    this.phase[i] = this.rnd() * Math.PI * 2;
  }

  setFade(f) { this.fade = f; }

  _fadeStep(dt) {
    this._fadeCur += (this.fade - this._fadeCur) * Math.min(dt * 0.002, 1);
    this.mat.opacity = this.baseOpacity * this._fadeCur;
    this.points.visible = this.activeCount > 0 && this.mat.opacity > 0.01;
  }

  dispose() {
    this.geo.dispose();
    this.mat.map?.dispose();
    this.mat.dispose();
    this.points.parent?.remove(this.points);
  }
}

// Smoke: rises with widening wobble, normal blending, fades by height.
export function makeSmoke({ count = 26, seed = 21 } = {}) {
  const fx = new PointsEffect({ count, size: 0.85, color: 0xb9a898, blending: THREE.NormalBlending, opacity: 0.34, seed });
  fx.init = () => { for (let i = 0; i < count; i++) fx._respawn(i); fx.geo.attributes.position.needsUpdate = true; };
  fx.update = (dt, t) => {
    fx._fadeStep(dt);
    if (!fx.points.visible || !fx.emitters.length) return;
    const s = dt * 0.001;
    for (let i = 0; i < fx.activeCount; i++) {
      fx.life[i] += s * 0.22 * fx.speed[i];
      if (fx.life[i] >= 1) { fx._respawn(i); fx.life[i] = 0; }
      const e = fx.emitters[fx.emIdx[i]];
      const k = fx.life[i];
      fx.pos[i * 3 + 1] = e.y + k * 4.6;
      fx.pos[i * 3] = e.x + Math.sin(t * 0.7 + fx.phase[i] + k * 4) * (0.15 + k * 0.75);
      fx.pos[i * 3 + 2] = e.z + Math.cos(t * 0.6 + fx.phase[i] + k * 3) * (0.12 + k * 0.6);
    }
    fx.geo.attributes.position.needsUpdate = true;
  };
  return fx;
}

// Embers: few, bright, fast, die young.
export function makeEmbers({ count = 14, seed = 22 } = {}) {
  const fx = new PointsEffect({ count, size: 0.16, color: 0xffb36b, opacity: 0.9, seed });
  fx.init = () => { for (let i = 0; i < count; i++) fx._respawn(i); fx.geo.attributes.position.needsUpdate = true; };
  fx.update = (dt, t) => {
    fx._fadeStep(dt);
    if (!fx.points.visible || !fx.emitters.length) return;
    const s = dt * 0.001;
    for (let i = 0; i < fx.activeCount; i++) {
      fx.life[i] += s * (0.8 + fx.speed[i] * 0.5);
      if (fx.life[i] >= 1) { fx._respawn(i); fx.life[i] = 0; }
      const e = fx.emitters[fx.emIdx[i]];
      const k = fx.life[i];
      fx.pos[i * 3 + 1] = e.y + 0.2 + k * 1.7;
      fx.pos[i * 3] = e.x + Math.sin(fx.phase[i] + k * 6) * 0.18;
      fx.pos[i * 3 + 2] = e.z + Math.cos(fx.phase[i] * 1.3 + k * 5) * 0.18;
    }
    fx.geo.attributes.position.needsUpdate = true;
  };
  return fx;
}

// Fireflies: wander near the ground, blink on a per-particle gate. Faded in by
// the dusk mood (starts at 0).
export function makeFireflies({ count = 26, span = 30, seed = 23 } = {}) {
  const fx = new PointsEffect({ count, size: 0.22, color: 0xffe9a8, opacity: 0.85, seed });
  fx.setFade(0);
  fx._fadeCur = 0;
  fx.init = () => {
    for (let i = 0; i < count; i++) {
      fx.pos[i * 3] = (fx.rnd() - 0.5) * span;
      fx.pos[i * 3 + 1] = 0.4 + fx.rnd() * 1.4;
      fx.pos[i * 3 + 2] = (fx.rnd() - 0.5) * span;
      fx.phase[i] = fx.rnd() * Math.PI * 2;
      fx.speed[i] = 0.5 + fx.rnd();
    }
    fx.geo.attributes.position.needsUpdate = true;
  };
  fx.update = (dt, t) => {
    fx._fadeStep(dt);
    if (!fx.points.visible) return;
    for (let i = 0; i < fx.activeCount; i++) {
      fx.pos[i * 3] += Math.sin(t * 0.35 * fx.speed[i] + fx.phase[i]) * dt * 0.0006;
      fx.pos[i * 3 + 1] += Math.cos(t * 0.5 * fx.speed[i] + fx.phase[i] * 2) * dt * 0.0004;
      fx.pos[i * 3 + 2] += Math.cos(t * 0.3 * fx.speed[i] + fx.phase[i]) * dt * 0.0006;
    }
    // blink via size pulse (cheap global) — per-particle blink comes from phase spread
    fx.mat.size = 0.16 + Math.abs(Math.sin(t * 1.7)) * 0.1;
    fx.geo.attributes.position.needsUpdate = true;
  };
  return fx;
}
