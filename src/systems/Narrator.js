import { Audio } from './AudioSystem.js';
import { abortReason, throwIfAborted, withAbort } from '../core/async.js';

// File-first narrator. Every line has one session owner and one synchronous
// settlement path: natural end, Skip, mute, failure, or scene-lifetime abort.
// Skip always means the CURRENT narrated line, never the whole cutscene.
const FALLBACK_VOICE = 'Microsoft Andrew Online (Natural) - English (United States)';

class NarratorSystem {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    try { localStorage.removeItem('maranatha-voice'); } catch { /* ignore */ }
    this.speaking = false;
    this.onSpeaking = null;
    this._stopCurrent = null;
    this._activeToken = 0;
    this._paused = false;
    Audio.onMuted = () => this.stop('muted');
    Audio.onVoiceMuted = () => this.stop('muted');
  }

  estimateMs(text) {
    const words = text.trim().split(/\s+/).length;
    return Math.max(2400, words * 345);
  }

  _setSpeaking(on, token = this._activeToken) {
    if (!on && token !== this._activeToken) return;
    this.speaking = on;
    if (!on) this._stopCurrent = null;
    this.onSpeaking?.(on);
  }

  _newSession() {
    this.stop('superseded');
    this._activeToken += 1;
    return this._activeToken;
  }

  async speak(text, lineId = null, { signal = null } = {}) {
    const clean = text.replace(/[“”]/g, '"').replace(/…/g, '.').replace(/\bLORD\b/g, 'Lord');
    const token = this._newSession();
    throwIfAborted(signal);

    if (!Audio.enabled || Audio.channels.voice <= 0.004) {
      // Preserve the authored reading hold without decoding/starting silent
      // VO or forcing the renderer to full-rate for inaudible narration.
      return this._waitReading(this.estimateMs(clean) * 0.75, { signal, token, announce: false });
    }

    if (lineId) {
      Audio.unlock();
      const buf = await withAbort(() => this._loadVO(lineId), signal);
      throwIfAborted(signal);
      if (token !== this._activeToken) return { status: 'superseded' };
      if (!Audio.enabled || Audio.channels.voice <= 0.004) return { status: 'muted' };
      if (buf) return this._playFile(buf, { signal, token });
    }

    return this._speakTTS(clean, { signal, token });
  }

  async _loadVO(lineId) {
    for (const ext of ['mp3', 'ogg']) {
      const buf = await Audio.decodeVO(`audio/vo/${lineId}.${ext}`);
      if (buf) return buf;
    }
    return null;
  }

  preload(lineIds = []) {
    return Promise.all(lineIds.map((id) => this._loadVO(id).catch(() => null)));
  }

  _waitReading(ms, { signal = null, token = null, announce = true } = {}) {
    if (token == null) token = this._newSession();
    return new Promise((resolve, reject) => {
      let left = Math.max(0, ms);
      let done = false;
      const finish = (status = 'ended', error = null) => {
        if (done) return;
        done = true;
        clearInterval(timer);
        signal?.removeEventListener('abort', onAbort);
        if (announce) this._setSpeaking(false, token);
        if (error) reject(error); else resolve({ status });
      };
      const onAbort = () => finish('aborted', abortReason(signal));
      const timer = setInterval(() => {
        if (this._paused) return;
        left -= 50;
        if (left <= 0) finish();
      }, 50);
      if (announce) this._setSpeaking(true, token);
      this._stopCurrent = (status = 'skipped') => finish(status);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  _playFile(buffer, { signal = null, token = null } = {}) {
    if (token == null) token = this._newSession();
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    return new Promise((resolve, reject) => {
      const src = Audio.playVO(buffer);
      let done = false;
      const finish = (status = 'ended', error = null) => {
        if (done) return;
        done = true;
        src.onended = null;
        try { src.disconnect(); } catch { /* already disconnected */ }
        signal?.removeEventListener('abort', onAbort);
        this._setSpeaking(false, token);
        if (error) reject(error); else resolve({ status });
      };
      const stopTransport = (status, error = null) => {
        src.onended = null;
        try { src.stop(); } catch { /* already stopped */ }
        // Never wait for WebAudio onended: suspended/interrupted contexts may
        // delay it indefinitely. Settlement is synchronous and idempotent.
        finish(status, error);
      };
      const onAbort = () => stopTransport('aborted', abortReason(signal));
      this._setSpeaking(true, token);
      this._stopCurrent = (status = 'skipped') => stopTransport(status);
      src.onended = () => finish('ended');
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  nudge() {
    try { window.speechSynthesis.cancel(); window.speechSynthesis.resume(); } catch { /* ignore */ }
  }

  _speakTTS(clean, { signal = null, token = null } = {}) {
    if (token == null) token = this._newSession();
    const est = this.estimateMs(clean);
    if (!this.supported) return this._waitReading(est * 0.75, { signal, token });
    if (signal?.aborted) return Promise.reject(abortReason(signal));

    return new Promise((resolve, reject) => {
      let done = false;
      let capLeft = est * 2.2;
      const finish = (status = 'ended', error = null) => {
        if (done) return;
        done = true;
        clearInterval(capTimer);
        signal?.removeEventListener('abort', onAbort);
        this._setSpeaking(false, token);
        if (error) reject(error); else resolve({ status });
      };
      const stopTransport = (status, error = null) => {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
        finish(status, error);
      };
      const onAbort = () => stopTransport('aborted', abortReason(signal));
      const capTimer = setInterval(() => {
        if (this._paused) return;
        capLeft -= 250;
        if (capLeft <= 0) finish('timeout');
      }, 250);

      this._setSpeaking(true, token);
      this._stopCurrent = (status = 'skipped') => stopTransport(status);
      signal?.addEventListener('abort', onAbort, { once: true });

      try {
        this.nudge();
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = 'en-US';
        const pinned = window.speechSynthesis.getVoices().find((v) => v.name === FALLBACK_VOICE);
        if (pinned) utterance.voice = pinned;
        utterance.rate = 1.0;
        utterance.pitch = 0.82;
        utterance.volume = Math.min(1, Math.max(0, Audio.voiceLevel));
        utterance.onend = () => finish('ended');
        utterance.onerror = () => finish('error');
        window.speechSynthesis.speak(utterance);
      } catch {
        capLeft = est * 0.75;
      }
    });
  }

  pause() {
    this._paused = true;
    if (this.supported) { try { window.speechSynthesis.pause(); } catch { /* ignore */ } }
  }

  resume() {
    this._paused = false;
    if (this.supported) { try { window.speechSynthesis.resume(); } catch { /* ignore */ } }
  }

  skip() {
    this._stopCurrent?.('skipped');
  }

  stop(status = 'stopped') {
    const stopCurrent = this._stopCurrent;
    if (stopCurrent) stopCurrent(status);
    this.cancel();
    this._setSpeaking(false);
    // Also cancels a line that is still fetching/decoding and therefore has
    // no transport owner yet. A later decode can never revive after Skip,
    // master mute, narrator mute, supersession, or scene exit.
    this._activeToken += 1;
  }

  cancel() {
    if (this.supported) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }
}

export const Narrator = new NarratorSystem();
