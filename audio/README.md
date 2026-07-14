# /audio — real sound files

MARANATHA plays **procedural placeholders** for every sound until a real file is
dropped in here. The game never ships those synth placeholders as final — they
exist so the game is playable and the mix is wired before the real audio arrives.

## How to add a real sound

1. Source a clean, license-safe file (CC0 / public-domain preferred — Freesound,
   Pixabay, Kenney). Keep it small: one-shots `< ~150 KB`, loops `< ~1.5 MB`,
   with seamless loop points on beds/music.
2. Save it here as **`<key>.<ext>`** (`.mp3`, `.ogg`, or `.webm`) using the exact
   key from the manifest — e.g. `stinger.gift.mp3`.
3. In [`src/data/audioManifest.js`](../src/data/audioManifest.js), set that entry's
   `available: true`.
4. Reload. The loader fetches it and it replaces the placeholder automatically.
   (Nothing is fetched while `available: false`, so there are no 404s.)

## What to provide (current manifest)

| Key | Bus | Loop | Purpose | Scene |
|---|---|---|---|---|
| `ui.click` | sfx | – | button / confirm tick | global |
| `ui.chime` | sfx | – | positive confirm / arrival | global |
| `sfx.footstep` | sfx | – | footfall on dirt | global |
| `amb.camp` | sfx | loop | warm daytime camp bed (wind, distant flock, murmur) | Joseph 1 |
| `amb.night` | sfx | loop | still night bed for the dream (soft wind, crickets) | Joseph 1 |
| `music.warm_camp` | music | loop | gentle warm score — belonging | Joseph 1 |
| `music.wonder` | music | loop | hushed, awed score for the dream | Joseph 1 |
| `sfx.robe` | sfx | – | robe rustle as the coat is placed | Joseph 1 |
| `stinger.gift` | sfx | – | the ornate coat is given | Joseph 1 |
| `stinger.dream` | sfx | – | the dream vision begins | Joseph 1 |
| `stinger.turn` | sfx | – | the brothers' jealousy hardens | Joseph 1 |
| `sfx.bow` | sfx | – | sheaves / stars bow down (soft) | Joseph 1 |

Channels are mixed under **Master** with player-facing **Music / SFX / Narrator**
sliders (Settings). Loops (`amb.*`, `music.*`) currently run as procedural beds;
provide files and the same keys will use them.

> Note on auto-generation: there's no reliable way to auto-generate emotionally
> right audio. Prefer real CC0 files. If you want, hand me links/files and I'll
> wire them in.
