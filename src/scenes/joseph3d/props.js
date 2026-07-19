import * as THREE from 'three';
import { mulberry32, canvasTexture, toonMat, mergeGeometries, dyeGeometry } from '../../engine/world.js';

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

function inst(geo, color, spots, { yBase = 0, seedRot = 5, map = null, tints = null } = {}) {
  const mesh = new THREE.InstancedMesh(geo, toonMat(tints ? 0xffffff : color, map ? { map } : {}), spots.length);
  const d = new THREE.Object3D();
  const rnd = mulberry32(seedRot);
  const tc = tints ? tints.map((c) => new THREE.Color(c)) : null;
  spots.forEach((s, i) => {
    d.position.set(s[0], yBase + (s[3] ?? 0), s[1]);
    const sc = s[2] ?? 1;
    d.scale.setScalar(sc);
    d.rotation.y = s[4] ?? rnd() * Math.PI * 2;
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
    if (tc) mesh.setColorAt(i, tc[(rnd() * tc.length) | 0]); // per-tree species tint
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// --- individual makers (each returns { mesh(es), colliders, emitters }) -----

export function makeTents(spots) {
  const geo = new THREE.ConeGeometry(1.7, 2.2, 6);
  const mesh = inst(geo, C.tent, spots.map((s) => [s.x, s.z, s.scale ?? 1, 1.1, s.rot]));
  const colliders = spots.map((s) => ({ type: 'circle', x: s.x, z: s.z, r: 1.55 * (s.scale ?? 1), group: 'tents' }));
  // NB: tents are ONE InstancedMesh, so they can't be a camera occluder — the
  // fade mutates the shared material and would ghost ALL tents at once. The
  // raised authored camera behind the hero makes tent occlusion rare anyway.
  return { mesh, colliders };
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

// D6: the well is a real LANDMARK now — noticeably bigger ring, taller posts,
// a wide shade roof. Still the 'well' collider group (occluder-fade list).
export function makeWell(x, z, rockTex = null) {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.45, 1.0, 10, 1, true),
    toonMat(rockTex ? 0xb0a89e : C.stone, { side: THREE.DoubleSide, ...(rockTex ? { map: rockTex } : {}) }),
  );
  ring.position.set(x, 0.5, z);
  const posts = inst(new THREE.CylinderGeometry(0.07, 0.085, 2.3, 5), C.wood, [[x - 1.05, z, 1, 1.15], [x + 1.05, z, 1, 1.15]]);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.8, 4), toonMat(C.tentDark));
  roof.position.set(x, 2.55, z);
  roof.rotation.y = Math.PI / 4;
  // the crossbar + rope + bucket that make it read WELL at a glance —
  // merged into ONE dyed mesh (1 draw, not 3; the budget lives at the ceiling)
  const bar = new THREE.CylinderGeometry(0.05, 0.05, 2.3, 5);
  bar.rotateZ(Math.PI / 2); bar.translate(x, 2.05, z);
  dyeGeometry(bar, C.woodDark);
  const bucket = new THREE.CylinderGeometry(0.16, 0.13, 0.24, 7, 1, true);
  bucket.translate(x, 1.35, z);
  dyeGeometry(bucket, C.woodDark);
  const rope = new THREE.CylinderGeometry(0.015, 0.015, 0.6, 4);
  rope.translate(x, 1.75, z);
  dyeGeometry(rope, C.cloth);
  const rig = new THREE.Mesh(mergeGeometries([bar, bucket, rope]), toonMat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }));
  rig.geometry.computeVertexNormals();
  // D9 (Nate): the camp well holds WATER — a cool reflective disc just below
  // the rim, with a faint sky-sheen so it reads wet at a glance.
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.22, 18),
    new THREE.MeshBasicMaterial({ color: 0x3e6b8a, transparent: true, opacity: 0.92, fog: true }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.72, z);
  const sheen = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 14),
    new THREE.MeshBasicMaterial({ color: 0x9fc8de, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }),
  );
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.set(x - 0.25, 0.73, z + 0.2);
  group.add(ring, posts, roof, rig, water, sheen);
  return { mesh: group, colliders: [{ type: 'circle', x, z, r: 1.7, group: 'well' }], blockers: [ring, roof] };
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
  // ALL rugs merged into one vertex-dyed mesh — 1 draw for the whole set
  // (they were 1 draw EACH before; the camp budget lives at the ceiling).
  const parts = spots.map((s, i) => {
    const g = new THREE.PlaneGeometry(1.7, 1.1);
    dyeGeometry(g, i % 2 ? C.rug1 : C.rug2);
    g.rotateX(-Math.PI / 2);
    g.rotateY(s.rot ?? 0);
    g.translate(s.x, 0.03, s.z);
    return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), toonMat(0xffffff, { vertexColors: true }));
  mesh.geometry.computeVertexNormals();
  return { mesh, colliders: [] };
}

export function makePaths(spots, dirtTex = null) {
  const group = new THREE.Group();
  spots.forEach((s) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(s.r ?? 2.2, 10), toonMat(dirtTex ? 0xcbb99b : C.path, dirtTex ? { map: dirtTex } : {}));
    p.rotation.x = -Math.PI / 2;
    p.position.set(s.x, 0.015, s.z);
    p.scale.set(s.sx ?? 1, s.sz ?? 1, 1);
    p.rotation.z = s.rot ?? 0;
    group.add(p);
  });
  return { mesh: group, colliders: [] };
}

export function makeGrass(count = 90, span = 42, colliderWorld = null) {
  // A tuft = a few blades; per-instance GREEN shade + height variation so the
  // ground reads as a living meadow, not a repeated sprite (world-density).
  const blade = new THREE.ConeGeometry(0.055, 0.5, 3);
  blade.translate(0, 0.25, 0);
  const rnd = mulberry32(77);
  const greens = [
    new THREE.Color(0x86a24f), new THREE.Color(0x6f8a3c),
    new THREE.Color(0x94a856), new THREE.Color(0x5f7a38), new THREE.Color(0xa8a552),
  ];
  const mesh = new THREE.InstancedMesh(blade, toonMat(0xffffff), count); // white → tinted per-instance
  const d = new THREE.Object3D();
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 8) {
    const x = (rnd() - 0.5) * span;
    const z = (rnd() - 0.5) * span;
    if (colliderWorld && colliderWorld.overlaps(x, z, 0.3)) continue;
    const hgt = 0.55 + rnd() * 1.5;   // tuft height
    const wid = 0.8 + rnd() * 0.7;
    d.position.set(x, 0, z);
    d.scale.set(wid, hgt, wid);
    d.rotation.y = rnd() * Math.PI * 2;
    d.updateMatrix();
    mesh.setMatrixAt(placed, d.matrix);
    mesh.setColorAt(placed, greens[(rnd() * greens.length) | 0]);
    placed += 1;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return { mesh, colliders: [] };
}

// NATURAL BORDERS (level-layout law 5): the play space is enclosed by things
// the player can SEE — olive/tamarisk tree lines and boulder clusters — with
// colliders ON those props. The hard world bounds beyond are a silent failsafe.
// The north horizon stays open low (the ridge vista) — boulders there are
// knee-high and gappy on purpose; the fog and distance do the rest.
export function makeTreeline(runs, colliderWorld = null) {
  // Hebron hill country = the land of the Oaks of Mamre. Broad, round-canopied
  // OAK / terebinth (+ olive & fig via per-tree green tints) — NOT pointy pines.
  const trunk = new THREE.CylinderGeometry(0.13, 0.19, 1.4, 6);
  trunk.translate(0, 0.7, 0);
  // a spreading round canopy: two rounded blobs merged (broad + low = oak).
  const c1 = new THREE.IcosahedronGeometry(1.15, 0); c1.scale(1.3, 0.78, 1.3); c1.translate(0, 1.95, 0);
  const c2 = new THREE.IcosahedronGeometry(0.78, 0); c2.scale(1.15, 0.95, 1.15); c2.translate(0.35, 2.5, -0.2);
  const canopyGeo = mergeGeometries([c1, c2]);
  canopyGeo.computeVertexNormals(); // merged geo lost normals; toon lighting needs them
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
        if (colliderWorld && colliderWorld.overlaps(x, z, 0.9)) continue;
        spots.push([x, z, 0.8 + rnd() * 0.7]);
        colliders.push({ type: 'circle', x, z, r: 0.9, group: 'border' });
      }
    }
  }
  const group = new THREE.Group();
  group.add(inst(trunk, C.wood, spots, { seedRot: 51 }));
  // per-tree species tint: oak / terebinth / grey-green olive / deeper fig
  const foliage = [0x5c6b38, 0x6a7742, 0x7d8862, 0x4f6b3a];
  group.add(inst(canopyGeo, 0xffffff, spots, { seedRot: 51, tints: foliage }));
  // NOT a camera occluder — one InstancedMesh for the whole tree line; fading
  // it would ghost every border tree. Trees sit at the edges, behind the play
  // space, so they rarely come between the follow camera and the hero.
  return { mesh: group, colliders };
}

export function makeBoulders(spots, colliderWorld = null, rockTex = null) {
  const geo = new THREE.DodecahedronGeometry(0.62, 0);
  geo.translate(0, 0.28, 0);
  // never drop a rock into a tent/pen/prop (a camp collider already there fills
  // that lane); overlaps with other BORDER props are fine (rocks cluster).
  const keep = spots.filter((s) => !(colliderWorld && colliderWorld.overlaps(s.x, s.z, 0.62 * (s.scale ?? 1), 'border')));
  const mesh = inst(geo, rockTex ? 0xcdc0ab : C.boulder, keep.map((s) => [s.x, s.z, s.scale ?? 1, 0]), { seedRot: 52, map: rockTex });
  const colliders = keep.map((s) => ({ type: 'circle', x: s.x, z: s.z, r: 0.62 * (s.scale ?? 1), group: 'border' }));
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

// Sheep pen: fence posts + rails around a rect with TWO open gates — the main
// herding gate on the west (minX) side and a second opening opposite on the
// east (maxX) side (D6: sheep approached from the east used to pile on the
// fence; now either approach has a way in).
export function makePen(rect) {
  const { minX, maxX, minZ, maxZ, gate, gateEast } = rect; // gate/gateEast: {z0,z1}
  const posts = [];
  const railSegs = [];
  const step = 1.4;
  const addRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.4) return; // a degenerate sliver next to a gate — skip
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i <= n; i++) posts.push([x0 + (x1 - x0) * (i / n), z0 + (z1 - z0) * (i / n), 1, 0.5]);
    railSegs.push([(x0 + x1) / 2, (z0 + z1) / 2, len, Math.atan2(x1 - x0, z1 - z0)]);
  };
  addRun(minX, minZ, maxX, minZ);
  addRun(minX, maxZ, maxX, maxZ);
  // west wall, split around the main gate
  addRun(minX, minZ, minX, gate.z0);
  addRun(minX, gate.z1, minX, maxZ);
  // east wall, split around the second gate (or solid if none)
  if (gateEast) {
    addRun(maxX, minZ, maxX, gateEast.z0);
    addRun(maxX, gateEast.z1, maxX, maxZ);
  } else {
    addRun(maxX, minZ, maxX, maxZ);
  }

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
    { type: 'aabb', minX: minX - t, maxX: minX + t, minZ, maxZ: gate.z0, group: 'pen' },
    { type: 'aabb', minX: minX - t, maxX: minX + t, minZ: gate.z1, maxZ, group: 'pen' },
  ];
  if (gateEast) {
    colliders.push(
      { type: 'aabb', minX: maxX - t, maxX: maxX + t, minZ, maxZ: gateEast.z0, group: 'pen' },
      { type: 'aabb', minX: maxX - t, maxX: maxX + t, minZ: gateEast.z1, maxZ, group: 'pen' },
    );
  } else {
    colliders.push({ type: 'aabb', minX: maxX - t, maxX: maxX + t, minZ, maxZ, group: 'pen' });
  }
  return { mesh: group, colliders };
}

// D6 lived-in CLUTTER — firewood stacks, baskets, water skins, stools, rope
// coils — ALL merged into ONE vertex-colored mesh = ONE draw call for the
// entire set (the draw budget sits near its ceiling; per-type InstancedMeshes
// would cost 5+). Spots: { kind, x, z, rot?, scale? }. Solid kinds (firewood,
// stool) register small colliders; the rest are ground dressing (law 2).
export function makeCampClutter(spots) {
  const parts = [];
  const colliders = [];
  const add = (geo, color, x, z, rotY = 0, s = 1) => {
    dyeGeometry(geo, color);
    geo.scale(s, s, s);
    geo.rotateY(rotY);
    geo.translate(x, 0, z);
    parts.push(geo);
  };
  for (const p of spots) {
    const { kind, x, z, rot = 0, scale = 1 } = p;
    if (kind === 'firewood') {
      // a 3+2 pyramid of cut logs
      const L = (dx, y, dz) => { const g = new THREE.CylinderGeometry(0.085, 0.095, 0.85, 5); g.rotateZ(Math.PI / 2); g.translate(dx, y, dz); return g; };
      [[-0.1, 0.09, -0.2], [-0.05, 0.09, 0], [-0.12, 0.09, 0.2], [-0.07, 0.26, -0.1], [-0.1, 0.26, 0.1]]
        .forEach(([dx, y, dz]) => add(L(dx, y, dz), C.woodDark, x, z, rot, scale));
      colliders.push({ type: 'circle', x, z, r: 0.52 * scale, group: 'clutter' });
    } else if (kind === 'basket') {
      const g = new THREE.CylinderGeometry(0.26, 0.18, 0.34, 8, 1, true);
      g.translate(0, 0.17, 0);
      add(g, 0xb08a4f, x, z, rot, scale);
      const rim = new THREE.TorusGeometry(0.26, 0.028, 5, 10);
      rim.rotateX(Math.PI / 2); rim.translate(0, 0.34, 0);
      add(rim, 0x8a6a3a, x, z, rot, scale);
    } else if (kind === 'skin') {
      // a plump water skin leaning on its side
      const g = new THREE.SphereGeometry(0.2, 7, 6);
      g.scale(1, 0.78, 1.25); g.translate(0, 0.16, 0);
      add(g, 0x7a4f30, x, z, rot, scale);
      const neck = new THREE.CylinderGeometry(0.045, 0.06, 0.12, 5);
      neck.rotateZ(0.7); neck.translate(0.16, 0.3, 0.16);
      add(neck, 0x54381f, x, z, rot, scale);
    } else if (kind === 'stool') {
      const seat = new THREE.CylinderGeometry(0.21, 0.21, 0.07, 8);
      seat.translate(0, 0.3, 0);
      add(seat, C.wood, x, z, rot, scale);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.CylinderGeometry(0.03, 0.035, 0.3, 4);
        leg.rotateX(Math.cos(a) * 0.22); leg.rotateZ(Math.sin(a) * 0.22);
        leg.translate(Math.cos(a) * 0.13, 0.15, Math.sin(a) * 0.13);
        add(leg, C.woodDark, x, z, rot, scale);
      }
      colliders.push({ type: 'circle', x, z, r: 0.26 * scale, group: 'clutter' });
    } else if (kind === 'rope') {
      const g = new THREE.TorusGeometry(0.19, 0.05, 5, 12);
      g.rotateX(Math.PI / 2); g.translate(0, 0.05, 0);
      add(g, 0xc9b285, x, z, rot, scale);
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts), toonMat(0xffffff, { vertexColors: true }));
  mesh.geometry.computeVertexNormals(); // merged geometry must never render black
  return { mesh, colliders };
}

// --- the Scene 1 camp layout (data) -----------------------------------------

export function buildCamp(colliderWorld, tex = {}) {
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
  addAll(makeWell(4.5, -1, tex.rock)); // D6: a real landmark now
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
    // D6: woven mats at the tent doors too
    { x: -9.4, z: -7.8, rot: 0.5 }, { x: 8.2, z: -9.1, rot: -0.2 },
  ]));
  addAll(makePaths([
    { x: 0, z: -2.5, r: 2.6, sx: 1.4 }, { x: -5, z: -5, r: 2.2, sx: 1.5, rot: 0.7 },
    { x: 5.5, z: 3, r: 2.0, sx: 1.6, rot: -0.9 }, { x: 10, z: 8, r: 2.2, sx: 1.4, rot: -0.4 },
  ], tex.dirt));
  // (D6: the lone crate at 10.5,7.3 is DELETED — sheep stuck on it at the pen approach)
  // D6 lived-in clutter — ONE merged draw for all of it, clustered by use-area
  addAll(makeCampClutter([
    // the main fire: firewood, stools to sit on, a rope coil
    { kind: 'firewood', x: 1.9, z: -7.4, rot: 0.4 }, { kind: 'stool', x: -1.4, z: -6.9 },
    { kind: 'stool', x: 1.3, z: -4.8, rot: 1.1 }, { kind: 'rope', x: 2.5, z: -5.5 },
    // the west fire
    { kind: 'firewood', x: -9.9, z: 5.2, rot: 1.8 }, { kind: 'stool', x: -7.2, z: 4.7 },
    // the well gathering: water skins + a rope for the bucket
    { kind: 'skin', x: 3.1, z: -2.4, rot: 0.7 }, { kind: 'skin', x: 6.1, z: -2.3, rot: 2.4 },
    { kind: 'rope', x: 6.3, z: -0.3 },
    // Jacob's tent door: baskets + a skin
    { kind: 'basket', x: -9.6, z: -8.6 }, { kind: 'basket', x: -12.5, z: -8.7, scale: 0.85 },
    { kind: 'skin', x: -9.0, z: -6.3, rot: 4.1 },
    // the other tents, lived-in
    { kind: 'basket', x: 8.0, z: -8.7, scale: 0.9 }, { kind: 'firewood', x: 10.7, z: -8.9, rot: 2.6, scale: 0.9 },
    { kind: 'basket', x: -12.9, z: 2.0 }, { kind: 'skin', x: -13.5, z: 4.7, rot: 1.2 },
    { kind: 'basket', x: 12.5, z: 4.6, scale: 0.9 },
    // laundry corner
    { kind: 'basket', x: 0.7, z: 8.3, scale: 1.1 },
  ]));
  // pen: ONE wide WEST gate (D7: the D6 east gate opened into the 1.3u strip
  // against the world bound — dead space; sheep navigate AROUND to the west
  // gate now via corner routing, so a second hole isn't needed)
  const pen = { minX: 10, maxX: 17, minZ: 8.5, maxZ: 14, gate: { z0: 9.9, z1: 12.9 } };
  addAll(makePen(pen));

  // NATURAL WALLS (D4 Task 5, reworked D6): tree lines EAST/WEST only + rock
  // walls north AND south. The SOUTH treeline is GONE — the follow camera
  // lives on the south side (spawn + pen framing both look north), and tall
  // canopies there sat behind/over the camera and hid the sheep pen
  // (level-layout law 7: the spawn frame is sacred). A LOW boulder rail now
  // holds the south border — visible enclosure, nothing at camera height.
  addAll(makeTreeline([
    { x0: 18.9, z0: -14, x1: 18.9, z1: 16.8, gap: 1.7 },       // east  (dense)
    { x0: -18.9, z0: 16.8, x1: -18.9, z1: -14, gap: 1.7 },     // west  (dense)
    { x0: -18.8, z0: -14.5, x1: -10, z1: -16.6, gap: 2.0 },    // NW corner trees
    { x0: 10, z0: -16.6, x1: 18.8, z1: -14.5, gap: 2.0 },      // NE corner trees
  ], colliderWorld));
  addAll(makeBoulders([
    // SOUTH low rock rail (replaces the treeline): tight spacing, small scales —
    // the border reads, the camera sees clean over it
    { x: -17.2, z: 17.0, scale: 1.15 }, { x: -15.0, z: 17.1, scale: 0.95 }, { x: -12.8, z: 17.0, scale: 1.1 },
    { x: -10.6, z: 17.1, scale: 0.9 }, { x: -8.4, z: 17.0, scale: 1.05 }, { x: -6.2, z: 17.1, scale: 0.95 },
    { x: -4.0, z: 17.0, scale: 1.1 }, { x: -1.8, z: 17.1, scale: 0.9 }, { x: 0.4, z: 17.0, scale: 1.05 },
    { x: 2.6, z: 17.1, scale: 0.95 }, { x: 4.8, z: 17.0, scale: 1.1 }, { x: 7.0, z: 17.1, scale: 0.9 },
    { x: 9.2, z: 17.0, scale: 1.05 }, { x: 11.4, z: 17.1, scale: 0.95 }, { x: 13.6, z: 17.0, scale: 1.1 },
    { x: 15.8, z: 17.1, scale: 0.95 }, { x: 17.6, z: 17.0, scale: 1.2 },
  ], colliderWorld, tex.rock));
  addAll(makeBoulders([
    // north wall — a two-depth rock berm: a taller BACK row (behind the bound,
    // for the silhouette) + a FRONT row whose colliders actually stop the
    // player, spaced tight enough (~2.1) to leave no player-sized gap while
    // staying low so the ridge vista still reads over them.
    { x: -17.6, z: -16.2, scale: 1.95 }, { x: -13.2, z: -16.4, scale: 1.6 },
    { x: -8.4, z: -16.5, scale: 1.4 }, { x: -3.2, z: -16.5, scale: 1.5 },
    { x: 1.8, z: -16.6, scale: 1.35 }, { x: 7.0, z: -16.5, scale: 1.45 },
    { x: 12.0, z: -16.4, scale: 1.6 }, { x: 16.8, z: -16.2, scale: 1.95 },
    // FRONT row (z ~-15.4) — tight, this is what the player bumps
    { x: -16.2, z: -15.4, scale: 1.1 }, { x: -14.1, z: -15.5, scale: 1.05 }, { x: -12.0, z: -15.4, scale: 1.1 },
    { x: -9.9, z: -15.5, scale: 1.0 }, { x: -7.8, z: -15.4, scale: 1.05 }, { x: -5.7, z: -15.5, scale: 1.0 },
    { x: -3.6, z: -15.4, scale: 1.1 }, { x: -1.5, z: -15.5, scale: 1.0 }, { x: 0.6, z: -15.4, scale: 1.05 },
    { x: 2.7, z: -15.5, scale: 1.0 }, { x: 4.8, z: -15.4, scale: 1.1 }, { x: 6.9, z: -15.5, scale: 1.0 },
    { x: 9.0, z: -15.4, scale: 1.05 }, { x: 11.1, z: -15.5, scale: 1.1 }, { x: 13.2, z: -15.4, scale: 1.0 },
    { x: 15.3, z: -15.5, scale: 1.1 },
    // corner clusters — the camp feels held (comfy, enclosed); clear of the pen
    { x: -18.6, z: 14.8, scale: 1.7 }, { x: -17.4, z: 12.6, scale: 1.15 }, { x: -18.8, z: 10.0, scale: 1.35 },
    { x: 18.6, z: 6.4, scale: 1.5 }, { x: 17.7, z: 4.4, scale: 1.15 }, { x: 18.8, z: 2.0, scale: 1.35 },
    // D7: SEAL the strip east of the pen — the treeline's second row plugs it
    // every few units, so it's a dead-end TRAP (sheep pushed in could never
    // come out). Two visible rocks close both mouths; nothing enters again.
    { x: 17.7, z: 7.5, scale: 1.3 }, { x: 17.7, z: 15.0, scale: 1.3 },
  ], colliderWorld, tex.rock));
  addAll(makeGrass(180, 42, colliderWorld));

  return { group, fireEmitters, sway, pen, cameraBlockers };
}
