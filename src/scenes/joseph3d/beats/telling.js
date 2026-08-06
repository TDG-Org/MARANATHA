import { WEB } from '../../../data/versesWEB.js';
import { planGroupCamera } from './helpers.js';

// Joseph stands on the camera's side of the fire, three-quarter back to us,
// so the shot reads as "we are watching them hear this" (mirrored with the
// ring — see TELL_RING in helpers.js).
// The circle shot's angle, EXPORTED so tools/test-camera-backdrop judges the
// real number instead of a copy of it. Chosen by sweeping every angle against
// the camp census and the mood's sun vector: backdrop 266 (floor 165) and
// dot(look, sun) -0.81, against 83 and +0.62 at the pi it used to be.
export const TELLING_CIRCLE_ANGLE = Math.PI * 0.12;
// Jacob presides from the camera's side, opposite the seated brothers, clear of
// every seat on the ring.
export const JACOB_TELL_MARK = Object.freeze({ x: 2.6, z: -7.6 });
export const TELLING_JOSEPH_MARK = Object.freeze({ x: -0.9, z: -7.9 });
// Where Joseph ends the chapter, standing apart from the family.
export const TELLING_LONE_MARK = Object.freeze({ x: -4.6, z: -2.0 });

// THE LAST TWO SHOTS OF THE STORY.
//
// They used to sit at 0.90pi and 0.95pi, which point out at open ground and the
// ridge line. Measured against the camp census that is a backdrop of 120 and 97
// — the second-emptiest angle available anywhere in the sweep — at the exact
// moment the chapter lands. Nate reported it in capitals: "YOU ARE STILL
// SHOWING THE BACK OF THE CAMP WHERE IT'S EMPTY AND ON MOUNTAINS WITH THAT
// CAMERA ANGLE AT THE END OF THIS STORY".
//
// 0.42pi was chosen by sweeping every angle and taking the WORST frame of the
// tracked walk (225 here, against 120), so it cannot merely be good at the two
// ends. It also keeps the same side of the axis as the 0.52 reaction shot
// before it, so the reframe is a 45-degree drift rather than a reverse.
// They live here as data because the pose driver that tracks the walk has to
// use the same numbers, and it used to carry its own copy of them.
export const TELLING_WALKOFF_CAMERA = Object.freeze({
  angle: Math.PI * 0.42, distance: 6.4, height: 3.1, lookHeight: 1.2,
});
export const TELLING_FINAL_CAMERA = Object.freeze({
  angle: Math.PI * 0.42, distance: 4.4, height: 2.1, lookHeight: 1.3,
});

export async function finishNarratedHold({
  verseResult,
  duration,
  getElapsed,
  setElapsed,
  settled,
}) {
  if (verseResult?.status === 'skipped') {
    setElapsed(duration);
    return;
  }
  if (getElapsed() >= duration) return;
  // ONE promise, resolved by the pose driver's own per-frame advance — never
  // a 120ms polling wait (each slice armed a timer + three listeners and tore
  // them down again; a hold is one sleep, not a poll — the D24 law). Pause is
  // free: the driver only advances on unpaused frames. The caller wires scene
  // abort to the same resolve so the hold can never outlive its scene.
  if (settled) await settled;
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
      // MIRRORED WITH THE RING. Jacob was the one actor in the telling left on
      // the pre-mirror side of the fire: after the seats moved to the south arc
      // he stood 0.85u from Levi — inside his robe — in the frame that carries
      // Genesis 37:10 and 37:11, the father's rebuke and the brothers' envy.
      jac.char.setPosition(JACOB_TELL_MARK.x, JACOB_TELL_MARK.z);
      jac.pos.x = JACOB_TELL_MARK.x; jac.pos.z = JACOB_TELL_MARK.z;
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
      // 0.12pi, chosen by SWEEPING every angle against the camp census and the
      // mood's sun vector, not by taste: backdrop 266 (the peak; floor is 165)
      // and dot(look, sun) -0.81, so the faces are lit and the whole camp —
      // including the nine staged spectators, which the old shot had its back
      // to — falls behind them.
      angle: TELLING_CIRCLE_ANGLE,
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
        // 7.6s, not 12.5s. Genesis 37:5 is 6.1 seconds of narration and this
        // orbit gated the beat until it finished, so 6,356ms of it played in
        // measured silence between Joseph's dream and Judah's answer — the
        // single longest dead patch in the chapter, sitting in its best scene.
        // The arc is unchanged, so it simply moves at a readable 0.095 rad/s
        // instead of a barely-perceptible 0.058.
        const T = 7600;
        let elapsed = 0;
        // The driver settles the hold itself — one promise, zero poll timers.
        let holdDone;
        const holdSettled = new Promise((resolve) => { holdDone = resolve; });
        const onHoldAbort = () => holdDone();
        ctx.signal?.addEventListener('abort', onHoldAbort, { once: true });
        ctx.camera.setPoseDriver((pose, dt) => {
          elapsed = Math.min(T, elapsed + dt);
          if (elapsed >= T) holdDone();
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
          settled: holdSettled,
        });
        ctx.signal?.removeEventListener('abort', onHoldAbort);
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
      // A PUSH-IN, not a re-cut. This used to be a bit-identical plan to the
      // cut that had just happened — 1,600ms of dollying out 0.8u and back to
      // the same frame — and it was authored at angle pi, the empty border and
      // straight into the key light. It escaped the backdrop guard because
      // groupShot() routes through helpers rather than calling planGroupCamera
      // in a beat file, which is the exact gap that let the circle shots sit
      // wrong through four rounds of playtesting.
      groupShot(['joseph', ...BROTHERS], {
        angle: TELLING_CIRCLE_ANGLE,
        distance: 4.9,
        height: 2.5,
        look: 1.2,
        ms: 1200,
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
      { t: 'hold', ms: 1100 },
      { t: 'verseHide' },
      // Widening back out for Jacob's arrival — on the camp side, not the
      // border side.
      groupShot(['joseph', ...BROTHERS], {
        angle: TELLING_CIRCLE_ANGLE,
        distance: 6.5,
        height: 3.05,
        look: 1.2,
        ms: 1400,
        arcRadius: 6.5,
      }),
      { t: 'fn', fn: async () => {
        ctx.npcs.freeze(jac, false);
        // THE LIVE PLACEMENT. The mirrored mark was applied in the
        // `if (withJacob)` branch above — which both call sites pass `false`,
        // so it never ran and Jacob still walked to the pre-mirror spot, 0.85u
        // inside Levi, for the whole of Genesis 37:9-11. A fix in a branch
        // nothing calls is not a fix.
        await ctx.npcs.sendTo(jac, JACOB_TELL_MARK.x, JACOB_TELL_MARK.z, { speed: 1.4 });
        jac.char.setPosition(JACOB_TELL_MARK.x, JACOB_TELL_MARK.z);
        jac.pos.x = JACOB_TELL_MARK.x;
        jac.pos.z = JACOB_TELL_MARK.z;
        ctx.npcs.freeze(jac, true);
        jac.char.turnToward(FIRE.x - jac.pos.x, FIRE.z - jac.pos.z);
        ctx.storyEvent?.('tell2_family');
      } },
      // side FLIPPED with the ring. Jacob stands where he always did, but the
      // brothers (and therefore the axis this shot is measured against) moved to
      // the south arc, so +0.7 swung this shot dead north — out at the bare
      // border and straight into the key — on the line the whole chapter has
      // been building to. Both faces were silhouettes against nothing.
      shot('joseph', 'jacob', { side: -0.7, dist: 3.8, height: 2.15, look: 1.15 }),
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
      { t: 'hold', ms: 1400 },
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
      // ms 0: the scene is ALREADY graded tenseDay by the time close() runs, so
      // this blocked two seconds on a tween with nothing to tween — right
      // before the last line of the chapter. Kept rather than deleted because
      // it is the beat's explicit statement of its own mood.
      { t: 'grade', mood: 'tenseDay', ms: 0 },
      { t: 'fn', fn: () => { ctx.storyEvent?.('envy'); } },
      { t: 'verse', verse: WEB.gen_37_11 },
      // `hold`, not `wait`: these exist to give the closing line room, so Skip
      // must collapse them with the narration. They used to run their full
      // 1300 + 1200ms regardless, which is why skipping the last line looked
      // like it did nothing at all.
      { t: 'hold', ms: 1300 },
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
      { t: 'hold', ms: 1200 },
      { t: 'verseHide' },
    ]);

    const lone = TELLING_LONE_MARK;
    ctx.joseph.turnToward(lone.x - ctx.joseph.position.x, lone.z - ctx.joseph.position.z);
    await seq([
      {
        t: 'cam',
        ...TELLING_WALKOFF_CAMERA,
        target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }),
        duration: 3200,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.4,
      },
      { t: 'fn', fn: async () => {
        const { angle, distance, height, lookHeight } = TELLING_WALKOFF_CAMERA;
        ctx.camera.setPoseDriver((pose) => {
          const p = ctx.joseph.position;
          pose.pos.set(
            p.x - Math.sin(angle) * distance,
            height,
            p.z - Math.cos(angle) * distance,
          );
          pose.look.set(p.x, lookHeight, p.z);
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
      // The last image of the chapter: the same side of the axis, easing in
      // closer. A push-in, not a reframe — nothing on screen changes place.
      {
        t: 'cam',
        ...TELLING_FINAL_CAMERA,
        target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }),
        duration: 2400,
        path: 'arc',
      },
      { t: 'wait', ms: 900 },
      { t: 'grade', mood: 'goldenHour', ms: 2200 },
      { t: 'fade', on: true, ms: 1800 },
      { t: 'fn', fn: () => ctx.joseph.setGrief(false) },
      { t: 'title', heading: 'To be continued', sub: 'Genesis 37:12–17 — the road to Dothan', holdMs: 4200 },
      // Hand the black over cleanly. finish() navigates, and navigation fades
      // its own veil in over whatever is on screen — so leaving immediately
      // meant a second black dissolving on top of the title card that had not
      // finished leaving. Half a second of settled black and the only visible
      // transition is the map fading up. (Nate: "the ending of every scene
      // should fade smoothly back to the homepage".)
      { t: 'wait', ms: 520 },
    ]);
    ctx.finish?.();
  }

  return { firstTell, tell, close };
}
