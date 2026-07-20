import { WEB, NARRATION } from '../../data/versesWEB.js';
import { pausableWait } from '../../engine/Sequencer.js';
import { Narrator } from '../../systems/Narrator.js';
import { Audio } from '../../systems/AudioSystem.js';
import { NAME_COLOR } from './cast.js';

// SCENE 1 — the story as DATA + gates (script-writing + storyteller +
// bible-knowledge). Eight beats; the player acts every 15–20s; displayed
// verses are word-perfect WEB; dialogue is human paraphrase that never leaves
// what the text says or implies. Every beat ENTERS by setting its own
// presentation state, so checkpoints can start any beat fresh.
const J = NAME_COLOR;

export function createBeats(ctx) {
  const seq = (steps) => ctx.sequencer.run(steps);
  const wait = (ms) => pausableWait(ms, ctx.isPaused); // honours the pause menu

  // the morning fire the brothers CIRCLE around for the telling. One source of
  // truth so beat 6 (gather), beat 7 (close) and checkpoint-resume agree.
  // D7: ALL ring slots live on the FAR (north) arc — the south side belongs to
  // Joseph and the camera. The brothers face him ACROSS the flames; nobody
  // ever stands in his sitting/talking space or between him and the lens.
  const FIRE = { x: 0, z: -6 };
  const TELL_RING = [['judah', 3.4], ['reuben', 4.15], ['simeon', 5.0], ['levi', 5.75]];
  const ringXZ = (a) => ({ x: FIRE.x + Math.cos(a) * 2.2, z: FIRE.z + Math.sin(a) * 2.2 });

  // Dialogue cinematography: an over-the-shoulder SHOT computed from LIVE
  // positions — camera behind the listener's shoulder, speaker favored on the
  // near third. Alternate `side` sign between cuts to swap shoulders.
  // D9 framing law (Nate): these characters have BIG heads — every dialogue
  // camera keeps more air (dist ≥3.0, raised, looking slightly down) so a
  // skull can never fill the lens or turn its back to it.
  const posOf = (who) => (who === 'joseph' ? ctx.joseph.position : ctx.cast[who].pos);
  const charOf = (who) => (who === 'joseph' ? ctx.joseph : ctx.cast[who].char);
  const shot = (speaker, listener, { side = 0.42, dist = 3.2, height = 1.75, look = 1.25, ms = 850 } = {}) => ({
    t: 'fn',
    fn: async () => {
      const sp = posOf(speaker), li = posOf(listener);
      // the two face each other; the speaker plays the calm talk gesture
      // (never a walk/run cycle) — cutscene facing is always correct.
      charOf(speaker).turnToward(li.x - sp.x, li.z - sp.z);
      charOf(speaker).play('talk');
      charOf(listener).turnToward(sp.x - li.x, sp.z - li.z);
      const a = Math.atan2(sp.x - li.x, sp.z - li.z) + side;
      ctx.camera.cinematicMoveTo({
        angle: a,
        target: { x: sp.x * 0.72 + li.x * 0.28, z: sp.z * 0.72 + li.z * 0.28 },
        distance: dist, height, lookHeight: look, duration: ms,
      });
      await wait(ms * 0.6); // the cut lands as the line starts
    },
  });

  // D9: the TWO-SHOT, computed from LIVE positions at call time — side-on to
  // the pair's axis, raised and looking a touch down, distance scaled to the
  // separation (never under 3.0). Call it AGAIN after anyone moves: the coat
  // gift used a pre-walk framing, and Jacob's walk put the back of his head
  // square in the lens.
  const twoShot = (aWho, bWho, { ms = 1200, distMin = 3.0, distMax = Infinity, height = 2.05, look = 1.05 } = {}) => {
    const a = posOf(aWho), b = posOf(bWho);
    const axis = Math.atan2(b.x - a.x, b.z - a.z);
    const sep = Math.hypot(b.x - a.x, b.z - a.z);
    ctx.camera.cinematicMoveTo({
      angle: axis - Math.PI / 2,
      target: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
      // distMax: INTERIOR shots cap the pull-back so the lens can never
      // back out through the tent shell (D11 — Nate saw the outside)
      distance: Math.min(distMax, Math.max(distMin, sep * 1.35 + 1.6)),
      height, lookHeight: look, duration: ms,
    });
  };

  // ---------- beat 0 · 🕳️ COLD OPEN v4 (D8): the 7 exact shots ---------------
  // 1 march · 2 the edge (clickable betrayal) · 3 the throw · 4 slow-mo fall,
  // camera falling WITH him · 5 the brothers walk home toward a far warm light
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
    const RIM = 2.5;
    const put = (n, x, z) => {
      const dx = x - P.PIT.x, dz = z - P.PIT.z;
      const d = Math.hypot(dx, dz);
      if (d < RIM) { const s = RIM / (d || 1); x = P.PIT.x + dx * s; z = P.PIT.z + dz * s; }
      n.pos.x = x; n.pos.z = z; n.char.setPosition(x, z);
    };
    // interior shots dive below ground — lift the camera's ground-clip for the
    // duration of the open, restore it with the morning (shot 7 reset).
    const baseMinGroundY = ctx.camera.minGroundY;
    ctx.camera.minGroundY = -4.4;

    // Stage the procession behind black, worn in the drained FUTURE filter
    // (vignette + drain — D8: barely any blur; it must never hide the action).
    ctx.futureVignette(true);
    ctx.grading.set('pit');
    // D11 (Nate): the pit plays as NIGHT — the golden sun sprite in the north
    // sky read as a sunrise from the crying shot. Dark until the real morning.
    ctx.sunSprite.visible = false;
    P.group.visible = true;
    P.setSkyLight(1); P.shrinkSkyLight(0);
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
    const place = (k) => {
      const px = from.x + dir.x * k, pz = from.z + dir.z * k;
      ESCORT.forEach(({ n, dx, dz }) => { put(n, px + dx, pz + dz); n.char.turnToward(dir.x, dir.z); });
      ctx.joseph.setPosition(px, pz);
      ctx.joseph.turnToward(dir.x, dir.z);
    };
    place(0);
    ctx.joseph.play('walk');
    B.forEach((n) => n.char.play('walk'));
    let march = null; // the march drives CONCURRENTLY — the group is already
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
          const D = 8600; let e = 0; // a slow, heavy dead-march
          while (e < D) { await wait(50); e += 50; place(Math.min(1, e / D)); }
          marchBed.stop(1.4);
          B.forEach((n) => n.char.play('idle'));
          ctx.joseph.play('idle');
        })();
      } },
      { t: 'wait', ms: 450 },
      { t: 'fade', on: false, ms: 1500 },
      // D9 clarity: this is a glimpse of what is COMING — say so plainly, and
      // HOLD it (D11, Nate's brother was still confused: clearer sub + ~2x the
      // time on screen; the golden morning answers it with 'Present day')
      { t: 'title', heading: 'In the days to come', sub: 'What lies ahead · Genesis 37', holdMs: 4800 },
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
        ctx.camera.cinematicMoveTo({ angle: Math.PI * 0.45, target: g, distance: 4.6, height: 3.1, lookHeight: 0.95, duration: 1100 });
        let a = Math.PI * 0.45, hold = 1100;
        ctx.camera.setPoseDriver((pose, dt) => {
          if ((hold -= dt) > 0) return;            // let the move-in land first
          a += dt * 0.0000933;                     // the same slow prowl, now smooth
          pose.pos.set(g.x - Math.sin(a) * 4.6, 3.1, g.z - Math.cos(a) * 4.6);
          pose.look.set(g.x, 0.95, g.z);
        });
      } },
      { t: 'fn', fn: () => { const sp = posOf('simeon'), li = posOf('joseph'); charOf('simeon').turnToward(li.x - sp.x, li.z - sp.z); charOf('simeon').play('talk'); charOf('joseph').turnToward(sp.x - li.x, sp.z - li.z); } },
      { t: 'say', who: 'Simeon', text: 'Far enough. This is the place.', color: J.Simeon },
      { t: 'fn', fn: () => { charOf('simeon').play('idle'); const sp = posOf('joseph'), li = posOf('judah'); charOf('joseph').turnToward(li.x - sp.x, li.z - sp.z); charOf('joseph').play('talk'); } },
      { t: 'say', who: 'Joseph', text: 'Brothers — please. What have I done to you?', color: J.Joseph },
      { t: 'fn', fn: () => { charOf('joseph').play('idle'); const sp = posOf('judah'), li = posOf('joseph'); charOf('judah').turnToward(li.x - sp.x, li.z - sp.z); charOf('judah').play('talk'); } },
      { t: 'say', who: 'Judah', text: 'Here is your throne, dreamer. Now we shall see what becomes of your dreams.', color: J.Judah },
      { t: 'dialogueHide' },
      // the exchange is over: the prowl stands down, and Joseph falls SILENT —
      // his arms must never keep gesturing into the fall (D9)
      { t: 'fn', fn: () => { ctx.camera.setPoseDriver(null); charOf('judah').play('idle'); ctx.joseph.play('idle'); } },
      // they STRIP the tunic (37:23) — it hangs from Judah's hand
      { t: 'cam', angle: Math.PI * 0.22, target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }), distance: 2.9, height: 1.6, lookHeight: 1.0, duration: 1100 },
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
        B[1].char.play('talk'); B[2].char.play('talk'); // the two who seize him
        if (ctx.joseph.shadowMesh) ctx.joseph.shadowMesh.visible = false;
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
        const jx = jRoot.position.x, jz = jRoot.position.z;
        const H = 340; let e = 0;
        while (e < H) { await wait(40); e += 40; const k = Math.min(1, e / H);
          jRoot.position.y = k * 0.6;
          jRoot.position.x = jx + (P.PIT.x - jx) * k * 0.25;
          jRoot.position.z = jz + (P.PIT.z - jz) * k * 0.25;
        }
        B[1].char.play('idle'); B[2].char.play('idle');
      } },
      // SHOT 4 — CUT: the slow-motion fall. Camera CLOSE ON JOSEPH — it falls
      // and slowly circles WITH him (never the pit edge) as he turns flat onto
      // his back and the ring of daylight shrinks away above. Alone. Sad.
      { t: 'fn', fn: async () => {
        const D = 4600; let e = 0; // D8: slower than the old 3s fall
        ctx.sound('sfx.fall_whoosh'); // soft air rush under the slow-mo
        const x0 = jRoot.position.x, z0 = jRoot.position.z, y0 = jRoot.position.y;
        const a0 = Math.PI * 0.3;
        while (e < D) { await wait(40); e += 40; const k = Math.min(1, e / D);
          jRoot.position.y = y0 - k * (y0 + 3.8);              // → -3.8 (pit floor)
          jRoot.position.x = x0 + (P.PIT.x - x0) * k;
          jRoot.position.z = z0 + (P.PIT.z - z0) * k;
          jRoot.rotation.x = k * (-Math.PI / 2);               // back-first → FACE UP (yaw lives on root.y now)
          P.shrinkSkyLight(k);                                 // daylight closes over him
          ctx.camera.cinematicMoveTo({
            angle: a0 + k * 0.55,                              // a slow drift around the boy
            target: { x: jRoot.position.x, y: jRoot.position.y, z: jRoot.position.z },
            distance: 2.1, height: 0.55, lookHeight: 0.18, duration: 1,
          });
        }
        ctx.sound('sfx.pit_impact'); // the dull earth landing
      } },
      { t: 'wait', ms: 1500 },
      // SHOT 5 — CUT: the brothers walk away SLOWLY toward their camp — a
      // faint warm firelight far ahead where they live; behind them, nothing.
      // Framed from behind so no one ever looks back.
      { t: 'fade', on: true, ms: 500 },
      { t: 'fn', fn: () => {
        ctx.grading.set('ominous');
        P.setCampGlow(1);
        B.forEach((n, i) => { put(n, P.PIT.x + AWAY[i][0], P.PIT.z + AWAY[i][1]); n.char.turnToward(0.95, -0.32); n.char.play('walk'); });
      } },
      { t: 'cam', angle: 1.9, target: { x: P.PIT.x + 6, z: P.PIT.z - 1 }, distance: 7.2, height: 2.2, lookHeight: 1.1, duration: 1, awaitMs: false },
      { t: 'fade', on: false, ms: 700 },
      { t: 'fn', fn: async () => {
        const D = 5200; let e = 0; // slow — no one hurries, no one looks back
        while (e < D) { await wait(50); e += 50; const k = e / D;
          B.forEach((n, i) => put(n, P.PIT.x + AWAY[i][0] + k * 6.5, P.PIT.z + AWAY[i][1] - k * 2.2));
          P.coatProp.position.set(B[1].pos.x + 0.35, 0.85, B[1].pos.z); // Judah carries it off
        }
      } },
      { t: 'wait', ms: 900 },
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
        P.setCampGlow(0);
        jRoot.position.y = 0;
        jRoot.rotation.x = 0;             // back on his feet
        ctx.joseph.play('idle');          // …and standing (he was seated, weeping)
        if (ctx.joseph.shadowMesh) ctx.joseph.shadowMesh.visible = true;
        ctx.joseph.setCoat(false);
        ctx.camera.minGroundY = baseMinGroundY; // ground-clip back on
        // the brothers return to their camp-morning spots, alive again
        B.forEach((n, i) => { n.pos.x = homes[i].x; n.pos.z = homes[i].z; n.char.setPosition(homes[i].x, homes[i].z); n.char.play('idle'); ctx.npcs.freeze(n, false); });
        ctx.controller.bounds = ctx.bounds;
        ctx.joseph.setPosition(-7, -2.5); // by his tent in the camp
        // D11 (Nate: the cut from the gray pit went "way too white"): the
        // morning arrives as a DEEP warm dawn and only eases into full gold
        // across the pan below — a sunrise, not a lightswitch.
        ctx.grading.set('dawn');
        ctx.sunSprite.visible = true;     // the sun returns WITH the morning
        ctx.futureVignette(false);        // NOW — the gloom and drain lift
        ctx.setMusic('music.camp_warm');  // the warm theme rises WITH the morning
        // (the open itself plays in silence — the state machine starts at null)
        ctx.camera.cinematicMoveTo({ angle: Math.PI * 0.9, target: { x: -5, z: -3 }, distance: 14, height: 7, lookHeight: 1, duration: 1 });
      } },
      // D9 (Nate): the open said 'In the days to come' — this card answers it
      // plainly, so every player knows the pit was a glimpse of the future.
      // D11: held longer, matching the opening card's new weight.
      { t: 'title', heading: 'Hebron, Canaan', sub: 'Present day · c. 1898 BC · Genesis 37', holdMs: 4200 },
      { t: 'fade', on: false, ms: 2000 },
      // a slow, beautiful pan across the golden camp; Joseph steps out
      // (12s — long enough that both verses finish inside the glide) while the
      // dawn warms into full gold underneath it
      { t: 'fn', fn: () => { ctx.grading.grade('goldenHour', 9000); } },
      { t: 'cam', angle: Math.PI * 1.1, target: { x: 2, z: -2 }, distance: 12, height: 5.5, lookHeight: 1.3, duration: 12000, awaitMs: false },
      { t: 'verse', verse: WEB.gen_37_1 },
      { t: 'verse', verse: WEB.gen_37_2_short },
      { t: 'verseHide' },
      { t: 'fn', fn: () => { ctx.joseph.turnToward(1, 1); } },
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

    // brothers sneer as you pass the fire (once) — speakers gesture and face
    // him. GATED to this beat (a stale trigger firing during the beat-4 gather
    // froze the ring walkers and re-enabled input inside a cutscene), and the
    // beat won't complete until the sneer dialogue has fully resolved.
    let herdActive = true;
    let sneerBusy = null;
    ctx.interactables.addTrigger({
      id: 'sneer', x: 0.8, z: -6.5, r: 3.4, once: true,
      when: () => herdActive,
      onEnter: () => {
        sneerBusy = (async () => {
          ctx.setInput(false);
          const sim = ctx.cast.simeon, lev = ctx.cast.levi;
          ctx.npcs.freeze(sim, true);
          ctx.npcs.freeze(lev, true);
          const j = ctx.joseph.position;
          sim.char.turnToward(j.x - sim.pos.x, j.z - sim.pos.z);
          sim.char.play('talk');
          await ctx.dialogue.say('Simeon', 'Look — father’s favorite, out among the sheep.', { color: J.Simeon });
          sim.char.play('idle');
          lev.char.turnToward(j.x - lev.pos.x, j.z - lev.pos.z);
          lev.char.play('talk');
          await ctx.dialogue.say('Levi', 'Mind the flock, little brother. It’s all you’re good for.', { color: J.Levi });
          // Levi laughs ALONE at his own jab (the solo laugh file); the shared
          // group laughs are saved for the bigger envy beats.
          sim.char.play('talk'); lev.char.play('talk');
          ctx.sound('sfx.man_laugh', 0.5); // D8: laughs sit under dialogue, quieter
          await wait(1500);
          sim.char.play('idle'); lev.char.play('idle');
          ctx.dialogue.hide();
          ctx.npcs.freeze(sim, false);
          ctx.npcs.freeze(lev, false);
          if (herdActive) ctx.setInput(true); // never re-arm input inside a later beat
        })();
      },
    });

    let done;
    const all = new Promise((r) => { done = r; });
    ctx.onStrayPenned = (n) => {
      ctx.hud.flashCount('🐑', n, 3);
      if (n < 3) {
        ctx.hud.setObjective(`Bring the stray sheep to the pen — ${n} of 3.`, 'Walk up behind a sheep — it runs ahead of you.');
        const s = ctx.sheep.nearestStray(ctx.joseph.position.x, ctx.joseph.position.z);
        if (s) ctx.guide.setTargetXZ(s.x, s.z);
      } else done();
    };
    // point at the first stray
    const first = ctx.sheep.nearestStray(ctx.joseph.position.x, ctx.joseph.position.z);
    if (first) ctx.guide.setTargetXZ(first.x, first.z);
    if (ctx.sheep.straysLeft === 0) done(); // checkpoint-resume safety
    await all;
    if (sneerBusy) await sneerBusy; // never hand off to beat 2 mid-dialogue
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
          await ctx.dialogue.say('Jacob', 'I hear you. You have done well to tell me.', { color: J.Jacob });
          await ctx.dialogue.say('Jacob', 'Come inside — I have something for you.', { color: J.Jacob });
          ctx.dialogue.hide();
          jac.char.play('idle');
          resolve();
        },
      });
    });
  }

  // ---------- beat 3 · 🧥 THE COAT (inside Jacob's lamplit tent) ----------
  async function coat() {
    const jac = ctx.cast.jacob;
    const T = ctx.tentInterior;
    ctx.setInput(false);
    ctx.npcs.freeze(jac, true);
    const jacHome = { x: jac.pos.x, z: jac.pos.z };
    await seq([
      { t: 'letterbox', on: true },
      // step inside with father — dip to black, come up in lamplight
      { t: 'fade', on: true, ms: 750 },
      { t: 'fn', fn: () => {
        T.group.visible = true;
        ctx.grading.set('tentWarm');
        // bounds travel with the stage (the clamp runs even with input off)
        ctx.controller.bounds = { minX: T.POS.x - 3.4, maxX: T.POS.x + 3.4, minZ: T.POS.z - 3.4, maxZ: T.POS.z + 3.4 };
        jac.pos.x = T.POS.x - 0.8; jac.pos.z = T.POS.z - 0.5;
        jac.char.setPosition(jac.pos.x, jac.pos.z);
        ctx.joseph.setPosition(T.POS.x + 1.0, T.POS.z + 0.9);
        jac.char.turnToward(ctx.joseph.position.x - jac.pos.x, ctx.joseph.position.z - jac.pos.z);
        ctx.joseph.turnToward(jac.pos.x - ctx.joseph.position.x, jac.pos.z - ctx.joseph.position.z);
        ctx.camera.cinematicMoveTo({ angle: -Math.PI * 0.3, target: { x: T.POS.x, z: T.POS.z }, distance: 3.3, height: 1.5, lookHeight: 1.15, duration: 1 });
      } },
      { t: 'fade', on: false, ms: 1000 },
      { t: 'fn', fn: () => { jac.char.play('talk'); } },
      shot('jacob', 'joseph', { side: 0.42, dist: 2.6 }),
      { t: 'say', who: 'Jacob', text: 'Joseph. Come, stand in the lamplight.', color: J.Jacob },
      shot('jacob', 'joseph', { side: -0.4, dist: 2.4 }),
      { t: 'say', who: 'Jacob', text: 'You came to me in my old age, my son — a gift I did not look for.', color: J.Jacob },
      shot('jacob', 'joseph', { side: 0.38, dist: 2.3 }),
      { t: 'say', who: 'Jacob', text: 'I had this made for you. Let all of Hebron see it.', color: J.Jacob },
      { t: 'dialogueHide' },
      // THE GIFT (D9 framing law): a SIDE two-shot from LIVE positions —
      // and recomputed AFTER Jacob walks over (the old pre-walk framing left
      // the back of his head square in the lens once he'd crossed the room).
      // D11: distance capped + a touch lower — the lens stays INSIDE the tent.
      { t: 'fn', fn: () => twoShot('jacob', 'joseph', { ms: 1500, distMax: 3.4, height: 1.8 }) },
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
        twoShot('jacob', 'joseph', { ms: 900, distMax: 3.2, height: 1.75 }); // re-frame the CLOSED-UP pair (still inside the tent)
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
        const T2 = 2100; let e = 0;
        while (e < T2) { await wait(50); e += 50;
          const a = j0 + (e / T2) * Math.PI * 2;
          ctx.joseph.turnToward(Math.sin(a), Math.cos(a));
        }
        await wait(500);
      } },
      // …then the cut BEHIND him: the banded diamonds held clear on the BACK.
      { t: 'fn', fn: async () => {
        const j = ctx.joseph.position;
        const a = Math.atan2(j.x - jac.pos.x, j.z - jac.pos.z);
        ctx.camera.cinematicMoveTo({ angle: a, target: { x: j.x, z: j.z }, distance: 2.3, height: 1.55, lookHeight: 1.1, duration: 1400 });
        await wait(2800);
      } },
      { t: 'verse', verse: WEB.gen_37_3 },
      { t: 'verseHide' },
      // outside, across the camp, the brothers watch the tent — dip-to-black
      // CUT (cutscene-director: clean transitions, never a glide through walls)
      { t: 'fade', on: true, ms: 300 },
      { t: 'cam', angle: Math.PI * 0.55, target: { x: 0.8, z: -7.6 }, distance: 5.4, height: 1.8, lookHeight: 1.3, duration: 1, awaitMs: false },
      { t: 'grade', mood: 'ominous', ms: 10 },
      { t: 'sound', key: 'stinger.hatred' },
      // the TENSION music takes over while envy talks (D6: use the real track)
      { t: 'fn', fn: () => { ctx.setMusic('music.ominous_turn'); ctx.npcs.freeze(ctx.cast.judah, true); ctx.npcs.freeze(ctx.cast.reuben, true); } },
      { t: 'fade', on: false, ms: 420 },
      // D11 (Nate): raised further — heads were still clipping the lens here
      shot('judah', 'reuben', { side: 0.45, dist: 3.1, height: 2.15, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'A prince’s tunic… while we wear the dust of his father’s fields.', color: J.Judah },
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
      ctx.npcs.sendTo(n, Math.cos(a) * 1.8, -6 + Math.sin(a) * 1.8, { speed: 1.4 }).then(() => {
        ctx.npcs.freeze(n, true);
        n.char.turnToward(0 - n.pos.x, -6 - n.pos.z);
        n.char.play('kneel'); // Sit_Floor_Idle — seated by the firelight
      });
    });

    // the campfire beat's ONE action: the player chooses to sit down too. The
    // prompt is gated to THIS beat (when: !sat) — Interactables has no removal,
    // and an ungated sit-fire prompt re-fired in beat 6 when the player walked
    // back through the fire (a softlock).
    let sat = false;
    await new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: 'sit-fire', label: 'Sit by the fire',
        getPos: () => ({ x: 0.6, z: -4.4 }), r: 2.6, lift: 0.7,
        when: () => !sat,
        onInteract: async () => {
          if (sat) return;
          sat = true;
          ctx.setInput(false);
          ctx.guide.setTarget(null);
          ctx.joseph.turnToward(0.2 - ctx.joseph.position.x, -6 - ctx.joseph.position.z);
          ctx.joseph.play('kneel'); // Joseph sits (Sit_Floor_Idle / kneel fallback)
          // cozy fireside camera settles in as the light dies + sparks rise
          await seq([
            { t: 'letterbox', on: true },
            { t: 'cam', angle: Math.PI * 0.34, target: { x: 0.25, z: -5.7 }, distance: 3.7, height: 1.25, lookHeight: 0.85, duration: 2600 },
            { t: 'wait', ms: 1200 },
          ]);
          resolve();
        },
      });
    });

    // slow-burn hatred, envy moment 3: even in the quiet, they can't let him
    // warm himself in peace — a low mock and a shared laugh (Nate's men_laughing
    // audio). Joseph, stung, rises to sleep alone.
    const jd = ctx.cast.judah, sm = ctx.cast.simeon;
    await seq([
      { t: 'cam', angle: -Math.PI * 0.62, target: { x: 0.4, z: -6.4 }, distance: 3.4, height: 1.35, lookHeight: 0.95, duration: 1200 },
      { t: 'fn', fn: () => {
        // (the tension score is already running — the state machine carried it
        // in from the envy scene; nothing restarts here)
        jd.char.turnToward(ctx.joseph.position.x - jd.pos.x, ctx.joseph.position.z - jd.pos.z);
        jd.char.play('talk');
      } },
      // D7 logic fix: no one can call him "dreamer" yet — the dreams come
      // later THIS NIGHT. The jeer mocks what they can see: the coat.
      { t: 'say', who: 'Judah', text: 'Look at him — father’s little prince, warming himself in his fine new coat.', color: J.Judah },
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
      { t: 'cam', angle: Math.PI * 0.3, target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }), distance: 2.6, height: 1.35, lookHeight: 1.05, duration: 1500 },
      { t: 'wait', ms: 1700 },
      { t: 'letterbox', on: false },
    ]);

    // the lonely walk to his tent — the night has turned cold with them, and
    // the music turns SAD. He walks with his head down (a light grief residual
    // rides the walk animation) until he lies down to sleep.
    let rested = false;
    ctx.setMusic('music.sad_night');
    ctx.joseph.setGrief(true, 0.32);
    ctx.hud.setObjective('The night has turned cold with them. Go to your tent and rest.', 'Walk to your tent.');
    const rest = { x: -8.6, z: -4.4 };
    ctx.guide.setTargetXZ(rest.x, rest.z);
    ctx.camera.release(1);
    ctx.setInput(true);
    await new Promise((resolve) => {
      ctx.interactables.addPrompt({
        id: 'rest-night', label: 'Rest for the night',
        getPos: () => rest, r: 2.3, lift: 1.4,
        when: () => !rested,
        onInteract: async () => {
          if (rested) return;
          rested = true;
          ctx.setInput(false);
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
    });
    // (faded to black, letterbox up — the dream rises straight out of sleep)
  }

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
      // EYES OPENING into the dream (D6): a short lift of the black, then a
      // LONG blur-to-clear — the field swims into focus like waking inside it.
      { t: 'fade', on: false, ms: 600 },
      { t: 'fn', fn: async () => { ctx.postFX.eyeOpen(3400); await wait(2600); } },
      // D8: PRESENT-moment narration ONLY — spoken, no verse card, no
      // foreshadowing. (Gen 37:5's card now lands at the campfire telling,
      // where the telling actually happens.)
      { t: 'fn', fn: async () => {
        ctx.hud.emote('Joseph is dreaming');
        const line = Narrator.speak(NARRATION.dream_begins.text, NARRATION.dream_begins.vo);
        await ctx.cinema.titleCard({ heading: 'That night', sub: 'Joseph began to dream', holdMs: 2400 });
        await line;
      } },
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
    await new Promise((resolve) => {
      ctx.interactables.addTrigger({ id: 'summit-reach', x: base.x, z: base.z, r: 2.8, once: true, onEnter: resolve });
    });
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
        let k = 0;
        while (k < 1) { await wait(50); k = Math.min(1, k + 50 / 1900); D.showSky(k); }
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

  // ---------- beat 6 · 😠 tell the brothers ----------
  async function tell() {
    const jac = ctx.cast.jacob;
    // the player WALKS over to the brothers first (evening) — the dream beat set
    // the objective + guide; on a fresh checkpoint resume, set them here too.
    ctx.setInput(true);
    if (!/tell/i.test(ctx.hud.objectiveEl.textContent)) {
      ctx.hud.setObjective('Go and tell your brothers your dream.', 'Walk to your brothers by the fire.');
      ctx.guide.setTargetXZ(0.8, -6.6);
    }
    await new Promise((resolve) => {
      ctx.interactables.addTrigger({ id: 'reach-brothers', x: 0.8, z: -6.4, r: 3.2, once: true, onEnter: resolve });
    });
    ctx.guide.setTarget(null);
    ctx.setInput(false);
    ctx.grading.grade('goldenHour', 500); // the morning after the dream

    // the brothers CIRCLE UP around the morning fire to hear him (Task 9). They
    // walk in under the letterbox, then sit facing the centre — a real ring.
    await seq([
      { t: 'letterbox', on: true },
      { t: 'cam', angle: Math.PI * 0.62, target: { x: 0.4, z: -6.2 }, distance: 6.6, height: 3.1, lookHeight: 1.3, duration: 1500, awaitMs: false },
    ]);
    await Promise.all(TELL_RING.map(([k, a]) => {
      const n = ctx.cast[k];
      const p = ringXZ(a);
      // walk them in; then SNAP to the exact ring slot so a brother the fire-pit
      // blocked can't leave the circle lopsided (invisible under the letterbox).
      return ctx.npcs.sendTo(n, p.x, p.z, { speed: 1.7 }).then(() => {
        n.char.setPosition(p.x, p.z); n.pos.x = p.x; n.pos.z = p.z;
        ctx.npcs.freeze(n, true);
        n.char.turnToward(FIRE.x - p.x, FIRE.z - p.z);
        n.char.play('kneel'); // seated round the fire, facing the centre
      });
    }));
    // Jacob steps in to preside just outside the ring
    await ctx.npcs.sendTo(jac, -2.6, -4.4, { speed: 1.4 });
    jac.char.setPosition(-2.6, -4.4); jac.pos.x = -2.6; jac.pos.z = -4.4;
    ctx.npcs.freeze(jac, true);
    jac.char.turnToward(FIRE.x - jac.pos.x, FIRE.z - jac.pos.z);
    ctx.joseph.setPosition(0.9, -4.1);
    ctx.joseph.turnToward(FIRE.x - 0.9, FIRE.z + 4.1);

    // the telling — establish the CIRCLE wide, then cut to whoever speaks
    await seq([
      { t: 'cam', angle: Math.PI * 0.55, target: { x: 0.3, z: -5.7 }, distance: 5.7, height: 2.7, lookHeight: 1.2, duration: 1600 },
      { t: 'fn', fn: () => { ctx.joseph.play('talk'); } },
      // D11 (Nate): the fire-circle cuts ride higher too — a seated ring plus a
      // standing speaker put heads in every low lane
      shot('joseph', 'judah', { side: 0.4, height: 2.15, look: 1.15 }),
      { t: 'say', who: 'Joseph', text: 'Brothers — hear this dream I dreamed.', color: J.Joseph },
      // "sheaves" explained once, naturally, inside the line (ui-clarity law 2)
      { t: 'say', who: 'Joseph', text: 'We were binding sheaves — bundles of wheat — in the field. Mine arose… and yours bowed down to it.', color: J.Joseph },
      { t: 'dialogueHide' },
      // D8: Gen 37:5 lands HERE — where the telling actually happens — and the
      // camera performs ONE slow orbit of the whole seated circle while the
      // narrator carries it: brothers, father and dreamer all passing in frame.
      { t: 'fn', fn: async () => {
        ctx.joseph.play('talk');
        // D11: the orbit rides the per-frame pose driver — the 50ms polled
        // sweep was Nate's "very very jittery". Same eased ~195° path.
        const a0 = Math.PI * 0.55, RAD = 6.1, H = 2.7, T = 12500;
        ctx.camera.cinematicMoveTo({ angle: a0, target: { x: FIRE.x, z: FIRE.z }, distance: RAD, height: H, lookHeight: 1.15, duration: 1200 });
        await wait(1200);
        let e = 0;
        ctx.camera.setPoseDriver((pose, dt) => {
          e = Math.min(T, e + dt);
          const k = e / T;
          const a = a0 + (k * k * (3 - 2 * k)) * 3.4;
          pose.pos.set(FIRE.x - Math.sin(a) * RAD, H + 0.35, FIRE.z - Math.cos(a) * RAD);
          pose.look.set(FIRE.x, 1.15, FIRE.z);
        });
        await ctx.verseCard.show(WEB.gen_37_5);
        ctx.verseCard.hide();
        while (e < T) await wait(120); // the sweep glides to rest before the first cut
        ctx.camera.setPoseDriver(null);
        ctx.joseph.play('idle');
      } },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'ominous', ms: 1600 },
      // D8: the MOMENT Judah's reply begins, the tension score hits — and it
      // owns the scene from here. (His venom line stays DISTINCT from verse
      // 37:8, which the narrator carries — script-routing rule.)
      { t: 'fn', fn: () => ctx.setMusic('music.ominous_turn') },
      shot('judah', 'joseph', { side: -0.42, dist: 2.6, height: 2.1, look: 1.15 }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'A dreamer of dreams — and a lord of nothing.', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_8 },
      { t: 'verseHide' },
      shot('joseph', 'reuben', { side: 0.44, dist: 2.7, height: 2.15, look: 1.15 }),
      { t: 'fn', fn: () => { ctx.joseph.play('talk'); } },
      { t: 'say', who: 'Joseph', text: 'And again — the sun, the moon, eleven stars… all of them bowed to me.', color: J.Joseph },
      { t: 'fn', fn: () => { ctx.joseph.play('idle'); jac.char.play('talk'); } },
      // Jacob's rebuke — sharp, but the verse 37:10 (narrator) carries his full
      // canonical words; his spoken line does NOT quote it (script-routing rule).
      shot('jacob', 'joseph', { side: -0.4, dist: 2.8, height: 2.1, look: 1.15 }),
      { t: 'say', who: 'Jacob', text: 'Joseph! Enough. You must not speak so — not even of a dream.', color: J.Jacob },
      { t: 'dialogueHide' },
      { t: 'fn', fn: () => { jac.char.play('idle'); } },
      { t: 'verse', verse: WEB.gen_37_10_short },
      { t: 'verseHide' },
      { t: 'wait', ms: 1100 },
      // (brothers stay seated + frozen — the close holds on their envy)
    ]);
  }

  // ---------- beat 7 · 🎬 close: the envy, the lone walk, the tease ----------
  async function close() {
    // ENVY SHOT (37:11): hold on the circle's jealous faces as the light hardens
    await seq([
      { t: 'cam', angle: Math.PI * 0.5, target: { x: 0.2, z: -6.6 }, distance: 3.5, height: 1.75, lookHeight: 1.3, duration: 2200 },
      { t: 'grade', mood: 'ominous', ms: 2000 },
      { t: 'verse', verse: WEB.gen_37_11 },
      { t: 'wait', ms: 1300 },
      { t: 'verseHide' },
    ]);
    // Joseph turns and walks back ALONE — SLOWLY, head down, and SMOOTH (D8:
    // the old loop stepped him in 50ms-quantized jumps, the visible chop Nate
    // called out; scriptMoveTo drives him through the controller's own
    // per-frame eased movement instead).
    const lone = { x: -4.6, z: -2.0 };
    ctx.joseph.turnToward(lone.x - ctx.joseph.position.x, lone.z - ctx.joseph.position.z);
    await seq([
      // a wide, lonely frame — Joseph small, the seated circle left behind him
      { t: 'cam', angle: Math.PI * 0.9, target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }), distance: 6.4, height: 3.1, lookHeight: 1.2, duration: 3200, awaitMs: false },
      { t: 'fn', fn: async () => {
        ctx.joseph.setGrief(true, 0.42); // it's all on his shoulders
        ctx.hud.emote('Joseph is sad');
        await ctx.controller.scriptMoveTo(lone.x, lone.z, 1.15); // a slow trudge
        ctx.joseph.play('idle');
      } },
    ]);
    // hold on him alone, then dip to the tease
    await seq([
      { t: 'cam', angle: Math.PI * 0.95, target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }), distance: 4.4, height: 2.1, lookHeight: 1.3, duration: 2000 },
      { t: 'wait', ms: 900 },
      { t: 'grade', mood: 'goldenHour', ms: 2200 },
      { t: 'fade', on: true, ms: 1800 },
      { t: 'fn', fn: () => ctx.joseph.setGrief(false) },
      { t: 'title', heading: 'To be continued', sub: 'Genesis 37:12 — the road to Dothan', holdMs: 4200 },
    ]);
    ctx.finish?.();
  }

  // ---------- checkpoint resume: enter beat N fresh ----------
  function applyState(n, c) {
    // world/story state that earlier beats would have produced
    if (n >= 2) c.sheep.sheep.forEach((s) => { if (!s.counted) { s.counted = true; s.penned = true; s.x = c.camp.pen.minX + 2 + Math.random() * 3; s.z = c.camp.pen.minZ + 1.5 + Math.random() * 3; } });
    if (n >= 4) c.joseph.setCoat(true);
    const spawns = { 1: [2, 12.5], 2: [1, 1.5], 3: [-8.2, -4.6], 4: [-7.5, -4], 5: [1.4, -4.6], 6: [-6, -3], 7: [0.9, -4.1] };
    const s = spawns[n] || [0, 12];
    c.joseph.setPosition(s[0], s[1]);
    c.camera.snap();
    // resuming INTO the close (beat 7): the telling already happened, so seat the
    // brothers in their frozen circle round the fire (beat 6 does this live).
    if (n >= 7) {
      TELL_RING.forEach(([k, a]) => {
        const npc = c.cast[k]; const p = ringXZ(a);
        npc.char.setPosition(p.x, p.z); npc.pos.x = p.x; npc.pos.z = p.z;
        c.npcs.freeze(npc, true);
        npc.char.turnToward(FIRE.x - p.x, FIRE.z - p.z);
        npc.char.play('kneel');
      });
      const jc = c.cast.jacob;
      jc.char.setPosition(-2.6, -4.4); jc.pos.x = -2.6; jc.pos.z = -4.4;
      c.npcs.freeze(jc, true);
      jc.char.turnToward(FIRE.x + 2.6, FIRE.z + 4.4);
    }
    // beat 5 (dream) sets its own night/dream grade on entry; beats 6-7 (the
    // telling) now happen the NEXT MORNING (Task 8 wakes in the tent at dawn).
    c.grading.set('goldenHour');
  }

  return { list: [intro, herd, report, coat, dusk, dream, tell, close], applyState };
}

function pointToGate(pen) {
  return { x: pen.minX + 0.6, z: (pen.gate.z0 + pen.gate.z1) / 2 };
}
