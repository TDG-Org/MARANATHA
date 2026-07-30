import * as THREE from 'three';
import { ARK, HULL, DOOR, WINDOW, EAVES_Y, KEEL_Y, RIDGE_RISE, COLORS } from './arkSpec.js';

// THE HULL — one parametric surface, built twice.
//
// The ark is 137 m long. Modelling it as authored geometry would be thousands of
// hand-placed pieces; modelling it as a box would be a shipping container. So the
// hull is a FUNCTION: give it a station along the length and a height up the
// side and it returns a point. Everything else - the outer pitched skin, the
// inner skin the player sees from inside, the door opening, the window band, the
// frames, the collision - is derived from that same function, which is the only
// way the inside and the outside can be guaranteed to agree.
//
// THE TWO SKINS. A single-sided surface is invisible from behind, and that is
// the whole trick that makes this walkable. The outer skin faces OUT and the
// inner skin faces IN, so from inside the ark a third-person camera sitting
// outside the hull sees straight through the inner skin's back faces to the
// interior, with no cutaway logic, no portals and no per-frame work. The scene
// only has to hide the outer skin while the player is aboard.

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

// The cross-section profile, as fractions: how far out (zK, times the station's
// half width) and how far up (yK, between the bottom and the sheer) each point
// of the section sits. Flat-bottomed amidships with a turn of the bilge, near
// vertical topsides, and a touch of tumblehome at the eaves.
const PROFILE = [
  [0.72, 0.000],  // the chine, where the flat bottom turns up
  [0.90, 0.045],
  [0.985, 0.130],
  [1.000, 0.360],
  [1.000, 0.620],
  [0.965, 1.000], // the eaves
];

// A station's shape at distance u along the hull, u in [-1, 1] (+1 = bow).
export function station(u) {
  const mid = HULL.midbodyFraction;
  const a = Math.abs(u);
  const t = clamp01((a - mid) / (1 - mid));
  // A full entry rather than a wedge: the width holds, then falls away.
  const widthK = 1 - (1 - HULL.endWidthFraction) * Math.pow(t, 1.55);
  const bow = u > 0;
  return {
    x: u * ARK.halfLength,
    halfWidth: ARK.halfWidth * widthK,
    // Rocker: the bottom lifts toward the ends so they are clear of the water.
    bottomY: KEEL_Y + (bow ? HULL.bowRocker : HULL.sternRocker) * t * t,
    // Sheer: the sides rise toward the ends. This single curve is most of what
    // makes a hull look like a hull.
    topY: EAVES_Y + (bow ? HULL.bowRise : HULL.sternRise) * smooth(t) * t,
  };
}

// PROFILE maps the surface parameter v to a height fraction yK, and it does so
// NON-LINEARLY (the turn of the bilge eats a third of the parameter in a tenth
// of the height). So a feature specified by its real height — the door head, the
// window sill — has to be converted before it can be cut. Inverting the profile
// is the difference between the window band being one cubit high, as Scripture
// says, and being wherever the nearest grid row happened to fall.
function vForYK(targetYK) {
  const last = PROFILE.length - 1;
  for (let i = 0; i < last; i++) {
    const a = PROFILE[i][1];
    const b = PROFILE[i + 1][1];
    if (targetYK <= b) return (i + (targetYK - a) / (b - a)) / last;
  }
  return 1;
}

// A world height, at a midbody station, as a surface parameter.
const vForHeight = (y) => vForYK((y - KEEL_Y) / ARK.height);


// A point on the hull surface: station parameter u, height parameter v (0 at the
// chine, 1 at the eaves), side +1/-1, and an inward inset for the second skin.
export function hullPoint(u, v, side, inset = 0) {
  const st = station(u);
  // interpolate the profile
  const f = clamp01(v) * (PROFILE.length - 1);
  const i = Math.min(PROFILE.length - 2, Math.floor(f));
  const k = f - i;
  const zK = PROFILE[i][0] + (PROFILE[i + 1][0] - PROFILE[i][0]) * k;
  const yK = PROFILE[i][1] + (PROFILE[i + 1][1] - PROFILE[i][1]) * k;
  const y = st.bottomY + (st.topY - st.bottomY) * yK;
  const z = side * (st.halfWidth * zK - inset);
  return { x: st.x, y, z };
}

// --- surface building --------------------------------------------------------

// Build a quad grid from a point function, skipping cells a predicate rejects
// (that is how the door and the window band become real openings rather than
// painted-on ones). Returns raw arrays so callers can merge many surfaces into
// one draw call.
// `us` and `vs` are the grid LINES, not a count, because the lines have to be
// able to land exactly on a feature edge. A uniform grid put the door head and
// the window sill wherever the nearest row fell — up to a metre out on a band
// that is supposed to be one cubit high.
function gridSurface({
  us, vs, point, skip = null, flip = false, uvScale = [1 / 9, 1 / 3.6],
  color = null, shade = null,
}) {
  const nu = us.length - 1;
  const nv = vs.length - 1;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  // Vertices are emitted per-quad rather than shared, because a skipped cell
  // must leave a clean edge and because flat-ish plank shading wants its own
  // normals. At this grid size the cost is a few thousand vertices.
  const c = new THREE.Color();
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const u0 = us[i]; const u1 = us[i + 1];
      const v0 = vs[j]; const v1 = vs[j + 1];
      if (skip && skip(u0, u1, v0, v1)) continue;
      const p00 = point(u0, v0);
      const p10 = point(u1, v0);
      const p11 = point(u1, v1);
      const p01 = point(u0, v1);
      const base = pos.length / 3;
      for (const p of [p00, p10, p11, p01]) pos.push(p.x, p.y, p.z);
      // UVs measured in METRES so plank size is consistent everywhere.
      uv.push(
        p00.x * uvScale[0], p00.y * uvScale[1],
        p10.x * uvScale[0], p10.y * uvScale[1],
        p11.x * uvScale[0], p11.y * uvScale[1],
        p01.x * uvScale[0], p01.y * uvScale[1],
      );
      for (const p of [p00, p10, p11, p01]) {
        if (shade) c.set(shade(p, (v0 + v1) / 2, (u0 + u1) / 2));
        else c.set(color ?? 0xffffff);
        col.push(c.r, c.g, c.b);
      }
      if (flip) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return { pos, uv, col, idx };
}

function toGeometry(parts) {
  let vCount = 0; let iCount = 0;
  for (const p of parts) { vCount += p.pos.length / 3; iCount += p.idx.length; }
  const pos = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const col = new Float32Array(vCount * 3);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0; let io = 0;
  for (const p of parts) {
    pos.set(p.pos, vo * 3);
    uv.set(p.uv, vo * 2);
    col.set(p.col, vo * 3);
    for (let i = 0; i < p.idx.length; i++) idx[io + i] = p.idx[i] + vo;
    vo += p.pos.length / 3;
    io += p.idx.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

// --- the openings ------------------------------------------------------------

// The door: Genesis 6:16, "set the door of the ship in its side". One opening,
// on the +Z side, at the lower deck.
const doorSpan = {
  x0: DOOR.x - DOOR.width / 2,
  x1: DOOR.x + DOOR.width / 2,
  y0: DOOR.sillY,
  y1: DOOR.sillY + DOOR.height,
};

// --- the built hull ----------------------------------------------------------

// Uniform lines from 0..1, then any exact boundaries a feature needs, sorted and
// de-duplicated. Lines closer together than `weld` are collapsed so a feature
// edge never leaves a sliver quad.
function gridLines(count, extra = [], weld = 0.004) {
  const set = [];
  for (let i = 0; i <= count; i++) set.push(i / count);
  for (const e of extra) if (e > 0 && e < 1) set.push(e);
  set.sort((a, b) => a - b);
  const out = [set[0]];
  for (let i = 1; i < set.length; i++) {
    if (set[i] - out[out.length - 1] > weld) out.push(set[i]);
    else if (extra.includes(set[i])) out[out.length - 1] = set[i]; // a feature edge wins
  }
  if (out[out.length - 1] < 1) out.push(1);
  return out;
}

export function buildHull(wood) {
  const NU = 118;  // stations along the length
  const NV = 20;   // rows up the side

  // VERTEX COLOUR IS SHADING, NOT HUE. The plank texture already carries the
  // colour of the wood. Multiplying it by a brown vertex colour as well was
  // brown x brown, and 137 m of hull came out as a muddy silhouette with no
  // plank visible in it at all. These return a MULTIPLIER around 1.0, so the
  // texture keeps its own colour and the vertices only decide how much light
  // reaches it — which is the only lighting the interior gets, since nothing in
  // this engine casts a shadow.
  const tmp = new THREE.Color();
  const shade = (k) => tmp.setScalar(k);
  const outerShade = (p, v) => {
    // dark at the waterline, brightening up the topsides to the sheer
    const k = v < 0.45
      ? 0.58 + (v / 0.45) * 0.36
      : 0.94 + ((v - 0.45) / 0.55) * 0.28;
    // a slow lengthwise variation so the run of the hull is never one tone
    return shade(k * (0.95 + 0.05 * Math.sin(p.x * 0.21) * Math.sin(p.x * 0.055 + 1.7)));
  };

  const innerShade = (p, v) => {
    // Inside, the light falls from the window band at the top: the further down
    // the side, the darker. This gradient IS the interior's sense of depth.
    return shade(clamp01(0.30 + v * 0.95));
  };

  const parts = [];
  const innerParts = [];

  // The exact surface parameters of every opening, so the grid can land on them.
  const vWindow = vForHeight(WINDOW.sillY);
  const vDoorSill = vForHeight(doorSpan.y0);
  const vDoorHead = vForHeight(doorSpan.y1);
  const uOf = (x) => (x / ARK.halfLength + 1) / 2;
  const uDoor0 = uOf(doorSpan.x0);
  const uDoor1 = uOf(doorSpan.x1);

  const vs = gridLines(NV, [vWindow, vDoorSill, vDoorHead]);
  const usDoorSide = gridLines(NU, [uDoor0, uDoor1]);
  const usPlain = gridLines(NU);

  for (const side of [1, -1]) {
    const isDoorSide = side === DOOR.side;
    const us = isDoorSide ? usDoorSide : usPlain;
    // The window band is the topmost slice of the side, simply left out — it is
    // open the whole length of both sides. Only the door is one-sided.
    const skip = (u0, u1, v0, v1) => {
      if (v0 >= vWindow - 1e-6) return true; // the tsohar band, both sides
      if (!isDoorSide) return false;
      return u0 >= uDoor0 - 1e-6 && u1 <= uDoor1 + 1e-6
        && v0 >= vDoorSill - 1e-6 && v1 <= vDoorHead + 1e-6;
    };

    parts.push(gridSurface({
      us, vs, skip, shade: outerShade,
      point: (u, v) => hullPoint(u * 2 - 1, v, side),
      flip: side < 0,
    }));

    innerParts.push(gridSurface({
      us, vs, skip, shade: innerShade,
      point: (u, v) => hullPoint(u * 2 - 1, v, side, HULL.skin),
      flip: side > 0, // normals point INWARD
      uvScale: [1 / 7, 1 / 3.2],
    }));
  }

  // THE BOTTOM: a flat sole between the two chines, following the rocker.
  parts.push(gridSurface({
    us: gridLines(NU), vs: gridLines(8), shade: (p) => shade(0.50 + 0.06 * Math.sin(p.x * 0.3)),
    point: (u, v) => {
      const a = hullPoint(u * 2 - 1, 0, -1);
      const b = hullPoint(u * 2 - 1, 0, 1);
      return { x: a.x, y: a.y - 0.03, z: a.z + (b.z - a.z) * v };
    },
    flip: true, // faces down
    uvScale: [1 / 9, 1 / 9],
  }));
  // ...and its inner face, which is the floor of the bilge below deck 1.
  innerParts.push(gridSurface({
    us: gridLines(40), vs: gridLines(4), color: 0x6a6a6a,
    point: (u, v) => {
      const a = hullPoint(u * 2 - 1, 0, -1, HULL.skin);
      const b = hullPoint(u * 2 - 1, 0, 1, HULL.skin);
      return { x: a.x, y: a.y + 0.04, z: a.z + (b.z - a.z) * v };
    },
    uvScale: [1 / 6, 1 / 6],
  }));

  // THE ROOF: "You shall make a roof in the ship". A shallow gable running the
  // full length, its ridge above the eaves, its slopes reaching just past the
  // sides so rain leaves the hull rather than the window band.
  // The eave reaches the hull's WIDEST point, not past it. The topsides tumble
  // in slightly (PROFILE ends at 0.965), so a roof carried out to the full beam
  // still overhangs the wall by ~0.4 m — enough that rain leaves the hull clear
  // of the open window band — while the vessel never exceeds the fifty cubits
  // of breadth it was given. An overhang past that would be a prettier roof and
  // a wrong ark.
  const ridgeAt = (u) => {
    const st = station(u * 2 - 1);
    return { x: st.x, y: st.topY + RIDGE_RISE, z: 0, hw: st.halfWidth };
  };
  for (const side of [1, -1]) {
    parts.push(gridSurface({
      us: gridLines(60), vs: gridLines(3),
      shade: (p, v) => shade((1.02 + v * 0.16) * (side > 0 ? 1.06 : 0.88)),
      point: (u, v) => {
        const r = ridgeAt(u);
        const eave = hullPoint(u * 2 - 1, 1, side);
        return {
          x: r.x,
          y: eave.y + (r.y - eave.y) * v,
          z: side * r.hw + (0 - side * r.hw) * v,
        };
      },
      flip: side < 0,
      uvScale: [1 / 8, 1 / 3],
    }));
    // the roof's underside, which is deck 3's ceiling
    innerParts.push(gridSurface({
      us: gridLines(40), vs: gridLines(2),
      color: 0x8a8a8a,
      point: (u, v) => {
        const r = ridgeAt(u);
        const eave = hullPoint(u * 2 - 1, 1, side, HULL.skin);
        return {
          x: r.x,
          y: eave.y + (r.y - 0.24 - eave.y) * v,
          z: side * (r.hw - HULL.skin) + (0 - side * (r.hw - HULL.skin)) * v,
        };
      },
      flip: side > 0,
      uvScale: [1 / 6, 1 / 3],
    }));
  }

  // THE ENDS: the hull narrows to a stem and a sternpost but never to nothing,
  // so both ends need a face. Built from the section at the very end.
  for (const end of [1, -1]) {
    const u = end; // +1 bow, -1 stern
    parts.push(gridSurface({
      us: gridLines(6), vs,
      shade: outerShade,
      point: (a, v) => {
        const p0 = hullPoint(u, v, -1);
        const p1 = hullPoint(u, v, 1);
        return { x: p0.x, y: p0.y, z: p0.z + (p1.z - p0.z) * a };
      },
      skip: (u0, u1, v0) => v0 >= vWindow - 1e-6,
      flip: end < 0,
      uvScale: [1 / 5, 1 / 3.6],
    }));
    // gable end above the eaves, closing the roof
    parts.push(gridSurface({
      us: gridLines(6), vs: gridLines(2),
      shade: (p, v) => shade(1.0 + v * 0.12),
      point: (a, v) => {
        const r = ridgeAt((u + 1) / 2);
        const eaveZ = (a * 2 - 1) * r.hw;
        const eaveY = station(u).topY;
        // a triangle: interpolate toward the ridge point
        return {
          x: r.x,
          y: eaveY + (r.y - eaveY) * v,
          z: eaveZ * (1 - v),
        };
      },
      flip: end < 0,
      uvScale: [1 / 5, 1 / 3],
    }));
  }

  const exterior = new THREE.Mesh(toGeometry(parts), wood.matExterior());
  exterior.name = 'ark-exterior';
  const interior = new THREE.Mesh(toGeometry(innerParts), wood.matInner());
  interior.name = 'ark-inner-skin';

  // What was ACTUALLY cut, measured back off the surface at the grid lines the
  // builder used — not what was asked for. If the profile inversion or the grid
  // welding ever drifts, these numbers move and the test group says so.
  const atMid = (v, side = DOOR.side) => hullPoint(0, v, side).y;
  const openings = {
    door: {
      x0: hullPoint(uDoor0 * 2 - 1, vDoorSill, DOOR.side).x,
      x1: hullPoint(uDoor1 * 2 - 1, vDoorSill, DOOR.side).x,
      y0: atMid(vDoorSill),
      y1: atMid(vDoorHead),
    },
    windowSillY: atMid(vWindow, 1),
    eavesY: atMid(1, 1),
  };

  return {
    exterior,
    interior,
    doorSpan,
    openings,
    windowV: vWindow,
    triangles: (exterior.geometry.index.count + interior.geometry.index.count) / 3,
  };
}
