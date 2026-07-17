import { WEB } from '../../data/versesWEB.js';
import { pausableWait } from '../../engine/Sequencer.js';
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

  // Dialogue cinematography: an over-the-shoulder SHOT computed from LIVE
  // positions — camera behind the listener's shoulder, speaker favored on the
  // near third. Alternate `side` sign between cuts to swap shoulders.
  const posOf = (who) => (who === 'joseph' ? ctx.joseph.position : ctx.cast[who].pos);
  const charOf = (who) => (who === 'joseph' ? ctx.joseph : ctx.cast[who].char);
  const shot = (speaker, listener, { side = 0.42, dist = 2.9, height = 1.55, look = 1.3, ms = 850 } = {}) => ({
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

  // ---------- beat 0 · 🕳️ COLD OPEN v2: the betrayal → 🌅 the golden morning --
  async function intro() {
    ctx.setInput(false);
    const P = ctx.pit;
    const jRoot = ctx.joseph.root;

    // THE BETRAYAL — a flash of where this story is going, worn in a drained
    // "future" grade + dark vignette so no one mistakes it for now. Harsh
    // daylight at a rocky pit; the brothers tear off his coat and throw him in.
    ctx.futureVignette(true);
    ctx.grading.set('pit');
    P.group.visible = true;
    P.ringBrothers();
    P.setSkyLight(1); P.shrinkSkyLight(0);
    ctx.joseph.setCoat(true); // in the flash he STILL wears the coat — they rip it off
    ctx.controller.bounds = { minX: P.PIT.x - 4, maxX: P.PIT.x + 4, minZ: P.PIT.z - 4, maxZ: P.PIT.z + 4 };
    ctx.joseph.setPosition(P.PIT.x, P.PIT.z - 0.4);
    ctx.joseph.play('idle');
    ctx.camera.cinematicMoveTo({ angle: Math.PI * 0.12, target: { x: P.PIT.x, z: P.PIT.z }, distance: 6, height: 3.2, lookHeight: 1.2, duration: 1 });
    await seq([
      { t: 'fade', on: true, ms: 0 },
      { t: 'letterbox', on: true },
      { t: 'wait', ms: 500 },
      { t: 'fade', on: false, ms: 1500 }, // reveal: harsh daylight at the pit
      { t: 'wait', ms: 900 },
      // (1) the brothers TEAR OFF the ornate coat
      { t: 'cam', angle: Math.PI * 0.08, target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }), distance: 3.6, height: 1.8, lookHeight: 1.2, duration: 1300 },
      { t: 'fn', fn: async () => { ctx.sound('sfx.cloth_equip'); ctx.joseph.setCoat(false); await wait(650); } },
      // (2) thrown in — SLOW-MO fall into the dark, the light closing above
      { t: 'cam', angle: Math.PI * 0.08, target: { x: P.PIT.x, z: P.PIT.z }, distance: 5.4, height: 6.2, lookHeight: -1.6, duration: 1500 },
      { t: 'fn', fn: async () => {
        ctx.sound('stinger.hatred');
        const D = 2200; let e = 0;
        while (e < D) { await wait(50); e += 50; const k = e / D;
          jRoot.position.y = -k * 3.2;                       // the fall
          jRoot.position.x += (P.PIT.x - jRoot.position.x) * 0.12;
          jRoot.position.z += (P.PIT.z - jRoot.position.z) * 0.12;
          P.shrinkSkyLight(k);                                // light shrinks above
        }
      } },
      { t: 'verse', verse: WEB.gen_37_24 },
      { t: 'verseHide' },
      // (3) cut: the brothers walking away, coat in hand. cold.
      { t: 'fade', on: true, ms: 500 },
      { t: 'fn', fn: () => { jRoot.position.y = -3.2; P.walkAway(0); ctx.grading.set('ominous'); } },
      { t: 'cam', angle: Math.PI * 0.95, target: { x: P.PIT.x + 3.5, z: P.PIT.z - 1 }, distance: 6.5, height: 2.2, lookHeight: 1.2, duration: 1, awaitMs: false },
      { t: 'fade', on: false, ms: 650 },
      { t: 'fn', fn: async () => { const D = 2400; let e = 0; while (e < D) { await wait(60); e += 60; P.walkAway(e / D); } } },
      { t: 'wait', ms: 500 },
      // (4) slow fade to black → the drained "future" look LIFTS as morning comes
      { t: 'fade', on: true, ms: 1600 },
      { t: 'fn', fn: () => {
        P.group.visible = false;
        jRoot.position.y = 0;
        ctx.joseph.setCoat(false);
        ctx.controller.bounds = ctx.bounds;
        ctx.joseph.setPosition(-7, -2.5); // by his tent in the camp
        ctx.grading.set('goldenHour');
        ctx.futureVignette(false);        // NOW — the desaturate + border lift
        ctx.camera.cinematicMoveTo({ angle: Math.PI * 0.9, target: { x: -5, z: -3 }, distance: 14, height: 7, lookHeight: 1, duration: 1 });
      } },
      { t: 'title', heading: 'Hebron, Canaan', sub: 'The next morning · c. 1898 BC · Genesis 37', holdMs: 3200 },
      { t: 'fade', on: false, ms: 1800 },
      // (5) a slow, beautiful pan across the golden camp; Joseph steps out
      { t: 'cam', angle: Math.PI * 1.1, target: { x: 2, z: -2 }, distance: 12, height: 5.5, lookHeight: 1.3, duration: 9000, awaitMs: false },
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
          // a shared, mocking laugh — the slow burn of their scorn begins
          sim.char.play('talk'); lev.char.play('talk');
          ctx.sound('sfx.men_laughing');
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
    if (sneerBusy) await sneerBusy; // never hand off to beat 2 mid-dialogue
    herdActive = false;
    ctx.onStrayPenned = null;
    ctx.guide.setTarget(null);
    ctx.sound('ui.chime');
    await wait(900);
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
      // the gift — a CLOSE, clear push-in on Joseph's shoulders so the player
      // plainly SEES the tunic go on (D5: tighter framing + a longer hold).
      { t: 'cam', angle: -Math.PI * 0.5, target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }), distance: 1.75, height: 1.35, lookHeight: 1.4, duration: 1500 },
      { t: 'fn', fn: async () => {
        await wait(300);
        ctx.joseph.setCoat(true);       // the tunic settles ON — held in close-up
        ctx.sound('sfx.cloth_equip');
        ctx.sound('stinger.coat_gift');
        ctx.sparkle(4);
        jac.char.play('idle');
        await wait(1800);
      } },
      { t: 'verse', verse: WEB.gen_37_3 },
      { t: 'verseHide' },
      // outside, across the camp, the brothers watch the tent — dip-to-black
      // CUT (cutscene-director: clean transitions, never a glide through walls)
      { t: 'fade', on: true, ms: 300 },
      { t: 'cam', angle: Math.PI * 0.55, target: { x: 0.8, z: -7.6 }, distance: 5.4, height: 1.8, lookHeight: 1.3, duration: 1, awaitMs: false },
      { t: 'grade', mood: 'ominous', ms: 10 },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'fn', fn: () => { ctx.npcs.freeze(ctx.cast.judah, true); ctx.npcs.freeze(ctx.cast.reuben, true); } },
      { t: 'fade', on: false, ms: 420 },
      shot('judah', 'reuben', { side: 0.45, dist: 3.1 }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'A prince’s tunic… while we wear the dust of his father’s fields.', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      shot('reuben', 'judah', { side: -0.42, dist: 3.1 }),
      { t: 'anim', get char() { return ctx.cast.reuben.char; }, state: 'talk' },
      { t: 'say', who: 'Reuben', text: 'Not one kind word is left in me for that boy.', color: J.Reuben },
      { t: 'anim', get char() { return ctx.cast.reuben.char; }, state: 'idle' },
      // envy hardens into a low, scornful laugh between them
      { t: 'sound', key: 'sfx.men_laughing' },
      { t: 'fn', fn: async () => { ctx.cast.judah.char.play('talk'); ctx.cast.reuben.char.play('talk'); await wait(1300); ctx.cast.judah.char.play('idle'); ctx.cast.reuben.char.play('idle'); } },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_4 },
      { t: 'verseHide' },
      { t: 'fn', fn: () => { ctx.npcs.freeze(ctx.cast.judah, false); ctx.npcs.freeze(ctx.cast.reuben, false); } },
      // Joseph steps back out into the gold, wearing the coat
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
    ctx.setMusic('music.dusk_calm');
    ctx.grading.grade('dusk', 3200);
    ctx.onDusk?.(); // fireflies fade in (wired by the scene)

    // the brothers drift over and sit around the fire WHILE you walk up — the
    // camp settles for the night (they're alive, not waiting on a trigger)
    const ring = [['judah', -0.4], ['reuben', 0.7], ['simeon', 1.9], ['levi', 2.9]];
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
        jd.char.turnToward(ctx.joseph.position.x - jd.pos.x, ctx.joseph.position.z - jd.pos.z);
        jd.char.play('talk');
      } },
      { t: 'say', who: 'Judah', text: 'Look at him — the little dreamer, warming himself in his fine new coat.', color: J.Judah },
      { t: 'fn', fn: async () => {
        sm.char.turnToward(ctx.joseph.position.x - sm.pos.x, ctx.joseph.position.z - sm.pos.z);
        sm.char.play('talk');
        ctx.sound('sfx.men_laughing');
        await wait(1600);
        jd.char.play('kneel'); sm.char.play('kneel'); // back to seated by the fire
      } },
      { t: 'dialogueHide' },
      // Joseph looks down, rises, and turns away for his tent
      { t: 'fn', fn: () => { ctx.joseph.play('idle'); } },
      { t: 'wait', ms: 500 },
      { t: 'letterbox', on: false },
    ]);

    // the calm walk to his tent to rest — so the dream rises from a quiet night
    // instead of popping out of nowhere.
    let rested = false;
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
      { t: 'fade', on: false, ms: 1500 },
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

    // dream 1 answered (the field). Now DREAM 2 — the sky — one continuous move.
    ctx.setInput(false);
    ctx.joseph.turnToward(0, -1); // face the sky (north)
    ctx.joseph.play('idle');
    await seq([
      { t: 'objective', text: '' },
      { t: 'cam', angle: 0, target: { x: D.FIELD.x, z: D.FIELD.z }, distance: 7.5, height: 2.2, lookHeight: 1.6, duration: 1600 },
      { t: 'verse', verse: WEB.gen_37_7 },
      { t: 'verseHide' },
      // 1) the camera TILTS and RISES toward the sky; the bodies appear high
      { t: 'fn', fn: async () => { D.showSky(1); ctx.sound('stinger.dream_enter'); await wait(400); } },
      { t: 'cam', angle: 0, target: { x: D.FIELD.x, z: D.FIELD.z - 8 }, distance: 5.5, height: 3.6, lookHeight: 13, duration: 2600 },
      // 2) the sun + moon descend slowly; the 11 stars follow
      { t: 'fn', fn: async () => { D.descendSky(); await wait(2400); } },
      // 3) the camera glides DOWN, following their descent…
      { t: 'cam', angle: 0, target: { x: D.FIELD.x, z: D.FIELD.z - 3 }, distance: 7, height: 2.6, lookHeight: 6, duration: 2400 },
      // 4) …and settles BEHIND Joseph, who stands watching them bow to him
      { t: 'fn', fn: () => { ctx.joseph.setPosition(D.FIELD.x, D.FIELD.z + 1.8); ctx.joseph.turnToward(0, -1); } },
      { t: 'cam', angle: Math.PI, target: () => ({ x: D.FIELD.x, z: D.FIELD.z + 1.8 }), distance: 4.6, height: 2.3, lookHeight: 2.6, duration: 2400 },
      { t: 'fn', fn: async () => { D.bowSky(); ctx.sound('sfx.sheaf_bow'); await wait(2600); } },
      { t: 'verse', verse: WEB.gen_37_9 },
      { t: 'verseHide' },
      { t: 'letterbox', on: true },
      { t: 'fade', on: true, ms: 1400 },
    ]);
    // 5) WAKE → cut to EVENING in camp; the player walks to tell the brothers
    D.group.visible = false;
    D.resetSky();
    ctx.controller.bounds = ctx.bounds;
    ctx.joseph.setPosition(-8.2, -4.0); // waking by his father's tent
    ctx.joseph.turnToward(1, 0.3);
    ctx.camera.release(1);
    ctx.camera.snap();
    ctx.onDusk?.(); // it's evening, not morning — fireflies stay
    ['judah', 'reuben', 'simeon', 'levi'].forEach((k) => { ctx.npcs.freeze(ctx.cast[k], false); ctx.cast[k].char.play('idle'); });
    await seq([
      { t: 'grade', mood: 'dusk', ms: 30 },
      { t: 'fn', fn: () => ctx.setMusic('music.dusk_calm') },
      { t: 'fade', on: false, ms: 1600 },
      { t: 'letterbox', on: false },
    ]);
    // hand off to the telling — the player walks over (tell() gates on arrival)
    ctx.hud.setObjective('Go and tell your brothers your dream.', 'Walk to your brothers by the fire.');
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
    ctx.grading.grade('dusk', 500); // stay in the evening
    const freezeAll = (on) => ['judah', 'reuben', 'simeon', 'levi'].forEach((k) => ctx.npcs.freeze(ctx.cast[k], on));
    // group scene: establish WIDE, then cut to whoever speaks
    await seq([
      { t: 'letterbox', on: true },
      { t: 'fn', fn: () => { freezeAll(true); ctx.npcs.freeze(jac, true); } },
      { t: 'cam', angle: Math.PI * 0.6, target: { x: 0.8, z: -7.4 }, distance: 5.2, height: 2.0, lookHeight: 1.3, duration: 1500 },
      { t: 'fn', fn: () => { ctx.joseph.play('talk'); } },
      shot('joseph', 'judah', { side: 0.4 }),
      { t: 'say', who: 'Joseph', text: 'Brothers — hear this dream I dreamed.', color: J.Joseph },
      // "sheaves" explained once, naturally, inside the line (ui-clarity law 2)
      { t: 'say', who: 'Joseph', text: 'We were binding sheaves — bundles of wheat — in the field. Mine arose… and yours bowed down to it.', color: J.Joseph },
      { t: 'fn', fn: () => { ctx.joseph.play('idle'); } },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'ominous', ms: 1600 },
      // the brothers' scorn — a DISTINCT venom line (the narrator/verse 37:8
      // carries their canonical "will you reign over us"; the character never
      // repeats the verse — script-routing rule).
      shot('judah', 'joseph', { side: -0.42, dist: 2.6 }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'A dreamer of dreams — and a lord of nothing.', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_8 },
      { t: 'verseHide' },
      shot('joseph', 'judah', { side: 0.44, dist: 2.7 }),
      { t: 'fn', fn: () => { ctx.joseph.play('talk'); } },
      { t: 'say', who: 'Joseph', text: 'And again — the sun, the moon, eleven stars… all of them bowed to me.', color: J.Joseph },
      { t: 'fn', fn: () => { ctx.joseph.play('idle'); jac.char.play('talk'); } },
      // Jacob's brief, worried caution — the verse 37:10 (narrator) carries his
      // full canonical rebuke; his spoken line does NOT quote it.
      shot('jacob', 'joseph', { side: -0.4, dist: 2.8 }),
      { t: 'say', who: 'Jacob', text: 'Joseph… you must not speak so, even of a dream.', color: J.Jacob },
      { t: 'dialogueHide' },
      { t: 'fn', fn: () => { jac.char.play('idle'); } },
      { t: 'verse', verse: WEB.gen_37_10_short },
      { t: 'verseHide' },
      { t: 'wait', ms: 700 },
      { t: 'fn', fn: () => { freezeAll(false); ctx.npcs.freeze(jac, false); } },
    ]);
  }

  // ---------- beat 7 · 🎬 close: the glare, the verse, the tease ----------
  async function close() {
    await seq([
      // hold on the brothers' jealous glare as the light hardens
      { t: 'cam', angle: Math.PI * 0.5, target: { x: 0.8, z: -7.6 }, distance: 3.2, height: 1.6, lookHeight: 1.35, duration: 2200, awaitMs: false },
      { t: 'grade', mood: 'ominous', ms: 2000 },
      { t: 'verse', verse: WEB.gen_37_11 },
      { t: 'wait', ms: 600 },
      { t: 'verseHide' },
      { t: 'grade', mood: 'dusk', ms: 2400 },
      { t: 'fade', on: true, ms: 1800 },
      { t: 'title', heading: 'To be continued', sub: 'Genesis 37:12 — the road to Dothan', holdMs: 4200 },
    ]);
    ctx.finish?.();
  }

  // ---------- checkpoint resume: enter beat N fresh ----------
  function applyState(n, c) {
    // world/story state that earlier beats would have produced
    if (n >= 2) c.sheep.sheep.forEach((s) => { if (!s.counted) { s.counted = true; s.penned = true; s.x = c.camp.pen.minX + 2 + Math.random() * 3; s.z = c.camp.pen.minZ + 1.5 + Math.random() * 3; } });
    if (n >= 4) c.joseph.setCoat(true);
    const spawns = { 1: [2, 12.5], 2: [1, 1.5], 3: [-8.2, -4.6], 4: [-7.5, -4], 5: [1.4, -4.6], 6: [-6, -3], 7: [0.6, -6.6] };
    const s = spawns[n] || [0, 12];
    c.joseph.setPosition(s[0], s[1]);
    c.camera.snap();
    // beats 5 (dream/dusk) and 6-7 (telling, evening) all sit in dusk light
    c.grading.set(n >= 5 ? 'dusk' : 'goldenHour');
    if (n >= 5) c.onDusk?.(); // fireflies stay lit through the evening telling
  }

  return { list: [intro, herd, report, coat, dusk, dream, tell, close], applyState };
}

function pointToGate(pen) {
  return { x: pen.minX + 0.6, z: (pen.gate.z0 + pen.gate.z1) / 2 };
}
