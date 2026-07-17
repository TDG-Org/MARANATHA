// The LOADING screen (D6): a small animated mark over the black veil while a
// scene streams its assets (rigs, textures) — the player never watches a
// half-built world assemble. Pure DOM/CSS; no per-frame JS.
export function createLoader() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes mr-load-pulse { 0%,100% { transform: scale(1); opacity: 0.75; } 50% { transform: scale(1.22); opacity: 1; } }
    @keyframes mr-load-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes mr-load-dots { 0%,20% { content: ''; } 40% { content: ' ·'; } 60% { content: ' · ·'; } 80%,100% { content: ' · · ·'; } }
  `;
  document.head.append(style);

  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:58', 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:18px',
    'background:#08070e', 'opacity:0', 'pointer-events:none',
    'transition:opacity 420ms ease',
  ].join(';');

  // a rising sun mark: warm core pulsing inside a slowly orbiting ring of rays
  const mark = document.createElement('div');
  mark.style.cssText = 'position:relative; width:64px; height:64px;';
  const core = document.createElement('div');
  core.style.cssText = [
    'position:absolute', 'inset:18px', 'border-radius:50%',
    'background:radial-gradient(circle, #ffe9c9 0%, #f2b880 70%, rgba(242,184,128,0) 100%)',
    'animation:mr-load-pulse 1.6s ease-in-out infinite',
  ].join(';');
  const ring = document.createElement('div');
  ring.style.cssText = 'position:absolute; inset:0; animation:mr-load-orbit 5s linear infinite;';
  for (let i = 0; i < 8; i++) {
    const ray = document.createElement('div');
    const a = (i / 8) * 360;
    ray.style.cssText = [
      'position:absolute', 'left:50%', 'top:50%', 'width:3px', 'height:10px',
      'border-radius:2px', 'background:rgba(242,184,128,0.65)',
      `transform:rotate(${a}deg) translateY(-27px)`, 'transform-origin:0 0',
    ].join(';');
    ring.append(ray);
  }
  mark.append(ring, core);

  const label = document.createElement('div');
  label.textContent = 'Preparing the land…';
  label.style.cssText = [
    'font-family:Georgia,serif', 'font-size:15px', 'letter-spacing:0.12em',
    'color:#e8d9b8', 'opacity:0.85',
  ].join(';');

  root.append(mark, label);
  document.body.append(root);

  let visible = false;
  return {
    show() {
      visible = true;
      root.style.pointerEvents = 'auto';
      root.style.opacity = '1';
    },
    hide() {
      if (!visible) return Promise.resolve();
      visible = false;
      root.style.opacity = '0';
      root.style.pointerEvents = 'none';
      return new Promise((r) => setTimeout(r, 430));
    },
    destroy() { root.remove(); style.remove(); },
  };
}
