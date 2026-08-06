import { pausableWait } from '../../../engine/Sequencer.js';
import { CINEMATIC_DRIFT_ANGLE } from '../../../engine/CameraDirector.js';
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
export const BETRAYAL_MARCH_CAMERA = Object.freeze({
  angle: -Math.PI / 3,
  nearDistance: 4.2,
  wideDistance: 4.8,
  height: 1.55,
  wideHeight: 1.9,
  lookHeight: 1.05,
});
export const BETRAYAL_FALL_CAMERA = Object.freeze({
  angleOffset: 2.0,
  // The lens lives INSIDE the 1.85–2.05u cistern wall. The old responsive
  // distance reached 10u in portrait, placing the camera outside the masonry
  // and guaranteeing that the wall hid Joseph.
  interiorRadius: 1.18,
  startY: -0.35,
  endY: -2.25,
  uprightLookHeight: 0.78,
  subjectHeight: 0.82,
  orbit: 0.08,
});
export function betrayalFallFov(aspect = 16 / 9, baseFov = 46) {
  if (!Number.isFinite(aspect) || aspect >= 0.75) return baseFov;
  const portraitK = Math.max(0, Math.min(1, (0.75 - aspect) / 0.3));
  return baseFov + portraitK * 10;
}
export function writeBetrayalFallCameraPose(
  pose,
  { pit, joseph, yaw, progress },
) {
  const k = Math.max(0, Math.min(1, progress));
  const a = yaw + BETRAYAL_FALL_CAMERA.angleOffset
    + k * BETRAYAL_FALL_CAMERA.orbit;
  // Follow the actor's pitched torso. Tracking an upright world-Y point made
  // his face drift sideways off portrait as the body rotated flat.
  const pitch = -Math.PI * 0.5 * k;
  const subjectForward = Math.sin(pitch) * BETRAYAL_FALL_CAMERA.subjectHeight;
  pose.pos.set(
    pit.x - Math.sin(a) * BETRAYAL_FALL_CAMERA.interiorRadius,
    BETRAYAL_FALL_CAMERA.startY
      + (BETRAYAL_FALL_CAMERA.endY - BETRAYAL_FALL_CAMERA.startY) * k,
    pit.z - Math.cos(a) * BETRAYAL_FALL_CAMERA.interiorRadius,
  );
  pose.look.set(
    joseph.x + Math.sin(yaw) * subjectForward,
    joseph.y + Math.cos(pitch) * BETRAYAL_FALL_CAMERA.subjectHeight,
    joseph.z + Math.cos(yaw) * subjectForward,
  );
  return pose;
}
export const BETRAYAL_PROWL_ORBIT = Object.freeze({
  amplitude: 0.03,
  rate: 0.00035,
});
export const TELLING_AMBIENT_KEYS = Object.freeze([
  'brother0', 'brother1', 'brother2', 'brother3', 'brother4', 'brother5',
  'worker1', 'worker2', 'child',
]);
// A collision-audited spectator arc 11u north of the fire. It keeps ambient
// life visible in the camp without letting a random wander cross the 6.4u
// dialogue-camera orbit or Joseph's face.
// THE FIRE CIRCLE'S SEATS — exported because tools/test-dialogue-camera-safety
// duplicated these four numbers, and a duplicated constant is a guard that
// silently stops guarding: the seats were re-blocked to the south arc and the
// test kept composing the OLD circle against the NEW Joseph mark, which is a
// staging that exists nowhere in the game.
export const TELLING_RING_RADIUS = 2.2;
export const TELLING_RING_SEATS = Object.freeze([
  Object.freeze(['judah', 0.2584]),
  Object.freeze(['reuben', 1.0084]),
  Object.freeze(['simeon', 1.8584]),
  Object.freeze(['levi', 2.6084]),
]);
export const TELLING_FIRE = Object.freeze({ x: 0, z: -6 });
export const tellingRingXZ = (a) => ({
  x: TELLING_FIRE.x + Math.cos(a) * TELLING_RING_RADIUS,
  z: TELLING_FIRE.z + Math.sin(a) * TELLING_RING_RADIUS,
});

export const TELLING_AMBIENT_SLOTS = Object.freeze([
  Object.freeze({ x: 10.66, z: -3.28 }),
  Object.freeze({ x: 9.2, z: 0.03 }),
  Object.freeze({ x: 6.75, z: 2.69 }),
  Object.freeze({ x: 3.57, z: 4.41 }),
  Object.freeze({ x: 0, z: 5 }),
  Object.freeze({ x: -3.57, z: 4.41 }),
  Object.freeze({ x: -6.75, z: 2.69 }),
  Object.freeze({ x: -9.2, z: 0.03 }),
  Object.freeze({ x: -10.66, z: -3.28 }),
]);
export const COAT_ENVY_SPECTATOR_KEYS = Object.freeze([
  ...TELLING_AMBIENT_KEYS,
  'simeon',
  'levi',
]);
export const COAT_ENVY_SPECTATOR_SLOTS = Object.freeze([
  ...TELLING_AMBIENT_SLOTS,
  Object.freeze({ x: -12, z: -4.5 }),
  Object.freeze({ x: 12, z: -4.5 }),
]);

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

export function projectedHeadBounds({
  cameraPos,
  cameraLook,
  actor,
  headHeight = 1.65,
  fov = 46,
  aspect = 16 / 9,
}) {
  const safeHeadHeight = Number.isFinite(headHeight) ? headHeight : 1.65;
  const radius = dialogueHeadRadius(safeHeadHeight);
  const face = projectedAnchorNdc({
    cameraPos,
    cameraLook,
    point: {
      x: actor.x,
      y: (actor.y ?? 0) + safeHeadHeight - radius,
      z: actor.z,
    },
    fov,
    aspect,
  });
  const safeFov = Number.isFinite(fov) && fov > 1 ? fov : 46;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const tanHalfV = Math.tan((safeFov * Math.PI) / 360);
  const tanHalfH = tanHalfV * safeAspect;
  const safeDepth = Math.max(0.001, face.depth - radius);
  return {
    left: face.x - radius / (safeDepth * tanHalfH),
    right: face.x + radius / (safeDepth * tanHalfH),
    bottom: face.y - radius / (safeDepth * tanHalfV),
    top: face.y + radius / (safeDepth * tanHalfV),
    depth: face.depth,
  };
}

const isDialogueHeadSafe = (bounds) => (
  bounds.left >= DIALOGUE_FACE_SAFE.minX
  && bounds.right <= DIALOGUE_FACE_SAFE.maxX
  && bounds.bottom >= DIALOGUE_FACE_SAFE.minY
  && bounds.top <= DIALOGUE_FACE_SAFE.maxY
);

const cameraPlan = ({
  angle, target, distance, height, lookHeight, speaker, speakerHeadHeight,
  listener, listenerHeadHeight,
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
  const speakerBounds = projectedHeadBounds({
    cameraPos,
    cameraLook,
    actor: speaker,
    headHeight: speakerHeadHeight,
    fov,
    aspect,
  });
  return {
    angle, target, distance, height, lookHeight, path: 'arc', kind,
    speakerBounds,
    speakerFaceSafe: isDialogueHeadSafe(speakerBounds),
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
    speaker,
    speakerHeadHeight,
    listener,
    listenerHeadHeight,
    fov,
    aspect,
    kind: 'ots',
  });
  if (
    !forceSingle
    && ots.speakerFaceSafe
    && ots.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND
  ) {
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
        speaker,
        speakerHeadHeight,
        listener,
        listenerHeadHeight,
        fov,
        aspect,
        kind: 'single',
      });
      plan.otsOccupancy = ots.foregroundOccupancy;
      if (
        !best
        || (plan.speakerFaceSafe && !best.speakerFaceSafe)
        || (
          plan.speakerFaceSafe === best.speakerFaceSafe
          && plan.foregroundOccupancy < best.foregroundOccupancy
        )
      ) best = plan;
      if (
        plan.speakerFaceSafe
        && plan.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND
      ) return plan;
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

export const GROUP_FACE_SAFE = Object.freeze({
  minX: -0.82, maxX: 0.82,
  minY: -0.7, maxY: 0.72,
});
export const MAX_GROUP_HEAD_OCCLUSION = 0.08;
export const MAX_VISIBLE_DIALOGUE_ROUTE_MS = 3200;
export const MAX_VISIBLE_GROUP_ROUTE_MS = 4200;
export const MIN_VISIBLE_DIALOGUE_MOVE_MS = 1200;
// ── HOW FAST A LENS MAY SWING AROUND A SUBJECT ──────────────────────────────
//
// Every visible reframe was given a flat ~1.2s no matter how far it had to go.
// A dialogue REVERSE — behind Judah's shoulder to behind Reuben's — is about
// 130 degrees of arc, so it was orbiting the pair at nearly two radians a
// second. That is not a camera move, it is a whip, and it crosses the line
// between the speakers on the way past. Nate: "sometimes it just jumps and cuts
// camera angles like a glitch".
//
// 0.42 rad/s (about 24 degrees a second) is a stately orbit. Anything that
// cannot be covered at that speed inside the visible-route ceiling is not a
// move at all — it is a CUT, and it gets the short dip that this scene already
// uses as its cut grammar everywhere else.
export const MAX_ORBIT_RAD_PER_S = 0.42;
// The bearing a camera sits on, as CameraDirector means it: the lens is at
// target - (sin a, cos a) * distance, so its bearing FROM the target is a + PI.
export function cameraAngleFrom(cameraPos, target) {
  return Math.atan2(cameraPos.x - target.x, cameraPos.z - target.z) - Math.PI;
}
export function shortestAngleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// The time a visible reframe needs so it never exceeds the orbit speed.
export function comfortableRouteMs(fromAngle, toAngle, authoredMs) {
  const swing = Math.abs(shortestAngleDelta(fromAngle, toAngle));
  return Math.max(
    MIN_VISIBLE_DIALOGUE_MOVE_MS,
    authoredMs || 0,
    (swing / MAX_ORBIT_RAD_PER_S) * 1000,
  );
}

export function projectedHeadOcclusion(a, b) {
  const near = a.depth <= b.depth ? a : b;
  const far = near === a ? b : a;
  const width = Math.max(0, Math.min(near.right, far.right) - Math.max(near.left, far.left));
  const height = Math.max(0, Math.min(near.top, far.top) - Math.max(near.bottom, far.bottom));
  const farArea = Math.max(0.000001, (far.right - far.left) * (far.top - far.bottom));
  return (width * height) / farArea;
}

export function maxProjectedHeadOcclusion(bounds) {
  let max = 0;
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      max = Math.max(max, projectedHeadOcclusion(bounds[i], bounds[j]));
    }
  }
  return max;
}

export function planGroupCamera({
  actors,
  angle,
  distance = 6,
  height = 2.7,
  look = 1.2,
  fov = 46,
  aspect = 16 / 9,
  maxDistance = 30,
}) {
  const visible = (actors || []).filter(Boolean);
  if (!visible.length) throw new Error('planGroupCamera requires at least one actor');
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const actor of visible) {
    minX = Math.min(minX, actor.x);
    maxX = Math.max(maxX, actor.x);
    minZ = Math.min(minZ, actor.z);
    maxZ = Math.max(maxZ, actor.z);
  }
  const target = {
    x: (minX + maxX) / 2,
    y: 0,
    z: (minZ + maxZ) / 2,
  };
  const angleOffsets = [0];
  // Search only inside the same screen axis. If this window cannot separate
  // the cast, the blocking—not a surprise reverse angle—must be re-authored.
  for (let offset = 0.06; offset <= 1.08 + 0.001; offset += 0.06) {
    angleOffsets.push(offset, -offset);
  }
  let last = null;
  let bestSafe = null;
  // Preserve the authored side of the axis first. Widening a group shot is
  // preferable to reversing everybody's screen direction just to stay close;
  // oversized responsive moves are already protected by a covered reframe.
  for (const offset of angleOffsets) {
    // EXACT pruning: compositionScore = candidate + |offset|·10 + occlusion·2
    // with occlusion ≥ 0 and strict-< replacement, so any candidate whose
    // lower bound (candidate + |offset|·10) cannot strictly beat the best
    // safe plan can never change the result. |offset| is non-decreasing along
    // angleOffsets, so once an offset's FIRST candidate is out, every later
    // offset is too. `last` only matters when no safe plan exists — and then
    // nothing is ever pruned. Return value is bit-identical to the full scan
    // (differential-proven in tools/test-dialogue-camera-safety.mjs); the old
    // exhaustive scan burned ~2,200 allocating projection poses per call on
    // visible frames even after the winner was already found.
    if (bestSafe && Math.max(3.2, distance) + Math.abs(offset) * 10 >= bestSafe.compositionScore) break;
    for (
      let candidate = Math.max(3.2, distance);
      candidate <= Math.max(distance, maxDistance) + 0.001;
      candidate += 0.4
    ) {
      if (bestSafe && candidate + Math.abs(offset) * 10 >= bestSafe.compositionScore) break;
      const candidateAngle = angle + offset;
      const cameraLook = { x: target.x, y: look, z: target.z };
      let bounds = null;
      let faceSafe = true;
      let headOcclusion = 0;
      // Certify the whole bounded drift envelope, not only the centre pose.
      // Slow readers may hold this frame for a minute.
      for (const driftScale of [-1, -0.5, 0, 0.5, 1]) {
        const driftAngle = candidateAngle + driftScale * CINEMATIC_DRIFT_ANGLE;
        const cameraPos = {
          x: target.x - Math.sin(driftAngle) * candidate,
          y: height,
          z: target.z - Math.cos(driftAngle) * candidate,
        };
        const driftBounds = visible.map((actor) => projectedHeadBounds({
          cameraPos,
          cameraLook,
          actor,
          headHeight: actor.headHeight ?? 1.65,
          fov,
          aspect,
        }));
        if (driftScale === 0) bounds = driftBounds;
        faceSafe &&= driftBounds.every((box) => (
          box.left >= GROUP_FACE_SAFE.minX
          && box.right <= GROUP_FACE_SAFE.maxX
          && box.bottom >= GROUP_FACE_SAFE.minY
          && box.top <= GROUP_FACE_SAFE.maxY
        ));
        headOcclusion = Math.max(
          headOcclusion,
          maxProjectedHeadOcclusion(driftBounds),
        );
      }
      const plan = {
        angle: candidateAngle,
        authoredAngle: angle,
        angleOffset: offset,
        target,
        distance: candidate,
        height,
        lookHeight: look,
        bounds,
        faceSafe,
        headOcclusion,
        compositionSafe: faceSafe && headOcclusion <= MAX_GROUP_HEAD_OCCLUSION,
      };
      if (plan.compositionSafe) {
        // A modest same-axis angle adjustment is preferable to pulling the
        // portrait camera so far back that the family becomes tiny.
        plan.compositionScore = candidate + Math.abs(offset) * 10 + headOcclusion * 2;
        if (!bestSafe || plan.compositionScore < bestSafe.compositionScore) {
          bestSafe = plan;
        }
      }
      if (
        !last
        || (plan.faceSafe && !last.faceSafe)
        || (
          plan.faceSafe === last.faceSafe
          && plan.headOcclusion < last.headOcclusion - 0.001
        )
        || (
          plan.faceSafe === last.faceSafe
          && Math.abs(plan.headOcclusion - last.headOcclusion) <= 0.001
          && Math.abs(plan.angleOffset) < Math.abs(last.angleOffset)
        )
      ) last = plan;
    }
  }
  return bestSafe || last;
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
  // SEATED ON THE SOUTH ARC, facing north across the fire — so the camera
  // that watches them stands NORTH and looks back over the whole lived-in
  // camp. The seats used to be on the north arc, which forced the camera to
  // the south side looking out at the empty border: measured backdrop 83
  // against this project's floor of 165, with dot(look, sun) +0.62 (straight
  // into the key, so every face was a silhouette). Both halves of
  // "the back of the camp... opposite side of the sun", in one shot.
  const TELL_RING = TELLING_RING_SEATS;
  const ringXZ = tellingRingXZ;
  const placeCameraSpectator = (npc, slot, focus = FIRE) => {
    npc.target = null;
    npc.stuckT = 0;
    npc.onArrive?.resolve?.(false);
    npc.onArrive = null;
    npc.pos.x = slot.x;
    npc.pos.z = slot.z;
    npc.circle.x = slot.x;
    npc.circle.z = slot.z;
    npc.char.setPosition(slot.x, slot.z);
    ctx.npcs.freeze(npc, true);
    npc.char.turnToward(focus.x - slot.x, focus.z - slot.z);
    npc.char.play('idle');
  };
  const stageTellingAmbient = () => {
    TELLING_AMBIENT_KEYS.forEach((key, index) => {
      const npc = ctx.cast[key];
      if (npc) placeCameraSpectator(npc, TELLING_AMBIENT_SLOTS[index]);
    });
  };
  const reserveTellingAmbient = async () => {
    TELLING_AMBIENT_KEYS.forEach((key) => {
      const npc = ctx.cast[key];
      if (npc) ctx.npcs.freeze(npc, true);
    });
  };
  const releaseTellingAmbient = () => {
    TELLING_AMBIENT_KEYS.forEach((key) => {
      const npc = ctx.cast[key];
      if (npc) ctx.npcs.freeze(npc, false);
    });
  };
  const stageCoatEnvySpectators = () => {
    COAT_ENVY_SPECTATOR_KEYS.forEach((key, index) => {
      const npc = ctx.cast[key];
      if (npc) placeCameraSpectator(
        npc,
        COAT_ENVY_SPECTATOR_SLOTS[index],
        { x: 0.8, z: -7.6 },
      );
    });
  };
  const releaseCoatEnvySpectators = () => {
    COAT_ENVY_SPECTATOR_KEYS.forEach((key) => {
      const npc = ctx.cast[key];
      if (npc) ctx.npcs.freeze(npc, false);
    });
  };
  const moveCameraSafely = async (spec, {
    authoredMs,
    maxVisibleMs,
  }) => {
    // Short visible reverses read as a snap even when mathematically eased, and
    // long ones read as a whip. Price the move by how far the lens actually has
    // to swing around this subject, not by a flat authored number: at most
    // MAX_ORBIT_RAD_PER_S, never under the 1.2s floor.
    const from = cameraAngleFrom(ctx.camera.camera.position, spec.target);
    const duration = comfortableRouteMs(
      from,
      spec.angle,
      spec.duration ?? authoredMs,
    );
    const comfortableSpec = { ...spec, duration };
    const moveMs = ctx.camera.cinematicMoveTo(comfortableSpec) ?? duration;
    if (moveMs <= maxVisibleMs) {
      await wait(moveMs);
      return { covered: false, moveMs };
    }

    // Too far to travel calmly, so it is not a travel: it is a CUT. That covers
    // the classic dialogue reverse (about 130 degrees, which used to whip round
    // the pair in 1.2s and cross the line on the way) and the responsive
    // portrait wides that sit 18u+ from the circle. Land the composition under
    // a short dip and reveal the exact authored endpoint — an edit, not a
    // blackout.
    await ctx.cinema.fade(true, 150);
    ctx.camera.cutTo({
      ...comfortableSpec,
      path: 'linear',
      arcCenter: null,
      arcRadius: 0,
      arcDirection: 0,
    });
    await ctx.cinema.fade(false, 190);
    return { covered: true, moveMs: 340 };
  };
  const groupShot = (names, {
    angle,
    distance = 6,
    height = 2.7,
    look = 1.2,
    ms = 1600,
    arcRadius = 6.4,
    arcDirection = 0,
  }) => ({
    t: 'fn',
    fn: async () => {
      const lens = ctx.camera.camera;
      const actors = names.map((who) => {
        const position = posOf(who);
        return {
          x: position.x,
          y: position.y ?? 0,
          z: position.z,
          headHeight: charOf(who).headHeight,
        };
      });
      const plan = planGroupCamera({
        actors,
        angle,
        distance,
        height,
        look,
        fov: lens?.fov ?? 46,
        aspect: lens?.aspect ?? 16 / 9,
      });
      if (!plan.compositionSafe) {
        throw new Error(
          `No audience-safe group composition (${(plan.headOcclusion * 100).toFixed(1)}% head overlap)`,
        );
      }
      await moveCameraSafely({
        ...plan,
        duration: ms,
        path: 'groupArc',
        arcCenter: FIRE,
        arcRadius,
        arcDirection,
      }, {
        authoredMs: ms,
        maxVisibleMs: MAX_VISIBLE_GROUP_ROUTE_MS,
      });
    },
  });

  // Dialogue cinematography: an over-the-shoulder SHOT computed from LIVE
  // positions — camera behind the listener's shoulder, speaker favored on the
  // near third. Alternate `side` sign between cuts to swap shoulders.
  // D9 framing law (Nate): these characters have BIG heads — every dialogue
  // camera keeps more air (dist ≥3.2, raised, looking slightly down) so a
  // skull can never fill the lens or turn its back to it.
  const posOf = (who) => (who === 'joseph' ? ctx.joseph.position : ctx.cast[who].pos);
  const charOf = (who) => (who === 'joseph' ? ctx.joseph : ctx.cast[who].char);
  const shot = (speaker, listener, {
    side = 0.42,
    dist = 3.2,
    height = 1.75,
    look = 1.25,
    ms = 850,
    speakerAnim = 'talk',
    arcRadius = 6.4,
    arcDirection = 0,
  } = {}) => ({
    t: 'fn',
    fn: async () => {
      const sp = posOf(speaker), li = posOf(listener);
      // the two face each other; the speaker plays the calm talk gesture
      // (never a walk/run cycle) — cutscene facing is always correct.
      charOf(speaker).turnToward(li.x - sp.x, li.z - sp.z);
      if (speakerAnim) charOf(speaker).play(speakerAnim);
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
      // A line never begins while its speaker is still outside the safe
      // frame. Small moves land normally; very large reverse angles use the
      // covered reframe above instead of making dialogue wait in darkness.
      await moveCameraSafely({
        angle: plan.angle,
        target: plan.target,
        distance: plan.distance,
        height: plan.height,
        lookHeight: plan.lookHeight,
        duration: ms,
        path: groupArc ? 'groupArc' : plan.path,
        arcCenter: groupArc ? FIRE : null,
        arcRadius: groupArc ? arcRadius : 0,
        arcDirection: groupArc ? arcDirection : 0,
      }, {
        authoredMs: ms,
        maxVisibleMs: MAX_VISIBLE_DIALOGUE_ROUTE_MS,
      });
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
    // Same orbit law as every other visible reframe. Callers must await the
    // returned moveMs rather than a hard-coded twin of `ms`, or a line can
    // begin while the lens is still travelling.
    const moveMs = ms <= 1 ? 1 : comfortableRouteMs(
      cameraAngleFrom(ctx.camera.camera.position, plan.target),
      plan.angle,
      ms,
    );
    ctx.camera.cinematicMoveTo({
      angle: plan.angle,
      target: plan.target,
      // distMax: INTERIOR shots cap the pull-back so the lens can never
      // back out through the tent shell (D11 — Nate saw the outside)
      distance: plan.distance,
      height: plan.height, lookHeight: plan.lookHeight, duration: moveMs,
      path: groupArc ? 'groupArc' : 'arc',
      arcCenter: groupArc ? FIRE : null,
      arcRadius: groupArc ? 6.4 : 0,
    });
    plan.moveMs = moveMs;
    return plan;
  };

  const pointToGate = (pen) => ({ x: pen.minX + 0.6, z: (pen.gate.z0 + pen.gate.z1) / 2 });

  return {
    seq, wait, gate, J, FIRE, TELL_RING, ringXZ,
    TELLING_AMBIENT_KEYS, TELLING_AMBIENT_SLOTS,
    posOf, charOf, shot, twoShot, groupShot, pointToGate,
    reserveTellingAmbient, releaseTellingAmbient, stageTellingAmbient,
    stageCoatEnvySpectators, releaseCoatEnvySpectators,
  };
}
