import { Audio } from '../../systems/AudioSystem.js';
import { isAbortError } from '../../core/async.js';

// NPC interaction: NPCs stand in the world; when the player comes near, a
// "Talk to <name>" prompt appears above them (E key or tap), and on the very
// first meeting a nameplate introduces who they are (character-design skill).
// The scene supplies each NPC's onInteract (usually opening dialogue) and
// freezes the player while it runs.
export class Interaction {
  constructor({ camera, getPlayerPos }) {
    this.camera = camera;
    this.getPlayerPos = getPlayerPos;
    this.npcs = [];
    this.enabled = true;
    this.busy = false;
    this._active = null;

    this.prompt = document.createElement('button');
    this.prompt.type = 'button';
    this.prompt.style.cssText = [
      'position:fixed', 'z-index:36', 'transform:translate(-50%,-50%)',
      'padding:7px 13px', 'border-radius:20px', 'cursor:pointer',
      'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:13px', 'white-space:nowrap',
      'color:#241f38', 'background:rgba(242,184,128,0.92)', 'border:none',
      'box-shadow:0 3px 12px rgba(0,0,0,0.3)', 'display:none', 'pointer-events:auto',
    ].join(';');
    this.prompt.onclick = () => this._interact();
    document.body.append(this.prompt);

    this.plate = document.createElement('div');
    this.plate.style.cssText = [
      'position:fixed', 'z-index:36', 'transform:translate(-50%,-50%)',
      'padding:4px 11px', 'border-radius:9px', 'pointer-events:none',
      'font-family:"Segoe UI",system-ui,sans-serif', 'font-size:12.5px', 'white-space:nowrap',
      'color:#fdf6e3', 'background:rgba(16,14,26,0.7)', 'border:1px solid rgba(242,184,128,0.3)',
      'opacity:0', 'transition:opacity 350ms ease', 'display:none',
    ].join(';');
    document.body.append(this.plate);
    this._plateFor = null;
    this._plateT = 0;

    this._onKey = (e) => { if ((e.key === 'e' || e.key === 'E') && this._active && !this.busy) this._interact(); };
    window.addEventListener('keydown', this._onKey);

    this._v = null; // lazy scratch vector (grabbed from an npc position)
  }

  add(npc) {
    this.npcs.push({ radius: 2.8, met: false, ...npc });
    return npc;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) { this.prompt.style.display = 'none'; this._active = null; }
  }

  async _interact() {
    if (this.busy || !this._active) return;
    const npc = this._active;
    this.busy = true;
    this.prompt.style.display = 'none';
    Audio.uiClick();
    try { await npc.onInteract?.(npc); }
    catch (e) { if (!isAbortError(e)) console.error('[interaction] onInteract', e); }
    this.busy = false;
  }

  _project(pos, yLift) {
    const p = pos.clone();
    p.y += yLift;
    p.project(this.camera);
    return {
      x: (p.x * 0.5 + 0.5) * window.innerWidth,
      y: (-p.y * 0.5 + 0.5) * window.innerHeight,
      inFront: p.z < 1,
    };
  }

  update(dt) {
    // Idle-animate the NPCs (breath + billboard).
    for (const npc of this.npcs) npc.character.animate(dt, this.camera, 0, 0);

    if (!this.enabled || this.busy) return;

    const pp = this.getPlayerPos();
    let nearest = null;
    let bestD = Infinity;
    for (const npc of this.npcs) {
      const cp = npc.character.position;
      const d = Math.hypot(cp.x - pp.x, cp.z - pp.z);
      if (d < npc.radius && d < bestD) { bestD = d; nearest = npc; }
      // First-meeting nameplate: shows when the player first gets close.
      if (!npc.met && d < npc.radius + 1.2) {
        npc.met = true;
        this._showPlate(npc);
      }
    }

    this._active = nearest;
    if (nearest) {
      const s = this._project(nearest.character.position, nearest.character.height * 0.92);
      if (s.inFront) {
        this.prompt.textContent = `Talk to ${nearest.name}`;
        this.prompt.style.left = `${s.x}px`;
        this.prompt.style.top = `${s.y}px`;
        this.prompt.style.display = 'block';
      } else {
        this.prompt.style.display = 'none';
      }
    } else {
      this.prompt.style.display = 'none';
    }

    // Nameplate follow + fade-out.
    if (this._plateFor) {
      this._plateT -= dt;
      const s = this._project(this._plateFor.character.position, this._plateFor.character.height * 1.05);
      this.plate.style.left = `${s.x}px`;
      this.plate.style.top = `${s.y}px`;
      if (this._plateT <= 0) {
        this.plate.style.opacity = '0';
        if (this._plateT < -400) { this.plate.style.display = 'none'; this._plateFor = null; }
      }
    }
  }

  _showPlate(npc) {
    this._plateFor = npc;
    this._plateT = 2600;
    this.plate.textContent = npc.tag ? `${npc.name} · ${npc.tag}` : npc.name;
    this.plate.style.display = 'block';
    requestAnimationFrame(() => { this.plate.style.opacity = '1'; });
  }

  dispose() {
    window.removeEventListener('keydown', this._onKey);
    this.prompt.remove();
    this.plate.remove();
  }
}
