import { Audio } from './AudioSystem.js';
import { abortReason, throwIfAborted } from '../core/async.js';

// File-first narrator. Every line has one session owner and one synchronous
// settlement path: natural end, Skip, mute, failure, or scene-lifetime abort.
// Skip always means the CURRENT narrated line, never the whole cutscene.
const FALLBACK_VOICE = 'Microsoft Andrew Online (Natural) - English (United States)';
const VO_PRELOAD_CONCURRENCY = 4;

class NarratorSystem {
  constructor() {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    try { localStorage.removeItem('maranatha-voice'); } catch { /* ignore */ }
    // `speaking` means an audible transport is currently running and may keep
    // the renderer at full rate. `activeLine` includes muted reading holds and
    // file loading, so the Skip UI remains available without wasting frames.
    this.speaking = false;
    this.onSpeaking = null;
    this.activeLine = false;
    this.onActiveLine = null;
    this._stopCurrent = null;
    this._activeToken = 0;
    this._paused = false;
    this._ttsActive = false;
    this._timeStateListeners = new Set();
    Audio.onMuted = () => this.stop('muted');
    Audio.onVoiceMuted = () => this.stop('muted');
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => this._notifyTimeState());
    }
  }

  estimateMs(text) {
    const words = text.trim().split(/\s+/).length;
    return Math.max(2400, words * 345);
  }

  _isTimePaused() {
    return this._paused || (typeof document !== 'undefined' && document.hidden);
  }

  _syncTTSTransport() {
    if (!this.supported || !this._ttsActive) return;
    try {
      if (this._isTimePaused()) window.speechSynthesis.pause();
      else window.speechSynthesis.resume();
    } catch { /* ignore */ }
  }

  _notifyTimeState() {
    this._syncTTSTransport();
    for (const listener of [...this._timeStateListeners]) listener();
  }

  // One active-time timeout replaces fixed-cadence polling. Pause/visibility
  // events cancel the browser timer and preserve the exact remaining duration;
  // resume arms one new timeout. Hidden/paused story time therefore wakes zero
  // times, even for a long narrator hold.
  _createActiveDeadline(ms, onExpire, onActive = null) {
    let remaining = Math.max(0, ms);
    let activeSince = 0;
    let timer = null;
    let stopped = false;

    const cancelTimer = (now = performance.now()) => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, remaining - (now - activeSince));
    };
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      this._timeStateListeners.delete(sync);
    };
    const expire = () => {
      if (stopped) return;
      stop();
      onExpire();
    };
    const sync = () => {
      if (stopped) return;
      const now = performance.now();
      cancelTimer(now);
      if (this._isTimePaused()) return;
      if (onActive?.() === false || stopped) return;
      if (remaining <= 0) {
        expire();
        return;
      }
      activeSince = now;
      timer = setTimeout(() => {
        if (stopped) return;
        timer = null;
        remaining = Math.max(0, remaining - (performance.now() - activeSince));
        if (this._isTimePaused()) return;
        if (onActive?.() === false || stopped) return;
        if (remaining <= 0) expire();
        else sync();
      }, remaining);
    };
    const reset = (nextMs) => {
      if (stopped) return;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, nextMs);
      sync();
    };

    this._timeStateListeners.add(sync);
    sync();
    return { cancel: stop, reset };
  }

  _setSpeaking(on, token = this._activeToken) {
    if (token !== this._activeToken || this.speaking === on) return;
    this.speaking = on;
    this.onSpeaking?.(on);
  }

  _setActiveLine(on, token = this._activeToken) {
    if (token !== this._activeToken || this.activeLine === on) return;
    this.activeLine = on;
    if (!on) this._stopCurrent = null;
    this.onActiveLine?.(on);
  }

  _newSession() {
    this.stop('superseded');
    return this._activeToken;
  }

  async speak(text, lineId = null, { signal = null } = {}) {
    const clean = text.replace(/[“”]/g, '"').replace(/…/g, '.').replace(/\bLORD\b/g, 'Lord');
    throwIfAborted(signal);
    const token = this._newSession();
    this._setActiveLine(true, token);

    try {
      if (!Audio.enabled || Audio.channels.voice <= 0.004) {
        // Preserve the authored reading hold without decoding/starting silent
        // VO or forcing the renderer to full-rate for inaudible narration.
        return await this._waitReading(this.estimateMs(clean) * 0.75, {
          signal, token, announce: false,
        });
      }

      if (lineId) {
        Audio.unlock();
        const loaded = await this._waitForVO(lineId, { signal, token });
        if (loaded.status) return loaded;
        throwIfAborted(signal);
        if (token !== this._activeToken) return { status: 'superseded' };
        if (!Audio.enabled || Audio.channels.voice <= 0.004) {
          this._setActiveLine(false, token);
          return { status: 'muted' };
        }
        if (loaded.buffer) return await this._playFile(loaded.buffer, { signal, token });
      }

      return await this._speakTTS(clean, { signal, token });
    } catch (error) {
      this._setSpeaking(false, token);
      this._setActiveLine(false, token);
      throw error;
    }
  }

  // Own the loading phase just like an audio transport. Skip/mute/scene abort
  // settle the narration immediately; any shared late decode may fill the
  // bounded cache, but it can never revive playback for an obsolete session.
  _waitForVO(lineId, { signal = null, token }) {
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    return new Promise((resolve, reject) => {
      let done = false;
      // The underlying fetch/decode may be shared and can still populate the
      // bounded cache, but this line owns its FORMAT CHAIN. Retiring the line
      // must prevent a late MP3 miss from opening a fresh OGG request.
      const loadLifetime = new AbortController();
      const retireLoad = (reason = null) => {
        if (!loadLifetime.signal.aborted) loadLifetime.abort(reason);
      };
      const finish = (value, error = null, keepActive = false) => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', onAbort);
        if (token === this._activeToken && this._stopCurrent === stopCurrent) {
          this._stopCurrent = null;
        }
        if (!keepActive) {
          this._setSpeaking(false, token);
          this._setActiveLine(false, token);
        }
        if (error) reject(error);
        else resolve(value);
      };
      const stopCurrent = (status = 'skipped') => {
        retireLoad();
        finish({ status });
      };
      const onAbort = () => {
        const reason = abortReason(signal);
        retireLoad(reason);
        finish(null, reason);
      };
      this._stopCurrent = stopCurrent;
      signal?.addEventListener('abort', onAbort, { once: true });
      Promise.resolve(this._loadVO(lineId, { signal: loadLifetime.signal })).then(
        (buffer) => finish({ buffer }, null, true),
        () => {
          if (signal?.aborted) finish(null, abortReason(signal));
          else finish({ buffer: null }, null, true);
        },
      );
    });
  }

  async _loadVO(lineId, { signal = null } = {}) {
    for (const ext of ['mp3', 'ogg']) {
      throwIfAborted(signal);
      const buf = await Audio.decodeVO(`audio/vo/${lineId}.${ext}`, { signal });
      if (buf) return buf;
    }
    return null;
  }

  async preload(lineIds = [], { signal = null } = {}) {
    // Keep the loader's offline/file-first guarantee without retaining every
    // line as decoded PCM (~17.5 MiB for Scene 1). Compressed files are fetched
    // now; decodeVO keeps only the current/next two AudioBuffers later. Four
    // workers avoid a burst of dozens of simultaneous fetch/decode pipelines
    // on budget phones. Return an honest aggregate rather than a truthy array
    // that can hide missing narration files from diagnostics.
    const ids = [...new Set(lineIds.filter(Boolean))];
    const results = new Array(ids.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < ids.length) {
        throwIfAborted(signal);
        const index = cursor;
        cursor += 1;
        const id = ids[index];
        // The baked/verified pipeline emits MP3. Do not spend another full
        // network timeout probing an unshipped OGG for every missing line;
        // on-demand playback still retains its OGG compatibility fallback.
        const bytes = await Audio.preloadVO(`audio/vo/${id}.mp3`, { signal });
        const format = bytes ? 'mp3' : null;
        results[index] = { id, loaded: !!format, format };
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(VO_PRELOAD_CONCURRENCY, ids.length) }, worker),
    );
    const missing = results.filter((result) => !result.loaded).map((result) => result.id);
    return {
      ok: missing.length === 0,
      total: ids.length,
      loaded: ids.length - missing.length,
      failed: missing.length,
      missing,
      results,
    };
  }

  _waitReading(ms, { signal = null, token = null, announce = true } = {}) {
    if (token == null) token = this._newSession();
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    this._setActiveLine(true, token);
    return new Promise((resolve, reject) => {
      let done = false;
      let deadline = null;
      const finish = (status = 'ended', error = null) => {
        if (done) return;
        done = true;
        deadline?.cancel();
        signal?.removeEventListener('abort', onAbort);
        if (announce) this._setSpeaking(false, token);
        this._setActiveLine(false, token);
        if (error) reject(error); else resolve({ status });
      };
      const onAbort = () => finish('aborted', abortReason(signal));
      if (announce) this._setSpeaking(true, token);
      this._stopCurrent = (status = 'skipped') => finish(status);
      signal?.addEventListener('abort', onAbort, { once: true });
      deadline = this._createActiveDeadline(ms, () => finish());
    });
  }

  _playFile(buffer, { signal = null, token = null } = {}) {
    if (token == null) token = this._newSession();
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    this._setActiveLine(true, token);
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
        this._setActiveLine(false, token);
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
    try {
      window.speechSynthesis.cancel();
      if (!this._isTimePaused()) window.speechSynthesis.resume();
    } catch { /* ignore */ }
  }

  _speakTTS(clean, { signal = null, token = null } = {}) {
    if (token == null) token = this._newSession();
    const est = this.estimateMs(clean);
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    this._setActiveLine(true, token);
    if (!this.supported) return this._waitReading(est * 0.75, { signal, token });

    return new Promise((resolve, reject) => {
      let done = false;
      let terminalStatus = null;
      let utterance = null;
      let deadline = null;
      const finish = (status = 'ended', error = null) => {
        if (done) return;
        done = true;
        deadline?.cancel();
        this._ttsActive = false;
        if (utterance) {
          utterance.onend = null;
          utterance.onerror = null;
        }
        signal?.removeEventListener('abort', onAbort);
        this._setSpeaking(false, token);
        this._setActiveLine(false, token);
        if (error) reject(error); else resolve({ status });
      };
      const stopTransport = (status, error = null) => {
        // Detach callbacks and settle ownership before cancel(): some engines
        // synchronously emit an error from cancel(), which must not replace the
        // authored terminal status (skip/mute/timeout).
        finish(status, error);
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      };
      const onAbort = () => stopTransport('aborted', abortReason(signal));

      this._setSpeaking(true, token);
      this._ttsActive = true;
      this._stopCurrent = (status = 'skipped') => stopTransport(status);
      signal?.addEventListener('abort', onAbort, { once: true });
      deadline = this._createActiveDeadline(
        est * 2.2,
        () => stopTransport('timeout'),
        () => {
          if (!terminalStatus) return true;
          const status = terminalStatus;
          terminalStatus = null;
          finish(status);
          return false;
        },
      );

      try {
        this.nudge();
        utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = 'en-US';
        const pinned = window.speechSynthesis.getVoices().find((v) => v.name === FALLBACK_VOICE);
        if (pinned) utterance.voice = pinned;
        utterance.rate = 1.0;
        utterance.pitch = 0.82;
        utterance.volume = Math.min(1, Math.max(0, Audio.voiceLevel));
        const settleTransport = (status) => {
          if (this._isTimePaused()) terminalStatus = status;
          else finish(status);
        };
        utterance.onend = () => settleTransport('ended');
        utterance.onerror = () => settleTransport('error');
        window.speechSynthesis.speak(utterance);
        this._syncTTSTransport();
      } catch {
        deadline.reset(est * 0.75);
      }
    });
  }

  pause() {
    this._paused = true;
    this._notifyTimeState();
  }

  resume() {
    this._paused = false;
    this._notifyTimeState();
  }

  skip() {
    if (this._stopCurrent) this._stopCurrent('skipped');
    else if (this.activeLine) this.stop('skipped');
  }

  stop(status = 'stopped') {
    const token = this._activeToken;
    const stopCurrent = this._stopCurrent;
    if (stopCurrent) stopCurrent(status);
    this.cancel();
    this._setSpeaking(false, token);
    this._setActiveLine(false, token);
    // Also invalidates a line still fetching/decoding. Its shared late work may
    // fill the cache, but can never start transport after Skip/mute/scene exit.
    this._activeToken += 1;
  }

  cancel() {
    if (this.supported) {
      try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
    }
  }
}

export const Narrator = new NarratorSystem();
