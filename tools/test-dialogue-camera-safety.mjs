import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CameraDirector } from '../src/engine/CameraDirector.js';
import {
  BETRAYAL_STRIP_CAMERA,
  DIALOGUE_FACE_SAFE,
  MAX_DIALOGUE_FOREGROUND,
  makeHelpers,
  planDialogueCamera,
  planTwoShotCamera,
  projectedAnchorNdc,
} from '../src/scenes/joseph3d/beats/helpers.js';

const PORTRAIT = 390 / 844;
const LANDSCAPE = 844 / 390;

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
  ['jacob', 'joseph', -0.7, 3.8, 2.1],
];
for (const aspect of [PORTRAIT, LANDSCAPE]) {
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
  }
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
tellingDirector.cinematicMoveTo({
  ...replyPlan,
  duration: 850,
  path: 'groupArc',
  arcCenter: FIRE,
  arcRadius: 6.4,
});
let minActorClearance = Infinity;
for (let i = 0; i < 54; i++) {
  tellingDirector.frame(16);
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
  { ...dialoguePlan('judah', 'joseph', -0.42, 2.6, 2.1), duration: 850 },
  {
    angle: Math.PI * 0.55, target: { x: 0.3, z: -5.7 },
    distance: 5.7, height: 2.7, lookHeight: 1.2, duration: 1600,
  },
  { ...dialoguePlan('joseph', 'reuben', 0.9, 4.4, 2.15), duration: 850 },
  {
    angle: Math.PI * 0.66, target: { x: 0.1, z: -5.8 },
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
for (let moveIndex = 0; moveIndex < groupMoves.length; moveIndex++) {
  const move = groupMoves[moveIndex];
  groupDirector.cinematicMoveTo({
    ...move,
    path: 'groupArc',
    arcCenter: FIRE,
    arcRadius: 6.4,
  });
  const samples = Math.ceil(move.duration / 16) + 2;
  for (let i = 0; i < samples; i++) {
    groupDirector.frame(16);
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
  allGroupClearance > 1.5,
  `a family-circle camera route crossed an actor head (${allGroupClearance.toFixed(3)}u; ${groupMinInfo})`,
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
const coldOpenSource = readFileSync(
  new URL('../src/scenes/joseph3d/beats/coldOpen.js', import.meta.url),
  'utf8',
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

console.log(
  `Dialogue camera safety passed; portrait OTS ${(portraitPlan.otsOccupancy * 100).toFixed(1)}%`
  + ` -> single ${(portraitPlan.foregroundOccupancy * 100).toFixed(1)}%,`
  + ` telling clearance ${Math.min(minActorClearance, allGroupClearance).toFixed(3)}u,`
  + ` Jacob clearance ${minJacobClearance.toFixed(3)}u,`
  + ` tent margin ${Math.min(minTentMargin, responsiveTentMargin).toFixed(3)}u,`
  + ` strip clearance ${stripClearance.toFixed(3)}u.`,
);
