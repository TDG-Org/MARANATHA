import { Audio } from '../systems/AudioSystem.js';

// Interaction vocabulary for 3D scenes (interaction-design skill):
//  • proximity PROMPTS — one pill above the nearest eligible interactable,
//    tap or E to act; hidden during cutscenes/dialogue (setEnabled).
//  • TRIGGER volumes — circles that fire on enter (once or repeat).
// Prompts/triggers are data; availability is a callback so beats gate them.
export class Interactables {
  constructor({ camera, getPlayerPos }) {
    this.camera = camera;
    this.getPlayerPos = getPlayerPos;
    this.prompts = []; // {id,label,x,z,r,when(),onInteract, _pos}
    this.triggers = []; // {id,x,z,r,once,fired,when(),onEnter}
    this.enabled = true;
    this.busy = false;
    this._active = null;
    this._v = null;

    this.pill = document.createElement('button');
    this.pill.type = 'button';
    this.pill.style.cssText = [
      'position:fixed', 'z-index:36', 'transform:translate(-50%,-50%)',
      'padding:clamp(7px,1.2vw,9px) clamp(12px,1.8vw,15px)', 'border-radius:20px', 'cursor:pointer',
      'font:600 clamp(12px,1.6vw,13.5px) "Segoe UI",system-ui,sans-serif', 'white-space:nowrap',
      'color:#241f38', 'background:rgba(242,184,128,0.94)', 'border:none',
      'box-shadow:0 3px 12px rgba(0,0,0,0.32)', 'display:none', 'pointer-events:auto',
    ].join(';');
    this.pill.onclick = () => this._interact();
    document.body.append(this.pill);

    this._onKey = (e) => { if ((e.key === 'e' || e.key === 'E') && this._active && !this.busy && this.enabled) this._interact(); };
    window.addEventListener('keydown', this._onKey);
  }

  addPrompt(p) { this.prompts.push({ r: 2.8, when: () => true, ...p }); return p; }
  addTrigger(t) { this.triggers.push({ r: 2.5, once: true, fired: false, when: () => true, ...t }); return t; }
  rearmTrigger(id) { const t = this.triggers.find((x) => x.id === id); if (t) t.fired = false; }

  setEnabled(on) {
    this.enabled = on;
    if (!on) { this.pill.style.display = 'none'; this._active = null; }
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
    this.pill.textContent = best.label;
    this.pill.style.left = `${(this._v.x * 0.5 + 0.5) * window.innerWidth}px`;
    this.pill.style.top = `${(-this._v.y * 0.5 + 0.5) * window.innerHeight}px`;
    this.pill.style.display = 'block';
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    this.pill.remove();
  }
}
