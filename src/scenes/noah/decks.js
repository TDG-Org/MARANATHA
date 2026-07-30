import * as THREE from 'three';
import { mergeGeometries, dyeGeometry, toonMat } from '../../engine/world.js';
import { DeckField } from '../../engine/DeckField.js';
import {
  DECK_Y, DECK_PITCH, DECK_CLEAR, DECK_STRUCTURE, HOLD, CORRIDOR,
  RAMP, RAMPS, DOOR, HULL, ARK, COLORS, BILGE,
} from './arkSpec.js';

// THE THREE DECKS — the part the player actually stands on.
//
// Genesis 6:16 (WEB): "...with lower, second, and third levels."
//
// Everything here is derived from arkSpec, and the geometry and the walkable
// DeckField are built from THE SAME rectangles. That matters more than it
// sounds: the classic way a multi-floor level breaks is that the art says the
// floor is here and the collision says it is there, and the player walks
// through the world or on top of nothing. Here a hatchway is cut out of the
// floor rectangle ONCE and both the mesh and the walkable surface are built
// from the result, so they cannot disagree.

// Rectangle minus rectangle, as up to four rectangles. Exact edges, unlike a
// grid-with-holes, which is what a hatchway coaming needs to sit against.
export function rectSubtract(outer, hole) {
  const overlaps = hole.minX < outer.maxX && hole.maxX > outer.minX
    && hole.minZ < outer.maxZ && hole.maxZ > outer.minZ;
  if (!overlaps) return [outer];
  const out = [];
  const hx0 = Math.max(outer.minX, hole.minX);
  const hx1 = Math.min(outer.maxX, hole.maxX);
  const hz0 = Math.max(outer.minZ, hole.minZ);
  const hz1 = Math.min(outer.maxZ, hole.maxZ);
  if (hz0 > outer.minZ) out.push({ ...outer, maxZ: hz0 });
  if (hz1 < outer.maxZ) out.push({ ...outer, minZ: hz1 });
  if (hx0 > outer.minX) out.push({ ...outer, minZ: hz0, maxZ: hz1, maxX: hx0 });
  if (hx1 < outer.maxX) out.push({ ...outer, minZ: hz0, maxZ: hz1, minX: hx1 });
  return out.filter((r) => r.maxX - r.minX > 0.01 && r.maxZ - r.minZ > 0.01);
}

function subtractAll(outer, holes) {
  let rects = [outer];
  for (const h of holes) rects = rects.flatMap((r) => rectSubtract(r, h));
  return rects;
}

// A deck slab: the walking surface plus its visible thickness. Built as a box so
// it is solid from below too — you see the underside of deck 2 as deck 1's
// ceiling, and it has to be there.
const SLAB = 0.30;

function slabGeometry(r, topY, color) {
  const g = new THREE.BoxGeometry(r.maxX - r.minX, SLAB, r.maxZ - r.minZ);
  g.translate((r.minX + r.maxX) / 2, topY - SLAB / 2, (r.minZ + r.maxZ) / 2);
  // UVs in metres so the deck planking matches the hull's scale.
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / 4.5, pos.getZ(i) / 4.5);
  }
  return dyeGeometry(g, color);
}

// The ramp: a sloped slab. Genesis does not describe how the animals got from
// deck to deck, but a vessel loaded with livestock moves them on ramps, and
// every serious reconstruction uses them.
function rampGeometry(r, yLow, yHigh, color) {
  const len = Math.abs(r.x1 - r.x0);
  const rise = yHigh - yLow;
  const hyp = Math.hypot(len, rise);
  const g = new THREE.BoxGeometry(hyp, 0.22, RAMP.width);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 3.2, pos.getZ(i) / 3.2);
  const dir = Math.sign(r.x1 - r.x0);
  g.rotateZ(dir * Math.atan2(rise, len));
  g.translate((r.x0 + r.x1) / 2, (yLow + yHigh) / 2 - 0.11, r.zCenter);
  return dyeGeometry(g, color);
}

// Instanced repeats: beams, posts, frames. One draw each, hundreds of pieces.
function instanced(geo, material, placements) {
  const mesh = new THREE.InstancedMesh(geo, material, placements.length);
  const d = new THREE.Object3D();
  placements.forEach((p, i) => {
    d.position.set(p.x, p.y, p.z);
    d.rotation.set(p.rx || 0, p.ry || 0, p.rz || 0);
    d.scale.set(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false; // the ark is longer than any frustum test helps
  return mesh;
}

export function buildDecks(wood) {
  const group = new THREE.Group();
  group.name = 'ark-decks';
  const colliders = [];
  const floors = new DeckField({ stepUp: 0.62, groundY: 0 });
  const disposables = [];

  const holdRect = {
    minX: HOLD.minX, maxX: HOLD.maxX,
    minZ: -HOLD.halfWidth, maxZ: HOLD.halfWidth,
  };

  // --- the hatchways -----------------------------------------------------------
  // Each ramp gets a full-length opening in the deck it climbs to. A slot the
  // whole run guarantees headroom the entire climb and reads as what it is: a
  // ship's hatchway with the ramp rising through it.
  // The opening is EXACTLY the ramp's footprint. It is tempting to give it a
  // little clearance, and that clearance is a slot down the side of the ramp
  // that a player walks into and falls a whole deck through. The coamings sit
  // outside the opening instead.
  const hatchOf = (r) => ({
    minX: Math.min(r.x0, r.x1),
    maxX: Math.max(r.x0, r.x1),
    minZ: r.zCenter - RAMP.width / 2,
    maxZ: r.zCenter + RAMP.width / 2,
  });
  const hatches = RAMPS.map(hatchOf);

  // --- floors ------------------------------------------------------------------
  const slabGeos = [];
  const deckRects = [];
  DECK_Y.forEach((y, deck) => {
    // A deck is cut by the hatchway of any ramp that climbs TO it.
    const cut = RAMPS.filter((r) => r.toDeck === deck).map(hatchOf);
    const rects = subtractAll(holdRect, cut);
    deckRects.push(rects);
    rects.forEach((r) => {
      slabGeos.push(slabGeometry(r, y, COLORS.deckPlank));
      floors.addFloor({ ...r, y, id: `deck${deck + 1}` });
    });
  });

  // --- ramps -------------------------------------------------------------------
  RAMPS.forEach((r) => {
    const yLow = DECK_Y[r.fromDeck];
    const yHigh = DECK_Y[r.toDeck];
    slabGeos.push(rampGeometry(r, yLow, yHigh, COLORS.beam));
    // The DeckField wants min-edge-low, so a ramp running -x is expressed with
    // its heights swapped rather than by flipping the rectangle.
    const lo = Math.min(r.x0, r.x1);
    const hi = Math.max(r.x0, r.x1);
    const climbingPositive = r.x1 > r.x0;
    floors.addRamp({
      minX: lo, maxX: hi,
      minZ: r.zCenter - RAMP.width / 2,
      maxZ: r.zCenter + RAMP.width / 2,
      axis: 'x',
      yLow: climbingPositive ? yLow : yHigh,
      yHigh: climbingPositive ? yHigh : yLow,
      id: r.id,
    });
  });

  // --- the boarding ramp, from the ground in through the door ------------------
  // Genesis 7:16 — they went in. Something has to carry them up to a sill more
  // than a person's height above the ground.
  const board = {
    x0: DOOR.x - 2.1, x1: DOOR.x + 2.1,
    zOuter: ARK.halfWidth + 9.2,
    zInner: ARK.halfWidth - HULL.skin - 0.5,
  };
  {
    const len = board.zOuter - board.zInner;
    const rise = DOOR.sillY;
    const hyp = Math.hypot(len, rise);
    const g = new THREE.BoxGeometry(board.x1 - board.x0, 0.26, hyp);
    const uv = g.attributes.uv; const pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 3.2, pos.getZ(i) / 3.2);
    g.rotateX(-Math.atan2(rise, len));
    g.translate((board.x0 + board.x1) / 2, rise / 2 - 0.13, (board.zInner + board.zOuter) / 2);
    slabGeos.push(dyeGeometry(g, COLORS.timber));
    floors.addRamp({
      minX: board.x0, maxX: board.x1,
      minZ: board.zInner, maxZ: board.zOuter,
      axis: 'z',
      yLow: DOOR.sillY,  // min-z edge is the INNER (high) end
      yHigh: 0,
      id: 'boarding',
    });
    // A landing just inside the door, so stepping off the ramp lands on deck 1
    // even though the hold rect stops short of the hull.
    floors.addFloor({
      minX: board.x0 - 0.6, maxX: board.x1 + 0.6,
      minZ: HOLD.halfWidth - 0.02, maxZ: board.zInner + 0.05,
      y: DECK_Y[0], id: 'deck1',
    });
    const sill = new THREE.BoxGeometry(board.x1 - board.x0 + 1.2, 0.3, HOLD.halfWidth - board.zInner + 1.2);
    sill.translate((board.x0 + board.x1) / 2, DECK_Y[0] - 0.15, (HOLD.halfWidth + board.zInner) / 2);
    slabGeos.push(dyeGeometry(sill, COLORS.deckPlank));
  }

  const deckMesh = new THREE.Mesh(mergeGeometries(slabGeos), wood.matDeck());
  deckMesh.geometry.computeVertexNormals();
  deckMesh.name = 'ark-deck-slabs';
  group.add(deckMesh);
  disposables.push(deckMesh.geometry);

  // --- structure the player can see --------------------------------------------
  // Deck beams: the transverse timbers carrying each deck, hanging below it.
  // This is what makes an interior read as BUILT rather than as a room.
  const beamGeo = new THREE.BoxGeometry(0.30, DECK_STRUCTURE * 0.62, HOLD.halfWidth * 2);
  const beams = [];
  const BEAM_SPACING = 2.35;
  const FULL_Z = HOLD.halfWidth * 2;
  for (let d = 0; d < 3; d++) {
    // Beams hang under the deck ABOVE this one; the top deck's hang under the roof.
    const y = (d < 2 ? DECK_Y[d + 1] : DECK_Y[2] + DECK_PITCH) - SLAB - DECK_STRUCTURE * 0.31;
    // The hatchway (if any) cut into the deck this level's beams carry.
    const hatch = hatches[RAMPS.findIndex((r) => r.toDeck === d + 1)] || null;
    for (let x = HOLD.minX + 1.0; x < HOLD.maxX; x += BEAM_SPACING) {
      const crosses = hatch && x > hatch.minX - 0.4 && x < hatch.maxX + 0.4;
      if (!crosses) {
        beams.push({ x, y, z: 0 });
        continue;
      }
      // A beam cannot run through an open hatchway, but the deck still needs
      // carrying on the far side of it. Keep the wider remaining span.
      const below = { a: -HOLD.halfWidth, b: hatch.minZ };
      const above = { a: hatch.maxZ, b: HOLD.halfWidth };
      const keep = (below.b - below.a) >= (above.b - above.a) ? below : above;
      const span = keep.b - keep.a;
      if (span < 0.8) continue;
      beams.push({ x, y, z: (keep.a + keep.b) / 2, sz: span / FULL_Z });
    }
  }
  const beamMesh = instanced(beamGeo, wood.matTimber(), beams);
  beamMesh.name = 'ark-beams';
  group.add(beamMesh);
  disposables.push(beamGeo);

  // Stanchions: the posts under the beams down the centre line, off the corridor
  // so they never stand in the walking route.
  const postGeo = new THREE.BoxGeometry(0.26, 1, 0.26);
  const posts = [];
  for (let d = 0; d < 3; d++) {
    const y = DECK_Y[d];
    const h = (d < 2 ? DECK_Y[d + 1] : DECK_Y[2] + DECK_PITCH) - SLAB - y;
    for (let x = HOLD.minX + 2.2; x < HOLD.maxX; x += BEAM_SPACING * 2) {
      for (const z of [-CORRIDOR.halfWidth - 0.42, CORRIDOR.halfWidth + 0.42]) {
        if (hatches.some((hh) => x > hh.minX - 0.5 && x < hh.maxX + 0.5
          && z > hh.minZ - 0.5 && z < hh.maxZ + 0.5)) continue;
        posts.push({ x, y: y + h / 2, z, sy: h });
        colliders.push({
          type: 'circle', x, z, r: 0.30, group: 'ark-post',
          minY: y, maxY: y + h,
        });
      }
    }
  }
  const postMesh = instanced(postGeo, wood.matTimber(), posts);
  postMesh.name = 'ark-posts';
  group.add(postMesh);
  disposables.push(postGeo);

  // Frames (ribs): the hull's own skeleton, standing proud of the inner skin the
  // whole height of the vessel. Seen from inside, these are the ark's ribs.
  const frameGeo = new THREE.BoxGeometry(0.34, 1, 0.30);
  const frames = [];
  const FRAME_SPACING = 2.35;
  for (let x = HOLD.minX; x <= HOLD.maxX; x += FRAME_SPACING) {
    for (const side of [-1, 1]) {
      frames.push({
        x, y: BILGE + (DECK_Y[2] + DECK_PITCH - BILGE) / 2,
        z: side * (HOLD.halfWidth + 0.16),
        sy: DECK_Y[2] + DECK_PITCH - BILGE,
      });
    }
  }
  const frameMesh = instanced(frameGeo, wood.matTimber(), frames);
  frameMesh.name = 'ark-frames';
  group.add(frameMesh);
  disposables.push(frameGeo);

  // --- collision ----------------------------------------------------------------
  // Per-deck walls. Each carries a vertical span, so deck 1's walls are felt on
  // deck 1 and walked straight past on deck 3 — the whole reason the collider
  // world learned about height.
  const WALL = 0.6;
  DECK_Y.forEach((y, deck) => {
    const top = y + DECK_CLEAR;
    const span = { minY: y, maxY: top };
    // the two long sides
    colliders.push({
      type: 'aabb', group: `ark-wall-${deck}`, ...span,
      minX: HOLD.minX - 4, maxX: HOLD.maxX + 4,
      minZ: HOLD.halfWidth, maxZ: HOLD.halfWidth + WALL,
    });
    colliders.push({
      type: 'aabb', group: `ark-wall-${deck}`, ...span,
      minX: HOLD.minX - 4, maxX: HOLD.maxX + 4,
      minZ: -HOLD.halfWidth - WALL, maxZ: -HOLD.halfWidth,
    });
    // the bulkheads fore and aft
    colliders.push({
      type: 'aabb', group: `ark-bulkhead-${deck}`, ...span,
      minX: HOLD.minX - WALL, maxX: HOLD.minX,
      minZ: -HOLD.halfWidth - 1, maxZ: HOLD.halfWidth + 1,
    });
    colliders.push({
      type: 'aabb', group: `ark-bulkhead-${deck}`, ...span,
      minX: HOLD.maxX, maxX: HOLD.maxX + WALL,
      minZ: -HOLD.halfWidth - 1, maxZ: HOLD.halfWidth + 1,
    });
  });

  // The door is the ONE way through the side, so the deck-1 wall opens there.
  // Rather than splitting the wall run, the doorway punches a gap by replacing
  // the +Z deck-1 wall with two pieces.
  {
    const i = colliders.findIndex((c) => c.group === 'ark-wall-0' && c.minZ === HOLD.halfWidth);
    const wall = colliders[i];
    colliders.splice(i, 1,
      { ...wall, maxX: board.x0 - 0.5 },
      { ...wall, minX: board.x1 + 0.5 },
    );
  }

  // Hatchway coamings: the raised kerb round an opening, which on a real ship
  // stops water going below and here stops a player walking into the hole.
  const coamGeos = [];
  RAMPS.forEach((r, i) => {
    const h = hatches[i];
    const deck = r.toDeck;
    const y = DECK_Y[deck];
    // three sides — the fourth is where the ramp arrives
    const arrivesAtMaxX = r.x1 > r.x0;
    const sides = [
      { minX: h.minX, maxX: h.maxX, minZ: h.minZ - 0.22, maxZ: h.minZ },
      { minX: h.minX, maxX: h.maxX, minZ: h.maxZ, maxZ: h.maxZ + 0.22 },
      arrivesAtMaxX
        ? { minX: h.minX - 0.22, maxX: h.minX, minZ: h.minZ - 0.22, maxZ: h.maxZ + 0.22 }
        : { minX: h.maxX, maxX: h.maxX + 0.22, minZ: h.minZ - 0.22, maxZ: h.maxZ + 0.22 },
    ];
    sides.forEach((s) => {
      const g = new THREE.BoxGeometry(s.maxX - s.minX, 0.95, s.maxZ - s.minZ);
      g.translate((s.minX + s.maxX) / 2, y + 0.475, (s.minZ + s.maxZ) / 2);
      coamGeos.push(dyeGeometry(g, COLORS.beam));
      colliders.push({ type: 'aabb', group: 'ark-coaming', ...s, minY: y, maxY: y + 0.95 });
    });
  });
  const coaming = new THREE.Mesh(mergeGeometries(coamGeos), wood.matTimber());
  coaming.geometry.computeVertexNormals();
  coaming.name = 'ark-coamings';
  group.add(coaming);
  disposables.push(coaming.geometry);

  return {
    group,
    floors,
    colliders,
    deckRects,
    hatches,
    boarding: board,
    spawn: { x: DOOR.x, z: board.zOuter + 3.0 },
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      group.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
    },
  };
}
