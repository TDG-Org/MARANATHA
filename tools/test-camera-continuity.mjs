import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CameraDirector } from '../src/engine/CameraDirector.js';

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

console.log(
  `Camera continuity passed; linear first step ${firstStep.toFixed(4)}u, `
  + `arc first step ${arcFirstStep.toFixed(4)}u, min arc radius ${minArcRadius.toFixed(3)}u.`,
);

// Keep the package's existing `test:camera` command as the single camera gate.
await import('./test-dialogue-camera-safety.mjs');
