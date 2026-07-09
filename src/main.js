import Phaser from 'phaser';
import { GW, GH, RENDER_SCALE, refreshRenderScale } from './config.js';
import BootScene from './scenes/BootScene.js';
import HomeScene from './scenes/HomeScene.js';
import CreationScene from './scenes/creation/CreationScene.js';
import ParallaxTestScene from './scenes/ParallaxTestScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0a0a12',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Real framebuffer is the logical 960x540 world times RENDER_SCALE;
    // every scene's camera zooms by the same factor (see config.js), so
    // gameplay code stays in 960x540 coordinates while rendering sharp.
    width: GW * RENDER_SCALE,
    height: GH * RENDER_SCALE,
  },
  render: {
    antialias: true,
    // Snap final quads to whole device pixels — origin-0.5 text otherwise
    // lands on half-pixels and bilinear filtering smears every glyph.
    roundPixels: true,
  },
  scene: [BootScene, HomeScene, CreationScene, ParallaxTestScene],
});

// The ideal framebuffer scale depends on the window; if the player resizes,
// rotates, or re-zooms enough that the frozen buffer would be visibly
// resampled, rebuild it, re-zoom the live cameras, and re-render text at
// the new density. Without this, loading small and maximizing meant
// permanent blur until a manual reload.
let appliedScale = RENDER_SCALE;
let resizeTimer;
const rescale = () => {
  const next = refreshRenderScale();
  if (Math.abs(next - appliedScale) / appliedScale < 0.08) return;
  appliedScale = next;
  game.scale.resize(GW * next, GH * next);
  const applyTextRes = (list) => list.forEach((child) => {
    if (child.style && child.style.setResolution) child.style.setResolution(next);
    if (child.list) applyTextRes(child.list); // containers
  });
  for (const scene of game.scene.getScenes(true)) {
    const cam = scene.cameras && scene.cameras.main;
    if (cam) {
      cam.setZoom(next);
      cam.centerOn(GW / 2, GH / 2);
    }
    if (scene.children && scene.children.list) applyTextRes(scene.children.list);
  }
};
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(rescale, 350);
});
window.addEventListener('orientationchange', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(rescale, 350);
});

// Debug/testing handle (harmless in production; used by automated playtests).
window.__MARANATHA = game;
