import assert from 'node:assert/strict';
import * as THREE from 'three';

// world.canvasTexture only needs this tiny 2D surface for the pooled radial
// blob; no browser or raster dependency is needed for the ownership test.
const ctx2d = {
  fillStyle: '',
  createRadialGradient() { return { addColorStop() {} }; },
  fillRect() {},
  save() {},
  restore() {},
  translate() {},
  scale() {},
};
globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  createElement(tag) {
    assert.equal(tag, 'canvas');
    return { width: 0, height: 0, getContext: () => ctx2d };
  },
};
globalThis.window = {
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  removeEventListener() {},
};

const { ContactShadowPool } = await import('../src/engine/ContactShadowPool.js');
const { AmbientNPCs } = await import('../src/scenes/joseph3d/cast.js');
const { ColliderWorld } = await import('../src/engine/collision.js');
const { PlayerController3D } = await import('../src/engine/PlayerController3D.js');
const { makeMotes } = await import('../src/engine/world.js');
const { makeSmoke } = await import('../src/engine/particles.js');

class CountingWorld extends ColliderWorld {
  constructor() {
    super();
    this.resolveCalls = 0;
    this.staticChecks = 0;
    this.dynamicChecks = 0;
    this.gateChecks = 0;
    this._staticSet = new Set();
  }

  add(collider) {
    const added = super.add(collider);
    this._staticSet.add(added);
    return added;
  }

  clear() {
    super.clear();
    this._staticSet.clear();
  }

  resolve(pos, radius, dynamics = null) {
    this.resolveCalls += 1;
    return super.resolve(pos, radius, dynamics);
  }

  _push(pos, radius, collider) {
    if (this._staticSet.has(collider)) this.staticChecks += 1;
    else this.dynamicChecks += 1;
    return super._push(pos, radius, collider);
  }

  hasResolvableOverlap(pos, radius, dynamics) {
    for (let i = 0; i < dynamics.length; i++) {
      if (!dynamics[i].skip) this.gateChecks += 1;
    }
    return super.hasResolvableOverlap(pos, radius, dynamics);
  }
}

function makeCharacter(x = 0, z = 0) {
  return {
    position: new THREE.Vector3(x, 0, z),
    state: 'idle',
    animLOD: 0,
    setPosition(nextX, nextZ) { this.position.x = nextX; this.position.z = nextZ; },
    update() {},
    play(state) { this.state = state; },
    turnToward() {},
  };
}

function addDistantStatics(world, count) {
  for (let i = 0; i < count; i++) {
    world.addCircle(100 + (i % 12) * 3, 100 + Math.floor(i / 12) * 3, 0.5);
  }
}

// A live quality demotion must reduce both submitted points and per-frame
// simulation immediately; it cannot wait for a scene reload.
{
  const motes = makeMotes({ count: 20 });
  motes.setActiveCount(7);
  assert.equal(motes.activeCount, 7);
  assert.equal(motes.points.geometry.drawRange.count, 7);
  motes.update(16, 1);
  motes.points.geometry.dispose();
  motes.points.material.map.dispose();
  motes.points.material.dispose();

  const smoke = makeSmoke({ count: 20 });
  smoke.addEmitter(0, 0, 0);
  smoke.init();
  smoke.setActiveCount(6);
  assert.equal(smoke.activeCount, 6);
  assert.equal(smoke.geo.drawRange.count, 6);
  smoke.update(16, 1);
  smoke.dispose();
}

// Fifteen characters must remain one draw/resource owner, follow teleports,
// support per-character visibility, and release cleanly.
{
  const scene = new THREE.Scene();
  const pool = new ContactShadowPool(scene, 16);
  const chars = Array.from({ length: 15 }, (_, i) => {
    const root = new THREE.Group();
    root.position.set(i, i * 0.1, -i);
    return { root };
  });
  chars.forEach((char, i) => pool.add(char, i === 14 ? 0.7 : 1.15));
  assert.equal(pool.mesh.count, 15);
  assert.equal(scene.children.filter((o) => o.isInstancedMesh).length, 1,
    'contact shadows fanned back out into separate draws');

  chars[0].root.position.set(12, 3, -8);
  pool.setVisible(chars[1], false);
  pool.update();
  const matrix = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  pool.mesh.getMatrixAt(0, matrix);
  matrix.decompose(pos, quat, scale);
  assert.ok(pos.distanceTo(new THREE.Vector3(12, 3.03, -8)) < 1e-6,
    'pooled shadow did not follow a teleported actor');
  pool.mesh.getMatrixAt(1, matrix);
  const planeAreaBasis = matrix.elements.slice(0, 8).reduce((sum, value) => sum + Math.abs(value), 0);
  assert.ok(planeAreaBasis < 1e-8, 'hidden pooled shadow retained visible area');
  const stableVersion = pool.mesh.instanceMatrix.version;
  pool.update();
  assert.equal(pool.mesh.instanceMatrix.version, stableVersion,
    'idle pooled shadows uploaded an unchanged matrix buffer');

  pool.dispose();
  assert.equal(scene.children.includes(pool.mesh), false);
}

// Background camp life outside the explicit stage radius performs zero mixer,
// timer, collision, or transform work, then resumes normally when staged near.
{
  let resolves = 0;
  const world = {
    overlaps: () => false,
    resolve() { resolves += 1; },
  };
  const npcs = new AmbientNPCs(world, { seed: 1 });
  const calls = { update: 0, position: 0 };
  const char = {
    state: 'idle',
    animLOD: 0,
    setPosition() { calls.position += 1; },
    update() { calls.update += 1; },
    play(state) { this.state = state; },
    turnToward() {},
  };
  const npc = npcs.add(char, { x: 0, z: 0, canWander: false });
  const timerBefore = npc.timer;
  npcs.update(16, { x: 60, z: 0 }, 24);
  assert.equal(calls.update, 0);
  assert.equal(calls.position, 1, 'off-stage NPC wrote a new transform');
  assert.equal(resolves, 0);
  assert.equal(npc.timer, timerBefore, 'off-stage NPC timer advanced');

  npcs.update(16, { x: 0, z: 0 }, 24);
  assert.equal(calls.update, 1);
  assert.ok(npc.timer < timerBefore, 'nearby NPC did not resume');
  npcs.dispose();
}

// Ambient gesture holds must run only on governed scene time. They cannot
// retain a wall-clock timer that wakes behind pause/hidden/off-stage states.
{
  const world = new CountingWorld();
  const npcs = new AmbientNPCs(world, { seed: 3 });
  const char = makeCharacter();
  const npc = npcs.add(char, {
    x: 0, z: 0, canWander: false, gestureEvery: 10000,
  });
  npc.gestureT = 0;
  npcs.update(16, { x: 0, z: 0 }, 24);
  assert.equal(char.state, 'talk');
  const held = npc.gestureLeft;
  assert.ok(held > 0);
  npcs.update(5000, { x: 60, z: 0 }, 24);
  assert.equal(npc.gestureLeft, held, 'off-stage gesture consumed hidden wall time');
  assert.equal(char.state, 'talk');
  npcs.update(held + 1, { x: 0, z: 0 }, 24);
  assert.equal(npc.gestureLeft, 0);
  assert.equal(char.state, 'idle');
  npcs.dispose();
}

// A motionless player resolves the static world once, then checks only live
// circles. Dynamic intrusion, static topology changes, and external teleports
// must still force the exact legacy resolve path.
let playerReduction = 0;
{
  const world = new CountingWorld();
  addDistantStatics(world, 120);
  const dynamic = { type: 'circle', x: 40, z: 40, r: 0.4 };
  const character = makeCharacter();
  const camera = { getWorldDirection(out) { return out.set(0, 0, -1); } };
  const controller = new PlayerController3D({
    camera, character, colliders: world,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  });
  controller.dynamics = [dynamic];
  controller.setEnabled(false);

  const frames = 600;
  for (let i = 0; i < frames; i++) controller.update(16);
  const legacyStaticChecks = frames * world.statics.length;
  playerReduction = 1 - world.staticChecks / legacyStaticChecks;
  assert.equal(world.resolveCalls, 1, 'stationary player repeatedly resolved the static world');
  assert.equal(world.staticChecks, world.statics.length);
  assert.ok(playerReduction > 0.998);

  dynamic.x = character.position.x + 0.6;
  dynamic.z = character.position.z;
  controller.update(16);
  assert.equal(world.resolveCalls, 2, 'dynamic collider entering the player did not wake collision');
  assert.ok(Math.hypot(character.position.x - dynamic.x, character.position.z - dynamic.z) >= 0.82 - 1e-9);

  dynamic.x = 40;
  dynamic.z = 40;
  const beforeTopologyChange = world.resolveCalls;
  world.addAABB(-2, -0.5, -1, 0.5);
  controller.update(16);
  assert.equal(world.resolveCalls, beforeTopologyChange + 1,
    'new static topology did not invalidate the player collision gate');

  const beforeTeleport = world.resolveCalls;
  character.position.set(-1.5, 0, 0);
  controller.update(16);
  assert.equal(world.resolveCalls, beforeTeleport + 1, 'external player teleport did not wake collision');
  assert.ok(character.position.x <= -2.42 || character.position.x >= -0.58,
    'teleported player remained inside the static AABB');
  controller.dispose();
}

// A correction capped at three pushes is intentionally left dirty until a
// later frame proves separation; the idle gate must not strand deep overlaps.
{
  const world = new CountingWorld();
  world.addCircle(0, 0, 3);
  const character = makeCharacter(0.1, 0);
  const camera = { getWorldDirection(out) { return out.set(0, 0, -1); } };
  const controller = new PlayerController3D({
    camera, character, colliders: world,
    bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  });
  controller.setEnabled(false);
  controller.update(16);
  controller.update(16);
  controller.update(16);
  const settledCalls = world.resolveCalls;
  controller.update(16);
  assert.equal(settledCalls, 3, 'deep overlap did not continue across capped corrections');
  assert.equal(world.resolveCalls, settledCalls, 'settled deep overlap kept resolving');
  assert.ok(Math.hypot(character.position.x, character.position.z) >= 3.42 - 1e-9);
  controller.dispose();
}

// Fifteen idle NPCs similarly pay for one static resolve each. Their cheap
// live-circle guards still separate an actor teleported into the group.
let npcStaticReduction = 0;
let npcTotalReduction = 0;
{
  const world = new CountingWorld();
  addDistantStatics(world, 120);
  const npcs = new AmbientNPCs(world, { seed: 7 });
  for (let i = 0; i < 15; i++) {
    npcs.add(makeCharacter(), {
      x: (i % 5) * 2,
      z: Math.floor(i / 5) * 2,
      canWander: false,
      gestureEvery: 1e9,
    });
  }

  const frames = 600;
  for (let i = 0; i < frames; i++) npcs.update(16);
  const dynamicsPerNPC = npcs.npcs.length - 1;
  const legacyStaticChecks = frames * npcs.npcs.length * world.statics.length;
  const legacyTotalChecks = frames * npcs.npcs.length * (world.statics.length + dynamicsPerNPC);
  const gatedTotalChecks = world.staticChecks + world.dynamicChecks + world.gateChecks;
  npcStaticReduction = 1 - world.staticChecks / legacyStaticChecks;
  npcTotalReduction = 1 - gatedTotalChecks / legacyTotalChecks;
  assert.equal(world.resolveCalls, npcs.npcs.length,
    'stationary NPCs repeatedly resolved the static world');
  assert.equal(world.staticChecks, npcs.npcs.length * world.statics.length);
  assert.ok(npcStaticReduction > 0.998);
  assert.ok(npcTotalReduction > 0.89);

  const a = npcs.npcs[0];
  const b = npcs.npcs[1];
  b.pos.x = a.pos.x + 0.5;
  b.pos.z = a.pos.z;
  b.circle.x = b.pos.x;
  b.circle.z = b.pos.z;
  const beforeIntrusion = world.resolveCalls;
  npcs.update(16);
  assert.ok(world.resolveCalls > beforeIntrusion, 'dynamic NPC intrusion did not wake collision');
  assert.ok(Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) >= 0.8 - 1e-9,
    'idle NPCs remained merged after a live-circle intrusion');
  npcs.dispose();
}

// Frozen cutscene actors retain the old rule: no collision or position writes
// while frozen, then a dirty teleport resolves immediately after release.
{
  const world = new CountingWorld();
  world.addCircle(5, 0, 0.5);
  const npcs = new AmbientNPCs(world, { seed: 11 });
  const npc = npcs.add(makeCharacter(), { x: 0, z: 0, canWander: false, gestureEvery: 1e9 });
  npcs.update(16);
  npcs.freeze(npc, true);
  npc.pos.x = 5.4;
  npc.pos.z = 0;
  const beforeFrozen = world.resolveCalls;
  npcs.update(16);
  assert.equal(world.resolveCalls, beforeFrozen, 'frozen cutscene actor ran collision');
  assert.equal(npc.pos.x, 5.4, 'frozen cutscene actor position was rewritten');

  npcs.freeze(npc, false);
  npcs.update(16);
  assert.equal(world.resolveCalls, beforeFrozen + 1, 'released cutscene teleport did not resolve');
  assert.ok(Math.hypot(npc.pos.x - 5, npc.pos.z) >= 0.9 - 1e-9);
  npcs.dispose();
}

console.log(
  `render/power checks passed: player static scans -${(playerReduction * 100).toFixed(2)}%; `
  + `15-NPC static scans -${(npcStaticReduction * 100).toFixed(2)}%; `
  + `all NPC collision candidates -${(npcTotalReduction * 100).toFixed(2)}%.`,
);
