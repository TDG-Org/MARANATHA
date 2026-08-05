import { Audio } from './AudioSystem.js';

// Player settings — audio channel levels + the perf-HUD toggle — persisted to
// localStorage. Master volume stays owned by AudioSystem (its own key); this
// layer owns Music / SFX / Narrator / HUD and applies them on boot.
const KEY = 'maranatha-settings-v1';
// `sky` is the home's backdrop. 'auto' follows the clock (dawn/day/dusk/night);
// any other value pins that one and stops the map changing under the player.
// `hud: false` — the performance meter is a DEVELOPER readout and it used to be
// on for every player who had never opened Settings, phones included: a black
// box of frame times and driver strings over the corner of a painterly Bible
// story. The reason it was defaulted on ("honest fps visible at all times")
// still holds for the people who need it, and they still have both routes:
// `#debug` in the URL forces it on regardless of this setting, and Settings →
// "Show performance meter" turns it on for good. Nobody has to see it to play.
const DEFAULTS = { music: 0.8, sfx: 0.9, voice: 1.0, hud: false, sky: 'auto' };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && typeof data === 'object') return { ...DEFAULTS, ...data };
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

class SettingsSystem {
  constructor() {
    this.data = read();
    this.subs = new Set();
    this._hud = null;
    // A slider drag calls set() per input event — persist trailing-edge
    // instead of a synchronous stringify+setItem per pointer move, and flush
    // before the page can go away.
    this._writeT = 0;
    window.addEventListener('pagehide', () => this._flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._flush(); });
    // Seed Audio's channel values now so unlock() builds the buses at the
    // player's saved levels (setChannel stores even before the context exists).
    Audio.setChannel('music', this.data.music);
    Audio.setChannel('sfx', this.data.sfx);
    Audio.setChannel('voice', this.data.voice);
  }

  get(key) { return this.data[key]; }

  // Master is delegated to AudioSystem (single source of truth + its own key).
  get master() { return Audio.volume; }
  setMaster(v) { Audio.setVolume(v); this._notify(); }

  bindHud(hud) {
    this._hud = hud;
    hud.setEnabled(this.data.hud);
  }

  _persist() {
    clearTimeout(this._writeT);
    this._writeT = setTimeout(() => { this._writeT = 0; write(this.data); }, 250);
  }

  _flush() {
    if (!this._writeT) return;
    clearTimeout(this._writeT);
    this._writeT = 0;
    write(this.data);
  }

  set(key, value) {
    if (!(key in this.data)) return;
    this.data[key] = value;
    this._persist();
    if (key === 'music' || key === 'sfx' || key === 'voice') Audio.setChannel(key, value);
    if (key === 'hud' && this._hud) this._hud.setEnabled(value);
    this._notify();
  }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  _notify() { for (const fn of this.subs) { try { fn(this); } catch { /* ignore */ } } }
}

export const Settings = new SettingsSystem();
