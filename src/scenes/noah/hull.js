import * as THREE from 'three';
import { ARK, HULL, DOOR, WINDOW, EAVES_Y, RIDGE_RISE, COLORS } from './arkSpec.js';

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
    bottomY: (bow ? HULL.bowRocker : HULL.sternRocker) * t * t,
    // Sheer: the sides rise toward the ends. This single curve is most of what
    // makes a hull look like a hull.
    topY: EAVES_Y + (bow ? HULL.bowRise : HULL.sternRise) * smooth(t) * t,
  };
}

// Where the window band starts, as a fraction of the side's height. Applied at
// every station, so the band follows the sheer up toward the bow — which is both
// what a real opening cut parallel to the sheer does, and the prettiest line on
// the whole vessel.
const WINDOW_V = (WINDOW.sillY - 0) / EAVES_Y;

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
function gridSurface({
  nu, nv, point, skip = null, flip = false, uvScale = [1 / 9, 1 / 3.6],
  color = null, shade = null,
}) {
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
      const u0 = i / nu; const u1 = (i + 1) / nu;
      const v0 = j / nv; const v1 = (j + 1) / nv;
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

function cellWorldBox(u0, u1, v0, v1, side) {
  const a = hullPoint(u0 * 2 - 1, v0, side);
  const b = hullPoint(u1 * 2 - 1, v1, side);
  return {
    x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x),
    y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y),
  };
}

// --- the built hull ----------------------------------------------------------

export function buildHull(wood) {
  const NU = 120;  // stations along the length
  const NV = 22;   // rows up the side

  // Sun-and-sea shading baked into the vertices: the underhull is dark, the
  // topsides catch light. This is what stops a single-material hull reading flat
  // across 137 m of one texture.
  const cLo = new THREE.Color(COLORS.pitchDark);
  const cMid = new THREE.Color(COLORS.pitch);
  const cHi = new THREE.Color(COLORS.pitchLight);
  const tmp = new THREE.Color();
  const outerShade = (p, v) => {
    if (v < 0.45) tmp.copy(cLo).lerp(cMid, v / 0.45);
    else tmp.copy(cMid).lerp(cHi, (v - 0.45) / 0.55);
    // A slow lengthwise variation so the run of the hull is never one tone.
    const n = 0.94 + 0.06 * Math.sin(p.x * 0.21) * Math.sin(p.x * 0.055 + 1.7);
    return tmp.multiplyScalar(n);
  };

  const cIn = new THREE.Color(COLORS.innerWall);
  const cInDark = new THREE.Color(COLORS.timberDark);
  const innerShade = (p, v) => {
    // Inside, light falls from the window band at the top: the further down the
    // side, the darker. This is the interior's whole sense of depth, since the
    // renderer casts no shadows.
    tmp.copy(cInDark).lerp(cIn, clamp01(0.18 + v * 1.05));
    return tmp;
  };

  const parts = [];
  const innerParts = [];

  for (const side of [1, -1]) {
    // The window band is the topmost slice of the side, simply left out. Only
    // the door is one-sided.
    const skip = (u0, u1, v0, v1) => {
      if (v0 >= WINDOW_V) return true; // the tsohar band, both sides
      if (side !== DOOR.side) return false;
      const b = cellWorldBox(u0, u1, v0, v1, side);
      return b.x1 > doorSpan.x0 && b.x0 < doorSpan.x1
        && b.y1 > doorSpan.y0 && b.y0 < doorSpan.y1;
    };

    parts.push(gridSurface({
      nu: NU, nv: NV, skip, shade: outerShade,
      point: (u, v) => hullPoint(u * 2 - 1, v, side),
      flip: side < 0,
    }));

    innerParts.push(gridSurface({
      nu: NU, nv: NV, skip, shade: innerShade,
      point: (u, v) => hullPoint(u * 2 - 1, v, side, HULL.skin),
      flip: side > 0, // normals point INWARD
      uvScale: [1 / 7, 1 / 3.2],
    }));
  }

  // THE BOTTOM: a flat sole between the two chines, following the rocker.
  parts.push(gridSurface({
    nu: NU, nv: 8, shade: (p) => tmp.copy(cLo).multiplyScalar(0.86 + 0.1 * Math.sin(p.x * 0.3)),
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
    nu: 40, nv: 4, color: COLORS.timberDark,
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
      nu: 60, nv: 3,
      shade: (p, v) => tmp.copy(cMid).lerp(cHi, 0.15 + v * 0.35).multiplyScalar(side > 0 ? 1.06 : 0.9),
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
      nu: 40, nv: 2,
      color: COLORS.timberDark,
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
      nu: 6, nv: NV,
      shade: outerShade,
      point: (a, v) => {
        const p0 = hullPoint(u, v, -1);
        const p1 = hullPoint(u, v, 1);
        return { x: p0.x, y: p0.y, z: p0.z + (p1.z - p0.z) * a };
      },
      skip: (u0, u1, v0) => v0 >= WINDOW_V,
      flip: end < 0,
      uvScale: [1 / 5, 1 / 3.6],
    }));
    // gable end above the eaves, closing the roof
    parts.push(gridSurface({
      nu: 6, nv: 2,
      shade: (p, v) => tmp.copy(cMid).lerp(cHi, v * 0.3),
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

  return {
    exterior,
    interior,
    doorSpan,
    windowV: WINDOW_V,
    triangles: (exterior.geometry.index.count + interior.geometry.index.count) / 3,
  };
}
