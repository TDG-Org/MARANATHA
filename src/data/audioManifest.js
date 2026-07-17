// AUDIO MANIFEST — the shopping list of real sound files (see audio/README.md).
// Each sound has a name KEY the game calls; until a real file exists the game
// plays the labeled procedural PLACEHOLDER (`fallback`, a method on AudioSystem).
// Drop a file at audio/<key>.<ext>, flip `available: true`, and it takes over —
// zero 404s before then (the loader only fetches keys marked available).
//
//   bus:      'sfx' | 'music' | 'voice'   (which channel it plays on)
//   loop:     true for beds/score (currently procedural via ambience()/musicPad())
//   fallback: AudioSystem method used until a real file is provided
//   file:     path under /audio (folder/name, no ext) when a REAL file exists.
//             Files are sorted into /audio/{music,sfx,ambient,vo}/. The KEY the
//             game calls stays stable; the loader fetches `file` (or the key).
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
  { key: 'amb.camp_wind', bus: 'sfx', loop: true, seconds: 40, file: 'ambient/camp_wind', fallback: 'ambientCampBed', available: true, purpose: 'wind + distant birds bed', scene: 'joseph3d-1' },
  { key: 'amb.fire_crackle', bus: 'sfx', loop: true, seconds: 25, file: 'ambient/fire_crackle', fallback: null, available: true, purpose: 'cook-fire crackle loop (played louder near fires)', scene: 'joseph3d-1' },
  { key: 'amb.sheep_pen', bus: 'sfx', loop: true, seconds: 30, file: 'ambient/sheep_pen', fallback: null, available: true, purpose: 'distant flock: occasional bleats, bells', scene: 'joseph3d-1' },
  { key: 'amb.camp_chatter', bus: 'sfx', loop: true, seconds: 35, fallback: null, available: false, purpose: 'far-off camp murmur / activity', scene: 'joseph3d-1' },
  { key: 'amb.night_crickets', bus: 'sfx', loop: true, seconds: 40, fallback: 'ambientNightBed', available: false, purpose: 'dusk/night crickets bed', scene: 'joseph3d-1' },

  // --- Scene 1 (3D) — music (loop, crossfaded by mood) ---------------------
  { key: 'music.camp_warm', bus: 'music', loop: true, seconds: 90, file: 'music/camp_warm', fallback: 'musicWarmBed', available: true, purpose: 'golden-hour belonging theme', scene: 'joseph3d-1' },
  { key: 'music.dusk_calm', bus: 'music', loop: true, seconds: 70, file: 'music/dusk_calm', fallback: 'musicWonderBed', available: true, purpose: 'dusk quieting-down theme', scene: 'joseph3d-1' },
  { key: 'music.dream_wonder', bus: 'music', loop: true, seconds: 70, file: 'music/dream_wonder', fallback: 'musicWonderBed', available: true, purpose: 'dream sequence — hushed awe', scene: 'joseph3d-1' },
  { key: 'music.ominous_turn', bus: 'music', loop: true, seconds: 60, file: 'music/ominous_turn', fallback: null, available: true, purpose: 'the brothers’ hatred — warm → ominous shift', scene: 'joseph3d-1' },

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
  { key: 'sfx.men_laughing', bus: 'sfx', loop: false, seconds: 2.5, file: 'sfx/men_laughing', fallback: null, available: true, purpose: 'the brothers mock/laugh at Joseph (envy beats)', scene: 'joseph3d-1' },

  // --- Narrator VO (file-first; naming: vo/<story>/<scene>/<line-id>) ---
  // GENERATED, not recorded: `npm run vo` bakes every line below as an mp3
  // (en-US-AndrewNeural, 24kHz 48kbps mono) straight from versesWEB.js — one
  // identical narrator voice on every device. The Narrator is called with the
  // line-id (the key minus the leading "vo/") and fetches audio/vo/<line-id>.mp3
  // |.ogg; missing → a PINNED en-US speechSynthesis fallback (emergency only).
  // VO plays on the 'voice' bus, so Master + Narrator sliders are live mid-line.
  { key: 'vo/joseph/1/verse-37-1', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:1', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-2', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:2 (short)', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-3', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:3', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-4', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:4', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-5', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:5', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-7', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:7', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-8', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:8', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-9', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:9', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-10', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:10 (short)', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-11', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:11', scene: 'joseph3d-1' },
  { key: 'vo/joseph/1/verse-37-24', bus: 'voice', loop: false, available: true, purpose: 'narrate Gen 37:24 (cold open)', scene: 'joseph3d-1' },
  { key: 'vo/ui/voice-test', bus: 'voice', loop: false, available: true, purpose: 'settings Narrator-slider sample line', scene: 'ui' },
  { key: 'vo/playground/demo/line-1', bus: 'voice', loop: false, available: true, purpose: 'playground narrator test line (Gen 1:1)', scene: 'playground' },
];
