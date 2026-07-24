import * as THREE from 'three';
import { makeAbortError } from '../core/async.js';
import { waitWithDeadline } from '../core/deadline.js';

// TextureLoader does not expose its Image request, so aborting a scene can only
// ignore its callback while the browser keeps downloading/decoding. Own the
// Image element directly: scene abort clears its source, detaches callbacks,
// disposes the Texture, and rejects readiness exactly once.
export function loadOwnedTexture(url, { signal = null, configure = null } = {}) {
  const image = new Image();
  image.decoding = 'async';
  const texture = new THREE.Texture(image);
  configure?.(texture);

  let settled = false;
  let onAbort = null;
  let cancelOwned = null;
  const whenReady = new Promise((resolve, reject) => {
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener('abort', onAbort);
    };
    const finish = (fn, value) => {
      if (settled) return false;
      settled = true;
      cleanup();
      fn(value);
      return true;
    };
    const fail = (error) => {
      texture.dispose();
      finish(reject, error);
    };

    cancelOwned = (reason = makeAbortError(`Texture "${url}" load cancelled`)) => {
      if (settled) return;
      // Detach first: assigning an empty source can synchronously report an
      // error in some engines, and that must not steal the authored AbortError.
      image.onload = null;
      image.onerror = null;
      try { image.src = ''; } catch { /* the owned element is already retired */ }
      fail(reason);
    };
    onAbort = () => cancelOwned(signal?.reason || makeAbortError(`Texture "${url}" load aborted`));

    image.onload = async () => {
      try {
        // `load` means bytes arrived; `decode()` makes readiness include image
        // decode rather than moving that CPU spike onto the first visible frame.
        if (typeof image.decode === 'function') await image.decode();
        if (settled) return;
        if (signal?.aborted) {
          onAbort();
          return;
        }
        texture.needsUpdate = true;
        finish(resolve, texture);
      } catch (error) {
        if (settled) return;
        if (signal?.aborted) onAbort();
        else fail(new Error(`Texture "${url}" failed to decode`, { cause: error }));
      }
    };
    image.onerror = () => fail(new Error(`Texture "${url}" failed to load`));

    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    else image.src = url;
  });

  return {
    texture,
    whenReady,
    cancel(reason) { cancelOwned?.(reason); },
  };
}

// Recovery screens may decorate themselves with a texture without making that
// file a condition for reaching the player. A transport/decode failure swaps
// the material to an explicit procedural fallback; lifetime aborts still reject
// so a retired screen cannot continue compiling or mutate shared state.
export async function settleOptionalTexture(whenReady, {
  texture,
  material,
  signal = null,
  fallbackColor = null,
  onUnavailable = null,
  timeoutMs = 0,
  timeoutMessage = 'Optional texture readiness timed out',
} = {}) {
  try {
    const result = timeoutMs > 0
      ? await waitWithDeadline(whenReady, timeoutMs, timeoutMessage, { rejectOnTimeout: false })
      : await whenReady;
    if (result === false) throw new Error(timeoutMessage);
    return true;
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    if (material?.map === texture) material.map = null;
    if (fallbackColor !== null) material?.color?.set?.(fallbackColor);
    if (material) material.needsUpdate = true;
    onUnavailable?.(error);
    return false;
  }
}
