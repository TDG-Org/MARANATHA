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
    this.noiseBuf = null;
    this.amb = null;
    this.birdTimer = null;
    this.onMuted = null; // hook: the narrator stops mid-verse on mute
    this.onVolume = null; // hook: DOM UI stays in sync
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // Battery care: stop the audio clock entirely when the tab is hidden
    // (looping ambience isn't throttled in background tabs otherwise).
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else if (this.enabled) this.ctx.resume().catch(() => {});
    });
  }

  get enabled() {
    return this.volume > 0.004;
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
      delay.connect(wet).connect(this.master);
      this.space = delay;

      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.buildAmbience();
    }
    if (this.ctx.state === 'suspended' && this.enabled) this.ctx.resume().catch(() => {});
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
      src.connect(filt).connect(g).connect(this.master);
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
    pg.connect(this.master);
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
    node.connect(g).connect(this.master);
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
    s.connect(f).connect(g).connect(this.master);
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
