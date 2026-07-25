import assert from 'node:assert/strict';
import { createFramePacer } from '../src/core/framePacer.js';

const SOURCE_RATES = [60, 120, 144, 165, 240];

function run(sourceHz, targetFps, seconds = 10) {
  const pacer = createFramePacer(0);
  const step = 1000 / sourceHz;
  const duration = seconds * 1000;
  let ticks = 0;
  for (let now = step; now <= duration + 0.001; now += step) {
    if (pacer.advance(now, targetFps)) ticks += 1;
  }
  return ticks / seconds;
}

for (const sourceHz of SOURCE_RATES) {
  for (const targetFps of [30, 60]) {
    const actual = run(sourceHz, targetFps);
    assert.ok(
      Math.abs(actual - targetFps) <= 1,
      `${sourceHz}Hz -> ${targetFps}fps produced ${actual.toFixed(2)}fps`,
    );
    console.log(`${sourceHz}Hz -> ${targetFps}fps: ${actual.toFixed(2)}`);
  }
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
    const loop = startLoop(() => { ticks += 1; tickTimes.push(clock); }, () => targetFps);

    const frameStep = 1000 / displayHz;
    for (let f = 1; f <= seconds * displayHz; f++) {
      const frameTime = f * frameStep;
      // fire any timer that came due before this vsync
      for (const [id, t] of [...timerQueue]) {
        if (t.at <= frameTime) { clock = t.at; timerQueue.delete(id); t.fn(); }
      }
      clock = frameTime;
      const pending = [...rafQueue];
      rafQueue.clear();
      for (const [, fn] of pending) { rafCallbacks += 1; fn(clock); }
    }
    loop.stop();
    // Judder is a spread of INTERVALS, not a wrong average: 50/17/50/17 averages
    // to the right frame rate and looks broken.
    const gaps = [];
    for (let i = 1; i < tickTimes.length; i++) gaps.push(tickTimes[i] - tickTimes[i - 1]);
    const steady = gaps.slice(2); // ignore the first frames while the pacer settles
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

  try {
    const eco = await measure(144, 30, 4);
    assert.ok(Math.abs(eco.ticks - 30) <= 1, `eco produced ${eco.ticks.toFixed(1)} ticks/s`);
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
    assert.ok(Math.abs(full.ticks - 60) <= 1, `full rate produced ${full.ticks.toFixed(1)} ticks/s`);
    assert.ok(
      full.rafCallbacks > 130,
      `full rate left vsync for a timer (${full.rafCallbacks.toFixed(1)} callbacks/s) — that is judder`,
    );
    // THE JUDDER GUARD. Sleeping to a timer and then asking for a rAF means the
    // request has to reach the right vsync. With a thin margin a late timer
    // misses it and the frame lands a whole refresh period later, giving a
    // 50/17/50/17 rhythm that averages out correctly and looks awful. Eco must
    // stay EVEN under realistic timer slop, on both common panel rates.
    for (const [hz, late] of [[60, 0], [60, 4], [60, 9], [144, 0], [144, 4], [144, 9]]) {
      const paced = await measure(hz, 30, 4, late);
      assert.ok(
        Math.abs(paced.ticks - 30) <= 1,
        `${hz}Hz eco with ${late}ms timer slop produced ${paced.ticks.toFixed(1)} fps`,
      );
      assert.ok(
        paced.spread <= 1000 / hz + 1,
        `${hz}Hz eco with ${late}ms timer slop juddered: frame gaps ${paced.minGap.toFixed(1)}-${paced.maxGap.toFixed(1)}ms`,
      );
    }

    console.log(
      `loop wake-ups on a 144Hz panel: eco ${eco.rafCallbacks.toFixed(1)}/s for ${eco.ticks.toFixed(1)} frames · `
      + `full ${full.rafCallbacks.toFixed(1)}/s for ${full.ticks.toFixed(1)} frames (stays on vsync); `
      + `eco stays even under 0-9ms timer slop at 60Hz and 144Hz`,
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
