import { detectTier } from '../core/quality.js';

// Graphics Quality (D4): Low / Medium / High — a beauty-vs-perf dial the player
// controls (persisted; the default auto-detects from the device tier). Each
// preset caps the pixel ratio, scales particle density, and toggles extras
// (soft contact-shadow blobs + richer fog on High). DPR changes apply live;
// particle/shadow density applies on the next scene entry (they're built once).
const KEY = 'maranatha-graphics-v1';      // the player's explicit choice
const AUTO_KEY = 'maranatha-graphics-auto'; // what auto-detect/auto-tune settled on

export const GRAPHICS_PRESETS = {
  low: { label: 'Low', dprCap: 1, particleScale: 0.4, contactShadow: false, fogFar: 200 },
  medium: { label: 'Medium', dprCap: 1.5, particleScale: 1.0, contactShadow: false, fogFar: 250 },
  high: { label: 'High', dprCap: 2, particleScale: 1.6, contactShadow: true, fogFar: 300 },
};

// AUTO-DETECT (D14, Nate: "the graphics should auto change to the best settings
// the user's PC can handle"). Two stages:
//   1. this first guess, from what the browser will tell us up front, and
//   2. `autoTune()` below, which corrects the guess from MEASURED frame times
//      once the game is actually running (a guess can be wrong either way).
// A player who picks a preset by hand owns it forever — auto never overrides.
function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
  } catch { return ''; }
}

function autoDefault() {
  const { tier } = detectTier();
  if (tier === 'low') return 'low';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4; // GB (undefined on iOS/Firefox)
  const mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
  const gpu = gpuName();
  // discrete/desktop-class GPUs and Apple Silicon handle High comfortably
  const strongGPU = /rtx|radeon rx|geforce (gtx|rtx)|arc a\d|apple m[1-9]|quadro|radeon pro/i.test(gpu);
  // the weakest integrated parts should stay at Medium whatever the core count
  const weakGPU = /uhd graphics [456]\d\d|hd graphics [345]\d\d\d|mali-[gt]?[0-5]\d|adreno [1-5]\d\d|powervr/i.test(gpu);
  if (!mobile && !weakGPU && (strongGPU || (cores >= 8 && mem >= 8))) return 'high';
  return 'medium';
}

// KEY holds the player's OWN choice (sacred). AUTO_KEY remembers what the
// auto-tuner settled on, so a machine doesn't have to re-learn every session —
// while staying "auto", free to re-tune if the device or driver changes.
function readKey(k) {
  try {
    const v = localStorage.getItem(k);
    if (v && GRAPHICS_PRESETS[v]) return v;
  } catch { /* ignore */ }
  return null;
}

class GraphicsSystem {
  constructor() {
    const chosen = readKey(KEY);
    this.autoDetected = !chosen;
    this.name = chosen || readKey(AUTO_KEY) || autoDefault();
    this.subs = new Set();
  }

  get preset() { return GRAPHICS_PRESETS[this.name]; }
  get dprCap() { return this.preset.dprCap; }
  get particleScale() { return this.preset.particleScale; }
  get contactShadow() { return this.preset.contactShadow; }
  get fogFar() { return this.preset.fogFar; }

  // Scale a base particle count by the preset (min 3 so effects never vanish).
  particles(base) { return Math.max(3, Math.round(base * this.particleScale)); }

  set(name) {
    if (!GRAPHICS_PRESETS[name] || name === this.name) return;
    this.name = name;
    this.autoDetected = false; // a hand-picked preset is the player's, forever
    try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
    this._notify();
  }

  // AUTO-TUNE (D14): correct the opening guess from REAL frames. Only ever runs
  // while the preset is still auto-detected — one step per session, in either
  // direction, and only on a long, clean sample so a loading hitch or a heavy
  // cutscene can't move it. `ms` samples must be FULL-RATE frames only (the
  // power governor's eco frames are 33ms by design — see core/app.js).
  sampleFrame(ms) {
    if (!this.autoDetected || this._tuned) return;
    const s = this._s || (this._s = { n: 0, slow: 0, fast: 0 });
    s.n += 1;
    if (ms > 20) s.slow += 1;        // ≈ under 50fps
    else if (ms < 12.5) s.fast += 1; // ≈ comfortably over 80fps of headroom
    if (s.n < 600) return;           // ~10s of full-rate frames before judging
    const slowPct = s.slow / s.n, fastPct = s.fast / s.n;
    const order = ['low', 'medium', 'high'];
    const i = order.indexOf(this.name);
    let next = this.name;
    if (slowPct > 0.25 && i > 0) next = order[i - 1];            // struggling → step down
    else if (fastPct > 0.85 && i < order.length - 1) next = order[i + 1]; // loads of room → step up
    this._s = null;
    if (next === this.name) return;
    this._tuned = true; // one correction per session; no yo-yo
    this.name = next;
    try { localStorage.setItem(AUTO_KEY, next); } catch { /* ignore */ }
    this._notify(); // autoDetected stays true — this is still the game choosing
  }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  _notify() { for (const fn of this.subs) { try { fn(this); } catch { /* ignore */ } } }
}

export const Graphics = new GraphicsSystem();
