// The collider world answers "what am I touching?" with a uniform grid instead
// of scanning every static in the camp. That is only a safe trade if the grid
// gives the SAME answer as the scan — a body that lands one millimetre
// differently drifts a scripted walk, and a scripted walk that drifts breaks an
// authored camera mark.
//
// So this is a differential test: run both implementations over the same random
// probes and demand identical results. The reference below is the exact code the
// grid replaced; keep it that way.
import assert from 'node:assert/strict';
import { ColliderWorld } from '../src/engine/collision.js';

function refOverlaps(world, x, z, r, skipGroup = null) {
  for (const c of world.statics) {
    if (skipGroup && c.group === skipGroup) continue;
    if (c.type === 'circle') {
      const dx = x - c.x; const dz = z - c.z; const min = r + c.r;
      if (dx * dx + dz * dz < min * min) return true;
    } else {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx; const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
  }
  return false;
}

function refResolve(world, pos, r) {
  let totalCorr = 0;
  let settled = false;
  for (let iter = 0; iter < 3; iter++) {
    let pushed = false;
    for (let i = 0; i < world.statics.length; i++) {
      pushed = world._push(pos, r, world.statics[i]) || pushed;
    }
    if (!pushed) { settled = true; break; }
    totalCorr += 1;
    if (totalCorr >= 3) break;
  }
  return settled;
}

let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

// A camp-shaped population: mostly small circles (trees, boulders, clutter),
// some boxes (tents, pen, crates), and one long run big enough to be treated as
// oversized by the index.
const world = new ColliderWorld();
for (let i = 0; i < 140; i++) world.addCircle((rnd() - 0.5) * 90, (rnd() - 0.5) * 70, 0.35 + rnd() * 1.4);
for (let i = 0; i < 24; i++) {
  const x = (rnd() - 0.5) * 80; const z = (rnd() - 0.5) * 60;
  world.addAABB(x, z, x + 0.6 + rnd() * 4, z + 0.6 + rnd() * 4);
}
world.addAABB(-46, -8, 46, -4);
world.statics[5].group = 'border';

// Every radius the game actually gives a body. If a wider body is ever added,
// widen this and re-prove it — the grid's query pad is sized for this range.
const R_MIN = 0.28;
const R_MAX = 0.62;

let overlapTrue = 0;
for (let i = 0; i < 200_000; i++) {
  const x = (rnd() - 0.5) * 110; const z = (rnd() - 0.5) * 90;
  const r = R_MIN + rnd() * (R_MAX - R_MIN);
  const skip = rnd() < 0.2 ? 'border' : null;
  const got = world.overlaps(x, z, r, skip);
  if (got) overlapTrue += 1;
  assert.equal(got, refOverlaps(world, x, z, r, skip),
    `grid overlaps() disagreed with the full scan at ${x.toFixed(3)},${z.toFixed(3)} r=${r.toFixed(3)}`);
}
assert.ok(overlapTrue > 20_000 && overlapTrue < 180_000,
  'the probe field stopped discriminating — a always/never-true result proves nothing');

let resolveMoved = 0;
for (let i = 0; i < 400_000; i++) {
  // Half the probes land inside a deliberately dense cluster, where a body is
  // pushed by several colliders in one pass — the case the query pad exists for.
  const tight = i % 2 === 0;
  const x = (rnd() - 0.5) * (tight ? 24 : 110);
  const z = (rnd() - 0.5) * (tight ? 20 : 90);
  const r = R_MIN + rnd() * (R_MAX - R_MIN);
  const grid = { x, z };
  const scan = { x, z };
  const settledGrid = world.resolve(grid, r);
  const settledScan = refResolve(world, scan, r);
  if (grid.x !== x || grid.z !== z) resolveMoved += 1;
  assert.equal(settledGrid, settledScan, 'grid resolve() reported a different settled state');
  assert.equal(grid.x, scan.x, `grid resolve() landed on a different x from ${x.toFixed(3)},${z.toFixed(3)}`);
  assert.equal(grid.z, scan.z, `grid resolve() landed on a different z from ${x.toFixed(3)},${z.toFixed(3)}`);
}
assert.ok(resolveMoved > 10_000, 'no probe was ever pushed — the resolve comparison proves nothing');

// The index must follow the world. A collider added after the first query has to
// appear, and clear() has to empty it.
const late = world.addCircle(200, 200, 1.5);
assert.equal(world.overlaps(200, 200, 0.4), true, 'a collider added after indexing was not seen');
assert.equal(refOverlaps(world, 200, 200, 0.4), true);
world.clear();
assert.equal(world.overlaps(200, 200, 0.4), false, 'clear() left stale colliders in the index');
assert.ok(late, 'collider handle is returned for later reference');

// Finally: the whole point. Count how many colliders a query actually touches.
const camp = new ColliderWorld();
for (let i = 0; i < 170; i++) camp.addCircle((rnd() - 0.5) * 80, (rnd() - 0.5) * 64, 0.4 + rnd() * 1.2);
let touched = 0;
const SAMPLES = 5_000;
for (let i = 0; i < SAMPLES; i++) {
  const x = (rnd() - 0.5) * 80; const z = (rnd() - 0.5) * 64;
  touched += camp._near(x - 0.34, z - 0.34, x + 0.34, z + 0.34).length;
}
const perQuery = touched / SAMPLES;
assert.ok(perQuery < camp.statics.length * 0.1,
  `grid still hands back ${perQuery.toFixed(1)} of ${camp.statics.length} colliders per query`);

console.log(
  `collision grid: PASS — 200k overlaps + 400k resolves identical to the full scan; `
  + `a body now meets ${perQuery.toFixed(1)} of ${camp.statics.length} colliders per query `
  + `(-${(100 - (perQuery / camp.statics.length) * 100).toFixed(1)}%)`,
);
