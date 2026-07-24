import { detectTier } from '../core/quality.js';

// Graphics Quality: Low / Medium / High is the player's beauty-versus-power
// dial. Presets cap pixel ratio, scale particles, and toggle scene extras.
const KEY = 'maranatha-graphics-v1'; // the player's explicit choice
const AUTO_KEY = 'maranatha-graphics-auto'; // the last automatic demotion
const PRESET_ORDER = ['low', 'medium', 'high'];
const AUTO_START_CEILING = 'medium';
const AUTO_SAMPLE_FRAMES = 600;
const AUTO_COOLDOWN_FRAMES = 300;

export const GRAPHICS_PRESETS = {
  low: { label: 'Low', dprCap: 1, particleScale: 0.4, contactShadow: false, fogFar: 200, anisotropy: 1 },
  // The pooled character shadows cost one change-gated draw for the whole
  // cast, so Medium can keep this grounding cue without restoring the old
  // 15-draw fan-out. Only Low removes it.
  medium: { label: 'Medium', dprCap: 1.5, particleScale: 1.0, contactShadow: true, fogFar: 250, anisotropy: 4 },
  high: { label: 'High', dprCap: 2, particleScale: 1.6, contactShadow: true, fogFar: 300, anisotropy: 4 },
};

const MAX_PARTICLE_SCALE = Math.max(
  ...Object.values(GRAPHICS_PRESETS).map((preset) => preset.particleScale),
);

// Live settings may move both down and up. Allocate each tiny pooled backing
// buffer once at the largest authored preset, then vary only its active prefix.
// This avoids rebuilds while ensuring Low/Medium -> High can restore density.
export function particleCapacity(base) {
  return Math.max(3, Math.round(base * MAX_PARTICLE_SCALE));
}

// Automatic policy starts conservatively. Medium preserves the complete
// visual language while avoiding a speculative 2x-DPR/dGPU startup on an
// unknown device. Runtime evidence may step down; it never promotes.
function autoDefault() {
  return detectTier().tier === 'low' ? 'low' : 'medium';
}

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

function readKey(storage, key) {
  try {
    const value = storage?.getItem(key);
    if (value && GRAPHICS_PRESETS[value]) return value;
  } catch { /* Storage may be blocked. */ }
  return null;
}

function writeKey(storage, key, value) {
  try { storage?.setItem(key, value); } catch { /* Storage may be blocked. */ }
}

function capAutoStart(name) {
  const ceiling = PRESET_ORDER.indexOf(AUTO_START_CEILING);
  const index = PRESET_ORDER.indexOf(name);
  return PRESET_ORDER[Math.min(index < 0 ? ceiling : index, ceiling)];
}

function lowerPreset(a, b) {
  const ai = PRESET_ORDER.indexOf(a);
  const bi = PRESET_ORDER.indexOf(b);
  return PRESET_ORDER[Math.min(ai < 0 ? 1 : ai, bi < 0 ? 1 : bi)];
}

export function nextLowerGraphicsPreset(name) {
  const index = PRESET_ORDER.indexOf(name);
  return index > 0 ? PRESET_ORDER[index - 1] : PRESET_ORDER[0];
}

export class GraphicsSystem {
  constructor({
    storage,
    detectedPreset,
    sampleFrames = AUTO_SAMPLE_FRAMES,
    cooldownFrames = AUTO_COOLDOWN_FRAMES,
  } = {}) {
    this.storage = storage === undefined ? defaultStorage() : storage;
    const chosen = readKey(this.storage, KEY);
    const remembered = readKey(this.storage, AUTO_KEY);
    this.provenance = chosen ? 'explicit' : 'auto';
    const detected = capAutoStart(detectedPreset || autoDefault());
    // Hardware can change between visits (desktop save opened on a phone,
    // battery mode, remote session). A remembered auto result is only a
    // ceiling; current weaker-device evidence always wins.
    this.name = chosen || (remembered
      ? lowerPreset(capAutoStart(remembered), detected)
      : detected);

    // Migrate an old automatic High result to the conservative ceiling.
    if (!chosen && remembered && remembered !== this.name) {
      writeKey(this.storage, AUTO_KEY, this.name);
    }

    this.sampleFrames = Math.max(1, sampleFrames);
    this.cooldownFrames = Math.max(0, cooldownFrames);
    this._cooldown = 0;
    this.subs = new Set();
  }

  get autoDetected() { return this.provenance === 'auto'; }
  get isExplicit() { return this.provenance === 'explicit'; }
  get preset() { return GRAPHICS_PRESETS[this.name]; }
  get dprCap() { return this.preset.dprCap; }
  get particleScale() { return this.preset.particleScale; }
  get contactShadow() { return this.preset.contactShadow; }
  get fogFar() { return this.preset.fogFar; }
  get anisotropy() { return this.preset.anisotropy; }

  // Scale a base particle count by the preset (min 3 so effects never vanish).
  particles(base) { return Math.max(3, Math.round(base * this.particleScale)); }

  set(name) {
    if (!GRAPHICS_PRESETS[name]) return;
    const previous = this.name;
    this.name = name;
    this.provenance = 'explicit';
    this._s = null;
    this._cooldown = 0;
    writeKey(this.storage, KEY, name);

    // Clicking the currently selected preset is still an explicit request:
    // if adaptive quality shed DPR, this lets the player restore its full cap.
    this._notify({ source: 'explicit', previous, name });
  }

  // Only FULL-RATE samples belong here (core/app.js excludes intentional eco
  // frames). Sustained slowness may repeatedly step down, with a cooldown.
  // There is deliberately no timed promotion: deadline-paced dt cannot prove
  // CPU/GPU headroom. Only an explicit player choice can move quality up.
  sampleFrame(ms) {
    if (!this.autoDetected || this.name === 'low' || !Number.isFinite(ms)) return;
    if (this._cooldown > 0) {
      this._cooldown -= 1;
      return;
    }

    const sample = this._s || (this._s = { n: 0, totalMs: 0, over22: 0 });
    sample.n += 1;
    sample.totalMs += ms;
    if (ms > 22) sample.over22 += 1;
    if (sample.n < this.sampleFrames) return;

    // Judge achieved cadence over a window. Fractional monitor schedules are
    // healthy but alternate short/long deltas (90Hz: ~11/22ms); classifying
    // each >20ms delta as a miss falsely demoted an exact 60fps render stream.
    const averageMs = sample.totalMs / sample.n;
    const overBudgetRatio = sample.over22 / sample.n;
    this._s = null;
    const struggling = averageMs > 20.5
      || (averageMs > 18.5 && overBudgetRatio >= 0.25);
    if (!struggling) return;

    const next = nextLowerGraphicsPreset(this.name);
    if (next === this.name) return;
    const previous = this.name;
    this.name = next;
    this._cooldown = this.cooldownFrames;
    writeKey(this.storage, AUTO_KEY, next);
    this._notify({ source: 'auto', previous, name: next });
  }

  subscribe(fn) {
    this.subs.add(fn);
    return () => this.subs.delete(fn);
  }

  _notify(change) {
    for (const fn of this.subs) {
      try { fn(this, change); } catch { /* One subscriber must not break settings. */ }
    }
  }
}

export const Graphics = new GraphicsSystem();
