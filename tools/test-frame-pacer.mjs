import assert from 'node:assert/strict';
import { createFramePacer, snapToRefresh } from '../src/core/framePacer.js';

const SOURCE_RATES = [60, 75, 90, 120, 144, 165, 240];

// A REAL DISPLAY IS NOT A METRONOME. rAF timestamps wobble by a fraction of a
// millisecond, and the first version of this test drove a perfect stream — so it
// passed while the pacer's period estimator (the minimum of a window, which a
// jittered sample biases LOW by twice the jitter) mis-measured a 144Hz panel as
// ~168Hz and collapsed the pacing to 48fps with a 16ms spread. WORSE than the
// judder the change existed to remove, and green the whole time.
//
// Every case below therefore runs with jitter, and a deterministic generator so
// a failure is reproducible.
let rngState = 12345;
const jitterRnd = () => {
  rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
  return rngState / 0x7fffffff;
};

// `observe` is what teaches the pacer the panel's period, exactly as the loop
// does on every chained rAF callback.
function run(sourceHz, targetFps, seconds = 10, {
  measure = true, allowOvershoot = true, jitter = 0,
} = {}) {
  const pacer = createFramePacer(0);
  pacer.allowOvershoot = allowOvershoot;
  const step = 1000 / sourceHz;
  const frames = Math.round((seconds * 1000) / step);
  const times = [];
  for (let f = 1; f <= frames; f++) {
    const now = f * step + (jitterRnd() - 0.5) * 2 * jitter;
    if (measure) pacer.observe(now, true);
    if (pacer.advance(now, targetFps)) times.push(now);
  }
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
  // Ignore the settling frames before the period measurement is confident.
  const steady = gaps.slice(Math.min(40, gaps.length - 1));
  const min = Math.min(...steady);
  const max = Math.max(...steady);
  const mean = steady.reduce((a, b) => a + b, 0) / steady.length;
  return {
    fps: 1000 / mean,
    spread: max - min,
    displayHz: pacer.displayHz,
    paced: pacer.pacedFps,
  };
}

// ── THE JUDDER THAT STARTED THIS ───────────────────────────────────────────
// Before the pacer snapped to the display, a 60fps request on a 144Hz panel
// delivered 13.9/20.8ms frames — the right average and visible stutter. On 75
// and 90Hz it was a 100% swing every single frame. The whole point of the
// change is that the SPREAD is now zero on every panel: each frame lands a
// whole number of refreshes after the last one.
console.log('display  request  ->  paced      frame gaps');
for (const sourceHz of SOURCE_RATES) {
  for (const targetFps of [30, 60]) {
    const clean = run(sourceHz, targetFps);
    assert.equal(
      clean.displayHz, sourceHz,
      `pacer measured ${clean.displayHz}Hz on a ${sourceHz}Hz stream`,
    );
    // Jitter may only ever show up as jitter. The frame must still land on the
    // SAME whole multiple of the refresh, and the extra spread must be the
    // display's own wobble (a uniform +-j on both ends of a gap spans up to 4j)
    // rather than the pacer admitting the wrong refresh.
    // Jitter is a property of the panel, so it is expressed as a FRACTION of
    // that panel's refresh period (1.2ms means nothing on a 240Hz display —
    // that is a third of a refresh, and no pacer can place a frame correctly
    // when the timestamps are that wrong). The hard limit is a quarter of a
    // period: a gap carries the wobble of BOTH its endpoints, and the admission
    // window is half a refresh, which is the widest it can be without letting
    // the neighbouring refresh through.
    for (const share of [0, 0.05, 0.12]) {
      const jitter = share * (1000 / sourceHz);
      const r = run(sourceHz, targetFps, 8, { jitter });
      assert.ok(
        r.fps >= targetFps * 0.7,
        `${sourceHz}Hz -> ${targetFps}fps (+-${jitter.toFixed(2)}ms) paced down to ${r.fps.toFixed(1)}fps`,
      );
      const perFrame = sourceHz / r.fps;
      assert.ok(
        Math.abs(perFrame - Math.round(perFrame)) < 0.02,
        `${sourceHz}Hz -> ${r.fps.toFixed(1)}fps (+-${jitter.toFixed(2)}ms jitter) is ${perFrame.toFixed(2)} refreshes `
        + 'per frame, not a whole number — the period estimate is being fooled by jitter',
      );
      assert.ok(
        r.spread <= 4 * jitter + 0.35,
        `${sourceHz}Hz -> ${targetFps}fps juddered beyond its +-${jitter.toFixed(2)}ms jitter: spread ${r.spread.toFixed(2)}ms`,
      );
      if (jitter === 0) {
        console.log(
          `${String(sourceHz).padStart(4)}Hz  ${String(targetFps).padStart(3)}fps  ->  `
          + `${r.fps.toFixed(1).padStart(5)}fps  (every ${Math.round(perFrame)} refresh, spread ${r.spread.toFixed(1)}ms)`,
        );
      }
    }
  }
}

// BEYOND THE OPERATING LIMIT, DEGRADE — NEVER RUN AWAY.
//
// A quarter of a refresh is the hard ceiling (a gap carries the wobble of both
// endpoints, and the admission window can be at most half a refresh without
// letting the neighbouring refresh in), and the divisor multiplies the period's
// estimation error on top of that. Past ~a fifth of a period the occasional
// frame lands on the wrong refresh. A display wobbling that much is not
// delivering steady frames anyway; what matters is that the pacer keeps
// roughly the right rate instead of collapsing or spiralling.
for (const sourceHz of [120, 240]) {
  for (const targetFps of [30, 60]) {
    const r = run(sourceHz, targetFps, 8, { jitter: 0.28 * (1000 / sourceHz) });
    assert.ok(
      r.fps >= targetFps * 0.7 && r.fps <= sourceHz * 1.02,
      `${sourceHz}Hz at severe jitter ran away to ${r.fps.toFixed(1)}fps`,
    );
    // Past the limit a frame can be MISSED, and a missed frame costs a whole
    // interval, not a refresh. One is tolerable; a pile-up is not.
    assert.ok(
      r.spread <= (1000 / targetFps) * 1.15,
      `${sourceHz}Hz at severe jitter lost more than one frame in a row (spread ${r.spread.toFixed(2)}ms)`,
    );
  }
}

// A tie in the snapping must not flap. Eco 30 on a 165Hz panel is EXACTLY as
// far from every 5th refresh (33fps) as from every 6th (27.5fps); a measurement
// wobbling by a hundredth of a millisecond used to flip the choice back and
// forth, and every flip re-anchored the deadline (measured: a 7-10ms spread in
// an otherwise even stream).
{
  const tie = run(165, 30, 8, { jitter: 0.5 });
  assert.ok(tie.spread <= 2.4, `a tied divisor flapped under jitter: spread ${tie.spread.toFixed(2)}ms`);
}

// A pause resets the deadline. The chosen divisor has to be invalidated with
// it, or the next frame reuses an interval of zero and lets EVERY refresh
// through (measured: a resume paced 144 instead of 72).
{
  const pacer = createFramePacer(0);
  let now = 0;
  for (let f = 0; f < 200; f++) { now += 1000 / 144; pacer.observe(now, true); pacer.advance(now, 60); }
  pacer.reset(now);
  let ticks = 0;
  for (let f = 0; f < 144 * 2; f++) {
    now += 1000 / 144;
    pacer.observe(now, true);
    if (pacer.advance(now, 60)) ticks += 1;
  }
  assert.ok(
    Math.abs(ticks / 2 - 72) <= 2,
    `after a pause the pacer ran at ${(ticks / 2).toFixed(1)}fps instead of 72`,
  );
}

// The panel can change under a running session (a window dragged to another
// monitor). The estimate must follow it and settle even again.
{
  const pacer = createFramePacer(0);
  let now = 0;
  for (let f = 0; f < 144 * 4; f++) { now += 1000 / 144; pacer.observe(now, true); pacer.advance(now, 60); }
  const times = [];
  for (let f = 0; f < 60 * 8; f++) {
    now += 1000 / 60;
    pacer.observe(now, true);
    if (pacer.advance(now, 60)) times.push(now);
  }
  assert.equal(pacer.displayHz, 60, `pacer stayed on the old panel (${pacer.displayHz}Hz)`);
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
  const settled = gaps.slice(-120);
  assert.ok(
    Math.max(...settled) - Math.min(...settled) < 0.01,
    'the pacer never settled evenly after the display rate changed',
  );
}

// A capable desktop asking for its panel's own rate gets exactly that.
for (const hz of [120, 144, 165]) {
  const r = run(hz, hz, 4);
  assert.ok(Math.abs(r.fps - hz) < 0.5, `${hz}Hz panel could not be driven at ${hz}: got ${r.fps.toFixed(1)}`);
}

// Power-first devices (a phone, or an explicit Low) never render ABOVE what was
// asked for; they take the even step below instead of a ragged 60.
{
  const phone = run(90, 60, 6, { allowOvershoot: false });
  assert.ok(phone.fps < 61, `a power-first 90Hz device rendered ${phone.fps.toFixed(1)}fps`);
  assert.ok(phone.spread < 0.001, 'a power-first device still juddered');
  const desktop = run(90, 60, 6, { allowOvershoot: true });
  assert.ok(desktop.fps > 61, `a 90Hz desktop should take the even 90, got ${desktop.fps.toFixed(1)}`);
  console.log(`90Hz: power-first ${phone.fps.toFixed(1)}fps · smoothness-first ${desktop.fps.toFixed(1)}fps (both even)`);
}

// Without a measurement the pacer must behave exactly as it always did — an
// unmeasured display is not an excuse to invent a cadence.
{
  const unmeasured = run(144, 60, 4, { measure: false });
  assert.ok(
    Math.abs(unmeasured.fps - 60) <= 1,
    `unmeasured pacing drifted from the request: ${unmeasured.fps.toFixed(1)}fps`,
  );
  assert.equal(snapToRefresh(60, 0), 1000 / 60, 'no period must mean no snapping');
}

// A timer wake-up is not one refresh after the last frame; sampling those would
// "measure" a 30Hz display and then pace the whole game to it.
{
  const pacer = createFramePacer(0);
  for (let i = 1; i <= 40; i++) pacer.observe(i * 33.3, false);
  assert.equal(pacer.displayHz, 0, 'unchained wake-ups must not be treated as refreshes');
}

{
  const pacer = createFramePacer(0);
  const step = 1000 / 144;
  let now = step;
  while (now < 1000) {
    pacer.advance(now, 30);
    now += step;
  }
  assert.equal(pacer.advance(now, 60), true, '30 -> 60 must tick immediately');
}

{
  const pacer = createFramePacer(0);
  assert.equal(pacer.advance(1000 / 60, 60), true);
  assert.equal(pacer.advance(520, 60), true);
  assert.equal(pacer.dt, 100);
  assert.equal(pacer.advance(522, 60), false, 'stall must not trigger catch-up spam');
}

// --- the loop's WAKE-UPS, not just its ticks ------------------------------
// Skipping the work is half the saving; not waking up is the other half. In eco
// the loop must sleep to the next deadline instead of chaining rAF at the
// panel's refresh rate, and at full rate it must stay on rAF so frames land on
// vsync. This drives the real startLoop against a virtual clock and counts both.
{
  const priorRaf = globalThis.requestAnimationFrame;
  const priorCancel = globalThis.cancelAnimationFrame;
  const priorTimeout = globalThis.setTimeout;
  const priorClear = globalThis.clearTimeout;
  const priorDoc = globalThis.document;
  const priorPerf = globalThis.performance;

  // The loop can only learn the panel's period from CHAINED callbacks, so it
  // learns it at full rate — which is exactly what happens in the game, where
  // every screen entry runs at full rate for three seconds before the governor
  // is allowed to drop to eco. The harness reproduces that warm-up and measures
  // only what happens afterwards.
  const WARM_MS = 700;
  const measure = async (displayHz, targetFps, seconds, timerLateMs = 0) => {
    let clock = 0;
    let nextId = 1;
    const rafQueue = new Map();
    const timerQueue = new Map();
    let rafCallbacks = 0;
    let ticks = 0;
    const tickTimes = [];

    globalThis.performance = { now: () => clock };
    globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
    globalThis.requestAnimationFrame = (fn) => { const id = nextId++; rafQueue.set(id, fn); return id; };
    globalThis.cancelAnimationFrame = (id) => rafQueue.delete(id);
    // Real timers do not fire on time. `timerLateMs` reproduces Windows' slop.
    globalThis.setTimeout = (fn, ms = 0) => {
      const id = nextId++;
      timerQueue.set(id, { fn, at: clock + Math.max(0, ms) + timerLateMs });
      return id;
    };
    globalThis.clearTimeout = (id) => timerQueue.delete(id);

    const { startLoop } = await import(`../src/core/renderer.js?wake=${displayHz}-${targetFps}-${timerLateMs}`);
    const loop = startLoop(
      () => { if (clock >= WARM_MS) { ticks += 1; tickTimes.push(clock); } },
      () => (clock < WARM_MS ? displayHz : targetFps),
    );

    const frameStep = 1000 / displayHz;
    for (let f = 1; f <= (seconds * 1000 + WARM_MS) / frameStep; f++) {
      const frameTime = f * frameStep;
      // fire any timer that came due before this vsync
      for (const [id, t] of [...timerQueue]) {
        if (t.at <= frameTime) { clock = t.at; timerQueue.delete(id); t.fn(); }
      }
      clock = frameTime;
      const pending = [...rafQueue];
      rafQueue.clear();
      for (const [, fn] of pending) { if (clock >= WARM_MS) rafCallbacks += 1; fn(clock); }
    }
    loop.stop();
    // Judder is a spread of INTERVALS, not a wrong average: 50/17/50/17 averages
    // to the right frame rate and looks broken.
    const gaps = [];
    for (let i = 1; i < tickTimes.length; i++) gaps.push(tickTimes[i] - tickTimes[i - 1]);
    const steady = gaps.slice(2); // ignore the first frames after the rate change
    const worst = steady.length ? Math.max(...steady) : 0;
    const best = steady.length ? Math.min(...steady) : 0;
    return {
      rafCallbacks: rafCallbacks / seconds,
      ticks: ticks / seconds,
      maxGap: worst,
      minGap: best,
      spread: worst - best,
    };
  };

  // What the loop SHOULD deliver on a given panel for a given request, from the
  // same snapping the pacer uses — so this test states the contract once.
  const expected = (hz, request, allowOvershoot = true) =>
    1000 / snapToRefresh(request, 1000 / hz, { allowOvershoot });

  try {
    const eco = await measure(144, 30, 4);
    const ecoWant = expected(144, 30);
    assert.ok(
      Math.abs(eco.ticks - ecoWant) <= 1,
      `eco produced ${eco.ticks.toFixed(1)} ticks/s, expected ${ecoWant.toFixed(1)}`,
    );
    // The wake margin has to be wide enough to catch the right vsync (see the
    // judder guard below), which costs a couple of cheap callbacks per frame.
    // 144/s down to ~60/s is the honest saving; buying the last few wake-ups
    // back by shaving the margin traded smoothness for a number, which is the
    // wrong way round.
    assert.ok(
      eco.rafCallbacks < 75,
      `eco still woke the main thread ${eco.rafCallbacks.toFixed(1)} times/s on a 144Hz panel`,
    );

    const full = await measure(144, 60, 4);
    const fullWant = expected(144, 60); // 72 — every second refresh of a 144Hz panel
    assert.ok(
      Math.abs(full.ticks - fullWant) <= 1,
      `full rate produced ${full.ticks.toFixed(1)} ticks/s, expected ${fullWant.toFixed(1)}`,
    );
    assert.ok(
      full.rafCallbacks > 130,
      `full rate left vsync for a timer (${full.rafCallbacks.toFixed(1)} callbacks/s) — that is judder`,
    );
    assert.ok(
      full.spread <= 0.5,
      `full rate on a 144Hz panel juddered: frame gaps ${full.minGap.toFixed(1)}-${full.maxGap.toFixed(1)}ms`,
    );
    // THE JUDDER GUARD. Sleeping to a timer and then asking for a rAF means the
    // request has to reach the right vsync. With a thin margin a late timer
    // misses it and the frame lands a whole refresh period later, giving a
    // 50/17/50/17 rhythm that averages out correctly and looks awful. Eco must
    // stay EVEN under realistic timer slop, on both common panel rates.
    for (const [hz, late] of [[60, 0], [60, 4], [60, 9], [144, 0], [144, 4], [144, 9]]) {
      const paced = await measure(hz, 30, 4, late);
      const want = expected(hz, 30);
      assert.ok(
        Math.abs(paced.ticks - want) <= 1,
        `${hz}Hz eco with ${late}ms timer slop produced ${paced.ticks.toFixed(1)} fps, expected ${want.toFixed(1)}`,
      );
      assert.ok(
        paced.spread <= 1000 / hz + 1,
        `${hz}Hz eco with ${late}ms timer slop juddered: frame gaps ${paced.minGap.toFixed(1)}-${paced.maxGap.toFixed(1)}ms`,
      );
    }

    // A capable desktop asking for the panel's own rate must actually get it
    // through the real loop, on vsync, evenly.
    const native = await measure(144, 144, 4);
    assert.ok(
      Math.abs(native.ticks - 144) <= 2,
      `a 144Hz panel driven at 144 produced ${native.ticks.toFixed(1)} fps`,
    );
    assert.ok(native.spread <= 0.5, `native-rate frames were uneven (${native.spread.toFixed(1)}ms spread)`);

    console.log(
      `loop wake-ups on a 144Hz panel: eco ${eco.rafCallbacks.toFixed(1)}/s for ${eco.ticks.toFixed(1)} frames · `
      + `full ${full.rafCallbacks.toFixed(1)}/s for ${full.ticks.toFixed(1)} frames (on vsync, spread ${full.spread.toFixed(1)}ms) · `
      + `native ${native.ticks.toFixed(1)} fps; eco stays even under 0-9ms timer slop at 60Hz and 144Hz`,
    );
  } finally {
    globalThis.requestAnimationFrame = priorRaf;
    globalThis.cancelAnimationFrame = priorCancel;
    globalThis.setTimeout = priorTimeout;
    globalThis.clearTimeout = priorClear;
    globalThis.document = priorDoc;
    globalThis.performance = priorPerf;
  }
}

console.log('Frame pacer acceptance checks passed.');

// ── THE PANEL MEASUREMENT MUST NOT BE CONTAMINATED BY THE GAME'S OWN COST ───
//
// Nate: "still way too choppy and laggy... find the deep root". This was it.
//
// `observe` learns the refresh period from the gap between chained rAF
// callbacks. But a callback is one refresh after the last one only if the frame
// before it FIT IN ONE REFRESH. A ~7ms scene on a 6.94ms (144Hz) panel overruns
// most frames, so most gaps are TWO refreshes — and a median-based estimator
// then concludes the panel is 72Hz. It paces to that wrong number; the scene
// gets momentarily cheaper; the estimate snaps back toward 144; the divisor
// re-snaps and the deadline re-anchors. The player gets an endless mix of 7ms
// and 14ms gaps. On a 60Hz panel it can never happen (a frame that fits in
// 16.7ms never overruns), which is why it only ever showed up on a gaming PC.
{
  const contaminated = (trueHz, overrunFraction, jitter = 0.4) => {
    const pacer = createFramePacer(0);
    const period = 1000 / trueHz;
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let t = 0;
    for (let i = 0; i < 400; i++) {
      t += period * (rnd() < overrunFraction ? 2 : 1) + (rnd() - 0.5) * jitter;
      pacer.observe(t, true);
    }
    return pacer.displayHz;
  };

  for (const hz of [120, 144, 165, 240]) {
    for (const overrun of [0, 0.25, 0.5, 0.65, 0.9]) {
      const measured = contaminated(hz, overrun);
      assert.ok(
        Math.abs(measured - hz) <= hz * 0.05,
        `${hz}Hz with ${Math.round(overrun * 100)}% of frames overrunning a refresh `
        + `measured ${measured}Hz — the estimate is following the GAME, not the panel`,
      );
    }
  }

  // ...while a panel that genuinely runs at half the rate must still read as
  // itself, or the fix would just be the old bug pointing the other way.
  for (const hz of [60, 72, 75]) {
    const measured = contaminated(hz, 0);
    assert.ok(Math.abs(measured - hz) <= hz * 0.05,
      `a real ${hz}Hz panel measured ${measured}Hz`);
  }

  // And the jitter robustness that forced the median in the first place has to
  // survive: the strict minimum of a jittered sample is biased low by about
  // twice the jitter, which is what mis-read 144Hz as ~168Hz and collapsed the
  // pacing to 48fps.
  for (const jitter of [0, 0.4, 1.0, 2.0]) {
    const measured = contaminated(144, 0, jitter);
    assert.ok(Math.abs(measured - 144) <= 144 * 0.05,
      `144Hz at +-${jitter}ms jitter measured ${measured}Hz`);
  }
  console.log('panel measurement: immune to frame-cost contamination, and still jitter-robust');
}
