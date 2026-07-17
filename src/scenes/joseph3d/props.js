import * as THREE from 'three';
import { mulberry32, canvasTexture, toonMat } from '../../engine/world.js';

// The camp PROP KIT (world-density skill): small makers + a layout assembler.
// Everything repeated is instanced; every prop registers its colliders and
// particle emitters. Returns { group, colliders[], fireEmitters[], pen } so a
// future scene rebuilds a different camp from data only. D4: props are now
// toon-LIT (toonMat) so the sun shapes them; glows/sprites stay additive.
const C = {
  tent: 0xb08d62, tentDark: 0x8d6f4c, jacobTent: 0x9a6f4e,
  wood: 0x6b4a2c, woodDark: 0x54381f,
  stone: 0x8a807a, stoneDark: 0x6e655f,
  pot: 0xa8622f, rug1: 0x96473e, rug2: 0x4f6b8a, cloth: 0xe8dcc0,
  path: 0x7d5f41, grass: 0x7a8d4a, fireGlow: 0xffc07a,
  foliage: 0x5c6b3c, foliageDark: 0x49572f, boulder: 0x84796f,
};

function inst(geo, color, spots, { yBase = 0, seedRot = 5 } = {}) {
  const mesh = new THREE.InstancedMesh(geo, toonMat(color), spots.length);
  const d = new THREE.Object3D();
  const rnd = mulberry32(seedRot);
  spots.forEach((s, i) => {
    d.position.set(s[0], yBase + (s[3] ?? 0), s[1]);
    const sc = s[2] ?? 1;
    d.scale.setScalar(sc);
    d.rotation.y = s[4] ?? rnd() * Math.PI * 2;
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

// --- individual makers (each returns { mesh(es), colliders, emitters }) -----

export function makeTents(spots) {
  const geo = new THREE.ConeGeometry(1.7, 2.2, 6);
  const mesh = inst(geo, C.tent, spots.map((s) => [s.x, s.z, s.scale ?? 1, 1.1, s.rot]));
  const colliders = spots.map((s) => ({ type: 'circle', x: s.x, z: s.z, r: 1.55 * (s.scale ?? 1), group: 'tents' }));
  // Tents are BIG — they join the camera-blocker list (level-layout law 4).
  return { mesh, colliders, blockers: [mesh] };
}

export function makeFires(spots) {
  const group = new THREE.Group();
  // stones ring + crossed logs, instanced across all fires
  const stoneGeo = new THREE.DodecahedronGeometry(0.16, 0);
  const stones = [];
  const logs = [];
  spots.forEach((s) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      stones.push([s.x + Math.cos(a) * 0.55, s.z + Math.sin(a) * 0.55, 0.8 + (i % 3) * 0.2, 0.08]);
    }
    logs.push([s.x, s.z, 1, 0.12, 0.5], [s.x, s.z, 1, 0.12, 2.1]);
  });
  group.add(inst(stoneGeo, C.stoneDark, stones, { seedRot: 31 }));
  const logGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.9, 5);
  logGeo.rotateZ(Math.PI / 2);
  group.add(inst(logGeo, C.woodDark, logs, { seedRot: 32 }));
  // warm glow sprite per fire (additive, fog-exempt)
  const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,190,120,0.9)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  spots.forEach((s) => {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.fireGlow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    spr.position.set(s.x, 0.45, s.z);
    spr.scale.setScalar(1.6);
    group.add(spr);
  });
  return {
    mesh: group,
    colliders: spots.map((s) => ({ type: 'circle', x: s.x, z: s.z, r: 0.85 })),
    emitters: spots.map((s) => ({ x: s.x, y: 0.35, z: s.z })),
  };
}

export function makeWell(x, z) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.8, 9, 1, true), toonMat(C.stone, { side: THREE.DoubleSide }));
  ring.position.set(x, 0.4, z);
  const posts = inst(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 5), C.wood, [[x - 0.7, z, 1, 0.8], [x + 0.7, z, 1, 0.8]]);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.55, 4), toonMat(C.tentDark));
  roof.position.set(x, 1.75, z);
  roof.rotation.y = Math.PI / 4;
  group.add(ring, posts, roof);
  return { mesh: group, colliders: [{ type: 'circle', x, z, r: 1.15, group: 'well' }], blockers: [ring, roof] };
}

export function makeLaundry(x1, z1, x2, z2) {
  const group = new THREE.Group();
  const posts = inst(new THREE.CylinderGeometry(0.045, 0.055, 1.7, 5), C.wood, [[x1, z1, 1, 0.85], [x2, z2, 1, 0.85]]);
  group.add(posts);
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, 1.62, z1), new THREE.Vector3(x2, 1.55, z2)]);
  group.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: C.woodDark, fog: true })));
  // hanging cloths — small planes along the line
  const n = 3;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), toonMat(i % 2 ? C.cloth : C.rug2, { side: THREE.DoubleSide }));
    cloth.position.set(cx, 1.22, cz);
    cloth.rotation.y = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
    cloth.userData.sway = { baseX: cloth.rotation.x, phase: i * 1.7 };
    group.add(cloth);
  }
  return {
    mesh: group,
    colliders: [{ type: 'circle', x: x1, z: z1, r: 0.25 }, { type: 'circle', x: x2, z: z2, r: 0.25 }],
    sway: group.children.filter((c) => c.userData.sway),
  };
}

export function makeCrates(spots) {
  const mesh = inst(new THREE.BoxGeometry(0.62, 0.62, 0.62), C.wood, spots.map((s) => [s.x, s.z, s.scale ?? 1, 0.31 * (s.scale ?? 1)]), { seedRot: 41 });
  const colliders = spots.map((s) => ({
    type: 'aabb',
    minX: s.x - 0.45 * (s.scale ?? 1), maxX: s.x + 0.45 * (s.scale ?? 1),
    minZ: s.z - 0.45 * (s.scale ?? 1), maxZ: s.z + 0.45 * (s.scale ?? 1),
    group: 'crates', // a stacked pile — same-group touching is intentional
  }));
  return { mesh, colliders };
}

export function makePots(spots) {
  const geo = new THREE.SphereGeometry(0.24, 8, 6);
  geo.scale(1, 1.15, 1);
  const mesh = inst(geo, C.pot, spots.map((s) => [s.x, s.z, s.scale ?? 1, 0.26]), { seedRot: 42 });
  return { mesh, colliders: [] };
}

export function makeRugs(spots) {
  const group = new THREE.Group();
  spots.forEach((s, i) => {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), toonMat(i % 2 ? C.rug1 : C.rug2));
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = s.rot ?? 0;
    rug.position.set(s.x, 0.03, s.z);
    group.add(rug);
  });
  return { mesh: group, colliders: [] };
}

export function makePaths(spots) {
  const group = new THREE.Group();
  spots.forEach((s) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(s.r ?? 2.2, 10), toonMat(C.path));
    p.rotation.x = -Math.PI / 2;
    p.position.set(s.x, 0.015, s.z);
    p.scale.set(s.sx ?? 1, s.sz ?? 1, 1);
    p.rotation.z = s.rot ?? 0;
    group.add(p);
  });
  return { mesh: group, colliders: [] };
}

export function makeGrass(count = 90, span = 42, colliderWorld = null) {
  const blade = new THREE.ConeGeometry(0.05, 0.42, 3);
  blade.translate(0, 0.21, 0);
  const rnd = mulberry32(77);
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard++ < count * 8) {
    const x = (rnd() - 0.5) * span;
    const z = (rnd() - 0.5) * span;
    if (colliderWorld && colliderWorld.overlaps(x, z, 0.3)) continue;
    spots.push([x, z, 0.7 + rnd() * 1.1]);
  }
  return { mesh: inst(blade, C.grass, spots, { seedRot: 43 }), colliders: [] };
}

// NATURAL BORDERS (level-layout law 5): the play space is enclosed by things
// the player can SEE — olive/tamarisk tree lines and boulder clusters — with
// colliders ON those props. The hard world bounds beyond are a silent failsafe.
// The north horizon stays open low (the ridge vista) — boulders there are
// knee-high and gappy on purpose; the fog and distance do the rest.
export function makeTreeline(runs, colliderWorld = null) {
  // one merged tree (trunk + two canopy cones) instanced along border runs
  const trunk = new THREE.CylinderGeometry(0.09, 0.13, 1.1, 5);
  trunk.translate(0, 0.55, 0);
  const lower = new THREE.ConeGeometry(0.85, 1.5, 6);
  lower.translate(0, 1.55, 0);
  const upper = new THREE.ConeGeometry(0.55, 1.1, 6);
  upper.translate(0, 2.45, 0);
  const rnd = mulberry32(2027);
  const spots = [];
  const colliders = [];
  for (const r of runs) {
    const len = Math.hypot(r.x1 - r.x0, r.z1 - r.z0);
    const n = Math.max(2, Math.round(len / (r.gap ?? 2.4)));
    // unit normal of the run (for the staggered second row)
    const nx = -(r.z1 - r.z0) / len, nz = (r.x1 - r.x0) / len;
    for (let row = 0; row < 2; row++) {
      // two STAGGERED rows — the player can never slip between trunks to the
      // invisible failsafe wall (level-layout law 5)
      const off = row * 0.5 / n; // half-phase
      const push = row * 1.15;   // second row sits behind the first
      for (let i = 0; i <= n; i++) {
        const t = Math.min(1, i / n + off);
        const jx = (rnd() - 0.5) * 0.9;
        const jz = (rnd() - 0.5) * 0.9;
        const x = r.x0 + (r.x1 - r.x0) * t + jx + nx * push;
        const z = r.z0 + (r.z1 - r.z0) * t + jz + nz * push;
        // never plant a border tree into a camp prop (pen fence, tents…)
        if (colliderWorld && colliderWorld.overlaps(x, z, 0.85)) continue;
        spots.push([x, z, 0.8 + rnd() * 0.7]);
        colliders.push({ type: 'circle', x, z, r: 0.75, group: 'border' });
      }
    }
  }
  const group = new THREE.Group();
  group.add(inst(trunk, C.wood, spots, { seedRot: 51 }));
  const canopyLo = inst(lower, C.foliage, spots, { seedRot: 51 });
  const canopyHi = inst(upper, C.foliageDark, spots, { seedRot: 51 });
  group.add(canopyLo, canopyHi);
  return { mesh: group, colliders, blockers: [canopyLo] };
}

export function makeBoulders(spots) {
  const geo = new THREE.DodecahedronGeometry(0.62, 0);
  geo.translate(0, 0.28, 0);
  const mesh = inst(geo, C.boulder, spots.map((s) => [s.x, s.z, s.scale ?? 1, 0]), { seedRot: 52 });
  const colliders = spots.map((s) => ({ type: 'circle', x: s.x, z: s.z, r: 0.62 * (s.scale ?? 1), group: 'border' }));
  return { mesh, colliders };
}

// JACOB'S TENT INTERIOR — a lamplit stage far off-camp (the report/coat beats
// play inside). Warm wool, rugs, a low lamp; fog near ~11 closes the air in.
export function makeTentInterior(x, z) {
  const group = new THREE.Group();
  // the tent shell seen from inside
  const shell = new THREE.Mesh(
    new THREE.ConeGeometry(4.3, 4.4, 8, 1, true),
    toonMat(0x9a7550, { side: THREE.BackSide }),
  );
  shell.position.set(x, 2.2, z);
  group.add(shell);
  // floor rug layers
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.4, 18), toonMat(0x7c4038));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, 0.015, z);
  const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), toonMat(0x4f6b8a));
  rug2.rotation.x = -Math.PI / 2;
  rug2.rotation.z = 0.5;
  rug2.position.set(x + 0.4, 0.03, z + 0.4);
  group.add(rug, rug2);
  // the lamp: a small pot with a warm glow (no real lights — art-style rule)
  const lampPot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), toonMat(0x54381f));
  lampPot.position.set(x - 1.1, 0.45, z - 0.7);
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 5), toonMat(0x54381f));
  lampPost.position.set(x - 1.1, 0.2, z - 0.7);
  const glowTex = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,205,140,0.95)');
    g.addColorStop(1, 'rgba(255,205,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc98a, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  lampGlow.position.set(x - 1.1, 0.62, z - 0.7);
  lampGlow.scale.setScalar(2.2);
  group.add(lampPot, lampPost, lampGlow);
  // cushions + a cedar chest
  [[x + 1.1, z - 0.9, 0xa8622f], [x + 1.5, z - 0.2, 0x96473e], [x - 0.6, z + 1.3, 0x4f6b8a]].forEach(([cx, cz, col]) => {
    const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), toonMat(col));
    cushion.scale.set(1, 0.45, 1);
    cushion.position.set(cx, 0.15, cz);
    group.add(cushion);
  });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.55), toonMat(C.wood));
  chest.position.set(x - 0.2, 0.25, z - 1.6);
  chest.rotation.y = 0.3;
  group.add(chest);
  return {
    mesh: group, lampGlow,
    dispose() {
      glowTex.dispose();
      group.traverse((o) => { if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
      group.parent?.remove(group);
    },
  };
}

// Sheep pen: fence posts + rails around a rect with a west gate opening.
export function makePen(rect) {
  const { minX, maxX, minZ, maxZ, gate } = rect; // gate: {z0,z1} opening on minX side
  const posts = [];
  const railSegs = [];
  const step = 1.4;
  const addRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) posts.push([x0 + (x1 - x0) * (i / n), z0 + (z1 - z0) * (i / n), 1, 0.5]);
    railSegs.push([(x0 + x1) / 2, (z0 + z1) / 2, len, Math.atan2(x1 - x0, z1 - z0)]);
  };
  addRun(minX, minZ, maxX, minZ);
  addRun(maxX, minZ, maxX, maxZ);
  addRun(minX, maxZ, maxX, maxZ);
  addRun(minX, minZ, minX, gate.z0);
  addRun(minX, gate.z1, minX, maxZ);

  const group = new THREE.Group();
  group.add(inst(new THREE.CylinderGeometry(0.06, 0.07, 1.0, 5), C.wood, posts, { seedRot: 44 }));
  railSegs.forEach(([cx, cz, len, ang]) => {
    [0.45, 0.8].forEach((h) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, len), toonMat(C.woodDark));
      rail.position.set(cx, h, cz);
      rail.rotation.y = ang;
      group.add(rail);
    });
  });
  const t = 0.12;
  const colliders = [
    { type: 'aabb', minX, maxX, minZ: minZ - t, maxZ: minZ + t, group: 'pen' },
    { type: 'aabb', minX, maxX, minZ: maxZ - t, maxZ: maxZ + t, group: 'pen' },
    { type: 'aabb', minX: maxX - t, maxX: maxX + t, minZ, maxZ, group: 'pen' },
    { type: 'aabb', minX: minX - t, maxX: minX + t, minZ, maxZ: gate.z0, group: 'pen' },
    { type: 'aabb', minX: minX - t, maxX: minX + t, minZ: gate.z1, maxZ, group: 'pen' },
  ];
  return { mesh: group, colliders };
}

// --- the Scene 1 camp layout (data) -----------------------------------------

export function buildCamp(colliderWorld) {
  const group = new THREE.Group();
  const fireEmitters = [];
  const sway = [];
  const cameraBlockers = []; // ONLY big props block the camera (level-layout law 4)
  const addAll = (made) => {
    group.add(made.mesh);
    made.colliders?.forEach((c) => colliderWorld.add(c));
    made.emitters?.forEach((e) => fireEmitters.push(e));
    made.sway?.forEach((s) => sway.push(s));
    made.blockers?.forEach((b) => cameraBlockers.push(b));
  };

  addAll(makeTents([
    { x: -11, z: -7, scale: 1.35, rot: 0.4 }, // Jacob's tent (largest)
    { x: 9, z: -10, scale: 1.0 }, { x: -14, z: 3, scale: 1.0 },
    { x: 13, z: 5.5, scale: 0.95 }, { x: -6, z: -13, scale: 0.95 },
    { x: 5, z: -14, scale: 0.9 }, { x: 16, z: -3, scale: 1.0 },
  ]));
  addAll(makeFires([{ x: 0, z: -6 }, { x: -8.5, z: 4 }]));
  addAll(makeWell(4.5, -1));
  addAll(makeLaundry(-3, 8.5, 2, 9.5));
  addAll(makeCrates([{ x: 7.6, z: -6.2 }, { x: 8.4, z: -5.6, scale: 0.85 }, { x: 7.9, z: -5.3, scale: 0.7 }, { x: -12.6, z: -4.9, scale: 0.9 }]));
  addAll(makePots([
    { x: 5.5, z: -2.1 }, { x: 3.6, z: -0.2 }, { x: -10.2, z: -5.8 }, { x: -2.6, z: 8.9 },
    // lived-in fill along the paths (world-density: clustered, never sprinkled)
    { x: 2.8, z: 2.2 }, { x: 9.4, z: 6.6, scale: 0.85 }, { x: -5.8, z: -3.4, scale: 0.9 },
  ]));
  addAll(makeRugs([
    { x: 1.6, z: -6.4, rot: 0.3 }, { x: -1.7, z: -5.2, rot: -0.5 }, { x: -9.6, z: 2.8, rot: 1.1 },
    { x: 6.2, z: 4.1, rot: -0.7 },
  ]));
  addAll(makePaths([
    { x: 0, z: -2.5, r: 2.6, sx: 1.4 }, { x: -5, z: -5, r: 2.2, sx: 1.5, rot: 0.7 },
    { x: 5.5, z: 3, r: 2.0, sx: 1.6, rot: -0.9 }, { x: 10, z: 8, r: 2.2, sx: 1.4, rot: -0.4 },
  ]));
  addAll(makeCrates([{ x: 10.5, z: 7.3, scale: 0.8 }])); // clear of the tent (audit-verified)
  // gate widened (D3: lambs must be EASY to pen)
  const pen = { minX: 10, maxX: 17, minZ: 8.5, maxZ: 14, gate: { z0: 9.9, z1: 12.9 } };
  addAll(makePen(pen));

  // natural borders: tree lines east/west/south; low gappy boulders north so
  // the ridge vista stays open. Colliders live ON the visible props.
  // run directions chosen so each staggered second row lands INSIDE the play
  // area (the normal points inward)
  addAll(makeTreeline([
    { x0: 18.7, z0: -14, x1: 18.7, z1: 16.5 },       // east  (2nd row at ~x17.5)
    { x0: -18.7, z0: 16.5, x1: -18.7, z1: -14 },     // west  (2nd row at ~x-17.5)
    { x0: 17.5, z0: 16.8, x1: -17.5, z1: 16.8, gap: 2.1 }, // south (2nd row at ~z15.7)
  ], colliderWorld));
  addAll(makeBoulders([
    { x: -17.5, z: -15.8, scale: 1.3 }, { x: -14.8, z: -16.2, scale: 0.9 }, { x: -12.4, z: -15.6, scale: 1.1 },
    { x: -8.8, z: -16.3, scale: 0.8 }, { x: -3.2, z: -16 }, { x: 1.4, z: -16.4, scale: 0.85 },
    { x: 7.2, z: -16.1, scale: 1.15 }, { x: 11.8, z: -15.7, scale: 0.9 }, { x: 15.6, z: -16.2, scale: 1.25 },
    { x: 17.8, z: -13.4, scale: 0.95 },
  ]));
  addAll(makeGrass(110, 42, colliderWorld));

  return { group, fireEmitters, sway, pen, cameraBlockers };
}
