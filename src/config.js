// Logical coordinate system — ALL game code positions things in 960x540.
export const GW = 960;
export const GH = 540;

// Render scale: the real framebuffer is GW*S x GH*S, sized to the player's
// actual screen (CSS size x devicePixelRatio), capped at 2.5x and floored at
// 1x. Cameras zoom by S so gameplay code never sees it. This is what makes
// text and vectors truly sharp — small screens get a small buffer (cheap),
// big screens get a dense one.
export const RENDER_SCALE = (() => {
  const css = Math.max(window.innerWidth || GW, ((window.innerHeight || GH) * 16) / 9);
  const want = (css * (window.devicePixelRatio || 1)) / GW;
  return Math.min(2.5, Math.max(1, Math.round(want * 2) / 2));
})();

// Text textures render at this many canvas pixels per logical pixel so they
// map 1:1 onto the scaled framebuffer.
export const TEXT_RES = Math.max(1.5, RENDER_SCALE);

// Call first in every scene's create(): zooms the camera so the logical
// 960x540 world exactly fills the scaled framebuffer.
export function setupCamera(scene) {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(GW / 2, GH / 2);
  return cam;
}
