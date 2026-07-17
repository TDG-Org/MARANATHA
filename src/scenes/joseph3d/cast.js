import { mulberry32 } from '../../engine/world.js';

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
  joseph: { name: 'Joseph', base: 'robed', scale: 0.97, colors: { robe: 0xd9cba6, robeShade: 0xb5a67f, skin: 0xcf9a63, coat: [0xb5643c, 0xcf9a4e, 0x6f8256, 0x8a5a72, 0x3f7a86] } },
  jacob: { name: 'Jacob', base: 'robed', staff: true, elder: true, scale: 0.9, colors: { robe: 0x8b8177, robeShade: 0x6d645a, skin: 0xb98a55 } },
  reuben: { name: 'Reuben', base: 'hooded', scale: 1.06, colors: { robe: 0x5a6b86, robeShade: 0x47566e, skin: 0xc98d5a } },
  judah: { name: 'Judah', base: 'robed', scale: 1.03, colors: { robe: 0xa9773f, robeShade: 0x8a5f31, skin: 0xc07d45 } },
  simeon: { name: 'Simeon', base: 'hooded', scale: 0.98, colors: { robe: 0x77804f, robeShade: 0x5f6640, skin: 0xc98d5a } },
  levi: { name: 'Levi', base: 'robed', scale: 1.01, colors: { robe: 0x8a6a7d, robeShade: 0x705364, skin: 0xb98a55 } },
};

const GENERIC = [
  { base: 'hooded', colors: { robe: 0x7a6a56, robeShade: 0x5f5344 } },
  { base: 'robed', colors: { robe: 0x6b5d6e, robeShade: 0x544857 } },
  { base: 'hooded', colors: { robe: 0x8a7a5a, robeShade: 0x6d6046 } },
  { base: 'robed', colors: { robe: 0x5d6e63, robeShade: 0x49584f } },
  { base: 'hooded', colors: { robe: 0x86675a, robeShade: 0x6a5147 } },
  { base: 'robed', colors: { robe: 0x707a86, robeShade: 0x59616b } },
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
  constructor(colliderWorld, seed = 91) {
    this.world = colliderWorld;
    this.rnd = mulberry32(seed);
    this.npcs = [];
    this._circles = []; // shared dynamics list (NPC-vs-NPC separation)
  }

  add(char, { x, z, wanderR = 2.2, gestureEvery = 9000, canWander = true, speed = 1.1 } = {}) {
    char.setPosition(x, z);
    const npc = {
      char, home: { x, z }, wanderR, canWander, speed,
      target: null, onArrive: null, timer: 800 + this.rnd() * 2600,
      gestureT: gestureEvery * (0.5 + this.rnd()), gestureEvery,
      stuckT: 0,
      pos: { x, z }, circle: { type: 'circle', x, z, r: 0.4 },
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
    return new Promise((resolve) => {
      npc.target = { x, z, scripted: true, speed };
      npc.stuckT = 0;
      npc.onArrive = resolve;
    });
  }

  _arrive(n) {
    n.target = null;
    n.timer = 1400 + this.rnd() * 3200;
    n.stuckT = 0;
    n.char.play('idle');
    const cb = n.onArrive;
    n.onArrive = null;
    cb?.();
  }

  update(dt) {
    const s001 = dt * 0.001;
    for (const n of this.npcs) {
      const c = n.char;
      if (n.frozen) { c.update(dt); continue; } // beats can freeze/choreograph

      // gesture micro-action
      n.gestureT -= dt;
      if (n.gestureT <= 0 && !n.target) {
        n.gestureT = n.gestureEvery * (0.7 + this.rnd() * 0.8);
        c.play('talk');
        setTimeout(() => { if (!n.frozen && c.state === 'talk') c.play('idle'); }, 1400 + this.rnd() * 900);
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
          this.world.resolve(n.pos, 0.4, this._circles);
          n.circle.skip = false;
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
        // idle separation: if someone was pushed into us, ease back apart
        n.circle.skip = true;
        this.world.resolve(n.pos, 0.4, this._circles);
        n.circle.skip = false;
      }
      n.circle.x = n.pos.x;
      n.circle.z = n.pos.z;
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
  dispose() { this.npcs.length = 0; this._circles.length = 0; }
}
