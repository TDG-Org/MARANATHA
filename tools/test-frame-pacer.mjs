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

console.log('Frame pacer acceptance checks passed.');
