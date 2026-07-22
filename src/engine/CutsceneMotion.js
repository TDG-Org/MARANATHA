import { easeInOut } from './world.js';

// One bounded, scene-owned actor motion track. Story code describes poses,
// while the live scene update supplies dt, so authored motion never falls back
// to 40–50ms timer stepping. A new track safely settles the previous one.
export class CutsceneMotion {
  constructor() {
    this._job = null;
  }

  tween(duration, apply, easing = easeInOut) {
    this.cancel();
    const ms = Math.max(1, duration || 1);
    apply(0, 0);
    return new Promise((resolve, reject) => {
      this._job = { elapsed: 0, duration: ms, apply, easing, resolve, reject };
    });
  }

  update(dt) {
    const job = this._job;
    if (!job) return;
    job.elapsed = Math.min(job.duration, job.elapsed + Math.max(0, dt));
    const raw = job.elapsed / job.duration;
    job.apply(job.easing(raw), raw);
    if (raw >= 1) {
      this._job = null;
      job.resolve(true);
    }
  }

  cancel(error = null) {
    const job = this._job;
    if (!job) return;
    this._job = null;
    if (error) job.reject(error); else job.resolve(false);
  }

  get active() { return !!this._job; }
}
