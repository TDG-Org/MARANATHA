import Phaser from 'phaser';
import GradientSky from '../systems/GradientSky.js';
import ParallaxGroup from '../systems/Parallax.js';
import { STORIES } from '../data/stories.js';
import { statusOf, resetProgress } from '../systems/SaveSystem.js';

// The story-path map: Creation → The Fall → Noah's Ark → Joseph.
// Nodes show done ✓ / current (pulsing light) / locked 🔒; selecting a node
// previews the story; ▶ Start Story enters it. Progress lives in localStorage.
const NODE_POINTS = [
  { x: 150, y: 296 },
  { x: 370, y: 272 },
  { x: 590, y: 296 },
  { x: 810, y: 272 },
];

export default class HomeScene extends Phaser.Scene {
  constructor() {
    super('Home');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.sky = new GradientSky(this, 0xf2b880, 0xffe9c9);
    this.add
      .image(W * 0.8, H * 0.2, 'glow')
      .setScale(2.1)
      .setTint(0xfff3d6)
      .setAlpha(0.85)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(-50);

    this.parallax = new ParallaxGroup(this);
    this.parallax.addRidge({
      key: 'home-ridge-far',
      texture: { height: 260, color: 0x8a7f9e, baseline: 90, waves: [[1, 42], [2, 22], [5, 8]], seed: 5 },
      y: H - 260, speed: 0.05, depth: 1, alpha: 0.8,
    });
    this.parallax.addRidge({
      key: 'home-ridge-mid',
      texture: { height: 210, color: 0x655a80, baseline: 74, waves: [[2, 34], [4, 15], [8, 6]], seed: 6 },
      y: H - 210, speed: 0.11, depth: 2, alpha: 0.88,
    });
    this.parallax.addRidge({
      key: 'home-ridge-near',
      texture: { height: 170, color: 0x322a4e, baseline: 60, waves: [[2, 28], [5, 12], [9, 5]], seed: 8 },
      y: H - 170, speed: 0.18, depth: 3, alpha: 0.95,
    });

    this.add
      .particles(0, 0, 'dot', {
        x: { min: 0, max: W },
        y: { min: H * 0.15, max: H * 0.6 },
        lifespan: 10000,
        speedX: { min: -10, max: -3 },
        scale: { start: 0.4, end: 0.1 },
        alpha: { start: 0, end: 0.3, ease: 'Sine.easeOut' },
        quantity: 1,
        frequency: 350,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(1);

    this.add
      .text(W / 2, 58, 'MARANATHA', {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '42px',
        color: '#fdf6e3',
        letterSpacing: 14,
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.add
      .text(W / 2, 98, 'walk through the Word', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '14px',
        color: '#fdf6e3',
      })
      .setOrigin(0.5)
      .setAlpha(0.6)
      .setDepth(10);

    this.drawPath();
    this.buildNodes();
    this.buildPreviewPanel();

    // Default selection: the current (first unfinished) story.
    const current = STORIES.find((s) => statusOf(s.id) === 'current') ?? STORIES[0];
    this.selectStory(current.id);

    // Tiny dev/testing affordance — deliberately quiet.
    const reset = this.add
      .text(10, H - 18, 'reset progress', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '10px',
        color: '#fdf6e3',
      })
      .setAlpha(0.3)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    reset.on('pointerup', () => {
      resetProgress();
      this.scene.restart();
    });

    this.cameras.main.fadeIn(600, 10, 10, 18);
  }

  drawPath() {
    const spline = new Phaser.Curves.Spline(NODE_POINTS.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0xfdf6e3, 0.35);
    for (const p of spline.getPoints(46)) g.fillCircle(p.x, p.y, 2);
  }

  buildNodes() {
    this.nodeRings = [];
    STORIES.forEach((story, i) => {
      const { x, y } = NODE_POINTS[i];
      const status = statusOf(story.id);

      if (status === 'current') {
        const ring = this.add
          .image(x, y, 'glow')
          .setScale(0.55)
          .setTint(0xffd98a)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(5);
        this.tweens.add({
          targets: ring,
          scale: 0.8,
          alpha: 0.55,
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.nodeRings.push(ring);
      }

      const g = this.add.graphics({ x, y }).setDepth(6);
      if (status === 'done') {
        g.fillStyle(0xf2b880, 1);
        g.fillCircle(0, 0, 24);
      } else if (status === 'current') {
        g.fillStyle(0xfdf6e3, 0.95);
        g.fillCircle(0, 0, 24);
      } else {
        g.fillStyle(0x3a3153, 0.85);
        g.fillCircle(0, 0, 24);
        g.lineStyle(1, 0xfdf6e3, 0.2);
        g.strokeCircle(0, 0, 24);
      }

      const glyph = status === 'done' ? '✓' : status === 'locked' ? '🔒' : '▶';
      this.add
        .text(x, y, glyph, {
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          fontSize: status === 'locked' ? '16px' : '18px',
          color: status === 'current' ? '#3a3153' : '#241f38',
        })
        .setOrigin(0.5)
        .setAlpha(status === 'locked' ? 0.75 : 0.95)
        .setDepth(7);

      this.add
        .text(x, y + 42, story.title, {
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: '15px',
          color: '#fdf6e3',
          align: 'center',
        })
        .setOrigin(0.5)
        .setAlpha(status === 'locked' ? 0.5 : 0.9)
        .setDepth(7);

      const hit = this.add
        .zone(x, y, 64, 64)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.selectStory(story.id));
    });
  }

  buildPreviewPanel() {
    const W = this.scale.width;
    this.panel = this.add.container(W / 2, 448).setDepth(20);

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0b16, 0.62);
    bg.fillRoundedRect(-340, -66, 680, 132, 16);
    bg.lineStyle(1, 0xf5e6c4, 0.22);
    bg.strokeRoundedRect(-340, -66, 680, 132, 16);

    this.pvTitle = this.add
      .text(-316, -48, '', {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '22px',
        color: '#fdf6e3',
      })
      .setOrigin(0, 0);
    this.pvPassage = this.add
      .text(-316, -18, '', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '12px',
        color: '#f5e6c4',
        letterSpacing: 2,
      })
      .setOrigin(0, 0)
      .setAlpha(0.7);
    this.pvBlurb = this.add
      .text(-316, 4, '', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '13px',
        color: '#fdf6e3',
        wordWrap: { width: 430 },
        lineSpacing: 4,
      })
      .setOrigin(0, 0)
      .setAlpha(0.85);

    // Start button (right side of the panel).
    this.btn = this.add.container(240, 0);
    this.btnBg = this.add.graphics();
    this.btnText = this.add
      .text(0, 0, '▶  Start Story', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '16px',
        color: '#241f38',
      })
      .setOrigin(0.5);
    this.btn.add([this.btnBg, this.btnText]);
    this.btnZone = this.add
      .zone(240, 0, 190, 46)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.btnZone.on('pointerover', () =>
      this.tweens.add({ targets: this.btn, scale: 1.04, duration: 200, ease: 'Sine.easeOut' }));
    this.btnZone.on('pointerout', () =>
      this.tweens.add({ targets: this.btn, scale: 1, duration: 200, ease: 'Sine.easeOut' }));
    this.btnZone.on('pointerup', () => this.startSelected());
    this.panel.add(this.btnZone);

    this.pvStatus = this.add
      .text(240, 0, '', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '13px',
        color: '#f5e6c4',
        align: 'center',
        wordWrap: { width: 170 },
      })
      .setOrigin(0.5)
      .setAlpha(0.7);

    this.panel.add([bg, this.pvTitle, this.pvPassage, this.pvBlurb, this.btn, this.pvStatus]);
  }

  drawButton(color) {
    this.btnBg.clear();
    this.btnBg.fillStyle(color, 1);
    this.btnBg.fillRoundedRect(-95, -23, 190, 46, 23);
  }

  selectStory(id) {
    const story = STORIES.find((s) => s.id === id);
    if (!story) return;
    this.selected = story;
    const status = statusOf(id);

    this.pvTitle.setText(story.title);
    this.pvPassage.setText(story.passage.toUpperCase());
    this.pvBlurb.setText(story.blurb);

    const sceneExists = story.sceneKey && this.scene.manager.keys[story.sceneKey];
    const playable = status !== 'locked' && sceneExists;

    this.btn.setVisible(playable);
    this.btnZone.setVisible(playable);
    this.pvStatus.setVisible(!playable);

    if (playable) {
      this.btnText.setText(status === 'done' ? '↻  Play Again' : '▶  Start Story');
      this.drawButton(status === 'done' ? 0xd9c9a8 : 0xf2b880);
    } else if (status === 'locked') {
      this.pvStatus.setText('🔒 Locked\ncomplete the previous story first');
    } else {
      this.pvStatus.setText('the path continues here\n— coming soon —');
    }
  }

  startSelected() {
    const story = this.selected;
    if (!story?.sceneKey || !this.scene.manager.keys[story.sceneKey]) return;
    if (this.starting) return;
    this.starting = true;
    this.cameras.main.fadeOut(550, 10, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(story.sceneKey);
    });
  }

  update(_, delta) {
    this.parallax.update(delta);
  }
}
