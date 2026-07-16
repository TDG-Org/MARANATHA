import * as THREE from 'three';
import { mulberry32, mergeGeometries } from '../../engine/world.js';

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
    const headGeo = new THREE.SphereGeometry(0.14, 7, 5);
    headGeo.scale(1, 1.15, 1.3);
    headGeo.translate(0, 0.5, 0.42);

    this.total = count + strays.length;
    this.bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshBasicMaterial({ color: 0xefe9dc, fog: true }), this.total);
    this.heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0x5a4d3f, fog: true }), this.total);
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
      phase: this.rnd() * Math.PI * 2,
      circle: { type: 'circle', x, z, r: 0.42 },
    };
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
        // HERD: trot ahead of the player, biased toward the pen gate/center.
        // D3 tuning: wider herd radius + stronger pen bias — lambs are EASY.
        // Two-stage waypoint: a sheep still EAST of the gate line swings to a
        // point OUTSIDE the gate first (aiming straight at "inside" drove it
        // into the south/east fence, where it ground against the rails).
        const gm = (this.pen.gate.z0 + this.pen.gate.z1) / 2;
        let gateInX, gateInZ;
        if (this._inPen(s.x, s.z)) {
          gateInX = (this.pen.minX + this.pen.maxX) / 2;
          gateInZ = (this.pen.minZ + this.pen.maxZ) / 2;
        } else if (s.x > this.pen.minX - 0.2 && (s.z < this.pen.gate.z0 || s.z > this.pen.gate.z1)) {
          gateInX = this.pen.minX - 1.5; // round the corner to the gate mouth
          gateInZ = gm;
        } else {
          gateInX = this.pen.minX + 1.6; // straight through the opening
          gateInZ = gm;
        }
        let ax = dxp, az = dzp; // away from player
        const al = Math.hypot(ax, az) || 1;
        ax /= al; az /= al;
        let bx = gateInX - s.x, bz = gateInZ - s.z; // toward pen
        const bl = Math.hypot(bx, bz) || 1;
        bx /= bl; bz /= bl;
        const mix = 0.58; // away + pen bias (was 0.45 — strays now lead you in)
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
        s.x += s.vx * s001;
        s.z += s.vz * s001;
        s.circle.skip = true; // don't collide with self
        this.world.resolve(s, 0.42, null);
        s.circle.skip = false;
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
    this.heads.geometry.dispose();
    this.heads.material.dispose();
    this.bodies.parent?.remove(this.bodies);
    this.heads.parent?.remove(this.heads);
  }
}
