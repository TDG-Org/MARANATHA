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

console.log(`Camera continuity passed; first 16ms step ${firstStep.toFixed(4)}u.`);
