import { detectTier } from '../core/quality.js';

// Graphics Quality: Low / Medium / High is the player's beauty-versus-power
// dial. Presets cap pixel ratio, scale particles, and toggle scene extras.
const KEY = 'maranatha-graphics-v1'; // the player's explicit choice
const AUTO_KEY = 'maranatha-graphics-auto'; // the last automatic demotion
const PRESET_ORDER = ['low', 'medium', 'high'];
const AUTO_START_CEILING = 'medium';
const AUTO_SAMPLE_FRAMES = 600;
const AUTO_COOLDOWN_FRAMES = 300;
// Promotion thresholds, expressed as a FRACTION of the frame budget actually
// being paced to. ~40% average with almost nothing near the budget is a machine
// with real room, not one that is merely keeping up. They were once absolute
// milliseconds, which silently assumed a 60fps cap; a 144Hz machine has a 6.9ms
// budget, and promoting it on a 7ms average would have been promoting a machine
// with no headroom at all.
const FRAME_BUDGET_MS = 1000 / 60;
// The UA never changes mid-session; sampleWork runs every full-rate frame and
// must not evaluate a fresh RegExp + rescan the UA string each time.
const IS_MOBILE_UA = /Android|iPhone|iPad|Mobi/i.test(globalThis.navigator?.userAgent || '');
const PROMOTE_AVG_RATIO = 7 / FRAME_BUDGET_MS;   // 0.42 of the budget
const PROMOTE_SLOW_RATIO_MS = 12 / FRAME_BUDGET_MS; // 0.72 of the budget
const PROMOTE_SLOW_RATIO = 0.02;

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
    this._s = null;        // cadence window (demotion)
    this._w = null;        // measured-work window (promotion)
    this._promoted = false; // at most one automatic step up per session
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
    this._w = null;
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
  sampleFrame(ms, budgetMs = FRAME_BUDGET_MS) {
    if (!this.autoDetected || !Number.isFinite(ms)) return;
    // The cooldown counts down even at Low: this is the ONLY decrementer, and
    // sampleWork() — the designed low→medium promotion — waits behind it.
    // Behind the Low early-return it froze forever after a demotion to Low.
    if (this._cooldown > 0) {
      this._cooldown -= 1;
      return;
    }
    if (this.name === 'low') return;
    const budget = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : FRAME_BUDGET_MS;

    const sample = this._s || (this._s = { n: 0, totalMs: 0, over22: 0 });
    sample.n += 1;
    sample.totalMs += ms;
    if (ms > budget * 1.32) sample.over22 += 1;
    if (sample.n < this.sampleFrames) return;

    // Judge achieved cadence over a window. Fractional monitor schedules are
    // healthy but alternate short/long deltas (90Hz: ~11/22ms); classifying
    // each >20ms delta as a miss falsely demoted an exact 60fps render stream.
    const averageMs = sample.totalMs / sample.n;
    const overBudgetRatio = sample.over22 / sample.n;
    this._s = null;
    const struggling = averageMs > budget * 1.23
      || (averageMs > budget * 1.11 && overBudgetRatio >= 0.25);
    if (!struggling) return;

    const next = nextLowerGraphicsPreset(this.name);
    if (next === this.name) return;
    const previous = this.name;
    this.name = next;
    this._cooldown = this.cooldownFrames;
    writeKey(this.storage, AUTO_KEY, next);
    this._notify({ source: 'auto', previous, name: next });
  }

  // The other half of "auto picks what your machine can handle".
  //
  // sampleFrame() above judges CADENCE, which can only ever demote — a paced
  // 60fps stream reads 16.7ms per frame whether the work took 3ms or 15ms, so
  // dt genuinely cannot prove headroom (that is why D16 removed promotion).
  // Measured WORK can. A machine that renders and submits a whole frame in a
  // third of its budget is not being served by Medium, and before this the only
  // way it ever reached High was the player finding the setting by hand.
  //
  // Deliberately timid: a big margin, a long window, ONE promotion per session,
  // never on a phone, never over an explicit choice — and the cadence demotion
  // above remains the safety net if the new tier turns out to be too much.
  sampleWork(ms, budgetMs = FRAME_BUDGET_MS) {
    if (!this.autoDetected || this._promoted || !Number.isFinite(ms)) return;
    if (this.name === PRESET_ORDER[PRESET_ORDER.length - 1]) return;
    if (this._cooldown > 0) return;
    if (IS_MOBILE_UA) return; // hoisted: never a per-frame RegExp + UA rescan
    const budget = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : FRAME_BUDGET_MS;

    const w = this._w || (this._w = { n: 0, totalMs: 0, slow: 0 });
    w.n += 1;
    w.totalMs += ms;
    if (ms > budget * PROMOTE_SLOW_RATIO_MS) w.slow += 1;
    if (w.n < this.sampleFrames) return;

    const averageMs = w.totalMs / w.n;
    const slowRatio = w.slow / w.n;
    this._w = null;
    if (averageMs > budget * PROMOTE_AVG_RATIO || slowRatio > PROMOTE_SLOW_RATIO) return;

    const index = PRESET_ORDER.indexOf(this.name);
    const next = PRESET_ORDER[index + 1];
    if (!next) return;
    this._promoted = true;
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
