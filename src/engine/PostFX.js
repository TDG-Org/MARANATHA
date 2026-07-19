import { Graphics } from '../systems/Graphics.js';

// PostFX (D6): the game's grade + named filters, built on CSS canvas filters
// and a vignette overlay — GPU-composited, effectively free on phones (a real
// EffectComposer would cost a fullscreen framebuffer pass; wrong trade here).
// ONE instance owns the canvas; scenes ask for looks by NAME:
//
//   postFX.setFilter('none' | 'future' | 'dream')  — eased cross-fade
//   postFX.blurPulse(ms)      — a soft blur swell for beat transitions
//   postFX.eyeOpen(ms)        — long blur→clear reveal (waking INTO the dream)
//   postFX.applyPreset()      — re-derive the base grade from Graphics
//
// The BASE GRADE scales with the Graphics preset (part of making presets
// visually obvious): High = rich vibrance · Medium = standard · Low = none
// (also the cheapest path — no filter on the canvas at all).
// D8 grade push (Nate: "the whole game must FEEL 10x") — richer saturation
// and a warmer, deeper read on both tiers; Low stays untouched for perf.
const BASE = {
  low: '',
  medium: 'saturate(1.3) contrast(1.06) brightness(1.04)',
  high: 'saturate(1.46) contrast(1.1) brightness(1.06)',
};

// Named filter looks, composed ON TOP of the base grade.
const FILTERS = {
  none: '',
  // the cold-open flash-forward: gloomy and drained, but CLEAR — the vignette
  // + desaturation carry the "future" read; blur may never hide the action (D8).
  future: 'saturate(0.4) contrast(1.08) brightness(0.87) blur(1px)',
  // the dream: cool, soft, faintly glowing (brightness lifts the additive glows)
  dream: 'saturate(1.12) contrast(0.98) brightness(1.08) hue-rotate(-8deg)',
};

export class PostFX {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.filter = 'none';
    this._blurT = null;

    // D9 (Nate): the old FUTURE vignette drew dark borders on all four sides
    // that overlapped the letterbox in the corners — REMOVED. The drained
    // color grade + the letterbox carry the flash-forward look alone; only a
    // whisper of corner falloff remains (no edge bands, no overlap).
    this.vignette = document.createElement('div');
    this.vignette.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:25', 'pointer-events:none', 'opacity:0',
      'transition:opacity 1200ms ease',
      'background:radial-gradient(ellipse at center, rgba(0,0,0,0) 62%, rgba(8,8,14,0.28) 100%)',
    ].join(';');
    document.body.append(this.vignette);

    // the DREAM soft-glow wash (a whisper of cool light over the frame)
    this.dreamGlow = document.createElement('div');
    this.dreamGlow.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:25', 'pointer-events:none', 'opacity:0',
      'transition:opacity 1600ms ease', 'mix-blend-mode:screen',
      'background:radial-gradient(ellipse at 50% 38%, rgba(140,150,220,0.18) 0%, rgba(80,90,160,0.06) 55%, rgba(0,0,0,0) 78%)',
    ].join(';');
    document.body.append(this.dreamGlow);

    this.applyPreset();
    this._unsub = Graphics.subscribe(() => this.applyPreset());
  }

  get _base() { return BASE[Graphics.name] ?? BASE.medium; }

  _compose(extra = '') {
    const f = `${this._base} ${FILTERS[this.filter] ?? ''} ${extra}`.trim();
    this.canvas.style.filter = f || 'none';
  }

  applyPreset() { this._compose(); }

  // Eased switch to a named filter. The vignette/glow overlays follow the name.
  setFilter(name, ms = 1200) {
    this.filter = FILTERS[name] !== undefined ? name : 'none';
    this.canvas.style.transition = `filter ${ms}ms ease`;
    this.vignette.style.opacity = name === 'future' ? '1' : '0';
    this.dreamGlow.style.opacity = name === 'dream' ? '1' : '0';
    this._compose();
  }

  // A soft blur swell (up then down) — the smooth cross-transition between
  // beats; ride it under a dip-to-black for a cinematic dissolve.
  blurPulse(ms = 900) {
    clearTimeout(this._blurT);
    this.canvas.style.transition = `filter ${ms * 0.45}ms ease-in`;
    this._compose('blur(1.6px)');
    this._blurT = setTimeout(() => {
      this.canvas.style.transition = `filter ${ms * 0.55}ms ease-out`;
      this._compose();
    }, ms * 0.45);
  }

  // Waking INTO a place: start heavily blurred + dim, ease to clear — like
  // eyes opening. (Dream v3 entry.)
  eyeOpen(ms = 2600) {
    clearTimeout(this._blurT);
    this.canvas.style.transition = 'none';
    this._compose('blur(14px) brightness(0.7)');
    // force the style to commit before easing out
    void this.canvas.offsetWidth;
    this.canvas.style.transition = `filter ${ms}ms cubic-bezier(0.25, 0.6, 0.35, 1)`;
    this._compose();
  }

  // Scene exit: back to the plain base grade, overlays off.
  reset() {
    clearTimeout(this._blurT);
    this.filter = 'none';
    this.vignette.style.opacity = '0';
    this.dreamGlow.style.opacity = '0';
    this.canvas.style.transition = 'none';
    this._compose();
  }

  dispose() {
    this._unsub?.();
    this.vignette.remove();
    this.dreamGlow.remove();
    this.canvas.style.filter = 'none';
  }
}
