<div align="center">

# MARANATHA

***“Maranatha — Come, Lord.”***

A calm, **biblically‑accurate** browser game. Walk through the real events of the Bible —
in a hand‑drawn **HD‑2D** world with the painterly stillness of *Alto’s Adventure*.
No install, no login.

**[▶ Play now](https://tdg-org.github.io/MARANATHA/)**  ·  add `#debug` for a live FPS / draw‑call readout

![Three.js](https://img.shields.io/badge/Three.js-r0.185-111?logo=three.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Assets](https://img.shields.io/badge/assets-100%25%20procedural-f2b880)
![Scripture](https://img.shields.io/badge/Bible-Berean%20Standard%20(public%20domain)-8a7f9e)

</div>

---

## ✨ What it is

You move a flat, hand‑drawn character through a low‑poly 3D world beneath a real, gently‑moving
camera. You walk up to people, talk with them, and live each story exactly as Scripture tells
it — the real verse (Berean Standard Bible) shown on screen and read aloud on every beat.

- 🎨 **HD‑2D art** — flat sprite characters in a 3D world; single‑pass shader‑gradient skies, atmospheric haze, golden‑hour light.
- 🚶 **Walk & talk** — free movement, a gentle follow camera, dialogue popups that always name who’s speaking, and soft on‑screen guidance so you’re never lost.
- 🔊 **All procedural** — every visual is drawn in code and every sound is synthesized at runtime. **Zero image or audio files.**
- 📖 **Faithful to the text** — Berean Standard Bible (public domain), verified verse‑by‑verse; verses narrated by the browser.
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
  **Scene 1 — The Coat & the Dreams** (Genesis 37:1‑11) is playable now: the robe of many
  colors, the brothers’ jealousy, and the two dreams by night. More scenes are on the way.

## 🚀 Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## 🛠️ Tech

**Three.js · Vite · plain ES‑module JavaScript** — no framework, no TypeScript.

The HD‑2D technique: yaw‑billboarded canvas‑texture sprites living in unlit low‑poly
environments, one dithered shader‑gradient sky dome, fog for depth, instanced props, and a
device‑tier DPR clamp with adaptive quality that sheds resolution only when a device is
actually struggling. The UI is a DOM overlay, so text stays crisp at any resolution. Audio is
a channel‑mixed WebAudio graph (**Master / Music / SFX / Narrator**); drop real sound files
into [`/audio`](audio/README.md) and they replace the procedural placeholders automatically.

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
src/data/             verses (BSB), story registry, audio manifest
```

## 📜 Notes

- Scripture is the **Berean Standard Bible** (public domain).
- The earlier Phaser 3 version (a full playable Creation story) is preserved on the
  [`phaser-archive`](https://github.com/TDG-Org/MARANATHA/tree/phaser-archive) branch.

<div align="center">

*Built with care. Every frame eases; nothing pops.*

</div>
