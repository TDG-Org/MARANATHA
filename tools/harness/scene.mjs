// BOOT A REAL SCENE IN NODE — no browser, no dev server, no GPU.
//
// Everything I previously verified by driving the Browser pane is done here in
// about a second, in-process, deterministically: build the scene, walk the
// player with real key events, count draws and triangles, run the layout audit,
// dispose and census for leaks.
//
// The two things this deliberately does NOT do are the two the pane could not
// do either: composite a frame, and report real fps. Those remain Nate's
// `#debug` on a real device, and no harness can change that.
import './dom.mjs';
import * as THREE from 'three';
import { Audio } from '../../src/systems/AudioSystem.js';
import { AUDIO_MANIFEST } from '../../src/data/audioManifest.js';

// main.js registers the manifest at boot; a harness that skips it makes every
// legitimate sound look like an unknown key, which hides the ones that really
// ARE unknown. (That is how a real defect surfaced here: the ark was playing a
// GRASS footstep on 137 m of timber decking.)
Audio.registerManifest(AUDIO_MANIFEST);

// A renderer stand-in. Scenes touch `domElement` (listeners), the render-target
// calls used by shader pre-warm, and `info`. None of it needs a GL context.
function fakeRenderer() {
  const domElement = document.createElement('canvas');
  return {
    domElement,
    info: { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 }, reset() {} },
    getRenderTarget: () => null,
    setRenderTarget() {},
    setPixelRatio() {},
    setSize() {},
    getPixelRatio: () => 1,
    getContext: () => ({ getExtension: () => null, getParameter: () => '' }),
    clear() {},
    render() {},
    compile() {},
    initTexture() {},
    dispose() {},
  };
}

function fakeApp() {
  const app = {
    paused: false,
    currentKey: null,
    postFX: {
      setFilter() {}, blurPulse() {}, eyeOpen() {}, applyPreset() {}, reset() {},
      setTint() {}, fade() {},
    },
    navigate: async (key) => { app.currentKey = key; },
    setPaused(on) { app.paused = !!on; },
    tier: 'high',
  };
  return app;
}

// DRAWS AND TRIANGLES FROM THE SCENE GRAPH.
//
// `renderer.info` needs a GPU. But a draw call is just "a visible mesh with a
// material", and an InstancedMesh is one draw however many instances it holds —
// so the same numbers are recoverable by walking the graph. This counts
// EVERYTHING visible rather than what survives frustum culling, which is the
// number a budget should be judged against anyway: it is the worst frame.
export function drawStats(scene) {
  let calls = 0;
  let triangles = 0;
  let instanced = 0;
  scene.traverse((o) => {
    if (!o.visible) return;
    // an invisible ancestor hides the whole branch
    for (let p = o.parent; p; p = p.parent) if (!p.visible) return;
    if (o.isInstancedMesh) {
      calls += 1;
      instanced += 1;
      const g = o.geometry;
      const tris = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
      triangles += tris * o.count;
    } else if (o.isMesh) {
      calls += 1;
      const g = o.geometry;
      triangles += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
    } else if (o.isPoints || o.isSprite || o.isLine) {
      calls += 1;
    }
  });
  return { calls, triangles: Math.round(triangles), instanced };
}

// ── DID IT ACTUALLY GIVE THE GPU RESOURCES BACK? ────────────────────────────
//
// Counting what is still REACHABLE after teardown proves nothing: `dispose()`
// frees the GPU handle, it does not remove the object from the graph, and the
// first version of this census compared reachable-before with reachable-after
// and could therefore never fail. What matters is whether `.dispose()` was
// CALLED on every geometry and texture the scene created — which is exactly the
// D10 skeleton leak, where 30 textures per entry were never released and
// nothing noticed until somebody counted.
const DISPOSED = new WeakSet();
for (const Cls of [THREE.BufferGeometry, THREE.Texture, THREE.Material]) {
  const real = Cls.prototype.dispose;
  Cls.prototype.dispose = function patchedDispose(...args) {
    DISPOSED.add(this);
    return real?.apply(this, args);
  };
}

export function gpuCensus(scene) {
  const geometries = new Set();
  const textures = new Set();
  const materials = new Set();
  scene.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      materials.add(m);
      for (const k in m) {
        const v = m[k];
        if (v && v.isTexture) textures.add(v);
      }
    }
  });
  const undisposed = (set) => [...set].filter((x) => !DISPOSED.has(x)).length;
  return {
    geometries: geometries.size,
    textures: textures.size,
    materials: materials.size,
    undisposedGeometries: undisposed(geometries),
    undisposedTextures: undisposed(textures),
    undisposedMaterials: undisposed(materials),
    // THE SETS THEMSELVES, so a caller can hold on to what the scene owned
    // BEFORE teardown. Censusing after teardown is worthless: disposeDeep ends
    // with root.clear(), so the graph is empty and every "undisposed === 0"
    // assertion runs over an empty set and can never fail. Worse, that is
    // exactly the leak shape worth catching — an object DETACHED but never
    // disposed vanishes from a graph walk while its GPU handle lives on.
    sets: { geometries, textures, materials },
  };
}

// How much of a pre-teardown snapshot never had dispose() called on it.
export function undisposedFrom(snapshot) {
  const count = (set) => [...set].filter((x) => !DISPOSED.has(x)).length;
  return {
    geometries: count(snapshot.sets.geometries),
    textures: count(snapshot.sets.textures),
    materials: count(snapshot.sets.materials),
  };
}

// Build a scene the way core/app.js does, and hand back the controls a test
// needs. `whenReady` is awaited, so the returned instance is fully live.
export async function bootScene(builder, { params } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 900);
  const renderer = fakeRenderer();
  const app = fakeApp();
  const lifetime = new AbortController();

  const instance = builder({ scene, camera, renderer, app, params, signal: lifetime.signal }) || {};
  if (instance.whenReady) await instance.whenReady;
  instance.activate?.();

  let now = 0;
  const step = (frames = 1, dt = 16.7) => {
    for (let i = 0; i < frames; i += 1) {
      now += dt;
      instance.update?.(dt, now);
    }
    return instance;
  };

  const key = (type, k) => window.dispatchEvent(
    new KeyboardEvent(type, { key: k }),
  );

  // Hold a key for a while, exactly as a player would.
  const hold = (k, frames, dt = 16.7) => {
    key('keydown', k);
    step(frames, dt);
    key('keyup', k);
    step(6, dt);
  };

  return {
    scene, camera, renderer, app, instance, lifetime,
    debug: instance.debug,
    step,
    hold,
    key,
    stats: () => drawStats(scene),
    census: () => gpuCensus(scene),
    // TEARDOWN IS TWO STEPS, AND THEY PROVE DIFFERENT THINGS.
    //
    // core/app.js runs the scene's own dispose() and THEN disposeDeep(scene).
    // disposeDeep is a safety net that frees everything reachable from the
    // graph — so a census taken after it can never fail for a graph-attached
    // resource, however sloppy the scene was. (Proven: deleting the ark's
    // wood.dispose() call changed nothing at all.)
    //
    // Censusing between the two steps is the assertion with teeth: it asks
    // whether the SCENE released what it owns, rather than leaning on the net.
    disposeScene: () => {
      lifetime.abort(new Error('harness teardown'));
      instance.dispose?.();
    },
    disposeDeep: async () => {
      const { disposeDeep } = await import('../../src/core/dispose.js');
      disposeDeep(scene);
    },
    dispose: async () => {
      lifetime.abort(new Error('harness teardown'));
      instance.dispose?.();
      const { disposeDeep } = await import('../../src/core/dispose.js');
      disposeDeep(scene);
    },
  };
}
