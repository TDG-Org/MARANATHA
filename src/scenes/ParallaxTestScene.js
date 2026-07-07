import Phaser from 'phaser';
import GradientSky from '../systems/GradientSky.js';
import ParallaxGroup from '../systems/Parallax.js';

// Phase 1 proof scene: the Alto's Adventure pipeline.
// Gradient sky (tweening through moods) + 3 sliding silhouette layers +
// a sun glow + whisper particles. Zero image assets. Reach it at /#test.
const MOODS = [
  { name: 'Golden hour', top: 0xf2b880, bottom: 0xffe9c9, sun: 0xfff3d6 },
  { name: 'Dusk', top: 0x4a4e8f, bottom: 0xe88d67, sun: 0xffd9a0 },
  { name: 'Night', top: 0x0b1026, bottom: 0x2b3a67, sun: 0xd8e4ff },
  { name: 'Day', top: 0x7ec8e3, bottom: 0xf7e8d0, sun: 0xfffbe8 },
];

export default class ParallaxTestScene extends Phaser.Scene {
  constructor() {
    super('ParallaxTest');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.sky = new GradientSky(this, MOODS[0].top, MOODS[0].bottom);

    this.sun = this.add
      .image(W * 0.63, H * 0.4, 'glow')
      .setScale(3.2)
      .setTint(MOODS[0].sun)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-50);

    this.parallax = new ParallaxGroup(this);
    this.parallax.addRidge({
      key: 'test-ridge-far',
      texture: { height: 300, color: 0x8a7f9e, baseline: 110, waves: [[1, 55], [2, 28], [5, 10]], seed: 11 },
      y: H - 300, speed: 0.1, depth: 1, alpha: 0.85,
    });
    this.parallax.addRidge({
      key: 'test-ridge-mid',
      texture: { height: 230, color: 0x5d5378, baseline: 90, waves: [[2, 40], [4, 18], [9, 7]], seed: 23 },
      y: H - 230, speed: 0.35, depth: 2,
    });
    this.parallax.addRidge({
      key: 'test-ridge-near',
      texture: { height: 150, color: 0x241f38, baseline: 60, waves: [[3, 30], [6, 14], [13, 5]], seed: 37 },
      y: H - 150, speed: 0.85, depth: 3,
    });

    // Whisper dust drifting through the light.
    this.add
      .particles(0, 0, 'dot', {
        x: { min: 0, max: W },
        y: { min: H * 0.2, max: H * 0.75 },
        lifespan: 9000,
        speedX: { min: -14, max: -4 },
        speedY: { min: -3, max: 3 },
        scale: { start: 0.5, end: 0.1 },
        alpha: { start: 0, end: 0.35, ease: 'Sine.easeOut' },
        quantity: 1,
        frequency: 260,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(2);

    this.add
      .text(W / 2, 46, 'MARANATHA', {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '34px',
        color: '#fdf6e3',
        letterSpacing: 10,
      })
      .setOrigin(0.5)
      .setAlpha(0.9)
      .setDepth(10);

    this.moodLabel = this.add
      .text(W / 2, 82, 'art pipeline test — golden hour', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '13px',
        color: '#fdf6e3',
      })
      .setOrigin(0.5)
      .setAlpha(0.55)
      .setDepth(10);

    // Cycle moods to prove gradient tweening is smooth.
    this.moodIndex = 0;
    this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        this.moodIndex = (this.moodIndex + 1) % MOODS.length;
        const mood = MOODS[this.moodIndex];
        this.sky.tweenTo(mood.top, mood.bottom, { duration: 2600 });
        this.tweens.add({ targets: this.sun, alpha: 0.7, duration: 1300, yoyo: true, ease: 'Sine.easeInOut' });
        this.sun.setTint(mood.sun);
        this.moodLabel.setText(`art pipeline test — ${mood.name.toLowerCase()}`);
      },
    });
  }

  update(_, delta) {
    this.parallax.update(delta);
  }
}
