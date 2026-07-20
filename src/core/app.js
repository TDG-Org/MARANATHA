import * as THREE from 'three';
import { createRenderer, startLoop } from './renderer.js';
import { detectTier, AdaptiveQuality, DebugHud } from './quality.js';
import { disposeDeep } from './dispose.js';
import { createVeil } from '../ui/veil.js';
import { createLoader } from '../ui/loader.js';
import { Settings } from '../systems/Settings.js';
import { Graphics } from '../systems/Graphics.js';
import { PostFX } from '../engine/PostFX.js';

// The app shell: owns the renderer, camera, loop, adaptive quality, and the
// always-on perf HUD, and manages screens (home, joseph, …). Each screen is a
// builder ({ scene, camera, renderer, app, params }) → { update, dispose } per
// the game-scene contract. Transitions fade through black — never a hard cut.
export function createApp(container) {
  const renderer = createRenderer(container);
  const { tier } = detectTier();
  // The DPR ceiling comes from the player's Graphics Quality preset (Low/Med/
  // High); AdaptiveQuality may still shed BELOW it on a struggling device.
  const dpr = () => window.devicePixelRatio || 1;
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: Math.min(dpr(), Graphics.dprCap) });
  Graphics.subscribe(() => {
    quality.base = Math.min(dpr(), Graphics.dprCap);
    quality.recovered = false;
    quality.set(quality.base); // apply the new DPR ceiling live
  });
  // Guard the aspect: a tab booted in the background can report 0×0 —
  // 0/0 = NaN would poison the projection matrix until the next resize.
  const safeAspect = () => (window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9);
  const camera = new THREE.PerspectiveCamera(46, safeAspect(), 0.1, 900);
  const hud = new DebugHud(renderer);
  Settings.bindHud(hud); // apply the player's saved HUD-visibility choice

  const veil = createVeil();
  const loader = createLoader();
  // D6: ONE PostFX owns the canvas grade + named filters for every scene.
  const postFX = new PostFX(renderer.domElement);
  const screens = new Map(); // key -> builder
  let current = null;        // { key, scene, instance }
  let busy = false;
  let updateErrors = 0;

  // Responsive: keep the renderer + camera matched to the viewport across
  // resize, orientation change, iOS visualViewport shifts, and container resize
  // (ResizeObserver is the robust catch-all — `resize` alone is unreliable on
  // mobile). DPR stays clamped ≤2 (detectTier + AdaptiveQuality).
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return; // a hidden/zero-sized pass must never poison aspect
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(2, quality.ratio));
    renderer.setSize(w, h);
    pausedPainted = false; // a paused game repaints once after a resize
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(container);

  function build(key, params) {
    const builder = screens.get(key);
    const scene = new THREE.Scene();
    let instance;
    try {
      instance = builder({ scene, camera, renderer, app, params }) || {};
    } catch (e) {
      console.error(`[app] screen "${key}" failed to build`, e);
      instance = {};
    }
    current = { key, scene, instance };
  }

  async function navigate(key, params) {
    if (busy) return;
    if (!screens.has(key)) { console.warn(`[app] no screen "${key}"`); return; }
    navT = performance.now(); // scene-entry grace: reveals glide at full rate
    busy = true;
    const first = !current;
    if (!first) await veil.cover(460);
    if (current) {
      try { current.instance.dispose?.(); } catch (e) { console.error('[app] dispose error', e); }
      disposeDeep(current.scene);
      postFX.reset(); // a scene's filter never leaks into the next
    }
    updateErrors = 0;
    build(key, params);
    // LOADING SCREEN (D6): if the scene streams assets (rigs, textures), it
    // returns `whenReady` — hold the animated loader over the veil until it
    // resolves, so the player NEVER sees a half-built world. 12s hang-guard:
    // a stuck download degrades to the old reveal, never a black screen.
    const ready = current.instance.whenReady;
    if (ready?.then) {
      loader.show();
      await Promise.race([ready, new Promise((r) => setTimeout(r, 12000))]);
      await loader.hide();
    }
    renderer.render(current.scene, camera); // paint one frame before revealing
    await veil.reveal(first ? 900 : 620);
    busy = false;
  }

  let paused = false;      // true pause: update frozen
  let pausedPainted = false; // D6 energy rule: paint the frozen frame ONCE, then stop rendering

  // ── D12 POWER GOVERNOR ─────────────────────────────────────────────────────
  // Full 60fps whenever the moment can move fast: any input in the last ~1.6s,
  // a fresh scene entry (reveal glides), or whatever the scene itself flags
  // through instance.fullRate() (cutscenes, narration, dialogue, camera moves,
  // player/scripted motion, fleeing sheep…). Pure ambient idle — a parked home
  // screen, a player standing in the camp — renders at ECO 30: half the
  // machine's per-second work, invisible on slow painterly motion, and the
  // FIRST input snaps it back to 60 before the player's action even lands.
  const POWER = { ecoFps: 30, activeMs: 1600, graceMs: 3000 };
  let lastInput = performance.now();
  let navT = performance.now();
  let liveFps = 60; // what the loop actually ran this tick (for #debug honesty)
  const noteActivity = () => { lastInput = performance.now(); };
  window.addEventListener('pointerdown', noteActivity, { passive: true });
  window.addEventListener('pointermove', noteActivity, { passive: true });
  window.addEventListener('keydown', noteActivity, { passive: true });
  window.addEventListener('wheel', noteActivity, { passive: true });
  window.addEventListener('touchstart', noteActivity, { passive: true });
  const targetFps = () => {
    const now = performance.now();
    if (now - lastInput < POWER.activeMs) return 60;
    if (now - navT < POWER.graceMs) return 60;
    if (current?.instance?.fullRate?.()) return 60;
    return POWER.ecoFps;
  };

  const app = {
    camera,
    renderer,
    tier,
    postFX,
    register(key, builder) { screens.set(key, builder); },
    hasScreen(key) { return screens.has(key); },
    navigate,
    get currentKey() { return current?.key; },
    setPaused(on) { paused = !!on; pausedPainted = false; },
    get paused() { return paused; },
    // Test hooks (harmless in production; used by automated pixel-readback since
    // the preview tab runs hidden and rAF/screenshots are paused there).
    get scene() { return current?.scene; },
    get instance() { return current?.instance; },
    get power() { return { fps: liveFps, eco: liveFps < 60 }; },
  };

  startLoop((dt, now, fps) => {
    liveFps = fps;
    let updMs = 0, subMs = 0;
    if (current) {
      if (!paused) {
        const t0 = performance.now();
        try {
          current.instance.update?.(dt, now);
        } catch (e) {
          if (updateErrors++ < 3) console.error('[app] update error', e);
        }
        const t1 = performance.now();
        renderer.render(current.scene, camera);
        subMs = performance.now() - t1;
        updMs = t1 - t0;
      } else if (!pausedPainted) {
        // energy rule (D6): a paused game paints its frozen frame ONCE — the
        // GPU sleeps until resume or resize (DOM pause menu needs no canvas).
        renderer.render(current.scene, camera);
        pausedPainted = true;
      }
    }
    // Adaptive quality reads REAL frame pressure only — an eco-governed 33ms
    // frame is design, not a struggling device, and must never shed DPR.
    // Same rule for the Graphics auto-tuner: it judges the machine on
    // full-rate frames alone, and only while the preset is still auto.
    if (!paused && fps >= 60) { quality.frame(dt); Graphics.sampleFrame(dt); }
    // D9: the perf HUD splits SCRIPT time vs RENDER-SUBMIT time — if fps is
    // low while both are tiny, the cost lives in the compositor/GPU (filters,
    // resolution), not in the game code. That split diagnoses any device.
    // D12: an eco-governed tick is LABELED so a 30fps reading is never
    // mistaken for lag.
    hud.frame(dt, updMs, subMs, fps < 60);
  }, targetFps);

  return app;
}
