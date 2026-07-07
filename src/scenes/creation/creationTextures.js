import Phaser from 'phaser';

// Every Creation texture is generated in code (art-style rule: zero image
// assets). All living things are flat silhouettes, per the Alto look.

const SIL = 0x1a1428; // silhouette ink

function g(scene) {
  return scene.make.graphics({ add: false });
}

export function createCreationTextures(scene) {
  const t = scene.textures;

  // --- Water: deep Alto blue with faint highlight streaks; tiles both ways.
  if (!t.exists('water')) {
    const w = 960;
    const h = 150;
    const canvas = t.createCanvas('water', w, h);
    const ctx = canvas.getContext();
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2a5273');
    grd.addColorStop(1, '#152c42');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(136,201,212,0.5)';
    ctx.fillRect(0, 0, w, 2);
    const rnd = new Phaser.Math.RandomDataGenerator(['water']);
    for (let i = 0; i < 30; i++) {
      const sx = rnd.between(0, w);
      const sw = rnd.between(30, 140);
      const sy = rnd.between(8, h - 6);
      ctx.fillStyle = `rgba(136,201,212,${rnd.realInRange(0.05, 0.14)})`;
      ctx.fillRect(sx, sy, sw, 2);
      if (sx + sw > w) ctx.fillRect(sx - w, sy, sw, 2); // wrap for seamless tiling
    }
    canvas.refresh();
  }

  // --- Cloud: cluster of soft white puffs.
  if (!t.exists('cloud')) {
    const w = 220;
    const h = 100;
    const canvas = t.createCanvas('cloud', w, h);
    const ctx = canvas.getContext();
    const puffs = [
      [60, 58, 34],
      [105, 46, 42],
      [150, 56, 36],
      [85, 66, 30],
      [130, 68, 28],
    ];
    for (const [x, y, r] of puffs) {
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.85)');
      grd.addColorStop(0.6, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    canvas.refresh();
  }

  // --- Soft-edged darkness strip (Day 1: darkness swept aside by light).
  if (!t.exists('dark-edge')) {
    const canvas = t.createCanvas('dark-edge', 256, 2);
    const ctx = canvas.getContext();
    const grd = ctx.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0, 'rgba(2,2,6,0)');
    grd.addColorStop(1, 'rgba(2,2,6,1)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 2);
    canvas.refresh();
  }

  // --- Trees.
  if (!t.exists('tree-pine')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillRect(20, 50, 4, 14);
    gr.fillTriangle(22, 2, 10, 26, 34, 26);
    gr.fillTriangle(22, 14, 6, 40, 38, 40);
    gr.fillTriangle(22, 26, 2, 54, 42, 54);
    gr.generateTexture('tree-pine', 44, 64);
    gr.destroy();
  }
  if (!t.exists('tree-round')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillRect(20, 40, 4, 18);
    gr.fillCircle(22, 24, 17);
    gr.fillCircle(11, 31, 10);
    gr.fillCircle(33, 31, 10);
    gr.generateTexture('tree-round', 44, 60);
    gr.destroy();
  }
  if (!t.exists('grass')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillTriangle(2, 10, 4, 0, 6, 10);
    gr.fillTriangle(6, 10, 8, 2, 10, 10);
    gr.fillTriangle(9, 10, 12, 1, 13, 10);
    gr.generateTexture('grass', 14, 10);
    gr.destroy();
  }

  // --- Animals (facing right; flipX to face left).
  if (!t.exists('deer')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillEllipse(30, 32, 36, 17); // body
    gr.fillRect(16, 38, 3, 20);
    gr.fillRect(23, 38, 3, 20);
    gr.fillRect(38, 38, 3, 20);
    gr.fillRect(45, 38, 3, 20);
    gr.fillTriangle(44, 30, 54, 12, 50, 34); // neck
    gr.fillEllipse(55, 12, 13, 9); // head
    gr.lineStyle(2, SIL, 1); // antlers
    gr.lineBetween(53, 7, 48, 1);
    gr.lineBetween(57, 7, 60, 0);
    gr.generateTexture('deer', 64, 58);
    gr.destroy();
  }
  if (!t.exists('sheep')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillCircle(16, 18, 11);
    gr.fillCircle(27, 15, 12);
    gr.fillCircle(35, 19, 10);
    gr.fillRect(12, 26, 3, 11);
    gr.fillRect(20, 27, 3, 10);
    gr.fillRect(30, 27, 3, 10);
    gr.fillRect(38, 26, 3, 11);
    gr.fillEllipse(43, 15, 11, 9); // head
    gr.generateTexture('sheep', 50, 38);
    gr.destroy();
  }
  if (!t.exists('rabbit')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillCircle(11, 17, 8);
    gr.fillCircle(19, 11, 5.5);
    gr.fillEllipse(18, 3, 3, 9); // ears
    gr.fillEllipse(22, 4, 3, 9);
    gr.fillCircle(3, 15, 2.5); // tail
    gr.generateTexture('rabbit', 28, 26);
    gr.destroy();
  }

  // --- Adam.
  if (!t.exists('adam-lying')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillCircle(7, 9, 5);
    gr.fillRoundedRect(13, 5, 36, 8, 4);
    gr.generateTexture('adam-lying', 52, 16);
    gr.destroy();
  }
  if (!t.exists('adam-standing')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    gr.fillCircle(11, 6, 5.5);
    gr.fillRoundedRect(7, 12, 8, 21, 4);
    gr.fillRect(7.5, 32, 3, 15);
    gr.fillRect(11.5, 32, 3, 15);
    gr.fillRect(4.5, 14, 2.5, 13); // arms
    gr.fillRect(15, 14, 2.5, 13);
    gr.generateTexture('adam-standing', 22, 48);
    gr.destroy();
  }

  // --- Fish & bird.
  if (!t.exists('fish')) {
    const gr = g(scene);
    gr.fillStyle(0x0e2438, 1);
    gr.fillEllipse(14, 7, 18, 9);
    gr.fillTriangle(22, 7, 28, 2, 28, 12); // tail
    gr.generateTexture('fish', 28, 14);
    gr.destroy();
  }
  if (!t.exists('bird')) {
    const gr = g(scene);
    gr.lineStyle(3, 0x241f38, 1);
    gr.beginPath();
    gr.moveTo(2, 10);
    gr.lineTo(13, 4);
    gr.lineTo(24, 10);
    gr.strokePath();
    gr.generateTexture('bird', 26, 14);
    gr.destroy();
  }
}
