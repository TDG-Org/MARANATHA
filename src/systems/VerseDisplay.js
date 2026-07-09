import { Narrator } from './Narrator.js';
import { overVolumeUI } from './AudioSystem.js';
import { GW, TEXT_RES } from '../config.js';

// Scripture on screen — required on every beat, game-wide (see
// scripture-accuracy skill). Rendered at device-pixel resolution (no blur),
// on a soft dark panel so it stays legible over bright skies, and read
// aloud by the narrator: show() resolves only after the full verse has
// been read, so beats never advance mid-verse. A deliberate tap (after the
// verse has been up a moment) skips ahead for re-readers.
export default class VerseDisplay {
  constructor(scene) {
    this.scene = scene;
    const W = GW;
    this.panel = scene.add.graphics().setDepth(899).setAlpha(0);
    this.text = scene.add
      .text(W / 2, 34, '', {
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: '21px',
        fontStyle: 'italic',
        color: '#fdf0d5',
        align: 'center',
        wordWrap: { width: 680 },
        lineSpacing: 5,
        resolution: TEXT_RES,
      })
      .setShadow(0, 1, 'rgba(15,12,26,0.9)', 5)
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(900);
    this.ref = scene.add
      .text(W / 2, 0, '', {
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '14px',
        color: '#f5e6c4',
        letterSpacing: 3,
        resolution: TEXT_RES,
      })
      .setShadow(0, 1, 'rgba(15,12,26,0.9)', 4)
      .setOrigin(0.5, 0)
      .setAlpha(0)
      .setDepth(900);
  }

  redrawPanel() {
    const W = GW;
    const w = Math.max(this.text.width, this.ref.width) + 56;
    const h = this.text.height + this.ref.height + 34;
    this.panel.clear();
    // 0.62 keeps the verse >=4.5:1 even over the brightest golden sky.
    this.panel.fillStyle(0x0d0b16, 0.62);
    this.panel.fillRoundedRect(W / 2 - w / 2, 22, w, h, 14);
    return h;
  }

  // verse: { text, ref }. Resolves after fade-in AND the narrator finishes
  // reading AND minHold — whichever is longest. A deliberate tap / Space /
  // Enter after 1.2s skips the rest (fast readers, replays, stalled TTS).
  show(verse, { hold = 0, narrate = true } = {}) {
    return new Promise((resolve) => {
      Narrator.cancel();
      const fadeIn = () => {
        this.text.setText(verse.text);
        this.ref.setText(verse.ref.toUpperCase());
        this.ref.setY(this.text.y + this.text.height + 8);
        this.redrawPanel();
        this.scene.tweens.add({ targets: this.text, alpha: 1, duration: 700, ease: 'Sine.easeOut' });
        this.scene.tweens.add({ targets: this.panel, alpha: 1, duration: 700, ease: 'Sine.easeOut' });
        this.scene.tweens.add({ targets: this.ref, alpha: 0.9, duration: 700, ease: 'Sine.easeOut' });

        let done = false;
        let skipReady = false;
        const keyboard = this.scene.input.keyboard;
        const finish = () => {
          if (done) return;
          done = true;
          this.scene.input.off('pointerup', onSkip);
          keyboard?.off('keydown-SPACE', onSkip);
          keyboard?.off('keydown-ENTER', onSkip);
          resolve();
        };
        const onSkip = (p) => {
          if (!skipReady) return;
          if (p && p.worldX !== undefined && overVolumeUI(p.worldX, p.worldY)) return;
          Narrator.cancel();
          this.scene.time.delayedCall(220, finish);
        };
        this.scene.time.delayedCall(1200, () => { skipReady = true; });
        this.scene.input.on('pointerup', onSkip);
        keyboard?.on('keydown-SPACE', onSkip);
        keyboard?.on('keydown-ENTER', onSkip);

        const waits = [new Promise((r) => this.scene.time.delayedCall(Math.max(hold, 900), r))];
        if (narrate) waits.push(Narrator.speak(verse.text));
        Promise.all(waits).then(finish);
      };
      if (this.text.alpha > 0.05) {
        this.scene.tweens.add({
          targets: [this.text, this.ref, this.panel],
          alpha: 0,
          duration: 320,
          ease: 'Sine.easeIn',
          onComplete: fadeIn,
        });
      } else {
        fadeIn();
      }
    });
  }

  hide() {
    Narrator.cancel();
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: [this.text, this.ref, this.panel],
        alpha: 0,
        duration: 450,
        ease: 'Sine.easeIn',
        onComplete: resolve,
      });
    });
  }
}
