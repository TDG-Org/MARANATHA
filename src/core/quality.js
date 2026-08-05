// Performance mandate (see .claude/skills/performance): the game must run
// well on ANY device. Strategy: start from a device-appropriate pixel ratio
// cap, then adapt DOWN at runtime if sustained frame times say the device
// is struggling. Target 60fps mid-range; graceful floor on low-end.
import { GPU } from './gpuCapability.js';

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
  constructor(renderer, { basePixelRatio, onChange, floor, startAt } = {}) {
    this.renderer = renderer;
    this.base = basePixelRatio
      ?? Math.min(globalThis.window?.devicePixelRatio || 1, 2);
    // The floor is normally 1.0 — never render a desktop below native, because
    // a painterly game at 0.8 looks soft for no reason on hardware that can
    // afford native. But on a DPR-1 display that makes min === base === ratio,
    // and frame() early-returns on `ratio <= min` FOREVER: the one automatic
    // escape hatch is structurally dead on exactly the machines with no pixels
    // to spare. A caller that KNOWS the context is CPU-rasterized may lower it.
    this.hardFloor = Number.isFinite(floor) && floor > 0 ? Math.min(floor, this.base) : 1;
    // A CAPABILITY CEILING, distinct from the base. `raise` exists so an
    // explicit preset choice can hand the player their pixels back — but on a
    // CPU-rasterized context that hands back a 12fps game, and Graphics
    // notifies 'explicit' for the frame-rate and colour-grade buttons too, so
    // merely opening Settings and touching either one undid the whole fix
    // (measured 0.50 -> 1.00). Capability is not a preference: nothing the
    // player picks may exceed it while it holds.
    this.hasCap = Number.isFinite(startAt) && startAt > 0;
    this.cap = this.hasCap
      ? Math.max(this.hardFloor, Math.min(this.base, startAt))
      : this.base;
    this.ratio = this.cap;
    this.min = Math.min(this.hardFloor, this.base);
    this.onChange = onChange;
    this._window = null;
    this._sampleFrames = 120;
    renderer.setPixelRatio(this.ratio);
  }

  // budgetMs is the frame time the loop is actually PACING to. It used to be
  // assumed to be 16.7 because the game was hard-capped at 60; now that the
  // pacer snaps to the display (72 on a 144Hz panel, 55 on a 165Hz one), a
  // fixed threshold would call a healthy 13.9ms cadence "fine" forever on a
  // struggling high-refresh machine and would never fire at all. The ratios
  // below are the old numbers expressed against the budget, so a 60fps target
  // behaves exactly as it did.
  frame(dtMs, budgetMs = 1000 / 60) {
    if (!Number.isFinite(dtMs) || dtMs <= 0 || this.ratio <= this.min) return;
    const budget = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 1000 / 60;
    const overMs = budget * 1.32;
    const sample = this._window || (this._window = { n: 0, totalMs: 0, over22: 0 });
    sample.n += 1;
    sample.totalMs += dtMs;
    if (dtMs > overMs) sample.over22 += 1;
    if (sample.n < this._sampleFrames) return;

    // Alternating 10/30ms frames are visibly uneven and average only 50fps,
    // but the old +1/-1 vote cancelled them to zero forever. Judge a bounded
    // window by BOTH achieved cadence and its share of missed frame budgets.
    // Fractional-refresh pacing (for example 90Hz's healthy 11/22ms rhythm)
    // remains safe because its average stays close to the budget.
    const averageMs = sample.totalMs / sample.n;
    const overBudgetRatio = sample.over22 / sample.n;
    this._window = null;
    const struggling = averageMs > budget * 1.23
      || (averageMs > budget * 1.11 && overBudgetRatio >= 0.25);
    if (struggling) this.set(Math.max(this.min, this.ratio - 0.25));
  }

  // Automatic preset changes update the ceiling but can never increase the
  // current drawing-buffer ratio. `raise` is reserved for an explicit player
  // selection, which may restore that preset's full base.
  setBase(basePixelRatio, { raise = false } = {}) {
    if (!Number.isFinite(basePixelRatio) || basePixelRatio <= 0) return;
    this.base = basePixelRatio;
    // Without a declared capability ceiling the cap simply tracks the base, or
    // a later display/zoom change would be clamped by a stale number.
    if (!this.hasCap) this.cap = this.base;
    // A browser zoom/display change may raise native DPR after we were
    // legitimately rendering below 1. Sticky-down means even the floor cannot
    // clamp that 0.8 ratio upward; only an explicit preset action may do so.
    this.min = Math.min(this.hardFloor, this.base, raise ? this.hardFloor : this.ratio);
    this._window = null;
    this.set(raise ? this.base : Math.min(this.ratio, this.base));
  }

  set(ratio) {
    const next = Math.max(this.min, Math.min(this.base, this.cap, ratio));
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

// ── HOW FAST THE DISPLAY MAY BE ASKED TO GO ─────────────────────────────────
//
// Letting a capable desktop render at its panel's rate is what turns a "gaming
// PC stuck at 60" into a gaming PC. But a machine that CANNOT hold 144 goes
// straight back to uneven frames — the exact problem the snapping fixed — so
// the ceiling has to be able to come down.
//
// It judges achieved cadence against the pace actually requested, and it is
// STICKY-DOWN for the same reason DPR is: a paced stream can prove a machine is
// struggling, never that it has room. Coming down one whole step (144 -> 72)
// keeps landing on real refresh boundaries, so a demotion is still even.
// THE CEILING HAS TO BE ABLE TO GO LOW ENOUGH TO BE EVEN.
//
// The floor used to be 60, and core/app.js additionally clamped its request to
// `Math.max(60, ...)`. On a 144Hz panel the slowest EVEN cadence at or above a
// 60fps request is every 2nd refresh — 72fps. So a machine that could sustain,
// say, 65fps could never be given a target it could actually hold: it sat above
// 72 forever, missing roughly every third deadline, and the player got a
// permanent mix of 14ms and 21ms gaps. 48 is the next even step down on a 144Hz
// panel (every 3rd refresh) and is still a perfectly watchable rate; on a 60Hz
// panel nothing changes, because 48 still snaps to 60.
export const RATE_FLOOR = 48;

export class RateGovernor {
  constructor({ ceiling = 144, floor = RATE_FLOOR, sampleFrames = 90, cooldownFrames = 60 } = {}) {
    this.max = ceiling;
    this.ceiling = ceiling;
    this.floor = floor;
    this.sampleFrames = Math.max(1, sampleFrames);
    this.cooldownFrames = Math.max(0, cooldownFrames);
    this._cooldown = 0;
    this._w = null;
  }

  reset() {
    this.ceiling = this.max;
    this._w = null;
    this._cooldown = 0;
  }

  frame(dtMs, budgetMs) {
    if (this.ceiling <= this.floor) return;
    if (!Number.isFinite(dtMs) || dtMs <= 0) return;
    // A DEMOTION CHANGES THE TARGET, SO THE OLD EVIDENCE IS SPENT. Every frame
    // sampled before the step down was measured against a budget that no longer
    // applies; judging the next window before the new cadence has actually been
    // delivered demotes twice for one problem and lands well below what the
    // machine could hold. Wait, re-measure, then decide again.
    if (this._cooldown > 0) { this._cooldown -= 1; return; }
    const budget = Number.isFinite(budgetMs) && budgetMs > 0 ? budgetMs : 1000 / 60;
    const w = this._w || (this._w = { n: 0, totalMs: 0, missed: 0 });
    w.n += 1;
    w.totalMs += dtMs;
    if (dtMs > budget * 1.35) w.missed += 1;

    // TWO SPEEDS, BECAUSE THE PLAYER FEELS THE WAIT.
    //
    // One long window was demanding on purpose — a single hitch must not halve
    // the frame rate forever. But it also meant a machine that plainly could
    // not hold the panel's rate spent SECONDS juddering before being given a
    // cadence it could keep (measured: 5.5s every time, and again after every
    // settings change, because an explicit change resets the ceiling). When the
    // evidence is overwhelming rather than marginal, there is nothing to wait
    // for: three quarters of the frames missing their deadline is not a hitch.
    const overwhelming = w.n >= 24 && w.missed / w.n >= 0.75;
    if (!overwhelming && w.n < this.sampleFrames) return;

    const averageMs = w.totalMs / w.n;
    const missedRatio = w.missed / w.n;
    this._w = null;
    // JUDGE THE MISSES, NOT THE AVERAGE. The old rule also required the mean
    // frame time to be 25% over budget, which a stream that HOLDS the cadence
    // four times out of five never reaches — so a machine delivering 12ms,
    // 12ms, 12ms, 21ms forever was judged to be coping. It is not coping: one
    // frame in five arriving half a beat late is precisely what "choppy" means,
    // and an even slower cadence would look better than an uneven faster one.
    if (overwhelming || missedRatio >= 0.25 || (averageMs > budget * 1.25 && missedRatio >= 0.15)) {
      this.ceiling = Math.max(this.floor, Math.round(this.ceiling / 2));
      this._cooldown = this.cooldownFrames;
    }
  }
}

// Tiny on-screen perf readout, enabled with #debug in the URL. This is how
// real frame rate gets reported honestly from real devices.
export class DebugHud {
  constructor(renderer, { enabled = false } = {}) {
    this.el = document.getElementById('debug');
    this.renderer = renderer;
    // OFF unless asked for. This defaulted to ON so that "honest fps is visible
    // at all times" — a good instinct aimed at the wrong audience: it put a
    // black box of frame times and a GPU driver string over the corner of a
    // painterly Bible story for every player who had never opened Settings.
    // Both routes to it survive: `#debug` in the URL forces it on regardless,
    // and Settings.bindHud() applies the player's saved choice a moment later.
    // `#debug` in the URL is a FORCE, not a default. It has to outrank the
    // saved setting, because the moment the HUD stopped defaulting to on,
    // Settings.bindHud() ran a beat later with the stored `false` and switched
    // it straight back off — so `#debug` silently stopped working and the only
    // honest way to read frame rate on a real device went with it. Measured
    // before this line: default hidden (right), Settings-on visible (right),
    // `#debug` HIDDEN (wrong).
    this.forced = /debug/.test(window.location.hash);
    this.enabled = enabled || this.forced;
    this._applyVisibility();
    this.acc = 0;
    this.frames = 0;
    this.fps = 0;
    this.ms = 0;
  }

  setEnabled(on) {
    // A saved preference may turn it ON, never off against an explicit `#debug`.
    this.enabled = this.forced || !!on;
    this._applyVisibility();
  }

  _applyVisibility() {
    if (this.el) this.el.style.display = this.enabled ? 'block' : 'none';
  }

  // WHICH CHIP ACTUALLY GOT THE CONTEXT.
  //
  // The game once asked the browser for a 'low-power' GPU on every machine that
  // had not explicitly chosen High — so a gaming PC quietly ran the entire game
  // on its integrated graphics and there was no way to tell from the outside.
  // A slow frame and a slow *chip* look identical in an fps counter; this line
  // is what tells them apart, so it stays on the HUD.
  _gpu() {
    if (this._gpuName !== undefined) return this._gpuName;
    this._gpuName = '(unknown)';
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const raw = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      // Driver strings are long and bracket-heavy: keep the useful middle.
      if (raw) this._gpuName = String(raw).replace(/^ANGLE \(|\)$/g, '').slice(0, 58);
    } catch { /* the extension is optional; the HUD survives without it */ }
    // ...and a name is not enough, because the failure mode that cost the most
    // time to find reads as an ordinary slow frame: hardware acceleration
    // switched OFF in the browser, every pixel rasterized on the CPU, `script`
    // and `submit` both reporting ~5ms beside an 83ms frame because the real
    // work happens after submit returns. Say it in words, on the HUD.
    if (GPU.software) this._gpuName = `⚠ SOFTWARE (no GPU) — ${this._gpuName}`;
    return this._gpuName;
  }

  frame(dtMs, updMs = 0, subMs = 0, eco = false, pacing = null) {
    if (!this.enabled || !this.el) return;
    if (pacing) this._pacing = pacing;
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
      // WHAT THE PANEL CAN ACTUALLY SERVE.
      //
      // "60fps" on a 144Hz monitor is not 60 even frames, it is 2/3/2/3
      // refreshes — right average, visible judder. The game now paces to a
      // whole multiple of the measured refresh, so this line names both: the
      // display's own rate and the cadence being rendered against it. A 72
      // beside a 144 is one frame every second refresh, which is as smooth as
      // that panel can be at that rate.
      const pace = this._pacing?.displayHz
        ? `  ·  display ${this._pacing.displayHz}Hz → paced ${this._pacing.pacedFps}`
        : '';
      this.el.textContent =
        `fps ${this.fps}  (${this.ms} ms)${eco2}${pace}\n` +
        `script ${upd} ms · submit ${sub} ms\n` +
        `draw calls ${info.render.calls}  tris ${info.render.triangles}\n` +
        `pixelRatio ${this.renderer.getPixelRatio().toFixed(2)}\n` +
        `gpu ${this._gpu()}`;
    }
  }
}
