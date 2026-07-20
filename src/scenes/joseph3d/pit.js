import * as THREE from 'three';
import { mulberry32 } from '../../engine/world.js';

// --- the pit: the cold-open stage (Genesis 37:23–24) -------------------------
// A dry cistern in the Shechem wilderness. The cold open plays here with the
// REAL rigged cast (the story runner starts only after the GLBs load — no
// primitive stand-ins ever, level-layout law 8): the brothers carry Joseph in,
// tear off the tunic, and throw him down. Shown once, then never again.
export function buildPitStage(tex = {}) {
  const group = new THREE.Group();
  const PIT = { x: -62, z: 6 };
  const rnd = mulberry32(37);

  // harsh rocky ground around the pit (Shechem wilderness — paler, rougher).
  // Real dirt texture, warm-tinted — never a flat gray disc (world-density law).
  // D7: the ground is a RING with a REAL hole — the camera must see straight
  // down the shaft to Joseph lying at the bottom (the old opaque "mouth" disc
  // was a black lid that hid him completely).
  const patchOpts = { color: 0xa89468, fog: true };
  if (tex.dirt) patchOpts.map = tex.dirt;
  const patch = new THREE.Mesh(new THREE.RingGeometry(2.05, 10, 26, 1), new THREE.MeshBasicMaterial(patchOpts));
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
  const rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshBasicMaterial({ color: 0x796d55, fog: true }), rspots.length);
  const rd = new THREE.Object3D();
  rspots.forEach((s, i) => { rd.position.set(s[0], 0, s[1]); rd.scale.setScalar(0.6 + rnd() * 1.3); rd.rotation.y = rnd() * 6; rd.updateMatrix(); rocks.setMatrixAt(i, rd.matrix); });
  rocks.instanceMatrix.needsUpdate = true; group.add(rocks);

  // (D7: the old opaque "mouth" disc is GONE — the hole is real. Looking down
  // the shaft you now see the walls, the floor, and the boy on his back.)

  // the pit INTERIOR (below ground) — D11 (Nate): MUCH darker, with a true
  // BLACK floor at the very bottom; the boy stays visible only in the narrow
  // pool of light on him (D7 law: he must be SEEN — but the pit reads night).
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 1.85, 4.1, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0x2a2433, side: THREE.BackSide, fog: true }));
  wall.position.set(PIT.x, -2.0, PIT.z); group.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.95, 20), new THREE.MeshBasicMaterial({ color: 0x0c0a12, fog: true }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(PIT.x, -4.0, PIT.z); group.add(floor);
  // only a whisper of light reaches the floor around him now
  const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(1.15, 18), new THREE.MeshBasicMaterial({ color: 0x5f5648, transparent: true, opacity: 0.26, fog: true }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.set(PIT.x, -3.98, PIT.z); group.add(floorGlow);
  // …and a real shaft of daylight ON HIM: one warm point light inside the pit
  // (lives in this group, so it dies with the stage after the cold open —
  // the boy at the bottom must be SEEN, not implied).
  const shaftLight = new THREE.PointLight(0xfff0d0, 1.05, 8.5, 1.4);
  shaftLight.position.set(PIT.x, -1.1, PIT.z);
  group.add(shaftLight);

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

  // D8 shot 5: a faint WARM light far off in the direction the brothers walk —
  // the fires of the camp they return to, while the boy stays in the cold dark.
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
  // D11: deeper fire-red + smaller — it must read as distant CAMPFIRES, never
  // as a sunrise on the horizon (the pit plays as night).
  const campGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8f4a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  campGlow.position.set(PIT.x + 30, 2.0, PIT.z - 9);
  campGlow.scale.set(7, 4.2, 1);
  group.add(campGlow);

  return {
    group, PIT, coatProp, skyLight,
    setSkyLight(k) { skyLight.material.opacity = 0.9 * k; },
    setCampGlow(k) { campGlow.material.opacity = 0.6 * k; },
    shrinkSkyLight(k) { skyLight.scale.setScalar(8 - 6.5 * k); }, // k 0→1 closes over him
    update() { /* static set — the beat animates the cast */ },
    dispose() {
      ringTex.dispose();
      glowTex.dispose();
      group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.isMesh || o.isSprite) { o.geometry?.dispose?.(); o.material?.dispose?.(); } });
      group.parent?.remove(group);
    },
  };
}
