// AUDIO MANIFEST — the shopping list of real sound files (see audio/README.md).
// Each sound has a name KEY the game calls; until a real file exists the game
// plays the labeled procedural PLACEHOLDER (`fallback`, a method on AudioSystem).
// Drop a file at audio/<key>.<ext>, flip `available: true`, and it takes over —
// zero 404s before then (the loader only fetches keys marked available).
//
//   bus:      'sfx' | 'music'   (which channel it plays on)
//   loop:     true for beds/score (currently procedural via ambience()/musicPad())
//   fallback: AudioSystem method used until a real file is provided
export const AUDIO_MANIFEST = [
  // --- global UI ---
  { key: 'ui.click', bus: 'sfx', loop: false, seconds: 0.1, fallback: 'uiClick', available: false, purpose: 'button / confirm tick', scene: 'global' },
  { key: 'ui.chime', bus: 'sfx', loop: false, seconds: 2.2, fallback: 'bell', available: false, purpose: 'positive confirm / arrival', scene: 'global' },

  // --- movement ---
  { key: 'sfx.footstep', bus: 'sfx', loop: false, seconds: 0.15, fallback: 'footstep', available: false, purpose: 'footfall on dirt', scene: 'global' },

  // --- Scene 1: the coat & the dreams (Gen 37:1-11) ---
  { key: 'amb.camp', bus: 'sfx', loop: true, seconds: 30, fallback: 'ambientCampBed', available: false, purpose: 'warm daytime camp bed (wind, distant flock, murmur)', scene: 'joseph-1' },
  { key: 'amb.night', bus: 'sfx', loop: true, seconds: 30, fallback: 'ambientNightBed', available: false, purpose: 'still night bed for the dream (soft wind, crickets)', scene: 'joseph-1' },
  { key: 'music.warm_camp', bus: 'music', loop: true, seconds: 60, fallback: 'musicWarmBed', available: false, purpose: 'gentle warm score — belonging', scene: 'joseph-1' },
  { key: 'music.wonder', bus: 'music', loop: true, seconds: 40, fallback: 'musicWonderBed', available: false, purpose: 'hushed, awed score for the dream', scene: 'joseph-1' },
  { key: 'sfx.robe', bus: 'sfx', loop: false, seconds: 0.6, fallback: 'blip', available: false, purpose: 'robe rustle as the coat is placed', scene: 'joseph-1' },
  { key: 'stinger.gift', bus: 'sfx', loop: false, seconds: 2.4, fallback: 'bell', available: false, purpose: 'the ornate coat is given', scene: 'joseph-1' },
  { key: 'stinger.dream', bus: 'sfx', loop: false, seconds: 2.6, fallback: 'swellBright', available: false, purpose: 'the dream vision begins', scene: 'joseph-1' },
  { key: 'stinger.turn', bus: 'sfx', loop: false, seconds: 2.4, fallback: 'swellSoft', available: false, purpose: 'the brothers’ jealousy hardens', scene: 'joseph-1' },
  { key: 'sfx.bow', bus: 'sfx', loop: false, seconds: 0.4, fallback: 'thump', available: false, purpose: 'sheaves / stars bow down (soft)', scene: 'joseph-1' },

  // --- Scene 1 (3D rebuild) — ambient beds (loop) -------------------------
  // Fallback policy: graceful SILENCE over junk placeholders — keys with
  // fallback:null are silent until Nate drops the real file in /audio.
  { key: 'amb.camp_wind', bus: 'sfx', loop: true, seconds: 40, fallback: 'ambientCampBed', available: false, purpose: 'wind + distant birds bed (procedural until file)', scene: 'joseph3d-1' },
  { key: 'amb.fire_crackle', bus: 'sfx', loop: true, seconds: 25, fallback: null, available: false, purpose: 'cook-fire crackle loop (played louder near fires)', scene: 'joseph3d-1' },
  { key: 'amb.sheep_pen', bus: 'sfx', loop: true, seconds: 30, fallback: null, available: false, purpose: 'distant flock: occasional bleats, bells', scene: 'joseph3d-1' },
  { key: 'amb.camp_chatter', bus: 'sfx', loop: true, seconds: 35, fallback: null, available: false, purpose: 'far-off camp murmur / activity', scene: 'joseph3d-1' },
  { key: 'amb.night_crickets', bus: 'sfx', loop: true, seconds: 40, fallback: 'ambientNightBed', available: false, purpose: 'dusk/night crickets bed', scene: 'joseph3d-1' },

  // --- Scene 1 (3D) — music (loop, crossfaded by mood) ---------------------
  { key: 'music.camp_warm', bus: 'music', loop: true, seconds: 90, fallback: 'musicWarmBed', available: false, purpose: 'golden-hour belonging theme', scene: 'joseph3d-1' },
  { key: 'music.dusk_calm', bus: 'music', loop: true, seconds: 70, fallback: 'musicWonderBed', available: false, purpose: 'dusk quieting-down theme', scene: 'joseph3d-1' },
  { key: 'music.dream_wonder', bus: 'music', loop: true, seconds: 70, fallback: 'musicWonderBed', available: false, purpose: 'dream sequence — hushed awe', scene: 'joseph3d-1' },
  { key: 'music.ominous_turn', bus: 'music', loop: true, seconds: 60, fallback: null, available: false, purpose: 'the brothers’ hatred — warm → ominous shift', scene: 'joseph3d-1' },

  // --- Scene 1 (3D) — reactive SFX -----------------------------------------
  { key: 'sfx.footstep_grass', bus: 'sfx', loop: false, seconds: 0.15, fallback: 'footstep', available: false, purpose: 'footfall on grass', scene: 'joseph3d-1' },
  { key: 'sfx.footstep_dirt', bus: 'sfx', loop: false, seconds: 0.15, fallback: 'footstep', available: false, purpose: 'footfall on dirt path', scene: 'joseph3d-1' },
  { key: 'sfx.cloth_equip', bus: 'sfx', loop: false, seconds: 0.8, fallback: 'blip', available: false, purpose: 'the coat settles onto Joseph', scene: 'joseph3d-1' },
  { key: 'sfx.sheep_bleat', bus: 'sfx', loop: false, seconds: 0.7, fallback: null, available: false, purpose: 'single sheep bleat (herding feedback)', scene: 'joseph3d-1' },
  { key: 'sfx.pen_gate', bus: 'sfx', loop: false, seconds: 0.6, fallback: 'thump', available: false, purpose: 'a stray counted into the pen', scene: 'joseph3d-1' },
  { key: 'stinger.coat_gift', bus: 'sfx', loop: false, seconds: 3.0, fallback: 'bell', available: false, purpose: 'the tunic is given — music swell', scene: 'joseph3d-1' },
  { key: 'stinger.dream_enter', bus: 'sfx', loop: false, seconds: 3.0, fallback: 'swellBright', available: false, purpose: 'the dream begins', scene: 'joseph3d-1' },
  { key: 'stinger.hatred', bus: 'sfx', loop: false, seconds: 2.4, fallback: 'swellSoft', available: false, purpose: 'the brothers’ jealousy hardens', scene: 'joseph3d-1' },
  { key: 'sfx.sheaf_bow', bus: 'sfx', loop: false, seconds: 0.6, fallback: 'thump', available: false, purpose: 'a sheaf bows in the dream', scene: 'joseph3d-1' },

  // --- Narrator VO (file-first; naming: vo/<story>/<scene>/<line-id>) ---
  // The manifest key is the path under /audio. The Narrator is called with the
  // line-id (the key minus the leading "vo/") and fetches audio/vo/<line-id>.mp3
  // |.ogg; missing → speechSynthesis fallback. VO plays on the 'voice' bus, so
  // Master + Narrator sliders are live mid-line and a volume change never stops it.
  { key: 'vo/joseph/1/verse-37-3', bus: 'voice', loop: false, available: false, purpose: 'narrate Gen 37:3', scene: 'joseph-1' },
  { key: 'vo/joseph/1/verse-37-4', bus: 'voice', loop: false, available: false, purpose: 'narrate Gen 37:4', scene: 'joseph-1' },
  { key: 'vo/joseph/1/verse-37-7', bus: 'voice', loop: false, available: false, purpose: 'narrate Gen 37:7', scene: 'joseph-1' },
  { key: 'vo/joseph/1/verse-37-8', bus: 'voice', loop: false, available: false, purpose: 'narrate Gen 37:8', scene: 'joseph-1' },
  { key: 'vo/joseph/1/verse-37-9', bus: 'voice', loop: false, available: false, purpose: 'narrate Gen 37:9', scene: 'joseph-1' },
  { key: 'vo/joseph/1/verse-37-11', bus: 'voice', loop: false, available: false, purpose: 'narrate Gen 37:11', scene: 'joseph-1' },
  { key: 'vo/playground/demo/line-1', bus: 'voice', loop: false, available: false, purpose: 'playground narrator test line', scene: 'playground' },
];
