import { WEB } from '../../../data/versesWEB.js';
import { Audio } from '../../../systems/AudioSystem.js';
import { isAbortError } from '../../../core/async.js';
import { BETRAYAL_STRIP_CAMERA } from './helpers.js';

// SCENE 1 — Joseph, Genesis 37:1–11. The story is DATA + gates; this act's
// beats are plain async functions over the shared scene context (`ctx`) and the
// shot helpers (`h`). Split out of the old single beats.js (D14) so each act of
// the story is its own file — see ./index.js for the running order.
// ACT 0 — the COLD OPEN: a flash-forward to the pit (Gen 37:23–24).
export function makeColdOpen(ctx, h) {
  const { seq, wait, J, posOf, charOf } = h;

  // ---------- beat 0 · 🕳️ COLD OPEN v4 (D8): the 7 exact shots ---------------
  // 1 march · 2 the edge (clickable betrayal) · 3 the throw · 4 slow-mo fall,
  // camera falling WITH him · 5 the brothers walk toward a nearby meal/fire
  // · 6 the boy crying alone in the dark · 7 slow black, 2.5s HOLD, morning.
  // REAL rigged cast only (level-layout law 8) — the story runner starts after
  // the GLBs load, so the four named brothers and Joseph play this themselves.
  async function intro() {
    ctx.setInput(false);
    const P = ctx.pit;
    const jRoot = ctx.joseph.root;
    const B = ['reuben', 'judah', 'simeon', 'levi'].map((k) => ctx.cast[k]);
    const homes = B.map((n) => ({ x: n.pos.x, z: n.pos.z }));
    // NOBODY may ever stand over the hole (D8: Reuben's old "ahead" slot put
    // him ON AIR over the shaft) — every brother placement is clamped radially
    // out past the rim. Joseph is moved via jRoot directly and is exempt.
    // Manual cutscene placement bypasses ColliderWorld. Keep each actor's
    // centre beyond the raised lip (~2.57u outer edge) plus its 0.4u capsule.
    const RIM = 3.0;
    const safeBrotherPoint = (x, z) => {
      const dx = x - P.PIT.x, dz = z - P.PIT.z;
      const d = Math.hypot(dx, dz);
      if (d < RIM) { const s = RIM / (d || 1); x = P.PIT.x + dx * s; z = P.PIT.z + dz * s; }
      return { x, z };
    };
    const put = (n, x, z) => {
      const dx = x - P.PIT.x, dz = z - P.PIT.z;
      const d = Math.hypot(dx, dz);
      if (d < RIM) { const s = RIM / (d || 1); x = P.PIT.x + dx * s; z = P.PIT.z + dz * s; }
      n.pos.x = x; n.pos.z = z; n.char.setPosition(x, z);
      if (n.circle) { n.circle.x = x; n.circle.z = z; }
      return { x, z };
    };
    // interior shots dive below ground — lift the camera's ground-clip for the
    // duration of the open, restore it with the morning (shot 7 reset).
    const baseMinGroundY = ctx.camera.minGroundY;
    ctx.camera.minGroundY = -4.4;

    // Stage the procession behind black, worn in the drained FUTURE filter
    // (vignette + drain — D8: barely any blur; it must never hide the action).
    ctx.futureVignette(true);
    ctx.grading.set('pit');
    ctx.setStage?.('pit');
    // D11 (Nate): the pit plays as NIGHT — the golden sun sprite in the north
    // sky read as a sunrise from the crying shot. Dark until the real morning.
    ctx.sunSprite.visible = false;
    P.group.visible = true;
    // D14 (Nate: "a cloud or fog right on top of the well… the camera gets
    // really white"): the sky-light is an 8-unit ADDITIVE disc sitting over the
    // pit mouth — from the raised exchange camera it washed the top third of
    // the frame (+71 sRGB, measured). It belongs to the FALL, where it reads as
    // daylight closing over him, so it stays dark until the throw.
    P.setSkyLight(0); P.shrinkSkyLight(0);
    // …and the CAMP is 60u away and asleep: its ambience (Nate's camp_wind bed
    // carries birdsong, plus the sheep pen) must not play in the wilderness at
    // night. The morning brings it in.
    ctx.setCampAmbience(0, 0.4);
    ctx.joseph.setCoat(true); // in the flash he STILL wears the coat — they strip it (37:23)
    ctx.controller.bounds = { minX: P.PIT.x - 6, maxX: P.PIT.x + 10, minZ: P.PIT.z - 6, maxZ: P.PIT.z + 6 };
    B.forEach((n) => ctx.npcs.freeze(n, true));

    // SHOT 1 — the MARCH: the brothers grouped AROUND Joseph, walking him in.
    // One ahead (rim-side, never over the hole), one at each shoulder, one
    // close behind — no way out of the ring. Everyone on real walk cycles.
    const from = { x: P.PIT.x + 9.2, z: P.PIT.z + 1.7 };
    const to = { x: P.PIT.x + 2.6, z: P.PIT.z + 0.2 };
    const dir = { x: to.x - from.x, z: to.z - from.z };
    const ESCORT = [
      { n: B[0], dx: -1.35, dz: -1.95 }, // reuben ahead, swung to the rim side
      { n: B[1], dx: 0.35, dz: 1.25 },   // judah at his left shoulder
      { n: B[2], dx: 0.45, dz: -1.25 },  // simeon at his right
      { n: B[3], dx: 1.6, dz: 0.55 },    // levi close behind — no turning back
    ];
    const AWAY = [[2.6, 1.2], [3.4, 0.2], [3.0, -1.0], [4.2, 0.8]]; // walk-off spread
    const smooth = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
    const escortTargets = ESCORT.map(({ dx, dz }) => safeBrotherPoint(to.x + dx, to.z + dz));
    const stripTarget = {
      x: (to.x + escortTargets[1].x) / 2,
      z: (to.z + escortTargets[1].z) / 2,
    };
    ESCORT.forEach(({ n, dx, dz }) => {
      put(n, from.x + dx, from.z + dz);
      n.char.turnToward(dir.x, dir.z);
    });
    ctx.joseph.setPosition(from.x, from.z);
    ctx.joseph.turnToward(dir.x, dir.z);
    ctx.joseph.play('walk');
    B.forEach((n) => n.char.play('walk'));
    let march = null;
    let walkStarts = null; // the march drives CONCURRENTLY — the group is already
    // moving when the black lifts (walk cycles must never tread in place)
    await seq([
      { t: 'fade', on: true, ms: 0 },
      { t: 'letterbox', on: true },
      // open TIGHT on the procession — a clean, slow ease-in from black (D8:
      // the old open popped); the group trudges through the near frame
      { t: 'cam', angle: Math.PI * 0.42, target: { x: from.x + dir.x * 0.12, z: from.z + dir.z * 0.12 }, distance: 3.2, height: 1.3, lookHeight: 1.05, duration: 1, awaitMs: false },
      { t: 'fn', fn: () => {
        march = (async () => {
          // five men on dry ground (🔴 slot — silent until Nate's file lands)
          const marchBed = Audio.playLoop('sfx.march_loop', { gain: 0.5 });
          // D15: the controller owns Joseph's real velocity + walk cycle, and
          // AmbientNPCs owns the brothers. The former 50ms teleport loop made
          // the controller see zero movement and force Joseph back to idle.
          B.forEach((n) => ctx.npcs.freeze(n, false));
          try {
            await Promise.all([
              ctx.controller.scriptMoveTo(to.x, to.z, 0.82),
              ...B.map((n, i) => ctx.npcs.sendTo(n, escortTargets[i].x, escortTargets[i].z, { speed: 0.82 })),
            ]);
          } finally {
            ctx.controller.cancelScriptMove();
            ctx.controller.vel.set(0, 0);
            marchBed.stop(1.4);
            if (!ctx.signal?.aborted) {
              B.forEach((n) => { ctx.npcs.freeze(n, true); n.char.play('idle'); });
              ctx.joseph.play('idle');
            }
          }
        })();
        // This starts under the opening fade and is joined several steps
        // later. Observe an early lifetime rejection now so leaving during the
        // title card never creates an unhandled background rejection.
        march.catch((e) => { if (!isAbortError(e)) console.error('[cold-open march]', e); });
      } },
      { t: 'wait', ms: 450 },
      { t: 'fade', on: false, ms: 1500 },
      // D9 clarity: this is a glimpse of what is COMING — say so plainly, and
      // HOLD it (D11, Nate's brother was still confused: clearer sub + ~2x the
      // time on screen; the golden morning answers it with 'Present day')
      { t: 'title', heading: 'In the days to come', sub: 'Genesis 37', holdMs: 4800 },
      // …the frame widens as the march closes on the pit
      { t: 'cam', angle: Math.PI * 0.52, target: { x: to.x + 0.6, z: to.z }, distance: 5.0, height: 1.7, lookHeight: 0.95, duration: 5400, awaitMs: false },
      { t: 'fn', fn: () => march }, // hold until the march lands at the rim
      { t: 'wait', ms: 450 },
      // SHOT 2 — AT THE EDGE: the betrayal. D9 camera (Nate): RAISED and
      // looking DOWN, slowly circling the group while the lines are exchanged.
      // D11: the prowl rides the per-frame pose driver (the 60ms polled loop
      // stepped visibly), and the talk is SMALL — three short lines only
      // (Nate: the invented "no blood" exchange strayed too far; Reuben's
      // canonical plea belongs to the real scene when we build it).
      { t: 'fn', fn: () => {
        const g = { x: to.x - 0.3, z: to.z };
        // D13 (Nate: "the camera goes inside of the brother's heads"): the
        // prowl now flies ABOVE every skull — y 4.2 is more than double head
        // height, so no orbit position can ever intersect a body — and its
        // radius clears the widest brother by ≥2u whatever formation the
        // march ended in (measured from LIVE positions, not assumed).
        const R = Math.max(6.0, ...B.map((n) => Math.hypot(n.pos.x - g.x, n.pos.z - g.z) + 2.2));
        const H = 4.2;
        // …and the GLOOM eases for this cut only: same fog, lit faces (D13).
        ctx.grading.grade('pitTalk', 900);
        ctx.postFX.setFilter('futureSoft', 900);
        ctx.camera.cinematicMoveTo({ angle: Math.PI * 0.45, target: g, distance: R, height: H, lookHeight: 1.0, duration: 1100 });
        let a = Math.PI * 0.45, hold = 1100;
        ctx.camera.setPoseDriver((pose, dt) => {
          if ((hold -= dt) > 0) return;            // let the move-in land first
          a += dt * 0.0000933;                     // the same slow prowl, now smooth
          pose.pos.set(g.x - Math.sin(a) * R, H, g.z - Math.cos(a) * R);
          pose.look.set(g.x, 1.0, g.z);
        });
      } },
      { t: 'fn', fn: () => { const sp = posOf('simeon'), li = posOf('joseph'); charOf('simeon').turnToward(li.x - sp.x, li.z - sp.z); charOf('simeon').play('talk'); charOf('joseph').turnToward(sp.x - li.x, sp.z - li.z); } },
      { t: 'say', who: 'Simeon', text: 'Far enough. This is the place.', color: J.Simeon },
      { t: 'fn', fn: () => { charOf('simeon').play('idle'); const sp = posOf('joseph'), li = posOf('judah'); charOf('joseph').turnToward(li.x - sp.x, li.z - sp.z); charOf('joseph').play('talk'); } },
      { t: 'say', who: 'Joseph', text: 'Brothers — please. What have I done to you?', color: J.Joseph },
      { t: 'fn', fn: () => {
        charOf('joseph').play('idle');
        const li = posOf('joseph');
        B.forEach((brother) => {
          brother.char.turnToward(li.x - brother.pos.x, li.z - brother.pos.z);
          brother.char.play('talk');
        });
      } },
      // Genesis 37:19–20 presents this as the brothers' shared plan; do not
      // assign the collective line to one named brother.
      { t: 'say', who: 'Brothers', text: 'Now we shall see what becomes of his dreams.', color: J.Judah },
      { t: 'dialogueHide' },
      // the exchange is over: the prowl stands down, and Joseph falls SILENT —
      // his arms must never keep gesturing into the fall (D9)
      { t: 'fn', fn: () => {
        ctx.camera.setPoseDriver(null);
        B.forEach((brother) => brother.char.play('idle'));
        ctx.joseph.play('idle');
        // the talking is over — the cold, drained gloom closes back in for the
        // strip, the throw and the fall (D13: it lifted only for the faces)
        ctx.grading.grade('pit', 1200);
        ctx.postFX.setFilter('future', 1200);
      } },
      // Dialogue timing can leave the prowl at any phase. Cover its exit, then
      // reveal one fixed audience-safe angle on Joseph and Judah; no visible
      // replacement chord can pass close behind Reuben.
      { t: 'fade', on: true, ms: 300 },
      {
        t: 'cam',
        ...BETRAYAL_STRIP_CAMERA,
        target: stripTarget,
        duration: 1,
      },
      { t: 'fade', on: false, ms: 420 },
      // they STRIP the tunic (37:23) — it hangs from Judah's hand
      { t: 'fn', fn: async () => {
        B.forEach((n) => n.char.play('idle'));
        ctx.sound('sfx.cloth_equip');
        ctx.joseph.setCoat(false);
        P.coatProp.visible = true;
        P.coatProp.position.set(B[1].pos.x + 0.35, 0.85, B[1].pos.z);
        await wait(1100);
      } },
      // SHOT 3 — THE THROW, from the rim: the dark mouth below, the boy still
      // fully lit as they seize and heave him over the edge.
      { t: 'cam', angle: Math.PI * 0.15, target: { x: P.PIT.x, z: P.PIT.z }, distance: 3.1, height: 2.4, lookHeight: 0.4, duration: 1000 },
      { t: 'fn', fn: async () => {
        ctx.sound('stinger.hatred');
        P.setSkyLight(1); // NOW the mouth of the pit opens above him (D14)
        // Judah and Simeon visibly CLOSE the gap before the lift. Their normal
        // movers provide real walk velocity/foot cycles instead of teleporting.
        const jx = jRoot.position.x, jz = jRoot.position.z;
        const grabs = [
          safeBrotherPoint(jx + 0.18, jz + 0.58),
          safeBrotherPoint(jx + 0.18, jz - 0.58),
        ];
        ctx.joseph.play('talk');
        B[1].char.turnToward(jx - B[1].pos.x, jz - B[1].pos.z);
        B[2].char.turnToward(jx - B[2].pos.x, jz - B[2].pos.z);
        ctx.npcs.freeze(B[1], false); ctx.npcs.freeze(B[2], false);
        await Promise.all([
          ctx.npcs.sendTo(B[1], grabs[0].x, grabs[0].z, { speed: 1.15 }),
          ctx.npcs.sendTo(B[2], grabs[1].x, grabs[1].z, { speed: 1.15 }),
        ]);
        ctx.npcs.freeze(B[1], true); ctx.npcs.freeze(B[2], true);
        B[1].char.play('talk'); B[2].char.play('talk');
        ctx.controller.vel.set(0, 0);
        ctx.contactShadows?.setVisible(ctx.joseph, false);
        ctx.joseph.setAnimPaused(true); // seized — the body goes LIMP and still
        // D11 deterministic FACE-UP landing: move his yaw from the facing child
        // onto the root (order YXZ = yaw first, then pitch in his own frame) —
        // world orientation is IDENTICAL this frame, but now the fall's pitch
        // always tips him onto his BACK regardless of who he was looking at
        // (the old fixed-sign root.rotation.x read face-down at some yaws).
        const yaw0 = ctx.joseph.facing.rotation.y;
        jRoot.rotation.order = 'YXZ';
        jRoot.rotation.y = yaw0;
        ctx.joseph.facing.rotation.y = 0;
        ctx.joseph._yaw = 0; ctx.joseph._targetYaw = 0;
        const bStarts = B.map((n) => ({ x: n.pos.x, z: n.pos.z }));
        const heaveGoals = [
          safeBrotherPoint(P.PIT.x + 2.35, P.PIT.z + 0.76),
          safeBrotherPoint(P.PIT.x + 2.35, P.PIT.z - 0.76),
        ];
        // Brace/lift, lunge over the rim, then release. All positions are
        // driven by the live scene clock, never a timer-polled loop.
        await ctx.motion.tween(1250, (_eased, raw) => {
          const lift = smooth(raw / 0.52);
          const heave = smooth((raw - 0.36) / 0.64);
          jRoot.position.y = 0.82 * lift - 0.08 * heave;
          jRoot.position.x = jx + (P.PIT.x + 1.62 - jx) * heave;
          jRoot.position.z = jz + (P.PIT.z + 0.04 - jz) * heave;
          put(B[1], bStarts[1].x + (heaveGoals[0].x - bStarts[1].x) * heave,
            bStarts[1].z + (heaveGoals[0].z - bStarts[1].z) * heave);
          put(B[2], bStarts[2].x + (heaveGoals[1].x - bStarts[2].x) * heave,
            bStarts[2].z + (heaveGoals[1].z - bStarts[2].z) * heave);
          put(B[0], bStarts[0].x + 0.22 * heave, bStarts[0].z - 0.12 * heave);
          put(B[3], bStarts[3].x + 0.22 * heave, bStarts[3].z + 0.12 * heave);
          P.coatProp.position.set(B[1].pos.x + 0.35, 0.85, B[1].pos.z);
        });
      } },
      // SHOT 4 — CUT: the slow-motion fall. Camera CLOSE ON JOSEPH — it falls
      // and slowly circles WITH him (never the pit edge) as he turns flat onto
      // his back and the ring of daylight shrinks away above. Alone. Sad.
      { t: 'fn', fn: async () => {
        const D = 4600; // D8: slower than the old 3s fall
        ctx.sound('sfx.fall_whoosh'); // soft air rush under the slow-mo
        const x0 = jRoot.position.x, z0 = jRoot.position.z, y0 = jRoot.position.y;
        const a0 = Math.PI * 0.3;
        const recoilStarts = [
          { x: B[1].pos.x, z: B[1].pos.z },
          { x: B[2].pos.x, z: B[2].pos.z },
        ];
        let fallK = 0;
        let followThroughDone = false;
        ctx.camera.cinematicMoveTo({
          angle: a0,
          target: { x: x0, y: y0, z: z0 },
          distance: 2.1, height: 0.55, lookHeight: 0.18, duration: 1,
        });
        ctx.camera.setPoseDriver((pose) => {
          const a = a0 + fallK * 0.55;
          pose.pos.set(
            jRoot.position.x - Math.sin(a) * 2.1,
            jRoot.position.y + 0.55,
            jRoot.position.z - Math.cos(a) * 2.1,
          );
          pose.look.set(jRoot.position.x, jRoot.position.y + 0.18, jRoot.position.z);
        });
        await ctx.motion.tween(D, (k, raw) => {
          fallK = k;
          jRoot.position.y = y0 - k * (y0 + 3.8);              // → -3.8 (pit floor)
          jRoot.position.x = x0 + (P.PIT.x - x0) * k;
          jRoot.position.z = z0 + (P.PIT.z - z0) * k;
          jRoot.rotation.x = k * (-Math.PI / 2);               // back-first → FACE UP (yaw lives on root.y now)
          P.shrinkSkyLight(k);                                 // daylight closes over him
          const recoil = smooth(raw / 0.2);
          put(B[1], recoilStarts[0].x + 0.5 * recoil, recoilStarts[0].z + 0.15 * recoil);
          put(B[2], recoilStarts[1].x + 0.5 * recoil, recoilStarts[1].z - 0.15 * recoil);
          P.coatProp.position.set(B[1].pos.x + 0.35, 0.85, B[1].pos.z);
          if (!followThroughDone && raw >= 0.2) {
            followThroughDone = true;
            B[1].char.play('idle'); B[2].char.play('idle');
          }
        });
        ctx.camera.setPoseDriver(null);
        ctx.sound('sfx.pit_impact'); // the dull earth landing
      } },
      { t: 'wait', ms: 1500 },
      // SHOT 5 — CUT: the brothers walk away SLOWLY toward a nearby fire/meal.
      // Genesis 37:25 says they sat down to eat; it does not say they went
      // home. The scene fades before arrival and makes no stronger claim.
      // Framed from behind so no one ever looks back.
      { t: 'fade', on: true, ms: 500 },
      { t: 'fn', fn: () => {
        ctx.grading.set('ominous');
        P.setMealGlow(1);
        B.forEach((n, i) => { put(n, P.PIT.x + AWAY[i][0], P.PIT.z + AWAY[i][1]); n.char.turnToward(0.95, -0.32); n.char.play('walk'); });
        walkStarts = B.map((n) => ({ x: n.pos.x, z: n.pos.z }));
      } },
      { t: 'cam', angle: 1.9, target: { x: P.PIT.x + 6, z: P.PIT.z - 1 }, distance: 7.2, height: 2.2, lookHeight: 1.1, duration: 1, awaitMs: false },
      { t: 'fade', on: false, ms: 700 },
      { t: 'fn', fn: async () => {
        // D13 (Nate: "they walk then they stop in place"): the walk runs right
        // through the hold and INTO the fade — the old version finished its
        // travel loop and then stood there moon-walking for 900ms. Nobody
        // stops; the black takes them.
        const D = 6100; let fading = false; let exitFade = null; // slow — no one hurries, no one looks back
        await ctx.motion.tween(D, (k, raw) => {
          B.forEach((n, i) => put(n, walkStarts[i].x + k * 7.6, walkStarts[i].z - k * 2.6));
          P.coatProp.position.set(B[1].pos.x + 0.35, 0.85, B[1].pos.z); // Judah carries it off
          // the black starts falling WHILE they are still walking (not after)
          if (!fading && raw > 1 - 700 / D) {
            fading = true;
            exitFade = ctx.cinema.fade(true, 700);
            exitFade.catch((e) => { if (!isAbortError(e)) console.error('[cold-open exit fade]', e); });
          }
        });
        if (exitFade) await exitFade; // observe abort; never leave a rejected fade behind
      } },
      // SHOT 6 — CUT: back down into the dark. The boy has pulled himself up
      // to sitting — head bowed into his knees, shoulders shaking. The verse
      // lands over the sound of a child crying at the bottom of a well.
      { t: 'fade', on: true, ms: 600 },
      { t: 'fn', fn: () => {
        jRoot.rotation.set(0, 0, 0);     // upright again (behind the black)
        jRoot.rotation.order = 'XYZ';    // the fall's yaw-then-pitch order ends here
        jRoot.position.set(P.PIT.x + 0.15, -4.0, P.PIT.z + 0.1);
        ctx.joseph.setAnimPaused(false); // life returns — enough to weep
        ctx.joseph.play('kneel');        // seated on the pit floor
        ctx.joseph.turnToward(0.35, -0.8);
        ctx.joseph.setGrief(true);       // head bows deep; small sobbing hitches
        ctx.sound('sfx.boy_crying');     // 🔴 silent until Nate's file lands (NATE.md)
        // D11 (Nate): the pit is NIGHT-dark — the shrunken sky-disc above him
        // read as a rising sun from this camera; dim it to a faint memory.
        P.setSkyLight(0.16);
        // …and the scene is no longer silent: a quiet GRIEF pad under the
        // crying (real file slot music/pit_sad — see NATE.md).
        ctx.setMusic('music.pit_sad');
        ctx.hud.emote('Joseph is sad');
      } },
      { t: 'cam', angle: -Math.PI * 0.2, target: { x: P.PIT.x, y: -4.0, z: P.PIT.z }, distance: 2.5, height: 1.05, lookHeight: 0.6, duration: 1, awaitMs: false },
      { t: 'fade', on: false, ms: 900 },
      { t: 'wait', ms: 1400 },
      { t: 'verse', verse: WEB.gen_37_24 },
      { t: 'verseHide' },
      { t: 'wait', ms: 3300 }, // hold on the shaking shoulders — let it be sad
      // SHOT 7 — slow fade to black → a PURE BLACK 2.5s hold → golden morning.
      { t: 'fade', on: true, ms: 2200 },
      { t: 'wait', ms: 2500 },
      { t: 'fn', fn: () => {
        ctx.joseph.setGrief(false);
        P.group.visible = false;
        P.coatProp.visible = false;
        P.setMealGlow(0);
        jRoot.position.y = 0;
        jRoot.rotation.x = 0;             // back on his feet
        ctx.joseph.play('idle');          // …and standing (he was seated, weeping)
        ctx.contactShadows?.setVisible(ctx.joseph, true);
        ctx.joseph.setCoat(false);
        ctx.camera.minGroundY = baseMinGroundY; // ground-clip back on
        // the brothers return to their camp-morning spots, alive again
        B.forEach((n, i) => { n.pos.x = homes[i].x; n.pos.z = homes[i].z; n.char.setPosition(homes[i].x, homes[i].z); n.char.play('idle'); ctx.npcs.freeze(n, false); });
        ctx.controller.bounds = ctx.bounds;
        ctx.joseph.setPosition(-7, -2.5); // by his tent in the camp
        ctx.setStage?.('camp');
        // D11 (Nate: the cut from the gray pit went "way too white"): the
        // morning arrives as a DEEP warm dawn and only eases into full gold
        // across the pan below — a sunrise, not a lightswitch.
        ctx.grading.set('dawn');
        ctx.sunSprite.visible = true;     // the sun returns WITH the morning
        ctx.futureVignette(false);        // NOW — the gloom and drain lift
        ctx.setMusic('music.camp_warm');  // the warm theme rises WITH the morning
        ctx.setCampAmbience(1, 3.5);      // …and the camp wakes up with it (D14)
        // (the open itself plays in silence — the state machine starts at null)
        ctx.camera.cinematicMoveTo({ angle: Math.PI * 0.9, target: { x: -5, z: -3 }, distance: 14, height: 7, lookHeight: 1, duration: 1 });
      } },
      // D9 (Nate): the open said 'In the days to come' — this card answers it
      // plainly, so every player knows the pit was a glimpse of the future.
      // D11: held longer, matching the opening card's new weight.
      { t: 'title', heading: 'Hebron, Canaan', sub: 'Present day · Genesis 37', holdMs: 4200 },
      { t: 'fade', on: false, ms: 2000 },
      // a slow, beautiful pan across the golden camp; Joseph steps out
      // (8s — long enough for the opening verse) while the
      // dawn warms into full gold underneath it
      { t: 'fn', fn: () => { ctx.grading.grade('goldenHour', 9000); } },
      { t: 'cam', angle: Math.PI * 1.1, target: { x: 2, z: -2 }, distance: 12, height: 5.5, lookHeight: 1.3, duration: 8000, awaitMs: false },
      { t: 'verse', verse: WEB.gen_37_1 },
      { t: 'verseHide' },
      { t: 'fn', fn: () => { ctx.joseph.turnToward(1, 1); } },
      { t: 'camRelease', ms: 1600 },
      { t: 'letterbox', on: false },
    ]);
    ctx.setInput(true);
  }

  return { intro };
}
