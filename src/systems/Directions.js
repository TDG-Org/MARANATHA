// On-screen player directions — every interactive beat must show one so the
// player always knows what to do. Quiet sans text near the bottom with a
// gentle attention pulse.
export default class Directions {
  constructor(scene) {
    this.scene = scene;
    this.text = scene.add
      .text(scene.scale.width / 2, scene.scale.height - 34, '', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '15px',
        color: '#fdf6e3',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(900);
    this.pulse = null;
  }

  show(message) {
    this.scene.tweens.killTweensOf(this.text);
    this.text.setText(message);
    this.scene.tweens.add({
      targets: this.text,
      alpha: 0.9,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.pulse = this.scene.tweens.add({
          targets: this.text,
          alpha: 0.55,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  set(message) {
    // Swap the message without re-animating (mid-beat updates like counters).
    this.text.setText(message);
  }

  hide() {
    if (this.pulse) {
      this.pulse.stop();
      this.pulse = null;
    }
    this.scene.tweens.killTweensOf(this.text);
    this.scene.tweens.add({
      targets: this.text,
      alpha: 0,
      duration: 350,
      ease: 'Sine.easeIn',
    });
  }
}
