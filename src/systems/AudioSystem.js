// Procedural WebAudio — every sound is synthesized, zero audio files (same
// rule as the visuals). One shared context, gentle gain staging, a soft
// echo "space" send for atmosphere, and ambient beds with slow LFO motion
// so the world feels alive but calm. Notes stay on a pentatonic scale so
// nothing the player triggers can ever sound sour.
//
// Engine-agnostic: no rendering-library imports. UI (volume slider/mute)
// lives in the DOM — see src/ui/volume.js.
const VOL_KEY = 'maranatha-volume';

// C-major pentatonic — always consonant.
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0];

class AudioSystem {
  constructor() {
    let saved = 0.8;
    try {
      const raw = localStorage.getItem(VOL_KEY);
      if (raw !== null) saved = Math.min(1, Math.max(0, parseFloat(raw)));
      if (Number.isNaN(saved)) saved = 0.8;
    } catch { /* ignore */ }
    this.volume = saved;
    this.lastVolume = saved > 0 ? saved : 0.8;
    this.ctx = null;
    this.master = null;
    this.space = null; // echo send bus
    this.music = null; // music sub-bus (emotional score)
    this.sfx = null;   // sfx sub-bus (ambient beds + one-shots + UI)
    this.channels = { music: 1, sfx: 1, voice: 1 }; // 0..1, driven by Settings
    this._pad = null;  // placeholder music pad (real loops arrive via manifest)
    this._padVoices = []; // carrier + detune-LFO ownership; every node is stoppable
    this._padOwner = 0;
    this._padStopTimer = null;
    this.samples = {}; // decoded real audio buffers, keyed by manifest key
    this._manifest = null;
    this._loaded = false;
    this._loadPromise = null;
    this.voiceBus = null; // real gain bus for file-based narration (live volume)
    this._voCache = {};   // decoded VO buffers / negative cache by url
    this.noiseBuf = null;
    this.amb = null; // procedural beds are created lazily, never at gain zero
    this._ambDesired = { wind: 0, night: 0 };
    this.birdTimer = null;
    this.birdLevel = 0; // desired level survives pause; the timer does not
    this.onMuted = null; // hook: the narrator stops mid-verse on mute
    this.onVoiceMuted = null; // narrator-channel zero owns the same teardown
    this.onVolume = null; // hook: DOM UI stays in sync
    this._liveLoops = new Map(); // key → live loop handle (double-start guard)
    this._liveOneShots = 0;      // simultaneous one-shot cap (phones die past ~dozens)
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // Battery care: stop the audio clock entirely when the tab is hidden
    // (looping ambience isn't throttled in background tabs otherwise).
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this._pauseMediaLoops();
        this.ctx.suspend().catch(() => {});
      }
      else this._resumeIfAppropriate();
    });
    // D8 phone hardening: a call / Siri / screen-lock leaves iOS Safari's
    // context 'interrupted' (a state the old 'suspended'-only checks never
    // matched — music and sfx just died). Focus/pageshow + any later tap now
    // all route through one resume that accepts every non-running state.
    window.addEventListener('focus', () => this._resumeIfAppropriate());
    window.addEventListener('pageshow', () => this._resumeIfAppropriate());
    // While true (the pause menu), nothing auto-resumes the context — not the
    // unlock listeners above, not a visibility flip. The pauser releases it.
    this.holdSuspend = false;
  }

  get enabled() {
    return this.volume > 0.004;
  }

  // The one gate for waking the context back up. Never fights the pause menu
  // (holdSuspend) or a hidden tab; accepts 'suspended' AND iOS 'interrupted'.
  _resumeIfAppropriate() {
    if (!this.ctx || !this.enabled || this.holdSuspend || document.hidden) {
      this._pauseMediaLoops();
      return;
    }
    if (this.ctx.state === 'running') {
      this._resumeMediaLoops();
      return;
    }
    Promise.resolve(this.ctx.resume()).then(() => {
      if (this.enabled && !this.holdSuspend && !document.hidden) this._resumeMediaLoops();
    }).catch(() => {});
  }

  get on() {
    return this.enabled && !!this.ctx;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9 * this.volume;
      this.master.connect(this.ctx.destination);

      // Sub-buses under master: music (score) and sfx (ambient beds + one-shots
      // + UI). The narrator ("voice") is speechSynthesis — a separate browser
      // output — so its level is applied per-utterance (voiceLevel), not here.
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.channels.sfx;
      this.sfx.connect(this.master);
      this.music = this.ctx.createGain();
      this.music.gain.value = this.channels.music;
      this.music.connect(this.master);
      this.voiceBus = this.ctx.createGain(); // file-based narration routes here
      this.voiceBus.gain.value = this.channels.voice;
      this.voiceBus.connect(this.master);

      // Space: a soft filtered feedback echo the one-shots are sent into.
      const delay = this.ctx.createDelay(1);
      delay.delayTime.value = 0.31;
      const fb = this.ctx.createGain();
      fb.gain.value = 0.32;
      const damp = this.ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 1400;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.4;
      delay.connect(damp).connect(fb).connect(delay);
      delay.connect(wet).connect(this.sfx);
      this.space = delay;

      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.buildAmbience();
      this.loadSamples(); // short one-shots only; long loops stream on demand
      // if the OS interrupts the context, recover as soon as policy allows
      this.ctx.addEventListener?.('statechange', () => {
        if (this.ctx.state === 'running') this._resumeIfAppropriate();
        else this._pauseMediaLoops();
      });
    }
    this._resumeIfAppropriate();
  }

  setVolume(v) {
    const wasEnabled = this.enabled;
    this.volume = Math.min(1, Math.max(0, v));
    if (this.volume > 0.004) this.lastVolume = this.volume;
    try { localStorage.setItem(VOL_KEY, String(this.volume)); } catch { /* ignore */ }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(0.9 * this.volume, this.ctx.currentTime, 0.06);
    }
    if (wasEnabled && !this.enabled) {
      // Mute means SILENCE: stop the narrator mid-verse (speech synthesis
      // is a separate output path the gain node can't touch), then suspend
      // the context so muted play doesn't burn battery.
      this.onMuted?.();
      setTimeout(() => {
        if (!this.enabled && this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      }, 180);
    } else if (!wasEnabled && this.enabled) {
      this._resumeIfAppropriate();
    }
    this.onVolume?.(this.volume);
  }

  toggleMute() {
    this.setVolume(this.enabled ? 0 : this.lastVolume);
  }

  // Per-channel level (0..1). Master is `volume`; music/sfx are sub-buses;
  // voice is baked into narrator utterances via voiceLevel.
  setChannel(name, v) {
    v = Math.min(1, Math.max(0, v));
    if (!(name in this.channels)) return;
    const was = this.channels[name];
    this.channels[name] = v;
    if (name === 'voice' && was > 0.004 && v <= 0.004) this.onVoiceMuted?.();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (name === 'sfx' && this.sfx) this.sfx.gain.setTargetAtTime(v, t, 0.05);
    if (name === 'music' && this.music) this.music.gain.setTargetAtTime(v, t, 0.05);
    if (name === 'voice' && this.voiceBus) this.voiceBus.gain.setTargetAtTime(v, t, 0.05);
    if (name === 'music' || name === 'sfx') this._syncMediaLoops(name);
  }

  // Effective narrator loudness = narrator channel × master. speechSynthesis
  // can't be gain-routed, so the Narrator bakes this into utterance.volume.
  get voiceLevel() {
    return this.volume * this.channels.voice;
  }

  // Placeholder emotional pad on the MUSIC bus so the Music slider is real and
  // scenes have a bed. Real loops drop in later via the audio manifest.
  // D7: the pad RETUNES — calling with a new chord glides the oscillators to
  // it (a sad bed used to come out sounding like the first chord ever built).
  musicPad(level = 0.03, chord = [130.81, 196.0, 261.63]) {
    if (!this.on || this.channels.music <= 0.004) return this._silentLoopHandle();
    if (this._padStopTimer) {
      clearTimeout(this._padStopTimer);
      this._padStopTimer = null;
    }
    const owner = ++this._padOwner;
    if (this._pad && this._padVoices.length === chord.length) {
      chord.forEach((f, i) => this._padVoices[i].carrier.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.9));
    } else {
      this._disposePadGraph();
      this._pad = this.ctx.createGain();
      this._pad.gain.value = 0;
      this._pad.connect(this.music);
      chord.forEach((f) => {
        const carrier = this.ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = f;
        const carrierGain = this.ctx.createGain();
        carrierGain.gain.value = 0.5 / chord.length;
        const lfo = this.ctx.createOscillator(); // slow detune shimmer = "alive"
        lfo.frequency.value = 0.05 + Math.random() * 0.05;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 1.4;
        lfo.connect(lfoGain).connect(carrier.detune);
        carrier.connect(carrierGain).connect(this._pad);
        carrier.start();
        lfo.start();
        this._padVoices.push({ carrier, carrierGain, lfo, lfoGain });
      });
    }
    this._setParam(this._pad.gain, level, 1.6);
    return {
      real: false,
      setGain: (v, seconds = 0.2) => {
        if (owner === this._padOwner && this._pad) this._setParam(this._pad.gain, v, seconds);
      },
      stop: (fade = 1.2) => this.stopMusic(fade, owner),
    };
  }

  stopMusic(fade = 1.2, owner = null) {
    if (!this._pad || !this.ctx || (owner !== null && owner !== this._padOwner)) return;
    if (this._padStopTimer) clearTimeout(this._padStopTimer);
    const capturedOwner = this._padOwner;
    this._setParam(this._pad.gain, 0, fade > 0 ? Math.max(0.01, fade / 3) : 0);
    if (fade <= 0) {
      this._disposePadGraph(capturedOwner);
      return;
    }
    this._padStopTimer = setTimeout(() => {
      this._padStopTimer = null;
      this._disposePadGraph(capturedOwner);
    }, fade * 1000 + 200);
  }

  _disposePadGraph(owner = null) {
    if (owner !== null && owner !== this._padOwner) return;
    if (this._padStopTimer) {
      clearTimeout(this._padStopTimer);
      this._padStopTimer = null;
    }
    for (const voice of this._padVoices) {
      try { voice.carrier.stop(); } catch { /* already stopped */ }
      try { voice.lfo.stop(); } catch { /* already stopped */ }
      try { voice.carrier.disconnect(); } catch { /* done */ }
      try { voice.carrierGain.disconnect(); } catch { /* done */ }
      try { voice.lfo.disconnect(); } catch { /* done */ }
      try { voice.lfoGain.disconnect(); } catch { /* done */ }
    }
    this._padVoices.length = 0;
    try { this._pad?.disconnect(); } catch { /* done */ }
    this._pad = null;
  }

  _setParam(param, value, seconds = 0.2) {
    if (!this.ctx || !param) return;
    if (seconds <= 0) {
      param.cancelScheduledValues?.(this.ctx.currentTime);
      param.setValueAtTime?.(value, this.ctx.currentTime);
      if (!param.setValueAtTime) param.value = value;
    } else {
      param.setTargetAtTime(value, this.ctx.currentTime, Math.max(0.001, seconds));
    }
  }

  // --- File-ready sound layer (see sound-design skill + audio manifest) -----
  registerManifest(list) {
    this._manifest = new Map(list.map((e) => [e.key, e]));
  }

  async loadSamples() {
    if (this._loadPromise) return this._loadPromise;
    if (!this._manifest || !this.ctx) return;
    this._loaded = true;
    // Long beds/score stay compressed and stream through HTMLMediaElement.
    // Only short latency-sensitive one-shots become resident AudioBuffers.
    this._loadPromise = Promise.all(
      [...this._manifest.values()]
        .filter((e) => e.bus !== 'voice' && !e.loop && e.available)
        // fetch the real file path (folder/name) when set, else the key
        .map(async (e) => { this.samples[e.key] = (await this._fetchDecode(e.file || e.key)) || null; }),
    );
    await this._loadPromise;
  }

  // Looping bed/music by manifest key. Real file → looped source with a live
  // gain handle. No file → the entry's procedural fallback (or SILENCE when
  // fallback is null — never junk noise). Returns { setGain, stop, real }.
  playLoop(key, { gain = 1 } = {}) {
    const e = this._manifest?.get(key);
    if (!e) return this._silentLoopHandle();

    // D8 double-start guard: pending, streamed, and fallback loops all share
    // the same key owner. Re-entry can never stack a second transport.
    const prev = this._liveLoops.get(key);
    if (prev) { this._liveLoops.delete(key); prev.stop(0.25); }

    // Only manifest-confirmed assets probe the network. Optional file slots
    // (`available:false`) must start their procedural fallback immediately.
    const base = e.available ? (e.file || e.key) : null;
    // Create a real transport whenever the WebAudio graph exists, even when
    // Master or this channel currently starts at zero. The transport itself
    // stays paused until audible; an entry-time mute must not permanently
    // downgrade a real file to fallback/silence for the whole scene.
    if (this.ctx && e.loop && base && typeof document?.createElement === 'function') {
      const streamed = this._createMediaLoop(key, e, base, gain);
      if (streamed) return streamed;
    }
    return this._createFallbackLoop(key, e, gain);
  }

  _createMediaLoop(key, entry, base, initialGain) {
    const media = document.createElement('audio');
    if (!media || typeof media.addEventListener !== 'function') return null;
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = Math.max(0, initialGain);
    let sourceNode;
    try {
      sourceNode = this.ctx.createMediaElementSource(media);
      const bus = entry.bus === 'music' ? this.music : this.sfx;
      sourceNode.connect(gainNode).connect(bus || this.master);
    } catch {
      try { gainNode.disconnect(); } catch { /* done */ }
      return null;
    }

    media.preload = 'metadata';
    media.loop = true;
    media.playsInline = true;
    const formats = entry.format ? [entry.format] : ['mp3', 'ogg', 'webm'];
    const candidates = formats.map((ext) => `audio/${base}.${ext}`);
    let candidate = 0;
    let state = 'pending'; // pending | media | fallback | stopped
    let desiredGain = Math.max(0, initialGain);
    let fallback = null;
    let pauseTimer = null;
    let stopTimer = null;
    let playPromise = null;

    const canTransportRun = () => this.enabled && this.channels[entry.bus] > 0.004 && !this.holdSuspend
      && !document.hidden && this.ctx?.state === 'running';
    const pauseTransport = () => {
      try { media.pause(); } catch { /* done */ }
    };
    const tryPlay = () => {
      if (state !== 'media' || desiredGain <= 0.004 || !canTransportRun()
        || !media.paused || playPromise) return;
      try {
        const result = media.play();
        if (result?.then) {
          playPromise = Promise.resolve(result).then(() => {
            playPromise = null;
            // A zero→positive change can race an already-pending play().
            // Re-check once after successful settlement; `media.paused` keeps
            // this from issuing redundant play calls during normal input.
            tryPlay();
          }, () => {
            // Autoplay rejection is not a missing file. The next unlock,
            // focus, pageshow, or AudioContext resume retries this handle.
            playPromise = null;
          });
        }
      } catch { /* retry at the next policy-safe resume */ }
    };
    const removeLoadListeners = () => {
      media.removeEventListener('canplay', onReady);
      media.removeEventListener('error', onError);
    };
    const releaseMedia = () => {
      removeLoadListeners();
      pauseTransport();
      try { media.removeAttribute('src'); media.load(); } catch { /* done */ }
      try { sourceNode.disconnect(); } catch { /* done */ }
      try { gainNode.disconnect(); } catch { /* done */ }
    };
    const activateFallback = () => {
      if (state === 'stopped') return;
      state = 'fallback';
      releaseMedia();
      fallback = this._makeFallback(entry, desiredGain);
    };
    const loadCandidate = () => {
      if (state === 'stopped') return;
      if (candidate >= candidates.length) { activateFallback(); return; }
      removeLoadListeners();
      media.addEventListener('canplay', onReady, { once: true });
      media.addEventListener('error', onError, { once: true });
      media.src = candidates[candidate++];
      try { media.load(); } catch { onError(); }
    };
    const onReady = () => {
      if (state !== 'pending') return;
      removeLoadListeners();
      state = 'media';
      if (entry.bus === 'music') this.stopMusic();
      tryPlay();
    };
    const onError = () => {
      if (state !== 'pending') return;
      loadCandidate();
    };

    const pauseAfter = (seconds) => {
      if (pauseTimer) clearTimeout(pauseTimer);
      if (seconds <= 0) { pauseTransport(); return; }
      pauseTimer = setTimeout(() => { pauseTimer = null; pauseTransport(); }, seconds * 3000 + 200);
    };
    const handle = {
      get real() { return state === 'media'; },
      setGain: (v, seconds = 0.2) => {
        if (state === 'stopped') return;
        desiredGain = Math.max(0, v);
        if (state === 'fallback') fallback?.setGain?.(desiredGain, seconds);
        else this._setParam(gainNode.gain, desiredGain, seconds);
        if (desiredGain > 0.004) {
          if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
          tryPlay();
        } else pauseAfter(seconds);
      },
      stop: (fade = 1.2) => {
        if (state === 'stopped') return;
        const wasPending = state === 'pending';
        const wasFallback = state === 'fallback';
        state = 'stopped';
        desiredGain = 0;
        if (this._liveLoops.get(key) === handle) this._liveLoops.delete(key);
        if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null; }
        if (wasFallback) fallback?.stop?.(fade);
        else this._setParam(gainNode.gain, 0, fade > 0 ? Math.max(0.01, fade / 3) : 0);
        const release = () => {
          stopTimer = null;
          releaseMedia();
        };
        if (fade <= 0 || wasPending || wasFallback) release();
        else stopTimer = setTimeout(release, fade * 1000 + 200);
      },
      _pauseTransport: () => {
        if (state === 'fallback') fallback?._pauseTransport?.();
        else pauseTransport();
      },
      _resumeTransport: () => {
        if (state === 'fallback') fallback?._resumeTransport?.();
        else tryPlay();
      },
      _syncTransport: () => {
        if (state === 'fallback') fallback?._syncTransport?.();
        else if (canTransportRun()) tryPlay();
        else pauseTransport();
      },
      _bus: entry.bus,
    };
    this._liveLoops.set(key, handle);
    loadCandidate();
    return handle;
  }

  _createFallbackLoop(key, entry, gain) {
    let stopped = false;
    const fallback = this._makeFallback(entry, gain);
    const handle = {
      real: false,
      setGain: (v, seconds = 0.2) => { if (!stopped) fallback.setGain?.(v, seconds); },
      stop: (fade = 1.2) => {
        if (stopped) return;
        stopped = true;
        if (this._liveLoops.get(key) === handle) this._liveLoops.delete(key);
        fallback.stop?.(fade);
      },
      _pauseTransport: () => fallback._pauseTransport?.(),
      _resumeTransport: () => fallback._resumeTransport?.(),
      _syncTransport: () => fallback._syncTransport?.(),
      _bus: entry.bus,
    };
    this._liveLoops.set(key, handle);
    return handle;
  }

  _makeFallback(entry, gain) {
    const fb = entry?.fallback;
    if (fb && typeof this[fb] === 'function') {
      return this[fb](gain) || this._silentLoopHandle();
    }
    return this._silentLoopHandle();
  }

  _silentLoopHandle() {
    return { real: false, setGain() {}, stop() {}, _pauseTransport() {}, _resumeTransport() {} };
  }

  _pauseMediaLoops() {
    for (const handle of this._liveLoops.values()) handle._pauseTransport?.();
    this._syncAmbient('wind', 0);
    this._syncAmbient('night', 0);
    this._stopBirdTimer();
  }

  _resumeMediaLoops() {
    for (const handle of this._liveLoops.values()) handle._resumeTransport?.();
    this._syncAmbient('wind', 0);
    this._syncAmbient('night', 0);
    this._syncBirdTimer();
  }

  _syncMediaLoops(bus) {
    for (const handle of this._liveLoops.values()) {
      if (handle._bus === bus) handle._syncTransport?.();
    }
    if (bus === 'sfx') {
      this._syncAmbient('wind', 0);
      this._syncAmbient('night', 0);
      this._syncBirdTimer();
    }
  }

  async _fetchDecode(key) {
    for (const ext of ['mp3', 'ogg', 'webm']) {
      try {
        const res = await fetch(`audio/${key}.${ext}`);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        return await this.ctx.decodeAudioData(arr);
      } catch { /* try next extension */ }
    }
    return null;
  }

  // Play a manifest sound by KEY: the real file if loaded, else the labeled
  // procedural placeholder. One-shot; routes to the entry's bus.
  play(key, { gain = 1 } = {}) {
    const e = this._manifest?.get(key);
    if (e?.loop) return this.playLoop(key, { gain });
    if (!e) {
      console.warn('[audio] unknown sound key', key);
      return;
    }
    const channel = e.bus === 'music' ? 'music' : 'sfx';
    // Muted one-shots cannot become audible later, so allocating their buffer
    // or fallback DSP only wastes CPU. Loops deliberately use a different
    // policy above because their transport must survive a later unmute.
    if (!this.on || this.channels[channel] <= 0.004) return;
    const buf = this.samples[key];
    if (buf) {
      // D8 phone care: cap simultaneous one-shot sources — a burst past a
      // couple dozen crackles/kills mobile audio. Extra plays are dropped
      // (a 15th overlapping footstep adds nothing anyway).
      if (this._liveOneShots >= 14) return;
      this._liveOneShots += 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      const bus = e?.bus === 'music' ? this.music : this.sfx;
      src.connect(g).connect(bus || this.master);
      src.onended = () => {
        this._liveOneShots = Math.max(0, this._liveOneShots - 1);
        try { src.disconnect(); } catch { /* done */ }
        try { g.disconnect(); } catch { /* done */ }
      };
      src.start();
      return;
    }
    const fb = e?.fallback;
    if (fb && typeof this[fb] === 'function') this[fb]();
  }

  // Procedural bed fallbacks named by the manifest (used until real loops drop
  // in). They just drive the existing procedural ambience / music systems.
  ambientCampBed(gain = 1) { return this._ambientHandle({ wind: 0.24, birds: 0.22 }, gain); }
  ambientNightBed(gain = 1) { return this._ambientHandle({ wind: 0.12, birds: 0, night: 0.5 }, gain); }
  musicWarmBed(gain = 1) { return this._musicHandle(0.03, [130.81, 196.0, 261.63], gain); }
  musicWonderBed(gain = 1) { return this._musicHandle(0.028, [146.83, 220.0, 293.66], gain); }
  // D7: the SAD bed — a low A-minor wash for the lonely walk to the tent
  // (a real music/sad_night.mp3 replaces it the moment Nate drops one in).
  // D9: louder — Nate couldn't hear it at all.
  musicSadBed(gain = 1) { return this._musicHandle(0.062, [110.0, 164.81, 220.0, 261.63], gain); }
  // D9: the DREAD bed — a low, uneasy minor cluster under the cold open's
  // betrayal (the open used to play in total silence; Nate missed tension).
  // A real music/betrayal_dark.mp3 takes over the moment it lands.
  // D11: louder still — "sometimes there is no music" = a bed nobody can hear.
  musicDreadBed(gain = 1) { return this._musicHandle(0.08, [55.0, 82.41, 110.0, 130.81], gain); }

  _musicHandle(baseLevel, chord, gain) {
    let requestedGain = Math.max(0, gain);
    let pad = null;
    let stopped = false;
    const canRun = () => !stopped && requestedGain > 0.004 && this.on
      && this.channels.music > 0.004 && this.ctx?.state === 'running'
      && !this.holdSuspend && !document.hidden;
    const release = (fade = 0) => {
      pad?.stop?.(fade);
      pad = null;
    };
    const sync = () => {
      if (!canRun()) { release(0); return; }
      if (!pad) pad = this.musicPad(baseLevel * requestedGain, chord);
      else pad.setGain(baseLevel * requestedGain, 0);
    };
    sync();
    return {
      real: false,
      setGain: (v, seconds = 0.2) => {
        requestedGain = Math.max(0, v);
        if (!canRun()) { release(0); return; }
        if (!pad) pad = this.musicPad(baseLevel * requestedGain, chord);
        else pad.setGain(baseLevel * requestedGain, seconds);
      },
      stop: (fade = 1.2) => { stopped = true; release(fade); },
      _pauseTransport: () => release(0),
      _resumeTransport: sync,
      _syncTransport: sync,
    };
  }

  _ambientHandle(base, gain) {
    const apply = (v, fade = 2.5) => {
      const level = Math.max(0, v);
      const values = {};
      if (base.wind !== undefined) values.wind = base.wind * level;
      if (base.night !== undefined) values.night = base.night * level;
      if (base.birds !== undefined) values.birds = base.birds * level;
      this.ambience(values, fade);
    };
    apply(gain, 0);
    return {
      real: false,
      setGain: (v, fade = 2.5) => apply(v, fade),
      stop: (fade = 1.2) => apply(0, fade),
    };
  }

  // --- Voice bus: real VO files play here so Master/Narrator are LIVE mid-line -
  // D7: failures are NOT cached — a single transient network blip used to
  // null-cache a verse forever, so its every later play fell back to TTS
  // ("the narrator turns into a robot at the end"). Only success is cached;
  // a miss simply retries on the next play.
  async decodeVO(url) {
    if (this._voCache[url]) return this._voCache[url];
    if (!this.ctx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
      this._voCache[url] = buf;
      return buf;
    } catch { return null; }
  }

  // Play a decoded VO buffer through the voice bus; returns the source so the
  // caller can stop() it (skip). Volume rides the live voiceBus × master gains.
  playVO(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.voiceBus || this.master);
    src.start();
    return src;
  }

  // A clearly-labeled PLACEHOLDER "voice" buffer (speech-cadence tone) so the
  // live-slider / skip demo works before real VO exists. NEVER shipped as final.
  voicePlaceholderBuffer(seconds = 4) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / rate;
      const syllable = Math.max(0, Math.sin(t * Math.PI * 3.2)); // ~1.6 syllables/s
      const f = 140 + 30 * Math.sin(t * 2.3);
      d[i] = Math.sin(2 * Math.PI * f * t) * syllable * 0.28;
    }
    return buf;
  }

  // --- Ambient beds: wind, water, night pad, birdsong ---------------------
  buildAmbience() {
    // D15 power: zero gain is not zero DSP. Beds are instantiated only when a
    // caller requests audible gain and are fully stopped after fading to zero.
    this.amb = { wind: null, night: null };
  }

  ambience(levels = {}, fade = 2.5) {
    if (levels.birds !== undefined) this.setBirds(levels.birds);
    if (levels.wind !== undefined) this._ambDesired.wind = levels.wind * 0.05;
    if (levels.night !== undefined) this._ambDesired.night = levels.night * 0.045;
    // Scene boot may request ambience before the first user gesture creates
    // WebAudio. Preserve that intent now; unlock() will build and sync it.
    if (!this.ctx || !this.amb) return;
    if (levels.wind !== undefined) this._syncAmbient('wind', fade);
    if (levels.night !== undefined) this._syncAmbient('night', fade);
  }

  _ambientCanRun() {
    return this.on && this.channels.sfx > 0.004 && this.ctx?.state === 'running'
      && !this.holdSuspend && !document.hidden;
  }

  _syncAmbient(kind, fade = 0) {
    if (!this.ctx || !this.amb) return;
    const target = this._ambientCanRun() ? this._ambDesired[kind] : 0;
    this._setAmbient(kind, target, fade);
  }

  _ensureAmbient(kind) {
    if (this.amb[kind]) return this.amb[kind];
    if (kind === 'wind') {
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuf;
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 0.6;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 70;
      lfo.connect(lfoGain).connect(filter.frequency);
      source.connect(filter).connect(gain).connect(this.sfx);
      source.start();
      lfo.start();
      this.amb.wind = { gain, source, filter, lfo, lfoGain, timer: null };
    } else {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.sfx);
      const voices = [55, 82.5].map((frequency) => {
        const oscillator = this.ctx.createOscillator();
        oscillator.frequency.value = frequency;
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.value = 0.5;
        oscillator.connect(voiceGain).connect(gain);
        oscillator.start();
        return { oscillator, voiceGain };
      });
      this.amb.night = { gain, voices, timer: null };
    }
    return this.amb[kind];
  }

  _setAmbient(kind, value, fade) {
    let part = this.amb[kind];
    if (value > 0.0001) part = this._ensureAmbient(kind);
    if (!part) return; // zero request must never instantiate silent DSP
    if (part.timer) { clearTimeout(part.timer); part.timer = null; }
    this._setParam(part.gain.gain, value, fade > 0 ? Math.max(0.01, fade / 3) : 0);
    if (value > 0.0001) return;
    if (fade <= 0) { this._disposeAmbient(kind, part); return; }
    part.timer = setTimeout(() => this._disposeAmbient(kind, part), fade * 1000 + 200);
  }

  _disposeAmbient(kind, part) {
    if (this.amb?.[kind] !== part) return;
    if (part.timer) clearTimeout(part.timer);
    if (kind === 'wind') {
      try { part.source.stop(); } catch { /* done */ }
      try { part.lfo.stop(); } catch { /* done */ }
      for (const node of [part.source, part.filter, part.gain, part.lfo, part.lfoGain]) {
        try { node.disconnect(); } catch { /* done */ }
      }
    } else {
      for (const voice of part.voices) {
        try { voice.oscillator.stop(); } catch { /* done */ }
        try { voice.oscillator.disconnect(); } catch { /* done */ }
        try { voice.voiceGain.disconnect(); } catch { /* done */ }
      }
      try { part.gain.disconnect(); } catch { /* done */ }
    }
    this.amb[kind] = null;
  }

  setBirds(level) {
    this.birdLevel = Math.max(0, level);
    this._syncBirdTimer();
  }

  _birdTimerCanRun() {
    return this.birdLevel > 0 && this.on && this.ctx?.state === 'running'
      && this.channels.sfx > 0.004 && !this.holdSuspend && !document.hidden;
  }

  _syncBirdTimer() {
    if (!this._birdTimerCanRun()) { this._stopBirdTimer(); return; }
    if (this.birdTimer) return;
    this.birdTimer = setInterval(() => {
      if (this._birdTimerCanRun() && Math.random() < this.birdLevel * 0.8) {
        this.chirp(0.25 + this.birdLevel * 0.35);
      }
    }, 1900);
  }

  _stopBirdTimer() {
    if (!this.birdTimer) return;
    clearInterval(this.birdTimer);
    this.birdTimer = null;
  }

  // --- Synthesis primitives (all route partly into the echo space) --------
  tone({ freq = 440, type = 'sine', dur = 0.5, attack = 0.02, release = 0.3, gain = 0.15, filter = 0, slideTo = 0, delay = 0, send = 0.3 }) {
    if (!this.on || this.channels.sfx <= 0.004) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t + dur);
    let node = o;
    if (filter) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      o.connect(f);
      node = f;
    }
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.linearRampToValueAtTime(0, t + attack + dur + release);
    node.connect(g).connect(this.sfx);
    if (send > 0 && this.space) {
      const sg = this.ctx.createGain();
      sg.gain.value = send;
      g.connect(sg).connect(this.space);
    }
    o.start(t);
    o.stop(t + attack + dur + release + 0.05);
  }

  noiseHit({ dur = 0.6, type = 'bandpass', from = 400, to = 0, q = 1, gain = 0.2, attack = 0.05, delay = 0, send = 0.15 }) {
    if (!this.on || this.channels.sfx <= 0.004) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(from, t);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    if (send > 0 && this.space) {
      const sg = this.ctx.createGain();
      sg.gain.value = send;
      g.connect(sg).connect(this.space);
    }
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // --- One-shots, tuned to feel like the story ----------------------------
  whooshUp() { this.noiseHit({ dur: 1.1, from: 220, to: 1200, gain: 0.1, attack: 0.3, q: 0.7 }); }
  whooshDown() { this.noiseHit({ dur: 1.2, from: 1000, to: 160, gain: 0.1, attack: 0.25, q: 0.7 }); }
  rumble(dur = 2.4) {
    this.noiseHit({ dur, type: 'lowpass', from: 110, gain: 0.14, attack: 0.5 });
    this.tone({ freq: 44, dur: dur * 0.7, attack: 0.4, release: 0.8, gain: 0.09, send: 0 });
  }
  splash() { this.noiseHit({ dur: 0.7, from: 600, to: 280, gain: 0.07, attack: 0.08, q: 0.6 }); }

  // Growth: a warm two-note pentatonic bloom + the faintest leaf rustle.
  grow() {
    const root = PENTA[Math.floor(Math.random() * PENTA.length)];
    this.tone({ freq: root, type: 'sine', dur: 0.1, attack: 0.02, release: 0.9, gain: 0.075, filter: 1800, send: 0.45 });
    this.tone({ freq: root * 1.5, type: 'sine', dur: 0.08, attack: 0.02, release: 0.8, gain: 0.04, delay: 0.09, send: 0.45 });
    this.noiseHit({ dur: 0.3, type: 'highpass', from: 2600, gain: 0.02, attack: 0.06, send: 0.2 });
  }
  growSmall() {
    const root = PENTA[Math.floor(Math.random() * PENTA.length)] * 2;
    this.tone({ freq: root, type: 'sine', dur: 0.06, attack: 0.015, release: 0.5, gain: 0.035, send: 0.4 });
  }

  sparkle(n = 4) {
    for (let i = 0; i < n; i++) {
      const f = PENTA[Math.floor(Math.random() * PENTA.length)] * 4;
      this.tone({ freq: f, type: 'sine', dur: 0.05, attack: 0.008, release: 0.7, gain: 0.035, delay: i * 0.09, send: 0.5 });
    }
  }
  godChord() {
    [110, 220, 277.18, 329.63, 440].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 1.8, attack: 0.6, release: 1.8, gain: f < 200 ? 0.05 : 0.04, delay: i * 0.07, filter: 1200, send: 0.5 }));
  }
  swellBright() {
    [261.63, 329.63, 392, 523.25].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 2.0, attack: 0.9, release: 1.6, gain: 0.035, delay: i * 0.06, send: 0.5 }));
    this.sparkle(3);
  }
  swellSoft() {
    [196, 246.94, 293.66].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 2.2, attack: 1.1, release: 1.8, gain: 0.032, delay: i * 0.09, send: 0.5 }));
  }
  chirp(gain = 0.5) {
    const base = 1700 + Math.random() * 700;
    this.tone({ freq: base, slideTo: base + 450, type: 'sine', dur: 0.07, attack: 0.01, release: 0.07, gain: 0.04 * gain, send: 0.35 });
    this.tone({ freq: base + 250, slideTo: base - 150, type: 'sine', dur: 0.06, attack: 0.01, release: 0.06, gain: 0.032 * gain, delay: 0.13, send: 0.35 });
  }
  blip() { this.tone({ freq: 300, slideTo: 180, type: 'sine', dur: 0.1, attack: 0.02, release: 0.18, gain: 0.045, send: 0.35 }); }
  thump() {
    this.tone({ freq: 90, slideTo: 55, type: 'sine', dur: 0.16, attack: 0.012, release: 0.3, gain: 0.12, send: 0.1 });
    this.noiseHit({ dur: 0.12, type: 'lowpass', from: 220, gain: 0.045, attack: 0.01 });
  }
  breath() { this.noiseHit({ dur: 3, type: 'bandpass', from: 350, to: 850, q: 0.6, gain: 0.06, attack: 1.4, send: 0.3 }); }
  bell() {
    [523.25, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 0.08, attack: 0.01, release: 2.2 - i * 0.5, gain: 0.045 / (i + 1), send: 0.55 }));
  }
  footstep() { this.noiseHit({ dur: 0.08, type: 'lowpass', from: 170, gain: 0.06, attack: 0.012, send: 0.05 }); }
  uiClick() { this.tone({ freq: 523.25, type: 'sine', dur: 0.035, attack: 0.005, release: 0.14, gain: 0.035, send: 0.2 }); }
}

export { AudioSystem };
export const Audio = new AudioSystem();
