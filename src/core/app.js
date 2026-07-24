import * as THREE from 'three';
import { createRenderer, startLoop } from './renderer.js';
import { detectTier, AdaptiveQuality, DebugHud } from './quality.js';
import { disposeDeep } from './dispose.js';
import { createVeil } from '../ui/veil.js';
import { createLoader } from '../ui/loader.js';
import { Settings } from '../systems/Settings.js';
import { Graphics } from '../systems/Graphics.js';
import { PostFX } from '../engine/PostFX.js';
import { makeAbortError } from './async.js';
import { waitWithDeadline } from './deadline.js';
import { resolveLazyScreen } from './lazyScreen.js';

// The app shell: owns the renderer, camera, loop, adaptive quality, and the
// always-on perf HUD, and manages screens (home, joseph, …). Each screen is a
// builder ({ scene, camera, renderer, app, params }) → { update, dispose,
// whenReady?, activate? } per the game-scene contract. Readiness prepares;
// activation starts story time only after reveal. Transitions fade through
// black — never a hard cut.
export function createApp(container) {
  const renderer = createRenderer(container);
  const { tier } = detectTier();
  // The DPR ceiling comes from the player's Graphics Quality preset (Low/Med/
  // High); AdaptiveQuality may still shed BELOW it on a struggling device.
  const dpr = () => window.devicePixelRatio || 1;
  const quality = new AdaptiveQuality(renderer, { basePixelRatio: Math.min(dpr(), Graphics.dprCap) });
  Graphics.subscribe((graphics, change) => {
    const base = Math.min(dpr(), graphics.dprCap);
    // Automatic demotion may only lower the current DPR. A player explicitly
    // choosing a preset may restore that preset's complete DPR ceiling.
    quality.setBase(base, { raise: change?.source === 'explicit' });
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
  const screens = new Map(); // key -> { builder } or { load, promise, builder }
  let current = null;        // { key, scene, instance, lifetime }
  let busy = false;
  let updateErrors = 0;
  let loopController = null;

  // Responsive: keep the renderer + camera matched to the viewport across
  // resize, orientation change, iOS visualViewport shifts, and container resize
  // (ResizeObserver is the robust catch-all — `resize` alone is unreliable on
  // mobile). DPR stays clamped ≤2 (detectTier + AdaptiveQuality).
  const onResize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return; // a hidden/zero-sized pass must never poison aspect
    // A window moved to a lower-DPR display (or browser zoomed out) must shed
    // its old oversized buffer immediately. Native-DPR increases stay sticky
    // down until the player explicitly reselects a preset.
    quality.setBase(Math.min(dpr(), Graphics.dprCap), { raise: false });
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(2, quality.ratio));
    renderer.setSize(w, h);
    pausedPainted = false;
    if (paused && current && !busy) {
      renderer.render(current.scene, camera);
      pausedPainted = true;
    }
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(container);

  async function build(key, params) {
    const entry = screens.get(key);
    const scene = new THREE.Scene();
    const lifetime = new AbortController();
    try {
      let builder = entry.builder;
      if (!builder) {
        builder = await resolveLazyScreen(entry, key);
      }
      const instance = builder({ scene, camera, renderer, app, params, signal: lifetime.signal }) || {};
      current = { key, scene, instance, lifetime };
    } catch (e) {
      lifetime.abort(makeAbortError(`Screen "${key}" failed to build`));
      disposeDeep(scene);
      throw e;
    }
  }

  function disposeCurrent(reason = 'Screen retired') {
    if (!current) return;
    current.lifetime.abort(makeAbortError(reason));
    try { current.instance.dispose?.(); } catch (e) { console.error('[app] dispose error', e); }
    disposeDeep(current.scene);
    postFX.reset();
    current = null;
  }

  async function navigate(key, params) {
    if (busy) return;
    if (!screens.has(key)) { console.warn(`[app] no screen "${key}"`); return; }
    navT = performance.now(); // scene-entry grace: reveals glide at full rate
    busy = true;
    // The loader/veil are CSS-owned. Stop all game callbacks and GPU submits
    // while imports, fetch/decode, and shader pre-warm compete for the device.
    loopController?.stop();
    let loaderVisible = false;
    try {
      const first = !current;
      // Abort first: scene-owned waits, motion, narration, and camera work all
      // stand down while the veil covers instead of running behind the exit.
      current?.lifetime.abort(makeAbortError(`Leaving screen "${current.key}"`));
      if (!first) await veil.cover(460);
      disposeCurrent(`Leaving screen "${current?.key || 'unknown'}"`);
      updateErrors = 0;
      const entry = screens.get(key);
      if (!entry.builder) {
        loader.show();
        loaderVisible = true;
      }
      try {
        await build(key, params);
      } catch (error) {
        console.error(`[app] screen "${key}" failed to build; returning home`, error);
        if (key === 'home') throw error;
        // A missing/stalled chunk never reveals an empty scene. The home map
        // is bundled eagerly and gives the player visible retry/reload choices.
        await build('home', { loadError: { key, phase: 'screen' } });
      }
      // LOADING SCREEN (D6): if the scene streams assets (rigs, textures), it
      // returns `whenReady` — hold the animated loader over the veil until it
      // resolves, so the player NEVER sees a half-built world. The 12s guard
      // retires a stalled scene and returns to an actionable home-screen
      // recovery instead of revealing incomplete work or holding black forever.
      const readyKey = current.key;
      const ready = current.instance.whenReady;
      if (ready?.then) {
        if (!loaderVisible) {
          loader.show();
          loaderVisible = true;
        }
        try {
          const readyResult = await waitWithDeadline(
            ready,
            12000,
            `Screen "${readyKey}" readiness timed out`,
            { rejectOnTimeout: false },
          );
          if (readyResult === false) {
            throw new Error(`Screen "${readyKey}" readiness timed out`);
          }
        } catch (error) {
          console.error(`[app] screen "${readyKey}" failed while loading; returning home`, error);
          if (readyKey === 'home') throw error;
          // Never reveal a scene whose minimum readiness contract rejected or
          // missed its deadline. Dispose it behind the opaque veil, then show
          // the safe eager home screen with an actionable recovery message.
          disposeCurrent(`Screen "${readyKey}" failed readiness`);
          await build('home', { loadError: { key: readyKey, phase: 'assets' } });
        }
      }
      if (loaderVisible) {
        await loader.hide();
        loaderVisible = false;
      }
      // One controlled zero-dt preparation pass establishes camera/projections
      // (notably Home's authored vista) without advancing story or animation.
      // No ongoing update/render work runs behind the readiness loader.
      try { current.instance.update?.(0, performance.now()); } catch (error) {
        console.error(`[app] screen "${current.key}" preparation error`, error);
      }
      renderer.render(current.scene, camera); // paint one frame before revealing
      await veil.reveal(first ? 900 : 620);
      current.instance.activate?.();
    } finally {
      // A decode/build exception must never leave navigation permanently busy.
      if (loaderVisible) await loader.hide();
      busy = false;
      if (!paused) loopController?.start();
    }
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
    register(key, builder) { screens.set(key, { builder }); },
    registerLazy(key, load) { screens.set(key, { load, promise: null, builder: null }); },
    hasScreen(key) { return screens.has(key); },
    navigate,
    get currentKey() { return current?.key; },
    setPaused(on) {
      const next = !!on;
      if (next === paused) return;
      paused = next;
      pausedPainted = false;
      if (paused) {
        // Freeze the exact final canvas once, then disable the rAF ownership
        // latch. The pause overlay is DOM and needs no game loop underneath.
        if (current && !busy) {
          renderer.render(current.scene, camera);
          pausedPainted = true;
        }
        loopController?.stop();
      } else if (!busy) {
        loopController?.start();
      }
      window.dispatchEvent(new Event('maranatha-pausechange'));
    },
    get paused() { return paused; },
    // Test hooks (harmless in production; used by automated pixel-readback since
    // the preview tab runs hidden and rAF/screenshots are paused there).
    get scene() { return current?.scene; },
    get instance() { return current?.instance; },
    get power() { return { fps: liveFps, eco: liveFps < 60 }; },
  };

  loopController = startLoop((dt, now, fps) => {
    liveFps = fps;
    let updMs = 0, subMs = 0;
    if (current && !busy) {
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
    if (!busy && !paused && fps >= 60) { quality.frame(dt); Graphics.sampleFrame(dt); }
    // D9: the perf HUD splits SCRIPT time vs RENDER-SUBMIT time — if fps is
    // low while both are tiny, the cost lives in the compositor/GPU (filters,
    // resolution), not in the game code. That split diagnoses any device.
    // D12: an eco-governed tick is LABELED so a 30fps reading is never
    // mistaken for lag.
    hud.frame(dt, updMs, subMs, fps < 60);
  }, targetFps);

  return app;
}
