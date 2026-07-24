import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pausableWait } from '../src/engine/Sequencer.js';
import { CutsceneMotion } from '../src/engine/CutsceneMotion.js';

const nativeSetTimeout = globalThis.setTimeout;
const delay = (ms) => new Promise((resolve) => nativeSetTimeout(resolve, ms));

for (const paused of [false, true]) {
  const lifetime = new AbortController();
  const started = performance.now();
  const wait = pausableWait(5000, () => paused, lifetime.signal);
  lifetime.abort(Object.assign(new Error('test abort'), { name: 'AbortError' }));
  await assert.rejects(wait, { name: 'AbortError' });
  assert.ok(performance.now() - started < 50, 'abortable wait did not settle immediately');
}

// A hidden tab owns the same temporal pause as the in-game pause menu. The
// renderer already stops its rAF loop; DOM/timer-backed story waits must not
// quietly advance while the player cannot see them.
{
  let hidden = true;
  let settled = false;
  const wait = pausableWait(100, () => hidden).then(() => { settled = true; });
  await delay(130);
  assert.equal(settled, false, 'hidden-tab story time advanced off-screen');
  hidden = false;
  await wait;
  assert.equal(settled, true);
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
const documentListeners = new Map();
globalThis.document = {
  hidden: false,
  addEventListener(type, listener) {
    const listeners = documentListeners.get(type) || [];
    listeners.push(listener);
    documentListeners.set(type, listeners);
  },
  dispatch(type) {
    for (const listener of documentListeners.get(type) || []) listener({ type });
  },
};
const { Audio } = await import('../src/systems/AudioSystem.js');
const { Narrator } = await import('../src/systems/Narrator.js');
const sources = [];
Audio.playVO = () => {
  const source = { onended: null, stopped: 0, disconnected: 0, stop() { this.stopped += 1; }, disconnect() { this.disconnected += 1; } };
  sources.push(source);
  return source;
};

// Preload uses a small worker pool and reports aggregate truth. It must not
// open one request per future line at once on a low-end device.
const originalPreloadVO = Audio.preloadVO.bind(Audio);
let livePreloads = 0;
let peakPreloads = 0;
Audio.preloadVO = async (url) => {
  livePreloads += 1;
  peakPreloads = Math.max(peakPreloads, livePreloads);
  await delay(2);
  livePreloads -= 1;
  return url.includes('/missing.') ? null : new ArrayBuffer(8);
};
const preloadSummary = await Narrator.preload([
  'chapter/a', 'chapter/b', 'chapter/c', 'chapter/d',
  'chapter/e', 'chapter/f', 'chapter/missing', 'chapter/a',
]);
assert.ok(peakPreloads <= 4, `narration preload opened ${peakPreloads} concurrent requests`);
assert.deepEqual(
  {
    ok: preloadSummary.ok,
    total: preloadSummary.total,
    loaded: preloadSummary.loaded,
    failed: preloadSummary.failed,
    missing: preloadSummary.missing,
  },
  { ok: false, total: 7, loaded: 6, failed: 1, missing: ['chapter/missing'] },
  'narration preload did not report aggregate file readiness honestly',
);

const preloadLifetime = new AbortController();
Audio.preloadVO = (_url, { signal } = {}) => new Promise((resolve, reject) => {
  const onAbort = () => reject(signal.reason);
  signal.addEventListener('abort', onAbort, { once: true });
});
const abortedPreload = Narrator.preload(
  ['chapter/slow-a', 'chapter/slow-b', 'chapter/slow-c', 'chapter/slow-d'],
  { signal: preloadLifetime.signal },
);
const preloadAbort = Object.assign(new Error('scene left during preload'), { name: 'AbortError' });
preloadLifetime.abort(preloadAbort);
await assert.rejects(abortedPreload, { name: 'AbortError' });
Audio.preloadVO = originalPreloadVO;

// Narrator fallback and TTS deadline time share the renderer's hidden-tab
// pause. Active-time deadlines cancel their one browser timeout while asleep:
// zero hidden callbacks, then exactly the remaining visible duration.
const originalSetTimeout = globalThis.setTimeout;
let narratorDeadlineCallbacks = 0;
globalThis.setTimeout = (callback, ms, ...args) => originalSetTimeout(() => {
  narratorDeadlineCallbacks += 1;
  callback(...args);
}, ms);

const readingDuration = 160;
let hiddenReadingSettled = false;
const readingStarted = performance.now();
const hiddenReading = Narrator._waitReading(readingDuration, { announce: false }).then((result) => {
  hiddenReadingSettled = true;
  return result;
});
await delay(55);
const readingBeforeHide = performance.now() - readingStarted;
document.hidden = true;
document.dispatch('visibilitychange');
await delay(190);
assert.equal(hiddenReadingSettled, false, 'fallback narration advanced while the tab was hidden');
assert.equal(narratorDeadlineCallbacks, 0, 'fallback deadline callback woke while hidden');
const readingResumed = performance.now();
document.hidden = false;
document.dispatch('visibilitychange');
assert.equal((await hiddenReading).status, 'ended');
const readingAfterResume = performance.now() - readingResumed;
assert.ok(
  Math.abs((readingBeforeHide + readingAfterResume) - readingDuration) < 45,
  `fallback deadline lost active time across hide (${readingBeforeHide + readingAfterResume}ms)`,
);
assert.equal(narratorDeadlineCallbacks, 1, 'fallback deadline did not use exactly one resumed callback');
assert.equal(Narrator._timeStateListeners.size, 0, 'finished fallback retained a time-state listener');

const originalNarratorSupported = Narrator.supported;
const originalEstimateMs = Narrator.estimateMs;
const originalSpeechSynthesis = window.speechSynthesis;
const originalUtterance = globalThis.SpeechSynthesisUtterance;
const ttsTransport = {
  utterance: null,
  pauseCalls: 0,
  resumeCalls: 0,
  cancelCalls: 0,
  cancel() {
    this.cancelCalls += 1;
    // Chromium may synchronously report cancellation through onerror.
    this.utterance?.onerror?.();
  },
  pause() { this.pauseCalls += 1; },
  resume() { this.resumeCalls += 1; },
  getVoices: () => [],
  speak(utterance) { this.utterance = utterance; },
};
window.speechSynthesis = ttsTransport;
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) { this.text = text; }
};
Narrator.supported = true;
Narrator.estimateMs = () => 60;
narratorDeadlineCallbacks = 0;
const ttsCapDuration = 60 * 2.2;
const ttsCapStarted = performance.now();
const hiddenTTSCap = Narrator._speakTTS('The Lord was with Joseph.');
const cancelsAfterTTSStart = ttsTransport.cancelCalls; // nudge() intentionally cancels once
await delay(40);
const ttsCapBeforeHide = performance.now() - ttsCapStarted;
document.hidden = true;
document.dispatch('visibilitychange');
await delay(170);
assert.equal(narratorDeadlineCallbacks, 0, 'TTS cap callback woke while hidden');
assert.ok(ttsTransport.pauseCalls > 0, 'hidden TTS transport was not physically paused');
const ttsCapResumed = performance.now();
document.hidden = false;
document.dispatch('visibilitychange');
assert.equal((await hiddenTTSCap).status, 'timeout');
assert.equal(ttsTransport.cancelCalls, cancelsAfterTTSStart + 1,
  'TTS deadline settled without cancelling the browser transport');
const ttsCapAfterResume = performance.now() - ttsCapResumed;
assert.ok(
  Math.abs((ttsCapBeforeHide + ttsCapAfterResume) - ttsCapDuration) < 45,
  `TTS cap lost active time across hide (${ttsCapBeforeHide + ttsCapAfterResume}ms)`,
);
assert.equal(narratorDeadlineCallbacks, 1, 'TTS cap did not use exactly one resumed callback');
assert.equal(Narrator._timeStateListeners.size, 0, 'timed-out TTS retained a time-state listener');

// Pause and visibility can overlap. A hidden terminal event remains pending
// until both release, then settles on that resume event without a timer tick.
Narrator.estimateMs = () => 100;
narratorDeadlineCallbacks = 0;
let pausedTTSSettled = false;
const pausedTTS = Narrator._speakTTS('The Lord was with Joseph.').then((result) => {
  pausedTTSSettled = true;
  return result;
});
await delay(20);
Narrator.pause();
document.hidden = true;
document.dispatch('visibilitychange');
const resumesBeforePartialRelease = ttsTransport.resumeCalls;
await delay(240);
assert.equal(pausedTTSSettled, false, 'TTS cap elapsed during pause/hidden overlap');
assert.equal(narratorDeadlineCallbacks, 0, 'TTS cap callback woke during pause/hidden overlap');
ttsTransport.utterance.onend();
await Promise.resolve();
assert.equal(pausedTTSSettled, false, 'paused TTS onend advanced the story off-screen');
document.hidden = false;
document.dispatch('visibilitychange');
await Promise.resolve();
assert.equal(pausedTTSSettled, false, 'visibility alone bypassed the in-game narrator pause');
assert.equal(ttsTransport.resumeCalls, resumesBeforePartialRelease,
  'visibility resumed TTS while the in-game pause still owned it');
Narrator.resume();
await Promise.resolve();
assert.equal(pausedTTSSettled, true, 'TTS terminal status did not settle on exact resume');
assert.equal((await pausedTTS).status, 'ended');
assert.equal(narratorDeadlineCallbacks, 0, 'resume settlement unnecessarily armed/fired a timer');
assert.ok(ttsTransport.resumeCalls > resumesBeforePartialRelease, 'resumed TTS transport stayed paused');
assert.equal(Narrator._timeStateListeners.size, 0, 'finished TTS retained a time-state listener');
Narrator.supported = originalNarratorSupported;
Narrator.estimateMs = originalEstimateMs;
window.speechSynthesis = originalSpeechSynthesis;
globalThis.SpeechSynthesisUtterance = originalUtterance;
globalThis.setTimeout = originalSetTimeout;

Audio.channels.voice = 0;
let mutedLoadCalls = 0;
const originalLoadVO = Narrator._loadVO.bind(Narrator);
Narrator._loadVO = async () => { mutedLoadCalls += 1; return {}; };
const mutedNarration = Narrator.speak('The Lord was with Joseph.', 'muted/test');
assert.equal(mutedLoadCalls, 0, 'a zero narrator channel must not decode VO');
assert.equal(sources.length, 0, 'a zero narrator channel must not create a VO source');
assert.equal(Narrator.speaking, false, 'inaudible reading hold must not force full-rate rendering');
assert.equal(Narrator.activeLine, true, 'muted reading hold must remain visibly skippable');
Narrator.skip();
assert.equal((await mutedNarration).status, 'skipped');
assert.equal(Narrator.activeLine, false);
Narrator._loadVO = originalLoadVO;
Audio.channels.voice = 1;

let resolveDelayedVO;
Narrator._loadVO = () => new Promise((resolve) => { resolveDelayedVO = resolve; });
const sourcesBeforeLoadingSkip = sources.length;
const loadingLine = Narrator.speak('The Lord was with Joseph.', 'delayed/skip');
await delay(0);
assert.equal(Narrator.activeLine, true, 'VO loading phase must expose an active narrated line');
assert.equal(Narrator.speaking, false, 'VO loading must not force full-rate rendering');
Narrator.skip();
assert.equal((await loadingLine).status, 'skipped', 'Skip must settle a line while its VO is still loading');
resolveDelayedVO({});
await delay(0);
assert.equal(sources.length, sourcesBeforeLoadingSkip, 'late decoded VO revived after a loading-phase skip');
assert.equal(Narrator.activeLine, false);

Narrator._loadVO = () => new Promise((resolve) => { resolveDelayedVO = resolve; });
const sourcesBeforeDelayedMute = sources.length;
const delayedMutedLine = Narrator.speak('The Lord was with Joseph.', 'delayed/mute');
await delay(0);
Audio.setChannel('voice', 0);
resolveDelayedVO({});
assert.equal((await delayedMutedLine).status, 'muted');
assert.equal(sources.length, sourcesBeforeDelayedMute,
  'muting during VO decode must not revive a silent source after decode');
Audio.setChannel('voice', 1);
Narrator._loadVO = originalLoadVO;

// Skip/mute retire this line's consumer and extension chain. Shared late
// fetch/decode work may still warm Audio's bounded cache, but a delayed MP3
// miss must never start an OGG request after the line has ended.
const originalDecodeVO = Audio.decodeVO.bind(Audio);
for (const mode of ['skip', 'mute']) {
  const calls = [];
  let resolveMP3;
  Audio.decodeVO = (url, { signal } = {}) => {
    calls.push({ url, signal });
    if (url.endsWith('.mp3')) {
      // Deliberately ignore signal here: Narrator's own format-loop guard must
      // still stop before OGG even when shared work finishes late.
      return new Promise((resolve) => { resolveMP3 = resolve; });
    }
    return Promise.resolve(null);
  };

  const id = `format-chain/${mode}`;
  const line = Narrator.speak('The Lord was with Joseph.', id);
  await delay(0);
  const lineSignal = calls[0]?.signal;
  if (mode === 'skip') Narrator.skip();
  else Audio.setChannel('voice', 0);

  assert.equal((await line).status, mode === 'skip' ? 'skipped' : 'muted');
  assert.equal(lineSignal?.aborted, true, `${mode} did not cancel the line consumer`);
  resolveMP3(null);
  await delay(0);
  assert.deepEqual(
    calls.map(({ url }) => url),
    [`audio/vo/${id}.mp3`],
    `${mode} allowed OGG probing after the line ended`,
  );
  if (mode === 'mute') Audio.setChannel('voice', 1);
}
Audio.decodeVO = originalDecodeVO;

const first = Narrator._playFile({});
const lateFirstEnd = sources[0].onended;
assert.equal(Narrator.activeLine, true);
Narrator.skip();
assert.equal((await first).status, 'skipped');
assert.equal(Narrator.speaking, false);
assert.equal(Narrator.activeLine, false);
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

let resolveAbortedVO;
Narrator._loadVO = () => new Promise((resolve) => { resolveAbortedVO = resolve; });
const lifetime = new AbortController();
const abortedLine = Narrator.speak('The Lord was with Joseph.', 'delayed/abort', { signal: lifetime.signal });
await delay(0);
lifetime.abort(Object.assign(new Error('scene left'), { name: 'AbortError' }));
await assert.rejects(abortedLine, { name: 'AbortError' });
assert.equal(Narrator.activeLine, false, 'scene abort left a narrated line active');
resolveAbortedVO({});
Narrator._loadVO = originalLoadVO;

await delay(0);
const skipButtonSource = await readFile(new URL('../src/ui/skipButton.js', import.meta.url), 'utf8');
assert.match(skipButtonSource, /Narrator\.onActiveLine\s*=/,
  'Skip UI must follow the full narrated-line lifetime, not audible transport only');
const josephSource = await readFile(new URL('../src/scenes/joseph3d/index.js', import.meta.url), 'utf8');
assert.match(josephSource, /const isScenePaused = \(\) => app\.paused \|\| document\.hidden;/,
  'Scene timers do not share the renderer hidden-tab pause predicate');
console.log('Scene lifetime and synchronous narration-skip checks passed.');
