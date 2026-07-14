import { Audio } from './AudioSystem.js';

// Player settings — audio channel levels + the perf-HUD toggle — persisted to
// localStorage. Master volume stays owned by AudioSystem (its own key); this
// layer owns Music / SFX / Narrator / HUD and applies them on boot.
const KEY = 'maranatha-settings-v1';
const DEFAULTS = { music: 0.8, sfx: 0.9, voice: 1.0, hud: true };

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

  set(key, value) {
    if (!(key in this.data)) return;
    this.data[key] = value;
    write(this.data);
    if (key === 'music' || key === 'sfx' || key === 'voice') Audio.setChannel(key, value);
    if (key === 'hud' && this._hud) this._hud.setEnabled(value);
    this._notify();
  }

  subscribe(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  _notify() { for (const fn of this.subs) { try { fn(this); } catch { /* ignore */ } } }
}

export const Settings = new SettingsSystem();
