import { WEB } from '../../data/versesWEB.js';
import { NAME_COLOR } from './cast.js';

// SCENE 1 — the story as DATA + gates (script-writing + storyteller +
// bible-knowledge). Eight beats; the player acts every 15–20s; displayed
// verses are word-perfect WEB; dialogue is human paraphrase that never leaves
// what the text says or implies. Every beat ENTERS by setting its own
// presentation state, so checkpoints can start any beat fresh.
const J = NAME_COLOR;

export function createBeats(ctx) {
  const seq = (steps) => ctx.sequencer.run(steps);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- beat 0 · 🌅 intro cinematic ----------
  async function intro() {
    ctx.setInput(false);
    ctx.grading.set('goldenHour');
    ctx.joseph.setCoat(false);
    ctx.joseph.setPosition(0, 15);
    // opening glide: high over the camp, drifting down toward Joseph
    ctx.camera.cinematicMoveTo({ angle: Math.PI * 0.9, target: { x: 0, z: -2 }, distance: 17, height: 9, lookHeight: 0.5, duration: 10 });
    await seq([
      { t: 'letterbox', on: true },
      { t: 'cam', angle: Math.PI * 1.12, target: { x: 0, z: 0 }, distance: 12, height: 5.5, lookHeight: 1.2, duration: 7000, awaitMs: false },
      { t: 'title', heading: 'Hebron, Canaan', sub: 'c. 1898 BC · Genesis 37', holdMs: 4200 },
      { t: 'verse', verse: WEB.gen_37_1 },
      { t: 'verse', verse: WEB.gen_37_2_short },
      { t: 'verseHide' },
      { t: 'camRelease', ms: 1600 },
      { t: 'letterbox', on: false },
    ]);
    ctx.setInput(true);
  }

  // ---------- beat 1 · 🐑 herd the strays ----------
  async function herd() {
    ctx.setInput(true);
    ctx.grading.grade('goldenHour', 800);
    ctx.hud.setObjective('Bring 3 stray sheep back to the pen.', 'Walk up behind a sheep — it runs ahead of you.');
    const gate = pointToGate(ctx.camp.pen);
    ctx.guide.setTargetXZ(gate.x, gate.z);

    // brothers sneer as you pass the fire (once)
    ctx.interactables.addTrigger({
      id: 'sneer', x: 0.8, z: -6.5, r: 3.4, once: true,
      onEnter: async () => {
        ctx.setInput(false);
        await ctx.dialogue.say('Simeon', 'Look — father’s favorite, out among the sheep.', { color: J.Simeon });
        await ctx.dialogue.say('Levi', 'Mind the flock, little brother. It’s all you’re good for.', { color: J.Levi });
        ctx.dialogue.hide();
        ctx.setInput(true);
      },
    });

    let done;
    const all = new Promise((r) => { done = r; });
    ctx.onStrayPenned = (n) => {
      ctx.hud.flashCount('🐑', n, 3);
      ctx.hud.setObjective(n >= 3 ? 'All three — well done!' : `Bring the stray sheep to the pen — ${n} of 3.`, n >= 3 ? '' : 'Walk up behind a sheep — it runs ahead of you.');
      if (n < 3) {
        const s = ctx.sheep.nearestStray(ctx.joseph.position.x, ctx.joseph.position.z);
        if (s) ctx.guide.setTargetXZ(s.x, s.z);
      } else done();
    };
    // point at the first stray
    const first = ctx.sheep.nearestStray(ctx.joseph.position.x, ctx.joseph.position.z);
    if (first) ctx.guide.setTargetXZ(first.x, first.z);
    if (ctx.sheep.straysLeft === 0) done(); // checkpoint-resume safety
    await all;
    ctx.onStrayPenned = null;
    ctx.guide.setTarget(null);
    ctx.sound('ui.chime');
    await wait(900);
  }

  // ---------- beat 2 · 🧔 report to Jacob ----------
  async function report() {
    ctx.setInput(true);
    ctx.grading.grade('goldenHour', 600);
    ctx.hud.setObjective('Go to your father, Jacob.');
    const jac = ctx.cast.jacob;
    ctx.guide.setTargetXZ(jac.pos.x, jac.pos.z);

    let spoken = false;
    await new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: 'jacob-report', label: 'Talk to Jacob',
        getPos: () => jac.pos, r: 3.0, lift: 2.0,
        object: () => jac.char.root,
        when: () => !spoken,
        onInteract: async () => {
          spoken = true;
          ctx.setInput(false);
          ctx.guide.setTarget(null);
          ctx.npcs.freeze(jac, true);
          jac.char.turnToward(ctx.joseph.position.x - jac.pos.x, ctx.joseph.position.z - jac.pos.z);
          jac.char.play('talk');
          await ctx.dialogue.say('Jacob', 'Joseph, my son. How are the sheep?', { color: J.Jacob });
          await ctx.dialogue.say('Joseph', 'They are strong, father. The strays are back in the pen.', { color: J.Joseph });
          await ctx.dialogue.say('Joseph', 'But my brothers… what they do out there — it is not right.', { color: J.Joseph });
          await ctx.dialogue.say('Jacob', 'I hear you. You have done well to tell me. Stay close a moment.', { color: J.Jacob });
          ctx.dialogue.hide();
          jac.char.play('idle');
          resolve();
        },
      });
    });
  }

  // ---------- beat 3 · 🧥 THE COAT ----------
  async function coat() {
    const jac = ctx.cast.jacob;
    ctx.setInput(false);
    ctx.npcs.freeze(jac, true);
    ctx.grading.grade('goldenHour', 600);
    const jx = jac.pos.x, jz = jac.pos.z;
    await seq([
      { t: 'letterbox', on: true },
      // two-shot at the tent
      { t: 'cam', angle: -Math.PI * 0.35, target: { x: jx + 0.8, z: jz + 0.8 }, distance: 3.6, height: 1.5, lookHeight: 1.35, duration: 1600 },
      { t: 'fn', fn: () => { jac.char.play('talk'); } },
      { t: 'say', who: 'Jacob', text: 'Joseph. Come, stand in the light.', color: J.Jacob },
      { t: 'say', who: 'Jacob', text: 'You came to me in my old age, my son — a gift I did not look for.', color: J.Jacob },
      { t: 'say', who: 'Jacob', text: 'I had this made for you. Let all of Hebron see it.', color: J.Jacob },
      { t: 'dialogueHide' },
      // the gift — slow push-in on Joseph as the coat settles
      { t: 'cam', angle: Math.PI * 0.08, target: ctx.joseph.position, distance: 2.6, height: 1.35, lookHeight: 1.25, duration: 1500 },
      { t: 'fn', fn: async () => {
        ctx.joseph.setCoat(true);
        ctx.sound('sfx.cloth_equip');
        ctx.sound('stinger.coat_gift');
        ctx.sparkle(4);
        jac.char.play('idle');
        await wait(1400);
      } },
      { t: 'verse', verse: WEB.gen_37_3 },
      { t: 'verseHide' },
      // across the camp, the brothers watch
      { t: 'cam', angle: Math.PI * 0.55, target: { x: 0.8, z: -7.6 }, distance: 5.4, height: 1.8, lookHeight: 1.3, duration: 1800 },
      { t: 'grade', mood: 'ominous', ms: 1800 },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'say', who: 'Judah', text: 'A prince’s tunic… while we wear the dust of his father’s fields.', color: J.Judah },
      { t: 'say', who: 'Reuben', text: 'Not one kind word is left in me for that boy.', color: J.Reuben },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_4 },
      { t: 'verseHide' },
      { t: 'grade', mood: 'goldenHour', ms: 1600 },
      { t: 'camRelease', ms: 1500 },
      { t: 'letterbox', on: false },
      { t: 'fn', fn: () => ctx.npcs.freeze(jac, false) },
    ]);
    ctx.setInput(true);
  }

  // ---------- beat 4 · 🌙 dusk falls ----------
  async function dusk() {
    ctx.setInput(true);
    ctx.hud.setObjective('Walk to the fire and rest.');
    ctx.guide.setTargetXZ(1.4, -5.0);
    ctx.setMusic('music.dusk_calm');
    ctx.grading.grade('dusk', 3200);
    ctx.onDusk?.(); // fireflies fade in (wired by the scene)
    await new Promise((resolve) => {
      ctx.interactables.addTrigger({ id: 'rest', x: 1.4, z: -5.0, r: 1.7, once: true, onEnter: resolve });
    });
    ctx.guide.setTarget(null);
  }

  // ---------- beat 5 · 💤 THE DREAM ----------
  async function dream() {
    const D = ctx.dream;
    ctx.setInput(false);
    await seq([
      { t: 'letterbox', on: true },
      { t: 'grade', mood: 'night', ms: 2200 },
      { t: 'fn', fn: async () => { ctx.setMusic('music.dream_wonder'); ctx.sound('stinger.dream_enter'); await wait(600); } },
    ]);
    // slip into the dream field
    D.group.visible = true;
    D.resetSky();
    ctx.joseph.setPosition(D.FIELD.x, D.FIELD.z + 9);
    ctx.controller.bounds = { minX: D.FIELD.x - 13, maxX: D.FIELD.x + 13, minZ: D.FIELD.z - 13, maxZ: D.FIELD.z + 13 };
    ctx.camera.snap();
    await seq([
      { t: 'grade', mood: 'dream', ms: 1800 },
      { t: 'verse', verse: WEB.gen_37_5 },
      { t: 'verseHide' },
      { t: 'letterbox', on: false },
      { t: 'objective', text: 'Walk to each bundle of wheat.' },
    ]);
    ctx.setInput(true);

    // each sheaf bows as Joseph draws near
    let bowed = 0;
    const allBowed = new Promise((resolve) => {
      D.outer.forEach((s, i) => {
        ctx.interactables.addTrigger({
          id: `sheaf${i}`, x: s.position.x, z: s.position.z, r: 2.1, once: true,
          onEnter: () => {
            s.userData.bowed = true;
            ctx.sound('sfx.sheaf_bow');
            bowed += 1;
            ctx.hud.flashCount('🌾', bowed, D.outer.length);
            ctx.hud.setObjective(`The wheat bundles bow — ${bowed} of ${D.outer.length}.`);
            if (bowed >= D.outer.length) resolve();
          },
        });
      });
    });
    ctx.guide.setTargetXZ(D.outer[0].position.x, D.outer[0].position.z);
    await allBowed;
    ctx.guide.setTarget(null);

    // the field answers, then the sky
    ctx.setInput(false);
    await seq([
      { t: 'objective', text: '' },
      { t: 'cam', angle: Math.PI * 0.02, target: { x: D.FIELD.x, z: D.FIELD.z }, distance: 7.5, height: 2.2, lookHeight: 1.6, duration: 1800 },
      { t: 'verse', verse: WEB.gen_37_7 },
      { t: 'verseHide' },
      // look up: the sun, the moon, eleven stars
      { t: 'fn', fn: async () => { D.showSky(1); await wait(800); } },
      { t: 'cam', angle: Math.PI * 0.02, target: { x: D.FIELD.x, z: D.FIELD.z - 6 }, distance: 9, height: 1.2, lookHeight: 7.5, duration: 2200 },
      { t: 'fn', fn: async () => { D.bowSky(); ctx.sound('sfx.sheaf_bow'); await wait(2600); } },
      { t: 'verse', verse: WEB.gen_37_9 },
      { t: 'verseHide' },
      { t: 'letterbox', on: true },
      { t: 'grade', mood: 'night', ms: 1800 },
    ]);
    // wake back at camp
    D.group.visible = false;
    ctx.joseph.setPosition(0.6, -3.8);
    ctx.controller.bounds = ctx.bounds;
    ctx.camera.snap();
    ctx.onDawn?.(); // fireflies fade out (wired by the scene)
    await seq([
      { t: 'grade', mood: 'goldenHour', ms: 2400 },
      { t: 'fn', fn: () => ctx.setMusic('music.camp_warm') },
      { t: 'letterbox', on: false },
    ]);
  }

  // ---------- beat 6 · 😠 tell the brothers ----------
  async function tell() {
    ctx.setInput(false);
    ctx.grading.grade('goldenHour', 400);
    const jac = ctx.cast.jacob;
    await seq([
      { t: 'letterbox', on: true },
      { t: 'cam', angle: Math.PI * 0.6, target: { x: 0.8, z: -7.4 }, distance: 4.6, height: 1.7, lookHeight: 1.35, duration: 1500 },
      { t: 'say', who: 'Joseph', text: 'Brothers — hear this dream I dreamed.', color: J.Joseph },
      // "sheaves" explained once, naturally, inside the line (ui-clarity law 2)
      { t: 'say', who: 'Joseph', text: 'We were binding sheaves — bundles of wheat — in the field. Mine arose… and yours bowed down to it.', color: J.Joseph },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'ominous', ms: 1600 },
      { t: 'say', who: 'Judah', text: 'Will you indeed reign over us, dreamer of dreams?', color: J.Judah },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_8 },
      { t: 'verseHide' },
      { t: 'say', who: 'Joseph', text: 'And again — the sun, the moon, eleven stars… all of them bowed to me.', color: J.Joseph },
      { t: 'fn', fn: () => { jac.char.play('talk'); } },
      { t: 'say', who: 'Jacob', text: 'Joseph! Shall I, your mother, and your brothers bow to the earth before you?', color: J.Jacob },
      { t: 'dialogueHide' },
      { t: 'fn', fn: () => { jac.char.play('idle'); } },
      { t: 'verse', verse: WEB.gen_37_10_short },
      { t: 'verseHide' },
      { t: 'wait', ms: 700 },
    ]);
  }

  // ---------- beat 7 · 🎬 close ----------
  async function close() {
    await seq([
      { t: 'verse', verse: WEB.gen_37_11 },
      { t: 'wait', ms: 600 },
      { t: 'verseHide' },
      { t: 'grade', mood: 'dusk', ms: 2600 },
      { t: 'title', heading: 'To be continued', sub: 'Genesis 37:12 — the road to Dothan', holdMs: 4000 },
    ]);
    ctx.finish?.();
  }

  // ---------- checkpoint resume: enter beat N fresh ----------
  function applyState(n, c) {
    // world/story state that earlier beats would have produced
    if (n >= 2) c.sheep.sheep.forEach((s) => { if (!s.counted) { s.counted = true; s.penned = true; s.x = c.camp.pen.minX + 2 + Math.random() * 3; s.z = c.camp.pen.minZ + 1.5 + Math.random() * 3; } });
    if (n >= 4) c.joseph.setCoat(true);
    const spawns = { 1: [2, 12.5], 2: [1, 1.5], 3: [-8.2, -4.6], 4: [-7.5, -4], 5: [1.4, -4.6], 6: [0.6, -3.8], 7: [0.6, -3.8] };
    const s = spawns[n] || [0, 12];
    c.joseph.setPosition(s[0], s[1]);
    c.camera.snap();
    c.grading.set(n === 5 ? 'dusk' : 'goldenHour');
    if (n >= 5) c.onDusk?.();
  }

  return { list: [intro, herd, report, coat, dusk, dream, tell, close], applyState };
}

function pointToGate(pen) {
  return { x: pen.minX + 0.6, z: (pen.gate.z0 + pen.gate.z1) / 2 };
}
