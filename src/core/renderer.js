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
export function rendererPowerPreference(graphics = Graphics) {
  return graphics?.provenance === 'explicit' && graphics?.name === 'high'
    ? 'high-performance'
    : 'low-power';
}

// Low is the explicit/budget-device preset: at its 1x DPR, disabling MSAA
// removes a full multisample resolve and extra color/depth storage. Medium and
// High retain the signed-off edge quality.
export function rendererAntialias(graphics = Graphics) {
  return graphics?.name !== 'low';
}

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: rendererAntialias(Graphics),
    powerPreference: rendererPowerPreference(Graphics),
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
  let enabled = true;
  let visible = !document.hidden;
  const pacer = createFramePacer(performance.now());

  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const fps = getFps();
    if (!pacer.advance(now, fps)) return;
    tick(pacer.dt, now, fps);
  };

  const startInternal = () => {
    if (running || !enabled || !visible) return;
    running = true;
    pacer.reset(performance.now());
    raf = requestAnimationFrame(frame);
  };
  const stopInternal = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  // Public start/stop are an ownership latch (navigation/pause), distinct from
  // visibility. Showing a tab must never restart a loop the app deliberately
  // stopped for a pause or loading gate.
  const start = () => { enabled = true; startInternal(); };
  const stop = () => { enabled = false; stopInternal(); };

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (!visible) stopInternal();
    else startInternal();
  });

  startInternal();
  return { start, stop };
}
