import { pausableWait } from '../../../engine/Sequencer.js';
import { NAME_COLOR } from '../cast.js';
import { withAbort } from '../../../core/async.js';

export const MAX_DIALOGUE_FOREGROUND = 0.25;
export const DIALOGUE_FACE_SAFE = {
  minX: -0.72, maxX: 0.72,
  minY: -0.62, maxY: 0.68,
};
export const BETRAYAL_STRIP_CAMERA = Object.freeze({
  angle: Math.PI * 0.75,
  distance: 4.4,
  height: 2.25,
  lookHeight: 1.15,
});

export function nearestUnbowedBundle(bundles, from) {
  let nearest = null;
  let nearestDistanceSq = Infinity;
  for (const bundle of bundles) {
    if (bundle.userData?.bowed) continue;
    const dx = bundle.position.x - from.x;
    const dz = bundle.position.z - from.z;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearest = bundle;
      nearestDistanceSq = distanceSq;
    }
  }
  return nearest;
}

// Conservative projected width of a foreground head, expressed as a fraction
// of the viewport width. The interval is clipped to the visible frame, so a
// listener safely outside a portrait single counts as zero rather than forcing
// an unnecessarily wide shot.
export function projectedHeadOccupancy({
  cameraPos,
  cameraLook,
  headCenter,
  headRadius = 0.3,
  fov = 46,
  aspect = 16 / 9,
}) {
  let fx = cameraLook.x - cameraPos.x;
  let fy = cameraLook.y - cameraPos.y;
  let fz = cameraLook.z - cameraPos.z;
  const fLen = Math.hypot(fx, fy, fz) || 1;
  fx /= fLen; fy /= fLen; fz /= fLen;

  // Camera-right projected onto the ground plane. Dialogue cameras are never
  // straight vertical; retain a deterministic fallback for malformed callers.
  let rx = -fz, rz = fx;
  const rLen = Math.hypot(rx, rz) || 1;
  rx /= rLen; rz /= rLen;

  const vx = headCenter.x - cameraPos.x;
  const vy = headCenter.y - cameraPos.y;
  const vz = headCenter.z - cameraPos.z;
  const depth = vx * fx + vy * fy + vz * fz;
  if (depth <= -headRadius) return 0;
  if (depth <= headRadius) return 1;

  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const safeFov = Number.isFinite(fov) && fov > 1 ? fov : 46;
  const tanHalfH = Math.tan((safeFov * Math.PI) / 360) * safeAspect;
  const centerNdc = (vx * rx + vz * rz) / (depth * tanHalfH);
  // depth-radius is deliberately conservative near the lens.
  const halfNdc = headRadius / (Math.max(0.001, depth - headRadius) * tanHalfH);
  const visibleNdc = Math.max(
    0,
    Math.min(1, centerNdc + halfNdc) - Math.max(-1, centerNdc - halfNdc),
  );
  return visibleNdc * 0.5;
}

export function projectedAnchorNdc({
  cameraPos,
  cameraLook,
  point,
  fov = 46,
  aspect = 16 / 9,
}) {
  let fx = cameraLook.x - cameraPos.x;
  let fy = cameraLook.y - cameraPos.y;
  let fz = cameraLook.z - cameraPos.z;
  const fLen = Math.hypot(fx, fy, fz) || 1;
  fx /= fLen; fy /= fLen; fz /= fLen;

  let rx = -fz, rz = fx;
  const rLen = Math.hypot(rx, rz) || 1;
  rx /= rLen; rz /= rLen;
  // Camera-up = right × forward. Dialogue shots never look straight down,
  // but this basis remains deterministic if a malformed caller gets close.
  const ux = -rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy;

  const vx = point.x - cameraPos.x;
  const vy = point.y - cameraPos.y;
  const vz = point.z - cameraPos.z;
  const depth = vx * fx + vy * fy + vz * fz;
  if (depth <= 0.001) return { x: Infinity, y: Infinity, depth };

  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const safeFov = Number.isFinite(fov) && fov > 1 ? fov : 46;
  const tanHalfV = Math.tan((safeFov * Math.PI) / 360);
  return {
    x: (vx * rx + vz * rz) / (depth * tanHalfV * safeAspect),
    y: (vx * ux + vy * uy + vz * uz) / (depth * tanHalfV),
    depth,
  };
}

const dialogueHeadRadius = (headHeight) =>
  Math.min(0.36, Math.max(0.26, (Number.isFinite(headHeight) ? headHeight : 1.65) * 0.18));

const cameraPlan = ({
  angle, target, distance, height, lookHeight, listener, listenerHeadHeight,
  fov, aspect, kind,
}) => {
  const cameraPos = {
    x: target.x - Math.sin(angle) * distance,
    y: (target.y ?? 0) + height,
    z: target.z - Math.cos(angle) * distance,
  };
  const cameraLook = {
    x: target.x,
    y: (target.y ?? 0) + lookHeight,
    z: target.z,
  };
  const safeListenerHeadHeight = Number.isFinite(listenerHeadHeight) ? listenerHeadHeight : 1.65;
  const headRadius = dialogueHeadRadius(safeListenerHeadHeight);
  const headCenter = {
    x: listener.x,
    y: (listener.y ?? 0) + safeListenerHeadHeight - headRadius,
    z: listener.z,
  };
  return {
    angle, target, distance, height, lookHeight, path: 'arc', kind,
    foregroundOccupancy: projectedHeadOccupancy({
      cameraPos, cameraLook, headCenter, headRadius, fov, aspect,
    }),
  };
};

// Try the authored OTS first. If its listener would exceed 25% of the current
// viewport, move to a clean three-quarter single on the speaker. The single
// searches both shoulders and widens only as far as needed.
export function planDialogueCamera({
  speaker,
  listener,
  speakerHeadHeight = 1.65,
  listenerHeadHeight = 1.65,
  side = 0.42,
  dist = 3.2,
  height = 1.75,
  look = 1.25,
  fov = 46,
  aspect = 16 / 9,
  forceSingle = false,
  maxDistance = 12,
}) {
  const safeDist = Math.max(3.2, dist);
  const safeHeight = Math.max(1.85, height);
  const targetY = ((speaker.y ?? 0) * 0.72) + ((listener.y ?? 0) * 0.28);
  const ots = cameraPlan({
    angle: Math.atan2(speaker.x - listener.x, speaker.z - listener.z) + side,
    target: {
      x: speaker.x * 0.72 + listener.x * 0.28,
      y: targetY,
      z: speaker.z * 0.72 + listener.z * 0.28,
    },
    distance: safeDist,
    height: safeHeight,
    lookHeight: look,
    listener,
    listenerHeadHeight,
    fov,
    aspect,
    kind: 'ots',
  });
  if (!forceSingle && ots.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND) {
    ots.otsOccupancy = ots.foregroundOccupancy;
    return ots;
  }

  const axisToListener = Math.atan2(listener.x - speaker.x, listener.z - speaker.z);
  const preferred = side < 0 ? -1 : 1;
  const offsets = [preferred * 0.75, -preferred * 0.75, preferred * 1.05, -preferred * 1.05];
  const singleHeight = Math.max(1.95, safeHeight);
  const singleLook = Math.max(1.15, Math.min(look, speakerHeadHeight - 0.2));
  const singleMax = Math.max(
    safeDist,
    Math.min(12, Number.isFinite(maxDistance) ? maxDistance : 12),
  );
  const singleStart = Math.min(singleMax, Math.max(3.4, safeDist));
  const distances = [];
  for (let distance = singleStart; distance < singleMax - 0.001; distance += 0.6) {
    distances.push(distance);
  }
  distances.push(singleMax);
  let best = null;
  for (const distance of distances) {
    for (const offset of offsets) {
      // Camera sits on the speaker's front three-quarter hemisphere. Add PI
      // because CameraDirector stores the direction from camera TO target.
      const plan = cameraPlan({
        angle: axisToListener + offset + Math.PI,
        target: { x: speaker.x, y: speaker.y ?? 0, z: speaker.z },
        distance,
        height: singleHeight,
        lookHeight: singleLook,
        listener,
        listenerHeadHeight,
        fov,
        aspect,
        kind: 'single',
      });
      plan.otsOccupancy = ots.foregroundOccupancy;
      if (!best || plan.foregroundOccupancy < best.foregroundOccupancy) best = plan;
      if (plan.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND) return plan;
    }
  }
  return best;
}

// Start with the authored relationship two-shot. If the current viewport
// cannot hold both live faces inside the dialogue-safe frame, fall back to a
// clean single on the requested speaker. Landscape keeps the relationship;
// portrait avoids placing both large heads beyond the sides of the frame.
export function planTwoShotCamera({
  a,
  b,
  aHeadHeight = 1.65,
  bHeadHeight = 1.65,
  distMin = 3.0,
  distMax = Infinity,
  height = 2.05,
  look = 1.05,
  towardB = 0,
  fov = 46,
  aspect = 16 / 9,
  responsiveSpeaker = null,
}) {
  const axis = Math.atan2(b.x - a.x, b.z - a.z);
  const sep = Math.hypot(b.x - a.x, b.z - a.z);
  const safeMin = Math.max(3.2, distMin);
  const safeMax = Math.max(safeMin, distMax);
  const distance = Math.min(safeMax, Math.max(safeMin, sep * 1.35 + 1.6));
  const safeHeight = Math.max(1.85, height);
  const target = {
    x: (a.x + b.x) / 2,
    y: ((a.y ?? 0) + (b.y ?? 0)) / 2,
    z: (a.z + b.z) / 2,
  };
  const angle = axis - Math.PI / 2 - towardB;
  const cameraPos = {
    x: target.x - Math.sin(angle) * distance,
    y: target.y + safeHeight,
    z: target.z - Math.cos(angle) * distance,
  };
  const cameraLook = { x: target.x, y: target.y + look, z: target.z };
  const aFace = projectedAnchorNdc({
    cameraPos,
    cameraLook,
    point: { x: a.x, y: (a.y ?? 0) + aHeadHeight - 0.22, z: a.z },
    fov,
    aspect,
  });
  const bFace = projectedAnchorNdc({
    cameraPos,
    cameraLook,
    point: { x: b.x, y: (b.y ?? 0) + bHeadHeight - 0.22, z: b.z },
    fov,
    aspect,
  });
  const tanHalfV = Math.tan(((Number.isFinite(fov) ? fov : 46) * Math.PI) / 360);
  const tanHalfH = tanHalfV * (Number.isFinite(aspect) && aspect > 0 ? aspect : 1);
  const headBounds = (face, headHeight) => {
    const radius = dialogueHeadRadius(headHeight);
    const safeDepth = Math.max(0.001, face.depth - radius);
    return {
      left: face.x - radius / (safeDepth * tanHalfH),
      right: face.x + radius / (safeDepth * tanHalfH),
      bottom: face.y - radius / (safeDepth * tanHalfV),
      top: face.y + radius / (safeDepth * tanHalfV),
    };
  };
  const aBounds = headBounds(aFace, aHeadHeight);
  const bBounds = headBounds(bFace, bHeadHeight);
  const faceSafe = [aBounds, bBounds].every((bounds) => (
    bounds.left >= DIALOGUE_FACE_SAFE.minX && bounds.right <= DIALOGUE_FACE_SAFE.maxX
    && bounds.bottom >= DIALOGUE_FACE_SAFE.minY && bounds.top <= DIALOGUE_FACE_SAFE.maxY
  ));
  const pair = {
    angle,
    target,
    distance,
    height: safeHeight,
    lookHeight: look,
    path: 'arc',
    kind: 'two',
    faceSafe,
    aFace,
    bFace,
    aBounds,
    bBounds,
  };
  if (faceSafe || (responsiveSpeaker !== 'a' && responsiveSpeaker !== 'b')) return pair;

  const speakerIsA = responsiveSpeaker === 'a';
  return planDialogueCamera({
    speaker: speakerIsA ? a : b,
    listener: speakerIsA ? b : a,
    speakerHeadHeight: speakerIsA ? aHeadHeight : bHeadHeight,
    listenerHeadHeight: speakerIsA ? bHeadHeight : aHeadHeight,
    side: towardB || 0.75,
    dist: safeMin,
    height: safeHeight,
    look,
    fov,
    aspect,
    forceSingle: true,
    maxDistance: safeMax,
  });
}

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
  // camera keeps more air (dist ≥3.2, raised, looking slightly down) so a
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
      const speakerChar = charOf(speaker);
      const listenerChar = charOf(listener);
      const lens = ctx.camera.camera;
      const plan = planDialogueCamera({
        speaker: sp,
        listener: li,
        speakerHeadHeight: speakerChar.headHeight,
        listenerHeadHeight: listenerChar.headHeight,
        side,
        dist,
        height,
        look,
        fov: lens?.fov ?? 46,
        aspect: lens?.aspect ?? 16 / 9,
      });
      const groupArc = Math.hypot(sp.x - FIRE.x, sp.z - FIRE.z) < 5.5
        && Math.hypot(li.x - FIRE.x, li.z - FIRE.z) < 5.5;
      ctx.camera.cinematicMoveTo({
        angle: plan.angle,
        target: plan.target,
        distance: plan.distance,
        height: plan.height,
        lookHeight: plan.lookHeight,
        duration: ms,
        path: groupArc ? 'groupArc' : plan.path,
        arcCenter: groupArc ? FIRE : null,
        arcRadius: groupArc ? 6.4 : 0,
      });
      await wait(ms * 0.6); // the cut lands as the line starts
    },
  });

  // D9: the TWO-SHOT, computed from LIVE positions at call time — side-on to
  // the pair's axis, raised and looking a touch down, distance scaled to the
  // separation (never under 3.2). Call it AGAIN after anyone moves: the coat
  // gift used a pre-walk framing, and Jacob's walk put the back of his head
  // square in the lens.
  // `towardB` (D13) swings the camera around toward B's side of the pair, so
  // A is seen three-quarter FRONT instead of in flat profile. The coat gift
  // needs it: at a pure 90° the giver can end up as the back of a head filling
  // the lens (Nate saw exactly that). 0 = the old side-on framing.
  const twoShot = (aWho, bWho, {
    ms = 1200,
    distMin = 3.0,
    distMax = Infinity,
    height = 2.05,
    look = 1.05,
    towardB = 0,
    responsiveSpeaker = null,
  } = {}) => {
    const a = posOf(aWho), b = posOf(bWho);
    const aChar = charOf(aWho), bChar = charOf(bWho);
    const lens = ctx.camera.camera;
    const plan = planTwoShotCamera({
      a,
      b,
      aHeadHeight: aChar.headHeight,
      bHeadHeight: bChar.headHeight,
      distMin,
      distMax,
      height,
      look,
      towardB,
      fov: lens?.fov ?? 46,
      aspect: lens?.aspect ?? 16 / 9,
      responsiveSpeaker,
    });
    const groupArc = Math.hypot(a.x - FIRE.x, a.z - FIRE.z) < 5.5
      && Math.hypot(b.x - FIRE.x, b.z - FIRE.z) < 5.5;
    ctx.camera.cinematicMoveTo({
      angle: plan.angle,
      target: plan.target,
      // distMax: INTERIOR shots cap the pull-back so the lens can never
      // back out through the tent shell (D11 — Nate saw the outside)
      distance: plan.distance,
      height: plan.height, lookHeight: plan.lookHeight, duration: ms,
      path: groupArc ? 'groupArc' : 'arc',
      arcCenter: groupArc ? FIRE : null,
      arcRadius: groupArc ? 6.4 : 0,
    });
    return plan;
  };

  const pointToGate = (pen) => ({ x: pen.minX + 0.6, z: (pen.gate.z0 + pen.gate.z1) / 2 });

  return { seq, wait, gate, J, FIRE, TELL_RING, ringXZ, posOf, charOf, shot, twoShot, pointToGate };
}
