import * as THREE from 'three';

// One renderer for the whole game. No real-time shadows (per the
// performance mandate — lighting is painted into materials and fog),
// so the renderer stays as cheap as WebGL allows.
export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  return renderer;
}

// requestAnimationFrame loop that PAUSES when the tab is hidden (zero GPU/
// CPU burned in the background) and clamps dt so a stall never teleports
// animation state.
export function startLoop(tick) {
  let raf = 0;
  let last = performance.now();
  let running = false;

  const frame = (now) => {
    const dt = Math.min(now - last, 100);
    last = now;
    tick(dt, now);
    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  start();
  return { start, stop };
}
