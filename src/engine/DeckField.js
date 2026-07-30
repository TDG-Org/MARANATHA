// MULTI-LEVEL FLOORS — the smallest thing that makes a three-deck interior
// walkable in a game whose collision has always been circles on the XZ plane.
//
// The whole engine so far has been flat: every story stage carves a FLAT pad and
// nothing ever writes a character's y (the one exception, the dream summit, sets
// root.y once by hand). An ark is three decks stacked over each other, which
// means the same (x, z) has three different legal floor heights and the answer
// depends on which one you are standing on.
//
// A physics engine would solve this with a capsule and a downward sweep. That is
// far more than this game needs and far more than a phone should pay for. What a
// hand-built interior actually knows is exactly where its floors are — so the
// floors are DATA: axis-aligned rectangles, each at a height, plus ramps whose
// height varies linearly along one axis. One query per body per frame, no
// allocation, no raycast, no broadphase.
//
// THE RULE that makes it correct: from where you are standing, the floor you are
// on is the HIGHEST surface you could have stepped up onto. Deck 2 is above deck
// 1 at the same (x, z), but you can only be on the one within stepUp of your
// feet. Walk up the ramp and the reachable set changes with you.

const NO_SURFACE = { y: 0, id: null, ramp: false, found: false };

export class DeckField {
  // stepUp — how high a body may step without a ramp. Deliberately small: it is
  // what stops a player standing on deck 1 from being teleported onto deck 2,
  // and what lets them walk over a threshold beam without stopping.
  constructor({ stepUp = 0.62, groundY = 0 } = {}) {
    this.stepUp = stepUp;
    this.groundY = groundY;
    this.regions = [];
    // Reused result object — surfaceAt runs every frame for every walking body.
    this._out = { y: 0, id: null, ramp: false, found: false };
  }

  // A flat floor slab. `id` is for debugging and for scenes that want to know
  // which deck a body is on (audio, lighting, the interior/exterior toggle).
  addFloor({ minX, minZ, maxX, maxZ, y, id = null }) {
    const r = {
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
      y,
      yLow: y,
      yHigh: y,
      axis: null,
      id,
    };
    this.regions.push(r);
    return r;
  }

  // A ramp: height runs linearly from yLow to yHigh along `axis` ('x' or 'z'),
  // low end at the region's min edge. Reverse it by swapping yLow/yHigh.
  addRamp({ minX, minZ, maxX, maxZ, axis = 'z', yLow, yHigh, id = null }) {
    const r = {
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
      y: (yLow + yHigh) / 2,
      yLow,
      yHigh,
      axis,
      id,
    };
    this.regions.push(r);
    return r;
  }

  // The surface height of one region at (x, z). Flat regions ignore position;
  // ramps interpolate along their axis.
  static surfaceOf(r, x, z) {
    if (!r.axis) return r.y;
    const t = r.axis === 'x'
      ? (x - r.minX) / Math.max(1e-6, r.maxX - r.minX)
      : (z - r.minZ) / Math.max(1e-6, r.maxZ - r.minZ);
    const k = t < 0 ? 0 : t > 1 ? 1 : t;
    return r.yLow + (r.yHigh - r.yLow) * k;
  }

  // THE query. Returns the reused result object; copy anything you keep.
  //
  // `found: false` means "no authored floor here" — outside the ark, where the
  // scene's own terrain owns the height. Callers treat that as groundY.
  surfaceAt(x, z, currentY) {
    const out = this._out;
    const reach = currentY + this.stepUp;
    let bestY = -Infinity;
    let best = null;
    let lowestY = Infinity;
    let lowest = null;
    for (let i = 0; i < this.regions.length; i++) {
      const r = this.regions[i];
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      const y = DeckField.surfaceOf(r, x, z);
      // The highest surface the body could legally be standing on.
      if (y <= reach && y > bestY) { bestY = y; best = r; }
      // ...and the lowest floor here at all, as the landing target for a body
      // that has walked out over an opening with nothing within stepUp below.
      if (y < lowestY) { lowestY = y; lowest = r; }
    }
    if (best) {
      out.y = bestY;
      out.id = best.id;
      out.ramp = !!best.axis;
      out.found = true;
      return out;
    }
    if (lowest) {
      // Everything here is ABOVE the body's step reach: it is standing under a
      // deck with no floor of its own (a doorway threshold, the space beneath a
      // ramp). The ground below is the honest answer, not the deck overhead.
      out.y = this.groundY;
      out.id = null;
      out.ramp = false;
      out.found = true;
      return out;
    }
    out.y = this.groundY;
    out.id = null;
    out.ramp = false;
    out.found = false;
    return out;
  }

  // Convenience for spawn checks and tests.
  heightAt(x, z, currentY = Infinity) {
    return this.surfaceAt(x, z, currentY).y;
  }

  // Which deck id a body at this height and place is on (null = outside).
  deckAt(x, z, currentY) {
    return this.surfaceAt(x, z, currentY).id;
  }

  clear() { this.regions.length = 0; }
}

export { NO_SURFACE };

// The vertical half of a body's movement, kept out of the controller so it can
// be tested on its own and reused by any future scripted mover.
//
// Upward and small downward changes SNAP: a ramp is geometrically continuous, so
// following it exactly is both correct and the only way to avoid the body
// visibly sinking into a slope it is climbing. Only a real drop falls, and it
// falls under gravity so a step off a deck edge reads as a fall rather than a
// teleport.
export const FALL = { gravity: 22, maxSnapDrop: 0.4, terminal: 26 };

export function stepHeight(state, targetY, dt) {
  const seconds = dt * 0.001;
  const dy = targetY - state.y;
  if (dy >= 0 || -dy <= FALL.maxSnapDrop) {
    state.y = targetY;
    state.vy = 0;
    state.falling = false;
    return state;
  }
  state.vy = Math.max(-FALL.terminal, state.vy - FALL.gravity * seconds);
  const next = state.y + state.vy * seconds;
  if (next <= targetY) {
    state.y = targetY;
    state.vy = 0;
    state.falling = false;
  } else {
    state.y = next;
    state.falling = true;
  }
  return state;
}
