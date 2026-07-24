import { mulberry32 } from '../../engine/world.js';
import { abortReason } from '../../core/async.js';
import { CollisionGate } from '../../engine/collision.js';

// The Joseph cast (character-design): distinct silhouette base + 1–2 signature
// colors per named person, all from the two shared KayKit rigs. Plus the
// ambient-NPC driver (npc-life): idle loops, micro-actions, small wanders —
// nobody statue-freezes.
export const NAME_COLOR = {
  Joseph: '#ecd9a4', Jacob: '#e0b877', Reuben: '#93a8cc', Judah: '#d8ac68',
  Simeon: '#a8bd8f', Levi: '#c9a3b2',
};

// Likeness pass (D3, design LOCKED — features only): Jacob reads ELDERLY
// (gray-wool robe, white beard, staff, slower walk, slightly stooped scale);
// Joseph reads YOUNGEST (smallest of the men, bright cream); the four named
// brothers get distinct builds — Reuben broad (firstborn), Judah solid gold-
// brown, Simeon lean olive, Levi plum.
const CAST = {
  // Joseph: bright cream robe + a plain BROWN leather belt (D8 — Nate's call;
  // worn geometry on the spine bone) + a cream HEADBAND with a terracotta tail
  // (cared-for but humble; clearly the finest only once the coat is gifted).
  // The coat leads with a true DARK red among the earth dyes (D8).
  joseph: { name: 'Joseph', base: 'robed', scale: 0.97, colors: { robe: 0xe2d3a9, robeShade: 0xbfb083, skin: 0xcf9a63, belt: 0x5f4128, headband: 0xe8dcc0, headbandTail: 0xc2703a, coat: [0x841b10, 0xcf8a2c, 0x2c3f78, 0x6b7038, 0xe8dcc0] } },
  jacob: { name: 'Jacob', base: 'robed', staff: true, elder: true, scale: 0.9, colors: { robe: 0x8b8177, robeShade: 0x6d645a, skin: 0xb98a55 } },
  reuben: { name: 'Reuben', base: 'hooded', scale: 1.06, colors: { robe: 0x4f627e, robeShade: 0x3c4d64, skin: 0xc98d5a } },
  judah: { name: 'Judah', base: 'robed', scale: 1.03, colors: { robe: 0x9c6a34, robeShade: 0x7d5228, skin: 0xc07d45 } },
  simeon: { name: 'Simeon', base: 'hooded', scale: 0.98, colors: { robe: 0x5f6d3c, robeShade: 0x49552d, skin: 0xc98d5a } },
  levi: { name: 'Levi', base: 'robed', scale: 1.01, colors: { robe: 0x7a5568, robeShade: 0x604253, skin: 0xb98a55 } },
};

// Robe VARIETY (D5): no more same-y green — a clear spread of dark green,
// brown, dark gray, olive, red-brown and slate across the camp NPCs.
const GENERIC = [
  { base: 'hooded', colors: { robe: 0x47562f, robeShade: 0x36421f } }, // dark green
  { base: 'robed', colors: { robe: 0x6a4a32, robeShade: 0x513724 } },  // brown
  { base: 'hooded', colors: { robe: 0x474950, robeShade: 0x36383f } }, // dark gray
  { base: 'robed', colors: { robe: 0x5d6a4a, robeShade: 0x485338 } },  // olive
  { base: 'hooded', colors: { robe: 0x6e4c3e, robeShade: 0x54382d } }, // red-brown
  { base: 'robed', colors: { robe: 0x54545f, robeShade: 0x41414b } },  // slate gray
];

export function buildNamed(factory, key) {
  const c = CAST[key];
  return factory.create({ name: c.name, base: c.base, colors: c.colors, staff: c.staff, elder: c.elder, scale: 0.8 * (c.scale ?? 1) });
}

export function buildGenericBrother(factory, i) {
  const g = GENERIC[i % GENERIC.length];
  return factory.create({ name: `Brother`, base: g.base, colors: { skin: 0xc98d5a, ...g.colors }, scale: 0.8 * (0.96 + (i % 3) * 0.03) });
}

export function buildWorker(factory, i, child = false) {
  const g = GENERIC[(i + 2) % GENERIC.length];
  return factory.create({
    name: child ? 'Child' : 'Worker', base: 'hooded', hoodIsCloth: true,
    colors: { skin: 0xbf8a55, ...g.colors },
    scale: child ? 0.5 : 0.78,
  });
}

// --- ambient NPC life (npc-life skill) --------------------------------------
// npc: { char, home:{x,z}, wanderR, faceTo?, gesture? } — small wanders, long
// pauses, occasional talk-gesture; movement respects the collider world.
export class AmbientNPCs {
  constructor(colliderWorld, { seed = 91, signal = null } = {}) {
    this.world = colliderWorld;
    this.rnd = mulberry32(seed);
    this.signal = signal;
    this.npcs = [];
    this._circles = []; // shared dynamics list (NPC-vs-NPC separation)
    this._onAbort = () => this.cancelMoves(abortReason(signal));
    signal?.addEventListener('abort', this._onAbort, { once: true });
  }

  add(char, { x, z, wanderR = 2.2, gestureEvery = 9000, canWander = true, speed = 1.1 } = {}) {
    char.setPosition(x, z);
    const npc = {
      char, home: { x, z }, wanderR, canWander, speed,
      target: null, onArrive: null, timer: 800 + this.rnd() * 2600,
      gestureT: gestureEvery * (0.5 + this.rnd()), gestureEvery,
      gestureLeft: 0,
      stuckT: 0,
      pos: { x, z }, circle: { type: 'circle', x, z, r: 0.4 },
      collisionGate: new CollisionGate(),
    };
    this.npcs.push(npc);
    this._circles.push(npc.circle);
    return npc;
  }

  get dynamics() { return this.npcs.map((n) => n.circle); }

  // A wander target must be standable — never inside a prop, fire, or fence.
  _pickTarget(n) {
    for (let tries = 0; tries < 4; tries++) {
      const a = this.rnd() * Math.PI * 2;
      const r = 0.8 + this.rnd() * n.wanderR;
      const x = n.home.x + Math.cos(a) * r;
      const z = n.home.z + Math.sin(a) * r;
      if (!this.world.overlaps(x, z, 0.45)) return { x, z };
    }
    return null; // crowded spot — stay put this round
  }

  // Choreography: send an NPC somewhere (campfire ring, tent door…). Resolves
  // when they arrive (or give up against a blocker). Overrides wandering.
  sendTo(npc, x, z, { speed = null } = {}) {
    if (this.signal?.aborted) return Promise.reject(abortReason(this.signal));
    npc.onArrive?.resolve?.(false); // a newer order safely supersedes the old
    return new Promise((resolve, reject) => {
      npc.target = { x, z, scripted: true, speed };
      npc.stuckT = 0;
      npc.onArrive = { resolve, reject };
    });
  }

  _arrive(n) {
    n.target = null;
    n.timer = 1400 + this.rnd() * 3200;
    n.stuckT = 0;
    n.char.play('idle');
    const op = n.onArrive;
    n.onArrive = null;
    op?.resolve?.(true);
  }

  update(dt, playerPos = null, activeRadius = Infinity) {
    const s001 = dt * 0.001;
    const activeR2 = activeRadius * activeRadius;
    for (const n of this.npcs) {
      const c = n.char;
      const dxPlayer = playerPos ? n.pos.x - playerPos.x : 0;
      const dzPlayer = playerPos ? n.pos.z - playerPos.z : 0;
      const playerD2 = dxPlayer * dxPlayer + dzPlayer * dzPlayer;
      // Off-stage life pauses instead of burning mixers, collision queries,
      // timers and bone uploads behind fog/black transitions. Scripted actors
      // are staged beside Joseph before their visible action begins, so this
      // conservative radius never interrupts choreography.
      if (playerPos && playerD2 > activeR2) {
        c.animLOD = 2;
        continue;
      }
      // D9 anim LOD: background NPCs far from the player mix animation at 1/3
      // rate. Frozen NPCs are CUTSCENE ACTORS — always full rate, wherever the
      // player happens to be teleported.
      if (n.frozen) c.animLOD = 0;
      else if (playerPos) {
        c.animLOD = playerD2 > 324 ? 2 : 0; // beyond 18u
      }
      if (n.frozen) { c.update(dt); continue; } // beats can freeze/choreograph
      let collisionResolved = false;
      let collisionSettled = false;

      // Gesture holds belong to the governed scene clock. The former
      // setTimeout could wake and change animation behind pause/hidden/offstage
      // states even though the render loop correctly slept.
      if (n.gestureLeft > 0) {
        n.gestureLeft = Math.max(0, n.gestureLeft - dt);
        if (n.gestureLeft === 0 && c.state === 'talk') c.play('idle');
      }
      n.gestureT -= dt;
      if (n.gestureT <= 0 && n.gestureLeft === 0 && !n.target) {
        n.gestureT = n.gestureEvery * (0.7 + this.rnd() * 0.8);
        n.gestureLeft = 1400 + this.rnd() * 900;
        c.play('talk');
      }

      // wander
      n.timer -= dt;
      if (n.timer <= 0 && n.canWander && !n.target && c.state !== 'talk') {
        n.target = this._pickTarget(n);
        if (!n.target) n.timer = 1600 + this.rnd() * 2400;
      }
      if (n.target) {
        const dx = n.target.x - n.pos.x;
        const dz = n.target.z - n.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) {
          this._arrive(n);
        } else {
          const sp = n.target.speed ?? n.speed;
          const ox = n.pos.x, oz = n.pos.z;
          n.pos.x += (dx / d) * sp * s001;
          n.pos.z += (dz / d) * sp * s001;
          // resolve vs statics AND the other NPCs (skip self) — bodies never merge
          n.circle.skip = true;
          collisionSettled = this.world.resolve(n.pos, 0.4, this._circles) !== false;
          n.circle.skip = false;
          collisionResolved = true;
          // Animation follows REAL movement; blocked = no walk-in-place, and a
          // sustained block abandons the target instead of grinding on a prop.
          const stepped = Math.hypot(n.pos.x - ox, n.pos.z - oz);
          const wanted = sp * s001;
          if (stepped < wanted * 0.25) {
            n.stuckT += dt;
            c.play('idle');
            if (n.stuckT > 550) this._arrive(n);
          } else {
            n.stuckT = 0;
            c.turnToward(dx, dz);
            c.play('walk');
          }
        }
      } else {
        // A stationary NPC already resolved against immutable statics does not
        // rescan the whole world. Live circles are still checked cheaply, so a
        // sheep/NPC moving into this body gets the same next-update response.
        n.circle.skip = true;
        if (n.collisionGate.needsResolve(this.world, n.pos, 0.4, this._circles)) {
          collisionSettled = this.world.resolve(n.pos, 0.4, this._circles) !== false;
          collisionResolved = true;
        }
        n.circle.skip = false;
      }
      n.circle.x = n.pos.x;
      n.circle.z = n.pos.z;
      if (collisionResolved && collisionSettled) n.collisionGate.commit(this.world, n.pos);
      c.setPosition(n.pos.x, n.pos.z);
      c.update(dt);
    }
  }

  // Freeze for a cutscene: stop the walk/run cycle immediately (a frozen NPC
  // must never moon-walk in place). The beat sets talk/idle + facing itself.
  freeze(npc, on = true) {
    npc.frozen = on;
    if (on && (npc.char.state === 'walk' || npc.char.state === 'run')) npc.char.play('idle');
  }

  cancelMoves(error = null) {
    for (const n of this.npcs) {
      const op = n.onArrive;
      n.onArrive = null;
      n.target = null;
      n.stuckT = 0;
      if (error) op?.reject?.(error); else op?.resolve?.(false);
    }
  }

  dispose() {
    this.cancelMoves(this.signal?.aborted ? abortReason(this.signal) : null);
    this.signal?.removeEventListener('abort', this._onAbort);
    this.npcs.length = 0;
    this._circles.length = 0;
  }
}
