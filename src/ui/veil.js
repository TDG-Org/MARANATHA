// A full-screen fade overlay used for every screen transition — no hard cuts,
// ever (art-style). Starts opaque so the very first screen fades up from black.
export function createVeil() {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'inset:0', 'background:#0a0a12', 'opacity:1',
    'pointer-events:none', 'z-index:60', 'transition:opacity 0ms',
  ].join(';');
  document.body.appendChild(el);

  function to(opacity, ms) {
    return new Promise((resolve) => {
      el.style.transition = `opacity ${ms}ms ease`;
      void el.offsetWidth; // force reflow so the transition actually runs
      el.style.opacity = String(opacity);
      // Block clicks while the world is hidden; pass them through when clear.
      el.style.pointerEvents = opacity > 0.98 ? 'auto' : 'none';
      setTimeout(resolve, ms + 20);
    });
  }

  return {
    el,
    cover(ms = 480) { return to(1, ms); },  // fade to black
    reveal(ms = 560) { return to(0, ms); }, // fade from black
  };
}
