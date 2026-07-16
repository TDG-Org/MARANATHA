// A reusable on-screen thumbstick for touch devices. Returns an analog vector
// in [-1..1] (x right, y down). Repositions per responsive-ui. The 2D story
// controller keeps its own inline stick; this is for the 3D controllers.
export class Joystick {
  constructor({ side = 'left' } = {}) {
    this.vec = { x: 0, y: 0 };
    this.active = false;
    this.enabled = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (!this.enabled) return;

    const base = document.createElement('div');
    const posX = side === 'left'
      ? 'left:calc(20px + env(safe-area-inset-left))'
      : 'right:calc(20px + env(safe-area-inset-right))';
    base.style.cssText = [
      'position:fixed', posX, 'bottom:calc(22px + env(safe-area-inset-bottom))', 'z-index:35',
      'width:clamp(96px,26vw,132px)', 'height:clamp(96px,26vw,132px)', 'border-radius:50%',
      'touch-action:none', 'background:rgba(16,14,26,0.26)',
      'border:1px solid rgba(255,255,255,0.16)', 'backdrop-filter:blur(2px)',
    ].join(';');
    const thumb = document.createElement('div');
    thumb.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%', 'width:44%', 'height:44%',
      'margin:-22% 0 0 -22%', 'border-radius:50%',
      'background:rgba(242,184,128,0.5)', 'border:1px solid rgba(255,255,255,0.3)',
      'transition:transform 60ms linear',
    ].join(';');
    base.append(thumb);
    document.body.append(base);
    this.base = base;

    const R = () => base.getBoundingClientRect().width * 0.38;
    let id = null;
    const set = (ev) => {
      const r = base.getBoundingClientRect();
      let dx = ev.clientX - (r.left + r.width / 2);
      let dy = ev.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy) || 1;
      const cap = Math.min(len, R());
      dx = (dx / len) * cap; dy = (dy / len) * cap;
      thumb.style.transform = `translate(${dx}px, ${dy}px)`;
      this.vec.x = dx / R(); this.vec.y = dy / R();
      this.active = true;
    };
    base.addEventListener('pointerdown', (e) => { id = e.pointerId; base.setPointerCapture?.(id); set(e); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e); });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      this.reset();
    };
    base.addEventListener('pointerup', end);
    base.addEventListener('pointercancel', end);
    // If the capture is torn away without a pointerup/cancel (OS overlay,
    // screenshot gesture, focus loss), the stick must not stay latched.
    base.addEventListener('lostpointercapture', () => { id = null; this.reset(); });
    this._onBlur = () => { id = null; this.reset(); };
    window.addEventListener('blur', this._onBlur);
    this._thumb = thumb;
  }

  // Zero the stick (input hardening — also called by the controller on
  // blur/visibilitychange/contextmenu). Safe when the stick isn't mounted.
  reset() {
    this.vec.x = 0;
    this.vec.y = 0;
    this.active = false;
    if (this._thumb) this._thumb.style.transform = 'translate(0,0)';
  }

  dispose() {
    if (this._onBlur) window.removeEventListener('blur', this._onBlur);
    this.base?.remove();
  }
}
