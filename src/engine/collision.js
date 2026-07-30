// Movement collision (collision-physics skill): characters are circles on the
// XZ plane; obstacles are circles or AABBs. Move-then-resolve with exact
// push-out along the contact normal — tangential motion survives (that IS the
// slide), so there's no sticking and no jitter. No physics engine.
// A camp holds ~170 static colliders (the treeline alone is ~95). Testing a
// body against all of them was fine for one player, but the flock asks the same
// question up to four times per sheep per frame, so the scan was the largest
// single script cost in the scene. The world keeps a uniform grid instead: a
// body only ever meets the handful of colliders sharing its cells.
//
// 3 units is a little wider than the biggest ordinary collider, so most props
// land in one or two cells and a body's query touches four.
const CELL = 3;
// Anything sprawling (a bounds box, a long fence run) would otherwise be
// stamped into hundreds of cells. Those few are simply always considered.
const MAX_CELLS_PER_COLLIDER = 64;
const KEY_BIAS = 32768; // cell coords are tiny; this keeps the packed key unique
const RESOLVE_QUERY_PAD = 1.5; // per-push clamp (0.5) x the 3 pushes an iteration allows

export class ColliderWorld {
  constructor() {
    this.statics = []; // {type:'circle',x,z,r} | {type:'aabb',minX,minZ,maxX,maxZ}
    // Monotonic topology version for idle-body collision gates. Static
    // colliders are immutable after add in Scene 1; add/clear are the only
    // operations that can invalidate an already-resolved stationary body.
    this.revision = 0;
    this._grid = new Map();      // packed cell key -> array of static indices
    this._oversized = [];        // colliders too big to bucket usefully
    this._gridRevision = -1;
    this._seen = new Int32Array(0); // per-static "already collected" stamps
    this._stamp = 0;
    this._cand = [];             // reused candidate scratch — no per-query alloc
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

  // --- spatial index ---------------------------------------------------------
  static _bounds(c) {
    return c.type === 'circle'
      ? { minX: c.x - c.r, minZ: c.z - c.r, maxX: c.x + c.r, maxZ: c.z + c.r }
      : { minX: c.minX, minZ: c.minZ, maxX: c.maxX, maxZ: c.maxZ };
  }

  _ensureIndex() {
    if (this._gridRevision === this.revision) return;
    this._gridRevision = this.revision;
    this._grid.clear();
    this._oversized.length = 0;
    if (this._seen.length < this.statics.length) this._seen = new Int32Array(this.statics.length);
    this._seen.fill(0);
    this._stamp = 0;
    for (let i = 0; i < this.statics.length; i++) {
      const b = ColliderWorld._bounds(this.statics[i]);
      const x0 = Math.floor(b.minX / CELL); const x1 = Math.floor(b.maxX / CELL);
      const z0 = Math.floor(b.minZ / CELL); const z1 = Math.floor(b.maxZ / CELL);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > MAX_CELLS_PER_COLLIDER) { this._oversized.push(i); continue; }
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = (cx + KEY_BIAS) * 65536 + (cz + KEY_BIAS);
          const bucket = this._grid.get(key);
          if (bucket) bucket.push(i); else this._grid.set(key, [i]);
        }
      }
    }
  }

  // Fills and returns the reusable candidate array: every static whose footprint
  // could touch the given box. Conservative by construction — a collider is
  // stamped into every cell its own bounds cover.
  //
  // Candidates come back in ADD ORDER, not cell order. resolve() applies pushes
  // one after another and each one moves the body, so the order of the list is
  // part of the answer: iterating cell-by-cell instead of array-by-array moved
  // bodies to measurably different resting places (0.5% of probes). An insertion
  // sort over a handful of indices keeps the result bit-identical to the scan
  // this replaces.
  _near(minX, minZ, maxX, maxZ) {
    this._ensureIndex();
    const out = this._cand;
    out.length = 0;
    const stamp = ++this._stamp;
    const seen = this._seen;
    const x0 = Math.floor(minX / CELL); const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL); const z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const bucket = this._grid.get((cx + KEY_BIAS) * 65536 + (cz + KEY_BIAS));
        if (!bucket) continue;
        for (let b = 0; b < bucket.length; b++) {
          const i = bucket[b];
          if (seen[i] === stamp) continue;
          seen[i] = stamp;
          let j = out.length;
          while (j > 0 && out[j - 1] > i) { out[j] = out[j - 1]; j--; }
          out[j] = i;
        }
      }
    }
    for (let k = 0; k < this._oversized.length; k++) {
      const i = this._oversized[k];
      if (seen[i] === stamp) continue;
      seen[i] = stamp;
      let j = out.length;
      while (j > 0 && out[j - 1] > i) { out[j] = out[j - 1]; j--; }
      out[j] = i;
    }
    return out;
  }

  // Resolve a moving circle at pos {x,z} with radius r against all statics
  // (+ optional dynamic circles like NPCs). Mutates pos. ≤3 iterations, and
  // each individual push is clamped (0.5, in _push) so bad data can never
  // teleport anyone.
  resolve(pos, r, dynamics = null) {
    let settled = false;
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      // Re-queried per iteration, and padded: pushes inside an iteration move
      // the body while the list is being walked, so a collider that was out of
      // range at the top of the pass can be in contact by the bottom of it. The
      // pad is the per-push clamp (0.5) times the three pushes an iteration can
      // apply. tools/test-collision-grid.mjs holds this honest: over 400k probes
      // the grid lands bodies on the same spot as the full scan, to the last
      // bit, for every radius this game uses (0.30 sheep, 0.34 people). A body
      // wider than ~2u wedged inside a dense cluster can out-run the pad; none
      // exists, and the test fails if one is ever introduced.
      const q = r + RESOLVE_QUERY_PAD;
      const near = this._near(pos.x - q, pos.z - q, pos.x + q, pos.z + q);
      for (let i = 0; i < near.length; i++) {
        pushed = this._push(pos, r, this.statics[near[i]]) || pushed;
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
    const near = this._near(x - r, z - r, x + r, z + r);
    for (let i = 0; i < near.length; i++) {
      const c = this.statics[near[i]];
      if (skipGroup && c.group === skipGroup) continue;
      if (c.type === 'circle') {
        const dx = x - c.x, dz = z - c.z, min = r + c.r;
        if (dx * dx + dz * dz < min * min) return true;
      } else {
        const cx = Math.max(c.minX, Math.min(x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
        const dx = x - cx, dz = z - cz;
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
