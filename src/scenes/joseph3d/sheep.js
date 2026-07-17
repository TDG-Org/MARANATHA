import * as THREE from 'three';
import { mulberry32, mergeGeometries, toonMat } from '../../engine/world.js';

// The camp flock: instanced low-poly sheep (2 draw calls total — bodies +
// heads), graze-wander loops, and the HERD mechanic: walk near a stray and it
// trots ahead of you, biased toward the pen; crossing the pen counts it.
// Sheep are dynamic collision circles so the player can't walk through them.
export class SheepFlock {
  constructor({ scene, colliderWorld, pen, bounds, count = 10, strays = [], seed = 55, onPenned = null }) {
    this.pen = pen;
    this.bounds = bounds;
    this.world = colliderWorld;
    this.onPenned = onPenned;
    this.rnd = mulberry32(seed);

    // --- geometry: woolly body (merged lumps) + dark head, two instanced meshes
    const lumps = [];
    const mk = (r, x, y, z) => { const g = new THREE.SphereGeometry(r, 7, 5); g.translate(x, y, z); return g; };
    lumps.push(mk(0.34, 0, 0.52, 0), mk(0.27, 0.22, 0.6, 0.1), mk(0.27, -0.2, 0.58, -0.08), mk(0.22, 0, 0.45, 0.22), mk(0.2, 0.05, 0.48, -0.24));
    [-0.16, 0.16].forEach((x) => [-0.14, 0.16].forEach((z) => lumps.push((() => { const g = new THREE.CylinderGeometry(0.045, 0.05, 0.3, 5); g.translate(x, 0.15, z); return g; })())));
    const bodyGeo = mergeGeometries(lumps);
    // The minimal merge drops normals; a LIT (toon) material with no normals
    // renders BLACK. Regenerate them — this is why the sheep were turning dark.
    bodyGeo.computeVertexNormals();
    const headGeo = new THREE.SphereGeometry(0.14, 7, 5);
    headGeo.scale(1, 1.15, 1.3);
    headGeo.translate(0, 0.5, 0.42);

    this.total = count + strays.length;
    // emissive base keeps the wool WHITE even in low light (never goes dark).
    this.bodies = new THREE.InstancedMesh(bodyGeo, toonMat(0xf6f1e6, { emissive: 0x59544b }), this.total);
    this.heads = new THREE.InstancedMesh(headGeo, toonMat(0x5a4d3f), this.total);
    scene.add(this.bodies, this.heads);

    this._d = new THREE.Object3D();
    this.sheep = [];
    // penned starters graze inside the pen; strays start outside (the objective)
    for (let i = 0; i < count; i++) {
      this.sheep.push(this._make(
        pen.minX + 1 + this.rnd() * (pen.maxX - pen.minX - 2),
        pen.minZ + 1 + this.rnd() * (pen.maxZ - pen.minZ - 2),
        true,
      ));
    }
    for (const s of strays) this.sheep.push(this._make(s.x, s.z, false));
    this.pennedCount = 0; // counts STRAYS that got penned
    this.dynamics = this.sheep.map((s) => s.circle); // for the player controller
    this._writeAll();
  }

  _make(x, z, penned) {
    return {
      x, z, yaw: this.rnd() * Math.PI * 2, penned,
      counted: penned, // strays count when they enter
      lamb: !penned,   // strays read as LAMBS — smaller, easier to spot
      state: 'graze', vx: 0, vz: 0,
      timer: 600 + this.rnd() * 2200, walk: 0,
      stuckT: 0,       // ms of near-zero real movement while trying to move
      phase: this.rnd() * Math.PI * 2,
      circle: { type: 'circle', x, z, r: 0.42 },
    };
  }

  // Whisker steering: if a prop sits straight ahead, turn the velocity toward
  // the clearer side so the sheep flows AROUND it instead of grinding on it.
  _avoid(s) {
    const spd = Math.hypot(s.vx, s.vz);
    if (spd < 0.05) return;
    const dirx = s.vx / spd, dirz = s.vz / spd;
    const look = 1.0;
    const blocked = (ang) => {
      const c = Math.cos(ang), sn = Math.sin(ang);
      const rx = dirx * c - dirz * sn;
      const rz = dirx * sn + dirz * c;
      return this.world.overlaps(s.x + rx * look, s.z + rz * look, 0.45);
    };
    if (!blocked(0)) return; // clear ahead
    const leftClear = !blocked(-0.7);
    const rightClear = !blocked(0.7);
    let turn;
    if (leftClear && !rightClear) turn = -0.9;
    else if (rightClear && !leftClear) turn = 0.9;
    else turn = s.phase > Math.PI ? 0.9 : -0.9; // both blocked: commit one way
    const c = Math.cos(turn), sn = Math.sin(turn);
    s.vx = (dirx * c - dirz * sn) * spd;
    s.vz = (dirx * sn + dirz * c) * spd;
  }

  get straysLeft() {
    return this.sheep.filter((s) => !s.counted).length;
  }

  nearestStray(px, pz) {
    let best = null, bd = Infinity;
    for (const s of this.sheep) {
      if (s.counted) continue;
      const d = Math.hypot(s.x - px, s.z - pz);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  _inPen(x, z) {
    const p = this.pen;
    return x > p.minX + 0.3 && x < p.maxX - 0.3 && z > p.minZ + 0.3 && z < p.maxZ - 0.3;
  }

  update(dt, playerPos, t) {
    const s001 = dt * 0.001;
    for (const s of this.sheep) {
      const dxp = s.x - playerPos.x;
      const dzp = s.z - playerPos.z;
      const pd2 = dxp * dxp + dzp * dzp;

      if (!s.counted && pd2 < 3.3 * 3.3) {
        // HERD: trot ahead of the player, biased toward the pen. D7 ROUTING —
        // STATELESS CORNER NAVIGATION: the old logic aimed at the gate mouth
        // in a straight line, which from north/east of the pen ran THROUGH the
        // fences (sheep ground along "the other side angle" forever). Now the
        // sheep always aims at the next point AROUND an inflated pen rect:
        //   inside the pen        → the pen centre
        //   west of the pen       → the gate mouth, then straight in
        //   north/south strip     → the NW/SW outer corner (then west → mouth)
        //   east strip            → the nearer NE/SE outer corner (→ N/S → …)
        // Each region hands off to the next as the sheep moves — self-healing,
        // no straight line ever crosses a fence.
        const p = this.pen;
        const gm = (p.gate.z0 + p.gate.z1) / 2;
        const M = 1.4; // routing margin around the fences
        let gateInX, gateInZ;
        if (this._inPen(s.x, s.z)) {
          gateInX = (p.minX + p.maxX) / 2;
          gateInZ = (p.minZ + p.maxZ) / 2;
        } else if (s.x < p.minX - 0.2) {
          // WEST of the fence line: the straight shot is legal
          if (s.z > p.gate.z0 - 0.6 && s.z < p.gate.z1 + 0.6 && s.x > p.minX - 2.6) {
            gateInX = p.minX + 1.7; gateInZ = gm;   // through the opening
          } else {
            gateInX = p.minX - 1.3; gateInZ = gm;   // to the gate mouth first
          }
        } else if (s.z > p.maxZ + 0.2) {
          gateInX = p.minX - M; gateInZ = p.maxZ + M;   // NW outer corner
        } else if (s.z < p.minZ - 0.2) {
          gateInX = p.minX - M; gateInZ = p.minZ - M;   // SW outer corner
        } else {
          // EAST of the pen: that strip is SEALED terrain now (D7 — it was a
          // dead-end trap between fence and treeline). If a sheep somehow
          // starts here, send it south out of the old mouth, then the south
          // region takes over.
          gateInX = p.maxX + 0.6; gateInZ = p.minZ - M;
        }
        // routing targets must live INSIDE the world bounds — the east strip is
        // only ~1.3u wide, and an out-of-bounds corner point is unreachable
        // (the sheep grinds on the clamp forever — Nate's stuck report)
        gateInX = Math.max(this.bounds.minX + 0.6, Math.min(this.bounds.maxX - 0.6, gateInX));
        gateInZ = Math.max(this.bounds.minZ + 0.6, Math.min(this.bounds.maxZ - 0.6, gateInZ));
        let ax = dxp, az = dzp; // away from player
        const al = Math.hypot(ax, az) || 1;
        ax /= al; az /= al;
        let bx = gateInX - s.x, bz = gateInZ - s.z; // toward the route point
        const bl = Math.hypot(bx, bz) || 1;
        bx /= bl; bz /= bl;
        // the route leads MORE than the player pushes — the lamb shows the way
        const mix = 0.66;
        let dx = ax * (1 - mix) + bx * mix;
        let dz = az * (1 - mix) + bz * mix;
        const dl = Math.hypot(dx, dz) || 1;
        s.vx = (dx / dl) * 2.7;
        s.vz = (dz / dl) * 2.7;
        s.state = 'flee';
        s.timer = 500;
      } else if (s.state === 'flee') {
        // ease down after the player backs off
        s.vx *= Math.max(0, 1 - s001 * 1.4);
        s.vz *= Math.max(0, 1 - s001 * 1.4);
        if (Math.hypot(s.vx, s.vz) < 0.2) s.state = 'graze';
      } else {
        // graze-wander: short steps, long pauses (npc-life)
        s.timer -= dt;
        if (s.timer <= 0) {
          if (Math.hypot(s.vx, s.vz) > 0.05) {
            s.vx = 0; s.vz = 0;
            s.timer = 900 + this.rnd() * 2600;
          } else {
            const a = this.rnd() * Math.PI * 2;
            const sp = 0.55 + this.rnd() * 0.35;
            s.vx = Math.cos(a) * sp;
            s.vz = Math.sin(a) * sp;
            s.timer = 700 + this.rnd() * 900;
          }
        }
      }

      // integrate + collide (sheep respect props/fences too)
      if (s.vx || s.vz) {
        this._avoid(s); // steer around props before committing the step
        const px0 = s.x, pz0 = s.z;
        s.x += s.vx * s001;
        s.z += s.vz * s001;
        s.circle.skip = true; // don't collide with self
        this.world.resolve(s, 0.42, null);
        s.circle.skip = false;
        // UNSTICK: if a fleeing sheep is pinned (barely moved for ~2s), redirect
        // it along the perpendicular to slip past whatever it's caught on.
        const intended = Math.hypot(s.vx, s.vz) * s001;
        const moved = Math.hypot(s.x - px0, s.z - pz0);
        if (s.state === 'flee' && intended > 0.001 && moved < intended * 0.3) {
          s.stuckT += dt;
          if (s.stuckT > 1300) {
            const sp = Math.hypot(s.vx, s.vz) || 1;
            const side = s.phase > Math.PI ? 1 : -1;    // consistent per sheep
            const nx = (-s.vz / sp) * side;             // unit perpendicular
            const nz = (s.vx / sp) * side;
            s.vx = nx * 2.2;
            s.vz = nz * 2.2;
            s.stuckT = 0;
          }
        } else {
          s.stuckT = 0;
        }
        // keep penned grazers inside; clamp everyone to bounds
        const b = this.bounds;
        s.x = Math.min(b.maxX, Math.max(b.minX, s.x));
        s.z = Math.min(b.maxZ, Math.max(b.minZ, s.z));
        if (s.counted) {
          s.x = Math.min(this.pen.maxX - 0.5, Math.max(this.pen.minX + 0.5, s.x));
          s.z = Math.min(this.pen.maxZ - 0.5, Math.max(this.pen.minZ + 0.5, s.z));
        }
        const speed = Math.hypot(s.vx, s.vz);
        if (speed > 0.1) {
          s.yaw += (Math.atan2(s.vx, s.vz) - s.yaw) * Math.min(s001 * 8, 1);
          s.walk += speed * s001 * 6;
        }
        // stray newly inside the pen → counted
        if (!s.counted && this._inPen(s.x, s.z)) {
          s.counted = true;
          s.penned = true;
          this.pennedCount += 1;
          this.onPenned?.(this.pennedCount, this);
        }
      }
      s.circle.x = s.x;
      s.circle.z = s.z;
    }
    this._writeAll(t);
  }

  _writeAll(t = 0) {
    const d = this._d;
    this.sheep.forEach((s, i) => {
      const bob = Math.abs(Math.sin(s.walk * Math.PI + s.phase)) * 0.05;
      const breathe = 1 + Math.sin(t * 1.6 + s.phase) * 0.02;
      const size = s.lamb ? 0.74 : 1; // lambs stay small even once penned
      d.position.set(s.x, bob, s.z);
      d.rotation.set(0, s.yaw, 0);
      d.scale.set(size, size * breathe, size);
      d.updateMatrix();
      this.bodies.setMatrixAt(i, d.matrix);
      this.heads.setMatrixAt(i, d.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.bodies.geometry.dispose();
    this.bodies.material.dispose();
    this.bodies.dispose(); // frees the instanceMatrix GPU buffer
    this.heads.geometry.dispose();
    this.heads.material.dispose();
    this.heads.dispose();
    this.bodies.parent?.remove(this.bodies);
    this.heads.parent?.remove(this.heads);
  }
}
