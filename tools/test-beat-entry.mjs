import assert from 'node:assert/strict';
import { makeCampBeats } from '../src/scenes/joseph3d/beats/camp.js';

const objectives = [];
const guideTargets = [];
const ctx = {
  signal: null,
  setInput() {},
  grading: { grade() {} },
  hud: {
    setObjective(text) { objectives.push(text); },
    flashCount() {},
    async completeObjective() {},
  },
  camp: { pen: { minX: 8, gate: { z0: 9, z1: 12 } } },
  guide: {
    setTargetXZ(x, z) { guideTargets.push({ x, z }); },
    setTarget() {},
  },
  interactables: { addTrigger() {} },
  sheep: { nearestStray: () => null, straysLeft: 0 },
  joseph: { position: { x: 0, z: 0 } },
  sound() {},
};

const helpers = {
  seq: async () => {},
  wait: async () => {},
  gate: (work) => work(),
  J: {},
  shot: () => ({}),
  twoShot() {},
  pointToGate: (pen) => ({ x: pen.minX + 0.6, z: (pen.gate.z0 + pen.gate.z1) / 2 }),
};

const { herd } = makeCampBeats(ctx, helpers);
await herd();

assert.equal(objectives[0], 'Bring 3 stray sheep back to the pen.');
assert.deepEqual(guideTargets[0], { x: 8.6, z: 10.5 });
assert.equal(ctx.onStrayPenned, null, 'completed herd gate must release its callback');
console.log('Camp beat entry and herd gate checks passed.');
