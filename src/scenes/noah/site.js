import * as THREE from 'three';
import { mulberry32, mergeGeometries, dyeGeometry, toonMat } from '../../engine/world.js';
import { ARK, KEEL_Y, EAVES_Y, HULL, DOOR, BOARDING, COLORS } from './arkSpec.js';
import { station } from './hull.js';

// THE BUILDING SITE — Genesis 6, before a drop of rain has fallen.
//
// This is the half of the scene that tells you what you are looking at. A
// 137 m hull standing alone in a field is a curiosity; the same hull ringed in
// scaffolding, with the timber stacked beside it and the pitch still on the
// boil, is a man building something enormous because he was told to.
//
// Everything repeated is instanced and everything static is merged, because the
// ark itself already owns a good share of the frame budget.

const rnd = mulberry32(20260730);

function instanced(geo, material, placements, name) {
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
  mesh.name = name;
  return mesh;
}

export function buildSite(wood) {
  const group = new THREE.Group();
  group.name = 'ark-site';
  const colliders = [];
  const geos = [];   // geometries this module owns and must dispose
  const fireEmitters = [];
  const decorations = [];

  const timberMat = wood.matTimber();
  const half = ARK.halfLength;

  // ── THE STOCKS ─────────────────────────────────────────────────────────────
  // The blocks the hull stands on. Massive, close-spaced under the keel, and the
  // reason the whole vessel is a storey off the ground.
  {
    const blocks = [];
    for (let x = -half + 3; x <= half - 3; x += 7.2) {
      const st = station(x / half);
      const h = st.bottomY; // the hull bottom rises at the ends; the blocks fill it
      blocks.push({ x, y: h / 2, z: 0, sy: h, sx: 1, sz: st.halfWidth * 1.25 });
      colliders.push({ type: 'aabb', group: 'stocks', minX: x - 0.9, maxX: x + 0.9, minZ: -st.halfWidth * 0.7, maxZ: st.halfWidth * 0.7, minY: 0, maxY: h });
    }
    const g = new THREE.BoxGeometry(1.6, 1, 1.2);
    geos.push(g);
    group.add(instanced(g, timberMat, blocks, 'ark-stocks'));

    // Shores: the raking props that steady a hull on the stocks, leaning in
    // against the bilge from both sides. Unmistakably a ship being built.
    const shores = [];
    for (let x = -half + 9; x <= half - 9; x += 9.5) {
      const st = station(x / half);
      for (const side of [-1, 1]) {
        const foot = st.halfWidth + 5.4;
        const headY = st.bottomY + 2.2;
        const len = Math.hypot(foot - st.halfWidth * 0.8, headY);
        shores.push({
          x, y: headY / 2, z: side * (foot + st.halfWidth * 0.8) / 2,
          rx: side * Math.atan2(foot - st.halfWidth * 0.8, headY),
          sy: len,
        });
      }
    }
    const sg = new THREE.CylinderGeometry(0.20, 0.26, 1, 6);
    geos.push(sg);
    group.add(instanced(sg, timberMat, shores, 'ark-shores'));
  }

  // ── THE SCAFFOLDING ────────────────────────────────────────────────────────
  // The single most important thing in the scene after the hull. It gives the
  // eye a ladder of horizontals to climb, which is how a viewer reads height,
  // and it is what says BEING BUILT rather than finished and parked.
  {
    const uprights = [];
    const ledgers = [];
    const braces = [];
    const planks = [];
    const LIFT = 2.9;            // the height of one scaffold lift
    const LIFTS = Math.ceil((EAVES_Y - 1) / LIFT);
    const BAY = 5.6;             // spacing along the hull

    for (let x = -half + 4; x <= half - 4; x += BAY) {
      const st = station(x / half);
      for (const side of [-1, 1]) {
        // The scaffold stands off the hull by a working gap.
        const zIn = side * (st.halfWidth + 1.15);
        const zOut = side * (st.halfWidth + 3.05);
        const top = Math.min(EAVES_Y + 1.2, st.topY + 1.2);
        for (const z of [zIn, zOut]) {
          uprights.push({ x, y: top / 2, z, sy: top });
        }
        for (let l = 1; l <= LIFTS; l++) {
          const y = l * LIFT;
          if (y > top - 0.5) continue;
          // transoms across the two standards
          ledgers.push({ x, y, z: (zIn + zOut) / 2, ry: Math.PI / 2, sx: Math.abs(zOut - zIn) });
          // ledgers running along the hull to the next bay
          ledgers.push({ x: x + BAY / 2, y, z: zIn, sx: BAY });
          ledgers.push({ x: x + BAY / 2, y, z: zOut, sx: BAY });
          // a working platform every other lift
          if (l % 2 === 0) {
            planks.push({ x: x + BAY / 2, y: y + 0.09, z: (zIn + zOut) / 2, sx: BAY, sz: Math.abs(zOut - zIn) });
          }
        }
        // diagonal bracing on the outer face — the thing that makes a lattice
        // read as structure instead of a grid
        for (let l = 0; l < LIFTS - 1; l += 2) {
          const y0 = l * LIFT;
          const y1 = Math.min((l + 2) * LIFT, top - 0.4);
          if (y1 <= y0 + 0.5) continue;
          const dy = y1 - y0;
          braces.push({
            x: x + BAY / 2, y: (y0 + y1) / 2, z: zOut,
            rz: Math.atan2(BAY, dy), sy: Math.hypot(BAY, dy),
          });
        }
        colliders.push({ type: 'aabb', group: 'scaffold', minX: x - 0.3, maxX: x + 0.3, minZ: Math.min(zIn, zOut) - 0.3, maxZ: Math.max(zIn, zOut) + 0.3, minY: 0, maxY: top });
      }
    }

    const ug = new THREE.CylinderGeometry(0.13, 0.15, 1, 5);
    const lg = new THREE.BoxGeometry(1, 0.16, 0.16);
    const bg = new THREE.BoxGeometry(0.12, 1, 0.12);
    const pg = new THREE.BoxGeometry(1, 0.08, 1);
    geos.push(ug, lg, bg, pg);
    group.add(instanced(ug, timberMat, uprights, 'scaffold-standards'));
    group.add(instanced(lg, timberMat, ledgers, 'scaffold-ledgers'));
    group.add(instanced(bg, timberMat, braces, 'scaffold-braces'));
    group.add(instanced(pg, wood.matDeck(), planks, 'scaffold-platforms'));
  }

  // ── THE BOARDING RAMP'S TRESTLES ───────────────────────────────────────────
  {
    const legs = [];
    // Legs stand under the ramp DECK, so their height is the ramp's own height
    // at that z — derived from BOARDING, never guessed.
    for (let z = BOARDING.zInner + 1.6; z < BOARDING.zOuter - 0.8; z += 2.6) {
      const t = (z - BOARDING.zInner) / (BOARDING.zOuter - BOARDING.zInner);
      const h = Math.max(0.25, DOOR.sillY * (1 - t));
      for (const dx of [-1.9, 1.9]) {
        legs.push({ x: BOARDING.x + dx, y: h / 2, z, sy: h });
      }
    }
    const g = new THREE.BoxGeometry(0.20, 1, 0.20);
    geos.push(g);
    group.add(instanced(g, timberMat, legs, 'ramp-trestles'));
  }

  // ── TIMBER STACKS ──────────────────────────────────────────────────────────
  // Genesis 6:14 — "Make a ship of gopher wood." Somebody had to fell it, and
  // the felled wood has to be somewhere.
  {
    const logs = [];
    const stacks = [
      { x: -52, z: 34, n: 4, len: 9 },
      { x: -38, z: 38, n: 5, len: 11 },
      { x: 30, z: 36, n: 4, len: 10 },
      { x: 48, z: 32, n: 3, len: 8 },
      { x: -14, z: 41, n: 4, len: 12 },
    ];
    stacks.forEach((s, si) => {
      // stacked in courses, each course offset — how timber is actually piled
      let y = 0.42;
      for (let course = 0; course < 3 + (si % 2); course++) {
        const count = s.n - course;
        if (count <= 0) break;
        for (let i = 0; i < count; i++) {
          logs.push({
            x: s.x + (i - (count - 1) / 2) * 0.92 + (course % 2 ? 0.46 : 0),
            y, z: s.z + (rnd() - 0.5) * 0.2,
            rz: Math.PI / 2, ry: (rnd() - 0.5) * 0.05,
            sy: s.len, sx: 0.9 + rnd() * 0.25, sz: 0.9 + rnd() * 0.25,
          });
        }
        y += 0.82;
      }
      colliders.push({ type: 'aabb', group: 'timber', minX: s.x - s.len / 2 - 0.4, maxX: s.x + s.len / 2 + 0.4, minZ: s.z - 2.4, maxZ: s.z + 2.4 });
      decorations.push({ x: s.x, z: s.z, r: s.len / 2, label: `timber-${si}` });
    });
    const g = new THREE.CylinderGeometry(0.42, 0.40, 1, 7);
    geos.push(g);
    // Rotate the cylinder so scaling y runs along the log's length.
    group.add(instanced(g, timberMat, logs, 'timber-stacks'));
  }

  // ── THE SAWPIT ─────────────────────────────────────────────────────────────
  // Where a log becomes planks: a trench with a log on trestles over it, one man
  // above and one below on the long saw.
  {
    const pit = { x: -26, z: 30 };
    const g = [];
    const trench = new THREE.BoxGeometry(7.4, 1.3, 2.2);
    trench.translate(pit.x, -0.62, pit.z);
    g.push(dyeGeometry(trench, 0x2b2118));
    // the log being ripped, up on its trestles
    const log = new THREE.CylinderGeometry(0.52, 0.5, 8.4, 8);
    log.rotateZ(Math.PI / 2);
    log.translate(pit.x, 1.05, pit.z);
    g.push(dyeGeometry(log, COLORS.timber));
    for (const dx of [-3.1, 3.1]) {
      const t = new THREE.BoxGeometry(0.4, 1.0, 2.0);
      t.translate(pit.x + dx, 0.5, pit.z);
      g.push(dyeGeometry(t, COLORS.timberDark));
    }
    // the saw itself, standing in the cut
    const blade = new THREE.BoxGeometry(0.06, 2.5, 0.34);
    blade.translate(pit.x + 0.6, 1.4, pit.z);
    g.push(dyeGeometry(blade, COLORS.ironDark));
    const m = new THREE.Mesh(mergeGeometries(g), timberMat);
    m.geometry.computeVertexNormals();
    m.name = 'sawpit';
    geos.push(m.geometry);
    group.add(m);
    colliders.push({ type: 'aabb', group: 'sawpit', minX: pit.x - 4.2, maxX: pit.x + 4.2, minZ: pit.z - 1.5, maxZ: pit.z + 1.5 });
    decorations.push({ x: pit.x, z: pit.z, r: 4.2, label: 'sawpit' });

    // sawn planks, stacked beside it, and the sawdust
    const planks = [];
    for (let i = 0; i < 14; i++) {
      planks.push({
        x: pit.x + 7.5 + (i % 3) * 0.1, y: 0.09 + Math.floor(i / 3) * 0.14,
        z: pit.z + (i % 3) * 0.75 - 0.75, ry: (rnd() - 0.5) * 0.06,
        sx: 6.5 + rnd(), sz: 0.62,
      });
    }
    const pg = new THREE.BoxGeometry(1, 0.12, 1);
    geos.push(pg);
    group.add(instanced(pg, wood.matDeck(), planks, 'sawn-planks'));
  }

  // ── THE PITCH ──────────────────────────────────────────────────────────────
  // Genesis 6:14 — "shall seal it inside and outside with pitch". Cauldrons over
  // fires, which also give the site its only warm light and its smoke.
  {
    const g = [];
    const pots = [{ x: 12, z: 30 }, { x: 20, z: 33.5 }];
    pots.forEach((p) => {
      const bowl = new THREE.CylinderGeometry(1.15, 0.85, 1.0, 12, 1, true);
      bowl.translate(p.x, 0.85, p.z);
      g.push(dyeGeometry(bowl, COLORS.ironDark));
      // the pitch itself, a black disc just below the rim
      const surface = new THREE.CircleGeometry(1.05, 12);
      surface.rotateX(-Math.PI / 2);
      surface.translate(p.x, 1.24, p.z);
      g.push(dyeGeometry(surface, 0x15100c));
      // stones of the fire ring
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const s = new THREE.DodecahedronGeometry(0.26, 0);
        s.translate(p.x + Math.cos(a) * 1.5, 0.2, p.z + Math.sin(a) * 1.5);
        g.push(dyeGeometry(s, 0x6b625a));
      }
      colliders.push({ type: 'circle', x: p.x, z: p.z, r: 1.5, group: 'pitch' });
      fireEmitters.push({ x: p.x, y: 0.55, z: p.z });
      decorations.push({ x: p.x, z: p.z, r: 1.5, label: 'pitch-pot' });
    });
    // barrels of pitch waiting to go up
    for (let i = 0; i < 7; i++) {
      const bx = 26 + (i % 4) * 1.5;
      const bz = 29 + Math.floor(i / 4) * 1.6;
      const b = new THREE.CylinderGeometry(0.48, 0.44, 1.15, 9);
      b.translate(bx, 0.58, bz);
      g.push(dyeGeometry(b, COLORS.timberDark));
      colliders.push({ type: 'circle', x: bx, z: bz, r: 0.55, group: 'barrel' });
    }
    const m = new THREE.Mesh(mergeGeometries(g), timberMat);
    m.geometry.computeVertexNormals();
    m.name = 'pitch-works';
    geos.push(m.geometry);
    group.add(m);
  }

  // ── SMALL LIFE ─────────────────────────────────────────────────────────────
  // Baskets, rope coils, a trestle bench, mallets. One merged draw. Without
  // these the site reads as a diagram of a shipyard rather than a place people
  // are working in.
  {
    const g = [];
    const clutter = [
      [-8, 32], [-4.5, 34], [2, 31.5], [6.5, 35], [-18, 33],
      [-32, 28], [36, 30], [-46, 29], [16, 27], [-12, 27.5],
    ];
    clutter.forEach(([x, z], i) => {
      if (i % 3 === 0) {
        const basket = new THREE.CylinderGeometry(0.46, 0.34, 0.62, 8, 1, true);
        basket.translate(x, 0.31, z);
        g.push(dyeGeometry(basket, COLORS.strawGold));
      } else if (i % 3 === 1) {
        // a coil of rope
        for (let r = 0; r < 3; r++) {
          const t = new THREE.TorusGeometry(0.42 - r * 0.09, 0.075, 5, 12);
          t.rotateX(Math.PI / 2);
          t.translate(x, 0.09 + r * 0.13, z);
          g.push(dyeGeometry(t, COLORS.rope));
        }
      } else {
        // a trestle bench with a mallet on it
        const top = new THREE.BoxGeometry(2.0, 0.14, 0.6);
        top.translate(x, 0.78, z);
        g.push(dyeGeometry(top, COLORS.timber));
        for (const dx of [-0.8, 0.8]) {
          const leg = new THREE.BoxGeometry(0.14, 0.78, 0.5);
          leg.translate(x + dx, 0.39, z);
          g.push(dyeGeometry(leg, COLORS.timberDark));
        }
        const head = new THREE.BoxGeometry(0.34, 0.2, 0.2);
        head.translate(x + 0.4, 0.95, z);
        g.push(dyeGeometry(head, COLORS.timberDark));
      }
      colliders.push({ type: 'circle', x, z, r: 0.55, group: 'clutter' });
    });
    const m = new THREE.Mesh(mergeGeometries(g), timberMat);
    m.geometry.computeVertexNormals();
    m.name = 'site-clutter';
    geos.push(m.geometry);
    group.add(m);
  }

  // ── WOOD CHIPS ─────────────────────────────────────────────────────────────
  // Scattered pale flecks on the ground around the working areas. Cheap, and it
  // is the detail that makes the ground look worked rather than mown.
  {
    const chips = [];
    for (let i = 0; i < 220; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = 6 + rnd() * 34;
      const x = -20 + Math.cos(a) * rr * 1.6;
      const z = 30 + Math.sin(a) * rr * 0.5;
      if (Math.abs(z) < ARK.halfWidth + 2) continue;
      chips.push({ x, y: 0.03, z, ry: rnd() * Math.PI, sx: 0.2 + rnd() * 0.25, sz: 0.1 + rnd() * 0.12 });
    }
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    geos.push(g);
    const mesh = instanced(g, toonMat(0xb9905c), chips, 'wood-chips');
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  return {
    group,
    colliders,
    fireEmitters,
    decorations,
    dispose() {
      geos.forEach((g) => g.dispose?.());
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      timberMat.dispose?.();
    },
  };
}
