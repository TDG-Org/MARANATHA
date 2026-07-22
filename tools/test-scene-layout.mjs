#!/usr/bin/env node

import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ColliderWorld } from '../src/engine/collision.js';
import { auditLayout } from '../src/engine/layoutAudit.js';
import { makeGround } from '../src/engine/world.js';
import { buildCamp } from '../src/scenes/joseph3d/props.js';

// The camp builders only need this tiny surface for their procedural glow
// textures. No browser or renderer is involved in the geometry/layout audit.
globalThis.document = {
  createElement(tag) {
    assert.equal(tag, 'canvas');
    return {
      width: 0,
      height: 0,
      getContext() {
        return {
          createRadialGradient() { return { addColorStop() {} }; },
          fillRect() {},
          set fillStyle(_value) {},
        };
      },
    };
  },
};

function testCampLayout() {
  const colliders = new ColliderWorld();
  const camp = buildCamp(colliders);
  const findings = auditLayout({
    colliderWorld: colliders,
    decorations: camp.decorations,
  });
  assert.deepEqual(findings, [], `camp layout findings:\n${JSON.stringify(findings, null, 2)}`);
  camp.group.traverse((object) => {
    if (object.isInstancedMesh) object.dispose();
    object.geometry?.dispose?.();
    object.material?.dispose?.();
  });
}

function testPitFloorClearance() {
  const ground = makeGround({
    color: 0xffffff,
    segX: 96,
    segZ: 30,
    pads: [
      { x: 0, z: 0, flatCore: 27, falloff: 42 },
      { x: 62, z: 0, flatCore: 17.5, falloff: 24 },
      { x: -62, z: 6, flatCore: 9, falloff: 16 },
      { x: -62, z: 6, flatCore: 4.5, falloff: 3.2, sink: 5 },
      { x: -62, z: -34, flatCore: 8, falloff: 14 },
    ],
  });
  ground.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  let highest = -Infinity;
  for (let ring = 0; ring <= 8; ring += 1) {
    const radius = 1.95 * (ring / 8);
    const count = ring === 0 ? 1 : 48;
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      from.set(-62 + Math.cos(angle) * radius, 10, 6 + Math.sin(angle) * radius);
      ray.set(from, down);
      const hit = ray.intersectObject(ground, false)[0];
      assert.ok(hit, 'ground ray missed the pit floor');
      highest = Math.max(highest, hit.point.y);
    }
  }
  assert.ok(highest <= -4.05,
    `terrain reaches y=${highest.toFixed(3)} above the y=-4.00 cistern floor`);
  ground.geometry.dispose();
  ground.material.dispose();
  return highest;
}

testCampLayout();
const highestPitTerrain = testPitFloorClearance();
console.log('scene layout: PASS');
console.log(`  camp colliders/decorations: 0 overlaps`);
console.log(`  highest terrain below cistern floor: ${highestPitTerrain.toFixed(3)}`);
