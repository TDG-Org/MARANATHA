import { detectTier, AdaptiveQuality, DebugHud, RateGovernor } from './quality.js';
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
//
// THE ENGINE IS NOT PART OF BOOT. The first paint is the home story map —
// pure DOM — so Three.js, the renderer, the camera, and the frame loop all
// live behind ONE dynamic edge (./engine3d.js), fetched behind the loader on
// the first non-flat navigation and idle-prefetched while the menu is up.
// Before that fetch, this shell has no canvas and runs no loop at all.
export function createApp(container) {
  const { tier } = detectTier();
  // The DPR ceiling comes from the player's Graphics Quality preset (Low/Med/
  // High); AdaptiveQuality may still shed BELOW it on a struggling device.
  const dpr = () => window.devicePixelRatio || 1;
  let THREE3D = null;   // the three namespace, once the engine edge loads
  let renderer = null;
  let camera = null;
  let quality = null;
  let hud = null;
  let postFX = null;
  let enginePromise = null;
  Graphics.subscribe((graphics, change) => {
    if (!quality) return; // pre-engine: nothing rendering, nothing to cap
    const base = Math.min(dpr(), graphics.dprCap);
    // Automatic demotion may only lower the current DPR. A player explicitly
    // choosing a preset may restore that preset's complete DPR ceiling.
    quality.setBase(base, { raise: change?.source === 'explicit' });
  });
  // Guard the aspect: a tab booted in the background can report 0×0 —
  // 0/0 = NaN would poison the projection matrix until the next resize.
  const safeAspect = () => (window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9);
  // Browser QA runs in an isolated world that cannot read the app's harmless
  // window debug handle. Expose a bounded, non-sensitive scene snapshot on
  // the existing #debug HUD instead. Normal routes do zero telemetry work.
  const exposeDebugState = /debug/.test(window.location.hash);
  let debugStateAcc = 0;

  const veil = createVeil();
  const loader = createLoader();
  const screens = new Map(); // key -> { builder, flat } or { load, promise, builder, flat }
  let current = null;        // { key, scene, instance, lifetime }
  let busy = false;
  let updateErrors = 0;
  let loopController = null;

  const initEngine = (mod) => {
    if (renderer) return;
    THREE3D = mod.THREE;
    renderer = mod.createRenderer(container);
    quality = new AdaptiveQuality(renderer, { basePixelRatio: Math.min(dpr(), Graphics.dprCap) });
    camera = new THREE3D.PerspectiveCamera(46, safeAspect(), 0.1, 900);
    hud = new DebugHud(renderer);
    Settings.bindHud(hud); // apply the player's saved HUD-visibility choice
    // D6: ONE PostFX owns the canvas grade + named filters for every scene.
    postFX = new PostFX(renderer.domElement);
    // The engine may arrive while a FLAT screen is up (idle prefetch): the
    // fresh canvas must not appear behind the menu. Visibility, never
    // display:none (D23 — display drops the GL drawing buffer).
    showCanvas(!current?.instance?.flat);
    onResize(); // size/DPR the fresh canvas against the live viewport
    loopController = mod.startLoop(tick, targetFps);
    // Respect the live ownership latches: mid-navigation the loop stays
    // stopped until reveal; a prefetch mid-menu parks itself via the governor.
    if (busy || paused) loopController.stop();
  };
  const ensureEngine = () => {
    if (renderer) return Promise.resolve();
    if (!enginePromise) {
      enginePromise = import('./engine3d.js')
        .then((mod) => initEngine(mod))
        .catch((error) => {
          enginePromise = null; // a failed fetch must not poison the retry
          throw error;
        });
    }
    return enginePromise;
  };
  const idlePrefetchEngine = () => {
    if (renderer || enginePromise) return;
    const kick = () => { ensureEngine().catch(() => { /* the Start click retries behind the loader */ }); };
    if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 4000 });
    else setTimeout(kick, 1200);
  };

  // Responsive: keep the renderer + camera matched to the viewport across
  // resize, orientation change, iOS visualViewport shifts, and container resize
  // (ResizeObserver is the robust catch-all — `resize` alone is unreliable on
  // mobile). DPR stays clamped ≤2 (detectTier + AdaptiveQuality).
  // The four sources below overlap (a desktop drag fires `resize` AND the
  // ResizeObserver; iOS viewport shifts add visualViewport) — and three's
  // setPixelRatio re-runs setSize internally, so an ungated pass reallocates
  // the drawing buffer up to twice per duplicate event. Gate on what changed.
  let sizedW = 0, sizedH = 0;
  const onResize = () => {
    if (!renderer) return; // pre-engine there is no canvas to size
    const w = window.innerWidth, h = window.innerHeight;
    if (!w || !h) return; // a hidden/zero-sized pass must never poison aspect
    // A window moved to a lower-DPR display (or browser zoomed out) must shed
    // its old oversized buffer immediately. Native-DPR increases stay sticky
    // down until the player explicitly reselects a preset.
    quality.setBase(Math.min(dpr(), Graphics.dprCap), { raise: false });
    const ratio = Math.min(2, quality.ratio);
    const sizeChanged = w !== sizedW || h !== sizedH;
    const ratioChanged = renderer.getPixelRatio() !== ratio;
    if (!sizeChanged && !ratioChanged) return; // duplicate event, nothing to apply
    sizedW = w; sizedH = h;
    if (sizeChanged) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (ratioChanged) renderer.setPixelRatio(ratio); // reallocates at the current size itself
    if (sizeChanged) renderer.setSize(w, h);
    pausedPainted = false;
    if (paused && current && !busy) {
      paint();
      pausedPainted = true;
    }
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(container);

  // A screen may declare `flat` when it has no 3D content at all (the home
  // story map is DOM/CSS/SVG). No GPU frame is submitted while it is up:
  // rendering an empty scene every frame is pure waste on the screen players
  // park on.
  //
  // The canvas is hidden with VISIBILITY, never `display:none`. Removing its
  // layout box also drops the WebGL drawing buffer, and the next scene's
  // shader/texture pre-warm then never completes — measured: Joseph reached its
  // 12s readiness deadline and bounced back to home every time, while the same
  // navigation from a non-flat screen loaded fine. Visibility keeps the buffer.
  const isFlat = () => !!current?.instance?.flat;
  const showCanvas = (on) => {
    if (renderer) renderer.domElement.style.visibility = on ? '' : 'hidden';
    // A flat screen has no cinema letterbox to clear, so the #debug stats
    // drop back into the corner instead of floating (see index.html).
    document.body.classList.toggle('mr-flat-screen', !on);
  };
  const paint = () => {
    if (!renderer || !current || !current.scene || isFlat()) return;
    renderer.render(current.scene, camera);
  };

  async function build(key, params) {
    const entry = screens.get(key);
    // FLAT screens are pure DOM and may build before the engine exists — they
    // get no Scene at all. Non-flat navigation ensured the engine already.
    const scene = entry.flat || !THREE3D ? null : new THREE3D.Scene();
    const lifetime = new AbortController();
    try {
      let builder = entry.builder;
      if (!builder) {
        builder = await resolveLazyScreen(entry, key);
      }
      const instance = builder({ scene, camera, renderer, app, params, signal: lifetime.signal }) || {};
      current = { key, scene, instance, lifetime };
      showCanvas(!instance.flat);
    } catch (e) {
      lifetime.abort(makeAbortError(`Screen "${key}" failed to build`));
      if (scene) disposeDeep(scene);
      throw e;
    }
  }

  function disposeCurrent(reason = 'Screen retired') {
    if (!current) return;
    current.lifetime.abort(makeAbortError(reason));
    try { current.instance.dispose?.(); } catch (e) { console.error('[app] dispose error', e); }
    if (current.scene) disposeDeep(current.scene);
    showCanvas(true); // the next screen decides again once it is built
    postFX?.reset();
    current = null;
    debugStateAcc = 0;
    if (hud.el) delete hud.el.dataset.sceneState;
  }

  // A navigation asked for while another is still running is REMEMBERED, not
  // dropped. A screen change takes about two seconds end to end, and every
  // button in the game routes through here -- Start Story, About, Support,
  // the pop-outs' X, the scene's home button. Silently ignoring a press made
  // those buttons look broken: click Support right after closing About and
  // nothing happened at all, with no error and nothing to see.
  let queued = null;
  async function navigate(key, params) {
    if (!screens.has(key)) { console.warn(`[app] no screen "${key}"`); return; }
    if (busy) { queued = { key, params }; return; }
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
      if (!entry.builder || (!entry.flat && !renderer)) {
        loader.show();
        loaderVisible = true;
      }
      try {
        // The engine (Three.js + renderer + loop) is not in the boot chunk —
        // the first non-flat navigation pays for it here, under the same
        // loader that covers the scene chunk and its assets. A failed fetch
        // falls into the recovery path below like any failed screen.
        if (!entry.flat && !renderer) await ensureEngine();
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
      paint(); // paint one frame before revealing (a flat screen has none to paint)
      await veil.reveal(first ? 900 : 620);
      current.instance.activate?.();
      // The menu is up and idle: pull the engine down NOW so the player's
      // Start click is a cut, not a download (startup-efficiency skill).
      if (current?.instance?.flat) idlePrefetchEngine();
    } finally {
      // A decode/build exception must never leave navigation permanently busy.
      if (loaderVisible) await loader.hide();
      busy = false;
      flatParked = false; // a fresh screen always gets its reveal frames
      if (!paused) loopController?.start();
    }
    // Whatever the player asked for while we were working, honour it now.
    // Only the LAST request survives: pressing three things in a row should
    // land you where you last pointed, not walk you through all three.
    if (queued) {
      const next = queued;
      queued = null;
      if (next.key !== current?.key) await navigate(next.key, next.params);
    }
  }

  let paused = false;      // true pause: update frozen
  let pausedPainted = false; // D6 energy rule: paint the frozen frame ONCE, then stop rendering
  let flatParked = false;  // the loop stopped itself because a flat screen went idle

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
  let requestedFps = 60; // what the governor ASKED for (eco vs full rate)
  const noteActivity = () => {
    lastInput = performance.now();
    // The loop parks itself on an idle flat screen (see the tick below); any
    // input is the signal to wake it. Pause and navigation own their own
    // start/stop and must not be overridden from here.
    if (flatParked && !paused && !busy) {
      flatParked = false;
      loopController?.start();
    }
  };
  window.addEventListener('pointerdown', noteActivity, { passive: true });
  window.addEventListener('keydown', noteActivity, { passive: true });
  window.addEventListener('wheel', noteActivity, { passive: true });
  window.addEventListener('touchstart', noteActivity, { passive: true });

  // ── THE FULL-RATE CEILING ──────────────────────────────────────────────────
  //
  // The game used to be hard-capped at 60 everywhere. On the 144Hz panel a
  // gaming PC actually has, 60 is not even a rate the display can serve evenly
  // (16.7ms is 2.4 refreshes), so the cap bought no smoothness AND left more
  // than half the machine's frames on the table. Full rate is now the panel's
  // own rate, up to a sane ceiling, and the pacer snaps it to a whole multiple
  // of the refresh so every frame lands on a real vsync.
  //
  // Phones and an explicit Low keep 60: there the budget is heat and battery,
  // and the pacer prefers an even 45 over a ragged 60 for them.
  const SMOOTH_CEILING = 144;
  const mobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent || '');
  const rate = new RateGovernor({ ceiling: SMOOTH_CEILING, floor: 60 });
  Graphics.subscribe((_g, change) => { if (change?.source === 'explicit') rate.reset(); });
  const fullRateFps = (displayHz) => {
    if (mobile || Graphics.name === 'low') return 60;
    const hz = Number.isFinite(displayHz) && displayHz > 0 ? displayHz : 60;
    return Math.max(60, Math.min(hz, rate.ceiling));
  };
  const targetFps = (displayHz) => {
    const now = performance.now();
    const active = now - lastInput < POWER.activeMs
      || now - navT < POWER.graceMs
      || !!current?.instance?.fullRate?.();
    requestedFps = active ? fullRateFps(displayHz) : POWER.ecoFps;
    return requestedFps;
  };

  const app = {
    // Live getters: the engine assigns these when its chunk arrives — a
    // captured value would hand every consumer a permanent null.
    get camera() { return camera; },
    get renderer() { return renderer; },
    tier,
    get postFX() { return postFX; },
    // `flat` marks a pure-DOM screen at REGISTRATION so navigation knows it
    // needs no engine before the builder has ever run.
    register(key, builder, { flat = false } = {}) { screens.set(key, { builder, flat }); },
    registerLazy(key, load) { screens.set(key, { load, promise: null, builder: null, flat: false }); },
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
          paint();
          pausedPainted = true;
        }
        loopController?.stop();
      } else if (!busy) {
        flatParked = false;
        loopController?.start();
      }
      window.dispatchEvent(new Event('maranatha-pausechange'));
    },
    get paused() { return paused; },
    // Test hooks (harmless in production; used by automated pixel-readback since
    // the preview tab runs hidden and rAF/screenshots are paused there).
    get scene() { return current?.scene; },
    get instance() { return current?.instance; },
    // eco is what the governor ASKED for, not a number below 60: a 55fps pace
    // on a 165Hz panel is full rate, and a 72 on a 144Hz one certainly is.
    get power() { return { fps: liveFps, eco: requestedFps <= POWER.ecoFps }; },
  };

  // The frame tick. Runs only once the engine exists (initEngine starts the
  // loop); before that the shell is DOM-only and burns nothing.
  const tick = (dt, now, fps, pacing) => {
    liveFps = fps;
    const eco = requestedFps <= POWER.ecoFps;
    // Everything that judges "is this machine keeping up?" must judge against
    // the pace actually being asked for. A flat 16.7ms assumption would call a
    // struggling 144Hz machine healthy and would never shed anything.
    const budgetMs = 1000 / (pacing?.pacedFps || fps || 60);
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
        paint();
        subMs = performance.now() - t1;
        updMs = t1 - t0;
      } else if (!pausedPainted) {
        // energy rule (D6): a paused game paints its frozen frame ONCE — the
        // GPU sleeps until resume or resize (DOM pause menu needs no canvas).
        paint();
        pausedPainted = true;
      }
    }
    // Adaptive quality reads REAL frame pressure only — an eco-governed 33ms
    // frame is design, not a struggling device, and must never shed DPR.
    // Same rule for the Graphics auto-tuner: it judges the machine on
    // full-rate frames alone, and only while the preset is still auto.
    // A FLAT screen renders nothing: update+submit are ~0 by construction and
    // dt is DOM/compositor time, so menu frames must neither promote (free
    // frames) nor demote (menu jank) quality, DPR, or the rate ceiling.
    if (!busy && !paused && !eco && current && !isFlat()) {
      quality.frame(dt, budgetMs);
      Graphics.sampleFrame(dt, budgetMs);
      // Cadence (dt) can prove a machine is STRUGGLING but never that it has
      // room to spare: a paced stream reads its budget back whether the frame
      // took 3ms or 15ms. Actual work does prove it, so promotion is judged on
      // the update+submit time the HUD already measures.
      Graphics.sampleWork(updMs + subMs, budgetMs);
      // ...and if even the pace itself cannot be held, come down a whole step
      // rather than serving uneven frames.
      rate.frame(dt, budgetMs);
    }
    if (exposeDebugState && hud.el) {
      debugStateAcc += dt;
      if (debugStateAcc >= 250) {
        debugStateAcc = 0;
        const snapshot = current?.instance?.debugSnapshot?.();
        if (snapshot) hud.el.dataset.sceneState = JSON.stringify(snapshot);
        else delete hud.el.dataset.sceneState;
      }
    }
    // D9: the perf HUD splits SCRIPT time vs RENDER-SUBMIT time — if fps is
    // low while both are tiny, the cost lives in the compositor/GPU (filters,
    // resolution), not in the game code. That split diagnoses any device.
    // D12: an eco-governed tick is LABELED so a 30fps reading is never
    // mistaken for lag.
    hud.frame(dt, updMs, subMs, eco, pacing);
    // A parked FLAT screen (the DOM home map) needs no JS heartbeat at all:
    // its motion is CSS, its update() is empty, and no GPU frame is submitted.
    // Once the governor is down to eco with no input, stop the loop entirely —
    // zero timer/rAF wake-up pairs instead of ~30/s — and let noteActivity or
    // navigation start it again. Same ownership latch as pause/loading, so a
    // visibility bounce cannot restart it either.
    if (eco && isFlat() && !busy && !paused) {
      flatParked = true;
      loopController?.stop();
    }
  };

  return app;
}
