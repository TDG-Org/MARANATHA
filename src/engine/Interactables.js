import * as THREE from 'three';
import { Audio } from '../systems/AudioSystem.js';

// Interaction vocabulary for 3D scenes (interaction-design + ui-clarity):
//  • proximity PROMPTS — one speech BUBBLE above the nearest eligible
//    interactable ("[E] Talk…" / "Tap · Talk…"), tap/E to act; clicking the
//    character themself also acts, with a pointer cursor on hover.
//  • TRIGGER volumes — circles that fire on enter (once or repeat).
// Prompts/triggers are data; availability is a callback so beats gate them.
// A prompt may carry `object` (a THREE root) to enable click-the-character.
export class Interactables {
  constructor({ camera, getPlayerPos, dom = null }) {
    this.camera = camera;
    this.getPlayerPos = getPlayerPos;
    this.dom = dom; // renderer canvas (click-the-character + cursor)
    this.prompts = []; // {id,label,x,z,r,when(),onInteract,object?, _pos}
    this.triggers = []; // {id,x,z,r,once,fired,when(),onEnter}
    this.enabled = true;
    this.busy = false;
    this._active = null;
    this._v = null;
    this._touch = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;

    // The talk bubble: warm pill + a small tail pointing at the character.
    this.pill = document.createElement('button');
    this.pill.type = 'button';
    this.pill.style.cssText = [
      'position:fixed', 'z-index:36', 'transform:translate(-50%,-100%)',
      'padding:clamp(8px,1.3vw,10px) clamp(13px,1.9vw,16px)', 'border-radius:16px', 'cursor:pointer',
      'font:600 clamp(12.5px,1.7vw,14.5px) "Segoe UI",system-ui,sans-serif', 'white-space:nowrap',
      'color:#241f38', 'background:rgba(248,214,166,0.97)', 'border:none',
      'box-shadow:0 4px 14px rgba(0,0,0,0.34)', 'display:none', 'pointer-events:auto',
    ].join(';');
    this._tail = document.createElement('div');
    this._tail.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:-5px', 'width:10px', 'height:10px',
      'transform:translateX(-50%) rotate(45deg)', 'background:rgba(248,214,166,0.97)',
      'border-radius:2px', 'pointer-events:none',
    ].join(';');
    this.pill.append(this._tail);
    this._label = document.createElement('span');
    this.pill.prepend(this._label);
    this.pill.onclick = () => this._interact();
    document.body.append(this.pill);

    this._onKey = (e) => { if ((e.key === 'e' || e.key === 'E') && this._active && !this.busy && this.enabled) this._interact(); };
    window.addEventListener('keydown', this._onKey);

    // Click/tap the CHARACTER directly (ui-clarity law 6) + pointer cursor.
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();
    this._castHit = (ev) => {
      const p = this._active;
      const obj = p && (typeof p.object === 'function' ? p.object() : p.object);
      if (!obj) return false;
      const r = (this.dom || document.body).getBoundingClientRect();
      this._ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this._ray.setFromCamera(this._ndc, this.camera);
      this._ray.camera = this.camera;
      return this._ray.intersectObject(obj, true).length > 0;
    };
    this._onDown = (ev) => {
      if (!this.enabled || this.busy || !this._active) return;
      if (ev.target !== this.dom) return; // canvas only — never steal UI clicks
      if (this._castHit(ev)) this._interact();
    };
    this._onMove = (ev) => {
      if (!this.dom) return;
      if (!this.enabled || this.busy || !this._active) { this.dom.style.cursor = ''; return; }
      if (ev.target !== this.dom) return;
      this.dom.style.cursor = this._castHit(ev) ? 'pointer' : '';
    };
    if (this.dom) {
      this.dom.addEventListener('pointerdown', this._onDown);
      if (!this._touch) this.dom.addEventListener('pointermove', this._onMove);
    }
  }

  addPrompt(p) { this.prompts.push({ r: 2.8, when: () => true, ...p }); return p; }
  addTrigger(t) { this.triggers.push({ r: 2.5, once: true, fired: false, when: () => true, ...t }); return t; }
  rearmTrigger(id) { const t = this.triggers.find((x) => x.id === id); if (t) t.fired = false; }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.pill.style.display = 'none';
      this._active = null;
      if (this.dom) this.dom.style.cursor = ''; // never a stuck pointer cursor
    }
  }

  async _interact() {
    if (this.busy || !this._active || !this.enabled) return;
    const p = this._active;
    this.busy = true;
    this.pill.style.display = 'none';
    Audio.uiClick();
    try { await p.onInteract?.(p); } catch (e) { console.error('[interactables]', e); }
    this.busy = false;
  }

  update() {
    const pp = this.getPlayerPos();

    // triggers
    for (const t of this.triggers) {
      if ((t.once && t.fired) || !t.when()) continue;
      const dx = pp.x - t.x, dz = pp.z - t.z;
      if (dx * dx + dz * dz <= t.r * t.r) {
        t.fired = true;
        try { t.onEnter?.(t); } catch (e) { console.error('[trigger]', e); }
      }
    }

    // prompts
    if (!this.enabled || this.busy) return;
    let best = null;
    let bestD = Infinity;
    for (const p of this.prompts) {
      if (!p.when()) continue;
      const px = p.getPos ? p.getPos().x : p.x;
      const pz = p.getPos ? p.getPos().z : p.z;
      const d = Math.hypot(px - pp.x, pz - pp.z);
      if (d < p.r && d < bestD) { bestD = d; best = p; best._px = px; best._pz = pz; }
    }
    this._active = best;
    if (!best) { this.pill.style.display = 'none'; return; }

    if (!this._v) this._v = this.camera.position.clone();
    this._v.set(best._px, (best.y ?? 0) + (best.lift ?? 1.9), best._pz);
    this._v.project(this.camera);
    if (this._v.z > 1) { this.pill.style.display = 'none'; return; }
    // D9 perf: write the DOM only when something CHANGED (label / >0.5px move)
    // — style writes every frame forced layout while a prompt was on screen.
    const label = this._touch ? `${best.label}` : `[E]  ${best.label}`;
    if (this._lastLabel !== label) { this._label.textContent = label; this._lastLabel = label; }
    const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
    if (Math.abs(x - (this._lastX ?? -9)) > 0.5 || Math.abs(y - (this._lastY ?? -9)) > 0.5) {
      this._lastX = x; this._lastY = y;
      this.pill.style.left = `${x.toFixed(1)}px`;
      this.pill.style.top = `${y.toFixed(1)}px`;
    }
    if (this.pill.style.display !== 'block') this.pill.style.display = 'block';
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    if (this.dom) {
      this.dom.removeEventListener('pointerdown', this._onDown);
      this.dom.removeEventListener('pointermove', this._onMove);
      this.dom.style.cursor = '';
    }
    this.pill.remove();
  }
}
