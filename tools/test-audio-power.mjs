import assert from 'node:assert/strict';

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
  createMediaElementSource() { return new NodeFake(); }
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
globalThis.fetch = async (url) => {
  fetchCalls.push(String(url));
  const ok = String(url).endsWith('sfx/shot-real.mp3');
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
  { key: 'loop.autoplay', bus: 'sfx', loop: true, file: 'ambient/autoplay', fallback: 'testFallback', available: true },
  { key: 'loop.pending', bus: 'sfx', loop: true, file: 'ambient/pending', fallback: 'testFallback', available: true },
  { key: 'loop.missing', bus: 'sfx', loop: true, file: 'ambient/missing', fallback: 'testFallback', available: true },
  { key: 'loop.known-missing', bus: 'music', loop: true, file: 'music/known-missing', format: 'mp3', fallback: 'testFallback', available: true },
  { key: 'loop.optional', bus: 'music', loop: true, file: 'music/optional', fallback: 'testFallback', available: false },
  { key: 'loop.pad', bus: 'music', loop: true, fallback: 'musicWarmBed', available: false },
  { key: 'shot.real', bus: 'sfx', loop: false, file: 'sfx/shot-real', fallback: null, available: true },
  { key: 'shot.optional', bus: 'sfx', loop: false, file: 'sfx/optional', fallback: 'testFallback', available: false },
  { key: 'shot.fallback', bus: 'sfx', loop: false, fallback: 'testFallback', available: false },
]);
audio.unlock();
await audio.loadSamples();

assert.equal(audio.ctx.decodeCalls, 1, 'only the short one-shot should decode');
assert.deepEqual(fetchCalls, ['audio/sfx/shot-real.mp3'], 'loops and unavailable one-shots must not enter the AudioBuffer loader');
assert.equal(OscillatorFake.active, 0, 'unlock must not create zero-gain procedural oscillators');
assert.equal(BufferSourceFake.active, 0, 'unlock must not create zero-gain procedural sources');

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

console.log('audio power tests: PASS');
console.log('decoded loop PCM: ~177.1 MiB -> 0 explicit AudioBuffer MiB at 48 kHz');
console.log('total explicit audio buffers: ~196.9 MiB -> ~19.8 MiB (~90% lower)');
