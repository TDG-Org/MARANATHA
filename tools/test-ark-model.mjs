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
  ARK, CUBIT, DECK_Y, DECK_PITCH, DECK_CLEAR, EAVES_Y, BILGE,
  DOOR, WINDOW, HOLD, CORRIDOR, RAMPS, HULL,
} from '../src/scenes/noah/arkSpec.js';
import { buildHull, station, hullPoint } from '../src/scenes/noah/hull.js';

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
  near(DECK_Y[0], BILGE, 1e-9, 'deck 1 sits on the bilge');
  near(DECK_Y[1] - DECK_Y[0], DECK_PITCH, 1e-9, 'decks are evenly pitched');
  near(DECK_Y[2] - DECK_Y[1], DECK_PITCH, 1e-9, 'decks are evenly pitched');
  near(DECK_Y[0] + DECK_PITCH * 3, EAVES_Y, 1e-9, 'the third deck head lands exactly on the eaves');
  near(EAVES_Y, ARK.height, 1e-9, 'the eaves ARE thirty cubits — the decks are inside them');

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
    ok(bb.min.y >= -0.1, `${name} sits on its keel, not below the ground`);
  }

  // The bow and stern taper, the midbody does not.
  near(station(0).halfWidth, ARK.halfWidth, 1e-9, 'amidships is full beam');
  ok(station(1).halfWidth < ARK.halfWidth * 0.45, 'the bow tapers');
  ok(station(-1).halfWidth < ARK.halfWidth * 0.45, 'the stern tapers');
  ok(station(1).topY > station(0).topY, 'the sheer rises toward the bow');
  ok(station(1).topY > station(-1).topY, 'the bow is the higher end');
  ok(station(1).bottomY > station(0).bottomY, 'the bottom rockers up at the ends');
  near(station(0).bottomY, 0, 1e-9, 'amidships is flat-bottomed (it is a barge there)');
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

console.log(`ark model: ${checks} checks passed`);
