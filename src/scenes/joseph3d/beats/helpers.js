import { pausableWait } from '../../../engine/Sequencer.js';
import { NAME_COLOR } from '../cast.js';
import { withAbort } from '../../../core/async.js';

// The shared vocabulary every act speaks: sequencing, the fire ring, and the
// dialogue-camera grammar (dialogue-cinematography skill). Built once per
// scene and handed to each act as `h`.
export function makeHelpers(ctx) {
  const J = NAME_COLOR;
  const seq = (steps) => ctx.sequencer.run(steps);
  const wait = (ms) => pausableWait(ms, ctx.isPaused, ctx.signal); // honours pause + scene lifetime
  const gate = (work) => withAbort(work, ctx.signal); // gameplay prompts/triggers also die with the scene

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
      const safeDist = Math.max(3.2, dist);
      const safeHeight = Math.max(1.85, height);
      ctx.camera.cinematicMoveTo({
        angle: a,
        target: { x: sp.x * 0.72 + li.x * 0.28, z: sp.z * 0.72 + li.z * 0.28 },
        distance: safeDist, height: safeHeight, lookHeight: look, duration: ms,
      });
      await wait(ms * 0.6); // the cut lands as the line starts
    },
  });

  // D9: the TWO-SHOT, computed from LIVE positions at call time — side-on to
  // the pair's axis, raised and looking a touch down, distance scaled to the
  // separation (never under 3.0). Call it AGAIN after anyone moves: the coat
  // gift used a pre-walk framing, and Jacob's walk put the back of his head
  // square in the lens.
  // `towardB` (D13) swings the camera around toward B's side of the pair, so
  // A is seen three-quarter FRONT instead of in flat profile. The coat gift
  // needs it: at a pure 90° the giver can end up as the back of a head filling
  // the lens (Nate saw exactly that). 0 = the old side-on framing.
  const twoShot = (aWho, bWho, { ms = 1200, distMin = 3.0, distMax = Infinity, height = 2.05, look = 1.05, towardB = 0 } = {}) => {
    const a = posOf(aWho), b = posOf(bWho);
    const axis = Math.atan2(b.x - a.x, b.z - a.z);
    const sep = Math.hypot(b.x - a.x, b.z - a.z);
    ctx.camera.cinematicMoveTo({
      angle: axis - Math.PI / 2 - towardB,
      target: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 },
      // distMax: INTERIOR shots cap the pull-back so the lens can never
      // back out through the tent shell (D11 — Nate saw the outside)
      distance: Math.min(distMax, Math.max(distMin, sep * 1.35 + 1.6)),
      height, lookHeight: look, duration: ms,
    });
  };

  const pointToGate = (pen) => ({ x: pen.minX + 0.6, z: (pen.gate.z0 + pen.gate.z1) / 2 });

  return { seq, wait, gate, J, FIRE, TELL_RING, ringXZ, posOf, charOf, shot, twoShot, pointToGate };
}
