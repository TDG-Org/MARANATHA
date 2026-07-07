import { GW, GH } from '../config.js';

// Soft full-screen veil for beat/day transitions — never a hard cut.
// Fades a colored cover in, runs `onHold` (swap world state while hidden),
// holds, fades out. Resolves when fully clear again.
export function veil(scene, {
  color = 0x000000,
  maxAlpha = 1,
  inMs = 650,
  holdMs = 300,
  outMs = 800,
  onHold,
} = {}) {
  return new Promise((resolve) => {
    const cover = scene.add
      .rectangle(0, 0, GW, GH, color)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(950);
    scene.tweens.add({
      targets: cover,
      alpha: maxAlpha,
      duration: inMs,
      ease: 'Sine.easeIn',
      onComplete: async () => {
        await onHold?.();
        scene.time.delayedCall(holdMs, () => {
          scene.tweens.add({
            targets: cover,
            alpha: 0,
            duration: outMs,
            ease: 'Sine.easeOut',
            onComplete: () => {
              cover.destroy();
              resolve();
            },
          });
        });
      },
    });
  });
}
