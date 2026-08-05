import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CameraDirector, CINEMATIC_DRIFT_ANGLE } from '../src/engine/CameraDirector.js';
import {
  BETRAYAL_STRIP_CAMERA,
  BETRAYAL_MARCH_CAMERA,
  BETRAYAL_FALL_CAMERA,
  BETRAYAL_PROWL_ORBIT,
  betrayalFallFov,
  COAT_ENVY_SPECTATOR_KEYS,
  COAT_ENVY_SPECTATOR_SLOTS,
  DIALOGUE_FACE_SAFE,
  GROUP_FACE_SAFE,
  MAX_GROUP_HEAD_OCCLUSION,
  MAX_DIALOGUE_FOREGROUND,
  TELLING_AMBIENT_KEYS,
  TELLING_AMBIENT_SLOTS,
  makeHelpers,
  planDialogueCamera,
  planTwoShotCamera,
  projectedAnchorNdc,
  projectedHeadBounds,
  projectedHeadOcclusion,
  maxProjectedHeadOcclusion,
  writeBetrayalFallCameraPose,
  planGroupCamera,
} from '../src/scenes/joseph3d/beats/helpers.js';
import {
  DUSK_FIRE,
  DUSK_JOSEPH_MARK,
  DUSK_RING,
  HERD_DIRECTION_JOSEPH_MARK,
  HERD_DIRECTION_MARKS,
  planHerdDirectionCamera,
} from '../src/scenes/joseph3d/beats/camp.js';
import {
  TELLING_JOSEPH_MARK,
} from '../src/scenes/joseph3d/beats/telling.js';

const PORTRAIT = 390 / 844;
const LANDSCAPE = 844 / 390;
const DESKTOP = 1440 / 900;

// The herd prompt accepts a whole 3.4u disc. One valid edge arc used to place
// Joseph within 0.47u of a fixed brother, make every camera plan unsafe, then
// throw after the veil/input were already owned. Runtime now stages Joseph too.
{
  const trigger = { x: 0.8, z: -6.5, r: 3.4 };
  const stage = [HERD_DIRECTION_JOSEPH_MARK, ...HERD_DIRECTION_MARKS];
  for (let i = 0; i < stage.length; i++) {
    for (let j = 0; j < i; j++) {
      assert.ok(
        Math.hypot(stage[i].x - stage[j].x, stage[i].z - stage[j].z) >= 1,
        `herd-direction staged actors ${i}/${j} overlap`,
      );
    }
  }
  let samples = 0;
  let maxDistance = 0;
  let maxHeadOcclusion = 0;
  for (const radius of [0, 1.7, 3.399]) {
    for (let degrees = 0; degrees < 360; degrees += 2) {
      const angle = degrees * Math.PI / 180;
      const entry = {
        x: trigger.x + Math.cos(angle) * radius,
        z: trigger.z + Math.sin(angle) * radius,
      };
      assert.ok(
        Math.hypot(entry.x - trigger.x, entry.z - trigger.z) <= trigger.r,
        'herd-direction sweep generated an invalid trigger entry',
      );
      for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
        const plan = planHerdDirectionCamera({
          aspect,
          josephHeadHeight: 1.55,
          brotherHeadHeights: [1.7, 1.62],
        });
        assert.equal(
          plan.compositionSafe,
          true,
          `herd directions unsafe at ${degrees}° / r=${radius} / aspect=${aspect.toFixed(3)}`,
        );
        maxDistance = Math.max(maxDistance, plan.distance);
        maxHeadOcclusion = Math.max(maxHeadOcclusion, plan.headOcclusion);
        samples += 1;
      }
    }
  }
  assert.equal(samples, 1620);
  console.log(
    `herd directions: ${samples} trigger/aspect plans, `
      + `max ${maxDistance.toFixed(1)}u, head overlap ${(maxHeadOcclusion * 100).toFixed(1)}%`,
  );
}

{
  // Both tellings now begin only after the player presses the nearby sit
  // prompt. All actors are seated under black, so the camera proof owns only
  // the authored circle instead of a hidden pathfinder.
  const ringAngles = [3.4, 4.15, 5.0, 5.75];
  const closeActors = [
    { ...TELLING_JOSEPH_MARK, headHeight: 1.65 },
    ...ringAngles.map((angle) => ({
      x: Math.cos(angle) * 2.2,
      z: -6 + Math.sin(angle) * 2.2,
      headHeight: 1.65,
    })),
    { x: -2.6, z: -4.4, headHeight: 1.65 },
  ];
  for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
    const plan = planGroupCamera({
      actors: closeActors,
      angle: 0.35,
      distance: 4.5,
      height: 2.2,
      look: 1.3,
      fov: 46,
      aspect,
    });
    assert.ok(plan.compositionSafe, `telling close unsafe at aspect ${aspect}`);
  }
  console.log('Telling covered circle: safe across portrait, landscape, and desktop.');
}

const fullHeadBounds = (plan, actor, headHeight, aspect) => {
  const headRadius = Math.min(0.36, Math.max(0.26, headHeight * 0.18));
  const cameraPos = {
    x: plan.target.x - Math.sin(plan.angle) * plan.distance,
    y: (plan.target.y ?? 0) + plan.height,
    z: plan.target.z - Math.cos(plan.angle) * plan.distance,
  };
  const cameraLook = {
    x: plan.target.x,
    y: (plan.target.y ?? 0) + plan.lookHeight,
    z: plan.target.z,
  };
  const face = projectedAnchorNdc({
    cameraPos,
    cameraLook,
    point: {
      x: actor.x,
      y: (actor.y ?? 0) + headHeight - headRadius,
      z: actor.z,
    },
    fov: 46,
    aspect,
  });
  const tanHalfV = Math.tan((46 * Math.PI) / 360);
  const tanHalfH = tanHalfV * aspect;
  const safeDepth = Math.max(0.001, face.depth - headRadius);
  return {
    left: face.x - headRadius / (safeDepth * tanHalfH),
    right: face.x + headRadius / (safeDepth * tanHalfH),
    bottom: face.y - headRadius / (safeDepth * tanHalfV),
    top: face.y + headRadius / (safeDepth * tanHalfV),
    depth: face.depth,
  };
};

const assertFullHeadSafe = (bounds, label) => {
  assert.ok(
    bounds.left >= DIALOGUE_FACE_SAFE.minX
      && bounds.right <= DIALOGUE_FACE_SAFE.maxX
      && bounds.bottom >= DIALOGUE_FACE_SAFE.minY
      && bounds.top <= DIALOGUE_FACE_SAFE.maxY,
    `${label} full speaker head is unsafe: `
      + `x=[${bounds.left.toFixed(3)},${bounds.right.toFixed(3)}], `
      + `y=[${bounds.bottom.toFixed(3)},${bounds.top.toFixed(3)}]`,
  );
};

const foregroundHeadOcclusion = (speaker, possibleOccluder) => {
  if (possibleOccluder.depth >= speaker.depth) return 0;
  const overlapWidth = Math.max(
    0,
    Math.min(speaker.right, possibleOccluder.right)
      - Math.max(speaker.left, possibleOccluder.left),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(speaker.top, possibleOccluder.top)
      - Math.max(speaker.bottom, possibleOccluder.bottom),
  );
  const speakerArea = Math.max(0.001, speaker.right - speaker.left)
    * Math.max(0.001, speaker.top - speaker.bottom);
  return (overlapWidth * overlapHeight) / speakerArea;
};

// The same close pair is unsafe as an OTS in portrait but acceptable in wide
// landscape. Portrait must automatically become a clean speaker single.
const responsiveCase = {
  speaker: { x: 0, y: 0, z: 0 },
  listener: { x: 0, y: 0, z: 0.8 },
  speakerHeadHeight: 1.65,
  listenerHeadHeight: 1.65,
  side: 0.05,
  dist: 3.2,
  height: 1.85,
  look: 1.25,
  fov: 46,
};
const portraitPlan = planDialogueCamera({ ...responsiveCase, aspect: PORTRAIT });
assert.equal(portraitPlan.kind, 'single', 'unsafe portrait OTS did not fall back to a clean single');
assert.ok(portraitPlan.otsOccupancy > MAX_DIALOGUE_FOREGROUND, 'portrait fixture is no longer an unsafe OTS');
assert.ok(
  portraitPlan.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND,
  `portrait foreground occupies ${(portraitPlan.foregroundOccupancy * 100).toFixed(1)}%`,
);
const portraitCamera = {
  x: portraitPlan.target.x - Math.sin(portraitPlan.angle) * portraitPlan.distance,
  z: portraitPlan.target.z - Math.cos(portraitPlan.angle) * portraitPlan.distance,
};
const speakerForward = new THREE.Vector2(
  responsiveCase.listener.x - responsiveCase.speaker.x,
  responsiveCase.listener.z - responsiveCase.speaker.z,
).normalize();
const speakerToCamera = new THREE.Vector2(
  portraitCamera.x - responsiveCase.speaker.x,
  portraitCamera.z - responsiveCase.speaker.z,
).normalize();
const frontDot = speakerForward.dot(speakerToCamera);
assert.ok(frontDot > 0.45 && frontDot < 0.85, `fallback is not a three-quarter front (${frontDot.toFixed(3)})`);

const landscapePlan = planDialogueCamera({ ...responsiveCase, aspect: LANDSCAPE });
assert.equal(landscapePlan.kind, 'ots', 'safe landscape OTS was widened unnecessarily');
assert.ok(
  landscapePlan.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND,
  `landscape foreground occupies ${(landscapePlan.foregroundOccupancy * 100).toFixed(1)}%`,
);

// A slow reader may hold a dialogue frame for a minute. Global cinematic
// drift must remain inside the authored composition instead of accumulating
// until another head crosses the lens.
const heldCamera = new THREE.PerspectiveCamera(46, PORTRAIT, 0.1, 300);
const heldDirector = new CameraDirector(heldCamera, { minGroundY: -100 });
heldDirector.setTarget(new THREE.Vector3(
  responsiveCase.speaker.x,
  responsiveCase.speaker.y,
  responsiveCase.speaker.z,
));
heldDirector.snap();
heldDirector.setDrift(true);
heldDirector.cutTo(portraitPlan);
let heldSpeakerMargin = Infinity;
let heldListenerOcclusion = 0;
let heldActorClearance = Infinity;
for (let elapsed = 0; elapsed <= 60000; elapsed += 16) {
  heldDirector.frame(16);
  const cameraPos = heldCamera.position;
  const cameraLook = heldDirector.pose.look;
  const speakerBounds = projectedHeadBounds({
    cameraPos,
    cameraLook,
    actor: responsiveCase.speaker,
    headHeight: responsiveCase.speakerHeadHeight,
    fov: 46,
    aspect: PORTRAIT,
  });
  const listenerBounds = projectedHeadBounds({
    cameraPos,
    cameraLook,
    actor: responsiveCase.listener,
    headHeight: responsiveCase.listenerHeadHeight,
    fov: 46,
    aspect: PORTRAIT,
  });
  heldSpeakerMargin = Math.min(
    heldSpeakerMargin,
    speakerBounds.left - DIALOGUE_FACE_SAFE.minX,
    DIALOGUE_FACE_SAFE.maxX - speakerBounds.right,
    speakerBounds.bottom - DIALOGUE_FACE_SAFE.minY,
    DIALOGUE_FACE_SAFE.maxY - speakerBounds.top,
  );
  heldListenerOcclusion = Math.max(
    heldListenerOcclusion,
    projectedHeadOcclusion(speakerBounds, listenerBounds),
  );
  for (const actor of [responsiveCase.speaker, responsiveCase.listener]) {
    heldActorClearance = Math.min(
      heldActorClearance,
      Math.hypot(
        cameraPos.x - actor.x,
        cameraPos.y - (actor.y + 1.4),
        cameraPos.z - actor.z,
      ),
    );
  }
}
assert.ok(
  heldSpeakerMargin > 0,
  `bounded drift cropped the speaker during a 60s hold (${heldSpeakerMargin.toFixed(3)} NDC)`,
);
assert.ok(
  heldListenerOcclusion <= MAX_DIALOGUE_FOREGROUND,
  `bounded drift let the listener cover ${(heldListenerOcclusion * 100).toFixed(1)}% of the speaker`,
);
assert.ok(
  heldActorClearance > 1.5,
  `bounded drift approached an actor head (${heldActorClearance.toFixed(3)}u)`,
);

// Integration: both dialogue helpers explicitly request arc replacement.
const calls = [];
const mkChar = (x, z) => ({
  position: new THREE.Vector3(x, 0, z),
  headHeight: 1.65,
  turnToward() {},
  play() {},
});
const joseph = mkChar(0, 0);
const judahChar = mkChar(0, 0.8);
const helperCtx = {
  signal: null,
  isPaused: () => false,
  joseph,
  cast: { judah: { pos: judahChar.position, char: judahChar } },
  camera: {
    camera: new THREE.PerspectiveCamera(46, PORTRAIT, 0.1, 300),
    cinematicMoveTo(options) { calls.push(options); },
  },
  sequencer: { run: async () => {} },
};
const helpers = makeHelpers(helperCtx);
await helpers.shot('joseph', 'judah', { side: 0.05, ms: 0 }).fn();
helpers.twoShot('joseph', 'judah', { ms: 0 });
assert.equal(calls[0].path, 'arc', 'dialogue shot did not opt into an arc replacement');
assert.equal(calls[1].path, 'arc', 'two-shot did not opt into an arc replacement');
assert.ok(calls[0].distance >= 3.2, 'dialogue shot bypassed the distance floor');
assert.ok(calls[1].distance >= 3.2, 'two-shot bypassed the distance floor');

// A route whose safe duration would feel like a stalled scene must become a
// fully covered synchronous cut. Assert the exact ownership order—especially
// cutTo before fade-off—so a low-fps device can never reveal the old lens.
{
  const coveredOrder = [];
  const coveredHelpers = makeHelpers({
    signal: null,
    isPaused: () => false,
    joseph: mkChar(0, 0),
    cast: { judah: { pos: new THREE.Vector3(0, 0, 0.8), char: mkChar(0, 0.8) } },
    camera: {
      camera: new THREE.PerspectiveCamera(46, PORTRAIT, 0.1, 300),
      cinematicMoveTo() {
        coveredOrder.push('move');
        return 16000;
      },
      cutTo() { coveredOrder.push('cut'); },
    },
    cinema: {
      async fade(on) { coveredOrder.push(on ? 'fade:on' : 'fade:off'); },
    },
    sequencer: { run: async () => {} },
  });
  await coveredHelpers.shot('joseph', 'judah').fn();
  assert.deepEqual(
    coveredOrder,
    ['move', 'fade:on', 'cut', 'fade:off'],
    'large dialogue route was not landed synchronously under a fully opaque veil',
  );
}

// The spectator arc may be staged only under black. Once visible, reserving
// the dialogue corridor must freeze actors in place—never invoke a blocked
// cross-camp walk followed by a many-unit snap.
{
  let sendToCalls = 0;
  const ambientCast = Object.fromEntries(TELLING_AMBIENT_KEYS.map((key) => [
    key,
    {
      pos: { x: 99, z: 99 },
      circle: { x: 99, z: 99 },
      target: null,
      onArrive: null,
      char: {
        state: 'idle',
        setPosition(x, z) { this.x = x; this.z = z; },
        turnToward() {},
        play(state) { this.state = state; },
      },
    },
  ]));
  const ambientHelpers = makeHelpers({
    signal: null,
    isPaused: () => false,
    joseph: mkChar(0, 0),
    cast: ambientCast,
    camera: { camera: new THREE.PerspectiveCamera(46, DESKTOP, 0.1, 300) },
    sequencer: { run: async () => {} },
    npcs: {
      freeze(npc, on) { npc.frozen = on; },
      sendTo() { sendToCalls += 1; return Promise.resolve(true); },
    },
  });
  ambientHelpers.stageTellingAmbient();
  TELLING_AMBIENT_KEYS.forEach((key, index) => {
    assert.deepEqual(ambientCast[key].pos, TELLING_AMBIENT_SLOTS[index]);
  });
  ambientHelpers.releaseTellingAmbient();
  const visiblePositions = TELLING_AMBIENT_KEYS.map((key) => ({ ...ambientCast[key].pos }));
  await ambientHelpers.reserveTellingAmbient();
  assert.equal(sendToCalls, 0, 'visible corridor reservation started a cross-camp walk');
  TELLING_AMBIENT_KEYS.forEach((key, index) => {
    assert.deepEqual(ambientCast[key].pos, visiblePositions[index],
      `${key} moved while reserving the visible lens corridor`);
    assert.equal(ambientCast[key].frozen, true, `${key} kept wandering through dialogue`);
  });
}

// Coat-envy uses the same covered-staging rule, extended to Simeon and Levi.
// Start every spectator on the speaker axis to prove the live staging call,
// rather than a pre-sanitized fixture, is what removes the obstruction.
{
  const spectatorCast = Object.fromEntries(COAT_ENVY_SPECTATOR_KEYS.map((key) => [
    key,
    {
      pos: { x: 0.8, z: -7.6 },
      circle: { x: 0.8, z: -7.6 },
      target: { x: 0, z: 0 },
      stuckT: 3,
      onArrive: { resolve() {} },
      char: {
        setPosition(x, z) { this.x = x; this.z = z; },
        turnToward() {},
        play(state) { this.state = state; },
      },
    },
  ]));
  const spectatorHelpers = makeHelpers({
    signal: null,
    isPaused: () => false,
    joseph: mkChar(0, 0),
    cast: spectatorCast,
    camera: { camera: new THREE.PerspectiveCamera(46, DESKTOP, 0.1, 300) },
    sequencer: { run: async () => {} },
    npcs: { freeze(npc, on) { npc.frozen = on; } },
  });
  spectatorHelpers.stageCoatEnvySpectators();
  COAT_ENVY_SPECTATOR_KEYS.forEach((key, index) => {
    assert.deepEqual(spectatorCast[key].pos, COAT_ENVY_SPECTATOR_SLOTS[index]);
    assert.equal(spectatorCast[key].frozen, true);
  });
  spectatorHelpers.releaseCoatEnvySpectators();
  assert.ok(
    COAT_ENVY_SPECTATOR_KEYS.every((key) => spectatorCast[key].frozen === false),
    'coat-envy spectators remained frozen after the sequence',
  );
}

// The real telling-circle orbit -> Judah reply formerly took a straight chord
// within ~0.65u of Joseph's head. The arc must remain outside every actor.
const FIRE = { x: 0, z: -6 };
const ring = (a) => ({ x: Math.cos(a) * 2.2, y: 0, z: -6 + Math.sin(a) * 2.2 });
const cast = {
  joseph: { x: 0.9, y: 0, z: -4.1 },
  judah: ring(3.4),
  reuben: ring(4.15),
  simeon: ring(5.0),
  levi: ring(5.75),
  jacob: { x: -2.6, y: 0, z: -4.4 },
};
const authoredReplies = [
  ['joseph', 'judah', 0.4, 3.2, 2.15],
  ['judah', 'joseph', -0.42, 2.6, 2.1],
  ['joseph', 'reuben', 0.9, 4.4, 2.15],
  ['joseph', 'jacob', 0.7, 3.8, 2.15],
  ['jacob', 'joseph', -0.7, 3.8, 2.1],
];
let worstReplyHeadMargin = Infinity;
let maxStagedAmbientOcclusion = 0;
for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
  for (const [speaker, listener, side, dist, height] of authoredReplies) {
    const plan = planDialogueCamera({
      speaker: cast[speaker],
      listener: cast[listener],
      speakerHeadHeight: 1.65,
      listenerHeadHeight: 1.65,
      side,
      dist,
      height,
      look: 1.15,
      fov: 46,
      aspect,
    });
    assert.ok(
      plan.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND,
      `${speaker}/${listener} foreground exceeds 25% at aspect ${aspect.toFixed(3)}`,
    );
    const bounds = fullHeadBounds(plan, cast[speaker], 1.65, aspect);
    assertFullHeadSafe(bounds, `${speaker}/${listener} at aspect ${aspect.toFixed(3)}`);
    worstReplyHeadMargin = Math.min(
      worstReplyHeadMargin,
      bounds.left - DIALOGUE_FACE_SAFE.minX,
      DIALOGUE_FACE_SAFE.maxX - bounds.right,
      bounds.bottom - DIALOGUE_FACE_SAFE.minY,
      DIALOGUE_FACE_SAFE.maxY - bounds.top,
    );
    for (const slot of TELLING_AMBIENT_SLOTS) {
      const ambientBounds = fullHeadBounds(plan, { ...slot, y: 0 }, 1.65, aspect);
      maxStagedAmbientOcclusion = Math.max(
        maxStagedAmbientOcclusion,
        foregroundHeadOcclusion(bounds, ambientBounds),
      );
    }
  }
}
assert.ok(
  maxStagedAmbientOcclusion <= 0.05,
  `staged ambient actor covers ${(maxStagedAmbientOcclusion * 100).toFixed(1)}% of a speaker head`,
);

let maxResponsiveGroupDistance = 0;
let maxResponsiveGroupOcclusion = 0;
let maxResponsiveGroupAngleOffset = 0;
for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
  for (const spec of [
    {
      actors: ['joseph', 'judah', 'reuben', 'simeon', 'levi'],
      angle: Math.PI, distance: 5.7, height: 2.7, look: 1.2,
    },
    {
      actors: ['joseph', 'judah', 'reuben', 'simeon', 'levi', 'jacob'],
      angle: 0.35, distance: 4.5, height: 2.2, look: 1.3,
    },
  ]) {
    const plan = planGroupCamera({
      actors: spec.actors.map((key) => ({ ...cast[key], headHeight: 1.65 })),
      angle: spec.angle,
      distance: spec.distance,
      height: spec.height,
      look: spec.look,
      fov: 46,
      aspect,
    });
    assert.equal(
      plan.faceSafe,
      true,
      `responsive group wide failed at aspect ${aspect.toFixed(3)}`,
    );
    assert.equal(
      plan.compositionSafe,
      true,
      `responsive group wide blocks a face at aspect ${aspect.toFixed(3)} `
        + `(${(plan.headOcclusion * 100).toFixed(1)}%)`,
    );
    assert.ok(
      plan.headOcclusion <= MAX_GROUP_HEAD_OCCLUSION,
      `responsive group wide hides ${(plan.headOcclusion * 100).toFixed(1)}% of a rear head`,
    );
    maxResponsiveGroupDistance = Math.max(maxResponsiveGroupDistance, plan.distance);
    maxResponsiveGroupOcclusion = Math.max(maxResponsiveGroupOcclusion, plan.headOcclusion);
    maxResponsiveGroupAngleOffset = Math.max(
      maxResponsiveGroupAngleOffset,
      Math.abs(plan.angleOffset),
    );
    for (const bounds of plan.bounds) {
      assert.ok(
        bounds.left >= GROUP_FACE_SAFE.minX
          && bounds.right <= GROUP_FACE_SAFE.maxX
          && bounds.bottom >= GROUP_FACE_SAFE.minY
          && bounds.top <= GROUP_FACE_SAFE.maxY,
        `responsive group wide cropped a head at aspect ${aspect.toFixed(3)}`,
      );
    }
  }
}
assert.ok(
  maxResponsiveGroupAngleOffset <= 1.1,
  `responsive group solver crossed the screen axis (${maxResponsiveGroupAngleOffset.toFixed(3)} rad)`,
);

// Keep the regression sensitive to the real stochastic failure: worker1's
// former legal wander pose could stand in front of Joseph without overlapping
// another actor capsule.
{
  const fixturePlan = planDialogueCamera({
    speaker: cast.joseph,
    listener: cast.judah,
    speakerHeadHeight: 1.65,
    listenerHeadHeight: 1.65,
    side: 0.4,
    dist: 3.2,
    height: 2.15,
    look: 1.15,
    fov: 46,
    aspect: DESKTOP,
  });
  const speakerBounds = fullHeadBounds(fixturePlan, cast.joseph, 1.65, DESKTOP);
  const oldWorkerBounds = fullHeadBounds(
    fixturePlan,
    { x: 0.15, y: 0, z: -4.5 },
    1.65,
    DESKTOP,
  );
  const oldWorkerOcclusion = foregroundHeadOcclusion(speakerBounds, oldWorkerBounds);
  assert.ok(
    oldWorkerOcclusion > 0.7,
    `ambient-camera fixture no longer reproduces the old block (${(oldWorkerOcclusion * 100).toFixed(1)}%)`,
  );
}
const tellingCamera = new THREE.PerspectiveCamera(46, LANDSCAPE, 0.1, 300);
const tellingDirector = new CameraDirector(tellingCamera, { minGroundY: -100 });
tellingDirector.setTarget(new THREE.Vector3(0, 0, 0));
tellingDirector.snap();
tellingDirector.cinematicMoveTo({
  angle: Math.PI * 0.55 + 3.4,
  target: FIRE,
  distance: 6.1,
  height: 3.05,
  lookHeight: 1.15,
  duration: 1,
});
tellingDirector.frame(16);
const replyPlan = planDialogueCamera({
  speaker: cast.judah,
  listener: cast.joseph,
  speakerHeadHeight: 1.65,
  listenerHeadHeight: 1.65,
  side: -0.42,
  dist: 2.6,
  height: 2.1,
  look: 1.15,
  fov: 46,
  aspect: LANDSCAPE,
});
const tellingReplyDuration = tellingDirector.cinematicMoveTo({
  ...replyPlan,
  duration: 850,
  path: 'groupArc',
  arcCenter: FIRE,
  arcRadius: 9,
});
let minActorClearance = Infinity;
let tellingWellMargin = Infinity;
let tellingMaxStep = 0;
const previousTellingPosition = tellingCamera.position.clone();
for (let i = 0; i < Math.ceil(tellingReplyDuration / 16) + 2; i++) {
  tellingDirector.frame(16);
  tellingMaxStep = Math.max(
    tellingMaxStep,
    tellingCamera.position.distanceTo(previousTellingPosition),
  );
  previousTellingPosition.copy(tellingCamera.position);
  const wellRoofRadius = tellingCamera.position.y < 2.15 || tellingCamera.position.y > 2.95
    ? 0
    : 1.8 * (1 - Math.abs(tellingCamera.position.y - 2.55) / 0.4);
  tellingWellMargin = Math.min(
    tellingWellMargin,
    Math.hypot(tellingCamera.position.x - 4.5, tellingCamera.position.z + 1)
      - wellRoofRadius,
  );
  for (const actor of Object.values(cast)) {
    minActorClearance = Math.min(
      minActorClearance,
      Math.hypot(
        tellingCamera.position.x - actor.x,
        tellingCamera.position.y - 1.4,
        tellingCamera.position.z - actor.z,
      ),
    );
  }
}
assert.ok(
  minActorClearance > 1.25,
  `telling arc crossed an actor head (${minActorClearance.toFixed(3)}u clearance)`,
);
assert.ok(
  tellingWellMargin > 0.45,
  `telling arc enters the well roof (${tellingWellMargin.toFixed(3)}u margin)`,
);
assert.ok(
  tellingMaxStep < 0.12,
  `telling arc moves ${tellingMaxStep.toFixed(3)}u in 16ms`,
);

// Exercise the complete family-circle shot progression, not only one signed
// pair. Each visible change uses the fixed-centre group path: radially out,
// orbit around the cast, then radially in. This catches a regression where a
// mathematically smooth chord still travelled directly through another head.
const groupCamera = new THREE.PerspectiveCamera(46, LANDSCAPE, 0.1, 300);
const groupDirector = new CameraDirector(groupCamera, { minGroundY: -100 });
groupDirector.setTarget(new THREE.Vector3(0, 0, 0));
groupDirector.snap();
groupDirector.cinematicMoveTo({
  angle: Math.PI * 0.55 + 3.4,
  target: FIRE,
  distance: 6.1,
  height: 3.05,
  lookHeight: 1.15,
  duration: 1,
});
groupDirector.frame(16);

const dialoguePlan = (speaker, listener, side, dist, height) => planDialogueCamera({
  speaker: cast[speaker],
  listener: cast[listener],
  speakerHeadHeight: 1.65,
  listenerHeadHeight: 1.65,
  side,
  dist,
  height,
  look: 1.15,
  fov: 46,
  aspect: LANDSCAPE,
});
const groupMoves = [
  {
    ...dialoguePlan('judah', 'joseph', -0.42, 2.6, 2.1),
    duration: 850,
    arcRadius: 9,
  },
  {
    angle: Math.PI, target: { x: 0.3, z: -5.7 },
    distance: 5.7, height: 2.7, lookHeight: 1.2, duration: 1600,
  },
  { ...dialoguePlan('joseph', 'reuben', 0.9, 4.4, 2.15), duration: 850 },
  {
    angle: Math.PI, target: { x: 0.1, z: -5.8 },
    distance: 6.5, height: 3.05, lookHeight: 1.2, duration: 1400,
  },
  { ...dialoguePlan('joseph', 'jacob', 0.7, 3.8, 2.15), duration: 850 },
  { ...dialoguePlan('jacob', 'joseph', -0.7, 3.8, 2.1), duration: 850 },
  {
    angle: 0.35, target: { x: 0.2, z: -6.6 },
    distance: 4.5, height: 2.2, lookHeight: 1.3, duration: 2200,
  },
  { ...dialoguePlan('jacob', 'joseph', -0.7, 3.8, 2.1), duration: 850 },
];
let allGroupClearance = Infinity;
let groupMinInfo = '';
let groupMaxStep = 0;
const previousGroupPosition = groupCamera.position.clone();
for (let moveIndex = 0; moveIndex < groupMoves.length; moveIndex++) {
  const move = groupMoves[moveIndex];
  const moveDuration = groupDirector.cinematicMoveTo({
    ...move,
    path: 'groupArc',
    arcCenter: FIRE,
    arcRadius: move.arcRadius ?? 6.4,
  });
  const samples = Math.ceil(moveDuration / 16) + 2;
  for (let i = 0; i < samples; i++) {
    groupDirector.frame(16);
    groupMaxStep = Math.max(
      groupMaxStep,
      groupCamera.position.distanceTo(previousGroupPosition),
    );
    previousGroupPosition.copy(groupCamera.position);
    for (const [actorName, actor] of Object.entries(cast)) {
      const clearance = Math.hypot(
          groupCamera.position.x - actor.x,
          groupCamera.position.y - 1.4,
          groupCamera.position.z - actor.z,
      );
      if (clearance < allGroupClearance) {
        allGroupClearance = clearance;
        groupMinInfo = `move ${moveIndex}, ${actorName}, sample ${i}`;
      }
    }
  }
}
assert.ok(
  allGroupClearance > 1.35,
  `a family-circle camera route crossed an actor head (${allGroupClearance.toFixed(3)}u; ${groupMinInfo})`,
);
assert.ok(
  groupMaxStep < 0.12,
  `a family-circle camera route moved ${groupMaxStep.toFixed(3)}u in 16ms`,
);

// Dusk is a separate, tighter ring. Reproduce the covered responsive master,
// both visible speaker changes, and the release back to gameplay.
const duskCast = Object.fromEntries(DUSK_RING.map(([key, angle]) => [
  key,
  {
    x: DUSK_FIRE.x + Math.cos(angle) * 1.8,
    y: 0,
    z: DUSK_FIRE.z + Math.sin(angle) * 1.8,
    headHeight: 1.65,
  },
]));
duskCast.joseph = { ...DUSK_JOSEPH_MARK, y: 0, headHeight: 1.65 };
let duskActorClearance = Infinity;
let duskMaxStep = 0;
let duskReleaseMaxStep = 0;
for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
  const camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 300);
  const director = new CameraDirector(camera, { minGroundY: -100 });
  director.setTarget(new THREE.Vector3(
    DUSK_JOSEPH_MARK.x,
    0,
    DUSK_JOSEPH_MARK.z,
  ));
  director.snap();
  const master = planGroupCamera({
    actors: Object.values(duskCast),
    angle: Math.PI,
    distance: 5.2,
    height: 2.25,
    look: 1.05,
    fov: 46,
    aspect,
  });
  assert.equal(master.faceSafe, true, `dusk master crops portrait at ${aspect.toFixed(3)}`);
  assert.equal(master.compositionSafe, true,
    `dusk master allows a foreground head to cover a speaker at ${aspect.toFixed(3)} `
    + `(max ${(master.maxHeadOcclusion * 100).toFixed(1)}%)`);
  director.cinematicMoveTo({ ...master, duration: 1 });
  director.frame(16);
  const previous = camera.position.clone();
  for (const plan of [
    planDialogueCamera({
      speaker: duskCast.judah,
      listener: duskCast.joseph,
      speakerHeadHeight: 1.65,
      listenerHeadHeight: 1.65,
      side: -0.5,
      dist: 3.8,
      height: 2.1,
      look: 1.15,
      fov: 46,
      aspect,
    }),
    planDialogueCamera({
      speaker: duskCast.joseph,
      listener: duskCast.judah,
      speakerHeadHeight: 1.65,
      listenerHeadHeight: 1.65,
      side: 0.5,
      dist: 3.8,
      height: 2.1,
      look: 1.15,
      fov: 46,
      aspect,
    }),
  ]) {
    assert.equal(plan.speakerFaceSafe, true, 'dusk speaker leaves the face-safe frame');
    const moveMs = director.cinematicMoveTo({
      ...plan,
      duration: 1600,
      path: 'groupArc',
      arcCenter: DUSK_FIRE,
      arcRadius: 6.4,
    });
    for (let elapsed = 0; elapsed <= moveMs + 16; elapsed += 16) {
      director.frame(16);
      duskMaxStep = Math.max(duskMaxStep, camera.position.distanceTo(previous));
      previous.copy(camera.position);
      for (const actor of Object.values(duskCast)) {
        duskActorClearance = Math.min(
          duskActorClearance,
          Math.hypot(
            camera.position.x - actor.x,
            camera.position.y - 1.4,
            camera.position.z - actor.z,
          ),
        );
      }
    }
  }
  director.release(1600);
  for (let elapsed = 0; elapsed <= 1616; elapsed += 16) {
    director.frame(16);
    duskReleaseMaxStep = Math.max(
      duskReleaseMaxStep,
      camera.position.distanceTo(previous),
    );
    previous.copy(camera.position);
  }
}
assert.ok(
  duskActorClearance > 1.5,
  `dusk camera crosses a seated head (${duskActorClearance.toFixed(3)}u)`,
);
assert.ok(duskMaxStep < 0.12, `dusk camera moves ${duskMaxStep.toFixed(3)}u in 16ms`);
assert.ok(
  duskReleaseMaxStep < 0.16,
  `dusk camera release jumps ${duskReleaseMaxStep.toFixed(3)}u in 16ms`,
);

// The lone walk first completes its group route, then enables live tracking.
// Combining a precomputed arc and a moving target used to jump 3.662u on the
// frame where _poseMoveK reached one.
const loneCamera = new THREE.PerspectiveCamera(46, DESKTOP, 0.1, 300);
const loneDirector = new CameraDirector(loneCamera, { minGroundY: -100 });
loneDirector.setTarget(new THREE.Vector3(cast.joseph.x, 0, cast.joseph.z));
loneDirector.snap();
const jacobPlan = planDialogueCamera({
  speaker: cast.jacob,
  listener: cast.joseph,
  speakerHeadHeight: 1.65,
  listenerHeadHeight: 1.65,
  side: -0.7,
  dist: 3.8,
  height: 2.1,
  look: 1.2,
  fov: 46,
  aspect: DESKTOP,
});
loneDirector.cinematicMoveTo({ ...jacobPlan, duration: 1 });
loneDirector.frame(16);
const loneAngle = Math.PI * 0.9;
const loneDistance = 6.4;
const loneRouteMs = loneDirector.cinematicMoveTo({
  angle: loneAngle,
  target: cast.joseph,
  distance: loneDistance,
  height: 3.1,
  lookHeight: 1.2,
  duration: 3200,
  path: 'groupArc',
  arcCenter: FIRE,
  arcRadius: 6.4,
});
let loneMaxStep = 0;
const previousLonePosition = loneCamera.position.clone();
for (let elapsed = 0; elapsed <= loneRouteMs + 16; elapsed += 16) {
  loneDirector.frame(16);
  loneMaxStep = Math.max(
    loneMaxStep,
    loneCamera.position.distanceTo(previousLonePosition),
  );
  previousLonePosition.copy(loneCamera.position);
}
const movingLoneJoseph = { ...cast.joseph };
loneDirector.setPoseDriver((pose) => {
  pose.pos.set(
    movingLoneJoseph.x - Math.sin(loneAngle) * loneDistance,
    3.1,
    movingLoneJoseph.z - Math.cos(loneAngle) * loneDistance,
  );
  pose.look.set(movingLoneJoseph.x, 1.2, movingLoneJoseph.z);
});
const loneGoal = { x: -4.6, z: -2 };
const loneWalkMs = Math.hypot(
  loneGoal.x - movingLoneJoseph.x,
  loneGoal.z - movingLoneJoseph.z,
) / 1.15 * 1000;
for (let elapsed = 0; elapsed <= loneWalkMs; elapsed += 16) {
  const k = Math.min(1, elapsed / loneWalkMs);
  movingLoneJoseph.x = cast.joseph.x + (loneGoal.x - cast.joseph.x) * k;
  movingLoneJoseph.z = cast.joseph.z + (loneGoal.z - cast.joseph.z) * k;
  loneDirector.frame(16);
  loneMaxStep = Math.max(
    loneMaxStep,
    loneCamera.position.distanceTo(previousLonePosition),
  );
  previousLonePosition.copy(loneCamera.position);
}
loneDirector.setPoseDriver(null);
assert.ok(
  loneMaxStep < 0.12,
  `lone-walk camera jumps ${loneMaxStep.toFixed(3)}u in 16ms`,
);

// Coat gift: reproduce the live post-walk positions. The corrected shot must
// sit at Joseph's rear three-quarter, clear Jacob, and remain under the conical
// tent cloth for every eased sample.
const TENT = { x: -62, z: -34, radius: 6, height: 6 };
const coatJoseph = { x: -61, y: 0, z: -33.1 };
const jacobStart = { x: -62.8, y: 0, z: -34.5 };
const startSep = Math.hypot(coatJoseph.x - jacobStart.x, coatJoseph.z - jacobStart.z);
const jacob = {
  x: jacobStart.x + ((coatJoseph.x - jacobStart.x) / startSep) * (startSep - 0.95),
  y: 0,
  z: jacobStart.z + ((coatJoseph.z - jacobStart.z) / startSep) * (startSep - 0.95),
};

// Exercise every visible tent dialogue endpoint at both required aspect
// shapes. Before Jacob walks, portrait uses his clean single; after the pair
// closes, the compact relationship two-shot fits again. Landscape retains all
// authored two-shots. Every visible tween stays under the conical cloth.
const tentPlanSpecs = [
  { a: jacobStart, towardB: 0.32, distMax: 3.35, height: 1.9, look: 1.18, label: 'entry' },
  { a: jacobStart, towardB: 0.32, distMax: 3.35, height: 1.9, look: 1.18, label: 'line-1' },
  { a: jacobStart, towardB: 0.44, distMax: 3.35, height: 1.9, look: 1.18, label: 'line-2' },
  { a: jacobStart, towardB: 0.36, distMax: 3.35, height: 1.9, look: 1.18, label: 'line-3' },
  { a: jacobStart, towardB: 0.6, distMax: 3.4, height: 1.9, look: 1.2, label: 'gift-wide' },
  { a: jacob, towardB: 0.6, distMax: 3.3, height: 1.85, look: 1.2, label: 'gift-close' },
];
const clothMargin = (position) => {
  const radial = Math.hypot(position.x - TENT.x, position.z - TENT.z);
  const clothRadiusAtY = TENT.radius * (1 - position.y / TENT.height);
  return clothRadiusAtY - radial;
};
let responsiveTentMargin = Infinity;
for (const aspect of [PORTRAIT, LANDSCAPE]) {
  const plans = tentPlanSpecs.map((spec) => planTwoShotCamera({
    a: spec.a,
    b: coatJoseph,
    aHeadHeight: 1.65,
    bHeadHeight: 1.65,
    distMin: 3.2,
    distMax: spec.distMax,
    height: spec.height,
    look: spec.look,
    towardB: spec.towardB,
    fov: 46,
    aspect,
    responsiveSpeaker: 'a',
  }));
  if (aspect === PORTRAIT) {
    assert.deepEqual(
      plans.map((plan) => plan.kind),
      ['single', 'single', 'single', 'single', 'single', 'single'],
      'portrait tent grammar no longer protects both full heads with clean singles',
    );
  } else {
    assert.ok(plans.every((plan) => plan.kind === 'two'), 'landscape tent needlessly abandoned a two-shot');
  }

  const routeCamera = new THREE.PerspectiveCamera(46, aspect, 0.1, 300);
  const routeDirector = new CameraDirector(routeCamera, { minGroundY: -100 });
  routeDirector.setTarget(new THREE.Vector3(coatJoseph.x, 0, coatJoseph.z));
  routeDirector.snap();
  routeDirector.setDrift(true);
  for (let planIndex = 0; planIndex < plans.length; planIndex++) {
    const plan = plans[planIndex];
    const duration = planIndex === 0 ? 1 : 950;
    routeDirector.cinematicMoveTo({ ...plan, duration, path: 'arc' });
    const samples = Math.ceil(duration / 16) + 2;
    for (let sample = 0; sample < samples; sample++) {
      routeDirector.frame(16);
      // Entry is replaced under black; every later route is visible.
      if (planIndex > 0) responsiveTentMargin = Math.min(
        responsiveTentMargin,
        clothMargin(routeCamera.position),
      );
    }
    const endpointMargin = clothMargin(routeDirector.pose.pos);
    assert.ok(
      endpointMargin > 0.25,
      `${tentPlanSpecs[planIndex].label} leaves the tent at aspect ${aspect.toFixed(3)}`,
    );
    if (plan.kind === 'two') {
      assert.ok(plan.faceSafe, `${tentPlanSpecs[planIndex].label} accepted an unsafe two-shot`);
    } else {
      const cameraPos = {
        x: plan.target.x - Math.sin(plan.angle) * plan.distance,
        y: (plan.target.y ?? 0) + plan.height,
        z: plan.target.z - Math.cos(plan.angle) * plan.distance,
      };
      const face = projectedAnchorNdc({
        cameraPos,
        cameraLook: {
          x: plan.target.x,
          y: (plan.target.y ?? 0) + plan.lookHeight,
          z: plan.target.z,
        },
        point: {
          x: tentPlanSpecs[planIndex].a.x,
          y: 1.43,
          z: tentPlanSpecs[planIndex].a.z,
        },
        fov: 46,
        aspect,
      });
      assert.ok(
        face.x >= DIALOGUE_FACE_SAFE.minX && face.x <= DIALOGUE_FACE_SAFE.maxX
          && face.y >= DIALOGUE_FACE_SAFE.minY && face.y <= DIALOGUE_FACE_SAFE.maxY,
        `${tentPlanSpecs[planIndex].label} Jacob single left the portrait face-safe frame`,
      );
      assert.ok(
        plan.foregroundOccupancy <= MAX_DIALOGUE_FOREGROUND,
        `${tentPlanSpecs[planIndex].label} portrait listener exceeds 25%`,
      );
    }

    // Dialogue holds with the real NEVER-STATIC drift, so endpoint safety is
    // not enough. Keep each line alive at player-reading speed; the longer
    // post-walk gift hold covers coat equip + Joseph's turn.
    const visibleFaces = plan.kind === 'two'
      ? [tentPlanSpecs[planIndex].a, coatJoseph]
      : [tentPlanSpecs[planIndex].a];
    const holdMs = planIndex === plans.length - 1 ? 4000 : 2500;
    for (let held = 0; held < holdMs; held += 16) {
      routeDirector.frame(16);
      responsiveTentMargin = Math.min(responsiveTentMargin, clothMargin(routeCamera.position));
      routeCamera.updateMatrixWorld();
      for (const actor of visibleFaces) {
        const face = new THREE.Vector3(actor.x, 1.43, actor.z).project(routeCamera);
        assert.ok(
          face.x >= DIALOGUE_FACE_SAFE.minX && face.x <= DIALOGUE_FACE_SAFE.maxX
            && face.y >= DIALOGUE_FACE_SAFE.minY && face.y <= DIALOGUE_FACE_SAFE.maxY,
          `${tentPlanSpecs[planIndex].label} drifts a face out at aspect ${aspect.toFixed(3)}`,
        );
      }
    }
  }

  const behindAngle = Math.atan2(jacob.x - coatJoseph.x, jacob.z - coatJoseph.z) + 1.0;
  routeDirector.cinematicMoveTo({
    angle: behindAngle,
    target: coatJoseph,
    distance: 3.1,
    height: 1.7,
    lookHeight: 1.1,
    duration: 1400,
    path: 'arc',
  });
  for (let sample = 0; sample < 90; sample++) {
    routeDirector.frame(16);
    responsiveTentMargin = Math.min(responsiveTentMargin, clothMargin(routeCamera.position));
  }
}
assert.ok(
  responsiveTentMargin > 0.2,
  `a responsive tent path leaves the cloth (${responsiveTentMargin.toFixed(3)}u margin)`,
);

const pairAxis = Math.atan2(coatJoseph.x - jacob.x, coatJoseph.z - jacob.z);
const pairTarget = {
  x: (jacob.x + coatJoseph.x) / 2,
  z: (jacob.z + coatJoseph.z) / 2,
};
const tentCamera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
const tentDirector = new CameraDirector(tentCamera, { minGroundY: -100 });
tentDirector.setTarget(new THREE.Vector3(coatJoseph.x, 0, coatJoseph.z));
tentDirector.snap();
tentDirector.cinematicMoveTo({
  angle: pairAxis - Math.PI / 2 - 0.6,
  target: pairTarget,
  distance: 3.3,
  height: 1.9,
  lookHeight: 1.2,
  duration: 1,
});
tentDirector.frame(16);
const behindJosephAngle = Math.atan2(jacob.x - coatJoseph.x, jacob.z - coatJoseph.z) + 1.0;
tentDirector.cinematicMoveTo({
  angle: behindJosephAngle,
  target: coatJoseph,
  distance: 3.1,
  height: 1.7,
  lookHeight: 1.1,
  duration: 1400,
  path: 'arc',
});

let minJacobClearance = Infinity;
let minTentMargin = Infinity;
for (let i = 0; i < 88; i++) {
  tentDirector.frame(16);
  minJacobClearance = Math.min(
    minJacobClearance,
    Math.hypot(
      tentCamera.position.x - jacob.x,
      tentCamera.position.y - 1.5,
      tentCamera.position.z - jacob.z,
    ),
  );
  const radial = Math.hypot(tentCamera.position.x - TENT.x, tentCamera.position.z - TENT.z);
  const clothRadiusAtY = TENT.radius * (1 - tentCamera.position.y / TENT.height);
  minTentMargin = Math.min(minTentMargin, clothRadiusAtY - radial);
}
assert.ok(minJacobClearance > 3.2, `coat-back lens approaches Jacob by ${minJacobClearance.toFixed(3)}u`);
assert.ok(minTentMargin > 0.25, `coat-back path leaves the tent by ${(-minTentMargin).toFixed(3)}u`);

const coatEndpoint = new THREE.Vector3(
  coatJoseph.x - Math.sin(behindJosephAngle) * 3.1,
  1.7,
  coatJoseph.z - Math.cos(behindJosephAngle) * 3.1,
);
assert.ok(tentDirector.pose.pos.distanceTo(coatEndpoint) < 1e-9, 'coat-back authored endpoint changed');
const josephToJacob = new THREE.Vector2(jacob.x - coatJoseph.x, jacob.z - coatJoseph.z).normalize();
const josephToCamera = new THREE.Vector2(
  coatEndpoint.x - coatJoseph.x,
  coatEndpoint.z - coatJoseph.z,
).normalize();
const rearThreeQuarter = josephToJacob.dot(josephToCamera);
assert.ok(
  rearThreeQuarter < -0.35 && rearThreeQuarter > -0.85,
  `coat camera is not a rear three-quarter (${rearThreeQuarter.toFixed(3)})`,
);

// Betrayal prowl -> strip: dialogue duration can end the orbit at any phase.
// The visible transition is covered, and all phases must therefore land on
// one identical endpoint that clears the full escort formation and pit rim.
// LINE ENDINGS MUST NOT COUNT. Several assertions below use a bounded window
// (`[\s\S]{0,500}`) between two tokens, and this repo checks out with CRLF on
// Windows (core.autocrlf) — which adds one character per line. Measured: the
// SHOT 3 -> groupArc window is 495 characters with LF and 507 with CRLF, so a
// 500-character window passed on the machine that wrote it and failed on a
// fresh clone, on code nobody had touched. Normalise once, here.
const readSource = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
  .split('\r\n').join('\n');
const coldOpenSource = readSource('../src/scenes/joseph3d/beats/coldOpen.js');
const tellingSource = readSource('../src/scenes/joseph3d/beats/telling.js');
const campCameraSource = readSource('../src/scenes/joseph3d/beats/camp.js');
const loneSourceStart = tellingSource.indexOf('const lone =');
const loneSourceEnd = tellingSource.indexOf("heading: 'To be continued'", loneSourceStart);
assert.ok(loneSourceStart >= 0 && loneSourceEnd > loneSourceStart);
assert.doesNotMatch(
  tellingSource.slice(loneSourceStart, loneSourceEnd),
  /duration:\s*3200[\s\S]{0,120}awaitMs:\s*false/,
  'lone tracking starts before its authored group route completes',
);
const coveredMarker = coldOpenSource.indexOf('Dialogue timing can leave the prowl at any phase');
const coverOn = coldOpenSource.indexOf("{ t: 'fade', on: true", coveredMarker);
const fixedStrip = coldOpenSource.indexOf('...BETRAYAL_STRIP_CAMERA', coveredMarker);
const coverOff = coldOpenSource.indexOf("{ t: 'fade', on: false", fixedStrip);
assert.ok(
  coveredMarker >= 0 && coverOn > coveredMarker && fixedStrip > coverOn && coverOff > fixedStrip,
  'betrayal prowl replacement is no longer fully covered by black',
);
assert.doesNotMatch(
  coldOpenSource,
  /Math\.PI \* 0\.22[\s\S]{0,180}distance: 2\.9/,
  'unsafe Reuben-adjacent strip endpoint returned',
);

const PIT = { x: -62, z: 6 };
const escortEnd = { x: PIT.x + 2.6, z: PIT.z + 0.2 };
const safeBrotherPoint = (x, z) => {
  const dx = x - PIT.x, dz = z - PIT.z;
  const distance = Math.hypot(dx, dz);
  if (distance >= 3) return { x, y: 0, z };
  const scale = 3 / (distance || 1);
  return { x: PIT.x + dx * scale, y: 0, z: PIT.z + dz * scale };
};
const escortOffsets = [
  [-1.35, -1.95],
  [0.35, 1.25],
  [0.45, -1.25],
  [1.6, 0.55],
];
const escortActors = escortOffsets.map(([dx, dz]) => (
  safeBrotherPoint(escortEnd.x + dx, escortEnd.z + dz)
));
const stripLook = {
  x: (escortEnd.x + escortActors[1].x) / 2,
  y: 0,
  z: (escortEnd.z + escortActors[1].z) / 2,
};
const expectedStripEndpoint = new THREE.Vector3(
  stripLook.x - Math.sin(BETRAYAL_STRIP_CAMERA.angle) * BETRAYAL_STRIP_CAMERA.distance,
  BETRAYAL_STRIP_CAMERA.height,
  stripLook.z - Math.cos(BETRAYAL_STRIP_CAMERA.angle) * BETRAYAL_STRIP_CAMERA.distance,
);

// The complete march camera remains attached to Joseph while all five actors
// move. The former fixed opening let Levi walk through the lens before the
// supposedly safe prowl even began.
const prowlSourceStart = coldOpenSource.indexOf('const g = { x: to.x - 0.3');
const prowlCoverOn = coldOpenSource.indexOf('await ctx.cinema.fade(true, 180)', prowlSourceStart);
const prowlCut = coldOpenSource.indexOf('ctx.camera.cutTo(prowlPlan)', prowlCoverOn);
const prowlCoverOff = coldOpenSource.indexOf('await ctx.cinema.fade(false, 220)', prowlCut);
assert.ok(
  prowlSourceStart >= 0
    && prowlCoverOn > prowlSourceStart
    && prowlCut > prowlCoverOn
    && prowlCoverOff > prowlCut,
  'the responsive march-to-prowl endpoint is not synchronously covered',
);
const marchCamera = new THREE.PerspectiveCamera(46, LANDSCAPE, 0.1, 300);
const marchDirector = new CameraDirector(marchCamera, { minGroundY: -100 });
const marchFrom = { x: PIT.x + 9.2, z: PIT.z + 1.7 };
const marchStarts = escortOffsets.map(([dx, dz]) => ({
  x: marchFrom.x + dx,
  z: marchFrom.z + dz,
}));
const movingJoseph = { ...marchFrom };
marchDirector.setTarget(new THREE.Vector3(marchFrom.x, 0, marchFrom.z));
marchDirector.snap();
marchDirector.cinematicMoveTo({
  angle: BETRAYAL_MARCH_CAMERA.angle,
  target: marchFrom,
  distance: BETRAYAL_MARCH_CAMERA.nearDistance,
  height: BETRAYAL_MARCH_CAMERA.height,
  lookHeight: BETRAYAL_MARCH_CAMERA.lookHeight,
  duration: 1,
});
marchDirector.frame(16);
let marchCameraElapsed = 0;
const smooth01 = (value) => {
  const v = Math.max(0, Math.min(1, value));
  return v * v * (3 - 2 * v);
};
marchDirector.setPoseDriver((pose, dt) => {
  marchCameraElapsed += dt;
  const wideK = smooth01((marchCameraElapsed - 1500) / 4300);
  const distance = BETRAYAL_MARCH_CAMERA.nearDistance
    + (BETRAYAL_MARCH_CAMERA.wideDistance - BETRAYAL_MARCH_CAMERA.nearDistance) * wideK;
  const height = BETRAYAL_MARCH_CAMERA.height
    + (BETRAYAL_MARCH_CAMERA.wideHeight - BETRAYAL_MARCH_CAMERA.height) * wideK;
  pose.pos.set(
    movingJoseph.x - Math.sin(BETRAYAL_MARCH_CAMERA.angle) * distance,
    height,
    movingJoseph.z - Math.cos(BETRAYAL_MARCH_CAMERA.angle) * distance,
  );
  pose.look.set(
    movingJoseph.x,
    BETRAYAL_MARCH_CAMERA.lookHeight,
    movingJoseph.z,
  );
});
const marchDuration = Math.hypot(
  escortEnd.x - marchFrom.x,
  escortEnd.z - marchFrom.z,
) / 0.82 * 1000;
let marchActorClearance = Infinity;
let marchPitClearance = Infinity;
let marchMaxStep = 0;
const previousMarchPosition = marchCamera.position.clone();
for (let elapsed = 0; elapsed <= marchDuration; elapsed += 16) {
  const k = Math.min(1, elapsed / marchDuration);
  movingJoseph.x = marchFrom.x + (escortEnd.x - marchFrom.x) * k;
  movingJoseph.z = marchFrom.z + (escortEnd.z - marchFrom.z) * k;
  marchDirector.frame(16);
  marchMaxStep = Math.max(
    marchMaxStep,
    marchCamera.position.distanceTo(previousMarchPosition),
  );
  previousMarchPosition.copy(marchCamera.position);
  marchPitClearance = Math.min(
    marchPitClearance,
    Math.hypot(marchCamera.position.x - PIT.x, marchCamera.position.z - PIT.z),
  );
  const movingActors = [
    movingJoseph,
    ...marchStarts.map((start, index) => ({
      x: start.x + (escortActors[index].x - start.x) * k,
      z: start.z + (escortActors[index].z - start.z) * k,
    })),
  ];
  for (const actor of movingActors) {
    marchActorClearance = Math.min(
      marchActorClearance,
      Math.hypot(
        marchCamera.position.x - actor.x,
        marchCamera.position.y - 1.4,
        marchCamera.position.z - actor.z,
      ),
    );
  }
}
marchDirector.setPoseDriver(null);
assert.ok(
  marchActorClearance > 3,
  `march camera entered its moving formation (${marchActorClearance.toFixed(3)}u)`,
);
assert.ok(
  marchPitClearance > 6,
  `march camera approached the pit mouth (${marchPitClearance.toFixed(3)}u)`,
);
assert.ok(
  marchMaxStep < 0.03,
  `march tracking stepped ${marchMaxStep.toFixed(3)}u in 16ms`,
);
const prowlTarget = { x: escortEnd.x - 0.3, z: escortEnd.z };
const prowlRadius = Math.max(
  6,
  ...escortActors.map((actor) => (
    Math.hypot(actor.x - prowlTarget.x, actor.z - prowlTarget.z) + 2.2
  )),
);
const prowlActors = [escortEnd, ...escortActors].map((actor) => ({
  ...actor,
  headHeight: 1.65,
}));
let maxProwlHeadOcclusion = 0;
for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
  const plan = planGroupCamera({
    actors: prowlActors,
    angle: Math.PI * 0.45,
    distance: prowlRadius,
    height: 4.2,
    look: 1,
    fov: 46,
    aspect,
  });
  assert.equal(
    plan.compositionSafe,
    true,
    `betrayal speaker group is unreadable at aspect ${aspect.toFixed(3)} `
      + `(${(plan.headOcclusion * 100).toFixed(1)}% overlap)`,
  );
  if (aspect !== PORTRAIT) {
    assert.equal(
      plan.angleOffset,
      0,
      `wide betrayal framing abandoned its authored screen axis at ${aspect.toFixed(3)}`,
    );
  }
  maxProwlHeadOcclusion = Math.max(maxProwlHeadOcclusion, plan.headOcclusion);
  for (const bounds of plan.bounds) {
    assert.ok(
      bounds.left >= GROUP_FACE_SAFE.minX
        && bounds.right <= GROUP_FACE_SAFE.maxX
        && bounds.bottom >= GROUP_FACE_SAFE.minY
        && bounds.top <= GROUP_FACE_SAFE.maxY,
      `betrayal line begins with a head outside the frame at aspect ${aspect.toFixed(3)}`,
    );
  }
  for (let elapsed = 0; elapsed <= 12000; elapsed += 16) {
    const angle = plan.angle
      + Math.sin(elapsed * BETRAYAL_PROWL_ORBIT.rate) * BETRAYAL_PROWL_ORBIT.amplitude;
    const cameraPos = {
      x: plan.target.x - Math.sin(angle) * plan.distance,
      y: plan.height,
      z: plan.target.z - Math.cos(angle) * plan.distance,
    };
    const cameraLook = {
      x: plan.target.x,
      y: plan.lookHeight,
      z: plan.target.z,
    };
    const movingBounds = prowlActors.map((actor) => projectedHeadBounds({
      cameraPos,
      cameraLook,
      actor,
      headHeight: actor.headHeight,
      fov: 46,
      aspect,
    }));
    let movingOcclusion = 0;
    for (let i = 0; i < movingBounds.length; i++) {
      for (let j = i + 1; j < movingBounds.length; j++) {
        movingOcclusion = Math.max(
          movingOcclusion,
          projectedHeadOcclusion(movingBounds[i], movingBounds[j]),
        );
      }
    }
    maxProwlHeadOcclusion = Math.max(maxProwlHeadOcclusion, movingOcclusion);
    assert.ok(
      movingOcclusion <= MAX_GROUP_HEAD_OCCLUSION,
      `bounded betrayal prowl hides ${(movingOcclusion * 100).toFixed(1)}% of a head `
        + `at ${aspect.toFixed(3)} after ${elapsed}ms`,
    );
  }
}
const prowlPlan = planGroupCamera({
  actors: prowlActors,
  angle: Math.PI * 0.45,
  distance: prowlRadius,
  height: 4.2,
  look: 1,
  fov: 46,
  aspect: LANDSCAPE,
});
marchDirector.setDrift(false);
marchDirector.cutTo(prowlPlan);
let prowlElapsed = 0;
marchDirector.setPoseDriver((pose, dt) => {
  prowlElapsed += dt;
  const angle = prowlPlan.angle
    + Math.sin(prowlElapsed * BETRAYAL_PROWL_ORBIT.rate) * BETRAYAL_PROWL_ORBIT.amplitude;
  pose.pos.set(
    prowlPlan.target.x - Math.sin(angle) * prowlPlan.distance,
    prowlPlan.height,
    prowlPlan.target.z - Math.cos(angle) * prowlPlan.distance,
  );
  pose.look.set(prowlPlan.target.x, prowlPlan.lookHeight, prowlPlan.target.z);
});
let prowlPitClearance = Infinity;
let prowlActorClearance = Infinity;
let prowlMinInfo = '';
let prowlMaxStep = 0;
const previousProwlPosition = marchCamera.position.clone();
for (let i = 0; i < Math.ceil(12000 / 16) + 2; i++) {
  marchDirector.frame(16);
  prowlMaxStep = Math.max(
    prowlMaxStep,
    marchCamera.position.distanceTo(previousProwlPosition),
  );
  previousProwlPosition.copy(marchCamera.position);
  prowlPitClearance = Math.min(
    prowlPitClearance,
    Math.hypot(marchCamera.position.x - PIT.x, marchCamera.position.z - PIT.z),
  );
  for (const [actorIndex, actor] of [escortEnd, ...escortActors].entries()) {
    const clearance = Math.hypot(
        marchCamera.position.x - actor.x,
        marchCamera.position.y - 1.4,
        marchCamera.position.z - actor.z,
    );
    if (clearance < prowlActorClearance) {
      prowlActorClearance = clearance;
      prowlMinInfo = `actor ${actorIndex}, sample ${i}`;
    }
  }
}
assert.ok(
  prowlPitClearance > 3,
  `march-to-prowl camera crossed the pit (${prowlPitClearance.toFixed(3)}u radius)`,
);
assert.ok(
  prowlActorClearance > 1.5,
  `march-to-prowl camera crossed an actor head (${prowlActorClearance.toFixed(3)}u; ${prowlMinInfo})`,
);
assert.ok(
  prowlMaxStep < 0.12,
  `march-to-prowl route moved ${prowlMaxStep.toFixed(3)}u in 16ms`,
);

let stripClearance = Infinity;
for (const phase of [0, 0.45, 1.2, 2.4, 4.8]) {
  const phaseCamera = new THREE.PerspectiveCamera(46, LANDSCAPE, 0.1, 300);
  const phaseDirector = new CameraDirector(phaseCamera, { minGroundY: -100 });
  phaseDirector.setTarget(new THREE.Vector3(escortEnd.x, 0, escortEnd.z));
  phaseDirector.snap();
  phaseDirector.cinematicMoveTo({
    angle: Math.PI * 0.45 + phase,
    target: { x: escortEnd.x - 0.3, z: escortEnd.z },
    distance: 6.2,
    height: 4.2,
    lookHeight: 1,
    duration: 1,
  });
  phaseDirector.frame(16);
  phaseDirector.cinematicMoveTo({
    ...BETRAYAL_STRIP_CAMERA,
    target: stripLook,
    duration: 1,
  });
  phaseDirector.frame(16);
  assert.ok(
    phaseDirector.pose.pos.distanceTo(expectedStripEndpoint) < 1e-9,
    `strip endpoint depends on prowl phase ${phase}`,
  );
}
for (const actor of [escortEnd, ...escortActors]) {
  stripClearance = Math.min(
    stripClearance,
    Math.hypot(
      expectedStripEndpoint.x - actor.x,
      expectedStripEndpoint.y - 1.5,
      expectedStripEndpoint.z - actor.z,
    ),
  );
}
assert.ok(stripClearance > 1.5, `strip endpoint approaches an actor head by ${stripClearance.toFixed(3)}u`);
assert.ok(
  Math.hypot(expectedStripEndpoint.x - PIT.x, expectedStripEndpoint.z - PIT.z) > 3,
  'strip camera endpoint sits over the open pit',
);

// Strip -> throw is visible. It must orbit around the fixed pit centre instead
// of taking the Cartesian chord through the open shaft.
assert.match(
  coldOpenSource,
  /SHOT 3[\s\S]{0,500}path:\s*'groupArc'[\s\S]{0,180}arcCenter:\s*P\.PIT/,
  'the visible strip-to-throw replacement is not authored around the pit',
);
const throwCamera = new THREE.PerspectiveCamera(46, PORTRAIT, 0.1, 300);
const throwDirector = new CameraDirector(throwCamera, { minGroundY: -100 });
throwDirector.setTarget(new THREE.Vector3(escortEnd.x, 0, escortEnd.z));
throwDirector.snap();
throwDirector.cinematicMoveTo({
  ...BETRAYAL_STRIP_CAMERA,
  target: stripLook,
  duration: 1,
});
throwDirector.frame(16);
const throwPlan = {
  angle: Math.PI * 4 / 9,
  target: { x: PIT.x + 0.8, z: PIT.z },
  distance: 6,
  height: 1.8,
  lookHeight: 1.2,
};
const throwDuration = throwDirector.cinematicMoveTo({
  ...throwPlan,
  duration: 1400,
  path: 'groupArc',
  arcCenter: PIT,
  arcRadius: 6,
});
let throwPitClearance = Infinity;
let throwActorClearance = Infinity;
let throwMaxStep = 0;
const previousThrowPosition = throwCamera.position.clone();
for (let i = 0; i < Math.ceil(throwDuration / 16) + 2; i++) {
  throwDirector.frame(16);
  throwMaxStep = Math.max(
    throwMaxStep,
    throwCamera.position.distanceTo(previousThrowPosition),
  );
  previousThrowPosition.copy(throwCamera.position);
  throwPitClearance = Math.min(
    throwPitClearance,
    Math.hypot(throwCamera.position.x - PIT.x, throwCamera.position.z - PIT.z),
  );
  for (const actor of [escortEnd, ...escortActors]) {
    throwActorClearance = Math.min(
      throwActorClearance,
      Math.hypot(
        throwCamera.position.x - actor.x,
        throwCamera.position.y - 1.4,
        throwCamera.position.z - actor.z,
      ),
    );
  }
}
assert.ok(
  throwPitClearance >= 3.09,
  `strip-to-throw camera crossed the pit (${throwPitClearance.toFixed(3)}u radius)`,
);
assert.ok(
  throwActorClearance > 1.5,
  `strip-to-throw camera crossed an actor head (${throwActorClearance.toFixed(3)}u)`,
);
assert.ok(
  throwMaxStep < 0.12,
  `strip-to-throw route moved ${throwMaxStep.toFixed(3)}u in 16ms`,
);

// The heave itself must remain readable, not merely the empty pit. Exercise
// Joseph's root at rest, lift, lunge and release in all three supported shapes.
const heavePhases = [
  { x: PIT.x + 2.6, y: 0, z: PIT.z + 0.2 },
  { x: PIT.x + 2.4, y: 0.65, z: PIT.z + 0.16 },
  { x: PIT.x + 1.9, y: 0.55, z: PIT.z + 0.08 },
  { x: PIT.x + 1.62, y: -0.08, z: PIT.z + 0.04 },
];
let throwHeadMargin = Infinity;
for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
  const cameraPos = {
    x: throwPlan.target.x - Math.sin(throwPlan.angle) * throwPlan.distance,
    y: throwPlan.height,
    z: throwPlan.target.z - Math.cos(throwPlan.angle) * throwPlan.distance,
  };
  const cameraLook = {
    x: throwPlan.target.x,
    y: throwPlan.lookHeight,
    z: throwPlan.target.z,
  };
  for (const actor of heavePhases) {
    const bounds = projectedHeadBounds({
      cameraPos,
      cameraLook,
      actor,
      headHeight: 1.65,
      fov: 46,
      aspect,
    });
    const margin = Math.min(
      bounds.left - DIALOGUE_FACE_SAFE.minX,
      DIALOGUE_FACE_SAFE.maxX - bounds.right,
      bounds.bottom - DIALOGUE_FACE_SAFE.minY,
      DIALOGUE_FACE_SAFE.maxY - bounds.top,
    );
    throwHeadMargin = Math.min(throwHeadMargin, margin);
    assertFullHeadSafe(bounds, `throw Joseph at aspect ${aspect.toFixed(3)}`);
  }
}

// Fall close-up: the lens must descend INSIDE the cistern, not merely keep the
// actor projected onscreen from outside the wall. It is intentionally close,
// so hands/feet may crop; Joseph's head and torso must remain visible.
let fallBodyMargin = Infinity;
let fallShaftClearance = Infinity;
let fallHeadBodySeparation = Infinity;
for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
  // The authored exchange leaves Joseph facing Judah at ~0.27 rad. Certify a
  // generous blocking tolerance around that real pose.
  for (const yaw of [0.12, 0.27, 0.42]) {
    for (let sample = 0; sample <= 100; sample++) {
      const k = sample / 100;
      const y0 = 0.74;
      const root = new THREE.Vector3(
        PIT.x + 1.62 * (1 - k),
        y0 - k * (y0 + 3.8),
        PIT.z + 0.04 * (1 - k),
      );
      const rotation = new THREE.Euler(-Math.PI / 2 * k, yaw, 0, 'YXZ');
      const fallCamera = new THREE.PerspectiveCamera(
        betrayalFallFov(aspect, 46),
        aspect,
        0.1,
        300,
      );
      const pose = {
        pos: fallCamera.position,
        look: new THREE.Vector3(),
      };
      writeBetrayalFallCameraPose(pose, {
        pit: PIT,
        joseph: root,
        yaw,
        progress: k,
      });
      fallCamera.lookAt(pose.look);
      fallCamera.updateMatrixWorld();
      const fallHips = new THREE.Vector3(0, 0.55, 0).applyEuler(rotation).add(root).project(fallCamera);
      const fallHead = new THREE.Vector3(0, 1.5, 0).applyEuler(rotation).add(root).project(fallCamera);
      fallHeadBodySeparation = Math.min(
        fallHeadBodySeparation,
        Math.hypot(fallHead.x - fallHips.x, fallHead.y - fallHips.y),
      );
      fallShaftClearance = Math.min(
        fallShaftClearance,
        1.85 - Math.hypot(
          fallCamera.position.x - PIT.x,
          fallCamera.position.z - PIT.z,
        ),
      );
      for (const local of [
        [0, 0.55, 0],
        [0, 1.5, 0],
      ]) {
        const point = new THREE.Vector3(...local).applyEuler(rotation).add(root);
        point.project(fallCamera);
        fallBodyMargin = Math.min(
          fallBodyMargin,
          point.x + 0.98,
          0.98 - point.x,
          point.y + 0.96,
          0.96 - point.y,
        );
      }
    }
  }
}
assert.ok(
  fallBodyMargin > 0,
  `fall face/torso leaves the viewport (${fallBodyMargin.toFixed(3)} NDC)`,
);
assert.ok(
  fallShaftClearance > 0.5,
  `fall lens leaves the shaft interior (${fallShaftClearance.toFixed(3)}u wall clearance)`,
);
assert.ok(
  fallHeadBodySeparation > 0.14,
  `fall lens collapses Joseph's body behind his head (${fallHeadBodySeparation.toFixed(3)} NDC)`,
);

// The walk-off camera tracks the group centroid, so portrait never begins
// with half the brothers outside the frame.
const walkStarts = [
  { x: PIT.x + 2.6, z: PIT.z + 1.2 },
  { x: PIT.x + 3.4, z: PIT.z + 0.2 },
  { x: PIT.x + 3.0, z: PIT.z - 1.0 },
  { x: PIT.x + 4.2, z: PIT.z + 0.8 },
];
let walkHeadMargin = Infinity;
for (const aspect of [PORTRAIT, LANDSCAPE, DESKTOP]) {
  for (let sample = 0; sample <= 100; sample++) {
    const k = sample / 100;
    const actors = walkStarts.map((start) => ({
      x: start.x + k * 7.6,
      y: 0,
      z: start.z - k * 2.6,
    }));
    const center = actors.reduce(
      (sum, actor) => ({ x: sum.x + actor.x / actors.length, z: sum.z + actor.z / actors.length }),
      { x: 0, z: 0 },
    );
    const cameraPos = {
      x: center.x - Math.sin(1.9) * 11.5,
      y: 2.6,
      z: center.z - Math.cos(1.9) * 11.5,
    };
    const cameraLook = { x: center.x, y: 1.1, z: center.z };
    for (const actor of actors) {
      const bounds = projectedHeadBounds({
        cameraPos,
        cameraLook,
        actor,
        headHeight: 1.65,
        fov: 46,
        aspect,
      });
      walkHeadMargin = Math.min(
        walkHeadMargin,
        bounds.left - GROUP_FACE_SAFE.minX,
        GROUP_FACE_SAFE.maxX - bounds.right,
        bounds.bottom - GROUP_FACE_SAFE.minY,
        GROUP_FACE_SAFE.maxY - bounds.top,
      );
    }
  }
}
assert.ok(
  walkHeadMargin > 0,
  `walk-off group leaves a supported viewport (${walkHeadMargin.toFixed(3)} NDC)`,
);

for (const aspect of [PORTRAIT, LANDSCAPE]) {
  const stripCamera = new THREE.PerspectiveCamera(46, aspect, 0.1, 300);
  stripCamera.position.copy(expectedStripEndpoint);
  stripCamera.lookAt(stripLook.x, BETRAYAL_STRIP_CAMERA.lookHeight, stripLook.z);
  stripCamera.updateMatrixWorld();
  for (const [name, actor] of [['Joseph', escortEnd], ['Judah', escortActors[1]]]) {
    const projected = new THREE.Vector3(actor.x, 1.43, actor.z).project(stripCamera);
    assert.ok(
      projected.x >= DIALOGUE_FACE_SAFE.minX && projected.x <= DIALOGUE_FACE_SAFE.maxX
        && projected.y >= DIALOGUE_FACE_SAFE.minY && projected.y <= DIALOGUE_FACE_SAFE.maxY,
      `${name} leaves the strip frame at aspect ${aspect.toFixed(3)}`,
    );
  }
}

// The bedtime camera is a covered cut to an endpoint outside Jacob's tent,
// never a visible glide into the opaque instanced cloth.
const restStart = campCameraSource.indexOf("id: 'rest-night'");
const restCover = campCameraSource.indexOf("{ t: 'fade', on: true, ms: 420 }", restStart);
const restCam = campCameraSource.indexOf('angle: -Math.PI * 0.75', restCover);
const restReveal = campCameraSource.indexOf("{ t: 'fade', on: false, ms: 620 }", restCam);
assert.ok(
  restStart >= 0 && restCover > restStart && restCam > restCover && restReveal > restCam,
  'bedtime camera replacement is no longer fully covered by black',
);
const REST_TARGET = { x: -8.9, z: -4.8 };
const restEndpoint = new THREE.Vector3(
  REST_TARGET.x - Math.sin(-Math.PI * 0.75) * 3.4,
  1.45,
  REST_TARGET.z - Math.cos(-Math.PI * 0.75) * 3.4,
);
const JACOB_TENT = { x: -11, z: -7, radius: 1.7 * 1.35, height: 2.2 * 1.35 };
const restTentRadial = Math.hypot(
  restEndpoint.x - JACOB_TENT.x,
  restEndpoint.z - JACOB_TENT.z,
);
const restTentSection = JACOB_TENT.radius
  * Math.max(0, 1 - restEndpoint.y / JACOB_TENT.height);
const restTentMargin = restTentRadial - restTentSection;
assert.ok(
  restTentMargin > 1,
  `bedtime lens remains inside/against Jacob's tent (${restTentMargin.toFixed(3)}u margin)`,
);

console.log(
  `Dialogue camera safety passed; portrait OTS ${(portraitPlan.otsOccupancy * 100).toFixed(1)}%`
  + ` -> single ${(portraitPlan.foregroundOccupancy * 100).toFixed(1)}%,`
  + ` telling clearance ${Math.min(minActorClearance, allGroupClearance).toFixed(3)}u,`
  + ` Jacob clearance ${minJacobClearance.toFixed(3)}u,`
  + ` tent margin ${Math.min(minTentMargin, responsiveTentMargin).toFixed(3)}u,`
  + ` reply head margin ${worstReplyHeadMargin.toFixed(3)} NDC,`
  + ` group head cover ${(maxResponsiveGroupOcclusion * 100).toFixed(1)}%`
  + ` / axis ${maxResponsiveGroupAngleOffset.toFixed(2)}rad`
  + ` / distance ${maxResponsiveGroupDistance.toFixed(1)}u,`
  + ` 60s hold margin ${heldSpeakerMargin.toFixed(3)} NDC`
  + ` / cover ${(heldListenerOcclusion * 100).toFixed(1)}%`
  + ` / clearance ${heldActorClearance.toFixed(3)}u,`
  + ` ambient head cover ${(maxStagedAmbientOcclusion * 100).toFixed(1)}%,`
  + ` prowl pit/actor ${prowlPitClearance.toFixed(3)}/${prowlActorClearance.toFixed(3)}u`
  + ` / head cover ${(maxProwlHeadOcclusion * 100).toFixed(1)}%,`
  + ` strip clearance ${stripClearance.toFixed(3)}u,`
  + ` throw pit/actor ${throwPitClearance.toFixed(3)}/${throwActorClearance.toFixed(3)}u,`
  + ` fall frame/body ${fallBodyMargin.toFixed(3)}/${fallHeadBodySeparation.toFixed(3)} NDC,`
  + ` walk-off margin ${walkHeadMargin.toFixed(3)} NDC,`
  + ` bedtime tent margin ${restTentMargin.toFixed(3)}u.`,
);

// ── planGroupCamera pruning is EXACT ─────────────────────────────────────────
// The scan now stops once no remaining candidate can strictly beat the best
// safe plan. Differential proof (power-efficiency law): the replaced
// exhaustive scan lives HERE as the reference, both must pick the identical
// plan across randomized casts, and the probe field must contain BOTH
// safe-found and no-safe outcomes (an all-one-outcome probe proves nothing).
function referencePlanGroupCamera({
  actors, angle, distance, height, look, fov, aspect, maxDistance = 30,
}) {
  const visible = (actors || []).filter(Boolean);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const actor of visible) {
    minX = Math.min(minX, actor.x);
    maxX = Math.max(maxX, actor.x);
    minZ = Math.min(minZ, actor.z);
    maxZ = Math.max(maxZ, actor.z);
  }
  const target = { x: (minX + maxX) / 2, y: 0, z: (minZ + maxZ) / 2 };
  const angleOffsets = [0];
  for (let offset = 0.06; offset <= 1.08 + 0.001; offset += 0.06) angleOffsets.push(offset, -offset);
  let last = null;
  let bestSafe = null;
  for (const offset of angleOffsets) {
    for (
      let candidate = Math.max(3.2, distance);
      candidate <= Math.max(distance, maxDistance) + 0.001;
      candidate += 0.4
    ) {
      const candidateAngle = angle + offset;
      const cameraLook = { x: target.x, y: look, z: target.z };
      let bounds = null;
      let faceSafe = true;
      let headOcclusion = 0;
      for (const driftScale of [-1, -0.5, 0, 0.5, 1]) {
        const driftAngle = candidateAngle + driftScale * CINEMATIC_DRIFT_ANGLE;
        const cameraPos = {
          x: target.x - Math.sin(driftAngle) * candidate,
          y: height,
          z: target.z - Math.cos(driftAngle) * candidate,
        };
        const driftBounds = visible.map((actor) => projectedHeadBounds({
          cameraPos, cameraLook, actor, headHeight: actor.headHeight ?? 1.65, fov, aspect,
        }));
        if (driftScale === 0) bounds = driftBounds;
        faceSafe &&= driftBounds.every((box) => (
          box.left >= GROUP_FACE_SAFE.minX && box.right <= GROUP_FACE_SAFE.maxX
          && box.bottom >= GROUP_FACE_SAFE.minY && box.top <= GROUP_FACE_SAFE.maxY
        ));
        headOcclusion = Math.max(headOcclusion, maxProjectedHeadOcclusion(driftBounds));
      }
      const plan = {
        angle: candidateAngle, angleOffset: offset, distance: candidate, bounds,
        faceSafe, headOcclusion,
        compositionSafe: faceSafe && headOcclusion <= MAX_GROUP_HEAD_OCCLUSION,
      };
      if (plan.compositionSafe) {
        plan.compositionScore = candidate + Math.abs(offset) * 10 + headOcclusion * 2;
        if (!bestSafe || plan.compositionScore < bestSafe.compositionScore) bestSafe = plan;
      }
      if (
        !last
        || (plan.faceSafe && !last.faceSafe)
        || (plan.faceSafe === last.faceSafe && plan.headOcclusion < last.headOcclusion - 0.001)
        || (plan.faceSafe === last.faceSafe
          && Math.abs(plan.headOcclusion - last.headOcclusion) <= 0.001
          && Math.abs(plan.angleOffset) < Math.abs(last.angleOffset))
      ) last = plan;
    }
  }
  return bestSafe || last;
}

{
  let seed = 0x9e3779b9 >>> 0;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let safeCount = 0;
  let unsafeCount = 0;
  const aspects = [PORTRAIT, LANDSCAPE, DESKTOP];
  for (let trial = 0; trial < 160; trial += 1) {
    const n = 1 + Math.floor(rng() * 6);
    // every 8th trial is pathological: a wide cast with a starved distance
    // range, so the probe field genuinely contains no-safe outcomes.
    const pathological = trial % 8 === 7;
    const spread = 0.6 + rng() * (pathological ? 14 : 4.5);
    const actors = Array.from({ length: n }, () => ({
      x: (rng() - 0.5) * spread, y: 0, z: (rng() - 0.5) * spread,
      headHeight: 1.45 + rng() * 0.45,
    }));
    const args = {
      actors,
      angle: (rng() - 0.5) * Math.PI * 2,
      distance: 3.2 + rng() * 5,
      height: 1.8 + rng() * 1.2,
      look: 0.8 + rng() * 0.6,
      fov: 46,
      aspect: aspects[trial % aspects.length],
      maxDistance: pathological ? 4.4 : 30,
    };
    const live = planGroupCamera(args);
    const ref = referencePlanGroupCamera(args);
    if (ref.compositionSafe) safeCount += 1; else unsafeCount += 1;
    assert.equal(live.compositionSafe, ref.compositionSafe, `trial ${trial}: safe flag diverged`);
    assert.equal(live.angle, ref.angle, `trial ${trial}: angle diverged`);
    assert.equal(live.distance, ref.distance, `trial ${trial}: distance diverged`);
    assert.equal(live.angleOffset, ref.angleOffset, `trial ${trial}: offset diverged`);
    assert.equal(live.headOcclusion, ref.headOcclusion, `trial ${trial}: occlusion diverged`);
    if (ref.compositionSafe) {
      assert.equal(live.compositionScore, ref.compositionScore, `trial ${trial}: score diverged`);
    }
  }
  assert.ok(safeCount > 0 && unsafeCount > 0,
    `pruning probe field must contain both outcomes (safe ${safeCount}, no-safe ${unsafeCount})`);
  console.log(
    `planGroupCamera pruning differential: ${safeCount} safe + ${unsafeCount} no-safe trials`
    + ' bit-identical to the exhaustive reference.',
  );
}
