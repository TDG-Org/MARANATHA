import { Audio } from './AudioSystem.js';

// Verse narrator — browser speech synthesis (no audio assets, works on
// phones and laptops). speak() resolves when the reading finishes, so story
// beats can wait for the full verse before moving on. Falls back to a
// reading-time estimate whenever TTS is unavailable, muted, or silent.
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
      if (/Natural|Neural/i.test(n)) return 5;               // Edge natural voices
      if (/Andrew|Aria|Christopher|Guy|Brian/i.test(n)) return 4;
      if (/Google (US|UK) English/i.test(n)) return 3;
      if (/Daniel|Samantha|Alex/i.test(n)) return 3;         // Apple
      if (v.localService) return 2;
      return 1;
    };
    this.voice = en.sort((a, b) => score(b) - score(a))[0] ?? voices[0];
  }

  estimateMs(text) {
    const words = text.trim().split(/\s+/).length;
    return Math.max(2400, words * 330);
  }

  // Resolves when the verse has been fully read (or the fallback time passes).
  speak(text) {
    const clean = text.replace(/[“”]/g, '"').replace(/…/g, '.');
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
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(clean);
        if (this.voice) u.voice = this.voice;
        u.rate = 0.95;
        u.pitch = 0.92;
        u.volume = 1;
        u.onend = finish;
        u.onerror = finish;
        window.speechSynthesis.speak(u);
        // If speech never actually starts (no voices / blocked), fall back
        // to reading-time pacing instead of hanging the beat.
        setTimeout(() => {
          if (!done && !window.speechSynthesis.speaking) setTimeout(finish, est * 0.6);
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
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }
}

export const Narrator = new NarratorSystem();
