import { WEB } from '../../../data/versesWEB.js';
import { isAbortError } from '../../../core/async.js';
import { planGroupCamera } from './helpers.js';

export const DUSK_FIRE = Object.freeze({ x: 0, z: -6 });
// Swept the same way: backdrop ~251 with the dusk key on their faces, against
// 79 and a dead border at pi. Exported so the backdrop guard reads the real one.
export const DUSK_CIRCLE_ANGLE = Math.PI * 0.32;
export const DUSK_JOSEPH_MARK = Object.freeze({ x: -0.6, z: -7.6 });
export const HERD_DIRECTION_MARKS = Object.freeze([
  Object.freeze({ x: -0.7, z: -2.5 }),
  Object.freeze({ x: 1.9, z: -2.5 }),
]);
export const HERD_DIRECTION_JOSEPH_MARK = Object.freeze({ x: 0.6, z: -4.7 });
export function planHerdDirectionCamera({
  fov = 46,
  aspect = 16 / 9,
  josephHeadHeight = 1.65,
  brotherHeadHeights = [1.65, 1.65],
} = {}) {
  return planGroupCamera({
    actors: [
      { ...HERD_DIRECTION_JOSEPH_MARK, y: 0, headHeight: josephHeadHeight },
      ...HERD_DIRECTION_MARKS.map((mark, index) => ({
        ...mark,
        y: 0,
        headHeight: brotherHeadHeights[index] ?? 1.65,
      })),
    ],
    // Shoot from behind Joseph: his small shoulder anchors the foreground
    // while both speaking brothers face the audience across the frame.
    angle: 0,
    distance: 5.4,
    height: 2.25,
    look: 1.15,
    fov,
    aspect,
  });
}
// South arc, mirroring TELL_RING for the same reason: the camera belongs on
// the side with the camp behind it. Measured at the old staging: backdrop 79.
export const DUSK_RING = Object.freeze([
  Object.freeze(['judah', 0.3584]),
  Object.freeze(['reuben', 1.15]), // 1.0584 sat him inside a prop (see the mark guard in test:layout)
  Object.freeze(['simeon', 2.0084]),
  Object.freeze(['levi', 2.7584]),
]);

// SCENE 1 — Joseph, Genesis 37:1–11. The story is DATA + gates; this act's
// beats are plain async functions over the shared scene context (`ctx`) and the
// shot helpers (`h`). Split out of the old single beats.js (D14) so each act of
// the story is its own file — see ./index.js for the running order.
// ACT 1 — life in the camp: herd the strays, report to father, receive the
// coat (Gen 37:3–4), and the dusk fire that ends with him sent to bed.
export function makeCampBeats(ctx, h) {
  const {
    seq, wait, gate, J, shot, twoShot, pointToGate,
    stageTellingAmbient, releaseTellingAmbient,
    stageCoatEnvySpectators, releaseCoatEnvySpectators,
  } = h;

  // Interactables swallows onInteract throws by design (one broken prompt must
  // not kill the interact loop) — but this act's beat gates AWAIT their
  // handlers, so a swallowed throw would strand the story behind black with
  // input off, forever. Every gated async handler runs through this guard: a
  // real failure is logged, the screen is recovered to what the lines after
  // the gate expect, and the gate ALWAYS resolves so the story advances.
  const advanceOnError = (fn, resolve, recover) => async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      if (!isAbortError(e)) {
        console.error('[camp] gated cutscene failed; advancing the beat', e);
        try { recover?.(); } catch { /* recovery is best-effort */ }
      }
    } finally {
      resolve();
    }
  };

  // ---------- beat 1 · 🐑 herd the strays ----------
  async function herd() {
    ctx.setInput(true);
    ctx.grading.grade('goldenHour', 800);
    ctx.hud.setObjective('Bring 3 stray sheep back to the pen.', 'Walk up behind a sheep — it runs ahead of you.');
    const penGate = pointToGate(ctx.camp.pen);
    ctx.guide.setTargetXZ(penGate.x, penGate.z);

    // His brothers call practical directions as he passes the fire (once).
    // Genesis 37:4 places their explicit hatred after the special tunic, so
    // this pre-coat beat must not make favoritism or contempt arrive early.
    // GATED to this beat (a stale trigger firing during the beat-4 gather
    // froze the ring walkers and re-enabled input inside a cutscene), and the
    // beat won't complete until the directions dialogue has fully resolved.
    let herdActive = true;
    let directionsBusy = null;
    ctx.interactables.addTrigger({
      id: 'herd-directions', x: 0.8, z: -6.5, r: 3.4, once: true,
      when: () => herdActive,
      onEnter: () => {
        directionsBusy = (async () => {
          // Genesis 37:2 identifies Joseph's flock companions as sons of
          // Bilhah and Zilpah. Use unnamed brothers here instead of assigning
          // that role to Simeon and Levi, who were Leah's sons.
          const firstBrother = ctx.cast.brother5;
          const secondBrother = ctx.cast.brother1;
          const stagedBrothers = [firstBrother, secondBrother];
          const backgroundActors = Object.values(ctx.cast).filter(
            (actor) => actor && !stagedBrothers.includes(actor),
          );
          const brotherColor = '#b9a27d';
          const originalJoseph = {
            x: ctx.joseph.position.x,
            z: ctx.joseph.position.z,
          };
          const originalBrothers = stagedBrothers.map((brother) => ({
            x: brother.pos.x,
            z: brother.pos.z,
          }));
          const originalBackground = backgroundActors.map((actor) => ({
            x: actor.pos.x,
            z: actor.pos.z,
          }));
          let covered = false;
          ctx.setInput(false);
          ctx.hud.setCutscene?.(true);
          stagedBrothers.forEach((brother) => ctx.npcs.freeze(brother, true));
          backgroundActors.forEach((actor) => ctx.npcs.freeze(actor, true));
          try {
            // Joseph may enter anywhere in the 3.4u trigger disc. Stage all
            // three on audited, separated marks under black; otherwise a valid
            // edge entry can place Joseph inside one of the speaking brothers.
            await ctx.cinema.fade(true, 180);
            covered = true;
            stagedBrothers.forEach((brother, index) => {
              const mark = HERD_DIRECTION_MARKS[index];
              brother.target = null;
              brother.stuckT = 0;
              brother.onArrive?.resolve?.(false);
              brother.onArrive = null;
              brother.pos.x = mark.x;
              brother.pos.z = mark.z;
              brother.circle.x = mark.x;
              brother.circle.z = mark.z;
              brother.char.setPosition(mark.x, mark.z);
            });
            // A living camp can wander anyone through the lens corridor. Move
            // every non-speaking actor to an offstage holding line for this
            // covered two-line vignette, then restore them exactly afterward.
            backgroundActors.forEach((actor, index) => {
              const x = 80 + index * 1.5;
              const z = 80;
              actor.target = null;
              actor.stuckT = 0;
              actor.onArrive?.resolve?.(false);
              actor.onArrive = null;
              actor.pos.x = x;
              actor.pos.z = z;
              actor.circle.x = x;
              actor.circle.z = z;
              actor.char.setPosition(x, z);
            });
            ctx.controller?.vel?.set?.(0, 0);
            ctx.joseph.setPosition(
              HERD_DIRECTION_JOSEPH_MARK.x,
              HERD_DIRECTION_JOSEPH_MARK.z,
            );
            const j = ctx.joseph.position;
            const lens = ctx.camera.camera;
            const directionsPlan = planHerdDirectionCamera({
              fov: lens?.fov ?? 46,
              aspect: lens?.aspect ?? 16 / 9,
              josephHeadHeight: ctx.joseph.headHeight,
              brotherHeadHeights: stagedBrothers.map((brother) => brother.char.headHeight),
            });
            if (!directionsPlan.compositionSafe) {
              throw new Error('Herd directions have no audience-safe three-shot');
            }
            ctx.camera.cutTo(directionsPlan);
            await ctx.cinema.fade(false, 220);
            covered = false;
            ctx.joseph.turnToward(
              ((firstBrother.pos.x + secondBrother.pos.x) / 2) - j.x,
              ((firstBrother.pos.z + secondBrother.pos.z) / 2) - j.z,
            );
            firstBrother.char.turnToward(j.x - firstBrother.pos.x, j.z - firstBrother.pos.z);
            firstBrother.char.play('talk');
            // NAMED. Genesis 37:2 says Joseph "was a boy with the sons of
            // Bilhah and Zilpah" — Bilhah's sons are Dan and Naphtali. Two
            // characters called "One brother" and "Another brother" are not
            // people, and the player cannot care about a label.
            await ctx.dialogue.say('Dan', 'Joseph — the flock is spreading into the camp.', { color: brotherColor });
            firstBrother.char.play('idle');
            secondBrother.char.turnToward(j.x - secondBrother.pos.x, j.z - secondBrother.pos.z);
            secondBrother.char.play('talk');
            await ctx.dialogue.say('Naphtali', 'Circle behind the strays, little brother. Bring them through the gate.', { color: brotherColor });
            // WHY there are strays at all — and therefore what Joseph's "evil
            // report" (Gen 37:2) is actually about. The verse states the report
            // and never its contents, so this stays at the mildest reading that
            // explains it: the gate was left, and they would rather it were not
            // mentioned. Negligence, not cruelty — Gen 37:4 has not licensed
            // their hatred yet, and it must not arrive early.
            secondBrother.char.play('idle');
            firstBrother.char.play('talk');
            await ctx.dialogue.say('Dan', 'And say nothing to father about the gate. It was left open. It happens.', { color: brotherColor });
            firstBrother.char.play('idle');
            await wait(700);
            // Restore the live camp at the exact pre-dialogue positions under
            // the same short veil. No actor snaps and no quest path is moved.
            await ctx.cinema.fade(true, 180);
            covered = true;
          } catch (error) {
            if (!isAbortError(error)) {
              console.error('[herd directions]', error);
              // A dialogue/camera failure after reveal still needs a covered
              // restore; never visibly snap the staged actors back into camp.
              if (!covered) {
                try {
                  await ctx.cinema.fade(true, 180);
                  covered = true;
                } catch (coverError) {
                  if (!isAbortError(coverError)) console.error('[herd directions cover]', coverError);
                }
              }
            }
          } finally {
            ctx.dialogue.hide();
            stagedBrothers.forEach((brother, index) => {
              const original = originalBrothers[index];
              brother.char.play('idle');
              brother.pos.x = original.x;
              brother.pos.z = original.z;
              brother.circle.x = original.x;
              brother.circle.z = original.z;
              brother.char.setPosition(original.x, original.z);
              ctx.npcs.freeze(brother, false);
            });
            backgroundActors.forEach((actor, index) => {
              const original = originalBackground[index];
              actor.char.play('idle');
              actor.pos.x = original.x;
              actor.pos.z = original.z;
              actor.circle.x = original.x;
              actor.circle.z = original.z;
              actor.char.setPosition(original.x, original.z);
              ctx.npcs.freeze(actor, false);
            });
            ctx.joseph.setPosition(originalJoseph.x, originalJoseph.z);
            ctx.camera.release(1);
            ctx.camera.snap();
            if (covered && !ctx.signal?.aborted) {
              try {
                await ctx.cinema.fade(false, 220);
              } catch (error) {
                if (!isAbortError(error)) console.error('[herd directions reveal]', error);
              }
            }
            ctx.hud.setCutscene?.(false);
            // Never re-arm input inside a later beat or after scene retirement.
            if (herdActive && !ctx.signal?.aborted) ctx.setInput(true);
          }
        })();
        return directionsBusy; // Interactables observes async trigger failures/abort
      },
    });

    let done;
    const all = gate(() => new Promise((r) => { done = r; }));
    ctx.onStrayPenned = (n) => {
      ctx.hud.flashCount('🐑', n, 3);
      if (n < 3) {
        ctx.hud.setObjective(`Bring the stray sheep to the pen — ${n} of 3.`, 'Walk up behind a sheep — it runs ahead of you.');
        const s = ctx.sheep.nearestStray(ctx.joseph.position.x, ctx.joseph.position.z);
        if (s) ctx.guide.setTargetXZ(s.x, s.z);
      } else {
        // The gameplay goal no longer owns the banner once its gate resolves,
        // even if a concurrent conversation still needs to finish.
        ctx.hud.clearObjective?.();
        done();
      }
    };
    // point at the first stray
    const first = ctx.sheep.nearestStray(ctx.joseph.position.x, ctx.joseph.position.z);
    if (first) ctx.guide.setTargetXZ(first.x, first.z);
    if (ctx.sheep.straysLeft === 0) done(); // checkpoint-resume safety
    await all;
    if (directionsBusy) await directionsBusy; // never hand off to beat 2 mid-dialogue
    herdActive = false;
    ctx.onStrayPenned = null;
    ctx.guide.setTarget(null);
    ctx.sound('ui.chime');
    // D9 (Nate): the finished quest gets its MOMENT — a big held check before
    // anything new is asked of the player.
    await ctx.hud.completeObjective('All three sheep are home!');
    await wait(500);
  }

  // ---------- beat 2 · 🧔 report to Jacob ----------
  async function report() {
    ctx.setInput(true);
    ctx.grading.grade('goldenHour', 600);
    ctx.hud.setObjective('Go to your father’s tent.');
    const jac = ctx.cast.jacob;
    ctx.guide.setTargetXZ(jac.pos.x, jac.pos.z);

    let spoken = false;
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: 'jacob-report', label: 'Talk to Jacob',
        getPos: () => jac.pos, r: 3.0, lift: 2.0,
        object: () => jac.char.root,
        when: () => !spoken,
        onInteract: advanceOnError(async () => {
          spoken = true;
          ctx.setInput(false);
          ctx.hud.clearObjective?.();
          ctx.guide.setTarget(null);
          ctx.npcs.freeze(jac, true);
          jac.char.turnToward(ctx.joseph.position.x - jac.pos.x, ctx.joseph.position.z - jac.pos.z);
          jac.char.play('talk');
          await ctx.dialogue.say('Jacob', 'Joseph, my son. How are the sheep?', { color: J.Jacob });
          await ctx.dialogue.say('Joseph', 'The flock is well. But I bring a bad report about my brothers.', { color: J.Joseph });
          await ctx.dialogue.say('Jacob', 'I hear you, my son.', { color: J.Jacob });
          await ctx.dialogue.say('Jacob', 'Come inside — I have something for you.', { color: J.Jacob });
          ctx.dialogue.hide();
          jac.char.play('idle');
          // Land the full verse where its flock/report action has just been
          // enacted instead of announcing Joseph's report before the player
          // performs it during the opening pan.
          // THE HISTORY IS ABOUT THE CAMP, SO SHOW THE CAMP.
          //
          // Nate: "have the camera show other parts around the camp or
          // something when the narrator starts talking about the history a
          // little, then cut to the next part where joseph and his father are
          // in the tent!" This verse names Jacob's household, Joseph's age, the
          // flock and his brothers — holding on two men standing still while it
          // reads was the least interesting frame available.
          //
          // A slow inward orbit of the camp's populated heart runs UNDER the
          // narration. The arc was measured, not chosen: looking in at the
          // centre scores 251-347 weighted props and people from every angle,
          // and -90 to -150 degrees is the richest stretch (331 -> 326, peaking
          // 347). The beat then ends and the coat cuts to the tent interior.
          let tourT = 0;
          const TOUR = 18000;
          const LOOK = { x: 0.5, y: 1.4, z: -3.0 };
          const tourScratch = { x: 0, y: 0, z: 0 }; // pose drivers run per frame — no alloc
          const tourPose = (k) => {
            const e = k * k * (3 - 2 * k); // ease both ends — no start/stop jolt
            const a = (-90 - 60 * e) * Math.PI / 180;
            const r = 15 - 3.5 * e;
            tourScratch.x = LOOK.x + Math.sin(a) * r;
            tourScratch.y = 6.2 - 1.2 * e;
            tourScratch.z = LOOK.z + Math.cos(a) * r;
            return tourScratch;
          };
          try {
            await seq([
              { t: 'letterbox', on: true },
              // The tour opens 15u out and 6.2u up. Reaching that from a
              // shoulder-height follow camera standing at the tent door is not a
              // move, it is a different shot — so it is CUT to under a short
              // dip, the same grammar every other stage change here uses.
              { t: 'fade', on: true, ms: 200 },
              { t: 'fn', fn: () => {
                const p = tourPose(0);
                ctx.camera.cutTo({
                  angle: Math.atan2(LOOK.x - p.x, LOOK.z - p.z),
                  target: LOOK,
                  distance: Math.hypot(p.x - LOOK.x, p.z - LOOK.z),
                  height: p.y - LOOK.y,
                  lookHeight: 0,
                });
                ctx.camera.setPoseDriver((pose, dt) => {
                  tourT = Math.min(TOUR, tourT + dt);
                  const q = tourPose(tourT / TOUR);
                  pose.pos.set(q.x, q.y, q.z);
                  pose.look.set(LOOK.x, LOOK.y, LOOK.z);
                });
              } },
              { t: 'fade', on: false, ms: 260 },
              { t: 'verse', verse: WEB.gen_37_2 },
              { t: 'verseHide' },
            ]);
          } finally {
            ctx.camera.setPoseDriver(null);
          }
        }, resolve, () => ctx.cinema.fade(false, 400)),
      });
    }));
  }

  // ---------- beat 3 · 🧥 THE COAT (inside Jacob's lamplit tent) ----------
  async function coat() {
    const jac = ctx.cast.jacob;
    const T = ctx.tentInterior;
    ctx.setInput(false);
    ctx.npcs.freeze(jac, true);
    const jacHome = { x: jac.pos.x, z: jac.pos.z };
    const coatFrame = (towardB) => ({
      t: 'fn',
      fn: async () => {
        jac.char.play('talk');
        // Wait for the LENS, not for a number that happens to match the one
        // passed in: the reframe is now priced by how far it has to swing.
        const plan = twoShot('jacob', 'joseph', {
          ms: 1250, distMin: 3.2, distMax: 3.35,
          height: 1.9, look: 1.18, towardB, responsiveSpeaker: 'a',
        });
        await wait(plan.moveMs);
      },
    });
    await seq([
      { t: 'letterbox', on: true },
      // step inside with father — dip to black, come up in lamplight
      { t: 'fade', on: true, ms: 750 },
      { t: 'fn', fn: () => {
        T.group.visible = true;
        ctx.setStage?.('tent');
        ctx.grading.set('tentWarm');
        // bounds travel with the stage (the clamp runs even with input off)
        ctx.controller.bounds = { minX: T.POS.x - 3.4, maxX: T.POS.x + 3.4, minZ: T.POS.z - 3.4, maxZ: T.POS.z + 3.4 };
        jac.pos.x = T.POS.x - 0.8; jac.pos.z = T.POS.z - 0.5;
        jac.char.setPosition(jac.pos.x, jac.pos.z);
        ctx.joseph.setPosition(T.POS.x + 1.0, T.POS.z + 0.9);
        jac.char.turnToward(ctx.joseph.position.x - jac.pos.x, ctx.joseph.position.z - jac.pos.z);
        ctx.joseph.turnToward(jac.pos.x - ctx.joseph.position.x, jac.pos.z - ctx.joseph.position.z);
        // The first painted tent frame uses the same live, responsive plan as
        // the dialogue: a relationship two-shot when it fits, Jacob's clean
        // single on portrait when the full pair would leave the safe frame.
        twoShot('jacob', 'joseph', {
          ms: 1, distMin: 3.2, distMax: 3.35,
          height: 1.9, look: 1.18, towardB: 0.32, responsiveSpeaker: 'a',
        });
      } },
      { t: 'fade', on: false, ms: 1000 },
      coatFrame(0.32),
      { t: 'say', who: 'Jacob', text: 'Joseph. Come, stand in the lamplight.', color: J.Jacob },
      coatFrame(0.44),
      { t: 'say', who: 'Jacob', text: 'You came to me in my old age, my son.', color: J.Jacob },
      coatFrame(0.36),
      { t: 'say', who: 'Jacob', text: 'I had this made for you. Come, let me place it on your shoulders.', color: J.Jacob },
      { t: 'dialogueHide' },
      // THE GIFT (D9 framing law): a SIDE two-shot from LIVE positions —
      // and recomputed AFTER Jacob walks over (the old pre-walk framing left
      // the back of his head square in the lens once he'd crossed the room).
      // D11: distance capped + a touch lower — the lens stays INSIDE the tent.
      // D13: swung 0.6 rad toward Joseph's side so we watch FATHER'S FACE give
      // the coat, never the back of his head.
      { t: 'fn', fn: async () => {
        const plan = twoShot('jacob', 'joseph', {
          ms: 1500, distMax: 3.4, height: 1.9, look: 1.2,
          towardB: 0.6, responsiveSpeaker: 'a',
        });
        await wait(plan.moveMs);
      } },
      { t: 'fn', fn: async () => {
        // Jacob carries it to his son — a real per-frame walk (D8: the old
        // timer-stepped loop was the same quantized shuffle as the lone walk)
        const jp = ctx.joseph.position;
        const dx = jp.x - jac.pos.x, dz = jp.z - jac.pos.z;
        const d0 = Math.hypot(dx, dz);
        const tx = jac.pos.x + (dx / d0) * (d0 - 0.95);
        const tz = jac.pos.z + (dz / d0) * (d0 - 0.95);
        ctx.npcs.freeze(jac, false);
        await ctx.npcs.sendTo(jac, tx, tz, { speed: 0.8 });
        ctx.npcs.freeze(jac, true);
        jac.char.turnToward(dx, dz);
        // re-frame the CLOSED-UP pair — his face, inside the tent
        const giftPlan = twoShot('jacob', 'joseph', {
          ms: 1250, distMax: 3.3, height: 1.85, look: 1.2,
          towardB: 0.6, responsiveSpeaker: 'a',
        });
        jac.char.play('talk'); // the offering gesture
        await wait(giftPlan.moveMs);
        ctx.joseph.setCoat(true);       // the tunic settles over his shoulders
        // The state line is not decoration — it is how a player who cannot
        // read a low-poly face knows what the scene means. Every emotional
        // turn raises one, and this is the only happy moment in the chapter.
        ctx.hud.emote('Joseph is happy');
        ctx.sound('sfx.cloth_equip');
        ctx.sound('stinger.coat_gift');
        ctx.sparkle(4);
        jac.char.play('idle');
        await wait(700);
        // Joseph turns slowly in place — wearing it, showing every side
        const j0 = Math.atan2(jac.pos.x - jp.x, jac.pos.z - jp.z);
        await ctx.motion.tween(2100, (k) => {
          const a = j0 + k * Math.PI * 2;
          ctx.joseph.turnToward(Math.sin(a), Math.cos(a));
        });
        await wait(500);
      } },
      // …then the cut BEHIND him: the banded diamonds held clear on the BACK.
      { t: 'fn', fn: async () => {
        const j = ctx.joseph.position;
          // CameraDirector subtracts its angle vector from the target. Begin
          // opposite Jacob, then swing to Joseph's rear three-quarter: the coat
          // still reads across his back, but neither large head can sit directly
          // on the lens axis and hide the other face.
          const a = Math.atan2(jac.pos.x - j.x, jac.pos.z - j.z) + 1.0;
          ctx.camera.cinematicMoveTo({
            angle: a,
            target: { x: j.x, z: j.z },
            distance: 3.1,
            height: 1.7,
            lookHeight: 1.1,
            duration: 1400,
            path: 'arc',
        });
        await wait(2800);
      } },
      { t: 'verse', verse: WEB.gen_37_3 },
      { t: 'verseHide' },
      // outside, across the camp, the brothers watch the tent — dip-to-black
      // CUT (cutscene-director: clean transitions, never a glide through walls)
      { t: 'fade', on: true, ms: 420 },
      { t: 'fn', fn: () => {
        // This is an exterior camp shot. The old code left the isolated tent
        // stage active until after Judah spoke, hiding the whole camp while
        // the interior floated in the distance. Swap every owner under black.
        T.group.visible = false;
        ctx.setStage?.('camp');
        ctx.controller.bounds = ctx.bounds;
        jac.pos.x = jacHome.x; jac.pos.z = jacHome.z;
        jac.char.setPosition(jacHome.x, jacHome.z);
        // Father and son remain inside the real camp tent, outside this lens.
        ctx.joseph.setPosition(-9.4, -5.4);
      } },
      // SETTLE BEHIND THE BLACK. Waking the camp stage is the heaviest single
      // frame in the beat: particles, the flock, ambient AI, the fire lights
      // and the ambience all come back at once, and the grade moves the sky,
      // fog, key, hemi and ridges with them. Revealing on the very next frame
      // shows the player that work as a hitch. Two settled frames cost nothing
      // and the cut lands clean.
      { t: 'wait', ms: 420 },
      // Nate, twice: this shot showed the empty back of the camp. Measured every
      // angle for what actually falls behind the brothers -- the old 0.55pi scored
      // 127 weighted props and actors, this scores 237. Same group, lived-in camp.
      { t: 'cam', angle: 0.09, target: { x: 0.8, z: -7.6 }, distance: 5.4, height: 1.95, lookHeight: 1.3, duration: 1, awaitMs: false },
      // D13 (Nate): this is the SAME DAY, minutes after the coat — `ominous`
      // is a night palette and read as nightfall. Daytime tension instead.
      { t: 'grade', mood: 'tenseDay', ms: 10 },
      { t: 'sound', key: 'stinger.hatred' },
      // the TENSION music takes over while envy talks (D6: use the real track)
      { t: 'fn', fn: () => {
        // The screen is fully black here. Put every non-speaking person on a
        // collision-audited spectator mark; freezing a random wander position
        // merely preserved stochastic heads in front of the lens.
        stageCoatEnvySpectators();
        ctx.setMusic('music.ominous_turn');
        ctx.npcs.freeze(ctx.cast.judah, true);
        ctx.npcs.freeze(ctx.cast.reuben, true);
        // SIMEON AND LEVI HAVE LINES HERE NOW, so they have to be STANDING
        // here. They were left wherever the ambient wander had drifted them —
        // measured 13u and 24u from the men they answer — so their two new cuts
        // framed a speaker alone on empty ground at the far edge of the camp.
        // Giving a character a line without giving him a mark is half a scene.
        const jr = ctx.cast.judah.pos;
        const rb = ctx.cast.reuben.pos;
        const mid = { x: (jr.x + rb.x) / 2, z: (jr.z + rb.z) / 2 };
        [['simeon', -1.15, 0.55], ['levi', 1.15, 0.75]].forEach(([who, dx, dz]) => {
          const npc = ctx.cast[who];
          if (!npc) return;
          const x = mid.x + dx;
          const z = mid.z + dz;
          npc.target = null;
          npc.pos.x = x; npc.pos.z = z;
          if (npc.circle) { npc.circle.x = x; npc.circle.z = z; }
          npc.char.setPosition(x, z);
          npc.char.turnToward(mid.x - x, mid.z - z);
          ctx.npcs.freeze(npc, true);
        });
      } },
      { t: 'fade', on: false, ms: 420 },
      // D11 (Nate): raised further — heads were still clipping the lens here
      shot('judah', 'reuben', { side: 0.45, dist: 3.1, height: 2.15, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      // Judah SEES it — he does not report knowledge he could not have. Gen
      // 37:4 turns on exactly that: "when his brothers SAW that their father
      // loved him more than all his brothers".
      { t: 'say', who: 'Judah', text: 'Look at him. Look what our father has put on his shoulders.', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      shot('reuben', 'judah', { side: -0.42, dist: 3.1, height: 2.15, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.reuben.char; }, state: 'talk' },
      // ONE WANT AND ONE WOUND EACH, all of them from Genesis, because four
      // brothers sharing a single bitter voice is four fewer people.
      //   Reuben — the firstborn who lost his standing (Gen 35:22, 49:3-4).
      //   Simeon — carries Gen 37:4 itself; the line was Reuben's, and Reuben
      //     is the one brother Scripture later makes protective (37:21-22).
      //   Levi — with Simeon, answered an insult with violence (Gen 34:25-31,
      //     49:5-7). He had no line at all in the whole chapter.
      { t: 'say', who: 'Reuben', text: 'I am the firstborn of this house. And it is the boy who wears the colours.', color: J.Reuben },
      { t: 'anim', get char() { return ctx.cast.reuben.char; }, state: 'idle' },
      // Every new speaker gets his own frame. A line delivered on the previous
      // shot is a static hold with a voice over it — which is the dead-air
      // failure mode, arriving through the script rather than the timeline.
      shot('simeon', 'judah', { side: 0.38, dist: 3.2, height: 2.15, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.simeon.char; }, state: 'talk' },
      { t: 'say', who: 'Simeon', text: 'Not one kind word is left in me for that boy.', color: J.Simeon },
      { t: 'anim', get char() { return ctx.cast.simeon.char; }, state: 'idle' },
      shot('levi', 'simeon', { side: -0.36, dist: 3.2, height: 2.15, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.levi.char; }, state: 'talk' },
      { t: 'say', who: 'Levi', text: 'Let him wear it out with the flock, then. We will see how long the colours last.', color: J.Levi },
      { t: 'anim', get char() { return ctx.cast.levi.char; }, state: 'idle' },
      // envy hardens into a low, scornful laugh between them (D8: quiet — it
      // sits UNDER the scene, never on top of it)
      { t: 'sound', key: 'sfx.men_laughing', gain: 0.42 },
      { t: 'fn', fn: async () => { ctx.cast.judah.char.play('talk'); ctx.cast.reuben.char.play('talk'); await wait(1300); ctx.cast.judah.char.play('idle'); ctx.cast.reuben.char.play('idle'); } },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_4 },
      { t: 'verseHide' },
      // FORESHADOW. Nate: "right before that scene ends, have a badge pop up
      // showing 'joseph feels something bad coming up' or something". The
      // player has just watched two brothers turn against him while he was
      // inside the tent, unaware — this is the only way he learns that Joseph
      // senses it, and it makes the dream that follows land as a warning
      // rather than a non sequitur.
      { t: 'fn', fn: () => ctx.hud.emote('Joseph senses something is wrong', 3400) },
      { t: 'hold', ms: 900 },
      { t: 'fn', fn: () => {
        ctx.npcs.freeze(ctx.cast.judah, false);
        ctx.npcs.freeze(ctx.cast.reuben, false);
        // ...and everyone staged for the scene goes back to living in it.
        ctx.npcs.freeze(ctx.cast.simeon, false);
        ctx.npcs.freeze(ctx.cast.levi, false);
        releaseCoatEnvySpectators();
      } },
      // Joseph steps back out into the gold, wearing the coat. D8 state
      // machine: the hatred has BEGUN — the tension score persists from here
      // until the dream; the warm theme does not come back in between.
      { t: 'fade', on: true, ms: 420 },
      { t: 'fn', fn: () => {
        // The tent/stage/Jacob/bounds restore already ran under the envy cut
        // above, and Jacob is frozen for the whole beat — only the two lines
        // that do NEW work remain here.
        ctx.joseph.setPosition(-8.2, -4.2); // just outside father's tent
        ctx.grading.set('goldenHour');
      } },
      { t: 'camRelease', ms: 1 },
      { t: 'fn', fn: () => ctx.camera.snap() },
      // SETTLE BEHIND THE BLACK. Waking the camp stage is the heaviest single
      // frame in the beat: particles, the flock, ambient AI, the fire lights
      // and the ambience all come back at once, and the grade moves the sky,
      // fog, key, hemi and ridges with them. Revealing on the very next frame
      // shows the player that work as a hitch. Two settled frames cost nothing
      // and the cut lands clean.
      { t: 'wait', ms: 420 },
      { t: 'fade', on: false, ms: 700 },
      { t: 'letterbox', on: false },
      { t: 'fn', fn: () => ctx.npcs.freeze(jac, false) },
    ]);
    ctx.setInput(true);
  }

  // ---------- beat 4 · 🌙 dusk falls: sit with your brothers by the fire ----
  async function dusk() {
    ctx.setInput(true);
    ctx.hud.setObjective('Sit with your brothers by the fire.', 'Walk to the fire, then press the prompt to sit.');
    // DUSK_JOSEPH_MARK, not a copy of its old value. The mark mirrored with the
    // ring and this literal did not, so the glowing arrow — the one thing
    // telling a first-time player where to go — pointed into the middle of the
    // seated brothers, and one of them walks into the spot while you head for
    // it.
    ctx.guide.setTargetXZ(DUSK_JOSEPH_MARK.x, DUSK_JOSEPH_MARK.z);
    // (no music change — the D8 state machine holds the tension from the envy
    // scene; the calm dusk theme never sneaks back in between)
    ctx.grading.grade('dusk', 3200);
    ctx.onDusk?.(); // fireflies fade in (wired by the scene)

    // the brothers drift over and sit around the fire WHILE you walk up — the
    // camp settles for the night (they're alive, not waiting on a trigger).
    // D7: they take the FAR (north) arc only — the south side, where the sit
    // prompt lives, stays Joseph's; they face him across the flames.
    DUSK_RING.forEach(([k, a]) => {
      const n = ctx.cast[k];
      ctx.npcs.sendTo(
        n,
        DUSK_FIRE.x + Math.cos(a) * 1.8,
        DUSK_FIRE.z + Math.sin(a) * 1.8,
        { speed: 1.4 },
      )
        .then((arrived) => {
          if (!arrived || ctx.signal?.aborted) return;
          ctx.npcs.freeze(n, true);
          n.char.turnToward(DUSK_FIRE.x - n.pos.x, DUSK_FIRE.z - n.pos.z);
          n.char.play('kneel'); // Sit_Floor_Idle — seated by the firelight
        })
        .catch((e) => { if (!isAbortError(e)) console.error('[dusk gather]', e); });
    });

    // the campfire beat's ONE action: the player chooses to sit down too. The
    // prompt is gated to THIS beat (when: !sat) — Interactables has no removal,
    // and an ungated sit-fire prompt re-fired in beat 6 when the player walked
    // back through the fire (a softlock).
    let sat = false;
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: 'sit-fire', label: 'Sit by the fire',
        x: DUSK_JOSEPH_MARK.x, z: DUSK_JOSEPH_MARK.z, r: 2.6, lift: 0.7,
        when: () => !sat,
        onInteract: advanceOnError(async () => {
          if (sat) return;
          sat = true;
          ctx.setInput(false);
          ctx.hud.clearObjective?.();
          ctx.guide.setTarget(null);
          ctx.joseph.turnToward(
            DUSK_FIRE.x - ctx.joseph.position.x,
            DUSK_FIRE.z - ctx.joseph.position.z,
          );
          ctx.joseph.play('kneel'); // Joseph sits (Sit_Floor_Idle / kneel fallback)
          // cozy fireside camera settles in as the light dies + sparks rise
          await seq([
            { t: 'letterbox', on: true },
            { t: 'fade', on: true, ms: 320 },
            { t: 'fn', fn: () => {
              ctx.joseph.setPosition(DUSK_JOSEPH_MARK.x, DUSK_JOSEPH_MARK.z);
              ctx.joseph.turnToward(
                DUSK_FIRE.x - DUSK_JOSEPH_MARK.x,
                DUSK_FIRE.z - DUSK_JOSEPH_MARK.z,
              );
              ctx.joseph.play('kneel');
              DUSK_RING.forEach(([key, angle]) => {
                const npc = ctx.cast[key];
                const x = DUSK_FIRE.x + Math.cos(angle) * 1.8;
                const z = DUSK_FIRE.z + Math.sin(angle) * 1.8;
                npc.target = null;
                npc.stuckT = 0;
                npc.onArrive?.resolve?.(false);
                npc.onArrive = null;
                npc.pos.x = x;
                npc.pos.z = z;
                if (npc.circle) {
                  npc.circle.x = x;
                  npc.circle.z = z;
                }
                npc.char.setPosition(x, z);
                ctx.npcs.freeze(npc, true);
                npc.char.turnToward(DUSK_FIRE.x - x, DUSK_FIRE.z - z);
                npc.char.play('kneel');
              });
              stageTellingAmbient();
              const lens = ctx.camera.camera;
              const actors = [
                {
                  x: DUSK_JOSEPH_MARK.x,
                  y: 0,
                  z: DUSK_JOSEPH_MARK.z,
                  headHeight: ctx.joseph.headHeight,
                },
                ...DUSK_RING.map(([key, angle]) => ({
                  x: DUSK_FIRE.x + Math.cos(angle) * 1.8,
                  y: 0,
                  z: DUSK_FIRE.z + Math.sin(angle) * 1.8,
                  headHeight: ctx.cast[key].char.headHeight,
                })),
              ];
              const plan = planGroupCamera({
                actors,
                // Swept the same way: 0.32pi measures backdrop ~251 with the
                // dusk key on their faces, against 79 and a dead border at pi.
                angle: DUSK_CIRCLE_ANGLE,
                distance: 5.2,
                height: 2.25,
                look: 1.05,
                fov: lens?.fov ?? 46,
                aspect: lens?.aspect ?? 16 / 9,
              });
              if (!plan.compositionSafe) {
                // planGroupCamera always returns its best candidate. Inside a
                // gated handler an imperfect frame beats a dead game — the old
                // throw here was swallowed by Interactables and stranded the
                // beat behind black with input off, permanently.
                console.warn('[camp] dusk circle composition not fully safe; using best plan');
              }
              // Covered cut: the black veil owns this replacement, so its
              // responsive endpoint may land in one frame without a flyover.
              ctx.camera.cinematicMoveTo({ ...plan, duration: 1 });
            } },
            { t: 'fade', on: false, ms: 620 },
            { t: 'wait', ms: 1200 },
          ]);
        }, resolve, () => ctx.cinema.fade(false, 400)),
      });
    }));

    // slow-burn hatred, envy moment 3: even in the quiet, they can't let him
    // warm himself in peace — a low mock and a shared laugh (Nate's men_laughing
    // audio). Joseph, stung, rises to sleep alone.
    const jd = ctx.cast.judah, sm = ctx.cast.simeon;
    await seq([
      // ...and its reverse stays on the SAME side of the axis, or the two
      // shots swap the actors' screen sides and the exchange reads as a glitch.
      shot('judah', 'joseph', {
        side: -0.5, dist: 3.8, height: 2.1, look: 1.15, ms: 1500,
      }),
      { t: 'fn', fn: () => {
        // (the tension score is already running — the state machine carried it
        // in from the envy scene; nothing restarts here)
        jd.char.turnToward(ctx.joseph.position.x - jd.pos.x, ctx.joseph.position.z - jd.pos.z);
        jd.char.play('talk');
      } },
      // D7 logic fix: no one can call him "dreamer" yet — the dreams come
      // later THIS NIGHT. The jeer mocks what they can see: the coat.
      // Judah's second line used to restate his first. He is the brother who
      // will shortly ask "What profit is it if we kill our brother?" (Gen
      // 37:26-27) — so when he speaks again, he is already counting.
      { t: 'say', who: 'Judah', text: 'One day that coat will belong to somebody. It will not be him.', color: J.Judah },
      { t: 'fn', fn: () => {
        jd.char.play('kneel');
        ctx.joseph.turnToward(
          jd.pos.x - ctx.joseph.position.x,
          jd.pos.z - ctx.joseph.position.z,
        );
        ctx.joseph.play('talk');
      } },
      { t: 'say', who: 'Joseph', text: 'Brothers, I came only to sit beside you.', color: J.Joseph },
      { t: 'fn', fn: () => {
        ctx.joseph.play('kneel');
        sm.char.turnToward(
          ctx.joseph.position.x - sm.pos.x,
          ctx.joseph.position.z - sm.pos.z,
        );
        sm.char.play('talk');
      } },
      { t: 'say', who: 'Simeon', text: 'Then sit in silence. We have heard enough.', color: J.Simeon },
      // D8: the laugh lands exactly ONCE in this scene, quiet — under the
      // moment, never over it. (It used to fire again on the walk-out.)
      { t: 'fn', fn: async () => {
        sm.char.turnToward(ctx.joseph.position.x - sm.pos.x, ctx.joseph.position.z - sm.pos.z);
        sm.char.play('talk');
        ctx.sound('sfx.men_laughing', 0.42);
        await wait(1600);
        jd.char.play('kneel'); sm.char.play('kneel'); // back to seated by the fire
      } },
      { t: 'dialogueHide' },
      // D8: Joseph is visibly STUNG — he rises, and his head drops; the camera
      // stays with him a breath so the hurt is unmissable before the quest.
      { t: 'fn', fn: () => { ctx.joseph.play('idle'); ctx.joseph.setGrief(true, 0.55); ctx.hud.emote('Joseph is sad'); } },
      // MEASURED BOTH WAYS, and there is no side that wins on both axes. Scored
      // against the same census and sun the backdrop guard uses:
      //
      //     side  -0.8   backdrop  18   dot(look,sun) -0.25
      //     side  -0.5   backdrop  29   dot(look,sun)  0.02
      //     side  +0.5   backdrop  94   dot(look,sun)  0.76
      //     side  +0.8   backdrop 119   dot(look,sun)  0.85
      //
      // Every well-lit side is aimed at open ground (floor is 80) and every
      // side with camp behind it looks toward the setting sun. I flipped this
      // to -0.5 to fix the glare and traded it straight into the emptiest frame
      // in the camp — the same mistake, in the other direction.
      //
      // So it goes back to +0.5 and the light is solved where it actually lives:
      // this is DUSK, the sun is on the horizon, and there is a fire two metres
      // away with a practical point light on it. Shooting toward a sunset with
      // the fire as key is the shot; an empty field is not. (The trapped-shot
      // rule stands: when no angle clears, re-block. The blocking here is a
      // seated ring the beat cannot move without losing the fire.)
      shot('joseph', 'judah', {
        side: 0.5,
        dist: 3.8,
        height: 2.1,
        look: 1.15,
        ms: 1600,
        speakerAnim: 'idle',
      }),
      { t: 'wait', ms: 1700 },
      { t: 'letterbox', on: false },
    ]);

    // the lonely walk to his tent. D13 (Nate: "the tension music stops when
    // joseph walks to his tent, it shouldn't, till right before the dream"):
    // NO music change here — the tension carried from the envy scene holds all
    // the way to the tent, and only the dream (next beat) takes it away. He
    // walks with his head down (a light grief residual rides the walk).
    let rested = false;
    ctx.joseph.setGrief(true, 0.32);
    ctx.hud.setObjective(
      'The night has turned cold with your brothers.',
      'Go back to your tent and rest.',
    );
    const rest = { x: -8.6, z: -4.4 };
    ctx.guide.setTargetXZ(rest.x, rest.z);
    ctx.camera.release(1600);
    releaseTellingAmbient();
    ctx.setInput(true);
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: 'rest-night', label: 'Rest for the night',
        getPos: () => rest, r: 2.3, lift: 1.4,
        when: () => !rested,
        onInteract: advanceOnError(async () => {
          if (rested) return;
          rested = true;
          ctx.setInput(false);
          ctx.hud.clearObjective?.();
          ctx.guide.setTarget(null);
          ctx.joseph.setGrief(false); // the day's hurt gives way to sleep
          ctx.joseph.setPosition(rest.x, rest.z);
          ctx.joseph.turnToward(-0.9, -0.4); // face the tent
          ctx.joseph.play('kneel'); // settle down to sleep
          await seq([
            { t: 'letterbox', on: true },
            // Close his eyes, then reveal a clean east-side bedside angle.
            // The old visible move ended physically inside Jacob's tent cloth.
            { t: 'fade', on: true, ms: 420 },
            { t: 'cam', angle: -Math.PI * 0.75, target: { x: rest.x - 0.3, z: rest.z - 0.4 }, distance: 3.4, height: 1.45, lookHeight: 0.72, duration: 1 },
            { t: 'fade', on: false, ms: 620 },
            { t: 'wait', ms: 1200 },
            { t: 'fade', on: true, ms: 1600 }, // sleep — down to black; the dream follows
          ]);
          // the dream rises out of BLACK — a failed handler must stay covered
        }, resolve, () => ctx.cinema.fade(true, 300)),
      });
    }));
    // (faded to black, letterbox up — the dream rises straight out of sleep)
  }

  return { herd, report, coat, dusk };
}
