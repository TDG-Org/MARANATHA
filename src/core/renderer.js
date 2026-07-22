import * as THREE from 'three';
import { Graphics } from '../systems/Graphics.js';
import { createFramePacer } from './framePacer.js';

// One renderer for the whole game. No real-time shadows (per the
// performance mandate — lighting is painted into materials and fog),
// so the renderer stays as cheap as WebGL allows.
// D12 power: the GPU PICK follows the Graphics preset — this painterly load
// (≤100 draws, ≤120k tris, unlit/toon) runs great on an integrated GPU, and
// on dual-GPU laptops 'high-performance' would spin up the discrete chip
// (fans + battery) for nothing. High is the deliberate opt-in. The context
// is created once, so a preset change applies on the next reload.
export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: Graphics.name === 'high' ? 'high-performance' : 'low-power',
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
// D12/D15 POWER GOVERNOR: getFps() is asked every display callback. Ticks
// above the requested rate are SKIPPED WHOLE — no update,
// no render, no compositor commit, no GPU frame. That skip is where the
// power goes: a calm ambient idle at eco-30 does roughly half the machine's
// per-second work while staying film-smooth for slow motion. The app snaps
// back to 60 the instant anything can move fast (see app.js). Deadline pacing
// also keeps 120/144/165/240Hz panels from rendering the game above 60fps.
export function startLoop(tick, getFps = () => 60) {
  let raf = 0;
  let running = false;
  const pacer = createFramePacer(performance.now());

  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const fps = getFps();
    if (!pacer.advance(now, fps)) return;
    tick(pacer.dt, now, fps);
  };

  const start = () => {
    if (running) return;
    running = true;
    pacer.reset(performance.now());
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
