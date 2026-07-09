// Logical coordinate system — ALL game code positions things in 960x540.
export const GW = 960;
export const GH = 540;

// Scale.FIT displays the canvas at the LARGEST 16:9 size that fits the
// window: min(width, height*16/9) CSS px wide. The framebuffer is sized so
// its pixels map EXACTLY 1:1 onto device pixels at that display size — the
// exact ratio matters: any rounding (or sizing against the wrong fit edge)
// forces a lossy CSS resample, which is precisely what blurs text. Clamped
// to [1, 2.5] so small phones render small buffers (cheap) and huge
// monitors don't overdraw.
export function computeRenderScale() {
  const displayW = Math.min(window.innerWidth || GW, ((window.innerHeight || GH) * 16) / 9);
  return Math.min(2.5, Math.max(1, (displayW * (window.devicePixelRatio || 1)) / GW));
}

// Live bindings: refreshed on significant window resizes (see main.js).
export let RENDER_SCALE = computeRenderScale();

// Text canvases render at the same density, so glyph pixels are 1:1 too.
// (A mismatch in either direction resamples every glyph.)
export let TEXT_RES = RENDER_SCALE;

export function refreshRenderScale() {
  RENDER_SCALE = computeRenderScale();
  TEXT_RES = RENDER_SCALE;
  return RENDER_SCALE;
}

// Call first in every scene's create(): zooms the camera so the logical
// 960x540 world exactly fills the scaled framebuffer.
export function setupCamera(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(GW / 2, GH / 2);
  return cam;
}
