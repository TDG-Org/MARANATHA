# /audio/vo — narrator voice-over files

The narrator is **file-first**: it plays `audio/vo/<line-id>.mp3` (or `.ogg`) when the file
exists, else falls back to browser TTS. Files play on the live **voice bus** — the Master and
Narrator sliders work mid-line, volume changes never interrupt, and only the Skip button (or
full mute) stops a line.

**Produce each line below as ONE file, named exactly as shown** (ElevenLabs → mp3, calm,
reverent, unhurried male narration; ~-16 LUFS; no music). Drop the files in this folder —
no code change needed.

## Scene 1 — The Coat & the Dreams (WEB translation, read exactly as written)

| # | File | Line to record |
|---|---|---|
| 1 | `joseph/1/verse-37-1.mp3` | Jacob lived in the land of his father's travels, in the land of Canaan. |
| 2 | `joseph/1/verse-37-2.mp3` | Joseph, being seventeen years old, was feeding the flock with his brothers. |
| 3 | `joseph/1/verse-37-3.mp3` | Now Israel loved Joseph more than all his children, because he was the son of his old age, and he made him a tunic of many colors. |
| 4 | `joseph/1/verse-37-4.mp3` | His brothers saw that their father loved him more than all his brothers, and they hated him, and couldn't speak peaceably to him. |
| 5 | `joseph/1/verse-37-5.mp3` | Joseph dreamed a dream, and he told it to his brothers, and they hated him all the more. |
| 6 | `joseph/1/verse-37-7.mp3` | For behold, we were binding sheaves in the field, and behold, my sheaf arose and also stood upright; and behold, your sheaves came around, and bowed down to my sheaf. |
| 7 | `joseph/1/verse-37-8.mp3` | His brothers asked him, "Will you indeed reign over us? Will you indeed have dominion over us?" They hated him all the more for his dreams and for his words. |
| 8 | `joseph/1/verse-37-9.mp3` | He dreamed yet another dream, and told it to his brothers, and said, "Behold, I have dreamed yet another dream: and behold, the sun and the moon and eleven stars bowed down to me." |
| 9 | `joseph/1/verse-37-10.mp3` | His father rebuked him, and said to him, "What is this dream that you have dreamed? Will I and your mother and your brothers indeed come to bow ourselves down to the earth before you?" |
| 10 | `joseph/1/verse-37-11.mp3` | His brothers envied him, but his father kept this saying in mind. |

Also referenced (playground test line — any short calm sentence works):

| — | `playground/demo/line-1.mp3` | e.g. "The Lord was with Joseph." |

## Notes

- Line-ids follow `vo/<story>/<scene>/<line-id>` (see `src/data/audioManifest.js`).
- Verse wording above is the World English Bible (public domain), verified against the
  canonical distribution (ebible.org). Record it exactly — the on-screen card shows the
  same words, and they must match.
- Subfolders ARE the filename: create `audio/vo/joseph/1/` and put the files inside.
