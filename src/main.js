import * as THREE from 'three';
import { createRenderer, startLoop } from './core/renderer.js';
import { detectTier, AdaptiveQuality, DebugHud } from './core/quality.js';
import { buildFoundation } from './scenes/foundation.js';
import { Audio } from './systems/AudioSystem.js';
import { mountVolumeControl } from './ui/volume.js';

// MARANATHA — HD-2D engine (Three.js). Flat Alto-style sprites living in a
// 3D world with a real moving camera. Phase A: the foundation scene that
// proves the look and the performance pipeline.

const container = document.getElementById('app');
const renderer = createRenderer(container);
const { tier, basePixelRatio } = detectTier();
const quality = new AdaptiveQuality(renderer, { basePixelRatio });
const hud = new DebugHud(renderer);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 900);

const foundation = buildFoundation({ scene, camera });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

mountVolumeControl();
// Gentle golden-hour ambience once the first gesture unlocks audio.
window.addEventListener('pointerdown', () => Audio.ambience({ wind: 0.25, birds: 0.25 }), { once: true });

const loop = startLoop((dt, now) => {
  foundation.update(dt, now);
  renderer.render(scene, camera);
  quality.frame(dt);
  hud.frame(dt);
});

// Debug/testing handle (harmless in production; used by automated playtests).
window.__MARANATHA = { renderer, scene, camera, loop, tier, quality, foundation };
