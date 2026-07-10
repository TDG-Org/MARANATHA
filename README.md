# MARANATHA

A calm, hand-crafted 2D browser game. Play in your browser — no install, no login.

**▶ Play:** https://tdg-org.github.io/MARANATHA/

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## Tech

Three.js · Vite · plain ES-module JavaScript, in an HD-2D style: flat hand-drawn sprite characters living in a low-poly 3D world with a real moving camera. Every visual is generated in code — no image files — and the sound, music, and ambience are synthesized at runtime, with each verse read aloud by the browser. Skies are single-pass shader gradients, characters are billboarded sprites, forests render as one instanced draw call, and the resolution adapts to the device — light enough for low-end phones. Scripture text is the Berean Standard Bible (public domain).

Add `#debug` to the URL for a live FPS / draw-call readout.

> The previous Phaser 3 version (full playable Creation story) is preserved on the [`phaser-archive`](https://github.com/TDG-Org/MARANATHA/tree/phaser-archive) branch.
