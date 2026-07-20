import { clamp } from '../engine/world.js';

// Name tags above named 3D characters — crisp DOM (not in-canvas), projected to
// the head each frame, with CLAMPED scale so they stay readable near and far,
// and styled to match the game UI (character-design skill).
export function createNameTags() {
  const layer = document.createElement('div');
  layer.style.cssText = 'position:fixed; inset:0; z-index:34; pointer-events:none; overflow:hidden;';
  document.body.append(layer);

  const tags = [];
  let scratch = null; // reused Vector3 for projection (no per-frame alloc)
  function add(character, text, { maxDist = 42 } = {}) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = [
      // pinned at 0,0 — ALL positioning happens in the composited transform
      'position:absolute', 'left:0', 'top:0', 'transform-origin:center bottom', 'white-space:nowrap',
      'padding:3px 10px', 'border-radius:9px',
      'font:600 clamp(11px,1.5vw,13px) "Segoe UI",system-ui,sans-serif',
      'color:#fdf6e3', 'background:rgba(16,14,26,0.62)',
      'border:1px solid rgba(242,184,128,0.28)', 'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
      'will-change:transform,left,top', 'transition:opacity 200ms ease',
    ].join(';');
    layer.append(el);
    // D9 perf: position via ONE composited transform (left/top writes forced a
    // layout pass per tag per frame), and skip DOM writes entirely when the
    // value hasn't meaningfully changed.
    const tag = { character, el, maxDist, lx: -1, ly: -1, ls: -1, lo: '' };
    tags.push(tag);
    return tag;
  }

  function update(camera, dt = 16.7) {
    const W = window.innerWidth, H = window.innerHeight;
    if (!scratch) scratch = new (camera.position.constructor)();
    const p = scratch;
    // D11 (Nate: "the names are jittering"): the old 0.5px change-gate made
    // tags SNAP in half-pixel steps as the camera breathed. Positions are now
    // temporally SMOOTHED (frame-rate-safe damping) and written sub-pixel —
    // still one composited transform, no layout.
    const k = 1 - Math.exp(-dt * 0.028);
    for (const tag of tags) {
      const c = tag.character;
      p.copy(c.position);
      p.y += (c.headHeight || 1.7) + 0.15;
      p.project(camera);
      const dist = camera.position.distanceTo(c.position);
      if (p.z > 1 || dist > tag.maxDist) {
        if (tag.lo !== '0') { tag.el.style.opacity = '0'; tag.lo = '0'; }
        tag.lx = -1; // re-appearing tags snap to place, never glide across
        continue;
      }
      const x = (p.x * 0.5 + 0.5) * W;
      const y = (-p.y * 0.5 + 0.5) * H;
      // Clamp on-screen scale so the tag is readable close AND far.
      const scale = clamp(1.15 - dist * 0.02, 0.62, 1.0);
      if (tag.lx === -1) { tag.lx = x; tag.ly = y; tag.ls = scale; } // (re)appear: snap
      else {
        tag.lx += (x - tag.lx) * k;
        tag.ly += (y - tag.ly) * k;
        tag.ls += (scale - tag.ls) * k;
      }
      const wx = tag.lx, wy = tag.ly;
      if (wx !== tag.wx || wy !== tag.wy || tag.ls !== tag.ws) {
        tag.wx = wx; tag.wy = wy; tag.ws = tag.ls;
        tag.el.style.transform = `translate3d(${wx.toFixed(2)}px, ${wy.toFixed(2)}px, 0) translate(-50%, -100%) scale(${tag.ls.toFixed(3)})`;
      }
      const op = dist > tag.maxDist * 0.85 ? '0.45' : '1';
      if (tag.lo !== op) { tag.el.style.opacity = op; tag.lo = op; }
    }
  }

  function destroy() { layer.remove(); tags.length = 0; }
  return { add, update, destroy, layer };
}
