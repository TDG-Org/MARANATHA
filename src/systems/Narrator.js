import { Audio } from './AudioSystem.js';

// Verse narrator — browser speech synthesis (no audio assets, works on
// phones and laptops). speak() resolves when the reading finishes, so story
// beats can wait for the full verse before moving on. Falls back to a
// reading-time estimate whenever TTS is unavailable, muted, or silent.
//
// Voice: prefers deep, calm, audiobook-style male voices (Edge "Natural"
// voices are best), read slowly and slightly low.
class NarratorSystem {
  constructor() {
    this.voice = null;
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    if (this.supported) {
      const pick = () => this.pickVoice();
      pick();
      window.speechSynthesis.onvoiceschanged = pick;
    }
  }

  pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    const en = voices.filter((v) => /^en/i.test(v.lang));
    const score = (v) => {
      const n = v.name;
      let s = 0;
      if (/Natural|Neural/i.test(n)) s += 6; // Edge natural voices — far better
      // Deep/calm male narrators first…
      if (/Andrew|Guy|Christopher|Eric|Roger|Brian|Davis|George|Daniel|Alex\b/i.test(n)) s += 4;
      if (/Google UK English Male/i.test(n)) s += 4;
      if (/David|Mark|Google US English/i.test(n)) s += 2;
      // …female voices still fine as fallback, just ranked lower.
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

  // Chrome's speech engine can stall after cancel() (classic bug: the next
  // utterance never starts, especially right after mute→unmute). Nudging it
  // with resume() before speaking clears the stall.
  nudge() {
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch { /* ignore */ }
  }

  // Resolves when the verse has been fully read (or the fallback time passes).
  speak(text) {
    const clean = text.replace(/[“”]/g, '"').replace(/…/g, '.').replace(/\bLORD\b/g, 'Lord');
    const est = this.estimateMs(clean);
    if (!this.supported || !Audio.enabled) {
      // Muted / unsupported: still give the player time to read it themselves.
      return new Promise((r) => setTimeout(r, est * 0.75));
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve();
        }
      };
      try {
        this.nudge();
        const u = new SpeechSynthesisUtterance(clean);
        if (this.voice) u.voice = this.voice;
        u.rate = 0.88; // unhurried, audiobook pace
        u.pitch = 0.82; // deeper, calm
        u.volume = Math.min(1, Math.max(0, Audio.volume));
        u.onend = finish;
        u.onerror = finish;
        window.speechSynthesis.speak(u);
        // If speech never actually starts (no voices / blocked), fall back
        // to reading-time pacing instead of hanging the beat — and try one
        // more nudge in case the engine was stalled.
        setTimeout(() => {
          if (!done && !window.speechSynthesis.speaking) {
            try { window.speechSynthesis.resume(); } catch { /* ignore */ }
            setTimeout(() => {
              if (!done && !window.speechSynthesis.speaking) setTimeout(finish, est * 0.6);
            }, 400);
          }
        }, 700);
        // Absolute cap: never let a beat hang on a stuck utterance.
        setTimeout(finish, est * 2.2);
      } catch {
        setTimeout(finish, est * 0.75);
      }
    });
  }

  cancel() {
    if (this.supported) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
      } catch { /* ignore */ }
    }
  }
}

export const Narrator = new NarratorSystem();
