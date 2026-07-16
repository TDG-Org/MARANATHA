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
      'position:absolute', 'transform-origin:center bottom', 'white-space:nowrap',
      'padding:3px 10px', 'border-radius:9px',
      'font:600 clamp(11px,1.5vw,13px) "Segoe UI",system-ui,sans-serif',
      'color:#fdf6e3', 'background:rgba(16,14,26,0.62)',
      'border:1px solid rgba(242,184,128,0.28)', 'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
      'will-change:transform,left,top', 'transition:opacity 200ms ease',
    ].join(';');
    layer.append(el);
    const tag = { character, el, maxDist };
    tags.push(tag);
    return tag;
  }

  function update(camera) {
    const W = window.innerWidth, H = window.innerHeight;
    if (!scratch) scratch = new (camera.position.constructor)();
    const p = scratch;
    for (const tag of tags) {
      const c = tag.character;
      p.copy(c.position);
      p.y += (c.headHeight || 1.7) + 0.15;
      p.project(camera);
      const dist = camera.position.distanceTo(c.position);
      if (p.z > 1 || dist > tag.maxDist) { tag.el.style.opacity = '0'; continue; }
      const x = (p.x * 0.5 + 0.5) * W;
      const y = (-p.y * 0.5 + 0.5) * H;
      // Clamp on-screen scale so the tag is readable close AND far.
      const scale = clamp(1.15 - dist * 0.02, 0.62, 1.0);
      tag.el.style.left = `${x}px`;
      tag.el.style.top = `${y}px`;
      tag.el.style.transform = `translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      tag.el.style.opacity = dist > tag.maxDist * 0.85 ? '0.45' : '1';
    }
  }

  function destroy() { layer.remove(); tags.length = 0; }
  return { add, update, destroy, layer };
}
