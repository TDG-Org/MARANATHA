import * as THREE from 'three';
import { Graphics } from '../systems/Graphics.js';
import { createFramePacer } from './framePacer.js';

// One renderer for the whole game. No real-time shadows (per the
// performance mandate — lighting is painted into materials and fog),
// so the renderer stays as cheap as WebGL allows.
// THE GPU PICK.
//
// D12 asked for 'low-power' on anything but an explicit High, reasoning that a
// painterly ≤100-draw scene does not need a discrete chip. Combined with D16
// capping automatic quality at Medium and never promoting, that had a
// consequence nobody intended: **a gaming PC ran the whole game on its
// integrated GPU, forever**, unless the player happened to open Settings and
// pick High by hand. On a desktop whose monitor hangs off the discrete card,
// that is not merely slower — every frame is rendered on the weak chip and then
// copied across. It is the difference between 25fps and a locked 60.
//
// 'default' is the correct request for an unknown machine: the browser already
// knows whether it is on mains or battery, which GPU drives the display, and
// what the OS power profile says. We only override it when we actually know
// better than the browser does:
//   · explicit High  -> 'high-performance' (the player asked for the good one)
//   · Low, or a phone -> 'low-power' (battery and heat are the real budget)
// The context is created once, so a preset change applies on the next reload.
export function rendererPowerPreference(graphics = Graphics) {
  if (graphics?.provenance === 'explicit' && graphics?.name === 'high') return 'high-performance';
  const nav = globalThis.navigator || {};
  const mobile = /Android|iPhone|iPad|Mobi/i.test(nav.userAgent || '');
  if (graphics?.name === 'low' || mobile) return 'low-power';
  return 'default';
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
  let wokeChained = false; // was THIS callback scheduled straight off rAF?
  const pacer = createFramePacer(performance.now());
  // A phone (or an explicit Low) would rather render an even 45 than an uneven
  // 60; a desktop would rather have the extra frames. Read live so changing the
  // preset takes effect without a reload.
  const mobile = /Android|iPhone|iPad|Mobi/i.test(globalThis.navigator?.userAgent || '');

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
  // WAKE EARLY ENOUGH TO CATCH THE RIGHT VSYNC.
  //
  // The timer does not draw the frame — it only asks for the next rAF, and that
  // request lands on the NEXT vsync. Windows timers routinely fire several
  // milliseconds late, so a 2ms margin meant a slightly late timer missed its
  // vsync entirely and the frame arrived a whole refresh period afterwards:
  // 50/17/50/17 instead of a steady 33/33. That averages out to roughly the
  // right number and looks like judder, which is the worst possible outcome for
  // a change made in the name of smoothness. Half a 60Hz period of slack costs
  // a couple of cheap callbacks and buys the alignment back.
  // The timer does not draw the frame — it only asks for the next rAF, and that
  // request lands on the NEXT vsync. Now that a frame admitted late RE-ANCHORS
  // the rhythm (rather than catching up with a short frame, which looks worse),
  // a timer that fires after its deadline costs a whole refresh EVERY frame —
  // a 60Hz eco measured 20fps instead of 30 under 9ms of slop. The margin has
  // to beat realistic Windows timer slop; it is paid for in a couple of cheap
  // callbacks that return immediately.
  const ARM_EARLY_MS = 12;
  // Sleep only for a genuinely slow pace. Every full-rate cadence the display
  // can serve — 144, 120, 90, 72, 60, 55 — stays chained to rAF so its frames
  // land ON vsync; a timer is for eco, where two frames in three were empty
  // callbacks anyway. (Before the pacer snapped to the panel, this compared
  // against a flat 60 and would now put an even 72fps on a timer.)
  const CHAIN_ABOVE_FPS = 45;
  const arm = (delay) => {
    const paced = pacer.pacedFps;
    if (paced > 0 && paced < CHAIN_ABOVE_FPS && delay > ARM_EARLY_MS) {
      gap = setTimeout(() => {
        gap = 0;
        if (!running) return;
        wokeChained = false;
        raf = requestAnimationFrame(frame);
      }, delay - ARM_EARLY_MS);
      return;
    }
    wokeChained = true;
    raf = requestAnimationFrame(frame);
  };

  const frame = (now) => {
    if (!running) return;
    // Measure the panel BEFORE pacing to it (see framePacer): only a chained
    // callback is exactly one refresh after the last.
    pacer.observe(now, wokeChained);
    pacer.allowOvershoot = !mobile && Graphics?.name !== 'low';
    const fps = getFps(pacer.displayHz);
    if (!pacer.advance(now, fps)) {
      arm(pacer.timeUntilDue(now));
      return;
    }
    tick(pacer.dt, now, pacer.pacedFps || fps, pacer);
    arm(pacer.timeUntilDue(performance.now()));
  };

  const startInternal = () => {
    if (running || !enabled || !visible) return;
    running = true;
    pacer.reset(performance.now());
    wokeChained = false;
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
