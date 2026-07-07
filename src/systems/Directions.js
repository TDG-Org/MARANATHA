// On-screen player directions — every interactive beat must show one so the
// player always knows what to do. Crisp text on a quiet pill near the
// bottom, with a gentle attention pulse.
const DPR = Math.min(Math.max(window.devicePixelRatio || 1, 1.5), 3);

export default class Directions {
  constructor(scene) {
    this.scene = scene;
    this.pill = scene.add.graphics().setDepth(899).setAlpha(0);
    this.text = scene.add
      .text(scene.scale.width / 2, scene.scale.height - 36, '', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '16px',
        color: '#fdf6e3',
        align: 'center',
        resolution: DPR,
      })
      .setShadow(0, 1, 'rgba(15,12,26,0.9)', 4)
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(900);
    this.pulse = null;
  }

  redrawPill() {
    const w = this.text.width + 44;
    const h = this.text.height + 16;
    const x = this.text.x - w / 2;
    const y = this.text.y - h / 2;
    this.pill.clear();
    this.pill.fillStyle(0x0d0b16, 0.4);
    this.pill.fillRoundedRect(x, y, w, h, h / 2);
  }

  show(message) {
    this.scene.tweens.killTweensOf([this.text, this.pill]);
    this.text.setText(message);
    this.redrawPill();
    this.scene.tweens.add({ targets: this.pill, alpha: 1, duration: 500, ease: 'Sine.easeOut' });
    this.scene.tweens.add({
      targets: this.text,
      alpha: 0.95,
      duration: 500,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.pulse = this.scene.tweens.add({
          targets: this.text,
          alpha: 0.6,
          duration: 950,
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
    this.redrawPill();
  }

  hide() {
    if (this.pulse) {
      this.pulse.stop();
      this.pulse = null;
    }
    this.scene.tweens.killTweensOf([this.text, this.pill]);
    this.scene.tweens.add({
      targets: [this.text, this.pill],
      alpha: 0,
      duration: 350,
      ease: 'Sine.easeIn',
    });
  }
}
