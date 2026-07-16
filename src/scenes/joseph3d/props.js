import * as THREE from 'three';
import { mulberry32, canvasTexture } from '../../engine/world.js';

// The camp PROP KIT (world-density skill): small makers + a layout assembler.
// Everything repeated is instanced; every prop registers its colliders and
// particle emitters. Returns { group, colliders[], fireEmitters[], pen } so a
// future scene rebuilds a different camp from data only. Flat colors, unlit
// (MeshBasicMaterial + fog) — the Alto world look; characters carry the lights.
const C = {
  tent: 0xb08d62, tentDark: 0x8d6f4c, jacobTent: 0x9a6f4e,
  wood: 0x6b4a2c, woodDark: 0x54381f,
  stone: 0x8a807a, stoneDark: 0x6e655f,
  pot: 0x9c5f38, rug1: 0x8a4a42, rug2: 0x5d6e86, cloth: 0xe8dcc0,
  path: 0x5a4c72, grass: 0x6d7a52, fireGlow: 0xffc07a,
};

function inst(geo, color, spots, { yBase = 0, seedRot = 5 } = {}) {
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, fog: true }), spots.length);
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
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.8, 9, 1, true), new THREE.MeshBasicMaterial({ color: C.stone, fog: true, side: THREE.DoubleSide }));
  ring.position.set(x, 0.4, z);
  const posts = inst(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 5), C.wood, [[x - 0.7, z, 1, 0.8], [x + 0.7, z, 1, 0.8]]);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.55, 4), new THREE.MeshBasicMaterial({ color: C.tentDark, fog: true }));
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
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), new THREE.MeshBasicMaterial({ color: i % 2 ? C.cloth : C.rug2, fog: true, side: THREE.DoubleSide }));
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
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), new THREE.MeshBasicMaterial({ color: i % 2 ? C.rug1 : C.rug2, fog: true }));
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
    const p = new THREE.Mesh(new THREE.CircleGeometry(s.r ?? 2.2, 10), new THREE.MeshBasicMaterial({ color: C.path, fog: true }));
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
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, len), new THREE.MeshBasicMaterial({ color: C.woodDark, fog: true }));
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
  addAll(makePots([{ x: 5.5, z: -2.1 }, { x: 3.6, z: -0.2 }, { x: -10.2, z: -5.8 }, { x: -2.6, z: 8.9 }]));
  addAll(makeRugs([{ x: 1.6, z: -6.4, rot: 0.3 }, { x: -1.7, z: -5.2, rot: -0.5 }, { x: -9.6, z: 2.8, rot: 1.1 }]));
  addAll(makePaths([
    { x: 0, z: -2.5, r: 2.6, sx: 1.4 }, { x: -5, z: -5, r: 2.2, sx: 1.5, rot: 0.7 },
    { x: 5.5, z: 3, r: 2.0, sx: 1.6, rot: -0.9 }, { x: 10, z: 8, r: 2.2, sx: 1.4, rot: -0.4 },
  ]));
  const pen = { minX: 10, maxX: 17, minZ: 8.5, maxZ: 14, gate: { z0: 10.2, z1: 12.4 } };
  addAll(makePen(pen));
  addAll(makeGrass(90, 42, colliderWorld));

  return { group, fireEmitters, sway, pen, cameraBlockers };
}
