import Phaser from 'phaser';
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
    width: 960,
    height: 540,
  },
  scene: [BootScene, HomeScene, CreationScene, ParallaxTestScene],
});

// Debug/testing handle (harmless in production; used by automated playtests).
window.__MARANATHA = game;
