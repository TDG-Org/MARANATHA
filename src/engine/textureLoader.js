import * as THREE from 'three';
import { makeAbortError } from '../core/async.js';

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

    onAbort = () => {
      if (settled) return;
      // Detach first: assigning an empty source can synchronously report an
      // error in some engines, and that must not steal the authored AbortError.
      image.onload = null;
      image.onerror = null;
      try { image.src = ''; } catch { /* the owned element is already retired */ }
      fail(signal?.reason || makeAbortError(`Texture "${url}" load aborted`));
    };

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

  return { texture, whenReady };
}
