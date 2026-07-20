import * as THREE from 'three';
import { easeInOut } from './world.js';

// Mood grading (lighting-mood skill): a named mood moves FOUR things together
// in one eased tween — sky stops, fog color/near, the character light rig, and
// a whisper of DOM tint. Scenes pass their own mood table; beats call
// grade('dusk'). Update per frame.
// D4 grade: the environment is now LIT by the sun, so each mood also carries a
// SUN DIRECTION (`sun: [x,y,z]` — the directional light's position; it points
// at the origin) and a hemi fill color, and the whole day cycle re-shades the
// camp: golden afternoon (high warm sun) → orange dusk (low, raking) → cool
// night (low moonlight from the far side). Key intensities are tuned so lit
// surfaces read rich, not blown out.
// D6: every mood also tints the MOUNTAINS — `ridge: [veryFar, far, mid]`
// (haze-ordered light→dark near). ONE palette drives sky + fog + ridges +
// light together, so evening turns the mountains warm-red, night turns them
// cool, morning turns them golden (lighting-mood hard rule).
export const MOODS = {
  // goldenHour key light comes FROM the north-low morning sun the player can
  // SEE in the ridge saddle (D6 sunrise) — shading and sky agree on where the
  // light is. The warm hemi keeps camera-facing sides painterly, not backlit.
  goldenHour: { skyTop: 0xefa45e, skyBottom: 0xffe4b6, fog: 0xffd6a2, fogNear: 44, key: 0xffe1ad, keyI: 1.05, hemi: 0.62, hemiSky: 0xffe4b6, sun: [2, 9, -12], ridge: [0xc9a184, 0xb08a8a, 0x74597a], tint: '#000000', tintA: 0 },
  // D11: the FIRST LIGHT after the pit — a deep warm daybreak the morning pan
  // eases into full goldenHour from (the straight gray→gold cut read "way too
  // white"). Sunrise, not a lightswitch.
  dawn: { skyTop: 0xc9824f, skyBottom: 0xf2c68e, fog: 0xe6b98a, fogNear: 42, key: 0xf7d3a0, keyI: 0.8, hemi: 0.5, hemiSky: 0xf2c68e, sun: [2, 6, -12], ridge: [0xbd9078, 0xa27a80, 0x67506f], tint: '#000000', tintA: 0 },
  // The pit (cold open): trapped and airless in COLOR, not in visibility —
  // D8: fog pushed back (18→36) + a stronger key so every figure reads
  // clearly; the drained "future" PostFX carries the gloom instead.
  pit: { skyTop: 0x3a3550, skyBottom: 0x6b5a63, fog: 0x6b6274, fogNear: 36, key: 0xa89dbc, keyI: 0.72, hemi: 0.46, hemiSky: 0x6b5a63, sun: [0, 12, 5], ridge: [0x8b8496, 0x776f84, 0x565064], tint: '#1c1830', tintA: 0.12 },
  // Jacob's tent interior: warm lamplight raking from one side.
  tentWarm: { skyTop: 0x4a4e8f, skyBottom: 0xe88d67, fog: 0x2e2118, fogNear: 11, key: 0xffc888, keyI: 1.0, hemi: 0.45, hemiSky: 0xe8a86a, sun: [-3.5, 5, 2.5], ridge: [0x8a6a7e, 0x74566e, 0x4e3a54], tint: '#2a1c10', tintA: 0.08 },
  // D8 deeper-mood push: dusk burns a touch deeper, ominous presses harder.
  dusk: { skyTop: 0x3c4499, skyBottom: 0xf4854e, fog: 0xc08a70, fogNear: 38, key: 0xffb877, keyI: 0.82, hemi: 0.46, hemiSky: 0xf4854e, sun: [-15, 4.5, 3], ridge: [0xc08578, 0xa66a72, 0x6f4560], tint: '#3a2f55', tintA: 0.09 },
  ominous: { skyTop: 0x363050, skyBottom: 0x675663, fog: 0x585264, fogNear: 26, key: 0xcab39a, keyI: 0.66, hemi: 0.4, hemiSky: 0x675663, sun: [-7, 8, 3], ridge: [0x77708a, 0x655e76, 0x484157], tint: '#251f33', tintA: 0.14 },
  dream: { skyTop: 0x2b3a67, skyBottom: 0x9a8fd2, fog: 0x6f6ca4, fogNear: 34, key: 0xc8d4ff, keyI: 0.72, hemi: 0.5, hemiSky: 0x9a8fd2, sun: [7, 10, -7], ridge: [0x6a6fa6, 0x585d94, 0x3d426f], tint: '#1d2547', tintA: 0.1 },
  night: { skyTop: 0x0b1026, skyBottom: 0x2b3a67, fog: 0x1b2340, fogNear: 30, key: 0x9fb6e0, keyI: 0.5, hemi: 0.36, hemiSky: 0x2b3a67, sun: [11, 7, -6], ridge: [0x333c66, 0x2a3258, 0x1c2340], tint: '#060a18', tintA: 0.12 },
};

export class MoodGrading {
  // refs: { sky (from makeSky), fog (THREE.Fog), keyLight, hemiLight, cinema,
  //         ridges? (material array from makeRidges().userData.materials) }
  constructor(refs, moods = MOODS) {
    this.r = refs;
    this.moods = moods;
    this.current = null;
    this._tween = null;
    this._fromFog = new THREE.Color();
    this._toFog = new THREE.Color();
    this._fromKey = new THREE.Color();
    this._toKey = new THREE.Color();
    this._fromHemiSky = new THREE.Color();
    this._toHemiSky = new THREE.Color();
    this._fromSun = new THREE.Vector3();
    this._toSun = new THREE.Vector3();
    this._fromRidge = (refs.ridges || []).map(() => new THREE.Color());
    this._toRidge = (refs.ridges || []).map(() => new THREE.Color());
  }

  // Eased transition to a named mood. Resolves when the grade completes.
  grade(name, ms = 2400) {
    const m = this.moods[name];
    if (!m) { console.warn('[grading] unknown mood', name); return Promise.resolve(); }
    this.current = name;
    const r = this.r;
    r.sky.setColors(m.skyTop, m.skyBottom, ms);
    this._fromFog.copy(r.fog.color);
    this._toFog.set(m.fog);
    this._fromKey.copy(r.keyLight.color);
    this._toKey.set(m.key);
    this._fromHemiSky.copy(r.hemiLight.color);
    this._toHemiSky.set(m.hemiSky ?? m.skyBottom);
    this._fromSun.copy(r.keyLight.position);
    this._toSun.set(...(m.sun ?? [-9, 13, 6]));
    // the mountains tell the time too (one shared palette — lighting-mood)
    if (r.ridges && m.ridge) {
      r.ridges.forEach((mat, i) => {
        this._fromRidge[i].copy(mat.color);
        this._toRidge[i].set(m.ridge[i] ?? m.ridge[m.ridge.length - 1]);
      });
    }
    r.cinema?.setTint(m.tint, m.tintA);
    return new Promise((resolve) => {
      this._tween = {
        t: 0, ms, resolve,
        fogNear0: r.fog.near, fogNear1: m.fogNear,
        keyI0: r.keyLight.intensity, keyI1: m.keyI,
        hemi0: r.hemiLight.intensity, hemi1: m.hemi,
      };
      if (ms <= 0) this._apply(1);
    });
  }

  // Instant set (beat entry on checkpoint resume — no transition).
  set(name) { return this.grade(name, 0); }

  _apply(k) {
    const tw = this._tween;
    const r = this.r;
    r.fog.color.lerpColors(this._fromFog, this._toFog, k);
    r.fog.near = tw.fogNear0 + (tw.fogNear1 - tw.fogNear0) * k;
    r.keyLight.color.lerpColors(this._fromKey, this._toKey, k);
    r.keyLight.intensity = tw.keyI0 + (tw.keyI1 - tw.keyI0) * k;
    r.hemiLight.intensity = tw.hemi0 + (tw.hemi1 - tw.hemi0) * k;
    r.hemiLight.color.lerpColors(this._fromHemiSky, this._toHemiSky, k);
    // the sun ARCS across the day (direction re-shades the whole camp)
    r.keyLight.position.lerpVectors(this._fromSun, this._toSun, k);
    if (r.ridges && this.moods[this.current]?.ridge) {
      r.ridges.forEach((mat, i) => mat.color.lerpColors(this._fromRidge[i], this._toRidge[i], k));
    }
    if (k >= 1) { tw.resolve(); this._tween = null; }
  }

  update(dt) {
    if (!this._tween) return;
    this._tween.t = Math.min(1, this._tween.t + (this._tween.ms ? dt / this._tween.ms : 1));
    this._apply(easeInOut(this._tween.t));
  }
}
