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
//   ./dream.js     beat 5            — the dream (finale is signed off: don't restage)
//   ./telling.js   beats 6,7         — telling the brothers · the close
export function createBeats(ctx) {
  const h = makeHelpers(ctx);
  const { intro } = makeColdOpen(ctx, h);
  const { herd, report, coat, dusk } = makeCampBeats(ctx, h);
  const { dream } = makeDreamBeat(ctx, h);
  const { tell, close } = makeTellingBeats(ctx, h);
  const { FIRE, TELL_RING, ringXZ } = h;

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
