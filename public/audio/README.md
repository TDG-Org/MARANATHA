# /audio — drop-in sound guide

Sounds are sorted into folders. **Drop a correctly-named file in the right folder, reload — it
plays.** No code editing. `.mp3` preferred (`.ogg`/`.webm` also work). Keys the game calls stay
stable; the loader maps them to these paths.

```
audio/
  music/     looping score (crossfaded by story mood)
  ambient/   looping background beds (wind, fire, flock)
  sfx/       one-shot effects
  vo/        narrator verse recordings (optional — see bottom)
```

## Music — `audio/music/` (loops, on the Music bus)
| File | Plays when |
|---|---|
| `camp_warm.mp3` | golden-hour camp — belonging *(present)* |
| `dusk_calm.mp3` | evening quieting down *(present)* |
| `dream_wonder.mp3` | the dream — hushed awe *(present — see note ⚠)* |
| `ominous_turn.mp3` | the brothers' jealousy hardens *(present)* |

## Ambient beds — `audio/ambient/` (loops, on the SFX bus)
| File | What it is |
|---|---|
| `camp_wind.mp3` | wind + distant birds, the base daytime bed *(present)* |
| `fire_crackle.mp3` | cook-fire crackle (auto-louder near a fire) *(present)* |
| `sheep_pen.mp3` | distant flock, occasional bleats *(present)* |
| `camp_chatter.mp3` | far-off camp murmur *(optional — silent until added)* |
| `night_crickets.mp3` | dusk/night crickets *(optional)* |

## One-shots — `audio/sfx/`
| File | What it is |
|---|---|
| `men_laughing.mp3` | the brothers mock/laugh at Joseph *(present)* |
| `footstep_grass.mp3`, `footstep_dirt.mp3` | footfalls *(optional — procedural until added)* |
| `cloth_equip.mp3` | the coat settles onto Joseph *(optional)* |
| `sheep_bleat.mp3`, `pen_gate.mp3` | herding feedback *(optional)* |
| `sheaf_bow.mp3` | a sheaf/star bows in the dream *(optional)* |
| `stinger.coat_gift.mp3`, `stinger.dream_enter.mp3`, `stinger.hatred.mp3` | musical stingers *(optional)* |

Kept procedural (they're good — a hybrid mix): the **bird chirps** and the **UI click/chime** cues.

## Narrator voice — `audio/vo/joseph/1/` (optional)
The narrator is currently the browser's built-in voice (one locked voice everywhere). To use your
own recordings instead, drop `verse-37-1.mp3 … verse-37-11.mp3` (+ `verse-37-24.mp3` for the cold
open) here — see NATE.md for the exact word-for-word lines. **Only the verses need VO; character
dialogue is on-screen text.**

> ⚠ **Note on the dream music:** the narrator itself never changes voice (verified in code — one
> locked voice for the whole game, no separate voice files). If you hear a *different voice* during
> the dream, it's inside `music/dream_wonder.mp3` (that track may contain vocals). Swap it for an
> instrumental dream track and the extra voice is gone.
