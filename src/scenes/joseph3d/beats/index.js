import { makeHelpers } from './helpers.js';
import { makeColdOpen } from './coldOpen.js';
import { makeCampBeats } from './camp.js';
import { makeDreamBeat } from './dream.js';
import { makeTellingBeats } from './telling.js';

// SCENE 1 — the story as a BEAT STATE MACHINE (game-architecture rule 2).
// Eight beats in order; the player acts every 15–20s; displayed verses are
// word-perfect WEB and dialogue is human paraphrase that never leaves what the
// text says (script-writing + bible-knowledge). Every beat ENTERS by setting
// its own presentation state, so a checkpoint can start any beat fresh.
//
//   ./helpers.js   shared sequencing + shot grammar
//   ./coldOpen.js  beat 0            — the flash-forward to the pit
//   ./camp.js      beats 1,2,3,4     — herd · report · the coat · dusk fire
//   ./dream.js     beat 5            — dream 1 · first telling · dream 2
//   ./telling.js   beat-5 helper + 6,7 — both tellings · the close
export function createBeats(ctx) {
  const h = makeHelpers(ctx);
  const { intro } = makeColdOpen(ctx, h);
  const { herd, report, coat, dusk } = makeCampBeats(ctx, h);
  const { firstTell, tell, close } = makeTellingBeats(ctx, h);
  const { dream } = makeDreamBeat(ctx, h, { firstTell });
  const { FIRE, TELL_RING, ringXZ } = h;

  // ---------- checkpoint resume: enter beat N fresh ----------
  function applyState(n, c) {
    // world/story state that earlier beats would have produced
    if (n >= 2) c.sheep.sheep.forEach((sheep, i) => {
      if (sheep.counted) return;
      sheep.counted = true;
      sheep.penned = true;
      // A resumed checkpoint must paint the same flock every time.
      sheep.x = c.camp.pen.minX + 2 + (i % 3) * 1.15;
      sheep.z = c.camp.pen.minZ + 1.5 + (i % 2) * 1.25;
    });
    if (n >= 4) c.joseph.setCoat(true);
    c.setStage?.('camp');
    c.hud.clearObjective?.();
    c.guide.setTarget(null);
    const spawns = { 1: [2, 12.5], 2: [1, 1.5], 3: [-8.2, -4.6], 4: [-7.5, -4], 5: [1.4, -4.6], 6: [-6, -3], 7: [0.9, -4.1] };
    const s = spawns[n] || [0, 12];
    c.joseph.setPosition(s[0], s[1]);
    c.camera.setTarget(c.joseph.position);
    c.camera.setLead(0, 0);
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
    // Beat 5 owns both dream/day transitions and the first telling; beats 6–7
    // resume in the camp for the second telling and close.
    c.grading.set('goldenHour');
  }


  return { list: [intro, herd, report, coat, dusk, dream, tell, close], applyState };
}
