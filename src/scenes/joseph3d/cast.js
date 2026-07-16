import { mulberry32 } from '../../engine/world.js';

// The Joseph cast (character-design): distinct silhouette base + 1–2 signature
// colors per named person, all from the two shared KayKit rigs. Plus the
// ambient-NPC driver (npc-life): idle loops, micro-actions, small wanders —
// nobody statue-freezes.
export const NAME_COLOR = {
  Joseph: '#ecd9a4', Jacob: '#e0b877', Reuben: '#93a8cc', Judah: '#d8ac68',
  Simeon: '#a8bd8f', Levi: '#c9a3b2',
};

const CAST = {
  joseph: { name: 'Joseph', base: 'robed', colors: { robe: 0xd9cba6, robeShade: 0xb5a67f, skin: 0xcf9a63, coat: [0xb5643c, 0xcf9a4e, 0x6f8256, 0x8a5a72, 0x3f7a86] } },
  jacob: { name: 'Jacob', base: 'robed', staff: true, scale: 0.82, colors: { robe: 0x8a5a3c, robeShade: 0x6e4630, skin: 0xb98a55 } },
  reuben: { name: 'Reuben', base: 'hooded', scale: 0.84, colors: { robe: 0x5a6b86, robeShade: 0x47566e, skin: 0xc98d5a } },
  judah: { name: 'Judah', base: 'robed', colors: { robe: 0xa9773f, robeShade: 0x8a5f31, skin: 0xc07d45 } },
  simeon: { name: 'Simeon', base: 'hooded', colors: { robe: 0x77804f, robeShade: 0x5f6640, skin: 0xc98d5a } },
  levi: { name: 'Levi', base: 'robed', colors: { robe: 0x8a6a7d, robeShade: 0x705364, skin: 0xb98a55 } },
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
  return factory.create({ name: c.name, base: c.base, colors: c.colors, staff: c.staff, scale: 0.8 * (c.scale ?? 1) });
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
  }

  add(char, { x, z, wanderR = 2.2, gestureEvery = 9000, canWander = true } = {}) {
    char.setPosition(x, z);
    const npc = {
      char, home: { x, z }, wanderR, canWander,
      target: null, timer: 800 + this.rnd() * 2600,
      gestureT: gestureEvery * (0.5 + this.rnd()), gestureEvery,
      pos: { x, z }, circle: { type: 'circle', x, z, r: 0.4 },
    };
    this.npcs.push(npc);
    return npc;
  }

  get dynamics() { return this.npcs.map((n) => n.circle); }

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
        const a = this.rnd() * Math.PI * 2;
        const r = 0.8 + this.rnd() * n.wanderR;
        n.target = { x: n.home.x + Math.cos(a) * r, z: n.home.z + Math.sin(a) * r };
      }
      if (n.target) {
        const dx = n.target.x - n.pos.x;
        const dz = n.target.z - n.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) {
          n.target = null;
          n.timer = 1400 + this.rnd() * 3200;
          c.play('idle');
        } else {
          const sp = 1.1;
          n.pos.x += (dx / d) * sp * s001;
          n.pos.z += (dz / d) * sp * s001;
          this.world.resolve(n.pos, 0.4, null);
          c.turnToward(dx, dz);
          c.play('walk');
        }
      }
      n.circle.x = n.pos.x;
      n.circle.z = n.pos.z;
      c.setPosition(n.pos.x, n.pos.z);
      c.update(dt);
    }
  }

  freeze(npc, on = true) { npc.frozen = on; }
  dispose() { this.npcs.length = 0; }
}
