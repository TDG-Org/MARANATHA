import { WEB } from '../../../data/versesWEB.js';

// SCENE 1 — Joseph, Genesis 37:1–11. The story is DATA + gates; this act's
// beats are plain async functions over the shared scene context (`ctx`) and the
// shot helpers (`h`). Split out of the old single beats.js (D14) so each act of
// the story is its own file — see ./index.js for the running order.
// ACT 3 — the TELLING and the CLOSE (Gen 37:5, 37:8, 37:10, 37:11).
export function makeTellingBeats(ctx, h) {
  const { seq, wait, J, shot, FIRE, TELL_RING, ringXZ } = h;

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
      // D13: the telling happens in the MORNING and stays there — the light
      // hardens, the day does not end (Nate: "the day quickly goes to dark").
      { t: 'grade', mood: 'tenseDay', ms: 1600 },
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
      { t: 'grade', mood: 'tenseDay', ms: 2000 }, // D13: still morning — the envy is cold, the sky isn't

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

  return { tell, close };
}
