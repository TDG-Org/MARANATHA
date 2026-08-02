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

// Every GPU resource the scene owns, for a before/after leak census.
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
  return { geometries: geometries.size, textures: textures.size, materials: materials.size };
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
    dispose: () => {
      lifetime.abort(new Error('harness teardown'));
      instance.dispose?.();
    },
  };
}
