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

// A staged dialogue failure used to strand the screen black with input off.
// Inject failure only after the player, speakers, and a background actor have
// moved and the camera has cut/revealed. This proves the dangerous cleanup path,
// rather than merely proving that an early cover failure is survivable.
{
  const inputs = [];
  const freezes = [];
  const fades = [];
  const cutsceneStates = [];
  const cameraCalls = [];
  const errors = [];
  let trigger = null;
  const makeBrother = (x, z) => ({
    pos: { x, z },
    circle: { x, z },
    home: { x, z },
    target: null,
    stuckT: 0,
    onArrive: null,
    char: {
      headHeight: 1.65,
      setPosition(nx, nz) { this.x = nx; this.z = nz; },
      turnToward() {},
      play() {},
    },
  });
  const firstBrother = makeBrother(-7, 2);
  const secondBrother = makeBrother(9, -7);
  const backgroundActor = makeBrother(4, 4);
  const josephStart = { x: 2.79847, z: -3.74934 };
  const joseph = {
    position: { ...josephStart, y: 0 },
    headHeight: 1.65,
    setPosition(x, z) { this.position.x = x; this.position.z = z; },
    turnToward() {},
  };
  const failureCtx = {
    signal: new AbortController().signal,
    setInput(on) { inputs.push(on); },
    grading: { grade() {} },
    hud: {
      setObjective() {},
      flashCount() {},
      clearObjective() {},
      async completeObjective() {},
      setCutscene(on) { cutsceneStates.push(on); },
    },
    camp: { pen: { minX: 8, gate: { z0: 9, z1: 12 } } },
    guide: { setTargetXZ() {}, setTarget() {} },
    interactables: { addTrigger(spec) { trigger = spec; } },
    sheep: { nearestStray: () => null, straysLeft: 0 },
    joseph,
    cast: {
      brother5: firstBrother,
      brother1: secondBrother,
      worker1: backgroundActor,
    },
    npcs: { freeze(brother, on) { freezes.push({ brother, on }); } },
    cinema: {
      async fade(on) {
        fades.push(on);
      },
    },
    camera: {
      camera: { fov: 46, aspect: 16 / 9 },
      cutTo() { cameraCalls.push('cut'); },
      release() { cameraCalls.push('release'); },
      snap() { cameraCalls.push('snap'); },
    },
    controller: { vel: { set() {} } },
    dialogue: {
      async say() { throw new Error('injected dialogue failure'); },
      hide() {},
    },
    sound() {},
  };
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    const { herd: failingHerd } = makeCampBeats(failureCtx, helpers);
    const herdWork = failingHerd();
    assert.ok(trigger, 'herd directions trigger was not registered');
    await trigger.onEnter();
    await herdWork;
  } finally {
    console.error = originalError;
  }
  assert.equal(errors.length, 1, 'injected post-staging failure was not reported exactly once');
  assert.deepEqual(fades, [true, false, true, false],
    'post-staging failure did not cover before restore and reveal afterward');
  assert.deepEqual(cutsceneStates, [true, false],
    'post-staging failure left quest UI in cutscene mode');
  assert.equal(inputs.at(-1), true, 'failed herd directions did not restore gameplay input');
  assert.deepEqual(
    [joseph.position.x, joseph.position.z],
    [josephStart.x, josephStart.z],
    'failed herd directions displaced Joseph',
  );
  assert.deepEqual([firstBrother.pos.x, firstBrother.pos.z], [-7, 2]);
  assert.deepEqual([secondBrother.pos.x, secondBrother.pos.z], [9, -7]);
  assert.deepEqual([backgroundActor.pos.x, backgroundActor.pos.z], [4, 4],
    'failed herd directions did not restore a background actor');
  assert.ok(cameraCalls.includes('cut'), 'failure was injected before the staged camera cut');
  assert.deepEqual(cameraCalls.slice(-2), ['release', 'snap'],
    'failed herd directions did not restore the follow camera');
  assert.deepEqual(
    freezes.map(({ on }) => on),
    [true, true, true, false, false, false],
    'failed herd directions left a staged or background actor frozen',
  );
}

console.log('Camp beat entry and herd gate checks passed.');
