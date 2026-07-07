// Procedural WebAudio — every sound is synthesized, zero audio files
// (same rule as the visuals). One shared context, quiet gain staging,
// ambient beds with slow LFO motion so the world feels alive but calm.
const STORE_KEY = 'maranatha-audio';

class AudioSystem {
  constructor() {
    let saved = 'on';
    try { saved = localStorage.getItem(STORE_KEY) ?? 'on'; } catch { /* ignore */ }
    this.enabled = saved !== 'off';
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.amb = null;
    this.birdTimer = null;
    // Browsers require a user gesture before audio can start.
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.buildAmbience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get on() {
    return this.enabled && !!this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.08);
    }
    if (!on) {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    }
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
      wind: mkNoiseBed('lowpass', 320, 0.6),
      water: mkNoiseBed('bandpass', 520, 0.8),
    };
    // Slow filter motion so the beds breathe instead of hissing statically.
    const lfo = (rate, depth, target) => {
      const o = this.ctx.createOscillator();
      o.frequency.value = rate;
      const og = this.ctx.createGain();
      og.gain.value = depth;
      o.connect(og).connect(target);
      o.start();
    };
    lfo(0.07, 70, this.amb.wind.filt.frequency);
    lfo(0.13, 190, this.amb.water.filt.frequency);
    // Night: two barely-audible low sines.
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

  // levels: { wind, water, night, birds } each 0..1; omitted = unchanged.
  ambience(levels = {}, fade = 2.5) {
    if (levels.birds !== undefined) this.setBirds(levels.birds);
    if (!this.on || !this.amb) return;
    const t = this.ctx.currentTime;
    const set = (g, v) => g.gain.setTargetAtTime(v, t, fade / 3);
    if (levels.wind !== undefined) set(this.amb.wind.g, levels.wind * 0.055);
    if (levels.water !== undefined) set(this.amb.water.g, levels.water * 0.05);
    if (levels.night !== undefined) set(this.amb.night.g, levels.night * 0.05);
  }

  setBirds(level) {
    if (this.birdTimer) {
      clearInterval(this.birdTimer);
      this.birdTimer = null;
    }
    if (level > 0) {
      this.birdTimer = setInterval(() => {
        if (this.on && Math.random() < level * 0.8) this.chirp(0.3 + level * 0.4);
      }, 1700);
    }
  }

  // --- Synthesis primitives ------------------------------------------------
  tone({ freq = 440, type = 'sine', dur = 0.5, attack = 0.02, release = 0.3, gain = 0.15, filter = 0, slideTo = 0, delay = 0 }) {
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
    o.start(t);
    o.stop(t + attack + dur + release + 0.05);
  }

  noiseHit({ dur = 0.6, type = 'bandpass', from = 400, to = 0, q = 1, gain = 0.2, attack = 0.05, delay = 0 }) {
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
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  // --- One-shots, named for story beats ------------------------------------
  whooshUp() { this.noiseHit({ dur: 0.9, from: 250, to: 1600, gain: 0.16, attack: 0.15 }); }
  whooshDown() { this.noiseHit({ dur: 1.0, from: 1200, to: 180, gain: 0.16, attack: 0.12 }); }
  rumble(dur = 2.2) {
    this.noiseHit({ dur, type: 'lowpass', from: 120, gain: 0.2, attack: 0.3 });
    this.tone({ freq: 48, dur: dur * 0.7, attack: 0.25, release: 0.6, gain: 0.11 });
  }
  splash() { this.noiseHit({ dur: 0.5, from: 700, to: 300, gain: 0.11, attack: 0.03 }); }
  pluck(freq = 520) {
    this.tone({ freq, type: 'triangle', dur: 0.06, attack: 0.005, release: 0.5, gain: 0.13 });
    this.tone({ freq: freq * 2, type: 'sine', dur: 0.05, attack: 0.005, release: 0.35, gain: 0.04 });
  }
  sparkle(n = 4) {
    for (let i = 0; i < n; i++) {
      this.tone({ freq: 1200 + Math.random() * 1300, type: 'sine', dur: 0.05, attack: 0.008, release: 0.55, gain: 0.06, delay: i * 0.07 });
    }
  }
  godChord() {
    // A warm rising major chord — the sound of God speaking light.
    [220, 277.18, 329.63, 440].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 1.6, attack: 0.5, release: 1.6, gain: 0.05, delay: i * 0.06, filter: 1400 }));
  }
  swellBright() {
    [261.63, 329.63, 392, 523.25].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 1.8, attack: 0.7, release: 1.4, gain: 0.045, delay: i * 0.05 }));
    this.sparkle(3);
  }
  swellSoft() {
    [196, 246.94, 293.66].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 2.0, attack: 0.9, release: 1.6, gain: 0.04, delay: i * 0.08 }));
  }
  chirp(gain = 0.5) {
    const base = 1700 + Math.random() * 700;
    this.tone({ freq: base, slideTo: base + 500, type: 'sine', dur: 0.08, attack: 0.01, release: 0.08, gain: 0.055 * gain });
    this.tone({ freq: base + 300, slideTo: base - 200, type: 'sine', dur: 0.07, attack: 0.01, release: 0.07, gain: 0.045 * gain, delay: 0.12 });
  }
  blip() { this.tone({ freq: 320, slideTo: 170, type: 'sine', dur: 0.12, attack: 0.01, release: 0.15, gain: 0.07 }); }
  thump() {
    this.tone({ freq: 95, slideTo: 55, type: 'sine', dur: 0.18, attack: 0.01, release: 0.25, gain: 0.18 });
    this.noiseHit({ dur: 0.15, type: 'lowpass', from: 250, gain: 0.07, attack: 0.01 });
  }
  breath() { this.noiseHit({ dur: 2.6, type: 'bandpass', from: 400, to: 900, q: 0.7, gain: 0.09, attack: 1.2 }); }
  bell() {
    [660, 1320, 1980].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 0.1, attack: 0.01, release: 1.8 - i * 0.4, gain: 0.08 / (i + 1) }));
  }
  footstep() { this.noiseHit({ dur: 0.09, type: 'lowpass', from: 180, gain: 0.09, attack: 0.01 }); }
  uiClick() { this.tone({ freq: 520, type: 'sine', dur: 0.04, attack: 0.005, release: 0.12, gain: 0.05 }); }
}

export const Audio = new AudioSystem();

// Small 🔊/🔇 toggle, top-right of any scene.
export function attachAudioToggle(scene) {
  const t = scene.add
    .text(scene.scale.width - 16, 14, Audio.enabled ? '🔊' : '🔇', {
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      fontSize: '17px',
      resolution: 2,
    })
    .setOrigin(1, 0)
    .setAlpha(0.55)
    .setDepth(990)
    .setInteractive({ useHandCursor: true });
  t.on('pointerup', () => {
    Audio.unlock();
    Audio.setEnabled(!Audio.enabled);
    t.setText(Audio.enabled ? '🔊' : '🔇');
    if (Audio.enabled) Audio.uiClick();
  });
  return t;
}
