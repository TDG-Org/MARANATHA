import Phaser from 'phaser';
import { GW, GH, RENDER_SCALE } from './config.js';
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
  },
  scene: [BootScene, HomeScene, CreationScene, ParallaxTestScene],
});

// Debug/testing handle (harmless in production; used by automated playtests).
window.__MARANATHA = game;
