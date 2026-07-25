import * as THREE from 'three';
import { mulberry32, toonMat } from '../../engine/world.js';

// --- the pit: the cold-open stage (Genesis 37:23–24) -------------------------
// A dry cistern in the rocky country near Dothan. The cold open plays here with the
// REAL rigged cast (the story runner starts only after the GLBs load — no
// primitive stand-ins ever, level-layout law 8): the brothers march Joseph in,
// tear off the tunic, and throw him down. Shown once, then never again.
export function buildPitStage(tex = {}) {
  const group = new THREE.Group();
  const PIT = { x: -62, z: 6 };
  // Genesis 37:25 records a meal, not a return home. Keep that destination far
  // enough away to read as a background camp rather than people standing
  // around the cistern.
  const MEAL = { x: PIT.x + 31, z: PIT.z - 9.5 };
  const rnd = mulberry32(37);

  // harsh rocky ground around the pit (country near Dothan — paler, rougher).
  // Real dirt texture, warm-tinted — never a flat gray disc (world-density law).
  // D7: the ground is a RING with a REAL hole — the camera must see straight
  // down the shaft to Joseph lying at the bottom (the old opaque "mouth" disc
  // was a black lid that hid him completely).
  const patchOpts = { color: 0xa89468, fog: true };
  if (tex.dirt) patchOpts.map = tex.dirt;
  const patch = new THREE.Mesh(new THREE.RingGeometry(2.05, 10, 26, 1), toonMat(0xffffff, patchOpts));
  patch.rotation.x = -Math.PI / 2; patch.position.set(PIT.x, 0.02, PIT.z);
  group.add(patch);
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0); rockGeo.translate(0, 0.18, 0);
  const rspots = [];
  // the brothers' WALK-OFF CORRIDOR heads east-by-south (dir ≈ (6.5,-2.2), angle
  // ≈ −0.33 rad) — no rock may sit in that lane (D11: they clipped through one)
  const CORRIDOR_A = Math.atan2(-2.2, 6.5);
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, r = 3.8 + rnd() * 5;
    let da = a - CORRIDOR_A;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 0.55) continue; // keep the walk-off lane clear
    rspots.push([PIT.x + Math.cos(a) * r, PIT.z + Math.sin(a) * r]);
  }
  // D15: a dry cistern needs a readable raised lip, not only a paper-flat
  // ground ring. Low, irregular rim stones share the existing InstancedMesh,
  // so the silhouette improves without adding a draw call or covering the hole.
  const RIM_STONES = 18;
  for (let i = 0; i < RIM_STONES; i++) {
    const a = (i / RIM_STONES) * Math.PI * 2;
    const r = 2.23 + (i % 3) * 0.035;
    rspots.push([
      PIT.x + Math.cos(a) * r,
      PIT.z + Math.sin(a) * r,
      0.68 + (i % 4) * 0.045,
      0.42 + (i % 3) * 0.035,
      0.6 + ((i + 2) % 4) * 0.045,
      a + (i % 2 ? 0.16 : -0.12),
    ]);
  }
  const rocks = new THREE.InstancedMesh(rockGeo, toonMat(0x796d55), rspots.length);
  const rd = new THREE.Object3D();
  rspots.forEach((s, i) => {
    rd.position.set(s[0], s.length > 2 ? 0.04 : 0, s[1]);
    if (s.length > 2) {
      rd.scale.set(s[2], s[3], s[4]);
      rd.rotation.y = s[5];
    } else {
      rd.scale.setScalar(0.6 + rnd() * 1.3);
      rd.rotation.y = rnd() * 6;
    }
    rd.updateMatrix(); rocks.setMatrixAt(i, rd.matrix);
  });
  rocks.instanceMatrix.needsUpdate = true; group.add(rocks);

  // A sparse Dothan tree line restores the cold-open's world scale. It is a
  // pit-only static backdrop (two instanced draws), so the distant Hebron camp,
  // sheep, particles, AI, and fire lights remain asleep. The east-southeast
  // corridor stays open around the brothers' route and the meal fire.
  const treeSpots = [];
  const treeCorridor = CORRIDOR_A;
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + (rnd() - 0.5) * 0.12;
    let da = a - treeCorridor;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 0.32) continue;
    const r = 12.5 + rnd() * 12;
    treeSpots.push({
      x: PIT.x + Math.cos(a) * r,
      z: PIT.z + Math.sin(a) * r,
      scale: 0.82 + rnd() * 0.48,
      yaw: rnd() * Math.PI * 2,
    });
  }
  // A second, tighter tree cluster surrounds the distant meal camp. Leave a
  // sightline back toward the cistern so its small fire remains legible.
  const campToPit = Math.atan2(PIT.z - MEAL.z, PIT.x - MEAL.x);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + (rnd() - 0.5) * 0.16;
    let da = a - campToPit;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 0.42) continue;
    const r = 5.8 + rnd() * 3.8;
    treeSpots.push({
      x: MEAL.x + Math.cos(a) * r,
      z: MEAL.z + Math.sin(a) * r,
      scale: 0.82 + rnd() * 0.44,
      yaw: rnd() * Math.PI * 2,
    });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.38, 3.6, 5);
  trunkGeo.translate(0, 1.8, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1.65, 1);
  crownGeo.translate(0, 4.0, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, toonMat(0x49352d), treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, toonMat(0x344332), treeSpots.length);
  const treeDummy = new THREE.Object3D();
  const crownColor = new THREE.Color();
  treeSpots.forEach((spot, i) => {
    treeDummy.position.set(spot.x, 0, spot.z);
    treeDummy.rotation.y = spot.yaw;
    treeDummy.scale.set(spot.scale, spot.scale, spot.scale);
    treeDummy.updateMatrix();
    trunks.setMatrixAt(i, treeDummy.matrix);
    crowns.setMatrixAt(i, treeDummy.matrix);
    crownColor.set(i % 3 === 0 ? 0x3e4f39 : (i % 3 === 1 ? 0x2e4234 : 0x46523a));
    crowns.setColorAt(i, crownColor);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  crowns.instanceColor.needsUpdate = true;
  group.add(trunks, crowns);

  // Three almost-black tent silhouettes make the fire read as a distant camp.
  // They share one instanced draw and own no texture, animation, or light.
  const tentGeo = new THREE.ConeGeometry(1.25, 1.75, 4);
  tentGeo.translate(0, 0.875, 0);
  const campTents = new THREE.InstancedMesh(
    tentGeo,
    new THREE.MeshBasicMaterial({ color: 0x17151c, fog: true }),
    3,
  );
  const tentDummy = new THREE.Object3D();
  [
    [MEAL.x - 3.0, MEAL.z + 1.7, 0.15, 1.1],
    [MEAL.x + 2.8, MEAL.z + 1.5, -0.22, 0.9],
    [MEAL.x + 0.4, MEAL.z - 3.2, 0.75, 0.82],
  ].forEach(([x, z, yaw, scale], i) => {
    tentDummy.position.set(x, 0, z);
    tentDummy.rotation.y = Math.PI / 4 + yaw;
    tentDummy.scale.set(1.45 * scale, scale, 0.9 * scale);
    tentDummy.updateMatrix();
    campTents.setMatrixAt(i, tentDummy.matrix);
  });
  campTents.instanceMatrix.needsUpdate = true;
  group.add(campTents);

  // (D7: the old opaque "mouth" disc is GONE — the hole is real. Looking down
  // the shaft you now see the walls, the floor, and the boy on his back.)

  // the pit INTERIOR (below ground) — D11 (Nate): MUCH darker, with a true
  // BLACK floor at the very bottom; the boy stays visible only in the narrow
  // pool of light on him (D7 law: he must be SEEN — but the pit reads night).
  // The shaft wall carries Nate's brick. It stays UNLIT and heavily tinted:
  // the cistern reads as night, so the courses should be felt in the shaft of
  // light and swallowed everywhere else, never lit up like a daytime surface.
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(2.05, 1.85, 4.1, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: tex.brick ? 0x6a6072 : 0x2a2433,
      map: tex.brick || null,
      side: THREE.BackSide,
      fog: true,
    }),
  );
  wall.position.set(PIT.x, -2.0, PIT.z); group.add(wall);
  // A little hand-laid masonry gives the cistern wall readable history. Four
  // staggered courses share ONE instanced box draw; no texture, shader, or
  // per-frame work is added. The stones sit against the wall rather than over
  // the shaft, so the fall camera and Joseph remain fully clear.
  const COURSE_ROWS = 4;
  const COURSE_STONES = 20;
  const blockGeo = new THREE.BoxGeometry(0.52, 0.22, 0.11);
  const masonry = new THREE.InstancedMesh(
    blockGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }),
    COURSE_ROWS * COURSE_STONES,
  );
  const block = new THREE.Object3D();
  const blockColor = new THREE.Color();
  for (let row = 0; row < COURSE_ROWS; row++) {
    const radius = 1.94 - row * 0.025;
    const y = -0.58 - row * 0.92;
    for (let i = 0; i < COURSE_STONES; i++) {
      const index = row * COURSE_STONES + i;
      const a = ((i + (row % 2) * 0.5) / COURSE_STONES) * Math.PI * 2;
      block.position.set(
        PIT.x + Math.cos(a) * radius,
        y + ((i + row) % 3 - 1) * 0.018,
        PIT.z + Math.sin(a) * radius,
      );
      block.rotation.set(0, Math.PI / 2 - a, 0);
      block.scale.set(0.9 + ((i * 7 + row) % 5) * 0.055, 0.92 + (i % 2) * 0.08, 1);
      block.updateMatrix();
      masonry.setMatrixAt(index, block.matrix);
      blockColor.set([0x574b52, 0x63575b, 0x4c444f][(i + row) % 3]);
      masonry.setColorAt(index, blockColor);
    }
  }
  masonry.instanceMatrix.needsUpdate = true;
  masonry.instanceColor.needsUpdate = true;
  group.add(masonry);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.95, 20), new THREE.MeshBasicMaterial({ color: 0x0c0a12, fog: true }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(PIT.x, -4.0, PIT.z); group.add(floor);
  // only a whisper of light reaches the floor around him now
  const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), new THREE.MeshBasicMaterial({ color: 0x5f5648, transparent: true, opacity: 0.26, fog: true }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(PIT.x, -3.98, PIT.z); group.add(floorGlow);
  // …and a real shaft of daylight ON HIM: one warm point light in the pit — the
  // boy at the bottom must be SEEN, not implied.
  //
  // It deliberately does NOT live in `group`. three.js drops invisible lights
  // from the light list, and the number of point lights is part of a material's
  // shader cache key — so hiding this one with the stage changed the count
  // (camp 2 · pit 1 · dream 0) and made every lit material recompile its program
  // the first time each stage appeared, which is a hitch exactly on a cut. The
  // scene keeps a constant three point lights forever and this one is simply
  // turned down to zero; the pre-warm already compiles that configuration.
  const shaftLight = new THREE.PointLight(0xfff0d0, 0, 8.5, 1.4);
  shaftLight.position.set(PIT.x, -1.1, PIT.z);

  // the SKY-LIGHT above the pit — a bright disc that SHRINKS as he falls in
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 6, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,246,220,0.95)'); g.addColorStop(1, 'rgba(255,246,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const skyLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: 0xfff2cf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  skyLight.position.set(PIT.x, 3.6, PIT.z); skyLight.scale.setScalar(8);
  group.add(skyLight);

  // the torn coat a brother carries off (argyle-red cloth). A cloth PROP —
  // characters in this cutscene are the real rigged cast, moved by the beat.
  const coatProp = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.8), new THREE.MeshBasicMaterial({ color: 0xb5643c, side: THREE.DoubleSide, fog: true }));
  coatProp.visible = false; group.add(coatProp);

  // D8 shot 5: a faint WARM light in the direction the brothers walk — the
  // nearby meal/fire of Genesis 37:25, while the boy stays in the cold dark.
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g2 = c.getContext('2d');
    const g = g2.createRadialGradient(32, 34, 3, 32, 34, 30);
    g.addColorStop(0, 'rgba(255,190,120,0.9)');
    g.addColorStop(0.45, 'rgba(255,150,80,0.35)');
    g.addColorStop(1, 'rgba(255,140,70,0)');
    g2.fillStyle = g; g2.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  // D11: deeper fire-red + smaller — it must read as a distant MEAL FIRE, never
  // as a sunrise on the horizon (the pit plays as night).
  const mealGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8f4a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  mealGlow.position.set(MEAL.x, 1.6, MEAL.z);
  mealGlow.scale.set(7.2, 4.2, 1);
  group.add(mealGlow);

  return {
    group, PIT, MEAL, coatProp, skyLight, shaftLight,
    // The stage owner drives this instead of hiding the light (see above).
    setShaft(k) { shaftLight.intensity = 1.05 * k; },
    setSkyLight(k) { skyLight.material.opacity = 0.9 * k; },
    setMealGlow(k) { mealGlow.material.opacity = 0.6 * k; },
    shrinkSkyLight(k) { skyLight.scale.setScalar(8 - 6.5 * k); }, // k 0→1 closes over him
    update() { /* static set — the beat animates the cast */ },
    dispose() {
      ringTex.dispose();
      glowTex.dispose();
      shaftLight.parent?.remove(shaftLight); // it lives on the scene, not the group
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
      group.parent?.remove(group);
    },
  };
}
