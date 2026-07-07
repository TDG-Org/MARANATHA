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

  // --- Animals (facing right; flipX to face left). Feet on bottom edge.
  if (!t.exists('deer')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    // legs — slender, slightly tapered stance
    gr.fillRect(20, 42, 3, 22);
    gr.fillRect(28, 43, 2.5, 21);
    gr.fillRect(46, 42, 3, 22);
    gr.fillRect(53, 43, 2.5, 21);
    // body — haunch, barrel, chest
    gr.fillCircle(24, 36, 10);
    gr.fillEllipse(37, 37, 30, 15);
    gr.fillCircle(50, 36, 8);
    // neck sweeping up to the head
    gr.fillTriangle(48, 34, 57, 13, 62, 18);
    gr.fillTriangle(48, 34, 62, 18, 54, 38);
    // head + snout + ear
    gr.fillEllipse(61, 14, 12, 8);
    gr.fillEllipse(67, 16, 7, 4.5);
    gr.fillTriangle(57, 9, 54, 3, 60, 7);
    // tail
    gr.fillTriangle(14, 32, 10, 28, 16, 36);
    // antlers — branched
    gr.lineStyle(2, SIL, 1);
    gr.lineBetween(60, 8, 56, 0);
    gr.lineBetween(58, 4, 54, 3);
    gr.lineBetween(63, 8, 68, 1);
    gr.lineBetween(65, 5, 69, 5);
    gr.generateTexture('deer', 74, 64);
    gr.destroy();
  }
  if (!t.exists('sheep')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    // woolly body — cloud of circles
    gr.fillCircle(15, 18, 9);
    gr.fillCircle(24, 13, 10);
    gr.fillCircle(33, 16, 9);
    gr.fillCircle(27, 21, 10);
    gr.fillCircle(18, 12, 7);
    // legs
    gr.fillRect(13, 28, 2.5, 12);
    gr.fillRect(20, 29, 2.5, 11);
    gr.fillRect(30, 29, 2.5, 11);
    gr.fillRect(37, 28, 2.5, 12);
    // head dipped slightly, ear
    gr.fillEllipse(44, 17, 10, 8);
    gr.fillEllipse(41, 12, 5, 3);
    gr.generateTexture('sheep', 52, 40);
    gr.destroy();
  }
  if (!t.exists('rabbit')) {
    const gr = g(scene);
    gr.fillStyle(SIL, 1);
    // sitting: big haunch, chest, head up
    gr.fillCircle(11, 19, 8.5);
    gr.fillCircle(18, 20, 5.5);
    gr.fillCircle(21, 12, 5);
    // ears — two leaning blades
    gr.fillTriangle(18, 10, 16, 0, 21, 9);
    gr.fillTriangle(22, 10, 24, 0, 26, 10);
    // tail + front paw
    gr.fillCircle(3, 20, 2.8);
    gr.fillRect(20, 24, 3, 4);
    gr.generateTexture('rabbit', 30, 28);
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
    gr.fillCircle(12, 6, 5.5);
    // shoulders + torso tapering to the waist
    gr.fillRoundedRect(6, 13, 12, 7, 3);
    gr.fillRoundedRect(7.5, 16, 9, 16, 4);
    // arms
    gr.fillRoundedRect(4.5, 15, 2.6, 14, 1.3);
    gr.fillRoundedRect(16.9, 15, 2.6, 14, 1.3);
    // legs
    gr.fillRoundedRect(8, 31, 3.6, 19, 1.8);
    gr.fillRoundedRect(12.6, 31, 3.6, 19, 1.8);
    gr.generateTexture('adam-standing', 24, 52);
    gr.destroy();
  }

  // --- Fish & bird.
  if (!t.exists('fish')) {
    const gr = g(scene);
    gr.fillStyle(0x0e2438, 1);
    gr.fillEllipse(12, 9, 18, 9);
    gr.fillTriangle(19, 9, 28, 3, 28, 15); // tail
    gr.fillTriangle(9, 5, 14, 5, 12, 1);   // dorsal fin
    gr.fillTriangle(10, 12, 14, 12, 13, 16); // lower fin
    gr.generateTexture('fish', 30, 18);
    gr.destroy();
  }
  if (!t.exists('bird')) {
    const gr = g(scene);
    gr.lineStyle(2.5, 0x241f38, 1);
    gr.beginPath();
    gr.moveTo(1, 10);
    gr.lineTo(6, 6);
    gr.lineTo(13, 4);
    gr.lineTo(20, 6);
    gr.lineTo(25, 10);
    gr.strokePath();
    gr.generateTexture('bird', 26, 14);
    gr.destroy();
  }
}
