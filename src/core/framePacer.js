const DEFAULT_FPS = 60;
const EARLY_TOLERANCE_MS = 0.5;
const LONG_STALL_MS = 250;

function normalizeFps(value) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_FPS;
  return Math.min(240, Math.max(1, value));
}

// Deadline-based pacing keeps the requested average rate on displays whose
// refresh is not an integer multiple of it (144/165Hz in particular). The
// object is reused: advance() allocates nothing in the rAF hot path.
export function createFramePacer(startTime = 0) {
  let lastTick = Number.isFinite(startTime) ? startTime : 0;
  let nextDue = lastTick;
  let activeFps = 0;

  return {
    dt: 0,

    reset(now = 0) {
      const safeNow = Number.isFinite(now) ? now : 0;
      lastTick = safeNow;
      nextDue = safeNow;
      activeFps = 0;
      this.dt = 0;
    },

    advance(now, requestedFps) {
      if (!Number.isFinite(now) || now < lastTick) this.reset(now);

      const fps = normalizeFps(requestedFps);
      const interval = 1000 / fps;
      if (fps !== activeFps) {
        activeFps = fps;
        nextDue = now;
      }

      if (now + EARLY_TOLERANCE_MS < nextDue) return false;

      this.dt = Math.min(Math.max(now - lastTick, 0), 100);
      lastTick = now;

      const lateness = now - nextDue;
      if (lateness > LONG_STALL_MS) {
        nextDue = now + interval;
      } else {
        const elapsedPeriods = Math.floor(
          (Math.max(0, lateness) + EARLY_TOLERANCE_MS) / interval,
        );
        nextDue += Math.max(1, elapsedPeriods + 1) * interval;
      }
      return true;
    },
  };
}
