import assert from 'node:assert/strict';
import { pausableWait } from '../src/engine/Sequencer.js';
import { CutsceneMotion } from '../src/engine/CutsceneMotion.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const paused of [false, true]) {
  const lifetime = new AbortController();
  const started = performance.now();
  const wait = pausableWait(5000, () => paused, lifetime.signal);
  lifetime.abort(Object.assign(new Error('test abort'), { name: 'AbortError' }));
  await assert.rejects(wait, { name: 'AbortError' });
  assert.ok(performance.now() - started < 50, 'abortable wait did not settle immediately');
}

{
  const motion = new CutsceneMotion();
  const run = motion.tween(5000, () => {});
  const error = Object.assign(new Error('scene left'), { name: 'AbortError' });
  motion.cancel(error);
  await assert.rejects(run, { name: 'AbortError' });
  assert.equal(motion.active, false);
}

// Minimal browser globals let the narrator module initialize without an audio
// device. The fake source deliberately never emits onended after stop().
globalThis.localStorage = { getItem: () => null, removeItem() {}, setItem() {} };
globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {}, hidden: false };
const { Audio } = await import('../src/systems/AudioSystem.js');
const { Narrator } = await import('../src/systems/Narrator.js');
const sources = [];
Audio.playVO = () => {
  const source = { onended: null, stopped: 0, disconnected: 0, stop() { this.stopped += 1; }, disconnect() { this.disconnected += 1; } };
  sources.push(source);
  return source;
};

Audio.channels.voice = 0;
let mutedLoadCalls = 0;
const originalLoadVO = Narrator._loadVO.bind(Narrator);
Narrator._loadVO = async () => { mutedLoadCalls += 1; return {}; };
const mutedNarration = Narrator.speak('The Lord was with Joseph.', 'muted/test');
assert.equal(mutedLoadCalls, 0, 'a zero narrator channel must not decode VO');
assert.equal(sources.length, 0, 'a zero narrator channel must not create a VO source');
assert.equal(Narrator.speaking, false, 'inaudible reading hold must not force full-rate rendering');
Narrator.stop('test-complete');
assert.equal((await mutedNarration).status, 'test-complete');
Narrator._loadVO = originalLoadVO;
Audio.channels.voice = 1;

let resolveDelayedVO;
Narrator._loadVO = () => new Promise((resolve) => { resolveDelayedVO = resolve; });
const sourcesBeforeDelayedMute = sources.length;
const delayedMutedLine = Narrator.speak('The Lord was with Joseph.', 'delayed/mute');
await delay(0);
Audio.setChannel('voice', 0);
resolveDelayedVO({});
assert.equal((await delayedMutedLine).status, 'superseded');
assert.equal(sources.length, sourcesBeforeDelayedMute,
  'muting during VO decode must not revive a silent source after decode');
Audio.setChannel('voice', 1);
Narrator._loadVO = originalLoadVO;

const first = Narrator._playFile({});
const lateFirstEnd = sources[0].onended;
Narrator.skip();
assert.equal((await first).status, 'skipped');
assert.equal(Narrator.speaking, false);
assert.equal(sources[0].stopped, 1, 'skip did not stop the active VO source');
assert.equal(sources[0].disconnected, 1, 'skip did not disconnect the active VO source');

Audio.channels.voice = 1;
const voiceSliderLine = Narrator._playFile({});
Audio.setChannel('voice', 0);
assert.equal((await voiceSliderLine).status, 'muted');
assert.equal(sources[1].stopped, 1, 'Narrator slider zero did not stop the active VO source');
assert.equal(sources[1].disconnected, 1, 'Narrator slider zero did not disconnect the active VO source');
assert.equal(Narrator.speaking, false);
Audio.setChannel('voice', 1);

const second = Narrator._playFile({});
lateFirstEnd();
assert.equal(Narrator.speaking, true, 'late old onended cleared the newer line');
Narrator.skip();
assert.equal((await second).status, 'skipped');
assert.equal(sources[2].disconnected, 1, 'second VO source was not disconnected');

await delay(0);
console.log('Scene lifetime and synchronous narration-skip checks passed.');
