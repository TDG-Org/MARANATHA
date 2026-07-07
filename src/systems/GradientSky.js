import Phaser from 'phaser';

let skyCounter = 0;

// Two-stop vertical gradient sky, smoothly tweenable between palettes.
// Uses a tiny 2x256 canvas texture stretched to screen size so it works on
// both WebGL and Canvas renderers and costs almost nothing to redraw.
export default class GradientSky {
  constructor(scene, top, bottom, depth = -100) {
    this.scene = scene;
    this.top = top;
    this.bottom = bottom;
    this.key = `sky-${skyCounter++}`;
    this.canvas = scene.textures.createCanvas(this.key, 2, 256);
    this.redraw();
    this.image = scene.add
      .image(0, 0, this.key)
      .setOrigin(0, 0)
      .setDepth(depth);
    this.image.setDisplaySize(scene.scale.width, scene.scale.height);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  static css(color) {
    return '#' + (color & 0xffffff).toString(16).padStart(6, '0');
  }

  redraw() {
    const ctx = this.canvas.getContext();
    const grd = ctx.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, GradientSky.css(this.top));
    grd.addColorStop(1, GradientSky.css(this.bottom));
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 2, 256);
    this.canvas.refresh();
  }

  // Smoothly shift the sky to a new palette. Returns the tween.
  tweenTo(top, bottom, { duration = 2000, ease = 'Sine.easeInOut', onComplete } = {}) {
    if (this.activeTween) this.activeTween.stop();
    const t0 = Phaser.Display.Color.IntegerToColor(this.top);
    const t1 = Phaser.Display.Color.IntegerToColor(top);
    const b0 = Phaser.Display.Color.IntegerToColor(this.bottom);
    const b1 = Phaser.Display.Color.IntegerToColor(bottom);
    const state = { t: 0 };
    this.activeTween = this.scene.tweens.add({
      targets: state,
      t: 100,
      duration,
      ease,
      onUpdate: () => {
        const ct = Phaser.Display.Color.Interpolate.ColorWithColor(t0, t1, 100, state.t);
        const cb = Phaser.Display.Color.Interpolate.ColorWithColor(b0, b1, 100, state.t);
        this.top = Phaser.Display.Color.GetColor(ct.r, ct.g, ct.b);
        this.bottom = Phaser.Display.Color.GetColor(cb.r, cb.g, cb.b);
        this.redraw();
      },
      onComplete: () => {
        this.top = top;
        this.bottom = bottom;
        this.redraw();
        this.activeTween = null;
        onComplete?.();
      },
    });
    return this.activeTween;
  }

  destroy() {
    if (this.activeTween) this.activeTween.stop();
    this.image?.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}
