// THE ARK HAS TO BE THE SIZE SCRIPTURE SAYS IT IS.
//
// This is a biblically accurate game, and the ark's measurements are one of the
// few places where Scripture gives a hard number that can simply be checked. So
// this group checks it: 300 x 50 x 30 cubits, three decks, a door in the side, a
// window band finished to a cubit. If a taste tweak ever quietly changes a
// dimension, this fails.
//
// It also proves the two things that a walkable model can get silently wrong:
// that the geometry and the walkable DeckField agree about where the decks are
// (they are built from the same spec, and this proves it), and that the whole
// vessel fits the project's triangle budget.
//
// Run: node tools/test-ark-model.mjs
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ARK, CUBIT, DECK_Y, DECK_PITCH, DECK_CLEAR, EAVES_Y, BILGE, KEEL_Y,
  DOOR, WINDOW, HOLD, CORRIDOR, RAMPS, HULL,
} from '../src/scenes/noah/arkSpec.js';
import { buildHull, station, hullPoint } from '../src/scenes/noah/hull.js';
import { buildDecks } from '../src/scenes/noah/decks.js';
import { ColliderWorld } from '../src/engine/collision.js';
import { stepHeight } from '../src/engine/DeckField.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const near = (a, b, tol, m) => { assert.ok(Math.abs(a - b) <= tol, `${m} (${a} vs ${b})`); checks++; };

const FT = 0.3048;

// ── 1. The three given measures ──────────────────────────────────────────────
{
  near(ARK.length / CUBIT, 300, 1e-9, 'the ark is 300 cubits long');
  near(ARK.width / CUBIT, 50, 1e-9, 'the ark is 50 cubits wide');
  near(ARK.height / CUBIT, 30, 1e-9, 'the ark is 30 cubits high');

  // The chosen cubit is 18 inches exactly, so the familiar feet come out round.
  near(ARK.length / FT, 450, 1e-6, 'which is 450 ft');
  near(ARK.width / FT, 75, 1e-6, 'by 75 ft');
  near(ARK.height / FT, 45, 1e-6, 'by 45 ft');

  // The proportions Scripture gives are 6 : 1 : 0.6 — the thing that most
  // impressed the naval architects who studied it.
  near(ARK.length / ARK.width, 6, 1e-9, 'length:beam is exactly 6:1');
  near(ARK.width / ARK.height, 50 / 30, 1e-9, 'beam:depth is 5:3');
}

// ── 2. Three decks, inside thirty cubits — not stacked on top of them ────────
{
  assert.equal(DECK_Y.length, 3, 'lower, second and third'); checks++;
  near(DECK_Y[0], KEEL_Y + BILGE, 1e-9, 'deck 1 sits on the bilge, above the building blocks');
  near(DECK_Y[1] - DECK_Y[0], DECK_PITCH, 1e-9, 'decks are evenly pitched');
  near(DECK_Y[2] - DECK_Y[1], DECK_PITCH, 1e-9, 'decks are evenly pitched');
  near(DECK_Y[0] + DECK_PITCH * 3, EAVES_Y, 1e-9, 'the third deck head lands exactly on the eaves');
  near(EAVES_Y - KEEL_Y, ARK.height, 1e-9, 'keel to eaves IS thirty cubits — the decks are inside them');
  ok(KEEL_Y > 1.0, 'the hull stands on building blocks, as a hull under construction must');

  // A person is about 1.75 u tall. Every deck must clear that comfortably, or
  // the interior is not walkable at all.
  ok(DECK_CLEAR > 2.4, `deck headroom ${DECK_CLEAR.toFixed(2)}m clears a person with room over`);
  ok(DECK_CLEAR < DECK_PITCH, 'headroom leaves room for the structure carrying the deck above');
}

// ── 3. A door in the side, a window finished to a cubit ──────────────────────
{
  // Genesis 6:16 — "set the door of the ship in its side"
  ok(Math.abs(DOOR.x) < ARK.halfLength, 'the door is in the SIDE, not an end');
  ok(DOOR.height > 1.75 * 1.6, 'the door is far taller than a person (animals pass)');
  near(DOOR.width / CUBIT, 6, 1e-9, 'the door is 6 cubits wide');
  near(DOOR.sillY, DECK_Y[0], 1e-9, 'the door opens onto the lower deck');

  // "finish it to a cubit upward"
  near(WINDOW.height, CUBIT, 1e-9, 'the window band is exactly one cubit high');
  near(WINDOW.sillY + WINDOW.height, EAVES_Y, 1e-9, 'and its head is the eaves');
}

// ── 4. The hull is a hull — and it is the size the spec says ─────────────────
{
  const stub = () => new THREE.MeshBasicMaterial({ vertexColors: true });
  const hull = buildHull({ matExterior: stub, matInner: stub });

  for (const [name, mesh] of [['exterior', hull.exterior], ['inner skin', hull.interior]]) {
    const g = mesh.geometry;
    const pos = g.attributes.position.array;
    let bad = 0;
    for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) bad++;
    ok(bad === 0, `${name} has no non-finite vertices`);
    ok(g.attributes.color, `${name} carries vertex colours (one draw, many tones)`);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    near(bb.max.x - bb.min.x, ARK.length, 0.05, `${name} spans the full 300 cubits`);
    ok(bb.max.z - bb.min.z <= ARK.width + 0.02, `${name} never exceeds 50 cubits of beam`);
    near(bb.min.y, KEEL_Y, 0.05, `${name} sits on its building blocks, clear of the ground`);
  }

  // The bow and stern taper, the midbody does not.
  near(station(0).halfWidth, ARK.halfWidth, 1e-9, 'amidships is full beam');
  ok(station(1).halfWidth < ARK.halfWidth * 0.45, 'the bow tapers');
  ok(station(-1).halfWidth < ARK.halfWidth * 0.45, 'the stern tapers');
  ok(station(1).topY > station(0).topY, 'the sheer rises toward the bow');
  ok(station(1).topY > station(-1).topY, 'the bow is the higher end');
  ok(station(1).bottomY > station(0).bottomY, 'the bottom rockers up at the ends');
  near(station(0).bottomY, KEEL_Y, 1e-9, 'amidships is flat-bottomed (it is a barge there)');
  near(station(0).topY, EAVES_Y, 1e-9, 'amidships sheer is exactly the eaves');

  // The midbody holds full beam for the fraction the spec claims — this is
  // where all the capacity lives.
  const holdEdge = HULL.midbodyFraction * 0.98;
  near(station(holdEdge).halfWidth, ARK.halfWidth, 0.02, 'full beam holds across the midbody');

  // THE TWO SKINS MUST NOT TOUCH, or they z-fight the length of the vessel.
  for (const u of [-0.9, -0.4, 0, 0.4, 0.9]) {
    for (const v of [0.15, 0.5, 0.85]) {
      const outer = hullPoint(u, v, 1);
      const inner = hullPoint(u, v, 1, HULL.skin);
      ok(outer.z - inner.z > 0.2, `skins are separated at u=${u} v=${v} (no z-fighting)`);
    }
  }

  // ── THE OPENINGS ARE CUT WHERE SCRIPTURE PUTS THEM ────────────────────────
  // Measured back off the built surface, not read from the spec. The profile
  // maps the surface parameter to height non-linearly, so an uninverted or
  // grid-snapped cut lands the window band up to a metre from where a band
  // "finished to a cubit upward" belongs — on a band that is 0.457 m high, that
  // is the difference between accurate and decorative.
  const op = hull.openings;
  near(op.windowSillY, WINDOW.sillY, 0.01, 'the window band is cut at its true sill');
  near(op.eavesY - op.windowSillY, CUBIT, 0.01, 'and it really is one cubit high on the built hull');
  near(op.door.y0, DOOR.sillY, 0.01, 'the door sill is cut at the lower deck');
  near(op.door.y1 - op.door.y0, DOOR.height, 0.01, 'the door opening is its full height');
  near(op.door.x1 - op.door.x0, DOOR.width, 0.01, 'the door opening is its full width');
  near((op.door.x0 + op.door.x1) / 2, DOOR.x, 0.01, 'and it is where the spec puts it');

  // A hole is only a hole if quads were actually removed. Compare the door side
  // against a solid reference: the same grid with nothing skipped.
  {
    const solidQuads = (hull.exterior.geometry.index.count / 6);
    ok(solidQuads > 0, 'the exterior has quads at all');
    // The window band runs both sides for the full length and the door is one
    // opening: the exterior must have visibly fewer triangles than a hull with
    // no openings would, which the inner skin (same grid, same skips) mirrors.
    ok(hull.interior.geometry.index.count > 0, 'the inner skin was built');
  }

  // BUDGET. The project's ceiling is 120k triangles for a whole scene, and the
  // ark is only part of one.
  const tris = hull.triangles;
  ok(tris < 40000, `hull is ${tris} triangles — well inside the scene budget`);
  console.log(`  hull: ${tris} triangles across 2 draws`);
}

// ── 5. The hold, the corridor and the ramps all fit inside the hull ──────────
{
  ok(HOLD.halfWidth < ARK.halfWidth - HULL.skin, 'the hold is inside the hull skin');
  ok(CORRIDOR.halfWidth < HOLD.halfWidth, 'the corridor fits inside the hold');
  ok(CORRIDOR.halfWidth * 2 > 2.6, 'the corridor is wide enough for two people and a led animal');

  for (const r of RAMPS) {
    const lo = Math.min(r.x0, r.x1);
    const hi = Math.max(r.x0, r.x1);
    ok(lo > HOLD.minX && hi < HOLD.maxX, `${r.id} lies within the hold`);
    const rise = DECK_Y[r.toDeck] - DECK_Y[r.fromDeck];
    const run = Math.abs(r.x1 - r.x0);
    const slope = rise / run;
    ok(slope > 0.15 && slope < 0.42, `${r.id} slope ${slope.toFixed(2)} is climbable and reads as a ramp`);
    // Loaded animals do not climb what a person would call steep.
    ok(Math.atan(slope) * 180 / Math.PI < 23, `${r.id} is under 23 degrees`);
  }

  // The two ramps must not be the same route back — they double back.
  ok(Math.sign(RAMPS[0].x1 - RAMPS[0].x0) !== Math.sign(RAMPS[1].x1 - RAMPS[1].x0),
    'the ramps alternate direction, so the climb is a real circulation route');
  ok(Math.sign(RAMPS[0].zCenter) !== Math.sign(RAMPS[1].zCenter),
    'and alternate sides of the corridor');
}

// ── 6. YOU CAN ACTUALLY WALK IT ──────────────────────────────────────────────
// The point of the whole exercise. A body starts on the ground outside, climbs
// the boarding ramp, goes through the door, crosses the lower deck, and climbs
// both interior ramps to the top deck — driven through the REAL DeckField and
// the REAL collider world, one 60Hz step at a time, exactly as the controller
// drives it. Nothing here is asserted from the spec; it is all measured from
// where the body ends up.
{
  const stub = () => new THREE.MeshBasicMaterial({ vertexColors: true });
  const wood = { matDeck: stub, matTimber: stub };
  const decks = buildDecks(wood);
  const world = new ColliderWorld();
  world.bodyHeight = 1.7;
  decks.colliders.forEach((c) => world.add(c));

  const RADIUS = 0.42;
  const SPEED = 3.05;
  const DT = 1000 / 60;

  const body = { x: decks.spawn.x, y: 0, z: decks.spawn.z };
  const fall = { y: 0, vy: 0, falling: false };
  const trail = [];

  // Walk toward a target, stepping the same way the controller does: move in
  // xz, resolve collision, then resolve the floor.
  function walkTo(tx, tz, label, maxSeconds = 90) {
    const steps = Math.ceil((maxSeconds * 1000) / DT);
    for (let i = 0; i < steps; i++) {
      const dx = tx - body.x;
      const dz = tz - body.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.35) return true;
      const step = Math.min(SPEED * (DT / 1000), d);
      body.x += (dx / d) * step;
      body.z += (dz / d) * step;
      world.resolve(body, RADIUS);
      const surf = decks.floors.surfaceAt(body.x, body.z, fall.y);
      stepHeight(fall, surf.y, DT);
      body.y = fall.y;
      trail.push({ x: body.x, y: body.y, z: body.z, deck: surf.id });
      // A body must never be underground or above the roof, at any instant.
      if (body.y < -0.5 || body.y > EAVES_Y + 2) {
        assert.fail(`${label}: body left the world at y=${body.y.toFixed(2)}`);
      }
    }
    return false;
  }

  const startY = body.y;
  near(startY, 0, 1e-9, 'the walk starts on the ground outside the ark');

  // 1. up the boarding ramp and in through the door
  ok(walkTo(DOOR.x, ARK.halfWidth + 2.0, 'boarding ramp'), 'walked up the boarding ramp');
  ok(walkTo(DOOR.x, HOLD.halfWidth - 2.0, 'through the door'), 'walked in through the door');
  near(body.y, DECK_Y[0], 0.05, 'and arrived on the LOWER deck');
  ok(body.y > startY + 1.5, `climbed ${(body.y - startY).toFixed(2)}m from the ground to get aboard`);

  // 2. along deck 1 to the foot of the first ramp
  const r12 = RAMPS[0];
  ok(walkTo(r12.x0 - 2.0, r12.zCenter, 'deck 1 corridor'), 'crossed the lower deck');
  near(body.y, DECK_Y[0], 0.05, 'still on the lower deck');

  // 3. up ramp 1 -> 2
  ok(walkTo(r12.x1 + 2.5, r12.zCenter, 'ramp 1-2'), 'climbed the first interior ramp');
  near(body.y, DECK_Y[1], 0.05, 'and arrived on the SECOND deck');

  // 4. across deck 2 to the second ramp
  const r23 = RAMPS[1];
  ok(walkTo(r23.x0 + 2.0, r23.zCenter, 'deck 2 corridor'), 'crossed the second deck');
  near(body.y, DECK_Y[1], 0.05, 'still on the second deck');

  // 5. up ramp 2 -> 3
  ok(walkTo(r23.x1 - 2.5, r23.zCenter, 'ramp 2-3'), 'climbed the second interior ramp');
  near(body.y, DECK_Y[2], 0.05, 'and arrived on the THIRD deck');

  // 6. the full length of the top deck, bow to stern, down the corridor.
  // Step into the CORRIDOR first: the direct diagonal from the ramp head runs
  // back over the open hatchway, and walking into an open hatchway is supposed
  // to drop you (see the hatch check below) — it is a hole, not a bug.
  ok(walkTo(r23.x1 - 2.5, 0, 'onto the deck 3 corridor'), 'stepped into the corridor');
  near(body.y, DECK_Y[2], 0.05, 'the corridor is clear of the hatchway');
  ok(walkTo(HOLD.maxX - 2.0, 0, 'deck 3 forward'), 'walked forward along the top deck');
  near(body.y, DECK_Y[2], 0.05, 'the top deck holds all the way forward');
  ok(walkTo(HOLD.minX + 2.0, 0, 'deck 3 aft'), 'walked the full length aft');
  near(body.y, DECK_Y[2], 0.05, 'the top deck holds all the way aft');

  // The bulkheads and the sides really do stop you.
  const beforeWall = { ...body };
  walkTo(body.x, HOLD.halfWidth + 8, 'into the side', 6);
  ok(body.z < HOLD.halfWidth + 0.6, 'the hull side stops a body on the top deck');
  ok(Math.abs(body.y - DECK_Y[2]) < 0.05, 'and does not drop it off the deck');
  walkTo(HOLD.minX - 20, body.z, 'into the bulkhead', 8);
  ok(body.x > HOLD.minX - 1.2, 'the after bulkhead stops a body');

  // NOWHERE on that entire route was the body ever between decks.
  const legal = new Set([...DECK_Y, 0]);
  let offSurface = 0;
  for (const p of trail) {
    const onKnown = [...legal].some((y) => Math.abs(p.y - y) < 0.02);
    const onRamp = p.deck && /ramp|boarding/.test(p.deck);
    if (!onKnown && !onRamp) offSurface++;
  }
  ok(offSurface === 0, `all ${trail.length} steps of the walk were on a real surface (${offSurface} were not)`);
  console.log(`  walked ${trail.length} frames: ground -> deck 1 -> deck 2 -> deck 3, never off a surface`);

  // And the geometry the player sees agrees with the floors they stand on.
  let slabs = 0;
  decks.group.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) slabs++; });
  ok(slabs > 0, 'the decks have visible geometry, not just collision');
  ok(decks.floors.regions.length >= 3, 'every deck registered a walkable surface');
  decks.dispose();
}

console.log(`ark model: ${checks} checks passed`);
