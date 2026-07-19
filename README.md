<div align="center">

# MARANATHA

***“Maranatha — Come, Lord.”***

A Bible game — calm and **biblically‑accurate**. Walk through the Bible —
in a hand‑drawn **HD‑2D** world with the painterly stillness of *Alto’s Adventure*.
No install, no login.

**[▶ Play now](https://tdg-org.github.io/MARANATHA/)**  ·  add `#debug` for a live FPS / draw‑call readout

![Three.js](https://img.shields.io/badge/Three.js-r0.185-111?logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Assets](https://img.shields.io/badge/art-procedural%20%2B%20CC0-f2b880)
![Scripture](https://img.shields.io/badge/Bible-World%20English%20(public%20domain)-8a7f9e)

</div>

---

## ✨ What it is

You move a flat, hand‑drawn character through a low‑poly 3D world beneath a real, gently‑moving
camera. You walk up to people, talk with them, and live each story exactly as Scripture tells
it — the real verse (World English Bible) shown on screen and read aloud on every beat.

- 🎨 **HD‑2D art** — flat sprite characters in a 3D world; single‑pass shader‑gradient skies, atmospheric haze, golden‑hour light.
- 🚶 **Walk & talk** — free movement, a gentle follow camera, dialogue popups that always name who’s speaking, and soft on‑screen guidance so you’re never lost.
- 🔊 **Drawn in code** — every visual is generated procedurally (skies, terrain, props, coat patterns, wheat), with a small set of CC0 models and textures for the characters and ground. Most sound is synthesized at runtime; the score and a few effects are real files.
- 📖 **Faithful to the text** — World English Bible (public domain), verified verse‑by‑verse against the canonical text; narrated in one baked voice.
- 📱 **Runs anywhere** — device‑adaptive resolution and instanced rendering keep it smooth even on low‑end phones.
- 🔒 **Private & instant** — no accounts; your progress saves locally in your browser.

## 🎮 Controls

| Action | Desktop | Touch |
|---|---|---|
| Move | **WASD** / **arrow keys**, or **click** a spot | on‑screen **joystick**, or **tap** a spot |
| Talk / interact | walk close, press **E** | tap the **Talk** prompt |
| Advance dialogue | **Enter** / **Space** / **click** | tap |
| Home / leave a story | the **⌂** button (asks to confirm) | ⌂ |
| Settings — volume mix & performance meter | the **⚙** button | ⚙ |

## 📖 Stories

- **Creation** — Genesis 1–2 · a short cinematic prologue *(planned)*
- **Joseph** — Genesis 37–50 · the first playable story.
  **Scene 1 — The Coat & the Dreams** (Genesis 37:1‑11) is playable now in full 3D: herd the
  flock, receive the coat of many colors, live the two dreams by night, and face the brothers’
  jealousy. More scenes are on the way.

## 🚀 Run locally

```bash
npm install
npm start         # dev server on http://localhost:1225 — auto-opens your browser
npm run build     # production build → dist/
```

`npm start` always uses port **1225** (fixed, so it never clashes with other local
apps) and opens the game for you. (`npm run dev` is the plain server without auto-open.)

## 🛠️ Tech

**Three.js · Vite · plain ES‑module JavaScript** — no framework, no TypeScript.

The HD‑2D technique: yaw‑billboarded canvas‑texture sprites living in unlit low‑poly
environments, one dithered shader‑gradient sky dome, fog for depth, instanced props, and a
device‑tier DPR clamp with adaptive quality that sheds resolution only when a device is
actually struggling. The UI is a DOM overlay, so text stays crisp at any resolution. Audio is
a channel‑mixed WebAudio graph (**Master / Music / SFX / Narrator**) with file‑first narration
and a graceful procedural fallback.

## 📁 Project layout

```
index.html            canvas + DOM UI overlay
src/main.js           bootstrap
src/core/             renderer, game loop, adaptive quality, scene manager
src/engine/           HD-2D world kit, Character + walk, controller, follow camera, guidance, interaction
src/screens/home.js   the story-map home screen
src/scenes/joseph/    the Joseph story
src/systems/          audio, narrator, save, settings
src/ui/               dialogue, verse panel, settings, confirm modal, HUD
src/data/             verses (WEB / BSB), story registry, audio manifest
src/scenes/joseph3d/  the 3D Scene 1: assembly, beats, props, sheep, cast
public/models/        rigged character GLBs (CC0 — see CREDITS.md)
```

## 📜 Notes

- Displayed scripture is the **World English Bible** (public domain), verified against the
  canonical text. Character models are **CC0** (credits in `public/models/CREDITS.md`).
- The earlier Phaser 3 version (a full playable Creation story) is preserved on the
  [`phaser-archive`](https://github.com/TDG-Org/MARANATHA/tree/phaser-archive) branch.

## ⚖️ Copyright & use

**Copyright © 2026 Nate (TDG-Org). All rights reserved.**

This source is published so the game can be played and so others can read how it was built.
It is **not** open source and carries **no license to reuse it**. Without prior written
permission you may not copy, modify, redistribute, or sell this code or its story content,
in whole or in part, or use it to produce a derivative game.

**The game itself is, and will remain, free to play for everyone** — that is a promise about
players, not a grant of rights to the source.

Third-party assets keep their own licenses and are **not** covered by the notice above:

| Asset | License | Credits |
|---|---|---|
| Character models (KayKit) | CC0 | `public/models/CREDITS.md` |
| Rock & dirt textures (Poly Haven) | CC0 | `public/textures/CREDITS.md` |
| Scripture text (World English Bible) | Public domain | — |
| Music, ambience & SFX | see credits file | `public/audio/CREDITS.md` |

Questions, or want permission to use something here? Open an issue on the repo.

<div align="center">

*Built with care. Every frame eases; nothing pops.*

</div>
