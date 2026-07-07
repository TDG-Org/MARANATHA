// Scripture on screen — required on every beat, game-wide (see
// scripture-accuracy skill). Subtle but visible: quiet serif italic at the
// top of the sky, reference underneath, gentle cross-fades between verses.
export default class VerseDisplay {
  constructor(scene) {
    this.scene = scene;
    const W = scene.scale.width;
    this.text = scene.add
      .text(W / 2, 34, '', {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '19px',
        fontStyle: 'italic',
        color: '#f5e6c4',
        align: 'center',
        wordWrap: { width: 700 },
      })
      .setShadow(0, 1, 'rgba(20,16,33,0.85)', 6)
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(900);
    this.ref = scene.add
      .text(W / 2, 0, '', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '11px',
        color: '#f5e6c4',
        letterSpacing: 3,
      })
      .setShadow(0, 1, 'rgba(20,16,33,0.85)', 5)
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(900);
  }

  // verse: { text, ref }. Resolves after fade-in (+ optional hold).
  show(verse, { hold = 0 } = {}) {
    return new Promise((resolve) => {
      const fadeIn = () => {
        this.text.setText(verse.text);
        this.ref.setText(verse.ref.toUpperCase());
        this.ref.setY(this.text.y + this.text.height + 7);
        this.scene.tweens.add({
          targets: this.text,
          alpha: 0.95,
          duration: 700,
          ease: 'Sine.easeOut',
        });
        this.scene.tweens.add({
          targets: this.ref,
          alpha: 0.6,
          duration: 700,
          ease: 'Sine.easeOut',
          onComplete: () => {
            if (hold > 0) this.scene.time.delayedCall(hold, resolve);
            else resolve();
          },
        });
      };
      if (this.text.alpha > 0.05) {
        this.scene.tweens.add({
          targets: [this.text, this.ref],
          alpha: 0,
          duration: 350,
          ease: 'Sine.easeIn',
          onComplete: fadeIn,
        });
      } else {
        fadeIn();
      }
    });
  }

  hide() {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: [this.text, this.ref],
        alpha: 0,
        duration: 450,
        ease: 'Sine.easeIn',
        onComplete: resolve,
      });
    });
  }
}
