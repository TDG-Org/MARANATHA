// Movement collision (collision-physics skill): characters are circles on the
// XZ plane; obstacles are circles or AABBs. Move-then-resolve with exact
// push-out along the contact normal — tangential motion survives (that IS the
// slide), so there's no sticking and no jitter. No physics engine.
export class ColliderWorld {
  constructor() {
    this.statics = []; // {type:'circle',x,z,r} | {type:'aabb',minX,minZ,maxX,maxZ}
  }

  add(c) { this.statics.push(c); return c; }
  addCircle(x, z, r) { return this.add({ type: 'circle', x, z, r }); }
  addAABB(minX, minZ, maxX, maxZ) { return this.add({ type: 'aabb', minX, minZ, maxX, maxZ }); }
  clear() { this.statics.length = 0; }

  // Resolve a moving circle at pos {x,z} with radius r against all statics
  // (+ optional dynamic circles like NPCs). Mutates pos. ≤3 iterations; total
  // correction clamped so bad data can never teleport anyone.
  resolve(pos, r, dynamics = null) {
    let totalCorr = 0;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (let i = 0; i < this.statics.length; i++) {
        const c = this.statics[i];
        pushed = this._push(pos, r, c) || pushed;
      }
      if (dynamics) {
        for (let i = 0; i < dynamics.length; i++) {
          const d = dynamics[i];
          if (d.skip) continue;
          pushed = this._push(pos, r, d) || pushed;
        }
      }
      if (!pushed) break;
      totalCorr += 1;
      if (totalCorr >= 3) break;
    }
  }

  _push(pos, r, c) {
    if (c.type === 'circle') {
      const dx = pos.x - c.x;
      const dz = pos.z - c.z;
      const min = r + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 === 0) return false;
      const d = Math.sqrt(d2);
      const overlap = Math.min(min - d, 0.5); // clamp per-push correction
      pos.x += (dx / d) * overlap;
      pos.z += (dz / d) * overlap;
      return true;
    }
    // AABB: closest-point — handles corners smoothly by construction.
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    if (d2 === 0) {
      // center inside the box: push out the nearest face
      const left = pos.x - c.minX, right = c.maxX - pos.x;
      const near = pos.z - c.minZ, far = c.maxZ - pos.z;
      const m = Math.min(left, right, near, far);
      if (m === left) pos.x = c.minX - r;
      else if (m === right) pos.x = c.maxX + r;
      else if (m === near) pos.z = c.minZ - r;
      else pos.z = c.maxZ + r;
      return true;
    }
    const d = Math.sqrt(d2);
    const overlap = Math.min(r - d, 0.5);
    pos.x += (dx / d) * overlap;
    pos.z += (dz / d) * overlap;
    return true;
  }

  // True if a circle at (x,z,r) would overlap anything (spawn checks).
  overlaps(x, z, r) {
    const p = { x, z };
    for (const c of this.statics) {
      if (c.type === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z, min = r + c.r;
        if (dx * dx + dz * dz < min * min) return true;
      } else {
        const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
        const dx = p.x - cx, dz = p.z - cz;
        if (dx * dx + dz * dz < r * r) return true;
      }
    }
    return false;
  }
}
