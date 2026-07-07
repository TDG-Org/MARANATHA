import Phaser from 'phaser';
import GradientSky from '../../systems/GradientSky.js';
import { createRidgeTexture } from '../../systems/Parallax.js';
import VerseDisplay from '../../systems/VerseDisplay.js';
import DialogueBox from '../../systems/DialogueBox.js';
import Directions from '../../systems/Directions.js';
import { veil } from '../../systems/Transitions.js';
import { VERSES as V } from '../../data/verses.js';
import { completeStory } from '../../systems/SaveSystem.js';
import { Audio, attachAudioToggle } from '../../systems/AudioSystem.js';
import { Narrator } from '../../systems/Narrator.js';
import { createCreationTextures } from './creationTextures.js';

// CREATION — Genesis 1–2, seven days in one persistent world so each day's
// work is still there the next morning. Core rule (scripture-accuracy skill):
// God acts FIRST — the light from above speaks — then the player is invited
// to take part as His hands. The player is never God; Day 1 is God's alone.
const SKY = {
  void: [0x000000, 0x0a0a12],
  firstLight: [0x1a1a2e, 0xe8a87c],
  day2dim: [0x2a3558, 0x8a94ac],
  day2: [0x4a6a98, 0xe8c8a8],
  day3: [0x6a92b8, 0xf2d8b0],
  golden: [0xf2b880, 0xffe9c9],
  night: [0x0b1026, 0x2b3a67],
  dayBlue: [0x7ec8e3, 0xf7e8d0],
  rest: [0xf2b880, 0xffe9c9],
};

const GROUND_Y = 384; // where feet stand (the shoreline)
const SEA_TOP = 390;

export default class CreationScene extends Phaser.Scene {
  constructor() {
    super('Creation');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.W = W;
    this.H = H;

    createCreationTextures(this);
    createRidgeTexture(this, 'cr-far', {
      height: 300, color: 0x8a7f9e, baseline: 110, waves: [[1, 50], [2, 26], [5, 9]], seed: 101,
    });
    createRidgeTexture(this, 'cr-mid', {
      height: 240, color: 0x5d5378, baseline: 85, waves: [[2, 36], [4, 16], [9, 6]], seed: 102,
    });
    createRidgeTexture(this, 'cr-ground', {
      height: 190, color: 0x241f38, baseline: 30, waves: [[3, 8], [7, 4]], seed: 103,
    });

    // --- Persistent world (accumulates day by day) -----------------------
    this.sky = new GradientSky(this, ...SKY.void);

    this.stars = [];
    // Layered lights (tight bright core + faint wide halo) instead of one
    // big blob — keeps the sky luminous without washing out text or world.
    this.sun = this.makeLight(W * 0.7, H + 90, {
      core: 1.15, halo: 2.6, coreAlpha: 0.95, haloAlpha: 0.28, depth: -60,
    }).setVisible(false);
    this.moon = this.makeLight(W * 0.3, H + 80, {
      coreTint: 0xdfe6f5, haloTint: 0xd8e0f0, core: 0.7, halo: 1.5, coreAlpha: 0.85, haloAlpha: 0.2, depth: -58,
    }).setVisible(false);

    this.clouds = [];

    // The sea — "the deep" of Gen 1:2, nearly black until God's light.
    this.sea = this.add.tileSprite(0, 240, W, 300, 'water').setOrigin(0, 0).setDepth(4);
    this.sea.setTint(0x1a2530);
    this.seaTint = 0x1a2530;

    // Land, hidden below the horizon until Day 3.
    this.ridgeFar = this.add.tileSprite(0, H + 20, W, 300, 'cr-far').setOrigin(0, 0).setDepth(1);
    this.ridgeMid = this.add.tileSprite(0, H + 80, W, 240, 'cr-mid').setOrigin(0, 0).setDepth(2);
    this.ridgeGround = this.add.tileSprite(0, H + 120, W, 190, 'cr-ground').setOrigin(0, 0).setDepth(3);

    this.groundProps = this.add.container(0, 0).setDepth(3.4); // planted trees, grass, animals
    this.passing = []; // Day 7 scenery that walks past

    this.fish = [];
    this.birds = [];
    this.fishTarget = new Phaser.Math.Vector2(W / 2, 460);
    this.birdTarget = new Phaser.Math.Vector2(W / 2, 150);

    // God's light — always from ABOVE, never the player's.
    this.godLight = this.makeLight(W / 2, -180, {
      core: 2.1, halo: 4.6, coreAlpha: 0.5, haloAlpha: 0.22, depth: 600,
    }).setAlpha(0);

    // --- UI systems -------------------------------------------------------
    this.verse = new VerseDisplay(this);
    this.dialogue = new DialogueBox(this);
    this.directions = new Directions(this);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keys = this.input.keyboard?.addKeys('A,D');

    this.walking = false;
    this.walkDist = 0;

    attachAudioToggle(this);
    Audio.ambience({ wind: 0.1, water: 0, night: 0, birds: 0 }, 1);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Audio.setBirds(0);
      Narrator.cancel();
    });

    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.runStory();
  }

  // Tight core + wide faint halo, grouped so position/alpha/scale tweens
  // treat it as one light.
  makeLight(x, y, { coreTint = 0xfff3d6, haloTint = 0xfff3d6, core = 1, halo = 2.4, coreAlpha = 0.9, haloAlpha = 0.3, depth = 0 } = {}) {
    const c = this.add.container(x, y).setDepth(depth);
    c.add(this.add.image(0, 0, 'glow').setScale(halo).setTint(haloTint).setAlpha(haloAlpha).setBlendMode(Phaser.BlendModes.ADD));
    c.add(this.add.image(0, 0, 'glow').setScale(core).setTint(coreTint).setAlpha(coreAlpha).setBlendMode(Phaser.BlendModes.ADD));
    return c;
  }

  // =========================================================================
  // The seven days
  // =========================================================================
  async runStory() {
    await this.dialogue.show('C R E A T I O N\nGenesis 1–2', { hold: 2100 });
    await this.day1();
    await this.day2();
    await this.day3();
    await this.day4();
    await this.day5();
    await this.day6();
    await this.day7();
  }

  // --- DAY 1 — LIGHT. God acts alone; the player does nothing. ------------
  async day1() {
    await this.verse.show(V.gen_1_1, { hold: 2800 });

    // Darkness lies over everything, waiting to be swept aside.
    const darkness = this.add.container(0, 0).setDepth(500);
    const edge = this.add.image(-300, 0, 'dark-edge').setOrigin(0, 0).setDisplaySize(300, this.H).setFlipX(true);
    const slab = this.add.rectangle(0, 0, this.W * 2.2, this.H, 0x020206).setOrigin(0, 0);
    darkness.add([edge, slab]);

    // "Let there be light" — the light descends from above, God's alone.
    Audio.godChord();
    const versePromise = this.verse.show(V.gen_1_3, { hold: 600 });
    await this.tweenP({
      targets: this.godLight,
      y: 25,
      alpha: 1,
      scale: 1.35,
      duration: 2800,
      ease: 'Sine.easeOut',
    });
    await versePromise;

    // Light fills and sweeps the darkness aside — animated by God, not the user.
    Audio.swellBright();
    Audio.rumble(2.6);
    this.sky.tweenTo(...SKY.firstLight, { duration: 3200 });
    this.tweenSeaTint(0x2a4258, 3200);
    await this.tweenP({
      targets: darkness,
      x: this.W * 2.3,
      duration: 3400,
      ease: 'Sine.easeInOut',
    });
    darkness.destroy();
    Audio.ambience({ wind: 0.2 });

    await this.verse.show(V.gen_1_4, { hold: 2400 });

    // The light settles into a constant presence above the world.
    this.tweenP({ targets: this.godLight, alpha: 0.28, scale: 1, duration: 1600, ease: 'Sine.easeInOut' });

    await this.sealDay(V.gen_1_5, '— Day One —');
    await veil(this, {
      maxAlpha: 1,
      onHold: () => {
        // Morning of Day 2: endless still water under a dim sky. Eased so it
        // stays smooth as the veil lifts back off it.
        this.sky.tweenTo(...SKY.day2dim, { duration: 900 });
        this.tweenSeaTint(0x7e94a6, 900);
        Audio.ambience({ water: 0.3, wind: 0.25 });
      },
    });
  }

  // --- DAY 2 — SKY. Swipe up: lift the waters into the sky. ---------------
  async day2() {
    await Promise.all([this.godSpeak(), this.verse.show(V.gen_1_6, { hold: 2500 })]);

    this.directions.show('Swipe or drag upward — lift the waters into the sky.');
    await this.waitForSwipe('up');
    this.directions.hide();

    // Waters below settle; waters above become the clouds of the vault.
    Audio.whooshUp();
    Audio.splash();
    this.tweenP({ targets: this.sea, y: 300, duration: 3000, ease: 'Sine.easeInOut' });
    this.tweenSeaTint(0xffffff, 3000);
    this.sky.tweenTo(...SKY.day2, { duration: 3200 });
    const cloudSpots = [
      [180, 70, 0.75], [480, 115, 0.6], [760, 88, 0.7],
    ];
    cloudSpots.forEach(([x, y, a], i) => {
      const c = this.add.image(x, 250, 'cloud').setAlpha(0).setDepth(-45);
      c.driftSpeed = 0.03 + i * 0.012;
      this.clouds.push(c);
      this.tweens.add({ targets: c, y, alpha: a, duration: 2600, delay: 300 + i * 350, ease: 'Sine.easeOut' });
    });
    await this.wait(3300);

    await this.sealDay(V.gen_1_8, '— Day Two —');
    await veil(this, { maxAlpha: 0.5 });
  }

  // --- DAY 3 — LAND & PLANTS. --------------------------------------------
  async day3() {
    await Promise.all([this.godSpeak(), this.verse.show(V.gen_1_9, { hold: 2500 })]);

    this.directions.show('Drag downward — pull the waters back and raise the land.');
    await this.waitForSwipe('down');
    this.directions.hide();

    // The seas gather; the dry land rises like Alto ridgelines.
    Audio.whooshDown();
    Audio.rumble(3);
    this.tweenP({ targets: this.sea, y: SEA_TOP, duration: 3000, ease: 'Sine.easeInOut' });
    this.sky.tweenTo(...SKY.day3, { duration: 3200 });
    this.tweens.add({ targets: this.ridgeFar, y: 240, duration: 2600, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: this.ridgeMid, y: 300, duration: 2800, delay: 220, ease: 'Cubic.easeOut' });
    await this.tweenP({ targets: this.ridgeGround, y: 350, duration: 3000, delay: 420, ease: 'Cubic.easeOut' });
    Audio.ambience({ water: 0.25, wind: 0.3 });

    await Promise.all([this.godSpeak(), this.verse.show(V.gen_1_11, { hold: 2300 })]);

    this.directions.show('Tap the bare earth — bring it to life.  (0/5)');
    let planted = 0;
    while (planted < 5) {
      const p = await this.waitForTap((pt) => pt.y > 290 && pt.y < 520);
      planted += 1;
      this.plantTree(Phaser.Math.Clamp(p.x, 50, this.W - 50));
      this.directions.set(`Tap the bare earth — bring it to life.  (${planted}/5)`);
    }
    this.directions.hide();

    // The earth answers with more than was asked — grass springs up too.
    for (let i = 0; i < 12; i++) {
      this.time.delayedCall(i * 90, () => this.plantGrass(Phaser.Math.Between(40, this.W - 40)));
    }
    await this.wait(1300);

    await this.sealDay(V.gen_1_12, '— Day Three —');
    await veil(this, { maxAlpha: 0.5 });
  }

  // --- DAY 4 — SUN, MOON, STARS. -----------------------------------------
  async day4() {
    await Promise.all([this.godSpeak(), this.verse.show(V.gen_1_14, { hold: 2500 })]);

    this.directions.show('Tap the sky — bring up the sun.');
    await this.waitForTap();
    this.directions.hide();
    Audio.swellBright();
    this.sun.setVisible(true);
    this.sky.tweenTo(...SKY.golden, { duration: 2800 });
    await this.tweenP({ targets: this.sun, y: 170, duration: 2600, ease: 'Cubic.easeOut' });

    this.directions.show('Tap again — bring up the moon.');
    await this.waitForTap();
    this.directions.hide();
    Audio.swellSoft();
    Audio.ambience({ night: 0.35, wind: 0.15, birds: 0 });
    this.moon.setVisible(true);
    this.sky.tweenTo(...SKY.night, { duration: 3000 });
    this.tweenSeaTint(0x8898b8, 3000);
    this.tweens.add({ targets: this.sun, y: this.H + 120, duration: 2600, ease: 'Sine.easeIn' });
    this.clouds.forEach((c) => this.tweens.add({ targets: c, alpha: 0.22, duration: 2600, ease: 'Sine.easeInOut' }));
    await this.tweenP({ targets: this.moon, y: 130, duration: 2800, ease: 'Cubic.easeOut' });

    this.directions.show('Tap the night sky — fill it with stars.  (0/20)');
    let starCount = 0;
    while (starCount < 20) {
      await this.waitForTap();
      Audio.sparkle(5);
      this.addStars(5);
      starCount += 5;
      this.directions.set(`Tap the night sky — fill it with stars.  (${starCount}/20)`);
    }
    this.directions.hide();
    await this.wait(900);

    await this.sealDay(V.gen_1_17, '— Day Four —');
    await veil(this, {
      maxAlpha: 1,
      inMs: 900,
      outMs: 1100,
      onHold: () => {
        // A new morning: stars and moon give way to the risen sun.
        this.stars.forEach((s) => this.tweens.add({ targets: s, alpha: 0, duration: 600, ease: 'Sine.easeIn' }));
        this.moon.setPosition(this.W * 0.3, this.H + 80).setVisible(false);
        this.sun.setPosition(this.W * 0.72, 170).setVisible(true);
        this.sky.tweenTo(...SKY.dayBlue, { duration: 500 });
        this.tweenSeaTint(0xffffff, 600);
        this.clouds.forEach((c) => this.tweens.add({ targets: c, alpha: 0.7, duration: 700, ease: 'Sine.easeOut' }));
        Audio.ambience({ night: 0, birds: 0.3, wind: 0.25, water: 0.3 });
      },
    });
    this.stars.forEach((s) => { this.tweens.killTweensOf(s); s.destroy(); });
    this.stars = [];
  }

  // --- DAY 5 — SEA & SKY LIFE. --------------------------------------------
  async day5() {
    await Promise.all([this.godSpeak(), this.verse.show(V.gen_1_20, { hold: 2500 })]);

    // Fish first: they follow the player's hand through the sea.
    Audio.splash();
    for (let i = 0; i < 8; i++) {
      const f = this.add.sprite(Phaser.Math.Between(80, this.W - 80), Phaser.Math.Between(420, 510), 'fish')
        .setAlpha(0).setDepth(4.2).setScale(Phaser.Math.FloatBetween(1.0, 1.5));
      f.vx = 0; f.vy = 0;
      f.off = new Phaser.Math.Vector2(Phaser.Math.Between(-70, 70), Phaser.Math.Between(-28, 28));
      this.fish.push(f);
      this.tweens.add({ targets: f, alpha: 1, duration: 800, delay: i * 120, ease: 'Sine.easeOut' });
    }
    this.directions.show('Move your hand through the sea — guide the fish.');
    this.fishFollow = true;
    this.fishTime = 0;
    await new Promise((resolve) => { this.fishDone = resolve; });
    this.fishFollow = false;

    // Then the birds swirl into the open sky.
    Audio.chirp(0.8);
    Audio.ambience({ birds: 0.45 });
    for (let i = 0; i < 8; i++) {
      const b = this.add.sprite(-30 - i * 26, Phaser.Math.Between(90, 220), 'bird')
        .setDepth(2.5).setScale(Phaser.Math.FloatBetween(0.8, 1.15));
      b.orbitR = Phaser.Math.Between(28, 85);
      b.orbitA = Phaser.Math.FloatBetween(0, Math.PI * 2);
      b.orbitSpeed = Phaser.Math.FloatBetween(1.2, 2.4);
      b.pos = new Phaser.Math.Vector2(b.x, b.y);
      this.birds.push(b);
    }
    this.directions.show('Now sweep the sky — send the birds.');
    this.birdsFollow = true;
    this.birdTime = 0;
    await new Promise((resolve) => { this.birdsDone = resolve; });
    this.birdsFollow = false;
    this.directions.hide();

    await this.sealDay(V.gen_1_22, '— Day Five —');
    await veil(this, {
      maxAlpha: 0.5,
      onHold: () => this.sky.tweenTo(...SKY.golden, { duration: 900 }),
    });
  }

  // --- DAY 6 — ANIMALS & MANKIND. -----------------------------------------
  async day6() {
    await Promise.all([this.godSpeak(), this.verse.show(V.gen_1_24, { hold: 2600 })]);

    this.directions.show('Tap the hills — release the animals into the world.  (0/4)');
    const kinds = ['deer', 'sheep', 'rabbit', 'deer'];
    for (let i = 0; i < 4; i++) {
      const p = await this.waitForTap((pt) => pt.y > 260 && pt.y < 520);
      this.spawnAnimal(kinds[i], Phaser.Math.Clamp(p.x, 60, this.W - 60));
      this.directions.set(`Tap the hills — release the animals into the world.  (${i + 1}/4)`);
    }
    this.directions.hide();
    await this.wait(700);

    await Promise.all([this.godSpeak(), this.verse.show(V.gen_1_26, { hold: 2600 })]);

    // Adam formed from the dust — still, until God gives breath.
    const ax = this.W * 0.52;
    this.adamLying = this.add.image(ax, GROUND_Y + 2, 'adam-lying').setOrigin(0.5, 1).setAlpha(0);
    this.adamLying.setDepth(3.5);
    this.burst(ax, GROUND_Y - 6, 14, 0xd8c9a8);
    await this.tweenP({ targets: this.adamLying, alpha: 1, duration: 1400, ease: 'Sine.easeOut' });

    this.directions.show('Press and hold on the still form — breathe life into him.');
    const holdGlow = await this.waitForHold(ax, GROUND_Y - 8, 1400);
    this.directions.hide();

    // The breath of life (Gen 2:7) — shown as the verse itself.
    Audio.breath();
    Audio.godChord();
    const versePromise = this.verse.show(V.gen_2_7, { hold: 2400 });
    this.burst(ax, GROUND_Y - 20, 22, 0xfff3d6);
    this.adam = this.add.image(ax, GROUND_Y, 'adam-standing').setOrigin(0.5, 1).setAlpha(0).setDepth(3.5);
    this.tweens.add({ targets: this.adamLying, alpha: 0, duration: 900, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: this.adam, alpha: 1, duration: 1200, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: holdGlow, alpha: 0, scale: 3.2, duration: 1600, ease: 'Sine.easeOut' });
    await versePromise;

    await this.sealDay(V.gen_1_31, '— Day Six —');
    await veil(this, {
      maxAlpha: 0.6,
      onHold: () => {
        this.adamLying?.destroy();
        // Adam steps to the west edge, ready to walk through creation.
        this.adam.setPosition(this.W * 0.28, GROUND_Y);
        this.sky.tweenTo(...SKY.rest, { duration: 900 });
      },
    });
  }

  // --- DAY 7 — REST. A 2.5D parallax walk through everything God made. ----
  async day7() {
    Audio.ambience({ birds: 0.5, water: 0.3, wind: 0.35 });
    await this.verse.show(V.gen_2_2, { hold: 2800 });
    this.directions.show('Walk through God’s creation — hold →, D, or the right side of the screen.');

    this.walking = true;
    this.walkDist = 0;
    this.nextSpawn = 420;
    this.walkHintHidden = false;
    await new Promise((resolve) => { this.walkDone = resolve; });
    this.walking = false;
    this.directions.hide();

    await this.verse.show(V.gen_2_3, { hold: 3000 });
    Audio.swellSoft();
    Audio.ambience({ birds: 0.2, wind: 0.15, water: 0.15 });

    // A warm stillness settles over the finished world.
    const warm = this.add.rectangle(0, 0, this.W, this.H, 0xfff3d6).setOrigin(0).setAlpha(0).setDepth(850);
    this.tweens.add({ targets: warm, alpha: 0.55, duration: 2200, ease: 'Sine.easeInOut' });

    Audio.bell();
    await this.dialogue.show('Creation complete.', { hold: 2300 });
    completeStory('creation');
    await this.dialogue.show('A new story has been unlocked on the path.', { hold: 2000 });

    this.cameras.main.fadeOut(900, 10, 10, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('Home');
    });
  }

  // =========================================================================
  // World builders
  // =========================================================================
  plantTree(x) {
    this.ripple(x, GROUND_Y - 6);
    Audio.pluck(380 + Math.random() * 260);
    const key = this.groundProps.length % 2 === 0 ? 'tree-pine' : 'tree-round';
    const tree = this.add.image(x + Phaser.Math.Between(-8, 8), GROUND_Y + 2, key)
      .setOrigin(0.5, 1).setScale(0);
    this.groundProps.add(tree);
    this.tweens.add({
      targets: tree,
      scale: Phaser.Math.FloatBetween(0.8, 1.2),
      duration: 1000,
      ease: 'Back.easeOut',
      easeParams: [1.15], // gentle settle, not a bouncy pop
    });
  }

  plantGrass(x) {
    Audio.pluck(720 + Math.random() * 220);
    const tuft = this.add.image(x, GROUND_Y + 3, 'grass').setOrigin(0.5, 1).setScale(0);
    this.groundProps.add(tuft);
    this.tweens.add({ targets: tuft, scale: 1, duration: 550, ease: 'Back.easeOut', easeParams: [1.15] });
  }

  spawnAnimal(kind, x) {
    this.ripple(x, GROUND_Y - 10);
    Audio.thump();
    const a = this.add.image(x, GROUND_Y + 2, kind).setOrigin(0.5, 1).setScale(0);
    this.groundProps.add(a);
    this.tweens.add({
      targets: a,
      scale: 1,
      duration: 750,
      ease: 'Back.easeOut',
      easeParams: [1.15],
      onComplete: () => {
        if (!a.active) return;
        // Quiet idle breathing so the creatures feel alive.
        this.tweens.add({
          targets: a,
          scaleY: 1.035,
          duration: Phaser.Math.Between(1500, 2200),
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
    // Gentle wandering, flipping to face the way it moves.
    const wander = () => {
      if (!a.active) return;
      const dx = Phaser.Math.Between(-45, 45);
      a.setFlipX(dx > 0 ? false : true);
      this.tweens.add({
        targets: a,
        x: Phaser.Math.Clamp(a.x + dx, 40, this.W - 40),
        duration: Phaser.Math.Between(1800, 3200),
        ease: 'Sine.easeInOut',
        onComplete: () => this.time.delayedCall(Phaser.Math.Between(600, 1800), wander),
      });
    };
    this.time.delayedCall(Phaser.Math.Between(500, 1500), wander);
  }

  addStars(n) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(
        Phaser.Math.Between(30, this.W - 30),
        Phaser.Math.Between(28, 245),
        'dot',
      ).setScale(0).setTint(0xfff8e7).setBlendMode(Phaser.BlendModes.ADD).setDepth(-90);
      this.stars.push(s);
      this.tweens.add({
        targets: s,
        scale: Phaser.Math.FloatBetween(0.28, 0.55),
        duration: 550,
        delay: i * 70,
        ease: 'Back.easeOut',
        easeParams: [1.3],
        onComplete: () => {
          this.tweens.add({
            targets: s,
            alpha: 0.45,
            duration: Phaser.Math.Between(700, 1500),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        },
      });
    }
  }

  spawnPassing() {
    const kinds = ['tree-pine', 'tree-round', 'sheep', 'deer', 'grass', 'tree-pine'];
    const key = Phaser.Math.RND.pick(kinds);
    const s = this.add.image(this.W + 80, GROUND_Y + 2, key).setOrigin(0.5, 1).setDepth(3.45);
    if (key === 'deer' || key === 'sheep') s.setFlipX(true); // face the walker
    this.passing.push(s);
  }

  // =========================================================================
  // God's action + small effects
  // =========================================================================
  godSpeak() {
    // Every command begins with God: the light above swells as He speaks.
    Audio.godChord();
    return new Promise((resolve) => {
      this.tweens.add({
        targets: this.godLight,
        alpha: 0.62,
        scale: 1.12,
        duration: 850,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: resolve,
      });
    });
  }

  async sealDay(verseData, title) {
    // The narrator finishes the verse before the day is sealed.
    await this.verse.show(verseData, { hold: 1400 });
    Audio.bell();
    await this.dialogue.show(title, { hold: 1600 });
  }

  ripple(x, y) {
    const g = this.add.graphics({ x, y }).setDepth(8);
    g.lineStyle(2, 0xf5e6c4, 0.8);
    g.strokeCircle(0, 0, 10);
    this.tweens.add({
      targets: g,
      scale: 3,
      alpha: 0,
      duration: 650,
      ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  burst(x, y, count, tint) {
    const emitter = this.add.particles(x, y, 'dot', {
      speed: { min: 30, max: 110 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 900,
      blendMode: Phaser.BlendModes.ADD,
      tint,
      emitting: false,
    }).setDepth(8);
    emitter.explode(count);
    this.time.delayedCall(1200, () => emitter.destroy());
  }

  tweenSeaTint(to, duration) {
    const from = Phaser.Display.Color.IntegerToColor(this.seaTint);
    const target = Phaser.Display.Color.IntegerToColor(to);
    const state = { t: 0 };
    this.tweens.add({
      targets: state,
      t: 100,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, target, 100, state.t);
        this.seaTint = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        this.sea.setTint(this.seaTint);
      },
    });
  }

  // =========================================================================
  // Input gates (touch + mouse, see game-scene skill)
  // =========================================================================
  waitForTap(filter) {
    return new Promise((resolve) => {
      const handler = (p) => {
        if (filter && !filter(p)) return;
        this.input.off(Phaser.Input.Events.POINTER_UP, handler);
        resolve(p);
      };
      this.input.on(Phaser.Input.Events.POINTER_UP, handler);
    });
  }

  waitForSwipe(dir) {
    return new Promise((resolve) => {
      let startY = null;
      const down = (p) => { startY = p.y; };
      const move = (p) => {
        if (startY === null || !p.isDown) return;
        const dy = p.y - startY;
        if ((dir === 'up' && dy < -70) || (dir === 'down' && dy > 70)) {
          cleanup();
          resolve();
        }
      };
      const cleanup = () => {
        this.input.off(Phaser.Input.Events.POINTER_DOWN, down);
        this.input.off(Phaser.Input.Events.POINTER_MOVE, move);
      };
      this.input.on(Phaser.Input.Events.POINTER_DOWN, down);
      this.input.on(Phaser.Input.Events.POINTER_MOVE, move);
    });
  }

  waitForHold(x, y, ms) {
    return new Promise((resolve) => {
      const zone = this.add.zone(x, y, 150, 100).setOrigin(0.5).setInteractive();
      const glow = this.add.image(x, y - 4, 'glow')
        .setScale(0.3).setAlpha(0).setTint(0xffe9b0).setBlendMode(Phaser.BlendModes.ADD).setDepth(3.6);
      let timer = null;
      zone.on('pointerdown', () => {
        Audio.sparkle(2);
        this.tweens.add({ targets: glow, alpha: 0.85, scale: 1.6, duration: ms, ease: 'Sine.easeIn' });
        timer = this.time.delayedCall(ms, () => {
          zone.destroy();
          resolve(glow);
        });
      });
      const cancel = () => {
        if (!zone.active) return;
        if (timer) { timer.remove(); timer = null; }
        this.tweens.killTweensOf(glow);
        this.tweens.add({ targets: glow, alpha: 0, scale: 0.3, duration: 320, ease: 'Sine.easeIn' });
      };
      zone.on('pointerup', cancel);
      zone.on('pointerout', cancel);
    });
  }

  wait(ms) {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  tweenP(config) {
    return new Promise((resolve) => {
      this.tweens.add({ ...config, onComplete: (...args) => { config.onComplete?.(...args); resolve(); } });
    });
  }

  // =========================================================================
  // Per-frame life
  // =========================================================================
  update(time, delta) {
    const f = delta / 16.667;
    const p = this.input.activePointer;

    // Ambient drift.
    this.sea.tilePositionX += 0.05 * f;
    for (const c of this.clouds) {
      c.x += c.driftSpeed * f;
      if (c.x > this.W + 130) c.x = -130;
    }

    this.updateFish(delta, f, p, time);
    this.updateBirds(delta, f, p, time);
    this.updateWalk(delta, f, p, time);
  }

  updateFish(delta, f, p, time) {
    if (this.fish.length === 0) return;
    const inSea = p.y > SEA_TOP + 10 && p.y < this.H - 6;
    if (this.fishFollow && inSea) {
      this.fishTarget.set(p.x, p.y);
      this.fishTime += delta;
      this.blipAcc = (this.blipAcc || 0) + delta;
      if (this.blipAcc > 700) {
        this.blipAcc = 0;
        Audio.blip();
      }
      if (this.fishTime > 3500 && this.fishDone) {
        const r = this.fishDone;
        this.fishDone = null;
        r();
      }
    } else {
      // Ambient schooling along the sea.
      this.fishTarget.set(
        this.W / 2 + Math.sin(time * 0.00035) * this.W * 0.34,
        462 + Math.sin(time * 0.0006) * 26,
      );
    }
    for (const fish of this.fish) {
      const tx = this.fishTarget.x + fish.off.x;
      const ty = Phaser.Math.Clamp(this.fishTarget.y + fish.off.y, SEA_TOP + 16, this.H - 14);
      fish.vx += (tx - fish.x) * 0.0018 * f;
      fish.vy += (ty - fish.y) * 0.0018 * f;
      fish.vx = Phaser.Math.Clamp(fish.vx * 0.94, -3.4, 3.4);
      fish.vy = Phaser.Math.Clamp(fish.vy * 0.94, -2.4, 2.4);
      fish.x += fish.vx * f;
      fish.y += fish.vy * f;
      if (Math.abs(fish.vx) > 0.25) fish.setFlipX(fish.vx > 0); // texture faces left
    }
  }

  updateBirds(delta, f, p, time) {
    if (this.birds.length === 0) return;
    const inSky = p.y > 20 && p.y < 300;
    if (this.birdsFollow && inSky) {
      this.birdTarget.set(p.x, p.y);
      this.birdTime += delta;
      this.chirpAcc = (this.chirpAcc || 0) + delta;
      if (this.chirpAcc > 1100) {
        this.chirpAcc = 0;
        Audio.chirp(0.6);
      }
      if (this.birdTime > 3500 && this.birdsDone) {
        const r = this.birdsDone;
        this.birdsDone = null;
        r();
      }
    } else {
      this.birdTarget.set(
        this.W / 2 + Math.sin(time * 0.00028) * this.W * 0.3,
        150 + Math.sin(time * 0.0005) * 45,
      );
    }
    for (const b of this.birds) {
      b.orbitA += b.orbitSpeed * 0.016 * f;
      const tx = this.birdTarget.x + Math.cos(b.orbitA) * b.orbitR;
      const ty = Phaser.Math.Clamp(this.birdTarget.y + Math.sin(b.orbitA) * b.orbitR * 0.6, 30, 300);
      b.pos.x += (tx - b.pos.x) * 0.06 * f;
      b.pos.y += (ty - b.pos.y) * 0.06 * f;
      b.setPosition(b.pos.x, b.pos.y);
      b.setScale(b.scaleX, (0.7 + Math.abs(Math.sin(time * 0.012 + b.orbitR)) * 0.5) * Math.abs(b.scaleX));
    }
  }

  updateWalk(delta, f, p, time) {
    if (!this.walking || !this.adam) return;
    const keyRight = (this.cursors?.right?.isDown) || (this.keys?.D?.isDown);
    const touchRight = p.isDown && p.x > this.W * 0.55 && p.y > 120;
    if (keyRight || touchRight) {
      const v = 2.6 * f;
      this.ridgeFar.tilePositionX += 0.14 * v;
      this.ridgeMid.tilePositionX += 0.4 * v;
      this.ridgeGround.tilePositionX += v;
      this.sea.tilePositionX += 1.15 * v;
      this.groundProps.x -= v;
      this.walkDist += v;
      this.stepAcc = (this.stepAcc || 0) + v;
      if (this.stepAcc > 36) {
        this.stepAcc = 0;
        Audio.footstep();
      }

      // Fresh scenery keeps arriving as Adam walks east.
      if (this.walkDist > this.nextSpawn) {
        this.spawnPassing();
        this.nextSpawn = this.walkDist + Phaser.Math.Between(260, 520);
      }
      for (let i = this.passing.length - 1; i >= 0; i--) {
        const s = this.passing[i];
        s.x -= v;
        if (s.x < -110) {
          s.destroy();
          this.passing.splice(i, 1);
        }
      }

      // Walk bob.
      this.adam.y = GROUND_Y - Math.abs(Math.sin(time * 0.013)) * 5;
      this.adam.setRotation(Math.sin(time * 0.013) * 0.045);

      if (this.walkDist > 300 && !this.walkHintHidden) {
        this.walkHintHidden = true;
        this.directions.hide();
      }
      if (this.walkDist >= 2400 && this.walkDone) {
        const r = this.walkDone;
        this.walkDone = null;
        r();
      }
    } else {
      this.adam.y += (GROUND_Y - this.adam.y) * 0.2 * f;
      this.adam.setRotation(this.adam.rotation * 0.85);
    }
  }
}
