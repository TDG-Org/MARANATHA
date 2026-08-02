// A SIMULATION OF THE REAL FRAME LOOP, on a real vsync grid.
//
// Nate: "still way too choppy and laggy... find the deep root". The renderer
// measures ~2.5ms, so the frames are not being lost in the scene. This drives
// the ACTUAL pacer and the ACTUAL rate governor against a simulated display and
// a simulated per-frame cost, and reports the SPREAD of the delivered frames —
// judder is a property of the spread, not the average.
//
// Run: node tools/probe-loop-judder.mjs
import { createFramePacer } from '../src/core/framePacer.js';
import { RateGovernor, RATE_FLOOR } from '../src/core/quality.js';

const CHAIN_ABOVE_FPS = 45;
const ARM_EARLY_MS = 12;

// One run: a panel, a per-frame cost, and the loop as core/renderer.js runs it.
// Deterministic pseudo-random, so a run is repeatable.
function rng(seed) { let a = seed >>> 0; return () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296); }

function simulate({ hz, workMs, jitterMs = 0, vsyncJitterMs = 0, seconds = 8, ceiling = 144, allowOvershoot = true, graceMs = 3000 }) {
  const rnd = rng(97);
  const period = 1000 / hz;
  const pacer = createFramePacer(0);
  const rate = new RateGovernor({ ceiling, floor: RATE_FLOOR });
  pacer.allowOvershoot = allowOvershoot;

  let now = 0;
  let busyUntil = 0;          // the CPU is occupied until here
  let wokeChained = true;
  const delivered = [];
  const paced = [];
  let last = null;

  // The next vsync at or after t.
  const nextVsync = (t) => Math.ceil((t + 1e-9) / period) * period + (vsyncJitterMs ? (rnd() - 0.5) * vsyncJitterMs : 0);

  let guard = 0;
  while (now < seconds * 1000 && guard++ < 400000) {
    pacer.observe(now, wokeChained);
    // core/app.js targetFps(): the scene is moving, so full rate is requested,
    // capped by the governor's ceiling. (Grace keeps it there after entry.)
    const displayHz = pacer.displayHz || hz;
    const want = Math.max(rate.floor, Math.min(displayHz, rate.ceiling));

    if (pacer.advance(now, want)) {
      const t0 = now;
      // REAL WORK IS NOT A CONSTANT. GC, a texture upload, a shader compile, a
      // heavier camera angle — the cost moves every frame, and a cost that
      // straddles a refresh boundary is the classic judder generator.
      const cost = workMs + (jitterMs ? (rnd() - 0.5) * 2 * jitterMs : 0);
      busyUntil = now + Math.max(0.1, cost);
      if (last !== null) delivered.push(t0 - last);
      last = t0;
      paced.push(pacer.pacedFps);
      // the governor judges against the pace actually being asked for
      const budget = 1000 / (pacer.pacedFps || want);
      if (now > graceMs) rate.frame(pacer.dt, budget);
      const due = pacer.timeUntilDue(busyUntil);
      if (pacer.pacedFps > 0 && pacer.pacedFps < CHAIN_ABOVE_FPS && due > ARM_EARLY_MS) {
        wokeChained = false;
        now = nextVsync(busyUntil + (due - ARM_EARLY_MS));
      } else {
        wokeChained = true;
        now = nextVsync(busyUntil);            // chained: next vsync after work
      }
    } else {
      wokeChained = true;
      now = nextVsync(Math.max(now, busyUntil));
    }
  }

  // Judge the SETTLED tail (last quarter) — and separately, how long the player
  // spent juddering before it settled, which is the part they actually feel.
  const tail = delivered.slice(Math.floor(delivered.length * 0.75));
  if (!tail.length) return { hz, workMs, fps: 0, spread: 0, note: 'no frames' };
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  const min = Math.min(...tail);
  const max = Math.max(...tail);
  // How many DISTINCT gap lengths (rounded to a ms) the player is being served.
  const buckets = new Map();
  for (const g of tail) {
    const k = Math.round(g);
    buckets.set(k, (buckets.get(k) || 0) + 1);
  }
  const shape = [...buckets.entries()].sort((a, b) => b[1] - a[1])
    .slice(0, 3).map(([ms, n]) => `${ms}ms x${n}`).join(', ');
  // time to settle: the last moment a gap differed from the eventual cadence
  const settled = Math.round(tail.reduce((a, b) => a + b, 0) / tail.length);
  let unsettledMs = 0;
  let acc = 0;
  for (let i = 0; i < delivered.length; i++) {
    acc += delivered[i];
    if (Math.abs(delivered[i] - settled) > 2) unsettledMs = acc;
  }
  return {
    settleSeconds: +(unsettledMs / 1000).toFixed(1),
    hz,
    workMs,
    fps: +(1000 / mean).toFixed(1),
    spreadMs: +(max - min).toFixed(2),
    gaps: shape,
    measuredHz: pacer.displayHz,
    truthHz: hz,
    finalCeiling: rate.ceiling,
    finalPaced: paced[paced.length - 1],
  };
}

const rows = [];
// THE REALISTIC CASE: a cost that moves, and a panel that jitters.
for (const hz of [60, 144, 165]) {
  for (const workMs of [3, 5, 6.5, 7, 8, 11]) {
    rows.push({ ...simulate({ hz, workMs, jitterMs: workMs * 0.45, vsyncJitterMs: 0.4, seconds: 30 }), workMs: workMs + '+-45%' });
  }
}
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('panel', 7) + pad('work', 10) + pad('fps', 8) + pad('spread', 9) + pad('settled@', 10) + pad('ceiling', 9) + 'gap shape');
console.log('-'.repeat(86));
for (const r of rows) {
  const flag = r.spreadMs > 2 ? '  <-- JUDDER' : '';
  console.log(
    pad(r.hz + 'Hz', 7) + pad(r.workMs + 'ms', 10) + pad(r.fps, 8)
    + pad(r.spreadMs + 'ms', 9) + pad(r.settleSeconds + 's', 10) + pad(r.finalCeiling, 9) + r.gaps + flag,
  );
}
