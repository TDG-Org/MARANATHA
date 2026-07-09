import Phaser from 'phaser';

// Reusable narration/dialogue card: a quiet rounded panel centered on
// screen. Auto-hides after `hold` ms, or waits for a tap when
// tapToContinue is set (future stories with real dialogue use that mode).
import { GW, GH, TEXT_RES } from '../config.js';

export default class DialogueBox {
  constructor(scene) {
    this.scene = scene;
    const W = GW;
    const H = GH;
    this.container = scene.add.container(W / 2, H / 2).setDepth(920).setAlpha(0);
    this.panel = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '21px',
        color: '#fdf6e3',
        align: 'center',
        wordWrap: { width: 560 },
        lineSpacing: 6,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.hint = scene.add
      .text(0, 0, 'tap to continue', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '13px',
        color: '#f5e6c4',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setAlpha(0);
    this.container.add([this.panel, this.text, this.hint]);
  }

  redrawPanel() {
    const padX = 34;
    const padY = 22;
    const w = this.text.width + padX * 2;
    const h = this.text.height + padY * 2;
    this.panel.clear();
    this.panel.fillStyle(0x0d0b16, 0.78);
    this.panel.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.panel.lineStyle(1, 0xf5e6c4, 0.28);
    this.panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    this.hint.setY(h / 2 + 16);
  }

  show(message, { hold = 1800, tapToContinue = false, y } = {}) {
    return new Promise((resolve) => {
      this.text.setText(message);
      this.redrawPanel();
      this.container.setY(y ?? GH / 2);
      this.container.setScale(0.96);
      this.scene.tweens.add({
        targets: this.container,
        alpha: 1,
        scale: 1,
        duration: 420,
        ease: 'Sine.easeOut',
        onComplete: () => {
          const dismiss = () => {
            this.scene.tweens.add({
              targets: this.container,
              alpha: 0,
              duration: 380,
              ease: 'Sine.easeIn',
              onComplete: resolve,
            });
          };
          if (tapToContinue) {
            this.hint.setAlpha(0.6);
            this.scene.tweens.add({
              targets: this.hint,
              alpha: 0.45,
              duration: 800,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
            });
            this.scene.input.once(Phaser.Input.Events.POINTER_UP, () => {
              this.scene.tweens.killTweensOf(this.hint);
              this.hint.setAlpha(0);
              dismiss();
            });
          } else {
            this.scene.time.delayedCall(hold, dismiss);
          }
        },
      });
    });
  }
}
