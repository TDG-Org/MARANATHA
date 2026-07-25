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
  let gap = 0;
  let running = false;
  let enabled = true;
  let visible = !document.hidden;
  const pacer = createFramePacer(performance.now());

  // Skipping the WORK is only half the saving; the other half is not waking up
  // at all. Chained straight, rAF calls back at the panel's refresh rate — 144
  // or 240 times a second on the machines this is meant to run cool on — and
  // each of those wake-ups asked getFps(), consulted the scene, and returned.
  // The CPU never got to sleep between eco frames, which is exactly where deep
  // idle (and the fan) is won.
  //
  // Below the display rate, the next request is deferred by a timer until the
  // frame is nearly due. Responsiveness is untouched: the pacer already only
  // acted every 33ms in eco, so the first frame after a keypress arrives no
  // later than it did before — the difference is the ~110 empty callbacks a
  // second that used to happen in between.
  // ONLY below 60. At full rate the loop must stay chained to rAF: a timer is
  // not aligned to vsync, and trading vsync for a timer at 60fps buys nothing
  // and costs judder. The saving is in eco, where two frames in three were
  // empty callbacks anyway.
  const ARM_EARLY_MS = 2; // wake just before the deadline; rAF aligns the rest
  const FULL_RATE = 60;
  const arm = (fps, delay) => {
    if (fps < FULL_RATE && delay > ARM_EARLY_MS) {
      gap = setTimeout(() => { gap = 0; if (running) raf = requestAnimationFrame(frame); }, delay - ARM_EARLY_MS);
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  const frame = (now) => {
    if (!running) return;
    const fps = getFps();
    if (!pacer.advance(now, fps)) {
      arm(fps, pacer.timeUntilDue(now));
      return;
    }
    tick(pacer.dt, now, fps);
    arm(fps, pacer.timeUntilDue(performance.now()));
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
    if (gap) { clearTimeout(gap); gap = 0; }
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
