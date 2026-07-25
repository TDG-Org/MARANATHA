import { WEB } from '../../../data/versesWEB.js';
import { planGroupCamera } from './helpers.js';

export const TELLING_JOSEPH_MARK = Object.freeze({ x: 0.9, z: -4.1 });

export async function finishNarratedHold({
  verseResult,
  duration,
  getElapsed,
  setElapsed,
  wait,
}) {
  if (verseResult?.status === 'skipped') setElapsed(duration);
  while (getElapsed() < duration) await wait(120);
}

// SCENE 1 — Joseph, Genesis 37:1–11. The first telling now lives inside beat 5
// between the two dreams, preserving the canonical order without renumbering
// any external checkpoint. Beat 6 is only the second telling.
export function makeTellingBeats(ctx, h) {
  const {
    seq, wait, gate, J, shot, groupShot, FIRE, TELL_RING, ringXZ,
    reserveTellingAmbient, releaseTellingAmbient,
  } = h;
  const BROTHERS = ['judah', 'reuben', 'simeon', 'levi'];

  async function gatherCircle({
    withJacob = false,
    triggerId,
    objective,
    hint,
  }) {
    const jac = ctx.cast.jacob;
    let committed = false;
    ctx.setInput(true);
    ctx.hud.setObjective(objective, hint);
    ctx.guide.setTargetXZ(TELLING_JOSEPH_MARK.x, TELLING_JOSEPH_MARK.z);
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: triggerId,
        label: 'Sit and tell your dream',
        x: TELLING_JOSEPH_MARK.x,
        z: TELLING_JOSEPH_MARK.z,
        r: 2.7,
        lift: 0.7,
        when: () => !committed,
        onInteract: () => {
          if (committed) return;
          committed = true;
          resolve();
        },
      });
    }));
    // The player explicitly chose to sit and tell. Only now may cinema take
    // control; walking into a large invisible trigger no longer pulls Joseph.
    ctx.hud.clearObjective?.();
    ctx.guide.setTarget(null);
    ctx.setInput(false);
    ctx.grading.grade('goldenHour', 500);
    await seq([
      { t: 'letterbox', on: true },
      { t: 'fade', on: true, ms: 260 },
    ]);

    try {
      await reserveTellingAmbient();
      for (const [key, angle] of TELL_RING) {
        const n = ctx.cast[key];
        const p = ringXZ(angle);
        n.target = null;
        n.stuckT = 0;
        n.onArrive?.resolve?.(false);
        n.onArrive = null;
        n.pos.x = p.x;
        n.pos.z = p.z;
        if (n.circle) { n.circle.x = p.x; n.circle.z = p.z; }
        n.char.setPosition(p.x, p.z);
        ctx.npcs.freeze(n, true);
        n.char.turnToward(FIRE.x - p.x, FIRE.z - p.z);
        n.char.play('kneel');
      }
      ctx.joseph.setPosition(TELLING_JOSEPH_MARK.x, TELLING_JOSEPH_MARK.z);
      ctx.joseph.turnToward(
        FIRE.x - TELLING_JOSEPH_MARK.x,
        FIRE.z - TELLING_JOSEPH_MARK.z,
      );
      ctx.joseph.play('kneel');
    } finally {
      ctx.controller.cancelScriptMove();
      ctx.controller.vel.set(0, 0);
    }

    if (withJacob) {
      jac.char.setPosition(-2.6, -4.4); jac.pos.x = -2.6; jac.pos.z = -4.4;
      ctx.npcs.freeze(jac, true);
      jac.char.turnToward(FIRE.x - jac.pos.x, FIRE.z - jac.pos.z);
    }

    const lens = ctx.camera.camera;
    const actors = [
      {
        x: TELLING_JOSEPH_MARK.x,
        y: 0,
        z: TELLING_JOSEPH_MARK.z,
        headHeight: ctx.joseph.headHeight,
      },
      ...TELL_RING.map(([key, angle]) => {
        const p = ringXZ(angle);
        return {
          x: p.x, y: 0, z: p.z,
          headHeight: ctx.cast[key].char.headHeight,
        };
      }),
    ];
    const plan = planGroupCamera({
      actors,
      angle: Math.PI,
      distance: 5.7,
      height: 2.7,
      look: 1.2,
      fov: lens?.fov ?? 46,
      aspect: lens?.aspect ?? 16 / 9,
    });
    if (!plan.compositionSafe) {
      throw new Error('Telling circle has no audience-safe seated composition');
    }
    ctx.camera.cutTo({ ...plan, path: 'linear' });
    await seq([
      { t: 'fade', on: false, ms: 620 },
      { t: 'wait', ms: 700 },
    ]);
  }

  // Genesis 37:5–8 — Joseph tells the first dream to his brothers, and only
  // then do they answer him. Beat 5 calls this before dream 2 begins.
  async function firstTell() {
    await gatherCircle({
      withJacob: false,
      triggerId: 'reach-brothers-first-dream',
      objective: 'Tell your brothers your dream.',
      hint: 'Walk to the fire, then press the prompt to sit and tell.',
    });

    try {
      await seq([
      { t: 'fn', fn: () => {
        ctx.storyEvent?.('tell1');
        ctx.joseph.play('talk');
      } },
      { t: 'say', who: 'Joseph', text: 'Brothers — hear this dream I dreamed.', color: J.Joseph },
      { t: 'say', who: 'Joseph', text: 'We bound sheaves — bundles of wheat. Mine stood, and yours bowed to it.', color: J.Joseph },
      { t: 'dialogueHide' },
      // Hold one seated composition, then let it breathe through a small,
      // continuous arc while the verse is narrated.
      { t: 'fn', fn: async () => {
        ctx.joseph.play('talk');
        const live = ctx.camera.pose;
        const a0 = Math.atan2(
          FIRE.x - live.pos.x,
          FIRE.z - live.pos.z,
        );
        const radius = Math.hypot(live.pos.x - FIRE.x, live.pos.z - FIRE.z);
        const height = live.pos.y;
        const lookHeight = live.look.y;
        const T = 12500;
        let elapsed = 0;
        ctx.camera.setPoseDriver((pose, dt) => {
          elapsed = Math.min(T, elapsed + dt);
          const k = elapsed / T;
          const eased = k * k * (3 - 2 * k);
          const a = a0 + eased * 0.72;
          pose.pos.set(
            FIRE.x - Math.sin(a) * radius,
            height,
            FIRE.z - Math.cos(a) * radius,
          );
          pose.look.set(FIRE.x, lookHeight, FIRE.z);
        });
        const verseResult = await ctx.verseCard.show(WEB.gen_37_5);
        ctx.verseCard.hide();
        // "Skip narration" must release this narrated hold too. Previously
        // the voice stopped but the hidden 12.5 s orbit kept the story locked.
        await finishNarratedHold({
          verseResult,
          duration: T,
          getElapsed: () => elapsed,
          setElapsed: (value) => { elapsed = value; },
          wait,
        });
        ctx.camera.setPoseDriver(null);
        ctx.joseph.play('idle');
      } },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'tenseDay', ms: 1600 },
      { t: 'fn', fn: () => ctx.setMusic('music.ominous_turn') },
      shot('judah', 'joseph', {
        side: -0.42,
        dist: 2.6,
        height: 2.1,
        look: 1.15,
        arcRadius: 9,
      }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'Our little brother — a ruler over us?', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_8 },
      { t: 'verseHide' },
      { t: 'wait', ms: 900 },
      ]);
    } finally {
      // Dream 2 follows this first telling, so release the background camp
      // actors once no conversation camera owns the corridor.
      releaseTellingAmbient();
    }
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
      hint: 'Walk to the fire, then press the prompt to sit and tell.',
    });

    await seq([
      groupShot(['joseph', ...BROTHERS], {
        angle: Math.PI,
        distance: 5.7,
        height: 2.7,
        look: 1.2,
        ms: 1600,
      }),
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
      groupShot(['joseph', ...BROTHERS], {
        angle: Math.PI,
        distance: 6.5,
        height: 3.05,
        look: 1.2,
        ms: 1400,
        arcRadius: 6.5,
      }),
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
      { t: 'say', who: 'Jacob', text: 'Enough, Joseph. What is this dream you have dreamed?', color: J.Jacob },
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
      groupShot(['joseph', ...BROTHERS, 'jacob'], {
        // South three-quarter wide: responsive distance keeps the whole
        // family readable even on a 390x844 portrait screen.
        angle: 0.35,
        distance: 4.5,
        height: 2.2,
        look: 1.3,
        ms: 2200,
      }),
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
      // Jacob's quiet reaction looks back INTO the lived-in camp. The former
      // low reverse exposed the empty south boundary behind him; this elevated
      // south-side two-person frame looks down toward the fire and spectators.
      groupShot(['jacob', 'joseph'], {
        // Measured, not guessed: this angle puts the most camp behind them
        // (215 weighted props/actors in frame vs 175 at the old -0.28).
        angle: 0.52,
        distance: 5.2,
        height: 3.6,
        look: 1.05,
        ms: 1800,
        arcRadius: 6.4,
      }),
      { t: 'wait', ms: 1200 },
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
