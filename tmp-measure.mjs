import * as THREE from 'three';
import { bootScene, drawStats } from './tools/harness/scene.mjs';

const { buildNoahArk } = await import('./src/scenes/noah/index.js');
const h = await bootScene(buildNoahArk);
const scene = h.scene;

const near = scene.getObjectByName('forest-canopy');
const far = scene.getObjectByName('forest-canopy-far');

const mat = new THREE.Matrix4();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const quat = new THREE.Quaternion();
const read = (m) => {
  const out = [];
  for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, mat);
    mat.decompose(pos, quat, scl);
    out.push({ x: pos.x, y: pos.y, z: pos.z, sx: scl.x, sy: scl.y, sz: scl.z });
  }
  return out;
};
const N = read(near); const F = read(far);

const B = { minX: -104, maxX: 104, minZ: -56, maxZ: 68 };
const clampToRect = (x, z) => ({
  x: Math.min(B.maxX, Math.max(B.minX, x)),
  z: Math.min(B.maxZ, Math.max(B.minZ, z)),
});
const distToRect = (x, z) => { const c = clampToRect(x, z); return Math.hypot(x - c.x, z - c.z); };

const withD = F.map((t) => ({ ...t, d: distToRect(t.x, t.z) })).sort((a, b) => a.d - b.d);
console.log('--- 10 closest FAR (1-lump) trees to any reachable player position ---');
for (const t of withD.slice(0, 10)) {
  console.log(`  d=${t.d.toFixed(1)}  at (${t.x.toFixed(1)}, ${t.z.toFixed(1)})  scale ${t.sx.toFixed(2)}`);
}

// Angular size on screen, from an ACTUAL camera pose: player at the nearest
// reachable point, camera 9.4 back / 4.0 up looking at the player.
const fovY = 46 * Math.PI / 180;
const px = 1080;
const t0 = withD[0];
const c0 = clampToRect(t0.x, t0.z);
// worst case: camera between player and tree is impossible (camera trails), but
// even at the player's own position the tree is d away.
const canopyH = 4.85 * t0.sy; // far geo height * instance sy
console.log(`nearest far tree: canopy ${canopyH.toFixed(2)}u tall at ${t0.d.toFixed(1)}u`);
console.log(`  => ${(2 * Math.atan(canopyH / 2 / t0.d) / fovY * px).toFixed(0)} px tall on a 1080p frame`);

// how many far trees subtend > 60px
const bigs = withD.filter((t) => (2 * Math.atan((4.85 * t.sy) / 2 / t.d) / fovY * px) > 60);
console.log(`far trees subtending >60px from a reachable player position: ${bigs.length}/${F.length}`);

// Boundary adjacency
let pairs = [];
for (const f of F) {
  let best = Infinity; let bn = null;
  for (const n of N) { const d = Math.hypot(f.x - n.x, f.z - n.z); if (d < best) { best = d; bn = n; } }
  pairs.push({ d: best, f, n: bn });
}
pairs.sort((a, b) => a.d - b.d);
console.log('--- closest near/far NEIGHBOUR pairs (the visible LOD seam) ---');
for (const p of pairs.slice(0, 6)) {
  console.log(`  ${p.d.toFixed(2)}u apart at (${p.f.x.toFixed(1)},${p.f.z.toFixed(1)}) — player can stand ${distToRect(p.f.x, p.f.z).toFixed(1)}u away`);
}

// silhouette compare at identical scale
near.geometry.computeBoundingBox(); far.geometry.computeBoundingBox();
const nb = near.geometry.boundingBox, fb = far.geometry.boundingBox;
console.log('near canopy size XYZ', [nb.max.x - nb.min.x, nb.max.y - nb.min.y, nb.max.z - nb.min.z].map((v) => v.toFixed(2)).join(' x '));
console.log('far  canopy size XYZ', [fb.max.x - fb.min.x, fb.max.y - fb.min.y, fb.max.z - fb.min.z].map((v) => v.toFixed(2)).join(' x '));
console.log('near centroid y', ((nb.max.y + nb.min.y) / 2).toFixed(3), ' far centroid y', ((fb.max.y + fb.min.y) / 2).toFixed(3));

// fog
const { Graphics } = await import('./src/systems/Graphics.js');
console.log('fog near', scene.fog.near, 'far', scene.fog.far, '(Graphics.fogFar', Graphics.fogFar, ')');

console.log('draw stats', JSON.stringify(drawStats(scene)));
await h.dispose();
