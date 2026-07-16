import * as THREE from 'three';
import { createRenderer, startLoop } from './renderer.js';
import { detectTier, AdaptiveQuality, DebugHud } from './quality.js';
import { disposeDeep } from './dispose.js';
import { createVeil } from '../ui/veil.js';
import { Settings } from '../systems/Settings.js';

// The app shell: owns the renderer, camera, loop, adaptive quality, and the
// always-on perf HUD, and manages screens (home, joseph, …). Each screen is a
// builder ({ scene, camera, renderer, app, params }) → { update, dispose } per
// the game-scene contract. Transitions fade through black — never a hard cut.
export function createApp(container) {
  const renderer = createRenderer(container);
  const { tier, basePixelRatio } = detectTier();
  const quality = new AdaptiveQuality(renderer, { basePixelRatio });
  const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 900);
  const hud = new DebugHud(renderer);
  Settings.bindHud(hud); // apply the player's saved HUD-visibility choice

  const veil = createVeil();
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
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(2, quality.ratio));
    renderer.setSize(w, h);
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
    }
    updateErrors = 0;
    build(key, params);
    renderer.render(current.scene, camera); // paint one frame before revealing
    await veil.reveal(first ? 900 : 620);
    busy = false;
  }

  let paused = false; // true pause: update frozen, last frame keeps rendering

  const app = {
    camera,
    renderer,
    tier,
    register(key, builder) { screens.set(key, builder); },
    hasScreen(key) { return screens.has(key); },
    navigate,
    get currentKey() { return current?.key; },
    setPaused(on) { paused = !!on; },
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
      }
      renderer.render(current.scene, camera);
    }
    quality.frame(dt);
    hud.frame(dt);
  });

  return app;
}
