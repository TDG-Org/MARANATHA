import * as THREE from 'three';

// LEVEL-LAYOUT AUDIT (level-layout skill): the automated overlap check that a
// scene must pass with ZERO findings before it ships. Wire it into the scene's
// debug hook (`debug.audit()`) and run it during QA.
//
//   auditLayout({
//     colliderWorld,          // ColliderWorld (statics carry optional .group tags)
//     ground,                 // the ground Mesh (flatness raycasts)
//     zones: [{x,z,label}],   // trigger/prompt centers that must be standable
//     stages: [{x,z,r,label}] // story stages whose floor ring must be flat
//   }) -> findings[]          // [] = clean
//
// Same-.group collider pairs are allowed to touch (a crate PILE, a fence run's
// corner posts) — different groups must keep clear air (level-layout law 2).
const EPS = 0.05;

export function auditLayout({ colliderWorld, ground, zones = [], stages = [] } = {}) {
  const findings = [];
  const statics = colliderWorld?.statics || [];

  // --- 1) static-vs-static overlaps -----------------------------------------
  for (let i = 0; i < statics.length; i++) {
    for (let j = i + 1; j < statics.length; j++) {
      const a = statics[i], b = statics[j];
      if (a.group && a.group === b.group) continue;
      const depth = overlapDepth(a, b);
      if (depth > EPS) {
        findings.push({
          type: 'collider-overlap', depth: round(depth),
          a: describe(a), b: describe(b),
        });
      }
    }
  }

  // --- 2) flat ground under props + stage floors ----------------------------
  if (ground) {
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const from = new THREE.Vector3();
    const heightAt = (x, z) => {
      from.set(x, 40, z);
      ray.set(from, down);
      const hit = ray.intersectObject(ground, false)[0];
      return hit ? hit.point.y : null;
    };
    for (const c of statics) {
      const cx = c.type === 'circle' ? c.x : (c.minX + c.maxX) / 2;
      const cz = c.type === 'circle' ? c.z : (c.minZ + c.maxZ) / 2;
      const h = heightAt(cx, cz);
      if (h !== null && Math.abs(h) > 0.06) {
        findings.push({ type: 'prop-on-slope', height: round(h), at: describe(c) });
      }
    }
    for (const s of stages) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const h = heightAt(s.x + Math.cos(a) * s.r, s.z + Math.sin(a) * s.r);
        if (h !== null && Math.abs(h) > 0.06) {
          findings.push({ type: 'stage-not-flat', stage: s.label, height: round(h), angle: round(a) });
          break; // one finding per stage is enough
        }
      }
    }
  }

  // --- 3) quest zones must be standable --------------------------------------
  // The CENTER of a trigger/prompt may sit near a prop (big-radius triggers
  // ring a campfire) but never INSIDE one — that's an unreachable quest zone.
  for (const zn of zones) {
    if (colliderWorld.overlaps(zn.x, zn.z, 0.02)) {
      findings.push({ type: 'zone-blocked', zone: zn.label || `${zn.x},${zn.z}` });
    }
  }

  return findings;
}

function overlapDepth(a, b) {
  if (a.type === 'circle' && b.type === 'circle') {
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    return a.r + b.r - d;
  }
  if (a.type === 'aabb' && b.type === 'aabb') {
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    return ox > 0 && oz > 0 ? Math.min(ox, oz) : -1;
  }
  const c = a.type === 'circle' ? a : b;
  const r = a.type === 'circle' ? b : a;
  const px = Math.max(r.minX, Math.min(c.x, r.maxX));
  const pz = Math.max(r.minZ, Math.min(c.z, r.maxZ));
  return c.r - Math.hypot(c.x - px, c.z - pz);
}

function describe(c) {
  return c.type === 'circle'
    ? `circle(${round(c.x)},${round(c.z)} r${round(c.r)}${c.group ? ` ${c.group}` : ''})`
    : `aabb(${round(c.minX)}..${round(c.maxX)}, ${round(c.minZ)}..${round(c.maxZ)}${c.group ? ` ${c.group}` : ''})`;
}

const round = (v) => Math.round(v * 100) / 100;
