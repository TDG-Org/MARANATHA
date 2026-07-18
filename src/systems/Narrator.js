import { Audio } from './AudioSystem.js';

// Verse / line narrator. FILE-FIRST (D6: this is now THE voice): every
// narrator line ships as a baked mp3 in audio/vo/ — one identical neural
// storyteller voice (en-US-AndrewNeural, regenerate with `npm run vo`) on
// every device, played through the voice bus (Master + Narrator sliders live
// mid-line). speechSynthesis is an EMERGENCY fallback only, for a missing
// file — pinned to one explicit voice, never auto-picked. speak() resolves
// when the line finishes so story beats can await it.
//
// Only two things stop a line: skip() (the Skip button) or a full mute.
// Changing any volume must NEVER cancel narration.

// The pinned emergency-fallback TTS voice: Edge's local name for the SAME
// Andrew the baked files use. If it isn't installed, the utterance keeps
// lang 'en-US' and the platform's own en-US default reads it — deterministic
// per device, zero picking logic.
const FALLBACK_VOICE = 'Microsoft Andrew Online (Natural) - English (United States)';

class NarratorSystem {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    // D6 cleanup: the old voice-picker persisted its choice here. Gone.
    try { localStorage.removeItem('maranatha-voice'); } catch { /* ignore */ }
    this.speaking = false;
    this.onSpeaking = null;   // hook: the Skip button watches this
    this._stopCurrent = null; // stops the in-flight line (file source or TTS)
    // A FULL mute silences immediately (mute is one of the two things that stop
    // a line). A non-mute volume change does NOT fire this, so it won't cancel.
    Audio.onMuted = () => this.stop();
  }

  estimateMs(text) {
    const words = text.trim().split(/\s+/).length;
    return Math.max(2400, words * 345);
  }

  _setSpeaking(on) {
    this.speaking = on;
    if (!on) this._stopCurrent = null;
    this.onSpeaking?.(on);
  }

  // Resolve when the line finishes (or the fallback time passes). Pass a lineId
  // to enable the file-first VO path (e.g. 'joseph/1/jacob-coat-1').
  async speak(text, lineId = null) {
    const clean = text.replace(/[“”]/g, '"').replace(/…/g, '.').replace(/\bLORD\b/g, 'Lord');

    // Muted → no audio, but still give the player time to read it.
    if (!Audio.enabled) return new Promise((r) => setTimeout(r, this.estimateMs(clean) * 0.75));

    // FILE-FIRST: try a real VO recording routed through the live voice bus.
    if (lineId) {
      Audio.unlock();
      const buf = await this._loadVO(lineId);
      if (buf) return this._playFile(buf);
    }

    // FALLBACK: browser speech synthesis.
    return this._speakTTS(clean);
  }

  async _loadVO(lineId) {
    for (const ext of ['mp3', 'ogg']) {
      const buf = await Audio.decodeVO(`audio/vo/${lineId}.${ext}`);
      if (buf) return buf;
    }
    return null;
  }

  // D7: decode a whole scene's narration UP FRONT (behind the loading screen)
  // — zero mid-scene fetches, so the baked voice can never drop to TTS from a
  // network blip halfway through the story.
  preload(lineIds = []) {
    return Promise.all(lineIds.map((id) => this._loadVO(id).catch(() => null)));
  }

  _playFile(buffer) {
    return new Promise((resolve) => {
      const src = Audio.playVO(buffer);
      this._setSpeaking(true);
      let done = false;
      const finish = () => { if (done) return; done = true; this._setSpeaking(false); resolve(); };
      // skip()/mute stop the source → onended fires → finish.
      this._stopCurrent = () => { try { src.stop(); } catch { /* already stopped */ } };
      src.onended = finish;
    });
  }

  nudge() {
    try { window.speechSynthesis.cancel(); window.speechSynthesis.resume(); } catch { /* ignore */ }
  }

  _speakTTS(clean) {
    const est = this.estimateMs(clean);
    if (!this.supported) return new Promise((r) => setTimeout(r, est * 0.75));
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; this._setSpeaking(false); resolve(); } };
      try {
        this.nudge();
        const u = new SpeechSynthesisUtterance(clean);
        // Pinned fallback voice — exact-name match ONLY (no scoring, no
        // auto-pick). Absent → lang-default en-US.
        u.lang = 'en-US';
        const pinned = window.speechSynthesis.getVoices().find((v) => v.name === FALLBACK_VOICE);
        if (pinned) u.voice = pinned;
        u.rate = 1.0;   // a touch quicker than the old 0.88 — still calm
        u.pitch = 0.82; // deeper, calm
        // Baked at start (speechSynthesis can't change volume mid-line — that's
        // why file VO exists). A later volume change won't cancel it.
        u.volume = Math.min(1, Math.max(0, Audio.voiceLevel));
        u.onend = finish;
        u.onerror = finish;
        this._setSpeaking(true);
        // Skip / mute must resolve the awaited promise NOW and clear speaking
        // state — not rely on the engine firing onend after cancel() (some don't,
        // which stalled the beat until the est×2.2 backstop). finish() is idempotent.
        this._stopCurrent = () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } finish(); };
        window.speechSynthesis.speak(u);
        // Robustness: if speech never starts, fall back to reading-time pacing.
        // (Never while game-paused — resuming here would defeat the pause.)
        setTimeout(() => {
          if (!done && !this._paused && !window.speechSynthesis.speaking) {
            try { window.speechSynthesis.resume(); } catch { /* ignore */ }
            setTimeout(() => { if (!done && !this._paused && !window.speechSynthesis.speaking) setTimeout(finish, est * 0.6); }, 400);
          }
        }, 700);
        // absolute cap — deferred while paused so a held line can't time out
        const cap = () => {
          if (done) return;
          if (this._paused) { setTimeout(cap, 500); return; }
          finish();
        };
        setTimeout(cap, est * 2.2);
      } catch {
        setTimeout(finish, est * 0.75);
      }
    });
  }

  // Game pause: hold the current TTS line mid-word (file VO rides the
  // suspended AudioContext, so it pauses on the audio side). resume() picks
  // the line back up. Neither resolves or cancels anything.
  pause() {
    this._paused = true;
    if (this.supported) { try { window.speechSynthesis.pause(); } catch { /* ignore */ } }
  }

  resume() {
    this._paused = false;
    if (this.supported) { try { window.speechSynthesis.resume(); } catch { /* ignore */ } }
  }

  // Skip the CURRENT line only (the Skip button). Resolves the in-flight speak().
  skip() {
    if (this._stopCurrent) this._stopCurrent();
    else this.cancel();
  }

  // Full stop (mute). Stops whatever is playing and clears speaking state.
  stop() {
    if (this._stopCurrent) this._stopCurrent();
    this.cancel();
    this._setSpeaking(false);
  }

  cancel() {
    if (this.supported) {
      try { window.speechSynthesis.cancel(); window.speechSynthesis.resume(); } catch { /* ignore */ }
    }
  }
}

export const Narrator = new NarratorSystem();
