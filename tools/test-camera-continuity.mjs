import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraDirector } from '../src/engine/CameraDirector.js';
import {
  MAX_VISIBLE_GROUP_ROUTE_MS,
  MIN_VISIBLE_DIALOGUE_MOVE_MS,
} from '../src/scenes/joseph3d/beats/helpers.js';

assert.equal(
  MIN_VISIBLE_DIALOGUE_MOVE_MS,
  1200,
  'visible dialogue camera changes are fast enough to read as snaps',
);

const camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
const director = new CameraDirector(camera, { minGroundY: -100 });
director.setTarget(new THREE.Vector3(0, 0, 0));
director.snap();

director.cinematicMoveTo({ angle: 0, target: { x: 0, z: 0 }, distance: 4, height: 2, duration: 1 });
director.frame(16);
const before = camera.position.clone();

director.cinematicMoveTo({ angle: Math.PI / 2, target: { x: 4, z: 2 }, distance: 5, height: 3, lookHeight: 1.2, duration: 1000 });
director.frame(16);
const firstStep = camera.position.distanceTo(before);
assert.ok(firstStep < 0.1, `replacement pose jumped ${firstStep.toFixed(3)}u in one frame`);

for (let i = 0; i < 64; i++) director.frame(16);
const expected = new THREE.Vector3(-1, 3, 2);
assert.ok(camera.position.distanceTo(expected) < 0.08, 'replacement pose did not reach its authored endpoint');

// Arc paths are explicitly opted in. They must preserve the rendered pose at
// call time, travel around (not through) a shared subject, and land on the
// exact same authored endpoint as the default path.
const arcCamera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
const arcDirector = new CameraDirector(arcCamera, { minGroundY: -100 });
arcDirector.setTarget(new THREE.Vector3(0, 0, 0));
arcDirector.snap();
arcDirector.cinematicMoveTo({ angle: 0, target: { x: 0, z: 0 }, distance: 4, height: 2, lookHeight: 1, duration: 1 });
arcDirector.frame(16);
const arcBefore = arcCamera.position.clone();
arcDirector.cinematicMoveTo({
  angle: Math.PI,
  target: { x: 0, z: 0 },
  distance: 4,
  height: 2,
  lookHeight: 1,
  duration: 1000,
  path: 'arc',
});
assert.equal(arcCamera.position.distanceTo(arcBefore), 0, 'arc call changed the rendered pose before the next frame');

let arcFirstStep = 0;
let minArcRadius = Infinity;
let priorArcAngle = Math.PI;
for (let i = 0; i < 64; i++) {
  const prior = arcCamera.position.clone();
  arcDirector.frame(16);
  if (i === 0) arcFirstStep = arcCamera.position.distanceTo(prior);
  minArcRadius = Math.min(minArcRadius, Math.hypot(arcCamera.position.x, arcCamera.position.z));
  const arcAngle = Math.atan2(arcCamera.position.x, arcCamera.position.z);
  assert.ok(arcAngle <= priorArcAngle + 1e-9, 'arc azimuth reversed direction mid-move');
  priorArcAngle = arcAngle;
}
assert.ok(arcFirstStep < 0.1, `arc replacement jumped ${arcFirstStep.toFixed(3)}u in one frame`);
assert.ok(minArcRadius > 3.99, `arc replacement collapsed through its subject (radius ${minArcRadius.toFixed(3)}u)`);
const arcExpected = new THREE.Vector3(0, 2, 4);
assert.ok(arcCamera.position.distanceTo(arcExpected) < 0.08, 'arc replacement missed its authored endpoint');
assert.ok(arcDirector.pose.pos.distanceTo(arcExpected) < 1e-12, 'arc changed the exact authored pose');

// Default behavior remains the Cartesian chord for covered/special shots.
const linearCamera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
const linearDirector = new CameraDirector(linearCamera, { minGroundY: -100 });
linearDirector.setTarget(new THREE.Vector3(0, 0, 0));
linearDirector.snap();
linearDirector.cinematicMoveTo({ angle: 0, target: { x: 0, z: 0 }, distance: 4, height: 2, lookHeight: 1, duration: 1 });
linearDirector.frame(16);
linearDirector.cinematicMoveTo({ angle: Math.PI, target: { x: 0, z: 0 }, distance: 4, height: 2, lookHeight: 1, duration: 1000 });
linearDirector.frame(500);
assert.ok(Math.hypot(linearCamera.position.x, linearCamera.position.z) < 0.01, 'default replacement path no longer uses the covered-shot chord');

// Portrait-responsive group shots can sit tens of world units from the cast.
// Their pacing must be based on angular/radial screen motion, not raw metres:
// the latter stretched a normal reverse angle to 16.1 seconds.
const groupCamera = new THREE.PerspectiveCamera(46, 390 / 844, 0.1, 300);
const groupDirector = new CameraDirector(groupCamera, { minGroundY: -100 });
groupDirector.setTarget(new THREE.Vector3(0, 0, 0));
groupDirector.snap();
groupDirector.cinematicMoveTo({
  angle: 0,
  target: { x: 0, z: 0 },
  distance: 4,
  height: 2,
  lookHeight: 1,
  duration: 1,
});
groupDirector.frame(16);
const portraitGroupMs = groupDirector.cinematicMoveTo({
  angle: Math.PI,
  target: { x: 0, z: 0 },
  distance: 30,
  height: 3,
  lookHeight: 1.2,
  duration: 2200,
  path: 'groupArc',
  arcCenter: { x: 0, z: 0 },
  arcRadius: 30,
});
assert.ok(
  portraitGroupMs >= 2200,
  `portrait group route shortened its authored duration (${portraitGroupMs.toFixed(0)}ms)`,
);
assert.ok(
  portraitGroupMs > MAX_VISIBLE_GROUP_ROUTE_MS,
  'large portrait route no longer exercises the caller covered-cut threshold',
);
const coveredEndpoint = {
  angle: Math.PI * 0.35,
  target: { x: 3, z: -6 },
  distance: 18,
  height: 3,
  lookHeight: 1.2,
};
groupDirector.cutTo(coveredEndpoint);
const expectedCoveredPosition = new THREE.Vector3(
  coveredEndpoint.target.x - Math.sin(coveredEndpoint.angle) * coveredEndpoint.distance,
  coveredEndpoint.height,
  coveredEndpoint.target.z - Math.cos(coveredEndpoint.angle) * coveredEndpoint.distance,
);
assert.ok(
  groupCamera.position.distanceTo(expectedCoveredPosition) < 1e-12,
  'covered cut did not synchronously commit its endpoint before the next render frame',
);

// A non-blocking move may still be active when a short line is skipped. The
// release must begin from the rendered pixels, not jump to the unfinished
// move's endpoint first.
const releaseCamera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
const releaseDirector = new CameraDirector(releaseCamera, { minGroundY: -100 });
releaseDirector.setTarget(new THREE.Vector3(0, 0, 0));
releaseDirector.snap();
releaseDirector.setDrift(true);
releaseDirector.cinematicMoveTo({
  angle: 0,
  target: { x: 0, z: 0 },
  distance: 4,
  height: 2,
  lookHeight: 1,
  duration: 1,
});
releaseDirector.frame(16);
releaseDirector.cinematicMoveTo({
  angle: Math.PI * 1.1,
  target: { x: 7, z: -2 },
  distance: 12,
  height: 5.5,
  lookHeight: 1.3,
  duration: 8000,
  path: 'groupArc',
  arcCenter: { x: 0, z: 0 },
  arcRadius: 12,
});
for (let i = 0; i < 300; i++) releaseDirector.frame(16);
const beforeEarlyRelease = releaseCamera.position.clone();
releaseDirector.release(1600);
releaseDirector.frame(16);
const earlyReleaseStep = releaseCamera.position.distanceTo(beforeEarlyRelease);
assert.ok(
  earlyReleaseStep < 0.1,
  `incomplete cinematic release jumped ${earlyReleaseStep.toFixed(3)}u in one frame`,
);

// The same continuity law applies while the very first pose is still blending
// in (poseK < 1), not only to a replacement route at poseK=1.
const blendReleaseCamera = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 300);
const blendReleaseDirector = new CameraDirector(blendReleaseCamera, { minGroundY: -100 });
blendReleaseDirector.setTarget(new THREE.Vector3(0, 0, 0));
blendReleaseDirector.snap();
blendReleaseDirector.setDrift(true);
blendReleaseDirector.cinematicMoveTo({
  angle: Math.PI,
  target: { x: 5, z: -2 },
  distance: 9,
  height: 4,
  lookHeight: 1.2,
  duration: 1400,
});
for (let i = 0; i < 13; i++) blendReleaseDirector.frame(16);
const beforeBlendRelease = blendReleaseCamera.position.clone();
blendReleaseDirector.release(1000);
blendReleaseDirector.frame(16);
const blendReleaseStep = blendReleaseCamera.position.distanceTo(beforeBlendRelease);
assert.ok(
  blendReleaseStep < 0.12,
  `partial first-pose release jumped ${blendReleaseStep.toFixed(3)}u in one frame`,
);

// ── A POSE DRIVER MUST NEVER BE A SILENT NO-OP ─────────────────────────────
// frame() only calls the driver when a pose exists, and every call site
// happened to install one after a cutTo — except the camp tour under Genesis
// 37:2, which was installed straight from follow mode. It ran zero times, for
// weeks, with nothing to show for it. Installing a driver now seeds the pose
// from the live lens, and the takeover is seamless because that pose IS the
// camera until the driver writes to it.
{
  const lens = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 400);
  const director = new CameraDirector(lens);
  director.setTarget(new THREE.Vector3(0, 0, 0));
  director.frame(16);
  const before = lens.position.clone();
  let ran = 0;
  director.setPoseDriver((pose) => { ran += 1; pose.pos.set(15, 6.2, -3); });
  // The seeded pose must not move the camera before the driver decides to.
  const seeded = new CameraDirector(lens);
  seeded.setTarget(new THREE.Vector3(0, 0, 0));
  seeded.frame(16);
  const beforeSeed = lens.position.clone();
  seeded.setPoseDriver((pose) => { pose.pos.copy(beforeSeed); });
  seeded.frame(16);
  assert.ok(
    lens.position.distanceTo(beforeSeed) < 0.06,
    `seeding a pose driver moved the camera ${lens.position.distanceTo(beforeSeed).toFixed(3)}u on its own`,
  );
  for (let i = 0; i < 20; i++) director.frame(16);
  assert.ok(ran >= 20, `a pose driver installed from follow mode ran ${ran} times in 20 frames`);
  assert.ok(before !== null);
}

// ── NO VISIBLE REFRAME MAY WHIP AROUND ITS SUBJECT ─────────────────────────
// Every reframe used to get a flat ~1.2s regardless of distance, so a dialogue
// REVERSE (behind one shoulder to behind the other, about 130 degrees) orbited
// the pair at nearly 2 rad/s and crossed the line between the speakers on the
// way past. A reverse is a CUT in any film grammar; only small adjustments are
// moves. The rule is a speed, and this is where it is enforced.
{
  const { comfortableRouteMs, cameraAngleFrom, shortestAngleDelta, MAX_ORBIT_RAD_PER_S,
    MAX_VISIBLE_DIALOGUE_ROUTE_MS, MIN_VISIBLE_DIALOGUE_MOVE_MS } =
    await import('../src/scenes/joseph3d/beats/helpers.js');

  // The bearing helper must agree with how CameraDirector places a lens.
  for (const angle of [0, 0.7, -1.9, Math.PI * 0.42, Math.PI]) {
    const target = { x: 1.4, z: -3.2 };
    const pos = {
      x: target.x - Math.sin(angle) * 5,
      z: target.z - Math.cos(angle) * 5,
    };
    assert.ok(
      Math.abs(shortestAngleDelta(cameraAngleFrom(pos, target), angle)) < 1e-9,
      `cameraAngleFrom disagrees with the director at ${angle}`,
    );
  }

  const swingMs = (rad) => comfortableRouteMs(0, rad, 1200);
  // A small adjustment still takes the comfortable floor, never less.
  assert.equal(swingMs(0.2), MIN_VISIBLE_DIALOGUE_MOVE_MS);
  // A classic OTS reverse cannot be travelled inside the visible ceiling, so
  // the caller covers it — which is the whole point.
  const reverse = Math.PI - 0.87;
  assert.ok(
    swingMs(reverse) > MAX_VISIBLE_DIALOGUE_ROUTE_MS,
    `a ${(reverse * 180 / Math.PI).toFixed(0)}deg dialogue reverse would still be travelled visibly `
    + `(${swingMs(reverse).toFixed(0)}ms <= ${MAX_VISIBLE_DIALOGUE_ROUTE_MS}ms) — that is the whip`,
  );
  // ...and nothing that IS travelled visibly exceeds the orbit speed.
  for (const rad of [0.1, 0.3, 0.6, 0.9, 1.2, 1.34]) {
    const ms = swingMs(rad);
    if (ms > MAX_VISIBLE_DIALOGUE_ROUTE_MS) continue;
    assert.ok(
      (rad / ms) * 1000 <= MAX_ORBIT_RAD_PER_S + 1e-9,
      `a ${rad.toFixed(2)}rad reframe travels at ${((rad / ms) * 1000).toFixed(2)}rad/s`,
    );
  }
  console.log(
    `Camera orbit law: <=${MAX_ORBIT_RAD_PER_S}rad/s; a ${(reverse * 180 / Math.PI).toFixed(0)}deg reverse `
    + `would need ${swingMs(reverse).toFixed(0)}ms so it cuts instead.`,
  );
}

console.log(
  `Camera continuity passed; linear first step ${firstStep.toFixed(4)}u, `
  + `arc first step ${arcFirstStep.toFixed(4)}u, min arc radius ${minArcRadius.toFixed(3)}u, `
  + `portrait group ${portraitGroupMs.toFixed(0)}ms (covered by caller), `
  + `early release ${earlyReleaseStep.toFixed(4)}u, first-blend release ${blendReleaseStep.toFixed(4)}u.`,
);

// Keep the package's existing `test:camera` command as the single camera gate.
await import('./test-dialogue-camera-safety.mjs');
