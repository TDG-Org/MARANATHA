import Phaser from 'phaser';

// Generates every shared procedural texture, then routes to the right scene.
// MARANATHA ships zero image assets — all textures are made in code (see art-style skill).
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.makeGlow('glow', 128);
    this.makeGlow('dot', 16);
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
}
