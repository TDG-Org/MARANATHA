import Phaser from 'phaser';
import { GW, GH } from '../config.js';

// Generates every shared procedural texture, then routes to the right scene.
// MARANATHA ships zero image assets — all textures are made in code (see art-style skill).
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeGlow('glow', 128);
    this.makeGlow('dot', 16);
    this.makeVignette();
    this.makeGrain();
    this.scene.start(this.pickStartScene());
  }

  pickStartScene() {
    if (window.location.hash === '#test') return 'ParallaxTest';
    if (window.location.hash === '#creation' && this.scene.manager.keys.Creation) return 'Creation';
    return 'Home';
  }

  // Soft radial-gradient disc — the workhorse for light, sun, stars, and particles.
  makeGlow(key, size) {
    if (this.textures.exists(key)) return;
    const canvas = this.textures.createCanvas(key, size, size);
    const ctx = canvas.getContext();
    const half = size / 2;
    const grd = ctx.createRadialGradient(half, half, 0, half, half, half);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }

  // Static balanced noise, laid over scenes at very low alpha to dither the
  // faint banding that 8-bit gradients show on large dark skies. One tile,
  // one draw call — imperceptible as texture, but it breaks up the bands.
  makeGrain() {
    if (this.textures.exists('grain')) return;
    const size = 128;
    const canvas = this.textures.createCanvas('grain', size, size);
    const ctx = canvas.getContext();
    const img = ctx.createImageData(size, size);
    const rnd = new Phaser.Math.RandomDataGenerator(['grain']);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rnd.frac() < 0.5 ? 0 : 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    canvas.refresh();
  }

  // Gentle darkened corners — adds depth and pulls the eye to the scene.
  makeVignette() {
    if (this.textures.exists('vignette')) return;
    const canvas = this.textures.createCanvas('vignette', GW, GH);
    const ctx = canvas.getContext();
    const grd = ctx.createRadialGradient(GW / 2, GH / 2, GH * 0.42, GW / 2, GH / 2, GW * 0.62);
    grd.addColorStop(0, 'rgba(8,6,16,0)');
    grd.addColorStop(1, 'rgba(8,6,16,0.4)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, GW, GH);
    canvas.refresh();
  }
}
