// Movement collision (collision-physics skill): characters are circles on the
// XZ plane; obstacles are circles or AABBs. Move-then-resolve with exact
// push-out along the contact normal — tangential motion survives (that IS the
// slide), so there's no sticking and no jitter. No physics engine.
export class ColliderWorld {
  constructor() {
    this.statics = []; // {type:'circle',x,z,r} | {type:'aabb',minX,minZ,maxX,maxZ}
    // Monotonic topology version for idle-body collision gates. Static
    // colliders are immutable after add in Scene 1; add/clear are the only
    // operations that can invalidate an already-resolved stationary body.
    this.revision = 0;
  }

  add(c) {
    this.statics.push(c);
    this.revision += 1;
    return c;
  }
  addCircle(x, z, r) { return this.add({ type: 'circle', x, z, r }); }
  addAABB(minX, minZ, maxX, maxZ) { return this.add({ type: 'aabb', minX, minZ, maxX, maxZ }); }
  clear() {
    this.statics.length = 0;
    this.revision += 1;
  }

  // Resolve a moving circle at pos {x,z} with radius r against all statics
  // (+ optional dynamic circles like NPCs). Mutates pos. ≤3 iterations; total
  // correction clamped so bad data can never teleport anyone.
  resolve(pos, r, dynamics = null) {
    let totalCorr = 0;
    let settled = false;
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
      if (!pushed) {
        settled = true;
        break;
      }
      totalCorr += 1;
      if (totalCorr >= 3) break;
    }
    // False is conservative: the third correction may have fully separated
    // the body, but one cheap follow-up resolve proves it before an idle gate
    // marks the static world clean.
    return settled;
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

  // Cheap idle-body guard: true only when resolve() would move pos against
  // one of the supplied live colliders. This deliberately mirrors _push's
  // contact rules, including its exact-center circle no-op, but never scans
  // the (much larger) static world.
  hasResolvableOverlap(pos, r, dynamics) {
    if (!dynamics) return false;
    for (let i = 0; i < dynamics.length; i++) {
      const c = dynamics[i];
      if (c.skip) continue;
      if (c.type === 'circle') {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const min = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 !== 0) return true;
        continue;
      }
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  // True if a circle at (x,z,r) would overlap anything (spawn checks). Pass
  // skipGroup to ignore a family of colliders (e.g. 'border' so clustering
  // rocks/trees don't count as overlapping each other).
  overlaps(x, z, r, skipGroup = null) {
    const p = { x, z };
    for (const c of this.statics) {
      if (skipGroup && c.group === skipGroup) continue;
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

// One allocation per moving body, zero allocations per frame. A body needs a
// full static-world resolve only after it moved/teleported, the static topology
// changed, or a live collider moved into it. ColliderWorld-like test doubles
// without the cheap overlap query conservatively keep the legacy behavior.
export class CollisionGate {
  constructor() {
    this.x = NaN;
    this.z = NaN;
    this.revision = -1;
  }

  needsResolve(world, pos, r, dynamics = null) {
    const revision = world.revision ?? 0;
    if (pos.x !== this.x || pos.z !== this.z || revision !== this.revision) return true;
    if (!dynamics?.length) return false;
    if (typeof world.hasResolvableOverlap !== 'function') return true;
    return world.hasResolvableOverlap(pos, r, dynamics);
  }

  commit(world, pos) {
    this.x = pos.x;
    this.z = pos.z;
    this.revision = world.revision ?? 0;
  }
}
