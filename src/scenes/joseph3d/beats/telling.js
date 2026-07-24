import { WEB } from '../../../data/versesWEB.js';

export const TELLING_JOSEPH_MARK = Object.freeze({ x: 0.9, z: -4.1 });
export const TELLING_FIRE = Object.freeze({ x: 0, z: -6 });
export const TELLING_ROUTE_RADIUS = 0.42;
const TELLING_ROUTE_MARGIN = 0.01;

function segmentPointDistance(a, b, p) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 0.000001) return Math.hypot(a.x - p.x, a.z - p.z);
  const t = Math.max(0, Math.min(
    1,
    ((p.x - a.x) * dx + (p.z - a.z) * dz) / lengthSq,
  ));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
}

function segmentClear(world, a, b, radius) {
  const distance = Math.hypot(b.x - a.x, b.z - a.z);
  const samples = Math.max(1, Math.ceil(distance / 0.05));
  const clearance = radius + TELLING_ROUTE_MARGIN;
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    if (world.overlaps(
      a.x + (b.x - a.x) * t,
      a.z + (b.z - a.z) * t,
      clearance,
    )) return false;
  }
  return !world.overlaps(b.x, b.z, clearance);
}

// Build a small visibility graph around the actual camp colliders. This is
// deliberately a one-shot cutscene calculation, not a per-frame pathfinder.
// The old fixed east lane cleared the fire but intersected the nearby firewood
// stack; using the real world here keeps every valid trigger entry walkable.
function collisionAwareRoute(start, world, radius) {
  if (segmentClear(world, start, TELLING_JOSEPH_MARK, radius)) {
    return [TELLING_JOSEPH_MARK];
  }
  const nodes = [
    { x: start.x, z: start.z },
    TELLING_JOSEPH_MARK,
  ];
  for (const collider of world.statics) {
    if (collider.type === 'circle') {
      if (collider.x < -4.5 || collider.x > 5.8
        || collider.z < -10.5 || collider.z > -1.8) continue;
      const ring = collider.r + radius + 0.08;
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const point = {
          x: collider.x + Math.cos(angle) * ring,
          z: collider.z + Math.sin(angle) * ring,
        };
        if (!world.overlaps(point.x, point.z, radius + TELLING_ROUTE_MARGIN)) {
          nodes.push(point);
        }
      }
    } else {
      if (collider.maxX < -4.5 || collider.minX > 5.8
        || collider.maxZ < -10.5 || collider.minZ > -1.8) continue;
      const pad = radius + 0.08;
      for (const point of [
        { x: collider.minX - pad, z: collider.minZ - pad },
        { x: collider.minX - pad, z: collider.maxZ + pad },
        { x: collider.maxX + pad, z: collider.minZ - pad },
        { x: collider.maxX + pad, z: collider.maxZ + pad },
      ]) {
        if (!world.overlaps(point.x, point.z, radius + TELLING_ROUTE_MARGIN)) {
          nodes.push(point);
        }
      }
    }
  }

  const distance = new Float64Array(nodes.length);
  distance.fill(Infinity);
  distance[0] = 0;
  const previous = new Int32Array(nodes.length);
  previous.fill(-1);
  const visited = new Uint8Array(nodes.length);
  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    let best = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited[i] && distance[i] < best) {
        best = distance[i];
        current = i;
      }
    }
    if (current < 0 || current === 1) break;
    visited[current] = 1;
    for (let next = 1; next < nodes.length; next++) {
      if (visited[next] || next === current) continue;
      if (!segmentClear(world, nodes[current], nodes[next], radius)) continue;
      const edge = Math.hypot(
        nodes[next].x - nodes[current].x,
        nodes[next].z - nodes[current].z,
      );
      const candidate = distance[current] + edge;
      if (candidate < distance[next]) {
        distance[next] = candidate;
        previous[next] = current;
      }
    }
  }
  if (!Number.isFinite(distance[1])) return [];

  const raw = [];
  for (let cursor = 1; cursor >= 0; cursor = previous[cursor]) {
    raw.push(nodes[cursor]);
    if (cursor === 0) break;
  }
  raw.reverse();
  const route = [];
  let from = 0;
  while (from < raw.length - 1) {
    let next = raw.length - 1;
    while (next > from + 1 && !segmentClear(world, raw[from], raw[next], radius)) next -= 1;
    route.push(Object.freeze({ x: raw[next].x, z: raw[next].z }));
    from = next;
  }
  return route;
}

// The fire's visual ring is also a real collider. A player can validly enter
// either telling trigger from any side. Without a world (unit callers from
// older tooling), retain the authored fire-only fallback; the live scene always
// passes its ColliderWorld and therefore validates every nearby solid prop.
export function planTellingWalkRoute(start, colliderWorld = null, radius = TELLING_ROUTE_RADIUS) {
  if (colliderWorld?.overlaps && Array.isArray(colliderWorld.statics)) {
    return collisionAwareRoute(start, colliderWorld, radius);
  }
  const from = { x: start.x, z: start.z };
  if (segmentPointDistance(from, TELLING_JOSEPH_MARK, TELLING_FIRE) >= 2.0) {
    return [TELLING_JOSEPH_MARK];
  }
  const side = from.x >= TELLING_FIRE.x ? 1 : -1;
  const sideX = TELLING_FIRE.x + side * 2.0;
  return [
    Object.freeze({ x: sideX, z: from.z }),
    Object.freeze({ x: sideX, z: TELLING_JOSEPH_MARK.z }),
    TELLING_JOSEPH_MARK,
  ];
}

export async function finishNarratedHold({
  verseResult,
  duration,
  getElapsed,
  setElapsed,
  wait,
}) {
  if (verseResult?.status === 'skipped') setElapsed(duration);
  while (getElapsed() < duration) await wait(120);
}

// SCENE 1 — Joseph, Genesis 37:1–11. The first telling now lives inside beat 5
// between the two dreams, preserving the canonical order without renumbering
// any external checkpoint. Beat 6 is only the second telling.
export function makeTellingBeats(ctx, h) {
  const {
    seq, wait, gate, J, shot, groupShot, FIRE, TELL_RING, ringXZ,
    reserveTellingAmbient, releaseTellingAmbient,
  } = h;
  const BROTHERS = ['judah', 'reuben', 'simeon', 'levi'];

  async function gatherCircle({
    withJacob = false,
    triggerId,
    objective,
    hint,
  }) {
    const jac = ctx.cast.jacob;
    ctx.setInput(true);
    ctx.hud.setObjective(objective, hint);
    ctx.guide.setTargetXZ(0.8, -6.6);
    await gate(() => new Promise((resolve) => {
      ctx.interactables.addTrigger({
        id: triggerId, x: 0.8, z: -6.4, r: 3.2, once: true, onEnter: resolve,
      });
    }));
    // Reaching the circle completes the gameplay goal. End its logical
    // ownership before any letterbox/sequence can later restore stale text.
    ctx.hud.clearObjective?.();
    ctx.guide.setTarget(null);
    ctx.setInput(false);
    ctx.grading.grade('goldenHour', 500);
    const lensAspect = ctx.camera.camera?.aspect ?? 16 / 9;
    const gatherDistance = lensAspect < 0.75 ? 18 : (lensAspect < 1.2 ? 10 : 6.6);

    await seq([
      { t: 'letterbox', on: true },
      {
        t: 'cam',
        angle: Math.PI * 0.62,
        target: { x: 0.4, z: -6.2 },
        distance: gatherDistance,
        height: 3.1,
        lookHeight: 1.3,
        duration: 1500,
        awaitMs: false,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.6,
      },
    ]);
    // Joseph enters his speaking mark through the same controller-owned,
    // per-frame walk as gameplay while the brothers gather. The former
    // setPosition below was a visible ~2.3u teleport after everyone sat down.
    let josephArrived = false;
    try {
      const work = await Promise.all([
        (async () => {
          for (const waypoint of planTellingWalkRoute(
            ctx.joseph.position,
            ctx.colliderWorld,
          )) {
            if (!await ctx.controller.scriptMoveTo(waypoint.x, waypoint.z, 1.45)) {
              return false;
            }
          }
          return Math.hypot(
            ctx.joseph.position.x - TELLING_JOSEPH_MARK.x,
            ctx.joseph.position.z - TELLING_JOSEPH_MARK.z,
          ) < 0.3;
        })(),
        // Reserve the lens corridor before dialogue. These background actors
        // still walk, idle, and face the gathering; they simply cannot wander
        // randomly between a speaker and the camera.
        reserveTellingAmbient(),
        ...TELL_RING.map(([k, a]) => {
          const n = ctx.cast[k];
          const p = ringXZ(a);
          return ctx.npcs.sendTo(n, p.x, p.z, { speed: 1.7 }).then(() => {
            n.char.setPosition(p.x, p.z); n.pos.x = p.x; n.pos.z = p.z;
            ctx.npcs.freeze(n, true);
            n.char.turnToward(FIRE.x - p.x, FIRE.z - p.z);
            n.char.play('kneel');
          });
        }),
      ]);
      [josephArrived] = work;
    } finally {
      ctx.controller.cancelScriptMove();
      ctx.controller.vel.set(0, 0);
    }
    if (!josephArrived) {
      // An unexpected prop/NPC obstruction must not poison every later camera
      // composition. Restore the exact authored mark under a short veil; no
      // player ever sees a teleport and the scene cannot strand itself.
      await ctx.cinema.fade(true, 180);
      ctx.joseph.setPosition(TELLING_JOSEPH_MARK.x, TELLING_JOSEPH_MARK.z);
      await ctx.cinema.fade(false, 220);
    }

    if (withJacob) {
      await ctx.npcs.sendTo(jac, -2.6, -4.4, { speed: 1.4 });
      jac.char.setPosition(-2.6, -4.4); jac.pos.x = -2.6; jac.pos.z = -4.4;
      ctx.npcs.freeze(jac, true);
      jac.char.turnToward(FIRE.x - jac.pos.x, FIRE.z - jac.pos.z);
    }
    ctx.joseph.turnToward(
      FIRE.x - ctx.joseph.position.x,
      FIRE.z - ctx.joseph.position.z,
    );
  }

  // Genesis 37:5–8 — Joseph tells the first dream to his brothers, and only
  // then do they answer him. Beat 5 calls this before dream 2 begins.
  async function firstTell() {
    await gatherCircle({
      withJacob: false,
      triggerId: 'reach-brothers-first-dream',
      objective: 'Tell your brothers your dream.',
      hint: 'Walk to your brothers by the fire.',
    });

    try {
      await seq([
      groupShot(['joseph', ...BROTHERS], {
        // South lens corridor: Joseph remains foreground, the brothers read
        // across the fire, and portrait holds every head without crossing the
        // conversation axis or shrinking the cast to a 30u speck.
        angle: Math.PI,
        distance: 5.7,
        height: 2.7,
        look: 1.2,
        ms: 1600,
      }),
      { t: 'fn', fn: () => {
        ctx.storyEvent?.('tell1');
        ctx.joseph.play('talk');
      } },
      shot('joseph', 'judah', { side: 0.4, height: 2.15, look: 1.15 }),
      { t: 'say', who: 'Joseph', text: 'Brothers — hear this dream I dreamed.', color: J.Joseph },
      { t: 'say', who: 'Joseph', text: 'We bound sheaves — bundles of wheat. Mine stood, and yours bowed to it.', color: J.Joseph },
      { t: 'dialogueHide' },
      // Keep the signed-off smooth orbit, now around the people Scripture says
      // heard the first dream: the brothers, without Jacob presiding.
      { t: 'fn', fn: async () => {
        ctx.joseph.play('talk');
        const a0 = Math.PI * 0.55, RAD = 6.1, H = 2.7, T = 12500;
        const orbitMoveMs = ctx.camera.cinematicMoveTo({
          angle: a0,
          target: { x: FIRE.x, z: FIRE.z },
          distance: RAD,
          // Match the pose driver's first frame exactly. The old 2.7 -> 3.05
          // handoff jumped vertically even though both phases were smooth.
          height: H + 0.35,
          lookHeight: 1.15,
          duration: 1200,
          path: 'groupArc',
          arcCenter: FIRE,
          arcRadius: 6.4,
        });
        await wait(orbitMoveMs ?? 1200);
        let elapsed = 0;
        ctx.camera.setPoseDriver((pose, dt) => {
          elapsed = Math.min(T, elapsed + dt);
          const k = elapsed / T;
          const a = a0 + (k * k * (3 - 2 * k)) * 3.4;
          pose.pos.set(FIRE.x - Math.sin(a) * RAD, H + 0.35, FIRE.z - Math.cos(a) * RAD);
          pose.look.set(FIRE.x, 1.15, FIRE.z);
        });
        const verseResult = await ctx.verseCard.show(WEB.gen_37_5);
        ctx.verseCard.hide();
        // "Skip narration" must release this narrated hold too. Previously
        // the voice stopped but the hidden 12.5 s orbit kept the story locked.
        await finishNarratedHold({
          verseResult,
          duration: T,
          getElapsed: () => elapsed,
          setElapsed: (value) => { elapsed = value; },
          wait,
        });
        ctx.camera.setPoseDriver(null);
        ctx.joseph.play('idle');
      } },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'tenseDay', ms: 1600 },
      { t: 'fn', fn: () => ctx.setMusic('music.ominous_turn') },
      shot('judah', 'joseph', {
        side: -0.42,
        dist: 2.6,
        height: 2.1,
        look: 1.15,
        arcRadius: 9,
      }),
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'talk' },
      { t: 'say', who: 'Judah', text: 'Our little brother — a ruler over us?', color: J.Judah },
      { t: 'anim', get char() { return ctx.cast.judah.char; }, state: 'idle' },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_8 },
      { t: 'verseHide' },
      { t: 'wait', ms: 900 },
      ]);
    } finally {
      // Dream 2 follows this first telling, so release the background camp
      // actors once no conversation camera owns the corridor.
      releaseTellingAmbient();
    }
  }

  // Genesis 37:9–10 is two explicit tellings: Joseph first tells his brothers
  // (v9), then tells his father and brothers (v10). Keep both visible rather
  // than collapsing the text into one convenient family conversation.
  async function tell() {
    const jac = ctx.cast.jacob;
    await gatherCircle({
      withJacob: false,
      triggerId: 'reach-brothers-second-dream',
      objective: 'Tell your brothers the second dream.',
      hint: 'Walk to your brothers by the fire.',
    });

    await seq([
      groupShot(['joseph', ...BROTHERS], {
        angle: Math.PI,
        distance: 5.7,
        height: 2.7,
        look: 1.2,
        ms: 1600,
      }),
      { t: 'fn', fn: () => {
        ctx.storyEvent?.('tell2_brothers');
        ctx.joseph.play('talk');
      } },
      // The wider shoulder keeps Judah clear of the lens in the full circle;
      // checking only Joseph/Reuben left Judah's head on this endpoint.
      shot('joseph', 'reuben', { side: 0.9, dist: 4.4, height: 2.15, look: 1.15 }),
      { t: 'say', who: 'Joseph', text: 'I dreamed again: the sun, moon, and eleven stars bowed to me.', color: J.Joseph },
      { t: 'dialogueHide' },
      { t: 'verse', verse: WEB.gen_37_9 },
      { t: 'wait', ms: 1100 },
      { t: 'verseHide' },
      groupShot(['joseph', ...BROTHERS], {
        angle: Math.PI,
        distance: 6.5,
        height: 3.05,
        look: 1.2,
        ms: 1400,
        arcRadius: 6.5,
      }),
      { t: 'fn', fn: async () => {
        ctx.npcs.freeze(jac, false);
        await ctx.npcs.sendTo(jac, -2.6, -4.4, { speed: 1.4 });
        jac.char.setPosition(-2.6, -4.4);
        jac.pos.x = -2.6;
        jac.pos.z = -4.4;
        ctx.npcs.freeze(jac, true);
        jac.char.turnToward(FIRE.x - jac.pos.x, FIRE.z - jac.pos.z);
        ctx.storyEvent?.('tell2_family');
      } },
      shot('joseph', 'jacob', { side: 0.7, dist: 3.8, height: 2.15, look: 1.15 }),
      { t: 'say', who: 'Joseph', text: 'Father, I also saw the sun, moon, and eleven stars bow to me.', color: J.Joseph },
      { t: 'dialogueHide' },
      { t: 'sound', key: 'stinger.hatred' },
      { t: 'grade', mood: 'tenseDay', ms: 1600 },
      { t: 'fn', fn: () => { ctx.setMusic('music.ominous_turn'); } },
      { t: 'fn', fn: () => {
        ctx.joseph.play('idle');
        jac.char.play('talk');
        ctx.storyEvent?.('rebuke');
      } },
      shot('jacob', 'joseph', { side: -0.7, dist: 3.8, height: 2.1, look: 1.15 }),
      { t: 'say', who: 'Jacob', text: 'Joseph — what is this dream?', color: J.Jacob },
      { t: 'dialogueHide' },
      { t: 'fn', fn: () => {
        jac.char.play('idle');
        jac.char.turnToward(
          ctx.joseph.position.x - jac.pos.x,
          ctx.joseph.position.z - jac.pos.z,
        );
      } },
      { t: 'verse', verse: WEB.gen_37_10 },
      { t: 'wait', ms: 1400 },
      { t: 'verseHide' },
    ]);
  }

  // Genesis 37:11 — envy lands first, then the same verse remains while Jacob
  // silently watches Joseph and keeps the matter in mind.
  async function close() {
    const jac = ctx.cast.jacob;
    await seq([
      { t: 'letterbox', on: true },
      groupShot(['joseph', ...BROTHERS, 'jacob'], {
        // South three-quarter wide: responsive distance keeps the whole
        // family readable even on a 390x844 portrait screen.
        angle: 0.35,
        distance: 4.5,
        height: 2.2,
        look: 1.3,
        ms: 2200,
      }),
      { t: 'grade', mood: 'tenseDay', ms: 2000 },
      { t: 'fn', fn: () => { ctx.storyEvent?.('envy'); } },
      { t: 'verse', verse: WEB.gen_37_11 },
      { t: 'wait', ms: 1300 },
      { t: 'fn', fn: () => {
        jac.char.turnToward(
          ctx.joseph.position.x - jac.pos.x,
          ctx.joseph.position.z - jac.pos.z,
        );
      } },
      shot('jacob', 'joseph', { side: -0.7, dist: 3.8, height: 2.1, look: 1.2 }),
      { t: 'wait', ms: 1400 },
      { t: 'verseHide' },
    ]);

    const lone = { x: -4.6, z: -2.0 };
    ctx.joseph.turnToward(lone.x - ctx.joseph.position.x, lone.z - ctx.joseph.position.z);
    await seq([
      {
        t: 'cam',
        angle: Math.PI * 0.9,
        target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }),
        distance: 6.4,
        height: 3.1,
        lookHeight: 1.2,
        duration: 3200,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius: 6.4,
      },
      { t: 'fn', fn: async () => {
        const angle = Math.PI * 0.9;
        const distance = 6.4;
        ctx.camera.setPoseDriver((pose) => {
          const p = ctx.joseph.position;
          pose.pos.set(
            p.x - Math.sin(angle) * distance,
            3.1,
            p.z - Math.cos(angle) * distance,
          );
          pose.look.set(p.x, 1.2, p.z);
        });
        ctx.joseph.setGrief(true, 0.42);
        ctx.hud.emote('Joseph is sad');
        try {
          await ctx.controller.scriptMoveTo(lone.x, lone.z, 1.15);
          ctx.joseph.play('idle');
        } finally {
          ctx.camera.setPoseDriver(null);
        }
      } },
    ]);
    await seq([
      {
        t: 'cam',
        angle: Math.PI * 0.95,
        target: () => ({ x: ctx.joseph.position.x, z: ctx.joseph.position.z }),
        distance: 4.4,
        height: 2.1,
        lookHeight: 1.3,
        duration: 2000,
        path: 'arc',
      },
      { t: 'wait', ms: 900 },
      { t: 'grade', mood: 'goldenHour', ms: 2200 },
      { t: 'fade', on: true, ms: 1800 },
      { t: 'fn', fn: () => ctx.joseph.setGrief(false) },
      { t: 'title', heading: 'To be continued', sub: 'Genesis 37:12–17 — the road to Dothan', holdMs: 4200 },
    ]);
    ctx.finish?.();
  }

  return { firstTell, tell, close };
}
