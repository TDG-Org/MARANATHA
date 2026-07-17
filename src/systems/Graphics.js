import { detectTier } from '../core/quality.js';

// Graphics Quality (D4): Low / Medium / High — a beauty-vs-perf dial the player
// controls (persisted; the default auto-detects from the device tier). Each
// preset caps the pixel ratio, scales particle density, and toggles extras
// (soft contact-shadow blobs + richer fog on High). DPR changes apply live;
// particle/shadow density applies on the next scene entry (they're built once).
const KEY = 'maranatha-graphics-v1';

export const GRAPHICS_PRESETS = {
  low: { label: 'Low', dprCap: 1, particleScale: 0.4, contactShadow: false, fogFar: 200 },
  medium: { label: 'Medium', dprCap: 1.5, particleScale: 1.0, contactShadow: false, fogFar: 250 },
  high: { label: 'High', dprCap: 2, particleScale: 1.6, contactShadow: true, fogFar: 300 },
};

function autoDefault() {
  const { tier } = detectTier();
  return tier === 'high' ? 'high' : tier === 'mid' ? 'medium' : 'low';
}

function read() {
  try {
    const v = localStorage.getItem(KEY);
    if (v && GRAPHICS_PRESETS[v]) return v;
  } catch { /* ignore */ }
  return null;
}

class GraphicsSystem {
  constructor() {
    this.name = read() || autoDefault();
    this.autoDetected = !read();
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
    this.autoDetected = false;
    try { localStorage.setItem(KEY, name); } catch { /* ignore */ }
    this._notify();
  }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  _notify() { for (const fn of this.subs) { try { fn(this); } catch { /* ignore */ } } }
}

export const Graphics = new GraphicsSystem();
