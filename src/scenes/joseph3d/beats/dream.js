import { WEB, NARRATION } from '../../../data/versesWEB.js';
import { Narrator } from '../../../systems/Narrator.js';
import { isAbortError } from '../../../core/async.js';

// SCENE 1 — Joseph, Genesis 37:1–11. The story is DATA + gates; this act's
// beats are plain async functions over the shared scene context (`ctx`) and the
// shot helpers (`h`). Split out of the old single beats.js (D14) so each act of
// the story is its own file — see ./index.js for the running order.
// ACT 2 — THE DREAM (Gen 37:7, 37:9): the wheat field, the climb, and the
// summit where the sky bows. NOTE: the finale descent is signed off by Nate
// ("PERFECT! dont touch it more") — do not restage it.
export function makeDreamBeat(ctx, h) {
  const { seq, wait, gate } = h;

  // ---------- beat 5 · 💤 THE DREAM ----------
  async function dream() {
    const D = ctx.dream;
    ctx.setInput(false);
    // we arrive already asleep in the dark (beat 4 faded to black at the tent).
    // deepen to night behind the black, swap to the dream music, then slip in.
    await seq([
      { t: 'letterbox', on: true },
      { t: 'fade', on: true, ms: 1 }, // ensure black on a checkpoint-resume too
      { t: 'grade', mood: 'night', ms: 1400 },
      { t: 'fn', fn: async () => { ctx.setMusic('music.dream_wonder'); ctx.sound('stinger.dream_enter'); await wait(500); } },
    ]);
    // slip into the dream field (behind the black). The campfire beat left the
    // camera HOLDING its authored ring shot — release the pose or the whole
    // dream plays on a camera locked 60u away (the review's softlock finding).
    D.group.visible = true;
    D.resetSky();
    ctx.joseph.setPosition(D.FIELD.x, D.FIELD.z + 9);
    ctx.controller.bounds = { minX: D.FIELD.x - 13, maxX: D.FIELD.x + 13, minZ: D.FIELD.z - 13, maxZ: D.FIELD.z + 13 };
    ctx.camera.release(1);
    ctx.camera.snap();
    await seq([
      { t: 'grade', mood: 'dream', ms: 30 },
      { t: 'fn', fn: () => { D.showMoon(1); ctx.postFX.setFilter('dream', 1800); } },
      // EYES OPENING into the dream. D13 (Nate: "the intro to that dream seems
      // a little choppy, and laggy") — three real causes, all fixed:
      //   1. the blur was SET AFTER the black lifted, so the frame snapped
      //      clear→blurred in one jump; it now starts UNDER the black and the
      //      reveal shows it already clearing.
      //   2. the reveal fade fired a competing blur PULSE that stomped the
      //      ramp mid-flight — suppressed with `pulse: false`.
      //   3. a 14px full-canvas blur is the most expensive thing this game can
      //      ask a compositor for (power-efficiency kill-list); 5px reads the
      //      same at this scale and costs a fraction.
      { t: 'fn', fn: () => ctx.postFX.eyeOpen(2600) },
      { t: 'fade', on: false, ms: 900, pulse: false },
      { t: 'wait', ms: 1500 },
      // D8: PRESENT-moment narration ONLY — spoken, no verse card, no
      // foreshadowing. (Gen 37:5's card now lands at the campfire telling,
      // where the telling actually happens.)
      { t: 'fn', fn: async () => {
        ctx.hud.emote('Joseph is dreaming');
        const line = Narrator.speak(NARRATION.dream_begins.text, NARRATION.dream_begins.vo, { signal: ctx.signal });
        line.catch((e) => { if (!isAbortError(e)) console.error('[dream narration]', e); });
        await ctx.cinema.titleCard({ heading: 'That night', sub: 'Joseph began to dream', holdMs: 2400 });
        await line;
      } },
      { t: 'letterbox', on: false },
      { t: 'objective', text: 'Walk to each bundle of wheat.' },
    ]);
    ctx.setInput(true);

    // each sheaf bows as Joseph draws near
    let bowed = 0;
    const allBowed = gate(() => new Promise((resolve) => {
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
    }));
    ctx.guide.setTargetXZ(D.outer[0].position.x, D.outer[0].position.z);
    await allBowed;
    ctx.guide.setTarget(null);
    ctx.sound('ui.chime');
    await ctx.hud.completeObjective('Every bundle of wheat bowed!'); // D9: let it land

    // dream 1 answered (the field). A MOUNTAIN looms in the north — the dreamer
    // climbs it. (short playable ascent → the summit where the sky bows)
    await seq([
      { t: 'objective', text: '' },
      { t: 'verse', verse: WEB.gen_37_7 },
      { t: 'verseHide' },
    ]);
    ctx.hud.setObjective('A mountain rises in the north. Climb to its summit.', 'Follow the glowing stones up the slope.');
    const base = { x: D.FIELD.x, z: D.FIELD.z - 11.5 };
    ctx.guide.setTargetXZ(base.x, base.z);
    ctx.setInput(true);
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addTrigger({ id: 'summit-reach', x: base.x, z: base.z, r: 2.8, once: true, onEnter: resolve });
    }));
    ctx.guide.setTarget(null);
    ctx.setInput(false);

    // DREAM 2 — the SUMMIT where the sky bows (Gen 37:9). Dip to black, lift the
    // dreamer onto the peak above a sea of cloud; the sun/moon/11 stars descend
    // and bow across authored cuts — a true summit silhouette.
    const SY = D.SUMMIT_Y;
    await seq([
      { t: 'letterbox', on: true },
      { t: 'fade', on: true, ms: 900 },
    ]);
    D.showSummit(true);
    D.showSky(0);
    ctx.joseph.setPosition(D.FIELD.x, D.FIELD.z);
    ctx.joseph.root.position.y = SY;           // stand on the peak (input is off)
    ctx.joseph.turnToward(0, -1);              // face north, into the sky
    ctx.joseph.play('idle');
    // THE FINALE (D9 — Nate's shots, exactly): the camera sits MUCH behind
    // Joseph, low and fixed, facing UP — he is not in frame. The sun, moon and
    // eleven stars appear high ahead and bow — descending but staying HIGH in
    // the sky, in the distance, facing him. As they lower, the camera's gaze
    // comes down with them: first his silhouette enters, then his FULL body
    // standing on the flat peak with the bodies bowing in front of him, still
    // high — and there the camera STOPS. A held, still, final frame.
    const CAMX = D.FIELD.x, CAMY = SY + 1.15, CAMZ = D.FIELD.z + 6.6;
    const CAMY0 = SY + 4.4; // D11: the camera starts HIGH behind him and comes
    // DOWN with the stars — and the drift orbit is OFF for the whole finale
    // (its slow rotation was why the shot ended "at an angle" instead of
    // dead behind Joseph).
    ctx.camera.setDrift(false);
    ctx.camera.cinematicMoveTo({ angle: Math.PI, target: { x: CAMX, y: SY, z: D.FIELD.z - 6 }, distance: 12.6, height: CAMY0 - SY, lookHeight: 14, duration: 1 });
    ctx.camera.snap();
    await seq([
      // the sky, briefly alone — then the bodies KINDLE, fading up out of the
      // dark (D11: they used to pop in fully lit)
      { t: 'fade', on: false, ms: 1100 },
      { t: 'fn', fn: async () => {
        ctx.sound('stinger.dream_enter');
        await ctx.motion.tween(1900, (k) => D.showSky(k));
        await wait(1200);
      } },
      // the descent — the camera AND the gaze come down WITH the lights,
      // per-frame smooth on the pose driver (the old 60ms polled loop was the
      // "choppy" Nate called out), locked dead behind Joseph the whole way
      { t: 'fn', fn: async () => {
        D.descendSky();
        const cy0 = (D.sun.position.y + D.moon.position.y) / 2;
        ctx.camera.setPoseDriver((pose, dt) => {
          const cy = (D.sun.position.y + D.moon.position.y) / 2;
          const prog = Math.min(1, Math.max(0, (cy0 - cy) / Math.max(0.001, cy0 - 9.0)));
          const e = prog * prog * (3 - 2 * prog);  // eased sky progress
          const k = 1 - Math.exp(-dt * 0.0016);    // frame-rate-safe damping
          pose.pos.x = CAMX; pose.pos.z = CAMZ;    // never off-axis
          pose.pos.y += ((CAMY0 + (CAMY - CAMY0) * e) - pose.pos.y) * k;
          pose.look.x = CAMX;
          pose.look.y += (Math.max(cy - 3.1, SY + 2.3) - pose.look.y) * k;
          pose.look.z += ((D.FIELD.z - 8) - pose.look.z) * k;
        });
        await wait(5000);            // they come down from on high…
        D.bowSky(); ctx.sound('sfx.sheaf_bow');
        await wait(6200);            // …and bow — still high, still distant
        // the frame has found him: FULL body on the flat peak, the lights
        // bowed before him. The camera STOPS — completely.
        ctx.camera.setPoseDriver(null);
        const p = ctx.camera.pose;
        if (p) { p.pos.set(CAMX, CAMY, CAMZ); p.look.set(CAMX, SY + 2.3, D.FIELD.z - 8); }
        ctx.camera.setStill(true);   // not even the breathing — a held still
      } },
      { t: 'verse', verse: WEB.gen_37_9 },
      { t: 'verseHide' },
      { t: 'wait', ms: 1400 },
      { t: 'letterbox', on: true }, // (re-arms the drift for the scenes after)
      { t: 'fade', on: true, ms: 1500 },
    ]);
    // 5) WAKE → inside the tent at MORNING; Joseph rises, then steps out to tell
    ctx.postFX.setFilter('none', 1400);        // the dream look lifts with him
    ctx.joseph.root.position.y = 0;            // back down to the ground
    D.group.visible = false;
    D.resetSky();
    const T = ctx.tentInterior;
    T.group.visible = true;
    ctx.grading.set('goldenHour');             // warm morning light in the tent
    ctx.onDawn?.();                            // the night's fireflies fade out
    ctx.controller.bounds = { minX: T.POS.x - 3.4, maxX: T.POS.x + 3.4, minZ: T.POS.z - 3.4, maxZ: T.POS.z + 3.4 };
    ctx.joseph.setPosition(T.POS.x + 0.5, T.POS.z + 0.7);
    ctx.joseph.turnToward(0.3, 1);
    ctx.joseph.play('kneel');                  // still down from sleep
    ctx.camera.cinematicMoveTo({ angle: -Math.PI * 0.3, target: { x: T.POS.x, z: T.POS.z }, distance: 3.2, height: 1.4, lookHeight: 1.0, duration: 1 });
    ctx.camera.snap();
    ctx.setMusic('music.camp_warm');
    await seq([
      { t: 'grade', mood: 'goldenHour', ms: 30 },
      { t: 'fade', on: false, ms: 1500 },      // waking: morning sun through the tent
      { t: 'title', heading: 'The next morning', sub: 'Hebron', holdMs: 2600 },
      { t: 'fn', fn: async () => { ctx.joseph.play('idle'); await wait(900); } }, // rises
      { t: 'letterbox', on: false },
    ]);
    // step out into the golden morning → go tell the brothers
    T.group.visible = false;
    ctx.controller.bounds = ctx.bounds;
    ctx.joseph.setPosition(-8.2, -4.2);
    ctx.joseph.turnToward(1, 0.3);
    ctx.camera.release(1);
    ctx.camera.snap();
    ['judah', 'reuben', 'simeon', 'levi'].forEach((k) => { ctx.npcs.freeze(ctx.cast[k], false); ctx.cast[k].char.play('idle'); });
    ctx.hud.setObjective('Go and tell your brothers your dream.', 'Walk to your brothers.');
    ctx.guide.setTargetXZ(0.8, -6.6);
    ctx.setInput(true);
  }

  return { dream };
}
