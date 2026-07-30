// THE ARK — every number in one place.
//
// Genesis 6:15 (WEB): "This is how you shall make it. The length of the ship
// shall be three hundred cubits, its width fifty cubits, and its height thirty
// cubits."
//
// THE CUBIT. Scripture gives cubits, not metres, and the cubit was not one
// fixed length in the ancient world. The two candidates that matter:
//   - the common/short Hebrew cubit, about 17.5-18 in (44.5-45.7 cm)
//   - the long/royal cubit, about 20.4-20.6 in (51.8-52.4 cm), which Answers in
//     Genesis chose for the Ark Encounter, giving their 510 ft building
// This game commits to the COMMON CUBIT AT EXACTLY 18 INCHES (0.4572 m). Three
// reasons: it is the most widely cited reading, it yields the round 450 x 75 x
// 45 ft that most people have actually heard ("450 feet long"), and it is the
// CONSERVATIVE choice - the smallest defensible ark. A player who later reads
// that it may have been bigger is pleasantly surprised; one who reads it may
// have been smaller would feel sold a fake. Change CUBIT here and the entire
// model, its collision, its decks and its ramps rebuild to scale.
//
// GAME UNITS ARE METRES. The rigged characters stand about 1.75 u tall and the
// player capsule has a 0.42 u radius, so a metre-scaled ark is honest: the door
// really is taller than a person, the deck really does take half a minute to
// walk end to end.

export const CUBIT = 0.4572; // metres — 18 inches exactly

const cubits = (n) => n * CUBIT;

// --- the three given dimensions ---------------------------------------------
export const ARK = {
  cubit: CUBIT,
  lengthCubits: 300,
  widthCubits: 50,
  heightCubits: 30,

  length: cubits(300),  // 137.16 m  (450 ft)
  width: cubits(50),    //  22.86 m  ( 75 ft)
  height: cubits(30),   //  13.716 m ( 45 ft)
};

ARK.halfLength = ARK.length / 2;   // 68.58
ARK.halfWidth = ARK.width / 2;     // 11.43

// --- three decks -------------------------------------------------------------
// Genesis 6:16 (WEB): "...with lower, second, and third levels."
//
// Thirty cubits over three storeys is ten cubits (4.572 m) per deck. Real decks
// spend some of that on structure: the beams that carry the floor above hang
// below it. DECK_STRUCTURE is that allowance, so CLEAR is the headroom a player
// actually walks in - about 3.9 m, generous and honest.
export const DECK_STRUCTURE = 0.62;

// THE BUILDING BLOCKS. A hull is not built lying in the dirt - you cannot plank
// or pitch a bottom you cannot reach. Ships are built up on stocks, and this one
// is under construction, so it stands on massive timber blocks. Two things fall
// out of that, both of them right: the boarding ramp becomes a real climb rather
// than a kerb, and the player standing at the foot of it has to look UP at the
// thing, which is most of what makes it feel as big as it is.
export const KEEL_Y = 1.55;

// The thirty cubits are the WHOLE ark, keel to eaves - not thirty cubits of
// deck stacked on top of a hull bottom. So the bilge comes out of the budget,
// and the three decks divide what is left.
export const HULL_BOTTOM = KEEL_Y;
export const EAVES_Y = KEEL_Y + ARK.height; // top of the sides

// The floor of deck 1 sits above the bilge — the hull's own bottom timbers.
export const BILGE = 0.46;

export const DECK_PITCH = (ARK.height - BILGE) / 3;    // 4.419
export const DECK_CLEAR = DECK_PITCH - DECK_STRUCTURE; // 3.799

// Walking surfaces, in WORLD y (the blocks are already in these numbers).
export const DECK_Y = [
  KEEL_Y + BILGE,                    // lower
  KEEL_Y + BILGE + DECK_PITCH,       // second
  KEEL_Y + BILGE + DECK_PITCH * 2,   // third
];

// The underside of the roof over deck 3 == the eaves. The gable ridge rises
// above this; the thirty cubits do not include it.
export const ROOF_Y = EAVES_Y;
export const RIDGE_RISE = 1.45;

// --- the hull ----------------------------------------------------------------
// Scripture does not give a SHAPE. It gives a box's three measures and calls the
// thing a tebah. So the shape is a design decision, and this is the one the
// serious full-scale reconstructions make: a rectangular midbody - which is
// where every one of those cubits of capacity lives - carried into a tapered
// bow and stern. It floats better, it reads unmistakably as a SHIP rather than a
// shipping container, and it costs nothing in fidelity because the text is
// silent. The 1993 Korean ship-research hull-safety study tested proportions of
// exactly this family.
export const HULL = {
  // How much of the length is full-width midbody (the rest tapers fore and aft).
  midbodyFraction: 0.62,
  // The ends narrow to this fraction of full width, and rise (sheer) as they go.
  endWidthFraction: 0.30,
  bowRise: 2.05,   // the bow lifts this far above the midbody sheer line
  sternRise: 1.35,
  // The bottom is flat across the midbody (it is a barge amidships) and rocks up
  // toward the ends so the ends are clear of the water.
  bowRocker: 1.5,
  sternRocker: 1.05,
  // Hull skin thickness: outer planking + frames + inner ceiling planking. Real
  // and visible - you see it in the door reveal and at the window band.
  skin: 0.42,
};

// --- the door ----------------------------------------------------------------
// Genesis 6:16 (WEB): "You shall set the door of the ship in its side."
// Genesis 7:16 (WEB): "...and Yahweh shut him in."
//
// ONE door, in the SIDE, at the lower deck, reached by a ramp from the ground.
// Sized so the largest animals and the loaded ramp traffic pass: 6 cubits wide,
// 8 cubits tall.
export const DOOR = {
  widthCubits: 6,
  heightCubits: 8,
  width: cubits(6),    // 2.74
  height: cubits(8),   // 3.66
  // On the +Z side (the side the camera naturally faces), a little aft of
  // midships so the approach reads along the hull rather than head-on.
  side: 1,             // +Z
  x: -6.0,
  sillY: DECK_Y[0],
};

// --- the window / tsohar -----------------------------------------------------
// Genesis 6:16 (WEB): "You shall make a roof in the ship, and you shall finish
// it to a cubit upward."
//
// The Hebrew tsohar is genuinely contested: a single window, a skylight, or -
// the reading most reconstructions build - a continuous band of light left open
// under the roof line, one cubit high, running the length of both sides. That
// last reading is what "finish it to a cubit upward" most naturally describes,
// it is the only one that ventilates a vessel holding that many animals, and it
// is the one that makes a walkable interior beautiful: a long ribbon of daylight
// down the top deck.
export const WINDOW = {
  heightCubits: 1,
  height: CUBIT,                 // 0.457
  // "finished to a cubit upward" read literally: the band IS the top cubit of
  // the wall, its head at the eaves.
  sillY: EAVES_Y - CUBIT,        // 13.259
};

// --- what the player walks on ------------------------------------------------
// The walkable interior is the rectangular midbody. Fore and aft of the
// bulkheads the hull tapers into structure and stores - exactly as a real ship
// uses its ends. This keeps every walking surface a clean rectangle.
export const HOLD = {
  minX: -ARK.halfLength * HULL.midbodyFraction,
  maxX: ARK.halfLength * HULL.midbodyFraction,
  // Inset from the hull skin by the skin thickness plus the frames' depth.
  halfWidth: ARK.halfWidth - HULL.skin - 0.34,
};

// The central corridor runs the full length of every deck. Wide enough for two
// people and a led animal to pass - 8 cubits.
export const CORRIDOR = { halfWidth: cubits(4) }; // 1.83 -> 3.66 m wide

// --- ramps between decks -----------------------------------------------------
// Ramps, not stairs: this is a vessel loaded with animals, and every serious
// reconstruction moves them on ramps. They alternate sides so the climb reads as
// a real circulation route rather than one long slot.
export const RAMP = {
  width: cubits(7),      // 3.2 m — wide enough to lead a large animal
  runLength: 15.6,       // horizontal run per deck (a ~1:3.4 slope — walkable)
};

// The ramps' footprints, derived so the geometry and the DeckField can never
// disagree about where they are.
export const RAMPS = [
  // deck 1 -> deck 2, climbing +x on the -Z side of the corridor
  {
    id: 'ramp12',
    fromDeck: 0,
    toDeck: 1,
    axis: 'x',
    x0: -22.0,
    x1: -22.0 + RAMP.runLength,
    zCenter: -(CORRIDOR.halfWidth + RAMP.width / 2 + 0.25),
  },
  // deck 2 -> deck 3, climbing -x on the +Z side (doubling back)
  {
    id: 'ramp23',
    fromDeck: 1,
    toDeck: 2,
    axis: 'x',
    x0: 22.0,
    x1: 22.0 - RAMP.runLength,
    zCenter: CORRIDOR.halfWidth + RAMP.width / 2 + 0.25,
  },
];

// --- the boarding ramp from the ground --------------------------------------
export const BOARDING = {
  width: 4.2,
  // From the ground up to the door sill — a real climb now the hull stands on
  // its blocks. About 1:6, which loaded animals walk without hesitating.
  zOuter: ARK.halfWidth + 12.6,
  zInner: ARK.halfWidth - HULL.skin,
};

// --- colours -----------------------------------------------------------------
// Genesis 6:14 (WEB): "Make a ship of gopher wood. You shall make rooms in the
// ship, and shall seal it inside and outside with pitch."
//
// So the OUTSIDE is not bare timber. It is sealed with pitch - kopher, the same
// root as the word for atonement - which reads as a dark, warm, tarry brown-
// black over the plank forms, still showing every seam. The INSIDE is sealed
// too, but a lamplit interior wants to read as warm worked timber, so the inner
// skin is lighter: pitch dulled by dust and handling.
export const COLORS = {
  pitch: 0x3a2b21,        // the sealed exterior
  pitchLight: 0x4a382b,   // sun-caught planks
  pitchDark: 0x271d16,    // shadowed strakes, the underhull
  timber: 0x7d5a37,       // fresh-cut gopher wood (the unfinished parts)
  timberLight: 0x9a744b,
  timberDark: 0x5c422a,
  innerWall: 0x6b4e32,    // the interior skin
  deckPlank: 0x805c38,    // walking surfaces, worn paler
  beam: 0x5a4029,         // structural timbers
  strawGold: 0xc9a35c,    // bedding, fodder
  rope: 0xbfa677,
  ironDark: 0x3c3733,
};
