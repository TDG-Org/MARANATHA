import { WEB } from '../../../data/versesWEB.js';
import { isAbortError } from '../../../core/async.js';

// SCENE 1 — Joseph, Genesis 37:1–11. The story is DATA + gates; this act's
// beats are plain async functions over the shared scene context (`ctx`) and the
// shot helpers (`h`). Split out of the old single beats.js (D14) so each act of
// the story is its own file — see ./index.js for the running order.
// ACT 1 — life in the camp: herd the strays, report to father, receive the
// coat (Gen 37:3–4), and the dusk fire that ends with him sent to bed.
export function makeCampBeats(ctx, h) {
  const { seq, wait, gate, J, shot, twoShot, pointToGate } = h;

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
          ctx.setInput(false);
          const sim = ctx.cast.simeon, lev = ctx.cast.levi;
          ctx.npcs.freeze(sim, true);
          ctx.npcs.freeze(lev, true);
          const j = ctx.joseph.position;
          sim.char.turnToward(j.x - sim.pos.x, j.z - sim.pos.z);
          sim.char.play('talk');
          await ctx.dialogue.say('Simeon', 'Joseph — the flock is spreading into the camp.', { color: J.Simeon });
          sim.char.play('idle');
          lev.char.turnToward(j.x - lev.pos.x, j.z - lev.pos.z);
          lev.char.play('talk');
          await ctx.dialogue.say('Levi', 'Circle behind the strays, little brother. Bring them through the gate.', { color: J.Levi });
          await wait(700);
          sim.char.play('idle'); lev.char.play('idle');
          ctx.dialogue.hide();
          ctx.npcs.freeze(sim, false);
          ctx.npcs.freeze(lev, false);
          if (herdActive) ctx.setInput(true); // never re-arm input inside a later beat
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
        onInteract: async () => {
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
          await seq([
            { t: 'letterbox', on: true },
            { t: 'verse', verse: WEB.gen_37_2 },
            { t: 'verseHide' },
          ]);
          resolve();
        },
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
        twoShot('jacob', 'joseph', {
          ms: 950, distMin: 3.2, distMax: 3.35,
          height: 1.9, look: 1.18, towardB, responsiveSpeaker: 'a',
        });
        await wait(570);
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
      { t: 'fn', fn: () => twoShot('jacob', 'joseph', {
        ms: 1500, distMax: 3.4, height: 1.9, look: 1.2,
        towardB: 0.6, responsiveSpeaker: 'a',
      }) },
      { t: 'wait', ms: 1500 },
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
        twoShot('jacob', 'joseph', {
          ms: 900, distMax: 3.3, height: 1.85, look: 1.2,
          towardB: 0.6, responsiveSpeaker: 'a',
        }); // re-frame the CLOSED-UP pair — his face, inside the tent
        jac.char.play('talk'); // the offering gesture
        await wait(420);
        ctx.joseph.setCoat(true);       // the tunic settles over his shoulders
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
      { t: 'fade', on: true, ms: 300 },
      { t: 'cam', angle: Math.PI * 0.55, target: { x: 0.8, z: -7.6 }, distance: 5.4, height: 1.8, lookHeight: 1.3, duration: 1, awaitMs: false },
      // D13 (Nate): this is the SAME DAY, minutes after the coat — `ominous`
      // is a night palette and read as nightfall. Daytime tension instead.
      { t: 'grade', mood: 'tenseDay', ms: 10 },
      { t: 'sound', key: 'stinger.hatred' },
      // the TENSION music takes over while envy talks (D6: use the real track)
      { t: 'fn', fn: () => { ctx.setMusic('music.ominous_turn'); ctx.npcs.freeze(ctx.cast.judah, true); ctx.npcs.freeze(ctx.cast.reuben, true); } },
      { t: 'fade', on: false, ms: 420 },
      // D11 (Nate): raised further — heads were still clipping the lens here
      shot('judah', 'reuben', { side: 0.45, dist: 3.1, height: 2.15, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'A special tunic for Joseph — so all can see whom father loves most.', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      shot('reuben', 'judah', { side: -0.42, dist: 3.1, height: 2.15, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.reuben.char; }, state: 'talk' },
      { t: 'say', who: 'Reuben', text: 'Not one kind word is left in me for that boy.', color: J.Reuben },
      { t: 'anim', get char() { return ctx.cast.reuben.char; }, state: 'idle' },
      // envy hardens into a low, scornful laugh between them (D8: quiet — it
      // sits UNDER the scene, never on top of it)
      { t: 'sound', key: 'sfx.men_laughing', gain: 0.42 },
      { t: 'fn', fn: async () => { ctx.cast.judah.char.play('talk'); ctx.cast.reuben.char.play('talk'); await wait(1300); ctx.cast.judah.char.play('idle'); ctx.cast.reuben.char.play('idle'); } },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_4 },
      { t: 'verseHide' },
      { t: 'fn', fn: () => { ctx.npcs.freeze(ctx.cast.judah, false); ctx.npcs.freeze(ctx.cast.reuben, false); } },
      // Joseph steps back out into the gold, wearing the coat. D8 state
      // machine: the hatred has BEGUN — the tension score persists from here
      // until the dream; the warm theme does not come back in between.
      { t: 'fade', on: true, ms: 300 },
      { t: 'fn', fn: () => {
        T.group.visible = false;
        ctx.setStage?.('camp');
        jac.pos.x = jacHome.x; jac.pos.z = jacHome.z;
        jac.char.setPosition(jacHome.x, jacHome.z);
        ctx.controller.bounds = ctx.bounds; // back to the camp
        ctx.joseph.setPosition(-8.2, -4.2); // just outside father's tent
        ctx.grading.set('goldenHour');
      } },
      { t: 'camRelease', ms: 1 },
      { t: 'fn', fn: () => ctx.camera.snap() },
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
    ctx.guide.setTargetXZ(0.6, -4.4);
    // (no music change — the D8 state machine holds the tension from the envy
    // scene; the calm dusk theme never sneaks back in between)
    ctx.grading.grade('dusk', 3200);
    ctx.onDusk?.(); // fireflies fade in (wired by the scene)

    // the brothers drift over and sit around the fire WHILE you walk up — the
    // camp settles for the night (they're alive, not waiting on a trigger).
    // D7: they take the FAR (north) arc only — the south side, where the sit
    // prompt lives, stays Joseph's; they face him across the flames.
    const ring = [['judah', 3.5], ['reuben', 4.2], ['simeon', 5.15], ['levi', 5.9]];
    ring.forEach(([k, a]) => {
      const n = ctx.cast[k];
      ctx.npcs.sendTo(n, Math.cos(a) * 1.8, -6 + Math.sin(a) * 1.8, { speed: 1.4 })
        .then((arrived) => {
          if (!arrived || ctx.signal?.aborted) return;
          ctx.npcs.freeze(n, true);
          n.char.turnToward(0 - n.pos.x, -6 - n.pos.z);
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
        getPos: () => ({ x: 0.6, z: -4.4 }), r: 2.6, lift: 0.7,
        when: () => !sat,
        onInteract: async () => {
          if (sat) return;
          sat = true;
          ctx.setInput(false);
          ctx.hud.clearObjective?.();
          ctx.guide.setTarget(null);
          ctx.joseph.turnToward(0.2 - ctx.joseph.position.x, -6 - ctx.joseph.position.z);
          ctx.joseph.play('kneel'); // Joseph sits (Sit_Floor_Idle / kneel fallback)
          // cozy fireside camera settles in as the light dies + sparks rise
          await seq([
            { t: 'letterbox', on: true },
            {
              t: 'cam',
              angle: Math.PI * 0.34,
              target: { x: 0.25, z: -5.7 },
              distance: 3.7,
              height: 1.25,
              lookHeight: 0.85,
              duration: 2600,
              path: 'groupArc',
              arcCenter: { x: 0, z: -6 },
              arcRadius: 5.2,
            },
            { t: 'wait', ms: 1200 },
          ]);
          resolve();
        },
      });
    }));

    // slow-burn hatred, envy moment 3: even in the quiet, they can't let him
    // warm himself in peace — a low mock and a shared laugh (Nate's men_laughing
    // audio). Joseph, stung, rises to sleep alone.
    const jd = ctx.cast.judah, sm = ctx.cast.simeon;
    await seq([
      {
        t: 'cam',
        angle: -Math.PI * 0.62,
        target: { x: 0.4, z: -6.4 },
        distance: 3.4,
        height: 1.35,
        lookHeight: 0.95,
        duration: 1200,
        path: 'groupArc',
        arcCenter: { x: 0, z: -6 },
        arcRadius: 5.2,
      },
      { t: 'fn', fn: () => {
        // (the tension score is already running — the state machine carried it
        // in from the envy scene; nothing restarts here)
        jd.char.turnToward(ctx.joseph.position.x - jd.pos.x, ctx.joseph.position.z - jd.pos.z);
        jd.char.play('talk');
      } },
      // D7 logic fix: no one can call him "dreamer" yet — the dreams come
      // later THIS NIGHT. The jeer mocks what they can see: the coat.
      { t: 'say', who: 'Judah', text: 'There he sits in the tunic father made especially for him.', color: J.Judah },
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
      {
        t: 'cam',
        angle: Math.PI * 0.3,
        target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }),
        distance: 3.2,
        height: 1.55,
        lookHeight: 1.05,
        duration: 1500,
        path: 'groupArc',
        arcCenter: { x: 0, z: -6 },
        arcRadius: 5.2,
      },
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
    ctx.hud.setObjective('Rest in your tent.');
    const rest = { x: -8.6, z: -4.4 };
    ctx.guide.setTargetXZ(rest.x, rest.z);
    ctx.camera.release(1);
    ctx.setInput(true);
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: 'rest-night', label: 'Rest for the night',
        getPos: () => rest, r: 2.3, lift: 1.4,
        when: () => !rested,
        onInteract: async () => {
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
            { t: 'cam', angle: Math.PI * 0.15, target: { x: rest.x - 0.3, z: rest.z - 0.4 }, distance: 3.0, height: 1.15, lookHeight: 0.6, duration: 2400 },
            { t: 'wait', ms: 1200 },
            { t: 'fade', on: true, ms: 1600 }, // sleep — down to black; the dream follows
          ]);
          resolve();
        },
      });
    }));
    // (faded to black, letterbox up — the dream rises straight out of sleep)
  }

  return { herd, report, coat, dusk };
}
