import Phaser from 'phaser';

// Procedural silhouette ridgelines (see art-style skill).
// Ridges are sums of sines with whole-number frequencies, so every texture
// tiles seamlessly when scrolled in a TileSprite.
export function createRidgeTexture(scene, key, {
  width = 960,
  height = 260,
  color = 0x3a3153,
  baseline = 100,
  waves = [[1, 42], [3, 20], [7, 8]],
  seed = 1,
} = {}) {
  if (scene.textures.exists(key)) return key;
  const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
  const phases = waves.map(() => rnd.frac() * Math.PI * 2);
  const g = scene.make.graphics({ add: false });
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(0, height);
  for (let x = 0; x <= width; x += 4) {
    let y = baseline;
    waves.forEach(([freq, amp], i) => {
      y += Math.sin((x / width) * Math.PI * 2 * freq + phases[i]) * amp;
    });
    g.lineTo(x, Phaser.Math.Clamp(y, 4, height - 4));
  }
  g.lineTo(width, height);
  g.closePath();
  g.fillPath();
  g.generateTexture(key, width, height);
  g.destroy();
  return key;
}

// A stack of scrolling silhouette layers. Farther layers are lighter (haze)
// and slower; nearer layers darker and faster.
export default class ParallaxGroup {
  constructor(scene) {
    this.scene = scene;
    this.layers = [];
  }

  addRidge({ key, texture = {}, y, speed = 0.2, depth = 0, alpha = 1 }) {
    createRidgeTexture(this.scene, key, texture);
    const height = texture.height ?? 260;
    const ts = this.scene.add
      .tileSprite(0, y ?? this.scene.scale.height - height, this.scene.scale.width, height, key)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setAlpha(alpha);
    this.layers.push({ ts, speed });
    return ts;
  }

  // dir: +1 scrolls the world leftward past the camera (walking right).
  update(delta, dir = 1) {
    const frame = delta / 16.667;
    for (const layer of this.layers) {
      layer.ts.tilePositionX += layer.speed * frame * dir;
    }
  }

  setAlpha(alpha) {
    for (const layer of this.layers) layer.ts.setAlpha(alpha);
  }
}
