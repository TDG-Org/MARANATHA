// Performance mandate (see .claude/skills/performance): the game must run
// well on ANY device. Strategy: start from a device-appropriate pixel ratio
// cap, then adapt DOWN at runtime if sustained frame times say the device
// is struggling. Target 60fps mid-range; graceful floor on low-end.

export function detectTier() {
  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4; // GB; undefined on iOS/Firefox
  const mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);

  let tier = 'high';
  if (mobile || cores <= 4 || mem <= 4) tier = 'mid';
  if (mobile && (cores <= 4 || mem <= 2)) tier = 'low';

  // DPR clamp — the single biggest mobile win. A 3x phone renders 9x the
  // pixels of 1x for detail nobody can see in a painterly game.
  const cap = tier === 'high' ? 2 : tier === 'mid' ? 1.75 : 1.5;
  return { tier, dpr, basePixelRatio: Math.min(dpr, cap) };
}

// Watches real frame times and steps the render resolution down when the
// device sustains >22ms frames (≈45fps). Steps are sticky-down (no yo-yo):
// one optional step back up only after a long, comfortably fast stretch.
export class AdaptiveQuality {
  constructor(renderer, { basePixelRatio, onChange } = {}) {
    this.renderer = renderer;
    this.base = basePixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
    this.ratio = this.base;
    this.min = 1;
    this.onChange = onChange;
    this.slow = 0;
    this.fast = 0;
    this.recovered = false;
    renderer.setPixelRatio(this.ratio);
  }

  frame(dtMs) {
    if (dtMs > 22) {
      this.slow += 1;
      this.fast = 0;
    } else if (dtMs < 13) {
      this.fast += 1;
      this.slow = 0;
    } else {
      this.slow = Math.max(0, this.slow - 1);
    }
    // ~1.5s of sustained slowness -> shed resolution.
    if (this.slow > 90 && this.ratio > this.min) {
      this.slow = 0;
      this.set(Math.max(this.min, this.ratio - 0.25));
    }
    // One recovery step after ~20s of headroom (covers a slow first load).
    if (!this.recovered && this.fast > 1200 && this.ratio < this.base) {
      this.recovered = true;
      this.set(Math.min(this.base, this.ratio + 0.25));
    }
  }

  set(ratio) {
    this.ratio = ratio;
    this.renderer.setPixelRatio(ratio);
    // Re-apply size so the drawing buffer actually changes.
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.onChange?.(ratio);
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

  frame(dtMs, updMs = 0, subMs = 0) {
    if (!this.enabled || !this.el) return;
    this.acc += dtMs;
    this.frames += 1;
    this.updAcc = (this.updAcc || 0) + updMs;
    this.subAcc = (this.subAcc || 0) + subMs;
    if (this.acc >= 500) {
      this.fps = Math.round((this.frames * 1000) / this.acc);
      this.ms = (this.acc / this.frames).toFixed(1);
      // D9 diagnosis line: script (game update) vs submit (three.js draw
      // calls) — the REST of a slow frame lives in the compositor/GPU.
      const upd = (this.updAcc / this.frames).toFixed(1);
      const sub = (this.subAcc / this.frames).toFixed(1);
      this.acc = 0;
      this.frames = 0;
      this.updAcc = 0;
      this.subAcc = 0;
      const info = this.renderer.info;
      this.el.textContent =
        `fps ${this.fps}  (${this.ms} ms)\n` +
        `script ${upd} ms · submit ${sub} ms\n` +
        `draw calls ${info.render.calls}  tris ${info.render.triangles}\n` +
        `pixelRatio ${this.renderer.getPixelRatio().toFixed(2)}`;
    }
  }
}
