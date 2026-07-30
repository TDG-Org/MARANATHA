// THE ARK IS THE FIRST PLACE IN THIS GAME WITH AN UPSTAIRS.
//
// Everything before it was flat by construction: stages carve flat pads, the
// controller never wrote y, and every collider was infinitely tall because no
// body could ever be anywhere but the ground. Three decks break all three
// assumptions at once, so this group holds the new vertical rules honest AND
// proves the change did not move a single flat scene.
//
// Run: node tools/test-deck-field.mjs
import assert from 'node:assert/strict';
import { DeckField, stepHeight, FALL } from '../src/engine/DeckField.js';
import { ColliderWorld } from '../src/engine/collision.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const near = (a, b, tol, msg) => { assert.ok(Math.abs(a - b) <= tol, `${msg} (${a} vs ${b})`); checks++; };

// ── A three-deck ark footprint, the real shape the scene builds ──────────────
const DECK_Y = [0.35, 5.15, 9.95];
const HALF_L = 68.5;
const HALF_W = 11.4;

function buildField() {
  const f = new DeckField({ stepUp: 0.62, groundY: 0 });
  DECK_Y.forEach((y, i) => {
    f.addFloor({ minX: -HALF_L, maxX: HALF_L, minZ: -HALF_W, maxZ: HALF_W, y, id: `deck${i + 1}` });
  });
  // A ramp climbing deck 1 -> deck 2 along +x, on the port side.
  f.addRamp({
    minX: 8, maxX: 22, minZ: 4, maxZ: 7, axis: 'x',
    yLow: DECK_Y[0], yHigh: DECK_Y[1], id: 'ramp12',
  });
  return f;
}

// ── 1. The same (x,z) answers differently per deck ───────────────────────────
{
  const f = buildField();
  near(f.surfaceAt(0, 0, DECK_Y[0]).y, DECK_Y[0], 1e-9, 'standing on deck 1 stays on deck 1');
  near(f.surfaceAt(0, 0, DECK_Y[1]).y, DECK_Y[1], 1e-9, 'standing on deck 2 stays on deck 2');
  near(f.surfaceAt(0, 0, DECK_Y[2]).y, DECK_Y[2], 1e-9, 'standing on deck 3 stays on deck 3');
  assert.equal(f.surfaceAt(0, 0, DECK_Y[1]).id, 'deck2'); checks++;

  // THE FAILURE THIS RULE EXISTS TO PREVENT: a body on deck 1 must never be
  // lifted onto deck 2 just because deck 2 is also "here".
  ok(f.surfaceAt(0, 0, DECK_Y[0]).y < DECK_Y[1], 'deck 1 body is never promoted to deck 2');
}

// ── 2. Outside the hull there is no authored floor ───────────────────────────
{
  const f = buildField();
  const out = f.surfaceAt(HALF_L + 12, 0, 0);
  ok(!out.found, 'outside the ark reports no authored surface');
  near(out.y, 0, 1e-9, 'outside falls back to ground height');
  assert.equal(out.id, null); checks++;
}

// ── 3. A ramp is continuous, and walking it never stutters ───────────────────
{
  const f = buildField();
  near(f.surfaceAt(8, 5.5, DECK_Y[0]).y, DECK_Y[0], 1e-9, 'ramp foot meets deck 1 exactly');
  near(f.surfaceAt(22, 5.5, DECK_Y[1]).y, DECK_Y[1], 1e-9, 'ramp head meets deck 2 exactly');
  near(f.surfaceAt(15, 5.5, 2.5).y, (DECK_Y[0] + DECK_Y[1]) / 2, 1e-6, 'ramp midpoint interpolates');

  // Walk the ramp at real speed and prove every frame is reachable, monotonic
  // and never larger than a step. A ramp that outruns stepUp would drop the
  // player through it.
  let y = DECK_Y[0];
  let x = 8;
  let maxJump = 0;
  let frames = 0;
  const dt = 1 / 60;
  while (x < 22 && frames < 6000) {
    x += 5.4 * dt; // running, the fastest anyone can take it
    const s = f.surfaceAt(x, 5.5, y);
    ok(s.found, 'ramp is continuous under a running body');
    maxJump = Math.max(maxJump, Math.abs(s.y - y));
    ok(s.y >= y - 1e-9, 'ramp height never goes backwards while climbing');
    y = s.y;
    frames++;
  }
  ok(maxJump < 0.62, `a running climb never exceeds one step (max ${maxJump.toFixed(4)})`);
  near(y, DECK_Y[1], 1e-6, 'the climb arrives exactly on deck 2');
  ok(f.surfaceAt(23, 5.5, y).y === DECK_Y[1], 'stepping off the ramp head lands on deck 2');
}

// ── 4. Under the ramp is the deck below, not the ramp ────────────────────────
{
  const f = buildField();
  // A body on deck 1 walking beneath the raised half of the ramp.
  const s = f.surfaceAt(20, 5.5, DECK_Y[0]);
  near(s.y, DECK_Y[0], 1e-9, 'walking under a ramp keeps you on deck 1');
}

// ── 5. stepHeight: snap up, snap small drops, FALL real drops ────────────────
{
  const s = { y: 0, vy: 0, falling: false };
  stepHeight(s, 0.3, 16.7);
  near(s.y, 0.3, 1e-9, 'a step up is exact and immediate');
  ok(!s.falling, 'stepping up is not falling'); checks++;

  const r = { y: 5.15, vy: 0, falling: false };
  stepHeight(r, 5.05, 16.7);
  near(r.y, 5.05, 1e-9, 'a ramp-sized drop is exact (no sinking on a slope)');

  // A real drop accelerates and lands — and never passes through the floor.
  const d = { y: DECK_Y[1], vy: 0, falling: false };
  let ticks = 0;
  let lowest = Infinity;
  while (d.falling !== false || ticks === 0) {
    stepHeight(d, DECK_Y[0], 16.7);
    lowest = Math.min(lowest, d.y);
    if (++ticks > 600) break;
    if (!d.falling) break;
  }
  ok(ticks > 1, 'a full-deck drop takes real time (it is a fall, not a teleport)');
  near(d.y, DECK_Y[0], 1e-9, 'the fall lands exactly on the deck below');
  ok(lowest >= DECK_Y[0] - 1e-9, 'a fall never tunnels below its target floor');
  ok(d.vy === 0, 'landing clears vertical velocity');

  // Terminal velocity is respected on an absurd drop.
  const t = { y: 400, vy: 0, falling: false };
  for (let i = 0; i < 400; i++) stepHeight(t, 0, 16.7);
  ok(Math.abs(t.vy) <= FALL.terminal + 1e-9, 'fall speed is capped');
}

// ── 6. Vertical collider spans: deck 1 walls do not block deck 3 ─────────────
{
  const w = new ColliderWorld();
  w.bodyHeight = 1.7;
  // A stall partition that exists only on deck 1.
  w.add({ type: 'aabb', minX: -1, minZ: -1, maxX: 1, maxZ: 1, minY: DECK_Y[0], maxY: DECK_Y[0] + 2.4 });

  const onDeck1 = { x: 0.9, y: DECK_Y[0], z: 0 };
  const moved1 = w.resolve(onDeck1, 0.42);
  ok(onDeck1.x > 0.9, 'a deck-1 body is pushed out of a deck-1 partition');
  ok(moved1 !== undefined, 'resolve returns its settled flag'); checks++;

  const onDeck3 = { x: 0.9, y: DECK_Y[2], z: 0 };
  const before = onDeck3.x;
  w.resolve(onDeck3, 0.42);
  near(onDeck3.x, before, 1e-12, 'a deck-3 body walks straight over a deck-1 partition');

  // The body standing ON the partition's own floor level is inside its span.
  const onDeck2 = { x: 0.9, y: DECK_Y[1], z: 0 };
  const b2 = onDeck2.x;
  w.resolve(onDeck2, 0.42);
  near(onDeck2.x, b2, 1e-12, 'a deck-2 body clears a partition that stops below it');
}

// ── 7. A floor collider belongs to the deck below the body standing on it ────
{
  const w = new ColliderWorld();
  w.bodyHeight = 1.7;
  // maxY exactly at the body's feet: this is the deck slab you are standing on.
  w.add({ type: 'aabb', minX: -5, minZ: -5, maxX: 5, maxZ: 5, minY: 0, maxY: DECK_Y[0] });
  const body = { x: 0, y: DECK_Y[0], z: 0 };
  const bx = body.x;
  w.resolve(body, 0.42);
  near(body.x, bx, 1e-12, 'the slab you stand on does not push you sideways');

  const under = { x: 0, y: 0, z: 0 };
  w.resolve(under, 0.42);
  ok(under.x !== 0 || under.z !== 0, 'a body inside the slab IS pushed out');
}

// ── 8. THE REGRESSION THAT MATTERS: spanless colliders are unchanged ─────────
// Every collider in Joseph's camp has no span. If this drifts by a bit, a
// scripted walk lands somewhere else and an authored camera mark breaks.
{
  const mk = () => {
    const w = new ColliderWorld();
    let seed = 991;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 120; i++) w.addCircle((rnd() - 0.5) * 80, (rnd() - 0.5) * 60, 0.35 + rnd() * 1.3);
    for (let i = 0; i < 20; i++) {
      const x = (rnd() - 0.5) * 70; const z = (rnd() - 0.5) * 50;
      w.addAABB(x, z, x + 0.7 + rnd() * 3, z + 0.7 + rnd() * 3);
    }
    return w;
  };
  const world = mk();

  // The exact pre-change push: no span test at all.
  const refPush = (pos, r, c) => {
    if (c.type === 'circle') {
      const dx = pos.x - c.x; const dz = pos.z - c.z;
      const min = r + c.r; const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 === 0) return false;
      const d = Math.sqrt(d2);
      const overlap = Math.min(min - d, 0.5);
      pos.x += (dx / d) * overlap; pos.z += (dz / d) * overlap;
      return true;
    }
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    let dx = pos.x - cx; let dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 === 0) {
      const left = pos.x - c.minX; const right = c.maxX - pos.x;
      const nr = pos.z - c.minZ; const fr = c.maxZ - pos.z;
      const m = Math.min(left, right, nr, fr);
      if (m === left) pos.x = c.minX - r;
      else if (m === right) pos.x = c.maxX + r;
      else if (m === nr) pos.z = c.minZ - r;
      else pos.z = c.maxZ + r;
      return true;
    }
    const d = Math.sqrt(d2);
    const overlap = Math.min(r - d, 0.5);
    pos.x += (dx / d) * overlap; pos.z += (dz / d) * overlap;
    return true;
  };
  const refResolve = (w, pos, r) => {
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (let i = 0; i < w.statics.length; i++) pushed = refPush(pos, r, w.statics[i]) || pushed;
      if (!pushed) return true;
    }
    return false;
  };

  let seed = 4242;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let probes = 0;
  for (let i = 0; i < 60000; i++) {
    const x = (rnd() - 0.5) * 90;
    const z = (rnd() - 0.5) * 70;
    const r = i % 2 ? 0.42 : 0.30;
    // A pre-ark body carried NO y at all. Prove both the undefined-y form and a
    // y-carrying body get the identical answer when nothing has a span.
    const live = { x, z };
    const liveY = { x, y: 0, z };
    const ref = { x, z };
    world.resolve(live, r);
    world.resolve(liveY, r);
    refResolve(world, ref, r);
    if (live.x !== ref.x || live.z !== ref.z) {
      assert.fail(`spanless resolve drifted at probe ${i}: ${live.x},${live.z} vs ${ref.x},${ref.z}`);
    }
    if (liveY.x !== ref.x || liveY.z !== ref.z) {
      assert.fail(`y-carrying body drifted at probe ${i}: ${liveY.x},${liveY.z} vs ${ref.x},${ref.z}`);
    }
    probes++;
  }
  ok(probes === 60000, `${probes} spanless probes are bit-identical to the pre-ark reference`);

  // overlaps() keeps its flat meaning when no y is supplied.
  let agree = 0;
  for (let i = 0; i < 20000; i++) {
    const x = (rnd() - 0.5) * 90; const z = (rnd() - 0.5) * 70;
    const a = world.overlaps(x, z, 0.42);
    const b = world.overlaps(x, z, 0.42, null, 0);
    if (a === b) agree++;
  }
  ok(agree === 20000, 'overlaps() agrees with and without a height on spanless colliders');
}

console.log(`deck-field: ${checks} checks passed`);
