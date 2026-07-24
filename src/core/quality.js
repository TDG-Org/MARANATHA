// Performance mandate (see .claude/skills/performance): the game must run
// well on ANY device. Strategy: start from a device-appropriate pixel ratio
// cap, then adapt DOWN at runtime if sustained frame times say the device
// is struggling. Target 60fps mid-range; graceful floor on low-end.

export function detectTier() {
  const win = globalThis.window;
  const nav = globalThis.navigator || {};
  const display = globalThis.screen || {};
  const dpr = win?.devicePixelRatio || 1;
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4; // GB; undefined on iOS/Firefox
  const mobile = /Android|iPhone|iPad|Mobi/i.test(nav.userAgent || '')
    || (nav.maxTouchPoints > 1
      && Math.min(display.width || 1024, display.height || 768) < 900);

  let tier = 'high';
  if (mobile || cores <= 4 || mem <= 4) tier = 'mid';
  if (mobile && (cores <= 4 || mem <= 2)) tier = 'low';

  // DPR clamp — the single biggest mobile win. A 3x phone renders 9x the
  // pixels of 1x for detail nobody can see in a painterly game.
  const cap = tier === 'high' ? 2 : tier === 'mid' ? 1.75 : 1.5;
  return { tier, dpr, basePixelRatio: Math.min(dpr, cap) };
}

// Watches real frame times and steps the render resolution down when the
// device sustains slow frames. Steps are sticky-down; paced frame deltas
// cannot prove headroom, so only an explicit preset choice may restore DPR.
export class AdaptiveQuality {
  constructor(renderer, { basePixelRatio, onChange } = {}) {
    this.renderer = renderer;
    this.base = basePixelRatio
      ?? Math.min(globalThis.window?.devicePixelRatio || 1, 2);
    this.ratio = this.base;
    this.min = Math.min(1, this.base);
    this.onChange = onChange;
    this._window = null;
    this._sampleFrames = 120;
    renderer.setPixelRatio(this.ratio);
  }

  frame(dtMs) {
    if (!Number.isFinite(dtMs) || dtMs <= 0 || this.ratio <= this.min) return;
    const sample = this._window || (this._window = { n: 0, totalMs: 0, over22: 0 });
    sample.n += 1;
    sample.totalMs += dtMs;
    if (dtMs > 22) sample.over22 += 1;
    if (sample.n < this._sampleFrames) return;

    // Alternating 10/30ms frames are visibly uneven and average only 50fps,
    // but the old +1/-1 vote cancelled them to zero forever. Judge a bounded
    // window by BOTH achieved cadence and its share of missed frame budgets.
    // Fractional-refresh pacing (for example 90Hz's healthy 11/22ms rhythm)
    // remains safe because its average stays close to 16.7ms.
    const averageMs = sample.totalMs / sample.n;
    const overBudgetRatio = sample.over22 / sample.n;
    this._window = null;
    const struggling = averageMs > 20.5
      || (averageMs > 18.5 && overBudgetRatio >= 0.25);
    if (struggling) this.set(Math.max(this.min, this.ratio - 0.25));
  }

  // Automatic preset changes update the ceiling but can never increase the
  // current drawing-buffer ratio. `raise` is reserved for an explicit player
  // selection, which may restore that preset's full base.
  setBase(basePixelRatio, { raise = false } = {}) {
    if (!Number.isFinite(basePixelRatio) || basePixelRatio <= 0) return;
    this.base = basePixelRatio;
    // A browser zoom/display change may raise native DPR after we were
    // legitimately rendering below 1. Sticky-down means even the floor cannot
    // clamp that 0.8 ratio upward; only an explicit preset action may do so.
    this.min = Math.min(1, this.base, raise ? 1 : this.ratio);
    this._window = null;
    this.set(raise ? this.base : Math.min(this.ratio, this.base));
  }

  set(ratio) {
    const next = Math.max(this.min, Math.min(this.base, ratio));
    if (next === this.ratio) return;
    this.ratio = next;
    this.renderer.setPixelRatio(next);
    // Re-apply size so the drawing buffer actually changes.
    const width = globalThis.window?.innerWidth || 1;
    const height = globalThis.window?.innerHeight || 1;
    this.renderer.setSize(width, height);
    this.onChange?.(next);
  }
}

// Tiny on-screen perf readout, enabled with #debug in the URL. This is how
// real frame rate gets reported honestly from real devices.
export class DebugHud {
  constructor(renderer, { enabled = true } = {}) {
    this.el = document.getElementById('debug');
    this.renderer = renderer;
    // Perf HUD is ON by default (performance mandate: honest fps visible at all
    // times); Settings can hide it. #debug in the URL still forces it on.
    this.enabled = enabled || /debug/.test(window.location.hash);
    this._applyVisibility();
    this.acc = 0;
    this.frames = 0;
    this.fps = 0;
    this.ms = 0;
  }

  setEnabled(on) {
    this.enabled = !!on;
    this._applyVisibility();
  }

  _applyVisibility() {
    if (this.el) this.el.style.display = this.enabled ? 'block' : 'none';
  }

  frame(dtMs, updMs = 0, subMs = 0, eco = false) {
    if (!this.enabled || !this.el) return;
    this.acc += dtMs;
    this.frames += 1;
    this.updAcc = (this.updAcc || 0) + updMs;
    this.subAcc = (this.subAcc || 0) + subMs;
    if (eco) this.ecoFrames = (this.ecoFrames || 0) + 1;
    if (this.acc >= 500) {
      this.fps = Math.round((this.frames * 1000) / this.acc);
      this.ms = (this.acc / this.frames).toFixed(1);
      // D9 diagnosis line: script (game update) vs submit (three.js draw
      // calls) — the REST of a slow frame lives in the compositor/GPU.
      const upd = (this.updAcc / this.frames).toFixed(1);
      const sub = (this.subAcc / this.frames).toFixed(1);
      // D12: '· eco' = the power governor is intentionally pacing this idle
      // moment at half rate — a 30 here is savings, not lag.
      const eco2 = (this.ecoFrames || 0) > this.frames / 2 ? ' · eco' : '';
      this.acc = 0;
      this.frames = 0;
      this.updAcc = 0;
      this.subAcc = 0;
      this.ecoFrames = 0;
      const info = this.renderer.info;
      this.el.textContent =
        `fps ${this.fps}  (${this.ms} ms)${eco2}\n` +
        `script ${upd} ms · submit ${sub} ms\n` +
        `draw calls ${info.render.calls}  tris ${info.render.triangles}\n` +
        `pixelRatio ${this.renderer.getPixelRatio().toFixed(2)}`;
    }
  }
}
