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
  };

  startLoop((dt, now) => {
    if (current) {
      if (!paused) {
        try {
          current.instance.update?.(dt, now);
        } catch (e) {
          if (updateErrors++ < 3) console.error('[app] update error', e);
        }
        renderer.render(current.scene, camera);
      } else if (!pausedPainted) {
        // energy rule (D6): a paused game paints its frozen frame ONCE — the
        // GPU sleeps until resume or resize (DOM pause menu needs no canvas).
        renderer.render(current.scene, camera);
        pausedPainted = true;
      }
    }
    if (!paused) quality.frame(dt);
    hud.frame(dt);
  });

  return app;
}
