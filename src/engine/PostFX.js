import { Graphics } from '../systems/Graphics.js';

// PostFX (D6): the game's grade + named filters, built on one static CSS canvas
// grade and simple alpha overlays. Full-frame filters are not "free" on every
// browser/GPU, so dream mood comes from the authored light/material palette
// instead of stacking another hue/color filter over the live canvas.
// ONE instance owns the canvas; scenes ask for looks by NAME:
//
//   postFX.setFilter('none' | 'future' | 'dream')  — eased cross-fade
//   postFX.blurPulse(ms)      — compatibility hook; veil owns the dissolve
//   postFX.eyeOpen(ms)        — opacity-wash reveal (waking INTO the dream)
//   postFX.applyPreset()      — re-derive the base grade from Graphics
//
// The BASE GRADE scales with the Graphics preset (part of making presets
// visually obvious): High = rich vibrance · Medium = standard · Low = none
// (also the cheapest path — no filter on the canvas at all).
// D8 grade push (Nate: "the whole game must FEEL 10x") — richer saturation
// and a warmer, deeper read on both tiers; Low stays untouched for perf.
const BASE = {
  low: '',
  medium: 'saturate(1.38) contrast(1.1) brightness(1.02)',
  high: 'saturate(1.55) contrast(1.14) brightness(1.03)',
};

// Named filter looks, composed ON TOP of the base grade.
const FILTERS = {
  none: '',
  // One very soft, readable gloom across the whole cold open. No animated
  // canvas blur: it was the transition's largest compositor cost and made the
  // action look darker than its authored lighting.
  future: 'saturate(0.78) contrast(1.015) brightness(1.055)',
  // Dream lighting/materials already own the cool palette. Keeping this empty
  // avoids a second full-frame filter/compositor path only in the busiest set.
  dream: '',
};

export class PostFX {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.filter = 'none';
    this._filterT = 0; // disarms the eased filter switch once it lands
    this._lastCanvasFilter = null;

    // D9 (Nate): the old FUTURE vignette drew dark borders on all four sides
    // that overlapped the letterbox in the corners — REMOVED. The drained
    // color grade + the letterbox carry the flash-forward look alone; only a
    // whisper of corner falloff remains (no edge bands, no overlap).
    this.vignette = document.createElement('div');
    this.vignette.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:25', 'pointer-events:none', 'opacity:0',
      'transition:opacity 1200ms ease',
      'background:radial-gradient(ellipse at center, rgba(0,0,0,0) 66%, rgba(8,8,14,0.16) 100%)',
    ].join(';');
    document.body.append(this.vignette);

    // the DREAM soft-glow wash (a whisper of cool light over the frame)
    this.dreamGlow = document.createElement('div');
    this.dreamGlow.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:25', 'pointer-events:none', 'opacity:0',
      'transition:opacity 1600ms ease',
      'background:radial-gradient(ellipse at 50% 38%, rgba(140,150,220,0.12) 0%, rgba(80,90,160,0.045) 55%, rgba(0,0,0,0) 78%)',
    ].join(';');
    document.body.append(this.dreamGlow);

    // Opacity-only focus wash. It preserves the sleepy eye-open cue without
    // re-filtering the live WebGL canvas on every transition frame.
    this.focusWash = document.createElement('div');
    this.focusWash.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:26', 'pointer-events:none',
      'opacity:0', 'background:rgba(35,43,79,0.34)',
      'transition:opacity 0ms linear',
    ].join(';');
    document.body.append(this.focusWash);

    this.applyPreset();
    this._unsub = Graphics.subscribe(() => this.applyPreset());
  }

  get _base() { return Graphics.colourGrade ? (BASE[Graphics.name] ?? BASE.medium) : ''; }

  _compose(extra = '') {
    const f = `${this._base} ${FILTERS[this.filter] ?? ''} ${extra}`.trim();
    const next = f || 'none';
    if (next === this._lastCanvasFilter) return false;
    this._lastCanvasFilter = next;
    this.canvas.style.filter = next;
    return true;
  }

  applyPreset() { this._compose(); }

  // Eased switch to a named filter. The vignette/glow overlays follow the name.
  setFilter(name, ms = 1200) {
    this.filter = FILTERS[name] !== undefined ? name : 'none';
    this.vignette.style.opacity = name === 'future' ? '1' : '0';
    this.dreamGlow.style.opacity = name === 'dream' ? '1' : '0';
    // Only create a filter transition when the actual canvas grade changes.
    // Entering dream now keeps the same base grade and touches no live-canvas
    // compositor property.
    const prior = this._lastCanvasFilter;
    const next = `${this._base} ${FILTERS[this.filter] ?? ''}`.trim() || 'none';
    const changed = next !== prior;
    this.canvas.style.transition = changed && prior !== null
      ? `filter ${ms}ms ease`
      : 'none';
    this._compose();
    // Disarm once the eased switch lands: a permanently armed filter
    // transition would make any LATER grade write (a Graphics preset change
    // mid-scene) animate a full-viewport re-filter for its whole duration.
    clearTimeout(this._filterT);
    if (changed && prior !== null) {
      this._filterT = setTimeout(() => {
        this._filterT = 0;
        this.canvas.style.transition = 'none';
      }, ms + 50);
    }
  }

  // Compatibility hook for cinema fades; the opaque veil owns the dissolve.
  blurPulse() {
    // The cinema veil already supplies the dissolve. A canvas blur under black
    // is invisible work and can stall budget GPUs while a stage appears.
    this.focusWash.style.transition = 'none';
    this.focusWash.style.opacity = '0';
  }

  // Waking into a place: a cheap cool wash eases clear like eyes opening.
  eyeOpen(ms = 2600) {
    this.focusWash.style.transition = 'none';
    this.focusWash.style.opacity = '0.34';
    void this.focusWash.offsetWidth;
    this.focusWash.style.transition = `opacity ${ms}ms cubic-bezier(0.25, 0.6, 0.35, 1)`;
    this.focusWash.style.opacity = '0';
  }

  // Scene exit: back to the plain base grade, overlays off.
  reset() {
    clearTimeout(this._filterT);
    this._filterT = 0;
    this.filter = 'none';
    this.vignette.style.opacity = '0';
    this.dreamGlow.style.opacity = '0';
    this.focusWash.style.opacity = '0';
    this.canvas.style.transition = 'none';
    this._compose();
  }

  dispose() {
    clearTimeout(this._filterT);
    this._unsub?.();
    this.vignette.remove();
    this.dreamGlow.remove();
    this.focusWash.remove();
    this.canvas.style.filter = 'none';
    this._lastCanvasFilter = null;
  }
}
