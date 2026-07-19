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
    this.samples = {}; // decoded real audio buffers, keyed by manifest key
    this._manifest = null;
    this._loaded = false;
    this.voiceBus = null; // real gain bus for file-based narration (live volume)
    this._voCache = {};   // decoded VO buffers / negative cache by url
    this.noiseBuf = null;
    this.amb = null;
    this.birdTimer = null;
    this.onMuted = null; // hook: the narrator stops mid-verse on mute
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
      if (document.hidden) this.ctx.suspend().catch(() => {});
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
    if (!this.ctx || !this.enabled || this.holdSuspend || document.hidden) return;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
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
      this.loadSamples(); // fetch any real files marked available (none → no-op)
      // if the OS interrupts the context, recover as soon as policy allows
      this.ctx.addEventListener?.('statechange', () => this._resumeIfAppropriate());
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
    } else if (!wasEnabled && this.enabled && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
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
    this.channels[name] = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (name === 'sfx' && this.sfx) this.sfx.gain.setTargetAtTime(v, t, 0.05);
    if (name === 'music' && this.music) this.music.gain.setTargetAtTime(v, t, 0.05);
    if (name === 'voice' && this.voiceBus) this.voiceBus.gain.setTargetAtTime(v, t, 0.05);
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
    if (!this.on) return;
    if (this._pad && this._padOscs?.length === chord.length) {
      chord.forEach((f, i) => this._padOscs[i].frequency.setTargetAtTime(f, this.ctx.currentTime, 0.9));
      this._pad.gain.setTargetAtTime(level, this.ctx.currentTime, 1.6);
      return;
    }
    if (this._pad && this._padOscs) {
      // different voice count — rebuild cleanly
      this._padOscs.forEach((o) => { try { o.stop(); } catch { /* done */ } });
      try { this._pad.disconnect(); } catch { /* done */ }
      this._pad = null;
    }
    if (!this._pad) {
      this._pad = this.ctx.createGain();
      this._padOscs = [];
      this._pad.gain.value = 0;
      this._pad.connect(this.music);
      chord.forEach((f) => {
        const o = this.ctx.createOscillator();
        this._padOscs.push(o);
        o.type = 'sine';
        o.frequency.value = f;
        const og = this.ctx.createGain();
        og.gain.value = 0.5 / chord.length;
        const lfo = this.ctx.createOscillator(); // slow detune shimmer = "alive"
        lfo.frequency.value = 0.05 + Math.random() * 0.05;
        const lg = this.ctx.createGain();
        lg.gain.value = 1.4;
        lfo.connect(lg).connect(o.detune);
        o.connect(og).connect(this._pad);
        o.start();
        lfo.start();
      });
    }
    this._pad.gain.setTargetAtTime(level, this.ctx.currentTime, 1.6);
  }

  stopMusic() {
    if (this._pad && this.ctx) this._pad.gain.setTargetAtTime(0, this.ctx.currentTime, 1.2);
  }

  // --- File-ready sound layer (see sound-design skill + audio manifest) -----
  registerManifest(list) {
    this._manifest = new Map(list.map((e) => [e.key, e]));
  }

  async loadSamples() {
    if (this._loaded || !this._manifest || !this.ctx) return;
    this._loaded = true;
    // DROP-AND-GO: try to load EVERY non-voice sound by name — no manifest
    // editing needed. Missing files 404 once (harmless), are negatively cached
    // as null, and fall back to the labeled procedural placeholder or silence.
    // Voice VO is handled by the Narrator's own file-first loader.
    await Promise.all(
      [...this._manifest.values()]
        .filter((e) => e.bus !== 'voice')
        // fetch the real file path (folder/name) when set, else the key
        .map(async (e) => { this.samples[e.key] = (await this._fetchDecode(e.file || e.key)) || null; }),
    );
  }

  // Looping bed/music by manifest key. Real file → looped source with a live
  // gain handle. No file → the entry's procedural fallback (or SILENCE when
  // fallback is null — never junk noise). Returns { setGain, stop, real }.
  playLoop(key, { gain = 1 } = {}) {
    const e = this._manifest?.get(key);
    const buf = this.samples[key];
    if (this.on && buf) {
      // a REAL music loop takes over from any procedural pad still humming
      // (a fallback bed's stub handle can't stop the pad itself — D7)
      if (e?.bus === 'music') this.stopMusic();
      // D8 double-start guard: one live source per key, ever. A re-entered
      // scene (or a racing navigate) must never STACK the same bed twice —
      // the older copy fades out fast and the new one owns the key.
      const prev = this._liveLoops.get(key);
      if (prev) { this._liveLoops.delete(key); prev.stop(0.25); }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = gain;
      const bus = e?.bus === 'music' ? this.music : this.sfx;
      src.connect(g).connect(bus || this.master);
      src.start();
      const handle = {
        real: true,
        setGain: (v, s = 0.2) => g.gain.setTargetAtTime(v, this.ctx.currentTime, s),
        stop: (fade = 1.2) => {
          if (this._liveLoops.get(key) === handle) this._liveLoops.delete(key);
          g.gain.setTargetAtTime(0, this.ctx.currentTime, fade / 3);
          setTimeout(() => { try { src.stop(); } catch { /* done */ } }, fade * 1000 + 200);
        },
      };
      this._liveLoops.set(key, handle);
      return handle;
    }
    const fb = e?.fallback;
    if (fb && typeof this[fb] === 'function') this[fb]();
    return { real: false, setGain() {}, stop() {} };
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
    const buf = this.samples[key];
    if (this.on && buf) {
      // D8 phone care: cap simultaneous one-shot sources — a burst past a
      // couple dozen crackles/kills mobile audio. Extra plays are dropped
      // (a 15th overlapping footstep adds nothing anyway).
      if (this._liveOneShots >= 14) return;
      this._liveOneShots += 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.onended = () => { this._liveOneShots = Math.max(0, this._liveOneShots - 1); };
      const g = this.ctx.createGain();
      g.gain.value = gain;
      const bus = e?.bus === 'music' ? this.music : this.sfx;
      src.connect(g).connect(bus || this.master);
      src.start();
      return;
    }
    const fb = e?.fallback;
    if (fb && typeof this[fb] === 'function') this[fb]();
    else if (!e) console.warn('[audio] unknown sound key', key);
  }

  // Procedural bed fallbacks named by the manifest (used until real loops drop
  // in). They just drive the existing procedural ambience / music systems.
  ambientCampBed() { this.ambience({ wind: 0.24, birds: 0.22 }); }
  ambientNightBed() { this.ambience({ wind: 0.12, birds: 0, night: 0.5 }); }
  musicWarmBed() { this.musicPad(0.03, [130.81, 196.0, 261.63]); }
  musicWonderBed() { this.musicPad(0.028, [146.83, 220.0, 293.66]); }
  // D7: the SAD bed — a low A-minor wash for the lonely walk to the tent
  // (a real music/sad_night.mp3 replaces it the moment Nate drops one in).
  // D9: louder — Nate couldn't hear it at all.
  musicSadBed() { this.musicPad(0.062, [110.0, 164.81, 220.0, 261.63]); }
  // D9: the DREAD bed — a low, uneasy minor cluster under the cold open's
  // betrayal (the open used to play in total silence; Nate missed tension).
  // A real music/betrayal_dark.mp3 takes over the moment it lands.
  musicDreadBed() { this.musicPad(0.055, [55.0, 82.41, 110.0, 130.81]); }

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
    const mkNoiseBed = (type, freq, q) => {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const filt = this.ctx.createBiquadFilter();
      filt.type = type;
      filt.frequency.value = freq;
      filt.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      src.connect(filt).connect(g).connect(this.sfx);
      src.start();
      return { filt, g };
    };
    this.amb = {
      wind: mkNoiseBed('lowpass', 300, 0.6),
      water: mkNoiseBed('bandpass', 480, 0.8),
    };
    const lfo = (rate, depth, target) => {
      const o = this.ctx.createOscillator();
      o.frequency.value = rate;
      const og = this.ctx.createGain();
      og.gain.value = depth;
      o.connect(og).connect(target);
      o.start();
    };
    lfo(0.07, 70, this.amb.wind.filt.frequency);
    lfo(0.13, 170, this.amb.water.filt.frequency);
    const pg = this.ctx.createGain();
    pg.gain.value = 0;
    [55, 82.5].forEach((f) => {
      const o = this.ctx.createOscillator();
      o.frequency.value = f;
      const og = this.ctx.createGain();
      og.gain.value = 0.5;
      o.connect(og).connect(pg);
      o.start();
    });
    pg.connect(this.sfx);
    this.amb.night = { g: pg };
  }

  ambience(levels = {}, fade = 2.5) {
    if (levels.birds !== undefined) this.setBirds(levels.birds);
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    const set = (g, v) => g.gain.setTargetAtTime(v, t, fade / 3);
    if (levels.wind !== undefined) set(this.amb.wind.g, levels.wind * 0.05);
    if (levels.water !== undefined) set(this.amb.water.g, levels.water * 0.045);
    if (levels.night !== undefined) set(this.amb.night.g, levels.night * 0.045);
  }

  setBirds(level) {
    if (this.birdTimer) {
      clearInterval(this.birdTimer);
      this.birdTimer = null;
    }
    if (level > 0) {
      this.birdTimer = setInterval(() => {
        if (this.on && Math.random() < level * 0.8) this.chirp(0.25 + level * 0.35);
      }, 1900);
    }
  }

  // --- Synthesis primitives (all route partly into the echo space) --------
  tone({ freq = 440, type = 'sine', dur = 0.5, attack = 0.02, release = 0.3, gain = 0.15, filter = 0, slideTo = 0, delay = 0, send = 0.3 }) {
    if (!this.on) return;
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
    if (!this.on) return;
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

export const Audio = new AudioSystem();
