# /audio — credits & licenses

Every audio file that ships with the game, with its source and license, per the
asset-pipeline rule: **no log line → the asset doesn't ship.**

> ⚠️ **Rows marked "TO CONFIRM" are not yet verified.** They were added before this log
> existed. Until each is confirmed, the project cannot make any licensing claim over them,
> and any that turn out to be restrictively licensed must be replaced or properly attributed.

## Narration (`vo/`) — generated, ours

| Files | Source | License / terms |
|---|---|---|
| `vo/**/*.mp3` (14 files) | Generated at build time by `npm run vo` → `tools/make-vo.mjs`, using **msedge-tts** (Microsoft Edge read-aloud endpoint), voice `en-US-AndrewNeural`. Text comes from `src/data/versesWEB.js` (World English Bible, public domain + our own narration lines). | The spoken **text** is public domain / ours. The **synthesized audio** is produced through a Microsoft endpoint — redistribution terms for generated speech are not explicitly granted. **TO CONFIRM** before any commercial release; regenerating with a service that grants explicit redistribution rights (e.g. a paid ElevenLabs plan) removes the question entirely. |

## Music (`music/`)

| File | Source | Author | License | Attribution required? |
|---|---|---|---|---|
| `camp_warm.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |
| `dusk_calm.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |
| `dream_wonder.mp3` | **TO CONFIRM** — added by Nate (note: contains baked-in vocals) | ? | ? | ? |
| `ominous_turn.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |

## Ambience (`ambient/`)

| File | Source | Author | License | Attribution required? |
|---|---|---|---|---|
| `camp_wind.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |
| `fire_crackle.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |
| `sheep_pen.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |

## SFX (`sfx/`)

| File | Source | Author | License | Attribution required? |
|---|---|---|---|---|
| `men_laughing.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |
| `man_laugh.mp3` | **TO CONFIRM** — added by Nate | ? | ? | ? |

## Everything else

All other sounds in the game (UI ticks, chimes, footsteps, stingers, the dread/sad music
beds, bird calls, night ambience) are **synthesized in code at runtime** by
`src/systems/AudioSystem.js` — no files, no third-party rights involved.

---

### How to fill a row in

For each file, note where you downloaded it and the license shown on that page:

- **Pixabay** (pixabay.com/music, /sound-effects) → "Free for use… no attribution required"
  — the simplest case; just record the URL.
- **Freesound** → each sound shows its own license. **CC0** is free and clear;
  **CC-BY** legally requires crediting the author by name; **CC-BY-NC** forbids commercial use.
- **Incompetech / Kevin MacLeod** → **CC-BY**: attribution is mandatory, with a specific
  credit line the site gives you.

If a file turns out to be CC-BY, that's fine — the credit just has to appear (here, and
ideally in an in-game credits screen). If it's non-commercial-only or unlicensed stock,
it should be replaced.
