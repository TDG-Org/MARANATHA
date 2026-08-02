const DEFAULT_FPS = 60;
const EARLY_TOLERANCE_MS = 0.5;
const LONG_STALL_MS = 250;

// ── THE DISPLAY IS THE CLOCK ────────────────────────────────────────────────
//
// A screen can only ever show a new picture on a refresh boundary. Asking for
// 60fps on a 144Hz gaming monitor therefore does NOT produce 60 evenly spaced
// frames — 16.67ms is 2.4 refreshes, so the panel serves 2, 3, 2, 3… and the
// frames arrive 13.9ms, 20.8ms, 13.9ms, 20.8ms apart. The average is a perfect
// 60 and the counter says so, while the motion visibly stutters. On a 75Hz or
// 90Hz panel the same request alternates 13.3/26.7ms — a 100% swing every
// frame. This is why Nate's camera moves "jump and cut like a glitch" on a
// gaming PC while the fps readout looks fine: the readout is an average, and
// judder is a property of the SPREAD.
//
// The fix is the one consoles have always used: never ask for a rate the
// display cannot deliver evenly. Measure the real refresh period, then pace to
// a whole multiple of it. 60 on a 144Hz panel becomes 72 (every 2nd refresh);
// eco 30 becomes 28.8 (every 5th). Both are perfectly even, and the higher one
// is also more frames than we were managing before.
//
// Only whole multiples are candidates, and only the panel can tell us the
// period, so this stays measured — never guessed, never configured.
const MIN_PERIOD_MS = 3.5;    // ~285Hz — anything shorter is a double callback
const MAX_PERIOD_MS = 34;     // ~29Hz — anything longer is a stall, not a panel
const PERIOD_RING = 120;
const PERIOD_CONFIDENCE = 20; // callbacks before we trust the measurement
const MAX_DIVISOR = 8;

// How far below the requested rate a whole-refresh candidate may sit. A machine
// that prefers power (a phone, or an explicit Low) would rather drop to an even
// 45 than render an uneven 60; a desktop would rather render the extra frames.
const FLOOR_SMOOTH = 0.8;
const FLOOR_POWER = 0.7;
const OVERSHOOT_SLACK = 1.02;

function normalizeFps(value) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_FPS;
  return Math.min(360, Math.max(1, value));
}

// Choose the whole number of refresh periods per rendered frame that lands
// closest to the requested frame time. Ties go to the SMALLER interval: two
// candidates equally far from the request are equally smooth, and the faster
// one is the one the player asked for by complaining about frame rate.
export function snapToRefresh(requestedFps, periodMs, { allowOvershoot = true } = {}) {
  const wanted = 1000 / requestedFps;
  if (!Number.isFinite(periodMs) || periodMs <= 0) return wanted;
  const floor = requestedFps * (allowOvershoot ? FLOOR_SMOOTH : FLOOR_POWER);
  const ceilingRate = requestedFps * OVERSHOOT_SLACK;
  let best = null;      // best candidate at or under the requested rate
  let fallback = null;  // best candidate overall, if nothing fits under it
  for (let d = 1; d <= MAX_DIVISOR; d++) {
    const interval = periodMs * d;
    const rate = 1000 / interval;
    const err = Math.abs(interval - wanted);
    const better = (a, b) => !b || a.err < b.err - 1e-6
      || (Math.abs(a.err - b.err) <= 1e-6 && a.interval < b.interval);
    const candidate = { interval, err };
    // RECORD BEFORE THE FLOOR TEST. If even every-single-refresh is slower than
    // the floor — a 30Hz stream against a floor of 48 — the old order broke out
    // having recorded nothing, and the function returned the UNSNAPPED wanted
    // interval: a request for frames the display cannot serve. Every refresh is
    // the fastest a panel can go, so it must always survive as the fallback.
    if (better(candidate, fallback)) fallback = candidate;
    if (rate < floor) break;
    if (allowOvershoot || rate <= ceilingRate) {
      if (better(candidate, best)) best = candidate;
    }
  }
  return (best || fallback)?.interval ?? wanted;
}

// Deadline-based pacing, snapped to the display's own rhythm. The object is
// reused: advance() allocates nothing in the rAF hot path.
export function createFramePacer(startTime = 0) {
  let lastTick = Number.isFinite(startTime) ? startTime : 0;
  let nextDue = lastTick;
  let activeInterval = 0;
  let snapFps = 0;      // the request the current divisor was chosen for
  let snapPeriod = 0;   // ...and the panel it was chosen against

  // measured refresh
  const periods = new Float64Array(PERIOD_RING);
  const scratch = new Float64Array(PERIOD_RING);
  let periodAt = 0;
  let periodN = 0;
  let lastCallback = NaN;
  let cachedPeriod = 0;
  let cachedAt = -1;

  // ── ESTIMATING THE PERIOD FROM A STREAM THAT IS NOT A METRONOME ───────────
  //
  // This first took the MINIMUM of the window, on the reasoning that a dropped
  // frame can only ever make a gap longer. True — but real vsync timestamps
  // jitter, and the minimum of a jittered sample is biased LOW by about twice
  // the jitter. Measured: at only +-0.5ms of jitter a 144Hz panel was estimated
  // at ~168Hz, the snapped interval stopped being a whole multiple of the real
  // refresh, and the pacing collapsed to 48fps with a 16ms spread — WORSE than
  // the judder this was written to remove. (The first version of the test used
  // a perfect metronome and therefore proved nothing about a real display.)
  //
  // Jitter between consecutive callbacks is zero-mean, so an average is
  // unbiased; dropped frames are the outliers, and they are ~2x, so a median
  // finds them. Take the median, then average everything near it: unbiased
  // against jitter AND robust against drops.
  const PERIOD_RECOMPUTE = 30; // samples between recomputes — not every frame
  const measuredPeriod = () => {
    if (periodN < PERIOD_CONFIDENCE) return 0;
    if (cachedAt >= 0 && periodN - cachedAt < PERIOD_RECOMPUTE) return cachedPeriod;
    cachedAt = periodN;
    const n = Math.min(periodN, PERIOD_RING);
    const view = scratch.subarray(0, n);
    view.set(periods.subarray(0, n));
    view.sort();
    // ...AND THE MEDIAN IS CONTAMINATED BY THE GAME'S OWN FRAME COST.
    //
    // A chained callback is one refresh after the last one — UNLESS the frame
    // before it overran, in which case it is two, or three. So the sample is
    // not "the panel with some jitter", it is the panel MIXED WITH how long the
    // game took. Once more than half the frames overrun a refresh, the median
    // gap IS two refreshes, and the pacer concludes the panel is half its real
    // rate. Measured: a true 144Hz panel with a ~7ms scene was estimated at
    // 72Hz. It then paces to that wrong number, the scene gets momentarily
    // cheaper, the estimate snaps back toward 144, the divisor re-snaps and the
    // deadline re-anchors — and the player gets an endless mix of 7ms and 14ms
    // gaps. On a 60Hz panel it never appears, because a frame that fits in
    // 16.7ms never overruns; on a gaming monitor it is constant.
    //
    // The invariant that fixes it: a gap can never be SHORTER than one refresh.
    // Every sample is therefore one refresh, or a whole multiple of one, plus
    // jitter — so the truth lives in the FASTEST cluster and everything above
    // it is the game's cost, not the display's. Take a low percentile as a
    // jitter-robust floor (the strict minimum is biased low by about twice the
    // jitter, which is why this is not just min()), then average that cluster.
    // ASK FIRST WHETHER THE SAMPLE IS ONE CLUSTER OR TWO, then estimate.
    //
    // Neither estimator alone survives both hazards. A median is unbiased under
    // jitter but sits in the WRONG cluster once most frames overrun a refresh.
    // Anchoring low and taking a window around the anchor is immune to that but
    // truncates the top of the jitter spread and biases low — which is exactly
    // the failure that made min() unusable in the first place, and it reappears
    // the moment the jitter is severe.
    //
    // A low percentile and the median answer the question between them: if the
    // median sits far above the fast anchor, the sample is BIMODAL (one refresh
    // and two), and only the fast cluster describes the panel. Otherwise it is
    // a single jittery cluster and the median window is the unbiased choice.
    const median = view[n >> 1];
    const fastest = view[Math.min(n - 1, Math.max(0, Math.floor(n * 0.05)))];
    // 1.8, not 1.6: a genuinely bimodal sample separates by 2.0, while a
    // unimodal one under SEVERE jitter can reach about 1.6 (the gap between two
    // callbacks carries the wobble of both endpoints, so it spreads twice as
    // wide as the timestamps do). At 1.6 the discriminator fired on heavy
    // jitter, took the fast half of a single cluster, and mis-measured the panel
    // low — caught by the pacer suite's beyond-the-limit case.
    const bimodal = fastest > 0 && median > fastest * 1.8;
    const lo = bimodal ? fastest * 0.8 : median * 0.6;
    const hi = bimodal ? fastest * 1.5 : median * 1.4;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (view[i] > hi) break;                // sorted: nothing later qualifies
      if (view[i] >= lo) { sum += view[i]; count += 1; }
    }
    cachedPeriod = count ? sum / count : median;
    return cachedPeriod;
  };

  const pacer = {
    dt: 0,
    displayHz: 0,
    pacedFps: 0,
    allowOvershoot: true,

    reset(now = 0) {
      const safeNow = Number.isFinite(now) ? now : 0;
      lastTick = safeNow;
      nextDue = safeNow;
      activeInterval = 0;
      // ...and therefore the sticky divisor must be invalidated too, or the
      // next advance() reuses the interval reset just zeroed and lets every
      // single refresh through. (Measured: a resume paced 144 instead of 72.)
      snapFps = 0;
      snapPeriod = 0;
      lastCallback = NaN;
      this.dt = 0;
    },

    // Called once per callback with whether this wake-up was CHAINED straight
    // off requestAnimationFrame. Only a chained callback is one refresh after
    // the last one; a timer wake-up in eco is not, and sampling those would
    // "measure" a 30Hz display.
    observe(now, chained) {
      if (!Number.isFinite(now)) return;
      if (!chained || !Number.isFinite(lastCallback)) { lastCallback = now; return; }
      const delta = now - lastCallback;
      lastCallback = now;
      if (delta < MIN_PERIOD_MS || delta > MAX_PERIOD_MS) return;
      // A rolling window: the MINIMUM is the refresh period, because a dropped
      // frame can only ever make a gap longer, never shorter.
      periods[periodAt] = delta;
      periodAt = (periodAt + 1) % PERIOD_RING;
      periodN += 1;
      const period = measuredPeriod();
      this.displayHz = period > 0 ? Math.round(1000 / period) : 0;
      this.displayPeriodMs = period;
    },

    advance(now, requestedFps) {
      if (!Number.isFinite(now) || now < lastTick) this.reset(now);

      const fps = normalizeFps(requestedFps);
      const period = measuredPeriod();
      // KEEP THE DIVISOR ONCE IT IS CHOSEN.
      //
      // Some rates land on an exact tie: eco 30 on a 165Hz panel is equally far
      // from every 5th refresh (33fps) and every 6th (27.5fps). A measurement
      // that wobbles by a hundredth of a millisecond then flips the choice back
      // and forth, and each flip re-anchors the deadline — measured as a 7-10ms
      // spread in an otherwise even stream. Re-snap only when the request
      // changes or the panel itself does.
      let interval = activeInterval;
      if (!(interval > 0) || fps !== snapFps
        || !(Math.abs(period - snapPeriod) < snapPeriod * 0.03)) {
        snapFps = fps;
        snapPeriod = period;
        interval = snapToRefresh(fps, period, { allowOvershoot: this.allowOvershoot });
      }
      // Only a REAL change re-anchors. Measured periods wobble in their last
      // decimals, and comparing exactly meant a one-ULP difference reset the
      // deadline to "now" and let the very next refresh through — a 16.7ms gap
      // in the middle of an otherwise even 33.3ms stream.
      if (Math.abs(interval - activeInterval) > 0.05) {
        activeInterval = interval;
        this.pacedFps = Math.round((1000 / interval) * 10) / 10;
        nextDue = now;
      }

      // A measured panel admits a frame within HALF A REFRESH of its deadline.
      // The intended frame is the only one that can fall inside that window —
      // its neighbours are a whole refresh away — so the tolerance absorbs
      // measurement error without ever letting the wrong refresh through.
      const admit = period > 0 ? period * 0.5 : EARLY_TOLERANCE_MS;
      if (now + admit < nextDue) return false;

      this.dt = Math.min(Math.max(now - lastTick, 0), 100);
      lastTick = now;

      const lateness = now - nextDue;
      if (period > 0) {
        // COUNT REFRESHES, DO NOT ACCUMULATE A DEADLINE. The target is "every
        // d-th refresh", so the deadline follows the frame that just happened.
        // Accumulating instead (nextDue += interval) lets a period measurement
        // that is a hair short drift earlier and earlier until it eventually
        // admits a frame a whole refresh early — one uneven gap in an even
        // stream, which is the artefact this all exists to remove.
        //
        // The anchor is the RAW frame, deliberately. Blending it toward the
        // running grid was tried and is worse: it damps random wobble but
        // multiplies any systematic error in the period estimate by one over
        // the blend factor, and a systematic error is the one that actually
        // pushes a frame onto the wrong refresh. Keeping the anchor raw means
        // the only error is the display's own wobble, which is bounded.
        nextDue = now + interval;
      } else if (lateness > LONG_STALL_MS) {
        nextDue = now + interval;
      } else {
        const elapsedPeriods = Math.floor(
          (Math.max(0, lateness) + EARLY_TOLERANCE_MS) / interval,
        );
        nextDue += Math.max(1, elapsedPeriods + 1) * interval;
      }
      return true;
    },

    // Milliseconds until the next frame is due. The loop uses this to sleep
    // between eco frames instead of chaining requestAnimationFrame at the
    // panel's refresh rate and throwing most of the callbacks away.
    timeUntilDue(now) {
      if (!Number.isFinite(now)) return 0;
      return Math.max(0, nextDue - now);
    },
  };
  return pacer;
}
