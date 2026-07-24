import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function withWatchdog(promise, ms, message) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class EventTargetFake {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn, options = {}) {
    const list = this.listeners.get(type) || [];
    list.push({ fn, once: !!options?.once });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(type, list.filter((item) => item.fn !== fn));
  }
  dispatch(type) {
    const list = [...(this.listeners.get(type) || [])];
    for (const item of list) {
      if (item.once) this.removeEventListener(type, item.fn);
      item.fn({ type, target: this });
    }
  }
}

class ParamFake {
  constructor(value = 0) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}

class NodeFake {
  constructor() { this.disconnected = false; }
  connect(target) { return target; }
  disconnect() { this.disconnected = true; }
}

class OscillatorFake extends NodeFake {
  static active = 0;
  constructor() {
    super();
    this.frequency = new ParamFake();
    this.detune = new ParamFake();
    this.started = false;
    this.stopped = false;
  }
  start() { if (!this.started) { this.started = true; OscillatorFake.active += 1; } }
  stop() {
    if (this.started && !this.stopped) { this.stopped = true; OscillatorFake.active -= 1; }
  }
}

class BufferSourceFake extends NodeFake {
  static active = 0;
  constructor() {
    super();
    this.loop = false;
    this.buffer = null;
    this.started = false;
    this.stopped = false;
    this.onended = null;
  }
  start() { if (!this.started) { this.started = true; BufferSourceFake.active += 1; } }
  stop() {
    if (this.started && !this.stopped) { this.stopped = true; BufferSourceFake.active -= 1; }
  }
  end() { this.stop(); this.onended?.(); }
}

class MediaFake extends EventTargetFake {
  static instances = [];
  constructor() {
    super();
    this.preload = '';
    this.loop = false;
    this.playsInline = false;
    this.paused = true;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this.loadCalls = 0;
    this._src = '';
    this.srcHistory = [];
    this.rejectNextPlay = false;
    MediaFake.instances.push(this);
  }
  set src(value) { this._src = value; this.srcHistory.push(value); }
  get src() { return this._src; }
  load() { this.loadCalls += 1; }
  play() {
    this.playCalls += 1;
    if (this.rejectNextPlay) {
      this.rejectNextPlay = false;
      const error = new Error('autoplay blocked');
      error.name = 'NotAllowedError';
      return Promise.reject(error);
    }
    this.paused = false;
    return Promise.resolve();
  }
  pause() { this.pauseCalls += 1; this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}

class AudioContextFake extends EventTargetFake {
  constructor() {
    super();
    this.state = 'running';
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.destination = new NodeFake();
    this.decodeCalls = 0;
    this.bufferSources = [];
  }
  createGain() { const n = new NodeFake(); n.gain = new ParamFake(); return n; }
  createDelay() { const n = new NodeFake(); n.delayTime = new ParamFake(); return n; }
  createBiquadFilter() {
    const n = new NodeFake();
    n.frequency = new ParamFake();
    n.Q = new ParamFake();
    return n;
  }
  createOscillator() { return new OscillatorFake(); }
  createBufferSource() {
    const source = new BufferSourceFake();
    this.bufferSources.push(source);
    return source;
  }
  createMediaElementSource(media) {
    const source = new NodeFake();
    media.sourceNode = source;
    return source;
  }
  createBuffer(channels, length, rate) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate: rate,
      getChannelData: () => new Float32Array(length),
    };
  }
  async decodeAudioData() {
    this.decodeCalls += 1;
    return { numberOfChannels: 1, length: 4800, sampleRate: 48000 };
  }
  async suspend() { this.state = 'suspended'; this.dispatch('statechange'); }
  async resume() { this.state = 'running'; this.dispatch('statechange'); }
}

const windowEvents = new EventTargetFake();
windowEvents.AudioContext = AudioContextFake;
windowEvents.webkitAudioContext = null;
const documentEvents = new EventTargetFake();
documentEvents.hidden = false;
documentEvents.createElement = (tag) => {
  assert.equal(tag, 'audio', 'audio streaming must not allocate hidden DOM UI');
  return new MediaFake();
};

globalThis.window = windowEvents;
globalThis.document = documentEvents;
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const fetchCalls = [];
let hangVOFetch = false;
let shortSampleMode = 'normal';
let shortSampleAborts = 0;
globalThis.fetch = async (url, options = {}) => {
  fetchCalls.push(String(url));
  if (String(url).endsWith('audio/sfx/shot-retry.mp3')) {
    if (shortSampleMode === 'hang') {
      return {
        ok: true,
        arrayBuffer: () => new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            shortSampleAborts += 1;
            const error = new Error('sample body aborted');
            error.name = 'AbortError';
            reject(error);
          }, { once: true });
        }),
      };
    }
    if (shortSampleMode === 'success') {
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) };
    }
  }
  if (hangVOFetch && String(url).includes('audio/vo/')) {
    return new Promise((resolve, reject) => {
      options.signal?.addEventListener('abort', () => {
        const error = new Error('fetch aborted');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  }
  const ok = String(url).endsWith('sfx/shot-real.mp3') || String(url).includes('audio/vo/');
  return { ok, arrayBuffer: async () => new ArrayBuffer(16) };
};

const { AudioSystem } = await import('../src/systems/AudioSystem.js');
const coldAudio = new AudioSystem();
coldAudio.ambience({ wind: 0.8, night: 0.6, birds: 0.25 }, 0);
assert.ok(Math.abs(coldAudio._ambDesired.wind - 0.04) < 1e-9, 'pre-unlock wind intent must be retained');
assert.ok(Math.abs(coldAudio._ambDesired.night - 0.027) < 1e-9, 'pre-unlock night intent must be retained');
assert.equal(coldAudio.birdLevel, 0.25, 'pre-unlock bird intent must be retained');
coldAudio.unlock();
assert.ok(coldAudio.amb.wind, 'unlock must materialize the requested wind bed');
assert.ok(coldAudio.amb.night, 'unlock must materialize the requested night bed');
coldAudio.ambience({ wind: 0, night: 0, birds: 0 }, 0);
assert.equal(BufferSourceFake.active, 0);
assert.equal(OscillatorFake.active, 0);

const audio = new AudioSystem();
const fallbackEvents = [];
audio.testFallback = (gain) => {
  fallbackEvents.push({ type: 'start', gain });
  return {
    real: false,
    setGain(value) { fallbackEvents.push({ type: 'gain', gain: value }); },
    stop(fade) { fallbackEvents.push({ type: 'stop', fade }); },
  };
};

audio.registerManifest([
  { key: 'loop.real', bus: 'music', loop: true, file: 'music/loop-real', fallback: 'testFallback', available: true },
  { key: 'loop.retiring-music', bus: 'music', loop: true, file: 'music/retiring', fallback: 'testFallback', available: true },
  { key: 'loop.retiring-sfx', bus: 'sfx', loop: true, file: 'ambient/retiring', fallback: 'testFallback', available: true },
  { key: 'loop.autoplay', bus: 'sfx', loop: true, file: 'ambient/autoplay', fallback: 'testFallback', available: true },
  { key: 'loop.pending', bus: 'sfx', loop: true, file: 'ambient/pending', fallback: 'testFallback', available: true },
  { key: 'loop.missing', bus: 'sfx', loop: true, file: 'ambient/missing', fallback: 'testFallback', available: true },
  { key: 'loop.known-missing', bus: 'music', loop: true, file: 'music/known-missing', format: 'mp3', fallback: 'testFallback', available: true },
  { key: 'loop.optional', bus: 'music', loop: true, file: 'music/optional', fallback: 'testFallback', available: false },
  { key: 'loop.pad', bus: 'music', loop: true, fallback: 'musicWarmBed', available: false },
  { key: 'shot.real', bus: 'sfx', loop: false, file: 'sfx/shot-real', fallback: null, available: true },
  { key: 'shot.music', bus: 'music', loop: false, file: 'sfx/shot-real', fallback: null, available: false },
  { key: 'shot.optional', bus: 'sfx', loop: false, file: 'sfx/optional', fallback: 'testFallback', available: false },
  { key: 'shot.fallback', bus: 'sfx', loop: false, fallback: 'testFallback', available: false },
]);
audio.unlock();
await audio.loadSamples();

assert.equal(audio.ctx.decodeCalls, 1, 'only the available short one-shot should decode');
assert.deepEqual(fetchCalls, ['audio/sfx/shot-real.mp3'],
  'loops and unavailable one-shots must not enter the AudioBuffer loader');

// A response body/decode stall is bounded, releases shared load ownership, and
// the next authored use retries only the missing short sample.
const retryAudio = new AudioSystem();
retryAudio.ctx = new AudioContextFake();
retryAudio._sampleLoadTimeoutMs = 12;
retryAudio.registerManifest([
  { key: 'shot.retry', bus: 'sfx', loop: false, file: 'sfx/shot-retry', fallback: null, available: true },
]);
shortSampleMode = 'hang';
await withWatchdog(retryAudio.loadSamples(), 250, 'stalled short-sample load ignored its deadline');
assert.equal(shortSampleAborts, 1, 'short-sample deadline did not abort its fetch/body');
assert.equal(Boolean(retryAudio.samples['shot.retry']), false);
assert.equal(retryAudio._loadPromise, null, 'failed short-sample load permanently memoized its promise');

shortSampleMode = 'success';
retryAudio.play('shot.retry'); // authored use owns the retry; no idle polling
const retryWork = retryAudio._loadPromise;
assert.ok(retryWork, 'missing authored short sample did not start a retry');
await withWatchdog(retryWork, 250, 'short-sample retry did not settle');
assert.ok(retryAudio.samples['shot.retry'], 'transient short-sample failure never recovered');
assert.equal(retryAudio.ctx.decodeCalls, 1);
assert.equal(fetchCalls.filter((url) => url.endsWith('sfx/shot-retry.mp3')).length, 2,
  'short-sample retry did not refetch exactly once');
await retryAudio.loadSamples();
assert.equal(fetchCalls.filter((url) => url.endsWith('sfx/shot-retry.mp3')).length, 2,
  'resident short sample was fetched again');
shortSampleMode = 'normal';

// A streamed loop that emits neither readiness nor error must not suppress its
// procedural fallback or retain a hidden media decoder for the whole scene.
const stalledAudio = new AudioSystem();
const stalledFallbackEvents = [];
stalledAudio.testFallback = (gain) => {
  stalledFallbackEvents.push({ type: 'start', gain });
  return {
    setGain() {},
    stop(fade) { stalledFallbackEvents.push({ type: 'stop', fade }); },
  };
};
stalledAudio.registerManifest([
  {
    key: 'loop.stalled-load', bus: 'sfx', loop: true,
    file: 'ambient/stalled-load', format: 'mp3',
    fallback: 'testFallback', available: true,
  },
]);
stalledAudio.unlock();
stalledAudio._mediaReadyTimeoutMs = 12;
const stalledHandle = stalledAudio.playLoop('loop.stalled-load', { gain: 0.33 });
const stalledMedia = MediaFake.instances.at(-1);
await new Promise((resolve) => setTimeout(resolve, 20));
assert.deepEqual(stalledFallbackEvents, [{ type: 'start', gain: 0.33 }],
  'stalled streamed loop never activated its fallback');
assert.equal(stalledHandle.real, false);
assert.ok(stalledMedia.pauseCalls > 0, 'stalled streamed decoder was not paused');
assert.equal(stalledMedia.src, '', 'stalled streamed request retained its source');
assert.equal(stalledMedia.sourceNode.disconnected, true, 'stalled media source stayed connected');
assert.equal(stalledMedia.listeners.get('canplay')?.length ?? 0, 0);
assert.equal(stalledMedia.listeners.get('error')?.length ?? 0, 0);
stalledMedia.dispatch('canplay');
stalledMedia.dispatch('error');
assert.deepEqual(stalledFallbackEvents, [{ type: 'start', gain: 0.33 }],
  'late media events duplicated the fallback');
stalledHandle.stop(0);

// Reuse the decoded fixture to exercise a music-routed transient without
// adding another network/decode concern to this ownership-focused harness.
audio.samples['shot.music'] = audio.samples['shot.real'];
assert.equal(OscillatorFake.active, 0, 'unlock must not create zero-gain procedural oscillators');
assert.equal(BufferSourceFake.active, 0, 'unlock must not create zero-gain procedural sources');
assert.equal(audio.space, null, 'unlock must not create an idle feedback/echo graph');

// Narration preloads compressed bytes for offline reliability, but PCM is
// decoded just in time and bounded to two live buffers.
await audio.preloadVO('audio/vo/a.mp3');
assert.equal(audio.ctx.decodeCalls, 1, 'compressed VO preload must not decode PCM');
await audio.decodeVO('audio/vo/a.mp3');
await audio.decodeVO('audio/vo/b.mp3');
await audio.decodeVO('audio/vo/c.mp3');
assert.equal(audio._voCache.size, 2, 'decoded narrator cache exceeded two lines');
assert.deepEqual([...audio._voCache.keys()], ['audio/vo/b.mp3', 'audio/vo/c.mp3']);
assert.equal(fetchCalls.filter((url) => url === 'audio/vo/a.mp3').length, 1,
  'prefetched VO was fetched again during decode');

// Compressed narration is also byte-bounded and LRU, so visiting many future
// stories cannot retain every chapter for the life of the tab.
const byteCacheAudio = new AudioSystem();
byteCacheAudio._voByteBudget = 32;
await byteCacheAudio.preloadVO('audio/vo/lru-a.mp3');
await byteCacheAudio.preloadVO('audio/vo/lru-b.mp3');
await byteCacheAudio.preloadVO('audio/vo/lru-c.mp3');
assert.equal(byteCacheAudio._voByteTotal, 32);
assert.deepEqual([...byteCacheAudio._voBytes.keys()], [
  'audio/vo/lru-b.mp3',
  'audio/vo/lru-c.mp3',
], 'compressed VO byte cache did not evict its least-recently-used line');
await byteCacheAudio.preloadVO('audio/vo/lru-b.mp3'); // touch b
await byteCacheAudio.preloadVO('audio/vo/lru-d.mp3');
assert.deepEqual([...byteCacheAudio._voBytes.keys()], [
  'audio/vo/lru-b.mp3',
  'audio/vo/lru-d.mp3',
], 'compressed VO cache reads did not refresh LRU order');

// A stalled VO request must settle and release ownership instead of pinning
// the loader (and every later narration attempt) forever.
hangVOFetch = true;
const stalledStarted = performance.now();
assert.equal(await audio.preloadVO('audio/vo/stalled.mp3', { timeoutMs: 12 }), null);
assert.ok(performance.now() - stalledStarted < 250, 'stalled VO fetch ignored its timeout');
assert.equal(audio._voFetchPending.has('audio/vo/stalled.mp3'), false);
hangVOFetch = false;

// Caller cancellation settles immediately while the bounded shared fetch is
// still allowed to finish/cache for a later scene.
hangVOFetch = true;
const voAbort = new AbortController();
const cancelledPreload = audio.preloadVO('audio/vo/cancelled.mp3', {
  signal: voAbort.signal,
  timeoutMs: 12,
});
voAbort.abort(Object.assign(new Error('line skipped'), { name: 'AbortError' }));
await assert.rejects(cancelledPreload, { name: 'AbortError' });
await new Promise((resolve) => setTimeout(resolve, 20));
assert.equal(audio._voFetchPending.has('audio/vo/cancelled.mp3'), false);
hangVOFetch = false;

// Corrupt compressed bytes are evicted. A later attempt must refetch instead
// of repeatedly feeding the same poison payload to decodeAudioData().
const originalDecode = audio.ctx.decodeAudioData.bind(audio.ctx);
let rejectDecode = true;
audio.ctx.decodeAudioData = async (...args) => {
  audio.ctx.decodeCalls += 1;
  if (rejectDecode) {
    rejectDecode = false;
    throw new Error('corrupt mp3');
  }
  return { numberOfChannels: 1, length: 4800, sampleRate: 48000 };
};
const corruptUrl = 'audio/vo/corrupt.mp3';
assert.equal(await audio.decodeVO(corruptUrl), null);
assert.equal(audio._voBytes.has(corruptUrl), false, 'corrupt compressed VO remained cached');
assert.ok(await audio.decodeVO(corruptUrl), 'clean retry did not decode');
assert.equal(fetchCalls.filter((url) => url === corruptUrl).length, 2,
  'corrupt VO retry reused stale bytes instead of refetching');
audio.ctx.decodeAudioData = originalDecode;

const mediaBeforeOptional = MediaFake.instances.length;
const optionalHandle = audio.playLoop('loop.optional', { gain: 0.6 });
assert.equal(MediaFake.instances.length, mediaBeforeOptional, 'unavailable slots must not probe three missing media files');
assert.deepEqual(fallbackEvents, [{ type: 'start', gain: 0.6 }], 'unavailable slots start fallback immediately');
optionalHandle.stop(0);
fallbackEvents.length = 0;

audio.setVolume(0);
const mutedEntryMediaCount = MediaFake.instances.length;
const mutedEntryHandle = audio.playLoop('loop.real', { gain: 0.45 });
assert.equal(MediaFake.instances.length, mutedEntryMediaCount + 1,
  'a real loop entered while Master is zero must still prepare its compressed transport');
const mutedEntryMedia = MediaFake.instances.at(-1);
mutedEntryMedia.dispatch('canplay');
await Promise.resolve();
assert.equal(mutedEntryMedia.playCalls, 0, 'muted entry keeps the prepared decoder asleep');
assert.equal(mutedEntryHandle.real, true, 'muted entry retains the real transport instead of fallback');
audio.setVolume(0.8);
await Promise.resolve();
assert.equal(mutedEntryMedia.playCalls, 1, 'unmuting resumes the real loop without a scene restart');
mutedEntryHandle.stop(0);

const zeroHandle = audio.playLoop('loop.real', { gain: 0 });
const zeroMedia = MediaFake.instances.at(-1);
zeroMedia.dispatch('canplay');
await Promise.resolve();
assert.equal(zeroMedia.playCalls, 0, 'a zero-gain loop must not start its decoder');
zeroHandle.setGain(0.5, 0);
await Promise.resolve();
assert.equal(zeroMedia.playCalls, 1, 'an audible loop starts exactly once');
assert.equal(zeroHandle.real, true);
zeroHandle.setGain(0, 0);
assert.equal(zeroMedia.paused, true, 'returning to zero gain pauses the decoder');
zeroHandle.setGain(0.5, 0);
await Promise.resolve();
assert.equal(zeroMedia.playCalls, 2, 'raising a paused live loop resumes it without rebuilding');
await Promise.resolve();
audio.setChannel('music', 0);
assert.equal(zeroMedia.paused, true, 'a zero channel slider pauses its streamed decoders');
audio.setChannel('music', 1);
await Promise.resolve();
assert.equal(zeroMedia.paused, false, 'raising the channel slider resumes its live music');

audio.holdSuspend = true;
await audio.ctx.suspend();
assert.equal(zeroMedia.paused, true, 'pause must pause streamed media, not only its gain bus');
audio.holdSuspend = false;
await audio.ctx.resume();
await Promise.resolve();
assert.equal(zeroMedia.paused, false, 'resume restarts an audible live loop');

audio.setVolume(0);
await new Promise((resolve) => setTimeout(resolve, 210));
assert.equal(audio.ctx.state, 'suspended', 'master mute suspends the audio clock');
assert.equal(zeroMedia.paused, true, 'master mute pauses compressed media transports');
audio.setVolume(0.8);
await Promise.resolve();
assert.equal(audio.ctx.state, 'running');
assert.equal(zeroMedia.paused, false, 'unmute resumes only the audible live transport');

audio.setBirds(0.5);
assert.ok(audio.birdTimer, 'audible fallback birds own one timer');
audio.holdSuspend = true;
await audio.ctx.suspend();
assert.equal(audio.birdTimer, null, 'pause stops the bird timer instead of waking a suspended clock');
assert.equal(audio.birdLevel, 0.5, 'pause preserves the requested ambience level');
audio.holdSuspend = false;
await audio.ctx.resume();
assert.ok(audio.birdTimer, 'resume restores the one requested bird timer');
audio.setChannel('sfx', 0);
assert.equal(audio.birdTimer, null, 'a zero SFX slider stops procedural timer wakeups');
audio.setChannel('sfx', 1);
assert.ok(audio.birdTimer);
audio.setBirds(0);
assert.equal(audio.birdTimer, null);

const autoplayHandle = audio.playLoop('loop.autoplay', { gain: 0.4 });
const autoplayMedia = MediaFake.instances.at(-1);
autoplayMedia.rejectNextPlay = true;
autoplayMedia.dispatch('canplay');
await Promise.resolve();
await Promise.resolve();
assert.equal(autoplayMedia.playCalls, 1);
assert.equal(fallbackEvents.length, 0, 'autoplay rejection must not masquerade as a missing file');
audio.unlock();
await Promise.resolve();
assert.equal(autoplayMedia.playCalls, 2, 'the next unlock retries autoplay-blocked media');
assert.equal(autoplayMedia.paused, false);

const pendingHandle = audio.playLoop('loop.pending', { gain: 1 });
const pendingMedia = MediaFake.instances.at(-1);
pendingHandle.stop(0);
pendingMedia.dispatch('canplay');
pendingMedia.dispatch('error');
await Promise.resolve();
assert.equal(pendingMedia.playCalls, 0, 'a stopped pending loop can never start later');
assert.equal(fallbackEvents.length, 0, 'a stopped pending loop can never activate fallback later');

// A streamed loop leaves the live-key map as soon as its fade begins, but
// remains globally owned until release. A channel mute must immediately free
// only that bus's detached decoders, while scene teardown still frees all.
const retiringMusicHandle = audio.playLoop('loop.retiring-music', { gain: 0.4 });
const retiringMusicMedia = MediaFake.instances.at(-1);
retiringMusicMedia.dispatch('canplay');
await Promise.resolve();
const retiringSfxHandle = audio.playLoop('loop.retiring-sfx', { gain: 0.4 });
const retiringSfxMedia = MediaFake.instances.at(-1);
retiringSfxMedia.dispatch('canplay');
await Promise.resolve();
retiringMusicHandle.stop(1.4);
retiringSfxHandle.stop(1.4);
assert.ok(audio._retiringLoops.has(retiringMusicHandle), 'fading music loop lost global teardown ownership');
assert.ok(audio._retiringLoops.has(retiringSfxHandle), 'fading SFX loop lost global teardown ownership');

audio.setChannel('music', 0);
assert.equal(audio._retiringLoops.has(retiringMusicHandle), false,
  'music mute retained a retiring music decoder through its fade deadline');
assert.equal(retiringMusicMedia.src, '', 'music mute retained retiring media resource bytes');
assert.ok(audio._retiringLoops.has(retiringSfxHandle),
  'music mute incorrectly released an unrelated SFX retirement');
assert.notEqual(retiringSfxMedia.src, '', 'music mute cleared an unrelated SFX media resource');
audio.setChannel('music', 1);

audio.setChannel('sfx', 0);
assert.equal(audio._retiringLoops.has(retiringSfxHandle), false,
  'SFX mute retained a retiring SFX decoder through its fade deadline');
assert.equal(retiringSfxMedia.src, '', 'SFX mute retained retiring media resource bytes');
audio.setChannel('sfx', 1);

const retiringHandle = audio.playLoop('loop.retiring-music', { gain: 0.4 });
const retiringMedia = MediaFake.instances.at(-1);
retiringMedia.dispatch('canplay');
await Promise.resolve();
retiringHandle.stop(1.4);
audio.stopOneShots();
assert.equal(audio._retiringLoops.size, 0, 'scene teardown retained a streamed retirement');
assert.equal(retiringMedia.paused, true, 'scene teardown left a retiring media decoder running');
assert.equal(retiringMedia.src, '', 'scene teardown retained retiring media resource bytes');

const missingHandle = audio.playLoop('loop.missing', { gain: 0.35 });
const missingMedia = MediaFake.instances.at(-1);
missingMedia.dispatch('error'); // mp3 -> ogg
missingMedia.dispatch('error'); // ogg -> webm
missingMedia.dispatch('error'); // webm -> procedural fallback
assert.deepEqual(fallbackEvents[0], { type: 'start', gain: 0.35 });
missingHandle.setGain(0.2, 0);
missingHandle.stop(0);
assert.deepEqual(fallbackEvents.slice(1), [{ type: 'gain', gain: 0.2 }, { type: 'stop', fade: 0 }]);

fallbackEvents.length = 0;
const knownMissingHandle = audio.playLoop('loop.known-missing', { gain: 0.3 });
const knownMissingMedia = MediaFake.instances.at(-1);
assert.equal(knownMissingMedia.loadCalls, 1);
knownMissingMedia.dispatch('error');
assert.deepEqual(knownMissingMedia.srcHistory.filter(Boolean), ['audio/music/known-missing.mp3'],
  'known MP3 slots must not probe nonexistent alternate formats');
assert.deepEqual(fallbackEvents[0], { type: 'start', gain: 0.3 });
knownMissingHandle.stop(0);
fallbackEvents.length = 0;

zeroHandle.stop(0);
autoplayHandle.stop(0);
assert.equal(audio._liveLoops.size, 0, 'all loop transports release their key ownership');

const padLoop = audio.playLoop('loop.pad', { gain: 1 });
assert.equal(OscillatorFake.active, 6, 'a three-voice fallback owns three carriers + three LFOs');
audio.setChannel('music', 0);
assert.equal(OscillatorFake.active, 0, 'music channel zero disposes the fallback graph');
audio.setChannel('music', 1);
assert.equal(OscillatorFake.active, 6, 'music channel restore recreates the fallback at requested gain');
padLoop.stop(0);
assert.equal(OscillatorFake.active, 0);

for (let i = 0; i < 50; i += 1) {
  const count = i % 2 ? 3 : 4;
  audio.musicPad(0.04, Array.from({ length: count }, (_, n) => 100 + n * 30));
  assert.equal(OscillatorFake.active, count * 2, 'only current carriers + LFOs may remain active');
}
audio.stopMusic(0);
assert.equal(OscillatorFake.active, 0, 'stopMusic must stop carriers and detune LFOs');

assert.equal(audio.amb.wind, null);
audio.ambience({ wind: 1, night: 1 }, 0);
assert.equal(BufferSourceFake.active, 1, 'positive wind gain lazily creates one source');
assert.equal(OscillatorFake.active, 3, 'wind LFO + two night carriers are the complete SFX graph');
audio.setChannel('sfx', 0);
assert.equal(BufferSourceFake.active, 0);
assert.equal(OscillatorFake.active, 0, 'SFX channel zero fully disposes procedural DSP');
audio.setChannel('sfx', 1);
assert.equal(BufferSourceFake.active, 1);
assert.equal(OscillatorFake.active, 3, 'SFX channel restore recreates requested wind/night only');
audio.ambience({ wind: 0, night: 0 }, 0);
assert.equal(BufferSourceFake.active, 0);
assert.equal(OscillatorFake.active, 0);

audio.setChannel('sfx', 0);
const mutedSourceCount = audio.ctx.bufferSources.length;
const mutedFallbackCount = fallbackEvents.length;
audio.play('shot.real');
audio.play('shot.fallback');
audio.footstep();
audio.uiClick();
assert.equal(audio.ctx.bufferSources.length, mutedSourceCount,
  'muted SFX must not allocate real or procedural one-shot sources');
assert.equal(OscillatorFake.active, 0, 'muted SFX must not allocate procedural oscillators');
assert.equal(fallbackEvents.length, mutedFallbackCount, 'muted SFX must not invoke one-shot fallbacks');
audio.setChannel('sfx', 1);

audio.play('shot.real');
const oneShot = audio.ctx.bufferSources.at(-1);
oneShot.end();
assert.equal(oneShot.disconnected, true, 'finished one-shots disconnect from the graph');
assert.equal(audio._liveOneShots, 0);

// Active real and procedural transients carry their bus. Channel mute releases
// only matching ownership; the global cap and other bus remain live.
audio.play('shot.real');
const sfxOneShot = audio.ctx.bufferSources.at(-1);
audio.play('shot.music');
const musicOneShot = audio.ctx.bufferSources.at(-1);
audio.uiClick();
assert.deepEqual([...audio._activeOneShots].map((entry) => entry.bus).sort(), ['music', 'sfx', 'sfx']);
assert.equal(audio._liveOneShots, 2, 'real one-shot cap count did not include both buses');
assert.ok(audio.space, 'procedural SFX did not own its echo graph');

audio.setChannel('sfx', 0);
assert.equal(sfxOneShot.stopped, true, 'SFX mute left an active SFX source running');
assert.equal(sfxOneShot.disconnected, true, 'SFX mute left an active SFX graph connected');
assert.equal(musicOneShot.stopped, false, 'SFX mute stopped an unrelated music one-shot');
assert.equal(musicOneShot.disconnected, false, 'SFX mute disconnected an unrelated music graph');
assert.deepEqual([...audio._activeOneShots].map((entry) => entry.bus), ['music']);
assert.equal(audio._liveOneShots, 1, 'filtered SFX teardown reset the surviving music cap count');
assert.equal(audio.space, null, 'SFX mute retained its procedural echo graph');

audio.setChannel('sfx', 1);
audio.play('shot.real');
const survivingSfxOneShot = audio.ctx.bufferSources.at(-1);
audio.uiClick();
assert.equal(audio._activeOneShots.size, 3);
assert.ok(audio.space);
audio.setChannel('music', 0);
assert.equal(musicOneShot.stopped, true, 'music mute left an active music source running');
assert.equal(musicOneShot.disconnected, true, 'music mute left an active music graph connected');
assert.equal(survivingSfxOneShot.stopped, false, 'music mute stopped an unrelated SFX one-shot');
assert.equal(survivingSfxOneShot.disconnected, false, 'music mute disconnected an unrelated SFX graph');
assert.ok([...audio._activeOneShots].every((entry) => entry.bus === 'sfx'));
assert.equal(audio._liveOneShots, 1, 'filtered music teardown reset the surviving SFX cap count');
assert.ok(audio.space, 'music mute disposed the unrelated SFX echo graph');

audio.setChannel('music', 1);
audio.setVolume(0);
assert.equal(survivingSfxOneShot.stopped, true, 'master mute left a surviving SFX source running');
assert.equal(survivingSfxOneShot.disconnected, true, 'master mute left a surviving SFX graph connected');
assert.equal(audio._activeOneShots.size, 0, 'master mute did not release every bus');
assert.equal(audio._liveOneShots, 0, 'master mute did not reset the global one-shot cap');
assert.equal(audio.space, null, 'master mute retained the SFX echo graph');
audio.setVolume(0.8);
await Promise.resolve();

audio.uiClick();
assert.ok(audio.space, 'an audible procedural send should lazily create echo space');
assert.ok(audio._activeOneShots.size > 0, 'procedural one-shot has no teardown owner');
audio._touchSpace(10);
const longTailDeadline = audio._spaceDeadline;
audio._touchSpace(0.5);
assert.equal(audio._spaceDeadline, longTailDeadline,
  'a shorter later sound truncated an earlier long echo tail');
audio.stopOneShots();
assert.equal(audio._activeOneShots.size, 0);
assert.equal(audio.space, null, 'idle echo graph must be fully disposable');

const generatorSource = await readFile(new URL('./make-vo.mjs', import.meta.url), 'utf8');
assert.match(generatorSource, /\bmkdtemp\(/, 'VO generation must use a unique temporary directory');
assert.match(generatorSource, /\.previous-/, 'VO generation must preserve a recoverable last-good backup');
assert.doesNotMatch(generatorSource, /rm\(outFile,\s*\{\s*force:\s*true\s*\}\)/,
  'VO generation must not delete the last-good file before replacement succeeds');

console.log('audio power tests: PASS');
console.log('decoded loop PCM: ~177.1 MiB -> 0 explicit AudioBuffer MiB at 48 kHz');
console.log('narrator PCM: all lines retained -> at most 2 decoded lines; compressed bytes remain prefetched');
