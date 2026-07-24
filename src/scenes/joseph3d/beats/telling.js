import { WEB } from '../../../data/versesWEB.js';

// SCENE 1 — Joseph, Genesis 37:1–11. The first telling now lives inside beat 5
// between the two dreams, preserving the canonical order without renumbering
// any external checkpoint. Beat 6 is only the second telling.
export function makeTellingBeats(ctx, h) {
  const { seq, wait, gate, J, shot, FIRE, TELL_RING, ringXZ } = h;
  const BROTHERS = ['judah', 'reuben', 'simeon', 'levi'];

  async function gatherCircle({
    withJacob = false,
    triggerId,
    objective,
    hint,
  }) {
    const jac = ctx.cast.jacob;
    ctx.setInput(true);
    ctx.hud.setObjective(objective, hint);
    ctx.guide.setTargetXZ(0.8, -6.6);
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addTrigger({
        id: triggerId, x: 0.8, z: -6.4, r: 3.2, once: true, onEnter: resolve,
      });
    }));
    // Reaching the circle completes the gameplay goal. End its logical
    // ownership before any letterbox/sequence can later restore stale text.
    ctx.hud.clearObjective?.();
    ctx.guide.setTarget(null);
    ctx.setInput(false);
    ctx.grading.grade('goldenHour', 500);

    await seq([
      { t: 'letterbox', on: true },
      {
        t: 'cam',
        angle: Math.PI * 0.62,
        target: { x: 0.4, z: -6.2 },
        distance: 6.6,
        height: 3.1,
        lookHeight: 1.3,
        duration: 1500,
        awaitMs: false,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.6,
      },
    ]);
    // Joseph enters his speaking mark through the same controller-owned,
    // per-frame walk as gameplay while the brothers gather. The former
    // setPosition below was a visible ~2.3u teleport after everyone sat down.
    try {
      await Promise.all([
        ctx.controller.scriptMoveTo(0.9, -4.1, 1.45),
        ...TELL_RING.map(([k, a]) => {
          const n = ctx.cast[k];
          const p = ringXZ(a);
          return ctx.npcs.sendTo(n, p.x, p.z, { speed: 1.7 }).then(() => {
            n.char.setPosition(p.x, p.z); n.pos.x = p.x; n.pos.z = p.z;
            ctx.npcs.freeze(n, true);
            n.char.turnToward(FIRE.x - p.x, FIRE.z - p.z);
            n.char.play('kneel');
          });
        }),
      ]);
    } finally {
      ctx.controller.cancelScriptMove();
      ctx.controller.vel.set(0, 0);
    }

    if (withJacob) {
      await ctx.npcs.sendTo(jac, -2.6, -4.4, { speed: 1.4 });
      jac.char.setPosition(-2.6, -4.4); jac.pos.x = -2.6; jac.pos.z = -4.4;
      ctx.npcs.freeze(jac, true);
      jac.char.turnToward(FIRE.x - jac.pos.x, FIRE.z - jac.pos.z);
    }
    ctx.joseph.turnToward(
      FIRE.x - ctx.joseph.position.x,
      FIRE.z - ctx.joseph.position.z,
    );
  }

  // Genesis 37:5–8 — Joseph tells the first dream to his brothers, and only
  // then do they answer him. Beat 5 calls this before dream 2 begins.
  async function firstTell() {
    await gatherCircle({
      withJacob: false,
      triggerId: 'reach-brothers-first-dream',
      objective: 'Tell your brothers your dream.',
      hint: 'Walk to your brothers by the fire.',
    });

    await seq([
      {
        t: 'cam',
        angle: Math.PI * 0.55,
        target: { x: 0.3, z: -5.7 },
        distance: 5.7,
        height: 2.7,
        lookHeight: 1.2,
        duration: 1600,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.4,
      },
      { t: 'fn', fn: () => {
        ctx.storyEvent?.('tell1');
        ctx.joseph.play('talk');
      } },
      shot('joseph', 'judah', { side: 0.4, height: 2.15, look: 1.15 }),
      { t: 'say', who: 'Joseph', text: 'Brothers — hear this dream I dreamed.', color: J.Joseph },
      { t: 'say', who: 'Joseph', text: 'We bound sheaves — bundles of wheat. Mine stood, and yours bowed to it.', color: J.Joseph },
      { t: 'dialogueHide' },
      // Keep the signed-off smooth orbit, now around the people Scripture says
      // heard the first dream: the brothers, without Jacob presiding.
      { t: 'fn', fn: async () => {
        ctx.joseph.play('talk');
        const a0 = Math.PI * 0.55, RAD = 6.1, H = 2.7, T = 12500;
        ctx.camera.cinematicMoveTo({
          angle: a0,
          target: { x: FIRE.x, z: FIRE.z },
          distance: RAD,
          height: H,
          lookHeight: 1.15,
          duration: 1200,
          path: 'groupArc',
          arcCenter: FIRE,
          arcRadius: 6.4,
        });
        await wait(1200);
        let elapsed = 0;
        ctx.camera.setPoseDriver((pose, dt) => {
          elapsed = Math.min(T, elapsed + dt);
          const k = elapsed / T;
          const a = a0 + (k * k * (3 - 2 * k)) * 3.4;
          pose.pos.set(FIRE.x - Math.sin(a) * RAD, H + 0.35, FIRE.z - Math.cos(a) * RAD);
          pose.look.set(FIRE.x, 1.15, FIRE.z);
        });
        await ctx.verseCard.show(WEB.gen_37_5);
        ctx.verseCard.hide();
        while (elapsed < T) await wait(120);
        ctx.camera.setPoseDriver(null);
        ctx.joseph.play('idle');
      } },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'tenseDay', ms: 1600 },
      { t: 'fn', fn: () => ctx.setMusic('music.ominous_turn') },
      shot('judah', 'joseph', { side: -0.42, dist: 2.6, height: 2.1, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'Our little brother — a ruler over us?', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_8 },
      { t: 'verseHide' },
      { t: 'wait', ms: 900 },
    ]);
  }

  // Genesis 37:9–10 is two explicit tellings: Joseph first tells his brothers
  // (v9), then tells his father and brothers (v10). Keep both visible rather
  // than collapsing the text into one convenient family conversation.
  async function tell() {
    const jac = ctx.cast.jacob;
    await gatherCircle({
      withJacob: false,
      triggerId: 'reach-brothers-second-dream',
      objective: 'Tell your brothers the second dream.',
      hint: 'Walk to your brothers by the fire.',
    });

    await seq([
      {
        t: 'cam',
        angle: Math.PI * 0.55,
        target: { x: 0.3, z: -5.7 },
        distance: 5.7,
        height: 2.7,
        lookHeight: 1.2,
        duration: 1600,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.4,
      },
      { t: 'fn', fn: () => {
        ctx.storyEvent?.('tell2_brothers');
        ctx.joseph.play('talk');
      } },
      // The wider shoulder keeps Judah clear of the lens in the full circle;
      // checking only Joseph/Reuben left Judah's head on this endpoint.
      shot('joseph', 'reuben', { side: 0.9, dist: 4.4, height: 2.15, look: 1.15 }),
      { t: 'say', who: 'Joseph', text: 'I dreamed again: the sun, moon, and eleven stars bowed to me.', color: J.Joseph },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_9 },
      { t: 'wait', ms: 1100 },
      { t: 'verseHide' },
      {
        t: 'cam',
        angle: Math.PI * 0.66,
        target: { x: 0.1, z: -5.8 },
        distance: 6.5,
        height: 3.05,
        lookHeight: 1.2,
        duration: 1400,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.5,
      },
      { t: 'fn', fn: async () => {
        ctx.npcs.freeze(jac, false);
        await ctx.npcs.sendTo(jac, -2.6, -4.4, { speed: 1.4 });
        jac.char.setPosition(-2.6, -4.4);
        jac.pos.x = -2.6;
        jac.pos.z = -4.4;
        ctx.npcs.freeze(jac, true);
        jac.char.turnToward(FIRE.x - jac.pos.x, FIRE.z - jac.pos.z);
        ctx.storyEvent?.('tell2_family');
      } },
      shot('joseph', 'jacob', { side: 0.7, dist: 3.8, height: 2.15, look: 1.15 }),
      { t: 'say', who: 'Joseph', text: 'Father, I also saw the sun, moon, and eleven stars bow to me.', color: J.Joseph },
      { t: 'dialogueHide' },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'tenseDay', ms: 1600 },
      { t: 'fn', fn: () => { ctx.setMusic('music.ominous_turn'); } },
      { t: 'fn', fn: () => {
        ctx.joseph.play('idle');
        jac.char.play('talk');
        ctx.storyEvent?.('rebuke');
      } },
      shot('jacob', 'joseph', { side: -0.7, dist: 3.8, height: 2.1, look: 1.15 }),
      { t: 'say', who: 'Jacob', text: 'Joseph — what is this dream?', color: J.Jacob },
      { t: 'dialogueHide' },
      { t: 'fn', fn: () => {
        jac.char.play('idle');
        jac.char.turnToward(
          ctx.joseph.position.x - jac.pos.x,
          ctx.joseph.position.z - jac.pos.z,
        );
      } },
      { t: 'verse', verse: WEB.gen_37_10 },
      { t: 'wait', ms: 1400 },
      { t: 'verseHide' },
    ]);
  }

  // Genesis 37:11 — envy lands first, then the same verse remains while Jacob
  // silently watches Joseph and keeps the matter in mind.
  async function close() {
    const jac = ctx.cast.jacob;
    await seq([
      { t: 'letterbox', on: true },
      {
        t: 'cam',
        // South three-quarter wide: the old west-side endpoint sat only
        // ~1.27u behind Judah's head before the envy verse.
        angle: 0.35,
        target: { x: 0.2, z: -6.6 },
        distance: 4.5,
        height: 2.2,
        lookHeight: 1.3,
        duration: 2200,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.4,
      },
      { t: 'grade', mood: 'tenseDay', ms: 2000 },
      { t: 'fn', fn: () => { ctx.storyEvent?.('envy'); } },
      { t: 'verse', verse: WEB.gen_37_11 },
      { t: 'wait', ms: 1300 },
      { t: 'fn', fn: () => {
        jac.char.turnToward(
          ctx.joseph.position.x - jac.pos.x,
          ctx.joseph.position.z - jac.pos.z,
        );
      } },
      shot('jacob', 'joseph', { side: -0.7, dist: 3.8, height: 2.1, look: 1.2 }),
      { t: 'wait', ms: 1400 },
      { t: 'verseHide' },
    ]);

    const lone = { x: -4.6, z: -2.0 };
    ctx.joseph.turnToward(lone.x - ctx.joseph.position.x, lone.z - ctx.joseph.position.z);
    await seq([
      {
        t: 'cam',
        angle: Math.PI * 0.9,
        target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }),
        distance: 6.4,
        height: 3.1,
        lookHeight: 1.2,
        duration: 3200,
        awaitMs: false,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.4,
      },
      { t: 'fn', fn: async () => {
        const angle = Math.PI * 0.9;
        const distance = 6.4;
        ctx.camera.setPoseDriver((pose) => {
          const p = ctx.joseph.position;
          pose.pos.set(
            p.x - Math.sin(angle) * distance,
            3.1,
            p.z - Math.cos(angle) * distance,
          );
          pose.look.set(p.x, 1.2, p.z);
        });
        ctx.joseph.setGrief(true, 0.42);
        ctx.hud.emote('Joseph is sad');
        try {
          await ctx.controller.scriptMoveTo(lone.x, lone.z, 1.15);
          ctx.joseph.play('idle');
        } finally {
          ctx.camera.setPoseDriver(null);
        }
      } },
    ]);
    await seq([
      {
        t: 'cam',
        angle: Math.PI * 0.95,
        target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }),
        distance: 4.4,
        height: 2.1,
        lookHeight: 1.3,
        duration: 2000,
        path: 'arc',
      },
      { t: 'wait', ms: 900 },
      { t: 'grade', mood: 'goldenHour', ms: 2200 },
      { t: 'fade', on: true, ms: 1800 },
      { t: 'fn', fn: () => ctx.joseph.setGrief(false) },
      { t: 'title', heading: 'To be continued', sub: 'Genesis 37:12–17 — the road to Dothan', holdMs: 4200 },
    ]);
    ctx.finish?.();
  }

  return { firstTell, tell, close };
}
