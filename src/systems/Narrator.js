import { Audio } from './AudioSystem.js';

// Verse / line narrator. FILE-FIRST: if a real VO file exists at
// audio/vo/<line-id>.mp3|.ogg it plays through the voice bus (so Master and
// Narrator sliders are LIVE mid-line, and a volume change never interrupts it);
// otherwise it falls back to browser speech synthesis. speak() resolves when the
// line finishes so story beats can await it.
//
// Only two things stop a line: skip() (the Skip button) or a full mute.
// Changing any volume must NEVER cancel narration.
class NarratorSystem {
  constructor() {
    this.voice = null;
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.supported) {
      const pick = () => this.pickVoice();
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
    }
    this.speaking = false;
    this.onSpeaking = null;   // hook: the Skip button watches this
    this._stopCurrent = null; // stops the in-flight line (file source or TTS)
    // A FULL mute silences immediately (mute is one of the two things that stop
    // a line). A non-mute volume change does NOT fire this, so it won't cancel.
    Audio.onMuted = () => this.stop();
  }

  pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    const en = voices.filter((v) => /^en/i.test(v.lang));
    const score = (v) => {
      const n = v.name;
      let s = 0;
      if (/Natural|Neural/i.test(n)) s += 6;
      if (/Andrew|Guy|Christopher|Eric|Roger|Brian|Davis|George|Daniel|Alex\b/i.test(n)) s += 4;
      if (/Google UK English Male/i.test(n)) s += 4;
      if (/David|Mark|Google US English/i.test(n)) s += 2;
      if (/Aria|Jenny|Samantha|Zira|Sonia|Libby/i.test(n)) s += 1;
      if (/UK/i.test(v.lang) || /GB/i.test(v.lang)) s += 1;
      if (v.localService) s += 1;
      return s;
    };
    this.voice = en.sort((a, b) => score(b) - score(a))[0] ?? voices[0];
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
        if (this.voice) u.voice = this.voice;
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
        setTimeout(() => {
          if (!done && !window.speechSynthesis.speaking) {
            try { window.speechSynthesis.resume(); } catch { /* ignore */ }
            setTimeout(() => { if (!done && !window.speechSynthesis.speaking) setTimeout(finish, est * 0.6); }, 400);
          }
        }, 700);
        setTimeout(finish, est * 2.2); // absolute cap
      } catch {
        setTimeout(finish, est * 0.75);
      }
    });
  }

  // Game pause: hold the current TTS line mid-word (file VO rides the
  // suspended AudioContext, so it pauses on the audio side). resume() picks
  // the line back up. Neither resolves or cancels anything.
  pause() {
    if (this.supported) { try { window.speechSynthesis.pause(); } catch { /* ignore */ } }
  }

  resume() {
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
